import React from "react";
import { cn } from "@/lib/utils";

interface CadenceLogoProps extends React.HTMLAttributes<HTMLElement> {
  className?: string;
  size?: number | string;
  showText?: boolean;
  iconClassName?: string | undefined;
  textClassName?: string | undefined;
}

export function CadenceLogo({
  className,
  size,
  showText = true,
  iconClassName,
  textClassName,
  ...props
}: CadenceLogoProps) {
  const svgContent = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0 h-8 w-8", iconClassName, !showText ? className : undefined)}
      width={size}
      height={size}
      /**
       * The wordmark "Cadence" is always rendered next to the glyph (or the
       * glyph sits inside a link that carries its own `aria-label`), so the
       * mark itself is purely decorative: hide it from assistive tech and take
       * it out of the tab order.
       */
      aria-hidden="true"
      focusable="false"
      {...(!showText ? (props as React.SVGProps<SVGSVGElement>) : undefined)}
    >
      <rect
        width="32"
        height="32"
        rx="8"
        className="fill-indigo-50 dark:fill-slate-900/90 text-indigo-600 dark:text-cyan-400"
      />
      <path
        d="M5 16h4l2.5-6 4.5 12 3-8h7"
        className="text-indigo-400/70 dark:text-cyan-200/60"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 16h4l2.5-6 4.5 12 3-8h7"
        className="text-indigo-600 dark:text-cyan-400"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (!showText) {
    return svgContent;
  }

  return (
    <div className={cn("flex items-center gap-2.5 min-w-0", className)} {...props}>
      {svgContent}
      <span
        className={cn(
          "font-semibold text-lg tracking-tight truncate text-slate-900 dark:text-slate-100",
          textClassName,
        )}
      >
        Cadence
      </span>
    </div>
  );
}
