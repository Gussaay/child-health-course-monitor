import { describe, it, expect, afterEach, vi } from 'vitest';

// =============================================================================
// Which AI models the functions try: Gemini stays off unless switched on.
// =============================================================================

const load = async () => {
    vi.resetModules();
    return import('../functions/aiModels.js');
};

describe('Gemini is off by default', () => {
    afterEach(() => { vi.unstubAllEnvs(); });

    it('lists no Gemini model, only Groq, when AI_USE_GEMINI is not set', async () => {
        vi.stubEnv('AI_USE_GEMINI', '');
        const m = await load();
        expect(m.GEMINI_MODELS).toEqual([]);
        expect(m.GROQ_MODELS.length).toBeGreaterThan(0);
    });

    it('lists the Gemini models again with AI_USE_GEMINI=1', async () => {
        vi.stubEnv('AI_USE_GEMINI', '1');
        const m = await load();
        expect(m.GEMINI_MODELS.length).toBeGreaterThan(0);
    });
});
