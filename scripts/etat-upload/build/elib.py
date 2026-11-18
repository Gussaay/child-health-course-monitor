# Helpers for the Sudan ETAT course (WHO ETAT manual for participants, 2005,
# taught in the order of the WHO ETAT facilitator guide).
# Book text is placed by line number from sources/manual.txt and is never
# re-worded: X() joins lines into paragraphs, LI() makes a list, and tables are
# rebuilt from the same words (their lines marked with mark()).
import re
from src import T, lines, join, clean, PAGE, SRC, USED
import src as _src
from lib import *

M = "manual"
SOURCE = "WHO ETAT manual for participants (2005)"

def _nonempty(blocks):
    return [b for b in blocks if not (b["type"] == "paragraph" and not b["text"].strip())]

def X(a, b, h=()):
    """Book lines a..b as paragraphs; line numbers in h are headings."""
    out, start = [], a
    cuts = sorted(n for n in h if a <= n <= b)
    for n in cuts:
        if start <= n - 1:
            out += T(M, start, n - 1, headings=False)
        out.append(H(clean(lines(M, n, n)[0])))
        start = n + 1
    if start <= b:
        out += T(M, start, b, headings=False)
    return _nonempty(out)

def items(a, b):
    """The items of a list printed with its bullets apart: a new item starts with a capital letter or a digit."""
    out = []
    for raw in lines(M, a, b):
        t = clean(raw)
        if not t or PAGE.match(raw):
            continue
        t = t.lstrip("-• ").strip()
        if out and not re.match(r"[A-Z0-9(“\"]", t):
            out[-1] = join([out[-1], t])
        else:
            out.append(t)
    return out

def LI(a, b):
    return L(items(a, b))

def TX(a, b):
    """The text of lines a..b as one string."""
    return join([l for l in lines(M, a, b) if not PAGE.match(l)])

SKIPPED = set()
def mark(a, b):
    """Lines a..b are in the course in blocks rebuilt from their words (tables, boxes)."""
    lines(M, a, b)

def skip(a, b):
    """Lines a..b are not shown as text: front matter, or a chart shown as its printed page."""
    lines(M, a, b)
    SKIPPED.update(range(a, b + 1))

def fig(n, caption, page):
    """Figure n of the manual (a drawing), uploaded as online-courses/etat/fig-NN.png."""
    return {"type": "image", "path": f"etat/fig-{n:02d}.png", "caption": caption, "page": page}

def chart(n, page, caption):
    """An ETAT chart (manual Annex 3) as printed: online-courses/etat/chart-NN.png."""
    return {"type": "page", "path": f"etat/chart-{n if isinstance(n, str) else format(n, '02d')}.png", "page": page, "caption": caption}

def tbl(headers, rows, caption=None):
    """A table rebuilt from the book's words: headers and rows of cells (HTML allowed in cells)."""
    th = "".join(f'<th style="padding:6px;border:1px solid #cbd5e1;background:#f1f5f9;text-align:left;vertical-align:top">{h}</th>' for h in headers)
    trs = "".join("<tr>" + "".join(f'<td style="padding:6px;border:1px solid #cbd5e1;vertical-align:top">{c}</td>' for c in r) + "</tr>" for r in rows)
    cap = f'<p style="font-weight:600;margin:0 0 6px">{esc(caption)}</p>' if caption else ""
    return R(cap + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px">'
             + (f"<tr>{th}</tr>" if headers else "") + trs + "</table></div>")

def ul(xs):
    return "<ul style=\"margin:0;padding-left:18px\">" + "".join(f"<li>{x}</li>" for x in xs) + "</ul>"

def fgnote(text):
    """What the facilitator guide has the facilitator do or stress at this point, for the self-learner."""
    return note(text, "From your facilitator")

def timing(text):
    """Where this lesson sits in the facilitator guide's timetable."""
    return note(text, "Course timetable")

# ---- exercises -----------------------------------------------------------------
SUB = "online IMCI course"   # the online-course exercise list in the app (IMNCI_SUBCOURSE_TYPES)
def _base(eid, order, title, narrative, minutes, source=SOURCE):
    return {"id": eid, "order": order, "title": f"Sudan ETAT: {title}", "subCourse": SUB, "passMark": 80,
            "estimatedMinutes": minutes, "draft": True, "source": source, "narrative": list(narrative)}

def equiz(eid, order, title, narrative, questions, minutes=10, source=SOURCE, pass_mark=80):
    e = _base(eid, order, title, narrative, minutes, source)
    e.update({"kind": "quiz", "questions": list(questions), "passMark": pass_mark})
    return e
P_ = Pp
