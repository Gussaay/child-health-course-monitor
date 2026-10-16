// Page addresses for the signed-in app.
//
// The app switches pages with its own `view` state rather than a router, so
// everything used to live at `/`: the browser and Android back buttons left
// the app, refresh dropped you on the main menu, and no page could be opened
// in a new tab. App.jsx now writes the address below whenever the page
// changes and reads it back on back/forward and on start-up.
//
// Addresses must stay clear of the public links that are recognised by their
// path (/public, /monitor, /facilities, /verify, /mentorship, /attendance,
// /submit) and of the paths the server answers itself (/mcp, /oauth, /assets).

const VIEW_SLUGS = {
    landing: '',
    dashboard: 'dashboard',
    admin: 'admin',
    about: 'about',
    imciForm: 'imnci-protocol',
    childHealthServices: 'child-health-services',
    skillsMentorship: 'skills-mentorship',
    supplyManagement: 'supply',
    supervision: 'supervision',
    onlineCourses: 'online-courses',
    projects: 'projects',
    meetings: 'meetings',
    planning: 'planning',
    localityPlan: 'locality-plan',
    downloads: 'downloads',
    courseReport: 'course-report',
    participantReport: 'participant-report',
    facilitatorReport: 'facilitator-report',
    facilitatorForm: 'facilitator-form',
    finalReport: 'final-report',
    attendanceManager: 'attendance-manager',
    observe: 'observe',
    monitoring: 'observe',
};
const SLUG_VIEWS = Object.fromEntries(
    Object.entries(VIEW_SLUGS).filter(([view]) => view !== 'monitoring').map(([view, slug]) => [slug, view])
);

// Pages that hold half-entered data only in memory. Reopening one from an
// address would show an empty form, so it opens its parent page instead, and
// leaving one replaces its history entry rather than adding to it.
const TRANSIENT_PARENTS = {
    facilitatorForm: { view: 'humanResources', tab: 'facilitators' },
    finalReport: { view: 'courseReport' },
    'courses:add-course': { view: 'courses', tab: 'courses' },
    'courses:edit-course': { view: 'courses', tab: 'courses' },
    'courses:participant-form': { view: 'courses', tab: 'participants' },
};

// Query keys this module owns; anything else in the address belongs to the
// page itself (e.g. ?plan= on Master Plan) and is left alone.
export const OWN_KEYS = ['course', 'participant', 'facilitator', 'type'];

const transientKey = (page) => (page.view === 'courses' ? `courses:${page.tab}` : page.view);

export function isTransientPage(page) {
    return !!page && !!TRANSIENT_PARENTS[transientKey(page)];
}

/** The page to open for an address or history entry that may be a transient form. */
export function settlePage(page) {
    const parent = page && TRANSIENT_PARENTS[transientKey(page)];
    return parent ? { ...page, ...parent } : page;
}

/** Describes the current page from App state. */
export function describePage({ view, coursesTab, hrTab, courseId, participantId, facilitatorId, courseType }) {
    const page = { view };
    if (view === 'courses') page.tab = coursesTab || 'courses';
    if (view === 'humanResources') page.tab = hrTab || 'facilitators';
    if (courseId) page.course = courseId;
    if (participantId) page.participant = participantId;
    if (facilitatorId && ['facilitatorReport', 'facilitatorForm'].includes(view)) page.facilitator = facilitatorId;
    if (courseType) page.type = courseType;
    return page;
}

/** Path and own query for a page, e.g. /courses/participants?course=abc. */
export function pagePath(page) {
    let path;
    if (page.view === 'courses') path = page.tab && page.tab !== 'courses' ? `/courses/${page.tab}` : '/courses';
    else if (page.view === 'humanResources') path = page.tab && page.tab !== 'facilitators' ? `/human-resources/${page.tab}` : '/human-resources';
    else path = `/${VIEW_SLUGS[page.view] ?? ''}`;
    const params = new URLSearchParams();
    OWN_KEYS.forEach((key) => { if (page[key]) params.set(key, page[key]); });
    return { path, params };
}

/** Reads a page back from an address. Returns null for an address that is not an app page. */
export function pageFromLocation(pathname, search) {
    const parts = String(pathname || '/').split('/').filter(Boolean).map(decodeURIComponent);
    let page = null;
    if (parts.length === 0) page = { view: 'landing' };
    else if (parts[0] === 'courses' && parts.length <= 2) page = { view: 'courses', tab: parts[1] || 'courses' };
    else if (parts[0] === 'human-resources' && parts.length <= 2) page = { view: 'humanResources', tab: parts[1] || 'facilitators' };
    else if (parts.length === 1 && SLUG_VIEWS[parts[0]]) page = { view: SLUG_VIEWS[parts[0]] };
    if (!page) return null;
    const params = new URLSearchParams(search || '');
    OWN_KEYS.forEach((key) => { const v = params.get(key); if (v) page[key] = v; });
    return page;
}

/** True when two pages need separate history entries (a participant change alone does not). */
export function isNewEntry(a, b) {
    if (!a || !b) return true;
    const pa = pagePath(a).path;
    const pb = pagePath(b).path;
    return pa !== pb || (a.course || null) !== (b.course || null) || (a.type || null) !== (b.type || null) || (a.facilitator || null) !== (b.facilitator || null);
}
