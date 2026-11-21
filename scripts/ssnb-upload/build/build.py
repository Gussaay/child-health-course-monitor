# Builds the three Sick & Small Newborn course files from the manuals:
#   course-packages/ssnb-module-1-emergency-newborn-care.imnci.json  (etc.)
# One online course per manual module; one app module per manual Section;
# one lesson per subsection (long ones cut at their headings).
#
#   python3 build.py ../../..        (repo root)
# Stops (exit 1) when a line of a manual is not placed, a lesson has no
# activity, an exercise or figure is missing, an answer index is wrong, or an
# exercise id repeats.
import copy, html, importlib, json, os, re, sys
from collections import Counter
from src import book_items, load
from assemble import to_blocks, split_long, modules_of, strip_num, chars, esc
from fg import answer_key
import lib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', '..')
FIGS = os.path.join(HERE, '..', 'figures')
VIDEOS = (json.load(open(os.path.join(HERE, 'videos.json'))).get('videos', {})) if os.path.exists(os.path.join(HERE, 'videos.json')) else {}
ACTIVITY = {'question', 'reveal', 'flip', 'sort', 'steps', 'story', 'calc', 'exercise', 'video', 'reflect', 'drill', 'scenario', 'spot', 'classcards'}
ERRORS, REPORT = [], []
LETTER = re.compile(r'^\(?([A-Ha-h])[.)]$')
CORRECT = re.compile(r'^Correct\s+answer\s*:?\s*\(?([A-Ha-h])\)?\.?\s*$', re.I)

# ------------------------------------------------------------ book MCQs
def mcqs(items):
    """Book MCQs ("question / A. .. D. / Correct answer: C") -> one question block each, words unchanged."""
    out, i = [], 0
    while i < len(items):
        it = items[i]
        m = CORRECT.match(it.get('text', '')) if it['type'] in ('p', 'h3') else None
        if not m:
            out.append(it); i += 1; continue
        # options: the letter items just before; question: the paragraph(s) before them
        k = len(out) - 1; opts = []
        while k >= 0 and out[k]['type'] == 'li' and LETTER.match(out[k].get('marker') or ''):
            opts.insert(0, out[k]); k -= 1
        qs = []
        while k >= 0 and out[k]['type'] in ('p', 'h3') and not CORRECT.match(out[k].get('text', '')) and len(qs) < 3:
            qs.insert(0, out[k]); k -= 1
            if qs[0]['text'].rstrip().endswith(('?', ':')) or len(qs[0]['text']) > 60: break
        letters = [LETTER.match(o['marker']).group(1).lower() for o in opts]
        if not opts or not qs or m.group(1).lower() not in letters:
            ERRORS.append(f"MCQ not understood near: {it['text']}"); out.append(it); i += 1; continue
        del out[k + 1:]
        out.append({'type': 'q', 'text': ' '.join(x['text'] for x in qs),
                    'options': [f"{o['marker']} {o['text']}" for o in opts], 'answer': letters.index(m.group(1).lower()),
                    'explanation': it['text'], 'ids': [x for y in qs + opts + [it] for x in y['ids']]})
        i += 1
    return out

