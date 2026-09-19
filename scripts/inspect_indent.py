"""Print exact indentation of the collapsed suggestion card in routine-form.tsx."""
path = 'C:/Cadence/src/features/routines/routine-form.tsx'
with open(path, 'rb') as f:
    c = f.read()

# Target: "<span\n                        className=\"w-7 h-7 rounded-lg..."
target = b'<span\n' + b'                        className="w-7 h-7 rounded-lg'
i = c.find(target)
print('Target found at byte:', i)
print()

start = max(0, i - 50)
end = min(len(c), i + 500)
block = c[start:end]

lines = block.split(b'\n')
for idx, line in enumerate(lines):
    stripped = line.lstrip()
    spaces = len(line) - len(stripped)
    preview = line[:72]
    if stripped:
        print(f"L{idx:3d}: {spaces:3d}sp | {preview}")
