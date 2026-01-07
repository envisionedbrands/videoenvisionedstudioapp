import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Upload, Play, X } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { TrainingVideo } from "@shared/schema";

export default function TrainingPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: videos = [], isLoading, isError, error } = useQuery<TrainingVideo[]>({
    queryKey: ["/api/training-videos"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; videoUrl: string }) => {
      const res = await apiRequest("POST", "/api/training-videos", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-videos"] });
      toast({ title: "Video added successfully" });
      resetForm();
      setIsAddDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to add video", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/training-videos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-videos"] });
      toast({ title: "Video deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete video", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setVideoFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("video/")) {
        toast({ title: "Please select a video file", variant: "destructive" });
        return;
      }
      setVideoFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({ title: "Please enter a title", variant: "destructive" });
      return;
    }
    
    if (!videoFile) {
      toast({ title: "Please select a video file", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    
    try {
      const initRes = await apiRequest("POST", "/api/objects/upload-url", {
        filename: videoFile.name,
      });

      const { uploadURL, downloadURL } = await initRes.json() as { uploadURL: string; downloadURL: string };

      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: videoFile,
        headers: { "Content-Type": videoFile.type },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload video file");
      }

      await addMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        videoUrl: downloadURL,
      });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-destructive">
              <X className="h-12 w-12" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground">Failed to load training videos</h3>
              <p className="text-muted-foreground mt-1">
                {(error as Error)?.message || "Please try again later"}
              </p>
            </div>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
            Using the System
          </h2>
          <p className="text-muted-foreground mt-1">
            Training videos to help you get the most out of the platform
          </p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-video">
              <Plus className="h-4 w-4 mr-2" />
              Add Video
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Training Video</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Getting Started with Video Repurposing"
                  data-testid="input-video-title"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Learn how to upload and process your first video..."
                  rows={3}
                  data-testid="input-video-description"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="video">Video File</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                  {videoFile ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground truncate">{videoFile.name}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setVideoFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <div className="flex flex-col items-center gap-2 py-2">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Click to upload video</span>
                      </div>
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={handleFileChange}
                        data-testid="input-video-file"
                      />
                    </label>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setIsAddDialogOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUploading || addMutation.isPending}
                  data-testid="button-submit-video"
                >
                  {isUploading || addMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Add Video"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {videos.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <Play className="h-12 w-12 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-medium text-foreground">No training videos yet</h3>
              <p className="text-muted-foreground mt-1">
                Add videos to help users learn how to use the platform
              </p>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Video
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <Card key={video.id} className="overflow-hidden" data-testid={`card-training-${video.id}`}>
              <div className="aspect-video bg-muted relative">
                <video
                  src={video.videoUrl}
                  className="w-full h-full object-cover"
                  controls
                  preload="metadata"
                  data-testid={`video-player-${video.id}`}
                />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground line-clamp-1" title={video.title}>
                      {video.title}
                    </h3>
                    {video.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2" title={video.description}>
                        {video.description}
                      </p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(video.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${video.id}`}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
