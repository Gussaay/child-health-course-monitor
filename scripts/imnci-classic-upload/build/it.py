# Module 3 of the classic Sudan IMNCI course: Identify treatment (2023 book), in
# the order of the facilitator guide (Dec 2021). Book text word for word.
from src import T, lines, join, mark, layout, text_of
from lib import *

M = "it"
SOURCE = "Sudan IMNCI module: Identify treatment (2023)"
EXERCISES = []
_ord = [200]

def qz(eid, title, narrative, questions, minutes=8):
    _ord[0] += 1
    e = quiz(eid, _ord[0], title, narrative, questions, SOURCE, minutes)
    EXERCISES.append(e)
    return ex(e["id"], e["title"].replace("Sudan IMNCI: ", ""))

CHECK = H("Check yourself")

I1 = lesson("Introduction to identify treatment",
    "Say what this module teaches: deciding on urgent referral and identifying the treatments a sick child needs.", [
    video("Identify treatment: an overview", "The narration is being recorded.", "IT.1"),
    *T(M, 31, 51),
    facil("This module describes the final step on the ASSESS & CLASSIFY chart: Identify Treatment. Read across the chart from each "
          "classification to the list of treatments needed. For example, find PNEUMONIA and read its treatments; then diarrhoea with NO "
          "DEHYDRATION; then DYSENTERY. Severe classifications usually require referral: “Refer URGENTLY to hospital”. This module does not "
          "describe how to do the treatments, only how to identify which treatments are needed."),
], (3, 3))

I2 = lesson("The steps, and what the coloured rows mean",
    "Follow the flowchart for identifying treatment, and say what the pink, yellow and green rows mean for treatment.", [
    *T(M, 53, 58),
    pre(layout(M, 59, 75)),
    fig("it-flowchart", "The flowchart in the book.", 4),
    *T(M, 77, 117),
    CHECK,
    sort("What does the row tell you to do?", ["Pink row", "Yellow row", "Green row"], [
        ("Urgent referral or admission for inpatient care", "Pink row"),
        ("An appropriate oral drug or other treatment, taught to the mother", "Yellow row"),
        ("No specific medical treatment such as antibiotics: teach home care and when to return immediately", "Green row"),
    ]),
    q("Is wicking an ear necessary before referral?", ["Yes", "No"], 1, "Some treatments (such as wicking an ear) are not necessary before referral."),
], (4, 5))

I3 = lesson("Referral for severe classifications, and Plan C",
    "List the severe classifications that need urgent referral, and the exceptions for severe persistent diarrhoea and severe dehydration.", [
    *T(M, 119, 147),
    pre(layout(M, 148, 161)),
    *T(M, 163, 163),
    pre(layout(M, 166, 196)),
    fig("it-plan-c", "Decisions involved in Plan C, in the book.", 7),
    *T(M, 198, 200),
    facil("Most severe classifications require urgent referral. Exception: if the only severe classification is SEVERE PERSISTENT "
          "DIARRHOEA, the child needs referral but not as urgently. If a child's only severe classification is SEVERE DEHYDRATION, you may "
          "keep and treat the child if your clinic can (this includes a child whose general danger sign comes from the dehydration). Think "
          "through the decisions for your own clinic for a child with SEVERE DEHYDRATION who cannot drink."),
    steps("Decisions in Plan C, one at a time", [
        ("Can you give intravenous (IV) fluid immediately?", "YES: give IV fluid at your facility. NO: next question."),
        ("Is IV treatment available nearby (within 30 minutes)?", "YES: refer URGENTLY to hospital. NO: next question."),
        ("Are you trained to use a naso-gastric (NG) tube for rehydration?", "YES: give ORS by NG tube or by mouth. NO: next question."),
        ("Can the child drink?", "YES: give ORS by NG tube or by mouth. NO: refer URGENTLY to hospital for IV or NG treatment."),
    ]),
], (6, 7))

