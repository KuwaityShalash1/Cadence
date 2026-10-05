import { cn } from "@/lib/utils";

interface LanguageFlagProps {
  code: string;
  className?: string;
}

/**
 * Renders vector SVG flags for supported languages.
 * Avoids unicode emoji flags (🇺🇸, 🇸🇦) which render as raw letters
 * (e.g. "us", "SA") on Windows Segoe UI Emoji.
 */
export function LanguageFlag({ code, className }: LanguageFlagProps) {
  if (code === "en") {
    return (
      <svg
        viewBox="0 0 640 480"
        className={cn(
          "inline-block h-3.5 w-5 rounded-[2px] object-cover shadow-xs border border-border/50 shrink-0",
          className,
        )}
        aria-hidden="true"
      >
        <g fillRule="evenodd">
          {/* 13 alternating stripes */}
          <path fill="#bd3d44" d="M0 0h640v480H0z" />
          <path
            stroke="#fff"
            strokeWidth="37"
            d="M0 55.5h640M0 129.5h640M0 203.5h640M0 277.5h640M0 351.5h640M0 425.5h640"
          />
          {/* Blue canton */}
          <path fill="#192f5d" d="M0 0h285v259H0z" />
          {/* Star grid */}
          <g fill="#fff">
            <circle cx="28" cy="24" r="6" />
            <circle cx="76" cy="24" r="6" />
            <circle cx="124" cy="24" r="6" />
            <circle cx="172" cy="24" r="6" />
            <circle cx="220" cy="24" r="6" />
            <circle cx="268" cy="24" r="6" />

            <circle cx="52" cy="53" r="6" />
            <circle cx="100" cy="53" r="6" />
            <circle cx="148" cy="53" r="6" />
            <circle cx="196" cy="53" r="6" />
            <circle cx="244" cy="53" r="6" />

            <circle cx="28" cy="82" r="6" />
            <circle cx="76" cy="82" r="6" />
            <circle cx="124" cy="82" r="6" />
            <circle cx="172" cy="82" r="6" />
            <circle cx="220" cy="82" r="6" />
            <circle cx="268" cy="82" r="6" />

            <circle cx="52" cy="111" r="6" />
            <circle cx="100" cy="111" r="6" />
            <circle cx="148" cy="111" r="6" />
            <circle cx="196" cy="111" r="6" />
            <circle cx="244" cy="111" r="6" />

            <circle cx="28" cy="140" r="6" />
            <circle cx="76" cy="140" r="6" />
            <circle cx="124" cy="140" r="6" />
            <circle cx="172" cy="140" r="6" />
            <circle cx="220" cy="140" r="6" />
            <circle cx="268" cy="140" r="6" />

            <circle cx="52" cy="169" r="6" />
            <circle cx="100" cy="169" r="6" />
            <circle cx="148" cy="169" r="6" />
            <circle cx="196" cy="169" r="6" />
            <circle cx="244" cy="169" r="6" />

            <circle cx="28" cy="198" r="6" />
            <circle cx="76" cy="198" r="6" />
            <circle cx="124" cy="198" r="6" />
            <circle cx="172" cy="198" r="6" />
            <circle cx="220" cy="198" r="6" />
            <circle cx="268" cy="198" r="6" />

            <circle cx="52" cy="227" r="6" />
            <circle cx="100" cy="227" r="6" />
            <circle cx="148" cy="227" r="6" />
            <circle cx="196" cy="227" r="6" />
            <circle cx="244" cy="227" r="6" />
          </g>
        </g>
      </svg>
    );
  }

  if (code === "ar") {
    return (
      <svg
        viewBox="0 0 640 480"
        className={cn(
          "inline-block h-3.5 w-5 rounded-[2px] object-cover shadow-xs border border-border/50 shrink-0",
          className,
        )}
        aria-hidden="true"
      >
        <rect width="640" height="480" fill="#006c35" />
        <g fill="#fff">
          {/* Stylized Arabic script motif */}
          <path
            d="M160 215c25-10 75-15 160-15s135 5 160 15c-15 8-45 14-85 14h-150c-40 0-70-6-85-14z"
            opacity="0.95"
          />
          <path
            d="M200 180c15-20 60-26 120-26s105 6 120 26c-20 6-55 10-100 10s-80-4-100-10z"
            opacity="0.9"
          />
          <circle cx="245" cy="140" r="8" />
          <circle cx="280" cy="135" r="8" />
          <circle cx="360" cy="135" r="8" />
          <circle cx="395" cy="140" r="8" />
          {/* Sword motif */}
          <path d="M190 270h260v6c0 3-4 5-8 5H215l-25 15v-20l-12-6v-4l12-3z" />
          <rect x="445" y="264" width="8" height="18" rx="2" />
        </g>
      </svg>
    );
  }

  return null;
}
