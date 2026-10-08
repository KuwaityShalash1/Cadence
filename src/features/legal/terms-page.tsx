import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  Scale,
  ShieldAlert,
} from "lucide-react";

import { CadenceLogo } from "@/components/ui/CadenceLogo";
import { useTranslation } from "@/i18n";

export function TermsPage() {
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
              to="/privacy"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
            >
              {t("legal.privacyPolicy", "Privacy Policy")}
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
            <Scale className="h-3.5 w-3.5" />
            <span>Cadence Terms & Conditions</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {t("legal.termsOfService", "Terms of Service")}
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {t("legal.lastUpdated", "Last updated")}: October 8, 2026 •{" "}
            {t("legal.effectiveDate", "Effective Date")}: October 8, 2026
          </p>
        </div>

        {/* Essential Notice Card */}
        <div className="mb-10 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 className="mb-2 text-base font-bold text-foreground sm:text-lg flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Summary of Key Terms
          </h2>
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Please read these Terms carefully before using Cadence. By using this service, you
            acknowledge that:
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 text-xs sm:text-sm">
            <div className="flex items-start gap-2 text-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <strong>Provided "AS IS":</strong> The service is provided without warranties of any
                kind.
              </span>
            </div>
            <div className="flex items-start gap-2 text-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <strong>No Liability for Data Loss:</strong> We are not liable for lost streaks or
                data.
              </span>
            </div>
            <div className="flex items-start gap-2 text-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <strong>Account Security:</strong> You are responsible for securing your Google
                account.
              </span>
            </div>
            <div className="flex items-start gap-2 text-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <strong>Manual Backups Advised:</strong> Regularly export JSON backups from
                Settings.
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Terms Sections */}
        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {/* 1. Acceptance of Terms */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              1. Acceptance of Terms
            </h2>
            <p>
              These Terms of Service ("Terms") constitute a legally binding agreement between you
              ("User", "you", or "your") and indie developer Mohamed Shalash ("Developer", "we",
              "us", or "our"), governing your access to and use of the Cadence web application
              ("Cadence", "Application", or "Service") accessible at{" "}
              <a
                href="https://cadencepwa.vercel.app"
                className="text-primary underline hover:text-primary/80"
              >
                https://cadencepwa.vercel.app
              </a>
              .
            </p>
            <p>
              By accessing, browsing, installing as a PWA, registering for, or using Cadence, you
              acknowledge that you have read, understood, and agreed to be bound by these Terms and
              our{" "}
              <Link to="/privacy" className="text-primary underline hover:text-primary/80">
                Privacy Policy
              </Link>
              . If you do not agree to these Terms, you must immediately cease all use of the
              Application.
            </p>
          </section>

          {/* 2. Nature of the Application */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              2. Nature of the Service & Indie Project Disclaimer
            </h2>
            <p>
              Cadence is an independent, client-first habit tracking and personal productivity web
              tool designed to help individuals cultivate habits and routines. It is developed and
              maintained as an independent project.
            </p>
            <p>
              Cadence is not a medical, health, clinical, psychiatric, or professional advisory
              service. Habit recommendations, quit-tracker analytics, and timers are provided solely
              for personal organizational convenience.
            </p>
          </section>

          {/* 3. User Accounts & Google Authentication */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              3. User Accounts & Google Authentication Security
            </h2>
            <p>
              You may use Cadence locally without creating an account. If you choose to enable cloud
              synchronization, you may authenticate via Google OAuth or email/password:
            </p>
            <ul className="list-disc ps-5 space-y-2">
              <li>
                <strong>User Conduct & Security:</strong> You are solely responsible for maintaining
                the confidentiality and security of your Google account, email credentials,
                passwords, and devices. You agree to accept responsibility for all activities that
                occur under your account.
              </li>
              <li>
                <strong>Unauthorized Access:</strong> You agree to immediately notify the Developer
                of any unauthorized use of your account or any other breach of security. The
                Developer will not be liable for any loss or damage arising from your failure to
                safeguard your authentication credentials.
              </li>
              <li>
                <strong>Accuracy:</strong> You agree to provide accurate and current information
                when creating an account.
              </li>
            </ul>
          </section>

          {/* 4. Acceptable Use */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              4. Acceptable Use Policy
            </h2>
            <p>
              You agree that you will not use Cadence for any unlawful purpose or in any manner that
              could damage, disable, overburden, or impair the Service. Specifically, you agree not
              to:
            </p>
            <ul className="list-disc ps-5 space-y-1.5">
              <li>
                Attempt to gain unauthorized access to our cloud database, server infrastructure, or
                third-party provider accounts;
              </li>
              <li>
                Deploy automated scripts, bots, spiders, or crawlers that generate unreasonable
                request loads against our sync endpoints;
              </li>
              <li>
                Circumvent, disable, or tamper with security-related features, authentication
                protocols, or Row-Level Security barriers;
              </li>
              <li>
                Use the Service to transmit malware, viruses, malicious code, or unsolicited
                communications.
              </li>
            </ul>
          </section>

          {/* 5. Disclaimer of Warranties (Critical Developer Protection) */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              5. Disclaimer of Warranties
            </h2>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3 text-xs sm:text-sm">
              <p className="font-bold uppercase tracking-wide text-foreground">
                PLEASE READ THIS SECTION CAREFULLY. IT LIMITS THE LEGAL LIABILITY OF THE DEVELOPER.
              </p>
              <p className="leading-relaxed text-foreground/90 font-mono text-[11px] sm:text-xs uppercase">
                THE APPLICATION AND ALL ASSOCIATED SERVICES ARE PROVIDED STRICTLY ON AN &quot;AS
                IS&quot; AND &quot;AS AVAILABLE&quot; BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER
                EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE.
              </p>
              <p className="leading-relaxed text-foreground/90 font-mono text-[11px] sm:text-xs uppercase">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE DEVELOPER EXPRESSLY DISCLAIMS
                ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES
                OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, ACCURACY, QUIET
                ENJOYMENT, AND NON-INFRINGEMENT.
              </p>
              <p className="leading-relaxed text-foreground/90">
                WITHOUT LIMITING THE FOREGOING, WE DO NOT WARRANT THAT: (A) THE SERVICE WILL MEET
                YOUR SPECIFIC REQUIREMENTS; (B) THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE,
                ACCURATE, OR ERROR-FREE; (C) STORED HABIT RECORDS, STREAKS, NOTES, OR TIMERS WILL
                REMAIN UNCORRUPTED OR PERMANENTLY RETRIEVABLE; OR (D) ANY DEFECTS OR ERRORS WILL BE
                CORRECTED.
              </p>
            </div>
          </section>

          {/* 6. Limitation of Liability (Critical Developer Protection) */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              6. Limitation of Liability
            </h2>
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-3 text-xs sm:text-sm">
              <p className="font-bold uppercase tracking-wide text-foreground">
                IMPORTANT LIMITATION ON DAMAGES AND DATA LOSS
              </p>
              <p className="leading-relaxed text-foreground/90 font-mono text-[11px] sm:text-xs uppercase">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE DEVELOPER,
                MAINTAINERS, CONTRIBUTORS, OR AFFILIATES BE LIABLE FOR ANY DIRECT, INDIRECT,
                INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES WHATSOEVER,
                INCLUDING WITHOUT LIMITATION:
              </p>
              <ul className="list-disc ps-5 space-y-1.5 text-foreground/90">
                <li>
                  <strong>LOSS OF DATA OR HABIT STREAKS:</strong> Any loss, erasure, or corruption
                  of habit logs, streak records, goals, routines, or quit-tracker metrics, whether
                  caused by client browser storage eviction, cache clearing, IndexedDB migration
                  errors, device failure, or network anomalies.
                </li>
                <li>
                  <strong>SERVICE INTERRUPTIONS:</strong> Server downtime, cloud sync latency,
                  hosting outages, or discontinuance of service.
                </li>
                <li>
                  <strong>HARDWARE & BROWSER ISSUES:</strong> Damage to, or malfunction of, your
                  computer, mobile device, browser software, or operating system.
                </li>
                <li>
                  <strong>INTANGIBLE LOSSES:</strong> Any loss of profits, productivity, emotional
                  distress, goodwill, or substitute goods or services.
                </li>
              </ul>
              <p className="leading-relaxed text-foreground/90 pt-1">
                <strong>USER RESPONSIBILITY FOR BACKUPS:</strong> Because Cadence operates with a
                client-side architecture,{" "}
                <em>you are solely responsible for creating regular manual backups of your data</em>{" "}
                using the built-in export tool located at{" "}
                <em>Settings &rarr; Data &rarr; Export data</em>.
              </p>
              <p className="leading-relaxed text-foreground/90 font-mono text-[11px] sm:text-xs uppercase pt-1">
                IN JURISDICTIONS THAT DO NOT PERMIT THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES,
                OUR AGGREGATE LIABILITY SHALL IN NO EVENT EXCEED THE AMOUNT PAID BY YOU (IF ANY) TO
                USE CADENCE IN THE PRECEDING TWELVE (12) MONTHS, OR TEN UNITED STATES DOLLARS
                ($10.00 USD), WHICHEVER IS LESS.
              </p>
            </div>
          </section>

          {/* 7. Intellectual Property */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              7. Intellectual Property Rights
            </h2>
            <p>
              The Cadence name, branding, visual styling, logo marks, icons, custom illustrations,
              UI components, and software architecture are the intellectual property of Mohamed
              Shalash and are protected under copyright and trademark laws.
            </p>
            <p>
              Open-source libraries and frameworks incorporated within Cadence are used in
              accordance with their respective open-source licenses (MIT, Apache 2.0, BSD, etc.).
            </p>
          </section>

          {/* 8. Account Termination & Service Discontinuation */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              8. Account Termination & Discontinuation
            </h2>
            <p>
              You may stop using Cadence at any time. You can delete your cloud account and all
              synchronized records via <em>Settings &rarr; Account &rarr; Delete Account</em>, and
              clear your browser's local IndexedDB data via{" "}
              <em>Settings &rarr; Data &rarr; Clear all data</em>.
            </p>
            <p>
              The Developer reserves the right to suspend or terminate accounts, restrict access, or
              modify/discontinue the Service or any of its features at any time, with or without
              prior notice, without liability to you.
            </p>
          </section>

          {/* 9. Modifications to Terms */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              9. Modifications to These Terms
            </h2>
            <p>
              We reserve the right to revise or update these Terms at our sole discretion. Any
              changes will become effective immediately upon posting the updated Terms on this page
              with a revised "Last updated" date.
            </p>
            <p>
              Your continued access or use of Cadence following the publication of any modifications
              signifies your irrevocable acceptance of the revised Terms.
            </p>
          </section>

          {/* 10. Governing Law */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              10. Governing Law & Severability
            </h2>
            <p>
              These Terms shall be interpreted and governed in accordance with applicable laws,
              without regard to conflicts of law provisions. If any provision of these Terms is
              found to be invalid or unenforceable by a court of competent jurisdiction, the
              remaining provisions will continue in full force and effect.
            </p>
          </section>

          {/* 11. Contact Information */}
          <section className="space-y-3 rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-bold text-foreground">11. Contact Information</h2>
            <p className="text-xs sm:text-sm">
              If you have any questions or concerns regarding these Terms of Service, please contact
              the developer:
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
                <strong>GitHub:</strong>{" "}
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
            <Link
              to="/privacy"
              className="hover:text-foreground underline-offset-4 hover:underline"
            >
              {t("legal.privacyPolicy", "Privacy Policy")}
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
