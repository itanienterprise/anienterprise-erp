import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { queryClient } from '../../../utils/queryClient';
import { XIcon, BarChartIcon, PrinterIcon, FunnelIcon, SearchIcon, ChevronDownIcon, CheckIcon } from '../../Icons';
import { formatDate, calculatePurchaseRemainingQty } from '../../../utils/helpers';
import { generatePurchaseReportPDF } from '../../../utils/pdfGenerator';
import { generatePurchaseReportExcel } from '../../../utils/excelGenerator';
import ReportFormatModal from '../../shared/ReportFormatModal';
import CustomDatePicker from '../../shared/CustomDatePicker';

const normalizeReportStatus = (s) => {
    if (Array.isArray(s) && s.length > 0) {
        return s;
    }
    if (typeof s === 'string' && s) {
        return [s];
    }
    return ['all'];
};

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
    const [expandedReportCardId, setExpandedReportCardId] = useState(null);

    const toggleReportCard = (id) => {
        setExpandedReportCardId(prev => (prev === id ? null : id));
    };

    const [filters, setFilters] = useState(() => ({
        startDate: initialFilters.startDate || '',
        endDate: initialFilters.endDate || '',
        quickRange: initialFilters.quickRange || 'all',
        companyName: initialFilters.companyName || '',
        warehouse: initialFilters.warehouse || '',
        productName: initialFilters.productName || '',
        brand: initialFilters.brand || '',
        status: normalizeReportStatus(initialFilters.status)
    }));

    const [filterDropdownOpen, setFilterDropdownOpen] = useState(null);
    const [filterSearchInputs, setFilterSearchInputs] = useState({
        companyName: '',
        warehouse: '',
        productName: '',
        brand: ''
    });

    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const statusDropdownRef = useRef(null);
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
                status: normalizeReportStatus(initialFilters.status)
            }));
            setSearchQuery('');
            setShowFilterPanel(false);
        }
    }, [isOpen, initialFilters]);

    // Close on click outside filter panel and status dropdown
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e) => {
            if (
                filterPanelRef.current && !filterPanelRef.current.contains(e.target) &&
                filterButtonRef.current && !filterButtonRef.current.contains(e.target)
            ) {
                setShowFilterPanel(false);
                setFilterDropdownOpen(null);
            }
            if (
                statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)
            ) {
                setStatusDropdownOpen(false);
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

    const handleStatusToggle = (val) => {
        let nextStatuses;
        const current = Array.isArray(filters.status)
            ? filters.status
            : (filters.status ? [filters.status] : ['all']);

        if (val === 'all' || val === 'All') {
            nextStatuses = ['all'];
        } else {
            const lowerVal = val.toLowerCase();
            const cleanCurrent = current.map(s => String(s).toLowerCase());
            if (cleanCurrent.includes('all')) {
                nextStatuses = [val];
            } else {
                const idx = cleanCurrent.indexOf(lowerVal);
                if (idx !== -1) {
                    const filtered = current.filter((_, i) => i !== idx);
                    nextStatuses = filtered.length > 0 ? filtered : ['all'];
                } else {
                    nextStatuses = [...current, val];
                }
            }
        }
        setFilters(prev => ({ ...prev, status: nextStatuses }));
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
            status: ['all']
        });
        setFilterSearchInputs({
            companyName: '',
            warehouse: '',
            productName: '',
            brand: ''
        });
        setFilterDropdownOpen(null);
        setStatusDropdownOpen(false);
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

    const cachedPR = queryClient.getQueryData(['purchase-receives']);
    const effectivePRList = (purchaseReceivesList && purchaseReceivesList.length > 0)
        ? purchaseReceivesList
        : (Array.isArray(cachedPR) ? cachedPR : []);

    const computePurchaseStatus = (purchase) => {
        const rawStatus = (purchase?.status || '').toLowerCase();
        if (rawStatus === 'requested') return 'Requested';
        if (rawStatus === 'rejected') return 'Rejected';

        const { purchasedQty, remainingQty } = calculatePurchaseRemainingQty(purchase, effectivePRList);

        if (purchasedQty > 0 && remainingQty <= 0.001) {
            return 'Completed';
        } else if (purchasedQty > 0 && Math.abs(purchasedQty - remainingQty) <= 0.001) {
            return 'Accepted';
        } else {
            return 'Not Completed';
        }
    };

    // Filtered data
    const filteredPurchases = useMemo(() => {
        const isSearching = Boolean(searchQuery && searchQuery.trim());
        const q = isSearching ? searchQuery.toLowerCase().trim() : '';

        return purchases.filter(p => {
            const rawStatusLower = (p.status || 'Accepted').toLowerCase();
            if (rawStatusLower === 'rejected') return false;

            // Search query filter (when searching, date range and status filters are bypassed)
            if (isSearching) {
                const pNo = (p.purchaseNo || '').toLowerCase();
                const comp = (p.companyName || p.supplierName || '').toLowerCase();
                const lc = (p.lcNo || '').toLowerCase();
                const wh = (p.warehouse || '').toLowerCase();
                const itemsStr = (p.items || []).map(i => `${i.productName || ''} ${(i.brandEntries || []).map(b => b.brand).join(' ')}`).join(' ').toLowerCase();
                const computedStatus = computePurchaseStatus(p).toLowerCase();

                const matched = pNo.includes(q) || comp.includes(q) || lc.includes(q) || wh.includes(q) || itemsStr.includes(q) || computedStatus.includes(q);
                if (!matched) return false;

                // When searching, bypass date and status filters
                return true;
            }

            // Status filter (when NOT searching)
            const currentStatusList = Array.isArray(filters.status) ? filters.status : ['all'];
            const lowerCurrent = currentStatusList.map(s => String(s).toLowerCase());
            if (!lowerCurrent.includes('all')) {
                const actualStatus = computePurchaseStatus(p).toLowerCase();
                if (!lowerCurrent.includes(actualStatus)) return false;
            }

            // Date filtering (when NOT searching)
            const pDate = p.date ? p.date.split('T')[0] : '';
            if (filters.startDate && pDate && pDate < filters.startDate) return false;
            if (filters.endDate && pDate && pDate > filters.endDate) return false;

            // Warehouse
            if (filters.warehouse && filters.warehouse !== 'All' && filters.warehouse !== 'All Warehouses') {
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

            return true;
        }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }, [purchases, filters, searchQuery, effectivePRList]);

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
        filters.companyName || filters.warehouse || filters.productName || filters.brand
    );

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.startDate || filters.endDate || (filters.quickRange && filters.quickRange !== 'all')) count++;
        if (filters.companyName) count++;
        if (filters.warehouse && filters.warehouse !== 'All' && filters.warehouse !== 'All Warehouses') count++;
        if (filters.productName) count++;
        if (filters.brand) count++;
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
            <>
                {/* Desktop / Print Table */}
                <div className="hidden md:block print:block overflow-x-auto border border-gray-900">
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

                {/* Mobile Card View */}
                <div className="md:hidden print:hidden space-y-3">
                    {records.length > 0 ? (
                        records.map((p, idx) => {
                            const cardKey = p._id || idx;
                            const isExpanded = expandedReportCardId === cardKey;
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
                                <div
                                    key={cardKey}
                                    onClick={() => toggleReportCard(cardKey)}
                                    className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-200 cursor-pointer ${
                                        isExpanded ? 'border-blue-200 ring-2 ring-blue-500/10 shadow-md' : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <div className={`bg-gray-50/70 px-3.5 py-2.5 flex justify-between items-center gap-2 transition-colors ${isExpanded ? 'border-b border-gray-100 bg-blue-50/20' : ''}`}>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                                                #{idx + 1}
                                            </span>
                                            <span className="text-xs font-black text-blue-600 truncate">
                                                {p.purchaseNo || '—'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[11px] font-bold text-gray-500">
                                                {formatDate(p.date)}
                                            </span>
                                            <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-blue-600' : ''}`} />
                                        </div>
                                    </div>
                                    <div className="p-3.5 space-y-2">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-black text-gray-900 text-sm leading-tight truncate">
                                                    {p.companyName || p.supplierName || '—'}
                                                </h4>
                                                <div className="text-[11px] text-gray-500 mt-0.5">
                                                    Warehouse: <strong className="text-gray-700">{p.warehouse || 'HILI'}</strong>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-base font-black text-blue-600">
                                                    ৳{(parseFloat(p.totalAmount) || 0).toLocaleString('en-IN')}
                                                </div>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="bg-gray-50/70 rounded-xl p-2.5 border border-gray-100 space-y-1 text-xs animate-in slide-in-from-top-2 duration-200" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500 font-medium">Product:</span>
                                                    <span className="font-bold text-gray-800 text-right">{prodStr}</span>
                                                </div>
                                                {brandStr && brandStr !== '—' && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500 font-medium">Brand:</span>
                                                        <span className="font-semibold text-gray-700">{brandStr}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between pt-1 border-t border-gray-100">
                                                    <span className="text-gray-500">Qty: <strong className="text-gray-900">{pQty > 0 ? `${Math.round(pQty).toLocaleString('en-US')} kg` : '—'}</strong></span>
                                                    <span className="text-gray-500">Remaining: <strong className="text-orange-600">{remQty > 0 ? `${Math.round(remQty).toLocaleString('en-US')} kg` : '0 kg'}</strong></span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="py-8 text-center text-gray-500 italic text-sm bg-gray-50 rounded-2xl border border-gray-200">
                            No purchase records found for the selected criteria.
                        </div>
                    )}

                    {records.length > 0 && (
                        <div className="bg-gray-900 text-white rounded-2xl p-4 shadow-xl flex justify-between items-center">
                            <div>
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Grand Total</div>
                                <div className="text-xs text-gray-400">{records.length} Purchases • {Math.round(subTotalQty).toLocaleString('en-US')} kg</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xl font-black text-white">৳{Math.round(subTotalAmount).toLocaleString('en-IN')}</div>
                                <div className="text-[11px] text-orange-400 font-bold">Remain: {Math.round(subTotalRemainQty).toLocaleString('en-US')} kg</div>
                            </div>
                        </div>
                    )}
                </div>
            </>
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
                <div className="p-2.5 sm:p-4 border-b border-gray-100 flex flex-col gap-2 flex-shrink-0 bg-white no-print">
                    <div className="flex items-center justify-between gap-2 w-full">
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

                        <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-shrink-0">
                            {/* Status Custom Dropdown */}
                            <div className="hidden md:block relative no-print" ref={statusDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                                className="h-7 sm:h-10 bg-white border border-gray-200 text-gray-700 px-2.5 sm:px-4 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-1.5 sm:gap-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:border-gray-300 shadow-sm"
                            >
                                <span>
                                    {(() => {
                                        const current = Array.isArray(filters.status) ? filters.status : ['all'];
                                        const lower = current.map(s => String(s).toLowerCase());
                                        if (lower.includes('all') || lower.length === 0) return 'All Purchases';
                                        if (lower.length === 1) {
                                            const match = ['Accepted', 'Not Completed', 'Completed', 'Requested'].find(x => x.toLowerCase() === lower[0]);
                                            return match || current[0];
                                        }
                                        return `${current.length} Statuses`;
                                    })()}
                                </span>
                                <ChevronDownIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 transition-transform duration-200 ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {statusDropdownOpen && (
                                <div className="absolute right-0 mt-1.5 w-44 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                    {[
                                        { value: 'all', label: 'All Purchases' },
                                        { value: 'Accepted', label: 'Accepted' },
                                        { value: 'Not Completed', label: 'Not Completed' },
                                        { value: 'Completed', label: 'Completed' },
                                        { value: 'Requested', label: 'Requested' }
                                    ].map((opt) => {
                                        const current = Array.isArray(filters.status) ? filters.status : ['all'];
                                        const lower = current.map(s => String(s).toLowerCase());
                                        const isSelected = lower.includes(opt.value.toLowerCase());
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => {
                                                    handleStatusToggle(opt.value);
                                                }}
                                                className={`w-full px-3 sm:px-4 py-2 text-left text-xs sm:text-sm flex items-center justify-between transition-colors ${
                                                    isSelected
                                                        ? 'bg-blue-50 text-blue-700 font-bold'
                                                        : 'text-gray-700 hover:bg-gray-50 font-medium'
                                                }`}
                                            >
                                                <span>{opt.label}</span>
                                                {isSelected && (
                                                    <CheckIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
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
                                        className="fixed inset-x-4 top-24 md:absolute md:top-full md:left-auto md:right-0 md:mt-2 w-auto md:w-[24rem] bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.18)] z-[2010] p-4 flex flex-col mb-4 animate-in fade-in zoom-in-95 duration-200 overflow-visible text-left"
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

                                        <div className="space-y-3">
                                            {/* Status Filter */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Status</label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {[
                                                        {
                                                            label: 'All',
                                                            value: 'all',
                                                            activeCls: 'bg-gray-800 text-white shadow-md shadow-gray-700/30 font-bold',
                                                            inactiveCls: 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        },
                                                        {
                                                            label: 'Accepted',
                                                            value: 'Accepted',
                                                            dot: 'bg-green-500',
                                                            activeCls: 'bg-green-600 text-white shadow-md shadow-green-500/30 font-bold',
                                                            inactiveCls: 'bg-green-50 text-green-700 border border-green-200/60 hover:bg-green-100'
                                                        },
                                                        {
                                                            label: 'Not Completed',
                                                            value: 'Not Completed',
                                                            dot: 'bg-amber-500',
                                                            activeCls: 'bg-amber-500 text-white shadow-md shadow-amber-500/30 font-bold',
                                                            inactiveCls: 'bg-amber-50 text-amber-700 border border-amber-200/60 hover:bg-amber-100'
                                                        },
                                                        {
                                                            label: 'Completed',
                                                            value: 'Completed',
                                                            dot: 'bg-blue-500',
                                                            activeCls: 'bg-blue-600 text-white shadow-md shadow-blue-500/30 font-bold',
                                                            inactiveCls: 'bg-blue-50 text-blue-700 border border-blue-200/60 hover:bg-blue-100'
                                                        },
                                                        {
                                                            label: 'Requested',
                                                            value: 'Requested',
                                                            dot: 'bg-purple-500',
                                                            activeCls: 'bg-purple-600 text-white shadow-md shadow-purple-500/30 font-bold',
                                                            inactiveCls: 'bg-purple-50 text-purple-700 border border-purple-200/60 hover:bg-purple-100'
                                                        }
                                                    ].map((opt) => {
                                                        const currentList = Array.isArray(filters.status) ? filters.status : ['all'];
                                                        const lowerCurrent = currentList.map(s => String(s).toLowerCase());
                                                        const isSelected = lowerCurrent.includes(opt.value.toLowerCase());
                                                        return (
                                                            <button
                                                                key={opt.value}
                                                                type="button"
                                                                onClick={() => handleStatusToggle(opt.value)}
                                                                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                                                    isSelected ? opt.activeCls : opt.inactiveCls
                                                                }`}
                                                            >
                                                                {opt.dot && (
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : opt.dot}`} />
                                                                )}
                                                                {opt.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
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

                                            {/* Warehouse Custom Dropdown */}
                                            <div className={`space-y-1 relative ${filterDropdownOpen === 'warehouse' ? 'z-50' : 'z-40'}`}>
                                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Warehouse</label>
                                                <button
                                                    type="button"
                                                    onClick={() => setFilterDropdownOpen(filterDropdownOpen === 'warehouse' ? null : 'warehouse')}
                                                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-gray-50"
                                                >
                                                    <span className={`truncate ${filters.warehouse ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                                                        {filters.warehouse || 'All Warehouses'}
                                                    </span>
                                                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${filterDropdownOpen === 'warehouse' ? 'rotate-180' : ''}`} />
                                                </button>
                                                {filterDropdownOpen === 'warehouse' && (
                                                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 flex flex-col w-full overflow-hidden">
                                                        <div className="p-2 border-b border-gray-100 bg-white sticky top-0">
                                                            <div className="relative">
                                                                <SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Search warehouse..."
                                                                    value={filterSearchInputs.warehouse}
                                                                    onChange={(e) => setFilterSearchInputs(p => ({ ...p, warehouse: e.target.value }))}
                                                                    className="w-full pl-8 pr-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="overflow-y-auto max-h-44">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    handleFilterChange('warehouse', '');
                                                                    setFilterDropdownOpen(null);
                                                                }}
                                                                className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center justify-between ${!filters.warehouse ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'}`}
                                                            >
                                                                <span>All Warehouses</span>
                                                                {!filters.warehouse && <CheckIcon className="w-3.5 h-3.5 text-blue-600" />}
                                                            </button>
                                                            {uniqueWarehouses.filter(wh => wh.toLowerCase().includes((filterSearchInputs.warehouse || '').toLowerCase())).map(wh => (
                                                                <button
                                                                    key={wh}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleFilterChange('warehouse', wh);
                                                                        setFilterDropdownOpen(null);
                                                                    }}
                                                                    className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center justify-between ${filters.warehouse === wh ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'}`}
                                                                >
                                                                    <span className="truncate">{wh}</span>
                                                                    {filters.warehouse === wh && <CheckIcon className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Supplier / Company Custom Dropdown */}
                                            <div className={`space-y-1 relative ${filterDropdownOpen === 'company' ? 'z-50' : 'z-30'}`}>
                                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Supplier / Company</label>
                                                <button
                                                    type="button"
                                                    onClick={() => setFilterDropdownOpen(filterDropdownOpen === 'company' ? null : 'company')}
                                                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-gray-50"
                                                >
                                                    <span className={`truncate ${filters.companyName ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                                                        {filters.companyName || 'All Suppliers / Companies'}
                                                    </span>
                                                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${filterDropdownOpen === 'company' ? 'rotate-180' : ''}`} />
                                                </button>
                                                {filterDropdownOpen === 'company' && (
                                                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 flex flex-col w-full overflow-hidden">
                                                        <div className="p-2 border-b border-gray-100 bg-white sticky top-0">
                                                            <div className="relative">
                                                                <SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Search supplier..."
                                                                    value={filterSearchInputs.companyName}
                                                                    onChange={(e) => setFilterSearchInputs(p => ({ ...p, companyName: e.target.value }))}
                                                                    className="w-full pl-8 pr-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="overflow-y-auto max-h-44">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    handleFilterChange('companyName', '');
                                                                    setFilterDropdownOpen(null);
                                                                }}
                                                                className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center justify-between ${!filters.companyName ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'}`}
                                                            >
                                                                <span>All Suppliers / Companies</span>
                                                                {!filters.companyName && <CheckIcon className="w-3.5 h-3.5 text-blue-600" />}
                                                            </button>
                                                            {uniqueSuppliers.filter(s => s.toLowerCase().includes((filterSearchInputs.companyName || '').toLowerCase())).map(s => (
                                                                <button
                                                                    key={s}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleFilterChange('companyName', s);
                                                                        setFilterDropdownOpen(null);
                                                                    }}
                                                                    className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center justify-between ${filters.companyName === s ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'}`}
                                                                >
                                                                    <span className="truncate">{s}</span>
                                                                    {filters.companyName === s && <CheckIcon className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Product Custom Dropdown */}
                                            <div className={`space-y-1 relative ${filterDropdownOpen === 'product' ? 'z-50' : 'z-20'}`}>
                                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Product</label>
                                                <button
                                                    type="button"
                                                    onClick={() => setFilterDropdownOpen(filterDropdownOpen === 'product' ? null : 'product')}
                                                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-gray-50"
                                                >
                                                    <span className={`truncate ${filters.productName ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                                                        {filters.productName || 'All Products'}
                                                    </span>
                                                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${filterDropdownOpen === 'product' ? 'rotate-180' : ''}`} />
                                                </button>
                                                {filterDropdownOpen === 'product' && (
                                                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 flex flex-col w-full overflow-hidden">
                                                        <div className="p-2 border-b border-gray-100 bg-white sticky top-0">
                                                            <div className="relative">
                                                                <SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Search product..."
                                                                    value={filterSearchInputs.productName}
                                                                    onChange={(e) => setFilterSearchInputs(p => ({ ...p, productName: e.target.value }))}
                                                                    className="w-full pl-8 pr-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="overflow-y-auto max-h-44">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    handleFilterChange('productName', '');
                                                                    handleFilterChange('brand', '');
                                                                    setFilterDropdownOpen(null);
                                                                }}
                                                                className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center justify-between ${!filters.productName ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'}`}
                                                            >
                                                                <span>All Products</span>
                                                                {!filters.productName && <CheckIcon className="w-3.5 h-3.5 text-blue-600" />}
                                                            </button>
                                                            {uniqueProducts.filter(p => p.toLowerCase().includes((filterSearchInputs.productName || '').toLowerCase())).map(p => (
                                                                <button
                                                                    key={p}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleFilterChange('productName', p);
                                                                        handleFilterChange('brand', '');
                                                                        setFilterDropdownOpen(null);
                                                                    }}
                                                                    className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center justify-between ${filters.productName === p ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'}`}
                                                                >
                                                                    <span className="truncate">{p}</span>
                                                                    {filters.productName === p && <CheckIcon className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Brand Custom Dropdown */}
                                            <div className={`space-y-1 relative ${filterDropdownOpen === 'brand' ? 'z-50' : 'z-10'}`}>
                                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Brand</label>
                                                <button
                                                    type="button"
                                                    onClick={() => setFilterDropdownOpen(filterDropdownOpen === 'brand' ? null : 'brand')}
                                                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-gray-50"
                                                >
                                                    <span className={`truncate ${filters.brand ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                                                        {filters.brand || 'All Brands'}
                                                    </span>
                                                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${filterDropdownOpen === 'brand' ? 'rotate-180' : ''}`} />
                                                </button>
                                                {filterDropdownOpen === 'brand' && (
                                                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 flex flex-col w-full overflow-hidden">
                                                        <div className="p-2 border-b border-gray-100 bg-white sticky top-0">
                                                            <div className="relative">
                                                                <SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Search brand..."
                                                                    value={filterSearchInputs.brand}
                                                                    onChange={(e) => setFilterSearchInputs(p => ({ ...p, brand: e.target.value }))}
                                                                    className="w-full pl-8 pr-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="overflow-y-auto max-h-44">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    handleFilterChange('brand', '');
                                                                    setFilterDropdownOpen(null);
                                                                }}
                                                                className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center justify-between ${!filters.brand ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'}`}
                                                            >
                                                                <span>All Brands</span>
                                                                {!filters.brand && <CheckIcon className="w-3.5 h-3.5 text-blue-600" />}
                                                            </button>
                                                            {uniqueBrands.filter(b => b.toLowerCase().includes((filterSearchInputs.brand || '').toLowerCase())).map(b => (
                                                                <button
                                                                    key={b}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleFilterChange('brand', b);
                                                                        setFilterDropdownOpen(null);
                                                                    }}
                                                                    className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center justify-between ${filters.brand === b ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'}`}
                                                                >
                                                                    <span className="truncate">{b}</span>
                                                                    {filters.brand === b && <CheckIcon className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => {
                                                setShowFilterPanel(false);
                                                setFilterDropdownOpen(null);
                                            }}
                                            className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all mt-4 flex-shrink-0 active:scale-[0.98] shadow-md"
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

                    {/* Bottom Row on Mobile Only: Search & Status Dropdown */}
                    <div className="flex md:hidden items-center gap-2 pt-1.5 border-t border-gray-100 w-full">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Search purchase, company..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-7 pr-7 py-1.5 bg-gray-50/70 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                            />
                            <SearchIcon className="w-3 h-3 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600"
                                >
                                    <XIcon className="h-3 w-3" />
                                </button>
                            )}
                        </div>

                        {/* Mobile Status Selector */}
                        <div className="relative no-print shrink-0">
                            <button
                                type="button"
                                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                                className="h-7 bg-white border border-gray-200 text-gray-700 px-2 rounded-lg text-xs font-bold flex items-center justify-between gap-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:border-gray-300 shadow-sm"
                            >
                                <span>
                                    {(() => {
                                        const current = Array.isArray(filters.status) ? filters.status : ['all'];
                                        const lower = current.map(s => String(s).toLowerCase());
                                        if (lower.includes('all') || lower.length === 0) return 'All';
                                        if (lower.length === 1) {
                                            const match = ['Accepted', 'Not Completed', 'Completed', 'Requested'].find(x => x.toLowerCase() === lower[0]);
                                            return match || current[0];
                                        }
                                        return `${current.length} Stat.`;
                                    })()}
                                </span>
                                <ChevronDownIcon className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {statusDropdownOpen && (
                                <div className="absolute right-0 mt-1.5 w-36 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                    {[
                                        { value: 'all', label: 'All Purchases' },
                                        { value: 'Accepted', label: 'Accepted' },
                                        { value: 'Not Completed', label: 'Not Completed' },
                                        { value: 'Completed', label: 'Completed' },
                                        { value: 'Requested', label: 'Requested' }
                                    ].map((opt) => {
                                        const current = Array.isArray(filters.status) ? filters.status : ['all'];
                                        const lower = current.map(s => String(s).toLowerCase());
                                        const isSelected = lower.includes(opt.value.toLowerCase());
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => {
                                                    handleStatusToggle(opt.value);
                                                }}
                                                className={`w-full px-2.5 py-1.5 text-left text-xs flex items-center justify-between transition-colors ${
                                                    isSelected
                                                        ? 'bg-blue-50 text-blue-700 font-bold'
                                                        : 'text-gray-700 hover:bg-gray-50 font-medium'
                                                }`}
                                            >
                                                <span>{opt.label}</span>
                                                {isSelected && (
                                                    <CheckIcon className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Printable Content matching Stock Report exactly */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10 print:p-4 print:overflow-visible bg-white">
                    <div className="w-full max-w-[1620px] mx-auto space-y-6 sm:space-y-8 print:max-w-none">

                        {/* Header matching PDF & Stock Report layout */}
                        <div className="flex flex-col sm:flex-row print:!flex-row justify-between items-center gap-2 sm:gap-4 pb-1">
                            {/* Left: Logo & Company Name */}
                            <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
                                <img src="/logo.png" alt="ANI Enterprise Logo" className="w-10 h-10 sm:w-14 sm:h-14 object-contain flex-shrink-0" />
                                <h1 className="text-xl sm:text-3xl font-black tracking-tight" style={{ fontFamily: "'Fraunces', serif", color: '#f97316', textShadow: '1px 2px 4px rgba(0, 0, 0, 0.15)' }}>
                                    ANI ENTERPRISE
                                </h1>
                            </div>

                            {/* Right: Address Info */}
                            <div className="text-center sm:text-right print:!text-right text-[10px] sm:text-[12px] print:!text-[12px] text-gray-700 leading-tight">
                                <p className="font-semibold text-gray-800">766, H.M Tower, Level-06</p>
                                <p>Borogola, Bogura, Bangladesh</p>
                                <p>Tel: +8802588813057 • Email: anienterprise051@gmail.com</p>
                            </div>
                        </div>

                        {/* Orange Divider Line */}
                        <div className="border-t-2 border-[#f97316] w-full mt-2 sm:mt-3"></div>

                        {/* Centered Title Badge */}
                        <div className="flex justify-center -mt-4 sm:-mt-5">
                            <div className="bg-[#f97316] text-white px-4 sm:px-8 py-1 rounded shadow-sm">
                                <h2 className="text-[11px] sm:text-sm font-bold tracking-wider uppercase text-center">PURCHASE REPORT</h2>
                            </div>
                        </div>

                        {/* Filter Info Row */}
                        <div className="flex flex-col sm:flex-row print:!flex-row justify-between items-start sm:items-end print:!items-end gap-2 sm:gap-0 text-xs sm:text-[14px] print:!text-[14px] text-gray-800 pt-3 sm:pt-4 px-1 sm:px-2">
                            <div className="flex flex-col gap-1.5 w-full sm:w-auto">
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
                            <div className="font-bold text-left sm:text-right print:!text-right shrink-0">
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
