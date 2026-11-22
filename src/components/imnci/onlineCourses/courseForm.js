// src/components/imnci/onlineCourses/courseForm.js
//
// Small pure helpers for the course and group forms, kept dependency-free so
// they can be tested on their own:
//   facilitatorMatches  the group form's facilitator picker works from the
//                       WHOLE facilitator list: with no search text it
//                       returns everyone (sorted by name) so the list can be
//                       browsed, and a search matches the same fields the
//                       picker has always searched.
//   courseSavePayload   what the course form sends when it saves. A draft
//                       save never refuses for missing information: it is
//                       always unpublished, and a course with no title yet
//                       is saved under a placeholder the author renames
//                       later. A normal save keeps the form's values (the
//                       form itself still asks for a title there).

const FACILITATOR_LIMIT = 100;

const facilitatorText = (f) => `${f.name || ''} ${f.arabicName || ''} ${f.phone || ''} ${f.email || ''} ${f.currentState || ''} ${(f.courses || []).join(' ')}`.toLowerCase();

export function facilitatorMatches(list, queryText, limit = FACILITATOR_LIMIT) {
    const alive = (Array.isArray(list) ? list : []).filter((f) => f && f.isDeleted !== true);
    const sorted = [...alive].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    const q = String(queryText || '').trim().toLowerCase();
    const found = q ? sorted.filter((f) => facilitatorText(f).includes(q)) : sorted;
    return found.slice(0, Math.max(0, limit));
}

export function courseSavePayload(form, { draft = false, untitled = 'Untitled course (draft)' } = {}) {
    const f = form || {};
    const title = String(f.title || '').trim();
    const payload = {
        ...f,
        title: draft && !title ? untitled : title,
        category: String(f.category || '').trim(),
        subcategory: String(f.subcategory || '').trim(),
    };
    if (draft) payload.isPublished = false;
    return payload;
}
