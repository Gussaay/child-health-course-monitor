// src/components/imnci/onlineCourses/chHero.js
//
// Pure helpers for the ch-sudan home hero (ChHomeHero.jsx): they turn the
// learnerSummary() shape (learnerProgress.js) into the numbers the hero
// shows, so the maths is testable without rendering anything.

/** Which greeting the hero uses, by the learner's local time. */
export function greetingKey(date = new Date()) {
    return date.getHours() < 12 ? 'greeting_morning' : 'greeting_evening';
}

/**
 * The hero's numbers from a learnerSummary():
 *   pct            overall lessons progress, 0-100
 *   coursesDone    courses at 100%
 *   continueCourse the course to resume: one already started, else the
 *                  first open course with a next lesson, else null. Its
 *                  `next` (from learnerSummary) is the lesson to open.
 */
export function heroStats(summary) {
    const s = summary || {};
    const lessonsTotal = s.lessonsTotal || 0;
    const lessonsDone = s.lessonsDone || 0;
    const courses = Array.isArray(s.courses) ? s.courses : [];
    const started = courses.find((c) => c.status === 'started');
    const open = courses.find((c) => c.status === 'open' && c.next);
    return {
        pct: lessonsTotal ? Math.round((lessonsDone * 100) / lessonsTotal) : 0,
        lessonsDone,
        lessonsTotal,
        activitiesDone: s.activitiesDone || 0,
        activities: s.activities || 0,
        thisWeek: s.thisWeek || 0,
        streak: s.streak || 0,
        coursesDone: courses.filter((c) => c.percent >= 100).length,
        continueCourse: started || open || null,
    };
}
