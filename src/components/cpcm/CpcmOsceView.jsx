// src/components/cpcm/CpcmOsceView.jsx
// OSCE and skill checklists for the community midwives course: an overview of
// every participant's results, and the checklist the trainer ticks while the
// participant works through the case.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, EmptyState, Select, Spinner, Textarea } from '../CommonComponents';
import { confirmDialog } from '../dialogs';
import { saveParticipantOsceResult } from '../../data.js';
import { OSCE_CHECKLISTS, getOsceChecklist, scoreOsce, buildOsceRecord } from './osceChecklists.js';

const ResultChip = ({ result, onClick }) => {
    if (!result) {
        return <button type="button" onClick={onClick} className="w-full rounded-md border border-dashed border-slate-300 px-2 py-1.5 text-slate-400 hover:bg-slate-50">—</button>;
    }
    const tone = result.passed ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200';
    return (
        <button type="button" onClick={onClick} className={`w-full rounded-md border px-2 py-1.5 font-semibold tabular-nums ${tone}`}>
            {result.score}/{result.total}
        </button>
    );
};

function OsceOverview({ participants, results, onOpen }) {
    const { t } = useTranslation();
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {OSCE_CHECKLISTS.map(c => {
                    const done = participants.filter(p => results[p.id]?.[c.id]);
                    const passed = done.filter(p => results[p.id][c.id].passed).length;
                    return (
                        <button key={c.id} type="button" onClick={() => onOpen(c.id)} dir="rtl"
                            className="text-start rounded-lg border border-slate-200 bg-white p-3 hover:border-sky-400 hover:bg-sky-50">
                            <div className="text-xs font-bold text-sky-700">{c.short}</div>
                            <div className="text-sm font-semibold text-slate-800 leading-snug mt-1">{c.title}</div>
                            <div className="text-xs text-slate-500 mt-2" dir="auto">
                                {t('cpcm_osce.passed_of_assessed', '{{passed}} passed of {{done}} assessed', { passed, done: done.length })}
                            </div>
                        </button>
                    );
                })}
            </div>

            {participants.length === 0 ? (
                <EmptyState message={t('cpcm_osce.no_participants', 'Add participants to this course first.')} />
            ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-100 text-gray-700">
                            <tr>
                                <th className="px-3 py-2 text-start font-semibold">{t('cpcm_osce.participant', 'Participant')}</th>
                                {OSCE_CHECKLISTS.map(c => <th key={c.id} className="px-2 py-2 font-semibold whitespace-nowrap" dir="rtl">{c.short}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {participants.map(p => (
                                <tr key={p.id}>
                                    <td className="px-3 py-2 text-gray-800 min-w-[9rem]">{p.name}</td>
                                    {OSCE_CHECKLISTS.map(c => (
                                        <td key={c.id} className="px-2 py-2 text-center min-w-[4.5rem]">
                                            <ResultChip result={results[p.id]?.[c.id]} onClick={() => onOpen(c.id, p.id)} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <p className="text-xs text-slate-500">{t('cpcm_osce.overview_hint', 'Green passed, red not yet passed. Tap a cell to open or fill that checklist.')}</p>
        </div>
    );
}

// Same segmented control as the other monitoring checklists (EENC, ICCM).
function StepToggle({ value, onChange, readOnly }) {
    const options = [['نفذ', 'done', 'bg-green-600 border-green-600'], ['لم ينفذ', 'not_done', 'bg-red-600 border-red-600']];
    return (
        <div className="relative z-0 flex w-full sm:inline-flex sm:w-auto shadow-sm rounded-md sm:flex-shrink-0">
            {options.map(([label, val, activeClass], idx) => (
                <button
                    key={val}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onChange(val)}
                    className={`relative inline-flex flex-1 sm:flex-none items-center justify-center px-3 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0 text-sm font-medium leading-tight whitespace-nowrap touch-manipulation focus:z-10 focus:outline-none focus:ring-1 focus:ring-sky-500 transition border border-gray-300 disabled:cursor-default ${idx === 0 ? 'rounded-s-md' : '-ms-px rounded-e-md'} ${value === val ? `${activeClass} text-white` : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

function StepRow({ step, value, onChange, readOnly }) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col sm:flex-row justify-between sm:items-center p-3 sm:px-5 hover:bg-sky-50/50 transition-colors gap-3 group">
            <div className="min-w-0 flex-1">
                <span className="font-medium text-slate-700 break-words group-hover:text-slate-900">
                    {step.text}
                    {step.critical && <span className="text-red-600 font-bold ms-1" title={t('cpcm_osce.critical', 'Must be done to pass')}>*</span>}
                </span>
                {step.hint && <div className="text-xs text-slate-500 mt-0.5">{step.hint}</div>}
            </div>
            <StepToggle value={value} onChange={onChange} readOnly={readOnly} />
        </div>
    );
}

function OsceForm({ checklist, participant, participants, previous, canEdit, assessorName, onChangeParticipant, onChangeChecklist, onBack, onSaved, lockedParticipant = false }) {
    const { t } = useTranslation();
    const [answers, setAnswers] = useState(previous?.answers || {});
    const [notes, setNotes] = useState(previous?.notes || '');
    const [showGuide, setShowGuide] = useState(!previous);
    const [expanded, setExpanded] = useState(() => new Set([0, 1]));
    const toggleSection = (i) => setExpanded(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const result = useMemo(() => scoreOsce(checklist, answers), [checklist, answers]);
    const readOnly = !canEdit;

    const save = async () => {
        setSaving(true); setError('');
        try {
            const record = buildOsceRecord(checklist, answers, previous, { assessor: assessorName, notes });
            await saveParticipantOsceResult(participant.id, checklist.id, record);
            onSaved(participant.id, checklist.id, record);
        } catch (e) {
            setError(e.message || String(e));
        } finally {
            setSaving(false);
        }
    };

    const clear = async () => {
        if (!(await confirmDialog(t('cpcm_osce.confirm_clear', 'Remove this result for {{name}}?', { name: participant.name }), { danger: true }))) return;
        setSaving(true); setError('');
        try {
            await saveParticipantOsceResult(participant.id, checklist.id, null);
            onSaved(participant.id, checklist.id, null);
        } catch (e) {
            setError(e.message || String(e));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4 pb-28">
            {!lockedParticipant && (
                <div className="flex flex-wrap items-end gap-3">
                    <Button variant="secondary" onClick={onBack}>{t('cpcm_osce.back', '← All results')}</Button>
                    <div className="flex-1 min-w-[12rem]">
                        <Select label={t('cpcm_osce.participant', 'Participant')} value={participant.id} onChange={e => onChangeParticipant(e.target.value)}>
                            {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                    </div>
                    <div className="flex-1 min-w-[12rem]">
                        <Select label={t('cpcm_osce.checklist', 'Checklist')} value={checklist.id} onChange={e => onChangeChecklist(e.target.value)}>
                            {OSCE_CHECKLISTS.map(c => <option key={c.id} value={c.id}>{c.short} – {c.title}</option>)}
                        </Select>
                    </div>
                </div>
            )}

            <div dir="rtl" className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800">{checklist.title}</h3>

                <div className="rounded-lg border border-slate-200 bg-slate-50">
                    <button type="button" onClick={() => setShowGuide(s => !s)} className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-slate-700">
                        <span>تعليمات للمدرب والحالة</span>
                        {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {showGuide && (
                        <div className="px-4 pb-4 space-y-3 text-sm text-slate-700 leading-relaxed">
                            <p>{checklist.trainerNote}</p>
                            {checklist.readAloud && <p className="italic">"{checklist.readAloud}"</p>}
                            {checklist.timeNote && <p className="font-semibold">"{checklist.timeNote}"</p>}
                            {checklist.scenario && (
                                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
                                    <div className="text-xs font-bold mb-1">الحالة (تُقرأ للمتدربة)</div>
                                    {checklist.scenario}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg shadow-sm justify-between items-center">
                    <span className="text-sm font-medium text-slate-600 hidden sm:inline-block">انقر على عنوان المجال لتوسيعه/طيّه</span>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setExpanded(new Set(checklist.sections.map((_, i) => i)))}>توسيع الكل</Button>
                        <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setExpanded(new Set())}>طي الكل</Button>
                    </div>
                </div>

                <div className="space-y-3">
                    {checklist.sections.map((section, si) => {
                        const isExpanded = expanded.has(si);
                        const steps = section.entries.filter(e => e.id);
                        const marked = steps.filter(e => answers[e.id]).length;
                        const title = section.title || steps.map(e => e.text).join('، ');
                        return (
                            <div key={si} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => toggleSection(si)}
                                    className={`w-full flex items-center justify-between gap-3 p-4 text-start transition-colors ${isExpanded ? 'bg-sky-50 border-b border-sky-100' : 'bg-white hover:bg-slate-50'}`}
                                >
                                    <h4 className="min-w-0 flex-1 text-sm sm:text-base font-bold text-slate-800 text-start break-words">{title}</h4>
                                    <span className={`text-xs font-semibold tabular-nums ${marked === steps.length ? 'text-green-700' : 'text-slate-500'}`}>{marked}/{steps.length}</span>
                                    <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                                {isExpanded && (
                                    <div className="divide-y divide-slate-100 bg-white">
                                        {section.entries.map((entry, ei) => entry.id ? (
                                            <StepRow key={entry.id} step={entry} value={answers[entry.id]} readOnly={readOnly}
                                                onChange={v => setAnswers(a => ({ ...a, [entry.id]: v }))} />
                                        ) : (
                                            <p key={`p${ei}`} className="p-3 sm:px-5 text-sm font-semibold text-red-700">توجيه: {entry.prompt}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="text-sm text-slate-600 space-y-1">
                    <p className="font-semibold">{checklist.passNote}</p>
                    {(checklist.notes || []).map((n, i) => <p key={i}>{n}</p>)}
                </div>

                <Textarea label="ملاحظات المدرب" value={notes} disabled={readOnly} rows={2} onChange={e => setNotes(e.target.value)} />
                {previous && (
                    <p className="text-xs text-slate-500">
                        {checklist.repeatUntilAll && <>درجة المحاولة الأولى: {previous.firstScore} من {previous.total} · </>}
                        المدرب: {previous.assessor || '—'} · {new Date(previous.updatedAt).toLocaleDateString()}
                    </p>
                )}
            </div>

            <div className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3">
                <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2" dir="rtl">
                        {result.passed ? <CheckCircle2 className="w-6 h-6 text-green-600" /> : <XCircle className="w-6 h-6 text-red-500" />}
                        <div>
                            <div className="font-bold tabular-nums">{result.score} / {result.total} <span className="text-xs font-normal text-slate-500">(مطلوب {result.passMark})</span></div>
                            <div className={`text-xs font-semibold ${result.passed ? 'text-green-700' : 'text-red-600'}`}>
                                {result.passed ? 'ناجح' : 'لم ينجح بعد'}
                                {result.criticalMissed.length > 0 && ` · ${result.criticalMissed.length} خطوة أساسية (*) لم تنفذ`}
                                {result.answered < result.total && ` · ${result.total - result.answered} لم تُقيّم`}
                            </div>
                        </div>
                    </div>
                    {error && <span className="text-xs text-red-600">{error}</span>}
                    {canEdit && (
                        <div className="ms-auto flex gap-2">
                            {previous && <Button variant="ghost" onClick={clear} disabled={saving}>{t('cpcm_osce.clear', 'Remove')}</Button>}
                            <Button onClick={save} disabled={saving}>{saving ? <Spinner size="sm" /> : t('cpcm_osce.save', 'Save')}</Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// lockParticipant: the page around this view already picks the participant
// (the monitoring page and link), so only the checklist is chosen here, the
// way the other monitoring checklists pick their scenario.
export default function CpcmOsceView({ participants = [], selectedParticipantId, canEdit, assessorName, onSaved, lockParticipant = false }) {
    const { t } = useTranslation();
    const active = useMemo(() => participants.filter(p => !p.isDeleted), [participants]);
    // Saved results show at once, before the participant list reloads.
    const [overrides, setOverrides] = useState({});
    const [open, setOpen] = useState(null); // { checklistId, participantId }
    const [lockedChecklistId, setLockedChecklistId] = useState(OSCE_CHECKLISTS[0].id);

    useEffect(() => { setOverrides({}); }, [participants]);

    const results = useMemo(() => {
        const out = {};
        active.forEach(p => { out[p.id] = { ...(p.osce_results || {}), ...(overrides[p.id] || {}) }; });
        return out;
    }, [active, overrides]);

    const openForm = (checklistId, participantId) => {
        const pid = participantId || selectedParticipantId || active[0]?.id;
        if (!pid) return;
        setOpen({ checklistId, participantId: pid });
    };

    const handleSaved = (participantId, checklistId, record) => {
        setOverrides(o => ({ ...o, [participantId]: { ...(o[participantId] || {}), [checklistId]: record || undefined } }));
        if (!lockParticipant) setOpen(null);
        if (onSaved) onSaved();
    };

    const participant = open && active.find(p => p.id === open.participantId);
    const checklist = open && getOsceChecklist(open.checklistId);

    if (lockParticipant) {
        const lockedParticipantRow = active.find(p => p.id === selectedParticipantId);
        const lockedChecklist = getOsceChecklist(lockedChecklistId);
        if (!lockedParticipantRow) return <EmptyState message={t('cpcm_osce.no_participants', 'Add participants to this course first.')} />;
        const done = results[lockedParticipantRow.id] || {};
        return (
            <div className="p-1 md:p-2 space-y-4">
                <Select label={t('cpcm_osce.checklist', 'Checklist')} value={lockedChecklistId} onChange={e => setLockedChecklistId(e.target.value)} dir="rtl">
                    {OSCE_CHECKLISTS.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.title}{done[c.id] ? ` (${done[c.id].score}/${done[c.id].total} ${done[c.id].passed ? '✓' : '✗'})` : ''}
                        </option>
                    ))}
                </Select>
                <OsceForm
                    key={`${lockedParticipantRow.id}_${lockedChecklist.id}`}
                    checklist={lockedChecklist}
                    participant={lockedParticipantRow}
                    participants={active}
                    previous={done[lockedChecklist.id] || null}
                    canEdit={canEdit}
                    assessorName={assessorName}
                    onSaved={handleSaved}
                    lockedParticipant
                />
            </div>
        );
    }

    return (
        <div className="p-1 md:p-2">
            {!open && (
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-gray-800">{t('cpcm_osce.title', 'OSCE & skill checklists')}</h2>
                    <p className="text-sm text-gray-500">{t('cpcm_osce.subtitle', 'ECEB OSCE A and B, HBB OSCE stations A and B, and the bag-and-mask skill check.')}</p>
                </div>
            )}
            {open && participant && checklist ? (
                <OsceForm
                    key={`${participant.id}_${checklist.id}`}
                    checklist={checklist}
                    participant={participant}
                    participants={active}
                    previous={results[participant.id]?.[checklist.id] || null}
                    canEdit={canEdit}
                    assessorName={assessorName}
                    onChangeParticipant={pid => setOpen(o => ({ ...o, participantId: pid }))}
                    onChangeChecklist={cid => setOpen(o => ({ ...o, checklistId: cid }))}
                    onBack={() => setOpen(null)}
                    onSaved={handleSaved}
                />
            ) : (
                <OsceOverview participants={active} results={results} onOpen={openForm} />
            )}
        </div>
    );
}
