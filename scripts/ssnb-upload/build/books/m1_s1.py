# Module 1, Section 1 (The Golden Minute of Life): lesson titles, activities, videos.
# Every activity is written from the manual's own text in the lesson; the
# explanation quotes or points to that text.
from lib import *

TITLES = {
    'Introduction to Golden Minute': 'The golden minute: what it is and why it matters',
    'Prepare for the golden minutes': 'Antenatal counselling: why and who',
    'Prepare for the golden minutes: What is the basis for antenatal counseling?': 'Antenatal counselling: basis, components and what to tell parents',
    'Prepare for the golden minutes: What are the factors to be considered during counseling parents antenatally for extreme preterm delivery?': 'Calling the neonatal team: the SBAR format',
    'Prepare for the golden minutes: High risk deliveries': 'High-risk deliveries and the questions to ask before birth',
    'Prepare for the golden minutes: Equipment checks and preparation': 'Equipment checks and preparation for specific conditions',
    'Prepare for the golden minutes: NRP: quick equipment check': 'The NRP quick equipment check',
    'Essential Newborn Care (EENC)': 'Early essential newborn care and the initial steps',
    'Essential Newborn Care (EENC): Definition': 'Delayed cord clamping: definition and evidence',
    'Essential Newborn Care (EENC): NRP recommendations regarding delayed cord clamping (DCC)': 'Delayed cord clamping: recommendations and contraindications',
    'Essential Newborn Care (EENC): Introduction': 'Thermoregulation: normal temperature and why hypothermia matters',
    'Essential Newborn Care (EENC): Risk Factors for Hypothermia': 'Hypothermia: risk factors and the four ways a baby loses heat',
    'Essential Newborn Care (EENC): Signs and symptoms of hypothermia': 'Hypothermia: signs, prevention and the delivery room',
    'Essential Newborn Care (EENC): Uninterrupted skin-to-skin contact for 60-90 minutes': 'Skin-to-skin contact and the warm chain',
    'Essential Newborn Care (EENC): Provides Early essential newborn care to Breathing Baby Checklist': 'Checklist: early essential newborn care for a breathing baby',
}

