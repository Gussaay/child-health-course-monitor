# Sick & Small Newborn online courses: how the course files are built

Sources (in `sources/`, made by the extract scripts from the files Qusay uploaded on 2026-11-21):

| Book | Source file | Extracted to |
|---|---|---|
| Module (1) Essential and Emergency Newborn Care (without resuscitation) | Word `.docx` | `m1.json` (`extract_docx.py`: paragraphs with Word's own list numbers, tables, pictures) |
| Module (2) Special Newborn Care | PDF, 239 pages | `m2.json` (`extract_pdf.py`: printed lines with indent/font, ruled tables, figures cropped by position) |
| Module (3) Intensive Newborn Care (oxygen, NIV, mechanical ventilation) | PDF, 78 pages | `m3.json` |
| Facilitator guide, Sudan Training Course on Management of Sick and Small Newborns 2026 | PDF, 311 pages | `fg.txt` (`pdftotext -raw`) |
| App face-to-face SSNB sepsis test | `src/components/CourseTestForm.jsx` | `sepsis_test.json` |

    python3 extract_docx.py <Module_1.docx> sources/m1.json ../figures
    python3 extract_pdf.py <Module_2.pdf> m2 sources/m2.json ../figures
    python3 extract_pdf.py <Module_3.pdf> m3 sources/m3.json ../figures
    python3 shrink.py ../figures          # every figure a JPEG ≤ 1100 px; then delete the 16 decorative m1 icons (src.py DECOR)
    python3 build.py ../../..             # writes course-packages/ssnb-module-{1,2,3}-*.imnci.json
    python3 voiceover.py <out.docx>       # the video scripts Word file

## Structure

- One **online course per manual module**, category *Small & Sick Newborn*. Course setting `modulesAnyOrder`:
  every module opens on its own; lessons inside a module are read in order.
- One **app module per manual Section** (`books/m1.py` …: titles; `MODULES` in book order).
- One **lesson per subsection** ("4.3 …"); a long subsection is cut at its own headings (`assemble.split_long`),
  small related subsections are merged (`merge`), and the exercise lessons are split (`split`).
- Module 2 Sections 7 (Procedures) and 8 (Equipment) are **reference modules** (`anyOrder`): every lesson opens,
  and other lessons link to them with `courselink` blocks (`books/titles.py`).

## Text

Only layout changes: printed lines joined into paragraphs, a word split by a line-end hyphen joined, list levels
from indents, text boxes that the PDF draws as one-column tables read as text (`src.box_lines`). Fixes:
subscripts the PDF prints as a separate "2" are put back (cm H₂O, FiO₂, PaCO₂, SpO₂, CO₂: `src.SUBS`); Word line
breaks kept (`extract_docx.ptext`). Subsection headings become the lesson titles, tidied (no numbers, sentence case).
`build.py` stops if any element of a book is not placed (cover and contents pages are listed in `SKIP`), and prints a
word check (words of the book not found in the course: only renamed headings remain).

## Activities

- The manuals' own MCQs ("Correct answer: C") become `question` blocks, words unchanged (`build.mcqs`).
- Every case box of the manuals' exercises becomes an app exercise (one written answer) with the **facilitator
  guide's answer key and key message** (`fg.answer_key`, or a line range in `ANSWERS`).
- Every other lesson has at least one check written from the lesson's own text (`books/*_s*.py`, `books/m3_all.py`),
  placed after the text it tests. Section 10 has the app's SSNB sepsis test as pre- and post-test.

## Videos

50 video slots (`video` blocks with `script` codes SN1.x.x, SN2.x.x, SN3.x.x), each right after the text it shows.
Scripts: `videoscripts/m1.py`, `m2.py`, `m3.py` → `voiceover.py` → Word file. Links go in `videos.json`
(`{"SN2.7.3": "https://youtu.be/..."}`), then rebuild.
