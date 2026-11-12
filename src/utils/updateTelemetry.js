// src/utils/updateTelemetry.js
//
// What the admin Update manager counts, and where update errors go.
//
// Each phone writes to its own userUsageStats/{uid} document (the rules let a
// user write only their own):
//   nativeBuild / apkVersion   the installed APK (versionCode / versionName)
//   otaVersion                 the over-the-air bundle running right now
//   updatePromptBuild / At     the newest APK build this phone was asked to install
//   updateDownloadBuild / At   the APK build it finished downloading
// The admin screen counts, for the active update build B: "received" =
// prompted for B (or already on B or newer), "updated" = nativeBuild >= B.
//
// Update failures (APK download, installer, over-the-air download or rollback)
// go to Admin → Problems with kind "update". Each distinct error is sent once
// per app session, so a phone on a bad connection does not flood the log.
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const IS_NATIVE = Capacitor.isNativePlatform();

/** Resolves with the signed-in user once there is one (never rejects). */
function signedInUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (u) => {
      if (u) { stop(); resolve(u); }
    });
  });
}

let appInfoPromise = null;
/** { version, build } of the installed APK, or null on the web. */
export function getApkInfo() {
  if (!IS_NATIVE) return Promise.resolve(null);
  if (!appInfoPromise) {
    appInfoPromise = CapacitorApp.getInfo()
      .then((i) => ({ version: i.version || null, build: parseInt(i.build, 10) || null }))
      .catch(() => null);
  }
  return appInfoPromise;
}

async function writeOwnStats(fields) {
  try {
    const user = await signedInUser();
    await setDoc(doc(db, 'userUsageStats', user.uid), fields, { merge: true });
  } catch (e) {
    console.warn('[Update telemetry] Could not save:', e?.code || e?.message);
  }
}

let stampedVersions = false;
/** Saves which APK and over-the-air bundle this phone runs. Once per launch. */
export async function recordInstalledVersions(otaVersion) {
  if (!IS_NATIVE || stampedVersions) return;
  stampedVersions = true;
  const info = await getApkInfo();
  if (!info) return;
  await writeOwnStats({
    nativeBuild: info.build,
    apkVersion: info.version,
    otaVersion: otaVersion || null,
    versionsSeenAt: serverTimestamp(),
  });
}

const promptedBuilds = new Set();
/** The phone showed the "new version" prompt for this APK build. */
export function recordUpdatePrompt(build, mandatory) {
  if (!IS_NATIVE || !build || promptedBuilds.has(build)) return;
  promptedBuilds.add(build);
  writeOwnStats({ updatePromptBuild: build, updatePromptMandatory: !!mandatory, updatePromptAt: serverTimestamp() });
}

/** The APK for this build finished downloading (the installer was opened). */
export function recordUpdateDownloaded(build) {
  if (!IS_NATIVE || !build) return;
  writeOwnStats({ updateDownloadBuild: build, updateDownloadAt: serverTimestamp() });
}

const reported = new Set();
/**
 * Sends an update failure to Admin → Problems (kind "update"). Never throws.
 * @param {string} what   short description, e.g. "APK download failed: ..."
 * @param {object} detail { stage, targetBuild, url, stack }
 */
export async function reportUpdateError(what, detail = {}) {
  const key = `${detail.stage || ''}|${what}`;
  if (reported.has(key)) return;
  reported.add(key);
  try {
    const user = await signedInUser();
    const info = await getApkInfo();
    const { submitProblemReport } = await import('../data');
    await submitProblemReport({
      kind: 'update',
      what: String(what || 'Update failed').slice(0, 300),
      stack: [
        detail.stage && `Stage: ${detail.stage}`,
        detail.targetBuild && `Target APK build: ${detail.targetBuild}`,
        info && `Installed APK: ${info.version} (build ${info.build})`,
        `Running bundle: ${import.meta.env.VITE_APP_VERSION || 'unknown'}`,
        detail.url && `URL: ${String(detail.url).slice(0, 300)}`,
        detail.stack && String(detail.stack).slice(0, 2000),
      ].filter(Boolean).join('\n'),
      context: 'app-update',
      screen: typeof window !== 'undefined' ? window.location.pathname : null,
      source: 'updateTelemetry.js',
      appVersion: typeof window !== 'undefined' ? window.__APP_VERSION__ || null : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent?.slice(0, 300) : null,
      online: typeof navigator !== 'undefined' ? navigator.onLine : null,
      reporterEmail: user?.email || null,
    });
  } catch (e) {
    reported.delete(key); // try again next time it happens
    console.warn('[Update telemetry] Could not report:', e?.code || e?.message);
  }
}
