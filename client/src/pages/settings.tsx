import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Eye, EyeOff, CheckCircle } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface UserSettings {
  webhookUrl: string;
  airtableApiKey: string;
  airtableBaseId: string;
  airtableTableName: string;
  openaiApiKey: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [showApiKey, setShowApiKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [formData, setFormData] = useState<UserSettings>({
    webhookUrl: "",
    airtableApiKey: "",
    airtableBaseId: "",
    airtableTableName: "",
    openaiApiKey: "",
  });

  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        webhookUrl: settings.webhookUrl || "",
        airtableApiKey: settings.airtableApiKey || "",
        airtableBaseId: settings.airtableBaseId || "",
        airtableTableName: settings.airtableTableName || "",
        openaiApiKey: settings.openaiApiKey || "",
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: UserSettings) => {
      return apiRequest("POST", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">Settings</h2>
        <p className="text-muted-foreground mt-1">Configure your integrations and preferences</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">n8n Webhook</h3>
            <p className="text-sm text-muted-foreground">
              Your n8n webhook URL for video processing automation.
            </p>

            <div className="space-y-2">
              <Label htmlFor="webhook-url" className="text-sm font-medium">
                Webhook URL
              </Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://your-n8n-instance.app.n8n.cloud/webhook/..."
                value={formData.webhookUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, webhookUrl: e.target.value }))}
                data-testid="input-webhook-url"
              />
              <p className="text-xs text-muted-foreground">
                The webhook URL from your n8n video processing workflow
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">Airtable Integration</h3>
            <p className="text-sm text-muted-foreground">
              Connect your Airtable to view and download your processed clips.
            </p>

            <div className="space-y-2">
              <Label htmlFor="airtable-api-key" className="text-sm font-medium">
                API Key
              </Label>
              <div className="relative">
                <Input
                  id="airtable-api-key"
                  type={showApiKey ? "text" : "password"}
                  placeholder="pat..."
                  value={formData.airtableApiKey}
                  onChange={(e) => setFormData((prev) => ({ ...prev, airtableApiKey: e.target.value }))}
                  className="pr-10"
                  data-testid="input-airtable-api-key"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-api-key"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Find your API key at{" "}
                <a
                  href="https://airtable.com/create/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline"
                >
                  airtable.com/create/tokens
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="airtable-base-id" className="text-sm font-medium">
                Base ID
              </Label>
              <Input
                id="airtable-base-id"
                type="text"
                placeholder="appXXXXXXXXXXXXXX"
                value={formData.airtableBaseId}
                onChange={(e) => setFormData((prev) => ({ ...prev, airtableBaseId: e.target.value }))}
                data-testid="input-airtable-base-id"
              />
              <p className="text-xs text-muted-foreground">
                Found in your Airtable URL: airtable.com/BASE_ID/...
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="airtable-table-name" className="text-sm font-medium">
                Table Name
              </Label>
              <Input
                id="airtable-table-name"
                type="text"
                placeholder="Clips"
                value={formData.airtableTableName}
                onChange={(e) => setFormData((prev) => ({ ...prev, airtableTableName: e.target.value }))}
                data-testid="input-airtable-table-name"
              />
              <p className="text-xs text-muted-foreground">
                The name of the table where your clips are stored
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">OpenAI Integration</h3>
            <p className="text-sm text-muted-foreground">
              Add your OpenAI API key to enable AI-powered analysis features like virality scores and hook suggestions.
            </p>

            <div className="space-y-2">
              <Label htmlFor="openai-api-key" className="text-sm font-medium">
                API Key
              </Label>
              <div className="relative">
                <Input
                  id="openai-api-key"
                  type={showOpenaiKey ? "text" : "password"}
                  placeholder="sk-..."
                  value={formData.openaiApiKey}
                  onChange={(e) => setFormData((prev) => ({ ...prev, openaiApiKey: e.target.value }))}
                  className="pr-10"
                  data-testid="input-openai-api-key"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-openai-key"
                >
                  {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Get your API key at{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline"
                >
                  platform.openai.com/api-keys
                </a>
              </p>
            </div>
          </div>

          <Button
            type="submit"
            disabled={saveMutation.isPending}
            className="w-full bg-foreground text-background hover:bg-foreground/90"
            data-testid="button-save-settings"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>

          {saveMutation.isSuccess && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Settings saved successfully</span>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
