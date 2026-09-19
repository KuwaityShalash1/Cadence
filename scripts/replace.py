import sys

path = sys.argv[1]
old_str = sys.argv[2]
new_str = sys.argv[3]

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

if old_str in content:
    content = content.replace(old_str, new_str)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('REPLACED')
else:
    print('NOT FOUND')
    # Find approximate location
    search = old_str.strip().split('\n')[0]
    idx = content.find(search)
    if idx >= 0:
        print('Nearby context:')
        print(repr(content[max(0,idx-200):idx+len(old_str)+200]))
