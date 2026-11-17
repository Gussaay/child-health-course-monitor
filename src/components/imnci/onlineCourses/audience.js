// src/components/imnci/onlineCourses/audience.js
//
// Who a course is for. A course with audience "facilitators" (the facilitator
// guide, with answer keys and the examination) is shown only to facilitators,
// trainers and the people who manage courses or follow learners' progress.
// The same people can open any lesson of a learners' course out of order, so
// that a link from the guide opens the lesson it talks about.

export const isFacilitatorRole = (roles) => (roles || []).some((r) => /facilitator|trainer/i.test(String(r)));

export function canSeeCourse(course, { canManage = false, canSeeProgress = false, isFacilitator = false } = {}) {
    return course?.audience !== 'facilitators' || canManage || canSeeProgress || isFacilitator;
}

export const followsAnyLesson = ({ canSeeProgress = false, isFacilitator = false } = {}) => canSeeProgress || isFacilitator;
