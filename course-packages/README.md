# Course files

A course file (`*.imnci.json`) holds whole modules: their sections in order, every block of each section, and the exercises those sections link to. You load it into the app from **Online courses → Manage → Import → Import a course file**.

## Getting a course file

To make a file, open a module in Manage mode and press **Download file**. The file has that module, its sections and its exercises.

To use a file, import it. You can import it:
- as a new course, which is added unpublished;
- into an existing course, where its modules are added after the modules already there;
- as only its exercises, which go into Manage Exercises.

Nothing is written until the file has been checked and you confirm. If an exercise with the same id is already in the app, the app keeps its own version unless you tick **Replace**.

## What a file looks like

```json
{
  "format": "imnci-course-package",
  "version": 1,
  "course": { "title": "IMNCI distance learning modules", "description": "…" },
  "modules": [
    {
      "title": "Module 1: General danger signs for the sick child",
      "order": 1,
      "sections": [
        {
          "title": "1.1 Module overview",
          "order": 1,
          "read": [
            { "type": "paragraph", "text": "…" },
            { "type": "booklet", "part": "child", "categories": ["danger"] },
            { "type": "flip", "title": "Numbers to remember", "cards": [ { "front": "Fast breathing", "back": "60 or more" } ] },
            { "type": "exercise", "exerciseId": "dimci-m1-pretest" }
          ],
          "see": [],
          "practise": []
        }
      ]
    }
  ],
  "exercises": [ { "id": "dimci-m1-pretest", "kind": "quiz", "title": "…", "questions": [] } ]
}
```

Sections show in the order of their `order`. Blocks show in the order they are listed.

**A section is one short lesson on one page.** Keep it to one topic and about 20 blocks or fewer: cut a long section at its headings into several lessons rather than making one long page. Do not number lesson titles; the app numbers them in order. Open each lesson with a `note` labelled `In this lesson` that says what the learner will be able to do. The app shows `read`, then `see`, then `practise` on the same page, with no tabs, so a learner reads, watches and practises without switching. New files put everything in `read` and leave `see` and `practise` empty; older files with three lists still work. Saving a section in the editor moves all its blocks into `read`.

## Blocks

| type | what it shows | fields |
| --- | --- | --- |
| `heading`, `paragraph` | text | `text` |
| `list` | a bulleted list | `items` |
| `rich` | formatted text, including tables with coloured rows | `text` (HTML) |
| `note` | a highlighted box | `text`; `label` (for example "Sudan national protocol") |
| `table` | a classification table | `rows: [{ colour: severe, moderate, mild or note, cells: [] }]` |
| `booklet` | chart booklet tables, read live from the saved protocol | `part` (`child` or `infant`), `categories` (for example `danger`, `dysentery`), `caption` |
| `form` | rows of the recording form, read live from the protocol | `part`, `sections` (for example `danger`), `caption` |
| `video` | a video player, or a "being recorded" slot while `url` is empty | `url`, `title`, `caption`, `script` (the narration script number, shown to authors only), `chapters: [{ at, label }]`, `stops: [{ at, text, options, answer, explanation }]` (the video pauses at `at` seconds and asks; only for a video file, not an embed) |
| `question` | a quick multiple-choice check | `text`, `options`, `answer` (index), `explanation` |
| `reveal` | a question to think about, with the answer behind a button | `text`, `answer`, `label` |
| `flip` | cards the learner turns over | `title`, `cards: [{ front, back }]` |
| `sort` | items the learner sorts into groups, each marked right or wrong | `text`, `groups: []`, `items: [{ text, group (index), why }]`, `explanation` |
| `steps` | a procedure shown one step at a time | `title`, `steps: [{ title, text }]` |
| `story` | a case told in stages, with a question at any stage | `title`, `stages: [{ text, question, options, answer, explanation }]` |
| `exercise` | a link to an exercise | `exerciseId`, `note` |
| `image`, `page` | a picture or a captured book page | `path`, `caption` |

## Exercises

Exercises are written the same way as in Manage Exercises:

- **A quiz** has `kind: "quiz"` and `questions`. Each question has a `type`:
  - `mcq`: `options`, and `correct` as the indexes of the right options.
  - `tf`: `correct` as true or false.
  - `text`: `correct` as the expected text.
  - `open`: a written answer that is not scored. `points` is the answer key the learner compares with.
- **A recording-form case** has `narrative` (the scenario, one line per statement) and `expected` (`sections`, `patientData`, `assessments`, `classifications`, and optionally `treatments`). See `src/components/imnci/exercises.js` for the field names.

`draft: true` means only facilitators see the exercise until it is published.

A case for the young infant form sets `formType: "infant"` and lists its classification choices in `expected.classifyOptions` (see `INFANT_CLASSIFY_OPTIONS` in `exercises.js`).

In a section, an exercise card lets the learner work the exercise on the page: it is marked but not recorded. Authors also see **Edit in the case builder**, which opens the same exercise in Manage Exercises.

The `reveal`, `flip`, `sort`, `steps`, `story`, `question` and `video` blocks are activities: the lesson lists them in a checklist at the top and ticks each one as it is done. Which ones are done is saved to the learner's account. In a course read in order, a lesson can be completed, and the next one opened, only when every activity in it is done, so give every lesson at least one. Their answers are not scored.

## Files here

WHO IMCI distance learning course (2014), in the Sudan national wording. Where the Sudan national booklet differs from WHO, the text uses the Sudan wording and a "Sudan national protocol" note says what WHO wrote.

- `who-dimci-module1.imnci.json`: Module 1, General danger signs for the sick child (8 lessons, 8 exercises).
- `who-dimci-module2.imnci.json`: Module 2, The sick young infant (25 lessons, 16 exercises, including the Henri, Sashi and Mimi cases on the young infant form).
- `who-dimci-modules-1-2.imnci.json`: both modules in one file.
- `who-dimci-module3.imnci.json`: Module 3, Cough or difficult breathing (14 lessons, 10 exercises, including the Gyatsu case).
- `who-dimci-module4.imnci.json`: Module 4, Diarrhoea (17 lessons, 14 exercises, including the Maya, Rana, Pano and Jane cases).
- `who-dimci-modules-3-4.imnci.json`: Modules 3 and 4 in one file, to import into the existing course.
- `who-dimci-modules-1-4.imnci.json`: Modules 1 to 4 in one file.
- `who-dimci-module5.imnci.json`: Module 5, Fever (16 lessons, 10 exercises, including the Kareem and Dolma cases).
- `who-dimci-module6.imnci.json`: Module 6, Malnutrition and anaemia (16 lessons, 11 exercises, including the Noah case).
- `who-dimci-module7.imnci.json`: Module 7, Ear problems (11 lessons, 9 exercises, including the Dana and Telisa cases).
- `who-dimci-module8.imnci.json`: Module 8, HIV/AIDS (27 lessons, 19 exercises). The national booklet has no HIV section, so this module keeps the WHO 2014 text for high HIV settings, and every lesson carries a "WHO 2014 HIV content" note saying it is not Sudan national guidance and that HIV recommendations have changed since 2014.
- `who-dimci-module9.imnci.json`: Module 9, Care of the well child (16 lessons, 10 exercises).
- `who-dimci-modules-5-9.imnci.json`: Modules 5 to 9 in one file.
- `who-dimci-modules-1-9.imnci.json`: all the modules above in one file. This is the file the upload script writes.

The narration scripts for the video slots are kept outside the course, in a separate Word file.
