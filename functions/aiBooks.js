// functions/aiBooks.js
//
// The AI side of Online Courses: summaries of, and questions about, the
// course books (IMNCI chart booklet, EENC and ETAT manuals and so on) and the
// sections of each course.
//
// A course author adds a PDF in the app. The browser reads its text page by page and
// stores it in Firestore (aiBooks/{id} with its chapters, the page text in
// aiBooks/{id}/pages). Nothing here touches the PDF itself: this function
// reads the stored page text for the chapter or page range asked about and
// hands it to the AI with the page numbers marked, so every answer can say
// which page it came from.
//
// Free tiers only, as in Easy Pedia:
//   Groq (GPT-OSS)  first when the text is short. Its free tier takes about
//                   8,000 tokens a minute, prompt included, so ~18,000
//                   characters of book is the most it can be given.
//   Gemini Flash    for anything longer (it reads a whole manual at once) and
//                   as the backup when Groq is out of quota.
//
// One-time setup:
//   firebase functions:secrets:set GROQ_API_KEY     (console.groq.com/keys)
//   firebase functions:secrets:set GEMINI_API_KEY   (aistudio.google.com/apikey)
// Both must be set before this is exported from index.js: a declared secret
// that is missing fails the whole functions deploy.
//
// Tasks (`task` plus its fields):
//   summary         bookId, from, to, style, lang, sectionTitle   saved under aiBooks/{id}/summaries
//   ask             question, messages?, lang, and one of: bookId (+ from, to),
//                   sectionId, courseId (all its books) or service (all its books)
//   tidySection     number, title, text   (course authors) the AI book import:
//                   one section's raw PDF text rewritten as clean reading text.
//                   Nothing is saved; the author compares it with the standard
//                   converter and decides what goes into the course.
//   sectionSummary  sectionId, style, lang, fresh?   one course section, kept in
//                   aiSectionNotes so every learner after the first gets it free
//
// A section converted from a module book (it carries bookFromPage) is read
// from that book's pages when the book is in the library and marked as the
// module's book, so answers cite them; any other section is read from its
// Read tab. Nothing here writes to a course or its sections.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// Choosing pages is kept apart from the plumbing so it can be tested without
// the Cloud Functions runtime installed.
const { pageRange, rankPages, bestPages } = require("./aiBooksText");

const GROQ_API_KEY = defineSecret("GROQ_API_KEY");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// Models in order, and how long one request may take: see aiModels.js.
const { GEMINI_MODELS, GROQ_MODELS, REQUEST_MS } = require("./aiModels");
const { withAiLog } = require("./aiLog");
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const GROQ_CHARS = 18000;     // book text Groq's 8K tokens a minute leaves room for
const GEMINI_CHARS = 600000;  // ~150K tokens: a whole manual, well inside Flash's window
const ASK_CHARS = 80000;      // a question is answered from the best pages, not the whole service
// Requests per person per day, so one account cannot use up the free quota.
// Learners who only signed up get fewer than programme staff.
// Course authors get the most: converting one module book takes a request
// per section.
const DAILY_LIMIT = { editor: 300, staff: 60, learner: 20 };
const EDITOR_ROLES = ["super_user", "federal_manager"]; // isSubCourseEditor() in firestore.rules

// Same allowlist as staffRoles() in firestore.rules. Anyone signed in may use
// the AI (Online Courses are open to every learner); staff get a larger
// daily allowance.
const STAFF_ROLES = [
  "super_user", "federal_manager", "states_manager", "locality_manager",
  "federal_coordinator", "facilitator", "state_coordinator", "course_coordinator", "mentor",
];

const STYLES = {
  summary:
    "Write a clear, well-organised summary of this part of the book for health workers and " +
    "programme staff. Start with one or two sentences on what it covers, then the main content " +
    "under short headings with bullet points. Keep every dose, age cut-off, sign and threshold " +
    "exactly as the book gives it.",
  key_points:
    "List the key points and practical steps a health worker must remember from this part, as " +
    "a short checklist. Keep doses, age cut-offs, danger signs and thresholds exactly as written.",
  teaching:
    "Write teaching notes for a facilitator who will teach this part in a course: learning " +
    "objectives, the key messages, points participants often get wrong, and one short practice " +
    "case with its answer.",
  quiz:
    "Write 8 multiple-choice questions (options A-D) that test the important content of this " +
    "part, each followed by the correct answer and a one-line reason with its page.",
};

