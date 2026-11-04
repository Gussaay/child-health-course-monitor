// functions/googleUsageCore.js
//
// The arithmetic and the Cloud Monitoring requests behind googleUsage.js, with
// no Firebase dependency so they can be tested on their own. Errors carry a
// `code` (an HttpsError code); googleUsage.js turns them into HttpsError.

class UsageError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const METRICS = {
  reads: "firestore.googleapis.com/document/read_count",
  writes: "firestore.googleapis.com/document/write_count",
  deletes: "firestore.googleapis.com/document/delete_count",
};

// Firestore list prices (US dollars per 100,000) and the free quota per day
// (resets at midnight Pacific time).
const PRICE_PER_100K = { reads: 0.06, writes: 0.18, deletes: 0.02 };
const FREE_PER_DAY = { reads: 50000, writes: 20000, deletes: 20000 };
const QUOTA_TIME_ZONE = "America/Los_Angeles";

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** [startIso, endIso) for a 'YYYY-MM' month in UTC, the end capped at `now`. */
function monthWindow(month, now = new Date()) {
  const m = MONTH.exec(month || "");
  if (!m) return null;
  const start = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  const end = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1));
  const cap = end.getTime() > now.getTime() ? now : end;
  if (cap.getTime() <= start.getTime()) return null;
  return { start: start.toISOString(), end: cap.toISOString() };
}

/** The Monitoring request URL for one metric over a window, hourly sums. */
function timeSeriesUrl(projectId, metric, window, pageToken) {
  const p = new URLSearchParams({
    filter: `metric.type="${metric}"`,
    "interval.startTime": window.start,
    "interval.endTime": window.end,
    "aggregation.alignmentPeriod": "3600s",
    "aggregation.perSeriesAligner": "ALIGN_SUM",
    "aggregation.crossSeriesReducer": "REDUCE_SUM",
    view: "FULL",
  });
  if (pageToken) p.set("pageToken", pageToken);
  return `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?${p.toString()}`;
}

/** The Pacific-time calendar day a point (identified by its interval end) falls in. */
function quotaDay(endTime) {
  const t = new Date(new Date(endTime).getTime() - 1); // the hour that just ended
  return new Intl.DateTimeFormat("en-CA", { timeZone: QUOTA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
}

/** Adds a Monitoring response's points into `days[date][kind]`. */
function addPoints(days, kind, response) {
  (response.timeSeries || []).forEach((series) => {
    (series.points || []).forEach((point) => {
      const raw = point.value && (point.value.int64Value ?? point.value.doubleValue);
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) return;
      const day = quotaDay(point.interval.endTime);
      days[day] = days[day] || { reads: 0, writes: 0, deletes: 0 };
      days[day][kind] += n;
    });
  });
}

/** Month totals and the Firestore cost, with and without the daily free quota. */
function summarise(days) {
  const dates = Object.keys(days).sort();
  const totals = { reads: 0, writes: 0, deletes: 0 };
  const billable = { reads: 0, writes: 0, deletes: 0 };
  dates.forEach((d) => {
    Object.keys(totals).forEach((k) => {
      totals[k] += days[d][k];
      billable[k] += Math.max(0, days[d][k] - FREE_PER_DAY[k]);
    });
  });
  const cost = (counts) => Object.keys(counts).reduce((sum, k) => sum + (counts[k] / 100000) * PRICE_PER_100K[k], 0);
  return {
    totals,
    billable,
    costBeforeFreeQuota: cost(totals),
    costAfterFreeQuota: cost(billable),
    days: dates.map((date) => ({ date, ...days[date] })),
  };
}


/** Everything for one month; `fetchFn` and `token` are injectable for tests. */
async function loadMonth({ projectId, month, now = new Date(), fetchFn = fetch, token }) {
  const window = monthWindow(month, now);
  if (!window) throw new UsageError("invalid-argument", "Choose a month that has started, as YYYY-MM.");
  const bearer = token;
  const days = {};
  for (const [kind, metric] of Object.entries(METRICS)) {
    let pageToken = "";
    do {
      const res = await fetchFn(timeSeriesUrl(projectId, metric, window, pageToken), { headers: { Authorization: `Bearer ${bearer}` } });
      if (!res.ok) {
        let detail = "";
        try { detail = (await res.json()).error?.message || ""; } catch { /* no body */ }
        if (res.status === 403) {
          throw new UsageError("permission-denied", `Google refused to share the usage numbers: ${detail || "forbidden"}. In Google Cloud Console > IAM, give the project's Cloud Functions service account the "Monitoring Viewer" role, then try again.`);
        }
        throw new UsageError("internal", `Google's usage service answered ${res.status}. ${detail}`.trim());
      }
      const body = await res.json();
      addPoints(days, kind, body);
      pageToken = body.nextPageToken || "";
    } while (pageToken);
  }
  return { month, window, ...summarise(days), priceNote: "US list prices; free quota 50,000 reads, 20,000 writes and 20,000 deletes a day (Pacific time)." };
}


module.exports = { UsageError, loadMonth, monthWindow, timeSeriesUrl, summarise, addPoints, quotaDay, FREE_PER_DAY, PRICE_PER_100K };
