# Module 4 of the Sudan ETAT course: Coma and convulsion.
# Facilitator guide, Day 2 14:00-17:00: review of the circulation questions, objectives,
# summary of coma and convulsion, Exercise B (AVPU video), demonstrations (rectal diazepam,
# IV glucose, NG tube, drawing up doses), tea, group work with Drill 3, wind-up.
# The nasogastric tube (manual Annex 1) is placed here, as the facilitator guide teaches it
# with IV glucose.
from elib import *

EXERCISES = []
def _ex(e):
    EXERCISES.append(e); return ex(e["id"], e["title"].replace("Sudan ETAT: ", ""))

mark(2218, 2220)   # module title page

ABCD = tbl([], [[f"<strong>{TX(2225, 2225)}</strong>", TX(2227, 2227)], [f"<strong>{TX(2229, 2229)}</strong>", TX(2231, 2231)],
                [f"<strong>{TX(2236, 2236)}</strong>", f"{TX(2238, 2238)}<br><strong>{TX(2239, 2239)}</strong><br><strong>{TX(2240, 2240)}</strong>"
                 f"<p>{TX(2242, 2242)}</p>"],
                [f"<strong>{TX(2244, 2244)}</strong>", TX(2246, 2246)]])
mark(2225, 2246)

L = []
L.append(lesson("Coma and convulsion: what to assess",
    "Name the two questions for the neurological status and the emergency treatments in Table 5.", [
    timing("Day 2, 14:00 (5 minutes): review of the assessment questions on circulation; compare your answers with the model answers. "
           "Then (5 minutes) the objectives of Module 4, and (15 minutes) a summary of coma and convulsion with ETAT Charts 6, 9 and 10."),
    *X(2222, 2223),
    ABCD,
    *X(2233, 2234),
    Pp(TX(2248, 2248)),
    LI(2251, 2252),
    note(join([TX(2249, 2249), TX(2257, 2261)]), "Remember"),
    tbl([TX(2266, 2266), "", "", ""], [[
        TX(2271, 2272), f"{TX(2274, 2274)}<br>{TX(2276, 2276)}<br>{TX(2277, 2277)}", TX(2279, 2280), ul(items(2282, 2289))]],
        TX(2263, 2264)),
    flip("Module 4 objectives", [
        ("Assess", "Assess consciousness using the AVPU coma score"),
        ("Identify", "Identify the child in coma; identify the child having convulsions"),
        ("Treat", "Treat the child with coma and convulsions"),
        ("Glucose", "Explain the importance of measuring glucose"),
    ]),
    q("A child is convulsing in front of you. Which of these is NOT one of the emergency treatments in Table 5?",
      ["Manage the airway", "Give IV glucose", "Give a bolus of 20 ml/kg Ringer’s lactate"], 2,
      "Table 5: manage the airway, give oxygen, give diazepam rectally if convulsing, position the child and give IV glucose."),
]))
mark(2263, 2289)

L.append(lesson("Is the child in coma? The AVPU scale",
    "Wake the child step by step and give an AVPU score.", [
    H(TX(2291, 2291)),
    Pp(TX(2292, 2306)),
    tbl([], [[f"<strong>{TX(2307, 2307)}</strong>", TX(2312, 2312)], [f"<strong>{TX(2308, 2308)}</strong>", TX(2313, 2313)],
             [f"<strong>{TX(2309, 2309)}</strong>", TX(2314, 2314)], [f"<strong>{TX(2310, 2310)}</strong>", TX(2315, 2316)]]),
    *X(2318, 2326),
    steps("Waking the child: step by step", [
        ("Talk", "Try to wake the child by talking to him/her, e.g. call his/her name loudly."),
        ("Shake gently", "A little shake to the arm or leg should be enough to wake a sleeping child. Do not move the child’s neck."),
        ("Pain", "Apply a firm squeeze to the nail bed, enough to cause some pain."),
        ("Score", "Alert, Voice, Pain or Unresponsive. A score of P or U receives emergency treatment for coma."),
    ]),
    timing("Day 2 (15 minutes): Exercise B, video exercise on the AVPU coma score."),
    fgnote("The video uses the term “unconscious”: this is coma. After the examples, the sound is turned off and you decide for each of "
           "4 children whether the child is lethargic or unconscious (coma). Your facilitator discusses each child so that it is clear "
           "which children are lethargic and which are in coma."),
    video("Exercise B: the AVPU coma score", "Watch the examples, then decide for each child: lethargic or unconscious (coma)?", "ET4.1"),
    sort("Give the AVPU score", ["A", "V", "P", "U"], [
        ("Playing and talking with the mother", "A"),
        ("Asleep, does not wake to a gentle shake, but opens the eyes and cries when the nail bed is squeezed", "P"),
        ("Not alert, but opens the eyes when the name is called loudly", "V"),
        ("Does not respond to voice, to being shaken, or to pain", "U"),
    ], "A child who is not alert but responds to voice is lethargic. A child with a score of P or U receives emergency treatment for coma."),
]))
mark(2307, 2316)

