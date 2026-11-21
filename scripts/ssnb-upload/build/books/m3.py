# Manual Module (3) Intensive Newborn Care: how the manual becomes the online course. One app module per manual Section.
from lib import *
from fg import fg_lines
CATEGORY = "Small & Sick Newborn"
SUB = "Online course: Management of Sick and Small Newborns (2026)"

FILE = "ssnb-module-3-intensive-newborn-care.imnci.json"
BOOK = "Manual Module (3) Intensive Newborn Care"
SHORT = "SSN M3"
COURSE = {
    "title": "Sick & Small Newborn · Module 3: Intensive Newborn Care",
    "description": 'Sudan Training Course on Management of Sick and Small Newborns (2026), Module 3. Oxygen therapy, non-invasive ventilation (HFNC, CPAP and others) and mechanical ventilation. Each section is a module you can take, share and finish on its own.',
    "category": CATEGORY, "subcategory": SUB,
    "lockOrder": True, "modulesAnyOrder": True, "enrolment": "approval",
}
# Element ids of sources/m3.json that are not course text.
SKIP = {(0, 28): 'cover and contents pages'}
# The facilitator guide's title for a case, where it differs from the manual's.
FG_TITLES = {}
# Answer keys for cases the facilitator guide has none for (from the guide's own text elsewhere).
ANSWERS = {
    "Exercise 1 — Scenario 1 — The Baby Who Is Tiring": fg_lines(7494, 7511),
    "Exercise 2 — Skills Station Tasks (CPAP assembling)": fg_lines(7673, 7678),
    "Exercise 2 — Scenario — Run the Algorithm Live": fg_lines(8403, 8409),
}

MODULES = [
    dict(title='Oxygen Therapy', add=[]),
    dict(title='Non-Invasive Ventilation', add=[]),
    dict(title='Mechanical Ventilation', add=[]),
]
