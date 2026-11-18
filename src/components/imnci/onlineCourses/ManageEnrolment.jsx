// src/components/imnci/onlineCourses/ManageEnrolment.jsx
//
// Enrolment and groups, on the Manage online courses page. Everything is read
// and written through the onlineEnrolment Cloud Function, which limits a state
// or locality manager to the people of their own state or locality.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, UserPlus, Plus, Pencil, Trash2, Users, Phone, Mail, MapPin, Search, UserMinus } from 'lucide-react';
import { Button, Modal, Input, Select, Textarea, Card, CardBody, EmptyState } from '../../CommonComponents';
import { notify, confirmDialog } from '../../dialogs';
import { useDataCache } from '../../../DataContext';
import { useCourseScreen } from './screen';
import { callEnrolment, groupName, isOpenCourse } from './enrolment';

/** The enrolment records, the groups and the people a manager may enrol. */
export function useEnrolmentAdmin() {
    const [data, setData] = useState({ enrolments: [], groups: [], people: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const reload = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await callEnrolment('list');
            setData({ enrolments: res.enrolments || [], groups: res.groups || [], people: res.people || [] });
        } catch (e) {
            setError(e?.message || 'Could not load enrolment.');
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { reload(); }, [reload]);
    const act = useCallback(async (action, payload) => {
        const res = await callEnrolment(action, payload);
        await reload();
        return res;
    }, [reload]);
    const pending = data.enrolments.filter((e) => e.status === 'requested').length;
    const enrolledIn = (courseId) => data.enrolments.filter((e) => e.courseId === courseId && e.status === 'approved').length;
    const waitingFor = (courseId) => data.enrolments.filter((e) => e.courseId === courseId && e.status === 'requested').length;
    const groupById = Object.fromEntries(data.groups.map((g) => [g.id, g]));
    return { ...data, loading, error, reload, act, pending, enrolledIn, waitingFor, groupById };
}

const STATUS_TONE = {
    requested: 'bg-amber-50 text-amber-800 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    declined: 'bg-red-50 text-red-700 border-red-200',
};

export function EnrolmentPanel({ admin }) {
    const { t } = useTranslation();
    const { courses, isArabic } = useCourseScreen();
    const [status, setStatus] = useState('requested');
    const [courseId, setCourseId] = useState('');
    const [groupId, setGroupId] = useState('');
    const [query, setQuery] = useState('');
    const [picked, setPicked] = useState(new Set());
    const [bulkGroup, setBulkGroup] = useState('general');
    const [enrolOpen, setEnrolOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const titleOf = Object.fromEntries(courses.map((c) => [c.id, c.title]));
    const approvalCourses = courses.filter((c) => !isOpenCourse(c));

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return admin.enrolments
            .filter((e) => !status || e.status === status)
            .filter((e) => !courseId || e.courseId === courseId)
            .filter((e) => !groupId || e.groupId === groupId)
            .filter((e) => !q || `${e.name} ${e.email} ${e.state} ${e.locality}`.toLowerCase().includes(q))
            .sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
    }, [admin.enrolments, status, courseId, groupId, query]);
    useEffect(() => { setPicked(new Set()); }, [status, courseId, groupId, query]);

    const run = async (action, payload, okText) => {
        setBusy(true);
        try { await admin.act(action, payload); setPicked(new Set()); if (okText) notify(okText, 'success'); }
        catch (e) { console.error(e); notify(e?.message || t('imnci_ui.enrol.save_failed', 'Could not save. Try again.'), 'error'); }
        finally { setBusy(false); }
    };
    const decide = (ids, decision) => run('decide', { ids, status: decision, groupId: decision === 'approved' ? bulkGroup : undefined },
        decision === 'approved' ? t('imnci_ui.enrol.approved_n', 'Approved.') : decision === 'declined' ? t('imnci_ui.enrol.declined_n', 'Declined.') : t('imnci_ui.enrol.removed_n', 'Removed.'));
    const remove = async (ids) => {
        if (!await confirmDialog(t('imnci_ui.enrol.remove_confirm', 'Remove these learners from the course? They will need to be enrolled again.'),
            { title: t('imnci_ui.enrol.remove', 'Remove'), confirmLabel: t('imnci_ui.enrol.remove', 'Remove'), danger: true })) return;
        decide(ids, 'removed');
    };
    const count = (s) => admin.enrolments.filter((e) => e.status === s && (!courseId || e.courseId === courseId)).length;
    const chip = (active) => `px-3 py-1.5 rounded-full text-sm font-semibold border whitespace-nowrap ${active ? 'bg-sky-700 text-white border-sky-700' : 'bg-white text-slate-600 border-slate-300 hover:border-sky-400'}`;
    const ids = [...picked];

    if (admin.error) {
        return <Card><CardBody className="text-sm text-red-700">{t('imnci_ui.enrol.load_failed', 'Enrolment could not be loaded.')} {admin.error}</CardBody></Card>;
    }
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <button className={chip(status === 'requested')} onClick={() => setStatus('requested')}>{t('imnci_ui.enrol.requests', 'Requests')} ({count('requested')})</button>
                <button className={chip(status === 'approved')} onClick={() => setStatus('approved')}>{t('imnci_ui.enrol.enrolled', 'Enrolled')} ({count('approved')})</button>
                <button className={chip(status === 'declined')} onClick={() => setStatus('declined')}>{t('imnci_ui.enrol.declined_tab', 'Declined')} ({count('declined')})</button>
                <span className="flex-1" />
                <Button onClick={() => setEnrolOpen(true)} disabled={!approvalCourses.length}><UserPlus size={16} /> {t('imnci_ui.enrol.enrol_learners', 'Enrol learners')}</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Select label={t('imnci_ui.progress.course', 'Course')} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                    <option value="">{t('imnci_ui.progress.all_courses', 'All courses')}</option>
                    {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </Select>
                <Select label={t('imnci_ui.groups.group', 'Group')} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                    <option value="">{t('imnci_ui.groups.all', 'All groups')}</option>
                    {admin.groups.map((g) => <option key={g.id} value={g.id}>{groupName(g, isArabic)}</option>)}
                </Select>
                <Input label={t('imnci_ui.enrol.search', 'Search')} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('imnci_ui.enrol.search_hint', 'Name, email, state…')} />
            </div>

            {picked.size > 0 && (
                <div className="sticky top-0 z-10 rounded-xl border border-sky-200 bg-sky-50 p-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-sky-900">{t('imnci_ui.enrol.n_selected', '{{n}} selected', { n: picked.size })}</span>
                    <select value={bulkGroup} onChange={(e) => setBulkGroup(e.target.value)} className="rounded-md border border-slate-300 p-1.5" aria-label={t('imnci_ui.groups.group', 'Group')}>
                        {admin.groups.map((g) => <option key={g.id} value={g.id}>{groupName(g, isArabic)}</option>)}
                    </select>
                    {status !== 'approved' && <Button size="sm" disabled={busy} onClick={() => decide(ids, 'approved')}><Check size={14} /> {t('imnci_ui.enrol.approve', 'Approve')}</Button>}
                    {status === 'approved' && <Button size="sm" disabled={busy} onClick={() => run('setGroup', { ids, groupId: bulkGroup }, t('imnci_ui.enrol.moved', 'Moved to the group.'))}><Users size={14} /> {t('imnci_ui.enrol.move_group', 'Move to group')}</Button>}
                    {status === 'requested' && <Button size="sm" variant="secondary" disabled={busy} onClick={() => decide(ids, 'declined')}><X size={14} /> {t('imnci_ui.enrol.decline', 'Decline')}</Button>}
                    {status !== 'requested' && <Button size="sm" variant="danger" disabled={busy} onClick={() => remove(ids)}><UserMinus size={14} /> {t('imnci_ui.enrol.remove', 'Remove')}</Button>}
                </div>
            )}

            {admin.loading && !admin.enrolments.length ? (
                <div className="text-sm text-slate-500 py-8 text-center">{t('imnci_ui.enrol.loading', 'Loading…')}</div>
            ) : rows.length === 0 ? (
                <EmptyState title={status === 'requested' ? t('imnci_ui.enrol.no_requests', 'No requests waiting') : t('imnci_ui.enrol.nobody', 'Nobody here yet')}
                    hint={status === 'requested' ? t('imnci_ui.enrol.no_requests_hint', 'When a learner asks to join a course, the request appears here.') : null} />
            ) : (
                <ul className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden" data-testid="enrolment-list">
                    <li className="px-3 py-2 bg-slate-50 flex items-center gap-2 text-xs text-slate-500">
                        <input type="checkbox" checked={picked.size === rows.length} aria-label={t('imnci_ui.enrol.select_all', 'Select all')}
                            onChange={(e) => setPicked(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} />
                        {t('imnci_ui.enrol.n_learners', '{{n}} learners', { n: rows.length })}
                    </li>
                    {rows.map((e) => {
                        const g = admin.groupById[e.groupId];
                        return (
                            <li key={e.id} className="px-3 py-3 flex items-start gap-3">
                                <input type="checkbox" className="mt-1" checked={picked.has(e.id)} aria-label={e.name}
                                    onChange={(ev) => setPicked((p) => { const n = new Set(p); if (ev.target.checked) n.add(e.id); else n.delete(e.id); return n; })} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-slate-900">{e.name || e.email}</span>
                                        <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${STATUS_TONE[e.status]}`}>
                                            {e.status === 'requested' ? t('imnci_ui.enrol.status_requested', 'Asked to join') : e.status === 'approved' ? t('imnci_ui.enrol.status_approved', 'Enrolled') : t('imnci_ui.enrol.status_declined', 'Declined')}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">{[e.email, [e.state, e.locality].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')}</div>
                                    <div className="text-xs text-slate-600 mt-0.5">
                                        {titleOf[e.courseId] || e.courseId}
                                        {e.status === 'approved' && g && <> · <Users size={11} className="inline -mt-0.5" /> {groupName(g, isArabic)}{g.facilitator?.name ? ` (${g.facilitator.name})` : ''}</>}
                                    </div>
                                </div>
                                {e.status === 'requested' && (
                                    <div className="flex gap-1 shrink-0">
                                        <Button size="sm" disabled={busy} onClick={() => decide([e.id], 'approved')} title={t('imnci_ui.enrol.approve_into', 'Approve into the group chosen above')}><Check size={14} /></Button>
                                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => decide([e.id], 'declined')} title={t('imnci_ui.enrol.decline', 'Decline')}><X size={14} /></Button>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            {status === 'requested' && rows.length > 0 && picked.size === 0 && (
                <div className="text-xs text-slate-500 flex items-center gap-2">
                    {t('imnci_ui.enrol.approve_group_hint', 'Approved learners go into:')}
                    <select value={bulkGroup} onChange={(e) => setBulkGroup(e.target.value)} className="rounded-md border border-slate-300 p-1">
                        {admin.groups.map((g) => <option key={g.id} value={g.id}>{groupName(g, isArabic)}</option>)}
                    </select>
                </div>
            )}

            <EnrolModal isOpen={enrolOpen} onClose={() => setEnrolOpen(false)} admin={admin} courses={approvalCourses} defaultCourse={courseId} />
        </div>
    );
}

function EnrolModal({ isOpen, onClose, admin, courses, defaultCourse }) {
    const { t } = useTranslation();
    const { isArabic } = useCourseScreen();
    const [courseId, setCourseId] = useState('');
    const [groupId, setGroupId] = useState('general');
    const [query, setQuery] = useState('');
    const [picked, setPicked] = useState(new Set());
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (isOpen) { setCourseId(defaultCourse && courses.some((c) => c.id === defaultCourse) ? defaultCourse : (courses[0]?.id || '')); setPicked(new Set()); setQuery(''); }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
    const already = new Set(admin.enrolments.filter((e) => e.courseId === courseId && e.status === 'approved').map((e) => e.uid));
    const q = query.trim().toLowerCase();
    const people = admin.people
        .filter((p) => !already.has(p.uid))
        .filter((p) => !q || `${p.name} ${p.email} ${p.state} ${p.locality}`.toLowerCase().includes(q))
        .slice(0, 200);
    const save = async () => {
        setBusy(true);
        try {
            const res = await admin.act('enrol', { courseId, groupId, uids: [...picked] });
            notify(t('imnci_ui.enrol.enrolled_n', '{{n}} enrolled.', { n: res?.enrolled ?? picked.size }), 'success');
            onClose();
        } catch (e) { console.error(e); notify(e?.message || t('imnci_ui.enrol.save_failed', 'Could not save. Try again.'), 'error'); }
        finally { setBusy(false); }
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('imnci_ui.enrol.enrol_learners', 'Enrol learners')}>
            <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Select label={t('imnci_ui.progress.course', 'Course')} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                        {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </Select>
                    <Select label={t('imnci_ui.groups.group', 'Group')} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                        {admin.groups.map((g) => <option key={g.id} value={g.id}>{groupName(g, isArabic)}</option>)}
                    </Select>
                </div>
                <div className="relative">
                    <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('imnci_ui.enrol.search_people', 'Search people by name, email or state')}
                        className="w-full rounded-md border border-slate-300 ps-9 p-2 text-sm" />
                </div>
                <ul className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {people.map((p) => (
                        <li key={p.uid}>
                            <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                                <input type="checkbox" checked={picked.has(p.uid)}
                                    onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(p.uid); else n.delete(p.uid); return n; })} />
                                <span className="min-w-0 flex-1">
                                    <span className="font-medium text-slate-800">{p.name || p.email}</span>
                                    <span className="block text-xs text-slate-500 truncate">{[p.email, [p.state, p.locality].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')}</span>
                                </span>
                            </label>
                        </li>
                    ))}
                    {!people.length && <li className="px-3 py-6 text-center text-sm text-slate-500">{t('imnci_ui.enrol.no_people', 'Nobody found.')}</li>}
                </ul>
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={busy}>{t('imnci_ui.courses.common.cancel', 'Cancel')}</Button>
                    <Button onClick={save} disabled={busy || !picked.size || !courseId}>
                        {busy ? t('imnci_ui.courses.common.saving', 'Saving…') : t('imnci_ui.enrol.enrol_n', 'Enrol {{n}}', { n: picked.size })}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export function GroupsPanel({ admin }) {
    const { t } = useTranslation();
    const { isArabic, courses } = useCourseScreen();
    const [editing, setEditing] = useState(null);
    const titleOf = Object.fromEntries(courses.map((c) => [c.id, c.title]));
    const members = (gid) => admin.enrolments.filter((e) => e.status === 'approved' && e.groupId === gid);
    const remove = async (g) => {
        if (!await confirmDialog(t('imnci_ui.groups.delete_confirm', 'Delete the group "{{name}}"? Its learners move to General learners.', { name: g.name }),
            { title: t('imnci_ui.groups.delete', 'Delete group'), confirmLabel: t('imnci_ui.courses.common.delete', 'Delete'), danger: true })) return;
        try { await admin.act('deleteGroup', { id: g.id }); notify(t('imnci_ui.groups.deleted', 'Group deleted.'), 'success'); }
        catch (e) { notify(e?.message || t('imnci_ui.enrol.save_failed', 'Could not save. Try again.'), 'error'); }
    };
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-slate-600 flex-1 min-w-[14rem]">
                    {t('imnci_ui.groups.intro', 'Learners are placed in a group when they are enrolled. Add a group for a batch, for example "Registrar batch 53", and give it a facilitator if you want one.')}
                </p>
                <Button onClick={() => setEditing({})}><Plus size={16} /> {t('imnci_ui.groups.add', 'Add group')}</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" data-testid="group-list">
                {admin.groups.map((g) => {
                    const list = members(g.id);
                    const perCourse = {};
                    list.forEach((e) => { perCourse[e.courseId] = (perCourse[e.courseId] || 0) + 1; });
                    return (
                        <div key={g.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                            <div className="flex items-start gap-2">
                                <span className="w-9 h-9 rounded-lg bg-sky-50 text-sky-700 grid place-items-center shrink-0"><Users size={18} /></span>
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold text-slate-900">{groupName(g, isArabic)}</div>
                                    <div className="text-xs text-slate-500">
                                        {g.isDefault ? t('imnci_ui.groups.default', 'Default group') : t('imnci_ui.groups.added', 'Added group')}
                                        {' · '}{t('imnci_ui.groups.n_learners', '{{n}} learners', { n: list.length })}
                                    </div>
                                </div>
                                <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500" onClick={() => setEditing(g)} title={t('imnci_ui.groups.edit', 'Edit group')}><Pencil size={15} /></button>
                                {!g.isDefault && <button className="p-1.5 rounded hover:bg-red-50 text-red-600" onClick={() => remove(g)} title={t('imnci_ui.groups.delete', 'Delete group')}><Trash2 size={15} /></button>}
                            </div>
                            {g.description && <p className="text-sm text-slate-600">{g.description}</p>}
                            {g.facilitator ? <FacilitatorCard f={g.facilitator} /> : (
                                <div className="text-xs text-slate-400">{t('imnci_ui.groups.no_facilitator', 'No facilitator')}</div>
                            )}
                            {Object.keys(perCourse).length > 0 && (
                                <ul className="text-xs text-slate-500 space-y-0.5">
                                    {Object.entries(perCourse).map(([cid, n]) => <li key={cid}>{titleOf[cid] || cid}: {n}</li>)}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>
            <GroupModal group={editing} onClose={() => setEditing(null)} admin={admin} />
        </div>
    );
}

function FacilitatorCard({ f }) {
    const { t } = useTranslation();
    return (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-600 space-y-0.5">
            <div className="text-[11px] uppercase tracking-wide font-bold text-slate-500">{t('imnci_ui.groups.facilitator', 'Facilitator')}</div>
            <div className="text-sm font-semibold text-slate-900">{f.name}{f.arabicName ? ` · ${f.arabicName}` : ''}</div>
            {f.phone && <div className="flex items-center gap-1"><Phone size={12} /> <a href={`tel:${f.phone}`} className="hover:underline">{f.phone}</a></div>}
            {f.email && <div className="flex items-center gap-1 truncate"><Mail size={12} /> {f.email}</div>}
            {(f.state || f.locality) && <div className="flex items-center gap-1"><MapPin size={12} /> {[f.state, f.locality].filter(Boolean).join(' / ')}</div>}
            {f.courses?.length > 0 && <div>{f.courses.join(', ')}</div>}
        </div>
    );
}

function GroupModal({ group, onClose, admin }) {
    const { t } = useTranslation();
    const { facilitators, fetchFacilitators } = useDataCache();
    const [form, setForm] = useState({ name: '', description: '', facilitatorId: '' });
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);
    const isOpen = !!group;
    useEffect(() => {
        if (!isOpen) return;
        setForm({ id: group.id, name: group.name || '', description: group.description || '', facilitatorId: group.facilitatorId || '' });
        setQuery('');
        if (!facilitators) fetchFacilitators?.(false);
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
    const list = (facilitators || []).filter((f) => f && f.isDeleted !== true);
    const chosen = list.find((f) => f.id === form.facilitatorId);
    const q = query.trim().toLowerCase();
    const matches = q ? list.filter((f) => `${f.name} ${f.arabicName || ''} ${f.phone || ''} ${f.email || ''} ${f.currentState || ''} ${(f.courses || []).join(' ')}`.toLowerCase().includes(q)).slice(0, 30) : [];
    const save = async () => {
        if (!form.name.trim()) { notify(t('imnci_ui.groups.enter_name', 'Enter the group\'s name.'), 'error'); return; }
        setBusy(true);
        try { await admin.act('saveGroup', { group: form }); notify(t('imnci_ui.groups.saved', 'Group saved.'), 'success'); onClose(); }
        catch (e) { console.error(e); notify(e?.message || t('imnci_ui.enrol.save_failed', 'Could not save. Try again.'), 'error'); }
        finally { setBusy(false); }
    };
    const asCard = (f) => ({ name: f.name, arabicName: f.arabicName, phone: f.phone, email: f.email, state: f.currentState, locality: f.currentLocality, courses: f.courses || [] });
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={group?.id ? t('imnci_ui.groups.edit', 'Edit group') : t('imnci_ui.groups.add', 'Add group')}>
            <div className="space-y-3">
                <Input label={t('imnci_ui.groups.name', 'Name')} value={form.name} placeholder={t('imnci_ui.groups.name_hint', 'e.g. Registrar batch 53')}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Textarea label={t('imnci_ui.courses.common.description', 'Description')} rows={2} value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700">{t('imnci_ui.groups.facilitator_optional', 'Facilitator (optional)')}</div>
                    {form.facilitatorId ? (
                        <div className="space-y-1">
                            {chosen ? <FacilitatorCard f={asCard(chosen)} /> : group?.facilitator ? <FacilitatorCard f={group.facilitator} /> : null}
                            <button className="text-xs text-red-600 underline" onClick={() => setForm({ ...form, facilitatorId: '' })}>{t('imnci_ui.groups.remove_facilitator', 'Remove facilitator')}</button>
                        </div>
                    ) : (
                        <>
                            <div className="relative">
                                <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input value={query} onChange={(e) => setQuery(e.target.value)}
                                    placeholder={facilitators ? t('imnci_ui.groups.search_facilitator', 'Search the facilitator list by name, phone or state') : t('imnci_ui.enrol.loading', 'Loading…')}
                                    className="w-full rounded-md border border-slate-300 ps-9 p-2 text-sm" />
                            </div>
                            {matches.length > 0 && (
                                <ul className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                                    {matches.map((f) => (
                                        <li key={f.id}>
                                            <button className="w-full text-start px-3 py-2 text-sm hover:bg-sky-50" onClick={() => setForm({ ...form, facilitatorId: f.id })}>
                                                <span className="font-medium text-slate-800">{f.name}</span>
                                                <span className="block text-xs text-slate-500 truncate">{[f.phone, f.currentState, (f.courses || []).join(', ')].filter(Boolean).join(' · ')}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {q && !matches.length && facilitators && <div className="text-xs text-slate-500">{t('imnci_ui.enrol.no_people', 'Nobody found.')}</div>}
                        </>
                    )}
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={busy}>{t('imnci_ui.courses.common.cancel', 'Cancel')}</Button>
                    <Button onClick={save} disabled={busy}>{busy ? t('imnci_ui.courses.common.saving', 'Saving…') : t('imnci_ui.courses.common.save', 'Save')}</Button>
                </div>
            </div>
        </Modal>
    );
}
