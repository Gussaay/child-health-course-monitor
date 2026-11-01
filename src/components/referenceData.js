// src/components/referenceData.js
//
// The Morbidity & Mortality tab's figures in one object, as the data
// assistant reads them (scripts/build-reference-data.mjs writes it to
// functions/referenceData.json).
import {
    IGME_SOURCE, IGME_SERIES, STILLBIRTH_SERIES, MATERNAL_SERIES, SDG_TARGETS, STILLBIRTH_TARGET, ADOLESCENT_SERIES,
    MICS_SOURCE, MICS_INDICATORS, MICS_NATIONAL, MICS_STATES,
} from './childHealthIndicatorsData.js';
import { S3M_SOURCE, S3M_INDICATORS, S3M_NATIONAL, S3M_STATES } from './s3mData.js';

export function referenceData() {
    return {
        igme: {
            source: `${IGME_SOURCE.name} ${IGME_SOURCE.round} round (modelled estimates for Sudan)`,
            series: {
                nmr: { label: 'Neonatal mortality rate', unit: 'per 1,000 live births', target: SDG_TARGETS.nmr, columns: ['year', 'estimate', 'lower', 'upper'], rows: IGME_SERIES.nmr },
                imr: { label: 'Infant mortality rate', unit: 'per 1,000 live births', columns: ['year', 'estimate', 'lower', 'upper'], rows: IGME_SERIES.imr },
                u5mr: { label: 'Under-five mortality rate', unit: 'per 1,000 live births', target: SDG_TARGETS.u5mr, columns: ['year', 'estimate', 'lower', 'upper'], rows: IGME_SERIES.u5mr },
                stillbirth: { label: 'Stillbirth rate', unit: 'per 1,000 total births', target: STILLBIRTH_TARGET, columns: ['year', 'estimate'], rows: STILLBIRTH_SERIES },
                maternal: { label: 'Maternal mortality ratio', unit: 'per 100,000 live births', columns: ['year', 'estimate'], rows: MATERNAL_SERIES },
                adolescent: { label: 'Adolescent mortality, early (10-14) and late (15-19)', unit: 'per 1,000 adolescents', columns: ['year', 'early', 'late'], rows: ADOLESCENT_SERIES },
            },
        },
        mics: {
            source: `${MICS_SOURCE.name} ${MICS_SOURCE.year} (household survey)`,
            indicators: MICS_INDICATORS.map(({ id, label, unit, better }) => ({ id, label, unit: unit === 'rate' ? 'per 1,000 live births' : '%', better })),
            national: MICS_NATIONAL,
            states: Object.fromEntries(Object.entries(MICS_STATES).map(([state, values]) => [state, { values }])),
        },
        s3m: {
            source: `${S3M_SOURCE.name} ${S3M_SOURCE.year} (household survey, by state and locality)`,
            indicators: S3M_INDICATORS.map(({ id, label, better }) => ({ id, label, unit: '%', better })),
            national: S3M_NATIONAL,
            states: S3M_STATES,
        },
    };
}
