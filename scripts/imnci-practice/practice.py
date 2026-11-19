# Practice activities shared by both IMNCI courses (the WHO distance-learning
# modules and the Sudan classic course), built the way the WHO Academy IMCI
# course practises: a named child, the chart booklet table and the child's
# filled recording form one tap away, a decision, and feedback on each option.
#
#   python3 practice.py            writes cases.json (every case with the signs it is checked against)
#
# Every practice case carries `check`: the ticks the app's own classification
# engine is given (tests/imnciPracticeCases.test.js). The test fails if the
# engine, read with the Sudan national protocol, does not give the classification
# the case teaches, so a case can never teach a classification the app would
# not give. `check` is removed before a block goes into a course file.
#
# Wording follows the Sudan national chart booklet (src/components/chartBooklet.js
# and the national protocol in the app).
import copy, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))

# -----------------------------------------------------------------------------
# Block helpers
# -----------------------------------------------------------------------------

def note(text, label):
    return {"type": "note", "text": text, "label": label}

def opener(text, options, answer, feedback, explanation=""):
    """The opening question of a lesson: think first, no score that matters."""
    b = {"type": "question", "label": "Before you start", "text": text, "options": list(options), "answer": answer,
         "feedback": list(feedback)}
    if explanation: b["explanation"] = explanation
    return b

def q(text, options, answer, feedback=(), explanation="", label=None, answers=None):
    b = {"type": "question", "text": text, "options": list(options), "explanation": explanation}
    if answers: b["answers"] = list(answers)
    else: b["answer"] = answer
    if feedback: b["feedback"] = list(feedback)
    if label: b["label"] = label
    return b

def child(name, age, weight=None, temp=None, problem="", length=None, muac=None, visit="initial"):
    c = {"name": name, "age": age, "visit": visit}
    if weight is not None: c["weight"] = weight
    if temp is not None: c["temp"] = temp
    if length is not None: c["length"] = length
    if muac is not None: c["muac"] = muac
    if problem: c["problem"] = problem
    return c

def sec(title, lines, classify=()):
    s = {"title": title, "lines": list(lines)}
    if classify: s["classify"] = list(classify)
    return s

def wrong(text, why):
    return {"text": text, "why": why, "error": True}

def ok(text, why):
    return {"text": text, "why": why}

def case(cid, ch, text, record, question, options, feedback, explanation, check, answer=None, answers=None):
    c = {"id": cid, "child": ch, "text": text, "record": record, "question": question, "options": list(options),
         "feedback": list(feedback), "explanation": explanation, "check": check}
    if answers: c["answers"] = list(answers)
    else: c["answer"] = answer
    return c

def chk(part, ticks, expect, z="-2 Z or more", temp="", weight=10, age=12, right=None):
    return {"part": part, "ticks": ticks, "z": z, "temp": temp, "weight": weight, "age": age, "expect": expect,
            "right": right or [l for v in expect.values() for l in v]}

def strip(b):
    """A block as it goes into a course file: no checks, no ids."""
    b = copy.deepcopy(b)
    for c in b.get("cases", []):
        c.pop("check", None); c.pop("id", None)
    b.pop("check", None)
    return b

# -----------------------------------------------------------------------------
# Practice cases: sick child, 2 months up to 5 years
# -----------------------------------------------------------------------------

NO_DANGER = "No general danger sign"

DANGER = [
    case("danger-huda", child("Huda", "2 years", 11, 37.2, "Vomiting"),
         "Huda's mother says Huda has vomited since this morning. When you ask, she says Huda vomits everything she eats or drinks, "
         "even water. Huda is awake and looks at you. She has had no convulsions.",
         [sec("Check for general danger signs", ["Not able to drink or breastfeed: no", "Vomits everything: yes",
                                                 "Convulsions: no", "Lethargic or unconscious: no", "Convulsing now: no"],
              ["General danger sign present"])],
         "Does Huda have a general danger sign?",
         ["Yes: she vomits everything", "No: she is awake and alert", "Not sure until you count her breaths"],
         ["Right. A child who cannot keep anything down vomits everything. This is a general danger sign.",
          "Being awake does not rule out a danger sign. Huda vomits everything, even water.",
          "Breathing is part of the cough assessment. The danger signs are checked first, and Huda already has one."],
         "A child with any general danger sign needs URGENT attention: complete the assessment and any pre-referral "
         "treatment immediately, then refer.",
         chk("child", {"vomitsEverything": True}, {"danger": ["General danger sign present"]}), answer=0),
    case("danger-adam", child("Adam", "3 years", 13, 38.6, "Fever"),
         "Adam has had fever for 2 days. His father says that last night Adam's arms and legs jerked and he did not respond for a "
         "few minutes. Now Adam is drinking and looks at you.",
         [sec("Check for general danger signs", ["Not able to drink: no", "Vomits everything: no",
                                                 "Convulsions: yes, last night", "Lethargic or unconscious: no"],
              ["General danger sign present"])],
         "Adam is drinking and alert now. Does he have a general danger sign?",
         ["No, because he is alert now", "Yes: convulsions during this illness", "Only if he convulses in the clinic"],
         ["A convulsion during this illness is a general danger sign even if the child looks well now.",
          "Right. Convulsions during the current illness are a general danger sign.",
          "Convulsing now is one sign; a history of convulsions in this illness is another. Either one is a danger sign."],
         "Ask about convulsions in every sick child: \"Has the child had convulsions during this illness?\"",
         chk("child", {"historyOfConvulsions": True, "hasFever": True, "malariaTest": "negative"},
             {"danger": ["General danger sign present"]}), answer=1),
    case("danger-mai", child("Mai", "13 months", 9, 37.0, "Cough"),
         "Mai has a cough. She is sleeping on her mother's lap. When her mother speaks to her, she wakes, looks around and "
         "breastfeeds well. She has not vomited and has had no convulsions.",
         [sec("Check for general danger signs", ["Able to breastfeed: yes", "Vomits everything: no", "Convulsions: no",
                                                 "Lethargic or unconscious: no, wakes easily"], [NO_DANGER])],
         "Is Mai lethargic?",
         ["Yes: she was asleep", "No: she wakes easily and breastfeeds", "Yes, because she has a cough"],
         ["A sleeping child is not lethargic if she wakes when spoken to and looks around. Wake the child and look.",
          "Right. A lethargic child is not alert when she should be and does not look at her mother. Mai wakes and feeds.",
          "Cough is not a danger sign. Check each danger sign on its own."],
         "Mai has no general danger sign. Go on to assess her cough.",
         chk("child", {"hasCough": True}, {"danger": [], "cough": ["Cough or Cold"]}, age=13, right=["No: she wakes easily and breastfeeds"]),
         answer=1),
]

COUGH = [
    case("cough-amna", child("Amna", "18 months", 10, 37.0, "Cough for 3 days"),
         "Amna has coughed for 3 days. She has no general danger sign. You count 46 breaths in one minute. There is no chest "
         "indrawing and no stridor.",
         [sec("Check for general danger signs", ["None"]),
          sec("Does the child have cough or difficult breathing? Yes", ["For how long? 3 days", "Count the breaths: 46 per minute",
                                                                      "Fast breathing: yes", "Chest indrawing: no", "Stridor: no"],
              ["PNEUMONIA"])],
         "How do you classify Amna's cough?",
         ["SEVERE PNEUMONIA OR VERY SEVERE DISEASE", "PNEUMONIA", "COUGH OR COLD"],
         ["That needs a general danger sign or stridor in a calm child. Amna has neither.",
          "Right. At 18 months fast breathing is 40 breaths per minute or more. 46 is fast breathing.",
          "Look at her age: from 12 months up to 5 years, 40 or more is fast. 46 is fast breathing, a sign of pneumonia."],
         "Fast breathing: 50 or more from 2 up to 12 months; 40 or more from 12 months up to 5 years.",
         chk("child", {"hasCough": True, "fastBreathing": True}, {"cough": ["Pneumonia"]}, age=18), answer=1),
    case("cough-khalid", child("Khalid", "7 months", 7.5, 37.3, "Cough for 2 days"),
         "Khalid has coughed for 2 days. He has no general danger sign. You count 48 breaths in one minute. There is no chest "
         "indrawing and no stridor.",
         [sec("Does the child have cough or difficult breathing? Yes", ["For how long? 2 days", "Count the breaths: 48 per minute",
                                                                      "Fast breathing: no", "Chest indrawing: no", "Stridor: no"],
              ["COUGH OR COLD"])],
         "How do you classify Khalid's cough?",
         ["PNEUMONIA", "COUGH OR COLD", "SEVERE PNEUMONIA OR VERY SEVERE DISEASE"],
         ["Check the cut-off for his age. From 2 up to 12 months fast breathing is 50 or more. 48 is not fast.",
          "Right. Khalid is 7 months old, so fast breathing is 50 or more. 48 is not fast, and he has no other sign.",
          "Khalid has no general danger sign and no stridor."],
         "Use the child's age to choose the cut-off. The same count can be fast for one child and not for another.",
         chk("child", {"hasCough": True}, {"cough": ["Cough or Cold"]}, age=7, weight=7.5), answer=1),
    case("cough-sara", child("Sara", "3 years", 13, 37.8, "Cough and not drinking"),
         "Sara has coughed for 5 days. Her mother says that since yesterday Sara is not able to drink anything. You count 44 "
         "breaths per minute and see chest indrawing.",
         [sec("Check for general danger signs", ["Not able to drink or breastfeed: yes"], ["General danger sign present"]),
          sec("Does the child have cough or difficult breathing? Yes", ["For how long? 5 days", "44 breaths per minute: fast breathing",
                                                                      "Chest indrawing: yes", "Stridor: no"],
              ["SEVERE PNEUMONIA OR VERY SEVERE DISEASE"])],
         "How do you classify Sara's cough?",
         ["PNEUMONIA, because of fast breathing and chest indrawing", "SEVERE PNEUMONIA OR VERY SEVERE DISEASE", "COUGH OR COLD"],
         ["Fast breathing and chest indrawing are signs of pneumonia, but read the table from the top: Sara has a general danger sign.",
          "Right. Any general danger sign puts a child with cough in the pink row. Sara is not able to drink.",
          "Sara has several signs. Start at the pink row."],
         "Read the classification table from the top down and take the first row that fits.",
         chk("child", {"hasCough": True, "notAbleToDrink": True, "fastBreathing": True, "chestIndrawing": True},
             {"cough": ["Severe Pneumonia or Very Severe Disease"]}, age=36, weight=13), answer=1),
    case("cough-omer", child("Omer", "2 years", 12, 37.1, "Cough"),
         "Omer has coughed for 4 days. He has no general danger sign. You count 36 breaths per minute, but you see that his lower "
         "chest wall goes in when he breathes in. He is calm and has no stridor.",
         [sec("Does the child have cough or difficult breathing? Yes", ["For how long? 4 days", "36 breaths per minute: not fast",
                                                                      "Chest indrawing: yes", "Stridor: no"], ["PNEUMONIA"])],
         "Which signs does Omer have that need treatment? Select all that apply.",
         ["Fast breathing", "Chest indrawing", "Stridor in a calm child", "None: his breathing is not fast"],
         ["36 is not fast at 2 years: fast is 40 or more.",
          "Right. Chest indrawing is a sign of pneumonia, even when the breathing is not fast.",
          "Omer is calm and you hear no stridor.",
          "His breathing is not fast, but he has chest indrawing."],
         "In the Sudan chart booklet, chest indrawing OR fast breathing classifies PNEUMONIA. Omer needs oral amoxicillin for 5 days.",
         chk("child", {"hasCough": True, "chestIndrawing": True}, {"cough": ["Pneumonia"]}, age=24, weight=12,
             right=["Chest indrawing"]), answers=[1]),
]

