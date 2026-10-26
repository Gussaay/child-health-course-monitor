// functions/aiLog.js
//
// One record per use of the app's AI features (the "Ask the data" assistant
// and the AI library's tasks), for the super users' AI activity page:
// aiLog/{auto id}
//   { uid, email, name, feature, what, where, provider, model, status
//     ("ok" | "error" | "limit" | "cached"), error, ms, used, limit, pool,
//     day (YYYY-MM-DD, UTC, the day the daily limits count), at, vote? }
// The record's id goes back with the answer (`logId`), so the person can rate
// it 👍 (1) / 👎 (-1) with the aiVote callable.
// `used` / `limit` are the person's count for that feature after this use and
// their daily limit there; `pool` is the free tiers' estimated daily capacity
// shared by everyone (poolEstimate). Written by the functions alone.

const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GEMINI_MODELS, GROQ_MODELS } = require("./aiModels");

// Free-tier requests a day per model. Groq gives GPT-OSS 1,000 requests but
// 200K tokens a day, which at ~3K tokens a request is about 66; Gemini's free
// tier gives as little as 20 a day per model. Change these if a key gets a
// paid plan.
const FREE_PER_DAY = { groq: 66, gemini: 20 };

/** The day's shared capacity of every model the app tries, both providers together. */
const poolEstimate = () => GROQ_MODELS.length * FREE_PER_DAY.groq + GEMINI_MODELS.length * FREE_PER_DAY.gemini;

const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Never fails the answer over the log. */
async function logAiUse(db, line) {
  try {
    await (line.logId ? db.collection("aiLog").doc(line.logId) : db.collection("aiLog").doc()).set({
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
  const use = { ...base, status: "ok", logId: db.collection("aiLog").doc().id };
  const started = Date.now();
  try {
    const out = await fn(use);
    if (out?.cached) use.status = "cached";
    use.provider = use.provider || out?.provider || null;
    use.model = use.model || out?.model || null;
    return out && typeof out === "object" && use.uid ? { ...out, logId: use.logId } : out;
  } catch (e) {
    if (use.status === "ok") use.status = e?.code === "resource-exhausted" && use.limitHit ? "limit" : "error";
    use.error = e?.message;
    throw e;
  } finally {
    if (use.uid) await logAiUse(db, { ...use, ms: Date.now() - started });
  }
}

/** 👍 / 👎 on one of the caller's own answers. */
const aiVote = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const id = String(request.data?.logId || "");
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) throw new HttpsError("invalid-argument", "Nothing to rate.");
  const vote = Number(request.data?.vote) === 1 ? 1 : Number(request.data?.vote) === -1 ? -1 : 0;
  const ref = getFirestore().collection("aiLog").doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data().uid !== request.auth.uid) {
    throw new HttpsError("permission-denied", "You can only rate your own answers.");
  }
  await ref.update({ vote: vote || FieldValue.delete() });
  return { vote };
});

module.exports = { logAiUse, withAiLog, poolEstimate, FREE_PER_DAY, aiVote };
