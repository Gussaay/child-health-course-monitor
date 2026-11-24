// src/dashboards/index.js
//
// The dashboard calculations shared by the pages and the server. The server
// uses them through functions/generated/dashboards.cjs, built from this file
// by scripts/build-dashboards-bundle.mjs (tests/dashboardsBundle.test.js fails
// when the built copy is out of date).
export * as facilityHistory from './facilityHistory.js';
export * as facilityUpdate from './facilityUpdate.js';
