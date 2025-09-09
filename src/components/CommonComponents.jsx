import React from 'react';

// --- Reusable UI Components for a consistent and improved design ---
export const Card = ({ children, className = '' }) => <section className={`bg-white rounded-lg shadow-md p-4 md:p-6 ${className}`}>{children}</section>;
export const PageHeader = ({ title, subtitle, actions }) => (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
            {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
);
export const Button = ({ onClick, children, variant = 'primary', disabled = false, className = '' }) => {
    const baseClasses = "px-4 py-2 rounded-md font-semibold text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center gap-2 justify-center";
    const variantClasses = {
        primary: 'bg-sky-600 text-white hover:bg-sky-700 focus:ring-sky-500',
        secondary: 'bg-slate-200 text-slate-800 hover:bg-slate-300 focus:ring-slate-400',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        ghost: 'bg-transparent text-slate-700 hover:bg-sky-100 hover:text-sky-700 focus:ring-sky-500 border border-slate-300',
    };
    const disabledClasses = "disabled:opacity-50 disabled:cursor-not-allowed";
    return <button onClick={onClick} disabled={disabled} className={`${baseClasses} ${variantClasses[variant]} ${disabledClasses} ${className}`}>{children}</button>;
};
export const FormGroup = ({ label, children, hint }) => (<div className="flex flex-col gap-1"><label className="font-semibold text-gray-700 text-sm">{label}</label>{children}{hint && <p className="text-xs text-gray-500">{hint}</p>}</div>);
export const Input = (props) => <input {...props} className={`border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-sky-500 focus:border-sky-500 ${props.className || ''}`} />;
export const Select = (props) => <select {...props} className={`border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-sky-500 focus:border-sky-500 ${props.className || ''}`}>{props.children}</select>;
export const Textarea = (props) => <textarea {...props} className={`border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-sky-500 focus:border-sky-500 ${props.className || ''}`} />;
export const Table = ({ headers, children }) => (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm border-collapse">
            <thead className="bg-gray-100"><tr className="text-left text-gray-700">{headers.map((h, i) => <th key={i} className="py-3 px-4 font-semibold tracking-wider border border-gray-200">{h}</th>)}</tr></thead>
            <tbody className="bg-white">{children}</tbody>
        </table>
    </div>
);
export const EmptyState = ({ message, colSpan = 100 }) => (<tr><td colSpan={colSpan} className="py-12 text-center text-gray-500 border border-gray-200">{message}</td></tr>);
export const Spinner = () => <div className="flex justify-center items-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div></div>;
export const PdfIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>

// New CourseIcon component
export const CourseIcon = ({ course }) => {
    const p = { width: 34, height: 34, viewBox: '0 0 48 48' };
    switch (course) {
        case 'IMNCI': return (<svg {...p}><circle cx="24" cy="24" r="22" fill="#e0f2fe" /><path d="M12 34c6-10 18-10 24 0" stroke="#0ea5e9" strokeWidth="3" fill="none" /><circle cx="24" cy="18" r="6" fill="#0ea5e9" /></svg>);
        case 'ETAT': return (<svg {...p}><rect x="3" y="8" width="42" height="30" rx="4" fill="#fff7ed" stroke="#f97316" strokeWidth="3" /><path d="M8 24h10l2-6 4 12 3-8h11" stroke="#f97316" strokeWidth="3" fill="none" /></svg>);
        case 'EENC': return (<svg {...p}><circle cx="16" cy="22" r="7" fill="#dcfce7" /><circle cx="30" cy="18" r="5" fill="#a7f3d0" /><path d="M8 34c8-6 24-6 32 0" stroke="#10b981" strokeWidth="3" fill="none" /></svg>);
        default: return null;
    }
}

export const Footer = () => (
    <footer className="bg-slate-800 text-slate-400 text-center p-4 mt-8">
        <p>App developed by Dr Qusay Mohamed - <a href="mailto:Gussaay@gmail.com" className="text-sky-400 hover:underline">Gussaay@gmail.com</a></p>
    </footer>
);