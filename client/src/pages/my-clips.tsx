import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Download, AlertCircle, Settings, Film, Trash2, ChevronDown, ChevronUp, FileText, Sparkles, Copy, Check } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface Clip {
  id: string;
  name: string;
  transcript: string;
  duration: number;
  videoUrl: string;
  thumbnailUrl?: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

interface AnalysisResult {
  viralityScore: number;
  hooks: string[];
  explanation: string;
}

function ClipCard({ clip, onDelete, isDeleting }: { 
  clip: Clip; 
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const { toast } = useToast();
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [copied, setCopied] = useState(false);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/clips/${clip.id}/analyze`, { transcript: clip.transcript });
      return response.json();
    },
    onSuccess: (data) => {
      setAnalysis(data);
    },
    onError: (error: Error) => {
      toast({ title: "Analysis failed", description: error.message, variant: "destructive" });
    },
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const downloadTranscript = () => {
    const blob = new Blob([clip.transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${clip.name || "transcript"}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-600 dark:text-green-400";
    if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <Card className="overflow-visible" data-testid={`card-clip-${clip.id}`}>
      <div className="aspect-video bg-muted relative overflow-hidden rounded-t-md">
        <video
          src={clip.videoUrl}
          className="w-full h-full object-cover"
          controls
          preload="metadata"
          poster={clip.thumbnailUrl}
          data-testid={`video-player-${clip.id}`}
        />
      </div>
      <div className="p-4">
        <h3 className="font-medium text-foreground line-clamp-2" title={clip.name}>
          {clip.name}
        </h3>
        <div className="flex items-center flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
          {clip.createdAt && (
            <span data-testid={`text-date-${clip.id}`}>{formatDate(clip.createdAt)}</span>
          )}
          {clip.createdAt && (clip.duration > 0 || clip.fileSize > 0) && <span>•</span>}
          {clip.duration > 0 && (
            <span>{formatDuration(clip.duration)}</span>
          )}
          {clip.duration > 0 && clip.fileSize > 0 && <span>•</span>}
          {clip.fileSize > 0 && (
            <span>{formatFileSize(clip.fileSize)}</span>
          )}
        </div>

        {clip.transcript && (
          <div className="mt-3">
            <div 
              className={`text-sm text-muted-foreground ${showFullTranscript ? '' : 'line-clamp-2'}`}
            >
              {clip.transcript}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullTranscript(!showFullTranscript)}
                data-testid={`button-toggle-transcript-${clip.id}`}
              >
                {showFullTranscript ? (
                  <>
                    <ChevronUp className="mr-1 h-4 w-4" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-4 w-4" />
                    View Full
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={downloadTranscript}
                data-testid={`button-download-transcript-${clip.id}`}
              >
                <FileText className="mr-1 h-4 w-4" />
                Download .txt
              </Button>
            </div>
          </div>
        )}

        {analysis && (
          <div className="mt-4 p-3 bg-muted/50 rounded-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Virality Score</span>
              <span className={`text-2xl font-bold ${getScoreColor(analysis.viralityScore)}`}>
                {analysis.viralityScore}/100
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{analysis.explanation}</p>
            <div className="space-y-2">
              <span className="text-sm font-medium">Suggested Hooks</span>
              {analysis.hooks.map((hook, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-background rounded text-sm">
                  <span className="flex-1">{hook}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyToClipboard(hook)}
                    data-testid={`button-copy-hook-${clip.id}-${i}`}
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3">
          <Button
            asChild
            size="sm"
            className="flex-1"
            data-testid={`button-download-${clip.id}`}
          >
            <a href={`/api/clips/${clip.id}/download`}>
              <Download className="mr-1 h-4 w-4" />
              Download
            </a>
          </Button>
          {clip.transcript && !analysis && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              data-testid={`button-analyze-${clip.id}`}
            >
              {analyzeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="mr-1 h-4 w-4" />
                  Analyze
                </>
              )}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(clip.id)}
            disabled={isDeleting}
            data-testid={`button-delete-${clip.id}`}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function MyClips() {
  const { toast } = useToast();
  const { data: clips, isLoading, error } = useQuery<Clip[]>({
    queryKey: ["/api/clips"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (clipId: string) => {
      await apiRequest("DELETE", `/api/clips/${clipId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clips"] });
      toast({ title: "Clip deleted", description: "The clip has been removed from your library." });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const hasAirtableSetup = !error || (error as Error).message !== "Airtable not configured";

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAirtableSetup || (error && (error as Error).message === "Airtable not configured")) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">My Clips</h2>
          <p className="text-muted-foreground mt-1">View and download your processed video clips</p>
        </div>

        <Card className="p-8 text-center">
          <Settings className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">Connect Airtable</h3>
          <p className="mt-2 text-muted-foreground max-w-md mx-auto">
            To view your processed clips, you need to connect your Airtable account in Settings.
          </p>
          <Button asChild className="mt-4" variant="outline" data-testid="button-go-to-settings">
            <Link href="/settings">Go to Settings</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">My Clips</h2>
          <p className="text-muted-foreground mt-1">View and download your processed video clips</p>
        </div>

        <Card className="p-8">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-400">Failed to load clips</p>
              <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                {(error as Error).message || "An error occurred while fetching your clips."}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!clips || clips.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">My Clips</h2>
          <p className="text-muted-foreground mt-1">View and download your processed video clips</p>
        </div>

        <Card className="p-8 text-center">
          <Film className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">No clips yet</h3>
          <p className="mt-2 text-muted-foreground max-w-md mx-auto">
            Submit a video for processing and your clips will appear here.
          </p>
          <Button asChild className="mt-4" variant="outline" data-testid="button-go-to-repurpose">
            <Link href="/">Submit a Video</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">My Clips</h2>
        <p className="text-muted-foreground mt-1">View and download your processed video clips</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clips.map((clip) => (
          <ClipCard 
            key={clip.id} 
            clip={clip} 
            onDelete={(id) => deleteMutation.mutate(id)}
            isDeleting={deleteMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}
