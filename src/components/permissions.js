// src/components/permissions.js

export const ALL_PERMISSIONS = {
    canViewCourse: false,
    canAddCourse: false, // NEW PERMISSION
    canManageCourse: false,
    canManageCertificates: false,
    canViewFacilities: false,
    canManageFacilities: false,
    canViewHumanResource: false,
    canManageHumanResource: false,
    canViewSkillsMentorship: false,
    canManageSkillsMentorship: false,
    canAddMentorshipVisit: false, 
    canApproveSubmissions: false,
    canUseSuperUserAdvancedFeatures: false,
    canUseFederalManagerAdvancedFeatures: false,
    manageScope: 'none',
    manageLocation: '',
    manageTimePeriod: 'course_period_only',
    canViewDashboard: false,
    canViewAdmin: false,
    canViewLocalityPlan: false,
    canEditLocalityPlan: false,
};

export const ALL_PERMISSION_KEYS = Object.keys(ALL_PERMISSIONS);

export const applyDerivedPermissions = (basePermissions) => {
    if (basePermissions.manageScope !== 'none' || basePermissions.canViewCourse) {
        basePermissions.canViewDashboard = true;
    }
    if (basePermissions.canManageFacilities) {
        basePermissions.canViewFacilities = true;
    }
    if (basePermissions.canManageHumanResource) {
        basePermissions.canViewHumanResource = true;
    }
    if (basePermissions.canManageSkillsMentorship) {
        basePermissions.canViewSkillsMentorship = true;
    }
    if (basePermissions.canUseFederalManagerAdvancedFeatures) {
        basePermissions.canApproveSubmissions = true;
    }
    // NEW RULE: If a user can add or manage courses, they must inherently be able to view them
    if (basePermissions.canAddCourse || basePermissions.canManageCourse) {
        basePermissions.canViewCourse = true;
    }
    return basePermissions;
};

export const mergeRolePermissions = (rolesArray, globalPermissionsMap) => {
    let mergedPerms = { ...ALL_PERMISSIONS };
    
    const hierarchies = {
        manageScope: { 'none': 0, 'course': 1, 'locality': 2, 'state': 3, 'federal': 4 },
        manageTimePeriod: { 'course_period_only': 1, 'course_period_plus_3_days': 2, 'anytime': 3 },
        manageLocation: { 'user_locality': 1, 'user_state': 2, 'federal_level': 3, '': 4 }
    };

    rolesArray.forEach(role => {
        const perms = globalPermissionsMap[role] || DEFAULT_ROLE_PERMISSIONS[role] || {};
        
        Object.keys(perms).forEach(key => {
            if (typeof perms[key] === 'boolean') {
                mergedPerms[key] = mergedPerms[key] || perms[key];
            } else if (hierarchies[key]) {
                const currentVal = mergedPerms[key] || Object.keys(hierarchies[key])[0];
                const newVal = perms[key] || Object.keys(hierarchies[key])[0];
                
                if (hierarchies[key][newVal] > hierarchies[key][currentVal]) {
                    mergedPerms[key] = newVal;
                }
            }
        });
    });

    return applyDerivedPermissions(mergedPerms);
};

const BASE_PERMS = { ...ALL_PERMISSIONS };
const COURSE_MGMT_STANDARD = { canViewCourse: true, canManageCourse: true };
const COURSE_ADD_STANDARD = { canAddCourse: true }; // NEW PRESET

const FACILITY_MGMT_VIEW_ONLY = { canViewFacilities: true, canManageFacilities: false };
const FACILITY_MGMT_STANDARD = { canViewFacilities: true, canManageFacilities: true };
const HR_MGMT_VIEW_ONLY = { canViewHumanResource: true, canManageHumanResource: false };
const HR_MGMT_NONE = { canViewHumanResource: false, canManageHumanResource: false };
const HR_MGMT_STANDARD = { canViewHumanResource: true, canManageHumanResource: true };

const MENTORSHIP_MGMT_VIEW_ONLY = { canViewSkillsMentorship: true, canManageSkillsMentorship: false, canAddMentorshipVisit: false };
const MENTORSHIP_MGMT_STANDARD = { canViewSkillsMentorship: true, canManageSkillsMentorship: true, canAddMentorshipVisit: true };

const ADVANCED_PERMS_NONE = { 
    canApproveSubmissions: false, 
    canUseSuperUserAdvancedFeatures: false, 
    canUseFederalManagerAdvancedFeatures: false, 
    canViewAdmin: false 
};

// ==========================================
// ROLE DEFINITIONS
// ==========================================

const SUPER_USER_PERMS = { 
    ...BASE_PERMS, 
    ...COURSE_MGMT_STANDARD, 
    ...COURSE_ADD_STANDARD, // Granted
    ...FACILITY_MGMT_STANDARD, 
    ...HR_MGMT_STANDARD, 
    ...MENTORSHIP_MGMT_STANDARD, 
    ...ADVANCED_PERMS_NONE, 
    canViewAdmin: true, 
    canUseSuperUserAdvancedFeatures: true,          
    canUseFederalManagerAdvancedFeatures: true, 
    canManageCertificates: true, 
    canViewLocalityPlan: true,
    manageScope: 'federal', 
    manageTimePeriod: 'anytime' 
};

const FEDERAL_MANAGER_PERMS = { 
    ...BASE_PERMS, 
    ...COURSE_MGMT_STANDARD, 
    ...COURSE_ADD_STANDARD, // Granted
    ...FACILITY_MGMT_STANDARD, 
    ...HR_MGMT_STANDARD, 
    ...MENTORSHIP_MGMT_STANDARD, 
    ...ADVANCED_PERMS_NONE, 
    canUseFederalManagerAdvancedFeatures: true, 
    canManageCertificates: true, 
    manageScope: 'federal', 
    manageTimePeriod: 'anytime' 
};