DIARRHOEA = [
    case("diar-hiba", child("Hiba", "14 months", 9, 37.4, "Diarrhoea for 3 days"),
         "Hiba has had diarrhoea for 3 days, with no blood. She is restless and irritable. Her eyes are sunken. When you offer "
         "her water, she drinks eagerly. The skin pinch goes back immediately.",
         [sec("Does the child have diarrhoea? Yes", ["For how long? 3 days", "Blood in the stool: no", "Restless, irritable: yes",
                                                     "Sunken eyes: yes", "Drinks eagerly, thirsty: yes", "Skin pinch: goes back immediately"],
              ["SOME DEHYDRATION"])],
         "How do you classify Hiba's dehydration?",
         ["SEVERE DEHYDRATION", "SOME DEHYDRATION", "NO DEHYDRATION"],
         ["Hiba has none of the pink-row signs except sunken eyes. Two pink-row signs are needed.",
          "Right. She has restless and irritable, sunken eyes and drinks eagerly: two or more signs of the yellow row.",
          "Hiba has three signs of the yellow row, more than enough to classify SOME DEHYDRATION."],
         "Some dehydration: give fluid, zinc supplements and food for some dehydration (Plan B).",
         chk("child", {"hasDiarrhea": True, "diarrheaDays": 3, "restlessIrritable": True, "sunkenEyes": True, "drinkEagerly": True},
             {"diarrhea": ["Some Dehydration"]}, age=14, weight=9), answer=1),
    case("diar-yousif", child("Yousif", "9 months", 7, 37.0, "Diarrhoea"),
         "Yousif has had watery diarrhoea for 2 days. He is lethargic. His eyes are sunken. When you offer water, he drinks "
         "poorly. The skin pinch goes back very slowly.",
         [sec("Does the child have diarrhoea? Yes", ["For how long? 2 days", "Lethargic: yes", "Sunken eyes: yes",
                                                     "Drinking poorly: yes", "Skin pinch: goes back very slowly"],
              ["SEVERE DEHYDRATION"])],
         "How do you classify Yousif's dehydration?",
         ["SEVERE DEHYDRATION", "SOME DEHYDRATION", "NO DEHYDRATION"],
         ["Right. He has all four signs of the pink row; two are enough.",
          "Start at the top row. Two pink-row signs classify SEVERE DEHYDRATION.",
          "Yousif has every sign of severe dehydration."],
         "Lethargic is also a general danger sign. If the child has no other severe classification, give fluid for severe "
         "dehydration (Plan C).",
         chk("child", {"hasDiarrhea": True, "diarrheaDays": 2, "lethargicUnconscious": True, "sunkenEyes": True, "drinkPoorly": True,
                       "pinchVerySlow": True}, {"diarrhea": ["Severe Dehydration"]}, age=9, weight=7), answer=0),
    case("diar-rayan", child("Rayan", "2 years", 11.5, 37.2, "Diarrhoea for 16 days"),
         "Rayan has had diarrhoea for 16 days, with no blood. He is alert, his eyes are not sunken, he drinks normally and the "
         "skin pinch goes back immediately.",
         [sec("Does the child have diarrhoea? Yes", ["For how long? 16 days", "Blood in the stool: no", "No signs of dehydration"],
              ["NO DEHYDRATION", "PERSISTENT DIARRHOEA"])],
         "Which classifications does Rayan have for his diarrhoea? Select all that apply.",
         ["SEVERE PERSISTENT DIARRHOEA", "PERSISTENT DIARRHOEA", "NO DEHYDRATION", "DYSENTERY"],
         ["Severe persistent diarrhoea needs dehydration as well. Rayan has no dehydration.",
          "Right. Diarrhoea for 14 days or more with no dehydration is PERSISTENT DIARRHOEA.",
          "Right. Classify dehydration for every child with diarrhoea. Rayan has no signs, so NO DEHYDRATION.",
          "There is no blood in the stool."],
         "A child with diarrhoea is classified for dehydration, and also for persistent diarrhoea if it has lasted 14 days or more, "
         "and for dysentery if there is blood in the stool.",
         chk("child", {"hasDiarrhea": True, "diarrheaDays": 16}, {"diarrhea": ["No Dehydration"],
                                                                  "persistent_diarrhea": ["Persistent Diarrhoea"]}, age=24, weight=11.5),
         answers=[1, 2]),
    case("diar-nour", child("Nour", "3 years", 13, 37.6, "Diarrhoea with blood"),
         "Nour has had diarrhoea for 5 days and her mother has seen blood in the stool. Nour is restless and irritable and her "
         "eyes are sunken. She drinks normally and the skin pinch goes back immediately.",
         [sec("Does the child have diarrhoea? Yes", ["For how long? 5 days", "Blood in the stool: yes", "Restless, irritable: yes",
                                                     "Sunken eyes: yes"], ["SOME DEHYDRATION", "DYSENTERY"])],
         "Which classifications does Nour have? Select all that apply.",
         ["SEVERE DEHYDRATION", "SOME DEHYDRATION", "NO DEHYDRATION", "DYSENTERY"],
         ["Nour has only one pink-row sign (sunken eyes).",
          "Right. Restless and irritable plus sunken eyes are two yellow-row signs.",
          "She has two signs of the yellow row, so she is dehydrated.",
          "Right. Blood in the stool classifies DYSENTERY."],
         "Nour needs Plan B, zinc, and an antibiotic for dysentery (oral ciprofloxacin for 3 days in the Sudan booklet).",
         chk("child", {"hasDiarrhea": True, "diarrheaDays": 5, "bloodInStool": True, "restlessIrritable": True, "sunkenEyes": True},
             {"diarrhea": ["Some Dehydration"], "dysentery": ["Dysentery"]}, age=36, weight=13), answers=[1, 3]),
]

FEVER = [
    case("fever-ahmed", child("Ahmed", "2 years", 12, 38.5, "Fever for 2 days"),
         "Ahmed has had fever for 2 days. He has no general danger sign and no stiff neck. There are no signs of measles. "
         "His malaria rapid diagnostic test (RDT) is positive.",
         [sec("Does the child have fever? Yes", ["For how long? 2 days", "Stiff neck: no", "Malaria test: positive",
                                                 "Measles now or in the last 3 months: no"], ["MALARIA"])],
         "How do you classify Ahmed's fever?",
         ["VERY SEVERE FEBRILE DISEASE", "MALARIA", "FEVER - NO MALARIA"],
         ["He has no general danger sign and no stiff neck.",
          "Right. A positive malaria test classifies MALARIA.",
          "The malaria test is positive, so this is not \"no malaria\"."],
         "Do a malaria test for every child with fever, and classify from the result.",
         chk("child", {"hasFever": True, "malariaTest": "positive"}, {"fever": ["Malaria"]}, age=24, weight=12), answer=1),
    case("fever-salma", child("Salma", "11 months", 8, 38.2, "Fever since yesterday"),
         "Salma has had fever since yesterday. She has no general danger sign and no stiff neck. There is no rash. Her malaria "
         "test is negative.",
         [sec("Does the child have fever? Yes", ["For how long? 1 day", "Stiff neck: no", "Malaria test: negative"],
              ["FEVER - NO MALARIA"])],
         "How do you classify Salma's fever?",
         ["MALARIA", "FEVER - NO MALARIA", "VERY SEVERE FEBRILE DISEASE"],
         ["The malaria test is negative. Do not classify malaria without a positive test.",
          "Right. A negative malaria test with no danger sign or stiff neck: FEVER - NO MALARIA.",
          "Salma has no general danger sign and no stiff neck."],
         "For FEVER - NO MALARIA, look for and treat any other cause of fever, and give paracetamol for high fever.",
         chk("child", {"hasFever": True, "malariaTest": "negative"}, {"fever": ["Fever - No Malaria"]}, age=11, weight=8), answer=1),
    case("fever-mustafa", child("Mustafa", "4 years", 15, 39.0, "Fever and headache"),
         "Mustafa has had fever for 3 days. He has no general danger sign. When you ask him to look at his umbilicus, he cannot "
         "bend his neck forward: he has a stiff neck.",
         [sec("Does the child have fever? Yes", ["For how long? 3 days", "Stiff neck: yes"], ["VERY SEVERE FEBRILE DISEASE"])],
         "How do you classify Mustafa's fever?",
         ["MALARIA, if the test is positive", "VERY SEVERE FEBRILE DISEASE", "FEVER - NO MALARIA"],
         ["Even with a positive test, a stiff neck puts the child in the pink row.",
          "Right. A stiff neck classifies VERY SEVERE FEBRILE DISEASE: give the pre-referral treatment and refer urgently.",
          "A stiff neck is a sign of very severe disease, such as meningitis."],
         "Pink row: any general danger sign or stiff neck.",
         chk("child", {"hasFever": True, "neckStiffness": True}, {"fever": ["Very Severe Febrile Disease"]}, age=48, weight=15),
         answer=1),
    case("fever-rawan", child("Rawan", "2 years", 11, 38.4, "Fever and rash"),
         "Rawan has had fever for 4 days. She has a generalized rash with cough and red eyes: measles now. You see mouth ulcers, "
         "but they are not deep or extensive. There is no pus draining from the eye and no clouding of the cornea. Her malaria "
         "test is negative.",
         [sec("Does the child have fever? Yes", ["Malaria test: negative", "Generalized rash and red eyes: yes",
                                                 "Mouth ulcers: yes, not deep or extensive", "Pus draining from the eye: no",
                                                 "Clouding of the cornea: no"], ["FEVER - NO MALARIA", "MEASLES WITH EYE OR MOUTH COMPLICATIONS"])],
         "How do you classify Rawan's measles?",
         ["SEVERE COMPLICATED MEASLES", "MEASLES WITH EYE OR MOUTH COMPLICATIONS", "MEASLES"],
         ["Only deep or extensive mouth ulcers, clouding of the cornea or a danger sign make measles severe complicated.",
          "Right. Mouth ulcers that are not deep or extensive put measles in the yellow row.",
          "Rawan has a complication: mouth ulcers."],
         "Treat mouth ulcers with gentian violet and give vitamin A.",
         chk("child", {"hasFever": True, "malariaTest": "negative", "measlesRash": True, "mouthUlcers": True},
             {"measles": ["Measles with Eye or Mouth Complications"]}, age=24, weight=11), answer=1),
]

EAR = [
    case("ear-tamer", child("Tamer", "3 years", 14, 37.4, "Ear pain"),
         "Tamer has had ear pain for 2 days. You see no pus draining from the ear and there is no tender swelling behind the ear.",
         [sec("Does the child have an ear problem? Yes", ["Ear pain: yes", "Ear discharge: no", "Tender swelling behind the ear: no"],
              ["ACUTE EAR INFECTION"])],
         "How do you classify Tamer's ear problem?",
         ["MASTOIDITIS", "ACUTE EAR INFECTION", "NO EAR INFECTION"],
         ["There is no tender swelling behind the ear.",
          "Right. Ear pain classifies ACUTE EAR INFECTION.",
          "Ear pain is a sign of acute ear infection, even with no pus."],
         "Acute ear infection: oral amoxicillin for 5 days, paracetamol for pain, and follow up in 5 days.",
         chk("child", {"hasEarProblem": True, "earPain": True}, {"ear": ["Acute Ear Infection"]}, age=36, weight=14), answer=1),
    case("ear-lina", child("Lina", "4 years", 15, 37.0, "Pus from the ear"),
         "Lina's mother says pus has come from Lina's right ear for 3 weeks. You see pus draining. Lina has no ear pain and no "
         "swelling behind the ear.",
         [sec("Does the child have an ear problem? Yes", ["Ear pain: no", "Pus seen draining: yes", "For how long? 21 days",
                                                         "Tender swelling behind the ear: no"], ["CHRONIC EAR INFECTION"])],
         "How do you classify Lina's ear problem?",
         ["ACUTE EAR INFECTION", "CHRONIC EAR INFECTION", "MASTOIDITIS"],
         ["Pus for less than 14 days is acute. Lina's has lasted 21 days.",
          "Right. Pus seen draining and discharge for 14 days or more: CHRONIC EAR INFECTION.",
          "There is no tender swelling behind the ear."],
         "Chronic ear infection: dry the ear by wicking, give topical quinolone ear drops for 14 days, and follow up in 5 days.",
         chk("child", {"hasEarProblem": True, "earDischarge": True, "earDischargeDays": 21}, {"ear": ["Chronic Ear Infection"]},
             age=48, weight=15), answer=1),
    case("ear-badr", child("Badr", "2 years", 11, 38.6, "Ear pain and swelling"),
         "Badr has ear pain. Behind his left ear there is a swelling that is tender when you touch it.",
         [sec("Does the child have an ear problem? Yes", ["Ear pain: yes", "Tender swelling behind the ear: yes"], ["MASTOIDITIS"])],
         "How do you classify Badr's ear problem?",
         ["ACUTE EAR INFECTION", "MASTOIDITIS", "CHRONIC EAR INFECTION"],
         ["Ear pain is in the yellow row, but read from the top: there is a tender swelling behind the ear.",
          "Right. A tender swelling behind the ear classifies MASTOIDITIS: first dose of antibiotic, paracetamol, and refer urgently.",
          "There is no long-lasting discharge, and the swelling puts him in the pink row."],
         "Pink row first: tender swelling behind the ear is MASTOIDITIS.",
         chk("child", {"hasEarProblem": True, "earPain": True, "tenderSwelling": True}, {"ear": ["Mastoiditis"]}, age=24, weight=11),
         answer=1),
]

