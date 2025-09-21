// src/components/ShareModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Spinner } from './CommonComponents';

const ShareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" /></svg>;
const LinkIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>;

export function ShareModal({ isOpen, onClose, shareableItem, shareType = 'course', onSave }) {
    const [accessLevel, setAccessLevel] = useState('private');
    const [sharedWith, setSharedWith] = useState([]);
    const [emailInput, setEmailInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [copySuccess, setCopySuccess] = useState('');

    useEffect(() => {
        if (shareableItem) {
            setAccessLevel(shareableItem.isPublic ? 'public' : 'private');
            setSharedWith(shareableItem.sharedWith || []);
        }
    }, [shareableItem]);

    const handleAddEmail = () => {
        const email = emailInput.trim().toLowerCase();
        if (email && !sharedWith.includes(email) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setSharedWith([...sharedWith, email]);
            setEmailInput('');
        }
    };

    const handleRemoveEmail = (emailToRemove) => {
        setSharedWith(sharedWith.filter(email => email !== emailToRemove));
    };

    const handleSave = async () => {
        setIsSaving(true);
        const settings = {
            isPublic: accessLevel === 'public',
            sharedWith: accessLevel === 'private' ? sharedWith : []
        };
        try {
            await onSave(shareableItem.id, settings);
            setCopySuccess(''); // Reset copy message on save
        } catch (error) {
            console.error("Failed to save sharing settings:", error);
        } finally {
            setIsSaving(false);
            onClose();
        }
    };
    
    const handleCopyLink = () => {
        const shareUrl = `${window.location.origin}/shared/${shareType}-report/${shareableItem.id}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            setCopySuccess('Link copied to clipboard!');
            setTimeout(() => setCopySuccess(''), 2000);
        }).catch(err => {
            setCopySuccess('Failed to copy link.');
        });
    };

    if (!shareableItem) return null;

    const isCourse = shareType === 'course';
    const reportName = isCourse ? `${shareableItem.course_type} - ${shareableItem.state}` : shareableItem.name;
    const modalTitle = `Share ${isCourse ? 'Course' : 'Participant'} Report`;


    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
            <div className="p-6 space-y-6">
                <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 bg-sky-100 p-3 rounded-full">
                        <ShareIcon />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800">{reportName}</h3>
                        <p className="text-sm text-gray-500">Manage access permissions for this report.</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="font-semibold text-gray-700">General Access</label>
                    <div className="flex space-x-4">
                        <label className="flex items-center space-x-2">
                            <input
                                type="radio"
                                name="accessLevel"
                                value="private"
                                checked={accessLevel === 'private'}
                                onChange={() => setAccessLevel('private')}
                                className="form-radio text-sky-600"
                            />
                            <span>Restricted</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input
                                type="radio"
                                name="accessLevel"
                                value="public"
                                checked={accessLevel === 'public'}
                                onChange={() => setAccessLevel('public')}
                                className="form-radio text-sky-600"
                            />
                            <span>Anyone with the link</span>
                        </label>
                    </div>
                </div>

                {accessLevel === 'private' && (
                    <div className="space-y-4">
                        <label className="font-semibold text-gray-700">Share with specific people</label>
                        <div className="flex space-x-2">
                            <Input
                                type="email"
                                placeholder="Enter email address"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                className="flex-grow"
                            />
                            <Button onClick={handleAddEmail}>Add</Button>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {sharedWith.map(email => (
                                <div key={email} className="flex justify-between items-center bg-gray-100 p-2 rounded">
                                    <span className="text-sm text-gray-700">{email}</span>
                                    <button onClick={() => handleRemoveEmail(email)} className="text-red-500 hover:text-red-700 font-bold">&times;</button>
                                </div>
                            ))}
                            {sharedWith.length === 0 && <p className="text-sm text-gray-500 text-center py-2">Not shared with anyone yet.</p>}
                        </div>
                    </div>
                )}
                
                <div className="pt-4 border-t">
                     <div className="flex items-center justify-between">
                        <Button onClick={handleCopyLink} variant="secondary">
                            <LinkIcon /> {copySuccess ? copySuccess : "Copy Link"}
                        </Button>
                        <div className="flex space-x-2">
                            <Button variant="secondary" onClick={onClose}>Cancel</Button>
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving ? <Spinner /> : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}