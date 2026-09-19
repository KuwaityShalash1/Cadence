import fs from 'fs';

function repl(filePath, pairs) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [old, neu] of pairs) {
    if (content.includes(old)) {
      content = content.replace(old, neu);
      console.log('OK:', old.substring(0, 55).replace(/\n/g, '\\n').trim());
    } else {
      console.log('MISS:', old.substring(0, 55).replace(/\n/g, '\\n').trim());
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('saved', filePath);
}

const sp = (n) => ' '.repeat(n);
const B = String.fromCharCode(96);
const D = String.fromCharCode(36);
const j = (a) => a.join('\n');

const S20 = sp(20), S24 = sp(24), S26 = sp(26);
const G25 = sp(25), G27 = sp(27), G29 = sp(29);
const GC23 = sp(23), GC25 = sp(25), GC27 = sp(27);

// ── 1. routine-form.tsx collapsed card ────────────────────────────────────────
// File structure (from hex dump): 20sp<span, 24spclassName=, 24spstyle={{,
//   26spbackgroundColor:, 26spcolor:, 24sp}}, 20sp>, 24sp<SuggestedGlyph.../, 20sp</span>
repl('C:/Cadence/src/features/routines/routine-form.tsx', [
  [
    j([
      S20 + '<span',
      S24 + 'className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"',
      S24 + 'style={{',
      S26 + 'backgroundColor: ' + B + D + '{suggestion.color}20' + B + ',',
      S26 + 'color: suggestion.color,',
      S24 + '}}',
      S20 + '>',
      S24 + '<SuggestedGlyph className="w-3.5 h-3.5" aria-hidden="true" style={{ color: suggestion.color }} />',
      S20 + '</span>',
    ]),
    j([
      S20 + '<div',
      S24 + 'className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"',
      S24 + 'style={{',
      S26 + 'backgroundColor: ' + B + D + '{suggestion.color}20' + B + ',',
      S26 + 'color: suggestion.color,',
      S24 + '}}',
      S20 + '>',
      S24 + '<RenderIcon className="w-4 h-4" name=' + B + 'suggestion.icon' + B + ' />',
      S20 + '</div>',
    ]),
  ],
]);
console.log('Done 1');
