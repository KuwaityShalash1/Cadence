import fs from 'fs';

const sp = (n) => ' '.repeat(n);
const B = String.fromCharCode(96);
const D = String.fromCharCode(36);
const j = (a) => a.join('\n');

const S20 = sp(20);
const S24 = sp(24);
const S26 = sp(26);

const old = j([
  S20 + '<span',
  S24 + 'className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"',
  S24 + 'style={',
  S26 + 'backgroundColor: ' + B + D + '{suggestion.color}20' + B + ',',
  S26 + 'color: suggestion.color,',
  S24 + '}',
  S20 + '>',
  S24 + '<SuggestedGlyph className="w-3.5 h-3.5" aria-hidden="true" style={{ color: suggestion.color }} />',
  S20 + '</span>',
]);

console.log('Generated old string length:', old.length);
console.log('---');
console.log(JSON.stringify(old));
console.log('---');

// Now check the file
const filePath = 'C:/Cadence/src/features/routines/routine-form.tsx';
const fileContent = fs.readFileSync(filePath, 'utf8');

console.log('File contains old string:', fileContent.includes(old));

// Find the actual content in the file
const searchStart = 'w-7 h-7 rounded-lg flex items-center justify-center shrink-0';
const idx = fileContent.indexOf(searchStart);
if (idx >= 0) {
  const contextStart = Math.max(0, idx - 60);
  const contextEnd = Math.min(fileContent.length, idx + 250);
  console.log('File context (JSON):', JSON.stringify(fileContent.substring(contextStart, contextEnd)));
}
