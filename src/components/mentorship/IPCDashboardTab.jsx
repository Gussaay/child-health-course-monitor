// IPCDashboardTab.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { KpiCard, KpiBarChart, ScoreText, IPC_CORE_COMPONENTS } from './MentorshipDashboardShared';

const IPCDashboardTab = ({ overallKpis, geographicKpis, scopeTitle, geographicLevelName, filteredSubmissions }) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language?.startsWith('ar') ? 'ar' : 'en';
  const isAr = language === 'ar';

  if (!overallKpis || overallKpis.totalVisits === 0) {
    return <div className="text-center p-8 font-bold text-slate-500">{t('No IPC data available.')}</div>;
  }

  // Compute total score (if available)
  const totalScore = overallKpis.totalScore ?? 0;
  const totalMax = overallKpis.totalMax ?? 800;
  const avgOverall = overallKpis.avgOverall;

  // Determine IPC level based on total score
  let level = '';
  let levelColor = '';
  if (totalScore >= 601) { level = t('Advanced'); levelColor = 'text-emerald-700'; }
  else if (totalScore >= 401) { level = t('Intermediate'); levelColor = 'text-blue-700'; }
  else if (totalScore >= 201) { level = t('Basic'); levelColor = 'text-amber-700'; }
  else { level = t('Inadequate'); levelColor = 'text-rose-700'; }

  // Build bar chart data: average per component (as percentage)
  const barData = IPC_CORE_COMPONENTS.map(cc => ({
    stateName: t(cc.label),
    avgScore: overallKpis[`avg${cc.key.toUpperCase()}`] ?? null
  }));

  // Build detailed component scores table
  const componentRows = IPC_CORE_COMPONENTS.map(cc => ({
    key: cc.key,
    label: t(cc.label),
    score: overallKpis.skillStats?.[cc.key]?.score ?? 0,
    max: 100
  }));

  // Classification ranges table
  const classificationRanges = [
    { range: '0–200', level: t('Inadequate'), color: 'bg-rose-100 text-rose-800' },
    { range: '201–400', level: t('Basic'), color: 'bg-amber-100 text-amber-800' },
    { range: '401–600', level: t('Intermediate'), color: 'bg-blue-100 text-blue-800' },
    { range: '601–800', level: t('Advanced'), color: 'bg-emerald-100 text-emerald-800' }
  ];

  return (
    <div className="animate-fade-in">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <KpiCard title={t('Total Assessments')} value={overallKpis.totalVisits} />
        <KpiCard title={t('Total Facilities Assessed')} value={overallKpis.totalFacilities} />
        <KpiCard title={t('Average Overall Score')} scoreValue={avgOverall} />
      </div>

      {/* --- IPC CLASSIFICATION SECTION --- */}
      <div className="bg-white rounded-2xl shadow-md border border-black p-6 mb-10">
        <h3 className="text-xl font-extrabold text-slate-800 mb-4 text-center">{t('IPC Classification Summary')}</h3>
        
        {/* Total Score and Level */}
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

        {/* Component Scores Table */}
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

        {/* Classification Ranges Table */}
        <div>
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

      {/* Bar Chart: Average per Core Component */}
      <div className="mb-10">
        <KpiBarChart
          title={`${t('Average IPC Score per Core Component')} ${scopeTitle}`}
          chartData={barData}
          dataKey="avgScore"
        />
      </div>

      {/* Geographic breakdown if data exists */}
      {geographicKpis && geographicKpis.length > 0 && (
        <div>
          <h3 className="text-xl font-extrabold text-slate-800 mb-5 mt-10 text-left tracking-wide">
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

export default IPCDashboardTab;