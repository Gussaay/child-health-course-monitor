# Writes the transcripts of the Global Health Media Project videos (made by faster-whisper, one JSON per
# video: segments with start/end times) to one Word file: per video its length, the skills it shows with
# their start and end times (from videos.json, where the lessons take them from), and the narration with
# a time for each line.
#   python3 transcripts_docx.py <transcripts folder> <out.docx>
import json, os, sys
import docx
from docx.shared import Pt, RGBColor

HERE = os.path.dirname(os.path.abspath(__file__))

def clock(sec):
    s = int(sec)
    return f'{s // 60}:{s % 60:02d}'

def main(folder, out):
    vj = json.load(open(os.path.join(HERE, 'videos.json')))
    # the skills each lesson points to, by video name: the slot videos (videos.json "videos") and the extra
    # lesson videos (books/ghm.py EXTRA, chapters in videos.json "extra_chapters")
    from books.ghm import EXTRA
    skills = {}
    for v in vj.get('videos', {}).values():
        for c in v.get('chapters', []):
            skills.setdefault(v['title'].split(' - ')[0].strip(), set()).add(tuple(c))
    for _, _, _, vid, title in EXTRA:
        for c in vj.get('extra_chapters', {}).get(vid, []):
            skills.setdefault(title.split(' - ')[0].strip(), set()).add(tuple(c))
    skills = {k: sorted(v) for k, v in skills.items()}
    d = docx.Document()
    st = d.styles['Normal']; st.font.name = 'Calibri'; st.font.size = Pt(10.5)
    d.add_heading('Global Health Media Project videos: transcripts and skill times', 0)
    d.add_paragraph('The narration of each video used in the Sick & Small Newborn online course, transcribed automatically '
                    '(Whisper, English) from the files downloaded under GHMP\'s Level 1 licence, with the time each line is '
                    'spoken. "Skills" are the parts the lessons point to: the lesson\'s "jump to the skill" button plays the '
                    'whole video from the start time and pauses at the end time. The videos are not cut.')
    files = sorted(f for f in os.listdir(folder) if f.endswith('.json'))
    for f in files:
        t = json.load(open(os.path.join(folder, f)))
        name = os.path.splitext(t['file'])[0]
        d.add_heading(name, 1)
        d.add_paragraph(f"Length {clock(t['duration'])}.")
        rows = skills.get(name, [])
        if rows:
            tab = d.add_table(rows=1, cols=3); tab.style = 'Light Grid Accent 1'
            for i, h in enumerate(['Start', 'End', 'Skill (lesson button)']): tab.rows[0].cells[i].text = h
            for a, b, lab in rows:
                r = tab.add_row().cells; r[0].text = clock(a); r[1].text = clock(b); r[2].text = lab
            d.add_paragraph()
        for s in t['segments']:
            p = d.add_paragraph()
            run = p.add_run(f"{clock(s['start'])}  "); run.font.color.rgb = RGBColor(0x64, 0x74, 0x8B); run.font.size = Pt(9)
            p.add_run(s['text'])
            p.paragraph_format.space_after = Pt(1)
    d.save(out)
    print(f'{len(files)} transcripts -> {out}')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
