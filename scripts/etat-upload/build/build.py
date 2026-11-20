# Builds the course file for the Sudan ETAT course and checks it.
#   python3 build.py <repo>
# Fails if any line of the manual is not placed in the course (page furniture aside),
# if a lesson links a missing exercise or figure, or if an answer index is out of range.
import json, os, re, sys, importlib
import src
HERE = os.path.dirname(os.path.abspath(__file__))
ORDER = ["m1", "m2", "m3", "m4", "m5", "m6", "m7"]
BUILT = [k for k in ORDER if os.path.exists(os.path.join(HERE, f"{k}.py"))]
MODS = [importlib.import_module(k) for k in BUILT]
REPO = sys.argv[1]
OUT = os.path.join(REPO, "course-packages", "sudan-etat-training.imnci.json")
FIG = os.path.join(REPO, "scripts", "etat-upload", "figures")

pkg = {
    "format": "imnci-course-package", "version": 1,
    "about": ("Sudan ETAT Training: the WHO Emergency Triage Assessment and Treatment course as self-study lessons, in the order, "
              "methods and timetable of the WHO ETAT facilitator guide (Day 1 to Day 4, Modules 1 to 7). The text of the WHO ETAT "
              "manual for participants (2005) is kept word for word; drills, demonstrations, exercises and case scenarios of the "
              "facilitator guide are activities; the manual's assessment questions are exercises with the facilitator guide's model "
              "answers (Annex 5). The pre-test and post-test are the ETAT pre/post test used in the app's face-to-face courses. "
              "Videos are placeholders (slot codes ET1.1 ...) until the YouTube links are added."),
    "course": {"title": "Sudan ETAT Training",
               "description": "Emergency Triage Assessment and Treatment (ETAT) for sick children: triage, airway and breathing, "
                              "circulation, coma and convulsion, dehydration, case management scenarios and implementing ETAT."},
    "modules": [m.MODULE for m in MODS],
    "exercises": [e for m in MODS for e in m.EXERCISES],
}

VID = json.load(open(os.path.join(HERE, "videos.json")))["videos"]
for m in pkg["modules"]:
    for s_ in m["sections"]:
        for b in s_["read"]:
            if b["type"] == "video" and VID.get(b.get("script")):
                b["url"] = VID[b["script"]].strip()

# ---- lesson restructuring (2026-11-20): no summaries, checks after the text they test, clips next to the text they show
sys.path.insert(0, os.path.join(HERE, "..", "..", "imnci-practice"))
import restructure as R
import clips
print("dropped 'In this lesson' notes:", R.drop_goals(pkg))
print("sentences broken by the page layout joined:", len(R.merge_broken(pkg)))
print("checks moved after their text:", len(R.activities_after_text(pkg)))
print("'Before you start' questions dropped:", len(R.drop_pre_questions(pkg)))
print("repeated checks dropped:", len(R.dedupe_questions(pkg)))
clips.apply(pkg)
for r in R.long_runs(pkg): print("  long reading with no activity:", r)

errors = []
ids = [e["id"] for e in pkg["exercises"]]
if len(ids) != len(set(ids)): errors.append("duplicate exercise ids")
blocks = [b for m in pkg["modules"] for s in m["sections"] for b in s["read"]]
acts = ("reveal", "flip", "sort", "steps", "story", "question", "video", "exercise", "calc")
for m in pkg["modules"]:
    for s in m["sections"]:
        if not any(b["type"] in acts for b in s["read"]): errors.append(f"no activity: {m['title']} / {s['title']}")
for b in blocks:
    if b["type"] == "exercise" and b["exerciseId"] not in ids: errors.append(f"missing exercise {b['exerciseId']}")
    if b["type"] in ("image", "page") and not b["path"].startswith("imnci-photos/") and not os.path.exists(os.path.join(FIG, b["path"].split("/", 1)[1])): errors.append(f"missing figure {b['path']}")
    if b["type"] == "question" and not (0 <= b["answer"] < len(b["options"])): errors.append(f"bad answer: {b['text'][:60]}")
    if b["type"] == "story":
        for st in b["stages"]:
            if st.get("question") and not (0 <= st["answer"] < len(st["options"])): errors.append(f"bad story answer: {st['text'][:60]}")
    if b["type"] in ("paragraph", "heading") and not b["text"].strip(): errors.append("empty text block")
for e in pkg["exercises"]:
    for q in e.get("questions", []):
        if q["type"] == "mcq" and not all(0 <= c < len(q["options"]) for c in q["correct"]): errors.append(f"bad mcq {e['id']} {q['id']}")
used, Ls = src.USED["manual"], src.SRC["manual"]
miss = [i + 1 for i, l in enumerate(Ls) if i + 1 not in used and src.clean(l) and not src.PAGE.match(l)]
if miss:
    runs, start = [], miss[0]
    for a, b in zip(miss, miss[1:] + [None]):
        if b != a + 1: runs.append(f"{start}-{a}" if a != start else str(a)); start = b
    errors.append(f"manual lines not placed: {runs[:40]}")
text = json.dumps(pkg, ensure_ascii=False)
words = lambda s: re.findall(r"[A-Za-z]{3,}", s)
have = set(w.lower() for w in words(text))
import elib
lost = sorted({w.lower() for n in used - elib.SKIPPED for w in words(src.clean(Ls[n - 1]))} - have)
print(f"manual: {len(used)} lines placed; words of placed lines not found in the course: {len(lost)} {lost[:60]}")
if errors:
    print("ERRORS:", *errors, sep="\n  "); sys.exit(1)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(pkg, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
n_sec = sum(len(m["sections"]) for m in pkg["modules"])
print(f"Wrote {OUT}: {len(pkg['modules'])} modules, {n_sec} lessons, {len(pkg['exercises'])} exercises, {len(blocks)} blocks, "
      f"{os.path.getsize(OUT) // 1024} KB")
for m in pkg["modules"]:
    big = [(s["title"], len(s["read"])) for s in m["sections"] if len(s["read"]) > 22]
    print(f"  {m['title']}: {len(m['sections'])} lessons; long lessons: {big}")
print("videos:", [b.get("script") for b in blocks if b["type"] == "video"])
