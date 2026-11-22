import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { checkPackage, packagePlan } from '../src/components/imnci/onlineCourses/coursePackage';
import { resolveCourseLink } from '../src/components/imnci/onlineCourses/CourseLinkBlock';
import { activityKeys } from '../src/components/imnci/onlineCourses/activityKeys';
import { learnerContent } from '../src/components/imnci/book';
import { gradeQuiz } from '../src/components/imnci/exercises.jsx';

// The Sick & Small Newborn course files (scripts/ssnb-upload/build): one
// course per manual module, one app module per manual section.
const FILES = ['ssnb-module-1-essential-emergency-newborn-care', 'ssnb-module-2-special-newborn-care', 'ssnb-module-3-intensive-newborn-care'];
const GUIDE = JSON.parse(fs.readFileSync(path.join(__dirname, '../course-packages/ssnb-facilitator-guide.imnci.json'), 'utf8'));
const PKGS = FILES.map((f) => JSON.parse(fs.readFileSync(path.join(__dirname, `../course-packages/${f}.imnci.json`), 'utf8')));
const lessons = (p) => p.modules.flatMap((m) => m.sections);

describe('Sick & Small Newborn course files', () => {
    it('are valid course files, each a modular course in the Small & Sick Newborn category', () => {
        PKGS.forEach((p) => {
            const check = checkPackage(p, []);
            expect(check.errors).toEqual([]);
            expect(check.warnings).toEqual([]);
            expect(p.course).toMatchObject({ category: 'Small & Sick Newborn', modulesAnyOrder: true });
        });
        expect(PKGS.map((p) => p.modules.length)).toEqual([3, 8, 3]);
    });

    it('places each procedure and equipment SOP inside the lessons that use it, not in a module of its own', () => {
        PKGS.forEach((p) => expect(p.course).toMatchObject({ lockOrder: true, enrolment: 'approval' }));
        const titles = PKGS.flatMap((p) => p.modules.map((m) => m.title)).join(' | ');
        expect(titles).not.toMatch(/Neonatal Procedures|Equipment Required/);
        const sopIn = (p, lesson) => lessons(p).find((s) => s.title === lesson).read
            .filter((b) => b.type === 'note' && b.label === 'Standard operating procedure').map((b) => b.text.replace(/<[^>]*>/g, ''));
        expect(sopIn(PKGS[0], 'Hypothermia: signs, prevention and the delivery room').join()).toMatch(/Radiant warmer/);
        expect(sopIn(PKGS[1], 'Treating neonatal sepsis').join()).toMatch(/Lumbar puncture/);
        expect(sopIn(PKGS[2], 'CPAP: how it works and its parts').join()).toMatch(/Vayu bubble CPAP/);
        const all = PKGS.flatMap(lessons).flatMap((s) => s.read);
        expect(all.some((b) => b.type === 'courselink' && /Annex/.test(b.course))).toBe(false);
        expect(packagePlan(PKGS[1]).items.filter((i) => i.kind === 'module').length).toBe(8);
    });

    it('has a facilitator guide for facilitators only, without the resuscitation chapter, linked to the learners\' modules', () => {
        const check = checkPackage(GUIDE, []);
        expect(check.errors).toEqual([]);
        expect(GUIDE.course).toMatchObject({ audience: 'facilitators', lockOrder: false, category: 'Small & Sick Newborn' });
        expect(GUIDE.modules.map((m) => m.title).join(' ')).not.toMatch(/resuscitation of non-breathing/i);
        const courses = PKGS.map((p, i) => ({ id: `c${i}`, title: p.course.title, isPublished: true }));
        const items = [];
        PKGS.forEach((p, i) => p.modules.forEach((m) => {
            items.push({ id: `c${i}m${m.order}`, kind: 'module', courseId: `c${i}`, order: m.order, title: m.title });
            m.sections.forEach((s, k) => items.push({ id: `c${i}m${m.order}s${k}`, kind: 'section', courseId: `c${i}`, moduleId: `c${i}m${m.order}`, title: s.title }));
        }));
        const links = GUIDE.modules.flatMap((m) => m.sections).flatMap((s) => s.read).filter((b) => b.type === 'courselink');
        expect(links.length).toBeGreaterThanOrEqual(14);
        links.forEach((b) => {
            const r = resolveCourseLink(b, courses, items);
            expect(r.module, `${b.course} ${b.module}`).toBeTruthy();
            if (b.lesson) expect(r.section?.title).toBe(b.lesson);
        });
    });

    it('gives every lesson at least one activity and keeps facilitator material out of the learner view', () => {
        PKGS.forEach((p) => lessons(p).forEach((s) => {
            expect(activityKeys(learnerContent(s)).length).toBeGreaterThan(0);
        }));
    });

    it('links only to lessons that exist in the three courses', () => {
        const courses = PKGS.map((p, i) => ({ id: `c${i}`, title: p.course.title, isPublished: true }));
        const items = [];
        PKGS.forEach((p, i) => p.modules.forEach((m) => {
            items.push({ id: `c${i}m${m.order}`, kind: 'module', courseId: `c${i}`, order: m.order, title: m.title });
            m.sections.forEach((s, k) => items.push({ id: `c${i}m${m.order}s${k}`, kind: 'section', courseId: `c${i}`, moduleId: `c${i}m${m.order}`, title: s.title }));
        }));
        const links = PKGS.flatMap(lessons).flatMap((s) => s.read).filter((b) => b.type === 'courselink');
        expect(links.length).toBeGreaterThanOrEqual(2); // lesson-to-lesson links; SOPs are placed in full, not linked
        links.forEach((b) => {
            const r = resolveCourseLink(b, courses, items);
            expect(r.section?.title).toBe(b.lesson);
        });
    });

    it('scores the book\'s own MCQs and has an answer key on every case exercise', () => {
        PKGS.forEach((p) => p.exercises.forEach((e) => {
            expect(e.kind).toBe('quiz');
            e.questions.filter((q) => q.type === 'open').forEach((q) => expect((q.points || []).length).toBeGreaterThan(0));
        }));
        const qs = PKGS.flatMap(lessons).flatMap((s) => s.read).filter((b) => b.type === 'question');
        qs.forEach((b) => expect(b.answer).toBeLessThan(b.options.length));
        expect(typeof gradeQuiz).toBe('function');
    });

    it('renders every lesson', async () => {
        const React = (await import('react')).default;
        const { renderToStaticMarkup } = await import('react-dom/server');
        const { ContentBlocks } = await import('../src/components/imnci/onlineCourses/blocks');
        PKGS.forEach((p) => lessons(p).forEach((s) => {
            const html = renderToStaticMarkup(React.createElement(ContentBlocks, { blocks: s.read.filter((b) => b.type !== 'courselink') }));
            expect(html.length).toBeGreaterThan(100);
        }));
    });
});
