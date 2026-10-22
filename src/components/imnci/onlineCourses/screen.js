// src/components/imnci/onlineCourses/screen.js
//
// What the Online Courses screens share: the open course, module and section,
// the learner's progress, the author's dialogs and the actions on them. Held by
// OnlineCoursesView (courses.jsx) and read by each screen.
import { createContext, useContext } from 'react';

export const CourseScreen = createContext(null);
export const useCourseScreen = () => useContext(CourseScreen);
