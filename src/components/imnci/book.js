// src/components/imnci/book.js
//
// Turns an IMNCI module book into readable sections, so a learner reads the
// text in the app instead of being handed a 95-page PDF and a page number.
//
// The books are written to a consistent shape — numbered headings in capitals
// ("2.0 ASK AND CHECK FOR GENERAL DANGER SIGNS", "5.2.1 CLASSSIFY MEASLES"),
// then paragraphs and bullet lists — which is what makes this possible at all.
//
// Two halves, kept apart on purpose:
//   extractPdfPages  needs a browser and pdfjs, and cannot be unit tested
//   parsePdfIntoSections  is pure, and is where every judgement call lives
//
// Nothing here rewrites the source. Where the book contradicts itself — module
// 2 numbers its Vitamin A section 8.2 when it should be 9.2 — the number is
// carried through as printed and reported, because correcting a national
// training document is the programme's call, not a parser's.

const HEADING = /^(\d+(?:\.\d+)*)\s+(.{3,120})$/;

// Dot leaders on a contents page. Both spellings appear in these books: a run
// of full stops, and a run of the single … character, which is what the
// Introduction book uses — matching only full stops found no contents page
// there at all.
const LEADERS = /[.…]{4,}/;
const isTocLine = (s) => LEADERS.test(s);
const isPageNumber = (s) => /^\d{1,3}$/.test(s.trim());
const BULLET = /^[••▪·o\-–]\s+/;

// The same bullet glyph, but allowing for the tags the rich extractor wraps
// it in. The character class comes from BULLET itself so the two cannot
// drift apart, and the opening tags are put back rather than dropped —
// dropping them left a closing tag with nothing to close.
const BULLET_CLASS = BULLET.source.slice(BULLET.source.indexOf('['), BULLET.source.indexOf(']') + 1);
const BULLET_HTML = new RegExp(`^((?:<[^>]+>\\s*)*)${BULLET_CLASS}\\s*`);
const stripBullet = (html) => dropEmptyTags(String(html).replace(BULLET_HTML, '$1'));

// Letters only, in capitals. Used to compare a contents entry with the heading
// it points at: the PDF loses spaces between words at random ("PURPOSEOF THIS
// TRAINING COURSE"), so anything that counts spaces cannot match the two up.
const letterKey = (s) => String(s).replace(/[^A-Za-z]/g, '').toUpperCase();

// Is this line set in capitals, the way every heading in these books is?
function isShouted(line) {
    const letters = String(line).replace(/[^A-Za-z]/g, '');
    if (letters.length < 3) return false;
    return letters.replace(/[^A-Z]/g, '').length / letters.length >= 0.6;
}

/**
 * The titles listed on a book's CONTENTS page, in order.
 *
 * The Introduction book does not number its headings, so there is nothing for
 * HEADING to match. It does print a contents page with dot leaders, and those
 * entries are the headings — following the book's own table of contents is far
 * safer than guessing which capitalised line is a title, because these books
 * also set chart names ("TREAT THE CHILD") in capitals on a line of their own.
 *
 * @param {Array<{page:number, lines:string[]}>} pages
 * @returns {string[]}
 */
export function findContents(pages) {
    const out = [];
    let found = 0;
    for (const pg of pages || []) {
        const lines = (pg.lines || []).map((l) => String(l).trim());
        lines.forEach((line, i) => {
            if (!isTocLine(line)) return;
            // Strip the leaders and the page number they run into.
            let title = line.split(LEADERS)[0].trim().replace(/\s*\d{1,3}$/, '').trim();
            // A long entry wraps, leaving the first half on the line above with
            // no leaders of its own: "HOW TO SELECT THE APPROPRIATE CASE" then
            // "MANAGEMENT CHARTS.........6".
            const above = lines[i - 1];
            if (above && !isTocLine(above) && isShouted(above) && !/^CONTENTS$/i.test(above)) {
                title = `${above} ${title}`.trim();
            }
            if (letterKey(title).length >= 4) out.push(title.replace(/\s+/g, ' '));
        });
        if (out.length) { found = pg.page; break; }   // one contents page is enough
    }
    return { titles: out, page: found };
}

