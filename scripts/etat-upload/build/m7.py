# Module 7 of the Sudan ETAT course: Implementing ETAT.
# Facilitator guide, Day 4 08:00-12:00: review of the dehydration questions, ETAT standards,
# plenary discussion (why, who, where, when, what), group work with the resources checklist
# (manual Annex 2) and a plan of action (Table 14), feedback, evaluation and closing.
# The post-test (same questions as the pre-test) and the course evaluation (facilitator
# guide Annex 6) close the course.
from elib import *
from m1 import test_questions, test_exercise

EXERCISES = []
def _ex(e):
    EXERCISES.append(e); return ex(e["id"], e["title"].replace("Sudan ETAT: ", ""))

skip(3400, 3400); mark(3402, 3402)   # module title page

L = []
L.append(lesson("Implementing ETAT: where your work begins",
    "Explain the role of ETAT in the care of seriously ill children and why training alone is not enough.", [
    timing("Day 4, 08:00 (10 minutes): review of the assessment questions on dehydration with the model answers. Then (20 minutes) "
           "Implementing ETAT: introduction and the ETAT standards."),
    H(TX(3402, 3402)),
    *X(3404, 3422),
    LI(3428, 3434),
    H(TX(3436, 3436)), Pp(TX(3437, 3437)),
    {"type": "list", "items": items(3441, 3444) + items(3457, 3468)},
    q("What is needed, besides staff knowledge and skills, to implement ETAT?", ["Nothing else", "Changes to the system of care for children presenting with emergency conditions",
      "A new hospital building"], 1, TX(3417, 3420)),
]))
mark(3436, 3444); mark(3450, 3468)

STANDARDS = [
    ("Layout and structure", ["Children are assessed for severity/priority need (triage) immediately on arrival (at least during high patient-load periods)",
                              "Patients do not have to wait for registration, payment, their turn etc before a first assessment is done and action taken",
                              "A wall chart or job aid for identifying children by severity of condition is located in the emergency admissions area"]),
    ("Staffing", ["A qualified staff is designated to carry out triage",
                  "A health professional is available without delay to manage children determined to have an emergency condition"]),
    ("Drugs, supplies and equipment", ["Essential drugs for emergency conditions (anticonvulsants, glucose, IV fluids) are always available and free",
                                       "Essential lab tests (Hb or PCV, glucose) are available",
                                       "Essential equipment (needles and syringes, nasogastric catheters, oxygen equipment, nebulizer or spacers) is available"]),
    ("Case management", ["The staff doing triage is trained in the guidelines and can implement them appropriately when the emergency room gets busy during peak hours",
                         "Staff is skilled in the management of common emergency conditions and starts treatment without delay: management of convulsions, "
                         "lethargy, severe respiratory distress, shock and severe dehydration"]),
]
L.append(lesson("ETAT standards",
    "Check your hospital against the ETAT standards.", [
    fgnote("Your facilitator presents the ETAT standards from the facilitator guide. Use them later to check the recommendations you make for your hospital."),
    tbl(["Area", "ETAT standard"], [[a, ul(xs)] for a, xs in STANDARDS], "ETAT standards (facilitator guide)"),
    flip("Does your hospital meet the standard?", [(a, " ".join(xs)) for a, xs in STANDARDS]),
    sort("Standard met, or a gap to fix?", ["Meets the ETAT standard", "A gap to fix"], [
        ("A sick child waits to register and pay before anyone looks at her", "A gap to fix"),
        ("A triage wall chart hangs in the emergency admissions area", "Meets the ETAT standard"),
        ("Diazepam and 10% glucose are kept locked in the pharmacy at night", "A gap to fix"),
        ("A nurse is named for triage on every shift", "Meets the ETAT standard"),
    ]),
]))

