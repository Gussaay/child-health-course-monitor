import { describe, it, expect } from 'vitest';
import { sectionWithChapters } from '../src/components/imnci/onlineCourses/videoChapters';

describe('marking where the skill starts in a lesson video', () => {
    const video = { type: 'video', url: 'https://www.youtube.com/watch?v=BAX4gB48Ewk', title: 'Keeping the Baby Warm' };
    const section = { id: 's1', title: 'Heat loss', read: [{ type: 'paragraph', text: 'x' }, video], see: [], practise: [] };

    it('adds chapters to that video only, sorted by time, without cutting the video', () => {
        const next = sectionWithChapters(section, video, [{ at: 130.7, label: 'Skin-to-skin' }, { at: 42, label: ' Drying ' }]);
        expect(next.read[1]).toEqual({ ...video, chapters: [{ at: 42, label: 'Drying' }, { at: 131, label: 'Skin-to-skin' }] });
        expect(next.read[1].start).toBeUndefined();
        expect(next.read[0]).toBe(section.read[0]);
    });

    it('removes the chapters when none are left, and says when the video is not in the lesson', () => {
        const withOne = sectionWithChapters(section, video, [{ at: 5, label: 'A' }]);
        const none = sectionWithChapters(withOne, withOne.read[1], []);
        expect(none.read[1].chapters).toBeUndefined();
        expect(sectionWithChapters(section, { type: 'video', url: 'other' }, [])).toBeNull();
    });
});
