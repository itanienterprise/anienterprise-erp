import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XIcon, PDFIcon, DocxIcon, SparklesIcon, ArrowUpRightIcon, DownloadIcon } from '../Icons';

/**
 * Reusable modal card to select document export format:
 * - PDF (Print / Preview)
 * - Application DOCX (Word Document)
 * - Both (PDF & Application DOCX)
 */
const DocumentExportModal = ({
    isOpen,
    onClose,
    title = 'Choose Export Format',
    subtitle = 'Select your preferred format to print or export documents',
    badgeText = 'EXPORT OPTIONS',
    pdfTitle = 'PI PDF',
    pdfBadge = 'Print / Preview',
    pdfDescription = 'Open printable PDF in a new tab',
    docxTitle = 'Application DOCX',
    docxBadge = '.docx File',
    docxDescription = 'Download editable Application letter in Word format',
    bothTitle = 'PI PDF + Application DOCX',
    bothBadge = 'DUAL',
    bothDescription = 'Open PDF in new tab and download Application DOCX',
    onExportPdf,
    onExportDocx,
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

    const handleSelectDocx = () => {
        if (onExportDocx) onExportDocx();
        onClose();
    };

    const handleSelectBoth = () => {
        if (onExportBoth) {
            onExportBoth();
        } else {
            if (onExportPdf) onExportPdf();
            setTimeout(() => {
                if (onExportDocx) onExportDocx();
            }, 250);
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
                            {badgeText}
                        </span>
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug">{title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 -mr-1 -mt-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
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
                        className="group w-full flex items-center gap-4 p-3.5 sm:p-4 rounded-2xl border border-rose-200/80 bg-rose-50/20 hover:border-rose-400 hover:bg-rose-50/50 hover:shadow-md transition-all duration-200 active:scale-[0.98] text-left cursor-pointer"
                    >
                        <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200/70 flex items-center justify-center flex-shrink-0 text-red-600 group-hover:scale-105 group-hover:bg-red-500 group-hover:text-white transition-all shadow-sm">
                            <PDFIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-900 group-hover:text-red-700 transition-colors">
                                    {pdfTitle}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100/70 text-red-700">
                                    {pdfBadge}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                {pdfDescription}
                            </p>
                        </div>
                        <ArrowUpRightIcon className="w-4 h-4 text-gray-400 group-hover:text-red-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
                    </button>

                    {/* 2. DOCX Option */}
                    <button
                        type="button"
                        onClick={handleSelectDocx}
                        className="group w-full flex items-center gap-4 p-3.5 sm:p-4 rounded-2xl border border-blue-200/80 bg-blue-50/20 hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-md transition-all duration-200 active:scale-[0.98] text-left cursor-pointer"
                    >
                        <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200/70 flex items-center justify-center flex-shrink-0 text-blue-600 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                            <DocxIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                                    {docxTitle}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100/70 text-blue-700">
                                    {docxBadge}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                {docxDescription}
                            </p>
                        </div>
                        <DownloadIcon className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-y-0.5 transition-all flex-shrink-0" />
                    </button>

                    {/* 3. Both Option */}
                    <button
                        type="button"
                        onClick={handleSelectBoth}
                        className="group w-full flex items-center gap-4 p-3.5 sm:p-4 rounded-2xl border border-indigo-200/80 bg-indigo-50/30 hover:border-indigo-400 hover:bg-indigo-50/70 hover:shadow-md transition-all duration-200 active:scale-[0.98] text-left relative overflow-hidden cursor-pointer"
                    >
                        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white group-hover:scale-105 group-hover:shadow-md group-hover:shadow-indigo-500/30 transition-all">
                            <SparklesIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">
                                    {bothTitle}
                                </span>
                                <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-xs">
                                    {bothBadge}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                {bothDescription}
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
                        className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default DocumentExportModal;
