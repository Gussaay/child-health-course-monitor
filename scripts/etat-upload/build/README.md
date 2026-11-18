# Sudan ETAT Training: how the course file is built

`sources/manual.txt` is the text of the WHO *Emergency Triage Assessment and Treatment (ETAT) manual for
participants* (2005), from `pdftotext -raw`, with a few extraction fixes (lost dashes and hyphens, `90°`).
`sources/fg.txt` is the ETAT facilitator guide (`pdftotext -layout`). Manual PDF page = printed page + 5.

Each module has a Python file, in the order and timetable of the facilitator guide:

| File | Module | Facilitator guide |
|---|---|---|
| m1.py | 1 Triage and the ABCD concept (+ pre-test) | Day 1, 08:00-10:30 |
| m2.py | 2 Airway and breathing | Day 1, 10:30-17:00 |
| m3.py | 3 Circulation (+ Annex 1 vascular access) | Day 2, 08:00-12:45 |
| m4.py | 4 Coma and convulsion (+ Annex 1 nasogastric tube) | Day 2, 14:00-17:00 |
| m5.py | 5 Dehydration | Day 3, 08:00-12:45 |
| m6.py | 6 Case management scenarios (`scenarios.json`, facilitator guide Table B) | Day 3, 14:00-17:00 |
| m7.py | 7 Implementing ETAT (+ Annex 2, post-test, evaluation) | Day 4, 08:00-12:00 |

Book text is placed by line number (`elib.X`, `LI`, `TX`) and never re-worded; tables are rebuilt from the same
words (`mark`). The ETAT charts (Annex 3) are shown as their printed pages (`skip` + `chart`). Exercises use the
facilitator guide's answers (Annex 5). The pre- and post-test are the ETAT Pre/Post Test questions in
`etat_test.json` (the same as the app's face-to-face ETAT test).

Figures: `python3 figures.py <manual.pdf> ../figures` (drawings and charts). Exercise A uses the shared IMCI
photograph booklet (Storage `online-courses/imnci-photos/`).

Video links: put each YouTube link next to its code in `videos.json`, then rebuild. Voice-over scripts:
`python3 voiceover.py ../../../course-packages/sudan-etat-training.imnci.json <out.docx>`.

    python3 build.py ../../..

`build.py` stops if any line of the manual is not placed, if a lesson links an exercise or figure that does
not exist, or if an answer index is out of range. It writes `course-packages/sudan-etat-training.imnci.json`.
Upload with `../upload-etat.cjs` (see `.github/workflows/etat-upload.yml` and `../mode.txt`).
