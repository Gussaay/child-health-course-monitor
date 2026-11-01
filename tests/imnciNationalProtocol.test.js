// The national protocol against the booklet: sample children and infants,
// the classification each booklet box gives, and the dose the worker must see.
import { describe, it, expect } from 'vitest';
import { NATIONAL_PROTOCOLS, NATIONAL_SAVE_ORDER } from '../src/components/imnci/nationalProtocol';
import { evaluateProtocol, resolveDoseTag, computeChildFindings, computeInfantFindings, infantAgeInMonths, mergeCategories } from '../src/components/imnci/engine';
import { validateProtocol } from '../src/components/imnci/protocol';

const P = NATIONAL_PROTOCOLS;

const child = (ticks = {}, { weight = 8, age = 9, zStatus = '-2 Z or more' } = {}) => evaluateProtocol(
    computeChildFindings({ pallor: 'noPallor', ...ticks }, zStatus), P.child, {}, weight, age, P.dosages_child,
);
const infant = (ticks = {}, { weight = 3, ageText = '10 d', tempC = '' } = {}) => evaluateProtocol(
    computeInfantFindings(ticks, tempC), P.infant, {}, weight, infantAgeInMonths(ageText), P.dosages_infant,
);
const labels = (res, key) => (res[key]?.c || []).map((c) => c.label);
const lines = (res, key) => (res[key]?.t || []).join('\n');

describe('national protocol passes the editor checks', () => {
    it('has no errors in any tab', () => {
        NATIONAL_SAVE_ORDER.forEach((formType) => {
            const doses = formType === 'child' ? P.dosages_child.drugs : formType === 'infant' ? P.dosages_infant.drugs : [];
            expect(validateProtocol(formType, P[formType], doses).errors).toEqual([]);
        });
    });
    it('saves the Doses tabs before the rules that use them', () => {
        expect(NATIONAL_SAVE_ORDER.indexOf('dosages_child')).toBeLessThan(NATIONAL_SAVE_ORDER.indexOf('child'));
        expect(NATIONAL_SAVE_ORDER.indexOf('dosages_infant')).toBeLessThan(NATIONAL_SAVE_ORDER.indexOf('infant'));
    });
    it('reports a missing Doses tab once, not once per line', () => {
        const { errors } = validateProtocol('child', P.child, []);
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toMatch(/Doses tab has not been saved/);
    });
    it('keeps every dose tag at the end of its line, one per line', () => {
        ['child', 'infant'].forEach((k) => Object.values(P[k].categories).forEach((cat) => cat.rules.forEach((r) => r.treatments.forEach((t) => {
            const tags = t.match(/\{\{dose:[^}]+\}\}/g) || [];
            expect(tags.length).toBeLessThanOrEqual(1);
            if (tags.length) expect(t.trim().endsWith(tags[0])).toBe(true);
        }))));
    });
});

describe('sick child, 2 months up to 5 years', () => {
    it('chest indrawing is Pneumonia with amoxicillin 5 ml, not severe', () => {
        const r = child({ hasCough: true, chestIndrawing: true }, { weight: 8, age: 9 });
        expect(labels(r, 'cough')).toEqual(['Pneumonia']);
        expect(lines(r, 'cough')).toContain('5 ml syrup (250 mg/5 ml) OR 1 tablet (250 mg) (Twice daily) — For 5 days');
    });
    it('a danger sign without cough is not Severe Pneumonia', () => {
        const r = child({ vomitsEverything: true, hasCough: false });
        expect(labels(r, 'cough')).toEqual([]);
        expect(labels(r, 'danger')).toEqual(['General danger sign present']);
    });
    it('convulsing now gets the diazepam dose for the weight', () => {
        const r = child({ convulsingNow: true }, { weight: 12, age: 20 });
        expect(lines(r, 'danger')).toContain('1.5 ml rectally');
    });
    it('dehydration, persistent diarrhoea and dysentery are all classified', () => {
        const r = child({ hasDiarrhea: true, diarrheaDays: '15', bloodInStool: true, restlessIrritable: true, sunkenEyes: true }, { weight: 8, age: 9 });
        const row = mergeCategories(r, ['diarrhea', 'persistent_diarrhea', 'dysentery']);
        expect(row.c.map((c) => c.label)).toEqual(['Some Dehydration', 'Severe Persistent Diarrhoea', 'Dysentery']);
        expect(lines(r, 'dysentery')).toContain('½ tablet (250 mg) (Twice daily) — For 3 days');
        expect(lines(r, 'diarrhea')).toContain('400–700 ml');
    });
    it('one sign ticked twice is not severe dehydration', () => {
        const r = child({ hasDiarrhea: true, notAbleToDrink: true, drinkPoorly: true });
        expect(labels(r, 'diarrhea')).toEqual(['No Dehydration']);
    });
    it('two severe signs are Severe Dehydration with Plan C and cholera cover', () => {
        const r = child({ hasDiarrhea: true, lethargic: true, pinchVerySlow: true }, { weight: 13, age: 30 });
        expect(labels(r, 'diarrhea')).toEqual(['Severe Dehydration']);
        expect(lines(r, 'diarrhea')).toContain('30 ml/kg in 30 minutes');
        expect(lines(r, 'diarrhea')).toContain('erythromycin 250 mg');
    });
    it('zinc follows the English tablet strength', () => {
        expect(resolveDoseTag('zinc', 6, 4, P.dosages_child)).toContain('½ tablet (20 mg)');
        expect(resolveDoseTag('zinc', 9, 10, P.dosages_child)).toContain('1 tablet (20 mg)');
    });
    it('malaria and measles are both classified', () => {
        const r = child({ hasFever: true, malariaTest: 'positive', measlesRash: true, mouthUlcers: true }, { weight: 10, age: 18 });
        expect(labels(r, 'fever')).toEqual(['Malaria']);
        expect(labels(r, 'measles')).toEqual(['Measles with Eye or Mouth Complications']);
        expect(lines(r, 'fever')).toContain('1 tablet (Now, after 8 hours');
        expect(lines(r, 'measles')).toContain('200,000 IU');
    });
    it('paracetamol and iron follow the Arabic booklet', () => {
        expect(resolveDoseTag('paracetamol', 15, 40, P.dosages_child)).toContain('7.5 ml syrup (120 mg/5 ml)');
        expect(resolveDoseTag('iron', 7, 6, P.dosages_child)).toContain('1.25 ml ferrous fumarate');
    });
    it('a danger sign with fever is Very Severe Febrile Disease with quinine dilution', () => {
        const r = child({ hasFever: true, lethargicUnconscious: true }, { weight: 11, age: 20 });
        expect(labels(r, 'fever')).toEqual(['Very Severe Febrile Disease']);
        expect(lines(r, 'fever')).toContain('0.4 ml quinine + 1.6 ml saline = 2 ml diluted');
    });
    it('malnutrition and anaemia are both classified', () => {
        const r = child({ pallor: 'somePallor', muacCm: '11.0' }, { weight: 7, age: 14 });
        expect(labels(r, 'malnutrition')).toEqual(['Uncomplicated Severe Acute Malnutrition']);
        expect(labels(r, 'anemia')).toEqual(['Anaemia']);
        expect(lines(r, 'malnutrition')).toContain('3 sachets a day');
    });
    it('oedema of both feet is complicated SAM', () => {
        const r = child({ edema: true });
        expect(labels(r, 'malnutrition')).toEqual(['Complicated Severe Acute Malnutrition']);
    });
    it('ear discharge for 14 days is Chronic Ear Infection', () => {
        const r = child({ hasEarProblem: true, earDischarge: true, earDischargeDays: '20' });
        expect(labels(r, 'ear')).toEqual(['Chronic Ear Infection']);
    });
});

