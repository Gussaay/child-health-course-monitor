# Module 4 of the classic Sudan IMNCI course: Treat the child (2023 book), in
# the order of the facilitator guide (Dec 2021): sections 1.0 to 6.3, then the
# Plan C annexes (C-1 to C-4, with annexes A, B and D they point to), then 6.4
# to 7.0 and Exercise K, then Annex E. Book text word for word.
from src import mark
from newmod import *

M = "tr"
B = Book(M, "Sudan IMNCI module: Treat the child (2023)", "sudan-imnci-tr", 300)
EXERCISES = B.EXERCISES
CHECK = H("Check yourself")

L = []
L += lessons("Introduction: the TREAT THE CHILD chart",
    "Say what this module teaches, and read a drug table on the TREAT THE CHILD chart.", [
    *A(M, 68, 108),
    video("How to read a drug table", "Demonstration: the antibiotic box on the TREAT chart.", "TR.1"),
    from_fg(3818, 3838),
    booklet(["cough", "fever", "ear", "malnutrition"], "The national protocol: classifications and the drugs they call for."),
], (4, 4))

L += lessons("1.1 Give an appropriate oral antibiotic",
    "Choose the oral antibiotic for each classification and find its dose and schedule by weight or age.", [
    *A(M, 109, 216),
    CHECK,
    q("For a 12 kg child with PNEUMONIA, how much amoxicillin 250 mg tablet do you give?",
      ["1 tablet two times daily for 5 days", "2 tablets two times daily for 5 days", "2 tablets three times daily for 3 days"], 1,
      "Demonstration in the facilitator guide: 2 adult tablets two times daily for 5 days, or 10 ml (2 teaspoons) syrup two times daily for 5 days."),
], (5, 6))

exA = B.exo("ex-a-antibiotic", "Treat the child, Exercise A: oral antibiotic, dose and schedule",
            "Select the correct oral antibiotic and write the dose and schedule for each child.", 3880, 3905)
L += lessons("Exercise A: oral antibiotic, dose and schedule",
    "Select the right oral antibiotic and write the dose and schedule for four children.", [
    *A(M, 217, 250),
    exA,
    flip("Drill: amoxicillin (250 mg tablet, or syrup 250 mg per 5 ml), twice daily for 5 days", [
        ("A 10-kg child classified as having pneumonia", "2 tablets, or 10 ml syrup"),
        ("A 7-kg child classified as having pneumonia", "1 tablet, or 5 ml syrup"),
        ("A 10-month-old child classified as having acute ear infection", "2 tablets, or 10 ml syrup"),
        ("A 5-kg child classified as having pneumonia", "1 tablet, or 5 ml syrup"),
        ("A 14-kg child classified as having pneumonia", "3 tablets, or 15 ml syrup"),
        ("An 11-kg child classified as having acute ear infection", "2 tablets, or 10 ml syrup"),
        ("A 6-kg child classified as having pneumonia", "1 tablet, or 5 ml syrup"),
    ]),
    flip("Drill: antibiotic for suspected cholera (erythromycin or tetracycline 250 mg, 4 times daily for 3 days)", [
        ("A 4-year-old child", "1 tablet"),
        ("A 14-kg child", "1 tablet"),
        ("A 6-month-old child", "No drug is needed because the child is less than 2 years of age."),
    ]),
], (7, 7))

L += lessons("1.2 and 1.3 Oral antimalarial and paracetamol",
    "Give the first-, second- and third-line antimalarial at the right dose, and paracetamol for high fever or ear pain.", [
    *A(M, 251, 326),
], (8, 9))

L += lessons("1.4 to 1.7 Vitamin A, iron, deworming and zinc",
    "Give vitamin A, iron, mebendazole or albendazole, and zinc at the right dose and schedule.", [
    *A(M, 327, 426),
], (9, 11))

L += lessons("1.8 Give ready to use therapeutic food (RUTF)",
    "Give RUTF to a child with uncomplicated severe acute malnutrition and teach the mother to give it.", [
    *A(M, 427, 497),
], (11, 13))

