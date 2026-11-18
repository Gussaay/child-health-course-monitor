# Module 6 of the classic Sudan IMNCI course: Management of the sick young
# infant age up to 2 months (2023 book). The facilitator guide (Dec 2021) teaches
# this module before Follow-up, and its exercises match the book's (its
# photographs are numbered 1 to 29; the booklet numbers them 60 to 82).
from src import mark
from newmod import *

M = "yi"
B = Book(M, "Sudan IMNCI module: Management of the sick young infant (2023)", "sudan-imnci-yi", 500)
EXERCISES = B.EXERCISES

L = []
L += lessons("Introduction: managing the sick young infant",
    "Say how managing a young infant differs from managing an older child, and what this module teaches.", [
    *A(M, 52, 110),
    from_fg(6362, 6368),
], (1, 4))

L += lessons("1.0 and 1.1 Check for possible bacterial infection or very severe disease",
    "Ask, look and listen for the signs of very severe disease and local bacterial infection in a young infant.", [
    *A(M, 111, 240),
    flip("Drill: what is fast breathing at this age?", [
        ("Age 4 weeks", "60 breaths per minute or more"), ("Age 6 weeks", "60 or more"), ("Age 2 months", "50 or more"),
        ("Age 6 months", "50 or more"), ("Age 12 months", "40 or more"), ("Age 11½ months", "50 or more"),
        ("Age 1 month", "60 or more"), ("Age 3 weeks", "60 or more"), ("Age 3 years", "40 or more"),
    ]),
    flip("Drill: does this infant or child have fast breathing?", [
        ("3 weeks, 55 breaths per minute", "No"), ("4 weeks, 63", "Yes"), ("2 weeks, 59", "No"), ("18 months, 44", "Yes"),
        ("2 months, 48", "No"), ("12 months, 40", "Yes"), ("3 years, 38", "No"), ("11 months, 49", "No"),
        ("6 months, 52", "Yes"), ("6 weeks, 62", "Yes"),
    ]),
], (5, 7))

exA = B.exo("ex-a-umbilicus", "Sick young infant, Exercise A: the umbilicus", "Photographs 63 to 65: tick your assessment of each umbilicus.", 6480, 6490,
            "Photographs 63, 64 and 65: is the umbilicus normal, red or draining pus, or with redness extending to the skin of the abdomen?")
B.EXERCISES[-1]["questions"] = [
    mcq("p63", "Photograph 63: the umbilicus is…", ["Normal", "Redness or draining pus", "Redness extending to the skin of abdomen"], 2),
    mcq("p64", "Photograph 64: the umbilicus is…", ["Normal", "Redness or draining pus", "Redness extending to the skin of abdomen"], 0),
    mcq("p65", "Photograph 65: the umbilicus is…", ["Normal", "Redness or draining pus", "Redness extending to the skin of abdomen"], 1),
]
B.EXERCISES[-1]["narrative"].append("Answers from the facilitator guide's list of young infant photographs (its photographs 3, 4 and 5).")
L += lessons("Exercise A: video and photographs of young infants",
    "Watch how a young infant is assessed for bacterial infection, and recognise the signs in photographs.", [
    *A(M, 241, 249),
    video("Assessing a young infant for possible bacterial infection", "Video for Exercise A, Part 1.", "YI.1"),
    *A(M, 250, 275),
    photo(60, "Photograph 60: Normal umbilicus in a newborn."),
    photo(61, "Photograph 61: An umbilicus with redness extending to the skin of the abdomen."),
    photo(62, "Photograph 62: Many skin pustules."),
    photo(63), photo(64), photo(65),
    exA,
], (8, 8))

L += lessons("1.1.2 Classify bacterial infection or very severe disease",
    "Classify a young infant for VERY SEVERE DISEASE, LOCAL BACTERIAL INFECTION or infection unlikely.", [
    *A(M, 276, 334),
], (9, 9))

L += lessons("1.2 Check for jaundice",
    "Assess and classify a young infant for jaundice.", [
    video("How to check for jaundice", "Video demonstration (Exercise C in the facilitator guide).", "YI.2"),
    *A(M, 335, 409),
], (10, 11))

L += lessons("1.3 Assess and classify diarrhoea",
    "Assess dehydration in a young infant with diarrhoea and classify it.", [
    *A(M, 410, 549),
], (12, 13))

