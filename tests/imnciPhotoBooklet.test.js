import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import BOOKLET from '../src/components/imnci/photoBooklet.json';

describe('IMNCI photograph booklet', () => {
    it('lists photographs 1 to 82 once, each in one section, each with its file', () => {
        const ns = BOOKLET.photos.map((p) => p.n);
        expect(ns).toEqual(Array.from({ length: 82 }, (_, i) => i + 1));
        BOOKLET.photos.forEach((p) => {
            expect(p.file).toBe(`imnci-photos/photo-${String(p.n).padStart(2, '0')}.jpg`);
            expect(p.caption).toBeTruthy();
            expect(BOOKLET.sections.filter((s) => p.n >= s.from && p.n <= s.to)).toHaveLength(1);
            expect(fs.existsSync(path.join(__dirname, '..', 'scripts', 'imnci-classic-upload', 'photos', path.basename(p.file)))).toBe(true);
        });
    });
});