L.append(lesson("Is the child convulsing now?",
    "Recognize a convulsion, including the subtle signs in an infant.", [
    *X(2328, 2340, h=[2328]),
    q("A mother says her child had a fit at home this morning. At triage the child is alert. Does the child need emergency treatment for convulsions?",
      ["Yes, give rectal diazepam now", "No: a complete clinical history and investigation, but no emergency treatment for convulsions"], 1,
      TX(2329, 2332)),
    q("Which signs can be the only signs of a convulsion in an infant?", ["Twitching and abnormal movements of the eyes, hands or feet",
      "Fast breathing", "A high fever"], 0, TX(2338, 2340)),
]))

L.append(lesson("Treatment: manage the airway and position the child",
    "Manage the airway and position the child who is unconscious or convulsing.", [
    *X(2342, 2343, h=[2342]),
    tbl([TX(2344, 2344), TX(2346, 2346)], [[TX(2348, 2348), TX(2350, 2350)], [ul(items(2360, 2364)), ul(items(2372, 2376))]]),
    *X(2380, 2388, h=[2380, 2381, 2385]),
    *X(2390, 2396, h=[2390, 2391]),
    Pp(TX(2397, 2397)), LI(2402, 2406),
    Pp(TX(2408, 2408)), LI(2416, 2418),
    fig(27, TX(2412, 2414), 37),
    *X(2420, 2424, h=[2420]),
    chart("06", 72, "Chart 6. How to position the unconscious child."),
    sort("Do or don’t, for a child who is convulsing now?", ["Do", "Don’t"], [
        ("Hold the child down", "Don’t"),
        ("Put something in the mouth to keep it open", "Don’t"),
        ("Turn the child on the side if the child vomits", "Do"),
        ("Place in the recovery position when the convulsion has stopped and the airway is clear", "Do"),
    ]),
]))
mark(2344, 2376); mark(2402, 2418); skip(4330, 4345)

L.append(lesson("Check the blood sugar",
    "Check the blood glucose with a glucose stick and know when it is low.", [
    timing("Day 2, 14:40 (30 minutes): demonstration on coma and convulsion: giving rectal diazepam, giving IV glucose (with the blood "
           "glucose test and the nasogastric tube), and drawing up the correct dose rapidly."),
    *X(2426, 2427, h=[2426, 2427]),
    *X(2431, 2434),
    note(join([TX(2429, 2429), TX(2436, 2436), TX(2443, 2448)]), "Remember"),
    *X(2438, 2441),
    fig(28, TX(2454, 2456), 38),
    *X(2458, 2472),
    fig(29, TX(2475, 2477), 38),
    fig(30, TX(2504, 2506), 38),
    q("What is the cut-off for low blood glucose in a well-nourished child?", ["<2.5 mmol/l (45 mg/dl)", "<5 mmol/l (90 mg/dl)", "<1 mmol/l"], 0,
      TX(2432, 2434)),
    reveal("The blood glucose cannot be measured in your department today. A child is convulsing. What do you do?",
           join([TX(2436, 2436), TX(2443, 2448)]) + ".", "Think about it"),
]))
mark(2454, 2456); mark(2475, 2477); mark(2504, 2506)

