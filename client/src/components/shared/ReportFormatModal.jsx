import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XIcon, PDFIcon, ExcelIcon, SparklesIcon, ArrowUpRightIcon, DownloadIcon } from '../Icons';

/**
 * Reusable modal card to select export format: PDF, Excel, or Both.
 * 
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {function} onClose - Callback when modal is closed
 * @param {string} title - Optional title describing the report being exported
 * @param {string} subtitle - Optional description
 * @param {function} onExportPdf - Handler for PDF export
 * @param {function} onExportExcel - Handler for Excel export
 * @param {function} onExportBoth - Optional handler for both (defaults to calling PDF and Excel)
 */
const ReportFormatModal = ({
    isOpen,
    onClose,
    title = 'Choose Export Format',
    subtitle = 'Select your preferred file format for this report',
    onExportPdf,
    onExportExcel,
    onExportBoth
}) => {
    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSelectPdf = () => {
        if (onExportPdf) onExportPdf();
        onClose();
    };

    const handleSelectExcel = () => {
        if (onExportExcel) onExportExcel();
        onClose();
    };

    const handleSelectBoth = () => {
        if (onExportBoth) {
            onExportBoth();
        } else {
            if (onExportPdf) onExportPdf();
            setTimeout(() => {
                if (onExportExcel) onExportExcel();
            }, 150);
        }
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 app-modal-overlay">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal Card */}
            <div className="relative bg-white border border-gray-100 rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-7 z-10 animate-in zoom-in-95 duration-200 overflow-hidden text-left">
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-gray-100">
                    <div>
                        <span className="inline-block text-[11px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full mb-1.5">
                            Export Options
                        </span>
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug">{title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-1 -mt-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                        title="Close"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Format Option Cards */}
                <div className="space-y-3 pt-5">
                    {/* 1. PDF Option */}
                    <button
                        type="button"
                        onClick={handleSelectPdf}
                        className="group w-full flex items-center gap-4 p-3.5 sm:p-4 rounded-2xl border border-rose-200/80 bg-rose-50/20 hover:border-rose-400 hover:bg-rose-50/50 hover:shadow-md transition-all duration-200 active:scale-[0.98] text-left"
                    >
                        <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200/70 flex items-center justify-center flex-shrink-0 text-red-600 group-hover:scale-105 group-hover:bg-red-500 group-hover:text-white transition-all shadow-sm">
                            <PDFIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-900 group-hover:text-red-700 transition-colors">
                                    PDF Document
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100/70 text-red-700">
                                    Print / Preview
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                Open printable PDF report in a new tab
                            </p>
                        </div>
                        <ArrowUpRightIcon className="w-4 h-4 text-gray-400 group-hover:text-red-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
                    </button>

                    {/* 2. Excel Option */}
                    <button
                        type="button"
                        onClick={handleSelectExcel}
                        className="group w-full flex items-center gap-4 p-3.5 sm:p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 hover:border-emerald-400 hover:bg-emerald-50/50 hover:shadow-md transition-all duration-200 active:scale-[0.98] text-left"
                    >
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200/70 flex items-center justify-center flex-shrink-0 text-emerald-600 group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                            <ExcelIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                                    Excel Spreadsheet
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100/70 text-emerald-700">
                                    .xlsx File
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                Download structured spreadsheet with all records
                            </p>
                        </div>
                        <DownloadIcon className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 group-hover:translate-y-0.5 transition-all flex-shrink-0" />
                    </button>

                    {/* 3. Both Option */}
                    <button
                        type="button"
                        onClick={handleSelectBoth}
                        className="group w-full flex items-center gap-4 p-3.5 sm:p-4 rounded-2xl border border-indigo-200/80 bg-indigo-50/30 hover:border-indigo-400 hover:bg-indigo-50/70 hover:shadow-md transition-all duration-200 active:scale-[0.98] text-left relative overflow-hidden"
                    >
                        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white group-hover:scale-105 group-hover:shadow-md group-hover:shadow-indigo-500/30 transition-all">
                            <SparklesIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">
                                    Both (PDF & Excel)
                                </span>
                                <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-xs">
                                    Dual
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                Open PDF in new tab and download Excel file
                            </p>
                        </div>
                        <div className="flex items-center gap-0.5 text-indigo-600 group-hover:translate-x-0.5 transition-transform flex-shrink-0">
                            <ArrowUpRightIcon className="w-3.5 h-3.5" />
                            <DownloadIcon className="w-3.5 h-3.5" />
                        </div>
                    </button>
                </div>

                {/* Footer */}
                <div className="pt-5 mt-2 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ReportFormatModal;