I4 = lesson("Referral for general danger signs and other severe problems",
    "Refer a child with a general danger sign and no severe classification, or with another severe problem you cannot treat.", [
    *T(M, 203, 232),
    CHECK,
    q("A child has a general danger sign but no severe classification. What do you do?",
      ["Treat at home", "Refer urgently after the first dose of an appropriate antibiotic and other urgent treatments"], 1,
      "MAKE SURE A CHILD WITH ANY GENERAL DANGER SIGN IS REFERRED after first dose of an appropriate antibiotic and other urgent pre-referral treatments."),
], (8, 8))

exA = qz("sudan-imnci-it-ex-a-referral", "Identify treatment, Exercise A: is urgent referral needed?", [text_of(M, 237, 238)], [
    mcq("a1", text_of(M, 239, 245), ["Yes", "No"], 1, "No. Neema has no general danger signs and no severe classifications."),
    mcq("a2", text_of(M, 247, 252), ["Yes", "No"], 0, "Yes. Daoud has a severe classification: MASTOIDITIS."),
    mcq("a3", text_of(M, 254, 258), ["Yes", "No"], 0, "Yes. Maher has a general danger sign: convulsions."),
    mcq("a4", text_of(M, 260, 265), ["Yes", "No"], 1, "No. Habib's general danger sign may be related to dehydration, and his only severe classification is "
        "SEVERE DEHYDRATION. Since this clinic can give IV therapy, Habib should be given IV therapy at the clinic."),
    mcq("a5", text_of(M, 267, 272), ["Yes", "No"], 0, "Yes. His only severe classification is SEVERE DEHYDRATION, so use Plan C. The clinic cannot provide "
        "IV or NG therapy and he cannot drink: refer him for IV therapy."),
])

I5 = lesson("Exercise A: is urgent referral needed?",
    "Decide for five children whether urgent referral is needed.", [
    *T(M, 235, 235),
    exA,
    *T(M, 274, 274),
    facil("If a child with SEVERE DEHYDRATION also has another severe classification, refer: special expertise is required to rehydrate "
          "this child. If there is no other severe classification, use Plan C to decide whether to rehydrate at your clinic or refer."),
], (9, 9))

I6 = lesson("Identify treatments for children who do not need urgent referral",
    "List each treatment needed on the back of the Recording Form, with the earliest definite follow-up.", [
    *T(M, 277, 339),
    facil("Fold the “Classify” column of the Recording Form so that you can see it while looking at the back. List the treatments across "
          "from each classification. Write only the relevant treatments. “Advise mother when to return immediately” is already printed on "
          "the form, so do not list it again. If you list several follow-up times, tell the mother the earliest definite time and record it "
          "in the space on the form."),
    CHECK,
    q("A child needs “Follow-up in 3 days if fever persists” and “Follow-up in 5 days”. What is the earliest definite follow-up?",
      ["3 days", "5 days"], 1, "A definite time is one that is not followed by the word \"if\". \"Follow-up in 3 days if fever persists\" is not definite."),
    q("A child has PNEUMONIA and DYSENTERY. Both need an antibiotic. How do you list them?",
      ["Write the antibiotic once", "List the antibiotic for each problem"], 1,
      "If an antibiotic is needed for more than one problem, you should list it each time: two problems may require different antibiotics."),
], (10, 11))

mark(M, 350, 460)
I7 = lesson("Example: Intisar's Recording Form",
    "Read how a health worker listed the treatments for Intisar on the back of the Recording Form.", [
    *T(M, 340, 347),
    pagepic("it-p12-intisar", 12, "The front of Intisar's Recording Form."),
    pagepic("it-p13-intisar", 13, "The back of Intisar's Recording Form: the treatments the health worker listed."),
    facil("The treatment that begins “If child also has wheeze” is not written, because Intisar does not have wheeze. All the treatments "
          "for MALARIA are relevant and are written. Intisar is 1½ years old, so “If child is less than 2 years old, assess the child's "
          "feeding” is written. The earliest definite follow-up, 3 days, is in the space on the form."),
    reveal("Intisar has 46 breaths per minute at 18 months and a positive malaria test. What are her classifications, and why does she not "
           "need referral?", "PNEUMONIA (fast breathing: 40 or more at 12 months up to 5 years), MALARIA, NO ACUTE MALNUTRITION and NO "
           "ANAEMIA. She has no general danger signs and no severe classifications, so she is treated in the clinic."),
], (11, 13))

