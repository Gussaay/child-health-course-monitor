import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { blockText, guideOutline, searchGuide, GuideReader } from '../src/components/imnci/FacilitatorGuides';
import { SERVICES, PROTOCOL_SERVICES, serviceLook } from '../src/components/imnci/ProtocolManager';

// A facilitator guide is read as a guideline: chapters (its modules) of
// sections, a search over all of it, one chapter on the page.
const course = { id: 'g', title: 'ETAT facilitator guide', audience: 'facilitators', category: 'ETAT' };
const items = [
    { id: 'm1', kind: 'module', courseId: 'g', order: 1, title: 'Introduction' },
    { id: 'm2', kind: 'module', courseId: 'g', order: 2, title: 'Day 1: Triage' },
    { id: 'm3', kind: 'module', courseId: 'g', order: 3, title: 'Empty chapter' },
    { id: 's1', kind: 'section', courseId: 'g', moduleId: 'm1', order: 1, title: 'How to use this guide', read: [{ type: 'paragraph', text: 'Read the guide <b>before</b> the course.' }] },
    { id: 's2', kind: 'section', courseId: 'g', moduleId: 'm2', order: 2, title: 'Running the triage drill', read: [{ type: 'rich', text: '<ul><li>Ask each participant to triage a child</li></ul>' }] },
    { id: 's3', kind: 'section', courseId: 'g', moduleId: 'm2', order: 1, title: 'Opening the day', read: [{ type: 'table', rows: [['Time', 'Activity'], ['08:30', 'Welcome and triage overview']] }] },
    { id: 's4', kind: 'section', courseId: 'g', moduleId: 'm2', order: 3, title: 'Removed', isDeleted: true, read: [{ type: 'paragraph', text: 'triage gone' }] },
];

describe('facilitator guide reader', () => {
    it('reads every string of a block but links and paths', () => {
        expect(blockText({ type: 'image', path: 'x/y.jpg', caption: 'A <i>warm</i> cot' })).toBe('A warm cot');
        expect(blockText({ type: 'table', rows: [['a', 'b'], ['c &amp; d', 'e']] })).toBe('a b c & d e');
    });

    it('makes chapters of live sections in order, leaving out empty chapters', () => {
        const o = guideOutline(course, items);
        expect(o.map((c) => [c.number, c.title, c.sections.map((s) => s.id)])).toEqual([
            [1, 'Introduction', ['s1']], [2, 'Day 1: Triage', ['s3', 's2']],
        ]);
    });

    it('searches the whole guide, every word, with the chapter of each hit', () => {
        const o = guideOutline(course, items);
        const hits = searchGuide(o, 'triage');
        expect(hits.map((h) => h.section.id)).toEqual(['s3', 's2']);
        expect(hits[0].chapter.title).toBe('Day 1: Triage');
        expect(searchGuide(o, 'participant child').map((h) => h.section.id)).toEqual(['s2']);
        expect(searchGuide(o, 'x')).toEqual([]);
    });

    it('shows one chapter with the contents of all chapters, and the next chapter', () => {
        const html = renderToStaticMarkup(<GuideReader course={course} items={items} place={{ fg: 'g', ch: 'm1', fsec: '' }} go={() => {}} />);
        expect(html).toContain('data-testid="guide-contents"');
        expect(html).toContain('Day 1: Triage');
        expect(html).toContain('Read the guide');
        expect(html).not.toContain('Ask each participant');
        expect(html).toContain('data-testid="guide-next"');
    });
});

describe('Protocol & Course Management', () => {
    it('has a card with an icon for each service, and the IMNCI protocol', () => {
        expect(SERVICES).toEqual(expect.arrayContaining(['IMNCI', 'ETAT', 'EmONC', 'Small & Sick Newborn']));
        expect(SERVICES).not.toContain('Other');
        SERVICES.forEach((s) => expect(serviceLook(s).icon).toBeTruthy());
        expect(PROTOCOL_SERVICES).toContain('IMNCI');
    });
});

describe('the facilitator guide files', () => {
    it('are guides (for facilitators), valid files, each in its service, text only', async () => {
        const fs = await import('fs');
        const { checkPackage } = await import('../src/components/imnci/onlineCourses/coursePackage');
        const load = (f) => JSON.parse(fs.readFileSync(`course-packages/${f}.imnci.json`, 'utf8'));
        [['sudan-etat-facilitator-guide', 'ETAT', 14], ['sudan-imnci-facilitator-guide', 'IMNCI', 15], ['ssnb-facilitator-guide', 'Small & Sick Newborn', 14]]
            .forEach(([f, cat, chapters]) => {
                const p = load(f);
                expect(checkPackage(p, []).errors).toEqual([]);
                expect(p.course).toMatchObject({ audience: 'facilitators', category: cat, lockOrder: false });
                expect(p.modules.length).toBeGreaterThanOrEqual(chapters);
                const types = new Set(p.modules.flatMap((m) => m.sections).flatMap((s) => s.read).map((b) => b.type));
                [...types].forEach((ty) => expect(['heading', 'paragraph', 'rich', 'courselink']).toContain(ty));
                const outline = guideOutline({ id: 'x' }, p.modules.flatMap((m, mi) => [
                    { id: `m${mi}`, kind: 'module', courseId: 'x', order: m.order, title: m.title },
                    ...m.sections.map((s, si) => ({ ...s, id: `m${mi}s${si}`, kind: 'section', courseId: 'x', moduleId: `m${mi}` }))]));
                expect(outline.length).toBe(p.modules.length);
            });
    });
});
