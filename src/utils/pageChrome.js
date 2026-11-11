// Small shared stores that let a page put things into the app's own chrome
// (App.jsx), without passing props up through every view:
//  - the round "Add" button at the bottom corner of the screen, and
//  - the title of a full-page form, shown in the Android app's top bar.
// The newest registration wins, so a form opened over a list takes over.
import { useEffect, useRef, useSyncExternalStore } from 'react';

function createStack() {
    let stack = [];
    const listeners = new Set();
    const emit = () => listeners.forEach((l) => l());
    return {
        push(entry) {
            stack = [...stack, entry];
            emit();
            return () => { stack = stack.filter((e) => e !== entry); emit(); };
        },
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        top: () => stack[stack.length - 1] || null,
    };
}

const addStack = createStack();
const formTitleStack = createStack();

/**
 * Shows the app's floating "Add" button while `enabled`, running `onAdd` when
 * tapped. `label` names what it adds (e.g. "Add New Course").
 */
export function usePageAddButton(label, onAdd, enabled = true) {
    const ref = useRef(onAdd);
    ref.current = onAdd;
    useEffect(() => {
        if (!enabled || !label) return undefined;
        return addStack.push({ label, run: () => ref.current?.() });
    }, [label, enabled]);
}

export const usePageAddAction = () => useSyncExternalStore(addStack.subscribe, addStack.top, addStack.top);

/** Puts a full-page form's title and subtitle in the Android app's top bar. */
export function useFormTitle(title, subtitle, enabled = true) {
    useEffect(() => {
        if (!enabled || !title) return undefined;
        return formTitleStack.push({ title, subtitle: subtitle || '' });
    }, [title, subtitle, enabled]);
}

export const useFormTitleOverride = () => useSyncExternalStore(formTitleStack.subscribe, formTitleStack.top, formTitleStack.top);
