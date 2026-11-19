import React from 'react';
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import '../src/i18n';
import { QuizPlayer, quizQuestionText, quizHasArabic } from '../src/components/imnci/exercises.jsx';
import { IMNCI_TEST_QUESTIONS } from '../src/components/CourseTestForm';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const pkg = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'course-packages', f), 'utf8'));
const lessons = (p) => p.modules.flatMap((m) => m.sections);

describe('ETAT pre/post test in English, with the Arabic kept', () => {
    const etat = pkg('sudan-etat-training.imnci.json');
    for (const id of ['sudan-etat-pre-test', 'sudan-etat-post-test']) {
        it(`${id}: English questions, Arabic translation stored, switch off`, () => {
            const ex = etat.exercises.find((e) => e.id === id);
            expect(ex.questions).toHaveLength(20);
            expect(ex.arabicOn).toBe(false);
            expect(ex.narrative.join(' ')).not.toMatch(/[؀-ۿ]/);
            expect(ex.narrativeAr.join(' ')).toMatch(/[؀-ۿ]/);
            for (const q of ex.questions) {
                expect(q.question).not.toMatch(/[؀-ۿ]/);
                q.options.forEach((o) => expect(o).not.toMatch(/[؀-ۿ]/));
                expect(q.questionAr).toMatch(/[؀-ۿ]/);
                expect(q.optionsAr).toHaveLength(q.options.length);
            }
        });
    }
    it('the welcome lesson says the test is in English', () => {
        const text = JSON.stringify(lessons(etat).find((s) => s.title === 'Welcome to the course and pre-test'));
        expect(text).toContain('pre/post test, in English');
        expect(text).not.toContain('in Arabic');
    });
});

describe('IMNCI pre-test in both IMNCI online courses', () => {
    for (const f of ['sudan-imnci-classic-modules-1-3.imnci.json', 'who-dimci-modules-1-9.imnci.json']) {
        it(`${f}: the first lesson links the pre-test, made from the app's IMNCI test`, () => {
            const p = pkg(f);
            const first = [...p.modules].sort((a, b) => a.order - b.order)[0].sections.find((s) => s.title === 'How to study this course');
            expect(first.read.some((b) => b.type === 'exercise' && b.exerciseId === 'imnci-pre-test')).toBe(true);
            const ex = p.exercises.find((e) => e.id === 'imnci-pre-test');
            expect(ex.kind).toBe('quiz');
            expect(ex.questions).toHaveLength(IMNCI_TEST_QUESTIONS.length);
            ex.questions.forEach((q, i) => {
                const src = IMNCI_TEST_QUESTIONS[i];
                expect(src.text.endsWith(q.question)).toBe(true);
                expect(q.options).toEqual(src.options.map((o) => o.text));
                expect(q.options[q.correct[0]]).toBe(src.options.find((o) => o.id === src.correctAnswer).text);
            });
        });
    }
});

describe('IMNCI post-test at the end of both IMNCI online courses', () => {
    for (const f of ['sudan-imnci-classic-modules-1-3.imnci.json', 'who-dimci-modules-1-9.imnci.json']) {
        it(`${f}: the last lesson links the post-test, with the pre-test's questions`, () => {
            const p = pkg(f);
            const mods = [...p.modules].sort((a, b) => a.order - b.order);
            const lastModule = mods[mods.length - 1];
            const last = [...lastModule.sections].sort((a, b) => a.order - b.order).pop();
            expect(last.read.some((b) => b.type === 'exercise' && b.exerciseId === 'imnci-post-test')).toBe(true);
            const pre = p.exercises.find((e) => e.id === 'imnci-pre-test');
            const post = p.exercises.find((e) => e.id === 'imnci-post-test');
            expect(post.questions).toEqual(pre.questions);
            // Only the last module ends with it.
            mods.slice(0, -1).forEach((m) => expect(JSON.stringify(m)).not.toContain('imnci-post-test'));
        });
    }
});

describe('quiz language switch', () => {
    const q = { id: 'q1', type: 'mcq', question: 'Which?', options: ['A', 'B'], correct: [0], questionAr: 'أي؟', optionsAr: ['أ', 'ب'] };
    it('shows English unless Arabic is picked, and falls back when a translation is missing', () => {
        expect(quizQuestionText(q, 'en').question).toBe('Which?');
        expect(quizQuestionText(q, 'ar')).toMatchObject({ question: 'أي؟', options: ['أ', 'ب'], rtl: true });
        expect(quizQuestionText({ ...q, optionsAr: ['أ'] }, 'ar').options).toEqual(['A', 'B']);
        expect(quizHasArabic([q])).toBe(true);
        expect(quizHasArabic([{ ...q, questionAr: '' }])).toBe(false);
    });

    const render = async (exercise) => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const root = createRoot(el);
        await act(async () => { root.render(<QuizPlayer exercise={exercise} participant={null} onExit={() => {}} exitLabel="Back to the lesson" />); });
        return { el, root };
    };

    it('has no Arabic button while arabicOn is off', async () => {
        const { el, root } = await render({ id: 'x', title: 'T', kind: 'quiz', narrative: [], questions: [q], arabicOn: false });
        expect(el.textContent).toContain('Which?');
        expect(el.textContent).not.toContain('عربي');
        expect(el.textContent).toContain('Back to the lesson');
        act(() => root.unmount());
    });

    it('switches the questions to Arabic when arabicOn is on', async () => {
        const { el, root } = await render({ id: 'x', title: 'T', kind: 'quiz', narrative: [], questions: [q], arabicOn: true });
        const btn = [...el.querySelectorAll('button')].find((b) => b.textContent === 'عربي');
        expect(btn).toBeTruthy();
        await act(async () => { btn.click(); });
        expect(el.textContent).toContain('أي؟');
        expect(el.textContent).not.toContain('Which?');
        act(() => root.unmount());
    });
});
