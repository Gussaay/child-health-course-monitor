# Module 3 of the Sudan ETAT course: Circulation.
# Facilitator guide, Day 2 08:00-12:45: answers to the triage, A and B questions, oral
# drill on triage (Drill 2), clinical session, module objectives, summary of
# circulation (Tables 3 and 4, Charts 7 and 8), Exercise A on severe malnutrition,
# demonstration of IV line, rapid fluids for shock and intraosseous line, group work,
# wind-up. Annex 1 (practical procedures: vascular access) is read here.
from elib import *

EXERCISES = []
def _ex(e):
    EXERCISES.append(e); return ex(e["id"], e["title"].replace("Sudan ETAT: ", ""))

def photo(n, caption):
    """Photograph n of the IMCI photograph booklet, already in Storage for Protocol management (online-courses/imnci-photos)."""
    return {"type": "image", "path": f"imnci-photos/photo-{n:02d}.jpg", "caption": caption}

mark(1650, 1652)   # module title

L = []
L.append(lesson("Review and Drill 2: flow of triage assessment",
    "Say quickly what to assess next at each finding, from breathing to consciousness.", [
    timing("Day 2, 08:00: revise the assessment questions for triage, airway and breathing (15 minutes), then the oral drill on triage "
           "(Drill 2, 15 minutes), then a clinical session in the outpatient department and on the inpatient ward to practise the flow of "
           "triage (08:30 to 10:00)."),
    story("Drill 2: oral drill on flow of triage assessment", [
        stage("You assess breathing: breathing is adequate.", "What should you do next?", ["Assess circulation", "Ask for diarrhoea", "Give oxygen"], 0, "Assess circulation."),
        stage("You assess circulation: warm hand.", "What should you do next?", ["Assess capillary refill", "Assess consciousness", "Check pulse"], 1, "Assess consciousness."),
        stage("You assess circulation: cold hand.", "What should you do next?", ["Assess capillary refill", "Assess consciousness", "Ask for diarrhoea"], 0, "Assess capillary refill."),
        stage("You assess circulation: capillary refill is quick.", "What should you do next?", ["Check pulse", "Assess consciousness", "Treat for shock"], 1, "Assess consciousness."),
        stage("You assess circulation: weak and fast pulse.", "What should you do next?", ["Assess consciousness", "Ask for diarrhoea", "Child waits in queue"], 0,
              "Assess consciousness (Drill 2’s answer: quickly also check consciousness, then treat for shock)."),
        stage("You assess consciousness: alert, not convulsing.", "What should you do next?", ["Ask for diarrhoea", "Give diazepam", "Check blood sugar"], 0, "Ask for diarrhoea."),
        stage("You assess consciousness: the child is convulsing.", "What should you do next?",
              ["Ask for diarrhoea", "Check for head or neck trauma, then treat for convulsions, then quickly continue assessment", "Child waits in queue"], 1,
              "Check for head or neck trauma, and then treat for convulsions, and then quickly continue assessment."),
        stage("You assess consciousness: lethargy (no other neurological signs present).", "What should you do next?",
              ["Assess for diarrhoea and severe dehydration", "Give diazepam", "Return to the queue"], 0, "Assess for diarrhoea and severe dehydration."),
    ]),
    fgnote("Clinical practice: as children arrive in the emergency room, each participant in turn assesses a child, speaking aloud the "
           "findings and the treatments needed, while the others watch. Mark on your checklist each clinical sign you see."),
]))

