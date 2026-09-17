// IPCDashboardTab.jsx
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { KpiCard, KpiBarChart, ScoreText, IPC_CORE_COMPONENTS } from './MentorshipDashboardShared';

// =====================================================================
// The three IPC forms all save with serviceType 'IPC', so they are split
// per form here. Each tab below gets its own KPIs on its own scale.
// =====================================================================
const IPC_FORM_TABS = [
  { key: 'ipc', labelEn: 'IPC Facility Assessment', labelAr: 'تقييم مكافحة العدوى' },
  { key: 'ams', labelEn: 'Antimicrobial Stewardship', labelAr: 'الإشراف على مضادات الميكروبات' },
  { key: 'handwashing', labelEn: 'Hand Hygiene', labelAr: 'نظافة الأيدي' }
];

const AMS_SECTIONS = [
  { key: 'diagnostics', labelEn: 'Culture & Diagnostics', labelAr: 'الممارسات التشخيصية والمزرعة', max: 30 },
  { key: 'empirical', labelEn: 'Empirical Antibiotic Use', labelAr: 'استخدام المضادات التجريبية', max: 30 },
  { key: 'duration', labelEn: 'Duration & De-escalation', labelAr: 'مدة العلاج والتعديل', max: 30 },
  { key: 'stewardship_barriers', labelEn: 'Stewardship & Barriers', labelAr: 'الإشراف والعقبات', max: 30 },
  { key: 'rational_use', labelEn: 'Rational Use Indicators', labelAr: 'مؤشرات الاستخدام الرشيد', max: 30 },
  { key: 'reporting_surveillance', labelEn: 'Surveillance & Reporting', labelAr: 'الترصد والإبلاغ', max: 30 },
  { key: 'guidelines_eml', labelEn: 'Guidelines & EML', labelAr: 'البروتوكولات وقائمة الأدوية الأساسية', max: 30 }
];

const AMS_MAX_TOTAL = AMS_SECTIONS.reduce((acc, sec) => acc + sec.max, 0);

const HH_INDICATIONS = [
  { key: 'bef_pat', labelEn: 'Before patient contact', labelAr: 'قبل التلامس مع المريض' },
  { key: 'bef_asep', labelEn: 'Before aseptic procedure', labelAr: 'قبل إجراء تنظيف أو مانع للتلوث' },
  { key: 'aft_fluid', labelEn: 'After body fluid exposure', labelAr: 'بعد التعرض لسوائل الجسم' },
  { key: 'aft_pat', labelEn: 'After patient contact', labelAr: 'بعد التلامس مع المريض' },
  { key: 'aft_surr', labelEn: 'After contact with surroundings', labelAr: 'بعد التلامس مع محيط المريض' }
];

// The form flag sits in different places depending on how the submission was
// normalised, so check each known spot before falling back to the score shape.
const resolveIpcFormType = (sub = {}) => {
  const raw = [sub.formType, sub.formCategory, sub.fullData?.formType, sub.fullData?.formCategory]
    .filter(Boolean).join(' ').toLowerCase();

  if (raw.includes('handwash') || raw.includes('hand_hygiene') || raw.includes('hand hygiene')) return 'handwashing';
  if (raw.includes('ams') || raw.includes('stewardship')) return 'ams';

  const scores = sub.scores || {};
  if (scores.opportunities_count !== undefined || scores.handwash_count !== undefined) return 'handwashing';

  const sectionKeys = Object.keys(scores.sections || {});
  if (sectionKeys.some(k => AMS_SECTIONS.some(sec => sec.key === k))) return 'ams';
  if (sectionKeys.some(k => /^cc\d+$/.test(k))) return 'ipc';

  return 'ipc';
};

const filterIpcForm = (submissions = [], formKey) => submissions.filter(
  sub => (sub.service === 'IPC' || sub.serviceType === 'IPC') && resolveIpcFormType(sub) === formKey
);

const countIpcForms = (submissions = []) => {
  const counts = { ipc: 0, ams: 0, handwashing: 0 };
  submissions.forEach(sub => {
    if (sub.service !== 'IPC' && sub.serviceType !== 'IPC') return;
    const key = resolveIpcFormType(sub);
    if (counts[key] !== undefined) counts[key]++;
  });
  return counts;
};

const countVisitsAndFacilities = (subs) => ({
  totalVisits: new Set(subs.map(s => s.id || `${s.facilityId}_${s.date || s.sessionDate}`)).size,
  totalFacilities: new Set(subs.map(s => s.facilityId).filter(Boolean)).size
});

