# Turns the extracted elements of each book (sources/<key>.json, see
# extract_pdf.py / extract_docx.py) into course items in book order:
#   sec   a section title (one app module)        h1  a subsection (lesson start)
#   h2/h3 a heading inside a lesson               p   a paragraph
#   li    a list item (lvl, marker)               table, img
# Only layout changes: printed lines are joined into paragraphs, a word split
# by a hyphen at a line end is joined back, list levels come from the indent.
# Every element id is carried on the item that holds it, so build.py can prove
# that every element of the book is placed in the course.
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
def load(key):
    return json.load(open(os.path.join(HERE, 'sources', f'{key}.json'), encoding='utf-8'))

BULLETS = '•●▪○◦■□➢►✓✔❖⮚-–'
MARK = re.compile(r'^\s*(?:([' + re.escape(BULLETS) + r'])\s*|(o)\s+|(\(?\d{1,2}[.)](?!\d))\s*|(\(?[a-hA-H][.)])\s+|(\(?(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)[.)])\s+)(?=\S)')
FILLER = re.compile(r'^[\s._…\-–—]*$')
END = re.compile(r'[.:;?!)]["”’]?$')

def marker_of(text):
    m = MARK.match(text)
    if not m: return None, text
    g = next(x for x in m.groups() if x is not None)
    rest = text[m.end():].strip()
    if not rest: return None, text
    return g, rest

def is_bullet(mk): return mk is not None and (mk in BULLETS or mk == 'o' or ord(mk[0]) > 0xF000)

def join(a, b):
    if not a: return b
    if re.search(r'[A-Za-z]-$', a) and b[:1].islower(): return a + b
    return a + ' ' + b

# ---------------------------------------------------------------- PDF books
# Subscripts the PDF text layer prints as a separate small "2" (H₂O, FiO₂ ...):
# the 2 is put back in its word and the stray digit dropped. Listed in README.
SUBS = [(re.compile(r'\bcm H O\b'), 'cm H₂O'), (re.compile(r'\bH O\b'), 'H₂O'), (re.compile(r'\bFiO\b(?![₂2])'), 'FiO₂'),
        (re.compile(r'\bPaCO\b(?![₂2])'), 'PaCO₂'), (re.compile(r'\bPaO\b(?![₂2])'), 'PaO₂'), (re.compile(r'\bSpO\b(?![₂2])'), 'SpO₂'),
        (re.compile(r'\bCO (?=levels|elimination|removal|retention)'), 'CO₂ ')]
def fix_sub(t):
    for rx, rep in SUBS: t = rx.sub(rep, t)
    return t
STRAY = re.compile(r'^\s*(?:/\s*)?2(?:\s+2)?\s*$')

def box_lines(e, labelled=False):
    """A text box the PDF draws as a one-column 'table' (or a label | text box): its
    printed lines, as if they were ordinary lines of the page, so they become
    paragraphs and lists. A short label cell beside the text, or a short line
    standing alone between sentences (a heading inside the box), becomes a heading line."""
    flat = []
    for row in e['rows']:
        cells = [c for c in row if c and c.strip()]
        for ci, c in enumerate(cells):
            lines = [x.strip() for x in c.split('\n') if x.strip() and not STRAY.match(x)]
            label = labelled and len(cells) > 1 and ci == 0 and len(lines) <= 3 and len(c) < 60
            flat += [(t, label) for t in lines]
    out = []
    for k, (t, label) in enumerate(flat):
        prev = out[-1]['t'] if out else ''
        nxt = flat[k + 1][0] if k + 1 < len(flat) else ''
        heading = label or (len(t) < 70 and not END.search(t) and not MARK.match(t) and t[:1].isupper()
                            and (not out or END.search(prev) or out[-1].get('b')) and (MARK.match(nxt) or nxt[:1].isupper()))
        brk = (not out) or heading or out[-1].get('b') or bool(END.search(prev)) or bool(MARK.match(t))
        out.append({'k': 'line', 't': fix_sub(t), 'x': 72, 'x1': 540, 'size': 12, 'font': 'Box', 'b': heading,
                    'gap': 20 if brk else 9, 'i': e['i'], 'page': e['page']})      # a box starts a new block
    return out

