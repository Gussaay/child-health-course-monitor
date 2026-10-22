// src/components/aiLibrary/bookText.js
//
// Turning a PDF into what the AI Library stores: the text of every page and
// the book's chapters. It runs in the browser of the manager adding the book,
// so the PDF itself is never uploaded anywhere; only its text is.
//
// Chapters come from the PDF's bookmarks when it has them (most manuals do).
// Each bookmark becomes a section that runs to the page before the next one
// at the same or a higher level. Without bookmarks the book starts with no
// chapters and the manager adds them by page range.

export const AI_SERVICES = ['IMNCI', 'ETAT', 'EENC', 'EmONC', 'SSNC', 'ICCM', 'IPC', 'General'];

// A Firestore document holds at most 1 MiB, and Arabic takes two bytes a
// character in UTF-8, so a page part stays well under half a million.
const PART_CHARS = 300000;

// Fewer readable pages than this share means the PDF is scanned images.
export const SCANNED_SHARE = 0.3;

const loadPdfjs = async () => {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    return pdfjs;
};

/** pdf.js text items of one page as readable text, keeping line breaks. */
export function pageText(items) {
    return items
        .map((it) => (it.str || '') + (it.hasEOL ? '\n' : ' '))
        .join('')
        .replace(/(\p{L})-\n(\p{L})/gu, '$1$2') // words hyphenated across lines
        .replace(/[ \t\u00a0]+/g, ' ')
        .replace(/ ?\n ?/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Bookmarks as flat sections, two levels deep:
 * [{ title, from, to, level }], from/to 1-based and inclusive.
 * `flat` is [{ title, page, level }] in reading order.
 */
export function sectionsFromOutline(flat, pageCount) {
    const items = flat
        .filter((o) => o.title && o.page >= 1 && o.page <= pageCount)
        .map((o) => ({ title: String(o.title).replace(/\s+/g, ' ').trim().slice(0, 200), from: o.page, level: o.level }));
    return items.map((it, i) => {
        const next = items.slice(i + 1).find((n) => n.level <= it.level);
        const to = next ? Math.max(it.from, next.from - 1) : pageCount;
        return { ...it, to };
    });
}

/** Pages packed into parts that each fit one Firestore document. */
export function packPages(pages) {
    const parts = [];
    let cur = null;
    pages.forEach((text, i) => {
        const t = String(text || '');
        if (!cur || (cur.size + t.length > PART_CHARS && cur.pages.length)) {
            cur = { from: i + 1, pages: [], size: 0 };
            parts.push(cur);
        }
        cur.pages.push(t.slice(0, PART_CHARS));
        cur.size += t.length;
    });
    return parts.map(({ from, pages: p }) => ({ from, to: from + p.length - 1, pages: p }));
}

/** Readable title from the file name: "IMCI_chart-booklet.pdf" -> "IMCI chart booklet". */
export const titleFromFile = (name) => String(name || '')
    .replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Reads a PDF File: { title, pages: [text], sections, textPages }.
 * `onProgress(done, total)` is called as pages are read.
 */
export async function readBook(file, onProgress = () => {}) {
    const pdfjs = await loadPdfjs();
    const data = new Uint8Array(await file.arrayBuffer());
    const task = pdfjs.getDocument({ data });
    const doc = await task.promise;
    try {
        const meta = await doc.getMetadata().catch(() => ({}));
        const pages = [];
        for (let p = 1; p <= doc.numPages; p++) {
            const page = await doc.getPage(p);
            const { items } = await page.getTextContent();
            pages.push(pageText(items));
            page.cleanup();
            if (p % 5 === 0 || p === doc.numPages) onProgress(p, doc.numPages);
        }

        const flat = [];
        const walk = async (nodes, level) => {
            for (const node of nodes || []) {
                let page = null;
                try {
                    const dest = typeof node.dest === 'string' ? await doc.getDestination(node.dest) : node.dest;
                    const ref = Array.isArray(dest) ? dest[0] : null;
                    if (typeof ref === 'number') page = ref + 1;
                    else if (ref) page = (await doc.getPageIndex(ref)) + 1;
                } catch { /* a bookmark to nowhere is skipped */ }
                if (page) flat.push({ title: node.title, page, level });
                if (level < 1) await walk(node.items, level + 1);
            }
        };
        await walk(await doc.getOutline().catch(() => null), 0);

        const pdfTitle = String(meta?.info?.Title || '').trim();
        return {
            title: (pdfTitle.length > 3 && !/^untitled|^microsoft word/i.test(pdfTitle) ? pdfTitle : titleFromFile(file.name)).slice(0, 200),
            pages,
            sections: sectionsFromOutline(flat, pages.length),
            textPages: pages.filter((t) => t.length >= 40).length,
        };
    } finally {
        await task.destroy();
    }
}

/** Keeps the sections a person typed sensible: titled, in range, in order. */
export function cleanSections(sections, pageCount) {
    return (sections || [])
        .map((s) => {
            const from = Math.max(1, Math.min(pageCount, parseInt(s.from, 10) || 1));
            const to = Math.max(from, Math.min(pageCount, parseInt(s.to, 10) || from));
            return { title: String(s.title || '').trim().slice(0, 200), from, to, level: s.level === 1 ? 1 : 0 };
        })
        .filter((s) => s.title)
        .sort((a, b) => a.from - b.from || a.level - b.level);
}

// The light markdown the AI writes, as blocks for safe rendering (never
// innerHTML): headings, bullets, numbered items and paragraphs, with **bold**
// and page citations like (p. 12) picked out inside each.
export function parseAiText(text) {
    const inline = (s) => {
        const out = [];
        const re = /\*\*(.+?)\*\*|(\((?:[^()]*?,\s*)?(?:p|pp|ص)\.\s*\d+(?:\s*[-–,]\s*\d+)*\))/g;
        let last = 0;
        let m;
        while ((m = re.exec(s))) {
            if (m.index > last) out.push({ text: s.slice(last, m.index) });
            if (m[1]) out.push({ text: m[1], bold: true });
            else out.push({ text: m[2], cite: true });
            last = re.lastIndex;
        }
        if (last < s.length) out.push({ text: s.slice(last) });
        return out;
    };
    return String(text || '').split(/\r?\n/).map((line) => line.trimEnd()).filter((l) => l.trim()).map((line) => {
        let m;
        if ((m = /^\s*#{1,6}\s+(.*)$/.exec(line))) return { type: 'h', parts: inline(m[1].replace(/\*\*/g, '')) };
        if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) return { type: 'hr', parts: [] };
        if ((m = /^(\s*)[-*•]\s+(.*)$/.exec(line))) return { type: 'li', depth: m[1].length >= 2 ? 1 : 0, parts: inline(m[2]) };
        if ((m = /^\s*(\d+)[.)]\s+(.*)$/.exec(line))) return { type: 'ol', n: m[1], parts: inline(m[2]) };
        return { type: 'p', parts: inline(line) };
    });
}

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The AI book import's text as course content blocks, the same kinds the
 * standard converter makes: headings, paragraphs and lists, with **bold**
 * kept as rich text. Numbered steps become an ordered list.
 */
export function aiTextToBlocks(text) {
    const blocks = [];
    let list = null;
    const html = (parts) => parts.map((p) => (p.bold ? `<strong>${escapeHtml(p.text)}</strong>` : escapeHtml(p.text))).join('');
    const hasBold = (parts) => parts.some((p) => p.bold);
    const plain = (parts) => parts.map((p) => p.text).join('');
    const flush = () => {
        if (!list) return;
        const rich = list.items.some(hasBold) || list.ordered;
        const tag = list.ordered ? 'ol' : 'ul';
        blocks.push(rich
            ? { type: 'rich', text: `<${tag}>${list.items.map((it) => `<li>${html(it)}</li>`).join('')}</${tag}>` }
            : { type: 'list', items: list.items.map(plain) });
        list = null;
    };
    for (const b of parseAiText(text)) {
        if (b.type === 'li' || b.type === 'ol') {
            const ordered = b.type === 'ol';
            if (list && list.ordered !== ordered) flush();
            if (!list) list = { ordered, items: [] };
            list.items.push(b.parts);
            continue;
        }
        flush();
        if (b.type === 'hr') continue;
        if (b.type === 'h') blocks.push({ type: 'heading', text: plain(b.parts) });
        else if (hasBold(b.parts)) blocks.push({ type: 'rich', text: `<p>${html(b.parts)}</p>` });
        else blocks.push({ type: 'paragraph', text: plain(b.parts) });
    }
    flush();
    return blocks;
}
