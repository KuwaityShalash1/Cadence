import { FormEvent, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";

import { useAuth } from "@/auth/auth-context";
import { useTranslation } from "@/i18n";
import { CadenceLogo } from "@/components/ui/CadenceLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup";

export function AuthPage() {
  const { t } = useTranslation();
  const { isConfigured, isLoading, session, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        window.location.hash.includes("access_token") &&
        window.location.hash.includes("refresh_token")
      );
    }
    return false;
  });

  // 1. Explicitly check window.location.hash on mount for OAuth tokens
  useEffect(() => {
    const handleOAuthHash = async () => {
      if (typeof window === "undefined" || !window.location.hash) {
        return;
      }

      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.substring(1)
        : window.location.hash;

      // 2. If window.location.hash contains access_token and refresh_token, parse them out manually
      if (hash.includes("access_token") && hash.includes("refresh_token")) {
        setIsAuthenticating(true);
        const params = new URLSearchParams(hash);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");

        if (access_token && refresh_token) {
          try {
            // 3. Call supabase.auth.setSession({ access_token, refresh_token }) with the parsed values
            const { data, error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            // 4. Upon successful manual session creation, force a redirect to the main dashboard (/)
            if (!sessionError && data.session) {
              window.history.replaceState(null, "", window.location.pathname);
              window.location.replace("/");
              return;
            }

            if (sessionError) {
              console.error("Failed to establish session from URL hash:", sessionError);
              setError(sessionError.message);
              setIsAuthenticating(false);
            }
          } catch (err) {
            console.error("Error setting session from URL hash:", err);
            setIsAuthenticating(false);
          }
        } else {
          setIsAuthenticating(false);
        }
      }
    };

    void handleOAuthHash();
  }, []);

  // Redirect to main dashboard if session is already active in context
  useEffect(() => {
    if (session) {
      window.location.replace("/");
    }
  }, [session]);

  // Fallback: listen to auth state changes for session confirmation
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (currentSession && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        window.location.replace("/");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
      setMessage(
        t("auth.accountCreated", "Account created. Check your email if confirmation is required."),
      );
    } else {
      setMessage(t("auth.signedInRedirecting", "You are signed in. Redirecting..."));
      window.location.replace("/");
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

  if ((isLoading || isAuthenticating) && !error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2
            className="h-8 w-8 animate-spin text-primary"
            aria-label={t("common.loading", "Loading")}
          />
          <p className="text-sm text-muted-foreground">
            {t("auth.authenticating", "Authenticating...")}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-5 text-center">
          <Link
            to="/"
            className="mx-auto inline-flex"
            aria-label={t("auth.returnToCadence", "Return to Cadence")}
          >
            <CadenceLogo showText />
          </Link>
          <div>
            <CardTitle className="text-2xl">
              {mode === "login"
                ? t("auth.welcomeBack", "Welcome back")
                : t("auth.createYourAccount", "Create your account")}
            </CardTitle>
            <CardDescription className="mt-2">
              {mode === "login"
                ? t("auth.signInDescription", "Sign in to prepare Cadence for cloud sync.")
                : t(
                    "auth.signUpDescription",
                    "Create an account to enable cloud sync when it arrives.",
                  )}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!isConfigured && (
            <div className="mb-5 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
              {t(
                "auth.notConfigured",
                "Cloud authentication is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.",
              )}
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
            {t("auth.continueWithGoogle", "Continue with Google")}
          </Button>
          <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>{t("auth.or", "Or")}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auth-email">{t("auth.email", "Email")}</Label>
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
              <Label htmlFor="auth-password">{t("auth.password", "Password")}</Label>
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
              {mode === "login"
                ? t("auth.signIn", "Sign in")
                : t("auth.createAccount", "Create account")}
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
              {mode === "login"
                ? t("auth.needAccount", "Need an account?")
                : t("auth.alreadyHaveAccount", "Already have an account?")}
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              {t("auth.offlineApp", "Offline app")}
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <Link
          to="/privacy"
          className="transition-colors hover:text-foreground underline-offset-4 hover:underline"
        >
          {t("legal.privacyPolicy", "Privacy Policy")}
        </Link>
        <span>•</span>
        <Link
          to="/terms"
          className="transition-colors hover:text-foreground underline-offset-4 hover:underline"
        >
          {t("legal.termsOfService", "Terms of Service")}
        </Link>
      </div>
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
