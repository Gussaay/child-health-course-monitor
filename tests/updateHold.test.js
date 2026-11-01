import { describe, it, expect } from 'vitest';
import { localStamp } from '../src/utils/updateHold.js';

describe('updateHold', () => {
  it('writes the hold date the way the Android plugin reads it', () => {
    const ms = new Date(2026, 9, 31, 7, 4, 5, 7).getTime(); // local time
    expect(localStamp(ms)).toBe('2026-10-31T07:04:05.007');
  });
});
