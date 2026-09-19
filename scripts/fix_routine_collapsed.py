"""Replace collapsed suggestion card in routine-form.tsx."""
path = 'C:/Cadence/src/features/routines/routine-form.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = (
    '                      <span\n'
    '                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"\n'
    '                        style={\n'
    '                          backgroundColor: `$\{suggestion.color}20`,\n'
    '                          color: suggestion.color,\n'
    '                        }\n'
    '                      >\n'
    '                        <SuggestedGlyph className="w-3.5 h-3.5" aria-hidden="true" style={{ color: suggestion.color }} />\n'
    '                     </span>'
)

new = (
    '                      <div\n'
    '                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"\n'
    '                        style={\n'
    '                          backgroundColor: `$\{suggestion.color}20`,\n'
    '                          color: suggestion.color,\n'
    '                        }\n'
    '                      >\n'
    '                        <RenderIcon className="w-4 h-4" name={suggestion.icon} />\n'
    '                     </div>'
)

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("REPLACED collapsed card in routine-form.tsx")
else:
    print("NOT FOUND in routine-form.tsx")
    i = content.find('rounded-lg flex items-center justify-center shrink-0')
    print(repr(content[i-120:i+200]))
