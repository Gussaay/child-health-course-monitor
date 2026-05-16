// src/hooks/useAppUpdate.jsx
import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { LocalNotifications } from '@capacitor/local-notifications';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { downloadAndOpenFile } from '../utils/fileDownloader';
import { RefreshCw, Download, X, Info, ClipboardCheck } from 'lucide-react';

export function useAppUpdate() {
    const [appVersion, setAppVersion] = useState(import.meta.env.VITE_APP_VERSION || window.APP_VERSION || '1.0.2');
    
    const [isUpdateReady, setIsUpdateReady] = useState(false);
    const [updateBundle, setUpdateBundle] = useState(null);
    const [isDownloadingAppUpdate, setIsDownloadingAppUpdate] = useState(false);
    const [appUpdateProgress, setAppUpdateProgress] = useState(0);

    const [nativeUpdatePrompt, setNativeUpdatePrompt] = useState(null);
    const [manualUpdateModal, setManualUpdateModal] = useState({ isOpen: false, status: 'idle', message: '' });

    useEffect(() => {
        let downloadListenerHandle;

        if (Capacitor.isNativePlatform()) {
            const showUpdateNotification = async (title, body, notifId) => {
                try {
                    let permStatus = await LocalNotifications.checkPermissions();
                    if (permStatus.display !== 'granted') permStatus = await LocalNotifications.requestPermissions();
                    
                    if (permStatus.display === 'granted') {
                        if (Capacitor.getPlatform() === 'android') {
                            await LocalNotifications.createChannel({ id: 'updates', name: 'App Updates', description: 'Notifications for app updates', importance: 5, visibility: 1 });
                        }
                        await LocalNotifications.schedule({ notifications: [{ title, body, id: notifId, channelId: 'updates' }] });
                    }
                } catch (err) { console.warn("Failed to show update notification:", err); }
            };

            const setupAndCheckUpdates = async () => {
                try { await CapacitorUpdater.notifyAppReady(); } catch (e) { console.warn("notifyAppReady failed", e); }

                const status = await Network.getStatus();
                if (!status.connected) return;

                // Native Firestore Check
                try {
                    const updateDocRef = doc(db, "meta", "update_config");
                    const updateSnap = await getDoc(updateDocRef);

                    if (updateSnap.exists()) {
                        const serverConfig = updateSnap.data();
                        const appInfo = await CapacitorApp.getInfo();
                        const currentBuild = parseInt(appInfo.build, 10) || 1;
                        const serverBuild = parseInt(serverConfig.latestNativeBuild, 10);

                        if (serverBuild > currentBuild) {
                            setNativeUpdatePrompt(serverConfig);
                            showUpdateNotification("تحديث جديد للتطبيق", `يتوفر إصدار جديد (${serverConfig.versionString}). يرجى التحميل الآن.`, 101);
                            return; 
                        }
                    }
                } catch (e) { console.warn("Native update check failed safely:", e); }

                // Capgo OTA Check
                try {
                    const currentState = await CapacitorUpdater.current();
                    const currentVersion = currentState.bundle?.version || import.meta.env.VITE_APP_VERSION || "builtin";
                    setAppVersion(currentVersion);

                    const response = await fetch('https://imnci-courses-monitor.web.app/latest/update.json?t=' + Date.now(), { cache: "no-store" });
                    if (response.ok) {
                        const latestUpdate = await response.json();
                        if (currentVersion !== latestUpdate.version) {
                            const downloadedBundle = await CapacitorUpdater.download({ url: latestUpdate.url, version: latestUpdate.version });
                            setUpdateBundle(downloadedBundle); 
                            setIsUpdateReady(true);
                            showUpdateNotification("تحديث جاهز!", "تم تحميل التحديث بنجاح. انقر لإعادة تشغيل التطبيق.", 102);
                        }
                    }
                } catch (error) { console.warn("Capgo check failed safely:", error); }
            };
            
            setTimeout(setupAndCheckUpdates, 5000); 

            CapacitorUpdater.addListener('download', (info) => {
                setAppUpdateProgress(info.percent); 
            }).then(handle => { downloadListenerHandle = handle; }).catch(e => console.warn("Failed to bind Capgo listener", e));
        }

        return () => { if (downloadListenerHandle) downloadListenerHandle.remove(); };
    }, []);

    const handleManualUpdateCheck = async () => {
        setManualUpdateModal({ isOpen: true, status: 'checking', message: 'Checking for updates...' });

        if (!Capacitor.isNativePlatform()) {
            setManualUpdateModal({ isOpen: true, status: 'info', message: 'Web version is always up to date on refresh.' });
            return;
        }

        try {
            const status = await Network.getStatus();
            if (!status.connected) {
                setManualUpdateModal({ isOpen: true, status: 'error', message: 'You are offline. Cannot check for updates.' });
                return;
            }

            let nativeUpdateFound = false;

            try {
                const updateDocRef = doc(db, "meta", "update_config");
                const updateSnap = await getDoc(updateDocRef);

                if (updateSnap.exists()) {
                    const serverConfig = updateSnap.data();
                    const appInfo = await CapacitorApp.getInfo();
                    const currentBuild = parseInt(appInfo.build, 10) || 1;
                    const serverBuild = parseInt(serverConfig.latestNativeBuild, 10);
                    
                    if (serverBuild > currentBuild) {
                        setManualUpdateModal({ isOpen: false, status: 'idle', message: '' }); 
                        setNativeUpdatePrompt(serverConfig); 
                        nativeUpdateFound = true;
                        return; 
                    }
                }
            } catch (fsError) {}

            try {
                const response = await fetch('https://imnci-courses-monitor.web.app/latest/update.json?t=' + Date.now(), { cache: "no-store" });
                if (!response.ok) throw new Error(`Server returned ${response.status}`);

                const latestUpdate = await response.json();
                const currentState = await CapacitorUpdater.current();
                const currentVersion = currentState.bundle?.version || "builtin";

                if (currentVersion !== latestUpdate.version) {
                    setManualUpdateModal({ isOpen: false, status: 'idle', message: '' });
                    setIsDownloadingAppUpdate(true);
                    setAppUpdateProgress(0);
                    
                    const downloadedBundle = await CapacitorUpdater.download({ url: latestUpdate.url, version: latestUpdate.version });
                    setUpdateBundle(downloadedBundle); 
                    setIsUpdateReady(true);
                } else if (!nativeUpdateFound) {
                    setManualUpdateModal({ isOpen: true, status: 'success', message: `App is already up to date! (Version: ${currentVersion})` });
                }
            } catch (fetchError) {
                 throw new Error(`Network request failed: ${fetchError.message}`);
            }

        } catch (error) {
            setManualUpdateModal({ isOpen: true, status: 'error', message: `${error.message || 'Unknown error occurred.'}` });
        } finally {
            setIsDownloadingAppUpdate(false);
        }
    };

    const AppUpdateModals = () => (
        <>
            {/* NATIVE DIRECT DOWNLOAD MODAL */}
            {nativeUpdatePrompt && (
                <div className="fixed inset-0 bg-slate-900 bg-opacity-90 flex flex-col items-center justify-center z-[100000] p-4 backdrop-blur-sm" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
                            <Download className="h-8 w-8 text-red-600 animate-bounce"/>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">تحديث هام مطلوب</h3>
                        <p className="text-sm text-slate-600 font-medium">
                            يتوفر إصدار جديد من التطبيق ({nativeUpdatePrompt.versionString}). يجب عليك تحميل هذا التحديث للاستمرار في استخدام التطبيق.
                        </p>
                        {nativeUpdatePrompt.releaseNotes && (
                            <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-700 text-right border border-gray-200">
                                <strong>ميزات التحديث:</strong><br/>{nativeUpdatePrompt.releaseNotes}
                            </div>
                        )}
                        <button 
                            onClick={() => {
                               downloadAndOpenFile(nativeUpdatePrompt.downloadUrl, `Update_v${nativeUpdatePrompt.versionString}.apk`, {
    isSystemFile: true, // Uses Cache, skips permission issues
    onStart: () => setIsDownloading(true),
    onFinally: () => setIsDownloading(false)
});
                            }}
                            className="w-full justify-center rounded-xl bg-red-600 px-4 py-3 text-base font-bold text-white shadow-sm hover:bg-red-700 transition-colors"
                        >
                            تحميل التحديث الآن
                        </button>
                        {!nativeUpdatePrompt.mandatory && (
                            <button onClick={() => setNativeUpdatePrompt(null)} className="text-sm text-gray-500 hover:text-gray-700 mt-2">
                                تخطي في الوقت الحالي
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* CAPGO OTA UPDATE READY MODAL */}
            {isUpdateReady && updateBundle && !nativeUpdatePrompt && (
                <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex flex-col items-center justify-center z-[100000] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-sky-100">
                            <RefreshCw className="h-6 w-6 text-sky-600 animate-spin"/>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Update Ready!</h3>
                        <p className="text-sm text-slate-500">
                            A new version of the app has been downloaded in the background. You must restart the app to apply the update and continue.
                        </p>
                        <button 
                            onClick={async () => {
                                try { await CapacitorUpdater.set({ id: updateBundle.id }); } catch (e) { console.error("Failed to apply update", e); }
                            }}
                            className="w-full inline-flex justify-center rounded-md border border-transparent bg-sky-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-sky-700 sm:text-sm"
                        >
                            Restart & Update Now
                        </button>
                    </div>
                </div>
            )}

            {/* MANUAL UPDATE CHECK MODAL */}
            {manualUpdateModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex flex-col items-center justify-center z-[100000] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-slate-100">
                            {manualUpdateModal.status === 'checking' || manualUpdateModal.status === 'downloading' ? (
                                <RefreshCw className="h-6 w-6 text-sky-600 animate-spin"/>
                            ) : manualUpdateModal.status === 'success' ? (
                                <ClipboardCheck className="h-6 w-6 text-green-600" />
                            ) : manualUpdateModal.status === 'error' ? (
                                <X className="h-6 w-6 text-red-600" />
                            ) : (
                                <Info className="h-6 w-6 text-sky-600" />
                            )}
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">
                            {manualUpdateModal.status === 'checking' ? 'Checking for Updates' :
                             manualUpdateModal.status === 'downloading' ? 'Downloading Update' :
                             manualUpdateModal.status === 'success' ? 'Up to Date' :
                             manualUpdateModal.status === 'error' ? 'Update Error' : 'Information'}
                        </h3>
                        <p className="text-sm text-slate-500">{manualUpdateModal.message}</p>
                        {(manualUpdateModal.status === 'success' || manualUpdateModal.status === 'error' || manualUpdateModal.status === 'info') && (
                            <button 
                                onClick={() => setManualUpdateModal({ isOpen: false, status: 'idle', message: '' })}
                                className="w-full mt-2 inline-flex justify-center rounded-md bg-slate-800 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-slate-700 sm:text-sm"
                            >
                                Close
                            </button>
                        )}
                    </div>
                </div>
            )}
        </>
    );

    return {
        appVersion,
        isDownloadingAppUpdate,
        appUpdateProgress,
        handleManualUpdateCheck,
        AppUpdateModals
    };
}downloadAndOpenFile