/** The contents titles alone, for callers that do not care which page they were on. */
export const contentsTitles = (pages) => findContents(pages).titles;

export function looksLikeHeading(line) {
    // "9 .1 CHECK ..." reaches us with the number split across two text items,
    // which would otherwise file the section under "9".
    const joined = String(line).replace(/^(\d+)\s+\.\s*(\d+)/, '$1.$2');
    const m = joined.match(HEADING);
    if (!m || isTocLine(joined)) return null;

    const title = m[2].trim();
    const letters = title.replace(/[^A-Za-z]/g, '');
    if (letters.length < 3) return null;

    // Headings in these books are set in capitals. Body text that happens to
    // open with a number ("2.5 ml of syrup") is not, and this is what keeps it
    // out.
    const upper = title.replace(/[^A-Z]/g, '').length;
    if (upper / Math.max(1, letters.length) < 0.6) return null;

    return { number: m[1], title };
}

/**
 * @param {Array<{page:number, lines:string[]}>} pages
 * @returns {{sections: Array, warnings: string[], firstContentPage: number}}
 */
export function parsePdfIntoSections(pages) {
    const warnings = [];
    if (!Array.isArray(pages) || pages.length === 0) {
        return { sections: [], warnings: ['The file produced no text. It may be a scan rather than a text PDF.'], firstContentPage: 1 };
    }

    // Everything before a bare INTRODUCTION is cover, credits and contents.
    // Matching it loosely picks up the contents entry instead, and the whole
    // table of contents then arrives as sections.
    let firstContentPage = pages[0].page;
    const intro = pages.find((pg) => pg.lines.some((l) => /^INTRODUCTION$/i.test(String(l).trim())));
    if (intro) firstContentPage = intro.page;
    else warnings.push('No INTRODUCTION page was found, so the contents pages may appear as sections.');

    // Books with numbered headings are split on those. The Introduction book has
    // none, so its contents page supplies the headings instead, and they are
    // numbered 1, 2, 3 ... here so a section still has a stable number to show.
    const numbered = pages.some((pg) => (pg.lines || []).some((l) => looksLikeHeading(l)));
    const found = numbered ? { titles: [], page: 0 } : findContents(pages);
    const contents = found.titles;
    if (!numbered) {
        if (contents.length) {
            warnings.push(`This book does not number its headings, so its ${contents.length} topics were taken from the contents page.`);
            // Reading must start AFTER the contents page. The Introduction book
            // prints the word INTRODUCTION on its cover, so the usual rule put
            // the cover and the contents inside the first topic — and the
            // contents entries themselves were then read as headings.
            firstContentPage = Math.max(firstContentPage, found.page + 1);
        } else {
            warnings.push('No numbered headings and no contents page were found, so the book could not be split.');
        }
    }

    // Compared on a prefix, not in full: the contents page and the heading it
    // points at disagree in these books ("THEC APPROPRIATE" against "THE
    // APPROPRIATE"), and a typo in one of them should not lose a whole topic.
    const CONTENTS_PREFIX = 12;
    const contentsKeys = contents.map((t) => letterKey(t));
    const matchesContents = (line) => {
        if (!isShouted(line)) return -1;
        const key = letterKey(line);
        if (key.length < 4) return -1;
        return contentsKeys.findIndex((c) => {
            const n = Math.min(CONTENTS_PREFIX, c.length, key.length);
            return n >= 4 && c.slice(0, n) === key.slice(0, n);
        });
    };
    const usedContents = new Set();

    const sections = [];
    let current = null;

    // A figure is attached to the section the page ENDS in, not the one it
    // started in. On a page that opens a new section the heading sits at the
    // top, so the figure below it belongs to the new section — attaching it
    // before the lines were read put it in the previous one, which is how a
    // diagram from "CLASSIFY DIARRHOEA" ended up under "ASSESS DIARRHOEA".
    //
    // Exactly placing a figure between two paragraphs would mean carrying the y
    // of every text line through the parser. A figure landing at the foot of
    // the right section is a much smaller problem than that complexity.
    let imageIndex = 0;

    pages.filter((pg) => pg.page >= firstContentPage).forEach(({ page, lines, rich, images }) => {
        // The book's own formatting, where the extractor was able to read it.
        // Without it — the unit tests feed plain strings — everything below
        // falls back to plain paragraphs, which is what it always produced.
        const styled = Array.isArray(rich) && rich.length === (lines || []).length ? rich : null;
        let lastY = null;

        (lines || []).forEach((raw, lineIndex) => {
            const line = String(raw).trim();
            const fmt = styled ? styled[lineIndex] : null;
            if (!line || isPageNumber(line) || isTocLine(line)) return;

            // An unnumbered book: the line is a heading when the contents page
            // names it, and only the first time, so a title repeated in the
            // body does not start the same section twice.
            let h = looksLikeHeading(line);
            if (!h && contents.length) {
                const at = matchesContents(line);
                if (at >= 0 && !usedContents.has(at)) {
                    usedContents.add(at);
                    h = { number: String(sections.length + 1), title: contents[at] };
                }
            }
            if (h) {
                current = {
                    number: h.number,
                    title: h.title,
                    level: h.number.split('.').length,
                    startPage: page,
                    endPage: page,
                    // Text goes to Read, pictures to See. The books put a
                    // classification chart and the prose explaining it on the
                    // same page, and a learner wants them side by side, not
                    // interleaved.
                    read: [],
                    see: [],
                    practise: [],
                };
                sections.push(current);
                return;
            }
            if (!current) return;
            current.endPage = page;

            // A gap noticeably bigger than the line spacing is a paragraph
            // break the book expressed with white space rather than a marker.
            const brokeByGap = !!fmt && lastY !== null && (lastY - fmt.y) > fmt.size * 1.8;
            if (fmt) lastY = fmt.y;

            if (BULLET.test(line)) {
                const text = line.replace(BULLET, '').trim();
                const html = fmt ? stripBullet(fmt.html) : null;
                const last = current.read[current.read.length - 1];
                if (last && last.type === 'list') {
                    last.items.push(text);
                    if (last.html) last.html.push(html || escapeHtml(text));
                } else {
                    current.read.push({
                        type: 'list', items: [text],
                        html: styled ? [html || escapeHtml(text)] : null,
                        // Where the item's TEXT starts, not the bullet. A line
                        // that wraps is indented to here; the paragraph after
                        // the list goes back to the margin.
                        indent: fmt ? fmt.x : null,
                    });
                }
                return;
            }

            const last = current.read[current.read.length - 1];

            // A bullet that runs onto a second line has no marker on that line,
            // so it arrived as a paragraph of its own: the list said "needs
            // urgent attention and referral or admission for inpatient" and the
            // word "care." began a new paragraph underneath it.
            //
            // Only attempted when the layout was actually read. Judging it from
            // the words alone swallowed the paragraph that FOLLOWED a list
            // whose last bullet happened to end without a full stop, which is
            // how "Refer the child urgently." ended up inside a danger sign.
            const lastItem = last?.type === 'list' ? last.items[last.items.length - 1] : null;
            const wrapsTheBullet = lastItem && fmt && last.indent !== null
                && !brokeByGap
                && fmt.x >= last.indent - 2
                && !/[.:;?!]$/.test(lastItem);
            if (wrapsTheBullet) {
                last.items[last.items.length - 1] += ` ${line}`;
                if (last.html) {
                    last.html[last.html.length - 1] += ` ${fmt ? fmt.html : escapeHtml(line)}`;
                }
                return;
            }

            // PDFs break a sentence across lines with no marker, so a line that
            // continues an unfinished paragraph is joined to it rather than
            // starting a new one — unless the white space says otherwise.
            const continues = last && last.type === 'paragraph'
                && !brokeByGap
                && !/[.:;?!]$/.test(last.plain);

            if (continues) {
                last.plain += ` ${line}`;
                if (last.html !== null) last.html += ` ${fmt ? fmt.html : escapeHtml(line)}`;
            } else {
                current.read.push({
                    type: 'paragraph',
                    plain: line,
                    html: styled ? (fmt ? fmt.html : escapeHtml(line)) : null,
                });
            }
        });

        (images || []).forEach((img) => {
            if (current) {
                current.see.push({
                    type: 'image', imageIndex, page,
                    width: img.width, height: img.height,
                });
            }
            imageIndex += 1;
        });
    });

    if (contents.length) {
        const missed = contents.filter((_, i) => !usedContents.has(i));
        if (missed.length) {
            warnings.push(`${missed.length} topic(s) on the contents page were not found in the text: ${missed.join(', ')}.`);
        }
    }

    // A section whose text was read with its formatting becomes rich blocks; one
    // read as plain strings stays exactly as it was, which is what keeps the
    // parser testable without a PDF.
    sections.forEach((sec) => {
        sec.read = sec.read.map((b) => {
            if (b.type === 'paragraph') {
                return b.html !== null
                    ? { type: 'rich', text: `<p>${b.html}</p>` }
                    : { type: 'paragraph', text: b.plain };
            }
            if (b.type === 'list') {
                return b.html
                    ? { type: 'rich', text: `<ul>${b.html.map((i) => `<li>${i}</li>`).join('')}</ul>` }
                    : { type: 'list', items: b.items };
            }
            return b;
        });
    });

    const seen = new Map();
    sections.forEach((s) => {
        if (seen.has(s.number)) {
            warnings.push(`The book uses the number ${s.number} twice — "${seen.get(s.number)}" and "${s.title}". Kept as printed.`);
        } else {
            seen.set(s.number, s.title);
        }
    });

    const thin = sections.filter((s) => countWords(s) < 20);
    if (thin.length) {
        warnings.push(`${thin.length} section(s) have almost no text (${thin.map((s) => s.number).join(', ')}). These are usually headings that introduce their subsections.`);
    }

    const imageBlocks = sections.reduce((n, sec) =>
        n + sec.see.filter((b) => b.type === 'image').length, 0);

    return { sections, warnings, firstContentPage, imageCount: imageBlocks };
}

