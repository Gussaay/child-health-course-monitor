# Module 6 of the Sudan ETAT course: Case management scenarios.
# Facilitator guide, Day 3 14:00-17:00: demonstration (role play of poor practice, then good
# management), tea, group work on the case management scenarios (Table B, scenarios 1-14),
# summary and discussion. The scenarios (scenarios.json) are taken from the facilitator
# guide's Table B: what the facilitator tells you, and the correct response.
import json, os
from elib import *

EXERCISES = []
SC = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "scenarios.json"), encoding="utf-8"))

def tidy(s):
    s = s.replace("Æ", "→").replace("1V glucose", "IV glucose")
    return " ".join(s.split())

POOL = sorted({tidy(r[1]).lower(): tidy(r[1]) for sc in SC for r in sc["rows"] if r[1].strip()}.values(), key=len)

# A name for each child, so the scenarios read as one shift in the emergency room.
NAMES = {1: "Amna", 2: "Omer", 3: "Yousif", 4: "Hawa", 5: "Ahmed", 6: "Rania", 7: "Mohamed", 8: "Khalid", 9: "Nour",
         10: "Hassan", 11: "Musa", 12: "Adam", 13: "Fatima", 14: "Salma"}

# A hint for a wrong pick, chosen by what the correct response is about (first match wins).
HINTS = [
    ("airway", "Follow ABCD: what do you always check first, before anything else?"),
    ("breathing", "Follow ABCD: after the airway, what comes next?"),
    ("central pulses", "The peripheral pulses cannot be felt. Where else can you feel a pulse?"),
    ("cap refill", "The hand is cool. How do you tell whether this child is in shock?"),
    ("shock", "Cold hands and a slow capillary refill: what does this child have, and what does it need now?"),
    ("circulation", "Airway and breathing are done. What is the next letter of ABCD?"),
    ("consciousness", "Circulation is done. What is the next letter of ABCD?"),
    ("glucose", "A child who is not alert or who convulses: what must you always check, and treat if it is low?"),
    ("diazepam", "The child is convulsing. What stops the convulsion?"),
    ("paraldehyde", "The child is convulsing. What stops the convulsion?"),
    ("malnutrition", "Before you give fluids for dehydration, what must you check?"),
    ("plan c", "Severe dehydration without severe malnutrition: which treatment plan?"),
    ("dehydration", "The child has diarrhoea. What do you look for next?"),
    ("diarrhoea", "Consciousness is done. What does the D of ABCD stand for?"),
    ("pressure", "The leg is bleeding. How do you stop it?"),
    ("oxygen", "Severe respiratory distress or cyanosis: what does the child need now?"),
    ("priority", "There is no emergency sign. Does the child have a priority sign?"),
    ("emergency", "Is there an emergency sign? If yes, triage as emergency and treat it now."),
]

def hint(resp):
    r = resp.lower()
    if r.startswith("triage as emergency"): return HINTS[-1][1]
    if r.startswith("triage as priority"): return HINTS[-2][1]
    return next((h for k, h in HINTS if k in r), "Think of the ABCD order, and treat each emergency sign as soon as you find it.")

def found_text(found):
    """What you find at this step, said to the learner (the guide's words for the facilitator, made direct)."""
    if found.startswith("If participant"):
        return "You go on to the rest of the examination without managing the airway. The child is now very blue and is seizing."
    found = found.replace("After participant manages the airway, say your airway management has helped.",
                          "You manage the airway. Your airway management has helped.")
    if found.startswith("If ") or ": Child goes" in found:
        return f"What happens if this step is missed: {found}"
    return f"You find: {found}"

def scenario(sc):
    """One child on your shift, as a story: at each step you choose what to do next. A wrong pick gives a hint."""
    stages, text, i = [], "", 0
    for found, resp in sc["rows"]:
        found, resp = tidy(found), tidy(resp)
        if found:
            text = (text + " " if text else "") + found_text(found)
        if not resp:
            stages.append(stage(text.rstrip(".") + "."))
            text = ""
            continue
        # two other responses of similar length as distractors
        others = [p for p in POOL if p.lower() != resp.lower()]
        near = sorted(others, key=lambda p: (abs(len(p) - len(resp)), p))
        d = [near[(sc["n"] + i) % 6], near[(sc["n"] + i + 3) % 6 + 6]]
        k = (sc["n"] + i) % 3
        opts = d[:k] + [resp] + d[k:]
        fb = [hint(resp) if j != k else "" for j in range(3)]
        stages.append(stage(text or "What do you do first?", "What do you do now?", opts, k, resp, fb))
        text, i = "", i + 1
    return story(f"Child {sc['n']}: {NAMES[sc['n']]}", stages, "Your shift", f"{NAMES[sc['n']]}. {tidy(sc['intro'])}")

