# Book items (src.py) -> modules and lessons of course blocks.
#   one app module per book Section, one lesson per subsection ("4.3 ..."),
#   a long subsection cut at its own headings into several lessons.
# Blocks keep the book's words; list markers that are numbers or letters are
# kept as printed, bullet glyphs become list bullets.
import html, re
from src import is_bullet

FIG_ROOT = 'ssnb'                 # Storage: online-courses/ssnb/<file>
MAX_BLOCKS, MAX_CHARS = 16, 5200  # a lesson is cut at a heading past these

def esc(s): return html.escape(s, quote=False)

def list_html(items):
    """Consecutive list items -> one rich block. Bullets nest as <ul>; a
    numbered or lettered item keeps its printed marker."""
    out, stack = [], []          # stack of open levels
    base = min(i.get('lvl', 0) for i in items)
    for it in items:
        lvl = it.get('lvl', 0) - base
        while len(stack) > lvl + 1: out.append('</li></ul>'); stack.pop()
        if len(stack) == lvl + 1: out.append('</li>')
        while len(stack) < lvl + 1:
            out.append('<ul>'); stack.append(lvl)
        mk = it.get('marker') or '•'
        txt = esc(it['text'])
        out.append('<li>' + (txt if is_bullet(mk) else f'<strong>{esc(mk)}</strong> {txt}'))
    while stack: out.append('</li></ul>'); stack.pop()
    return ''.join(out)

def table_html(rows):
    cell = lambda c, b=False: ('<td style="padding: 6px; border: 1px solid #cbd5e1; vertical-align: top">'
                               + ('<strong>' if b else '') + esc(c).replace('\n', '<br>') + ('</strong>' if b else '') + '</td>')
    head = len(rows) > 1 and all(len(c) < 60 for c in rows[0]) and len(rows[0]) > 1
    body = ''.join('<tr>' + ''.join(cell(c, head and ri == 0) for c in r) + '</tr>' for ri, r in enumerate(rows))
    return '<table style="width: 100%; border-collapse: collapse">' + body + '</table>'

def to_blocks(items):
    """Items of one lesson -> blocks; each block remembers the element ids it holds (_ids)."""
    blocks, run = [], []
    def flush():
        nonlocal run
        if run:
            blocks.append({'type': 'rich', 'text': list_html(run), '_ids': [x for i in run for x in i['ids']], '_kind': 'list'})
            run = []
    for it in items:
        t = it['type']
        if t == 'li': run.append(it); continue
        flush()
        if t in ('h1', 'h2', 'h3'):
            blocks.append({'type': 'heading', 'text': it['text'], '_ids': it['ids']})
        elif t == 'p':
            blocks.append({'type': 'paragraph', 'text': it['text'], '_ids': it['ids']})
        elif t == 'table':
            rows = it['rows']
            blocks.append({'type': 'rich', 'text': table_html(rows), '_ids': it['ids'], '_kind': 'table'})
        elif t == 'img':
            jpg = it['name'].rsplit('.', 1)[0] + '.jpg'     # shrink.py makes every figure a JPEG
            blocks.append({'type': 'image', 'path': f"{FIG_ROOT}/{jpg}", 'caption': '', '_ids': it['ids'],
                           **({'page': it['page']} if it.get('page') else {})})
        elif t == 'filler':
            if blocks: blocks[-1]['_ids'] = blocks[-1]['_ids'] + it['ids']
            else: blocks.append({'type': '_filler', '_ids': it['ids']})
        else:
            raise ValueError(t)
    flush()
    return blocks

def chars(b): return len(re.sub('<[^>]+>', '', b.get('text', '')))

def strip_num(t):
    t = re.sub(r'^\s*\d+(\.\d+)*\.?\s+', '', t).strip().rstrip(':').strip()
    return t[:1].upper() + t[1:]

def split_long(title, blocks, cuts=None):
    """Cut a lesson at its headings into parts of at most MAX_BLOCKS / MAX_CHARS,
    or, when `cuts` lists heading texts, exactly before those headings."""
    parts, cur, n = [], [], 0
    for b in blocks:
        at_cut = (b['type'] == 'heading' and cur and any(c in b.get('text', '') for c in cuts)) if cuts is not None else \
                 (b['type'] == 'heading' and cur and (len(cur) >= MAX_BLOCKS * 0.6 or n >= MAX_CHARS * 0.6))
        if at_cut:
            parts.append(cur); cur, n = [], 0
        cur.append(b); n += chars(b)
        if len(cur) > MAX_BLOCKS * 1.5 and b['type'] != 'heading':
            pass
    if cur: parts.append(cur)
    if cuts is None and len(parts) > 1 and len(parts[-1]) <= 2 and chars({'text': ' '.join(x.get('text', '') for x in parts[-1])}) < 600:
        last = parts.pop(); parts[-1] = parts[-1] + last
    out = []
    for k, p in enumerate(parts):
        if k == 0: t = title
        else:
            h = next((b['text'] for b in p if b['type'] == 'heading'), '')
            t = f"{title}: {strip_num(h)}" if h else f"{title} (continued)"
        out.append({'title': t, 'blocks': p})
    return out

def modules_of(items, skip_before_first_sec=True):
    """[{title, intro: [items], subs: [{title, items}]}] in book order."""
    mods, pre = [], []
    for it in items:
        if it['type'] == 'sec':
            if mods and not mods[-1]['subs'] and not mods[-1]['intro'] and it['ids'][0] - mods[-1]['_last'] <= 3:
                mods[-1]['title'] += ' ' + it['text']; mods[-1]['ids'] += it['ids']; mods[-1]['_last'] = it['ids'][-1]; continue
            mods.append({'title': it['text'], 'ids': list(it['ids']), 'intro': [], 'subs': [], '_last': it['ids'][-1]}); continue
        if not mods: pre.append(it); continue
        m = mods[-1]
        if it['type'] == 'h1':
            m['subs'].append({'title': it['text'], 'ids': it['ids'], 'items': []})
        elif m['subs']: m['subs'][-1]['items'].append(it)
        else: m['intro'].append(it)
    return pre, mods
