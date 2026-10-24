// functions/aiAssistant.js
//
// The data assistant: the "Ask the data" panel on every page of the app.
// The person asks a question; the model answers from the page they have open
// and from what its tools read out of the app's own database, and from
// nothing else (the rules are in aiDataText.js).
//
// It reads AS THE PERSON ASKING, through the same permission-checked layer the
// claude.ai connector uses (claudeAccess.js): a locality manager reaches only
// their locality, and a collection their role cannot open is refused. It never
// writes to programme data; it writes only its usage counter and audit record.
//
// Providers, both on free tiers and both already used by the AI Library:
//   Gemini Flash  first: a long context, so whole tool results and the page fit
//   Groq GPT-OSS  backup, with smaller results (its free tier is 8K tokens a minute)
// When one fails part-way, the next starts again with the reads already made,
// so nothing is read twice. Uses the GROQ_API_KEY and GEMINI_API_KEY secrets
// that aiBooks already needs; nothing new to set.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { FieldPath, FieldValue } = require("firebase-admin/firestore");

const { accessFor, catalogueFor, scopedQuery, audit } = require("./claudeAccess");
const {
  TOOLS, systemFor, rowsWithin, describeFields, groupRows, cleanFilters,
} = require("./aiDataText");

const GROQ_API_KEY = defineSecret("GROQ_API_KEY");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ["gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-2.5-flash-lite"];
const GROQ_MODELS = process.env.GROQ_MODEL
  ? [process.env.GROQ_MODEL]
  : ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const MAX_STEPS = 7;          // model calls per question
const MAX_HISTORY = 10;       // earlier turns kept
const COUNT_ROWS = 6000;      // records count_data reads at most
const SAMPLE_ROWS = 30;       // records describe_fields looks at
const QUERY_ROWS = 50;
// Questions per person per day, so one account cannot use up the free quota.
const DAILY_LIMIT = { staff: 60, other: 20 };
const STAFF_ROLES = [
  "super_user", "federal_manager", "states_manager", "locality_manager",
  "federal_coordinator", "state_coordinator", "course_coordinator", "facilitator", "mentor",
];

// How much each provider is given: Groq's per-minute allowance counts the
// whole conversation, so it sees less of the page and of each result.
const SIZES = {
  gemini: { result: 30000, page: 9000 },
  groq: { result: 5000, page: 3000 },
};

const clip = (s, n) => String(s ?? "").slice(0, n);
const cleanKey = (secret) => String(secret.value() || "").replace(/[\s"']/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const notDeleted = (r) => r.isDeleted !== true && r.isDeleted !== "true";

// =============================================================================
// Tools
// =============================================================================

/** A field name as Firestore's select() needs it: dotted paths as given, others literal. */
const fieldPath = (name) => (/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(name) ? name : new FieldPath(name));

function explainReadError(e) {
  const msg = String(e?.message || e);
  if (e?.code === 9 || /index/i.test(msg)) {
    return "This combination of filters needs a database index the app does not have. Use fewer filters, or count grouped by one of the fields instead.";
  }
  return clip(msg, 300) || "That could not be read.";
}

async function countData(access, args) {
  const filters = cleanFilters(args.filters);
  const groupBy = clip(args.groupBy, 120).trim();
  const valueField = clip(args.valueField, 120).trim();
  const bucket = ["year", "month"].includes(args.bucket) ? args.bucket : "";
  const { q } = scopedQuery(access, args.collection, filters);

  // One overall count needs no records: Firestore counts on the server.
  if (!groupBy && !valueField) {
    try {
      const [all, deleted] = await Promise.all([
        q.count().get(),
        q.where("isDeleted", "in", [true, "true"]).count().get(),
      ]);
      return { collection: args.collection, filters, total: all.data().count - deleted.data().count };
    } catch (e) {
      logger.info(`[aiAssistant] count() fell back to reading: ${e.message}`);
    }
  }

  const wanted = [...new Set([groupBy, valueField, "isDeleted"].filter(Boolean))];
  const snap = await q.select(...wanted.map(fieldPath)).limit(COUNT_ROWS).get();
  const rows = snap.docs.map((d) => d.data()).filter(notDeleted);
  const groups = groupRows(rows, { groupBy, bucket, valueField });
  return {
    collection: args.collection,
    filters,
    ...(groupBy ? { groupBy } : {}),
    ...(bucket ? { bucket } : {}),
    ...(valueField ? { valueField } : {}),
    counted: rows.length,
    truncated: snap.size >= COUNT_ROWS,
    groups: groups.slice(0, 80),
    ...(groups.length > 80 ? { groupsNotShown: groups.length - 80 } : {}),
  };
}

async function queryData(access, args, budget) {
  const filters = cleanFilters(args.filters);
  const limit = Math.max(1, Math.min(Number(args.limit) || 20, QUERY_ROWS));
  const { spec, q: base } = scopedQuery(access, args.collection, filters);
  let q = base;
  if (args.orderBy && typeof args.orderBy === "string") q = q.orderBy(fieldPath(args.orderBy), "desc");
  // Deleted records are dropped after reading, so a few extra are read.
  const snap = await q.limit(limit + 10).get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(notDeleted).slice(0, limit);
  const pick = Array.isArray(args.fields) ? args.fields.map(String).slice(0, 30) : null;
  const shown = rowsWithin(rows, budget, pick);
  return {
    collection: args.collection,
    filters,
    returned: shown.rows.length,
    ...(shown.notShown ? { notShownForSize: shown.notShown } : {}),
    mayHaveMore: snap.size >= limit + 10,
    containsPersonalData: !!spec.personal,
    rows: shown.rows,
  };
}

async function describe(access, args) {
  const { spec, q } = scopedQuery(access, args.collection, []);
  const snap = await q.limit(SAMPLE_ROWS).get();
  const rows = snap.docs.map((d) => d.data()).filter(notDeleted);
  return { collection: args.collection, ...describeFields(rows, { personal: !!spec.personal }) };
}

/** Runs one tool call; a refusal or a failed read comes back as text for the model. */
async function runTool(access, name, args, budget) {
  try {
    switch (name) {
      case "list_data": return { collections: catalogueFor(access) };
      case "describe_fields": return await describe(access, args);
      case "count_data": return await countData(access, args);
      case "query_data": return await queryData(access, args, budget);
      default: return { error: `Unknown tool "${name}".` };
    }
  } catch (e) {
    return { error: explainReadError(e) };
  }
}

// =============================================================================
// Providers
// =============================================================================
//
// Both take the same turn list and the same tools, and return either
// { text } or { error }. Tool results are cached by call, so a provider that
// takes over part-way reuses what was already read.

class ProviderError extends Error {}

async function post(url, headers, body, label) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return j;
    const quick = [429, 500, 502, 503].includes(r.status);
    if (attempt < 1 && quick) { await sleep(2000); continue; }
    throw new ProviderError(`${label} ${r.status}: ${clip(j?.error?.message, 200)}`);
  }
}

