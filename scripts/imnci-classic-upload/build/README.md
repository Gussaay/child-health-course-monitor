# Sudan IMNCI classic course: how the course file is built

`sources/*.txt` is the text of the 2023 national module books (`pdftotext -layout`), and `sources/fg.txt` the
facilitator guide (Dec 2021). Each module has a Python file, in course order:

| File | Module |
|---|---|
| intro.py | 1 Introduction |
| ac.py | 2 Assess and classify the sick child |
| it.py | 3 Identify treatment |
| tr.py | 4 Treat the child |
| cm.py | 5 Counsel the mother |
| yi.py | 6 Management of the sick young infant (the facilitator guide teaches it before Follow-up) |
| fu.py | 7 Follow-up |

Modules 1 to 3 place line ranges by hand (`src.T`, `src.layout`). Modules 4 to 7 use `auto.A`, which places prose
word for word and keeps tables, chart boxes and forms in their printed layout; pages whose drawings carry content
(`figpages.json`) are shown as page pictures from `../figures/`. Exercises use the facilitator guide's answers.

Photographs point at the photograph booklet (`../photos/photo-NN.jpg`, Storage `online-courses/imnci-photos/`),
which is also shown in Protocol management → Photograph booklet (`src/components/imnci/photoBooklet.json`).

Video links: put each YouTube link next to its code in `videos.json`, then rebuild.

    python3 build.py ../../..

`build.py` stops if any line of the books is not placed in the course, if a lesson links an exercise, figure or
photograph that does not exist, or if an answer index is out of range. It writes
`course-packages/sudan-imnci-classic-modules-1-3.imnci.json` (the name is kept so the upload tag stays the same).
Upload with `../upload-classic.cjs` (see the workflow; `replace` updates the course already in the app).
