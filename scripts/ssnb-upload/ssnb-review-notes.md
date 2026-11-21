# Sick & Small Newborn online courses: review notes (2026-11-21)

## What was built

| Course (category *Small & Sick Newborn*) | Modules (= manual sections) | Lessons | Case exercises (FG answer key) | Video slots |
|---|---|---|---|---|
| Module 1: Essential and Emergency Newborn Care | 3 | 45 | 10 | 13 |
| Module 2: Special Newborn Care | 8 | 68 | 36 + sepsis pre/post test | 11 |
| Module 3: Intensive Newborn Care | 3 | 40 | 5 | 7 |
| **Annex: Neonatal Procedures and Equipment** (open: no approval, any lesson in any order) | 2 (manual Module 2 Sections 7 and 8) | 27 | – | 19 |
| **Facilitator guide** (facilitators only: Protocol management → Facilitator guides; Chapter 3 resuscitation left out) | 15 chapters | 165 | – | – |

- Every line of the three manuals is placed, in the manuals' words and order (`build.py` checks; word check clean).
- Every lesson has at least one activity: the manuals' own MCQs (scored), checks written from the lesson's text,
  sort/flip/calculation activities, and the case exercises with the facilitator guide's answer keys.
- Each manual section is an app module that opens on its own, can be shared by link and finished alone. Lessons inside
  a module are read in order, except in the Procedures and Equipment modules, which open at any lesson.
- Re-use across sections: procedures and equipment are one open Annex course every course links to (e.g. Module 3 CPAP →
  Annex "Vayu bubble CPAP system"; ventilation troubleshooting → Annex "Needle thoracotomy"). Managers can also **copy a lesson**
  into another module of any course (new button on the lesson page in Manage mode).

## App changes (must be live before the upload)

- Course setting **"Each module can be taken on its own"** (`modulesAnyOrder`); module setting **"Reference module"** (`anyOrder`).
- **Share link** on a module and on a lesson: `/learn/<course>/<module>[/<lesson>]`.
- **Copy lesson to another module** (Manage).

## Choices made (please confirm)

1. Order: modules follow the manuals' section order (Section 2 = Module 2), so the book and the app match. The facilitator
   guide teaches Module 1 as Golden minute → Care after 90 min → Emergencies → Referral; with modules open in any order
   this only changes the listing order.
2. Module 1 is the "without resuscitation" manual; the facilitator guide's chapter 3 (Resuscitation of the non-breathing
   baby) is not in the online course.
3. The facilitator guide's scripts, hints and timetable are **not** in the lessons (learners never see them). They could
   be added later as a facilitators' course (as was done for dIMCI).
4. Answer keys shown to learners after they answer include the guide's "Teaching point" lines (facilitator asides such as
   "plant it here; harvest it there" were cut).
5. Exercise 5 of Module 1 Section 3 (transport drill) has no answer key in the guide; the manual's own transfer summary is used.
6. Pre/post test: only the sepsis section has one (the app's face-to-face SSNB sepsis test). No existing test fits
   Modules 1 and 3.

## Open clinical questions (book text kept as printed; please decide)

1. **10% dextrose bolus** (Module 1): 2.5 ml/kg (hypoglycaemia protocol) vs 2 ml/kg (seizure Step 1) vs 2–5 ml/kg (SHOT).
2. **First bath**: 6–8 hours (M1 warm chain) vs 24 hours (M1 Section 3) vs ≥ 12 h stable after cot transfer (M2).
3. **Hypothermia cut-offs** differ by section: < 36.5 °C (definition, clinical sepsis), < 36 °C (triage emergency), < 35.5 °C (WHO suspected sepsis); SCNU target 36.7–37.2 °C.
4. **SpO₂ targets**: > 88% (M3 blender), 90–95% (CPAP), 91–95% (extubation), 85–95% preductal (CDH); FG case: 85–92%.
5. **ROP screening**: ≤ 1500 g or ≤ 30 weeks (M2 monitoring) vs ≤ 34 weeks or ≤ 2000 g (M2 ROP table).
6. **First cranial ultrasound**: 7–10 days (monitoring) vs days 5–7 (IVH section).
7. UAC length formula printed "(3 x BW) t 9" (typo for + 9).
8. Chest tube dressing called both "nonocclusive" and "occlusive".
9. M3 weaning: "fractional excretion of oxygen < 40%" (FiO₂?); "expiratory time (Ti)" (Te); the "Humidification" heading is followed by the FiO₂ paragraph repeated.
10. Sepsis: "third-generation cephalosporins for a total of 2–17 days".
11. M2 Golden hour GIR scenario has no answer in the manual or the guide (a worked example from the manual's formula is given instead).
12. Book typos kept: "imperial antibiotics" (empirical), breast milk protein "0.8%-0.0%", Section 5 objectives printed twice.
13. M2 Section 2 prints two author notes ("Learning how to use thermometer, check pallor" / "A video showing fast breath…"): kept as printed; a video slot was put there (SN2.2.1).
14. KMC: 30 minutes once a day at first (manual steps) vs WHO 8–24 h/day (WHO recommendations section).

## Videos

50 slots, scripts in the Word file (narration in the manual's words; lines marked (FG) from the guide). Open-licence
search (2026-11-21): the best-matched free series are the Global Health Media Project newborn and "Small Baby"
videos (CC BY-NC-ND: credit, no changes, use whole videos; free licence for organisations in high-mortality
countries) and the AIIMS–WHO CC neonatal procedure skill videos (free on YouTube; licence not stated). Their pages
could not be opened from this environment, so no links were added. Confirm which source to use and its terms; then
put each link in `build/videos.json` and rebuild.
