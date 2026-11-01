// src/utils/askDataAssistant.js
//
// Opens "Ask the data" with a question already asked, from anywhere in the app
// (App.jsx listens for the event and passes the question to the panel).
export const ASK_DATA_EVENT = 'nchp:ask-data';

export function askDataAssistant(question) {
    const text = String(question || '').trim();
    if (!text) return;
    window.dispatchEvent(new CustomEvent(ASK_DATA_EVENT, { detail: { question: text } }));
}
