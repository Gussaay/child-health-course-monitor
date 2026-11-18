# Module 2 of the Sudan ETAT course: Airway and breathing.
# Facilitator guide, Day 1 10:30-17:00: presentation, management of the choking child,
# assessment and management of the airway, airway with possible neck trauma, bag and
# mask, review practice; after lunch: video of respiratory signs, oxygen sources and
# delivery devices, group work, summary and assignments.
from elib import *

EXERCISES = []
def _ex(e):
    EXERCISES.append(e); return ex(e["id"], e["title"].replace("Sudan ETAT: ", ""))

mark(967, 969)   # module title page

ABCD = tbl([], [["<strong>A</strong>", "Airway"], ["<strong>B</strong>", "Breathing"], ["<strong>C</strong>", "Circulation<br>Coma<br>Convulsion"],
                ["<strong>D</strong>", "Dehydration (severe)"]])

L = []
L.append(lesson("Airway and breathing: what to look for",
    "Name the four questions for airway and breathing and the emergency treatments in Table 1.", [
    timing("Day 1, 10:30 (15 minutes): presentation of “Airway and Breathing”: the module objectives, the airway and breathing section "
           "of the triage chart, and the links to Charts 3 and 4."),
    *X(971, 977),
    ABCD,
    *X(997, 1000),
    LI(1006, 1009),
    *X(1011, 1012),
    tbl(["", "Assess", "", "Treat"], [[
        "<strong>AB</strong><br>AIRWAY AND BREATHING",
        ul(["Not breathing", "Central cyanosis, or", "Severe respiratory distress"]) + "<p>If yes, is the breathing obstructed?</p>",
        "Any sign positive",
        ul(["Manage airway", "Give oxygen", "Make sure the child is warm"])]], TX(1013, 1014)),
    note(TX(1034, 1034), "Note"),
    flip("Module 2 objectives", [
        ("Assess", "Assessment of airway; assessment of breathing"),
        ("Manage the airway", "Management of the choking child; positioning of the child to open the airway; neck stabilisation; log roll"),
        ("Manage breathing", "Ventilation with bag and mask; giving oxygen"),
    ]),
]))
mark(979, 995); mark(1016, 1032)

L.append(lesson("Is the airway obstructed? The choking child",
    "Recognize a choking child and manage a choking infant with back slaps and chest thrusts.", [
    timing("Day 1, 10:45 (15 minutes): the facilitator demonstrates how to recognize a choking child, back slaps and chest thrusts in "
           "infants (on a doll), and back blows and the Heimlich manoeuvre in an older child (simulated on an adult volunteer)."),
    *X(1036, 1039, h=[1036, 1037]),
    *X(1045, 1053),
    *X(1055, 1056, h=[1055, 1056]),
    note(TX(1057, 1062), "Remember"),
    *X(1064, 1071),
    H(TX(1072, 1072)),
    steps("Choking infant: step by step", [(t, "") for t in items(1079, 1085)]),
    fig(2, f"{TX(1089, 1090)}: {TX(1087, 1087)} (left) and {TX(1094, 1094)} (right).", 14),
    video("Managing the choking infant and child", "Demonstration: back slaps, chest thrusts and the Heimlich manoeuvre.", "ET2.1"),
]))
mark(1087, 1094)

L.append(lesson("Managing the choking child",
    "Manage a choking child with back blows and the Heimlich manoeuvre, then check the mouth and breathing.", [
    H(TX(1098, 1098)),
    steps("Choking child: step by step", [(t, "") for t in items(1105, 1113)]),
    fig(3, f"{TX(1124, 1125)}: {TX(1115, 1117)} (left); {TX(1119, 1122)} (right).", 15),
    *X(1126, 1129),
    chart("03", 69, "Chart 3. How to manage a choking child."),
    sort("Infant or child? Which technique is used for whom?", ["Infant", "Child"], [
        ("Lay on your arm or thigh in a head down position, 5 blows to the back", "Infant"),
        ("5 chest thrusts with 2 fingers, one finger breadth below nipple level", "Infant"),
        ("5 blows to the back with the child sitting, kneeling or lying", "Child"),
        ("Heimlich manoeuvre: fist below the sternum, pull upwards into the abdomen, 5 times", "Child"),
    ]),
]))
mark(1115, 1125); skip(4200, 4240)

