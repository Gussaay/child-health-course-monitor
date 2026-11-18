# Module 2 of the classic Sudan IMNCI course: Assess and classify the sick child
# age 2 months up to 5 years (2023 book), in the order of the facilitator guide
# (Dec 2021). The book's text is used word for word (src.T, src.layout); the
# activities, drills and facilitator notes only repeat the book and the guide.
from src import T, P, lines, join, mark, layout, text_of
from lib import *

M = "ac"
SOURCE = "Sudan IMNCI module: Assess and classify the sick child (2023)"
EXERCISES = []
_ord = [100]

def add(e):
    EXERCISES.append(e)
    return ex(e["id"], e["title"].replace("Sudan IMNCI: ", ""))

def nx():
    _ord[0] += 1
    return _ord[0]

def kase(eid, title, narrative, sections, patient, assessments, classifications, points, minutes=10):
    return add(case(eid, nx(), title, narrative, sections, patient, assessments, classifications, points, SOURCE, minutes))

def qz(eid, title, narrative, questions, minutes=5):
    return add(quiz(eid, nx(), title, narrative, questions, SOURCE, minutes))

def pt(name, sex, age, kg, cm, temp):
    return {"childName": name, "sex": sex, "ageMonths": age, "weightKg": kg, "lengthCm": cm, "tempC": temp, "visitType": "initial"}

def drill(title, pairs):
    """A facilitator-guide drill: the question on the front, the guide's answer on the back."""
    return flip(title, pairs)

CHECK = H("Check yourself")
FORM_NOTE = "On the paper Recording Form in your book this part of the form looks like this:"

# ---------------------------------------------------------------- introduction
A1 = lesson("Introduction to assess and classify",
    "Say what the ASSESS AND CLASSIFY chart helps you do, and list what you will learn in this module.", [
    video("Assess and classify: an overview", "The narration is being recorded.", "AC.1"),
    *T(M, 50, 86),
    facil("The ASSESS & CLASSIFY chart has three columns: Assess, Classify as, and Identify treatment. In this module you use the first "
          "two. Keep your chart booklet open beside you: from now on you will look at the chart at every step."),
    CHECK,
    q("Which four main symptoms do you ask about for every sick child?",
      ["Cough or difficult breathing, diarrhoea, fever and ear problem", "Fever, rash, vomiting and convulsions",
       "Cough, malnutrition, anaemia and fever"], 0,
      "Ask about the four main symptoms: cough or difficult breathing, diarrhea, fever and ear problem."),
], (3, 4))

A2 = lesson("Ask the mother what the child's problems are",
    "Greet the mother, find the child's age, ask about the problems with good communication, and decide if this is an initial or "
    "follow-up visit.", [
    *T(M, 88, 158),
    sort("Initial visit or follow-up visit?", ["Initial visit", "Follow-up visit"], [
        ("This is the child's first visit for this episode of an illness or problem.", "Initial visit"),
        ("The child was seen a few days ago for the same illness.", "Follow-up visit"),
        ("The health worker finds out if the treatment given at the first visit has helped the child.", "Follow-up visit"),
    ]),
    CHECK,
    q("Why is it important to ask the mother about the child's problems?",
      ["To open good communication with the mother", "To decide the dose of antibiotic", "To shorten the visit"], 0,
      "An important reason for asking this question is to open good communication with the mother."),
    q("A mother brings her child for immunization. He is well. Do you use the ASSESS & CLASSIFY chart?",
      ["Yes, for every child", "No, the chart should not be used for a well child brought for immunization"], 1,
      "The chart should not be used for a well-child brought for immunization or for a child with an injury or burn."),
], (5, 6))

A3 = lesson("Check for general danger signs",
    "Ask and look for the five general danger signs, and know what to do when a child has one.", [
    *T(M, 160, 175),
    *T(M, 176, 176),
    pre(layout(M, 177, 192)),
    booklet(["danger"], "The same box in your chart booklet (Sudan national protocol)."),
    reveal("Name the five general danger signs.", "Not able to drink or breastfeed; vomits everything; has had convulsions; lethargic or "
           "unconscious; convulsing now."),
], (7, 7))

A3b = lesson("Ask and look for each general danger sign",
    "Decide if a child is not able to drink, vomits everything, has had convulsions, is lethargic or unconscious, or is convulsing now.", [
    video("Checking for general danger signs", "The narration is being recorded.", "AC.2"),
    *T(M, 194, 257),
    CHECK,
    q("A child vomits several times, but can hold down some fluids. Does he have the general danger sign “vomits everything”?",
      ["Yes", "No"], 1,
      "A child who vomits several times but can hold down some fluids does not have this general danger sign."),
    q("A breastfed child cannot suck. His nose is blocked. After you clear the nose he breastfeeds well. Is he “not able to drink or "
      "breastfeed”?", ["Yes", "No"], 1,
      "If the child can breastfeed after his nose is cleared, the child does not have the danger sign, \"not able to drink or breastfeed.\""),
    q("A sleeping child has cough. What do you do first?", ["Wake him to look for lethargy", "Count the number of breaths first"], 1,
      "If the child is sleeping and has cough or difficult breathing, count the number of breaths first before you try to wake the child."),
    reveal("A child has a general danger sign. What must you do?",
           "Refer URGENTLY to hospital and complete the rest of the assessment immediately. This child has a severe problem: there must be "
           "no delay in his pre-referral treatment."),
], (7, 9))

FG_FORM = ("This is a Recording Form. There are 2 sides: the front side is similar to the ASSESS & CLASSIFY chart; the other side is used "
           "to plan the child's treatment, later in the course. At the top you write the child's name, age, weight, height or length, MUAC and "
           "temperature, the mother's answer about the child's problems, and whether this is an initial or follow-up visit. The form has two "
           "columns, Assess and Classify, like the chart. You record by circling any sign that is present, ticking Yes or No after each main "
           "symptom, writing numbers such as the breaths per minute or the number of days, and writing the classification in the Classify "
           "column. The reminder “Remember to use danger sign when selecting classifications” tells you to consider the general danger sign "
           "when you classify each main symptom. In the course app you record on the same form: tick the signs that are present.")

ex_a_laila = kase("sudan-imnci-ac-ex-a1-laila", "Exercise A, case 1: Laila (general danger signs)",
    [text_of(M, 274, 285), text_of(M, 287, 293)], ["danger"], pt("Laila", "female", 15, 8.5, 80, 38.5),
    {**NO_DANGER, "notAbleToDrink": True}, {"danger": ["danger_sign"]},
    ["Laila was too weak to drink from a cup: she is not able to drink or breastfeed.",
     "One general danger sign is enough: tick Yes, general danger sign present."])
ex_a_abd = kase("sudan-imnci-ac-ex-a2-abdullah", "Exercise A, case 2: Abdullah (general danger signs)",
    [text_of(M, 306, 320)], ["danger"], pt("Abdullah", "male", 48, 10, 92, 38),
    dict(NO_DANGER), {"danger": ["no_danger_sign"]},
    ["Abdullah can drink, does not vomit everything, has had no convulsions, is not lethargic or unconscious and is not convulsing now.",
     "He has no general danger sign: tick No."])
mark(M, 294, 304); mark(M, 322, 333)

A4 = lesson("The Recording Form and Exercise A",
    "Record a child's age, weight, problems and general danger signs on the Recording Form.", [
    *T(M, 259, 266),
    facil(FG_FORM),
    form(["danger"], "The top of the Recording Form and the general danger signs section."),
    H("Exercise A"),
    *T(M, 268, 273),
    ex_a_laila, ex_a_abd,
    *T(M, 334, 334),
], (9, 11))

# ---------------------------------------------------------------- cough
A5 = lesson("Assess cough or difficult breathing: how long, and count the breaths",
    "Ask about cough or difficult breathing and its duration, count the breaths in one minute and decide if there is fast breathing.", [
    *T(M, 337, 347),
    pre(layout(M, 349, 355)),
    booklet(["cough"], "The same box in your chart booklet."),
    *T(M, 357, 405),
    pre(layout(M, 407, 411)),
    *T(M, 413, 416),
    video("Counting the breaths in one minute", "The narration is being recorded.", "AC.3"),
    CHECK,
    sort("Does the child have fast breathing?", ["Fast breathing", "Not fast breathing"], [
        ("7 months old, 52 breaths per minute", "Fast breathing", "2 months up to 12 months: 50 or more."),
        ("7 months old, 46 breaths per minute", "Not fast breathing", "2 months up to 12 months: 50 or more."),
        ("Exactly 12 months old, 44 breaths per minute", "Fast breathing", "The child who is exactly 12 months old has fast breathing if you count 40 or more."),
        ("3 years old, 38 breaths per minute", "Not fast breathing", "12 months up to 5 years: 40 or more."),
        ("4 years old, 41 breaths per minute", "Fast breathing", "12 months up to 5 years: 40 or more."),
    ]),
    reveal("You are not sure about the number of breaths you counted: the child was moving and crying. What do you do?",
           "Repeat the count. The child must be quiet and calm when you look and listen to his breathing."),
], (12, 13))

A6 = lesson("Look for chest indrawing, stridor and wheeze",
    "Recognise chest indrawing, stridor in a calm child, and wheeze.", [
    *T(M, 419, 464),
    fig("ac-chest-indrawing", "Chest indrawing: the lower chest wall goes IN when the child breathes IN.", 14),
    CHECK,
    q("The soft tissue between the ribs goes in when the child breathes in. The lower chest wall does not. Is there chest indrawing?",
      ["Yes", "No"], 1,
      "If only the soft tissue between the ribs goes in (intercostal indrawing), the child does not have chest indrawing."),
    q("You see chest indrawing only when the child is crying. Is chest indrawing present?", ["Yes", "No"], 1,
      "For chest indrawing to be present, it must be clearly visible and present all the time."),
    sort("Stridor or wheeze?", ["Stridor", "Wheeze"], [
        ("A harsh noise when the child breathes IN", "Stridor"),
        ("A soft musical noise when the child breathes OUT", "Wheeze"),
        ("Caused by swelling of the larynx, trachea or epiglottis", "Stridor"),
        ("Caused by narrowing of the air passages in the lungs", "Wheeze"),
    ]),
], (14, 15))

FG_TABLES = ("Most classification tables on the chart have 3 rows, coloured pink, yellow or green. Always start at the top (pink) row. If "
             "the child does not have a severe classification, look at the yellow (middle) row. If the child has no sign in the yellow row, "
             "go to the green (bottom) row. If the child has signs from more than one row, always select the more serious classification.")

A7 = lesson("Classification tables",
    "Read a classification table: what the pink, yellow and green rows mean, and how to select one row.", [
    *T(M, 467, 487),
    facil(FG_TABLES),
    CHECK,
    sort("Which row? Sort each description.", ["Pink row", "Yellow row", "Green row"], [
        ("Needs urgent attention and referral or admission for inpatient care", "Pink row"),
        ("Needs an appropriate antibiotic, an oral antimalarial or other treatment, and the mother is taught to give it at home", "Yellow row"),
        ("No treatment with antibiotics: the mother is taught how to care for her child at home", "Green row"),
    ]),
    q("A child has a sign in the pink row and a sign in the yellow row. Which classification do you select?",
      ["The yellow row classification", "The more serious classification, in the pink row", "Both"], 1,
      "The child is classified only once in each classification table. Select the more serious classification."),
], (16, 16))

