import { describe, it, expect } from 'vitest';
import { splitForEditor, joinFromEditor, cardMarker, isCard } from '../src/components/imnci/book';
import { DIMCI_M1_EXERCISES, DIMCI_M1_PLAN } from '../src/components/imnci/dimci/module1';
import { EXERCISES, CLASSIFY_OPTIONS } from '../src/components/imnci/exercises';
import { gradeQuiz, gradeCase, REQUIRED_PATIENT_FIELDS } from '../src/components/imnci/exercises.jsx';
import { NATIONAL_PROTOCOLS } from '../src/components/imnci/nationalProtocol';
import { NATIONAL_FORMS } from '../src/components/imnci/recordingForms';

const sections = DIMCI_M1_PLAN.items.filter((i) => i.kind === 'section');
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
    it('ships every exercise as a draft built-in', () => {
        const ids = EXERCISES.map((e) => e.id);
        DIMCI_M1_EXERCISES.forEach((e) => {
            expect(ids).toContain(e.id);
            expect(e.draft).toBe(true);
        });
        expect(new Set(ids).size).toBe(ids.length);
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
        const ex = EXERCISES.find((e) => e.id === 'dimci-m1-ex-c-salina');
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

    it('links only to exercises that exist', () => {
        const ids = new Set(EXERCISES.map((e) => e.id));
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

    it('is one course, one module and five sections that attach to it', () => {
        const mod = DIMCI_M1_PLAN.items.find((i) => i.kind === 'module');
        expect(DIMCI_M1_PLAN.course.isPublished).toBe(false);
        expect(sections).toHaveLength(5);
        sections.forEach((s) => expect(s.legacyModuleKey).toBe(mod.legacyKey));
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
