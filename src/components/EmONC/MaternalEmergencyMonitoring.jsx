// src/components/EmONC/MaternalEmergencyMonitoring.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, PageHeader, Button, Select, FormGroup, Input, Modal, Table, Spinner, EmptyState } from "../CommonComponents";
import { listObservationsForParticipant, listCasesForParticipant, upsertCaseAndObservations, deleteCaseAndObservations } from '../../data.js';
import { SKILLS_EENC_BREATHING, SKILLS_EENC_NOT_BREATHING, EENC_DOMAIN_LABEL_BREATHING, EENC_DOMAIN_LABEL_NOT_BREATHING, calcPct, fmtPct, pctBgClass } from '../constants.js';

const generateHash = (buffer) => Object.keys(buffer).sort().map(k => `${k}:${buffer[k]}`).join('|');

// --- EENC MAPPING ---
const MAP_EENC_BREATHING = {
    title: "EENC (Breathing)",
    domains: Object.keys(SKILLS_EENC_BREATHING).reduce((acc, key) => {
        acc[EENC_DOMAIN_LABEL_BREATHING[key]] = SKILLS_EENC_BREATHING[key].map(item => item.text);
        return acc;
    }, {})
};

const MAP_EENC_NOT_BREATHING = {
    title: "EENC (Not Breathing)",
    domains: Object.keys(SKILLS_EENC_NOT_BREATHING).reduce((acc, key) => {
        acc[EENC_DOMAIN_LABEL_NOT_BREATHING[key]] = SKILLS_EENC_NOT_BREATHING[key].map(item => item.text);
        return acc;
    }, {})
};