COUGH_TABLE = table([
    ("severe", ["Any general danger sign or Stridor in calm child", "SEVERE PNEUMONIA OR VERY SEVERE DISEASE"]),
    ("moderate", ["Chest indrawing or Fast breathing", "PNEUMONIA"]),
    ("mild", ["No signs of pneumonia or very severe disease", "COUGH OR COLD"]),
], "The classification table for cough or difficult breathing, as section 3.2 describes it. Check it against your chart booklet.")

A8 = lesson("Classify cough or difficult breathing",
    "Select SEVERE PNEUMONIA OR VERY SEVERE DISEASE, PNEUMONIA, or COUGH OR COLD.", [
    *T(M, 488, 506),
    COUGH_TABLE,
    booklet(["cough"], "The classification table in your chart booklet (Sudan national protocol)."),
    facil("“Up to” means the range that includes the first age and every age between, but not the last age. 2 months up to 12 months = "
          "2, 3, 4 ... 11 months, but not 12 months. 12 months up to 5 years = 12 months, 24 months, 3 years, 4 years, but not 5 years."),
    drill("Drill: what is fast breathing in a child who is ...", [
        ("9 months old?", "50 breaths per minute or more"), ("10 months old?", "50 breaths per minute or more"),
        ("3 years old?", "40 breaths per minute or more"), ("24 months old?", "40 breaths per minute or more"),
        ("8 months old?", "50 breaths per minute or more"), ("12 months old?", "40 breaths per minute or more"),
        ("11 months old?", "50 breaths per minute or more"), ("13 months old?", "40 breaths per minute or more"),
        ("4 years old?", "40 breaths per minute or more"), ("5 months old?", "50 breaths per minute or more"),
        ("6 years old?", "Not included in the range “up to” 5 years"),
    ]),
    sort("Is the child included in “12 months up to 5 years”?", ["Included", "Not included"], [
        ("A 5½-year-old", "Not included"), ("A 37-month-old", "Included"), ("A 4½-year-old", "Included"),
        ("A 5-year-old", "Not included"), ("A 12-month-old", "Included"),
    ]),
    H("Example: Fatima"),
    *T(M, 509, 524),
    pagepic("ac-p17-fatima", 17, "Fatima's Recording Form in the book."),
    reveal("Fatima has 41 breaths per minute, no chest indrawing and no stridor, but she does not look around and stares blankly. How do "
           "you classify her cough?",
           "Fatima is lethargic: she has a general danger sign. A child with any general danger sign is classified as SEVERE PNEUMONIA OR "
           "VERY SEVERE DISEASE. (In the facilitator's discussion: what signs does Fatima have, and how did the health worker select the "
           "classification?)", "Discuss"),
], (16, 17))

def cough_case(eid, title, a, b, patient, assess, cls, points):
    return kase(eid, title, [text_of(M, a, b)], ["danger", "cough"], patient, assess, cls, points)

exB = [
    cough_case("sudan-imnci-ac-ex-b1-hamza", "Exercise B, case 1: Hamza", 538, 551, pt("Hamza", "male", 6, 5.5, 60, 38),
        {**NO_DANGER, "hasCough": True, "coughDays": 2, "breathRate": 58, "fastBreathing": True, "chestIndrawing": False,
         "stridor": False, "wheeze": False},
        {"danger": ["no_danger_sign"], "cough": ["pneumonia"]},
        ["Hamza is 6 months old: fast breathing is 50 breaths per minute or more. He has 58: fast breathing.",
         "No general danger sign and no stridor: PNEUMONIA (yellow row)."]),
    cough_case("sudan-imnci-ac-ex-b2-salwa", "Exercise B, case 2: Salwa", 574, 592, pt("Salwa", "female", 8, 6, 60, 39),
        {**NO_DANGER, "notAbleToDrink": True, "lethargicUnconscious": True, "hasCough": True, "coughDays": 3, "breathRate": 55,
         "fastBreathing": True, "chestIndrawing": True, "stridor": True, "wheeze": False},
        {"danger": ["danger_sign"], "cough": ["severe_pneumonia"]},
        ["Salwa is not able to breastfeed and is lethargic: general danger signs. She also has stridor.",
         "Any general danger sign or stridor in a calm child: SEVERE PNEUMONIA OR VERY SEVERE DISEASE (pink row)."]),
    cough_case("sudan-imnci-ac-ex-b3-mustafa", "Exercise B, case 3: Mustafa", 615, 628, pt("Mustafa", "male", 18, 9, 60, 37),
        {**NO_DANGER, "hasCough": True, "coughDays": 3, "breathRate": 38, "fastBreathing": False, "chestIndrawing": False,
         "stridor": False, "wheeze": False},
        {"danger": ["no_danger_sign"], "cough": ["cough_cold"]},
        ["Mustafa is 18 months old: fast breathing is 40 or more. He has 38: not fast breathing.",
         "No danger sign, no stridor, no chest indrawing, no fast breathing: COUGH OR COLD (green row)."]),
    cough_case("sudan-imnci-ac-ex-b4-nuha", "Exercise B, case 4: Nuha", 650, 667, pt("Nuha", "female", 24, 11, 75, 39.5),
        {**NO_DANGER, "hasCough": True, "coughDays": 2, "breathRate": 36, "fastBreathing": False, "chestIndrawing": False,
         "stridor": False, "wheeze": True},
        {"danger": ["no_danger_sign"], "cough": ["cough_cold"]},
        ["Nuha is 2 years old: fast breathing is 40 or more. She has 36: not fast breathing. She has no chest indrawing.",
         "She is wheezing, but she has no sign of pneumonia: COUGH OR COLD (the facilitator guide's answer).",
         "Her mother says she had a cough and runny nose for two days before she became sick: the facilitator checks the number of days "
         "with you."]),
]
mark(M, 553, 570); mark(M, 594, 611); mark(M, 629, 646); mark(M, 669, 686)

A9 = lesson("Exercise B: classify cough or difficult breathing",
    "Record the signs of four children on the Recording Form and classify their cough or difficult breathing.", [
    *T(M, 527, 534),
    exB[0], *T(M, 548, 548), exB[1], exB[2], exB[3],
    *T(M, 687, 687),
], (18, 21))

exC = qz("sudan-imnci-ac-ex-c-video", "Exercise C: general danger signs and cough (video)", [text_of(M, 691, 696)], [
    open_q("c1", "Watch children 1 to 4 on the video. For each child: is the child lethargic or unconscious? Write Child 1, 2, 3 and 4 "
                 "with Yes or No.", ["Check your answer for each child with the answer on the video."],
           "A child who is lethargic may have his eyes open but is not alert or paying attention to what is happening around him."),
    mcq("c2", "Mano is 4 years old. You count 65 breaths per minute. Does Mano have fast breathing?", ["Yes", "No"], 0,
        "12 months up to 5 years: 40 breaths per minute or more is fast breathing."),
    mcq("c3", "Wumbi is 6 months old. You count 66 breaths per minute. Does Wumbi have fast breathing?", ["Yes", "No"], 0,
        "2 months up to 12 months: 50 breaths per minute or more is fast breathing."),
    open_q("c4", "Watch Mary, Jenna, Ho, Anna and Lo on the video. Does each child have chest indrawing?",
           ["Check your answer for each child with the answer on the video."],
           "Chest indrawing: the lower chest wall goes IN when the child breathes IN, clearly visible and all the time."),
    open_q("c5", "Watch Petty, Helen, Simbu and Hassan on the video. Does each child have stridor or wheeze?",
           ["Check your answer for each child with the answer on the video."],
           "Stridor is a harsh noise when the child breathes IN. Wheeze is a soft musical noise when the child breathes OUT."),
], 15)
mark(M, 698, 739)

A10 = lesson("Exercise C: video exercise",
    "Watch the video and decide if children are lethargic, have fast breathing, chest indrawing, stridor or wheeze.", [
    *T(M, 690, 690),
    video("Exercise C: general danger signs, and cough or difficult breathing", "The video exercise. The narration is being recorded.", "AC.4"),
    exC,
    facil("Counting breathing requires close attention to one spot on the chest or abdomen. Chest indrawing and stridor require knowing "
          "when the child is breathing in and out. Practice this when you see children in the clinic."),
    drill("Drill: general danger signs and cough or difficult breathing", [
        ("What are the steps for checking for general danger signs?", "Ask if the child is able to drink or breastfeed; ask if the child "
         "vomits everything; ask if the child has had convulsions; look to see if the child is convulsing now or lethargic or unconscious."),
        ("How do you decide if the child vomits everything?", "The child is not able to keep anything down at all. What goes down comes back up."),
        ("How do you decide if the child is lethargic?", "The lethargic child is sleepy when he should be awake. The child may stare blankly "
         "and appear not to see what is going on around him."),
        ("How do you decide if the child is unconscious?", "The unconscious child does not waken at all. He does not respond to touch or to loud noises."),
        ("What are the steps for assessing a child with cough or difficult breathing?", "Ask how long the child has been coughing; count the "
         "breaths in one minute and decide if the child has fast breathing; look for chest indrawing; look and listen for stridor."),
        ("How do you recognize chest indrawing?", "The lower chest wall goes in when the child breathes IN. This should happen all the time."),
        ("What should you do if you are not sure that chest indrawing is present?", "Ask the mother to change the child's position. If the "
         "lower chest wall does not go in when the child breathes in, the child does not have chest indrawing."),
        ("How do you recognize stridor?", "The child should be calm. Put your ear close to the child's mouth. Listen for a harsh noise when "
         "the child breathes IN."),
    ]),
], (22, 23))

# ---------------------------------------------------------------- diarrhoea
A11 = lesson("Diarrhoea: what it is, and its types",
    "Say what diarrhoea is, and tell acute watery diarrhoea, persistent diarrhoea and dysentery apart.", [
    *T(M, 741, 771),
    CHECK,
    sort("Which type of diarrhoea?", ["Acute diarrhoea", "Persistent diarrhoea", "Dysentery"], [
        ("An episode that lasts less than 14 days", "Acute diarrhoea"),
        ("Diarrhoea that lasts 14 days or more", "Persistent diarrhoea"),
        ("Diarrhoea with blood in the stool, with or without mucus", "Dysentery"),
    ]),
    q("A breastfed baby passes soft stools several times a day, as he always does. Does he have diarrhoea?", ["Yes", "No"], 1,
      "Babies who are exclusively breastfed often have stools that are soft; this is not diarrhea. Frequent passing of normal stools is not diarrhea."),
], (24, 24))

