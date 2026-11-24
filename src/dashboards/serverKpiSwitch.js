// src/dashboards/serverKpiSwitch.js
//
// One switch per dashboard: true makes that dashboard ask the server for its
// numbers first (functions/dashboardKpis.js), falling back to reading the
// lists itself if the server cannot answer. All off until each has been
// reviewed (docs/server-dashboard-kpis.md).
export const SERVER_KPIS = {
    facilityHistory: false,
    facilityUpdate: false,
    serviceCoverage: false,
    mentorship: false,
    courses: false,
};