L.append(lesson("Circulation: what to assess",
    "List the circulation signs of shock and the emergency treatments in Table 2.", [
    timing("Day 2, 10:15: module 3 objectives (5 minutes) and summary of circulation (15 minutes), using Charts 7 and 8 and Tables 3 and 4."),
    *X(1654, 1657),
    tbl([], [["<strong>A</strong>", "Airway"], ["<strong>B</strong>", "Breathing"], ["<strong>C</strong>", "Circulation<br>Coma<br>Convulsion"],
             ["<strong>D</strong>", "Dehydration (severe)"]]),
    *X(1676, 1678),
    *X(1685, 1693),
    tbl(["", "Assess", "", "Treat"], [[
        "<strong>C1</strong><br>CIRCULATION",
        "Cold hand with:" + ul(["Capillary refill longer than 3 seconds, and", "Weak and fast pulse"]),
        "Any sign positive<br><br>Check for severe malnutrition",
        ul(["Stop any bleeding", "Give oxygen", "Make sure the child is warm"])
        + "<p><strong>IF NO SEVERE MALNUTRITION:</strong></p>" + ul(["Insert IV and begin giving fluids rapidly.", "If not able to insert peripheral IV, insert an external jugular or intraosseous line."])
        + "<p><strong>IF SEVERE MALNUTRITION:</strong></p>" + ul(["Give IV glucose", "Proceed immediately to full assessment and treatment"])]],
        TX(1695, 1696)),
    note(TX(1728, 1728), "Note"),
    flip("Module 3 objectives", [
        ("Assess", "Assess circulation in a child at the OPD or emergency room; list the signs of a shocked child"),
        ("Treat", "Treat a shocked child with appropriate fluids and volume"),
        ("Access", "Explain where and how to achieve IV access; insert an intraosseous needle on a model"),
    ]),
]))
mark(1663, 1674); mark(1680, 1683); mark(1698, 1726)

L.append(lesson("Are the child’s hands warm? Capillary refill",
    "Feel the hands and measure capillary refill time.", [
    *X(1734, 1740, h=[1734]),
    *X(1746, 1754, h=[1746]),
    H(TX(1756, 1756)),
    *X(1760, 1772),
    fig(22, f"{TX(1791, 1792)}. {TX(1776, 1777)}. {TX(1778, 1779)}.", 26),
    *X(1781, 1789),
    note(TX(1798, 1799), "Footnote 1"),
    video("Checking circulation: warm hands, capillary refill and pulses", "How to feel the hands, check capillary refill and find the pulses.", "ET3.1"),
    q("What is a normal capillary refill time?", ["Less than 3 seconds", "Less than 5 seconds", "Less than 7 seconds"], 0, TX(1763, 1765)),
]))
mark(1758, 1758); mark(1774, 1779); mark(1791, 1794)

L.append(lesson("Is the pulse weak and fast?",
    "Find the radial pulse, and a central pulse (brachial, femoral or carotid) when it is difficult to find.", [
    *X(1803, 1819, h=[1803]),
    fig(23, TX(1821, 1822), 27),
    *X(1824, 1828),
    note(TX(1843, 1853), "Remember"),
    q("You cannot feel the radial pulse in a 4-year-old. Which pulse do you feel next?", ["Brachial", "Carotid", "Popliteal"], 1, TX(1810, 1812)),
    q("In an infant (less than one year), where is the best place to feel for a central pulse?", ["The middle of the upper arm (brachial)", "The neck (carotid)", "The wrist"], 0, TX(1806, 1809)),
]))
mark(1821, 1822); mark(1843, 1853)

L.append(lesson("Shock and the first actions",
    "Explain why shock needs fluid quickly, and start the first actions as a team.", [
    *X(1830, 1841, h=[1830]),
    *X(1855, 1859, h=[1855]),
    steps("Start these actions at the same time", [(t, "") for t in items(1862, 1890)]),
    *X(1891, 1905, h=[1891, 1894, 1897, 1900, 1905]),
    fig(24, TX(1907, 1908), 28),
    note(TX(1910, 1912), "Remember"),
    q("What is the best and safest way to stop bleeding?", ["A tourniquet", "Firm and direct pressure to the point that is bleeding", "Raise the legs"], 1, TX(1892, 1893)),
]))
mark(1907, 1912)

L.append(lesson("Check for severe malnutrition",
    "Look for visible severe wasting and oedema of both feet before you give IV fluid.", [
    *X(1914, 1928),
    *X(1932, 1940, h=[1932]),
    fig(25, TX(1978, 1979), 29),
    *X(1946, 1956, h=[1946]),
    fig(26, f"{TX(1996, 1997)}. {TX(1993, 1994)}.", 29),
    *X(1958, 1976),
    *X(1981, 1991),
    sort("Why is a severely malnourished child treated differently?", ["True", "False"], [
        ("The heart can become very weak and may fail if it has to pump large volumes of fluid", "True"),
        ("The signs of dehydration overestimate the degree of dehydration", "True"),
        ("Rapid IV infusion of fluids is the safest treatment", "False", "A child who is severely malnourished should not be treated by rapid IV infusion of fluids."),
        ("Shock signs may be due to sepsis rather than hypovolemia", "True"),
    ]),
]))
mark(1978, 1979); mark(1993, 1997)

