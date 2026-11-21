# Reads a Sudan Sick & Small Newborn manual PDF (Word export) into a list of
# elements in reading order, page by page:
#   line  : one printed line of text, with its indent (x), font size, bold, gap above
#   table : a ruled table, as rows of cells (merged cells joined)
#   img   : a figure, cropped from the page into ../figures/<book>-pNNN-k.png
# Page furniture (running footer, page number, logo) is left out by position.
# Nothing is re-worded: the text is the PDF's own characters.
#
#   python3 extract_pdf.py <book.pdf> <key> sources/<key>.json ../figures
import json, os, re, subprocess, sys
from collections import Counter
import pdfplumber

FOOT_TOP = 740          # running footer and page number start below this
MIN_FIG = (60, 40)      # smaller images are bullets/logos

def bold_of(chars):
    n = sum(1 for c in chars if c['text'].strip())
    b = sum(1 for c in chars if c['text'].strip() and 'Bold' in c['fontname'])
    return n > 0 and b / n > 0.8

def inside(l, bb):
    cx = (l['x0'] + l['x1']) / 2; cy = (l['top'] + l['bottom']) / 2
    return bb[0] - 2 <= cx <= bb[2] + 2 and bb[1] - 2 <= cy <= bb[3] + 2

def clean_table(rows):
    """Rows of a pdfplumber table: None = part of a merged cell. Empty rows and
    columns are dropped; a row whose first cell is merged with the one above
    is joined into that row (a cell that runs over several printed rows)."""
    rows = [list(r) for r in rows if any((c or '').strip() for c in r)]
    if not rows: return []
    ncol = max(len(r) for r in rows)
    rows = [r + [None] * (ncol - len(r)) for r in rows]
    keep = [j for j in range(ncol) if any((r[j] or '').strip() for r in rows)]
    out = []
    for r in rows:
        cells = [r[j] for j in keep]
        if out and cells[0] is None:
            prev = out[-1]
            for j, c in enumerate(cells):
                if c and c.strip():
                    prev[j] = (prev[j] + '\n' + c.strip()) if prev[j] else c.strip()
            continue
        out.append([(c or '').strip() for c in cells])
    return out

def main(pdf_path, key, out_json, fig_dir):
    pdf = pdfplumber.open(pdf_path)
    els = []
    os.makedirs(fig_dir, exist_ok=True)
    for pn, page in enumerate(pdf.pages, start=1):
        tables = [t for t in page.find_tables()]
        bbs = [t.bbox for t in tables]
        # a table inside another (text boxes in a cell) is part of the outer one
        tables = [t for t in tables if not any(o is not t.bbox and o[0] <= t.bbox[0] + 1 and o[1] <= t.bbox[1] + 1
                                                and o[2] >= t.bbox[2] - 1 and o[3] >= t.bbox[3] - 1 and o != t.bbox for o in bbs)]
        items = []
        for t in tables:
            rows = clean_table(t.extract())
            if rows:
                items.append({'k': 'table', 'top': t.bbox[1], 'rows': rows, 'bbox': [round(v) for v in t.bbox]})
        tbb = [t.bbox for t in tables]
        for l in page.extract_text_lines(return_chars=True):
            if l['top'] >= FOOT_TOP: continue
            if any(inside(l, bb) for bb in tbb): continue
            chars = [c for c in l['chars'] if c['text'].strip()]
            size = Counter(round(c['size']) for c in chars).most_common(1)[0][0] if chars else 0
            font = Counter(c['fontname'].split('+')[-1] for c in chars).most_common(1)[0][0] if chars else ''
            items.append({'k': 'line', 'top': l['top'], 'bottom': l['bottom'], 'x': round(l['x0']), 'x1': round(l['x1']),
                          't': l['text'], 'size': size, 'font': font, 'b': bold_of(chars)})
        figs = []
        for im in page.images:
            x0, top, x1, bot = im['x0'], im['top'], im['x1'], im['bottom']
            if top >= FOOT_TOP - 10: continue
            if (x1 - x0) < MIN_FIG[0] or (bot - top) < MIN_FIG[1]: continue
            if any(f[0] <= x0 + 2 and f[1] <= top + 2 and f[2] >= x1 - 2 and f[3] >= bot - 2 for f in figs): continue
            figs.append((max(0, x0), max(0, top), min(page.width, x1), min(page.height, bot)))
        for k, (x0, top, x1, bot) in enumerate(figs, start=1):
            name = f'{key}-p{pn:03d}-{k}'
            dpi = 150; s = dpi / 72
            subprocess.run(['pdftoppm', '-f', str(pn), '-l', str(pn), '-r', str(dpi), '-x', str(int(x0 * s)), '-y', str(int(top * s)),
                            '-W', str(int((x1 - x0) * s) + 1), '-H', str(int((bot - top) * s) + 1), '-png', '-singlefile',
                            pdf_path, os.path.join(fig_dir, name)], check=True)
            items.append({'k': 'img', 'top': top, 'name': name + '.png', 'w': round(x1 - x0), 'h': round(bot - top)})
        items.sort(key=lambda e: e['top'])
        prev_bottom = None
        for e in items:
            e['page'] = pn
            if e['k'] == 'line':
                e['gap'] = round(e['top'] - prev_bottom) if prev_bottom is not None else 99
                prev_bottom = e['bottom']
            else:
                prev_bottom = None
            e.pop('bottom', None)
            els.append(e)
    for i, e in enumerate(els): e['i'] = i
    json.dump(els, open(out_json, 'w'), ensure_ascii=False, indent=0)
    c = Counter(e['k'] for e in els)
    print(key, dict(c))

if __name__ == '__main__':
    main(*sys.argv[1:5])
