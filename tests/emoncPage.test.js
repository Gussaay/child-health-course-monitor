import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeEmoncHtml } from '../scripts/emoncPage.js';

// The EmONC site's start page (dist/emonc.html) is made from index.html at build
// time; it must not say "Child Health Program" anywhere a visitor or a link
// preview can see it.
describe('EmONC start page', () => {
    const source = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
        .replace('</head>', '<link rel="manifest" href="/manifest.webmanifest"></head>');
    const html = makeEmoncHtml(source);

    it('uses the EmONC title, description, logo and manifest', () => {
        expect(html).toContain('<title>Emergency Obstetrics and Newborn Care (EmONC)</title>');
        expect(html).toMatch(/<meta name="description" content="Emergency Obstetrics and Newborn Care \(EmONC\)/);
        expect(html).toMatch(/<link rel="icon"[^>]*href="\/emonc-logo.png"/);
        expect(html).toMatch(/<link rel="apple-touch-icon" href="\/emonc-logo.png"/);
        expect(html).toContain('href="/emonc.webmanifest"');
        expect(html).toContain('<div class="boot-logo"><img src="/emonc-logo.png"');
    });

    it('never mentions the Child Health Program', () => {
        expect(html).not.toMatch(/Child Health|NCHP|logo-160/i);
    });

    it('leaves the main index.html as it was', () => {
        expect(source).toContain('<title>Child Health Program Monitoring System</title>');
    });
});
