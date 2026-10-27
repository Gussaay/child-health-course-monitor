// functions/aiChat.js
//
// The OpenAI-style chat providers of the data assistant (Cerebras, Groq): the
// request with its retries, and the tool loop that spreads one conversation
// over a provider's models. Kept apart from aiAssistant.js so it can be
// tested without the Cloud Functions runtime installed.

const { TOOLS } = require("./aiDataText");
const { REQUEST_MS } = require("./aiModels");

// The Cloud Functions logger where it is installed (in the functions); the
// unit tests run without it.
let logger;
try {
  logger = require("firebase-functions/logger");
} catch {
  logger = { info() {}, warn() {} };
}

const MAX_STEPS = 8;          // model calls per question
const LAST_STEP_AT = 25000;   // time left at which the next step must answer
const ANSWER_NOW = "You cannot read any more data now. Answer the question from the results you already have, as the rules say: say what they show, what they do not, and keep to the format (headings, Source line, follow-up questions).";
const clip = (s, n) => String(s ?? "").slice(0, n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Both speak the OpenAI chat format; Groq alone takes include_reasoning.
// Groq counts max_completion_tokens in each request's 8,000 tokens a minute,
// so it is given a smaller reply allowance.
const CHAT = {
  cerebras: { name: "Cerebras", url: "https://api.cerebras.ai/v1/chat/completions", extra: { max_completion_tokens: 2500 } },
  groq: { name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", extra: { include_reasoning: false, max_completion_tokens: 1800 } },
};

// How much each provider is given: Groq's per-minute allowance counts the
// whole conversation, so it sees less of the page and of each result.
const SIZES = {
  gemini: { result: 12000, page: 9000 },
  cerebras: { result: 8000, page: 6000, reads: 30000 },
  // `reads`: all results in one Groq request together. A request over 8,000
  // tokens is refused outright (413), and Arabic results run ~2.2 characters
  // a token, so earlier results are shortened to keep within it.
  groq: { result: 4000, page: 3000, reads: 8000 },
};

class ProviderError extends Error {}
class TooBig extends Error {}

// How long Google or Groq asks us to wait before trying again, in seconds.
const waitAsked = (r, j) => parseFloat(r.headers.get("retry-after"))
  || parseFloat((j?.error?.details || []).find((d) => d.retryDelay)?.retryDelay) || 0;

// A request that fails is retried once only when the wait is short; a used-up
// quota moves straight on to the next model rather than keeping the person
// waiting.
async function post(url, headers, body, label, deadline, { waitLimits = true } = {}) {
  for (let attempt = 0; ; attempt++) {
    const left = deadline - Date.now();
    if (left < 3000) throw new ProviderError(`${label}: out of time`);
    const t0 = Date.now();
    let r;
    try {
      r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(Math.min(left, REQUEST_MS)) });
    } catch (e) {
      throw new ProviderError(`${label}: ${e.name === "TimeoutError" ? "no reply in time" : clip(e.message, 120)}`);
    }
    logger.info(`[aiAssistant] ${label} replied ${r.status} in ${Date.now() - t0} ms`);
    const j = await r.json().catch(() => ({}));
    if (r.ok) return j;
    const wait = waitAsked(r, j);
    // A per-minute limit (Cerebras allows 5 requests a minute) is waited out
    // when there is time; a used-up day is not.
    const brief = [500, 502, 503].includes(r.status)
      || (waitLimits && r.status === 429 && wait > 0 && wait <= (left > 45000 ? 10 : 3));
    if (attempt < 1 && brief) { await sleep(Math.max(wait * 1000, 1000)); continue; }
    const err = new ProviderError(`${label} ${r.status}: ${clip(j?.error?.message, 200)}`);
    err.status = r.status;
    err.detail = j?.error?.message || "";
    err.wait = wait;
    throw err;
  }
}

/** Earlier read results cut short, oldest first, until all of them fit in `budget` characters. */
function keepReadsWithin(messages, budget) {
  const tools = messages.filter((m) => m.role === "tool");
  let total = tools.reduce((n, m) => n + m.content.length, 0);
  for (const m of tools.slice(0, -1)) {
    if (total <= budget) break;
    const keep = Math.max(600, m.content.length - (total - budget));
    if (keep < m.content.length) {
      total -= m.content.length - keep;
      m.content = `${m.content.slice(0, keep)} …(cut to save space; read again if needed)`;
    }
  }
  return messages;
}

