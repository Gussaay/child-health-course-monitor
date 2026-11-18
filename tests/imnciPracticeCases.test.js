// Every practice case in the IMNCI courses (scripts/imnci-practice/practice.py)
// is checked against the app's own classification engine and the Sudan
// national protocol: a case may never teach a classification the app would
// not give for the same signs.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { NATIONAL_PROTOCOLS as P } from '../src/components/imnci/nationalProtocol';
import { evaluateProtocol, computeChildFindings, computeInfantFindings } from '../src/components/imnci/engine';

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, '../scripts/imnci-practice/cases.json'), 'utf8'));

const classify = ({ part, ticks, z, temp, weight, age }) => (part === 'infant'
    ? evaluateProtocol(computeInfantFindings(ticks, temp), P.infant, {}, weight, 1, P.dosages_infant)
    : evaluateProtocol(computeChildFindings({ pallor: 'noPallor', ...ticks }, z), P.child, {}, weight, age, P.dosages_child));

describe('IMNCI practice cases', () => {
    it('has cases to check', () => expect(cases.length).toBeGreaterThan(20));
    cases.forEach((c) => {
        it(`${c.id}: the engine gives the classification the case teaches`, () => {
            const res = classify(c.check);
            Object.entries(c.check.expect).forEach(([cat, labels]) => {
                expect((res[cat]?.c || []).map((x) => x.label)).toEqual(labels);
            });
        });
    });
});