L.append(lesson("Positioning to open the airway",
    "Open the airway with the chin lift: nose up for an infant, chin up for an older child.", [
    timing("Day 1, 11:00 (20 minutes): the facilitator explains and demonstrates assessment and management of the airway: chin lift if "
           "no trauma (infants: neutral position; children: sniffing position), where to look for a foreign body, how to clear secretions "
           "(finger, finger wrapped in gauze, or a suction device), and letting a breathing child with no obstruction take the position of "
           "maximal comfort."),
    *X(1131, 1143, h=[1131]),
    fig(4, TX(1145, 1147), 15),
    *X(1153, 1159),
    fig(5, TX(1163, 1165), 16),
    q("You open the airway of a 6-month-old with no trauma. Which part points upwards?", ["The chin", "The nose", "The forehead"], 1,
      "Figure 4 shows the position for infants, the nose pointing upwards. Figure 5 shows the position for children, the chin pointing up."),
]))
mark(1145, 1147); mark(1163, 1165)

L.append(lesson("Is trauma of the neck a possibility?",
    "Check for head or neck trauma, open the airway with a jaw thrust, and stabilize the neck.", [
    timing("Day 1, 11:20 (20 minutes): the facilitator demonstrates how airway management differs with suspected head or neck trauma: jaw "
           "thrust without head tilt, stabilizing the cervical spine (IV fluid bottles or towels, tape), and the log roll."),
    H(TX(1161, 1161)),
    *X(1167, 1172),
    LI(1178, 1183),
    *X(1185, 1188),
    fig(6, TX(1190, 1191), 16),
    *X(1193, 1200),
    fig(7, TX(1205, 1206), 16),
    LI(1209, 1216),
    *X(1218, 1220),
    reveal("A boy fell from a tree and his breathing is noisy. How do you open his airway?",
           "Use a jaw thrust without head tilt: " + TX(1194, 1199)),
]))
mark(1190, 1191); mark(1205, 1206)

L.append(lesson("Log roll",
    "Move a child with a suspected neck injury with a log roll, keeping the neck in line with the body.", [
    *X(1221, 1234, h=[1221]),
    note(TX(1288, 1288), "Footnote 1"),
    fig(8, f"{TX(1245, 1246)}. {TX(1236, 1236)} (left) and {TX(1239, 1239)} (right).", 17),
    note(" ".join([TX(1237, 1238), TX(1241, 1243), TX(1248, 1249)]), "Practice"),
    video("Neck trauma: jaw thrust, stabilizing the neck and the log roll", "Demonstration with a doll and a volunteer.", "ET2.2"),
    chart("04", 70, "Chart 4. How to manage the airway in a child with obstructed breathing (or who has just stopped breathing)."),
]))
mark(1236, 1249); mark(1286, 1286); skip(4246, 4302)

L.append(lesson("Is the child breathing? Central cyanosis",
    "Look, listen and feel for breathing, and look for central cyanosis.", [
    *X(1251, 1254, h=[1251, 1252]),
    steps("Is the child breathing?", [(TX(1257, 1257), TX(1258, 1260)), (TX(1264, 1264), TX(1265, 1265)), (TX(1269, 1269), TX(1270, 1271))]),
    *X(1273, 1275),
    fig(9, TX(1277, 1278), 17),
    *X(1280, 1285, h=[1280]),
    q("Where do you look for central cyanosis?", ["At the fingers and toes", "At the mouth and tongue", "At the ears"], 1, TX(1284, 1285)),
]))
mark(1257, 1271); mark(1277, 1278)

