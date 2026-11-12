import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Search, UserPlus, Users, ClipboardCheck, ClipboardX, Inbox } from 'lucide-react';
import { Spinner } from './CommonComponents';
import { STATE_LOCALITIES } from './constants';
import { confirmDialog } from './dialogs';
import {
    JOB_TITLES, WORKPLACE_TYPES, HR_GROUPS, optionLabel, describeJob, describeWorkplace,
    isWorkProfileComplete, registrationKind, summarizeRegistrations, tsMillis,
    approveHrRequest, rejectHrRequest,
} from '../utils/workProfile';

// Admin > Registrations: who signed up and when, the work details they gave
// after sign in / sign up, and their requests to join an HR group.
const PERIODS = [7, 30, 90];

const TONES = { sky: 'text-sky-700', green: 'text-green-700', amber: 'text-amber-700', red: 'text-red-700' };
const Tile = ({ icon: Icon, label, value, sub, tone = 'sky', onClick, active }) => (
    <button type="button" onClick={onClick}
        className={`rounded-xl border p-3 text-start transition-colors ${active ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-white hover:border-sky-300'}`}>
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${TONES[tone]}`}><Icon size={14} />{label}</div>
        <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
        {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </button>
);

const Bars = ({ title, rows }) => {
    const max = Math.max(1, ...rows.map((r) => r.value));
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-3">
            <h4 className="mb-2 text-sm font-bold text-gray-700">{title}</h4>
            {rows.length === 0 ? <p className="text-xs text-gray-400">—</p> : (
                <ul className="space-y-1.5">
                    {rows.map((r) => (
                        <li key={r.key} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-2 text-xs">
                            <span className="truncate text-gray-600" title={r.label}>{r.label}</span>
                            <span className="h-2.5 rounded-full bg-gray-100"><span className="block h-2.5 rounded-full bg-sky-500" style={{ width: `${(r.value / max) * 100}%` }} /></span>
                            <span className="text-end font-semibold tabular-nums text-gray-800">{r.value}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const STATUS_STYLE = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-700',
};

export default function RegistrationsTab({ users = [], approverEmail, onUserUpdated }) {
    const { t, i18n } = useTranslation();
    const lang = (i18n.language || 'en').startsWith('ar') ? 'ar' : 'en';
    const [days, setDays] = useState(30);
    const [view, setView] = useState('all');
    const [search, setSearch] = useState('');
    const [stateFilter, setStateFilter] = useState('');
    const [jobFilter, setJobFilter] = useState('');
    const [busyId, setBusyId] = useState('');
    const [error, setError] = useState('');

    const now = Date.now();
    const summary = useMemo(() => summarizeRegistrations(users, now, days), [users, days]); // eslint-disable-line react-hooks/exhaustive-deps
    const stateLabel = (s) => (s === 'Federal' ? (lang === 'ar' ? 'اتحادي' : 'Federal') : (lang === 'ar' ? STATE_LOCALITIES[s]?.ar : STATE_LOCALITIES[s]?.en) || s);

    const rows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return users
            .filter((u) => {
                const p = u.workProfile;
                if (view === 'new' && registrationKind(u, now, days) !== 'new') return false;
                if (view === 'existing' && registrationKind(u, now, days) !== 'existing') return false;
                if (view === 'filled' && !isWorkProfileComplete(p)) return false;
                if (view === 'missing' && isWorkProfileComplete(p)) return false;
                if (view === 'pending' && u.hrRequest?.status !== 'pending') return false;
                if (stateFilter && p?.state !== stateFilter) return false;
                if (jobFilter && p?.jobTitle !== jobFilter) return false;
                if (q) {
                    const hay = [u.displayName, u.email, p?.facilityName, p?.organizationName, p?.locality].filter(Boolean).join(' ').toLowerCase();
                    if (!hay.includes(q)) return false;
                }
                return true;
            })
            .sort((a, b) => {
                const pa = a.hrRequest?.status === 'pending' ? 1 : 0;
                const pb = b.hrRequest?.status === 'pending' ? 1 : 0;
                if (pa !== pb) return pb - pa;
                return (tsMillis(b.workProfile?.updatedAt) || tsMillis(b.createdAt)) - (tsMillis(a.workProfile?.updatedAt) || tsMillis(a.createdAt));
            });
    }, [users, view, search, stateFilter, jobFilter, days]); // eslint-disable-line react-hooks/exhaustive-deps

    const decide = async (u, approve) => {
        const group = optionLabel(HR_GROUPS, u.hrRequest?.group, lang);
        const msg = approve
            ? t('registrations.confirm_approve', 'Add {{name}} to {{group}}?', { name: u.displayName, group })
            : t('registrations.confirm_reject', 'Reject the request from {{name}} to join {{group}}?', { name: u.displayName, group });
        if (!await confirmDialog(msg)) return;
        setBusyId(u.id); setError('');
        try {
            if (approve) {
                const res = await approveHrRequest(u, approverEmail);
                onUserUpdated?.(u.id, { hrRequest: { ...u.hrRequest, status: 'approved', hrRecordId: res.recordId, alreadyListed: res.alreadyListed } });
            } else {
                await rejectHrRequest(u, approverEmail);
                onUserUpdated?.(u.id, { hrRequest: { ...u.hrRequest, status: 'rejected' } });
            }
        } catch (e) {
            console.error('HR request decision failed', e);
            setError(t('registrations.decide_failed', 'Could not save the decision: {{message}}', { message: e.message }));
        } finally {
            setBusyId('');
        }
    };

    const fmtDate = (v) => {
        const ms = tsMillis(v);
        return ms ? new Date(ms).toLocaleDateString(lang === 'ar' ? 'ar' : undefined, { dateStyle: 'medium' }) : '';
    };

    const pct = summary.total ? Math.round((summary.completed / summary.total) * 100) : 0;
    const byJob = JOB_TITLES.map((j) => ({ key: j.id, label: optionLabel(JOB_TITLES, j.id, lang), value: summary.byJob[j.id] || 0 })).filter((r) => r.value);
    const byPlace = WORKPLACE_TYPES.map((w) => ({ key: w.id, label: optionLabel(WORKPLACE_TYPES, w.id, lang), value: summary.byWorkplace[w.id] || 0 })).filter((r) => r.value);
    const byState = Object.entries(summary.byState).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s, v]) => ({ key: s, label: stateLabel(s), value: v }));
    const states = ['Federal', ...Object.keys(STATE_LOCALITIES).filter((s) => s !== 'Federal')];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-600">{t('registrations.intro', 'Accounts, the work details people gave after signing in, and their requests to join a team.')}</p>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                    {t('registrations.new_means', 'New = joined in the last')}
                    <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-md border border-gray-300 p-1 text-sm">
                        {PERIODS.map((d) => <option key={d} value={d}>{t('registrations.days', '{{count}} days', { count: d })}</option>)}
                    </select>
                </label>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Tile icon={Users} label={t('registrations.total', 'All accounts')} value={summary.total} active={view === 'all'} onClick={() => setView('all')} />
                <Tile icon={UserPlus} label={t('registrations.new', 'New')} value={summary.newUsers} sub={t('registrations.days', '{{count}} days', { count: days })} active={view === 'new'} onClick={() => setView('new')} />
                <Tile icon={Users} label={t('registrations.existing', 'Existing')} value={summary.existing} active={view === 'existing'} onClick={() => setView('existing')} />
                <Tile icon={ClipboardCheck} tone="green" label={t('registrations.filled', 'Details filled')} value={summary.completed} sub={`${pct}%`} active={view === 'filled'} onClick={() => setView('filled')} />
                <Tile icon={ClipboardX} tone="amber" label={t('registrations.missing', 'Not filled yet')} value={summary.missing} active={view === 'missing'} onClick={() => setView('missing')} />
                <Tile icon={Inbox} tone="red" label={t('registrations.pending', 'Team requests')} value={summary.pending} active={view === 'pending'} onClick={() => setView('pending')} />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Bars title={t('registrations.by_job', 'By job')} rows={byJob} />
                <Bars title={t('registrations.by_workplace', 'By workplace')} rows={byPlace} />
                <Bars title={t('registrations.by_state', 'By state')} rows={byState} />
            </div>

            <div className="flex flex-wrap gap-2">
                <div className="relative min-w-[12rem] flex-1">
                    <Search size={16} className="pointer-events-none absolute start-2.5 top-2.5 text-gray-400" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('registrations.search', 'Search name, email, facility...')}
                        className="w-full rounded-md border border-gray-300 p-2 ps-8 text-sm" />
                </div>
                <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="rounded-md border border-gray-300 p-2 text-sm">
                    <option value="">{t('registrations.all_states', 'All states')}</option>
                    {states.map((s) => <option key={s} value={s}>{stateLabel(s)}</option>)}
                </select>
                <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} className="rounded-md border border-gray-300 p-2 text-sm">
                    <option value="">{t('registrations.all_jobs', 'All jobs')}</option>
                    {JOB_TITLES.map((j) => <option key={j.id} value={j.id}>{optionLabel(JOB_TITLES, j.id, lang)}</option>)}
                </select>
            </div>

            {error && <p className="text-sm font-semibold text-red-600" role="alert">{error}</p>}
            <p className="text-xs text-gray-500">{t('registrations.showing', 'Showing {{count}} accounts', { count: rows.length })}</p>

            <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
                {rows.length === 0 && <li className="p-6 text-center text-sm text-gray-500">{t('registrations.none', 'No accounts match.')}</li>}
                {rows.map((u) => {
                    const p = u.workProfile;
                    const filled = isWorkProfileComplete(p);
                    const kind = registrationKind(u, now, days);
                    const req = u.hrRequest && u.hrRequest.status !== 'cancelled' ? u.hrRequest : null;
                    return (
                        <li key={u.id} className="grid grid-cols-1 gap-2 p-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)] md:items-center">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="truncate font-semibold text-gray-900">{u.displayName}</span>
                                    {kind === 'new' && <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">{t('registrations.badge_new', 'New')}</span>}
                                </div>
                                <div className="truncate text-xs text-gray-500" dir="ltr">{u.email}</div>
                                <div className="text-xs text-gray-400">
                                    {u.createdAt ? t('registrations.joined', 'Joined {{date}}', { date: fmtDate(u.createdAt) }) : t('registrations.joined_unknown', 'Joined before dates were recorded')}
                                </div>
                            </div>
                            <div className="min-w-0 text-sm">
                                {filled ? (
                                    <>
                                        <div className="font-medium text-gray-800">{describeJob(p, lang)}{p.phone ? <span className="text-gray-500" dir="ltr"> · {p.phone}</span> : null}</div>
                                        <div className="truncate text-gray-600">{describeWorkplace(p, lang)}</div>
                                        <div className="text-xs text-gray-500">{[stateLabel(p.state), p.state === 'Federal' ? '' : p.locality].filter(Boolean).join(' / ')}</div>
                                    </>
                                ) : (
                                    <span className="text-xs font-semibold text-amber-700">{t('registrations.no_details', 'Work details not filled yet')}</span>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                {req ? (
                                    <>
                                        <span className="text-xs text-gray-600">{optionLabel(HR_GROUPS, req.group, lang)}</span>
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[req.status] || 'bg-gray-100 text-gray-700'}`}>
                                            {t(`work_profile.status_${req.status}`, req.status)}
                                        </span>
                                        {req.status === 'pending' && (
                                            busyId === u.id ? <Spinner size="sm" /> : (
                                                <span className="flex gap-1">
                                                    <button type="button" onClick={() => decide(u, true)} className="flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-xs font-bold text-white hover:bg-green-700">
                                                        <Check size={14} />{t('registrations.approve', 'Approve')}
                                                    </button>
                                                    <button type="button" onClick={() => decide(u, false)} className="flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50">
                                                        <X size={14} />{t('registrations.reject', 'Reject')}
                                                    </button>
                                                </span>
                                            )
                                        )}
                                    </>
                                ) : <span className="text-xs text-gray-400">{t('registrations.no_request', 'No team request')}</span>}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
