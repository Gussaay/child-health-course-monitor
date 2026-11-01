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

describe('Cerebras only when switched on', () => {
    afterEach(() => { vi.unstubAllEnvs(); });

    it('lists no Cerebras model unless AI_USE_CEREBRAS=1', async () => {
        vi.stubEnv('AI_USE_CEREBRAS', '');
        expect((await load()).CEREBRAS_MODELS).toEqual([]);
    });

    it('lists the Cerebras GPT-OSS model when on, and takes a pinned one', async () => {
        vi.stubEnv('AI_USE_CEREBRAS', '1');
        expect((await load()).CEREBRAS_MODELS).toEqual(['gpt-oss-120b']);
        vi.stubEnv('CEREBRAS_MODEL', 'qwen-3.8-27b');
        expect((await load()).CEREBRAS_MODELS).toEqual(['qwen-3.8-27b']);
    });
});

describe('Groq has several models to spread a conversation over', () => {
    it('lists the two GPT-OSS models and Qwen', async () => {
        vi.stubEnv('GROQ_MODEL', '');
        expect((await load()).GROQ_MODELS).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b']);
        vi.unstubAllEnvs();
    });
});
