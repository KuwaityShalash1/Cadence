import fs from 'fs';

const sp = (n) => ' '.repeat(n);
const B = String.fromCharCode(96);
const D = String.fromCharCode(36);
const j = (a) => a.join('\n');

// What the FILE actually has (from debug_routine.mjs context output):
// "                   <span\n                        className=\"...\"\n                        style={{\n                          backgroundColor: `${suggestion.color}20`,\n                          color: suggestion.color,\n                        }}\n                    >\n                        <SuggestedGlyph ...\n                     </span>"
//
// Counting spaces in the JSON output:
// Line 1: "                   <span"  -> 20 spaces (verified by hex: 0x20 x20)
// Line 2: "                        className=" -> 24 spaces (hex confirmed)
// Line 3: "                        style={{" -> 24 spaces (equals sign of className aligns)
// Line 4: "                          backgroundColor:" -> 26 spaces (2 more than line 3)
// Line 5: "                          color:" -> 26 spaces
// Line 6: "                        }}" -> 24 spaces
// Line 7: "                    >" -> 20 spaces
// Line 8: "                        <SuggestedGlyph..." -> 24 spaces
// Line 9: "                     </span>" -> 22 spaces ← NOTE: file has 22 not 20!

const S20 = sp(20);
const S22 = sp(22);
const S24 = sp(24);
const S26 = sp(26);

// Build the EXACT old string as it appears in the file
const fileOld = j([
  S20 + '<span',
  S24 + 'className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"',
  S24 + 'style={{',
  S26 + 'backgroundColor: ' + B + D + '{suggestion.color}20' + B + ',',
  S26 + 'color: suggestion.color,',
  S24 + '}}',
  S20 + '>',
  S24 + '<SuggestedGlyph className="w-3.5 h-3.5" aria-hidden="true" style={{ color: suggestion.color }} />',
  S22 + '</span>',   // ← file has 22 spaces, not 20!
]);

// Build what my previous script generated (with S20 for closing span)
const myOld = j([
  S20 + '<span',
  S24 + 'className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"',
  S24 + 'style={{',
  S26 + 'backgroundColor: ' + B + D + '{suggestion.color}20' + B + ',',
  S26 + 'color: suggestion.color,',
  S24 + '}}',
  S20 + '>',
  S24 + '<SuggestedGlyph className="w-3.5 h-3.5" aria-hidden="true" style={{ color: suggestion.color }} />',
  S20 + '</span>',   // ← my script used 20 spaces
]);

console.log('fileOld length:', fileOld.length);
console.log('myOld length:', myOld.length);
console.log('fileOld === myOld:', fileOld === myOld);

// Check file
const filePath = 'C:/Cadence/src/features/routines/routine-form.tsx';
const content = fs.readFileSync(filePath, 'utf8');
console.log('file contains fileOld:', content.includes(fileOld));
console.log('file contains myOld:', content.includes(myOld));

// Show the difference
console.log('---fileOld last 40 chars:', JSON.stringify(fileOld.substring(fileOld.length - 40)));
console.log('---myOld last 40 chars:', JSON.stringify(myOld.substring(myOld.length - 40)));
