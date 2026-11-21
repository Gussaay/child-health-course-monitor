# Module 2, Section 4 (The Golden Hour of Life): titles, activities, videos, links.
from lib import *
from books.titles import equipment, lesson_in, M3

TITLES = {
    'Prevention of hypothermia in special newborn care unit (beyond resuscitation)': 'The golden hour, and keeping the baby warm in the SCNU',
    'Prevention of hypothermia in special newborn care unit (beyond resuscitation): Interventions in the SPECIAL CARE NEWBORN UNIT (SCNU) that have been found to reduce hypothermia in very preterm infants include': 'Incubator, radiant warmer or cot?',
    'Prevention of hypothermia in special newborn care unit (beyond resuscitation): Standard cot': 'The standard cot and moving a baby to a cot',
    'Support of respiration after special care newborn unit (SCNU) admission': 'Supporting breathing after admission',
    'Support of respiration after special care newborn unit (SCNU) admission: Surfactant Administration': 'Surfactant',
    'Support of the CVS after admission to special care newborn unit (SCNU)': 'Supporting and monitoring the circulation',
    'Support Nutrition': 'Nutrition: the stable term baby and the ten steps',
    'Support Nutrition: Support of nutrition of Preterm and sick newborn': 'Nutrition: the preterm and sick newborn, and fluids',
    'Support Nutrition: Fluid restriction': 'Nutrition: glucose and energy',
    'Support Nutrition: Total required to produce a 10g/day weight gain - 125cal/kg/day': 'Nutrition: breast milk and parenteral nutrition',
    'Support Nutrition: Scenario': 'Nutrition: a glucose infusion scenario',
}
ADD = [
    ('retinopathy of prematurity (ROP)', q(
        'What is the golden hour of neonatal life?', ['The first hour of postnatal life, in preterm and term neonates', 'The first minute after birth', 'The first 24 hours', 'The hour before discharge'], 0,
        'Studies of the golden hour approach in preterm neonates showed marked reductions in hypothermia, hypoglycaemia, IVH, BPD and ROP.')),
    ('Cold stress may be eliminated by employing overhead heat', q(
        'Between what temperatures is a baby kept during transport and on admission to the SCNU?', ['36.7 and 37.2 °C', '35.5 and 36.5 °C', '37.5 and 38 °C', 'Any temperature above 35 °C'], 0,
        'The manual: the neutral thermal zone, maintaining between 36.7 and 37.2 °C. Every baby has continuous skin temperature monitoring from admission until swaddled.')),
    ('Its major disadvantage is the increase in insensible water loss', [
        sort('Which bed does the manual say for each baby on admission?', ['Incubator', 'Open care (radiant warmer)', 'Standard cot'], [
            ('A baby of 29 weeks, 950 g', 'Incubator'), ('A baby of 32 weeks, 1700 g', 'Incubator'),
            ('A baby who needs respiratory care and easy access', 'Open care (radiant warmer)'),
            ('A baby with suspected perinatal asphyxia (risk of hyperthermia in an incubator)', 'Open care (radiant warmer)'),
            ('A stable term baby', 'Standard cot')],
            'Incubators: all ≤ 30 weeks and/or ≤ 1000 g, and the admission bed of choice for < 33 weeks or ≤ 1800 g. Respiratory care: open care. Asphyxia: not in an incubator. Stable term: swaddled in a cot.'),
        equipment('Infant incubator'), equipment('Radiant warmer')]),
    ('Infants with poor growth after transition may require return', [
        q('After moving to a cot, the temperature is below 36.5 °C on 3 hourly checks in a row. What do you do?', ['Return the baby to a pre-warmed incubator', 'Bath the baby to warm him', 'Wait 12 more hours', 'Add a fan'], 0,
          'From "Infant care post crib transfer". Bathing is deferred until the temperature has been ≥ 36.5 °C for at least 12 hours after the move to the cot.'),
        video('Moving a baby from incubator to cot', 'Checking the temperature hourly for 4 hours after the move, adding layers and a pre-warmed blanket, and when to return to the incubator.', 'SN2.4.1')]),
    ('Possible higher rate of treatment failure when used as primary mode', [
        q('For a preterm at risk of RDS who does not need intubation, what is now the recommended first respiratory support?', ['Early CPAP, started in the delivery room', 'Immediate intubation and ventilation', 'Head box oxygen only', 'Prophylactic surfactant through an ETT'], 0,
          'Early CPAP reduced BPD, death or BPD, and mechanical ventilation compared with mechanical ventilation.'),
        lesson_in(M3, 2, 'CPAP: how it works and its parts', 'More in Module 3 · Non-invasive ventilation', 'CPAP, HFNC and NIPPV in detail.')]),
    ('What is the oxygen threshold for a baby on early CPAP', []),
    ('Rarely performed in special care newborn unit (SCNU).', []),
    ('Values lower than 42% are thought to indicate dangerous tissue hypoxia', []),
    ('Summary of cardiovascular monitoring methods', [
        q('A disparity between central pulses (palpable) and peripheral pulses (impalpable) usually indicates what?', ['A cardiac problem or hypovolaemia', 'A normal newborn', 'Hypothermia only', 'Sepsis only'], 0,
          'From "Clinical observations: pulse volume". Skin colour and temperature are unreliable indicators of cardiac function.'),
        q('Lactate in the blood gas rises. What does it reflect?', ['Tissue hypoxia, from low cardiac output or reduced oxygen extraction', 'Good perfusion', 'Overfeeding', 'Hypothermia only'], 0,
          'From "Arterial blood gas analysis" in the manual.')]),
    ('Coordinate discharge so that parents and their infants have timely access', q(
        'When should a stable term baby start breastfeeding?', ['Within half an hour of birth', 'After the first bath', 'After 6 hours', 'When the mother asks'], 0,
        'The manual: "prompt initiation of breastfeeding within half an hour of birth for stable term babies, following NRP and BFHI guidelines".')),
    ('Hypernatremia with weight gain suggests salt and water load', [
        calc('A baby weighs 1.2 kg. Using the lowest figure of the manual\'s day-1 range for this weight (80–100 ml/kg/day), how much fluid is that for the day?', 96, 'ml',
             explanation='1000–1500 g: 80–100 ml/kg/day on day 1. 80 × 1.2 = 96 ml/day (up to 120 ml/day at 100 ml/kg). < 1000 g: 100–150; > 1500 g: 60–80.'),
        sort('Sodium and weight: what does each pattern suggest?', ['Sodium depletion', 'Dilutional (fluid excess)', 'Dehydration', 'Salt and water load'], [
            ('Low sodium, weight falling', 'Sodium depletion'), ('Low sodium, weight rising', 'Dilutional (fluid excess)'),
            ('High sodium, weight falling', 'Dehydration'), ('High sodium, weight rising', 'Salt and water load')],
            'From "Serum sodium and fluid requirement".'),
        video('Working out fluids and the glucose infusion rate', 'On a whiteboard: day-1 fluids by birth weight, then the GIR formula worked through for a 2 kg baby.', 'SN2.4.2')]),
    ('Growth (4.5 cal/g of growth) - 45cal/kg/day', [
        calc('A 2 kg baby is on 10% dextrose at 7.2 ml/hour. Using the manual\'s formula, what is the glucose infusion rate?', 6, 'mg/kg/min',
             explanation='GIR = rate (ml/h) × concentration (g/dl) × 1000 ÷ (weight (kg) × 60 × 100) = 7.2 × 10 × 1000 ÷ (2 × 60 × 100) = 6 mg/kg/min. The manual starts preterms at 4–6 and term babies at 6–8 mg/kg/min.'),
        q('Most infants need how many calories a day for adequate growth?', ['100–120 cal/kg/day', '50 cal/kg/day', '200–250 cal/kg/day', '20 cal/kg/day'], 0,
          'Some need up to 160–180 cal/kg/day, for example infants with BPD. On TPN, 70–90 cal/kg/day may be adequate.')]),
    ('NO electrolytes in starter TPN', q(
        'When does ASPEN recommend starting parenteral nutrition for premature and VLBW neonates?', ['Within 24 to 48 hours of life', 'After one week', 'Only after full feeds fail', 'At discharge'], 0,
        'A starter PN (dextrose, lipids and protein, no electrolytes) can be used if patient-specific PN is not available.')),
    ('Calculate the glucose infusion rate according to the newborn requirement', reveal(
        'Work through the scenario using the manual: what GIR does a preterm start on, and how is it adjusted?',
        'The manual: start the infusion at a GIR of 4–6 mg/kg/min in preterm (6–8 in term) neonates and increase gradually, up to 12 mg/kg/min, according to the clinical condition and signs of hypoglycaemia; keep glucose at 50–110 mg/dl. For this 2 kg baby, 4–6 mg/kg/min of 10% dextrose is 4.8–7.2 ml/hour (rate = GIR × weight × 6 ÷ concentration). Discuss the exact plan with your facilitator.',
        'Work it out')),
]
ADD = [a for a in ADD if a[1]]
