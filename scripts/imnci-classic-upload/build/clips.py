# Sudan IMNCI (classic): video clips placed next to the text they show, and the video exercises.
#
# The clips are parts of the edited WHO IMCI training videos on the course YouTube channel
# (/mnt/project-files/imnci-classic/Edited-video-parts-on-YouTube.md). Times are seconds in the
# YouTube part, read from its English captions (2026-11-20). A clip plays only from `start` to `end`.
#
# Video exercises: each child on the video is one question. The learner watches the child, answers,
# and after checking sees the video's own answer for that child.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "imnci-practice"))
import restructure as R
from lib import mcq, SUB

Y = lambda vid: f"https://youtu.be/{vid}"
def C(vid, a, b, title):
    return R.clip(Y(vid), a, b, title)
def V(vid, a, b):
    return {"url": Y(vid), "start": a, "end": b}

# The long videos the clips replace (whole parts shown at the start of a lesson or one after the other).
REPLACED = [
    "tgTZPo6S2gk", "HsqdrLpa7To", "fBZ62ruLo-s", "t-ufkuEWl7A", "B2HFsLNdG88", "sYhidkeeYrQ", "1QzIN3MoFQY", "lpixvQi9T0s",
    "uFrMGfpI1I4", "zWtNkHJ1hEU", "4b-ufTB_9wA", "HHEtaWaq42w", "ODTqkofdJ-8", "7voAv5Zwvj4", "Mub8wkVXn7A",
    "uUuwOEZzxN8", "5GYyG_L0HeQ", "mzuyYQb3ZyU", "wfnsRjoahqs", "BPM94GCFfk8", "zEIX0LSq5EE",
    "EEblq39FEnU", "HdK-Kwm7Vqs", "yQahKgF5zjk", "q7f-wLn004c", "dDGOl-0_rn0",
    "Pw-hmgKVc6w", "MR0gkgH2KIU", "6-Zc9SdxOg4", "4xKwarqMeRk", "Jq2pXIxnzgI", "Qi43VSAWND0",
    "RRcCkTBPnIQ", "wCVZRSvs5qs", "BHtRgGSyUJI", "j6hyN370C9o", "ZLb0LZE6vSA", "cQHlYTWtxdk", "OrmwryshAJw",
    "RpIUMkThi0E", "WoPStoMIJpo", "XELCjw0ZVgs",
]
# Placeholders whose video now exists as clips placed in the lesson.
FILLED_PLACEHOLDERS = ["YI.2"]

M2, M6 = 2, 6
DANGER = "Ask and look for each general danger sign"
COUGH = "Assess cough or difficult breathing: how long, and count the breaths"
CHEST = "Look for chest indrawing, stridor and wheeze"
DIARR = "Assess diarrhoea: how long, blood, general condition, sunken eyes"
FLUID = "Offer fluid and pinch the skin"

YES_NO = ["Yes", "No"]

def vq(qid, text, options, correct, explain, video, answer=None):
    q = mcq(qid, text, options, correct, explain)
    q["video"] = video
    if answer: q["answerVideo"] = answer
    return q

def quiz(eid, order, title, narrative, questions, minutes=10):
    return {"id": eid, "order": order, "title": f"Sudan IMNCI: {title}", "subCourse": SUB, "passMark": 80,
            "estimatedMinutes": minutes, "draft": True, "source": "WHO IMCI training video (edited parts on the course channel)",
            "narrative": list(narrative), "kind": "quiz", "questions": list(questions)}

def link(eid):
    return {"type": "exercise", "exerciseId": eid, "note": ""}

