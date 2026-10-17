// src/components/MeetingTrackerView.jsx
import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { amiriFontBase64 } from './AmiriFont.js';

import { Card, CardBody, Button, Modal, Input, FormGroup, Select, PageHeader, Table, EmptyState, Spinner, PageTabs } from './CommonComponents';
import { upsertUnitMeeting, deleteUnitMeeting } from '../data';
import { useDataCache } from '../DataContext';
import { promptDialog } from './dialogs';
import { useTranslation } from 'react-i18next';
import { 
    Users, Baby, Stethoscope, Activity, Package, HeartPulse, 
    Calendar, Edit, Trash2, Plus, Download, UserPlus, BarChart2
} from 'lucide-react';

const PROGRAM_UNITS_DATA = [
    { id: "Neonatal Health Unit", key: "neonatal", title: "Neonatal Health", icon: Baby, color: "text-blue-500", bg: "bg-blue-100" },
    { id: "IMNCI unit", key: "imnci", title: "IMNCI", icon: Stethoscope, color: "text-green-500", bg: "bg-green-100" },
    { id: "Adolescent unit", key: "adolescent", title: "Adolescent Health", icon: Users, color: "text-purple-500", bg: "bg-purple-100" },
    { id: "Monitoring and evaluation", key: "me", title: "Monitoring & Eval (M&E)", icon: Activity, color: "text-orange-500", bg: "bg-orange-100" },
    { id: "Supply", key: "supply", title: "Supply & Logistics", icon: Package, color: "text-amber-500", bg: "bg-amber-100" },
    { id: "Health promotion", key: "promotion", title: "Health Promotion", icon: HeartPulse, color: "text-rose-500", bg: "bg-rose-100" }
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
    if (totalSessions === 0) return { key: null, text: '-', textAr: '-', class: 'bg-gray-100 text-gray-800' };
    const percentage = (attended / totalSessions) * 100;
    if (percentage === 100) return { key: 'excellent', text: 'Excellent', textAr: 'ممتاز', class: 'bg-green-100 text-green-800' };
    if (percentage >= 80) return { key: 'adequate', text: 'Adequate', textAr: 'جيد', class: 'bg-yellow-100 text-yellow-800' };
    if (percentage >= 50) return { key: 'poor', text: 'Poor', textAr: 'ضعيف', class: 'bg-orange-100 text-orange-800' };
    return { key: 'not_accepted', text: 'Not Accepted', textAr: 'غير مقبول', class: 'bg-red-100 text-red-800' };
};

const DeletedItemsPanel = lazy(() => import('./DeletedItemsPanel.jsx'));