// --- KPIs: IPC facility assessment (8 core components, 100 each) ---
const ipcFacilityKpiHelper = (submissions = []) => {
  if (submissions.length === 0) {
    return { totalVisits: 0, totalFacilities: 0, avgOverall: null, totalScore: 0, totalMax: 800, skillStats: {} };
  }

  const skillStats = {};
  IPC_CORE_COMPONENTS.forEach(cc => { skillStats[cc.key] = { score: 0, max: 0 }; });

  let totalScore = 0;
  let totalMax = 0;

  submissions.forEach(sub => {
    const sectionScores = (sub.scores || {}).sections || {};
    IPC_CORE_COMPONENTS.forEach(cc => {
      const secScore = sectionScores[cc.key] || 0;
      skillStats[cc.key].score += secScore;
      skillStats[cc.key].max += 100;
      totalScore += secScore;
      totalMax += 100;
    });
  });

  const avgPerComponent = {};
  IPC_CORE_COMPONENTS.forEach(cc => {
    const max = skillStats[cc.key].max;
    avgPerComponent[`avg${cc.key.toUpperCase()}`] = max > 0 ? (skillStats[cc.key].score / max) : null;
  });

  return {
    ...countVisitsAndFacilities(submissions),
    // average of a single assessment, so the 0–800 classification still applies
    totalScore: Math.round(totalScore / submissions.length),
    totalMax: 800,
    avgOverall: totalMax > 0 ? (totalScore / totalMax) : null,
    ...avgPerComponent,
    skillStats: Object.fromEntries(Object.entries(skillStats).map(
      ([k, v]) => [k, { score: Math.round(v.score / submissions.length), max: 100 }]
    ))
  };
};

// --- KPIs: antimicrobial stewardship (7 sections, 30 each) ---
const amsKpiHelper = (submissions = []) => {
  if (submissions.length === 0) {
    return { totalVisits: 0, totalFacilities: 0, avgOverall: null, totalScore: 0, totalMax: AMS_MAX_TOTAL, bySection: [] };
  }

  const sectionStats = {};
  AMS_SECTIONS.forEach(sec => { sectionStats[sec.key] = { score: 0, max: 0 }; });

  let totalScore = 0;
  let totalMax = 0;

  submissions.forEach(sub => {
    const sectionScores = (sub.scores || {}).sections || {};
    AMS_SECTIONS.forEach(sec => {
      const secScore = sectionScores[sec.key] || 0;
      sectionStats[sec.key].score += secScore;
      sectionStats[sec.key].max += sec.max;
      totalScore += secScore;
      totalMax += sec.max;
    });
  });

  return {
    ...countVisitsAndFacilities(submissions),
    avgOverall: totalMax > 0 ? (totalScore / totalMax) : null,
    totalScore: Math.round(totalScore / submissions.length),
    totalMax: AMS_MAX_TOTAL,
    bySection: AMS_SECTIONS.map(sec => ({
      ...sec,
      score: Math.round(sectionStats[sec.key].score / submissions.length),
      avg: sectionStats[sec.key].max > 0 ? (sectionStats[sec.key].score / sectionStats[sec.key].max) : null
    }))
  };
};

// Reads the flat opportunityRows the hand hygiene form writes, and rebuilds them
// from assessmentData for sessions saved by earlier versions of that form.
const extractOpportunityRows = (sub = {}) => {
  const direct = sub.opportunityRows || sub.fullData?.opportunityRows;
  if (Array.isArray(direct) && direct.length > 0) return direct;

  const data = sub.assessmentData || sub.fullData?.assessmentData || sub.fullData;
  if (!Array.isArray(data)) return [];

  return data.flatMap(opp => {
    if (!opp) return [];
    const indications = Array.isArray(opp.indications) ? opp.indications : [];
    const actions = (opp.actions && typeof opp.actions === 'object')
      ? opp.actions
      : (opp.action && indications.length > 0 ? { [indications[0]]: opp.action } : {});
    return indications.filter(ind => !!actions[ind]).map(ind => ({
      indication: ind,
      action: actions[ind],
      gloveUse: !!(opp.gloveUses ? opp.gloveUses[ind] : opp.gloveUse),
      workerType: opp.workerType || null
    }));
  });
};

