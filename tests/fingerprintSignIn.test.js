// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const native = { on: true, plugin: true };
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => native.on,
    isPluginAvailable: (name) => native.plugin && name === 'NativeBiometric',
  },
}));

const store = {};
const NB = {
  isAvailable: vi.fn(async () => ({ isAvailable: true })),
  verifyIdentity: vi.fn(async () => {}),
  setCredentials: vi.fn(async ({ server, username, password }) => { store[server] = { username, password }; }),
  getCredentials: vi.fn(async ({ server }) => {
    if (!store[server]) throw new Error('No credentials found');
    return store[server];
  }),
  isCredentialsSaved: vi.fn(async ({ server }) => ({ isSaved: !!store[server] })),
  deleteCredentials: vi.fn(async ({ server }) => { delete store[server]; }),
};
vi.mock('@capgo/capacitor-native-biometric', () => ({ NativeBiometric: NB }));
vi.mock('../src/data', () => ({ submitProblemReport: vi.fn(async () => 'id') }));

const fp = await import('../src/utils/fingerprintSignIn.js');

const session = (uid = 'u1', refreshToken = 'r1') => ({
  uid, email: `${uid}@x.org`, stsTokenManager: { refreshToken, accessToken: 'a', expirationTime: 1 },
  apiKey: 'KEY', appName: '[DEFAULT]',
});
const fakeUser = (json, opts = {}) => ({
  uid: json.uid,
  email: json.email,
  displayName: 'Dr Test',
  getIdToken: opts.refused ? vi.fn(async () => { throw new Error('auth/user-token-expired'); }) : vi.fn(async () => 'tok'),
  toJSON: () => json,
});

describe('fingerprint sign-in', () => {
  let reload;
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    localStorage.clear();
    sessionStorage.clear();
    native.on = true; native.plugin = true;
    vi.clearAllMocks();
    NB.isAvailable.mockImplementation(async () => ({ isAvailable: true }));
    NB.verifyIdentity.mockImplementation(async () => {});
    reload = vi.fn();
    Object.defineProperty(window, 'location', { value: { reload }, configurable: true });
  });

  it('is saved automatically after sign-in, and signs back in after a fingerprint', async () => {
    await fp.rememberForFingerprint(fakeUser(session('a1', 'ra')));
    expect(await fp.savedFingerprintAccount()).toEqual({ uid: 'a1', email: 'a1@x.org', name: 'Dr Test' });

    expect(await fp.signInWithFingerprint({ title: 'T' })).toBe('ok');
    expect(NB.verifyIdentity).toHaveBeenCalled();
    const restored = JSON.parse(localStorage.getItem('firebase:authUser:KEY:[DEFAULT]'));
    expect(restored.uid).toBe('a1');
    expect(restored.stsTokenManager.refreshToken).toBe('ra');
    expect(localStorage.getItem('last_uid')).toBe('a1');
    expect(reload).toHaveBeenCalled();
  });

  it('does nothing without a fingerprint touch', async () => {
    await fp.rememberForFingerprint(fakeUser(session('c1', 'rc')));
    NB.verifyIdentity.mockRejectedValueOnce(new Error('cancel'));
    expect(await fp.signInWithFingerprint()).toBe('cancelled');
    expect(localStorage.getItem('firebase:authUser:KEY:[DEFAULT]')).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it('is skipped on phones without a fingerprint, on the web and on older APKs', async () => {
    NB.isAvailable.mockResolvedValue({ isAvailable: false });
    await fp.rememberForFingerprint(fakeUser(session('d1', 'rd')));
    expect(NB.setCredentials).not.toHaveBeenCalled();

    NB.isAvailable.mockResolvedValue({ isAvailable: true });
    native.on = false;
    await fp.rememberForFingerprint(fakeUser(session('d2', 'rd2')));
    native.on = true; native.plugin = false;
    await fp.rememberForFingerprint(fakeUser(session('d3', 'rd3')));
    expect(NB.setCredentials).not.toHaveBeenCalled();
    expect(await fp.savedFingerprintAccount()).toBeNull();
  });

  it('keeps the old copy when the session cannot be confirmed', async () => {
    await fp.rememberForFingerprint(fakeUser(session('e1', 're'), { refused: true }));
    expect(NB.setCredentials).not.toHaveBeenCalled();
  });

  it('drops the saved sign-in when the server refused it', async () => {
    await fp.rememberForFingerprint(fakeUser(session('f1', 'rf')));
    await fp.signInWithFingerprint();
    // Signed out again after the reload: the sign-in screen sees the flag.
    expect(await fp.takeFailedRestore()).toBe(true);
    expect(await fp.savedFingerprintAccount()).toBeNull();
    expect(await fp.takeFailedRestore()).toBe(false);
  });

  it('a confirmed session clears the flag, so nothing is dropped', async () => {
    await fp.rememberForFingerprint(fakeUser(session('g1', 'rg')));
    await fp.signInWithFingerprint();
    await fp.rememberForFingerprint(fakeUser(session('g1', 'rg')));
    expect(await fp.takeFailedRestore()).toBe(false);
    expect(await fp.savedFingerprintAccount()).not.toBeNull();
  });

  it('refuses a broken saved record', async () => {
    store['com.nchp.monitoring.app.fingerprint-signin'] = { username: '{"uid":"h1"}', password: '{"uid":"h1"}' };
    expect(await fp.signInWithFingerprint()).toBe('failed');
    expect(reload).not.toHaveBeenCalled();
  });

  it('"Use another account" forgets the saved sign-in', async () => {
    await fp.rememberForFingerprint(fakeUser(session('i1', 'ri')));
    await fp.forgetFingerprintAccount();
    expect(await fp.savedFingerprintAccount()).toBeNull();
  });

  it('keeps the sign-in in app storage when the key store refuses it', async () => {
    NB.setCredentials.mockRejectedValueOnce(new Error('Failed to save credentials'));
    await fp.rememberForFingerprint(fakeUser(session('j1', 'rj')));
    expect(await fp.savedFingerprintAccount()).toEqual({ uid: 'j1', email: 'j1@x.org', name: 'Dr Test' });
    expect(await fp.fingerprintStatus()).toEqual({ state: 'on' });
    expect(await fp.signInWithFingerprint()).toBe('ok');
    expect(JSON.parse(localStorage.getItem('firebase:authUser:KEY:[DEFAULT]')).uid).toBe('j1');
    await fp.forgetFingerprintAccount();
    expect(await fp.savedFingerprintAccount()).toBeNull();
  });

  it('says why the fingerprint button is missing', async () => {
    expect(await fp.fingerprintStatus()).toEqual({ state: 'not_yet', detail: '' });
    NB.isAvailable.mockResolvedValue({ isAvailable: false, errorCode: 2 });
    expect(await fp.fingerprintStatus()).toEqual({ state: 'no_fingerprint', detail: 2 });
    native.plugin = false;
    expect((await fp.fingerprintStatus()).state).toBe('old_apk');
    native.on = false;
    expect((await fp.fingerprintStatus()).state).toBe('web');
  });
});
