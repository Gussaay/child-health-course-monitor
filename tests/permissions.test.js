import { describe, it, expect } from 'vitest';
import {
    ALL_PERMISSIONS,
    ALL_PERMISSION_KEYS,
    applyDerivedPermissions,
    mergeRolePermissions,
    DEFAULT_ROLE_PERMISSIONS,
} from '../src/components/permissions.js';

// This module decides what every user in the system can see and do, it is pure,
// and it has a history of subtle bugs (a mutated shared constant, an empty
// stored blueprint silently demoting people). That makes it the highest-value
// thing in the codebase to test.

describe('applyDerivedPermissions', () => {
    it('does not mutate its argument', () => {
        const source = { ...ALL_PERMISSIONS, canManageFacilities: true };
        const snapshot = JSON.stringify(source);
        applyDerivedPermissions(source);
        expect(JSON.stringify(source)).toBe(snapshot);
    });

    it('does not mutate the shared role blueprint', () => {
        const before = JSON.stringify(DEFAULT_ROLE_PERMISSIONS.user);
        applyDerivedPermissions(DEFAULT_ROLE_PERMISSIONS.user);
        applyDerivedPermissions(DEFAULT_ROLE_PERMISSIONS.user);
        expect(JSON.stringify(DEFAULT_ROLE_PERMISSIONS.user)).toBe(before);
    });

    it('grants view rights implied by manage rights', () => {
        const result = applyDerivedPermissions({
            ...ALL_PERMISSIONS,
            canManageFacilities: true,
            canManageHumanResource: true,
            canManageSkillsMentorship: true,
        });
        expect(result.canViewFacilities).toBe(true);
        expect(result.canViewHumanResource).toBe(true);
        expect(result.canViewSkillsMentorship).toBe(true);
    });

    it('lets anyone who can add or manage courses view them', () => {
        expect(applyDerivedPermissions({ ...ALL_PERMISSIONS, canAddCourse: true }).canViewCourse).toBe(true);
        expect(applyDerivedPermissions({ ...ALL_PERMISSIONS, canManageCourse: true }).canViewCourse).toBe(true);
    });

    it('leaves an empty permission set empty', () => {
        const result = applyDerivedPermissions({ ...ALL_PERMISSIONS });
        expect(result.canViewDashboard).toBe(false);
        expect(result.canViewCourse).toBe(false);
    });
});

describe('mergeRolePermissions', () => {
    it('returns no permissions for no roles', () => {
        const result = mergeRolePermissions([], {});
        for (const key of ALL_PERMISSION_KEYS) {
            if (typeof ALL_PERMISSIONS[key] === 'boolean') expect(result[key]).toBe(false);
        }
    });

    it('takes the union of boolean permissions across roles', () => {
        const map = {
            a: { ...ALL_PERMISSIONS, canViewCourse: true },
            b: { ...ALL_PERMISSIONS, canManageFacilities: true },
        };
        const result = mergeRolePermissions(['a', 'b'], map);
        expect(result.canViewCourse).toBe(true);
        expect(result.canManageFacilities).toBe(true);
    });

    it('takes the widest scope when roles disagree', () => {
        const map = {
            narrow: { ...ALL_PERMISSIONS, manageScope: 'locality' },
            wide: { ...ALL_PERMISSIONS, manageScope: 'federal' },
        };
        expect(mergeRolePermissions(['narrow', 'wide'], map).manageScope).toBe('federal');
        expect(mergeRolePermissions(['wide', 'narrow'], map).manageScope).toBe('federal');
    });

    it('ignores the plain user role when combined with a real role', () => {
        const map = {
            user: { ...ALL_PERMISSIONS },
            super_user: DEFAULT_ROLE_PERMISSIONS.super_user,
        };
        const result = mergeRolePermissions(['user', 'super_user'], map);
        expect(result.canViewAdmin).toBe(true);
    });

    // The regression this module's comments describe: an empty stored entry is
    // truthy, so every holder of that role fell through to {} and lost
    // everything — which looked on screen like being demoted to a normal user.
    it('falls back to the built-in defaults when the stored blueprint is empty', () => {
        const result = mergeRolePermissions(['super_user'], { super_user: {} });
        expect(result.canViewAdmin).toBe(true);
        expect(result.manageScope).toBe('federal');
    });

    it('layers stored overrides on top of the defaults rather than replacing them', () => {
        const result = mergeRolePermissions(['super_user'], { super_user: { canViewAdmin: false } });
        // The override cannot remove what another default grants, but unrelated
        // defaults must survive.
        expect(result.canManageCourse).toBe(true);
    });

    it('never returns a permission key the app does not know about', () => {
        const result = mergeRolePermissions(['super_user'], { super_user: { madeUpPermission: true } });
        expect(Object.keys(result)).toEqual(expect.arrayContaining(ALL_PERMISSION_KEYS));
    });
});

describe('DEFAULT_ROLE_PERMISSIONS', () => {
    it('gives the plain user role no management rights', () => {
        const user = applyDerivedPermissions(DEFAULT_ROLE_PERMISSIONS.user);
        expect(user.canViewAdmin).toBe(false);
        expect(user.canManageCourse).toBe(false);
        expect(user.canManageFacilities).toBe(false);
        expect(user.canUseSuperUserAdvancedFeatures).toBe(false);
        expect(user.manageScope).toBe('none');
    });

    it('defines every role with keys the app recognises', () => {
        for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
            for (const key of Object.keys(permissions)) {
                expect(ALL_PERMISSION_KEYS, `${role}.${key}`).toContain(key);
            }
        }
    });
});
