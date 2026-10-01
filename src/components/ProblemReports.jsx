// src/components/ProblemReports.jsx
//
// Two halves of the same thing:
//
//   ReportProblemButton  anyone can describe what went wrong, attach a
//                        screenshot, and send it
//   ProblemReportsTab    the admin screen where those reports are read,
//                        alongside the crashes the app caught by itself
//
// Crashes are recorded automatically by the error boundary. That gives the
// stack but not the story: what a person was trying to do, and what they
// expected instead. A report carries the account, the screen, the app version
// and the connection state, so the obvious first questions are already
// answered without an exchange of messages.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle, Bug, Camera, Check, ChevronDown, ChevronRight, Loader2,
    MessageSquareWarning, Send, Trash2, X,
} from 'lucide-react';

import { Button, Card, CardBody, Input, Modal, Spinner, Textarea } from './CommonComponents';
import { notify, confirmDialog } from './dialogs';
import {
    submitProblemReport, listProblemReports, setProblemReportStatus, deleteProblemReport,
} from '../data';

const STATUSES = {
    new: { label: 'New', chip: 'bg-amber-100 text-amber-800 border-amber-300' },
    investigating: { label: 'Looking into it', chip: 'bg-sky-100 text-sky-800 border-sky-300' },
    resolved: { label: 'Resolved', chip: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
};

// A screenshot is the single most useful thing a report can carry, and the
// thing people are least likely to produce if they have to find a file. 2 MB
// after compression is generous for a phone screen and small enough that the
// report still saves on a weak connection.
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Shrinks a screenshot so it can be stored with the report rather than beside it. */
async function shrinkImage(file, maxEdge = 1400) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    // Stepped down until it fits rather than guessing one quality: a photograph
    // of a screen and a flat screenshot compress very differently.
    for (const quality of [0.8, 0.6, 0.45, 0.3]) {
        const data = canvas.toDataURL('image/jpeg', quality);
        if (data.length <= MAX_IMAGE_BYTES) return data;
    }
    return null;
}

// =============================================================================
// Reporting
// =============================================================================

