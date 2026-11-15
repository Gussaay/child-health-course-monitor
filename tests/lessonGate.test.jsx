import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import '../src/i18n';

vi.mock('../src/components/imnci/onlineCourses/lazyParts', () => ({ SectionAiPanel: () => null }));
vi.mock('../src/components/imnci/onlineCourses/SectionTabEditor', () => ({ SectionTabEditor: () => null }));

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

        for (const b of [...host.querySelectorAll('button')].filter((x) => x.textContent.includes('Show the answer'))) await click(b);
        expect(saved.at(-1)[0]).toBe('s1');
        expect(saved.at(-1)[1]).toHaveLength(2);
        expect(host.textContent).toContain('Every activity in this lesson is done');
        await click(button(host, 'Complete & continue'));
        expect(completed).toEqual(['s1']);
        expect(went.at(-1)).toMatchObject({ section: 's2' });
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
});
