// components/CourseAttendanceView.jsx
import React, { useState, useMemo, useEffect } from 'react';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
    Button, Spinner, Card, PageHeader, EmptyState, Input 
} from './CommonComponents'; 
import { 
    listAllParticipantsForCourse, getCourseById 
} from '../data.js'; 
import { db } from '../firebase';
import { updateDoc, doc, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore';
import { Download, X, Clock, CheckCircle, Trash2, Edit2, PlusCircle, Search } from 'lucide-react'; 
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { amiriFontBase64 } from './AmiriFont.js';

// --- Helper Functions ---

const getCourseDates = (startDate, duration) => {
    if (!startDate || !duration) return [];
    const dates = [];
    const start = new Date(startDate);
    for (let i = 0; i < duration; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
};

const getStatusDetails = (attended, totalSessions) => {
    if (totalSessions === 0) return { text: '-', class: 'bg-gray-100 text-gray-800 border-gray-200' };
    
    const percentage = (attended / totalSessions) * 100;
    
    if (percentage === 100) {
        return { text: 'Excellent', class: 'bg-green-100 text-green-800 border-green-200' };
    } else if (percentage >= 80) {
        return { text: 'Adequate', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    } else if (percentage >= 50) {
        return { text: 'Poor', class: 'bg-orange-100 text-orange-800 border-orange-200' };
    } else {
        return { text: 'Not Accepted', class: 'bg-red-100 text-red-800 border-red-200' };
    }
};

const generateAttendanceReportPdf = async (course, participants, columns, onSuccess, onError) => {
    try {
        const doc = new jsPDF('landscape'); 
        
        // --- Add Arabic Font Support ---
        doc.addFileToVFS('Amiri-Regular.ttf', amiriFontBase64);
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        doc.setFont('Amiri');
        
        const pageWidth = doc.internal.pageSize.getWidth();

        // Determine Facility for Title & Filename
        const uniqueFacilities = [...new Set(participants.map(p => p.center_name || p.health_facility).filter(Boolean))];
        const facilityDisplay = uniqueFacilities.length === 1 ? uniqueFacilities[0] : (uniqueFacilities.length > 1 ? 'Multiple Facilities' : 'No Facility');
        
        // --- FIX: Extract Subcourse from facilitatorAssignments ---
        let subCourseName = '';
        if (course.facilitatorAssignments && course.facilitatorAssignments.length > 0) {
            // Get unique subcourses from the assignments
            const subcourses = [...new Set(course.facilitatorAssignments.map(a => a.imci_sub_type).filter(Boolean))];
            if (subcourses.length > 0) {
                subCourseName = subcourses.join(' / ');
            }
        }
        
        // Fallback: Check participants if assignments are empty
        if (!subCourseName && participants.some(p => p.imci_sub_type)) {
            const pSubcourses = [...new Set(participants.map(p => p.imci_sub_type).filter(Boolean))];
            subCourseName = pSubcourses.join(' / ');
        }

        const courseDisplay = subCourseName && subCourseName !== course.course_type 
            ? `${course.course_type} - ${subCourseName}` 
            : course.course_type;

        // --- Large Centered Header ---
        const headerTitle = `${courseDisplay} - ${course.state || ''} - ${facilityDisplay}`;

        doc.setFontSize(18);
        doc.setTextColor(40); 
        doc.text(headerTitle, pageWidth / 2, 20, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Attendance Report | Start Date: ${course.start_date || '-'} | Locality: ${course.locality || '-'}`, pageWidth / 2, 28, { align: 'center' });
        
        // Create headers combining Session number and Date
        const dateHeaders = columns.map((date, index) => `S${index + 1}\n${date}`);
        
        // Removed 'State' and 'Group'
        const headRow = [['#', 'Name', 'Facility', ...dateHeaders, 'Total', 'Status']];

        // Sort by attendance count descending, then alphabetically
        const sortedParticipants = [...participants].sort((a, b) => {
            const countA = a.attendance ? a.attendance.length : 0;
            const countB = b.attendance ? b.attendance.length : 0;
            if (countB !== countA) {
                return countB - countA; // Highest first
            }
            return a.name.localeCompare(b.name);
        });

        const tableData = sortedParticipants.map((p, index) => {
            const row = [
                index + 1,
                p.name, 
                p.center_name || p.health_facility || '-', 
            ];
            
            columns.forEach(date => {
                const isPresent = p.attendance && p.attendance.includes(date);
                row.push(isPresent ? 'PRESENT' : 'ABSENT');
            });

            const daysCount = p.attendance ? p.attendance.length : 0;
            const totalSessions = columns.length;
            const percentage = totalSessions > 0 ? Math.round((daysCount / totalSessions) * 100) : 0;
            
            // Output Total with Percentage
            row.push(`${daysCount} (${percentage}%)`);
            
            // Generate Text Status for PDF
            const status = getStatusDetails(daysCount, totalSessions).text;
            row.push(status);

            return row;
        });

        autoTable(doc, {
            head: headRow,
            body: tableData,
            startY: 34, // Adjusted starting Y to account for centered header
            theme: 'grid',
            headStyles: { 
                font: 'Amiri', 
                fillColor: [22, 163, 74], 
                textColor: 255,
                halign: 'center',
                fontSize: 9,
                cellPadding: 2
            },
            styles: { 
                font: 'Amiri', 
                fontSize: 8, 
                cellPadding: 1.5, 
                valign: 'middle',
                lineColor: [200, 200, 200],
                lineWidth: 0.1,
                overflow: 'ellipsize'
            },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
                1: { cellWidth: 50, halign: 'left' },
                2: { cellWidth: 40, halign: 'left' },
            },
            didParseCell: function (data) {
                data.cell.styles.font = 'Amiri'; 
                
                // Shifted indices down by 2 because 'State' and 'Group' were removed
                const dateColumnStartIndex = 3; 
                const dateColumnEndIndex = 3 + columns.length; 

                if (data.section === 'body' && data.column.index >= dateColumnStartIndex && data.column.index < dateColumnEndIndex) {
                    data.cell.rawStatus = data.cell.raw; 
                    data.cell.text = ''; 
                }
                
                // Style for Total column
                if (data.section === 'body' && data.column.index === dateColumnEndIndex) {
                    data.cell.styles.halign = 'center';
                    data.cell.styles.fontStyle = 'bold';
                }
                
                // Style for Status column
                if (data.section === 'body' && data.column.index === dateColumnEndIndex + 1) {
                    data.cell.styles.halign = 'center';
                    data.cell.styles.fontStyle = 'bold';
                    
                    // Add text color based on status
                    const text = data.cell.raw;
                    if (text === 'Excellent') data.cell.styles.textColor = [22, 163, 74]; // Green
                    else if (text === 'Adequate') data.cell.styles.textColor = [202, 138, 4]; // Yellow
                    else if (text === 'Poor') data.cell.styles.textColor = [234, 88, 12]; // Orange
                    else if (text === 'Not Accepted') data.cell.styles.textColor = [220, 38, 38]; // Red
                }
            },
            didDrawCell: function (data) {
                if (data.cell.rawStatus) {
                    const cx = data.cell.x + data.cell.width / 2;
                    const cy = data.cell.y + data.cell.height / 2;
                    
                    if (data.cell.rawStatus === 'PRESENT') {
                        doc.setDrawColor(22, 163, 74); 
                        doc.setLineWidth(0.5);
                        doc.line(cx - 1.5, cy, cx - 0.5, cy + 1.5);
                        doc.line(cx - 0.5, cy + 1.5, cx + 2, cy - 1.5);
                    } else if (data.cell.rawStatus === 'ABSENT') {
                        doc.setDrawColor(220, 38, 38); 
                        doc.setLineWidth(0.5);
                        const s = 1.2; 
                        doc.line(cx - s, cy - s, cx + s, cy + s);
                        doc.line(cx + s, cy - s, cx - s, cy + s);
                    }
                }
            }
        });

        // --- Generate Dynamic Filename ---
        // Helper to replace spaces with underscores and remove invalid file path characters
        const sanitizeForFilename = (str) => (str || '').toString().replace(/[\/\\]/g, '-').replace(/\s+/g, '_');
        
        const safeCourseDisplay = sanitizeForFilename(courseDisplay);
        const safeState = sanitizeForFilename(course.state);
        const safeFacility = sanitizeForFilename(facilityDisplay);
        const safeDate = sanitizeForFilename(course.start_date);
        
        const fileName = `${safeCourseDisplay}-${safeState}-${safeFacility}-${safeDate}.pdf`;
        
        if (Capacitor.isNativePlatform()) {
            const base64Data = doc.output('datauristring').split('base64,')[1];
            const writeResult = await Filesystem.writeFile({ path: fileName, data: base64Data, directory: Directory.Downloads });
            await FileOpener.open({ filePath: writeResult.uri, contentType: 'application/pdf' });
            if (onSuccess) onSuccess(`PDF saved to Downloads folder: ${fileName}`);
        } else {
            doc.save(fileName);
            if (onSuccess) onSuccess("PDF download initiated.");
        }

    } catch (error) {
        console.error("Error generating attendance report:", error);
        if (onError) onError("Failed to generate report: " + error.message);
        else alert("Failed to generate report: " + error.message);
    }
};

// --- Component: AttendanceManagerView (Dashboard for Managers) ---

export function AttendanceManagerView({ course, onClose }) {
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [manualDates, setManualDates] = useState([]);
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const data = await listAllParticipantsForCourse(course.id, 'server');
                setParticipants(data || []);
            } catch (err) {
                console.error(err);
                alert("Failed to load participants.");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [course.id]);

    const sessionDates = useMemo(() => {
        const dates = new Set(manualDates);
        participants.forEach(p => {
            if (Array.isArray(p.attendance)) {
                p.attendance.forEach(d => dates.add(d));
            }
        });
        return Array.from(dates).sort();
    }, [participants, manualDates]);

    const filteredParticipants = useMemo(() => {
        return participants
            .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => {
                // Sort by attendance count descending, then alphabetically
                const countA = a.attendance ? a.attendance.length : 0;
                const countB = b.attendance ? b.attendance.length : 0;
                if (countB !== countA) {
                    return countB - countA; // Highest first
                }
                return a.name.localeCompare(b.name);
            });
    }, [participants, searchTerm]);

    const handleToggleAttendance = async (participant, date) => {
        if (updating) return;
        const isPresent = participant.attendance && participant.attendance.includes(date);
        const updatedAttendance = isPresent
            ? (participant.attendance || []).filter(d => d !== date)
            : [...(participant.attendance || []), date];

        setParticipants(prev => prev.map(p => 
            p.id === participant.id ? { ...p, attendance: updatedAttendance } : p
        ));

        try {
            const participantRef = doc(db, 'participants', participant.id);
            if (isPresent) {
                await updateDoc(participantRef, { attendance: arrayRemove(date) });
            } else {
                await updateDoc(participantRef, { attendance: arrayUnion(date) });
            }
        } catch (err) {
            console.error("Failed to update attendance:", err);
            alert("Failed to save attendance change.");
            setParticipants(prev => prev.map(p => 
                p.id === participant.id ? participant : p 
            ));
        }
    };

    const handleDeleteDate = async (dateToDelete) => {
        if (!window.confirm(`Are you sure you want to remove ${dateToDelete}? This will remove attendance records for this date from ALL participants.`)) return;
        
        setUpdating(true);
        try {
            const batch = writeBatch(db);
            let updateCount = 0;

            participants.forEach(p => {
                if (p.attendance && p.attendance.includes(dateToDelete)) {
                    const ref = doc(db, 'participants', p.id);
                    batch.update(ref, { attendance: arrayRemove(dateToDelete) });
                    updateCount++;
                }
            });

            if (updateCount > 0) {
                await batch.commit();
            }

            setParticipants(prev => prev.map(p => ({
                ...p,
                attendance: p.attendance ? p.attendance.filter(d => d !== dateToDelete) : []
            })));
            setManualDates(prev => prev.filter(d => d !== dateToDelete));

        } catch (err) {
            console.error(err);
            alert("Failed to delete date.");
        } finally {
            setUpdating(false);
        }
    };

    const handleEditDate = async (oldDate) => {
        const newDate = window.prompt("Enter new date (YYYY-MM-DD):", oldDate);
        if (!newDate || newDate === oldDate) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
            alert("Invalid date format. Use YYYY-MM-DD");
            return;
        }

        setUpdating(true);
        try {
            const updates = participants.map(async (p) => {
                if (p.attendance && p.attendance.includes(oldDate)) {
                    const newAttendance = p.attendance.filter(d => d !== oldDate).concat(newDate);
                    const ref = doc(db, 'participants', p.id);
                    await updateDoc(ref, { attendance: newAttendance });
                    return { id: p.id, attendance: newAttendance };
                }
                return null;
            });

            const results = await Promise.all(updates);
            
            setParticipants(prev => prev.map(p => {
                const updated = results.find(r => r && r.id === p.id);
                return updated ? { ...p, attendance: updated.attendance } : p;
            }));
            
            setManualDates(prev => prev.map(d => d === oldDate ? newDate : d));

        } catch (err) {
            console.error(err);
            alert("Failed to edit date.");
        } finally {
            setUpdating(false);
        }
    };

    const handleAddColumn = () => {
        const today = new Date().toISOString().split('T')[0];
        const newDate = window.prompt("Add new Session Date (YYYY-MM-DD):", today);
        if (newDate) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
                alert("Invalid date format.");
                return;
            }
            if (sessionDates.includes(newDate)) {
                alert("Date already exists.");
                return;
            }
            setManualDates(prev => [...prev, newDate]);
        }
    };

    const handleGeneratePdf = async () => {
        setIsPdfGenerating(true);
        await new Promise(resolve => setTimeout(resolve, 100)); // allow UI to register generating state
        await generateAttendanceReportPdf(
            course, 
            participants, 
            sessionDates,
            (msg) => { alert(msg); setIsPdfGenerating(false); },
            (msg) => { alert(msg); setIsPdfGenerating(false); }
        );
    };

    // KPIs
    const totalParticipants = participants.length;
    const totalSessions = sessionDates.length;
    const totalPossibleAttendance = totalParticipants * totalSessions;
    const totalActualAttendance = participants.reduce((acc, p) => acc + (p.attendance ? p.attendance.length : 0), 0);
    const avgAttendance = totalPossibleAttendance > 0 ? (totalActualAttendance / totalPossibleAttendance) * 100 : 0;

    const dailyCounts = sessionDates.map(date => {
        const count = participants.filter(p => p.attendance && p.attendance.includes(date)).length;
        return { date, count };
    });

    if (loading) return <div className="p-8 flex justify-center"><Spinner /></div>;

    return (
        <div className="flex flex-col h-full bg-white rounded-lg overflow-hidden shadow-sm">
            <div className="p-2 md:p-4 border-b flex flex-wrap justify-between items-center bg-gray-50 gap-2 md:gap-4">
                <div>
                    <h3 className="text-base md:text-lg font-bold text-gray-800">Attendance Dashboard</h3>
                    <p className="text-xs md:text-sm text-gray-500">{course.course_type} - {course.state}</p>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                    <div className="relative">
                        <Search className="absolute left-2 md:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3 md:w-4 md:h-4" />
                        <Input 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            placeholder="Search..." 
                            className="pl-7 md:pl-9 w-28 md:w-60 text-xs md:text-sm py-1"
                        />
                    </div>
                    <Button variant="primary" onClick={handleAddColumn} size="sm" className="px-2 md:px-3 text-xs md:text-sm">
                        <PlusCircle className="w-3 h-3 md:w-4 md:h-4 md:mr-1" /> <span className="hidden md:inline">Add Session</span>
                    </Button>
                    <Button variant="secondary" onClick={handleGeneratePdf} disabled={isPdfGenerating} size="sm" className="px-2 md:px-3 text-xs md:text-sm">
                        {isPdfGenerating ? <Spinner size="sm" className="md:mr-1" /> : <Download className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />}
                        <span className="hidden md:inline">{isPdfGenerating ? 'Generating...' : 'PDF'}</span>
                    </Button>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 ml-1 md:ml-2">
                        <X className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                </div>
            </div>

            <div className="p-2 md:p-4 grid grid-cols-3 gap-2 md:gap-4 border-b">
                <div className="bg-blue-50 p-2 md:p-4 rounded-lg border border-blue-100 text-center">
                    <div className="text-lg md:text-2xl font-bold text-blue-700">{totalParticipants}</div>
                    <div className="text-[10px] md:text-xs text-blue-600 uppercase font-semibold leading-tight">Total Participants</div>
                </div>
                <div className="bg-green-50 p-2 md:p-4 rounded-lg border border-green-100 text-center">
                    <div className="text-lg md:text-2xl font-bold text-green-700">{avgAttendance.toFixed(1)}%</div>
                    <div className="text-[10px] md:text-xs text-green-600 uppercase font-semibold leading-tight">Avg. Rate</div>
                </div>
                <div className="bg-purple-50 p-2 md:p-4 rounded-lg border border-purple-100 text-center">
                    <div className="text-lg md:text-2xl font-bold text-purple-700">{totalSessions}</div>
                    <div className="text-[10px] md:text-xs text-purple-600 uppercase font-semibold leading-tight">Sessions</div>
                </div>
            </div>

            <div className="flex-grow p-1 md:p-4 overflow-x-hidden">
                {updating && <div className="text-center text-xs md:text-sm text-blue-600 mb-2 font-semibold">Updating records...</div>}
                
                {sessionDates.length === 0 ? (
                    <EmptyState message="No attendance sessions recorded yet. Click 'Add Session' to start." />
                ) : (
                    <table className="w-full text-left border-collapse table-auto border border-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-1 border text-center text-[10px] md:text-xs font-medium text-gray-500 uppercase w-6 md:w-8">#</th>
                                <th className="p-1 border text-[10px] md:text-xs font-medium text-gray-500 uppercase w-1/4">Participant</th>
                                <th className="p-1 border text-[10px] md:text-xs font-medium text-gray-500 uppercase w-1/4">Details</th>
                                {sessionDates.map((date, idx) => (
                                    <th key={date} className="p-1 border text-center text-[10px] md:text-xs font-medium text-gray-500 uppercase relative group" title={date}>
                                        <div className="flex flex-col items-center">
                                            <span>S{idx + 1}</span>
                                            <span className="text-[8px] md:text-[9px] text-gray-400 font-normal leading-tight whitespace-nowrap">{date}</span>
                                            <div className="absolute top-0 right-0 flex opacity-0 group-hover:opacity-100 transition-opacity bg-white border rounded shadow-sm scale-75 md:scale-90 z-20">
                                                <button onClick={() => handleEditDate(date)} className="p-1 text-blue-500 hover:bg-blue-50"><Edit2 className="w-3 h-3" /></button>
                                                <button onClick={() => handleDeleteDate(date)} className="p-1 text-red-500 hover:bg-red-50"><Trash2 className="w-3 h-3" /></button>
                                            </div>
                                        </div>
                                    </th>
                                ))}
                                <th className="p-1 border text-center text-[10px] md:text-xs font-medium text-gray-500 uppercase w-10 md:w-16">Total</th>
                                <th className="p-1 border text-center text-[10px] md:text-xs font-medium text-gray-500 uppercase w-12 md:w-20">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {filteredParticipants.map((p, index) => {
                                const daysCount = p.attendance ? p.attendance.length : 0;
                                const percentage = totalSessions > 0 ? Math.round((daysCount / totalSessions) * 100) : 0;
                                const status = getStatusDetails(daysCount, totalSessions);

                                return (
                                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-1 border text-[10px] md:text-xs text-center text-gray-500">{index + 1}</td>
                                        <td className="p-1 border text-[10px] md:text-sm font-medium text-gray-900 break-words">{p.name}</td>
                                        <td className="p-1 border text-[10px] md:text-xs text-gray-500 break-words">
                                            <div className="font-semibold leading-tight">{p.center_name || p.health_facility || '-'}</div>
                                            <div className="text-gray-400 flex items-center gap-1 flex-wrap mt-0.5">
                                                <span>{p.state}</span>
                                                {p.group && <span className="px-1 rounded-sm bg-gray-100 border text-[8px] md:text-[10px]">{p.group}</span>}
                                            </div>
                                        </td>
                                        {sessionDates.map(date => {
                                            const isPresent = p.attendance && p.attendance.includes(date);
                                            return (
                                                <td key={date} className="p-1 border text-center align-middle">
                                                    <div className="flex justify-center items-center h-full">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={!!isPresent} 
                                                            onChange={() => handleToggleAttendance(p, date)} 
                                                            className="h-3 w-3 md:h-4 md:w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded cursor-pointer" 
                                                        />
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        <td className="p-1 border text-center text-[10px] md:text-sm font-bold text-gray-700 bg-gray-50 align-middle">
                                            <div className="flex flex-col items-center leading-tight">
                                                <span>{daysCount}</span>
                                                <span className="text-[8px] md:text-[10px] font-normal text-gray-500">({percentage}%)</span>
                                            </div>
                                        </td>
                                        <td className="p-1 border text-center font-bold bg-gray-50 align-middle">
                                            <span className={`px-1 py-0.5 rounded border text-[8px] md:text-xs inline-block text-center leading-tight break-words max-w-full ${status.class}`}>
                                                {status.text}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-50 font-semibold shadow-inner">
                            <tr>
                                <td colSpan="3" className="p-1 border text-right text-[10px] md:text-xs text-gray-600 uppercase">Daily Presence:</td>
                                {dailyCounts.map((d, i) => <td key={i} className="p-1 border text-center text-[10px] md:text-xs text-gray-800">{d.count}</td>)}
                                <td colSpan="2" className="p-1 border bg-gray-50"></td>
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>
        </div>
    );
}

// --- Component: PublicAttendanceView (For Participants) ---

export function PublicAttendanceView({ courseId }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [course, setCourse] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [isWrongDate, setIsWrongDate] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const searchParams = new URLSearchParams(window.location.search);
    const targetDate = searchParams.get('date');

    useEffect(() => {
        const checkDateAndLoadData = async () => {
            try {
                if (!targetDate) throw new Error("No date specified in the link.");
                const today = new Date().toISOString().split('T')[0];
                if (today !== targetDate) {
                    setIsWrongDate(true);
                    setLoading(false);
                    return;
                }
                const courseData = await getCourseById(courseId, 'server');
                if (!courseData) throw new Error("Course not found.");
                setCourse(courseData);
                const participantsData = await listAllParticipantsForCourse(courseId, 'server');
                setParticipants(participantsData || []);
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        if (courseId) checkDateAndLoadData();
    }, [courseId, targetDate]);

    const handleConfirmAttendance = async (participantId) => {
        try {
            const participantRef = doc(db, 'participants', participantId);
            await updateDoc(participantRef, { attendance: arrayUnion(targetDate) });
            setParticipants(prev => prev.map(p => {
                if (p.id === participantId) {
                    const currentAttendance = p.attendance || [];
                    return { ...p, attendance: [...currentAttendance, targetDate] };
                }
                return p;
            }));
        } catch (err) {
            alert("Failed to mark attendance. Please try again.");
            console.error(err);
        }
    };

    const filteredParticipants = useMemo(() => {
        return participants
            .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
            // Keep purely alphabetical order for the public link
            .sort((a,b) => a.name.localeCompare(b.name));
    }, [participants, searchTerm]);

    if (loading) return <div className="flex justify-center p-8"><Spinner /></div>;
    
    if (isWrongDate) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
                <Card className="max-w-md text-center p-8">
                    <div className="mx-auto h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-4"><Clock className="h-8 w-8 text-red-600" /></div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Link Expired or Invalid</h2>
                    <p className="text-gray-600">This attendance form is only valid for <strong>{targetDate}</strong>.</p>
                    <p className="text-sm text-gray-500 mt-4">Today is: {new Date().toISOString().split('T')[0]}</p>
                </Card>
            </div>
        );
    }

    if (error) return <EmptyState message={`Error: ${error}`} />;

    return (
        <div className="min-h-screen bg-gray-50 p-2 md:p-8">
            <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
                <Card className="p-3 md:p-6 border-t-4 border-blue-500">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4">
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Training Attendance</h1>
                            <p className="text-sm md:text-base text-gray-600">{course.course_type} - {course.state}</p>
                        </div>
                        <div className="text-right bg-blue-50 px-3 py-1.5 md:px-4 md:py-2 rounded-lg border border-blue-100">
                            <span className="block text-[10px] md:text-xs text-blue-600 font-bold uppercase">Date</span>
                            <span className="text-base md:text-lg font-bold text-blue-900">{targetDate}</span>
                        </div>
                    </div>
                    <div className="mt-3 md:mt-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
                            <Input 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by name..."
                                className="pl-9 md:pl-10 w-full text-sm"
                            />
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="overflow-x-hidden">
                        <table className="w-full divide-y divide-gray-200 table-fixed">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-2 py-2 md:px-4 md:py-3 text-left text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider w-[35%] md:w-[25%]">Name</th>
                                    <th className="px-2 py-2 md:px-4 md:py-3 text-left text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider w-[20%] md:w-[15%]">State</th>
                                    {/* Hide Facility and Status on Mobile */}
                                    <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider md:w-[30%]">Facility</th>
                                    <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider md:w-[15%]">Status</th>
                                    <th className="px-2 py-2 md:px-4 md:py-3 text-right text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider w-[45%] md:w-[15%]">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredParticipants.map(p => {
                                    const isPresent = p.attendance && p.attendance.includes(targetDate);
                                    return (
                                        <tr key={p.id} className={isPresent ? "bg-green-50" : "hover:bg-gray-50"}>
                                            <td className="px-2 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium text-gray-900 break-words">{p.name}</td>
                                            <td className="px-2 py-2 md:px-4 md:py-3 text-[10px] md:text-sm text-gray-500 break-words">{p.state}</td>
                                            <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-500 break-words">{p.center_name || p.health_facility || p.facilityName || '-'}</td>
                                            <td className="hidden md:table-cell px-4 py-3 text-sm">
                                                {isPresent ? 
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Present</span> : 
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">Pending</span>
                                                }
                                            </td>
                                            <td className="px-2 py-2 md:px-4 md:py-3 text-right">
                                                <Button 
                                                    onClick={() => handleConfirmAttendance(p.id)}
                                                    disabled={isPresent}
                                                    size="sm"
                                                    variant={isPresent ? "secondary" : "primary"}
                                                    className={`text-[10px] md:text-sm px-2 py-1 md:px-3 md:py-1.5 ${isPresent ? "opacity-70 cursor-not-allowed bg-white border-gray-300 w-full" : "w-full"}`}
                                                >
                                                    {isPresent ? (
                                                        <span className="flex items-center justify-center"><CheckCircle className="w-3 h-3 md:w-4 md:h-4 mr-1 text-green-600" /> Confirmed</span>
                                                    ) : "Confirm"}
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filteredParticipants.length === 0 && (
                            <div className="p-4 md:p-8 text-center text-sm text-gray-500">No participants found matching "{searchTerm}"</div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}