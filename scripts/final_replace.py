"""Exact byte-level replacements. Uses chr() for all special chars."""
# -*- coding: utf-8 -*-
S = lambda n: chr(36) * 0 + chr(32) * n   # n spaces (safe through editor)
BT = chr(96)   # backtick `
D  = chr(36)   # dollar $
NL = chr(10)   # newline
BS = chr(92)   # backslash (for the {{ }} JSX objects)
SQ = chr(39)   # single quote '

def jo(lines):
    """Join a list of lines with newlines."""
    return NL.join(lines)

# ── Badge builder ──────────────────────────────────────────────────────────────
def badge(tag, tag_sp, inner_sp):
    """Build old (span) or new (div) badge. tag='span'|'div'."""
    if tag == 'span':
        return jo([
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
    else:  # div
        return jo([
            S(tag_sp) + '<div',
            S(inner_sp) + 'className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"',
            S(inner_sp) + 'style={{',
            S(inner_sp + 2) + 'backgroundColor: ' + BT + D + '{suggestion.color}20' + BT + ',',
            S(inner_sp + 2) + 'color: suggestion.color,',
            S(inner_sp) + '}}',
            S(tag_sp) + '>',
            S(inner_sp) + '<RenderIcon className="w-4 h-4" name=' + BT + D + '{suggestion.icon}' + BT + ' />',
            S(tag_sp) + '</div>',
        ])

# ── Expanded card builder ───────────────────────────────────────────────────────
def expanded(tag, w_sp, i_sp, p_sp):
    """Build old (span) or new (div) expanded card."""
    if tag == 'span':
        return jo([
            S(w_sp) + '<span className="flex min-w-0 flex-1 items-center gap-2.5">',
            S(i_sp) + '<span',
            S(p_sp) + 'className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"',
            S(p_sp) + 'style={{ backgroundColor: ' + BT + D + '{suggestion.color}20' + BT + ', color: suggestion.color }}',
            S(i_sp) + '>',
            S(p_sp) + '<SuggestedGlyph className="h-4 w-4" style={{ color: suggestion.color }} aria-hidden="true" />',
            S(i_sp) + '</span>',
            S(w_sp) + '</span>',
        ])
    else:  # div
        return jo([
            S(w_sp) + '<div className="flex min-w-0 flex-1 items-center gap-2.5">',
            S(i_sp) + '<div',
            S(p_sp) + 'className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"',
            S(p_sp) + 'style={{ backgroundColor: ' + BT + D + '{suggestion.color}20' + BT + ', color: suggestion.color }}',
            S(i_sp) + '>',
            S(p_sp) + '<RenderIcon className="w-4 h-4" name=' + BT + D + '{suggestion.icon}' + BT + ' />',
            S(i_sp) + '</div>',
            S(w_sp) + '</div>',
        ])

# ── Apply replacements ──────────────────────────────────────────────────────────
def repl(path, old_str, new_str, label):
    with open(path, 'rb') as f:
        content = f.read()
    old_b = old_str.encode('utf-8')
    new_b = new_str.encode('utf-8')
    if old_b in content:
        content = content.replace(old_b, new_b)
        print('OK  :', label)
    else:
        print('MISS:', label)
        # debug: find a nearby probe
        probe = old_str.split(NL)[0][:15].encode('utf-8')
        idx = content.find(probe)
        if idx >= 0:
            print('     probe at', idx, '->', repr(content[max(0,idx-30):idx+len(old_b)+30]))
    with open(path, 'wb') as f:
        f.write(content)

# 1. routine-form.tsx collapsed (22sp tag, 24sp inner, 26sp props)
repl('C:/Cadence/src/features/routines/routine-form.tsx',
     badge('span', 22, 24), badge('div', 22, 24), 'routine collapsed')

# 2. goal-form.tsx collapsed (20sp tag, 24sp inner, 26sp props)
repl('C:/Cadence/src/features/goals/goal-form.tsx',
     badge('span', 20, 24), badge('div', 20, 24), 'goal collapsed')

# 3. goal-form.tsx expanded (25sp wrapper, 26sp inner, 28sp props)
repl('C:/Cadence/src/features/goals/goal-form.tsx',
     expanded('span', 25, 26, 28), expanded('div', 25, 26, 28), 'goal expanded')

# 4. quit-tracker-form.tsx collapsed (22sp tag, 24sp inner)
repl('C:/Cadence/src/features/quit-tracker/quit-tracker-form.tsx',
     badge('span', 22, 24), badge('div', 22, 24), 'quit collapsed')

print('\nDone.')
