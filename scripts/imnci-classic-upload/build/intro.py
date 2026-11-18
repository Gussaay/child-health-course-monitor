# Module 1 of the classic Sudan IMNCI course: Introduction (2023 book), in the
# order of the facilitator guide (Dec 2021): introductions, read the module up
# to the glossary, the facilitator's role, where participants work, summary.
# The book's text is used word for word (src.T); the activities only repeat it.
import re
from src import T, lines, join, mark, SRC
from lib import *

M = "intro"
SOURCE = "Sudan IMNCI module: Introduction (2023)"

L1 = lesson("Why integrated case management?",
    "Explain why a sick child's illnesses are managed together, with one set of integrated guidelines.", [
    video("Welcome to the IMNCI course", "Watch this first. The narration is being recorded.", "IN.1"),
    # A question before the reading, then an activity after each paragraph or two,
    # so the book's text (all of it, word for word) is read a part at a time.
    q("Think first: pneumonia, diarrhoea, malaria, measles and malnutrition together cause what share of deaths in children "
      "under five years of age?",
      ["About one in five", "About half", "More than 70%"], 2,
      "Pneumonia, diarrhoea, malaria, measles, and malnutrition cause more than 70% of deaths in children under five years of age."),
    *T(M, 25, 35),
    *T(M, 36, 47),
    flip("How the illnesses are linked", [
        ("Repeated diarrhoeal episodes", "often lead to malnutrition."),
        ("Diarrhoea that accompanies or follows measles", "is particularly severe."),
        ("So effective case management…", "needs to consider all of a child's symptoms."),
    ]),
    *T(M, 48, 53),
    q("A health worker follows the integrated case management process. What can they determine first?",
      ["Whether the child is severely ill and needs urgent referral", "Which single disease the child has",
       "Which hospital the mother prefers"], 0,
      "The health worker can determine if a child is severely ill and needs urgent referral. If not, the health worker can follow "
      "the guidelines to treat the child's illnesses. The guidelines also describe counseling for mothers and other caretakers."),
    *T(M, 54, 59),
    *T(M, 60, 67),
    sort("Is it described in this course? Sort each one the way the book says.",
         ["Described in this course", "Not described in this course"], [
        ("A child who comes to the clinic with an illness for the first time", "Described in this course"),
        ("A scheduled follow-up visit to check the child's improvement", "Described in this course"),
        ("A child returning with chronic problems or less common illnesses that need special care", "Not described in this course"),
        ("Trauma or other acute emergencies due to accidents or injuries", "Not described in this course"),
    ], "The guidelines address most but not all of the major reasons a child is brought to a clinic for illness."),
    *T(M, 68, 76),
    reveal("A child believed to have HIV is brought with diarrhoea. How is the child treated? And when is the child referred?",
           "The child is treated like any child coming in with the illness for the first time. The child is referred to a hospital for "
           "special care if the illness does not respond to the standard treatments, if the child becomes severely malnourished, or "
           "returns to the clinic repeatedly."),
    *T(M, 77, 82),
    H("Check yourself"),
    q("Why does effective case management need to consider all of a child's symptoms?",
      ["Because there are important relationships between the illnesses", "Because each illness has its own separate guideline",
       "Because the mother asks about only one problem"], 0,
      "There are important relationships between the illnesses. For example, repeated diarrhoeal episodes often lead to malnutrition; "
      "diarrhoea, which often accompanies or follows measles, is particularly severe."),
    reveal("Why is teaching families when to seek care part of the case management process?",
           "Case management can be effective only to the extent that families bring their sick children to a trained health worker for care "
           "in a timely way. If a family waits until the child is extremely sick, or takes the child to an untrained provider, the child is "
           "more likely to die from the illness."),
], (4, 5))

