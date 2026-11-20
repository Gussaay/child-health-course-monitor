// problemGroups (src/utils/problemGroups.js): Admin → Problems showed
// 214 open reports that were really a handful of problems repeating.
// These tests pin the grouping the triage relies on.
import { describe, it, expect } from 'vitest';
import { problemSignature, groupProblemReports, reportMillis } from '../src/utils/problemGroups';

const ts = (ms) => ({ toMillis: () => ms });

describe('problemSignature', () => {
    it('groups the same crash across releases (chunk hash changes)', () => {
        const a = { kind: 'crash', screen: 'dashboard', what: 'Failed to fetch dynamically imported module: https://x.web.app/assets/DashboardView-COGNCFnh.js' };
        const b = { kind: 'crash', screen: 'dashboard', what: 'Failed to fetch dynamically imported module: https://x.web.app/assets/DashboardView-gLSupcv0.js' };
        expect(problemSignature(a)).toBe(problemSignature(b));
    });

    it('groups listener errors that start with a fresh timestamp', () => {
        const a = { kind: 'permission', screen: 'landing', what: 'Permission denied: [2026-11-19T11:35:46.304Z] @firebase/firestore: Uncaught Error in snapshot listener' };
        const b = { kind: 'permission', screen: 'landing', what: 'Permission denied: [2026-11-12T21:48:01.100Z] @firebase/firestore: Uncaught Error in snapshot listener' };
        expect(problemSignature(a)).toBe(problemSignature(b));
    });

    it('keeps different problems apart', () => {
        const base = { kind: 'crash', screen: 'landing', what: 'n.label.toLowerCase is not a function' };
        expect(problemSignature(base)).not.toBe(problemSignature({ ...base, screen: 'courses' }));
        expect(problemSignature(base)).not.toBe(problemSignature({ ...base, kind: 'permission' }));
        expect(problemSignature(base)).not.toBe(problemSignature({ ...base, what: 'Cannot access Y before initialization' }));
    });
});

describe('groupProblemReports', () => {
    const reports = [
        { id: '1', kind: 'crash', screen: 'dashboard', what: 'Failed to fetch dynamically imported module: /assets/DashboardView-AAAAAAA1.js', reporterEmail: 'a@x.org', status: 'new', createdAt: ts(1000) },
        { id: '2', kind: 'crash', screen: 'dashboard', what: 'Failed to fetch dynamically imported module: /assets/DashboardView-BBBBBBB2.js', reporterEmail: 'b@x.org', status: 'new', createdAt: ts(3000) },
        { id: '3', kind: 'crash', screen: 'dashboard', what: 'Failed to fetch dynamically imported module: /assets/DashboardView-CCCCCCC3.js', reporterEmail: 'a@x.org', status: 'resolved', createdAt: ts(2000) },
        { id: '4', kind: 'permission', screen: 'courses', what: 'Permission denied', reporterEmail: 'c@x.org', status: 'new', createdAt: ts(5000) },
    ];

    it('folds repeats into one group with count, accounts and dates', () => {
        const groups = groupProblemReports(reports);
        expect(groups).toHaveLength(2);
        const top = groups[0];
        expect(top.count).toBe(3);
        expect(top.openCount).toBe(2);
        expect(top.accounts.sort()).toEqual(['a@x.org', 'b@x.org']);
        expect(top.screens).toEqual(['dashboard']);
        expect(top.firstAt).toBe(1000);
        expect(top.lastAt).toBe(3000);
        expect(top.reports.map((r) => r.id)).toEqual(['1', '2', '3']);
    });

    it('handles empty and missing input', () => {
        expect(groupProblemReports([])).toEqual([]);
        expect(groupProblemReports(null)).toEqual([]);
    });
});

describe('reportMillis', () => {
    it('reads every timestamp shape the reports use', () => {
        expect(reportMillis({ createdAt: ts(42) })).toBe(42);
        expect(reportMillis({ createdAt: 42 })).toBe(42);
        expect(reportMillis({ createdAt: new Date(42) })).toBe(42);
        expect(reportMillis({ createdAt: '1970-01-01T00:00:00.042Z' })).toBe(42);
        expect(reportMillis({})).toBe(0);
    });
});
