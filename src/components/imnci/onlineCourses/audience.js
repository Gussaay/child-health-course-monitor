// src/components/imnci/onlineCourses/audience.js
//
// Who a course is for. A course with audience "facilitators" (the facilitator
// guide, with answer keys and the examination) is read in Protocol management >
// Facilitator guides, with every course's notes for the facilitator. In the
// course list only the people who write courses see it, to edit it.
// The same people can open any lesson of a learners' course out of order, so
// that a link from the guide opens the lesson it talks about.

export const isFacilitatorRole = (roles) => (roles || []).some((r) => /facilitator|trainer/i.test(String(r)));

// eslint-disable-next-line no-unused-vars
export function canSeeCourse(course, { canManage = false, canSeeProgress = false, isFacilitator = false } = {}) {
    return course?.audience !== 'facilitators' || canManage;
}

export const followsAnyLesson = ({ canSeeProgress = false, isFacilitator = false } = {}) => canSeeProgress || isFacilitator;
