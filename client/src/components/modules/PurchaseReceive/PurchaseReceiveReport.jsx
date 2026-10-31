import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { queryClient } from '../../../utils/queryClient';
import { XIcon, BarChartIcon, PrinterIcon, FunnelIcon, SearchIcon, ChevronDownIcon, CheckIcon } from '../../Icons';
import { formatDate } from '../../../utils/helpers';
import { generatePurchaseReceiveReportPDF } from '../../../utils/pdfGenerator';
import { generatePurchaseReceiveReportExcel } from '../../../utils/excelGenerator';
import ReportFormatModal from '../../shared/ReportFormatModal';
import CustomDatePicker from '../../shared/CustomDatePicker';

const PurchaseReceiveReport = ({
    isOpen,
    onClose,
    purchaseReceives = [],
    productsList = [],
    warehousesList = ['HILI', 'DINAJPUR', 'CHATTOGRAM', 'DHAKA'],
    initialFilters = {},
    purchasesList = []
}) => {
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showReportFormatModal, setShowReportFormatModal] = useState(false);
    const [expandedReportCardId, setExpandedReportCardId] = useState(null);

    const toggleReportCard = (id) => {
        setExpandedReportCardId(prev => (prev === id ? null : id));
    };

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
                status: initialFilters.status || 'All'
            }));
            setSearchQuery('');
            setShowFilterPanel(false);
            setFilterDropdownOpen(null);
            setStatusDropdownOpen(false);
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
        return [...new Set(purchaseReceives.map(p => p.companyName || p.supplierName).filter(Boolean))].sort();
    }, [purchaseReceives]);

    const uniqueWarehouses = useMemo(() => {
        const fromData = purchaseReceives.map(p => p.warehouse).filter(Boolean);
        return [...new Set([...warehousesList, ...fromData])].sort();
    }, [purchaseReceives, warehousesList]);

    const uniqueProducts = useMemo(() => {
        const list = new Set();
        purchaseReceives.forEach(p => {
            (p.items || []).forEach(it => {
                const name = it.productName || it.product;
                if (name) list.add(name);
            });
        });
        (productsList || []).forEach(p => {
            const name = typeof p === 'string' ? p : (p.name || p.productName || '');
            if (name) list.add(name);
        });
        return [...list].sort();
    }, [purchaseReceives, productsList]);

    const uniqueBrands = useMemo(() => {
        const list = new Set();
        purchaseReceives.forEach(p => {
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
    }, [purchaseReceives, filters.productName]);

    const getPurchaseBrandEntries = (purchase) => {
        const results = [];
        (purchase.items || []).forEach(item => {
            const pName = item.productName || item.product || '';
            const bEntries = item.brandEntries && item.brandEntries.length > 0
                ? item.brandEntries
                : [{ brand: item.brand || '', qty: item.qty || 0, rate: item.rate || item.purchasedPrice || 0, sweepedQuantity: item.sweepedQuantity || item.swpQty || 0, inHouseQuantity: item.inHouseQuantity, total: item.total }];

            bEntries.forEach(be => {
                const arrQty = parseFloat(be.qty) || 0;
                const swpQty = parseFloat(be.sweepedQuantity || be.swpQty) || 0;
                const ihQty = be.inHouseQuantity !== undefined && be.inHouseQuantity !== '' ? parseFloat(be.inHouseQuantity) : Math.max(0, arrQty - swpQty);

                results.push({
                    productName: pName,
                    brand: be.brand || '—',
                    qty: arrQty,
                    swpQty: swpQty,
                    inHouseQty: ihQty,
                    rate: parseFloat(be.rate) || 0,
                    total: be.total !== undefined ? parseFloat(be.total) : (ihQty * (parseFloat(be.rate) || 0))
                });
            });
        });
        return results.length > 0 ? results : [{ productName: '—', brand: '—', qty: 0, swpQty: 0, inHouseQty: 0, rate: 0, total: 0 }];
    };

    const getPRTotals = (p) => {
        const entries = getPurchaseBrandEntries(p);
        let calculatedTotal = 0;
        entries.forEach(e => {
            calculatedTotal += (e.total ? parseFloat(e.total) : (parseFloat(e.inHouseQty || 0) * parseFloat(e.rate || 0)));
        });

        const totalAmount = (p.totalAmount !== undefined && p.totalAmount !== null && parseFloat(p.totalAmount) > 0)
            ? parseFloat(p.totalAmount)
            : calculatedTotal;

        const paidAmount = parseFloat(p.paidAmount ?? p.paid ?? 0);
        const discount = parseFloat(p.discount || 0);

        const dueAmount = (p.dueAmount !== undefined && p.dueAmount !== null && parseFloat(p.dueAmount) > 0)
            ? parseFloat(p.dueAmount)
            : Math.max(0, totalAmount - paidAmount - discount);

        return { totalAmount, paidAmount, dueAmount, discount };
    };

    // Filter dataset
    const filteredPurchaseReceives = useMemo(() => {
        return purchaseReceives.filter(p => {
            // Status filter
            if (filters.status && filters.status !== 'All') {
                const pStatus = (p.status || 'Accepted').toLowerCase();
                if (pStatus !== filters.status.toLowerCase()) return false;
            }

            // Date Range
            const pDate = p.date ? p.date.split('T')[0] : '';
            if (filters.startDate && pDate && pDate < filters.startDate) return false;
            if (filters.endDate && pDate && pDate > filters.endDate) return false;

            // Warehouse
            if (filters.warehouse && filters.warehouse !== 'All' && filters.warehouse !== 'All Warehouses') {
                const wh = (p.warehouse || 'HILI').toLowerCase();
                if (wh !== filters.warehouse.toLowerCase()) return false;
            }

            // Supplier
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
                const pNo = (p.purchaseReceiveNo || p.purchaseNo || '').toLowerCase();
                const comp = (p.companyName || p.supplierName || '').toLowerCase();
                const lc = (p.lcNo || '').toLowerCase();
                const ch = (p.challanNo || '').toLowerCase();
                const wh = (p.warehouse || '').toLowerCase();
                const itemsStr = (p.items || []).map(i => `${i.productName || ''} ${(i.brandEntries || []).map(b => b.brand).join(' ')}`).join(' ').toLowerCase();

                const matched = pNo.includes(q) || comp.includes(q) || lc.includes(q) || ch.includes(q) || wh.includes(q) || itemsStr.includes(q);
                if (!matched) return false;
            }

            return true;
        }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }, [purchaseReceives, filters, searchQuery]);

    // Statistics
    const stats = useMemo(() => {
        let totalArrivalQty = 0;
        let totalSwpQty = 0;
        let totalInHouseQty = 0;
        let totalAmount = 0;
        let totalPaid = 0;
        let totalDue = 0;

        filteredPurchaseReceives.forEach(p => {
            const entries = getPurchaseBrandEntries(p);
            entries.forEach(e => {
                totalArrivalQty += parseFloat(e.qty) || 0;
                totalSwpQty += parseFloat(e.swpQty) || 0;
                totalInHouseQty += parseFloat(e.inHouseQty) || 0;
            });
            const t = getPRTotals(p);
            totalAmount += t.totalAmount;
            totalPaid += t.paidAmount;
            totalDue += t.dueAmount;
        });

        return {
            totalArrivalQty,
            totalSwpQty,
            totalInHouseQty,
            totalAmount,
            totalPaid,
            totalDue,
            totalRecords: filteredPurchaseReceives.length
        };
    }, [filteredPurchaseReceives]);

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
        await generatePurchaseReceiveReportPDF(filteredPurchaseReceives, filters, dateStr);
    };

    const handleExportExcel = () => {
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        generatePurchaseReceiveReportExcel(filteredPurchaseReceives, filters, dateStr);
    };

    const renderPurchaseReceiveTable = (records) => {
        return (
            <>
                {/* Desktop / Print Table */}
                <div className="hidden md:block print:block overflow-x-auto border border-gray-900">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-900 text-gray-900">
                                <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap w-10">SL</th>
                                <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">Date</th>
                                <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">Receipt No</th>
                                <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Supplier / Company</th>
                                <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">Warehouse</th>
                                <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Product</th>
                                <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Brand</th>
                                <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap">Arrival Qty</th>
                                <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap">SWP Qty</th>
                                <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap">InHouse Qty</th>
                                <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap">Price</th>
                                <th className="px-2 sm:px-2.5 py-2 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap">Total Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-900">
                            {records.length > 0 ? (
                                records.map((p, idx) => {
                                    const entries = getPurchaseBrandEntries(p);
                                    const t = getPRTotals(p);

                                    return (
                                        <tr key={p._id || idx} className="hover:bg-blue-50/20 text-gray-900 text-xs sm:text-[13px] transition-colors">
                                            <td className="border-r border-gray-900 px-2 py-2 text-center font-medium">{idx + 1}</td>
                                            <td className="border-r border-gray-900 px-2 py-2 text-center whitespace-nowrap font-medium text-gray-600">
                                                {formatDate(p.date)}
                                            </td>
                                            <td className="border-r border-gray-900 px-2 py-2 text-center font-bold text-blue-600 whitespace-nowrap">
                                                {p.purchaseReceiveNo || p.purchaseNo || '—'}
                                            </td>
                                            <td className="border-r border-gray-900 px-2.5 py-2 font-bold text-gray-900">
                                                {p.companyName || p.supplierName || '—'}
                                            </td>
                                            <td className="border-r border-gray-900 px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">
                                                {p.warehouse || 'HILI'}
                                            </td>
                                            <td className="border-r border-gray-900 px-2.5 py-2 font-semibold text-gray-900">
                                                <div className="space-y-0.5">
                                                    {entries.map((e, eIdx) => (
                                                        <div key={eIdx}>{e.productName}</div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="border-r border-gray-900 px-2.5 py-2 text-gray-700 font-medium">
                                                <div className="space-y-0.5">
                                                    {entries.map((e, eIdx) => (
                                                        <div key={eIdx}>{e.brand}</div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="border-r border-gray-900 px-2 py-2 text-right font-bold text-blue-600 whitespace-nowrap">
                                                <div className="space-y-0.5">
                                                    {entries.map((e, eIdx) => (
                                                        <div key={eIdx}>{e.qty ? Math.round(e.qty).toLocaleString('en-US') + ' kg' : '—'}</div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="border-r border-gray-900 px-2 py-2 text-right font-bold text-rose-600 whitespace-nowrap">
                                                <div className="space-y-0.5">
                                                    {entries.map((e, eIdx) => (
                                                        <div key={eIdx}>{e.swpQty ? Math.round(e.swpQty).toLocaleString('en-US') + ' kg' : '0 kg'}</div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="border-r border-gray-900 px-2 py-2 text-right font-bold text-emerald-600 whitespace-nowrap">
                                                <div className="space-y-0.5">
                                                    {entries.map((e, eIdx) => (
                                                        <div key={eIdx}>{e.inHouseQty ? Math.round(e.inHouseQty).toLocaleString('en-US') + ' kg' : '0 kg'}</div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="border-r border-gray-900 px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">
                                                <div className="space-y-0.5">
                                                    {entries.map((e, eIdx) => (
                                                        <div key={eIdx}>৳ {e.rate ? e.rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 text-right font-black text-gray-900 whitespace-nowrap">
                                                ৳ {Math.round(t.totalAmount).toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={12} className="px-4 py-8 text-center text-gray-500 italic text-[14px]">
                                        No purchase receive records found matching your filter criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {records.length > 0 && (
                            <tfoot>
                                <tr className="bg-gray-100/80 font-black text-gray-900 border-t-2 border-gray-900 text-xs sm:text-[13px]">
                                    <td colSpan={7} className="border-r border-gray-900 px-3 py-2 text-center uppercase tracking-wider">
                                        Grand Total
                                    </td>
                                    <td className="border-r border-gray-900 px-2 py-2 text-right text-blue-700 font-black whitespace-nowrap">
                                        {Math.round(stats.totalArrivalQty).toLocaleString('en-US')} kg
                                    </td>
                                    <td className="border-r border-gray-900 px-2 py-2 text-right text-rose-700 font-black whitespace-nowrap">
                                        {Math.round(stats.totalSwpQty).toLocaleString('en-US')} kg
                                    </td>
                                    <td className="border-r border-gray-900 px-2 py-2 text-right text-emerald-700 font-black whitespace-nowrap">
                                        {Math.round(stats.totalInHouseQty).toLocaleString('en-US')} kg
                                    </td>
                                    <td className="border-r border-gray-900 px-2 py-2 text-right text-gray-400">
                                        —
                                    </td>
                                    <td className="px-2 py-2 text-right text-gray-900 font-black whitespace-nowrap">
                                        ৳ {Math.round(stats.totalAmount).toLocaleString('en-IN')}
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
                            const entries = getPurchaseBrandEntries(p);
                            const t = getPRTotals(p);

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
                                                {p.purchaseReceiveNo || p.purchaseNo || '—'}
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
                                                    ৳{Math.round(t.totalAmount).toLocaleString('en-IN')}
                                                </div>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="bg-gray-50/70 rounded-xl p-2.5 border border-gray-100 space-y-2 text-xs animate-in slide-in-from-top-2 duration-200" onClick={(e) => e.stopPropagation()}>
                                                {entries.map((e, eIdx) => (
                                                    <div key={eIdx} className={`${eIdx > 0 ? 'pt-2 border-t border-gray-200/60' : ''} space-y-1`}>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500 font-medium">Product:</span>
                                                            <span className="font-bold text-gray-800 text-right">{e.productName}</span>
                                                        </div>
                                                        {e.brand && e.brand !== '—' && (
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-500 font-medium">Brand:</span>
                                                                <span className="font-semibold text-gray-700">{e.brand}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Arrival: <strong className="text-blue-600">{e.qty ? `${Math.round(e.qty).toLocaleString('en-US')} kg` : '—'}</strong></span>
                                                            {e.swpQty > 0 && <span className="text-gray-500">SWP: <strong className="text-rose-600">{`${Math.round(e.swpQty).toLocaleString('en-US')} kg`}</strong></span>}
                                                            <span className="text-gray-500">InHouse: <strong className="text-emerald-600">{`${Math.round(e.inHouseQty || 0).toLocaleString('en-US')} kg`}</strong></span>
                                                        </div>
                                                        {e.rate > 0 && (
                                                            <div className="flex justify-between pt-0.5 text-[11px] text-gray-500">
                                                                <span>Rate: ৳{e.rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="py-8 text-center text-gray-500 italic text-sm bg-gray-50 rounded-2xl border border-gray-200">
                            No purchase receive records found matching your filter criteria.
                        </div>
                    )}

                    {records.length > 0 && (
                        <div className="bg-gray-900 text-white rounded-2xl p-4 shadow-xl flex justify-between items-center">
                            <div>
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Grand Total</div>
                                <div className="text-xs text-gray-400">{records.length} Receives • {Math.round(stats.totalArrivalQty).toLocaleString('en-US')} kg Arrived</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-gray-400">Total Amount</div>
                                <div className="text-lg font-black text-white">৳ {Math.round(stats.totalAmount).toLocaleString('en-IN')}</div>
                            </div>
                        </div>
                    )}
                </div>
            </>
        );
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-[96vw] 2xl:max-w-[1680px] h-[94vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
                {/* Header Controls */}
                <div className="p-2.5 sm:p-4 border-b border-gray-100 flex flex-col gap-2 flex-shrink-0 bg-white no-print">
                    {/* Top Row: Title on Left, The Three Buttons (Filter, Print, Close) ALWAYS UP on Right */}
                    <div className="flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <BarChartIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-xs sm:text-base lg:text-lg font-bold text-gray-900 truncate">Purchase Receive Report</h2>
                                <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium truncate">
                                    {filters.startDate || filters.endDate ? (
                                        <span>
                                            {formatDate(filters.startDate) === '-' ? 'Start' : formatDate(filters.startDate)} — {formatDate(filters.endDate) === '-' ? 'Present' : formatDate(filters.endDate)}
                                        </span>
                                    ) : (
                                        'All Dates'
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Search on Desktop */}
                        <div className="hidden md:flex relative flex-1 max-w-sm mx-4">
                            <input
                                type="text"
                                placeholder="Search receipt, company, product..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 sm:py-2 bg-gray-50/70 border border-gray-200 rounded-lg sm:rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                            />
                            <SearchIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                >
                                    <XIcon className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Right Buttons: Desktop Status Dropdown + The Three Buttons ALWAYS UP */}
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                            {/* Status Custom Dropdown (Desktop) */}
                            <div className="hidden md:block relative no-print" ref={statusDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                                className="h-7 sm:h-10 bg-white border border-gray-200 text-gray-700 px-2.5 sm:px-4 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-1.5 sm:gap-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:border-gray-300 shadow-sm"
                            >
                                <span>
                                    {filters.status === 'Accepted' ? 'Accepted' : filters.status === 'Requested' ? 'Requested' : 'All Receives'}
                                </span>
                                <ChevronDownIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 transition-transform duration-200 ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {statusDropdownOpen && (
                                <div className="absolute right-0 mt-1.5 w-36 sm:w-44 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                    {[
                                        { value: 'All', label: 'All Receives' },
                                        { value: 'Accepted', label: 'Accepted' },
                                        { value: 'Requested', label: 'Requested' }
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => {
                                                handleFilterChange('status', opt.value);
                                                setStatusDropdownOpen(false);
                                            }}
                                            className={`w-full px-3 sm:px-4 py-2 text-left text-xs sm:text-sm flex items-center justify-between transition-colors ${
                                                filters.status === opt.value
                                                    ? 'bg-blue-50 text-blue-700 font-bold'
                                                    : 'text-gray-700 hover:bg-gray-50 font-medium'
                                            }`}
                                        >
                                            <span>{opt.label}</span>
                                            {filters.status === opt.value && (
                                                <CheckIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                                            )}
                                        </button>
                                    ))}
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
                                            {/* Quick Range */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Quick Range</label>
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
                                                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">From Date</label>
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
                                                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">To Date</label>
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
                                placeholder="Search receipt, company..."
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
                                    {filters.status === 'Accepted' ? 'Accepted' : filters.status === 'Requested' ? 'Requested' : 'All'}
                                </span>
                                <ChevronDownIcon className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {statusDropdownOpen && (
                                <div className="absolute right-0 mt-1.5 w-32 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                    {[
                                        { value: 'All', label: 'All' },
                                        { value: 'Accepted', label: 'Accepted' },
                                        { value: 'Requested', label: 'Requested' }
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => {
                                                handleFilterChange('status', opt.value);
                                                setStatusDropdownOpen(false);
                                            }}
                                            className={`w-full px-2.5 py-1.5 text-left text-xs flex items-center justify-between transition-colors ${
                                                filters.status === opt.value
                                                    ? 'bg-blue-50 text-blue-700 font-bold'
                                                    : 'text-gray-700 hover:bg-gray-50 font-medium'
                                            }`}
                                        >
                                            <span>{opt.label}</span>
                                            {filters.status === opt.value && (
                                                <CheckIcon className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Printable Content matching Stock Report & Purchase Report layout */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10 print:p-4 print:overflow-visible bg-white">
                    <div className="w-full max-w-[1620px] mx-auto space-y-6 sm:space-y-8 print:max-w-none">

                        {/* Header */}
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
                                <h2 className="text-[11px] sm:text-sm font-bold tracking-wider uppercase text-center">PURCHASE RECEIVE REPORT</h2>
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
                            {renderPurchaseReceiveTable(filteredPurchaseReceives)}
                        </div>

                        {/* Summary Cards Section matching Stock Report & Purchase Report */}
                        <div className="space-y-4 pt-6 px-2 print:pt-4">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 print:grid-cols-4">
                                {/* Card 1: TOTAL PURCHASE RECEIVES */}
                                <div className="border border-gray-200 rounded-2xl bg-gray-50 shadow-sm print:border-gray-200 p-4 flex flex-col justify-between items-center text-center gap-2 min-h-[140px] sm:min-h-[150px] w-full">
                                    <div className="flex flex-col items-center gap-1 w-full">
                                        <div className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Purchase Receives</div>
                                        <div className="text-xs sm:text-sm font-bold text-gray-700 w-full break-words">
                                            RECORDS: {filteredPurchaseReceives.length}
                                        </div>
                                    </div>
                                    <div className="w-full border-t border-gray-200"></div>
                                    <div className="flex flex-col items-center justify-center w-full">
                                        <div className="text-lg sm:text-xl font-black text-gray-900 w-full break-words">
                                            ৳ {Math.round(stats.totalAmount).toLocaleString('en-IN')}
                                        </div>
                                    </div>
                                </div>

                                {/* Card 2: ARRIVAL QUANTITY */}
                                <div className="border border-gray-200 rounded-2xl bg-gray-50 shadow-sm print:border-gray-200 p-4 flex flex-col justify-between items-center text-center gap-2 min-h-[140px] sm:min-h-[150px] w-full">
                                    <div className="flex flex-col items-center gap-1 w-full">
                                        <div className="text-[10px] sm:text-[11px] font-bold text-blue-600 uppercase tracking-wider">Arrival Quantity</div>
                                        <div className="text-xs sm:text-sm font-bold text-gray-700 w-full break-words">
                                            TOTAL ARRIVED
                                        </div>
                                    </div>
                                    <div className="w-full border-t border-gray-200"></div>
                                    <div className="flex flex-col items-center justify-center w-full">
                                        <div className="text-lg sm:text-xl font-black text-blue-600 w-full break-words">
                                            {Math.round(stats.totalArrivalQty).toLocaleString('en-US')} kg
                                        </div>
                                    </div>
                                </div>

                                {/* Card 3: SWEEPED QUANTITY */}
                                <div className="border border-gray-200 rounded-2xl bg-gray-50 shadow-sm print:border-gray-200 p-4 flex flex-col justify-between items-center text-center gap-2 min-h-[140px] sm:min-h-[150px] w-full">
                                    <div className="flex flex-col items-center gap-1 w-full">
                                        <div className="text-[10px] sm:text-[11px] font-bold text-rose-600 uppercase tracking-wider">Sweeped Quantity</div>
                                        <div className="text-xs sm:text-sm font-bold text-gray-700 w-full break-words">
                                            TOTAL SWEEPED
                                        </div>
                                    </div>
                                    <div className="w-full border-t border-gray-200"></div>
                                    <div className="flex flex-col items-center justify-center w-full">
                                        <div className="text-lg sm:text-xl font-black text-rose-600 w-full break-words">
                                            {Math.round(stats.totalSwpQty).toLocaleString('en-US')} kg
                                        </div>
                                    </div>
                                </div>

                                {/* Card 4: IN-HOUSE QUANTITY */}
                                <div className="border-2 border-emerald-500 rounded-2xl bg-white shadow-md print:border-emerald-500 p-4 flex flex-col justify-between items-center text-center gap-2 min-h-[140px] sm:min-h-[150px] w-full">
                                    <div className="flex flex-col items-center gap-1 w-full">
                                        <div className="text-[10px] sm:text-[11px] font-bold text-emerald-600 uppercase tracking-wider">In-House Quantity</div>
                                        <div className="text-xs sm:text-sm font-bold text-gray-700 w-full break-words">
                                            NET RECEIVED
                                        </div>
                                    </div>
                                    <div className="w-full border-t border-emerald-100"></div>
                                    <div className="flex flex-col items-center justify-center w-full">
                                        <div className="text-lg sm:text-xl font-black text-emerald-600 w-full break-words">
                                            {Math.round(stats.totalInHouseQty).toLocaleString('en-US')} kg
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Signatures */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 pt-12 sm:pt-20 px-4 pb-10 print:grid-cols-3 print:pt-20 print:gap-8">
                                <div className="text-center sm:text-left"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Prepared By</div></div>
                                <div className="text-center"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase text-center">Verified By</div></div>
                                <div className="text-center sm:text-right"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Authorized Signature</div></div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Format Selection Modal */}
            {showReportFormatModal && (
                <ReportFormatModal
                    isOpen={showReportFormatModal}
                    onClose={() => setShowReportFormatModal(false)}
                    title="Export Purchase Receive Report"
                    subtitle="Select your preferred format to print or export purchase receive records"
                    onPrint={() => {
                        setShowReportFormatModal(false);
                        handlePrint();
                    }}
                    onExportPdf={() => {
                        setShowReportFormatModal(false);
                        handleExportPdf();
                    }}
                    onExportExcel={() => {
                        setShowReportFormatModal(false);
                        handleExportExcel();
                    }}
                />
            )}
        </div>,
        document.body
    );
};

export default PurchaseReceiveReport;
