// src/utils/keepLateAnswer.js

// Waits up to `timeoutMs` for `promise`. On a timeout the caller gets the error
// as before, but the request keeps going and its answer is still handed to
// `onLate` when it arrives. Firestore bills a query when the server sends it,
// whether or not the app waits for it; throwing the answer away meant the next
// app open asked (and paid) for the same full download again, for ever on a
// phone whose connection is always that slow.
export const keepLateAnswer = async (promise, timeoutMs, onLate, label = '') => {
    let timedOut = false;
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => { timedOut = true; reject(new Error(`Request timed out after ${timeoutMs}ms`)); }, timeoutMs);
    });
    promise.then(
        (late) => { if (timedOut) Promise.resolve(onLate(late)).catch((e) => console.warn(`[sync] late answer for ${label} not saved:`, e)); },
        () => { /* the caller already has the timeout error */ },
    );
    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timer);
    }
};
