// Protocol management, phase 4: the Arabic protocol, the recording forms,
// the change history and the Child / Infant layout.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const cache = { protocols: null, isLoading: { imnciProtocols: true }, fetchProtocols: vi.fn() };
vi.mock('../src/DataContext', () => ({ useDataCache: () => ({ ...cache }) }));
vi.mock('../src/data', () => ({ saveIMNCIProtocol: vi.fn(), appendIMNCIProtocolHistory: vi.fn(), getIMNCIProtocolHistory: vi.fn(async () => []) }));
vi.mock('../src/firebase', () => ({ db: {}, auth: { currentUser: null } }));

import i18n from '../src/i18n';
import { NATIONAL_PROTOCOLS as P } from '../src/components/imnci/nationalProtocol';
import { evaluateProtocol, resolveDoseTag, computeChildFindings } from '../src/components/imnci/engine';
import { ruleText } from '../src/components/imnci/bookletView';
import { NATIONAL_FORMS } from '../src/components/imnci/recordingForms';
import { RecordingFormView } from '../src/components/imnci/recordingFormView';
import { diffProtocol, currentEditor } from '../src/components/imnci/protocolHistory';
import ProtocolEditor from '../src/components/imnci/protocol';
import { NATIONAL_GUIDES } from '../src/components/imnci/treatmentGuides';
import { TreatmentGuideView } from '../src/components/imnci/treatmentGuideView';
import { BookletDoseView } from '../src/components/imnci/bookletView';

const ARABIC = /[؀-ۿ]/;
// The English protocol as it is saved live today: no Arabic fields at all.
const stripAr = (v) => JSON.parse(JSON.stringify(v, (k, val) => (/Ar$/.test(k) ? undefined : val)));

describe('Arabic protocol', () => {
    it('every national classification, sign and treatment has Arabic', () => {
        ['child', 'infant'].forEach((k) => Object.values(P[k].categories).forEach((c) => {
            expect(c.titleAr, c.title).toMatch(ARABIC);
            c.rules.forEach((r) => {
                const text = ruleText(r, true);
                expect(text.label, r.id).toMatch(ARABIC);
                text.signs.forEach((l) => expect(l, `${r.id} sign`).toMatch(ARABIC));
                text.treatments.forEach((l) => expect(l, `${r.id} treatment`).toMatch(ARABIC));
            });
        }));
    });
    it('every national dose band has Arabic', () => {
        ['dosages_child', 'dosages_infant'].forEach((k) => P[k].drugs.forEach((d) => {
            expect(d.labelAr, d.id).toMatch(ARABIC);
            d.rules.forEach((r) => expect(r.doseQtyAr, d.id).toMatch(ARABIC));
        }));
    });
    it('the patient form shows Arabic even from a protocol saved without Arabic', () => {
        const child = stripAr(P.child);
        const doses = stripAr(P.dosages_child);
        const out = evaluateProtocol(computeChildFindings({ pallor: 'noPallor', hasCough: true, chestIndrawing: true }, '-2 Z or more'), child, {}, 8, 9, doses, 'ar');
        const cough = out.cough;
        expect(cough.c[0].labelAr).toMatch(ARABIC);
        cough.t.forEach((l) => expect(l).toMatch(ARABIC));
        expect(resolveDoseTag('amoxicillin', 8, 9, doses, 'ar')).toMatch(ARABIC);
    });
    it('English stays English', () => {
        const out = evaluateProtocol(computeChildFindings({ pallor: 'noPallor', hasCough: true, chestIndrawing: true }, '-2 Z or more'), P.child, {}, 8, 9, P.dosages_child, 'en');
        Object.values(out).flatMap((v) => v.t).forEach((l) => expect(l).not.toMatch(ARABIC));
    });
});

