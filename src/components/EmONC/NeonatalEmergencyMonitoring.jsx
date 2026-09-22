// src/components/EmONC/NeonatalEmergencyMonitoring.jsx
import React, { useState, useEffect } from 'react';
import { Card, PageHeader, Button, Select, FormGroup, Input, Modal, Table, Spinner } from "../CommonComponents";
import { listObservationsForParticipant, listCasesForParticipant, upsertCaseAndObservations, deleteCaseAndObservations } from '../../data.js';
import { SKILLS_EENC_BREATHING, SKILLS_EENC_NOT_BREATHING, EENC_DOMAIN_LABEL_BREATHING, EENC_DOMAIN_LABEL_NOT_BREATHING, SKILLS_EMONC_NEONATAL, calcPct, fmtPct, pctBgClass } from '../constants.js';
import { notify, confirmDialog } from '../dialogs';

// --- SCORING SCALE ---
// Done = full credit  |  Partially = half credit  |  Not Done = no credit  |  N/A = excluded from the score
export const SCORE_DONE = 1;
export const SCORE_PARTIAL = 0.5;
export const SCORE_NOT_DONE = 0;
export const SCORE_NA = -1;

const isScored = (v) => v !== SCORE_NA && v !== undefined && v !== null;
const creditOf = (v) => (v === SCORE_DONE ? 1 : v === SCORE_PARTIAL ? 0.5 : 0);
const fmtScore = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const generateHash = (buffer) => Object.keys(buffer).sort().map(k => `${k}:${buffer[k]}`).join('|');

// --- EENC MAPPING (Shared) ---
const MAP_EENC_BREATHING = {
    title: "Early Essential Newborn Care (Breathing)",
    domains: Object.keys(SKILLS_EENC_BREATHING).reduce((acc, key) => {
        acc[EENC_DOMAIN_LABEL_BREATHING[key]] = SKILLS_EENC_BREATHING[key].map(item => item.text);
        return acc;
    }, {})
};

const MAP_EENC_NOT_BREATHING = {
    title: "Early Essential Newborn Care (Not Breathing)",
    domains: Object.keys(SKILLS_EENC_NOT_BREATHING).reduce((acc, key) => {
        acc[EENC_DOMAIN_LABEL_NOT_BREATHING[key]] = SKILLS_EENC_NOT_BREATHING[key].map(item => item.text);
        return acc;
    }, {})
};

