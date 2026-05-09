// src/components/AboutDeveloperPage.jsx
import React, { useState, useEffect } from 'react';
import { User, Users, Activity, Camera } from 'lucide-react';
import { Card, PageHeader, Spinner, Toast } from './CommonComponents';
import { uploadFile, updateAboutTeamImage } from '../data.js';
import { useDataCache } from '../DataContext';

const initialTeamData = [
    { id: 'main', name: 'Dr Qusay Mohamed Osman', title: 'Main Technical Developer', spec: 'Pediatric and Child Health Specialist', role: 'National Child Health Program Manager', type: 'main' },
    { id: 'rev1', name: 'Dr Hera Abdalla', title: 'Main Reviewer', spec: 'Oncology Specialist', role: 'Head of IMNCI Unit', type: 'reviewer' },
    { id: 'rev2', name: 'Dr Alaeldein Hamid', title: 'Main Reviewer', spec: 'Family Medicine Specialist', role: 'Head of Essential Newborn Unit', type: 'reviewer' },
    { id: 'rev3', name: 'Omran Mohamed Nour', title: 'Main Reviewer', spec: 'Public Health Specialist', role: 'Head of M & E Unit', type: 'reviewer' },
    { id: 'rev4', name: 'Eshtehar Suliman', title: 'Main Reviewer', spec: 'Statistician', role: 'IMNCI Unit', type: 'reviewer' }
];

export default function AboutDeveloperPage({ permissions }) {
    const { aboutTeamImages, fetchAboutTeamImages } = useDataCache();
    const [uploadingId, setUploadingId] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });

    // Fetch images from the cloud when the page loads
    useEffect(() => {
        if (fetchAboutTeamImages) fetchAboutTeamImages();
    }, [fetchAboutTeamImages]);

    // Merge the cloud images with our hardcoded team list
    const teamMembers = initialTeamData.map(member => ({
        ...member,
        imageUrl: aboutTeamImages?.[member.id] || null
    }));

    const handleImageUpload = async (e, id) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingId(id);
        try {
            // 1. Upload file to Firebase Storage
            const downloadUrl = await uploadFile(file);
            
            // 2. Save the new URL to Firestore Document
            await updateAboutTeamImage(id, downloadUrl);
            
            // 3. Force refresh the global cache to display the new image instantly
            if (fetchAboutTeamImages) await fetchAboutTeamImages(true); 

            setToast({ show: true, message: 'Image uploaded successfully!', type: 'success' });
        } catch (error) {
            console.error("Upload failed:", error);
            setToast({ show: true, message: 'Failed to upload image. Make sure you are online.', type: 'error' });
        } finally {
            setUploadingId(null);
        }
    };

    // Shared Profile Picture Renderer ensuring exact same size for Developer & Reviewers
    const ProfilePicture = ({ member }) => (
        <div className="relative shrink-0 w-32 h-32 group">
            <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center border-4 border-white shadow-md overflow-hidden relative">
                {uploadingId === member.id ? (
                    <Spinner />
                ) : member.imageUrl ? (
                    <img src={member.imageUrl} alt={member.name} className="object-cover w-full h-full" />
                ) : (
                    <User className="w-16 h-16 text-slate-300" />
                )}
                <div className="absolute inset-0 border-4 border-sky-100/50 rounded-full pointer-events-none"></div>
            </div>

            {/* Upload Image Overlay - Only visible if the user has Super User permissions */}
            {permissions?.canUseSuperUserAdvancedFeatures && (
                <label className="absolute bottom-0 right-0 bg-sky-600 hover:bg-sky-700 text-white p-2.5 rounded-full cursor-pointer shadow-lg transition-colors border-2 border-white" title="Upload Image">
                    <Camera className="w-4 h-4" />
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, member.id)} disabled={uploadingId === member.id} />
                </label>
            )}
        </div>
    );

    const mainDeveloper = teamMembers.find(m => m.type === 'main');
    const reviewers = teamMembers.filter(m => m.type === 'reviewer');

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ show: false, message: '', type: '' })} />}
            <Card>
                <PageHeader title="About the Team" subtitle="National Child Health Program Monitoring System" />
                <div className="p-6 sm:p-10">
                    
                    {/* Main Developer (Horizontal Layout) */}
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 mb-12 border-b border-slate-200 pb-10">
                        {mainDeveloper && <ProfilePicture member={mainDeveloper} />}
                        
                        {mainDeveloper && (
                            <div className="text-center sm:text-start pt-2">
                                <h2 className="text-3xl font-bold text-slate-800">{mainDeveloper.name}</h2>
                                <h3 className="text-xl font-bold text-sky-600 mt-1.5">{mainDeveloper.title}</h3>
                                <div className="mt-4 space-y-1.5 text-slate-600 font-medium">
                                    <p className="flex items-center justify-center sm:justify-start gap-2">
                                        <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0"></span>
                                        {mainDeveloper.spec}
                                    </p>
                                    <p className="flex items-center justify-center sm:justify-start gap-2">
                                        <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0"></span>
                                        {mainDeveloper.role}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Reviewers Section */}
                    <div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-6 flex items-center justify-center sm:justify-start gap-3 border-b-2 border-sky-100 inline-flex pb-2">
                            <Users className="w-7 h-7 text-sky-500" />
                            Main Reviewers
                        </h3>
                        
                        {/* Grid for Reviewers (Horizontal cards inside the grid) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
                            {reviewers.map(member => (
                                <div key={member.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row items-center sm:items-start gap-5">
                                    <ProfilePicture member={member} />
                                    
                                    <div className="text-center sm:text-start w-full">
                                        <h4 className="text-lg font-bold text-slate-800 leading-tight">{member.name}</h4>
                                        <p className="text-[11px] font-bold text-sky-500 uppercase tracking-wider mt-1">{member.title}</p>
                                        
                                        <div className="mt-3 space-y-1.5">
                                            <p className="text-sm text-slate-600 font-medium">{member.spec}</p>
                                            <p className="text-sm text-slate-500 flex items-center justify-center sm:justify-start gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100 inline-flex mt-1">
                                                <Activity className="w-3.5 h-3.5 text-sky-500" /> 
                                                <span className="font-semibold">{member.role}</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </Card>
        </div>
    );
}