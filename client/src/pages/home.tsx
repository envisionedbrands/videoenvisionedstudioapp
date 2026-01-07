import { useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, Link, Loader2, CheckCircle, AlertCircle, X, FileVideo, Globe } from "lucide-react";

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

type FormStatus = "idle" | "loading" | "success" | "error";
type InputMode = "file" | "youtube" | "url" | null;

interface FormData {
  file: File | null;
  youtubeUrl: string;
  videoUrl: string;
  clipSize: string;
  clipDuration: string;
  clipCount: number;
}

interface FormErrors {
  file?: string;
  youtubeUrl?: string;
  videoUrl?: string;
  clipSize?: string;
  clipDuration?: string;
  clipCount?: string;
}

function isValidYouTubeUrl(url: string): boolean {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+(&[\w=]*)*$/;
  return youtubeRegex.test(url);
}

function isValidVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function Home() {
  const [formData, setFormData] = useState<FormData>({
    file: null,
    youtubeUrl: "",
    videoUrl: "",
    clipSize: "",
    clipDuration: "",
    clipCount: 1,
  });
  const [inputMode, setInputMode] = useState<InputMode>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.file && !formData.youtubeUrl.trim() && !formData.videoUrl.trim()) {
      newErrors.file = "Please upload an MP4 file or provide a video URL";
    }

    if (formData.youtubeUrl.trim() && !isValidYouTubeUrl(formData.youtubeUrl)) {
      newErrors.youtubeUrl = "Please enter a valid YouTube URL";
    }

    if (formData.videoUrl.trim() && !isValidVideoUrl(formData.videoUrl)) {
      newErrors.videoUrl = "Please enter a valid URL starting with http:// or https://";
    }

    if (formData.file && formData.file.type !== "video/mp4") {
      newErrors.file = "Only MP4 files are supported";
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

  const clearOtherInputs = (mode: InputMode) => {
    setInputMode(mode);
    if (mode === "file") {
      setFormData((prev) => ({ ...prev, youtubeUrl: "", videoUrl: "" }));
    } else if (mode === "youtube") {
      setFormData((prev) => ({ ...prev, file: null, videoUrl: "" }));
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else if (mode === "url") {
      setFormData((prev) => ({ ...prev, file: null, youtubeUrl: "" }));
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    setErrors({});
  };

  const handleFileChange = (file: File | null) => {
    if (file) {
      if (file.type !== "video/mp4") {
        setErrors((prev) => ({ ...prev, file: "Only MP4 files are supported" }));
        return;
      }
      clearOtherInputs("file");
      setFormData((prev) => ({ ...prev, file }));
    }
  };

  const handleYoutubeChange = (url: string) => {
    if (url && inputMode !== "youtube") {
      clearOtherInputs("youtube");
    }
    setFormData((prev) => ({ ...prev, youtubeUrl: url }));
    if (url && !isValidYouTubeUrl(url)) {
      setErrors((prev) => ({ ...prev, youtubeUrl: "Please enter a valid YouTube URL" }));
    } else {
      setErrors((prev) => ({ ...prev, youtubeUrl: undefined }));
    }
  };

  const handleVideoUrlChange = (url: string) => {
    if (url && inputMode !== "url") {
      clearOtherInputs("url");
    }
    setFormData((prev) => ({ ...prev, videoUrl: url }));
    if (url && !isValidVideoUrl(url)) {
      setErrors((prev) => ({ ...prev, videoUrl: "Please enter a valid URL" }));
    } else {
      setErrors((prev) => ({ ...prev, videoUrl: undefined }));
    }
  };

  const removeFile = () => {
    setFormData((prev) => ({ ...prev, file: null }));
    setInputMode(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileChange(file);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setStatus("loading");
    setUploadProgress(0);
    setErrorMessage("");

    try {
      if (formData.file) {
        // File upload
        const formDataObj = new window.FormData();
        formDataObj.append("file", formData.file);
        formDataObj.append("clip_size", formData.clipSize);
        formDataObj.append("clip_duration", formData.clipDuration);
        formDataObj.append("clip_count", formData.clipCount.toString());

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrRef.current = xhr;

          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 90);
              setUploadProgress(percent);
            }
          });

          xhr.addEventListener("load", () => {
            setUploadProgress(100);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              try {
                const response = JSON.parse(xhr.responseText);
                reject(new Error(response.error || `Request failed with status ${xhr.status}`));
              } catch {
                reject(new Error(`Request failed with status ${xhr.status}`));
              }
            }
          });

          xhr.addEventListener("error", () => {
            reject(new Error("Network error occurred"));
          });

          xhr.addEventListener("abort", () => {
            reject(new Error("Upload cancelled"));
          });

          xhr.open("POST", "/api/upload-video");
          xhr.withCredentials = true;
          xhr.send(formDataObj);
        });

        setStatus("success");
      } else {
        // YouTube or direct URL
        const payload = {
          video_type: formData.youtubeUrl ? "youtube" : "url",
          video_url: formData.youtubeUrl || formData.videoUrl,
          clip_size: formData.clipSize,
          clip_duration: formData.clipDuration,
          clip_count: formData.clipCount,
        };

        setUploadProgress(50);

        const response = await fetch("/api/submit-video", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        setUploadProgress(100);

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || `Request failed with status ${response.status}`);
        }

        setStatus("success");
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "An unexpected error occurred");
    }
  };

  const resetForm = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    setFormData({
      file: null,
      youtubeUrl: "",
      videoUrl: "",
      clipSize: "",
      clipDuration: "",
      clipCount: 1,
    });
    setInputMode(null);
    setErrors({});
    setStatus("idle");
    setErrorMessage("");
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isSubmitDisabled = status === "loading" || (!formData.file && !formData.youtubeUrl.trim() && !formData.videoUrl.trim());

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background py-6">
        <div className="mx-auto max-w-2xl px-4">
          <h1 className="text-center text-2xl font-semibold text-foreground" data-testid="text-header-title">
            Envisioned Video Repurpose
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 md:py-12">
        <Card className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <Label className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Upload Video
              </Label>

              <div
                className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                  isDragging
                    ? "border-[#e5d6c7] bg-[#e5d6c7]/10"
                    : formData.file
                    ? "border-[#e5d6c7] bg-[#e5d6c7]/5"
                    : "border-muted hover:border-[#e5d6c7]/50 hover:bg-[#e5d6c7]/5"
                } ${errors.file && !formData.youtubeUrl && !formData.videoUrl ? "border-red-400" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                data-testid="dropzone-file-upload"
              >
                {formData.file ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-foreground">
                      <FileVideo className="h-8 w-8 text-[#e5d6c7]" />
                      <span className="font-medium" data-testid="text-file-name">{formData.file.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(formData.file.size)}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removeFile}
                      className="text-muted-foreground"
                      data-testid="button-remove-file"
                    >
                      <X className="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-foreground">
                      Drag and drop your MP4 file here
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">Supports files up to 500MB</p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-browse-files"
                    >
                      Browse Files
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/mp4"
                      className="hidden"
                      onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                      data-testid="input-file-upload"
                    />
                  </>
                )}
              </div>
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
                  disabled={status === "loading"}
                  data-testid="input-video-url"
                />
              </div>
              {errors.videoUrl && (
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
              <Label htmlFor="youtube-url" className="text-sm font-medium">
                YouTube URL
              </Label>
              <div className="relative">
                <Link className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="youtube-url"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={formData.youtubeUrl}
                  onChange={(e) => handleYoutubeChange(e.target.value)}
                  className={`pl-10 ${errors.youtubeUrl ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                  disabled={status === "loading"}
                  data-testid="input-youtube-url"
                />
              </div>
              {errors.youtubeUrl && (
                <p className="text-sm text-red-500" data-testid="text-error-youtube">{errors.youtubeUrl}</p>
              )}
            </div>

            {(errors.file && !formData.youtubeUrl && !formData.file && !formData.videoUrl) && (
              <p className="text-sm text-red-500" data-testid="text-error-source">{errors.file}</p>
            )}

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
                  disabled={status === "loading"}
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
                  disabled={status === "loading"}
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
                disabled={status === "loading"}
                data-testid="input-clip-count"
              />
              {errors.clipCount && (
                <p className="text-sm text-red-500" data-testid="text-error-clip-count">{errors.clipCount}</p>
              )}
            </div>

            {status === "loading" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {uploadProgress < 90 ? "Uploading..." : "Processing..."}
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
              {status === "loading" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploadProgress < 90 ? "Uploading..." : "Processing..."}
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
                    Your video is being processed.
                  </p>
                  <p className="mt-1 text-sm text-green-600 dark:text-green-500">
                    You will receive the clips once processing is complete.
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
                    Please check your connection and try again. If the problem persists, contact support.
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

        <p className="mt-6 text-center text-sm text-muted-foreground" data-testid="text-footer">
          Powered by Envisioned Automation
        </p>
      </main>
    </div>
  );
}