export const NEONATAL_CHECKLISTS = {
    eenc_breathing: MAP_EENC_BREATHING,
    eenc_not_breathing: MAP_EENC_NOT_BREATHING,
    neonatal_assessment: {
        title: "Initial Neonatal Assessment",
        domains: { "Assessment": SKILLS_EMONC_NEONATAL.assessment.map(i => i.text) }
    },
    advanced_resuscitation: {
        title: "Advanced Neonatal Resuscitation",
        domains: { "Resuscitation & Management": SKILLS_EMONC_NEONATAL.resuscitation.map(i => i.text) }
    },
    newborn_exam: {
        title: "Newborn Examination (Competency Checklist)",
        domains: {
            "1. Know the baby": ["1. Reviews the antenatal and birth history: preterm, membranes ruptured more than 18 hours, maternal fever, difficult birth or asphyxia, known anomaly.", "2. States gestational age, birth weight, and Apgar score at 1, 5 and 10 minutes."],
            "2. Prepare": ["1. Washes hands. Warm room, no draught. Warm flat surface, good light.", "2. Greets the mother, explains what will be done, keeps her beside the baby.", "3. Keeps the baby covered between parts. Handles the baby as little as possible."],
            "3. Temperature, weight & measurements": ["1. Takes the axillary temperature correctly. States normal: 36.5–37.5 °C.", "2. Acts on it at once — below 36.5 °C: skin-to-skin, hat, cover, re-check. Above 37.5 °C: remove extra clothing, re-check.", "3. Weighs on a calibrated scale and records the weight.", "4. Classifies the weight: 2500 g and above normal · 1500 to below 2500 g low birth weight · below 1500 g very low birth weight.", "5. Measures length, head circumference and chest circumference and plots on appropriate centiles."],
            "4. Look before you touch": ["1. Colour: pink, pale, blue or yellow.", "2. Activity: active, lethargic, or not responding.", "3. Tone and posture: normal flexion, floppy, or stiff. Both sides move equally."],
            "5. Breathing": ["1. Counts the respiratory rate for one full minute. States normal: 30–60 per minute.", "2. Looks for chest indrawing, grunting, nasal flaring, apnoea.", "3. Looks at the shape of the chest and whether both sides move equally."],
            "6. Circulation": ["1. Counts the heart rate by listening for one full minute. States normal: 100–160 per minute.", "2. Feels the brachial and femoral pulses and compares arms with legs.", "3. Checks capillary refill (normal under 3 seconds) and whether hands and feet are warm."],
            "7. Head and face": ["1. Fontanelle (flat, bulging or sunken), sutures, moulding, caput, cephalhaematoma.", "2. Eyes: discharge, redness, cloudy cornea. Confirms eye care was given.", "3. Ears: shape and position.", "4. Mouth: looks AND feels the palate for a cleft. Tongue, mucous membranes, thrush."],
            "8. Abdomen, cord, genitalia, anus": ["1. Abdomen: distension, visible loops of bowel, gastroschisis, exomphalos. Palpates gently for liver, spleen, kidneys and masses.", "2. Cord: clean and dry, no bleeding, no redness or pus, nothing applied, no binder.", "3. Genitalia: ambiguous genitalia, hypospadias, undescended testes.", "4. Anus present and in the normal position. Asks whether the baby has passed urine and meconium."],
            "9. Back, limbs, hips, skin": ["1. Turns the baby over. Looks at and feels the whole spine: swelling, dimple, tuft of hair, open lesion.", "2. All four limbs: number of digits, joined or extra digits, talipes, swelling, an arm that does not move.", "3. Hips: Barlow and Ortolani. Notes any click, clunk or limited abduction.", "4. Skin: jaundice and how far down it reaches, pustules, blisters, petechiae, rash, birthmarks.", "5. If jaundiced: states the zone, when bilirubin will be measured, and the treatment threshold."],
            "10. Neurology": ["1. Tone of the head and trunk, and of the limbs.", "2. Moro, rooting and sucking reflexes — present, equal on both sides, good strength.", "3. Names the subtle signs of seizure: lip smacking, cycling movements, eye deviation, apnoea. Separates these from jitteriness, which stops when you hold the limb."],
            "11. Feeding": ["1. Watches a breastfeed, or assesses the baby’s ability to suck.", "2. Checks attachment: chin touching the breast, mouth wide open, lower lip turned out, more areola above the mouth than below. Notes suck and swallow.", "3. Classifies: feeding well · feeding difficulty · unable to feed — and states what to do for each."],
            "12. Preventive care": ["1. Vitamin K 1 mg intramuscularly given. Site and time documented.", "2. Eye care given correctly.", "3. Immunisations given as per the national schedule, or the date planned."],
            "13. Classify, plan, tell, record": ["1. CRITICAL — Names every danger sign found: breathing over 60 per minute, chest indrawing, temperature below 35.5 °C or above 38 °C, not feeding, no movement or lethargy, convulsions.", "2. Classifies the baby: routine care · intermediate care · advanced care.", "3. States a plan that matches the classification. If sepsis is suspected, gives the first dose of antibiotic without delay.", "4. Explains the findings and the plan to the mother in words she understands.", "5. Records findings, weight, temperature, feeding, classification and plan in the notes."]
        }
    },
    shock: {
        title: "Shock in Neonates",
        domains: {
            "Airway (A)": ["1. Assesses airway patency and positions the newborn to open the airway"],
            "Breathing (B)": ["2. Assesses respiratory rate and effort (apnoea, grunting, flaring); gives oxygen or ventilation if hypoxaemic or distressed"],
            "Circulation (C)": ["3. Assesses heart rate, central and peripheral pulses, capillary refill, and extremity temperature (cold vs warm)", "4. Promptly establishes IV or IO access and draws initial labs (blood culture, metabolic panel, lactate)", "5. Administers normal saline / Ringer’s lactate bolus at 20 ml/kg (uses cautious 10 ml/kg if cardiogenic or preterm)", "6. Initiates broad-spectrum empirical antibiotics immediately (ideally after culture)", "7. Prepares vasopressors (dopamine, epinephrine) if hypotension persists after fluid resuscitation"],
            "Disability (D)": ["8. Checks blood glucose and treats hypoglycaemia with 10% dextrose 2 ml/kg IV bolus", "9. Keeps the baby warm throughout — does not expose an already cold baby"],
            "Reassessment & Escalation": ["10. Reassesses heart rate, capillary refill, urine output and respiratory status after each intervention", "11. Recognises failure to improve; suspects septic shock; prepares for referral"],
            "Communication": ["12. Communicates clearly with the team and updates the family"]
        }
    },
    hypoglycaemia: {
        title: "Neonatal Hypoglycaemia",
        domains: {
            "Airway (A) & Breathing (B)": ["1. Assesses for respiratory clinical signs consistent with hypoglycaemia (e.g. apnoea) to determine emergency status. Ensures airway patency"],
            "Circulation (C)": ["2. Admits or readmits the infant to the NICU and promptly obtains IV access", "3. Collects a blood sample for lab confirmation of blood glucose and hypoglycaemia screening tests; reviews the need to screen for and treat sepsis"],
            "Disability (D)": ["4. Correctly identifies clinical emergency criteria: blood glucose < 1.0 mmol/L OR clinical signs consistent with hypoglycaemia", "5. Administers an immediate IV bolus of 2.5 ml/kg of 10% dextrose, correctly calculated for the weight", "6. Follows the bolus with a continuous infusion of 10% dextrose at 60 ml/kg/day (can increase GIR by 2 mg/kg/min by increasing volume or concentration)", "7. Recognises and corrects hypothermia as a driver of hypoglycaemia"],
            "Reassessment (30 min)": ["8. Schedules and executes a blood glucose recheck exactly 30 minutes after the intervention", "9. If BG < 1.0 mmol/L OR abnormal clinical signs persist: repeats the entire cycle — another bolus, increases GIR, rechecks in 30 min", "10. If BG 1.0–2.5 mmol/L AND no abnormal signs: increases GIR by 2 mg/kg/min, continues oral feeds, rechecks in 30 min, and explicitly states an IV bolus is NOT indicated", "11. If BG > 2.5 mmol/L AND no abnormal signs: continues enteral feeds and initiates a slow wean of the IV infusion", "12. Continues monitoring BG until the infant is on full enteral feeds AND BG > 2.5 mmol/L (> 3.0 in hyperinsulinism) over several feed cycles for at least 24 hours"],
            "Documentation": ["13. Records glucose values, times, doses and clinical signs accurately"]
        }
    },
    seizures: {
        title: "Neonatal Seizures",
        domains: {
            "Airway (A) & Breathing (B)": ["1. Secures the airway and provides oxygen or ventilation as needed. Establishes continuous monitoring for respiratory depression. Recognizes that refractory cases may require an ICU setting with ventilator support"],
            "Circulation (C)": ["2. Promptly establishes IV access for medication delivery. Monitors blood pressure closely to watch for hypotension"],
            "Treat reversible causes": ["3. Phase 1 (0–15 min): checks and corrects reversible causes FIRST — hypoglycaemia (< 2.6 mmol/L) with D10W IV; hypocalcaemia (ionized Ca < 0.8) with 10% calcium gluconate IV; hypomagnesaemia (< 0.7) with MgSO₄; empiric antibiotics and workup if infection suspected"],
            "Recognition": ["4. Applies the STOP test and correctly distinguishes a true seizure from a mimic before giving any anticonvulsant"],
            "First-line meds": ["5. Administers phenobarbital: correctly calculates and gives a loading dose of 20 mg/kg IV over 20 minutes"],
            "Escalation 1": ["6. Phase 2 (15–60 min): reassesses after the loading dose. If seizures persist, gives an additional 10 mg/kg IV over 10 minutes. Recognizes the maximum loading dose is 40 mg/kg in the first 24 h"],
            "Escalation 2": ["7. If still seizing after 40 mg/kg, selects an appropriate second-line option: Levetiracetam · Fosphenytoin/phenytoin · Midazolam infusion · Lidocaine infusion"],
            "Refractory": ["8. Phase 3 (> 60 min): for refractory status epilepticus, escalates to comatose therapy (midazolam infusion to burst-suppression on EEG) or initiates critical metabolic trials (pyridoxine, pyridoxal-5′-phosphate, biotin, folinic acid) under EEG monitoring"],
            "Reassessment / maintenance": ["9. Plans maintenance dosing (phenobarbital 3–5 mg/kg/day PO or IV every 12 h, starting 12–24 h after loading) once seizures are controlled"],
            "Documentation & referral": ["10. Documents the seizure event on the standardized form; determines referral timing and prepares for safe transport"]
        }
    },
    referral_transport: {
        title: "Neonatal Referral and Transport",
        domains: {
            "Stabilization": ["1. Normalizes temperature BEFORE departure", "2. Secures the airway; correct neck position / ETT stabilized", "3. Assesses breathing and provides appropriate support", "4. Assesses circulation (pulses, CRT) and treats shock", "5. Checks blood glucose and prevents hypoglycaemia", "6. Gives antibiotics / anticonvulsants / vitamin K if indicated", "7. Places NG tube for distended abdomen; plans feeds or IV fluids"],
            "Equipment": ["8. Completes the equipment check before moving", "9. Calculates the oxygen requirement for the journey correctly"],
            "Team": ["10. Organizes the team and assigns clear duties"],
            "Communication": ["11. Counsels the parents using the eight counselling points", "12. Encourages the mother to accompany the baby", "13. Gives a clear handover to the receiving unit and obtains read-back", "14. Uses closed-loop communication with team members by name"],
            "Documentation": ["15. Writes a precise referral note with condition, reason and treatment given", "16. Records serial vital signs and temperature before and after transfer"],
            "Handover": ["17. Gives a detailed handover on arrival and transfers care formally"]
        }
    },
    kmc: {
        title: "Kangaroo Mother Care Positioning",
        domains: {
            "Prepare Mother": ["1. Washes hands correctly before handling the baby", "2. Explains the procedure to the mother and obtains her agreement", "3. Ensures privacy and a warm room", "4. Mother's chest is bare; baby wears only a hat and a nappy"],
            "Place baby": ["5. Places the baby in the fetal position — arms and hips flexed, slight hip abduction", "6. Baby is upright on the bare chest", "7. Turns the baby's head to one side in the 'sniffing' position", "8. Secures the baby with a cloth or wrap", "9. Head secured AT EAR LEVEL — neck neither hyperextended nor flexed", "10. Confirms the diaphragm can move freely — wrap is not restricting the abdomen", "11. Covers baby and parent with a shirt or blanket", "12. Arranges any cables and IV lines without tangles"],
            "Confirm": ["13. Checks the airway visually after positioning", "14. Confirms the mother is comfortable and can maintain the position", "15. States that the parent may lie down only if the baby is firmly secured", "16. Checks and records the baby's temperature", "17. Washes and dries hands", "18. Documents the procedure"]
        }
    },
    phototherapy: {
        title: "Phototherapy",
        domains: {
            "Preparation": ["1. Explains to the mother what phototherapy is and that she can still feed", "2. Undresses the baby to a nappy only — maximum skin exposure", "3. Applies eye covers correctly; confirms they do not occlude the nostrils", "4. Positions the light source at the correct distance"],
            "Operation": ["5. Starts the unit and records the time"],
            "Monitoring & Escalation": ["6. Ensures adequate feeding; states that phototherapy increases insensible water loss", "7. States temperature is monitored 2–4 hourly; recognises both hyper- and hypothermia", "8. Turns the baby to expose all surfaces; removes eye covers during feeds", "9. Repeats TSB every 6–12 hours initially", "10. States when to escalate — rise > 0.5 mg/dL/hr, approaching exchange threshold, failure to respond"],
            "Documentation": ["11. Documents device, start time, TSB trend, temperature and fluid status"]
        }
    },
    exchange_transfusion: {
        title: "Exchange Transfusion",
        domains: {
            "Preparation": ["1. Obtains informed consent from parents", "2. Specifies fresh (< 5 days), cross-matched, CMV-negative, irradiated, leukocyte-depleted", "3. Confirms compatibility with BOTH infant and mother", "4. Warms blood to 37 °C before transfusion", "5. Calculates double volume correctly — 160–180 mL/kg", "6. Corrects hypoglycaemia, hypocalcaemia and acidosis before starting", "7. Ensures aseptic technique, resuscitation equipment and monitoring ready"],
            "Technique": ["8. Describes push–pull; correct aliquot size for weight — 5–10 mL term, 2–5 mL preterm"],
            "Monitoring": ["9. Continuous cardiorespiratory monitoring; checks glucose, calcium, electrolytes, Hct, bilirubin", "10. Gives 10% calcium gluconate 1 mL/kg slow IV after every ~100 mL, WITH cardiac monitoring", "11. Continues INTENSIVE phototherapy after the exchange", "12. Rechecks bilirubin at 2 hours then every 4–6 hours"],
            "Documentation": ["13. Documents volume, aliquot, duration, complications and full blood details"]
        }
    },
    uvc: {
        title: "Umbilical Vein Catheterisation (UVC)",
        domains: {
            "Preparation": ["1. Calculates correct catheter length", "2. Flushes catheter with saline — no air", "3. Places baby under radiant warmer; restrains safely"],
            "Infection Control": ["4. Uses aseptic technique throughout, including the second glove change"],
            "Technique": ["5. Ties cord base; cuts stump 1.5–2 cm from skin", "6. Identifies umbilical vein correctly — not an artery", "7. Advances catheter toward right shoulder", "8. Stops once blood return achieved"],
            "Safety & Securing": ["9. Does not force against resistance", "10. Avoids hepatic infusion", "11. Secures catheter without tension", "12. Confirms catheter position by X-ray / ultrasound"],
            "Monitoring & Documentation": ["13. Detects infection / malposition", "14. Completes documentation"]
        }
    },
    uac: {
        title: "Umbilical Artery Catheter (UAC)",
        domains: {
            "Preparation": ["1. Selects correct catheter size for birth weight", "2. Calculates insertion length accurately for chosen position"],
            "Position & Infection Control": ["3. States high (T6–T9) vs low (L3–L4) and justifies the choice", "4. States that the tip must NEVER sit at T10–L2", "5. Maintains sterile field throughout"],
            "Technique": ["6. Identifies umbilical arteries correctly — two, thick-walled, small lumen", "7. Dilates the arterial lumen before insertion", "8. Aims caudally, towards the feet", "9. Inserts catheter gently, no force at the normal resistance points", "10. Achieves blood return"],
            "Safety & Securing": ["11. Avoids false tract or vessel injury", "12. Requests X-ray / ultrasound confirmation and reads tip against vertebrae", "13. Secures catheter correctly States haemorrhage risk — connections must never be left unsecured"],
            "Monitoring & Documentation": ["14. Inspects legs, feet and buttocks for ischaemia after insertion", "15. Identifies ischaemia / thrombosis signs and states the action", "16. Documents procedure fully"]
        }
    },
    picc: {
        title: "Peripherally Inserted Central Catheter (PICC)",
        domains: {
            "Preparation": ["1. Selects appropriate vein", "2. Measures insertion distance — and rechecks before opening the set"],
            "Infection Control": ["3. Applies FULL aseptic precautions — cap, mask, gown, large drape", "4. Prepares skin: spirit → dry → iodine → dry → spirit"],
            "Technique": ["5. Achieves venous access safely", "6. Advances catheter smoothly, slowly, without force", "7. Repositions limb / head rather than forcing when resistance met", "8. Advances to the measured length only"],
            "Safety & Securing": ["9. Avoids arterial cannulation", "10. States that the tip must NOT lie within the cardiac silhouette", "11. Secures line and applies transparent dressing keeping the site visible", "12. Requests imaging confirmation", "13. Does not use the line before the film is reviewed"],
            "Monitoring & Documentation": ["14. Monitors for complications — infection, malposition, effusion, thrombosis", "15. States that access should be minimised", "16. Completes documentation"]
        }
    },
    io_access: {
        title: "Intraosseous Access",
        domains: {
            "Preparation & Infection Control": ["1. Selects correct site — 1–2 cm below, 1 cm medial to tibial tuberosity", "2. Prepares skin aseptically"],
            "Technique": ["3. Directs needle away from the growth plate / joint", "4. Inserts with firm rotating motion", "5. Recognises loss of resistance and stops advancing", "6. Confirms needle stands firmly without support", "7. States that marrow aspiration is NOT necessary to confirm placement", "8. Injects 3 ml slowly to test placement", "9. Get sample for glucose, chemistry, group and cross-match, Hb, gas, culture"],
            "Safety & Securing": ["10. Inspects for swelling at the FRONT of the leg AND the calf", "11. If swelling: removes needle and uses the other leg", "12. If difficult infusion without swelling: withdraws ~0.5 cm and retries", "13. Secures needle and attaches standard IV tubing"],
            "Documentation": ["14. Documents procedure"]
        }
    },
    needle_thoracotomy: {
        title: "Needle Thoracotomy",
        domains: {
            "Preparation & Infection Control": ["1. Assembles cannula, three-way tap and syringe BEFORE puncture", "2. Prepares skin aseptically"],
            "Landmark": ["3. Identifies correct intercostal space"],
            "Technique & Confirmation": ["4. Inserts needle at correct intercostal space", "5. Advances over SUPERIOR rib margin — avoids the neurovascular bundle", "6. Identifies air release"],
            "Safety, Monitoring & Confirmation": ["7. Avoids over-evacuation", "8. Monitors respiratory improvement — air entry, saturation, heart rate", "9. Obtains X-ray AFTER decompression"],
            "Documentation": ["10. Documents procedure"]
        }
    },
    chest_tube: {
        title: "Chest Tube Insertion",
        domains: {
            "Preparation & Infection Control": ["1. Selects correct tube size for weight", "2. Positions baby correctly — arm abducted, affected side up", "3. Provides local anaesthetic and analgesia", "4. Maintains FULL aseptic technique — cap, mask, gown, drape"],
            "Landmark": ["5. Identifies correct insertion landmark — safe triangle, anterior to mid-axillary line"],
            "Technique": ["6. Performs BLUNT dissection safely — does not use the trocar", "7. Passes over the superior margin of the rib below", "8. Directs tube anteriorly for air, posteriorly/basally for fluid", "9. Inserts tube to correct depth — all side holes inside the chest"],
            "Safety & Securing": ["10. Avoids organ injury — lung, heart, internal mammary vessels", "11. Identifies misting and bubbling", "12. Connects drainage system correctly", "13. States that the drain is NEVER clamped, including for transport", "14. Secures tube properly without kinking", "15. Confirms placement with X-ray", "16. Monitors output, bubbling, swinging and complications"],
            "Documentation": ["17. Completes documentation"]
        }
    },
    lumbar_puncture: {
        title: "Lumbar Puncture",
        domains: {
            "Preparation": ["1. Positions baby correctly — hips and knees flexed, spine flexed", "2. Does NOT flex the neck", "3. Uses sterile technique", "4. Provides analgesia"],
            "Landmark": ["5. Identifies correct interspace on the intercristal line — L3–L4 or L4–L5"],
            "Technique": ["6. Inserts needle in the midline, angled towards the umbilicus, bevel up", "7. Advances slowly, removing the stylet frequently to check for CSF", "8. Collects CSF appropriately into the correct tubes", "9. Sends CSF glucose paired with a blood glucose"],
            "Safety": ["10. Avoids traumatic tap", "11. Replaces stylet before withdrawal", "12. Applies pressure and dressing", "13. Reassesses the baby — saturation, heart rate, breathing"],
            "Documentation": ["14. Documents procedure"]
        }
    },
    urinary_catheterisation: {
        title: "Urinary Catheterisation",
        domains: {
            "Preparation & Infection Control": ["1. Selects correct catheter size for weight", "2. Positions baby correctly", "3. Maintains sterile technique"],
            "Technique": ["4. Cleans meatus correctly, outward, fresh swab each time", "5. Lubricates catheter", "6. Inserts catheter correctly — correct anatomy for the sex"],
            "Safety & Monitoring": ["7. Does not force against resistance", "8. In girls, recognises vaginal placement and uses a fresh catheter", "9. Inflates balloon ONLY after urine flows", "10. Secures catheter without tension; bag below bladder level", "11. Observes for complications — trauma, blood, infection"],
            "Documentation": ["12. Documents procedure"]
        }
    },
    suprapubic_aspiration: {
        title: "Suprapubic Aspiration",
        domains: {
            "Preparation": ["1. Prepares site aseptically", "2. Provides analgesia — sucrose, non-nutritive sucking, or local", "3. Positions baby correctly — supine, frog-leg"],
            "Landmark": ["4. Identifies midline, 1–2 cm above the symphysis"],
            "Technique": ["5. Inserts needle at correct site and angle — perpendicular or slightly cephalad", "6. Aspirates WHILE advancing", "7. Advances only 2–3 cm; stops when urine appears", "8. Aspirates urine correctly and slowly"],
            "Safety": ["9. Avoids bowel injury — does not fan or redirect inside the abdomen", "10. If dry tap: withdraws completely, waits, retries once", "11. Applies pressure and dressing"],
            "Documentation": ["12. Documents procedure"]
        }
    },
    cpap_initiation: {
        title: "CPAP Initiation",
        domains: {
            "Equipment": ["1. Assembles the circuit; connects air and oxygen; humidifier with distilled water"],
            "Interface": ["2. Selects the correct prong size — biggest that fits without distending", "3. Fits the cap correctly — ears flat, not too small", "4. Applies barrier dressing; moistens prongs with saline", "5. Secures so the bridge does NOT abut the columella and does not blanch", "6. Inserts an orogastric tube"],
            "Settings": ["7. Sets correct starting CPAP for the indication — 5 cmH₂O RD, 4–5 apnoea, 5 post-extubation", "8. Sets starting FiO₂ and flow correctly; titrates FiO₂ to the unit's SpO₂ target"],
            "Monitoring": ["9. Confirms continuous bubbling in both phases", "10. States the danger signs to watch for after initiation"],
            "Documentation": ["11. Documents time and settings"]
        }
    },
    cpap_nasal_injury: {
        title: "CPAP Nasal Injury Prevention & Staging",
        domains: {
            "Prevention": ["1. Selects the correct prong size — no distension", "2. Applies a barrier dressing under the nose and over the bridge", "3. Confirms the bridge does not abut the columella and does not blanch", "4. Removes prongs/mask 4-hourly to rest the nose"],
            "Removal Technique": ["5. Removes by loosening tapes, not by pulling off the face", "6. Inspects columella, nares, eyes and ears at every physical check and stage accordingly"],
            "Documentation": ["7. Documents nasal appearance and any change with the time"]
        }
    },
    safe_medication: {
        title: "Safe Medication Administration",
        domains: {
            "Preparation": ["1. Prepares medication in a well-lit area, free from interruption"],
            "Calculation": ["2. Uses TODAY's weight; re-calculates rather than reusing a previous dose", "3. Calculates the dose correctly — decimal placement", "4. Performs unit conversion and dilution correctly"],
            "Five Rights": ["5. Confirms right patient, right drug, right dose, right time, right route"],
            "Double-check": ["6. Verifies the patient with two identifiers before administration", "7. A second person calculates INDEPENDENTLY before administration", "8. Does not assume the other person has already checked"],
            "Response": ["9. Assesses the baby's response to the dose"],
            "Documentation": ["10. Documents AFTER administration, accurately and promptly"]
        }
    },
    blood_culture: {
        title: "Blood Culture Collection",
        domains: {
            "Preparation & Infection Control": ["1. Verifies patient identity", "2. Calms the neonate and positions for access", "3. Prepares all materials before starting — gloves, alcohol, 23–25G, bottles, labels, transport bag", "4. Performs hand hygiene and wears sterile gloves", "5. Cleans site with 70% alcohol — full 30-second scrub", "6. Allows the site to AIR DRY before puncture", "7. Does NOT re-palpate the cleaned site"],
            "Collection": ["8. Obtains adequate BLOOD volume — 1–2 mL per bottle", "9. States CSF volume 1 mL per bottle, and that volume is critical for detection", "10. If already on antibiotics, takes the culture immediately BEFORE the next dose", "11. Uses sterile, labelled containers", "12. Labels with name, file ID, date/time, collector's name, sample type"],
            "Transport": ["13. Completes the culture request form; sends by the standard transferee procedure without delay"],
            "Documentation": ["14. Records sample collection in the main case record registry"]
        }
    }
};