function geminiTools() {
  return [{
    functionDeclarations: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      ...(Object.keys(t.parameters.properties || {}).length ? { parameters: t.parameters } : {}),
    })),
  }];
}

async function askGemini({ key, model, system, history, question, call }) {
  const contents = [
    ...history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    { role: "user", parts: [{ text: question }] },
  ];
  for (let step = 0; step < MAX_STEPS; step++) {
    const j = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      { "Content-Type": "application/json", "x-goog-api-key": key },
      {
        systemInstruction: { parts: [{ text: system }] },
        contents,
        tools: geminiTools(),
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      },
      `Gemini ${model}`);
    const content = j?.candidates?.[0]?.content;
    const parts = content?.parts || [];
    const calls = parts.filter((p) => p.functionCall);
    if (!calls.length) {
      const text = parts.filter((p) => !p.thought).map((p) => p.text || "").join("").trim();
      if (!text) throw new ProviderError(`Gemini ${model}: no answer (${j?.candidates?.[0]?.finishReason || "empty"})`);
      return { text, model: j.modelVersion || model };
    }
    // The model's turn goes back exactly as it came (Gemini checks its own
    // signatures on it), followed by the results.
    contents.push({ role: "model", parts });
    const responses = [];
    for (const p of calls) {
      const out = await call(p.functionCall.name, p.functionCall.args || {}, SIZES.gemini.result);
      responses.push({ functionResponse: { name: p.functionCall.name, ...(p.functionCall.id ? { id: p.functionCall.id } : {}), response: { result: out } } });
    }
    contents.push({ role: "user", parts: responses });
  }
  return { text: "", tooManySteps: true, model };
}

async function askGroq({ key, model, system, history, question, call }) {
  const messages = [
    { role: "system", content: system },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];
  const tools = TOOLS.map((t) => ({ type: "function", function: t }));
  for (let step = 0; step < MAX_STEPS; step++) {
    const j = await post(GROQ_URL, { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, {
      model, messages, tools, tool_choice: "auto", temperature: 0.1,
      max_completion_tokens: 1500, reasoning_effort: "low", include_reasoning: false,
    }, `Groq ${model}`);
    const msg = j?.choices?.[0]?.message || {};
    const calls = msg.tool_calls || [];
    if (!calls.length) {
      const text = String(msg.content || "").trim();
      if (!text) throw new ProviderError(`Groq ${model}: empty reply`);
      return { text, model };
    }
    messages.push({ role: "assistant", content: msg.content || "", tool_calls: calls });
    for (const c of calls) {
      let args = {};
      try { args = JSON.parse(c.function?.arguments || "{}"); } catch { args = {}; }
      const out = await call(c.function?.name, args, SIZES.groq.result);
      messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(out).slice(0, SIZES.groq.result + 500) });
    }
  }
  return { text: "", tooManySteps: true, model };
}

