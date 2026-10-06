// visitProject.js
//
// Which project a mentorship visit belongs to.
//
// A facility's project changes over time: a facility covered by SHARE this
// year may move to another project next year. A visit belongs to the project
// that covered the facility ON THE VISIT DATE, so it stays with that project
// after the facility moves, and only later visits go to the new one.
//
// Each visit therefore records its project when it is saved. For visits saved
// before that, the facility's history (facilitySnapshots, one per update)
// says which project covered it on the day.

const NONE_VALUES = new Set(['', 'n/a', 'na', 'none', '-']);

/** A project value that means something ("N/A" and blanks do not). */
export const isRealProject = (value) => typeof value === 'string' && !NONE_VALUES.has(value.trim().toLowerCase());

/** The project recorded on a facility record or snapshot, '' when it has none. */
export const projectOfFacility = (record) => {
    if (!record) return '';
    if (record.project_participation === 'No') return '';
    const value = record.project_name || record['المشروع'] || '';
    return isRealProject(value) ? value.trim() : '';
};

const toMillis = (value) => {
    if (!value) return null;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    if (typeof value._seconds === 'number') return value._seconds * 1000;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string') {
        // A bare date means that whole day.
        const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59` : value);
        return Number.isNaN(t) ? null : t;
    }
    if (typeof value === 'number') return value;
    return null;
};

/** When a mentorship session or visit report took place (ms), or null. */
export const visitTimeOf = (record) => {
    if (!record) return null;
    const candidates = [
        record.sessionDate, record.visitDate, record.visit_date, record.date,
        record.effectiveDate, record.fullData?.visitDate, record.fullData?.sessionDate,
        record.createdAt,
    ];
    for (const c of candidates) {
        const t = toMillis(c);
        if (t !== null) return t;
    }
    return null;
};

/**
 * The project covering a facility at `visitTime`.
 *
 * The latest snapshot on or before the visit decides. A visit older than every
 * snapshot takes the earliest one, which is the closest record of how the
 * facility stood then. With no history at all, the facility's current record.
 *
 * @param {object[]} snapshots   the facility's facilitySnapshots
 * @param {object}   facility    the facility's current record
 * @param {number|null} visitTime  ms
 */
export const projectAtTime = (snapshots, facility, visitTime) => {
    const dated = (snapshots || [])
        .map((s) => ({ s, t: toMillis(s.effectiveDate) ?? toMillis(s.date_of_visit) }))
        .filter((x) => x.t !== null)
        .sort((a, b) => a.t - b.t);
    if (dated.length && visitTime !== null && visitTime !== undefined) {
        let chosen = null;
        for (const x of dated) {
            if (x.t <= visitTime) chosen = x; else break;
        }
        return projectOfFacility((chosen || dated[0]).s);
    }
    return projectOfFacility(facility);
};

/** Did this visit record its project (even "none")? */
export const hasRecordedProject = (record) =>
    !!record && (Object.prototype.hasOwnProperty.call(record, 'project')
        || (!!record.fullData && Object.prototype.hasOwnProperty.call(record.fullData, 'project')));

/**
 * The project a visit belongs to: the one it recorded when it was saved,
 * including "no project" ('N/A'), which a later change to the facility does
 * not overwrite. Only a visit that recorded nothing falls back to the
 * facility's current project, until it is given its own.
 */
export const projectOfVisit = (record, facility) => {
    if (hasRecordedProject(record)) {
        const stored = record.project ?? record.fullData?.project;
        return isRealProject(stored) ? stored.trim() : '';
    }
    return projectOfFacility(facility);
};
