# Module 2, Sections 1–3: health system, triage, admission. Titles, activities, videos.
from lib import *
from books.m1_s2 import ONLINE

S1_TITLES = {'Introduction': 'Newborn deaths in Sudan and the national plan (SuNAP)', 'Level of Newborn Care': 'Levels of newborn care'}
S1 = [
    ('Most neonatal deaths (75%) occur during the first week of life', [
        q('What was Sudan\'s neonatal mortality rate in 2023?', ['24.8 per 1,000 live births', '12 per 1,000 live births', '41.7 per 1,000 live births', '2.48 per 1,000 live births'], 0,
          'About 41,690 neonatal deaths a year. SuNAP aims for 50% of states to reach 12 or fewer neonatal deaths per 1,000 live births by 2030.'),
        q('When do most neonatal deaths happen?', ['In the first week of life (75%)', 'After the first month', 'Equally across the first year', 'Only in the second week'], 0,
          'About 1 million newborns worldwide die within the first 24 hours.')]),
    ('Pre discharge advice on mother and baby care and follow up', sort(
        'At which level of newborn care is each service provided (the lowest level that provides it)?',
        ['Level 1: essential newborn care', 'Level 2: special newborn care', 'Level 3: intensive newborn care'], [
            ('Immediate newborn care and early breastfeeding', 'Level 1: essential newborn care'),
            ('Pre-discharge advice and follow up', 'Level 1: essential newborn care'),
            ('Kangaroo mother care', 'Level 2: special newborn care'),
            ('Continuous positive airway pressure', 'Level 2: special newborn care'),
            ('Exchange transfusion', 'Level 2: special newborn care'),
            ('Mechanical ventilation and surfactant', 'Level 3: intensive newborn care'),
            ('Screening and treatment for retinopathy of prematurity', 'Level 3: intensive newborn care')],
        'From the manual\'s table "Level of Newborn Care".')),
]

S2_TITLES = {'Triage of newborn at special care newborn unit': 'Triage of the newborn on arrival', 'Further Assessment and Management': 'After triage: further assessment'}
S2 = [
    ('A video showing fast breath, slow breath', video('Signs of illness in newborns', 'Fast and slow breathing, chest indrawing, grunting, seizures, pustules and bullae, pallor; using a thermometer.', 'SN2.2.1')),
    ('Newborns identified as "Non-Urgent" do not need', [
        sort('Triage: which group does each baby belong to? (the manual\'s Neonatal Triage chart)', ['Emergency: initiate emergency treatment', 'Priority: assess and act rapidly', 'Non-urgent: assess carefully'], [
            ('Apnoea or gasping', 'Emergency: initiate emergency treatment'),
            ('Cold periphery, CRT > 3 seconds, weak fast pulse', 'Emergency: initiate emergency treatment'),
            ('Convulsions', 'Emergency: initiate emergency treatment'),
            ('Temperature below 36 °C', 'Emergency: initiate emergency treatment'),
            ('Temperature 36.2 °C (cold stress)', 'Priority: assess and act rapidly'),
            ('Weight 1.6 kg', 'Priority: assess and act rapidly'),
            ('Bleeding from the umbilical stump', 'Priority: assess and act rapidly'),
            ('Mild jaundice, feeding well', 'Non-urgent: assess carefully'),
            ('Posseting', 'Non-urgent: assess carefully')], ''),
        q('A newborn is triaged "Priority". What happens next?', ['A swift assessment, then admission to the SNCU', 'Immediate resuscitation before anything else', 'Discharge with advice', 'Wait until all non-urgent babies are seen'], 0,
          'Emergency: immediate intervention, stabilise, then admit. Priority: swift assessment then admission. Non-urgent: thorough evaluation and parental counselling.')]),
    ('This includes obtaining a comprehensive history', reveal(
        'Emergency care has been given and the baby is stable. What comes next?',
        'A detailed assessment: a comprehensive history, and identifying any at-risk neonates based on maternal characteristics and other relevant factors.')),
]

S3_TITLES = {
    'Admission process: welcoming': 'Admission to the SCNU: goals and the four steps',
    'Preparation before receiving the baby': 'Preparing before the baby arrives',
    'Receiving the newborn baby': 'Receiving the baby: handover, assessment and stability',
    'Writing and reviewing admission orders': 'Writing and reviewing admission orders',
    'Parental Support': 'Supporting the parents',
    'Exercises': 'Exercises: triage and admission',
}
S3 = [
    ('Receiving the baby Endorsement or handover', []),
    ('Parental support', steps('The four steps of admission, in order', [
        ('1. Preparation before receiving the baby', 'An admission team is organised as soon as the call comes; equipment checked; a warm environment.'),
        ('2. Receiving the baby', 'Endorsement or handover, assessment, maintaining stability and monitoring, done at the same time.'),
        ('3. Writing and reviewing admission orders', 'Sampling, procedures, medications.'),
        ('4. Parental support', 'Updating, supporting and involving the parents.')])),
    ('Admission file with necessary charts like Ballard', q(
        'The call comes: a 28-week baby is on the way. Which of these does the manual list to check before the baby arrives?',
        ['Prewarmed incubator or warmer, admission trolley, vital signs monitor, the ventilatory support asked for, and the admission file', 'Only the admission file', 'Only a cot and a blanket', 'Nothing until the baby arrives'], 0,
        'Items a) to e) in "Preparation before receiving the baby".')),
    ('Blood glucose monitoring and judicious management of hypoglycemia', [
        q('On arrival, who receives the handover (endorsement)?', ['Each staff member, medical and nursing, receives their own', 'Only the doctor', 'Only the nurse in charge', 'Whoever is free'], 0,
          'The manual: "Each staff (medical and nursing staff) should receive their own endorsement."'),
        video('Receiving a newborn in the SCNU', 'Three team members work at the same time on arrival: handover, rapid assessment and vital signs, warmth and monitoring; growth measurements when stable.', 'SN2.3.1')]),
    ('The orders must be recorded and reviewed by nursing staff', q(
        'Who reviews the written admission orders, and what happens to an unclear order?', ['At least 2 nurses review them; anything unclear is clarified with the medical staff immediately', 'Nobody: the doctor writes them', 'The pharmacist at the end of the day', 'The parents sign them'], 0,
        'From "Writing and reviewing admission orders". The orders cover level of care and each system (CNS, CVS, respiratory, GIT, renal and fluid, infection, procedures, medications).')),
    ('Parents will be asked to provide consent', reveal(
        'A father arrives in the SCNU an hour after admission. What does the manual say the team should tell and offer the parents?',
        'Update them on the situation on admission and after stabilization, describe how sick the baby is now, outline the plan and what to expect; give the facts gently, respecting their beliefs and feelings; welcome them to visit often; offer support for breast milk expression; ask consent for procedures and treatments.')),
    ('Work through each exercise on your own or in your small group', ONLINE),
]
S1 = [a for a in S1 if a[1]]; S2 = [a for a in S2 if a[1]]; S3 = [a for a in S3 if a[1]]
