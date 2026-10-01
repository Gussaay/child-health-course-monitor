import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { isAllowedRedirect, verifyPkce, hash } from '../functions/claudePolicy.js';

// =============================================================================
// The three pieces of the OAuth flow where a bug is a vulnerability rather than
// a defect: where a code may be sent, whether the client proves it started the
// flow, and whether a leaked database read hands somebody a working token.
// =============================================================================

describe('where an authorisation code may be sent', () => {
    it('allows claude.ai and claude.com', () => {
        expect(isAllowedRedirect('https://claude.ai/api/mcp/auth_callback')).toBe(true);
        expect(isAllowedRedirect('https://claude.com/api/mcp/auth_callback')).toBe(true);
    });

    it('allows their subdomains', () => {
        expect(isAllowedRedirect('https://www.claude.ai/cb')).toBe(true);
    });

    it('refuses anywhere else', () => {
        // An open redirect here hands somebody else's authorisation code to
        // whoever asked for it.
        expect(isAllowedRedirect('https://evil.example/cb')).toBe(false);
        expect(isAllowedRedirect('https://attacker.test/claude.ai')).toBe(false);
    });

    it('is not fooled by a lookalike host', () => {
        expect(isAllowedRedirect('https://claude.ai.evil.test/cb')).toBe(false);
        expect(isAllowedRedirect('https://notclaude.ai/cb')).toBe(false);
        expect(isAllowedRedirect('https://claude.aievil.com/cb')).toBe(false);
    });

    it('refuses anything that is not https', () => {
        expect(isAllowedRedirect('http://claude.ai/cb')).toBe(false);
        expect(isAllowedRedirect('javascript:alert(1)')).toBe(false);
        expect(isAllowedRedirect('')).toBe(false);
        expect(isAllowedRedirect(null)).toBe(false);
    });
});

describe('PKCE', () => {
    const verifier = 'a-verifier-of-reasonable-length-1234567890';
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

    it('accepts the verifier that produced the challenge', () => {
        expect(verifyPkce(verifier, challenge)).toBe(true);
    });

    it('rejects any other verifier', () => {
        // Without this, a stolen authorisation code is enough on its own.
        expect(verifyPkce('something-else-entirely-0987654321', challenge)).toBe(false);
        expect(verifyPkce(`${verifier}x`, challenge)).toBe(false);
    });

    it('rejects an empty or missing verifier', () => {
        expect(verifyPkce('', challenge)).toBe(false);
        expect(verifyPkce(undefined, challenge)).toBe(false);
    });

    it('does not crash on a malformed challenge', () => {
        expect(verifyPkce(verifier, '')).toBe(false);
        expect(verifyPkce(verifier, 'not-a-real-challenge')).toBe(false);
    });
});

describe('tokens at rest', () => {
    it('stores a hash, never the token', () => {
        const token = 'an-access-token';
        const stored = hash(token);
        expect(stored).not.toContain(token);
        expect(stored).toHaveLength(64);
    });

    it('is stable, so a token can be looked up', () => {
        expect(hash('same')).toBe(hash('same'));
    });

    it('separates two tokens that differ by one character', () => {
        expect(hash('token-a')).not.toBe(hash('token-b'));
    });
});