exB = qz("sudan-imnci-it-ex-b-mai", "Identify treatment, Exercise B: treatments for Mai", [text_of(M, 465, 473)], [
    open_q("b_a", "A. What treatments are needed for FEVER- NO MALARIA?", [
        "Give one dose of paracetamol in clinic for high fever (38.5°C or above).",
        "Give appropriate antibiotic treatment for an identified bacterial cause of fever.", "Advise the mother when to return immediately.",
        "Follow-up in 3 days if fever persists."]),
    open_q("b_b", "B. What treatments are needed for MEASLES WITH EYE COMPLICATIONS?", [
        "Give vitamin A treatment.", "If pus draining from the eye, treat eye infection with tetracycline eye ointment.", "Follow-up in 3 days."]),
    open_q("b_c", "C. Look in the \"Identify Treatment\" column for NO ANAEMIA.", [
        "If child is less than 2 years old, assess the child's feeding and counsel the mother according to the feeding recommendations.",
        "If feeding problem, follow-up in 5 days."]),
    mcq("b_d", "D. Does May need a feeding assessment?", ["Yes", "No"], 0, "Yes, because she is less than 2 years old."),
    open_q("b_e", "E. What immunization does May need?", ["Measles immunization (and, by the schedule, the other 9-month vaccines: yellow fever and Men A)."]),
    mcq("b_f", "F. Should she be given vitamin (A) supplementation today?", ["Yes", "No"], 0, "Yes, she should receive vitamin A supplementation."),
    mcq("b_g", "G. What is earliest definite time for May to return for follow-up?", ["2 days", "3 days", "5 days"], 1, "3 days."),
], 12)
mark(M, 475, 501)

I8 = lesson("Exercise B: treatments for Mai",
    "Identify the treatments, immunizations, vitamin A and follow-up for a child who does not need referral.", [
    *T(M, 463, 465),
    booklet(["fever", "measles", "anemia"], "The treatments in your chart booklet (Sudan national protocol)."),
    exB,
], (14, 14))

exC = qz("sudan-imnci-it-ex-c-return", "Identify treatment, Exercise C: when to return immediately", [text_of(M, 542, 543)], [
    open_q("c1", text_of(M, 545, 550), ["Not able to drink or breastfeed", "Becomes sicker", "Develops a fever"]),
    open_q("c2", text_of(M, 555, 561), ["Not able to drink or breastfeed", "Becomes sicker", "Develops a fever", "Blood in stool", "Drinking poorly"]),
    open_q("c3", text_of(M, 566, 571), ["Not able to drink or breastfeed", "Becomes sicker", "Develops a fever", "Fast breathing", "Difficult breathing"]),
], 8)
mark(M, 551, 553); mark(M, 562, 564); mark(M, 572, 574)

I9 = lesson("When to return immediately, and Exercise C",
    "Teach the mother the signs that mean she must return immediately.", [
    *T(M, 504, 537),
    sort("Which signs do you teach this mother?", ["Every mother", "Child with cough or cold", "Child with diarrhoea"], [
        ("Not able to drink or breastfeed", "Every mother"), ("Becomes sicker", "Every mother"), ("Develops fever", "Every mother"),
        ("Fast breathing", "Child with cough or cold"), ("Difficult breathing", "Child with cough or cold"),
        ("Blood in the stool", "Child with diarrhoea"), ("Poor drinking", "Child with diarrhoea"),
    ]),
    H("Exercise C"),
    *T(M, 540, 540),
    exC,
    *T(M, 576, 576),
    facil("When speaking with mothers of children with diarrhoea, combine “not able to drink or breastfeed” and “drinking poorly”: drinking "
          "poorly includes not able to drink. Use the Mother's Card to help teach the mother the signs."),
    flip("Drill: signs to return immediately", [
        ("PNEUMONIA, follow-up in 3 days, no fever", "Not able to drink or breastfeed; becomes sicker; develops a fever."),
        ("DYSENTERY, follow-up in 3 days", "Not able to drink or breastfeed; becomes sicker; develops a fever; drinking poorly. (Blood in "
         "stool is omitted because the child already has this sign.)"),
        ("ACUTE EAR INFECTION and MALARIA", "Not able to drink or breastfeed; becomes sicker. (Develops a fever is omitted because the child already has fever.)"),
        ("COUGH OR COLD, seen again in 5 days about a feeding problem", "Not able to drink or breastfeed; becomes sicker; develops a fever; fast breathing; difficult breathing."),
        ("Diarrhoea with NO DEHYDRATION, back in 5 days if not better", "Not able to drink or breastfeed; becomes sicker; develops a fever; blood in stool; drinking poorly."),
        ("MEASLES WITH EYE OR MOUTH COMPLICATIONS and MALARIA", "Not able to drink or breastfeed; becomes sicker."),
        ("CHRONIC EAR INFECTION and COUGH OR COLD, no fever", "Not able to drink or breastfeed; becomes sicker; develops fever; fast breathing; difficult breathing."),
    ]),
], (15, 16))