// --- KPIs: hand hygiene observation (opportunities, not scores) ---
const handwashingKpiHelper = (submissions = []) => {
  if (submissions.length === 0) {
    return {
      totalVisits: 0, totalFacilities: 0, totalOpportunities: 0,
      wash: 0, rub: 0, missed: 0, glovesWhenMissed: 0,
      compliance: null, avgOverall: null, byIndication: [], byWorkerType: []
    };
  }

  let wash = 0, rub = 0, missed = 0, glovesWhenMissed = 0;
  const byIndication = {};
  const byWorkerType = new Map();
  HH_INDICATIONS.forEach(ind => { byIndication[ind.key] = { opportunities: 0, performed: 0 }; });

  submissions.forEach(sub => {
    const rows = extractOpportunityRows(sub);

    // fall back to the stored counters when the detailed rows are unavailable
    if (rows.length === 0) {
      const scores = sub.scores || {};
      const opp = scores.opportunities_count || 0;
      const hw = scores.handwash_count || 0;
      const hr = scores.handrub_count || 0;
      wash += hw;
      rub += hr;
      missed += Math.max(0, opp - hw - hr);
      return;
    }

    rows.forEach(row => {
      if (row.action === 'wash') wash++;
      else if (row.action === 'rub') rub++;
      else missed++;

      if (row.action === 'missed' && row.gloveUse) glovesWhenMissed++;

      if (byIndication[row.indication]) {
        byIndication[row.indication].opportunities++;
        if (row.action === 'wash' || row.action === 'rub') byIndication[row.indication].performed++;
      }

      const wt = row.workerType || sub.workerType || 'Unknown';
      const entry = byWorkerType.get(wt) || { workerType: wt, opportunities: 0, wash: 0, rub: 0, missed: 0 };
      entry.opportunities++;
      if (row.action === 'wash') entry.wash++;
      else if (row.action === 'rub') entry.rub++;
      else entry.missed++;
      byWorkerType.set(wt, entry);
    });
  });

  const totalOpportunities = wash + rub + missed;
  const compliance = totalOpportunities > 0 ? ((wash + rub) / totalOpportunities) : null;

  return {
    ...countVisitsAndFacilities(submissions),
    totalOpportunities, wash, rub, missed, glovesWhenMissed,
    compliance,
    avgOverall: compliance,
    byIndication: HH_INDICATIONS.map(ind => ({
      ...ind,
      opportunities: byIndication[ind.key].opportunities,
      performed: byIndication[ind.key].performed,
      compliance: byIndication[ind.key].opportunities > 0
        ? (byIndication[ind.key].performed / byIndication[ind.key].opportunities)
        : null
    })),
    byWorkerType: Array.from(byWorkerType.values())
      .map(row => ({ ...row, compliance: row.opportunities > 0 ? ((row.wash + row.rub) / row.opportunities) : null }))
      .sort((a, b) => b.opportunities - a.opportunities)
  };
};

const kpiHelperFor = (formKey) => {
  if (formKey === 'ams') return amsKpiHelper;
  if (formKey === 'handwashing') return handwashingKpiHelper;
  return ipcFacilityKpiHelper;
};

