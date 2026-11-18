import React, { act } from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import fs from 'fs';
import path from 'path';
import '../src/i18n';
import { checkPackage, courseLinkErrors } from '../src/components/imnci/onlineCourses/coursePackage';
import CourseLinkBlock, { resolveCourseLink } from '../src/components/imnci/onlineCourses/CourseLinkBlock';
import { CourseScreen } from '../src/components/imnci/onlineCourses/screen';
import { canSeeCourse, followsAnyLesson, isFacilitatorRole } from '../src/components/imnci/onlineCourses/audience';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const read = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, '../course-packages', name), 'utf8'));
const FG = read('who-dimci-facilitator-guide.imnci.json');
const LEARN = read('who-dimci-modules-1-9.imnci.json');
const blocks = (s) => [...(s.read || []), ...(s.see || []), ...(s.practise || [])];
const links = FG.modules.flatMap((m) => m.sections.flatMap(blocks)).filter((b) => b.type === 'courselink');

// The learners' course as the app holds it once imported: a course record,
// and module and section items with their own ids.
const courses = [{ id: 'c-learn', title: LEARN.course.title }, { id: 'c-fg', title: FG.course.title, audience: 'facilitators' }];
const items = LEARN.modules.flatMap((m, mi) => [
    { id: `m${mi}`, kind: 'module', courseId: 'c-learn', order: m.order, title: m.title },
    ...m.sections.map((s, si) => ({ id: `m${mi}s${si}`, kind: 'section', moduleId: `m${mi}`, title: s.title })),
]);

describe('the facilitator guide course file', () => {
    it('is a valid course file for facilitators, with its exams as drafts', () => {
        const check = checkPackage(FG, []);
        expect(check.errors).toEqual([]);
        expect(check.warnings).toEqual([]);
        expect(check.summary).toMatchObject({ modules: 6, sections: 54, exercises: 2 });
        expect(FG.course).toMatchObject({ audience: 'facilitators', lockOrder: false });
        FG.exercises.forEach((e) => expect(e.draft).toBe(true));
        expect(FG.exercises.find((e) => e.id === 'dimci-fg-exam').questions.length).toBe(30);
    });

    it('renders every lesson, with its links to the learners\' modules', async () => {
        const { renderToStaticMarkup } = await import('react-dom/server');
        const { ContentBlocks } = await import('../src/components/imnci/onlineCourses/blocks');
        FG.modules.flatMap((m) => m.sections).forEach((s) => {
            const html = renderToStaticMarkup(
                <CourseScreen.Provider value={{ allCourses: courses, allItems: items, go: () => {} }}>
                    <ContentBlocks blocks={blocks(s)} />
                </CourseScreen.Provider>);
            expect(html.length, s.title).toBeGreaterThan(200);
            expect(html, s.title).not.toContain('data-found="false"');
        });
    });

    it('links to every learner module, and each link opens a module and lesson that exist', () => {
        expect(links.length).toBeGreaterThan(50);
        expect([...new Set(links.map((b) => b.module))].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        links.forEach((b) => {
            expect(courseLinkErrors(b)).toEqual([]);
            const { course, module, section } = resolveCourseLink(b, courses, items);
            expect(course?.id, b.course).toBe('c-learn');
            expect(module?.order, `${b.module} ${b.lesson}`).toBe(b.module);
            if (b.lesson) expect(section?.moduleId, b.lesson).toBe(module.id);
        });
    });
});

describe('a link to the learners\' course', () => {
    it('reports a missing course or module number', () => {
        expect(courseLinkErrors({ course: '', module: 2 })).toHaveLength(1);
        expect(courseLinkErrors({ course: 'X', module: 0 })).toHaveLength(1);
        expect(courseLinkErrors({ course: 'X', module: 3 })).toEqual([]);
    });

    it('ignores deleted courses and finds a module by its title when the order is missing', () => {
        const cs = [{ id: 'old', title: 'A', isDeleted: true }, { id: 'new', title: 'a ' }];
        const its = [{ id: 'mx', kind: 'module', courseId: 'new', title: 'Module 4: Diarrhoea' }];
        expect(resolveCourseLink({ course: 'A', module: 4 }, cs, its)).toMatchObject({ course: { id: 'new' }, module: { id: 'mx' }, section: null });
    });

    it('picks, among courses with the same title, the one that holds the lesson, published first', () => {
        const cs = [{ id: 'old', title: 'A', isPublished: true }, { id: 'draft', title: 'A' }, { id: 'pub', title: 'A', isPublished: true }];
        const its = [
            { id: 'o1', kind: 'module', courseId: 'old', order: 1, title: 'Module 1' },
            { id: 'd3', kind: 'module', courseId: 'draft', order: 3, title: 'Module 3' },
            { id: 'd3s', kind: 'section', moduleId: 'd3', title: 'Count the breaths' },
            { id: 'p3', kind: 'module', courseId: 'pub', order: 3, title: 'Module 3' },
            { id: 'p3s', kind: 'section', moduleId: 'p3', title: 'Count the breaths' },
        ];
        expect(resolveCourseLink({ course: 'A', module: 3, lesson: 'Count the breaths' }, cs, its).section.id).toBe('p3s');
        expect(resolveCourseLink({ course: 'A', module: 3, lesson: 'Count the breaths' }, cs.slice(0, 2), its).section.id).toBe('d3s');
        expect(resolveCourseLink({ course: 'A', module: 1 }, cs, its).module.id).toBe('o1');
    });

    const render = async (block, screen) => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        await act(async () => { createRoot(host).render(<CourseScreen.Provider value={screen}><CourseLinkBlock block={block} /></CourseScreen.Provider>); });
        return host;
    };

    it('opens the lesson it names', async () => {
        const went = [];
        const b = links.find((x) => x.lesson);
        const host = await render(b, { allCourses: courses, allItems: items, go: (p) => went.push(p) });
        const el = host.querySelector('[data-testid="course-link"]');
        expect(el.dataset.found).toBe('true');
        await act(async () => { el.querySelector('button').click(); });
        expect(went).toHaveLength(1);
        expect(went[0]).toMatchObject({ course: 'c-learn', tab: 'read' });
        expect(went[0].section).toBeTruthy();
    });

    it('says so, and does nothing, when the lesson is not in the app yet', async () => {
        const went = [];
        const host = await render({ type: 'courselink', course: LEARN.course.title, module: 12 }, { allCourses: courses, allItems: items, go: (p) => went.push(p) });
        const el = host.querySelector('[data-testid="course-link"]');
        expect(el.dataset.found).toBe('false');
        expect(el.textContent).toContain('is not in the app yet');
        await act(async () => { el.querySelector('button').click(); });
        expect(went).toEqual([]);
    });
});

describe('who sees the facilitator guide', () => {
    const guide = { audience: 'facilitators' };
    it('keeps it out of the course list (it is read in Protocol management) except for course authors', () => {
        expect(canSeeCourse(guide, {})).toBe(false);
        expect(canSeeCourse({}, {})).toBe(true);
        expect(canSeeCourse(guide, { isFacilitator: isFacilitatorRole(['IMNCI Facilitator']) })).toBe(false);
        expect(canSeeCourse(guide, { canSeeProgress: true })).toBe(false);
        expect(canSeeCourse(guide, { canManage: true })).toBe(true);
        expect(isFacilitatorRole(['state_coordinator'])).toBe(false);
    });
    it('lets facilitators open any lesson of the learners\' course', () => {
        expect(followsAnyLesson({ isFacilitator: true })).toBe(true);
        expect(followsAnyLesson({})).toBe(false);
    });
});
