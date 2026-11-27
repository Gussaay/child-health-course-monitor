import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import '../src/i18n';
import {
    countryFromTimeZone, filterEvents, groupCount, itemTable, peopleTable, kpis, dailySeries, change,
} from '../src/components/library/libraryStats';

const now = Date.now();
const at = (daysAgo) => ({ seconds: (now - daysAgo * 86400000) / 1000 });
const items = [
    { id: 'i1', name: 'IMNCI chart booklet', service: 'IMNCI', category: 'training' },
    { id: 'i2', name: 'ETAT guideline', service: 'ETAT', category: 'guidelines' },
    { id: 'i3', name: 'Never opened', service: 'IMNCI', category: 'operational' },
];
const ev = (type, extra = {}) => ({ id: Math.random().toString(36), type, at: at(1), deviceId: 'd1', signedIn: false, uid: '', tz: 'Africa/Khartoum', platform: 'Android app', entry: 'app', ...extra });
const events = [
    ev('visit'), ev('visit', { deviceId: 'd2', tz: 'Asia/Riyadh', ref: 'web.whatsapp.com' }),
    ev('open', { itemId: 'i1', itemName: 'IMNCI chart booklet', service: 'IMNCI', category: 'training' }),
    ev('open', { itemId: 'i1', itemName: 'IMNCI chart booklet', service: 'IMNCI', category: 'training' }),
    ev('open', { itemId: 'i1', service: 'IMNCI', category: 'training', deviceId: 'd2', tz: 'Asia/Riyadh', entry: 'link' }),
    ev('open', { itemId: 'i2', itemName: 'ETAT guideline', service: 'ETAT', category: 'guidelines', signedIn: true, uid: 'u1', name: 'Dr Amna', email: 'a@x', role: 'facilitator', state: 'Kassala', locality: 'Aroma' }),
    ev('share', { itemId: 'i2', service: 'ETAT', signedIn: true, uid: 'u1', name: 'Dr Amna', state: 'Kassala' }),
    ev('view', { itemId: 'i1', service: 'IMNCI' }),
    ev('open', { itemId: 'gone', itemName: 'Old book', service: 'IPC', at: at(40) }),
];

describe('library usage statistics', () => {
    it('reads the country from the time zone', () => {
        expect(countryFromTimeZone('Africa/Khartoum')).toBe('Sudan');
        expect(countryFromTimeZone('Pacific/Fiji')).toBe('Other (Fiji)');
        expect(countryFromTimeZone('')).toBe('Unknown');
    });

    it('counts the headline numbers for a period', () => {
        const last30 = filterEvents(events, { from: now - 30 * 86400000 });
        const k = kpis(last30, items);
        expect(k).toMatchObject({
            downloads: 4, uniqueDownloaders: 3, signedInDownloaders: 1, publicDownloaders: 2, shares: 1, visits: 3,
            items: 3, itemsDownloaded: 2, itemsNeverDownloaded: 1, viaSharedLink: 1, states: 1,
        });
        expect(k.conversion).toBe(133);
        expect(change(10, 5)).toBe(100);
        expect(change(3, 0)).toBeNull();
    });

    it('ranks items, people and places', () => {
        const rows = itemTable(events, items);
        expect(rows.map((r) => [r.itemId, r.opens, r.uniqueOpeners])).toEqual([['i1', 3, 2], ['i2', 1, 1], ['gone', 1, 1], ['i3', 0, 0]]);
        expect(rows.find((r) => r.itemId === 'gone')).toMatchObject({ removed: true, name: 'Old book' });
        expect(groupCount(events, (e) => countryFromTimeZone(e.tz))[0]).toEqual({ key: 'Sudan', count: 4, people: 2 });
        const people = peopleTable(events);
        expect(people[0]).toMatchObject({ key: 'd:d1', opens: 3, distinctItems: 2 });
        expect(people.find((p) => p.key === 'u:u1')).toMatchObject({ name: 'Dr Amna', opens: 1, shares: 1, state: 'Kassala' });
        expect(filterEvents(events, { audience: 'signedIn' }).every((e) => e.signedIn)).toBe(true);
        expect(filterEvents(events, { service: 'ETAT' })).toHaveLength(2);
    });

    it('builds a daily trend', () => {
        const { days, series } = dailySeries(events, now - 7 * 86400000, now);
        expect(days.length).toBeGreaterThanOrEqual(7);
        expect(series.open.reduce((a, b) => a + b, 0)).toBe(4);
    });
});

vi.mock('../src/components/library/libraryTracking', () => ({ listLibraryEvents: async () => events, recordLibraryEvent: () => {} }));
vi.mock('react-chartjs-2', () => ({ Bar: () => null, Line: () => null, Doughnut: () => null }));
import LibraryDashboard from '../src/components/library/LibraryDashboard.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('library dashboard page', () => {
    beforeEach(() => { document.body.innerHTML = ''; });
    it('shows the KPIs, each item, who downloads and from where', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        await act(async () => { createRoot(host).render(<LibraryDashboard items={items} onBack={() => {}} />); });
        await act(async () => {});
        const text = host.textContent;
        expect(text).toContain('Unique downloaders');
        expect(text).toContain('IMNCI chart booklet');
        expect(text).toContain('Dr Amna');
        expect(text).toContain('Kassala');
        expect(text).toContain('Saudi Arabia');
        expect(text).toContain('Public visitor');
    });
});
