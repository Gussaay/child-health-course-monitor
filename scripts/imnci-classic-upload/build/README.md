# Sudan IMNCI classic course: how the course file is built

`sources/*.txt` is the text of the 2023 national module books (`pdftotext -layout`). The Python files turn line
ranges of that text into lessons word for word (`src.T`), add the activities from the facilitator guide (Dec 2021),
and write `course-packages/sudan-imnci-classic-modules-1-3.imnci.json`:

    cp ../../../src/components/zscore_reference_data.json .   # used by whz.py
    python3 build.py ../../..

`build.py` stops if any line of the books is not placed in the course, if a lesson links an exercise or a figure
that does not exist, or if an answer index is out of range. Upload with `../upload-classic.cjs` (see the workflow).
