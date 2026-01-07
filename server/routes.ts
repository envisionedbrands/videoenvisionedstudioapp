import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import Busboy from "busboy";
import FormData from "form-data";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { isAuthenticated } from "./replit_integrations/auth";
import { db } from "./db";
import { userSettings, trainingVideos, insertTrainingVideoSchema } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { encrypt, decrypt } from "./encryption";
import { ObjectStorageService } from "./objectStorage";

// Helper function to get user's webhook URL
async function getUserWebhookUrl(userId: string): Promise<string | null> {
  const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  return settings?.webhookUrl || null;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Get user settings
  app.get("/api/settings", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
      
      res.json({
        webhookUrl: settings?.webhookUrl || "",
        airtableApiKey: settings?.airtableApiKey ? "••••••••" : "",
        airtableBaseId: settings?.airtableBaseId || "",
        airtableTableName: settings?.airtableTableName || "",
        hasApiKey: !!settings?.airtableApiKey,
        openaiApiKey: settings?.openaiApiKey ? "••••••••" : "",
        hasOpenaiKey: !!settings?.openaiApiKey,
      });
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // Save user settings
  app.post("/api/settings", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { webhookUrl, airtableApiKey, airtableBaseId, airtableTableName, openaiApiKey, clearApiKey, clearOpenaiKey } = req.body;

      const [existing] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));

      let encryptedApiKey: string | null | undefined;
      if (clearApiKey) {
        encryptedApiKey = null;
      } else if (airtableApiKey && !airtableApiKey.startsWith("••")) {
        encryptedApiKey = encrypt(airtableApiKey);
      } else {
        encryptedApiKey = existing?.airtableApiKey;
      }

      let encryptedOpenaiKey: string | null | undefined;
      if (clearOpenaiKey) {
        encryptedOpenaiKey = null;
      } else if (openaiApiKey && !openaiApiKey.startsWith("••")) {
        encryptedOpenaiKey = encrypt(openaiApiKey);
      } else {
        encryptedOpenaiKey = existing?.openaiApiKey;
      }

      const trimmedWebhookUrl = webhookUrl?.trim() || null;

      if (existing) {
        await db.update(userSettings)
          .set({
            webhookUrl: trimmedWebhookUrl,
            airtableApiKey: encryptedApiKey,
            airtableBaseId,
            airtableTableName,
            openaiApiKey: encryptedOpenaiKey,
            updatedAt: new Date(),
          })
          .where(eq(userSettings.userId, userId));
      } else {
        await db.insert(userSettings).values({
          userId,
          webhookUrl: trimmedWebhookUrl,
          airtableApiKey: encryptedApiKey,
          airtableBaseId,
          airtableTableName,
          openaiApiKey: encryptedOpenaiKey,
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving settings:", error);
      res.status(500).json({ error: "Failed to save settings" });
    }
  });

  // Get clips from Airtable
  app.get("/api/clips", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));

      if (!settings?.airtableApiKey || !settings?.airtableBaseId || !settings?.airtableTableName) {
        return res.status(400).json({ error: "Airtable not configured" });
      }

      const decryptedApiKey = decrypt(settings.airtableApiKey);
      if (!decryptedApiKey) {
        return res.status(400).json({ error: "Invalid API key configuration" });
      }

      const airtableUrl = `https://api.airtable.com/v0/${settings.airtableBaseId}/${encodeURIComponent(settings.airtableTableName)}`;
      
      const response = await fetch(airtableUrl, {
        headers: {
          Authorization: `Bearer ${decryptedApiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Airtable error:", errorText);
        return res.status(response.status).json({ error: "Failed to fetch clips from Airtable" });
      }

      const data = await response.json();
      
      // Transform Airtable records to clip format
      // Clips table has: Clip Description, Transcript, Duration, Final Clip (attachment)
      const clips = data.records.map((record: any) => {
        const finalClip = record.fields["Final Clip"];
        const videoAttachment = Array.isArray(finalClip) && finalClip.length > 0 ? finalClip[0] : null;
        
        return {
          id: record.id,
          name: record.fields["Clip Description"] || record.fields.Name || record.fields.name || "Untitled Clip",
          transcript: record.fields.Transcript || "",
          duration: record.fields.Duration || 0,
          videoUrl: videoAttachment?.url || "",
          thumbnailUrl: videoAttachment?.thumbnails?.large?.url || videoAttachment?.thumbnails?.small?.url || "",
          fileName: videoAttachment?.filename || "clip.mp4",
          fileSize: videoAttachment?.size || 0,
          createdAt: record.createdTime,
        };
      }).filter((clip: any) => clip.videoUrl);

      console.log("Clips found:", clips.length, "Sample:", clips[0]?.videoUrl?.substring(0, 50));
      res.json(clips);
    } catch (error) {
      console.error("Error fetching clips:", error);
      res.status(500).json({ error: "Failed to fetch clips" });
    }
  });

  // Proxy download for Airtable clips (to avoid CORS issues)
  app.get("/api/clips/:clipId/download", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const clipId = req.params.clipId;
      const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));

      if (!settings?.airtableApiKey || !settings?.airtableBaseId || !settings?.airtableTableName) {
        return res.status(400).json({ error: "Airtable not configured" });
      }

      const decryptedApiKey = decrypt(settings.airtableApiKey);
      if (!decryptedApiKey) {
        return res.status(400).json({ error: "Invalid API key configuration" });
      }

      // Fetch the specific record
      const airtableUrl = `https://api.airtable.com/v0/${settings.airtableBaseId}/${encodeURIComponent(settings.airtableTableName)}/${clipId}`;
      
      const response = await fetch(airtableUrl, {
        headers: {
          Authorization: `Bearer ${decryptedApiKey}`,
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch clip" });
      }

      const record = await response.json();
      const finalClip = record.fields["Final Clip"];
      const videoAttachment = Array.isArray(finalClip) && finalClip.length > 0 ? finalClip[0] : null;

      if (!videoAttachment?.url) {
        return res.status(404).json({ error: "Video not found" });
      }

      // Fetch the video and stream it to the client
      const videoResponse = await fetch(videoAttachment.url);
      if (!videoResponse.ok) {
        return res.status(500).json({ error: "Failed to download video" });
      }

      const filename = videoAttachment.filename || "clip.mp4";
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", videoAttachment.type || "video/mp4");
      
      const arrayBuffer = await videoResponse.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error) {
      console.error("Error downloading clip:", error);
      res.status(500).json({ error: "Failed to download clip" });
    }
  });

  // Delete clip from Airtable
  app.delete("/api/clips/:clipId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const clipId = req.params.clipId;
      const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));

      if (!settings?.airtableApiKey || !settings?.airtableBaseId || !settings?.airtableTableName) {
        return res.status(400).json({ error: "Airtable not configured" });
      }

      const decryptedApiKey = decrypt(settings.airtableApiKey);
      if (!decryptedApiKey) {
        return res.status(400).json({ error: "Invalid API key configuration" });
      }

      const airtableUrl = `https://api.airtable.com/v0/${settings.airtableBaseId}/${encodeURIComponent(settings.airtableTableName)}/${clipId}`;
      
      const response = await fetch(airtableUrl, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${decryptedApiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Airtable delete error:", errorText);
        return res.status(response.status).json({ error: "Failed to delete clip" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting clip:", error);
      res.status(500).json({ error: "Failed to delete clip" });
    }
  });

  // AI analyze clip transcript
  app.post("/api/clips/:clipId/analyze", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const clipId = req.params.clipId;
      const { transcript } = req.body;

      if (!transcript) {
        return res.status(400).json({ error: "No transcript provided" });
      }

      const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));

      if (!settings?.openaiApiKey) {
        return res.status(400).json({ error: "OpenAI API key not configured. Please add your API key in Settings." });
      }

      const decryptedApiKey = decrypt(settings.openaiApiKey);
      if (!decryptedApiKey) {
        return res.status(400).json({ error: "Invalid OpenAI API key configuration" });
      }

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: decryptedApiKey });

      let completion;
      try {
        completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a social media content strategist. Analyze the given video transcript and provide:
1. A virality score from 1-100 based on engagement potential, emotional impact, uniqueness, and shareability
2. 3 suggested hook titles for social media (attention-grabbing, under 60 characters each)
3. A brief explanation (2-3 sentences) of why you gave this virality score

Respond in JSON format:
{
  "viralityScore": number,
  "hooks": ["hook1", "hook2", "hook3"],
  "explanation": "string"
}`
            },
            {
              role: "user",
              content: `Analyze this video transcript:\n\n${transcript}`
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 500
        });
      } catch (openaiError: any) {
        const status = openaiError?.status;
        const code = openaiError?.code;
        
        if (status === 401 || code === "invalid_api_key") {
          return res.status(401).json({ error: "Invalid OpenAI API key. Please check your key in Settings." });
        }
        if (status === 429) {
          return res.status(429).json({ error: "Rate limit exceeded. Please try again later." });
        }
        if (status === 402 || code === "insufficient_quota") {
          return res.status(402).json({ error: "OpenAI quota exceeded. Please check your account billing." });
        }
        return res.status(500).json({ error: "Failed to analyze clip. Please try again." });
      }

      const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
      res.json(result);
    } catch (error) {
      console.error("Error in analyze endpoint");
      res.status(500).json({ error: "Failed to analyze clip. Please try again." });
    }
  });
  
  app.post("/api/submit-video", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const webhookUrl = await getUserWebhookUrl(userId);
      
      if (!webhookUrl) {
        return res.status(400).json({ error: "Webhook URL not configured. Please add your n8n webhook URL in Settings." });
      }

      const payload = req.body;
      
      if (!payload.video_type) {
        return res.status(400).json({ error: "Missing video_type" });
      }
      
      if (!["youtube", "url"].includes(payload.video_type) || !payload.video_url) {
        return res.status(400).json({ error: "Use /api/upload-video for file uploads" });
      }
      
      if (!payload.clip_size || !payload.clip_duration || !payload.clip_count) {
        return res.status(400).json({ error: "Missing clip configuration" });
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ 
          error: errorText || `Webhook returned status ${response.status}` 
        });
      }

      const result = await response.text();
      res.json({ success: true, message: result || "Video submitted successfully" });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to submit video" 
      });
    }
  });

  // Get presigned upload URL for direct-to-storage uploads
  app.post("/api/objects/upload-url", isAuthenticated, async (req: any, res: Response) => {
    try {
      const filename = req.body.filename || "video.mp4";
      const objectStorageService = new ObjectStorageService();
      const { uploadURL, objectPath, downloadURL } = await objectStorageService.getObjectEntityUploadURL(filename);
      res.json({ uploadURL, objectPath, downloadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Submit video from storage URL to webhook
  app.post("/api/submit-storage-video", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const webhookUrl = await getUserWebhookUrl(userId);
      
      if (!webhookUrl) {
        return res.status(400).json({ error: "Webhook URL not configured. Please add your n8n webhook URL in Settings." });
      }

      const { videoUrl, fileName, clipSize, clipDuration, clipCount } = req.body;
      
      if (!videoUrl) {
        return res.status(400).json({ error: "Missing video URL" });
      }
      
      if (!clipSize || !clipDuration || !clipCount) {
        return res.status(400).json({ error: "Missing clip configuration" });
      }

      const payload = {
        video_type: "url",
        video_url: videoUrl,
        file_name: fileName || "video.mp4",
        clip_size: clipSize,
        clip_duration: clipDuration,
        clip_count: clipCount,
      };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ 
          error: errorText || `Webhook returned status ${response.status}` 
        });
      }

      const result = await response.text();
      res.json({ success: true, message: result || "Video submitted successfully" });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to submit video" 
      });
    }
  });

  app.post("/api/upload-video", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.claims.sub;
    const webhookUrl = await getUserWebhookUrl(userId);
    
    if (!webhookUrl) {
      return res.status(400).json({ error: "Webhook URL not configured. Please add your n8n webhook URL in Settings." });
    }

    const tempDir = os.tmpdir();
    let tempFilePath: string | null = null;
    let fileStream: fs.WriteStream | null = null;
    let fileName = "";
    let clipSize = "";
    let clipDuration = "";
    let clipCount = 1;
    let fileReceived = false;

    try {
      const busboy = Busboy({ 
        headers: req.headers,
        limits: {
          fileSize: 500 * 1024 * 1024,
        }
      });

      busboy.on("field", (name: string, value: string) => {
        if (name === "clip_size") clipSize = value;
        if (name === "clip_duration") clipDuration = value;
        if (name === "clip_count") clipCount = parseInt(value) || 1;
      });

      busboy.on("file", (name: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
        fileName = info.filename;
        fileReceived = true;
        
        const uniqueId = Date.now() + "-" + Math.random().toString(36).substring(7);
        tempFilePath = path.join(tempDir, `upload-${uniqueId}-${fileName}`);
        fileStream = fs.createWriteStream(tempFilePath);
        
        file.pipe(fileStream);
        
        file.on("limit", () => {
          console.error("File size limit exceeded");
          if (fileStream) fileStream.destroy();
          if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        });
      });

      busboy.on("finish", async () => {
        try {
          if (!fileReceived || !tempFilePath) {
            return res.status(400).json({ error: "No file uploaded" });
          }

          if (!clipSize || !clipDuration) {
            if (tempFilePath && fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
            return res.status(400).json({ error: "Missing clip configuration" });
          }

          await new Promise<void>((resolve) => {
            if (fileStream) {
              fileStream.on("finish", () => resolve());
            } else {
              resolve();
            }
          });

          const form = new FormData();
          form.append("video_type", "mp4");
          form.append("file_name", fileName);
          form.append("clip_size", clipSize);
          form.append("clip_duration", clipDuration);
          form.append("clip_count", clipCount.toString());
          form.append("file", fs.createReadStream(tempFilePath), {
            filename: fileName,
            contentType: "video/mp4",
          });

          const response = await fetch(webhookUrl, {
            method: "POST",
            body: form as unknown as BodyInit,
            headers: form.getHeaders(),
          });

          if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }

          if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ 
              error: errorText || `Webhook returned status ${response.status}` 
            });
          }

          const result = await response.text();
          res.json({ success: true, message: result || "Video submitted successfully" });
        } catch (error) {
          console.error("Upload processing error:", error);
          if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
          res.status(500).json({ 
            error: error instanceof Error ? error.message : "Failed to process upload" 
          });
        }
      });

      busboy.on("error", (error: Error) => {
        console.error("Busboy error:", error);
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        res.status(500).json({ error: "Upload failed" });
      });

      req.pipe(busboy);
    } catch (error) {
      console.error("Upload error:", error);
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Upload failed" 
      });
    }
  });

  // Get all training videos
  app.get("/api/training-videos", isAuthenticated, async (req: any, res: Response) => {
    try {
      const videos = await db.select().from(trainingVideos).orderBy(desc(trainingVideos.createdAt));
      res.json(videos);
    } catch (error) {
      console.error("Error fetching training videos:", error);
      res.status(500).json({ error: "Failed to fetch training videos" });
    }
  });

  // Add a training video
  app.post("/api/training-videos", isAuthenticated, async (req: any, res: Response) => {
    try {
      const parseResult = insertTrainingVideoSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid input: " + parseResult.error.errors.map(e => e.message).join(", ")
        });
      }

      const { title, description, videoUrl } = parseResult.data;

      const [video] = await db.insert(trainingVideos).values({
        title,
        description: description || null,
        videoUrl,
      }).returning();

      res.json(video);
    } catch (error) {
      console.error("Error adding training video:", error);
      res.status(500).json({ error: "Failed to add training video" });
    }
  });

  // Delete a training video
  app.delete("/api/training-videos/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      
      await db.delete(trainingVideos).where(eq(trainingVideos.id, id));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting training video:", error);
      res.status(500).json({ error: "Failed to delete training video" });
    }
  });

  return httpServer;
}