# ------------------------------------------------------- case exercises
QSPLIT = re.compile(r'(?=\bQ\d+\.\s)')
def cases(items, ctx):
    """A case box of the manual + "Answer in the space provided: Q1. .. Q2. .." ->
    the case stays in the lesson, and an app exercise (written answer, with the
    facilitator guide's answer key) is linked after it."""
    out, i = [], 0
    while i < len(items):
        it = items[i]
        head = it['rows'][0][0] if it['type'] == 'table' and it.get('rows') and it['rows'][0] else ''
        if not re.search(r'EXERCISE', head.replace(' ', '').upper()):
            out.append(it); i += 1; continue
        title = re.sub(r'\s+', ' ', head.split('\n')[0])
        title = re.sub(r'^(CASE|PRACTICAL)\s*E\s*X\s*E\s*R\s*C\s*I\s*S\s*E\s*', '', title.replace('C A S E E X E R C I S E', 'CASE EXERCISE').replace('P R A C T I C A L E X E R C I S E', 'PRACTICAL EXERCISE'), flags=re.I).strip()
        title = re.sub(r'^(CASE|PRACTICAL)\s+EXERCISE\s*', '', title).strip()
        out.append(it)
        j = i + 1; qtexts, ids = [], []
        while j < len(items) and items[j]['type'] in ('img', 'filler'):
            out.append(items[j]); j += 1
        while j < len(items) and items[j]['type'] in ('p', 'h3') and (items[j]['text'].startswith('Answer in the space') or re.match(r'^Q\d+\.', items[j]['text'])):
            qtexts.append(re.sub(r'^Answer in the space provided:\s*', '', items[j]['text'])); ids += items[j]['ids']; j += 1
        qs = [x.strip() for x in QSPLIT.split(' '.join(qtexts)) if x.strip()]
        case_text = [r for row in it['rows'][1:] for r in row if r.strip()] if len(it['rows']) > 1 else []
        ctx['n'] += 1
        eid = f"ssnb-{ctx['key']}-s{ctx['sec']}-ex{ctx['n']}"
        fgt = ctx['fg_titles'].get(title, re.split(r'\s+—\s+', title)[-1])
        title0 = title
        key = answer_key(fgt, used=ctx['fg_used']) if fgt else None
        if key: ctx['fg_used'].add(key[0])
        # an answer range written in books/<key>.py wins over the automatic match (to leave out a facilitator's aside)
        points = ctx['answers'].get(title0) or (key[1] if key else [])
        if not points:
            REPORT.append(f"no answer key in the facilitator guide for: {ctx['key']} Section {ctx['sec']}: {title}")
            points = ['Discuss your answer with your facilitator.']
        lines = [ln.strip() for c in case_text for ln in c.split('\n') if ln.strip()]
        # the title box can run onto a second printed line ("... Rural Health" / "Centre")
        if lines and len(lines[0]) < 30 and not re.search(r'[.:]$', lines[0]) and lines[0][:1].isupper() and len(lines) > 1 and lines[1][:1].isupper():
            title += ' ' + lines.pop(0)
        narrative = []
        for ln in lines:      # printed lines joined back into the case's sentences
            if narrative and not re.search(r'[.:?!;]["”’)]?$', narrative[-1]) and not re.match(r'^(•|●|-|\d+[.)]\s)', ln):
                narrative[-1] += ' ' + ln
            else:
                narrative.append(ln)
        explain = (key[2] if key and key[2] else '')
        qlist = qs or ['Write your answer.']
        # one written answer for the case's questions, then the facilitator guide's answer key
        ex = lib.quiz(eid, ctx['n'], f"{ctx['course_short']} · {re.sub(r'^Exercise \d+ — ', '', title)}", narrative,
                      [lib.open_q('q1', ' '.join(qlist), points, explain)],
                      f"{ctx['book_name']}, Section {ctx['sec']} exercises; answer key: Facilitator guide 2026" + (f' (line {key[0]})' if key else ''), minutes=10)
        ex['draft'] = False
        ctx['exercises'].append(ex)
        out.append({'type': 'ex', 'eid': eid, 'note': title + (' — ' + ' '.join(qs) if qs else ''), 'ids': ids})
        i = j
    return out

# ------------------------------------------------------------------ blocks
def blocks_of(items):
    bl, rest = [], []
    def flush():
        nonlocal rest
        if rest: bl.extend(to_blocks(rest)); rest = []
    for it in items:
        if it['type'] == 'q':
            flush(); bl.append({'type': 'question', 'text': it['text'], 'options': it['options'], 'answer': it['answer'], 'explanation': it['explanation'], '_ids': it['ids']})
        elif it['type'] == 'ex':
            flush(); bl.append({'type': 'exercise', 'exerciseId': it['eid'], 'note': it['note'], '_ids': it['ids']})
        else:
            rest.append(it)
    flush()
    return bl

