"""Get remaining indentation values."""
for path, search, desc in [
    ('C:/Cadence/src/features/goals/goal-form.tsx',
     b'<span\n                       className="w-7 h-7',
     'goal-form: collapsed card'),
    ('C:/Cadence/src/features/quit-tracker/quit-tracker-form.tsx',
     b'<span\n                        className="w-7 h-7',
     'quit-tracker: collapsed card'),
]:
    with open(path, 'rb') as f:
        c = f.read()
    i = c.find(search)
    print(f'=== {desc} ===')
    if i < 0:
        print(f'  NOT FOUND: {search[:50]}')
        # Try to find any w-7 h-7 in the file
        j = c.find(b'w-7 h-7 rounded-lg')
        if j >= 0:
            print(f'  But found w-7 h-7 at byte {j}')
            print(f'  Context: {repr(c[max(0,j-40):j+100])}')
    else:
        lines = c[max(0, i-30):i+250].split(b'\n')
        for idx, line in enumerate(lines[:10]):
            s = line.lstrip()
            sp = len(line) - len(s)
            if s:
                print(f'  L{idx:3d}: {sp:3d}sp | {line[:70]}')
    print()