# Doses to work out after a case, from the answers in the facilitator guide (weights from the scenario).
GLU = "10% glucose: 5 ml/kg."
SHOCK = "Shock: 20 ml/kg of Ringer’s lactate or normal saline."
CALCS = {
    7: [("Mohamed weighs 14 kg and is in shock. How many ml of Ringer’s lactate or normal saline for the first bolus?", 280, SHOCK, "20 ml/kg × 14 kg = 280 ml")],
    8: [("Khalid weighs 5 kg and is in shock. How many ml of Ringer’s lactate for the first bolus?", 100, SHOCK, "20 ml/kg × 5 kg = 100 ml"),
        ("His blood glucose is below 2 mmol/L. How many ml of 10% glucose?", 25, GLU, "5 ml/kg × 5 kg = 25 ml")],
    9: [("Nour weighs 8 kg and is in shock. How many ml of Ringer’s lactate for each bolus?", 160, SHOCK, "20 ml/kg × 8 kg = 160 ml"),
        ("The blood glucose is 1.5 mmol/L. How many ml of 10% glucose?", 40, GLU, "5 ml/kg × 8 kg = 40 ml")],
    10: [("Hassan weighs 12 kg and his blood glucose is 2 mmol/L. How many ml of 10% glucose?", 60, GLU, "5 ml/kg × 12 kg = 60 ml")],
    11: [("Musa weighs 11 kg and his blood glucose is 1.5 mmol/L. How many ml of 10% glucose?", 55, GLU, "5 ml/kg × 11 kg = 55 ml")],
    12: [("Adam weighs 3.5 kg and his blood glucose is 1 mmol/L. How many ml of 10% glucose?", 17.5, GLU, "5 ml/kg × 3.5 kg = 17.5 ml")],
    13: [("Fatima weighs 10 kg and is on Plan C. How many ml of Ringer’s lactate in the first ½ hour?", 300,
          "Plan C, from 12 months: 30 ml/kg in the first ½ hour.", "30 ml/kg × 10 kg = 300 ml"),
         ("How many ml in the next 2½ hours?", 700, "Plan C, from 12 months: 70 ml/kg in the next 2½ hours.", "70 ml/kg × 10 kg = 700 ml")],
}

def case(sc):
    return [scenario(sc)] + [calc(qq, ans, "ml", "", h, ex, f"Doses for {NAMES[sc['n']]}", "Work it out") for qq, ans, h, ex in CALCS.get(sc["n"], [])]

L = []
L.append(lesson("Case management scenarios: how they work",
    "See how a whole case is managed, first badly and then well, before you manage cases yourself.", [
    timing("Day 3, 14:00 (45 minutes): demonstration. A role play of poor practice, where such cases are mismanaged, then the same "
           "scenario with good management. Then tea, and from 15:00 (105 minutes) group work on the case management scenarios."),
    H(TX(3384, 3385)),
    *X(3387, 3390),
    note("To manage the child presented in the case scenario by using skills learned in the group clinical sessions.", "Objective"),
    fgnote("Watch as the facilitator assesses and starts treatment for a first case, checking the triage flowchart and the treatment boxes, "
           "and explaining each step aloud: for example, “I am checking for lethargy and sunken eyes, and I see she is alert and fussy, "
           "resisting us. Her eyes do not look sunken either.” When a treatment is needed, the supplies are gathered and the steps are done "
           "or pretended: locating the site, cleaning it, inserting and taping the IV needle, calculating the amount, attaching the fluid, "
           "marking the bottle, checking the flow. Then the child is reassessed (another dextrostix test, have the convulsions stopped, is "
           "the child with shock better after the first bolus?) and the next treatment is decided."),
    video("Role play: poor practice, then good management", "Watch the same emergency case managed badly, then well. What went wrong the first time?", "ET6.1"),
    reveal("After the role play: what did the team do wrong in the poor-practice version?",
           "Compare with the ABCD order: was the airway checked first, was treatment started as soon as an emergency sign was found, was the "
           "child reassessed, was severe malnutrition checked before fluids, did the team work together? Your facilitator discusses this with you.",
           "Think about it"),
    fgnote("In each scenario you are in charge of the child (the doll on the table) and may ask others for help. Say aloud what you assess "
           "first, second and so on, and what treatment you give. Your facilitator tells you the finding only when you say you are looking "
           "for that sign. The first time you will be slow and unsure: with practice you become quicker and more confident."),
    note("In the next lessons you are on shift in the emergency room, and 14 children come in one after another. You are in charge of each "
         "child. At each step, choose what you do next: what you assess first, second and so on, and what treatment you give. You are told "
         "what you find only after you choose to look for it. A wrong choice gives you a hint, and you try again; after two wrong choices "
         "you see the answer. At the end of each child you see which decisions you got right first time. Some children have doses to "
         "work out. The first time you will be slow and unsure: with practice you become quicker and more confident.", "How your shift works"),
    sort("What comes first?", ["First", "Later"], [
        ("Assess airway and breathing", "First"),
        ("Ask about diarrhoea", "Later"),
        ("Treat an emergency sign as soon as you find it", "First"),
        ("Assess priority signs", "Later"),
    ]),
]))
mark(3382, 3382)

GROUPS = [(1, 4, "Your shift, children 1 to 4: dehydration, convulsion, airway"), (5, 7, "Your shift, children 5 to 7: trauma, breathing and shock"),
          (8, 10, "Your shift, children 8 to 10: shock, glucose and convulsion"), (11, 14, "Your shift, children 11 to 14: putting it all together")]
for a, b, title in GROUPS:
    blocks = []
    if a == 1:
        blocks.append(timing("Day 3, 15:00 (105 minutes): group work. Each member of the group manages at least one clinical scenario."))
    blocks += [blk for sc in SC if a <= sc["n"] <= b for blk in case(sc)]
    L.append(lesson(title, "Manage each child who comes in, step by step: assess, treat as soon as you find an emergency sign, and reassess.", blocks))

L[-1]["read"].append(timing("Day 3, 16:45 (15 minutes): summary. Discuss the problems you met during the scenarios and how you overcame "
                            "them; your facilitator stresses the points that participants are forgetting. Then the assignments for the next "
                            "day and the course evaluation."))
L[-1]["read"].append(reveal("Which steps did you forget or find hardest in the scenarios?",
                            "Write them down and read that part of the manual again before Module 7. Common ones: checking for severe "
                            "malnutrition before giving fluids, checking the blood glucose in a child with coma or convulsion, and reassessing "
                            "after each treatment.", "Think about it"))

MODULE = module("Module 6: Case management scenarios", 6, L)
