# Where each standard operating procedure (SOP) of the manual's Module 2 Section 7 (Neonatal Procedures) and
# Section 8 (Equipment) is placed. Sections 7 and 8 are not a module or a course of their own: each SOP is copied
# in full into every lesson that uses it, for example the radiant warmer wherever thermal care is taught, the
# lumbar puncture in sepsis management, and the bubble CPAP where CPAP is used.
#
# A lesson's own equipment()/procedure() call (books/titles.py) puts an SOP at that point of the lesson. PLACES adds
# more: (course key, lesson title, [SOP lessons]). The SOP goes at the end of the lesson.
# An SOP named here brings its companion lessons with it (GROUP), e.g. the warmer with its disinfection.

GROUP = {
    'Radiant warmer': ['Radiant warmer', 'Radiant warmer: disinfection'],
    'Infant incubator': ['Infant incubator', 'Infant incubator: daily cleaning and disinfection'],
    'Chest tube insertion': ['Chest tube insertion', 'Chest tube insertion: personnel and steps'],
    'Pain prevention and management during procedures': ['Pain prevention and management during procedures',
                                                         'Pain prevention: environmental and behavioural approaches'],
    'Umbilical artery and umbilical vein catheterization': ['Umbilical artery and umbilical vein catheterization',
                                                            'Umbilical vein catheterization (UVC)'],
}

PLACES = [
    # Module 1: Essential and Emergency Newborn Care
    ('m1', 'Equipment checks and preparation for specific conditions', ['Bag and mask']),
    ('m1', 'The NRP quick equipment check', ['Suction bulb', 'Suction machine']),
    ('m1', 'Hypothermia: signs, prevention and the delivery room', ['Radiant warmer']),
    ('m1', 'Assess and manage temperature problems', ['Embrace portable warmer']),
    ('m1', 'Shock: fluids, signs of improvement and antibiotics', ['Umbilical vein catheterization (UVC)', 'Intraosseous access']),
    ('m1', 'Hypoglycaemia: severe or with signs', ['Syringe pump']),
    ('m1', 'Seizures: lumbar puncture and genetic tests', ['Lumbar puncture']),
    ('m1', 'Referring a newborn: methods of transport', ['Embrace portable warmer']),
    # Module 2: Special Newborn Care
    ('m2', 'The golden hour, and keeping the baby warm in the SCNU', ['Radiant warmer']),
    ('m2', 'Supporting breathing after admission', ['Vayu bubble CPAP system', 'Oxygen concentrator and oxygen blender']),
    ('m2', 'Surfactant', ['Endotracheal tube (ETT) insertion']),
    ('m2', 'Supporting and monitoring the circulation', ['Umbilical artery and umbilical vein catheterization']),
    ('m2', 'Nutrition: the preterm and sick newborn, and fluids', ['Infusion pump']),
    ('m2', 'Nutrition: breast milk and parenteral nutrition', ['Peripherally inserted central catheter (PICC)']),
    ('m2', 'Nutrition: a glucose infusion scenario', ['Syringe pump']),
    ('m2', 'Resuscitation equipment, the limit of viability and palliative care', ['Bag and mask']),
    ('m2', 'Sepsis case definitions: clinical and laboratory-confirmed sepsis', ['Urinary bladder catheterization', 'Suprapubic bladder aspiration']),
    ('m2', 'Taking a blood culture', ['Pain prevention and management during procedures']),
    ('m2', 'Treating neonatal sepsis', ['Lumbar puncture']),
    ('m2', 'Preventing sepsis: manual disinfection of equipment', ['Radiant warmer: disinfection', 'Infant incubator: daily cleaning and disinfection']),
    # Module 3: Intensive Newborn Care
    ('m3', 'Mechanical ventilation: introduction and objectives', ['Endotracheal tube (ETT) insertion']),
    ('m3', 'Care and monitoring of a ventilated baby', ['Suction machine']),
    ('m3', 'Complications of mechanical ventilation', ['Chest tube insertion']),
]

# The manual's section each SOP comes from, for the heading over it.
PROCEDURES_SECTION = 'Module 2, Section 7: Neonatal Procedures'
EQUIPMENT_SECTION = 'Module 2, Section 8: Equipment'
