import { describe, it, expect } from 'vitest';
import { splitForEditor, joinFromEditor, cardMarker, isCard } from '../src/components/imnci/book';
import fs from 'fs';
import path from 'path';
import { CLASSIFY_OPTIONS } from '../src/components/imnci/exercises';
import {
    checkPackage, packagePlan, buildPackage, exercisesToSave, packageFileName, PACKAGE_FORMAT,
} from '../src/components/imnci/onlineCourses/coursePackage';
import { gradeQuiz, gradeCase, REQUIRED_PATIENT_FIELDS } from '../src/components/imnci/exercises.jsx';
import { NATIONAL_PROTOCOLS } from '../src/components/imnci/nationalProtocol';
import { NATIONAL_FORMS } from '../src/components/imnci/recordingForms';

// Module 1 ships as a course file, imported in the app like any other.
const PKG = JSON.parse(fs.readFileSync(path.join(__dirname, '../course-packages/who-dimci-module1.imnci.json'), 'utf8'));
const DIMCI_M1_EXERCISES = PKG.exercises;
const sections = PKG.modules.flatMap((m) => m.sections);
const blocks = (s) => [...s.read, ...s.see, ...s.practise];

describe('section editor cards keep their place in the text', () => {
    const content = [
        { type: 'paragraph', text: 'First paragraph.' },
        { type: 'booklet', part: 'child', categories: ['danger'] },
        { type: 'paragraph', text: 'Second paragraph.' },
        { type: 'note', label: 'Sudan national protocol', text: 'Sudan says this.' },
        { type: 'note', text: 'A plain key point stays in the text.' },
    ];

    it('splits cards out and joins them back in the same order', () => {
        const { html, cards } = splitForEditor(content);
        expect(cards.map((c) => c.type)).toEqual(['booklet', 'note']);
        expect(html).toContain(cardMarker('c1'));
        const back = joinFromEditor(html, cards);
        expect(back.map((b) => b.type)).toEqual(['rich', 'booklet', 'rich', 'note', 'rich']);
        expect(back[1]).toEqual(content[1]);
        expect(back[3]).toEqual(content[3]);
        expect(back.some((b) => '_k' in b)).toBe(false);
    });

    it('keeps a card whose marker was deleted, after the text', () => {
        const { html, cards } = splitForEditor(content);
        const back = joinFromEditor(html.replace(`<p>${cardMarker('c1')}</p>`, ''), cards);
        expect(back[back.length - 1].type).toBe('booklet');
        expect(back.filter((b) => b.type === 'booklet')).toHaveLength(1);
    });

    it('drops a stray marker typed inside a paragraph', () => {
        const back = joinFromEditor('<p>Text [[card c9]] more</p>', []);
        expect(back).toEqual([{ type: 'rich', text: '<p>Text  more</p>' }]);
    });

    it('treats only labelled notes as cards', () => {
        expect(isCard({ type: 'note', text: 'x' })).toBe(false);
        expect(isCard({ type: 'note', label: 'Sudan national protocol', text: 'x' })).toBe(true);
    });
});

describe('written answers in a quiz', () => {
    it('are shown with their answer key but not scored', () => {
        const qs = [
            { id: 'a', type: 'open', question: 'List the signs', points: ['one', 'two'] },
            { id: 'b', type: 'mcq', question: 'Pick', options: ['x', 'y'], correct: [1] },
        ];
        const r = gradeQuiz(qs, { a: 'anything', b: [1] });
        expect(r.possible).toBe(1);
        expect(r.percent).toBe(100);
        expect(r.detail.a.open).toBe(true);
    });
});

