"""Dump bytes around goal-form expanded card inner span."""
path = 'C:/Cadence/src/features/goals/goal-form.tsx'
with open(path, 'rb') as f:
    c = f.read()

inner = c.find(b'<span\n' + b'                            className="flex h-7')
print(f'inner = {inner}')
print()

print('Bytes inner-5 to inner+45:')
chunk = c[inner-5:inner+45]
for i, b in enumerate(chunk):
    pos = inner - 5 + i
    ch = chr(b) if 32 <= b < 127 else f'[{b:02x}]'
    print(f'  pos {pos:5d}: {ch}  ({b:02x})')
