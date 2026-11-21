# Module 3 (Intensive Newborn Care): titles, activities, videos, links to Module 2 equipment and procedures.
from lib import *
from books.titles import equipment, procedure
from books.m1_s2 import ONLINE

S1_TITLES = {
    'Introduction to Oxygen Therapy': 'Hypoxaemia and when to give oxygen',
    'Detection of Hypoxemia': 'Detecting hypoxaemia',
    'Equipment for Giving Oxygen': 'Giving oxygen: nasal prongs and catheters',
    'Equipment for Giving Oxygen: Oxygen Blender System': 'Giving oxygen: the oxygen blender system',
}
S1 = [
    ('Small reductions in SpO2 below 90%', q(
        'In practice, below what SpO₂ is oxygen usually given, and why that number?',
        ['Below 90%: it is on the flat part of the dissociation curve; small falls below 90% may be a dangerous fall in PaO₂', 'Below 97%: the normal range', 'Below 80%: only severe hypoxaemia needs oxygen', 'Below 94%: the lower limit of normal'], 0,
        'The manual: the threshold is often SpO₂ < 90%, the flat part of the haemoglobin–oxygen dissociation curve.')),
    ('Blood gas analysis is another very accurate method', [
        q('Which is the most accurate non-invasive way to detect hypoxaemia?', ['Pulse oximetry', 'Looking for cyanosis', 'Counting the respiratory rate', 'Blood gas analysis'], 0,
          'Pulse oximetry is the most accurate non-invasive method (SpO₂). Blood gas analysis is also very accurate (PaO₂), but invasive.'),
        video('Pulse oximetry: detecting hypoxaemia in a newborn', 'Choosing and placing the neonatal probe, waiting for a steady trace, and reading SpO₂ and heart rate; the clinical signs of hypoxaemia.', 'SN3.1.1'),
        equipment('Pulse oximeter', 'The device, its parts and its standard operating procedure.')]),
    ('The tip of the catheter should not be visible below the uvula', calc(
        'Using nasal prongs in an infant up to 10 kg, about what FiO₂ does a flow of 1 L/min give?', 45, '%',
        explanation='The manual: 0.5, 1 and 2 L/min give FiO₂ values of about 35%, 45% and 55%. Standard neonatal flow through nasal prongs is 0.5–1 L/min, without humidification.')),
    ('Their use should therefore be limited to situations', [
        q('When should a nasopharyngeal catheter be used?', ['Only when nasal prongs are unavailable', 'As the first choice for every neonate', 'Whenever monitoring is difficult', 'Only without humidification'], 0,
          'It can be displaced into the oesophagus and cause gagging, vomiting and gastric distension, and it needs effective humidification. In most settings where frequent monitoring is difficult, nasal prongs or nasal catheters are preferred.'),
        video('Giving oxygen by nasal prongs and nasal catheter', 'Choosing the prong size, securing prongs with tape on the cheeks; measuring and inserting an 8F nasal catheter (side of the nostril to the inner margin of the eyebrow).', 'SN3.1.2')]),
    ('it can even lead to brain damage', [
        q('On low-flow oxygen with a blender, what SpO₂ does the manual aim for?', ['Above 88%, with the lowest oxygen concentration possible', '100%', 'Above 98%', 'Exactly 90%'], 0,
          'Breathing pure oxygen can harm the lungs (BPD) and the eyes (retinopathy of prematurity).'),
        equipment('Oxygen blender'), equipment('Oxygen concentrator')]),
]