exB = B.exo("ex-b-cases", "Sick young infant, Exercise B: assess and classify (case studies)",
            "Record each case on a young infant recording form and classify the infant for possible bacterial infection, jaundice and diarrhoea.",
            6512, 6935, "Write each infant's signs and classifications. Then compare with the facilitator guide's completed recording forms.", 30)
L += lessons("Exercise B: assess and classify young infants",
    "Record the signs of each young infant on the recording form and classify them.", [
    *A(M, 550, 640),
    exB,
], (13, 16))

L += lessons("1.4 Check for feeding problem or low weight",
    "Ask about feeding and determine weight for age in a young infant.", [
    *A(M, 641, 718),
    flip("Drill: is the young infant low weight for age? (Use the weight-for-age chart.)", [
        ("3 weeks old boy, 3 kg", "Yes"), ("6 weeks old girl, 4 kg", "No"), ("7 weeks old boy, 3 kg", "Yes"),
        ("4 weeks old boy, 2.5 kg", "Yes"), ("5 weeks old girl, 3.25 kg", "Yes"), ("2 weeks old girl, 2.5 kg", "Yes"),
        ("6 weeks old boy, 3.75 kg", "No"), ("5 weeks old girl, 2.9 kg", "Yes"),
    ]),
], (17, 19))

L += lessons("1.4.2 Assess breastfeeding",
    "Assess attachment and suckling during a breastfeed.", [
    *A(M, 719, 846),
], (20, 22))

GOOD = "Good attachment"; NOT = "Not well attached"
exD = B.exo("ex-d-attachment", "Sick young infant, Exercise D: attachment for breastfeeding",
            "Photographs 71 to 74: look for each sign of good attachment and give your overall assessment.", 1, 1)
B.EXERCISES[-1]["questions"] = [
    mcq("p71", "Photograph 71: overall assessment of attachment", [GOOD, NOT], 1,
        "Chin touching breast: no. Mouth wide open: no. Lower lip turned outward: yes. More areola above: no (equal above and below)."),
    mcq("p72", "Photograph 72: overall assessment of attachment", [GOOD, NOT], 0,
        "Chin touching breast: yes. Mouth wide open: yes. Lower lip turned outward: yes. More areola above: yes."),
    mcq("p73", "Photograph 73: overall assessment of attachment", [GOOD, NOT], 0,
        "Chin touching breast: yes (almost). Mouth wide open: yes. Lower lip turned outward: yes. More areola above: yes."),
    mcq("p74", "Photograph 74: overall assessment of attachment", [GOOD, NOT], 1,
        "Chin touching breast: yes. Mouth wide open: no. Lower lip turned outward: no. More areola above: no (more below). Lower lip turned in."),
]
B.EXERCISES[-1]["narrative"].append("Answers from the facilitator guide's list of young infant photographs (its photographs 18 to 21).")
L += lessons("Exercise D: attachment for breastfeeding",
    "Recognise the signs of good and poor attachment in a video and in photographs.", [
    *A(M, 847, 852),
    video("Checking for a feeding problem and assessing breastfeeding", "Video for Exercise D, Part 1.", "YI.3"),
    *A(M, 853, 899),
    *[photo(n) for n in range(66, 77)],
    exD,
], (23, 23))

L += lessons("1.4.3 Classify feeding problems; 1.5 immunization; 1.6 other problems",
    "Classify feeding problems and low weight, check immunization status and assess other problems.", [
    *A(M, 900, 1034),
], (24, 26))

exE = B.exo("ex-e-feeding", "Sick young infant, Exercise E: feeding, weight and immunization",
            "Continue the recording forms: record the rest of the assessment, low weight for age, feeding classification and immunizations.",
            6512, 6935, minutes=20)
L += lessons("Exercise E: assess and classify feeding, weight and immunization",
    "Complete the young infants' recording forms with feeding, weight for age and immunizations.", [
    *A(M, 1035, 1104),
    exE,
], (26, 28))

L += lessons("2.0 Identify appropriate treatment",
    "Decide if a young infant needs urgent referral, and give the urgent pre-referral treatments.", [
    *A(M, 1105, 1168),
], (29, 30))

