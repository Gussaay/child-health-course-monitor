// src/components/FinalReportManager.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button, Card, FormGroup, Input, Modal, PageHeader, PdfIcon, Select, Table, Textarea, Spinner, finalReportStatus, FinalReportStatusBadges } from './CommonComponents';
import { Copy, Image as ImageIcon, Users, BookOpen, PenLine, Stamp, X, Type, Share2, Trash2, Download, Eye } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useDataCache } from '../DataContext';
import { useAuth } from '../hooks/useAuth';
import { STATE_LOCALITIES } from './constants';
import { notify, promptDialog, confirmDialog } from './dialogs';
import { createPortal } from 'react-dom';
import { attachFinalReportPdf, removeFinalReportPdf, getFinalReportByCourseId, lightFinalReport, updateFinalReportContent } from '../data';
import html2canvas from 'html2canvas'; // <-- Added proper import
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';

// --- Shared Utility: Copy as Image ---
const copyAsImage = async (ref, t) => {
    try {
        const node = ref.current;
        if (!node) return;
        
        // Use the imported html2canvas directly
        const canvas = await html2canvas(node, {
            backgroundColor: '#ffffff', // Ensure white background
            scale: 2, // Better resolution
            useCORS: true // Help load external images/fonts
        });

        canvas.toBlob(async (blob) => {
            if (!blob) {
                notify(t('final_report.copy.blob_failed', 'Failed to create image blob.'));
                return;
            }
            try {
                // Modern Clipboard API requires secure context (HTTPS)
                const item = new window.ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                notify(t('final_report.copy.image_copied', 'Image copied to clipboard!'));
            } catch (err) {
                console.error("Clipboard API failed:", err);
                notify(t('final_report.copy.image_failed', 'Failed to copy image. Your browser might require HTTPS or strict permissions.'));
            }
        }, 'image/png');
    } catch (err) {
        console.error("HTML2Canvas Error:", err);
        notify(t('final_report.copy.generate_failed', 'Failed to generate image.'));
    }
};

