# Module 5 of the Sudan ETAT course: Dehydration.
# Facilitator guide, Day 3 08:00-12:45: review of the coma and convulsion questions, Drill 4
# (flow of triage), clinical session, summary of dehydration (charts), Exercise C (video),
# Plan C, drops per minute, Drill 5, fluids in severe malnutrition (Tables 10, 11 and Flow
# chart 1), demonstration and group work on rapid fluids (Case scenarios table A), wind-up.
from elib import *

EXERCISES = []
def _ex(e):
    EXERCISES.append(e); return ex(e["id"], e["title"].replace("Sudan ETAT: ", ""))

mark(2795, 2797)   # module title page

def drill(title, rows, label):
    """A drill from the facilitator guide as a story: each step asks for the correct response."""
    answers = [r[2] for r in rows]
    stages = []
    for i, (what, found, right) in enumerate(rows):
        others = sorted({a for a in answers if a.lower() != right.lower()})
        opts = [right, others[(i * 3) % len(others)], others[(i * 5 + 2) % len(others)]]
        if opts[1] == opts[2]:
            opts[2] = others[(i * 5 + 3) % len(others)]
        k = i % 3
        opts = opts[1:k + 1] + [right] + opts[k + 1:]
        stages.append(stage(f"You assess: {what}. You find: {found}.", "What should you do next?", opts, k, right))
    return story(title, stages, label)

DRILL4 = [
    ("breathing", "breathing is adequate", "Assess circulation"),
    ("circulation", "warm hand", "Assess consciousness"),
    ("circulation", "cold hand", "Assess capillary refill"),
    ("circulation", "capillary refill is quick", "Assess consciousness"),
    ("circulation", "weak and fast pulse", "Assess consciousness"),
    ("consciousness", "alert, not convulsing", "Ask for diarrhoea"),
    ("consciousness", "child is convulsing", "Check for head or neck trauma, and then treat for convulsions, and then quickly continue assessment"),
    ("consciousness", "lethargy (no other neurological signs present)", "Assess for diarrhoea and severe dehydration"),
    ("does the child have diarrhoea?", "mother says child does not have diarrhoea", "Assess priority signs"),
    ("does the child have diarrhoea?", "mother says child has diarrhoea", "Assess signs of severe dehydration: lethargy, sunken eyes, very slow skin pinch"),
    ("priority signs", "child is age < 2 months, but no other signs present", "Bring to front of queue for immediate assessment and treatment"),
    ("priority signs", "child has none of the signs", "Return the child to the queue to be assessed and treated in turn"),
]
DRILL4B = [
    ("airway and breathing, and then circulation", "breathing is adequate, but the child is in shock",
     "Quickly also assess coma/convulsing, and check for head or neck trauma and severe malnutrition, and then treat for shock (and treat coma or convulsing if needed)"),
    ("airway and breathing", "child is in respiratory distress",
     "Check if breathing is obstructed, check for head or neck trauma, and then treat: manage airway, give oxygen. Then quickly assess circulation"),
    ("A and B, C and D", "child is breathing adequately, circulation OK, lethargy, diarrhoea, sunken eyes", "Check for head and neck trauma, severe malnutrition"),
    ("malnutrition in a child with diarrhoea with severe dehydration", "no severe malnutrition", "Insert IV line and begin giving fluids rapidly following Plan C"),
    ("malnutrition in a child with diarrhoea with severe dehydration", "visible severe wasting", "Do not insert IV. Proceed immediately to assessment and treatment"),
    ("all clinical signs", "breathing is adequate, child is in shock, has lethargy but no convulsions, diarrhoea with sunken eyes and very slow skin pinch, no severe malnutrition",
     "Stop any bleeding, give oxygen, insert IV and begin giving fluids rapidly following Plan C"),
    ("signs of dehydration and severe malnutrition (child breathing OK, lethargy, no shock, history of diarrhoea)", "sunken eyes, visible severe wasting",
     "Proceed immediately to further assessment and treatment for severely malnourished child"),
]