const SYSTEM =
  "You work with the staff of Sudan's National Child Health Programme. You are given text taken " +
  "from one of the programme's own books, with each page marked as [p. N]. Use only that text. " +
  "When something is not in it, say so plainly instead of filling the gap from general knowledge. " +
  "Cite the page after each point as (p. N), or (Book title, p. N) when there is more than one " +
  "book. Use plain text with simple markdown only: headings as ## or **bold**, and \"- \" bullets. " +
  "Never use tables or LaTeX.";

const LANG = {
  en: "Write in English.",
  ar: "Write in clear Modern Standard Arabic. Keep drug names, doses and units in their usual Latin form.",
};

const clip = (s, n) => String(s ?? "").slice(0, n);

// =============================================================================
// Who may ask
// =============================================================================

async function caller(db, auth) {
  if (!auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const snap = await db.collection("users").doc(auth.uid).get();
  const profile = snap.exists ? snap.data() : {};
  const roles = (Array.isArray(profile.roles) && profile.roles.length ? profile.roles : [profile.role])
    .filter(Boolean).map((r) => String(r).toLowerCase());
  return {
    uid: auth.uid,
    profile,
    staff: roles.some((r) => STAFF_ROLES.includes(r)),
    editor: roles.some((r) => EDITOR_ROLES.includes(r)),
  };
}

// Counted before the call, so a failing request still counts: that is what
// stops a loop of retries from draining the shared free quota.
// The count and limit go on `who.use` for the AI activity log (aiLog.js).
async function countUse(db, who) {
  const limit = who.editor ? DAILY_LIMIT.editor : who.staff ? DAILY_LIMIT.staff : DAILY_LIMIT.learner;
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.collection("aiUsage").doc(who.uid);
  const use = who.use || {};
  use.limit = limit;
  await db.runTransaction(async (tx) => {
    const cur = (await tx.get(ref)).data() || {};
    const used = cur.day === day ? cur.count || 0 : 0;
    use.used = used;
    if (used >= limit) {
      use.limitHit = true;
      throw new HttpsError("resource-exhausted", `You have used today's ${limit} AI requests. Try again tomorrow.`);
    }
    tx.set(ref, { day, count: used + 1, lastAt: FieldValue.serverTimestamp() });
    use.used = used + 1;
  });
}

// =============================================================================
// Book text
// =============================================================================

// Page text rarely changes, so it is kept between requests and re-read only
// when the book's updatedAt moves.
const cache = new Map(); // id -> { stamp, book, pages: string[] (index 0 = page 1) }

async function loadBook(db, id) {
  const snap = await db.collection("aiBooks").doc(String(id)).get();
  if (!snap.exists || snap.data().isDeleted) throw new HttpsError("not-found", "That book is no longer in the library.");
  const book = { id: snap.id, ...snap.data() };
  const stamp = book.updatedAt?.toMillis?.() || 0;
  const hit = cache.get(book.id);
  if (hit && hit.stamp === stamp) return hit;

  const parts = await snap.ref.collection("pages").get();
  const pages = [];
  parts.docs.forEach((d) => {
    const { from, pages: texts } = d.data();
    (texts || []).forEach((t, i) => { pages[from - 1 + i] = t || ""; });
  });
  const entry = { stamp, book, pages };
  cache.set(book.id, entry);
  return entry;
}

/** [{ book, page, text }] for pages a..b with any text on them. */
const pagesOf = (entry, a, b) => {
  const out = [];
  for (let p = a; p <= b; p++) {
    const text = entry.pages[p - 1];
    if (text && text.trim()) out.push({ title: entry.book.title, page: p, text });
  }
  return out;
};

// A section's own text has no page numbers; it is marked by its title.
const render = (pages, withTitle) =>
  pages.map((p) => (p.page
    ? `[${withTitle ? `${p.title}, ` : ""}p. ${p.page}]\n${p.text}`
    : `[${p.title}]\n${p.text}`)).join("\n\n");

// =============================================================================
// Course sections
// =============================================================================

const stripHtml = (s) => String(s || "")
  .replace(/<\/(p|div|li|h\d|tr)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n")
  .replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

/** The text of a section's Read tab (older sections keep it in `blocks`). */
function sectionText(sec) {
  return (sec.read || sec.blocks || []).map((b) => {
    if (b.type === "list") return (b.items || []).map((i) => `- ${stripHtml(i)}`).join("\n");
    if (b.type === "heading") return `## ${stripHtml(b.text)}`;
    if (b.type === "table") {
      return (b.rows || []).map((r) => (Array.isArray(r) ? r : r.cells || [r.text || ""])
        .map((c) => stripHtml(typeof c === "object" ? c.text : c)).join(" | ")).join("\n");
    }
    return stripHtml(b.text);
  }).filter(Boolean).join("\n\n");
}

/** { sec, title, pages, stamp } for a course section, from its book when it has one. */
async function sectionSource(db, sectionId) {
  const snap = await db.collection("onlineCourseItems").doc(String(sectionId)).get();
  const sec = snap.exists ? snap.data() : null;
  if (!sec || sec.isDeleted || sec.kind !== "section") throw new HttpsError("not-found", "That section is no longer in the course.");
  const title = clip(sec.title, 200) || "Section";
  let pages = [];
  let bookStamp = 0;
  // A section converted from a module book knows its book pages. When a book
  // in the library is marked as that module's book, those pages are read
  // instead, so answers can cite them. The section itself is never changed.
  let bookId = sec.aiBookId || "";
  if (!bookId && sec.bookFromPage && sec.moduleId) {
    const list = await db.collection("aiBooks").where("moduleId", "==", sec.moduleId).get();
    bookId = list.docs.find((d) => !d.data().isDeleted)?.id || "";
  }
  if (bookId && sec.bookFromPage) {
    try {
      const entry = await loadBook(db, bookId);
      const [a, b] = pageRange(entry, sec.bookFromPage, sec.bookToPage || sec.bookFromPage);
      pages = pagesOf(entry, a, b);
      bookStamp = pages.length ? `${bookId}:${entry.stamp}` : 0;
    } catch (e) {
      logger.warn(`[aiBooks] section ${sectionId}: book ${bookId} unavailable, using the section text (${e.message})`);
    }
  }
  if (!pages.length) {
    const text = sectionText(sec);
    if (text) pages = [{ title, page: null, text }];
  }
  if (!pages.length) throw new HttpsError("failed-precondition", "This section has no text to read yet.");
  const stamp = `${sec.lastUpdatedAt?.toMillis?.() || 0}-${bookStamp}`;
  return { sec, title, pages, stamp };
}

const sizeOf = (pages) => pages.reduce((n, p) => n + p.text.length + 12, 0);

// =============================================================================
// Providers
// =============================================================================

const cleanKey = (secret) => String(secret.value() || "").replace(/[\s"']/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function groq(key, messages, maxTokens) {
  let last = "";
  for (const model of GROQ_MODELS) {
    for (let attempt = 0; ; attempt++) {
      const r = await fetch(GROQ_URL, {
        signal: AbortSignal.timeout(REQUEST_MS),
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model, messages, temperature: 0.3, max_completion_tokens: maxTokens,
          reasoning_effort: "low", include_reasoning: false,
        }),
      }).catch((e) => ({ failed: e }));
      if (r.failed) {
        last = `${model}: ${r.failed.name === "TimeoutError" ? "no reply in time" : clip(r.failed.message, 120)}`;
        logger.warn(`[aiBooks] Groq ${last}`);
        break;
      }
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        const text = String(j?.choices?.[0]?.message?.content || "").trim();
        if (text) return { text, model, provider: "groq", truncated: j?.choices?.[0]?.finish_reason === "length" };
        last = `${model} returned an empty reply`;
        break;
      }
      const wait = parseFloat(r.headers.get("retry-after")) || 0;
      if (attempt < 1 && ((r.status === 429 && wait <= 10) || [500, 502, 503].includes(r.status))) {
        await sleep(Math.min(Math.max(wait * 1000, 1500), 10000));
        continue;
      }
      last = `${model} ${r.status}: ${clip(j?.error?.message, 200)}`;
      logger.warn(`[aiBooks] Groq ${last}`);
      if (r.status === 401 || r.status === 403) return { error: last };
      break;
    }
  }
  return { error: last };
}

