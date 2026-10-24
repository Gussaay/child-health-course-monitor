// src/utils/aiChats.js
//
// "Ask the data" conversations, one per page, kept on this device so a page
// shows what was asked on it before. A convenience only: when storage is
// blocked or full the panel still works, it just starts empty.

const KEY = (uid) => `askData.chats.v1.${uid || 'anon'}`;
const MAX_PAGES = 15;
const MAX_MESSAGES = 30;
// An answer this recent is reused when the same question is asked again on
// the same page; older ones are asked afresh, since the data may have changed.
export const REUSE_MS = 60 * 60 * 1000;

export function loadChats(uid) {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY(uid)) || '{}');
        return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    } catch {
        return {};
    }
}

/** Only the newest pages and messages are kept; failed answers are not. */
export function trimChats(chats) {
    const pages = Object.entries(chats || {})
        .map(([view, list]) => [view, (Array.isArray(list) ? list : []).filter((m) => !m.failed).slice(-MAX_MESSAGES)])
        .filter(([, list]) => list.length)
        .sort((a, b) => (b[1].at(-1)?.at || 0) - (a[1].at(-1)?.at || 0))
        .slice(0, MAX_PAGES);
    return Object.fromEntries(pages);
}

export function saveChats(uid, chats) {
    try { localStorage.setItem(KEY(uid), JSON.stringify(trimChats(chats))); } catch { /* storage blocked or full */ }
}

const same = (a, b) => String(a || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[?؟.!]+$/, '')
    === String(b || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[?؟.!]+$/, '');

/** The latest answer on this page to the same question, if it is recent enough. */
export function savedAnswer(messages, question, now = Date.now()) {
    for (let i = (messages || []).length - 1; i > 0; i--) {
        const m = messages[i];
        if (m.role !== 'assistant' || m.failed || m.cached || !m.at || now - m.at > REUSE_MS) continue;
        if (messages[i - 1]?.role === 'user' && same(messages[i - 1].content, question)) return m;
    }
    return null;
}
