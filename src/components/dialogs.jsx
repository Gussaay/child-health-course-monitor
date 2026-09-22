// src/components/dialogs.jsx
//
// Replaces the browser's alert() and confirm() with in-app UI.
//
// Native dialogs block the JavaScript thread, cannot be styled or translated,
// and inside the Capacitor WebView they render as an OS dialog labelled with
// the package name — so the least trustworthy-looking dialog in the app was the
// one guarding data loss.
//
// Both functions are callable from anywhere, including non-React code such as
// data.js. If <DialogHost /> has not mounted yet they fall back to the native
// dialogs, so nothing is ever silently swallowed.
//
//   import { notify, confirmDialog } from './dialogs';
//
//   notify('Participant saved.', 'success');            // fire and forget
//   if (!(await confirmDialog('Delete this course?'))) return;
//
import React, { useCallback, useEffect, useRef, useState } from 'react';

// --- tiny external store, so module functions can reach the mounted host ---

let host = null;
const setHost = (fns) => { host = fns; };

/**
 * Shows a toast. Direct replacement for alert() — it does not block, so the
 * code after it keeps running.
 * @param {string} message
 * @param {'info'|'success'|'error'} [type]
 */
export function notify(message, type = 'info') {
    const text = String(message ?? '');
    if (!text) return;
    if (host) host.pushToast(text, type);
    else window.alert(text); // eslint-disable-line no-alert -- last-resort fallback before DialogHost mounts
}

/**
 * Asks the user to confirm. Replacement for confirm() — it returns a promise,
 * so callers must await it.
 * @param {string} message
 * @param {{title?: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean}} [options]
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, options = {}) {
    const text = String(message ?? '');
    // eslint-disable-next-line no-alert -- last-resort fallback before DialogHost mounts
    if (!host) return Promise.resolve(window.confirm(text));
    return host.pushConfirm(text, options);
}

/**
 * Asks the user for one value. Replacement for prompt() — it returns a promise.
 * @param {string} message
 * @param {{defaultValue?: string, inputType?: string, title?: string, confirmLabel?: string}} [options]
 * @returns {Promise<string|null>} the value, or null if the user cancelled
 */
export function promptDialog(message, options = {}) {
    const text = String(message ?? '');
    // eslint-disable-next-line no-alert -- last-resort fallback before DialogHost mounts
    if (!host) return Promise.resolve(window.prompt(text, options.defaultValue ?? ''));
    return host.pushPrompt(text, options);
}

// --- the host component ---

let nextId = 1;

function Toast({ toast, onDismiss }) {
    useEffect(() => {
        const timer = setTimeout(onDismiss, toast.type === 'error' ? 8000 : 4500);
        return () => clearTimeout(timer);
    }, [toast, onDismiss]);

    const tone =
        toast.type === 'success' ? 'bg-green-600' :
        toast.type === 'error' ? 'bg-red-600' : 'bg-sky-700';

    return (
        <div
            role="status"
            aria-live="polite"
            className={`${tone} pointer-events-auto flex items-start gap-3 rounded-md px-4 py-3 text-white shadow-lg`}
        >
            <span className="flex-1 whitespace-pre-line text-sm">{toast.message}</span>
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="shrink-0 text-white/80 hover:text-white"
            >
                &times;
            </button>
        </div>
    );
}

function ConfirmDialog({ request, onAnswer }) {
    const dialogRef = useRef(null);
    const confirmRef = useRef(null);

    useEffect(() => {
        const node = dialogRef.current;
        if (!node) return undefined;
        if (!node.open) node.showModal();
        confirmRef.current?.focus();

        // <dialog> fires cancel on Escape; treat it as "no".
        const onCancel = (event) => { event.preventDefault(); onAnswer(false); };
        node.addEventListener('cancel', onCancel);
        return () => node.removeEventListener('cancel', onCancel);
    }, [onAnswer]);

    const {
        title = 'Please confirm',
        confirmLabel = 'Confirm',
        cancelLabel = 'Cancel',
        danger = false,
    } = request.options;

    return (
        <dialog
            ref={dialogRef}
            className="max-w-md rounded-lg border border-gray-200 p-0 shadow-xl backdrop:bg-black/50"
            aria-labelledby={`confirm-title-${request.id}`}
        >
            <div className="p-5">
                <h2 id={`confirm-title-${request.id}`} className="text-base font-semibold text-gray-900">
                    {title}
                </h2>
                <p className="mt-2 whitespace-pre-line text-sm text-gray-600">{request.message}</p>
                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => onAnswer(false)}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        ref={confirmRef}
                        onClick={() => onAnswer(true)}
                        className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                            danger ? 'bg-red-600 hover:bg-red-700' : 'bg-sky-600 hover:bg-sky-700'
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </dialog>
    );
}