// --- MATERNAL CHECKLISTS ---
export const MATERNAL_CHECKLISTS = {
    eenc_breathing: MAP_EENC_BREATHING,
    eenc_not_breathing: MAP_EENC_NOT_BREATHING,
    placenta: {
        title: "Manual Removal of Placenta",
        domains: {
            "Getting Ready": [
                "1. Prepare the necessary equipment.",
                "2. Explain to the woman and her support person) what is going to be done, listen to her and respond attentively to her questions and concerns.",
                "3. Provide continual emotional support and reassurance, as feasible.",
                "4. Insert a catheter to empty bladder",
                "5. Give anaesthesia (IV pethidine and diazepam, or ketamine).",
                "6. Give a single dose of prophylactic antibiotics",
                "7. Put on personal protective equipment."
            ],
            "Manual Removal of Placenta": [
                "1. Use antiseptic handrub or wash hands and forearms thoroughly with soap and water and dry with a sterile cloth or air dry.",
                "2. Put high-level disinfected or sterile surgical gloves on both hands. (Note: elbow-length gloves should be used, if available ).",
                "3.Hold the umbilical cord with a clamp.",
                "4. Pull the cord gently until it is parallel to the floor.",
                "5. Place the fingers of one hand into the vagina and into the uterine cavity, following the direction of the cord until the placenta is located.",
                "6. When the placenta has been located, let the cord down and move that hand onto the abdomen to support the fundus abdominally and to provide countertraction to prevent uterine inversion.",
                "7. Move the fingers of the hand in the uterus laterally until the edge of the placenta is located.",
                "8. Keeping the fingers tightly together, ease the edge of the hand gently between the placenta and the uterine wall, with the palm facing the placenta.",
                "9. Gradually move the hand back and forth in a smooth lateral motion until the whole placenta is separated from the uterine wall: if the placenta does not separate from the uterine wall by gentle lateral movement of the fingers at the line of cleavage, suspect placenta accreta and arrange for surgical intervention.",
                "10. When the placenta is completely separated: palpate the inside of the uterine cavity to ensure that all placental tissue has been removed slowly withdraw the hand from the uterus bringing the placenta with it continue to provide counter-traction to the fundus by pushing it in the opposite direction of the hand that is being withdrawn.",
                "11. Give oxytocin 20 units in 500ML IV fluid (normal saline or Ringer’s lactate) at 30dpm.",
                "12. Have an assistant massage the fundus to encourage a tonic uterine contraction.",
                "13. If there is continued heavy bleeding, give ergometrine 0.5mg IM or give misoprostol 600 mcg SL or 800 mcg PR or prostaglandins",
                "14. Examine the uterine surface of the placenta to ensure that it is complete.",
                "15. Examine the woman carefully and repair any tears to the cervix or vagina, or repair episiotomy."
            ],
            "Post-Procedure Tasks": [
                "1. Dispose of needle and syringe in a puncture-proof container.",
                "2. Remove gloves and discard them in a leak-proof container or plastic bag.",
                "3. Use antiseptic handrub or wash hands thoroughly with soap and water and dry with a clean, dry cloth or air dry.",
                "4. Monitor vaginal bleeding and take the woman's vital signs in level two care (HDU): every 15 minutes for one hour then every 30 minutes for two hours.",
                "5. Make sure that the uterus is firmly contracted.",
                "6. Record procedure and findings on woman's record."
            ]
        }
    },
    labour_check: {
        title: "Labour Check & Normal Delivery",
        domains: {
            "Getting Ready": [
                "1. Prepare the necessary equipment.",
                "2. Allow the woman to push spontaneously.",
                "3. Allow the woman to adopt the position of choice.",
                "4. Explain to the woman (and her support person) what is going to be done, listen to her and respond attentively to her questions and concerns.",
                "5. Provide continual emotional support and reassurance, as feasible."
            ],
            "Conducting The Childbirth": [
                "1. Put on a clean plastic or rubber apron, rubber boots and eye goggles.",
                "2. Use antiseptic handrub or wash hands thoroughly with soap and water and dry with a sterile cloth or air dry.",
                "3. Put high-level disinfected or sterile surgical gloves on both hands.",
                "4. Clean the perineum with a cloth or compress, wet with antiseptic solution or soap and water, wiping from front to back.",
                "5. Place one sterile drape from the delivery pack under the woman’s buttocks, one over her abdomen and use the third drape to receive the newborn."
            ],
            "Delivery of the Head": [
                "1. Place fingers of one hand on the advancing head to sustain flexion and control birth of the head.",
                "2. Use the other hand to support the perineum with a pad, cloth, or compress.",
                "3. As the perineum distends, decide whether an episiotomy is necessary (e.g., if the perineum is very tight). If needed, provide perineal infiltration with lidocaine and perform an episiotomy (see Learning Guide for Episiotomy and Repair).",
                "4. Maintain firm but gentle pressure on the head to encourage flexion.",
                "5. Ask the woman to gently blow out each breath in order to avoid pushing.",
                "6. After crowning, allow the head to gradually extend under your hand.",
                "7. Using a clean cloth, wipe the mucus (and membranes if needed) from the baby’s mouth and nose.",
                "8. Gently feel around the newborn’s neck for the cord: if the cord is around the neck but loose, slip it over the baby’s head if the cord is loose but cannot reach over the head, slacken the cord so that it can slip backwards over the shoulders as the shoulders are born if the cord is tightly wound around the neck, clamp the cord with two artery forceps, placed 3cm apart, and cut the cord between the two clamps.",
                "9. Allow restitution and external rotation of the head to occur."
            ],
            "Delivery of the shoulders": [
                "1. Place one hand on either side of the newborn’s head, over the ears.",
                "2. Apply gentle downward traction to allow the anterior shoulder to slip beneath the symphysis pubis.",
                "3. When the axillary crease is seen, guide the head and trunk in an upward curve to allow the posterior shoulder to escape over the perineum.",
                "4. Grasp the newborn around the chest to aid the birth of the trunk and lift the newborn towards the woman’s abdomen.",
                "5. Note the time of birth."
            ],
            "Immediate Care of the Newborn": [
                "1. Dry the newborn quickly and thoroughly with a clean, dry towel/cloth immediately after birth.",
                "2. Wipe the newborn’s eyes with a clean piece of cloth.",
                "3. Place the newborn in skin-to-skin contact on the mother’s abdomen and cover with a clean, dry towel/cloth.",
                "4. Observe the newborn’s breathing while completing steps 1 and 2: if the newborn is not breathing, begin resuscitation measures (see the appropriate Learning Guide for Newborn Resuscitation) if the newborn is breathing normally, continue with the following care."
            ],
            "Clamping and cutting the cord": [
                "1. Place two clamps on the cord with enough room between them to allow for easy cutting of the cord.",
                "2. Cut the cord, using sterile scissors under cover of a gauze swab to prevent blood spurting.",
                "3. Tie the cord tightly 2.5cm from the newborn’s abdomen.",
                "4. Leave the newborn in skin-to-skin contact on the mother’s abdomen or chest, covered by a clean, dry towel/cloth.",
                "5. Palpate the mother’s abdomen to rule out the presence of another baby.",
                "6. Give 1O IU oxytocin intramuscularly.",
                "7. If oxytocin is not available, give a single oral dose of misoprostol 600mcg"
            ],
            "Active Management of the Third Stage": [
                "1. Explain to the woman (and her support person) what is going to be done, listen to her and respond attentively to her questions and concerns.",
                "2. Provide continual emotional support and reassurance, as feasible,",
                "3. Ask an assistant to place a sterile receptacle (e.g., kidney basin) against the woman’s perineum."
            ],
            "Delivering and examining the placenta": [
                "1. Clamp the cord close to the perineum with forceps.",
                "2. Wait for the uterus to contract.",
                "3. Use one hand to grasp the forceps with the clamped end of the cord,",
                "4. Place the other hand just above the level of the sytphysis pubis, on top of the drape covering the woman’s abdomen, with the palm facing towards the mother’s umbilicus and gently apply counter-traction in an upward direction.",
                "5. At the same time, firmly apply traction to the cord. in a downward direction, using the hand that is grasping the forceps.",
                "6. Apply steady tension by pulling the cord firmly and maintaining pressure (jerky movements and force must be avoided): • if the manoeuvre is not successful within 30-40 seconds, stop pulling, wait for the next contraction and repeat.",
                "7. When the placenta is visible at the vaginal opening, hold it in both hands.",
                "8. Use a gentle upward and downward movement or twisting action to deliver the membranes.",
                "9. Hold the placenta in the palms of the hands, with maternal side facing upward.",
                "10. Immediately and gently massage the uterus through the woman’s abdomen until it is well contracted.",
                "11. Check whether all of the lobules are present and fit together",
                "12. Now hold the cord with one hand and allow the placenta and membranes to hang down.",
                "13. Insert the other hand inside the membranes, with fingers spread out.",
                "14. Inspect the membranes for completeness.",
                "15. Note the position of insertion of the cord.",
                "16. Inspect the cut end of the cord for the presence of two arteries and one vein.",
                "17. Place the placenta in the receptacle (e.g., kidney basin) provided.",
                "18. Show the mother how to massage her uterus to maintain contractions."
            ],
            "Examining the birth canal": [
                "1. Ask assistant to direct a strong light onto the perineum.",
                "2. Gently separate the labia and inspect the lower vagina for lacerations/tears.",
                "3. Inspect the perineum for lacerations/tears, start at the cervix.",
                "4. Repair episiotorny (if one was performed) (see Learning Guide for Episiotomy and Repair).",
                "5. Wash the vulva and perineum gently with warm water or an antiseptic solution and dry with a clean, soft cloth.",
                "6. Place a clean cloth or pad on the woman’s perineum.",
                "7. Remove soiled bedding, make the woman comfortable, and cover her with a blanket.",
                "8. Before removing gloves, place soiled linen in 0.5% chlorine solution for 10 minutes for decontamination."
            ],
            "Post Birth Tasks": [
                "1. Before removing gloves, dispose of waste materials in a leak-proof container or plastic bag and dispose of the placenta by placing in a leak-proof container for burial",
                "2. Place all instrument1s in 0.5% chlorine solution for 10 minutes for decontamination.",
                "3.Remove gloves and discard them in a leak-proof container or plastic bag",
                "4.flush needle and syringe with 0.5% chlorine solution three times, then place in a puncture proof container",
                "5. Use antiseptic handrub or wash hands thoroughly with soap and water and dry with a clean, dry cloth or air dry.",
                "6. Record all findings on woman’s record."
            ]
        }
    },
    forceps: {
        title: "Learning Guide for FORCEPS",
        domains: {
            "GETTING READY": [
                "Prepare the necessary equipment.",
                "Explain to the woman (and her support person) what is going to be done, listen to her and respond attentively to her questions and concerns",
                "Provide continual emotional support and reassurance, as feasible.",
                "Review to ensure that the following conditions for forceps are present: Vertex presentation, Term foetus, Cervix fully dilated, Head at least at a +2 station",
                "Make sure an assistant is available.",
                "Put on personal protective equipment."
            ],
            "PRE-PROCEDURE TASKS": [
                "Use an antiseptic hand rub or wash your hands thoroughly with soap and water, then dry them with a sterile cloth or air dry.",
                "Put on high-level, disinfected, or sterile surgical gloves on both hands.",
                "Clean the vulva with an antiseptic solution.",
                "Catheterize the bladder, if necessary.",
                "Check that the forceps are paired and of suitable size."
            ],
            "Forceps application": [
                "Place the left blade in the left hand",
                "Apply to the left side of the woman’s pelvis",
                "Cephalic curve faces inward toward the vulva to pass around the head",
                "Shank vertical at start",
                "Pencil grip to avoid excessive force",
                "Right hand protects the maternal tissue, applies force",
                "Repeat for the right side",
                "Articulate handles and lock"
            ],
            "Gentle traction = (Pajot manoeuvre)": [
                "Axis traction follows a pelvic curve",
                "Initial traction downward, then sweeping in a large, J-shaped arc",
                "Nondominant hand exerts downward traction, causing two vectors of force: horizontal outward and vertical downward",
                "Handle is elevated to follow the J-shaped pelvic curve.",
                "Evaluate for Incision for episiotomy when the perineum distends",
                "Remove forceps when the Jaw is reachable",
                "Perform active management of the third stage of labour to deliver the placenta: Give 10 IU oxytocin intramuscularly, If oxytocin is not available, give a single oral dose of misoprostol 600 mcg, Control cord traction, Massage the uterus.",
                "Check the birth canal for tears following childbirth and repair, if necessary.",
                "Repair the episiotomy, if one was performed.",
                "Provide immediate postpartum and newborn care, as required."
            ],
            "POST-PROCEDURE TASKS": [
                "Before removing gloves, dispose of waste materials in a leak-proof container or plastic bag.",
                "Place all instruments in a 0.5% chlorine solution for 10 minutes for decontamination.",
                "Use antiseptic hand rub or wash hands thoroughly with soap and water and dry with a clean, dry cloth or air dry.",
                "Immerse both gloved hands in a 0.5% chlorine solution. Remove gloves by turning them inside out and place them in a leak-proof container or plastic bag",
                "Record the procedure and findings on the woman's record"
            ]
        }
    },
    vacuum: {
        title: "Learning Guide for Vacuum Extraction",
        domains: {
            "Getting Ready": [
                "1. Prepare the necessary equipment.",
                "2. Explain to the woman (and her support person) what is going to be done, listen to her and respond attentively to her questions and concerns.",
                "3. Provide continual emotional support and reassurance, as feasible.",
                "4. Review to ensure that the following conditions for vacuum extraction are present: vertex presentation, term fetus, cervix fully dilated, head at least at 0 station or no more than 2/5 palpable above the symphysis pubis.",
                "5. Make sure an assistant is available.",
                "6. Put on personal protective equipment."
            ],
            "Pre-Procedure Tasks": [
                "1. Use antiseptic handrub or wash hands thoroughly with soap and water and dry with a sterile cloth or air dry.",
                "2. Put high-level disinfected or sterile surgical gloves on both hands.",
                "3. Clean the vulva with antiseptic solution.",
                "4. Catheterize the bladder, if necessary.",
                "5. Check all connections on the vacuum extractor and test the vacuum on a gloved hand."
            ],
            "Vacuum Extraction": [
                "1. Assess the position of the fetal head by feeling the sagittal suture line and the fontanelles.",
                "2. Identify the posterior fontanelle.",
                "3. Apply the largest cup that will fit, with the centre of the cup over the flexion point, 3 cm anterior to the posterior fontanelle.",
                "4. Perform an episiotomy, if necessary, for proper placement of the cup (see Learning Guide for Episiotomy and Repair): if episiotomy is not necessary for placement of the cup, delay until the head stretches the perineum or the perineum interferes with the axis of traction.",
                "5. Check the application and ensure that there is no maternal soft tissue (cervix, or vagina) within the rim of the cup: if necessary, release pressure and reapply the cup.",
                "6. Have the assistant create a vacuum of negative pressure with the pump and check the application of the cup.",
                "7. Increase the vacuum of negative pressure and check the application of the cup.",
                "8. After maximum negative pressure has been applied, start traction in the line of the pelvic axis and perpendicular to the cup: if the fetal head is tilted to one side or not flexed well, traction should be directed in a line that will try to correct the tilt or deflexion of the head (i.e., to one side or the other, not necessarily in the midline).",
                "9. With each contraction, apply traction in a line perpendicular to the plane of the cup rim: place a gloved finger on the scalp next to the cup during traction to assess potential slippage and descent of the vertex.",
                "10. Between each contraction have assistant check: fetal heart rate, application of the cup.",
                "11. With progress, and in the absence of fetal distress, continue the guiding pulls for a maximum of 20 minutes.",
                "12. When the head has been delivered, release the vacuum, remove the cup and complete the birth of the newborn.",
                "13. Perform active management of the third stage of labour to deliver the placenta: give 10 IU oxytocin intramuscularly if oxytocin is not available, give a single oral dose of misoprostol 600mcg control cord traction massage uterus.",
                "14. Check the birth canal for tears following childbirth and repair, if necessary.",
                "15. Repair the episiotomy, if one was performed (see Learning Guide for Episiotomy and Repair).",
                "16. Provide immediate postpartum and newborn care, as required."
            ],
            "Post-Procedure Tasks": [
                "1. Before removing gloves, dispose of waste materials in a leak-proof container or plastic bag.",
                "2. Place all instruments in a 0.5% chlorine solution for 10 minutes for decontamination.",
                "3. Use antiseptic hand rub or wash hands thoroughly with soap and water and dry with a clean, dry cloth or air dry.",
                "4. Immerse both gloved hands in a 0.5% chlorine solution. Remove gloves by turning them inside out and place them in a leak-proof container or plastic bag",
                "5. Record the procedure and findings on the woman's record."
            ]
        }
    },
    aorta: {
        title: "Compression of the Abdominal Aorta",
        domains: {
            "Getting Ready": [
                "1. Explain to the woman (and her support person) what is going to be done, listen to her and respond attentively to her questions and concerns.",
                "2. Provide continual emotional support and reassurance, as feasible."
            ],
            "Compression of the Abdominal Aorta": [
                "1. Place a closed fist just above the umbilicus and slightly to the left. Palpate the aortic pulse.",
                "2. Apply downward pressure over the abdominal aorta directly through the abdominal wall.",
                "3. With the other hand, palpate the femoral pulse to check the adequacy of compression: if the pulse is palpable during compression, the pressure is inadequate if the pulse is not palpable during compression, the pressure is adequate.",
                "4. Maintain compression, releasing intermittently every five minutes until bleeding is controlled."
            ],
            "Post-Procedure Tasks": [
                "1. Monitor vaginal bleeding and take the woman's vital signs in level two care (HDU): every 15 minutes for one hour then every 30 minutes for two hours.",
                "2. Make sure that the uterus is firmly contracted."
            ]
        }
    },
    bimanual: {
        title: "Bi-Manual Compression of the Uterus",
        domains: {
            "Getting Ready": [
                "1. Explain to the woman (and her support person) what is going to be done, listen to her and respond attentively to her questions and concerns.",
                "2. Provide continual emotional support and reassurance, as feasible.",
                "3. Put on personal protective equipment."
            ],
            "Bi-Manual Compression": [
                "1. Use antiseptic handrub or wash hands thoroughly with soap and water and dry with a sterile cloth or air dry.",
                "2. Put high-level disinfected or sterile surgical gloves on both hands.",
                "3. Clean the vulva and perineum with antiseptic solution.",
                "4. Insert one hand into the vagina and form a fist.",
                "5. Place the fist into the anterior vaginal fornix and apply pressure against the anterior wall of the uterus.",
                "6. Place the other hand on the abdomen behind the uterus.",
                "7. Press the abdominal hand deeply into the abdomen and apply pressure against the posterior wall of the uterus.",
                "8. Maintain compression until bleeding is controlled and the uterus contracts."
            ],
            "Post-Procedure Tasks": [
                "1. Remove gloves and discard them in leak-proof container or plastic bag.",
                "2. Use antiseptic handrub or wash hands thoroughly with soap and water and dry with a clean, dry cloth or air dry.",
                "3. Monitor vaginal bleeding and take the woman's vital signs in level two care (HDU): every 15 minutes for one hour then every 30 minutes for two hours.",
                "4. Make sure that the uterus is firmly contracted."
            ]
        }
    },
    adult_resuscitation: {
        title: "Adult Resuscitation",
        domains: {
            "General Management": [
                "SHOUT FOR HELP to urgently mobilize available personnel.",
                "Greet the woman respectfully and with kindness.",
                "If the woman is conscious and responsive, explain to the woman (and her support person) what is going to be done, listen to her and respond attentively to her questions and concerns.",
                "Provide continual emotional support and reassurance, as feasible."
            ],
            "immediate management": [
                "Check the woman’s vital signs: respiration. pulse blood pressure temperature",
                "Turn the woman onto her side and ensure that her airway is open. If the woman is not breathing, begin resuscitation measures.",
                "Give oxygen at 6-8L per minute by facemask or nasal cannula.",
                "Cover the woman with a blanket to ensure warmth.",
                "Elevate the woman’s legs—if possible, by raising the foot of the bed."
            ],
            "BLOOD COLLECT1ON AND FLUID REPLACEMENT": [
                "Use antiseptic handrub or wash hands thoroughly with soap and water and dry with a sterile cloth or air dry.",
                "Put new examination or high-level disinfected surgical gloves on both hands.",
                "Connect IV infusion set to a bottle of normal saline or Ringer’s lactate.",
                "Run fluid through infusion set.",
                "Select a suitable site for infusion (e.g., back of hand or forearm).",
                "Place a tourniquet around the woman’s upper arm.",
                "Put new examination or high-level disinfected surgical gloves on both hands.",
                "Clean skin at site selected for infusion.",
                "Insert 16- or 18-gauge needle or cannula into the vein.",
                "Draw blood for haemoglobin, cross-matching and bedside clotting test.",
                "Detach syringe from needle or cannula.",
                "Connect IV infusion set to needle or cannula.",
                "Secure the needle or cannula with adhesive plaster or tape",
                "Adjust IV infusion set to run fluid at a rate sufficiently rapid to infuse 1L in 15-20 minutes.",
                "Place the blood drawn into a labelled test tube for haemoglobin and cross-matching.",
                "Place 2mL of blood into a small glass test tube (approximately 10mm x 75mm) to do a bedside clotting test: hold the test tube in your closed fist to keep it warm after four minutes, tip the tube slowly to see if a clot is forming tip it again every minute until the blood clots and the tube can be turned upside down if a clot fails to form or a soft clot forms that breaks down easily, coagulopathy is possible.",
                "If the woman is not breathing or is not breathing well, perform endotracheal intubation and ventilate with an Ambo bag.",
                "Before removing gloves, dispose of waste materials in a leak-proof container or plastic bag.",
                "Dispose of gloves in plastic bag.",
                "Use antiseptic handrub or wash hands thoroughly with soap and water and dry with a sterile cloth or air dry."
            ],
            "Bladder Catheterization": [
                "Put new examination or high-level disinfected surgical gloves on both hands.",
                "Clean the external genitalia.",
                "Insert catheter into the urethral orifice and allow urine to drain into a clean container, and measure and record the amount.",
                "Secure the catheter and attach it to urine drainage bag.",
                "Dispose of gloves, in a leak-proof container or plastic bag.",
                "Use antiseptic handrub or wash hands thoroughly with soap and water and dry with a clean, dry cloth or air dry."
            ],
            "Reassessment and Further Management": [
                "Reassess the woman’s response to IV fluids within 30 minutes for signs of improvement: stabilizing pulse (90 beats per minute or less) increasing systolic blood pressure (100mm Hg or more) improving mental status (less confusion or anxiety) increasing urine output (3OmL/hour or more).",
                "If the woman’s condition improves: adjust the rate of IV infusion to one L in six hours continue management for underlying cause of shock.",
                "If the woman’s condition fails to improve: infuse normal saline rapidly until her condition improves continue oxygen at 6-8L/minute continue to monitor vital signs every 15 minutes and intake and output every hour arrange for additional laboratory tests.",
                "Check for bleeding. If heavy bleeding is seen, take steps to stop the bleeding and transfuse blood, if necessary.",
                "Perform the necessary history, physical examination and tests to determine cause of shock if not already known."
            ]
        }
    },
    breech: {
        title: "Learning Guide for Breech Delivery",
        domains: {
            "Getting Ready": [
                "1. Prepare the necessary equipment.",
                "2. Explain to the woman (and her support person) what is going to be done, listen to her and respond attentively to her questions and concerns.",
                "3. Provide continual emotional support and reassurance, as feasible.",
                "4. Review to ensure that the following conditions for breech delivery are present: complete or frank breech adequate clinical pelvimetry, especially that sacral promontory is not tipped fetus is not too large no previous Caesarean section flexed head.",
                "5. Put on personal protective equipment.",
                "6. Start an IV infusion."
            ],
            "Pre-Procedure Tasks": [
                "1. Use antiseptic handrub or wash hands thoroughly with soap and water and dry with a sterile cloth or air dry.",
                "2. Put high-level disinfected or sterile surgical gloves on both hands.",
                "3. Clean the vulva with antiseptic solution.",
                "4. Catheterize the bladder, if necessary."
            ],
            "Delivery of the buttocks and legs": [
                "1. When the buttocks have entered the vagina and the cervix is fully dilated, tell the woman she can bear down with contractions.",
                "2. As the perineum distends, decide whether an episiotomy is necessary (e.g., if the perineum is very tight). If needed, provide perineal infiltration with lidocaine and perform an episiotomy (see Learning Guide for Episiotomy and Repair).",
                "3. Let the buttocks deliver until the lower back and then the shoulder blades are seen.",
                "4. Gently hold the buttocks in one hand, but do not pull.",
                "5. If the legs do not deliver spontaneously, deliver one leg at a time (pinard maneuver) push behind the knee to bend the leg grasp the ankle and deliver the foot and leg repeat for the other leg.",
                "6. Hold the newborn by the hips, but do not pull."
            ],
            "Delivery of the arms": [
                "1. If the arms are felt on the chest, allow them to disengage spontaneously: after spontaneous delivery of the first arm, lift the buttocks towards the mother's abdomen to enable the second arm to deliver spontaneously if the arm does not deliver spontaneously, place one or two fingers in the elbow and bend the arm, bringing the hand down over the newborn's face.",
                "2. If the arms are stretched above the head or folded around the neck, use Lovset's maneuver: hold the newborn by the hips and turn half a circle, keeping the back uppermost apply downward traction at the same time so that the posterior arm becomes anterior, and deliver the arm under the pubic arch by placing one or two fingers on the upper part of the arm draw the arm down over the chest as the elbow is flexed, with the hand sweeping over the face to deliver the second arm, turn the newborn back half a circle while keeping the back uppermost and applying downward traction to deliver the second arm in the same way under the pubic arch.",
                "3. If the newborn's body cannot be turned to deliver the arm that is anterior first, deliver the arm that is posterior: hold and lift the newborn up by the ankles move the newborn's chest towards the woman's inner leg to deliver the posterior shoulder deliver the arm and hand lay the newborn down by the ankles to deliver the anterior shoulder deliver the arm and hand."
            ],
            "Delivery of the head": [
                "1. Deliver the head by the Mauriceau Smellie Veit manoeuvre: lay newborn face down with the length of its body over your hand and arm place first and second fingers of this hand on the newborn's cheekbones use the other hand to grasp the newborn's shoulders with middle finger of this hand over the occiput, gently flex the newborn's head towards the chest at the same time apply downward pressure on the cheek to bring the newborn's head down until the hairline is visible pull gently to deliver the head ask an assistant to push gently above the mother's pubic bone as the · head delivers raise the newborn, still astride the arm, until the mouth and nose are free.",
                "2. Perform active management of the third stage of labour to deliver the placenta: give 10 IU oxytocin intramuscularly if oxytocin is not available, give a single oral dose of misoprostol 600mcg control cord traction massage uterus.",
                "3. Check the birth canal for tears following childbirth and repair, if necessary.",
                "4. Repair the episiotomy, if one was performed (see Learning Guide for Episiotomy and Repair).",
                "5. Provide immediate postpartum and newborn care, as required."
            ],
            "Post-procedure Tasks": [
                "Before removing gloves, dispose of waste materials in a leak-proof container or plastic bag",
                "Place all instruments in 0.5% chlorine solution for 10 minutes for decontamination",
                "Immerse both gloved hands in 0.5% chlorine solution. Remove gloves by turning them inside out and place them in a leak-proof container or a plastic bag.",
                "Use anti-septic handrub or wash hands thoroughly with soap and water and dry with a clean, dry cloth or air dry",
                "Record the procedure and findings on woman’s record"
            ]
        }
    },
    mva: {
        title: "MVA Plus Aspirator and Easy Grip Cannula",
        domains: {
            "Step 1: Prepare the aspirator": [
                "Position the plunger all the way inside the cylinder.",
                "Have collar stop in place with tabs in the cylinder holes.",
                "Push valve buttons down and forward until they lock (Ipas diagram)",
                "Pull plunger back until arms snap outward and catch on cylinder base (Ipas diagram)"
            ],
            "Step 2: Prepare the patient": [
                "Administer pain medication to have maximum effect when procedure begins.",
                "Give prophylactic antibiotics to all women, and therapeutic antibiotics if indicated.",
                "Ask the woman to empty her bladder.",
                "Conduct a bimanual exam to confirm uterine size and position.",
                "Insert speculum and observe for signs of infection, bleeding or incomplete abortion. (Ipas diagram)"
            ],
            "Step 3: Perform cervical antiseptic": [
                "Use antiseptic-soaked sponge to clean cervical os. Start at os and spiral outward without retracing areas. Continue until os has been completely covered by antiseptic. (Ipas diagram)"
            ],
            "Step 4: Administer Paracervical block and place Tenaculum": [
                "Paracervical block is recommended when mechanical dilatation is required with MVA.",
                "Use lowest anesthetic dose possible to avoid toxicity – for example, if using lidocaine, the recommended dose is less than 200 mg. (Ipas diagram)"
            ],
            "Step 5: Dilatation of the cervix": [
                "Observe no-touch technique when dilating the cervix and during aspiration. Instruments that enter the uterine cavity should not touch your gloved hands, the patient’s skin, the woman’s vaginal walls, or unsterile parts of the instrument tray before entering the cervix.",
                "Use mechanical dilators or progressively larger cannulae to gently dilate the cervix to the right size."
            ],
            "Step 6: Insertion of the cannula": [
                "While applying traction to Tenaculum, insert cannula through the cervix, just past the os and into the uterine cavity until it touches the fundus, and then withdraw it slightly.",
                "Do not insert the cannula forcefully. (Ipas diagram)"
            ],
            "Step 7: Suction uterine content": [
                "Attach the prepared aspirator to the cannula if the cannula and aspirator were not previously attached.",
                "Release the vacuum by pressing the buttons.",
                "Evacuate the contents of the uterus by gently and slowly rotating the cannula 180° in each direction, using an in-and-out motion.",
                "When the procedure is finished, depress the buttons and disconnect the cannula from the aspirator. Alternatively, withdraw the cannula and aspirator without depressing the buttons. (Ipas diagram)",
                "Signs that indicate the uterus is empty: Red or pink foam without tissue is seen passing through the cannula.",
                "A gritty sensation is felt as the cannula passes over the surface of the evacuated uterus.",
                "The uterus contracts around or grips the cannula.",
                "The patient complains of cramping or pain, indicating that the uterus is contracting."
            ],
            "Step 8: Inspect tissue": [
                "Empty the contents of the aspirator into a container.",
                "Strain material, float in water or vinegar and view with a light from beneath.",
                "Inspect tissue for products of conception, complete evacuation and molar pregnancy.",
                "If inspection is inconclusive, reaspiration or other evaluation may be necessary, (Ipas diagram)"
            ],
            "Step 9: Perform any concurrent procedure": [
                "When procedure is complete, proceed with contraception or other procedures, such as IUD insertion or cervical tear repair."
            ],
            "Step 10: Process instruments": [
                "Immediately process or discard all instruments, according to local protocols."
            ]
        }
    },
    shoulder_dystocia: {
        title: "Shoulder Dystocia Checklist",
        domains: {
            "Initial Steps & Management": [
                "1. SHOUT FOR HELP to urgently mobilize available personnel.",
                "2. Greet the woman respectfully and with kindness.",
                "3. Explain to the woman (and her support person) what is going to be done.",
                "4. Provide continual emotional support and reassurance, as feasible.",
                "Check instruments.",
                "Management: check the woman had IV line.",
                "Wash hands with antiseptic and put on sterile gloves and PPE.",
                "Wash vulva and perineum with antiseptic.",
                "Evaluate for episiotomy.",
                "Raise the woman legs to flex and adduct thighs. McRobert. maneuver.",
                "Suprapubic pressure by an assistant. Rubin 1."
            ],
            "Enter maneuvers": [
                "Rubin 11 maneuver, place two fingers behind anterior shoulder and apply pressure to move it to oblique diameter. Continue McRobert maneuver.",
                "Woods screw maneuver. Place two fingers of the other hand anterior to the posterior shoulder gently try to rotate the shoulders.",
                "Reversed Wood’s screw maneuver. Remove finger that anterior to posterior shoulder and sweep the fingers posterior to the anterior shoulder to be posterior to the posterior shoulder and try gently to rotate the shoulder in a position opposite to Wood’s screw direction.",
                "Remove posterior arm, follow posterior arm down to elbow, flex at elbow, sweep arm across the chest, don’t hod from humorous or hand to avoid fractures. Confirm position of infant, Make entering hand small, Enter birth canal ‐ introduce appropriate hand into introitus at 6 o'clock, Follow along anterior aspect of infant’s chest to find forearm or hand If not found, arm will be behind back,so change hands.",
                "Roll the patient (Gaskin maneuver), increases pelvic dimensions and gravity enhancement, deliver posterior shoulder. May repeat all enter maneuvers."
            ],
            "Secondary maneuvers & Last Resort": [
                "Secondary maneuvers: try all enter maneuvers.",
                "posterior sling maneuver. Head is gently held upward by an assistant, Flex fourth and fifth fingers of each hand and press against the woman’s perineum at the 6 o’clock position, Both middle fingers are both placed into the axilla, The fingers overlap each other, Traction downward and outward along the curve of the sacrum",
                "Maneuvers of last resort: Zavanelli, fetal replacement, • Flex fetal head to replace. •Cephalic replacement followed by emergency cesarean delivery. • Requires anesthesia, operative team, tocolysis . • Not an option if nuchal cord has been clamped and cut symphysiotomy and abdominal recue."
            ],
            "Post-Delivery": [
                "After delivery of the fetus, clamp the cord, start resuscitation according to fetal condition",
                "Deliver the placenta and inspect it.",
                "Suture episiotomy if done.",
                "Remove gloves and dispose waste appropriately."
            ]
        }
    }
};

