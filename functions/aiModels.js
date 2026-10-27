// functions/aiModels.js
//
// Which AI models the app's AI features try, in order. Shared by aiBooks.js
// and aiAssistant.js so a model Google or Groq retires is changed in one place.
//
// Checked on 2026-10-24 against the app's own keys: gemini-3.5-flash and the
// 3.x flash-lite models answer in 1-2 s; "gemini-flash-latest" was overloaded
// (503 "high demand", or no reply in 60 s) and gemini-2.5-flash returns 404 for
// this project. 2026-10-27: flash-latest overloaded again, 3.5-flash-lite
// answers in ~1 s and took its place. Pin one with GEMINI_MODEL=...,
// CEREBRAS_MODEL=... or GROQ_MODEL=... in functions/.env.
//
// Gemini is OFF (2026-10-26): Google may use free-tier prompts to improve its
// products, and the app sends programme data, so nothing goes to Google unless
// AI_USE_GEMINI=1 is set in functions/.env (do that only with a billed key,
// whose prompts Google does not use). Groq keeps no prompts by default.

const USE_GEMINI = process.env.AI_USE_GEMINI === "1";

const GEMINI_MODELS = !USE_GEMINI
  ? []
  : process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL]
    : ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"];

// Cerebras runs the same GPT-OSS as Groq on a free tier with room for the
// assistant's longer conversations (about 30,000 input tokens a minute and
// 1M tokens a day per model, against Groq's 8,000 a minute, which one
// assistant step of ~7,000 tokens nearly fills: seen in the logs 2026-10-27).
// Tried first; Groq is its backup.
const CEREBRAS_MODELS = process.env.CEREBRAS_MODEL
  ? [process.env.CEREBRAS_MODEL]
  : ["gpt-oss-120b"];

const GROQ_MODELS = process.env.GROQ_MODEL
  ? [process.env.GROQ_MODEL]
  : ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

// The longest one request to a model may take. A model that hangs must not
// use up the whole answer: the next model gets its turn instead.
const REQUEST_MS = 30000;

module.exports = { GEMINI_MODELS, CEREBRAS_MODELS, GROQ_MODELS, REQUEST_MS };
