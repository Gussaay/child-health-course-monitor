// Turns an error into plain words for the error page: what happened and how
// to fix it. `kind` picks the explanation; `detail` is the part of the message
// worth showing (a package or file name). Text keys live under
// admin_pages.error_boundary.kinds.<kind> in i18n.js.

const MODULE_LOAD = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading (CSS )?chunk [\w-]+ failed|Unable to preload CSS/i;

export function explainError(error) {
    const message = String(error?.message || error || '');

    // Development only: Vite could not compile a file because it imports a
    // package that is not installed (npm install was not run after pulling).
    const missing = message.match(/Failed to resolve import ["']([^"']+)["'] from ["']([^"']+)["']/);
    if (missing) return { kind: 'missing_package', detail: missing[1], file: missing[2] };

    // A file that does not compile (syntax error) in development.
    if (/\[plugin:vite[^\]]*\]|Transform failed|Unexpected token|SyntaxError/i.test(message)) {
        return { kind: 'build_error', detail: null };
    }

    if (MODULE_LOAD.test(message)) {
        const url = message.match(/https?:\/\/\S+/)?.[0] || null;
        return { kind: 'module_load', detail: null, url };
    }

    if (/permission-denied|Missing or insufficient permissions/i.test(message)) {
        return { kind: 'permission', detail: null };
    }

    if (/network|Failed to fetch|offline|unavailable|timed? ?out/i.test(message)) {
        return { kind: 'network', detail: null };
    }

    return { kind: 'bug', detail: null };
}

// In development a module that fails to load returns Vite's compile error as
// the response body, which names the real cause (for example a missing
// package). The browser only reports "Failed to fetch dynamically imported
// module", so ask the dev server for the reason. Returns null when there is
// nothing more to learn.
export async function devLoadFailureReason(url, fetchImpl = globalThis.fetch) {
    if (!url || !fetchImpl) return null;
    try {
        const response = await fetchImpl(url, { cache: 'no-store' });
        if (response.ok) return null;
        const text = await response.text();
        // Vite answers with a small error page holding `const error = {...}`.
        const embedded = text.match(/const error = (\{.*\})\s*$/m)?.[1];
        for (const candidate of [embedded, text]) {
            if (!candidate) continue;
            try {
                const body = JSON.parse(candidate);
                if (body?.message) return String(body.message).slice(0, 2000);
            } catch { /* not JSON; try the next form */ }
        }
        return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000) || null;
    } catch {
        return null;
    }
}
