// functions/readMemory.js
//
// Read memory for the data assistant (aiAssistant.js). Firestore bills one read per record, and one answer may read up
// to 6,000. The same lookup (same list, filters and fields, for a caller with
// the same scope) is kept for 10 minutes in the instance's memory and shared by
// questions asked meanwhile, by anyone with that scope. A change made in those
// minutes shows up in the next lookup after them. Never shared across scopes:
// the key includes the caller's scope, so one state's records never reach
// another state's caller.
// -----------------------------------------------------------------------------
const READ_MEMORY_MS = 10 * 60 * 1000;
const READ_MEMORY_MAX = 40;
const readMemory = new Map(); // key -> { at, promise }

async function remembered(access, parts, run, now = Date.now()) {
  const key = JSON.stringify([access.manageScope || "", access.manageLocation || "", parts]);
  const hit = readMemory.get(key);
  if (hit && now - hit.at < READ_MEMORY_MS) return hit.promise;
  const promise = Promise.resolve().then(run);
  readMemory.set(key, { at: now, promise });
  promise.catch(() => { if (readMemory.get(key)?.promise === promise) readMemory.delete(key); });
  if (readMemory.size > READ_MEMORY_MAX) {
    const oldest = [...readMemory.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) readMemory.delete(oldest[0]);
  }
  return promise;
}
module.exports = { remembered, readMemory, READ_MEMORY_MS };
