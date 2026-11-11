// components/CertificateDownloadBanner.jsx
// Kept apart from CertificateGenerator.jsx on purpose: App.jsx renders this on
// every page, and it must not pull the PDF and canvas libraries in with it.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertTriangle, Download, X } from 'lucide-react';
import {
    subscribeCertificateDownloads, cancelCertificateDownload, dismissCertificateDownload,
} from '../utils/certificateDownloads';

/**
 * The progress banner. App.jsx mounts exactly one, outside the routed views, so
 * it survives navigation — which is the only reason it is a separate component
 * rather than part of the participants screen.
 */
export const CertificateDownloadBanner = () => {
    const { t } = useTranslation();
    const [jobs, setJobs] = useState([]);
    useEffect(() => subscribeCertificateDownloads(setJobs), []);

    if (jobs.length === 0) return null;

    return (
        <div className="fixed bottom-[calc(var(--bottom-nav,0px)+1rem)] inset-x-3 sm:inset-x-auto sm:end-4 sm:w-80 z-[70] space-y-2 print-hide">
            {jobs.map((job) => {
                const pct = job.total > 0 ? Math.round((job.current / job.total) * 100) : 0;
                const done = job.status === 'done';
                const failed = job.status === 'failed';
                const stopped = job.status === 'cancelled';
                return (
                    <div key={job.id} className={`rounded-lg shadow-lg border p-3 text-sm bg-white ${
                        failed ? 'border-red-300' : done ? 'border-green-300' : 'border-slate-300'}`}>
                        <div className="flex items-start gap-2">
                            {done ? <CheckCircle size={16} className="text-green-600 shrink-0 mt-0.5" />
                                : failed ? <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                                    : <Download size={16} className="text-sky-600 shrink-0 mt-0.5" />}
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold text-slate-800 break-words">{job.label}</div>
                                <div className="text-xs text-slate-500">
                                    {done ? t('certificates.banner.downloaded', 'Downloaded')
                                        : failed ? job.error
                                            : stopped ? t('certificates.banner.stopped', 'Stopped')
                                                : job.status === 'stopping' ? t('certificates.banner.stopping', 'Stopping…')
                                                    : job.kind === 'bulk'
                                                        ? t('certificates.banner.preparing_n', 'Preparing {{current}} of {{total}}', { current: job.current, total: job.total })
                                                        : t('certificates.banner.preparing_one', 'Preparing the certificate…')}
                                </div>
                            </div>
                            {job.status === 'running' ? (
                                <button type="button" onClick={() => cancelCertificateDownload(job.id)}
                                    className="text-xs text-red-600 hover:underline shrink-0">{t('certificates.banner.stop', 'Stop')}</button>
                            ) : (
                                <button type="button" onClick={() => dismissCertificateDownload(job.id)}
                                    className="text-slate-400 hover:text-slate-600 shrink-0"><X size={14} /></button>
                            )}
                        </div>

                        {job.kind === 'bulk' && !done && !failed && !stopped && (
                            <div className="mt-2 h-1.5 bg-slate-200 rounded overflow-hidden">
                                <div className="h-full bg-sky-600 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