def single_col(e):
    """(is a text box, has a label column)"""
    rows = e['rows']
    if rows and rows[0] and 'EXERCISE' in rows[0][0].replace(' ', '').upper():
        return False, False      # a case box of the exercises: kept whole (build.py makes it an exercise)
    one = sum(1 for r in rows if sum(1 for c in r if c.strip()) <= 1)
    two_label = all(len([c for c in r if c.strip()]) <= 2 for r in rows) and len(rows[0]) <= 3 and \
        sum(len(r[0]) for r in rows) < 0.25 * sum(len(' '.join(r)) for r in rows) and any('\n' in ' '.join(r) for r in rows) and len(rows) <= 2
    return (one >= 0.8 * len(rows) or two_label), two_label

def pdf_items(els, lvl_base=72, step=18):
    items, cur = [], None
    expanded = []
    for e in els:
        if e['k'] == 'table' and single_col(e)[0]:
            expanded.extend(box_lines(e, single_col(e)[1]))
        elif e['k'] == 'line':
            if e['size'] <= 9 and STRAY.match(e['t']):
                expanded.append({**e, 't': '…'})     # a subscript 2, restored by fix_sub: kept only to count as placed
            else:
                expanded.append({**e, 't': fix_sub(e['t'])})
        elif e['k'] == 'table':
            expanded.append({**e, 'rows': [[fix_sub('\n'.join(x for x in c.split('\n') if not STRAY.match(x))) for c in r] for r in e['rows']]})
        else:
            expanded.append(e)
    els = expanded
    def push():
        nonlocal cur
        if cur: items.append(cur)
        cur = None
    for e in els:
        if e['k'] != 'line':
            push()
            items.append({'type': e['k'], 'ids': [e['i']], 'page': e['page'], **({'rows': e['rows']} if e['k'] == 'table' else {'name': e['name'], 'w': e['w'], 'h': e['h']})})
            continue
        t = e['t'].strip()
        if FILLER.match(t):
            if cur: cur['ids'].append(e['i'])
            else: items.append({'type': 'filler', 'ids': [e['i']], 'page': e['page']})
            continue
        brit = e['font'].startswith('Britannic') and e['size'] >= 14
        kind = ('sec' if e['size'] >= 26 else 'h1' if e['size'] == 16 else 'h2') if brit else 'body'
        if brit and len(t) <= 2:      # a stray bullet glyph set in the heading font
            kind = 'body'
        mk, rest = marker_of(t) if kind == 'body' else (None, t)
        if kind != 'body':
            if cur and cur.get('kind') == kind and e['gap'] < 14 and cur['page'] == e['page']:
                cur['text'] = join(cur['text'], t); cur['ids'].append(e['i']); continue
            push(); cur = {'kind': kind, 'type': kind, 'text': t, 'ids': [e['i']], 'page': e['page']}; continue
        new = cur is None or cur['kind'] != 'body' or mk is not None
        if not new:
            if e['gap'] == 99:   # first line of a page
                new = END.search(cur['text']) is not None or not (t[:1].islower() or t[:1].isdigit() or t[:1] in '(')
                new = new or (cur['allbold'] and not e['b'] and len(cur['text']) < 160)   # a heading, then its text
                if cur['type'] == 'li' and e['x'] <= cur['mx']: new = new or False
            elif e['gap'] >= 14:
                new = True
            elif cur['type'] == 'li' and e['x'] <= cur['mx'] - 2:
                new = True
            elif cur['type'] == 'p' and cur['bold'] != e['b'] and cur['bold'] and END.search(cur['text']) is None and len(cur['text']) < 160:
                new = True    # a bold heading line followed straight by the text under it
        if new:
            push()
            cur = {'kind': 'body', 'type': 'li' if mk else 'p', 'text': rest if mk else t, 'ids': [e['i']], 'page': e['page'],
                   'x': e['x'], 'mx': e['x'], 'bold': e['b'], 'allbold': e['b']}
            if mk:
                cur['marker'] = mk
                cur['lvl'] = max(0, round((e['x'] - lvl_base) / step))
        else:
            cur['text'] = join(cur['text'], t); cur['ids'].append(e['i'])
            cur['allbold'] = cur['allbold'] and e['b']
    push()
    for it in items:
        if it.get('kind') == 'body':
            if it.get('allbold') and len(it['text']) < 170 and not END.search(it['text'].rstrip(':')) and it['type'] == 'p':
                it['type'] = 'h3'
            elif it.get('allbold') and it['type'] == 'p' and it['text'].endswith(':') and len(it['text']) < 170:
                it['type'] = 'h3'
        for k in ('kind', 'x', 'mx', 'bold', 'allbold'): it.pop(k, None)
    return items

