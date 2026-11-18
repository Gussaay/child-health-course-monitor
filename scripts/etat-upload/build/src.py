# Reads the ETAT manual for participants (WHO 2005; text taken from the PDF with
# `pdftotext` in reading order, see sources/manual.txt; the few glyphs the PDF
# font loses (dashes in ranges, joined hyphens) restored) and turns a range of lines into course blocks, without
# changing a word.
#
#   T("ac", 50, 62)  -> the blocks for lines 50 to 62 of sources/ac.txt
#
# Only layout is changed: lines are joined into paragraphs, bullets become
# lists, page numbers are dropped, and glyphs the PDF font maps oddly are
# shown as the character the book prints (‟ is an apostrophe,  a bullet,
#  a tick). Every range used is recorded, so check.py can prove that each
# line of the book is in the course.
import os, re, html

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCES = os.path.join(HERE, "sources") if os.path.isdir(os.path.join(HERE, "sources")) else os.path.join(HERE, "..", "sources")
BOOKS = ("manual",)
SRC = {k: open(os.path.join(SOURCES, f"{k}.txt"), encoding="utf-8").read().split("\n")
       for k in BOOKS if os.path.exists(os.path.join(SOURCES, f"{k}.txt"))}
USED = {k: set() for k in SRC}   # line numbers placed in the course

GLYPHS = {"‟": "’", "„": "’", "": "✓", "": "", "": "", "": "", "": "", "": "",
          "": "", "": "", "▪": "", "": "", "\x84": "", "¾": ""}
BULLET = re.compile(r"^(\s*)(?:([•▪●►*])\s*|(o)\s+|(-)\s+|(\d{1,2}[.\-)])\s+|([ivx]{1,4}\.)\s+|([a-l][.)])\s+)(?=\S)")
HEAD = re.compile(r"^(\d+(\.\d+)*\.?\s+[A-Za-z]|(ASK|LOOK|COUNT|PINCH|OFFER|FEEL|MEASURE|DO|CHECK|ASSESS)\b[^.]{0,90}[:?]?$)")
VERB = re.compile(r"^(ASK|LOOK|COUNT|PINCH|OFFER|FEEL|MEASURE|CHECK)\b[ A-Z&,]*:")
# A page number, or a running header or footer of the manual (page furniture, not text).
PAGE = re.compile(r"^\s*(\d{1,3}|EMERGENCY TRIAGE ASSESSMENT AND TREATMENT|INTRODUCTION|MODULE [A-Z]+ - .*|ASSESSMENT QUESTIONS: [A-Z ]+|ANNEX [A-Z0-9]+ - .*|IV|III)\s*$")
# A line that is only an answer space ("……………", "-----", "_____"): not text, so it is left out.
FILLER = re.compile(r"^[\s.…_\-–—�]*$")

def clean(s):
    for a, b in GLYPHS.items():
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", s).strip()

def is_heading(raw):
    t = clean(raw)
    if not t or len(t) > 110:
        return False
    letters = [c for c in t if c.isalpha()]
    upper = letters and sum(c.isupper() for c in letters) / len(letters) > 0.85
    return bool(HEAD.match(t)) or (upper and len(t) < 90 and len(letters) > 3)

def lines(mod, a, b):
    """The book lines a..b (1-based, inclusive), marked as used."""
    out = []
    for n in range(a, b + 1):
        USED[mod].add(n)
        out.append(SRC[mod][n - 1])
    return out