// ============================================================================
// UI COMPONENTS
// ============================================================================

function ActionToggle({ currentValue, onClick }) {
    const options = [
        ['Done', 1, 'bg-green-600 border-green-600'],
        ['Not Done', 0, 'bg-red-600 border-red-600'],
        ['N/A', -1, 'bg-gray-500 border-gray-500']
    ];
    
    return (
        <div className="relative z-0 inline-flex shadow-sm rounded-md flex-shrink-0">
            {options.map(([label, value, activeClass], idx) => {
                const isSelected = currentValue === value;
                const baseClass = "relative inline-flex items-center justify-center px-3 py-1 text-sm font-medium focus:z-10 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition";
                const activeState = isSelected ? `${activeClass} text-white` : "bg-white text-gray-700 hover:bg-gray-50";
                
                let roundedClass = "";
                if (idx === 0) roundedClass = "rounded-l-md";
                if (idx === options.length - 1) roundedClass = "rounded-r-md";
                if (options.length === 1) roundedClass = "rounded-md";
                if (idx > 0) roundedClass += " -ml-px border border-gray-300";
                else roundedClass += " border border-gray-300";

                return (
                    <button
                        key={value}
                        type="button"
                        className={`${baseClass} ${activeState} ${roundedClass}`}
                        onClick={() => onClick(value)}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

export function MaternalEmergencyMonitoring({ course, participant, onCancel, isPublicView = false }) {
    const [observations, setObservations] = useState([]);
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [encounterDate, setEncounterDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dayOfCourse, setDayOfCourse] = useState(1);
    
    const [scenario, setScenario] = useState('placenta');
    const [caseSerial, setCaseSerial] = useState(1);
    const [buffer, setBuffer] = useState({});
    const [editingCase, setEditingCase] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const [showSetupModal, setShowSetupModal] = useState(true);
    const [showGrid, setShowGrid] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [expandedDomains, setExpandedDomains] = useState(new Set());

    useEffect(() => {
        const fetchData = async () => {
            if (!participant?.id || !course?.id) return;
            setLoading(true);
            try {
                const [obsData, casesData] = await Promise.all([
                    listObservationsForParticipant(course.id, participant.id),
                    listCasesForParticipant(course.id, participant.id)
                ]);
                const maternalCases = casesData.filter(c => c.age_group?.startsWith('Maternal_'));
                setObservations(obsData);
                setCases(maternalCases);
            } catch (err) {
                console.error("Failed to fetch monitoring data:", err);
                setError("Could not load participant's data.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [participant?.id, course?.id]);

    useEffect(() => {
        if (editingCase) return;
        const sameDayCases = cases.filter(c => c.day_of_course === dayOfCourse);
        const maxS = sameDayCases.reduce((m, x) => Math.max(m, x.case_serial || 0), 0);
        setCaseSerial(Math.max(1, maxS + 1));
    }, [cases, dayOfCourse, editingCase]);

    const handleEditCase = (caseToEdit) => {
        if (!caseToEdit) return;
        setEditingCase(caseToEdit);
        setEncounterDate(caseToEdit.encounter_date);
        setDayOfCourse(caseToEdit.day_of_course);
        setScenario(caseToEdit.age_group.replace('Maternal_', ''));
        
        const caseObs = observations.filter(o => o.caseId === caseToEdit.id);
        const newBuffer = {};
        caseObs.forEach(o => { newBuffer[`${o.domain}|${o.item_recorded}`] = o.item_correct; });
        setBuffer(newBuffer);
        setShowSetupModal(false);
        setShowGrid(true);
        window.scrollTo(0, 0);
    };

    const handleToggle = (domain, item, value) => {
        const k = `${domain}|${item}`;
        setBuffer(prev => (
            prev[k] === value 
                ? (({ [k]: _, ...rest }) => rest)(prev) 
                : { ...prev, [k]: value }
        ));
    };

    const toggleDomain = (domain) => {
        setExpandedDomains(prev => {
            const newSet = new Set(prev);
            if (newSet.has(domain)) newSet.delete(domain);
            else newSet.add(domain);
            return newSet;
        });
    };

    const submitCase = async () => {
        if (isSaving) return; 
        const entries = Object.entries(buffer);
        if (entries.length === 0) { 
            alert('No skills/actions selected.'); 
            return; 
        }

        setIsSaving(true);
        const currentCaseSerial = editingCase ? editingCase.case_serial : caseSerial;
        const allCorrect = entries.every(([, v]) => v > 0);

        const caseData = {
            courseId: course.id, 
            participant_id: participant.id, 
            encounter_date: encounterDate,
            setting: 'N/A', 
            age_group: `Maternal_${scenario}`, 
            case_serial: currentCaseSerial, 
            day_of_course: dayOfCourse, 
            allCorrect: allCorrect,
            contentHash: generateHash(buffer)
        };

        const newObservations = entries.map(([k, v]) => {
            const [domain, skill_or_class] = k.split('|');
            return {
                courseId: course.id, 
                course_type: course.course_type, 
                encounter_date: encounterDate,
                day_of_course: dayOfCourse, 
                setting: 'N/A', 
                participant_id: participant.id,
                domain: domain, 
                item_recorded: skill_or_class, 
                item_correct: v, 
                case_serial: currentCaseSerial,
                age_group: `Maternal_${scenario}`
            };
        });

        try {
            const { savedCase, savedObservations } = await upsertCaseAndObservations(caseData, newObservations, editingCase?.id);

            if (editingCase) {
                setCases(prev => prev.map(c => c.id === editingCase.id ? savedCase : c));
                setObservations(prev => [...prev.filter(o => o.caseId !== editingCase.id), ...savedObservations]);
            } else {
                setCases(prev => [...prev, savedCase]);
                setObservations(prev => [...prev, ...savedObservations]);
            }

            setShowSuccessModal(true);
            setBuffer({});
            setEditingCase(null);
        } catch (err) {
            console.error(err);
            alert(`Failed to save case: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCase = async (caseToDelete) => {
        if (!window.confirm('Delete this case and all its observations? This cannot be undone.')) return;
        const previousCases = [...cases];
        const previousObservations = [...observations];

        setCases(prev => prev.filter(c => c.id !== caseToDelete.id));
        setObservations(prev => prev.filter(o => o.caseId !== caseToDelete.id));

        try {
            await deleteCaseAndObservations(caseToDelete.id);
        } catch (err) {
            setCases(previousCases);
            setObservations(previousObservations);
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const currentChecklist = MATERNAL_CHECKLISTS[scenario] || MATERNAL_CHECKLISTS['placenta'];
    const currentDomains = Object.keys(currentChecklist.domains);

    useEffect(() => {
        if (showGrid) setExpandedDomains(new Set(currentDomains.slice(0, 2)));
    }, [scenario, showGrid]);

    return (
        <div className="grid gap-2">
            <PageHeader title="Maternal Emergency Monitor" subtitle={`Observing: ${participant.name}`} />
            {error && <Card><div className="p-4 bg-red-100 text-red-700 rounded-md">{error}</div></Card>}

            <Modal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} title="Submission Successful">
                <div className="p-6 text-center">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Case Saved Successfully!</h3>
                    <Button onClick={() => { setShowSuccessModal(false); setShowGrid(false); setShowSetupModal(true); }} className="w-full bg-green-600 hover:bg-green-700">
                        Continue to Next Case
                    </Button>
                </div>
            </Modal>

            <Modal isOpen={showSetupModal} onClose={() => setShowSetupModal(false)} title="Case Setup Configuration" size="lg">
                <div className="p-4">
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm text-blue-800 mb-4">
                        <strong>Category:</strong> Maternal Emergencies
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormGroup label="Select Maternal Form / Checklist" className="sm:col-span-2">
                            <Select value={scenario} onChange={(e) => {
                                setScenario(e.target.value);
                                setBuffer({});
                            }} disabled={!!editingCase}>
                                {Object.entries(MATERNAL_CHECKLISTS).map(([key, data]) => (
                                    <option key={key} value={key}>{data.title}</option>
                                ))}
                            </Select>
                        </FormGroup>
                        <FormGroup label="Encounter Date"><Input type="date" value={encounterDate} onChange={(e) => setEncounterDate(e.target.value)} /></FormGroup>
                        <FormGroup label="Course Day"><Select value={dayOfCourse} onChange={(e) => setDayOfCourse(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{d}</option>)}</Select></FormGroup>
                    </div>
                </div>
                <div className="p-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
                    <Button variant="secondary" onClick={() => { setShowSetupModal(false); setShowGrid(false); }}>Close</Button>
                    <Button onClick={() => { setShowSetupModal(false); setShowGrid(true); }}>Confirm & Start</Button>
                </div>
            </Modal>

            {!showGrid && !loading && (
                <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Ready to monitor?</h3>
                        <p className="text-sm text-slate-500">Start a new observation case for {participant.name}.</p>
                    </div>
                    <Button onClick={() => { setBuffer({}); setEditingCase(null); setShowSetupModal(true); }}>
                        + Start New Case
                    </Button>
                </div>
            )}

            {showGrid && (
                <Card className="p-4 mb-4">
                    <div className="flex justify-between items-start mb-4 bg-slate-50 p-3 rounded-md border border-slate-200">
                        <div>
                            <h3 className="text-lg font-semibold">{editingCase ? `Editing Case #${editingCase.case_serial}` : 'New Case Observation'}</h3>
                            <p className="text-sm text-slate-600 mt-1">
                                <span className="font-semibold">Day:</span> {dayOfCourse} &bull; <span className="font-semibold ml-2">Date:</span> {encounterDate} &bull; <span className="font-semibold ml-2">Checklist:</span> {currentChecklist.title}
                            </p>
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => setShowSetupModal(true)}>
                            Edit Setup
                        </Button>
                    </div>

                    <div className="flex gap-2 mb-4">
                        <Button size="sm" variant="secondary" onClick={() => setExpandedDomains(new Set(currentDomains))}>Expand All</Button>
                        <Button size="sm" variant="secondary" onClick={() => setExpandedDomains(new Set())}>Collapse All</Button>
                    </div>

                    <div className="space-y-3">
                        {currentDomains.map(d => {
                            const isExpanded = expandedDomains.has(d);
                            const items = currentChecklist.domains[d];
                            return (
                                <div key={d} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all duration-200">
                                    <button 
                                        type="button"
                                        onClick={() => toggleDomain(d)} 
                                        className={`w-full flex items-center justify-between p-4 transition-colors ${isExpanded ? 'bg-sky-50 border-b border-sky-100' : 'bg-white hover:bg-slate-50'}`}
                                    >
                                        <h4 className="text-base font-bold text-slate-800 text-left">{d}</h4>
                                    </button>
                                    
                                    {isExpanded && (
                                        <div className="divide-y divide-slate-100 bg-white">
                                            {items.map((item, i) => {
                                                const k = `${d}|${item}`;
                                                const mark = buffer[k];
                                                return (
                                                    <div key={`${d}-${i}`} className="flex flex-col sm:flex-row justify-between sm:items-start p-3 sm:px-5 hover:bg-sky-50/50 gap-3 group">
                                                        <span className="font-medium text-sm text-slate-700 mt-1">{item}</span>
                                                        <div className="flex-shrink-0">
                                                            <ActionToggle currentValue={mark} onClick={(value) => handleToggle(d, item, value)} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex justify-end gap-3 mt-4 border-t pt-4">
                        <Button variant="secondary" onClick={() => { setBuffer({}); setEditingCase(null); setShowGrid(false); }} disabled={isSaving}>Discard</Button>
                        <Button onClick={submitCase} disabled={isSaving}>{isSaving ? 'Saving...' : (editingCase ? 'Update Case' : 'Submit Case')}</Button>
                    </div>
                </Card>
            )}

            {loading ? <Card><Spinner /></Card> : (
                <SubmittedMaternalCases cases={cases} observations={observations} onEditCase={handleEditCase} onDeleteCase={handleDeleteCase} />
            )}
        </div>
    );
}

function SubmittedMaternalCases({ cases, observations, onEditCase, onDeleteCase }) {
    if (cases.length === 0) return <Card className="p-8 text-center text-gray-500">No cases submitted yet.</Card>;
    
    return (
        <Card className="p-4">
            <h3 className="text-lg font-bold mb-4">Submitted Maternal Cases</h3>
            <Table headers={["Date", "Day", "Checklist", "Score", "Actions"]}>
                {cases.sort((a,b) => b.day_of_course - a.day_of_course || b.case_serial - a.case_serial).map(c => {
                    const relatedObs = observations.filter(o => o.caseId === c.id);
                    const total = relatedObs.length;
                    const correct = relatedObs.filter(o => o.item_correct > 0).length;
                    const checklistName = MATERNAL_CHECKLISTS[c.age_group?.replace('Maternal_', '')]?.title || c.age_group;
                    const pct = total > 0 ? (correct/total)*100 : 0;
                    return (
                        <tr key={c.id} className="hover:bg-slate-50 border-b text-sm">
                            <td className="p-2">{c.encounter_date}</td>
                            <td className="p-2 text-center">{c.day_of_course}</td>
                            <td className="p-2">{checklistName}</td>
                            <td className={`p-2 text-center font-mono ${pctBgClass(pct)}`}>{fmtPct(pct)} ({correct}/{total})</td>
                            <td className="p-2 text-right">
                                <Button size="sm" variant="secondary" onClick={() => onEditCase(c)} className="mr-2">Edit</Button>
                                <Button size="sm" variant="danger" onClick={() => onDeleteCase(c)}>Delete</Button>
                            </td>
                        </tr>
                    );
                })}
            </Table>
        </Card>
    );
}