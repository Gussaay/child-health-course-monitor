// Monthly usage by user, list, page and source: the counting, the monthly
// document it builds, the ranking the admin screen shows, and the screen.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const store = { docs: [], bill: null, saved: null, listeners: [], google: null, googleError: null };
vi.mock('../src/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
    collection: (_db, name) => ({ name }),
    query: (c) => c,
    where: () => ({}),
    onSnapshot: (_q, next) => {
        const l = { next, open: true };
        store.listeners.push(l);
        next({ docs: store.docs.map((d) => ({ id: d.id, data: () => d })) });
        return () => { l.open = false; };
    },
    getDocs: async () => ({ docs: store.docs.map((d) => ({ id: d.id, data: () => d })) }),
    doc: (_db, col, id) => ({ col, id }),
    getDoc: async () => ({ exists: () => store.bill != null, data: () => ({ actualUsd: store.bill }) }),
    setDoc: async (_ref, data) => { store.saved = data; },
    serverTimestamp: () => 'ts',
}));

vi.mock('firebase/functions', () => ({
    getFunctions: () => ({}),
    httpsCallable: () => async () => { if (store.googleError) throw new Error(store.googleError); return { data: store.google }; },
}));

import {
    recordOperation, setUsageView, setUsageSource, takePending, restorePending, hasPending,
    monthlyPayload, summariseUsage, estimateCost, DEFAULT_PRICES, monthKey, safeKey, resetLedger,
} from '../src/utils/usageLedger';
import UsageCostPanel from '../src/components/UsageCostPanel';
import '../src/i18n';

const inc = (n) => ({ inc: n });

describe('usage ledger', () => {
    beforeEach(() => resetLedger());

    it('counts reads and writes by list, page and source', () => {
        setUsageView('courses');
        recordOperation('read', 40, { collection: 'courses' });
        recordOperation('read', 5, { collection: 'participants', source: 'live' });
        recordOperation('write', 2, { collection: 'courses' });
        setUsageSource('auto-sync');
        recordOperation('read', 7, { collection: 'courses' });
        setUsageSource(null);
        const b = takePending();
        expect(b.reads).toBe(52);
        expect(b.writes).toBe(2);
        expect(b.byCollection.courses).toEqual({ r: 47, w: 2 });
        expect(b.byView.courses).toEqual({ r: 52, w: 2 });
        expect(b.bySource).toEqual({ user: { r: 40, w: 2 }, live: { r: 5, w: 0 }, 'auto-sync': { r: 7, w: 0 } });
        expect(hasPending()).toBe(false);
    });

    it('ignores empty counts and keeps field names safe', () => {
        recordOperation('read', 0, { collection: 'x' });
        expect(hasPending()).toBe(false);
        expect(safeKey('a.b/c d')).toBe('a_b_c_d');
        expect(safeKey('')).toBe('other');
    });

    it('a failed write puts the counts back, nothing is lost', () => {
        recordOperation('read', 10, { collection: 'courses' });
        const b = takePending();
        recordOperation('read', 3, { collection: 'courses' });
        restorePending(b);
        expect(takePending().byCollection.courses.r).toBe(13);
    });

    it('builds the monthly document with increments and the cost of counting', () => {
        setUsageView('participants');
        recordOperation('read', 12, { collection: 'participants' });
        const p = monthlyPayload(takePending(), { inc, stamp: () => 'ts', email: 'a@x.org', month: '2026-11', trackingWrites: 2 });
        expect(p).toMatchObject({ month: '2026-11', email: 'a@x.org', reads: inc(12), writes: inc(0), trackingWrites: inc(2) });
        expect(p.byCollection.participants).toEqual({ r: inc(12) });
        expect(p.byView.participants).toEqual({ r: inc(12) });
        expect(monthKey(new Date(2026, 10, 4))).toBe('2026-11');
    });

    it('adds the documents up and ranks by cost, at Firestore list prices', () => {
        const docs = [
            { id: 'u1_a', email: 'a@x.org', reads: 100000, writes: 0, trackingWrites: 10, byCollection: { courses: { r: 100000 } }, byView: { courses: { r: 100000 } }, bySource: { user: { r: 100000 } } },
            { id: 'u2_b', email: 'b@x.org', reads: 0, writes: 100000, trackingWrites: 4, byCollection: { participants: { w: 100000 } }, byView: { participants: { w: 100000 } }, bySource: { user: { w: 100000 } } },
        ];
        const s = summariseUsage(docs);
        expect(s.totals.reads).toBe(100000);
        expect(s.totals.cost).toBeCloseTo(0.06 + 0.18, 6);
        expect(s.byUser.map((u) => u.name)).toEqual(['b@x.org', 'a@x.org']); // writes cost 3x reads
        expect(s.byCollection[0]).toMatchObject({ name: 'participants', writes: 100000 });
        expect(s.totals.trackingWrites).toBe(14);
        expect(estimateCost(100000, 0, DEFAULT_PRICES)).toBeCloseTo(0.06, 6);
    });
});

