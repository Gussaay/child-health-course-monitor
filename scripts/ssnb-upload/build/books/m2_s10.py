# Module 2, Section 10 (Neonatal Sepsis): titles, merges, activities, videos.
from lib import *
from books.m1_s2 import ONLINE

MERGE = [['Clinical Sepsis (no positive culture but meets clinical/lab criteria).', 'Laboratory Confirmed Neonatal Sepsis by a recognized pathogen', 'Laboratory Confirmed Neonatal Sepsis by common commensals'],
         ['Management of Neonatal Sepsis: Appropriate action according to the CULTURE isolate', 'Documentation of Neonatal Sepsis']]
MERGE_TITLES = {'Clinical Sepsis (no positive culture but meets clinical/lab criteria).': 'Sepsis case definitions: clinical and laboratory-confirmed sepsis',
                'Management of Neonatal Sepsis: Appropriate action according to the CULTURE isolate': 'Action by culture result, and documenting sepsis'}
TITLES = {
    'Neonatal Sepsis Surveillance System': 'The neonatal sepsis surveillance system',
    'Suspected sepsis': 'Suspected sepsis: the signs and maternal risk factors',
    'Blood culture collection': 'Taking a blood culture',
    'Management of Neonatal Sepsis': 'Treating neonatal sepsis',
    'Prevention of Sepsis': 'Preventing sepsis: hand hygiene',
    'Prevention of Sepsis: Personal protective equipment': 'Preventing sepsis: personal protective equipment',
    'Prevention of Sepsis: IMPORTANT': 'Preventing sepsis: using gloves correctly',
    'Prevention of Sepsis: Manual Disinfection Prepare the decontamination station': 'Preventing sepsis: manual disinfection of equipment',
    'Exercises': 'Exercises: sepsis surveillance and case management',
}
SPLIT = [('Safe injections and sharps injury prevention Health workers should', 'Preventing sepsis: safe injections, cleaning, linen and waste'),
         ('CASE EXERCISE Exercise 7 — Station 1 — Hand Hygiene', 'Exercises: infection prevention skill stations')]