export function ReportProblemButton({ user, currentView, className = '' }) {
    const [open, setOpen] = useState(false);
    const [what, setWhat] = useState('');
    const [expected, setExpected] = useState('');
    const [shot, setShot] = useState(null);
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);

    const reset = () => {
        setWhat(''); setExpected(''); setShot(null); setSent(false);
    };

    const attach = async (file) => {
        if (!file) return;
        try {
            const data = await shrinkImage(file);
            if (!data) {
                notify('That picture is too large even after shrinking. Try a screenshot rather than a photo.', 'error');
                return;
            }
            setShot(data);
        } catch (e) {
            console.error('Could not read that image:', e);
            notify('That file could not be read as a picture.', 'error');
        }
    };

    const send = async () => {
        if (!what.trim()) { notify('Describe what happened.', 'error'); return; }
        setBusy(true);
        try {
            await submitProblemReport({
                what: what.trim(),
                expected: expected.trim(),
                screenshot: shot,
                screen: currentView || null,
                // Gathered rather than asked for: nobody reporting a problem
                // knows their app version, and it is the first thing needed.
                appVersion: window.__APP_VERSION__ || null,
                userAgent: navigator.userAgent?.slice(0, 300) || null,
                online: navigator.onLine,
                language: document.documentElement.lang || null,
                reporterName: user?.displayName || null,
                reporterEmail: user?.email || null,
            });
            setSent(true);
        } catch (e) {
            console.error('Could not send the report:', e);
            notify(`Could not send that. ${e?.message || ''}`.trim(), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <button onClick={() => { reset(); setOpen(true); }} title="Report a problem"
                className={className || 'p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors'}>
                <MessageSquareWarning size={20} />
            </button>

            <Modal isOpen={open} onClose={() => setOpen(false)} title="Report a problem">
                {sent ? (
                    <div className="text-center py-6 space-y-3">
                        <Check size={40} className="mx-auto text-emerald-600" />
                        <p className="text-slate-700 font-semibold">Thank you — that has been sent.</p>
                        <p className="text-sm text-slate-500">
                            The team can see what you described, along with the screen you were on
                            and which version you are using.
                        </p>
                        <Button onClick={() => setOpen(false)}>Close</Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <Textarea
                            label="What happened?"
                            rows={3}
                            value={what}
                            onChange={(e) => setWhat(e.target.value)}
                            placeholder="The report shows no participants after I pick a state…"
                        />
                        <Textarea
                            label="What did you expect instead? (optional)"
                            rows={2}
                            value={expected}
                            onChange={(e) => setExpected(e.target.value)}
                        />

                        <div>
                            <span className="block text-sm font-medium text-gray-700 mb-1">
                                A picture of the problem (optional)
                            </span>
                            {shot ? (
                                <div className="relative">
                                    <img src={shot} alt="Attached screenshot"
                                        className="max-h-48 rounded border mx-auto" />
                                    <button onClick={() => setShot(null)}
                                        className="absolute top-1 end-1 p-1 rounded-full bg-white/90 border text-red-600">
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg py-6 cursor-pointer text-slate-500 hover:border-sky-400 hover:text-sky-700">
                                    <Camera size={18} />
                                    <span className="text-sm">Choose a screenshot</span>
                                    <input type="file" accept="image/*" className="hidden"
                                        onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ''; }} />
                                </label>
                            )}
                        </div>

                        <p className="text-xs text-slate-500">
                            Sent with your name, the screen you are on and the app version, so the
                            team does not have to ask. Nothing else from the app is included.
                        </p>

                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
                            <Button onClick={send} disabled={busy || !what.trim()}>
                                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                {busy ? 'Sending…' : 'Send'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}

// =============================================================================
// Reading them
// =============================================================================

export function ProblemReportsTab() {
    const [reports, setReports] = useState(null);
    const [filter, setFilter] = useState('open');
    const [openId, setOpenId] = useState(null);
    const [busy, setBusy] = useState(null);

    const load = useCallback(async () => {
        try {
            setReports(await listProblemReports());
        } catch (e) {
            console.error('Could not load the reports:', e);
            notify('Could not load the problem reports.', 'error');
            setReports([]);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const shown = useMemo(() => {
        const all = reports || [];
        if (filter === 'all') return all;
        if (filter === 'crashes') return all.filter((r) => r.kind === 'crash');
        return all.filter((r) => r.status !== 'resolved');
    }, [reports, filter]);

    const setStatus = async (report, status) => {
        setBusy(report.id);
        try {
            await setProblemReportStatus(report.id, status);
            setReports((p) => p.map((r) => (r.id === report.id ? { ...r, status } : r)));
        } catch (e) {
            console.error('Could not update that report:', e);
            notify('Could not update that report.', 'error');
        } finally { setBusy(null); }
    };

    const remove = async (report) => {
        if (!await confirmDialog('Delete this report permanently?',
            { title: 'Delete report', confirmLabel: 'Delete', danger: true })) return;
        setBusy(report.id);
        try {
            await deleteProblemReport(report.id);
            setReports((p) => p.filter((r) => r.id !== report.id));
        } catch (e) {
            console.error('Could not delete that report:', e);
            notify('Could not delete that report.', 'error');
        } finally { setBusy(null); }
    };

    if (reports === null) return <Spinner />;

    const counts = {
        open: (reports || []).filter((r) => r.status !== 'resolved').length,
        crashes: (reports || []).filter((r) => r.kind === 'crash').length,
        all: (reports || []).length,
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {[
                    ['open', `Open (${counts.open})`],
                    ['crashes', `Crashes (${counts.crashes})`],
                    ['all', `All (${counts.all})`],
                ].map(([key, label]) => (
                    <button key={key} onClick={() => setFilter(key)}
                        className={`px-3 py-1.5 rounded-md text-sm font-semibold border ${
                            filter === key ? 'bg-sky-600 text-white border-sky-600'
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {shown.length === 0 ? (
                <Card><CardBody className="text-center py-12 text-slate-500">
                    <Bug size={28} className="mx-auto mb-2 text-slate-300" />
                    Nothing here.
                </CardBody></Card>
            ) : (
                <div className="space-y-2">
                    {shown.map((r) => {
                        const expanded = openId === r.id;
                        const at = r.createdAt?.toDate?.() || null;
                        return (
                            <Card key={r.id}>
                                <div className="p-3 flex items-start gap-3 cursor-pointer"
                                    onClick={() => setOpenId(expanded ? null : r.id)}>
                                    {r.kind === 'crash'
                                        ? <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                                        : <MessageSquareWarning size={18} className="text-sky-600 shrink-0 mt-0.5" />}

                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-slate-800 truncate">
                                            {r.what || r.message || '(no description)'}
                                        </div>
                                        <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 mt-0.5">
                                            <span>{r.reporterEmail || r.reporterName || 'unknown'}</span>
                                            {r.screen && <span>on {r.screen}</span>}
                                            {r.appVersion && <span>v{r.appVersion}</span>}
                                            {at && <span>{at.toLocaleDateString()} {at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                                        </div>
                                    </div>

                                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${
                                        (STATUSES[r.status] || STATUSES.new).chip}`}>
                                        {(STATUSES[r.status] || STATUSES.new).label}
                                    </span>
                                    {expanded ? <ChevronDown size={18} className="text-slate-400 shrink-0" />
                                        : <ChevronRight size={18} className="text-slate-400 shrink-0" />}
                                </div>

                                {expanded && (
                                    <div className="px-4 pb-4 space-y-3 border-t pt-3">
                                        {r.expected && (
                                            <div className="text-sm">
                                                <span className="font-semibold text-slate-600">Expected: </span>
                                                {r.expected}
                                            </div>
                                        )}

                                        {r.stack && (
                                            <pre className="text-[11px] bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto max-h-56">
                                                {r.stack}
                                            </pre>
                                        )}

                                        {r.screenshot && (
                                            <a href={r.screenshot} target="_blank" rel="noreferrer">
                                                <img src={r.screenshot} alt="What the reporter saw"
                                                    className="max-h-80 rounded border" />
                                            </a>
                                        )}

                                        <div className="text-xs text-slate-500 space-y-0.5">
                                            {r.userAgent && <div className="break-all">{r.userAgent}</div>}
                                            <div>{r.online === false ? 'Offline when it happened' : 'Online'}</div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                                            {Object.entries(STATUSES).map(([key, s]) => (
                                                <Button key={key} size="sm"
                                                    variant={r.status === key ? 'primary' : 'secondary'}
                                                    disabled={busy === r.id}
                                                    onClick={() => setStatus(r, key)}>
                                                    {s.label}
                                                </Button>
                                            ))}
                                            <Button size="sm" variant="danger" disabled={busy === r.id}
                                                onClick={() => remove(r)}>
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
