import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { queryClient } from '../../../utils/queryClient';
import { XIcon, BarChartIcon, PrinterIcon, FunnelIcon, SearchIcon, ChevronDownIcon } from '../../Icons';
import { formatDate, calculatePurchaseRemainingQty } from '../../../utils/helpers';
import { generatePurchaseReportPDF } from '../../../utils/pdfGenerator';
import { generatePurchaseReportExcel } from '../../../utils/excelGenerator';
import ReportFormatModal from '../../shared/ReportFormatModal';
import CustomDatePicker from '../../shared/CustomDatePicker';

const PurchaseReport = ({
    isOpen,
    onClose,
    purchases = [],
    productsList = [],
    warehousesList = ['HILI', 'DINAJPUR', 'CHATTOGRAM', 'DHAKA'],
    initialFilters = {},
    purchaseReceivesList = []
}) => {
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showReportFormatModal, setShowReportFormatModal] = useState(false);

    const [filters, setFilters] = useState({
        startDate: initialFilters.startDate || '',
        endDate: initialFilters.endDate || '',
        quickRange: initialFilters.quickRange || 'all',
        companyName: initialFilters.companyName || '',
        warehouse: initialFilters.warehouse || '',
        productName: initialFilters.productName || '',
        brand: initialFilters.brand || '',
        status: initialFilters.status || 'All'
    });

    const filterPanelRef = useRef(null);
    const filterButtonRef = useRef(null);

    // Sync initial filters when opened
    useEffect(() => {
        if (isOpen) {
            setFilters(prev => ({
                ...prev,
                startDate: initialFilters.startDate || '',
                endDate: initialFilters.endDate || '',
                quickRange: initialFilters.quickRange || 'all',
                companyName: initialFilters.companyName || '',
                warehouse: initialFilters.warehouse || '',
                productName: initialFilters.productName || '',
                brand: initialFilters.brand || '',
                status: initialFilters.status || 'All'
            }));
            setSearchQuery('');
            setShowFilterPanel(false);
        }
    }, [isOpen, initialFilters]);

    // Close on click outside filter panel
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e) => {
            if (
                filterPanelRef.current && !filterPanelRef.current.contains(e.target) &&
                filterButtonRef.current && !filterButtonRef.current.contains(e.target)
            ) {
                setShowFilterPanel(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Close modal on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !showReportFormatModal) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, showReportFormatModal, onClose]);

    const handleFilterChange = (key, val) => {
        setFilters(prev => ({ ...prev, [key]: val }));
    };

    const handleQuickRange = (range) => {
        const today = new Date();
        const formatDateIso = (d) => d.toISOString().split('T')[0];

        if (range === 'all') {
            setFilters(prev => ({ ...prev, quickRange: 'all', startDate: '', endDate: '' }));
        } else if (range === 'today') {
            const todayStr = formatDateIso(today);
            setFilters(prev => ({ ...prev, quickRange: 'today', startDate: todayStr, endDate: todayStr }));
        } else if (range === 'yesterday') {
            const yest = new Date(today);
            yest.setDate(yest.getDate() - 1);
            const yestStr = formatDateIso(yest);
            setFilters(prev => ({ ...prev, quickRange: 'yesterday', startDate: yestStr, endDate: yestStr }));
        } else if (range === 'weekly') {
            const lastWeek = new Date(today);
            lastWeek.setDate(lastWeek.getDate() - 7);
            setFilters(prev => ({ ...prev, quickRange: 'weekly', startDate: formatDateIso(lastWeek), endDate: formatDateIso(today) }));
        } else if (range === 'monthly') {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            setFilters(prev => ({ ...prev, quickRange: 'monthly', startDate: formatDateIso(firstDay), endDate: formatDateIso(lastDay) }));
        } else if (range === 'yearly') {
            const firstDayYear = new Date(today.getFullYear(), 0, 1);
            const lastDayYear = new Date(today.getFullYear(), 11, 31);
            setFilters(prev => ({ ...prev, quickRange: 'yearly', startDate: formatDateIso(firstDayYear), endDate: formatDateIso(lastDayYear) }));
        }
    };

    const resetFilters = () => {
        setFilters({
            startDate: '',
            endDate: '',
            quickRange: 'all',
            companyName: '',
            warehouse: '',
            productName: '',
            brand: '',
            status: 'All'
        });
        setSearchQuery('');
    };

    // Filter options from dataset
    const uniqueSuppliers = useMemo(() => {
        return [...new Set(purchases.map(p => p.companyName || p.supplierName).filter(Boolean))].sort();
    }, [purchases]);

    const uniqueWarehouses = useMemo(() => {
        const fromData = purchases.map(p => p.warehouse).filter(Boolean);
        return [...new Set([...warehousesList, ...fromData])].sort();
    }, [purchases, warehousesList]);

    const uniqueProducts = useMemo(() => {
        const list = new Set();
        purchases.forEach(p => {
            (p.items || []).forEach(it => {
                const name = it.productName || it.product;
                if (name) list.add(name);
            });
        });
        (productsList || []).forEach(p => {
            if (p.name) list.add(p.name);
        });
        return [...list].sort();
    }, [purchases, productsList]);

    const uniqueBrands = useMemo(() => {
        const list = new Set();
        purchases.forEach(p => {
            (p.items || []).forEach(it => {
                if (filters.productName) {
                    const itName = it.productName || it.product || '';
                    if (itName.toLowerCase() !== filters.productName.toLowerCase()) return;
                }
                const bEntries = it.brandEntries || [{ brand: it.brand || '' }];
                bEntries.forEach(be => {
                    if (be.brand) list.add(be.brand);
                });
            });
        });
        return [...list].sort();
    }, [purchases, filters.productName]);

    // Filtered data
    const filteredPurchases = useMemo(() => {
        return purchases.filter(p => {
            // Status
            if (filters.status && filters.status !== 'All') {
                const status = (p.status || 'Accepted').toLowerCase();
                if (status !== filters.status.toLowerCase()) return false;
            }

            // Date
            const pDate = p.date ? p.date.split('T')[0] : '';
            if (filters.startDate && pDate && pDate < filters.startDate) return false;
            if (filters.endDate && pDate && pDate > filters.endDate) return false;

            // Warehouse
            if (filters.warehouse && filters.warehouse !== 'All') {
                const wh = (p.warehouse || 'HILI').toLowerCase();
                if (wh !== filters.warehouse.toLowerCase()) return false;
            }

            // Supplier / Company
            if (filters.companyName) {
                const comp = (p.companyName || p.supplierName || '').toLowerCase();
                if (!comp.includes(filters.companyName.toLowerCase())) return false;
            }

            // Product & Brand
            if (filters.productName || filters.brand) {
                const items = p.items || [];
                const matchesItem = items.some(item => {
                    const itemProd = (item.productName || item.product || '').toLowerCase();
                    const prodMatch = !filters.productName || itemProd.includes(filters.productName.toLowerCase());
                    if (!prodMatch) return false;

                    if (filters.brand) {
                        const brandEntries = item.brandEntries || [{ brand: item.brand || '' }];
                        return brandEntries.some(be => (be.brand || '').toLowerCase().includes(filters.brand.toLowerCase()));
                    }
                    return true;
                });
                if (!matchesItem) return false;
            }

            // Search query
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const pNo = (p.purchaseNo || '').toLowerCase();
                const comp = (p.companyName || p.supplierName || '').toLowerCase();
                const lc = (p.lcNo || '').toLowerCase();
                const wh = (p.warehouse || '').toLowerCase();
                const itemsStr = (p.items || []).map(i => `${i.productName || ''} ${(i.brandEntries || []).map(b => b.brand).join(' ')}`).join(' ').toLowerCase();

                const matched = pNo.includes(q) || comp.includes(q) || lc.includes(q) || wh.includes(q) || itemsStr.includes(q);
                if (!matched) return false;
            }

            return true;
        }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }, [purchases, filters, searchQuery]);

    const cachedPR = queryClient.getQueryData(['purchase-receives']);
    const effectivePRList = (purchaseReceivesList && purchaseReceivesList.length > 0)
        ? purchaseReceivesList
        : (Array.isArray(cachedPR) ? cachedPR : []);

    // Statistics
    const stats = useMemo(() => {
        let totalQty = 0;
        let totalRemainingQty = 0;
        let totalAmount = 0;
        let totalPaid = 0;
        let totalDue = 0;

        filteredPurchases.forEach(p => {
            (p.items || []).forEach(it => {
                const bEntries = it.brandEntries || [{ qty: it.qty || 0 }];
                bEntries.forEach(be => {
                    totalQty += parseFloat(be.qty) || 0;
                });
            });
            const rem = calculatePurchaseRemainingQty(p, effectivePRList).remainingQty;
            totalRemainingQty += rem;
            totalAmount += parseFloat(p.totalAmount) || 0;
            totalPaid += parseFloat(p.paidAmount) || 0;
            totalDue += parseFloat(p.dueAmount) || 0;
        });

        return { totalQty, totalRemainingQty, totalAmount, totalPaid, totalDue, totalRecords: filteredPurchases.length };
    }, [filteredPurchases, effectivePRList]);

    const hasActiveFilters = Boolean(
        filters.startDate || filters.endDate || (filters.quickRange && filters.quickRange !== 'all') ||
        filters.companyName || filters.warehouse || filters.productName || filters.brand || (filters.status && filters.status !== 'All')
    );

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.startDate || filters.endDate || (filters.quickRange && filters.quickRange !== 'all')) count++;
        if (filters.companyName) count++;
        if (filters.warehouse && filters.warehouse !== 'All' && filters.warehouse !== 'All Warehouses') count++;
        if (filters.productName) count++;
        if (filters.brand) count++;
        if (filters.status && filters.status !== 'All') count++;
        return count;
    }, [filters]);

    const handlePrint = () => {
        window.print();
    };

    const handleExportPdf = async () => {
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        await generatePurchaseReportPDF(filteredPurchases, filters, dateStr, effectivePRList);
    };

    const handleExportExcel = () => {
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        generatePurchaseReportExcel(filteredPurchases, filters, dateStr, effectivePRList);
    };

    const renderPurchaseTable = (records) => {
        const subTotalQty = records.reduce((sum, p) => {
            let pQty = 0;
            (p.items || []).forEach(it => {
                (it.brandEntries || [{ qty: it.qty || 0 }]).forEach(be => {
                    pQty += parseFloat(be.qty) || 0;
                });
            });
            return sum + pQty;
        }, 0);
        const subTotalRemainQty = records.reduce((sum, p) => {
            return sum + calculatePurchaseRemainingQty(p, effectivePRList).remainingQty;
        }, 0);
        const subTotalAmount = records.reduce((sum, p) => sum + (parseFloat(p.totalAmount) || 0), 0);
        const subTotalPaid = records.reduce((sum, p) => sum + (parseFloat(p.paidAmount) || 0), 0);
        const subTotalDue = records.reduce((sum, p) => sum + (parseFloat(p.dueAmount) || 0), 0);

        return (
            <div className="overflow-x-auto border border-gray-900">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-900 text-gray-900">
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap w-10">SL</th>
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">Date</th>
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">Purchase No</th>
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Supplier / Company</th>
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">Warehouse</th>
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Product</th>
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Brand</th>
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap">Qty (KG)</th>
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap">Remain Qty</th>
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap">Price</th>
                            <th className="px-2 sm:px-2.5 py-2 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap">Total Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-900">
                        {records.length > 0 ? (
                            records.map((p, idx) => {
                                const items = p.items || [];
                                let pQty = 0;
                                items.forEach(it => {
                                    (it.brandEntries || [{ qty: it.qty || 0 }]).forEach(be => {
                                        pQty += parseFloat(be.qty) || 0;
                                    });
                                });

                                const prodNames = items.map(it => it.productName || it.product || '').filter(Boolean);
                                const uniqueProds = [...new Set(prodNames)];
                                const prodStr = uniqueProds.length > 0 ? uniqueProds.join(', ') : '—';

                                const brandNames = [];
                                items.forEach(it => {
                                    const bEntries = it.brandEntries || [{ brand: it.brand || '' }];
                                    bEntries.forEach(be => {
                                        if (be.brand && !brandNames.includes(be.brand)) {
                                            brandNames.push(be.brand);
                                        }
                                    });
                                });
                                const brandStr = brandNames.length > 0 ? brandNames.join(', ') : '—';

                                const remQty = calculatePurchaseRemainingQty(p, effectivePRList).remainingQty;

                                return (
                                    <tr key={p._id || idx} className="hover:bg-blue-50/40 transition-colors">
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center font-bold text-gray-900 text-xs whitespace-nowrap">{idx + 1}</td>
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center font-semibold text-gray-900 text-xs whitespace-nowrap">{formatDate(p.date)}</td>
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center font-bold text-blue-700 text-xs whitespace-nowrap">{p.purchaseNo || '—'}</td>
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 font-bold text-gray-900 text-xs whitespace-nowrap">{p.companyName || p.supplierName || '—'}</td>
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center font-semibold text-gray-900 text-xs whitespace-nowrap">{p.warehouse || 'HILI'}</td>
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-gray-900 text-xs whitespace-nowrap font-medium">
                                            {prodStr}
                                        </td>
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-gray-900 text-xs whitespace-nowrap font-medium">
                                            {brandStr}
                                        </td>
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-right font-black text-gray-900 text-xs whitespace-nowrap">
                                            {pQty > 0 ? `${Math.round(pQty).toLocaleString('en-US')} kg` : '—'}
                                        </td>
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-right font-bold text-orange-600 text-xs whitespace-nowrap">
                                            {remQty > 0 ? `${Math.round(remQty).toLocaleString('en-US')} kg` : '0 kg'}
                                        </td>
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-right text-gray-900 text-xs whitespace-nowrap">
                                            {(() => {
                                                const rates = [];
                                                items.forEach(it => {
                                                    (it.brandEntries || [{ rate: it.rate || 0 }]).forEach(be => {
                                                        if (be.rate) rates.push(`৳${parseFloat(be.rate).toLocaleString('en-IN')}`);
                                                    });
                                                });
                                                return rates.length > 0 ? rates.join(', ') : '—';
                                            })()}
                                        </td>
                                        <td className="px-2 sm:px-2.5 py-2 text-right font-black text-gray-900 text-xs whitespace-nowrap">
                                            ৳{(parseFloat(p.totalAmount) || 0).toLocaleString('en-IN')}
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={11} className="py-8 text-center text-gray-500 italic text-sm whitespace-nowrap">
                                    No purchase records found for the selected criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    {records.length > 0 && (
                        <tfoot className="bg-gray-100 border-t-2 border-gray-900 font-black text-gray-900 text-xs">
                            <tr>
                                <td colSpan={7} className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center uppercase tracking-wider font-black whitespace-nowrap">
                                    Grand Total
                                </td>
                                <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-right font-black whitespace-nowrap">
                                    {Math.round(subTotalQty).toLocaleString('en-US')} kg
                                </td>
                                <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-right font-black text-orange-600 whitespace-nowrap">
                                    {Math.round(subTotalRemainQty).toLocaleString('en-US')} kg
                                </td>
                                <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 whitespace-nowrap"></td>
                                <td className="px-2 sm:px-2.5 py-2 text-right font-black whitespace-nowrap">
                                    ৳{Math.round(subTotalAmount).toLocaleString('en-IN')}
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        );
    };

    if (!isOpen) return null;
    if (typeof document === 'undefined' || !document.body) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 pt-10 sm:p-4 print:p-0 print:bg-white print:backdrop-none app-modal-overlay">
            <style>{`
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 6mm;
                    }
                    body {
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>
            <div className="bg-white w-full max-w-[96vw] 2xl:max-w-[1680px] max-h-[92vh] overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col print:max-h-none print:shadow-none print:rounded-none print:w-full print:h-auto">

                {/* Modal Header/Toolbar matching Stock Report (Hidden on Print) */}
                <div className="flex flex-row items-center justify-between px-3 sm:px-8 py-2.5 sm:py-4 border-b border-gray-100 print:hidden gap-1.5 sm:gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-shrink-0">
                        <div className="w-7 h-7 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-blue-50 rounded-lg sm:rounded-xl">
                            <BarChartIcon className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-blue-600" />
                        </div>
                        <h3 className="text-xs sm:text-lg lg:text-xl font-black text-gray-800 truncate leading-none">Purchase Report</h3>
                    </div>

                    {/* Quick Search Bar */}
                    <div className="hidden md:flex relative flex-1 max-w-sm mx-4 no-print">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Find purchase no, supplier or product..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-10 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold placeholder:font-normal"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-1 sm:gap-3 flex-shrink-0">
                        {/* Status Dropdown */}
                        <div className="relative group no-print">
                            <select
                                value={filters.status}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="appearance-none bg-white border border-gray-200 text-gray-700 py-1.5 sm:py-2.5 pl-2.5 sm:pl-4 pr-6 sm:pr-10 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer hover:border-gray-300"
                            >
                                <option value="All">All Purchases</option>
                                <option value="Accepted">Accepted</option>
                                <option value="Requested">Requested</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 sm:px-3 text-gray-400">
                                <svg className="fill-current h-3.5 w-3.5 sm:h-4 sm:w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                </svg>
                            </div>
                        </div>

                        {/* Filter Toggle Button */}
                        <div className="relative flex items-center">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-xl transition-all border ${
                                    showFilterPanel || hasActiveFilters
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                        : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30'
                                }`}
                            >
                                <FunnelIcon className={`w-3.5 h-3.5 sm:w-5 sm:h-5 ${showFilterPanel || hasActiveFilters ? 'text-white' : 'text-gray-400'}`} />
                            </button>

                            {/* Dropdown Filter Panel */}
                            {showFilterPanel && (
                                <>
                                    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[2005] md:hidden" onClick={() => setShowFilterPanel(false)} />
                                    <div
                                        ref={filterPanelRef}
                                        className="fixed inset-x-4 top-24 md:absolute md:top-full md:left-auto md:right-0 md:mt-2 w-auto md:w-[22rem] bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[2010] p-4 flex flex-col mb-4 animate-in fade-in zoom-in-95 duration-200"
                                    >
                                        <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-3 flex-shrink-0">
                                            <span className="text-xs font-bold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                                                <FunnelIcon className="w-3.5 h-3.5 text-blue-600" /> Advance Filter
                                            </span>
                                            <button
                                                onClick={resetFilters}
                                                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                                            >
                                                Reset
                                            </button>
                                        </div>

                                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                                            {/* Quick Range */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Quick Range</label>
                                                <div className="flex flex-wrap gap-1">
                                                    {['all', 'today', 'yesterday', 'weekly', 'monthly', 'yearly'].map(rng => (
                                                        <button
                                                            key={rng}
                                                            type="button"
                                                            onClick={() => handleQuickRange(rng)}
                                                            className={`px-2 py-0.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                                                                filters.quickRange === rng
                                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                            }`}
                                                        >
                                                            {rng}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Date Range */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">From Date</label>
                                                    <CustomDatePicker
                                                        value={filters.startDate}
                                                        onChange={(e) => {
                                                            handleFilterChange('startDate', e.target.value);
                                                            handleFilterChange('quickRange', 'custom');
                                                        }}
                                                        compact={true}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">To Date</label>
                                                    <CustomDatePicker
                                                        value={filters.endDate}
                                                        onChange={(e) => {
                                                            handleFilterChange('endDate', e.target.value);
                                                            handleFilterChange('quickRange', 'custom');
                                                        }}
                                                        compact={true}
                                                        rightAlign={true}
                                                    />
                                                </div>
                                            </div>

                                            {/* Warehouse */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Warehouse</label>
                                                <select
                                                    value={filters.warehouse}
                                                    onChange={(e) => handleFilterChange('warehouse', e.target.value)}
                                                    className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-gray-800"
                                                >
                                                    <option value="">All Warehouses</option>
                                                    {uniqueWarehouses.map(w => (
                                                        <option key={w} value={w}>{w}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Supplier / Company */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Supplier / Company</label>
                                                <select
                                                    value={filters.companyName}
                                                    onChange={(e) => handleFilterChange('companyName', e.target.value)}
                                                    className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-gray-800"
                                                >
                                                    <option value="">All Suppliers / Companies</option>
                                                    {uniqueSuppliers.map(s => (
                                                        <option key={s} value={s}>{s}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Product */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Product</label>
                                                <select
                                                    value={filters.productName}
                                                    onChange={(e) => {
                                                        handleFilterChange('productName', e.target.value);
                                                        handleFilterChange('brand', '');
                                                    }}
                                                    className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-gray-800"
                                                >
                                                    <option value="">All Products</option>
                                                    {uniqueProducts.map(p => (
                                                        <option key={p} value={p}>{p}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Brand */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Brand</label>
                                                <select
                                                    value={filters.brand}
                                                    onChange={(e) => handleFilterChange('brand', e.target.value)}
                                                    className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-gray-800"
                                                >
                                                    <option value="">All Brands</option>
                                                    {uniqueBrands.map(b => (
                                                        <option key={b} value={b}>{b}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setShowFilterPanel(false)}
                                            className="w-full py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all mt-3 flex-shrink-0 active:scale-[0.98]"
                                        >
                                            APPLY FILTERS
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Print / Export Report Modal Button */}
                        <button
                            onClick={() => setShowReportFormatModal(true)}
                            className="w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg sm:rounded-xl shadow-lg shadow-blue-500/30 transition-all no-print"
                            title="Print / Export Report"
                        >
                            <PrinterIcon className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                        </button>

                        {/* Close Modal Button */}
                        <button
                            onClick={onClose}
                            className="w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg sm:rounded-xl transition-colors no-print"
                        >
                            <XIcon className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Printable Content matching Stock Report exactly */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10 print:p-4 print:overflow-visible bg-white">
                    <div className="w-full max-w-[1620px] mx-auto space-y-6 sm:space-y-8 print:max-w-none">

                        {/* Header matching PDF & Stock Report layout */}
                        <div className="flex justify-between items-center pb-1">
                            {/* Left: Logo & Company Name */}
                            <div className="flex items-center gap-3">
                                <img src="/logo.png" alt="ANI Enterprise Logo" className="w-12 h-12 sm:w-14 sm:h-14 object-contain flex-shrink-0" />
                                <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ fontFamily: "'Fraunces', serif", color: '#f97316', textShadow: '1px 2px 4px rgba(0, 0, 0, 0.15)' }}>
                                    ANI ENTERPRISE
                                </h1>
                            </div>

                            {/* Right: Address Info */}
                            <div className="text-right text-[11px] sm:text-[12px] text-gray-700 leading-tight">
                                <p className="font-semibold text-gray-800">766, H.M Tower, Level-06</p>
                                <p>Borogola, Bogura, Bangladesh</p>
                                <p>Tel: +8802588813057</p>
                                <p>Email: anienterprise051@gmail.com</p>
                            </div>
                        </div>

                        {/* Orange Divider Line */}
                        <div className="border-t-2 border-[#f97316] w-full mt-3"></div>

                        {/* Centered Title Badge */}
                        <div className="flex justify-center -mt-5">
                            <div className="bg-[#f97316] text-white px-8 py-1 rounded shadow-sm">
                                <h2 className="text-xs sm:text-sm font-bold tracking-wider uppercase">PURCHASE REPORT</h2>
                            </div>
                        </div>

                        {/* Filter Info Row */}
                        <div className="flex justify-between items-end text-[14px] text-gray-800 pt-6 px-2">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex">
                                    <span className="font-bold text-gray-900 w-28">Date Range:</span>
                                    <span className="text-gray-900">{formatDate(filters.startDate) === '-' ? 'Start' : formatDate(filters.startDate)} to {formatDate(filters.endDate) === '-' ? 'Present' : formatDate(filters.endDate)}</span>
                                </div>
                                {filters.warehouse && filters.warehouse !== 'All' && filters.warehouse !== 'All Warehouses' && (
                                    <div className="flex">
                                        <span className="font-bold text-gray-900 w-28">Warehouse:</span>
                                        <span className="text-blue-700 font-extrabold">{filters.warehouse}</span>
                                    </div>
                                )}
                                {(filters.companyName || filters.supplierName) && (
                                    <div className="flex">
                                        <span className="font-bold text-gray-900 w-28">Supplier:</span>
                                        <span className="text-gray-900">{filters.companyName || filters.supplierName}</span>
                                    </div>
                                )}
                                {filters.productName && (
                                    <div className="flex">
                                        <span className="font-bold text-gray-900 w-28">Product:</span>
                                        <span className="text-gray-900">{filters.productName}</span>
                                    </div>
                                )}
                                {filters.brand && (
                                    <div className="flex">
                                        <span className="font-bold text-gray-900 w-28">Brand:</span>
                                        <span className="text-gray-900">{filters.brand}</span>
                                    </div>
                                )}
                            </div>
                            <div className="font-bold">
                                <span className="text-gray-900">Printed on:</span> <span className="text-gray-900">{formatDate(new Date().toISOString().split('T')[0])}</span>
                            </div>
                        </div>

                        {/* Data Table */}
                        <div className="pt-2">
                            {renderPurchaseTable(filteredPurchases)}
                        </div>

                        {/* Summary Cards Section matching Stock Report style below the table */}
                        <div className="space-y-4 pt-6 px-2 print:pt-4">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 print:grid-cols-4">
                                {/* Card 1: TOTAL PURCHASES */}
                                <div className="border border-gray-200 rounded-2xl bg-gray-50 shadow-sm print:border-gray-200 p-4 flex flex-col justify-between items-center text-center gap-2 min-h-[140px] sm:min-h-[150px] w-full">
                                    <div className="flex flex-col items-center gap-1 w-full">
                                        <div className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Purchases</div>
                                        <div className="text-xs sm:text-sm font-bold text-gray-700 w-full break-words">
                                            RECORDS: {filteredPurchases.length}
                                        </div>
                                    </div>
                                    <div className="w-full border-t border-gray-200"></div>
                                    <div className="flex flex-col items-center justify-center w-full">
                                        <div className="text-lg sm:text-xl font-black text-gray-900 w-full break-words">
                                            ৳ {Math.round(stats.totalAmount).toLocaleString('en-IN')}
                                        </div>
                                    </div>
                                </div>

                                {/* Card 2: TOTAL QUANTITY */}
                                <div className="border border-gray-200 rounded-2xl bg-gray-50 shadow-sm print:border-gray-200 p-4 flex flex-col justify-between items-center text-center gap-2 min-h-[140px] sm:min-h-[150px] w-full">
                                    <div className="flex flex-col items-center gap-1 w-full">
                                        <div className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Quantity</div>
                                        <div className="text-xs sm:text-sm font-bold text-gray-700 w-full break-words">
                                            REMAIN: {Math.round(stats.totalRemainingQty).toLocaleString('en-US')} kg
                                        </div>
                                    </div>
                                    <div className="w-full border-t border-gray-200"></div>
                                    <div className="flex flex-col items-center justify-center w-full">
                                        <div className="text-lg sm:text-xl font-black text-gray-900 w-full break-words">
                                            {Math.round(stats.totalQty).toLocaleString('en-US')} kg
                                        </div>
                                    </div>
                                </div>

                                {/* Card 3: RECEIVED QUANTITY */}
                                <div className="border border-gray-200 rounded-2xl bg-gray-50 shadow-sm print:border-gray-200 p-4 flex flex-col justify-between items-center text-center gap-2 min-h-[140px] sm:min-h-[150px] w-full">
                                    <div className="flex flex-col items-center gap-1 w-full">
                                        <div className="text-[10px] sm:text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Received Quantity</div>
                                        <div className="text-xs sm:text-sm font-bold text-gray-700 w-full break-words">
                                            IN-HOUSE RECEIVED
                                        </div>
                                    </div>
                                    <div className="w-full border-t border-gray-200"></div>
                                    <div className="flex flex-col items-center justify-center w-full">
                                        <div className="text-lg sm:text-xl font-black text-emerald-600 w-full break-words">
                                            {Math.round(Math.max(0, stats.totalQty - stats.totalRemainingQty)).toLocaleString('en-US')} kg
                                        </div>
                                    </div>
                                </div>

                                {/* Card 4: REMAINING QUANTITY */}
                                <div className="border-2 border-orange-500 rounded-2xl bg-white shadow-md print:border-orange-500 p-4 flex flex-col justify-between items-center text-center gap-2 min-h-[140px] sm:min-h-[150px] w-full">
                                    <div className="flex flex-col items-center gap-1 w-full">
                                        <div className="text-[10px] sm:text-[11px] font-bold text-orange-500 uppercase tracking-wider">Remaining Quantity</div>
                                        <div className="text-xs sm:text-sm font-bold text-gray-700 w-full break-words">
                                            PENDING IN-HOUSE
                                        </div>
                                    </div>
                                    <div className="w-full border-t border-orange-100"></div>
                                    <div className="flex flex-col items-center justify-center w-full">
                                        <div className="text-lg sm:text-xl font-black text-orange-600 w-full break-words">
                                            {Math.round(stats.totalRemainingQty).toLocaleString('en-US')} kg
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Signatures matching Stock Report */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 pt-12 sm:pt-20 px-4 pb-10 print:grid-cols-3 print:pt-20 print:gap-8">
                                <div className="text-center sm:text-left"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Prepared By</div></div>
                                <div className="text-center"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase text-center">Verified By</div></div>
                                <div className="text-center sm:text-right"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Authorized Signature</div></div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Export Format Selection Modal */}
            <ReportFormatModal
                isOpen={showReportFormatModal}
                onClose={() => setShowReportFormatModal(false)}
                title="Purchase Report"
                subtitle="Select your preferred export format for the filtered purchase report"
                onExportPdf={handleExportPdf}
                onExportExcel={handleExportExcel}
            />
        </div>,
        document.body
    );
};

export default PurchaseReport;