# ---------------------------------------------------------------- video exercises
LETHARGIC = [
    vq("c1a", "Here is the first child. Does this child have the general danger sign lethargic or unconscious?", YES_NO, 1,
       "The first child was wide awake and alert. Therefore, the general danger sign is not present.",
       V("HsqdrLpa7To", 55, 99), V("fBZ62ruLo-s", 79, 93)),
    vq("c1b", "Here is the second child. Does this child have the general danger sign lethargic or unconscious?", YES_NO, 0,
       "This child could not be wakened. He has the danger sign, lethargic or unconscious.",
       V("HsqdrLpa7To", 99, 128), V("fBZ62ruLo-s", 93, 104)),
    vq("c1c", "Here is the third child. Does this child have the general danger sign lethargic or unconscious?", YES_NO, 1,
       "The third child appeared lethargic, but when attempts were made to wake the child, it awoke normally. Some children "
       "sleep very soundly, but can be woken, then they are alert. They do not have the general danger sign, lethargic or unconscious.",
       V("HsqdrLpa7To", 128, 160), V("fBZ62ruLo-s", 104, 142)),
    vq("c1d", "Here is the fourth child. Does this child have the general danger sign lethargic or unconscious?", YES_NO, 0,
       "The fourth child was unconscious. The child did not watch the health worker or stir when attempts were made to wake her. "
       "Even though her eyes are open and moving, she makes no eye contact. Therefore, the general danger sign is present.",
       V("fBZ62ruLo-s", 9, 79), V("fBZ62ruLo-s", 142, 165)),
]
BREATHING = [
    mcq("c2", "Mano is 4 years old. You count 65 breaths per minute. Does Mano have fast breathing?", YES_NO, 0,
        "12 months up to 5 years: 40 breaths per minute or more is fast breathing."),
    mcq("c3", "Wumbi is 6 months old. You count 66 breaths per minute. Does Wumbi have fast breathing?", YES_NO, 0,
        "2 months up to 12 months: 50 breaths per minute or more is fast breathing."),
    vq("c3v", "This child is 7 months old. Count his breaths for one minute: start when the video says \"Start counting now\" and "
              "stop when it says \"Stop counting\". Does he have fast breathing?", YES_NO, 0,
       "The health worker counted 90 breaths per minute. Since the child is 7 months old (cut-off 50), he does have fast breathing.",
       V("t-ufkuEWl7A", 0, 70), V("t-ufkuEWl7A", 70, 78)),
]
INDRAWING = [
    vq("c4a", "Here is the first child. Her name is Mary. Does Mary have chest indrawing?", YES_NO, 1,
       "We saw normal breathing. As the child breathed in, the whole chest wall and abdomen moved out. Therefore there is no chest indrawing.",
       V("uFrMGfpI1I4", 16, 57), V("uFrMGfpI1I4", 57, 79)),
    vq("c4b", "Here is the second child. Her name is Jenna. Does Jenna have chest indrawing?", YES_NO, 0,
       "We saw indrawing movement in the lower chest wall while the rest of the chest and abdomen were moving out. Jenna does have chest indrawing.",
       V("uFrMGfpI1I4", 79, 108), V("uFrMGfpI1I4", 108, 131)),
    vq("c4c", "Here is the third child. His name is Ho. Does Ho have chest indrawing?", YES_NO, 0,
       "We saw indrawing movement in the lower chest wall while the rest of the chest and abdomen were moving out. Ho does have chest indrawing.",
       V("uFrMGfpI1I4", 131, 161), V("uFrMGfpI1I4", 161, 180)),
    vq("c4d", "Here is the fourth child. Her name is Anna. Does Anna have chest indrawing?", YES_NO, 1,
       "We saw normal breathing. As the child breathed in, the whole chest wall and abdomen moved out. There is no chest indrawing.",
       V("zWtNkHJ1hEU", 0, 25), V("zWtNkHJ1hEU", 25, 45)),
    vq("c4e", "Here is the fifth child. Her name is Lo. Does Lo have chest indrawing?", YES_NO, 1,
       "At first it was not clear, so we looked at the child from another angle and decided she does not have chest indrawing. "
       "If you are not sure, decide it is not chest indrawing.",
       V("zWtNkHJ1hEU", 45, 80), V("zWtNkHJ1hEU", 80, 108)),
]
STRIDOR = [
    vq("c5a", "Here is the first child. His name is Petty. Look and listen to his breathing. Does Petty have stridor?", YES_NO, 0,
       "We heard a harsh noise when Petty was breathing in. Therefore Petty does have stridor.",
       V("4b-ufTB_9wA", 15, 88), V("4b-ufTB_9wA", 88, 112)),
    vq("c5b", "Here is the second child. Her name is Helen. Look and listen to her breathing. Does Helen have stridor?", YES_NO, 0,
       "We heard a harsh noise when Helen was breathing in. Therefore Helen does have stridor.",
       V("HHEtaWaq42w", 0, 32), V("HHEtaWaq42w", 32, 45)),
    vq("c5c", "Here is the third child. His name is Simbu. Look and listen to his breathing. Does Simbu have stridor?", YES_NO, 1,
       "We heard a wet noise when Simbu was breathing in and out. He does not have stridor but a blocked nose.",
       V("HHEtaWaq42w", 45, 100), V("HHEtaWaq42w", 100, 119)),
    vq("c5d", "Here is the fourth child. His name is Hassan. Look and listen to his breathing. Does Hassan have stridor?", YES_NO, 1,
       "We heard a wheezing sound when Hassan was breathing out. Stridor is a harsh sound on breathing in. Hassan has wheeze, not stridor.",
       V("HHEtaWaq42w", 119, 170), V("HHEtaWaq42w", 170, 200)),
]
_rev = [  # (question clip in ODTq/7voA, answer clip in Mub8, has indrawing, what the video says)
    (V("ODTqkofdJ-8", 75, 120), V("Mub8wkVXn7A", 11, 33), True, "We saw chest indrawing movement in the lower chest wall while the rest of the chest and abdomen were moving out."),
    (V("ODTqkofdJ-8", 129, 156), V("Mub8wkVXn7A", 37, 58), False, "We saw normal breathing. As the child breathed in, the whole chest wall and abdomen moved out."),
    (V("ODTqkofdJ-8", 165, 200), V("Mub8wkVXn7A", 61, 84), True, "We saw indrawing movement in the lower chest wall while the rest of the chest and abdomen were moving out."),
    (V("7voAv5Zwvj4", 30, 57), V("Mub8wkVXn7A", 88, 109), True, "We saw indrawing movement in the lower chest wall while the rest of the chest and abdomen were moving out."),
    (V("7voAv5Zwvj4", 68, 95), V("Mub8wkVXn7A", 113, 133), False, "We saw normal breathing. As the child breathed in, the whole chest wall and abdomen moved out."),
    (V("7voAv5Zwvj4", 105, 132), V("Mub8wkVXn7A", 136, 158), True, "We saw indrawing movement in the lower chest wall while the rest of the chest and abdomen were moving out."),
    (V("7voAv5Zwvj4", 142, 170), V("Mub8wkVXn7A", 160, 181), False, "We saw only some indrawing between the ribs. We did not see indrawing of the lower chest wall, so it is not chest indrawing."),
]
ORD = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh"]
REVIEW = [vq(f"c6{chr(97 + i)}", f"Here is the {ORD[i]} child. Does this child have chest indrawing?", YES_NO, 0 if yes else 1, say, qv, av)
          for i, (qv, av, yes, say) in enumerate(_rev)]

