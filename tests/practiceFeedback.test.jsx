import React from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import '../src/i18n';
import { ActivityContext, StoryBlock, CalcBlock, calcIsRight } from '../src/components/imnci/onlineCourses/interactive';
import { QuestionBlock } from '../src/components/imnci/onlineCourses/blocks';
import { isFacilitatorBlock, learnerContent, facilitatorContent, sectionContent, BLOCK_TYPES } from '../src/components/imnci/book';
import { guideCourses } from '../src/components/imnci/FacilitatorGuides';
import { sectionText } from '../src/components/imnci/onlineCourses/search';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mount(el, done = new Set()) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const ctx = { isDone: (k) => done.has(k), markDone: (k) => done.add(k) };
    await act(async () => { root.render(<ActivityContext.Provider value={ctx}>{el}</ActivityContext.Provider>); });
    return host;
}
const click = async (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const options = (host) => [...host.querySelectorAll('[data-testid="choice-option"]')];
const type = async (input, value) => act(async () => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
});

describe('a wrong pick gives a hint, not the answer', () => {
    const q = { type: 'question', text: 'Leah has sunken eyes and a slow skin pinch. Triage?', options: ['Queue', 'Priority', 'Emergency'], answer: 2,
        feedback: ['Does she have an emergency sign?', 'Look at the D of ABCD.', ''], explanation: 'Two signs of severe dehydration: emergency.' };

    it('strikes the wrong option, shows its hint and keeps the answer hidden', async () => {
        const done = new Set();
        const host = await mount(<QuestionBlock block={q} activityKey="q1" number={1} total={1} />, done);
        await click(options(host)[0]);
        expect(host.querySelector('[data-testid="choice-hint"]').textContent).toContain('Does she have an emergency sign?');
        expect(host.querySelector('[data-testid="choice-result"]')).toBeNull();
        expect(options(host)[0].disabled).toBe(true);
        expect(done.has('q1')).toBe(false);
        await click(options(host)[2]);
        expect(host.querySelector('[data-testid="choice-result"]').textContent).toContain('Correct, this time.');
        expect(host.textContent).toContain('Two signs of severe dehydration');
        expect(done.has('q1')).toBe(true);
    });

    it('shows the answer after two wrong picks', async () => {
        const host = await mount(<QuestionBlock block={q} activityKey="q2" number={1} total={1} />);
        await click(options(host)[0]);
        await click(options(host)[1]);
        const result = host.querySelector('[data-testid="choice-result"]').textContent;
        expect(result).toContain('The answer is C.');
        expect(result).toContain('Look at the D of ABCD.');
    });
});

describe('a case in stages', () => {
    const story = { type: 'story', title: 'Shift', stages: [
        { text: 'Bintu arrives convulsing.', question: 'First?', options: ['Check glucose', 'Wait'], answer: 0, feedback: ['', 'She may die while waiting.'] },
        { text: 'No strips for the glucometer.', question: 'Now?', options: ['Wait for strips', 'Give glucose'], answer: 1 },
    ] };

    it('waits for a right answer before the case goes on, then sums up', async () => {
        const done = new Set();
        const host = await mount(<StoryBlock block={story} activityKey="s" />, done);
        await click(options(host)[1]);
        expect(host.textContent).toContain('She may die while waiting.');
        expect(host.textContent).not.toContain('Continue the case');
        await click(options(host)[0]);
        await click([...host.querySelectorAll('button')].find((b) => b.textContent.includes('Continue the case')));
        await click(options(host)[3]);
        await click([...host.querySelectorAll('button')].find((b) => b.textContent.includes('Finish the case')));
        const summary = host.querySelector('[data-testid="story-summary"]').textContent;
        expect(summary).toContain('Right first time at 1 of 2 decisions.');
        expect(summary).toContain('First?');
        expect(done.has('s')).toBe(true);
    });
});

describe('work it out', () => {
    const calc = { type: 'calc', text: 'Ali weighs 12 kg.', question: '10% glucose at 5 ml/kg?', answer: 60, unit: 'ml', hint: 'Multiply the weight by 5.', explanation: '12 × 5 = 60 ml' };

    it('accepts the number, a range and Arabic digits', () => {
        expect(calcIsRight(calc, '60')).toBe(true);
        expect(calcIsRight(calc, '٦٠')).toBe(true);
        expect(calcIsRight(calc, '61')).toBe(false);
        expect(calcIsRight({ ...calc, tolerance: 2 }, '61.5')).toBe(true);
        expect(calcIsRight({ answers: [10, 11] }, '11')).toBe(true);
        expect(calcIsRight(calc, '')).toBe(false);
    });

    it('gives the hint after a wrong number and the answer after two', async () => {
        const done = new Set();
        const host = await mount(<CalcBlock block={calc} activityKey="c" />, done);
        const input = host.querySelector('[data-testid="calc-input"]');
        await type(input, '120');
        await click(host.querySelector('[data-testid="calc-check"]'));
        expect(host.querySelector('[data-testid="calc-hint"]').textContent).toContain('Multiply the weight by 5.');
        await type(input, '24');
        await click(host.querySelector('[data-testid="calc-check"]'));
        expect(host.querySelector('[data-testid="calc-result"]').textContent).toContain('The answer is 60 ml.');
        expect(done.has('c')).toBe(true);
        expect(BLOCK_TYPES).toContain('calc');
    });
});

describe('notes for the facilitator', () => {
    const section = { read: [
        { type: 'note', label: 'In this lesson', text: 'Triage.' },
        { type: 'note', label: 'Course timetable', text: 'Day 1, 09:00.' },
        { type: 'note', label: 'From your facilitator', text: 'Run Drill 1 with the doll.' },
        { type: 'paragraph', text: 'Triage is sorting.', facilitator: true },
        { type: 'paragraph', text: 'Emergency signs.' },
    ] };

    it('are kept from the learner and listed for the facilitator', () => {
        expect(learnerContent(section).map((b) => b.text)).toEqual(['Triage.', 'Emergency signs.']);
        expect(facilitatorContent(section)).toHaveLength(3);
        expect(sectionContent(section)).toHaveLength(5);
        expect(sectionText(section)).not.toContain('Drill 1');
        expect(isFacilitatorBlock({ type: 'note', label: 'Facilitator tip' })).toBe(false);
    });

    it('list the courses that have them, guide courses first', () => {
        const courses = [{ id: 'a', title: 'ETAT' }, { id: 'b', title: 'Plain' }, { id: 'g', title: 'Guide', audience: 'facilitators' }, { id: 'x', title: 'Gone', isDeleted: true, audience: 'facilitators' }];
        const items = [{ id: 's1', kind: 'section', courseId: 'a', ...section }, { id: 's2', kind: 'section', courseId: 'b', read: [{ type: 'paragraph', text: 'x' }] }];
        expect(guideCourses(courses, items).map((g) => [g.course.id, g.notes])).toEqual([['g', 0], ['a', 3]]);
    });
});