NUTRITION = [
    case("nut-mazin", child("Mazin", "18 months", 8.6, 37.0, "Check-up", length=80, muac=12.0),
         "Mazin has no oedema of both feet. On the weight-for-length chart he is between -3 and -2 z-scores. His MUAC is 12.0 cm.",
         [sec("Check for acute malnutrition", ["Oedema of both feet: no", "WFL: between -3 and -2 z", "MUAC: 12.0 cm"],
              ["MODERATE ACUTE MALNUTRITION"])],
         "How do you classify Mazin's nutritional status?",
         ["UNCOMPLICATED SEVERE ACUTE MALNUTRITION", "MODERATE ACUTE MALNUTRITION", "NO ACUTE MALNUTRITION"],
         ["SAM needs WFL below -3 z or MUAC below 11.5 cm.",
          "Right. WFL -3 up to -2 z, or MUAC 11.5 up to 12.5 cm: MODERATE ACUTE MALNUTRITION.",
          "His WFL and MUAC are both in the moderate range."],
         "MAM: assess the child's feeding and counsel the mother, and follow up in 30 days.",
         chk("child", {"muacCm": 12.0}, {"malnutrition": ["Moderate Acute Malnutrition"]}, z="Between -3 and -2 Z", age=18, weight=8.6),
         answer=1),
    case("nut-hala", child("Hala", "2 years", 8.4, 37.1, "Not gaining weight", length=82, muac=11.2),
         "Hala has no oedema. Her MUAC is 11.2 cm. She has no medical complication, and she finishes her RUTF portion in the "
         "appetite test.",
         [sec("Check for acute malnutrition", ["Oedema of both feet: no", "MUAC: 11.2 cm", "Medical complication: no",
                                              "Appetite test: passed"], ["UNCOMPLICATED SEVERE ACUTE MALNUTRITION"])],
         "How do you classify Hala?",
         ["COMPLICATED SEVERE ACUTE MALNUTRITION", "UNCOMPLICATED SEVERE ACUTE MALNUTRITION", "MODERATE ACUTE MALNUTRITION"],
         ["Complicated SAM needs oedema of both feet, a medical complication or a failed appetite test.",
          "Right. MUAC below 11.5 cm with no complication and a passed appetite test: UNCOMPLICATED SAM.",
          "MUAC below 11.5 cm is severe, not moderate."],
         "Uncomplicated SAM is treated at home with RUTF, with follow-up in 7 days.",
         chk("child", {"muacCm": 11.2, "appetiteTest": "passed"}, {"malnutrition": ["Uncomplicated Severe Acute Malnutrition"]},
             z="Between -3 and -2 Z", age=24, weight=8.4), answer=1),
    case("nut-ibrahim", child("Ibrahim", "3 years", 12, 37.0, "Swollen feet", muac=12.8),
         "When you press both of Ibrahim's feet with your thumbs for a few seconds, a dent stays in each foot. His MUAC is 12.8 cm.",
         [sec("Check for acute malnutrition", ["Oedema of both feet: yes", "MUAC: 12.8 cm"], ["COMPLICATED SEVERE ACUTE MALNUTRITION"])],
         "His MUAC is normal. How do you classify Ibrahim?",
         ["NO ACUTE MALNUTRITION", "MODERATE ACUTE MALNUTRITION", "COMPLICATED SEVERE ACUTE MALNUTRITION"],
         ["Oedema of both feet is severe acute malnutrition whatever the MUAC.",
          "Oedema of both feet is severe, not moderate.",
          "Right. Oedema of both feet is in the pink row: COMPLICATED SEVERE ACUTE MALNUTRITION. Refer urgently."],
         "Always look and feel for oedema of both feet. A normal MUAC does not rule out severe malnutrition.",
         chk("child", {"edema": True, "muacCm": 12.8}, {"malnutrition": ["Complicated Severe Acute Malnutrition"]}, age=36, weight=12),
         answer=2),
    case("anaemia-reem", child("Reem", "20 months", 10, 37.0, "Tired"),
         "You compare Reem's palm with your own and with her mother's. Her palm is pale, but not white.",
         [sec("Check for anaemia", ["Palmar pallor: some"], ["ANAEMIA"])],
         "How do you classify Reem?",
         ["SEVERE ANAEMIA", "ANAEMIA", "NO ANAEMIA"],
         ["Severe palmar pallor is a very pale, almost white palm.",
          "Right. Some palmar pallor classifies ANAEMIA: give iron, and mebendazole if 1 year or older and none in the last 6 months.",
          "Her palm is pale: she has some palmar pallor."],
         "Severe palmar pallor: SEVERE ANAEMIA, refer urgently. Some palmar pallor: ANAEMIA.",
         chk("child", {"pallor": "somePallor"}, {"anemia": ["Anaemia"]}, age=20, weight=10), answer=1),
]

# -----------------------------------------------------------------------------
# Practice cases: sick young infant, up to 2 months
# -----------------------------------------------------------------------------

INFANT = [
    case("inf-amal", child("Baby Amal", "10 days", 3.0, 37.9, "Feels hot"),
         "Amal is 10 days old. Her mother says she feels hot. She feeds well and moves on her own. Breathing 52 per minute. No "
         "chest indrawing. Her temperature is 37.9 °C.",
         [sec("Check for very severe disease and local bacterial infection", ["Feeding well: yes", "Breaths: 52 per minute",
                                                                             "Temperature: 37.9 °C", "Movement: moves on her own"],
              ["POSSIBLE SERIOUS BACTERIAL INFECTION OR VERY SEVERE DISEASE"])],
         "How do you classify Amal?",
         ["POSSIBLE SERIOUS BACTERIAL INFECTION OR VERY SEVERE DISEASE", "LOCAL BACTERIAL INFECTION",
          "SEVERE DISEASE OR LOCAL INFECTION UNLIKELY"],
         ["Right. Fever of 37.5 °C or above is a sign of very severe disease in a young infant.",
          "Amal has no umbilical redness, pustules or pus from the eyes, and she has a pink-row sign.",
          "37.9 °C is fever in a young infant."],
         "Give the first dose of IM ampicillin and gentamicin, prevent low blood sugar, keep her warm, and refer urgently.",
         chk("infant", {}, {"bacterial_infection": ["Possible Serious Bacterial Infection or Very Severe Disease"]}, temp="37.9",
             weight=3.0), answer=0),
    case("inf-omar", child("Baby Omar", "3 weeks", 3.6, 36.8, "Red umbilicus"),
         "Omar's umbilicus is red. He feeds well, breathes 48 times per minute, has no chest indrawing and moves on his own.",
         [sec("Check for very severe disease and local bacterial infection", ["Umbilicus red or draining pus: yes", "Breaths: 48",
                                                                             "Temperature: 36.8 °C"], ["LOCAL BACTERIAL INFECTION"])],
         "How do you classify Omar?",
         ["POSSIBLE SERIOUS BACTERIAL INFECTION OR VERY SEVERE DISEASE", "LOCAL BACTERIAL INFECTION",
          "SEVERE DISEASE OR LOCAL INFECTION UNLIKELY"],
         ["Omar has no sign of the pink row.",
          "Right. A red umbilicus is a local bacterial infection: oral amoxicillin for 5 days and treat the umbilicus at home.",
          "A red umbilicus is a sign of local bacterial infection."],
         "Follow up a local bacterial infection in 2 days.",
         chk("infant", {"umbilicusRedDraining": True}, {"bacterial_infection": ["Local Bacterial Infection"]}, temp="36.8", weight=3.6),
         answer=1),
    case("inf-tasneem", child("Baby Tasneem", "5 weeks", 4.2, 36.9, "Fast breathing"),
         "You count 66 breaths in one minute. You count again: 64. Tasneem feeds well and has no other sign.",
         [sec("Check for very severe disease", ["Breaths: 66, repeat 64", "Fast breathing: yes"],
              ["POSSIBLE SERIOUS BACTERIAL INFECTION OR VERY SEVERE DISEASE"])],
         "How do you classify Tasneem?",
         ["POSSIBLE SERIOUS BACTERIAL INFECTION OR VERY SEVERE DISEASE", "PNEUMONIA", "SEVERE DISEASE OR LOCAL INFECTION UNLIKELY"],
         ["Right. In a young infant, 60 or more breaths per minute on a repeated count is fast breathing, a pink-row sign.",
          "Young infants are not classified for pneumonia. Fast breathing is a sign of very severe disease.",
          "64 on the second count is fast breathing."],
         "If the first count is 60 or more, count again. Fast breathing is confirmed if the second count is also 60 or more.",
         chk("infant", {"fastBreathing": True}, {"bacterial_infection": ["Possible Serious Bacterial Infection or Very Severe Disease"]},
             temp="36.9", weight=4.2), answer=0),
    case("inf-jaundice-2d", child("Baby Sana", "4 days", 3.1, 36.9, "Yellow eyes"),
         "Sana is 4 days old. The jaundice appeared on day 3. Her face and body are yellow; her palms and soles are not. She "
         "weighs 3.1 kg.",
         [sec("Check for jaundice", ["Appeared in the first 24 hours: no", "Palms and soles yellow: no", "Weight: 3.1 kg"], ["JAUNDICE"])],
         "How do you classify Sana's jaundice?",
         ["SEVERE JAUNDICE", "JAUNDICE", "NO JAUNDICE"],
         ["Severe jaundice: jaundice in the first 24 hours, yellow palms and soles, or jaundice in an infant under 2.5 kg.",
          "Right. Jaundice that appeared after 24 hours, with palms and soles not yellow: JAUNDICE.",
          "Her face and body are yellow: she has jaundice."],
         "Advise the mother to return immediately if the palms and soles appear yellow, and follow up in 1 day.",
         chk("infant", {"hasJaundice": True}, {"jaundice": ["Jaundice"]}, temp="36.9", weight=3.1), answer=1),
    case("inf-jaundice-palms", child("Baby Hamza", "6 days", 3.3, 36.8, "Yellow"),
         "Hamza's jaundice appeared on day 3. Today his palms and soles are yellow.",
         [sec("Check for jaundice", ["Appeared in the first 24 hours: no", "Palms and soles yellow: yes"], ["SEVERE JAUNDICE"])],
         "How do you classify Hamza's jaundice?",
         ["SEVERE JAUNDICE", "JAUNDICE", "NO JAUNDICE"],
         ["Right. Yellow palms and soles at any age: SEVERE JAUNDICE. Refer urgently.",
          "Read the pink row first: yellow palms and soles make jaundice severe.",
          "Hamza is yellow."],
         "Before referral, prevent low blood sugar and keep the infant warm.",
         chk("infant", {"hasJaundice": True, "jaundiceSolesPalms": True}, {"jaundice": ["Severe Jaundice"]}, temp="36.8", weight=3.3),
         answer=0),
    case("inf-diar", child("Baby Ali", "5 weeks", 4.0, 37.0, "Diarrhoea"),
         "Ali has had diarrhoea for 3 days. He is restless and irritable and his eyes are sunken. The skin pinch goes back "
         "immediately.",
         [sec("Does the young infant have diarrhoea? Yes", ["For how long? 3 days", "Restless, irritable: yes", "Sunken eyes: yes"],
              ["SOME DEHYDRATION"])],
         "How do you classify Ali's dehydration?",
         ["SEVERE DEHYDRATION", "SOME DEHYDRATION", "NO DEHYDRATION"],
         ["Severe dehydration needs two of: movement only when stimulated or no movement, sunken eyes, skin pinch very slow.",
          "Right. Restless and irritable plus sunken eyes: SOME DEHYDRATION.",
          "He has two signs of the yellow row."],
         "If the infant has no severe classification, give fluid for some dehydration (Plan B) and counsel on feeding.",
         chk("infant", {"hasDiarrhea": True, "diarrheaDays": 3, "diarrheaRestless": True, "diarrheaSunkenEyes": True},
             {"diarrhea": ["Some Dehydration"]}, temp="37.0", weight=4.0), answer=1),
]