L2 = lesson("The case management process",
    "Name the six steps of the case management process and the charts that describe them.", [
    *T(M, 84, 95),
    steps("The six steps, one at a time", [
        ("Assess the child or young infant", "Taking a history and doing a physical examination."),
        ("Classify the illness", "Making a decision on the severity of the illness: a category, or “classification”, for each of the child’s "
         "major symptoms."),
        ("Identify treatment", "The charts recommend appropriate treatment for each classification."),
        ("Treat the child", "Giving treatment in clinic, prescribing drugs or other treatments to be given at home, and also teaching the "
         "mother how to carry out the treatments."),
        ("Counsel the mother", "Assessing how the child is fed and telling her about the foods and fluids to give the child and when to "
         "bring the child back to the clinic."),
        ("Give follow-up care", "When the child comes back for a scheduled follow-up visit to check the child's improvement."),
    ]),
    *T(M, 96, 132),
    flip("Which chart?", [
        ("Sick child age 2 months up to 5 years", "ASSESS AND CLASSIFY THE SICK CHILD, TREAT THE CHILD, COUNSEL THE MOTHER"),
        ("Young infant age up to 2 months", "ASSESS, CLASSIFY, AND TREAT THE SICK YOUNG INFANT"),
    ]),
    H("Check yourself"),
    q("A child is classified VERY SEVERE FEBRILE DISEASE. What does the classification tell you?",
      ["The exact disease: meningitis", "A category used to determine treatment, chosen to cover the most important diseases in it",
       "That the child does not need treatment"], 1,
      "Classifications are not specific disease diagnosis. They are categories that are used to determine treatment. A child with VERY "
      "SEVERE FEBRILE DISEASE could have meningitis, severe malaria, or septicaemia; the treatments listed cover the most important diseases."),
], (6, 7))

L3 = lesson("Purpose of this training course",
    "Say who the course is for and list the skills you will learn.", [
    *T(M, 134, 166),
    H("Check yourself"),
    sort("Is it given before referral, in the clinic, or taught to the mother to give at home? Sort the treatments the way the book lists them.",
         ["Pre-referral treatment", "Treatment in the clinic", "Taught to the mother for home"], [
        ("Diazepam given rectally", "Pre-referral treatment"),
        ("First dose of an antibiotic", "Pre-referral treatment"),
        ("Treatment to prevent low blood sugar", "Pre-referral treatment"),
        ("Oral rehydration therapy", "Treatment in the clinic"),
        ("Immunization", "Treatment in the clinic"),
        ("Oral salbutamol", "Taught to the mother for home"),
        ("Paracetamol", "Taught to the mother for home"),
    ], "These are the examples the book gives under each skill."),
], (7, 7))

L4 = lesson("Course methods and materials",
    "Describe how you will learn in this course: modules, exercises, clinical sessions and your facilitator.", [
    *T(M, 169, 197),
    facil("A facilitator is a person who helps the participants learn the skills presented in the course. Your facilitator will: guide you "
          "through the course activities; answer questions as they arise, or find the answer if they do not know; clarify information you "
          "find confusing; give individual feedback on exercises where indicated; lead group discussions, drills, video exercises and role "
          "plays; prepare you for each clinical session and demonstrate tasks; and observe and help you as needed during your practice in "
          "outpatient sessions."),
    reveal("Before you go on, think about your own work: what is the name of the clinic where you work, and what is your training or "
           "position? What is your responsibility for the care of sick children?",
           "Your facilitator asks every participant these questions at the start of the course. Keep your answers in mind: throughout the "
           "course you will be asked how you will use each skill in your own clinic.", "Think about it"),
    H("Check yourself"),
    q("How will you complete a module?", ["By listening to lectures", "By reading it and working through the exercises",
                                          "By reading only the glossary"], 1,
      "You will complete a module by reading it and working through the exercises. Most exercises describe a sick child and ask questions; "
      "some use photographs or video."),
], (8, 8))

