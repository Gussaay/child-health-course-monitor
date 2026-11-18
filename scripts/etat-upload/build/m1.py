# Module 1 of the Sudan ETAT course: Triage and the "ABCD" concept.
# Facilitator guide, Day 1 08:00-10:30: opening and introductions, module objectives,
# review of triage, ABCD, priority signs, triaging process, emergency and priority
# signs (chart), general principles of treatment, Drill 1, summary.
import json, os
from elib import *

EXERCISES = []
def _ex(e):
    EXERCISES.append(e); return ex(e["id"], e["title"].replace("Sudan ETAT: ", ""))

# ---- pre-test: the ETAT Pre/Post Test Entry questions used in the app's face-to-face courses
TEST = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "etat_test.json"), encoding="utf-8"))["questions"]
def test_questions():
    out = []
    for q in TEST:
        text = q["text"].split(". ", 1)[1] if q["text"][:3].strip(" .").isdigit() else q["text"]
        ids = [o["id"] for o in q["options"]]
        out.append(mcq(q["id"], text, [o["text"] for o in q["options"]], ids.index(q["correctAnswer"])))
    return out

PRE = _ex(equiz("sudan-etat-pre-test", 1, "Pre-test (ETAT Pre/Post Test)", [
    "اختبار قبلي: 20 سؤالاً من اختبار ETAT القبلي والبعدي. أجب عن كل الأسئلة قبل أن تبدأ الدروس.",
    "Pre-test: the 20 questions of the ETAT pre/post test. Answer every question before you start the lessons."],
    test_questions(), minutes=20, pass_mark=60))

skip(1, 306)          # cover, acknowledgements, table of contents
mark(400, 405)        # module title page

L = []
L.append(lesson("Welcome to the course and pre-test",
    "Know how this course works and take the pre-test before you start.", [
    timing("Day 1, 08:00 to 09:00: opening. Participants and facilitators introduce themselves and the course objectives are presented. "
           "The course runs over three and a half days: Module 1 Triage and the ABCD concept, Module 2 Airway and breathing (Day 1), "
           "Module 3 Circulation, Module 4 Coma and convulsion (Day 2), Module 5 Dehydration, Module 6 Case management scenarios (Day 3), "
           "Module 7 Implementing ETAT (Day 4)."),
    video("Welcome to the Sudan ETAT course", "Watch this first.", "ET1.1"),
    P_("Each lesson gives you the text of the WHO ETAT manual for participants, in the order the facilitator guide teaches it. "
       "Short activities check what you read: open each card, sort the signs, answer the questions. A lesson is complete when every "
       "activity in it is done, and then the next lesson opens."),
    P_("Drills, demonstrations and practical sessions from the facilitator guide are here too. Practical skills (back slaps, bag and "
       "mask, oxygen, IV and intraosseous lines, rectal diazepam, IV glucose) still need hands-on practice with a facilitator, on a "
       "doll or a model, before you use them with a sick child."),
    H("Pre-test"),
    P_("Before you start, take the pre-test. It has the 20 questions of the ETAT pre/post test, in Arabic. Do not worry about your "
       "score: the same test comes again at the end of the course, so you can see what you have learnt."),
    PRE,
]))

L.append(lesson("Introduction: why emergency triage?",
    "Explain why sick children need rapid triage and emergency treatment as soon as they arrive.", [
    *X(307, 340, h=[307]),
    *X(342, 375),
    story("Think about it: the nine-month-old baby", [
        stage("A nine-month-old baby is carried in. At the triage desk the nurse finds his lips and tongue grey/blue.",
              "What did the nurse do?", ["Sent him to wait in the queue", "Took him straight into the resuscitation room as an emergency",
                                         "Asked the mother to register first"], 1,
              "He was taken straight into the resuscitation room as an emergency."),
        stage("In the resuscitation room he is grunting and breathing very fast. His hands are cold and capillary refill is four seconds.",
              "How long after arrival was his situation stable?", ["18 minutes", "2 hours", "24 hours"], 0,
              "It is now 18 minutes since the baby came through the outpatient department’s door, and his situation is stable."),
        stage("Only then was a full history taken and a full examination done.",
              "Did the staff need to know the diagnosis before treating him?", ["Yes", "No"], 1,
              "No time was wasted: his status was stabilized based on a few leading signs and symptoms, even when the medical staff did not "
              "know exactly what was wrong with him."),
    ]),
]))

