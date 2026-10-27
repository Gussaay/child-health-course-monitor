import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';

// =============================================================================
// Ask the data on Groq: a step a model has no room for goes to the next model,
// which carries on the same conversation.
// =============================================================================

const require = createRequire(import.meta.url);
const { askChat } = require('../functions/aiChat.js');

const reply = (status, body, headers = {}) => ({
    ok: status < 300, status, headers: { get: (h) => headers[h.toLowerCase()] ?? null }, json: async () => body,
});
const toolCall = { choices: [{ message: { content: '', tool_calls: [{ id: 't1', function: { name: 'count_data', arguments: '{"collection":"courses"}' } }] } }] };
const answer = { choices: [{ message: { content: 'Twelve courses.' } }] };
const full = reply(429, { error: { message: 'Rate limit reached on tokens per minute (TPM)' } }, { 'retry-after': '7' });

afterEach(() => { vi.unstubAllGlobals(); });

describe('askChat spreads one conversation over the provider models', () => {
    it('moves a step to the next model when the first is full this minute', async () => {
        const seen = [];
        const queue = [reply(200, toolCall), full, reply(200, answer)];
        vi.stubGlobal('fetch', vi.fn(async (url, init) => { seen.push(JSON.parse(init.body)); return queue.shift(); }));
        const call = vi.fn(async () => ({ total: 12 }));
        const out = await askChat({
            provider: 'groq', key: 'k', models: ['a', 'b', 'c'], system: 'S', history: [], question: 'How many?',
            call, deadline: Date.now() + 60000,
        });
        expect(out).toEqual({ text: 'Twelve courses.', model: 'b' });
        expect(seen.map((b) => b.model)).toEqual(['a', 'a', 'b']);
        // The next model gets the whole conversation, the read's result included.
        expect(seen[2].messages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 't1' });
        expect(call).toHaveBeenCalledTimes(1);
    });

    it('gives up when every model is full and there is no time to wait', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => full));
        await expect(askChat({
            provider: 'groq', key: 'k', models: ['a', 'b'], system: 'S', history: [], question: 'Q',
            call: vi.fn(), deadline: Date.now() + 20000,
        })).rejects.toThrow(/limit/);
    });
});

describe('askChat keeps a long conversation within one request', () => {
    it('answers from what it read when the conversation is too big for every model', async () => {
        const tooBig = reply(413, { error: { message: 'Request too large for model' } });
        const queue = [reply(200, toolCall), tooBig, tooBig];
        vi.stubGlobal('fetch', vi.fn(async () => queue.shift()));
        const out = await askChat({
            provider: 'groq', key: 'k', models: ['a', 'b'], system: 'S', history: [], question: 'Q',
            call: vi.fn(async () => ({ total: 1 })), deadline: Date.now() + 60000,
        });
        expect(out.tooManySteps).toBe(true);
    });

    it('shortens earlier read results, oldest first, to fit the budget', async () => {
        const seen = [];
        const calls = (id) => ({ choices: [{ message: { content: '', tool_calls: [{ id, function: { name: 'count_data', arguments: '{}' } }] } }] });
        const queue = [reply(200, calls('t1')), reply(200, calls('t2')), reply(200, calls('t3')), reply(200, answer)];
        vi.stubGlobal('fetch', vi.fn(async (url, init) => { seen.push(JSON.parse(init.body)); return queue.shift(); }));
        await askChat({
            provider: 'groq', key: 'k', models: ['a'], system: 'S', history: [], question: 'Q',
            call: vi.fn(async () => ({ rows: 'x'.repeat(3900) })), deadline: Date.now() + 60000,
        });
        const tools = seen.at(-1).messages.filter((m) => m.role === 'tool');
        expect(tools).toHaveLength(3);
        expect(tools.reduce((n, m) => n + m.content.length, 0)).toBeLessThanOrEqual(8000 + 200);
        expect(tools[0].content).toMatch(/cut to save space/);
        expect(tools[2].content).not.toMatch(/cut to save space/);
    });
});
