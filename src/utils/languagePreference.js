// The user's default language, saved on their account (users/{uid}.preferredLanguage)
// so it follows them to every device, the web app and the phone app alike.
//
// - First sign-in with nothing saved: App shows LanguagePickerModal once.
// - Every language switch (header E/ع button, side menu, My Profile) saves
//   the new choice through setPreferredLanguage().
// - The users/{uid} listener in App applies a saved choice made elsewhere.
import i18n from '../i18n';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const SUPPORTED_LANGUAGES = ['en', 'ar'];

export const normalizeLanguage = (lang) => {
    const code = String(lang || '').toLowerCase().slice(0, 2);
    return SUPPORTED_LANGUAGES.includes(code) ? code : null;
};

export const currentLanguage = () => (i18n.language?.startsWith('ar') ? 'ar' : 'en');

// A ?lang= in the address (shared public links) wins over the saved choice
// for that page load only.
export const addressForcesLanguage = () => {
    try {
        return !!normalizeLanguage(new URLSearchParams(window.location.search).get('lang'));
    } catch {
        return false;
    }
};

// Switches the app now and saves the choice on the signed-in account.
// Offline, Firestore queues the write and uploads it later.
export const setPreferredLanguage = async (lang) => {
    const code = normalizeLanguage(lang);
    if (!code) return;
    if (currentLanguage() !== code) i18n.changeLanguage(code);
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
        await setDoc(
            doc(db, 'users', uid),
            { preferredLanguage: code, preferredLanguageUpdatedAt: serverTimestamp() },
            { merge: true }
        );
    } catch (error) {
        console.warn('Could not save the default language:', error);
    }
};

export const toggleLanguage = () => setPreferredLanguage(currentLanguage() === 'en' ? 'ar' : 'en');
