import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '../Icons';
import TableScrollNav from './TableScrollNav';

const getPageNumbers = (current, total) => {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
        return [1, 2, 3, 4, 5, '...', total];
    }
    if (current >= total - 3) {
        return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
};

export const ALL_PAGE_SIZE = 100000;

const PaginationBar = ({
    currentPage = 1,
    pageSize = 15,
    totalItems = 0,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = ['all', 15, 30, 50, 100],
    totalUnfiltered = null,
    itemName = 'records',
    className = '',
    showScrollNav = true,
    tableContainerRef = null
}) => {
    const isAll = pageSize === 'all' || Number(pageSize) >= ALL_PAGE_SIZE;
    const effectivePageSize = isAll ? Math.max(1, totalItems) : (Number(pageSize) || 15);
    const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
    const startItem = totalItems > 0 ? (isAll ? 1 : (currentPage - 1) * effectivePageSize + 1) : 0;
    const endItem = isAll ? totalItems : Math.min(currentPage * effectivePageSize, totalItems);

    const rawOptions = Array.isArray(pageSizeOptions) && pageSizeOptions.length > 0
        ? pageSizeOptions
        : [15, 30, 50, 100];
    const numericOptions = rawOptions.filter(opt => opt !== 'all' && opt !== 'All' && Number(opt) < ALL_PAGE_SIZE);
    const normalizedOptions = ['all', ...numericOptions];

    return (
        <div className={`bg-white px-4 sm:px-6 py-3 border-t border-gray-200/90 text-xs text-gray-600 select-none ${
            showScrollNav
                ? 'flex flex-col md:grid md:grid-cols-[1fr_auto_1fr] items-center gap-3'
                : 'flex flex-col sm:flex-row items-center justify-between gap-3'
        } ${className}`}>
            {/* Left Info & Page Size */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 sm:gap-3 w-full md:w-auto">
                <span className="text-gray-600 font-medium">
                    Showing <strong className="text-gray-900 font-bold">{startItem}</strong> to <strong className="text-gray-900 font-bold">{endItem}</strong> of <strong className="text-gray-900 font-bold">{totalItems.toLocaleString()}</strong> {itemName}
                </span>
                <span className="text-gray-300 hidden sm:inline">|</span>
                <div className="flex items-center gap-1.5">
                    <span className="text-gray-500 font-medium whitespace-nowrap">Rows per page:</span>
                    <select
                        value={isAll ? 'all' : pageSize}
                        onChange={(e) => {
                            if (!onPageSizeChange) return;
                            const val = e.target.value;
                            if (val === 'all') {
                                onPageSizeChange(ALL_PAGE_SIZE);
                            } else {
                                onPageSizeChange(Number(val));
                            }
                        }}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-white text-gray-800 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs transition-all"
                    >
                        {normalizedOptions.map(opt => {
                            if (opt === 'all' || opt === 'All' || Number(opt) >= ALL_PAGE_SIZE) {
                                return <option key="all" value="all">All</option>;
                            }
                            return <option key={opt} value={opt}>{opt}</option>;
                        })}
                    </select>
                </div>
            </div>

            {/* Center: Horizontal Table Scroll Buttons */}
            {showScrollNav && (
                <div className="hidden md:flex items-center justify-center">
                    <TableScrollNav
                        embedded={true}
                        containerRef={tableContainerRef}
                    />
                </div>
            )}

            {/* Right: Page Navigation */}
            <div className={`flex items-center gap-1 w-full md:w-auto justify-center md:justify-end overflow-x-auto py-0.5 ${totalPages <= 1 ? 'hidden md:block' : ''}`}>
                {totalPages > 1 && (
                    <>
                        <button
                            type="button"
                            onClick={() => onPageChange && onPageChange(1)}
                            disabled={currentPage === 1}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-all shadow-2xs text-xs cursor-pointer disabled:hover:bg-white"
                            title="First page"
                        >
                            « First
                        </button>
                        <button
                            type="button"
                            onClick={() => onPageChange && onPageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 px-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-all shadow-2xs cursor-pointer disabled:hover:bg-white flex items-center justify-center"
                            title="Previous page"
                        >
                            <ChevronLeftIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>

                        {/* Numbered Page Buttons */}
                        <div className="flex items-center gap-1 px-1">
                            {getPageNumbers(currentPage, totalPages).map((item, i) => {
                                if (item === '...') {
                                    return <span key={`ellipsis-${i}`} className="px-1 text-gray-400 select-none text-xs">...</span>;
                                }
                                const isCurrent = currentPage === item;
                                return (
                                    <button
                                        key={item}
                                        type="button"
                                        onClick={() => onPageChange && onPageChange(item)}
                                        className={`min-w-[30px] h-7 px-2 text-xs rounded-lg font-bold transition-all shadow-2xs flex items-center justify-center cursor-pointer ${
                                            isCurrent
                                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/20'
                                                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                                        }`}
                                    >
                                        {item}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            onClick={() => onPageChange && onPageChange(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage >= totalPages}
                            className="p-1.5 px-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-all shadow-2xs cursor-pointer disabled:hover:bg-white flex items-center justify-center"
                            title="Next page"
                        >
                            <ChevronRightIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onPageChange && onPageChange(totalPages)}
                            disabled={currentPage >= totalPages}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-all shadow-2xs text-xs cursor-pointer disabled:hover:bg-white"
                            title="Last page"
                        >
                            Last »
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default PaginationBar;
