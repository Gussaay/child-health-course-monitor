import { describe, it, expect } from 'vitest';
import { whatsappNumber, whatsappLink } from '../src/utils/whatsapp';

describe('whatsappNumber', () => {
    it('adds the Sudan code to local numbers', () => {
        expect(whatsappNumber('0912345678')).toBe('249912345678');
        expect(whatsappNumber('912 345 678')).toBe('249912345678');
    });
    it('keeps international numbers', () => {
        expect(whatsappNumber('+249 91 234 5678')).toBe('249912345678');
        expect(whatsappNumber('00966501234567')).toBe('966501234567');
        expect(whatsappNumber('249912345678')).toBe('249912345678');
    });
    it('rejects empty or too short numbers', () => {
        expect(whatsappNumber('')).toBeNull();
        expect(whatsappNumber(null)).toBeNull();
        expect(whatsappNumber('12345')).toBeNull();
    });
});

describe('whatsappLink', () => {
    it('builds a wa.me link with the message', () => {
        expect(whatsappLink('0912345678', 'Hi & bye')).toBe('https://wa.me/249912345678?text=Hi%20%26%20bye');
    });
    it('returns null without a usable number', () => {
        expect(whatsappLink('', 'x')).toBeNull();
    });
});
