import { describe, it, expect } from 'vitest';
import { buildNumberOf, displayVersionFor, bumpVersion, nextDisplayVersion, versionLabel } from '../src/utils/appVersionLabel';

const map = { 354: '3.3', 360: '3.4' };

describe('app version label', () => {
    it('reads the CI run number from a build version', () => {
        expect(buildNumberOf('36.4.0')).toBe(354);
        expect(buildNumberOf('1.0.2')).toBe(null);
    });

    it('finds the shown version of an APK build', () => {
        expect(displayVersionFor(354, map, '3.2').version).toBe('3.3');
        expect(displayVersionFor(357, map, '3.2').version).toBe('3.3');
        expect(displayVersionFor(361, map, '3.2').version).toBe('3.4');
        expect(displayVersionFor(350, map, '3.2').version).toBe('3.2');
    });

    it('suggests the next number', () => {
        expect(bumpVersion('3.2')).toBe('3.3');
        expect(bumpVersion('3.9')).toBe('3.10');
        expect(nextDisplayVersion(map, '3.2')).toBe('3.5');
        expect(nextDisplayVersion({}, '3.2')).toBe('3.3');
    });

    it('adds the over-the-air counter', () => {
        expect(versionLabel({ apkBuild: 354, runningBuild: 354, map, fallback: '3.2' })).toBe('3.3');
        expect(versionLabel({ apkBuild: 354, runningBuild: 356, map, fallback: '3.2' })).toBe('3.3 (update 2)');
        expect(versionLabel({ apkBuild: null, runningBuild: 362, map, fallback: '3.2' })).toBe('3.4 (update 2)');
        expect(versionLabel({ apkBuild: null, runningBuild: 362, map: {}, fallback: '3.2' })).toBe('3.2');
    });
});
