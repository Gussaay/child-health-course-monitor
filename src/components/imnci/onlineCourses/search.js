// src/components/imnci/onlineCourses/search.js
//
// Finding a sign, a dose or a classification across a course's sections. Runs
// on the sections already on the device, so it works offline and costs no
// reads. Plain word matching: every word typed must appear in the section,
// and a match in the title counts for more than one in the text.
import { tabContent } from '../book';

// Text of one block, tags and entities stripped.
function blockText(b) {
    if (!b) return '';
    if (b.type === 'list') return (b.items || []).join('\n');
    if (b.type === 'table') return (b.rows || []).map((r) => (r.cells || []).join(' ')).join('\n');
    if (b.type === 'question') return [b.text, ...(b.options || []), b.explanation].filter(Boolean).join('\n');
    if (b.type === 'image' || b.type === 'page' || b.type === 'video' || b.type === 'exercise') return b.caption || '';
    return String(b.text || '')
        .replace(/<(br|\/p|\/li|\/h\d|\/tr)\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

/** Everything readable in a section, Read then See then Practise. */
export function sectionText(section) {
    return ['read', 'see', 'practise']
        .flatMap((tab) => tabContent(section, tab).map(blockText))
        .join('\n')
        .replace(/[ \t]+/g, ' ');
}

// Lower case, Arabic letter forms folded (أ إ آ -> ا, ة -> ه, ى -> ي) and
// diacritics dropped, so a search finds the word however it was typed.
export const fold = (s) => String(s || '').toLowerCase()
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

const words = (q) => fold(q).split(/[^\p{L}\p{N}.]+/u).filter((w) => w.length >= 2);

/**
 * Sections matching `q`, best first: [{ section, snippet, score }].
 * `snippet` is the line of text around the first match, for showing in a list.
 */
export function searchSections(sections, q, limit = 30) {
    const terms = words(q);
    if (!terms.length) return [];
    const out = [];
    for (const section of sections) {
        const title = fold(section.title);
        const raw = sectionText(section);
        const body = fold(raw);
        if (!terms.every((w) => title.includes(w) || body.includes(w))) continue;
        let score = 0;
        for (const w of terms) {
            if (title.includes(w)) score += 10;
            score += Math.min(5, body.split(w).length - 1);
        }
        // The snippet is cut from the original text at the folded match. The
        // folding keeps lengths for Latin text; for Arabic, dropped diacritics
        // can shift it a little, which only moves the window.
        const at = body.indexOf(terms[0]);
        let snippet = '';
        if (at >= 0) {
            const start = Math.max(0, raw.lastIndexOf('\n', at) + 1, at - 80);
            const endLine = raw.indexOf('\n', at);
            const end = Math.min(endLine < 0 ? raw.length : endLine, at + 120);
            snippet = (start > 0 && raw[start - 1] !== '\n' ? '…' : '') + raw.slice(start, end).trim() + (end < raw.length && raw[end] !== '\n' ? '…' : '');
        }
        out.push({ section, snippet, score });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

// Reading speed for the time estimates. Lower than the usual 200-250 words a
// minute: the text is clinical, often read in a second language, and the
// learner is meant to stop at the charts.
const WORDS_PER_MINUTE = 150;

/**
 * Minutes a section takes: its words at reading speed, plus two minutes for
 * each video and each linked practice case. At least one for a section with
 * anything in it, so no section claims to take no time.
 */
export function readingMinutes(section) {
    const text = sectionText(section);
    const words = (text.match(/[\p{L}\p{N}]+/gu) || []).length;
    const extras = ['see', 'practise']
        .flatMap((tab) => tabContent(section, tab))
        .filter((b) => (b.type === 'video' && b.url) || b.type === 'exercise').length;
    const minutes = words / WORDS_PER_MINUTE + extras * 2;
    return minutes > 0 ? Math.max(1, Math.round(minutes)) : 0;
}
