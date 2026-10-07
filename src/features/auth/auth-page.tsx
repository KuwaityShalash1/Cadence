import { FormEvent, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Cloud, Loader2 } from "lucide-react";

import { useAuth } from "@/auth/auth-context";
import { CadenceLogo } from "@/components/ui/CadenceLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup";

export function AuthPage() {
  const { isConfigured, isLoading, session, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

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

  const handleGoogleSignIn = async () => {
    setError(null);
    setMessage(null);
    setIsGoogleSubmitting(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    });
    setIsGoogleSubmitting(false);
    if (oauthError) {
      setError(oauthError.message);
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
          <Button
            type="button"
            variant="outline"
            className="w-full bg-background"
            disabled={isGoogleSubmitting || isSubmitting || !isConfigured}
            onClick={() => {
              void handleGoogleSignIn();
            }}
          >
            {isGoogleSubmitting ? <Loader2 className="animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </Button>
          <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>Or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z"
      />
      <path
        fill="#34A853"
        d="M12 21.67c2.63 0 4.84-.87 6.45-2.37l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.55 0-4.71-1.72-5.49-4.04H3.27v2.53A9.74 9.74 0 0 0 12 21.67Z"
      />
      <path
        fill="#FBBC05"
        d="M6.51 13.73A5.85 5.85 0 0 1 6.2 12c0-.6.11-1.18.31-1.73V7.74H3.27A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.06 1.02 4.26l3.24-2.53Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.23c1.43 0 2.72.49 3.74 1.46l2.8-2.8C16.84 3.3 14.63 2.33 12 2.33a9.74 9.74 0 0 0-8.73 5.41l3.24 2.53c.78-2.32 2.94-4.04 5.49-4.04Z"
      />
    </svg>
  );
}
