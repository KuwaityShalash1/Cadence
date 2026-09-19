"""Get exact indentation for all suggestion card blocks."""
import os

files_and_searches = [
    # (path, search_bytes, description)
    ('C:/Cadence/src/features/routines/routine-form.tsx',
     b'<span\n                          className="flex h-7',
     'routine-form: expanded card'),
    ('C:/Cadence/src/features/routines/routine-form.tsx',
     b'<span\n                        className="w-7 h-7 rounded-lg',
     'routine-form: collapsed card'),
    ('C:/Cadence/src/features/goals/goal-form.tsx',
     b'<span\n                            className="flex h-7',
     'goal-form: expanded card inner span'),
    ('C:/Cadence/src/features/goals/goal-form.tsx',
     b'<span\n                          className="w-7 h-7 rounded-lg',
     'goal-form: collapsed card'),
    ('C:/Cadence/src/features/quit-tracker/quit-tracker-form.tsx',
     b'<span\n                          className="w-7 h-7 rounded-lg',
     'quit-tracker: collapsed card'),
]

for path, search, desc in files_and_searches:
    with open(path, 'rb') as f:
        content = f.read()
    i = content.find(search)
    print(f'=== {desc} ===')
    if i < 0:
        print(f'  NOT FOUND: {search[:50]}')
        print()
        continue
    start = max(0, i - 30)
    end = min(len(content), i + 250)
    lines = content[start:end].split(b'\n')
    for idx, line in enumerate(lines):
        stripped = line.lstrip()
        sp = len(line) - len(stripped)
        preview = line[:70]
        if stripped:
            print(f'  L{idx:3d}: {sp:3d}sp | {preview}')
    print()
