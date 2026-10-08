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
  const iconSize = typeof size === "number" ? size : undefined;

  const logoImg = (
    <img
      src="/logo.svg"
      alt="Cadence logo"
      /**
       * The wordmark "Cadence" is always rendered next to the logo (or the
       * logo sits inside a link that carries its own `aria-label`), so the
       * mark itself is purely decorative: hide it from assistive tech.
       */
      aria-hidden="true"
      draggable={false}
      width={iconSize ?? 32}
      height={iconSize ?? 32}
      style={{ maxWidth: iconSize ?? 32, maxHeight: iconSize ?? 32 }}
      className={cn(
        "shrink-0 h-8 w-8 object-contain",
        iconClassName,
        !showText ? className : undefined,
      )}
      {...(!showText ? (props as React.ImgHTMLAttributes<HTMLImageElement>) : undefined)}
    />
  );

  if (!showText) {
    return logoImg;
  }

  return (
    <div className={cn("flex items-center gap-2.5 min-w-0", className)} {...props}>
      {logoImg}
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
