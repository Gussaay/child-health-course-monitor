// A download that outlives its timeout is still billed by Firestore, so its
// answer must be kept instead of being downloaded again next time.
import { describe, it, expect, vi } from 'vitest';
import { keepLateAnswer } from '../src/utils/keepLateAnswer';

describe('keepLateAnswer', () => {
    it('returns an answer that arrives in time, and does not call onLate', async () => {
        const onLate = vi.fn();
        await expect(keepLateAnswer(Promise.resolve([1, 2]), 1000, onLate)).resolves.toEqual([1, 2]);
        expect(onLate).not.toHaveBeenCalled();
    });

    it('times out for the caller but hands the late answer to onLate', async () => {
        vi.useFakeTimers();
        let finish;
        const slow = new Promise((resolve) => { finish = resolve; });
        const onLate = vi.fn();
        const waiting = keepLateAnswer(slow, 1000, onLate, 'participants');
        const settled = expect(waiting).rejects.toThrow(/timed out/);
        await vi.advanceTimersByTimeAsync(1001);
        await settled;
        finish(['a', 'b', 'c']);
        await vi.runAllTimersAsync();
        expect(onLate).toHaveBeenCalledWith(['a', 'b', 'c']);
        vi.useRealTimers();
    });

    it('passes a failure through and never calls onLate for it', async () => {
        const onLate = vi.fn();
        await expect(keepLateAnswer(Promise.reject(new Error('denied')), 1000, onLate)).rejects.toThrow('denied');
        expect(onLate).not.toHaveBeenCalled();
    });
});
