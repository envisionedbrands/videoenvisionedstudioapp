import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, Sparkles, Download, Mail } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; firstName?: string; lastName?: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message || "Could not create account",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      loginMutation.mutate({ email, password });
    } else {
      registerMutation.mutate({ email, password, firstName, lastName });
    }
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background py-4">
        <div className="mx-auto max-w-6xl px-4 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-foreground" data-testid="text-logo">
            Envisioned Studio
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-16 md:py-24">
        <div className="text-center space-y-6 mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground" data-testid="text-hero-title">
            Repurpose Your Videos with AI
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-hero-description">
            Transform long-form content into engaging clips. Upload your videos or paste a link, 
            and let our automation create shareable clips in seconds.
          </p>
        </div>

        <div className="max-w-md mx-auto mb-16">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground">
                  {isLogin ? "Sign in to your account" : "Create your account"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {isLogin ? "Welcome back!" : "Get started for free"}
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full"
                asChild
                data-testid="button-google-login"
              >
                <a href="/api/login/google" className="flex items-center justify-center gap-2">
                  <SiGoogle className="h-4 w-4" />
                  Continue with Google
                </a>
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First name</Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        data-testid="input-firstname"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last name</Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        data-testid="input-lastname"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={isLogin ? "Enter your password" : "At least 8 characters"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={isLogin ? 1 : 8}
                    data-testid="input-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-submit"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {isLoading ? "Please wait..." : isLogin ? "Sign in with Email" : "Create Account"}
                </Button>
              </form>

              <div className="text-center text-sm">
                <span className="text-muted-foreground">
                  {isLogin ? "Don't have an account? " : "Already have an account? "}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setPassword("");
                  }}
                  className="text-foreground font-medium underline underline-offset-4"
                  data-testid="button-toggle-auth"
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#e5d6c7]/20 flex items-center justify-center">
              <Video className="h-6 w-6 text-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">Upload or Link</h3>
            <p className="text-sm text-muted-foreground">
              Upload MP4 files directly or paste a YouTube or cloud storage URL
            </p>
          </Card>

          <Card className="p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#e5d6c7]/20 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">AI Processing</h3>
            <p className="text-sm text-muted-foreground">
              Our automation identifies the best moments and creates clips automatically
            </p>
          </Card>

          <Card className="p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#e5d6c7]/20 flex items-center justify-center">
              <Download className="h-6 w-6 text-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">Download Clips</h3>
            <p className="text-sm text-muted-foreground">
              Review and download your clips in multiple formats and sizes
            </p>
          </Card>
        </div>
      </main>

      <footer className="border-t border-border py-6 mt-16">
        <p className="text-center text-sm text-muted-foreground" data-testid="text-footer">
          Powered by Envisioned Automation
        </p>
      </footer>
    </div>
  );
}
