import { describe, it, expect, beforeEach } from 'vitest';
import { readRemembered, writeRemembered } from '../src/utils/rememberedState';

const store = new Map();
globalThis.window = globalThis.window || {};
window.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
};

describe('remembered filters', () => {
    beforeEach(() => store.clear());

    it('returns the initial value when nothing is saved', () => {
        expect(readRemembered('a', 'x')).toBe('x');
        expect(readRemembered('a', () => ({ s: 1 }))).toEqual({ s: 1 });
    });

    it('reads back what was written', () => {
        writeRemembered('page.state', 'Khartoum');
        writeRemembered('page.obj', { year: 2026, type: '' });
        expect(readRemembered('page.state', '')).toBe('Khartoum');
        expect(readRemembered('page.obj', {})).toEqual({ year: 2026, type: '' });
    });

    it('falls back on bad JSON', () => {
        store.set('filters:bad', '{oops');
        expect(readRemembered('bad', 'ok')).toBe('ok');
    });
});
