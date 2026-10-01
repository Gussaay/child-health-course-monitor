import { describe, it, expect } from 'vitest';
import {
    COLLECTIONS, NEVER, catalogueFor, assertReadable, MAX_ROWS,
} from '../functions/claudePolicy.js';

// =============================================================================
// The gate between programme data and a model's context.
//
// This is the one path where health-programme data leaves the system into
// Claude. What it refuses matters more than what it returns, so the refusals
// are what is pinned here.
// =============================================================================

const asUser = (permissions = {}, extra = {}) => ({
    uid: 'u1', roles: ['user'], permissions, manageScope: 'all', manageLocation: '', ...extra,
});

describe('what may be read at all', () => {
    it('refuses the collections that are never readable, whatever the role', () => {
        // Credentials, the delivery queue, and the permission blueprint itself.
        // A super user has no business reading these through an assistant
        // either — each one is a way to escalate rather than to analyse.
        const superUser = asUser(Object.fromEntries(
            Object.values(COLLECTIONS).map((c) => [c.permission, true])));

        ['users', 'meta', 'mail'].forEach((name) => {
            expect(() => assertReadable(name, superUser)).toThrow();
        });
    });

    it('refuses a collection nobody has listed', () => {
        // The point of an allowlist: a collection added to Firestore tomorrow is
        // unreachable until somebody says which permission it needs.
        expect(() => assertReadable('someNewCollection', asUser({ canViewCourse: true })))
            .toThrow(/Unknown collection/);
    });

    it('refuses a listed collection when the caller lacks its permission', () => {
        expect(() => assertReadable('healthFacilities', asUser({ canViewCourse: true })))
            .toThrow(/does not have access/);
    });

    it('allows it when they do', () => {
        expect(() => assertReadable('healthFacilities', asUser({ canViewFacilities: true })))
            .not.toThrow();
    });

    it('names the permission that is missing, so it can be granted', () => {
        expect(() => assertReadable('masterPlans', asUser({})))
            .toThrow(/canViewLocalityPlan/);
    });
});

describe('the catalogue a caller is shown', () => {
    it('lists only what that person can read', () => {
        const facilitiesOnly = catalogueFor(asUser({ canViewFacilities: true }));
        const names = facilitiesOnly.map((c) => c.collection);
        expect(names).toContain('healthFacilities');
        expect(names).not.toContain('participants');
        expect(names).not.toContain('imnciPatientRecords');
    });

    it('is empty for an account with no permissions', () => {
        expect(catalogueFor(asUser({}))).toEqual([]);
    });

    it('says which collections carry personal or clinical detail', () => {
        const all = catalogueFor(asUser(Object.fromEntries(
            Object.values(COLLECTIONS).map((c) => [c.permission, true]))));

        const patients = all.find((c) => c.collection === 'imnciPatientRecords');
        expect(patients.containsClinicalRecords).toBe(true);
        expect(patients.containsPersonalData).toBe(true);

        const participants = all.find((c) => c.collection === 'participants');
        expect(participants.containsPersonalData).toBe(true);

        const facilities = all.find((c) => c.collection === 'healthFacilities');
        expect(facilities.containsClinicalRecords).toBe(false);
    });
});

describe('the allowlist itself', () => {
    it('gives every collection a permission to sit behind', () => {
        // A collection added here without one would be readable by anybody.
        Object.entries(COLLECTIONS).forEach(([name, spec]) => {
            expect(spec.permission, `${name} has no permission`).toBeTruthy();
            expect(spec.description, `${name} has no description`).toBeTruthy();
        });
    });

    it('never lists something that is also marked as never readable', () => {
        Object.keys(COLLECTIONS).forEach((name) => {
            expect(NEVER.has(name), `${name} is in both lists`).toBe(false);
        });
    });

    it('caps how much can be pulled in one call', () => {
        expect(MAX_ROWS).toBeLessThanOrEqual(500);
    });
});
