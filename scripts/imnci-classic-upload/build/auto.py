# Automatic placing of book lines for Modules 4 to 7: prose goes through T()
# (word for word, headings and lists recognised); tables, chart boxes and forms,
# recognised by their columns, keep their printed layout in a fixed-width box.
import re, os
from src import T, layout, SRC, PAGE, clean, lines
from lib import pre

GAP = re.compile(r"\S {4,}\S")

def _tabular(raw):
    s = raw.rstrip()
    if not s.strip() or PAGE.match(s):
        return False
    body = s.strip()
    if GAP.search(body):
        return True
    return False

_HERE = os.path.dirname(os.path.abspath(__file__))
FIGPAGES = __import__("json").load(open(os.path.join(_HERE, "figpages.json")))
_SHOWN = set()

_PG = {}
def pdf_page(mod, n):
    """The PDF page that book line n (1-based) is on (pdftotext starts each page with a form feed)."""
    if mod not in _PG:
        pg, out = 1, []
        for l in SRC[mod]:
            pg += l.count("\f"); out.append(pg)
        _PG[mod] = out
    return _PG[mod][n - 1]

def printed_page(mod, pg):
    """The page number printed at the foot of PDF page pg, or pg - 1."""
    nums = [int(l) for i, l in enumerate(SRC[mod]) if pdf_page(mod, i + 1) == pg and PAGE.match(l) for l in [l.strip()]]
    return nums[-1] if nums else pg - 1

def A(mod, a, b, headings=True):
    """Blocks for lines a..b: prose word for word, tables in their printed layout. A page whose drawings
    or photographs carry the content is shown as a picture of the page after its text."""
    out = []
    pages = [(n, pdf_page(mod, n)) for n in range(a, b + 1)]
    start = a
    for i, (n, pg) in enumerate(pages):
        last_of_page = i + 1 == len(pages) or pages[i + 1][1] != pg
        if last_of_page and pg in FIGPAGES.get(mod, []) and (mod, pg) not in _SHOWN:
            out += _A(mod, start, n, headings)
            _SHOWN.add((mod, pg))
            out.append({"type": "page", "path": f"imnci-classic/{mod}-pdf{pg:02d}.jpg", "page": printed_page(mod, pg)})
            start = n + 1
    if start <= b:
        out += _A(mod, start, b, headings)
    return out

def _A(mod, a, b, headings=True):
    L = SRC[mod]
    kind = []
    for n in range(a, b + 1):
        raw = L[n - 1]
        kind.append("t" if _tabular(raw) else ("b" if not raw.strip() or PAGE.match(raw) else "p"))
    # a run is tabular when it has 2+ tabular lines with at most 2 prose lines between them,
    # where those prose lines are short (cells broken over lines).
    tab = [False] * len(kind)
    i = 0
    while i < len(kind):
        if kind[i] != "t":
            i += 1; continue
        j = i; last = i; count = 1
        k = i + 1
        while k < len(kind):
            if kind[k] == "t":
                last = k; count += 1; k += 1; continue
            # look ahead: short or indented prose/blank lines inside a table
            gap = 0; m = k
            while m < len(kind) and kind[m] != "t" and gap < 3:
                raw = L[a + m - 1]
                if kind[m] == "p" and (len(raw.strip()) > 60 and (len(raw) - len(raw.lstrip())) < 8):
                    break
                gap += 1; m += 1
            if m < len(kind) and kind[m] == "t" and gap < 3:
                k = m; continue
            break
        if count >= 2:
            for x in range(i, last + 1): tab[x] = True
        i = last + 1
    out, n = [], a
    while n <= b:
        t = tab[n - a]
        m = n
        while m + 1 <= b and tab[m + 1 - a] == t:
            m += 1
        if t:
            out.append(pre(layout(mod, n, m)))
        else:
            # skip runs that are only blanks/page numbers
            if any(L[x - 1].strip() and not PAGE.match(L[x - 1]) for x in range(n, m + 1)):
                out.extend(T(mod, n, m, headings))
            else:
                lines(mod, n, m)
        n = m + 1
    return out

FG = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "fg.txt"), encoding="utf-8").read().split("\n") \
    if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "fg.txt")) else []

def fg(a, b):
    """Facilitator guide lines a..b as plain text (answers, demonstration notes)."""
    return re.sub(r"\s+", " ", " ".join(clean(l) for l in FG[a - 1:b] if not PAGE.match(l))).strip()

def fg_lines(a, b):
    return [clean(l) for l in FG[a - 1:b] if clean(l) and not PAGE.match(l)]
