"""Inspect current state of all files - look at exact context around key patterns."""
for path in [
    'C:/Cadence/src/features/routines/routine-form.tsx',
    'C:/Cadence/src/features/goals/goal-form.tsx',
    'C:/Cadence/src/features/quit-tracker/quit-tracker-form.tsx',
]:
    with open(path, 'rb') as f:
        c = f.read()
    print(f'=== {path.split(chr(47))[-1]} ({len(c)} bytes) ===')
    
    # Find all RenderIcon occurrences
    for pat_desc, pat in [
        ('RenderIcon {} syntax', b'RenderIcon className="w-4 h-4" name={'),
        ('RenderIcon backtick syntax', b'RenderIcon className="w-4 h-4" name=' + bytes([96]) + b'suggestion.icon' + bytes([96])),
        ('RenderIcon (any)', b'RenderIcon className="w-4 h-4" name='),
        ('rounded-full div', b'rounded-full flex items-center'),
        ('w-7 rounded-lg span', b'w-7 h-7 rounded-lg'),
        ('SuggestedGlyph', b'SuggestedGlyph'),
        ('expanded wrapper span', b'flex min-w-0 flex-1 items-center gap-2.5'),
    ]:
        positions = []
        start = 0
        while True:
            idx = c.find(pat, start)
            if idx == -1:
                break
            positions.append(idx)
            start = idx + 1
        for p in positions:
            ctx_start = max(0, p - 60)
            ctx_end = min(len(c), p + 80)
            print(f'  {pat_desc} @{p}:')
            print(f'    {repr(c[ctx_start:ctx_end])}')
        if not positions:
            print(f'  {pat_desc}: NOT FOUND')
    print()
