import { describe, it, expect } from 'vitest';
import {
    normalizeKey, nameSimilarity, findSimilarNames, buildCanonicalizer, mergeRegistryEntries,
    groupVariants, applyMappingsToRegistry, canonicalOptions, tidyName,
} from '../src/utils/nameRegistry.js';

// The spellings below are the ones actually found in the facility records.

describe('normalizeKey', () => {
    it('ignores case, spacing and punctuation', () => {
        expect(normalizeKey('share')).toBe(normalizeKey('SHARE '));
        expect(normalizeKey(' Share')).toBe(normalizeKey('Share'));
        expect(normalizeKey('Save-the  Children')).toBe('save the children');
    });

    it('treats the usual Arabic letter variants as the same', () => {
        expect(normalizeKey('أحمد')).toBe(normalizeKey('احمد'));
        expect(normalizeKey('منظمة')).toBe(normalizeKey('منظمه'));
        expect(normalizeKey('يونيسيف ')).toBe(normalizeKey('يونيسيف'));
    });
});

describe('nameSimilarity', () => {
    it('catches a misspelling', () => {
        expect(nameSimilarity('Unisef', 'UNICEF')).toBeGreaterThanOrEqual(0.72);
    });

    it('ignores filler words such as "project"', () => {
        expect(nameSimilarity('Share Project', 'SHARE')).toBe(1);
        expect(nameSimilarity('مشروع شير', 'شير')).toBe(1);
    });

    it('treats a name contained in a longer one as very close', () => {
        expect(nameSimilarity('Save the children', 'Save the Children Sudan')).toBeGreaterThanOrEqual(0.9);
    });

    it('keeps unrelated names apart', () => {
        expect(nameSimilarity('UNICEF', 'WHO')).toBeLessThan(0.5);
        expect(nameSimilarity('Model of Care', 'Safe Birth Start')).toBeLessThan(0.5);
    });
});

describe('findSimilarNames', () => {
    it('lists the closest existing names first', () => {
        const matches = findSimilarNames('Unisef', ['WHO', 'UNICEF', 'Save the Children']);
        expect(matches.map((m) => m.name)).toEqual(['UNICEF']);
    });
});

describe('buildCanonicalizer', () => {
    const registry = [{ name: 'UNICEF', aliases: ['يونيسيف', 'Unisef'] }, { name: 'SHARE', aliases: [] }];

    it('maps known spellings to the registry name', () => {
        const c = buildCanonicalizer(registry);
        expect(c('unicef')).toBe('UNICEF');
        expect(c('يونيسيف ')).toBe('UNICEF');
        expect(c('Unisef ')).toBe('UNICEF');
        expect(c(' share')).toBe('SHARE');
    });

    it('groups unregistered spellings that differ only in case or spacing, by the most used', () => {
        const c = buildCanonicalizer([], ['bancare', 'Bancare', 'bancare ', 'Model of Care']);
        expect(c('BANCARE')).toBe('bancare');
        expect(c('Model  of Care')).toBe('Model of Care');
        expect(c('')).toBe('');
    });

    it('gives the distinct standard names for a filter', () => {
        const c = buildCanonicalizer(registry, ['share', 'Share ', 'SHARE ', 'N/A']);
        expect(canonicalOptions(c, ['share', 'Share ', 'unicef', 'N/A'])).toEqual(['SHARE', 'UNICEF']);
    });
});

describe('mergeRegistryEntries', () => {
    it('adds official names from elsewhere without duplicating', () => {
        const merged = mergeRegistryEntries([{ name: 'UNICEF', aliases: ['unisef'] }], ['unicef ', 'WHO']);
        expect(merged.map((e) => e.name)).toEqual(['UNICEF', 'WHO']);
    });
});

describe('groupVariants', () => {
    it('groups the spellings of one name and suggests the most used', () => {
        const groups = groupVariants([
            { value: 'share', count: 28 }, { value: 'Share', count: 3 }, { value: 'SHARE ', count: 1 },
            { value: 'unicef', count: 17 }, { value: 'UNICEF', count: 5 }, { value: 'Unisef ', count: 1 },
            { value: 'WHO', count: 1 },
        ]);
        expect(groups).toHaveLength(3);
        expect(groups[0]).toMatchObject({ suggested: 'share', fromRegistry: false });
        expect(groups[0].variants).toHaveLength(3);
        expect(groups[1].variants.map((v) => v.value)).toEqual(['unicef', 'UNICEF', 'Unisef ']);
    });

    it('suggests the capitalised spelling on a tie', () => {
        const groups = groupVariants([{ value: 'model of care', count: 1 }, { value: 'Model of Care', count: 1 }]);
        expect(groups[0].suggested).toBe('Model of Care');
    });

    it('prefers the registry name and joins aliases from another script', () => {
        const groups = groupVariants(
            [{ value: 'unicef', count: 17 }, { value: 'يونيسيف ', count: 1 }],
            [{ name: 'UNICEF', aliases: ['يونيسيف'] }],
        );
        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({ suggested: 'UNICEF', fromRegistry: true });
    });
});

