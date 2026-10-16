// Turns Firebase sign-in errors into a short message key for the sign-in
// screen (translations under `auth.errors` in i18n.js), so people see
// "Wrong email or password" rather than "Firebase: Error (auth/...)".

const CODE_KEYS = {
    'auth/popup-closed-by-user': 'google_closed',
    'auth/cancelled-popup-request': 'google_closed',
    'auth/user-cancelled': 'google_closed',
    'auth/popup-blocked': 'popup_blocked',
    'auth/network-request-failed': 'network',
    'auth/internal-error': 'network',
    'auth/invalid-credential': 'wrong_password',
    'auth/invalid-login-credentials': 'wrong_password',
    'auth/wrong-password': 'wrong_password',
    'auth/user-not-found': 'no_account',
    'auth/invalid-email': 'invalid_email',
    'auth/missing-email': 'invalid_email',
    'auth/too-many-requests': 'too_many',
    'auth/user-disabled': 'disabled',
    'auth/email-already-in-use': 'email_in_use',
    'auth/weak-password': 'weak_password',
    'auth/credential-already-in-use': 'already_linked',
    'auth/account-exists-with-different-credential': 'other_method',
    'auth/unauthorized-domain': 'unauthorized_domain',
    'auth/operation-not-allowed': 'unauthorized_domain',
    'auth/requires-recent-login': 'recent_login',
};

/** The `auth.errors.*` key for an error; 'generic' when the code is unknown. */
export function authErrorKey(err) {
    const code = err?.code || (String(err?.message || '').match(/\(([a-z-]+\/[a-z0-9-]+)\)/) || [])[1];
    return CODE_KEYS[code] || 'generic';
}

/** The error code, shown in small print under a generic message to help support. */
export function authErrorCode(err) {
    return err?.code || (String(err?.message || '').match(/\(([a-z-]+\/[a-z0-9-]+)\)/) || [])[1] || '';
}
