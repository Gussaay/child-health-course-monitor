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
import { attachFinalReportPdf, removeFinalReportPdf, getFinalReportByCourseId, lightFinalReport } from '../data';
import html2canvas from 'html2canvas'; // <-- Added proper import

// --- Shared Utility: Copy as Image ---
const copyAsImage = async (ref) => {
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
                notify("Failed to create image blob.");
                return;
            }
            try {
                // Modern Clipboard API requires secure context (HTTPS)
                const item = new window.ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                notify("Image copied to clipboard!");
            } catch (err) {
                console.error("Clipboard API failed:", err);
                notify("Failed to copy image. Your browser might require HTTPS or strict permissions.");
            }
        }, 'image/png');
    } catch (err) {
        console.error("HTML2Canvas Error:", err);
        notify("Failed to generate image.");
    }
};

// --- Sub-component for individual participant groups ---
const ParticipantGroupTable = ({ subCourse, group, participantHeaders }) => {
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
            p.center_name || p.department || 'N/A', 
            p.phone || 'N/A'
        ]);
        const tsv = [displayHeaders.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');
        navigator.clipboard.writeText(tsv)
            .then(() => notify(`Table for ${subCourse} copied as text!`))
            .catch(err => notify("Failed to copy table."));
    };

    return (
        <div className="bg-white rounded-xl shadow-md border border-blue-200 overflow-hidden">
            <div className="flex justify-between items-center p-4 bg-blue-50 border-b border-blue-200" dir={isArabic ? "rtl" : "ltr"}>
                <h4 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                    <BookOpen className={`w-5 h-5 text-blue-600 ${isArabic ? 'ml-2 mr-0' : 'mr-2 ml-0'}`} />
                    {subCourse}
                </h4>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={copyAsText} className="bg-white text-blue-700 border-blue-300 hover:bg-blue-100">
                        <Copy className={`w-4 h-4 ${isArabic ? 'ml-2 mr-0' : 'mr-2 ml-0'}`} /> {isArabic ? 'نسخ كجدول' : 'Copy as Table'}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => copyAsImage(tableRef)} className="bg-white text-blue-700 border-blue-300 hover:bg-blue-100">
                        <ImageIcon className={`w-4 h-4 ${isArabic ? 'ml-2 mr-0' : 'mr-2 ml-0'}`} /> {isArabic ? 'نسخ كصورة' : 'Copy as Image'}
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
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-start">{p.center_name || p.department || 'N/A'}</td>
                                <td className={`px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-start ${isArabic ? '' : 'font-mono'}`} dir="ltr">{p.phone || 'N/A'}</td>
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
    const facilitatorTableRef = useRef(null);

    const facilitatorHeaders = ['#', 'Facilitator Name', 'Phone Number', 'Qualification'];
    const participantHeaders = ['#', 'Participant Name', 'Job Title', 'State', 'Locality', 'Facility', 'Phone Number'];

    const copyFacilitatorsAsText = () => {
        const rows = annexFacilitators.map((f, i) => [i + 1, f.name, f.phone, f.qualification]);
        const tsv = [facilitatorHeaders.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');
        navigator.clipboard.writeText(tsv)
            .then(() => notify("Table copied as text!"))
            .catch(err => notify("Failed to copy table."));
    };

    return (
        <div className="mt-10 pt-8 border-t-2 border-blue-200">
            <h2 className="text-2xl font-extrabold mb-6 text-blue-900">Annex: Detailed Rosters</h2>

            {/* Facilitators Table */}
            <div className="mb-10">
                <div className="bg-white rounded-xl shadow-md border border-blue-200 overflow-hidden">
                    <div className="flex justify-between items-center p-4 bg-blue-50 border-b border-blue-200">
                        <h3 className="text-xl font-bold text-blue-900 flex items-center gap-2">
                            <Users className="w-6 h-6 text-blue-600" />
                            Course Facilitators
                        </h3>
                        <div className="flex gap-2">
                            <Button variant="secondary" size="sm" onClick={copyFacilitatorsAsText} className="bg-white text-blue-700 border-blue-300 hover:bg-blue-100">
                                <Copy className="w-4 h-4 mr-2" /> Copy as Table
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => copyAsImage(facilitatorTableRef)} className="bg-white text-blue-700 border-blue-300 hover:bg-blue-100">
                                <ImageIcon className="w-4 h-4 mr-2" /> Copy as Image
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
                                        <td colSpan="4" className="px-4 py-8 text-center text-sm text-gray-500 italic">No facilitators found.</td>
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
                    Course Participants (By Sub-course)
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
                            No participants found for this course.
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
            <p className="text-sm font-semibold mb-2">Sign in the box</p>
            <canvas ref={canvasRef}
                className="w-full h-40 bg-white border border-dashed border-slate-400 rounded cursor-crosshair"
                style={{ touchAction: 'none' }}
                onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
            <div className="flex flex-wrap gap-2 mt-2 justify-end">
                <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
                <Button variant="secondary" size="sm" onClick={clear} disabled={!hasInk}>Clear</Button>
                <Button size="sm" onClick={done} disabled={!hasInk}>Place on page</Button>
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
                if (!cancelled) setError(e.message || 'Could not open the report PDF.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [isOpen, source]);

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
        if (!file.type.startsWith('image/')) { setError('Choose an image file (PNG or JPG).'); return; }
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
            setError(e.message || 'Could not sign the report.');
        } finally {
            setSaving(false);
        }
    };

    // Portalled to <body>: opened from inside another dialog, a click on this
    // one must not count as a click outside that one and close it.
    return createPortal(
        <Modal isOpen={isOpen} onClose={saving ? undefined : onClose}
            title={isEdit ? 'Edit the signature' : 'Sign and stamp the final report'}>
            <div className="space-y-3">
                <p className="text-sm text-slate-600">
                    Add signatures, the stamp and who approved it, drag them into place on the first
                    page, then save. Tap an item to change or remove it.
                </p>

                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setPadOpen(true)} disabled={!pageSize || padOpen}>
                        <PenLine className="w-4 h-4 mr-1" /> Draw signature
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => pickUpload('signature')} disabled={!pageSize}>
                        <ImageIcon className="w-4 h-4 mr-1" /> Signature image
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => pickUpload('stamp')} disabled={!pageSize}>
                        <Stamp className="w-4 h-4 mr-1" /> Stamp image
                    </Button>
                    <Button size="sm" variant="secondary" onClick={addApproval} disabled={!pageSize}>
                        <Type className="w-4 h-4 mr-1" /> Approved by + date
                    </Button>
                    <input ref={uploadInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onUpload} />
                </div>

                {courseAssets.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">Already on this course:</span>
                        {courseAssets.map(a => (
                            <Button key={a.key} size="sm" variant="secondary" disabled={!pageSize} onClick={() => addCourseAsset(a)}
                                className="text-xs">
                                + {a.label}
                            </Button>
                        ))}
                    </div>
                )}

                <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={clearWhite} onChange={(e) => setClearWhite(e.target.checked)} />
                    Make the white background of added images transparent
                </label>

                {padOpen && (
                    <SignaturePad
                        onCancel={() => setPadOpen(false)}
                        onDone={(img) => { addItem(img, 'signature', 'Signature'); setPadOpen(false); }} />
                )}

                {selectedItem?.kind === 'text' && (
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end border rounded-lg p-3 bg-blue-50/50">
                        <label className="text-xs font-semibold text-slate-600">Approved by
                            <input type="text" value={selectedItem.name || ''} placeholder="Name"
                                onChange={(e) => updateText(selectedItem.id, { name: e.target.value })}
                                className="mt-1 w-full border rounded px-2 py-1.5 text-sm font-normal" />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">Date
                            <input type="date" value={selectedItem.date || ''}
                                onChange={(e) => updateText(selectedItem.id, { date: e.target.value })}
                                className="mt-1 w-full border rounded px-2 py-1.5 text-sm font-normal" />
                        </label>
                        <Button size="sm" variant="secondary" onClick={() => updateText(selectedItem.id, { date: todayIso() })}>Today</Button>
                    </div>
                )}

                {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

                <div className="relative border shadow-sm bg-slate-100 select-none"
                    onPointerDown={() => setSelected(null)}
                    onPointerMove={onDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
                    {loading && (
                        <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Spinner /> Opening the report…</div>
                    )}
                    <canvas ref={canvasRef} className={`block w-full h-auto bg-white ${pageSize ? '' : 'hidden'}`} />
                    {scale > 0 && items.map(item => (
                        <div key={item.id}
                            className={`absolute cursor-move ${selected === item.id ? 'outline outline-2 outline-blue-500' : 'hover:outline hover:outline-1 hover:outline-blue-300'}`}
                            style={{ left: item.x * scale, top: item.y * scale, width: item.w * scale, height: item.h * scale, touchAction: 'none' }}
                            onPointerDown={(e) => startDrag(e, item, 'move')}
                            title={`${item.label} — drag to move`}>
                            <img src={item.src} alt={item.label} draggable={false} className="w-full h-full pointer-events-none" />
                            {selected === item.id && (
                                <>
                                    <button type="button" aria-label={`Remove ${item.label}`}
                                        className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow"
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={() => removeItem(item.id)}>
                                        <X className="w-4 h-4" />
                                    </button>
                                    <span aria-label="Resize"
                                        className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-600 border-2 border-white rounded-sm cursor-nwse-resize"
                                        style={{ touchAction: 'none' }}
                                        onPointerDown={(e) => startDrag(e, item, 'resize')} />
                                </>
                            )}
                        </div>
                    ))}
                </div>
                {pageSize && <p className="text-xs text-slate-500">Page 1 only — the rest of the report is kept as it is. Drag the blue corner to resize.</p>}

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={apply} disabled={!items.length || saving || loading}>
                        {saving ? <Spinner /> : 'Save signed report'}
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
        notify('Link to the report copied — paste it to share.', 'success');
    } catch {
        await promptDialog('Copy this link to share the report:', { defaultValue: url, title: 'Share' });
    }
};

