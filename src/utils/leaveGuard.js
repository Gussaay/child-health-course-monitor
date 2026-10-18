// Forms that live only in memory (a facility form, a plan editor, ...) lose
// what was typed when the user leaves them. A form calls useLeaveGuard while
// it is open; App.jsx then marks it changed on the first keystroke and asks
// before the menus, back buttons or closing the tab take the user away.
// The form's own Cancel/Back runs through leaveForm so it asks the same way.
import { useEffect } from 'react';

let openForms = 0;
const listeners = new Set();
let confirmer = null;

export function isFormGuarded() {
    return openForms > 0;
}

// App.jsx listens so it can forget the "changed" mark when a form opens or closes.
export function onGuardChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function changed() {
    listeners.forEach((listener) => listener());
}

export function useLeaveGuard(active = true) {
    useEffect(() => {
        if (!active) return undefined;
        openForms += 1;
        changed();
        return () => {
            openForms -= 1;
            changed();
        };
    }, [active]);
}

// After a save that keeps the form open (e.g. "Save draft"), so leaving
// afterwards is not asked about.
export function formSaved() {
    changed();
}

// App.jsx registers its "Leave without saving?" question here.
export function setLeaveConfirmer(fn) {
    confirmer = fn;
}

// Runs `leave` once the user agrees (straight away when nothing was typed).
export function leaveForm(leave) {
    if (!confirmer) { leave(); return; }
    confirmer().then((ok) => { if (ok) leave(); });
}
