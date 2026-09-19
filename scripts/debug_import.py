import sys

path = 'C:/Cadence/src/features/goals/goal-form.tsx'
with open(path, 'rb') as f:
    content = f.read()

# Find the import line with icon-map
idx = content.find(b'icon-map')
print('Context around icon-map import:')
print(repr(content[idx-80:idx+50]))