S2_TITLES = {
    'Introduction for NIV': 'Non-invasive ventilation: what it is',
    'Introduction for NIV: Advantages of NIV': 'Non-invasive ventilation: advantages',
    'Introduction for NIV: Disadvantages of NIV': 'Non-invasive ventilation: disadvantages and indications',
    'Introduction for NIV: Contraindication of NIV': 'Non-invasive ventilation: contraindications',
    'High-Flow Nasal Cannula (HFNC)': 'High-flow nasal cannula (HFNC)',
    'High-Flow Nasal Cannula (HFNC): HFNC during endotracheal intubation': 'HFNC during endotracheal intubation',
    'Continuous Positive Airway Pressure (CPAP)': 'CPAP: how it works and its parts',
    'Continuous Positive Airway Pressure (CPAP): Types of CPAP': 'CPAP: types and indications; starting, adjusting and weaning',
    'Continuous Positive Airway Pressure (CPAP): Adjust CPAP Pressure and FiO2': 'CPAP: general care and preventing complications',
    'Monitoring for Infants Nursed on CPAP': 'Monitoring a baby on CPAP',
    'Assess and manage for nasal injury': 'Nasal injury on CPAP',
    'Nasal (synchronized) intermittent positive pressure ventilation (NIPPV)': 'Nasal intermittent positive pressure ventilation (NIPPV)',
    'Bi-level positive airway pressure (BiPAP)': 'Bi-level positive airway pressure (BiPAP)',
    'Nasal High-Frequency Oscillatory Ventilation (nHFOV)': 'Nasal high-frequency oscillatory ventilation (nHFOV)',
    'Exercises': 'Exercises: non-invasive ventilation',
}
S2 = [
    ('All these devices are driven by a gas flow', q(
        'Which of these is NOT non-invasive ventilation?', ['Ventilation through an endotracheal tube', 'Nasal CPAP', 'High-flow nasal cannula', 'NIPPV'], 0,
        'The manual: NIV refers to any method of providing respiratory support where an endotracheal tube is not used.')),
    ('Potential for earlier weaning', reveal(
        'Name three advantages of NIV over invasive ventilation.',
        'Any three of the manual\'s ten: preservation of airway integrity; less ventilator-associated pneumonia and lung injury; parents can be involved (kangaroo care); respiratory muscle function preserved; better gas exchange (PEEP, open airways, alveolar recruitment); less chronic lung disease; better tolerance in preterms; less need for intubation; flexibility; earlier weaning.')),
    ('Need for skilled monitoring', q(
        'A baby on nasal prongs develops redness of the septum. Which disadvantage of NIV is this?', ['Nasal injury', 'Gastric distention', 'Difficulty in synchrony', 'Limited ventilatory support'], 0,
        'Nasal prongs can cause nasal trauma, irritation or septal necrosis, particularly with prolonged use.')),
    ('Neuromuscular disorders: infant with neuromuscular conditions', sort(
        'Is NIV used for this condition (an indication)?', ['Indication for NIV', 'Not in the manual\'s list'], [
            ('Respiratory distress syndrome', 'Indication for NIV'), ('Transient tachypnoea of the newborn', 'Indication for NIV'),
            ('Apnoea of prematurity', 'Indication for NIV'), ('Meconium aspiration syndrome', 'Indication for NIV'),
            ('Neonatal jaundice', 'Not in the manual\'s list')], '')),
    ('Uncooperative neonate', q(
        'A baby on CPAP develops a pneumothorax. What does the manual say?', ['Severe air leak is a contraindication: invasive ventilation may be needed, as NIV pressure could worsen it', 'Increase the CPAP pressure', 'Air leak does not affect NIV', 'Change to nasal catheter oxygen'], 0,
        'Contraindication 3: severe air leak syndrome (pneumothorax or pneumomediastinum).')),
    ('HFNC has gained popularity because of the ease of use', flip('HFNC: the three components', [('1', 'A flow generator'), ('2', 'An air-oxygen blender'), ('3', 'A heater-humidifier')])),
    ('But none of the strategies have been conclusively shown to be better', q(
        'Compared with CPAP as primary support, what did the Cochrane review find for HFNC?', ['A higher treatment failure rate, but less nasal injury', 'Lower mortality', 'Less BPD', 'No difference in anything'], 0,
        'The manual: no significant difference in most outcomes except a higher treatment failure rate with HFNC; HFNC was associated with a decreased risk of nasal injury.')),
    ('Reduced physiological instability', q(
        'What did the trials show when HFNC was used during endotracheal intubation?', ['More successful first-attempt intubations and more stable babies', 'More failed intubations', 'More bradycardia', 'No difference'], 0,
        'From "HFNC during endotracheal intubation".')),
    ('Nasal CPAP is usually started at a pressure of 5', [
        q('What does the manual give as the usual starting settings for nasal CPAP?', ['Pressure 5 cm H₂O, flow 5 L/min, FiO₂ 30%', 'Pressure 10 cm H₂O, flow 1 L/min, FiO₂ 100%', 'Pressure 2 cm H₂O, flow 10 L/min, FiO₂ 21%', 'Pressure 8 cm H₂O, flow 8 L/min, FiO₂ 60%'], 0,
          'Then titrate the pressure to the work of breathing, the flow to continuous bubbling, and FiO₂ to saturation targets (90–95% for preterm neonates).')]),
    ('Nasal masks.', [
        video('Setting up bubble CPAP step by step', 'Assembling the circuit, humidifier with distilled water, air and oxygen; prong size, hat, barrier dressing; securing the prongs; orogastric tube; starting at 5 cm H₂O and checking the bubbling.', 'SN3.2.1'),
        equipment('Vayu bubble CPAP system', 'The CPAP device used in Sudan: its parts, set-up and disinfection.')]),
    ('CPAP for meconium aspiration syndrome', q(
        'Where should CPAP for RDS be started?', ['In the delivery room, and continued while the baby is moved to the NICU', 'Only after admission to the NICU', 'Only after surfactant', 'Only if the baby is ventilated first'], 0,
        'The manual: CPAP for RDS should be initiated in the delivery room and continued while the neonate is being shifted to the NICU.')),
    ('containment holding or a cuddle', q(
        'Why is an orogastric tube used rather than a nasogastric tube on CPAP?', ['To prevent distortion of the nostrils and keep a good seal of the prongs or mask', 'Because NG tubes cannot be aspirated', 'Because feeds are stopped on CPAP', 'There is no reason'], 0,
        'The tube is aspirated before feeds, and at least every four hours if the baby is not fed.')),
    ('Suctioning should NOT be routine', [
        sort('How often is each check done for a baby on CPAP?', ['Every hour, visually', 'At least four-hourly, physically'], [
            ('The nose is not squashed or pushed upwards', 'Every hour, visually'), ('The eyes are clearly visible', 'Every hour, visually'),
            ('Tapes are not too tight', 'Every hour, visually'), ('Prongs or mask removed to rest the nose', 'At least four-hourly, physically'),
            ('The ears are not creased or folded', 'At least four-hourly, physically')], 'From "Monitoring for infants nursed on CPAP".'),
        video('Caring for a baby on CPAP: the hourly and four-hourly checks', 'Checking the nose, eyes, tapes, hat, ears and prongs; removing prongs by loosening the tapes; scoring the nose.', 'SN3.2.2')]),
    ('Consider elective intubation and ett CPAP', q(
        'The nose looks worse on recheck. What do you do?', ['Inform the nurse in charge and medical staff, and document', 'Wait for the next day', 'Push the prongs further in', 'Stop CPAP without telling anyone'], 0,
        'Step 2: if deteriorated, inform the nurse in charge and medical staff, document. Then consider more time off, alternatives and dressings (step 3).')),
    ('High nCPAP failure rates have prompted', q(
        'What does NIPPV add to nasal CPAP?', ['Superimposed inflations to a set peak inspiratory pressure (two pressure levels)', 'A higher oxygen concentration only', 'An endotracheal tube', 'Nothing: it is the same as HFNC'], 0,
        'NIPPV delivers pressure at two levels (PIP and PEEP) without endotracheal intubation.')),
    ('The maximum deliverable PIP was 11', q(
        'How does BiPAP differ from NIPPV?', ['Lower pressures (high and low differ by no more than 3–4 cm H₂O), longer Ti, lower rates', 'Higher pressures and faster rates', 'It needs intubation', 'It gives no PEEP'], 0,
        'From the manual\'s description of BiPAP.')),
    ('nHFOV combines the benefits', reveal(
        'What does nasal HFOV combine, and what is its benefit?',
        'It combines high-frequency ventilation and nasal ventilation: small tidal volumes at supraphysiological rates give better CO₂ elimination.')),
    ('Work through each exercise on your own or in your small group', ONLINE),
]

