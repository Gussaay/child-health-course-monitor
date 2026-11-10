// Protocol management's booklet view: the national protocol laid out page by
// page as the chart booklet prints it.
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const render = (el) => { document.body.innerHTML = renderToStaticMarkup(el); };
const byText = (txt) => [...document.querySelectorAll('table *, h3, div')].find((n) => n.children.length === 0 && n.textContent.trim() === txt);
import { NATIONAL_PROTOCOLS as P } from '../src/components/imnci/nationalProtocol';
import { BookletProtocolView, BookletDoseView, bookletPagesFor } from '../src/components/imnci/bookletView';
import { ruleSigns } from '../src/components/imnci/bookletLayout';

describe('booklet pages', () => {
    it('puts the three diarrhoea tables on one page, like the booklet', () => {
        const pages = bookletPagesFor('child', P.child.categories);
        expect(pages.map((p) => p.id)).toEqual(['danger', 'cough', 'diarrhea', 'fever', 'ear', 'malnutrition', 'anemia']);
        expect(pages.find((p) => p.id === 'diarrhea').categories).toEqual(['diarrhea', 'persistent_diarrhea', 'dysentery']);
    });
    it('still shows a table added by hand', () => {
        const cats = { ...P.child.categories, extra: { title: 'My table', rules: [{ id: 'x', type: 'ALL', conditions: ['wheeze'], classification: { label: 'X', color: 'bg-green-500' }, treatments: [] }] } };
        expect(bookletPagesFor('child', cats).at(-1)).toMatchObject({ id: 'extra', title: 'My table' });
    });
    it('every national rule has printed signs', () => {
        ['child', 'infant'].forEach((k) => Object.values(P[k].categories).forEach((c) => c.rules.forEach((r) => {
            expect(r.signs?.length, r.id).toBeGreaterThan(0);
        })));
    });
    it('a hand-written rule falls back to its conditions', () => {
        expect(ruleSigns({ id: 'mine', type: 'ANY', conditions: ['chestIndrawing', 'stridor'] })).toEqual(['Chest indrawing', 'or Stridor']);
    });
});

describe('booklet view', () => {
    it('shows the question, the signs, the classification and the dose name', () => {
        render(<BookletProtocolView formType="child" protocol={P.child} doses={P.dosages_child.drugs} />);
        expect(byText('Does the child have cough or difficult breathing?')).toBeTruthy();
        const row = [...document.querySelectorAll('td')].find((td) => td.textContent.trim() === 'Pneumonia').closest('tr');
        expect(row.textContent).toContain('Chest indrawing');
        expect(row.textContent).toMatch(/amoxicillin/i);
        expect(row.textContent).not.toContain('{{dose');
    });
    it('shows dose tables with booklet bands', () => {
        render(<BookletDoseView protocol={P.dosages_infant} />);
        expect(document.body.textContent).toMatch(/gentamicin/i);
        expect(document.body.textContent).not.toContain('99.99');
    });
});

describe('editing in the booklet layout', () => {
    const noop = () => {};
    const edit = { onRule: noop, onClass: noop, onDrug: noop, onRange: noop, addRange: noop, removeRange: noop };
    it('picks signs and classifications from the standard list, and doses from the drugs', () => {
        render(<BookletProtocolView formType="child" protocol={P.child} doses={P.dosages_child.drugs} edit={edit} pageIds={['cough']} />);
        const selects = [...document.querySelectorAll('select')];
        const selected = (sel) => sel.querySelector('option[selected]')?.getAttribute('value') ?? '';
        // Signs: one select per line, set to the saved sign.
        expect(selects.map(selected)).toEqual(expect.arrayContaining(['Chest indrawing', 'or Fast breathing']));
        // Classification: a select set to the saved label, with the national list to choose from.
        const cls = selects.find((sel) => selected(sel) === P.child.categories.cough.rules[1].classification.label);
        expect(cls).toBeTruthy();
        expect([...cls.querySelectorAll('option')].map((o) => o.textContent)).toEqual(expect.arrayContaining(['+ New classification…']));
        // Doses: chosen, never typed as {{dose:…}}.
        expect(selects.some((sel) => selected(sel) === 'amoxicillin')).toBe(true);
        expect([...document.querySelectorAll('textarea, input')].some((el) => (el.value || el.textContent).includes('{{dose:'))).toBe(false);
        // Page title, question and the ASK / LOOK box are editable too.
        const inputs = [...document.querySelectorAll('input[type=text]')].map((el) => el.getAttribute('value'));
        expect(inputs).toContain('Assess and classify for cough or difficult breathing');
        expect(inputs).toContain('Does the child have cough or difficult breathing?');
        expect([...document.querySelectorAll('textarea')].some((el) => el.textContent.includes('Count the breaths in one minute'))).toBe(true);
    });
    it('shows saved page wording over the booklet, in both languages', () => {
        const child = { ...P.child, pages: { cough: { title: 'Cough page', note: 'My note' } } };
        render(<BookletProtocolView formType="child" protocol={child} doses={P.dosages_child.drugs} pageIds={['cough']} />);
        expect(document.body.textContent).toContain('Cough page');
        expect(document.body.textContent).toContain('My note');
    });
    it('turns dose bands into inputs with add and remove', () => {
        render(<BookletDoseView protocol={P.dosages_child} edit={edit} />);
        expect([...document.querySelectorAll('input')].some((i) => i.getAttribute('value') === '5 ml syrup (250 mg/5 ml) OR 1 tablet (250 mg)')).toBe(true);
        expect(document.body.textContent).toContain('Add Dose Range');
    });
});