const thinkingFor = (model) => (/2\.5/.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: "low" });
const retryAfter = (j) => parseFloat((j?.error?.details || []).find((d) => d.retryDelay)?.retryDelay) || 0;

async function gemini(key, system, user, maxTokens) {
  let last = "";
  for (const model of GEMINI_MODELS) {
    let thinking = true;
    for (let attempt = 0; ; attempt++) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        signal: AbortSignal.timeout(REQUEST_MS * 3),
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.3, maxOutputTokens: maxTokens,
            ...(thinking ? { thinkingConfig: thinkingFor(model) } : {}),
          },
        }),
      }).catch((e) => ({ failed: e }));
      if (r.failed) {
        last = `${model}: ${r.failed.name === "TimeoutError" ? "no reply in time" : clip(r.failed.message, 120)}`;
        logger.warn(`[aiBooks] Gemini ${last}`);
        break;
      }
      const j = await r.json().catch(() => ({}));
      if (r.status === 400 && thinking && /thinking/i.test(j?.error?.message || "")) { thinking = false; continue; }
      if (r.ok) {
        const cand = j?.candidates?.[0];
        const text = (cand?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("").trim();
        if (text) return { text, model: j.modelVersion || model, provider: "gemini", truncated: cand?.finishReason === "MAX_TOKENS" };
        last = `${model}: no answer (${cand?.finishReason || j?.promptFeedback?.blockReason || "empty"})`;
        break;
      }
      const wait = r.status === 429 ? retryAfter(j) : 0;
      if (attempt < 1 && [429, 500, 503].includes(r.status) && wait <= 30) {
        await sleep(Math.min(Math.max(wait * 1000, 1500), 8000));
        continue;
      }
      last = `${model} ${r.status}: ${clip(j?.error?.message, 200)}`;
      logger.warn(`[aiBooks] Gemini ${last}`);
      if (r.status === 400 || r.status === 401) return { error: last };
      break;
    }
  }
  return { error: last };
}

