// src/components/DownloadedFilesView.jsx
import React, { useState, useEffect } from 'react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Trash2, File, ExternalLink, ArrowLeft, RefreshCw, HardDrive } from 'lucide-react';
import { Card, PageHeader, Button, Spinner, EmptyState } from './CommonComponents';

export default function DownloadedFilesView({ onBack, setToast }) {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadFiles = async () => {
        if (!Capacitor.isNativePlatform()) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // Ensure the folder exists
            try {
                await Filesystem.mkdir({ path: 'downloads', directory: Directory.Data, recursive: true });
            } catch (e) {
                // Ignore if it already exists
            }

            const result = await Filesystem.readdir({
                path: 'downloads',
                directory: Directory.Data
            });

            // Get stats for each file to show size and date
            const fileDetails = await Promise.all(result.files.map(async (fileInfo) => {
                const name = fileInfo.name || fileInfo; // Handle different Capacitor versions
                const stat = await Filesystem.stat({
                    path: `downloads/${name}`,
                    directory: Directory.Data
                });
                return {
                    name: name,
                    uri: stat.uri,
                    size: stat.size,
                    mtime: stat.mtime
                };
            }));

            // Sort by newest first
            fileDetails.sort((a, b) => b.mtime - a.mtime);
            setFiles(fileDetails);
        } catch (error) {
            console.error("Error loading downloaded files:", error);
            setToast({ show: true, message: "Failed to load files.", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFiles();
    }, []);

    const formatBytes = (bytes, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    const handleOpenFile = async (file) => {
        try {
            let mimeType = '*/*';
            const lowerName = file.name.toLowerCase();
            if (lowerName.endsWith('.apk')) mimeType = 'application/vnd.android.package-archive';
            else if (lowerName.endsWith('.pdf')) mimeType = 'application/pdf';
            else if (lowerName.endsWith('.xlsx')) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            else if (lowerName.endsWith('.png')) mimeType = 'image/png';
            else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) mimeType = 'image/jpeg';

            await FileOpener.open({
                filePath: file.uri,
                contentType: mimeType,
                openWithDefault: true
            });
        } catch (error) {
            console.error("Error opening file:", error);
            setToast({ show: true, message: "Failed to open file. Device might not support this file type.", type: "error" });
        }
    };

    const handleDeleteFile = async (fileName) => {
        if (window.confirm(`Are you sure you want to delete ${fileName}?`)) {
            try {
                await Filesystem.deleteFile({
                    path: `downloads/${fileName}`,
                    directory: Directory.Data
                });
                setToast({ show: true, message: "File deleted successfully.", type: "success" });
                loadFiles(); // Refresh list
            } catch (error) {
                console.error("Error deleting file:", error);
                setToast({ show: true, message: "Failed to delete file.", type: "error" });
            }
        }
    };

    if (!Capacitor.isNativePlatform()) {
        return (
            <div className="space-y-4">
                <Button variant="secondary" onClick={onBack} className="mb-4 flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                <Card>
                    <EmptyState message="File management is only available on the Native App." />
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-20">
            <div className="flex items-center justify-between mb-4">
                <Button variant="secondary" onClick={onBack} className="flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                <Button onClick={loadFiles} variant="secondary" className="flex items-center gap-2" disabled={loading}>
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            <Card>
                <PageHeader title="Downloaded Files" subtitle="Manage APK updates and downloaded reports" />
                
                <div className="p-4">
                    {loading ? (
                        <div className="flex justify-center p-8"><Spinner /></div>
                    ) : files.length === 0 ? (
                        <EmptyState message="No downloaded files found on this device." />
                    ) : (
                        <div className="space-y-3">
                            {files.map((file, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                                    <div className="flex items-start gap-3 overflow-hidden">
                                        <div className="p-2 bg-sky-100 text-sky-600 rounded-lg shrink-0">
                                            {file.name.toLowerCase().endsWith('.apk') ? <HardDrive className="w-6 h-6" /> : <File className="w-6 h-6" />}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-semibold text-slate-800 text-sm truncate" title={file.name}>{file.name}</h4>
                                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                                <span>{formatBytes(file.size)}</span>
                                                <span>&bull;</span>
                                                <span>{new Date(file.mtime).toLocaleDateString()} {new Date(file.mtime).toLocaleTimeString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                        <button 
                                            onClick={() => handleOpenFile(file)}
                                            className="p-2 text-sky-600 hover:bg-sky-100 rounded-md transition-colors"
                                            title="Open File"
                                        >
                                            <ExternalLink className="w-5 h-5" />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteFile(file.name)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                            title="Delete File"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}