const STATES_MANAGER_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...COURSE_ADD_STANDARD, ...FACILITY_MGMT_STANDARD, ...HR_MGMT_STANDARD, ...MENTORSHIP_MGMT_STANDARD, ...ADVANCED_PERMS_NONE, manageScope: 'state', manageLocation: 'user_state', manageTimePeriod: 'course_period_only' };
const LOCALITY_MANAGER_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...COURSE_ADD_STANDARD, ...FACILITY_MGMT_STANDARD, ...HR_MGMT_STANDARD, ...MENTORSHIP_MGMT_STANDARD, ...ADVANCED_PERMS_NONE, manageScope: 'locality', manageLocation: 'user_locality', manageTimePeriod: 'course_period_only', canViewLocalityPlan: true, canEditLocalityPlan: true };

// Lower-level roles do NOT get COURSE_ADD_STANDARD by default (they can only manage assigned courses)
const FEDERAL_COORDINATOR_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...FACILITY_MGMT_VIEW_ONLY, ...HR_MGMT_VIEW_ONLY, ...MENTORSHIP_MGMT_VIEW_ONLY, ...ADVANCED_PERMS_NONE, manageScope: 'course', manageLocation: 'federal_level', manageTimePeriod: 'course_period_plus_3_days' };
const FACILITATOR_PERMS = { ...FEDERAL_COORDINATOR_PERMS };
const STATE_COORDINATOR_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...FACILITY_MGMT_VIEW_ONLY, ...HR_MGMT_VIEW_ONLY, ...MENTORSHIP_MGMT_VIEW_ONLY, ...ADVANCED_PERMS_NONE, manageScope: 'course', manageLocation: 'user_state', manageTimePeriod: 'course_period_only' };
const COURSE_COORDINATOR_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...FACILITY_MGMT_VIEW_ONLY, ...HR_MGMT_NONE, ...MENTORSHIP_MGMT_VIEW_ONLY, ...ADVANCED_PERMS_NONE, manageScope: 'course', manageTimePeriod: 'course_period_only' };
const USER_PERMS = { ...BASE_PERMS, canViewCourse: true, canViewFacilities: true, canViewSkillsMentorship: false, canViewDashboard: true };

export const DEFAULT_ROLE_PERMISSIONS = {
    'super_user': applyDerivedPermissions(SUPER_USER_PERMS),
    'federal_manager': applyDerivedPermissions(FEDERAL_MANAGER_PERMS),
    'states_manager': applyDerivedPermissions(STATES_MANAGER_PERMS),
    'locality_manager': applyDerivedPermissions(LOCALITY_MANAGER_PERMS),
    'federal_coordinator': applyDerivedPermissions(FEDERAL_COORDINATOR_PERMS),
    'facilitator': applyDerivedPermissions(FACILITATOR_PERMS),
    'state_coordinator': applyDerivedPermissions(STATE_COORDINATOR_PERMS),
    'course_coordinator': applyDerivedPermissions(COURSE_COORDINATOR_PERMS),
    'user': applyDerivedPermissions(USER_PERMS),
};

export const ROLES = {
    'super_user': 'Super User',
    'federal_manager': 'Federal Manager',
    'states_manager': 'States Manager',
    'locality_manager': 'Locality Manager',
    'federal_coordinator': 'Federal Course Coordinator',
    'facilitator': 'Facilitator',
    'state_coordinator': 'State Course Coordinator',
    'course_coordinator': 'Course Coordinator',
    'user': 'Standard User',
};

export const PERMISSION_DESCRIPTIONS = {
    canViewCourse: "Allow user to view course list, details, and reports.",
    canAddCourse: "Allow user to create and add new courses to the system.", // NEW DESC
    canManageCourse: "Allow user to edit/delete active courses, participants, and monitoring observations.",
    canManageCertificates: "Allow generating, downloading, and sharing certificates.",
    canViewFacilities: "View the Child Health Services facilities list.",
    canManageFacilities: "Add, Edit, and Delete facility records within assigned scope.",
    canViewHumanResource: "Allow viewing lists for Facilitators, Program Teams, and Partners.",
    canManageHumanResource: "Allow add/edit/delete for Facilitators, Program Teams, and Partners within the user's assigned scope.",
    canViewSkillsMentorship: "Allow user to view the Skills Mentorship module, dashboard, and history.",
    canManageSkillsMentorship: "Allow user to manage skills mentorship data.",
    canAddMentorshipVisit: "Allow user to add new skills mentorship visits.", 
    canApproveSubmissions: "Approve/Reject submissions for Facilitators and Health Facilities.",
    canUseSuperUserAdvancedFeatures: "ADVANCED: Allows bulk operations (import, clean, migrate, check).", 
    canUseFederalManagerAdvancedFeatures: "ADVANCED: Allows managing inactive items, Final Reports, enables all HR Management, and grants approval rights.", 
    manageScope: "Defines the scope (Federal, State, Locality, or Course level) for management actions.",
    manageLocation: "The specific location filter for management actions.",
    manageTimePeriod: "Limits course/monitoring management actions.",
    canViewDashboard: "Derived: Allow navigating to the dashboard.",
    canViewAdmin: "Access the Admin Dashboard.",
    canViewLocalityPlan: "View the bottom-up Locality Plan.",
    canEditLocalityPlan: "Edit the bottom-up Locality Plan."
};