// --- Sub-component for individual participant groups ---
const ParticipantGroupTable = ({ subCourse, group, participantHeaders }) => {
    const { t } = useTranslation();
    const tableRef = useRef(null);

    const isArabic = subCourse && subCourse.toLowerCase().includes('medical assist');
    
    const displayHeaders = isArabic 
        ? ['الرقم', 'الاسم', 'المسمى الوظيفي', 'الولاية', 'المحلية', 'المؤسسة', 'رقم الهاتف']
        : participantHeaders;

    const getDisplayState = (state) => {
        if (!isArabic || !state) return state;
        return STATE_LOCALITIES[state]?.ar || state;
    };

    const getDisplayLocality = (state, locality) => {
        if (!isArabic || !state || !locality) return locality;
        const stateData = STATE_LOCALITIES[state];
        if (!stateData || !stateData.localities) return locality;
        const locData = stateData.localities.find(l => l.en === locality);
        return locData ? locData.ar : locality;
    };

    const copyAsText = () => {
        const rows = group.map((p, index) => [
            index + 1, 
            p.name, 
            p.job_title, 
            getDisplayState(p.state), 
            getDisplayLocality(p.state, p.locality), 
            p.center_name || p.department || t('final_report.na', 'N/A'), 
            p.phone || t('final_report.na', 'N/A')
        ]);
        const tsv = [displayHeaders.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');
        navigator.clipboard.writeText(tsv)
            .then(() => notify(t('final_report.copy.group_table_copied', 'Table for {{subCourse}} copied as text!', { subCourse })))
            .catch(err => notify(t('final_report.copy.table_failed', 'Failed to copy table.')));
    };

    return (
        <div className="bg-white rounded-xl shadow-md border border-blue-200 overflow-hidden">
            <div className="flex justify-between items-center p-4 bg-blue-50 border-b border-blue-200" dir={isArabic ? "rtl" : "ltr"}>
                <h4 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                    <BookOpen className={`w-5 h-5 text-blue-600 ${isArabic ? 'ml-2 mr-0' : 'mr-2 ml-0'}`} />
                    {subCourse === 'Unspecified Sub-course' ? t('final_report.annex.unspecified_subcourse', 'Unspecified Sub-course') : subCourse}
                </h4>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={copyAsText} className="bg-white text-blue-700 border-blue-300 hover:bg-blue-100">
                        <Copy className={`w-4 h-4 ${isArabic ? 'ml-2 mr-0' : 'mr-2 ml-0'}`} /> {isArabic ? 'نسخ كجدول' : t('final_report.annex.copy_table', 'Copy as Table')}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => copyAsImage(tableRef, t)} className="bg-white text-blue-700 border-blue-300 hover:bg-blue-100">
                        <ImageIcon className={`w-4 h-4 ${isArabic ? 'ml-2 mr-0' : 'mr-2 ml-0'}`} /> {isArabic ? 'نسخ كصورة' : t('final_report.annex.copy_image', 'Copy as Image')}
                    </Button>
                </div>
            </div>
            {/* Added styling to tableRef container so it copies cleanly */}
            <div ref={tableRef} className="bg-white overflow-x-auto p-4" dir={isArabic ? "rtl" : "ltr"}>
                <table className="min-w-full divide-y divide-blue-200">
                    <thead className="bg-blue-600">
                        <tr>
                            {displayHeaders.map((h, i) => (
                                <th key={i} className="px-4 py-3 text-start text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                        {group.map((p, i) => (
                            <tr key={i} className="hover:bg-blue-50 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium text-start">{i + 1}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold text-start">{p.name}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-800 bg-blue-50/50 text-start">{p.job_title}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-start">{getDisplayState(p.state)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-start">{getDisplayLocality(p.state, p.locality)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-start">{p.center_name || p.department || t('final_report.na', 'N/A')}</td>
                                <td className={`px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-start ${isArabic ? '' : 'font-mono'}`} dir="ltr">{p.phone || t('final_report.na', 'N/A')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Annex Section Component (Refactored to accept pre-calculated arrays) ---
const AnnexSection = ({ groupedParticipants, annexFacilitators }) => {
    const { t } = useTranslation();
    const facilitatorTableRef = useRef(null);

    const facilitatorHeaders = ['#', t('final_report.annex.facilitator_name', 'Facilitator Name'), t('final_report.table.phone_number', 'Phone Number'), t('final_report.annex.qualification', 'Qualification')];
    const participantHeaders = ['#', t('final_report.table.participant_name', 'Participant Name'), t('final_report.annex.job_title', 'Job Title'), t('final_report.annex.state', 'State'), t('final_report.annex.locality', 'Locality'), t('final_report.annex.facility', 'Facility'), t('final_report.table.phone_number', 'Phone Number')];

    const copyFacilitatorsAsText = () => {
        const rows = annexFacilitators.map((f, i) => [i + 1, f.name, f.phone, f.qualification]);
        const tsv = [facilitatorHeaders.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');
        navigator.clipboard.writeText(tsv)
            .then(() => notify(t('final_report.copy.table_copied', 'Table copied as text!')))
            .catch(err => notify(t('final_report.copy.table_failed', 'Failed to copy table.')));
    };

    return (
        <div className="mt-10 pt-8 border-t-2 border-blue-200">
            <h2 className="text-2xl font-extrabold mb-6 text-blue-900">{t('final_report.annex.title', 'Annex: Detailed Rosters')}</h2>

            {/* Facilitators Table */}
            <div className="mb-10">
                <div className="bg-white rounded-xl shadow-md border border-blue-200 overflow-hidden">
                    <div className="flex justify-between items-center p-4 bg-blue-50 border-b border-blue-200">
                        <h3 className="text-xl font-bold text-blue-900 flex items-center gap-2">
                            <Users className="w-6 h-6 text-blue-600" />
                            {t('final_report.annex.course_facilitators', 'Course Facilitators')}
                        </h3>
                        <div className="flex gap-2">
                            <Button variant="secondary" size="sm" onClick={copyFacilitatorsAsText} className="bg-white text-blue-700 border-blue-300 hover:bg-blue-100">
                                <Copy className="w-4 h-4 mr-2" /> {t('final_report.annex.copy_table', 'Copy as Table')}
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => copyAsImage(facilitatorTableRef, t)} className="bg-white text-blue-700 border-blue-300 hover:bg-blue-100">
                                <ImageIcon className="w-4 h-4 mr-2" /> {t('final_report.annex.copy_image', 'Copy as Image')}
                            </Button>
                        </div>
                    </div>
                    
                    <div ref={facilitatorTableRef} className="bg-white overflow-x-auto p-4">
                        <table className="min-w-full divide-y divide-blue-200">
                            <thead className="bg-blue-600">
                                <tr>
                                    {facilitatorHeaders.map((h, i) => (
                                        <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-blue-100">
                                {annexFacilitators.length > 0 ? annexFacilitators.map((f, i) => (
                                    <tr key={i} className="hover:bg-blue-50 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">{i + 1}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold">{f.name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-mono">{f.phone}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-800 bg-blue-50/50">{f.qualification}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="4" className="px-4 py-8 text-center text-sm text-gray-500 italic">{t('final_report.annex.no_facilitators', 'No facilitators found.')}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Participants Tables by Sub-course */}
            <div>
                <h3 className="text-xl font-bold text-blue-900 mb-6 flex items-center gap-2">
                    <Users className="w-6 h-6 text-blue-600" />
                    {t('final_report.annex.course_participants', 'Course Participants (By Sub-course)')}
                </h3>
                
                <div className="space-y-8">
                    {Object.keys(groupedParticipants).length > 0 ? (
                        Object.entries(groupedParticipants).map(([subCourse, group]) => (
                            <ParticipantGroupTable 
                                key={subCourse}
                                subCourse={subCourse}
                                group={group}
                                participantHeaders={participantHeaders}
                            />
                        ))
                    ) : (
                        <div className="p-8 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-blue-200 italic">
                            {t('final_report.annex.no_participants', 'No participants found for this course.')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// SIGN AND STAMP IN THE APP
//
// The signed copy used to be the report printed, signed, stamped and scanned
// back in. Now the signatures and the stamp are placed on the first page here
// and written into the report PDF itself, so the rest of the document stays
// real text instead of a scan. Every page after the first is untouched.
//
// Positions are kept in PDF points of the page as displayed (pdfjs viewport at
// scale 1), and converted with the viewport's own convertToPdfPoint, which takes
// care of pages whose media box does not start at 0,0 and of rotated pages.
// ============================================================================

const loadPdfjs = async () => {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    return pdfjs;
};

/** The report PDF as bytes, whether it is a File still in the editor or a stored URL. */
const pdfBytesOf = async (source) => {
    if (!source) throw new Error('There is no report PDF to sign.');
    if (typeof source !== 'string') return new Uint8Array(await source.arrayBuffer());
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Could not open the report PDF (${response.status}).`);
    return new Uint8Array(await response.arrayBuffer());
};

const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That image could not be read.'));
    img.src = src;
});

/**
 * Any image (data URL, stored URL or File) as a PNG data URL no bigger than
 * 1200px, optionally with its white paper made transparent so a scanned stamp
 * or signature sits on the page like ink rather than as a white box.
 */
const toInkPng = async (input, { clearWhite = false } = {}) => {
    let src = input;
    let revoke = null;
    if (typeof input !== 'string') {
        src = revoke = URL.createObjectURL(input);
    } else if (!input.startsWith('data:')) {
        // Fetched into a blob first so the canvas is not tainted.
        const blob = await (await fetch(input)).blob();
        src = revoke = URL.createObjectURL(blob);
    }
    try {
        const img = await loadImage(src);
        const fit = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * fit));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * fit));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (clearWhite) {
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const px = data.data;
            for (let i = 0; i < px.length; i += 4) {
                const lightest = Math.min(px[i], px[i + 1], px[i + 2]);
                // Paper goes fully clear; the anti-aliased edge fades with it.
                if (lightest > 225) px[i + 3] = 0;
                else if (lightest > 180) px[i + 3] = Math.round(px[i + 3] * (225 - lightest) / 45);
            }
            ctx.putImageData(data, 0, 0);
        }
        return { src: canvas.toDataURL('image/png'), aspect: canvas.height / canvas.width };
    } finally {
        if (revoke) URL.revokeObjectURL(revoke);
    }
};

const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const formatDate = (iso) => {
    const [y, m, d] = String(iso || '').split('-');
    return y && m && d ? `${d}/${m}/${y}` : (iso || '');
};

/**
 * The "Approved by" block, drawn to a transparent PNG rather than written as
 * PDF text: that way an Arabic name shapes correctly without embedding a font.
 */
const renderApprovalText = ({ name, date }) => {
    const lines = [
        { text: `Approved by: ${name?.trim() || '________________'}`, font: 'bold 34px Arial, sans-serif' },
        { text: `Date: ${formatDate(date) || '__/__/____'}`, font: '30px Arial, sans-serif' },
    ];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const pad = 8, lineH = 46;
    const width = Math.ceil(Math.max(...lines.map(l => { ctx.font = l.font; return ctx.measureText(l.text).width; }))) + pad * 2;
    canvas.width = width;
    canvas.height = lines.length * lineH + pad;
    lines.forEach((l, i) => {
        ctx.font = l.font;
        ctx.fillStyle = '#0b2a6f';
        ctx.textBaseline = 'top';
        ctx.fillText(l.text, pad, pad + i * lineH);
    });
    return { src: canvas.toDataURL('image/png'), aspect: canvas.height / canvas.width, pxW: canvas.width };
};

/**
 * An item as kept on the final report so the signature can be edited later:
 * images re-encoded as WebP to keep the document small (they are turned back
 * into PNG when signing), text blocks kept as text and redrawn.
 */
const compactItem = async (item) => {
    const { id, ...rest } = item;
    if (item.kind === 'text') {
        const { src, ...text } = rest;
        return text;
    }
    const img = await loadImage(item.src);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const webp = canvas.toDataURL('image/webp', 0.85);
    return { ...rest, src: webp.startsWith('data:image/webp') ? webp : item.src };
};

const newItemId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

/** A finger or mouse signature pad. Hands back a trimmed transparent PNG. */
const SignaturePad = ({ onDone, onCancel }) => {
    const { t } = useTranslation();
    const canvasRef = useRef(null);
    const drawing = useRef(false);
    const [hasInk, setHasInk] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ratio = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * ratio;
        canvas.height = canvas.clientHeight * ratio;
        const ctx = canvas.getContext('2d');
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#0b2a6f';
    }, []);

    const point = (e) => {
        const r = canvasRef.current.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
    };
    const down = (e) => {
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* keeps drawing without capture */ }
        drawing.current = true;
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(...point(e));
    };
    const move = (e) => {
        if (!drawing.current) return;
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(...point(e));
        ctx.stroke();
        setHasInk(true);
    };
    const up = () => { drawing.current = false; };

    const clear = () => {
        const canvas = canvasRef.current;
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        setHasInk(false);
    };

    const done = () => {
        const canvas = canvasRef.current;
        const { data, width, height } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        let minX = width, minY = height, maxX = -1, maxY = -1;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (data[(y * width + x) * 4 + 3]) {
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX < 0) return;
        const pad = 6;
        minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
        maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad);
        const out = document.createElement('canvas');
        out.width = maxX - minX + 1;
        out.height = maxY - minY + 1;
        out.getContext('2d').drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
        onDone({ src: out.toDataURL('image/png'), aspect: out.height / out.width });
    };

    return (
        <div className="border rounded-lg p-3 bg-slate-50">
            <p className="text-sm font-semibold mb-2">{t('final_report.sign.sign_in_box', 'Sign in the box')}</p>
            <canvas ref={canvasRef}
                className="w-full h-40 bg-white border border-dashed border-slate-400 rounded cursor-crosshair"
                style={{ touchAction: 'none' }}
                onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
            <div className="flex flex-wrap gap-2 mt-2 justify-end">
                <Button variant="secondary" size="sm" onClick={onCancel}>{t('final_report.buttons.cancel', 'Cancel')}</Button>
                <Button variant="secondary" size="sm" onClick={clear} disabled={!hasInk}>{t('final_report.sign.clear', 'Clear')}</Button>
                <Button size="sm" onClick={done} disabled={!hasInk}>{t('final_report.sign.place_on_page', 'Place on page')}</Button>
            </div>
        </div>
    );
};

/**
 * Place signatures and a stamp on the first page of the report PDF and produce
 * the signed copy.
 *
 * @param source        the unsigned report: a File or a stored URL
 * @param course        for the signatures and stamp already approved for certificates
 * @param initialLayout the layout of the current signed copy, to edit it
 * @param signerName    the default name for the "Approved by" block
 * @param onSigned      async (file: File, layout) => void, given the signed PDF
 *                      and the layout to keep with it
 */
export function SignAndStampModal({ isOpen, onClose, source, course, initialLayout, signerName, onSigned }) {
    const { t } = useTranslation();
    const canvasRef = useRef(null);
    const pdfBytes = useRef(null);
    const pageVp = useRef(null);
    const drag = useRef(null);
    const [pageSize, setPageSize] = useState(null);
    const [displayWidth, setDisplayWidth] = useState(0);
    const [items, setItems] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [padOpen, setPadOpen] = useState(false);
    const [clearWhite, setClearWhite] = useState(true);
    const uploadKind = useRef('signature');
    const uploadInput = useRef(null);
    // Read when the modal opens, not a dependency: a re-render of the parent
    // must not throw away placements being edited.
    const layoutRef = useRef(initialLayout);
    layoutRef.current = initialLayout;
    const isEdit = !!initialLayout?.items?.length;
    // Item labels are kept in English on the saved layout; shown translated.
    const itemLabelText = (label) => ({
        Signature: t('final_report.sign.labels.signature', 'Signature'),
        Stamp: t('final_report.sign.labels.stamp', 'Stamp'),
        'Approved by': t('final_report.sign.labels.approved_by', 'Approved by'),
        "Course director's signature": t('final_report.sign.labels.director_signature', "Course director's signature"),
        "Programme manager's signature": t('final_report.sign.labels.manager_signature', "Programme manager's signature"),
        'Programme stamp': t('final_report.sign.labels.programme_stamp', 'Programme stamp'),
    })[label] || label;

    // Signatures and the stamp already approved on this course for its
    // certificates. Only real images — the disk cache leaves `__present` flags.
    const courseAssets = useMemo(() => [
        { key: 'approvedDirectorSignatureUrl', label: "Course director's signature", kind: 'signature' },
        { key: 'approvedByManagerSignatureUrl', label: "Programme manager's signature", kind: 'signature' },
        { key: 'approvedProgramStampUrl', label: 'Programme stamp', kind: 'stamp' },
    ].filter(a => typeof course?.[a.key] === 'string' && course[a.key]), [course]);

    // Load and draw page one whenever the modal opens.
    useEffect(() => {
        if (!isOpen) return undefined;
        let cancelled = false;
        setItems([]); setSelected(null); setError(null); setPadOpen(false); setPageSize(null);
        setLoading(true);
        (async () => {
            try {
                const bytes = await pdfBytesOf(source);
                if (cancelled) return;
                pdfBytes.current = bytes;
                const pdfjs = await loadPdfjs();
                // pdfjs takes ownership of the buffer it is given, so it gets a copy.
                const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
                const page = await doc.getPage(1);
                const vp = page.getViewport({ scale: 1 });
                pageVp.current = { viewport: vp, rotation: page.rotate || 0 };
                const canvas = canvasRef.current;
                if (cancelled || !canvas) return;
                // Rendered sharp enough for a phone zoom or a retina screen.
                const renderScale = Math.min(3, Math.max(1.5, (window.devicePixelRatio || 1) * 1.25));
                const renderVp = page.getViewport({ scale: renderScale });
                canvas.width = Math.round(renderVp.width);
                canvas.height = Math.round(renderVp.height);
                // Ready as soon as the size is known: pdfjs finishes its render
                // on an animation frame, which never comes in a background tab.
                setPageSize({ width: vp.width, height: vp.height });
                // Editing: put back what the current signed copy has on it.
                const saved = (layoutRef.current?.items || []).map(it => ({
                    ...it,
                    id: newItemId(),
                    ...(it.kind === 'text' ? renderApprovalText(it) : {}),
                }));
                setItems(saved);
                setLoading(false);
                await page.render({ canvasContext: canvas.getContext('2d'), viewport: renderVp }).promise;
            } catch (e) {
                console.error('[SignAndStamp] could not load the report', e);
                if (!cancelled) setError(e.message || t('final_report.sign.open_failed', 'Could not open the report PDF.'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [isOpen, source]); // eslint-disable-line react-hooks/exhaustive-deps -- t only words the error

    // Track the displayed width so overlays line up at any screen size.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !pageSize) return undefined;
        const measure = () => setDisplayWidth(canvas.getBoundingClientRect().width);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(canvas);
        return () => ro.disconnect();
    }, [pageSize]);

    const scale = pageSize && displayWidth ? displayWidth / pageSize.width : 0;

    const addItem = useCallback(({ src, aspect, pxW }, kind, label, extra = {}) => {
        if (!pageSize) return;
        setItems(prev => {
            const count = prev.filter(i => i.kind === kind).length;
            const w = kind === 'stamp' ? Math.min(120, pageSize.width * 0.22)
                : kind === 'text' ? Math.min(170, pageSize.width * 0.3)
                : Math.min(150, pageSize.width * 0.28);
            const h = w * aspect;
            // Signatures across the foot of the page left to right, the
            // approval text under them, stamps to the right.
            const x = kind === 'stamp'
                ? pageSize.width - w - 50 - count * 20
                : 50 + count * (w + 20);
            const y = kind === 'text'
                ? pageSize.height - h - 40 - count * (h + 6)
                : pageSize.height - h - 70 - (kind === 'stamp' ? 20 : 0);
            const item = {
                id: newItemId(),
                kind, label, src, aspect, ...(pxW ? { pxW } : {}), ...extra,
                w, h,
                x: Math.max(0, Math.min(pageSize.width - w, x)),
                y: Math.max(0, Math.min(pageSize.height - h, y)),
            };
            setSelected(item.id);
            return [...prev, item];
        });
    }, [pageSize]);

    const addCourseAsset = async (asset) => {
        try {
            addItem(await toInkPng(course[asset.key], { clearWhite }), asset.kind, asset.label);
        } catch (e) {
            setError(e.message);
        }
    };

    const pickUpload = (kind) => {
        uploadKind.current = kind;
        uploadInput.current?.click();
    };
    const onUpload = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) { setError(t('final_report.sign.choose_image', 'Choose an image file (PNG or JPG).')); return; }
        try {
            const kind = uploadKind.current;
            addItem(await toInkPng(file, { clearWhite }), kind, kind === 'stamp' ? 'Stamp' : 'Signature');
        } catch (err) {
            setError(err.message);
        }
    };

    // Dragging and resizing, in page points.
    const startDrag = (e, item, mode) => {
        e.preventDefault();
        e.stopPropagation();
        setSelected(item.id);
        drag.current = { id: item.id, mode, startX: e.clientX, startY: e.clientY, orig: { ...item } };
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* moves still bubble to the page */ }
    };
    const onDrag = (e) => {
        const d = drag.current;
        if (!d || !scale || !pageSize) return;
        const dx = (e.clientX - d.startX) / scale;
        const dy = (e.clientY - d.startY) / scale;
        setItems(prev => prev.map(it => {
            if (it.id !== d.id) return it;
            if (d.mode === 'move') {
                return {
                    ...it,
                    x: Math.max(0, Math.min(pageSize.width - it.w, d.orig.x + dx)),
                    y: Math.max(0, Math.min(pageSize.height - it.h, d.orig.y + dy)),
                };
            }
            const w = Math.max(30, Math.min(pageSize.width - d.orig.x, d.orig.w + dx));
            const h = w * it.aspect;
            if (d.orig.y + h > pageSize.height) return it;
            return { ...it, w, h };
        }));
    };
    const endDrag = () => { drag.current = null; };

    const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));

    const addApproval = () => {
        const data = { name: signerName || '', date: todayIso() };
        addItem(renderApprovalText(data), 'text', 'Approved by', data);
    };

    // Editing the approval text redraws it at the same type size, so a longer
    // name makes the block wider rather than the letters smaller.
    const updateText = (id, patch) => setItems(prev => prev.map(it => {
        if (it.id !== id) return it;
        const next = { ...it, ...patch };
        const drawn = renderApprovalText(next);
        const w = it.pxW ? it.w * (drawn.pxW / it.pxW) : it.w;
        return { ...next, ...drawn, w, h: w * drawn.aspect };
    }));
    const selectedItem = items.find(i => i.id === selected);

    const apply = async () => {
        if (!items.length) return;
        setSaving(true);
        setError(null);
        try {
            const { PDFDocument, degrees } = await import('pdf-lib');
            const pdf = await PDFDocument.load(pdfBytes.current, { ignoreEncryption: true });
            const page = pdf.getPage(0);
            const { viewport, rotation } = pageVp.current;
            for (const item of items) {
                // Restored images may be WebP; the PDF needs PNG.
                const pngSrc = item.src.startsWith('data:image/png') ? item.src : (await toInkPng(item.src)).src;
                const png = await pdf.embedPng(pngSrc);
                // The image's bottom-left corner as seen on screen, in PDF space.
                const [x, y] = viewport.convertToPdfPoint(item.x, item.y + item.h);
                page.drawImage(png, { x, y, width: item.w, height: item.h, rotate: degrees(rotation) });
            }
            pdf.setModificationDate(new Date());
            const bytes = await pdf.save();
            const name = `Final_Report_Signed_${course?.course_type || 'Course'}_${course?.state || ''}.pdf`
                .replace(/[^\w.-]+/g, '_');
            const layout = {
                items: await Promise.all(items.map(compactItem)),
                // Which report this was signed on, to notice if it is replaced.
                reportUrl: typeof source === 'string' ? source : null,
                signedAt: new Date().toISOString(),
            };
            await onSigned(new File([bytes], name, { type: 'application/pdf' }), layout);
            onClose();
        } catch (e) {
            console.error('[SignAndStamp] could not sign', e);
            setError(e.message || t('final_report.sign.sign_failed', 'Could not sign the report.'));
        } finally {
            setSaving(false);
        }
    };

    // Portalled to <body>: opened from inside another dialog, a click on this
    // one must not count as a click outside that one and close it.
    return createPortal(
        <Modal isOpen={isOpen} onClose={saving ? undefined : onClose}
            title={isEdit ? t('final_report.sign.edit_title', 'Edit the signature') : t('final_report.sign.title', 'Sign and stamp the final report')}>
            <div className="space-y-3">
                <p className="text-sm text-slate-600">
                    {t('final_report.sign.intro', 'Add signatures, the stamp and who approved it, drag them into place on the first page, then save. Tap an item to change or remove it.')}
                </p>

                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setPadOpen(true)} disabled={!pageSize || padOpen}>
                        <PenLine className="w-4 h-4 mr-1" /> {t('final_report.sign.draw_signature', 'Draw signature')}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => pickUpload('signature')} disabled={!pageSize}>
                        <ImageIcon className="w-4 h-4 mr-1" /> {t('final_report.sign.signature_image', 'Signature image')}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => pickUpload('stamp')} disabled={!pageSize}>
                        <Stamp className="w-4 h-4 mr-1" /> {t('final_report.sign.stamp_image', 'Stamp image')}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={addApproval} disabled={!pageSize}>
                        <Type className="w-4 h-4 mr-1" /> {t('final_report.sign.approved_by_date', 'Approved by + date')}
                    </Button>
                    <input ref={uploadInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onUpload} />
                </div>

                {courseAssets.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">{t('final_report.sign.already_on_course', 'Already on this course:')}</span>
                        {courseAssets.map(a => (
                            <Button key={a.key} size="sm" variant="secondary" disabled={!pageSize} onClick={() => addCourseAsset(a)}
                                className="text-xs">
                                + {itemLabelText(a.label)}
                            </Button>
                        ))}
                    </div>
                )}

                <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={clearWhite} onChange={(e) => setClearWhite(e.target.checked)} />
                    {t('final_report.sign.clear_white', 'Make the white background of added images transparent')}
                </label>

                {padOpen && (
                    <SignaturePad
                        onCancel={() => setPadOpen(false)}
                        onDone={(img) => { addItem(img, 'signature', 'Signature'); setPadOpen(false); }} />
                )}

                {selectedItem?.kind === 'text' && (
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end border rounded-lg p-3 bg-blue-50/50">
                        <label className="text-xs font-semibold text-slate-600">{t('final_report.sign.labels.approved_by', 'Approved by')}
                            <input type="text" value={selectedItem.name || ''} placeholder={t('final_report.sign.name', 'Name')}
                                onChange={(e) => updateText(selectedItem.id, { name: e.target.value })}
                                className="mt-1 w-full border rounded px-2 py-1.5 text-sm font-normal" />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">{t('final_report.sign.date', 'Date')}
                            <input type="date" value={selectedItem.date || ''}
                                onChange={(e) => updateText(selectedItem.id, { date: e.target.value })}
                                className="mt-1 w-full border rounded px-2 py-1.5 text-sm font-normal" />
                        </label>
                        <Button size="sm" variant="secondary" onClick={() => updateText(selectedItem.id, { date: todayIso() })}>{t('final_report.sign.today', 'Today')}</Button>
                    </div>
                )}

                {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

                <div className="relative border shadow-sm bg-slate-100 select-none"
                    onPointerDown={() => setSelected(null)}
                    onPointerMove={onDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
                    {loading && (
                        <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Spinner /> {t('final_report.sign.opening', 'Opening the report…')}</div>
                    )}
                    <canvas ref={canvasRef} className={`block w-full h-auto bg-white ${pageSize ? '' : 'hidden'}`} />
                    {scale > 0 && items.map(item => (
                        <div key={item.id}
                            className={`absolute cursor-move ${selected === item.id ? 'outline outline-2 outline-blue-500' : 'hover:outline hover:outline-1 hover:outline-blue-300'}`}
                            style={{ left: item.x * scale, top: item.y * scale, width: item.w * scale, height: item.h * scale, touchAction: 'none' }}
                            onPointerDown={(e) => startDrag(e, item, 'move')}
                            title={t('final_report.sign.drag_to_move', '{{label}} — drag to move', { label: itemLabelText(item.label) })}>
                            <img src={item.src} alt={itemLabelText(item.label)} draggable={false} className="w-full h-full pointer-events-none" />
                            {selected === item.id && (
                                <>
                                    <button type="button" aria-label={t('final_report.sign.remove_item', 'Remove {{label}}', { label: itemLabelText(item.label) })}
                                        className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow"
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={() => removeItem(item.id)}>
                                        <X className="w-4 h-4" />
                                    </button>
                                    <span aria-label={t('final_report.sign.resize', 'Resize')}
                                        className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-600 border-2 border-white rounded-sm cursor-nwse-resize"
                                        style={{ touchAction: 'none' }}
                                        onPointerDown={(e) => startDrag(e, item, 'resize')} />
                                </>
                            )}
                        </div>
                    ))}
                </div>
                {pageSize && <p className="text-xs text-slate-500">{t('final_report.sign.page_one_note', 'Page 1 only — the rest of the report is kept as it is. Drag the blue corner to resize.')}</p>}

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>{t('final_report.buttons.cancel', 'Cancel')}</Button>
                    <Button onClick={apply} disabled={!items.length || saving || loading}>
                        {saving ? <Spinner /> : t('final_report.sign.save_signed', 'Save signed report')}
                    </Button>
                </div>
            </div>
        </Modal>,
        document.body
    );
}

// ============================================================================
// CAPTURING THE SUMMARY AND RECOMMENDATIONS FROM THE REPORT PDF
//
// A report is written in Word and uploaded as a PDF, so its summary and
// recommendations already exist — typing them into the form again is the step
// nobody does. When a report PDF is uploaded its text is read here, in the
// browser, and the Summary and Recommendations sections are found by their
// headings (English or Arabic). What is found is shown for a quick check
// before it is saved: headings differ from report to report, so it is a
// pre-filled form, never a silent write.
//
// A scanned PDF has no text to read; that is said plainly and nothing is filled.
// ============================================================================

const ARABIC_RE = /[؀-ۿ]/;
const SECTION_HEADINGS = {
    summary: [
        /^(executive|course|training|brief)?\s*summary\b/i, /^overview\b/i, /^abstract\b/i,
        /^(ال)?ملخص/, /^(ال)?خلاصة/,
    ],
    recommendations: [
        /^(key|main|general|major)?\s*recommendations?\b/i, /^(the\s+)?way\s+forward\b/i,
        /^next\s+steps\b/i, /^action\s+(points|plan|items)\b/i,
        /^(ال)?توصيات/,
    ],
};
// Headings that END a section: whatever comes after the recommendations.
const OTHER_HEADINGS = [
    /^(background|introduction|objectives?|methodology|methods|results?|findings|achievements?|challenges?|constraints|lessons\s+learn(ed|t)|conclusions?|annex(es)?|appendi(x|ces)|participants|facilitators|attendance|pre[-\s]?test|post[-\s]?test|evaluation|budget|acknowledge?ments?|table\s+of\s+contents|contents|course\s+(objectives|methodology|organi[sz]ation|management|evaluation|results))\b/i,
    /^(ال)?(مقدمة|أهداف|اهداف|منهجية|نتائج|تحديات|خاتمة|ملاحق|ملحق|مشاركين|ميسرين|دروس المستفادة|الدروس المستفادة|تقييم|الميزانية)/,
];
const NUMBERING_RE = /^\s*(?:[IVX]+\.|\d+(?:\.\d+)*[.)]?|[A-Za-z][.)]|[٠-٩]+[.)\-]?|[•▪●○■□➢►✓✔*\-–])\s*/;
const BULLET_RE = /^\s*(?:[•▪●○■□➢►✓✔*\-–]|\(?\d{1,2}[.)]|\(?[a-z][.)]|\(?[٠-٩]{1,2}[.)\-]|\(?[ivx]{1,4}[.)])\s+/i;

const headingText = (t) => t.replace(NUMBERING_RE, '').replace(/[:：\s]+$/, '').trim();

/** The PDF's text as lines (and wide-gap cells, for tables), top to bottom. */
const readPdfLines = async (data, maxPages = 40) => {
    const pdfjs = await loadPdfjs();
    const doc = await pdfjs.getDocument({ data }).promise;
    const lines = [];
    for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
        const page = await doc.getPage(n);
        const { items } = await page.getTextContent();
        const rows = [];
        for (const it of items) {
            if (!it.str || !it.str.trim()) continue;
            const [a, b, c, d, x, y] = it.transform;
            const size = Math.hypot(c, d) || Math.hypot(a, b) || it.height || 10;
            let row = rows.find(r => Math.abs(r.y - y) < Math.max(2, Math.min(r.size, size) * 0.45));
            if (!row) rows.push(row = { y, size, items: [] });
            // NFKC: many PDFs store Arabic as presentation forms (ﺍﻟﺘﻮﺻﻴﺎﺕ) and
            // Latin with ligatures (ﬁ); this turns both back into plain letters.
            row.items.push({ x, w: it.width || 0, str: it.str.normalize('NFKC') });
            row.size = Math.max(row.size, size);
        }
        rows.sort((p, q) => q.y - p.y);
        for (const r of rows) {
            const rtl = ARABIC_RE.test(r.items.map(i => i.str).join(''));
            r.items.sort((p, q) => (rtl ? q.x - p.x : p.x - q.x));
            const cells = [];
            let cur = null, prevEnd = null;
            for (const it of r.items) {
                const gap = prevEnd == null ? 0 : (rtl ? prevEnd - (it.x + it.w) : it.x - prevEnd);
                if (!cur || gap > r.size * 2.5) {
                    cur = { text: it.str };
                    cells.push(cur);
                } else {
                    const needsSpace = gap > r.size * 0.15 && !/\s$/.test(cur.text) && !/^\s/.test(it.str);
                    cur.text += (needsSpace ? ' ' : '') + it.str;
                }
                prevEnd = rtl ? it.x : it.x + it.w;
            }
            const cellTexts = cells.map(cl => {
                const t = cl.text.replace(/\s+/g, ' ').trim();
                // Some writers store an Arabic line's closing full stop first.
                return rtl ? t.replace(/^([.،,:;!؟?]+)\s*(.+)$/, '$2$1') : t;
            }).filter(Boolean);
            if (cellTexts.length) lines.push({ page: n, y: r.y, size: r.size, text: cellTexts.join('  '), cells: cellTexts });
        }
    }
    return lines;
};

const isPageClutter = (t) => /^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/i.test(t) || /^صفحة\s*\d+/.test(t);

/** Where each section starts and ends. */
const findSection = (lines, kind, bodySize) => {
    const own = SECTION_HEADINGS[kind];
    const others = [...OTHER_HEADINGS, ...Object.entries(SECTION_HEADINGS).filter(([k]) => k !== kind).flatMap(([, v]) => v)];
    const start = lines.findIndex(l => {
        const h = headingText(l.text);
        return h.length <= 70 && own.some(re => re.test(h));
    });
    if (start < 0) return null;
    // "Summary: the course was…" — content on the heading's own line.
    const inline = lines[start].text.split(/[:：]/).slice(1).join(':').trim();
    const body = inline.length > 15 ? [{ ...lines[start], text: inline, cells: [inline] }] : [];
    for (let i = start + 1; i < lines.length; i++) {
        const l = lines[i];
        const h = headingText(l.text);
        const looksLikeHeading = h.length <= 70 && h.split(/\s+/).length <= 9 && !/[.;,،]$/.test(h)
            && (others.some(re => re.test(h)) || l.size > bodySize * 1.2);
        if (looksLikeHeading && body.length) break;
        if (looksLikeHeading) continue; // a sub-title straight under the heading
        if (isPageClutter(l.text)) continue;
        body.push(l);
    }
    return body;
};

const paragraphsOf = (lines) => {
    const out = [];
    let prev = null;
    for (const l of lines) {
        const gap = prev && prev.page === l.page ? prev.y - l.y : 0;
        if (!prev || gap > l.size * 1.9) out.push(l.text);
        else out[out.length - 1] += (ARABIC_RE.test(l.text) ? ' ' : ' ') + l.text;
        prev = l;
    }
    return out.map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
};

const RESPONSIBLE_RE = /[(\[–\-,]?\s*(?:responsible|responsibility|by|lead|المسؤول|الجهة المسؤولة|المسئول)\s*[:\-–]\s*([^)\]]+)[)\]]?\s*$/i;

const splitRecommendations = (lines) => {
    if (!lines.length) return [];
    // A table: a header row naming the recommendation and who is responsible.
    const headerIdx = lines.findIndex(l => l.cells.length >= 2
        && l.cells.some(c => /recommend|توصي/i.test(c)));
    if (headerIdx >= 0) {
        const head = lines[headerIdx].cells;
        const recCol = head.findIndex(c => /recommend|توصي/i.test(c));
        const respCol = head.findIndex(c => /responsib|by whom|lead|المسؤول|الجهة|المسئول/i.test(c));
        const out = [];
        for (const l of lines.slice(headerIdx + 1)) {
            let cells = l.cells;
            // The number column, when the table has one.
            if (cells.length > head.length - 1 && /^\d{1,2}[.)]?$/.test(cells[0]) && !/^\d/.test(head[0] || '')) cells = cells.slice(1);
            if (cells.length >= 2) {
                out.push({
                    recommendation: cells[Math.min(recCol, cells.length - 1)] || cells[0],
                    responsible: respCol >= 0 ? (cells[respCol] || '') : '',
                });
            } else if (out.length) {
                out[out.length - 1].recommendation += ` ${cells[0]}`;
            }
        }
        if (out.length) return out;
    }
    // A list: bullets or numbers start an item, other lines continue it.
    const hasBullets = lines.some(l => BULLET_RE.test(l.text));
    const items = [];
    if (hasBullets) {
        for (const l of lines) {
            if (BULLET_RE.test(l.text) || !items.length) items.push(l.text.replace(BULLET_RE, ''));
            else items[items.length - 1] += ` ${l.text}`;
        }
    } else {
        // Plain paragraphs: one recommendation per paragraph.
        items.push(...paragraphsOf(lines));
    }
    return items.map(t => {
        const text = t.replace(/\s+/g, ' ').trim();
        const m = text.match(RESPONSIBLE_RE);
        return m
            ? { recommendation: text.slice(0, m.index).replace(/[\s,;–\-]+$/, ''), responsible: m[1].trim() }
            : { recommendation: text, responsible: '' };
    });
};

/**
 * Find the summary and recommendations in a report PDF.
 * @param source a File or a stored URL
 * @returns {{ summary: string, recommendations: object[], noText: boolean }}
 */
export const captureReportContent = async (source) => {
    const bytes = await pdfBytesOf(source);
    const lines = await readPdfLines(bytes);
    const textChars = lines.reduce((n, l) => n + l.text.length, 0);
    if (textChars < 40) return { summary: '', recommendations: [], noText: true };

    const sizes = lines.map(l => l.size).sort((a, b) => a - b);
    const bodySize = sizes[Math.floor(sizes.length / 2)] || 10;

    const summaryLines = findSection(lines, 'summary', bodySize) || [];
    const recLines = findSection(lines, 'recommendations', bodySize) || [];

    const summary = paragraphsOf(summaryLines).join('\n\n').slice(0, 4000);
    const recommendations = splitRecommendations(recLines)
        .filter(r => r.recommendation && r.recommendation.length >= 8)
        .slice(0, 40)
        .map(r => ({ ...r, status: 'pending', theme: autoTheme(r.recommendation) }));
    return { summary, recommendations, noText: false };
};

// --- Recommendation themes --------------------------------------------------
// The thread that links one course's recommendations to another's. Each
// recommendation gets a theme from its wording (English or Arabic); the person
// checking can change it, and a theme set by hand is kept.
export const RECOMMENDATION_THEMES = [
    { id: 'supplies', label: 'Drugs, supplies & equipment', re: /\bdrugs?\b|medicine|medication|suppl(y|ies)|stock|equipment|\bkits?\b|\bors\b|zinc|amoxicillin|commodit|registers?|chart\s*booklet|job\s*aids?|thermometer|weighing|timers?|أدوية|دواء|الإمداد|معدات|أجهزة|مستلزمات|مخزون/i },
    { id: 'training', label: 'Training & capacity building', re: /train|refresher|capacity|module|curricul|facilitators?|\btot\b|mentor|on[-\s]job|تدريب|دورة|دورات|بناء القدرات|تنشيط|ميسر/i },
    { id: 'supervision', label: 'Supervision & follow-up', re: /supervis|follow[-\s]?up|monitor|visits?|coach|إشراف|اشراف|متابعة|زيارة|زيارات|رصد/i },
    { id: 'staffing', label: 'Staffing & retention', re: /\bstaff|human\s+resources?|\bhr\b|retention|incentive|recruit|deploy|workforce|turnover|الكوادر|كوادر|الموارد البشرية|حوافز|تعيين|توظيف/i },
    { id: 'facility', label: 'Health facilities & services', re: /\bfacility\b|\bfacilities\b|health\s+cent|clinic|hospital|service\s+delivery|infrastructure|\bwater\b|electric|المرفق|المرافق|المركز الصحي|المراكز الصحية|مستشفى|البنية التحتية/i },
    { id: 'data', label: 'Data, reporting & HMIS', re: /\bdata\b|reporting|\bhmis\b|dhis|record\s*keeping|documentation|indicators?|بيانات|التقارير|التبليغ|التسجيل|مؤشرات/i },
    { id: 'logistics', label: 'Course logistics & organisation', re: /venue|logistic|transport|accommodation|\bhall\b|schedul|timing|catering|per\s*diem|stationery|المكان|القاعة|الترحيل|المواصلات|السكن|الجدول الزمني|النثريات/i },
    { id: 'funding', label: 'Funding & partners', re: /fund|budget|partners?|donors?|unicef|\bwho\b|financ|تمويل|ميزانية|الشركاء|المانحين|يونيسف/i },
    { id: 'community', label: 'Community & caregivers', re: /communit|caregivers?|mothers?|households?|awareness|c[-\s]?imci|\biccm\b|المجتمع|الأمهات|الامهات|توعية|الأسر/i },
    { id: 'coordination', label: 'Coordination & policy', re: /coordinat|policy|policies|ministry|\bsmoh\b|\bfmoh\b|guidelines?|protocols?|integrat|تنسيق|سياسات|الوزارة|وزارة|موجهات|بروتوكول|دمج/i },
];
export const OTHER_THEME = { id: 'other', label: 'Other' };
const THEME_BY_ID = Object.fromEntries([...RECOMMENDATION_THEMES, OTHER_THEME].map(t => [t.id, t]));

/**
 * The theme a recommendation's wording points to most. On a tie, the one
 * named first wins: a recommendation leads with what it asks for ("follow up
 * the trainees after the course" is follow-up, not training).
 */
export const autoTheme = (text) => {
    const s = String(text || '');
    let best = OTHER_THEME.id, score = 0, first = Infinity;
    for (const t of RECOMMENDATION_THEMES) {
        const re = new RegExp(t.re.source, 'gi');
        const hits = [...s.matchAll(re)];
        if (!hits.length) continue;
        const at = hits[0].index;
        if (hits.length > score || (hits.length === score && at < first)) { best = t.id; score = hits.length; first = at; }
    }
    return best;
};
export const themeOf = (rec) => (rec?.theme && THEME_BY_ID[rec.theme] ? rec.theme : autoTheme(rec?.recommendation));
export const themeLabel = (id) => THEME_BY_ID[id]?.label || 'Other';

const REC_STATUSES = [['pending', 'Pending'], ['in-progress', 'In progress'], ['completed', 'Completed']];

// Shown words for a theme and a status; the stored values stay as they are.
const themeText = (t, id) => t(`final_report.themes.${id}`, themeLabel(id));
const REC_STATUS_KEY = { pending: 'pending', 'in-progress': 'in_progress', completed: 'completed' };
const recStatusText = (t, s) => (!s ? t('final_report.rec_status.not_set', 'Not set')
    : REC_STATUS_KEY[s] ? t(`final_report.rec_status.${REC_STATUS_KEY[s]}`, recStatusLabel(s))
    : recStatusLabel(s));

/**
 * Check what was found in the PDF, then save it. Also the place to type them
 * in when the PDF had nothing to find.
 *
 * @param capture  { summary, recommendations, noText } from captureReportContent
 * @param existing the report's current summary and recommendations
 * @param onApply  async ({ summary, recommendations }) => void
 */
export function CaptureReportContentModal({ isOpen, onClose, capture, existing, onApply }) {
    const { t } = useTranslation();
    const [summary, setSummary] = useState('');
    const [recs, setRecs] = useState([]);
    const [replaceSummary, setReplaceSummary] = useState(true);
    const [recMode, setRecMode] = useState('replace');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const hadSummary = !!existing?.summary?.trim();
    const hadRecs = (existing?.recommendations || []).filter(r => r?.recommendation).length;

    useEffect(() => {
        if (!isOpen) return;
        setSummary(capture?.summary || '');
        setRecs((capture?.recommendations || []).map(r => ({ ...r })));
        setReplaceSummary(!hadSummary || !!capture?.summary);
        setRecMode(hadRecs ? 'add' : 'replace');
        setError(null);
    }, [isOpen, capture]); // eslint-disable-line react-hooks/exhaustive-deps

    const setRec = (i, patch) => setRecs(prev => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

    const apply = async () => {
        setSaving(true);
        setError(null);
        try {
            const clean = recs.filter(r => r.recommendation?.trim()).map(r => ({
                recommendation: r.recommendation.trim(),
                responsible: (r.responsible || '').trim(),
                status: r.status || 'pending',
                theme: r.theme || autoTheme(r.recommendation),
            }));
            await onApply({
                summary: replaceSummary ? summary.trim() : (existing?.summary || ''),
                recommendations: recMode === 'add'
                    ? [...(existing?.recommendations || []).filter(r => r?.recommendation), ...clean]
                    : clean,
            });
            onClose();
        } catch (e) {
            setError(e.message || t('final_report.capture.save_failed', 'Could not save.'));
        } finally {
            setSaving(false);
        }
    };

    const found = (capture?.summary ? 1 : 0) + (capture?.recommendations?.length || 0);
    return createPortal(
        <Modal isOpen={isOpen} onClose={saving ? undefined : onClose} title={t('final_report.capture.title', 'Summary and recommendations from the report')}>
            <div className="space-y-4">
                <p className={`text-sm rounded p-2 ${capture?.noText ? 'bg-amber-50 text-amber-800' : found ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-600'}`}>
                    {capture?.noText
                        ? t('final_report.capture.no_text', 'This PDF has no text to read (it looks scanned), so nothing could be captured. You can type the summary and recommendations here.')
                        : found
                            ? (capture.summary
                                ? (capture.recommendations.length === 1
                                    ? t('final_report.capture.found_summary_one', 'Found the summary and {{n}} recommendation in the PDF. Check them, then save.', { n: capture.recommendations.length })
                                    : t('final_report.capture.found_summary_many', 'Found the summary and {{n}} recommendations in the PDF. Check them, then save.', { n: capture.recommendations.length }))
                                : (capture.recommendations.length === 1
                                    ? t('final_report.capture.found_nosummary_one', 'Found no summary and {{n}} recommendation in the PDF. Check them, then save.', { n: capture.recommendations.length })
                                    : t('final_report.capture.found_nosummary_many', 'Found no summary and {{n}} recommendations in the PDF. Check them, then save.', { n: capture.recommendations.length })))
                            : t('final_report.capture.not_found', 'No Summary or Recommendations heading was found in the PDF. You can type them here.')}
                </p>

                <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{t('final_report.capture.course_summary', 'Course summary')}</h4>
                        {hadSummary && (
                            <label className="flex items-center gap-1.5 text-xs text-slate-600">
                                <input type="checkbox" checked={replaceSummary} onChange={e => setReplaceSummary(e.target.checked)} />
                                {t('final_report.capture.replace_summary', 'Replace the summary already saved')}
                            </label>
                        )}
                    </div>
                    <Textarea rows="5" value={summary} onChange={e => setSummary(e.target.value)} disabled={hadSummary && !replaceSummary}
                        placeholder={t('final_report.capture.summary_placeholder', 'The course summary')} dir="auto" />
                </div>

                <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{t('final_report.capture.recommendations_count', 'Recommendations ({{n}})', { n: recs.length })}</h4>
                        {hadRecs > 0 && (
                            <Select value={recMode} onChange={e => setRecMode(e.target.value)} className="text-xs w-auto">
                                <option value="add">{t('final_report.capture.add_to_saved', 'Add to the {{n}} already saved', { n: hadRecs })}</option>
                                <option value="replace">{t('final_report.capture.replace_saved', 'Replace the {{n}} already saved', { n: hadRecs })}</option>
                            </Select>
                        )}
                    </div>
                    <div className="space-y-2">
                        {recs.map((r, i) => (
                            <div key={i} className="border rounded-lg p-2 bg-white space-y-2">
                                <div className="flex gap-2">
                                    <div className="flex-1 min-w-0">
                                        <Textarea rows="2" value={r.recommendation} dir="auto"
                                            onChange={e => setRec(i, { recommendation: e.target.value })} />
                                    </div>
                                    <button type="button" aria-label={t('final_report.buttons.remove', 'Remove')} className="text-red-600 hover:text-red-800 self-start p-1"
                                        onClick={() => setRecs(prev => prev.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <Input value={r.responsible || ''} placeholder={t('final_report.table.responsible', 'Responsible')} dir="auto"
                                        onChange={e => setRec(i, { responsible: e.target.value })} />
                                    <Select value={r.theme || autoTheme(r.recommendation)} onChange={e => setRec(i, { theme: e.target.value })}>
                                        {[...RECOMMENDATION_THEMES, OTHER_THEME].map(th => <option key={th.id} value={th.id}>{themeText(t, th.id)}</option>)}
                                    </Select>
                                    <Select value={r.status || 'pending'} onChange={e => setRec(i, { status: e.target.value })}>
                                        {REC_STATUSES.map(([v]) => <option key={v} value={v}>{recStatusText(t, v)}</option>)}
                                    </Select>
                                </div>
                            </div>
                        ))}
                        <Button variant="secondary" className="text-xs"
                            onClick={() => setRecs(prev => [...prev, { recommendation: '', responsible: '', status: 'pending', theme: '' }])}>
                            {t('final_report.capture.add_recommendation', 'Add a recommendation')}
                        </Button>
                    </div>
                </div>

                {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>{t('final_report.capture.skip', 'Skip')}</Button>
                    <Button onClick={apply} disabled={saving || (!summary.trim() && !recs.some(r => r.recommendation?.trim()))}>
                        {saving ? <Spinner /> : t('final_report.capture.save', 'Save to the final report')}
                    </Button>
                </div>
            </div>
        </Modal>,
        document.body
    );
}

// ============================================================================
// THE ONE REPORT DOCUMENT
//
// A course has one final report document to show: the signed copy once there
// is one, the unsigned report until then. Showing both side by side invited
// people to send the unsigned one.
// ============================================================================

/** The document to show, and what to call it. */
export const currentReportDocument = (report, course) => {
    const signed = !!report?.signedPdfUrl;
    const url = signed ? report.signedPdfUrl : report?.pdfUrl;
    if (!url) return null;
    const fileName = `Final_Report${signed ? '_Signed' : ''}_${course?.course_type || 'Course'}_${course?.state || ''}.pdf`
        .replace(/[^\w.-]+/g, '_');
    return { url, signed, fileName };
};

const fetchPdfFile = async (url, fileName) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok.');
    return new File([await response.blob()], fileName, { type: 'application/pdf' });
};

/** Save the PDF to the device. */
export const downloadReportPdf = async (url, fileName) => {
    if (Capacitor.isNativePlatform()) {
        const { downloadAndOpenFile } = await import('../utils/fileDownloader');
        await downloadAndOpenFile(url, fileName, { onError: (e) => notify(e.message, 'error') });
        return;
    }
    try {
        const blobUrl = URL.createObjectURL(await fetchPdfFile(url, fileName));
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (error) {
        console.error('Download failed:', error);
        window.open(url, '_blank');
    }
};

/**
 * Share the PDF itself where the device can (phones, most browsers), else a
 * link to it, else copy that link.
 */
export const shareReportPdf = async (url, fileName, title = 'Final report') => {
    const cancelled = (e) => e?.name === 'AbortError';
    if (navigator.share && navigator.canShare) {
        try {
            const file = await fetchPdfFile(url, fileName);
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title });
                return;
            }
        } catch (e) {
            if (cancelled(e)) return;
            console.warn('[Share] file share failed, sharing the link', e);
        }
    }
    if (navigator.share) {
        try { await navigator.share({ title, url }); return; } catch (e) { if (cancelled(e)) return; }
    }
    try {
        await navigator.clipboard.writeText(url);
        notify(i18n.t('final_report.share.link_copied', 'Link to the report copied — paste it to share.'), 'success');
    } catch {
        await promptDialog(i18n.t('final_report.share.copy_link', 'Copy this link to share the report:'), { defaultValue: url, title: i18n.t('final_report.buttons.share', 'Share') });
    }
};

/**
 * The report document with View, Download and Share. `children` adds the
 * managing buttons where the user may change it.
 */
export function ReportDocumentCard({ report, course, children }) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(null);
    const docInfo = currentReportDocument(report, course);
    const layout = report?.signatureLayout;
    const approval = layout?.items?.find(i => i.kind === 'text');
    const stale = docInfo?.signed && layout?.reportUrl && report?.pdfUrl && layout.reportUrl !== report.pdfUrl;

    const run = (what, fn) => async () => {
        setBusy(what);
        try { await fn(); } finally { setBusy(null); }
    };

    return (
        <div className={`rounded-lg border p-4 ${docInfo?.signed ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-300 bg-white'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                    <PdfIcon className={`w-6 h-6 shrink-0 ${docInfo?.signed ? 'text-emerald-600' : docInfo ? 'text-blue-500' : 'text-slate-400'}`} />
                    <div className="min-w-0">
                        <div className={`font-semibold ${docInfo?.signed ? 'text-emerald-800' : 'text-slate-800'}`}>
                            {docInfo ? (docInfo.signed ? t('final_report.doc.signed_report', 'Signed final report') : t('final_report.doc.report_pdf', 'Final report PDF')) : t('final_report.doc.no_pdf', 'No report PDF attached')}
                        </div>
                        <div className="text-xs text-slate-500">
                            {!docInfo ? t('final_report.doc.attach_then_sign', 'Attach the final report PDF, then sign it here.')
                                : !docInfo.signed ? t('final_report.doc.not_signed', 'Not signed yet')
                                : approval ? t('final_report.doc.approved_by', 'Approved by {{name}} · {{date}}', { name: approval.name || '—', date: formatDate(approval.date) })
                                : t('final_report.doc.signed_in_app', 'Signed in the app')}
                        </div>
                        {stale && (
                            <div className="text-xs text-amber-700 mt-1">
                                {t('final_report.doc.stale', 'The report PDF was replaced after it was signed — edit the signature to sign the new one.')}
                            </div>
                        )}
                    </div>
                </div>
                {docInfo && (
                    <div className="grid grid-cols-3 sm:flex gap-2 shrink-0">
                        <a href={docInfo.url} target="_blank" rel="noopener noreferrer" className="contents">
                            <Button variant="secondary" className="justify-center text-sm"><Eye className="w-4 h-4 mr-1" />{t('final_report.buttons.view', 'View')}</Button>
                        </a>
                        <Button variant="secondary" className="justify-center text-sm" disabled={!!busy}
                            onClick={run('download', () => downloadReportPdf(docInfo.url, docInfo.fileName))}>
                            {busy === 'download' ? <Spinner size="sm" /> : <><Download className="w-4 h-4 mr-1" />{t('final_report.buttons.download', 'Download')}</>}
                        </Button>
                        <Button variant="secondary" className="justify-center text-sm" disabled={!!busy}
                            onClick={run('share', () => shareReportPdf(docInfo.url, docInfo.fileName,
                                `Final report — ${course?.course_type || ''} ${course?.state || ''}`.trim()))}>
                            {busy === 'share' ? <Spinner size="sm" /> : <><Share2 className="w-4 h-4 mr-1" />{t('final_report.buttons.share', 'Share')}</>}
                        </Button>
                    </div>
                )}
            </div>
            {children && <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-200">{children}</div>}
        </div>
    );
}

/**
 * The report document with everything that can be done to it: attach or
 * replace the report PDF, sign and stamp it, edit or delete the signature,
 * remove it — plus View, Download and Share from the card.
 *
 * Used on the course report screen and in the course list's Final report
 * popup. Both write the same fields on the same final report document as the
 * editor, so whichever route is used the others see it, and the document is
 * created if the course has not got one yet.
 *
 * @param finalReport the course's final report (or null)
 * @param onChanged   given the saved report after every change
 * @param say         (message, type) => void, for the result
 * @param ready       false while only a cached copy is shown: the buttons that
 *                    change the report wait for the fresh one
 */
export function ReportDocumentManager({ course, finalReport, onChanged: notifyChanged, say = notify, ready = true }) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { mergeIntoCache } = useDataCache();
    // Every change also goes into the shared cache, so the course list's labels
    // and the Final Reports dashboard show it without fetching.
    const onChanged = (saved) => {
        notifyChanged?.(saved);
        if (saved?.id) mergeIntoCache?.('finalReports', lightFinalReport(saved));
    };
    const who = user?.displayName || user?.email || 'Unknown';
    const [busy, setBusy] = useState(null);
    const [signerOpen, setSignerOpen] = useState(false);
    const [captured, setCaptured] = useState(null);
    const reportInput = useRef(null);

    const reportUrl = finalReport?.pdfUrl || null;
    const signedUrl = finalReport?.signedPdfUrl || null;

    // Read the summary and recommendations out of the report PDF and show
    // them for checking. From the File just chosen when there is one, so
    // nothing is downloaded again.
    const capture = async (source) => {
        setBusy('capture');
        try {
            setCaptured(await captureReportContent(source));
        } catch (err) {
            console.error('[FinalReport] capture failed', err);
            say(t('final_report.manage.read_failed', 'Could not read the PDF: {{error}}', { error: err.message }), 'error');
        } finally { setBusy(null); }
    };

    const saveCaptured = async ({ summary, recommendations }) => {
        onChanged?.(await updateFinalReportContent(course.id, { summary, recommendations }, who));
        say(t('final_report.manage.content_saved', 'Summary and recommendations saved to the final report.'), 'success');
    };

    const attachReport = async (file) => {
        if (!file) return;
        if (file.type && file.type !== 'application/pdf') {
            say(t('final_report.manage.not_pdf', 'That is not a PDF file.'), 'error');
            return;
        }
        setBusy('report');
        let attached = false;
        try {
            onChanged?.(await attachFinalReportPdf(course.id, file, 'report', who));
            attached = true;
            say(signedUrl ? t('final_report.manage.pdf_replaced', 'Report PDF replaced. Edit the signature to sign the new one.') : t('final_report.manage.pdf_attached', 'Report PDF attached.'), 'success');
        } catch (err) {
            say(t('final_report.manage.upload_failed', 'Upload failed: {{error}}', { error: err.message }), 'error');
        } finally {
            setBusy(null);
            if (reportInput.current) reportInput.current.value = '';
        }
        if (attached) await capture(file);
    };

    // Filed with the layout that made it, so the signature can be edited.
    const fileSigned = async (file, layout) => {
        setBusy('signed');
        try {
            onChanged?.(await attachFinalReportPdf(course.id, file, 'signed', who, { signatureLayout: layout }));
            say(t('final_report.manage.signed_saved', 'Signed report saved.'), 'success');
        } finally {
            setBusy(null);
        }
    };

    const deleteSignature = async () => {
        if (!await confirmDialog(t('final_report.manage.confirm_delete_signature', 'Delete the signature? The unsigned report PDF is kept.'), { danger: true, confirmLabel: t('final_report.buttons.delete_signature', 'Delete signature') })) return;
        setBusy('signed');
        try {
            onChanged?.(await removeFinalReportPdf(course.id, 'signed', who));
            say(t('final_report.manage.signature_deleted', 'Signature deleted.'), 'info');
        } catch (err) {
            say(t('final_report.manage.delete_failed', 'Could not delete it: {{error}}', { error: err.message }), 'error');
        } finally { setBusy(null); }
    };

    // The report goes with its signed copy: a signed copy of a report that is
    // no longer there could not be edited.
    const removeReport = async () => {
        const message = signedUrl
            ? t('final_report.manage.confirm_remove_signed', 'Remove the final report PDF? Its signed copy is removed too.')
            : t('final_report.manage.confirm_remove', 'Remove the final report PDF?');
        if (!await confirmDialog(message, { danger: true, confirmLabel: t('final_report.buttons.remove', 'Remove') })) return;
        setBusy('report');
        try {
            if (signedUrl) await removeFinalReportPdf(course.id, 'signed', who);
            onChanged?.(await removeFinalReportPdf(course.id, 'report', who));
            say(t('final_report.manage.removed', 'Removed.'), 'info');
        } catch (err) {
            say(t('final_report.manage.remove_failed', 'Could not remove it: {{error}}', { error: err.message }), 'error');
        } finally { setBusy(null); }
    };

    const btn = 'text-xs justify-center';
    return (
        <>
            <input ref={reportInput} type="file" accept="application/pdf,.pdf" className="hidden"
                onChange={(e) => attachReport(e.target.files?.[0])} />
            <ReportDocumentCard report={finalReport} course={course}>
                <Button variant={reportUrl ? 'secondary' : 'primary'} disabled={!!busy || !ready}
                    onClick={() => reportInput.current?.click()} className={btn}>
                    {busy === 'report' ? <Spinner size="sm" /> : (reportUrl ? t('final_report.manage.replace_pdf', 'Replace report PDF') : t('final_report.manage.add_pdf', 'Add report PDF'))}
                </Button>
                {reportUrl && (signedUrl ? (
                    <>
                        <Button variant="primary" disabled={!!busy || !ready} onClick={() => setSignerOpen(true)} className={btn}>
                            {busy === 'signed' ? <Spinner size="sm" /> : <><PenLine className="w-4 h-4 mr-1" />{t('final_report.buttons.edit_signature', 'Edit signature')}</>}
                        </Button>
                        <Button variant="danger" disabled={!!busy || !ready} onClick={deleteSignature} className={btn}>{t('final_report.buttons.delete_signature', 'Delete signature')}</Button>
                    </>
                ) : (
                    <Button variant="primary" disabled={!!busy || !ready} onClick={() => setSignerOpen(true)} className={btn}>
                        {busy === 'signed' ? <Spinner size="sm" /> : <><PenLine className="w-4 h-4 mr-1" />{t('final_report.buttons.sign_stamp', 'Sign & stamp')}</>}
                    </Button>
                ))}
                {reportUrl && (
                    <Button variant="secondary" disabled={!!busy || !ready} onClick={() => capture(reportUrl)} className={btn}
                        title={t('final_report.manage.capture_hint', 'Read the summary and recommendations from the report PDF')}>
                        {busy === 'capture' ? <><Spinner size="sm" /> {t('final_report.manage.reading_pdf', 'Reading the PDF…')}</> : t('final_report.manage.capture', 'Capture summary & recommendations')}
                    </Button>
                )}
                {(reportUrl || signedUrl) && (
                    <Button variant="danger" disabled={!!busy || !ready} onClick={removeReport} className={btn}>{t('final_report.manage.remove_report', 'Remove report')}</Button>
                )}
            </ReportDocumentCard>
            <CaptureReportContentModal isOpen={!!captured} onClose={() => setCaptured(null)}
                capture={captured} existing={finalReport} onApply={saveCaptured} />
            <SignAndStampModal isOpen={signerOpen} onClose={() => setSignerOpen(false)}
                source={reportUrl} course={course} onSigned={fileSigned}
                initialLayout={signedUrl ? finalReport?.signatureLayout : null} signerName={user?.displayName || ''} />
        </>
    );
}

/**
 * The course list's Final report popup: add, sign, download and share the
 * report document without opening the course. Federal managers and super
 * users only — the caller decides who sees the button.
 */
export function FinalReportQuickModal({ course, isOpen, onClose, onOpenFullReport, onReportChanged }) {
    const { t } = useTranslation();
    const { finalReports } = useDataCache();
    const [report, setReport] = useState(undefined);
    const [fresh, setFresh] = useState(false);
    const [loadError, setLoadError] = useState(null);

    useEffect(() => {
        if (!isOpen || !course?.id) return undefined;
        let cancelled = false;
        // The cached copy shows at once, so View, Download and Share work
        // straight away; this one report is then read fresh from the server (the
        // signed copy is often added from another device) before it is changed.
        const cached = (finalReports || []).find(r => r.courseId === course.id && r.isDeleted !== true);
        setReport(cached !== undefined ? cached : (finalReports ? null : undefined));
        setFresh(false);
        setLoadError(null);
        getFinalReportByCourseId(course.id, { source: 'server' })
            .catch(() => getFinalReportByCourseId(course.id))
            .then(r => { if (!cancelled) { setReport(r || null); setFresh(true); } })
            .catch(e => { if (!cancelled) setLoadError(e.message || t('final_report.quick.load_failed', 'Could not load the final report.')); });
        return () => { cancelled = true; };
    }, [isOpen, course?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- the cache is read once per open

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('final_report.quick.title', 'Final report — {{type}} {{state}}', { type: course?.course_type || '', state: course?.state ? `(${course.state})` : '' })}>
            <div className="space-y-4">
                {loadError && report === undefined ? (
                    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{loadError}</div>
                ) : report === undefined ? (
                    <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500"><Spinner /> {t('final_report.quick.loading', 'Loading the final report…')}</div>
                ) : (
                    <>
                        <ReportDocumentManager course={course} finalReport={report} ready={fresh}
                            onChanged={(saved) => { setReport(saved); onReportChanged?.(saved); }} />
                        {!fresh && (loadError
                            ? <p className="text-xs text-amber-700">{t('final_report.quick.offline', 'Could not reach the server — showing the saved copy. Changes need a connection.')}</p>
                            : <p className="text-xs text-slate-500 flex items-center gap-1"><Spinner size="sm" /> {t('final_report.quick.checking', 'Checking for the latest version…')}</p>)}
                    </>
                )}
                <div className="flex flex-col sm:flex-row sm:justify-between gap-2 pt-3 border-t">
                    {onOpenFullReport ? (
                        <Button variant="secondary" onClick={() => { onClose(); onOpenFullReport(course.id); }} className="justify-center">
                            {report?.summary ? t('final_report.open_full', 'Open the full final report') : t('final_report.quick.write_full', 'Write the final report (summary, recommendations…)')}
                        </Button>
                    ) : <span />}
                    <Button variant="secondary" onClick={onClose} className="justify-center">{t('final_report.buttons.close', 'Close')}</Button>
                </div>
            </div>
        </Modal>
    );
}

// ============================================================================
// FINAL REPORTS DASHBOARD
//
// Every course of the package with its final report: whether it is uploaded
// and signed, the summary, the recommendations and the potential facilitators,
// in one place. Federal managers and super users only — the caller decides.
// ============================================================================

const REC_STATUS_STYLE = {
    completed: 'bg-emerald-100 text-emerald-800',
    'in-progress': 'bg-blue-100 text-blue-800',
    pending: 'bg-amber-100 text-amber-800',
};
const recStatusLabel = (s) => (s === 'in-progress' ? 'In progress' : s ? s[0].toUpperCase() + s.slice(1) : 'Not set');

const courseDateOf = (c) => {
    const d = c?.start_date ? new Date(c.start_date) : null;
    return d && !isNaN(d) ? d : null;
};
const courseLabelOf = (c) => `${c.state || '—'}${c.locality ? ` - ${c.locality}` : ''}`;

/**
 * @param courses         the courses of the package (already location-filtered)
 * @param reportsByCourse { [courseId]: finalReport }
 * @param onReportChanged (saved) => void, after a change in the popup
 * @param onOpenFullReport (courseId) => void, to write the narrative report
 */
export function FinalReportsDashboard({ courseType, courses, reportsByCourse, loading, onReportChanged, onOpenFullReport }) {
    const { t } = useTranslation();
    const [view, setView] = useState('courses');
    const [stateFilter, setStateFilter] = useState('All');
    const [yearFilter, setYearFilter] = useState('All');
    const [docFilter, setDocFilter] = useState('All');
    const [recFilter, setRecFilter] = useState('open');
    const [search, setSearch] = useState('');
    const [manageCourse, setManageCourse] = useState(null);
    const [expanded, setExpanded] = useState({});
    const [matrixBy, setMatrixBy] = useState('state');
    const [matrixScope, setMatrixScope] = useState('open');
    const [cell, setCell] = useState(null);
    const [savingKey, setSavingKey] = useState(null);
    const { user } = useAuth();
    const { mergeIntoCache } = useDataCache();

    const states = useMemo(() => ['All', ...[...new Set(courses.map(c => c.state).filter(Boolean))].sort()], [courses]);
    const years = useMemo(() => ['All', ...[...new Set(courses.map(c => courseDateOf(c)?.getFullYear()).filter(Boolean))].sort((a, b) => b - a).map(String)], [courses]);

    // Courses in the filters, newest first, each with its report and status.
    const rows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return courses
            .filter(c => stateFilter === 'All' || c.state === stateFilter)
            .filter(c => yearFilter === 'All' || String(courseDateOf(c)?.getFullYear()) === yearFilter)
            .map(c => ({ course: c, report: reportsByCourse[c.id] || null, status: finalReportStatus(reportsByCourse[c.id]) }))
            .filter(({ status }) => docFilter === 'All'
                || (docFilter === 'none' && !status.uploaded)
                || (docFilter === 'unsigned' && status.uploaded && !status.signed)
                || (docFilter === 'signed' && status.signed)
                || (docFilter === 'pending' && status.pending > 0))
            .filter(({ course, report }) => !q || [course.state, course.locality, course.director, report?.summary]
                .some(v => String(v || '').toLowerCase().includes(q)))
            .sort((a, b) => (courseDateOf(b.course)?.getTime() || 0) - (courseDateOf(a.course)?.getTime() || 0));
    }, [courses, reportsByCourse, stateFilter, yearFilter, docFilter, search]);

    const kpis = useMemo(() => ({
        courses: rows.length,
        uploaded: rows.filter(r => r.status.uploaded).length,
        signed: rows.filter(r => r.status.signed).length,
        withPending: rows.filter(r => r.status.pending > 0).length,
        pending: rows.reduce((n, r) => n + r.status.pending, 0),
    }), [rows]);

    // Every recommendation of every course in the filters, each knowing its
    // course, its place in that course's list, and its theme: the theme is
    // what links one course's recommendation to another's.
    const allRecs = useMemo(() => rows.flatMap(({ course, report }) =>
        (report?.recommendations || [])
            .map((r, index) => ({ ...r, index, course, theme: themeOf(r), key: `${course.id}_${index}` }))
            .filter(r => r.recommendation)), [rows]);
    const isOpenRec = (r) => r.status !== 'completed';
    const recommendations = useMemo(() => allRecs
        .filter(r => recFilter === 'all' || (recFilter === 'open' ? isOpenRec(r) : r.status === recFilter)),
    [allRecs, recFilter]);

    // Change one recommendation's status or theme, on its own report.
    const updateRec = async (rec, patch) => {
        setSavingKey(rec.key);
        try {
            const saved = await updateFinalReportContent(rec.course.id, (existing) => {
                const list = [...(existing?.recommendations || [])];
                let i = rec.index;
                if (list[i]?.recommendation !== rec.recommendation) i = list.findIndex(x => x?.recommendation === rec.recommendation);
                if (i < 0) throw new Error('That recommendation has changed since this page loaded. Refresh and try again.');
                list[i] = { ...list[i], ...patch };
                return { recommendations: list };
            }, user?.displayName || user?.email || 'Unknown');
            mergeIntoCache?.('finalReports', lightFinalReport(saved));
            onReportChanged?.(saved);
        } catch (e) {
            notify(t('final_report.dashboard.save_failed', 'Could not save: {{error}}', { error: e.message }), 'error');
        } finally { setSavingKey(null); }
    };

    // The matrix: themes down the side, states / years / courses across.
    const colKeyOf = (r) => (matrixBy === 'state' ? (r.course.state || '—')
        : matrixBy === 'year' ? String(courseDateOf(r.course)?.getFullYear() || '—')
        : r.course.id);
    const colLabelOf = (key) => {
        if (matrixBy !== 'course') return key;
        const c = courses.find(x => x.id === key);
        return c ? `${courseLabelOf(c)}${courseDateOf(c) ? ` (${courseDateOf(c).toLocaleDateString()})` : ''}` : key;
    };
    const matrix = useMemo(() => {
        const scoped = allRecs.filter(r => matrixScope === 'all' || isOpenRec(r));
        const cols = [...new Set(scoped.map(colKeyOf))]
            .sort((a, b) => (matrixBy === 'year' ? b.localeCompare(a) : colLabelOf(a).localeCompare(colLabelOf(b))));
        const themes = [...RECOMMENDATION_THEMES, OTHER_THEME].filter(t => scoped.some(r => r.theme === t.id));
        const cells = {};
        scoped.forEach(r => {
            const k = `${r.theme}|${colKeyOf(r)}`;
            const c = cells[k] || (cells[k] = { total: 0, open: 0 });
            c.total += 1;
            if (isOpenRec(r)) c.open += 1;
        });
        const maxOpen = Math.max(1, ...Object.values(cells).map(c => c.open));
        return { scoped, cols, themes, cells, maxOpen };
    }, [allRecs, matrixBy, matrixScope, courses]); // eslint-disable-line react-hooks/exhaustive-deps
    const cellRecs = cell
        ? matrix.scoped.filter(r => (cell.theme == null || r.theme === cell.theme) && (cell.col == null || colKeyOf(r) === cell.col))
        : [];
    const countText = (recs) => (matrixScope === 'open' ? recs.length : `${recs.filter(isOpenRec).length}/${recs.length}`);

    const recRow = (r) => (
        <tr key={r.key}>
            <td className="p-2 border text-sm whitespace-nowrap">{courseLabelOf(r.course)}<div className="text-xs text-slate-500">{courseDateOf(r.course)?.toLocaleDateString()}</div></td>
            <td className="p-2 border text-sm" dir="auto">{r.recommendation}</td>
            <td className="p-2 border text-sm" dir="auto">{r.responsible || '—'}</td>
            <td className="p-2 border text-sm">
                <select value={r.theme} disabled={savingKey === r.key} onChange={e => updateRec(r, { theme: e.target.value })}
                    className="border border-gray-300 rounded px-1 py-0.5 text-xs max-w-[11rem]">
                    {[...RECOMMENDATION_THEMES, OTHER_THEME].map(th => <option key={th.id} value={th.id}>{themeText(t, th.id)}</option>)}
                </select>
            </td>
            <td className="p-2 border text-sm whitespace-nowrap">
                <select value={r.status || ''} disabled={savingKey === r.key} onChange={e => updateRec(r, { status: e.target.value })}
                    className={`rounded px-1 py-0.5 text-xs font-semibold border-0 ${REC_STATUS_STYLE[r.status] || 'bg-slate-100 text-slate-600'}`}>
                    {!r.status && <option value="">{t('final_report.rec_status.not_set', 'Not set')}</option>}
                    {REC_STATUSES.map(([v]) => <option key={v} value={v}>{recStatusText(t, v)}</option>)}
                </select>
                {savingKey === r.key && <Spinner size="sm" />}
            </td>
        </tr>
    );

    const facilitators = useMemo(() => rows.flatMap(({ course, report }) =>
        (report?.potentialFacilitators || []).filter(f => f?.participant_id || f?.participant_name)
            .map((f, i) => ({ ...f, course, key: `${course.id}_${i}` }))), [rows]);

    const pct = (n) => (kpis.courses ? Math.round((n / kpis.courses) * 100) : 0);
    const Tile = ({ label, value, sub, tone }) => (
        <div className={`rounded-lg border p-3 bg-white ${tone || ''}`}>
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-2xl font-bold text-slate-800">{value}</div>
            {sub && <div className="text-xs text-slate-500">{sub}</div>}
        </div>
    );
    const tab = (id, label, count) => (
        <Button variant="tab" isActive={view === id} onClick={() => setView(id)}>
            {label}{count != null && <span className="ml-1.5 text-xs bg-slate-200 text-slate-700 rounded-full px-1.5">{count}</span>}
        </Button>
    );

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-800">{courseType ? t('final_report.dashboard.title_type', '{{type}} Final Reports Dashboard', { type: courseType }) : t('final_report.dashboard.title', 'Final Reports Dashboard')}</h2>
                <p className="text-sm text-gray-500">{t('final_report.dashboard.subtitle', 'Final report documents, summaries, recommendations and potential facilitators for each course.')}</p>
            </div>

            <Card className="bg-gray-50 border border-gray-200 p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <FormGroup label={t('final_report.dashboard.state', 'State')}><Select value={stateFilter} onChange={e => setStateFilter(e.target.value)}>{states.map(s => <option key={s} value={s}>{s === 'All' ? t('final_report.dashboard.all', 'All') : s}</option>)}</Select></FormGroup>
                    <FormGroup label={t('final_report.dashboard.year', 'Year')}><Select value={yearFilter} onChange={e => setYearFilter(e.target.value)}>{years.map(y => <option key={y} value={y}>{y === 'All' ? t('final_report.dashboard.all', 'All') : y}</option>)}</Select></FormGroup>
                    <FormGroup label={t('final_report.dashboard.final_report', 'Final report')}>
                        <Select value={docFilter} onChange={e => setDocFilter(e.target.value)}>
                            <option value="All">{t('final_report.dashboard.filter.all', 'All courses')}</option>
                            <option value="none">{t('final_report.dashboard.filter.none', 'No report uploaded')}</option>
                            <option value="unsigned">{t('final_report.dashboard.filter.unsigned', 'Uploaded, not signed')}</option>
                            <option value="signed">{t('final_report.dashboard.signed', 'Signed')}</option>
                            <option value="pending">{t('final_report.dashboard.filter.pending', 'Has pending recommendations')}</option>
                        </Select>
                    </FormGroup>
                    <FormGroup label={t('final_report.dashboard.search', 'Search')}><Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('final_report.dashboard.search_placeholder', 'State, locality, director, summary…')} /></FormGroup>
                </div>
            </Card>

            {loading ? (
                <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Spinner /> {t('final_report.dashboard.loading', 'Loading final reports…')}</div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <Tile label={t('final_report.dashboard.courses', 'Courses')} value={kpis.courses} />
                        <Tile label={t('final_report.dashboard.kpi.uploaded', 'Report uploaded')} value={kpis.uploaded} sub={t('final_report.dashboard.kpi.pct_of_courses', '{{pct}}% of courses', { pct: pct(kpis.uploaded) })} />
                        <Tile label={t('final_report.dashboard.signed', 'Signed')} value={kpis.signed} sub={t('final_report.dashboard.kpi.pct_of_courses', '{{pct}}% of courses', { pct: pct(kpis.signed) })} />
                        <Tile label={t('final_report.dashboard.kpi.with_pending', 'Courses with pending recommendations')} value={kpis.withPending} />
                        <Tile label={t('final_report.dashboard.kpi.pending', 'Pending recommendations')} value={kpis.pending} tone={kpis.pending ? 'border-red-200' : ''} />
                    </div>

                    <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
                        {tab('courses', t('final_report.dashboard.courses', 'Courses'), rows.length)}
                        {tab('matrix', t('final_report.dashboard.tabs.matrix', 'Recommendations matrix'))}
                        {tab('recommendations', t('final_report.dashboard.recommendations', 'Recommendations'), recommendations.length)}
                        {tab('facilitators', t('final_report.dashboard.potential_facilitators', 'Potential facilitators'), facilitators.length)}
                    </div>

                    {view === 'courses' && (
                        <div className="space-y-3">
                            {rows.length === 0 && <p className="text-center text-sm text-slate-500 p-6">{t('final_report.dashboard.no_courses', 'No courses match these filters.')}</p>}
                            {rows.map(({ course, report, status }) => {
                                const open = !!expanded[course.id];
                                const recs = (report?.recommendations || []).filter(r => r?.recommendation);
                                const facs = (report?.potentialFacilitators || []).filter(f => f?.participant_id || f?.participant_name);
                                return (
                                    <div key={course.id} className="border rounded-lg bg-white">
                                        <div className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                                            <button type="button" className="text-left min-w-0" onClick={() => setExpanded(e => ({ ...e, [course.id]: !open }))}>
                                                <div className="font-semibold text-slate-800">{courseLabelOf(course)}</div>
                                                <div className="text-xs text-slate-500">
                                                    {courseDateOf(course)?.toLocaleDateString() || t('final_report.dashboard.no_start_date', 'No start date')}
                                                    {course.director ? ` · ${t('final_report.dashboard.director', 'Director: {{name}}', { name: course.director })}` : ''}
                                                </div>
                                                <FinalReportStatusBadges report={report} className="mt-1" />
                                            </button>
                                            <div className="flex gap-2 shrink-0">
                                                <Button variant="secondary" className="text-xs" onClick={() => setExpanded(e => ({ ...e, [course.id]: !open }))}>
                                                    {open ? t('final_report.dashboard.hide_details', 'Hide details') : t('final_report.dashboard.details', 'Details')}
                                                </Button>
                                                <Button className="text-xs" onClick={() => setManageCourse(course)}>
                                                    <PenLine className="w-4 h-4 mr-1" />{status.uploaded ? t('final_report.dashboard.manage', 'Manage') : t('final_report.dashboard.add_report', 'Add report')}
                                                </Button>
                                            </div>
                                        </div>
                                        {open && (
                                            <div className="border-t p-3 space-y-4 bg-slate-50/50">
                                                {status.uploaded && <ReportDocumentCard report={report} course={course} />}
                                                <div>
                                                    <h4 className="font-semibold text-sm mb-1">{t('final_report.dashboard.summary', 'Summary')}</h4>
                                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{report?.summary || <span className="text-slate-400">{t('final_report.dashboard.no_summary', 'No summary written.')}</span>}</p>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-sm mb-1">{t('final_report.dashboard.recommendations', 'Recommendations')}</h4>
                                                    {recs.length ? (
                                                        <ul className="space-y-1">
                                                            {recs.map((r, i) => (
                                                                <li key={i} className="text-sm flex flex-wrap items-start gap-2">
                                                                    <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${REC_STATUS_STYLE[r.status] || 'bg-slate-100 text-slate-600'}`}>{recStatusText(t, r.status)}</span>
                                                                    <span className="flex-1 min-w-0">{r.recommendation}{r.responsible && <span className="text-slate-500"> — {r.responsible}</span>}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : <p className="text-sm text-slate-400">{t('final_report.dashboard.no_recommendations', 'No recommendations.')}</p>}
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-sm mb-1">{t('final_report.dashboard.potential_facilitators', 'Potential facilitators')}</h4>
                                                    {facs.length
                                                        ? <p className="text-sm text-slate-700">{facs.map(f => f.participant_name || t('final_report.na', 'N/A')).join(', ')}</p>
                                                        : <p className="text-sm text-slate-400">{t('final_report.dashboard.none_identified', 'None identified.')}</p>}
                                                </div>
                                                {onOpenFullReport && (
                                                    <Button variant="secondary" className="text-xs" onClick={() => onOpenFullReport(course.id)}>
                                                        {report?.summary ? t('final_report.open_full', 'Open the full final report') : t('final_report.dashboard.write_report', 'Write the final report')}
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {view === 'recommendations' && (
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm text-slate-600">{t('final_report.dashboard.show', 'Show:')}</span>
                                {[['open', t('final_report.dashboard.rec_filter.open', 'Pending (not completed)')], ['all', t('final_report.dashboard.all', 'All')], ['pending', recStatusText(t, 'pending')], ['in-progress', recStatusText(t, 'in-progress')], ['completed', recStatusText(t, 'completed')]].map(([v, l]) => (
                                    <Button key={v} variant={recFilter === v ? 'primary' : 'secondary'} className="text-xs" onClick={() => setRecFilter(v)}>{l}</Button>
                                ))}
                            </div>
                            <Table headers={[t('final_report.table.course', 'Course'), t('final_report.table.recommendation', 'Recommendation'), t('final_report.table.responsible', 'Responsible'), t('final_report.table.theme', 'Theme'), t('final_report.table.status', 'Status')]}>
                                {recommendations.length ? recommendations.map(recRow)
                                    : <tr><td colSpan="5" className="p-4 text-center text-sm text-slate-500">{t('final_report.dashboard.no_recs_filters', 'No recommendations in these filters.')}</td></tr>}
                            </Table>
                        </div>
                    )}

                    {view === 'matrix' && (
                        <div className="space-y-3">
                            <p className="text-sm text-slate-500">
                                {t('final_report.dashboard.matrix_intro', "Every course's recommendations, linked by theme. Click a cell, a theme or a column to see the recommendations behind it, and update their status there.")}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm text-slate-600">{t('final_report.dashboard.across', 'Across:')}</span>
                                {[['state', t('final_report.dashboard.state', 'State')], ['year', t('final_report.dashboard.year', 'Year')], ['course', t('final_report.table.course', 'Course')]].map(([v, l]) => (
                                    <Button key={v} variant={matrixBy === v ? 'primary' : 'secondary'} className="text-xs" onClick={() => { setMatrixBy(v); setCell(null); }}>{l}</Button>
                                ))}
                                <span className="text-sm text-slate-600 ml-2">{t('final_report.dashboard.show', 'Show:')}</span>
                                {[['open', t('final_report.dashboard.scope.open', 'Pending only')], ['all', t('final_report.dashboard.scope.all', 'All (pending / total)')]].map(([v, l]) => (
                                    <Button key={v} variant={matrixScope === v ? 'primary' : 'secondary'} className="text-xs" onClick={() => { setMatrixScope(v); setCell(null); }}>{l}</Button>
                                ))}
                            </div>
                            {matrix.themes.length === 0 ? (
                                <p className="text-center text-sm text-slate-500 p-6">{t('final_report.dashboard.no_recs_filters', 'No recommendations in these filters.')}</p>
                            ) : (
                                <div className="overflow-x-auto border rounded-lg">
                                    <table className="text-sm border-collapse min-w-full">
                                        <thead>
                                            <tr className="bg-slate-100">
                                                <th className="p-2 border text-left sticky left-0 bg-slate-100 z-10 min-w-[12rem]">{t('final_report.table.theme', 'Theme')}</th>
                                                {matrix.cols.map(col => (
                                                    <th key={col} className="p-2 border text-xs font-semibold align-bottom">
                                                        <button type="button" className="hover:underline max-w-[9rem] text-left" onClick={() => setCell({ theme: null, col })}>{colLabelOf(col)}</button>
                                                    </th>
                                                ))}
                                                <th className="p-2 border text-xs font-semibold bg-slate-200">{t('final_report.dashboard.total', 'Total')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {matrix.themes.map(th => (
                                                <tr key={th.id}>
                                                    <th className="p-2 border text-left font-medium sticky left-0 bg-white z-10">
                                                        <button type="button" className="hover:underline text-left" onClick={() => setCell({ theme: th.id, col: null })}>{themeText(t, th.id)}</button>
                                                    </th>
                                                    {matrix.cols.map(col => {
                                                        const c = matrix.cells[`${th.id}|${col}`];
                                                        const active = cell?.theme === th.id && cell?.col === col;
                                                        const shade = c?.open ? `rgba(220, 38, 38, ${0.12 + 0.55 * (c.open / matrix.maxOpen)})` : c ? 'rgba(16, 185, 129, 0.15)' : undefined;
                                                        return (
                                                            <td key={col} className={`p-0 border text-center ${active ? 'outline outline-2 outline-blue-600' : ''}`} style={{ background: shade }}>
                                                                {c ? (
                                                                    <button type="button" className="w-full px-2 py-2 font-semibold" onClick={() => setCell({ theme: th.id, col })}
                                                                        title={t('final_report.dashboard.pending_of', '{{open}} pending of {{total}}', { open: c.open, total: c.total })}>
                                                                        {matrixScope === 'open' ? c.open : `${c.open}/${c.total}`}
                                                                    </button>
                                                                ) : <span className="text-slate-300">·</span>}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="p-2 border text-center font-semibold bg-slate-50">{countText(matrix.scoped.filter(r => r.theme === th.id))}</td>
                                                </tr>
                                            ))}
                                            <tr className="bg-slate-50 font-semibold">
                                                <th className="p-2 border text-left sticky left-0 bg-slate-50 z-10">{t('final_report.dashboard.total', 'Total')}</th>
                                                {matrix.cols.map(col => (
                                                    <td key={col} className="p-2 border text-center">{countText(matrix.scoped.filter(r => colKeyOf(r) === col))}</td>
                                                ))}
                                                <td className="p-2 border text-center bg-slate-200">{countText(matrix.scoped)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {cell && (
                                <div className="border rounded-lg p-3 bg-slate-50/60">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h4 className="font-semibold text-sm">
                                            {cell.theme ? themeText(t, cell.theme) : t('final_report.dashboard.all_themes', 'All themes')} · {cell.col ? colLabelOf(cell.col) : ({
                                                state: t('final_report.dashboard.every_state', 'every state'),
                                                year: t('final_report.dashboard.every_year', 'every year'),
                                                course: t('final_report.dashboard.every_course', 'every course'),
                                            })[matrixBy]}
                                            <span className="text-slate-500 font-normal"> {cellRecs.length === 1
                                                ? t('final_report.dashboard.rec_count_one', '({{n}} recommendation)', { n: cellRecs.length })
                                                : t('final_report.dashboard.rec_count_many', '({{n}} recommendations)', { n: cellRecs.length })}</span>
                                        </h4>
                                        <Button variant="secondary" className="text-xs" onClick={() => setCell(null)}>{t('final_report.buttons.close', 'Close')}</Button>
                                    </div>
                                    <Table headers={[t('final_report.table.course', 'Course'), t('final_report.table.recommendation', 'Recommendation'), t('final_report.table.responsible', 'Responsible'), t('final_report.table.theme', 'Theme'), t('final_report.table.status', 'Status')]}>
                                        {cellRecs.map(recRow)}
                                    </Table>
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'facilitators' && (
                        <Table headers={['#', t('final_report.dashboard.potential_facilitator', 'Potential facilitator'), t('final_report.table.course', 'Course'), t('final_report.dashboard.course_date', 'Course date')]}>
                            {facilitators.length ? facilitators.map((f, i) => (
                                <tr key={f.key}>
                                    <td className="p-2 border text-sm">{i + 1}</td>
                                    <td className="p-2 border text-sm font-semibold">{f.participant_name || t('final_report.na', 'N/A')}</td>
                                    <td className="p-2 border text-sm">{courseLabelOf(f.course)}</td>
                                    <td className="p-2 border text-sm">{courseDateOf(f.course)?.toLocaleDateString() || '—'}</td>
                                </tr>
                            )) : <tr><td colSpan="4" className="p-4 text-center text-sm text-slate-500">{t('final_report.dashboard.no_facilitators_filters', 'No potential facilitators in these filters.')}</td></tr>}
                        </Table>
                    )}
                </>
            )}

            {manageCourse && (
                <FinalReportQuickModal isOpen course={manageCourse} onClose={() => setManageCourse(null)}
                    onReportChanged={onReportChanged} onOpenFullReport={onOpenFullReport} />
            )}
        </div>
    );
}

export function FinalReportManager({
    course, participants, onCancel, onSave, initialData, 
    canUseFederalManagerAdvancedFeatures,
    // Off where the report document card already sits above this view.
    showDocument = true
}) {
    const { t } = useTranslation();
    const { facilitators } = useDataCache();
    const facilitatorsList = facilitators || [];

    const [isEditing, setIsEditing] = useState(!initialData);
    const [isDownloading, setIsDownloading] = useState(false);

    // State for all form fields
    const [summary, setSummary] = useState('');
    const [recommendations, setRecommendations] = useState([{ recommendation: '', responsible: '', status: '' }]);
    const [potentialFacilitators, setPotentialFacilitators] = useState([]);
    const [pdfFile, setPdfFile] = useState(null);
    const [existingPdfUrl, setExistingPdfUrl] = useState(null);
    // The signed scan: the report printed, signed and scanned back in. Kept
    // separate from the report PDF because they are two different documents and
    // the signed one is what gets filed.
    const [signedPdfFile, setSignedPdfFile] = useState(null);
    const [existingSignedPdfUrl, setExistingSignedPdfUrl] = useState(null);
    const [signedFileName, setSignedFileName] = useState(null);
    // How the signed copy was laid out, so the signature can be edited.
    const [signatureLayout, setSignatureLayout] = useState(null);
    const { user } = useAuth();
    const signerName = user?.displayName || '';
    const [fileName, setFileName] = useState(null);
    const [galleryImageFiles, setGalleryImageFiles] = useState({});
    const [galleryImageUrls, setGalleryImageUrls] = useState(Array(3).fill(null));
    const [participantsForFollowUp, setParticipantsForFollowUp] = useState([{ participant_id: '', phone: '', comment: '' }]);

    // --- SNAPSHOT CALCULATION LOGIC ---
    // We calculate these based on current state so we can save them as a snapshot
    const currentAnnexFacilitators = useMemo(() => {
        const names = new Set();
        if (course.director) names.add(course.director);
        if (course.clinical_instructor) names.add(course.clinical_instructor);
        if (course.facilitators) course.facilitators.forEach(f => names.add(f));

        return Array.from(names).map(name => {
            const details = facilitatorsList.find(f => f.name === name) || {};
            return {
                name,
                phone: details.phone || 'N/A',
                qualification: details.backgroundQualification === 'Other' 
                    ? details.backgroundQualificationOther 
                    : (details.backgroundQualification || 'N/A')
            };
        });
    }, [course, facilitatorsList]);

    const currentGroupedParticipants = useMemo(() => {
        const groups = {};
        (participants || []).forEach(p => {
            const subCourse = p.imci_sub_type || course?.facilitatorAssignments?.find(a => a.group === p.group)?.imci_sub_type || 'Unspecified Sub-course';
            if (!groups[subCourse]) groups[subCourse] = [];
            groups[subCourse].push(p);
        });
        return groups;
    }, [participants, course]);

    // Use saved snapshot if viewing, otherwise use currently calculated data
    const finalAnnexFacilitators = initialData?.annexFacilitators || currentAnnexFacilitators;
    const finalGroupedParticipants = initialData?.groupedParticipants || currentGroupedParticipants;
    // ----------------------------------

    useEffect(() => {
        if (initialData) {
            setSummary(initialData.summary || '');
            setRecommendations(initialData.recommendations && initialData.recommendations.length > 0 ? initialData.recommendations : [{ recommendation: '', responsible: '', status: '' }]);
            setPotentialFacilitators(initialData.potentialFacilitators || []);
            setExistingPdfUrl(initialData.pdfUrl || null);
            setFileName(initialData.pdfUrl ? 'Existing PDF' : null);
            setExistingSignedPdfUrl(initialData.signedPdfUrl || null);
            setSignedFileName(initialData.signedPdfUrl ? 'Existing signed PDF' : null);
            setSignatureLayout(initialData.signatureLayout || null);
            
            const existingImages = initialData.galleryImageUrls || [];
            const urls = Array(3).fill(null);
            existingImages.forEach((url, index) => urls[index] = url);
            setGalleryImageUrls(urls);
            
            setParticipantsForFollowUp(initialData.participantsForFollowUp && initialData.participantsForFollowUp.length > 0 ? initialData.participantsForFollowUp : [{ participant_id: '', phone: '', comment: '' }]);

            setIsEditing(false); 
        } else {
            setIsEditing(true);
            setSummary('');
            setRecommendations([{ recommendation: '', responsible: '', status: '' }]);
            setPotentialFacilitators([]);
            setPdfFile(null);
            setExistingPdfUrl(null);
            setSignedPdfFile(null);
            setExistingSignedPdfUrl(null);
            setSignedFileName(null);
            setSignatureLayout(null);
            setFileName(null);
            setGalleryImageUrls(Array(3).fill(null));
            setGalleryImageFiles({});
            setParticipantsForFollowUp([{ participant_id: '', phone: '', comment: '' }]);
        }
    }, [initialData]);

    const handleCancelEdit = () => {
        if (initialData) {
            setIsEditing(false);
        } else {
            onCancel();
        }
    };
    
    const handleForceDownload = async (url, filename) => {
        setIsDownloading(true);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok.');
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Download failed:', error);
            window.open(url, '_blank');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleSave = async () => {
        const finalPotentialFacilitators = potentialFacilitators
            .filter(f => f.participant_id)
            .map(fac => {
                const participant = participants.find(p => p.id === fac.participant_id);
                return {
                    participant_id: fac.participant_id,
                    participant_name: participant ? participant.name : (fac.participant_name || 'N/A') 
                };
            });

        const finalReportData = {
            courseId: course.id,
            summary,
            recommendations: recommendations.filter(r => r.recommendation),
            potentialFacilitators: finalPotentialFacilitators,
            pdfFile,
            existingPdfUrl: existingPdfUrl,
            signedPdfFile,
            existingSignedPdfUrl: existingSignedPdfUrl,
            signatureLayout,
            originalGalleryUrls: initialData?.galleryImageUrls || [],
            finalGalleryUrls: galleryImageUrls,
            galleryImageFiles: galleryImageFiles,
            participantsForFollowUp: participantsForFollowUp.filter(p => p.participant_id),
            // INCLUDE TABLES IN SAVE PAYLOAD AS SNAPSHOTS
            annexFacilitators: currentAnnexFacilitators,
            groupedParticipants: currentGroupedParticipants
        };
        
        if (initialData?.id) {
            finalReportData.id = initialData.id;
        }

        await onSave(finalReportData);
    };
    
    const addRecommendation = () => setRecommendations([...recommendations, { recommendation: '', responsible: '', status: '' }]);
    const updateRecommendation = (index, field, value) => {
        const newRecs = [...recommendations];
        newRecs[index][field] = value;
        setRecommendations(newRecs);
    };
    const removeRecommendation = (index) => setRecommendations(recommendations.filter((_, i) => i !== index));

    const addPotentialFacilitator = () => setPotentialFacilitators([...potentialFacilitators, { participant_id: '', participant_name: '' }]);
    const updatePotentialFacilitator = (index, value) => {
        const selectedParticipant = participants.find(p => p.id === value);
        const newFacs = [...potentialFacilitators];
        newFacs[index] = {
            participant_id: value,
            participant_name: selectedParticipant ? selectedParticipant.name : ''
        };
        setPotentialFacilitators(newFacs);
    };
    const removePotentialFacilitator = (index) => setPotentialFacilitators(potentialFacilitators.filter((_, i) => i !== index));

    // The summary and recommendations are read out of the chosen PDF and
    // offered for the form, so they are not typed in twice.
    const [editorCapture, setEditorCapture] = useState(null);
    const [capturing, setCapturing] = useState(false);
    const captureInto = async (source) => {
        setCapturing(true);
        try { setEditorCapture(await captureReportContent(source)); }
        catch (err) { notify(t('final_report.manage.read_failed', 'Could not read the PDF: {{error}}', { error: err.message }), 'error'); }
        finally { setCapturing(false); }
    };
    const applyEditorCapture = async ({ summary: s, recommendations: recs }) => {
        setSummary(s);
        setRecommendations(recs.length ? recs : [{ recommendation: '', responsible: '', status: '' }]);
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        setPdfFile(file);
        if (file) {
            setFileName(file.name);
            setExistingPdfUrl(null);
            captureInto(file);
        } else {
            setFileName(null);
        }
    };

    // The signed copy is made here from the report PDF, not uploaded; it is
    // stored with the rest of the report on Save.
    const [signerOpen, setSignerOpen] = useState(false);
    const reportSource = pdfFile || existingPdfUrl;
    const handleSigned = async (file, layout) => {
        setSignedPdfFile(file);
        setSignedFileName(file.name);
        setExistingSignedPdfUrl(null);
        setSignatureLayout(layout);
    };
    const deleteSignature = () => {
        setExistingSignedPdfUrl(null);
        setSignedPdfFile(null);
        setSignedFileName(null);
        setSignatureLayout(null);
    };
    
    const handleGalleryImageUpload = (e, index) => {
        const file = e.target.files[0];
        if (file) {
            setGalleryImageFiles(prev => ({...prev, [index]: file}));
            const reader = new FileReader();
            reader.onload = (event) => {
                const newUrls = [...galleryImageUrls];
                newUrls[index] = event.target.result;
                setGalleryImageUrls(newUrls);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDeleteGalleryImage = (index) => {
        setGalleryImageFiles(prev => ({...prev, [index]: undefined}));
        const newUrls = [...galleryImageUrls];
        newUrls[index] = null;
        setGalleryImageUrls(newUrls);
    };

    const addFollowUpParticipant = () => setParticipantsForFollowUp([...participantsForFollowUp, { participant_id: '', phone: '', comment: '' }]);
    const removeFollowUpParticipant = (index) => setParticipantsForFollowUp(participantsForFollowUp.filter((_, i) => i !== index));
    const updateFollowUpParticipant = (index, field, value) => {
        const newFollowUps = [...participantsForFollowUp];
        const currentItem = { ...newFollowUps[index] };
        currentItem[field] = value;
        
        if (field === 'participant_id') {
            const participant = participants.find(p => p.id === value);
            currentItem.phone = participant?.phone || 'N/A';
            currentItem.participant_name = participant?.name || '';
        }
        
        newFollowUps[index] = currentItem;
        setParticipantsForFollowUp(newFollowUps);
    };

    if (isEditing) {
        return (
            <Card>
                <PageHeader title={initialData
                    ? t('final_report.editor.edit_title', 'Edit Final Report for {{type}} - {{state}}', { type: course.course_type, state: course.state })
                    : t('final_report.editor.create_title', 'Create Final Report for {{type}} - {{state}}', { type: course.course_type, state: course.state })} subtitle={t('final_report.editor.subtitle', 'Complete the final report for this course.')} />
                <div className="space-y-6 mt-6 p-6">
                    <FormGroup label={t('final_report.course_summary', 'Course Summary')}><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows="5" /></FormGroup>
                    
                    <h3 className="text-xl font-bold mb-2">{t('final_report.course_recommendations', 'Course Recommendations')}</h3>
                    {(pdfFile || existingPdfUrl) && (
                        <Button variant="secondary" className="text-xs" disabled={capturing} onClick={() => captureInto(pdfFile || existingPdfUrl)}>
                            {capturing ? <><Spinner size="sm" /> {t('final_report.manage.reading_pdf', 'Reading the PDF…')}</> : t('final_report.editor.fill_from_pdf', 'Fill summary & recommendations from the report PDF')}
                        </Button>
                    )}
                    <CaptureReportContentModal isOpen={!!editorCapture} onClose={() => setEditorCapture(null)} capture={editorCapture}
                        existing={{ summary, recommendations }} onApply={applyEditorCapture} />
                    <Table headers={[t('final_report.table.recommendation', 'Recommendation'), t('final_report.table.responsible', 'Responsible'), t('final_report.table.theme', 'Theme'), t('final_report.table.status', 'Status'), t('final_report.table.actions', 'Actions')]}>
                        {recommendations.map((rec, index) => (
                            <tr key={index}>
                                <td className="p-2 border"><Input value={rec.recommendation} onChange={(e) => updateRecommendation(index, 'recommendation', e.target.value)} /></td>
                                <td className="p-2 border"><Input value={rec.responsible} onChange={(e) => updateRecommendation(index, 'responsible', e.target.value)} /></td>
                                <td className="p-2 border"><Select value={themeOf(rec)} onChange={(e) => updateRecommendation(index, 'theme', e.target.value)}>{[...RECOMMENDATION_THEMES, OTHER_THEME].map(th => <option key={th.id} value={th.id}>{themeText(t, th.id)}</option>)}</Select></td>
                                <td className="p-2 border"><Select value={rec.status} onChange={(e) => updateRecommendation(index, 'status', e.target.value)}><option value="">{t('final_report.editor.select_status', 'Select Status')}</option><option value="pending">{recStatusText(t, 'pending')}</option><option value="in-progress">{recStatusText(t, 'in-progress')}</option><option value="completed">{recStatusText(t, 'completed')}</option></Select></td>
                                <td className="p-2 border"><Button variant="danger" onClick={() => removeRecommendation(index)}>{t('final_report.buttons.remove', 'Remove')}</Button></td>
                            </tr>
                        ))}
                        <tr><td colSpan="5" className="p-2 border-t"><Button variant="secondary" onClick={addRecommendation}>{t('final_report.editor.add_recommendation', 'Add Recommendation')}</Button></td></tr>
                    </Table>

                    <h3 className="text-xl font-bold mb-2">{t('final_report.potential_facilitators', 'Potential Facilitators')}</h3>
                    <Table headers={[t('final_report.table.participant', 'Participant'), t('final_report.table.phone_number', 'Phone Number'), t('final_report.table.responsible_facilitator', 'Responsible Facilitator'), t('final_report.table.actions', 'Actions')]}>
                        {potentialFacilitators.map((fac, index) => {
                            const participant = participants.find(p => p.id === fac.participant_id);
                            const responsibleFacilitator = course.facilitatorAssignments?.find(f => f.group === participant?.group);
                            return (
                                <tr key={index}>
                                    <td className="p-2 border"><Select value={fac.participant_id} onChange={(e) => updatePotentialFacilitator(index, e.target.value)}><option value="">{t('final_report.editor.select_participant', 'Select Participant')}</option>{(participants || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></td>
                                    <td className="p-2 border">{participant?.phone || t('final_report.na', 'N/A')}</td>
                                    <td className="p-2 border">{responsibleFacilitator?.name || t('final_report.na', 'N/A')}</td>
                                    <td className="p-2 border"><Button variant="danger" onClick={() => removePotentialFacilitator(index)}>{t('final_report.buttons.remove', 'Remove')}</Button></td>
                                </tr>
                            );
                        })}
                        <tr><td colSpan="4" className="p-2 border-t"><Button variant="secondary" onClick={addPotentialFacilitator}>{t('final_report.editor.add_potential_facilitator', 'Add Potential Facilitator')}</Button></td></tr>
                    </Table>

                    <h3 className="text-xl font-bold mb-2">{t('final_report.follow_up', 'Participants Requiring Follow-up')}</h3>
                    <Table headers={[t('final_report.table.participant', 'Participant'), t('final_report.table.phone_number', 'Phone Number'), t('final_report.table.comment', 'Comment / Action Required'), t('final_report.table.actions', 'Actions')]}>
                        {participantsForFollowUp.map((p, index) => (
                            <tr key={index}>
                                <td className="p-2 border" style={{width: '25%'}}><Select value={p.participant_id} onChange={(e) => updateFollowUpParticipant(index, 'participant_id', e.target.value)}><option value="">{t('final_report.editor.select_participant', 'Select Participant')}</option>{(participants || []).map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}</Select></td>
                                <td className="p-2 border" style={{width: '15%'}}>{p.phone || t('final_report.na', 'N/A')}</td>
                                <td className="p-2 border"><Input value={p.comment} onChange={(e) => updateFollowUpParticipant(index, 'comment', e.target.value)} placeholder={t('final_report.editor.comment_placeholder', 'e.g., Needs more clinical practice')} /></td>
                                <td className="p-2 border" style={{width: '10%'}}><Button variant="danger" onClick={() => removeFollowUpParticipant(index)}>{t('final_report.buttons.remove', 'Remove')}</Button></td>
                            </tr>
                        ))}
                        <tr><td colSpan="4" className="p-2 border-t"><Button variant="secondary" onClick={addFollowUpParticipant}>{t('final_report.editor.add_participant', 'Add Participant')}</Button></td></tr>
                    </Table>

                    <h3 className="text-xl font-bold mb-2">{t('final_report.editor.gallery_title', 'Course Gallery (up to 3 images)')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[0, 1, 2].map(index => (
                            <div key={index} className="border rounded-lg p-3 flex flex-col items-center justify-center space-y-2">
                                {galleryImageUrls[index] ? (
                                    <>
                                        <img src={galleryImageUrls[index]} alt={t('final_report.gallery_item', 'Gallery item {{n}}', { n: index + 1 })} className="w-full h-32 object-cover rounded-md" />
                                        <Button variant="danger" size="sm" onClick={() => handleDeleteGalleryImage(index)}>{t('final_report.editor.remove_image', 'Remove Image')}</Button>
                                    </>
                                ) : (
                                    <div className="text-center">
                                        <label htmlFor={`gallery-upload-${index}`} className="cursor-pointer text-blue-600 hover:text-blue-800 font-semibold">{t('final_report.editor.click_upload', 'Click to upload image')}</label>
                                        <input id={`gallery-upload-${index}`} type="file" accept="image/*" className="hidden" onChange={(e) => handleGalleryImageUpload(e, index)} />
                                        <p className="text-xs text-gray-500 mt-1">{t('final_report.editor.image_n', 'Image {{n}}', { n: index + 1 })}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <h3 className="text-xl font-bold mb-2">{t('final_report.editor.documents', 'Report documents')}</h3>
                    <p className="text-sm text-gray-500 mb-3">
                        {t('final_report.editor.documents_intro', "The report itself, and the signed copy that gets filed. The signed copy is made in the app: signatures and the stamp are placed on the report's first page. Both can also be done from the course report screen without opening this editor.")}
                    </p>
                    <Table headers={[t('final_report.editor.document', 'Document'), t('final_report.table.actions', 'Actions')]}>
                        <tbody>
                            <tr>
                                <td className="p-2 border align-top">
                                    <div className="font-semibold text-sm">{t('final_report.doc.report_pdf', 'Final report PDF')}</div>
                                    {existingPdfUrl
                                        ? <div className="flex items-center gap-2 mt-1"><PdfIcon className="text-blue-500 w-5 h-5" /><span className="text-xs">{t('final_report.editor.attached', 'Attached')}</span></div>
                                        : <span className="text-gray-500 text-xs">{t('final_report.editor.not_attached', 'Not attached')}</span>}
                                </td>
                                <td className="p-2 border">
                                    {existingPdfUrl ? (
                                        <div className="flex flex-wrap gap-2">
                                            <a href={existingPdfUrl} target="_blank" rel="noopener noreferrer"><Button variant="info">{t('final_report.buttons.view', 'View')}</Button></a>
                                            <Button variant="primary" onClick={() => handleForceDownload(existingPdfUrl, `Final_Report_${course.course_type}_${course.state}.pdf`)} disabled={isDownloading}>{isDownloading ? <Spinner/> : t('final_report.buttons.download', 'Download')}</Button>
                                            <Button variant="danger" onClick={() => { setExistingPdfUrl(null); setPdfFile(null); setFileName(null); }}>{t('final_report.buttons.delete', 'Delete')}</Button>
                                        </div>
                                    ) : ( <div className="flex flex-col sm:flex-row sm:items-center gap-2"><input type="file" accept=".pdf" onChange={handleFileUpload} />{fileName && <p className="text-sm text-gray-500 break-all">{t('final_report.editor.file_selected', 'File selected: {{name}}', { name: fileName })}</p>}</div> )}
                                </td>
                            </tr>
                            <tr>
                                <td className="p-2 border align-top">
                                    <div className="font-semibold text-sm">{t('final_report.doc.signed_report', 'Signed final report')}</div>
                                    {existingSignedPdfUrl
                                        ? <div className="flex items-center gap-2 mt-1"><PdfIcon className="text-emerald-600 w-5 h-5" /><span className="text-xs">{t('final_report.editor.signed_attached', 'Signed copy attached')}</span></div>
                                        : <span className="text-gray-500 text-xs">{t('final_report.editor.not_attached', 'Not attached')}</span>}
                                </td>
                                <td className="p-2 border">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {existingSignedPdfUrl && (
                                            <a href={existingSignedPdfUrl} target="_blank" rel="noopener noreferrer"><Button variant="info">{t('final_report.buttons.view', 'View')}</Button></a>
                                        )}
                                        {(existingSignedPdfUrl || signedPdfFile) ? (
                                            <>
                                                <Button variant="primary" onClick={() => setSignerOpen(true)} disabled={!reportSource}>
                                                    <PenLine className="w-4 h-4 mr-1" /> {t('final_report.buttons.edit_signature', 'Edit signature')}
                                                </Button>
                                                <Button variant="danger" onClick={deleteSignature}>
                                                    <Trash2 className="w-4 h-4 mr-1" /> {t('final_report.buttons.delete_signature', 'Delete signature')}
                                                </Button>
                                                {signedPdfFile && <p className="text-sm text-emerald-700">{t('final_report.editor.signed_saved_with', 'Signed — saved with the report.')}</p>}
                                            </>
                                        ) : (
                                            <>
                                                <Button variant="primary" onClick={() => setSignerOpen(true)} disabled={!reportSource}>
                                                    <PenLine className="w-4 h-4 mr-1" /> {t('final_report.buttons.sign_stamp', 'Sign & stamp')}
                                                </Button>
                                                {!reportSource && <p className="text-xs text-gray-500">{t('final_report.editor.attach_first', 'Attach the final report PDF first.')}</p>}
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </Table>
                    <SignAndStampModal isOpen={signerOpen} onClose={() => setSignerOpen(false)}
                        source={reportSource} course={course} onSigned={handleSigned}
                        initialLayout={signatureLayout} signerName={signerName} />

                    <AnnexSection 
                        groupedParticipants={currentGroupedParticipants} 
                        annexFacilitators={currentAnnexFacilitators} 
                    />
                </div>
                <div className="flex gap-2 justify-end mt-6 border-t pt-6 px-6 pb-6"><Button variant="secondary" onClick={handleCancelEdit}>{t('final_report.buttons.cancel', 'Cancel')}</Button><Button onClick={handleSave}>{t('final_report.editor.save', 'Save Final Report')}</Button></div>
            </Card>
        );
    }

    const finalGalleryUrls = initialData?.galleryImageUrls?.filter(url => url) || [];
    const finalFollowUpList = initialData?.participantsForFollowUp?.filter(p => p.participant_id) || [];
    const finalSummary = initialData?.summary || t('final_report.view.no_summary', 'No summary provided.');
    const finalRecommendations = initialData?.recommendations?.filter(r => r.recommendation) || [];
    const finalFacilitatorList = initialData?.potentialFacilitators?.filter(f => f.participant_id) || [];

    return (
        <Card>
            <PageHeader 
                title={t('final_report.view.title', 'Final Report for {{type}} - {{state}}', { type: course.course_type, state: course.state })} 
                subtitle={t('final_report.view.subtitle', 'Review the summary, recommendations, and documents for this course.')} 
                actions={canUseFederalManagerAdvancedFeatures && <Button onClick={() => setIsEditing(true)}>{t('final_report.view.edit_report', 'Edit Report')}</Button>} 
            />
            <div className="space-y-8 mt-6 p-6">
                <div><h3 className="text-xl font-bold mb-2 text-gray-800">{t('final_report.course_summary', 'Course Summary')}</h3><p className="text-gray-700 whitespace-pre-wrap">{finalSummary}</p></div>
                
                <div><h3 className="text-xl font-bold mb-2 text-gray-800">{t('final_report.course_recommendations', 'Course Recommendations')}</h3><Table headers={['#', t('final_report.table.recommendation', 'Recommendation'), t('final_report.table.responsible', 'Responsible'), t('final_report.table.theme', 'Theme'), t('final_report.table.status', 'Status')]}>{finalRecommendations.length > 0 ? (finalRecommendations.map((rec, index) => (<tr key={index}><td className="p-2 border">{index + 1}</td><td className="p-2 border">{rec.recommendation}</td><td className="p-2 border">{rec.responsible}</td><td className="p-2 border">{themeText(t, themeOf(rec))}</td><td className="p-2 border capitalize">{rec.status ? recStatusText(t, rec.status) : rec.status}</td></tr>))) : (<tr><td colSpan="5" className="p-4 text-center text-gray-500">{t('final_report.view.no_recommendations', 'No recommendations were made.')}</td></tr>)}</Table></div>
                
                <div>
                    <h3 className="text-xl font-bold mb-2 text-gray-800">{t('final_report.potential_facilitators', 'Potential Facilitators')}</h3>
                    <Table headers={['#', t('final_report.table.participant_name', 'Participant Name'), t('final_report.table.phone_number', 'Phone Number'), t('final_report.table.responsible_facilitator', 'Responsible Facilitator')]}>
                        {finalFacilitatorList.length > 0 ? (
                            finalFacilitatorList.map((fac, index) => {
                                const participant = participants.find(p => p.id === fac.participant_id);
                                const responsibleFacilitator = course.facilitatorAssignments?.find(f => f.group === participant?.group);
                                
                                return (
                                    <tr key={index}>
                                        <td className="p-2 border">{index + 1}</td>
                                        <td className="p-2 border">{fac.participant_name || t('final_report.na', 'N/A')}</td>
                                        <td className="p-2 border">{participant?.phone || t('final_report.na', 'N/A')}</td>
                                        <td className="p-2 border">{responsibleFacilitator?.name || t('final_report.na', 'N/A')}</td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr><td colSpan="4" className="p-4 text-center text-gray-500">{t('final_report.view.no_facilitators', 'No potential facilitators were identified.')}</td></tr>
                        )}
                    </Table>
                </div>
                
                <div><h3 className="text-xl font-bold mb-2 text-gray-800">{t('final_report.follow_up', 'Participants Requiring Follow-up')}</h3><Table headers={['#', t('final_report.table.participant_name', 'Participant Name'), t('final_report.table.phone', 'Phone'), t('final_report.table.comment', 'Comment / Action Required')]}>{finalFollowUpList.length > 0 ? (finalFollowUpList.map((p, index) => (<tr key={index}><td className="p-2 border">{index + 1}</td><td className="p-2 border">{p.participant_name}</td><td className="p-2 border">{p.phone}</td><td className="p-2 border">{p.comment}</td></tr>))) : (<tr><td colSpan="4" className="p-4 text-center text-gray-500">{t('final_report.view.no_follow_up', 'No participants were marked for follow-up.')}</td></tr>)}</Table></div>
                
                <div>
                    <h3 className="text-xl font-bold mb-2 text-gray-800">{t('final_report.view.gallery', 'Course Gallery')}</h3>
                    {finalGalleryUrls.length > 0 ? (<div className="grid grid-cols-1 md:grid-cols-3 gap-4">{finalGalleryUrls.map((url, index) => (<a key={index} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={t('final_report.gallery_item', 'Gallery item {{n}}', { n: index + 1 })} className="w-full h-48 object-cover rounded-lg shadow-md hover:shadow-xl transition-shadow" /></a>))}</div>) : (<p className="text-gray-500">{t('final_report.view.no_images', 'No images were added to the gallery.')}</p>)}
                </div>
                {showDocument && (initialData?.pdfUrl || initialData?.signedPdfUrl) && (
                    <div>
                        <h3 className="text-xl font-bold mb-2 text-gray-800">{t('final_report.view.report_document', 'Report document')}</h3>
                        <ReportDocumentCard report={initialData} course={course} />
                    </div>
                )}
                
                <AnnexSection 
                    groupedParticipants={finalGroupedParticipants} 
                    annexFacilitators={finalAnnexFacilitators} 
                />
            </div>
            <div className="flex justify-end mt-6 border-t pt-6 px-6 pb-6"><Button variant="secondary" onClick={onCancel}>{t('final_report.buttons.back', 'Back')}</Button></div>
        </Card>
    );
}