// __FUNCS__

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
