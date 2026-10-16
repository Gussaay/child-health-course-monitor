// "Recently opened" on the main menu: the last few pages someone visited,
// kept on this device per signed-in account.

import { pagePath } from './pageAddress';

const MAX_KEPT = 6;
const storageKey = (uid) => `chm.recent.${uid}`;

/** One key per place: the same course page opened twice is one entry. */
export function recentKey(page) {
    const { path } = pagePath(page);
    return [path, page.course || '', page.facilitator || '', page.participant || '', page.type || ''].join('|');
}

/** Puts `entry` first, drops an older copy of the same page, keeps the newest few. */
export function addRecent(list, entry, max = MAX_KEPT) {
    const key = recentKey(entry.page);
    const rest = (Array.isArray(list) ? list : []).filter((e) => e?.page && recentKey(e.page) !== key);
    return [{ ...entry, key }, ...rest].slice(0, max);
}

export function loadRecent(uid) {
    if (!uid) return [];
    try {
        const list = JSON.parse(window.localStorage.getItem(storageKey(uid)) || '[]');
        return Array.isArray(list) ? list.filter((e) => e?.page?.view) : [];
    } catch {
        return [];
    }
}

export function saveRecent(uid, list) {
    if (!uid) return;
    try { window.localStorage.setItem(storageKey(uid), JSON.stringify(list)); } catch { /* storage full or blocked */ }
}
