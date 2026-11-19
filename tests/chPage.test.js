import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { makeChHtml, makeChManifest } from '../scripts/chPage.js';
import { makeEmoncHtml } from '../scripts/emoncPage.js';

const require = createRequire(import.meta.url);
const source = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    .replace('</head>', '<link rel="manifest" href="/manifest.webmanifest"></head>');

describe('ch-sudan start page and link previews', () => {
    const html = makeChHtml(source);
    it('is named Sudan Child Health Online Training and Guidelines', () => {
        const t = 'Sudan Child Health Online Training and Guidelines';
        expect(html).toContain(`<title>${t}</title>`);
        expect(html).toContain(`<meta property="og:title" content="${t}" />`);
        expect(html).toContain(`<meta name="twitter:title" content="${t}" />`);
        expect(html).toContain('href="/ch.webmanifest"');
        expect(JSON.parse(makeChManifest()).name).toBe(t);
    });
    it('has one set of preview tags with a full picture address', () => {
        expect(html.match(/property="og:title"/g)).toHaveLength(1);
        expect(html).toContain('content="https://ch-sudan.web.app/og-ch.png"');
    });
    it('main and EmONC pages keep their own previews', () => {
        expect(source).toContain('property="og:image" content="https://imnci-courses-monitor.web.app/og-main.png"');
        const emonc = makeEmoncHtml(source);
        expect(emonc.match(/property="og:title"/g)).toHaveLength(1);
        expect(emonc).toContain('og:title" content="Emergency Obstetrics');
    });
});

describe('course link page', () => {
    const { withCourseTags } = require('../functions/courseLinkTags.js');
    it('puts the course title in the title and preview tags, escaped', () => {
        const out = withCourseTags(makeChHtml(source), {
            title: 'IMNCI <Module> "1"', description: 'Learn it', siteName: 'Sudan Child Health Online Training and Guidelines',
            image: 'https://ch-sudan.web.app/og-ch.png', url: 'https://ch-sudan.web.app/learn/abc',
        });
        expect(out).toContain('<title>IMNCI &lt;Module&gt; &quot;1&quot; - Sudan Child Health Online Training and Guidelines</title>');
        expect(out.match(/property="og:title"/g)).toHaveLength(1);
        expect(out).toContain('property="og:url" content="https://ch-sudan.web.app/learn/abc"');
        expect(out).toContain('<meta name="description" content="Learn it"');
    });
});
