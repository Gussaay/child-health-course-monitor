# Reads the Module 1 Word file into the same kind of element list as
# extract_pdf.py: paragraphs (with heading level, list level and the list's
# own number or bullet, worked out from the document's numbering the way Word
# prints it), tables (rows of cells, merged cells once) and pictures (saved to
# ../figures/m1-NNN.<ext>). Nothing is re-worded.
#
#   python3 extract_docx.py <book.docx> sources/m1.json ../figures
import json, os, re, sys
from collections import Counter, defaultdict
import docx
from docx.oxml.ns import qn

ROMAN = [(10, 'x'), (9, 'ix'), (5, 'v'), (4, 'iv'), (1, 'i')]
def roman(n):
    out = ''
    for v, s in ROMAN:
        while n >= v: out += s; n -= v
    return out

def fmt_num(fmt, n):
    if fmt == 'decimal': return str(n)
    if fmt == 'lowerLetter': return chr(96 + n)
    if fmt == 'upperLetter': return chr(64 + n)
    if fmt == 'lowerRoman': return roman(n)
    if fmt == 'upperRoman': return roman(n).upper()
    return str(n)

class Numbering:
    def __init__(self, d):
        self.levels = {}      # (numId, ilvl) -> (fmt, lvlText, start)
        self.counters = defaultdict(lambda: defaultdict(int))
        try:
            root = d.part.numbering_part.element
        except Exception:
            return
        absd = {}
        for a in root.findall(qn('w:abstractNum')):
            aid = a.get(qn('w:abstractNumId'))
            lv = {}
            for l in a.findall(qn('w:lvl')):
                il = int(l.get(qn('w:ilvl')))
                f = l.find(qn('w:numFmt')); t = l.find(qn('w:lvlText')); s = l.find(qn('w:start'))
                lv[il] = (f.get(qn('w:val')) if f is not None else 'decimal', t.get(qn('w:val')) if t is not None else '%1.',
                          int(s.get(qn('w:val'))) if s is not None else 1)
            absd[aid] = lv
        self.abs_of = {}
        for n in root.findall(qn('w:num')):
            nid = n.get(qn('w:numId')); a = n.find(qn('w:abstractNumId')).get(qn('w:val'))
            self.abs_of[nid] = a
            for il, v in absd.get(a, {}).items():
                self.levels[(nid, il)] = v

    def marker(self, nid, il):
        fmt, text, start = self.levels.get((nid, il), ('bullet', '•', 1))
        if fmt == 'bullet' or fmt == 'none':
            return '•'
        key = self.abs_of.get(nid, nid)
        c = self.counters[key]
        c[il] = (c[il] or start - 1) + 1
        for deeper in [k for k in c if k > il]: c[deeper] = 0
        out = text
        for k in range(il + 1):
            f = self.levels.get((nid, k), ('decimal', '', 1))[0]
            out = out.replace(f'%{k + 1}', fmt_num(f, c[k] or self.levels.get((nid, k), ('', '', 1))[2]))
        return out

def para_num(p):
    pPr = p._p.pPr
    if pPr is None or pPr.numPr is None: 
        # numbering may come from the style
        st = p.style
        while st is not None:
            ppr = st.element.pPr
            if ppr is not None and ppr.numPr is not None and ppr.numPr.numId is not None:
                il = ppr.numPr.ilvl.val if ppr.numPr.ilvl is not None else 0
                return str(ppr.numPr.numId.val), int(il)
            st = st.base_style
        return None
    nid = pPr.numPr.numId; il = pPr.numPr.ilvl
    if nid is None or str(nid.val) == '0': return None
    return str(nid.val), int(il.val) if il is not None else 0

def is_bold(p):
    runs = [r for r in p.runs if r.text.strip()]
    if not runs: return False
    def b(r):
        if r.bold is not None: return r.bold
        st = p.style
        while st is not None:
            if st.font.bold is not None: return st.font.bold
            st = st.base_style
        return False
    n = sum(len(r.text.strip()) for r in runs)
    return sum(len(r.text.strip()) for r in runs if b(r)) / n > 0.8

def blips(el):
    return [b.get(qn('r:embed')) for b in el.iter(qn('a:blip')) if b.get(qn('r:embed'))]

def main(path, out_json, fig_dir):
    d = docx.Document(path)
    num = Numbering(d)
    os.makedirs(fig_dir, exist_ok=True)
    els = []; nimg = [0]
    def save_img(rid):
        part = d.part.related_parts.get(rid)
        if part is None: return None
        ext = os.path.splitext(part.partname)[1].lower() or '.png'
        nimg[0] += 1
        name = f'm1-{nimg[0]:03d}{ext}'
        open(os.path.join(fig_dir, name), 'wb').write(part.blob)
        return name
    def ptext(p):
        # the paragraph's text with its line breaks (python-docx's p.text drops them)
        out = []
        for el in p._p.iter():
            tag = el.tag.split('}')[1] if '}' in el.tag else el.tag
            if tag == 't' and el.text: out.append(el.text)
            elif tag in ('br', 'cr'): out.append('\n')
            elif tag == 'tab': out.append(' ')
        return ''.join(out)
    def para(p):
        text = ptext(p).replace('\u00a0', ' ')
        style = p.style.name if p.style is not None else ''
        head = 1 if style == 'Heading 1' else 2 if style == 'Heading 2' else 3 if style.startswith('Heading') else 0
        n = para_num(p)
        e = {'k': 'para', 't': re.sub(r'[ \t]+', ' ', text).strip(), 'style': style, 'head': head, 'b': is_bold(p)}
        if n and text.strip():
            e['lvl'] = n[1]; e['marker'] = num.marker(*n)
        return e
    for child in d.element.body.iterchildren():
        tag = child.tag.split('}')[1]
        if tag == 'p':
            p = docx.text.paragraph.Paragraph(child, d)
            e = para(p)
            if e['t']: els.append(e)
            for rid in blips(child):
                name = save_img(rid)
                if name: els.append({'k': 'img', 'name': name})
        elif tag == 'tbl':
            t = docx.table.Table(child, d)
            rows, imgs = [], []
            for r in t.rows:
                seen, cells = set(), []
                for c in r.cells:
                    if id(c._tc) in seen: continue
                    seen.add(id(c._tc))
                    parts = []
                    for cp in c.paragraphs:
                        ce = para(cp)
                        if ce['t']:
                            parts.append((ce.get('marker', '') + ' ' if ce.get('marker') else '') + ce['t'])
                    cells.append('\n'.join(parts))
                    for rid in blips(c._tc):
                        name = save_img(rid)
                        if name: imgs.append(name)
                if any(x.strip() for x in cells): rows.append(cells)
            if rows: els.append({'k': 'table', 'rows': rows})
            for name in imgs: els.append({'k': 'img', 'name': name})
    for i, e in enumerate(els): e['i'] = i
    json.dump(els, open(out_json, 'w'), ensure_ascii=False, indent=0)
    print('m1', dict(Counter(e['k'] for e in els)))

if __name__ == '__main__':
    main(*sys.argv[1:4])