/**
 * Tries Groq when the text fits it, Gemini otherwise, and the other one as
 * the backup. `make(limit)` builds the user message from at most `limit`
 * characters of book text, or returns null when the task cannot be done
 * honestly in that space (a summary of half a chapter is not a summary).
 */
async function complete({ system, make, size, maxTokens = 3072, groqChars = GROQ_CHARS, groqTokens = 2048 }) {
  const groqKey = cleanKey(GROQ_API_KEY);
  const geminiKey = cleanKey(GEMINI_API_KEY);
  if (!groqKey && !geminiKey) throw new HttpsError("failed-precondition", "No AI key is set on the server (GROQ_API_KEY or GEMINI_API_KEY).");

  const tries = [
    groqKey && { name: "groq", limit: groqChars, run: (u) => groq(groqKey, [{ role: "system", content: system }, { role: "user", content: u }], Math.min(maxTokens, groqTokens)) },
    geminiKey && { name: "gemini", limit: GEMINI_CHARS, run: (u) => gemini(geminiKey, system, u, maxTokens) },
  ].filter(Boolean);
  if (size > groqChars) tries.reverse(); // Gemini first when Groq cannot take it all

  const errors = [];
  for (const t of tries) {
    const user = make(t.limit);
    if (!user) continue;
    const out = await t.run(user);
    if (out.text) return out;
    errors.push(out.error);
  }
  if (!errors.length) throw new HttpsError("failed-precondition", "This part is too long for the AI that is set up. Pick a shorter chapter or page range.");
  if (errors.some((e) => / 429:/.test(e || ""))) {
    throw new HttpsError("resource-exhausted", "Today's free AI allowance is used up. Try again later or tomorrow.");
  }
  throw new HttpsError("unavailable", `The AI could not answer right now (${clip(errors.join("; "), 300)}).`);
}