exB = B.exo("ex-b-oral-drugs", "Treat the child, Exercise B: appropriate oral drugs",
            "Write the drug, dose and schedule for each child.", 4020, 4060)
L += lessons("Exercise B: appropriate oral drugs",
    "Select the oral drugs, doses and schedules for six children.", [
    *A(M, 498, 548),
    exB,
    flip("Drill: Artemether-Lumefantrine (Coartem) for MALARIA: 1st dose, 2nd dose after 8 hours, then every 12 hours for 3 days", [
        ("A 10-kg child", "1 tablet each dose"),
        ("A 15-kg child", "2 tablets each dose"),
        ("A 5-month-old child", "1 tablet each dose"),
        ("An 18-month-old child classified as malaria and pneumonia, given amoxycillin for pneumonia", "2 tablets each dose"),
        ("A 6-kg child", "1 tablet each dose"),
    ]),
    discuss("Drill: paracetamol, iron and vitamin A. What drug, dose and schedule for each child? (Use your chart.)", 4128, 4157),
], (13, 13))

L += lessons("2.0 Use good communication skills: advise the mother",
    "Teach a mother to treat her child at home: give information, show an example, let her practise.", [
    *A(M, 549, 616),
], (14, 15))

L += lessons("2.2 Check the mother's understanding",
    "Ask good checking questions that the mother cannot answer with yes or no.", [
    *A(M, 617, 715),
], (15, 18))

exC = B.exo("ex-c-communication", "Treat the child, Exercise C: communication skills",
            "Answer the questions about how each health worker should teach the mother, and rewrite the questions as good checking questions.",
            4181, 4232)
L += lessons("Exercise C: communication skills",
    "Plan how to teach a mother, and turn yes-or-no questions into good checking questions.", [
    *A(M, 716, 766),
    exC,
    flip("Drill: rephrase each question as a good checking question", [
        ("Will you give your child the tablets as we discussed?", "When will you give your child the tablets? How many tablets will you give as one dose?"),
        ("You should breastfeed your child when he has diarrhoea, correct?", "How will you feed your child when he has diarrhoea? When should you breastfeed him?"),
        ("Do you know how to give your child half of a vitamin A capsule?", "Show me how you will give half of this vitamin A capsule to your child. When will you give the vitamin A capsule?"),
        ("Do you know what to do if your child cannot swallow this tablet?", "How will you prepare this tablet so that your child can swallow it?"),
        ("Do you know how to give the syrup?", "How will you give the syrup? How will you measure a dose of the syrup? Show me."),
        ("Will you give your child the iron syrup for the next 2 weeks?", "For how many days will you give the iron syrup to your child? How much syrup will you give each day?"),
        ("Can you take your child to the hospital?", "Who will take your child to the hospital? How will you travel with your child to the hospital?"),
        ("Will you return for a follow-up visit? Do you know when to return?", "When will you return for a follow-up visit?"),
    ]),
], (18, 18))

L += lessons("3.0 Teach the mother to give oral drugs at home",
    "Follow the steps to teach a mother to give an oral drug at home: determine the drug and dose, explain, show, let her practise, check.", [
    video("Teaching a mother to give oral drugs at home", "Demonstration role play: a health worker teaches Grace's mother to give amoxicillin.", "TR.2"),
    from_fg(4307, 4325),
    *A(M, 767, 897),
], (19, 22))

exD = B.exo("ex-d-wafaa", "Treat the child, Exercise D: teaching Wafaa's mother",
            "Wafaa needs an oral antibiotic. Answer the questions about how to teach her mother.", 4427, 4482)
L += lessons("Exercise D: teaching a mother to give an oral antibiotic",
    "Plan how to teach Wafaa's mother to give an oral antibiotic: dose, steps, label, checking questions, follow-up.", [
    *A(M, 898, 979),
    exD,
], (22, 23))

L += lessons("Exercise E: role play, teaching a mother to give oral drugs",
    "Practise teaching a mother to give oral drugs, using good communication skills.", [
    *A(M, 980, 1049),
    discuss("After the role play: did the health worker give information, show an example, let the mother practise and ask good checking questions?", 4483, 4522),
], (23, 25))