L = []
L.append(lesson("Review and Drill 4: the flow of triage",
    "Say quickly what you do next at each step of the triage assessment.", [
    timing("Day 3, 08:00 (10 minutes): review of the assessment questions on coma and convulsion with the model answers. Then (20 minutes) "
           "Drill 4, an oral drill on the flow of the triage assessment. From 08:30 (90 minutes): clinical session in outpatients and on the ward."),
    fgnote("Your facilitator says what is being assessed and what is found, and you answer quickly with what you should do next. "
           "In the clinical session, practise the whole ABCD assessment on real children in your outpatient department and ward."),
    drill("Drill 4, part 1: from breathing to priority signs", DRILL4, "Drill 4"),
    drill("Drill 4, part 2: putting the signs together", DRILL4B, "Drill 4"),
]))

ABCD = tbl([], [[f"<strong>{TX(2807, 2807)}</strong>", TX(2809, 2809)], [f"<strong>{TX(2811, 2811)}</strong>", TX(2813, 2813)],
                [f"<strong>{TX(2815, 2815)}</strong>", f"{TX(2817, 2817)}<br>{TX(2818, 2818)}<br>{TX(2819, 2819)}"],
                [f"<strong>{TX(2821, 2821)}</strong>", f"<strong>{TX(2823, 2823)}</strong>"]])
mark(2807, 2823)

L.append(lesson("Dehydration: what to assess",
    "Name the three signs of severe dehydration and the treatment in Table 9.", [
    timing("Day 3, 10:15 (10 minutes): summary of the assessment of dehydration with ETAT Charts 1 and 10 (the triage chart and Plan C): "
           "how dehydration links with shock, the signs to assess, the technique for the skin pinch, and the treatment."),
    *X(2799, 2805),
    ABCD,
    *X(2825, 2827, h=[2825]),
    H(TX(2829, 2829)), Pp(TX(2830, 2830)), LI(2831, 2833),
    *X(2839, 2841),
    tbl([], [[f"<strong>{TX(2845, 2845)}</strong><br>{TX(2846, 2850)}", f"{TX(2852, 2852)}" + ul(items(2857, 2859)), TX(2861, 2862),
              f"<strong>{TX(2864, 2864)}</strong><br>{TX(2866, 2867)}<p><strong>{TX(2868, 2868)}</strong><br>{TX(2869, 2871)}</p>"]],
        f"{TX(2842, 2842)}. {TX(2843, 2843)}"),
    q("A child has diarrhoea and is lethargic, with normal eyes and a skin pinch that goes back immediately. Severe dehydration?",
      ["Yes", "No: severe dehydration needs diarrhoea plus any two of the signs"], 1, TX(2852, 2852) + " lethargy, sunken eyes, very slow skin pinch."),
]))
mark(2842, 2871)

L.append(lesson("Lethargy, sunken eyes and the skin pinch",
    "Assess each sign of severe dehydration step by step.", [
    *X(2879, 2894, h=[2883]),
    H(TX(2896, 2896)),
    fig(31, TX(2898, 2899), 44),
    *X(2901, 2904),
    H(TX(2906, 2907)),
    *X(2908, 2925),
    fig(32, TX(2926, 2927), 44),
    note(TX(2931, 2933), "Remember"),
    *X(2937, 2944),
    steps("The skin pinch: step by step", [
        ("Where", "On the abdomen, halfway between the umbilicus and the side of the abdomen."),
        ("How", "Not with your fingertips. Pinch in a vertical (head to foot) direction, picking up all the layers of the skin and the tissue underneath."),
        ("How long", "Pinch for one second and then release."),
        ("Look", "Does the skin go back very slowly (longer than 2 seconds)?"),
    ]),
]))
mark(2898, 2899); mark(2906, 2907); mark(2926, 2927)