describe('recording forms', () => {
    const render = (el) => { document.body.innerHTML = renderToStaticMarkup(el); };
    it('has both forms in both languages, section by section', () => {
        ['form_child', 'form_infant'].forEach((k) => {
            const f = NATIONAL_FORMS[k];
            expect(f.en.title).toBeTruthy();
            expect(f.ar.title).toMatch(ARABIC);
            f.sections.forEach((s) => { expect(s.en.title, s.id).toBeTruthy(); expect(s.ar.title, s.id).toMatch(ARABIC); });
        });
    });
    it('lays the child form out as printed, in English', async () => {
        await i18n.changeLanguage('en');
        render(<RecordingFormView form={NATIONAL_FORMS.form_child} onChange={() => {}} />);
        expect(document.body.textContent).toContain('Management of the sick child age 2 months up to 5 years');
        expect(document.body.textContent).toContain('Identify treatment');
        expect(document.querySelectorAll('textarea').length).toBe(0);
    });
    it('opens in Arabic when the app is in Arabic', async () => {
        await i18n.changeLanguage('ar');
        render(<RecordingFormView form={NATIONAL_FORMS.form_infant} onChange={() => {}} />);
        expect(document.querySelector('[dir="rtl"]')).toBeTruthy();
        expect(document.body.textContent).toContain(NATIONAL_FORMS.form_infant.ar.title);
        await i18n.changeLanguage('en');
    });
    it('turns every cell into a text box when editing', () => {
        render(<RecordingFormView form={NATIONAL_FORMS.form_child} edit={{}} onChange={() => {}} />);
        expect(document.querySelectorAll('textarea').length).toBeGreaterThan(NATIONAL_FORMS.form_child.sections.length * 4);
        expect(document.body.textContent).toContain('Add section');
    });
});

describe('treatment and counselling tables', () => {
    const render = (el) => { document.body.innerHTML = renderToStaticMarkup(el); };
    it('has the asked headings under each part', () => {
        expect(NATIONAL_GUIDES.guide_child.groups.map((g) => g.id)).toEqual(['vaccination', 'inhaler', 'local', 'fluids', 'counsel', 'followup']);
        expect(NATIONAL_GUIDES.guide_infant.groups.map((g) => g.id)).toEqual(['vaccination', 'local', 'counsel', 'followup']);
    });
    it('every box is written in both languages, line for line and row for row', () => {
        Object.values(NATIONAL_GUIDES).forEach((guide) => guide.groups.forEach((g) => {
            expect(g.ar.title, g.id).toMatch(ARABIC);
            g.blocks.forEach((b) => {
                expect(b.en.title, b.id).toBeTruthy();
                expect(b.ar.title, b.id).toMatch(ARABIC);
                expect((b.ar.lines || []).length, b.id).toBe((b.en.lines || []).length);
                (b.ar.lines || []).forEach((l) => expect(l, b.id).toMatch(ARABIC));
                expect((b.ar.rows || []).length, b.id).toBe((b.en.rows || []).length);
                (b.en.rows || []).forEach((r) => expect(r.length, b.id).toBe(b.en.columns.length));
            });
        }));
    });
    it('shows a heading\'s boxes and tables, with inputs only when editing', async () => {
        await i18n.changeLanguage('en');
        render(<TreatmentGuideView guide={NATIONAL_GUIDES.guide_child} onChange={() => {}} />);
        expect(document.body.textContent).toContain('Vaccination schedule');
        expect(document.body.textContent).toContain('Pentavalent 1');
        expect(document.querySelectorAll('textarea, input[type=text]').length).toBe(0);
        render(<TreatmentGuideView guide={NATIONAL_GUIDES.guide_child} edit={{}} onChange={() => {}} />);
        expect(document.querySelectorAll('textarea').length).toBeGreaterThan(10);
        expect(document.body.textContent).toContain('Add row');
    });
    it('records a changed table row', () => {
        const next = JSON.parse(JSON.stringify(NATIONAL_GUIDES.guide_infant));
        next.groups[0].blocks[0].en.rows[0][1] = 'BCG, OPV 0, Hep B';
        const [c] = diffProtocol('guide_infant', NATIONAL_GUIDES.guide_infant, next);
        expect(c.where).toMatch(/Immunization schedule › EN › row 1/);
        expect(c.after).toBe('BCG, OPV 0, Hep B');
    });
});

