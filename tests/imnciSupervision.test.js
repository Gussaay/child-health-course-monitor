import { describe, it, expect } from 'vitest';
import {
    IMNCI_FACILITY_READINESS, IMNCI_DRUGS, imnciFacilityPatch, staffTotals, drugResults,
} from '../src/components/supervision/imnciChecklists';
import { getChecklist, checklistsForService, assessmentProgress } from '../src/components/supervision/checklists';

const yes = { answer: true };
const no = { answer: false };

describe('IMNCI supervision checklists', () => {
    it('are listed under the IMNCI service', () => {
        expect(checklistsForService('IMNCI').map((c) => c.id)).toEqual(['imnci_facility_readiness', 'imnci_drugs']);
        expect(getChecklist('imnci_drugs')).toBe(IMNCI_DRUGS);
    });

    it('gives every item a unique id and an Arabic label', () => {
        [IMNCI_FACILITY_READINESS, IMNCI_DRUGS].forEach((c) => {
            const ids = new Set();
            c.sections.forEach((s) => {
                expect(s.titleAr).toBeTruthy();
                (s.items || []).forEach((i) => {
                    const key = `${s.id}.${i.id}`;
                    expect(ids.has(key)).toBe(false);
                    ids.add(key);
                    expect(i.ar).toBeTruthy();
                });
            });
        });
    });
});

describe('facility readiness', () => {
    it('works out trained staff and the staffing minimum', () => {
        const s = staffTotals({ staff: { doctor: { total: '1', trained: '1' }, nurse: { total: '2', trained: '1' } } });
        expect(s.total).toBe(3);
        expect(s.trained).toBe(2);
        expect(Math.round(s.trainedPercent)).toBe(67);
        expect(s.meetsMinimum).toBe(true);
        expect(staffTotals({ staff: { nurse: { total: '4', trained: '2' } } }).meetsMinimum).toBe(false);
        expect(staffTotals({}).meetsMinimum).toBe(null);
    });

    it('maps answered questions to the IMNCI facility fields and leaves blanks out', () => {
        const patch = imnciFacilityPatch({
            responses: {
                measure: { scale: yes, height: no },
                clinic: { chart_booklet: yes },
                ort: { ort_corner: no },
                epi: { epi_services: yes },
                staff: { doctor: { total: '2', trained: '1' }, medical_assistant: { total: '1', trained: '0' } },
            },
        });
        expect(patch).toEqual({
            'ميزان_وزن': 'Yes',
            'ميزان_طول': 'No',
            'وجود_كتيب_لوحات': 'Yes',
            'غرفة_إرواء': 'No',
            immunization_office_exists: 'Yes',
            imnci_doctors_total: 2,
            imnci_doctors_trained: 1,
            imnci_medical_assistants_total: 1,
            imnci_medical_assistants_trained: 0,
            'وجود_العلاج_المتكامل_لامراض_الطفولة': 'No',
        });
        expect(imnciFacilityPatch({ responses: {} })).toEqual({});
    });

    it('leaves the IMNCI service status alone when trained counts are blank', () => {
        const form = { responses: { staff: { doctor: { total: '2' }, nurse: { total: '3' } } } };
        expect(imnciFacilityPatch(form)).toEqual({ imnci_doctors_total: 2 });
        expect(staffTotals(form.responses).meetsMinimum).toBe(null);
    });

    it('fills the facility form\'s ORT, immunization and nutrition details', () => {
        const patch = imnciFacilityPatch({
            responses: {
                ort: { ort_corner: yes, safe_water: no, health_education: yes },
                epi: { epi_services: yes, strategy_fixed: yes, fixed_days: { answer: '3' }, fridge: no },
                nutrition: { growth_monitoring: yes, otp_rutf: no, iycf: yes },
            },
        });
        expect(patch).toMatchObject({
            'غرفة_إرواء': 'Yes', ort_safe_water: 'No', ort_health_education: 'Yes',
            immunization_office_exists: 'Yes', immunization_strategy_fixed: 'Yes', immunization_fixed_days_per_week: 3, vaccine_fridge_working: 'No',
            growth_monitoring_service_exists: 'Yes', otp_rutf_exists: 'No', iycf_service_exists: 'Yes',
        });
        expect(patch).not.toHaveProperty('otp_tsfp_exists');
        const noEpi = imnciFacilityPatch({ responses: { epi: { epi_services: no, fridge: yes } } });
        expect(noEpi).toEqual({ immunization_office_exists: 'No' });
    });

    it('has the child pathway section with its two questions', () => {
        const section = IMNCI_FACILITY_READINESS.sections.find((x) => x.id === 'child_pathway');
        expect(section.items.map((i) => i.id)).toEqual(['malnutrition_screening', 'vaccination_screening']);
    });

    it('skips immunization rows when the facility has no immunization services', () => {
        const form = { responses: { epi: { epi_services: no } } };
        const epi = assessmentProgress(IMNCI_FACILITY_READINESS, form).sections.epi;
        expect(epi.answered).toBe(1);
        expect(epi.total).toBe(1);
    });
});

describe('drugs form 7-C', () => {
    it('counts availability, stock-outs and the tracer drugs', () => {
        const responses = {
            drugs_clinic: {
                amox_250_dt: { available: true, stockout: false },
                paracetamol_syrup: { available: true },
                coartem: { available: true },
                zinc_tabs: { available: true },
                ors: { available: true, stockout: true },
                iron_syrup: { available: false },
            },
        };
        const d = drugResults(responses);
        expect(d.answered).toBe(6);
        expect(d.available).toBe(5);
        expect(d.stockouts).toBe(1);
        expect(d.tracers.find((x) => x.id === 'ors').met).toBe(false);
        expect(d.tracerOk).toBe(false);

        responses.drugs_clinic.ors.stockout = false;
        expect(drugResults(responses).tracerOk).toBe(true);

        const metrics = IMNCI_DRUGS.metrics({ responses });
        expect(metrics.find((m) => m.id === 'stockouts').value).toBe(0);
    });
});
