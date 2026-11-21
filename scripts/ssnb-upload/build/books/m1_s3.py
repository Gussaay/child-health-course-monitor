# Module 1, Section 3 (Assess, Identify and Refer the Small and Sick Newborn): titles, activities, videos.
from lib import *
from books.m1_s2 import ONLINE

TITLES = {
    'Essential care at 60-90 minute': 'Essential care at 60–90 minutes: eyes, cord and vitamin K',
    'Assess and classify the baby': 'Assess and classify the baby by 90 minutes',
    'Assess and Manage temperature problem': 'Assess and manage temperature problems',
    'Assess and management of Birth weight': 'Birth weight and the care it needs',
    'Support breastfeeding': 'Support breastfeeding: position and attachment',
    'Advise about breastfeeding problems': 'Breastfeeding problems',
    'Discharge and Home Care': 'Discharge and home care',
    'Referring Neonate': 'Referring a newborn: why it must be organised',
    'Referring Neonate: The attending health worker/midwife should carefully assess the baby to determine': 'Referring a newborn: assess, decide and stabilise',
    'Referring Neonate: Check equipment': 'Referring a newborn: equipment, team and documentation',
    'Referring Neonate: Communication': 'Referring a newborn: communication',
    'Referring Neonate: Neonatal transfer form from labor room/OR or primary care facility': 'Referring a newborn: methods of transport',
    'Referring Neonate: Kangaroo Fix Neonatal Restrain System': 'Referring a newborn: arrival, handover and summary',
    'Exercises': 'Exercises: assess, classify and refer',
}

