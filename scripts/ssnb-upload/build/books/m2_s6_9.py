# Module 2, Sections 6 (Kangaroo Mother Care) and 9 (Patient Safety).
from lib import *
from books.m1_s2 import ONLINE

S6_TITLES = {
    'KMC indication and Contraindication': 'Kangaroo mother care: what it is, who it is for',
    'KMC place and equipment': 'KMC: the place and the equipment',
    'KMC Parent and infant preparation': 'KMC: preparing the parents and the baby',
    'Steps of KMC': 'KMC step by step, and the position checklist',
    'Exercises': 'Exercises: kangaroo mother care',
}
S6_MERGE = [['Steps of KMC', 'KMC position Checklist']]
S6 = [
    ('Inability of parent or caregiver to provide KMC', sort(
        'Can KMC start now, or is there a contraindication?', ['Start KMC', 'Contraindication for now'], [
            ('A stable 1.6 kg preterm baby', 'Start KMC'), ('A 1.8 kg baby, feeding by tube, stable', 'Start KMC'),
            ('A baby with ongoing seizures', 'Contraindication for now'), ('Severe jaundice needing exchange transfusion', 'Contraindication for now'),
            ('Life-threatening instability', 'Contraindication for now')],
        'KMC is indicated for preterm and/or low birth weight babies under 2,000 g. Contraindications from the manual.')),
    ('Other equipment and supplies like a thermometer', q(
        'What room temperature does the manual give for the KMC area?', ['22–24 °C', '15–18 °C', '28–30 °C', 'Any temperature'], 0,
        'Quiet, warm (22–24 °C) and private: NICU, SCNU, postnatal ward, breastfeeding rooms, bedside or at home after training.')),
    ('When the temperature drops below 22°C', q(
        'The room is at 23 °C. How is the baby dressed in the kangaroo position?', ['Naked except for the diaper, a warm hat and socks', 'Fully dressed and wrapped', 'A sleeveless shirt open at the front', 'Nothing at all'], 0,
        'Below 22 °C the baby wears a cotton sleeveless shirt open at the front, so the chest, abdomen, arms and legs stay skin-to-skin.')),
    ('Document the procedure in all relevant place', [
        q('How is the baby\'s head placed in KMC?', ['Turned to one side, ear over the parent\'s heart, so the nose is not blocked', 'Face down on the chest', 'Chin on the chest', 'Under the mother\'s clothes'], 0,
          'Step 10 of the manual\'s KMC steps. The baby is upright between the breasts.'),
        video('Kangaroo mother care: positioning step by step', 'Hand washing, temperature check, baby undressed except nappy and hat, upright between the breasts, head turned with the ear over the heart, wrapped and covered; temperature checked after.', 'SN2.6.1')]),
    ('Work through each exercise on your own or in your small group', ONLINE),
]

S9_TITLES = {
    'Patient Safety Introduction': 'Patient safety: goals and why it matters',
    'Patient identification.': 'Identifying the right baby',
    'Clear communication.': 'Clear communication',
    'Prescribing and administering Neonatal Medications': 'Prescribing and giving medicines safely',
    'Exercises': 'Exercise: a tenfold dose error',
}
S9 = [
    ('Strengthen Communication Effectiveness for Enhanced Patient Care', q(
        'How does the manual define patient safety?', ['Freedom from accidental injury', 'Having enough staff', 'Following the doctor\'s orders', 'Having no complaints'], 0,
        'WHO: medical errors affect 1 in 10 patients globally. The SCNU environment and the vulnerability of newborns amplify the risk.')),
    ('Check that the name, date of birth, and hospital or file number', [
        q('Before taking blood from a newborn, how do you identify the baby?', ['Use at least two identifiers from a band attached to the baby; never the bed number or a band on the cot', 'Use the cot number', 'Ask any nurse', 'Use the surname only'], 0,
          'Hospitals caring for newborns use at least two patient identifiers. Name twins distinctly, e.g. "Smith, Judy Girl A" and "Smith, Judy Girl B".'),
        video('Identifying newborns and closed-loop orders', 'Two identification bands, matching the lab form to the baby, and a verbal order read back and confirmed.', 'SN2.9.1')]),
    ('the care providers should read back their verbal medical orders', reveal(
        'A doctor gives you a verbal order by phone. What does the manual say you must do?',
        'Read the order back for verification. Written orders use the standard acronyms and abbreviations of the organisation.')),
    ('use of emergency medication sheets listing calculated doses by weight', q(
        'At which stage do three-quarters of neonatal medication errors occur?', ['Prescribing', 'Storage', 'Disposal', 'Documentation after giving'], 0,
        'Kaushal and colleagues, in the manual. Double-check the right patient, drug, dose, time and route before every medicine.')),
]
S6 = [a for a in S6 if a[1]]; S9 = [a for a in S9 if a[1]]
