# Global Health Media Project videos added where a lesson shows the same skill but has no video slot.
# (book, section number, anchor text in the lesson, YouTube id, GHMP title). Checked 2026-11-21: GHMP's channel, embeddable.
from lib import video
GHM_CAPTION = 'Global Health Media Project (globalhealthmedia.org), shown whole as published on their YouTube channel.'
def ghm(vid, title):
    return video(title, GHM_CAPTION, url=f'https://www.youtube.com/watch?v={vid}')
EXTRA = [
    ('m1', 1, 'All these signs are non-specific', '-6T7f40EB9E', 'The Cold Baby - Newborn Care Series'),
    ('m1', 3, 'Place used needles in a solid container', 'VAb_zGqiyZg', 'Giving an Intramuscular Injection - Newborn Care Series'),
    ('m1', 3, 'Weight ≥2500g', '8foaEYKfDRo', 'Newborn Physical Exam - Newborn Care Series'),
    ('m1', 3, 'Assess temperature every four hours during routine care', '_uhWHZOtq2U', 'The Hot Baby - Newborn Care Series'),
    ('m2', 4, 'Possible higher rate of treatment failure when used as primary mode', 'MYCFuEP6Gd4', 'Breathing Problems - Newborn Care Series'),
    ('m2', 4, 'Current evidence indicates that trophic or minimal enteral feedings', 'aTjymWCGHdc', 'Feeding with a Nasogastric Tube - Small Baby Series'),
    ('m2', 4, 'Current evidence indicates that trophic or minimal enteral feedings', 'V2N6MXL3RrE', 'Inserting a Nasogastric Tube - Small Baby Series'),
    ('m2', 5, 'Application of topical oil to the body of preterm', 'OkhSJ16FHfY', 'Cup Feeding - Small Baby Series'),
    ('m2', 5, 'Conjugated bilirubin >20% of total', 'RRV-9Jf0eI0', 'Jaundice - Newborn Care Series'),
    ('m2', 10, 'History of fever more than 38 degree or offensive vaginal discharge', 'MdDD9n7Cz-o', 'Sepsis - Newborn Care Series'),
    ('m2', 10, 'Otherwise continue ampicillin IM/IV 50 mg/kg every 12 hours', 'Z54GscbV440', 'Managing Severe Infection in Newborns - Newborn Care Series'),
    ('m2', 10, 'Otherwise continue ampicillin IM/IV 50 mg/kg every 12 hours', 'exbaCZhzsfo', 'Preparing Ampicillin and Gentamicin for Injection - Newborn Care Series'),
]
