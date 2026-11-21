// src/utils/practiceParticipants.js
//
// Facilitators can try a course's forms: pre/post tests, case monitoring,
// attendance and the daily evaluation. To do that, each course's director,
// clinical instructor and facilitators are added to its participant list as
// PRACTICE participants. These are real participant documents, so every form
// can save against them. Their id always starts with `practice_`, so anything
// saved for one (a test, a case, an observation, an attendance mark, an
// evaluation) carries that id and can be recognized without another read.
//
// Practice entries and everything recorded for them are left out of every
// score, count, report, certificate and dashboard. The data layer drops them
// by default (see data.js), and only the screens where someone picks a
// participant ask for them back with { includePractice: true }.

export const PRACTICE_ID_PREFIX = 'practice_';

const isPracticeId = (id) => typeof id === 'string' && id.startsWith(PRACTICE_ID_PREFIX);

/** True for a practice participant document. */
export function isPracticeParticipant(p) {
    return !!p && (p.isPractice === true || isPracticeId(p.id));
}

/**
 * True for a participant OR any record saved for one: tests (participantId),
 * cases and observations (participant_id), attendance and evaluations.
 */
export function isPracticeRecord(rec) {
    if (!rec || typeof rec !== 'object') return false;
    if (rec.isPractice === true) return true;
    return isPracticeId(rec.id) || isPracticeId(rec.participantId) || isPracticeId(rec.participant_id);
}

/** The list without practice entries. Non-arrays pass through unchanged. */
export function withoutPractice(list) {
    return Array.isArray(list) ? list.filter((r) => !isPracticeRecord(r)) : list;
}

/** A course details bundle ({ participants, participantTests, allObs, allCases, ... }) without practice data. */
export function courseDetailsWithoutPractice(details) {
    if (!details) return details;
    return {
        ...details,
        participants: withoutPractice(details.participants),
        participantTests: withoutPractice(details.participantTests),
        allObs: withoutPractice(details.allObs),
        allCases: withoutPractice(details.allCases),
    };
}

/** True when the caller asked for practice entries ({ includePractice: true }). */
export function wantsPractice(options) {
    return !!(options && typeof options === 'object' && options.includePractice === true);
}

// A Firestore document id may not contain '/'. Keep letters (Latin and
// Arabic), digits, '-' and '_', and add a short hash so two names that slug
// the same stay apart.
function hashString(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i += 1) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
}
function slug(s) {
    return String(s || '').trim().toLowerCase().replace(/[^0-9a-z؀-ۿ_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'x';
}

/** The fixed document id of one person's practice entry on one course. */
export function practiceParticipantId(courseId, personKey) {
    const key = String(personKey || '').trim();
    return `${PRACTICE_ID_PREFIX}${courseId}_${slug(key)}_${hashString(key.toLowerCase())}`;
}

/**
 * The people on a course who get a practice entry: director, clinical
 * instructor and every assigned facilitator, each once (matched by
 * facilitator id, else by name).
 */
export function practiceRosterFor(course) {
    if (!course || !course.id) return [];
    const assignments = Array.isArray(course.facilitatorAssignments) ? course.facilitatorAssignments : [];
    const firstGroup = (assignments.find((a) => a && a.group) || {}).group || 'Group A';
    const people = [];
    const seen = new Set();
    const add = (name, facilitatorId, role, group, subType) => {
        const cleanName = String(name || '').trim();
        if (!cleanName) return;
        const key = facilitatorId ? `id:${facilitatorId}` : `name:${cleanName.toLowerCase()}`;
        const nameKey = `name:${cleanName.toLowerCase()}`;
        if (seen.has(key) || seen.has(nameKey)) return;
        seen.add(key); seen.add(nameKey);
        people.push({ key: facilitatorId || cleanName, name: cleanName, facilitatorId: facilitatorId || null, role, group: group || firstGroup, imci_sub_type: subType || null });
    };
    assignments.forEach((a) => a && add(a.name, a.facilitatorId, 'facilitator', a.group, a.imci_sub_type));
    add(course.director, course.directorId, 'director', firstGroup, course.director_imci_sub_type);
    add(course.clinical_instructor, course.clinical_instructorId, 'clinical_instructor', firstGroup, course.clinical_instructor_imci_sub_type);
    return people;
}

const firstOf = (list, single) => {
    if (Array.isArray(list) && list.length) return list[0];
    return String(single || '').split(',').map((s) => s.trim()).filter(Boolean)[0] || '';
};

/** The participant document for one practice person. */
export function practiceParticipantDoc(course, person) {
    return {
        id: practiceParticipantId(course.id, person.key),
        courseId: course.id,
        name: person.name,
        group: person.group,
        job_title: 'Facilitator (practice)',
        isPractice: true,
        practiceRole: person.role,
        practiceFacilitatorId: person.facilitatorId,
        ...(person.imci_sub_type ? { imci_sub_type: person.imci_sub_type } : {}),
        state: firstOf(course.states, course.state),
        locality: firstOf(course.localities, course.locality),
        center_name: 'N/A',
        program: 'Course facilitator (practice)',
        facilityId: null,
        phone: '',
        isDeleted: false,
    };
}

/**
 * The practice entries the course still needs: people on the roster with no
 * entry yet. `existingIds` are the ids of the course's participant documents,
 * deleted ones included, so an entry someone deleted is not brought back.
 */
export function missingPracticeParticipants(course, existingIds = []) {
    const have = new Set(existingIds || []);
    return practiceRosterFor(course)
        .map((person) => practiceParticipantDoc(course, person))
        .filter((d) => !have.has(d.id));
}
