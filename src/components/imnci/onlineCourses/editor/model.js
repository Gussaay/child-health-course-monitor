// src/components/imnci/onlineCourses/editor/model.js
//
// A lesson's saved blocks as the editor's list of elements, and back. Pure
// functions, tested on their own.
//
// The saved shape is unchanged: a list of blocks, the same ones the learner's
// lesson is drawn from. The only difference is that a run of text blocks
// (paragraphs, headings, lists) becomes one "Text" element while it is edited,
// and is saved back as one rich-text block, which is what the old editor did
// too. Activities keep their place, so learners' progress still matches them.
import { blockHtml } from '../../book';
import { isTextBlock } from './elements';

const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** One text block as HTML. */
export function textHtml(b) {
    if (b.type === 'rich') return String(b.text || '');
    if (b.type === 'heading') return `<h3>${escapeHtml(b.text)}</h3>`;
    if (b.type === 'list') return blockHtml(b);
    return String(b.text || '').trim() ? `<p>${escapeHtml(b.text)}</p>` : '';
}

let seq = 0;
const key = () => `e${(seq += 1)}`;

/** Saved blocks → the editor's elements, each with a `_k` key. */
export function toElements(content = []) {
    const out = [];
    (content || []).forEach((b) => {
        if (!b) return;
        if (isTextBlock(b)) {
            const html = textHtml(b);
            const last = out[out.length - 1];
            if (last && last.type === 'rich' && last._merge) last.text = [last.text, html].filter(Boolean).join('\n');
            else out.push({ type: 'rich', text: html, _k: key(), _merge: true });
            return;
        }
        out.push({ ...JSON.parse(JSON.stringify(b)), _k: key() });
    });
    return out.map(({ _merge, ...rest }) => rest);
}

/** A new element with its key. */
export const withKey = (b) => ({ ...JSON.parse(JSON.stringify(b)), _k: key() });

// Editor-only fields (`_k`, `_multi`) and empty values are not saved.
function clean(v) {
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === 'object') {
        const out = {};
        Object.entries(v).forEach(([k, x]) => {
            if (k.startsWith('_') || x === undefined) return;
            out[k] = clean(x);
        });
        return out;
    }
    return v;
}

const words = (html) => String(html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

/** Whether an element would show nothing to a learner and can be left out. */
export function isEmptyElement(b) {
    if (b.type === 'rich') return !words(b.text) && !/<img|<table/i.test(b.text || '');
    if (b.type === 'video') return !String(b.url || b.title || '').trim();
    if (b.type === 'note') return !String(b.text || '').trim();
    return false;
}

/** The editor's elements → the blocks to save. */
export function fromElements(elements = []) {
    return elements.filter((b) => !isEmptyElement(b)).map(clean);
}

/**
 * What stops a lesson being saved: the first element a learner could not use,
 * with its place in the list. Null when everything is fine.
 */
export function findProblem(elements = []) {
    for (let i = 0; i < elements.length; i += 1) {
        const b = elements[i];
        if (isEmptyElement(b)) continue;
        const opts = (b.options || []).filter((o) => String(o).trim());
        if (b.type === 'question' && opts.length < 2) return { index: i, reason: 'two_answers' };
        if (b.type === 'question' && !String(b.text || '').trim()) return { index: i, reason: 'question_text' };
        if (b.type === 'exercise' && !b.exerciseId) return { index: i, reason: 'choose_case' };
        if (b.type === 'booklet' && !(b.categories || []).length) return { index: i, reason: 'choose_tables' };
        if (b.type === 'flip' && !(b.cards || []).some((c) => String(c.front || '').trim())) return { index: i, reason: 'empty_cards' };
    }
    return null;
}

/** Where each lesson part ends: after every activity except the last element. */
export function partBreaks(elements = [], isActivity) {
    const after = new Set();
    elements.forEach((b, i) => {
        if (i < elements.length - 1 && isActivity(b) && !(b.type === 'video' && !b.url)) after.add(i);
    });
    return after;
}
