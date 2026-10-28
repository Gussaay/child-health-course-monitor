/* global console */
// Builds functions/referenceData.json: the published survey and estimate
// figures of the dashboard's Morbidity & Mortality tab, for the data
// assistant's read_reference tool (the functions cannot import src/). The
// figures stay in src/components/childHealthIndicatorsData.js and s3mData.js;
// run again after changing them (a test fails until you do):
//   node scripts/build-reference-data.mjs
import { writeFileSync } from 'node:fs';
import { referenceData } from '../src/components/referenceData.js';

writeFileSync('functions/referenceData.json', `${JSON.stringify(referenceData())}\n`);
console.log('functions/referenceData.json written');