L.append(lesson("Does the child have severe respiratory distress?",
    "Recognize severe respiratory distress, stridor and grunting.", [
    timing("Day 1, 14:00 (30 minutes): video sequences of cyanosis, severe respiratory distress, very fast breathing, severe lower chest "
           "wall indrawing, use of auxiliary muscles, stridor and grunting; discuss the signs and their relation to respiratory distress."),
    *X(1294, 1297, h=[1294]),
    note(TX(1298, 1299) + ": " + "; ".join(t.lstrip("- ") for t in [TX(1300, 1300), TX(1301, 1302), TX(1303, 1303), TX(1304, 1304), TX(1305, 1306)]),
         "Signs"),
    *X(1308, 1326, h=[1319]),
    video("Signs of severe respiratory distress", "Watch the signs: cyanosis, very fast breathing, chest indrawing, head nodding, stridor, grunting.", "ET2.3"),
    sort("Breathing in or breathing out?", ["Stridor", "Grunting"], [
        ("A harsh noise on breathing in", "Stridor"), ("A short noise when breathing out in young infants", "Grunting")]),
    q("The child is talking and drinking comfortably. Does he have severe respiratory distress?", ["Yes", "No"], 1, TX(1308, 1309)),
]))
mark(1298, 1306)

L.append(lesson("Ventilate with bag and mask",
    "Check a self-inflating bag, choose the right mask and ventilate a child who is not breathing.", [
    timing("Day 1, 11:40 (20 minutes): the facilitator demonstrates bag and mask ventilation on a resuscitation doll."),
    *X(1328, 1345, h=[1328, 1329]),
    fig(10, TX(1347, 1348), 18),
    fig(11, TX(1369, 1370) + ". " + " ".join(items(1361, 1367)), 19),
    fgnote("When to use a bag and mask: the child’s breathing is very shallow, or slow, or obstructed, or the child is not breathing. "
           "Oxygen flow should be 10 litres/minute, or as high as possible in a concentrator. If the chest does not rise and fall, look for: "
           "inappropriate head/jaw position; mouth is closed; insufficient pressure on bag; mucous, blood, foreign body in airway; poor seal "
           "between mouth and face. Stop after a few minutes and look to see if the child revives and starts to breathe spontaneously; if not "
           "breathing adequately, continue for 45 minutes or according to decision of clinician."),
    video("Ventilating with a bag and mask", "Demonstration on a resuscitation doll.", "ET2.4"),
    q("Which mask is the right size?", ["One that overlaps the chin", "One that covers the nose and mouth without covering the eyes or overlapping the chin",
                                         "One that leaves the nostrils uncovered"], 1, " ".join(items(1361, 1367))),
]))
mark(1347, 1348); mark(1354, 1370)

L.append(lesson("Insertion of an oropharyngeal (Guedel) airway",
    "Choose the right size of Guedel airway and insert it in an infant and in an older child.", [
    *X(1372, 1378, h=[1372]),
    fig(12, TX(1396, 1398), 19),
    fig(13, TX(1419, 1421), 19),
    steps(TX(1379, 1379), [(t, "") for t in items(1387, 1394)]),
    fig(14, TX(1423, 1425), 19),
    steps(TX(1400, 1400), [(t, "") for t in items(1409, 1417)]),
    fig(15, f"{TX(1435, 1436)}: {TX(1431, 1431)}, then {TX(1433, 1433)}.", 20),
    sort("Infant or older child?", ["Infant", "Older child"], [
        ("Insert the airway convex side up", "Infant"),
        ("Insert the airway “upside down” (concave side up) until the tip reaches the soft palate, then rotate through 180°", "Older child"),
    ]),
]))
mark(1379, 1379); mark(1396, 1400); mark(1419, 1436)

