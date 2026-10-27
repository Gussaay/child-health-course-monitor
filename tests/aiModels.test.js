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

describe('Cerebras comes first, Groq is its backup', () => {
    afterEach(() => { vi.unstubAllEnvs(); });

    it('lists the Cerebras GPT-OSS model by default and takes a pinned one', async () => {
        expect((await load()).CEREBRAS_MODELS).toEqual(['gpt-oss-120b']);
        vi.stubEnv('CEREBRAS_MODEL', 'qwen-3.8-27b');
        expect((await load()).CEREBRAS_MODELS).toEqual(['qwen-3.8-27b']);
    });
});
