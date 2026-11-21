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
def pdf_items(els, lvl_base=72, step=18):
    items, cur = [], None
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
