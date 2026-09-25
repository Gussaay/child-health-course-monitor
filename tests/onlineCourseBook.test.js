import { describe, it, expect } from 'vitest';
import {
    parsePdfIntoSections, looksLikeHeading, countWords, tabContent, SECTION_TABS,
    newQuestion, newExerciseLink, videoSource, BLOCK_TYPES, contentsTitles,
} from '../src/components/online-course/book';
import {
    IMNCI_SEVERITIES, severityById, severityByProtocolColor,
} from '../src/components/constants';

// Shaped like the real module 2 book: cover, credits, a table of contents with
// dot leaders, then INTRODUCTION and the numbered sections.
const BOOK = [
    { page: 1, lines: ['National Child Health Program', 'ASSESS AND CLASSIFY', '2023'] },
    { page: 2, lines: ['Prepared by the World Health Organization.'] },
    {
        page: 3, lines: [
            'Contents',
            '1.0 ASK THE MOTHER WHAT THE CHILD PROBLEMS ARE ................ 5',
            '2.0 ASK AND CHECK FOR GENERAL DANGER SIGNS ................. 7',
            'INTRODUCTION ................................................',
        ],
    },
    { page: 4, lines: ['INTRODUCTION', 'A mother brings her sick child to the clinic.'] },
    {
        page: 5, lines: [
            '1.0 ASK THE MOTHER WHAT THE CHILD PROBLEMS ARE',
            'A mother usually brings a child to the clinic because the child',
            'is sick. Greet the mother appropriately.',
            '5',
        ],
    },
    {
        page: 6, lines: [
            '2.0 ASK AND CHECK FOR GENERAL DANGER SIGNS',
            'A general danger sign is present if:',
            '• The child is not able to drink',
            '• The child vomits everything',
            'o The child has had convulsions',
            'Refer the child urgently.',
        ],
    },
    { page: 7, lines: ['9 .1 CHECK THE CHILD IMMUNIZATION STATUS', 'Check the card.'] },
];

describe('parsePdfIntoSections', () => {
    const { sections, warnings, firstContentPage } = parsePdfIntoSections(BOOK);

    // The contents page lists the same headings with dot leaders. Reading from
    // page 1 turns the whole table of contents into sections.
    it('starts at INTRODUCTION, not at the table of contents', () => {
        expect(firstContentPage).toBe(4);
        expect(sections.map((s) => s.number)).toEqual(['1.0', '2.0', '9.1']);
    });

    it('does not treat a contents line as a heading', () => {
        expect(looksLikeHeading('1.0 ASK THE MOTHER ................ 5')).toBeNull();
    });

    it('rejoins a number the PDF split across two text items', () => {
        // "9 .1 CHECK ..." would otherwise be filed under section 9.
        expect(sections.find((s) => s.number === '9.1')).toBeDefined();
    });

    it('joins a sentence broken across lines', () => {
        const s = sections.find((x) => x.number === '1.0');
        expect(s.read[0].text).toBe(
            'A mother usually brings a child to the clinic because the child is sick. Greet the mother appropriately.');
    });

    it('collects bullets into one list, whatever marks them', () => {
        const s = sections.find((x) => x.number === '2.0');
        const list = s.read.find((b) => b.type === 'list');
        expect(list.items).toEqual([
            'The child is not able to drink',
            'The child vomits everything',
            'The child has had convulsions',
        ]);
    });

    it('drops the page number printed at the foot of a page', () => {
        const s = sections.find((x) => x.number === '1.0');
        const text = JSON.stringify(s.read);
        expect(text).not.toContain('"5"');
    });

    it('records the page range a section came from', () => {
        const s = sections.find((x) => x.number === '2.0');
        expect(s.startPage).toBe(6);
        expect(countWords(s)).toBeGreaterThan(10);
    });

    it('reports a repeated number rather than silently renumbering', () => {
        const dup = parsePdfIntoSections([
            { page: 1, lines: ['INTRODUCTION'] },
            { page: 2, lines: ['8.2 CLASSIFICATION OF ANAEMIA', 'Look at the palm.'] },
            { page: 3, lines: ['8.2 CHECK VITAMIN A STATUS', 'Ask the mother.'] },
        ]);
        expect(dup.sections).toHaveLength(2);
        expect(dup.warnings.some((w) => w.includes('8.2'))).toBe(true);
    });

    it('says so when the file has no text at all', () => {
        const empty = parsePdfIntoSections([]);
        expect(empty.sections).toEqual([]);
        expect(empty.warnings[0]).toMatch(/scan/i);
    });
});

describe('looksLikeHeading', () => {
    it('accepts a numbered heading in capitals', () => {
        expect(looksLikeHeading('5.2.1 CLASSSIFY MEASLES'))
            .toEqual({ number: '5.2.1', title: 'CLASSSIFY MEASLES' });
    });

    // Body text opening with a figure is the thing most likely to be mistaken
    // for a heading, and a dose line is the worst case: it would split a
    // section mid-treatment.
    it('rejects body text that merely starts with a number', () => {
        expect(looksLikeHeading('2.5 ml of syrup given twice daily for five days')).toBeNull();
        expect(looksLikeHeading('10 children were assessed in the clinic today')).toBeNull();
    });
});

