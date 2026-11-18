import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import '../src/i18n';

vi.mock('../src/components/imnci/onlineCourses/lazyParts', () => ({ SectionAiPanel: () => null }));
vi.mock('../src/components/imnci/onlineCourses/SectionTabEditor', () => ({ SectionTabEditor: () => null }));
vi.mock('../src/components/imnci/shared', async (orig) => ({ ...(await orig()), useImnci: () => ({ exercises: [] }) }));

import { SectionPage } from '../src/components/imnci/onlineCourses/SectionPage';
import { CourseScreen } from '../src/components/imnci/onlineCourses/screen';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const lesson = {
    id: 's1', moduleId: 'm1', title: 'Greeting the caregiver',
    read: [
        { type: 'paragraph', text: 'Greet the caregiver.' },
        { type: 'reveal', text: 'Why greet?', answer: 'To build trust.' },
        { type: 'reveal', text: 'What do you ask?', answer: 'The age.' },
    ], see: [], practise: [],
};
const nextLesson = { id: 's2', moduleId: 'm1', title: 'Danger signs', read: [], see: [], practise: [] };

async function open(over = {}) {
    const saved = []; const completed = []; const went = [];
    const screen = {
        back: () => {}, compare: false, duration: (m) => `${m} min`, editingTab: null, fontScale: 1, go: (p) => went.push(p),
        inOrder: true, isAdmin: false, minutesById: {}, modules: [{ id: 'm1' }], openModule: { id: 'm1', title: 'Module 1' },
        openSection: lesson, progress: { completed: {}, activities: {} }, reload: () => {},
        sectionsByModule: { m1: [lesson, nextLesson] }, saveActivities: (id, keys) => saved.push([id, keys]),
        setCompare: () => {}, setEditingTab: () => {}, setScale: () => {}, toggleComplete: async (s) => completed.push(s.id),
        user: { uid: 'u1' }, ...over,
    };
    const host = document.createElement('div');
    document.body.appendChild(host);
    await act(async () => { createRoot(host).render(<CourseScreen.Provider value={screen}><SectionPage /></CourseScreen.Provider>); });
    return { host, saved, completed, went };
}
const click = async (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
// The lesson opens a part at a time: each activity done shows the next.
async function doAll(host) {
    for (let b = button(host, 'Show the answer'); b; b = button(host, 'Show the answer')) await click(b);
}
const button = (host, text) => [...host.querySelectorAll('button')].find((b) => b.textContent.includes(text));

describe('a lesson is completed by doing it', () => {
    beforeEach(() => { localStorage.clear(); document.body.innerHTML = ''; Element.prototype.scrollIntoView = vi.fn(); });

    it('does not complete or move on while an activity is left, then does once all are done', async () => {
        const { host, saved, completed, went } = await open();
        expect(host.textContent).toContain('0 of 2 done');
        expect(button(host, 'Complete & continue')).toBeUndefined();
        await click(button(host, 'Go to the next activity'));
        expect(completed).toEqual([]);
        expect(went).toEqual([]);
        expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

        await doAll(host);
        expect(saved.at(-1)[0]).toBe('s1');
        expect(saved.at(-1)[1]).toHaveLength(2);
        expect(host.textContent).toContain('Every activity in this lesson is done');
        await click(button(host, 'Complete & continue'));
        expect(completed).toEqual(['s1']);
        expect(went.at(-1)).toMatchObject({ section: 's2' });
    });

    it('starts the next lesson fresh even when it repeats an activity of the last one', async () => {
        const twin = { ...lesson, id: 's3', title: 'Same cards again' };
        let screen = null;
        const saved = [];
        const base = {
            back: () => {}, compare: false, duration: (m) => `${m} min`, editingTab: null, fontScale: 1, go: () => {},
            inOrder: true, isAdmin: false, minutesById: {}, modules: [{ id: 'm1' }], openModule: { id: 'm1', title: 'Module 1' },
            progress: { completed: {}, activities: {} }, reload: () => {}, sectionsByModule: { m1: [lesson, twin, nextLesson] },
            saveActivities: (id, keys) => saved.push([id, keys]), setCompare: () => {}, setEditingTab: () => {}, setScale: () => {},
            toggleComplete: async () => {}, user: { uid: 'u1' },
        };
        const host = document.createElement('div');
        document.body.appendChild(host);
        const root = createRoot(host);
        const show = async (s) => { screen = { ...base, openSection: s }; await act(async () => { root.render(<CourseScreen.Provider value={screen}><SectionPage /></CourseScreen.Provider>); }); };
        await show(lesson);
        await doAll(host);
        expect(host.textContent).toContain('Every activity in this lesson is done');
        await show(twin);
        expect(host.textContent).toContain('0 of 2 done');
        await click([...host.querySelectorAll('button')].find((x) => x.textContent.includes('Show the answer')));
        expect(saved.at(-1)[0]).toBe('s3');
        expect(saved.at(-1)[1]).toHaveLength(1);
    });

    it('picks up what the learner did on another device', async () => {
        const { activityKeys } = await import('../src/components/imnci/onlineCourses/activityKeys');
        const keys = activityKeys(lesson.read);
        const { host } = await open({ progress: { completed: {}, activities: { s1: [keys[0]] } } });
        expect(host.textContent).toContain('1 of 2 done');
        expect(host.textContent).toContain('still to do before this lesson is complete: 1');
    });

    it('lets a manager go on, and a course read in any order', async () => {
        expect(button((await open({ isAdmin: true })).host, 'Complete & continue')).toBeDefined();
        expect(button((await open({ inOrder: false })).host, 'Complete & continue')).toBeDefined();
    });

    it('an exercise that is no longer in the app does not hold the lesson closed', async () => {
        const gone = { ...lesson, read: [{ type: 'exercise', exerciseId: 'gone' }] };
        const { host, saved } = await open({ openSection: gone, sectionsByModule: { m1: [gone, nextLesson] } });
        expect(host.textContent).toContain('no longer in Online Exercises');
        expect(saved.at(-1)[1]).toHaveLength(1);
        expect(button(host, 'Complete & continue')).toBeDefined();
    });
});

describe('a locked lesson', () => {
    beforeEach(() => { localStorage.clear(); document.body.innerHTML = ''; });
    it('shows a locked banner instead of the lesson, with the way to the current lesson', async () => {
        const { host, went } = await open({
            openSection: nextLesson, sectionLocked: (secs, i) => i > 0, moduleLocked: () => false,
            nextUp: { moduleId: 'm1', sectionId: 's1' },
        });
        expect(host.querySelector('[data-testid="locked-banner"]')).toBeTruthy();
        expect(host.textContent).toContain('This lesson is locked');
        expect(button(host, 'Complete & continue')).toBeUndefined();
        await click(button(host, 'Go to your current lesson'));
        expect(went.at(-1)).toMatchObject({ section: 's1' });
    });
    it('opens for someone managing the course', async () => {
        const { host } = await open({ openSection: nextLesson, isAdmin: true, sectionLocked: () => true, moduleLocked: () => true });
        expect(host.querySelector('[data-testid="locked-banner"]')).toBeNull();
    });
});

describe('a lesson read a part at a time', () => {
    beforeEach(() => { localStorage.clear(); document.body.innerHTML = ''; Element.prototype.scrollIntoView = vi.fn(); });
    const staged = {
        id: 's9', moduleId: 'm1', title: 'Parts',
        read: [
            { type: 'paragraph', text: 'Before the video.' },
            { type: 'video', url: 'https://youtu.be/abcdefghijk', title: 'Watch' },
            { type: 'paragraph', text: 'After the video.' },
            { type: 'question', text: 'Pick the banana', options: ['Apple', 'Banana', 'Cherry'], answer: 1 },
            { type: 'paragraph', text: 'After the question.' },
        ], see: [], practise: [],
    };
    const at = (over = {}) => open({ openSection: staged, sectionsByModule: { m1: [staged, nextLesson] }, ...over });

    it('opens what follows an activity only once it is done', async () => {
        const { host } = await at();
        expect(host.textContent).toContain('Before the video.');
        expect(host.textContent).not.toContain('After the video.');
        expect(host.querySelector('[data-testid="part-waiting"]')).toBeTruthy();
        // No related videos, and the watched button sits under the player.
        await click(host.querySelector('button[aria-label="Play the video"]'));
        expect(host.querySelector('iframe').src).toContain('youtube-nocookie.com/embed/abcdefghijk');
        expect(host.querySelector('iframe').src).toContain('rel=0');
        await click(host.querySelector('[data-testid="video-watched"]'));
        expect(host.textContent).toContain('After the video.');
        expect(host.textContent).not.toContain('After the question.');
        // A wrong pick turns the whole card red, the right one green.
        const card = () => host.querySelector('[data-result]');
        await click(button(host, 'Apple'));
        expect(card().dataset.result).toBe('wrong');
        expect(card().className).toContain('bg-rose-50');
        await click(button(host, 'Banana'));
        expect(card().dataset.result).toBe('right');
        expect(card().className).toContain('bg-emerald-50');
        expect(host.textContent).toContain('After the question.');
        expect(host.querySelector('[data-testid="lesson-progress"]').textContent).toBe('2/2');
    });

    it('shows the whole lesson to someone managing the course', async () => {
        const { host } = await at({ isAdmin: true });
        expect(host.textContent).toContain('After the question.');
    });

    it('asks to continue in a long stretch of reading, and remembers it', async () => {
        const long = 'This sentence is part of a very long stretch of reading. '.repeat(30);
        const reading = { ...staged, id: 's10', read: [{ type: 'paragraph', text: long }, { type: 'paragraph', text: 'Second part.' }, { type: 'paragraph', text: long }] };
        const { host } = await at({ openSection: reading, sectionsByModule: { m1: [reading, nextLesson] } });
        expect(host.textContent).not.toContain('Second part.');
        await click(host.querySelector('[data-testid="part-continue"] button'));
        expect(host.textContent).toContain('Second part.');
        document.body.innerHTML = '';
        const again = await at({ openSection: reading, sectionsByModule: { m1: [reading, nextLesson] } });
        expect(again.host.textContent).toContain('Second part.');
    });

    it('has no AI helper and keeps its bar fixed to the screen', async () => {
        const { host } = await at();
        expect(host.querySelector('[data-testid="lesson-bar"]').className).toContain('fixed');
    });
});
