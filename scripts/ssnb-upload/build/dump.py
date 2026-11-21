# Prints the lessons of one book module, compactly, for writing activities.
#   python3 dump.py m1 2         (book m1, section 2)
import json, re, sys, html
FILES = {'m1': 'ssnb-module-1-essential-emergency-newborn-care', 'm2': 'ssnb-module-2-special-newborn-care', 'm3': 'ssnb-module-3-intensive-newborn-care'}
p = json.load(open(f'../../../course-packages/{FILES[sys.argv[1]]}.imnci.json'))
m = p['modules'][int(sys.argv[2]) - 1]
only = sys.argv[3] if len(sys.argv) > 3 else None
for s in m['sections']:
    if only and only not in s['title']: continue
    print(f"\n### {s['title']}")
    for b in s['read']:
        t = b['type']
        if t in ('paragraph', 'heading'): print(('## ' if t == 'heading' else '') + b['text'])
        elif t == 'rich':
            x = re.sub(r'</(li|tr|p)>', '\n', b['text']); x = re.sub(r'<td[^>]*>', ' | ', x); x = re.sub(r'<br>', ' / ', x)
            print(html.unescape(re.sub('<[^>]+>', '', x)).strip())
        elif t == 'image': print(f"[img {b['path']}]")
        elif t == 'question': print(f"[Q] {b['text']} {b['options']} ans={b['answer']}")
        elif t == 'exercise': print(f"[EX {b['exerciseId']}] {b['note'][:80]}")
        else: print(f'[{t}]')