SUNKEN = [
    vq("g1e", "Here is the fifth child. Are the child's eyes sunken?", YES_NO, 0, "We decided that the eyes were sunken.",
       V("zEIX0LSq5EE", 0, 40), V("zEIX0LSq5EE", 148, 160)),
    vq("g1f", "Here is the sixth child. Are the child's eyes sunken?", YES_NO, 1, "We decided that this child did not have sunken eyes.",
       V("zEIX0LSq5EE", 46, 66), V("zEIX0LSq5EE", 163, 175)),
]
PINCH_OPTS = ["Very slowly (longer than 2 seconds)", "Slowly", "Immediately"]
_pinch = [((80, 103), (9, 25), 1, "We decided that the skin went back slowly. You can see tenting of the skin after the pinch is released."),
          ((103, 119), (34, 50), 2, "We decided that the skin went back immediately."),
          ((119, 137), (58, 76), 0, "We decided that the skin went back very slowly."),
          ((137, 154), (76, 94), 1, "We decided that the skin went back slowly."),
          ((154, 178), (94, 112), 0, "We decided that the skin went back very slowly, taking longer than 2 seconds.")]
PINCH = [vq(f"g2{chr(97 + i)}", f"Skin pinch, example {i + 1}. Does the skin go back very slowly, slowly or immediately?", PINCH_OPTS, k, say,
            V("uUuwOEZzxN8", *q), V("5GYyG_L0HeQ", *a)) for i, (q, a, k, say) in enumerate(_pinch)]
CASE_G = [vq("g3", "Now assess this child with diarrhoea. Watch his signs, then classify his dehydration.",
             ["Severe dehydration", "Some dehydration", "No dehydration"], 1,
             "He is restless and irritable, his eyes are sunken, he drinks eagerly and his skin pinch goes back slowly. He has only one "
             "sign of the pink row and more than two signs of the yellow row: diarrhoea with some dehydration. No persistent diarrhoea or dysentery.",
             V("BPM94GCFfk8", 48, 104), V("BPM94GCFfk8", 104, 200))]