describe('usage cost panel', () => {
    let host, root;
    beforeEach(() => {
        store.docs = [
            { id: `${monthKey()}_u1`, month: monthKey(), email: 'mentor@x.org', reads: 250000, writes: 1000, trackingWrites: 20, byCollection: { skillMentorship: { r: 200000 }, courses: { r: 50000, w: 1000 } }, byView: { skillsMentorship: { r: 200000 }, courses: { r: 50000, w: 1000 } }, bySource: { user: { r: 100000, w: 1000 }, live: { r: 150000 } } },
        ];
        store.bill = 8; store.saved = null; store.listeners = []; store.google = null; store.googleError = null;
        host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    });
    afterEach(() => { act(() => root.unmount()); host.remove(); });

    it('shows who, which list, which page and the unexplained part of the bill', async () => {
        await act(async () => { root.render(<UsageCostPanel />); });
        const text = host.textContent;
        expect(text).toContain('mentor@x.org');
        expect(text).toContain('skillMentorship');
        expect(text).toContain('skillsMentorship');
        expect(text).toContain('Live updates (listeners)');
        // 250,000 reads + 1,000 writes at list price = $0.15 + $0.0018: about $0.15
        expect(text).toContain('$0.15');
        // an $8 bill leaves most of it unexplained
        expect(text).toContain('is not explained by the counted reads and writes');
        expect(host.querySelector('input[type=number]').value).toBe('8');
    });

    it('saves the bill typed in for the month', async () => {
        await act(async () => { root.render(<UsageCostPanel />); });
        const input = host.querySelector('input[type=number]');
        await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '9.5');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await act(async () => { [...host.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Save').click(); });
        expect(store.saved.actualUsd).toBe(9.5);
    });

    it('is live for the current month: a device\'s new report appears without pressing anything, and it stops in the background', async () => {
        await act(async () => { root.render(<UsageCostPanel />); });
        expect(host.textContent).toContain('Live');
        const l = store.listeners.find((x) => x.open);
        expect(l).toBeTruthy();
        const more = { id: `${monthKey()}_u2`, month: monthKey(), email: 'new@x.org', reads: 1000, writes: 0, byCollection: { courses: { r: 1000 } }, byView: { courses: { r: 1000 } }, bySource: { user: { r: 1000 } } };
        await act(async () => { l.next({ docs: [...store.docs, more].map((d) => ({ id: d.id, data: () => d })) }); });
        expect(host.textContent).toContain('new@x.org');
        // page goes to the background: the listener closes
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
        expect(l.open).toBe(false);
        expect(host.textContent).toContain('Paused');
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    });

    it('puts Google\'s own counts beside the app\'s, with the share the app saw', async () => {
        store.google = {
            totals: { reads: 500000, writes: 2000, deletes: 10 },
            costAfterFreeQuota: 0.42, costBeforeFreeQuota: 0.31,
            days: [{ date: '2026-11-01', reads: 200000, writes: 1000, deletes: 5 }, { date: '2026-11-02', reads: 300000, writes: 1000, deletes: 5 }],
        };
        await act(async () => { root.render(<UsageCostPanel />); });
        await act(async () => { [...host.querySelectorAll('button')].find((b) => b.textContent.includes('Compare with Google')).click(); });
        const text = host.textContent;
        expect(text).toContain('500,000');
        expect(text).toContain('$0.42');
        expect(text).toContain('the app counted 50%');   // 250,000 of 500,000 reads
        expect(text).toContain('2026-11-02');
    });

    it('says why when Google refuses', async () => {
        store.googleError = 'Google refused to share the usage numbers. Give the service account the "Monitoring Viewer" role.';
        await act(async () => { root.render(<UsageCostPanel />); });
        await act(async () => { [...host.querySelectorAll('button')].find((b) => b.textContent.includes('Compare with Google')).click(); });
        expect(host.textContent).toContain('Monitoring Viewer');
    });
});