A12 = lesson("Assess diarrhoea: how long, blood, general condition, sunken eyes",
    "Ask about diarrhoea, its duration and blood in the stool; look at the child's general condition and for sunken eyes.", [
    *T(M, 774, 779),
    pre(layout(M, 780, 792)),
    booklet(["diarrhea"], "The same box in your chart booklet."),
    *T(M, 793, 834),
    CHECK,
    q("A child cries in the clinic, but his mother can console and calm him. Does he have the sign “restless and irritable”?",
      ["Yes", "No"], 1, "Many children are upset just because they are in the clinic. If these children can be consoled and calmed, they do not "
      "have the sign \"restless and irritable\"."),
    q("You think the child's eyes are sunken. What do you do next?", ["Classify at once", "Ask the mother if she thinks her child's eyes look unusual"], 1,
      "Then ask the mother if she thinks her child's eyes look unusual. Her opinion helps you confirm that the child's eyes are sunken."),
], (25, 26))

A13 = lesson("Offer fluid and pinch the skin",
    "Decide if a child is not able to drink, drinking poorly or drinking eagerly, and do a skin pinch.", [
    *T(M, 835, 868),
    video("Offering fluid and doing the skin pinch", "The narration is being recorded.", "AC.5"),
    CHECK,
    sort("Which sign does the child have?", ["Not able to drink or drinking poorly", "Drinking eagerly, thirsty", "Neither sign"], [
        ("He is weak and can swallow only if fluid is put in his mouth", "Not able to drink or drinking poorly"),
        ("He reaches out for the cup and is unhappy when the water is taken away", "Drinking eagerly, thirsty"),
        ("He takes a drink only with encouragement and does not want to drink more", "Neither sign"),
    ]),
    steps("The skin pinch, step by step", [
        ("Position the child", "Flat on his back with his arms at his sides and his legs straight, or lying flat in the mother's lap."),
        ("Find the place", "Halfway between the umbilicus and the side of the abdomen."),
        ("Pinch", "Use your thumb and first finger, not your fingertips. The fold of skin is in a line up and down the child's body. Firmly "
                  "pick up all of the layers of skin and the tissue under them."),
        ("Release", "Pinch for one second and then release. Look to see if the skin pinch goes back very slowly (longer than 2 seconds), "
                    "slowly (less than 2 seconds) or immediately."),
    ]),
], (26, 27))

exD = qz("sudan-imnci-ac-ex-d-photos", "Exercise D: signs of dehydration (photographs)", [text_of(M, 873, 882)], [
    mcq("d3", "Photograph 3. Look at the child's eyes. Are they sunken?", ["Yes", "No"], 0, "This child has sunken eyes."),
    mcq("d4", "Photograph 4. Look at the child's eyes. Are they sunken?", ["Yes", "No"], 0, "The child has sunken eyes."),
    mcq("d5", "Photograph 5. Look at the child's eyes. Are they sunken?", ["Yes", "No"], 1, "The child does not have sunken eyes."),
    mcq("d6", "Photograph 6. Look at the child's eyes. Are they sunken?", ["Yes", "No"], 0, "The child has sunken eyes."),
    mcq("d7", "Photograph 7: a skin pinch. Does the skin go back very slowly?", ["Yes", "No"], 0, "The child's skin pinch goes back very slowly."),
])
mark(M, 884, 894)

A14 = lesson("Exercise D: signs of dehydration in photographs",
    "Decide from photographs if a child's eyes are sunken and if the skin pinch goes back very slowly.", [
    *T(M, 871, 871),
    photo(1, "Photograph 1: The child's eyes are sunken."),
    photo(2, "Photograph 2: The skin pinch for this child goes back very slowly."),
    *T(M, 879, 880, headings=False),
    photo(3, "Photograph 3"), photo(4, "Photograph 4"), photo(5, "Photograph 5"), photo(6, "Photograph 6"), photo(7, "Photograph 7: a skin pinch"),
    exD,
    *T(M, 896, 897),
    facil("To confirm that the eyes are sunken, ask the mother if the child's eyes look unusual to her."),
], (28, 28))

DEHYD_TABLE = table([
    ("severe", ["Two of the following signs: Lethargic or unconscious; Sunken eyes; Not able to drink or drinking poorly; Skin pinch goes "
                "back very slowly.", "SEVERE DEHYDRATION"]),
    ("moderate", ["Two of the following signs: Restless, irritable; Sunken eyes; Drinks eagerly, thirsty; Skin pinch goes back slowly.",
                  "SOME DEHYDRATION"]),
    ("mild", ["Not enough signs to classify as some or severe dehydration", "NO DEHYDRATION"]),
])
mark(M, 922, 934); mark(M, 971, 986)

A15 = lesson("Classify dehydration",
    "Classify a child's dehydration as SEVERE DEHYDRATION, SOME DEHYDRATION or NO DEHYDRATION.", [
    *T(M, 900, 920),
    DEHYD_TABLE,
    booklet(["diarrhea"], "The dehydration table in your chart booklet (Sudan national protocol)."),
    *T(M, 937, 945),
    CHECK,
    q("A child with diarrhoea is lethargic and has a skin pinch that goes back very slowly. How do you classify his dehydration?",
      ["SEVERE DEHYDRATION", "SOME DEHYDRATION", "NO DEHYDRATION"], 0, "Two signs in the pink row: SEVERE DEHYDRATION."),
], (29, 29))

A15b = lesson("Example: how Mona's dehydration was classified",
    "Follow how a health worker records and classifies dehydration on the Recording Form.", [
    *T(M, 946, 951),
    pre(layout(M, 953, 964)),
    pagepic("ac-p30-mona", 30, "Mona's Recording Form and the dehydration table, in the book."),
    *T(M, 966, 969),
    *T(M, 989, 989),
    pre(layout(M, 990, 1001)),
    pagepic("ac-p31-mona", 31, "How the health worker recorded Mona's classification."),
    *T(M, 1003, 1020),
    facil("Mona had diarrhoea for 5 days. The signs circled on her form are restless or irritable, and drinking eagerly, thirsty: two "
          "signs in the yellow row. That is why she is classified as SOME DEHYDRATION. Always start at the pink row."),
    CHECK,
    q("A child with diarrhoea has sunken eyes and is restless and irritable. No other signs. How do you classify his dehydration?",
      ["SEVERE DEHYDRATION", "SOME DEHYDRATION", "NO DEHYDRATION"], 1,
      "He has only one sign in the pink row (sunken eyes) but two signs in the yellow row (restless, irritable and sunken eyes): SOME DEHYDRATION."),
], (30, 31))

def dia_case(eid, title, a, b, name, assess, cls, points):
    return kase(eid, title, [text_of(M, a, b)], ["diarrhea"], {"childName": name, "visitType": "initial"}, assess, cls, points, 6)

D0 = {"lethargic": False, "restlessIrritable": False, "sunkenEyes": False, "drinkPoorly": False, "drinkEagerly": False,
      "pinchVerySlow": False, "pinchSlow": False}
exE = [
    dia_case("sudan-imnci-ac-ex-e1-hashim", "Exercise E, case 1: Hashim", 1031, 1036, "Hashim",
             {"hasDiarrhea": True, "diarrheaDays": 5, "bloodInStool": False, **D0, "restlessIrritable": True, "sunkenEyes": True,
              "drinkEagerly": True, "pinchSlow": True}, {"diarrhea": ["some_dehydration"]},
             ["Hashim has no two signs in the pink row.", "He has restless, irritable; sunken eyes; drinks eagerly, thirsty; skin pinch "
              "goes back slowly: SOME DEHYDRATION."]),
    dia_case("sudan-imnci-ac-ex-e2-fatima", "Exercise E, case 2: Fatima", 1054, 1058, "Fatima",
             {"hasDiarrhea": True, "diarrheaDays": 3, "bloodInStool": False, **D0, "sunkenEyes": True}, {"diarrhea": ["no_dehydration"]},
             ["Fatima has only one sign of dehydration: sunken eyes.", "Not enough signs to classify as some or severe dehydration: NO DEHYDRATION."]),
    dia_case("sudan-imnci-ac-ex-e3-huda", "Exercise E, case 3: Huda", 1075, 1077, "Huda",
             {"hasDiarrhea": True, "diarrheaDays": 2, "bloodInStool": False, **D0, "restlessIrritable": True, "sunkenEyes": True,
              "drinkPoorly": True, "pinchVerySlow": True}, {"diarrhea": ["severe_dehydration"]},
             ["Huda has sunken eyes, is not able to drink, and her skin pinch goes back very slowly: more than two signs in the pink row.",
              "SEVERE DEHYDRATION."]),
]
mark(M, 1038, 1049); mark(M, 1060, 1071); mark(M, 1079, 1090)

A16 = lesson("Exercise E: classify dehydration",
    "Record the signs of dehydration of three children and classify them.", [
    *T(M, 1023, 1027),
    facil("Your facilitator talks through the first case with you: which signs are present, which row of the table they are in, and why "
          "the classification is selected. Then do the cases."),
    *exE,
    *T(M, 1092, 1092),
], (32, 34))

PD_TABLE = table([
    ("severe", ["Dehydration present", "SEVERE PERSISTENT DIARRHOEA"]),
    ("moderate", ["No dehydration", "PERSISTENT DIARRHOEA"]),
])
DY_TABLE = table([("moderate", ["Blood in the stool", "DYSENTERY"])])
mark(M, 1102, 1109); mark(M, 1121, 1121)

A17 = lesson("Classify persistent diarrhoea and dysentery",
    "Classify persistent diarrhoea and dysentery, and record more than one diarrhoea classification.", [
    *T(M, 1095, 1100),
    PD_TABLE,
    *T(M, 1111, 1119),
    DY_TABLE,
    booklet(["persistent_diarrhea", "dysentery"], "The persistent diarrhoea and dysentery tables in your chart booklet."),
    *T(M, 1123, 1128),
    pre(layout(M, 1130, 1142)),
    pagepic("ac-p35-dysentery", 35, "How the health worker recorded NO DEHYDRATION and DYSENTERY, in the book."),
    CHECK,
    q("A child has had diarrhoea for 16 days and has SOME DEHYDRATION. How do you classify the persistent diarrhoea?",
      ["PERSISTENT DIARRHOEA", "SEVERE PERSISTENT DIARRHOEA"], 1,
      "If a child has had diarrhea for 14 days or more, and also had some or severe dehydration then classify the child as SEVERE PERSISTENT DIARRHOEA."),
    q("A child has had diarrhoea for 3 days with blood in the stool, and no dehydration. How many diarrhoea classifications does he have?",
      ["One: DYSENTERY", "Two: NO DEHYDRATION and DYSENTERY"], 1,
      "A child with diarrhea may have one or more classifications for diarrhea: NO DEHYDRATION and DYSENTERY."),
], (35, 35))

def dd_case(eid, title, a, b, patient, days, signs, cls, points):
    return kase(eid, title, [text_of(M, a, b)], ["danger", "cough", "diarrhea"], patient,
                {**NO_DANGER, "hasCough": False, "hasDiarrhea": True, "diarrheaDays": days, "bloodInStool": False, **D0, **signs},
                {"danger": ["no_danger_sign"], "diarrhea": cls}, points)

