// loadWithRetry (src/utils/lazyWithRetry.js): a screen whose code file
// fails to download is retried before the failure reaches the error
// boundary. "Failed to fetch dynamically imported module" is the largest
// family in Admin → Problems; most of those are one dropped download on a
// weak connection, not a broken screen.
import { describe, it, expect, vi } from 'vitest';
import { loadWithRetry, isRetriableLoadError } from '../src/utils/lazyWithRetry';

const noWait = () => Promise.resolve();
const chunkError = () => new TypeError('Failed to fetch dynamically imported module: https://example.com/assets/Course-abc.js');

describe('loadWithRetry', () => {
    it('returns the module on first success, importing once', async () => {
        const factory = vi.fn().mockResolvedValue({ default: 'Screen' });
        await expect(loadWithRetry(factory, { wait: noWait })).resolves.toEqual({ default: 'Screen' });
        expect(factory).toHaveBeenCalledTimes(1);
    });

    it('retries a failed download and succeeds on a later attempt', async () => {
        const factory = vi.fn()
            .mockRejectedValueOnce(chunkError())
            .mockRejectedValueOnce(chunkError())
            .mockResolvedValue({ default: 'Screen' });
        await expect(loadWithRetry(factory, { wait: noWait })).resolves.toEqual({ default: 'Screen' });
        expect(factory).toHaveBeenCalledTimes(3);
    });

    it('waits between attempts, using the next delay each time', async () => {
        const wait = vi.fn(noWait);
        const factory = vi.fn().mockRejectedValue(chunkError());
        await expect(loadWithRetry(factory, { wait, delays: [10, 20] })).rejects.toThrow('dynamically imported module');
        expect(wait.mock.calls.map(([ms]) => ms)).toEqual([10, 20]);
    });

    it('gives up after the retries and throws the load error', async () => {
        const factory = vi.fn().mockRejectedValue(chunkError());
        await expect(loadWithRetry(factory, { wait: noWait })).rejects.toThrow('dynamically imported module');
        expect(factory).toHaveBeenCalledTimes(3); // first attempt + 2 retries
    });

    it('does not retry a real bug in the screen code', async () => {
        const factory = vi.fn().mockRejectedValue(new ReferenceError('groupChecklists is not defined'));
        await expect(loadWithRetry(factory, { wait: noWait })).rejects.toThrow('groupChecklists');
        expect(factory).toHaveBeenCalledTimes(1);
    });

    it('treats an empty module as a load failure, not a screen', async () => {
        const factory = vi.fn().mockResolvedValue(undefined);
        await expect(loadWithRetry(factory, { wait: noWait })).rejects.toThrow('dynamically imported module');
        expect(factory).toHaveBeenCalledTimes(3);
    });

    it('recovers when an empty response is followed by the real module', async () => {
        const factory = vi.fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValue({ default: 'Screen' });
        await expect(loadWithRetry(factory, { wait: noWait })).resolves.toEqual({ default: 'Screen' });
    });
});

describe('isRetriableLoadError', () => {
    it('recognises the load failures seen in problem reports', () => {
        expect(isRetriableLoadError(chunkError())).toBe(true);
        expect(isRetriableLoadError(new Error('error loading dynamically imported module'))).toBe(true);
        expect(isRetriableLoadError(new TypeError('Failed to fetch'))).toBe(true);
        expect(isRetriableLoadError(new Error('Loading chunk 123 failed'))).toBe(true);
    });

    it('leaves ordinary code errors alone', () => {
        expect(isRetriableLoadError(new TypeError("n.label.toLowerCase is not a function"))).toBe(false);
        expect(isRetriableLoadError(new ReferenceError("Cannot access 'Y' before initialization"))).toBe(false);
        expect(isRetriableLoadError(new Error('Missing or insufficient permissions'))).toBe(false);
    });
});
