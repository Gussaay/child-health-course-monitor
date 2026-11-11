// utils/certificateDownloads.js
//
// The queue of certificate downloads (see "DOWNLOADS THAT OUTLIVE THE PAGE
// THAT STARTED THEM" in components/CertificateGenerator.jsx).
//
// It lives in its own small file so that the banner App.jsx mounts on every
// page can watch it without importing CertificateGenerator.jsx, which brings
// jsPDF, html2canvas and the QR code library: about 220 KB compressed that
// every visitor downloaded, even on the sign-in screen, before any certificate
// was asked for.

let jobCounter = 0;
export const nextCertificateJobId = () => `cert-${++jobCounter}`;
export const downloadJobs = new Map();
const downloadListeners = new Set();

export const announceJobs = () => {
    const snapshot = [...downloadJobs.values()].map((j) => ({ ...j }));
    downloadListeners.forEach((fn) => { try { fn(snapshot); } catch (e) { console.warn(e); } });
};

/** Watch the queue. Called immediately with the current state. */
export const subscribeCertificateDownloads = (fn) => {
    downloadListeners.add(fn);
    fn([...downloadJobs.values()].map((j) => ({ ...j })));
    return () => downloadListeners.delete(fn);
};

/** Ask a job to stop. It stops between certificates, not mid-render. */
export const cancelCertificateDownload = (id) => {
    const job = downloadJobs.get(id);
    if (!job || job.status !== 'running') return;
    job.cancelled = true;
    job.status = 'stopping';
    announceJobs();
};

/** Clear a finished job from the banner. */
export const dismissCertificateDownload = (id) => {
    const job = downloadJobs.get(id);
    if (job && job.status === 'running') return;
    downloadJobs.delete(id);
    announceJobs();
};