FEEDING = [
    case("feed-layla", child("Baby Layla", "6 weeks", 4.3, 36.8, "Check-up"),
         "Layla is breastfed 6 times in 24 hours. She takes no other food or drink. Her weight for age is not low. She is well "
         "positioned and well attached and suckles effectively. No thrush.",
         [sec("Check for feeding problem or low weight", ["Breastfeeds: 6 times in 24 hours", "Other foods or drinks: no",
                                                         "Weight for age: not low", "Attachment: good", "Suckling: effective"],
              ["FEEDING PROBLEM OR LOW WEIGHT"])],
         "How do you classify Layla's feeding?",
         ["FEEDING PROBLEM OR LOW WEIGHT", "NO FEEDING PROBLEM"],
         ["Right. Breastfeeding less than 8 times in 24 hours is a feeding problem.",
          "Her attachment is good, but she breastfeeds only 6 times. A young infant should breastfeed 8 times or more in 24 hours."],
         "Advise the mother to breastfeed as often and for as long as the infant wants, day and night.",
         chk("infant", {"breastfed": "yes", "breastfeedTimes": 6, "otherFoods": "no", "wellPositioned": "yes",
                        "goodAttachment": "good", "suckingEffectively": "effective", "diffFeeding": "no"},
             {"feeding_problem": ["Feeding Problem or Low Weight"]}, temp="36.8", weight=4.3), answer=0),
    case("feed-yasir", child("Baby Yasir", "4 weeks", 4.0, 36.9, "Check-up"),
         "Yasir breastfeeds 10 times in 24 hours, day and night. He gets no other food or drink. His weight for age is not low. "
         "He is well attached and suckles effectively. No thrush.",
         [sec("Check for feeding problem or low weight", ["Breastfeeds: 10 times in 24 hours", "Other foods or drinks: no",
                                                         "Weight for age: not low", "Attachment: good"], ["NO FEEDING PROBLEM"])],
         "How do you classify Yasir's feeding?",
         ["FEEDING PROBLEM OR LOW WEIGHT", "NO FEEDING PROBLEM"],
         ["Yasir has no sign of a feeding problem and his weight is not low.",
          "Right. Praise the mother for feeding him well."],
         "No feeding problem: advise the mother on home care for the young infant and praise her.",
         chk("infant", {"breastfed": "yes", "breastfeedTimes": 10, "otherFoods": "no", "wellPositioned": "yes",
                        "goodAttachment": "good", "suckingEffectively": "effective", "diffFeeding": "no"},
             {"feeding_problem": ["No Feeding Problem"]}, temp="36.9", weight=4.0), answer=1),
    case("feed-rana", child("Baby Rana", "7 weeks", 4.5, 36.7, "Check-up"),
         "Rana breastfeeds 9 times in 24 hours. Her mother also gives her water and goat's milk from a bottle. She is well attached.",
         [sec("Check for feeding problem or low weight", ["Breastfeeds: 9 times in 24 hours", "Other foods or drinks: water, goat's milk",
                                                         "Feeds with: bottle"], ["FEEDING PROBLEM OR LOW WEIGHT"])],
         "What is Rana's feeding problem? Select all that apply.",
         ["She breastfeeds too few times", "She receives other foods or drinks", "She is fed from a bottle"],
         ["9 times in 24 hours is enough: 8 or more.",
          "Right. A young infant should have breast milk only.",
          "Right. Counsel the mother to stop the bottle and use a cup if she must give other milk."],
         "Counsel the mother to breastfeed more, reduce other foods and drinks, and use a cup instead of a bottle.",
         chk("infant", {"breastfed": "yes", "breastfeedTimes": 9, "otherFoods": "yes", "goodAttachment": "good",
                        "wellPositioned": "yes", "suckingEffectively": "effective", "diffFeeding": "no"},
             {"feeding_problem": ["Feeding Problem or Low Weight"]}, temp="36.7", weight=4.5,
             right=["She receives other foods or drinks", "She is fed from a bottle"]), answers=[1, 2]),
]

ALL_CASES = DANGER + COUGH + DIARRHOEA + FEVER + EAR + NUTRITION + INFANT + FEEDING

def scenario(title, part, categories, cases, text=""):
    b = {"type": "scenario", "label": "Test your skill", "title": title, "part": part, "categories": list(categories),
         "cases": copy.deepcopy(list(cases))}
    if text: b["text"] = text
    return b

# -----------------------------------------------------------------------------
# Find the error
# -----------------------------------------------------------------------------

SPOTS = {
    "cough": {"type": "spot", "title": "Find the error on Hamid's form", "part": "child",
              "text": "A health worker filled in this part of the form for Hamid, 2 years. One entry is wrong. Tap it.",
              "child": child("Hamid", "2 years", 12, 37.2, "Cough for 4 days"),
              "record": [sec("Does the child have cough or difficult breathing? Yes",
                             [ok("For how long? 4 days", "This entry is right."),
                              ok("Count the breaths: 44 per minute", "The count is right."),
                              ok("Fast breathing: yes", "Right: at 2 years, 40 or more is fast breathing."),
                              ok("Chest indrawing: no", "This entry is right.")],
                             [wrong("COUGH OR COLD", "Hamid has fast breathing, so the classification is PNEUMONIA, not cough or cold.")])],
              "explanation": "The signs were recorded well, but the classification did not follow them. Read the table row by row."},
    "diarrhoea": {"type": "spot", "title": "Find the error on Huda's form", "part": "child",
                  "text": "One entry on this form is wrong. Tap it.",
                  "child": child("Huda", "16 months", 9.5, 37.3, "Diarrhoea for 2 days"),
                  "record": [sec("Does the child have diarrhoea? Yes",
                                 [ok("For how long? 2 days", "This entry is right."),
                                  ok("Blood in the stool: no", "This entry is right."),
                                  ok("Restless, irritable: yes", "This sign is in the yellow row."),
                                  ok("Sunken eyes: yes", "This sign is in both rows."),
                                  ok("Skin pinch: goes back immediately", "This entry is right.")],
                                 [wrong("NO DEHYDRATION", "Restless and irritable plus sunken eyes are two signs: SOME DEHYDRATION.")])],
                  "explanation": "Two signs of the yellow row are enough to classify SOME DEHYDRATION."},
    "fever": {"type": "spot", "title": "Find the error on Musa's form", "part": "child",
              "text": "One entry on this form is wrong. Tap it.",
              "child": child("Musa", "3 years", 14, 38.7, "Fever for 2 days"),
              "record": [sec("Does the child have fever? Yes",
                             [ok("For how long? 2 days", "This entry is right."),
                              ok("Stiff neck: no", "This entry is right."),
                              ok("Malaria test: positive", "The test was read correctly.")],
                             [wrong("FEVER - NO MALARIA", "The malaria test is positive: classify MALARIA.")])],
              "explanation": "Classify fever from the malaria test result."},
    "ear": {"type": "spot", "title": "Find the error on Salih's form", "part": "child",
            "text": "One entry on this form is wrong. Tap it.",
            "child": child("Salih", "4 years", 15, 37.1, "Pus from the ear"),
            "record": [sec("Does the child have an ear problem? Yes",
                           [ok("Ear pain: no", "This entry is right."),
                            ok("Pus seen draining: yes", "This entry is right."),
                            ok("For how long? 10 days", "This entry is right."),
                            ok("Tender swelling behind the ear: no", "This entry is right.")],
                           [wrong("CHRONIC EAR INFECTION", "Pus for less than 14 days is ACUTE EAR INFECTION. Chronic is 14 days or more.")])],
            "explanation": "The number of days decides between acute (less than 14 days) and chronic (14 days or more)."},
    "nutrition": {"type": "spot", "title": "Find the error on Fatima's form", "part": "child",
                  "text": "One entry on this form is wrong. Tap it.",
                  "child": child("Fatima", "2 years", 9, 37.0, "Check-up", muac=11.3),
                  "record": [sec("Check for acute malnutrition",
                                 [ok("Oedema of both feet: no", "This entry is right."),
                                  ok("MUAC: 11.3 cm", "The MUAC was read correctly."),
                                  ok("Medical complication: no", "This entry is right."),
                                  ok("Appetite test: passed", "This entry is right.")],
                                 [wrong("MODERATE ACUTE MALNUTRITION", "MUAC below 11.5 cm is SEVERE acute malnutrition. With no complication and a passed appetite test: UNCOMPLICATED SAM.")])],
                  "explanation": "MUAC below 11.5 cm is severe; 11.5 up to 12.5 cm is moderate."},
    "infant": {"type": "spot", "title": "Find the error on Baby Rami's form", "part": "infant",
               "text": "One entry on this young infant's form is wrong. Tap it.",
               "child": child("Baby Rami", "2 weeks", 3.4, 37.8, "Not well"),
               "record": [sec("Check for very severe disease and local bacterial infection",
                              [ok("Feeding well: yes", "This entry is right."),
                               ok("Breaths: 54 per minute", "54 is below 60: not fast breathing."),
                               ok("Temperature: 37.8 °C", "The temperature is recorded correctly."),
                               ok("Umbilicus: normal", "This entry is right.")],
                              [wrong("SEVERE DISEASE OR LOCAL INFECTION UNLIKELY",
                                     "37.8 °C is fever (37.5 °C or above) in a young infant: POSSIBLE SERIOUS BACTERIAL INFECTION OR VERY SEVERE DISEASE.")])],
               "explanation": "In a young infant, fever of 37.5 °C or above is a pink-row sign."},
    "jaundice": {"type": "spot", "title": "Find the error on Baby Nada's form", "part": "infant",
                 "text": "One entry is wrong. Tap it.",
                 "child": child("Baby Nada", "5 days", 3.0, 36.9, "Yellow"),
                 "record": [sec("Check for jaundice",
                                [ok("Jaundice: yes", "This entry is right."),
                                 ok("Appeared in the first 24 hours: no", "This entry is right."),
                                 ok("Palms and soles yellow: yes", "This sign was looked for and recorded correctly.")],
                                [wrong("JAUNDICE", "Yellow palms and soles at any age is SEVERE JAUNDICE.")])],
                 "explanation": "Always look at the palms and soles."},
}

# -----------------------------------------------------------------------------
# Skill drills (videos are placeholders until the clips are recorded)
# -----------------------------------------------------------------------------

DRILLS = {
    "cough": {"type": "drill", "title": "Count the breaths: Ali, 2 years", "url": "",
              "videoTitle": "Counting breaths: Ali, 2 years (video to be recorded)",
              "text": "Count the breaths for one full minute while the child is calm, then decide.",
              "given": "Until this clip is recorded: you watch Ali's chest and count 43 breaths in one full minute.",
              "count": {"answer": 43, "tolerance": 2, "unit": "breaths per minute", "question": "How many breaths did you count in one minute?"},
              "question": "Ali is 2 years old. Does he have fast breathing?", "options": ["Yes", "No"], "answer": 0,
              "feedback": ["Right. From 12 months up to 5 years, 40 breaths per minute or more is fast breathing.",
                           "Ali is 2 years old: 40 or more is fast. 43 is fast breathing."]},
    "infant": {"type": "drill", "title": "Count the breaths: a young infant", "url": "",
               "videoTitle": "Counting breaths: young infant (video to be recorded)",
               "text": "Count for one full minute. If the count is 60 or more, count again.",
               "given": "Until this clip is recorded: you count 64 breaths in one minute, and 62 when you count again.",
               "count": {"answer": 64, "tolerance": 3, "unit": "breaths per minute", "question": "How many breaths did you count in one minute?"},
               "question": "Does this young infant have fast breathing?", "options": ["Yes", "No, count once more"], "answer": 0,
               "feedback": ["Right. Both counts are 60 or more: fast breathing, a sign of very severe disease.",
                            "Two counts of 60 or more confirm fast breathing. Do not delay referral."]},
    "diarrhoea": {"type": "drill", "title": "The skin pinch", "url": "",
                  "videoTitle": "Skin pinch (video to be recorded)",
                  "text": "Watch the skin pinch, then decide how it goes back.",
                  "given": "Until this clip is recorded: after you let go, the skin stays up for about 3 seconds before it goes back.",
                  "question": "How does the skin go back?", "options": ["Immediately", "Slowly", "Very slowly (longer than 2 seconds)"],
                  "answer": 2,
                  "feedback": ["The skin stays up for a moment: it is not immediate.",
                               "Slowly means the skin stays up for a brief instant only.",
                               "Right. Longer than 2 seconds is very slowly, a sign of severe dehydration."]},
}