// =============================================================================
// Tasks
// =============================================================================

async function summarise(db, data, who) {
  const { profile, uid } = who;
  const entry = await loadBook(db, data.bookId);
  const [a, b] = pageRange(entry, data.from, data.to);
  const pages = pagesOf(entry, a, b);
  if (!pages.length) {
    throw new HttpsError("failed-precondition", "These pages have no readable text (the PDF may be scanned images).");
  }
  const style = STYLES[data.style] ? data.style : "summary";
  const lang = data.lang === "ar" ? "ar" : "en";
  const section = clip(data.sectionTitle, 200) || `Pages ${a}-${b}`;
  const ask = (text) =>
    `Book: ${entry.book.title}\nPart: ${section} (pages ${a}-${b})\n\n${STYLES[style]}\n${LANG[lang]}\n\n--- BOOK TEXT ---\n${text}`;

  let out;
  const size = sizeOf(pages);
  if (size <= GEMINI_CHARS) {
    out = await complete({ system: SYSTEM, size, maxTokens: 4096, make: (limit) => (size <= limit ? ask(render(pages)) : null) });
  } else {
    // Longer than even Gemini takes at once: notes on each piece, then the
    // asked-for result from the notes.
    const pieces = [];
    let cur = [];
    let curSize = 0;
    for (const p of pages) {
      if (curSize + p.text.length > GEMINI_CHARS * 0.8 && cur.length) { pieces.push(cur); cur = []; curSize = 0; }
      cur.push(p); curSize += p.text.length + 12;
    }
    if (cur.length) pieces.push(cur);
    if (pieces.length > 4) throw new HttpsError("failed-precondition", "That range is too long to summarise at once. Pick a chapter.");
    const notes = [];
    for (const piece of pieces) {
      const n = await complete({
        system: SYSTEM, size: GEMINI_CHARS, maxTokens: 6000,
        make: (limit) => (limit >= GEMINI_CHARS ? `Make detailed notes of this text, keeping every page citation, dose and threshold.\n\n--- BOOK TEXT ---\n${render(piece)}` : null),
      });
      notes.push(n.text);
    }
    out = await complete({
      system: SYSTEM, size: GEMINI_CHARS, maxTokens: 4096,
      make: (limit) => (limit >= GEMINI_CHARS ? ask(`(Notes made from the book, with their page citations)\n\n${notes.join("\n\n")}`) : null),
    });
  }

  const saved = {
    bookId: entry.book.id, bookTitle: entry.book.title, service: entry.book.service || "",
    sectionTitle: section, from: a, to: b, style, lang,
    text: out.text, provider: out.provider, model: out.model,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: uid, createdByName: profile.name || profile.displayName || profile.email || "",
  };
  const ref = await db.collection("aiBooks").doc(entry.book.id).collection("summaries").add(saved);
  return { id: ref.id, text: out.text, provider: out.provider, model: out.model, from: a, to: b };
}

