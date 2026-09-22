import React from 'react';

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
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary]', error, info?.componentStack);
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        this.setState({ error: null });
        this.props.onGoHome?.();
    };

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-md text-center">
                    <h2 className="text-lg font-semibold text-gray-800">This screen could not be displayed</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Something went wrong while drawing this page. Anything you saved is still
                        stored on this device and will upload when you are back online.
                    </p>
                    <pre className="mt-4 max-h-32 overflow-auto rounded bg-gray-50 p-2 text-left text-xs text-gray-500">
                        {this.state.error?.message || String(this.state.error)}
                    </pre>
                    <div className="mt-5 flex justify-center gap-2">
                        <button
                            type="button"
                            onClick={this.handleReload}
                            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
                        >
                            Reload the app
                        </button>
                        {this.props.onGoHome && (
                            <button
                                type="button"
                                onClick={this.handleGoHome}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Go to home
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