describe('young infant, up to 2 months', () => {
    it('fever 37.5 °C is Possible Serious Bacterial Infection', () => {
        const r = infant({}, { tempC: '37.6' });
        expect(labels(r, 'bacterial_infection')).toEqual(['Possible Serious Bacterial Infection or Very Severe Disease']);
    });
    it('gentamicin dose follows the age as well as the weight', () => {
        const older = infant({ convulsions: true }, { weight: 3, ageText: '10 d' });
        expect(lines(older, 'bacterial_infection')).toContain('2.25 ml (10 mg/ml; age 7 days or older)');
        expect(lines(older, 'bacterial_infection')).not.toContain('age under 7 days');
        const newborn = infant({ convulsions: true }, { weight: 3, ageText: '3 d' });
        expect(lines(newborn, 'bacterial_infection')).toContain('1.5 ml (10 mg/ml; age under 7 days)');
    });
    it('without an age, gentamicin asks for it instead of guessing', () => {
        expect(resolveDoseTag('gentamicin_im_infant', 3, 0, P.dosages_infant)).toMatch(/Enter age and weight/);
    });
    it('umbilicus draining pus is Local Bacterial Infection with amoxicillin', () => {
        const r = infant({ umbilicusRedDraining: true }, { weight: 3.5, ageText: '3 w' });
        expect(labels(r, 'bacterial_infection')).toEqual(['Local Bacterial Infection']);
        expect(lines(r, 'bacterial_infection')).toContain('2.5 ml syrup (125 mg/5 ml)');
    });
    it('the diarrhoea section classifies dehydration and blood in stool', () => {
        const r = infant({ hasDiarrhea: true, diarrheaRestless: true, diarrheaSunkenEyes: true, bloodInStool: true });
        expect(labels(r, 'diarrhea')).toEqual(['Some Dehydration']);
        expect(labels(r, 'dysentery')).toEqual(['Blood in Stool']);
    });
    it('poor attachment is a feeding problem', () => {
        const r = infant({ breastfed: 'yes', breastfeedTimes: '10', goodAttachment: 'notWell' });
        expect(labels(r, 'feeding_problem')).toEqual(['Feeding Problem or Low Weight']);
    });
    it('jaundice on palms and soles is Severe Jaundice', () => {
        const r = infant({ hasJaundice: true, jaundiceSolesPalms: true });
        expect(labels(r, 'jaundice')).toEqual(['Severe Jaundice']);
    });
});

describe('infant age text', () => {
    it('reads days, weeks and Arabic digits', () => {
        expect(infantAgeInMonths('14 d')).toBeCloseTo(14 / 30.44);
        expect(infantAgeInMonths('3 w')).toBeCloseTo(3 / 4.345);
        expect(infantAgeInMonths('١٠ يوم')).toBeCloseTo(10 / 30.44);
        expect(infantAgeInMonths('')).toBe(0);
    });
});
