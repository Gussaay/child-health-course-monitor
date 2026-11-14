import { describe, it, expect } from 'vitest';
import { getSurvey, newAnswers, validateResponse, buildRecord, surveySummary, exportRows } from '../src/components/survey/surveys.js';

const survey = getSurvey('community_midwives_mapping');
const place = { stateKey: 'Gezira', localityKey: 'Al Kamlin' };

describe('Community Midwives Mapping survey', () => {
    it('starts with four empty midwife rows, today\'s date and the user name', () => {
        const a = newAnswers(survey, { user: { displayName: 'Amna' }, now: new Date(2026, 10, 14, 9, 5) });
        expect(a.midwives).toHaveLength(4);
        expect(a.completedBy).toBe('Amna');
        expect(a.surveyDate).toBe('2026-11-14');
        expect(a.surveyTime).toBe('09:05');
    });

    it('needs the state, locality, village and the yes/no answer', () => {
        const codes = validateResponse(survey, { answers: {} }).map((p) => p.id);
        expect(codes).toEqual(expect.arrayContaining(['stateKey', 'localityKey', 'village', 'hasMidwives']));
    });

    it('asks for at least one midwife when the answer is yes, and checks ages', () => {
        const base = { ...place, answers: { village: 'Wad Medani', hasMidwives: true, midwives: [{}, {}] } };
        expect(validateResponse(survey, base).map((p) => p.code)).toContain('people_empty');
        const badAge = { ...base, answers: { ...base.answers, midwives: [{ name: 'Fatima Ali Ahmed Musa', age: '7' }] } };
        expect(validateResponse(survey, badAge).map((p) => p.code)).toContain('age');
        const ok = { ...base, answers: { ...base.answers, midwives: [{ name: 'Fatima Ali Ahmed Musa', age: '42' }, {}] } };
        expect(validateResponse(survey, ok)).toEqual([]);
    });

    it('saves only the filled midwife rows, and none when the answer is no', () => {
        const yes = buildRecord(survey, { ...place, answers: { village: 'A', hasMidwives: true, midwives: [{ name: ' Huda ', age: '30' }, {}, {}] } });
        expect(yes.midwives).toEqual([{ name: 'Huda', age: 30 }]);
        expect(yes.peopleCount).toBe(1);
        expect(yes.surveyId).toBe('community_midwives_mapping');
        const no = buildRecord(survey, { ...place, answers: { village: 'B', hasMidwives: false, midwives: [{ name: 'X', age: '30' }] } });
        expect(no.midwives).toEqual([]);
        expect(Object.values(no)).not.toContain(undefined);
    });

    it('counts villages and midwives, and exports one row per midwife', () => {
        const rows = [
            { ...place, village: 'A', hasMidwives: true, midwives: [{ name: 'H', age: 30 }, { name: 'S', age: 40 }] },
            { ...place, village: 'B', hasMidwives: false, midwives: [] },
        ];
        expect(surveySummary(rows)).toEqual({ villages: 2, withMidwives: 1, withoutMidwives: 1, midwives: 2 });
        const out = exportRows(rows, { isArabic: false, stateName: (k) => k, localityName: (s, l) => l });
        expect(out).toHaveLength(3);
        expect(out[0]['Midwife name']).toBe('H');
        expect(out[2]['Midwives present']).toBe('No');
    });
});

describe('GPS location', () => {
    it('keeps the more precise reading and rounds to 6 decimals', async () => {
        const { toLocation, betterFix } = await import('../src/components/survey/surveys.js');
        const rough = toLocation({ coords: { latitude: 14.40123456, longitude: 33.5199999, accuracy: 120.4 }, timestamp: 0 });
        const fine = toLocation({ coords: { latitude: 14.4012, longitude: 33.52, accuracy: 8.6 }, timestamp: 0 });
        expect(rough).toMatchObject({ lat: 14.401235, lng: 33.52, accuracy: 120 });
        expect(betterFix(rough, fine)).toBe(fine);
        expect(betterFix(fine, rough)).toBe(fine);
        expect(toLocation({ coords: {} })).toBeNull();
    });

    it('saves the location with the record and exports it', () => {
        const loc = { lat: 14.4, lng: 33.5, accuracy: 9, capturedAt: '2026-11-14T10:00:00.000Z' };
        const rec = buildRecord(survey, { ...place, answers: { village: 'A', hasMidwives: false, location: loc } });
        expect(rec.location).toEqual(loc);
        const out = exportRows([rec], { isArabic: false, stateName: (k) => k, localityName: (s, l) => l });
        expect(out[0]).toMatchObject({ Latitude: 14.4, Longitude: 33.5, 'GPS accuracy (m)': 9 });
    });
});
