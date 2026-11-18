# Module 7 of the classic Sudan IMNCI course: Follow-up (2023 book), in the
# order of the facilitator guide (Dec 2021). Book text word for word.
from src import mark
from newmod import *

M = "fu"
B = Book(M, "Sudan IMNCI module: Follow-up (2023)", "sudan-imnci-fu", 600)
EXERCISES = B.EXERCISES

L = []
L += lessons("Introduction: conducting a follow-up visit",
    "Say how a follow-up visit differs from an initial visit, and where the follow-up boxes are on the charts.", [
    *A(M, 61, 181),
    from_fg(7614, 7625),
], (4, 6))

L += lessons("1.0 Follow-up visit for pneumonia",
    "Reassess a child with PNEUMONIA after 3 days and decide the treatment.", [
    *A(M, 182, 233),
], (7, 7))

exA = B.exo("ex-a-pneumonia", "Follow-up, Exercise A: pneumonia", "Answer the questions about the children who came back for follow-up of PNEUMONIA.", 7659, 7702)
L += lessons("Exercise A: follow-up for pneumonia",
    "Decide how to reassess and treat children who return for follow-up of PNEUMONIA.", [
    *A(M, 234, 314),
    exA,
], (8, 9))

L += lessons("2.0 and 3.0 Follow-up for persistent diarrhoea and dysentery",
    "Reassess a child with PERSISTENT DIARRHOEA after 5 days and a child with DYSENTERY after 3 days.", [
    *A(M, 315, 391),
], (10, 11))

exB = B.exo("ex-b-diarrhoea", "Follow-up, Exercise B: dysentery and persistent diarrhoea",
            "Answer the questions about the children who came back for follow-up of DYSENTERY or PERSISTENT DIARRHOEA.", 7724, 7766)
L += lessons("Exercise B: follow-up for dysentery and persistent diarrhoea",
    "Decide how to reassess and treat children who return for follow-up of DYSENTERY or PERSISTENT DIARRHOEA.", [
    *A(M, 392, 491),
    exB,
], (12, 13))

L += lessons("4.0 and 5.0 Follow-up for malaria and fever",
    "Reassess a child whose fever persists after 3 days, with or without MALARIA.", [
    *A(M, 492, 584),
], (14, 16))

exC = B.exo("ex-c-fever", "Follow-up, Exercise C: malaria and fever",
            "Answer the questions about the children who came back because their fever persisted.", 7836, 7858)
L += lessons("Exercise C: follow-up for malaria and fever",
    "Decide how to reassess and treat children who return with fever.", [
    *A(M, 585, 632),
    exC,
], (16, 17))

L += lessons("6.0 and 7.0 Follow-up for measles complications and ear infection",
    "Reassess eye or mouth complications of measles, and an ear infection.", [
    *A(M, 633, 761),
], (17, 20))

L += lessons("8.0 Follow-up for feeding problem",
    "Reassess feeding and counsel the mother about any new or continuing feeding problem.", [
    *A(M, 762, 812),
], (20, 21))

L += lessons("10.0 and 11.0 Follow-up for severe and moderate acute malnutrition",
    "Reassess a child with UNCOMPLICATED SEVERE ACUTE MALNUTRITION or MODERATE ACUTE MALNUTRITION.", [
    *A(M, 813, 891),
], (21, 23))

L += lessons("9.0 Follow-up for anaemia",
    "Reassess a child with ANAEMIA after 14 days and continue iron.", [
    *A(M, 892, 913),
], (23, 23))

exD = B.exo("ex-d-review", "Follow-up, Exercise D: follow-up of the sick child",
            "Answer the questions about the children who came back for follow-up.", 7877, 7921)
L += lessons("Exercise D: follow-up of the sick child",
    "Decide how to reassess and treat children who return for follow-up of different problems.", [
    *A(M, 914, 1012),
    exD,
], (24, 25))

L += lessons("11.0 Give follow-up care for the sick young infant",
    "Find the follow-up boxes for the young infant, and reassess a local bacterial infection.", [
    *A(M, 1013, 1075),
], (26, 27))

L += lessons("11.2 to 11.4 Follow-up for jaundice, diarrhoea and feeding problem in a young infant",
    "Reassess a young infant with jaundice, diarrhoea or a feeding problem.", [
    *A(M, 1076, 1166),
], (28, 30))

L += lessons("11.5 and 11.6 Follow-up for low weight and thrush in a young infant",
    "Reassess a young infant with low weight for age or thrush.", [
    *A(M, 1167, 1245),
], (31, 32))

exE = B.exo("ex-e-young-infant", "Follow-up, Exercise E: the young infant",
            "Answer the questions about the young infants who came back for follow-up.", 7932, 7949)
L += lessons("Exercise E: follow-up of the young infant",
    "Decide how to reassess and treat young infants who return for follow-up.", [
    *A(M, 1246, len(__import__("src").SRC[M])),
    exE,
    facil("Summary of the module: at a follow-up visit, use the follow-up box for the child's classification; reassess as the box "
          "says; choose the treatment from the result; refer any child who is getting worse, who needs a second-line drug that is not "
          "available, or whom you are worried about. Think about what would make follow-up visits easier for mothers at your clinic."),
], (33, 33))

MODULE = module("Module 7: Follow-up", 7, L)
mark(M, 1, 60)
