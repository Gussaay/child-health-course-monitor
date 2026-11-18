# Module 5 of the classic Sudan IMNCI course: Counsel the mother (2023 book),
# in the order of the facilitator guide (Dec 2021). Book text word for word.
# The book's own "short answer exercises" are self-checked: their answers (at the
# end of the book) open beside each exercise.
from src import mark, text_of
from newmod import *

M = "cm"
B = Book(M, "Sudan IMNCI module: Counsel the mother (2023)", "sudan-imnci-cm", 400)
EXERCISES = B.EXERCISES

def answers(a, b):
    return reveal("Check your own answers", text_of(M, a, b), "Answers")

L = []
L += lessons("Introduction: the COUNSEL THE MOTHER chart",
    "Say what this module teaches: assess feeding, counsel about feeding problems, fluids, when to return and the mother's own health.", [
    *A(M, 52, 100),
    from_fg(5505, 5515),
], (3, 3))

L += lessons("1.0 Feeding recommendations: up to 6 months and 6 up to 12 months",
    "Give the feeding recommendations for a child up to 6 months, 6 up to 8 months and 9 up to 12 months.", [
    *A(M, 101, 280),
], (4, 7))

L += lessons("Feeding recommendations: 12 months and older, and persistent diarrhoea",
    "Give the feeding recommendations for a child of 12 months up to 2 years, 2 years and older, and with persistent diarrhoea.", [
    *A(M, 281, 378),
], (8, 10))

exA = B.exo("ex-a-feeding-recommendations", "Counsel the mother, Exercise A: feeding recommendations",
            "Answer the questions about the feeding recommendations.", 5537, 5564)
L += lessons("Exercise A: feeding recommendations",
    "Answer questions about the feeding recommendations for children of different ages.", [
    *A(M, 379, 424),
    exA,
    discuss("Drill: which column of the feeding recommendations applies, and what should the child be fed? (Use your COUNSEL chart, then open the answers.)", 5572, 5700),
], (11, 11))

L += lessons("2.0 Assess the child's feeding",
    "Ask the feeding questions on the COUNSEL chart and compare the answers with the recommendations.", [
    *A(M, 425, 470),
    *A(M, 471, 499),
    answers(1644, 1650),
], (12, 13))

L += lessons("2.1 Identify feeding problems",
    "Identify every feeding problem before giving advice.", [
    *A(M, 500, 613),
], (14, 15))

L += lessons("Exercise B: role play, assessing feeding",
    "Watch or act a feeding assessment, then name the feeding problems found.", [
    *A(M, 614, 659),
    note(fg(5746, 5760), "Role play: what the mother is told"),
    discuss("After the role play: what feeding problems did the health worker find?", 5761, 5775),
], (15, 16))

L += lessons("3.0 and 3.1 Counsel the mother about feeding problems: give relevant advice",
    "Give only the advice that is relevant to the feeding problems you found.", [
    *A(M, 660, 818),
], (17, 20))

exC = B.exo("ex-c-feeding-advice", "Counsel the mother, Exercise C: feeding problems and relevant advice",
            "For each written case, list the feeding problems and the relevant advice.", 5789, 5845)
L += lessons("Exercise C: feeding problems and relevant advice",
    "Identify feeding problems and the relevant advice for three written cases.", [
    *A(M, 819, 1075),
    exC,
], (20, 25))

L += lessons("3.2 Use good communication skills",
    "Ask, listen, praise, advise in simple words and check the mother's understanding.", [
    *A(M, 1076, 1115),
    *A(M, 1116, 1179),
    answers(1651, 1683),
], (26, 28))

L += lessons("3.3 Use a Mother's Card",
    "Use the Mother's Card to help a mother remember food, fluids and when to return.", [
    *A(M, 1180, 1214),
    *A(M, 1635, 1641),
    pagepic("cm-p41-mothers-card", 41, "The Mother's Card (page 41)."),
    pagepic("cm-p42-mothers-card", 42, "The Mother's Card (page 42)."),
    video("Giving feeding advice using good communication skills", "Demonstration role play: Akram's mother.", "CM.1"),
    from_fg(5856, 5870),
], (28, 29))

L += lessons("Exercise D: role plays, giving feeding advice",
    "Assess feeding and counsel the mother using good communication skills, in two role plays.", [
    *A(M, 1215, 1362),
    note(fg(6005, 6034), "Role plays: what the mothers are told"),
    discuss("After each role play: did the health worker ask all the feeding questions, praise, give only relevant advice, use simple words and check understanding?", 5963, 6004),
], (29, 32))

L += lessons("4.0 Advise the mother to increase fluids during illness",
    "Advise every mother taking her child home to give extra fluid during illness.", [
    *A(M, 1363, 1390),
], (33, 33))

L += lessons("5.0 Advise the mother when to return",
    "Tell the mother when to return for follow-up, immediately, and for immunization.", [
    *A(M, 1391, 1470),
    *A(M, 1471, 1511),
    answers(1684, 1727),
    video("Giving advice on fluid and when to return", "Demonstration role play, continued: Akram's mother and the Mother's Card.", "CM.2"),
    from_fg(6041, 6052),
], (34, 36))

L += lessons("Exercise E: role play, the whole COUNSEL chart",
    "Assess feeding, counsel, advise on fluid and when to return, using the Mother's Card.", [
    *A(M, 1512, 1579),
    note(fg(6151, 6156), "Role play: what the mother is told"),
], (36, 38))

L += lessons("6.0 Counsel the mother about her own health; Exercise F",
    "Listen for the mother's own health problems; discuss local feeding problems and practical advice.", [
    *A(M, 1580, 1634),
    from_fg(6161, 6172),
    facil("Summary of the module: assess the child's feeding; identify the feeding problems; give only relevant advice using good "
          "communication skills and the Mother's Card; advise on extra fluid during illness; tell the mother when to return for "
          "follow-up, immediately and for immunization; counsel her about her own health."),
], (39, 40))

MODULE = module("Module 5: Counsel the mother", 5, L)
mark(M, 1, 51)
mark(M, 1642, 1643)
