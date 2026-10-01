// functions/claudeEndpoints.js
//
// The two ways Claude reaches programme data. Both go through claudeAccess.js,
// so there is one place where "may this person read this?" is decided:
//
//   claudeQuery  — callable, for the chat panel inside the app. The caller is
//                  already signed in, so Firebase verifies them for us.
//   claudeMcp    — HTTP, for the MCP server the team connects from claude.ai.
//                  The caller sends a Firebase ID token, which is verified here
//                  before anything is read.
//
// Neither writes to a data collection.

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { uidForAccessToken } = require("./claudeOAuth");

const {
  accessFor, catalogueFor, runQuery, runSummary, MAX_ROWS,
} = require("./claudeAccess");

// ============================================================================
// The tools, described once
// ============================================================================
//
// The same list is handed to the MCP client and used to validate a call from
// the chat panel, so the two cannot drift into offering different things.

const TOOLS = [
  {
    name: "list_data",
    description:
      "List the programme data this user is allowed to read, with what each collection holds. "
      + "Call this first: what is available depends on who is asking.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "query_data",
    description:
      "Read rows from one collection. Prefer summarise_data for counts — this returns whole "
      + "records, which for some collections means names and clinical details.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string", description: "A collection from list_data." },
        filters: {
          type: "array",
          description: "Field filters, e.g. [{field:'state', op:'==', value:'Khartoum'}].",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              op: { type: "string", enum: ["==", "!=", "<", "<=", ">", ">=", "array-contains", "in"] },
              value: {},
            },
            required: ["field", "value"],
          },
        },
        orderBy: { type: "string", description: "Field to sort by, descending." },
        limit: { type: "number", description: `Rows to return, at most ${MAX_ROWS}.` },
      },
      required: ["collection"],
    },
  },
  {
    name: "summarise_data",
    description:
      "Count records grouped by one field — how many courses per state, how many "
      + "classifications of each kind. Answers most questions without moving names anywhere.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        groupBy: { type: "string", description: "The field to group by." },
        filters: { type: "array", items: { type: "object" } },
      },
      required: ["collection", "groupBy"],
    },
  },
];

/** Runs one named tool for a caller who has already been identified. */
async function runTool(access, name, args = {}) {
  switch (name) {
    case "list_data":
      return { collections: catalogueFor(access), yourRoles: access.roles };
    case "query_data":
      return runQuery(access, args);
    case "summarise_data":
      return runSummary(access, args);
    default: {
      const err = new Error(`Unknown tool "${name}".`);
      err.code = "invalid-argument";
      throw err;
    }
  }
}

const asHttpsError = (e) => new HttpsError(
  e.code === "unauthenticated" ? "unauthenticated"
    : e.code === "permission-denied" ? "permission-denied"
      : e.code === "invalid-argument" ? "invalid-argument"
        : "internal",
  e.message || "The request could not be completed.");

// ============================================================================
// In the app
// ============================================================================

exports.claudeQuery = onCall(async (request) => {
  try {
    const access = await accessFor(request.auth);
    const { tool, args } = request.data || {};
    if (tool === "__tools__") return { tools: TOOLS };
    return await runTool(access, tool, args || {});
  } catch (e) {
    throw asHttpsError(e);
  }
});

// ============================================================================
// From claude.ai
// ============================================================================
//
// Speaks MCP over HTTP. The bearer token is a Firebase ID token — the same one
// the app itself uses — so a team member is exactly as authorised here as they
// are when they sign in, and revoking their account revokes this with it.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function callerFromRequest(req) {
  const header = req.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) {
    const err = new Error("Sign in to the National Child Health Programme to use this connector.");
    err.code = "unauthenticated";
    throw err;
  }

  // An OAuth token issued by our own authorisation server — how claude.ai
  // connects. Tried first because it is the ordinary case.
  const granted = await uidForAccessToken(token);
  if (granted) return { uid: granted.uid, token: {} };

  // A Firebase ID token, which is how a local MCP client or a script connects.
  // Both end at the same place: a uid whose roles are resolved per read.
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid, token: decoded };
  } catch {
    const err = new Error("That access token is not valid or has expired.");
    err.code = "unauthenticated";
    throw err;
  }
}

const rpcResult = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

exports.claudeMcp = onRequest({ cors: false }, async (req, res) => {
  Object.entries(CORS).forEach(([k, v]) => res.set(k, v));
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  if (req.method !== "POST") { res.status(405).json(rpcError(null, -32600, "Use POST.")); return; }

  const body = req.body || {};
  const { id = null, method, params = {} } = body;

  try {
    // `initialize` and `tools/list` describe the server. They still require a
    // verified caller: which tools exist is not sensitive, but leaving any
    // method open invites probing for the ones that are.
    const caller = await callerFromRequest(req);

    if (method === "initialize") {
      res.json(rpcResult(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "national-child-health-programme", version: "1.0.0" },
      }));
      return;
    }

    if (method === "notifications/initialized") { res.status(204).send(""); return; }

    if (method === "tools/list") { res.json(rpcResult(id, { tools: TOOLS })); return; }

    if (method === "tools/call") {
      const access = await accessFor(caller);
      const out = await runTool(access, params.name, params.arguments || {});
      res.json(rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
      }));
      return;
    }

    res.json(rpcError(id, -32601, `Unknown method "${method}".`));
  } catch (e) {
    if (e.code === "unauthenticated") {
      // Tells the client where to authorise. Without this header a connector
      // has no way to discover the OAuth server and simply fails.
      // The app's own domain, where Hosting serves the discovery documents at
      // the root. A client that cannot find these simply fails to connect.
      res.set("WWW-Authenticate",
        'Bearer resource_metadata='
        + '"https://imnci-courses-monitor.web.app/.well-known/oauth-protected-resource"');
      res.status(401).json(rpcError(id, -32001, e.message));
      return;
    }
    const code = e.code === "unauthenticated" ? -32001
      : e.code === "permission-denied" ? -32002
        : e.code === "invalid-argument" ? -32602 : -32603;
    // The message is the caller's own refusal — "your account does not have
    // access to X" — which is what they need to see. Nothing about other
    // people's data is in it.
    res.json(rpcError(id, code, e.message || "The request failed."));
  }
});

module.exports.TOOLS = TOOLS;
module.exports.runTool = runTool;
