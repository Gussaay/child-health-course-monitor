// src/components/imnci/onlineCourses/areas.js
//
// The programme areas the Online Courses page opens with, each a tile with its
// icon and full name: IMNCI, ETAT, Newborn, Adolescent, Program Management (and
// Other, for anything else, shown only when it has courses). A course belongs to
// an area through its category (categories.js): the newborn packages (Small &
// Sick Newborn, EmONC/EENC, community midwives) are one area, and so on.
import { Stethoscope, Siren, Baby, Sprout, ClipboardList, GraduationCap } from 'lucide-react';
import { categoryOf } from './categories';

export const AREAS = [
    { id: 'imnci', short: 'IMNCI', full: 'Integrated Management of Newborn and Childhood Illness', icon: Stethoscope,
        categories: ['IMNCI', 'ICCM'] },
    { id: 'etat', short: 'ETAT', full: 'Emergency Triage, Assessment and Treatment', icon: Siren,
        categories: ['ETAT'] },
    { id: 'newborn', short: 'Newborn', full: 'Newborn care: Small & Sick Newborn, EENC and EmONC', icon: Baby,
        categories: ['Small & Sick Newborn', 'EmONC', 'EENC', 'Comprehensive Package For Community Midwives'] },
    { id: 'adolescent', short: 'Adolescent', full: 'Adolescent health', icon: Sprout,
        categories: ['Adolescent', 'Adolescent Health'] },
    { id: 'program', short: 'Program Management', full: 'Program management, planning and supervision', icon: ClipboardList,
        categories: ['Program Management'] },
];

export const OTHER_AREA = { id: 'other', short: 'Other', full: 'Other courses (infection prevention and more)', icon: GraduationCap, categories: [] };

/** The area a course belongs to. */
export function areaOf(course) {
    const cat = categoryOf(course);
    if (/adolesc/i.test(cat) || /adolesc/i.test(String(course?.title || ''))) return AREAS.find((a) => a.id === 'adolescent');
    return AREAS.find((a) => a.categories.includes(cat)) || OTHER_AREA;
}

/** [{ area, courses }]: every main area (empty ones too), then Other when it has courses. */
export function coursesByArea(courses = []) {
    const out = AREAS.map((area) => ({ area, courses: [] }));
    const other = { area: OTHER_AREA, courses: [] };
    courses.forEach((c) => {
        const a = areaOf(c);
        (out.find((x) => x.area.id === a.id) || other).courses.push(c);
    });
    return other.courses.length ? [...out, other] : out;
}
