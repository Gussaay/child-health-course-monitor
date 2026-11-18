# Builds the course file for the classic Sudan IMNCI course (Modules 1 to 7) and checks it.
#   python3 build.py <repo>
import json, os, re, sys, itertools
import importlib
import src
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "imnci-practice"))
import practice   # shared practice cases, colour cards, drills, module endings (see ../../imnci-practice)
# Modules in course order; a module is built once its .py file exists.
ORDER = ["intro", "ac", "it", "tr", "cm", "yi", "fu"]   # facilitator guide order: young infant before follow-up
HERE = os.path.dirname(os.path.abspath(__file__))
BUILT = [k for k in ORDER if os.path.exists(os.path.join(HERE, f"{k}.py"))]
MODS = [importlib.import_module(k) for k in BUILT]
REPO = sys.argv[1]
OUT = os.path.join(REPO, "course-packages", "sudan-imnci-classic-modules-1-3.imnci.json")
FIG = os.path.join(REPO, "scripts", "imnci-classic-upload", "figures")
PHOTOS = os.path.join(REPO, "scripts", "imnci-classic-upload", "photos")

pkg = {
    "format": "imnci-course-package", "version": 1,
    "about": ("The Sudan IMNCI course (classic, face-to-face course) as self-study lessons: Module 1 Introduction, Module 2 Assess and "
              "classify the sick child age 2 months up to 5 years, Module 3 Identify treatment, Module 4 Treat the child, Module 5 "
              "Counsel the mother, Module 6 Management of the sick young infant, Module 7 Follow-up (Sudan National Child Health "
              "Program books, 2023). Photographs come from the IMNCI photograph booklet in Protocol management. The book text is kept word for word, in the order and with the activities of the facilitator guide "
              "(December 2021): demonstrations and facilitator points as notes, drills as flip cards, exercises in the exercise "
              "manager. Videos are placeholders until the narration is recorded."),
    "course": {"title": "Sudan IMNCI course",
               "description": "The Sudan national IMNCI course, in the order of the national facilitator guide, with the national module text."},
    "modules": practice.enrich([m.MODULE for m in MODS], practice.classic_plans()),
    "exercises": [e for m in MODS for e in m.EXERCISES],
}

# ---- video links (videos.json: code -> YouTube link)
VID = json.load(open(os.path.join(HERE, "videos.json")))["videos"]
for m in pkg["modules"]:
    for s_ in m["sections"]:
        for b in s_["read"]:
            if b["type"] == "video" and VID.get(b.get("script")):
                b["url"] = VID[b["script"]].strip()

# ---- checks
errors = []
ids = [e["id"] for e in pkg["exercises"]]
if len(ids) != len(set(ids)): errors.append("duplicate exercise ids")
blocks = [b for m in pkg["modules"] for s in m["sections"] for b in s["read"]]
for b in blocks:
    if b["type"] == "exercise" and b["exerciseId"] not in ids: errors.append(f"missing exercise {b['exerciseId']}")
    if b["type"] in ("image", "page") and b.get("path"):
        root, name = b["path"].split("/", 1)
        if not os.path.exists(os.path.join(PHOTOS if root == "imnci-photos" else FIG, name)): errors.append(f"missing figure {b['path']}")
    if b["type"] == "question" and not all(0 <= a < len(b["options"]) for a in (b.get("answers") or [b.get("answer", -1)])): errors.append(f"bad answer: {b['text'][:60]}")
for e in pkg["exercises"]:
    for q in e.get("questions", []):
        if q["type"] == "mcq" and not all(0 <= c < len(q["options"]) for c in q["correct"]): errors.append(f"bad mcq {e['id']} {q['id']}")
for mod in BUILT:
    used, L = src.USED[mod], src.SRC[mod]
    miss = [i + 1 for i, l in enumerate(L) if i + 1 not in used and l.strip() and not src.PAGE.match(l) and l.strip() not in (".",)]
    if miss: errors.append(f"{mod}: book lines not placed: {miss[:20]}")
# every word of the book text placed with T() must be in the course (spot check: all words of used lines, as a multiset ratio)
text = json.dumps(pkg, ensure_ascii=False)
words = lambda s: re.findall(r"[A-Za-z]{3,}", s)
have = set(w.lower() for w in words(text))
for mod in BUILT:
    lost = sorted({w.lower() for n in src.USED[mod] for w in words(src.clean(src.SRC[mod][n - 1]))} - have)
    print(f"{mod}: {len(src.USED[mod])} lines placed; book words not found in the course: {len(lost)} {lost[:40]}")
if errors:
    print("ERRORS:", *errors, sep="\n  "); sys.exit(1)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(pkg, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
n_sec = sum(len(m["sections"]) for m in pkg["modules"])
print(f"Wrote {OUT}: {len(pkg['modules'])} modules, {n_sec} lessons, {len(pkg['exercises'])} exercises, {len(blocks)} blocks, "
      f"{os.path.getsize(OUT) // 1024} KB")
for m in pkg["modules"]:
    big = [(s["title"], len(s["read"])) for s in m["sections"] if len(s["read"]) > 25]
    print(f"  {m['title']}: {len(m['sections'])} lessons; long lessons: {big}")
vids = [b for b in blocks if b["type"] == "video"]
print("videos:", [b.get("script") for b in vids])
