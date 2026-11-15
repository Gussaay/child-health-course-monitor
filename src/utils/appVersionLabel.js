// src/utils/appVersionLabel.js
//
// The version number people see (Qusay, 2026-11-12):
//   - It goes up by itself each time an APK is sent to users from
//     Admin → Updates: 3.3, 3.4, ... (the admin may type another, e.g. 4.0).
//   - Over-the-air updates after that APK do not change it; they add a
//     counter: "3.3 (update 2)".
// The numbers live in meta/update_config.displayVersions as
// { "<APK build>": "3.3" }, which phones already listen to.
//
// CI's own numbers stay as they are underneath: every build is
// "<run/10 + 1>.<run % 10>.0", and the run number is the APK versionCode and
// the "Build ID" in the update manager. Capgo needs those.

/** "36.4.0" -> 354 (the CI run number), or null. */
export function buildNumberOf(version) {
  const m = /^(\d+)\.(\d+)\.0$/.exec(String(version || ''));
  if (!m) return null;
  return (parseInt(m[1], 10) - 1) * 10 + parseInt(m[2], 10);
}

function entries(map) {
  return Object.entries(map || {})
    .map(([build, v]) => [parseInt(build, 10), String(v || '').trim()])
    .filter(([b, v]) => Number.isFinite(b) && v)
    .sort((a, b) => a[0] - b[0]);
}

/** The shown version of an APK build: its own entry, else the newest entry
 * from before it, else `fallback`. Also returns the build that entry is for. */
export function displayVersionFor(build, map, fallback) {
  const list = entries(map);
  const b = parseInt(build, 10);
  let hit = null;
  if (Number.isFinite(b)) {
    for (const e of list) if (e[0] <= b) hit = e;
  }
  return hit ? { version: hit[1], since: hit[0] } : { version: fallback, since: null };
}

/** "3.2" -> "3.3", "3.9" -> "3.10". Used to fill in the next APK's number. */
export function bumpVersion(v) {
  const m = /^(\d+)\.(\d+)$/.exec(String(v || '').trim());
  if (!m) return '3.3';
  return `${m[1]}.${parseInt(m[2], 10) + 1}`;
}

/** The number to suggest for the next APK push. */
export function nextDisplayVersion(map, fallback) {
  const list = entries(map);
  return bumpVersion(list.length ? list[list.length - 1][1] : fallback);
}

/**
 * The label: "3.3" or "3.3 (update 2)".
 * apkBuild is null on the web, where the counter is counted from the newest
 * APK release instead.
 */
export function versionLabel({ apkBuild, runningBuild, map, fallback }) {
  const list = entries(map);
  const base = apkBuild
    ? displayVersionFor(apkBuild, map, fallback)
    : list.length
      ? { version: list[list.length - 1][1], since: list[list.length - 1][0] }
      : { version: fallback, since: null };
  const from = apkBuild || base.since;
  const updates = from && runningBuild ? runningBuild - from : 0;
  return updates > 0 ? `${base.version} (update ${updates})` : base.version;
}
