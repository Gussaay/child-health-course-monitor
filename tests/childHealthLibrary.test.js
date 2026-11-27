import { describe, it, expect } from 'vitest';
import {
    LIBRARY_SERVICES, LIBRARY_CATEGORIES, canManageLibrary, normaliseLink, validateLibraryFile,
    validateLibraryItem, itemsFor, countBy, libraryPath, parseLibraryPath, isDraftItem,
    isDownloadableBook, downloadedFileName, bookExtension, bookMimeType,
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
        // Drafts announce a book still being prepared: no content needed yet,
        // and anyone who asks is emailed when it turns final.
        expect(validateLibraryItem(base).item.status).toBe('final');
        expect(validateLibraryItem({ ...base, status: 'draft' }).item.status).toBe('draft');
        expect(validateLibraryItem({ ...base, status: 'other' }).item.status).toBe('final');
        expect(validateLibraryItem({ ...base, status: 'draft', contentLink: '' }).errors).toEqual({});
        expect(validateLibraryItem({ ...base, status: 'final', contentLink: '' }).errors.content).toBe('content');
        expect(isDraftItem({ status: 'draft' })).toBe(true);
        expect(isDraftItem({ status: 'final' })).toBe(false);
        expect(isDraftItem({})).toBe(false);
        expect(isDraftItem(null)).toBe(false);
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

    it('builds and reads shareable addresses at every level', () => {
        expect(libraryPath()).toBe('/public/library');
        expect(libraryPath({ service: 'Small & Sick Newborn' })).toBe('/public/library/ssnc');
        expect(libraryPath({ service: 'IMNCI', category: 'training' })).toBe('/public/library/imnci/training');
        expect(libraryPath({ itemId: 'abc123' })).toBe('/public/library/item/abc123');
        expect(parseLibraryPath('/public/library')).toEqual({ service: null, category: null, itemId: null });
        expect(parseLibraryPath('/public/library/ssnc/')).toEqual({ service: 'Small & Sick Newborn', category: null, itemId: null });
        expect(parseLibraryPath('/public/library/imnci/operational')).toEqual({ service: 'IMNCI', category: 'operational', itemId: null });
        expect(parseLibraryPath('/public/library/item/abc123')).toEqual({ service: null, category: null, itemId: 'abc123' });
        expect(parseLibraryPath('/public/library/unknown/training')).toEqual({ service: null, category: null, itemId: null });
        expect(parseLibraryPath('/public/projects')).toBeNull();
        ['/public/library/imnci', '/public/library/imnci/training', '/public/library/item/x1'].forEach((path) => {
            expect(parseScannedCode(`https://ch-sudan.web.app${path}`)).toMatchObject({ type: 'app', kind: 'library', public: true });
        });
    });

    it('server preview names match the app (functions/libraryLinkMeta.js)', () => {
        const meta = require('../functions/libraryLinkMeta.js');
        LIBRARY_SERVICES.forEach((sv) => {
            expect(meta.LIBRARY_SERVICES[sv.titleKey]).toBe(sv.title);
            expect(meta.SERVICE_KEYS[sv.key]).toBe(sv.titleKey);
        });
        LIBRARY_CATEGORIES.forEach((c) => expect(meta.LIBRARY_CATEGORIES[c.key]).toBe(c.label));
    });

    it('link preview shows the item name, full description and its photo', () => {
        const { parseLibraryLink, libraryPreview } = require('../functions/libraryLinkMeta.js');
        const site = { name: 'NCHP', image: 'https://x.web.app/og.png' };
        const long = 'A '.repeat(400).trim();
        const item = { name: 'IMNCI Chart Booklet', description: long, imageUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg?alt=media&token=1', service: 'IMNCI', category: 'training' };
        const p = libraryPreview(parseLibraryLink('/public/library/item/abc123'), item, site);
        expect(p).toMatchObject({ title: 'IMNCI Chart Booklet', description: long, image: item.imageUrl, imageSize: null });
        expect(libraryPreview({ itemId: 'x' }, { ...item, imageUrl: '' }, site).image).toBe(site.image);
        expect(libraryPreview({ itemId: 'x' }, null, site).title).toBe('Child Health Library');
        expect(libraryPreview(parseLibraryLink('/public/library/ssnc/training'), null, site).title).toBe('Training - Small & Sick Newborn Care');
        expect(parseLibraryLink('/public/projects')).toBeNull();

        const { withCourseTags } = require('../functions/courseLinkTags.js');
        const html = withCourseTags('<html><head><title>x</title><meta name="description" content="d"></head></html>', { ...p, siteName: 'NCHP', url: 'https://x/public/library/item/abc123' });
        expect(html).toContain('property="og:image" content="https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg?alt=media&amp;token=1"');
        expect(html).not.toContain('og:image:width');
        expect(html).toContain(`property="og:description" content="${long}"`);
    });
});

describe('library downloads', () => {
    const uploaded = { id: 'abcdef123456', name: 'Chart booklet', status: 'final', filePath: 'library/files/1_Chart.pdf', fileName: 'IMNCI Chartbooklet (English).pdf', linkUrl: 'https://example.org/files/Chart.pdf?token=1' };

    it('downloads uploaded files and document links, not pages or drafts', () => {
        expect(isDownloadableBook(uploaded)).toBe(true);
        expect(isDownloadableBook({ ...uploaded, status: 'draft' })).toBe(false);
        expect(isDownloadableBook({ id: 'x', name: 'Guide', linkUrl: 'https://example.org/guide.pdf' })).toBe(true);
        expect(isDownloadableBook({ id: 'x', name: 'Video page', linkUrl: 'https://youtube.com/watch?v=1' })).toBe(false);
        expect(isDownloadableBook({ id: 'x', name: 'Nothing' })).toBe(false);
    });

    it('names the on-device copy stably, from the file name, made safe', () => {
        expect(downloadedFileName(uploaded)).toBe('lib_abcdef12_IMNCI Chartbooklet (English).pdf');
        expect(downloadedFileName(uploaded)).toBe(downloadedFileName(uploaded));
        expect(downloadedFileName({ ...uploaded, id: 'zzzzzzzz9' })).not.toBe(downloadedFileName(uploaded));
        expect(downloadedFileName({ id: 'q1', name: 'A/B: C?', linkUrl: 'https://example.org/x.pdf' })).toBe('lib_q1_x.pdf');
        expect(bookExtension(uploaded)).toBe('pdf');
        expect(bookMimeType(uploaded)).toBe('application/pdf');
        expect(bookMimeType({ id: 'q2', linkUrl: 'https://example.org/page' })).toBe('*/*');
    });
});