def find_block(lessons, anchor):
    hits = []
    for L in lessons:
        for bi, b in enumerate(L['blocks']):
            txt = html.unescape(re.sub('<[^>]+>', '', b.get('text', '') or b.get('path', '') or b.get('exerciseId', '')))
            if anchor in txt: hits.append((L, bi))
    return hits

def build_book(key):
    cfg = importlib.import_module(f'books.{key}')
    items, els = book_items(key)
    used = set()
    skip = {}
    for (a, b), why in cfg.SKIP.items():
        for n in range(a, b + 1): skip[n] = why
    items = [it for it in items if not all(x in skip for x in it['ids'])]
    pre, mods = modules_of(items)
    if pre: ERRORS.append(f'{key}: text before the first section not placed: ' + ' | '.join(i.get('text', i['type'])[:40] for i in pre))
    ctx = {'key': key, 'exercises': [], 'fg_used': set(), 'fg_titles': getattr(cfg, 'FG_TITLES', {}), 'answers': getattr(cfg, 'ANSWERS', {}),
           'course_short': cfg.SHORT, 'book_name': cfg.BOOK}
    out_mods = []
    if len(mods) != len(cfg.MODULES):
        ERRORS.append(f'{key}: {len(mods)} sections in the book, {len(cfg.MODULES)} in books/{key}.py'); return None
    for si, (m, mc) in enumerate(zip(mods, cfg.MODULES), start=1):
        ctx['sec'] = si; ctx['n'] = 0
        lessons = []
        subs = list(m['subs'])
        if m['intro']:
            # text under the section title, before its first subsection: its own lesson, or the start of the first
            if mc.get('intro_title'):
                subs.insert(0, {'title': mc['intro_title'], 'ids': [], 'items': m['intro'], 'intro': True})
            elif subs:
                subs[0] = {**subs[0], 'items': m['intro'] + [{'type': 'h1x', 'text': subs[0]['title'], 'ids': subs[0]['ids']}] + subs[0]['items'], 'ids': []}
            else:
                subs = [{'title': mc['title'], 'ids': [], 'items': m['intro']}]
        merged = mc.get('merge', [])
        for sub in subs:
            its = [({**x, 'type': 'h2'} if x['type'] == 'h1x' else x) for x in sub['items']]
            its = cases(mcqs(its), ctx)
            bl = blocks_of(its)
            if sub['ids'] and not sub.get('intro'):
                bl.insert(0, {'type': '_title', '_ids': sub['ids']})
            title = mc.get('titles', {}).get(strip_num(sub['title']), strip_num(sub['title']))
            body = [b for b in bl if b['type'] != '_title']
            parts = split_long(title, body, mc.get('cut', {}).get(title)) if body else [{'title': title, 'blocks': []}]
            parts[0]['extra_ids'] = list(sub['ids'])
            lessons.extend(parts)
        # merges: [title, title, ...] -> one lesson (small subsections on one topic)
        for group in merged:
            first = next(L for L in lessons if L['title'] == group[0])
            for t in group[1:]:
                L = next(L for L in lessons if L['title'] == t)
                first['blocks'] += [{'type': 'heading', 'text': L['title'], '_ids': []}] + L['blocks']
                first.setdefault('extra_ids', []).extend(L.get('extra_ids', []))
                lessons.remove(L)
            if len(group) > 1 and mc.get('merge_titles', {}).get(group[0]): first['title'] = mc['merge_titles'][group[0]]
        for old, new in mc.get('rename', {}).items():
            hit = [L for L in lessons if L['title'] == old]
            if not hit: ERRORS.append(f"{key} S{si}: no lesson titled {old!r} to rename")
            for L in hit: L['title'] = new
        # splits: (anchor, new title): a lesson is cut just before the block holding the anchor
        for anchor, new_title in mc.get('split', []):
            hits = find_block(lessons, anchor)
            if len(hits) != 1:
                ERRORS.append(f"{key} S{si}: split anchor {'not found' if not hits else 'found %d times' % len(hits)}: {anchor!r}"); continue
            L, bi = hits[0]
            k = lessons.index(L)
            lessons.insert(k + 1, {'title': new_title, 'blocks': L['blocks'][bi:], 'extra_ids': []})
            L['blocks'] = L['blocks'][:bi]
        # inserts: activities, videos, links, after the block holding the anchor text
        for ins in mc.get('add', []):
            anchor, blocks = ins[0], ins[1] if isinstance(ins[1], list) else [ins[1]]
            hits = find_block(lessons, anchor)
            if len(hits) != 1:
                ERRORS.append(f"{key} S{si}: anchor {'not found' if not hits else 'found %d times' % len(hits)}: {anchor!r}"); continue
            L, bi = hits[0]
            L['blocks'][bi + 1:bi + 1] = [copy.deepcopy(b) for b in blocks]
        from books.ghm import EXTRA, ghm
        for book, sec, anchor, vid, vtitle in EXTRA:
            if book != key or sec != si: continue
            hits = find_block(lessons, anchor)
            if len(hits) != 1: ERRORS.append(f"{key} S{si}: GHMP video anchor not found once: {anchor!r}"); continue
            L, bi = hits[0]
            L['blocks'].insert(bi + 1, ghm(vid, vtitle))
        ctx['exercises'].extend(mc.get('exercises', []))
        out_mods.append({'title': mc['title'], 'order': si, 'lessons': lessons, 'ids': m['ids'], 'anyOrder': mc.get('anyOrder', False)})
    # ---- coverage
    for mm in out_mods:
        used.update(mm['ids'])
        for L in mm['lessons']:
            used.update(L.get('extra_ids', []))
            for b in L['blocks']: used.update(b.get('_ids', []))
    missing = [e for e in els if e['i'] not in used and e['i'] not in skip]
    if missing:
        ERRORS.append(f"{key}: {len(missing)} elements of the book not placed, e.g. " + ' | '.join(f"#{e['i']} p{e.get('page','')} {(e.get('t') or e.get('name') or str(e.get('rows')))[:50]}" for e in missing[:8]))
    return cfg, out_mods, ctx['exercises'], els, used

