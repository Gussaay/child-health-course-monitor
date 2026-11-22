# The ETAT facilitator guide (WHO 2005), word for word, as a guide document:
# chapters and sections from its own table of contents, text page by page.
#   python3 etat.py            writes course-packages/sudan-etat-facilitator-guide.imnci.json
import json, os, re, sys
from layout import blocks_of, words, esc

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
SRC = os.path.join(ROOT, 'scripts', 'etat-upload', 'build', 'sources', 'fg.txt')
OUT = os.path.join(ROOT, 'course-packages', 'sudan-etat-facilitator-guide.imnci.json')
OFFSET = 5            # PDF page = printed page + 5
TOC_PAGES = [4, 5]    # PDF pages of the table of contents
FIRST = 3             # PDF page 3 (acknowledgements); 1 and 2 are the covers
HEAD = 'EMERGENCY TRIAGE ASSESSMENT AND TREATMENT'

pages = open(SRC, encoding='utf-8').read().split('\f')
norm = lambda s: ' '.join(words(s))

def clean(lines):
    """A page without its running head and page number."""
    lines = [l.rstrip() for l in lines]
    nb = [i for i, l in enumerate(lines) if l.strip()]
    if nb:
        h = lines[nb[0]]
        if h.strip() == HEAD or (h.strip().upper() == h.strip() and len(h) - len(h.lstrip()) > 40 and len(h.strip()) > 3):
            lines[nb[0]] = ''
        f = lines[nb[-1]].strip()
        if re.fullmatch(r'[0-9]{1,3}|[IVXL]{1,6}', f):
            lines[nb[-1]] = ''
    return lines

# ---- table of contents -> [(level, title, pdf page)]
toc = []
for p in TOC_PAGES:
    raw = [l.rstrip() for l in pages[p - 1].split('\n')]
    entries, carry = [], None
    for l in raw:
        if not l.strip() or l.strip() in ('Table of contents', HEAD) or re.fullmatch(r'\s*[IVX]+', l): continue
        m = re.match(r'^(\s*)(.+?)\s{2,}(\d+)$', l)
        if m:
            ind, title, num = m.groups(); ind = len(ind)
            if carry and carry[0] == ind: ind, title = carry[0], carry[1] + ' ' + title.strip(); carry = None
            elif carry: entries.append([carry[0], carry[1], None]); carry = None
            entries.append([ind, re.sub(r'\s+', ' ', title.strip()), int(num) + OFFSET])
        else:
            if carry: entries.append([carry[0], carry[1], None]); carry = None
            carry = (len(l) - len(l.lstrip()), l.strip())
    if carry: entries.append([carry[0], carry[1], None])
    indents = sorted({e[0] for e in entries})
    for ind, title, pg in entries:
        toc.append((indents.index(ind) + 1, title, pg))

# "Annexes" has no page: each annex is a chapter of its own.
chapters = []
for lvl, title, pg in toc:
    if lvl == 1 and pg is None: continue
    if lvl == 1 or (lvl == 2 and title.startswith('Annex ')):
        chapters.append({'title': title, 'page': pg, 'entries': []})
    else:
        chapters[-1]['entries'].append((lvl, title, pg))
chapters.insert(0, {'title': 'Acknowledgements and publication data', 'page': FIRST, 'entries': []})

# ---- every body line, with its page
stream = []   # (pdf page, line)
for pg in range(FIRST, len(pages) + 1):
    if pg in TOC_PAGES: continue
    for l in clean(pages[pg - 1].split('\n')):
        stream.append((pg, l))

def find(title, page, start):
    """Index in stream of the line(s) printing `title`, on its page (or the next), at or after `start`."""
    want = norm(title)
    for i in range(start, len(stream)):
        if stream[i][0] < page: continue
        if stream[i][0] > page + 1: break
        for k in range(1, 5):
            got = norm(' '.join(l for _, l in stream[i:i + k] if l.strip()))
            if got == want: return i, k
            if not want.startswith(got): break
    return None

