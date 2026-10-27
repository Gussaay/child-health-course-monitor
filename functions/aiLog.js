// functions/aiLog.js
//
// One record per use of the app's AI features (the "Ask the data" assistant
// and the AI library's tasks), for the super users' AI activity page:
// aiLog/{auto id}
//   { uid, email, name, feature, what, where, provider, model, status
//     ("ok" | "error" | "limit" | "cached"), error, ms, used, limit, pool,
//     day (YYYY-MM-DD, UTC, the day the daily limits count), at }
// `used` / `limit` are the person's count for that feature after this use and
// their daily limit there; `pool` is the free tiers' estimated daily capacity
// shared by everyone (poolEstimate). Written by the functions alone.

const { FieldValue } = require("firebase-admin/firestore");
const { GEMINI_MODELS, CEREBRAS_MODELS, GROQ_MODELS } = require("./aiModels");

// Free-tier requests a day per model. Groq gives GPT-OSS 1,000 requests but
// 200K tokens a day, which at ~3K tokens a request is about 66; Gemini's free
// tier gives as little as 20 a day per model (Gemini counts only when it is
// switched on, see aiModels.js). Change these if a key gets a
// paid plan. Cerebras gives 1M tokens a day per model: ~200 requests.
const FREE_PER_DAY = { cerebras: 200, groq: 66, gemini: 20 };

/** The day's shared capacity of every model the app tries, all providers together. */
const poolEstimate = () => CEREBRAS_MODELS.length * FREE_PER_DAY.cerebras
  + GROQ_MODELS.length * FREE_PER_DAY.groq + GEMINI_MODELS.length * FREE_PER_DAY.gemini;

const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Never fails the answer over the log. */
async function logAiUse(db, line) {
  try {
    await db.collection("aiLog").add({
      uid: line.uid || "",
      email: clip(line.email, 120),
      name: clip(line.name, 80),
      feature: clip(line.feature, 40),
      what: clip(line.what, 300),
      where: clip(line.where, 120),
      provider: line.provider || null,
      model: line.model || null,
      status: line.status || "ok",
      ...(line.error ? { error: clip(line.error, 200) } : {}),
      ms: Number(line.ms) || 0,
      used: Number(line.used) || 0,
      limit: Number(line.limit) || 0,
      pool: poolEstimate(),
      day: new Date().toISOString().slice(0, 10),
      at: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error("[aiLog] could not write:", e.message);
  }
}

/** Runs `fn(use)` and logs it with what `use` gathered, however it ends. */
async function withAiLog(db, base, fn) {
  const use = { ...base, status: "ok" };
  const started = Date.now();
  try {
    const out = await fn(use);
    if (out?.cached) use.status = "cached";
    use.provider = use.provider || out?.provider || null;
    use.model = use.model || out?.model || null;
    return out;
  } catch (e) {
    if (use.status === "ok") use.status = e?.code === "resource-exhausted" && use.limitHit ? "limit" : "error";
    use.error = e?.message;
    throw e;
  } finally {
    if (use.uid) await logAiUse(db, { ...use, ms: Date.now() - started });
  }
}

module.exports = { logAiUse, withAiLog, poolEstimate, FREE_PER_DAY };
