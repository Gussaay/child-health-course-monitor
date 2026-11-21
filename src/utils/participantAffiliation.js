// src/utils/participantAffiliation.js
//
// A course participant usually belongs to a health facility, and saving the
// participant also puts them on that facility's staff list. Some
// participants belong to no facility at all — they come from a programme,
// such as the National Child Health Program. Those records carry `program`
// (the programme name), keep center_name 'N/A' the way Program Management
// records do, and have no facilityId, so nothing is written to any
// facility's staff list for them.

/** The place fields saved for a participant, by where they come from. */
export function participantPlace({ programManaged = false, fromProgram = false, centerName = '', programName = '', facilityId = null } = {}) {
    if (programManaged) return { center_name: 'N/A', facilityId: null, program: null };
    if (fromProgram) return { center_name: 'N/A', facilityId: null, program: String(programName || '').trim() };
    return { center_name: String(centerName || '').trim(), facilityId: facilityId || null, program: null };
}

/** What lists show as the participant's place: the programme when there is one. */
export function participantPlaceLabel(p) {
    if (p?.program) return p.program;
    return p?.center_name || '';
}