L.append(lesson("Implementing ETAT in your hospital: why, who, where, when, what",
    "Prepare the arguments, staff, place, patient flow and resources for ETAT in your hospital.", [
    timing("Day 4, 08:30 (30 minutes): plenary discussion, plan ETAT for your own workplace. It starts with the reasons for not "
           "implementing ETAT in peripheral health units, and covers why, who, where, when and what."),
    *X(3470, 3471, h=[3470]),
    LI(3480, 3491),
    *X(3493, 3495),
    tbl([], [[f"<strong>{TX(a, a)}</strong>", TX(b, c)] for a, b, c in
             [(3496, 3498, 3499), (3501, 3503, 3503), (3505, 3507, 3507), (3509, 3511, 3511), (3513, 3515, 3516)]]),
    *X(3518, 3522, h=[3518]),
    *X(3528, 3533, h=[3528]),
    *X(3535, 3540, h=[3535]),
    flip("Plan ETAT for your workplace", [
        ("Why?", "Arguments to implement ETAT (advocacy)"),
        ("Who?", "Staff categories involved in ETAT"),
        ("Where?", "Flow of patients and space and/or accommodation for emergency care"),
        ("When?", "Timing of care"),
        ("What?", "Equipment and supplies needed (material resources)"),
    ]),
]))
mark(3496, 3516)

EQUIP = items(3924, 3935) + items(3941, 3947)
FLUIDS = items(3950, 3956)
CONS = [TX(4008, 4008), TX(4012, 4012)]
def checklist(xs):
    return [[x, "", "", ""] for x in xs]
L.append(lesson("Annex 2: resources required for ETAT",
    "Check which ETAT equipment, fluids, drugs and consumables are available in your hospital.", [
    timing("Day 4 (60 minutes): group work in small groups (hospital or regional groups): brainstorm why, who, where, when and with what; "
           "complete the checklist of resources required to implement ETAT; prepare a summary of findings as recommendations to the hospital "
           "administration; and develop a plan of action. Your facilitator gives feedback on your priority list, using the ETAT standards."),
    H(TX(3901, 3901) + ": " + TX(3903, 3905)),
    *X(3906, 3913),
    tbl(["", TX(3915, 3915), TX(3917, 3917), f"{TX(3919, 3919)} {TX(3921, 3921)}"],
        [[f"<strong>{TX(3923, 3923)}</strong>", "", "", ""]] + checklist(EQUIP)
        + [[f"<strong>{TX(3949, 3949)}</strong>", "", "", ""]] + checklist(FLUIDS)
        + [[f"<strong>{TX(4018, 4018)}</strong>", "", "", ""]] + checklist(CONS)),
    Pp(TX(3958, 3958)),
    tbl([TX(3962, 3962), TX(3964, 3964)], [[f"{n}.", f"{n}."] for n in range(1, 11)]),
    reveal("Print or copy this checklist and tick each item in your hospital, paediatric ward and emergency department. Which items are missing?",
           "List the missing items in order of priority (equipment and consumables), then use your list in the plan of action in the next lesson.",
           "Your turn"),
]))
mark(3915, 4018)

