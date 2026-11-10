// A phone whose clock runs ahead must not lose records added on the server.
// The delta-sync watermark used to be the device clock (Date.now()): a phone a
// day fast asked only for records "newer than tomorrow", so a course added on
// the web never reached it while a fresh browser showed it.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const calls = [];
const live = [];
let serverCourses = [];
vi.mock('./../src/hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../src/data', () => ({
    listAllParticipants: vi.fn(async () => []),
    listFacilitators: vi.fn(async () => []),
    listFunders: vi.fn(async () => []),
    listFederalCoordinators: vi.fn(async () => []),
    listStateCoordinators: vi.fn(async () => []),
    listLocalityCoordinators: vi.fn(async () => []),
    listHealthFacilities: vi.fn(async () => []),
    listMentorshipSessions: vi.fn(async () => []),
    listIMNCIVisitReports: vi.fn(async () => []),
    listEENCVisitReports: vi.fn(async () => []),
    listParticipantTestsForCourse: vi.fn(async () => []),
    listPendingFacilitatorSubmissions: vi.fn(async () => []),
    getFacilitatorApplicationSettings: vi.fn(async () => []),
    listPendingFederalSubmissions: vi.fn(async () => []),
    listPendingCoordinatorSubmissions: vi.fn(async () => []),
    listPendingLocalitySubmissions: vi.fn(async () => []),
    getCoordinatorApplicationSettings: vi.fn(async () => []),
    listProjects: vi.fn(async () => []),
    listMasterPlans: vi.fn(async () => []),
    listOperationalPlans: vi.fn(async () => []),
    listUnitMeetings: vi.fn(async () => []),
    listIMNCIPatientRecords: vi.fn(async () => []),
    listSupplyItems: vi.fn(async () => []),
    listPopulationTargets: vi.fn(async () => []),
    listSupervisionAssessments: vi.fn(async () => []),
    getIMNCIProtocols: vi.fn(async () => []),
    listOnlineCourses: vi.fn(async () => []),
    listOnlineCourseItems: vi.fn(async () => []),
    listFinalReport: vi.fn(async () => []),
    fetchFacilitiesHistoryMultiDate: vi.fn(async () => []),
    listSnapshotsForFacility: vi.fn(async () => []),
    getAboutTeamImages: vi.fn(async () => []),
    LIVE_LIST_KEYS: ['courses'],
    subscribeListDelta: (key, since, onChange, onError) => {
        const sub = { key, since, onChange, onError, open: true };
        live.push(sub);
        return () => { sub.open = false; };
    },
    subscribeFacilityDelta: () => null,
    listAllCourses: async (_opts, lastSync = 0) => {
        calls.push(lastSync);
        return serverCourses.filter((c) => c.lastUpdatedAt.toMillis() > lastSync);
    },
}));

import { DataProvider, useDataCache, newestServerStamp } from '../src/DataContext';

