# Sick & Small Newborn: GHMP videos against the manual — differences and how to align them

Checked 22 Nov 2026. 25 Global Health Media Project (GHMP) videos in 24 lessons of Modules 1–3.

**How this was checked.** The manual's side is the lesson text the video sits in, word for word. The video's side
could not be read from a transcript: GHMP publishes only a one-line summary, and YouTube captions could not be
fetched here. It is the teaching of each film as published (GHMP follows the WHO guideline the film names). So every
"video" point below **must be confirmed by watching the film** (or automatically, once the video files are
available: `build/skilltimes.py` transcribes them and can print the narration beside the manual).

Kinds of finding:
- **Contradiction**: the video teaches something the manual says differently.
- **Manual inconsistent**: the manual says two different things itself; the video agrees with one of them.
- **Gap**: the video shows a step or a number the manual leaves out (not wrong, but learners will ask).
- **Different setting**: the video is for a first-level facility or the home; the lesson is for the SCNU/NICU.

## Contradictions (decide first)

| # | Lesson (video) | Manual says | Video teaches | Suggested alignment |
|---|---|---|---|---|
| 1 | M2 · KMC step by step (*Carrying Your Baby Skin-to-Skin*) | "Leave mother and baby in kangaroo care for 30 minutes once a day initially, then 2–3 times a day 2–3 hours" | Kangaroo position for as many hours as possible, day and night (WHO 2022: start immediately, continuous, ideally 24 h, at least 8 h/day) | **Update the manual** to WHO 2022 immediate, continuous KMC; keep "start with short sessions" only for babies not yet stable. Until then, a note under the video: "Sudan: aim for continuous KMC as soon as the baby is stable." |
| 2 | M2 · Treating neonatal sepsis (*Managing Severe Infection in Newborns*) | Hospital regimen only: ampicillin + gentamicin IV/IM, 7–10 days, stop at 72 h if culture negative | The 2015 WHO update for when **referral is not possible**: gentamicin IM + oral amoxicillin for 7 days at the first-level facility, and outpatient amoxicillin for fast breathing alone (7–59 days) | **Different setting, not wrong.** Add a note under the video: "This film shows WHO's regimen for when a sick young infant cannot be referred. In the SCNU, follow the manual's regimen above." Or move the video to Module 1 (Referring a newborn). |
| 3 | M2 · Treating neonatal sepsis (*Preparing Ampicillin and Gentamicin*) | Gentamicin 5 mg/kg once daily in week 1, 7.5 mg/kg after | WHO weight-band doses: gentamicin in week 1 is **3 mg/kg for low birth weight**, 5 mg/kg for normal weight | **Add the low-birth-weight dose** to the manual (or state Sudan's choice), so the film's dose table and the lesson agree. Check the film's table against the national formulary. |

## The manual says two things (the video agrees with one)

| # | Topic (video) | Manual, place 1 | Manual, place 2 | Video | Suggested alignment |
|---|---|---|---|---|---|
| 4 | First bath (*Keeping the Baby Warm*) | M1 Skin-to-skin and the warm chain: "Delay bathing until 6–8 hrs or when stable" | M1 Temperature problems: "Delay bathing for 24 hours after birth" | At least 24 hours | One rule everywhere: **delay the bath 24 hours; if not possible for cultural reasons, at least 6 hours** (WHO). |
| 5 | Fever (*Sepsis*, *The Hot Baby*) | Triage: fever above 37.5 °C | Sepsis signs: ≥ 38 °C; case definition > 38 °C; "Temp 35.5–38" at 90 minutes | WHO young-infant sign as the film shows it (≥ 37.5 °C) | Keep **37.5 °C** as the bedside danger sign (IMNCI); keep > 38 °C only in the surveillance case definition and say so there. |
| 6 | Bag-and-mask rate (*Helping Babies Breathe at Birth*) | Bag-and-mask SOP: 30–60 breaths/min | NRP lessons: 40–60 breaths/min | 40 breaths/min ("breathe-two-three") | Change the SOP to **40–60 per minute** (NRP), which includes HBB's 40. |
| 7 | Cord clamping (*Helping Babies Breathe at Birth*, *Preparing the Birth Room*) | EENC: after pulsations stop, usually 1–3 minutes | NRP: ≥ 30 seconds; ROP lesson: 60–90 seconds | Clamp at 1–3 minutes in a breathing baby; a baby not breathing: clamp, cut and ventilate | One sentence in the manual: **breathing baby: not before 1 minute (1–3 min); baby needing ventilation: start within the golden minute** (cut the cord unless ventilation with the cord intact is possible). |
| 8 | Disinfecting resuscitation equipment (*Cleaning Resuscitation Equipment with a Chemical Solution*) | Decontamination station: chlorine **0.1%**, 20 minutes | CPAP lesson: chlorine **0.5%**, 10 minutes; bag/bulb SOPs: "disinfection solution" / "chlorine", 20 minutes, no strength | A chlorine solution of a stated strength and soaking time (check the film) | **One national standard** for high-level disinfection of resuscitation equipment (strength, time, rinse), written the same in every SOP; check the film uses it. |

## Gaps: the video shows what the lesson does not say

| # | Lesson (video) | Gap | Suggestion |
|---|---|---|---|
| 9 | M1 · Measuring glucose (*Taking a Heel Blood Sample*) | Manual: warm heel, wipe first drop. Not where on the heel. | Add "the outer or inner side of the heel, never the back or the centre". |
| 10 | M2 · Nutrition (*Inserting / Feeding with a Nasogastric Tube*) | Manual has no measuring or placement check for the tube. | Add the SOP the film shows: measure, mark, insert, check position before every feed; and Sudan's feed-volume steps (manual: increase by up to 30 mL/kg/day; check the film's numbers match). |
| 11 | M1 · Essential care at 60–90 min (*Care of the Cord*) | Manual: "nothing on the cord unless recommended by your health authority". | State **Sudan's policy** (dry cord care in facilities; chlorhexidine 7.1% for home births if adopted), because the film discusses chlorhexidine. |
| 12 | M1 · Discharge (*Expressing and Storing Breastmilk*) | The film gives storage times; the manual gives none. | Add storage times from the national IYCF guidance, the same as the film's (check). |
| 13 | M1 · Referring a newborn (*Referring a Sick Baby*) | The film keeps the baby skin-to-skin on the mother during transport and gives the first antibiotic dose before referral. | Make sure the transport lessons say both (the manual has "keep warm", a transport device, and pre-referral treatment). |

