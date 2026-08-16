// src/components/Online-exercise/index.js
//
// Single import surface for the whole folder:
//
//   import { CourseExercisesView, ParticipantExercisesModal } from './Online-exercise';
//   import { PublicExerciseView } from './components/Online-exercise';

export {
    ExerciseListView,
    CourseExercisesView,
    ExerciseResultsTable,
    PublicExerciseView,
    ONLINE_SUB_COURSE,
} from './ExerciseViews';

export {
    ParticipantExercisesModal,
    ParticipantExerciseSummary,
} from './ParticipantExercises';

export { ExercisePlayer } from './ExercisePlayer';

export {
    EXERCISES,
    getExercisesForSubCourse,
    getExerciseById,
    flattenSteps,
    CLASSIFICATION_COLOURS,
} from './imnciExercises';

export {
    upsertExerciseAttempt,
    listExerciseAttemptsForCourse,
    listExerciseAttemptsForParticipant,
    bestByExercise,
} from './exerciseService';

export { gradeStep, isAnswered, summariseAttempt } from './exerciseGrading';