L += lessons("4.0 Teach the mother to treat local infections at home",
    "Explain how to teach a mother to treat a local infection at home.", [
    *A(M, 1050, 1097),
], (26, 27))

L += lessons("4.1 Treat eye infection with tetracycline eye ointment",
    "Teach a mother to clean the eyes and apply tetracycline eye ointment.", [
    *A(M, 1098, 1173),
    photo(29, "Photograph 29: pus draining from the eye."),
], (27, 28))

L += lessons("4.2 and 4.3 Dry the ear by wicking; treat mouth ulcers",
    "Teach a mother to dry the ear by wicking, and to treat mouth ulcers with half-strength gentian violet.", [
    *A(M, 1174, 1256),
    photo(24, "Photograph 24: a mouth ulcer."),
], (29, 30))

L += lessons("4.4 Soothe the throat, relieve the cough with a safe remedy",
    "Recommend safe remedies for sore throat and cough, and know the harmful ones; set the priority of advice.", [
    *A(M, 1257, 1326),
], (31, 32))

exF1 = B.exo("ex-f1-local-infections", "Treat the child, Exercise F part 1: treating local infections",
             "Answer the questions about teaching a mother to treat local infections at home.", 4533, 4598)
exF2 = B.exo("ex-f2-sumaia", "Treat the child, Exercise F part 2: Sumaia, priority of advice",
             "Sumaia is 3 years old. List her treatments, then decide which advice is most important and which could wait.", 4646, 4664,
             "Which treatments, instructions or advice are the most important for the health worker to teach the grandmother? Which could be omitted or delayed if she is overwhelmed?")
L += lessons("Exercise F: local infections and the priority of advice",
    "Answer questions on treating local infections, then decide the priority of advice for Sumaia's grandmother.", [
    *A(M, 1327, 1384),
    exF1,
    *A(M, 1385, 1398),
    note(fg(4604, 4621), "Your facilitator reads: Sumaia"),
    *A(M, 1399, 1512),
    note(fg(4625, 4645), "Your facilitator continues"),
    exF2,
], (32, 36))

L += lessons("Drill: review of assess and classify",
    "Review the classifications of the ASSESS & CLASSIFY chart before the clinical sessions.", [
    from_fg(4681, 4700),
    discuss("Drill: name the classification for each set of signs (use your chart, then open the answers).", 4739, 4842),
], None)

L += lessons("5.0 Give these treatments in clinic only: intramuscular antibiotic",
    "Give the first dose of intramuscular ampicillin and gentamicin before referral when a child cannot take oral drugs.", [
    *A(M, 1513, 1561),
], (37, 38))

L += lessons("5.2 Give quinine for very severe febrile disease",
    "Dilute quinine and give the right intramuscular dose before referral.", [
    *A(M, 1562, 1642),
], (38, 40))

L += lessons("5.3 Treat a convulsing child with diazepam",
    "Manage the airway and give rectal diazepam to a convulsing child.", [
    *A(M, 1643, 1705),
], (40, 41))

L += lessons("5.4 Treat wheezing with a rapid acting bronchodilator",
    "Give inhaled salbutamol with a spacer, or oral salbutamol, to a child with wheezing.", [
    *A(M, 1706, 1751),
], (42, 43))

L += lessons("5.5 Treat the child to prevent low blood sugar",
    "Prevent low blood sugar with breast milk, milk or sugar water, by mouth or naso-gastric tube.", [
    *A(M, 1752, 1787),
], (43, 43))

exG = B.exo("ex-g-clinic-doses", "Treat the child, Exercise G: doses of treatments given in clinic",
            "Determine the correct doses of the treatments given in clinic only.", 4852, 4881)
L += lessons("Exercise G: treatments given in clinic only",
    "Determine the correct doses of intramuscular antibiotics, quinine, diazepam and sugar water.", [
    *A(M, 1788, 1837),
    exG,
    note("Part 2 (in the classroom): your facilitator sets out an assortment of drugs so you can practise handling and measuring them.", "From your facilitator"),
], (44, 44))

