# Turns the text of a printed facilitator guide (pdftotext -layout: one page per
# form feed, columns kept by spaces) into guide blocks, word for word:
#   - a run of lines with columns (gaps of 3 or more spaces that line up) is a table;
#     a row starts where the first column has text, the lines below it with an empty
#     first column continue that row (a timetable: Time | Activities | Methods);
#   - lines starting with a bullet glyph are a list;
#   - anything else is a paragraph, its lines joined.
# Nothing is reworded or left out: build checks every word of each page is in the guide.
import html, re

BULLETS = '\x84\x83\x86\x8a\x8b\uf0b7\uf06e\uf0a7\uf0d8\uf076\uf0fc\u2022\u25cf\u25aa\u2023\u25e6'
BULLET_RE = re.compile(r'^\s*([' + BULLETS + r']|z(?=\s{2,})|-(?=\s))\s*')
WORD = re.compile(r"[A-Za-z0-9؀-ۿ]+")

def esc(s):
    return html.escape(s, quote=False)

def words(s):
    # a lone "z" is the printed bullet glyph (Wingdings), not a word
    return [w for w in WORD.findall(html.unescape(re.sub(r'<[^>]+>', ' ', s)).lower()) if w != 'z']

def is_columnar(line):
    return bool(re.search(r'\S {3,}\S', line.strip()))

def gutters(lines):
    """Character positions that are blank in every line, as runs of at least 3, between text."""
    w = max(len(l) for l in lines)
    blank = [all(c >= len(l) or l[c] == ' ' for l in lines) for c in range(w)]
    first = min(len(l) - len(l.lstrip()) for l in lines if l.strip())
    out, c = [], first
    while c < w:
        if blank[c]:
            s = c
            while c < w and blank[c]: c += 1
            if c - s >= 2 and c < w: out.append((s, c))
        else:
            c += 1
    return out

def cut(line, gs):
    cells, start = [], 0
    for s, e in gs:
        cells.append(line[start:s].strip()); start = e
    cells.append(line[start:].strip())
    return cells

def table_block(lines):
    gs = gutters(lines)
    if not gs:
        return None
    rows = []
    for l in lines:
        if not l.strip():
            rows.append(None); continue
        cells = cut(l, gs)
        if rows and rows[-1] is not None and not cells[0] and any(cells):
            rows[-1] = [(a + ' ' + b).strip() for a, b in zip(rows[-1], cells)]
        else:
            rows.append(cells)
    rows = [r for r in rows if r and any(r)]
    keep = [k for k in range(len(rows[0]) if rows else 0) if any(r[k] for r in rows)]
    rows = [[r[k] for k in keep] for r in rows]
    if len(rows) < 1 or len(rows[0]) < 2:
        return None
    td = 'padding: 6px; border: 1px solid #cbd5e1; vertical-align: top'
    body = ''.join('<tr>' + ''.join(f'<td style="{td}">{esc(c)}</td>' for c in r) + '</tr>' for r in rows)
    return {'type': 'rich', 'text': f'<table style="width: 100%; border-collapse: collapse">{body}</table>'}

def prose_blocks(lines):
    """Paragraphs and bullet lists from lines without columns."""
    out, para, items = [], [], []
    def flush_para():
        if para: out.append({'type': 'paragraph', 'text': (' '.join(para))}); para.clear()
    def flush_items():
        if items: out.append({'type': 'rich', 'text': '<ul>' + ''.join(f'<li>{esc(i)}</li>' for i in items) + '</ul>'}); items.clear()
    for l in lines:
        s = l.strip()
        if not s:
            flush_para(); flush_items(); continue
        m = BULLET_RE.match(l)
        if m:
            flush_para(); items.append(BULLET_RE.sub('', l, count=1).strip()); continue
        if items and (len(l) - len(l.lstrip())) > 0 and not para:
            items[-1] += ' ' + s; continue
        flush_items(); para.append(s)
    flush_para(); flush_items()
    return out

def indent(l):
    return len(l) - len(l.lstrip())

def table_end(lines, i):
    """Where a table that starts at line i ends: it runs on through blank lines, and through lines
    indented into a column (a cell's text wrapping), while more lines with columns follow soon."""
    n, base, j, last = len(lines), indent(lines[i]), i, i
    while j < n:
        l = lines[j]
        if l.startswith('\x00'): break
        if is_columnar(l): last = j
        elif l.strip() and not (indent(l) > base + 3 and any(is_columnar(x) for x in lines[j + 1:j + 9])):
            # a wrapped cell line after the last row with columns still belongs to that row
            if not (indent(l) > base + 3 and j - last <= 3 and l.strip()):
                break
            last = j
        j += 1
    return last + 1

SIDE = re.compile(r'^(.*\S)\s{5,}([A-Z][A-Z ,&/()-]+[A-Z)])\s*$')
LEAD = re.compile(r'^(\s*)([' + BULLETS + r']|z|-)\s{2,}')

def prepare(lines):
    """Bullets keep one space after them (so a list is not taken for columns), and a label
    printed in the margin beside the text (MODULE OVERVIEW, OBJECTIVES) becomes a heading line."""
    out = []
    for l in lines:
        l = LEAD.sub(lambda m: m.group(1) + ('\u2022' if m.group(2) == 'z' else m.group(2)) + ' ', l)
        m = SIDE.match(l)
        if m and len(m.group(1)) >= 20 and indent(l) < len(m.group(1)) and l.index(m.group(2)) >= 50 and len(m.group(2)) >= 4:
            out.append('\x00' + m.group(2).strip()); l = m.group(1)
        out.append(l)
    return out

def blocks_of(lines):
    """Blocks of a run of page lines (already without running headers)."""
    lines = prepare(lines)
    out, i, n = [], 0, len(lines)
    while i < n:
        if lines[i].startswith('\x00'):
            out.append({'type': 'heading', 'text': (lines[i][1:])}); i += 1; continue
        if is_columnar(lines[i]):
            j = table_end(lines, i)
            seg = lines[i:j]
            t = table_block(seg) if sum(1 for l in seg if is_columnar(l)) >= 2 else None
            if t: out.append(t)
            else: out += [{'type': 'paragraph', 'text': (re.sub(r' {3,}', ' · ', l.strip()))} for l in seg if l.strip()]
            i = j
        else:
            j = i
            while j < n and not is_columnar(lines[j]) and not lines[j].startswith('\x00'): j += 1
            out += prose_blocks(lines[i:j])
            i = j
    return out