// The three ways a learner meets a section: read it, see it, practise it.
// There was a fourth, Test, and it is gone — a separate bank of questions after
// the practice was answering the same thing twice, and the cases teach more
// than a quiz does. Anything already written into a Test tab is shown under
// Practise (see tabContent) rather than deleted.
export const SECTION_TABS = [
    { id: 'read', label: 'Read', labelAr: 'اقرأ', hint: 'The text of the module' },
    { id: 'see', label: 'See', labelAr: 'شاهد', hint: 'Charts, figures and video' },
    { id: 'practise', label: 'Practise', labelAr: 'تدرب', hint: 'Cases, exercises and questions' },
];

// Content written before the tabs existed lives in `blocks`. It is read as the
// Read tab rather than migrated, so nothing has to be rewritten in the database
// and an older section keeps working untouched. The retired Test tab is folded
// into Practise for the same reason: no content written before today is lost
// because the tabs changed under it.
export function tabContent(section, tab) {
    if (!section) return [];
    if (tab === 'read') return section.read || section.blocks || [];
    if (tab === 'practise') return [...(section.practise || []), ...(section.test || [])];
    return section[tab] || [];
}

export function countWords(section) {
    const all = [
        ...(section.read || section.blocks || []),
        ...(section.see || []),
        ...(section.practise || []),
        ...(section.test || []),
    ];
    return all.reduce((n, b) => {
        if (b.type === 'list') return n + b.items.join(' ').split(/\s+/).filter(Boolean).length;
        if (b.type === 'image' || b.type === 'page' || b.type === 'video') return n;
        // Tags are stripped first: once text is written in the rich editor,
        // counting the raw string counts <strong> as a word.
        const words = String(b.text || '').replace(/<[^>]*>/g, ' ');
        return n + words.split(/\s+/).filter(Boolean).length;
    }, 0);
}

