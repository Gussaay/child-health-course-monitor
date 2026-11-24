import { describe, it, expect } from 'vitest';
import {
    LIBRARY_SERVICES, LIBRARY_CATEGORIES, canManageLibrary, normaliseLink, validateLibraryFile,
    validateLibraryItem, itemsFor, countBy,
} from '../src/components/library/libraryModel';
import { parseScannedCode, isPublicAppPath } from '../src/utils/appLinks';

const base = { service: 'IMNCI', category: 'training', name: 'IMNCI chart booklet', description: 'National chart booklet', imageMode: 'upload', contentMode: 'link', contentLink: 'example.org/book.pdf' };

describe('child health library', () => {
    it('has the three sections under every service', () => {
        expect(LIBRARY_CATEGORIES.map(c => c.key)).toEqual(['training', 'guidelines', 'operational']);
        expect(LIBRARY_SERVICES.map(s => s.key)).toContain('IMNCI');
    });

    it('only federal managers and super users manage content', () => {
        expect(canManageLibrary({ canUseFederalManagerAdvancedFeatures: true })).toBe(true);
        expect(canManageLibrary({ canViewCourse: true })).toBe(false);
        expect(canManageLibrary(null)).toBe(false);
    });

    it('accepts http(s) links only', () => {
        expect(normaliseLink('example.org/a')).toBe('https://example.org/a');
        expect(normaliseLink('http://x.org')).toBe('http://x.org/');
        expect(normaliseLink('javascript:alert(1)')).toBeNull();
        expect(normaliseLink('data:text/html,hi')).toBeNull();
        expect(normaliseLink('not a link')).toBeNull();
        expect(normaliseLink('')).toBe('');
    });

    it('validates the item form', () => {
        expect(validateLibraryItem(base).errors).toEqual({});
        expect(validateLibraryItem(base).item.linkUrl).toBe('https://example.org/book.pdf');
        expect(validateLibraryItem({ ...base, name: ' ' }).errors.name).toBe('name');
        expect(validateLibraryItem({ ...base, contentLink: '' }).errors.content).toBe('content');
        expect(validateLibraryItem({ ...base, contentMode: 'upload', contentLink: '', contentFile: {} }).errors).toEqual({});
        expect(validateLibraryItem({ ...base, imageMode: 'link', imageLink: 'javascript:x' }).errors.image).toBe('image');
        expect(validateLibraryItem({ ...base, category: 'other' }).errors.category).toBe('category');
    });

    it('checks file type and size', () => {
        expect(validateLibraryFile({ type: 'image/png', size: 10 }, 'image')).toBeNull();
        expect(validateLibraryFile({ type: 'application/pdf', size: 10 }, 'image')).toMatch(/photo/);
        expect(validateLibraryFile({ type: 'application/pdf', size: 60 * 1024 * 1024 }, 'file')).toMatch(/too large/);
    });

    it('lists and counts items by service and section', () => {
        const items = [
            { id: 'a', service: 'IMNCI', category: 'training', name: 'Old', createdAt: { seconds: 1 } },
            { id: 'b', service: 'IMNCI', category: 'training', name: 'New book', createdAt: { seconds: 5 } },
            { id: 'c', service: 'ETAT', category: 'guidelines', name: 'ETAT guideline' },
        ];
        expect(itemsFor(items, 'IMNCI', 'training').map(i => i.id)).toEqual(['b', 'a']);
        expect(itemsFor(items, 'IMNCI', 'training', 'book').map(i => i.id)).toEqual(['b']);
        expect(countBy(items, 'service')).toEqual({ IMNCI: 2, ETAT: 1 });
        expect(countBy(items, 'category', 'ETAT')).toEqual({ guidelines: 1 });
    });

    it('is a public page', () => {
        expect(isPublicAppPath('/public/library')).toBe(true);
        expect(parseScannedCode('https://imnci-courses-monitor.web.app/public/library')).toMatchObject({ type: 'app', kind: 'library', public: true });
    });
});