I10 = lesson("Identify urgent pre-referral treatments",
    "Identify the urgent treatments to give before referral, and the ones that must not delay it.", [
    *T(M, 580, 625),
    booklet(["danger", "cough", "fever"], "Urgent pre-referral treatments are in bold print on the chart."),
    CHECK,
    sort("Before referral, or not?", ["Give before referral", "Do not delay referral for it"], [
        ("Diazepam for a child who is convulsing now", "Give before referral"), ("First dose of an appropriate antibiotic", "Give before referral"),
        ("Treatment to prevent low blood sugar", "Give before referral"), ("Vitamin A for treatment of measles", "Give before referral"),
        ("Wicking the ear", "Do not delay referral for it"), ("Oral iron treatment", "Do not delay referral for it"),
        ("Immunizations", "Do not delay referral for it"), ("Teaching a safe remedy to soothe the throat", "Do not delay referral for it"),
    ]),
], (17, 17))

D1 = ["a. soothe the throat and relieve cough with a safe remedy.", "b. Advise the mother when to return immediately.",
      "c. Follow-up in 5days if not better.", "d. Give first dose of an appropriate antibiotic.", "e. Give first dose of paracetamol for pain.",
      "f. Refer URGENTLY to hospital.", "g. Assess the child’s feeding and counsel the mother on feeding. If feeding problem, follow-up in 5 days."]
D2 = ["a) Give fluid and food to prevent dehydration (plan A).", "b) Advise the mother when to return immediately.",
      "c) Advise the mother on feeding a child who has persistent diarrhoea.", "d) Follow-up in 5days.", "e) Give vitamin A.",
      "f) Refer URGENTLY to hospital.", "g) Treat to prevent low blood sugar."]
D3 = ["a) Give quinine for very severe febrile disease (first dose).", "b) Give first dose of an appropriate antibiotic.",
      "c) Treat the child to prevent low blood sugar.", "d) Give one dose of paracetamol in clinic for high fever (38.5°C or above).",
      "e) Refer URGENTLY to hospital.", "f) Dry the ear by wicking", "g) Follow-up in 5days.",
      "h) Assess the child’s feeding and counsel the mother on feeding. If feeding problem, follow-up in 5 days.", "i) Give iron.",
      "j) Give oral antimalarial.", "k) Advise mother when to return immediately.", "l) Follow-up in 14 days (for pallor)."]
