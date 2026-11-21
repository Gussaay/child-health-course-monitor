# Module 1, Section 2 (Selected Neonatal Emergencies): titles, activities, videos.
from lib import *

TITLES = {
    'Shock in Neonates': 'Shock: definition, causes and signs',
    'Shock in Neonates: Fluids': 'Shock: fluids, signs of improvement and antibiotics',
    'Neonatal Hypoglycemia': 'Hypoglycaemia: definition and severity',
    'Neonatal Hypoglycemia: High-Risk Categories': 'Hypoglycaemia: who to screen, and the signs',
    'Neonatal Hypoglycemia: DIAGNOSIS AND MONITORING': 'Hypoglycaemia: measuring glucose and managing the baby without signs',
    'Neonatal Hypoglycemia: Symptomatic or Severe Hypoglycaemia (BG <1.0mmol/l or there are abnormal clinical signs)': 'Hypoglycaemia: severe or with signs',
    'Neonatal Hypoglycemia: WHEN BLOOD GLUCOSE MONITORING IS UNAVAILABLE In resource-limited settings without glucometers/labs': 'Hypoglycaemia: no glucometer, weaning, and persistent low glucose',
    'Neonatal Hypoglycemia: REFRACTORY HYPOGLYCEMIA': 'Hypoglycaemia: refractory cases, prevention and Sudan considerations',
    'Neonatal Seizure': 'Seizures: time targets and seizure or mimic',
    'Neonatal Seizure: Step 2: Rapid Etiologic Evaluation ("SHOT" Mnemonic)': 'Seizures: finding the cause (SHOT) and the work-up',
    'Neonatal Seizure: Amplitude-Integrated EEG (aEEG) when cEEG unavailable': 'Seizures: aEEG and neuroimaging',
    'Neonatal Seizure: LUMBAR PUNCTURE (STAT, unless contraindicated)': 'Seizures: lumbar puncture and genetic tests',
    'Neonatal Seizure: STEP 1: Correct Reversible Causes FIRST': 'Seizures: correct reversible causes first',
    'Neonatal Seizure: STEP 2: First-Line Antiseizure Medication': 'Seizures: phenobarbital, the first-line medicine',
    'Neonatal Seizure: IF STILL SEIZING after 40 mg/kg Phenobarbital': 'Seizures: when they continue after 40 mg/kg phenobarbital',
    'Exercises': 'Exercises: shock and seizures',
}

ONLINE = note('In this online course you write your answer in the exercise, and the facilitator guide\'s answer key opens after you submit it. Try each case before you look.', 'Online course')

