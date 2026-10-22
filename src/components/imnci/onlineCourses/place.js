// src/components/imnci/onlineCourses/place.js
//
// Where the learner is inside Online Courses, kept in the address:
//   /online-courses?oc=<course>&mod=<module>&sec=<section>&tab=see
//   /online-courses?oc=<course>&book=<book>
//
// So a refresh reopens the section they were reading, a link can be shared,
// and the browser's and the phone's back step out one level at a time instead
// of leaving the page. App.jsx owns the path and its own keys (course,
// participant, ...) and leaves these alone while the page is on screen.
import { useCallback, useEffect, useRef, useState } from 'react';

const KEYS = { course: 'oc', module: 'mod', section: 'sec', tab: 'tab', book: 'book' };
const EMPTY = { course: null, module: null, section: null, tab: 'read', book: null };

/** The place written in an address's query string. */
export function placeFromSearch(search) {
    const params = new URLSearchParams(search || '');
    const place = { ...EMPTY };
    Object.entries(KEYS).forEach(([k, key]) => { const v = params.get(key); if (v) place[k] = v; });
    // A module or section without its course, or a section without its
    // module, cannot be shown; the address is read only as far as it holds.
    if (!place.course) return { ...EMPTY };
    if (!place.module) place.section = null;
    if (!['read', 'see', 'practise'].includes(place.tab)) place.tab = 'read';
    return place;
}

/** The query string for a place, keeping any other keys already in `search`. */
export function searchForPlace(place, search = '') {
    const params = new URLSearchParams(search);
    Object.values(KEYS).forEach((key) => params.delete(key));
    if (place.course) params.set(KEYS.course, place.course);
    if (place.course && place.book) params.set(KEYS.book, place.book);
    else if (place.course && place.module) {
        params.set(KEYS.module, place.module);
        if (place.section) {
            params.set(KEYS.section, place.section);
            if (place.tab && place.tab !== 'read') params.set(KEYS.tab, place.tab);
        }
    }
    return params.toString();
}

/** How many levels in: 0 the course list, 1 a course, 2 a module or a book, 3 a section. */
export const placeDepth = (p) => (!p.course ? 0 : p.book ? 2 : !p.module ? 1 : !p.section ? 2 : 3);

/** The place one level out. */
export function placeUp(p) {
    // A section outside any module was opened from the course page.
    if (p.section) return { ...p, section: null, tab: 'read', module: p.module === '__none__' ? null : p.module };
    if (p.book) return { ...p, book: null };
    if (p.module) return { ...p, module: null };
    return { ...EMPTY };
}

/**
 * [place, go, back]
 * go(next): moves to `next` (a whole place or a patch). Going deeper adds a
 *   history entry; a change at the same level (another section, another tab)
 *   replaces the current one, so back is not a list of every tab looked at.
 * back(): one level out, through history when this page added the entry.
 */
export function useCoursePlace() {
    const [place, setPlaceState] = useState(() => placeFromSearch(window.location.search));
    // The address is written outside the state updater, which React may run
    // twice; the ref is the place as last written.
    const current = useRef(place);
    const setPlace = useCallback((next) => { current.current = next; setPlaceState(next); }, []);

    useEffect(() => {
        const onPop = () => setPlace(placeFromSearch(window.location.search));
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, [setPlace]);

    // `ocPushed` marks a history entry this page added by going in, so that
    // back can step out through history; the entry the page was opened on,
    // or one reached by stepping out without history, does not carry it.
    const write = useCallback((next, how) => {
        const url = new URL(window.location.href);
        url.search = searchForPlace(next, url.search);
        const state = window.history.state || {};
        if (how === 'push') {
            window.history.pushState({ ...state, chmIdx: (state.chmIdx || 0) + 1, ocPushed: true }, '', url);
        } else {
            window.history.replaceState({ ...state, ocPushed: how === 'keep' ? !!state.ocPushed : false }, '', url);
        }
    }, []);

    const go = useCallback((patch) => {
        const cur = current.current;
        const next = { ...EMPTY, ...cur, ...patch };
        const deeper = placeDepth(next) > placeDepth(cur);
        write(next, deeper ? 'push' : placeDepth(next) === placeDepth(cur) ? 'keep' : 'up');
        setPlace(next);
    }, [write, setPlace]);

    const back = useCallback(() => {
        if (window.history.state?.ocPushed) {
            window.history.back();
            return;
        }
        const next = placeUp(current.current);
        write(next, 'up');
        setPlace(next);
    }, [write, setPlace]);

    return [place, go, back];
}