// What a block can be. `table`, `image` and `page` are extracted or authored,
// `video`, `question`, `case` and `exercise` are written by hand, and the rest
// come straight from the book's prose.
export const BLOCK_TYPES = [
    'heading', 'paragraph', 'rich', 'list', 'image', 'page', 'video',
    'table', 'note', 'question', 'exercise',
];

// Which block types hold text the author writes, as opposed to something they
// assemble from fields. These are the ones edited in place, in the rich editor.
export const TEXT_BLOCKS = ['paragraph', 'rich', 'heading', 'note'];

/**
 * A block's text as HTML, ready for the rich editor.
 *
 * The converter produces plain paragraphs and `items` lists, because that is
 * all a PDF gives it. The editor works in HTML, so a list is turned into one
 * the first time somebody edits it and is saved back as rich text from then on
 * — converted on demand rather than in a migration, so a book converted last
 * week is not rewritten by a deploy.
 */
export function blockHtml(block) {
    if (!block) return '';
    if (block.type === 'list') {
        const items = (block.items || []).map((i) => `<li>${escapeHtml(i)}</li>`).join('');
        return items ? `<ul>${items}</ul>` : '';
    }
    const text = String(block.text || '');
    // The TYPE says whether this is HTML, not the contents. Guessing by looking
    // for a tag escaped text that merely contained an ampersand, saved the
    // escaped form, and escaped it again next time — so "WHO & UNICEF" drifted
    // to "WHO &amp;amp; UNICEF", a little worse on every visit to the editor.
    return block.type === 'rich' ? text : escapeHtml(text);
}

