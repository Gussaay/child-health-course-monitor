// src/components/imnci/onlineCourses/learnerProgress.js
//
// One learner's own progress through the online courses, worked out on the
// device from what the course screens already hold: the courses, their
// modules and lessons (sections), and the learner's onlineProgress record
// ({ completed: { sectionId: time }, activities: { sectionId: [keys] } }).
// Kept apart from the page that draws it, so the arithmetic is tested alone.
import { learnerContent } from '../book';
import { activityKeys } from './activityKeys';
import { readingMinutes } from './search';

const DAY = 24 * 60 * 60 * 1000;

/** A saved time (Firestore Timestamp, {seconds}, a number, or `true`) as milliseconds, 0 when unknown. */
export const toMillis = (v) => {
    if (!v || v === true) return 0;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    if (typeof v._seconds === 'number') return v._seconds * 1000;
    if (typeof v === 'number') return v;
    return 0;
};

const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
const pct = (n, d) => (d ? Math.round((n * 100) / d) : 0);

/**
 * The status of every lesson, module and course for one learner.
 *
 * courses: the courses the learner can see; items: modules and sections (not
 * deleted); progress: their onlineProgress record; now: the time to measure
 * "this week" against. Lessons and modules are locked the way the course
 * screens lock them: in order, unless the course's author opened them all.
 */
export function learnerSummary({ courses = [], items = [], progress = {}, now = Date.now() }) {
    const completed = progress.completed || {};
    const savedActs = progress.activities || {};
    const doneTimes = [];

    const out = courses.map((c) => {
        const inOrder = c.lockOrder !== false;
        const mods = items.filter((i) => i.kind === 'module' && i.courseId === c.id).sort(byOrder);
        const secsOf = (mid) => items.filter((i) => i.kind === 'section' && i.courseId === c.id && i.moduleId === mid).sort(byOrder);
        let prevModuleDone = true;
        let next = null;
        const modules = mods.map((m, mi) => {
            // modulesAnyOrder: each module is taken on its own; anyOrder: a
            // reference module whose lessons all open (see courses.jsx).
            const moduleLocked = inOrder && c.modulesAnyOrder !== true && mi > 0 && !prevModuleDone;
            const lessonsInOrder = inOrder && m.anyOrder !== true;
            let prevDone = true;
            const lessons = secsOf(m.id).map((s, si) => {
                const doneAt = completed[s.id];
                const done = !!doneAt;
                if (done) doneTimes.push(toMillis(doneAt));
                const keys = activityKeys(learnerContent(s));
                const saved = savedActs[s.id] || [];
                const activitiesDone = done ? keys.length : keys.filter((k) => saved.includes(k)).length;
                const locked = !done && (moduleLocked || (lessonsInOrder && si > 0 && !prevDone));
                const status = done ? 'done' : locked ? 'locked' : activitiesDone > 0 ? 'started' : 'open';
                prevDone = done;
                const lesson = {
                    id: s.id, moduleId: m.id, title: s.title || '', status,
                    activities: keys.length, activitiesDone, minutes: readingMinutes(s), doneAt: toMillis(doneAt),
                };
                if (!next && !done && !locked) next = lesson;
                return lesson;
            });
            const done = lessons.filter((l) => l.status === 'done').length;
            const complete = lessons.length > 0 && done === lessons.length;
            prevModuleDone = complete;
            const anyStarted = lessons.some((l) => l.status === 'done' || l.status === 'started');
            return {
                id: m.id, title: m.title || '', lessons, done, total: lessons.length, percent: pct(done, lessons.length),
                status: complete ? 'done' : moduleLocked ? 'locked' : anyStarted ? 'started' : 'open',
                activities: lessons.reduce((n, l) => n + l.activities, 0),
                activitiesDone: lessons.reduce((n, l) => n + l.activitiesDone, 0),
                minutesLeft: lessons.reduce((n, l) => n + (l.status === 'done' ? 0 : l.minutes), 0),
            };
        }).filter((m) => m.total > 0);
        const all = modules.flatMap((m) => m.lessons);
        const done = all.filter((l) => l.status === 'done').length;
        return {
            id: c.id, title: c.title || '', modules, next,
            done, total: all.length, percent: pct(done, all.length),
            modulesDone: modules.filter((m) => m.status === 'done').length,
            activities: modules.reduce((n, m) => n + m.activities, 0),
            activitiesDone: modules.reduce((n, m) => n + m.activitiesDone, 0),
            minutesLeft: modules.reduce((n, m) => n + m.minutesLeft, 0),
            status: all.length && done === all.length ? 'done' : all.some((l) => l.status === 'done' || l.status === 'started') ? 'started' : 'open',
        };
    }).filter((c) => c.total > 0);

    const times = doneTimes.filter(Boolean);
    const lastActive = Math.max(0, ...times, toMillis(progress.lastUpdatedAt));
    // The last eight weeks, oldest first: how many lessons were finished in each.
    const weeks = Array.from({ length: 8 }, (_, i) => {
        const end = now - (7 - i) * 7 * DAY;
        return times.filter((t) => t > end - 7 * DAY && t <= end).length;
    });
    // Days in a row, up to today, with at least one lesson finished.
    const days = new Set(times.map((t) => Math.floor(t / DAY)));
    let streak = 0;
    for (let d = Math.floor(now / DAY); days.has(d); d -= 1) streak += 1;
    if (!streak && days.has(Math.floor(now / DAY) - 1)) {
        for (let d = Math.floor(now / DAY) - 1; days.has(d); d -= 1) streak += 1;
    }

    // First tries at practice questions ("<activity>@1" right, "@0" not),
    // kept with each lesson's done list.
    let firstRight = 0;
    let firstTotal = 0;
    Object.values(savedActs).forEach((list) => (Array.isArray(list) ? list : []).forEach((k) => {
        const tag = String(k).split('@')[1];
        if (tag === '1') { firstRight += 1; firstTotal += 1; } else if (tag === '0') firstTotal += 1;
    }));

    return {
        courses: out,
        firstRight,
        firstTotal,
        lessonsDone: out.reduce((n, c) => n + c.done, 0),
        lessonsTotal: out.reduce((n, c) => n + c.total, 0),
        activitiesDone: out.reduce((n, c) => n + c.activitiesDone, 0),
        activities: out.reduce((n, c) => n + c.activities, 0),
        thisWeek: weeks[7],
        weeks,
        streak,
        lastActive: lastActive || null,
    };
}