# --------------------------------------------------------------- Word book
def docx_items(els):
    items = []
    flat = []
    for e in els:
        # a paragraph with line breaks in it: one item per line; the first keeps the paragraph's list marker
        if e['k'] == 'para' and '\n' in e['t']:
            parts = [x.strip() for x in e['t'].split('\n') if x.strip()]
            for n, x in enumerate(parts):
                f = dict(e, t=x)
                if n > 0:
                    f.pop('marker', None); f['head'] = 0
                    mk, rest = marker_of(x)
                    if mk: f['marker'] = mk; f['t'] = rest; f['lvl'] = e.get('lvl', 0) + (0 if is_bullet(mk) else 1)
                flat.append(f)
        else:
            flat.append(e)
    # 64 px box icons set next to the "Practise this skill" / "Important" / case boxes: decoration, not figures
    DECOR = {f'm1-{n:03d}' for n in (3, 5, 8, 13, 20, 21, 26, 27, 28, 29, 43, 44, 45, 46, 47, 48)}
    tiny = lambda name: name.rsplit('.', 1)[0] in DECOR
    for e in flat:
        if e['k'] == 'img':
            items.append({'type': 'filler' if tiny(e['name']) else 'img', 'ids': [e['i']], 'name': e['name']}); continue
        if e['k'] == 'table':
            items.append({'type': 'table', 'ids': [e['i']], 'rows': e['rows']}); continue
        t = re.sub(r'\s+', ' ', e['t']).strip()
        if FILLER.match(t):
            items.append({'type': 'filler', 'ids': [e['i']]}); continue
        if e['head'] == 1:
            items.append({'type': 'sec', 'text': t, 'ids': [e['i']]}); continue
        if e['head'] == 2:
            items.append({'type': 'h1', 'text': t, 'marker': e.get('marker'), 'ids': [e['i']]}); continue
        if e.get('marker'):
            mk = e['marker']
            if e['b'] and len(t) < 120 and re.match(r'^\d+(\.\d+)+$', mk):
                items.append({'type': 'h2', 'text': f'{mk} {t}', 'ids': [e['i']]}); continue
            items.append({'type': 'li', 'text': t, 'marker': '•' if mk == '•' else mk, 'lvl': e.get('lvl', 0), 'ids': [e['i']]}); continue
        mk, rest = marker_of(t)
        if e['b'] and len(t) < 170 and not mk:
            items.append({'type': 'h3', 'text': t, 'ids': [e['i']]}); continue
        if mk and not is_bullet(mk):
            items.append({'type': 'li', 'text': rest, 'marker': mk, 'lvl': 0, 'ids': [e['i']]}); continue
        items.append({'type': 'p', 'text': t, 'ids': [e['i']]})
    return items

def book_items(key):
    els = load(key)
    return docx_items(els) if key == 'm1' else pdf_items(els), els
