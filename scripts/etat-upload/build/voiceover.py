# Voice-over scripts for the video placeholders of the Sudan ETAT course (Word file).
#   python3 voiceover.py <course json> <out.docx>
# One script per video code. The scripts use only the information in the WHO ETAT manual
# for participants and the ETAT facilitator guide.
import json, sys
import docx
from docx.shared import Pt

S = {
"ET1.1": ("What to film: a short welcome; the emergency room or outpatient waiting area of a Sudanese hospital.", [
    "Welcome to the Sudan ETAT course: Emergency Triage Assessment and Treatment.",
    "Many children who die in hospital die within 24 hours of arrival. Many of these deaths could be prevented if very sick children were identified soon after they arrive, and treatment started immediately.",
    "Triage is the sorting of patients into priority groups according to their need. In ETAT you will learn to sort every sick child, on arrival, into one of three groups: children with emergency signs, who need immediate treatment; children with priority signs, who go to the front of the queue; and non-urgent cases, who wait their turn.",
    "The course follows the ETAT facilitator guide: seven modules over three and a half days. Triage and the ABCD concept; Airway and breathing; Circulation; Coma and convulsion; Dehydration; Case management scenarios; and Implementing ETAT.",
    "First, take the pre-test. Then work through each lesson in order: read, do the activities, and practise the skills with your facilitator. Let's begin.",
]),
"ET1.2": ("What to film: Chart 2 (triage of all sick children) on the wall; a nurse triaging children at the door.", [
    "This is Chart 2: triage of all sick children. Keep it on the wall where children arrive.",
    "Look for emergency signs in order: A and B, airway and breathing; C, circulation, coma and convulsion; D, severe dehydration.",
    "If you find an emergency sign, stop, call for help, and start treatment immediately. Then continue the assessment.",
    "If there are no emergency signs, look for priority signs: remember them as 3 TPR - MOB: tiny baby, temperature, trauma; pallor, poisoning, pain; respiratory distress; restless, continuously irritable or lethargic; referral; malnutrition, oedema of both feet, and burns.",
    "A child with a priority sign goes to the front of the queue. A child with no emergency or priority signs is a non-urgent case.",
    "Triaging should not take much time: for a child who does not have emergency signs, it takes on average 20 seconds. Practise until you can assess several signs at the same time.",
]),
"ET2.1": ("What to film: a doll for the infant; an adult volunteer to simulate the older child (do not do real thrusts on a volunteer).", [
    "A choking child has a foreign body in the airway. Act at once.",
    "For an infant: lay the infant on your arm or thigh, head down. Give 5 blows to the middle of the back with the heel of your hand.",
    "If the obstruction persists, turn the infant over and give 5 chest thrusts with two fingers, one finger's breadth below the nipple level, in the midline.",
    "Check the mouth and remove any obstruction you can see. Repeat back slaps and chest thrusts if necessary.",
    "For an older child: give 5 blows to the back with the heel of the hand, with the child sitting, kneeling or lying. If the obstruction persists, go behind the child, pass your arms around the body, form a fist below the sternum and give 5 sharp upward thrusts: the Heimlich manoeuvre.",
    "Then check the mouth, and check the breathing. Repeat if necessary.",
]),
"ET2.2": ("What to film: a doll on a firm surface; a team of four for the log roll.", [
    "If you suspect neck trauma, do not tilt the head. Open the airway with a jaw thrust: place your fingers behind the angles of the jaw and lift it forward.",
    "Stabilize the neck: keep the child lying on the back, tape the forehead to the sides of a firm board, and support the head, for example with litre bags of IV fluid on each side.",
    "If the child vomits, use the log roll, so that the head stays in line with the body.",
    "To move a child with a suspected neck injury, avoid rotation and extremes of flexion and extension. One person, usually the most senior, takes responsibility for the neck: standing at the top end, holding the head, with gentle traction to keep the neck straight and in line with the body. The others turn the child together, as one unit.",
]),
"ET2.3": ("What to film: real children (with consent) or teaching clips showing each sign.", [
    "Look at the child's breathing. Is the child breathing at all?",
    "Look for central cyanosis: a bluish or purplish colour of the tongue and the inside of the mouth.",
    "Look for signs of severe respiratory distress: very fast breathing; severe chest indrawing; the use of the auxiliary muscles; head nodding; grunting; and stridor, a harsh noise when the child breathes in.",
    "A child who is not breathing, or has central cyanosis, or severe respiratory distress has an emergency sign. Manage the airway, give oxygen, and make sure the child is warm.",
]),
"ET2.4": ("What to film: a resuscitation doll; bag and mask in three sizes.", [
    "If the child is not breathing after the airway has been opened, ventilate with a bag and mask.",
    "Choose a mask that covers the nose and the mouth, but not the eyes. Position the head, with the neck slightly extended in a child, or in the neutral position in an infant.",
    "Hold the mask firmly on the face, with a good seal. Squeeze the bag and watch the chest rise. If the chest does not rise, reposition the head and check the seal.",
    "Ventilate at a steady rate, and check whether the child starts to breathe.",
]),
"ET2.5": ("What to film: an oxygen concentrator and a cylinder with flow meter; nasal prongs and nasal catheter on a doll.", [
    "Oxygen comes from an oxygen concentrator or from an oxygen cylinder with a regulator, a pressure gauge and a flow meter.",
    "Nasal prongs are placed just inside the nostrils and taped on the cheeks.",
    "A nasal catheter is measured from the side of the nostril to the inner eyebrow, and passed into the nostril to that distance. It should not be visible below the uvula.",
    "Set a flow rate of 0.5 to 1 litre per minute in infants and 1 to 2 litres per minute in older children, and check that the oxygen is flowing and the prongs or catheter stay in place.",
]),
"ET3.1": ("What to film: a nurse feeling a child's hand, pressing the nail, finding radial, brachial and carotid pulses.", [
    "Circulation: first, feel the child's hand. Are the hands warm? If they are warm, the child does not have shock: move on to consciousness.",
    "If the hands are cold, check the capillary refill. Press the nail of the thumb or the big toe for 3 seconds, until it turns white, release, and count the seconds until the pink colour returns. More than 3 seconds is a sign of shock.",
    "Then feel the radial pulse, at the wrist. If it is difficult to find, feel a more central pulse: in an infant, the brachial pulse in the middle of the upper arm, or the femoral pulse in the groin; in an older child, the carotid pulse in the neck. Is it weak and fast?",
    "A child with cold hands, capillary refill longer than 3 seconds, and a weak and fast pulse has shock. Stop any bleeding, give oxygen, make sure the child is warm, and check for severe malnutrition before you give fluids.",
]),
"ET3.2": ("What to film: a doll or a training arm; IV cannula, tape, Ringer's lactate, a bottle marked with tape.", [
    "Choose a vein: the back of the hand, the front of the elbow, the foot, or a scalp vein in an infant.",
    "Clean the skin, insert the cannula, and when blood comes back, take blood for emergency laboratory tests: blood glucose, haemoglobin or PCV, and malaria where needed.",
    "Secure the cannula with tape and attach the drip.",
    "For a child with shock and no severe malnutrition, infuse 20 ml per kilogram of Ringer's lactate or normal saline as rapidly as possible. Mark the bottle with tape at the level where the dose will have been given.",
    "Then reassess the child: the hands, the capillary refill, the pulse, and the level of consciousness.",
]),
"ET3.3": ("What to film: a chicken thigh bone and an intraosseous needle on a metal tray.", [
    "If you cannot find a vein quickly, use an intraosseous infusion.",
    "The site is the front of the tibia, one to two centimetres below the tibial tuberosity, on the flat inner surface.",
    "Clean the skin. Insert the needle at a 90 degree angle to the bone, with the bevel pointing towards the foot, using a gentle but firm twisting or drilling motion, until you feel a sudden decrease in resistance.",
    "Remove the stylet, aspirate 1 ml of marrow to confirm the position, flush with 5 ml of fluid, and start the infusion. Check that the calf does not swell.",
    "Do not use a bone with a fracture, or a site with infection.",
]),
"ET4.1": ("What to use: the AVPU video exercise (4 children). Turn the sound off for the exercise part.", [
    "In this exercise you will decide the level of consciousness of each child, using the AVPU scale.",
    "A: is the child alert? V: if not, does the child respond to voice? P: if not, does the child respond to pain? U: a child who does not respond to voice, being shaken, or pain is unresponsive, unconscious.",
    "A child who responds only to voice is lethargic. A child with P or U is in coma and needs emergency treatment.",
    "Watch each child. Write your answer: lethargic, or unconscious. Then check your answers with your facilitator.",
]),
"ET4.2": ("What to film: dextrostix and lancet; a doll; D10 and D50, sterile water, syringes; an NG tube.", [
    "In every child with coma or convulsion, check the blood glucose.",
    "Put a drop of blood on the reagent area of the strip. After 60 seconds, wash the blood off gently with drops of cold water, and compare the colour with the key on the bottle, or use a reading machine.",
    "Low blood glucose is less than 2.5 millimoles per litre in a well-nourished child, or less than 3 in a severely malnourished child. If you cannot measure it, assume it is low and treat.",
    "Give 5 ml per kilogram of 10% glucose rapidly by IV. If you only have 50% glucose, mix 1 part of 50% glucose with 4 parts of sterile water.",
    "Recheck the glucose after 30 minutes. Feed the child as soon as conscious. If the child cannot feed safely, give milk or sugar water by nasogastric tube, or IV fluid with 5 to 10% glucose.",
]),
"ET4.3": ("What to film: a doll; a diazepam ampoule; a tuberculin syringe with the needle removed.", [
    "Diazepam is the first drug for a child who is convulsing in front of you. Do not give it if the convulsion has stopped.",
    "The rectal dose is 0.5 milligrams per kilogram, which is 0.1 ml per kilogram of the 10 milligrams in 2 ml solution. Use Table 7 if you cannot weigh the child.",
    "Draw up the dose into a tuberculin syringe, then remove the needle. Insert the syringe 4 to 5 centimetres into the rectum, inject, and hold the buttocks together for a few minutes.",
    "Reassess after 10 minutes. If the child is still convulsing, give a second dose, or paraldehyde. Diazepam can affect breathing: reassess the airway and breathing regularly.",
    "Do not give rectal diazepam to an infant less than one month old: phenobarbital is used for young infants.",
]),
"ET5.1": ("What to use: the dehydration video exercise: sunken eyes (6 children) and skin pinch (5 children).", [
    "In this exercise you will look for two signs of dehydration.",
    "First, sunken eyes. For each of the six children, decide: does the child have sunken eyes, yes or no?",
    "Then, the skin pinch. Pinch the skin of the abdomen, halfway between the umbilicus and the side, in a head-to-foot direction, for one second, then release. For each of the five children, decide: does the skin go back very slowly, slowly, or immediately?",
    "A child with diarrhoea and any two of lethargy, sunken eyes, and a very slow skin pinch has severe dehydration.",
    "Write your answers, then compare them with the answer cards.",
]),
"ET5.2": ("What to film: a rolled towel as the limb; cannula, Ringer's lactate, adult and paediatric burettes; a bottle marked with tape.", [
    "Insert the cannula into the limb at a realistic angle, and tape it down. Attach the fluid and check that the drip runs freely.",
    "Work out the volume. For Plan C, an infant gets 30 ml per kilogram in the first hour, then 70 ml per kilogram in 5 hours. A child aged one to five years gets 30 ml per kilogram in 30 minutes, then 70 ml per kilogram in 2 and a half hours.",
    "Work out the drops per minute. With a paediatric burette, 60 drops per ml, the drops per minute equal the ml per hour. With an adult set, 20 drops per ml, divide the ml per hour by three.",
    "Mark the bottle at the level where the volume will have been given. Reassess every one to two hours, and give ORS as soon as the child can drink.",
]),
"ET6.1": ("What to film: a role play by facilitators with a doll. First version: poor practice. Second version: the same case managed well.", [
    "Watch this case twice.",
    "In the first version, the team makes mistakes. Note what goes wrong: who checks the airway, when is treatment started, is the child reassessed?",
    "In the second version, the same case is managed well. The health worker assesses airway and breathing first, says aloud what is found, starts each treatment as soon as an emergency sign is found, calls for help, and reassesses the child.",
    "After the video, discuss the differences with your facilitator. Then you will manage the scenarios yourself.",
]),
"ET7.1": ("What to film: a short closing message; a hospital emergency area organised for triage.", [
    "Congratulations: you have completed the Sudan ETAT course.",
    "Your work to implement ETAT now begins. ETAT is not only training: it needs changes in how your hospital receives sick children.",
    "Triage every child immediately on arrival, before registration or payment. Keep the wall charts where children arrive. Make sure emergency drugs, fluids, glucose and oxygen are always available.",
    "Use your plan of action, and work with your colleagues and your hospital management. Every minute saved for a very sick child can save a life.",
]),
}

pkg = json.load(open(sys.argv[1], encoding="utf-8"))
where = {}
for m in pkg["modules"]:
    for s in m["sections"]:
        for b in s["read"]:
            if b["type"] == "video":
                where[b["script"]] = (m["title"], s["title"], b["title"])
missing = set(where) - set(S)
assert not missing, missing
d = docx.Document()
d.styles["Normal"].font.size = Pt(11)
d.add_heading("Sudan ETAT course: voice-over scripts", 0)
d.add_paragraph("One script per video placeholder in the course. Each video block in a lesson shows its code (for example ET2.1). "
                "The scripts use only the information in the WHO ETAT manual for participants and the ETAT facilitator guide. Record each "
                "video, upload it to YouTube, and send the link with its code; the link is then put into the course.")
for code, (m, s, title) in where.items():
    film, paras = S[code]
    d.add_heading(f"{code}: {title}", 1)
    d.add_paragraph(f"{m.split(':')[0]}, lesson “{s}”")
    p = d.add_paragraph(); r = p.add_run(film); r.italic = True
    for t in paras:
        d.add_paragraph(t)
d.save(sys.argv[2])
print("scripts:", len(where))
