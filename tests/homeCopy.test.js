// The main menu's numbers come from slim server copies (functions/homeCopyCore.js).
// They must give exactly the numbers the full lists gave, and only lists that
// changed are sent again.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { computeHomeStats } from '../src/utils/homeStats';

const require = createRequire(import.meta.url);
const { makeHomeCopy, LISTS, pick } = require('../functions/homeCopyCore.js');

const ts = (ms) => ({ toMillis: () => ms });
const Timestamp = { fromMillis: (ms) => ({ ms }) };
const year = new Date().getFullYear();

// Full records, with fields the copy drops (names, phones, signatures...).
const full = {
    courses: [
        { id: 'c1', start_date: `${year}-03-01`, state: 'Kassala', locality: 'Kassala', course_type: 'IMNCI', director: 'Dr A', signature: 'data:...', lastUpdatedAt: ts(1000) },
        { id: 'c2', start_date: `${year}-05-01`, state: 'Sennar', locality: 'Sinja', course_type: 'EENC', lastUpdatedAt: ts(1000) },
        { id: 'c3', start_date: `${year - 1}-05-01`, state: 'Sennar', locality: 'Sinja', course_type: 'IMNCI', lastUpdatedAt: ts(1000) },
        { id: 'c4', start_date: `${year}-06-01`, state: 'Kassala', course_type: 'IMNCI', isDeleted: true, lastUpdatedAt: ts(1000) },
    ],
    participants: [
        { id: 'p1', courseId: 'c1', name: 'Amna', phone: '0912', post_test_score: 80, lastUpdatedAt: ts(1000) },
        { id: 'p2', courseId: 'c1', name: 'Ali', post_test_score: 70, lastUpdatedAt: ts(1000) },
        { id: 'p3', courseId: 'c2', name: 'Sara', post_test_score: 0, lastUpdatedAt: ts(1000) },
        { id: 'p4', courseId: 'c2', isDeleted: 'true', post_test_score: 90, lastUpdatedAt: ts(1000) },
        { id: 'p5', courseId: 'c3', post_test_score: 60, lastUpdatedAt: ts(1000) },
    ],
    sessions: [
        { id: 's1', status: 'complete', sessionDate: `${year}-02-02`, state: 'Kassala', locality: 'Kassala', service: 'IMNCI', facilityId: 'f1', healthWorkerName: 'X', lastUpdatedAt: ts(1000) },
        { id: 's2', status: 'complete', sessionDate: `${year}-02-03`, state: 'Kassala', locality: 'Kassala', service: 'IMNCI', facilityId: 'f1', lastUpdatedAt: ts(1000) },
        { id: 's3', status: 'draft', sessionDate: `${year}-02-03`, state: 'Sennar', locality: 'Sinja', service: 'EENC', facilityName: 'H', lastUpdatedAt: ts(1000) },
        { id: 's4', status: 'complete', date: `${year}-04-03`, state: 'Sennar', locality: 'Sinja', service: 'EENC', facilityName: 'H', lastUpdatedAt: ts(1000) },
    ],
    facilitators: [
        { id: 'f1', name: 'N', phone: '1', currentState: 'Kassala', lastUpdatedAt: ts(1000) },
        { id: 'f2', currentState: 'Sennar', lastUpdatedAt: ts(1000) },
        { id: 'f3', currentState: 'Sennar', isDeleted: true, lastUpdatedAt: ts(1000) },
    ],
};
const plain = (list) => list.map(({ lastUpdatedAt, ...rest }) => rest);
const slimOf = (key) => full[key].map((d) => { const { id, ...data } = d; return pick(LISTS[key].fields)(id, data); });

describe('main menu copy', () => {
    const cases = [
        { level: 'federal' },
        { level: 'federal', unit: 'العلاج المتكامل للاطفال اقل من 5 سنوات' },
        { level: 'federal', unit: 'حديثي الولادة' },
        { level: 'state', states: ['Kassala'] },
        { level: 'locality', localities: ['Sinja'] },
    ];
    it.each(cases)('gives the same numbers as the full lists (%o)', (c) => {
        const fromFull = computeHomeStats({ ...c, courses: plain(full.courses), participants: plain(full.participants), sessions: plain(full.sessions), facilitators: plain(full.facilitators) });
        const fromCopy = computeHomeStats({ ...c, courses: slimOf('courses'), participants: slimOf('participants'), sessions: slimOf('sessions'), facilitators: slimOf('facilitators') });
        expect(fromCopy).toEqual(fromFull);
    });

    it('keeps no names or phones', () => {
        const text = JSON.stringify(Object.keys(LISTS).map(slimOf));
        expect(text).not.toMatch(/Amna|0912|healthWorkerName|signature|director/);
    });

    it('sends only the lists that changed', async () => {
        const data = Object.fromEntries(Object.entries(LISTS).map(([k, def]) => [def.collection, new Map(full[k].map((d) => [d.id, d]))]));
        const docs = (map) => Array.from(map.entries()).map(([id, d]) => ({ id, data: () => d }));
        const store = new Map();
        const storeDoc = (p) => ({ get: async () => ({ exists: store.has(p), data: () => store.get(p) }), collection: (n) => ({ doc: (id) => storeDoc(`${p}/${n}/${id}`) }), path: p });
        const db = {
            collection: (name) => {
                if (name === '_dashboardCopies') return { doc: (id) => storeDoc(id) };
                const map = data[name];
                return {
                    get: async () => ({ size: map.size, docs: docs(map) }),
                    where: (_f, _op, since) => ({ get: async () => { const d = docs(map).filter((x) => x.data().lastUpdatedAt.toMillis() > since.ms); return { size: d.length, docs: d }; } }),
                    count: () => ({ get: async () => ({ data: () => ({ count: map.size }) }) }),
                };
            },
            batch: () => { const ops = []; return { set: (ref, v) => ops.push([ref.path, v]), delete: () => {}, commit: async () => ops.forEach(([p, v]) => store.set(p, v)) }; },
        };
        let clock = 10_000_000;
        const home = makeHomeCopy({ db, Timestamp, now: () => clock });
        const first = await home.answer({});
        expect(first.participants.items).toHaveLength(5);
        const versions = Object.fromEntries(Object.entries(first).map(([k, v]) => [k, v.version]));
        clock += 2 * 60 * 1000;
        data.participants.set('p6', { courseId: 'c1', post_test_score: 75, lastUpdatedAt: ts(clock) });
        const second = await home.answer(versions);
        expect(second.courses).toEqual({ unchanged: true, version: versions.courses });
        expect(second.sessions.unchanged).toBe(true);
        expect(second.participants.items).toHaveLength(6);
    });
});
