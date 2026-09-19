// Complete replacements for form UI unification.
import fs from 'fs';

function repl(filePath, pairs) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [old, neu] of pairs) {
    if (content.includes(old)) {
      content = content.replace(old, neu);
      console.log('OK:', old.substring(0, 50).replace(/\n/g, '\\n').trim());
    } else {
      console.log('MISS:', old.substring(0, 50).replace(/\n/g, '\\n').trim());
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('saved', filePath);
}

const sp = (n) => ' '.repeat(n);
const B = String.fromCharCode(96);
const D = String.fromCharCode(36);
const j = (a) => a.join('\n');

// verified indentation: routine-form collapsed 22/24/24/26/26/24/22/24/22
const R22 = sp(22), R24 = sp(24), R26 = sp(26);
// goal-form collapsed 20/24/24/26/26/24/22
const G20 = sp(20), G22 = sp(22), G24 = sp(24), G26 = sp(26);
// goal-form expanded: 25/27/29/27 wrapper, inner, props, >
const GX25 = sp(25), GX27 = sp(27), GX29 = sp(29);
// quit-tracker collapsed: same as routine-form collapsed
const QT = { s22: sp(22), s24: sp(24), s26: sp(26) };

// 1. routine-form collapsed
repl('C:/Cadence/src/features/routines/routine-form.tsx', [
  [j([R22+'<span',R24+'className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"',R24+'style={{',R26+'backgroundColor: '+B+D+'{suggestion.color}20'+B+',',R26+'color: suggestion.color,',R24+'}}',R22+'>',R24+'<SuggestedGlyph className="w-3.5 h-3.5" aria-hidden="true" style={{ color: suggestion.color }} />',R22+'</span>']),j([R22+'<div',R24+'className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"',R24+'style={{',R26+'backgroundColor: '+B+D+'{suggestion.color}20'+B+',',R26+'color: suggestion.color,',R24+'}}',R22+'>',R24+'<RenderIcon className="w-4 h-4" name='+B+'suggestion.icon'+B+' />',R22+'</div>'])],
]);
console.log('Done 1');

// 2. goal-form collapsed
repl('C:/Cadence/src/features/goals/goal-form.tsx', [
  [j([G20+'<span',G24+'className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"',G24+'style={{',G26+'backgroundColor: '+B+D+'{suggestion.color}20'+B+',',G26+'color: suggestion.color,',G24+'}}',G22+'>',G24+'<SuggestedGlyph className="w-3.5 h-3.5" aria-hidden="true" style={{ color: suggestion.color }} />',G22+'</span>']),j([G20+'<div',G24+'className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"',G24+'style={{',G26+'backgroundColor: '+B+D+'{suggestion.color}20'+B+',',G26+'color: suggestion.color,',G24+'}}',G22+'>',G24+'<RenderIcon className="w-4 h-4" name='+B+'suggestion.icon'+B+' />',G22+'</div>'])],
]);
console.log('Done 2');

// 3. goal-form expanded
repl('C:/Cadence/src/features/goals/goal-form.tsx', [
  [j([GX25+'<span className="flex min-w-0 flex-1 items-center gap-2.5">',GX27+'<span',GX29+'className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"',GX29+'style={{ backgroundColor: '+B+D+'{suggestion.color}20`, color: suggestion.color }}',GX27+'>',GX29+'<SuggestedGlyph className="h-4 w-4" style={{ color: suggestion.color }} aria-hidden="true" />',GX27+'</span>',GX27+'<span className="text-xs font-semibold whitespace-normal text-slate-800 dark:text-slate-200">',GX29+'{suggestion.name}',GX27+'</span>',GX25+'</span>']),j([GX25+'<div className="flex min-w-0 flex-1 items-center gap-2.5">',GX27+'<div',GX29+'className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"',GX29+'style={{ backgroundColor: '+B+D+'{suggestion.color}20`, color: suggestion.color }}',GX27+'>',GX29+'<RenderIcon className="w-4 h-4" name='+B+'suggestion.icon'+B+' />',GX27+'</div>',GX27+'<span className="text-xs font-semibold whitespace-normal text-slate-800 dark:text-slate-200">',GX29+'{suggestion.name}',GX27+'</span>',GX25+'</div>'])],
]);
console.log('Done 3');

// 4. quit-tracker collapsed
repl('C:/Cadence/src/features/quit-tracker/quit-tracker-form.tsx', [
  [j([QT.s22+'<span',QT.s24+'className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"',QT.s24+'style={{',QT.s26+'backgroundColor: '+B+D+'{suggestion.color}20'+B+',',QT.s26+'color: suggestion.color,',QT.s24+'}}',QT.s22+'>',QT.s24+'<SuggestedGlyph className="w-3.5 h-3.5" aria-hidden="true" style={{ color: suggestion.color }} />',QT.s22+'</span>']),j([QT.s22+'<div',QT.s24+'className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"',QT.s24+'style={{',QT.s26+'backgroundColor: '+B+D+'{suggestion.color}20'+B+',',QT.s26+'color: suggestion.color,',QT.s24+'}}',QT.s22+'>',QT.s24+'<RenderIcon className="w-4 h-4" name='+B+'suggestion.icon'+B+' />',QT.s22+'</div>'])],
]);
console.log('Done 4');