async function answer(db, data) {
  const question = clip(data.question, 2000).trim();
  if (!question) throw new HttpsError("invalid-argument", "Ask a question.");
  const lang = data.lang === "ar" ? "ar" : "en";

  let pages = [];
  let scope;
  let multi = false;
  if (data.sectionId) {
    const src = await sectionSource(db, data.sectionId);
    pages = src.pages;
    scope = `the course section "${src.title}"`;
  } else if (data.bookId) {
    const entry = await loadBook(db, data.bookId);
    const [a, b] = pageRange(entry, data.from, data.to);
    pages = pagesOf(entry, a, b);
    scope = `${entry.book.title}, pages ${a}-${b}`;
  } else if (data.courseId) {
    const list = await db.collection("aiBooks").where("courseId", "==", clip(data.courseId, 100)).get();
    const books = list.docs.filter((d) => !d.data().isDeleted);
    if (!books.length) throw new HttpsError("failed-precondition", "This course has no books yet.");
    for (const d of books) {
      const entry = await loadBook(db, d.id);
      pages.push(...pagesOf(entry, 1, entry.pages.length));
    }
    multi = books.length > 1;
    scope = "the books of this course";
  } else {
    const service = clip(data.service, 40);
    if (!service) throw new HttpsError("invalid-argument", "Choose a service or a book.");
    const list = await db.collection("aiBooks").where("service", "==", service).get();
    const books = list.docs.filter((d) => !d.data().isDeleted);
    if (!books.length) throw new HttpsError("failed-precondition", `There are no ${service} books in the library yet.`);
    for (const d of books) {
      const entry = await loadBook(db, d.id);
      pages.push(...pagesOf(entry, 1, entry.pages.length));
    }
    multi = books.length > 1;
    scope = `all ${service} books in the library`;
  }
  if (!pages.length) throw new HttpsError("failed-precondition", "There is no readable text to answer from.");

  const history = (Array.isArray(data.messages) ? data.messages : [])
    .slice(-6)
    .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
    .map((m) => `${m.role === "user" ? "Question" : "Answer"}: ${clip(m.content, 1500)}`)
    .join("\n\n");
  const query = [history.split("\n").filter((l) => l.startsWith("Question:")).slice(-1)[0] || "", question].join(" ");
  // The whole scope when it fits; otherwise the pages that best match.
  const total = sizeOf(pages);
  const ranked = total <= ASK_CHARS ? null : rankPages(pages, query);
  if (ranked && !ranked.length) {
    return { text: lang === "ar" ? "لم أجد ما يخص هذا السؤال في الكتب المختارة." : "I could not find anything about this in the chosen books.", provider: "", model: "", pagesUsed: [] };
  }

  let used = [];
  const make = (limit) => {
    const room = Math.min(limit, ASK_CHARS);
    used = total <= room ? pages : bestPages(ranked || rankPages(pages, query), room);
    if (!used.length) return null;
    return `Answering from: ${scope}.\n${LANG[lang]}\n` +
      (history ? `\nEarlier in this conversation:\n${history}\n` : "") +
      `\nQuestion: ${question}\n\nAnswer from the book text below. If it does not answer the question, say so.\n\n--- BOOK TEXT ---\n${render(used, multi)}`;
  };
  const out = await complete({ system: SYSTEM, size: Math.min(total, ASK_CHARS), maxTokens: 2048, make });
  return {
    text: out.text, provider: out.provider, model: out.model,
    pagesUsed: used.map((p) => ({ title: p.title, page: p.page })),
  };
}

/**
 * A summary, key points, teaching notes or quiz for one course section. The
 * result is kept per section, style and language, and handed to the next
 * learner who asks without calling the AI again, until the section or its
 * book changes. Course authors can ask for a fresh one.
 */
async function summariseSection(db, data, who) {
  const style = STYLES[data.style] ? data.style : "summary";
  const lang = data.lang === "ar" ? "ar" : "en";
  const src = await sectionSource(db, data.sectionId);
  const noteRef = db.collection("aiSectionNotes").doc(`${String(data.sectionId).replace(/\//g, "_")}__${style}__${lang}`);
  const cached = (await noteRef.get()).data();
  if (cached && cached.stamp === src.stamp && !(data.fresh && who.editor)) {
    return { text: cached.text, provider: cached.provider, model: cached.model, cached: true, fromBook: !!src.pages[0].page };
  }

  await countUse(db, who);
  const size = sizeOf(src.pages);
  if (size > GEMINI_CHARS) throw new HttpsError("failed-precondition", "This section is too long to summarise at once.");
  const fromBook = !!src.pages[0].page;
  const out = await complete({
    system: SYSTEM, size, maxTokens: 4096,
    make: (limit) => (size <= limit
      ? `Course section: ${src.title}${fromBook ? ` (book pages ${src.pages[0].page}-${src.pages[src.pages.length - 1].page})` : ""}\n\n` +
        `${STYLES[style]}${fromBook ? "" : " This text has no page numbers, so cite nothing."}\n${LANG[lang]}\n\n--- TEXT ---\n${render(src.pages)}`
      : null),
  });
  await noteRef.set({
    sectionId: String(data.sectionId), courseId: src.sec.courseId || "", style, lang, stamp: src.stamp,
    text: out.text, provider: out.provider, model: out.model,
    createdAt: FieldValue.serverTimestamp(), createdBy: who.uid,
  });
  return { text: out.text, provider: out.provider, model: out.model, cached: false, fromBook };
}