L.append(lesson("Exercise C: video exercise on signs of dehydration",
    "Decide from the video whether each child has sunken eyes, and how fast the skin pinch goes back.", [
    timing("Day 3 (15 minutes): video exercise C: lethargy (and how it links with AVPU), sunken eyes (6 children, about 7 minutes) and the "
           "skin pinch (5 children, about 6 minutes)."),
    fgnote("During the video you will see examples of how to assess a child with diarrhoea for severe dehydration. For each of the children "
           "shown, answer the question. Write your answers, then open the cards."),
    video("Exercise C: signs of dehydration", "Sunken eyes (6 children), then the skin pinch (5 children). Answer for each child.", "ET5.1"),
    reveal("Does the child have sunken eyes? Children 1 to 6: Yes or No?",
           "Child 1: Yes. Child 2: No. Child 3: Yes. Child 4: No. Child 5: Yes. Child 6: No.", "Exercise C answers"),
    reveal("Does the skin pinch go back very slowly, slowly, or immediately? Children 1 to 5?",
           "Child 1: slowly. Child 2: immediately. Child 3: very slowly. Child 4: slowly. Child 5: very slowly.", "Exercise C answers"),
]))

L.append(lesson("Treatment of severe dehydration: Plan C",
    "Give IV fluids according to Plan C to a child with severe dehydration without shock or severe malnutrition.", [
    timing("Day 3 (10 minutes): how to use Plan C. Your facilitator displays an enlargement of “Diarrhoea Treatment Plan C: Treat severe "
           "dehydration quickly” and reads the flowchart with you, so that you learn Plan C as you will do it in your own hospital."),
    H(TX(2946, 2947)),
    Pp(TX(2948, 2948)),
    *X(2949, 2958, h=[2949, 2956]),
    H(TX(2959, 2959)), Pp(TX(2960, 2961)),
    story("Ellen, six months old, 9 kg", [
        stage(TX(2962, 2964), "How much Ringer’s lactate does Ellen need in the first hour?", ["90 ml", "270 ml", "630 ml"], 1, "30 ml x 9 kg = 270 ml."),
        stage(TX(2965, 2969), "After 4 hours Ellen is able to drink. How much ORS should she get per hour?", ["About 45 ml (5 ml/kg)", "About 180 ml (20 ml/kg)", "None until the drip is stopped"], 0,
              TX(2957, 2958)),
        stage(TX(2970, 2971), "After 6 hours Ellen is reassessed and reclassified as SOME DEHYDRATION. What next?", ["Repeat Plan C", "Stop the IV and continue with Plan B", "Give a bolus for shock"], 1, TX(2973, 2975)),
        stage(TX(2972, 2975)),
    ], "Example"),
    H(TX(2977, 2978)),
    *X(2979, 2981),
    chart("11", 77, "Chart 11. How to treat severe dehydration in an emergency setting (Plan C)."),
]))
skip(4633, 4712); mark(2977, 2978)