exD = qz("sudan-imnci-it-ex-d-prereferral", "Identify treatment, Exercise D: urgent pre-referral treatments", [text_of(M, 629, 630)], [
    mcq("d1", text_of(M, 632, 637) + " (Tick all that apply.)", D1, [3, 4, 5],
        "d, e and f. Soothing the throat is not urgent; the hospital will explain when to return and about follow-up; there is no time or "
        "need to assess feeding before referral."),
    mcq("d2", text_of(M, 648, 654) + " (Tick all that apply.)", D2, [4, 5, 6],
        "e and f (the facilitator guide's answer), and g: treatment to prevent low blood sugar is one of the urgent treatments in this "
        "module's list. Plan A is not urgent and takes considerable time; the hospital will explain feeding, follow-up and when to return."),
    mcq("d3", text_of(M, 664, 671) + " (Tick all that apply.)", D3, [0, 1, 2, 3, 4],
        "a to e. Wicking takes a long time and is not urgent. Iron is not urgent. Since quinine is given, an oral antimalarial is not needed. "
        "The hospital will explain follow-up and when to return."),
    open_q("d4", text_of(M, 689, 691) + " Abbas: 15 months, 9 kg, 39°C, cough for 6 days with 38 breaths per minute, a generalized rash of "
           "measles with clouding of the cornea, and a positive malaria test. Classified COUGH OR COLD, MALARIA, MEASLES WITH SEVERE "
           "COMPLICATIONS, NO ACUTE MALNUTRITION, NO ANAEMIA.", [
        "Vitamin A.", "First dose of an appropriate antibiotic.", "Tetracycline eye ointment (clouding of the cornea).",
        "Paracetamol for high fever (39°C).", "Oral antimalarial (first dose) for MALARIA, as in the facilitator guide's answer.",
        "Refer URGENTLY to hospital.", "Not before referral: soothe the throat, follow-up, when to return, feeding assessment."]),
], 12)
mark(M, 639, 646); mark(M, 656, 662); mark(M, 673, 687); mark(M, 694, 789)

I11 = lesson("Example Nagla, and Exercise D",
    "Pick out the urgent pre-referral treatments from all the treatments a child's classifications list.", [
    pagepic("it-p20-abbas", 20, "Abbas's Recording Form, for question 4."),
    pagepic("it-p21-abbas", 21, "The back of the form: write only the urgent pre-referral treatments."),
    *T(M, 627, 627),
    exD,
    facil("Urgent pre-referral treatments are in bold print on the ASSESS & CLASSIFY chart. On Abbas's form write only “Refer URGENTLY” and "
          "the urgent pre-referral treatments."),
], (18, 21))

I12 = lesson("Give urgent pre-referral treatment, and refer the child",
    "Give pre-referral treatment quickly, and do the four steps to refer a child.", [
    *T(M, 791, 868),
    steps("The four steps to refer a child", [
        ("Explain", "Explain to the mother the need for referral, and get her agreement to take the child. If she does not want to, find out why."),
        ("Calm her fears", "Calm the mother's fears and help her to resolve any problem."),
        ("Write a referral note", "For the mother to take with her to the hospital to give the health worker there."),
        ("Give supplies and instructions", "Give the mother any supplies and instructions needed to care for her child on the way to the hospital."),
    ]),
    CHECK,
    q("A child who needs a pre-referral antibiotic is vomiting everything. Which antibiotic do you give?",
      ["An oral antibiotic", "An intramuscular injection antibiotic"], 1,
      "The child with these danger signs will need to be given an intramuscular injection antibiotic instead of an oral antibiotic."),
], (22, 23))

I13 = lesson("Example of a referral note",
    "Write a referral note with everything the hospital health worker needs.", [
    *T(M, 871, 871),
    pre(layout(M, 873, 891)),
    sort("Is it in the referral note?", ["Write it in the note", "Not needed in the note"], [
        ("The date and time of referral", "Write it in the note"), ("Treatment that you have given", "Write it in the note"),
        ("Reason for referral (symptoms and signs leading to severe classification)", "Write it in the note"),
        ("Immunizations needed", "Write it in the note"), ("Your name and the name of your clinic", "Write it in the note"),
    ]),
], (24, 24))