ADD = [
    ('Facilitate timely response to outbreaks or clusters', q(
        'Which of these is a specific objective of the sepsis surveillance system?', ['Detect antimicrobial sensitivity and resistance patterns', 'Replace blood cultures', 'Decide each baby\'s antibiotics', 'Count discharges'], 0,
        'Also: incidence and prevalence, risk factors, IPC effectiveness, benchmarking, and timely response to outbreaks.')),
    ('History of fever more than 38 degree or offensive vaginal discharge', [
        sort('Is this a WHO sign of suspected sepsis in a 0–59-day-old?', ['Sign of suspected sepsis', 'Not on the list'], [
            ('Not feeding well', 'Sign of suspected sepsis'), ('Temperature 34.9 °C', 'Sign of suspected sepsis'),
            ('Fast breathing ≥ 60 in a 3-day-old', 'Sign of suspected sepsis'), ('Severe abdominal distension', 'Sign of suspected sepsis'),
            ('Temperature 37.0 °C, feeding well, active', 'Not on the list')], 'From the WHO definition in the manual.'),
        q('Which maternal history suggests sepsis in the baby?', ['PROM > 18 hours without antibiotics 4 or more hours before labour', 'A normal pregnancy', 'Maternal age 30', 'Caesarean section for breech'], 0,
          'Also a positive GBS screen, or maternal fever above 38 °C or offensive vaginal discharge.')]),
    ('Hyperglycemia (> 140 mg/dl) or Hypoglycaemia (< 46 mg/dl)', []),
    ('A common commensal is recovered from TWO blood culture', q(
        'One blood culture grows coagulase-negative staphylococcus. Is this laboratory-confirmed sepsis?', ['Not on its own: a common commensal must grow from TWO cultures, with at least two clinical or lab features', 'Yes, always', 'Yes, if the baby is preterm', 'Only if the CRP is normal'], 0,
        'From "Laboratory confirmed neonatal sepsis by common commensals". A recognised pathogen (e.g. E. coli, GBS) from one culture is enough.')),
    ('use standard transferee procedure', []),
    ('Record sample collection in the main case record registry', [
        q('How much blood goes into each culture bottle, and when is it taken if the baby is already on antibiotics?', ['1–2 ml per bottle; immediately before the next antibiotic dose', '0.1 ml; any time', '10 ml; after the dose', '5 ml; only after stopping antibiotics'], 0,
          'Clean with 70% alcohol (30-second scrub, air dry); do not re-palpate; label with name, file ID, date and time, collector and sample type.'),
        video('Taking a blood culture from a newborn', 'Identity check, preparing materials, 70% alcohol scrub and drying, aseptic collection of 1–2 ml, labelling, request form, registry entry.', 'SN2.10.1')]),
    ('depressed sensorium', q(
        'Why does the manual say CRP is not useful in the golden hour?', ['It takes 10–12 hours to rise (half-life 24–48 h), so an early value is unreliable', 'It is always high at birth', 'It is too expensive', 'It is only for term babies'], 0,
        'LP is not routine for early-onset sepsis screening; it is done if the blood culture is positive, with strong clinical suspicion, or with seizures, apnoea or depressed sensorium.')),
    ('Otherwise continue ampicillin IM/IV 50 mg/kg every 12 hours', calc(
        'A 2.5 kg baby is 3 days old. What is one dose of ampicillin (50 mg/kg), given every 12 hours in the first week?', 125, 'mg',
        explanation='50 mg/kg × 2.5 kg = 125 mg every 12 hours in the first week of life (every 8 hours after). Gentamicin 5 mg/kg once a day in the first week = 12.5 mg.')),
    ('decision should also take into consideration local antibiotic resistance patterns', q(
        'Ampicillin and gentamicin were started; at 72 hours the culture has no growth, the repeat CRP/PCT is negative and the baby is well. What does the manual say?', ['Stop the antibiotics', 'Continue for 10 days anyway', 'Change to a third-generation cephalosporin', 'Add vancomycin'], 0,
        'From "Management of neonatal sepsis". Antibiotic stewardship: narrow spectrum, fixed start and stop protocols, de-escalate by sensitivity.')),
    ('total of at least 7 days.', []),
    ('Use Chlorohexadine as hand rub agent', q(
        'A culture grows MRSA. Besides antibiotics by sensitivity (mostly vancomycin), what does the manual say to do?', ['Isolate the baby, assign one nurse and dedicated equipment, trace the source, report to the infection control committee', 'Nothing more', 'Discharge the baby', 'Stop hand hygiene audits'], 0,
        'Resistant Gram-negatives and fungi are "alarming organisms" with the same isolation steps.')),
    ('natural nails should be kept short', []),
    ('use the towel to turn off the faucet/ tap', [
        q('Hands are not visibly soiled. What is the preferred hand hygiene, and for how long?', ['Alcohol-based handrub, 20–30 seconds', 'Soap and water, 5 seconds', 'Gloves instead', 'Water only, 1 minute'], 0,
          'Visibly soiled hands: soap and water, 40–60 seconds, dry with a single-use towel and use it to turn off the tap.'),
        video('Hand hygiene: handrub and handwash, step by step', 'The steps of handrubbing (20–30 s) and handwashing (40–60 s), and the moments for hand hygiene in the SCNU.', 'SN2.10.2')]),
    ('change gloves between tasks and procedures if moving from a contaminated body site', q(
        'Before any care activity, how do you choose PPE?', ['Assess the risk of exposure first, then select gloves, gown, mask or eye protection for the task', 'Always wear everything', 'Wear nothing unless the baby is infected', 'Wear the same gloves all shift'], 0,
        'Hand hygiene before putting on and after taking off PPE.')),
    ('examples of unsafe glove use', []),
    ('reuse gloves after reprocessing or decontamination, as this is not recommended.', q(
        'When do you take OFF gloves?', ['As soon as they are damaged, when contact with body fluid has ended, when care of one baby has ended, or when hand hygiene is indicated', 'Only at the end of the shift', 'After washing them', 'Never during a procedure'], 0,
        'Gloves are not a substitute for hand hygiene, and do not protect against needle-stick injuries.')),
    ('using efficient methods and based on intended use', sort(
        'Safe or unsafe practice?', ['Safe', 'Unsafe'], [
            ('Discarding the sharps container when three-quarters full', 'Safe'), ('Wearing the same gloves between two babies', 'Unsafe'),
            ('Recapping a used needle', 'Unsafe'), ('Washing gloved hands', 'Unsafe'), ('Leaving a needle in the septum of a vial', 'Unsafe'),
            ('Cleaning frequently touched surfaces at least daily', 'Safe')], 'From the manual\'s lists for gloves, safe injections and environmental cleaning.')),
    ('Change the chlorine solution daily', [
        q('In the decontamination station, how strong is the chlorine and how long do items stay in it?', ['0.1% chlorine; 20 minutes', '5% chlorine; 1 minute', '0.01%; overnight', 'Any strength; until dry'], 0,
          'Four containers: soap and water, water, 0.1% chlorine, sterile or filtered water. Change the chlorine solution daily.'),
        video('Manual disinfection at the decontamination station', 'Setting up the four containers, washing, rinsing, 20 minutes in 0.1% chlorine, rinsing in sterile water, drying, reassembling and labelling.', 'SN2.10.3')]),
    ('Work through each exercise on your own or in your small group', ONLINE),
]
ADD = [a for a in ADD if a[1]]

# Pre- and post-test: the app's face-to-face SSNB sepsis test (CourseTestForm.jsx, SSNB_SEPSIS_TEST_QUESTIONS),
# copied to sources/sepsis_test.json. The same questions before and after the section.
import json as _json, os as _os, re as _re
_T = _json.load(open(_os.path.join(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))), 'sources', 'sepsis_test.json')))
def _test(eid, order, title):
    qs = []
    for k, t in enumerate(_T, 1):
        ids = [o['id'] for o in t['options']]
        qs.append(mcq(f'q{k}', _re.sub(r'^\d+\.\s*', '', t['text']), [_re.sub(r'^\d+\.\s*', '', o['text']) for o in t['options']], ids.index(t['correctAnswer'])))
    e = quiz(eid, order, title, ['The same 10 questions as the face-to-face Small & Sick Newborn sepsis test.'], qs,
             'App face-to-face test: SSNB Test - Sepsis surveillance and management (CourseTestForm.jsx)', minutes=10)
    e['draft'] = False
    return e
EXERCISES = [_test('ssnb-m2-s10-pretest', 20, 'Sepsis pre-test'), _test('ssnb-m2-s10-posttest', 21, 'Sepsis post-test')]
ADD += [
    ('Neonate sepsis still of leading cause of deaths among neonates', ex('ssnb-m2-s10-pretest', 'Pre-test: answer these 10 questions before you start this module. You will take the same test at the end.')),
    ('Twenty minutes means twenty minutes', ex('ssnb-m2-s10-posttest', 'Post-test: the same 10 questions as the pre-test. Compare your scores.')),
]