// --- View 1: IPC facility assessment (the original dashboard) ---
const IPCFacilityView = ({ kpis, geographicKpis, scopeTitle, geographicLevelName, t, isAr }) => {
  const totalScore = kpis.totalScore ?? 0;
  const totalMax = kpis.totalMax ?? 800;
  const avgOverall = kpis.avgOverall;

  let level = '';
  let levelColor = '';
  if (totalScore >= 601) { level = t('Advanced'); levelColor = 'text-emerald-700'; }
  else if (totalScore >= 401) { level = t('Intermediate'); levelColor = 'text-blue-700'; }
  else if (totalScore >= 201) { level = t('Basic'); levelColor = 'text-amber-700'; }
  else { level = t('Inadequate'); levelColor = 'text-rose-700'; }

  const barData = IPC_CORE_COMPONENTS.map(cc => ({
    stateName: t(cc.label),
    avgScore: kpis[`avg${cc.key.toUpperCase()}`] ?? null
  }));

  const componentRows = IPC_CORE_COMPONENTS.map(cc => ({
    key: cc.key,
    label: t(cc.label),
    score: kpis.skillStats?.[cc.key]?.score ?? 0,
    max: 100
  }));

  const classificationRanges = [
    { range: '0–200', level: t('Inadequate'), color: 'bg-rose-100 text-rose-800' },
    { range: '201–400', level: t('Basic'), color: 'bg-amber-100 text-amber-800' },
    { range: '401–600', level: t('Intermediate'), color: 'bg-blue-100 text-blue-800' },
    { range: '601–800', level: t('Advanced'), color: 'bg-emerald-100 text-emerald-800' }
  ];

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <KpiCard title={t('Total Assessments')} value={kpis.totalVisits} />
        <KpiCard title={t('Total Facilities Assessed')} value={kpis.totalFacilities} />
        <KpiCard title={t('Average Overall Score')} scoreValue={avgOverall} />
      </div>

      <div className="bg-white rounded-2xl shadow-md border border-black p-4 sm:p-6 mb-10">
        <h3 className="text-xl font-extrabold text-slate-800 mb-4 text-center">{t('IPC Classification Summary')}</h3>

        <div className="flex flex-col md:flex-row justify-center items-center gap-6 mb-8">
          <div className="bg-slate-50 border border-black rounded-xl px-8 py-4 text-center">
            <div className="text-sm font-bold text-slate-500 uppercase tracking-wide">{t('Total Score')}</div>
            <div className="text-3xl font-black text-slate-800" dir="ltr">{totalScore} / {totalMax}</div>
          </div>
          <div className={`bg-white border border-black rounded-xl px-8 py-4 text-center shadow-md ${levelColor}`}>
            <div className="text-sm font-bold text-slate-500 uppercase tracking-wide">{t('IPC Level')}</div>
            <div className={`text-3xl font-black ${levelColor}`}>{level}</div>
          </div>
        </div>

        <div className="overflow-x-auto mb-8">
          <h4 className="text-lg font-bold text-slate-700 mb-3 text-center">{t('Core Component Scores')}</h4>
          <table className="w-full border-collapse border border-black text-sm" dir={isAr ? 'rtl' : 'ltr'}>
            <thead className="bg-slate-200">
              <tr>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'العنصر الأساسي' : 'Core Component'}</th>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'الدرجة' : 'Score'}</th>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'الدرجة القصوى' : 'Max Score'}</th>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'النسبة المئوية' : 'Percentage'}</th>
              </tr>
            </thead>
            <tbody>
              {componentRows.map((row, idx) => {
                const pct = row.max > 0 ? (row.score / row.max) : 0;
                return (
                  <tr key={idx} className="hover:bg-sky-50">
                    <td className="border border-black p-2">{row.label}</td>
                    <td className="border border-black p-2 text-center font-bold" dir="ltr">{row.score}</td>
                    <td className="border border-black p-2 text-center" dir="ltr">{row.max}</td>
                    <td className="border border-black p-2 text-center"><ScoreText value={pct} /></td>
                  </tr>
                );
              })}
              <tr className="bg-slate-100 font-bold">
                <td className="border border-black p-2 text-center">{isAr ? 'المجموع النهائي' : 'Final Total'}</td>
                <td className="border border-black p-2 text-center" dir="ltr">{totalScore}</td>
                <td className="border border-black p-2 text-center" dir="ltr">{totalMax}</td>
                <td className="border border-black p-2 text-center"><ScoreText value={avgOverall} /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto">
          <h4 className="text-lg font-bold text-slate-700 mb-3 text-center">{t('IPC Level Classification')}</h4>
          <table className="w-full border-collapse border border-black text-sm" dir={isAr ? 'rtl' : 'ltr'}>
            <thead className="bg-slate-200">
              <tr>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'مجموع الدرجات' : 'Total Score Range'}</th>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'مستوى IPC' : 'IPC Level'}</th>
              </tr>
            </thead>
            <tbody>
              {classificationRanges.map((item, idx) => (
                <tr key={idx} className="hover:bg-sky-50">
                  <td className="border border-black p-2 text-center font-medium" dir="ltr">{item.range}</td>
                  <td className={`border border-black p-2 text-center font-bold ${item.color}`}>{item.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-10">
        <KpiBarChart
          title={`${t('Average IPC Score per Core Component')} ${scopeTitle}`}
          chartData={barData}
          dataKey="avgScore"
        />
      </div>

      {geographicKpis && geographicKpis.length > 0 && (
        <div>
          <h3 className={`text-xl font-extrabold text-slate-800 mb-5 mt-10 tracking-wide ${isAr ? 'text-right' : 'text-left'}`}>
            {t('IPC Adherence by')} {t(geographicLevelName)} {scopeTitle}
          </h3>
          <KpiBarChart
            title={`${t('Average IPC Score by')} ${t(geographicLevelName)}`}
            chartData={geographicKpis.map(g => ({ stateName: g.stateName, avgScore: g.avgOverall }))}
            dataKey="avgScore"
          />
        </div>
      )}
    </div>
  );
};

// --- View 2: antimicrobial stewardship ---
const AMSView = ({ kpis, geographicKpis, scopeTitle, geographicLevelName, t, isAr }) => {
  const totalScore = kpis.totalScore ?? 0;
  const avgOverall = kpis.avgOverall;
  const pct = avgOverall !== null ? Math.round(avgOverall * 100) : 0;

  let level = '';
  let levelColor = '';
  if (pct >= 75) { level = isAr ? 'جيد' : 'Good'; levelColor = 'text-emerald-700'; }
  else if (pct >= 50) { level = isAr ? 'متوسط' : 'Moderate'; levelColor = 'text-amber-700'; }
  else { level = isAr ? 'ضعيف' : 'Weak'; levelColor = 'text-rose-700'; }

  const bySection = kpis.bySection || [];
  const barData = bySection.map(sec => ({ stateName: isAr ? sec.labelAr : sec.labelEn, avgScore: sec.avg }));

  const classificationRanges = [
    { range: '0–49%', level: isAr ? 'ضعيف' : 'Weak', color: 'bg-rose-100 text-rose-800' },
    { range: '50–74%', level: isAr ? 'متوسط' : 'Moderate', color: 'bg-amber-100 text-amber-800' },
    { range: '75–100%', level: isAr ? 'جيد' : 'Good', color: 'bg-emerald-100 text-emerald-800' }
  ];

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <KpiCard title={t('Total Assessments')} value={kpis.totalVisits} />
        <KpiCard title={t('Total Facilities Assessed')} value={kpis.totalFacilities} />
        <KpiCard title={t('Average Overall Score')} scoreValue={avgOverall} />
      </div>

      <div className="bg-white rounded-2xl shadow-md border border-black p-4 sm:p-6 mb-10">
        <h3 className="text-xl font-extrabold text-slate-800 mb-4 text-center">
          {isAr ? 'ملخص الإشراف على مضادات الميكروبات' : 'Antimicrobial Stewardship Summary'}
        </h3>

        <div className="flex flex-col md:flex-row justify-center items-center gap-6 mb-8">
          <div className="bg-slate-50 border border-black rounded-xl px-8 py-4 text-center">
            <div className="text-sm font-bold text-slate-500 uppercase tracking-wide">{isAr ? 'متوسط الدرجة' : 'Average Score'}</div>
            <div className="text-3xl font-black text-slate-800" dir="ltr">{totalScore} / {AMS_MAX_TOTAL}</div>
          </div>
          <div className={`bg-white border border-black rounded-xl px-8 py-4 text-center shadow-md ${levelColor}`}>
            <div className="text-sm font-bold text-slate-500 uppercase tracking-wide">{isAr ? 'المستوى' : 'Level'}</div>
            <div className={`text-3xl font-black ${levelColor}`}>{level}</div>
          </div>
        </div>

        <div className="overflow-x-auto mb-8">
          <h4 className="text-lg font-bold text-slate-700 mb-3 text-center">{isAr ? 'درجات المحاور' : 'Section Scores'}</h4>
          <table className="w-full border-collapse border border-black text-sm" dir={isAr ? 'rtl' : 'ltr'}>
            <thead className="bg-slate-200">
              <tr>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'المحور' : 'Section'}</th>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'متوسط الدرجة' : 'Avg Score'}</th>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'الدرجة القصوى' : 'Max Score'}</th>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'النسبة المئوية' : 'Percentage'}</th>
              </tr>
            </thead>
            <tbody>
              {bySection.map(sec => (
                <tr key={sec.key} className="hover:bg-sky-50">
                  <td className="border border-black p-2">{isAr ? sec.labelAr : sec.labelEn}</td>
                  <td className="border border-black p-2 text-center font-bold" dir="ltr">{sec.score}</td>
                  <td className="border border-black p-2 text-center" dir="ltr">{sec.max}</td>
                  <td className="border border-black p-2 text-center"><ScoreText value={sec.avg} /></td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold">
                <td className="border border-black p-2 text-center">{isAr ? 'المجموع' : 'Total'}</td>
                <td className="border border-black p-2 text-center" dir="ltr">{totalScore}</td>
                <td className="border border-black p-2 text-center" dir="ltr">{AMS_MAX_TOTAL}</td>
                <td className="border border-black p-2 text-center"><ScoreText value={avgOverall} /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto">
          <h4 className="text-lg font-bold text-slate-700 mb-3 text-center">{isAr ? 'تصنيف المستوى' : 'Level Classification'}</h4>
          <table className="w-full border-collapse border border-black text-sm" dir={isAr ? 'rtl' : 'ltr'}>
            <thead className="bg-slate-200">
              <tr>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'النسبة' : 'Score Range'}</th>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'المستوى' : 'Level'}</th>
              </tr>
            </thead>
            <tbody>
              {classificationRanges.map((item, idx) => (
                <tr key={idx} className="hover:bg-sky-50">
                  <td className="border border-black p-2 text-center font-medium" dir="ltr">{item.range}</td>
                  <td className={`border border-black p-2 text-center font-bold ${item.color}`}>{item.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-10">
        <KpiBarChart
          title={`${isAr ? 'متوسط درجة كل محور' : 'Average score per section'} ${scopeTitle}`}
          chartData={barData}
          dataKey="avgScore"
        />
      </div>

      {geographicKpis && geographicKpis.length > 0 && (
        <div>
          <h3 className={`text-xl font-extrabold text-slate-800 mb-5 mt-10 tracking-wide ${isAr ? 'text-right' : 'text-left'}`}>
            {isAr ? 'الإشراف على مضادات الميكروبات حسب' : 'Antimicrobial stewardship by'} {t(geographicLevelName)} {scopeTitle}
          </h3>
          <KpiBarChart
            title={`${isAr ? 'متوسط الدرجة حسب' : 'Average score by'} ${t(geographicLevelName)}`}
            chartData={geographicKpis.map(g => ({ stateName: g.stateName, avgScore: g.avgOverall }))}
            dataKey="avgScore"
          />
        </div>
      )}
    </div>
  );
};

// --- View 3: hand hygiene compliance ---
const HandHygieneView = ({ kpis, geographicKpis, scopeTitle, geographicLevelName, t, isAr }) => {
  const { totalVisits, totalFacilities, totalOpportunities, wash, rub, missed, glovesWhenMissed, compliance } = kpis;
  const pct = compliance !== null ? Math.round(compliance * 100) : 0;

  let level = '';
  let levelColor = '';
  if (pct >= 80) { level = isAr ? 'التزام جيد' : 'Good'; levelColor = 'text-emerald-700'; }
  else if (pct >= 50) { level = isAr ? 'التزام متوسط' : 'Moderate'; levelColor = 'text-amber-700'; }
  else { level = isAr ? 'التزام ضعيف' : 'Poor'; levelColor = 'text-rose-700'; }

  const byIndication = kpis.byIndication || [];
  const byWorkerType = kpis.byWorkerType || [];

  const indicationBarData = byIndication
    .filter(row => row.opportunities > 0)
    .map(row => ({ stateName: isAr ? row.labelAr : row.labelEn, avgScore: row.compliance }));

  const workerBarData = byWorkerType.map(row => ({
    stateName: row.workerType === 'Unknown' ? (isAr ? 'غير محدد' : 'Unknown') : row.workerType,
    avgScore: row.compliance
  }));

  const share = (count) => totalOpportunities > 0 ? Math.round((count / totalOpportunities) * 100) : 0;

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-6">
        <KpiCard title={isAr ? 'عدد الجلسات' : 'Observation Sessions'} value={totalVisits} />
        <KpiCard title={t('Total Facilities Assessed')} value={totalFacilities} />
        <KpiCard title={isAr ? 'إجمالي الفرص' : 'Total Opportunities'} value={totalOpportunities} />
        <KpiCard title={isAr ? 'نسبة الامتثال' : 'Compliance Rate'} scoreValue={compliance} />
      </div>

      <div className="bg-white rounded-2xl shadow-md border border-black p-4 sm:p-6 mb-10">
        <h3 className="text-xl font-extrabold text-slate-800 mb-4 text-center">
          {isAr ? 'ملخص الالتزام بنظافة الأيدي' : 'Hand Hygiene Compliance Summary'}
        </h3>

        <div className="flex flex-col md:flex-row justify-center items-center gap-6 mb-8">
          <div className="bg-slate-50 border border-black rounded-xl px-8 py-4 text-center">
            <div className="text-sm font-bold text-slate-500 uppercase tracking-wide">{isAr ? 'إجراءات مُنفذة / فرص' : 'Actions / Opportunities'}</div>
            <div className="text-3xl font-black text-slate-800" dir="ltr">{wash + rub} / {totalOpportunities}</div>
          </div>
          <div className={`bg-white border border-black rounded-xl px-8 py-4 text-center shadow-md ${levelColor}`}>
            <div className="text-sm font-bold text-slate-500 uppercase tracking-wide">{isAr ? 'المستوى' : 'Level'}</div>
            <div className={`text-3xl font-black ${levelColor}`}>{level}</div>
          </div>
        </div>

        <div className="overflow-x-auto mb-8">
          <h4 className="text-lg font-bold text-slate-700 mb-3 text-center">{isAr ? 'توزيع الإجراءات' : 'Action Breakdown'}</h4>
          <table className="w-full border-collapse border border-black text-sm" dir={isAr ? 'rtl' : 'ltr'}>
            <thead className="bg-slate-200">
              <tr>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'الإجراء' : 'Action'}</th>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'العدد' : 'Count'}</th>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'النسبة من الفرص' : 'Share of Opportunities'}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-sky-50">
                <td className="border border-black p-2">{isAr ? 'غسل بالصابون' : 'Handwash with soap'}</td>
                <td className="border border-black p-2 text-center font-bold" dir="ltr">{wash}</td>
                <td className="border border-black p-2 text-center" dir="ltr">{share(wash)}%</td>
              </tr>
              <tr className="hover:bg-sky-50">
                <td className="border border-black p-2">{isAr ? 'فرك بالكحول' : 'Alcohol handrub'}</td>
                <td className="border border-black p-2 text-center font-bold" dir="ltr">{rub}</td>
                <td className="border border-black p-2 text-center" dir="ltr">{share(rub)}%</td>
              </tr>
              <tr className="hover:bg-sky-50">
                <td className="border border-black p-2">{isAr ? 'عدم غسل أو تطهير' : 'Missed'}</td>
                <td className="border border-black p-2 text-center font-bold text-rose-700" dir="ltr">{missed}</td>
                <td className="border border-black p-2 text-center" dir="ltr">{share(missed)}%</td>
              </tr>
              <tr className="bg-slate-100 font-bold">
                <td className="border border-black p-2">{isAr ? 'تفويت أثناء ارتداء القفازات' : 'Missed while wearing gloves'}</td>
                <td className="border border-black p-2 text-center" dir="ltr">{glovesWhenMissed}</td>
                <td className="border border-black p-2 text-center" dir="ltr">{share(glovesWhenMissed)}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto mb-8">
          <h4 className="text-lg font-bold text-slate-700 mb-3 text-center">{isAr ? 'الامتثال حسب الداعي' : 'Compliance by Indication'}</h4>
          <table className="w-full border-collapse border border-black text-sm" dir={isAr ? 'rtl' : 'ltr'}>
            <thead className="bg-slate-200">
              <tr>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'الداعي' : 'Indication'}</th>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'الفرص' : 'Opportunities'}</th>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'إجراءات مُنفذة' : 'Actions Performed'}</th>
                <th className="border border-black p-2 text-center font-bold">{isAr ? 'الامتثال' : 'Compliance'}</th>
              </tr>
            </thead>
            <tbody>
              {byIndication.map(row => (
                <tr key={row.key} className="hover:bg-sky-50">
                  <td className="border border-black p-2">{isAr ? row.labelAr : row.labelEn}</td>
                  <td className="border border-black p-2 text-center" dir="ltr">{row.opportunities}</td>
                  <td className="border border-black p-2 text-center font-bold" dir="ltr">{row.performed}</td>
                  <td className="border border-black p-2 text-center"><ScoreText value={row.compliance} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {byWorkerType.length > 0 && (
          <div className="overflow-x-auto">
            <h4 className="text-lg font-bold text-slate-700 mb-3 text-center">{isAr ? 'الامتثال حسب الفئة المهنية' : 'Compliance by Cadre'}</h4>
            <table className="w-full border-collapse border border-black text-sm" dir={isAr ? 'rtl' : 'ltr'}>
              <thead className="bg-slate-200">
                <tr>
                  <th className="border border-black p-2 text-center font-bold">{isAr ? 'الفئة المهنية' : 'Cadre'}</th>
                  <th className="border border-black p-2 text-center font-bold">{isAr ? 'الفرص' : 'Opportunities'}</th>
                  <th className="border border-black p-2 text-center font-bold">{isAr ? 'غسل' : 'Wash'}</th>
                  <th className="border border-black p-2 text-center font-bold">{isAr ? 'فرك' : 'Rub'}</th>
                  <th className="border border-black p-2 text-center font-bold">{isAr ? 'تفويت' : 'Missed'}</th>
                  <th className="border border-black p-2 text-center font-bold">{isAr ? 'الامتثال' : 'Compliance'}</th>
                </tr>
              </thead>
              <tbody>
                {byWorkerType.map(row => (
                  <tr key={row.workerType} className="hover:bg-sky-50">
                    <td className="border border-black p-2">{row.workerType === 'Unknown' ? (isAr ? 'غير محدد' : 'Unknown') : row.workerType}</td>
                    <td className="border border-black p-2 text-center" dir="ltr">{row.opportunities}</td>
                    <td className="border border-black p-2 text-center" dir="ltr">{row.wash}</td>
                    <td className="border border-black p-2 text-center" dir="ltr">{row.rub}</td>
                    <td className="border border-black p-2 text-center text-rose-700 font-bold" dir="ltr">{row.missed}</td>
                    <td className="border border-black p-2 text-center"><ScoreText value={row.compliance} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {indicationBarData.length > 0 && (
        <div className="mb-10">
          <KpiBarChart
            title={`${isAr ? 'الامتثال حسب الداعي' : 'Compliance per indication'} ${scopeTitle}`}
            chartData={indicationBarData}
            dataKey="avgScore"
          />
        </div>
      )}

      {workerBarData.length > 0 && (
        <div className="mb-10">
          <KpiBarChart
            title={`${isAr ? 'الامتثال حسب الفئة المهنية' : 'Compliance per cadre'} ${scopeTitle}`}
            chartData={workerBarData}
            dataKey="avgScore"
          />
        </div>
      )}

      {geographicKpis && geographicKpis.length > 0 && (
        <div>
          <h3 className={`text-xl font-extrabold text-slate-800 mb-5 mt-10 tracking-wide ${isAr ? 'text-right' : 'text-left'}`}>
            {isAr ? 'الامتثال بنظافة الأيدي حسب' : 'Hand hygiene compliance by'} {t(geographicLevelName)} {scopeTitle}
          </h3>
          <KpiBarChart
            title={`${isAr ? 'نسبة الامتثال حسب' : 'Compliance by'} ${t(geographicLevelName)}`}
            chartData={geographicKpis.map(g => ({ stateName: g.stateName, avgScore: g.compliance }))}
            dataKey="avgScore"
          />
        </div>
      )}
    </div>
  );
};

const IPCDashboardTab = ({
  overallKpis,
  geographicKpis,
  scopeTitle,
  geographicLevelName,
  filteredSubmissions = [],
  STATE_LOCALITIES = {},
  activeState = ''
}) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language?.startsWith('ar') ? 'ar' : 'en';
  const isAr = language === 'ar';

  const [activeForm, setActiveForm] = useState('ipc');

  const formCounts = useMemo(() => countIpcForms(filteredSubmissions), [filteredSubmissions]);

  const formSubmissions = useMemo(
    () => filterIpcForm(filteredSubmissions, activeForm),
    [filteredSubmissions, activeForm]
  );

  const formKpis = useMemo(() => kpiHelperFor(activeForm)(formSubmissions), [formSubmissions, activeForm]);

  // Geographic breakdown for the active form only
  const formGeographicKpis = useMemo(() => {
    const helper = kpiHelperFor(activeForm);
    const isStateLevel = !activeState;
    const byLocation = formSubmissions.reduce((acc, sub) => {
      const locKey = isStateLevel ? (sub.state || 'UNKNOWN') : (sub.locality || 'UNKNOWN');
      if (!acc[locKey]) acc[locKey] = [];
      acc[locKey].push(sub);
      return acc;
    }, {});
    return Object.keys(byLocation).map(locKey => {
      let locName = locKey;
      if (isStateLevel) locName = STATE_LOCALITIES?.[locKey]?.[language] || locKey;
      else {
        const locObj = STATE_LOCALITIES?.[activeState]?.localities?.find(l => l.en === locKey || l.ar === locKey);
        if (locObj) locName = locObj[language] || locObj.en;
      }
      return { stateKey: locKey, stateName: locName, ...helper(byLocation[locKey]) };
    }).sort((a, b) => a.stateName.localeCompare(b.stateName, language));
  }, [formSubmissions, activeForm, activeState, STATE_LOCALITIES, language]);

  const hasAnyData = (formCounts.ipc + formCounts.ams + formCounts.handwashing) > 0;
  if (!hasAnyData) {
    return <div className="text-center p-8 font-bold text-slate-500">{t('No IPC data available.')}</div>;
  }

  const hasFormData = activeForm === 'handwashing'
    ? formKpis.totalOpportunities > 0
    : formKpis.totalVisits > 0;

  const emptyMessage = activeForm === 'ams'
    ? (isAr ? 'لا توجد بيانات للإشراف على مضادات الميكروبات.' : 'No antimicrobial stewardship data available.')
    : activeForm === 'handwashing'
      ? (isAr ? 'لا توجد بيانات لنظافة الأيدي.' : 'No hand hygiene data available.')
      : t('No IPC data available.');

  const viewProps = {
    kpis: formKpis,
    geographicKpis: formGeographicKpis,
    scopeTitle,
    geographicLevelName,
    t,
    isAr
  };

  return (
    <div className="animate-fade-in">
      {/* Each IPC form gets its own tab and its own KPIs */}
      <div className="flex flex-wrap gap-2 mb-6 bg-slate-100 p-1.5 rounded-xl border border-slate-300 w-fit">
        {IPC_FORM_TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveForm(tab.key)}
            className={`py-2 px-4 sm:px-5 font-semibold text-sm rounded-lg transition-all flex items-center gap-2 ${activeForm === tab.key ? 'bg-sky-600 shadow-md text-white border border-transparent' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200 border border-transparent'}`}
          >
            {isAr ? tab.labelAr : t(tab.labelEn)}
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${activeForm === tab.key ? 'bg-white/20 text-white' : 'bg-slate-300 text-slate-700'}`}
              dir="ltr"
            >
              {formCounts[tab.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {!hasFormData ? (
        <div className="text-center p-8 font-bold text-slate-500">{emptyMessage}</div>
      ) : activeForm === 'ams' ? (
        <AMSView {...viewProps} />
      ) : activeForm === 'handwashing' ? (
        <HandHygieneView {...viewProps} />
      ) : (
        <IPCFacilityView {...viewProps} />
      )}
    </div>
  );
};

export default IPCDashboardTab;
