# Writes the video scripts (videoscripts/m1.py, m2.py, m3.py) to one Word file
# for recording: per video code, where it sits in the course (found in the
# course files), what to film, and the narration. Nothing of this is in the lessons.
#   python3 voiceover.py <out.docx>
import importlib, json, os, sys
import docx
from docx.shared import Pt, RGBColor
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..")
FILES = {'m1': 'ssnb-module-1-essential-emergency-newborn-care', 'm2': 'ssnb-module-2-special-newborn-care', 'm3': 'ssnb-module-3-intensive-newborn-care'}

def where(key):
    out = {}
    # its own course first; a procedure or equipment SOP (Module 2 Sections 7, 8) can sit in Module 1 or 3 too
    paths = [os.path.join(ROOT, 'course-packages', f + '.imnci.json') for f in [FILES[key]] + [v for k, v in FILES.items() if k != key]]
    pkgs = [json.load(open(p)) for p in paths if os.path.exists(p)]
    for pkg in pkgs:
      for m in pkg['modules']:
        for s in m['sections']:
            for b in s['read']:
                if b['type'] == 'video' and b.get('script'):
                    out.setdefault(b['script'], (pkg['course']['title'], f"{pkg['course']['title'].split('· ')[-1]} → Module {m['order']}: {m['title']}", s['title'], b.get('url', '')))
    return out

def main(out):
    d = docx.Document()
    st = d.styles['Normal']; st.font.name = 'Calibri'; st.font.size = Pt(11)
    d.add_heading('Sick & Small Newborn online course: video scripts', 0)
    d.add_paragraph('One script per video slot in the online course. Each slot shows as a "being recorded" player in the lesson, '
                    'right after the text the video shows, until its YouTube link is added (scripts/ssnb-upload/build/videos.json). '
                    'Narration lines are the manual\'s own words; lines marked (FG) come from the facilitator guide.')
    total = 0
    for key in ('m1', 'm2', 'm3'):
        try:
            mod = importlib.import_module(f'videoscripts.{key}')
        except ModuleNotFoundError:
            continue
        loc = where(key)
        d.add_heading({'m1': 'Module 1: Essential and Emergency Newborn Care', 'm2': 'Module 2: Special Newborn Care', 'm3': 'Module 3: Intensive Newborn Care'}[key], 1)
        for code, v in mod.S.items():
            total += 1
            d.add_heading(f"{code} · {v['title']}", 2)
            c, m, l, url = loc.get(code, ('', '', 'NOT PLACED IN A LESSON', ''))
            p = d.add_paragraph(); r = p.add_run('Where: '); r.bold = True; p.add_run(f'{m} → lesson "{l}"')
            p = d.add_paragraph(); r = p.add_run('Length: '); r.bold = True; p.add_run(v.get('length', '2–3 minutes'))
            if url:
                p = d.add_paragraph(); r = p.add_run('Link: '); r.bold = True; p.add_run(url)
            d.add_paragraph().add_run('What to film').bold = True
            for f in v['film']: d.add_paragraph(f, style='List Bullet')
            d.add_paragraph().add_run('Narration').bold = True
            for n, line in enumerate(v['narration'], 1): d.add_paragraph(line, style='List Number')
            if v.get('note'):
                p = d.add_paragraph(); r = p.add_run('Note for review: ' + v['note']); r.italic = True; r.font.color.rgb = RGBColor(0xB4, 0x53, 0x09)
    d.save(out)
    print(f'{total} scripts -> {out}')

if __name__ == '__main__':
    main(sys.argv[1])
