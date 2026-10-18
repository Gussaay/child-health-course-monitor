import { describe, it, expect } from 'vitest';
import { leaveForm, setLeaveConfirmer, formSaved, onGuardChange } from '../src/utils/leaveGuard';

describe('leaving a half-filled form', () => {
    it('leaves straight away when no question is registered', () => {
        setLeaveConfirmer(null);
        let left = false;
        leaveForm(() => { left = true; });
        expect(left).toBe(true);
    });
    it('leaves only when the user agrees', async () => {
        const calls = [];
        setLeaveConfirmer(() => Promise.resolve(false));
        leaveForm(() => calls.push('no'));
        setLeaveConfirmer(() => Promise.resolve(true));
        leaveForm(() => calls.push('yes'));
        await Promise.resolve(); await Promise.resolve();
        expect(calls).toEqual(['yes']);
        setLeaveConfirmer(null);
    });
    it('tells listeners when a form is saved', () => {
        let count = 0;
        const off = onGuardChange(() => { count += 1; });
        formSaved();
        off();
        formSaved();
        expect(count).toBe(1);
    });
});
