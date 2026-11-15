# Course files

A course file (`*.imnci.json`) holds whole modules: their sections in order, every block of each section's Read, See and Practise tabs, and the exercises those sections link to. You load it into the app from **Online courses → Manage → Import → Import a course file**.

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
          "read":     [ { "type": "paragraph", "text": "…" } ],
          "see":      [ { "type": "booklet", "part": "child", "categories": ["danger"] } ],
          "practise": [ { "type": "exercise", "exerciseId": "dimci-m1-pretest" } ]
        }
      ]
    }
  ],
  "exercises": [ { "id": "dimci-m1-pretest", "kind": "quiz", "title": "…", "questions": [] } ]
}
```

Sections show in the order of their `order`. Blocks show in the order they are listed.

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
| `video` | a video | `url`, `caption` |
| `question` | a quick multiple-choice check | `text`, `options`, `answer` (index), `explanation` |
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

## Files here

`who-dimci-module1.imnci.json` contains WHO IMCI distance learning, Module 1 (General danger signs), in the Sudan national wording. It was generated from the checked capture of the WHO booklet.
