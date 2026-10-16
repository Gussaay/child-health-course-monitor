import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Modal, Button, Select, FormGroup } from './CommonComponents';
import { useTranslation } from 'react-i18next';

const ExcelImportModal = ({ isOpen, onClose, onImport, course }) => {
  const { t } = useTranslation();
  const [excelData, setExcelData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fieldMappings, setFieldMappings] = useState({});
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const commonFields = [
    { key: 'name', label: 'Name', required: true },
    { key: 'group', label: 'Group', required: true },
    { key: 'state', label: 'State', required: true },
    { key: 'locality', label: 'Locality', required: true },
    { key: 'center_name', label: 'Health Facility Name', required: true },
    { key: 'job_title', label: 'Job Title', required: true },
    { key: 'phone', label: 'Phone Number', required: true }
  ];

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
          setError(t('admin_pages.excel_import.err_min_rows', 'Excel file must contain at least a header row and one data row'));
          return;
        }

        setHeaders(jsonData[0]);
        setExcelData(jsonData.slice(1));
        setCurrentPage(1);
        setError('');
      } catch (err) {
        setError(t('admin_pages.excel_import.err_reading', 'Error reading Excel file: {{message}}', { message: err.message }));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMappingChange = (appField, excelHeader) => {
    setFieldMappings(prev => ({
      ...prev,
      [appField]: excelHeader
    }));
  };

  const handleImport = () => {
    // Validate mappings
    const missingRequired = commonFields
      .filter(field => field.required && !fieldMappings[field.key])
      .map(field => t(`admin_pages.excel_import.fields.${field.key}`, field.label));
    
    if (missingRequired.length > 0) {
      setError(t('admin_pages.excel_import.err_map_required', 'Please map all required fields: {{fields}}', { fields: missingRequired.join(', ') }));
      return;
    }

    // Transform data based on mappings
    const participants = excelData.map(row => {
      const participant = {};
      Object.entries(fieldMappings).forEach(([appField, excelHeader]) => {
        const headerIndex = headers.indexOf(excelHeader);
        if (headerIndex !== -1 && row[headerIndex] !== undefined) {
          participant[appField] = row[headerIndex];
        }
      });
      return participant;
    });

    onImport(participants);
    onClose();
  };

  const renderPreview = () => {
    if (excelData.length === 0) return null;
    
    return (
      <div className="mt-4 overflow-auto max-h-60">
        <h4 className="font-medium mb-2">{t('admin_pages.excel_import.preview', 'Data Preview (first 5 rows)')}</h4>
        <table className="min-w-full border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              {headers.map((header, idx) => (
                <th key={idx} className="border border-gray-300 p-2 text-left text-xs">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {excelData.slice(0, 5).map((row, rowIdx) => (
              <tr key={rowIdx}>
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="border border-gray-300 p-2 text-xs">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('admin_pages.excel_import.title', 'Import Participants from Excel')}>
      <div className="p-4">
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
        
        {currentPage === 0 && (
          <div>
            <p className="mb-4">{t('admin_pages.excel_import.upload_help', 'Upload an Excel file containing participant information. The first row should contain column headers.')}</p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        )}
        
        {currentPage === 1 && (
          <div>
            <h4 className="font-medium mb-4">{t('admin_pages.excel_import.map_heading', 'Map Excel columns to application fields')}</h4>
            <div className="grid gap-3 mb-4">
              {commonFields.map(field => (
                <div key={field.key} className="flex items-center">
                  <label className="w-40 font-medium">{t(`admin_pages.excel_import.fields.${field.key}`, field.label)}{field.required && '*'}</label>
                  <Select
                    value={fieldMappings[field.key] || ''}
                    onChange={(e) => handleMappingChange(field.key, e.target.value)}
                    className="flex-1"
                  >
                    <option value="">{t('admin_pages.excel_import.select_column', '-- Select Excel Column --')}</option>
                    {headers.map(header => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
            
            {renderPreview()}
            
            <div className="flex justify-end mt-6 space-x-2">
              <Button variant="secondary" onClick={() => setCurrentPage(0)}>{t('admin_pages.excel_import.back', 'Back')}</Button>
              <Button onClick={handleImport}>{t('admin_pages.excel_import.import', 'Import Participants')}</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ExcelImportModal;