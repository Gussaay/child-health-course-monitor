import { describe, it, expect } from 'vitest';
import {
    findPhoneConflict,
    duplicatePhoneMessage,
    DuplicatePhoneError,
    validateReaddRequest,
    isSoftDeleted,
} from '../src/utils/participantDuplicates.js';

const active = { id: 'a', name: 'Amna', group: 'Group A', phone: '0911', isDeleted: false };
const deleted = { id: 'd', name: 'Dawood', group: 'Group B', phone: '0911', isDeleted: true };

describe('findPhoneConflict', () => {
    it('finds nothing when the only match is the participant being edited', () => {
        expect(findPhoneConflict([active], 'a')).toBeNull();
        expect(findPhoneConflict([], undefined)).toBeNull();
    });

    it('reports an active participant before a deleted one', () => {
        expect(findPhoneConflict([deleted, active])).toEqual({ existing: active, isDeleted: false });
    });

    it('reports a deleted participant when no active one holds the number', () => {
        expect(findPhoneConflict([deleted])).toEqual({ existing: deleted, isDeleted: true });
    });

    it('treats the string "true" as deleted, as the rest of the app does', () => {
        expect(isSoftDeleted({ isDeleted: 'true' })).toBe(true);
        expect(findPhoneConflict([{ ...deleted, isDeleted: 'true' }]).isDeleted).toBe(true);
    });
});

describe('duplicate phone messages', () => {
    it('names the active participant and says what to change', () => {
        const msg = duplicatePhoneMessage({ existing: active, isDeleted: false }, '0911');
        expect(msg).toContain('Amna');
        expect(msg).toContain('What to change');
    });

    it('offers a re-add only for a new participant clashing with a deleted one', () => {
        const add = new DuplicatePhoneError({ existing: deleted, isDeleted: true }, '0911');
        expect(add.code).toBe('DUPLICATE_PHONE');
        expect(add.canRequestReadd).toBe(true);
        expect(add.message).toContain('federal manager');

        const edit = new DuplicatePhoneError({ existing: deleted, isDeleted: true }, '0911', { isEdit: true });
        expect(edit.canRequestReadd).toBe(false);

        const clash = new DuplicatePhoneError({ existing: active, isDeleted: false }, '0911');
        expect(clash.canRequestReadd).toBe(false);
    });
});

describe('validateReaddRequest', () => {
    it('needs a known reason', () => {
        expect(validateReaddRequest({ reason: '' })).not.toBe('');
        expect(validateReaddRequest({ reason: 'made_up' })).not.toBe('');
        expect(validateReaddRequest({ reason: 'refresher_training' })).toBe('');
        expect(validateReaddRequest({ reason: 'deleted_by_mistake' })).toBe('');
    });

    it('needs a note when the reason is "other"', () => {
        expect(validateReaddRequest({ reason: 'other', note: '  ' })).not.toBe('');
        expect(validateReaddRequest({ reason: 'other', note: 'Changed facility' })).toBe('');
    });
});
