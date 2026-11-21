// src/utils/facilitatorOptions.js
//
// The option lists for the people a course form picks from the facilitator
// list (course director, clinical instructor, group facilitators). They
// used to hide everyone who was not tagged for the course's package, so a
// package with nobody tagged yet — a new Small & Sick Newborn course, say —
// offered an empty search and the course could not be created at all.
//
// Now nobody is hidden: the whole facilitator list is offered, with the
// people tagged for the package first (each group sorted by name). Deleted
// facilitators stay out.

export function facilitatorOptionsFor(list, matches) {
    const alive = (Array.isArray(list) ? list : []).filter((f) => f && f.isDeleted !== true);
    const rank = (f) => {
        try { return matches(f) ? 0 : 1; } catch { return 1; }
    };
    return [...alive].sort((a, b) => (rank(a) - rank(b)) || String(a.name || '').localeCompare(String(b.name || '')));
}
