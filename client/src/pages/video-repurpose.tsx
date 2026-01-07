import { useState, useRef, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, Link, Loader2, CheckCircle, AlertCircle, X, FileVideo, Globe, Clock } from "lucide-react";
import Uppy from "@uppy/core";
import { Dashboard } from "@uppy/react";
import AwsS3 from "@uppy/aws-s3";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

const CLIP_SIZES = [
  { value: "1920x1080", label: "1920 x 1080 (Landscape)" },
  { value: "1080x1920", label: "1080 x 1920 (Portrait)" },
  { value: "1080x1080", label: "1080 x 1080 (Square)" },
];

const CLIP_DURATIONS = [
  { value: "1", label: "1 minute" },
  { value: "3", label: "3 minutes" },
  { value: "5", label: "5 minutes" },
];

type FormStatus = "idle" | "loading" | "uploading" | "success" | "error";
type InputMode = "file" | "youtube" | "url" | null;

interface FormData {
  videoUrl: string;
  youtubeUrl: string;
  clipSize: string;
  clipDuration: string;
  clipCount: number;
}

interface FormErrors {
  videoUrl?: string;
  youtubeUrl?: string;
  clipSize?: string;
  clipDuration?: string;
  clipCount?: string;
}

function isValidVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function VideoRepurpose() {
  const [formData, setFormData] = useState<FormData>({
    videoUrl: "",
    youtubeUrl: "",
    clipSize: "",
    clipDuration: "",
    clipCount: 1,
  });
  const [inputMode, setInputMode] = useState<InputMode>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const downloadUrlRef = useRef<string | null>(null);

  const uppy = useMemo(() => {
    const uppyInstance = new Uppy({
      restrictions: {
        maxNumberOfFiles: 1,
        maxFileSize: 500 * 1024 * 1024,
        allowedFileTypes: ["video/mp4"],
      },
      autoProceed: false,
    }).use(AwsS3, {
      shouldUseMultipart: false,
      async getUploadParameters(file) {
        const response = await fetch("/api/objects/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ filename: file.name }),
        });
        if (!response.ok) {
          throw new Error("Failed to get upload URL");
        }
        const data = await response.json();
        downloadUrlRef.current = data.downloadURL;
        return {
          method: "PUT",
          url: data.uploadURL,
          headers: {
            "Content-Type": file.type || "video/mp4",
          },
        };
      },
    });

    uppyInstance.on("upload-progress", (file, progress) => {
      if (progress.bytesTotal) {
        const percent = Math.round((progress.bytesUploaded / progress.bytesTotal) * 100);
        setUploadProgress(percent);
      }
    });

    uppyInstance.on("upload-success", async (file) => {
      if (file && downloadUrlRef.current) {
        setUploadedVideoUrl(downloadUrlRef.current);
        setUploadedFileName(file.name || "video.mp4");
        setInputMode("file");
      }
    });

    uppyInstance.on("upload-error", (file, error) => {
      console.error("Upload error:", error);
      setStatus("error");
      setErrorMessage(error?.message || "Failed to upload file");
    });

    uppyInstance.on("file-added", () => {
      setInputMode("file");
      setFormData((prev) => ({ ...prev, videoUrl: "", youtubeUrl: "" }));
      setErrors({});
      downloadUrlRef.current = null;
    });

    uppyInstance.on("file-removed", () => {
      setUploadedVideoUrl(null);
      setUploadedFileName(null);
      downloadUrlRef.current = null;
      setInputMode(null);
    });

    return uppyInstance;
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const hasQueuedFile = uppy.getFiles().length > 0;

    if (!uploadedVideoUrl && !formData.videoUrl.trim() && !hasQueuedFile) {
      newErrors.videoUrl = "Please upload an MP4 file or provide a video URL";
    }

    if (formData.videoUrl.trim() && !isValidVideoUrl(formData.videoUrl)) {
      newErrors.videoUrl = "Please enter a valid URL starting with http:// or https://";
    }

    if (!formData.clipSize) {
      newErrors.clipSize = "Please select a clip size";
    }

    if (!formData.clipDuration) {
      newErrors.clipDuration = "Please select a clip duration";
    }

    if (formData.clipCount < 1) {
      newErrors.clipCount = "Clip count must be at least 1";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleVideoUrlChange = (url: string) => {
    if (url) {
      setInputMode("url");
      uppy.cancelAll();
      setUploadedVideoUrl(null);
      setUploadedFileName(null);
    }
    setFormData((prev) => ({ ...prev, videoUrl: url, youtubeUrl: "" }));
    if (url && !isValidVideoUrl(url)) {
      setErrors((prev) => ({ ...prev, videoUrl: "Please enter a valid URL" }));
    } else {
      setErrors((prev) => ({ ...prev, videoUrl: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setStatus("loading");
    setUploadProgress(0);
    setErrorMessage("");

    try {
      const files = uppy.getFiles();
      let videoUrl = uploadedVideoUrl;
      let fileName = uploadedFileName;

      if (files.length > 0 && !uploadedVideoUrl) {
        setStatus("uploading");
        const result = await uppy.upload();
        if (result && result.failed && result.failed.length > 0) {
          throw new Error("Upload failed");
        }
        const successFile = result?.successful?.[0];
        if (successFile && downloadUrlRef.current) {
          videoUrl = downloadUrlRef.current;
          fileName = successFile.name || "video.mp4";
        }
      }

      if (videoUrl) {
        setUploadProgress(90);
        const response = await fetch("/api/submit-storage-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            videoUrl,
            fileName,
            clipSize: formData.clipSize,
            clipDuration: formData.clipDuration,
            clipCount: formData.clipCount,
          }),
        });

        setUploadProgress(100);

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || `Request failed with status ${response.status}`);
        }

        setStatus("success");
      } else if (formData.videoUrl) {
        setUploadProgress(50);

        const response = await fetch("/api/submit-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            video_type: "url",
            video_url: formData.videoUrl,
            clip_size: formData.clipSize,
            clip_duration: formData.clipDuration,
            clip_count: formData.clipCount,
          }),
        });

        setUploadProgress(100);

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || `Request failed with status ${response.status}`);
        }

        setStatus("success");
      } else {
        throw new Error("No video source provided");
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "An unexpected error occurred");
    }
  };

  const resetForm = () => {
    uppy.cancelAll();
    setFormData({
      videoUrl: "",
      youtubeUrl: "",
      clipSize: "",
      clipDuration: "",
      clipCount: 1,
    });
    setInputMode(null);
    setErrors({});
    setStatus("idle");
    setErrorMessage("");
    setUploadProgress(0);
    setUploadedVideoUrl(null);
    setUploadedFileName(null);
  };

  const hasVideoSource = uploadedVideoUrl || uppy.getFiles().length > 0 || formData.videoUrl.trim();
  const isSubmitDisabled = status === "loading" || status === "uploading" || !hasVideoSource;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">Video Repurpose</h2>
        <p className="text-muted-foreground mt-1">Transform your videos into engaging clips</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <Label className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Upload Video
            </Label>

            <div className="rounded-lg border border-border overflow-hidden">
              <Dashboard
                uppy={uppy}
                hideUploadButton
                hideCancelButton
                hideRetryButton
                hidePauseResumeButton
                showProgressDetails
                proudlyDisplayPoweredByUppy={false}
                height={200}
                width="100%"
                note="MP4 files up to 500MB"
                locale={{
                  strings: {
                    dropPasteFiles: "Drop your MP4 file here or %{browseFiles}",
                    browseFiles: "browse files",
                  },
                }}
              />
            </div>
            
            {uploadedVideoUrl && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 border border-green-500/20">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-700 dark:text-green-400">
                  File uploaded: {uploadedFileName}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-sm font-medium text-muted-foreground">OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="video-url" className="text-sm font-medium">
              Direct Video URL
            </Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="video-url"
                type="url"
                placeholder="https://storage.example.com/video.mp4"
                value={formData.videoUrl}
                onChange={(e) => handleVideoUrlChange(e.target.value)}
                className={`pl-10 ${errors.videoUrl ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                disabled={status === "loading" || status === "uploading"}
                data-testid="input-video-url"
              />
            </div>
            {errors.videoUrl && !uploadedVideoUrl && uppy.getFiles().length === 0 && (
              <p className="text-sm text-red-500" data-testid="text-error-video-url">{errors.videoUrl}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Paste a direct link to an MP4 file (Google Cloud, S3, etc.)
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-sm font-medium text-muted-foreground">OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="youtube-url" className="text-sm font-medium">
                YouTube URL
              </Label>
              <Badge variant="secondary" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Coming Soon
              </Badge>
            </div>
            <div className="relative">
              <Link className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-50" />
              <Input
                id="youtube-url"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={formData.youtubeUrl}
                disabled
                className="pl-10 opacity-50 cursor-not-allowed"
                data-testid="input-youtube-url"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              YouTube URL support is currently under development
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clip-size" className="text-sm font-medium">
                Clip Size
              </Label>
              <Select
                value={formData.clipSize}
                onValueChange={(value) => {
                  setFormData((prev) => ({ ...prev, clipSize: value }));
                  setErrors((prev) => ({ ...prev, clipSize: undefined }));
                }}
                disabled={status === "loading" || status === "uploading"}
              >
                <SelectTrigger
                  id="clip-size"
                  className={errors.clipSize ? "border-red-400" : ""}
                  data-testid="select-clip-size"
                >
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {CLIP_SIZES.map((size) => (
                    <SelectItem key={size.value} value={size.value} data-testid={`option-size-${size.value}`}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.clipSize && (
                <p className="text-sm text-red-500" data-testid="text-error-clip-size">{errors.clipSize}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="clip-duration" className="text-sm font-medium">
                Clip Duration
              </Label>
              <Select
                value={formData.clipDuration}
                onValueChange={(value) => {
                  setFormData((prev) => ({ ...prev, clipDuration: value }));
                  setErrors((prev) => ({ ...prev, clipDuration: undefined }));
                }}
                disabled={status === "loading" || status === "uploading"}
              >
                <SelectTrigger
                  id="clip-duration"
                  className={errors.clipDuration ? "border-red-400" : ""}
                  data-testid="select-clip-duration"
                >
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  {CLIP_DURATIONS.map((duration) => (
                    <SelectItem key={duration.value} value={duration.value} data-testid={`option-duration-${duration.value}`}>
                      {duration.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.clipDuration && (
                <p className="text-sm text-red-500" data-testid="text-error-clip-duration">{errors.clipDuration}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clip-count" className="text-sm font-medium">
              Number of Clips
            </Label>
            <Input
              id="clip-count"
              type="number"
              min={1}
              value={formData.clipCount}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 1;
                setFormData((prev) => ({ ...prev, clipCount: Math.max(1, value) }));
                setErrors((prev) => ({ ...prev, clipCount: undefined }));
              }}
              className={errors.clipCount ? "border-red-400" : ""}
              disabled={status === "loading" || status === "uploading"}
              data-testid="input-clip-count"
            />
            {errors.clipCount && (
              <p className="text-sm text-red-500" data-testid="text-error-clip-count">{errors.clipCount}</p>
            )}
          </div>

          {(status === "loading" || status === "uploading") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {status === "uploading" ? "Uploading to cloud..." : "Processing..."}
                </span>
                <span className="font-medium text-foreground">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" data-testid="progress-upload" />
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full bg-foreground text-background hover:bg-foreground/90"
            size="lg"
            data-testid="button-submit"
          >
            {status === "loading" || status === "uploading" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {status === "uploading" ? "Uploading..." : "Processing..."}
              </>
            ) : (
              "Submit for Processing"
            )}
          </Button>

          {status === "success" && (
            <div className="flex items-start gap-3 rounded-lg border-l-4 border-green-500 bg-green-500/10 p-4" data-testid="status-success">
              <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-500" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">
                  Your video has been submitted for processing.
                </p>
                <p className="mt-1 text-sm text-green-600 dark:text-green-500">
                  Processing may take several minutes depending on video length. Check the My Clips section once complete.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  className="mt-3 text-green-700 dark:text-green-400"
                  data-testid="button-submit-another"
                >
                  Submit Another Video
                </Button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="flex items-start gap-3 rounded-lg border-l-4 border-red-500 bg-red-500/10 p-4" data-testid="status-error">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">
                  Unable to process your request
                </p>
                <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                  Please check your connection and try again.
                </p>
                {errorMessage && (
                  <p className="mt-2 rounded bg-red-500/10 p-2 font-mono text-xs text-red-600 dark:text-red-500">
                    {errorMessage}
                  </p>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatus("idle")}
                  className="mt-3 text-red-700 dark:text-red-400"
                  data-testid="button-try-again"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
