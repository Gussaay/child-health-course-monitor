// src/components/MeetingTrackerView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { amiriFontBase64 } from './AmiriFont.js';

import { Card, CardBody, Button, Modal, Input, FormGroup, Select, PageHeader, Table, EmptyState, Spinner } from './CommonComponents';
import { upsertUnitMeeting, deleteUnitMeeting } from '../data';
import { useDataCache } from '../DataContext';
import { 
    Users, Baby, Stethoscope, Activity, Package, HeartPulse, 
    Calendar, Edit, Trash2, Plus, Download, UserPlus, BarChart2
} from 'lucide-react';

const PROGRAM_UNITS_DATA = [
    { id: "Neonatal Health Unit", title: "Neonatal Health", icon: Baby, color: "text-blue-500", bg: "bg-blue-100" },
    { id: "IMNCI unit", title: "IMNCI", icon: Stethoscope, color: "text-green-500", bg: "bg-green-100" },
    { id: "Adolescent unit", title: "Adolescent Health", icon: Users, color: "text-purple-500", bg: "bg-purple-100" },
    { id: "Monitoring and evaluation", title: "Monitoring & Eval (M&E)", icon: Activity, color: "text-orange-500", bg: "bg-orange-100" },
    { id: "Supply", title: "Supply & Logistics", icon: Package, color: "text-amber-500", bg: "bg-amber-100" },
    { id: "Health promotion", title: "Health Promotion", icon: HeartPulse, color: "text-rose-500", bg: "bg-rose-100" }
];

const getInviteeDetails = (baseName, allTeamMembers) => {
    const member = allTeamMembers.find(m => m.name === baseName);
    if (member) {
        return {
            name: baseName,
            displayName: member.nameAr || member.name,
            position: member.role || (member.jobTitle === 'اخرى' ? member.jobTitleOther : member.jobTitle) || 'Unspecified'
        };
    }
    return { name: baseName, displayName: baseName, position: 'Unknown' };
};

const getStatusDetails = (attended, totalSessions) => {
    if (totalSessions === 0) return { text: '-', textAr: '-', class: 'bg-gray-100 text-gray-800' };
    const percentage = (attended / totalSessions) * 100;
    if (percentage === 100) return { text: 'Excellent', textAr: 'ممتاز', class: 'bg-green-100 text-green-800' };
    if (percentage >= 80) return { text: 'Adequate', textAr: 'جيد', class: 'bg-yellow-100 text-yellow-800' };
    if (percentage >= 50) return { text: 'Poor', textAr: 'ضعيف', class: 'bg-orange-100 text-orange-800' };
    return { text: 'Not Accepted', textAr: 'غير مقبول', class: 'bg-red-100 text-red-800' };
};