ABDI = [
    vq("a1", "Count the breaths Abdi takes in one minute: start when the video says \"Start counting\", stop at \"Now stop counting\". "
             "Abdi is less than 2 months old. What do you do with your count?",
       ["It is less than 60: no fast breathing", "It is 60 or more: repeat the count, and if it is again 60 or more Abdi has fast breathing"], 1,
       "We counted 70 breaths per minute. As Abdi is less than 2 months old and we counted 60 breaths per minute or more, repeat the count. "
       "If you again count 60 breaths or more, Abdi has fast breathing.", V("HdK-Kwm7Vqs", 17, 104), V("HdK-Kwm7Vqs", 102, 130)),
    vq("a2", "Now look for chest indrawing. Does Abdi have severe chest indrawing?", YES_NO, 0,
       "Abdi has severe chest indrawing. The indrawing is deep and easy to see.", V("HdK-Kwm7Vqs", 129, 150), V("HdK-Kwm7Vqs", 150, 167)),
]

EXERCISES = {
    # the existing Exercise C now holds part 1 (lethargic or unconscious); its id keeps earlier attempts linked
    "sudan-imnci-ac-ex-c-video": ("questions", LETHARGIC),
    "sudan-imnci-ac-ex-g-video": ("questions", SUNKEN + PINCH + CASE_G),
}
NEW_EXERCISES = [
    quiz("sudan-imnci-ac-ex-c-breathing", 107.1, "Exercise C, part 2: fast breathing (video)",
         ["Decide if each child has fast breathing. For the child on the video, count the breaths yourself."], BREATHING, 5),
    quiz("sudan-imnci-ac-ex-c-indrawing", 107.2, "Exercise C, part 3: chest indrawing (video)",
         ["You will see five children. After seeing each child, decide if the child has chest indrawing."], INDRAWING, 8),
    quiz("sudan-imnci-ac-ex-c-stridor", 107.3, "Exercise C, part 4: stridor (video)",
         ["You will see four children who have stridor, a simple cold or other respiratory noises. Decide if each child has stridor."], STRIDOR, 8),
    quiz("sudan-imnci-ac-ex-c-indrawing-review", 107.4, "Exercise C, part 5: review of chest indrawing (video)",
         ["You will see seven children. After seeing each child, decide if chest indrawing is present."], REVIEW, 10),
    quiz("sudan-imnci-yi-ex-a-video", 500.5, "Sick young infant, Exercise A, part 1: Abdi (video)",
         ["Watch how the health worker assesses Abdi, a young infant, for fast breathing and chest indrawing."], ABDI, 5),
]

def fix_table_tail(pkg):
    """The comment for photograph 79 in the Exercise G table ("... lower lip not turned out, areola equal above and
    below") was cut at the page end: its last words opened the next lesson. They go back to the end of the comment."""
    secs = {s["title"]: s for s in pkg["modules"][M6 - 1]["sections"]}
    g, h = secs["Exercise G: positioning and attachment"], secs["3.7 Advise the mother to give home care for the young infant"]
    if h["read"] and h["read"][0]["type"] == "paragraph" and h["read"][0]["text"].strip() == "equal above and below":
        h["read"].pop(0)
        for b in g["read"]:
            if b["type"] == "paragraph" and b["text"].strip() == "turned out, areola":
                b["text"] = "turned out, areola equal above and below"

