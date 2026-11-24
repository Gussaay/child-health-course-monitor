// Child Health Library usage: the pure counting behind the library dashboard.
// No Firebase here, so it can be tested.
//
// An event is one document in `libraryEvents` (see libraryTracking.js):
//   { type: 'visit' | 'view' | 'open' | 'share', itemId, itemName, service,
//     category, at, deviceId, signedIn, uid, email, name, role, state,
//     locality, entry: 'app' | 'link', platform, tz, lang, ref }
// 'open' is a download / open of the content itself.

export const EVENT_TYPES = ['visit', 'view', 'open', 'share'];

// Where a public visitor is, from the device's time zone: no location is
// asked for, so this is the country the device's clock is set to.
const TZ_COUNTRY = {
    'Africa/Khartoum': 'Sudan', 'Africa/Juba': 'South Sudan', 'Africa/Cairo': 'Egypt', 'Africa/Tripoli': 'Libya',
    'Africa/Ndjamena': 'Chad', 'Africa/Addis_Ababa': 'Ethiopia', 'Africa/Asmara': 'Eritrea', 'Africa/Nairobi': 'Kenya',
    'Africa/Kampala': 'Uganda', 'Africa/Dar_es_Salaam': 'Tanzania', 'Africa/Bangui': 'Central African Republic',
    'Africa/Djibouti': 'Djibouti', 'Africa/Mogadishu': 'Somalia', 'Africa/Lagos': 'Nigeria', 'Africa/Johannesburg': 'South Africa',
    'Africa/Casablanca': 'Morocco', 'Africa/Tunis': 'Tunisia', 'Africa/Algiers': 'Algeria', 'Africa/Kigali': 'Rwanda',
    'Asia/Riyadh': 'Saudi Arabia', 'Asia/Dubai': 'United Arab Emirates', 'Asia/Qatar': 'Qatar', 'Asia/Kuwait': 'Kuwait',
    'Asia/Bahrain': 'Bahrain', 'Asia/Muscat': 'Oman', 'Asia/Aden': 'Yemen', 'Asia/Amman': 'Jordan', 'Asia/Beirut': 'Lebanon',
    'Asia/Damascus': 'Syria', 'Asia/Baghdad': 'Iraq', 'Asia/Istanbul': 'Turkey', 'Europe/Istanbul': 'Turkey', 'Asia/Tehran': 'Iran',
    'Asia/Karachi': 'Pakistan', 'Asia/Kolkata': 'India', 'Asia/Calcutta': 'India', 'Asia/Dhaka': 'Bangladesh',
    'Asia/Kuala_Lumpur': 'Malaysia', 'Asia/Singapore': 'Singapore', 'Asia/Shanghai': 'China', 'Asia/Tokyo': 'Japan',
    'Europe/London': 'United Kingdom', 'Europe/Dublin': 'Ireland', 'Europe/Paris': 'France', 'Europe/Berlin': 'Germany',
    'Europe/Amsterdam': 'Netherlands', 'Europe/Brussels': 'Belgium', 'Europe/Zurich': 'Switzerland', 'Europe/Geneva': 'Switzerland',
    'Europe/Rome': 'Italy', 'Europe/Madrid': 'Spain', 'Europe/Stockholm': 'Sweden', 'Europe/Oslo': 'Norway', 'Europe/Copenhagen': 'Denmark',
    'Europe/Vienna': 'Austria', 'Europe/Moscow': 'Russia',
    'America/New_York': 'United States', 'America/Chicago': 'United States', 'America/Denver': 'United States',
    'America/Los_Angeles': 'United States', 'America/Phoenix': 'United States', 'America/Toronto': 'Canada',
    'America/Vancouver': 'Canada', 'Australia/Sydney': 'Australia', 'Australia/Melbourne': 'Australia', 'Australia/Perth': 'Australia',
};

export function countryFromTimeZone(tz) {
    if (!tz) return 'Unknown';
    if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
    const city = String(tz).split('/').pop().replace(/_/g, ' ');
    return city ? `Other (${city})` : 'Unknown';
}

export function eventMillis(at) {
    if (!at) return 0;
    if (typeof at.toMillis === 'function') return at.toMillis();
    if (typeof at.seconds === 'number') return at.seconds * 1000;
    const n = new Date(at).getTime();
    return Number.isFinite(n) ? n : 0;
}

// The person behind an event: a signed-in user's account, else the device.
export const personKey = (e) => (e.uid ? `u:${e.uid}` : `d:${e.deviceId || '?'}`);

const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Events inside a filter: { from, to (ms), service, category, audience: 'all'|'signedIn'|'public' }. */
export function filterEvents(events, { from = 0, to = Infinity, service = '', category = '', audience = 'all' } = {}) {
    return (events || []).filter((e) => {
        const ms = eventMillis(e.at);
        if (ms && (ms < from || ms > to)) return false;
        if (service && e.service !== service) return false;
        if (category && e.category !== category) return false;
        if (audience === 'signedIn' && !e.signedIn) return false;
        if (audience === 'public' && e.signedIn) return false;
        return true;
    });
}