S3_TITLES = {
    'INTRODUCTION to MV': 'Mechanical ventilation: introduction and objectives',
    'Physiology and lung mechanics': 'Physiology and lung mechanics',
    'Basics of ventilator breath and control of breathing during mechanical ventilation': 'The ventilator breath: triggering and cycling',
    'Basics of ventilator breath and control of breathing during mechanical ventilation: When a baby on mechanical ventilation 2 types of breath can be recognized': 'Spontaneous and mandatory breaths',
    'Introduction To Conventional Mechanical Ventilation': 'Conventional ventilation: control variables and breath sequences',
    'Introduction To Conventional Mechanical Ventilation: Modes of Mechanical Ventilation': 'Ventilation modes: assist control',
    'Introduction To Conventional Mechanical Ventilation: Synchronized Intermittent Mandatory Ventilation (SIMV) mode': 'Ventilation modes: SIMV, pressure support and volume targeting',
    'High Frequency Ventilation Introduction': 'High-frequency oscillatory ventilation: indications and starting',
    'High Frequency Ventilation Introduction: Monitoring oxygenation and ventilation': 'HFOV: oxygenation, ventilation and low PO₂',
    'High Frequency Ventilation Introduction: High PCO2: Consider': 'HFOV: high PCO₂, weaning and complications',
    'VENTILATORY STRATEGIES AND SETTINGS': 'Ventilation strategy and starting settings',
    'Initiation of Conventional Ventilation According to Disease': 'Settings by disease: RDS, apnoea and BPD',
    'Initiation of Conventional Ventilation According to Disease: Meconium aspiration syndrome (MAS): Pathophysiology': 'Settings by disease: MAS and CDH; how changes affect blood gases',
    'CARE & MONITORING OF A VENTILATED BABY': 'Care and monitoring of a ventilated baby',
    'CARE & MONITORING OF A VENTILATED BABY: Reduction in auto-PEEP can be accomplished by': 'Auto-PEEP, minute ventilation and monitoring',
    'WEANING AND EXTUBATION OF A VENTILATED BABY': 'Weaning and readiness for extubation',
    'WEANING AND EXTUBATION OF A VENTILATED BABY: Spontaneous Breathing Trials': 'How to extubate, and caffeine',
    'WEANING AND EXTUBATION OF A VENTILATED BABY: Post-extubation Ventilation Strategies': 'After extubation, and failed weaning',
    'COMPLICATIONS OF MECHANICAL VENTILATION': 'Complications of mechanical ventilation',
    'Mechanical Ventilation Trouble shooting': 'Troubleshooting the ventilated baby',
    'Exercises': 'Exercises: mechanical ventilation',
}
S3 = [
    ('To be familiar with the common complications of the mechanical ventilator', reveal(
        'What is the responsibility of the intensivist in mechanical ventilation, according to the manual?',
        'To optimize ventilation and prevent the harmful effect of over- or under-ventilation.')),
    ('Work of breathing is especially important in the smallest infants', [
        flip('Lung volumes and pressures', [('Tidal volume (VT)', 'Gas moved with each breath; 4–6 ml/kg in a healthy neonate'),
                                            ('Functional residual capacity (FRC)', 'Gas left in the lung after tidal exhalation; the reservoir for gas exchange'),
                                            ('PEEP', 'Positive pressure remaining in the airways at the end of exhalation'),
                                            ('PIP', 'Maximum airway pressure at the end of inspiration'),
                                            ('Minute volume', 'VT × respiratory rate')]),
        q('Surfactant deficiency changes compliance how?', ['It decreases compliance (a stiff lung)', 'It increases compliance', 'It does not affect compliance', 'It only changes resistance'], 0,
          'Compliance (ΔV/ΔP) is decreased with surfactant deficiency, excess lung water and lung fibrosis, and when the lungs are hyper-expanded.')]),
    ('However, when a patient’s inspiratory effort is weak or poor', q(
        'A baby\'s inspiratory effort is weak. How is the trigger threshold set?', ['The lowest the patient can trigger', 'The highest available', 'Triggering is switched off', 'It does not matter'], 0,
        'The manual: when effort is weak or poor, the threshold should be the lowest that the patient can trigger.')),
    ('The pressure wave is positive.', [
        sort('Spontaneous or mandatory breath?', ['Spontaneous breath', 'Mandatory (ventilator) breath'], [
            ('Patient-triggered and patient-cycled', 'Spontaneous breath'), ('The pressure wave is negative', 'Spontaneous breath'),
            ('The ventilator always controls the cycling (end of inspiration)', 'Mandatory (ventilator) breath'),
            ('The pressure wave is positive', 'Mandatory (ventilator) breath')], ''),
        video('Reading ventilator waveforms', 'Animated pressure, flow and volume curves: triggering, inspiration, cycling, expiration; spontaneous vs mandatory breaths; CMV vs IMV.', 'SN3.3.1')]),
    ('5. The small shaded box represents a window time for synchronization.', q(
        'Which control variable is commonly used for ventilating neonates?', ['Pressure control', 'Volume control', 'Flow control', 'Time control'], 0,
        'The manual: "PRESSURE CONTROL IS THE COMMONLY USED MODE IN NEONATES". Volume control is commonly used in PICU.')),
    ('All patient triggered breath will be assisted regardless', q(
        'Can assist control (AC) mode be used to wean?', ['No: every triggered breath is assisted, so support cannot be reduced gradually', 'Yes: it is the main weaning mode', 'Only with volume control', 'Only in term babies'], 0,
        'The manual: the AC mode cannot be used in the weaning process. SIMV is a rate weaning mode; pressure support is a weaning mode.')),
    ('Some ventilators compensate for these losses', q(
        'Why is pure volume control not commonly used in neonates?', ['Uncuffed endotracheal tubes leak, so tidal volume cannot be controlled', 'Neonates have no tidal volume', 'It is too cheap', 'It is only used for apnoea'], 0,
        'Volume-targeted ventilators designed for newborns are used instead (e.g. volume guarantee, usually 4–6 ml/kg).')),
    ('Lung fields expanded to less than the 6th rib posteriorly', [
        q('On starting HFOV, where is the mean airway pressure set?', ['2–3 cm above the current CMV mean airway pressure', 'Equal to PEEP', '10 cm below the CMV MAP', 'At the highest the ventilator allows'], 0,
          'The manual: generally, the starting MAP is set 2–3 cm above the current CMV MAP. Frequency is usually 10 Hz; amplitude about double the MAP, enough to see a chest "wiggle".'),
        q('The chest X-ray on HFOV shows the diaphragm at the 10th rib and flattened. What does this mean?', ['Over-inflation', 'Under-inflation', 'Optimal inflation', 'Pneumothorax'], 0,
          'Optimal: diaphragm between the 8th and 9th posterior ribs. Diaphragm at 10+ ribs, intercostal bulging, a flattened diaphragm and a thin cardiac silhouette indicate over-inflation.')]),
    ('Over inflated lung –Check BP, reduce MAP', q(
        'On HFOV the PaCO₂ is high. What is the main control to adjust?', ['Increase ΔP (amplitude) in increments of 2–4', 'Increase FiO₂', 'Increase MAP only', 'Increase the frequency'], 0,
        'Ventilation (CO₂ clearance) is controlled by ΔP. Decreasing the frequency markedly increases CO₂ elimination and should not be done without the expert senior.')),
    ('IVH due to changes in cerebral circulation', q(
        'How is HFOV mainly weaned?', ['By reducing the MAP as compliance improves; FiO₂ first, then MAP in 1–2 cm H₂O steps once FiO₂ is below about 30%', 'By increasing the frequency', 'By stopping abruptly', 'By increasing ΔP'], 0,
        'From "Weaning" in the manual. In air leak syndromes, reducing MAP may take priority over weaning FiO₂.')),
    ('I:E ratio at least 1:2', calc(
        'Starting conventional ventilation in pressure control mode, what PEEP does the manual say is usual?', 5, 'cm H₂O',
        explanation='PEEP 4–6, usually 5; PIP 14–25, usually 16–20; rate 30–60/min; Ti 0.30–0.40 s; I:E at least 1:2.')),
    ('Higher PIP are sometimes required (20 to 30 cm H2O)', sort(
        'Which disease does each ventilator strategy suit?', ['RDS', 'Apnoea (no lung disease)', 'BPD'], [
            ('Ti 0.3 s, rate 20–40, PIP 20–25, PEEP 4–6', 'RDS'),
            ('"Physiologic" ventilation: PEEP 3–4, rate 30–40, PIP 10–18', 'Apnoea (no lung disease)'),
            ('Large VT 8–12 ml/kg, PEEP 7–8, rate < 20, Ti 0.6–0.8 s', 'BPD')], 'From "Initiation of conventional ventilation according to disease".')),
    ('Decreasing PEEP', q(
        'How do you lower a high PaCO₂ on conventional ventilation?', ['Increase PIP or expiratory time, or decrease PEEP', 'Increase PEEP', 'Increase FiO₂', 'Shorten expiratory time'], 0,
        'Summary in the manual: "B. Increase ventilation and decrease PaCO₂: increasing PIP, increasing expiratory time TE, decreasing PEEP".')),
    ('The inspiratory time during volume breaths (AC or SIMV modes)', q(
        'How soon should FiO₂ be reduced to 0.5 or below, if possible?', ['As soon as possible, ideally within the first 24 hours', 'After one week', 'Only before extubation', 'Never'], 0,
        'Inspired oxygen may be harmful to the lung parenchyma after prolonged exposure.')),
    ('Use ventilator alarms to monitor key physiologic and ventilator parameters', q(
        'What is the most effective way to decrease auto-PEEP?', ['Decreasing the respiratory rate', 'Increasing PEEP', 'Increasing the rate', 'Increasing VT'], 0,
        'From "Reduction in auto-PEEP can be accomplished by".')),
    ('the time elapsed since the patient’s most recent episode', []),
    ('showed that HRV was significantly decreased in those who failed extubation', reveal(
        'Which preterm babies are at higher risk of failing extubation?',
        'Low gestational age (< 26 weeks), prolonged ventilation (> 10–14 days), low pH, extubation from high settings (high MAP, high FiO₂), previous extubation failure or multiple intubation attempts, and residual lung disease (BPD) or a significant PDA.')),
    ('appears reasonable to give it within at least 24 h', [
        q('After extubating a preterm baby, when is CPAP or NIPPV started?', ['Immediately after extubation (PEEP ≥ 5 cm H₂O)', 'After 4 hours if the baby tires', 'Only if a blood gas is abnormal', 'Not needed if caffeine was given'], 0,
          'Step 5 of "How to extubate". A loading dose of caffeine is given before extubation (ideally within 24 hours), and feeds stopped 4 hours before.'),
        video('Extubating a preterm baby step by step', 'Checking the weaning parameters, caffeine given, feeds stopped, CPAP set up and running at the bedside before the tube comes out; extubation and immediate CPAP.', 'SN3.3.2')]),
    ('Metabolic disorders', q(
        'A baby keeps failing extubation. What does the manual list as common reasons for failed weaning?', ['Cardiac or cognitive dysfunction, respiratory pump failure, respiratory muscle and diaphragm dysfunction, metabolic disorders', 'Only the lungs', 'Too much caffeine', 'Feeding too early'], 0,
        'Look beyond the lungs: the heart, metabolic state, diaphragm and sedation.')),
    ('mouth care, and medical staff hand hygiene', q(
        'How can ventilator-associated pneumonia be prevented, according to the manual?', ['Early extubation, changing circuits only as needed, mouth care and hand hygiene', 'Changing the circuit every day', 'Routine suction every hour', 'Prophylactic antibiotics for all'], 0,
        'From "Complications of mechanical ventilation", E. Air leak risk increases at MAPs over 14 cm H₂O.')),
    ('Decrease PIP and or increase PEEP.', [
        q('A ventilated baby suddenly desaturates with a high CO₂. What is the first action?', ['Disconnect the baby from the ventilator and bag by hand', 'Increase the FiO₂ on the ventilator', 'Increase the PIP', 'Send a blood gas and wait'], 0,
          'If he improves, check the ventilator and the tube (displacement, obstruction, leak). If he does not, assess the baby: pneumothorax, hypoglycaemia, hypotension, IVH, sepsis.'),
        video('Sudden desaturation on the ventilator: disconnect and bag', 'A simulated ventilated preterm desaturates; the nurse disconnects and bags; two endings: the baby improves (tube or ventilator problem) or not (pneumothorax: transillumination).', 'SN3.3.3'),
        procedure('Needle thoracotomy', 'If a pneumothorax is the cause.')]),
    ('Work through each exercise on your own or in your small group', ONLINE),
]
S1 = [a for a in S1 if a[1]]; S2 = [a for a in S2 if a[1]]; S3 = [a for a in S3 if a[1]]
