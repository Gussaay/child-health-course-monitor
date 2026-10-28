import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';

// =============================================================================
// Ask the data on Groq: a step a model has no room for goes to the next model,
// which carries on the same conversation.
// =============================================================================

const require = createRequire(import.meta.url);
const { askChat, keepHistoryWithin } = require('../functions/aiChat.js');
const { pageBlock } = require('../functions/aiDataText.js');

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

describe('a follow-up question stays within Groq limits', () => {
    const tooBig = reply(413, { error: { message: 'Request too large for model' } });
    const history = [
        { role: 'user', content: 'Compare MICS and S3M' },
        { role: 'assistant', content: 'A long answer. '.repeat(400) },
    ];

    it('keeps the newest turns and cuts or drops older ones to the budget', () => {
        const kept = keepHistoryWithin([...history, { role: 'user', content: 'Try' }, { role: 'assistant', content: 'x'.repeat(500) }], 1000);
        expect(kept.reduce((n, m) => n + m.content.length, 0)).toBeLessThan(1100);
        expect(kept[0].role).toBe('user');
        expect(kept.at(-1).content).toBe('x'.repeat(500));
    });

    it('asks again without the earlier turns when they make it too big', async () => {
        const seen = [];
        const queue = [tooBig, tooBig, reply(200, answer)];
        vi.stubGlobal('fetch', vi.fn(async (url, init) => { seen.push(JSON.parse(init.body)); return queue.shift(); }));
        const out = await askChat({
            provider: 'groq', key: 'k', models: ['a', 'b'], system: 'S', history, question: 'Then compare',
            call: vi.fn(), deadline: Date.now() + 60000,
        });
        expect(out.text).toBe('Twelve courses.');
        expect(seen[0].messages).toHaveLength(4);
        expect(seen[2].messages.map((m) => m.role)).toEqual(['system', 'user']);
    });

    it('gives a step to the next model after an empty reply', async () => {
        const seen = [];
        const queue = [reply(200, { choices: [{ message: { content: '' } }] }), reply(200, answer)];
        vi.stubGlobal('fetch', vi.fn(async (url, init) => { seen.push(JSON.parse(init.body)); return queue.shift(); }));
        const out = await askChat({
            provider: 'groq', key: 'k', models: ['a', 'b'], system: 'S', history: [], question: 'Q',
            call: vi.fn(), deadline: Date.now() + 60000,
        });
        expect(out).toEqual({ text: 'Twelve courses.', model: 'b' });
    });

    it('asks qwen for no more reply than its 1,000 tokens a minute allow', async () => {
        const seen = [];
        vi.stubGlobal('fetch', vi.fn(async (url, init) => { seen.push(JSON.parse(init.body)); return reply(200, answer); }));
        await askChat({
            provider: 'groq', key: 'k', models: ['qwen/qwen3.8-27b'], system: 'S', history: [], question: 'Q',
            call: vi.fn(), deadline: Date.now() + 60000,
        });
        expect(seen[0].max_completion_tokens).toBeLessThan(1000);
    });
});

describe('the page given to the assistant', () => {
    it('includes the figures of the sub-tabs that are not open', () => {
        const block = pageBlock({ title: 'Morbidity & Mortality', text: 'Sudan MICS 2014 Diarrhoea 29.0', reference: 'Sudan S3M II 2018, national (Sudan):\n- Diarrhoea: 21.3%' });
        expect(block).toMatch(/OTHER SUB-TABS OF THIS PAGE/);
        expect(block).toMatch(/Diarrhoea: 21\.3%/);
    });
});