L.append(lesson("Learning objectives for the training course",
    "List what you will be able to do at the end of the course.", [
    H(TX(377, 377)),
    P_(TX(378, 378)),
    R(ul([TX(389, 390) + ul([clean(lines(M, n, n)[0]).lstrip("- ") for n in (391, 392, 393)])]
         + [TX(n, n) for n in range(394, 399)])),
    fgnote("Module 1 objectives: to understand the definition of triage, and to understand and apply the “ABCD” concept."),
    flip("The course in one look", [
        ("Triage", "All sick children, on arrival: emergency signs, priority signs, or non-urgent."),
        ("A and B", "Assess airway and breathing and give emergency treatments."),
        ("C", "Assess circulation and level of consciousness; manage shock, coma and convulsions."),
        ("D", "Assess and manage severe dehydration in a child with diarrhoea."),
        ("Implementing ETAT", "Plan and implement ETAT in your own working area in your hospital."),
    ]),
]))

L.append(lesson("What is triage?",
    "Define triage and name the three groups children are sorted into.", [
    timing("Day 1, 09:00: review the concept of triage (10 minutes)."),
    *X(407, 416),
    note(TX(418, 423), "Triage"),
    *X(425, 426),
    R(ul([TX(429, 431) + ul([clean(lines(M, n, n)[0]).lstrip("- ") for n in (432, 433, 434)]), TX(438, 440), TX(444, 445)])),
    note(TX(464, 465), "Footnote 1"),
    tbl([], [["<strong>E</strong>", "Emergency"], ["<strong>P</strong>", "Priority"], ["<strong>Q</strong>", "Queue (non-urgent)"]]),
    *X(455, 460),
    tbl(["Categories after triage", "Action required"], [
        ["EMERGENCY CASES", "Need immediate emergency treatment"],
        ["PRIORITY CASES", "Need assessment and rapid attention"],
        ["NON-URGENT CASES", "Can wait their turn in the queue"]]),
    sort("Which group? Sort each child the way the manual describes the three groups.", ["Emergency (E)", "Priority (P)", "Queue (Q)"], [
        ("Has an emergency sign and needs immediate emergency treatment", "Emergency (E)"),
        ("Has a priority sign: rapid assessment and treatment without delay", "Priority (P)"),
        ("No emergency or priority signs: waits for his turn", "Queue (Q)"),
        ("The majority of sick children", "Queue (Q)", "The majority of sick children will be non-urgent and will not require emergency treatment."),
    ]),
]))
mark(447, 453); mark(462, 462); mark(489, 499)

L.append(lesson("The ABCD concept and priority signs",
    "Say what the letters A, B, C and D stand for and list the priority signs (3 TPR - MOB).", [
    timing("Day 1: review the ABCD concept and the priority signs concept (10 minutes each)."),
    tbl([], [["<strong>A</strong>", "Airway"], ["<strong>B</strong>", "Breathing"], ["<strong>C</strong>", "Circulation<br>Coma<br>Convulsion"],
             ["<strong>D</strong>", "Dehydration (severe)"]]),
    *X(501, 505, h=[501]),
    fgnote("Each letter relates to an emergency sign indicating that immediate attention is required."),
    *X(507, 510, h=[507]),
    LI(513, 557),
    *X(559, 562),
    flip("3 TPR - MOB: turn each card", [
        ("3 T", "Tiny baby · Temperature · Trauma"),
        ("3 P", "Pallor (severe) · Poisoning · Pain (severe)"),
        ("3 R", "Respiratory distress · Restless, continuously irritable, or lethargic · Referral (urgent)"),
        ("M", "Malnutrition: Visible severe wasting"),
        ("O", "Oedema of both feet"),
        ("B", "Burns"),
    ]),
    reveal("Would you suggest other priority signs in your setting?", TX(559, 562), "Discuss"),
]))
mark(471, 487)

