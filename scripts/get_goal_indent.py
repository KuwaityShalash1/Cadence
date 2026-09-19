"""Get goal-form collapsed card indentation."""
path = 'C:/Cadence/src/features/goals/goal-form.tsx'
with open(path, 'rb') as f:
    c = f.read()

# Found w-7 h-7 at byte 10995, context: "span\n                        className=..."
# So <span is at 10995-24-... let's find it
i = c.find(b'w-7 h-7 rounded-lg')
print(f'w-7 h-7 at byte {i}')
print(f'Context: {repr(c[i-60:i+250])}')
print()

# Also find the expanded card
j = c.find(b'<span\n                            className="flex h-7')
print(f'Expanded card inner span at byte {j}')
if j >= 0:
    print(f'Context: {repr(c[j-30:j+250])}')