L += lessons("6.0 and 6.1 Plan A: treat diarrhoea at home",
    "Teach the four rules of home treatment: extra fluid, zinc, continued feeding, when to return.", [
    *A(M, 1838, 2030),
], (45, 49))

exH = B.exo("ex-h-plan-a", "Treat the child, Exercise H: Plan A, treat diarrhoea at home",
            "Answer the questions about children with diarrhoea treated on Plan A.", 4892, 4964)
L += lessons("Exercise H: Plan A",
    "Apply Plan A to children with diarrhoea and NO DEHYDRATION.", [
    *A(M, 2031, 2130),
    exH,
], (49, 50))

L += lessons("6.2 Plan B: treat some dehydration with ORS",
    "Give the right amount of ORS in the clinic over 4 hours, then reassess and choose the next plan.", [
    *A(M, 2131, 2287),
], (51, 54))

exI = B.exo("ex-i-plan-b", "Treat the child, Exercise I: Plan B, treat some dehydration with ORS",
            "Answer the questions about children with SOME DEHYDRATION treated on Plan B.", 4973, 5014)
L += lessons("Exercise I: Plan B",
    "Work out the amount of ORS and the steps of Plan B for children with SOME DEHYDRATION.", [
    *A(M, 2288, 2364),
    exI,
    flip("Drill: approximate amount of ORS solution in the first 4 hours (Plan B)", [
        ("12 kg", "960 – 1600 ml"), ("4 months old, 4 kg", "200 – 450 ml"), ("5 months old", "450 – 800 ml"),
        ("10 months old, 8 kg", "450 – 800 ml"), ("10 kg", "800 – 960 ml"), ("4 years old, 13 kg", "960 – 1600 ml"),
        ("15 months old", "800 – 960 ml"), ("1 year old, 8 kg", "450 – 800 ml"), ("3 kg", "200 – 450 ml"),
        ("8.5 kg", "450 – 800 ml"), ("8 months old, 6 kg", "450 – 800 ml"), ("18 months old, 10 kg", "800 – 960 ml"),
        ("4½ years old", "960 – 1600 ml"), ("5.5 kg", "200 – 450 ml"),
    ]),
    note("The amounts are guides. If a child wants more or less ORS solution, give him what he wants. "
         "To calculate: the child's weight in kg multiplied by 75 ml.", "From your facilitator"),
], (54, 55))

L += lessons("Exercise J: role play, caring for a dehydrated child",
    "Practise teaching a mother to give ORS in the clinic on Plan B, then to treat at home on Plan A.", [
    *A(M, 2365, 2415),
    discuss("After the role play: what did the health worker do well, and what was missed?", 5097, 5159),
], (55, 56))

L += lessons("6.3 Plan C: treat severe dehydration quickly",
    "Use the Plan C flowchart to choose the annex that matches your clinic.", [
    video("Reading the Plan C flowchart", "Demonstration: how to read the Plan C flowchart and choose an annex.", "TR.3"),
    from_fg(5193, 5207),
    *A(M, 2416, 2518),
], (57, 58))

mark(M, 2650, 2679)   # the annex title page (the annexes are lessons of their own)

exC1 = B.exo("ex-annex-c1", "Treat the child, Exercise Annex C-1: if you can give IV treatment",
             "Answer the questions about Yahia and Khamis.", 5214, 5260)
