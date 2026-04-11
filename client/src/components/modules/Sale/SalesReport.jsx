import React, { useState, useEffect, useRef } from 'react';
import { SearchIcon, XIcon, BarChartIcon, FunnelIcon, PrinterIcon, ChevronDownIcon } from '../../Icons';
import CustomDatePicker from "../../shared/CustomDatePicker";
import { generateSalesReportPDF } from '../../../utils/pdfGenerator';
import { formatDate } from '../../../utils/helpers';

const SalesReport = ({
    isOpen,
    onClose,
    salesRecords = [],
    saleFilters,
    setSaleFilters,
    saleType = 'General'
}) => {
    if (!isOpen) return null;

    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [expandedRows, setExpandedRows] = useState([]);
    const [filterSearchInputs, setFilterSearchInputs] = useState({ companySearch: '', invoiceSearch: '', productSearch: '', brandSearch: '', portSearch: '', indCnfSearch: '', bdCnfSearch: '' });
    const [filterDropdownOpen, setFilterDropdownOpen] = useState({ company: false, invoice: false, product: false, brand: false, port: false, indCnf: false, bdCnf: false, from: false, to: false });
    const initialFilterDropdownState = { company: false, invoice: false, product: false, brand: false, port: false, indCnf: false, bdCnf: false, from: false, to: false };

    const filterButtonRef = useRef(null);
    const filterPanelRef = useRef(null);
    const companyFilterRef = useRef(null);
    const invoiceFilterRef = useRef(null);
    const productFilterRef = useRef(null);
    const brandFilterRef = useRef(null);
    const portFilterRef = useRef(null);
    const indCnfFilterRef = useRef(null);
    const bdCnfFilterRef = useRef(null);
    const fromDateFilterRef = useRef(null);
    const toDateFilterRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showFilterPanel && filterPanelRef.current && !filterPanelRef.current.contains(event.target) && !filterButtonRef.current.contains(event.target)) {
                setShowFilterPanel(false);
            }
            if (filterDropdownOpen.company && companyFilterRef.current && !companyFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, company: false }));
            if (filterDropdownOpen.invoice && invoiceFilterRef.current && !invoiceFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, invoice: false }));
            if (filterDropdownOpen.product && productFilterRef.current && !productFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, product: false }));
            if (filterDropdownOpen.brand && brandFilterRef.current && !brandFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, brand: false }));
            if (filterDropdownOpen.port && portFilterRef.current && !portFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, port: false }));
            if (filterDropdownOpen.indCnf && indCnfFilterRef.current && !indCnfFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, indCnf: false }));
            if (filterDropdownOpen.bdCnf && bdCnfFilterRef.current && !bdCnfFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, bdCnf: false }));
            if (filterDropdownOpen.from && fromDateFilterRef.current && !fromDateFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, from: false }));
            if (filterDropdownOpen.to && toDateFilterRef.current && !toDateFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, to: false }));
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                setShowFilterPanel(false);
                setFilterDropdownOpen(initialFilterDropdownState);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showFilterPanel, filterDropdownOpen]);

    // Scroll Lock when Modal or Filter Panel is active
    useEffect(() => {
        if (isOpen || showFilterPanel) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen, showFilterPanel]);

    const getUniqueOptions = (key) => {
        if (key === 'productName' || key === 'brandName') {
            const options = new Set();
            salesRecords.forEach(sale => {
                (sale.items || []).forEach(item => {
                    if (key === 'productName') {
                        const val = (item.productName || item.product || '').trim();
                        if (val) options.add(val);
                    } else if (key === 'brandName') {
                        (item.brandEntries || []).forEach(entry => {
                            const val = (entry.brandName || entry.brand || '').trim();
                            if (val) options.add(val);
                        });
                    }
                });
            });
            return [...options].sort();
        }
        return [...new Set(salesRecords.map(item => (item[key] || '').trim()).filter(Boolean))].sort();
    };

    // Calculate aggregated data for the report
    const filteredSales = salesRecords.filter(sale => {
        const saleDate = new Date(sale.date);
        const start = saleFilters.startDate ? new Date(saleFilters.startDate) : null;
        const end = saleFilters.endDate ? new Date(saleFilters.endDate) : null;

        if (start && saleDate < start) return false;
        if (end && saleDate > end) return false;
        if (saleFilters.companyName && (sale.companyName || sale.customerName) !== saleFilters.companyName) return false;
        if (saleFilters.invoiceNo && sale.invoiceNo !== saleFilters.invoiceNo) return false;

        // Border Specific Filters
        if (saleType === 'Border') {
            if (saleFilters.port && sale.port !== saleFilters.port) return false;
            if (saleFilters.indCnf && sale.indianCnF !== saleFilters.indCnf) return false;
            if (saleFilters.bdCnf && sale.bdCnf !== saleFilters.bdCnf) return false;
        }

        // Product & Brand Filtering
        if (saleFilters.productName || saleFilters.brandName) {
            const items = sale.items || [];
            const matches = items.some(item => {
                const pName = (item.productName || item.product || '');
                const pMatch = !saleFilters.productName || pName === saleFilters.productName;

                if (!pMatch) return false;

                if (saleFilters.brandName) {
                    return (item.brandEntries || []).some(entry => (entry.brandName || entry.brand) === saleFilters.brandName);
                }
                return true;
            });
            if (!matches) return false;
        }

        return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    const summary = {
        totalQty: filteredSales.reduce((sum, sale) => {
            const items = sale.items || [];
            const itemQtyTotal = items.reduce((iSum, item) => {
                const brandEntries = item.brandEntries || [];
                if (brandEntries.length > 0) {
                    return iSum + brandEntries.reduce((bSum, entry) =>
                        bSum + (parseFloat(entry.quantity) || 0), 0);
                }
                return iSum + (parseFloat(item.quantity) || 0);
            }, 0);
            return sum + (items.length > 0 ? itemQtyTotal : (parseFloat(sale.quantity) || 0));
        }, 0),
        totalTrucks: saleType === 'Border' ? filteredSales.reduce((sum, sale) => {
            const items = sale.items || [];
            const truckTotal = items.reduce((iSum, item) => {
                const brandEntries = item.brandEntries || [];
                return iSum + brandEntries.reduce((bSum, entry) => bSum + (parseFloat(entry.truck) || 0), 0);
            }, 0);
            return sum + (items.length > 0 ? truckTotal : (parseFloat(sale.truck) || 0));
        }, 0) : 0,
        totalAmount: filteredSales.reduce((sum, sale) => sum + (parseFloat(sale.totalAmount) || 0), 0),
        totalPaid: filteredSales.reduce((sum, sale) => sum + (parseFloat(sale.paidAmount) || 0), 0)
    };

    const toggleRowExpansion = (id) => {
        setExpandedRows(prev => prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 print:p-0 print:bg-white print:backdrop-none">
            <div className="bg-white w-full max-w-[1400px] max-h-[90vh] overflow-visible rounded-3xl shadow-2xl flex flex-col print:max-h-none print:shadow-none print:rounded-none print:w-full print:h-auto">
                {/* Modal Header/Toolbar */}
                <div className="flex flex-row items-center justify-between px-4 sm:px-8 py-4 border-b border-gray-100 print:hidden gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-blue-50 rounded-lg sm:rounded-xl">
                            <BarChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                        </div>
                        <h3 className="text-base sm:text-xl font-black text-gray-800 truncate leading-none">{saleType} Sales Report</h3>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 sm:gap-3 flex-shrink-0">
                        <div className="relative flex items-center">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-xl transition-all border ${showFilterPanel || Object.values(saleFilters).some(v => v !== '')
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30'
                                    }`}
                            >
                                <FunnelIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${showFilterPanel || Object.values(saleFilters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                            </button>

                            {/* Floating Filter Panel */}
                            {showFilterPanel && (
                                <>
                                    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[2005] md:hidden" onClick={() => setShowFilterPanel(false)} />
                                    <div ref={filterPanelRef} className="fixed inset-x-4 top-24 md:absolute md:top-full md:right-0 md:mt-2 w-auto md:w-80 bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[2010] p-4 flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-visible">
                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 flex-shrink-0">
                                            <h4 className="font-bold text-gray-900 text-sm">Advance Filter</h4>
                                            <button
                                                onClick={() => {
                                                    setSaleFilters({ startDate: '', endDate: '', companyName: '', invoiceNo: '', productName: '', brandName: '', port: '', indCnf: '', bdCnf: '' });
                                                    setFilterSearchInputs({ companySearch: '', invoiceSearch: '', productSearch: '', brandSearch: '', portSearch: '', indCnfSearch: '', bdCnfSearch: '' });
                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                }}
                                                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                                            >
                                                Reset
                                            </button>
                                        </div>

                                        <div className="space-y-3 flex-1 pr-0.5">
                                            <div className="space-y-2">
                                                <div ref={fromDateFilterRef}>
                                                    <CustomDatePicker
                                                        label="From Date"
                                                        value={saleFilters.startDate}
                                                        onChange={(e) => setSaleFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                                        compact={true}
                                                        isOpen={filterDropdownOpen.from}
                                                        onToggle={(val) => setFilterDropdownOpen(prev => ({ ...prev, from: val }))}
                                                    />
                                                </div>
                                                <div ref={toDateFilterRef}>
                                                    <CustomDatePicker
                                                        label="To Date"
                                                        value={saleFilters.endDate}
                                                        onChange={(e) => setSaleFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                                        compact={true}
                                                        isOpen={filterDropdownOpen.to}
                                                        onToggle={(val) => setFilterDropdownOpen(prev => ({ ...prev, to: val }))}
                                                    />
                                                </div>
                                            </div>

                                            {saleType === 'Border' ? (
                                                <>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {/* Company Selection - Party Name */}
                                                        <div className={`space-y-1.5 relative ${filterDropdownOpen.company ? 'z-50' : 'z-10'}`} ref={companyFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">PARTY NAME</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={filterSearchInputs.companySearch}
                                                                    onChange={(e) => {
                                                                        setFilterSearchInputs({ ...filterSearchInputs, companySearch: e.target.value });
                                                                        setSaleFilters(prev => ({ ...prev, companyName: e.target.value }));
                                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, company: true });
                                                                    }}
                                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, company: true })}
                                                                    placeholder={saleFilters.companyName || "Search Party..."}
                                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.companyName ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                                />
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                    {saleFilters.companyName && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSaleFilters(prev => ({ ...prev, companyName: '' }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, companySearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                        >
                                                                            <XIcon className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                            {filterDropdownOpen.company && (() => {
                                                                const options = getUniqueOptions('companyName');
                                                                const filtered = options.filter(c => c.toLowerCase().includes(filterSearchInputs.companySearch.toLowerCase()));
                                                                return filtered.length > 0 ? (
                                                                    <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        {filtered.map(c => (
                                                                            <button
                                                                                key={c}
                                                                                type="button"
                                                                                onMouseDown={(e) => {
                                                                                    e.preventDefault();
                                                                                    setSaleFilters(prev => ({ ...prev, companyName: c }));
                                                                                    setFilterSearchInputs(prev => ({ ...prev, companySearch: '' }));
                                                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                                                }}
                                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                            >
                                                                                {c}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                        </div>

                                                        {/* Port Filter */}
                                                        <div className={`space-y-1.5 relative ${filterDropdownOpen.port ? 'z-50' : 'z-10'}`} ref={portFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">PORT</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={filterSearchInputs.portSearch}
                                                                    onChange={(e) => {
                                                                        setFilterSearchInputs({ ...filterSearchInputs, portSearch: e.target.value });
                                                                        setSaleFilters(prev => ({ ...prev, port: e.target.value }));
                                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, port: true });
                                                                    }}
                                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, port: true })}
                                                                    placeholder={saleFilters.port || "Search Port..."}
                                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.port ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                                />
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                    {saleFilters.port && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSaleFilters(prev => ({ ...prev, port: '' }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, portSearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                        >
                                                                            <XIcon className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                            {filterDropdownOpen.port && (() => {
                                                                const options = getUniqueOptions('port');
                                                                const filtered = options.filter(p => p.toLowerCase().includes(filterSearchInputs.portSearch.toLowerCase()));
                                                                return filtered.length > 0 ? (
                                                                    <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        {filtered.map(p => (
                                                                            <button
                                                                                key={p}
                                                                                type="button"
                                                                                onMouseDown={(e) => {
                                                                                    e.preventDefault();
                                                                                    setSaleFilters(prev => ({ ...prev, port: p }));
                                                                                    setFilterSearchInputs(prev => ({ ...prev, portSearch: '' }));
                                                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                                                }}
                                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                            >
                                                                                {p}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        {/* IND C&F Filter */}
                                                        <div className={`space-y-1.5 relative ${filterDropdownOpen.indCnf ? 'z-50' : 'z-10'}`} ref={indCnfFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">IND C&F</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={filterSearchInputs.indCnfSearch}
                                                                    onChange={(e) => {
                                                                        setFilterSearchInputs({ ...filterSearchInputs, indCnfSearch: e.target.value });
                                                                        setSaleFilters(prev => ({ ...prev, indCnf: e.target.value }));
                                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, indCnf: true });
                                                                    }}
                                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, indCnf: true })}
                                                                    placeholder={saleFilters.indCnf || "Search IND C&F..."}
                                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.indCnf ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                                />
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                    {saleFilters.indCnf && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSaleFilters(prev => ({ ...prev, indCnf: '' }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, indCnfSearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                        >
                                                                            <XIcon className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                            {filterDropdownOpen.indCnf && (() => {
                                                                const options = getUniqueOptions('indianCnF');
                                                                const filtered = options.filter(ic => ic.toLowerCase().includes(filterSearchInputs.indCnfSearch.toLowerCase()));
                                                                return filtered.length > 0 ? (
                                                                    <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        {filtered.map(ic => (
                                                                            <button
                                                                                key={ic}
                                                                                type="button"
                                                                                onMouseDown={(e) => {
                                                                                    e.preventDefault();
                                                                                    setSaleFilters(prev => ({ ...prev, indCnf: ic }));
                                                                                    setFilterSearchInputs(prev => ({ ...prev, indCnfSearch: '' }));
                                                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                                                }}
                                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                            >
                                                                                {ic}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                        </div>

                                                        {/* BD C&F Filter */}
                                                        <div className={`space-y-1.5 relative ${filterDropdownOpen.bdCnf ? 'z-50' : 'z-10'}`} ref={bdCnfFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">BD C&F</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={filterSearchInputs.bdCnfSearch}
                                                                    onChange={(e) => {
                                                                        setFilterSearchInputs({ ...filterSearchInputs, bdCnfSearch: e.target.value });
                                                                        setSaleFilters(prev => ({ ...prev, bdCnf: e.target.value }));
                                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, bdCnf: true });
                                                                    }}
                                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, bdCnf: true })}
                                                                    placeholder={saleFilters.bdCnf || "Search BD C&F..."}
                                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.bdCnf ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                                />
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                    {saleFilters.bdCnf && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSaleFilters(prev => ({ ...prev, bdCnf: '' }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, bdCnfSearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                        >
                                                                            <XIcon className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                            {filterDropdownOpen.bdCnf && (() => {
                                                                const options = getUniqueOptions('bdCnf');
                                                                const filtered = options.filter(bc => bc.toLowerCase().includes(filterSearchInputs.bdCnfSearch.toLowerCase()));
                                                                return filtered.length > 0 ? (
                                                                    <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        {filtered.map(bc => (
                                                                            <button
                                                                                key={bc}
                                                                                type="button"
                                                                                onMouseDown={(e) => {
                                                                                    e.preventDefault();
                                                                                    setSaleFilters(prev => ({ ...prev, bdCnf: bc }));
                                                                                    setFilterSearchInputs(prev => ({ ...prev, bdCnfSearch: '' }));
                                                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                                                }}
                                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                            >
                                                                                {bc}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                        </div>
                                                    </div>

                                                    {/* Product Selection */}
                                                    <div className={`space-y-1.5 relative ${filterDropdownOpen.product ? 'z-50' : 'z-10'}`} ref={productFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">PRODUCT</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={filterSearchInputs.productSearch}
                                                                onChange={(e) => {
                                                                    setFilterSearchInputs({ ...filterSearchInputs, productSearch: e.target.value });
                                                                    setSaleFilters(prev => ({ ...prev, productName: e.target.value }));
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, product: true });
                                                                }}
                                                                onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, product: true })}
                                                                placeholder={saleFilters.productName || "Search Product..."}
                                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.productName ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                {saleFilters.productName && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSaleFilters(prev => ({ ...prev, productName: '' }));
                                                                            setFilterSearchInputs(prev => ({ ...prev, productSearch: '' }));
                                                                            setFilterDropdownOpen(initialFilterDropdownState);
                                                                        }}
                                                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                    >
                                                                        <XIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                        {filterDropdownOpen.product && (() => {
                                                            const options = getUniqueOptions('productName');
                                                            const filtered = options.filter(p => p.toLowerCase().includes(filterSearchInputs.productSearch.toLowerCase()));
                                                            return filtered.length > 0 ? (
                                                                <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                    {filtered.map(p => (
                                                                        <button
                                                                            key={p}
                                                                            type="button"
                                                                            onMouseDown={(e) => {
                                                                                e.preventDefault();
                                                                                setSaleFilters(prev => ({ ...prev, productName: p }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, productSearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            {p}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    {/* Company Selection - General */}
                                                    <div className={`space-y-1.5 relative ${filterDropdownOpen.company ? 'z-50' : 'z-10'}`} ref={companyFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">CUSTOMER NAME</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={filterSearchInputs.companySearch}
                                                                onChange={(e) => {
                                                                    setFilterSearchInputs({ ...filterSearchInputs, companySearch: e.target.value });
                                                                    setSaleFilters(prev => ({ ...prev, companyName: e.target.value }));
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, company: true });
                                                                }}
                                                                onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, company: true })}
                                                                placeholder={saleFilters.companyName || "Search Customer..."}
                                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.companyName ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                {saleFilters.companyName && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSaleFilters(prev => ({ ...prev, companyName: '' }));
                                                                            setFilterSearchInputs(prev => ({ ...prev, companySearch: '' }));
                                                                            setFilterDropdownOpen(initialFilterDropdownState);
                                                                        }}
                                                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                    >
                                                                        <XIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                        {filterDropdownOpen.company && (() => {
                                                            const options = getUniqueOptions('companyName');
                                                            const filtered = options.filter(c => c.toLowerCase().includes(filterSearchInputs.companySearch.toLowerCase()));
                                                            return filtered.length > 0 ? (
                                                                <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                    {filtered.map(c => (
                                                                        <button
                                                                            key={c}
                                                                            type="button"
                                                                            onMouseDown={(e) => {
                                                                                e.preventDefault();
                                                                                setSaleFilters(prev => ({ ...prev, companyName: c }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, companySearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            {c}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>

                                                    {/* Invoice No Selection - General only */}
                                                    <div className={`space-y-1.5 relative ${filterDropdownOpen.invoice ? 'z-50' : 'z-10'}`} ref={invoiceFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">INVOICE NO</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={filterSearchInputs.invoiceSearch}
                                                                onChange={(e) => {
                                                                    setFilterSearchInputs({ ...filterSearchInputs, invoiceSearch: e.target.value });
                                                                    setSaleFilters(prev => ({ ...prev, invoiceNo: e.target.value }));
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, invoice: true });
                                                                }}
                                                                onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, invoice: true })}
                                                                placeholder={saleFilters.invoiceNo || "Search Invoice..."}
                                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.invoiceNo ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                {saleFilters.invoiceNo && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSaleFilters(prev => ({ ...prev, invoiceNo: '' }));
                                                                            setFilterSearchInputs(prev => ({ ...prev, invoiceSearch: '' }));
                                                                            setFilterDropdownOpen(initialFilterDropdownState);
                                                                        }}
                                                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                    >
                                                                        <XIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                        {filterDropdownOpen.invoice && (() => {
                                                            const options = getUniqueOptions('invoiceNo');
                                                            const filtered = options.filter(i => i.toLowerCase().includes(filterSearchInputs.invoiceSearch.toLowerCase()));
                                                            return filtered.length > 0 ? (
                                                                <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                    {filtered.map(i => (
                                                                        <button
                                                                            key={i}
                                                                            type="button"
                                                                            onMouseDown={(e) => {
                                                                                e.preventDefault();
                                                                                setSaleFilters(prev => ({ ...prev, invoiceNo: i }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, invoiceSearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            {i}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>

                                                    {/* Product Selection - General */}
                                                    <div className={`space-y-1.5 relative ${filterDropdownOpen.product ? 'z-50' : 'z-10'}`} ref={productFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">PRODUCT</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={filterSearchInputs.productSearch}
                                                                onChange={(e) => {
                                                                    setFilterSearchInputs({ ...filterSearchInputs, productSearch: e.target.value });
                                                                    setSaleFilters(prev => ({ ...prev, productName: e.target.value }));
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, product: true });
                                                                }}
                                                                onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, product: true })}
                                                                placeholder={saleFilters.productName || "Search Product..."}
                                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.productName ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                {saleFilters.productName && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSaleFilters(prev => ({ ...prev, productName: '' }));
                                                                            setFilterSearchInputs(prev => ({ ...prev, productSearch: '' }));
                                                                            setFilterDropdownOpen(initialFilterDropdownState);
                                                                        }}
                                                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                    >
                                                                        <XIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                        {filterDropdownOpen.product && (() => {
                                                            const options = getUniqueOptions('productName');
                                                            const filtered = options.filter(p => p.toLowerCase().includes(filterSearchInputs.productSearch.toLowerCase()));
                                                            return filtered.length > 0 ? (
                                                                <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                    {filtered.map(p => (
                                                                        <button
                                                                            key={p}
                                                                            type="button"
                                                                            onMouseDown={(e) => {
                                                                                e.preventDefault();
                                                                                setSaleFilters(prev => ({ ...prev, productName: p }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, productSearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            {p}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>

                                                    {/* Brand Selection - General only */}
                                                    <div className={`space-y-1.5 relative ${filterDropdownOpen.brand ? 'z-50' : 'z-10'}`} ref={brandFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">BRAND</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={filterSearchInputs.brandSearch}
                                                                onChange={(e) => {
                                                                    setFilterSearchInputs({ ...filterSearchInputs, brandSearch: e.target.value });
                                                                    setSaleFilters(prev => ({ ...prev, brandName: e.target.value }));
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true });
                                                                }}
                                                                onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true })}
                                                                placeholder={saleFilters.brandName || "Search Brand..."}
                                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.brandName ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                {saleFilters.brandName && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSaleFilters(prev => ({ ...prev, brandName: '' }));
                                                                            setFilterSearchInputs(prev => ({ ...prev, brandSearch: '' }));
                                                                            setFilterDropdownOpen(initialFilterDropdownState);
                                                                        }}
                                                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                    >
                                                                        <XIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                        {filterDropdownOpen.brand && (() => {
                                                            const options = getUniqueOptions('brandName');
                                                            const filtered = options.filter(b => b.toLowerCase().includes(filterSearchInputs.brandSearch.toLowerCase()));
                                                            return filtered.length > 0 ? (
                                                                <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                    {filtered.map(b => (
                                                                        <button
                                                                            key={b}
                                                                            type="button"
                                                                            onMouseDown={(e) => {
                                                                                e.preventDefault();
                                                                                setSaleFilters(prev => ({ ...prev, brandName: b }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, brandSearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            {b}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>
                                                </>
                                            )}

                                            <button onClick={() => setShowFilterPanel(false)} className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all mt-3 flex-shrink-0 active:scale-[0.98]">APPLY FILTERS</button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <button onClick={() => generateSalesReportPDF(filteredSales, saleFilters, summary, saleType)} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg sm:rounded-xl shadow-lg shadow-blue-500/30 transition-all no-print">
                            <PrinterIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </button>
                        <button onClick={onClose} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg sm:rounded-xl transition-colors no-print"><XIcon className="w-4 h-4 sm:w-6 sm:h-6 text-gray-500" /></button>
                    </div>
                </div>

                {/* Printable Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-12 print:p-4 print:overflow-visible bg-white">
                    <div className="max-w-[1200px] mx-auto space-y-6 sm:space-y-8">
                        <div className="text-center space-y-1">
                            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">M/S ANI ENTERPRISE</h1>
                            <p className="text-[12px] sm:text-[14px] text-gray-600">766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh</p>
                            <p className="text-[12px] sm:text-[14px] text-gray-600">+8802588813057, anienterprise051@gmail.com, www.anienterprises.com.bd</p>
                        </div>
                        <div className="border-t-2 border-gray-900 w-full mt-4"></div>
                        <div className="flex justify-center -mt-6">
                            <div className="bg-white border-2 border-gray-900 px-12 py-1.5 inline-block">
                                <h2 className="text-xl font-bold text-gray-900 tracking-wide uppercase">{saleType} Sales Report</h2>
                            </div>
                        </div>

                        <div className="flex justify-between items-end text-[14px] text-gray-800 pt-6 px-2">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex"><span className="font-bold text-gray-900 w-28">Date Range:</span> <span className="text-gray-900">{formatDate(saleFilters.startDate) === '-' ? 'Start' : formatDate(saleFilters.startDate)} to {formatDate(saleFilters.endDate) === '-' ? 'Present' : formatDate(saleFilters.endDate)}</span></div>
                                {saleFilters.companyName && <div className="flex"><span className="font-bold text-gray-900 w-28">Customer:</span> <span className="text-gray-900">{saleFilters.companyName}</span></div>}
                            </div>
                            <div className="font-bold"><span className="text-gray-900">Printed on:</span> <span className="text-gray-900">{formatDate(new Date().toISOString().split('T')[0])}</span></div>
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto border border-gray-900">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-900">
                                        <th className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1.5 text-center ${saleType === 'Border' ? 'text-[12px]' : 'text-[11px]'} font-bold text-gray-900 uppercase w-[4%]`}>SL</th>
                                        <th className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1.5 text-center ${saleType === 'Border' ? 'text-[12px]' : 'text-[11px]'} font-bold text-gray-900 uppercase w-[7%]`}>Date</th>
                                        <th className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1.5 text-center ${saleType === 'Border' ? 'text-[12px]' : 'text-[11px]'} font-bold text-gray-900 uppercase w-[12%]`}>{saleType === 'Border' ? 'LC No' : 'Invoice'}</th>
                                        {saleType === 'Border' ? (
                                            <>
                                                <th className="border-r border-gray-900 px-0.5 py-1.5 text-center text-[12px] font-bold text-gray-900 uppercase whitespace-nowrap">Importer</th>
                                                <th className="border-r border-gray-900 px-0.5 py-1.5 text-center text-[12px] font-bold text-gray-900 uppercase whitespace-nowrap">Port</th>
                                                <th className="border-r border-gray-900 px-0.5 py-1.5 text-center text-[12px] font-bold text-gray-900 uppercase whitespace-nowrap">IND C&F</th>
                                                <th className="border-r border-gray-900 px-0.5 py-1.5 text-center text-[12px] font-bold text-gray-900 uppercase whitespace-nowrap">BD C&F</th>
                                                <th className="border-r border-gray-900 px-1 py-1.5 text-left text-[12px] font-bold text-gray-900 uppercase whitespace-nowrap">Party Name</th>
                                            </>
                                        ) : (
                                            <th className="border-r border-gray-900 px-2 py-1.5 text-left text-[11px] font-bold text-gray-900 uppercase w-[13%]">Company</th>
                                        )}
                                        <th className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1.5 text-left ${saleType === 'Border' ? 'text-[12px]' : 'text-[11px]'} font-bold text-gray-900 uppercase w-[7%]`}>Product</th>
                                        {saleType !== 'Border' && (
                                            <th className="border-r border-gray-900 px-1 py-1.5 text-left text-[11px] font-bold text-gray-900 uppercase w-[12%]">Brand</th>
                                        )}
                                        <th className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1.5 text-center ${saleType === 'Border' ? 'text-[12px]' : 'text-[11px]'} font-bold text-gray-900 uppercase w-[7%]`}>QTY</th>
                                        {saleType === 'Border' && (
                                            <th className="border-r border-gray-900 px-0.5 py-1.5 text-center text-[12px] font-bold text-gray-900 uppercase w-[5%]">Truck</th>
                                        )}
                                        <th className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1.5 text-right ${saleType === 'Border' ? 'text-[12px]' : 'text-[11px]'} font-bold text-gray-900 uppercase w-[5%]`}>Price</th>
                                        <th className={`${saleType === 'Border' ? '' : 'border-r'} border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1.5 text-right ${saleType === 'Border' ? 'text-[12px]' : 'text-[11px]'} font-bold text-gray-900 uppercase w-[10%]`}>Total</th>
                                        {saleType !== 'Border' && (
                                            <>
                                                <th className="border-r border-gray-900 px-1 py-1.5 text-right text-[11px] font-bold text-gray-900 uppercase w-[6%]">Disc</th>
                                                <th className="border-r border-gray-900 px-1 py-1.5 text-right text-[11px] font-bold text-gray-900 uppercase w-[9%]">Paid</th>
                                                <th className="px-1 py-1.5 text-right text-[11px] font-bold text-gray-900 uppercase w-[10%]">Balance</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-900">
                                    {(() => {
                                        let sl = 1;
                                        return filteredSales.length > 0 ? (
                                            filteredSales.flatMap((sale) => {
                                                const items = sale.items || [];
                                                // Create a list of all brand entries across all items
                                                const flatItems = items.flatMap(item => {
                                                    const entries = (item.brandEntries && item.brandEntries.length > 0)
                                                        ? item.brandEntries
                                                        : [{ brandName: item.brand || '-', quantity: item.quantity, unitPrice: 0, totalAmount: item.totalAmount }];

                                                    return entries.map((entry, subIdx) => ({
                                                        productName: item.productName || item.product || '-',
                                                        brand: entry.brandName || entry.brand || '-',
                                                        quantity: entry.quantity || 0,
                                                        truck: entry.truck || sale.truck || '-',
                                                        price: entry.unitPrice || 0,
                                                        total: entry.totalAmount || 0,
                                                        lcNo: sale.lcNo || '-',
                                                        isFirstInProduct: subIdx === 0,
                                                        productSpan: entries.length
                                                    }));
                                                });

                                                // If no items, fallback to sale level (safety)
                                                if (flatItems.length === 0) {
                                                    flatItems.push({
                                                        productName: sale.productName || '-',
                                                        brand: sale.brand || '-',
                                                        quantity: sale.quantity || 0,
                                                        price: 0,
                                                        total: sale.totalAmount || 0,
                                                        isFirstInProduct: true,
                                                        productSpan: 1
                                                    });
                                                }

                                                return flatItems.map((item, idx) => (
                                                        <tr key={`${sale._id}-${idx}`} className="hover:bg-gray-50 transition-colors">
                                                            {idx === 0 && (
                                                                <>
                                                                    <td rowSpan={flatItems.length} className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1 ${saleType === 'Border' ? 'text-[12px]' : 'text-[12px]'} text-gray-900 text-center`}>{sl++}</td>
                                                                    <td rowSpan={flatItems.length} className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1 ${saleType === 'Border' ? 'text-[12px]' : 'text-[12px]'} text-gray-900 text-center`}>{formatDate(sale.date)}</td>
                                                                    <td rowSpan={flatItems.length} className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1 ${saleType === 'Border' ? 'text-[12px]' : 'text-[12px]'} font-bold text-gray-900 text-center`}>{saleType === 'Border' ? (sale.lcNo || '-') : sale.invoiceNo}</td>
                                                                    {saleType === 'Border' ? (
                                                                        <>
                                                                            <td rowSpan={flatItems.length} className="border-r border-gray-900 px-0.5 py-1 text-[12px] text-gray-900 text-left whitespace-nowrap">{sale.importer || '-'}</td>
                                                                            <td rowSpan={flatItems.length} className="border-r border-gray-900 px-0.5 py-1 text-[12px] text-gray-900 text-center whitespace-nowrap">{sale.port || '-'}</td>
                                                                            <td rowSpan={flatItems.length} className="border-r border-gray-900 px-0.5 py-1 text-[12px] text-gray-900 text-center whitespace-nowrap">{sale.indianCnF || '-'}</td>
                                                                            <td rowSpan={flatItems.length} className="border-r border-gray-900 px-0.5 py-1 text-[12px] text-gray-900 text-center whitespace-nowrap">{sale.bdCnf || '-'}</td>
                                                                            <td rowSpan={flatItems.length} className="border-r border-gray-900 px-1 py-1 text-[12px] text-gray-900 whitespace-nowrap">{sale.companyName || sale.customerName || '-'}</td>
                                                                        </>
                                                                    ) : (
                                                                        <td rowSpan={flatItems.length} className="border-r border-gray-900 px-2 py-1 text-[12px] text-gray-900">{sale.companyName}</td>
                                                                    )}
                                                                </>
                                                            )}
                                                        {item.isFirstInProduct && (
                                                            <td rowSpan={item.productSpan} className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-2'} py-1 ${saleType === 'Border' ? 'text-[12px]' : 'text-[12px]'} text-gray-900 truncate`}>{item.productName}</td>
                                                        )}
                                                        {saleType !== 'Border' && (
                                                            <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-gray-900 truncate">{item.brand}</td>
                                                        )}
                                                        <td className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1 ${saleType === 'Border' ? 'text-[12px]' : 'text-[12px]'} text-right font-bold text-gray-900`}>{parseFloat(item.quantity).toLocaleString()}</td>
                                                        {saleType === 'Border' && (
                                                            <td className="border-r border-gray-900 px-0.5 py-1 text-[12px] text-gray-900 text-center">{item.truck || sale.truck || '-'}</td>
                                                        )}
                                                        <td className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1 ${saleType === 'Border' ? 'text-[12px]' : 'text-[12px]'} text-right text-gray-900`}>{parseFloat(item.price).toLocaleString()}</td>
                                                        <td className={`${saleType === 'Border' ? '' : 'border-r'} border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1 ${saleType === 'Border' ? 'text-[12px]' : 'text-[12px]'} text-right font-bold text-gray-900`}>{parseFloat(item.total).toLocaleString()}</td>
                                                        {saleType !== 'Border' && idx === 0 && (
                                                            <>
                                                                <td rowSpan={flatItems.length} className="border-r border-gray-900 px-1 py-1 text-[12px] text-right text-gray-600">{parseFloat(sale.discount || 0).toLocaleString()}</td>
                                                                <td rowSpan={flatItems.length} className="border-r border-gray-900 px-1 py-1 text-[12px] text-right text-green-700 font-bold">{parseFloat(sale.paidAmount || 0).toLocaleString()}</td>
                                                                <td rowSpan={flatItems.length} className="px-1 py-1 text-[12px] text-right text-red-700 font-black">{(parseFloat(sale.totalAmount || 0) - parseFloat(sale.paidAmount || 0)).toLocaleString()}</td>
                                                            </>
                                                        )}
                                                    </tr>
                                                ));
                                            })
                                        ) : (
                                            <tr><td colSpan="12" className="px-4 py-8 text-center text-gray-500 italic text-[12px]">No records found for the selected criteria.</td></tr>
                                        )
                                    })()}
                                </tbody>
                                {filteredSales.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-100 border-t-2 border-gray-900">
                                            <td colSpan={saleType === 'Border' ? "9" : "6"} className={`${saleType === 'Border' ? 'px-0.5 py-1 text-[12px]' : 'px-2 py-2 text-[12px]'} font-black text-gray-900 text-right uppercase tracking-wider border-r border-gray-900`}>Grand Total</td>
                                            <td className={`${saleType === 'Border' ? 'px-0.5 py-1 text-[12px]' : 'px-1 py-2 text-[12px]'} text-right font-black text-gray-900 border-r border-gray-900`}>{saleType === 'Border' ? '-' : summary.totalQty.toLocaleString()}</td>
                                            {saleType === 'Border' && <td className="px-0.5 py-1 text-[12px] text-center font-black text-gray-900 border-r border-gray-900">{summary.totalTrucks.toLocaleString()}</td>}
                                            <td className={`${saleType === 'Border' ? 'px-0.5 py-1 text-[12px]' : 'px-1 py-2 text-[12px]'} text-right font-bold text-gray-900 border-r border-gray-900`}></td>
                                            <td className={`${saleType === 'Border' ? '' : 'border-r'} ${saleType === 'Border' ? 'px-0.5 py-1 text-[12px]' : 'px-1 py-2 text-[12px]'} text-right font-black text-gray-900 border-gray-900`}>
                                                {saleType === 'Border' ? Math.round(summary.totalAmount).toLocaleString() : summary.totalAmount.toLocaleString()}
                                            </td>
                                            {saleType !== 'Border' && (
                                                <>
                                                    <td className="px-1 py-2 text-[12px] text-right font-black text-gray-900 border-r border-gray-900">{filteredSales.reduce((sum, s) => sum + (parseFloat(s.discount) || 0), 0).toLocaleString()}</td>
                                                    <td className="px-1 py-2 text-[12px] text-right font-black text-green-700 border-r border-gray-900">{summary.totalPaid.toLocaleString()}</td>
                                                    <td className="px-1 py-2 text-[12px] text-right font-black text-red-700">{(summary.totalAmount - summary.totalPaid).toLocaleString()}</td>
                                                </>
                                            )}
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-4 px-1">
                            {filteredSales.length > 0 ? (
                                filteredSales.map((sale) => {
                                    const isExpanded = expandedRows.includes(sale._id);
                                    const items = sale.items || [];
                                    const flatItems = items.flatMap(item =>
                                        (item.brandEntries || []).map(entry => ({
                                            productName: item.productName || item.product || '-',
                                            brand: entry.brandName || entry.brand || '-',
                                            quantity: sale.saleType === 'Border' ? (entry.truck || 0) : (entry.quantity || 0),
                                            price: entry.unitPrice || 0,
                                            total: entry.totalAmount || 0
                                        }))
                                    );

                                    if (flatItems.length === 0) {
                                        flatItems.push({
                                            productName: sale.productName || '-',
                                            brand: sale.brand || '-',
                                            quantity: sale.quantity || 0,
                                            price: 0,
                                            total: sale.totalAmount || 0
                                        });
                                    }

                                    return (
                                        <div
                                            key={sale._id}
                                            className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-4 space-y-3 relative transition-all ${isExpanded ? 'ring-1 ring-blue-500/10 shadow-md' : 'hover:bg-gray-50/30'}`}
                                            onClick={() => toggleRowExpansion(sale._id)}
                                        >
                                            {/* Header Section */}
                                            <div className="flex items-center justify-between min-w-0">
                                                <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                                                    <div className="flex-shrink-0">
                                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">{formatDate(sale.date)}</div>
                                                        <div className={`text-sm font-black text-gray-900 truncate`}>{sale.invoiceNo || 'No ID'}</div>
                                                    </div>

                                                    {!isExpanded && (
                                                        <>
                                                            <div className="flex-1 min-w-0 border-l border-gray-100 pl-3">
                                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Company</div>
                                                                <div className="text-[11px] font-bold text-gray-800 truncate">{sale.companyName || '-'}</div>
                                                            </div>
                                                            <div className="flex-shrink-0 border-l border-gray-100 pl-3 text-right">
                                                                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest leading-none mb-1">Total</div>
                                                                <div className="text-[11px] font-black text-gray-900">৳{parseFloat(sale.totalAmount).toLocaleString()}</div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 ml-2">
                                                    <ChevronDownIcon className={`w-5 h-5 text-gray-300 transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'opacity-60'}`} />
                                                </div>
                                            </div>

                                            {/* Expanded Content */}
                                            {isExpanded && (
                                                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                                    <div className="border-t border-gray-50 pt-3 mt-1 space-y-4">
                                                        <div>
                                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Company Name</div>
                                                            <div className="text-sm font-bold text-gray-800">{sale.companyName || '-'}</div>
                                                        </div>

                                                        <div className="bg-gray-50/50 rounded-xl p-3 space-y-2">
                                                            <div className="text-[10px] font-bold text-gray-600 uppercase">Products & Quantities</div>
                                                            <div className="grid grid-cols-12 gap-1 px-1 pb-1 border-b border-gray-100 mb-1 mt-2">
                                                                <div className="col-span-4 text-[9px] font-bold text-gray-400 uppercase">Brand</div>
                                                                <div className="col-span-2 text-[9px] font-bold text-gray-400 uppercase text-right">Qty</div>
                                                                <div className="col-span-3 text-[9px] font-bold text-gray-400 uppercase text-right">Price</div>
                                                                <div className="col-span-3 text-[9px] font-bold text-gray-400 uppercase text-right">Total</div>
                                                            </div>
                                                            <div className="space-y-3 mt-2">
                                                                {flatItems.map((item, idx) => (
                                                                    <div key={idx} className="border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                                                                        <div className="text-[12px] font-black text-gray-800 mb-0.5">{item.productName}</div>
                                                                        <div className="grid grid-cols-12 gap-1 items-center">
                                                                            <div className="col-span-4 min-w-0">
                                                                                <span className="text-[11px] font-medium text-gray-500 italic truncate block">{item.brand}</span>
                                                                            </div>
                                                                            <div className="col-span-2 text-right">
                                                                                <div className="text-[10px] font-bold text-gray-900">{parseFloat(item.quantity).toLocaleString()}</div>
                                                                            </div>
                                                                            <div className="col-span-3 text-right">
                                                                                <div className="text-[11px] font-medium text-blue-600">৳{parseFloat(item.price).toLocaleString()}</div>
                                                                            </div>
                                                                            <div className="col-span-3 text-right">
                                                                                <div className="text-[11px] font-black text-gray-900 text-truncate">৳{parseFloat(item.total).toLocaleString()}</div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Money Summary */}
                                                        <div className="grid grid-cols-2 gap-2 mt-4">
                                                            <div className="text-center p-2 rounded-lg border bg-blue-50/40 border-blue-100/50">
                                                                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Total Amount</div>
                                                                <div className="text-[13px] font-black text-gray-900">৳{parseFloat(sale.totalAmount).toLocaleString()}</div>
                                                            </div>
                                                            <div className="text-center p-2 rounded-lg border bg-red-50/40 border-red-100/50">
                                                                <div className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1">Discount</div>
                                                                <div className="text-[13px] font-black text-red-600">৳{parseFloat(sale.discount || 0).toLocaleString()}</div>
                                                            </div>
                                                            <div className="text-center p-2 rounded-lg border bg-emerald-50/40 border-emerald-100/50">
                                                                <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Paid Amount</div>
                                                                <div className="text-[13px] font-black text-emerald-700">৳{parseFloat(sale.paidAmount || 0).toLocaleString()}</div>
                                                            </div>
                                                            <div className="text-center p-2 rounded-lg border bg-orange-50/40 border-orange-100/50">
                                                                <div className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-1">Balance</div>
                                                                <div className="text-[13px] font-black text-orange-700">৳{(parseFloat(sale.totalAmount || 0) - parseFloat(sale.paidAmount || 0)).toLocaleString()}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center text-gray-400 font-medium italic text-sm shadow-sm">
                                    No records found for the selected criteria.
                                </div>
                            )}

                            {/* Mobile Grand Total Card */}
                            {filteredSales.length > 0 && (
                                <div className="bg-gray-900 rounded-2xl p-4 shadow-lg space-y-3 mt-6">
                                    <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Grand Total Summary</div>
                                        <div className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold tracking-wider">{filteredSales.length} Invoices</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Total Qty</div>
                                            <div className="text-lg font-black text-white">{summary.totalQty.toLocaleString()} <span className="text-[10px] font-bold text-gray-400 uppercase">KG</span></div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Total Sales</div>
                                            <div className="text-lg font-black text-white">৳{summary.totalAmount.toLocaleString()}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Total Paid</div>
                                            <div className="text-lg font-black text-emerald-400">৳{summary.totalPaid.toLocaleString()}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-bold text-orange-400 uppercase mb-1">Total Balance</div>
                                            <div className="text-xl font-black text-red-500">৳{(summary.totalAmount - summary.totalPaid).toLocaleString()}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 px-2">
                            <div className="border border-gray-200 p-5 rounded-2xl bg-gray-50 shadow-sm transition-all hover:shadow-md">
                                <div className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">Total Sales Quantity</div>
                                <div className="text-2xl font-black text-gray-900">
                                    {summary.totalQty.toLocaleString()} <span className="text-sm font-bold">KG</span>
                                </div>
                            </div>
                            {saleType === 'Border' ? (
                                <div className="border border-gray-200 p-5 rounded-2xl bg-white shadow-sm transition-all hover:shadow-md ring-2 ring-blue-500/10">
                                    <div className="text-[12px] font-bold text-blue-500 uppercase tracking-wider mb-2">Total Trucks</div>
                                    <div className="text-3xl font-black text-gray-900">
                                        {summary.totalTrucks.toLocaleString()} <span className="text-sm font-bold text-gray-500">Trucks</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="border border-gray-200 p-5 rounded-2xl bg-white shadow-sm transition-all hover:shadow-md ring-2 ring-blue-500/10">
                                    <div className="text-[12px] font-bold text-blue-500 uppercase tracking-wider mb-2">Net Balance</div>
                                    <div className="text-3xl font-black text-red-600">
                                        TK {(summary.totalAmount - summary.totalPaid).toLocaleString()}
                                    </div>
                                </div>
                            )}
                            <div className="border border-gray-200 p-5 rounded-2xl bg-gray-50 shadow-sm transition-all hover:shadow-md">
                                <div className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">Total Sales Amount</div>
                                <div className="text-2xl font-black text-gray-900">
                                    TK {summary.totalAmount.toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="grid grid-cols-3 gap-8 pt-24 px-4 pb-12">
                            <div className="text-center"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Prepared By</div></div>
                            <div className="text-center"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Verified By</div></div>
                            <div className="text-center"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Authorized Signature</div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalesReport;
