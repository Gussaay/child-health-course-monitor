import { describe, it, expect } from 'vitest';
import { youtubeEmbed } from '../src/components/imnci/onlineCourses/blocks.jsx';
import { gradeQuiz } from '../src/components/imnci/exercises.jsx';

describe('video clips', () => {
    it('plays only the part of a YouTube video between start and end', () => {
        const src = youtubeEmbed('tgTZPo6S2gk', { start: 42, end: 89 });
        expect(src).toContain('start=42');
        expect(src).toContain('end=89');
        expect(src).toContain('rel=0');
    });
    it('ignores an end that is not after the start', () => {
        expect(youtubeEmbed('tgTZPo6S2gk', { start: 42, end: 10 })).not.toContain('end=');
    });
    it('grades a video question like any multiple-choice question', () => {
        const q = { id: 'c1a', type: 'mcq', question: 'Lethargic?', options: ['Yes', 'No'], correct: [1],
            video: { url: 'https://youtu.be/HsqdrLpa7To', start: 55, end: 99 } };
        expect(gradeQuiz([q], { c1a: [1] }).percent).toBe(100);
        expect(gradeQuiz([q], { c1a: [0] }).percent).toBe(0);
    });
});
