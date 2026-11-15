import React from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import '../src/i18n';
import {
    toSeconds, toClock, parseOptions, optionsText, cardsFromText, cardsToText, stepsFromText, stepsToText,
    groupsFromText, sortItemsFromText, sortItemsToText, chaptersFromText, chaptersToText, stopsFromText, stopsToText,
} from '../src/components/imnci/onlineCourses/cardText';
import { ActivityContext, FlipBlock, SortBlock, RevealBlock } from '../src/components/imnci/onlineCourses/interactive';
import { activityKeys } from '../src/components/imnci/onlineCourses/blocks';
import { sectionContent, BLOCK_TYPES } from '../src/components/imnci/book';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('section editor lines for activities', () => {
    it('reads times as seconds and back', () => {
        expect(toSeconds('1:05')).toBe(65);
        expect(toSeconds('65')).toBe(65);
        expect(toSeconds('1:02:03')).toBe(3723);
        expect(toSeconds('')).toBe(0);
        expect(toSeconds('a:b')).toBe(0);
        expect(toClock(65)).toBe('1:05');
    });

    it('marks the starred option as the answer', () => {
        expect(parseOptions('Yes ; *No ; Maybe')).toEqual({ options: ['Yes', 'No', 'Maybe'], answer: 1 });
        expect(parseOptions('A ; B')).toEqual({ options: ['A', 'B'], answer: 0 });
        expect(optionsText(['Yes', 'No'], 1)).toBe('Yes ; *No');
    });

    it('round-trips flip cards, steps, sort items, chapters and stops', () => {
        const cards = [{ front: 'Fever', back: '37.5 °C or above' }, { front: 'Low', back: 'below 35.5 °C' }];
        expect(cardsFromText(cardsToText(cards))).toEqual(cards);
        const steps = [{ title: 'Look', text: 'at the umbilicus | is it red?' }, { title: 'Wash hands', text: '' }];
        expect(stepsFromText(stepsToText(steps))).toEqual(steps);
        const groups = groupsFromText('Good, Poor');
        expect(groups).toEqual(['Good', 'Poor']);
        const items = [{ text: 'Chin touching breast', group: 0 }, { text: 'Lower lip turned in', group: 1, why: 'poor' }];
        expect(sortItemsFromText(sortItemsToText(items, groups), groups)).toEqual(items);
        expect(sortItemsFromText('Mouth wide open | good', groups)[0].group).toBe(0);
        const chapters = [{ at: 0, label: 'Start' }, { at: 95, label: 'Breathing' }];
        expect(chaptersFromText(chaptersToText(chapters))).toEqual(chapters);
        const stops = [{ at: 30, text: 'Fast breathing?', options: ['Yes', 'No'], answer: 0, explanation: '64 per minute' }];
        expect(stopsFromText(stopsToText(stops))).toEqual(stops);
    });
});

describe('one page per section', () => {
    it('joins the old Read, See and Practise tabs in order', () => {
        const s = { read: [{ type: 'paragraph', text: 'a' }], see: [{ type: 'paragraph', text: 'b' }], practise: [{ type: 'exercise', exerciseId: 'x' }] };
        expect(sectionContent(s).map((b) => b.text || b.exerciseId)).toEqual(['a', 'b', 'x']);
        ['reveal', 'flip', 'sort', 'steps', 'story'].forEach((t) => expect(BLOCK_TYPES).toContain(t));
    });

    it('counts activities, but not a video that has no link yet', () => {
        const keys = activityKeys([
            { type: 'paragraph', text: 'p' }, { type: 'flip', cards: [] }, { type: 'video', url: '', title: 'Coming' },
            { type: 'video', url: 'https://x/v.mp4' }, { type: 'exercise', exerciseId: 'e' },
        ]);
        expect(keys).toEqual(['1', '3', '4']);
    });
});

async function mount(el, done) {
    const host = document.createElement('div');
    const root = createRoot(host);
    const ctx = { isDone: (k) => done.has(k), markDone: (k) => done.add(k) };
    await act(async () => { root.render(<ActivityContext.Provider value={ctx}>{el}</ActivityContext.Provider>); });
    return host;
}
const click = async (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

describe('activities', () => {
    it('flip cards are done once every card has been turned', async () => {
        const done = new Set();
        const host = await mount(<FlipBlock activityKey="2" block={{ title: 'T', cards: [{ front: 'F1', back: 'B1' }, { front: 'F2', back: 'B2' }] }} />, done);
        const buttons = host.querySelectorAll('button[aria-pressed]');
        await click(buttons[0]);
        expect(host.textContent).toContain('B1');
        expect(done.has('2')).toBe(false);
        await click(buttons[1]);
        expect(done.has('2')).toBe(true);
    });

    it('sorting marks each choice and shows the score at the end', async () => {
        const done = new Set();
        const block = { text: 'Sort', groups: ['Good', 'Poor'], items: [{ text: 'Chin touching', group: 0 }, { text: 'Lip in', group: 1, why: 'turned in' }], explanation: 'All four signs.' };
        const host = await mount(<SortBlock activityKey="0" block={block} />, done);
        const pickGroup = async (name) => {
            const b = [...host.querySelectorAll('button')].find((x) => x.textContent === name);
            await click(b);
        };
        await pickGroup('Good');
        await pickGroup('Good');
        expect(host.textContent).toContain('1 of 2 right');
        expect(host.textContent).toContain('turned in');
        expect(host.textContent).toContain('All four signs.');
        expect(done.has('0')).toBe(true);
    });

    it('a reveal shows the answer after the learner asks for it', async () => {
        const done = new Set();
        const host = await mount(<RevealBlock activityKey="5" block={{ text: 'How do you classify?', answer: 'SEVERE JAUNDICE' }} />, done);
        expect(host.textContent).not.toContain('SEVERE JAUNDICE');
        await click(host.querySelector('button'));
        expect(host.textContent).toContain('SEVERE JAUNDICE');
        expect(done.has('5')).toBe(true);
    });
});
