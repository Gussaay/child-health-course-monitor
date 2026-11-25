// src/utils/coursePlaceText.js
//
// How a course's state/locality reads as text ("Multiple states" when there
// is more than one). Kept out of components/constants.js on purpose: eager
// modules (data.js, utils/recycleBin.js, training/TrainingGate.jsx) need
// only these lines, and importing them from constants.js pulled its ~99 KB
// of reference data into the first-load bundle. constants.js re-exports
// every name below, so existing importers keep working.

// A course held in more than one state or locality is shown as "Multiple
// states" / "Multiple localities" (not the list of names) in every page,
// table, form, report and shared-link text. `lang` 'ar' or 'en'; by default
// the page's language.
const placeList = (list, joined) => (Array.isArray(list) && list.filter(Boolean).length
    ? list.filter(Boolean).map((x) => String(x).trim())
    : String(joined || '').split(',').map((x) => x.trim()).filter(Boolean));
const placeLang = (lang) => (lang || (typeof document !== 'undefined' ? document.documentElement.lang : '') || 'en');
export const courseStateText = (course, lang) => {
    const list = placeList(course?.states, course?.state);
    if (list.length > 1) return placeLang(lang).startsWith('ar') ? 'ولايات متعددة' : 'Multiple states';
    return list[0] || '';
};
export const courseLocalityText = (course, lang) => {
    const list = placeList(course?.localities, course?.locality);
    if (list.length > 1) return placeLang(lang).startsWith('ar') ? 'محليات متعددة' : 'Multiple localities';
    return list[0] || '';
};
// "State - Locality", leaving out what is empty.
export const courseLocationText = (course, sep = ' - ', lang) =>
    [courseStateText(course, lang), courseLocalityText(course, lang)].filter(Boolean).join(sep);
