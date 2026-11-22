# The national IMNCI facilitator guide for the SCM training modules (FMOH Sudan, Dec 2021),
# word for word, as a guide document: one chapter per part of the guide (the facilitator
# guidelines of each module, the checklists, the annex forms), one section per numbered
# heading of the guide.
#   python3 imnci.py      writes course-packages/sudan-imnci-facilitator-guide.imnci.json
# The source is the guide's text (sources/fg.txt of the IMNCI classic build): it has no
# page layout, so a table of the guide comes out as its cells' lines, in order.
import json, os, re, sys
from collections import Counter
from layout import words, esc, BULLET_RE

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
SRC = os.path.join(ROOT, 'scripts', 'imnci-classic-upload', 'build', 'sources', 'fg.txt')
OUT = os.path.join(ROOT, 'course-packages', 'sudan-imnci-facilitator-guide.imnci.json')

raw = [l.rstrip() for l in open(SRC, encoding='utf-8').read().split('\n')]

# Chapters: (title, the line that starts it, 1-based, as found in the guide).
CHAPTERS = [
    ('About this guide', 1),
    ('Introduction to this facilitator guide', 61),
    ('Checklists of instructional materials and supplies', 193),
    ('Facilitator guidelines: Introduction', 244),
    ('Facilitator guidelines: Assess and classify the sick child age 2 months up to 5 years', 383),
    ('Facilitator guidelines: Identify treatment', 3223),
    ('Facilitator guidelines: Treat the child', 3702),
    ('Facilitator guidelines: Counsel the mother', 5451),
    ('Facilitator guidelines: Charting', None),
    ('Facilitator guidelines: Management of the sick young infant age from birth up to 2 months', 6228),
    ('Facilitator guidelines: Follow-up', 7556),
    ('Guidelines for all modules', 7962),
    ('IMNCI training report form', 8381),
    ('Distribution of patients and exposures', 8458),
    ('Group checklist of clinical signs', 8483),
    ('Additional signs in young infants', 8524),
]
TOC = range(23, 53)   # the guide's own table of contents (lines 23-52): the reader has its own
charting = next(i for i in range(6170, 6228) if raw[i - 1].strip() == 'CHARTING')
CHAPTERS = [(t, a if a else charting) for t, a in CHAPTERS]
for t, a in CHAPTERS: assert 1 <= a <= len(raw), t

# Running heads printed at the top of each page (after the page number), by chapter.
HEADS = ['INTEGRATED MANAGEMENT OF CHILDHOOD ILLNESSES (IMNCI)', 'CASE MANAGEMENT OF THE SICK CHILD AGE 2 MONTHS UP TO 5 YEARS',
         'CASE MANAGEMENT OF THE SICK YOUNG INFANT AGE FROM BIRTH UP TO 2 MONTHS', 'ASSESS AND CLASSIFY THE SICK CHILD AGE 2 MONTHS UP TO 5 YEARS',
         'ASSESS AND CLASSIFY THE SICK CHILD AGE 2 MONTHS UP TO YEARS', 'ASSESS AND CLASSIFY THE SICK CHILD 2 MONTHS UP TO 5 YEARS',
         "IDENTIFY TREATMENT'", 'IDENTIFY TREATMENT', 'TREAT THE CHILD', 'COUNSEL THE MOTHER', 'CHARTING',
         'MANAGEMENT OF THE SICK YOUNG INFANT', 'FOLLOW-UP', 'GUIDELINES FOR ALL MODULES']
PAGE = re.compile(r'^\s*((C|F)-)?\d{1,3}\s*$')

# Keep each line with its number; drop page numbers and the table of contents; a running head
# right after a page number is dropped, and what follows it on that line ("Answers to Exercise F")
# is kept as a heading.
lines = []   # (n, kind, text): kind 'line' or 'head'
after_page = False
for n, l in enumerate(raw, 1):
    if n in TOC: continue
    if PAGE.match(l): after_page = True; continue
    s = l.strip()
    if after_page and s:
        after_page = False
        head = next((h for h in sorted(HEADS, key=len, reverse=True) if s.upper().startswith(h)), None)
        if head and n not in {a for _, a in CHAPTERS}:
            rest = s[len(head):].strip()
            if rest: lines.append((n, 'head', rest))
            continue
    lines.append((n, 'line', l))

# Numbered headings of the guide: "3. INTRODUCTION OF MODULE", "4. EXERCISE A: Part 1: Video ...".
SEC = re.compile(r'^\s*(\d{1,2}(\.\d{1,2})*)\.?\s+([A-Z][A-Z\'’"“”()/&,–-]*(\s+[A-Z0-9][A-Z0-9\'’"“”():,/&–-]*)+)(\s|:|$)')
def is_section(s):
    m = SEC.match(s)
    if not m or len(m.group(3)) < 8: return False
    # "28 EXERCISE T", "29 SUMMARY OF MODULE": a number without a dot only before these
    no_dot = not re.match(r'^\s*\d{1,2}(\.\d{1,2})*\.', s)
    return not no_dot or m.group(3).split()[0] in ('EXERCISE', 'EXERERCISE', 'SUMMARY', 'DRILL', 'DEMONSTRATION')