# -----------------------------------------------------------------------------
# Classification cards, from the Sudan chart booklet
# -----------------------------------------------------------------------------

def cards_from_booklet(key, rows=None):
    """Colour cards for a chart booklet table (src/components/chartBooklet.js, dumped to booklet.json)."""
    data = json.load(open(os.path.join(HERE, "booklet.json")))[key]
    picked = [r for i, r in enumerate(data["rows"]) if rows is None or i in rows]
    out = []
    for r in picked:
        signs = (r.get("signsIntro", "") + " " + " ".join(s.strip() for s in r["signs"])).strip()
        signs = re.sub(r"\s+;?\s*", " ", signs).replace(" ; ", "; ")
        treat = "; ".join(t.rstrip(".") for t in r.get("treatments", [])[:5])
        action = {"pink": "Refer urgently", "yellow": "Treat and follow up", "green": "Home care"}[r["colour"]]
        out.append({"colour": r["colour"], "label": r["classify"], "action": action, "signs": signs, "treat": treat})
    return out

def classcards(title, key=None, rows=None, cards=None, text="Open each card: the signs, then what to do. Pink first, then yellow, then green."):
    return {"type": "classcards", "title": title, "text": text, "cards": cards or cards_from_booklet(key, rows)}

INFANT_CARDS = {
    "bacterial": [
        {"colour": "pink", "label": "POSSIBLE SERIOUS BACTERIAL INFECTION OR VERY SEVERE DISEASE", "action": "Refer urgently",
         "signs": "Any one of: not feeding well; convulsions; fast breathing (60 breaths per minute or more); severe chest indrawing; "
                  "fever (37.5 °C or above); low body temperature (less than 35.5 °C); movement only when stimulated or no movement at all.",
         "treat": "First dose of IM ampicillin and gentamicin; prevent low blood sugar; keep the infant warm on the way; refer urgently."},
        {"colour": "yellow", "label": "LOCAL BACTERIAL INFECTION", "action": "Treat and follow up",
         "signs": "Umbilicus red or draining pus; skin pustules; pus draining from the eyes.",
         "treat": "Oral amoxicillin for 5 days; teach the mother to treat local infections at home; home care; follow up in 2 days."},
        {"colour": "green", "label": "SEVERE DISEASE OR LOCAL INFECTION UNLIKELY", "action": "Home care",
         "signs": "No signs of very severe disease or local bacterial infection.", "treat": "Advise the mother on home care for the young infant."},
    ],
    "jaundice": [
        {"colour": "pink", "label": "SEVERE JAUNDICE", "action": "Refer urgently",
         "signs": "Any jaundice if age less than 24 hours; or yellow palms and soles at any age; or any jaundice in an infant weighing less than 2.5 kg.",
         "treat": "Prevent low blood sugar; keep the infant warm; refer urgently."},
        {"colour": "yellow", "label": "JAUNDICE", "action": "Treat and follow up",
         "signs": "Jaundice appearing after 24 hours of age, and palms and soles not yellow.",
         "treat": "If 14 days or older, refer for assessment; home care; return immediately if palms and soles appear yellow; follow up in 1 day."},
        {"colour": "green", "label": "NO JAUNDICE", "action": "Home care", "signs": "No jaundice.",
         "treat": "Advise the mother on home care for the young infant."},
    ],
    "feeding": [
        {"colour": "yellow", "label": "FEEDING PROBLEM OR LOW WEIGHT", "action": "Treat and follow up",
         "signs": "Not well attached; or not suckling effectively; or less than 8 breastfeeds in 24 hours; or receives other foods or "
                  "drinks; or low weight for age; or thrush.",
         "treat": "Teach positioning and attachment; advise to breastfeed more often, day and night; counsel about other foods and "
                  "a cup; treat thrush; follow up a feeding problem or thrush in 2 days and low weight in 14 days."},
        {"colour": "green", "label": "NO FEEDING PROBLEM", "action": "Home care",
         "signs": "Not low weight for age and no other signs of inadequate feeding.",
         "treat": "Advise the mother on home care; praise her for feeding the infant well."},
    ],
}

# -----------------------------------------------------------------------------
# Photo step cards (photographs from the IMNCI photograph booklet)
# -----------------------------------------------------------------------------

def photo(n): return f"imnci-photos/photo-{int(n):02d}.jpg"

PHOTO_STEPS = {
    "dehydration": {"type": "steps", "title": "Look for signs of dehydration, with photographs", "steps": [
        {"title": "Look at the eyes", "text": "Are they sunken? Ask the mother if the eyes look unusual to her.", "image": photo(1)},
        {"title": "Pinch the skin of the abdomen", "text": "Halfway between the umbilicus and the side, with the fold up and down the body. "
                  "Hold for one second, then release.", "image": photo(2)},
        {"title": "Decide how the skin goes back", "text": "Very slowly (longer than 2 seconds), slowly, or immediately."},
    ]},
    "measles": {"type": "steps", "title": "Look for measles and its complications, with photographs", "steps": [
        {"title": "Look for the generalized rash", "text": "A generalized rash with cough, runny nose or red eyes.", "image": photo(8)},
        {"title": "Look in the mouth for ulcers", "text": "Are they deep or extensive?", "image": photo(24)},
        {"title": "Look for pus draining from the eye", "text": "Wipe the eye and look again.", "image": photo(29)},
        {"title": "Look for clouding of the cornea", "text": "A hazy cornea is a pink-row sign.", "image": photo(30)},
    ]},
    "pallor": {"type": "steps", "title": "Look for palmar pallor, with photographs", "steps": [
        {"title": "Hold the child's palm open", "text": "Do not stretch the fingers back: that can make the palm look pale.", "image": photo(38)},
        {"title": "Compare", "text": "With your own palm and the palms of other children.", "image": photo(39)},
        {"title": "Decide", "text": "Severe pallor (very pale, almost white), some pallor (pale), or no pallor.", "image": photo(40)},
    ]},
    "umbilicus": {"type": "steps", "title": "Look at the umbilicus and the skin, with photographs", "steps": [
        {"title": "A normal umbilicus", "text": "Compare what you see with a normal umbilicus.", "image": photo(60)},
        {"title": "Red or draining pus?", "text": "Does the redness extend to the skin of the abdomen?", "image": photo(61)},
        {"title": "Look at the skin", "text": "Are there pustules? Many or severe pustules are a serious sign.", "image": photo(62)},
    ]},
    "attachment": {"type": "steps", "title": "Check attachment, with photographs", "steps": [
        {"title": "Good attachment", "text": "Chin touching breast, mouth wide open, lower lip turned outward, more areola above than below.",
         "image": photo(66)},
        {"title": "Not well attached", "text": "Compare: chin not touching, mouth not wide open, areola equal above and below.", "image": photo(67)},
        {"title": "Good positioning", "text": "Head and body straight, facing the breast, close to the mother, whole body supported.",
         "image": photo(77)},
    ]},
}

# -----------------------------------------------------------------------------
# Conversation stories
# -----------------------------------------------------------------------------

def stage(dialogue, question="", options=(), answer=0, explanation="", feedback=(), text=""):
    s = {"text": text, "dialogue": [{"who": w, "text": t} for w, t in dialogue]}
    if question:
        s.update({"question": question, "options": list(options), "answer": answer, "explanation": explanation})
        if feedback: s["feedback"] = list(feedback)
    return s

def talk(title, stages):
    return {"type": "story", "label": "Conversation", "title": title, "self": ["You"], "stages": list(stages)}

TALKS = {
    "danger": talk("Ask about the danger signs", [
        stage([("You", "Good morning. What is the problem with your son today?"),
               ("Mother", "He has had a cough and fever for three days."),
               ("You", "Is he able to drink or breastfeed?"),
               ("Mother", "Yes, he breastfeeds, but less than usual.")],
              "What do you ask next?",
              ["Does he vomit everything?", "Has he had his vaccines?", "How many children do you have?"], 0,
              "Ask about each general danger sign in turn before anything else.",
              ["Right. Ask about each danger sign, one at a time.", "Immunization is checked later, after assess and classify.",
               "This is not part of checking for danger signs."]),
        stage([("Mother", "No, he keeps the milk down."),
               ("You", "Has he had convulsions during this illness?"),
               ("Mother", "Yes, yesterday evening he shook all over for a short time.")],
              "What does this mean?",
              ["He has a general danger sign", "It is only from the fever, so it does not count", "Ask again tomorrow"], 0,
              "Convulsions during this illness are a general danger sign: the child needs urgent attention.",
              ["Right.", "Convulsions in this illness count whatever the cause.", "A child with a danger sign must not wait."]),
    ]),
    "cough": talk("Talk with Omer's mother", [
        stage([("You", "Does Omer have a cough or difficult breathing?"),
               ("Mother", "Yes, he has coughed for four days."),
               ("You", "I will count his breaths now. Can you keep him calm on your lap?")],
              "Why should Omer be calm?", ["A crying child breathes faster, so the count would be wrong",
                                           "So he does not cough", "It does not matter"], 0,
              "Count the breaths when the child is calm. Look for chest indrawing and listen for stridor when calm too.",
              ["Right.", "Coughing does not change the count much; crying does.", "It matters: crying changes breathing."]),
        stage([("You", "He breathes 36 times a minute, and I see his lower chest go in when he breathes in."),
               ("Mother", "Is that serious?")],
              "What do you say?",
              ["\"He has pneumonia. I will give you a medicine for 5 days and show you how to give it.\"",
               "\"No, the breathing is not fast, so it is a cold.\"",
               "\"He must go to hospital now.\""], 0,
              "Chest indrawing with no danger sign or stridor classifies PNEUMONIA: oral amoxicillin for 5 days and follow-up in 3 days.",
              ["Right.", "Chest indrawing is a sign of pneumonia even when breathing is not fast.",
               "He has no general danger sign and no stridor, so he can be treated at home."]),
    ]),
    "diarrhoea": talk("Offer Hiba a drink", [
        stage([("You", "Let us see if Hiba wants to drink. Can you give her some water from this cup?"),
               ("Mother", "Look, she grabs the cup and drinks fast!")],
              "What sign is this?", ["Drinks eagerly, thirsty", "Not able to drink", "Drinks normally"], 0,
              "A child who reaches for the cup and drinks fast is thirsty: a yellow-row sign.",
              ["Right.", "She is able to drink.", "Drinking fast and wanting more is eager drinking."]),
        stage([("Mother", "Is she very sick?"),
               ("You", "She is restless, her eyes are sunken, and she is thirsty. She has some dehydration.")],
              "What do you do now?",
              ["Give ORS in the clinic (Plan B) and zinc", "Send her home with Plan A", "Refer urgently"], 0,
              "SOME DEHYDRATION: give fluid, zinc supplements and food for some dehydration (Plan B).",
              ["Right.", "Plan A is for no dehydration.", "Hiba has no severe classification."]),
    ]),
    "fever": talk("Talk with Ahmed's father", [
        stage([("You", "How long has Ahmed had fever?"), ("Father", "Two days."),
               ("You", "I will do a quick test for malaria from a drop of blood from his finger.")],
              "Why test every child with fever?", ["To treat malaria only when the test is positive", "Because the father asked",
                                                   "It is not needed if the child is hot"], 0,
              "Classify fever from the malaria test: positive is MALARIA, negative is FEVER - NO MALARIA.",
              ["Right.", "The test is part of assessing every child with fever.", "Feeling hot does not tell you if it is malaria."]),
        stage([("You", "The test is positive."), ("Father", "So what do we do?")],
              "What is the classification?", ["MALARIA", "VERY SEVERE FEBRILE DISEASE", "FEVER - NO MALARIA"], 0,
              "Ahmed has no danger sign and no stiff neck: MALARIA. Give the oral antimalarial and follow up in 3 days if fever persists.",
              ["Right.", "He has no danger sign and no stiff neck.", "The test is positive."]),
    ]),
    "ear": talk("Talk with Lina's mother", [
        stage([("You", "Does Lina have an ear problem?"), ("Mother", "Yes, pus comes from her ear."),
               ("You", "For how long?"), ("Mother", "About three weeks.")],
              "How do you classify Lina?", ["CHRONIC EAR INFECTION", "ACUTE EAR INFECTION", "MASTOIDITIS"], 0,
              "Pus for 14 days or more: CHRONIC EAR INFECTION.",
              ["Right.", "Acute is less than 14 days.", "There is no tender swelling behind the ear."]),
        stage([("Mother", "What should I do at home?")],
              "What do you teach her?", ["Dry the ear by wicking", "Put oil in the ear", "Leave it alone"], 0,
              "Teach the mother to dry the ear by wicking, three times daily, and give ear drops.",
              ["Right.", "Nothing should be put in the ear except the drops you give.", "The ear must be dried."]),
    ]),
    "nutrition": talk("Talk with Hala's mother", [
        stage([("You", "Hala's arm measures 11.2 centimetres. That is below the line."), ("Mother", "What does that mean?"),
               ("You", "She is severely thin. Let us see if she can eat this RUTF.")],
              "Why do the appetite test?", ["To see if she can be treated at home", "To feed her before she leaves", "It is optional"], 0,
              "A child with SAM who finishes the RUTF portion and has no medical complication can be treated at home.",
              ["Right.", "It decides where she is treated.", "It is part of the assessment of SAM."]),
        stage([("Mother", "She ate it all.")],
              "How do you classify Hala?", ["UNCOMPLICATED SEVERE ACUTE MALNUTRITION", "COMPLICATED SEVERE ACUTE MALNUTRITION",
                                            "MODERATE ACUTE MALNUTRITION"], 0,
              "MUAC below 11.5 cm, no complication, appetite test passed.",
              ["Right.", "She passed the appetite test and has no complication.", "MUAC below 11.5 cm is severe."]),
    ]),
    "infant": talk("Talk with Amal's mother", [
        stage([("You", "Congratulations on your baby. How old is she?"), ("Mother", "Ten days."),
               ("You", "Is she feeding well?"), ("Mother", "Yes, but she feels hot.")],
              "What do you do next?", ["Measure her temperature", "Tell the mother that babies are often warm",
                                       "Give paracetamol"], 0,
              "Measure the temperature. In a young infant 37.5 °C or above is fever, a pink-row sign.",
              ["Right.", "Fever in a young infant can be a sign of very severe disease.", "Assess and classify before treating."]),
        stage([("You", "Her temperature is 37.9 degrees.")],
              "How do you classify Amal?", ["POSSIBLE SERIOUS BACTERIAL INFECTION OR VERY SEVERE DISEASE",
                                            "LOCAL BACTERIAL INFECTION", "SEVERE DISEASE OR LOCAL INFECTION UNLIKELY"], 0,
              "Fever 37.5 °C or above is a pink-row sign: first dose of IM antibiotics, keep warm, refer urgently.",
              ["Right.", "She has a pink-row sign.", "37.9 °C is fever."]),
    ]),
    "feeding": talk("Talk with Layla's mother", [
        stage([("You", "How many times does Layla breastfeed in 24 hours, day and night?"), ("Mother", "About six times."),
               ("You", "Does she get any other food or drink?"), ("Mother", "No, only my milk.")],
              "Is this a feeding problem?", ["Yes: less than 8 times in 24 hours", "No: only breast milk is fine",
                                             "Only if she is losing weight"], 0,
              "A young infant should breastfeed 8 times or more in 24 hours.",
              ["Right.", "Exclusive breastfeeding is good, but 6 times is not enough.", "Fewer than 8 feeds is a problem whatever the weight."]),
        stage([("Mother", "She sleeps a lot at night.")],
              "What do you advise?", ["Breastfeed as often and for as long as she wants, day and night",
                                      "Give her water between feeds", "Feed only by day"], 0,
              "Advise the mother to breastfeed as often and for as long as the infant wants, day and night.",
              ["Right.", "A young infant needs breast milk only.", "Night feeds are important."]),
    ]),
}