/** The providers to try, in order, from the keys that are set. */
function engines() {
  const gemini = cleanKey(GEMINI_API_KEY);
  const groq = cleanKey(GROQ_API_KEY);
  const list = [];
  if (gemini) GEMINI_MODELS.forEach((model) => list.push({ provider: "gemini", model, key: gemini, run: askGemini }));
  if (groq) GROQ_MODELS.forEach((model) => list.push({ provider: "groq", model, key: groq, run: askGroq }));
  if (process.env.AI_ASSISTANT_GROQ_FIRST === "1") list.sort((a, b) => (a.provider === "groq" ? -1 : 0) - (b.provider === "groq" ? -1 : 0));
  return list;
}

// =============================================================================
// Who may ask
// =============================================================================

async function countUse(db, uid, roles) {
  const limit = roles.some((r) => STAFF_ROLES.includes(String(r).toLowerCase())) ? DAILY_LIMIT.staff : DAILY_LIMIT.other;
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.collection("aiAssistantUsage").doc(uid);
  await db.runTransaction(async (tx) => {
    const cur = (await tx.get(ref)).data() || {};
    const used = cur.day === day ? cur.count || 0 : 0;
    if (used >= limit) {
      throw new HttpsError("resource-exhausted", `You have asked today's ${limit} questions. Try again tomorrow.`);
    }
    tx.set(ref, { day, count: used + 1, lastAt: FieldValue.serverTimestamp() });
  });
}

// =============================================================================
// The callable
// =============================================================================

exports.aiAssistant = onCall(
  { secrets: [GROQ_API_KEY, GEMINI_API_KEY], timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    const access = await accessFor(request.auth).catch((e) => {
      throw new HttpsError("unauthenticated", e.message);
    });
    const lang = request.data?.lang === "ar" ? "ar" : "en";

    if (catalogueFor(access).length === 0) {
      return {
        reply: lang === "ar"
          ? "حسابك لا يملك بعد صلاحية الاطلاع على أي من بيانات البرنامج، لذلك لا يوجد ما أقرأه. اطلب من المسؤول منحك الصلاحيات المطلوبة."
          : "Your account does not have access to any programme data yet, so there is nothing I can read. Ask a super user for the permissions you need.",
        sources: [],
      };
    }

    const question = clip(request.data?.question, 2000).trim();
    if (!question) throw new HttpsError("invalid-argument", "Ask a question.");
    const history = (Array.isArray(request.data?.messages) ? request.data.messages : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: clip(m.content, 4000) }));
    const page = request.data?.page && typeof request.data.page === "object" ? request.data.page : null;

    const list = engines();
    if (!list.length) throw new HttpsError("failed-precondition", "No AI key is set on the server (GEMINI_API_KEY or GROQ_API_KEY).");

    await countUse(access.db, access.uid, access.roles);

    // Each distinct read is made once, whichever provider asks for it.
    const reads = new Map();
    const call = async (name, args, budget) => {
      const id = `${name}:${JSON.stringify(args)}:${budget}`;
      if (!reads.has(id)) reads.set(id, { name, args, out: await runTool(access, name, args, budget) });
      return reads.get(id).out;
    };

    let answer = null;
    const failures = [];
    for (const e of list) {
      try {
        const system = systemFor({ page, lang, pageChars: SIZES[e.provider].page });
        answer = { ...(await e.run({ key: e.key, model: e.model, system, history, question, call })), provider: e.provider };
        break;
      } catch (err) {
        failures.push(err.message);
        logger.warn(`[aiAssistant] ${err.message}`);
        if (!(err instanceof ProviderError)) break;
      }
    }

    const sources = [...new Set([...reads.values()].map((r) => r.args?.collection).filter(Boolean))];
    await audit(access, "assistant", {
      question: clip(question, 300),
      view: clip(page?.view, 60),
      reads: [...reads.values()].map((r) => ({ tool: r.name, collection: r.args?.collection || null })).slice(0, 20),
      provider: answer?.provider || null,
      model: answer?.model || null,
    });

    if (!answer) {
      throw new HttpsError("unavailable", "The assistant is busy or out of today's free quota. Try again in a minute.",
        { failures: failures.slice(0, 4) });
    }
    if (answer.tooManySteps) {
      return {
        reply: lang === "ar"
          ? "احتاج هذا السؤال خطوات أكثر مما يُسمح لي به. جرّب أن تسأل عن شيء واحد في كل مرة."
          : "That question needed more steps than I am allowed. Try asking for one thing at a time.",
        provider: answer.provider, model: answer.model, sources,
      };
    }
    return { reply: answer.text, provider: answer.provider, model: answer.model, sources, usedPage: !!page?.text };
  });

// For the tests.
exports._internal = { runTool, countData, queryData, describe, engines, askGemini, askGroq };
