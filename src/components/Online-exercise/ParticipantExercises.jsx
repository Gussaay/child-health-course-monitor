// src/components/Online-exercise/ParticipantExercises.jsx
//
// Entry points for the PARTICIPANTS page.
//
//   ParticipantExercisesModal  full-screen modal wrapping the shared ExerciseListView,
//                              opened from a participant row / card.
//   ParticipantExerciseSummary compact read-only panel of one participant's attempts,
//                              for the participant report or detail screen.
//
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Modal, CardBody, Spinner, EmptyState } from '../CommonComponents';
import { Award, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { ExerciseListView, ONLINE_SUB_COURSE } from './ExerciseViews';
import { ExercisePlayer } from './ExercisePlayer';
import { listExerciseAttemptsForParticipant, bestByExercise } from './exerciseService';
import { getExerciseById, getExercisesForSubCourse } from './imnciExercises';

/**
 * Opened from the Participants list. `participant` must have { id, name }.
 * Facilitator context, so drafts are visible and attempts are tagged source:'facilitator'.
 */
export function ParticipantExercisesModal({ isOpen, onClose, course, participant, subCourse = ONLINE_SUB_COURSE }) {
    if (!isOpen || !participant) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Online Exercises — ${participant.name}`} size="lg">
            <CardBody className="p-4 max-h-[80vh] overflow-y-auto">
                <ExerciseListView
                    course={course}
                    participant={participant}
                    subCourse={subCourse}
                    source="facilitator"
                    includeDrafts
                />
            </CardBody>
        </Modal>
    );
}

/**
 * Read-only history for one participant. Drop into the participant report,
 * or anywhere you already show pre/post test scores.
 */
export function ParticipantExerciseSummary({ course, participant, subCourse = ONLINE_SUB_COURSE, onReview = null }) {
    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reviewing, setReviewing] = useState(null);

    const load = useCallback(async () => {
        if (!course?.id || !participant?.id) { setLoading(false); return; }
        setLoading(true);
        try { setAttempts(await listExerciseAttemptsForParticipant(course.id, participant.id)); }
        finally { setLoading(false); }
    }, [course?.id, participant?.id]);

    useEffect(() => { load(); }, [load]);

    const exercises = useMemo(() => getExercisesForSubCourse(subCourse, { includeDrafts: true }), [subCourse]);
    const best = useMemo(() => bestByExercise(attempts), [attempts]);

    if (reviewing) {
        const ex = getExerciseById(reviewing.exerciseId);
        return (
            <div className="space-y-3">
                <Button variant="secondary" onClick={() => setReviewing(null)}>Back to summary</Button>
                {ex
                    ? <ExercisePlayer exercise={ex} participant={participant} readOnlyAttempt={reviewing} onExit={() => setReviewing(null)} />
                    : <EmptyState message="This exercise is no longer in the content library." />}
            </div>
        );
    }

    if (loading) return <div className="flex justify-center p-6"><Spinner /></div>;

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Award className="w-4 h-4 text-slate-400" /> Online Exercises
                </h4>
                <button onClick={load} className="text-slate-400 hover:text-slate-700" title="Refresh">
                    <RefreshCw className="w-3.5 h-3.5" />
                </button>
            </div>

            {attempts.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No exercise attempts recorded yet.</p>
            ) : (
                <div className="divide-y divide-slate-100">
                    {exercises.map(ex => {
                        const b = best[ex.id];
                        if (!b) return null;
                        const passed = b.percent >= (ex.passMark ?? 80);
                        const count = attempts.filter(a => a.exerciseId === ex.id).length;
                        return (
                            <div key={ex.id} className="px-4 py-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm text-slate-800 truncate">{ex.title}</p>
                                    <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{count} attempt{count > 1 ? 's' : ''}</span>
                                        <span>{Math.round((b.durationSeconds || 0) / 60)} min</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {b.percent}%
                                    </span>
                                    {passed ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-amber-500" />}
                                    <button
                                        onClick={() => (onReview ? onReview(b) : setReviewing(b))}
                                        className="text-xs text-sky-600 hover:underline"
                                    >
                                        Review
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