L.append(lesson("Give IV glucose: Table 6",
    "Give 5 ml/kg of 10% glucose, make 10% glucose from 50% glucose, and feed the child.", [
    H(TX(2474, 2474)), H(TX(2479, 2479)),
    LI(2486, 2493),
    Pp(TX(2495, 2495)), LI(2499, 2500),
    *X(2502, 2503),
    *X(2508, 2510),
    tbl([TX(2515, 2515), TX(2517, 2519), TX(2522, 2522), TX(2524, 2524)],
        [[TX(a, a), TX(b, b), TX(c, c), TX(d, d)] for a, b, c, d in
         [(2526, 2528, 2530, 2532), (2534, 2536, 2538, 2540), (2542, 2544, 2546, 2548), (2550, 2552, 2554, 2556), (2558, 2560, 2562, 2564)]],
        f"{TX(2512, 2512)}. {TX(2513, 2513)} ({TX(2521, 2521)})"),
    *X(2570, 2574),
    chart("10", 76, "Chart 10. How to give IV glucose."),
    video("Giving IV glucose", "Demonstration: checking the blood glucose, making 10% glucose and giving 5 ml/kg.", "ET4.2"),
    q("How much 10% glucose do you give to a six-month-old weighing 8 kg with a low blood sugar?", ["8 ml", "40 ml", "160 ml"], 1,
      "5 ml/kg x 8 kg = 40 ml."),
    q("You only have 50% glucose. How do you make 10% glucose?", ["1 part 50% glucose to 4 parts sterile water",
      "1 part 50% glucose to 1 part sterile water", "1 part 50% glucose to 9 parts sterile water"], 0, TX(2571, 2572)),
]))
mark(2512, 2564); skip(4574, 4627)

L.append(lesson("Annex 1: inserting a nasogastric tube",
    "Measure, insert and check a nasogastric tube to give glucose or feeds.", [
    *X(3849, 3859, h=[3849]),
    fig(38, TX(3861, 3864), 63),
    *X(3866, 3886),
    *X(3892, 3895),
    steps("Nasogastric tube: step by step", [
        ("Measure", "Nose to ear lobe, then to the xiphisternum (epigastrium). Mark the tube."),
        ("Insert", "Hold the child firmly, lubricate the tip with water, pass it slowly into one nostril to the mark, fix with tape."),
        ("Check", "Aspirate stomach contents (blue litmus turns pink), or inject air and listen over the abdomen."),
        ("Feed", "Fix a 20 ml syringe without the plunger and let food or fluid flow by gravity."),
    ]),
    q("While you pass the tube, the infant becomes distressed and cyanosed. What do you do?",
      ["Push the tube further", "Remove the tube immediately and try again after the child has recovered", "Inject air down the tube"], 1,
      TX(3874, 3877)),
]))
mark(3861, 3864)

L.append(lesson("Give an anticonvulsant: diazepam",
    "Give the correct dose of rectal diazepam, and know what to do if the convulsion continues.", [
    *X(2576, 2587, h=[2576, 2577]),
    tbl([TX(2626, 2626), f"{TX(2590, 2591)}<br>{TX(2592, 2592)}", f"{TX(2594, 2594)}<br>{TX(2628, 2628)}"],
        [[TX(a, a), TX(b, b), TX(c, c)] for a, b, c in
         [(2596, 2598, 2600), (2602, 2604, 2606), (2608, 2610, 2612), (2614, 2616, 2618), (2620, 2622, 2624)]],
        f"{TX(2588, 2588)}. {TX(2589, 2589)}"),
    *X(2630, 2642),
    note(TX(2654, 2654), "Footnote"),
    note(TX(2644, 2647), "Remember"),
    *X(2649, 2650),
    fgnote("Do not give rectal diazepam to an infant less than 1 month of age. Wait 10 minutes before another dose. Three doses is the "
           "maximum; paraldehyde is used as the third dose, after two doses of diazepam, because there is less danger of respiratory depression. "
           "Through an IV line the dose is 0.25 mg/kg, given slowly over 1 minute."),
    chart("09", 75, "Chart 9. How to give diazepam (or paraldehyde) rectally."),
    video("Giving rectal diazepam", "Demonstration on a doll: drawing up the dose and giving it rectally.", "ET4.3"),
    steps("Rectal diazepam: step by step", [
        ("Dose", "0.5 mg/kg = 0.1 ml/kg of the 10 mg/2 ml solution (Table 7)."),
        ("Draw up", "Draw up the dose into a tuberculin (1 ml) syringe. Then remove the needle."),
        ("Insert", "Insert the syringe 4 to 5 cm into the rectum and inject. Hold the buttocks together for a few minutes."),
        ("Reassess", "Reassess after 10 minutes. If still convulsing, give a second dose or paraldehyde. Watch the breathing."),
    ]),
    q("A four-year-old weighing 15 kg is convulsing. How much rectal diazepam (10 mg/2 ml) do you give?", ["0.75 ml", "1.5 ml", "3 ml"], 1,
      "0.1 ml/kg x 15 kg = 1.5 ml (7.5 mg). Wait 10 minutes before a second dose if the convulsion does not stop."),
]))
mark(2588, 2628); skip(4495, 4568)

