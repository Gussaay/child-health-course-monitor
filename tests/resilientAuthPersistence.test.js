// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { indexedDBLocalPersistence } from 'firebase/auth';
import { ResilientLocalPersistence, authStorageInfo } from '../src/utils/resilientAuthPersistence.js';

const proto = indexedDBLocalPersistence.prototype;
const KEY = 'firebase:authUser:key:[DEFAULT]';
const USER = { uid: 'u1', stsTokenManager: { refreshToken: 'r' } };

describe('login storage survives an IndexedDB hiccup', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('retries the IndexedDB check before giving up', async () => {
    const spy = vi.spyOn(proto, '_isAvailable')
      .mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const p = new ResilientLocalPersistence()._isAvailable();
    await vi.runAllTimersAsync();
    expect(await p).toBe(true);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(authStorageInfo.idbAvailable).toBe(true);
  });

  it('stays available through localStorage when IndexedDB never works', async () => {
    vi.spyOn(proto, '_isAvailable').mockResolvedValue(false);
    const p = new ResilientLocalPersistence()._isAvailable();
    await vi.runAllTimersAsync();
    expect(await p).toBe(true);
    expect(authStorageInfo.idbAvailable).toBe(false);
  });

  it('keeps the login when IndexedDB is empty or broken', async () => {
    const store = new ResilientLocalPersistence();
    vi.spyOn(proto, '_set').mockResolvedValue();
    await store._set(KEY, USER);
    vi.spyOn(proto, '_get').mockResolvedValue(null);
    expect(await store._get(KEY)).toEqual(USER);
    vi.spyOn(proto, '_get').mockRejectedValue(new Error('backing store'));
    expect(await store._get(KEY)).toEqual(USER);
  });

  it('a real sign-out removes both copies', async () => {
    const store = new ResilientLocalPersistence();
    vi.spyOn(proto, '_set').mockResolvedValue();
    vi.spyOn(proto, '_remove').mockResolvedValue();
    vi.spyOn(proto, '_get').mockResolvedValue(null);
    await store._set(KEY, USER);
    await store._remove(KEY);
    expect(await store._get(KEY)).toBeNull();
  });
});
