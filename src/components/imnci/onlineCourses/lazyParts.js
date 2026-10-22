// src/components/imnci/onlineCourses/lazyParts.js
//
// The heavier parts of the course screens, loaded only when opened.
import { lazy } from 'react';

// The course books and the AI study helper (summaries, questions). They only
// read the course; adding a book never changes a module or a section.
export const AiLibraryView = lazy(() => import('../../AiLibraryView'));
export const BookPage = lazy(() => import('../../AiLibraryView').then((m) => ({ default: m.BookPage })));
export const BookFormModal = lazy(() => import('../../AiLibraryView').then((m) => ({ default: m.BookFormModal })));
export const CourseBooks = lazy(() => import('../../AiLibraryView').then((m) => ({ default: m.CourseBooks })));
export const SectionAiPanel = lazy(() => import('../../AiLibraryView').then((m) => ({ default: m.SectionAiPanel })));
// Practice cases are not re-typed here. A section points at an exercise from
// Online Exercises by its id, so a correction made to the case there is the one
// the learner meets in the course as well.
export const ExerciseManagerView = lazy(() => import('../exercises.jsx').then((m) => ({ default: m.ExerciseManagerView })));
// The protocol is what a classification means; the course is where it is
// taught. Someone writing the course needs to be able to correct the protocol
// without leaving for another screen and finding their way back.
export const ProtocolEditor = lazy(() => import('../protocol'));