exF = [
    dd_case("sudan-imnci-ac-ex-f1-samira", "Exercise F, case 1: Samira", 1149, 1156, pt("Samira", "female", 25, 9, 75, 37), 4,
            {"drinkEagerly": True}, ["no_dehydration"],
            ["Samira has only one sign of dehydration: she drinks eagerly. Two signs are needed for SOME DEHYDRATION.",
             "NO DEHYDRATION. She has had diarrhoea for 4 days and no blood: no persistent diarrhoea and no dysentery."]),
    dd_case("sudan-imnci-ac-ex-f2-fathyah", "Exercise F, case 2: Fathyah", 1191, 1200, pt("Fathyah", "female", 14, 12, 75, 37.5), 21,
            {"restlessIrritable": True, "drinkEagerly": True}, ["some_dehydration", "severe_persistent_diarrhea"],
            ["Fathyah is irritable and drinks eagerly: two signs in the yellow row, SOME DEHYDRATION.",
             "She has had diarrhoea for 21 days and she also has dehydration: SEVERE PERSISTENT DIARRHOEA.",
             "When there is persistent diarrhoea or dysentery, do not forget to classify dehydration too."]),
    dd_case("sudan-imnci-ac-ex-f3-amani", "Exercise F, case 3: Amani", 1234, 1241, pt("Amani", "female", 36, 10, 80, 37), 2,
            {"sunkenEyes": True, "drinkEagerly": True}, ["some_dehydration"],
            ["Amani has sunken eyes and drinks eagerly: two signs in the yellow row, SOME DEHYDRATION.",
             "2 days, no blood: no persistent diarrhoea and no dysentery."]),
]
mark(M, 1158, 1187); mark(M, 1201, 1230); mark(M, 1243, 1272)

A18 = lesson("Exercise F: classify cough and diarrhoea",
    "Classify three children up through diarrhoea, with more than one diarrhoea classification where needed.", [
    *T(M, 1145, 1147),
    facil("For cough or difficult breathing, one sign is enough to select a classification. For dehydration, two signs are needed to select "
          "the pink or the yellow row. Only classify persistent diarrhoea if the child has had diarrhoea for 14 days or more, and dysentery "
          "only if there is blood in the stool."),
    *exF,
], (36, 38))

exG = qz("sudan-imnci-ac-ex-g-video", "Exercise G: diarrhoea (video)", [text_of(M, 1276, 1278)], [
    open_q("g1", "Watch children 1 to 6 on the video. Does each child have sunken eyes?", ["Check your answer for each child with the answer on the video."]),
    open_q("g2", "Watch children 1 to 5 on the video. Does the skin pinch go back very slowly, slowly or immediately?",
           ["Check your answer for each child with the answer on the video."],
           "If you can see the tented skin even briefly after you release the skin, this is a slow skin pinch. A skin pinch that returns "
           "immediately is so quick that you cannot see the tented skin at all after releasing it."),
    open_q("g3", "The case study on the video: record the child's signs on the Recording Form and classify the child's illness.",
           ["Check your Recording Form with the answer on the video."]),
], 15)
mark(M, 1280, 1331)

A19 = lesson("Exercise G: diarrhoea video exercise",
    "Watch the video, decide if children have sunken eyes and a slow skin pinch, and classify a child with diarrhoea.", [
    *T(M, 1274, 1274),
    video("Exercise G: does the child have diarrhoea?", "The video exercise. The narration is being recorded.", "AC.6"),
    exG,
    form(["danger", "cough", "diarrhea"], "Use the form to record the case study on the video."),
    facil("Repeat the skin pinch if you are not sure, and make sure you are doing it in the right position. Sometimes children who are "
          "sick or tired hold very still in clinic but they respond to touch or voice: they should not be considered lethargic. If you "
          "initially think a child is lethargic but then he awakens and becomes alert later in the exam, do not consider this child to "
          "have the general danger sign \"lethargic or unconscious\"."),
], (39, 40))

# ---------------------------------------------------------------- fever and measles
A20 = lesson("Fever: malaria, measles and other causes",
    "Explain the common causes of fever in a sick child: malaria, measles, and fever with localizing, non-localizing signs or a rash.", [
    *T(M, 1333, 1400),
    CHECK,
    q("Which is the only dangerous species of plasmodia, according to the book?", ["Plasmodium vivax", "Plasmodium falciparum"], 1,
      "Four species of plasmodia can cause malaria, but the only dangerous one is plasmodium falciparum."),
], (41, 42))

A20b = lesson("Other causes of fever",
    "Tell fever with localizing signs, with non-localizing signs and with a rash apart.", [
    *T(M, 1401, 1435),
    CHECK,
    sort("Which category of fever?", ["Fever with localizing signs", "Fever with non-localizing signs", "Fever with a rash"], [
        ("Acute ear infection", "Fever with localizing signs"), ("Dysentery", "Fever with localizing signs"),
        ("Septicemia", "Fever with non-localizing signs"), ("Urinary tract infection", "Fever with non-localizing signs"),
        ("Measles", "Fever with a rash"), ("Chicken pox", "Fever with a rash"),
    ]),
    q("Complications of measles occur in about what proportion of all cases?", ["1%", "About 30%", "About 90%"], 1,
      "Complications of measles occur in about 30% of all cases."),
], (42, 43))

A21 = lesson("Assess fever: ask about fever, its duration and measles",
    "Decide if a child has fever, and ask how long, if it has been present every day, and about measles in the last 3 months.", [
    *T(M, 1437, 1461),
    pre(layout(M, 1463, 1477)),
    booklet(["fever"], "The same box in your chart booklet (Sudan national protocol)."),
    *T(M, 1479, 1505),
    CHECK,
    q("The mother says the child felt hot yesterday. Today his temperature is 36.8°C. Do you assess the child for fever?", ["Yes", "No"], 0,
      "Assess the child's fever even if the child does not have a temperature of 37.5°C or above or does not feel hot now: history of fever "
      "is enough to assess the child for fever."),
    q("A child has had fever every day for 9 days. What can this mean?", ["A simple viral illness", "A more severe disease such as typhoid fever: refer"], 1,
      "A fever that has been present every day for more than 7 days can mean that the child has a more severe disease such as typhoid "
      "fever. Refer this child for further assessment."),
], (44, 45))

A22 = lesson("Look for stiff neck, the rash of measles, other causes, and do a malaria test",
    "Check for stiff neck, recognise the generalized rash of measles, look for other causes of fever and decide when to do a malaria test.", [
    *T(M, 1506, 1570),
    video("Checking for stiff neck", "The narration is being recorded.", "AC.7"),
    CHECK,
    q("A child with fever has a stiff neck. Do you do a malaria test?",
      ["Yes, always", "No: do not delay referral; give pre-referral antimalarial and antibiotic treatment and refer urgently"], 1,
      "Do not do a malaria test if a child has a danger sign or a stiff neck to avoid delay in referral but give pre-referral antimalarial "
      "and antibiotic treatment, and refer the child urgently."),
    sort("Measles rash or another rash?", ["The generalized rash of measles", "Not measles"], [
        ("A red rash that begins behind the ears and on the neck and spreads to the face and body", "The generalized rash of measles"),
        ("A generalized rash with vesicles", "Not measles", "This is chicken pox."),
        ("An itchy rash on the hands, feet, ankles, elbows, buttocks and axilla", "Not measles", "This is scabies."),
        ("Small bumps and vesicles which itch; the child is not sick", "Not measles", "This is heat rash."),
    ]),
], (45, 47))

exH = qz("sudan-imnci-ac-ex-h-rash", "Exercise H: the generalized rash of measles (photographs)", [text_of(M, 1575, 1577), text_of(M, 1587, 1588)], [
    mcq(f"h{n}", f"Photograph {n}. Is the generalized rash of measles present?", ["Yes", "No"], 0 if n in (12, 14, 20) else 1, why)
    for n, why in [(12, ""), (13, "This is scabies."), (14, ""), (15, "This is scabies."), (16, "This is tinea versicolor."),
                   (17, "This is chicken pox."), (18, "This child is malnourished and has normal skin."), (19, "This child has heat rash."),
                   (20, ""), (21, "This child has normal skin.")]
], 8)
mark(M, 1590, 1601)

A23 = lesson("Exercise H: the rash of measles",
    "Tell the generalized rash of measles from other common childhood rashes, in photographs.", [
    *T(M, 1573, 1578),
    photo(8, "Photograph 8: This child has the generalized rash of measles and red eyes."),
    photo(9, "Photograph 9: heat rash. It is not the generalized rash of measles."),
    photo(10, "Photograph 10: scabies. It is not the generalized rash of measles."),
    photo(11, "Photograph 11: chicken pox. It is not a measles rash."),
    *T(M, 1579, 1585, headings=False),
    *[photo(n) for n in range(12, 22)],
    exH,
    *T(M, 1603, 1603),
], (48, 48))

exI = qz("sudan-imnci-ac-ex-i-mouth", "Exercise I: mouth ulcers (photographs)", [text_of(M, 1625, 1626), text_of(M, 1639, 1640)], [
    mcq(f"i{n}", f"Photograph {n}. Does the child have mouth ulcers?", ["Yes", "No"], a, w) for n, a, w in (
        (25, 0, "This child has a mouth ulcer."), (26, 0, "This child has a mouth ulcer."), (27, 1, "This child does not have mouth ulcers."))
], 5)
EXERCISES[-1]["narrative"].append("Answers from the facilitator guide's list of photographs of the sick child.")
mark(M, 1642, 1650)

A24 = lesson("Measles complications: mouth ulcers, and Exercise I",
    "Look for mouth ulcers in a child with measles and tell them from Koplik spots.", [
    *T(M, 1606, 1621),
    H("Exercise I"),
    *T(M, 1624, 1628),
    photo(22, "Photograph 22: a normal mouth. The child does not have mouth ulcers."),
    photo(23, "Photograph 23: Koplik spots. They are not mouth ulcers."),
    photo(24, "Photograph 24: This child has a mouth ulcer."),
    *T(M, 1630, 1637, headings=False),
    photo(25, "Photograph 25"), photo(26, "Photograph 26"), photo(27, "Photograph 27"),
    exI,
    *T(M, 1652, 1652),
], (49, 50))

J = {31: ("Yes", "Not able to decide"), 32: ("No", "No"), 33: ("Yes", "Not able to decide"), 34: ("No", "Yes"), 35: ("No", "Yes"),
     36: ("Yes", "Not able to decide"), 37: ("No", "No")}
OPT3 = ["Yes", "No", "Not able to decide"]
exJ = qz("sudan-imnci-ac-ex-j-eye", "Exercise J: eye complications of measles (photographs)", [text_of(M, 1690, 1690), text_of(M, 1702, 1704)],
    [x for n, (p, c) in J.items() for x in (
        mcq(f"j{n}p", f"Photograph {n}. Is pus draining from the eye?", OPT3, OPT3.index(p)),
        mcq(f"j{n}c", f"Photograph {n}. Is there clouding of the cornea?", OPT3, OPT3.index(c)))], 10)
mark(M, 1706, 1715)