const ts = (ms) => ({ toMillis: () => ms });
const SERVER_NOW = Date.UTC(2026, 10, 1, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

describe('delta sync watermark', () => {
    let host, root, ctx;
    const Probe = () => { ctx = useDataCache(); return null; };
    beforeEach(() => {
        calls.length = 0;
        live.length = 0;
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
        localStorage.clear();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
        host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    });
    afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.restoreAllMocks(); });

    it('reads the newest server stamp', () => {
        expect(newestServerStamp([{ lastUpdatedAt: ts(5) }, { lastUpdatedAt: { seconds: 9, nanoseconds: 0 } }, {}])).toBe(9000);
        expect(newestServerStamp([])).toBe(0);
    });

    it('a phone a day fast still receives a course added on the server later', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(SERVER_NOW + DAY); // the phone's clock
        await act(async () => { root.render(<DataProvider><Probe /></DataProvider>); });

        serverCourses = [{ id: 'sennar', lastUpdatedAt: ts(SERVER_NOW - DAY) }];
        await act(async () => { await ctx.fetchCourses(true); });
        expect(calls.at(-1)).toBe(0); // first sync: full download

        // A course is added on the web an hour later (server time) …
        serverCourses = [...serverCourses, { id: 'gedaref', lastUpdatedAt: ts(SERVER_NOW + 60 * 60 * 1000) }];
        let list;
        await act(async () => { list = await ctx.fetchCourses(true); });
        // … the delta asks from the server's own time, not the phone's tomorrow …
        expect(calls.at(-1)).toBeLessThan(SERVER_NOW);
        // … and the course arrives.
        expect(list.map((c) => c.id).sort()).toEqual(['gedaref', 'sennar']);
    });

    it('a device that synced under the old scheme re-downloads once, then deltas', async () => {
        localStorage.setItem('lastServerFetch_courses', String(SERVER_NOW + DAY)); // old, poisoned watermark
        await act(async () => { root.render(<DataProvider><Probe /></DataProvider>); });
        serverCourses = [{ id: 'gedaref', lastUpdatedAt: ts(SERVER_NOW) }];
        await act(async () => { await ctx.fetchCourses(true); });
        expect(calls.at(-1)).toBe(0);
        await act(async () => { await ctx.fetchCourses(true); });
        expect(calls.at(-1)).toBeGreaterThan(0);
    });

    it('Refresh syncs every loaded list, skips unloaded ones, and throttles automatic syncs', async () => {
        const data = await import('../src/data');
        await act(async () => { root.render(<DataProvider><Probe /></DataProvider>); });
        serverCourses = [{ id: 'a', lastUpdatedAt: ts(SERVER_NOW) }];
        await act(async () => { await ctx.fetchCourses(true); });
        const before = calls.length;
        data.listAllParticipants.mockClear();
        let res;
        await act(async () => { res = await ctx.syncLoaded(); });
        expect(calls.length).toBe(before + 1);              // courses: one delta
        expect(calls.at(-1)).toBeGreaterThan(0);
        expect(data.listAllParticipants).not.toHaveBeenCalled(); // never loaded here
        expect(res.failed).toBe(0);
        await act(async () => { res = await ctx.syncLoaded({ minIntervalMs: 30000 }); });
        expect(res.skipped).toBe(true);                     // automatic sync too soon
    });

    it('keeps a loaded list live: a change on the server arrives without asking, and the listener closes in the background', async () => {
        await act(async () => { root.render(<DataProvider><Probe /></DataProvider>); });
        serverCourses = [{ id: 'sennar', lastUpdatedAt: ts(SERVER_NOW) }];
        await act(async () => { await ctx.fetchCourses(true); });
        const sub = live.find((l) => l.key === 'courses' && l.open);
        expect(sub).toBeTruthy();
        expect(sub.since).toBe(SERVER_NOW - 1000);            // from the server-time mark
        const before = calls.length;
        await act(async () => { sub.onChange({ upserts: [{ id: 'gedaref', lastUpdatedAt: ts(SERVER_NOW + 5000) }], removed: [] }); });
        expect(ctx.courses.map((c) => c.id).sort()).toEqual(['gedaref', 'sennar']);
        expect(calls.length).toBe(before);                     // no query was needed
        expect(Number(localStorage.getItem('syncMark_v2_courses'))).toBe(SERVER_NOW + 5000);
        // A removal (record hard-deleted, or no longer matching) leaves the device too.
        await act(async () => { sub.onChange({ upserts: [], removed: ['sennar'] }); });
        expect(ctx.courses.map((c) => c.id)).toEqual(['gedaref']);
        // Background: closed. Back on screen: reopened from the newest mark.
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
        expect(sub.open).toBe(false);
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
        await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
        const again = live.filter((l) => l.key === 'courses' && l.open);
        expect(again).toHaveLength(1);
        expect(again[0].since).toBe(SERVER_NOW + 5000 - 1000);
        // Quiet syncs skip a live list; a refused listener falls back to them.
        await act(async () => { await ctx.syncLoaded({ skipLive: true }); });
        expect(calls.length).toBe(before);
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await act(async () => { again[0].onError({ code: 'failed-precondition' }); });
        expect(ctx.liveLists()).not.toContain('courses');
        await act(async () => { await ctx.syncLoaded({ skipLive: true }); });
        expect(calls.length).toBe(before + 1);
    });
});