L.append(lesson("Exercise A: severe malnutrition",
    "Look at each photograph and decide whether the child has visible severe wasting or oedema of both feet.", [
    timing("Day 2 (10 minutes): Exercise A on severe malnutrition, with the IMCI photograph booklet. Look at each child, write your answers, "
           "and discuss them after all the photographs have been reviewed. Photographs 47 to 50 are examples to discuss visible severe "
           "wasting and oedema."),
    fgnote("Read through the sections “Look for visible severe wasting” and “Check for oedema of both feet” and then be ready to do the "
           "exercise. For each photograph, answer the question."),
    photo(47, "Photograph 47: visible severe wasting (example)."),
    photo(48, "Photograph 48: visible severe wasting (example)."),
    photo(49, "Photograph 49: visible severe wasting (example)."),
    photo(50, "Photograph 50: oedema of both feet (example)."),
    H("Does the child have visible severe wasting? Yes or No"),
    *[photo(n, f"Photograph {n}") for n in range(51, 59)],
    H("Does the child have oedema? Yes or No"),
    photo(59, "Photograph 59"),
    reveal("Write Yes or No for photographs 51 to 58 (visible severe wasting) and 59 (oedema). Then open this card.",
           "Your facilitator discusses the answers after all the photographs have been reviewed. Compare each child with the signs: the "
           "marasmic child appears to be all skin and bone, the skin looks too large for the body, there is no fat and you see the outlines "
           "of the ribs; oedema is present if a definite dent is left after you press the top of both feet.", "Exercise A"),
]))

L.append(lesson("Treatment of shock: Table 3",
    "Give fluids for shock in a child without severe malnutrition and in a child with severe malnutrition.", [
    timing("Day 2 (20 minutes): demonstration on management of shock: inserting an IV line, taking blood for emergency laboratory "
           "investigations, giving fluids rapidly (20 ml/kg as rapidly as possible; if severely malnourished, 15 ml/kg over 1 hour), and "
           "inserting an intraosseous line."),
    H(TX(2003, 2004)),
    steps(f"{TX(2005, 2005)} ({TX(2006, 2006)})", [
        ("Insert an intravenous line", TX(2007, 2008) + " " + TX(2009, 2010)),
        ("Infuse", TX(2011, 2011) + " " + TX(2012, 2012) + " " + TX(2013, 2014)),
        ("Improvement", TX(2017, 2018)),
        (TX(2019, 2019), TX(2020, 2021) + " " + TX(2022, 2023) + " " + TX(2024, 2026)),
        (TX(2027, 2027), TX(2030, 2033)),
        (TX(2035, 2035), TX(2038, 2039)),
    ]),
    steps(f"{TX(2043, 2043)} ({TX(2044, 2044)})", [
        ("Avoid IV", TX(2045, 2046) + " " + TX(2047, 2047)),
        ("Insert an intravenous line", TX(2048, 2049) + " " + TX(2050, 2051)),
        ("ReSoMal", " ".join([TX(2052, 2052), TX(2053, 2053), TX(2054, 2054), TX(2055, 2057)])),
        ("Monitor", TX(2058, 2059) + " " + TX(2060, 2062)),
        (TX(2065, 2066), TX(2067, 2067) + " " + TX(2068, 2069)),
        (TX(2070, 2071), TX(2072, 2073) + " " + TX(2074, 2076)),
    ]),
    fgnote("To know when the desired amount has been infused from a bottle, put tape on the bottle at the level where the desired amount "
           "will have been given. To see if the child has improved, check the same signs (cold hand, capillary refill, weak and fast pulse) "
           "and also lethargy/consciousness."),
    chart("07", 73, "Chart 7. How to give IV fluids rapidly for shock in a child without severe malnutrition."),
    chart("08", 74, "Chart 8. How to give IV fluids for shock in a child with severe malnutrition."),
    q("A well-nourished one-year-old weighing 11 kg is in shock. How much Ringer’s lactate do you give first?", ["110 ml", "220 ml", "330 ml"], 1,
      "Infuse 20 ml/kg as rapidly as possible: 11 kg x 20 ml/kg = 220 ml."),
]))
mark(2003, 2076); skip(4351, 4489)

