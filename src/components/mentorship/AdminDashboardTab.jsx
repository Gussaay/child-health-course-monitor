// AdminDashboardTab.jsx
import React, { useRef, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KpiCard, VolumeLineChart, GeographicVolumeTable, MentorPerformanceTable } from './MentorshipDashboardShared';

/* ============================================================================
   HEALTH WORKER VISITS & INTERVALS
   Table of every mentored health worker: number of visits, duration between
   visit 1 and visit 4, average interval between visits, filtering by number of
   visits and Excel download.
   ========================================================================== */

const DAY_MS = 24 * 60 * 60 * 1000;

// Accepts JS Date, ISO string, "YYYY-MM-DD", Firestore Timestamp, or {seconds}
const toDate = (value) => {
    if (!value) return null;
    try {
        if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
        if (typeof value === 'object') {
            if (typeof value.toDate === 'function') {
                const d = value.toDate();
                return isNaN(d.getTime()) ? null : d;
            }
            if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
        }
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    } catch (e) {
        return null;
    }
};

const fmtDate = (d) => {
    if (!d) return '—';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const daysBetween = (a, b) => {
    if (!a || !b) return null;
    return Math.round((b.getTime() - a.getTime()) / DAY_MS);
};

/* ---------------------------------------------------------------------------
   Minimal .xlsx writer — produces a genuine Office Open XML workbook
   (real Excel file, opens with no "format doesn't match extension" warning).
   No external library required.
   --------------------------------------------------------------------------- */

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[i] = c >>> 0;
    }
    return table;
})();

const crc32 = (bytes) => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
};

const utf8Bytes = (str) => new TextEncoder().encode(str);

