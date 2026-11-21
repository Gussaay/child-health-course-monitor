// participantAffiliation (src/utils/participantAffiliation.js): a
// participant may come from a programme (e.g. the National Child Health
// Program) instead of a health facility. These tests pin the saved shape:
// programme records carry the programme name, no facility, and nothing is
// written to a facility staff list for them.
import { describe, it, expect } from 'vitest';
import { participantPlace, participantPlaceLabel } from '../src/utils/participantAffiliation';

describe('participantPlace', () => {
    it('a facility participant keeps the facility name and id, and no programme', () => {
        expect(participantPlace({ centerName: ' Omdurman Hospital ', facilityId: 'fac1' }))
            .toEqual({ center_name: 'Omdurman Hospital', facilityId: 'fac1', program: null });
    });

    it('a programme participant saves the programme, N/A centre and no facility — even if a facility was picked earlier', () => {
        expect(participantPlace({ fromProgram: true, programName: ' National Child Health Program ', centerName: 'Some Hospital', facilityId: 'fac1' }))
            .toEqual({ center_name: 'N/A', facilityId: null, program: 'National Child Health Program' });
    });

    it('a Program Management participant keeps the department pattern: N/A centre, no facility, no programme', () => {
        expect(participantPlace({ programManaged: true, centerName: 'Ignored', facilityId: 'fac1' }))
            .toEqual({ center_name: 'N/A', facilityId: null, program: null });
    });

    it('a village (ICCM/CPCM) participant keeps the village as the centre with no facility id', () => {
        expect(participantPlace({ centerName: 'Village A', facilityId: null }))
            .toEqual({ center_name: 'Village A', facilityId: null, program: null });
    });
});

describe('participantPlaceLabel', () => {
    it('shows the programme for a programme participant', () => {
        expect(participantPlaceLabel({ program: 'National Child Health Program', center_name: 'N/A' }))
            .toBe('National Child Health Program');
    });

    it('shows the facility name otherwise', () => {
        expect(participantPlaceLabel({ center_name: 'Omdurman Hospital' })).toBe('Omdurman Hospital');
        expect(participantPlaceLabel({})).toBe('');
        expect(participantPlaceLabel(null)).toBe('');
    });
});
