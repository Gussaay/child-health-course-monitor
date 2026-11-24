// The public mentorship dashboard link is served an anonymous copy of the
// visits and visit reports (functions/publicMentorshipCopyCore.js). Nothing
// that names or reaches a person may be in it.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { slimPublic, anonCode, COLLECTIONS, makePublicMentorshipCopy } = require('../functions/publicMentorshipCopyCore.js');

const ts = (ms) => ({ toMillis: () => ms });

const visit = {
    healthWorkerName: 'Amna Ali', facilityId: 'f1', facilityName: 'Bahri PHC', state: 'Khartoum', locality: 'Bahri',
    mentorEmail: 'mentor@example.org', mentorName: 'Dr Mentor', motherName: 'Fatima', mother_name: 'Fatima', mentorDisplay: 'Dr M',
    phone: '0912', healthWorkerPhone: '0913', notes: 'free text', general_notes: 'x', comments: 'y', signatureUrl: 'sig',
    createdByUid: 'u1', createdByEmail: 'a@b', edited_by_name: 'E', updatedBy: 'U', supervisorName: 'S',
    workerType: 'Nurse', visitNumber: 2, scores: { overall: 80 }, skill_iv_fluid: 'yes', serviceType: 'IMNCI',
    effectiveDate: ts(1700000000500), lastUpdatedAt: ts(1700000001000),
    challenges_table: [
        { id: 1, problem: 'نقص الأدوية', solution: 'طلب من المخزن', responsible_person: 'Mr X', status: 'In Progress' },
        { id: 2, problem: '   ', status: 'Pending' },
    ],
    cases: [{ age: 3, notes: 'case note', classification: 'pneumonia' }],
};

describe('public mentorship copy', () => {
    const out = slimPublic('v1', visit);
    const text = JSON.stringify(out);

    it('keeps no names, emails, phones, notes, signatures or problem text', () => {
        ['Amna Ali', 'mentor@example.org', 'Dr Mentor', 'Fatima', '0912', '0913', 'free text', 'sig', 'u1', 'a@b', 'Mr X', 'طلب من المخزن', 'نقص الأدوية', 'case note', 'Dr M', 'Supervisor'].forEach((s) => {
            expect(text).not.toContain(s);
        });
        expect(out.supervisorName).toBeUndefined();
        expect(out.cases[0]).toEqual({ age: 3, classification: 'pneumonia' });
    });

    it('keeps what the dashboard counts', () => {
        expect(out).toMatchObject({ id: 'v1', facilityId: 'f1', facilityName: 'Bahri PHC', workerType: 'Nurse', visitNumber: 2, scores: { overall: 80 }, skill_iv_fluid: 'yes', serviceType: 'IMNCI' });
        expect(out.effectiveDate).toEqual({ seconds: 1700000000, nanoseconds: 500000000 });
        expect(out.lastUpdatedAt).toBe(1700000001000);
    });

    it('turns the health worker into a stable anonymous code', () => {
        expect(out.healthWorkerName).toBe(anonCode('f1', 'Amna Ali'));
        expect(out.healthWorkerName).toMatch(/^HW-[0-9a-f]{10}$/);
        expect(anonCode('f1', ' amna ali ')).toBe(anonCode('f1', 'Amna Ali'));
        expect(anonCode('f2', 'Amna Ali')).not.toBe(anonCode('f1', 'Amna Ali'));
    });

    it('sends each problem as category and status only', () => {
        expect(out.challenges_table).toEqual([{ id: 1, category: 'medicines_supplies', status: 'In Progress' }]);
    });

    it('covers the visits and both kinds of visit report', () => {
        expect(Object.values(COLLECTIONS).sort()).toEqual(['eencVisitReports', 'imnciVisitReports', 'skillMentorship']);
    });

    it('sends the visits with only the facilities they name, never the whole list', async () => {
        const data = {
            skillMentorship: new Map([['s1', { ...visit, lastUpdatedAt: ts(1000) }], ['s2', { facilityId: 'f9', healthWorkerName: 'B', isDeleted: true, lastUpdatedAt: ts(1000) }]]),
            imnciVisitReports: new Map([['r1', { facilityId: 'f2', challenges_table: [], lastUpdatedAt: ts(1000) }]]),
            eencVisitReports: new Map(),
            healthFacilities: new Map([
                ['f1', { 'اسم_المؤسسة': 'Bahri PHC', 'الولاية': 'Khartoum', imnci_staff: [{ name: 'Amna Ali', phone: '0912' }], lastSnapshotAt: ts(1000) }],
                ['f2', { 'اسم_المؤسسة': 'Sinja H', lastSnapshotAt: ts(1000) }],
                ['f3', { 'اسم_المؤسسة': 'Not visited', lastSnapshotAt: ts(1000) }],
                ['f9', { 'اسم_المؤسسة': 'Only a deleted visit', lastSnapshotAt: ts(1000) }],
            ]),
        };
        const markOf = (d) => (d.lastUpdatedAt || d.lastSnapshotAt).toMillis();
        const docs = (map) => Array.from(map.entries()).map(([id, d]) => ({ id, data: () => d }));
        const store = new Map();
        const storeDoc = (p) => ({ get: async () => ({ exists: store.has(p), data: () => store.get(p) }), collection: (n) => ({ doc: (id) => storeDoc(`${p}/${n}/${id}`) }), path: p });
        const db = {
            collection: (name) => {
                if (name === '_dashboardCopies') return { doc: (id) => storeDoc(id) };
                const map = data[name];
                return {
                    get: async () => ({ size: map.size, docs: docs(map) }),
                    where: (_f, _op, since) => ({ get: async () => { const d = docs(map).filter((x) => markOf(x.data()) > since.ms); return { size: d.length, docs: d }; } }),
                    count: () => ({ get: async () => ({ data: () => ({ count: map.size }) }) }),
                };
            },
            batch: () => { const ops = []; return { set: (ref, v) => ops.push([ref.path, v]), delete: () => {}, commit: async () => ops.forEach(([p, v]) => store.set(p, v)) }; },
        };
        const copy = makePublicMentorshipCopy({ db, Timestamp: { fromMillis: (ms) => ({ ms }) }, now: () => 10_000_000 });
        const res = await copy.answer({});
        expect(res.submissions.items.map((r) => r.id)).toEqual(['s1']);
        expect(res.imnci.items.map((r) => r.id)).toEqual(['r1']);
        expect(res.facilities.items.map((f) => f.id).sort()).toEqual(['f1', 'f2']);
        expect(JSON.stringify(res)).not.toMatch(/Amna Ali|0912|imnci_staff/);
    });
});