def finish(cfg, out_mods, exercises):
    """Course package; private keys dropped; checks."""
    pkg = {'format': 'imnci-course-package', 'version': 1,
           'about': f"{cfg.BOOK}: Sudan Training Manual for Sick and Small Newborn (2026). Built by scripts/ssnb-upload/build. "
                    "One module per manual section; every line of the manual is placed in the book's words and order.",
           'course': cfg.COURSE, 'modules': [], 'exercises': exercises}
    ids = Counter(e['id'] for e in exercises)
    for i, n in ids.items():
        if n > 1: ERRORS.append(f'exercise id repeats: {i}')
    exid = set(ids)
    for mm in out_mods:
        secs = []
        for li, L in enumerate(mm['lessons'], start=1):
            read = []
            for b in L['blocks']:
                if b['type'].startswith('_'): continue
                b = {k: v for k, v in b.items() if not k.startswith('_')}
                if b['type'] == 'video' and not b.get('url') and VIDEOS.get(b.get('script')):
                    v = VIDEOS[b['script']]      # a GHMP video fills the slot: its own title, the slot's code kept
                    b['url'] = f"https://www.youtube.com/watch?v={v['id']}"
                    b['title'] = v['title']
                    b['caption'] = 'Global Health Media Project (globalhealthmedia.org), shown whole as published on their YouTube channel.'
                    # "chapters": [[seconds, "label"], ...] — buttons that jump to the skill inside the whole video
                    # (GHMP's terms do not allow clipping, so the video is never cut; it can be started at the skill).
                    if v.get('chapters'): b['chapters'] = [{'at': int(at), 'label': lab} for at, lab in v['chapters']]
                read.append(b)
            where = f"{cfg.SHORT} · {mm['title']} · {L['title']}"
            # a video placeholder (no link yet) is not an activity in the app (activityKeys.js)
            if not any(b['type'] in ACTIVITY and not (b['type'] == 'video' and not b.get('url')) for b in read): ERRORS.append(f'no activity: {where}')
            for b in read:
                if b['type'] in ('paragraph', 'heading', 'rich', 'note') and not str(b.get('text', '')).strip(): ERRORS.append(f'empty {b["type"]}: {where}')
                if b['type'] == 'question' and not (0 <= b['answer'] < len(b['options'])): ERRORS.append(f'answer out of range: {where}')
                if b['type'] == 'exercise' and b['exerciseId'] not in exid: ERRORS.append(f"missing exercise {b['exerciseId']}: {where}")
                if b['type'] == 'image' and not os.path.exists(os.path.join(FIGS, b['path'].split('/', 1)[1])): ERRORS.append(f"missing figure {b['path']}")
            n = len(read)
            if n > 24: REPORT.append(f'long lesson ({n} blocks): {where}')
            secs.append({'title': L['title'], 'order': li, 'read': read, 'see': [], 'practise': []})
        mod = {'title': mm['title'], 'order': mm['order'], 'sections': secs}
        if mm['anyOrder']: mod['anyOrder'] = True
        pkg['modules'].append(mod)
    return pkg