ADD = [
    ('Of note, the Golden Minute concept is not restricted', []),
    ('Lack of knowledge and skills that may be needed', q(
        'When does the Golden Minute start?',
        ['When the whole body of the baby is delivered', 'When the baby first cries', 'One minute after birth, once the APGAR score is calculated', 'When the cord is clamped'], 0,
        'The manual: "The Golden Minute timeframe starts when the whole body is delivered." Do not wait one minute to calculate the APGAR score before deciding the baby needs resuscitation.')),
    ('To prepare parents fir the hospital course', q(
        'Who should ideally do the antenatal counselling?',
        ['The obstetric team and the neonatal team together', 'The midwife alone', 'The neonatal team only, after birth', 'Whoever is free on the ward'], 0,
        'The manual: "Ideally both obstetrics team and neonatal team should do counseling together and present a consistent approach for the newborn."')),
    ('ongoing support.', flip('The three components of effective counselling', [
        ('Component 1', 'Assessment of risks'), ('Component 2', 'Communication of those risks'), ('Component 3', 'Ongoing support')])),
    ('Documentation:', reveal(
        'A mother in preterm labour asks you how long her baby will stay in the NICU. What does the manual say parents should be told before the birth?',
        'The most accurate prognostic morbidity and mortality data available (hospital, regional or national); that the exact prognosis and long-term neurologic outcome cannot be predicted exactly; and the expected duration of NICU stay and the morbidities likely for the gestational age and birth weight. The counselling is documented.')),
    ('When calling for neonatal assistance, the SBAR format should be used', []),
    ('Recommendation', [sort(
        'Sort each part of this call from the labour ward into its SBAR heading.',
        ['S: Situation', 'B: Background', 'A: Assessment', 'R: Recommendation'], [
            ('I’ve got a baby about to deliver with meconium and a non reassuring CTG', 'S: Situation'),
            ('The baby is at term, mum has gestational diabetes, and there have been no other concerns in pregnancy', 'B: Background'),
            ('The CTG trace is concerning, with late dips (late decelerations)', 'A: Assessment'),
            ('I need you to come to room 4 straight away', 'R: Recommendation')],
        'These are the manual\'s own SBAR examples.'),
        video('Calling the neonatal team with SBAR', 'A midwife calls the neonatal team about a high-risk delivery, using Situation, Background, Assessment, Recommendation.', 'SN1.1.1')]),
    ('Oligohydramnios', []),
    ('Maternal diabetes if insulin dependent and poorly controlled', q(
        'Which of these deliveries must be attended by the NRP team, with the paediatrician notified immediately?',
        ['Any meconium-stained amniotic fluid', 'A term vaginal birth with clear fluid and no risk factors', 'A mother aged 25 with a normal pregnancy', 'A planned breastfeeding mother'], 0,
        'Any meconium-stained amniotic fluid is on the manual\'s list of high-risk deliveries, with preterm < 37 weeks, multiple births, breech, emergency caesarean, prolapsed cord and the others.')),
    ('Fetal bradycardia', []),
    ('IUGR: intrauterine growth retardation; MAS: meconium aspiration syndrome', flip('Risk before birth → what to expect in the newborn', [
        ('Maternal diabetes', 'Hypoglycemia, hypocalcemia, macrosomia, cardiomyopathy'),
        ('Polyhydramnios', 'Esophageal atresia'),
        ('Oligohydramnios', 'Renal anomalies, lung hypoplasia'),
        ('Premature rupture of membranes', 'Early sepsis'),
        ('Administration of narcotic analgesic 4 hours before delivery', 'Baby born depressed with no respiratory effort')])),
    ('If the answer to all 3 of these questions', reveal(
        'A baby is born at term, with good muscle tone, crying. What do the 3 rapid questions tell you?',
        'All three answers are "yes" (term, good tone, crying or breathing), so the neonate does not need resuscitation and can stay with the mother for routine care.')),
    ('Double-check or confirmation by a senior member', q(
        'The routine daily equipment check was done this morning. A call comes for a delivery. Do you check the equipment again?',
        ['Yes: the prior resuscitation equipment check is done with each call, quickly and systematically', 'No: the routine check this morning is enough', 'Only if the baby is preterm', 'Only if a senior asks for it'], 0,
        'The manual: "The prior resuscitation equipment check should be done with each call, even if the routine checkup has been done."')),
    ('The infant’s head should be dried, and a woolen hat', q(
        'A baby is born at 30 weeks. How is the polyethylene bag used?',
        ['The body (not the head) goes into the bag wet, under a radiant heat source; the head is dried and covered with a woollen hat', 'The baby is dried fully, then wrapped in the bag including the head', 'The bag is used only after the baby reaches the unit', 'The bag replaces the radiant warmer'], 0,
        'From the manual\'s box "Preparation for specific neonatal conditions" (preterm < 32 weeks or < 1500 g).')),
    ('Ensure intubation equipment is available if advanced airway', q(
        'A baby is born through meconium-stained amniotic fluid. Should you suction the mouth, nose and trachea routinely?',
        ['No: assess, start the standard steps and focus on effective ventilation; suction only for obvious obstruction or ineffective ventilation', 'Yes: always suction the trachea before the first breath', 'Yes: suction the mouth and nose only', 'Only if the baby is vigorous'], 0,
        'The manual: "Do not perform routine suctioning of the mouth, nose, or trachea."')),
    ('Confirm readiness verbally to the team', [
        q('What is the flowmeter set to in the NRP quick equipment check, and the oxygen blender for a baby under 35 weeks?',
          ['10 L/min; blender 21–30%', '5 L/min; blender 100%', '10 L/min; blender 100%', '2 L/min; blender 21%'], 0,
          'Ventilate: "Flowmeter set to 10 L/min"; "Oxygen blender set to 21% (21% - 30% if <35 weeks’ gestation)".'),
        video('Preparing the resuscitation area and the quick equipment check', 'Going through the NRP quick equipment check: warm, clear airway, auscultate, ventilate, oxygenate, intubate, medicate.', 'SN1.1.2')]),
    ('Initiate additional interventions if status changes', [
        q('A vigorous term baby is on the mother\'s chest. When do you use bulb suction?',
          ['Only if secretions obstruct breathing or the baby struggles to clear them', 'Always, as soon as the baby is born', 'Before drying', 'Never, in any baby'], 0,
          'The manual: "Bulb suction only if secretions obstruct breathing or the newborn struggles to clear them." Wipe the mouth and nose with a cloth.'),
        video('Early essential newborn care: the first minutes', 'Drying, stimulation, skin-to-skin contact and ongoing monitoring of a vigorous term baby.', 'SN1.1.3')]),
    ('In term newborns, DCC for one-minute leads to the transfer', q(
        'In a term newborn, how much extra blood reaches the baby when the cord is clamped after one minute, and after three minutes?',
        ['80 ml after one minute; 100 ml in total after three minutes', '10 ml; 20 ml', '200 ml; 300 ml', 'None: blood flows back to the placenta'], 0,
        'The manual: "DCC for one-minute leads to the transfer of 80 ml of extra blood, and a delay of three minutes leads to the total transfer of 100 ml."')),
    ('Apgar score < 7 at five minutes', []),
    ('neonatal admission.', reveal(
        'What did the Cochrane meta-analysis find for delayed cord clamping compared with early clamping?',
        'Fewer transfusions for anaemia (RR 0.61), higher haemoglobin at 24–48 hours, less IVH (RR 0.59), lower NEC (RR 0.62) and a higher mean birth weight (101 g); but a higher peak bilirubin. In term neonates there was no significant difference in neonatal mortality, Apgar < 7 at five minutes, or neonatal admission.')),
    ('For preterm newborn infants <28 weeks’ gestation', q(
        'A baby is born at 26 weeks and does not need resuscitation. Is intact cord milking recommended?',
        ['No: for preterm infants < 28 weeks intact cord milking is not recommended', 'Yes, always', 'Yes, instead of delayed cord clamping', 'Only if the mother is bleeding'], 0,
        'NRP recommendations in the manual. For < 34 weeks without resuscitation, delaying cord clamping (≥ 30 seconds) can be beneficial.')),
    ('Maternal safety always takes precedence over neonatal benefit', sort(
        'Delayed cord clamping or immediate clamping? Sort each situation.',
        ['Immediate clamping (contraindication to DCC)', 'Delay cord clamping'], [
            ('Placental abruption with active bleeding', 'Immediate clamping (contraindication to DCC)'),
            ('Apnoea or gasping with heart rate < 100 that cannot be managed with the cord intact', 'Immediate clamping (contraindication to DCC)'),
            ('Umbilical cord avulsion', 'Immediate clamping (contraindication to DCC)'),
            ('Vigorous term baby, mother well', 'Delay cord clamping'),
            ('Preterm baby of 32 weeks who does not need resuscitation', 'Delay cord clamping')],
        'Delayed cord clamping is the standard of care for most newborns; the manual lists the absolute contraindications.')),
    ('Hypothermia is defined as a temperature < 36.5 °C', q(
        'What core temperature should a newborn be kept at, and below what temperature is it hypothermia?',
        ['36.5–37.5 °C; hypothermia below 36.5 °C', '35.5–37 °C; hypothermia below 35.5 °C', '37–38 °C; hypothermia below 37 °C', '36–37 °C; hypothermia below 35 °C'], 0,
        'The manual: maintain core temperature between 36.5 and 37.5 °C; hypothermia is a temperature < 36.5 °C.')),
    ('This is the greatest source of heat loss after birth', [
        sort('How is the baby losing heat? Sort each situation.', ['Conduction', 'Convection', 'Evaporation', 'Radiation'], [
            ('Placed naked on a cold weighing scale', 'Conduction'),
            ('A draft from an open window or a fan', 'Convection'),
            ('Amniotic fluid drying on the skin just after birth', 'Evaporation'),
            ('Lying near a cold wall, without touching it', 'Radiation')],
            'Evaporation is the greatest source of heat loss at birth; radiation is the greatest after birth.'),
        video('Four ways a newborn loses heat, and how to stop each', 'Conduction, convection, evaporation and radiation shown in a delivery room, with the action that prevents each.', 'SN1.1.4')]),
    ('All these signs are non-specific', q(
        'A baby is cold, feeding poorly and lethargic. The manual says the signs of hypothermia are non-specific. What does that mean for you?',
        ['They may also mean another serious condition, such as a bacterial infection', 'They prove the baby only needs warming', 'They appear only in preterm babies', 'They can be ignored once the baby is warm'], 0,
        'The manual: "All these signs are non-specific and may indicate other significant conditions, such as bacterial infection in the newborn."')),
    ('The birth environment should be ≥ 25-degree C', []),
    ('Breastfeeding within the first hour, where appropriate', q(
        'What temperature should the birth environment be, and for which babies is a plastic wrap or polyethylene bag used?',
        ['≥ 25 °C; babies born < 32 weeks and/or < 1500 g', '≥ 20 °C; all babies', '≥ 30 °C; babies < 2500 g', 'Any temperature; only babies who need resuscitation'], 0,
        'From the manual\'s list of warm-chain interventions in the delivery room.')),
    ('Stimulation of maternal oxytocin', q(
        'For how long does WHO advise uninterrupted skin-to-skin contact after birth?',
        ['At least 90 minutes, ideally longer', '5 minutes', '15 minutes', 'Until the baby is weighed'], 0,
        'The manual: WHO advises the initial contact should be prolonged and uninterrupted for at least 90 minutes, or ideally longer.')),
    ('Use servo-control if the radiant warmer is >10 minutes', [
        q('In the warm chain, when should the first bath be given?', ['Delay bathing until 6–8 hours or when stable', 'Immediately after birth', 'Within 30 minutes', 'Before the first breastfeed'], 0,
          'Step 5, "Postpone weighing and bathing": bathing soon after birth causes a temperature drop, with a risk of hypothermia and hypoglycaemia.'),
        video('Skin-to-skin contact and the ten steps of the warm chain', 'Placing a newborn skin-to-skin, covering, capping, and keeping the warm chain from delivery to the postnatal ward.', 'SN1.1.5')]),
    ('Counsel mother on feeding cues', [
        q('According to the checklist, how soon after birth should drying start, and when is the cord clamped?',
          ['Within 5 seconds; after cord pulsations have stopped (usually 1–3 minutes)', 'Within 1 minute; immediately', 'Within 30 seconds; after the placenta is delivered', 'After weighing; at 10 minutes'], 0,
          'Checklist steps 11 and 21. The clamp goes at 2 cm and the forceps at 5 cm from the umbilical base.'),
        video('Early essential newborn care for a breathing baby: the whole sequence', 'From pre-birth preparation to clamping the cord and counselling on feeding cues, following the checklist.', 'SN1.1.6')]),
]
ADD = [a for a in ADD if a[1]]