# -----------------------------------------------------------------------------
# Opening questions (one per topic lesson)
# -----------------------------------------------------------------------------

OPENERS = {
    "danger": opener("A child sleeps on her mother's lap. Is she lethargic?",
                     ["Yes", "Not necessarily: wake her and look", "No, sleeping children are never sick"], 1,
                     ["Sleeping is not the same as lethargic.", "Right. Look at how she wakes and responds.",
                      "A sleeping child can be lethargic. You must look."]),
    "cough": opener("A child of 8 months breathes 48 times a minute. Is that fast?",
                    ["Yes", "No", "It depends on the child's age"], 2,
                    ["48 is below the cut-off for 8 months (50).", "Right for 8 months, but think about why.",
                     "Right. The cut-off is 50 from 2 up to 12 months and 40 from 12 months up to 5 years. At 8 months 48 is not fast."]),
    "classify_cough": opener("Which sign alone puts a child with cough in the pink row?",
                             ["Fast breathing", "Chest indrawing", "Stridor in a calm child"], 2,
                             ["Fast breathing is in the yellow row.", "In the Sudan chart booklet, chest indrawing is in the yellow row.",
                              "Right. Stridor in a calm child, or any general danger sign."]),
    "diarrhoea": opener("Which of these is a sign of dehydration you can check without equipment?",
                        ["Skin pinch", "Body temperature", "Breathing rate"], 0,
                        ["Right. You need only your fingers and your eyes.", "Temperature is for fever.", "Breathing is for cough."]),
    "classify_diarrhoea": opener("How many signs of a row do you need to classify dehydration?",
                                 ["One", "Two", "All of them"], 1,
                                 ["One is not enough.", "Right. Two signs of the pink row, or two of the yellow row.", "Two are enough."]),
    "fever": opener("A child with fever lives in Sudan, where there is malaria. What do you do first for the fever?",
                    ["Give an antimalarial", "Do a malaria test", "Give paracetamol and send home"], 1,
                    ["Treat malaria only after a positive test.", "Right. Classify fever from the malaria test.",
                     "First assess and classify."]),
    "measles": opener("Which of these is NOT a complication of measles in the chart booklet?",
                      ["Mouth ulcers", "Pus draining from the eye", "Runny nose"], 2,
                      ["Mouth ulcers are a complication.", "Pus draining from the eye is a complication.",
                       "Right. A runny nose is one of the signs of measles, not a complication."]),
    "ear": opener("Pus has drained from a child's ear for 14 days. Acute or chronic?",
                  ["Acute", "Chronic"], 1,
                  ["Acute is less than 14 days.", "Right. 14 days or more is chronic."]),
    "nutrition": opener("A child's MUAC is normal. Can she still have severe acute malnutrition?",
                        ["No", "Yes, if she has oedema of both feet or a very low weight for length"], 1,
                        ["Check oedema of both feet and weight for length too.", "Right. Check all three: oedema, WFH/L and MUAC."]),
    "anaemia": opener("How do you look for palmar pallor?",
                      ["Compare the child's palm with your own", "Ask the mother", "Look at the tongue"], 0,
                      ["Right.", "Look yourself.", "IMNCI uses the palm."]),
    "infant": opener("What is fast breathing in a young infant under 2 months?",
                     ["40 or more", "50 or more", "60 or more"], 2,
                     ["That is for children 12 months up to 5 years.", "That is for children 2 up to 12 months.",
                      "Right. 60 or more, on a repeat count."]),
    "jaundice": opener("Where do you look to decide if jaundice is severe?",
                       ["The palms and soles", "The eyes only", "The stool"], 0,
                       ["Right. Yellow palms and soles at any age is severe jaundice.", "Look at the palms and soles too.",
                        "Look at the skin, palms and soles."]),
    "feeding": opener("How many breastfeeds in 24 hours does a young infant need?",
                      ["4 or more", "8 or more", "12 or more"], 1,
                      ["Fewer than 8 is a feeding problem.", "Right.", "8 or more is enough."]),
    "treat": opener("A child has a pink classification and a yellow one. What do you do?",
                    ["Treat the yellow one at home first", "Give urgent pre-referral treatment and refer", "Wait and see"], 1,
                    ["A pink classification comes first.", "Right. Pink means urgent referral.", "A pink classification cannot wait."]),
    "counsel": opener("A mother says \"yes\" when you ask if she understood. Is that enough?",
                      ["Yes", "No: ask a checking question"], 1,
                      ["\"Yes\" does not show she can do it.", "Right. Ask her to tell you or show you what she will do."]),
    "followup": opener("At a follow-up visit for pneumonia, the child breathes more slowly and eats better. What do you do?",
                       ["Finish the 5 days of amoxicillin", "Stop the antibiotic", "Refer"], 0,
                       ["Right. The child is improving: complete the 5 days.", "The child should finish the course.",
                        "Referral is for a child who is worse."]),
}

# -----------------------------------------------------------------------------
# Module endings: recap, logbook, reflection and rating
# -----------------------------------------------------------------------------

def ending(title, recap, logbook):
    return {"title": title, "kind": "ending", "read": [
        note("Look back on what you learned, plan how you will use it, and tell us what you think. When you finish this "
             "lesson the module badge is yours.", "In this lesson"),
        {"type": "rich", "label": "Recap", "text": "<p><strong>What you learned</strong></p><ul>" + "".join(f"<li>{x}</li>" for x in recap) + "</ul>"},
        note(logbook, "Your logbook"),
        {"type": "reflect", "title": "Reflect", "prompts": [
            "What is one thing you will do differently in your clinic after this module?",
            "Which part was hardest for you? What will you practise again?",
        ], "rating": True, "ratingText": "How useful was this module for your work?"},
    ], "see": [], "practise": []}

RECAPS = {
    "danger": ["Check every sick child for the general danger signs first.",
               "Not able to drink or breastfeed, vomits everything, convulsions, lethargic or unconscious, convulsing now.",
               "A child with any danger sign needs urgent attention and referral after pre-referral treatment."],
    "infant": ["Check every sick young infant for very severe disease, local infection, jaundice, diarrhoea and feeding.",
               "Fever 37.5 °C or above, low temperature, fast breathing 60 or more, severe chest indrawing, not feeding well, convulsions, "
               "or moving only when stimulated: refer urgently.",
               "Jaundice in the first 24 hours or yellow palms and soles is severe.",
               "A young infant needs 8 or more breastfeeds in 24 hours and good attachment."],
    "cough": ["Count breaths for a full minute in a calm child: 50 or more is fast from 2 up to 12 months, 40 or more from 12 months.",
              "Any danger sign or stridor in a calm child: SEVERE PNEUMONIA OR VERY SEVERE DISEASE.",
              "Fast breathing or chest indrawing: PNEUMONIA, oral amoxicillin for 5 days, follow up in 3 days."],
    "diarrhoea": ["Two signs of a row classify dehydration: pink is severe, yellow is some.",
                  "Plan C for severe, Plan B for some, Plan A for no dehydration; zinc for 14 days.",
                  "14 days or more is persistent diarrhoea; blood in the stool is dysentery."],
    "fever": ["Test every child with fever for malaria and classify from the result.",
              "Any danger sign or stiff neck: VERY SEVERE FEBRILE DISEASE.",
              "Look for measles and its complications in the eyes and mouth."],
    "nutrition": ["Check every child for oedema of both feet, weight for length or height, and MUAC.",
                  "SAM with a complication, oedema or a failed appetite test: refer urgently.",
                  "Compare the child's palm with your own to classify anaemia."],
    "ear": ["Tender swelling behind the ear is MASTOIDITIS: refer urgently.",
            "Ear pain, or pus for less than 14 days: ACUTE EAR INFECTION.",
            "Pus for 14 days or more: CHRONIC EAR INFECTION; dry the ear by wicking."],
    "hiv": ["Know the HIV status of the child and the mother.",
            "Give cotrimoxazole prophylaxis and the right feeding advice to HIV-exposed children.",
            "Support adherence to ART and follow up regularly."],
    "well": ["Check growth, development, feeding, immunization, vitamin A and deworming at every visit.",
             "Counsel the caregiver on play and communication, hygiene and preventing accidents."],
    "intro": ["IMNCI looks at the whole child, not only the main complaint.",
              "Assess, classify, identify treatment, treat, counsel and follow up.",
              "Choose the right chart by the child's age."],
    "identify": ["Pink classifications need urgent pre-referral treatment and referral.",
                 "Yellow classifications are treated in the clinic and at home, with follow-up.",
                 "Green classifications need home care and advice on when to return."],
    "treat": ["Give the right drug, dose and schedule for the child's weight or age.",
              "Teach the mother to give oral drugs and treat local infections at home, and check her understanding.",
              "Choose Plan A, B or C for the child's dehydration."],
    "counsel": ["Assess the child's feeding and give relevant advice for each problem.",
                "Use good communication skills and the Mother's Card.",
                "Tell the mother when to return immediately and when to come for follow-up."],
    "followup": ["At a follow-up visit, use the follow-up box for the child's classification.",
                 "Check for new problems, and refer a child who is worse.",
                 "Complete the treatment for a child who is improving."],
}

