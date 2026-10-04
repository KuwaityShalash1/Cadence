import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/context";

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function DefaultErrorFallback({ onReset }: { onReset: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center bg-background px-4 py-12">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("errorPage.title", "This page didn't load")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "errorPage.desc",
            "Something went wrong on our end. You can try refreshing or head back home.",
          )}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={onReset}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t("errorPage.tryAgain", "Try again")}
          </Button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("errorPage.goHome", "Go home")}
          </a>
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public reset = () => {
    this.setState({ hasError: false, error: null });
  };

  public override render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.state.error!, this.reset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <DefaultErrorFallback onReset={this.reset} />;
    }

    return this.props.children;
  }
}
