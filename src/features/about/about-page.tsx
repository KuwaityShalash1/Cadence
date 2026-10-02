import { Link } from "@tanstack/react-router";

/**
 * Easter egg "About Us" page — completely hidden from the UI.
 * Only reachable by manually navigating to /about-us.
 * No links to this page exist anywhere in the navbar, sidebar, or app shell.
 */
export function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 text-center">
      {/* ── Glowing backdrop pill ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      >
        <div className="h-[480px] w-[480px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex max-w-lg flex-col items-center gap-6">
        {/* ── Main title ── */}
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          🕵️‍♂️ You found the secret page!
        </h1>

        {/* ── Subtitle ── */}
        <p className="text-base text-muted-foreground sm:text-lg">
          Ah, a fellow developer. Welcome to the backstage of Cadence.
        </p>

        {/* ── Divider ── */}
        <div className="h-px w-16 bg-border" />

        {/* ── Maker's note ── */}
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          I'm{" "}
          <span className="font-semibold text-foreground">Mohamed Shalash</span>
          , a solo developer who got tired of bloated, subscription-based habit
          trackers. I built Cadence to be completely offline-first, ridiculously
          fast, and 100% private. Your data lives strictly in your browser's
          IndexedDB.{" "}
          <span className="font-semibold text-foreground">
            Zero tracking, zero cookies.
          </span>
        </p>

        {/* ── Geek links ── */}
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/KuwaityShalash1/Cadence"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {/* GitHub icon */}
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
            </svg>
            GitHub
          </a>

          <a
            href="https://www.producthunt.com/products/cadence-habit-tracker"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View on Product Hunt"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {/* Product Hunt logo mark */}
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M13.604 8.4h-3.405V12h3.405a1.8 1.8 0 0 0 0-3.6M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0m1.604 14.4H10.2V18H7.8V6h5.804a4.2 4.2 0 0 1 0 8.4" />
            </svg>
            Product Hunt
          </a>
        </div>

        {/* ── Escape hatch ── */}
        <Link
          to="/"
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          ⬅️ Return to Dashboard
        </Link>
      </div>

      {/* ── Footer text ── */}
      <p className="relative z-10 mt-16 text-xs text-muted-foreground/60">
        Built with React, Vite, Tailwind, and a lot of ☕
      </p>
    </div>
  );
}