function PromptDialog({ request, onAnswer }) {
    const dialogRef = useRef(null);
    const inputRef = useRef(null);
    const [value, setValue] = useState(request.options.defaultValue ?? '');

    useEffect(() => {
        const node = dialogRef.current;
        if (!node) return undefined;
        if (!node.open) node.showModal();
        inputRef.current?.focus();
        inputRef.current?.select?.();

        const onCancel = (event) => { event.preventDefault(); onAnswer(null); };
        node.addEventListener('cancel', onCancel);
        return () => node.removeEventListener('cancel', onCancel);
    }, [onAnswer]);

    const {
        title = 'Enter a value',
        inputType = 'text',
        confirmLabel = 'OK',
        cancelLabel = 'Cancel',
    } = request.options;

    const submit = (event) => {
        event.preventDefault();
        onAnswer(value);
    };

    return (
        <dialog
            ref={dialogRef}
            className="max-w-md rounded-lg border border-gray-200 p-0 shadow-xl backdrop:bg-black/50"
            aria-labelledby={`prompt-title-${request.id}`}
        >
            <form onSubmit={submit} className="p-5">
                <h2 id={`prompt-title-${request.id}`} className="text-base font-semibold text-gray-900">
                    {title}
                </h2>
                <label htmlFor={`prompt-input-${request.id}`} className="mt-2 block text-sm text-gray-600">
                    {request.message}
                </label>
                <input
                    id={`prompt-input-${request.id}`}
                    ref={inputRef}
                    type={inputType}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    className="mt-2 w-full rounded-md border border-gray-300 p-2 text-base focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
                />
                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => onAnswer(null)}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="submit"
                        className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </form>
        </dialog>
    );
}

/** Mount once, near the root of the app. */
export function DialogHost() {
    const [toasts, setToasts] = useState([]);
    const [confirms, setConfirms] = useState([]);
    const [prompts, setPrompts] = useState([]);

    const pushToast = useCallback((message, type) => {
        setToasts((current) => [...current, { id: nextId++, message, type }]);
    }, []);

    const pushConfirm = useCallback((message, options) => new Promise((resolve) => {
        setConfirms((current) => [...current, { id: nextId++, message, options, resolve }]);
    }), []);

    const pushPrompt = useCallback((message, options) => new Promise((resolve) => {
        setPrompts((current) => [...current, { id: nextId++, message, options, resolve }]);
    }), []);

    useEffect(() => {
        setHost({ pushToast, pushConfirm, pushPrompt });
        return () => setHost(null);
    }, [pushToast, pushConfirm, pushPrompt]);

    const dismissToast = useCallback((id) => {
        setToasts((current) => current.filter((t) => t.id !== id));
    }, []);

    const answer = useCallback((id, value) => {
        setConfirms((current) => {
            const match = current.find((c) => c.id === id);
            match?.resolve(value);
            return current.filter((c) => c.id !== id);
        });
    }, []);

    const answerPrompt = useCallback((id, value) => {
        setPrompts((current) => {
            const match = current.find((p) => p.id === id);
            match?.resolve(value);
            return current.filter((p) => p.id !== id);
        });
    }, []);

    return (
        <>
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4">
                {toasts.map((toast) => (
                    <Toast key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
                ))}
            </div>
            {confirms.map((request) => (
                <ConfirmDialog
                    key={request.id}
                    request={request}
                    onAnswer={(value) => answer(request.id, value)}
                />
            ))}
            {prompts.map((request) => (
                <PromptDialog
                    key={request.id}
                    request={request}
                    onAnswer={(value) => answerPrompt(request.id, value)}
                />
            ))}
        </>
    );
}

export default DialogHost;
