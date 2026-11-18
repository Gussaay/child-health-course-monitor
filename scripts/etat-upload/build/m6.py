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

def scenario(sc):
    """One scenario as a story: at each step you choose the correct response to what the facilitator tells you."""
    stages, text, i = [], f"{tidy(sc['intro'])}", 0
    for found, resp in sc["rows"]:
        found, resp = tidy(found), tidy(resp)
        if found:
            text = (text + " " if text else "") + f"Your facilitator tells you: {found}"
        if not resp:
            stages.append(stage(text + "."))
            text = ""
            continue
        # two other responses of similar length as distractors
        others = [p for p in POOL if p.lower() != resp.lower()]
        near = sorted(others, key=lambda p: (abs(len(p) - len(resp)), p))
        d = [near[(sc["n"] + i) % 6], near[(sc["n"] + i + 3) % 6 + 6]]
        k = (sc["n"] + i) % 3
        opts = d[:k] + [resp] + d[k:]
        stages.append(stage(text or "Continue.", "What is the correct response?", opts, k, resp))
        text, i = "", i + 1
    return story(f"Scenario {sc['n']}", stages, "Case management scenario")

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
    sort("What comes first?", ["First", "Later"], [
        ("Assess airway and breathing", "First"),
        ("Ask about diarrhoea", "Later"),
        ("Treat an emergency sign as soon as you find it", "First"),
        ("Assess priority signs", "Later"),
    ]),
]))
mark(3382, 3382)

GROUPS = [(1, 4, "Scenarios 1 to 4: dehydration, convulsion, airway"), (5, 7, "Scenarios 5 to 7: trauma, breathing and shock"),
          (8, 10, "Scenarios 8 to 10: shock, glucose and convulsion"), (11, 14, "Scenarios 11 to 14: putting it all together")]
for a, b, title in GROUPS:
    blocks = []
    if a == 1:
        blocks.append(timing("Day 3, 15:00 (105 minutes): group work. Each member of the group manages at least one clinical scenario."))
    blocks += [scenario(sc) for sc in SC if a <= sc["n"] <= b]
    L.append(lesson(title, "Manage each child step by step: assess, treat as soon as you find an emergency sign, and reassess.", blocks))

L[-1]["read"].append(timing("Day 3, 16:45 (15 minutes): summary. Discuss the problems you met during the scenarios and how you overcame "
                            "them; your facilitator stresses the points that participants are forgetting. Then the assignments for the next "
                            "day and the course evaluation."))
L[-1]["read"].append(reveal("Which steps did you forget or find hardest in the scenarios?",
                            "Write them down and read that part of the manual again before Module 7. Common ones: checking for severe "
                            "malnutrition before giving fluids, checking the blood glucose in a child with coma or convulsion, and reassessing "
                            "after each treatment.", "Think about it"))

MODULE = module("Module 6: Case management scenarios", 6, L)