def logbook(topic):
    return (f"In your clinic this week, record in your logbook three children you see for {topic}: what you found, how you "
            "classified them and what you did. Bring the logbook to your next supervision visit or course session.")

# -----------------------------------------------------------------------------
# "How to study this course" (the first lesson of each course)
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# IMNCI pre-test (Qusay, 2026-11-19): the 20 questions of the app's IMNCI
# Pre/Post Test (CourseTestForm.jsx IMNCI_TEST_QUESTIONS, used for every IMNCI
# course type, including the online IMCI course and IMNCI in humanitarian
# setting), copied to imnci_test.json. One exercise, linked from the first
# lesson of both IMNCI online courses. It opens in a window over the lesson.
# -----------------------------------------------------------------------------

PRETEST_ID = "imnci-pre-test"

def _pretest():
    here = os.path.dirname(os.path.abspath(__file__))
    data = json.load(open(os.path.join(here, "imnci_test.json"), encoding="utf-8"))
    qs = []
    for t in data["questions"]:
        text = re.sub(r"^\s*\d+\.\s*", "", t["text"])
        ids = [o["id"] for o in t["options"]]
        qs.append({"id": t["id"], "type": "mcq", "question": text, "options": [o["text"] for o in t["options"]],
                   "correct": [ids.index(t["correctAnswer"])], "explain": ""})
    return {"id": PRETEST_ID, "order": 0, "title": "IMNCI pre-test", "titleAr": "", "subCourse": "online IMCI course",
            "kind": "quiz", "passMark": 60, "estimatedMinutes": 20, "draft": True, "arabicOn": False,
            "source": "IMNCI Pre/Post Test (the test used in the app's face-to-face IMNCI courses)",
            "narrative": ["Pre-test: the 20 questions of the IMNCI pre/post test. Answer every question before you start the lessons. "
                          "Do not worry about your score: it shows what you know now."],
            "questions": qs}

PRETEST_EXERCISES = [_pretest()]

def pretest_blocks():
    return [
        {"type": "heading", "text": "Before you start: the pre-test"},
        {"type": "paragraph", "text": "Take the pre-test before the first clinical lesson. It has the 20 questions of the IMNCI "
                                      "pre/post test that is used in the face-to-face IMNCI courses. Press Start: the test opens in a "
                                      "window over this lesson, and you come back here when you close it. Do not worry about your "
                                      "score: it shows what you know now, before the course."},
        {"type": "exercise", "exerciseId": PRETEST_ID, "note": "IMNCI pre-test: 20 questions, about 20 minutes."},
    ]

def how_to_practise(course_name, pretest=True):
    # Only how to find your way in the course: no clinical question, protocol
    # or chart here (Qusay, 2026-11-18). The clinical content starts in the
    # next lesson. The pre-test closes the lesson (Qusay, 2026-11-19).
    return {"title": "How to study this course", "kind": "howto", "read": [
        note(f"Learn how to find your way in {course_name}: opening modules and lessons, moving through a lesson, "
             "and the buttons you will use, then take the pre-test. Finding your way takes about 5 minutes; the pre-test "
             "about 20.", "In this lesson"),
        {"type": "steps", "title": "Find your way to a lesson", "steps": [
            {"title": "Open the course", "text": "From Online Courses, tap the course. Start opens it the first time; "
                                                 "Continue takes you back to where you stopped."},
            {"title": "Choose the module", "text": "The modules are listed in order. A module with a lock opens when you "
                                                   "finish the module before it."},
            {"title": "Choose the lesson", "text": "Each module page lists its lessons. A tick shows a lesson you finished; "
                                                   "lessons open one after the other."},
            {"title": "Go back", "text": "The back arrow at the top left takes you from a lesson to its module, and from "
                                         "a module to the course."},
        ]},
        {"type": "steps", "title": "Inside a lesson", "steps": [
            {"title": "The top line", "text": "It shows the lesson's name and where it sits: \"Module 1 · Lesson 2 of 9\". "
                                              "The two buttons beside it make the text smaller or larger."},
            {"title": "Your progress in this lesson", "text": "The bar under the top line counts the activities done. "
                                                              "Tap it to see the list; tap a line to go to that activity."},
            {"title": "A part at a time", "text": "A lesson opens a part at a time. Watch the video, answer the question "
                                                  "or press Continue, and the next part appears below."},
            {"title": "Come back any time", "text": "Your place is saved. When you come back, the lesson offers to take "
                                                    "you to where you stopped."},
        ]},
        {"type": "flip", "title": "The bar at the bottom of a lesson", "cards": [
            {"front": "← Previous", "back": "Opens the lesson before this one. Going back is always allowed."},
            {"front": "The progress bar (for example 2/5)", "back": "How many of the lesson's activities you have done. "
                                                                     "Tap it to go to the next one still to do."},
            {"front": "Go to the next activity", "back": "Shown while something is left to do. It takes you straight to it."},
            {"front": "Complete & continue", "back": "Shown when every activity is done. It finishes the lesson and opens "
                                                     "the next one."},
        ]},
        {"type": "steps", "title": "Videos, questions and cases", "steps": [
            {"title": "Videos", "text": "Tap the picture to play. A video played to the end is ticked; you can also press "
                                        "\"I watched the video\" under it. Tap a paused video to carry on."},
            {"title": "Questions", "text": "Tap your answer. The card turns green when you are right and red when you are "
                                           "not. Read the hint and try again: your first try is kept for your progress page."},
            {"title": "Cards, sorting and cases", "text": "Tap a card to turn it, sort each item into its group, and work a "
                                                          "case in the window that opens. Close a window with X or the phone's back button."},
            {"title": "Pictures", "text": "Tap a picture or a book page to see it full screen, then pinch to zoom."},
        ]},
        q("The next part of the lesson is not showing yet. What do you do?",
          ["Close the app and open it again", "Do the activity just above it: watch the video, answer the question or press Continue",
           "Wait for a manager to open it"], 1,
          ["The lesson keeps your place; opening it again shows the same part.",
           "Right. Each part opens when the one before it is done.",
           "No one needs to open it for you: doing the activity opens the next part."], label="Check yourself"),
        q("Where do you see how much of this lesson is done?",
          ["On the bar at the bottom, beside Next", "Only at the end of the module", "Nowhere: it is not counted"], 0,
          ["Right. The bar shows the activities done, for example 2/5, and tapping it takes you to the next one.",
           "Each lesson shows its own progress while you work.",
           "Every activity you do is counted and saved."], label="Check yourself"),
        note("My progress, next to Courses, shows your lessons, the badge you earn for each module you finish, and how "
             "often you were right the first time. On a module page, Save for offline keeps the module on your phone "
             "so you can study without a connection.", "Your progress"),
        *(pretest_blocks() if pretest else []),
    ], "see": [], "practise": []}

# -----------------------------------------------------------------------------
# Practice lessons
# -----------------------------------------------------------------------------

def practice_lesson(title, goal, blocks):
    return {"title": title, "kind": "practice", "read": [note(goal, "In this lesson")] + list(blocks), "see": [], "practise": []}

LESSONS = {
    "danger": lambda: practice_lesson("Practise: general danger signs",
        "Find the general danger signs in three children, and in a conversation with a mother.",
        [TALKS["danger"], scenario("Does the child have a general danger sign?", "child", ["danger"], DANGER)]),
    "cough": lambda: practice_lesson("Practise: classify cough or difficult breathing",
        "Count, decide and classify cough or difficult breathing for four children, and find an error on a recording form.",
        [OPENERS["classify_cough"], DRILLS["cough"], TALKS["cough"],
         scenario("Classify cough or difficult breathing", "child", ["danger", "cough"], COUGH), SPOTS["cough"]]),
    "diarrhoea": lambda: practice_lesson("Practise: classify diarrhoea",
        "Classify dehydration, persistent diarrhoea and dysentery for four children, and find an error on a recording form.",
        [OPENERS["classify_diarrhoea"], DRILLS["diarrhoea"], TALKS["diarrhoea"],
         scenario("Classify diarrhoea", "child", ["diarrhea", "persistent_diarrhea", "dysentery"], DIARRHOEA), SPOTS["diarrhoea"]]),
    "fever": lambda: practice_lesson("Practise: classify fever and measles",
        "Classify fever and measles for four children, and find an error on a recording form.",
        [TALKS["fever"], scenario("Classify fever and measles", "child", ["fever", "measles"], FEVER), SPOTS["fever"]]),
    "ear": lambda: practice_lesson("Practise: classify ear problems",
        "Classify the ear problems of three children, and find an error on a recording form.",
        [TALKS["ear"], scenario("Classify the ear problem", "child", ["ear"], EAR), SPOTS["ear"]]),
    "nutrition": lambda: practice_lesson("Practise: classify malnutrition and anaemia",
        "Classify the nutritional status and anaemia of four children, and find an error on a recording form.",
        [TALKS["nutrition"], scenario("Classify malnutrition and anaemia", "child", ["malnutrition", "anemia"], NUTRITION),
         SPOTS["nutrition"]]),
    "infant": lambda: practice_lesson("Practise: classify the sick young infant",
        "Count breaths, and classify very severe disease, local infection, jaundice and diarrhoea for six young infants.",
        [OPENERS["infant"], DRILLS["infant"], TALKS["infant"],
         scenario("Classify the sick young infant", "infant", ["bacterial_infection", "jaundice", "diarrhea"], INFANT),
         SPOTS["infant"], SPOTS["jaundice"]]),
    "feeding": lambda: practice_lesson("Practise: classify feeding problems",
        "Classify the feeding of three young infants, and practise the questions you ask a mother.",
        [TALKS["feeding"], scenario("Classify feeding problem or low weight", "infant", ["feeding_problem"], FEEDING)]),
}

# -----------------------------------------------------------------------------
# Placing the activities in a course
# -----------------------------------------------------------------------------

def _find(module, pattern, start=0):
    rx = re.compile(pattern, re.I)
    for i, s in enumerate(module["sections"]):
        if i >= start and rx.search(s["title"]):
            return i
    raise KeyError(f"{module['title']}: no lesson matches {pattern!r}")

def _insert_after_goal(section, blocks):
    """After the "In this lesson" note (and after an opening question already there)."""
    read = section["read"]
    i = 1 if read and read[0].get("type") == "note" else 0
    read[i:i] = [strip(b) for b in blocks]

def _insert_before_exercise(section, blocks):
    read = section["read"]
    i = next((k for k, b in enumerate(read) if b.get("type") == "exercise"), len(read))
    read[i:i] = [strip(b) for b in blocks]

def _insert_after_booklet(section, blocks):
    read = section["read"]
    i = next((k + 1 for k, b in enumerate(read) if b.get("type") == "booklet"), None)
    if i is None:
        return _insert_before_exercise(section, blocks)
    read[i:i] = [strip(b) for b in blocks]

def apply(module, plan):
    """plan: list of (action, pattern, payload). Actions:
         open      add an opening question after the lesson goal
         cards     add colour cards after the booklet table (or before the exercise)
         photos    add photo step cards before the exercise
         after     insert a whole lesson after the matching lesson
         first     insert a whole lesson at the start of the module
         end       add the module ending as the last lesson
    Lessons are renumbered afterwards."""
    for action, pattern, payload in plan:
        if action == "first":
            module["sections"].insert(0, strip_lesson(payload))
        elif action == "end":
            lesson = strip_lesson(payload)
            # A module whose every lesson carries a standing note (Module 8: WHO 2014 HIV content) keeps it on its ending too.
            standing = [b for b in module["sections"][0]["read"] if b.get("type") == "note" and b.get("label") == "WHO 2014 HIV content"]
            lesson["read"][1:1] = copy.deepcopy(standing[:1])
            module["sections"].append(lesson)
        elif action == "after":
            i = _find(module, pattern)
            module["sections"].insert(i + 1, strip_lesson(payload))
        else:
            s = module["sections"][_find(module, pattern)]
            {"open": _insert_after_goal, "cards": _insert_after_booklet, "photos": _insert_before_exercise}[action](s, payload)
    for i, s in enumerate(module["sections"]):
        s["order"] = i + 1
    return module