const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------------------
// Keeping the book's formatting
//
// The books carry meaning in their typography: a heading is 14pt bold, a
// lead-in is bold italic, and "a classification in the pink row" has `pink row`
// set in bold in the middle of the sentence. Extracting the characters and
// throwing the rest away lost all of that, and an author then had to put it
// back by hand on every paragraph of a 95-page book.
//
// pdfjs gives the real font name — "Times New Roman,Bold" — but only through
// page.commonObjs, and only after getOperatorList() has run. It also renumbers
// the font ids depending on which call happens first, so the operator list is
// always fetched BEFORE the text content; read the other way round, the ids in
// the text items do not match the ones in commonObjs and every run comes back
// as regular.
// ---------------------------------------------------------------------------

/** Bold and italic, read from the embedded font's own name. */
export function fontStyle(name) {
    const n = String(name || '');
    return {
        bold: /bold|black|heavy|semibold|[-,]bd\b/i.test(n),
        italic: /italic|oblique|[-,]it\b/i.test(n),
        mono: /mono|courier/i.test(n),
    };
}

const escapeAttr = (s) => String(s).replace(/"/g, '&quot;');

/**
 * One visual line as HTML, with its runs kept apart where they differ.
 *
 * Size is written relative to the page's body size rather than in points, so
 * the text stays readable when the learner zooms: a 14pt heading in a 12pt book
 * becomes 1.17em, not a fixed size that ignores the reading controls.
 *
 * @param {Array<{str,x,size,bold,italic,mono}>} runs  in reading order
 * @param {number} bodySize  the most common size on the page
 */
export function richLine(runs, bodySize) {
    const parts = [];
    let open = null;
    let buffer = '';

    const sameStyle = (a, b) => a && b
        && a.bold === b.bold && a.italic === b.italic && a.mono === b.mono
        && Math.abs(a.size - b.size) < 0.6;

    const flush = () => {
        // \uE000-\uF8FF is the private use area: a symbol font's own glyph
        // codes, which mean nothing as text and render as a blank or a box.
        if (!open || !buffer.replace(/[\uE000-\uF8FF]/g, '').trim()) { buffer = ''; return; }
        let html = escapeHtml(buffer).replace(/\s+/g, ' ');
        if (open.bold) html = `<strong>${html}</strong>`;
        if (open.italic) html = `<em>${html}</em>`;
        const ratio = bodySize > 0 ? open.size / bodySize : 1;
        // Only a difference worth seeing is written out. Every run carrying its
        // own font-size, including the ones that match the body, produced HTML
        // that was mostly span tags.
        if (ratio > 1.08 || ratio < 0.92) {
            html = `<span style="font-size: ${escapeAttr(ratio.toFixed(2))}em">${html}</span>`;
        }
        if (open.mono) html = `<span style="font-family: ui-monospace, monospace">${html}</span>`;
        parts.push(html);
        buffer = '';
    };

    runs.forEach((run) => {
        if (!sameStyle(open, run)) {
            flush();
            // The space BETWEEN two differently-styled runs has to be emitted
            // between the tags, not inside them. Without this, "listed on the"
            // and a bold "ASSESS & CLASSIFY" ran together into
            // "the<strong>ASSESS" and the words were joined on screen.
            if (parts.length && run.gap && !/\s$/.test(run.str)) parts.push(' ');
            open = run;
        }
        // A gap wider than a space means the PDF positioned the next run rather
        // than writing a space, so one is put back.
        const needsSpace = buffer && !/\s$/.test(buffer) && !/^\s/.test(run.str);
        buffer += (needsSpace && run.gap ? ' ' : '') + run.str;
    });
    flush();

    return dropEmptyTags(parts.join('').trim());
}

// Tags left wrapping nothing.
//
// A bullet in these books is often the letter "o" set in Wingdings, which is
// why BULLET matches it. Stripping the glyph leaves the span that carried its
// font behind with nothing inside — "<span style=...></span>" in front of every
// list item. Runs of private-use characters, which are symbol fonts with no
// Unicode meaning at all, leave the same hole.
export function dropEmptyTags(html) {
    let out = String(html);
    let before;
    do {
        before = out;
        out = out.replace(/<(strong|em|span)\b[^>]*>\s*<\/\1>/g, '');
    } while (out !== before);
    return out.replace(/\s{2,}/g, ' ').trim();
}

// The size most of the page is set in. Used as the baseline everything else is
// measured against, so a book set in 10pt and one set in 12pt both come out
// looking like themselves.
function commonSize(items) {
    const tally = new Map();
    items.forEach((it) => {
        if (!it.str.trim()) return;
        const k = Math.round(it.size * 2) / 2;
        tally.set(k, (tally.get(k) || 0) + it.str.trim().length);
    });
    let best = 12;
    let most = 0;
    tally.forEach((n, size) => { if (n > most) { most = n; best = size; } });
    return best;
}


// A multiple-choice question. `answer` is the index of the correct option, so
// reordering the options in the editor cannot silently change which one is
// right — the index moves with them.
export const newQuestion = () => ({
    type: 'question', text: '', options: ['', ''], answer: 0, explanation: '',
});

// A practice case, shaped like the ones in Online Exercises: the scenario is
// given as separate statements rather than one paragraph, because that is how
// a health worker meets a child — history, then signs, one at a time — and the
// learning points are what they should carry to the next child.
export const newCase = () => ({
    type: 'case', title: '', narrative: [''], questions: [newQuestion()], learningPoints: [],
});

// A pointer to a real, graded exercise in Online Exercises. The section does
// not copy the case: it names it, so a correction made to the exercise is the
// one the learner meets here too.
export const newExerciseLink = () => ({ type: 'exercise', exerciseId: '', note: '' });

/**
 * Turns whatever someone pasted for a video into something an <iframe> can
 * show. YouTube and Vimeo watch links are the two that get pasted; anything
 * else is handed back untouched and played as a file.
 * @returns {{kind: 'embed'|'file', src: string}|null}
 */
export function videoSource(url) {
    const raw = String(url || '').trim();
    if (!raw) return null;
    const yt = raw.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/);
    if (yt) return { kind: 'embed', src: `https://www.youtube.com/embed/${yt[1]}` };
    const vimeo = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeo) return { kind: 'embed', src: `https://player.vimeo.com/video/${vimeo[1]}` };
    return { kind: 'file', src: raw };
}

