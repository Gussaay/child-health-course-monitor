// src/components/SurveyView.jsx
//
// Surveys: field data collection forms (the first is Community Midwives
// Mapping, تخريط القابلات المجتمعيات). Pages: the list of surveys → one
// survey with its Responses and Deleted Items tabs → a response form.
//
// The place is picked with the app's usual state → locality cascade
// (STATE_LOCALITIES); each survey's questions live in survey/surveys.js.
// Same people as Supervision: canViewSupervision to see, canManageSupervision
// to fill and edit.

import React, { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, RefreshCw, MapPin, ArrowLeft, Download, X, LocateFixed, ExternalLink, Share2, Copy, CheckCircle2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

import {
    Card, CardBody, PageHeader, Button, EmptyState, Modal, PageTabs, FilterPanel, PageActions, PhoneCards,
    PullToRefresh, FormGroup, Spinner, Input, Select, IS_NATIVE, useInPageBack, SkeletonTable, BackArrow,
} from './CommonComponents';
import { notify, confirmDialog } from './dialogs';
import { useDataCache } from '../DataContext';
import { upsertSurveyResponse, deleteSurveyResponse } from '../data';
import { auth } from '../firebase';
import { STATE_LOCALITIES } from './constants';
import { useLeaveGuard, leaveForm, formSaved } from '../utils/leaveGuard';
import { isDateInRange, DATE_RANGE_OPTIONS } from '../utils/dateRange';
import { publicBaseUrl } from '../utils/publicLink';
import {
    SURVEYS, getSurvey, pickText, newAnswers, validateResponse, buildRecord, surveySummary, exportRows,
    toLocation, betterFix, mapLink, GPS_GOOD_ENOUGH_M, GPS_WAIT_MS,
} from './survey/surveys';

const DeletedItemsPanel = lazy(() => import('./DeletedItemsPanel.jsx'));
const LIST_TAB = 'list';
const DELETED_TAB = 'deleted';
const EMPTY_FILTERS = { start: '', end: '', range: '', state: '', locality: '', midwives: '' };

const stateLabel = (k, isArabic) => (STATE_LOCALITIES[k] ? (isArabic ? STATE_LOCALITIES[k].ar || STATE_LOCALITIES[k].en : STATE_LOCALITIES[k].en) : k || '');
const localityLabel = (stateKey, localityKey, isArabic) => {
    const loc = (STATE_LOCALITIES[stateKey]?.localities || []).find((l) => l.en === localityKey);
    return loc ? (isArabic ? loc.ar || loc.en : loc.en) : localityKey || '';
};
const withoutUndefined = (value) => JSON.parse(JSON.stringify(value));

export const surveyPublicUrl = (surveyId) => `${publicBaseUrl()}/public/survey/${surveyId}`;

// Someone filling the public link without signing in types their name once;
// this device remembers it and fills it in next time.
const FILLER_KEY = 'survey.fillerName';
const rememberedName = () => { try { return localStorage.getItem(FILLER_KEY) || ''; } catch { return ''; } };
const rememberName = (name) => { try { if (name) localStorage.setItem(FILLER_KEY, name); } catch { /* private mode */ } };

// Who is filling: the signed-in account, else the remembered name.
function fillerDefaults() {
    const u = auth.currentUser;
    if (u) return { signedIn: true, name: u.displayName || u.email || '', email: u.email || null };
    return { signedIn: false, name: rememberedName(), email: null };
}

// =============================================================================
// Answer controls
// =============================================================================

function YesNo({ value, onChange, readOnly }) {
    const { t } = useTranslation();
    const opt = (v, label, on) => (
        <button type="button" disabled={readOnly} aria-pressed={value === v}
            onClick={() => onChange(value === v ? null : v)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-default ${value === v ? on : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
            {label}
        </button>
    );
    return (
        <div className="flex max-w-xs gap-2">
            {opt(true, t('survey.yes', 'Yes'), 'bg-emerald-600 text-white border-emerald-600')}
            {opt(false, t('survey.no', 'No'), 'bg-red-600 text-white border-red-600')}
        </div>
    );
}

// The midwives (or any people list): numbered rows of name + age, with Add.
function PeopleTable({ question, rows, onChange, readOnly, isArabic }) {
    const { t } = useTranslation();
    const set = (i, colId, value) => onChange(rows.map((r, j) => (j === i ? { ...r, [colId]: value } : r)));
    const remove = (i) => onChange(rows.filter((_, j) => j !== i));
    const cell = 'w-full min-w-0 border border-slate-300 rounded-md px-2 py-2 text-sm bg-white disabled:bg-slate-50';
    return (
        <div className="space-y-2">
            <table className="w-full table-fixed border-collapse text-sm">
                <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500">
                        <th className="w-8 border border-slate-200 px-1 py-2">#</th>
                        {question.columns.map((c) => (
                            <th key={c.id} className={`border border-slate-200 px-2 py-2 text-start font-medium ${c.kind === 'number' ? 'w-20' : ''}`}>{pickText(c, isArabic)}</th>
                        ))}
                        {!readOnly && <th className="w-10 border border-slate-200" />}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={i}>
                            <td className="border border-slate-200 px-1 py-1 text-center text-slate-500">{i + 1}</td>
                            {question.columns.map((c) => (
                                <td key={c.id} className="border border-slate-200 p-1">
                                    <input disabled={readOnly} className={cell}
                                        type={c.kind === 'number' ? 'number' : 'text'}
                                        inputMode={c.kind === 'number' ? 'numeric' : undefined}
                                        min={c.kind === 'number' ? '10' : undefined} max={c.kind === 'number' ? '100' : undefined}
                                        aria-label={`${pickText(c, isArabic)} ${i + 1}`}
                                        value={r?.[c.id] ?? ''} onChange={(e) => set(i, c.id, e.target.value)} />
                                </td>
                            ))}
                            {!readOnly && (
                                <td className="border border-slate-200 text-center">
                                    <button type="button" onClick={() => remove(i)} className="p-1 text-slate-400 hover:text-red-600"
                                        aria-label={t('survey.form.remove_row', 'Remove row')}>
                                        <X size={16} />
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
            {!readOnly && (
                <Button variant="secondary" size="sm" onClick={() => onChange([...rows, {}])}>
                    <Plus size={14} /> {t('survey.form.add_midwife', 'Add another midwife')}
                </Button>
            )}
        </div>
    );
}

// Precise GPS: high-accuracy readings for up to GPS_WAIT_MS, keeping the most
// precise one and stopping early once it is within GPS_GOOD_ENOUGH_M metres.
function LocationCapture({ value, onChange, readOnly }) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [live, setLive] = useState(null);
    const [error, setError] = useState('');
    const stopRef = useRef(null);
    useEffect(() => () => stopRef.current?.(), []);

    const capture = () => {
        if (!navigator.geolocation) { setError(t('survey.gps.unsupported', 'This device or browser cannot give a location.')); return; }
        setError(''); setBusy(true); setLive(null);
        let best = null;
        let watchId = null;
        let timer = null;
        const finish = (err) => {
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            clearTimeout(timer);
            stopRef.current = null;
            setBusy(false);
            if (best) onChange(best);
            else if (err) {
                setError(err.code === 1
                    ? t('survey.gps.denied', 'Location permission was refused. Allow location for this app and try again.')
                    : t('survey.gps.failed', 'Could not get the location. Turn on GPS (location) and try again outdoors.'));
            }
        };
        stopRef.current = () => finish(null);
        watchId = navigator.geolocation.watchPosition(
            (pos) => {
                best = betterFix(best, toLocation(pos));
                setLive(best);
                if (best?.accuracy != null && best.accuracy <= GPS_GOOD_ENOUGH_M) finish(null);
            },
            (err) => { if (!best) finish(err); },
            { enableHighAccuracy: true, timeout: GPS_WAIT_MS, maximumAge: 0 },
        );
        timer = setTimeout(() => finish({ code: 3 }), GPS_WAIT_MS);
    };

    const shown = busy ? live : value;
    return (
        <div className="space-y-2">
            {shown ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-mono text-slate-800" dir="ltr">{shown.lat}, {shown.lng}</p>
                    <p className={`text-xs ${shown.accuracy != null && shown.accuracy <= 30 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {t('survey.gps.accuracy', 'Accuracy ±{{m}} m', { m: shown.accuracy ?? '?' })}
                        {!busy && shown.capturedAt && <span className="text-slate-500"> · {new Date(shown.capturedAt).toLocaleString()}</span>}
                    </p>
                    {!busy && (
                        <a href={mapLink(shown)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-sky-700 hover:underline">
                            <ExternalLink size={12} /> {t('survey.gps.open_map', 'Open in map')}
                        </a>
                    )}
                </div>
            ) : (
                <p className="text-xs text-slate-500">{t('survey.gps.none', 'No location captured yet.')}</p>
            )}
            {!readOnly && (
                <div className="flex flex-wrap gap-2">
                    {busy ? (
                        <Button variant="secondary" size="sm" onClick={() => stopRef.current?.()}>
                            <Spinner size="sm" /> {t('survey.gps.searching', 'Getting a precise fix… tap to stop')}
                        </Button>
                    ) : (
                        <Button variant="secondary" size="sm" onClick={capture}>
                            <LocateFixed size={14} /> {value ? t('survey.gps.recapture', 'Capture again') : t('survey.gps.capture', 'Capture location')}
                        </Button>
                    )}
                    {value && !busy && (
                        <Button variant="secondary" size="sm" onClick={() => onChange(null)}>{t('survey.gps.clear', 'Clear')}</Button>
                    )}
                </div>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    );
}

function Question({ question, value, onChange, readOnly, isArabic, error }) {
    const label = pickText(question, isArabic);
    const body = (() => {
        if (question.kind === 'yesno') return <YesNo value={value} onChange={onChange} readOnly={readOnly} />;
        if (question.kind === 'location') return <LocationCapture value={value} onChange={onChange} readOnly={readOnly} />;
        if (question.kind === 'people') {
            return <PeopleTable question={question} rows={Array.isArray(value) ? value : []} onChange={onChange} readOnly={readOnly} isArabic={isArabic} />;
        }
        return (
            <input disabled={readOnly} type={question.kind}
                className="w-full min-w-0 border border-slate-300 rounded-md px-3 py-2 text-sm bg-white disabled:bg-slate-50"
                value={value ?? ''} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        );
    })();
    return (
        <div className={question.kind === 'people' ? 'sm:col-span-2' : ''}>
            <p className="mb-1 text-sm font-medium text-slate-700">
                {label}{question.required && <span className="text-red-600"> *</span>}
            </p>
            {body}
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
}

// =============================================================================
// The form
// =============================================================================

function ResponseForm({ survey, initial, onBack, onSaved, canEdit, publicMode = false }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    useLeaveGuard(canEdit);
    const back = () => leaveForm(onBack);
    useInPageBack(back, !publicMode);
    const readOnly = !canEdit;
    const [filler] = useState(fillerDefaults);

    const [form, setForm] = useState(() => {
        if (initial) {
            const answers = {};
            for (const q of survey.questions) answers[q.id] = initial[q.id];
            const people = survey.questions.find((q) => q.kind === 'people');
            if (people && canEdit && !(answers[people.id] || []).length) answers[people.id] = [{}];
            return { id: initial.id, stateKey: initial.stateKey || '', localityKey: initial.localityKey || '', answers };
        }
        const answers = newAnswers(survey, { user: auth.currentUser });
        if (!answers.completedBy && filler.name) answers.completedBy = filler.name;
        return { stateKey: '', localityKey: '', answers };
    });
    const [saving, setSaving] = useState(false);
    const [problems, setProblems] = useState([]);

    const setAnswer = (id, value) => setForm((p) => ({ ...p, answers: { ...p.answers, [id]: value } }));
    const problemText = (id) => {
        const p = problems.find((x) => x.id === id);
        if (!p) return '';
        return {
            state: t('survey.form.err_state', 'Choose the state.'),
            locality: t('survey.form.err_locality', 'Choose the locality.'),
            required: t('survey.form.err_required', 'This answer is needed.'),
            people_empty: t('survey.form.err_people', 'Enter at least one midwife, or answer No.'),
            age: t('survey.form.err_age', 'Check the ages: each should be between 10 and 100.'),
        }[p.code];
    };

    const save = async () => {
        const found = validateResponse(survey, form);
        // Without an account, the name is the only way to know who filled it.
        if (publicMode && !filler.signedIn && !String(form.answers.completedBy || '').trim()) found.push({ id: 'completedBy', code: 'required' });
        setProblems(found);
        if (found.length) { notify(t('survey.form.fix_errors', 'Some answers need attention.'), 'error'); return; }
        setSaving(true);
        try {
            const record = withoutUndefined({
                ...buildRecord(survey, form),
                ...(form.id ? { id: form.id } : {}),
                ...(publicMode ? { submittedVia: 'public_link', filledBySignedIn: filler.signedIn } : {}),
            });
            await upsertSurveyResponse(record);
            if (!filler.signedIn) rememberName(String(form.answers.completedBy || '').trim());
            formSaved();
            notify(t('survey.form.saved', 'Saved.'), 'success');
            onSaved?.();
            if (!publicMode) onBack();
        } catch (error) {
            console.error('Failed to save survey response:', error);
            const raw = String(error?.message || error);
            notify(/insufficient permissions|permission-denied/i.test(raw)
                ? t('survey.form.permission_denied', 'Firestore refused the write. Your account may not have rights to fill surveys.')
                : t('survey.form.save_failed', 'Could not save. {{error}}', { error: raw }), 'error');
        } finally {
            setSaving(false);
        }
    };

    const visible = survey.questions.filter((q) => !q.showIf || q.showIf(form.answers));

    return (
        <div className={`space-y-3 ${canEdit ? 'pb-24 sm:pb-0' : ''}`}>
            {!IS_NATIVE && !publicMode && (
                <Button variant="secondary" onClick={back}><ArrowLeft size={16} /> {t('survey.form.back', 'Back to responses')}</Button>
            )}
            <Card>
                <CardBody className="space-y-4">
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700"><MapPin size={22} /></span>
                        <div className="min-w-0">
                            <h3 className="font-semibold text-slate-800">{pickText(survey, isArabic, 'title')}</h3>
                            <p className="text-xs text-slate-500">{t('survey.form.place', 'Place')}</p>
                        </div>
                    </div>
                    {publicMode && (
                        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                            {filler.signedIn
                                ? t('survey.public.signed_in', 'Signed in as {{name}}. Your name is filled in for you.', { name: filler.name || filler.email || '' })
                                : t('survey.public.guest', 'You are not signed in. Write your name below; this device will remember it next time.')}
                        </p>
                    )}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <Select label={<>{t('survey.state', 'State')}<span className="text-red-600"> *</span></>} value={form.stateKey} disabled={readOnly}
                                onChange={(e) => setForm((p) => ({ ...p, stateKey: e.target.value, localityKey: '' }))}>
                                <option value="">{t('survey.select', 'Select…')}</option>
                                {Object.keys(STATE_LOCALITIES).filter((k) => k !== 'Federal')
                                    .map((k) => <option key={k} value={k}>{stateLabel(k, isArabic)}</option>)}
                            </Select>
                            {problemText('stateKey') && <p className="mt-1 text-xs text-red-600">{problemText('stateKey')}</p>}
                        </div>
                        <div>
                            <Select label={<>{t('survey.locality', 'Locality')}<span className="text-red-600"> *</span></>} value={form.localityKey} disabled={readOnly || !form.stateKey}
                                onChange={(e) => setForm((p) => ({ ...p, localityKey: e.target.value }))}>
                                <option value="">{t('survey.select', 'Select…')}</option>
                                {(STATE_LOCALITIES[form.stateKey]?.localities || [])
                                    .map((l) => <option key={l.en} value={l.en}>{isArabic ? l.ar || l.en : l.en}</option>)}
                            </Select>
                            {problemText('localityKey') && <p className="mt-1 text-xs text-red-600">{problemText('localityKey')}</p>}
                        </div>
                        {visible.map((q) => (
                            <Question key={q.id} question={publicMode && !filler.signedIn && q.id === 'completedBy' ? { ...q, required: true } : q} value={form.answers[q.id]} readOnly={readOnly} isArabic={isArabic}
                                error={problemText(q.id)} onChange={(v) => setAnswer(q.id, v)} />
                        ))}
                    </div>
                </CardBody>
            </Card>

            {canEdit && (
                <>
                    <div className="hidden sm:flex sticky bottom-0 z-20 items-center justify-end gap-2 rounded-xl border border-slate-200 bg-slate-50/95 p-3 backdrop-blur">
                        {!publicMode && <Button variant="secondary" onClick={back} disabled={saving}>{t('survey.form.cancel', 'Cancel')}</Button>}
                        <Button onClick={save} disabled={saving}>{saving ? <Spinner size="sm" /> : null} {t('survey.form.save', 'Save')}</Button>
                    </div>
                    <div className="sm:hidden fixed inset-x-0 bottom-[var(--bottom-nav,0px)] z-40 flex h-16 items-center justify-around gap-2 border-t border-slate-700 bg-slate-900 px-3 shadow-lg">
                        {!publicMode && <Button variant="secondary" onClick={back} disabled={saving}>{t('survey.form.cancel', 'Cancel')}</Button>}
                        <Button onClick={save} disabled={saving} className="flex-1">{t('survey.form.save', 'Save')}</Button>
                    </div>
                </>
            )}
        </div>
    );
}

// =============================================================================
// Public link: /public/survey/<survey id>. Anyone may fill it, signed in or not.
// =============================================================================

function ShareLinkModal({ survey, onClose }) {
    const { t, i18n } = useTranslation();
    const url = surveyPublicUrl(survey.id);
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try { await navigator.clipboard.writeText(url); setCopied(true); } catch { notify(url, 'info'); }
    };
    return (
        <Modal isOpen onClose={onClose} title={t('survey.share.title', 'Share the survey')}>
            <CardBody className="space-y-4">
                <p className="text-sm text-slate-600">{t('survey.share.note', 'Anyone with this link can fill the survey, with or without an account. Responses appear in this list.')}</p>
                <p className="font-semibold text-slate-800">{pickText(survey, i18n.language === 'ar', 'title')}</p>
                <div className="flex justify-center"><QRCodeCanvas value={url} size={180} includeMargin /></div>
                <div className="flex items-center gap-2">
                    <input readOnly value={url} dir="ltr" className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-2 text-xs" onFocus={(e) => e.target.select()} />
                    <Button variant="secondary" onClick={copy}><Copy size={16} /> {copied ? t('survey.share.copied', 'Copied') : t('survey.share.copy', 'Copy')}</Button>
                </div>
                <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-sky-700 hover:underline">
                    <ExternalLink size={14} /> {t('survey.share.open', 'Open the form')}
                </a>
            </CardBody>
        </Modal>
    );
}

export function PublicSurveyForm({ surveyId }) {
    const { t, i18n } = useTranslation();
    const survey = getSurvey(surveyId);
    const [round, setRound] = useState(0);
    const [done, setDone] = useState(false);
    if (!survey) {
        return <Card><CardBody className="text-center text-red-600 font-semibold">{t('survey.share.not_found', 'This survey link is not valid.')}</CardBody></Card>;
    }
    if (done) {
        return (
            <div className="mx-auto max-w-3xl p-2 md:p-4">
                <Card>
                    <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
                        <CheckCircle2 size={48} className="text-emerald-600" />
                        <h3 className="text-lg font-semibold text-slate-800">{t('survey.share.thanks', 'Thank you, the form was saved')}</h3>
                        <p className="text-sm text-slate-600">{pickText(survey, i18n.language === 'ar', 'title')}</p>
                        <Button onClick={() => { setDone(false); setRound((r) => r + 1); }}>
                            <Plus size={16} /> {t('survey.share.another', 'Fill another village')}
                        </Button>
                    </CardBody>
                </Card>
            </div>
        );
    }
    return (
        <div className="mx-auto max-w-3xl p-2 md:p-4">
            <ResponseForm key={round} survey={survey} initial={null} canEdit publicMode
                onBack={() => {}} onSaved={() => { setDone(true); window.scrollTo(0, 0); }} />
        </div>
    );
}

// =============================================================================
// The list
// =============================================================================

function ResponsesTable({ rows, canEdit, selectedIds, onSelectionChange, onView, onEdit, onDelete, isLoading, filtered, onClearFilters, onNew }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const ids = rows.map((r) => r.id);
    const allSelected = rows.length > 0 && ids.every((id) => selectedIds.includes(id));
    const someSelected = ids.some((id) => selectedIds.includes(id));
    const toggleAll = (e) => onSelectionChange(e.target.checked
        ? Array.from(new Set([...selectedIds, ...ids]))
        : selectedIds.filter((id) => !ids.includes(id)));
    const toggleRow = (id) => onSelectionChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

    const th = 'px-2 py-3 text-start text-xs font-medium text-gray-500 border border-gray-300';
    const td = 'px-2 py-2 text-xs text-gray-600 text-start border border-gray-300 break-words whitespace-normal';
    const columns = 8 + (canEdit ? 1 : 0);

    if (isLoading) return <SkeletonTable rows={8} columns={6} />;

    return (
        <PhoneCards className="w-full overflow-x-auto border border-gray-300 rounded-lg shadow-sm">
            <table className="w-full border-collapse">
                <thead className="bg-gray-50">
                    <tr>
                        {canEdit && (
                            <th className="px-3 py-3 text-center w-10 border border-gray-300">
                                <input type="checkbox" checked={allSelected}
                                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                    onChange={toggleAll} aria-label={t('survey.list.select_all', 'Select all')}
                                    className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500 cursor-pointer" />
                            </th>
                        )}
                        <th className={th}>#</th>
                        <th className={th}>{t('survey.village', 'Village')}</th>
                        <th className={th}>{t('survey.state', 'State')}</th>
                        <th className={th}>{t('survey.locality', 'Locality')}</th>
                        <th className={th}>{t('survey.list.midwives', 'Midwives')}</th>
                        <th className={th}>{t('survey.list.completed_by', 'Completed by')}</th>
                        <th className={th}>{t('survey.date', 'Date')}</th>
                        <th className={th}>{t('survey.list.actions', 'Actions')}</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {rows.length === 0 ? (
                        <tr><td colSpan={columns} className="border border-gray-300">
                            <EmptyState filtered={filtered} onClearFilters={filtered ? onClearFilters : undefined}
                                message={filtered
                                    ? t('survey.list.no_match', 'No responses matched the current filters.')
                                    : t('survey.list.empty', 'No responses yet. Use New response to add a village.')}
                                action={!filtered && canEdit ? { label: t('survey.list.new', 'New response'), onClick: onNew } : undefined} />
                        </td></tr>
                    ) : rows.map((row, index) => {
                        const selected = selectedIds.includes(row.id);
                        const count = Array.isArray(row.midwives) ? row.midwives.length : 0;
                        return (
                            <tr key={row.id} className={selected ? 'bg-sky-50' : 'bg-white'}>
                                {canEdit && (
                                    <td className="px-3 py-2 text-center border border-gray-300">
                                        <input type="checkbox" checked={selected} onChange={() => toggleRow(row.id)} aria-label={row.village}
                                            className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500 cursor-pointer" />
                                    </td>
                                )}
                                <td className="px-2 py-2 text-sm font-medium text-gray-900 text-start border border-gray-300">{index + 1}</td>
                                <td className={td}>
                                    <span className="block font-semibold text-gray-800">{row.village || '—'}</span>
                                    {row.adminUnit && <span className="block text-gray-500">{row.adminUnit}</span>}
                                    {row.location && (
                                        <a href={mapLink(row.location)} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-sky-700 hover:underline">
                                            <MapPin size={12} /> {t('survey.gps.on_map', 'Map')} · {t('survey.gps.accuracy', 'Accuracy ±{{m}} m', { m: row.location.accuracy ?? '?' })}
                                        </a>
                                    )}
                                </td>
                                <td className={td}>{stateLabel(row.stateKey, isArabic) || '—'}</td>
                                <td className={td}>{localityLabel(row.stateKey, row.localityKey, isArabic) || '—'}</td>
                                <td className={`${td} whitespace-nowrap`}>
                                    {row.hasMidwives === true
                                        ? <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-100 text-emerald-800">{t('survey.list.n_midwives', '{{count}} midwives', { count })}</span>
                                        : row.hasMidwives === false
                                            ? <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">{t('survey.list.none', 'None')}</span>
                                            : '—'}
                                </td>
                                <td className={td}>
                                    {row.completedBy || row.createdByEmail || '—'}
                                    {row.submittedVia === 'public_link' && (
                                        <span className="ms-1 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-sky-100 text-sky-800">{t('survey.list.via_link', 'Via link')}</span>
                                    )}
                                </td>
                                <td className={`${td} whitespace-nowrap`}>{row.surveyDate || '—'}</td>
                                <td className={`${td} whitespace-nowrap`}>
                                    <div className="flex flex-wrap gap-1">
                                        <Button size="sm" variant="info" onClick={() => onView(row)} className="text-xs px-2 py-1">{t('mentorship_page.buttons.view', 'View')}</Button>
                                        {canEdit && <Button size="sm" variant="warning" onClick={() => onEdit(row)} className="text-xs px-2 py-1">{t('mentorship_page.buttons.edit', 'Edit')}</Button>}
                                        {canEdit && <Button size="sm" variant="danger" onClick={() => onDelete(row)} className="text-xs px-2 py-1">{t('mentorship_page.buttons.del', 'Del')}</Button>}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </PhoneCards>
    );
}

function SummaryStrip({ rows }) {
    const { t } = useTranslation();
    const s = surveySummary(rows);
    const items = [
        { label: t('survey.summary.villages', 'Villages mapped'), value: s.villages, tone: 'text-slate-800' },
        { label: t('survey.summary.with', 'With midwives'), value: s.withMidwives, tone: 'text-emerald-700' },
        { label: t('survey.summary.without', 'Without midwives'), value: s.withoutMidwives, tone: 'text-red-700' },
        { label: t('survey.summary.midwives', 'Midwives listed'), value: s.midwives, tone: 'text-sky-700' },
    ];
    return (
        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            {items.map((i) => (
                <div key={i.label} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-500">{i.label}</p>
                    <p className={`text-xl font-semibold tabular-nums ${i.tone}`}>{i.value}</p>
                </div>
            ))}
        </div>
    );
}

function SurveyPicker({ responses, onSelect }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    return (
        <div className="space-y-4">
            <PageHeader title={t('survey.title', 'Surveys')} subtitle={t('survey.choose', 'Choose a survey')} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {SURVEYS.map((s) => {
                    const total = responses.filter((r) => r.surveyId === s.id).length;
                    return (
                        <button key={s.id} type="button" onClick={() => onSelect(s.id)}
                            className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-start transition-colors hover:border-sky-400 hover:bg-sky-50 md:p-5">
                            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700"><MapPin size={34} /></span>
                            <span className="min-w-0 flex-1">
                                <span className="block font-semibold text-slate-800">{pickText(s, isArabic, 'title')}</span>
                                <span className="mt-1 block text-sm text-slate-500">{pickText(s, isArabic, 'description')}</span>
                                <span className="mt-1 block text-xs text-slate-500">{t('survey.response_count', '{{count}} responses', { count: total })}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// =============================================================================
// Main screen
// =============================================================================

export default function SurveyView({ permissions = {} }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const canEdit = !!(permissions.canManageSupervision ?? permissions.canUseFederalManagerAdvancedFeatures);
    const canEmptyBin = !!permissions.canUseFederalManagerAdvancedFeatures;
    const { surveyResponses, fetchSurveyResponses, isLoading } = useDataCache();

    const [surveyId, setSurveyId] = useState(null);
    const [tab, setTab] = useState(LIST_TAB);
    const [editing, setEditing] = useState(null);
    const [viewOnly, setViewOnly] = useState(false);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [selectedIds, setSelectedIds] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [sharing, setSharing] = useState(false);
    const topRef = useRef(null);

    useEffect(() => { if (!surveyResponses) fetchSurveyResponses(false); }, [surveyResponses, fetchSurveyResponses]);
    useEffect(() => { topRef.current?.scrollIntoView?.({ block: 'start' }); }, [surveyId, editing]);
    useInPageBack(() => setSurveyId(null), !!surveyId && editing === null);

    const reload = useCallback(() => fetchSurveyResponses('sync'), [fetchSurveyResponses]);
    const refresh = async () => {
        setRefreshing(true);
        try { await fetchSurveyResponses('full'); } finally { setRefreshing(false); }
    };

    const survey = getSurvey(surveyId);
    const live = useMemo(() => (surveyResponses || []).filter((r) => r.isDeleted !== true), [surveyResponses]);
    const surveyRows = useMemo(() => live.filter((r) => r.surveyId === surveyId), [live, surveyId]);

    const setFilter = (name, value) => {
        setFilters((f) => ({ ...f, [name]: value, ...(name === 'state' ? { locality: '' } : {}) }));
        setSelectedIds([]);
    };
    const clearFilters = () => { setFilters(EMPTY_FILTERS); setSelectedIds([]); };
    const activeFilters = Object.values(filters).filter(Boolean).length;

    const rows = useMemo(() => surveyRows
        .filter((r) => !filters.state || r.stateKey === filters.state)
        .filter((r) => !filters.locality || r.localityKey === filters.locality)
        .filter((r) => !filters.midwives || (filters.midwives === 'yes') === (r.hasMidwives === true))
        .filter((r) => (!filters.range && !filters.start && !filters.end) || isDateInRange(r.surveyDate, filters.range, filters.start, filters.end))
        .sort((a, b) => String(b.surveyDate || '').localeCompare(String(a.surveyDate || ''))),
    [surveyRows, filters]);

    const remove = async (ids) => {
        let failed = 0;
        for (const id of ids) {
            try { await deleteSurveyResponse(id); } catch (error) { failed += 1; console.error('Failed to delete survey response:', id, error); }
        }
        setSelectedIds((cur) => cur.filter((id) => !ids.includes(id)));
        fetchSurveyResponses('sync');
        return failed;
    };
    const handleDelete = async (row) => {
        const ok = await confirmDialog(
            t('survey.delete_confirm', 'Delete the response for {{name}}?', { name: row.village || '' }),
            { title: t('survey.delete_title', 'Delete response'), confirmLabel: t('survey.delete', 'Delete'), danger: true });
        if (!ok) return;
        const failed = await remove([row.id]);
        notify(failed ? t('survey.delete_failed', 'Could not delete the response.') : t('survey.deleted', 'Response deleted.'), failed ? 'error' : 'success');
    };
    const handleBulkDelete = async () => {
        const count = selectedIds.length;
        const ok = await confirmDialog(
            t('survey.delete_selected_confirm', 'Delete {{count}} selected responses?', { count }),
            { title: t('survey.delete_title', 'Delete response'), confirmLabel: t('survey.delete', 'Delete'), danger: true });
        if (!ok) return;
        const failed = await remove([...selectedIds]);
        notify(failed
            ? t('survey.delete_some_failed', '{{failed}} of {{count}} could not be deleted.', { failed, count })
            : t('survey.deleted_n', '{{count}} responses deleted.', { count }), failed ? 'error' : 'success');
    };

    const exportExcel = async () => {
        const XLSX = await import('xlsx');
        const data = exportRows(rows, {
            isArabic,
            stateName: (k) => stateLabel(k, isArabic),
            localityName: (s, l) => localityLabel(s, l, isArabic),
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Midwives');
        XLSX.writeFile(wb, `${survey.id}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const openRecord = (row, readOnlyView) => { setViewOnly(readOnlyView); setEditing(row); };
    const startNew = () => { setViewOnly(false); setEditing({}); };

    if (!survey) {
        return <div ref={topRef}><SurveyPicker responses={live} onSelect={(id) => { setSurveyId(id); setTab(LIST_TAB); clearFilters(); }} /></div>;
    }
    if (editing !== null) {
        return (
            <div ref={topRef}>
                <ResponseForm survey={survey} initial={editing.id ? editing : null} canEdit={canEdit && !viewOnly}
                    onBack={() => setEditing(null)} onSaved={reload} />
            </div>
        );
    }

    const loadingList = isLoading?.surveyResponses && !surveyResponses;
    const states = Array.from(new Set(surveyRows.map((r) => r.stateKey).filter(Boolean))).sort();
    const localities = Array.from(new Set(surveyRows.filter((r) => r.stateKey === filters.state).map((r) => r.localityKey).filter(Boolean))).sort();

    return (
        <div ref={topRef}>
            <Card>
                <div className="p-3 md:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3 mb-3 md:mb-6 border-b border-gray-200 pb-2">
                        <div className="flex items-center gap-2 md:gap-3 min-w-0">
                            <BackArrow onClick={() => setSurveyId(null)} label={t('survey.back_to_list', 'All surveys')} className="-ms-2" />
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700"><MapPin size={22} /></span>
                            <div className="min-w-0">
                                <h2 className="text-lg md:text-xl font-semibold text-slate-800">{pickText(survey, isArabic, 'title')}</h2>
                                <p className="text-xs md:text-sm text-slate-500">{t('survey.title', 'Surveys')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <PullToRefresh onRefresh={refresh} disabled={refreshing} />
                            <Button variant="secondary" onClick={refresh} disabled={refreshing} className="flex items-center gap-2">
                                {refreshing ? <Spinner size="sm" /> : <RefreshCw size={16} />}
                                <span className="hidden sm:inline">{refreshing ? t('mentorship_page.buttons.refreshing', 'Refreshing...') : t('mentorship_page.buttons.refresh', 'Refresh')}</span>
                            </Button>
                        </div>
                    </div>

                    <PageTabs className="md:!mb-6" active={tab} onChange={(id) => { setTab(id); setSelectedIds([]); }}
                        tabs={[
                            { id: LIST_TAB, label: t('survey.tabs.responses', 'Responses'), short: t('survey.tabs.responses', 'Responses'), count: surveyRows.length },
                            canEmptyBin && { id: DELETED_TAB, label: t('survey.tabs.deleted', 'Deleted Items'), short: t('ui.short.deleted', 'Deleted') },
                        ]} />

                    {tab === DELETED_TAB && canEmptyBin && (
                        <Suspense fallback={<SkeletonTable />}>
                            <DeletedItemsPanel types={['surveyResponses']} />
                        </Suspense>
                    )}

                    {tab === LIST_TAB && (<>
                        <SummaryStrip rows={rows} />
                        <FilterPanel className="mb-4 md:mb-6" activeCount={activeFilters}>
                            <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-3 lg:grid-cols-6">
                                <FormGroup label={t('mentorship_page.filters.start_date', 'Start Date')}>
                                    <Input type="date" value={filters.start} onChange={(e) => setFilter('start', e.target.value)} className="w-full" />
                                </FormGroup>
                                <FormGroup label={t('mentorship_page.filters.end_date', 'End Date')}>
                                    <Input type="date" value={filters.end} onChange={(e) => setFilter('end', e.target.value)} className="w-full" />
                                </FormGroup>
                                <FormGroup label={t('mentorship_page.filters.date_range', 'Date Range')}>
                                    <Select value={filters.range} onChange={(e) => setFilter('range', e.target.value)}>
                                        <option value="">{t('mentorship_page.filters.all_time', 'All Time')}</option>
                                        {DATE_RANGE_OPTIONS.map((r) => <option key={r} value={r}>{t(`mentorship_page.filters.${r}`, r)}</option>)}
                                    </Select>
                                </FormGroup>
                                <FormGroup label={t('survey.state', 'State')}>
                                    <Select value={filters.state} onChange={(e) => setFilter('state', e.target.value)}>
                                        <option value="">{t('survey.all_states', 'All states')}</option>
                                        {states.map((k) => <option key={k} value={k}>{stateLabel(k, isArabic)}</option>)}
                                    </Select>
                                </FormGroup>
                                <FormGroup label={t('survey.locality', 'Locality')}>
                                    <Select value={filters.locality} onChange={(e) => setFilter('locality', e.target.value)} disabled={!filters.state}>
                                        <option value="">{t('survey.all_localities', 'All localities')}</option>
                                        {localities.map((k) => <option key={k} value={k}>{localityLabel(filters.state, k, isArabic)}</option>)}
                                    </Select>
                                </FormGroup>
                                <FormGroup label={t('survey.list.midwives', 'Midwives')}>
                                    <Select value={filters.midwives} onChange={(e) => setFilter('midwives', e.target.value)}>
                                        <option value="">{t('survey.all', 'All')}</option>
                                        <option value="yes">{t('survey.summary.with', 'With midwives')}</option>
                                        <option value="no">{t('survey.summary.without', 'Without midwives')}</option>
                                    </Select>
                                </FormGroup>
                            </div>
                        </FilterPanel>

                        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                            <PageActions keep={2}>
                                {canEdit && selectedIds.length === 0 && (
                                    <Button onClick={startNew}><Plus size={16} /> {t('survey.list.new', 'New response')}</Button>
                                )}
                                {canEdit && selectedIds.length > 0 && (
                                    <Button variant="danger" onClick={handleBulkDelete}>
                                        <Trash2 size={16} /> {t('mentorship_page.buttons.delete_selected', 'Delete Selected ({{count}})', { count: selectedIds.length })}
                                    </Button>
                                )}
                                {canEdit && (
                                    <Button variant="secondary" onClick={() => setSharing(true)}>
                                        <Share2 size={16} /> {t('survey.share.button', 'Share link')}
                                    </Button>
                                )}
                                <Button variant="secondary" onClick={exportExcel} disabled={rows.length === 0}>
                                    <Download size={16} /> {t('survey.export', 'Export to Excel')}
                                </Button>
                            </PageActions>
                            {!loadingList && (
                                <p className="text-xs text-slate-500">{t('survey.list.count', '{{shown}} of {{total}} responses', { shown: rows.length, total: surveyRows.length })}</p>
                            )}
                        </div>

                        <ResponsesTable rows={rows} canEdit={canEdit} selectedIds={selectedIds} onSelectionChange={setSelectedIds}
                            onView={(row) => openRecord(row, true)} onEdit={(row) => openRecord(row, false)} onDelete={handleDelete}
                            isLoading={loadingList} filtered={activeFilters > 0} onClearFilters={clearFilters} onNew={startNew} />
                    </>)}
                </div>
            </Card>
            {sharing && <ShareLinkModal survey={survey} onClose={() => setSharing(false)} />}
        </div>
    );
}