L.append(lesson("Volumes and drops per minute: Tables 9 and 10",
    "Find the volume, the rate per hour and the drops per minute for a child with severe dehydration.", [
    *X(2986, 2990),
    tbl([TX(3004, 3004), f"{TX(2996, 2996)}: {TX(3006, 3006)}", TX(3008, 3008), f"{TX(3000, 3000)} {TX(3010, 3010)}", f"{TX(3002, 3002)} {TX(3012, 3012)}",
         f"{TX(2998, 2998)}: {TX(3014, 3014)}", TX(3016, 3016), f"{TX(3002, 3002)} {TX(3018, 3018)}", f"{TX(3002, 3002)} {TX(3020, 3020)}"], [
        [TX(3022, 3022), "200", "40 ml", "40", "13", "", "", "", ""],
        [TX(3023, 3023), "350", "70 ml", "70", "23", "", "", "", ""],
        [TX(3024, 3024), "550", "110 ml", "110", "37", "550", "220", "220", "73"],
        [TX(3025, 3025), "850", "170 ml", "170", "57", "850", "340", "340", "113"],
        [TX(3026, 3026), "1200", "240 ml", "240", "80", "1200", "480", "480", "160"],
    ], f"{TX(2992, 2992)}. {TX(2993, 2993)} ({TX(2994, 2994)})"),
    note(TX(3115, 3119), "Footnote 2: drops per minute"),
    note(TX(3110, 3111), "Footnote 1: initial rehydration"),
    *X(3068, 3071),
    tbl([TX(3076, 3076), TX(3078, 3078)], [[TX(a, a), TX(b, b)] for a, b in [(3080, 3082), (3084, 3086), (3088, 3090), (3092, 3094), (3096, 3098)]],
        f"{TX(3073, 3073)}. {TX(3074, 3075)}"),
    *X(3100, 3104),
    timing("Day 3 (10 minutes): calculating the number of drops per minute with a burette. Do you have burettes in your hospital? Adult sets "
           "give 20 drops per ml; paediatric (micro) sets give 60 drops per ml."),
    q("An infant of 5 kg is on Plan C. The rate is 70 ml per hour. How many drops per minute with a paediatric (micro) dropper?", ["23", "70", "210"], 1,
      "With a micro dropper (60 drops per ml) the number of drops per minute is equal to the number of ml per hour."),
    q("Same infant, but you only have an adult IV set (20 drops per ml). How many drops per minute?", ["23", "70", "140"], 0,
      "70 ml per hour x 20 drops per ml ÷ 60 minutes = about 23 drops per minute."),
]))
mark(2992, 3066); mark(3073, 3098); mark(3108, 3119)

DRILL5 = [("14 months, 9 kg", "270 ml", "30 mins", "630 ml", "2½ hrs", "900 ml", "3 hrs"),
          ("8 months, 7 kg", "210 ml", "1 hour", "490 ml", "5 hrs", "700 ml", "6 hrs"),
          ("3 years, 13 kg", "390 ml", "30 mins", "910 ml", "2½ hrs", "1300 ml", "3 hrs"),
          ("3 months, 5 kg", "150 ml", "1 hour", "350 ml", "5 hrs", "500 ml", "6 hrs"),
          ("2 years, 12 kg", "360 ml", "30 mins", "840 ml", "2½ hrs", "1200 ml", "3 hrs"),
          ("15 months, 10 kg", "300 ml", "30 mins", "700 ml", "2½ hrs", "1000 ml", "3 hrs"),
          ("4 years, 15 kg", "450 ml", "30 mins", "1050 ml", "2½ hrs", "1500 ml", "3 hrs"),
          ("23 months, 11.5 kg", "345 ml", "30 mins", "805 ml", "2½ hrs", "1150 ml", "3 hrs"),
          ("6 months, 6 kg", "180 ml", "1 hour", "420 ml", "5 hrs", "600 ml", "6 hrs"),
          ("12 months, 8 kg", "240 ml", "30 mins", "560 ml", "2½ hrs", "800 ml", "3 hrs"),
          ("11½ months, 8 kg", "240 ml", "1 hour", "560 ml", "5 hrs", "800 ml", "6 hrs"),
          ("5 months, 5 kg", "150 ml", "1 hour", "350 ml", "5 hrs", "500 ml", "6 hrs"),
          ("10 months, 7 kg", "210 ml", "1 hour", "490 ml", "5 hrs", "700 ml", "6 hrs")]
