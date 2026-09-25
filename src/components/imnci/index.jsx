// src/components/imnci/index.jsx
//
// One folder for the whole of IMNCI, and one door into it.
//
//   form.jsx       the patient record, and the hub the other screens hang off
//   protocol.jsx   what a classification means and what it is treated with
//   exercises.js   the cases themselves — the only file edited to add one
//   exercises.jsx  playing, grading and authoring those cases
//   book.js        turning a module book into readable sections
//   courses.jsx    the self-paced course built from those sections
//   shared.jsx     the data they all read, and the editor they are written in
//
// These were four folders. They are one body of work — the protocol decides
// what a classification means, the exercises test that decision, the books
// teach it, and the form applies it at the bedside — and splitting them up
// meant a change to any one of them was made in ignorance of the other three.
//
// Everything outside this folder imports from here, so moving a file inside it
// never reaches the rest of the app.

export { ImnciProvider, useImnci, RichText, RichTextEditor, sanitiseHtml } from './shared';

export { default as IMNCIRecordingForm } from './form';
export { default as ProtocolEditor } from './protocol';
export { default as OnlineCoursesView } from './courses';

export * from './exercises';
export {
    CasePlayer, QuizPlayer, ExerciseListView, CourseExercisesView,
    ExerciseResultsTable, ExerciseCourseReport, PublicExerciseView,
    ParticipantExercisesModal, ParticipantExerciseSummary,
    ExerciseEditor, ExerciseManagerView, LiveExerciseDashboard,
    loadAllExercises, gradeCase, gradeQuiz,
} from './exercises.jsx';

export {
    parsePdfIntoSections, extractPdfPages, renderPdfPages, looksLikeHeading,
    countWords, tabContent, SECTION_TABS, BLOCK_TYPES, newQuestion,
    newExerciseLink, videoSource, contentsTitles, findContents,
} from './book';