L5 = lesson("Selecting the right chart",
    "Decide which age group a sick child is in, and select the right case management chart.", [
    video("The case management charts", "The narration is being recorded.", "IN.2"),
    *T(M, 200, 230),
    facil("“Up to” means up to but not including that age. “Up to 5 years” means the child has not yet had his fifth birthday."),
    sort("Which chart do you select? Sort each child.", ["ASSESS AND CLASSIFY THE SICK CHILD AGE 2 MONTHS UP TO 5 YEARS",
                                                       "ASSESS, CLASSIFY AND TREAT THE SICK YOUNG INFANT", "Not covered by these charts"], [
        ("A child 4 years 11 months old", "ASSESS AND CLASSIFY THE SICK CHILD AGE 2 MONTHS UP TO 5 YEARS",
         "He has not yet had his fifth birthday."),
        ("A child exactly 2 months old", "ASSESS AND CLASSIFY THE SICK CHILD AGE 2 MONTHS UP TO 5 YEARS",
         "A child who is 2 months old is in the group 2 months up to 5 years."),
        ("An infant 6 weeks old", "ASSESS, CLASSIFY AND TREAT THE SICK YOUNG INFANT", "Not yet 2 months of age: a young infant."),
        ("A child who is 5 years old", "Not covered by these charts", "“Up to 5 years” does not include a child who is 5 years old."),
    ]),
    reveal("Why not use this process for children age 5 years or more?",
           "The case management process is designed for children less than 5 years of age. Although much of the advice on treatment of "
           "pneumonia, diarrhoea, malaria, measles and malnutrition is applicable to older children, the assessment and classification of "
           "older children would differ. For example, the cut-off rates for determining fast breathing would be different, because normal "
           "breathing rates are slower in older children. (From the facilitator guide.)", "Discussion"),
    facil("Before you begin the next module, a reminder of what you will use: the case management process is described on charts. ASSESS "
          "AND CLASSIFY THE SICK CHILD, TREAT THE CHILD and COUNSEL THE MOTHER are used for sick children age 2 months up to 5 years. "
          "ASSESS, CLASSIFY AND TREAT THE SICK YOUNG INFANT is used from birth up to 2 months. You will learn all the steps from the modules "
          "and in clinical sessions. You are now ready to begin the first step of case management, assessing and classifying a sick child."),
], (9, 9))

# ---- Glossary ---------------------------------------------------------------
TERM = re.compile(r"^\s?([A-Z][A-Za-z0-9 ()\-’'/,]{1,60}?):\s*(.*)$")
def glossary(a, b):
    entries = []
    for raw in lines(M, a, b):
        if re.fullmatch(r"\s*\d{1,3}\s*", raw) or not raw.strip() or raw.strip() == "GLOSSARY":
            continue
        m = TERM.match(raw)
        if m and not raw.startswith("     "):
            entries.append([m.group(1).strip(), [m.group(2)]])
        else:
            entries[-1][1].append(raw)
    return entries

def gloss_html(entries):
    return R("".join(f"<p><strong>{esc(t)}:</strong> {esc(join(d))}</p>" for t, d in entries))

G1 = glossary(233, 437)
G2 = glossary(438, 681)
FG_GLOSSARY = ("Do not try to learn the glossary now. You will learn the terms in logical order as you study the modules. If you need help "
               "understanding a word when it is used in a module, look it up here, or ask a facilitator.")

L6 = lesson("Glossary: Abscess to Holoendemic",
    "Know where to find the meaning of a word used in the modules (Abscess to Holoendemic malaria area).", [
    facil(FG_GLOSSARY),
    gloss_html(G1),
    flip("A few words you will meet soon", [
        ("Assess", "To consider the relevant information and make a judgment. As used in this course, to examine the child and identify the "
                   "signs of illness."),
        ("Classify", "As used in this course, to select a category of illness and severity (called a classification) based on a child’s "
                     "symptoms and signs."),
        ("Clinic", "As used in this course, any first level outpatient health facility such as a dispensary, rural health post, health "
                   "center, or the outpatient department of a hospital."),
        ("Fever", "As used in this course: a history of fever, feeling hot to the touch, or an axillary temperature of 37.5ºC (99.5ºF) or "
                  "higher, or a rectal temperature of 38ºC (100.4ºF) or higher."),
    ]),
], (10, 13))

L7 = lesson("Glossary: Hospital to Whipworm",
    "Know where to find the meaning of a word used in the modules (Hospital to Whipworm).", [
    facil(FG_GLOSSARY),
    gloss_html(G2),
    flip("A few words you will meet soon", [
        ("Main symptoms", "The four main symptoms listed on the ASSESS AND CLASSIFY chart are: cough or difficult breathing, diarrhoea, "
                          "fever, and ear problem."),
        ("Signs", "Physical evidence of a health problem, which the health worker observes by looking, listening, or feeling."),
        ("Symptoms", "Health problems reported by the mother such as cough, diarrhoea, or ear pain."),
        ("Severe classification", "A very serious illness requiring urgent attention and usually referral or admissions for inpatient care. "
                                  "Listed in pink-coloured rows on the ASSESS AND CLASSIFY CHART."),
    ]),
], (13, 18))

MODULE = module("Module 1: Introduction", 1, [L1, L2, L3, L4, L5, L6, L7])
EXERCISES = []

# Lines that are not module content: cover, credits, contents, page numbers.
mark(M, 1, 24)
