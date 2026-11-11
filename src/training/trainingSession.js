// src/training/trainingSession.js
//
// TRAINING (PRACTICE) MODE
//
// A course's share modal can hand out a training link:
//     https://<site>/training/<courseId>
// Whoever opens it gets the full app, but everything they save goes into a
// sandbox under trainingSandboxes/<courseId>/… instead of the real
// collections (see firestoreShim.js), and the link only works between the
// course's start and end dates (course.training.startsAt / endsAt, stamped
// when the link is shared). After that the app shows "this link was for
// training and has expired".
//
// This module decides, once at start-up and before any Firestore reference is
// made, whether this tab is in training mode. The choice is kept in
// sessionStorage so it survives the app rewriting the address bar and page
// reloads, but never leaks into another tab or a later visit.

export const TRAINING_PATH = /^\/training\/([A-Za-z0-9_-]{1,128})\/?$/;
export const SANDBOX_ROOT = 'trainingSandboxes';
const STORAGE_KEY = 'chm_training_course';

function readCourseId() {
    if (typeof window === 'undefined') return null;
    try {
        const match = TRAINING_PATH.exec(window.location.pathname);
        if (match) {
            sessionStorage.setItem(STORAGE_KEY, match[1]);
            // The app routes by address; start it on its home page.
            window.history.replaceState(null, '', '/');
            return match[1];
        }
        return sessionStorage.getItem(STORAGE_KEY) || null;
    } catch {
        return null;
    }
}

const COURSE_ID = readCourseId();

// Form drafts and visit counters the screens keep on the device. In training
// mode they get their own keys, so a practice draft never turns up (and gets
// submitted) in the real app later, and practice visits never bump the real
// visit numbers on this phone.
export const DEVICE_KEYS_TO_SEPARATE = /^(offline_visit_max_|courseFormDraft:|mentorshipActiveVisitSession$)/;
export const trainingKey = (courseId, key) => `training_${courseId}_${key}`;

function separateDeviceKeys(courseId) {
    if (!courseId || typeof Storage === 'undefined') return;
    const proto = Storage.prototype;
    if (proto.__trainingWrapped) return;
    const map = (key) => (typeof key === 'string' && DEVICE_KEYS_TO_SEPARATE.test(key) ? trainingKey(courseId, key) : key);
    const { getItem, setItem, removeItem } = proto;
    proto.getItem = function (key) { return getItem.call(this, map(key)); };
    proto.setItem = function (key, value) { return setItem.call(this, map(key), value); };
    proto.removeItem = function (key) { return removeItem.call(this, map(key)); };
    proto.__trainingWrapped = true;
}

separateDeviceKeys(COURSE_ID);

/** The course this tab practises in, or null in the normal app. */
export function trainingCourseId() {
    return COURSE_ID;
}

export function isTrainingMode() {
    return !!COURSE_ID;
}

/** Leaves training mode and opens the normal app. */
export function exitTraining() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* storage blocked */ }
    window.location.replace('/');
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The practice window for a course: from midnight (device time) on its start
 * date to midnight after its last day, the same period the app already treats
 * as "course is running" (start_date + course_duration days).
 * Returns null when the course has no usable dates.
 */
export function courseTrainingWindow(course) {
    if (!course?.start_date) return null;
    const days = Number(course.course_duration);
    if (!Number.isFinite(days) || days <= 0) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(course.start_date));
    if (!m) return null;
    const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + Math.round(days) * DAY_MS);
    // Keep local midnight across a daylight-saving change.
    end.setHours(0, 0, 0, 0);
    return { start, end };
}

const toMillis = (v) => {
    if (!v) return NaN;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v instanceof Date) return v.getTime();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    return new Date(v).getTime();
};

/**
 * Where a training link stands right now, from the course document:
 * 'disabled' (never shared or switched off), 'not_started', 'open' or 'expired'.
 */
export function trainingStatus(course, now = Date.now()) {
    const t = course?.training;
    if (!course || course.isDeleted || !t || t.enabled !== true) return 'disabled';
    const start = toMillis(t.startsAt);
    const end = toMillis(t.endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return 'disabled';
    if (now < start) return 'not_started';
    if (now >= end) return 'expired';
    return 'open';
}

export function trainingEndsAt(course) {
    const end = toMillis(course?.training?.endsAt);
    return Number.isFinite(end) ? new Date(end) : null;
}

export function trainingStartsAt(course) {
    const start = toMillis(course?.training?.startsAt);
    return Number.isFinite(start) ? new Date(start) : null;
}
