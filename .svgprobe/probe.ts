function inheritCssDeclarations(css: string): string {
  return css.replace(
    /(?<![\w-])(fill|stroke)\s*:\s*(?!none)([^;}]*)/gi,
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
function sanitizeSvgIcon(raw: string): string {
  // 1. Drop everything that is illegal inside an injected innerHTML fragment.
  let svg = raw
    .replace(/<\?xml[\s\S]*?\?>/gi, "") // XML prolog
    .replace(/<!DOCTYPE[^>[]*(\[[\s\S]*?\])?[^>]*>/gi, "") // DOCTYPE (incl. internal subset)
    .replace(/<!--[\s\S]*?-->/g, "") // comments
    .trim();

  // 2. Force colour inheritance: every hardcoded fill / stroke becomes
  // `currentColor` so the glyph follows the container's `color` property.
  // `fill="none"` / `stroke="none"` survive via the lookahead, and `[^"']*\2`
  // never crosses a quote so the tag stays well-formed. `\s(fill|stroke)\s*=`
  // cannot match `stroke-width=` (a `-` follows), so geometry is untouched.
  svg = svg.replace(/\s(fill|stroke)\s*=\s*(["'])(?!(?:none)\2)[^"']*\2/gi, ' $1="currentColor"');

  // 2b. Unquoted values (`fill=#000`, legal in HTML-parsed markup) are the last
  // way a hardcoded colour can survive — parsed as HTML they still apply, so an
  // icon uploaded that way would keep painting itself black. `[^\s"'>]+` stops
  // at whitespace / quote / bracket so only the value is consumed, and the
  // leading `\s` still keeps `stroke-width`/`fill-rule` out of scope.
  svg = svg.replace(/\s(fill|stroke)\s*=\s*(?![="'`])(?!(?:none)\b)[^\s"'>]+/gi, ' $1="currentColor"');

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

let pass = 0;
let fail = 0;

function check(name, actual, expectations) {
  const problems = expectations.filter(([, fn]) => !fn(actual)).map(([label]) => label);
  if (problems.length) {
    fail++;
    console.log(`FAIL  ${name}`);
    for (const p of problems) console.log(`        - ${p}`);
    console.log(`      got: ${actual}`);
  } else {
    pass++;
    console.log(`ok    ${name}`);
  }
}
const has = (s) => (out) => out.includes(s);
const not = (s) => (out) => !out.includes(s);
const count = (s) => (out) => (out.match(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;

// ---- NEW: unquoted attribute values (the last black escape hatch) --------
check("unquoted fill hex", sanitizeSvgIcon('<svg viewBox="0 0 24 24"><path fill=#000 d="M1"/></svg>'), [
  ["no #000", not("#000")],
  ["inherited", has('fill="currentColor"')],
]);
check("unquoted stroke name", sanitizeSvgIcon('<svg viewBox="0 0 24 24"><path stroke=red d="M1"/></svg>'), [
  ["no red", not("red")],
  ["inherited", has('stroke="currentColor"')],
]);
check(
  "unquoted fill=none preserved",
  sanitizeSvgIcon('<svg viewBox="0 0 24 24"><path fill=none stroke=blue d="M1"/></svg>'),
  [
    ["fill=none kept", has("fill=none")],
    ["stroke inherited", has('stroke="currentColor"')],
  ],
);
check(
  "unquoted does not touch geometry",
  sanitizeSvgIcon('<svg viewBox="0 0 24 24"><path fill-rule=evenodd stroke-width=2 d="M1"/></svg>'),
  [
    ["fill-rule kept", has("fill-rule=evenodd")],
    ["stroke-width kept", has("stroke-width=2")],
  ],
);

// ---- REGRESSION: quoted behaviour from the previous verified build ------
check(
  "quoted fill/stroke still inherited (regression)",
  sanitizeSvgIcon('<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2"><path fill="#f00"/></svg>'),
  [
    ["root fill none kept", has('fill="none"')],
    ["stroke inherited", has('stroke="currentColor"')],
    ["child fill inherited", count('fill="currentColor"') >= 2],
    ["no hardcoded colours", (out) => !out.includes("#000") && !out.includes("#f00")],
    ["stroke-width kept", has('stroke-width="2"')],
  ],
);
check(
  "file prolog/DOCTYPE/viewBox (regression)",
  sanitizeSvgIcon(
    '<?xml version="1.0"?><!DOCTYPE svg PUBLIC "x" "y"><!-- c --><svg version="1.1" xmlns="z" width="512px" height="512px"><circle r="200" fill="#FF5733"/></svg>',
  ),
  [
    ["viewBox synthesised", has('viewBox="0 0 512 512"')],
    ["DOCTYPE gone", not("<!DOCTYPE")],
    ["comment gone", not("<!--")],
    ["fill inherited", has('fill="currentColor"')],
    ["centred", has('preserveAspectRatio="xMidYMid meet"')],
    ["width pinned", has('width="100%"')],
  ],
);
check(
  "style block + inline style + !important (regression)",
  sanitizeSvgIcon(
    '<svg viewBox="0 0 24 24"><style>.a{fill:#000;}.b{stroke:#fff !important;}</style><path class="a" style="fill:#123456;stroke:none" d="M1"/></svg>',
  ),
  [
    ["block fill", has(".a{fill:currentColor;}")],
    ["block !important kept", has("stroke:currentColor !important")],
    ["inline fill", has("fill:currentColor")],
    ["inline stroke:none kept", has("stroke:none")],
    ["no hardcoded", (out) => !/#000|#fff|#123456/.test(out)],
  ],
);
check("idempotent", sanitizeSvgIcon(sanitizeSvgIcon('<svg width="512px" fill="#000"><path fill=#111 d="M1"/></svg>')), [
  [
    "stable",
    (out) => out === sanitizeSvgIcon(out),
  ],
  ["one root fill", count('fill="currentColor"') === 2],
]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

