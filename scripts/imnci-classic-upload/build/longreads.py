# Sudan IMNCI (classic): one short check in the middle of the longest reading (2026-11-20).
# Only lessons with more than about 4,500 characters of reading and no activity get one; glossaries and
# exercise lessons do not. Each check sits after a book paragraph, and its explanation is the book's words.
from lib import q

CHECKS = [
    (4, "2.2 Check the mother's understanding", "If the mother answers incorrectly or says she does not remember",
     q("Which is a good checking question?", ["\"Do you know how to give your child his medicine?\"", "\"How many tablets will you give each time?\""], 1,
       "\"Do you know how to give your child his medicine?\" The mother would probably answer \"yes\" whether she understands or not.")),
    (4, "3.0 Teach the mother to give oral drugs at home", "Watch the mother practice measuring a dose by herself.",
     q("The child vomits the tablet within 30 minutes. What do you tell the mother?", ["Give another dose", "Wait for the next dose"], 0,
       "If the child vomits within the 30 minutes (the tablet or syrup may be seen in the vomit), give another dose.")),
    (4, "6.0 and 6.1 Plan A: treat diarrhoea at home", "Teach the mother how to mix and give ORS. Give the mother 2 packets of ORS to use at home. Show",
     q("How much fluid does a child of 3 years need in addition to the usual fluid intake?", ["50 to 100 ml after each loose stool", "100 to 200 ml after each loose stool"], 1,
       "Up to 2 years 50 to 100 ml after each loose stool; 2 years or more 100 to 200 ml after each loose stool.")),
    (4, "Annex C-1: if you can give intravenous (IV) treatment (part 2)", "After 4 hours of IV treatment, Siham was able to drink.",
     q("After 6 hours Siham was reclassified as SOME DEHYDRATION. What did the health worker do?",
       ["Continued the IV fluid for 6 more hours", "Stopped the IV fluid and gave ORS solution as on Plan B"], 1,
       "The health worker chose Plan B to continue treatment. The health worker stopped the IV fluid. He began giving Siham ORS solution as indicated on Plan B.")),
    (5, "2.1 Identify feeding problems", "Difficulty breast feeding: The mother may mention",
     q("Why should feeding bottles not be used?", ["They are often dirty, and germs easily grow in them", "They make the child take too much milk"], 0,
       "Feeding bottles should not be used. They are often dirty, and germs easily grow in them.")),
    (5, "3.0 and 3.1 Counsel the mother about feeding problems: give relevant advice", "If there are no signs to start complementary foods, the goal is",
     q("A mother of a 4-month-old will change back to more breastfeeding. When should she return for follow-up?", ["In 7 days", "In 30 days"], 0,
       "Since this is an important change in the child's feeding, be sure to ask the mother to return for follow-up in 7 days.")),
    (7, "Introduction: conducting a follow-up visit", "Once you know that the child has come to the clinic for follow-up of an illness",
     q("A child comes for follow-up of pneumonia, and now he has diarrhoea. What do you do?",
       ["Follow only the pneumonia follow-up box", "Do a full assessment: he has a new problem"], 1,
       "If the child has come for follow-up of pneumonia, but now he has developed diarrhoea, he has a new problem. This child requires a full assessment.")),
    (7, "4.0 and 5.0 Follow-up for malaria and fever", "Treat with the (second-line or third line) oral antimalarial",
     q("Fever persists 3 days after a MALARIA classification, and malaria is the only apparent cause. What do you do?",
       ["Treat with the second-line (or third-line) oral antimalarial", "Give the first-line antimalarial again"], 0,
       "If malaria is the only apparent cause of fever: Treat with the (second-line or third line) oral antimalarial. "
       "(If no second-line or third line antimalarial is available refer to hospital.)")),
]

def apply(pkg, place):
    for module, lesson, anchor, block in CHECKS:
        place(pkg, module, lesson, anchor, [block])
