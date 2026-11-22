# Finds where the lesson's skill starts inside each Global Health Media Project video, from the
# narration, and writes it as a "jump to the skill" chapter (the video itself is never cut).
#
#   python3 skilltimes.py <folder of GHMP video files>        (files from globalhealthmedia.org, Level 1 licence)
#
# A file is matched to its video by its GHMP title (e.g. "Keeping-The-Baby-Warm-English.mp4").
# Speech to text: faster-whisper (open source), model small.en, on this machine; nothing is uploaded.
# Each skill is found as the first narration segment containing one of its cue phrases; the chapter
# starts 1 second before it. Results go to videos.json ("chapters") and to skilltimes-report.md for checking.
import json, os, re, sys
from faster_whisper import WhisperModel

HERE = os.path.dirname(os.path.abspath(__file__))
# video id -> (GHMP title words to find the file, [(chapter label, [cue phrases, first match wins])])
SKILLS = {
    'WZz8Yysq5mo': ('preparing the birth room', [('Preparing the newborn resuscitation area', ['resuscitation', 'bag and mask', 'newborn corner'])]),
    '0clo9Lvpv7Y': ('helping babies breathe at birth', [('Drying and stimulating', ['dry the baby', 'drying']), ('Bag and mask ventilation', ['bag and mask', 'ventilat'])]),
    'BAX4gB48Ewk': ('keeping the baby warm', [('How a baby loses heat', ['lose heat', 'loses heat', 'heat loss']), ('Skin-to-skin', ['skin-to-skin', 'skin to skin'])]),
    'hs7ai466toE': ('early initiation of breastfeeding', [('Skin-to-skin and the first feed', ['skin-to-skin', 'skin to skin', 'first hour'])]),
    'MieKJa5YJd4': ('taking a heel blood sample', [('The heel prick', ['heel', 'prick', 'lancet'])]),
    '5xUY7SlGxfM': ('care of the cord', [('Cord care', ['cord', 'clean and dry'])]),
    'y--syZR0u1E': ('breastfeeding attachment', [('Signs of good attachment', ['good attachment', 'well attached', 'signs of'])]),
    '31Fw-XHQdwQ': ('expressing and storing breastmilk', [('Hand expression', ['express', 'hand expression'])]),
    'nhWYqF6lDW4': ('referring a sick baby', [('Preparing for referral', ['refer', 'referral'])]),
    'Ue5iaa8lulM': ('carrying your baby skin-to-skin', [('The kangaroo position', ['position', 'chest', 'skin-to-skin'])]),
    '5FfVjiou_YE': ('taking a venous blood sample', [('Taking the sample', ['vein', 'needle', 'blood'])]),
    'gUOyzA64_iU': ('protecting small babies from infection', [('Hand washing', ['wash your hands', 'handwashing', 'hand washing', 'hand rub'])]),
    '35Sf5_D9kv0': ('cleaning resuscitation equipment', [('Soaking in disinfectant', ['solution', 'chlorine', 'soak'])]),
    '-6T7f40EB9E': ('the cold baby', [('Rewarming the cold baby', ['warm', 'skin-to-skin'])]),
    'VAb_zGqiyZg': ('giving an intramuscular injection', [('The thigh injection', ['thigh', 'inject'])]),
    '8foaEYKfDRo': ('newborn physical exam', [('The examination', ['look at', 'examin'])]),
    '_uhWHZOtq2U': ('the hot baby', [('Cooling the hot baby', ['remove', 'too hot', 'cool'])]),
    'MYCFuEP6Gd4': ('breathing problems', [('Counting the breaths and chest indrawing', ['count', 'indrawing', 'breaths'])]),
    'V2N6MXL3RrE': ('inserting a nasogastric tube', [('Measuring and inserting the tube', ['measure', 'insert'])]),
    'aTjymWCGHdc': ('feeding with a nasogastric tube', [('Giving the feed', ['syringe', 'feed', 'milk'])]),
    'OkhSJ16FHfY': ('cup feeding', [('Cup feeding technique', ['cup', 'lower lip', 'lap'])]),
    'RRV-9Jf0eI0': ('jaundice', [('Looking for jaundice', ['press', 'yellow', 'skin'])]),
    'MdDD9n7Cz-o': ('sepsis', [('Signs of sepsis', ['signs', 'danger sign'])]),
    'Z54GscbV440': ('managing severe infection in newborns', [('The treatment plan', ['gentamicin', 'amoxicillin', 'treatment'])]),
    'exbaCZhzsfo': ('preparing ampicillin and gentamicin', [('Mixing and drawing up the dose', ['mix', 'water', 'vial', 'draw'])]),
}

def norm(s): return re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()

def main(folder):
    files = [f for f in os.listdir(folder) if re.search(r'\.(mp4|m4v|mov|webm|mkv|mp3|m4a|wav)$', f, re.I)]
    model = WhisperModel('small.en', device='cpu', compute_type='int8')
    vpath = os.path.join(HERE, 'videos.json'); vj = json.load(open(vpath))
    report = ['# Skill start times found in the GHMP videos', '', 'Check each one by playing the video from that time; then update the live lessons.', '']
    found = {}
    for vid, (title, skills) in SKILLS.items():
        f = next((x for x in files if norm(title) in norm(x)), None)
        if not f:
            report.append(f'- {title}: no file'); continue
        segs, _ = model.transcribe(os.path.join(folder, f), language='en', vad_filter=True)
        segs = list(segs)
        chapters = []
        for label, cues in skills:
            hit = next((s for s in segs if any(c in s.text.lower() for c in cues)), None)
            if hit:
                at = max(0, int(hit.start) - 1)
                chapters.append([at, label])
                report.append(f'- **{title}** — {label}: {at // 60}:{at % 60:02d}  (narration: "{hit.text.strip()[:110]}")')
            else:
                report.append(f'- **{title}** — {label}: not found in the narration')
        if chapters: found[vid] = chapters
    # write into videos.json: the slot videos by code, the extra lesson videos by id
    for code, v in vj['videos'].items():
        if v['id'] in found: v['chapters'] = found[v['id']]
    vj['extra_chapters'] = {vid: ch for vid, ch in found.items()}
    json.dump(vj, open(vpath, 'w'), ensure_ascii=False, indent=1)
    open(os.path.join(HERE, '..', 'skilltimes-report.md'), 'w').write('\n'.join(report) + '\n')
    print('\n'.join(report))

if __name__ == '__main__':
    main(sys.argv[1])