def paras(texts):
    """Paragraphs from the guide's lines: a line that runs to the margin continues on the next."""
    out, cur, items = [], [], []
    def flush():
        if cur:
            long_ = all(len(x) >= 55 for x in cur[:-1])
            if long_: out.append({'type': 'paragraph', 'text': ' '.join(x.strip() for x in cur)})
            else: out.append({'type': 'rich', 'text': '<p>' + '<br>'.join(esc(x.strip()) for x in cur) + '</p>'})
            cur.clear()
        if items: out.append({'type': 'rich', 'text': '<ul>' + ''.join(f'<li>{esc(i)}</li>' for i in items) + '</ul>'}); items.clear()
    for kind, t in texts:
        s = t.strip()
        if kind == 'head': flush(); out.append({'type': 'heading', 'text': s}); continue
        if not s: flush(); continue
        m = BULLET_RE.match(t)
        if m:
            if cur: flush()
            items.append(BULLET_RE.sub('', t, count=1).strip()); continue
        if items and not cur and len(s) and s[0].islower():
            items[-1] += ' ' + s; continue
        if items: flush()
        cur.append(t)
        if re.search(r'[.:?!]$', s) and len(s) < 60: flush()
    flush()
    return out

starts = {a: t for t, a in CHAPTERS}
modules, sec, buf, wrap = [], None, [], [False]
def close():
    if sec is not None: sec['read'] += paras(buf)
    buf.clear()
for n, kind, t in lines:
    if n in starts:
        close()
        modules.append({'title': starts[n], 'order': len(modules) + 1, 'sections': []})
        sec = {'title': starts[n], 'read': []}; modules[-1]['sections'].append(sec)
    if not modules: continue
    if kind == 'line' and is_section(t):
        close()
        sec = {'title': re.sub(r'\s+', ' ', t.strip()), 'read': []}
        wrap[0] = len(t.strip()) >= 72
        modules[-1]['sections'].append(sec)
        continue
    if wrap[0] and kind == 'line' and t.strip() and not BULLET_RE.match(t):
        sec['title'] += ' ' + t.strip(); wrap[0] = False; continue   # the heading wraps onto this line
    wrap[0] = False
    buf.append((kind, t))
close()

for m in modules:
    # a numbered heading with nothing under it before the next one: its words go on as a heading of the next
    kept, carry = [], []
    for k, s in enumerate(m['sections']):
        if not s['read'] and k > 0 and k + 1 < len(m['sections']):
            carry.append({'type': 'heading', 'text': s['title']}); continue
        s['read'] = carry + s['read']; carry = []; kept.append(s)
    m['sections'] = kept
    for k, s in enumerate(m['sections'], 1):
        s.update(order=k, see=[], practise=[])
        if not s['read']: s['read'] = [{'type': 'paragraph', 'text': s['title']}]
        if k == 1 and len(m['sections']) > 1 and s['title'] == m['title']: s['title'] = f"{m['title']}: procedures"

# Word check: every word of the guide's lines (not page numbers, running heads or its contents list) is placed.
src = Counter(w for n, kind, t in lines for w in words(esc(t)))
got = Counter(w for m in modules for s in m['sections'] for b in s['read'] for w in words(b['text'] if b['type'] == 'rich' else esc(b['text'])))
got += Counter(w for m in modules for s in m['sections'][1:] for w in words(esc(s['title'])))
missing = src - got
pkg = {
    'format': 'imnci-course-package', 'version': 1,
    'about': 'Facilitator guide for IMNCI SCM training modules, Federal Ministry of Health Sudan (Dec 2021): the whole guide, '
             'word for word. Built by scripts/facilitator-guides/imnci.py.',
    'course': {
        'title': 'IMNCI: facilitator guide (SCM training modules)', 'audience': 'facilitators', 'lockOrder': False, 'category': 'IMNCI',
        'description': 'Facilitator Guide for the IMNCI SCM training modules, Federal Ministry of Health Sudan (December 2021, reviewed April 2020), '
                       'the whole guide word for word: the facilitator\'s role, the checklists of materials, the procedures and feedback '
                       'for every module (Introduction, Assess and classify, Identify treatment, Treat the child, Counsel the mother, '
                       'Charting, Sick young infant, Follow-up), the answers to the exercises, the demonstration scripts, the guidelines '
                       'for all modules and the course forms.',
    },
    'modules': modules, 'exercises': [],
}
json.dump(pkg, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"{os.path.basename(OUT)}: {len(modules)} chapters, {sum(len(m['sections']) for m in modules)} sections, "
      f"{sum(src.values())} words of the guide, {sum(missing.values())} not placed")
for m in modules: print(f"  {m['order']:>2}. {m['title']} — {len(m['sections'])} sections")
if missing: print('MISSING', list(missing.items())[:30]); sys.exit(1)