// A classification table row is coloured with the SAME vocabulary the protocol
// engine and the exercises use, so a pink row in a course book means exactly
// what a pink classification means at the bedside. Previously each module had
// its own spelling of these three colours.
export { IMNCI_SEVERITIES, severityById } from '../constants';

/**
 * Reads a PDF in the browser and returns its text, one entry per page, with
 * items grouped into visual lines by their y position.
 *
 * @param {File} file
 * @param {(p:{page:number,total:number,phase:string})=>void} [onProgress]
 *        Reported per phase, because decoding the figures on a page can take
 *        far longer than reading its text and a bar that only counted pages
 *        looked frozen.
 * @param {boolean} [withImages] also decode the embedded images. Off by
 *        default because it needs a canvas per image and is much slower.
 */
async function loadPdfjs() {
    const pdfjs = await import('pdfjs-dist');
    // Vite resolves this to a real asset URL at build time; without it pdfjs
    // tries to fetch a worker from a path that does not exist in the bundle.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    return pdfjs;
}

export async function extractPdfPages(file, onProgress, withImages = false) {
    const pdfjs = await loadPdfjs();

    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjs.getDocument({ data }).promise;

    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
        if (onProgress) onProgress({ page: p, total: doc.numPages, phase: 'text' });
        const page = await doc.getPage(p);

        // BEFORE getTextContent, always: this is what puts the real font names
        // in commonObjs, and calling it the other way round renumbers the font
        // ids so nothing resolves.
        let ops = null;
        try { ops = await page.getOperatorList(); } catch (e) {
            console.warn(`Could not read the fonts on page ${p}:`, e?.message);
        }

        const content = await page.getTextContent();
        const fontName = (id) => {
            try {
                return page.commonObjs.has(id) ? (page.commonObjs.get(id)?.name || '') : '';
            } catch { return ''; }
        };

        const styled = content.items
            .filter((it) => it.str)
            .map((it) => {
                const { bold, italic, mono } = fontStyle(fontName(it.fontName));
                return {
                    str: it.str,
                    x: it.transform[4],
                    y: it.transform[5],
                    width: it.width || 0,
                    size: Math.abs(it.transform[0]) || it.height || 12,
                    bold, italic, mono,
                };
            });

        const bodySize = commonSize(styled);

        const byLine = new Map();
        styled.forEach((it) => {
            if (!it.str.trim()) return;
            const y = Math.round(it.y);
            if (!byLine.has(y)) byLine.set(y, []);
            byLine.get(y).push(it);
        });

        const ordered = [...byLine.entries()].sort((a, b) => b[0] - a[0]);
        const lines = [];
        const rich = [];
        ordered.forEach(([y, parts]) => {
            const runs = parts.sort((a, b) => a.x - b.x);
            // A run that starts further right than the previous one ended was
            // positioned, not spaced, so a space is put back between them.
            runs.forEach((r, i) => {
                const prev = runs[i - 1];
                r.gap = !prev || (r.x - (prev.x + prev.width)) > prev.size * 0.12;
            });
            const plain = runs.map((q) => q.str).join(' ').replace(/\s+/g, ' ').trim();
            if (!plain) return;
            lines.push(plain);
            rich.push({
                html: richLine(runs, bodySize),
                y,
                x: runs[0].x,
                size: Math.max(...runs.map((r) => r.size)),
                bold: runs.every((r) => r.bold),
                bodySize,
            });
        });

        let images = [];
        if (withImages) {
            if (onProgress) onProgress({ page: p, total: doc.numPages, phase: 'figures' });
            images = await extractPageImages(pdfjs, page, ops);
        }
        pages.push({ page: p, lines, rich, images });
    }
    return pages;
}