L.append(lesson("Drill 5: amounts of IV fluid on Plan C",
    "Work out how much IV fluid to give, and over how long, for each child with severe dehydration.", [
    timing("Day 3 (15 minutes): Drill 5 on the amounts of IV fluid to give a child on Plan C (diarrhoea with severe dehydration, without "
           "shock or severe malnutrition). You may look at Plan C during the drill. Use pencil and paper."),
    fgnote("Your facilitator states the age and weight of each child. Say how much IV fluid should be given first and over how long, then "
           "how much next and over how long. Remember: infants (under 12 months) 30 ml/kg in 1 hour then 70 ml/kg in 5 hours; children "
           "30 ml/kg in 30 minutes then 70 ml/kg in 2½ hours."),
    *[reveal(f"{c}: first give? then give?", f"First give {a1} over {t1}. Then give {a2} over {t2}. Total {a3} in {t3}.", f"Child {i}")
      for i, (c, a1, t1, a2, t2, a3, t3) in enumerate(DRILL5, 1)],
]))

L.append(lesson("Severe dehydration with severe malnutrition",
    "Rehydrate a severely malnourished child slowly with ReSoMal, and follow Table 12 and Flow chart 1.", [
    timing("Day 3 (10 minutes): how to give fluids to a child with severe dehydration and severe malnutrition, with Tables 11 and 12 and "
           "Flow chart 1, and sample calculations of fluid volumes."),
    *X(3123, 3133, h=[3123]),
    tbl([TX(3136, 3136), TX(3138, 3138)], [
        [TX(3140, 3140), "2 <em>(litres; the unit is not printed in the manual)</em>"],
        [TX(3144, 3144), TX(3146, 3146)], [TX(3148, 3148), TX(3150, 3150)], [TX(3152, 3152), TX(3154, 3154)]],
        f"{TX(3134, 3134)}. {TX(3135, 3135)}"),
    tbl([TX(3158, 3158), TX(3160, 3160)], [
        [TX(3162, 3162), TX(3164, 3164)],
        [f"<strong>{TX(3168, 3168)}</strong> {TX(3169, 3170)}", f"<strong>{TX(3201, 3201)}</strong> {TX(3202, 3203)}"],
        [f"<strong>{TX(3174, 3174)}</strong> {TX(3175, 3175)}<p>{TX(3182, 3182)}</p>" + ul(items(3183, 3184)) + f"<p>{TX(3188, 3188)}</p>" + ul(items(3189, 3190))
         + f"<p>{TX(3194, 3194)}</p><p>{TX(3196, 3197)}</p>" + ul(items(3198, 3199)) + f"<p>{TX(3217, 3217)}</p>" + ul(items(3218, 3219)),
         f"<strong>{TX(3177, 3177)}</strong> {TX(3178, 3178)}<p>{TX(3205, 3205)}</p>" + ul(items(3206, 3213)) + f"<p>{TX(3214, 3215)}</p>"]],
        f"{TX(3156, 3156)}. {TX(3157, 3157)}"),
    steps("Flow chart 1. Management of the child with severe dehydration", [
        ("Assess for shock", "Shock absent: Plan C. Shock present: check for severe malnutrition."),
        ("Child non-malnourished", "Chart 7; if improvement, Chart 11."),
        ("Child malnourished", "Chart 8; then inpatient guidelines."),
    ]),
    q("A 10-month-old of 5 kg with visible severe wasting has severe dehydration and no shock. How much ReSoMal do you give?",
      ["25 ml (5 ml/kg) every 30 minutes for 2 hours, then 25-50 ml hourly for the next 4-10 hours", "150 ml IV in 1 hour",
       "100 ml (20 ml/kg) every hour for 6 hours"], 0, "Case scenarios table A, facilitator guide."),
]))
mark(3134, 3219)