const TIDY =
  "You turn text extracted from a PDF training book into clean reading text for an online course. " +
  "Keep every fact, number, dose, age, sign, threshold and classification exactly as the book gives it, " +
  "in the book's own words and language. Do not add, explain, summarise or drop content. Remove page " +
  "headers, footers, page numbers and broken line breaks; join words split across lines. Restore the " +
  "structure: \"## \" for sub-headings inside the section, \"- \" for bullet points, \"1. \" for numbered " +
  "steps, **bold** where the book stresses a term. A table becomes a list, one row per bullet, cells " +
  "separated by \" | \". Output only the section's text, without its own title and without any comment.";

/** The AI book import: one section's extracted text, cleaned up. Saves nothing. */
async function tidySection(db, data, who) {
  if (!who.editor) throw new HttpsError("permission-denied", "Only course authors can import books.");
  const title = clip(`${data.number || ""} ${data.title || ""}`.trim(), 300);
  const text = clip(data.text, GEMINI_CHARS);
  if (!text.trim()) throw new HttpsError("invalid-argument", "This section has no text.");
  await countUse(db, who);
  const size = text.length;
  const out = await complete({
    // The reply is as long as the text, and Groq's 8K tokens a minute count
    // both, so Groq takes only short sections.
    system: TIDY, size, maxTokens: 8192, groqChars: 9000, groqTokens: 3600,
    make: (limit) => (size <= limit
      ? `Section: ${title}\nThe pages below may begin with the end of the previous section and end with the ` +
        `start of the next one. Keep only the text of this section: from its heading to the next numbered heading.\n\n` +
        `--- EXTRACTED TEXT ---\n${text}`
      : null),
  });
  return { text: out.text, provider: out.provider, model: out.model, truncated: !!out.truncated };
}

/** One line on what was asked, for the AI activity log. */
function whatAsked(data) {
  if (data.task === "ask") return data.question;
  if (data.task === "sectionSummary") return `${data.style || "summary"} of ${data.sectionTitle || "a course section"}`;
  if (data.task === "tidySection") return `AI book import: ${`${data.number || ""} ${data.title || ""}`.trim()}`;
  if (data.task === "summary") return `Summary of pages ${data.from || "?"}-${data.to || "?"}`;
  return data.task;
}

exports.aiBooks = onCall(
  { secrets: [GROQ_API_KEY, GEMINI_API_KEY], timeoutSeconds: 300, memory: "1GiB", maxInstances: 3 },
  async (request) => {
    const db = getFirestore();
    const who = await caller(db, request.auth);
    const data = request.data || {};
    const base = {
      uid: who.uid,
      email: request.auth.token?.email || who.profile.email,
      name: who.profile.name || who.profile.displayName || request.auth.token?.name,
      feature: `library:${clip(data.task, 20)}`,
      what: whatAsked(data),
      where: data.sectionId ? `section ${data.sectionId}` : data.bookId ? `book ${data.bookId}` : data.courseId ? `course ${data.courseId}` : data.service || "",
    };
    return withAiLog(db, base, async (use) => {
      who.use = use;
      if (data.task === "sectionSummary") return summariseSection(db, data, who);
      if (data.task === "tidySection") return tidySection(db, data, who);
      if (!["summary", "ask"].includes(data.task)) throw new HttpsError("invalid-argument", "Unknown task.");
      await countUse(db, who);
      return data.task === "summary" ? summarise(db, data, who) : answer(db, data);
    });
  },
);
