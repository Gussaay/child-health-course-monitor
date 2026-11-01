// Protocol management by illness: every dose and every treatment, counselling
// and follow-up box of the national protocol lands on a tab, and on the right one.
import { describe, it, expect } from 'vitest';
import { NATIONAL_PROTOCOLS as P } from '../src/components/imnci/nationalProtocol';
import { NATIONAL_GUIDES as G } from '../src/components/imnci/treatmentGuides';
import { GENERAL, topicsFor, drugsForTopic, guideForTopic, drugTopics, groupForNewBox } from '../src/components/imnci/topics';

const parts = [['child', P.child, P.dosages_child, G.guide_child], ['infant', P.infant, P.dosages_infant, G.guide_infant]];
const ids = (doses, idx) => idx.map((i) => doses.drugs[i].id);
const boxIds = (guide, list) => list.map(({ gi, bi }) => `${guide.groups[gi].id}.${guide.groups[gi].blocks[bi].id}`);

describe('illness tabs', () => {
    it('one tab per booklet page, then General and the form', () => {
        expect(topicsFor('child', P.child).map((t) => t.id)).toEqual(['danger', 'cough', 'diarrhea', 'fever', 'ear', 'malnutrition', 'anemia', 'general', 'form']);
        expect(topicsFor('infant', P.infant).map((t) => t.id)).toEqual(['bacterial_infection', 'jaundice', 'diarrhea', 'feeding_problem', 'general', 'form']);
    });
    it('a table just added in the rule builder gets its own tab', () => {
        const child = { ...P.child, categories: { ...P.child.categories, wheeze: { title: 'Wheeze', rules: [] } } };
        expect(topicsFor('child', child).map((t) => t.id)).toContain('wheeze');
    });
    it.each(parts)('%s: every dose is on exactly one tab', (part, rules, doses) => {
        const topics = topicsFor(part, rules).map((t) => t.id);
        const shown = topics.flatMap((tp) => drugsForTopic(part, tp, rules, doses));
        expect(shown.sort((a, b) => a - b)).toEqual(doses.drugs.map((_, i) => i));
    });
    it.each(parts)('%s: every guide box is on at least one tab', (part, rules, _doses, guide) => {
        const known = topicsFor(part, rules).map((t) => t.id);
        const seen = new Set(known.flatMap((tp) => Object.values(guideForTopic(part, tp, guide, known)).flat().map(({ gi, bi }) => `${gi}.${bi}`)));
        guide.groups.forEach((g, gi) => g.blocks.forEach((b, bi) => expect(seen.has(`${gi}.${bi}`), `${g.id}.${b.id}`).toBe(true)));
    });
    it('pneumonia: amoxicillin first, then inhaler, counselling and follow-up', () => {
        const known = topicsFor('child', P.child).map((t) => t.id);
        expect(ids(P.dosages_child, drugsForTopic('child', 'cough', P.child, P.dosages_child))[0]).toBe('amoxicillin');
        const guide = guideForTopic('child', 'cough', G.guide_child, known);
        expect(boxIds(G.guide_child, guide.treat)).toContain('inhaler.salbutamol');
        expect(boxIds(G.guide_child, guide.followup)).toEqual(expect.arrayContaining(['followup.fu_pneumonia', 'followup.return_now']));
        expect(boxIds(G.guide_child, guide.followup)).not.toContain('followup.fu_malaria');
    });
    it('diarrhoea: ORS plans and zinc, the fluid plans and its follow-up', () => {
        const known = topicsFor('child', P.child).map((t) => t.id);
        expect(ids(P.dosages_child, drugsForTopic('child', 'diarrhea', P.child, P.dosages_child))).toEqual(expect.arrayContaining(['plan_a_ors', 'plan_b_ors', 'plan_c_iv', 'zinc', 'ciprofloxacin']));
        const guide = guideForTopic('child', 'diarrhea', G.guide_child, known);
        expect(boxIds(G.guide_child, guide.treat)).toEqual(['fluids.plan_a', 'fluids.plan_b', 'fluids.plan_c']);
        expect(boxIds(G.guide_child, guide.followup)).toEqual(expect.arrayContaining(['followup.fu_dysentery', 'followup.fu_diarrhoea']));
    });
    it('vaccination stays on General', () => {
        const known = topicsFor('child', P.child).map((t) => t.id);
        expect(boxIds(G.guide_child, guideForTopic('child', GENERAL, G.guide_child, known).treat)).toContain('vaccination.schedule');
    });
    it('a dose or box tied to an illness by hand follows it', () => {
        const doses = { drugs: [...P.dosages_child.drugs, { id: 'new_drug', label: 'New', rules: [], topic: 'ear' }] };
        expect(drugTopics('child', P.child, doses).new_drug).toBe('ear');
        const guide = JSON.parse(JSON.stringify(G.guide_child));
        const gi = groupForNewBox(guide, 'counsel');
        guide.groups[gi].blocks.push({ id: 'b', topic: 'ear', en: { title: 'x' }, ar: { title: 'y' } });
        const known = topicsFor('child', P.child).map((t) => t.id);
        expect(boxIds(guide, guideForTopic('child', 'ear', guide, known).counsel)).toContain('counsel.b');
        expect(boxIds(guide, guideForTopic('child', 'cough', guide, known).counsel)).not.toContain('counsel.b');
    });
});