describe('WHO distance learning Module 1', () => {
    it('is a valid course file with every exercise as a draft', () => {
        const check = checkPackage(PKG, []);
        expect(check.errors).toEqual([]);
        expect(check.warnings).toEqual([]);
        expect(check.summary).toMatchObject({ modules: 1, sections: 5, exercises: 8 });
        DIMCI_M1_EXERCISES.forEach((e) => expect(e.draft).toBe(true));
    });

    it('has quiz answers that point at real options', () => {
        DIMCI_M1_EXERCISES.filter((e) => e.kind === 'quiz').forEach((e) => {
            expect(e.questions.length).toBeGreaterThan(0);
            e.questions.forEach((q) => {
                if (q.type === 'mcq') q.correct.forEach((i) => expect(q.options[i]).toBeTruthy());
                if (q.type === 'tf') expect(typeof q.correct).toBe('boolean');
                if (q.type === 'open') expect(q.points.length).toBeGreaterThan(0);
            });
        });
        const logbook = DIMCI_M1_EXERCISES.find((e) => e.id === 'dimci-m1-logbook');
        expect(logbook.questions).toHaveLength(20);
    });

    it('marks Salina right when the form is filled as in the answer key', () => {
        const ex = DIMCI_M1_EXERCISES.find((e) => e.id === 'dimci-m1-ex-c-salina');
        const want = ex.expected;
        const ids = CLASSIFY_OPTIONS.danger.map((o) => o.id);
        expect(ids).toEqual(expect.arrayContaining(want.classifications.danger));
        const r = gradeCase(want, {
            patientData: { ...want.patientData, date: '2026-11-11', problems: 'Cough for 4 days, not eating well' },
            assessments: want.assessments,
            chosenClassifications: want.classifications,
        }, (k) => k, { requiredFields: REQUIRED_PATIENT_FIELDS.child });
        expect(r.percent).toBe(100);
        const wrong = gradeCase(want, {
            patientData: { ...want.patientData, date: 'x', problems: 'x' },
            assessments: { ...want.assessments, notAbleToDrink: false },
            chosenClassifications: { danger: ['no_danger_sign'] },
        }, (k) => k, { requiredFields: REQUIRED_PATIENT_FIELDS.child });
        expect(wrong.percent).toBeLessThan(100);
    });

    it('links only to exercises in the file', () => {
        const ids = new Set(DIMCI_M1_EXERCISES.map((e) => e.id));
        sections.flatMap(blocks).filter((b) => b.type === 'exercise')
            .forEach((b) => expect(ids.has(b.exerciseId)).toBe(true));
    });

    it('names chart booklet tables and form rows the protocol has', () => {
        const all = sections.flatMap(blocks);
        all.filter((b) => b.type === 'booklet').forEach((b) => {
            b.categories.forEach((c) => expect(NATIONAL_PROTOCOLS[b.part].categories[c]).toBeTruthy());
        });
        const rows = NATIONAL_FORMS.form_child.sections.map((s) => s.id);
        all.filter((b) => b.type === 'form').forEach((b) => b.sections.forEach((s) => expect(rows).toContain(s)));
        expect(all.some((b) => b.type === 'booklet')).toBe(true);
        expect(all.some((b) => b.type === 'form')).toBe(true);
    });

    it('imports as one unpublished course, one module and five sections in order', () => {
        const plan = packagePlan(PKG);
        const mod = plan.items.find((i) => i.kind === 'module');
        const secs = plan.items.filter((i) => i.kind === 'section');
        expect(plan.course.isPublished).toBe(false);
        expect(plan.existingCourseId).toBe(null);
        expect(secs.map((s) => s.title.slice(0, 3))).toEqual(['1.1', '1.2', '1.3', '1.4', '1.5']);
        secs.forEach((s, i) => { expect(s.legacyModuleKey).toBe(mod.legacyKey); expect(s.order).toBe(i + 1); });
    });

    it('survives a round trip through the section editor', () => {
        sections.forEach((s) => ['read', 'see', 'practise'].forEach((tab) => {
            const { html, cards } = splitForEditor(s[tab]);
            const back = joinFromEditor(html, cards);
            expect(back.filter(isCard)).toEqual(s[tab].filter(isCard));
        }));
    });
});

