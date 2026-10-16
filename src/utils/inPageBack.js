// Back steps inside a page (a form opened from a list, a sub-menu, ...).
// In the Android app those pages hide their own Back buttons, so the top-bar
// arrow and the phone's back button run the newest step registered here
// before leaving the page.
const handlers = [];

export function addInPageBack(handler) {
    handlers.push(handler);
    return () => {
        const i = handlers.lastIndexOf(handler);
        if (i >= 0) handlers.splice(i, 1);
    };
}

// Runs the newest registered step; false when there is none.
// A step that itself calls the app's back runs that normally rather than
// looping back here.
let running = false;
export function runInPageBack() {
    const handler = handlers[handlers.length - 1];
    if (!handler || running) return false;
    running = true;
    try { handler(); } finally { running = false; }
    return true;
}