function ActionToggle({ currentValue, onClick }) {
    const options = [
        ['Done', SCORE_DONE, 'bg-green-600 border-green-600'],
        ['Partially', SCORE_PARTIAL, 'bg-amber-500 border-amber-500'],
        ['Not Done', SCORE_NOT_DONE, 'bg-red-600 border-red-600'],
        ['N/A', SCORE_NA, 'bg-gray-500 border-gray-500']
    ];
    return (
        <div className="relative z-0 inline-flex shadow-sm rounded-md flex-shrink-0">
            {options.map(([label, value, activeClass], idx) => {
                const isSelected = currentValue === value;
                const baseClass = "relative inline-flex items-center justify-center px-2.5 py-1 text-sm font-medium whitespace-nowrap focus:z-10 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition";
                const activeState = isSelected ? `${activeClass} text-white` : "bg-white text-gray-700 hover:bg-gray-50";
                let roundedClass = "";
                if (idx === 0) roundedClass = "rounded-l-md";
                if (idx === options.length - 1) roundedClass = "rounded-r-md";
                if (options.length === 1) roundedClass = "rounded-md";
                if (idx > 0) roundedClass += " -ml-px border border-gray-300";
                else roundedClass += " border border-gray-300";
                return <button key={value} type="button" className={`${baseClass} ${activeState} ${roundedClass}`} onClick={() => onClick(value)}>{label}</button>;
            })}
        </div>
    );
}