describe('drug tables', () => {
    it('are tables on a phone too, with age and weight in separate columns, then dose', () => {
        document.body.innerHTML = renderToStaticMarkup(<BookletDoseView protocol={P.dosages_child} />);
        const phone = document.querySelector('table.md\\:hidden');
        expect(phone).toBeTruthy();
        expect([...phone.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Age', 'Weight', 'Dose']);
        expect(phone.querySelectorAll('tbody tr').length).toBe(P.dosages_child.drugs[0].rules.length);
        expect(phone.querySelector('tbody tr').children.length).toBe(3);
    });
    it('show only the doses asked for, keeping their place in the document', () => {
        const i = P.dosages_child.drugs.findIndex((d) => d.id === 'zinc');
        document.body.innerHTML = renderToStaticMarkup(<BookletDoseView protocol={P.dosages_child} only={[i]} />);
        expect(document.querySelectorAll('h3')).toHaveLength(1);
        expect(document.querySelector('h3').textContent).toContain('Zinc');
    });
});

describe('change history', () => {
    it('names the classification and field that changed, with before and after', () => {
        const after = JSON.parse(JSON.stringify(P.child));
        const cat = Object.values(after.categories)[1];
        cat.rules[0].treatments = [...cat.rules[0].treatments, 'Follow up in 2 days'];
        const changes = diffProtocol('child', P.child, after);
        expect(changes).toHaveLength(1);
        expect(changes[0].where).toContain(cat.rules[0].classification.label);
        expect(changes[0].where).toContain('treatments');
        expect(changes[0].after).toBe('Follow up in 2 days');
        expect(changes[0].before).toBe('');
    });
    it('reads dose band and form cell changes', () => {
        const doses = JSON.parse(JSON.stringify(P.dosages_child));
        doses.drugs[0].rules[0].doseQty = '9 tabs';
        expect(diffProtocol('dosages_child', P.dosages_child, doses)[0].where).toMatch(/band 1 › doseQty/);
        const form = JSON.parse(JSON.stringify(NATIONAL_FORMS.form_child));
        form.sections[0].ar.ask = ['سؤال جديد'];
        const [c] = diffProtocol('form_child', NATIONAL_FORMS.form_child, form);
        expect(c.where).toContain('AR › ask');
        expect(c.after).toBe('سؤال جديد');
    });
    it('records nothing when nothing changed', () => {
        expect(diffProtocol('infant', P.infant, JSON.parse(JSON.stringify(P.infant)))).toEqual([]);
    });
    it('takes who and their role from the signed-in account', () => {
        const store = { getItem: (k) => (k === 'backup_role_u1' ? 'federal_manager' : null) };
        expect(currentEditor({ uid: 'u1', displayName: 'Qusay', email: 'q@x.org' }, store)).toEqual({ userId: 'u1', name: 'Qusay', email: 'q@x.org', role: 'federal_manager' });
    });
});

describe('Protocol management layout', () => {
    let host, root;
    beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
    afterEach(() => { act(() => root.unmount()); host.remove(); });
    const open = async (protocols) => {
        cache.protocols = protocols;
        cache.isLoading = { imnciProtocols: false };
        cache.fetchProtocols = vi.fn(async () => protocols);
        await act(async () => { root.render(<ProtocolEditor />); });
    };
    const button = (txt) => [...host.querySelectorAll('button')].find((b) => b.textContent.trim() === txt);

    it('offers the national load only while nothing is saved', async () => {
        await open({});
        expect(host.textContent).toContain('Load Sudan national protocol');
        await act(async () => { root.render(<div />); });
        await open({ child: P.child, infant: P.infant, dosages_child: P.dosages_child, dosages_infant: P.dosages_infant });
        expect(host.textContent).not.toContain('Load Sudan national protocol');
    });
    it('has Child and Infant parts with one tab per illness, General and Recording form', async () => {
        await open({ child: P.child, infant: P.infant, dosages_child: P.dosages_child, dosages_infant: P.dosages_infant });
        ['Danger signs', 'Pneumonia / cough', 'Diarrhoea', 'Fever, malaria & measles', 'Ear problem', 'Malnutrition', 'Anaemia', 'General', 'Recording form'].forEach((s) => expect(button(s)).toBeTruthy());
        expect(button('Classification')).toBeFalsy();
        expect(host.textContent).toContain('Sick child (2 months – 5 years)');
        expect(host.textContent).toContain('Young infant (up to 2 months)');
        expect(host.textContent).not.toContain('Save Database');
    });
    it('shows Save changes and Cancel only after Edit', async () => {
        await open({ child: P.child, infant: P.infant });
        expect(button('Save changes')).toBeFalsy();
        await act(async () => { button('Edit').click(); });
        expect(button('Save changes')).toBeTruthy();
        expect(button('Cancel')).toBeTruthy();
        await act(async () => { button('Cancel').click(); });
        expect(button('Save changes')).toBeFalsy();
    });
    it('shows an illness as classification, then its doses, counselling and follow-up', async () => {
        await open({ child: P.child, infant: P.infant, dosages_child: P.dosages_child, dosages_infant: P.dosages_infant });
        await act(async () => { button('Pneumonia / cough').click(); });
        const steps = [...host.querySelectorAll('h3[data-step]')].map((h) => h.textContent.replace(/^\d+/, '').trim());
        expect(steps).toEqual(['Classify', 'Drug doses', 'Treatment', 'Counsel the mother', 'Follow-up']);
        const section = (key) => host.querySelector(`h3[data-step=${key}]`).parentElement;
        expect(section('classify').textContent).toContain('Chest indrawing');
        expect(section('drugs').querySelector('h3:not([data-step])').textContent).toContain('Amoxicillin (oral)');
        expect(section('treat').textContent).toContain('Give inhaled salbutamol');
        expect(section('counsel').textContent).toContain('Increase fluid during illness');
        expect(section('followup').textContent).toContain('PNEUMONIA, after 3 days');
        const text = host.textContent;
        // Another illness's doses and boxes are not on this tab.
        expect(text).not.toContain('Plan C: treat severe dehydration quickly');
        expect(text).not.toContain('Artemether-lumefantrine');
    });
    it('keeps edits when moving between illnesses and saves every changed document', async () => {
        const data = await import('../src/data');
        data.saveIMNCIProtocol.mockClear();
        vi.spyOn(window, 'alert').mockImplementation(() => {});
        await open({ child: P.child, infant: P.infant, dosages_child: P.dosages_child, dosages_infant: P.dosages_infant, guide_child: NATIONAL_GUIDES.guide_child });
        await act(async () => { button('Edit').click(); });
        await act(async () => { button('Pneumonia / cough').click(); });
        const setValue = (el, v) => {
            const proto = Object.getPrototypeOf(el);
            Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
            el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const doseInput = [...host.querySelectorAll('input')].find((el) => el.value === 'Amoxicillin (oral)');
        await act(async () => { setValue(doseInput, 'Amoxicillin DT'); });
        await act(async () => { button('Diarrhoea').click(); });
        await act(async () => { button('Pneumonia / cough').click(); });
        expect([...host.querySelectorAll('input')].some((el) => el.value === 'Amoxicillin DT')).toBe(true);
        const box = [...host.querySelectorAll('input')].find((el) => el.value === 'PNEUMONIA, after 3 days');
        await act(async () => { setValue(box, 'PNEUMONIA, after 2 days'); });
        await act(async () => { button('Save changes').click(); });
        const saved = data.saveIMNCIProtocol.mock.calls.map((c) => c[0]);
        expect(saved).toEqual(['dosages_child', 'guide_child']);
    });
    it('saves the dose chosen from the list, in English and Arabic', async () => {
        const data = await import('../src/data');
        data.saveIMNCIProtocol.mockClear();
        vi.spyOn(window, 'alert').mockImplementation(() => {});
        await open({ child: P.child, infant: P.infant, dosages_child: P.dosages_child, dosages_infant: P.dosages_infant });
        await act(async () => { button('Edit').click(); });
        await act(async () => { button('Pneumonia / cough').click(); });
        const sel = [...host.querySelectorAll('select')].find((el) => el.value === 'amoxicillin');
        await act(async () => { sel.value = 'ciprofloxacin'; sel.dispatchEvent(new Event('change', { bubbles: true })); });
        await act(async () => { button('Save changes').click(); });
        const [ft, saved] = data.saveIMNCIProtocol.mock.calls.at(-1);
        expect(ft).toBe('child');
        const lines = Object.values(saved.categories).flatMap((c) => c.rules.flatMap((r) => [...r.treatments, ...(r.treatmentsAr || [])]));
        expect(lines.filter((l) => l.includes('{{dose:ciprofloxacin}}')).length).toBeGreaterThanOrEqual(2);
    });
    it('the advanced rule builder picks signs, classifications and doses like the booklet editor', async () => {
        await open({ child: P.child, infant: P.infant, dosages_child: P.dosages_child, dosages_infant: P.dosages_infant });
        await act(async () => { button('Edit').click(); });
        await act(async () => { button('Pneumonia / cough').click(); });
        const adv = [...host.querySelectorAll('label')].find((l) => l.textContent.includes('Advanced rule builder')).querySelector('input');
        await act(async () => { adv.click(); });
        expect(host.textContent).toContain('Only when (all must be true)');
        const selects = [...host.querySelectorAll('select')];
        expect(selects.some((el) => el.value === 'Chest indrawing')).toBe(true);
        expect(selects.some((el) => el.value === 'amoxicillin')).toBe(true);
        expect([...host.querySelectorAll('textarea, input')].some((el) => String(el.value).includes('{{dose:'))).toBe(false);
    });
    it('opens the national recording form when none is saved', async () => {
        await open({ child: P.child, infant: P.infant });
        await act(async () => { button('Recording form').click(); });
        expect(host.textContent).toContain(NATIONAL_FORMS.form_child.en.title);
    });
});
