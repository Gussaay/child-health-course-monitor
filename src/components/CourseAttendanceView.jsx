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

const generateAttendanceReportPdf = async (course, participants, columns) => {
    try {
        const doc = new jsPDF('landscape'); 
        
        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.text("Attendance Report", 14, 22);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Course: ${course.course_type} | Location: ${course.state} - ${course.locality} | Start Date: ${course.start_date}`, 14, 30);
        
        const dateHeaders = columns.map(date => date.slice(5)); 
        const headRow = [['#', 'Name', 'State', 'Facility', 'Group', ...dateHeaders, 'Total']];

        const tableData = participants.sort((a,b) => a.name.localeCompare(b.name)).map((p, index) => {
            const row = [
                index + 1,
                p.name, 
                p.state || '-', 
                p.health_facility || '-', 
                p.group || '-'
            ];
            
            columns.forEach(date => {
                const isPresent = p.attendance && p.attendance.includes(date);
                row.push(isPresent ? 'PRESENT' : 'ABSENT');
            });

            const daysCount = p.attendance ? p.attendance.length : 0;
            row.push(daysCount);

            return row;
        });

        autoTable(doc, {
            head: headRow,
            body: tableData,
            startY: 36,
            theme: 'grid',
            headStyles: { 
                fillColor: [22, 163, 74], 
                textColor: 255,
                halign: 'center',
                fontSize: 9,
                cellPadding: 2
            },
            styles: { 
                fontSize: 8, 
                cellPadding: 1.5, 
                valign: 'middle',
                lineColor: [200, 200, 200],
                lineWidth: 0.1,
                overflow: 'ellipsize'
            },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
                1: { cellWidth: 45, halign: 'left' },
                2: { cellWidth: 25, halign: 'left' },
                3: { cellWidth: 35, halign: 'left' },
                4: { cellWidth: 12, halign: 'center' },
            },
            didParseCell: function (data) {
                const dateColumnStartIndex = 5;
                const dateColumnEndIndex = 5 + columns.length; 

                if (data.section === 'body' && data.column.index >= dateColumnStartIndex && data.column.index < dateColumnEndIndex) {
                    data.cell.rawStatus = data.cell.raw; 
                    data.cell.text = ''; 
                }
                
                if (data.section === 'body' && data.column.index === dateColumnEndIndex) {
                    data.cell.styles.halign = 'center';
                    data.cell.styles.fontStyle = 'bold';
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

        const fileName = `Attendance_Report_${course.course_type}_${course.state}.pdf`;
        doc.save(fileName);

    } catch (error) {
        console.error("Error generating attendance report:", error);
        alert("Failed to generate report: " + error.message);
    }
};

// --- Component: AttendanceManagerView (Dashboard for Managers) ---

export function AttendanceManagerView({ course, onClose }) {
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [manualDates, setManualDates] = useState([]);

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
            .sort((a,b) => a.name.localeCompare(b.name));
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
            <div className="p-4 border-b flex flex-wrap justify-between items-center bg-gray-50 gap-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Attendance Dashboard</h3>
                    <p className="text-sm text-gray-500">{course.course_type} - {course.state}</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            placeholder="Search..." 
                            className="pl-9 w-40 md:w-60"
                        />
                    </div>
                    <Button variant="primary" onClick={handleAddColumn} size="sm">
                        <PlusCircle className="w-4 h-4 mr-1 md:mr-2" /> <span className="hidden md:inline">Add Session</span>
                    </Button>
                    <Button variant="secondary" onClick={() => generateAttendanceReportPdf(course, participants, sessionDates)} size="sm">
                        <Download className="w-4 h-4 mr-1 md:mr-2" /> <span className="hidden md:inline">PDF</span>
                    </Button>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 ml-2">
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-b">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-center">
                    <div className="text-2xl font-bold text-blue-700">{totalParticipants}</div>
                    <div className="text-xs text-blue-600 uppercase font-semibold">Total Participants</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-center">
                    <div className="text-2xl font-bold text-green-700">{avgAttendance.toFixed(1)}%</div>
                    <div className="text-xs text-green-600 uppercase font-semibold">Avg. Attendance Rate</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 text-center">
                    <div className="text-2xl font-bold text-purple-700">{totalSessions}</div>
                    <div className="text-xs text-purple-600 uppercase font-semibold">Recorded Sessions</div>
                </div>
            </div>

            <div className="flex-grow overflow-auto p-4">
                {updating && <div className="text-center text-sm text-blue-600 mb-2 font-semibold">Updating records...</div>}
                
                {sessionDates.length === 0 ? (
                    <EmptyState message="No attendance sessions recorded yet. Click 'Add Session' to start." />
                ) : (
                    <table className="min-w-full divide-y divide-gray-200 border text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-100 z-10 border-r w-10">#</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase sticky left-10 bg-gray-100 z-10 border-r min-w-[150px]">Participant</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase border-r min-w-[200px]">Details</th>
                                {sessionDates.map((date, idx) => (
                                    <th key={date} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase min-w-[100px] border-r group relative">
                                        <div className="flex flex-col items-center">
                                            <span>Day {idx + 1}</span>
                                            <span className="text-[10px] text-gray-400 font-normal">{date.slice(5)}</span>
                                            <div className="absolute top-0 right-0 flex opacity-0 group-hover:opacity-100 transition-opacity bg-white border rounded shadow-sm scale-90">
                                                <button onClick={() => handleEditDate(date)} className="p-1 text-blue-500 hover:bg-blue-50"><Edit2 className="w-3 h-3" /></button>
                                                <button onClick={() => handleDeleteDate(date)} className="p-1 text-red-500 hover:bg-red-50"><Trash2 className="w-3 h-3" /></button>
                                            </div>
                                        </div>
                                    </th>
                                ))}
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase border-l sticky right-0 bg-gray-100 z-10">Total</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredParticipants.map((p, index) => (
                                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-2 py-1 text-xs text-center text-gray-500 sticky left-0 bg-white z-10 border-r">{index + 1}</td>
                                    <td className="px-3 py-1 text-sm font-medium text-gray-900 sticky left-10 bg-white z-10 border-r shadow-sm">{p.name}</td>
                                    <td className="px-3 py-1 text-xs text-gray-500 border-r">
                                        <div className="font-semibold truncate max-w-[180px]">{p.health_facility || '-'}</div>
                                        <div className="text-gray-400 flex items-center gap-1"><span>{p.state}</span>{p.group && <span className="px-1.5 py-0.5 rounded-full bg-gray-100 border">{p.group}</span>}</div>
                                    </td>
                                    {sessionDates.map(date => {
                                        const isPresent = p.attendance && p.attendance.includes(date);
                                        return (
                                            <td key={date} className="px-2 py-1 text-center border-r">
                                                <div className="flex justify-center">
                                                    <input type="checkbox" checked={!!isPresent} onChange={() => handleToggleAttendance(p, date)} className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded cursor-pointer" />
                                                </div>
                                            </td>
                                        );
                                    })}
                                    <td className="px-3 py-1 text-center text-sm font-bold text-gray-700 border-l bg-gray-50 sticky right-0 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                        <span className={`px-2 py-0.5 rounded-full text-xs ${ (p.attendance?.length || 0) === totalSessions ? 'bg-green-100 text-green-800' : (p.attendance?.length || 0) < totalSessions / 2 ? 'bg-red-100 text-red-800' : 'bg-gray-200' }`}>
                                            {p.attendance ? p.attendance.length : 0}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-semibold sticky bottom-0 z-20 shadow-inner">
                            <tr>
                                <td colSpan="3" className="px-3 py-2 text-right text-xs text-gray-600 uppercase border-r sticky left-0 bg-gray-50 z-10">Daily Presence:</td>
                                {dailyCounts.map((d, i) => <td key={i} className="px-2 py-2 text-center text-xs text-gray-800 border-r">{d.count}</td>)}
                                <td className="border-l sticky right-0 bg-gray-50 z-10"></td>
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
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <Card className="p-4 md:p-6 border-t-4 border-blue-500">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Training Attendance</h1>
                            <p className="text-gray-600">{course.course_type} - {course.state}</p>
                        </div>
                        <div className="text-right bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
                            <span className="block text-xs text-blue-600 font-bold uppercase">Date</span>
                            <span className="text-lg font-bold text-blue-900">{targetDate}</span>
                        </div>
                    </div>
                    <div className="mt-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <Input 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by name..."
                                className="pl-10 w-full"
                            />
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">State</th>
                                    {/* Hide Facility and Status on Mobile */}
                                    <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Facility</th>
                                    <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredParticipants.map(p => {
                                    const isPresent = p.attendance && p.attendance.includes(targetDate);
                                    return (
                                        <tr key={p.id} className={isPresent ? "bg-green-50" : "hover:bg-gray-50"}>
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">{p.state}</td>
                                            <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-500">{p.health_facility || p.facilityName || '-'}</td>
                                            <td className="hidden md:table-cell px-4 py-3 text-sm">
                                                {isPresent ? 
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Present</span> : 
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">Pending</span>
                                                }
                                            </td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                <Button 
                                                    onClick={() => handleConfirmAttendance(p.id)}
                                                    disabled={isPresent}
                                                    size="sm"
                                                    variant={isPresent ? "secondary" : "primary"}
                                                    className={isPresent ? "opacity-70 cursor-not-allowed bg-white border-gray-300" : "w-full md:w-auto"}
                                                >
                                                    {isPresent ? (
                                                        <span className="flex items-center"><CheckCircle className="w-4 h-4 mr-1 text-green-600" /> Confirmed</span>
                                                    ) : "Confirm"}
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filteredParticipants.length === 0 && (
                            <div className="p-8 text-center text-gray-500">No participants found matching "{searchTerm}"</div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}