/**
 * Decodes the raster images painted on one page.
 *
 * The y position is tracked through save/restore/transform so an image can be
 * placed back among the paragraphs it sat between, rather than all of them
 * being dumped at the end of the section.
 */
// Renders whole pages to images.
//
// This is how the classification charts survive. They are drawn as vector
// paths — roughly 7,800 of them in module 2 — so their cell text extracts but
// the grid and the colour do not, and in IMNCI the colour is the clinical
// meaning. Rebuilding every one of them by hand is not realistic, so the page
// is captured as it was printed and shown on the See tab, with the extracted
// prose still on Read.
//
// A picture of a page is a poor substitute for text and is deliberately NOT
// how the Read tab works. It is a faithful record of a chart, nothing more.
export async function renderPdfPages(file, pageNumbers, scale = 2) {
    const pdfjs = await loadPdfjs();
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjs.getDocument({ data }).promise;

    const out = [];
    for (const n of pageNumbers) {
        if (n < 1 || n > doc.numPages) continue;
        const page = await doc.getPage(n);
        // 2x so the chart is still legible when a learner zooms in on a phone.
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        if (blob) out.push({ page: n, blob, width: canvas.width, height: canvas.height });
    }
    return out;
}

// Fetching a decoded image out of pdfjs, without the two ways it can hang.
//
// `objs.get(name, cb)` queues the callback and only fires it once that object
// resolves. An image that lives in commonObjs instead — pdfjs names those with
// a "g_" prefix, which is how the grouped figures in these books are stored —
// is never in page.objs at all, so the callback is queued against something
// that will never arrive and the conversion stops dead. Module 2 hangs on page
// 12 for exactly this reason.
//
// So: look in both stores, and never wait forever for either.
const OBJECT_TIMEOUT_MS = 5000;

