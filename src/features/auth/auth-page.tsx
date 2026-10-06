import { FormEvent, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Cloud, Loader2 } from "lucide-react";

import { useAuth } from "@/auth/auth-context";
import { CadenceLogo } from "@/components/ui/CadenceLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthMode = "login" | "signup";

export function AuthPage() {
  const { isConfigured, isLoading, session, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    const result = mode === "login" ? await signIn(email, password) : await signUp(email, password);

    setIsSubmitting(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (mode === "signup") {
      setMessage("Account created. Check your email if confirmation is required.");
    } else {
      setMessage("You are signed in. Cloud sync is ready for the next phase.");
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading" />
      </main>
    );
  }

  if (session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Cloud className="mx-auto h-10 w-10 text-primary" />
            <CardTitle className="mt-2 text-2xl">Cloud sync enabled</CardTitle>
            <CardDescription>{session.user.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              Your local app remains available offline. Syncing local data will be added in the next
              phase.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="flex-1">
                <Link to="/">Return to Cadence</Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void signOut();
                }}
              >
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-5 text-center">
          <Link to="/" className="mx-auto inline-flex" aria-label="Return to Cadence">
            <CadenceLogo showText />
          </Link>
          <div>
            <CardTitle className="text-2xl">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </CardTitle>
            <CardDescription className="mt-2">
              {mode === "login"
                ? "Sign in to prepare Cadence for cloud sync."
                : "Create an account to enable cloud sync when it arrives."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!isConfigured && (
            <div className="mb-5 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
              Cloud authentication is not configured yet. Add VITE_SUPABASE_URL and
              VITE_SUPABASE_ANON_KEY to your environment.
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">Password</Label>
              <Input
                id="auth-password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={6}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && <p className="text-sm text-success">{message}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting || !isConfigured}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <div className="mt-5 flex items-center justify-between text-sm">
            <button
              type="button"
              className="text-primary underline-offset-4 hover:underline"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
                setMessage(null);
              }}
            >
              {mode === "login" ? "Need an account?" : "Already have an account?"}
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Offline app
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