export default function MeetingTrackerView({ permissions }) {
    const { 
        unitMeetings: rawMeetings, 
        fetchUnitMeetings, 
        isLoading, 
        federalCoordinators 
    } = useDataCache();
    
    const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' or 'entry'
    const [selectedUnit, setSelectedUnit] = useState('');
    const [selectedMeetingId, setSelectedMeetingId] = useState('');
    const [newMeetingTitle, setNewMeetingTitle] = useState('');
    const [activeMeeting, setActiveMeeting] = useState(null);
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);
    
    const allTeamMembers = useMemo(() => {
        return (federalCoordinators || []).filter(c => c.isDeleted !== true && c.isDeleted !== "true").map(c => ({ ...c, _level: 'federal' })).sort((a, b) => (a.nameAr || a.name).localeCompare(b.nameAr || b.name));
    }, [federalCoordinators]);

    const meetings = useMemo(() => {
        return (rawMeetings || [])
            .filter(m => m.unit === selectedUnit && m.isDeleted !== true && m.isDeleted !== "true")
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }, [rawMeetings, selectedUnit]);

    useEffect(() => {
        fetchUnitMeetings();
    }, [fetchUnitMeetings]);

    const handleCreateMeeting = async (e) => {
        e.preventDefault();
        if (!newMeetingTitle.trim() || !selectedUnit) return;
        const payload = { 
            title: newMeetingTitle, unit: selectedUnit, 
            schedule: '', inviter: '', invitees: [], guests: [], agenda: '', link: '', place: '', 
            sessionDates: [], attendance: {}, reports: {} 
        };
        const newMeetingRef = await upsertUnitMeeting(payload);
        await fetchUnitMeetings(true);
        setSelectedMeetingId(newMeetingRef?.id || '');
        setActiveMeeting(payload);
        setNewMeetingTitle('');
    };

    const handleUpdateActiveMeeting = async (updatedMeetingData) => {
        try {
            const map = updatedMeetingData.inviteeNamesMap || {};
            (updatedMeetingData.invitees || []).forEach(inv => {
                if (!map[inv]) {
                    const m = allTeamMembers.find(x => x.name === inv);
                    map[inv] = m?.nameAr || m?.name || inv;
                }
            });
            updatedMeetingData.inviteeNamesMap = map;
            updatedMeetingData.inviterNameAr = allTeamMembers.find(x => x.name === updatedMeetingData.inviter)?.nameAr || updatedMeetingData.inviter;

            await upsertUnitMeeting(updatedMeetingData);
            fetchUnitMeetings(true); 
            setActiveMeeting(updatedMeetingData);
        } catch (error) {
            console.error("Error updating meeting details", error);
        }
    };

    const handleToggleAttendance = (invitee, date) => {
        const currentAtt = activeMeeting.attendance || {};
        const inviteeAtt = currentAtt[invitee] || [];
        
        let newInviteeAtt = inviteeAtt.includes(date) 
            ? inviteeAtt.filter(d => d !== date) 
            : [...inviteeAtt, date];

        handleUpdateActiveMeeting({
            ...activeMeeting,
            attendance: { ...currentAtt, [invitee]: newInviteeAtt }
        });
    };

    if (isLoading.unitMeetings) return <Spinner />;

    return (
        <div className="space-y-6">
            <PageHeader title="Federal Meeting Tracker" subtitle="Manage meeting series, schedules, and attendance tracking." />

            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-max mb-4 border border-gray-200">
                <Button variant={viewMode === 'dashboard' ? 'primary' : 'ghost'} onClick={() => setViewMode('dashboard')}>
                    <BarChart2 className="w-4 h-4 mr-2" /> Dashboard Overview
                </Button>
                <Button variant={viewMode === 'entry' ? 'primary' : 'ghost'} onClick={() => { setViewMode('entry'); setSelectedMeetingId(''); setActiveMeeting(null); }}>
                    <Edit className="w-4 h-4 mr-2" /> Data Entry
                </Button>
            </div>

            {viewMode === 'dashboard' ? (
                <Card>
                    <CardBody className="p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                            <Users className="text-sky-600" /> Federal Meetings Overview
                        </h3>
                        {rawMeetings?.length === 0 ? (
                            <EmptyState message="No meetings recorded across units." />
                        ) : (
                            <Table headers={["Meeting Title", "Unit", "Schedule", "Attendees", "Sessions"]}>
                                {(rawMeetings || []).filter(m => !m.isDeleted).map(m => (
                                    <tr key={m.id} className="hover:bg-gray-50">
                                        <td className="p-3 border font-medium">{m.title}</td>
                                        <td className="p-3 border text-sm">{PROGRAM_UNITS_DATA.find(u => u.id === m.unit)?.title || m.unit}</td>
                                        <td className="p-3 border text-sm text-gray-600">{m.schedule || 'Not specified'}</td>
                                        <td className="p-3 border text-sm text-gray-600 font-bold">{(m.invitees?.length || 0) + (m.guests?.length || 0)}</td>
                                        <td className="p-3 border text-sm text-gray-600 font-bold">{m.sessionDates?.length || 0}</td>
                                    </tr>
                                ))}
                            </Table>
                        )}
                    </CardBody>
                </Card>
            ) : (
                <Card>
                    <CardBody className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded border border-gray-200">
                            <FormGroup label="Select Program Unit">
                                <Select value={selectedUnit} onChange={(e) => { setSelectedUnit(e.target.value); setSelectedMeetingId(''); setActiveMeeting(null); }}>
                                    <option value="">-- Choose Unit --</option>
                                    {PROGRAM_UNITS_DATA.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
                                </Select>
                            </FormGroup>
                            
                            {selectedUnit && (
                                <FormGroup label="Select or Add Meeting">
                                    <Select value={selectedMeetingId} onChange={(e) => { 
                                        setSelectedMeetingId(e.target.value); 
                                        setActiveMeeting(meetings.find(m => m.id === e.target.value) || null); 
                                    }}>
                                        <option value="">-- Choose Meeting --</option>
                                        {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                                        <option value="NEW" className="font-bold text-sky-600">+ Add New Meeting</option>
                                    </Select>
                                </FormGroup>
                            )}
                        </div>

                        {selectedMeetingId === 'NEW' && (
                            <div className="bg-sky-50 p-4 rounded border border-sky-200 flex gap-4 items-end animate-in">
                                <FormGroup label="New Meeting Title" className="flex-1">
                                    <Input value={newMeetingTitle} onChange={(e) => setNewMeetingTitle(e.target.value)} placeholder="e.g., Q3 Federal Strategy Review" />
                                </FormGroup>
                                <Button onClick={handleCreateMeeting} disabled={!newMeetingTitle.trim()}>Create Meeting</Button>
                            </div>
                        )}

                        {activeMeeting && (
                            <div className="space-y-6 animate-in">
                                <div className="p-4 border rounded-lg shadow-sm border-l-4 border-l-indigo-500">
                                    <h4 className="font-bold text-gray-800 border-b pb-2 mb-4">Meeting Settings</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <FormGroup label="Schedule / Frequency">
                                            <Input value={activeMeeting.schedule || ''} onChange={(e) => handleUpdateActiveMeeting({...activeMeeting, schedule: e.target.value})} placeholder="e.g., Weekly Mondays"/>
                                        </FormGroup>
                                        <FormGroup label="Location">
                                            <Input value={activeMeeting.place || ''} onChange={(e) => handleUpdateActiveMeeting({...activeMeeting, place: e.target.value})} placeholder="Room / Link"/>
                                        </FormGroup>
                                        <FormGroup label="Inviter">
                                            <Select value={activeMeeting.inviter || ''} onChange={(e) => handleUpdateActiveMeeting({...activeMeeting, inviter: e.target.value})}>
                                                <option value="">-- Select --</option>
                                                {allTeamMembers.map(t=><option key={t.id} value={t.name}>{t.nameAr || t.name}</option>)}
                                            </Select>
                                        </FormGroup>
                                    </div>
                                </div>

                                <div className="p-4 border rounded-lg shadow-sm border-l-4 border-l-green-500">
                                    <div className="flex justify-between items-center border-b pb-2 mb-4">
                                        <h4 className="font-bold text-gray-800 flex items-center gap-2"><Calendar className="w-4 h-4"/> Attendance Tracking</h4>
                                        <Button size="sm" onClick={() => {
                                            const newDate = window.prompt("Enter new session date (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
                                            if (newDate && !activeMeeting.sessionDates?.includes(newDate)) {
                                                handleUpdateActiveMeeting({ ...activeMeeting, sessionDates: [...(activeMeeting.sessionDates || []), newDate].sort() });
                                            }
                                        }}>+ Add Session Date</Button>
                                    </div>
                                    
                                    {activeMeeting.sessionDates?.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm border-collapse">
                                                <thead className="bg-gray-100 text-gray-600">
                                                    <tr>
                                                        <th className="p-3 border font-semibold">Invitee Name</th>
                                                        {activeMeeting.sessionDates.map(date => (
                                                            <th key={date} className="p-3 border font-semibold text-center text-xs">{date}</th>
                                                        ))}
                                                        <th className="p-3 border font-semibold text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(activeMeeting.invitees || []).map(inv => {
                                                        const detail = getInviteeDetails(inv, allTeamMembers);
                                                        const inviteeAtt = activeMeeting.attendance?.[inv] || [];
                                                        const status = getStatusDetails(inviteeAtt.length, activeMeeting.sessionDates.length);
                                                        return (
                                                            <tr key={inv} className="border-b">
                                                                <td className="p-3 border font-medium">{detail.displayName}</td>
                                                                {activeMeeting.sessionDates.map(date => (
                                                                    <td key={date} className="p-3 border text-center">
                                                                        <input 
                                                                            type="checkbox" checked={inviteeAtt.includes(date)} 
                                                                            onChange={() => handleToggleAttendance(inv, date)}
                                                                            className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
                                                                        />
                                                                    </td>
                                                                ))}
                                                                <td className="p-3 border text-center"><span className={`px-2 py-1 rounded text-xs ${status.class}`}>{status.text}</span></td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <EmptyState message="No sessions recorded yet." />
                                    )}
                                </div>
                            </div>
                        )}
                    </CardBody>
                </Card>
            )}
        </div>
    );
}