export default function MeetingTrackerView({ permissions }) {
    const { t } = useTranslation();
    const unitTitle = (u) => t(`trackers.meetings.units.${u.key}`, u.title);
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
            <PageHeader title={t('trackers.meetings.title', 'Federal Meeting Tracker')} subtitle={t('trackers.meetings.subtitle', 'Manage meeting series, schedules, and attendance tracking.')} />

            <PageTabs
                active={viewMode}
                onChange={(id) => { setViewMode(id); if (id === 'entry') { setSelectedMeetingId(''); setActiveMeeting(null); } }}
                tabs={[
                    { id: 'dashboard', label: t('trackers.meetings.tabs.dashboard', 'Dashboard Overview'), short: t('ui.short.dashboard', 'Dashboard'), icon: BarChart2 },
                    { id: 'entry', label: t('trackers.meetings.tabs.entry', 'Data Entry'), short: t('ui.short.entry', 'Entry'), icon: Edit },
                    { id: 'deleted', label: t('trackers.meetings.tabs.deleted', 'Deleted Items'), short: t('ui.short.deleted', 'Deleted') },
                ]}
            />

            {viewMode === 'deleted' ? (
                <Suspense fallback={<Spinner />}>
                    <DeletedItemsPanel types={['unitMeetings']} />
                </Suspense>
            ) : viewMode === 'dashboard' ? (
                <Card>
                    <CardBody className="p-3 md:p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                            <Users className="text-sky-600" /> {t('trackers.meetings.overview', 'Federal Meetings Overview')}
                        </h3>
                        {rawMeetings?.length === 0 ? (
                            <EmptyState message={t('trackers.meetings.no_meetings', 'No meetings recorded across units.')} />
                        ) : (
                            <Table headers={[t('trackers.meetings.table.title', 'Meeting Title'), t('trackers.meetings.table.unit', 'Unit'), t('trackers.meetings.table.schedule', 'Schedule'), t('trackers.meetings.table.attendees', 'Attendees'), t('trackers.meetings.table.sessions', 'Sessions')]} cardsOnPhone>
                                {(rawMeetings || []).filter(m => !m.isDeleted).map(m => (
                                    <tr key={m.id} className="hover:bg-gray-50">
                                        <td className="p-3 border font-medium">{m.title}</td>
                                        <td className="p-3 border text-sm">{(() => { const u = PROGRAM_UNITS_DATA.find(x => x.id === m.unit); return u ? unitTitle(u) : m.unit; })()}</td>
                                        <td className="p-3 border text-sm text-gray-600">{m.schedule || t('trackers.meetings.not_specified', 'Not specified')}</td>
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
                    <CardBody className="p-3 md:p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-3 md:p-4 rounded border border-gray-200">
                            <FormGroup label={t('trackers.meetings.select_unit', 'Select Program Unit')}>
                                <Select value={selectedUnit} onChange={(e) => { setSelectedUnit(e.target.value); setSelectedMeetingId(''); setActiveMeeting(null); }}>
                                    <option value="">{t('trackers.meetings.choose_unit', '-- Choose Unit --')}</option>
                                    {PROGRAM_UNITS_DATA.map(u => <option key={u.id} value={u.id}>{unitTitle(u)}</option>)}
                                </Select>
                            </FormGroup>
                            
                            {selectedUnit && (
                                <FormGroup label={t('trackers.meetings.select_meeting', 'Select or Add Meeting')}>
                                    <Select value={selectedMeetingId} onChange={(e) => { 
                                        setSelectedMeetingId(e.target.value); 
                                        setActiveMeeting(meetings.find(m => m.id === e.target.value) || null); 
                                    }}>
                                        <option value="">{t('trackers.meetings.choose_meeting', '-- Choose Meeting --')}</option>
                                        {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                                        <option value="NEW" className="font-bold text-sky-600">{t('trackers.meetings.add_new_meeting', '+ Add New Meeting')}</option>
                                    </Select>
                                </FormGroup>
                            )}
                        </div>

                        {selectedMeetingId === 'NEW' && (
                            <div className="bg-sky-50 p-4 rounded border border-sky-200 flex gap-4 items-end animate-in">
                                <FormGroup label={t('trackers.meetings.new_title', 'New Meeting Title')} className="flex-1">
                                    <Input value={newMeetingTitle} onChange={(e) => setNewMeetingTitle(e.target.value)} placeholder={t('trackers.meetings.new_title_ph', 'e.g., Q3 Federal Strategy Review')} />
                                </FormGroup>
                                <Button onClick={handleCreateMeeting} disabled={!newMeetingTitle.trim()}>{t('trackers.meetings.create', 'Create Meeting')}</Button>
                            </div>
                        )}

                        {activeMeeting && (
                            <div className="space-y-6 animate-in">
                                <div className="p-3 md:p-4 border rounded-lg shadow-sm border-l-4 border-l-indigo-500">
                                    <h4 className="font-bold text-gray-800 border-b pb-2 mb-4">{t('trackers.meetings.settings', 'Meeting Settings')}</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <FormGroup label={t('trackers.meetings.schedule_freq', 'Schedule / Frequency')}>
                                            <Input value={activeMeeting.schedule || ''} onChange={(e) => handleUpdateActiveMeeting({...activeMeeting, schedule: e.target.value})} placeholder={t('trackers.meetings.schedule_ph', 'e.g., Weekly Mondays')}/>
                                        </FormGroup>
                                        <FormGroup label={t('trackers.meetings.location', 'Location')}>
                                            <Input value={activeMeeting.place || ''} onChange={(e) => handleUpdateActiveMeeting({...activeMeeting, place: e.target.value})} placeholder={t('trackers.meetings.location_ph', 'Room / Link')}/>
                                        </FormGroup>
                                        <FormGroup label={t('trackers.meetings.inviter', 'Inviter')}>
                                            <Select value={activeMeeting.inviter || ''} onChange={(e) => handleUpdateActiveMeeting({...activeMeeting, inviter: e.target.value})}>
                                                <option value="">{t('trackers.meetings.select', '-- Select --')}</option>
                                                {allTeamMembers.map(tm=><option key={tm.id} value={tm.name}>{tm.nameAr || tm.name}</option>)}
                                            </Select>
                                        </FormGroup>
                                    </div>
                                </div>

                                <div className="p-3 md:p-4 border rounded-lg shadow-sm border-l-4 border-l-green-500">
                                    <div className="flex justify-between items-center border-b pb-2 mb-4">
                                        <h4 className="font-bold text-gray-800 flex items-center gap-2"><Calendar className="w-4 h-4"/> {t('trackers.meetings.attendance', 'Attendance Tracking')}</h4>
                                        <Button size="sm" onClick={async () => {
                                            const newDate = await promptDialog(t('trackers.meetings.session_date', 'Session date'), { title: t('trackers.meetings.add_session_date_title', 'Add a session date'), defaultValue: new Date().toISOString().split('T')[0], inputType: "date" });
                                            if (newDate && !activeMeeting.sessionDates?.includes(newDate)) {
                                                handleUpdateActiveMeeting({ ...activeMeeting, sessionDates: [...(activeMeeting.sessionDates || []), newDate].sort() });
                                            }
                                        }}>{t('trackers.meetings.add_session_date', '+ Add Session Date')}</Button>
                                    </div>
                                    
                                    {activeMeeting.sessionDates?.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-start text-sm border-collapse">
                                                <thead className="bg-gray-100 text-gray-600">
                                                    <tr>
                                                        <th className="p-3 border font-semibold">{t('trackers.meetings.invitee_name', 'Invitee Name')}</th>
                                                        {activeMeeting.sessionDates.map(date => (
                                                            <th key={date} className="p-3 border font-semibold text-center text-xs">{date}</th>
                                                        ))}
                                                        <th className="p-3 border font-semibold text-center">{t('trackers.meetings.status_col', 'Status')}</th>
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
                                                                <td className="p-3 border text-center"><span className={`px-2 py-1 rounded text-xs ${status.class}`}>{status.key ? t(`trackers.meetings.status.${status.key}`, status.text) : status.text}</span></td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <EmptyState message={t('trackers.meetings.no_sessions', 'No sessions recorded yet.')} />
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