L.append(lesson("The triaging process: when, where and who",
    "Say when and where triage takes place and who should triage.", [
    timing("Day 1: review the triaging process (10 minutes): when and where should triage take place, who should triage, and how to triage."),
    *X(564, 570, h=[564]),
    *X(576, 581),
    tbl([], [["<strong>A</strong>", "Airway"], ["<strong>B</strong>", "Breathing"], ["<strong>C</strong>", "Circulation"],
             ["<strong>Cm</strong>", "Coma"], ["<strong>Cn</strong>", "Convulsion"], ["<strong>D</strong>", "Dehydration (severe)"],
             ["<strong>E</strong>", "Emergency"], ["<strong>P</strong>", "Priority"], ["<strong>Q</strong>", "Queue"]]),
    *X(583, 586, h=[583]),
    *X(602, 609),
    *X(611, 618, h=[611]),
    q("When should triage be carried out?", ["After registration", "As soon as a sick child arrives, well before registration",
                                              "When the doctor is ready"], 1, TX(584, 586)),
    q("Who should be trained in triage for emergency signs?", ["Only doctors", "Only nurses",
      "All clinical staff, and also people such as gatemen, record clerks, cleaners and janitors who have early patient contact"], 2,
      TX(612, 618)),
]))
mark(588, 600)

L.append(lesson("How to triage: the ABCD signs",
    "Use the ABCD steps to look for emergency signs, including the AVPU scale for coma.", [
    *X(620, 622, h=[620]),
    P_(TX(623, 623)),
    LI(628, 630),
    *X(632, 635),
    P_(TX(638, 638)),
    *X(640, 642),
    P_(TX(648, 648)),
    LI(649, 651),
    *X(657, 661),
    tbl([], [["<strong>A</strong>", "Alert"], ["<strong>V</strong>", "responds to Voice"], ["<strong>P</strong>", "responds to Pain"],
             ["<strong>U</strong>", "Unresponsive"]]),
    *X(675, 679),
    P_(TX(683, 683)),
    LI(698, 700),
    *X(702, 703),
    note(" ".join([TX(667, 668), TX(681, 681), TX(685, 685), TX(689, 689), TX(693, 694)]), "Remember"),
    sort("AVPU: what is the child’s level?", ["Lethargic (V)", "Coma (P or U)", "Alert (A)"], [
        ("Not alert but responds to voice", "Lethargic (V)"),
        ("Does not respond to voice, only responds to pain", "Coma (P or U)"),
        ("Does not respond at all", "Coma (P or U)"),
        ("Smiling or crying, talking", "Alert (A)"),
    ], "A child who is not alert but responds to voice is lethargic. A child at “P” or “U” has coma and needs to be treated accordingly."),
]))
mark(662, 673)

L.append(lesson("Assessing priority signs: tiny baby to poisoning",
    "Recognize the first priority signs: tiny infant, high temperature, trauma, severe pallor and poisoning.", [
    *X(705, 722, h=[705, 711, 717]),
    *X(728, 743, h=[728, 731, 737]),
    fig(1, TX(745, 746), 7),
    q("A sick baby is six weeks old and has no emergency sign. What is the triage?", ["Emergency", "Priority", "Queue"], 1,
      "All tiny babies of under two months should be seen as a priority."),
    q("How can you detect severe pallor?", ["Count the breathing", "Compare the child’s palms with your own",
                                            "Pinch the skin of the abdomen"], 1, TX(734, 736)),
]))
mark(745, 746)

L.append(lesson("Assessing priority signs: pain to burns",
    "Recognize the other priority signs: severe pain, lethargy or irritability, respiratory distress, urgent referral, malnutrition and burns.", [
    *X(748, 773, h=[748, 752, 758, 766, 770]),
    *X(779, 787, h=[779, 782]),
    reveal("A child has lower chest wall indrawing that you do not think is severe. Emergency or priority?",
           "The child does not require emergency treatment but will need urgent assessment (priority). " + TX(763, 765)),
    q("A lethargic child responds to voice but is drowsy and uninterested. Where is this on the AVPU scale?", ["A", "V", "P", "U"], 1,
      TX(753, 755)),
]))

L.append(lesson("Triage steps, teamwork and reassessment",
    "Follow the triage steps, start treatment for a positive sign, and reassess the child through ABCD.", [
    timing("Day 1: review the emergency and priority signs with ETAT chart (Chart 2), and the general principles of treatment of emergencies (10 minutes each)."),
    *X(788, 791),
    note(TX(793, 796), "Remember"),
    tbl(["Triage Steps", "Treat when any sign is positive"], [
        ["Assess A", "If positive, treat. If negative, proceed to B"], ["Assess B", "If positive, treat. If negative, proceed to C"],
        ["Assess C", "If positive, treat. If negative, proceed to D"], ["Assess D", "If positive, treat. If negative, proceed to priority signs"]]),
    *X(812, 813),
    tbl([], [["<strong>Priority (P):</strong>", "the child should be put at the front of the queue"],
             ["<strong>Queue (Q):</strong>", "if the child has no emergency or priority signs"]]),
    P_(TX(822, 822)),
    LI(836, 841),
    note(TX(828, 834), "Teamwork"),
    *X(843, 850),
    *X(852, 864, h=[852]),
    *X(866, 870, h=[866]),
    steps("The main steps in triage", [(t, "") for t in items(880, 883) + items(889, 890)]),
]))
mark(798, 810); mark(814, 820)

