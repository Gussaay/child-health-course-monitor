// src/components/imnci/onlineCourses/audience.js
//
// Who a course is for. A course with audience "facilitators" (the facilitator
// guide, with answer keys and the examination) is read in Protocol management >
// Facilitator guides, with every course's notes for the facilitator. In the
// course list only the people who write courses see it, to edit it.
// In Learn mode everyone, these people included, meets the course's locks.
// They may open a lesson out of order only by following a link from a
// facilitator guide to it, so the guide's links still work.

export const isFacilitatorRole = (roles) => (roles || []).some((r) => /facilitator|trainer/i.test(String(r)));

export const normaliseEmail = (email) => String(email || '').trim().toLowerCase();

/**
 * A draft (unpublished) course may name testers by email (`course.testers`):
 * while the course is unpublished, they alone — besides the people who
 * manage courses — can see it in the course list and open it, so the course
 * can be tried out before it is published.
 */
export const isCourseTester = (course, email) => {
    const mine = normaliseEmail(email);
    if (!mine) return false;
    return (Array.isArray(course?.testers) ? course.testers : []).some((x) => normaliseEmail(x) === mine);
};

export const isDraftCourse = (course) => course?.isPublished === false;

/** May this person open the course while it is still a draft? */
export const canAccessDraft = (course, { canManage = false, email = '' } = {}) => {
    if (!isDraftCourse(course)) return false;
    return !!canManage || isCourseTester(course, email);
};

// eslint-disable-next-line no-unused-vars
export function canSeeCourse(course, { canManage = false, canSeeProgress = false, isFacilitator = false } = {}) {
    // A course annex (standard operating procedures, skill checklists, chart
    // booklet pages) is opened from the lessons that point to it, not listed.
    return !['facilitators', 'annex'].includes(course?.audience) || canManage;
}

/** Course annexes: material the lessons open when needed (SOPs, skill checklists, chart booklet). */
export const isCourseAnnex = (course) => course?.audience === 'annex';

export const followsAnyLesson = ({ canSeeProgress = false, isFacilitator = false } = {}) => canSeeProgress || isFacilitator;
