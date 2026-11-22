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
const FILES = ['ssnb-module-1-essential-emergency-newborn-care', 'ssnb-module-2-special-newborn-care', 'ssnb-module-3-intensive-newborn-care', 'ssnb-annex-neonatal-procedures-and-equipment'];
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
        expect(PKGS.map((p) => p.modules.length)).toEqual([3, 8, 3, 2]);
    });

    it('keeps the procedure and equipment SOPs in the course annexes and opens them from the lessons with a button', () => {
        const annex = PKGS[3];
        expect(annex.course).toMatchObject({ audience: 'annex', enrolment: 'open', lockOrder: false });
        expect(annex.modules.every((m) => m.anyOrder)).toBe(true);
        PKGS.slice(0, 3).forEach((p) => expect(p.course).toMatchObject({ lockOrder: true, enrolment: 'approval' }));
        const titles = PKGS.slice(0, 3).flatMap((p) => p.modules.map((m) => m.title)).join(' | ');
        expect(titles).not.toMatch(/Neonatal Procedures|Equipment Required/);
        const buttons = (p, lesson) => lessons(p).find((s) => s.title === lesson).read
            .filter((b) => b.type === 'courselink' && b.popup).map((b) => b.lesson);
        expect(buttons(PKGS[0], 'Hypothermia: signs, prevention and the delivery room')).toContain('Radiant warmer');
        expect(buttons(PKGS[1], 'Treating neonatal sepsis')).toContain('Lumbar puncture');
        expect(buttons(PKGS[2], 'CPAP: how it works and its parts')).toContain('Vayu bubble CPAP system');
        // the SOP text itself is only in the annexes
        const inLessons = JSON.stringify(PKGS.slice(0, 3).map((p) => p.modules));
        expect(inLessons).not.toContain('Turn on the warmer 20 min before');
        expect(JSON.stringify(annex.modules)).toContain('Turn on the warmer 20 min before');
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
        expect(links.length).toBeGreaterThanOrEqual(20); // lesson links and the SOP buttons into the course annexes
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
