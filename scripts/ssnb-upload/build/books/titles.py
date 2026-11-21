# Course and lesson titles that other lessons link to (courselink blocks find a
# lesson by course title, module number and lesson title, so they are kept here once).
from lib import courselink

M1 = 'Sick & Small Newborn · Module 1: Essential and Emergency Newborn Care'
M2 = 'Sick & Small Newborn · Module 2: Special Newborn Care'
M3 = 'Sick & Small Newborn · Module 3: Intensive Newborn Care'

# Module 2, Section 7 (Neonatal Procedures) and Section 8 (Equipment): reference modules.
M2_S7 = {
    'Procedure Pain prevention and management': 'Pain prevention and management during procedures',
    'Procedure Pain prevention and management: Environmental and behavioral approaches during procedure': 'Pain prevention: environmental and behavioural approaches',
    'Umbilical Artery and Umbilical Vein Catheterization': 'Umbilical artery and umbilical vein catheterization',
    'Uumbilical Vein Catheterization': 'Umbilical vein catheterization (UVC)',
    'Peripherally inserted central catheter (PICC)': 'Peripherally inserted central catheter (PICC)',
    'Intraosseous Access': 'Intraosseous access',
    'ETT tube insertion': 'Endotracheal tube (ETT) insertion',
    'Needle Thoracotomy': 'Needle thoracotomy',
    'Chest tube insertion in neonate': 'Chest tube insertion',
    'Chest tube insertion in neonate: Personnel': 'Chest tube insertion: personnel and steps',
    'Lumbar Puncture': 'Lumbar puncture',
    'Urinary Bladder Catheterization': 'Urinary bladder catheterization',
    'Suprapupic Bladder Aspiration': 'Suprapubic bladder aspiration',
}
M2_S8 = {
    'Radiant warmers': 'Radiant warmer',
    'Radiant warmers: Disinfection of Warmer': 'Radiant warmer: disinfection',
    'Embrace Portable Warmer': 'Embrace portable warmer',
    'Infant Incubator': 'Infant incubator',
    'Infant Incubator: PRACTISE THIS SKILL Steps for daily routine Incubator cleaning': 'Infant incubator: daily cleaning and disinfection',
    'Vayu bCPAP System': 'Vayu bubble CPAP system',
    'Pulse Oximeter': 'Pulse oximeter',
    'Phototherapy machine': 'Phototherapy machine',
    'Syringe pumps': 'Syringe pump',
    'Infusion pump': 'Infusion pump',
    'SUCTION MACHINE': 'Suction machine',
    'Suction Bulb': 'Suction bulb',
    'Bag And Mask': 'Bag and mask',
    'Oxygen concentrators': 'Oxygen concentrator',
    'Oxygen Blender': 'Oxygen blender',
}

def procedure(lesson, text=''):
    """Link to a lesson of Module 2, Section 7 (Neonatal Procedures)."""
    assert lesson in M2_S7.values(), lesson
    return courselink(M2, 7, lesson, 'Procedure · Module 2, Neonatal Procedures', text)

def equipment(lesson, text=''):
    """Link to a lesson of Module 2, Section 8 (Equipment)."""
    assert lesson in M2_S8.values(), lesson
    return courselink(M2, 8, lesson, 'Equipment · Module 2, Equipment for Newborn Care', text)

def lesson_in(course, module, lesson, label, text=''):
    return courselink(course, module, lesson, label, text)
