import React from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { Sparkles } from 'lucide-react';
import '../src/i18n';
import { EmptyState } from '../src/components/CommonComponents';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Admin → AI activity passed icon={<Sparkles />}; EmptyState rendered it as a
// component, which is React error #130 and blanked the tab.
describe('EmptyState icon', () => {
    for (const [name, icon] of [['a component', Sparkles], ['an element', <Sparkles key="s" />]]) {
        it(`renders when the icon is ${name}`, async () => {
            const host = document.createElement('div');
            const root = createRoot(host);
            await act(async () => { root.render(<EmptyState icon={icon} message="Nothing yet" />); });
            expect(host.textContent).toContain('Nothing yet');
            expect(host.querySelector('svg')).toBeTruthy();
            act(() => root.unmount());
        });
    }
});
