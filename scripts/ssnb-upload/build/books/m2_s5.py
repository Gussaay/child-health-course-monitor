# Module 2, Section 5 (Care of the Premature Baby): titles, activities, videos, exercise split.
from lib import *
from books.titles import equipment, lesson_in, M3
from books.m1_s2 import ONLINE

P = 'Management of Selected Complications in preterm'
TITLES = {
    'Introduction to prematurity epidemiology': 'Prematurity: definitions and classification',
    'Introduction to prematurity epidemiology: Epidemiology': 'Prematurity: the burden and its challenges',
    'Introduction to prematurity epidemiology: Indicated preterm delivery Obstetric risks or complications': 'Why babies are born early: indicated and spontaneous preterm birth',
    'Strategies to Prevent Preterm Delivery': 'Preventing preterm delivery',
    'WHO recommendations for preventive care of the preterm': 'WHO recommendations: preventive care of the preterm baby',
    'WHO Recommendation of CARE FOR premature COMPLICATIONS': 'WHO recommendations: care for complications',
    'FAMILY INVOLVEMENT AND SUPPORT for Premature baby': 'WHO recommendations: family involvement and support',
    'Perinatal management of premature': 'Perinatal management: counselling, history and immediate care',
    'Perinatal management of premature: Equipment for resuscitation of the preterm infant': 'Resuscitation equipment, the limit of viability and palliative care',
    'Perinatal management of premature: Random movements not count': 'Gestational age: the New Ballard score (neuromuscular signs)',
    'Perinatal management of premature: Physical Maturity': 'New Ballard score: physical maturity; monitoring and screening',
    P: 'Necrotising enterocolitis: stages, risk factors and differential diagnosis',
    P + ': INVESTIGATIONS': 'Necrotising enterocolitis: investigations and treatment',
    P + ': MONITORING TREATMENT': 'NEC follow-up; intraventricular haemorrhage and its grades',
    P + ': The symptoms of intraventricular hemorrhage': 'Intraventricular haemorrhage: signs and ultrasound screening',
    P + ': Prevention of intraventricular Hemorrhage Antenatal Interventions': 'Preventing IVH; apnoea of prematurity',
    P + ': Stopping Caffeine': 'Stopping caffeine; respiratory distress in the late preterm',
    P + ': Jaundice': 'Jaundice: physiological or pathological?',
    P + ': Investigations for abnormal jaundice': 'Jaundice: investigations and treatment; retinopathy of prematurity',
    P + ': Etiology': 'Retinopathy of prematurity: cause and prevention',
    P + ': Tertiary measures': 'Retinopathy of prematurity: treatment and screening',
    'Exercises': 'Exercises: where does the preterm baby belong?',
}
SPLIT = [('CASE EXERCISE Exercise 4 — Case 1 — “He Is Too Small For That”', 'Exercises: KMC and feeding the small baby'),
         ('CASE EXERCISE Exercise 10 — Case 1 — Baby 1', 'Exercises: jaundice')]