def main():
    keys = sys.argv[2:] or ['m1', 'm2', 'm3']
    for key in keys:
        r = build_book(key)
        if not r: continue
        cfg, mods, exs, els, used = r
        annex = getattr(cfg, 'ANNEX', None); apkg = None
        if annex:
            amods = [m for m in mods if m['order'] in annex['sections']]
            mods = [m for m in mods if m['order'] not in annex['sections']]
            for k, m in enumerate(mods, 1): m['order'] = k
            for k, m in enumerate(amods, 1): m['order'] = k; m['anyOrder'] = True
            acfg = type('A', (), {'COURSE': annex['course'], 'BOOK': cfg.BOOK + ', Sections 7 and 8', 'SHORT': 'SSN Annex', 'FILE': annex['file']})
            apkg = finish(acfg, amods, [])
            json.dump(apkg, open(os.path.join(ROOT, 'course-packages', annex['file']), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            print(f"{annex['file']}: {len(apkg['modules'])} modules, {sum(len(m['sections']) for m in apkg['modules'])} lessons, "
                  f"{sum(1 for m in apkg['modules'] for s in m['sections'] for b in s['read'] if b['type'] == 'video')} video slots")
        pkg = finish(cfg, mods, exs)
        # word-loss check: every word of the book's elements should be somewhere in the course (lessons or exercises)
        text = html.unescape(re.sub(r'</?[a-z][a-z0-9]*[^<>]*>', ' ', json.dumps([pkg, apkg], ensure_ascii=False))).lower()
        have = set(re.findall(r"[a-z]{3,}", text))
        book = []
        for e in els:
            if e['i'] in used and e['k'] in ('line', 'para'): book += re.findall(r"[a-z]{3,}", e['t'].lower())
            if e['i'] in used and e['k'] == 'table': book += [w for r in e['rows'] for c in r for w in re.findall(r"[a-z]{3,}", c.lower())]
        lost = sorted({w for w in book if w not in have})
        print(f"   word check: {len(book)} words of the book, {len(lost)} distinct words not found" + (': ' + ' '.join(lost[:30]) if lost else ''))
        out = os.path.join(ROOT, 'course-packages', cfg.FILE)
        json.dump(pkg, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        nl = sum(len(m['sections']) for m in pkg['modules'])
        print(f"{cfg.FILE}: {len(pkg['modules'])} modules, {nl} lessons, {len(exs)} exercises, "
              f"{sum(1 for m in pkg['modules'] for s in m['sections'] for b in s['read'] if b['type'] == 'video')} video slots")
        for m in pkg['modules']:
            print(f"   {m['order']:>2}. {m['title']} — {len(m['sections'])} lessons" + (' (reference: any order)' if m.get('anyOrder') else ''))
    for r in REPORT: print('NOTE', r)
    for e in ERRORS: print('ERROR', e)
    sys.exit(1 if ERRORS else 0)

if __name__ == '__main__':
    main()
