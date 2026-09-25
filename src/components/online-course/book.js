// src/components/online-course/book.js
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

    pages.filter((pg) => pg.page >= firstContentPage).forEach(({ page, lines, images }) => {
        (lines || []).forEach((raw) => {
            const line = String(raw).trim();
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

            if (BULLET.test(line)) {
                const text = line.replace(BULLET, '').trim();
                const last = current.read[current.read.length - 1];
                if (last && last.type === 'list') last.items.push(text);
                else current.read.push({ type: 'list', items: [text] });
                return;
            }

            const last = current.read[current.read.length - 1];
            // PDFs break a sentence across lines with no marker, so a line that
            // continues an unfinished paragraph is joined to it rather than
            // starting a new one.
            if (last && last.type === 'paragraph' && !/[.:;?!]$/.test(last.text)) {
                last.text += ' ' + line;
            } else {
                current.read.push({ type: 'paragraph', text: line });
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
        if (b.type === 'image') return n;
        return n + String(b.text || '').split(/\s+/).filter(Boolean).length;
    }, 0);
}

// What a block can be. `table`, `image` and `page` are extracted or authored,
// `video`, `question`, `case` and `exercise` are written by hand, and the rest
// come straight from the book's prose.
export const BLOCK_TYPES = [
    'heading', 'paragraph', 'list', 'image', 'page', 'video',
    'table', 'note', 'question', 'case', 'exercise',
];

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
        const content = await page.getTextContent();
        const byLine = new Map();
        content.items.forEach((it) => {
            if (!it.str || !it.str.trim()) return;
            const y = Math.round(it.transform[5]);
            if (!byLine.has(y)) byLine.set(y, []);
            byLine.get(y).push({ x: it.transform[4], s: it.str });
        });
        const lines = [...byLine.entries()]
            .sort((a, b) => b[0] - a[0])
            .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((q) => q.s).join(' ').replace(/\s+/g, ' ').trim())
            .filter(Boolean);
        let images = [];
        if (withImages) {
            if (onProgress) onProgress({ page: p, total: doc.numPages, phase: 'figures' });
            images = await extractPageImages(pdfjs, page);
        }
        pages.push({ page: p, lines, images });
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

async function extractPageImages(pdfjs, page) {
    const { OPS } = pdfjs;
    const ops = await page.getOperatorList();
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
