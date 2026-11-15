// src/training/trainingRows.js
// Pure helpers for the training link (no Firebase), shared by the gate, the
// activity recorder and the course's Training tab, and unit-tested.

// Field names inside the counter maps.
export const counterKey = (name) => String(name || 'other').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 60) || 'other';

/** Turns one write report from the Firestore wrapper into log lines and counters. */
export function activityFromWrite({ kind, targets }) {
    const byCollection = new Map();
    for (const t of targets) {
        const row = byCollection.get(t.collection) || { count: 0, docId: t.docId };
        row.count += 1;
        byCollection.set(t.collection, row);
    }
    const entries = [];
    const counters = { [kind === 'delete' ? 'deletes' : 'saves']: 0 };
    for (const [collection, { count, docId }] of byCollection) {
        entries.push({ kind, collection, docId: count === 1 ? docId : null, count });
        counters[kind === 'delete' ? 'deletes' : 'saves'] += count;
        counters[`collections.${counterKey(collection)}`] = (counters[`collections.${counterKey(collection)}`] || 0) + count;
    }
    return { entries, counters };
}


export const norm = (v) => String(v || '').trim().toLowerCase();
export const digits = (v) => String(v || '').replace(/\D/g, '').slice(-9);

export function suggestParticipant(participants, user) {
    const email = norm(user?.email);
    if (email) {
        const byEmail = participants.find((p) => norm(p.email) === email);
        if (byEmail) return byEmail;
    }
    const phone = digits(user?.phoneNumber);
    if (phone.length === 9) {
        const byPhone = participants.find((p) => digits(p.phone) === phone);
        if (byPhone) return byPhone;
    }
    const name = norm(user?.displayName);
    if (name) return participants.find((p) => norm(p.name) === name) || null;
    return null;
}


export const toDate = (v) => (v && typeof v.toDate === 'function' ? v.toDate() : v instanceof Date ? v : null);
const sumValues = (o) => Object.values(o || {}).reduce((a, b) => a + (Number(b) || 0), 0);
export const topEntries = (o, n = 4) => Object.entries(o || {}).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).slice(0, n);

/**
 * One row per course participant (linked or not) plus one per account that
 * practised without picking a participant. Exported for tests.
 */
export function buildTrainingRows(participants, trainees) {
    const byParticipant = new Map();
    const guests = [];
    for (const t of trainees) {
        if (t.participantId) {
            const list = byParticipant.get(t.participantId) || [];
            list.push(t);
            byParticipant.set(t.participantId, list);
        } else {
            guests.push(t);
        }
    }
    const merge = (accounts) => {
        const views = {};
        const collections = {};
        let saves = 0;
        let deletes = 0;
        let firstSeen = null;
        let lastSeen = null;
        for (const a of accounts) {
            for (const [k, c] of Object.entries(a.views || {})) views[k] = (views[k] || 0) + c;
            for (const [k, c] of Object.entries(a.collections || {})) collections[k] = (collections[k] || 0) + c;
            saves += Number(a.saves) || 0;
            deletes += Number(a.deletes) || 0;
            const f = toDate(a.firstSeen) || toDate(a.linkedAt);
            const l = toDate(a.lastSeen);
            if (f && (!firstSeen || f < firstSeen)) firstSeen = f;
            if (l && (!lastSeen || l > lastSeen)) lastSeen = l;
        }
        return { accounts, views, collections, saves, deletes, firstSeen, lastSeen, screens: sumValues(views) };
    };
    const rows = participants.map((p) => ({
        key: `p:${p.id}`,
        participantId: p.id,
        name: p.name || '',
        phone: p.phone || '',
        ...merge(byParticipant.get(p.id) || []),
    }));
    // A trainee linked to a participant who was later removed still shows.
    const known = new Set(participants.map((p) => p.id));
    for (const [pid, accounts] of byParticipant) {
        if (!known.has(pid)) rows.push({ key: `p:${pid}`, participantId: pid, name: accounts[0].participantName || '', phone: '', ...merge(accounts) });
    }
    for (const g of guests) {
        rows.push({ key: `g:${g.uid}`, participantId: null, name: g.displayName || g.email || '', guest: true, phone: '', ...merge([g]) });
    }
    return rows.sort((a, b) => (b.lastSeen?.getTime() || 0) - (a.lastSeen?.getTime() || 0) || a.name.localeCompare(b.name));
}


/**
 * The participant this account can be linked to without asking: the one it
 * was linked to before (saved on the participant record), or the only
 * participant registered with the same e-mail or phone number. Name matches
 * are only suggested, never linked automatically.
 * Returns { participant, method } or null.
 */
export function autoLinkParticipant(participants, user) {
    if (!user) return null;
    const saved = participants.find((p) => p.trainingLink?.uid && p.trainingLink.uid === user.uid);
    if (saved) return { participant: saved, method: 'saved' };
    const email = norm(user.email);
    if (email) {
        const matches = participants.filter((p) => norm(p.email) === email);
        if (matches.length === 1) return { participant: matches[0], method: 'email' };
    }
    const phone = digits(user.phoneNumber);
    if (phone.length === 9) {
        const matches = participants.filter((p) => digits(p.phone) === phone);
        if (matches.length === 1) return { participant: matches[0], method: 'phone' };
    }
    return null;
}
