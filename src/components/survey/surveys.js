// src/components/survey/surveys.js
//
// The surveys of the Survey module, as data. Every survey starts with the
// place (state → locality, the same STATE_LOCALITIES cascade the rest of the
// app uses), then its own questions. Add a survey by appending an object here.
//
// Question kinds:
//   text | number | date | time   one answer
//   yesno                          true / false (null = not answered)
//   location                       a GPS point { lat, lng, accuracy (m), capturedAt }
//   people                         a list of rows (columns: [{ id, label, kind }]),
//                                  shown only when showIf(answers) is true
//
// `default` (optional) gives a new form its starting answer; it receives
// { user, now }.

const pad = (n) => String(n).padStart(2, '0');
export const todayIso = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
export const nowTime = (now = new Date()) => `${pad(now.getHours())}:${pad(now.getMinutes())}`;

export const SURVEYS = [
    {
        id: 'community_midwives_mapping',
        title: 'Community Midwives Mapping',
        titleAr: 'تخريط القابلات المجتمعيات',
        description: 'Which villages have community midwives, with each midwife\'s name and age.',
        descriptionAr: 'القرى التي توجد بها قابلات مجتمعيات، مع اسم وعمر كل قابلة.',
        questions: [
            { id: 'adminUnit', kind: 'text', label: 'Administrative unit', labelAr: 'الوحدة الإدارية' },
            { id: 'village', kind: 'text', label: 'Village', labelAr: 'القرية', required: true },
            { id: 'location', kind: 'location', label: 'Village location (GPS)', labelAr: 'موقع القرية (GPS)' },
            { id: 'hasMidwives', kind: 'yesno', label: 'Are there midwives in the village?', labelAr: 'هل توجد قابلات في القرية؟', required: true },
            {
                id: 'midwives', kind: 'people', minRows: 4,
                label: 'If yes, give each midwife\'s full (four-part) name and age',
                labelAr: 'إذا نعم، اذكر اسم القابلات رباعي والعمر',
                showIf: (a) => a.hasMidwives === true,
                columns: [
                    { id: 'name', kind: 'text', label: 'Full name (four parts)', labelAr: 'الاسم رباعي' },
                    { id: 'age', kind: 'number', label: 'Age', labelAr: 'العمر' },
                ],
            },
            { id: 'completedBy', kind: 'text', label: 'Name of the person completing the form', labelAr: 'اسم مستكمل الاستمارة', default: ({ user }) => user?.displayName || '' },
            { id: 'surveyDate', kind: 'date', label: 'Date', labelAr: 'التاريخ', default: ({ now }) => todayIso(now) },
            { id: 'surveyTime', kind: 'time', label: 'Time', labelAr: 'الزمن', default: ({ now }) => nowTime(now) },
        ],
    },
];

export const getSurvey = (id) => SURVEYS.find((s) => s.id === id) || null;

export const pickText = (obj, isArabic, key = 'label') => (isArabic ? obj?.[`${key}Ar`] || obj?.[key] : obj?.[key]) || '';

/** Answers of a new form: every question's default, nothing else. */
export function newAnswers(survey, { user = null, now = new Date() } = {}) {
    const answers = {};
    for (const q of survey.questions) {
        if (q.kind === 'people') answers[q.id] = Array.from({ length: q.minRows || 1 }, () => ({}));
        else if (q.default) answers[q.id] = q.default({ user, now });
    }
    return answers;
}

const filled = (v) => v !== undefined && v !== null && String(v).trim() !== '';

/** People rows with at least one answer, trimmed, ages as numbers. */
export function cleanPeople(rows = [], columns = []) {
    return rows
        .filter((r) => columns.some((c) => filled(r?.[c.id])))
        .map((r) => Object.fromEntries(columns.map((c) => {
            const v = r?.[c.id];
            if (!filled(v)) return [c.id, null];
            return [c.id, c.kind === 'number' ? Number(v) : String(v).trim()];
        })));
}

/**
 * Checks a form before saving. Returns a list of problems
 * ({ id, code }); empty means it can be saved. Codes: state, locality,
 * required, people_empty, age.
 */
export function validateResponse(survey, form) {
    const problems = [];
    if (!form.stateKey) problems.push({ id: 'stateKey', code: 'state' });
    if (!form.localityKey) problems.push({ id: 'localityKey', code: 'locality' });
    const answers = form.answers || {};
    for (const q of survey.questions) {
        if (q.showIf && !q.showIf(answers)) continue;
        if (q.kind === 'people') {
            const rows = cleanPeople(answers[q.id], q.columns);
            if (rows.length === 0) problems.push({ id: q.id, code: 'people_empty' });
            const ageCol = q.columns.find((c) => c.kind === 'number');
            if (ageCol && rows.some((r) => r[ageCol.id] !== null && (!Number.isFinite(r[ageCol.id]) || r[ageCol.id] < 10 || r[ageCol.id] > 100))) {
                problems.push({ id: q.id, code: 'age' });
            }
            continue;
        }
        if (q.required && (q.kind === 'yesno' ? typeof answers[q.id] !== 'boolean' : !filled(answers[q.id]))) {
            problems.push({ id: q.id, code: 'required' });
        }
    }
    return problems;
}