A25 = lesson("Measles complications: the eye, and Exercise J",
    "Look for pus draining from the eye and clouding of the cornea.", [
    *T(M, 1655, 1686),
    H("Exercise J"),
    *T(M, 1689, 1692),
    photo(28, "Photograph 28: a normal eye. The child has been crying; no pus draining from the eye."),
    photo(29, "Photograph 29: This child has pus draining from the eye."),
    photo(30, "Photograph 30: This child has clouding of the cornea."),
    *T(M, 1694, 1700, headings=False),
    *[photo(n) for n in range(31, 38)],
    exJ,
    *T(M, 1717, 1717),
], (51, 52))

FEVER_TABLE = table([
    ("severe", ["Any general danger sign or Stiff neck", "VERY SEVERE FEBRILE DISEASE"]),
    ("moderate", ["POSITIVE Malaria test", "MALARIA"]),
    ("mild", ["NEGATIVE Malaria test; Other cause of fever PRESENT", "FEVER NO MALARIA"]),
])
mark(M, 1733, 1734); mark(M, 1742, 1742); mark(M, 1748, 1758)

A26 = lesson("Classify fever",
    "Classify fever as VERY SEVERE FEBRILE DISEASE, MALARIA or FEVER NO MALARIA.", [
    *T(M, 1720, 1732),
    *T(M, 1736, 1741),
    *T(M, 1744, 1746),
    FEVER_TABLE,
    booklet(["fever"], "The fever classification table in your chart booklet (Sudan national protocol)."),
    CHECK,
    q("A child with fever has no general danger sign and no stiff neck. The malaria test is positive. How do you classify the fever?",
      ["VERY SEVERE FEBRILE DISEASE", "MALARIA", "FEVER NO MALARIA"], 1,
      "A child with fever (or a history of fever), no general danger sign or stiff neck, and a positive malaria test is classified as having MALARIA."),
    q("A child with fever is lethargic. How do you classify the fever?", ["VERY SEVERE FEBRILE DISEASE", "MALARIA", "FEVER NO MALARIA"], 0,
      "A child with fever and any general danger sign or stiff neck is classified as having VERY SEVERE FEBRILE DISEASE."),
    drill("Drill: what is fast breathing in a child who is ...", [
        ("4 months old", "50 breaths per minute or more"), ("18 months old", "40 breaths per minute or more"),
        ("36 months old", "40 breaths per minute or more"), ("6 months old", "50 breaths per minute or more"),
        ("11 months old", "50 breaths per minute or more"), ("12 months old", "40 breaths per minute or more"),
        ("2 months old", "50 breaths per minute or more"),
    ]),
    sort("Drill, part 2: does the child have fast breathing?", ["Yes", "No", "Not included"], [
        (f"{a}, {b} breaths per minute", r) for a, b, r in [
            ("3 months old", 52, "Yes"), ("2 years old", 38, "No"), ("6 months old", 48, "No"), ("12 months old", 38, "No"),
            ("12 months old", 42, "Yes"), ("33 months old", 37, "No"), ("8 months old", 54, "Yes"), ("18 months old", 45, "Yes"),
            ("31 months old", 42, "Yes"), ("4 months old", 45, "No"), ("14 months old", 45, "Yes"), ("4 years old", 43, "Yes"),
            ("20 months old", 48, "Yes"), ("5 years old", 51, "Not included"), ("7 months old", 48, "No"), ("10 months old", 38, "No"),
            ("11 months old", 45, "No"), ("12 months old", 45, "Yes")]
    ]),
], (53, 53))

MEASLES_TABLE = table([
    ("severe", ["Any general danger sign or Clouding of the cornea or Deep or extensive mouth ulcers", "SEVERE COMPLICATED MEASLES"]),
    ("moderate", ["Pus draining from the eye or Mouth ulcers", "MEASLES WITH EYE OR MOUTH COMPLICATIONS"]),
    ("mild", ["Measles now or within the last 3 months", "MEASLES"]),
])
mark(M, 1772, 1782)

A27 = lesson("Classify measles",
    "Classify measles as SEVERE COMPLICATED MEASLES, MEASLES WITH EYE OR MOUTH COMPLICATIONS or MEASLES.", [
    *T(M, 1761, 1771),
    MEASLES_TABLE,
    booklet(["measles"], "The measles classification table in your chart booklet (Sudan national protocol)."),
    *T(M, 1784, 1796),
    CHECK,
    q("A child with measles now has pus draining from the eye. No other complication. How do you classify the measles?",
      ["SEVERE COMPLICATED MEASLES", "MEASLES WITH EYE OR MOUTH COMPLICATIONS", "MEASLES"], 1,
      "If the child has pus draining from the eye or mouth ulcers, which are not deep extensive, classify the child as having MEASLES with "
      "EYE OR MOUTH COMPLICATION."),
    q("A child had measles 2 months ago. Now he has clouding of the cornea. How do you classify the measles?",
      ["SEVERE COMPLICATED MEASLES", "MEASLES WITH EYE OR MOUTH COMPLICATIONS", "MEASLES"], 0,
      "If the child has any general danger sign, clouding of cornea or deep or extensive mouth ulcers, classify the child as having SEVERE "
      "COMPLICATED MEASLES."),
], (54, 54))

F0 = {"dailyFever7Days": False, "measles3Months": False, "neckStiffness": False, "measlesRash": False, "mouthUlcers": False,
      "deepExtensiveUlcers": False, "pusFromEye": False, "corneaClouding": False}

def measles_q(name, answer, why):
    return q(f"How do you classify {name}'s measles?", ["Do not classify measles: no signs suggesting measles", "SEVERE COMPLICATED MEASLES",
             "MEASLES WITH EYE OR MOUTH COMPLICATIONS", "MEASLES"], answer, why)

exK = [
    kase("sudan-imnci-ac-ex-k1-kareem", "Exercise K, case 1: Kareem", [text_of(M, 1910, 1917)], ["danger", "cough", "diarrhea", "fever"],
         pt("Kareem", "male", 5, 5.2, 69, 37.5),
         {**NO_DANGER, "hasCough": False, "hasDiarrhea": False, "hasFever": True, "feverDays": 2, **F0, "malariaTest": "positive"},
         {"danger": ["no_danger_sign"], "fever": ["malaria"]},
         ["Kareem has fever (37.5°C and feels hot), no general danger sign, no stiff neck, and a positive malaria test: MALARIA.",
          "He has no generalized rash and no measles in the last 3 months: do not classify measles."]),
    kase("sudan-imnci-ac-ex-k2-rania", "Exercise K, case 2: Rania", [text_of(M, 1965, 1976)], ["danger", "cough", "diarrhea", "fever"],
         pt("Rania", "female", 13, 9.4, 66.5, 37),
         {**NO_DANGER, "hasCough": True, "coughDays": 3, "breathRate": 51, "fastBreathing": True, "chestIndrawing": False, "stridor": False,
          "wheeze": False, "hasDiarrhea": False, "hasFever": True, "feverDays": 2, **F0, "mouthUlcers": True, "malariaTest": "positive"},
         {"danger": ["no_danger_sign"], "cough": ["pneumonia"], "fever": ["malaria"]},
         ["Rania is 13 months old: fast breathing is 40 or more. She has 51: PNEUMONIA.",
          "Fever with a positive malaria test and no danger sign or stiff neck: MALARIA.",
          "She has no generalized rash and has not had measles in the last 3 months: do not classify measles, even though she has mouth ulcers."]),
    kase("sudan-imnci-ac-ex-k3-manal", "Exercise K, case 3: Manal", [text_of(M, 2024, 2032)], ["danger", "cough", "diarrhea", "fever"],
         pt("Manal", "female", 12, 7.2, 52, 36.5),
         {**NO_DANGER, "hasCough": False, "hasDiarrhea": True, "diarrheaDays": 3, "bloodInStool": False, **D0, "hasFever": True,
          "feverDays": 2, **F0, "malariaTest": "negative"},
         {"danger": ["no_danger_sign"], "diarrhea": ["no_dehydration"], "fever": ["fever_no_malaria"]},
         ["Manal has no signs of dehydration: NO DEHYDRATION.",
          "She has a history of fever (felt hot for 2 days) and a negative malaria test: FEVER NO MALARIA."]),
    kase("sudan-imnci-ac-ex-k4-duria", "Exercise K, case 4: Duria", [text_of(M, 2080, 2091)], ["danger", "cough", "diarrhea", "fever"],
         pt("Duria", "female", 36, 10, 73, 38),
         {**NO_DANGER, "hasCough": True, "coughDays": 2, "breathRate": 42, "fastBreathing": True, "chestIndrawing": False, "stridor": False,
          "wheeze": False, "hasDiarrhea": False, "hasFever": True, "feverDays": 2, **F0, "measlesRash": True, "malariaTest": "positive"},
         {"danger": ["no_danger_sign"], "cough": ["pneumonia"], "fever": ["malaria"]},
         ["Duria is 3 years old: fast breathing is 40 or more. She has 42: PNEUMONIA.",
          "Fever and a positive malaria test: MALARIA.",
          "She has a generalized rash and no complications: MEASLES. (Classify measles in the question after this exercise.)"]),
]
mark(M, 1826, 1867); mark(M, 1893, 1902)
for a, b in ((1920, 1961), (1979, 2020), (2035, 2076), (2094, 2136)):
    mark(M, a, b)

A28 = lesson("Example: how the health worker classified Tariq",
    "Follow, step by step, how a health worker classifies a child's fever and measles.", [
    *T(M, 1799, 1823),
    form(["danger", "cough", "diarrhea", "fever"], "Record Tariq's signs on the form as you read."),
    *T(M, 1870, 1891),
    MEASLES_TABLE,
    reveal("Tariq is 10 months old and has 43 breaths per minute, with no chest indrawing and no stridor. How do you classify his cough?",
           "Fast breathing for a child 2 months up to 12 months is 50 breaths per minute or more. 43 is not fast breathing: COUGH OR COLD."),
    facil("In the group discussion your facilitator points to the enlarged fever and measles tables and asks: Why is Tariq's fever "
          "MALARIA? Why is his measles classified as MEASLES and not in the pink or yellow row?"),
], (55, 57))

A29 = lesson("Exercise K: classify fever and measles",
    "Record the signs of four children and classify them up through fever and measles.", [
    *T(M, 1904, 1905),
    exK[0], exK[1], exK[2], exK[3],
    measles_q("Duria", 3, "Duria has a generalized rash and no general danger sign, no clouding of the cornea, no mouth ulcers and no pus "
              "draining from the eye: MEASLES."),
    measles_q("Rania", 0, "Rania has no generalized rash and has not had measles within the last 3 months: do not classify measles."),
], (58, 65))

exL = qz("sudan-imnci-ac-ex-l-video", "Exercise L: fever (video)", [text_of(M, 2140, 2142)], [
    open_q("l1", "Watch children 1 to 4 on the video. Does each child have a stiff neck?", ["Check your answer for each child with the answer on the video."],
           "If the neck feels stiff and there is resistance to bending, the child has a stiff neck."),
    open_q("l2", "The case study on the video: record the child's signs and classify the child's illness.", ["Check your Recording Form with the answer on the video."]),
], 10)
mark(M, 2144, 2151)