def apply(pkg):
    """Called by build.py after the book text, activities and video links are in place."""
    fix_table_tail(pkg)
    R.drop_videos(pkg, REPLACED)
    for m in pkg["modules"]:
        for s in m["sections"]:
            s["read"] = [b for b in s["read"] if not (b["type"] == "video" and b.get("script") in FILLED_PLACEHOLDERS)]
    # exercises
    ex = {e["id"]: e for e in pkg["exercises"]}
    for eid, (field, val) in EXERCISES.items():
        ex[eid][field] = list(val)
    ex["sudan-imnci-ac-ex-g-video"]["narrative"] = ex["sudan-imnci-ac-ex-g-video"]["narrative"] + [
        "Children 1 to 4 of the sunken eyes part are not on the video yet; the exercise starts at the fifth child."]
    pkg["exercises"] += NEW_EXERCISES

    P = lambda *a, **k: R.place(pkg, *a, **k)
    # Module 2: general danger signs, one sign at a time
    P(M2, "Check for general danger signs", "A child with a general danger sign has a serious problem.",
      [C("tgTZPo6S2gk", 7, 42, "Why a general danger sign is serious")])
    P(M2, DANGER, "A child who is breastfed may have difficulty sucking", [C("tgTZPo6S2gk", 42, 89, "Not able to drink or breastfeed")])
    P(M2, DANGER, "If the mother is not sure if the child is vomiting everything", [C("tgTZPo6S2gk", 89, 108, "Vomits everything")])
    P(M2, DANGER, "Ask the mother if the child has had convulsions during this current illness", [C("tgTZPo6S2gk", 107, 148, "Convulsions")])
    P(M2, DANGER, "Note: If the child is sleeping and has cough", [C("tgTZPo6S2gk", 148, 215, "Lethargic or unconscious")])
    P(M2, DANGER, "If the child has a general danger sign refer", [C("tgTZPo6S2gk", 215, 235, "If a general danger sign is present")])
    # cough or difficult breathing
    P(M2, COUGH, "A child who has a cough or difficulty breathing for more than 2 weeks",
      [C("B2HFsLNdG88", 25, 94, "Ask about cough or difficult breathing, and for how long")])
    P(M2, COUGH, "Note: The child who is exactly 12 months old",
      [C("B2HFsLNdG88", 94, 175, "Fast breathing and its cut-off by age"),
       C("sYhidkeeYrQ", 0, 172, "Counting the breaths of a child of 7 months")])
    P(M2, CHEST, "If you did not lift the child's shirt", [C("1QzIN3MoFQY", 3, 184, "Chest indrawing")])
    P(M2, CHEST, "Stridor is a harsh noise made when the child breathes IN", [C("lpixvQi9T0s", 8, 179, "Stridor")])
    P(M2, "Exercise C: video exercise", "sudan-imnci-ac-ex-c-video",
      [link("sudan-imnci-ac-ex-c-breathing"), link("sudan-imnci-ac-ex-c-indrawing"), link("sudan-imnci-ac-ex-c-stridor"),
       link("sudan-imnci-ac-ex-c-indrawing-review")])
    # diarrhoea
    P(M2, DIARR, "ASK: Does the child have diarrhea? Use words", [C("mzuyYQb3ZyU", 74, 113, "Ask about diarrhoea: how long, and blood in the stool")])
    P(M2, DIARR, "LOOK & FEEL for Child's general condition", [C("mzuyYQb3ZyU", 113, 180, "The child's general condition")],
      item="LOOK & FEEL for Child's general condition")
    P(M2, DIARR, "LOOK for Sunken eyes", [C("wfnsRjoahqs", 0, 38, "Sunken eyes")])
    P(M2, FLUID, "OFFER the child fluid", [C("wfnsRjoahqs", 38, 86, "Offer the child fluid")], item="OFFER the child fluid")
    P(M2, FLUID, "PINCH the skin of the abdomen", [C("wfnsRjoahqs", 86, 175, "The skin pinch"),
                                                 C("BPM94GCFfk8", 0, 26, "Very slowly, slowly or immediately")])
    # Module 6: the sick young infant
    YI1 = "1.0 and 1.1 Check for possible bacterial infection or very severe disease"
    P(M6, YI1, "ASK: the mother these questions:", [C("EEblq39FEnU", 53, 86, "Ask: difficulty feeding, and convulsions")], item="Is the infant able to feed?")
    P(M6, YI1, "Does the young infant move on his or her own?", [C("yQahKgF5zjk", 86, 169, "Movements of the young infant"),
                                                            C("q7f-wLn004c", 0, 58, "No movement, or movement only when stimulated")],
      item="Does the young infant move on his or her own?")
    P(M6, YI1, "Count the breaths in one minute. Repeat the count", [C("EEblq39FEnU", 86, 170, "Fast breathing in a young infant")],
      item="Count the breaths in one minute.")
    P(M6, YI1, "Severe chest indrawing. Look for chest indrawing", [C("EEblq39FEnU", 170, 191, "Mild and severe chest indrawing"),
                                                               C("HdK-Kwm7Vqs", 0, 17, "Severe chest indrawing")], item="Severe chest indrawing.")
    P(M6, YI1, "Measure temperature (or feel for fever", [C("yQahKgF5zjk", 0, 31, "Fever and low body temperature")], item="Measure temperature")
    P(M6, YI1, "The umbilicus - is it red or draining pus?", [C("yQahKgF5zjk", 31, 63, "The umbilicus")], item="The umbilicus")
    P(M6, YI1, "Any pus draining from the eye", [C("dDGOl-0_rn0", 76, 114, "Pus draining from the eye")], item="Any pus draining from the eye")
    P(M6, YI1, "Any skin pustules.", [C("yQahKgF5zjk", 63, 86, "Skin pustules")])
    P(M6, "Exercise A: video and photographs of young infants", "Part 1 - Video", [link("sudan-imnci-yi-ex-a-video")])
    JA = "1.2 Check for jaundice"
    P(M6, JA, "Look, Ask and check : Does the infant have jaundice", [C("q7f-wLn004c", 58, 174, "Looking for jaundice")],
      item="Look, Ask and check : Does the infant have jaundice")
    P(M6, JA, "Look and check: Is jaundice extending to palms and soles", [C("dDGOl-0_rn0", 0, 76, "Jaundice on the palms and soles")])
    P(M6, "1.4 Check for feeding problem or low weight", "Is there any difficulty feeding? Any difficulty mentioned",
      [C("Pw-hmgKVc6w", 0, 57, "Ask about feeding")])
    BF = "1.4.2 Assess breastfeeding"
    P(M6, BF, "If the infant has not fed in the previous hour , he may be willing", [C("Pw-hmgKVc6w", 82, 117, "Has the infant breastfed in the previous hour?")])
    P(M6, BF, "If all of these four signs are present, the infant has good attachment.",
      [C("Pw-hmgKVc6w", 116, 186, "Good attachment: chin and mouth"), C("MR0gkgH2KIU", 0, 84, "Good attachment: lower lip and areola")])
    P(M6, BF, "If a very sick infant cannot take the nipple", [C("MR0gkgH2KIU", 84, 170, "Suckling effectively"),
                                                           C("6-Zc9SdxOg4", 63, 112, "Ulcers or white patches in the mouth")],
      item="Is the infant suckling effectively?")
    P(M6, "Exercise D: attachment for breastfeeding", "In this exercise you will practice recognizing signs of good and poor attachment",
      [C("MR0gkgH2KIU", 170, 181, "A young infant at the breast"), C("6-Zc9SdxOg4", 0, 63, "Is this young infant well attached?")])
    P(M6, "3.0 to 3.2 Oral antibiotic and first dose of intramuscular antibiotics", "Follow the steps on TREAT THE CHILD chart",
      [C("RRcCkTBPnIQ", 0, 175, "Preparing and giving oral amoxicillin (part 1 of 2)"),
       C("wCVZRSvs5qs", 0, 205, "Preparing and giving oral amoxicillin (part 2 of 2)")])
    PA = "3.6 Teach correct positioning and attachment for breastfeeding"
    P(M6, PA, "Improving Positionning and Attachment", [C("BHtRgGSyUJI", 0, 122, "Good and poor positioning")])
    P(M6, PA, "Show the mother how to hold her infant", [C("BHtRgGSyUJI", 122, 181, "Helping the mother to position her infant"),
                                                     C("j6hyN370C9o", 0, 155, "Helping the infant to attach")])
    P(M6, PA, "To teach mother how to express breast milk", [C("RpIUMkThi0E", 0, 166, "Expressing breast milk")])
    P(M6, "Exercise G: positioning and attachment", "You will watch a video demonstration of the steps",
      [C("cQHlYTWtxdk", 0, 182, "The steps to help a mother improve positioning and attachment"),
       C("OrmwryshAJw", 0, 28, "After the breastfeed")])
    HC = "3.7 Advise the mother to give home care for the young infant"
    P(M6, HC, "Put a cloth on the infant", [C("WoPStoMIJpo", 119, 169, "Feeding a young infant who cannot breastfeed"),
                                        C("XELCjw0ZVgs", 0, 92, "Cup feeding")])
    P(M6, HC + " (part 2)", "Teach the Mother How to Keep the Low Weight Infant Warm at Home",
      [C("WoPStoMIJpo", 0, 119, "Keeping the young infant warm: skin-to-skin contact")])
