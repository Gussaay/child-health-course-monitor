import { describe, it, expect } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CertificateDesigner } from '../src/components/CertificateGenerator.jsx';

// The designer once read a value in a hook's dependency list before the line
// that declared it, so it threw on its first render and the customizer page
// stayed blank. Rendering it once guards that.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('CertificateDesigner', () => {
    it('opens for a course without throwing', async () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const root = createRoot(el);
        await act(async () => {
            root.render(<CertificateDesigner course={{ id: 'x', course_type: 'IMNCI', customCertificate: {} }} onBack={() => {}} />);
        });
        expect(el.textContent).toContain('Save draft');
        await act(async () => { root.unmount(); });
    });
});
