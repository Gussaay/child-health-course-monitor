import React from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import '../src/i18n';
import {
    parseOptionsMulti, optionsTextMulti, feedbackFromText, feedbackToText, dialogueFromText, dialogueToText,
    recordFromText, recordToText, classCardsFromText, classCardsToText,
} from '../src/components/imnci/onlineCourses/cardText';
import { ActivityContext } from '../src/components/imnci/onlineCourses/interactive';
import {
    rightOptions, pickedRight, errorAt, ScenarioBlock, SpotBlock, ClassCardsBlock, ReflectBlock, DrillBlock,
} from '../src/components/imnci/onlineCourses/practice';
import { QuestionBlock } from '../src/components/imnci/onlineCourses/blocks';
import { learnerSummary } from '../src/components/imnci/onlineCourses/learnerProgress';
import { BLOCK_TYPES, ACTIVITY_TYPES } from '../src/components/imnci/book';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mount(el, done) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const ctx = { isDone: (k) => done.has(k), markDone: (k) => done.add(k) };
    await act(async () => { root.render(<ActivityContext.Provider value={ctx}>{el}</ActivityContext.Provider>); });
    return host;
}
const click = async (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const button = (host, text) => [...host.querySelectorAll('button')].find((b) => b.textContent.includes(text));

describe('new practice types', () => {
    it('are known block and activity types', () => {
        ['scenario', 'spot', 'drill', 'classcards', 'reflect'].forEach((t) => {
            expect(BLOCK_TYPES).toContain(t);
            expect(ACTIVITY_TYPES).toContain(t);
        });
    });
});

describe('editor lines for the new types', () => {
    it('reads one or several right options', () => {
        expect(parseOptionsMulti('A ; *B ; C')).toMatchObject({ options: ['A', 'B', 'C'], answer: 1 });
        const multi = parseOptionsMulti('*A ; B ; *C');
        expect(multi.answers).toEqual([0, 2]);
        expect(optionsTextMulti(multi)).toBe('*A ; B ; *C');
        expect(optionsTextMulti({ options: ['x', 'y'], answer: 1 })).toBe('x ; *y');
    });

    it('round-trips feedback, conversations, recording forms and colour cards', () => {
        const fb = ['Yes, chest indrawing.', '', 'No.'];
        expect(feedbackFromText(feedbackToText(fb))).toEqual(fb);
        const talk = [{ who: 'Mother', text: 'He has coughed for 3 days.' }, { who: 'You', text: 'Is he able to drink?' }];
        expect(dialogueFromText(dialogueToText(talk))).toEqual(talk);
        const record = [
            { title: 'Cough', lines: ['3 days', { text: '45 breaths per minute', why: 'Count was 45.' }], classify: [{ text: 'PNEUMONIA', error: true }] },
            { title: 'Fever', lines: ['No'] },
        ];
        expect(recordFromText(recordToText(record))).toEqual(record);
        expect(errorAt(record)).toEqual([0, 'c0']);
        const cards = [{ colour: 'pink', label: 'SEVERE PNEUMONIA', action: 'Refer urgently', signs: 'Any danger sign', treat: 'First dose' }];
        expect(classCardsFromText(classCardsToText(cards))).toEqual(cards);
    });
});

describe('answers', () => {
    it('needs exactly the right options when several are right', () => {
        const q = { options: ['a', 'b', 'c'], answers: [0, 2] };
        expect(rightOptions(q)).toEqual([0, 2]);
        expect(pickedRight(q, [2, 0])).toBe(true);
        expect(pickedRight(q, [0])).toBe(false);
        expect(pickedRight(q, [0, 1, 2])).toBe(false);
        expect(pickedRight({ options: ['a', 'b'], answer: 1 }, [1])).toBe(true);
    });

    it('a question shows feedback for the picked option and records the first try only', async () => {
        const done = new Set();
        const block = { text: 'Classify?', options: ['PNEUMONIA', 'COUGH OR COLD'], answer: 0, feedback: ['Fast breathing.', 'He breathes fast: 52 per minute.'] };
        const host = await mount(<QuestionBlock block={block} activityKey="q1" />, done);
        await click(button(host, 'COUGH OR COLD'));
        expect(host.textContent).toContain('He breathes fast: 52 per minute.');
        expect(done.has('q1@0')).toBe(true);
        expect(done.has('q1')).toBe(true);
        await click(button(host, 'try again'));
        await click(button(host, 'PNEUMONIA'));
        expect(done.has('q1@1')).toBe(false);
    });

    it('select all that apply waits for Check', async () => {
        const done = new Set();
        const block = { text: 'Danger signs?', options: ['Convulsions', 'Cough', 'Vomits everything'], answers: [0, 2] };
        const host = await mount(<QuestionBlock block={block} activityKey="q2" />, done);
        await click(button(host, 'Convulsions'));
        expect(done.has('q2')).toBe(false);
        await click(button(host, 'Vomits everything'));
        await click(button(host, 'Check'));
        expect(done.has('q2@1')).toBe(true);
        expect(host.textContent).toContain('Correct.');
    });
});

describe('practice blocks', () => {
    const child = { name: 'Amna', age: '18 months', weight: 9, temp: 37 };
    const caseOf = (answer) => ({
        child, text: 'Amna has a cough.', record: [{ title: 'Cough', lines: ['52 breaths per minute'] }],
        question: 'Classify?', options: ['PNEUMONIA', 'COUGH OR COLD'], answer,
    });

    it('a case set goes case by case, opens the form, and is done after the last case', async () => {
        const done = new Set();
        const host = await mount(<ScenarioBlock activityKey="s" block={{ part: 'child', cases: [caseOf(0), caseOf(0)] }} />, done);
        expect(host.textContent).toContain('Case 1 of 2');
        await click(button(host, 'recording form'));
        expect(document.body.textContent).toContain('52 breaths per minute');
        await click(button(host, 'COUGH OR COLD'));
        expect(done.has('s#c0@0')).toBe(true);
        await click(button(host, 'Next case'));
        expect(host.textContent).toContain('Case 2 of 2');
        expect(done.has('s')).toBe(false);
        await click(button(host, 'PNEUMONIA'));
        expect(done.has('s#c1@1')).toBe(true);
        expect(done.has('s')).toBe(true);
    });

    it('find the error is done when the wrong entry is tapped', async () => {
        const done = new Set();
        const record = [{ title: 'Cough', lines: [{ text: '52 per minute', why: 'This count is right.' }], classify: [{ text: 'COUGH OR COLD', error: true, why: '52 is fast breathing at 18 months.' }] }];
        const host = await mount(<SpotBlock activityKey="e" block={{ child, record }} />, done);
        await click(button(host, '52 per minute'));
        expect(host.textContent).toContain('This entry is correct');
        expect(done.has('e@0')).toBe(true);
        await click(button(host, 'COUGH OR COLD'));
        expect(host.textContent).toContain('You found it.');
        expect(done.has('e')).toBe(true);
    });

    it('a drill without a clip shows the given count and then the question', async () => {
        const done = new Set();
        const block = { given: 'You count 56 breaths in one minute.', question: 'Is this fast breathing?', options: ['Yes', 'No'], answer: 0 };
        const host = await mount(<DrillBlock activityKey="d" block={block} />, done);
        expect(host.textContent).toContain('You count 56 breaths');
        await click(button(host, 'Yes'));
        expect(done.has('d')).toBe(true);
        expect(done.has('d@1')).toBe(true);
    });

    it('colour cards are done once every card is opened', async () => {
        const done = new Set();
        const cards = [{ colour: 'pink', label: 'SEVERE ANAEMIA', signs: 'Severe palmar pallor' }, { colour: 'green', label: 'NO ANAEMIA' }];
        const host = await mount(<ClassCardsBlock activityKey="c" block={{ cards }} />, done);
        await click(button(host, 'SEVERE ANAEMIA'));
        expect(host.textContent).toContain('Severe palmar pallor');
        expect(done.has('c')).toBe(false);
        await click(button(host, 'NO ANAEMIA'));
        expect(done.has('c')).toBe(true);
    });

    it('a reflection with a rating records the stars once', async () => {
        const done = new Set();
        const host = await mount(<ReflectBlock activityKey="r" block={{ prompts: ['What will you do differently?'], rating: true }} />, done);
        expect(button(host, 'Done').disabled).toBe(true);
        await click(host.querySelector('button[title="4"]'));
        await click(host.querySelector('button[title="2"]'));
        expect(done.has('r@r4')).toBe(true);
        expect(done.has('r@r2')).toBe(false);
        await click(button(host, 'Done'));
        expect(done.has('r')).toBe(true);
    });
});

describe('first tries on the learner page', () => {
    it('counts right first tries without counting them as activities', () => {
        const s = learnerSummary({ courses: [], items: [], progress: { activities: { a: ['k1', 'k1@1', 'k2@0', 'k3#c0@1', 'k4@r5'] } } });
        expect(s.firstRight).toBe(2);
        expect(s.firstTotal).toBe(3);
    });
});

describe('checking a course file', async () => {
    const { practiceErrors } = await import('../src/components/imnci/onlineCourses/coursePackage');
    it('catches broken practice blocks', () => {
        expect(practiceErrors({ type: 'scenario', cases: [] })).toHaveLength(1);
        expect(practiceErrors({ type: 'scenario', cases: [{ options: ['a'], answer: 3 }] })[0]).toContain('case 1');
        expect(practiceErrors({ type: 'spot', record: [{ lines: ['a', 'b'] }] })[0]).toContain('exactly one');
        expect(practiceErrors({ type: 'spot', record: [{ lines: ['a', { text: 'b', error: true }] }] })).toEqual([]);
        expect(practiceErrors({ type: 'question', options: ['a', 'b'], answers: [0, 1] })).toEqual([]);
        expect(practiceErrors({ type: 'classcards', cards: [{ colour: 'blue' }] })).toHaveLength(1);
    });
});