L.append(lesson("Phenobarbital, high fever and summary",
    "Know the phenobarbital doses for young infants, what to do for high fever, and the summary of coma and convulsion.", [
    tbl([TX(2678, 2678), TX(2662, 2662), TX(2664, 2664)], [
        [TX(2666, 2666), TX(2668, 2668), TX(2670, 2670)], [TX(2672, 2672), TX(2674, 2674), TX(2676, 2676)]],
        f"{TX(2660, 2660)}. {TX(2661, 2661)}"),
    H(TX(2680, 2680)), LI(2681, 2683),
    *X(2690, 2696),
    note(join([TX(2688, 2688), TX(2698, 2701), TX(2705, 2705)]), "Remember"),
    H(TX(2703, 2703)),
    tbl([TX(2707, 2707), TX(2709, 2709)], [[TX(2711, 2711), TX(2713, 2713)], [ul(items(2719, 2721)), ul(items(2728, 2731))]]),
    *X(2733, 2735),
    sort("Coma, convulsion, or both?", ["Coma only", "Convulsion only", "Both"], [
        ("Manage the airway", "Both"),
        ("Check the blood sugar", "Both"),
        ("Give diazepam", "Convulsion only"),
        ("Position the child", "Both"),
    ]),
]))
mark(2660, 2678); mark(2707, 2731)

DRILL3 = [("6 weeks", "3 kg", "15 ml", "60 ml", "0.3 ml"), ("3 months", "5 kg", "25 ml", "100 ml", "0.5 ml"),
          ("4 years", "16 kg", "80 ml", "320 ml", "1.6 ml"), ("6 months", "8 kg", "40 ml", "160 ml", "0.8 ml"),
          ("18 months", "12 kg", "60 ml", "240 ml", "1.2 ml"),
          ("6 months, severely malnourished", "4 kg", "5 ml x 4 kg = 20 ml", "15 ml x 4 kg = 60 ml in 1 hour", "0.4 ml"),
          ("12 months", "12 kg", "60 ml", "240 ml", "1.2 ml"), ("2 months", "5 kg", "25 ml", "100 ml", "0.5 ml"),
          ("1 month", "3 kg", "15 ml", "60 ml", "0.3 ml")]
L.append(lesson("Drill 3: determine correct doses",
    "Work out quickly the glucose, shock fluid and diazepam doses for each child.", [
    timing("Day 2, 15:25 (80 minutes): group work to practise giving diazepam rectally, giving IV glucose and drawing up the correct dose "
           "rapidly, repeated until everyone has practised several times. The facilitator does not demonstrate but observes and corrects."),
    fgnote("Your facilitator asks, as in a drill: what dose would you give the following children? For each child, say the amount of "
           "10% glucose (D10) as a bolus, the bolus of Ringer’s lactate or normal saline for shock, and the amount of rectal diazepam "
           "(10 mg/2 ml solution). Say your answers aloud, then open the card."),
    *[reveal(f"{age}, {wt}: D10 bolus? Shock fluid bolus? Rectal diazepam?",
             f"D10: {g}. Ringer’s lactate or normal saline: {s}. Diazepam: {d}.", f"Child {i}")
      for i, (age, wt, g, s, d) in enumerate(DRILL3, 1)],
]))

