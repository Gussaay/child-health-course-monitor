// src/dashboards/serverKpis.js
//
// Asks the server for a dashboard's numbers (functions/dashboardKpis.js).
// Throws when the server cannot answer (offline, function down, paid plan
// lapsed, quota): the page then reads the lists itself and works the same
// numbers out with the same code (docs/server-dashboard-kpis.md, scenario 2).
import { getFunctions, httpsCallable } from 'firebase/functions';
import { readPublicPackage, savePublicPackage } from '../utils/publicDashboardStore';

const keyOf = (dashboard, params) => `kpi:${dashboard}:${JSON.stringify(params)}`;

/** The last answer saved on this device for the same question, or null. */
export const savedServerKpis = (dashboard, params) => readPublicPackage(keyOf(dashboard, params));

export async function askServerKpis(dashboard, params = {}, { timeout = 120000 } = {}) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
    const call = httpsCallable(getFunctions(), 'dashboardKpis', { timeout });
    const res = (await call({ dashboard, ...params }))?.data;
    if (!res || res.error || res.dashboard !== dashboard) throw new Error(res?.error || 'no answer');
    savePublicPackage(keyOf(dashboard, params), res);
    return res;
}
