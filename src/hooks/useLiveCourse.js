// hooks/useLiveCourse.js
// Keeps the open course's details (App.jsx courseDetailsCache) current while
// it is on screen: participants, pre/post test scores, and monitoring cases
// with their observations (clinical monitoring and operational guide
// exercises). A change entered on any device shows here within seconds.
//
// Cost: each listener asks the server only for this course's records changed
// after a server-time mark kept on this device (data.js
// subscribeCourseRecords). Opening a course again costs nothing if nothing
// changed; each record another device adds or edits costs one read. The first
// time a device opens a course (no mark yet) it reads the course once in full,
// as a normal open already did.
//
// Listeners run only while signed in, online and with the app on screen, and
// close when the course is left. A listener the server refuses (index not
// built yet, rules) is dropped for this session and onFallback runs once, so
// the page still gets one full server read.
import { useEffect, useRef, useState } from 'react';
import { startLiveCourse } from './liveCourseCore.js';

// True while the app is on screen and the device is online.
const isActive = () => (typeof document === 'undefined' || document.visibilityState !== 'hidden') && (typeof navigator === 'undefined' || navigator.onLine !== false);
function useAppActive() {
    const [active, setActive] = useState(isActive);
    useEffect(() => {
        const update = () => setActive(isActive());
        const events = [[document, 'visibilitychange'], [window, 'online'], [window, 'offline']];
        events.forEach(([t, e]) => t.addEventListener(e, update));
        return () => events.forEach(([t, e]) => t.removeEventListener(e, update));
    }, []);
    return active;
}

const FIELDS = ['participants', 'participantTests', 'allCases', 'allObs'];

export function useLiveCourseDetails({ courseId, details, user, setCourseDetailsCache }) {
    const active = useAppActive();
    const detailsRef = useRef(details);
    detailsRef.current = details;
    // Which lists are loaded, so the effect re-runs only when one is loaded,
    // not on every change inside one.
    const loaded = FIELDS.filter((f) => Array.isArray(details?.[f])).join(',');

    useEffect(() => {
        if (!courseId || !user || !active || !loaded) return undefined;
        const stop = startLiveCourse({ courseId, base: detailsRef.current, loaded, setCourseDetailsCache });
        return () => stop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId, user, active, loaded]);
}

// Rendered by App.jsx (lazy, so none of this is in the first-load bundle).
export default function LiveCourseSync(props) {
    useLiveCourseDetails(props);
    return null;
}
