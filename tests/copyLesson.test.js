import { describe, it, expect } from 'vitest';
import { lessonCopy } from '../src/components/imnci/onlineCourses/CopyLessonModal';

describe('copying a lesson to another module', () => {
    it('keeps the content, drops the identity, and adds it at the end of the chosen module', () => {
        const section = { id: 's1', kind: 'section', courseId: 'c1', moduleId: 'm1', order: 3, title: 'Chest tube', read: [{ type: 'paragraph', text: 'x' }], importBatch: 'b', createdAt: 1 };
        const items = [
            { id: 'x1', kind: 'section', moduleId: 'm9', order: 4 },
            { id: 'x2', kind: 'section', moduleId: 'm9', order: 7, isDeleted: true },
            { id: 'x3', kind: 'section', moduleId: 'm8', order: 9 },
        ];
        const copy = lessonCopy(section, { courseId: 'c2', moduleId: 'm9', items });
        expect(copy).toEqual({ kind: 'section', courseId: 'c2', moduleId: 'm9', order: 5, title: 'Chest tube', read: section.read, copiedFrom: 's1' });
    });
});
