// src/components/exercises/ExerciseViews.jsx
//
// Three exports:
//   ExerciseListView       shared exercise picker + player (the "both" component)
//   CourseExercisesView    facilitator tab inside CourseManagementView
//   PublicExerciseView     participant-facing page opened from a shared link / QR
//   ExerciseResultsTable   facilitator results grid
//
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Card, EmptyState, FormGroup, Select, Spinner, PageHeader, Toast } from '../CommonComponents';
import { BookOpen, CheckCircle, Clock, Award, Users, ArrowLeft, RefreshCw } from 'lucide-react';
import { getExercisesForSubCourse, getExerciseById } from './imnciExercises';
import { ExercisePlayer } from './ExercisePlayer';
import {
    upsertExerciseAttempt, listExerciseAttemptsForCourse,
    listExerciseAttemptsForParticipant, bestByExercise,
} from './exerciseService';
import { getCourseById, listAllParticipantsForCourse } from '../../data.js';

export const ONLINE_SUB_COURSE = 'IMNCI Online Training';

// --------------------------------------------------------------------------- picker + player

export function ExerciseListView({
    course,
    participant,
    subCourse = ONLINE_SUB_COURSE,
    source = 'public',
    includeDrafts = false,
    onChangeParticipant = null,
}) {
    const exercises = useMemo(() => getExercisesForSubCourse(subCourse, { includeDrafts }), [subCourse, includeDrafts]);
    const [activeId, setActiveId] = useState(null);
    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reviewAttempt, setReviewAttempt] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });

    const loadAttempts = useCallback(async () => {
        if (!course?.id || !participant?.id) { setLoading(false); return; }
        setLoading(true);
        try {
            setAttempts(await listExerciseAttemptsForParticipant(course.id, participant.id));
        } catch (e) {
            setToast({ show: true, message: `Could not load previous attempts: ${e.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [course?.id, participant?.id]);

    useEffect(() => { loadAttempts(); }, [loadAttempts]);

    const best = useMemo(() => bestByExercise(attempts), [attempts]);
    const active = activeId ? getExerciseById(activeId) : null;

    const handleSubmit = async (exercise) => async ({ responses, results, summary, durationSeconds }) => {
        const prior = attempts.filter(a => a.exerciseId === exercise.id).length;
        await upsertExerciseAttempt({
            courseId: course.id,
            participantId: participant.id,
            participantName: participant.name,
            exerciseId: exercise.id,
            exerciseTitle: exercise.title,
            subCourse,
            attemptNo: prior + 1,
            percent: summary.percent,
            earned: summary.earned,
            possible: summary.possible,
            passed: summary.percent >= (exercise.passMark ?? 80),
            durationSeconds,
            responses,
            results,
            source,
        });
        setToast({ show: true, message: 'Your result has been saved.', type: 'success' });
        await loadAttempts();
        setActiveId(null);
    };

    if (active) {
        return (
            <>
                {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ show: false })} />}
                <ExercisePlayer
                    exercise={active}
                    participant={participant}
                    previousBest={best[active.id]?.percent ?? null}
                    readOnlyAttempt={reviewAttempt}
                    onSubmit={handleSubmit(active)}
                    onExit={() => { setActiveId(null); setReviewAttempt(null); }}
                />
            </>
        );
    }

    return (
        <div className="space-y-4">
            {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ show: false })} />}

            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Interactive Exercises</h2>
                    <p className="text-sm text-slate-500">{subCourse}{participant?.name ? ` · ${participant.name}` : ''}</p>
                </div>
                {onChangeParticipant && (
                    <Button variant="secondary" onClick={onChangeParticipant}>
                        <Users className="w-4 h-4" /> Change participant
                    </Button>
                )}
            </div>

            {loading ? <div className="flex justify-center p-8"><Spinner /></div>
                : exercises.length === 0 ? <EmptyState message="No exercises are published for this sub-course yet." />
                : (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {exercises.map(ex => {
                            const b = best[ex.id];
                            const passed = b && b.percent >= (ex.passMark ?? 80);
                            return (
                                <div key={ex.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                                    <div className="flex items-start gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${passed ? 'bg-emerald-100' : 'bg-sky-100'}`}>
                                            {passed ? <Award className="w-5 h-5 text-emerald-600" /> : <BookOpen className="w-5 h-5 text-sky-600" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-slate-800 text-sm leading-snug">{ex.title}</p>
                                            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{ex.estimatedMinutes || 15} min</span>
                                                <span>Pass {ex.passMark ?? 80}%</span>
                                                {ex.draft && <span className="text-amber-600 font-semibold">DRAFT</span>}
                                            </div>
                                            {b && (
                                                <p className={`text-xs mt-2 font-medium flex items-center gap-1 ${passed ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    Best {b.percent}% · {attempts.filter(a => a.exerciseId === ex.id).length} attempt(s)
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-4">
                                        <Button className="flex-1 justify-center" onClick={() => { setReviewAttempt(null); setActiveId(ex.id); }}>
                                            {b ? 'Try again' : 'Start'}
                                        </Button>
                                        {b && (
                                            <Button variant="secondary" onClick={() => { setReviewAttempt(b); setActiveId(ex.id); }}>
                                                Review
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
        </div>
    );
}

// --------------------------------------------------------------------------- facilitator tab

export function CourseExercisesView({ course, participants = [], selectedParticipantId = null }) {
    const [participantId, setParticipantId] = useState(selectedParticipantId || '');
    const [tab, setTab] = useState('results'); // 'results' | 'run'

    const participant = participants.find(p => p.id === participantId) || null;

    if (!course) return <EmptyState message="Select a course first." />;

    return (
        <div className="space-y-4">
            <div className="flex gap-2 border-b border-slate-200 pb-3">
                <Button variant="tab" isActive={tab === 'results'} onClick={() => setTab('results')}>Exercise Results</Button>
                <Button variant="tab" isActive={tab === 'run'} onClick={() => setTab('run')}>Open an Exercise</Button>
            </div>

            {tab === 'results' && <ExerciseResultsTable course={course} participants={participants} />}

            {tab === 'run' && (
                <div className="space-y-4">
                    <div className="max-w-sm">
                        <FormGroup label="Participant">
                            <Select value={participantId} onChange={(e) => setParticipantId(e.target.value)}>
                                <option value="">— Select participant —</option>
                                {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </Select>
                        </FormGroup>
                    </div>
                    {participant
                        ? <ExerciseListView course={course} participant={participant} source="facilitator" includeDrafts />
                        : <EmptyState message="Choose a participant to open the exercises on their behalf." />}
                </div>
            )}
        </div>
    );
}

// --------------------------------------------------------------------------- results grid

export function ExerciseResultsTable({ course, participants = [] }) {
    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try { setAttempts(await listExerciseAttemptsForCourse(course.id)); }
        finally { setLoading(false); }
    }, [course.id]);

    useEffect(() => { load(); }, [load]);

    const exercises = getExercisesForSubCourse(ONLINE_SUB_COURSE, { includeDrafts: true });

    const rows = useMemo(() => {
        const byP = {};
        attempts.forEach(a => {
            byP[a.participantId] = byP[a.participantId] || { name: a.participantName, scores: {}, count: 0 };
            byP[a.participantId].count += 1;
            const cur = byP[a.participantId].scores[a.exerciseId];
            if (cur == null || a.percent > cur) byP[a.participantId].scores[a.exerciseId] = a.percent;
        });
        participants.forEach(p => { if (!byP[p.id]) byP[p.id] = { name: p.name, scores: {}, count: 0 }; });
        return Object.entries(byP).map(([id, v]) => ({ id, ...v })).sort((a, b) => a.name.localeCompare(b.name));
    }, [attempts, participants]);

    const exportCsv = () => {
        const header = ['Participant', ...exercises.map(e => e.title), 'Attempts'];
        const lines = rows.map(r => [
            `"${r.name}"`,
            ...exercises.map(e => r.scores[e.id] ?? ''),
            r.count,
        ].join(','));
        const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `exercise-results-${course.id}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) return <div className="flex justify-center p-8"><Spinner /></div>;
    if (rows.length === 0) return <EmptyState message="No participants or attempts yet." />;

    return (
        <div className="space-y-3">
            <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={load}><RefreshCw className="w-4 h-4" /> Refresh</Button>
                <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="p-3 text-left font-semibold border-b border-slate-200">Participant</th>
                            {exercises.map(e => (
                                <th key={e.id} className="p-3 text-center font-semibold border-b border-slate-200 whitespace-nowrap">
                                    {e.title.split('—')[0].trim()}
                                </th>
                            ))}
                            <th className="p-3 text-center font-semibold border-b border-slate-200">Attempts</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                <td className="p-3 font-medium text-slate-800">{r.name}</td>
                                {exercises.map(e => {
                                    const s = r.scores[e.id];
                                    const passed = s != null && s >= (e.passMark ?? 80);
                                    return (
                                        <td key={e.id} className="p-3 text-center">
                                            {s == null ? <span className="text-slate-300">—</span>
                                                : <span className={`px-2 py-0.5 rounded text-xs font-semibold ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{s}%</span>}
                                        </td>
                                    );
                                })}
                                <td className="p-3 text-center text-slate-500">{r.count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// --------------------------------------------------------------------------- public link view

export function PublicExerciseView({ courseId }) {
    const [course, setCourse] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [participant, setParticipant] = useState(null);
    const [pickId, setPickId] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const c = await getCourseById(courseId, 'server');
                if (!c) throw new Error('Course not found.');
                const ps = await listAllParticipantsForCourse(courseId);
                if (!alive) return;
                setCourse(c);
                setParticipants((ps || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
            } catch (e) {
                if (alive) setError(e.message);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [courseId]);

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;
    if (error) return <EmptyState message={error} />;

    if (!participant) {
        return (
            <div className="max-w-md mx-auto mt-6 p-4">
                <Card className="p-8">
                    <div className="text-center mb-6">
                        <div className="mx-auto h-16 w-16 bg-sky-100 rounded-full flex items-center justify-center mb-4">
                            <BookOpen className="h-8 w-8 text-sky-600" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-900">IMNCI Online Exercises</h1>
                        <p className="text-sm text-slate-500 mt-1">{course.course_type}</p>
                        <p className="text-xs text-slate-400">{course.state} — {course.locality} ({course.start_date})</p>
                    </div>
                    <FormGroup label="Find your name to begin">
                        <Select value={pickId} onChange={(e) => setPickId(e.target.value)}>
                            <option value="">— Select your name —</option>
                            {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                    </FormGroup>
                    <Button
                        className="w-full justify-center mt-4"
                        disabled={!pickId}
                        onClick={() => setParticipant(participants.find(p => p.id === pickId))}
                    >
                        Continue
                    </Button>
                    {participants.length === 0 && (
                        <p className="text-xs text-amber-600 mt-4 text-center">
                            No participants are registered on this course yet. Register first using the course registration link.
                        </p>
                    )}
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto mt-6 p-4">
            <button onClick={() => { setParticipant(null); setPickId(''); }}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4">
                <ArrowLeft className="w-4 h-4" /> Not you?
            </button>
            <ExerciseListView course={course} participant={participant} source="public" />
        </div>
    );
}
