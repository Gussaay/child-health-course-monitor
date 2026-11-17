import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import '../src/i18n';

// The manager's dashboard loads its report through a Cloud Function; here the
// function answers with a fixed report.
const report = {
    scope: { level: 'all' },
    courses: [{
        id: 'c1', title: 'IMNCI', sections: 3,
        modules: [{ id: 'm1', title: 'Module 1', sections: 2 }, { id: 'm2', title: 'Module 2', sections: 1 }],
        lessons: [
            { id: 'a1', title: 'Greeting', moduleId: 'm1', done: 2, started: 0 },
            { id: 'a2', title: 'Danger signs', moduleId: 'm1', done: 1, started: 1 },
            { id: 'b1', title: 'Cough', moduleId: 'm2', done: 1, started: 0 },
        ],
    }],
    learners: [
        { uid: 'u1', name: 'Amna', email: 'a@x', state: 'Kassala', locality: 'Aroma', perCourse: { c1: 1 }, perModule: { m1: 1 }, startedPerCourse: { c1: 1 }, at: { c1: 'a2' }, lastActive: 1 },
        { uid: 'u2', name: 'Badr', email: 'b@x', state: 'Kassala', locality: 'Aroma', perCourse: { c1: 3 }, perModule: { m1: 2, m2: 1 }, at: {}, lastActive: Date.now() },
        { uid: 'u3', name: 'Hiba', email: 'h@x', state: 'Sennar', locality: 'Sinja', perCourse: {}, at: {}, lastActive: null },
    ],
};
vi.mock('firebase/functions', () => ({ getFunctions: () => ({}), httpsCallable: () => async () => ({ data: report }) }));

import { ProgressDashboard } from '../src/components/imnci/onlineCourses/ProgressDashboard';
import { MyProgress } from '../src/components/imnci/onlineCourses/MyProgress';
import { CourseScreen } from '../src/components/imnci/onlineCourses/screen';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function render(node) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    await act(async () => { createRoot(host).render(node); });
    await act(async () => {});
    return host;
}
const click = async (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

describe('progress dashboards', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    it('shows a manager each module, where learners stop, and one learner in detail', async () => {
        const host = await render(<ProgressDashboard />);
        expect(host.textContent).toContain('By module');
        expect(host.textContent).toContain('Where learners stop');
        expect(host.textContent).toContain('Danger signs');
        // Amna started long ago and has not finished: quiet.
        expect(host.textContent).toMatch(/Quiet 14\+ days/);
        const row = [...host.querySelectorAll('tr')].find((r) => r.textContent.includes('Amna'));
        expect(row.textContent).toContain('Danger signs');
        await click(row);
        const panel = document.querySelector('[role="dialog"]');
        expect(panel.textContent).toContain('1 of 3 lessons finished');
        expect(panel.textContent).toContain('Module 2');
    });

    it('shows a learner their own lessons, with the next one a tap away', async () => {
        const went = [];
        const items = [
            { id: 'm1', kind: 'module', courseId: 'c1', title: 'Module 1', order: 1 },
            { id: 'm2', kind: 'module', courseId: 'c1', title: 'Module 2', order: 2 },
            { id: 'a1', kind: 'section', courseId: 'c1', moduleId: 'm1', order: 1, title: 'Greeting', read: [] },
            { id: 'a2', kind: 'section', courseId: 'c1', moduleId: 'm1', order: 2, title: 'Danger signs', read: [] },
            { id: 'b1', kind: 'section', courseId: 'c1', moduleId: 'm2', order: 1, title: 'Cough', read: [] },
        ];
        const screen = { courses: [{ id: 'c1', title: 'IMNCI' }], items, progress: { completed: { a1: { seconds: Date.now() / 1000 } } }, go: (p) => went.push(p), duration: (m) => `${m} min` };
        const host = await render(<CourseScreen.Provider value={screen}><MyProgress /></CourseScreen.Provider>);
        expect(host.textContent).toContain('1 of 3 lessons');
        expect(host.textContent).toContain('Opens when you finish Module 1.');
        await click([...host.querySelectorAll('button')].find((b) => b.textContent.includes('Continue: Danger signs')));
        expect(went[0]).toMatchObject({ course: 'c1', module: 'm1', section: 'a2' });
    });
});