notes, marks, pos = [], [], 0      # marks: (stream index, lines used, kind, chapter no, title)
for ci, ch in enumerate(chapters):
    hit = find(ch['title'], ch['page'], pos) if ci else None
    if not hit:
        if ci and not ch['title'].startswith('Annex'): notes.append(f"chapter title not found printed: {ch['title']} (p{ch['page']})")
        hit = (next(i for i in range(pos, len(stream)) if stream[i][0] >= ch['page']), 0)
    marks.append((hit[0], hit[1], 'chapter', ci, ch['title'])); pos = hit[0] + hit[1]
    for lvl, title, pg in ch['entries']:
        h = find(title, pg, pos)
        if not h:
            if title not in ('Module overview', 'Objectives', 'Materials'): notes.append(f"heading not found printed: {title} (p{pg})")
            continue
        marks.append((h[0], h[1], 'section' if lvl == 2 else 'heading', ci, title)); pos = h[0] + h[1]

# ---- cut the stream at the marks
modules = []
for mi, (at, used, kind, ci, title) in enumerate(marks):
    end = marks[mi + 1][0] if mi + 1 < len(marks) else len(stream)
    printed = ' '.join(l.strip() for _, l in stream[at:at + used] if l.strip())
    body = [l for _, l in stream[at + used:end]]
    if kind == 'chapter':
        modules.append({'title': title, 'order': len(modules) + 1, 'sections': []})
        sec = {'title': title, 'read': []}
        modules[-1]['sections'].append(sec)
        if printed and norm(printed) != norm(title): sec['read'].append({'type': 'heading', 'text': (printed)})
    elif kind == 'section':
        sec = {'title': title, 'read': []}
        modules[-1]['sections'].append(sec)
        if printed and printed != title: sec['read'].append({'type': 'heading', 'text': (printed)})
    else:
        modules[-1]['sections'][-1]['read'].append({'type': 'heading', 'text': (printed)})
    modules[-1]['sections'][-1]['read'] += blocks_of(body)

for m in modules:
    m['sections'] = [s for s in m['sections'] if s['read'] or len(m['sections']) == 1]
    for k, s in enumerate(m['sections'], 1):
        s.update(order=k, see=[], practise=[])
        if not s['read']: s['read'] = [{'type': 'paragraph', 'text': (s['title'])}]

# ---- word check: every word of the pages is in the guide, as often
from collections import Counter
src = Counter(w for _, l in stream for w in words(esc(l)))
got = Counter(w for m in modules for s in m['sections'] for b in s['read'] for w in words(b.get('text', '')))
got_titles = Counter(w for m in modules for s in m['sections'] for w in words(esc(s['title'])))
missing = src - (got + got_titles)
pkg = {
    'format': 'imnci-course-package', 'version': 1,
    'about': 'Emergency Triage Assessment and Treatment (ETAT) Facilitator Guide, WHO 2005: the whole guide, word for word, '
             'chapters and sections from its table of contents. Built by scripts/facilitator-guides/etat.py.',
    'course': {
        'title': 'ETAT: facilitator guide', 'audience': 'facilitators', 'lockOrder': False, 'category': 'ETAT',
        'description': 'Emergency Triage Assessment and Treatment (ETAT) Facilitator Guide (WHO, 2005), the whole guide word for word: '
                       'preparing the course, guidelines for all chapters, each module day by day with its timetable, drills and '
                       'exercises, and the annexes (agenda, supplies, checklists, answers to the assessment questions, evaluation).',
    },
    'modules': modules, 'exercises': [],
}
json.dump(pkg, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"{os.path.basename(OUT)}: {len(modules)} chapters, {sum(len(m['sections']) for m in modules)} sections, "
      f"{sum(src.values())} words of the guide, {sum(missing.values())} not placed")
for m in modules: print(f"  {m['order']:>2}. {m['title']} — {len(m['sections'])} sections")
for n in notes: print('NOTE', n)
if missing: print('MISSING', list(missing.items())[:30]); sys.exit(1)