// Store-only ZIP container (no compression) — valid for xlsx
const zipFiles = (entries) => {
    const parts = [];
    const central = [];
    let offset = 0;

    entries.forEach(entry => {
        const nameBytes = utf8Bytes(entry.name);
        const data = utf8Bytes(entry.content);
        const crc = crc32(data);

        const local = new Uint8Array(30 + nameBytes.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(4, 20, true);
        lv.setUint16(6, 0x0800, true);      // UTF-8 file names
        lv.setUint16(8, 0, true);           // stored, no compression
        lv.setUint16(10, 0, true);          // mod time
        lv.setUint16(12, 0x5A21, true);     // mod date
        lv.setUint32(14, crc, true);
        lv.setUint32(18, data.length, true);
        lv.setUint32(22, data.length, true);
        lv.setUint16(26, nameBytes.length, true);
        lv.setUint16(28, 0, true);
        local.set(nameBytes, 30);

        parts.push(local, data);

        const cd = new Uint8Array(46 + nameBytes.length);
        const cv = new DataView(cd.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint16(8, 0x0800, true);
        cv.setUint16(10, 0, true);
        cv.setUint16(12, 0, true);
        cv.setUint16(14, 0x5A21, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, data.length, true);
        cv.setUint32(24, data.length, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint16(30, 0, true);
        cv.setUint16(32, 0, true);
        cv.setUint16(34, 0, true);
        cv.setUint16(36, 0, true);
        cv.setUint32(38, 0, true);
        cv.setUint32(42, offset, true);
        cd.set(nameBytes, 46);

        central.push(cd);
        offset += local.length + data.length;
    });

    const centralSize = central.reduce((sum, c) => sum + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, central.length, true);
    ev.setUint16(10, central.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    const all = [...parts, ...central, end];
    const total = all.reduce((sum, p) => sum + p.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    all.forEach(p => { out.set(p, pos); pos += p.length; });
    return out;
};

const xmlEsc = (v) => String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const colLetter = (index) => {
    let s = '';
    let n = index;
    while (n >= 0) {
        s = String.fromCharCode(65 + (n % 26)) + s;
        n = Math.floor(n / 26) - 1;
    }
    return s;
};

// Excel serial date (1900 date system)
const excelSerial = (d) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000) + 25569;

// Style indexes used below (see STYLES_XML cellXfs order)
const S = {
    DEFAULT: 0, TITLE: 1, SUMMARY: 2, HEADER: 3,
    TEXT_L: 4, NAME_L: 5, TEXT_R: 6, NAME_R: 7,
    CENTER: 8, VISITS: 9, DATE: 10, SPAN: 11, AVG: 12, FOOTER: 13
};

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="0.0"/></numFmts>
<fonts count="9">
<font><sz val="11"/><color rgb="FF1E293B"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><color rgb="FF1E293B"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF334155"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF1E293B"/><name val="Calibri"/></font>
<font><sz val="11"/><color rgb="FF475569"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF065F46"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF92400E"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF075985"/><name val="Calibri"/></font>
<font><i/><sz val="9"/><color rgb="FF64748B"/><name val="Calibri"/></font>
</fonts>
<fills count="8">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF0F9FF"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFECFDF5"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFFBEB"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="14">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="8" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="7" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="164" fontId="4" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="5" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="165" fontId="6" fillId="6" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="8" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

// cells: array of { v, s, t } — t: 'n' number, 'd' date, anything else = text
const buildRowXml = (rowIndex, cells, height) => {
    const body = cells.map((cell, i) => {
        if (!cell) return '';
        const ref = `${colLetter(i)}${rowIndex}`;
        const style = cell.s != null ? ` s="${cell.s}"` : '';
        if (cell.v === null || cell.v === undefined || cell.v === '') return `<c r="${ref}"${style}/>`;
        if (cell.t === 'n') return `<c r="${ref}"${style}><v>${cell.v}</v></c>`;
        if (cell.t === 'd') return `<c r="${ref}"${style}><v>${excelSerial(cell.v)}</v></c>`;
        return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(cell.v)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex}"${height ? ` ht="${height}" customHeight="1"` : ''}>${body}</row>`;
};

const buildWorkbook = ({ sheetName, rightToLeft, colWidths, rowsXml, dimension, autoFilterRef, merges, freezeRow }) => {
    const cols = colWidths
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join('');

    const mergeXml = merges && merges.length
        ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
        : '';

    const pane = freezeRow
        ? `<pane ySplit="${freezeRow}" topLeftCell="A${freezeRow + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${freezeRow + 1}" sqref="A${freezeRow + 1}"/>`
        : '';

    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="${dimension}"/>
<sheetViews><sheetView tabSelected="1" workbookViewId="0" showGridLines="0"${rightToLeft ? ' rightToLeft="1"' : ''}>${pane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="18"/>
<cols>${cols}</cols>
<sheetData>${rowsXml}</sheetData>
${autoFilterRef ? `<autoFilter ref="${autoFilterRef}"/>` : ''}
${mergeXml}
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
<pageSetup orientation="landscape" fitToWidth="1" paperSize="9"/>
</worksheet>`;

    return zipFiles([
        {
            name: '[Content_Types].xml',
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
        },
        {
            name: '_rels/.rels',
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
        },
        {
            name: 'xl/workbook.xml',
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${xmlEsc(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
        },
        {
            name: 'xl/_rels/workbook.xml.rels',
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
        },
        { name: 'xl/styles.xml', content: STYLES_XML },
        { name: 'xl/worksheets/sheet1.xml', content: sheet }
    ]);
};

const VISIT_FILTERS = [
    { key: 'all', label: 'All health workers' },
    { key: '1', label: 'Exactly 1 visit' },
    { key: '2', label: 'Exactly 2 visits' },
    { key: '3', label: 'Exactly 3 visits' },
    { key: '4', label: 'Exactly 4 visits' },
    { key: '4plus', label: '4 or more visits' },
    { key: 'under4', label: 'Fewer than 4 visits' }
];

const HealthWorkerVisitsTable = ({
    submissions = [],
    activeService,
    title = 'Health Worker Visit Coverage & Intervals'
}) => {
    const { t, i18n } = useTranslation();
    const language = i18n.language?.startsWith('ar') ? 'ar' : 'en';
    const isAr = language === 'ar';

    const [visitFilter, setVisitFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('visits'); // 'visits' | 'name' | 'avgGap' | 'span'

    // --- Build one row per health worker -------------------------------------
    const allRows = useMemo(() => {
        const map = new Map();

        (submissions || []).forEach(sub => {
            // Skip mother-survey submissions and other services
            if (activeService && sub.service !== activeService) return;

            const staff = (sub.staff || '').toString().trim();
            if (!staff) return;

            const date = toDate(sub.date || sub.sessionDate || sub.visitDate);
            const rawVisitNum = sub.visitNumber ?? sub.fullData?.visitNumber;
            const visitNum = parseInt(rawVisitNum, 10);
            const hasVisitNum = Number.isFinite(visitNum) && visitNum > 0;

            // A "visit" = one visit number, or one distinct date when the number is missing
            const visitKey = hasVisitNum ? `v${visitNum}` : (date ? `d${fmtDate(date)}` : null);
            if (!visitKey) return;

            const rowKey = `${staff}__${sub.facilityId || sub.facility || 'unknown'}`;
            if (!map.has(rowKey)) {
                map.set(rowKey, {
                    key: rowKey,
                    staff,
                    facility: sub.facility || sub.facilityName || 'Unknown',
                    facilityId: sub.facilityId || '',
                    state: sub.state || '',
                    locality: sub.locality || '',
                    workerType: sub.workerType || '',
                    project: sub.project || '',
                    mentors: new Set(),
                    visits: new Map(),
                    casesCount: 0
                });
            }

            const entry = map.get(rowKey);
            entry.casesCount += 1;
            if (!entry.workerType && sub.workerType) entry.workerType = sub.workerType;

            const mentor = sub.supervisorDisplay || sub.supervisorEmail;
            if (mentor) entry.mentors.add(mentor);

            const existing = entry.visits.get(visitKey);
            if (!existing) {
                entry.visits.set(visitKey, { num: hasVisitNum ? visitNum : null, date });
            } else if (date && (!existing.date || date < existing.date)) {
                // keep the earliest date recorded for that visit
                existing.date = date;
            }
        });

        return Array.from(map.values()).map(entry => {
            const visits = Array.from(entry.visits.values());

            // Order by visit number when available, otherwise chronologically
            const ordered = [...visits].sort((a, b) => {
                if (a.num != null && b.num != null) return a.num - b.num;
                if (a.date && b.date) return a.date - b.date;
                return 0;
            });

            const datedSorted = visits.filter(v => v.date).sort((a, b) => a.date - b.date);
            const visitCount = visits.length;

            const firstDate = datedSorted.length ? datedSorted[0].date : null;
            const lastDate = datedSorted.length ? datedSorted[datedSorted.length - 1].date : null;

            // Visit 1 and Visit 4: by visit number if present, else 1st and 4th chronologically
            const byNum = (n) => ordered.find(v => v.num === n);
            const v1 = byNum(1) || datedSorted[0] || null;
            const v4 = byNum(4) || (datedSorted.length >= 4 ? datedSorted[3] : null);
            const spanV1V4 = (v1 && v4) ? daysBetween(v1.date, v4.date) : null;

            // Average gap between consecutive visits
            let avgGap = null;
            if (datedSorted.length >= 2) {
                let total = 0;
                for (let i = 1; i < datedSorted.length; i++) {
                    total += (datedSorted[i].date - datedSorted[i - 1].date) / DAY_MS;
                }
                avgGap = Math.round((total / (datedSorted.length - 1)) * 10) / 10;
            }

            const visitNumbers = ordered
                .map(v => (v.num != null ? v.num : null))
                .filter(n => n != null)
                .sort((a, b) => a - b);

            return {
                key: entry.key,
                staff: entry.staff,
                facility: entry.facility,
                state: entry.state,
                locality: entry.locality,
                workerType: entry.workerType || 'N/A',
                project: entry.project,
                mentors: Array.from(entry.mentors).join(', ') || 'Unknown',
                casesCount: entry.casesCount,
                visitCount,
                visitNumbers,
                firstDate,
                lastDate,
                spanV1V4,
                avgGap,
                totalSpan: daysBetween(firstDate, lastDate)
            };
        });
    }, [submissions, activeService]);

    // --- Filtering & sorting --------------------------------------------------
    const rows = useMemo(() => {
        const term = search.trim().toLowerCase();

        const filtered = allRows.filter(r => {
            const n = r.visitCount;
            let visitMatch = true;
            if (visitFilter === '1') visitMatch = n === 1;
            else if (visitFilter === '2') visitMatch = n === 2;
            else if (visitFilter === '3') visitMatch = n === 3;
            else if (visitFilter === '4') visitMatch = n === 4;
            else if (visitFilter === '4plus') visitMatch = n >= 4;
            else if (visitFilter === 'under4') visitMatch = n < 4;

            if (!visitMatch) return false;
            if (!term) return true;

            return [r.staff, r.facility, r.locality, r.state, r.mentors, r.workerType]
                .join(' ')
                .toLowerCase()
                .includes(term);
        });

        return filtered.sort((a, b) => {
            if (sortBy === 'name') return a.staff.localeCompare(b.staff);
            if (sortBy === 'avgGap') return (b.avgGap ?? -1) - (a.avgGap ?? -1);
            if (sortBy === 'span') return (b.spanV1V4 ?? -1) - (a.spanV1V4 ?? -1);
            if (b.visitCount !== a.visitCount) return b.visitCount - a.visitCount;
            return a.staff.localeCompare(b.staff);
        });
    }, [allRows, visitFilter, search, sortBy]);

    // --- Summary chips --------------------------------------------------------
    const summary = useMemo(() => {
        const total = allRows.length;
        const completed = allRows.filter(r => r.visitCount >= 4).length;
        const gaps = allRows.map(r => r.avgGap).filter(g => g != null);
        const avgGap = gaps.length
            ? Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10
            : null;
        const spans = allRows.map(r => r.spanV1V4).filter(s => s != null);
        const avgSpan = spans.length
            ? Math.round(spans.reduce((a, b) => a + b, 0) / spans.length)
            : null;
        return { total, completed, avgGap, avgSpan };
    }, [allRows]);

    // --- Excel export (real .xlsx, same columns/layout as the table on screen) ---
    const handleDownloadExcel = () => {
        const headers = [
            '#', t('Health Worker'), t('Job Title'), t('Facility'), t('Locality'), t('Supervisor'),
            t('Number of Visits'), t('Visit Numbers'), t('First Visit'), t('Last Visit'),
            `${t('Visit 1 → Visit 4')} (${t('days')})`, `${t('Average Interval')} (${t('days')})`
        ];
        const colWidths = [5, 30, 18, 30, 20, 28, 14, 14, 13, 13, 16, 17];
        const lastCol = colLetter(headers.length - 1);

        const TEXT = isAr ? S.TEXT_R : S.TEXT_L;
        const NAME = isAr ? S.NAME_R : S.NAME_L;

        const filterLabel = VISIT_FILTERS.find(f => f.key === visitFilter)?.label || 'All health workers';
        const summaryLine = [
            `${t('Health Workers')}: ${summary.total}`,
            `${t('Reached 4 visits')}: ${summary.completed}${summary.total > 0 ? ` (${Math.round((summary.completed / summary.total) * 100)}%)` : ''}`,
            summary.avgGap != null ? `${t('Average Days between Visits')}: ${summary.avgGap}` : null,
            summary.avgSpan != null ? `${t('Average V1 → V4 duration')}: ${summary.avgSpan} ${t('days')}` : null
        ].filter(Boolean).join('   |   ');

        const contextLine = [
            `${t('Service')}: ${activeService || '—'}`,
            `${t('Filter')}: ${t(filterLabel)}`,
            search.trim() ? `${t('Search')}: ${search.trim()}` : null,
            `${t('Showing')}: ${rows.length} / ${allRows.length}`,
            `${t('Exported')}: ${fmtDate(new Date())}`
        ].filter(Boolean).join('   |   ');

        const pad = (cell, style) => {
            const arr = new Array(headers.length).fill(null).map(() => ({ v: '', s: style }));
            arr[0] = cell;
            return arr;
        };

        const xmlRows = [];
        xmlRows.push(buildRowXml(1, pad({ v: t(title), s: S.TITLE }, S.TITLE), 30));
        xmlRows.push(buildRowXml(2, pad({ v: summaryLine, s: S.SUMMARY }, S.SUMMARY), 20));
        xmlRows.push(buildRowXml(3, pad({ v: contextLine, s: S.SUMMARY }, S.SUMMARY), 20));
        xmlRows.push(buildRowXml(4, headers.map(h => ({ v: h, s: S.HEADER })), 34));

        rows.forEach((r, i) => {
            xmlRows.push(buildRowXml(5 + i, [
                { v: i + 1, t: 'n', s: S.CENTER },
                { v: r.staff, s: NAME },
                { v: t(r.workerType), s: TEXT },
                { v: r.facility, s: TEXT },
                { v: r.locality, s: TEXT },
                { v: r.mentors, s: TEXT },
                { v: r.visitCount, t: 'n', s: S.VISITS },
                { v: r.visitNumbers.length ? r.visitNumbers.join(', ') : '', s: S.CENTER },
                r.firstDate ? { v: r.firstDate, t: 'd', s: S.DATE } : { v: '—', s: S.CENTER },
                r.lastDate ? { v: r.lastDate, t: 'd', s: S.DATE } : { v: '—', s: S.CENTER },
                r.spanV1V4 == null ? { v: '—', s: S.SPAN } : { v: r.spanV1V4, t: 'n', s: S.SPAN },
                r.avgGap == null ? { v: '—', s: S.AVG } : { v: r.avgGap, t: 'n', s: S.AVG }
            ]));
        });

        const lastDataRow = 4 + rows.length;
        const noteRow = lastDataRow + 2;
        xmlRows.push(buildRowXml(noteRow, pad({
            v: t('A visit is counted once per visit number; workers with fewer than 4 visits show “—” for the Visit 1 → Visit 4 duration.'),
            s: S.FOOTER
        }, S.FOOTER), 28));

        const bytes = buildWorkbook({
            sheetName: t('Health Worker Visits'),
            rightToLeft: isAr,
            colWidths,
            rowsXml: xmlRows.join(''),
            dimension: `A1:${lastCol}${noteRow}`,
            autoFilterRef: rows.length ? `A4:${lastCol}${lastDataRow}` : '',
            merges: [`A1:${lastCol}1`, `A2:${lastCol}2`, `A3:${lastCol}3`, `A${noteRow}:${lastCol}${noteRow}`],
            freezeRow: 4
        });

        const blob = new Blob([bytes], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `health_worker_visits_${activeService || 'all'}_${fmtDate(new Date())}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (!allRows.length) return null;

    const thBase = 'px-4 py-3 border-b border-black border-l border-black font-extrabold text-center whitespace-nowrap';

    return (
        <div className="bg-white rounded-2xl shadow-md border border-black overflow-hidden mb-10">
            <div className="p-5 border-b border-black bg-slate-100">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h4 className="text-lg font-extrabold text-slate-800 break-words">{t(title)}</h4>
                        <div className="flex flex-wrap gap-3 mt-2 text-xs font-semibold text-slate-600">
                            <span className="bg-white border border-slate-300 rounded-full px-3 py-1">
                                {t('Health Workers')}: <b className="text-slate-900">{summary.total}</b>
                            </span>
                            <span className="bg-white border border-slate-300 rounded-full px-3 py-1">
                                {t('Reached 4 visits')}: <b className="text-emerald-700">{summary.completed}</b>
                                {summary.total > 0 && ` (${Math.round((summary.completed / summary.total) * 100)}%)`}
                            </span>
                            {summary.avgGap != null && (
                                <span className="bg-white border border-slate-300 rounded-full px-3 py-1">
                                    {t('Average Days between Visits')}: <b className="text-sky-700">{summary.avgGap}</b>
                                </span>
                            )}
                            {summary.avgSpan != null && (
                                <span className="bg-white border border-slate-300 rounded-full px-3 py-1">
                                    {t('Average V1 → V4 duration')}: <b className="text-sky-700">{summary.avgSpan} {t('days')}</b>
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('Search health worker or facility...')}
                            className="border border-slate-400 rounded-lg px-3 py-2 text-sm bg-white focus:border-sky-500 focus:ring-sky-500 min-w-[200px]"
                        />
                        <select
                            value={visitFilter}
                            onChange={(e) => setVisitFilter(e.target.value)}
                            className="border border-slate-400 rounded-lg px-3 py-2 text-sm font-semibold bg-white focus:border-sky-500 focus:ring-sky-500"
                        >
                            {VISIT_FILTERS.map(opt => (
                                <option key={opt.key} value={opt.key}>{t(opt.label)}</option>
                            ))}
                        </select>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="border border-slate-400 rounded-lg px-3 py-2 text-sm font-semibold bg-white focus:border-sky-500 focus:ring-sky-500"
                        >
                            <option value="visits">{t('Sort by: Visits')}</option>
                            <option value="name">{t('Sort by: Name')}</option>
                            <option value="avgGap">{t('Sort by: Average interval')}</option>
                            <option value="span">{t('Sort by: V1 → V4 duration')}</option>
                        </select>
                        <button
                            onClick={handleDownloadExcel}
                            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold shadow transition-colors text-sm whitespace-nowrap"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            {t('Download Excel')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse" dir={isAr ? 'rtl' : 'ltr'}>
                    <thead className="bg-slate-200 text-xs uppercase text-slate-700 tracking-wider">
                        <tr>
                            <th className={thBase}>#</th>
                            <th className={`px-4 py-3 border-b border-black border-l border-black font-extrabold ${isAr ? 'text-right' : 'text-start'}`}>{t('Health Worker')}</th>
                            <th className={`px-4 py-3 border-b border-black border-l border-black font-extrabold ${isAr ? 'text-right' : 'text-start'}`}>{t('Job Title')}</th>
                            <th className={`px-4 py-3 border-b border-black border-l border-black font-extrabold ${isAr ? 'text-right' : 'text-start'}`}>{t('Facility')}</th>
                            <th className={`px-4 py-3 border-b border-black border-l border-black font-extrabold ${isAr ? 'text-right' : 'text-start'}`}>{t('Locality')}</th>
                            <th className={`px-4 py-3 border-b border-black border-l border-black font-extrabold ${isAr ? 'text-right' : 'text-start'}`}>{t('Supervisor')}</th>
                            <th className={`${thBase} bg-sky-50`}>{t('Number of Visits')}</th>
                            <th className={`${thBase}`}>{t('First Visit')}</th>
                            <th className={`${thBase}`}>{t('Last Visit')}</th>
                            <th className={`${thBase} bg-emerald-50`}>
                                {t('Visit 1 → Visit 4')}
                                <div className="text-[10px] text-slate-500 normal-case mt-1 tracking-normal">{t('days')}</div>
                            </th>
                            <th className={`${thBase} bg-amber-50`}>
                                {t('Average Interval')}
                                <div className="text-[10px] text-slate-500 normal-case mt-1 tracking-normal">{t('days between visits')}</div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={11} className="px-5 py-8 text-center text-slate-500 font-semibold">
                                    {t('No health workers match the selected filter.')}
                                </td>
                            </tr>
                        ) : rows.map((row, idx) => (
                            <tr key={row.key} className="hover:bg-sky-50 transition-colors border-b border-black">
                                <td className="px-4 py-3 border-l border-black text-center text-slate-500" dir="ltr">{idx + 1}</td>
                                <td className={`px-4 py-3 border-l border-black font-bold text-slate-800 ${isAr ? 'text-right' : 'text-start'}`}>{row.staff}</td>
                                <td className={`px-4 py-3 border-l border-black text-slate-600 ${isAr ? 'text-right' : 'text-start'}`}>{t(row.workerType)}</td>
                                <td className={`px-4 py-3 border-l border-black text-slate-700 ${isAr ? 'text-right' : 'text-start'}`}>{row.facility}</td>
                                <td className={`px-4 py-3 border-l border-black text-slate-600 ${isAr ? 'text-right' : 'text-start'}`}>{row.locality}</td>
                                <td className={`px-4 py-3 border-l border-black text-slate-600 ${isAr ? 'text-right' : 'text-start'}`}>{row.mentors}</td>
                                <td className="px-4 py-3 border-l border-black text-center bg-sky-50/50" dir="ltr">
                                    <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-full font-extrabold text-xs ${row.visitCount >= 4 ? 'bg-emerald-100 text-emerald-800' : row.visitCount >= 2 ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>
                                        {row.visitCount}
                                    </span>
                                    {row.visitNumbers.length > 0 && (
                                        <div className="text-[10px] text-slate-500 mt-1">#{row.visitNumbers.join(', ')}</div>
                                    )}
                                </td>
                                <td className="px-4 py-3 border-l border-black text-center text-slate-600 whitespace-nowrap" dir="ltr">{fmtDate(row.firstDate)}</td>
                                <td className="px-4 py-3 border-l border-black text-center text-slate-600 whitespace-nowrap" dir="ltr">{fmtDate(row.lastDate)}</td>
                                <td className="px-4 py-3 border-l border-black text-center font-bold bg-emerald-50/50" dir="ltr">
                                    {row.spanV1V4 == null
                                        ? <span className="text-slate-400 font-normal">—</span>
                                        : <span className="text-emerald-800">{row.spanV1V4}</span>}
                                </td>
                                <td className="px-4 py-3 text-center font-bold bg-amber-50/50" dir="ltr">
                                    {row.avgGap == null
                                        ? <span className="text-slate-400 font-normal">—</span>
                                        : <span className="text-amber-800">{row.avgGap}</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-black text-xs text-slate-500">
                {t('Showing')} <b>{rows.length}</b> {t('of')} <b>{allRows.length}</b> {t('health workers')}. {t('A visit is counted once per visit number; workers with fewer than 4 visits show “—” for the Visit 1 → Visit 4 duration.')}
            </div>
        </div>
    );
};

/* ============================================================================
   ADMIN DASHBOARD TAB
   ========================================================================== */

const AdminDashboardTab = ({
    activeService,
    overallKpis,
    visitReportStats,
    motherKpis,
    volumeChartData,
    geographicKpis,
    filteredSubmissions,
    geographicLevelName,
    scopeTitle
}) => {
    const { t, i18n } = useTranslation();
    const language = i18n.language?.startsWith('ar') ? 'ar' : 'en';
    const isAr = language === 'ar';
    const tableRef = useRef(null);

    const volumeChartKeys = [
        { key: 'Completed Visits', title: 'Completed Visits' },
        { key: 'Cases Observed', title: 'Cases Observed' }
    ];

    const isEENC = activeService === 'EENC';

    // Function to copy the table HTML to clipboard for MS Word
    const handleCopyTable = async () => {
        if (!tableRef.current) return;
        
        try {
            const htmlContent = tableRef.current.innerHTML;
            const blobHtml = new Blob([htmlContent], { type: 'text/html' });
            
            const clipboardItem = new ClipboardItem({
                'text/html': blobHtml
            });
            
            await navigator.clipboard.write([clipboardItem]);
            alert(t('Table copied successfully! You can now paste it directly into Microsoft Word.'));
        } catch (err) {
            console.error('Failed to copy the table: ', err);
            alert(t('Failed to copy the table. Please check your browser permissions.'));
        }
    };

    return (
        <div className="animate-fade-in" dir={isAr ? 'rtl' : 'ltr'}>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <KpiCard 
                    title={isEENC ? 'Total Completed EENC Visits' : 'Total Completed Visits'} 
                    value={overallKpis?.totalVisits || 0} 
                    unit={overallKpis?.totalHealthWorkers > 0 ? `(${(overallKpis.totalVisits / overallKpis.totalHealthWorkers).toFixed(1)} ${t('visits per HW')})` : ''} 
                />
                <KpiCard title="Total Health Workers Visited" value={overallKpis?.totalHealthWorkers || 0} />
                <KpiCard 
                    title="Total Cases Observed" 
                    value={overallKpis?.totalCasesObserved || 0} 
                    unit={overallKpis?.totalVisits > 0 ? `(${ (overallKpis.totalCasesObserved / overallKpis.totalVisits).toFixed(1) } ${t('cases per visit')})` : ''} 
                />
            </div>
            
            {/* COMPLIANCE KPIS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <KpiCard 
                    title="Visit Reports" 
                    value={visitReportStats?.totalVisits || 0} 
                    unit={overallKpis?.totalVisits > 0 ? `(${Math.round(((visitReportStats?.totalVisits || 0) / overallKpis.totalVisits) * 100)}% ${t('of Target:')} ${overallKpis.totalVisits})` : `(${t('Target:')} 0)`}
                />
                <KpiCard 
                    title="Mother Forms" 
                    value={motherKpis?.totalMothers || 0} 
                    unit={overallKpis?.totalVisits > 0 ? `(${Math.round(((motherKpis?.totalMothers || 0) / (overallKpis.totalVisits * 3)) * 100)}% ${t('of Target:')} ${overallKpis.totalVisits * 3})` : `(${t('Target:')} 0)`}
                />
            </div>

            <div className="mb-8">
                <VolumeLineChart title="Visits & Cases by Visit Number" chartData={volumeChartData} kpiKeys={volumeChartKeys} />
            </div>
            
            <h3 className={`text-xl font-extrabold text-slate-800 mb-5 mt-10 tracking-wide ${isAr ? 'text-right' : 'text-left'}`}>
                {t('Program Performance by')} {t(geographicLevelName)} {scopeTitle}
            </h3>
            <GeographicVolumeTable 
                title={`Volume & Coverage by ${geographicLevelName}`} 
                data={geographicKpis} 
                locationLabel={geographicLevelName} 
            />

            {/* MENTOR PERFORMANCE TABLE WITH COPY FUNCTION */}
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between mb-5 mt-10 gap-4 ${isAr ? 'text-right' : 'text-left'}`}>
                <h3 className="text-xl font-extrabold text-slate-800 tracking-wide m-0">
                    {t('Mentor Performance & Compliance')} {scopeTitle}
                </h3>
                <button 
                    onClick={handleCopyTable}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold shadow transition-colors text-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                    </svg>
                    {t('Copy as Word Table')}
                </button>
            </div>
            
            <div ref={tableRef} className="bg-white">
                <MentorPerformanceTable 
                    title="Mentorship Activity & Reporting Compliance by Supervisor"
                    submissions={filteredSubmissions}
                    visitReports={visitReportStats?.rawReports || []}
                    activeService={activeService}
                />
            </div>

            {/* MENTORED HEALTH WORKERS: VISIT COUNTS & INTERVALS */}
            <h3 className={`text-xl font-extrabold text-slate-800 mb-5 mt-10 tracking-wide ${isAr ? 'text-right' : 'text-left'}`}>
                {t('Mentored Health Workers - Visits & Intervals')} {scopeTitle}
            </h3>
            <HealthWorkerVisitsTable 
                submissions={filteredSubmissions}
                activeService={activeService}
                title="Health Worker Visit Coverage & Intervals"
            />
        </div>
    );
};

export default AdminDashboardTab;