/** Counts of `type` events grouped by `keyOf(event)`, largest first: [{ key, count, people }]. */
export function groupCount(events, keyOf, type = 'open') {
    const map = new Map();
    events.forEach((e) => {
        if (type && e.type !== type) return;
        const key = keyOf(e) || 'Unknown';
        const row = map.get(key) || { key, count: 0, people: new Set() };
        row.count += 1;
        row.people.add(personKey(e));
        map.set(key, row);
    });
    return [...map.values()]
        .map((r) => ({ key: r.key, count: r.count, people: r.people.size }))
        .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
}

/** One row per item: downloads, unique downloaders, views, shares and the last download. */
export function itemTable(events, items = []) {
    const rows = new Map();
    const ensure = (id, e) => {
        if (!rows.has(id)) {
            const it = items.find((x) => x.id === id);
            rows.set(id, {
                itemId: id, name: it?.name || e?.itemName || '(removed item)', service: it?.service || e?.service || '',
                category: it?.category || e?.category || '', opens: 0, views: 0, shares: 0, people: new Set(), lastOpen: 0, removed: !it,
            });
        }
        return rows.get(id);
    };
    items.forEach((it) => ensure(it.id));
    events.forEach((e) => {
        if (!e.itemId) return;
        const r = ensure(e.itemId, e);
        if (e.type === 'open') { r.opens += 1; r.people.add(personKey(e)); r.lastOpen = Math.max(r.lastOpen, eventMillis(e.at)); }
        else if (e.type === 'view') r.views += 1;
        else if (e.type === 'share') r.shares += 1;
    });
    return [...rows.values()]
        .map(({ people, ...r }) => ({ ...r, uniqueOpeners: people.size }))
        .sort((a, b) => b.opens - a.opens || b.views - a.views || a.name.localeCompare(b.name));
}

/** One row per person: who downloaded, how much and what last. */
export function peopleTable(events) {
    const rows = new Map();
    events.forEach((e) => {
        if (e.type !== 'open' && e.type !== 'share') return;
        const key = personKey(e);
        const r = rows.get(key) || {
            key, signedIn: !!e.signedIn, name: e.name || '', email: e.email || '', role: e.role || '',
            state: e.state || '', locality: e.locality || '', country: countryFromTimeZone(e.tz), platform: e.platform || '',
            opens: 0, shares: 0, items: new Set(), last: 0, lastItem: '',
        };
        if (e.type === 'open') { r.opens += 1; r.items.add(e.itemId); }
        else r.shares += 1;
        const ms = eventMillis(e.at);
        if (ms >= r.last) { r.last = ms; if (e.type === 'open') r.lastItem = e.itemName || r.lastItem; }
        rows.set(key, r);
    });
    return [...rows.values()]
        .map(({ items, ...r }) => ({ ...r, distinctItems: items.size }))
        .sort((a, b) => b.opens - a.opens || b.last - a.last);
}

/** Daily counts of each event type from `from` to `to` (ms), for the trend chart. */
export function dailySeries(events, from, to) {
    const end = Math.min(to, Date.now());
    const start = from > 0 ? from : Math.min(end, ...events.map((e) => eventMillis(e.at)).filter(Boolean));
    const days = [];
    for (let t = new Date(dayKey(start)).getTime(); t <= end && days.length < 400; t += 86400000) days.push(dayKey(t));
    const series = Object.fromEntries(EVENT_TYPES.map((type) => [type, Object.fromEntries(days.map((d) => [d, 0]))]));
    events.forEach((e) => {
        const ms = eventMillis(e.at);
        if (!ms || !series[e.type]) return;
        const d = dayKey(ms);
        if (d in series[e.type]) series[e.type][d] += 1;
    });
    return { days, series: Object.fromEntries(EVENT_TYPES.map((type) => [type, days.map((d) => series[type][d])])) };
}

/** The headline numbers. `prev` is the same filter over the period before, for the change arrows. */
export function kpis(events, items = []) {
    const opens = events.filter((e) => e.type === 'open');
    const people = new Set(events.map(personKey));
    const openers = new Set(opens.map(personKey));
    const signedInOpeners = new Set(opens.filter((e) => e.signedIn).map(personKey));
    const countries = new Set(events.filter((e) => !e.signedIn).map((e) => countryFromTimeZone(e.tz)));
    const states = new Set(events.filter((e) => e.state).map((e) => e.state));
    const downloadedItems = new Set(opens.map((e) => e.itemId));
    const visits = events.filter((e) => e.type === 'visit' || e.type === 'view').length;
    return {
        downloads: opens.length,
        uniqueDownloaders: openers.size,
        signedInDownloaders: signedInOpeners.size,
        publicDownloaders: openers.size - signedInOpeners.size,
        visitors: people.size,
        visits,
        shares: events.filter((e) => e.type === 'share').length,
        items: items.length,
        itemsDownloaded: downloadedItems.size,
        itemsNeverDownloaded: items.filter((it) => !downloadedItems.has(it.id)).length,
        conversion: visits ? Math.round((opens.length / visits) * 100) : 0,
        perDownloader: openers.size ? Math.round((opens.length / openers.size) * 10) / 10 : 0,
        countries: countries.size,
        states: states.size,
        viaSharedLink: opens.filter((e) => e.entry === 'link').length,
    };
}

/** % change from `before` to `now`; null when there is nothing to compare with. */
export function change(now, before) {
    if (!before) return now ? null : 0;
    return Math.round(((now - before) / before) * 100);
}
