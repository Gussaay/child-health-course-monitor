import React, { useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// =============================================================================
// Card & Page Layout Components
// =============================================================================

export const Card = ({ children, className = '' }) => <section className={`bg-white rounded-lg shadow-md ${className}`}>{children}</section>;
export const CardHeader = ({ children, className = '' }) => <div className={`p-4 md:p-6 border-b border-gray-200 ${className}`}><h3 className="text-lg font-semibold text-gray-800">{children}</h3></div>;
export const CardBody = ({ children, className = '' }) => <div className={`p-4 md:p-6 ${className}`}>{children}</div>;
export const CardFooter = ({ children, className = '' }) => <div className={`p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end gap-2 ${className}`}>{children}</div>;

export const PageHeader = ({ title, subtitle, actions }) => (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
            {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
);

export const Footer = () => (
    <footer className="bg-slate-800 text-slate-400 text-center p-4 mt-8">
        <p>App developed by Dr Qusay Mohamed - <a href="mailto:Gussaay@gmail.com" className="text-sky-400 hover:underline">Gussaay@gmail.com</a></p>
    </footer>
);


// =============================================================================
// Interactive Elements
// =============================================================================

export const Button = ({ onClick, children, variant = 'primary', disabled = false, className = '', isActive = false }) => {
    const baseClasses = "px-4 py-2 rounded-md font-semibold text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center gap-2 justify-center";
    const variantClasses = {
        primary: 'bg-sky-600 text-white hover:bg-sky-700 focus:ring-sky-500',
        secondary: 'bg-slate-200 text-slate-800 hover:bg-slate-300 focus:ring-slate-400',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        ghost: 'bg-transparent text-slate-700 hover:bg-sky-100 hover:text-sky-700 focus:ring-sky-500 border border-slate-300',
        tab: 'text-gray-600 hover:bg-slate-100' // Default tab style
    };
    const activeTabClasses = isActive && variant === 'tab' ? 'bg-sky-600 text-white hover:bg-sky-700' : '';
    const disabledClasses = "disabled:opacity-50 disabled:cursor-not-allowed";

    return <button onClick={onClick} disabled={disabled} className={`${baseClasses} ${variantClasses[variant]} ${disabledClasses} ${className} ${activeTabClasses}`}>{children}</button>;
};

export function Tabs({ tabs, activeTab, onTabChange }) {
    return (
        <div className="flex gap-2 border-b border-gray-200 pb-2">
            {tabs.map((tab) => (
                <Button
                    key={tab.id}
                    variant="tab"
                    isActive={activeTab === tab.id}
                    onClick={() => onTabChange(tab.id)}
                >
                    {tab.label}
                </Button>
            ))}
        </div>
    );
}

// =============================================================================
// Form Components
// =============================================================================

export const FormGroup = ({ label, children, hint }) => (
    <div className="flex flex-col gap-1">
        <label className="font-semibold text-gray-700 text-sm rtl:text-right">
            {label}
        </label>
        {children}
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
);

export const Input = ({ label, name, ...props }) => (
    <div className="flex flex-col">
        <label htmlFor={name} className="mb-1 text-sm font-medium text-gray-700 rtl:text-right">
            {label}
        </label>
        <input
            id={name}
            name={name}
            {...props}
            className={`border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-sky-500 focus:border-sky-500 rtl:text-right ${props.className || ''}`}
        />
    </div>
);

export const Select = ({ label, name, children, ...props }) => (
    <div className="flex flex-col">
        <label htmlFor={name} className="mb-1 text-sm font-medium text-gray-700 rtl:text-right">
            {label}
        </label>
        <select
            id={name}
            name={name}
            {...props}
            className={`border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-sky-500 focus:border-sky-500 rtl:text-right ${props.className || ''}`}
        >
            {children}
        </select>
    </div>
);

export const Textarea = ({ label, name, ...props }) => (
    <div className="flex flex-col">
        <label htmlFor={name} className="mb-1 text-sm font-medium text-gray-700 rtl:text-right">
            {label}
        </label>
        <textarea
            id={name}
            name={name}
            {...props}
            className={`border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-sky-500 focus:border-sky-500 rtl:text-right ${props.className || ''}`}
        />
    </div>
);

export function Checkbox(props) {
    return (
        <input
            type="checkbox"
            {...props}
            className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded"
        />
    );
}

export function FileUpload({ accept, onChange, ...props }) {
    return (
        <div className="flex items-center">
            <label className="block">
                <span className="sr-only">Choose file</span>
                <input
                    type="file"
                    accept={accept}
                    onChange={onChange}
                    className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-sky-50 file:text-sky-700
                    hover:file:bg-sky-100"
                    {...props}
                />
            </label>
        </div>
    );
}

// =============================================================================
// Data Display & UI States
// =============================================================================

export const ActionGroup = ({ children, className = '' }) => (
    <div className={`flex items-center flex-wrap gap-2 ${className}`}>
        {children}
    </div>
);

export const Table = ({ headers, children }) => {
  const tableHeaders = Array.isArray(headers) ? headers : [];
  const cellClassName = 'px-4 py-3'; // Standardized padding for all cells

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg my-4">
      <table className="min-w-full text-sm divide-y divide-gray-200 table-fixed">
        <thead className="bg-gray-100">
          <tr className="text-left text-gray-700">
            {tableHeaders.map((header, index) => (
              <th key={index} scope="col" className={`${cellClassName} font-semibold tracking-wider`}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {React.Children.map(children, (row) => {
            if (!React.isValidElement(row)) return row;

            // Handle EmptyState component specifically
            if (row.type === EmptyState) {
                return row; // Render EmptyState directly (it already renders a <tr><td>...)
            }

            // For regular table rows
            const cells = React.Children.map(row.props.children, (cell) => {
              if (!React.isValidElement(cell)) return cell;
              return React.cloneElement(cell, {
                className: `${cellClassName} text-gray-800 align-middle ${cell.props.className || ''}`.trim(),
              });
            });

            return React.cloneElement(row, {
              className: `${row.props.className || ''} hover:bg-gray-50`,
              children: cells
            });
          })}
        </tbody>
      </table>
    </div>
  );
};


// --- MODIFICATION: Updated EmptyState to render a table row ---
export const EmptyState = ({ message, colSpan = 1 }) => (
    <tr>
        <td colSpan={colSpan} className="py-12 text-center text-gray-500 border border-gray-200">
            {message}
        </td>
    </tr>
);
// --- END MODIFICATION ---

export const Spinner = () => <div className="flex justify-center items-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div></div>;

export const PdfIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>

export const CourseIcon = ({ course }) => {
    const p = { width: 34, height: 34, viewBox: '0 0 48 48' };
    switch (course) {
        case 'IMNCI': return (<svg {...p}><circle cx="24" cy="24" r="22" fill="#e0f2fe" /><path d="M12 34c6-10 18-10 24 0" stroke="#0ea5e9" strokeWidth="3" fill="none" /><circle cx="24" cy="18" r="6" fill="#0ea5e9" /></svg>);
        case 'ETAT': return (<svg {...p}><rect x="3" y="8" width="42" height="30" rx="4" fill="#fff7ed" stroke="#f97316" strokeWidth="3" /><path d="M8 24h10l2-6 4 12 3-8h11" stroke="#f97316" strokeWidth="3" fill="none" /></svg>);
        case 'EENC': return (<svg {...p}><circle cx="16" cy="22" r="7" fill="#dcfce7" /><circle cx="30" cy="18" r="5" fill="#a7f3d0" /><path d="M8 34c8-6 24-6 32 0" stroke="#10b981" strokeWidth="3" fill="none" /></svg>);
        default: return null;
    }
}

// =============================================================================
// Overlays & Notifications
// =============================================================================

export function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-4">
                    {children}
                </div>
            </div>
        </div>
    );
}

export function Toast({ message, type, onClose }) {
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'; // Added default/info case
    const borderColor = type === 'success' ? 'border-green-600' : type === 'error' ? 'border-red-600' : 'border-blue-600'; // Added default/info case
    const icon = type === 'success' ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ) : type === 'error' ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ) : ( // Default/info icon
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );

    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 5000); // Auto-close after 5 seconds
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center p-4 rounded-lg shadow-lg text-white border-t-4 ${bgColor} ${borderColor} z-50`}>
            {icon}
            <div className="ml-3 text-sm font-medium">{message}</div>
            <button onClick={onClose} className="ml-auto -mx-1.5 -my-1.5 bg-transparent rounded-lg p-1.5 inline-flex h-8 w-8 text-white hover:bg-white hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-white">
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
        </div>
    );
}