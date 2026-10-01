// functions/claudeChat.js
//
// The chat panel inside the app. The person asks a question, Claude reads what
// it needs through the same permission-checked layer the MCP server uses, and
// answers.
//
// The API key lives here and never reaches the browser. Set it once with:
//   firebase functions:secrets:set ANTHROPIC_API_KEY

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const { accessFor, catalogueFor } = require("./claudeAccess");
const { TOOLS, runTool } = require("./claudeEndpoints");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

const MODEL = "claude-opus-5";
const MAX_STEPS = 8;          // tool calls before it must answer
const MAX_HISTORY = 20;       // turns kept from the conversation

const SYSTEM = `You are helping the staff of Sudan's National Child Health Programme
read and analyse their own monitoring data.

What you can see is limited to what this person can already see in the app. If a
tool refuses, say so plainly and name the access they would need — do not guess
at the answer or work around it.

How to work:
- Call list_data first. What exists depends on who is asking.
- Prefer summarise_data. Most programme questions are counts, and a summary
  answers them without moving anyone's personal details anywhere.
- Use query_data when the detail is genuinely needed, with the smallest limit
  that answers the question.

Some collections hold personal or clinical records of named children. When you
read those, report patterns and counts. Do not list children individually
unless the person has asked for exactly that and it is clearly their job.

Answer in the language the question was asked in — Arabic or English. Give the
numbers you actually retrieved, say what they are counted over, and say so
plainly when the data does not answer the question rather than filling the gap.`;

async function callAnthropic(apiKey, body) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[claudeChat] Anthropic returned", res.status, detail.slice(0, 500));
    // The upstream body can echo the request; only the status goes to the user.
    throw new HttpsError("internal", `The assistant is unavailable (${res.status}).`);
  }
  return res.json();
}

exports.claudeChat = onCall({ secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 120 }, async (request) => {
  const access = await accessFor(request.auth).catch((e) => {
    throw new HttpsError("unauthenticated", e.message);
  });

  const catalogue = catalogueFor(access);
  if (catalogue.length === 0) {
    return {
      reply: "Your account does not yet have access to any programme data, so there is nothing I can look at. Ask a super user to grant the permissions you need.",
      usedTools: [],
    };
  }

  const history = Array.isArray(request.data?.messages) ? request.data.messages.slice(-MAX_HISTORY) : [];
  const question = String(request.data?.question || "").trim();
  if (!question) throw new HttpsError("invalid-argument", "Ask a question.");

  const messages = [
    ...history
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];

  const usedTools = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const reply = await callAnthropic(ANTHROPIC_API_KEY.value(), {
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      tools: TOOLS.map((t) => ({
        name: t.name, description: t.description, input_schema: t.inputSchema,
      })),
      messages,
    });

    messages.push({ role: "assistant", content: reply.content });

    if (reply.stop_reason !== "tool_use") {
      const text = (reply.content || [])
        .filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      return { reply: text || "I could not produce an answer to that.", usedTools };
    }

    // Every tool call goes through the same gate as the MCP server, with this
    // person's own access. A refusal is handed back to the model as a result,
    // not thrown: it should tell the person what it could not read.
    const results = [];
    for (const block of reply.content.filter((b) => b.type === "tool_use")) {
      usedTools.push({ name: block.name, input: block.input });
      try {
        const out = await runTool(access, block.name, block.input || {});
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(out).slice(0, 180000),
        });
      } catch (e) {
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          is_error: true,
          content: e.message || "That could not be read.",
        });
      }
    }
    messages.push({ role: "user", content: results });
  }

  return {
    reply: "That question needed more steps than I am allowed to take. Try asking for one thing at a time.",
    usedTools,
  };
});
