// src/components/ParticipantReadd.jsx
//
// Two popups for participants whose phone number is held by a deleted record:
//
//   ReaddRequestModal         shown when someone adds a participant whose phone
//                             number was already used in this course by a
//                             participant who was later deleted. It asks why
//                             they are being added again and sends that to a
//                             federal manager (or, for a federal manager,
//                             adds them straight away).
//
//   DeletedParticipantsModal  federal managers only: pending re-add requests to
//                             approve or reject, and the deleted participants
//                             of this course, which can be removed for good.
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { Modal, Button, FormGroup, Select, Textarea, Spinner } from './CommonComponents';
import { READD_REASONS, readdReasonLabel, validateReaddRequest } from '../utils/participantDuplicates.js';
import {
    listDeletedParticipantsForCourse,
    permanentlyDeleteRecord,
    listParticipantReaddRequests,
    approveParticipantReadd,
    rejectParticipantReadd,
} from '../data.js';
import { alertDialog, confirmDialog, promptDialog } from './dialogs';

const formatWhen = (ts) => {
    const ms = ts?.toMillis?.() ?? (ts?.seconds ? ts.seconds * 1000 : null);
    return ms ? new Date(ms).toLocaleString() : '';
};

export function ReaddRequestModal({ isOpen, onClose, existing, participantData, canApproveDirectly, onSubmit }) {
    const { t } = useTranslation();
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (isOpen) { setReason(''); setNote(''); setIsSending(false); }
    }, [isOpen]);

    if (!isOpen || !existing) return null;

    const submit = async () => {
        const invalid = validateReaddRequest({ reason, note });
        if (invalid) {
            // Same checks as validateReaddRequest, worded here so they can be translated.
            const message = reason === 'other' && READD_REASONS.some((r) => r.value === reason)
                ? t('shared_ui.readd.note_required', 'Write the reason in the notes box when you choose "Other".')
                : t('shared_ui.readd.choose_reason_error', 'Choose why this participant is being added again.');
            await alertDialog(message, { title: t('shared_ui.readd.reason_needed', 'Reason needed') });
            return;
        }
        setIsSending(true);
        try {
            await onSubmit({ reason, note });
        } catch (error) {
            await alertDialog(error.message || t('shared_ui.readd.send_failed', 'The request could not be sent.'), { title: t('shared_ui.readd.send_failed_title', 'Could not send the request') });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={isSending ? null : onClose} title={t('shared_ui.readd.already_added_title', 'Participant already added')}>
            <div className="p-4 space-y-4">
                <div className="bg-amber-50 border border-amber-300 p-3 rounded-lg flex items-start gap-3 text-sm text-amber-900">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                        <Trans
                            i18nKey="shared_ui.readd.already_added_body"
                            defaults="The phone number <phone>{{phone}}</phone> was already added to this course for <name>{{name}}</name>{{group}}, who was later deleted."
                            values={{
                                phone: participantData?.phone ?? '',
                                name: existing.name || t('shared_ui.readd.a_participant', 'a participant'),
                                group: existing.group ? ` (${existing.group})` : '',
                            }}
                            components={{ phone: <strong dir="ltr" />, name: <strong /> }}
                        />
                        <div className="mt-1">
                            {canApproveDirectly
                                ? t('shared_ui.readd.hint_direct', 'Choose why they are being added again. As a federal manager you can add them now; the old deleted record will be removed permanently.')
                                : t('shared_ui.readd.hint_request', 'Choose why they are being added again. The request goes to a federal manager, and the participant is added once it is approved.')}
                        </div>
                    </div>
                </div>

                <FormGroup label={t('shared_ui.readd.why_again', 'Why add again?')}>
                    <Select value={reason} onChange={(e) => setReason(e.target.value)} disabled={isSending}>
                        <option value="">{t('shared_ui.readd.choose_reason', '— Choose a reason —')}</option>
                        {READD_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </Select>
                </FormGroup>
                <FormGroup label={reason === 'other' ? t('shared_ui.readd.notes_required', 'Notes (required)') : t('shared_ui.readd.notes_optional', 'Notes (optional)')}>
                    <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={isSending} />
                </FormGroup>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                    <Button variant="secondary" onClick={onClose} disabled={isSending}>{t('shared_ui.readd.cancel', 'Cancel')}</Button>
                    <Button variant="primary" onClick={submit} disabled={isSending}>
                        {isSending ? <Spinner size="sm" /> : canApproveDirectly ? t('shared_ui.readd.add_again', 'Add participant again') : t('shared_ui.readd.send_for_approval', 'Send for approval')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export function DeletedParticipantsModal({ isOpen, onClose, course, currentUser, onChanged }) {
    const { t } = useTranslation();
    const [tab, setTab] = useState('requests');
    const [requests, setRequests] = useState([]);
    const [deleted, setDeleted] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async () => {
        if (!course?.id) return;
        setIsLoading(true);
        // Loaded separately so one failing (for example re-add requests before
        // the new Firestore rules are deployed) does not hide the other.
        const [reqs, dels] = await Promise.allSettled([
            listParticipantReaddRequests(course.id, 'pending'),
            listDeletedParticipantsForCourse(course.id),
        ]);
        setRequests(reqs.status === 'fulfilled' ? reqs.value : []);
        setDeleted(dels.status === 'fulfilled' ? dels.value : []);
        setIsLoading(false);
        const problems = [
            reqs.status === 'rejected' && `${t('shared_ui.readd.readd_requests_label', 'Re-add requests')}: ${reqs.reason?.message}`,
            dels.status === 'rejected' && `${t('shared_ui.readd.deleted_participants_label', 'Deleted participants')}: ${dels.reason?.message}`,
        ].filter(Boolean);
        if (problems.length) {
            const hint = problems.some((p) => /permission/i.test(p))
                ? `\n\n${t('shared_ui.readd.rules_hint', 'The Firestore security rules on the server are older than this version of the app. Deploy them with: npm run deploy:rules')}`
                : '';
            await alertDialog(`${t('shared_ui.readd.some_not_loaded', 'Some data could not be loaded.')}\n\n${problems.join('\n')}${hint}`, { title: t('shared_ui.readd.load_failed_title', 'Could not load everything') });
        }
    }, [course?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- t only changes with the language

    useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

    const handleHardDelete = async (p) => {
        const ok = await confirmDialog(
            t('shared_ui.readd.hard_delete_confirm', 'Permanently delete "{{name}}" ({{phone}})?\n\nTheir record and monitoring data are removed for good and cannot be restored. The phone number can then be used again in this course.', { name: p.name, phone: p.phone }),
            { title: t('shared_ui.readd.delete_permanently', 'Delete permanently'), confirmLabel: t('shared_ui.readd.delete_permanently', 'Delete permanently'), danger: true }
        );
        if (!ok) return;
        setBusyId(p.id);
        try {
            const removed = await permanentlyDeleteRecord('participants', p.id);
            setDeleted((list) => list.filter((d) => d.id !== p.id));
            await onChanged?.({ removed });
        } catch (error) {
            await alertDialog(error.message, { title: t('shared_ui.readd.delete_failed_title', 'Could not delete participant') });
        } finally {
            setBusyId(null);
        }
    };

    const handleApprove = async (r) => {
        setBusyId(r.id);
        try {
            const { removed, participant } = await approveParticipantReadd(r, currentUser);
            setRequests((list) => list.filter((x) => x.id !== r.id));
            setDeleted((list) => list.filter((d) => d.id !== r.existingParticipantId));
            await onChanged?.({ removed, added: participant });
        } catch (error) {
            await alertDialog(error.message, { title: t('shared_ui.readd.approve_failed_title', 'Could not approve the request') });
        } finally {
            setBusyId(null);
        }
    };

    const handleReject = async (r) => {
        const note = await promptDialog(t('shared_ui.readd.reject_prompt', 'Reject the request to add "{{name}}" again? You can give a reason (optional).', { name: r.name }), { title: t('shared_ui.readd.reject_request', 'Reject request'), confirmLabel: t('shared_ui.readd.reject', 'Reject') });
        if (note === null) return;
        setBusyId(r.id);
        try {
            await rejectParticipantReadd(r.id, currentUser, note);
            setRequests((list) => list.filter((x) => x.id !== r.id));
        } catch (error) {
            await alertDialog(error.message, { title: t('shared_ui.readd.reject_failed_title', 'Could not reject the request') });
        } finally {
            setBusyId(null);
        }
    };

    const tabClass = (name) => `px-3 py-2 text-sm font-medium border-b-2 ${tab === name ? 'border-sky-600 text-sky-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`;

    return (
        <Modal isOpen={isOpen} onClose={busyId ? null : onClose} title={t('shared_ui.readd.modal_title', 'Deleted participants and re-add requests')}>
            <div className="p-4 space-y-3">
                <div className="flex gap-2 border-b border-gray-200">
                    <button type="button" className={tabClass('requests')} onClick={() => setTab('requests')}>
                        {t('shared_ui.readd.tab_requests', 'Re-add requests ({{count}})', { count: requests.length })}
                    </button>
                    <button type="button" className={tabClass('deleted')} onClick={() => setTab('deleted')}>
                        {t('shared_ui.readd.tab_deleted', 'Deleted participants ({{count}})', { count: deleted.length })}
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center p-6"><Spinner /></div>
                ) : tab === 'requests' ? (
                    requests.length === 0 ? (
                        <p className="text-sm text-gray-500 p-4 text-center">{t('shared_ui.readd.no_requests', 'No pending re-add requests for this course.')}</p>
                    ) : (
                        <ul className="space-y-3 max-h-96 overflow-y-auto">
                            {requests.map((r) => (
                                <li key={r.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                                    <div className="font-semibold text-gray-900">{r.name} <span dir="ltr" className="text-gray-500 font-normal">{r.phone}</span></div>
                                    <div className="text-gray-700 mt-1">{t('shared_ui.readd.reason_label', 'Reason:')} <strong>{readdReasonLabel(r.reason)}</strong></div>
                                    {r.note && <div className="text-gray-600 mt-1 whitespace-pre-line">{t('shared_ui.readd.notes_label', 'Notes:')} {r.note}</div>}
                                    <div className="text-xs text-gray-500 mt-1">
                                        {t('shared_ui.readd.replaces', 'Replaces deleted record “{{name}}” · requested by {{by}}', { name: r.existingParticipantName || '—', by: r.requestedBy })}{r.requestedAt ? ` · ${formatWhen(r.requestedAt)}` : ''}
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                        <Button variant="primary" onClick={() => handleApprove(r)} disabled={!!busyId}>
                                            {busyId === r.id ? <Spinner size="sm" /> : <><CheckCircle className="w-4 h-4 me-1" /> {t('shared_ui.readd.approve_add', 'Approve and add')}</>}
                                        </Button>
                                        <Button variant="secondary" onClick={() => handleReject(r)} disabled={!!busyId}>
                                            <XCircle className="w-4 h-4 me-1" /> {t('shared_ui.readd.reject', 'Reject')}
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )
                ) : deleted.length === 0 ? (
                    <p className="text-sm text-gray-500 p-4 text-center">{t('shared_ui.readd.no_deleted', 'No deleted participants in this course.')}</p>
                ) : (
                    <ul className="space-y-2 max-h-96 overflow-y-auto">
                        {deleted.map((p) => (
                            <li key={p.id} className="border border-gray-200 rounded-lg p-3 text-sm flex items-center justify-between gap-3">
                                <div>
                                    <div className="font-semibold text-gray-900">{p.name || '—'} <span dir="ltr" className="text-gray-500 font-normal">{p.phone}</span></div>
                                    <div className="text-xs text-gray-500">{[p.group, p.job_title, p.center_name].filter(Boolean).join(' · ')}</div>
                                    {p.lastUpdatedAt && <div className="text-xs text-gray-400">{t('shared_ui.readd.deleted_at', 'Deleted {{when}}', { when: formatWhen(p.lastUpdatedAt) })}</div>}
                                </div>
                                <Button variant="danger" onClick={() => handleHardDelete(p)} disabled={!!busyId} className="shrink-0">
                                    {busyId === p.id ? <Spinner size="sm" /> : <><Trash2 className="w-4 h-4 me-1" /> {t('shared_ui.readd.delete_permanently', 'Delete permanently')}</>}
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Modal>
    );
}
