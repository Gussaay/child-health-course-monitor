// src/components/permissions.js

export const ALL_PERMISSIONS = {
    canViewDashboard: true,
    canViewCourse: true,
    canViewHumanResource: true,
    canViewFacilities: true,
    canViewSkillsMentorship: true,
    canViewAdmin: true,
    canManageCourse: true,
    canManageHumanResource: true,
    canManageFacilities: true,
    canApproveSubmissions: true,
    canUseSuperUserAdvancedFeatures: true,
    canUseFederalManagerAdvancedFeatures: true,
};

export const ALL_PERMISSION_KEYS = Object.keys(ALL_PERMISSIONS);

export const DEFAULT_ROLE_PERMISSIONS = {
    'super_user': ALL_PERMISSION_KEYS,
    'federal_manager': [
        'canViewDashboard', 'canViewCourse', 'canViewHumanResource', 'canViewFacilities', 'canViewSkillsMentorship',
        'canManageCourse', 'canManageHumanResource', 'canManageFacilities',
        'canApproveSubmissions', 'canUseFederalManagerAdvancedFeatures'
    ],
    'state_manager': [
        'canViewDashboard', 'canViewCourse', 'canViewHumanResource', 'canViewFacilities', 'canViewSkillsMentorship',
        'canManageCourse', 'canManageHumanResource', 'canManageFacilities'
    ],
    'locality_manager': [
        'canViewDashboard', 'canViewCourse', 'canViewHumanResource', 'canViewFacilities', 'canViewSkillsMentorship',
        'canManageCourse', // Usually limited to their locality
        'canManageFacilities'
    ],
    'user': [
        'canViewDashboard', 'canViewCourse', 'canViewHumanResource', 'canViewFacilities', 'canViewSkillsMentorship'
    ]
};

export const applyDerivedPermissions = (basePermissions) => {
    // Logic to ensure derived permissions are set correctly
    // For simplicity in this extraction, we return the base. 
    // If you had complex logic in AdminDashboard, copy it here.
    return basePermissions; 
};