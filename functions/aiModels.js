// functions/aiModels.js
//
// Which AI models the app's AI features try, in order. Shared by aiBooks.js
// and aiAssistant.js so a model Google or Groq retires is changed in one place.
//
// Checked on 2026-10-24 against the app's own keys: gemini-3.5-flash and the
// 3.x flash-lite models answer in 1-2 s; "gemini-flash-latest" was overloaded
// (503 "high demand", or no reply in 60 s) and gemini-2.5-flash returns 404 for
// this project. Pin one with GEMINI_MODEL=... or GROQ_MODEL=... in functions/.env.

const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-lite-latest", "gemini-flash-latest"];

const GROQ_MODELS = process.env.GROQ_MODEL
  ? [process.env.GROQ_MODEL]
  : ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

// The longest one request to a model may take. A model that hangs must not
// use up the whole answer: the next model gets its turn instead.
const REQUEST_MS = 30000;

module.exports = { GEMINI_MODELS, GROQ_MODELS, REQUEST_MS };
