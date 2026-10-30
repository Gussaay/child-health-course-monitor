// src/components/cpcm/CpcmOsceView.jsx
// OSCE and skill checklists for the community midwives course: an overview of
// every participant's results, and the checklist the trainer ticks while the
// participant works through the case.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, Card, CardBody, EmptyState, Select, Spinner, Textarea } from '../CommonComponents';
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
                        <button key={c.id} type="button" onClick={() => onOpen(c.id, participants[0]?.id)} dir="rtl"
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

function StepRow({ step, value, onChange, readOnly }) {
    const { t } = useTranslation();
    const btn = (val, label, on) => (
        <button type="button" disabled={readOnly} onClick={() => onChange(value === val ? undefined : val)}
            className={`px-3 py-1.5 text-xs font-semibold border first:rounded-s-md last:rounded-e-md disabled:cursor-default ${value === val ? on : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
            {label}
        </button>
    );
    return (
        <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="flex-1 min-w-[12rem]">
                <div className="text-sm text-slate-800">
                    {step.text}
                    {step.critical && <span className="text-red-600 font-bold ms-1" title={t('cpcm_osce.critical', 'Must be done to pass')}>*</span>}
                </div>
                {step.hint && <div className="text-xs text-slate-500 mt-0.5">{step.hint}</div>}
            </div>
            <div className="flex shrink-0" dir="rtl">
                {btn('done', 'نفذ', 'bg-green-600 text-white border-green-600')}
                {btn('not_done', 'لم ينفذ', 'bg-red-600 text-white border-red-600')}
            </div>
        </div>
    );
}

function OsceForm({ checklist, participant, participants, previous, canEdit, assessorName, onChangeParticipant, onChangeChecklist, onBack, onSaved }) {
    const { t } = useTranslation();
    const [answers, setAnswers] = useState(previous?.answers || {});
    const [notes, setNotes] = useState(previous?.notes || '');
    const [showGuide, setShowGuide] = useState(!previous);
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

                {checklist.sections.map((section, si) => (
                    <Card key={si}>
                        <CardBody className="!py-2">
                            {section.title && <h4 className="font-bold text-slate-800 pt-2 pb-1">{section.title}</h4>}
                            <div className="divide-y divide-slate-100">
                                {section.entries.map((entry, ei) => entry.id ? (
                                    <StepRow key={entry.id} step={entry} value={answers[entry.id]} readOnly={readOnly}
                                        onChange={v => setAnswers(a => { const next = { ...a }; if (v) next[entry.id] = v; else delete next[entry.id]; return next; })} />
                                ) : (
                                    <p key={`p${ei}`} className="py-2 text-sm font-semibold text-red-700">توجيه: {entry.prompt}</p>
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                ))}

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

export default function CpcmOsceView({ participants = [], selectedParticipantId, canEdit, assessorName, onSaved }) {
    const { t } = useTranslation();
    const active = useMemo(() => participants.filter(p => !p.isDeleted), [participants]);
    // Saved results show at once, before the participant list reloads.
    const [overrides, setOverrides] = useState({});
    const [open, setOpen] = useState(null); // { checklistId, participantId }

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
        setOpen(null);
        if (onSaved) onSaved();
    };

    const participant = open && active.find(p => p.id === open.participantId);
    const checklist = open && getOsceChecklist(open.checklistId);

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