A30 = lesson("Exercise L: fever video exercise",
    "Watch how to assess a child with fever, decide if children have a stiff neck, and classify a child.", [
    *T(M, 2138, 2138),
    video("Exercise L: does the child have fever?", "The video exercise, with the malaria rapid diagnostic test. The narration is being recorded.", "AC.8"),
    exL,
], (66, 66))

# ---------------------------------------------------------------- ear
A31 = lesson("Assess ear problem",
    "Ask about ear pain and discharge, look for pus draining from the ear and feel for tender swelling behind the ear.", [
    *T(M, 2154, 2176),
    pre(layout(M, 2177, 2183)),
    booklet(["ear"], "The same box in your chart booklet."),
    *T(M, 2185, 2213),
    CHECK,
    q("A child has swelling behind the ear, but it is not tender. Is this mastoiditis?", ["Yes", "No"], 1,
      "Both tenderness and swelling must be present to classify mastoiditis. Do not confuse this swelling of the bone with swollen lymph nodes."),
], (67, 68))

EAR_TABLE = table([
    ("severe", ["Tender swelling behind the ear", "MASTOIDITIS"]),
    ("moderate", ["Pus draining from the ear and discharge is reported for less than 14 days, or Ear pain", "ACUTE EAR INFECTION"]),
    ("moderate", ["Pus is seen draining from the ear and discharge is reported for 14 days or more", "CHRONIC EAR INFECTION"]),
    ("mild", ["No ear pain and No pus seen draining from the ear", "NO EAR INFECTION"]),
])
mark(M, 2225, 2234)

E0 = {"hasEarProblem": True, "earPain": False, "earDischarge": False, "tenderSwelling": False, "pusFromEar": False}
exM = [
    kase("sudan-imnci-ac-ex-m1-hala", "Exercise M, case 1: Hala", [text_of(M, 2256, 2266)], ["ear"], pt("Hala", "female", 36, 13, 70, 37.5),
         {**E0, "earPain": True, "earDischarge": True, "earDischargeDays": 365, "tenderSwelling": True}, {"ear": ["mastoiditis"]},
         ["Hala has tender swelling behind one ear: MASTOIDITIS (pink row).",
          "She also has ear pain and discharge on and off for about a year, but always select the more serious classification."], 6),
    kase("sudan-imnci-ac-ex-m2-mona", "Exercise M, case 2: Mona", [text_of(M, 2274, 2282)], ["ear"], pt("Mona", "female", 18, 9, 57, 37),
         {**E0, "earDischarge": True, "earDischargeDays": 3, "pusFromEar": True}, {"ear": ["acute_ear_infection"]},
         ["Pus is seen draining from Mona's ear and the discharge has been present for 3 or 4 days, less than 14 days: ACUTE EAR INFECTION."], 6),
]
mark(M, 2267, 2271); mark(M, 2283, 2287)

A32 = lesson("Classify ear problem, and Exercise M",
    "Classify ear problem as MASTOIDITIS, ACUTE EAR INFECTION, CHRONIC EAR INFECTION or NO EAR INFECTION.", [
    *T(M, 2216, 2223),
    EAR_TABLE,
    booklet(["ear"], "The ear classification table in your chart booklet (Sudan national protocol)."),
    *T(M, 2236, 2246),
    H("Exercise M"),
    *T(M, 2249, 2253),
    *exM,
    *T(M, 2289, 2289),
    facil("Show your facilitator on the chart how you selected the classification for each child's ear problem."),
], (69, 70))

# ---------------------------------------------------------------- malnutrition and anaemia
from whz import wfl

A33 = lesson("Malnutrition and anaemia: why they matter",
    "Explain acute malnutrition, severe acute malnutrition, RUTF, and the causes of anaemia.", [
    *T(M, 2292, 2329),
    CHECK,
    q("Children with severe acute malnutrition and without medical complications, above the age of 6 months, can be managed at home with "
      "ready to use therapeutic food (RUTF). About what share of SAM cases are they?", ["About 20%", "About 80%"], 1,
      "They account 80% of cases of SAM."),
    sort("Which can cause anaemia?", ["Can cause anaemia", "Not a cause given in the book"], [
        ("Not eating foods rich in iron", "Can cause anaemia"), ("Hookworm or whipworm", "Can cause anaemia"),
        ("Repeated or inadequately treated malaria", "Can cause anaemia"), ("A runny nose", "Not a cause given in the book"),
    ]),
], (71, 71))

A34 = lesson("Assess for acute malnutrition: oedema and weight for length or height",
    "Look and feel for oedema of both feet and determine weight for length or height.", [
    *T(M, 2331, 2380),
    fig("ac-wfl-graph", "The WHO weight-for-length graph in the book. Use the charts in your chart booklet.", 72),
    booklet(["malnutrition"], "Malnutrition in your chart booklet (Sudan national protocol)."),
    growthchart := {"type": "growthchart", "chart": "wfl", "sex": "male", "ageMonths": 12, "weightKg": 8.0, "lengthCm": 76},
    drill("Drill: determining weight for length or height (from the facilitator guide; status worked out with the WHO tables the app uses)", [
        (f"{a} months, {'boy' if s == 'male' else 'girl'}, {kg} kg, {cm} cm", wfl(s, a, kg, cm)) for a, s, kg, cm in [
            (12, "male", 8.0, 76), (7, "female", 7.0, 72), (22, "male", 12, 96), (18, "female", 6, 67), (3, "male", 4, 56),
            (6, "female", 7.0, 64), (25, "male", 7.0, 81), (48, "female", 10, 89), (26, "male", 7, 91), (30, "female", 16, 100),
            (51, "male", 20.5, 116), (42, "male", 12, 101), (52, "female", 18, 103), (28, "male", 9, 82), (24, "male", 6, 75),
            (34, "female", 12, 90), (48, "female", 14, 102), (36, "male", 9, 86), (24, "male", 7.0, 80), (36, "female", 13, 92)]
    ]),
    facil("The charts are different for girls and for boys. For a child less than 2 years of age (less than 24 months) use the chart from "
          "birth up to 2 years; from 2 years use the chart for 2 to 5 years."),
    CHECK,
    q("A child 18 months old will not lie down. You measure his standing height: 78.3 cm. What length do you use?",
      ["78.3 cm", "79.0 cm", "77.6 cm"], 1,
      "If a child less than 2 years old will not lie down for measurement of length, measure standing height and add 0.7 cm to convert it to length."),
    q("You press on the top of each foot and a dent remains in both feet. What does this child have?", ["Oedema of both feet", "Dehydration"], 0,
      "The child has edema if a dent remains in the child's foot when you lift your thumb."),
], (72, 73))

A35 = lesson("MUAC, medical complications and the appetite test",
    "Measure MUAC, check a child with severe acute malnutrition for medical complications, and do an appetite test.", [
    *T(M, 2383, 2411),
    fig("ac-muac", "Measuring the mid-upper arm circumference (MUAC).", 74),
    *T(M, 2412, 2469),
    video("Measuring MUAC and doing the appetite test", "The narration is being recorded.", "AC.9"),
    CHECK,
    sort("What does the MUAC tell you?", ["Severe acute malnutrition", "Moderate acute malnutrition", "No malnutrition"], [
        ("MUAC 108 mm", "Severe acute malnutrition"), ("MUAC 119 mm", "Moderate acute malnutrition"),
        ("MUAC 125 mm", "No malnutrition"), ("MUAC 114 mm", "Severe acute malnutrition"),
    ]),
    q("A child with MUAC 110 mm has chest indrawing. Do you do the appetite test?", ["Yes", "No: he has a medical complication"], 1,
      "Conduct an appetite test for a child aged 6 months or more who has MUAC less than 115 mm, WFH/L less than -3 z-score or edema of both "
      "feet AND does NOT have medical complications. Pneumonia with chest indrawing is a medical complication."),
], (74, 76))

NUT_TABLE = table([
    ("severe", ["Oedema of both feet, or WFH/L less than -3 Z scores, or MUAC less than 115 mm AND Medical complication present and or "
                "Not able to finish RUTF.", "COMPLICATED SEVERE ACUTE MALNUTRITION (SAM)"]),
    ("moderate", ["WFH/L less than -3 Z-Scores or MUAC less than 115mm AND Able to finish RUTF and had no medical complications",
                  "UNCOMPLICATED SEVERE ACUTE MALNUTRITION (SAM)"]),
    ("moderate", ["WFH/L between -3 and -2 Z-scores or MUAC 115 up to 125 mm", "MODERATE ACUTE MALNUTRITION (MAM)"]),
    ("mild", ["WFH/L - 2 z-scores or more, or MUAC 125 mm or more.", "NO ACUTE MALNUTRITION"]),
], "Classification table for nutritional status, as printed in the book.")
mark(M, 2491, 2499); mark(M, 2506, 2509); mark(M, 2516, 2518); mark(M, 2524, 2526); mark(M, 2530, 2548)

A36 = lesson("Classify nutritional status",
    "Classify COMPLICATED SAM, UNCOMPLICATED SAM, MAM or NO ACUTE MALNUTRITION.", [
    *T(M, 2472, 2490),
    *T(M, 2501, 2504),
    *T(M, 2512, 2514),
    *T(M, 2520, 2522),
    *T(M, 2528, 2528),
    NUT_TABLE,
    booklet(["malnutrition"], "The classification table in your chart booklet (Sudan national protocol)."),
    facil("Your facilitator demonstrates how to classify nutritional status on the enlarged table: start at the pink row; oedema of both "
          "feet is always COMPLICATED SEVERE ACUTE MALNUTRITION; SAM by WFH/L or MUAC is complicated if there is a medical complication or "
          "the child cannot finish the RUTF."),
    CHECK,
    q("A child aged 2 years has MUAC 112 mm, no oedema, no medical complication, and eats the RUTF well. Classify.",
      ["COMPLICATED SEVERE ACUTE MALNUTRITION", "UNCOMPLICATED SEVERE ACUTE MALNUTRITION", "MODERATE ACUTE MALNUTRITION"], 1,
      "A child with WFH/L less than -3 z-scores or MUAC less than 115 mm and able to finish RUTF is classified as having UNCOMPLICATED "
      "SEVERE ACUTE MALNUTRITION."),
    q("A child has oedema of both feet. MUAC is 130 mm. Classify.",
      ["COMPLICATED SEVERE ACUTE MALNUTRITION", "NO ACUTE MALNUTRITION"], 0,
      "A child with edema of both feet is classified as having COMPLICATED SEVERE ACUTE MALNUTRITION."),
], (77, 78))

ANAEMIA_TABLE = table([("severe", ["Severe palmar pallor", "SEVERE ANAEMIA"]), ("moderate", ["Some pallor", "ANAEMIA"]),
                       ("mild", ["No palmar pallor", "NO ANAEMIA"])], "Classification table for anaemia.")
mark(M, 2574, 2574); mark(M, 2579, 2579); mark(M, 2585, 2585); mark(M, 2589, 2596)