describe('applyMappingsToRegistry', () => {
    it('records each standard name with the spellings mapped to it', () => {
        const result = applyMappingsToRegistry([], [
            { from: 'share', to: 'SHARE' }, { from: 'Share ', to: 'SHARE' }, { from: 'بانكير', to: 'Bancare' },
        ]);
        expect(result).toEqual([
            { name: 'Bancare', aliases: ['بانكير'] },
            { name: 'SHARE', aliases: [] },
        ]);
    });

    it('folds a renamed registry name, and its aliases, into the new name', () => {
        const result = applyMappingsToRegistry(
            [{ name: 'Unicef', aliases: ['يونيسيف'] }],
            [{ from: 'Unicef', to: 'UNICEF' }],
        );
        expect(result).toEqual([{ name: 'UNICEF', aliases: ['يونيسيف'] }]);
    });

    it('tidies spacing but keeps spelling', () => {
        expect(tidyName('  Save   the Children ')).toBe('Save the Children');
    });
});

import { planStandardization, activeEntries } from '../src/utils/nameRegistry.js';

describe('planStandardization', () => {
    const entries = [
        { name: 'UNICEF', aliases: ['unicef', 'Unisef'] },
        { name: 'Share', aliases: [] },
        { name: 'SHARE Project', aliases: [] },
        { name: 'Old Partner', aliases: ['old partner '] },
    ];
    const values = ['unicef', 'Unisef', 'Share', 'SHARE Project', 'Old Partner', 'old partner ', 'يونيسيف', 'bancare', 'بانكير', 'typo xx'];

    it('changes nothing unless a choice says so', () => {
        const { rewrites } = planStandardization({ entries, values });
        // Only spellings already listed as aliases are standardized.
        expect(rewrites).toEqual([
            { from: 'unicef', to: 'UNICEF' },
            { from: 'Unisef', to: 'UNICEF' },
            { from: 'old partner ', to: 'Old Partner' },
        ]);
    });

    it('renames an official name and its records', () => {
        const { entries: out, rewrites } = planStandardization({ entries, values, officialActions: { Share: { type: 'rename', to: 'SHARE' } } });
        // "Share" differs from "SHARE" only in capitals, so it needs no stored variant.
        expect(out.find((e) => e.name === 'SHARE')).toBeTruthy();
        expect(out.map((e) => e.name)).not.toContain('Share');
        expect(rewrites).toContainEqual({ from: 'Share', to: 'SHARE' });
    });

    it('merges one official name into another', () => {
        const { entries: out, rewrites } = planStandardization({ entries, values, officialActions: { 'SHARE Project': { type: 'merge', to: 'Share' } } });
        expect(out.map((e) => e.name)).not.toContain('SHARE Project');
        expect(out.find((e) => e.name === 'Share').aliases).toContain('SHARE Project');
        expect(rewrites).toContainEqual({ from: 'SHARE Project', to: 'Share' });
    });

    it('a rename onto an existing name is a merge', () => {
        const { entries: out } = planStandardization({ entries, values, officialActions: { 'SHARE Project': { type: 'rename', to: 'share' } } });
        expect(activeEntries(out).map((e) => e.name)).toEqual(['Old Partner', 'Share', 'UNICEF']);
    });

    it('deletes a name: kept as deleted, cleared from the records', () => {
        const { entries: out, rewrites } = planStandardization({ entries, values, officialActions: { 'Old Partner': { type: 'delete' } } });
        expect(out.find((e) => e.name === 'Old Partner').deleted).toBe(true);
        expect(rewrites).toContainEqual({ from: 'Old Partner', to: '' });
        expect(rewrites).toContainEqual({ from: 'old partner ', to: '' });
        // and is not offered again, even from the Partners page
        expect(activeEntries(mergeRegistryEntries(out, ['Old Partner'])).map((e) => e.name)).not.toContain('Old Partner');
    });

    it('maps, adds or clears spellings not yet in the list', () => {
        const { entries: out, rewrites } = planStandardization({
            entries, values,
            spellingActions: {
                'يونيسيف': { type: 'map', to: 'UNICEF' },
                bancare: { type: 'official', to: 'Bancare' },
                'بانكير': { type: 'map', to: 'Bancare' },
                'typo xx': { type: 'clear' },
            },
        });
        expect(out.find((e) => e.name === 'UNICEF').aliases).toContain('يونيسيف');
        expect(out.find((e) => e.name === 'Bancare').aliases).toEqual(['بانكير']);
        expect(rewrites).toEqual(expect.arrayContaining([
            { from: 'يونيسيف', to: 'UNICEF' }, { from: 'bancare', to: 'Bancare' },
            { from: 'بانكير', to: 'Bancare' }, { from: 'typo xx', to: '' },
        ]));
    });

    it('maps a spelling onto a name made official in the same save', () => {
        const { entries: out } = planStandardization({
            entries, values,
            spellingActions: { 'بانكير': { type: 'map', to: 'Bancare' }, bancare: { type: 'official', to: 'Bancare' } },
        });
        expect(out.find((e) => e.name === 'Bancare').aliases).toEqual(['بانكير']);
    });

    it('maps to the new name when the target was renamed in the same save', () => {
        const { rewrites } = planStandardization({
            entries, values,
            officialActions: { Share: { type: 'rename', to: 'SHARE' } },
            spellingActions: { 'typo xx': { type: 'map', to: 'Share' } },
        });
        expect(rewrites).toContainEqual({ from: 'typo xx', to: 'SHARE' });
    });

    it('detaches a spelling from an official name', () => {
        const { rewrites } = planStandardization({ entries, values, removedAliases: { UNICEF: ['Unisef'] } });
        expect(rewrites.find((r) => r.from === 'Unisef')).toBeUndefined();
    });
});