AQ = _ex(equiz("sudan-etat-aq-coma-convulsion", 41, "Assessment questions: Coma and convulsion", [TX(2744, 2745)], [
    open_q("q1", TX(2746, 2746), ["A: when the child is Alert", "V: when the child responds to Voice", "P: when the child responds to Pain",
                                  "U: when the child is unresponsive, thus Unconscious"]),
    open_q("q2", TX(2748, 2748), ["2.5 mmol/litre"]),
    open_q("q3", TX(2750, 2750), ["You would give 40 ml (5 ml/kg) of 10% glucose to a 6-month-old weighing 8 kg who has a low blood sugar."]),
    open_q("q4", TX(2752, 2753), ["The recovery position."]),
    open_q("q5", TX(2755, 2757), ["You would give 1.5 ml (i.e. 7.5 mg) of rectal diazepam (10 mg/2 ml) to a 4-year-old weighing 15 kg who was having a convulsion.",
                                  "You should wait 10 minutes before giving a second dose if the convulsion does not stop."]),
    open_q("q6", TX(2759, 2762), ["The child responds to Pain, she is assigned P in the AVPU scoring.",
                                  "The child is having a convulsion and you should assess and manage her airway. You need to clear secretion and give oxygen.",
                                  "If easily done, check blood sugar; if low (<2.5 in a normally nourished child), insert IV and give glucose IV (5 ml/kg of 10% glucose).",
                                  "Stop convulsion with anticonvulsant (rectal diazepam or paraldehyde).", "Then position the child if unconscious."]),
    open_q("q7", TX(2770, 2771), ["To stop the convulsion the child can be given an anti-convulsant (rectal diazepam or paraldehyde).",
                                  "The child may have low blood sugar so this should be checked and treated if low.",
                                  "It is important to manage the airway and give oxygen.",
                                  "When the convulsion stops the child should be put in the recovery position."]),
    open_q("q8", TX(2773, 2775), ["The child should be triaged using ABCD. She has emergency signs. The child should be assessed for coma using the AVPU score. The child is unconscious U.",
                                  "The next steps are to manage the airway as described in sections A and B. The blood glucose should be checked and treated if low with IV glucose. The child should be put into the recovery position. The remainder of the assessment should then be completed."]),
    open_q("q9", TX(2777, 2780), ["The child is having a convulsion and you should assess and manage his airway. You may need to clear secretion and give oxygen.",
                                  "If easily done, check blood sugar; if low (<2.5 in a normally nourished child), insert IV and give glucose IV (5 ml/kg of 10% glucose).",
                                  "Stop convulsion with anticonvulsant (rectal diazepam or paraldehyde).", "Then position the child if unconscious.",
                                  "Then complete the rest of the assessment."]),
    open_q("q10", TX(2782, 2784), ["The child has normal airway, breathing and circulation. He requires to be assessed for coma and convulsions. He should be assessed for coma using the AVPU score. If the score is P or U he should be managed for coma, a blood glucose checked and treated with IV glucose if low. If the score is A or V, he should be assessed for priority signs.",
                                   "The child at least has one priority sign (feels very hot and he may have pain) and should go to the head of the queue and a health worker informed."]),
    open_q("q11", TX(2786, 2789), ["The child should be triaged using ABCD. The child has normal airway, breathing and circulation. The child should be assessed for coma using the AVPU score and her score is V. She is lethargic. She has no diarrhoea. She is pale and has 2 priority signs and should be assessed quickly by a health worker though she is not an emergency."]),
], minutes=20, source="WHO ETAT manual for participants (2005), assessment questions; answers: ETAT facilitator guide Annex 5"))
L.append(lesson("Assessment questions: Coma and convulsion",
    "Answer the assessment questions on coma and convulsion, then compare with the model answers.", [
    timing("Day 2, 16:45 (15 minutes): wind-up: summary of the coma and convulsion section, a look ahead to Day 3, and the assignments: "
           "reading on all the “D” signs and the assessment questions on coma and convulsion (answers discussed on Day 3 at 08:00)."),
    H(TX(2743, 2743)),
    AQ,
]))
mark(2741, 2789)

MODULE = module("Module 4: Coma and convulsion", 4, L)