ADD = [
    ('Micro preemie: less than 500 grams', sort(
        'Classify each baby by gestational age (the manual\'s sub-categories).', ['Extremely preterm (< 28 weeks)', 'Very preterm (28 to 31 6/7 weeks)', 'Moderate to late preterm (32 to < 36 6/7 weeks)'], [
            ('Born at 26 weeks', 'Extremely preterm (< 28 weeks)'), ('Born at 29 weeks', 'Very preterm (28 to 31 6/7 weeks)'),
            ('Born at 31 weeks', 'Very preterm (28 to 31 6/7 weeks)'), ('Born at 35 weeks', 'Moderate to late preterm (32 to < 36 6/7 weeks)')],
        'By weight: LBW < 2500 g; very LBW 1000–1500 g; extremely LBW < 1000 g; micro preemie < 500 g.')),
    ('maintenance of growth as well as dealing with very delicate', q(
        'Preterm births account for about what share of neonatal deaths?', ['About 70%', 'About 10%', 'About 25%', 'Almost none'], 0,
        'The manual: preterm births account for approximately 70% of neonatal deaths and 36% of infant deaths. In low-income settings, half of babies born at or below 32 weeks die.')),
    ('It is unclear how much risk some of these lifestyle', q(
        'Which is the highest risk factor for spontaneous preterm delivery?', ['A prior preterm birth', 'Maternal age 25', 'A first pregnancy', 'A singleton pregnancy'], 0,
        'From "Spontaneous preterm delivery": prior preterm birth (highest risk). 59% of twins and > 98% of higher-order multiples are born preterm.')),
    ('no studies have shown that use of antibiotics during preterm labor', q(
        'Preterm labour is confirmed at 30 weeks. Which single intervention does the manual say improves neonatal outcomes?', ['A course of antenatal corticosteroids (e.g. betamethasone two 12 mg IM doses 24 hours apart)', 'Antibiotics to delay delivery', 'Tocolysis alone', 'Bed rest'], 0,
        'Corticosteroids reduce RDS, IVH and NEC. Antenatal magnesium sulfate reduces cerebral palsy. Tocolytics have not been shown to improve neonatal outcomes directly.')),
    ('Application of topical oil to the body of preterm', q(
        'WHO: for how many hours a day should KMC be given, and by how much can tube or cup feeds be increased each day?', ['8–24 hours a day (as many as possible); up to 30 ml/kg per day', '1 hour a day; 5 ml/kg per day', 'Only at night; 60 ml/kg per day', 'Only after discharge; 10 ml/kg per day'], 0,
        'From the WHO recommendations for preventive care of the preterm.')),
    ('Caffeine may be considered for the prevention of apnoea', [
        q('What does WHO recommend for apnoea in preterm infants?', ['Caffeine', 'Phenobarbital', 'Increasing oxygen', 'Nothing until 34 weeks'], 0,
          'Caffeine is recommended for treatment of apnoea and for extubation of preterm infants born before 34 weeks. Bubble CPAP may be considered rather than other pressure sources.'),
        lesson_in(M3, 2, 'CPAP: how it works and its parts', 'More in Module 3 · CPAP')]),
    ('Parental leave and entitlements should address', reveal(
        'What are the four WHO recommendations on family involvement and support?',
        'Family involvement in routine care in the facility; extra support for families from birth through follow-up (education, counselling, discharge preparation, peer support); home visits by trained health workers; parental leave and entitlements for the special needs of these families.')),
    ('Before delivery, the attending staff should recheck essential equipment', q(
        'A baby of 34 weeks is about to be born. What does the manual say about resuscitation?', ['Above 32 weeks it is the same as for term infants; most need only drying and stimulation', 'Every preterm needs intubation', 'Only babies < 34 weeks need a team', 'No preparation is needed'], 0,
        'Below 32 weeks (or < 1500 g) more active support is needed; below 28 weeks this probably includes intubation. Ideally two experienced staff attend each anticipated preterm delivery.')),
    ('Human contact', flip('Palliative care of the extremely preterm baby: what is needed', [('1', 'Warmth'), ('2', 'Dignity'), ('3', 'Human contact'), ('4', 'Pain relief')])),
    ('Keep the pelvis flat on the examining surface', [
        q('For which babies does the manual say to obtain a gestational age score, and when?', ['All babies weighing less than 2000 g, within 24 hours of delivery', 'Only babies who die', 'All babies at discharge', 'Only term babies'], 0,
          'Score neuromuscular and physical features, add them, and read the maturity rating in weeks from the conversion table.'),
        video('Estimating gestational age with the New Ballard score', 'The six neuromuscular signs (posture, square window, arm recoil, popliteal angle, scarf sign, heel to ear) and the physical signs, on a baby or manikin.', 'SN2.5.1')]),
    ('The use of digital photographic retinal images', q(
        'In the monitoring section, which preterm babies should have a screening cranial ultrasound at 7–10 days?', ['Preterm infants < 32 weeks, and older preterms with complex courses', 'All babies above 36 weeks', 'Only babies with seizures', 'None'], 0,
        'IVH in extremely preterm infants may be clinically silent. Note: the IVH lesson gives days 5–7 for the first scan.')),
    ('take thorough feeding history, and establish any temporal relationships', sort(
        'Which modified Bell stage of NEC?', ['Stage 1: suspected', 'Stage 2: definite', 'Stage 3: advanced'], [
            ('Increased residuals and distension, X-ray non-diagnostic', 'Stage 1: suspected'),
            ('Pneumatosis intestinalis on X-ray', 'Stage 2: definite'),
            ('Pneumoperitoneum, hypotension and DIC', 'Stage 3: advanced')], 'From the modified Bell\'s criteria in the manual.')),
    ('Discuss with surgical team: may need transfer', q(
        'A baby has proven NEC. What is the immediate treatment?', ['Nil by mouth, free NG drainage, triple antibiotics, IV fluids or PN, and discuss with the neonatologist and surgeons', 'Continue feeds at half volume', 'Oral antibiotics only', 'Wait for a repeat X-ray tomorrow'], 0,
        'Triple antibiotics in the manual: flucloxacillin, gentamicin and metronidazole; total IV volume ≤ 150 ml/kg.')),
    ('Volpe (2008) based on cUS', []),
    ('Mortality', []),
    ('Appropriate developmental follow-up', q(
        'When does nearly all IVH happen?', ['Within the first four days of life', 'After the first month', 'Only during labour', 'At discharge'], 0,
        'IVH is most common in very low birthweight babies under 1500 g. Grade IV is intraparenchymal haemorrhage.')),
    ('Ventriculomegaly on the routine day 28 scan', q(
        'When is the first routine cranial ultrasound done in this lesson, and the second?', ['Days 5–7; around day 28', 'Day 1; day 7', 'Day 14; day 60', 'Only if there are signs'], 0,
        'Days 5–7 catch all IVH and > 90% of parenchymal haemorrhages; day 28 shows parenchymal changes and ventriculomegaly.')),
    ('prior to immunizations in an ex-preterm neonate', q(
        'Which babies are generally given caffeine routinely?', ['Infants < 30 weeks', 'All term infants', 'Only babies on ventilators', 'Infants 34–36 weeks'], 0,
        'Infants 30–34 weeks are generally given caffeine if symptomatic. Apnoea of prematurity: > 15 seconds of no breathing, often with bradycardia and/or hypoxia.')),
    ('The chest X-ray is taken after the baby has been stabilized', q(
        'Where is the oxygen saturation of a late preterm with respiratory distress measured?', ['The right upper limb (preductal), probe shielded from light', 'Any toe', 'The left foot (postductal)', 'The ear lobe'], 0,
        'From "Respiratory distress". A baby with respiratory distress should not feed orally: feeds go by tube. Caffeine is generally stopped at 32–34 weeks if stable.')),
    ('Conjugated bilirubin >20% of total', sort(
        'Physiological jaundice or a red flag for pathological jaundice?', ['Physiological', 'Red flag: pathological'], [
            ('Appears after 24 hours, peaks day 3–5', 'Physiological'),
            ('Onset before 24 hours', 'Red flag: pathological'),
            ('Bilirubin rising more than 5 mg/dL (85 µmol/L) per day', 'Red flag: pathological'),
            ('Lasting more than 2 weeks (unconjugated)', 'Red flag: pathological'),
            ('Conjugated bilirubin more than 20% of total', 'Red flag: pathological')], 'From "Red Flags for Pathological Jaundice".')),
    ('Visible jaundice anywhere on the body on day 1', [
        video('Phototherapy: setting it up and caring for the baby', 'Baby undressed except the nappy, eyes covered, lights at the right distance, turning, feeding and checking the bilirubin.', 'SN2.5.2'),
        equipment('Phototherapy machine')]),
    ('avoid blood transfusion (consult neonatologist)', q(
        'Which of these is a primary measure to prevent ROP?', ['Avoid 100% unmonitored oxygen: use oximeters with saturation targets and alarms', 'Give oxygen at 100% to all preterms', 'Delay breastfeeding', 'Bath the baby daily'], 0,
        'ROP is not present at birth but appears after 2–3 weeks; first examination at about 4 weeks postnatal age.')),
    ('Neonatal hypoxia, hypothermia, and hypotension', q(
        'According to the ROP screening table, which infants are screened when gestational age is known?', ['All born at 34 weeks or less, and those above 34 weeks with risk factors', 'Only babies < 28 weeks', 'Only babies who had oxygen', 'Only babies > 2000 g'], 0,
        'Without gestational age: all infants of 2000 g or less. Note: the monitoring section gives ≤ 1500 g or ≤ 30 weeks.')),
    ('Work through each exercise on your own or in your small group', ONLINE),
]
ADD = [a for a in ADD if a[1]]