L.append(lesson("Maintenance fluids and summary: circulation",
    "Choose maintenance fluids after shock improves, and review the circulation summary.", [
    tbl([TX(2083, 2083), TX(2087, 2088)], [[
        TX(2085, 2085) + "<p>" + TX(2090, 2091) + " " + ul([TX(2096, 2097), TX(2098, 2099)]) + "</p><p>" + TX(2109, 2111) + "</p><p>"
        + TX(2112, 2114) + "</p>" + ul([TX(2115, 2115), TX(2116, 2116)]) + "<p>" + TX(2119, 2121) + "</p>",
        TX(2093, 2094) + "<p>" + TX(2101, 2105) + "</p>"]], TX(2081, 2082)),
    R("<h3>" + TX(2131, 2131) + "</h3><p><strong>" + TX(2133, 2133) + "</strong></p>" + ul(items(2127, 2129)) + "<p>" + TX(2135, 2135)
      + "</p><p><strong>" + TX(2136, 2136) + "</strong></p>"
      + tbl([TX(2137, 2137), TX(2148, 2148)], [[ul(items(2143, 2146)), ul(items(2155, 2162))]])["text"]),
    sort("Which child? Well nourished or severely malnourished", ["NO severe malnutrition", "HAS severe malnutrition"], [
        ("Give IV fluids rapidly", "NO severe malnutrition"),
        ("Assess if child can drink oral or NGT fluids", "HAS severe malnutrition"),
        ("Give 70 ml/kg of Ringer’s lactate over 5 hours (infants) or 2½ hours (children)", "NO severe malnutrition"),
        ("Continue ReSoMal 5-10 ml/kg/hour for the next 4-10 hours", "HAS severe malnutrition"),
    ]),
]))
mark(2081, 2162)

L.append(lesson("Annex 1: vascular access, peripheral and scalp veins",
    "Choose a site for IV access and insert and secure a cannula in a peripheral or scalp vein.", [
    timing("Day 2, 11:05 (90 minutes): group work. Each group practises inserting an IV line, giving fluids rapidly for shock, and inserting "
           "an intraosseous line on a chicken thigh bone. The facilitator does not demonstrate but observes each participant and corrects mistakes."),
    H(TX(3576, 3576)), H(TX(3578, 3578)),
    *X(3579, 3585, h=[3579]),
    fig(33, TX(3611, 3612) + ": " + "; ".join(items(3581, 3581) + items(3589, 3594) + items(3600, 3600)), 59),
    *X(3587, 3587, h=[3587]),
    R(ul([TX(3596, 3599), TX(3605, 3609), TX(3614, 3620)])),
    fig(34, TX(3622, 3623), 59),
    *X(3629, 3633, h=[3629]),
    R(ul([TX(3636, 3638), TX(3642, 3651), TX(3655, 3661)])),
    fig(35, TX(3663, 3664), 60),
    *X(3666, 3672, h=[3666]),
    video("Inserting an IV line and giving fluids rapidly for shock", "Demonstration on a doll, with blood for emergency laboratory tests.", "ET3.2"),
    q("In young children aged over 2 months, which veins are usually used for a peripheral IV?",
      ["The cephalic vein in the antecubital fossa or the fourth interdigital vein on the back of the hand", "The femoral vein", "The external jugular vein only"], 0,
      TX(3596, 3599)),
]))
mark(3574, 3574); mark(3581, 3581); mark(3589, 3594); mark(3600, 3600); mark(3611, 3612); mark(3622, 3623); mark(3663, 3664)

