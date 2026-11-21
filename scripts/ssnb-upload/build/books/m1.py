# Manual Module (1) Essential and Emergency Newborn Care: how the manual becomes the online course. One app module per manual Section.
from lib import *
from fg import fg_lines
from books import m1_s1, m1_s2, m1_s3
CATEGORY = "Small & Sick Newborn"
SUB = "Online course: Management of Sick and Small Newborns (2026)"

FILE = "ssnb-module-1-essential-emergency-newborn-care.imnci.json"
BOOK = "Manual Module (1) Essential and Emergency Newborn Care"
SHORT = "SSN M1"
COURSE = {
    "title": "Sick & Small Newborn · Module 1: Essential and Emergency Newborn Care",
    "description": 'Sudan Training Course on Management of Sick and Small Newborns (2026), Module 1. The golden minute and essential newborn care, selected neonatal emergencies (shock, hypoglycaemia, seizures), and how to assess, identify and refer the small and sick newborn. Each section is a module you can take, share and finish on its own.',
    "category": CATEGORY, "subcategory": SUB,
    "lockOrder": True, "modulesAnyOrder": True, "enrolment": "approval",
}
# Element ids of sources/m1.json that are not course text.
SKIP = {(0, 1): 'cover title (the course title)'}
# The facilitator guide's title for a case, where it differs from the manual's.
FG_TITLES = {}
# Answer keys for cases the facilitator guide has none for (from the guide's own text elsewhere).
ANSWERS = {
    # Case Study: Neonatal Shock Management: the guide's Question/Answer guide
    "Exercise 1 — Case Study: Neonatal Shock Management": fg_lines(1914, 1939),
    "Exercise 2 — Case 2 — The Preterm with Cold Shock": fg_lines(1955, 1984),
    "Exercise 3 — Case Study: Neonatal Convulsions": fg_lines(2361, 2386),
    "Exercise 6 — Case 1 — The Preterm Needing Ventilation": fg_lines(2690, 2695),
    # a classroom drill: the guide has no key; the manual's own summary of a transfer is the checklist
    "Exercise 5 — Case study – Transport Sick and small newborn": [
        "Use the manual's summary (Referring Neonate): 1. Assess: vital signs, severity of distress, degree of maturity, presence of congenital anomalies or other complications.",
        "2. Decide reason for admission, level of care needed, type of respiratory support needed. 3. Stabilize and maintain warmth, A, B, Cs.",
        "4. Check equipment. 5. Organize transport team and assign duties. 6. Documentation. 7. Communication with parents, with the SCNU team, between team members.",
        "8. Transfer: inform the SCNU of the anticipated time of arrival; use the safest available method; avoid delays and interruptions; keep monitoring; detailed handover on arrival."],
}

MODULES = [
    dict(title='The Golden Minute of Life', rename=m1_s1.TITLES, add=m1_s1.ADD),
    dict(title='Selected Neonatal Emergencies', rename=m1_s2.TITLES, add=m1_s2.ADD),
    dict(title='Assess, Identify and Refer the Small and Sick Newborn', rename=m1_s3.TITLES, add=m1_s3.ADD),
]
