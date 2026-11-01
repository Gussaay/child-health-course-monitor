import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const reports = [
    { id: 'p1', kind: 'permission', what: 'Permission denied: ERROR saving to Firestore:', role: 'user', roles: ['user'], context: 'ERROR saving to Firestore:', path: '/monitor/course/c1', status: 'new', reporterEmail: 'a@x.org' },
    { id: 'c1', kind: 'crash', what: 'boom', status: 'new' },
];
vi.mock('../src/data', () => ({
    listProblemReports: vi.fn(async () => reports),
    submitProblemReport: vi.fn(), setProblemReportStatus: vi.fn(), deleteProblemReport: vi.fn(),
}));
vi.mock('../src/firebase', () => ({ db: {} }));

import i18n from '../src/i18n';
import { ProblemReportsTab } from '../src/components/ProblemReports';
import { ASK_DATA_EVENT } from '../src/utils/askDataAssistant';

let host, root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const button = (text) => [...host.querySelectorAll('button')].find((b) => b.textContent.includes(text));

describe('Admin → Problems', () => {
    it('lists permission errors with the role, and hands questions to the AI', async () => {
        await act(async () => { await i18n.changeLanguage('en'); });
        await act(async () => { root.render(<ProblemReportsTab />); });
        await act(async () => {});
        expect(button('Permission errors (1)')).toBeTruthy();

        await act(async () => { button('Permission errors').click(); });
        expect(host.textContent).toContain('Permission denied');
        expect(host.textContent).not.toContain('boom');

        await act(async () => { host.querySelector('.cursor-pointer').click(); });
        expect(host.textContent).toContain('Role:');
        expect(host.textContent).toContain('/monitor/course/c1');

        const asked = [];
        const onAsk = (e) => asked.push(e.detail.question);
        window.addEventListener(ASK_DATA_EVENT, onAsk);
        await act(async () => { button('Analyse with AI').click(); });
        await act(async () => { button('Ask AI').click(); });
        window.removeEventListener(ASK_DATA_EVENT, onAsk);
        expect(asked[0]).toContain('permission errors');
        expect(asked[1]).toContain('p1');
    });
});