/** The record saved to Firestore: hidden answers dropped, people lists cleaned. */
export function buildRecord(survey, form) {
    const answers = { ...(form.answers || {}) };
    for (const q of survey.questions) {
        const hidden = q.showIf && !q.showIf(answers);
        if (q.kind === 'people') answers[q.id] = hidden ? [] : cleanPeople(answers[q.id], q.columns);
        else if (hidden) answers[q.id] = null;
        else if (answers[q.id] === undefined) answers[q.id] = null;
    }
    const midwifeCount = Array.isArray(answers.midwives) ? answers.midwives.length : 0;
    return {
        surveyId: survey.id,
        stateKey: form.stateKey || '',
        localityKey: form.localityKey || '',
        ...answers,
        // Flat copies the list, filters and Deleted Items read without knowing the survey.
        peopleCount: midwifeCount,
        date: answers.surveyDate || null,
    };
}

// GPS: a reading this close (metres) is precise enough to stop at once;
// otherwise the best reading within GPS_WAIT_MS is kept.
export const GPS_GOOD_ENOUGH_M = 15;
export const GPS_WAIT_MS = 30000;

/** The saved form of a browser GeolocationPosition. */
export function toLocation(position) {
    const c = position?.coords;
    if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return null;
    return {
        lat: Number(c.latitude.toFixed(6)),
        lng: Number(c.longitude.toFixed(6)),
        accuracy: Number.isFinite(c.accuracy) ? Math.round(c.accuracy) : null,
        altitude: Number.isFinite(c.altitude) ? Math.round(c.altitude) : null,
        capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
    };
}

/** Of two readings, the more precise one (smaller accuracy circle). */
export function betterFix(current, next) {
    if (!next) return current;
    if (!current) return next;
    return (next.accuracy ?? Infinity) < (current.accuracy ?? Infinity) ? next : current;
}

export const mapLink = (loc) => (loc ? `https://www.google.com/maps?q=${loc.lat},${loc.lng}` : '');

/** Totals for the strip above the list. */
export function surveySummary(rows) {
    const withMidwives = rows.filter((r) => r.hasMidwives === true);
    return {
        villages: rows.length,
        withMidwives: withMidwives.length,
        withoutMidwives: rows.filter((r) => r.hasMidwives === false).length,
        midwives: withMidwives.reduce((n, r) => n + (Array.isArray(r.midwives) ? r.midwives.length : 0), 0),
    };
}

/** One row per midwife (villages without midwives get one row with blanks), for Excel. */
export function exportRows(rows, { stateName, localityName, isArabic }) {
    const h = isArabic
        ? { state: 'الولاية', locality: 'المحلية', unit: 'الوحدة الإدارية', village: 'القرية', lat: 'خط العرض', lng: 'خط الطول', acc: 'دقة الموقع (م)', has: 'توجد قابلات', name: 'اسم القابلة', age: 'العمر', by: 'مستكمل الاستمارة', date: 'التاريخ', time: 'الزمن', yes: 'نعم', no: 'لا' }
        : { state: 'State', locality: 'Locality', unit: 'Administrative unit', village: 'Village', lat: 'Latitude', lng: 'Longitude', acc: 'GPS accuracy (m)', has: 'Midwives present', name: 'Midwife name', age: 'Age', by: 'Completed by', date: 'Date', time: 'Time', yes: 'Yes', no: 'No' };
    const out = [];
    for (const r of rows) {
        const base = {
            [h.state]: stateName(r.stateKey), [h.locality]: localityName(r.stateKey, r.localityKey),
            [h.unit]: r.adminUnit || '', [h.village]: r.village || '',
            [h.has]: r.hasMidwives === true ? h.yes : r.hasMidwives === false ? h.no : '',
        };
        const loc = r.location || {};
        const tail = { [h.lat]: loc.lat ?? '', [h.lng]: loc.lng ?? '', [h.acc]: loc.accuracy ?? '', [h.by]: r.completedBy || '', [h.date]: r.surveyDate || '', [h.time]: r.surveyTime || '' };
        const people = Array.isArray(r.midwives) && r.midwives.length ? r.midwives : [null];
        for (const p of people) out.push({ ...base, [h.name]: p?.name || '', [h.age]: p?.age ?? '', ...tail });
    }
    return out;
}