L.append(lesson("Summary and Chart 2: Triage of all sick children",
    "Review the summary of triage and read Chart 2, the triage chart for all sick children.", [
    R("<h3>" + TX(885, 885) + "</h3><p>" + TX(887, 887) + "</p><p>" + TX(872, 872) + "</p>"
      + ul(items(880, 883) + items(889, 890)) + "<p>" + TX(892, 895) + "</p>"),
    video("Triage of all sick children", "Chart 2, step by step.", "ET1.2"),
    chart("02a", 67, "Chart 2. Triage of all sick children: emergency signs (airway and breathing, circulation)."),
    chart("02b", 68, "Chart 2. Triage of all sick children (continued): coma/convulsing, severe dehydration, priority signs."),
    note(TX(4088, 4091), "About the chart numbers"),
    q("You find a positive sign under A. What do you do?", ["Finish the assessment of B, C and D first", "Treat it, then go on to B",
                                                           "Send the child to wait in the queue"], 1,
      "Do not proceed to the next step before treatment is begun for a positive sign."),
]))
skip(4020, 4194)

L.append(lesson("Drill 1: emergency and triage",
    "Answer quickly, as in the drill, what to do next at each finding.", [
    timing("Day 1, 10:15 to 10:30: drill on emergency and triage, with a resuscitation doll. The facilitator tells each participant a "
           "finding and asks for the correct response; keep the pace quick."),
    fgnote("Mother running in, baby in arms. Assess A and B first. Then go through each finding below and choose the correct response before you see it."),
    story("Drill 1", [
        stage("Assess A and B: obstructed breathing.", "What is the correct response?", ["Assess C", "Go to emergency", "Assess priority signs"], 1, "Go to emergency."),
        stage("Assess A and B: central cyanosis.", "What is the correct response?", ["Go to emergency", "Assess C", "Child waits in queue"], 0, "Go to emergency."),
        stage("Assess A and B: severe respiratory distress.", "What is the correct response?", ["Assess consciousness", "Go to emergency", "Priority patient"], 1, "Go to emergency."),
        stage("A and B stable, assess C: warm hand.", "What is the correct response?", ["Assess capillary refill", "Assess consciousness", "Check pulse"], 1, "Assess consciousness."),
        stage("A and B stable, assess C: cold hand.", "What is the correct response?", ["Assess capillary refill", "Assess consciousness", "Go to emergency"], 0, "Assess capillary refill."),
        stage("A and B stable, assess C: capillary refill fast.", "What is the correct response?", ["Check pulse", "Assess consciousness", "Go to emergency"], 1, "Assess consciousness."),
        stage("A and B stable, assess C: capillary refill slow.", "What is the correct response?", ["Check pulse", "Assess consciousness", "Ask for diarrhoea"], 0, "Check pulse."),
        stage("A and B stable, circulation stable: alert child.", "What is the correct response?", ["Ask for diarrhoea", "Go to emergency", "Child waits in queue"], 0, "Ask for diarrhoea."),
        stage("A and B stable, circulation stable: convulsing child.", "What is the correct response?", ["Ask for diarrhoea", "Go to emergency", "Assess priority signs"], 1, "Go to emergency."),
        stage("A and B stable, circulation stable: lethargy.", "What is the correct response?", ["Go to emergency", "Assess for diarrhoea and dehydration", "Child waits in queue"], 1, "Assess for diarrhoea and dehydration."),
        stage("A and B stable, circulation stable: unconscious child.", "What is the correct response?", ["Go to emergency", "Assess for diarrhoea", "Priority patient"], 0, "Go to emergency."),
        stage("A and B and C stable: no diarrhoea.", "What is the correct response?", ["Go to emergency", "Assess priority signs", "Assess capillary refill"], 1, "Assess priority signs."),
        stage("A and B and C and D stable: child is very hot.", "What is the correct response?", ["Priority patient", "Go to emergency", "Child waits in queue"], 0, "Priority patient."),
        stage("A and B and C and D stable: no priority signs.", "What is the correct response?", ["Priority patient", "Child waits in queue", "Go to emergency"], 1, "Child waits in queue."),
    ]),
]))