def parse(raw_lines, headings=True):
    """[(kind, payload)] with kind heading | para | list (payload = [(level, text)])."""
    items, para, lst = [], [], None
    def flush_para():
        nonlocal para
        if para:
            items.append(("para", join(para)))
            para = []
    def flush_list():
        nonlocal lst
        if lst:
            items.append(("list", [(x[0], join(x[1])) for x in lst if x is not None]))
            lst = None
    last_blank = False
    raw_lines = list(raw_lines)
    # A sentence broken by a page end: drop the blank lines and page number between the two halves.
    keep = []
    raw_lines = ["" if (FILLER.match(r) and r.strip()) else r for r in raw_lines]
    for i, raw in enumerate(raw_lines):
        if PAGE.match(raw):
            continue
        if not raw.strip():
            j = i + 1
            while j < len(raw_lines) and (not raw_lines[j].strip() or PAGE.match(raw_lines[j])):
                j += 1
            page_between = any(PAGE.match(x) for x in raw_lines[i:j])
            if page_between and j < len(raw_lines) and raw_lines[j].strip()[:1].islower():
                continue
        keep.append(raw)
    raw_lines = keep
    for raw in raw_lines:
        if PAGE.match(raw):
            continue
        was_blank, last_blank = last_blank, not raw.strip()
        if not raw.strip():
            flush_para()
            if lst is not None:
                lst.append(None)          # a blank line inside a list: the list may go on
            continue
        if lst is not None and lst and lst[-1] is None:
            lst.pop()
            if not BULLET.match(raw):
                flush_list()
        m = BULLET.match(raw)
        stripped = clean(raw)
        if m and clean(raw[m.end():]):
            flush_para()
            indent = len(m.group(1).expandtabs())
            marker = next(g for g in m.groups()[1:] if g)
            text = raw[m.end():]
            if re.fullmatch(r"\d{1,2}[.\-)]|[ivx]{1,4}\.|[a-l][.)]", marker):
                text = marker + " " + text   # keep the book's numbering
            if lst is None:
                lst = []
            lst.append((indent, [text]))
            continue
        verb = bool(VERB.match(stripped))
        if lst and not was_blank and not verb and len([c for c in stripped if c.isalpha()]) < 10:
            lst[-1][1].append(raw)        # a short word carried over to the next line ("ANWMIA.")
            continue
        if headings and (is_heading(raw) or verb) and (not para or verb):
            flush_para()
            flush_list()
            prev = items[-1] if items else None
            if (prev and prev[0] == "heading" and prev[1].isupper() and stripped.isupper()
                    and not prev[1].endswith((":", "?", ".")) and len(prev[1]) + len(stripped) < 100 and not was_blank):
                items[-1] = ("heading", prev[1] + " " + stripped)   # a heading broken over two lines
            else:
                items.append(("heading", stripped))
            continue
        if lst is not None and lst:
            ind = len(raw) - len(raw.lstrip())
            if ind <= lst[-1][0] and stripped.lower().startswith("note"):
                flush_list()              # back at the bullet's margin: a new paragraph
                para.append(raw)
                continue
            lst[-1][1].append(raw)        # continuation of the last item
            continue
        para.append(raw)
    flush_para()
    if lst is not None:
        lst = [x for x in lst if x is not None]
        flush_list()
    return items

def join(parts):
    s = ""
    for p in parts:
        p = clean(p)
        if not p:
            continue
        if s.endswith("-") and not s.endswith(" -") and p[:1].islower():
            s += p                        # a word broken at the end of a line
        else:
            s = (s + " " + p) if s else p
    return s

def esc(s): return html.escape(s, quote=False)

def to_blocks(items):
    out = []
    for kind, x in items:
        if kind == "heading":
            out.append({"type": "heading", "text": x})
        elif kind == "para":
            out.append({"type": "paragraph", "text": x})
        else:
            x = [(lv, t) for lv, t in x if t]
            # depth from the indents, read as a stack: a deeper indent opens a sub-list
            depths, stack = [], []
            for lv, _ in x:
                while stack and lv < stack[-1] - 1:
                    stack.pop()
                if not stack or lv > stack[-1] + 1:
                    stack.append(lv)
                else:
                    stack[-1] = lv
                depths.append(len(stack) - 1)
            if max(depths) == 0:
                out.append({"type": "list", "items": [t for _, t in x]})
            else:
                html_s, depth = "", -1
                for (lv, t), d in zip(x, depths):
                    while depth < d:
                        html_s += "<ul>"; depth += 1
                    while depth > d:
                        html_s += "</li></ul>"; depth -= 1
                    if html_s.endswith("<ul>"):
                        html_s += f"<li>{esc(t)}"
                    else:
                        html_s += f"</li><li>{esc(t)}"
                while depth >= 0:
                    html_s += "</li></ul>"; depth -= 1
                out.append({"type": "rich", "text": html_s})
    return out

def T(mod, a, b, headings=True):
    """Blocks for book lines a..b, word for word."""
    return to_blocks(parse(lines(mod, a, b), headings))

def P(mod, a, b):
    """One paragraph made of lines a..b (no headings or lists detected)."""
    return {"type": "paragraph", "text": join(lines(mod, a, b))}

def text_of(mod, a, b):
    """The plain text of lines a..b, as one string (for exercise narratives)."""
    return join([l for l in lines(mod, a, b) if not PAGE.match(l)])

def mark(mod, a, b):
    """Lines a..b are in the course in hand-written blocks (tables, chart boxes)."""
    lines(mod, a, b)

def layout(mod, a, b):
    """Lines a..b as printed (layout kept): for chart boxes, tables and forms. Page numbers dropped."""
    ls = [clean_keep(l) for l in lines(mod, a, b) if not PAGE.match(l)]
    while ls and not ls[0].strip(): ls.pop(0)
    while ls and not ls[-1].strip(): ls.pop()
    ind = min((len(l) - len(l.lstrip()) for l in ls if l.strip()), default=0)
    return "\n".join(l[ind:] for l in ls)

def clean_keep(s):
    for a, b in GLYPHS.items():
        s = s.replace(a, b)
    return s.rstrip()
