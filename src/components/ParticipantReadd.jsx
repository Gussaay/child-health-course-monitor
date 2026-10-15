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
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (isOpen) { setReason(''); setNote(''); setIsSending(false); }
    }, [isOpen]);

    if (!isOpen || !existing) return null;

    const submit = async () => {
        const invalid = validateReaddRequest({ reason, note });
        if (invalid) { await alertDialog(invalid, { title: 'Reason needed' }); return; }
        setIsSending(true);
        try {
            await onSubmit({ reason, note });
        } catch (error) {
            await alertDialog(error.message || 'The request could not be sent.', { title: 'Could not send the request' });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={isSending ? null : onClose} title="Participant already added">
            <div className="p-4 space-y-4">
                <div className="bg-amber-50 border border-amber-300 p-3 rounded-lg flex items-start gap-3 text-sm text-amber-900">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                        The phone number <strong dir="ltr">{participantData?.phone}</strong> was already added to this course for{' '}
                        <strong>{existing.name || 'a participant'}</strong>{existing.group ? ` (${existing.group})` : ''}, who was later deleted.
                        <div className="mt-1">
                            {canApproveDirectly
                                ? 'Choose why they are being added again. As a federal manager you can add them now; the old deleted record will be removed permanently.'
                                : 'Choose why they are being added again. The request goes to a federal manager, and the participant is added once it is approved.'}
                        </div>
                    </div>
                </div>

                <FormGroup label="Why add again?">
                    <Select value={reason} onChange={(e) => setReason(e.target.value)} disabled={isSending}>
                        <option value="">— Choose a reason —</option>
                        {READD_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </Select>
                </FormGroup>
                <FormGroup label={reason === 'other' ? 'Notes (required)' : 'Notes (optional)'}>
                    <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={isSending} />
                </FormGroup>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                    <Button variant="secondary" onClick={onClose} disabled={isSending}>Cancel</Button>
                    <Button variant="primary" onClick={submit} disabled={isSending}>
                        {isSending ? <Spinner size="sm" /> : canApproveDirectly ? 'Add participant again' : 'Send for approval'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export function DeletedParticipantsModal({ isOpen, onClose, course, currentUser, onChanged }) {
    const [tab, setTab] = useState('requests');
    const [requests, setRequests] = useState([]);
    const [deleted, setDeleted] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async () => {
        if (!course?.id) return;
        setIsLoading(true);
        try {
            const [reqs, dels] = await Promise.all([
                listParticipantReaddRequests(course.id, 'pending'),
                listDeletedParticipantsForCourse(course.id),
            ]);
            setRequests(reqs);
            setDeleted(dels);
        } catch (error) {
            await alertDialog(`Could not load deleted participants: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [course?.id]);

    useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

    const handleHardDelete = async (p) => {
        const ok = await confirmDialog(
            `Permanently delete "${p.name}" (${p.phone})?\n\nTheir record and monitoring data are removed for good and cannot be restored. The phone number can then be used again in this course.`,
            { title: 'Delete permanently', confirmLabel: 'Delete permanently', danger: true }
        );
        if (!ok) return;
        setBusyId(p.id);
        try {
            const removed = await permanentlyDeleteRecord('participants', p.id);
            setDeleted((list) => list.filter((d) => d.id !== p.id));
            await onChanged?.({ removed });
        } catch (error) {
            await alertDialog(error.message, { title: 'Could not delete participant' });
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
            await alertDialog(error.message, { title: 'Could not approve the request' });
        } finally {
            setBusyId(null);
        }
    };

    const handleReject = async (r) => {
        const note = await promptDialog(`Reject the request to add "${r.name}" again? You can give a reason (optional).`, { title: 'Reject request', confirmLabel: 'Reject' });
        if (note === null) return;
        setBusyId(r.id);
        try {
            await rejectParticipantReadd(r.id, currentUser, note);
            setRequests((list) => list.filter((x) => x.id !== r.id));
        } catch (error) {
            await alertDialog(error.message, { title: 'Could not reject the request' });
        } finally {
            setBusyId(null);
        }
    };

    const tabClass = (name) => `px-3 py-2 text-sm font-medium border-b-2 ${tab === name ? 'border-sky-600 text-sky-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`;

    return (
        <Modal isOpen={isOpen} onClose={busyId ? null : onClose} title="Deleted participants and re-add requests">
            <div className="p-4 space-y-3">
                <div className="flex gap-2 border-b border-gray-200">
                    <button type="button" className={tabClass('requests')} onClick={() => setTab('requests')}>
                        Re-add requests ({requests.length})
                    </button>
                    <button type="button" className={tabClass('deleted')} onClick={() => setTab('deleted')}>
                        Deleted participants ({deleted.length})
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center p-6"><Spinner /></div>
                ) : tab === 'requests' ? (
                    requests.length === 0 ? (
                        <p className="text-sm text-gray-500 p-4 text-center">No pending re-add requests for this course.</p>
                    ) : (
                        <ul className="space-y-3 max-h-96 overflow-y-auto">
                            {requests.map((r) => (
                                <li key={r.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                                    <div className="font-semibold text-gray-900">{r.name} <span dir="ltr" className="text-gray-500 font-normal">{r.phone}</span></div>
                                    <div className="text-gray-700 mt-1">Reason: <strong>{readdReasonLabel(r.reason)}</strong></div>
                                    {r.note && <div className="text-gray-600 mt-1 whitespace-pre-line">Notes: {r.note}</div>}
                                    <div className="text-xs text-gray-500 mt-1">
                                        Replaces deleted record &ldquo;{r.existingParticipantName || '—'}&rdquo; · requested by {r.requestedBy}{r.requestedAt ? ` · ${formatWhen(r.requestedAt)}` : ''}
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                        <Button variant="primary" onClick={() => handleApprove(r)} disabled={!!busyId}>
                                            {busyId === r.id ? <Spinner size="sm" /> : <><CheckCircle className="w-4 h-4 mr-1" /> Approve and add</>}
                                        </Button>
                                        <Button variant="secondary" onClick={() => handleReject(r)} disabled={!!busyId}>
                                            <XCircle className="w-4 h-4 mr-1" /> Reject
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )
                ) : deleted.length === 0 ? (
                    <p className="text-sm text-gray-500 p-4 text-center">No deleted participants in this course.</p>
                ) : (
                    <ul className="space-y-2 max-h-96 overflow-y-auto">
                        {deleted.map((p) => (
                            <li key={p.id} className="border border-gray-200 rounded-lg p-3 text-sm flex items-center justify-between gap-3">
                                <div>
                                    <div className="font-semibold text-gray-900">{p.name || '—'} <span dir="ltr" className="text-gray-500 font-normal">{p.phone}</span></div>
                                    <div className="text-xs text-gray-500">{[p.group, p.job_title, p.center_name].filter(Boolean).join(' · ')}</div>
                                    {p.lastUpdatedAt && <div className="text-xs text-gray-400">Deleted {formatWhen(p.lastUpdatedAt)}</div>}
                                </div>
                                <Button variant="danger" onClick={() => handleHardDelete(p)} disabled={!!busyId} className="shrink-0">
                                    {busyId === p.id ? <Spinner size="sm" /> : <><Trash2 className="w-4 h-4 mr-1" /> Delete permanently</>}
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Modal>
    );
}