# ---- assessment questions (manual pp 10-12; model answers: facilitator guide Annex 5)
AQ = _ex(equiz("sudan-etat-aq-triage", 11, "Assessment questions: Triage", [TX(904, 905)], [
    open_q("q1", TX(906, 906), ["The sentence should read: Triage is the sorting of patients into priority groups according to their needs and the resources available. (See page 3)"]),
    open_q("q2", TX(908, 908), ["This assessment will decide whether the patient needs to be seen immediately and receive any life-saving treatment, or be seen soon as a priority, or can safely wait in the queue until his/her turn. (See page 3). It can be done in the OPD, emergency room or in the wards."]),
    open_q("q3", TX(910, 910), ["A person who is trained to assess the seriousness of sick children should see all of them on their arrival in hospital."]),
    open_q("q4", TX(912, 912), ["A: Airway", "B: Breathing", "C: Circulation, Coma and Convulsions", "D: Diarrhoea and Dehydration"]),
    open_q("q5", TX(914, 914), ["Tiny baby (any sick child is under 2 months of age)", "Temperature: child is very hot", "Trauma", "Pallor (severe)",
                               "Poisoning", "Pain (severe)", "Respiratory distress", "Restless, continuously irritable or lethargic",
                               "Referral (urgent)", "Malnutrition (visible severe wasting)", "Oedema of both feet", "Burns"]),
    open_q("q6", TX(942, 943) + " " + "; ".join(items(920, 927)), [
        "1 Look for emergency signs", "2 Ask about head or neck trauma", "3 Start treatment of any emergency signs you find",
        "4 Call a senior health worker to see any emergency", "5 Have blood specimens taken for laboratory analysis",
        "6 Look for any priority signs", "7 Place priority patients at the front of the queue", "8 Move on to the next patient"]),
    open_q("q7", TX(929, 932), ["Assessment is made following ABCD. The steps ABCD for emergency signs are normal. Now the child can be assessed for “P” priority signs."]),
    open_q("q8", TX(934, 936), ["Again, following the ABCD steps, the child does not have “E” emergency signs so the next step is to look for priority signs. On assessment of priority signs, the child is very hot, so the child is given priority for a full assessment."]),
    open_q("q9", TX(949, 951), ["The assessment follows the ABCD steps. First assess the airway, this child is drooling and may have obstructed breathing and is cyanosed. He therefore has emergency signs in under “A” and should be sent to the emergency room."]),
    open_q("q10", TX(953, 953), ["The assessment follows the ABCD steps. First assess the airway, breathing, and circulation, no positive signs are provided here. The child is convulsing and has emergency signs in under “C” and should be sent to the emergency room."]),
    open_q("q11", TX(955, 955), ["You check for visible severe wasting and oedema of both feet."]),
    open_q("q12", TX(957, 957), ["Signs of severe wasting are best visible on the chest, arms, thighs and buttocks; the skin looks too large for the body."]),
    open_q("q13", TX(959, 959), ["A child below the age of two months is always a priority."]),
    open_q("q14", TX(961, 961), ["When children are found to have a priority sign you will put them to the front of the queue so that they will be seen as soon as possible."]),
], minutes=20, source="WHO ETAT manual for participants (2005), assessment questions; answers: ETAT facilitator guide Annex 5"))
L.append(lesson("Assessment questions: Triage",
    "Answer the assessment questions on triage, then compare with the model answers.", [
    timing("These questions are given as self-assessment at the end of Day 1; the model answers (facilitator guide Annex 5) are discussed on Day 2 at 08:00."),
    H(TX(903, 903)),
    AQ,
    fgnote("Summary of Module 1 (5 minutes): triage sorts children into emergency, priority and queue; look at ABCD first and treat any "
           "emergency sign before going on; then look for the priority signs (3 TPR - MOB); reassess through ABCD."),
]))
mark(899, 961)

MODULE = module('Module 1: Triage and the "ABCD" concept', 1, L)
