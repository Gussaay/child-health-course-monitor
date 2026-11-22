# The facilitator guide (Sudan Training Course on Management of Sick and Small Newborns 2026, 311 pages)
# as a course for facilitators (audience "facilitators": read in Protocol management → Facilitator
# guides, hidden from learners). One app module per chapter; Chapter 3 (Resuscitation of the
# non-breathing baby) is left out, as the online Module 1 is the manual without resuscitation.
# Each chapter opens with a link to the learners' module it teaches.
#   python3 extract_pdf.py <guide.pdf> fg sources/fgdoc.json <scratch dir>   (text only is used)
#   python3 fgbuild.py ../../..
import json, os, re, sys
from src import pdf_items
from assemble import modules_of, to_blocks, split_long, strip_num
from build import finish, ERRORS, HERE
import build
from lib import courselink
from books.titles import M1, M2, M3

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', '..')
E = json.load(open(os.path.join(HERE, 'sources', 'fgdoc.json')))
FURN = re.compile(r'^(FACILITATOR GUIDE Sudan Training Course.*|\d+ \| Page)$')
RESUS = (548, 960)       # Chapter 3, Resuscitation of the non-breathing baby: not in this course
COVER = (0, 30)          # cover and contents pages

skip = {}
els = []
for e in E:
    i = e['i']
    if COVER[0] <= i <= COVER[1]: skip[i] = 'cover and contents'; continue
    if RESUS[0] <= i <= RESUS[1]: skip[i] = 'Chapter 3, resuscitation (not in this course)'; continue
    if e['k'] == 'img': skip[i] = 'decoration'; continue
    if e['k'] == 'line' and FURN.match(e['t'].strip()): skip[i] = 'running header / page number'; continue
    e = dict(e)
    if e['k'] == 'line' and e['b'] and e['size'] == 16:
        t = e['t'].strip()
        if re.match(r'^\d+\.\s', t) or t == 'Annex':
            e.update(font='Britannic', size=26)          # a chapter: an app module
        else:
            e.update(font='Britannic', size=20)          # a part title ("Module (1) …", "How to Use This Guide"): a heading
    elif e['k'] == 'line' and e['b'] and e['size'] == 13:
        e.update(font='Britannic', size=16)              # "2.1 …": a lesson
    els.append(e)