function getImageObject(page, name) {
    const store = String(name).startsWith('g_') ? page.commonObjs : page.objs;

    return new Promise((resolve) => {
        let settled = false;
        const done = (v) => { if (!settled) { settled = true; resolve(v); } };

        // A figure that cannot be decoded costs one image, not the whole book.
        const timer = setTimeout(() => done(null), OBJECT_TIMEOUT_MS);
        const finish = (v) => { clearTimeout(timer); done(v); };

        try {
            // has() is synchronous and tells us whether get() would block.
            if (typeof store.has === 'function' && store.has(name)) {
                finish(store.get(name));
                return;
            }
            store.get(name, finish);
        } catch {
            finish(null);
        }
    });
}

async function extractPageImages(pdfjs, page, prefetched = null) {
    const { OPS } = pdfjs;
    // Reused when the caller already has it. Fetching the operator list twice
    // for the same page is the slowest thing in a conversion.
    const ops = prefetched || await page.getOperatorList();
    const viewport = page.getViewport({ scale: 1 });

    let ctm = [1, 0, 0, 1, 0, 0];
    const stack = [];
    const mul = (a, b) => [
        a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
        a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
        a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
    ];

    const found = [];
    for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const args = ops.argsArray[i];
        if (fn === OPS.save) stack.push(ctm.slice());
        else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
        else if (fn === OPS.transform) ctm = mul(ctm, args);
        else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
            found.push({ name: args[0], y: viewport.height - ctm[5] });
        }
    }
    if (found.length === 0) return [];

    const out = [];
    for (const { name, y } of found) {
        try {
            const img = await getImageObject(page, name);
            if (!img?.width || !img?.height) continue;

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            const data = img.data;

            if (img.bitmap) {
                ctx.drawImage(img.bitmap, 0, 0);
            } else if (data) {
                const rgba = new Uint8ClampedArray(img.width * img.height * 4);
                const channels = data.length / (img.width * img.height);
                for (let px = 0; px < img.width * img.height; px++) {
                    if (channels === 3) {
                        rgba[px * 4] = data[px * 3];
                        rgba[px * 4 + 1] = data[px * 3 + 1];
                        rgba[px * 4 + 2] = data[px * 3 + 2];
                    } else {
                        rgba[px * 4] = data[px * channels];
                        rgba[px * 4 + 1] = data[px * channels + 1] ?? data[px * channels];
                        rgba[px * 4 + 2] = data[px * channels + 2] ?? data[px * channels];
                    }
                    rgba[px * 4 + 3] = 255;
                }
                ctx.putImageData(new ImageData(rgba, img.width, img.height), 0, 0);
            } else continue;

            const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
            // Anything this small is a rule, a bullet or a border, not a figure.
            if (blob && img.width > 60 && img.height > 60) {
                out.push({ name, y, width: img.width, height: img.height, blob });
            }
        } catch {
            // A single undecodable image must not lose the other 23.
        }
    }
    return out;
}
