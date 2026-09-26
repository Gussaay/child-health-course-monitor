import { describe, it, expect } from 'vitest';
import {
    parsePdfIntoSections, looksLikeHeading, countWords, tabContent, SECTION_TABS,
    newQuestion, newExerciseLink, videoSource, BLOCK_TYPES, contentsTitles,
    blockHtml, fontStyle, richLine, dropEmptyTags,
} from '../src/components/imnci/book';
import { sanitiseHtml } from '../src/components/imnci/shared';
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

// =============================================================================
// The rich text sanitiser.
//
// Course text is authored as HTML and rendered back with dangerouslySetInnerHTML
// to every learner. An author account is trusted, but a compromised one must not
// be able to put a script in front of a health worker, so this is pinned.
// =============================================================================

describe('sanitiseHtml', () => {
    it('keeps the formatting the toolbar produces', () => {
        const html = '<p><b>Bold</b> and <i>italic</i> and <u>underlined</u>.</p>';
        expect(sanitiseHtml(html)).toBe(html);
    });

    it('keeps colour, font and alignment, which is the point of it', () => {
        const out = sanitiseHtml('<p style="text-align: center"><span style="color: #be123c; font-size: 1.25rem">SEVERE</span></p>');
        expect(out).toContain('text-align: center');
        expect(out).toContain('color: #be123c');
        expect(out).toContain('font-size: 1.25rem');
    });

    it('drops a script outright', () => {
        expect(sanitiseHtml('<p>Hello</p><script>alert(1)</script>')).not.toContain('alert');
    });

    it('drops event handlers', () => {
        const out = sanitiseHtml('<p onclick="steal()" onmouseover="steal()">Text</p>');
        expect(out).not.toContain('onclick');
        expect(out).not.toContain('onmouseover');
        expect(out).toContain('Text');
    });

    it('drops a javascript: link but keeps the words', () => {
        const out = sanitiseHtml('<a href="javascript:alert(1)">Click</a>');
        expect(out).not.toContain('javascript:');
        expect(out).toContain('Click');
    });

    it('survives the malformed-tag trick a regular expression misses', () => {
        // <img/**/onerror=...> defeats a naive /<[^>]*>/ strip.
        const out = sanitiseHtml('<img src=x onerror="alert(1)">');
        expect(out).not.toContain('onerror');
    });

    it('refuses a style that can fetch something', () => {
        const out = sanitiseHtml('<p style="background-image: url(http://evil/x); color: red">Hi</p>');
        expect(out).not.toContain('url(');
        expect(out).toContain('color: red');
    });

    it('refuses a fetching value even on a property it allows', () => {
        expect(sanitiseHtml('<p style="border: 1px solid url(http://evil/x)">x</p>')).not.toContain('url(');
        expect(sanitiseHtml('<p style="width: expression(alert(1))">x</p>')).not.toContain('expression');
    });

    it('keeps a classification chart whole', () => {
        // The chart builder writes its colours and its spacing as inline style,
        // because the chart has to carry its own meaning wherever it ends up.
        // Stripping padding and width left the cells touching each other.
        const chart = '<table style="width: 100%"><tr>'
            + '<td style="background-color: #ffe4e6; color: #881337; padding: 6px">Stridor</td>'
            + '</tr></table>';
        const out = sanitiseHtml(chart);
        expect(out).toContain('width: 100%');
        expect(out).toContain('background-color: #ffe4e6');
        expect(out).toContain('padding: 6px');
        expect(out).toContain('Stridor');
    });

    it('unwraps a disallowed element rather than losing the text inside it', () => {
        // Dropping the children with the wrapper would silently lose a whole
        // paragraph because of one stray tag from a paste.
        const out = sanitiseHtml('<marquee><p>Important guidance</p></marquee>');
        expect(out).toContain('Important guidance');
        expect(out).not.toContain('marquee');
    });

    it('makes every link safe to open', () => {
        const out = sanitiseHtml('<a href="https://who.int">WHO</a>');
        expect(out).toContain('rel="noreferrer noopener"');
        expect(out).toContain('target="_blank"');
    });

    it('treats nothing as nothing', () => {
        expect(sanitiseHtml('')).toBe('');
        expect(sanitiseHtml(null)).toBe('');
        expect(sanitiseHtml(undefined)).toBe('');
    });
});

// =============================================================================
// blockHtml
//
// The bug this pins: it used to decide "is this already HTML?" by looking for a
// tag. Converted text with an ampersand in it has no tags, so it was escaped on
// load, saved in the escaped form, and escaped AGAIN next time — "WHO & UNICEF"
// drifted to "WHO &amp;amp; UNICEF", a little worse on every visit.
// =============================================================================

describe('blockHtml', () => {
    it('escapes text that came from the PDF', () => {
        expect(blockHtml({ type: 'paragraph', text: 'WHO & UNICEF' })).toBe('WHO &amp; UNICEF');
    });

    it('does NOT escape text that was written in the editor', () => {
        const written = '<p>WHO &amp; UNICEF</p>';
        expect(blockHtml({ type: 'rich', text: written })).toBe(written);
    });

    it('never escapes the same text twice', () => {
        // Load, save, load again: the ampersand must not grow.
        const fromPdf = { type: 'paragraph', text: 'WHO & UNICEF' };
        const saved = { type: 'rich', text: blockHtml(fromPdf) };
        expect(blockHtml(saved)).toBe('WHO &amp; UNICEF');
        expect(blockHtml({ type: 'rich', text: blockHtml(saved) })).toBe('WHO &amp; UNICEF');
    });

    it('turns a converted list into one a rich editor can hold', () => {
        expect(blockHtml({ type: 'list', items: ['first', 'second & third'] }))
            .toBe('<ul><li>first</li><li>second &amp; third</li></ul>');
    });

    it('counts words without counting the markup', () => {
        expect(countWords({ read: [{ type: 'rich', text: '<p><strong>one</strong> two three</p>' }] })).toBe(3);
    });
});

