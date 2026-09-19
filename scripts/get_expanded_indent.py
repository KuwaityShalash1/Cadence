"""Get goal-form expanded card indentation."""
path = 'C:/Cadence/src/features/goals/goal-form.tsx'
with open(path, 'rb') as f:
    c = f.read()

# Search for the inner span in the expanded card
search = b'<span\n' + b'                            className="flex h-7'
i = c.find(search)
print(f'Expanded card inner span at byte: {i}')
print()

if i >= 0:
    block = c[max(0, i-30):i+400]
    lines = block.split(b'\n')
    for idx, line in enumerate(lines):
        stripped = line.lstrip()
        sp = len(line) - len(stripped)
        if stripped:
            print(f'L{idx:3d}: {sp:3d}sp | {line[:70]}')