// Figures have to land inside the section whose page they were on, or a
// diagram from page 40 turns up at the end of a section that ended on page 24.
describe('figures are placed with their page', () => {
    const WITH_IMAGES = [
        { page: 1, lines: ['INTRODUCTION'], images: [] },
        { page: 2, lines: ['1.0 FIRST SECTION', 'Some prose here.'], images: [] },
        { page: 3, lines: ['More prose on the next page.'], images: [{ width: 300, height: 200 }] },
        { page: 4, lines: ['2.0 SECOND SECTION', 'Different prose.'], images: [{ width: 120, height: 90 }] },
    ];

    const { sections, imageCount } = parsePdfIntoSections(WITH_IMAGES);

    it('counts every figure it placed', () => {
        expect(imageCount).toBe(2);
    });

    it('puts each figure in the section that was open on that page', () => {
        const first = sections.find((s) => s.number === '1.0');
        const second = sections.find((s) => s.number === '2.0');
        const firstImg = first.see.find((b) => b.type === 'image');
        const secondImg = second.see.find((b) => b.type === 'image');
        expect(firstImg.page).toBe(3);
        expect(secondImg.page).toBe(4);
    });

    it('numbers figures so the uploader can match blob to block', () => {
        const all = sections.flatMap((s) => s.see.filter((b) => b.type === 'image'));
        expect(all.map((b) => b.imageIndex)).toEqual([0, 1]);
    });

    it('does not count a figure as words, which would hide an empty section', () => {
        const imageOnly = parsePdfIntoSections([
            { page: 1, lines: ['INTRODUCTION'], images: [] },
            { page: 2, lines: ['3.0 PICTURES ONLY'], images: [{ width: 300, height: 300 }] },
        ]);
        expect(countWords(imageOnly.sections[0])).toBe(0);
        expect(imageOnly.warnings.some((w) => w.includes('almost no text'))).toBe(true);
    });
});

// The three modules each used to carry their own spelling of the IMNCI
// classification colours. They now share one vocabulary, and the protocol
// values in it are load-bearing: IMNCIRecordingForm compares against them by
// value to decide what a clinician is shown.
describe('classification severity is shared and stable', () => {
    it('keeps the exact strings the clinical engine compares against', () => {
        const byId = Object.fromEntries(IMNCI_SEVERITIES.map((s) => [s.id, s.protocolColor]));
        expect(byId).toEqual({
            severe: 'bg-red-500',
            moderate: 'bg-yellow-400',
            mild: 'bg-green-500',
            note: 'bg-slate-500',
        });
    });

    it('maps a protocol colour back to its severity', () => {
        expect(severityByProtocolColor('bg-red-500').id).toBe('severe');
        expect(severityByProtocolColor('bg-green-500').id).toBe('mild');
    });

    it('falls back to a note rather than throwing on an unknown colour', () => {
        expect(severityByProtocolColor('bg-purple-500').id).toBe('note');
        expect(severityById('nonsense').id).toBe('note');
    });

    it('gives every severity a table-row style for the course books', () => {
        IMNCI_SEVERITIES.forEach((s) => {
            expect(s.row).toMatch(/bg-/);
            expect(s.label).toBeTruthy();
            expect(s.labelAr).toBeTruthy();
        });
    });
});

// Content written before the tabs existed must keep working untouched.
const INTRO_BOOK = [
    { page: 1, lines: ['INTEGRATED MANAGEMENT OF CHILDHOOD ILLNESSES', 'INTRODUCTION', '2023'] },
    { page: 2, lines: ['Prepared by the World Health Organization.'] },
    {
        page: 3,
        lines: [
            'CONTENTS',
            'INTRODUCTION\u2026\u2026\u2026\u2026\u2026\u2026 1',
            'THE CASE MANAGEMENT PROCESS\u2026\u2026\u2026\u2026 2',
            'HOW TO SELECT THEC APPROPRIATE CASE',
            'MANAGEMENT CHARTS\u2026\u2026\u2026\u2026\u2026\u2026 4',
            'GLOSSARY\u2026\u2026\u2026\u2026\u2026\u2026\u2026 7',
        ],
    },
    { page: 4, lines: ['INTRODUCTION', 'Pneumonia, diarrhoea and malaria cause most deaths under five.'] },
    { page: 5, lines: ['THE CASE MANAGEMENT PROCESS', 'The process is presented on a series of charts.', 'ASSESS AND CLASSIFY THE SICK CHILD'] },
    { page: 6, lines: ['HOW TO SELECT THE APPROPRIATE CASE MANAGEMENT CHARTS', 'Decide which age group the child is in.'] },
    { page: 7, lines: ['GLOSSARY', 'Abscess: a collection of pus.'] },
];

