// src/utils/recycleBin.js
//
// Every record type the app soft-deletes (isDeleted: true), in one list. Each
// page shows its own types in a "Deleted Items" tab (DeletedItemsPanel), where
// a federal manager can remove them for good.
//
//   collection  the Firestore collection
//   cacheKey    the DataContext cache that mirrors it, if any. A permanent
//               delete removes the record from that cache by id only; the
//               delta sync cannot see a document that no longer exists.
//   children    records that belong to this one and go with it. `field` is
//               the field on the child that points at the parent.
//
// Online course content is not here: its own bin in Online Courses already
// deletes it for good, together with the pictures in Storage, and knows which
// pictures other sections still share.

export const RECYCLE_BIN_TYPES = [
    {
        collection: 'courses', cacheKey: 'courses', label: 'Courses', group: 'Courses',
        children: [
            { collection: 'participants', field: 'courseId', cacheKey: 'participants' },
            { collection: 'observations', field: 'courseId' },
            { collection: 'cases', field: 'courseId' },
            { collection: 'finalReports', field: 'courseId', cacheKey: 'finalReports' },
            { collection: 'participantTests', field: 'courseId', cacheKey: 'participantTests' },
        ],
    },
    {
        collection: 'participants', cacheKey: 'participants', label: 'Participants', group: 'Courses',
        children: [
            { collection: 'observations', field: 'participant_id' },
            { collection: 'cases', field: 'participant_id' },
            { collection: 'participantTests', field: 'participantId', cacheKey: 'participantTests' },
        ],
    },
    { collection: 'participantTests', cacheKey: 'participantTests', label: 'Participant tests', group: 'Courses' },
    {
        collection: 'cases', label: 'Monitoring cases', group: 'Courses',
        children: [{ collection: 'observations', field: 'caseId' }],
    },
    { collection: 'observations', label: 'Monitoring observations', group: 'Courses' },
    { collection: 'finalReports', cacheKey: 'finalReports', label: 'Final reports', group: 'Courses' },

    { collection: 'facilitators', cacheKey: 'facilitators', label: 'Facilitators', group: 'Human resources' },
    { collection: 'federalCoordinators', cacheKey: 'federalCoordinators', label: 'Federal coordinators', group: 'Human resources' },
    { collection: 'stateCoordinators', cacheKey: 'stateCoordinators', label: 'State coordinators', group: 'Human resources' },
    { collection: 'localityCoordinators', cacheKey: 'localityCoordinators', label: 'Locality coordinators', group: 'Human resources' },
    { collection: 'coordinators', label: 'Coordinators (old list)', group: 'Human resources' },
    { collection: 'funders', cacheKey: 'funders', label: 'Partners / funders', group: 'Human resources' },

    { collection: 'skillMentorship', cacheKey: 'skillMentorshipSubmissions', label: 'Mentorship visits', group: 'Mentorship' },
    { collection: 'imnciVisitReports', cacheKey: 'imnciVisitReports', label: 'IMNCI visit reports', group: 'Mentorship' },
    { collection: 'eencVisitReports', cacheKey: 'eencVisitReports', label: 'EENC visit reports', group: 'Mentorship' },
    { collection: 'imnciPatientRecords', cacheKey: 'imnciPatientRecords', label: 'IMNCI patient records', group: 'Mentorship' },
    { collection: 'supervisionAssessments', cacheKey: 'supervisionAssessments', label: 'Supervision assessments', group: 'Mentorship' },

    { collection: 'projects', cacheKey: 'projects', label: 'Projects', group: 'Planning' },
    { collection: 'masterPlans', cacheKey: 'masterPlans', label: 'Master plans', group: 'Planning' },
    { collection: 'operationalPlans', cacheKey: 'operationalPlans', label: 'Operational plans', group: 'Planning' },
    { collection: 'unitMeetings', cacheKey: 'unitMeetings', label: 'Meetings', group: 'Planning' },
    { collection: 'populationTargets', cacheKey: 'populationTargets', label: 'Population targets', group: 'Planning' },
    { collection: 'supplyItems', cacheKey: 'supplyItems', label: 'Supply items', group: 'Planning' },

    { collection: 'exerciseAttempts', label: 'Exercise attempts', group: 'Online training' },
    { collection: 'exerciseDefinitions', label: 'Exercise definitions', group: 'Online training' },
];

export const recycleBinType = (collection) => RECYCLE_BIN_TYPES.find((t) => t.collection === collection) || null;

const firstText = (...values) => values.find((v) => typeof v === 'string' && v.trim())?.trim() || '';

/** A one-line name for a deleted record of any type. */
export function recordTitle(item) {
    if (!item) return '';
    return firstText(
        item.name, item.title, item.participantName, item.participant_name, item.facilityName,
        item.facility_name, item['اسم_المؤسسة'], item.healthWorkerName, item.health_worker_name,
        item.item_name, item.itemName, item.meetingTitle, item.subject, item.projectName,
        item.course_type && [item.course_type, item.state, item.locality].filter(Boolean).join(' - '),
    ) || item.id || '';
}

/** A short second line: where and when, from whichever fields the record has. */
export function recordSubtitle(item) {
    if (!item) return '';
    const place = [item.state || item['الولاية'], item.locality || item['المحلية']].filter(Boolean).join(' / ');
    const when = firstText(item.date, item.visitDate, item.visit_date, item.sessionDate, item.start_date, item.meetingDate);
    const phone = firstText(item.phone);
    return [phone, place, when].filter(Boolean).join(' · ');
}

/**
 * Merge per-cache id lists, dropping duplicates. Used to collect what a
 * permanent delete removed so each cache is trimmed once.
 * @param {...Object<string, string[]>} maps
 */
export function mergeRemovals(...maps) {
    const out = {};
    for (const map of maps) {
        for (const [key, ids] of Object.entries(map || {})) {
            out[key] = Array.from(new Set([...(out[key] || []), ...(ids || [])]));
        }
    }
    return out;
}
