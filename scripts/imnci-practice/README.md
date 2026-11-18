# Practice activities for both IMNCI courses

`practice.py` holds the practice cases, find-the-error forms, skill drills, conversations, colour cards, photo step cards,
opening questions, module endings and the "How to study this course" lesson, and where each goes in each course
(`dimci_plans()` for the WHO distance-learning modules, `classic_plans()` for the Sudan classic course). Both course
builds call `practice.enrich(...)`.

    python3 practice.py        # self-check, and writes cases.json
    npx vitest run tests/imnciPracticeCases.test.js   # every case against the app's classification engine

Colour cards are read from `booklet.json`, made from `src/components/chartBooklet.js` with `node dump-booklet.mjs > booklet.json`.
Drill videos are placeholders (`url: ""`) that show the `given` text until a clip is recorded.