ADD = [
    ('Place used needles in a solid container', [
        calc('What dose of vitamin K is given to a baby who weighs 1300 g?', 0.5, 'mg',
             explanation='Vitamin K is 1 mg, or 0.5 mg for babies < 1500 g, IM in the front, outside of the mid-thigh, around 90 minutes of age (not in the first hour, because it is painful).'),
        q('How is the cord cared for?', ['Keep it exposed and dry; apply nothing unless recommended by the health authority', 'Bandage it to keep it clean', 'Apply herbs or oil daily', 'Cover it with the nappy'], 0,
          'The manual: keep the cord exposed and dry; do not apply anything; do not bandage or cover it; if soiled, wash with clean water.'),
        video('Vitamin K, eye care and cord care at 90 minutes', 'Giving vitamin K IM in the mid-thigh, applying eye medicine to the lower lid, and caring for the cord.', 'SN1.3.1')]),
    ('Weight ≥2500g', sort(
        'Classify each baby at 90 minutes: which row of the table, and so which action?',
        ['Danger signs: antibiotics, stabilise for referral', 'Stabilise for referral', 'Skin-to-skin, breastfeeding support, treat risk', 'Routine care'], [
            ('Breathing 70 a minute with chest indrawing', 'Danger signs: antibiotics, stabilise for referral'),
            ('Convulsions', 'Danger signs: antibiotics, stabilise for referral'),
            ('Weight 1350 g', 'Stabilise for referral'),
            ('Weight 2100 g, temperature 36.2 °C', 'Skin-to-skin, breastfeeding support, treat risk'),
            ('Weight 3000 g, 36.8 °C, feeding well, normal exam', 'Routine care')],
        'From the manual\'s table "Classify babies by 90 minutes of birth".')),
    ('Assess temperature every four hours during routine care', q(
        'During routine care, how is the baby\'s temperature checked?',
        ['Every four hours, by touching the foot or forehead; measure if the skin feels too cool or too hot', 'Rectally every hour', 'Only at discharge', 'Only if the mother asks'], 0,
        'From "Prevent over-heating" in the manual.')),
    ('should receive advanced care and prolonged skin-to-skin', q(
        'A baby weighs 1700 g. What care does the manual recommend?',
        ['Prolonged skin-to-skin (kangaroo mother care)', 'Routine care only', 'A bath and a cot', 'Formula feeds every 6 hours'], 0,
        'Babies of 1500–2000 g should receive prolonged skin-to-skin (KMC); < 1500 g should receive advanced care and prolonged skin-to-skin.')),
    ('Baby sleeps well between feedings', [
        sort('Good or poor attachment?', ['Good attachment', 'Poor attachment'], [
            ('More areola seen above the lips than below', 'Good attachment'), ('Mouth wide open', 'Good attachment'),
            ('Lower lip turned outward', 'Good attachment'), ('Chin touching the breast', 'Good attachment'),
            ('Only the nipple in the mouth', 'Poor attachment'), ('Pain while feeding', 'Poor attachment')],
            'The manual\'s signs of good and poor attachment.'),
        video('Helping a mother with positioning and attachment', 'A mother semi-reclined with her baby: body supported, head and body in line, nose opposite the nipple; the four signs of good attachment.', 'SN1.3.2')]),
    ('Increase frequency of feeds', sort(
        'Which breast problem is it?', ['Breast engorgement', 'Sore or cracked nipples', 'Mastitis'], [
            ('Swelling and shininess of both breasts, no tenderness or redness', 'Breast engorgement'),
            ('Pinched appearance of the nipple after feeding', 'Sore or cracked nipples'),
            ('Painful, red, firm area in one breast, with fever', 'Mastitis')],
        'From "Advise about breastfeeding problems".')),
    ('Hand express milk', [
        q('When possible, how long after birth should a baby stay in the facility before discharge?',
          ['At least 24 hours', '2 hours', '6 hours', 'Until the cord falls off'], 0,
          'The manual: "When possible, discharge from the birth facility should not occur for at least 24 hours."'),
        video('Teaching a mother to hand express breast milk and cup feed', 'Hand expression step by step, and giving expressed milk by cup.', 'SN1.3.3')]),
    ('In hospital settings a pediatrician or neonatologist assesses', q(
        'Why does a newborn transfer need to be organised?',
        ['Unplanned or non-organised transfer may increase mortality and morbidity', 'It is only paperwork', 'Organised transfer is slower and less safe', 'It only matters for term babies'], 0,
        'The manual: "Unplanned or non-organized newborn transfer ... may increase the mortality and morbidity leading to worse outcomes."')),
    ('Continue necessary support during transport', reveal(
        'A baby is to be transferred. Before moving, what does stabilisation include?',
        'Maintain normal body temperature (treat and prevent hypothermia), maintain the airway, maintain circulation (pulses, CRT, access, fluids or feeds), give antibiotics if indicated, place a nasogastric tube for a distended abdomen, and continue the necessary support during transport.')),
    ('timing of moving to NICU and any event during transport', q(
        'Who should go with a sick, intubated preterm baby?',
        ['2 or more medical and nursing staff', 'One nurse with a cot', 'The mother alone', 'The ambulance driver'], 0,
        'The manual: "A stable newborn may be transferred on a cot with a nurse. However, sick intubated preterm needs 2 or more medical and nursing staff."')),
    ('Closely monitored transfer', [
        q('On the phone to the receiving NICU, what should be relayed clearly and read back?',
          ['The gestational age, diagnosis, level of care and type of respiratory support needed', 'Only the baby\'s name', 'The mother\'s address', 'Nothing: the handover is done on arrival'], 0,
          'Example from the manual: "we are going to transfer an ex preterm, 28 weeks, RDS, intubated by size 3 ETT with stable vitals, to level 3 NICU for ventilatory support".'),
        video('Preparing and moving a newborn for referral', 'Stabilising, checking transport equipment, the phone handover with read-back, and moving the baby safely.', 'SN1.3.4')]),
    ('Baby Pod range provides security and warmth', q(
        'Which transport device in the manual is a portable, non-electric mattress for preterm and low birthweight babies?',
        ['The portable warmer (infant warming mattress)', 'The Trotter portable incubator', 'The transport shuttle', 'The Kangaroo Fix system'], 0,
        'Method 1 in the manual\'s list of transport methods.')),
    ('Keep monitoring and observing the baby during transport.', []),
    ('use the safest available methods', reveal(
        'Put the eight steps of transferring a newborn in order, then check.',
        '1 Assess · 2 Decide (reason, level of care, respiratory support) · 3 Stabilise and maintain warmth, A, B, C · 4 Check equipment · 5 Organise the team and assign duties · 6 Documentation · 7 Communication · 8 Transfer: inform the SCNU of arrival time, safest method, no delays, keep monitoring, detailed handover on arrival.')),
    ('Work through each exercise on your own or in your small group', ONLINE),
]
ADD = [a for a in ADD if a[1]]
