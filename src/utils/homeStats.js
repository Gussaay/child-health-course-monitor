// Numbers on the main menu's greeting card.
//
// They follow the person's programme level (federal, state, locality) and,
// for federal and state unit members, their unit: the IMNCI unit sees IMNCI
// work only, the newborn unit sees newborn courses only, everyone else sees
// all of it. Each number is for the current year.

const isLive = (x) => x && x.isDeleted !== true && x.isDeleted !== 'true';

// Unit names as stored on programme team members (ProgramTeamView).
const UNIT_FOCUS = {
    'العلاج المتكامل للاطفال اقل من 5 سنوات': { label: 'IMNCI', courseTypes: ['IMNCI'], services: /^IMNCI/ },
    'حديثي الولادة': { label: 'Newborn', courseTypes: ['EENC', 'Small & Sick Newborn', 'SSNC', 'EmONC'], services: /^(EENC|SSNC|EmONC)/ },
};

export function unitFocus(unit) {
    return UNIT_FOCUS[String(unit || '').trim()] || null;
}

export function levelFromPermissions(permissions = {}) {
    if (permissions.manageLocation === 'user_locality') return 'locality';
    if (permissions.manageLocation === 'user_state') return 'state';
    return 'federal';
}

const yearOf = (value) => {
    if (!value) return null;
    const d = value?.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.getFullYear();
};

/**
 * Returns the card's numbers, or null for any number whose data has not
 * loaded yet (the card shows a placeholder for those).
 */
export function computeHomeStats({ level, unit, states = [], localities = [], courses, participants, sessions, facilitators, year = new Date().getFullYear() }) {
    const focus = unitFocus(unit);
    const stateSet = new Set((states || []).filter(Boolean));
    const localitySet = new Set((localities || []).filter(Boolean));
    const inPlace = (state, locality) => {
        if (level === 'state') return stateSet.has(state);
        if (level === 'locality') return localitySet.has(locality);
        return true;
    };

    let courseList = null;
    if (courses) {
        courseList = courses.filter((c) => isLive(c)
            && yearOf(c.start_date) === year
            && inPlace(c.state, c.locality)
            && (!focus || focus.courseTypes.includes(c.course_type)));
    }

    let participantCount = null;
    let averageScore = null;
    if (courseList && participants) {
        const ids = new Set(courseList.map((c) => c.id));
        const trained = participants.filter((p) => isLive(p) && ids.has(p.courseId));
        participantCount = trained.length;
        const scores = trained.map((p) => Number(p.post_test_score)).filter((n) => Number.isFinite(n) && n > 0);
        averageScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    }

    let visits = null;
    let facilitiesReached = null;
    if (sessions) {
        const done = sessions.filter((s) => isLive(s)
            && s.status !== 'draft'
            && yearOf(s.sessionDate || s.date) === year
            && inPlace(s.state, s.locality)
            && (!focus || focus.services.test(String(s.service || ''))));
        visits = done.length;
        // Each facility counts once, however many visits it had.
        facilitiesReached = new Set(done
            .map((s) => s.facilityId || (s.facilityName ? `${s.state}|${s.locality}|${s.facilityName}` : null))
            .filter(Boolean)).size;
    }

    let facilitatorCount = null;
    if (facilitators && level !== 'locality') {
        facilitatorCount = facilitators.filter((f) => isLive(f) && (level !== 'state' || stateSet.has(f.currentState))).length;
    }

    return {
        focus: focus?.label || null,
        courses: courseList ? courseList.length : null,
        participants: participantCount,
        averageScore,
        visits,
        facilitiesReached,
        facilitators: facilitatorCount,
        scoresLoaded: !!(courseList && participants),
    };
}

// Service coverage, worked out the same way as the Child Health Services
// dashboard: each service has its own target facilities, and the overall
// figure is the average of the four percentages.
const PHC_TYPES = ['وحدة صحة الاسرة', 'مركز صحة الاسرة'];
const HOSPITAL_TYPES = ['مستشفى', 'مستشفى ريفي'];
const working = (f) => f['هل_المؤسسة_تعمل'] === 'Yes';
const neonatalTarget = (f) => ['CEmONC', 'pediatric'].includes(f.eenc_service_type)
    || f.neonatal_level_of_care?.primary || f.neonatal_level_of_care?.secondary || f.neonatal_level_of_care?.tertiary
    || ['Yes', 'Planned'].includes(f.neonatal_level_primary)
    || ['Yes', 'Planned'].includes(f.neonatal_level_secondary)
    || ['Yes', 'Planned'].includes(f.neonatal_level_tertiary);

const COVERAGE_SERVICES = [
    { key: 'imnci', target: (f) => working(f) && PHC_TYPES.includes(f['نوع_المؤسسةالصحية']), has: (f) => f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes' },
    { key: 'etat', target: (f) => HOSPITAL_TYPES.includes(f['نوع_المؤسسةالصحية']) || f.eenc_service_type === 'pediatric', has: (f) => f.etat_has_service === 'Yes' },
    { key: 'eenc', target: (f) => working(f) && ['BEmONC', 'CEmONC'].includes(f.eenc_service_type), has: (f) => f.eenc_provides_essential_care === 'Yes' },
    { key: 'scnu', target: neonatalTarget, has: (f) => working(f) && (f.neonatal_level_secondary === 'Yes' || !!f.neonatal_level_of_care?.secondary) },
];

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Coverage for the person's place, or null until the facilities have loaded.
 * Returns { overall, services: { imnci, etat, eenc, scnu } }, each service
 * as { n, d, perc }.
 */
export function computeCoverage({ level, states = [], localities = [], facilities }) {
    if (!facilities) return null;
    const stateSet = new Set((states || []).filter(Boolean));
    const localitySet = new Set((localities || []).filter(Boolean));
    const list = facilities.filter((f) => isLive(f)
        && f['الولاية'] !== 'إتحادي'
        && (level !== 'state' || stateSet.has(f['الولاية']))
        && (level !== 'locality' || localitySet.has(f['المحلية'])));

    const services = {};
    COVERAGE_SERVICES.forEach(({ key, target, has }) => {
        const targets = list.filter(target);
        const n = targets.filter(has).length;
        services[key] = { n, d: targets.length, perc: targets.length ? round1((n / targets.length) * 100) : 0 };
    });
    const overall = round1(COVERAGE_SERVICES.reduce((sum, { key }) => sum + services[key].perc, 0) / COVERAGE_SERVICES.length);
    return { overall, services };
}