A37 = lesson("Assess and classify anaemia",
    "Look for palmar pallor and classify SEVERE ANAEMIA, ANAEMIA or NO ANAEMIA.", [
    *T(M, 2551, 2566),
    fig("ac-palm", "Looking for palmar pallor.", 79),
    *T(M, 2569, 2572),
    *T(M, 2576, 2577),
    *T(M, 2581, 2583),
    *T(M, 2587, 2587),
    ANAEMIA_TABLE,
    booklet(["anemia"], "The anaemia table in your chart booklet (Sudan national protocol)."),
    CHECK,
    q("The skin of the child's palm is so pale that it looks white. Classify.", ["SEVERE ANAEMIA", "ANAEMIA", "NO ANAEMIA"], 0,
      "If the skin of the palm is so pale that it looks white, the child has severe palmar pallor: SEVERE ANAEMIA."),
], (79, 80))

exN = qz("sudan-imnci-ac-ex-n-pallor", "Exercise N: palmar pallor and oedema (photographs)", [text_of(M, 2600, 2602), text_of(M, 2618, 2619)], [
    *[mcq(f"n{p}", f"Photograph {p}. Does the child have severe pallor, some pallor or no pallor?", ["Severe pallor", "Some pallor", "No pallor"], a,
          f"The child has {['severe', 'some', 'no'][a]} palmar pallor.")
      for p, a in (("41", 1), ("42", 2), ("43a", 0), ("43b", 2), ("44", 0), ("45", 1), ("46", 0))],
    mcq("n48", "Photograph 48 (photograph 50 in the booklet). Does the child have oedema of the feet?", ["Yes", "No"], 0, "This child has oedema of both feet."),
], 8)
EXERCISES[-1]["narrative"].append("Answers from the facilitator guide's list of photographs of the sick child.")
mark(M, 2620, 2633)

A38 = lesson("Exercise N: palmar pallor",
    "Decide from photographs if a child has severe, some or no palmar pallor, and oedema of the feet.", [
    *T(M, 2599, 2599),
    photo(38, "Photograph 38: This child's skin is normal. There is no palmar pallor."),
    photo(39, "Photograph 39: the child on the left (39a) has some palmar pallor; the child on the right (39b) has no palmar pallor."),
    photo(40, "Photograph 40: the child on the left (40a) has no palmar pallor; the child on the right (40b) has severe palmar pallor."),
    *T(M, 2604, 2616, headings=False),
    *[photo(p, "Photograph 43 (43a and 43b)" if p == 43 else "") for p in (41, 42, 43, 44, 45, 46)],
    photo(50, "Photograph 48 in the book (photograph 50 in the booklet): does the child have oedema of the feet?"),
    exN,
    *T(M, 2635, 2635),
], (81, 81))

ALL7 = ["danger", "cough", "diarrhea", "fever", "ear", "malnutrition", "anemia"]
N0 = {"edema": False, "medicalComplication": False}
exO = [
    kase("sudan-imnci-ac-ex-o1-nadia", "Exercise O, case 1: Nadia", [text_of(M, 2646, 2664)], ALL7, pt("Nadia", "female", 18, 8, 96, 38.5),
         {**NO_DANGER, "hasCough": False, "hasDiarrhea": False, "hasFever": True, "feverDays": 5, **F0, "measlesRash": True,
          "hasEarProblem": False, **N0, "muacCm": 11, "appetiteTest": "passed", "pallor": "noPallor"},
         {"danger": ["no_danger_sign"], "malnutrition": ["uncomplicated_sam"], "anemia": ["no_anemia"]},
         ["Nadia has no general danger sign, no stiff neck, and lives in a high malaria risk area. The book does not give a malaria test "
          "result: do the malaria test before you classify her fever (the facilitator guide's answer is MALARIA).",
          "She has a generalized rash and no complications: MEASLES.",
          "MUAC 11 cm (less than 115 mm), no oedema, no medical complication, and she passed the appetite test: UNCOMPLICATED SEVERE ACUTE MALNUTRITION.",
          "No palmar pallor: NO ANAEMIA."]),
    kase("sudan-imnci-ac-ex-o2-idris", "Exercise O, case 2: Idris", [text_of(M, 2667, 2679)], ALL7,
         {"childName": "Idris", "sex": "male", "ageMonths": 11, "weightKg": 8, "tempC": 37, "visitType": "initial"},
         {**NO_DANGER, "hasCough": True, "coughDays": 21, "breathRate": 41, "fastBreathing": False, "chestIndrawing": False, "stridor": False,
          "wheeze": False, "hasDiarrhea": False, "hasFever": False, "hasEarProblem": False, **N0, "muacCm": 11, "appetiteTest": "failed",
          "pallor": "severePallor"},
         {"danger": ["no_danger_sign"], "cough": ["cough_cold"], "malnutrition": ["complicated_sam"], "anemia": ["severe_anemia"]},
         ["Idris is 11 months old: fast breathing is 50 or more. He has 41, no chest indrawing and no stridor: COUGH OR COLD. He has coughed "
          "for 21 days, more than 2 weeks: a chronic cough.",
          "MUAC 11 cm and he did not finish the RUTF: COMPLICATED SEVERE ACUTE MALNUTRITION.",
          "His palms are very pale and appear almost white: SEVERE ANAEMIA."]),
    kase("sudan-imnci-ac-ex-o3-gaafar", "Exercise O, case 3: Gaafar", [text_of(M, 2684, 2695)], ALL7,
         {"childName": "Gaafar", "sex": "male", "ageMonths": 9, "lengthCm": 67, "tempC": 36.8, "visitType": "initial"},
         {**NO_DANGER, "hasCough": False, "hasDiarrhea": True, "diarrheaDays": 5, "bloodInStool": False, **D0, "drinkEagerly": True,
          "pinchSlow": True, "hasFever": False, "hasEarProblem": False, **N0, "muacCm": 13, "pallor": "noPallor"},
         {"danger": ["no_danger_sign"], "diarrhea": ["some_dehydration"], "malnutrition": ["no_malnutrition"], "anemia": ["no_anemia"]},
         ["Gaafar is thirsty and eager to drink, and his skin pinch goes back slowly: SOME DEHYDRATION.",
          "MUAC 13 cm, no oedema: NO ACUTE MALNUTRITION (the book gives his weight as 0 kg, so weight for length cannot be checked).",
          "No palmar pallor: NO ANAEMIA."]),
    kase("sudan-imnci-ac-ex-o4-omran", "Exercise O, case 4: Omran", [text_of(M, 2699, 2717)], ALL7, pt("Omran", "male", 37, 9.5, 90, 37.5),
         {**NO_DANGER, "hasCough": False, "hasDiarrhea": False, "hasFever": True, "feverDays": 3, **F0, "hasEarProblem": True,
          "earPain": True, "earDischarge": True, "earDischargeDays": 5, "pusFromEar": True, "tenderSwelling": False, **N0,
          "muacCm": 9.5, "appetiteTest": "passed", "pallor": "noPallor"},
         {"danger": ["no_danger_sign"], "ear": ["acute_ear_infection"], "malnutrition": ["uncomplicated_sam"], "anemia": ["no_anemia"]},
         ["The risk of malaria is high and Omran has no danger sign or stiff neck. The book gives no malaria test result: do the test before "
          "you classify his fever.",
          "Ear pain, and pus draining from the ear for about 5 days: ACUTE EAR INFECTION.",
          "MUAC 9.5 cm, no medical complication, passed the appetite test: UNCOMPLICATED SEVERE ACUTE MALNUTRITION.",
          "No palmar pallor: NO ANAEMIA."]),
]

A39 = lesson("Exercise O: classify the whole child",
    "Record and classify four children through every part of the chart, up to malnutrition and anaemia.", [
    *T(M, 2640, 2644),
    *exO,
    reveal("Nadia's book page gives her length as 96 cm at 18 months, and Idris's length as “08 cm”. What do you do when a measurement "
           "cannot be right?", "Measure the child again. In these cases the MUAC is enough to classify the child's nutritional status.",
           "Think about it"),
], (82, 83))

# ---------------------------------------------------------------- immunization, vitamin A, other problems
mark(M, 2739, 2746); mark(M, 2817, 2828)
SCHEDULE = html_table(["Age", "Vaccines"], [
    ("At birth", "OPV 0, BCG"), ("6 weeks", "OPV 1, Rota 1, PCV 1, Penta 1, IPV 1"), ("10 weeks", "OPV 2, Rota 2, PCV 2, Penta 2"),
    ("14 weeks", "OPV3, Rota 3, PCV 3, Penta 3, IPV 2"), ("9 months", "Measles, Yellow fever, Men A"), ("18 months", "Measles boaster"),
])

A40 = lesson("Check the child's immunization status",
    "Use the national schedule to decide which immunizations a sick child needs today.", [
    *T(M, 2720, 2737),
    *T(M, 2739, 2740),
    SCHEDULE,
    form(["vaccine"], "The immunization section of the Recording Form."),
    *T(M, 2748, 2755),
    CHECK,
    q("A child 5 months old has had only BCG and OPV 0. What do you do?",
      ["Start the whole schedule again", "Give the immunizations he needs now; give the remaining doses at least 4 weeks apart"], 1,
      "Give the necessary immunizations any time after the child reaches that age. Give the remaining doses at least 4 weeks apart. You do "
      "not need to repeat the whole schedule."),
], (84, 84))

A41 = lesson("Contraindications to immunization",
    "Know the only three contraindications, and immunize sick children who are well enough to go home.", [
    *T(M, 2758, 2815),
    CHECK,
    sort("Immunize today, or not?", ["Immunize today if due", "Do not immunize today"], [
        ("A child with diarrhoea who is due for OPV", "Immunize today if due", "Give OPV, but do not count the dose: return in 4 weeks for an extra dose."),
        ("A child who is being referred to hospital", "Do not immunize today", "The hospital staff decide, to avoid delaying referral."),
        ("A child with a minor illness who will go home", "Immunize today if due"),
    ]),
], (85, 86))

A42 = lesson("Check the child's vitamin A supplementation status",
    "Decide if a child needs vitamin A today.", [
    *T(M, 2831, 2868),
    CHECK,
    q("A child 10 months old received vitamin A 2 months ago. Does he need vitamin A supplementation today?", ["Yes", "No"], 1,
      "When giving vitamin A as a supplement to prevent deficiency, make sure that it is not given more often than every 6 months."),
    q("A child 4 months old has never had vitamin A. Does he need vitamin A supplementation today?", ["Yes", "No"], 1,
      "You will only give vitamin A supplementation if the child is 6 months or older."),
], (87, 87))

