# Manual Module (2) Special Newborn Care: how the manual becomes the online course. One app module per manual Section.
from lib import *
from fg import fg_lines
CATEGORY = "Small & Sick Newborn"
SUB = "Online course: Management of Sick and Small Newborns (2026)"

FILE = "ssnb-module-2-special-newborn-care.imnci.json"
BOOK = "Manual Module (2) Special Newborn Care"
SHORT = "SSN M2"
COURSE = {
    "title": "Sick & Small Newborn · Module 2: Special Newborn Care",
    "description": 'Sudan Training Course on Management of Sick and Small Newborns (2026), Module 2. Care in the special care newborn unit: triage, admission, the golden hour, prematurity, KMC, procedures, equipment, patient safety and neonatal sepsis. Each section is a module you can take, share and finish on its own; Procedures and Equipment are reference modules you can open at any lesson.',
    "category": CATEGORY, "subcategory": SUB,
    "lockOrder": True, "modulesAnyOrder": True, "enrolment": "approval",
}
# Element ids of sources/m2.json that are not course text.
SKIP = {(0, 75): 'cover and contents pages'}
# The facilitator guide's title for a case, where it differs from the manual's.
FG_TITLES = {}
# Answer keys for cases the facilitator guide has none for (from the guide's own text elsewhere).
ANSWERS = {
    "Exercise 5 — Exercise : Writing admission order": fg_lines(3111, 3127),
    "Exercise 10 — Case 1 — Baby 1": fg_lines(4768, 4770),
    "Exercise 11 — Case 2 — Baby 2": fg_lines(4773, 4775),
    "Exercise 12 — Case 3 — Baby 3": fg_lines(4779, 4782),
    "Exercise 13 — Case 4 — Baby 4": fg_lines(4788, 4791),
    "Exercise 1 — Scenario: over three weeks, eight babies in your": fg_lines(5182, 5199),
    "Exercise 6 — Practical Exercise — Documentation Drill": fg_lines(5637, 5649),
    "Exercise 10 — Station 4 — Decontamination of Reusable": fg_lines(5723, 5731),
}

MODULES = [
    dict(title='Neonatal Health System', add=[]),
    dict(title='Triage and Assessment of the Sick Newborn', add=[]),
    dict(title='Welcoming and Admitting a Newborn to the Special Care Newborn Unit', add=[]),
    dict(title='The Golden Hour of Life', add=[]),
    dict(title='Care of the Premature Baby and Prevention of Major Complications', add=[]),
    dict(title='Kangaroo Mother Care', add=[]),
    dict(title='Neonatal Procedures', anyOrder=True, add=[]),
    dict(title='Equipment Required for Newborn Care', anyOrder=True, add=[]),
    dict(title='Patient Safety', add=[]),
    dict(title='Neonatal Sepsis: Surveillance, Management and Prevention', add=[]),
]