/**
 * One conversation, its steps spread over `models`. Each model has its own
 * per-minute token allowance (Groq's free tier: 8,000, and one step of this
 * conversation is ~7,000), so a step a model has no room for goes to the next
 * model, which carries on the same conversation. Only when every model is
 * full is the shortest asked wait waited out, if there is time.
 */
async function askChat({ provider, key, models, system, history, question, call, deadline }) {
  const { name, url, extra } = CHAT[provider];
  let at = 0;
  const step1 = async (body) => {
    let waited = false;
    for (;;) {
      const waits = [];
      let tooBig = 0;
      for (let i = 0; i < models.length; i++) {
        const model = models[(at + i) % models.length];
        try {
          const j = await post(url, { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            { model, ...body, reasoning_effort: "low", ...extra }, `${name} ${model}`, deadline, { waitLimits: models.length === 1 });
          at = (at + i) % models.length;
          return { j, model };
        } catch (e) {
          // Full this minute, or the request is too big for it: the next model.
          if (!(e instanceof ProviderError) || ![413, 429].includes(e.status)) throw e;
          logger.warn(`[aiAssistant] ${e.message}`);
          waits.push(e.wait || 0);
          if (e.status === 413) tooBig++;
          if (i === models.length - 1 && (waited || models.length === 1)) throw e;
        }
      }
      // Too big for every model, now or after a wait: answer from what was read.
      if (waits.length === models.length && tooBig === models.length) throw new TooBig();
      const wait = Math.min(...waits.filter((w) => w > 0), 20);
      if (deadline - Date.now() - wait * 1000 < LAST_STEP_AT) throw new ProviderError(`${name}: every model is at its limit`);
      logger.info(`[aiAssistant] ${name}: every model full, waiting ${wait} s`);
      await sleep(wait * 1000);
      waited = true;
    }
  };
  const messages = [
    { role: "system", content: system },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];
  const tools = TOOLS.map((t) => ({ type: "function", function: t }));
  for (let step = 0; step < MAX_STEPS; step++) {
    const last = step === MAX_STEPS - 1 || deadline - Date.now() < LAST_STEP_AT;
    keepReadsWithin(messages, SIZES[provider].reads);
    let got;
    try {
      got = await step1({
        messages: last ? [...messages, { role: "user", content: ANSWER_NOW }] : messages,
        tools, tool_choice: last ? "none" : "auto", temperature: 0.2,
      });
    } catch (e) {
      if (e instanceof TooBig && step > 0) return { text: "", tooManySteps: true, model: models[at] };
      throw e instanceof TooBig ? new ProviderError(`${name}: the question is too long for its models`) : e;
    }
    const { j, model } = got;
    const msg = j?.choices?.[0]?.message || {};
    const calls = msg.tool_calls || [];
    if (calls.length) logger.info(`[aiAssistant] ${name} step ${step + 1}: ${calls.map((c) => `${c.function?.name} ${clip(c.function?.arguments, 300)}`).join(" | ")}`);
    if (calls.length && last) return { text: "", tooManySteps: true, model };
    if (!calls.length) {
      const text = String(msg.content || "").trim();
      if (!text) throw new ProviderError(`${name} ${model}: empty reply`);
      return { text, model };
    }
    messages.push({ role: "assistant", content: msg.content || "", tool_calls: calls });
    const outs = await Promise.all(calls.map((c) => {
      let args = {};
      try { args = JSON.parse(c.function?.arguments || "{}"); } catch { args = {}; }
      return call(c.function?.name, args, SIZES[provider].result);
    }));
    calls.forEach((c, i) => {
      messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(outs[i]).slice(0, SIZES[provider].result + 500) });
    });
  }
  return { text: "", tooManySteps: true, model: models[at] };
}

module.exports = {
  CHAT, SIZES, MAX_STEPS, LAST_STEP_AT, ANSWER_NOW, ProviderError, TooBig, post, keepReadsWithin, askChat,
};