describe('a book with no numbered headings', () => {
    it('reads the contents page through its ellipsis leaders', () => {
        expect(contentsTitles(INTRO_BOOK)).toEqual([
            'INTRODUCTION',
            'THE CASE MANAGEMENT PROCESS',
            'HOW TO SELECT THEC APPROPRIATE CASE MANAGEMENT CHARTS',
            'GLOSSARY',
        ]);
    });

    it('splits the book at the topics its contents page names', () => {
        const { sections } = parsePdfIntoSections(INTRO_BOOK);
        expect(sections.map((x) => x.title)).toEqual([
            'INTRODUCTION',
            'THE CASE MANAGEMENT PROCESS',
            'HOW TO SELECT THEC APPROPRIATE CASE MANAGEMENT CHARTS',
            'GLOSSARY',
        ]);
        expect(sections.map((x) => x.number)).toEqual(['1', '2', '3', '4']);
    });

    it('starts after the contents page, not at the cover', () => {
        // The cover of this book prints the word INTRODUCTION, which used to
        // pull the cover and the whole contents page into the first topic.
        const { sections, firstContentPage } = parsePdfIntoSections(INTRO_BOOK);
        expect(firstContentPage).toBe(4);
        expect(sections[0].startPage).toBe(4);
        expect(countWords(sections[0])).toBeLessThan(20);
    });

    it('does not mistake a chart name in capitals for a topic', () => {
        // "ASSESS AND CLASSIFY THE SICK CHILD" sits on its own line in the
        // prose. Only what the contents page names becomes a section.
        const { sections } = parsePdfIntoSections(INTRO_BOOK);
        expect(sections.some((x) => x.title.startsWith('ASSESS AND CLASSIFY'))).toBe(false);
    });

    it('says where the topics came from', () => {
        const { warnings } = parsePdfIntoSections(INTRO_BOOK);
        expect(warnings.some((w) => /contents page/i.test(w))).toBe(true);
    });
});

describe('section tabs', () => {
    it('reads legacy blocks as the Read tab', () => {
        const legacy = { blocks: [{ type: 'paragraph', text: 'Old content' }] };
        expect(tabContent(legacy, 'read')).toEqual(legacy.blocks);
        expect(tabContent(legacy, 'see')).toEqual([]);
    });

    it('prefers the new field when a section has both', () => {
        const both = {
            blocks: [{ type: 'paragraph', text: 'old' }],
            read: [{ type: 'paragraph', text: 'new' }],
        };
        expect(tabContent(both, 'read')[0].text).toBe('new');
    });

    it('offers the three training tabs in order', () => {
        expect(SECTION_TABS.map((t) => t.id)).toEqual(['read', 'see', 'practise']);
        SECTION_TABS.forEach((t) => {
            expect(t.label).toBeTruthy();
            expect(t.labelAr).toBeTruthy();
        });
    });

    it('shows retired Test content under Practise instead of losing it', () => {
        const old = {
            practise: [{ type: 'note', text: 'a case' }],
            test: [{ type: 'question', text: 'an old question', options: ['a', 'b'], answer: 0 }],
        };
        const shown = tabContent(old, 'practise');
        expect(shown).toHaveLength(2);
        expect(shown[1].text).toBe('an old question');
    });

    it('counts words across every tab, not just Read', () => {
        expect(countWords({
            read: [{ type: 'paragraph', text: 'one two' }],
            practise: [{ type: 'paragraph', text: 'three four five' }],
        })).toBe(5);
    });

    it('has an empty tab where there is no content, never undefined', () => {
        // The views map over what this returns; undefined would be a crash on a
        // section that has text but no questions, which is most of them.
        SECTION_TABS.forEach((t) => {
            expect(Array.isArray(tabContent({}, t.id))).toBe(true);
            expect(tabContent(null, t.id)).toEqual([]);
        });
    });
});

describe('questions', () => {
    it('starts with two answers and the first marked correct', () => {
        const q = newQuestion();
        expect(q.type).toBe('question');
        expect(q.options).toHaveLength(2);
        expect(q.answer).toBe(0);
    });

    it('knows the authored block types', () => {
        ['question', 'page', 'video', 'exercise'].forEach((t) => {
            expect(BLOCK_TYPES).toContain(t);
        });
    });

    it('starts an exercise link with nothing chosen, so saving is refused', () => {
        expect(newExerciseLink().exerciseId).toBe('');
    });
});

describe('video addresses', () => {
    it('embeds a YouTube watch link', () => {
        expect(videoSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
            .toEqual({ kind: 'embed', src: 'https://www.youtube.com/embed/dQw4w9WgXcQ' });
    });

    it('embeds a shortened YouTube link', () => {
        expect(videoSource('https://youtu.be/dQw4w9WgXcQ').src)
            .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    });

    it('embeds a Vimeo link', () => {
        expect(videoSource('https://vimeo.com/123456789'))
            .toEqual({ kind: 'embed', src: 'https://player.vimeo.com/video/123456789' });
    });

    it('plays anything else as a file', () => {
        expect(videoSource('https://example.org/teaching.mp4'))
            .toEqual({ kind: 'file', src: 'https://example.org/teaching.mp4' });
    });

    it('treats a blank address as no video at all', () => {
        expect(videoSource('')).toBeNull();
        expect(videoSource(null)).toBeNull();
    });
});