IMM = ["Immunize this child today if due for immunization", "Do not immunize today"]
exQ = qz("sudan-imnci-ac-ex-q-immunization", "Exercise Q: immunization and vitamin A", [text_of(M, 2873, 2874)], [
    *[mcq(f"q1_{i}", f"If the child {t}", IMM, a, w) for i, (t, a, w) in enumerate([
        ("will be treated at home with antibiotics", 0, "There are no contraindications to immunization of a sick child if the child is well enough to go home."),
        ("has a local skin infection", 0, ""),
        ("had convulsion immediately after Penta 1 and needs Penta 2 and OPV 2 today", 0,
         "Give OPV 2 but do not give Penta 2: do not give Penta 2 or Penta 3 to a child who has had convulsions or shock within 3 days of the most recent dose."),
        ("has a chronic heart problem", 0, ""),
        ("is being referred for severe classification", 1, "If a child is going to be referred, do not immunize the child before referral."),
        ("is exclusively breastfed", 0, ""), ("older brother had convulsion last year", 0, ""), ("was jaundiced at birth", 0, ""),
        ("is MODERATE ACUTE MALNUTRITION", 0, "It is very important to immunize sick and malnourished children."),
        ("is known to have AIDS and has not received any immunizations at all", 0, "Give OPV, Penta and measles, but do not give BCG to a child known to have AIDS."),
        ("has NO PNEUMONIA: COUGH OR COLD", 0, ""),
    ])],
    open_q("q2_salim", text_of(M, 2897, 2910).replace("…", ""), [
        "Not up to date.", "He needs Penta 3, OPV 3 and IPV (facilitator guide). By the schedule he also needs PCV 3 and Rota 3.",
        "He should return at 9 months of age for measles, yellow fever and Men A.", "Yes, vitamin A today, because he is 6 months old."]),
    open_q("q2_samia", text_of(M, 2914, 2933).replace("…", ""), [
        "Not up to date.", "She needs OPV 2, Penta 2, PCV 2 (and Rota 2). Do not count (record) OPV 2, because she has diarrhoea.",
        "At her next visit: Penta 3, repeat OPV 2, and the other doses due.", "Return in 4 weeks.", "No vitamin A: she is 3 months old."]),
    open_q("q2_ali", text_of(M, 2936, 2953).replace("…", ""), [
        "Not up to date.", "He needs Penta 3, OPV 3, IPV, PCV 3 and Measles (by the schedule also Rota 3, Yellow fever and Men A).",
        "No vitamin A today: he received it at 7 months, less than 6 months ago. He returns for vitamin A when 6 months have passed."]),
], 15)
mark(M, 2875, 2955)

A43 = lesson("Exercise Q: immunization and vitamin A",
    "Decide if a contraindication is present, and which immunizations and vitamin A three children need.", [
    *T(M, 2871, 2871),
    SCHEDULE,
    exQ,
    facil("There are very few contraindications to immunization. Even when a contraindication is present for one vaccine, other vaccines "
          "may be safely given. Premature babies do not receive their immunizations later: count the age from the day the baby is born."),
], (88, 89))

A44 = lesson("Assess other problems",
    "Assess any other problems, and remember that a child with any danger sign is referred.", [
    *T(M, 2958, 2980),
    CHECK,
    q("A child has a general danger sign but no severe classification for any main symptom. What does the chart's warning tell you?",
      ["He can go home", "Make sure he is referred after the first dose of an appropriate antibiotic and other urgent treatments"], 1,
      "MAKE SURE CHILD WITH ANY DANGER SIGN IS REFERRED after first dose of an appropriate antibiotic and other urgent treatments. Exception: "
      "rehydration according to Plan C may resolve danger signs so that referral is no longer needed."),
], (90, 90))

R7 = ALL7
exR = [
    kase("sudan-imnci-ac-ex-r1-omer", "Exercise R, case 1: Omer", [text_of(M, 2992, 3008)], R7, pt("Omer", "male", 9, 9.5, 60, 37.5),
         {**NO_DANGER, "hasCough": False, "hasDiarrhea": True, "diarrheaDays": 7, "bloodInStool": False, **D0, "sunkenEyes": True,
          "drinkEagerly": True, "pinchSlow": True, "hasFever": True, "feverDays": 2, **F0, "hasEarProblem": False, **N0, "pallor": "noPallor"},
         {"danger": ["no_danger_sign"], "diarrhea": ["some_dehydration"], "anemia": ["no_anemia"]},
         ["Sunken eyes, drinks eagerly, skin pinch goes back slowly: SOME DEHYDRATION. 7 days, no blood: no persistent diarrhoea, no dysentery.",
          "He has had fever for 2 days and no danger sign or stiff neck: do the malaria test before you classify the fever (the book gives no result).",
          "The book's MUAC (“7226”) and length (60 cm) cannot be right: measure again before you classify his nutritional status.",
          "No palmar pallor: NO ANAEMIA.",
          "Immunization: he needs Measles, Yellow fever and Men A (and IPV and Rota 3 by the schedule). He needs vitamin A today."]),
    kase("sudan-imnci-ac-ex-r2-najwa", "Exercise R, case 2: Najwa", [text_of(M, 3011, 3027)], R7, pt("Najwa", "female", 4, 5.5, 60, 38),
         {**NO_DANGER, "hasCough": False, "hasDiarrhea": True, "diarrheaDays": 2, "bloodInStool": True, **D0, "hasFever": True,
          "feverDays": 2, **F0, "malariaTest": "negative", "hasEarProblem": False, **N0, "pallor": "noPallor"},
         {"danger": ["no_danger_sign"], "diarrhea": ["no_dehydration", "dysentery"], "fever": ["fever_no_malaria"],
          "malnutrition": ["no_malnutrition"], "anemia": ["no_anemia"]},
         ["No signs of dehydration: NO DEHYDRATION. Blood in the stool: DYSENTERY.",
          "Fever with a negative malaria test: FEVER NO MALARIA.",
          f"Weight for length (5.5 kg, 60 cm, girl): {wfl('female', 4, 5.5, 60)}: NO ACUTE MALNUTRITION. She is 4 months old: MUAC is not used.",
          "No palmar pallor: NO ANAEMIA.", "Immunization: she needs Penta 2, OPV 2, PCV 2 and Rota 2 today. No vitamin A: she is under 6 months."]),
    kase("sudan-imnci-ac-ex-r3-jamila", "Exercise R, case 3: Jamila", [text_of(M, 3031, 3047)], R7, pt("Jamila", "female", 37, 15.3, 80, 38.5),
         {**NO_DANGER, "hasCough": True, "coughDays": 2, "breathRate": 55, "fastBreathing": True, "chestIndrawing": False, "stridor": False,
          "wheeze": False, "hasDiarrhea": False, "hasFever": True, "feverDays": 2, **F0, "malariaTest": "positive", "hasEarProblem": False,
          **N0, "muacCm": 13, "pallor": "noPallor"},
         {"danger": ["no_danger_sign"], "cough": ["pneumonia"], "fever": ["malaria"], "malnutrition": ["no_malnutrition"], "anemia": ["no_anemia"]},
         ["37 months old with 55 breaths per minute: fast breathing, PNEUMONIA.",
          "Fever and a positive malaria test: MALARIA. Her rash is only on her hand, not generalized: do not classify measles.",
          "MUAC 13 cm: NO ACUTE MALNUTRITION. No palmar pallor: NO ANAEMIA.",
          "She is up to date for her age except measles, yellow fever and Men A, which the book's history does not list; she had vitamin A one "
          "month ago, so no vitamin A today."]),
    kase("sudan-imnci-ac-ex-r4-amel", "Exercise R, case 4: Amel", [text_of(M, 3051, 3061)], R7, pt("Amel", "female", 6, 4, 55, 37),
         {**NO_DANGER, "hasCough": True, "coughDays": 4, "breathRate": 52, "fastBreathing": True, "chestIndrawing": False, "stridor": False,
          "wheeze": False, "hasDiarrhea": False, "hasFever": False, "hasEarProblem": False, **N0, "muacCm": 12.4, "pallor": "noPallor"},
         {"danger": ["no_danger_sign"], "cough": ["pneumonia"], "malnutrition": ["mam"], "anemia": ["no_anemia"]},
         ["6 months old with 52 breaths per minute: fast breathing, PNEUMONIA.",
          "MUAC 12.4 cm (124 mm), 115 up to 125 mm: MODERATE ACUTE MALNUTRITION.",
          "No palmar pallor: NO ANAEMIA.", "Immunization: she needs OPV 2, Penta 2, PCV 2 and Rota 2. Vitamin A: yes, she is 6 months old and has not had it."]),
]

A45 = lesson("Exercise R: the whole ASSESS & CLASSIFY chart",
    "Use the entire process on the chart for four children, including immunization and vitamin A.", [
    *T(M, 2983, 2988),
    *exR,
    reveal("Najwa's facilitator guide answer leaves out DYSENTERY. Which is right?",
           "Najwa has blood in the stool. Classify a child with diarrhea and blood in the stool as having DYSENTERY: she has NO DEHYDRATION "
           "and DYSENTERY.", "Think about it"),
], (91, 92))

exST = qz("sudan-imnci-ac-ex-st-video", "Exercises S and T: case studies (video)", [text_of(M, 3066, 3068), text_of(M, 3075, 3076)], [
    open_q("s1", "Exercise S: record the child's signs and classifications on the Recording Form.", ["Check your form with the answer on the video."]),
    open_q("t1", "Exercise T, case study 1: record the child's signs and classifications.", ["Check your form with the answer on the video."]),
    open_q("t2", "Exercise T, case study 2: record the child's signs and classifications.", ["Check your form with the answer on the video."]),
], 20)

A46 = lesson("Exercises S and T: video case studies, and summary",
    "Assess and classify children shown on the video, through every part of the chart.", [
    *T(M, 3064, 3064),
    video("Exercise S: ear problem, malnutrition and anaemia", "The video exercise. The narration is being recorded.", "AC.10"),
    *T(M, 3070, 3070),
    *T(M, 3073, 3073),
    video("Exercise T: two case studies", "The video exercise. The narration is being recorded.", "AC.11"),
    form(ALL7 + ["vaccine"], "Use the full Recording Form for each case study on the video."),
    exST,
    facil("Summary of the module. For every sick child age 2 months up to 5 years: ask the mother about the child's problems; check for "
          "general danger signs; ask about the four main symptoms and, when one is present, assess and classify it; check for malnutrition "
          "and anaemia; check immunization and vitamin A status; assess other problems. A child with any general danger sign needs urgent "
          "referral. Classify each main symptom only once, in the most serious row."),
], (93, 94))

MODULE = module("Module 2: Assess and classify the sick child age 2 months up to 5 years", 2,
                [A1, A2, A3, A3b, A4, A5, A6, A7, A8, A9, A10, A11, A12, A13, A14, A15, A15b, A16, A17, A18, A19, A20, A20b, A21, A22, A23, A24, A25,
                 A26, A27, A28, A29, A30, A31, A32, A33, A34, A35, A36, A37, A38, A39, A40, A41, A42, A43, A44, A45, A46])

# Cover, credits, contents, page numbers.
mark(M, 1, 49)
# Case headings ("Case 1: Hamza") are the exercise titles; a stray "Dr" on page 82.
for n in (536, 572, 613, 648, 1029, 1052, 1074, 1148, 1189, 1232, 1908, 1963, 2022, 2078, 2255, 2273, 2638, 2645, 2666, 2682, 2697,
          2990, 3010, 3029, 3049):
    mark(M, n, n)
