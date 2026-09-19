"""Debug: compare constructed old string with actual file content."""
S = lambda n: chr(36) * 0 + chr(32) * n
BT = chr(96)
D  = chr(36)
NL = chr(10)

def badge(tag, tag_sp, inner_sp):
    if tag == 'span':
        return NL.join([
            S(tag_sp) + '<span',
            S(inner_sp) + 'className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"',
            S(inner_sp) + 'style={{',
            S(inner_sp + 2) + 'backgroundColor: ' + BT + D + '{suggestion.color}20' + BT + ',',
            S(inner_sp + 2) + 'color: suggestion.color,',
            S(inner_sp) + '}}',
            S(tag_sp) + '>',
            S(inner_sp) + '<SuggestedGlyph className="w-3.5 h-3.5" aria-hidden="true" style={{ color: suggestion.color }} />',
            S(tag_sp) + '</span>',
        ])
    return ''

# Build old string for routine-form collapsed (22sp/24sp)
old_rf = badge('span', 22, 24)
print('Constructed old string (routine-form collapsed):')
print(repr(old_rf))
print('Length:', len(old_rf))
print()

# Read file and find the pattern
path = 'C:/Cadence/src/features/routines/routine-form.tsx'
with open(path, 'rb') as f:
    content = f.read()

old_b = old_rf.encode('utf-8')
print('old_b in content:', old_b in content)
print()

# Find where in the file the 22-space + <span pattern appears
probe = (S(22) + '<span').encode('utf-8')
idx = content.find(probe)
print(f'First occurrence of 22sp+<span at byte {idx}')
if idx >= 0:
    print('Context:', repr(content[idx-10:idx+120]))
    print()
    # Check if old_b matches at this location
    print(f'old_b matches at idx {idx}:', content[idx:idx+len(old_b)] == old_b)
    print('Expected:', repr(old_b[:80]))
    print('Actual:  ', repr(content[idx:idx+80]))