L += lessons("3.0 to 3.2 Oral antibiotic and first dose of intramuscular antibiotics",
    "Give amoxicillin, and the first dose of intramuscular gentamicin and ampicillin, at the right dose.", [
    video("Preparing and giving gentamicin and oral amoxicillin to a young infant", "Video demonstration (Exercise F in the facilitator guide).", "YI.4"),
    *A(M, 1169, 1240),
    discuss("Drill: what dose of gentamicin, ampicillin and amoxicillin for a young infant of 1.8, 2.7, 3.2, 4.4 and 5.0 kg? (Use your chart, then open the answers.)", 7437, 7456),
], (31, 32))

exF = B.exo("ex-f-treatment", "Sick young infant, Exercise F: referral and treatments",
            "For each case: is urgent referral needed? Which antibiotic, dose and other treatments?", 7236, 7284, minutes=20)
L += lessons("Exercise F: referral, antibiotics and treatments",
    "Decide whether each young infant needs urgent referral, and write the antibiotics with their doses.", [
    *A(M, 1241, 1266),
    exF,
], (32, 33))

L += lessons("3.3 to 3.5 Diarrhoea, immunization and local infections",
    "Treat diarrhoea, immunize, and teach the mother to treat local infections at home.", [
    *A(M, 1267, 1336),
], (34, 34))

L += lessons("3.6 Teach correct positioning and attachment for breastfeeding",
    "Help a mother improve her baby's positioning and attachment.", [
    *A(M, 1337, 1423),
], (35, 37))

exG = B.exo("ex-g-positioning", "Sick young infant, Exercise G: positioning for breastfeeding",
            "Photographs 80 to 82: look for each sign of good positioning and decide if the attachment is good.", 1, 1)
B.EXERCISES[-1]["questions"] = [
    mcq("p80", "Photograph 80: is the infant well positioned and attached?", ["Good positioning and attachment", "Poor positioning, not well attached"], 1,
        "Head and body straight: no. Facing breast: no, body turned away. Body close: no. Supporting whole body: no, only neck and shoulders. "
        "Not well attached: mouth not wide open, lower lip not turned out, more areola below than above."),
    mcq("p81", "Photograph 81: is the infant well positioned and attached?", ["Good positioning and attachment", "Poor positioning, not well attached"], 0,
        "Head and body straight: yes. Facing breast: yes. Body close: yes, very close. Supporting whole body: yes. Good attachment, chin touching breast."),
    mcq("p82", "Photograph 82: is the infant well positioned and attached?", ["Good positioning and attachment", "Poor positioning, not well attached"], 1,
        "Head and neck twisted and bent forward, not straight with body; body turned away; not close; only neck and shoulders supported. "
        "Not well attached: mouth not wide open."),
]
B.EXERCISES[-1]["narrative"].append("Answers from the facilitator guide (its photographs 27 to 29).")
L += lessons("Exercise G: positioning and attachment",
    "Watch how to help a mother improve positioning and attachment, and assess positioning in photographs.", [
    *A(M, 1424, 1429),
    video("Helping a mother to improve her baby's positioning and attachment", "Video for Exercise G, Part 1.", "YI.5"),
    *A(M, 1430, 1461),
    *[photo(n) for n in range(77, 83)],
    exG,
], (37, 38))

L += lessons("3.7 Advise the mother to give home care for the young infant",
    "Advise on exclusive breastfeeding, keeping the infant warm and when to return.", [
    video("Expressing breast milk, keeping the infant warm, cup feeding and treating thrush", "Video demonstration (Exercise I in the facilitator guide).", "YI.6"),
    *A(M, 1462, 1560),
    discuss("Drill: what are the main points of advice for the mother of a young infant? (Say them from memory, then open the answers.)", 7471, 7554),
], (38, 40))

exH = B.exo("ex-h-mariam", "Sick young infant, Exercise H: treatment and home care",
            "Answer the questions about treating Mariam at home: local infection, home care and when to return.", 7402, 7422)
L += lessons("Exercise H: treatment at home and home care",
    "Describe the treatment of a local infection at home, home care and when to return.", [
    *A(M, 1561, len(__import__("src").SRC[M])),
    exH,
    facil("Summary of the module: assess and classify the young infant for bacterial infection, jaundice, diarrhoea, feeding problems "
          "and low weight, and immunization; identify the treatment; refer urgently after pre-referral treatment when needed; treat "
          "local infections; teach correct positioning and attachment; advise on home care and when to return."),
], (41, 41))

MODULE = module("Module 6: Management of the sick young infant", 6, L)
mark(M, 1, 51)
