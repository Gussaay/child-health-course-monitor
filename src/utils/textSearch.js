// src/utils/textSearch.js
//
// Searching and filtering by a name or label that came from the database.
//
// Records in this app are typed in by many people over years, and a field
// that is "always a string" is not: a facility or participant name can be
// stored as a number, or be missing entirely. Every searchable dropdown
// used to call `.toLowerCase()` on the raw value, so one such record
// crashed the whole screen for whoever opened it — Admin → Problems,
// 20/11/2026, v41.2: "n.label.toLowerCase is not a function", in a useMemo
// filter on the landing screen, twice in two minutes. The same pattern
// caused "i.phone.includes is not a function" in October; the phone sites
// were fixed one by one with String(...), and this helper is that fix in
// one place for the name/label filters.
//
// lowerText never throws and never trims: it changes only the type, so a
// filter behaves exactly as before for the well-formed records that are
// almost all of them.

/** The value as lowercase text: '' for null/undefined, String() otherwise. */
export const lowerText = (value) => (value == null ? '' : String(value)).toLowerCase();

/** Case-insensitive "does `value` contain `term`?", safe for any stored type. */
export const textIncludes = (value, term) => lowerText(value).includes(lowerText(term));

/** Case-insensitive equality, safe for any stored type. */
export const textEquals = (a, b) => lowerText(a) === lowerText(b);