L.append(lesson("Annex 1: external jugular and intraosseous infusion",
    "Insert an intraosseous needle in the proximal tibia, confirm it and watch for complications.", [
    *X(3674, 3674, h=[3674]),
    P_(TX(3683, 3689)),
    fig(36, TX(3677, 3679), 60),
    *X(3693, 3705, h=[3693]),
    LI(3709, 3711),
    fig(37, TX(3713, 3715), 61),
    *X(3717, 3721),
    steps("Intraosseous needle insertion", [
        (TX(3724, 3724), " ".join(items(3725, 3733))),
        (TX(3737, 3737), " ".join(items(3738, 3740))),
        ("Insert", " ".join(items(3744, 3756))),
        ("Confirm and start", " ".join(items(3775, 3779))),
    ]),
    note(TX(3781, 3784), "Note"),
    LI(3791, 3798),
    *X(3800, 3802),
    tbl(["Complication", "Signs", "Action"], [
        [TX(3805, 3805), TX(3806, 3806).split(":", 1)[1].strip(), TX(3807, 3807).split(":", 1)[1].strip()],
        [TX(3811, 3811), TX(3812, 3812).split(":", 1)[1].strip(), TX(3813, 3813).split(":", 1)[1].strip()],
        [TX(3817, 3817), TX(3818, 3818).split(":", 1)[1].strip(), TX(3819, 3819).split(":", 1)[1].strip()],
        [TX(3823, 3823), TX(3824, 3825).split(":", 1)[1].strip(), TX(3826, 3828).split(":", 1)[1].strip()],
        [TX(3832, 3834), "", TX(3835, 3835).split(":", 1)[1].strip()],
    ]),
    *X(3837, 3843, h=[3837]),
    video("Inserting an intraosseous needle", "Demonstration on a chicken thigh bone.", "ET3.3"),
    q("What are two contra-indications for an intraosseous infusion?", ["Infection at the puncture site and fracture of the bone",
      "Age under one year and fever", "Shock and dehydration"], 0, TX(3709, 3711)),
]))
mark(3677, 3679); mark(3713, 3715); mark(3724, 3779); mark(3803, 3835)

AQ = _ex(equiz("sudan-etat-aq-circulation", 31, "Assessment questions: Circulation", [TX(2171, 2172)], [
    open_q("q1", TX(2173, 2173), ["The capillary refill time should be less than 3 seconds (see page 25)."]),
    open_q("q2", TX(2175, 2175), ["If you cannot feel the radial pulse in an older child, you should look for the carotid pulse (see page 25-26)."]),
    open_q("q3", TX(2177, 2177), ["The two types of fluid you can give to treat shock initially are Ringer’s lactate or normal saline."]),
    open_q("q4", TX(2179, 2179), ["The fluids you would give to a child in shock with signs of severe malnutrition are: preferably Ringer’s lactate or half-normal saline or half-strength Darrow’s solution with 5% glucose (dextrose) (see chart 7)."]),
    open_q("q5", TX(2181, 2181), ["The volume of fluid you would give to a well-nourished one-year-old weighing 11kg who is in shock is 11kg x 20 ml/kg, i.e. 220 ml."]),
    open_q("q6", TX(2189, 2189), ["You can give this bolus of fluid to the child in shock not more than three times before calling in a senior health worker."]),
    open_q("q7", TX(2191, 2191), ["If, during triage of a 2-year-old girl, her hands are found to be warm, you will next assess her consciousness."]),
    open_q("q8", TX(2193, 2193), ["If, during triage of a well-fed 18-month-old boy, his hands are found to be cold, you will next check the capillary refill time."]),
    open_q("q9", TX(2195, 2197), ["This child is in shock and should be taken immediately to the emergency room and treated. An IV should be inserted then blood taken and he should be given 20ml/kg of IV fluids. He should next be assessed for coma and convulsion."]),
    open_q("q10", TX(2199, 2199), ["Two contra-indications for setting up an intraosseous infusion are: infection at the puncture site and fracture of the bone (not absolute)."]),
    open_q("q11", TX(2207, 2207), ["All fluids discussed in this course (including blood) can be given through an intraosseous infusion. All drugs used in emergencies that can be given IV, including antibiotics, may also be given by this route."]),
    open_q("q12", TX(2209, 2212), ["Based on the ABCD steps, the baby does not have severe respiratory distress, however she is in shock. She should be treated with normal saline IV 20 ml/kg fast and reassessed."]),
], minutes=20, source="WHO ETAT manual for participants (2005), assessment questions; answers: ETAT facilitator guide Annex 5"))
L.append(lesson("Assessment questions: Circulation",
    "Answer the assessment questions on circulation, then compare with the model answers.", [
    timing("Day 2, 12:35 (10 minutes): wind-up: summary of the circulation section and the assignment on the circulation questions (to be "
           "completed over lunch if time allows; answers discussed at 14:00)."),
    H(TX(2170, 2170)),
    AQ,
]))
mark(2166, 2212)

MODULE = module("Module 3: Circulation", 3, L)
