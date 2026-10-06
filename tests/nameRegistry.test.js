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
