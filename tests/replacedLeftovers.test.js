import { describe, it, expect } from 'vitest';
import { dropReplacedLeftovers } from '../src/utils/replacedLeftovers';

const ts = (ms) => ({ toMillis: () => ms });
const OLD = Date.UTC(2026, 10, 18, 5, 16);
const NEW = Date.UTC(2026, 10, 18, 11, 18);
const B = 'imnci-sudan-classic';

describe('old modules left on a device by an upload replace', () => {
    const items = [
        { id: 'm1old', kind: 'module', courseId: 'c', importBatch: B, order: 1, createdAt: ts(OLD) },
        { id: 's1old', kind: 'section', courseId: 'c', importBatch: B, moduleId: 'm1old', createdAt: ts(OLD) },
        { id: 'm1new', kind: 'module', courseId: 'c', importBatch: B, order: 1, createdAt: ts(NEW) },
        { id: 's1new', kind: 'section', courseId: 'c', importBatch: B, moduleId: 'm1new', createdAt: ts(NEW) },
        { id: 'm2', kind: 'module', courseId: 'c', importBatch: B, order: 2, createdAt: ts(NEW) },
        // added in the app inside the old module: kept (the replace moves it)
        { id: 'sApp', kind: 'section', courseId: 'c', moduleId: 'm1old', createdAt: ts(OLD + 1000) },
        // another course with the same module number: untouched
        { id: 'x1', kind: 'module', courseId: 'other', importBatch: 'b2', order: 1, createdAt: ts(OLD) },
    ];

    it('drops the older copy of a module and its lessons, keeps everything else', () => {
        expect(dropReplacedLeftovers(items).map((i) => i.id)).toEqual(['m1new', 's1new', 'm2', 'sApp', 'x1']);
    });

    it('leaves a list without replaced modules as it is', () => {
        const clean = items.filter((i) => !i.id.endsWith('old'));
        expect(dropReplacedLeftovers(clean)).toBe(clean);
    });

    it('does not treat modules written together as copies', () => {
        const same = [
            { id: 'a', kind: 'module', courseId: 'c', importBatch: B, order: 1, createdAt: ts(NEW) },
            { id: 'b', kind: 'module', courseId: 'c', importBatch: B, order: 1, createdAt: ts(NEW + 60000) },
        ];
        expect(dropReplacedLeftovers(same)).toHaveLength(2);
    });
});