export function NeonatalEmergencyMonitoring({ course, participant, participants, onChangeParticipant, onCancel, switchModule, isPublicView = false }) {
    const [observations, setObservations] = useState([]);
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [encounterDate, setEncounterDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dayOfCourse, setDayOfCourse] = useState(1);
    const [scenario, setScenario] = useState('eenc_breathing');
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
                const neonatalCases = casesData.filter(c => c.age_group?.startsWith('Neonatal_'));
                setObservations(obsData);
                setCases(neonatalCases);
            } catch (err) {
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
        setScenario(caseToEdit.age_group.replace('Neonatal_', ''));
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
        setBuffer(prev => (prev[k] === value ? (({ [k]: _, ...rest }) => rest)(prev) : { ...prev, [k]: value }));
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
        if (entries.length === 0) { notify('No skills/actions selected.'); return; }
        setIsSaving(true);
        const currentCaseSerial = editingCase ? editingCase.case_serial : caseSerial;
        const scoredEntries = entries.filter(([, v]) => isScored(v));
        const allCorrect = scoredEntries.length > 0 && scoredEntries.every(([, v]) => v === SCORE_DONE);

        const caseData = {
            courseId: course.id, participant_id: participant.id, encounter_date: encounterDate, setting: 'N/A', 
            age_group: `Neonatal_${scenario}`, case_serial: currentCaseSerial, day_of_course: dayOfCourse, 
            allCorrect: allCorrect, contentHash: generateHash(buffer)
        };

        const newObservations = entries.map(([k, v]) => {
            const [domain, skill_or_class] = k.split('|');
            return {
                courseId: course.id, course_type: course.course_type, encounter_date: encounterDate, day_of_course: dayOfCourse, 
                setting: 'N/A', participant_id: participant.id, domain: domain, item_recorded: skill_or_class, 
                item_correct: v, case_serial: currentCaseSerial, age_group: `Neonatal_${scenario}`
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
            notify(`Failed to save case: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCase = async (caseToDelete) => {
        if (!await confirmDialog('Delete this case and all its observations? This cannot be undone.')) return;
        const previousCases = [...cases];
        const previousObservations = [...observations];
        setCases(prev => prev.filter(c => c.id !== caseToDelete.id));
        setObservations(prev => prev.filter(o => o.caseId !== caseToDelete.id));
        try {
            await deleteCaseAndObservations(caseToDelete.id);
        } catch (err) {
            setCases(previousCases);
            setObservations(previousObservations);
            notify(`Failed to delete: ${err.message}`);
        }
    };

    const currentChecklist = NEONATAL_CHECKLISTS[scenario] || NEONATAL_CHECKLISTS['eenc_breathing'];
    const currentDomains = Object.keys(currentChecklist.domains);

    useEffect(() => {
        if (showGrid) setExpandedDomains(new Set(currentDomains.slice(0, 2)));
    }, [scenario, showGrid]);

    return (
        <div className="grid gap-2">
            {!isPublicView && <PageHeader title="Neonatal Emergency Monitor" subtitle={`Observing: ${participant.name}`} />}
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
                    {/* --- NATIVE BUTTON TOGGLE (BULLETPROOF) --- */}
                    <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                if (switchModule) switchModule('maternal');
                            }}
                            className="flex-1 py-2 px-4 rounded-md font-medium text-sm text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            Maternal Emergencies
                        </button>
                        <button 
                            type="button"
                            className="flex-1 py-2 px-4 rounded-md font-bold text-sm shadow bg-white text-teal-700 border border-teal-200"
                        >
                            Neonatal Emergencies
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {isPublicView && participants && (
                            <FormGroup label="Select participant" className="sm:col-span-2">
                                <Select value={participant.id} onChange={(e) => onChangeParticipant(e.target.value)} disabled={!!editingCase}>
                                    {participants.map(p => <option key={p.id} value={p.id}>{p.name} — {p.group}</option>)}
                                </Select>
                            </FormGroup>
                        )}
                        <FormGroup label="Select Neonatal Form / Checklist" className="sm:col-span-2">
                            <Select value={scenario} onChange={(e) => { setScenario(e.target.value); setBuffer({}); }} disabled={!!editingCase}>
                                {Object.entries(NEONATAL_CHECKLISTS).map(([key, data]) => (
                                    <option key={key} value={key}>{data.title}</option>
                                ))}
                            </Select>
                        </FormGroup>
                        <FormGroup label="Encounter Date"><Input type="date" value={encounterDate} onChange={(e) => setEncounterDate(e.target.value)} /></FormGroup>
                        <FormGroup label="Course Day"><Select value={dayOfCourse} onChange={(e) => setDayOfCourse(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{d}</option>)}</Select></FormGroup>
                    </div>
                </div>
                <div className="p-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
                    {!isPublicView && <Button variant="secondary" onClick={() => { setShowSetupModal(false); setShowGrid(false); }}>Close</Button>}
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
                        <Button variant="secondary" size="sm" onClick={() => setShowSetupModal(true)}>Edit Setup</Button>
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
                                    <button type="button" onClick={() => toggleDomain(d)} className={`w-full flex items-center justify-between p-4 transition-colors ${isExpanded ? 'bg-sky-50 border-b border-sky-100' : 'bg-white hover:bg-slate-50'}`}>
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
                <SubmittedNeonatalCases cases={cases} observations={observations} onEditCase={handleEditCase} onDeleteCase={handleDeleteCase} />
            )}
        </div>
    );
}

function SubmittedNeonatalCases({ cases, observations, onEditCase, onDeleteCase }) {
    if (cases.length === 0) return <Card className="p-8 text-center text-gray-500">No cases submitted yet.</Card>;
    return (
        <Card className="p-4">
            <h3 className="text-lg font-bold mb-4">Submitted Neonatal Cases</h3>
            <Table headers={["Date", "Day", "Checklist", "Score", "Actions"]}>
                {cases.sort((a,b) => b.day_of_course - a.day_of_course || b.case_serial - a.case_serial).map(c => {
                    const relatedObs = observations.filter(o => o.caseId === c.id);
                    const scoredObs = relatedObs.filter(o => isScored(o.item_correct));
                    const total = scoredObs.length;
                    const earned = scoredObs.reduce((sum, o) => sum + creditOf(o.item_correct), 0);
                    const checklistName = NEONATAL_CHECKLISTS[c.age_group?.replace('Neonatal_', '')]?.title || c.age_group;
                    const pct = total > 0 ? (earned/total)*100 : 0;
                    return (
                        <tr key={c.id} className="hover:bg-slate-50 border-b text-sm">
                            <td className="p-2">{c.encounter_date}</td>
                            <td className="p-2 text-center">{c.day_of_course}</td>
                            <td className="p-2">{checklistName}</td>
                            <td className={`p-2 text-center font-mono ${pctBgClass(pct)}`}>{fmtPct(pct)} ({fmtScore(earned)}/{total})</td>
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