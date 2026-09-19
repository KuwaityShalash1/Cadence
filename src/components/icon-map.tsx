import {
  Activity,
  Apple,
  Book,
  BookOpen,
  Brain,
  Briefcase,
  CalendarCheck,
  Clock,
  Code2,
  Coffee,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Globe,
  Hand,
  Heart,
  HeartPulse,
  Languages,
  Leaf,
  Moon,
  Music,
  NotebookPen,
  PenTool,
  PhoneOff,
  Pizza,
  Pill,
  RefreshCw,
  Sparkles,
  Sun,
  Target,
  Timer,
  Tv,
  Wallet,
  ShieldAlert,
  Ban,
  Smartphone,
  Utensils,
  Lock,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { CustomIcon } from "@/types";

export const ICONS: Record<string, LucideIcon> = {
  Activity,
  Apple,
  Book,
  BookOpen,
  Brain,
  Briefcase,
  CalendarCheck,
  Clock,
  Code2,
  Coffee,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Globe,
  Hand,
  Heart,
  HeartPulse,
  Languages,
  Leaf,
  Moon,
  Music,
  NotebookPen,
  PenTool,
  PhoneOff,
  Pizza,
  Pill,
  RefreshCw,
  Sparkles,
  Sun,
  Target,
  Timer,
  Tv,
  Wallet,
  ShieldAlert,
  Ban,
  Smartphone,
  Utensils,
  Lock,
};

export const ICON_NAMES = Object.keys(ICONS);

/** Suggestion-chip shorthand names mapped onto canonical `ICONS` keys. */
const ICON_ALIASES: Record<string, string> = {
  book: "BookOpen",
};

/**
 * Normalises a friendly icon name to the canonical key used by the `ICONS`
 * map, so the "Quick Suggestions" data can ship kebab-case names ("sun",
 * "refresh-cw", "pizza") while pickers, previews and saved records all keep
 * working with the canonical PascalCase keys. Unknown names pass through
 * unchanged — they may be custom icon ids.
 */
export function resolveIconName(name: string): string {
  if (!name || name in ICONS) return name;
  const aliased = ICON_ALIASES[name];
  if (aliased) return aliased;
  const pascal = name.replace(/(^|-)([a-z0-9])/g, (_match, _separator: string, ch: string) =>
    ch.toUpperCase(),
  );
  return pascal in ICONS ? pascal : name;
}

/**
 * Resolves a user-uploaded custom icon by id.
 *
 * Custom icons live in a separate global list (not in the `ICONS` map), so
 * every render path MUST check this first — otherwise a saved custom icon id
 * misses the Lucide lookup and silently falls back to the default `Target`.
 */
export function findCustomIcon(
  customIcons: CustomIcon[] | undefined,
  id: string | undefined,
): CustomIcon | undefined {
  if (!customIcons || !id) return undefined;
  return customIcons.find((icon) => icon.id === id);
}

/**
 * A paint value that is a *reference or keyword* rather than a hardcoded
 * colour, so it must survive the `currentColor` rewrite:
 *
 *  - `none`          — stroke-only artwork depends on `fill="none"`.
 *  - `url(#id)`      — a paint server (`<linearGradient>`, `<pattern>`, …).
 *                      Flattening this to `currentColor` would silently destroy
 *                      a gradient-filled icon and render it as one flat shape.
 *  - `inherit` / `transparent` / `context-fill` / `context-stroke` — keywords
 *                      that already defer to something else, never a literal.
 */
const NON_COLOUR_PAINT = "(?:none|url\\([^)]*\\)|inherit|transparent|context-(?:fill|stroke))";

/** `fill="…"` / `stroke='…'` with a quoted value. */
const PAINT_ATTR_QUOTED = new RegExp(
  `\\s(fill|stroke)\\s*=\\s*(["'])(?!(?:${NON_COLOUR_PAINT})\\2)[^"']*\\2`,
  "gi",
);

/** `fill=#000` — untouched by the quoted pattern, but still applies once parsed. */
const PAINT_ATTR_BARE = new RegExp(
  `\\s(fill|stroke)\\s*=\\s*(?![="'\`])(?!(?:${NON_COLOUR_PAINT})\\b)[^\\s"'>]+`,
  "gi",
);

/** `fill:#000` / `stroke: red` inside `style="…"` or a `<style>` block. */
const PAINT_CSS_DECL = new RegExp(
  `(?<![\\w-])(fill|stroke)\\s*:\\s*(?!(?:${NON_COLOUR_PAINT}))([^;}]*)`,
  "gi",
);

/**
 * Rewrites `fill` / `stroke` CSS declarations to `currentColor` so the artwork
 * follows the React `color` property instead of a baked-in colour.
 *
 * Shared by inline `style="…"` attributes and `<style>` blocks, which are the
 * two places a hardcoded colour can hide. References and keywords listed in
 * {@link NON_COLOUR_PAINT} are preserved, `stroke-width` / `fill-rule` are
 * untouched because a `:` must immediately follow the property name, and a
 * lookbehind keeps prefixed properties like `-webkit-text-fill-color` out.
 */
function inheritCssDeclarations(css: string): string {
  return css.replace(
    PAINT_CSS_DECL,
    (_match, property: string, value: string) =>
      `${property}:currentColor${/!\s*important/i.test(value) ? " !important" : ""}`,
  );
}

/**
 * Normalises an uploaded / pasted SVG so it fills its wrapper AND inherits the
 * habit's colour, instead of painting itself a hardcoded colour.
 *
 * Uploaded `.svg` FILES differ from pasted snippets: a file is a full XML
 * document (prolog + DOCTYPE + generator comments) and commonly ships
 * `width="512px" height="512px"` with **no `viewBox`**. Forcing `width="100%"`
 * on such a file makes the browser draw the artwork at its intrinsic 512-unit
 * scale inside a ~20px box, so only a corner shows — a solid opaque block that
 * hides the icon's tinted background wrapper. Pasted snippets normally carry a
 * `viewBox`, which is why they rendered correctly and files did not.
 *
 * This helper therefore:
 *  1. strips XML prolog / DOCTYPE / comments (invalid inside `innerHTML`),
 *  2. strips hardcoded `width` / `height` from the root `<svg>` only,
 *  3. synthesises a `viewBox` from the intrinsic size when one is missing, so
 *     the artwork scales DOWN to fit,
 *  4. pins `width`/`height` to 100% and `preserveAspectRatio` so it centres.
 *
 * Every hardcoded `fill` / `stroke` is rewritten to `currentColor` (except
 * `none`) so the glyph follows the React `color` property, and a root `fill` is
 * injected when the artwork declares none — an `<svg>` with no fill defaults to
 * solid black, which is what made uploaded icons render flat black.
 */
export function sanitizeSvgIcon(raw: string): string {
  // 1. Drop everything that is illegal inside an injected innerHTML fragment.
  let svg = raw
    .replace(/<\?xml[\s\S]*?\?>/gi, "") // XML prolog
    .replace(/<!DOCTYPE[^>[]*(\[[\s\S]*?\])?[^>]*>/gi, "") // DOCTYPE (incl. internal subset)
    .replace(/<!--[\s\S]*?-->/g, "") // comments
    .trim();

  // 2. Force colour inheritance: every hardcoded fill / stroke becomes
  // `currentColor` so the glyph follows the container's `color` property.
  // PAINT_ATTR_QUOTED leaves non-colour paints (fill="none", url(#gradient),
  // inherit, …) untouched — flattening a gradient reference to a flat colour
  // would destroy the artwork — and `[^"']*\2` never crosses a quote so the
  // tag stays well-formed. `\s(fill|stroke)\s*=` cannot match `stroke-width=`
  // (a `-` follows), so geometry attributes are untouched.
  svg = svg.replace(PAINT_ATTR_QUOTED, ' $1="currentColor"');

  // 2b. Unquoted values (`fill=#000`, legal in HTML-parsed markup) are the last
  // way a hardcoded colour can survive — parsed as HTML they still apply, so an
  // icon uploaded that way would keep painting itself black. PAINT_ATTR_BARE
  // consumes only the value (`[^\s"'>]+`) and applies the same non-colour
  // exemptions as above.
  svg = svg.replace(PAINT_ATTR_BARE, ' $1="currentColor"');

  // 3. Inline `style="fill:#000"` declarations outrank presentation attributes,
  // so they must be rewritten too or those icons would stay black regardless.
  svg = svg.replace(
    /\sstyle\s*=\s*(["'])([^"']*)\1/gi,
    (_match, quote: string, declarations: string) =>
      ` style=${quote}${inheritCssDeclarations(declarations)}${quote}`,
  );

  // 4. Many exported files (Figma / Illustrator) colour the artwork through a
  // `<style>` block of `.cls-1 { fill: #e91e63 }` rules instead of attributes.
  // Those rules outrank presentation attributes, so they must be rewritten as
  // well — otherwise an uploaded file renders in its hardcoded colour.
  svg = svg.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (match, css: string) =>
    css.trim() ? match.replace(css, () => inheritCssDeclarations(css)) : match,
  );

  // 5..8. Rewrite only the root <svg ...> opening tag.
  return svg.replace(/<svg\b[^>]*>/i, (tag) => {
    // Capture the intrinsic size BEFORE stripping it — needed for the viewBox.
    const widthMatch = tag.match(/\swidth\s*=\s*["']\s*([\d.]+)\s*(?:px)?\s*["']/i);
    const heightMatch = tag.match(/\sheight\s*=\s*["']\s*([\d.]+)\s*(?:px)?\s*["']/i);
    const intrinsicWidth = widthMatch ? Number.parseFloat(widthMatch[1] ?? "") : Number.NaN;
    const intrinsicHeight = heightMatch ? Number.parseFloat(heightMatch[1] ?? "") : Number.NaN;

    // Strip hardcoded dimensions (quoted — including "512px" / "100%" — and unquoted).
    // `\swidth` cannot match the `-width` in `stroke-width`, so strokes are safe.
    const stripped = tag
      .replace(/\swidth\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sheight\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\s(?:width|height)\s*=\s*[\d.]+/gi, "");

    // A shipped viewBox — else the intrinsic size — keeps the artwork in
    // proportion. Without one a scaled-up drawing is clipped to one corner.
    const width = Number.isFinite(intrinsicWidth) && intrinsicWidth > 0 ? intrinsicWidth : 24;
    const height = Number.isFinite(intrinsicHeight) && intrinsicHeight > 0 ? intrinsicHeight : 24;
    const viewBox =
      /\sviewBox\s*=\s*["']([^"']*)["']/i.exec(stripped)?.[1] ?? `0 0 ${width} ${height}`;

    // The root's own fill decides how the glyph inherits colour: an existing
    // `fill="none"` must survive for stroke-only artwork, while a root with no
    // fill at all would otherwise paint solid black.
    const rootFill = /\sfill\s*=\s*["']([^"']*)["']/i.exec(stripped)?.[1] ?? "currentColor";

    // Drop every attribute this helper manages so they can be re-emitted in a
    // CANONICAL order. That makes the sanitiser idempotent, which matters because
    // `HabitIcon` re-sanitises stored icons on every render.
    const base = stripped
      .replace(/\sviewBox\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\spreserveAspectRatio\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sfill\s*=\s*["'][^"']*["']/gi, "");

    const attrs = [
      'width="100%"',
      'height="100%"',
      `viewBox="${viewBox}"`,
      // Scale to fit and stay centred so the tinted wrapper remains visible.
      'preserveAspectRatio="xMidYMid meet"',
      `fill="${rootFill}"`,
    ];

    // Insert before the tag's closing bracket, preserving `/` on self-closing tags.
    const closeIndex = base.lastIndexOf(">");
    const head = base.slice(0, closeIndex);
    const isSelfClosing = head.endsWith("/");
    const openTag = isSelfClosing ? head.slice(0, -1) : head;

    return `${openTag} ${attrs.join(" ")}${isSelfClosing ? "/" : ""}>`;
  });
}

/**
 * Central icon renderer for habits / routines / bad habits.
 *
 * `customIcons` is checked before the predefined `ICONS` map so a selected
 * custom SVG always wins over the Lucide fallback. Custom SVGs are sanitised to
 * `currentColor`, so both branches inherit the `color` you pass via `style`.
 */
export function HabitIcon({
  name,
  className,
  style,
  customIcons,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
  /** User-uploaded icons. Checked first so custom ids never fall back. */
  customIcons?: CustomIcon[];
}) {
  const customIcon = findCustomIcon(customIcons, name);

  if (customIcon) {
    return (
      <span
        className={cn("inline-flex items-center justify-center", className)}
        style={style}
        aria-hidden="true"
        /**
         * Re-sanitised at render time as well as on save: icons persisted by an
         * older build may still carry `<!DOCTYPE>`, comments or no `viewBox`,
         * which is what made uploaded files render as a clipped opaque block.
         * Sanitising here repairs them without a re-upload, and because it also
         * forces `currentColor`, icons stored by the older build — which baked
         * in a hardcoded black `fill` — pick up the habit colour immediately.
         */
        dangerouslySetInnerHTML={{ __html: sanitizeSvgIcon(customIcon.svgContent) }}
      />
    );
  }

  const Cmp = ICONS[resolveIconName(name)] ?? Target;
  return <Cmp className={className} style={style} aria-hidden="true" />;
}

/**
 * Per-colour style tokens. `raw` carries the bare CSS colour (no Tailwind
 * wrapper) so accent surfaces can inject it as `--habit-color` and derive
 * their tints with color-mix().
 */
export const COLORS: Record<
  string,
  { raw: string; dot: string; soft: string; text: string; bar: string }
> = {
  teal: {
    raw: "oklch(0.6 0.11 178)",
    dot: "bg-[oklch(0.6_0.11_178)]",
    soft: "bg-[oklch(0.6_0.11_178)]/12",
    text: "text-[oklch(0.45_0.1_178)] dark:text-[oklch(0.78_0.1_178)]",
    bar: "bg-[oklch(0.6_0.11_178)]",
  },
  violet: {
    raw: "oklch(0.58 0.13 290)",
    dot: "bg-[oklch(0.58_0.13_290)]",
    soft: "bg-[oklch(0.58_0.13_290)]/12",
    text: "text-[oklch(0.48_0.13_290)] dark:text-[oklch(0.78_0.1_290)]",
    bar: "bg-[oklch(0.58_0.13_290)]",
  },
  emerald: {
    raw: "oklch(0.62 0.12 155)",
    dot: "bg-[oklch(0.62_0.12_155)]",
    soft: "bg-[oklch(0.62_0.12_155)]/12",
    text: "text-[oklch(0.48_0.11_155)] dark:text-[oklch(0.78_0.1_155)]",
    bar: "bg-[oklch(0.62_0.12_155)]",
  },
  amber: {
    raw: "oklch(0.74 0.13 70)",
    dot: "bg-[oklch(0.74_0.13_70)]",
    soft: "bg-[oklch(0.74_0.13_70)]/14",
    text: "text-[oklch(0.52_0.12_70)] dark:text-[oklch(0.82_0.11_70)]",
    bar: "bg-[oklch(0.74_0.13_70)]",
  },
  rose: {
    raw: "oklch(0.645 0.246 16.4)",
    dot: "bg-[oklch(0.645_0.246_16.4)]",
    soft: "bg-[oklch(0.645_0.246_16.4)]/12",
    text: "text-[oklch(0.52_0.22_16.4)] dark:text-[oklch(0.8_0.13_16.4)]",
    bar: "bg-[oklch(0.645_0.246_16.4)]",
  },
  slate: {
    raw: "oklch(0.55 0.02 260)",
    dot: "bg-[oklch(0.55_0.02_260)]",
    soft: "bg-[oklch(0.55_0.02_260)]/12",
    text: "text-[oklch(0.42_0.02_260)] dark:text-[oklch(0.82_0.02_260)]",
    bar: "bg-[oklch(0.55_0.02_260)]",
  },
  orange: {
    raw: "oklch(0.7 0.18 45)",
    dot: "bg-[oklch(0.7_0.18_45)]",
    soft: "bg-[oklch(0.7_0.18_45)]/12",
    text: "text-[oklch(0.5_0.15_45)] dark:text-[oklch(0.8_0.12_45)]",
    bar: "bg-[oklch(0.7_0.18_45)]",
  },
  indigo: {
    raw: "oklch(0.6 0.2 275)",
    dot: "bg-[oklch(0.6_0.2_275)]",
    soft: "bg-[oklch(0.6_0.2_275)]/12",
    text: "text-[oklch(0.5_0.18_275)] dark:text-[oklch(0.8_0.12_275)]",
    bar: "bg-[oklch(0.6_0.2_275)]",
  },
  pink: {
    raw: "oklch(0.65 0.18 340)",
    dot: "bg-[oklch(0.65_0.18_340)]",
    soft: "bg-[oklch(0.65_0.18_340)]/12",
    text: "text-[oklch(0.55_0.15_340)] dark:text-[oklch(0.8_0.12_340)]",
    bar: "bg-[oklch(0.65_0.18_340)]",
  },
  cyan: {
    raw: "oklch(0.7 0.14 210)",
    dot: "bg-[oklch(0.7_0.14_210)]",
    soft: "bg-[oklch(0.7_0.14_210)]/12",
    text: "text-[oklch(0.5_0.12_210)] dark:text-[oklch(0.8_0.1_210)]",
    bar: "bg-[oklch(0.7_0.14_210)]",
  },
  lime: {
    raw: "oklch(0.768 0.233 130.9)",
    dot: "bg-[oklch(0.768_0.233_130.9)]",
    soft: "bg-[oklch(0.768_0.233_130.9)]/12",
    text: "text-[oklch(0.55_0.22_130.9)] dark:text-[oklch(0.82_0.17_130.9)]",
    bar: "bg-[oklch(0.768_0.233_130.9)]",
  },
  sky: {
    raw: "oklch(0.588 0.158 242)",
    dot: "bg-[oklch(0.588_0.158_242)]",
    soft: "bg-[oklch(0.588_0.158_242)]/12",
    text: "text-[oklch(0.5_0.134_243)] dark:text-[oklch(0.78_0.11_242)]",
    bar: "bg-[oklch(0.588_0.158_242)]",
  },
  fuchsia: {
    raw: "oklch(0.667 0.295 327.8)",
    dot: "bg-[oklch(0.667_0.295_327.8)]",
    soft: "bg-[oklch(0.667_0.295_327.8)]/12",
    text: "text-[oklch(0.59_0.26_328)] dark:text-[oklch(0.82_0.13_328)]",
    bar: "bg-[oklch(0.667_0.295_327.8)]",
  },
};

export const COLOR_NAMES = Object.keys(COLORS);

export function colorStyles(color: string) {
  return COLORS[color] ?? (COLORS["teal"] as (typeof COLORS)[string]);
}

export function RenderIcon({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const resolved = resolveIconName(name);
  const Cmp = ICONS[resolved] ?? Target;
  return <Cmp className={className} style={style} aria-hidden="true" />;
}

/**
 * Returns the accent styling for a habit colour, handling both predefined
 * palette names (oklch) and custom HEX values.
 *
 * The tint is emitted as an INLINE `color-mix()` rather than a Tailwind class.
 * Tailwind only compiles class names that appear verbatim in the source, so the
 * previous approach of mutating one at runtime
 * (`styles.soft.replace("/12", "/14")`) produced a class that was never
 * generated — i.e. no background at all, which is why the preview and the icon
 * picker showed no colour tint.
 *
 * @param color - palette name (e.g. "teal") or HEX string (e.g. "#FF5733")
 * @param opacity - background tint strength (0-1), defaults to 0.14
 * @returns inline `style`, the `rawColor` for glyph/text colour, and the `tint`
 */
export function getColorStyle(
  color: string,
  opacity = 0.14,
): { style: React.CSSProperties; rawColor: string; tint: string } {
  const isHexColor = typeof color === "string" && color.startsWith("#");
  const rawColor = isHexColor ? color : colorStyles(color).raw;
  const percentage = Math.round(opacity * 100);

  // Valid for oklch() palette values and hex alike, in light and dark themes.
  const tint = `color-mix(in srgb, ${rawColor} ${percentage}%, transparent)`;

  return { style: { backgroundColor: tint }, rawColor, tint };
}
