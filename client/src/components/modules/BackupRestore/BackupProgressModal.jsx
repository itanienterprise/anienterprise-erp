import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
    CheckCircle2Icon, 
    AlertCircleIcon, 
    DownloadIcon, 
    UploadIcon, 
    RefreshCwIcon, 
    CheckIcon,
    XIcon
} from '../../Icons';

/**
 * BackupProgressModal - Clean, light ERP themed circular progress indicator card for Backup & Restore operations.
 * Matches the official ERP UI styling (white rounded-3xl cards, subtle slate borders, clean typography).
 */
const BackupProgressModal = ({
    isOpen,
    mode = 'backup',
    status = 'processing',
    progress = 0,
    title,
    actionText,
    stats = {},
    errorMessage,
    onClose,
    onReload,
    onDownloadAgain
}) => {
    const [displayProgress, setDisplayProgress] = useState(0);
    const [reloadCountdown, setReloadCountdown] = useState(null);
    const animRef = useRef(null);

    // Smooth lerp animation for the circular progress gauge
    useEffect(() => {
        if (!isOpen) {
            setDisplayProgress(0);
            return;
        }

        const target = status === 'done' ? 100 : Math.min(100, Math.max(0, progress));

        const updateSmoothly = () => {
            setDisplayProgress((prev) => {
                const diff = target - prev;
                if (Math.abs(diff) < 0.35) {
                    return target;
                }
                const step = diff > 0 ? Math.max(0.3, diff * 0.16) : Math.min(-0.3, diff * 0.16);
                return prev + step;
            });
            animRef.current = requestAnimationFrame(updateSmoothly);
        };

        animRef.current = requestAnimationFrame(updateSmoothly);
        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, [progress, status, isOpen]);

    // Handle auto-reload countdown for Restore Done state
    useEffect(() => {
        if (isOpen && status === 'done' && mode === 'restore' && onReload) {
            setReloadCountdown(4);
            const timer = setInterval(() => {
                setReloadCountdown((prev) => {
                    if (prev === null) return null;
                    if (prev <= 1) {
                        clearInterval(timer);
                        onReload();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        } else {
            setReloadCountdown(null);
        }
    }, [isOpen, status, mode, onReload]);

    if (!isOpen) return null;

    const isDone = status === 'done';
    const isError = status === 'error';
    const isBackup = mode === 'backup';

    // SVG Circular dimensions
    const size = 175;
    const strokeWidth = 10;
    const center = size / 2;
    const radius = center - strokeWidth - 3;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (Math.min(100, Math.max(0, displayProgress)) / 100) * circumference;

    const roundedPercent = Math.round(displayProgress);

    return createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity duration-200"
                onClick={isDone || isError ? onClose : undefined}
            />

            {/* Modal Card - Clean White ERP Theme */}
            <div 
                className="relative bg-white border border-gray-100 rounded-[28px] sm:rounded-[32px] shadow-2xl w-full max-w-md p-6 sm:p-8 z-10 transition-all duration-200 text-center overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Optional Close Button on Done / Error */}
                {(isDone || isError) && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all cursor-pointer"
                        title="Close"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                )}

                {/* Top Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2.5">
                    {isDone ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5 font-bold">
                            <CheckCircle2Icon className="w-3.5 h-3.5 text-emerald-600" />
                            {isBackup ? 'Backup Completed' : 'Restore Completed'}
                        </span>
                    ) : isError ? (
                        <span className="bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full flex items-center gap-1.5 font-bold">
                            <AlertCircleIcon className="w-3.5 h-3.5 text-red-600" />
                            Operation Failed
                        </span>
                    ) : isBackup ? (
                        <span className="bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1 rounded-full flex items-center gap-1.5 font-bold">
                            <DownloadIcon className="w-3.5 h-3.5 animate-bounce" />
                            Database Backup Processing
                        </span>
                    ) : (
                        <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 px-3 py-1 rounded-full flex items-center gap-1.5 font-bold">
                            <UploadIcon className="w-3.5 h-3.5 animate-bounce" />
                            Database Restore Processing
                        </span>
                    )}
                </div>

                {/* Card Title & Subtitle */}
                <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight leading-snug">
                    {title || (
                        isDone
                            ? (isBackup ? 'Backup Completed!' : 'Database Restored!')
                            : isError
                            ? 'Operation Encountered an Error'
                            : (isBackup ? 'Exporting Database Data' : 'Restoring System Database')
                    )}
                </h3>

                <p className="text-xs sm:text-sm text-gray-500 mt-1 mb-5">
                    {isDone
                        ? (isBackup 
                            ? 'Your database backup file has been generated and downloaded.' 
                            : 'All selected collections and records have been successfully restored.')
                        : isError
                        ? (errorMessage || 'An error occurred during database processing.')
                        : 'Please wait while the system processes your request.'}
                </p>

                {/* CIRCULAR PROGRESS GAUGE */}
                <div className="relative my-3 flex items-center justify-center">
                    <svg
                        width={size}
                        height={size}
                        className="transform -rotate-90"
                    >
                        <defs>
                            <linearGradient id="erpBackupGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#2563EB" />
                                <stop offset="100%" stopColor="#4F46E5" />
                            </linearGradient>
                            <linearGradient id="erpRestoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#4F46E5" />
                                <stop offset="100%" stopColor="#7C3AED" />
                            </linearGradient>
                            <linearGradient id="erpDoneGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#10B981" />
                                <stop offset="100%" stopColor="#059669" />
                            </linearGradient>
                        </defs>

                        {/* Background track circle */}
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            stroke="#EEF2F6"
                            strokeWidth={strokeWidth}
                            fill="transparent"
                        />

                        {/* Active filling progress circle */}
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            stroke={
                                isDone
                                    ? 'url(#erpDoneGradient)'
                                    : isError
                                    ? '#EF4444'
                                    : isBackup
                                    ? 'url(#erpBackupGradient)'
                                    : 'url(#erpRestoreGradient)'
                            }
                            strokeWidth={strokeWidth}
                            fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-300 ease-out"
                        />
                    </svg>

                    {/* Inside Circle Content */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4">
                        {isDone ? (
                            <div className="flex flex-col items-center animate-in zoom-in-75 duration-300">
                                <div className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/15 mb-1">
                                    <CheckIcon className="w-7 h-7 stroke-[3]" />
                                </div>
                                <span className="text-base font-black text-emerald-600">
                                    100%
                                </span>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                                    Done
                                </span>
                            </div>
                        ) : isError ? (
                            <div className="flex flex-col items-center">
                                <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mb-1">
                                    <XIcon className="w-7 h-7" />
                                </div>
                                <span className="text-sm font-bold text-red-600">
                                    Failed
                                </span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <span className="text-4xl font-black text-gray-900 tracking-tight">
                                    {roundedPercent}<span className="text-2xl font-bold text-gray-400">%</span>
                                </span>
                                <span className={`text-[11px] font-bold tracking-wider uppercase mt-1 ${
                                    isBackup ? 'text-blue-600' : 'text-indigo-600'
                                }`}>
                                    {isBackup ? 'Exporting...' : 'Restoring...'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Current Action / Progress Status Description */}
                <div className="w-full mt-3 bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        {!isDone && !isError && (
                            <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                        )}
                        <p className="text-xs font-semibold text-gray-700 truncate max-w-xs sm:max-w-sm">
                            {actionText || (
                                isDone 
                                    ? 'All operations completed successfully.' 
                                    : isError 
                                    ? (errorMessage || 'Operation stopped due to an error.') 
                                    : 'Processing database records...'
                            )}
                        </p>
                    </div>

                    {/* Mini horizontal progress tracker */}
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                        <div 
                            className={`h-full transition-all duration-300 ${
                                isDone 
                                    ? 'bg-emerald-500' 
                                    : isError 
                                    ? 'bg-red-500' 
                                    : isBackup 
                                    ? 'bg-blue-600' 
                                    : 'bg-indigo-600'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, displayProgress))}%` }}
                        />
                    </div>
                </div>

                {/* Operations Summary Stats Cards */}
                <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 text-left">
                    <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                        <p className="text-[10px] uppercase font-bold text-gray-400">Collections</p>
                        <p className="text-xs font-bold text-gray-900 mt-0.5 truncate">
                            {stats.currentCollection 
                                ? `${stats.currentCollection} / ${stats.totalCollections || '?'}`
                                : (stats.totalCollections ? `${stats.totalCollections} Total` : 'Analyzing...')}
                        </p>
                    </div>

                    <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                        <p className="text-[10px] uppercase font-bold text-gray-400">Records</p>
                        <p className="text-xs font-bold text-gray-900 mt-0.5 truncate">
                            {stats.totalRecords ? Number(stats.totalRecords).toLocaleString() : (stats.currentRecords ? Number(stats.currentRecords).toLocaleString() : 'In Progress')}
                        </p>
                    </div>

                    <div className="col-span-2 sm:col-span-1 p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                        <p className="text-[10px] uppercase font-bold text-gray-400">
                            {isBackup ? 'File Size' : 'Status'}
                        </p>
                        <p className="text-xs font-bold text-gray-900 mt-0.5 truncate">
                            {isBackup 
                                ? (stats.fileSize || 'Calculating...') 
                                : (isDone ? 'Restored' : isError ? 'Error' : 'Applying...')}
                        </p>
                    </div>
                </div>

                {/* Warning Pill during processing */}
                {!isDone && !isError && (
                    <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 mt-4 text-center w-full leading-snug font-medium flex items-center justify-center gap-1.5">
                        <span>⚠️</span>
                        <span><strong>Please do not close or reload this tab</strong> while the operation is running.</span>
                    </div>
                )}

                {/* Bottom Actions */}
                <div className="w-full mt-5">
                    {isDone ? (
                        <div className="space-y-2">
                            {mode === 'restore' && onReload ? (
                                <button
                                    type="button"
                                    onClick={onReload}
                                    className="w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <CheckIcon className="w-5 h-5 stroke-[2.5]" />
                                    <span>Done {reloadCountdown !== null ? `(Reloading in ${reloadCountdown}s...)` : '— Reload Page'}</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <CheckIcon className="w-5 h-5 stroke-[2.5]" />
                                    <span>Done</span>
                                </button>
                            )}

                            {isBackup && onDownloadAgain && (
                                <button
                                    type="button"
                                    onClick={onDownloadAgain}
                                    className="w-full py-2 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <DownloadIcon className="w-3.5 h-3.5" />
                                    <span>Download Backup File Again</span>
                                </button>
                            )}
                        </div>
                    ) : isError ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-xs sm:text-sm transition-all cursor-pointer"
                        >
                            Close
                        </button>
                    ) : (
                        <div className="flex items-center justify-center gap-2 py-1 text-xs font-semibold text-gray-500">
                            <RefreshCwIcon className="w-4 h-4 animate-spin text-blue-600" />
                            <span>Processing... please wait</span>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default BackupProgressModal;