mark(M, 910, 1007); mark(M, 902, 907); mark(M, 1013, 1013); mark(M, 1033, 1043)
exE = qz("sudan-imnci-it-ex-e-sulieman", "Identify treatment, Exercise E: Sulieman's referral", [text_of(M, 896, 900)], [
    open_q("e1", "1. Should Sulieman be referred urgently? Why or why not?", [
        "By the Recording Form printed in this book: PNEUMONIA (54 breaths per minute, no chest indrawing circled), NO DEHYDRATION, MALARIA, "
        "NO ACUTE MALNUTRITION, NO ANAEMIA, and no general danger sign: no severe classification, so no urgent referral.",
        "The facilitator guide's answer: Sulieman should be referred for SEVERE PNEUMONIA OR VERY SEVERE DISEASE (cough, chest indrawing, "
        "fast breathing). Your facilitator tells you which to use."]),
    open_q("e2", "2. What urgent, pre-referral treatments are needed? Record these on the back of the Sick Child Recording Form.", [
        "If referred: the first dose of an antibiotic (amoxicillin) and an antimalarial (ALu), as in the facilitator guide.",
        "Do not give immunizations before referral: write that he needs OPV 2 and Penta 2 (and PCV 2 and Rota 2)."]),
    open_q("e3", text_of(M, 1010, 1011), [
        "Today's date and the current time; Urgent referral to (the hospital).",
        "Sulieman, age 4 months.",
        "Reason: SEVERE PNEUMONIA OR VERY SEVERE DISEASE: cough, chest indrawing, fast breathing 54 breaths per minute; also MALARIA, temperature 38°C.",
        "Has been given: amoxicillin and ALu.", "Needs: Penta 2 and OPV 2.", "Your name and your clinic."]),
], 20)

I14 = lesson("Exercise E: Sulieman's referral and role play",
    "Decide on referral for Sulieman, write his pre-referral treatments and a referral note, and explain referral to his mother.", [
    *T(M, 894, 900),
    pagepic("it-p26-sulieman", 26, "Sulieman's Recording Form."),
    pagepic("it-p27-sulieman", 27, "The back of Sulieman's form."),
    exE,
    *T(M, 1015, 1016),
    H("Role play"),
    *T(M, 1019, 1031),
    story("Role play: Sulieman's mother", [
        stage("Sulieman is your second child. You also have a 2-year-old son who is at home with your mother-in-law. You did not bring much "
              "money with you. Your home is about 20 minutes away on foot and you walked to the clinic. There is no phone in your home, but "
              "there is a phone at the place where your husband works. (The mother's card, from the facilitator guide.)"),
        stage("You want to do what is right for Sulieman, but you are concerned about how to get to the hospital and how to communicate with "
              "your family. A child in your community recently died at the hospital. You are very worried that Sulieman is going to die.",
              "As the health worker, what do you do first?",
              ["Tell her the hospital is far and she should decide herself", "Calm her fears: the hospital has specialists and equipment that "
               "can help cure her child, and explain what will happen there", "Give the full course of antibiotics and send her home"], 1,
              "Calm the mother's fears and help her to resolve any problem."),
        stage("She is worried about her other son and about money for transport.", "What else can you do?",
              ["Ask who could help at home (her mother-in-law), and discuss how she can travel; help arrange transportation, and use the "
               "phone at her husband's work to tell the family", "Nothing more"], 0,
              "If the mother needs help at home, ask questions and make suggestions about who could help. Discuss how she can travel to the "
              "hospital and help arrange transportation if necessary."),
    ]),
    reveal("Observers: is this mother likely to go to the hospital? Has she been given all the necessary instructions?",
           "Check that the health worker explained the need for referral, calmed her fears, gave a referral note, and gave supplies and "
           "instructions for the way: extra doses of antibiotic if the hospital is far, keeping the child warm, continuing breastfeeding.",
           "Discuss"),
    facil("Summary of the module: determine if urgent referral is needed; for a child who does not need it, identify the treatments, the "
          "earliest definite follow-up and when to return immediately; for a child who needs it, identify and give the urgent pre-referral "
          "treatments, explain the need for referral to the mother, write the referral note, and refer."),
], (25, 29))

MODULE = module("Module 3: Identify treatment", 3, [I1, I2, I3, I4, I5, I6, I7, I8, I9, I10, I11, I12, I13, I14])
mark(M, 1, 30)
# Exercise items placed in the exercises; case headings.
mark(M, 237, 272); mark(M, 465, 501); mark(M, 542, 575); mark(M, 629, 692); mark(M, 896, 900); mark(M, 1010, 1011)
mark(M, 577, 577)