L.append(lesson("Maintenance fluids and summary: dehydration",
    "Choose the fluids after the first rehydration, and review the dehydration summary.", [
    Pp(TX(3225, 3225)),
    tbl([TX(3228, 3228), TX(3231, 3232)], [[
        f"{TX(3229, 3229)}<p>{TX(3234, 3235)} {TX(3240, 3242)}</p><p>{TX(3253, 3254)}</p><p>{TX(3260, 3261)}</p>" + ul(items(3265, 3266))
        + f"<p>{TX(3273, 3273)}</p><p>{TX(3274, 3275)}</p>",
        f"{TX(3237, 3238)}<p>{TX(3244, 3248)}</p>"]], f"{TX(3226, 3226)}. {TX(3227, 3227)}"),
    note(join([TX(3256, 3258), TX(3268, 3271), TX(3277, 3277), TX(3283, 3283), TX(3278, 3279)]), "Remember"),
    R("<h3>" + TX(3281, 3281) + "</h3><p><strong>" + TX(3284, 3284) + "</strong></p>" + ul(items(3295, 3297))
      + "<p><strong>" + TX(3289, 3289) + "</strong></p>" + ul(items(3299, 3300))),
    sort("Which child? With or without severe malnutrition", ["WITHOUT severe malnutrition", "WITH severe malnutrition"], [
        ("Give intravenous or nasogastric fluids", "WITHOUT severe malnutrition"),
        ("Give oral or nasogastric fluids (ReSoMal)", "WITH severe malnutrition"),
        ("Give 70 ml/kg of Ringer’s lactate over 5 hours (infants) or 2½ hours (children)", "WITHOUT severe malnutrition"),
        ("Continue ReSoMal 5-10 ml/kg/hour for the next 4-10 hours", "WITH severe malnutrition"),
    ], "Treat shock if present in both."),
]))
mark(3225, 3300)

CASES = [
    ("8 months, 7 kg, no shock", "IV Ringer’s lactate 210 ml (30 ml/kg) over 1 hour", "better", "490 ml over 5 hours"),
    ("8 months, 7 kg, shock", "IV Ringer’s lactate 140 ml (20 ml/kg) as fast as possible", "better, pulse slower and capillary refill <2 secs", "490 ml over 5 hours"),
    ("15 months, 10 kg, no shock", "IV Ringer’s lactate 300 ml over 20 mins", "better", "700 ml over 2½ hours"),
    ("15 months, 10 kg, shock", "IV Ringer’s lactate 200 ml (20 ml/kg) as fast as possible", "not better",
     "Repeat 200 ml as fast as possible; if not improved, repeat again; if improved, switch to 700 ml over 2½ hours"),
    ("10 months, 5 kg, visible severe wasting, no shock", "ReSoMal orally 25 ml (5 ml/kg) every 30 min for 2 hours", "better",
     "Continue 25-50 ml (5-10 ml/kg) hourly for next 4-10 hours"),
    ("18 months, 8 kg, oedema of both feet, shock", "If lethargic or comatose: give IV Ringer’s lactate + 5% glucose or NaCl 0.45% + 5% glucose 120 ml (15 ml/kg) over 1 hour",
     "improved, or not improved", "If improved: repeat 120 ml over 1 hour, then switch to ReSoMal by NG tube 10 ml/kg over 10 hours. If not improved: "
     "assume septic shock, give maintenance fluids 32 ml/hour (4 ml/kg/hour), send for blood, transfuse 10 ml/kg over 3 hours"),
]
L.append(lesson("Giving rapid fluids: demonstration and group work",
    "Set up a drip, give the right volume at the right rate, and manage children with shock or severe dehydration.", [
    timing("Day 3 (10 minutes): demonstration of giving rapid fluids. Then group work (60 minutes, until 12:45) in teams of 2, a doctor and "
           "a nurse, simulating IV fluids for children with or without malnutrition and dehydration, and with and without shock (Case "
           "scenarios table A)."),
    fgnote("Insert a cannula into a rolled towel (the limb) at a realistic angle and tape it down; attach the fluids and make sure the drips "
           "are dripping freely; work out the amount, the rate and the number of drops per minute (adult and paediatric burettes); mark the "
           "bottle to show when the amount has been given; reassess the child and select the correct continuing treatment."),
    video("Giving rapid IV fluids", "Demonstration: setting up the drip, counting drops per minute and marking the bottle.", "ET5.2"),
    *[reveal(f"{c}: what is your first action? The child is then {d}. What is your second action?",
             f"First action: {a}. Development: {d}. Second action: {s}.", f"Case {i}") for i, (c, a, d, s) in enumerate(CASES, 1)],
]))

