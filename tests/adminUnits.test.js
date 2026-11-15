import { describe, it, expect } from 'vitest';
import { ADMIN_UNITS, adminUnitsFor, adminUnitLabel } from '../src/components/adminUnits.js';
import { STATE_LOCALITIES } from '../src/components/constants.js';
import { readPresetPlace, surveyShareUrl } from '../src/components/survey/surveys.js';

describe('Administrative units', () => {
    it('hangs every unit under a real state and locality', () => {
        for (const [state, locs] of Object.entries(ADMIN_UNITS)) {
            expect(STATE_LOCALITIES[state], state).toBeTruthy();
            for (const [loc, units] of Object.entries(locs)) {
                expect(STATE_LOCALITIES[state].localities.some((l) => l.en === loc), `${state} / ${loc}`).toBe(true);
                expect(units.length).toBeGreaterThan(0);
                for (const u of units) { expect(u.ar.trim()).toBe(u.ar); expect(u.en).toBeTruthy(); }
                expect(new Set(units.map((u) => u.ar)).size).toBe(units.length);
            }
        }
    });

    it('lists a locality\'s units and labels a stored value in either language', () => {
        const units = adminUnitsFor('Gezira', 'Al Kamlin');
        expect(units.map((u) => u.ar)).toContain('الكاملين');
        expect(adminUnitsFor('Kassala', 'x')).toEqual([]);
        const u = units[0];
        expect(adminUnitLabel('Gezira', 'Al Kamlin', u.ar, true)).toBe(u.ar);
        expect(adminUnitLabel('Gezira', 'Al Kamlin', u.ar, false)).toBe(u.en);
        expect(adminUnitLabel('Gezira', 'Al Kamlin', 'typed by hand', false)).toBe('typed by hand');
    });

    it('lets a share link fix the administrative unit too', () => {
        const unit = adminUnitsFor('Gezira', 'Al Kamlin')[0].ar;
        const url = surveyShareUrl('https://x.app/s', { stateKey: 'Gezira', localityKey: 'Al Kamlin', adminUnit: unit });
        expect(readPresetPlace(new URL(url).search, STATE_LOCALITIES, ADMIN_UNITS)).toEqual({ stateKey: 'Gezira', localityKey: 'Al Kamlin', adminUnit: unit });
        expect(readPresetPlace('?state=Gezira&locality=Al%20Kamlin&unit=nowhere', STATE_LOCALITIES, ADMIN_UNITS).adminUnit).toBe('');
    });
});
