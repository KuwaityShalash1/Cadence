"""Check current state of routine-form.tsx."""
path = 'C:/Cadence/src/features/routines/routine-form.tsx'
with open(path, 'rb') as f:
    c = f.read()

print(f'File size: {len(c)} bytes')
print()

for pat in [b'w-7 h-7', b'rounded-full w-8', b'RenderIcon className', b'SuggestedGlyph className',
            b'flex min-w-0 flex-1', b'className="flex h-7', b'<span\n                        className="w-7',
            b'<div\n                        className="w-8']:
    positions = []
    start = 0
    while True:
        idx = c.find(pat, start)
        if idx == -1:
            break
        positions.append(idx)
        start = idx + 1
    print(f'{pat!r}: {len(positions)} occurrence(s)')
    for p in positions[:2]:
        ctx = c[max(0,p-15):p+55]
        print(f'  @{p}: {repr(ctx)}')
    print()