AQ = _ex(equiz("sudan-etat-aq-dehydration", 51, "Assessment questions: Dehydration", [TX(3307, 3308)], [
    open_q("q1", TX(3309, 3309), ["A skin pinch is abnormal if it remains for longer than 2 seconds."]),
    open_q("q2", TX(3310, 3311), ["You should give 180 ml of fluid in the first hour to an 8-month-old weighing 6 kg who is severely dehydrated.",
                                  "The second lot of fluid is given over 5 hours."]),
    open_q("q3", TX(3313, 3314), ["To a 3-year-old weighing 15 kg who is severely dehydrated and has received 450 ml of fluid in 30 minutes, you would give 70 ml/kg times 15, i.e. 1050 ml of IV fluid over 2½ hours."]),
    open_q("q4", TX(3316, 3316), ["If you cannot set up a drip, you should give the child nasogastric fluid at the rate of 20 ml/kg per hour for 6 hours."]),
    open_q("q5", TX(3324, 3329), ["Barec’s dehydration: begin IV fluid immediately.", "Initially: 450 ml (30 ml x 15 kg) of IV fluid in the first 30 minutes."]),
    open_q("q6", TX(3331, 3335), ["Because he is severely malnourished, he needs immediate assessment and treatment. Do not give IV fluids but give ReSoMal 5 ml/kg every 30 minutes for the first 2 hours, then 5-10 ml/kg/hour for the next 4-6 hours.",
                                  "Also check blood glucose and treat if <3 mmol/l."]),
    open_q("q7", TX(3343, 3348), ["How much IV fluid in the first hour: 180 ml (30 ml x 6 kg).", "Should the health worker give ORS solution? Yes.",
                                  "How much: the health worker should encourage Dano to sip ORS solution, while the drip is being set up and while he is receiving IV fluid; about 30 ml (5 ml x 6 kg) of ORS solution per hour."]),
    open_q("q8", TX(3350, 3355), ["She should first be treated for shock: an intravenous line should be inserted and fluids given rapidly. She should initially be given 140 ml Ringer’s lactate or normal saline solution as bolus."]),
    open_q("q9", TX(3363, 3371), ["How should Rogit be rehydrated? The health worker can insert a nasogastric tube and give Rogit ORS solution.",
                                  "How much initially? He should have 160 ml per hour for 6 hours (20 ml/kg/hour)."]),
    open_q("q10", TX(3373, 3376), ["In this baby airway, breathing, circulation, coma are normal. There is no convulsion. The child has diarrhoea and appears to be dehydrated. The child is not shocked.",
                                   "This child appears malnourished, therefore IV fluids should be avoided. Give the child oral or naso-gastric ReSoMal 5 ml/kg every 30 minutes for the first 2 hours.",
                                   "Check the blood sugar; if it is <3 mmol/L treat this with IV glucose. The child should then have 5-10 ml/kg/hr ReSoMal and be managed by appropriate inpatient guidelines."]),
], minutes=20, source="WHO ETAT manual for participants (2005), assessment questions; answers: ETAT facilitator guide Annex 5"))
L.append(lesson("Assessment questions: Dehydration",
    "Answer the assessment questions on dehydration, then compare with the model answers.", [
    timing("Day 3, wind-up before lunch: summary of the assessment and management of severe dehydration, and the assessment questions on "
           "dehydration."),
    H(TX(3306, 3306)),
    AQ,
]))
mark(3304, 3376)

MODULE = module("Module 5: Dehydration", 5, L)
