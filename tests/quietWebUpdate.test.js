import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// A fresh copy of the module for every test: it keeps state at module level.
async function load() {
  vi.resetModules();
  return import('../src/utils/quietWebUpdate.js');
}

let visibility = 'visible';
const setVisibility = (v) => {
  visibility = v;
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('applyWebUpdateQuietly', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    document.body.innerHTML = '';
  });
  afterEach(() => vi.useRealTimers());

  it('never switches while the app is on screen', async () => {
    const { applyWebUpdateQuietly } = await load();
    const apply = vi.fn();
    applyWebUpdateQuietly(apply);
    vi.advanceTimersByTime(3 * 60 * 60 * 1000);
    expect(apply).not.toHaveBeenCalled();
  });

  it('switches after a minute in the background', async () => {
    const { applyWebUpdateQuietly } = await load();
    const apply = vi.fn();
    applyWebUpdateQuietly(apply);
    setVisibility('hidden');
    vi.advanceTimersByTime(50 * 1000);
    expect(apply).not.toHaveBeenCalled();
    vi.advanceTimersByTime(20 * 1000);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('does not switch after a short trip away', async () => {
    const { applyWebUpdateQuietly } = await load();
    const apply = vi.fn();
    applyWebUpdateQuietly(apply);
    setVisibility('hidden');
    vi.advanceTimersByTime(30 * 1000);
    setVisibility('visible');
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(apply).not.toHaveBeenCalled();
  });

  it('never switches as the app comes back on screen, even after a long time', async () => {
    const { applyWebUpdateQuietly } = await load();
    const apply = vi.fn();
    applyWebUpdateQuietly(apply);
    setVisibility('hidden');
    // A frozen page: the timer never got to run.
    vi.setSystemTime(Date.now() + 5 * 60 * 60 * 1000);
    setVisibility('visible');
    expect(apply).not.toHaveBeenCalled();
  });

  it('waits while a form or popup is open', async () => {
    const { applyWebUpdateQuietly } = await load();
    const apply = vi.fn();
    let busy = true;
    applyWebUpdateQuietly(apply, { busy: () => busy });
    setVisibility('hidden');
    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(apply).not.toHaveBeenCalled();
    busy = false;
    document.body.innerHTML = '<div role="dialog"></div>';
    setVisibility('visible');
    setVisibility('hidden');
    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(apply).not.toHaveBeenCalled();
    document.body.innerHTML = '';
    setVisibility('visible');
    setVisibility('hidden');
    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
