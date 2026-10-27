// src/components/AiChart.jsx
//
// The small chart "Ask the data" may add under an answer: { type: bar | line
// | pie, title, labels, values, unit } (functions/aiDataText.js splitChart).
// Loaded only when an answer has one.
import React from 'react';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { CHART_COLORS } from './chartSetup'; // also registers the scales and elements

const KINDS = { bar: Bar, line: Line, pie: Pie };

export default function AiChart({ chart }) {
    const Kind = KINDS[chart?.type];
    if (!Kind || !chart.labels?.length) return null;
    const pie = chart.type === 'pie';
    const unit = chart.unit === '%' ? '%' : '';
    const data = {
        labels: chart.labels,
        datasets: [{
            label: chart.title || '',
            data: chart.values,
            backgroundColor: pie ? chart.labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]) : '#0284c7',
            borderColor: pie ? '#fff' : '#0284c7',
            borderWidth: pie ? 1 : 2,
            tension: 0.3,
        }],
    };
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
            legend: { display: pie, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
            title: { display: !!chart.title, text: chart.title, font: { size: 12 } },
            tooltip: { callbacks: { label: (c) => ` ${c.formattedValue}${unit}` } },
            datalabels: { display: false },
        },
        ...(pie ? {} : {
            scales: {
                x: { ticks: { font: { size: 10 }, autoSkip: false, maxRotation: 60 } },
                y: { beginAtZero: true, ticks: { font: { size: 10 }, callback: (v) => `${v}${unit}` } },
            },
        }),
    };
    return (
        <div className="mt-2 h-56 rounded-lg border border-slate-100 bg-white p-2" dir="ltr">
            <Kind data={data} options={options} />
        </div>
    );
}