// =============================================================================
// Keeping the book's formatting
//
// The books carry meaning in their typography: a lead-in is bold italic, and
// "a classification in the pink row" has `pink row` set in bold in the middle
// of the sentence. Throwing that away meant an author put it back by hand on
// every paragraph of a 95-page book.
// =============================================================================

const run = (str, over = {}) => ({
    str, x: 0, width: str.length * 6, size: 12,
    bold: false, italic: false, mono: false, gap: true, ...over,
});

describe('fontStyle', () => {
    it('reads bold and italic from the embedded font name', () => {
        expect(fontStyle('Times New Roman,Bold')).toMatchObject({ bold: true, italic: false });
        expect(fontStyle('Times New Roman,BoldItalic')).toMatchObject({ bold: true, italic: true });
        expect(fontStyle('Times New Roman')).toMatchObject({ bold: false, italic: false });
        expect(fontStyle('ABCDEE+Courier New')).toMatchObject({ mono: true });
    });

    it('is not fooled by a font with neither in its name', () => {
        expect(fontStyle('ABCDEE+Calibri')).toEqual({ bold: false, italic: false, mono: false });
        expect(fontStyle('')).toEqual({ bold: false, italic: false, mono: false });
        expect(fontStyle(null)).toEqual({ bold: false, italic: false, mono: false });
    });
});

describe('richLine', () => {
    it('keeps bold in the middle of a sentence', () => {
        const html = richLine([
            run('A classification in the '),
            run('pink row', { bold: true }),
            run(' needs urgent attention'),
        ], 12);
        expect(html).toContain('<strong>pink row</strong>');
        expect(html).toContain('A classification in the');
    });

    it('puts a space BETWEEN two differently-styled runs', () => {
        // Without this the tags closed straight onto the next word and the
        // page read "listed on the<strong>ASSESS".
        const html = richLine([
            run('listed on the'),
            run('ASSESS & CLASSIFY', { bold: true, italic: true }),
            run('chart'),
        ], 12);
        expect(html).not.toMatch(/the<(strong|em)/);
        expect(html).toContain('&amp;');
    });

    it('writes a size only when it differs from the body', () => {
        expect(richLine([run('body text')], 12)).not.toContain('font-size');
        expect(richLine([run('A HEADING', { size: 14 })], 12)).toContain('font-size: 1.17em');
    });

    it('escapes the text it is given', () => {
        expect(richLine([run('1 < 2 & 3 > 2')], 12)).toBe('1 &lt; 2 &amp; 3 &gt; 2');
    });

    it('drops a symbol-font glyph that carries no text', () => {
        // Wingdings bullets arrive as private-use characters, which render as a
        // blank or a box and used to leave an empty span in front of every item.
        const html = richLine([run('\uF0A7', { mono: true }), run('PNEUMONIA', { bold: true })], 12);
        expect(html).toBe('<strong>PNEUMONIA</strong>');
    });
});

describe('dropEmptyTags', () => {
    it('removes a tag left wrapping nothing', () => {
        expect(dropEmptyTags('<span style="font-family: monospace"></span> <strong>x</strong>'))
            .toBe('<strong>x</strong>');
    });

    it('keeps a tag that still has something in it', () => {
        expect(dropEmptyTags('<strong>kept</strong>')).toBe('<strong>kept</strong>');
    });

    it('unwinds nested empties', () => {
        expect(dropEmptyTags('<em><span></span></em>after')).toBe('after');
    });
});

describe('a book read WITH its formatting', () => {
    // The same shape extractPdfPages produces: plain lines for the structural
    // decisions, and a matching rich entry per line for the text itself.
    const page = (n, rows) => ({
        page: n,
        lines: rows.map((r) => r[0]),
        rich: rows.map((r, i) => ({ html: r[1], y: 700 - i * 16, x: 63, size: 12, bold: false, bodySize: 12 })),
        images: [],
    });

    const BOOK = [
        page(1, [['INTRODUCTION', 'INTRODUCTION']]),
        page(2, [
            ['3.2 CLASSIFY COUGH', '3.2 CLASSIFY COUGH'],
            ['A classification in the pink row needs urgent', 'A classification in the <strong>pink row</strong> needs urgent'],
            ['attention.', 'attention.'],
        ]),
    ];

    it('produces rich blocks that keep the bold', () => {
        const { sections } = parsePdfIntoSections(BOOK);
        expect(sections).toHaveLength(1);
        const [first] = sections[0].read;
        expect(first.type).toBe('rich');
        expect(first.text).toContain('<strong>pink row</strong>');
    });

    it('still joins a sentence the PDF broke across two lines', () => {
        const { sections } = parsePdfIntoSections(BOOK);
        expect(sections[0].read[0].text).toContain('needs urgent attention.');
    });

    it('falls back to plain paragraphs when there is no formatting to read', () => {
        // A scanned or unusual book gives no font information, and must still
        // convert rather than producing nothing.
        const plain = BOOK.map(({ page: n, lines }) => ({ page: n, lines, images: [] }));
        const { sections } = parsePdfIntoSections(plain);
        expect(sections[0].read[0].type).toBe('paragraph');
        expect(sections[0].read[0].text).not.toContain('<strong>');
    });
});