PLAN = _ex(equiz("sudan-etat-plan-of-action", 71, "My plan of action for ETAT", [TX(3539, 3540), "Answer for your own hospital. There is no single right answer."], [
    open_q("p1", TX(3498, 3499), ["Arguments such as preventable death, death within 24 hours after admission, delay in treatment waiting, doctor’s delay, ethics, professional standards, human suffering."]),
    open_q("p2", TX(3503, 3503), ["The staff categories in your hospital who will triage and treat (including ancillary staff such as gate keepers, watchmen, clerks)."]),
    open_q("p3", TX(3507, 3507), ["A place for triage and emergency management near the waiting room, based on a floor map of the departments."]),
    open_q("p4", TX(3511, 3511), ["The patient flow and tasks: triage immediately on arrival, before registration or payment."]),
    open_q("p5", TX(3515, 3516), ["Your priority list of equipment and consumables from the Annex 2 checklist."]),
    open_q("p6", "Plan framework (Table 14): write your objectives and, for each, the activities, time frame (months), requirements, cost, responsible persons and source of funds.",
           ["Objectives", "Activities", "Time frame", "Requirements", "Cost", "Responsible persons", "Source of funds"]),
], minutes=30, source="WHO ETAT manual for participants (2005), Module 7; ETAT facilitator guide, Module 7"))
L.append(lesson("Developing your plan of action",
    "Write an individual plan of action to implement ETAT in your hospital.", [
    *X(3542, 3542, h=[3542]),
    tbl([TX(3549, 3549), TX(3551, 3551), f"{TX(3553, 3553)}<br>{TX(3554, 3554)}", TX(3556, 3556), TX(3558, 3558), TX(3560, 3561), TX(3563, 3564)],
        [["", "", "", "", "", "", ""], ["", "", "", "", "", "", ""]], f"{TX(3545, 3545)}. {TX(3547, 3547)}: {TX(3548, 3548)}"),
    timing("Day 4, 10:15 (60 minutes): feedback from the group work in a plenary session."),
    PLAN,
]))
mark(3545, 3564)

POST = _ex(test_exercise("sudan-etat-post-test", 72, "Post-test (ETAT Pre/Post Test)", "الاختبار البعدي (اختبار ETAT القبلي والبعدي)",
    "Post-test: the same 20 questions as the pre-test. Compare your score with your pre-test score.",
    "اختبار بعدي: نفس الأسئلة العشرين للاختبار القبلي. قارن نتيجتك بنتيجة الاختبار القبلي."))

EVAL_QS = ["What was most useful and can be put into practice?", "What will you not be able to do in your setting?",
           "What was most difficult to understand?", "Was the training clear?", "Was the time adequate?", "For whom is ETAT suitable?",
           "Which type of learning session did you find most helpful?", "Did doing IMCI make ETAT easier?",
           "Did you have enough time to practice the assessment?", "Would ETAT be good for health workers without IMCI training?",
           "Do you now feel prepared to teach ETAT (scale 1-5, where 1 - least confident and 5 - most confident)?",
           "Were there any things the workshop could have included to better prepare you to start ETAT?",
           "Were there any things that could have been done to prepare you better to be an ETAT facilitator?",
           "What part of ETAT do you feel most confident about?", "What part of the ETAT course do you feel least confident about?",
           "Score the utility of the course for your work (scale 1-5)?", "Suggestions/ comments"]
EVAL = _ex(equiz("sudan-etat-course-evaluation", 73, "Course evaluation", [
    "ETAT course evaluation form for participants (facilitator guide, Annex 6). Your honest answers help us improve the course."],
    [open_q(f"e{i}", t, ["Your own answer."]) for i, t in enumerate(EVAL_QS, 1)], minutes=10,
    source="ETAT facilitator guide (2005), Annex 6", pass_mark=0))

L.append(lesson("Post-test, course evaluation and closing",
    "Take the post-test, compare it with your pre-test, and evaluate the course.", [
    timing("Day 4, 11:15 (45 minutes): main findings from the evaluation, course certificates and closing ceremony. Finish 12:00."),
    P_("You have reached the end of the Sudan ETAT course. Take the post-test: it has the same 20 questions as the pre-test."),
    POST,
    H("Course evaluation"),
    EVAL,
    fgnote("Before you use ETAT on your own, your facilitators check that you perform emergency triage assessment and treatment on children "
           "in the clinic with enough skill and confidence, without unacceptable delays, working as a team, and that you have seen the full "
           "range of emergency and priority signs and treatments. If not, more clinical practice is arranged. If possible, a facilitator "
           "accompanies you for your first few days using ETAT at work."),
    video("Closing: ETAT in your hospital", "A closing message for the course.", "ET7.1"),
]))

MODULE = module("Module 7: Implementing ETAT", 7, L)
