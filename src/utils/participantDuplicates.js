// src/utils/participantDuplicates.js
//
// One phone number, one participant, per course. That rule stops the same
// health worker being counted twice, but a soft-deleted participant keeps its
// phone number, so deleting someone by mistake (or wanting them back for a
// refresher) used to leave them impossible to add again.
//
// This module is the pure part of the fix: deciding what a phone clash is and
// what to tell the person who hit it. The Firestore side lives in data.js.

export const READD_REASONS = [
    { value: 'refresher_training', label: 'تدريب تنشيطي (Refresher training)' },
    { value: 'deleted_by_mistake', label: 'تم الحذف بالخطأ (Deleted by mistake)' },
    { value: 'other', label: 'سبب آخر (Other)' },
];

export const readdReasonLabel = (value) =>
    READD_REASONS.find((r) => r.value === value)?.label || value || '';

export const isSoftDeleted = (p) => p?.isDeleted === true || p?.isDeleted === 'true';

export const normalizePhone = (phone) => String(phone ?? '').trim();

/**
 * Given the participants of one course that share a phone number, say which
 * one blocks the save. An active participant always wins over a deleted one,
 * because that is the clash the user can actually fix by editing.
 *
 * @param {Array<object>} matches  participants with the same courseId and phone
 * @param {string} [selfId]        the participant being edited, which never clashes with itself
 * @returns {null | {existing: object, isDeleted: boolean}}
 */
export function findPhoneConflict(matches, selfId) {
    const others = (matches || []).filter((p) => p && p.id && p.id !== selfId);
    if (!others.length) return null;
    const active = others.find((p) => !isSoftDeleted(p));
    const existing = active || others[0];
    return { existing, isDeleted: !active };
}

/**
 * The message shown in the popup. It names the participant already holding the
 * number and says exactly what to change.
 */
export function duplicatePhoneMessage({ existing, isDeleted }, phone, { isEdit = false } = {}) {
    const who = existing?.name ? `"${existing.name}"` : 'another participant';
    const group = existing?.group ? ` (${existing.group})` : '';
    if (!isDeleted) {
        return `Phone number ${phone} is already used by ${who}${group}, who is active in this course.\n\n`
            + `What to change: ${isEdit ? 'enter this participant\'s own phone number' : 'if this is the same person, edit their existing record instead of adding them again; otherwise correct the phone number'}.`;
    }
    if (isEdit) {
        return `Phone number ${phone} belongs to ${who}${group}, who was deleted from this course.\n\n`
            + 'What to change: enter a different phone number, or ask a federal manager to permanently delete the old record from "Deleted participants" first.';
    }
    return `Phone number ${phone} was already added to this course for ${who}${group}, who was later deleted.\n\n`
        + 'To add this participant again, choose why and send the request to a federal manager for approval.';
}

/** Error thrown by upsertParticipant so the screen can open the right popup. */
export class DuplicatePhoneError extends Error {
    constructor(conflict, phone, options = {}) {
        super(duplicatePhoneMessage(conflict, phone, options));
        this.name = 'DuplicatePhoneError';
        this.code = 'DUPLICATE_PHONE';
        this.phone = phone;
        this.existing = conflict.existing;
        this.isDeleted = conflict.isDeleted;
        this.canRequestReadd = conflict.isDeleted && !options.isEdit;
    }
}

/**
 * Validate a re-add request before it is written.
 * @returns {string} an error message, or '' when it is fine
 */
export function validateReaddRequest({ reason, note }) {
    if (!READD_REASONS.some((r) => r.value === reason)) return 'Choose why this participant is being added again.';
    if (reason === 'other' && !String(note ?? '').trim()) return 'Write the reason in the notes box when you choose "Other".';
    return '';
}
