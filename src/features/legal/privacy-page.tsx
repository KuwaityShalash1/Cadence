import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  ExternalLink,
  Lock,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { CadenceLogo } from "@/components/ui/CadenceLogo";
import { useTranslation } from "@/i18n";

export function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
      {/* ── Top Navigation Header ── */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
            aria-label="Cadence Home"
          >
            <CadenceLogo size={28} showText={true} />
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/terms"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
            >
              {t("legal.termsOfService", "Terms of Service")}
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground sm:text-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              <span>{t("legal.backToApp", "Back to Cadence")}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Document Header */}
        <div className="mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Cadence Legal & Trust</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {t("legal.privacyPolicy", "Privacy Policy")}
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {t("legal.lastUpdated", "Last updated")}: October 8, 2026 •{" "}
            {t("legal.effectiveDate", "Effective Date")}: October 8, 2026
          </p>
        </div>

        {/* Executive Summary Card */}
        <div className="mb-10 rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-sm sm:p-6">
          <h2 className="mb-2 text-base font-bold text-foreground sm:text-lg">
            Our Core Privacy Commitment
          </h2>
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Cadence is built by indie developer Mohamed Shalash on an{" "}
            <strong>offline-first, privacy-by-design</strong> principle. Your daily habits, streaks,
            and routines belong to you.
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 text-xs sm:text-sm">
            <div className="flex items-start gap-2 text-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <strong>Offline-First:</strong> All records stored locally in your browser's
                IndexedDB.
              </span>
            </div>
            <div className="flex items-start gap-2 text-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <strong>Zero Trackers:</strong> No ads, no analytics trackers, no data brokers.
              </span>
            </div>
            <div className="flex items-start gap-2 text-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <strong>We NEVER Sell Data:</strong> Your personal data is never monetized or
                shared.
              </span>
            </div>
            <div className="flex items-start gap-2 text-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <strong>Permanent Deletion:</strong> Wipe local data or delete cloud backups in one
                click.
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Legal Sections */}
        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {/* 1. Overview */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              1. Overview & Scope
            </h2>
            <p>
              This Privacy Policy explains how Cadence ("we", "us", "our", or "the Application"),
              developed by indie developer Mohamed Shalash, handles personal information when you
              access or use our web application located at{" "}
              <a
                href="https://cadencepwa.vercel.app"
                className="text-primary underline hover:text-primary/80"
              >
                https://cadencepwa.vercel.app
              </a>
              .
            </p>
            <p>
              Cadence is designed from the ground up as a client-first progressive web application
              (PWA). You can use the app completely anonymously without creating an account. If you
              choose to enable cloud backup and cross-device sync, we handle only the minimum
              essential data required to provide that synchronization service.
            </p>
          </section>

          {/* 2. Information We Collect via Google OAuth */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              2. Information We Collect & Google OAuth
            </h2>
            <p>We collect information in two limited contexts:</p>

            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Google OAuth Authentication
              </h3>
              <p className="text-xs sm:text-sm">
                When you click <strong>"Continue with Google"</strong>, we initiate an OAuth 2.0
                flow requesting standard profile scopes (
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
                  openid
                </code>
                ,{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
                  email
                </code>
                ,{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
                  profile
                </code>
                ). Through this flow, we receive:
              </p>
              <ul className="list-disc ps-5 space-y-1 text-xs sm:text-sm">
                <li>
                  <strong>Email Address:</strong> To establish your unique account identity and
                  permit authentication.
                </li>
                <li>
                  <strong>Full Name / Display Name:</strong> To personalize your in-app interface
                  and greeting.
                </li>
                <li>
                  <strong>Profile Picture URL:</strong> To display your user avatar within the
                  application navigation and settings.
                </li>
              </ul>
              <p className="text-xs sm:text-sm">
                <strong>Sole Purpose:</strong> We process this Google account information solely to
                authenticate your identity, create your user session, and associate your encrypted
                cloud backup records. We <em>never</em> request access to your Google Drive, Gmail,
                Google Contacts, Google Calendar, or any other sensitive Google APIs.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Habit & Productivity Data
              </h3>
              <p className="text-xs sm:text-sm">
                All habit names, categories, routine checklists, timer logs, completion records,
                streak milestones, and quit-tracker tallies are generated by you. By default, this
                data lives strictly on your device inside your browser's local IndexedDB storage.
              </p>
            </div>
          </section>

          {/* 3. Google API Services User Data Policy Compliance */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              3. Google API Services User Data Policy Compliance
            </h2>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2 text-xs sm:text-sm">
              <p className="font-medium text-foreground">
                Cadence strictly complies with the Google API Services User Data Policy:
              </p>
              <p className="italic text-foreground/90">
                "Cadence's use and transfer to any other app of information received from Google
                APIs will adhere to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary underline inline-flex items-center gap-0.5"
                >
                  Google API Services User Data Policy
                  <ExternalLink className="h-3 w-3 inline" />
                </a>
                , including the Limited Use requirements."
              </p>
              <ul className="list-disc ps-5 space-y-1 text-muted-foreground pt-1">
                <li>
                  We do not transfer Google user data to third parties, except as necessary to
                  provide or improve user-facing features.
                </li>
                <li>We do not use or transfer Google user data to serve targeted advertising.</li>
                <li>
                  We do not allow humans to read Google user data unless required for security,
                  legal obligations, or with your explicit consent for technical troubleshooting.
                </li>
              </ul>
            </div>
          </section>

          {/* 4. Data Storage & Architecture */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              4. Data Storage Architecture: Local First & Cloud Sync
            </h2>
            <p>
              Cadence operates under an <strong>Offline-First</strong> paradigm:
            </p>
            <ul className="list-disc ps-5 space-y-2">
              <li>
                <strong>Local IndexedDB Storage:</strong> When you use Cadence, all data is
                immediately written to a client-side IndexedDB database in your web browser. The app
                runs smoothly without an internet connection, and your data remains on your
                hardware.
              </li>
              <li>
                <strong>Cloud Backup via Supabase:</strong> If you choose to log in, Cadence
                securely synchronizes your habit data to a managed PostgreSQL database hosted by
                Supabase. Data in transit is protected by Transport Layer Security (TLS 1.3 /
                HTTPS).
              </li>
              <li>
                <strong>Row-Level Security (RLS):</strong> Our cloud database enforces strict
                PostgreSQL Row-Level Security policies. Every database operation requires an
                authenticated user token, guaranteeing that no user can view, query, or modify
                another user's synchronized habit records.
              </li>
            </ul>
          </section>

          {/* 5. Zero Third-Party Trackers & No Data Sales */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              5. Zero Third-Party Trackers & No Data Sales
            </h2>
            <p className="font-semibold text-foreground">
              We stand firmly against invasive surveillance, web trackers, and advertising
              telemetry:
            </p>
            <ul className="list-disc ps-5 space-y-1.5">
              <li>
                <strong>Zero Third-Party Trackers:</strong> We do not integrate Google Analytics,
                Google Tag Manager, Meta Pixel, Hotjar, or third-party marketing SDKs.
              </li>
              <li>
                <strong>No Advertisements:</strong> We do not display banner ads, video ads, or
                sponsored promotions.
              </li>
              <li>
                <strong>We NEVER Sell Your Data:</strong> We do not sell, rent, license, trade, or
                share your personal information or habit logs with data brokers, advertisers, or
                corporate entities.
              </li>
            </ul>
          </section>

          {/* 6. User Rights & Data Deletion */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              6. Your Rights & Permanent Account Deletion
            </h2>
            <p>
              You maintain total autonomy and ownership over your personal information at all times:
            </p>
            <ul className="list-disc ps-5 space-y-2">
              <li>
                <strong>Right to Export (Data Portability):</strong> You can export an unencrypted
                JSON backup of your habits, completion logs, routines, and goals at any time by
                navigating to <em>Settings &rarr; Data &rarr; Export data</em>.
              </li>
              <li>
                <strong>Right to Permanent Deletion:</strong> If you have created a cloud sync
                account, you can permanently delete your entire account and all cloud sync records
                at any time from <em>Settings &rarr; Account &rarr; Delete Account</em>. This
                executes an atomic deletion procedure on our Supabase backend that permanently
                purges your user identity and wipes all associated records from{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
                  cadence_sync_records
                </code>
                .
              </li>
              <li>
                <strong>Local Storage Purge:</strong> You can wipe all locally stored data from your
                device at any time using <em>Settings &rarr; Data &rarr; Clear all data</em> or by
                clearing your browser's storage cache.
              </li>
            </ul>
          </section>

          {/* 7. Security Measures */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              7. Security & Encryption
            </h2>
            <p>
              We implement industry-standard administrative, physical, and technical safeguards to
              protect your personal information:
            </p>
            <ul className="list-disc ps-5 space-y-1.5">
              <li>Encryption in transit using modern HTTPS / TLS 1.3 cryptographic protocols.</li>
              <li>
                OAuth 2.0 PKCE authentication standards and cryptographically signed JWT tokens.
              </li>
              <li>
                Strict PostgreSQL Row-Level Security ensuring user data isolation at the database
                layer.
              </li>
            </ul>
          </section>

          {/* 8. Children's Privacy */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              8. Children's Privacy
            </h2>
            <p>
              Cadence is not directed to individuals under the age of 13 (or under 16 in certain
              jurisdictions), and we do not knowingly collect personal information from children. If
              you become aware that a child has provided us with personal information, please
              contact us immediately, and we will delete the account and records promptly.
            </p>
          </section>

          {/* 9. Changes to Policy */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              9. Changes to This Privacy Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time to reflect improvements in our
              service or regulatory updates. Any modifications will be posted directly to this page
              with an updated "Last updated" date. We encourage you to review this policy
              periodically.
            </p>
          </section>

          {/* 10. Contact Information */}
          <section className="space-y-3 rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-bold text-foreground">
              10. Contact Information & Developer Details
            </h2>
            <p className="text-xs sm:text-sm">
              If you have any questions, feedback, or requests regarding this Privacy Policy or your
              personal data, please contact the developer directly:
            </p>
            <div className="space-y-1 text-xs sm:text-sm text-foreground">
              <p>
                <strong>Developer:</strong> Mohamed Shalash
              </p>
              <p>
                <strong>Email:</strong>{" "}
                <a
                  href="mailto:kuwaitishalash@gmail.com"
                  className="text-primary underline hover:text-primary/80"
                >
                  kuwaitishalash@gmail.com
                </a>
              </p>
              <p>
                <strong>Project Repository:</strong>{" "}
                <a
                  href="https://github.com/KuwaityShalash1/Cadence"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:text-primary/80 inline-flex items-center gap-1"
                >
                  GitHub / Cadence
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
          </section>
        </div>

        {/* Footer Navigation */}
        <footer className="mt-14 border-t border-border pt-8 text-center">
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground sm:text-sm">
            <Link to="/terms" className="hover:text-foreground underline-offset-4 hover:underline">
              {t("legal.termsOfService", "Terms of Service")}
            </Link>
            <span>•</span>
            <Link
              to="/about-us"
              className="hover:text-foreground underline-offset-4 hover:underline"
            >
              About Cadence
            </Link>
            <span>•</span>
            <Link to="/" className="hover:text-foreground underline-offset-4 hover:underline">
              {t("legal.backToApp", "Back to Cadence")}
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} Cadence Habit Tracker. All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  );
}