describe('Module 1 sections render', () => {
    it('draws the chart booklet and recording form blocks from the protocol', async () => {
        const React = (await import('react')).default;
        const { renderToStaticMarkup } = await import('react-dom/server');
        const { ContentBlocks } = await import('../src/components/imnci/onlineCourses/blocks');
        sections.forEach((s) => ['read', 'see'].filter((tab) => s[tab].length).forEach((tab) => {
            const html = renderToStaticMarkup(React.createElement(ContentBlocks, { blocks: s[tab] }));
            expect(html.length).toBeGreaterThan(100);
        }));
        const s13 = sections.find((s) => s.title.startsWith('1.3'));
        const html = renderToStaticMarkup(React.createElement(ContentBlocks, { blocks: s13.read }));
        expect(html).toContain('Sudan national protocol');
        expect(html.toLowerCase()).toContain('dysentery');
        const s11 = sections.find((s) => s.title.startsWith('1.1'));
        expect(renderToStaticMarkup(React.createElement(ContentBlocks, { blocks: s11.see }))).toContain('Vomits everything');
    });
});

describe('course files', () => {
    it('refuses a file that is not a course file, or is broken', () => {
        expect(checkPackage({ hello: 1 }).errors.length).toBeGreaterThan(0);
        const bad = JSON.parse(JSON.stringify(PKG));
        bad.modules[0].sections[0].read.push({ type: 'wizard' });
        bad.exercises[1].questions[0].correct = [9];
        bad.exercises.push({ ...bad.exercises[0] });
        bad.exercises.push({ id: 'blank-text', kind: 'quiz', title: 'T', questions: [{ type: 'text', question: 'Name it', correct: ' ' }] });
        const errors = checkPackage(bad).errors.join(' ');
        expect(errors).toContain('unknown block type');
        expect(errors).toContain('not one of its options');
        expect(errors).toContain('used twice');
        expect(errors).toContain('expected text answer is missing');
    });

    it('warns about a link to an exercise that is nowhere', () => {
        const pkg = { format: PACKAGE_FORMAT, version: 1, modules: [{ title: 'M', sections: [{ title: 'S', practise: [{ type: 'exercise', exerciseId: 'nope' }] }] }] };
        expect(checkPackage(pkg).warnings[0]).toContain('nope');
        expect(checkPackage(pkg, ['nope']).warnings).toEqual([]);
    });

    it('adds modules to an existing course after the ones it has, without touching the course', () => {
        const plan = packagePlan(PKG, { existingCourseId: 'abc', firstModuleOrder: 4 });
        expect(plan.existingCourseId).toBe('abc');
        expect(plan.course).toEqual({ id: 'abc' });
        expect(plan.items.find((i) => i.kind === 'module').order).toBe(4);
    });

    it('keeps the app\'s exercises unless told to replace them', () => {
        const ids = ['dimci-m1-pretest'];
        expect(exercisesToSave(PKG, ids).map((e) => e.id)).not.toContain('dimci-m1-pretest');
        expect(exercisesToSave(PKG, ids, { replace: true })).toHaveLength(8);
        expect(checkPackage(PKG, ids).summary.clashes).toEqual(ids);
    });

    it('exports a module as a file that imports back the same', () => {
        const plan = packagePlan(PKG);
        const mod = { ...plan.items.find((i) => i.kind === 'module'), id: 'm1', courseId: 'c1' };
        const secs = plan.items.filter((i) => i.kind === 'section').map((s, i) => ({ ...s, id: `s${i}`, moduleId: 'm1', courseId: 'c1', isDeleted: false }));
        const out = buildPackage({ course: { id: 'c1', title: 'IMNCI distance learning modules' }, modules: [mod], sectionsByModule: { m1: secs }, exercises: [...PKG.exercises, { id: 'other', title: 'Not linked' }] });
        expect(checkPackage(out).errors).toEqual([]);
        expect(out.exercises.map((e) => e.id).sort()).toEqual(PKG.exercises.map((e) => e.id).sort());
        const again = out.modules[0].sections;
        expect(again.map((s) => s.title)).toEqual(PKG.modules[0].sections.map((s) => s.title));
        expect(again[2].read).toEqual(PKG.modules[0].sections[2].read);
        expect(JSON.stringify(out)).not.toMatch(/"(courseId|moduleId|legacyModuleKey)"/);
    });

    it('names the file after the module', () => {
        expect(packageFileName('Module 1: General danger signs')).toBe('module-1-general-danger-signs.imnci.json');
    });
});
