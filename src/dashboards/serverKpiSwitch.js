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

// Tier "a": a device's FIRST download of these lists comes from a server copy
// (functions/mentorshipCopy.js) instead of the database; later syncs read
// changes from the database as before. Falls back to the database read on
// any failure.
export const SERVER_COPIES = {
    mentorship: true,
};
