import React from 'react';
import i18n from 'i18next';
import { explainError, devLoadFailureReason } from '../utils/explainError';

/**
 * Catches render errors so one broken screen does not blank the whole app.
 *
 * Without this, a throw inside any of the lazy-loaded views unmounts the tree
 * to a white page. On the web a refresh recovers; inside the Android WebView
 * there is no address bar and no obvious way back, so the app looks dead.
 *
 * The message deliberately says that unsynced work is still on the device:
 * Firestore keeps queued writes in IndexedDB, and a user who force-reinstalls
 * in a panic loses them.
 */
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            error: null,
            reportId: null,
            explained: null,  // { kind, detail, file, url } from explainError
            reason: null,     // dev only: the real compile error behind a failed module load
            report: 'idle',   // idle | sending | sent | failed
            reportError: null,
            note: '',
            noteState: 'idle', // idle | sending | sent | failed
            copied: false,
            at: null,
        };
    }

    static getDerivedStateFromError(error) {
        return { error, explained: explainError(error), at: new Date() };
    }

    async componentDidCatch(error, info) {
        console.error('[ErrorBoundary]', error, info?.componentStack);
        this.componentStack = info?.componentStack || '';

        // In development a failed module load hides the real cause; the dev
        // server still has it, so ask before explaining or reporting.
        const first = explainError(error);
        if (import.meta.env.DEV && first.kind === 'module_load' && first.url) {
            const reason = await devLoadFailureReason(first.url);
            if (reason) this.setState({ reason, explained: explainError(new Error(reason)) });
        }
        // Recorded so the team sees a crash without waiting for somebody to
        // describe it.
        this.sendReport();
    }

    reportPayload(extra = {}) {
        const { error, explained, reason } = this.state;
        return {
            kind: 'crash',
            what: String(reason || error?.message || error || 'Unknown error').slice(0, 300),
            errorKind: explained?.kind || null,
            stack: `${reason ? `${reason}\n--- browser error ---\n` : ''}${error?.message || ''}\n${error?.stack || ''}\n--- component stack ---${this.componentStack || ''}`.slice(0, 4000),
            screen: this.props.screen || null,
            appVersion: window.__APP_VERSION__ || null,
            userAgent: navigator.userAgent?.slice(0, 300) || null,
            online: navigator.onLine,
            language: document.documentElement.lang || null,
            ...extra,
        };
    }

    // Imported here rather than at the top of the file: this module has to
    // be able to render even when the app's data layer is what is broken.
    // A write made offline only settles once the device reconnects, so give
    // up after a while and say so rather than showing "Sending…" forever.
    async submit(extra) {
        const { submitProblemReport, currentUserEmail } = await import('../data');
        const send = submitProblemReport(this.reportPayload({ reporterEmail: currentUserEmail(), ...extra }));
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(i18n.t('admin_pages.error_boundary.no_connection', 'no connection'))), 15000);
        });
        try {
            return await Promise.race([send, timeout]);
        } finally {
            clearTimeout(timer);
        }
    }

    sendReport = async () => {
        this.setState({ report: 'sending', reportError: null });
        try {
            const reportId = await this.submit();
            this.setState({ report: 'sent', reportId: reportId || null });
        } catch (e) {
            this.setState({ report: 'failed', reportError: e?.message || String(e) });
        }
    };

    sendNote = async () => {
        const note = this.state.note.trim();
        if (!note) return;
        this.setState({ noteState: 'sending' });
        try {
            await this.submit({ note });
            this.setState({ noteState: 'sent' });
        } catch {
            this.setState({ noteState: 'failed' });
        }
    };

    detailsText() {
        const { error, reason, at } = this.state;
        return [
            reason ? `Cause: ${reason}` : null,
            `Error: ${error?.message || String(error)}`,
            `Screen: ${this.props.screen || '-'}`,
            `App version: ${window.__APP_VERSION__ || '-'}`,
            `Report: ${this.state.reportId || '-'}`,
            `Time: ${at ? at.toISOString() : '-'}`,
        ].filter(Boolean).join('\n');
    }

    copyDetails = async () => {
        try {
            await navigator.clipboard.writeText(this.detailsText());
            this.setState({ copied: true });
        } catch { /* clipboard blocked; the text is still on screen to select */ }
    };

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        this.setState({ error: null, explained: null, reason: null, report: 'idle', note: '', noteState: 'idle', copied: false });
        this.props.onGoHome?.();
    };

    render() {
        if (!this.state.error) return this.props.children;
        const t = (key, fallback, opts) => i18n.t(`admin_pages.error_boundary.${key}`, fallback, opts);
        const { explained, report, reportError, reportId, note, noteState, copied } = this.state;
        // Developer explanations (missing package, broken file) and the raw
        // error only show while developing. People using the app get plain
        // words and a short reference to quote.
        const dev = import.meta.env.DEV;
        let kind = KINDS[explained?.kind] ? explained.kind : 'bug';
        if (!dev && KINDS[kind].devOnly) kind = 'bug';
        const copy = KINDS[kind];
        // Isolated so a package or file name keeps its order inside Arabic text.
        const ltr = (v) => (v ? `⁨${v}⁩` : '');
        const vars = { package: ltr(explained?.detail), file: ltr(explained?.file) };
        const steps = copy.steps.map((step, i) => t(`kinds.${kind}.step${i + 1}`, step, vars));
        const reference = reportId ? reportId.slice(0, 6).toUpperCase() : null;

        return (
            <div className="flex min-h-[60vh] items-start sm:items-center justify-center p-4 sm:p-6">
                <div role="alert" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                    <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600" aria-hidden="true">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-lg font-semibold text-slate-800">{t(`kinds.${kind}.title`, copy.title, vars)}</h2>
                            <p className="mt-1 text-sm text-slate-600">{t(`kinds.${kind}.what`, copy.what, vars)}</p>
                        </div>
                    </div>

                    <h3 className="mt-5 text-sm font-semibold text-slate-800">{t('how_to_fix', 'What you can do')}</h3>
                    <ol className="mt-2 space-y-1.5 text-sm text-slate-700 list-decimal ps-5">
                        {steps.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>

                    <div className="mt-5 flex flex-wrap gap-2">
                        <button type="button" onClick={this.handleReload} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
                            {t('reload', 'Reload the app')}
                        </button>
                        {this.props.onGoHome && (
                            <button type="button" onClick={this.handleGoHome} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                {t('go_home', 'Go to home')}
                            </button>
                        )}
                    </div>

                    <section className="mt-5 rounded-xl bg-slate-50 p-3 text-sm" aria-live="polite">
                        {report === 'sent' && (
                            <p className="text-slate-700">
                                {t('report_sent', 'The team has been told about this problem.')}
                                {reference && <> {t('reference', 'Reference: {{code}}', { code: reference })}</>}
                            </p>
                        )}
                        {(report === 'sending' || report === 'idle') && <p className="text-slate-600">{t('report_sending', 'Letting the team know…')}</p>}
                        {report === 'failed' && (
                            <>
                                <p className="text-slate-700">{t('report_failed', 'We could not tell the team yet, probably because there is no internet connection.')}</p>
                                {dev && reportError && <p className="mt-1 text-xs text-slate-500" dir="ltr">{reportError}</p>}
                                <button type="button" onClick={this.sendReport} className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100">
                                    {t('report_retry', 'Try again')}
                                </button>
                            </>
                        )}
                        {noteState === 'sent' ? (
                            <p className="mt-3 text-slate-700">{t('note_sent', 'Thank you, we got your message.')}</p>
                        ) : (
                            <>
                                <label htmlFor="error-note" className="mt-3 block font-medium text-slate-700">{t('note_label', 'Want to tell us what you were doing? (optional)')}</label>
                                <textarea
                                    id="error-note"
                                    rows={2}
                                    value={note}
                                    onChange={(e) => this.setState({ note: e.target.value })}
                                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
                                />
                                <button type="button" disabled={!note.trim() || noteState === 'sending'} onClick={this.sendNote} className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                                    {noteState === 'sending' ? t('note_sending', 'Sending…') : t('note_send', 'Send')}
                                </button>
                                {noteState === 'failed' && <p className="mt-1 text-slate-700">{t('note_failed', 'Your message could not be sent. Try again when you are online.')}</p>}
                            </>
                        )}
                    </section>

                    {dev && (
                        <details className="mt-4 text-sm">
                            <summary className="cursor-pointer font-semibold text-slate-700">{t('details', 'Technical details (shown while developing only)')}</summary>
                            <pre dir="ltr" className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-2 text-start text-xs text-slate-600">{this.detailsText()}</pre>
                            <button type="button" onClick={this.copyDetails} className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">
                                {copied ? t('copied', 'Copied') : t('copy', 'Copy details')}
                            </button>
                        </details>
                    )}
                </div>
            </div>
        );
    }
}

