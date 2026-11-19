import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import '../src/i18n';

const saved = [];
let confirmAnswer = true;
const confirms = [];
vi.mock('../src/firebase', () => ({ storage: {} }));
vi.mock('firebase/storage', () => ({ ref: () => ({}), getDownloadURL: async () => 'https://x', uploadBytes: async () => {} }));
vi.mock('../src/data', () => ({ upsertOnlineCourseItem: async (p) => { saved.push(p); } }));
vi.mock('../src/components/dialogs', () => ({
    notify: vi.fn(),
    confirmDialog: async (msg) => { confirms.push(msg); return confirmAnswer; },
}));
vi.mock('../src/components/imnci/shared', async (orig) => ({ ...(await orig()), useImnci: () => ({ exercises: [] }) }));

import { SectionTabEditor } from '../src/components/imnci/onlineCourses/SectionTabEditor';
import { toElements, fromElements, findProblem, partBreaks } from '../src/components/imnci/onlineCourses/editor/model';
import { answerRows, answersFromRows } from '../src/components/imnci/onlineCourses/editor/rows';
import { isActivity } from '../src/components/imnci/book';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('lesson editor model', () => {
    it('edits a run of text as one element and keeps activities in their place', () => {
        const els = toElements([
            { type: 'heading', text: 'Danger signs' },
            { type: 'paragraph', text: 'Ask & look.' },
            { type: 'flip', title: 'Signs', cards: [{ front: 'A', back: 'B' }] },
            { type: 'rich', text: '<p>More</p>' },
        ]);
        expect(els.map((e) => e.type)).toEqual(['rich', 'flip', 'rich']);
        expect(els[0].text).toBe('<h3>Danger signs</h3>\n<p>Ask &amp; look.</p>');
        expect(els.every((e) => e._k)).toBe(true);
        const back = fromElements(els);
        expect(back[1]).toEqual({ type: 'flip', title: 'Signs', cards: [{ front: 'A', back: 'B' }] });
        expect(back.some((b) => '_k' in b)).toBe(false);
    });

    it('keeps labelled notes and book pictures as their own elements and drops empty ones on save', () => {
        const els = toElements([
            { type: 'note', label: 'Sudan national protocol', text: 'Amoxicillin for 5 days.' },
            { type: 'image', path: 'figures/a.png' },
            { type: 'note', label: 'Key point', text: '' },
            { type: 'video', url: '', title: '' },
        ]);
        expect(els.map((e) => e.type)).toEqual(['note', 'image', 'note', 'video']);
        expect(fromElements(els).map((b) => b.type)).toEqual(['note', 'image']);
    });

    it('turns answer boxes back into the saved question fields', () => {
        const q = { options: ['A', 'B', 'C'], answer: 1, feedback: ['no', '', ''] };
        const rows = answerRows(q);
        expect(rows.map((r) => r.right)).toEqual([false, true, false]);
        expect(answersFromRows(rows)).toEqual({ options: ['A', 'B', 'C'], feedback: ['no'], answer: 1, answers: undefined });
        rows[2].right = true;
        expect(answersFromRows(rows, true)).toMatchObject({ answers: [1, 2], answer: undefined });
    });

    it('finds what a learner could not use, and where parts break', () => {
        const els = [{ type: 'rich', text: '<p>x</p>' }, { type: 'question', text: 'Q?', options: ['only one'], answer: 0 }, { type: 'rich', text: '<p>y</p>' }];
        expect(findProblem(els)).toEqual({ index: 1, reason: 'two_answers' });
        expect([...partBreaks(els, isActivity)]).toEqual([1]);
    });
});

const section = {
    id: 's1', courseId: 'c1', title: 'How to study this course',
    read: [
        { type: 'paragraph', text: 'Learn how to find your way in this course.' },
        { type: 'flip', title: 'The bar at the bottom', cards: [{ front: 'Previous', back: 'Opens the lesson before.' }] },
        { type: 'reveal', text: 'Think', answer: 'Answer' },
    ],
};

async function mount() {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const done = { saved: 0 };
    await act(async () => { createRoot(host).render(<SectionTabEditor section={section} tab="all" onSaved={() => { done.saved += 1; }} onCancel={() => {}} />); });
    return { host, done };
}
const click = async (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const button = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.includes(text));

describe('lesson editor', () => {
    beforeEach(() => {
        saved.length = 0; confirms.length = 0; confirmAnswer = true; document.body.innerHTML = '';
        HTMLDialogElement.prototype.showModal = HTMLDialogElement.prototype.showModal || function show() { this.open = true; };
        HTMLDialogElement.prototype.close = HTMLDialogElement.prototype.close || function close() { this.open = false; };
    });

    it('shows the lesson as elements with no card markers', async () => {
        const { host } = await mount();
        expect(host.querySelectorAll('[data-testid="element"]').length).toBe(3);
        expect(host.textContent).not.toContain('[[card');
        expect(host.textContent).toContain('Flip cards');
        expect(host.querySelectorAll('[data-testid="part-line"]').length).toBe(2);
    });

    it('asks before deleting, and keeps the element when the answer is no', async () => {
        const { host } = await mount();
        await click(host.querySelectorAll('[data-testid="element"]')[1]);
        confirmAnswer = false;
        await click(host.querySelector('[data-testid="delete-element"]'));
        expect(confirms.length).toBe(1);
        expect(confirms[0]).toContain('flip cards');
        expect(host.querySelectorAll('[data-testid="element"]').length).toBe(3);

        confirmAnswer = true;
        await click(host.querySelector('[data-testid="delete-element"]'));
        expect(host.querySelectorAll('[data-testid="element"]').length).toBe(2);
        await click(button(host, 'Save'));
        expect(saved[0].read.map((b) => b.type)).toEqual(['rich', 'reveal']);
    });

    it('edits flip cards one box per card and saves them', async () => {
        const { host } = await mount();
        await click(host.querySelectorAll('[data-testid="element"]')[1]);
        await click(button(host, 'Edit'));
        const sheet = document.querySelector('[data-testid="edit-sheet"]');
        expect(sheet.querySelectorAll('[data-testid="row"]').length).toBe(1);
        await click(button(sheet, 'Add a card'));
        expect(sheet.querySelectorAll('[data-testid="row"]').length).toBe(2);
        const front = sheet.querySelectorAll('[data-testid="row"]')[1].querySelector('input');
        await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(front, 'Next');
            front.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await click(button(sheet, 'Done'));
        await click(button(host, 'Save'));
        expect(saved[0].read[1].cards).toEqual([{ front: 'Previous', back: 'Opens the lesson before.' }, { front: 'Next', back: '' }]);
    });

    it('adds a new element from the grouped menu where + was pressed', async () => {
        const { host } = await mount();
        await click(host.querySelector('[data-testid="add-end"]'));
        await click(document.querySelector('[data-testid="add-sudan"]'));
        const sheet = document.querySelector('[data-testid="edit-sheet"]');
        const note = sheet.querySelector('textarea');
        await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(note, 'Sudan gives zinc for 10 days.');
            note.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await click(button(sheet, 'Done'));
        await click(button(host, 'Save'));
        expect(saved[0].read.at(-1)).toEqual({ type: 'note', label: 'Sudan national protocol', text: 'Sudan gives zinc for 10 days.' });
    });
});