L.append(lesson("Give oxygen: sources of oxygen",
    "Explain why oxygen comes first and compare oxygen concentrators and cylinders.", [
    timing("Day 1, 14:30 (15 minutes): the facilitator shows an oxygen cylinder and a concentrator: the equipment for each, how to use "
           "one source for more than one child, assembling the equipment and checking that it works. There must be no smoking in the room "
           "when oxygen is being used."),
    *X(1438, 1448, h=[1438]),
    H(TX(1449, 1449)),
    fig(16, TX(1451, 1452), 20),
    fig(17, TX(1454, 1455), 20),
    *X(1459, 1461),
    R(ul([TX(1464, 1470), TX(1474, 1480)])),
    *X(1482, 1484),
    video("Oxygen: sources and delivery", "The oxygen video: concentrator, cylinder, nasal prongs and nasal catheter.", "ET2.5"),
    sort("Concentrator or cylinder?", ["Oxygen concentrator", "Oxygen cylinder"], [
        ("Needs a continuous electrical supply", "Oxygen concentrator"),
        ("Works even when there is no electrical supply", "Oxygen cylinder"),
        ("Once purchased, produces oxygen continuously at low cost", "Oxygen concentrator"),
        ("Oxygen relatively expensive; constant supply often difficult", "Oxygen cylinder"),
    ]),
]))
mark(1451, 1455)

CATHETER = join([lines(M, n, n)[0] for n in (1526, 1529, 1530, 1532, 1534, 1535, 1536, 1537, 1538, 1539)])
L.append(lesson("Oxygen delivery: nasal prongs and nasal catheter",
    "Place nasal prongs or a nasal catheter and set the right oxygen flow.", [
    timing("Day 1, 14:45 (15 minutes): the facilitator demonstrates nasal prongs and the nasal catheter on a doll: position, how far to "
           "insert the catheter, taping, and checking the flow rate."),
    *X(1488, 1498, h=[1488]),
    R(ul([TX(1509, 1522), CATHETER])),
    fig(18, f"{TX(1531, 1531)} {TX(1533, 1533)}. " + "; ".join(items(1500, 1505)), 21),
    fig(19, TX(1541, 1543), 21),
    fig(20, TX(1547, 1549), 21),
    chart("05", 71, "Chart 5. How to give oxygen."),
    fgnote("Proper flow rate for oxygen: 0.5-1 litres per minute for infants and 1-2 litres per minute for older children for nasal prongs "
           "or nasal catheter; 8-10 litres for bag/mask. If oxygen is not available, use room air, but oxygen is preferable."),
    flip("Nasal prongs or nasal catheter?", [
        ("Best for young infants and children with severe croup or pertussis", "Nasal prongs"),
        ("Size of tube for a nasal catheter", "6 or 8 FG"),
        ("How far to insert a nasal catheter", "From the child’s nostril to the inner eyebrow"),
        ("Flow rate", "0.5-1 litres/min in infants; 1-2 litres/min if older"),
    ]),
]))
mark(1500, 1505); mark(1526, 1549); skip(4306, 4324)

L.append(lesson("Practice and summary: airway and breathing",
    "Review the summary and the skills to practise for airway and breathing.", [
    timing("Day 1, 15:15 (90 minutes): group work. Participants practise all skills in small groups with short scenarios from the "
           "facilitators: triage for airways and breathing, management of the choking child, opening airways, opening airways in neck trauma "
           "and log roll, inserting an oropharyngeal airway, ventilating with bag and mask, and giving oxygen."),
    note(TX(1559, 1566), TX(1559, 1559).split("(")[0].strip() or "Practice"),
    fig(21, TX(1570, 1573), 22),
    R("<h3>" + TX(1568, 1568) + "</h3><p>" + TX(1575, 1575) + "</p>" + ul(items(1581, 1584)) + "<p>" + TX(1586, 1586) + "</p>"
      + ul(items(1591, 1593)) + "<p>" + TX(1595, 1595) + "</p>" + ul([TX(1600, 1601)])),
    reveal("Review practice: could you show these in front of others? Management of the choking child; opening airways; ventilation with "
           "bag and mask; positioning of the child with possible neck trauma.",
           "If not yet, practise them with your facilitator on a doll. Your facilitator initials each skill on your practical skills "
           "checklist: back slaps/chest thrusts, stabilize the cervical spine, correct head position (infants and children), ventilate with "
           "bag and mask, correct attachment of O2 tubes.", "Practice"),
]))
mark(1555, 1601)

