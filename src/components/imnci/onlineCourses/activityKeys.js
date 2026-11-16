// src/components/imnci/onlineCourses/activityKeys.js
//
// Which blocks of a lesson are activities, and the key each one is known by.
// Kept apart from the blocks themselves so the module page can count a
// lesson's activities without loading everything that draws them.
import { isActivity } from '../book';

// An activity is known by its content, not its place in the section, so a
// block an author inserts or moves later does not inherit another activity's
// "done". Two identical blocks are told apart by a running count.
const hash = (str) => {
    let h = 5381;
    for (let i = 0; i < str.length; i += 1) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
    return h.toString(36);
};
const counts = (b) => isActivity(b) && !(b.type === 'video' && !b.url);
/** The key of every block (null for one that is not an activity), in order. */
export function activityKeyList(blocks = []) {
    const seen = {};
    return blocks.map((b) => {
        if (!counts(b)) return null;
        const base = `${b.type}-${hash(JSON.stringify(b))}`;
        seen[base] = (seen[base] || 0) + 1;
        return seen[base] > 1 ? `${base}-${seen[base]}` : base;
    });
}
const plain = (v) => String(v || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
/**
 * The activities of a lesson, in order, for the lesson's own checklist:
 * [{ key, type, label }]. The label is what the author called the activity,
 * or the start of its question.
 */
export function activityOutline(blocks = []) {
    const keys = activityKeyList(blocks);
    return blocks.map((b, i) => (keys[i] === null ? null : {
        key: keys[i], type: b.type,
        label: plain(b.title || b.text || b.caption || b.note).slice(0, 90),
    })).filter(Boolean);
}
/** The element id ContentBlocks gives an activity, so the checklist can scroll to it. */
export const activityAnchor = (key) => `activity-${key}`;
/** Activities in a list of blocks, by the keys ContentBlocks gives them. */
export const activityKeys = (blocks = []) => activityKeyList(blocks).filter((k) => k !== null);