## Agree (no action)

Skin-to-skin for at least 60 minutes and breastfeeding in the first hour; vitamin K 1 mg IM in the front outer thigh
after the first hour (0.5 mg < 1500 g); normal temperature 36.5–37.5 °C; hypothermia < 36.5 °C; room ≥ 25 °C; fast
breathing ≥ 60/min in the first week; jaundice on day 1 or on palms and soles is a danger sign; no routine suction of
a vigorous baby or for meconium; hand hygiene 40–60 s with soap, 20–30 s with rub; nasal prong oxygen 0.5–1 L/min and
oxygen below SpO₂ 90%; ampicillin 50 mg/kg every 12 h in week 1, every 8 h after.

## How to apply it in the courses

1. **Clinical decisions** (rows 1–8): the national team chooses the rule; I then change the lesson text and the
   quiz questions that test it, rebuild, and update the live lessons in place (learners keep their progress).
2. **Notes under videos** (rows 2, 3 and any row not yet decided): a short "In Sudan …" box under the video, so the
   learner is never left with two answers. These can go live now without changing the manual.
3. **Gaps** (rows 9–13): add the missing step to the lesson as a "Key point" box, quoting the national source.
4. **Confirm the video side**: send the GHMP files (licence Level 1, free); the transcripts are compared with the
   lessons automatically and any row above that the film does not actually say is dropped.