AQ = _ex(equiz("sudan-etat-aq-airway-breathing", 21, "Assessment questions: Airway and breathing", [TX(1605, 1606)], [
    open_q("q1", TX(1607, 1607), ["Look, listen and feel (see page 17)."]),
    open_q("q2", TX(1609, 1609), ["Any of: Very fast breathing; Severe lower chest in drawing; Use of auxiliary muscles (head nod or head bob); Laboured breathing; Inability to feed because of respiratory problems; Child exhausted; Noises including stridor or grunting"]),
    mcq("q3", TX(1611, 1611), ["Inspiration", "Expiration"], 0, "Inspiration, on breathing in (see page 18)."),
    open_q("q4", TX(1613, 1614), ["An infant (<12 months) who has not been subjected to trauma should be positioned with the nose pointing upwards (towards the roof) when opening the airway (see page 15-16)."]),
    open_q("q5", TX(1616, 1616), ["You should use size 6-8 F gauge for a nasal catheter (see page 21)."]),
    open_q("q6", TX(1628, 1628), ["Oxygen flow (volume/time) should be started at 0.5-1 litres per minute in infants and 1-2 litres per minute in children (see page 20)."]),
    open_q("q7", TX(1630, 1632), ["Airway and breathing are normal, so next assess the circulation."]),
    open_q("q8", TX(1634, 1635), ["This child is at risk of neck trauma so stabilize the neck (see chart 5).", "Manage the airway (see chart 4).",
        "Inspect the mouth and remove foreign body if present", "Clear the secretions", "Check the airway (look listen and feel)",
        "Manage the airway (jaw thrust)", "Insert oropharyngeal airway if the child will accept this",
        "Give oxygen or if child not breathing well give bag and mask ventilation", "Keep child warm", "When airway and breathing stable, check circulation"]),
    open_q("q9", TX(1637, 1639), ["The baby is choking, on assessment of airway you note her breathing is obstructed. You need to manage the choking infant by:",
        "laying the infant on your arm or thigh on her front in a head down position and giving 5 back blows with the heel of your hand",
        "If this is unsuccessful, turn the infant over and give 5 chest thrusts", "check the mouth, if not successful for removable foreign body",
        "repeat sequence if not successful"]),
    open_q("q10", TX(1641, 1644), ["Assess the child’s airway and breathing, check for cyanosis and obstruction. This child has severe respiratory distress. He needs to go to the emergency area and the airway should be managed, ensure there is no foreign body aspiration (on history), position the child to improve the airway, clear secretions, and give oxygen (via nasal prongs or nasal catheter), make sure the child is warm."]),
], minutes=20, source="WHO ETAT manual for participants (2005), assessment questions; answers: ETAT facilitator guide Annex 5"))
L.append(lesson("Assessment questions: Airway and breathing",
    "Answer the assessment questions on airway and breathing, then compare with the model answers.", [
    timing("Day 1, 16:45 (15 minutes): the facilitator summarises airway and breathing and gives the assignments: reading on all “C” signs, "
           "and the self-assessment questions on triage, A and B (answers discussed on Day 2 at 08:00)."),
    H(TX(1622, 1622)),
    AQ,
]))
mark(1605, 1644)

MODULE = module("Module 2: Airway and breathing", 2, L)