/**
 * The report document with View, Download and Share. `children` adds the
 * managing buttons where the user may change it.
 */
export function ReportDocumentCard({ report, course, children }) {
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
                            {docInfo ? (docInfo.signed ? 'Signed final report' : 'Final report PDF') : 'No report PDF attached'}
                        </div>
                        <div className="text-xs text-slate-500">
                            {!docInfo ? 'Attach the final report PDF, then sign it here.'
                                : !docInfo.signed ? 'Not signed yet'
                                : approval ? `Approved by ${approval.name || '—'} · ${formatDate(approval.date)}`
                                : 'Signed in the app'}
                        </div>
                        {stale && (
                            <div className="text-xs text-amber-700 mt-1">
                                The report PDF was replaced after it was signed — edit the signature to sign the new one.
                            </div>
                        )}
                    </div>
                </div>
                {docInfo && (
                    <div className="grid grid-cols-3 sm:flex gap-2 shrink-0">
                        <a href={docInfo.url} target="_blank" rel="noopener noreferrer" className="contents">
                            <Button variant="secondary" className="justify-center text-sm"><Eye className="w-4 h-4 mr-1" />View</Button>
                        </a>
                        <Button variant="secondary" className="justify-center text-sm" disabled={!!busy}
                            onClick={run('download', () => downloadReportPdf(docInfo.url, docInfo.fileName))}>
                            {busy === 'download' ? <Spinner size="sm" /> : <><Download className="w-4 h-4 mr-1" />Download</>}
                        </Button>
                        <Button variant="secondary" className="justify-center text-sm" disabled={!!busy}
                            onClick={run('share', () => shareReportPdf(docInfo.url, docInfo.fileName,
                                `Final report — ${course?.course_type || ''} ${course?.state || ''}`.trim()))}>
                            {busy === 'share' ? <Spinner size="sm" /> : <><Share2 className="w-4 h-4 mr-1" />Share</>}
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
    const reportInput = useRef(null);

    const reportUrl = finalReport?.pdfUrl || null;
    const signedUrl = finalReport?.signedPdfUrl || null;

    const attachReport = async (file) => {
        if (!file) return;
        if (file.type && file.type !== 'application/pdf') {
            say('That is not a PDF file.', 'error');
            return;
        }
        setBusy('report');
        try {
            onChanged?.(await attachFinalReportPdf(course.id, file, 'report', who));
            say(signedUrl ? 'Report PDF replaced. Edit the signature to sign the new one.' : 'Report PDF attached.', 'success');
        } catch (err) {
            say(`Upload failed: ${err.message}`, 'error');
        } finally {
            setBusy(null);
            if (reportInput.current) reportInput.current.value = '';
        }
    };

    // Filed with the layout that made it, so the signature can be edited.
    const fileSigned = async (file, layout) => {
        setBusy('signed');
        try {
            onChanged?.(await attachFinalReportPdf(course.id, file, 'signed', who, { signatureLayout: layout }));
            say('Signed report saved.', 'success');
        } finally {
            setBusy(null);
        }
    };

    const deleteSignature = async () => {
        if (!await confirmDialog('Delete the signature? The unsigned report PDF is kept.', { danger: true, confirmLabel: 'Delete signature' })) return;
        setBusy('signed');
        try {
            onChanged?.(await removeFinalReportPdf(course.id, 'signed', who));
            say('Signature deleted.', 'info');
        } catch (err) {
            say(`Could not delete it: ${err.message}`, 'error');
        } finally { setBusy(null); }
    };

    // The report goes with its signed copy: a signed copy of a report that is
    // no longer there could not be edited.
    const removeReport = async () => {
        const message = signedUrl
            ? 'Remove the final report PDF? Its signed copy is removed too.'
            : 'Remove the final report PDF?';
        if (!await confirmDialog(message, { danger: true, confirmLabel: 'Remove' })) return;
        setBusy('report');
        try {
            if (signedUrl) await removeFinalReportPdf(course.id, 'signed', who);
            onChanged?.(await removeFinalReportPdf(course.id, 'report', who));
            say('Removed.', 'info');
        } catch (err) {
            say(`Could not remove it: ${err.message}`, 'error');
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
                    {busy === 'report' ? <Spinner size="sm" /> : (reportUrl ? 'Replace report PDF' : 'Add report PDF')}
                </Button>
                {reportUrl && (signedUrl ? (
                    <>
                        <Button variant="primary" disabled={!!busy || !ready} onClick={() => setSignerOpen(true)} className={btn}>
                            {busy === 'signed' ? <Spinner size="sm" /> : <><PenLine className="w-4 h-4 mr-1" />Edit signature</>}
                        </Button>
                        <Button variant="danger" disabled={!!busy || !ready} onClick={deleteSignature} className={btn}>Delete signature</Button>
                    </>
                ) : (
                    <Button variant="primary" disabled={!!busy || !ready} onClick={() => setSignerOpen(true)} className={btn}>
                        {busy === 'signed' ? <Spinner size="sm" /> : <><PenLine className="w-4 h-4 mr-1" />Sign &amp; stamp</>}
                    </Button>
                ))}
                {(reportUrl || signedUrl) && (
                    <Button variant="danger" disabled={!!busy || !ready} onClick={removeReport} className={btn}>Remove report</Button>
                )}
            </ReportDocumentCard>
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
            .catch(e => { if (!cancelled) setLoadError(e.message || 'Could not load the final report.'); });
        return () => { cancelled = true; };
    }, [isOpen, course?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- the cache is read once per open

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Final report — ${course?.course_type || ''} ${course?.state ? `(${course.state})` : ''}`}>
            <div className="space-y-4">
                {loadError && report === undefined ? (
                    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{loadError}</div>
                ) : report === undefined ? (
                    <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500"><Spinner /> Loading the final report…</div>
                ) : (
                    <>
                        <ReportDocumentManager course={course} finalReport={report} ready={fresh}
                            onChanged={(saved) => { setReport(saved); onReportChanged?.(saved); }} />
                        {!fresh && (loadError
                            ? <p className="text-xs text-amber-700">Could not reach the server — showing the saved copy. Changes need a connection.</p>
                            : <p className="text-xs text-slate-500 flex items-center gap-1"><Spinner size="sm" /> Checking for the latest version…</p>)}
                    </>
                )}
                <div className="flex flex-col sm:flex-row sm:justify-between gap-2 pt-3 border-t">
                    {onOpenFullReport ? (
                        <Button variant="secondary" onClick={() => { onClose(); onOpenFullReport(course.id); }} className="justify-center">
                            {report?.summary ? 'Open the full final report' : 'Write the final report (summary, recommendations…)'}
                        </Button>
                    ) : <span />}
                    <Button variant="secondary" onClick={onClose} className="justify-center">Close</Button>
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
    const [view, setView] = useState('courses');
    const [stateFilter, setStateFilter] = useState('All');
    const [yearFilter, setYearFilter] = useState('All');
    const [docFilter, setDocFilter] = useState('All');
    const [recFilter, setRecFilter] = useState('open');
    const [search, setSearch] = useState('');
    const [manageCourse, setManageCourse] = useState(null);
    const [expanded, setExpanded] = useState({});

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

    const recommendations = useMemo(() => rows.flatMap(({ course, report }) =>
        (report?.recommendations || []).filter(r => r?.recommendation).map((r, i) => ({ ...r, course, key: `${course.id}_${i}` })))
        .filter(r => recFilter === 'all' || (recFilter === 'open' ? r.status !== 'completed' : r.status === recFilter)),
    [rows, recFilter]);

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
                <h2 className="text-2xl font-bold text-gray-800">{courseType ? `${courseType} ` : ''}Final Reports Dashboard</h2>
                <p className="text-sm text-gray-500">Final report documents, summaries, recommendations and potential facilitators for each course.</p>
            </div>

            <Card className="bg-gray-50 border border-gray-200 p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <FormGroup label="State"><Select value={stateFilter} onChange={e => setStateFilter(e.target.value)}>{states.map(s => <option key={s} value={s}>{s}</option>)}</Select></FormGroup>
                    <FormGroup label="Year"><Select value={yearFilter} onChange={e => setYearFilter(e.target.value)}>{years.map(y => <option key={y} value={y}>{y}</option>)}</Select></FormGroup>
                    <FormGroup label="Final report">
                        <Select value={docFilter} onChange={e => setDocFilter(e.target.value)}>
                            <option value="All">All courses</option>
                            <option value="none">No report uploaded</option>
                            <option value="unsigned">Uploaded, not signed</option>
                            <option value="signed">Signed</option>
                            <option value="pending">Has pending recommendations</option>
                        </Select>
                    </FormGroup>
                    <FormGroup label="Search"><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="State, locality, director, summary…" /></FormGroup>
                </div>
            </Card>

            {loading ? (
                <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Spinner /> Loading final reports…</div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <Tile label="Courses" value={kpis.courses} />
                        <Tile label="Report uploaded" value={kpis.uploaded} sub={`${pct(kpis.uploaded)}% of courses`} />
                        <Tile label="Signed" value={kpis.signed} sub={`${pct(kpis.signed)}% of courses`} />
                        <Tile label="Courses with pending recommendations" value={kpis.withPending} />
                        <Tile label="Pending recommendations" value={kpis.pending} tone={kpis.pending ? 'border-red-200' : ''} />
                    </div>

                    <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
                        {tab('courses', 'Courses', rows.length)}
                        {tab('recommendations', 'Recommendations', recommendations.length)}
                        {tab('facilitators', 'Potential facilitators', facilitators.length)}
                    </div>

                    {view === 'courses' && (
                        <div className="space-y-3">
                            {rows.length === 0 && <p className="text-center text-sm text-slate-500 p-6">No courses match these filters.</p>}
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
                                                    {courseDateOf(course)?.toLocaleDateString() || 'No start date'}
                                                    {course.director ? ` · Director: ${course.director}` : ''}
                                                </div>
                                                <FinalReportStatusBadges report={report} className="mt-1" />
                                            </button>
                                            <div className="flex gap-2 shrink-0">
                                                <Button variant="secondary" className="text-xs" onClick={() => setExpanded(e => ({ ...e, [course.id]: !open }))}>
                                                    {open ? 'Hide details' : 'Details'}
                                                </Button>
                                                <Button className="text-xs" onClick={() => setManageCourse(course)}>
                                                    <PenLine className="w-4 h-4 mr-1" />{status.uploaded ? 'Manage' : 'Add report'}
                                                </Button>
                                            </div>
                                        </div>
                                        {open && (
                                            <div className="border-t p-3 space-y-4 bg-slate-50/50">
                                                {status.uploaded && <ReportDocumentCard report={report} course={course} />}
                                                <div>
                                                    <h4 className="font-semibold text-sm mb-1">Summary</h4>
                                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{report?.summary || <span className="text-slate-400">No summary written.</span>}</p>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-sm mb-1">Recommendations</h4>
                                                    {recs.length ? (
                                                        <ul className="space-y-1">
                                                            {recs.map((r, i) => (
                                                                <li key={i} className="text-sm flex flex-wrap items-start gap-2">
                                                                    <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${REC_STATUS_STYLE[r.status] || 'bg-slate-100 text-slate-600'}`}>{recStatusLabel(r.status)}</span>
                                                                    <span className="flex-1 min-w-0">{r.recommendation}{r.responsible && <span className="text-slate-500"> — {r.responsible}</span>}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : <p className="text-sm text-slate-400">No recommendations.</p>}
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-sm mb-1">Potential facilitators</h4>
                                                    {facs.length
                                                        ? <p className="text-sm text-slate-700">{facs.map(f => f.participant_name || 'N/A').join(', ')}</p>
                                                        : <p className="text-sm text-slate-400">None identified.</p>}
                                                </div>
                                                {onOpenFullReport && (
                                                    <Button variant="secondary" className="text-xs" onClick={() => onOpenFullReport(course.id)}>
                                                        {report?.summary ? 'Open the full final report' : 'Write the final report'}
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
                                <span className="text-sm text-slate-600">Show:</span>
                                {[['open', 'Pending (not completed)'], ['all', 'All'], ['pending', 'Pending'], ['in-progress', 'In progress'], ['completed', 'Completed']].map(([v, l]) => (
                                    <Button key={v} variant={recFilter === v ? 'primary' : 'secondary'} className="text-xs" onClick={() => setRecFilter(v)}>{l}</Button>
                                ))}
                            </div>
                            <Table headers={['Course', 'Recommendation', 'Responsible', 'Status']}>
                                {recommendations.length ? recommendations.map(r => (
                                    <tr key={r.key}>
                                        <td className="p-2 border text-sm whitespace-nowrap">{courseLabelOf(r.course)}<div className="text-xs text-slate-500">{courseDateOf(r.course)?.toLocaleDateString()}</div></td>
                                        <td className="p-2 border text-sm">{r.recommendation}</td>
                                        <td className="p-2 border text-sm">{r.responsible || '—'}</td>
                                        <td className="p-2 border text-sm"><span className={`text-xs font-semibold rounded px-1.5 py-0.5 ${REC_STATUS_STYLE[r.status] || 'bg-slate-100 text-slate-600'}`}>{recStatusLabel(r.status)}</span></td>
                                    </tr>
                                )) : <tr><td colSpan="4" className="p-4 text-center text-sm text-slate-500">No recommendations in these filters.</td></tr>}
                            </Table>
                        </div>
                    )}

                    {view === 'facilitators' && (
                        <Table headers={['#', 'Potential facilitator', 'Course', 'Course date']}>
                            {facilitators.length ? facilitators.map((f, i) => (
                                <tr key={f.key}>
                                    <td className="p-2 border text-sm">{i + 1}</td>
                                    <td className="p-2 border text-sm font-semibold">{f.participant_name || 'N/A'}</td>
                                    <td className="p-2 border text-sm">{courseLabelOf(f.course)}</td>
                                    <td className="p-2 border text-sm">{courseDateOf(f.course)?.toLocaleDateString() || '—'}</td>
                                </tr>
                            )) : <tr><td colSpan="4" className="p-4 text-center text-sm text-slate-500">No potential facilitators in these filters.</td></tr>}
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

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        setPdfFile(file);
        if (file) {
            setFileName(file.name);
            setExistingPdfUrl(null);
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
                <PageHeader title={`${initialData ? 'Edit' : 'Create'} Final Report for ${course.course_type} - ${course.state}`} subtitle="Complete the final report for this course." />
                <div className="space-y-6 mt-6 p-6">
                    <FormGroup label="Course Summary"><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows="5" /></FormGroup>
                    
                    <h3 className="text-xl font-bold mb-2">Course Recommendations</h3>
                    <Table headers={['Recommendation', 'Responsible', 'Status', 'Actions']}>
                        {recommendations.map((rec, index) => (
                            <tr key={index}>
                                <td className="p-2 border"><Input value={rec.recommendation} onChange={(e) => updateRecommendation(index, 'recommendation', e.target.value)} /></td>
                                <td className="p-2 border"><Input value={rec.responsible} onChange={(e) => updateRecommendation(index, 'responsible', e.target.value)} /></td>
                                <td className="p-2 border"><Select value={rec.status} onChange={(e) => updateRecommendation(index, 'status', e.target.value)}><option value="">Select Status</option><option value="pending">Pending</option><option value="in-progress">In Progress</option><option value="completed">Completed</option></Select></td>
                                <td className="p-2 border"><Button variant="danger" onClick={() => removeRecommendation(index)}>Remove</Button></td>
                            </tr>
                        ))}
                        <tr><td colSpan="4" className="p-2 border-t"><Button variant="secondary" onClick={addRecommendation}>Add Recommendation</Button></td></tr>
                    </Table>

                    <h3 className="text-xl font-bold mb-2">Potential Facilitators</h3>
                    <Table headers={['Participant', 'Phone Number', 'Responsible Facilitator', 'Actions']}>
                        {potentialFacilitators.map((fac, index) => {
                            const participant = participants.find(p => p.id === fac.participant_id);
                            const responsibleFacilitator = course.facilitatorAssignments?.find(f => f.group === participant?.group);
                            return (
                                <tr key={index}>
                                    <td className="p-2 border"><Select value={fac.participant_id} onChange={(e) => updatePotentialFacilitator(index, e.target.value)}><option value="">Select Participant</option>{(participants || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></td>
                                    <td className="p-2 border">{participant?.phone || 'N/A'}</td>
                                    <td className="p-2 border">{responsibleFacilitator?.name || 'N/A'}</td>
                                    <td className="p-2 border"><Button variant="danger" onClick={() => removePotentialFacilitator(index)}>Remove</Button></td>
                                </tr>
                            );
                        })}
                        <tr><td colSpan="4" className="p-2 border-t"><Button variant="secondary" onClick={addPotentialFacilitator}>Add Potential Facilitator</Button></td></tr>
                    </Table>

                    <h3 className="text-xl font-bold mb-2">Participants Requiring Follow-up</h3>
                    <Table headers={['Participant', 'Phone Number', 'Comment / Action Required', 'Actions']}>
                        {participantsForFollowUp.map((p, index) => (
                            <tr key={index}>
                                <td className="p-2 border" style={{width: '25%'}}><Select value={p.participant_id} onChange={(e) => updateFollowUpParticipant(index, 'participant_id', e.target.value)}><option value="">Select Participant</option>{(participants || []).map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}</Select></td>
                                <td className="p-2 border" style={{width: '15%'}}>{p.phone || 'N/A'}</td>
                                <td className="p-2 border"><Input value={p.comment} onChange={(e) => updateFollowUpParticipant(index, 'comment', e.target.value)} placeholder="e.g., Needs more clinical practice" /></td>
                                <td className="p-2 border" style={{width: '10%'}}><Button variant="danger" onClick={() => removeFollowUpParticipant(index)}>Remove</Button></td>
                            </tr>
                        ))}
                        <tr><td colSpan="4" className="p-2 border-t"><Button variant="secondary" onClick={addFollowUpParticipant}>Add Participant</Button></td></tr>
                    </Table>

                    <h3 className="text-xl font-bold mb-2">Course Gallery (up to 3 images)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[0, 1, 2].map(index => (
                            <div key={index} className="border rounded-lg p-3 flex flex-col items-center justify-center space-y-2">
                                {galleryImageUrls[index] ? (
                                    <>
                                        <img src={galleryImageUrls[index]} alt={`Gallery item ${index + 1}`} className="w-full h-32 object-cover rounded-md" />
                                        <Button variant="danger" size="sm" onClick={() => handleDeleteGalleryImage(index)}>Remove Image</Button>
                                    </>
                                ) : (
                                    <div className="text-center">
                                        <label htmlFor={`gallery-upload-${index}`} className="cursor-pointer text-blue-600 hover:text-blue-800 font-semibold">Click to upload image</label>
                                        <input id={`gallery-upload-${index}`} type="file" accept="image/*" className="hidden" onChange={(e) => handleGalleryImageUpload(e, index)} />
                                        <p className="text-xs text-gray-500 mt-1">Image {index + 1}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <h3 className="text-xl font-bold mb-2">Report documents</h3>
                    <p className="text-sm text-gray-500 mb-3">
                        The report itself, and the signed copy that gets filed. The signed copy is made
                        in the app: signatures and the stamp are placed on the report's first page. Both
                        can also be done from the course report screen without opening this editor.
                    </p>
                    <Table headers={['Document', 'Actions']}>
                        <tbody>
                            <tr>
                                <td className="p-2 border align-top">
                                    <div className="font-semibold text-sm">Final report PDF</div>
                                    {existingPdfUrl
                                        ? <div className="flex items-center gap-2 mt-1"><PdfIcon className="text-blue-500 w-5 h-5" /><span className="text-xs">Attached</span></div>
                                        : <span className="text-gray-500 text-xs">Not attached</span>}
                                </td>
                                <td className="p-2 border">
                                    {existingPdfUrl ? (
                                        <div className="flex flex-wrap gap-2">
                                            <a href={existingPdfUrl} target="_blank" rel="noopener noreferrer"><Button variant="info">View</Button></a>
                                            <Button variant="primary" onClick={() => handleForceDownload(existingPdfUrl, `Final_Report_${course.course_type}_${course.state}.pdf`)} disabled={isDownloading}>{isDownloading ? <Spinner/> : 'Download'}</Button>
                                            <Button variant="danger" onClick={() => { setExistingPdfUrl(null); setPdfFile(null); setFileName(null); }}>Delete</Button>
                                        </div>
                                    ) : ( <div className="flex flex-col sm:flex-row sm:items-center gap-2"><input type="file" accept=".pdf" onChange={handleFileUpload} />{fileName && <p className="text-sm text-gray-500 break-all">File selected: {fileName}</p>}</div> )}
                                </td>
                            </tr>
                            <tr>
                                <td className="p-2 border align-top">
                                    <div className="font-semibold text-sm">Signed final report</div>
                                    {existingSignedPdfUrl
                                        ? <div className="flex items-center gap-2 mt-1"><PdfIcon className="text-emerald-600 w-5 h-5" /><span className="text-xs">Signed copy attached</span></div>
                                        : <span className="text-gray-500 text-xs">Not attached</span>}
                                </td>
                                <td className="p-2 border">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {existingSignedPdfUrl && (
                                            <a href={existingSignedPdfUrl} target="_blank" rel="noopener noreferrer"><Button variant="info">View</Button></a>
                                        )}
                                        {(existingSignedPdfUrl || signedPdfFile) ? (
                                            <>
                                                <Button variant="primary" onClick={() => setSignerOpen(true)} disabled={!reportSource}>
                                                    <PenLine className="w-4 h-4 mr-1" /> Edit signature
                                                </Button>
                                                <Button variant="danger" onClick={deleteSignature}>
                                                    <Trash2 className="w-4 h-4 mr-1" /> Delete signature
                                                </Button>
                                                {signedPdfFile && <p className="text-sm text-emerald-700">Signed — saved with the report.</p>}
                                            </>
                                        ) : (
                                            <>
                                                <Button variant="primary" onClick={() => setSignerOpen(true)} disabled={!reportSource}>
                                                    <PenLine className="w-4 h-4 mr-1" /> Sign & stamp
                                                </Button>
                                                {!reportSource && <p className="text-xs text-gray-500">Attach the final report PDF first.</p>}
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
                <div className="flex gap-2 justify-end mt-6 border-t pt-6 px-6 pb-6"><Button variant="secondary" onClick={handleCancelEdit}>Cancel</Button><Button onClick={handleSave}>Save Final Report</Button></div>
            </Card>
        );
    }

    const finalGalleryUrls = initialData?.galleryImageUrls?.filter(url => url) || [];
    const finalFollowUpList = initialData?.participantsForFollowUp?.filter(p => p.participant_id) || [];
    const finalSummary = initialData?.summary || 'No summary provided.';
    const finalRecommendations = initialData?.recommendations?.filter(r => r.recommendation) || [];
    const finalFacilitatorList = initialData?.potentialFacilitators?.filter(f => f.participant_id) || [];

    return (
        <Card>
            <PageHeader 
                title={`Final Report for ${course.course_type} - ${course.state}`} 
                subtitle="Review the summary, recommendations, and documents for this course." 
                actions={canUseFederalManagerAdvancedFeatures && <Button onClick={() => setIsEditing(true)}>Edit Report</Button>} 
            />
            <div className="space-y-8 mt-6 p-6">
                <div><h3 className="text-xl font-bold mb-2 text-gray-800">Course Summary</h3><p className="text-gray-700 whitespace-pre-wrap">{finalSummary}</p></div>
                
                <div><h3 className="text-xl font-bold mb-2 text-gray-800">Course Recommendations</h3><Table headers={['#', 'Recommendation', 'Responsible', 'Status']}>{finalRecommendations.length > 0 ? (finalRecommendations.map((rec, index) => (<tr key={index}><td className="p-2 border">{index + 1}</td><td className="p-2 border">{rec.recommendation}</td><td className="p-2 border">{rec.responsible}</td><td className="p-2 border capitalize">{rec.status}</td></tr>))) : (<tr><td colSpan="4" className="p-4 text-center text-gray-500">No recommendations were made.</td></tr>)}</Table></div>
                
                <div>
                    <h3 className="text-xl font-bold mb-2 text-gray-800">Potential Facilitators</h3>
                    <Table headers={['#', 'Participant Name', 'Phone Number', 'Responsible Facilitator']}>
                        {finalFacilitatorList.length > 0 ? (
                            finalFacilitatorList.map((fac, index) => {
                                const participant = participants.find(p => p.id === fac.participant_id);
                                const responsibleFacilitator = course.facilitatorAssignments?.find(f => f.group === participant?.group);
                                
                                return (
                                    <tr key={index}>
                                        <td className="p-2 border">{index + 1}</td>
                                        <td className="p-2 border">{fac.participant_name || 'N/A'}</td>
                                        <td className="p-2 border">{participant?.phone || 'N/A'}</td>
                                        <td className="p-2 border">{responsibleFacilitator?.name || 'N/A'}</td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr><td colSpan="4" className="p-4 text-center text-gray-500">No potential facilitators were identified.</td></tr>
                        )}
                    </Table>
                </div>
                
                <div><h3 className="text-xl font-bold mb-2 text-gray-800">Participants Requiring Follow-up</h3><Table headers={['#', 'Participant Name', 'Phone', 'Comment / Action Required']}>{finalFollowUpList.length > 0 ? (finalFollowUpList.map((p, index) => (<tr key={index}><td className="p-2 border">{index + 1}</td><td className="p-2 border">{p.participant_name}</td><td className="p-2 border">{p.phone}</td><td className="p-2 border">{p.comment}</td></tr>))) : (<tr><td colSpan="4" className="p-4 text-center text-gray-500">No participants were marked for follow-up.</td></tr>)}</Table></div>
                
                <div>
                    <h3 className="text-xl font-bold mb-2 text-gray-800">Course Gallery</h3>
                    {finalGalleryUrls.length > 0 ? (<div className="grid grid-cols-1 md:grid-cols-3 gap-4">{finalGalleryUrls.map((url, index) => (<a key={index} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={`Gallery item ${index + 1}`} className="w-full h-48 object-cover rounded-lg shadow-md hover:shadow-xl transition-shadow" /></a>))}</div>) : (<p className="text-gray-500">No images were added to the gallery.</p>)}
                </div>
                {showDocument && (initialData?.pdfUrl || initialData?.signedPdfUrl) && (
                    <div>
                        <h3 className="text-xl font-bold mb-2 text-gray-800">Report document</h3>
                        <ReportDocumentCard report={initialData} course={course} />
                    </div>
                )}
                
                <AnnexSection 
                    groupedParticipants={finalGroupedParticipants} 
                    annexFacilitators={finalAnnexFacilitators} 
                />
            </div>
            <div className="flex justify-end mt-6 border-t pt-6 px-6 pb-6"><Button variant="secondary" onClick={onCancel}>Back</Button></div>
        </Card>
    );
}