items = pdf_items(els, lvl_base=54)
pre, mods = modules_of(items)
# what comes before Chapter 1 ("How to Use This Guide", "Introduction & Training Framework") opens Chapter 1
LINKS = {
    '1': [courselink(M2, 1, None, 'Learners\' course · Module 2, Neonatal Health System')],
    '2': [courselink(M1, 1, None, 'Learners\' course · Module 1, The Golden Minute of Life')],
    '4': [courselink(M1, 3, None, 'Learners\' course · Module 1, Assess, Identify and Refer')],
    '5': [courselink(M1, 2, None, 'Learners\' course · Module 1, Selected Neonatal Emergencies')],
    '6': [courselink(M1, 3, 'Referring a newborn: why it must be organised', 'Learners\' course · Module 1, Referring a newborn')],
    '7': [courselink(M2, 2, None, 'Learners\' course · Module 2, Triage'), courselink(M2, 3, None, 'Learners\' course · Module 2, Admission'),
          courselink(M2, 4, None, 'Learners\' course · Module 2, The Golden Hour')],
    '8': [courselink(M2, 5, None, 'Learners\' course · Module 2, Care of the Premature Baby'), courselink(M2, 6, None, 'Learners\' course · Module 2, Kangaroo Mother Care')],
    '9': [courselink(M2, 5, 'Jaundice: physiological or pathological?', 'Learners\' course · Module 2, Jaundice')],
    '10': [courselink(M2, 8, None, 'Learners\' course · Module 2, Neonatal Sepsis')],
    # Procedures and equipment have no module of their own: each SOP sits inside the lessons that use it (books/sops.py).
    '11': [courselink(M2, 8, 'Treating neonatal sepsis', 'Learners\' course · Lumbar puncture, in Module 2 Neonatal Sepsis'),
           courselink(M1, 2, 'Shock: fluids, signs of improvement and antibiotics', 'Learners\' course · UVC and intraosseous access, in Module 1 Shock'),
           courselink(M2, 4, 'Supporting and monitoring the circulation', 'Learners\' course · Umbilical catheters, in Module 2 The Golden Hour'),
           courselink(M2, 4, 'Surfactant', 'Learners\' course · Endotracheal intubation, in Module 2 Surfactant'),
           courselink(M3, 3, 'Complications of mechanical ventilation', 'Learners\' course · Chest tube, in Module 3 Mechanical Ventilation')],
    '12': [courselink(M2, 4, 'The golden hour, and keeping the baby warm in the SCNU', 'Learners\' course · Radiant warmer, in Module 2 The Golden Hour'),
           courselink(M2, 4, 'Incubator, radiant warmer or cot?', 'Learners\' course · Infant incubator, in Module 2 The Golden Hour'),
           courselink(M3, 2, 'CPAP: how it works and its parts', 'Learners\' course · Vayu bubble CPAP, in Module 3 Non-Invasive Ventilation'),
           courselink(M3, 1, 'Detecting hypoxaemia', 'Learners\' course · Pulse oximeter, in Module 3 Oxygen Therapy'),
           courselink(M2, 5, 'Jaundice: investigations and treatment; retinopathy of prematurity', 'Learners\' course · Phototherapy, in Module 2 Jaundice')],
    '13': [courselink(M2, 7, None, 'Learners\' course · Module 2, Patient Safety')],
    '14': [courselink(M3, 1, None, 'Learners\' course · Module 3, Oxygen Therapy'), courselink(M3, 2, None, 'Learners\' course · Module 3, Non-Invasive Ventilation')],
    '15': [courselink(M3, 3, None, 'Learners\' course · Module 3, Mechanical Ventilation')],
}
out_mods, used = [], set(skip)
for mi, m in enumerate(mods, start=1):
    num = (re.match(r'^(\d+)\.', m['title']) or [None, 'annex'])[1]
    title = {'Care of Sick and Small newborn after 90 minutes of life and refere': 'Care of the sick and small newborn after 90 minutes of life, and referral',
             'Prematurity & low birth weigh': 'Prematurity and low birth weight'}.get(strip_num(m['title']), strip_num(m['title']))
    intro = pre + m['intro'] if mi == 1 else m['intro']
    subs = list(m['subs'])
    lessons = []
    if intro:
        lessons += split_long(f'{title}: overview' if subs else title, to_blocks(intro))
    for s in subs:
        bl = to_blocks(s['items'])
        parts = split_long(strip_num(s['title']), bl) if bl else [{'title': strip_num(s['title']), 'blocks': []}]
        parts[0]['extra_ids'] = list(s['ids'])
        lessons += parts
    for L in lessons:          # an empty subsection (a bare "13.4") is counted as placed, then dropped
        for b in L['blocks']: used.update(b.get('_ids', []))
        used.update(L.get('extra_ids', []))
    lessons = [L for L in lessons if L['blocks']] or lessons
    used.update(m['ids'])
    lessons[0]['blocks'] = [dict(b) for b in LINKS.get(num, [])] + lessons[0]['blocks']
    out_mods.append({'title': title, 'order': mi, 'lessons': lessons, 'ids': m['ids'], 'anyOrder': False})
missing = [e for e in E if e['i'] not in used]
if missing:
    ERRORS.append(f"guide: {len(missing)} elements not placed, e.g. " + ' | '.join(f"#{e['i']} p{e['page']} {(e.get('t') or str(e.get('rows')))[:50]}" for e in missing[:8]))

class CFG:
    COURSE = {'title': 'Sick & Small Newborn: facilitator guide', 'audience': 'facilitators', 'lockOrder': False,
              'category': 'Small & Sick Newborn', 'subcategory': 'Online course: Management of Sick and Small Newborns (2026)',
              'description': 'Facilitator Guide, Sudan Training Course on Management of Sick and Small Newborns (2026), without Chapter 3 '
                             '(resuscitation). For facilitators of the online and face-to-face courses: teaching methods, scripts, '
                             'discussions, cases with answer keys and skills checklists, chapter by chapter, linked to the learners\' modules.'}
    BOOK = 'Facilitator guide, Sudan Training Course on Management of Sick and Small Newborns 2026'
    SHORT = 'SSN FG'
    FILE = 'ssnb-facilitator-guide.imnci.json'

build.ACTIVITY = set()          # a guide for facilitators: no learner activities are required
_orig = build.ERRORS
pkg = finish(CFG, out_mods, [])
build.ERRORS[:] = [e for e in build.ERRORS if not e.startswith('no activity')]
json.dump(pkg, open(os.path.join(ROOT, 'course-packages', CFG.FILE), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"{CFG.FILE}: {len(pkg['modules'])} modules, {sum(len(m['sections']) for m in pkg['modules'])} lessons")
for m in pkg['modules']: print(f"   {m['order']:>2}. {m['title']} — {len(m['sections'])} lessons")
for e in build.ERRORS: print('ERROR', e)
for r in build.REPORT: print('NOTE', r)
sys.exit(1 if build.ERRORS else 0)