L += lessons("Annex C-1: if you can give intravenous (IV) treatment",
    "Give IV fluid for severe dehydration at the right amount and rate, monitor the child and reassess.", [
    *A(M, 2788, 3096),
    exC1,
    flip("Drill: amount of IV fluid on Plan C (total, then first give, then give)", [
        ("14 months, 9 kg", "900 ml in 3 hrs: 270 ml in 30 mins, then 630 ml in 2½ hrs"),
        ("8 months, 7 kg", "700 ml in 6 hrs: 210 ml in 1 hour, then 490 ml in 5 hrs"),
        ("3 years, 13 kg", "1300 ml in 3 hrs: 390 ml in 30 mins, then 910 ml in 2½ hrs"),
        ("3 months, 5 kg", "500 ml in 6 hrs: 150 ml in 1 hour, then 350 ml in 5 hrs"),
        ("2 years, 12 kg", "1200 ml in 3 hrs: 360 ml in 30 mins, then 840 ml in 2½ hrs"),
        ("15 months, 10 kg", "1000 ml in 3 hrs: 300 ml in 30 mins, then 700 ml in 2½ hrs"),
        ("4 years, 15 kg", "1500 ml in 3 hrs: 450 ml in 30 mins, then 1050 ml in 2½ hrs"),
        ("23 months, 11.5 kg", "1150 ml in 3 hrs: 345 ml in 30 mins, then 805 ml in 2½ hrs"),
        ("6 months, 6 kg", "600 ml in 6 hrs: 180 ml in 1 hour, then 420 ml in 5 hrs"),
        ("12 months, 8 kg", "800 ml in 3 hrs: 240 ml in 30 mins, then 560 ml in 2½ hrs"),
        ("11½ months, 8 kg", "800 ml in 6 hrs: 240 ml in 1 hour, then 560 ml in 5 hrs"),
    ]),
], (66, 72))

exC2 = B.exo("ex-annex-c2", "Treat the child, Exercise Annex C-2: if IV treatment is available nearby",
             "Answer the questions about Gabriel.", 5322, 5331)
L += lessons("Annex C-2: if IV treatment is available nearby",
    "Refer urgently for IV treatment, giving ORS on the way.", [
    *A(M, 3097, 3211),
    exC2,
], (73, 74))

exC3 = B.exo("ex-annex-c3", "Treat the child, Exercise Annex C-3: if you are trained to use an NG tube",
             "Answer the questions about Osman and Sharifa.", 5339, 5403)
L += lessons("Annex C-3: if you are trained to use a naso-gastric (NG) tube",
    "Rehydrate with ORS by NG tube at 20 ml/kg/hour for 6 hours, and monitor the child.", [
    *A(M, 3212, 3478),
    exC3,
], (75, 79))

exC4 = B.exo("ex-annex-c4", "Treat the child, Exercise Annex C-4: if you can only give Plan C by mouth",
             "Answer the questions about Saif, Eltayib, Hossam and Rashid.", 5412, 5445)
L += lessons("Annex C-4: if you can only give Plan C treatment by mouth",
    "Decide when ORS by mouth is the only choice, and how to give and monitor it.", [
    *A(M, 3479, 3703),
    exC4,
], (80, 83))

L += lessons("Annex A: Nasogastric rehydration",
    "Review how to place a naso-gastric tube and give ORS through it.", [*A(M, 2680, 2731)], (63, 64))
L += lessons("Annex B: ORT corner",
    "Set up and run an ORT corner.", [*A(M, 2732, 2787)], (65, 65))
L += lessons("Annex D: Intravenous treatment for severe dehydration",
    "Review the technique of giving IV fluid and the solutions to use.", [*A(M, 3704, 3776)], (84, 85))

L += lessons("6.4 to 7.0 Persistent diarrhoea, dysentery, cholera and immunization",
    "Treat persistent diarrhoea, dysentery and cholera, and immunize every sick child as needed.", [
    *A(M, 2519, 2597),
], (59, 60))

exK = B.exo("ex-k-immunize", "Treat the child, Exercise K: whether to immunize",
            "Decide which immunizations each child should be given today.", 5171, 5190)
L += lessons("Exercise K: immunize every sick child, as needed",
    "Decide which vaccines Huwida, the 15-day-old infant and Rasha need today.", [
    *A(M, 2598, 2649),
    exK,
], (60, 61))

L += lessons("Annex E: Where referral is not possible",
    "Treat a child with a severe classification when referral is not possible.", [
    *A(M, 3777, len(__import__("src").SRC[M])),
    facil("Summary of the module: select oral drugs and their doses; teach the mother with good communication skills (give "
          "information, show an example, let her practise, check her understanding); treat local infections; give the treatments "
          "given in clinic only; treat diarrhoea with Plan A, B or C; immunize every sick child as needed."),
], (86, 86))

MODULE = module("Module 4: Treat the child", 4, L)
mark(M, 1, 67)
