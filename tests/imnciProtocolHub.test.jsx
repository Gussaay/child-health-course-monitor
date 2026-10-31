import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// The page reads everything through the data cache; the test controls it.
const cache = { protocols: null, isLoading: { imnciProtocols: true }, fetchProtocols: vi.fn() };
vi.mock('../src/DataContext', () => ({
    useDataCache: () => ({
        healthFacilities: [], fetchHealthFacilities: vi.fn(),
        imnciPatientRecords: [], fetchIMNCIPatientRecords: vi.fn(),
        ...cache,
    }),
}));
vi.mock('../src/data', () => ({ saveIMNCIProtocol: vi.fn(), saveIMNCIPatientRecord: vi.fn() }));
vi.mock('../src/firebase', () => ({ db: {} }));

import i18n from '../src/i18n';
import IMNCIRecordingForm from '../src/components/imnci/form';
import ProtocolEditor from '../src/components/imnci/protocol';

let host, root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); cache.protocols = null; cache.isLoading = { imnciProtocols: true }; cache.fetchProtocols = vi.fn(); });

describe('IMNCI Protocol hub language', () => {
    it('shows English tiles when the app is in English', async () => {
        await act(async () => { await i18n.changeLanguage('en'); });
        await act(async () => { root.render(<IMNCIRecordingForm permissions={{ canManageProtocols: true }} />); });
        expect(host.textContent).toContain('Protocol management');
        expect(host.textContent).toContain('Reports management');
        expect(host.textContent).toContain('Patient management');
        expect(host.textContent).not.toMatch(/[؀-ۿ]/);
    });
    it('shows Arabic tiles when the app is in Arabic', async () => {
        await act(async () => { await i18n.changeLanguage('ar'); });
        await act(async () => { root.render(<IMNCIRecordingForm permissions={{ canManageProtocols: true }} />); });
        expect(host.textContent).toContain('إدارة البروتوكول');
        await act(async () => { await i18n.changeLanguage('en'); });
    });
    it('loads the saved protocol for the forms', async () => {
        await act(async () => { root.render(<IMNCIRecordingForm permissions={{}} />); });
        expect(cache.fetchProtocols).toHaveBeenCalled();
    });
});

describe('Protocol management loading', () => {
    it('starts the protocol load itself instead of waiting forever', async () => {
        cache.fetchProtocols = vi.fn(async () => { cache.isLoading = { imnciProtocols: false }; cache.protocols = { child: { formType: 'child', categories: {} } }; return cache.protocols; });
        await act(async () => { root.render(<ProtocolEditor />); });
        expect(cache.fetchProtocols).toHaveBeenCalledTimes(1);
    });
    it('shows an error with Try again when the load fails, and does not open a blank protocol', async () => {
        cache.fetchProtocols = vi.fn(async () => { cache.isLoading = { imnciProtocols: false }; return []; });
        await act(async () => { root.render(<ProtocolEditor />); });
        await act(async () => { root.render(<ProtocolEditor />); });
        expect(host.textContent).toContain('The protocol could not be loaded.');
        const retry = [...host.querySelectorAll('button')].find(b => b.textContent === 'Try again');
        expect(retry).toBeTruthy();
        await act(async () => { retry.click(); });
        expect(cache.fetchProtocols).toHaveBeenLastCalledWith(true);
    });
});