def strip_lesson(lesson):
    out = copy.deepcopy(lesson)
    out.pop("kind", None)
    out["read"] = [strip(b) for b in out["read"]]
    return out

CARDS = {
    "cough": lambda: classcards("Cough or difficult breathing: the three classifications", "cough"),
    "dehydration": lambda: classcards("Dehydration: the three classifications", "diarrhea", rows=[0, 1, 2]),
    "persistent": lambda: classcards("Persistent diarrhoea and dysentery", "diarrhea", rows=[3, 4, 5]),
    "fever": lambda: classcards("Fever: the three classifications", "fever", rows=[0, 1, 2]),
    "measles": lambda: classcards("Measles: the three classifications", "fever", rows=[3, 4, 5]),
    "ear": lambda: classcards("Ear problem: the four classifications", "ear"),
    "nutrition": lambda: classcards("Nutritional status: the four classifications", "malnutrition"),
    "anaemia": lambda: classcards("Anaemia: the three classifications", "anemia"),
    "bacterial": lambda: classcards("Very severe disease and local bacterial infection", cards=INFANT_CARDS["bacterial"]),
    "jaundice": lambda: classcards("Jaundice: the three classifications", cards=INFANT_CARDS["jaundice"]),
    "feeding": lambda: classcards("Feeding problem or low weight", cards=INFANT_CARDS["feeding"]),
}

def dimci_plans():
    """WHO distance-learning modules, by module number."""
    C, L, O, P = CARDS, LESSONS, OPENERS, PHOTO_STEPS
    return {
        1: [("first", None, how_to_practise("this course")),
            ("open", r"^Checking for general danger signs", [O["danger"]]),
            ("after", r"^See the signs and practise", L["danger"]()),
            ("end", None, ending("Module 1 wrap-up", RECAPS["danger"], logbook("any illness, checking each one for the general danger signs")))],
        2: [("open", r"^Assess for severe disease", [O["infant"]]),
            ("photos", r"^Assess for severe disease", [P["umbilicus"]]),
            ("cards", r"^Classify signs of serious illness", [C["bacterial"]()]),
            ("open", r"^Jaundice: what it is", [O["jaundice"]]),
            ("cards", r"^Classify jaundice", [C["jaundice"]()]),
            ("after", r"^Practise with three cases", L["infant"]()),
            ("open", r"^Part A: assess for a feeding problem", [O["feeding"]]),
            ("photos", r"^Part B: assess breastfeeding", [P["attachment"]]),
            ("cards", r"^Classify feeding problems", [C["feeding"]()]),
            ("after", r"^Classify feeding problems", L["feeding"]()),
            ("end", None, ending("Module 2 wrap-up", RECAPS["infant"], logbook("a sick young infant")))],
        3: [("open", r"^Count the breaths", [O["cough"]]),
            ("cards", r"^Classify cough or difficult breathing", [C["cough"]()]),
            ("after", r"^Practise classifying: Aziz", L["cough"]()),
            ("end", None, ending("Module 3 wrap-up", RECAPS["cough"], logbook("cough or difficult breathing")))],
        4: [("open", r"^Look for dehydration", [O["diarrhoea"]]),
            ("photos", r"^The skin pinch", [P["dehydration"]]),
            ("cards", r"^Classify dehydration", [C["dehydration"]()]),
            ("cards", r"^Classify persistent diarrhoea", [C["persistent"]()]),
            ("after", r"^Classify persistent diarrhoea", L["diarrhoea"]()),
            ("end", None, ending("Module 4 wrap-up", RECAPS["diarrhoea"], logbook("diarrhoea")))],
        5: [("open", r"^Assess fever", [O["fever"]]),
            ("open", r"^Assess for complications of measles", [O["measles"]]),
            ("photos", r"^Assess for complications of measles", [P["measles"]]),
            ("cards", r"^Classify fever", [C["fever"]()]),
            ("cards", r"^Classify measles", [C["measles"]()]),
            ("after", r"^Classify measles", L["fever"]()),
            ("end", None, ending("Module 5 wrap-up", RECAPS["fever"], logbook("fever")))],
        6: [("open", r"^Why check every child", [O["nutrition"]]),
            ("cards", r"^Classify malnutrition", [C["nutrition"]()]),
            ("open", r"^Assess and classify anaemia", [O["anaemia"]]),
            ("photos", r"^Assess and classify anaemia", [P["pallor"]]),
            ("cards", r"^Assess and classify anaemia", [C["anaemia"]()]),
            ("after", r"^Assess and classify anaemia", L["nutrition"]()),
            ("end", None, ending("Module 6 wrap-up", RECAPS["nutrition"], logbook("a check of nutrition and anaemia")))],
        7: [("open", r"^Assess an ear problem", [O["ear"]]),
            ("cards", r"^Classify an ear problem", [C["ear"]()]),
            ("after", r"^Classify an ear problem", L["ear"]()),
            ("end", None, ending("Module 7 wrap-up", RECAPS["ear"], logbook("an ear problem")))],
        8: [("end", None, ending("Module 8 wrap-up", RECAPS["hiv"], logbook("HIV exposure or infection")))],
        9: [("end", None, ending("Module 9 wrap-up", RECAPS["well"], logbook("a well-child visit")))],
    }

def classic_plans():
    """Sudan classic course, by module number."""
    C, L, O, P = CARDS, LESSONS, OPENERS, PHOTO_STEPS
    return {
        1: [("first", None, how_to_practise("this course")),
            ("end", None, ending("Module 1 wrap-up", RECAPS["intro"], logbook("any illness, choosing the right chart for the child's age")))],
        2: [("open", r"^Check for general danger signs", [O["danger"]]),
            ("after", r"^Ask and look for each general danger sign", L["danger"]()),
            ("open", r"^Assess cough or difficult breathing", [O["cough"]]),
            ("cards", r"^Classify cough or difficult breathing", [C["cough"]()]),
            ("after", r"^Exercise C: video exercise", L["cough"]()),
            ("open", r"^Assess diarrhoea", [O["diarrhoea"]]),
            ("photos", r"^Offer fluid and pinch the skin", [P["dehydration"]]),
            ("cards", r"^Classify dehydration", [C["dehydration"]()]),
            ("cards", r"^Classify persistent diarrhoea", [C["persistent"]()]),
            ("after", r"^Exercise G: diarrhoea video", L["diarrhoea"]()),
            ("open", r"^Assess fever", [O["fever"]]),
            ("photos", r"^Measles complications: the eye", [P["measles"]]),
            ("cards", r"^Classify fever", [C["fever"]()]),
            ("open", r"^Classify measles", [O["measles"]]),
            ("cards", r"^Classify measles", [C["measles"]()]),
            ("after", r"^Exercise L: fever video", L["fever"]()),
            ("open", r"^Assess ear problem", [O["ear"]]),
            ("cards", r"^Classify ear problem", [C["ear"]()]),
            ("after", r"^Classify ear problem", L["ear"]()),
            ("open", r"^Assess for acute malnutrition", [O["nutrition"]]),
            ("cards", r"^Classify nutritional status", [C["nutrition"]()]),
            ("open", r"^Assess and classify anaemia", [O["anaemia"]]),
            ("photos", r"^Assess and classify anaemia", [P["pallor"]]),
            ("cards", r"^Assess and classify anaemia", [C["anaemia"]()]),
            ("after", r"^Exercise N: palmar pallor", L["nutrition"]()),
            ("end", None, ending("Module 2 wrap-up", RECAPS["danger"] + RECAPS["cough"][1:2] + RECAPS["diarrhoea"][:1] + RECAPS["fever"][:1],
                                 logbook("any illness, assessing and classifying the whole child")))],
        3: [("open", r"^The steps, and what the coloured rows mean", [O["treat"]]),
            ("end", None, ending("Module 3 wrap-up", RECAPS["identify"], logbook("any illness, writing the treatments you identified")))],
        4: [("open", r"^1\.1 Give an appropriate oral antibiotic$", [O["treat"]]),
            ("open", r"^2\.2 Check the mother's understanding", [O["counsel"]]),
            ("end", None, ending("Module 4 wrap-up", RECAPS["treat"], logbook("a treatment you gave or taught")))],
        5: [("open", r"^2\.0 Assess the child's feeding", [O["counsel"]]),
            ("end", None, ending("Module 5 wrap-up", RECAPS["counsel"], logbook("feeding counselling")))],
        6: [("open", r"^1\.0 and 1\.1 Check for possible bacterial", [O["infant"]]),
            ("photos", r"^1\.0 and 1\.1 Check for possible bacterial", [P["umbilicus"]]),
            ("cards", r"^1\.1\.2 Classify bacterial infection", [C["bacterial"]()]),
            ("open", r"^1\.2 Check for jaundice", [O["jaundice"]]),
            ("cards", r"^1\.2 Check for jaundice", [C["jaundice"]()]),
            ("after", r"^Exercise B: assess and classify young infants", L["infant"]()),
            ("open", r"^1\.4 Check for feeding problem", [O["feeding"]]),
            ("photos", r"^1\.4\.2 Assess breastfeeding", [P["attachment"]]),
            ("cards", r"^1\.4\.3 Classify feeding problems", [C["feeding"]()]),
            ("after", r"^Exercise E: assess and classify feeding", L["feeding"]()),
            ("end", None, ending("Module 6 wrap-up", RECAPS["infant"], logbook("a sick young infant")))],
        7: [("open", r"^1\.0 Follow-up visit for pneumonia", [O["followup"]]),
            ("end", None, ending("Module 7 wrap-up", RECAPS["followup"], logbook("a follow-up visit")))],
    }

def module_number(module):
    m = re.match(r"\s*Module\s+(\d+)", module["title"])
    return int(m.group(1)) if m else None

def enrich(modules, plans):
    for m in modules:
        n = module_number(m)
        if n in plans:
            apply(m, plans[n])
    return modules

# -----------------------------------------------------------------------------
# Self-checks
# -----------------------------------------------------------------------------

def norm(s):
    return re.sub(r"\s+", " ", str(s).upper().replace("—", "-").replace("–", "-")).strip()

def self_check():
    errors = []
    for c in ALL_CASES:
        right = c.get("answers") or [c["answer"]]
        if any(not 0 <= i < len(c["options"]) for i in right): errors.append(f"{c['id']}: answer out of range")
        if len(c["feedback"]) != len(c["options"]): errors.append(f"{c['id']}: feedback count")
        want = {norm(x) for x in c["check"]["right"]}
        got = {norm(c["options"][i]) for i in right}
        labels = {norm(x) for v in c["check"]["expect"].values() for x in v}
        # A right option names the classification (or, for a sign question, is listed in check.right).
        if not (got == want or got <= labels or want <= got):
            if not any(norm(x) in labels for x in c["check"]["right"]) and got != want:
                errors.append(f"{c['id']}: right options {got} do not match {want}")
    for k, s in SPOTS.items():
        marked = [l for sec_ in s["record"] for l in sec_["lines"] + sec_.get("classify", []) if isinstance(l, dict) and l.get("error")]
        if len(marked) != 1: errors.append(f"spot {k}: {len(marked)} errors marked")
    for k, d in DRILLS.items():
        if not 0 <= d["answer"] < len(d["options"]): errors.append(f"drill {k}: answer")
    for k, o in OPENERS.items():
        if len(o["feedback"]) != len(o["options"]): errors.append(f"opener {k}: feedback count")
    for k, t in TALKS.items():
        for st in t["stages"]:
            if st.get("feedback") and len(st["feedback"]) != len(st["options"]): errors.append(f"talk {k}: feedback count")
    return errors

if __name__ == "__main__":
    errs = self_check()
    if errs:
        print("ERRORS:", *errs, sep="\n  "); raise SystemExit(1)
    json.dump([{"id": c["id"], "options": c["options"], "answer": c.get("answer"), "answers": c.get("answers"), "check": c["check"]}
               for c in ALL_CASES], open(os.path.join(HERE, "cases.json"), "w"), indent=1)
    print(f"{len(ALL_CASES)} cases, {len(SPOTS)} find-the-error forms, {len(DRILLS)} drills, {len(TALKS)} conversations, "
          f"{len(OPENERS)} opening questions: wrote cases.json")