// English text for each kind of error; Arabic is in i18n.js under
// admin_pages.error_boundary.kinds. Steps are in the order to try them.
const KINDS = {
    // Developer kinds: only possible while running `npm run dev`.
    missing_package: {
        devOnly: true,
        title: 'A package the app needs is not installed',
        what: 'The app uses the package {{package}} (in {{file}}), but it is not installed on this computer. This happens when new code is pulled and npm install has not been run since.',
        steps: [
            'In the terminal running the app, stop it with Ctrl + C.',
            'Run npm install in the app folder.',
            'Start the app again with npm run dev, then reload this page.',
        ],
    },
    build_error: {
        devOnly: true,
        title: 'A file in the app has an error',
        what: 'One of the code files could not be built, so this screen could not load. The exact message is in the technical details below and in the terminal running the app.',
        steps: [
            'Read the message in the technical details below.',
            'Fix the file it names and save it.',
            'Reload this page.',
        ],
    },
    module_load: {
        title: 'This page did not finish loading',
        what: 'Your internet may have dropped, or the app was just updated.',
        steps: [
            'Check that you are connected to the internet.',
            'Tap Reload the app.',
        ],
    },
    network: {
        title: 'No internet connection',
        what: 'This page needs the internet to show its information. Your saved work is safe on this device.',
        steps: [
            'Check that you are connected to the internet.',
            'Tap Reload the app.',
        ],
    },
    permission: {
        title: 'You do not have access to this page',
        what: 'Your account is not allowed to see this information.',
        steps: [
            'Ask your administrator to give you access.',
            'Then sign out and sign in again.',
        ],
    },
    bug: {
        title: 'Something went wrong on this page',
        what: 'This is a problem in the app, not something you did. Your saved work is safe.',
        steps: [
            'Tap Reload the app.',
            'If it happens again, tap Go to home and open the page again.',
        ],
    },
};

export default ErrorBoundary;

/**
 * For small optional pieces of the page frame (a header button): if one fails
 * to load or render, it is left out rather than taking the whole app down.
 * Errors outside the main view's ErrorBoundary unmount everything, which is a
 * white screen.
 */
export class QuietBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error) {
        console.warn('[QuietBoundary] left out a failed part of the page:', error?.message || error);
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}
