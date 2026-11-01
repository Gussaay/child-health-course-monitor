// One vocabulary across the patient form, Protocol management, the online
// course modules and the online IMNCI exercises, and the exercise form itself.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const cache = { protocols: null };
vi.mock('../src/DataContext', () => ({ useDataCache: () => ({ ...cache }) }));
vi.mock('../src/data', () => ({ saveIMNCIPatientRecord: vi.fn() }));
vi.mock('../src/firebase', () => ({ db: {}, auth: { currentUser: null } }));

import i18n from '../src/i18n';
import { NATIONAL_PROTOCOLS as P } from '../src/components/imnci/nationalProtocol';
import { EXERCISES, CLASSIFY_OPTIONS, TREATMENT_OPTIONS, INFANT_CLASSIFY_OPTIONS, INFANT_TREATMENT_OPTIONS } from '../src/components/imnci/exercises';
import { optionText, classificationText, CLASSIFICATION_RULES, findRule } from '../src/components/imnci/vocabulary';
import { treatmentSuggestions, splitLine } from '../src/components/imnci/standardLists';
import { ChildForm, InfantForm } from '../src/components/imnci/form';

const ARABIC = /[؀-ۿ]/;

describe('one vocabulary', () => {
    it('every exercise classification key is a protocol rule', () => {
        Object.entries(CLASSIFICATION_RULES).forEach(([key, [part, id]]) => expect(findRule(part, id), key).toBeTruthy());
    });
    it('exercise classifications read the protocol wording, in both languages', () => {
        expect(classificationText('imci.classifications.fever_no_malaria', 'en')).toBe(P.child.categories.fever.rules.find((r) => r.id === 'fever_no_malaria').classification.label);
        expect(classificationText('imci.classifications.mam', 'ar')).toBe(P.child.categories.malnutrition.rules.find((r) => r.id === 'moderate_acute_malnutrition').classification.labelAr);
    });
    it('a classification renamed in Protocol management is renamed in the exercises', () => {
        const saved = JSON.parse(JSON.stringify(P));
        saved.child.categories.cough.rules.find((r) => r.id === 'pneumonia').classification.label = 'PNEUMONIA (renamed)';
        expect(optionText({ id: 'imci.classifications.pneumonia' }, 'en', { protocols: saved })).toBe('PNEUMONIA (renamed)');
    });
    it('every exercise treatment option is in Arabic, and most are the protocol\'s own lines', () => {
        const national = new Set([...treatmentSuggestions('child', null), ...treatmentSuggestions('infant', null)]);
        let fromProtocol = 0; let total = 0;
        [TREATMENT_OPTIONS, INFANT_TREATMENT_OPTIONS].forEach((bank) => Object.values(bank).flat().forEach((o) => {
            total += 1;
            if (national.has(splitLine(o.label).words)) fromProtocol += 1;
            expect(optionText(o, 'ar'), o.id).toMatch(ARABIC);
        }));
        expect(fromProtocol / total).toBeGreaterThan(0.5);
    });
    it('classification options show in Arabic on an Arabic screen', async () => {
        await i18n.changeLanguage('ar');
        [CLASSIFY_OPTIONS, INFANT_CLASSIFY_OPTIONS].forEach((bank) => Object.values(bank).flat().forEach((o) => {
            expect(optionText(o, 'ar', { t: i18n.t.bind(i18n) }), o.id).toMatch(ARABIC);
        }));
        await i18n.changeLanguage('en');
    });
});

describe('the online exercise form', () => {
    let host, root;
    beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); cache.protocols = { child: P.child, infant: P.infant, dosages_child: P.dosages_child, dosages_infant: P.dosages_infant }; });
    afterEach(() => { act(() => root.unmount()); host.remove(); });

    it('opens in training mode with the protocol\'s words and submits the learner\'s ticks', async () => {
        await i18n.changeLanguage('en');
        const ex = EXERCISES.find((e) => e.id === 'imnci-ex1-musa');
        const onCheck = vi.fn();
        await act(async () => { root.render(<ChildForm trainingCase={ex.expected} onTrainingCheck={onCheck} onBack={() => {}} />); });
        expect(host.textContent).toContain('TRAINING MODE');
        // Only the exercise's sections are shown.
        expect(host.textContent).not.toContain('Ear problem');
        // As on paper, the cough row opens once the learner answers Yes.
        const coughTitle = i18n.t('imci.child.cough_title');
        const row = [...host.querySelectorAll('span')].find((sp) => sp.textContent === coughTitle).parentElement;
        await act(async () => { row.querySelector('input[type=radio]').click(); });
        const pneumonia = P.child.categories.cough.rules.find((r) => r.id === 'pneumonia').classification.label;
        const tick = [...host.querySelectorAll('label')].find((l) => l.textContent.trim() === pneumonia)?.querySelector('input');
        expect(tick).toBeTruthy();
        await act(async () => { tick.click(); });
        const treat = [...host.querySelectorAll('label')].find((l) => l.textContent.trim() === 'Give oral amoxicillin for 5 days')?.querySelector('input');
        expect(treat).toBeTruthy();
        await act(async () => { treat.click(); });
        await act(async () => { [...host.querySelectorAll('button')].find((b) => b.textContent.includes('Submit form')).click(); });
        expect(onCheck).toHaveBeenCalledTimes(1);
        const sub = onCheck.mock.calls[0][0];
        expect(sub.chosenClassifications.cough).toEqual(['imci.classifications.pneumonia']);
        expect(sub.chosenTreatments.cough).toEqual(['c_oral_5days']);
    });
    it('the young infant exercise opens too', async () => {
        const ex = EXERCISES.find((e) => e.formType === 'infant');
        await act(async () => { root.render(<InfantForm trainingCase={ex.expected} onTrainingCheck={() => {}} onBack={() => {}} />); });
        expect(host.textContent).toContain('TRAINING MODE');
        expect(host.textContent).toContain(P.infant.categories.bacterial_infection.rules.find((r) => r.id === 'local_bacterial_infection').classification.label);
    });
});
