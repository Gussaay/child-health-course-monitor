// src/components/imnci/onlineCourses/categories.js
//
// Online courses are grouped the way the face-to-face courses are: a category
// (the package, the same names as a course's course_type, e.g. IMNCI, ETAT)
// and a subcategory inside it (e.g. "Standard 7 days course for medical
// doctor", "ETAT Plus"). Both are saved on the course document as `category`
// and `subcategory`; the subcategory can be any name an author types, with the
// face-to-face list offered first.
import { BUILTIN_SUBCOURSE_TYPES } from '../../constants';

export const OTHER_CATEGORY = 'Other';

// The categories in the order they are listed.
export const COURSE_CATEGORIES = [...Object.keys(BUILTIN_SUBCOURSE_TYPES), OTHER_CATEGORY];

export const subcategoriesFor = (category) => BUILTIN_SUBCOURSE_TYPES[category] || [];

/** A course's category: the one saved on it, or (for older courses) read from its title. */
export function categoryOf(course) {
    const saved = String(course?.category || '').trim();
    if (saved) return saved;
    const title = String(course?.title || '');
    if (/\betat\b/i.test(title)) return 'ETAT';
    if (/\b(imnci|imci)\b/i.test(title)) return 'IMNCI';
    if (/\b(emonc|eenc)\b/i.test(title)) return 'EmONC';
    if (/\b(ssnc|small\s*&?\s*sick)\b/i.test(title)) return 'Small & Sick Newborn';
    if (/\biccm\b/i.test(title)) return 'ICCM';
    if (/\bipc\b/i.test(title)) return 'IPC';
    return OTHER_CATEGORY;
}

export const subcategoryOf = (course) => String(course?.subcategory || '').trim();

/**
 * Courses grouped for the list: [{ category, subgroups: [{ subcategory, courses }] }],
 * categories in COURSE_CATEGORIES order (then any other names), and inside a
 * category the courses with no subcategory first, then each subcategory by name.
 * The courses keep the order they were given in.
 */
export function groupCourses(courses) {
    const byCat = new Map();
    (courses || []).forEach((c) => {
        const cat = categoryOf(c);
        const sub = subcategoryOf(c);
        if (!byCat.has(cat)) byCat.set(cat, new Map());
        const subs = byCat.get(cat);
        if (!subs.has(sub)) subs.set(sub, []);
        subs.get(sub).push(c);
    });
    const rank = (cat) => { const i = COURSE_CATEGORIES.indexOf(cat); return i < 0 ? COURSE_CATEGORIES.length - 1 : i; };
    return [...byCat.entries()]
        .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
        .map(([category, subs]) => ({
            category,
            subgroups: [...subs.entries()]
                .sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
                .map(([subcategory, list]) => ({ subcategory, courses: list })),
        }));
}
