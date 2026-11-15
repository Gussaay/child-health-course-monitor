// src/components/imnci/onlineCourses/cardText.js
//
// The section editor writes an activity's list fields as plain lines, one item
// per line with its parts split by " | ", because that is quicker to type and
// to correct than a form row per item. These turn the lines into the block's
// fields and back. Pure functions, tested on their own.

const split = (line) => line.split('|').map((x) => x.trim());
const lines = (text) => String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);

/** "1:05" or "65" → 65 seconds. */
export function toSeconds(v) {
    const s = String(v ?? '').trim();
    if (!s) return 0;
    if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
    const parts = s.split(':').map(Number);
    if (parts.some((n) => Number.isNaN(n))) return 0;
    return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** 65 → "1:05". */
export const toClock = (sec) => {
    const n = Math.max(0, Math.floor(Number(sec) || 0));
    return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

// Options written on one line as "A ; *B ; C": the starred one is the answer.
export function parseOptions(text) {
    const parts = String(text || '').split(';').map((x) => x.trim()).filter(Boolean);
    const answer = Math.max(0, parts.findIndex((p) => p.startsWith('*')));
    return { options: parts.map((p) => p.replace(/^\*\s*/, '')), answer };
}
export const optionsText = (options = [], answer = 0) =>
    options.map((o, i) => (i === answer ? `*${o}` : o)).join(' ; ');

// Flip cards: "front | back".
export const cardsFromText = (text) => lines(text).map((l) => { const [front = '', back = ''] = split(l); return { front, back }; });
export const cardsToText = (cards = []) => cards.map((c) => `${c.front || ''} | ${c.back || ''}`).join('\n');

// Steps: "title | text".
export const stepsFromText = (text) => lines(text).map((l) => { const [title = '', ...rest] = split(l); return { title, text: rest.join(' | ') }; });
export const stepsToText = (steps = []) => steps.map((s) => (s.text ? `${s.title || ''} | ${s.text}` : s.title || '')).join('\n');

// Sort: groups "A, B, C"; items "text | group | why".
export const groupsFromText = (text) => String(text || '').split(',').map((g) => g.trim()).filter(Boolean);
export function sortItemsFromText(text, groups = []) {
    return lines(text).map((l) => {
        const [itemText = '', group = '', why = ''] = split(l);
        const gi = groups.findIndex((g) => g.toLowerCase() === group.toLowerCase());
        const item = { text: itemText, group: gi >= 0 ? gi : 0 };
        if (why) item.why = why;
        return item;
    });
}
export const sortItemsToText = (items = [], groups = []) =>
    items.map((it) => [it.text, groups[Number(it.group)] || '', it.why].filter((x, i) => i < 2 || x).join(' | ')).join('\n');

// Video chapters "1:05 | label" and stops "1:05 | question | A ; *B | why".
export const chaptersFromText = (text) => lines(text).map((l) => { const [at, label = ''] = split(l); return { at: toSeconds(at), label }; });
export const chaptersToText = (chapters = []) => chapters.map((c) => `${toClock(c.at)} | ${c.label || ''}`).join('\n');
export function stopsFromText(text) {
    return lines(text).map((l) => {
        const [at, q = '', opts = '', explanation = ''] = split(l);
        const { options, answer } = parseOptions(opts);
        return { at: toSeconds(at), text: q, options, answer, explanation };
    });
}
export const stopsToText = (stops = []) =>
    stops.map((s) => [toClock(s.at), s.text || '', optionsText(s.options, s.answer ?? 0), s.explanation || ''].join(' | ')).join('\n');