ADD = [
    ('Hypotension is a late sign', q(
        'A baby has cold extremities, a capillary refill of 4 seconds and a fast heart rate, but a normal blood pressure. Can this be shock?',
        ['Yes: hypotension is a late sign, so shock must be recognised before the blood pressure falls', 'No: shock needs a low blood pressure', 'Only if the baby is preterm', 'Only if there is fever'], 0,
        'The manual: "Hypotension is a late sign." Shock is often reversible at first, but must be recognised and treated immediately.')),
    ('Ongoing evaluation: continues evaluation is necessary', [
        flip('Shock: management priorities', [('1', 'Antibiotics: immediate, broad-spectrum'), ('2', 'Fluid resuscitation: volume expanders to improve circulation'),
                                              ('3', 'Cardiovascular support: vasopressors (dopamine, epinephrine) for persistent hypotension'), ('4', 'Ventilation: support for respiratory distress'),
                                              ('5', 'Monitoring: close haemodynamic monitoring, metabolic support, managing complications like PPHN')]),
        video('Recognising shock in a newborn', 'Checking heart rate, capillary refill, temperature of the extremities, mottling and pulses; what each finding tells you.', 'SN1.2.1')]),
    ('Amount of fluids different according to the shock type', calc(
        'A 3 kg baby is in shock (not cardiogenic). Using the manual\'s starting volume, how much normal saline is the first bolus?', 60, 'ml',
        hint='Start with 20 ml/kg over 15–30 minutes.', explanation='20 ml/kg × 3 kg = 60 ml, over 15–30 minutes. In cardiogenic shock the bolus is cautious: 10 ml/kg, with inotropes.')),
    ('Cardiogenic shock: fluids may not improve the shock', q(
        'Why is the fluid bolus smaller (10 ml/kg) in cardiogenic shock?',
        ['Fluids may not improve this shock and may make it worse; inotropes are used', 'Because the baby is dehydrated', 'Because saline is not available', 'Because antibiotics are given instead'], 0,
        'The manual: "Cardiogenic shock: fluids may not improve the shock and may deteriorate the condition so, cautious fluid bolus (10 mL/kg), and use inotropes."')),
    ('Preterm newborn (<37 weeks)', q(
        'Below what blood glucose is a preterm newborn hypoglycaemic, and a term newborn?',
        ['Preterm < 2.6 mmol/L; term < 2 mmol/L', 'Preterm < 2 mmol/L; term < 2.6 mmol/L', 'Both < 3 mmol/L', 'Both < 1 mmol/L'], 0,
        'From the manual\'s definition table. Severe hypoglycaemia is < 1 mmol/L (< 18 mg/dL).')),
    ('Sudan-specific consideration', sort(
        'Should this baby be screened for hypoglycaemia (even with no signs)?', ['Screen', 'No risk factor in this list'], [
            ('Born at 35 weeks', 'Screen'), ('Mother has gestational diabetes', 'Screen'), ('Birth weight 4.3 kg', 'Screen'),
            ('Temperature 36.1 °C', 'Screen'), ('Term, 3.2 kg, breastfeeding well, mother well', 'No risk factor in this list')],
        'All the first four are high-risk categories in the manual. In Sudan, a lower threshold for screening is recommended.')),
    ('In preterm infants, symptoms may be subtle or absent', q(
        'Which of these is a neuroglycopenic sign (brain dysfunction) rather than a neurogenic (autonomic) one?',
        ['Seizures', 'Sweating', 'Jitteriness', 'Tachycardia'], 0,
        'Neuroglycopenic: lethargy, hypotonia, poor feeding, apnoea, bradycardia, hypothermia, seizures, coma. Assume hypoglycaemia in any neonate with altered behaviour.')),
    ('Recheck glucose 30 minutes post-feed', [
        q('When is the first blood glucose checked in an at-risk baby without signs who fed in the first hour?',
          ['30 minutes after the end of the first feed', 'Immediately at birth', 'At 6 hours', 'Only if signs appear'], 0,
          'The manual\'s algorithm: "check first blood glucose 30 minutes after completion of first feed". If feeding is delayed beyond the first hour, check at one hour, then 30 minutes after the first feed.'),
        calc('A 3 kg baby with signs of hypoglycaemia. What volume of 40% glucose gel is given (0.5 ml/kg)?', 1.5, 'ml',
             explanation='0.5 ml/kg × 3 kg = 1.5 ml, by oral syringe massaged into the cheek, then a feed. Maximum 2 doses per episode and 6 in 48 hours; recheck 30 minutes after the feed.'),
        video('Checking blood glucose by heel prick', 'Warming the heel, wiping away the first drop, collecting the second drop, and reading the glucometer.', 'SN1.2.2')]),
    ('Repeat cycle if blood glucose still <1 mmol/L', calc(
        'A 2 kg baby has a blood glucose of 0.8 mmol/L. What volume of 10% dextrose is the bolus (2.5 ml/kg)?', 5, 'ml',
        explanation='2.5 ml/kg × 2 kg = 5 ml of 10% dextrose, then a continuous infusion of 10% dextrose at 60 ml/kg/day, and recheck after 30 minutes.')),
    ('IV 10% dextrose bolus is not indicated here', q(
        'Blood glucose is 1.8 mmol/L and the baby has no abnormal signs. What does the manual say?',
        ['Increase the GIR by 2 mg/kg/min, continue oral feeds, recheck after 30 minutes; no IV bolus', 'Give a 10% dextrose bolus', 'Stop feeds', 'Do nothing until the next feed'], 0,
        'If BG 1.0–2.5 mmol/L and no abnormal clinical signs: increase GIR by 2 mg/kg/min; IV 10% dextrose bolus is not indicated.')),
    ('High ketones + low FFA = Fatty acid oxidation disorder', [
        q('An asymptomatic high-risk baby, in a unit with no glucometer. What do you do?',
          ['Assume moderate hypoglycaemia: early frequent breastfeeding ± NG feeds, and monitor clinically', 'Give a dextrose bolus to every high-risk baby', 'Wait for symptoms', 'Refer for a glucose test before feeding'], 0,
          'The manual: when blood glucose monitoring is unavailable. A symptomatic baby is treated as severe hypoglycaemia (2 ml/kg 10% dextrose IV/NG/orally).'),
        q('When can the IV dextrose be weaned?',
          ['When glucose is stable > 3.0 mmol/L for 12 hours: reduce the IV rate by 10–20% every 6 hours while increasing feeds', 'As soon as glucose is above 1 mmol/L', 'After one normal reading', 'Only at discharge'], 0,
          'From "Maintenance and weaning of IV dextrose".')]),
    ('Consult pediatric endocrinology if available', q(
        'Glucose stays low despite more than 12 mg/kg/min of dextrose. What is this called, and what is ruled out first?',
        ['Refractory hypoglycaemia; rule out hyperinsulinism with the critical sample', 'Transitional hypoglycaemia; feed more', 'Persistent hypoglycaemia; stop the dextrose', 'Normal; no action'], 0,
        'From "Refractory hypoglycemia". Glucagon 0.02 mg/kg may be considered, and hydrocortisone if adrenal insufficiency is suspected.')),
    ('Eye Signs', [
        sort('Seizure or mimic (jitteriness)? Sort each finding.', ['Seizure', 'Non-seizure event (mimic)'], [
            ('Not provoked by stimulus', 'Seizure'), ('Rhythmic, slow (< 4 jerks/sec), localised', 'Seizure'),
            ('Persists when you gently hold the limb', 'Seizure'), ('Stops immediately with gentle restraint', 'Non-seizure event (mimic)'),
            ('Tremor-like, rapid, generalised; baby awake, eyes normal', 'Non-seizure event (mimic)')],
            'From the manual\'s table "Seizure vs. Mimic".'),
        video('Neonatal seizure or jitteriness?', 'Short clips of clonic, tonic and subtle seizures and of jitteriness, with the restraint test.', 'SN1.2.3')]),
    ('Circulation: Secure IV/IO access', []),
    ('Hypomagnesemia: 50% Magnesium Sulfate', q(
        'In the SHOT mnemonic, what does the O stand for?',
        ['Osmolality and electrolytes (calcium, magnesium, sodium)', 'Oxygen', 'Observation', 'Opioids'], 0,
        'S: sugar and sepsis; H: hypoxia and history; O: osmolality and electrolytes; T: trauma, toxins and treatable metabolic causes.')),
    ('HIE: Throughout cooling + rewarming + 24h post', reveal(
        'No EEG is available in your unit. A baby has focal clonic jerks. What does the manual say?',
        'If neither cEEG nor aEEG is available, treat based on strong clinical suspicion (focal clonic or tonic) and monitor the clinical response closely.')),
    ('Spectroscopy if metabolic disorder suspected', q(
        'Which imaging is the accessible first step at the bedside, and what does it rule out?',
        ['Cranial ultrasound; haemorrhage and hydrocephalus', 'MRI; stroke', 'CT; fractures', 'X-ray; pneumothorax'], 0,
        'Tier 2: cranial ultrasound at 24 hours (bedside); MRI at 24–72 hours when stable.')),
    ('Whole exome sequencing (refractory cases)', reveal(
        'Should antibiotics wait until the lumbar puncture is done?',
        'No. The manual: "Do not delay antibiotics for LP. Perform as soon as infant is stable." The LP is mandatory if infection is suspected.')),
    ('Meningitis doses if CSF suggestive', [
        calc('A 1.5 kg baby is seizing; ionised calcium is 0.7 mmol/L. What volume of 10% calcium gluconate (1 ml/kg) is given?', 1.5, 'ml',
             explanation='1 ml/kg × 1.5 kg = 1.5 ml IV over 10 minutes, with a cardiac monitor, avoiding extravasation. Correct reversible causes first.'),
        q('Why is the cause corrected before an antiseizure medicine is given?',
          ['A seizure with a correctable cause may stop once the cause is fixed', 'Because phenobarbital is not available', 'Because calcium works faster than any drug for every seizure', 'It is not: phenobarbital comes first'], 0,
          'Step 1 of the treatment algorithm: "Correct reversible causes FIRST" (hypoglycaemia, hypocalcaemia, hypomagnesaemia, infection).')]),
    ('Maximum loading: 40 mg/kg in first 24h', [
        calc('What is the phenobarbital loading dose for a 3 kg baby (20 mg/kg)?', 60, 'mg',
             explanation='20 mg/kg × 3 kg = 60 mg IV over 20 minutes. Monitor for respiratory depression and hypotension.'),
        q('Seizures continue after the first 20 mg/kg of phenobarbital. What next?',
          ['A further 10 mg/kg IV over ten minutes, up to a maximum of 40 mg/kg in the first 24 hours', 'Repeat 20 mg/kg every hour', 'Stop phenobarbital', 'Give diazepam rectally'], 0,
          'Phase 2: escalation (15–60 minutes). Check the serum level if available.')]),
    ('POSITIVE RESPONSE: EEG normalization within minutes', q(
        'Seizures persist after 40 mg/kg of phenobarbital in a baby with congenital heart disease. Which option is contraindicated?',
        ['Lidocaine infusion', 'Levetiracetam', 'Midazolam infusion', 'Fosphenytoin with a cardiac monitor'], 0,
        'The manual lists contraindications to lidocaine: congenital heart disease, concurrent phenytoin, hepatic impairment. Levetiracetam is preferred in cardiac or liver disease.')),
    ('Work through each exercise on your own or in your small group', ONLINE),
]
