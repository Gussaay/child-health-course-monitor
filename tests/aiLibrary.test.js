import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { pageText, sectionsFromOutline, packPages, cleanSections, parseAiText, titleFromFile, aiTextToBlocks } from '../src/components/aiLibrary/bookText.js';

const require = createRequire(import.meta.url);
const { rankPages, hybridRankPages, bestPages, pageRange } = require('../functions/aiBooksText.js');

describe('reading a book', () => {
    it('joins pdf.js text items into lines and mends hyphenated words', () => {
        const items = [{ str: 'Check for general dan-', hasEOL: true }, { str: 'ger signs', hasEOL: false }, { str: '  now', hasEOL: true }];
        expect(pageText(items)).toBe('Check for general danger signs now');
    });

    it('turns bookmarks into chapters that end where the next one starts', () => {
        const flat = [
            { title: 'Assess and classify', page: 3, level: 0 },
            { title: 'Cough', page: 4, level: 1 },
            { title: 'Diarrhoea', page: 6, level: 1 },
            { title: 'Treat the child', page: 10, level: 0 },
        ];
        expect(sectionsFromOutline(flat, 20)).toEqual([
            { title: 'Assess and classify', from: 3, to: 9, level: 0 },
            { title: 'Cough', from: 4, to: 5, level: 1 },
            { title: 'Diarrhoea', from: 6, to: 9, level: 1 },
            { title: 'Treat the child', from: 10, to: 20, level: 0 },
        ]);
    });

    it('packs pages into parts small enough for one document each', () => {
        const big = 'x'.repeat(200000);
        const parts = packPages([big, big, 'small', big]);
        expect(parts.map((p) => [p.from, p.to])).toEqual([[1, 1], [2, 3], [4, 4]]);
        expect(parts[1].pages).toEqual([big, 'small']);
    });

    it('keeps typed chapters in range and in order', () => {
        expect(cleanSections([{ title: ' B ', from: '8', to: '99' }, { title: '', from: 1, to: 2 }, { title: 'A', from: 5, to: 2 }], 10))
            .toEqual([{ title: 'A', from: 5, to: 5, level: 0 }, { title: 'B', from: 8, to: 10, level: 0 }]);
    });

    it('makes a title from a file name', () => {
        expect(titleFromFile('IMCI_chart-booklet.pdf')).toBe('IMCI chart booklet');
    });
});

describe('showing AI text', () => {
    it('finds headings, bullets, bold and page citations', () => {
        const blocks = parseAiText('## Danger signs\n- **Convulsions** need referral (p. 4)\n1. Give ORS (Chart booklet, p. 12)');
        expect(blocks[0]).toMatchObject({ type: 'h', parts: [{ text: 'Danger signs' }] });
        expect(blocks[1].type).toBe('li');
        expect(blocks[1].parts).toEqual([{ text: 'Convulsions', bold: true }, { text: ' need referral ' }, { text: '(p. 4)', cite: true }]);
        expect(blocks[2]).toMatchObject({ type: 'ol', n: '1' });
        expect(blocks[2].parts[1]).toEqual({ text: '(Chart booklet, p. 12)', cite: true });
    });
});

describe('choosing pages for a question', () => {
    const pages = [
        { title: 'B', page: 1, text: 'Contents and introduction' },
        { title: 'B', page: 2, text: 'Fast breathing: 50 breaths per minute or more in a child 2 to 12 months is pneumonia.' },
        { title: 'B', page: 3, text: 'Diarrhoea with some dehydration: give ORS, plan B.' },
        { title: 'B', page: 4, text: 'الإسهال مع بعض الجفاف: أعط محلول الإرواء' },
    ];

    it('ranks the pages that share the question\'s words first', () => {
        expect(rankPages(pages, 'how many breaths is fast breathing?')[0].page).toBe(2);
        expect(rankPages(pages, 'treatment of dehydration')[0].page).toBe(3);
        expect(rankPages(pages, 'علاج الاسهال')[0].page).toBe(4);
    });

    it('fits the best pages into the space and returns them in book order', () => {
        const chosen = bestPages([pages[2], pages[1], pages[0]], 160);
        expect(chosen.map((p) => p.page)).toEqual([2, 3]);
    });

    it('keeps a page range inside the book', () => {
        const entry = { pages: new Array(30).fill('t') };
        expect(pageRange(entry, 0, 99)).toEqual([1, 30]);
        expect(pageRange(entry, 12, 5)).toEqual([12, 12]);
    });
});

describe('the AI book import', () => {
    it('turns the AI text into the course block kinds', () => {
        expect(aiTextToBlocks('## Assess\nAsk the mother.\n- Look\n- Listen\n1. Count **breaths**\n2. Classify\nGive <ORS> & fluids.')).toEqual([
            { type: 'heading', text: 'Assess' },
            { type: 'paragraph', text: 'Ask the mother.' },
            { type: 'list', items: ['Look', 'Listen'] },
            { type: 'rich', text: '<ol><li>Count <strong>breaths</strong></li><li>Classify</li></ol>' },
            { type: 'paragraph', text: 'Give <ORS> & fluids.' },
        ]);
    });

    it('escapes text that goes into rich blocks', () => {
        expect(aiTextToBlocks('**Note**: a < b')).toEqual([{ type: 'rich', text: '<p><strong>Note</strong>: a &lt; b</p>' }]);
    });
});

describe('finding pages by meaning and words together', () => {
    const pages = [
        { bookId: 'b', title: 'Book', page: 1, text: 'Danger signs: not able to drink, vomits everything, convulsions.' },
        { bookId: 'b', title: 'Book', page: 2, text: 'A sick young infant who cannot feed or has fits is seriously ill.' },
        { bookId: 'b', title: 'Book', page: 3, text: 'Give amoxicillin twice daily for five days.' },
    ];
    const sims = { 1: 0.5, 2: 0.9, 3: 0.1 };
    it('keeps a page that matches only by meaning and ranks it with the keyword pages', () => {
        const ranked = hybridRankPages(pages, 'danger signs', (p) => sims[p.page]);
        expect(ranked.map((p) => p.page)).toContain(2);
        expect(ranked[0].page).toBe(1);
        expect(rankPages(pages, 'danger signs').map((p) => p.page)).toEqual([1]);
    });
    it('falls back to keywords when no page has a vector', () => {
        expect(hybridRankPages(pages, 'amoxicillin', () => null).map((p) => p.page)).toEqual([3]);
    });
});
