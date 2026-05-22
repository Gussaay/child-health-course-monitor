// src/hooks/useAppUpdate.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { LocalNotifications } from '@capacitor/local-notifications';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { downloadAndOpenFile } from '../utils/fileDownloader';
import { RefreshCw, Download, X, Info, ClipboardCheck } from 'lucide-react';

export function useAppUpdate() {
    const [appVersion, setAppVersion] = useState(import.meta.env.VITE_APP_VERSION || window.APP_VERSION || '1.0.2');
    
    // States specifically for Hard Native APK updates (OTA is now 100% silent)
    const [isDownloadingAppUpdate, setIsDownloadingAppUpdate] = useState(false);
    const [appUpdateProgress, setAppUpdateProgress] = useState(0);

    const [nativeUpdatePrompt, setNativeUpdatePrompt] = useState(null);
    const [manualUpdateModal, setManualUpdateModal] = useState({ isOpen: false, status: 'idle', message: '', bundleId: null });
    
    // Refs to control silent OTA flow and prevent duplicate operations
    const downloadedOtaBundleId = useRef(null);
    const isDownloadingOta = useRef(false);

    useEffect(() => {
        let appStateListenerHandle;
        let unsubscribeConfig = null;

        if (Capacitor.isNativePlatform()) {
            
            // 1. CRITICAL: Prevent Rollbacks and Multiple Restarts!
            // Instantly tell the native layer the app booted successfully.
            CapacitorUpdater.notifyAppReady()
                .catch(e => console.warn("[Capgo] notifyAppReady failed:", e));

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

            // --- THE SILENT BACKGROUND WORKER FOR OTA ---
            const checkOtaUpdate = async () => {
                // Prevent concurrent downloads or downloading if a native update is pending
                if (isDownloadingOta.current || downloadedOtaBundleId.current || nativeUpdatePrompt) return;

                try {
                    const currentState = await CapacitorUpdater.current();
                    const currentVersion = currentState.bundle?.version || import.meta.env.VITE_APP_VERSION || "builtin";
                    setAppVersion(currentVersion);

                    // Fetch the latest version manifest silently
                    const response = await fetch('https://imnci-courses-monitor.web.app/latest/update.json?t=' + Date.now(), { cache: "no-store" });
                    if (response.ok) {
                        const latestUpdate = await response.json();
                        
                        if (currentVersion !== latestUpdate.version) {
                            isDownloadingOta.current = true;
                            
                            // Download completely silently in the background
                            const downloadedBundle = await CapacitorUpdater.download({ 
                                url: latestUpdate.url, 
                                version: latestUpdate.version 
                            });
                            
                            // Store the ID. We will NOT apply it until the user leaves the app.
                            downloadedOtaBundleId.current = downloadedBundle.id;
                            isDownloadingOta.current = false;
                        }
                    }
                } catch (error) { 
                    isDownloadingOta.current = false;
                }
            };

            // --- REAL-TIME LISTENER FOR IMMEDIATE UPDATES ---
            const setupRealtimeConfigListener = async () => {
                const status = await Network.getStatus();
                if (!status.connected) return;

                const updateDocRef = doc(db, "meta", "update_config");
                
                // This triggers the EXACT moment the admin pushes an update in the dashboard
                unsubscribeConfig = onSnapshot(updateDocRef, async (updateSnap) => {
                    if (updateSnap.exists()) {
                        const serverConfig = updateSnap.data();
                        const appInfo = await CapacitorApp.getInfo();
                        
                        const currentBuild = parseInt(appInfo.build, 10) || 1;
                        const serverBuild = parseInt(serverConfig.latestNativeBuild, 10);

                        // 1. Check Native (Hard APK update requirement overrides OTA)
                        if (serverBuild > currentBuild) {
                            setNativeUpdatePrompt(serverConfig);
                            showUpdateNotification("تحديث جديد للتطبيق", "يتوفر إصدار جديد. يرجى التحميل الآن.", 101);
                            return; 
                        } else {
                            setNativeUpdatePrompt(null);
                        }

                        // 2. Trigger OTA check instantly based on the snapshot push
                        checkOtaUpdate();
                    }
                });
            };

            setupRealtimeConfigListener();

            // --- APPLY UPDATE SILENTLY ON BACKGROUND ---
            // This guarantees the user's active session is NEVER interrupted.
            CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
                // If the app goes to the background AND an update is ready AND no hard APK is required
                if (!isActive && downloadedOtaBundleId.current && !nativeUpdatePrompt) {
                    try {
                        // Swap the bundle while the app is hidden.
                        // The next time the user clicks the app icon, it will be instantly ready on the new version.
                        await CapacitorUpdater.set({ id: downloadedOtaBundleId.current });
                        downloadedOtaBundleId.current = null; 
                    } catch (e) { 
                        console.error("[Capgo] Failed to set OTA bundle:", e);
                    }
                }
            }).then(handle => { appStateListenerHandle = handle; });
        }

        return () => { 
            if (appStateListenerHandle) appStateListenerHandle.remove();
            if (unsubscribeConfig) unsubscribeConfig();
        };
    }, [nativeUpdatePrompt]);

    const handleManualUpdateCheck = async () => {
        setManualUpdateModal({ isOpen: true, status: 'checking', message: 'Checking for updates...', bundleId: null });

        if (!Capacitor.isNativePlatform()) {
            setManualUpdateModal({ isOpen: true, status: 'info', message: 'Web version is always up to date on refresh.', bundleId: null });
            setTimeout(() => setManualUpdateModal({ isOpen: false, status: 'idle', message: '', bundleId: null }), 3000);
            return;
        }

        try {
            const status = await Network.getStatus();
            if (!status.connected) {
                setManualUpdateModal({ isOpen: true, status: 'error', message: 'You are offline. Cannot check for updates.', bundleId: null });
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
                        setManualUpdateModal({ isOpen: false, status: 'idle', message: '', bundleId: null }); 
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
                    // Inform the user gracefully and handle the OTA download implicitly
                    setManualUpdateModal({ isOpen: true, status: 'success', message: 'Update found. It will be downloaded and applied silently in the background.', bundleId: null });
                    
                    // Trigger non-blocking silent download if not already doing so
                    if (!isDownloadingOta.current && !downloadedOtaBundleId.current) {
                        isDownloadingOta.current = true;
                        CapacitorUpdater.download({ url: latestUpdate.url, version: latestUpdate.version })
                            .then(downloadedBundle => {
                                downloadedOtaBundleId.current = downloadedBundle.id;
                                isDownloadingOta.current = false;
                            })
                            .catch(e => {
                                console.error("OTA Background Download failed:", e);
                                isDownloadingOta.current = false;
                            });
                    }
                        
                    // Auto-dismiss the modal to maintain workflow
                    setTimeout(() => setManualUpdateModal({ isOpen: false, status: 'idle', message: '', bundleId: null }), 4000);
                } else if (!nativeUpdateFound) {
                    setManualUpdateModal({ isOpen: true, status: 'success', message: `App is already up to date! (Version: ${currentVersion})`, bundleId: null });
                }
            } catch (fetchError) {
                 throw new Error(`Network request failed: ${fetchError.message}`);
            }

        } catch (error) {
            setManualUpdateModal({ isOpen: true, status: 'error', message: `${error.message || 'Unknown error occurred.'}`, bundleId: null });
        }
    };

    const AppUpdateModals = () => (
        <>
            {/* Native APK UI is kept intact as hard-updates require explicit user downloads */}
            {nativeUpdatePrompt && (
                <div className="fixed inset-0 bg-slate-900 bg-opacity-90 flex flex-col items-center justify-center z-[100000] p-4 backdrop-blur-sm" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
                            <Download className={`h-8 w-8 text-red-600 ${isDownloadingAppUpdate ? 'animate-pulse' : 'animate-bounce'}`}/>
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
                        
                        <div className="w-full pt-2">
                            <button 
                                onClick={() => {
                                    downloadAndOpenFile(nativeUpdatePrompt.downloadUrl, `Update_v${nativeUpdatePrompt.versionString}.apk`, {
                                        isSystemFile: false, // FIXED: Now it goes to NCHP_Downloads so users can see and delete it later!
                                        onStart: () => {
                                            setIsDownloadingAppUpdate(true);
                                            setAppUpdateProgress(0);
                                        },
                                        onProgress: (pct) => setAppUpdateProgress(pct),
                                        onFinally: () => setIsDownloadingAppUpdate(false)
                                    });
                                }}
                                disabled={isDownloadingAppUpdate}
                                className="w-full justify-center rounded-xl bg-red-600 px-4 py-3 text-base font-bold text-white shadow-sm hover:bg-red-700 transition-colors disabled:opacity-75 disabled:cursor-wait"
                            >
                                {isDownloadingAppUpdate ? 'جاري التحميل...' : 'تحميل التحديث الآن'}
                            </button>

                            {isDownloadingAppUpdate && (
                                <div className="mt-4">
                                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                        <div 
                                            className="bg-red-600 h-2.5 rounded-full transition-all duration-300" 
                                            style={{ width: `${Math.max(appUpdateProgress, 3)}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 text-center font-mono">
                                        {Math.round(appUpdateProgress)}%
                                    </p>
                                </div>
                            )}
                        </div>

                        {!nativeUpdatePrompt.mandatory && !isDownloadingAppUpdate && (
                            <button onClick={() => setNativeUpdatePrompt(null)} className="text-sm text-gray-500 hover:text-gray-700 mt-2">
                                تخطي في الوقت الحالي
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Manual check modal (Auto-dismisses for OTA, stays open for info/errors) */}
            {manualUpdateModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex flex-col items-center justify-center z-[100000] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-slate-100">
                            {manualUpdateModal.status === 'checking' ? (
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
                             manualUpdateModal.status === 'success' ? 'Update Status' :
                             manualUpdateModal.status === 'error' ? 'Update Error' : 'Information'}
                        </h3>
                        <p className="text-sm text-slate-500">{manualUpdateModal.message}</p>
                        
                        {manualUpdateModal.status !== 'success' && (
                            <button 
                                onClick={() => setManualUpdateModal({ isOpen: false, status: 'idle', message: '', bundleId: null })}
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
}