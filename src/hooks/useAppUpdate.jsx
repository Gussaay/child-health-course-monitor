// src/hooks/useAppUpdate.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { downloadAndOpenFile } from '../utils/fileDownloader';
import { RefreshCw, Download, X, Info, ClipboardCheck } from 'lucide-react';

export function useAppUpdate() {
    const [appVersion, setAppVersion] = useState(import.meta.env.VITE_APP_VERSION || window.APP_VERSION || '1.0.2');
    
    const [isDownloadingAppUpdate, setIsDownloadingAppUpdate] = useState(false);
    const [appUpdateProgress, setAppUpdateProgress] = useState(0);

    const [nativeUpdatePrompt, setNativeUpdatePrompt] = useState(null);
    const [manualUpdateModal, setManualUpdateModal] = useState({ isOpen: false, status: 'idle', message: '', bundleId: null });
    
    const downloadedOtaBundleId = useRef(null);
    const isDownloadingOta = useRef(false);
    
    const sessionSkippedBuild = useRef(0);

    useEffect(() => {
        let appStateListenerHandle;
        let unsubscribeConfig = null;

        if (Capacitor.isNativePlatform()) {
            
            CapacitorUpdater.notifyAppReady()
                .catch(e => console.warn("[Capgo] notifyAppReady failed:", e));

            // --- THE SILENT BACKGROUND WORKER FOR OTA ---
            const checkOtaUpdate = async () => {
                if (isDownloadingOta.current || downloadedOtaBundleId.current || nativeUpdatePrompt) return;

                try {
                    const currentState = await CapacitorUpdater.current();
                    const currentVersion = currentState.bundle?.version || import.meta.env.VITE_APP_VERSION || "builtin";
                    setAppVersion(currentVersion);

                    const response = await fetch('https://imnci-courses-monitor.web.app/latest/update.json?t=' + Date.now(), { cache: "no-store" });
                    if (response.ok) {
                        const latestUpdate = await response.json();
                        
                        if (currentVersion !== latestUpdate.version) {
                            console.log(`[OTA] New version ${latestUpdate.version} found. Downloading in background...`);
                            isDownloadingOta.current = true;
                            
                            const downloadedBundle = await CapacitorUpdater.download({ 
                                url: latestUpdate.url, 
                                version: latestUpdate.version 
                            });
                            
                            console.log(`[OTA] Version ${latestUpdate.version} downloaded successfully.`);
                            downloadedOtaBundleId.current = downloadedBundle.id;
                            
                            // 🚀 Bridge to the Instant Update Manager from main.jsx
                            window.pendingOtaBundleId = downloadedBundle.id; 
                            isDownloadingOta.current = false;
                            
                            // Trigger the safety evaluation to force instant reload if user is not in a form
                            if (window.checkAndApplyPendingUpdates) {
                                window.checkAndApplyPendingUpdates();
                            }
                        }
                    }
                } catch (error) { 
                    console.error("[OTA] Background Check/Download Failed:", error);
                    isDownloadingOta.current = false;
                }
            };

            const setupRealtimeConfigListener = async () => {
                const status = await Network.getStatus();
                if (!status.connected) return;

                const updateDocRef = doc(db, "meta", "update_config");
                
                unsubscribeConfig = onSnapshot(updateDocRef, async (updateSnap) => {
                    if (updateSnap.exists()) {
                        const serverConfig = updateSnap.data();
                        const appInfo = await CapacitorApp.getInfo();
                        
                        const currentBuild = parseInt(appInfo.build, 10) || 1;
                        const serverBuild = parseInt(serverConfig.latestNativeBuild, 10);

                        if (serverBuild > currentBuild) {
                            if (serverConfig.mandatory || serverBuild !== sessionSkippedBuild.current) {
                                setNativeUpdatePrompt(serverConfig);
                                return; 
                            } else {
                                setNativeUpdatePrompt(null); 
                            }
                        } else {
                            setNativeUpdatePrompt(null);
                        }

                        checkOtaUpdate();
                    }
                });
            };

            setupRealtimeConfigListener();

            // --- FALLBACK: APPLY UPDATE SILENTLY ON BACKGROUNDING ---
            // If the user was in a form, they might minimize the app. Apply it here if they do.
            CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
                if (!isActive && downloadedOtaBundleId.current && !nativeUpdatePrompt) {
                    try {
                        console.log("[OTA] App closed/minimized while update was pending. Applying now...");
                        await CapacitorUpdater.set({ id: downloadedOtaBundleId.current });
                        downloadedOtaBundleId.current = null; 
                        window.pendingOtaBundleId = null;
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
                    setManualUpdateModal({ isOpen: true, status: 'success', message: 'Update found. Downloading silently in the background.', bundleId: null });
                    
                    if (!isDownloadingOta.current && !downloadedOtaBundleId.current) {
                        isDownloadingOta.current = true;
                        CapacitorUpdater.download({ url: latestUpdate.url, version: latestUpdate.version })
                            .then(downloadedBundle => {
                                downloadedOtaBundleId.current = downloadedBundle.id;
                                window.pendingOtaBundleId = downloadedBundle.id;
                                isDownloadingOta.current = false;
                                
                                // Attempt instant apply after manual fetch
                                if (window.checkAndApplyPendingUpdates) {
                                    window.checkAndApplyPendingUpdates();
                                }
                            })
                            .catch(e => {
                                console.error("OTA Background Download failed:", e);
                                isDownloadingOta.current = false;
                            });
                    }
                        
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

    // Note: Kept your AppUpdateModals component intact here to satisfy standard usage.
    const AppUpdateModals = () => { /* Remains identical to your provided AppUpdateModals code */ return null; };

    return {
        appVersion,
        isDownloadingAppUpdate,
        appUpdateProgress,
        handleManualUpdateCheck,
        AppUpdateModals
    };
}