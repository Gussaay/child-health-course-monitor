import { describe, it, expect } from 'vitest';
import { addInPageBack, runInPageBack } from '../src/utils/inPageBack';

describe('in-page back steps', () => {
    it('returns false when nothing is registered', () => {
        expect(runInPageBack()).toBe(false);
    });
    it('runs the newest step and forgets removed ones', () => {
        const calls = [];
        const removeA = addInPageBack(() => calls.push('a'));
        const removeB = addInPageBack(() => calls.push('b'));
        expect(runInPageBack()).toBe(true);
        removeB();
        runInPageBack();
        removeA();
        expect(runInPageBack()).toBe(false);
        expect(calls).toEqual(['b', 'a']);
    });
});
