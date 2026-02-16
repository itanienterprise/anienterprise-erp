import React, { useState, useEffect, useRef } from 'react';
import { XIcon, BarChartIcon, FunnelIcon, SearchIcon } from '../../Icons';
import { formatDate } from '../../../utils/helpers';
import { generateLCReceiveReportPDF } from '../../../utils/pdfGenerator';
import CustomDatePicker from '../../shared/CustomDatePicker';

const LCReport = ({
    isOpen,
    onClose,
    stockRecords,
    lcFilters,
    setLcFilters,
    lcReceiveRecords,
    lcReceiveSummary
}) => {
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [filterSearchInputs, setFilterSearchInputs] = useState({
        lcNoSearch: '',
        portSearch: '',
        indCnfSearch: '',
        bdCnfSearch: '',
        billOfEntrySearch: '',
        productSearch: '',
        brandSearch: ''
    });

    const initialFilterDropdownState = {
        lcNo: false,
        port: false,
        brand: false,
        product: false,
        indCnf: false,
        bdCnf: false,
        billOfEntry: false
    };

    const [filterDropdownOpen, setFilterDropdownOpen] = useState(initialFilterDropdownState);

    const filterPanelRef = useRef(null);
    const filterButtonRef = useRef(null);
    const reportLcNoFilterRef = useRef(null);
    const reportPortFilterRef = useRef(null);
    const reportBrandFilterRef = useRef(null);
    const reportProductFilterRef = useRef(null);
    const reportLcIndCnfFilterRef = useRef(null);
    const reportLcBdCnfFilterRef = useRef(null);
    const reportLcBillOfEntryFilterRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showFilterPanel && filterPanelRef.current && !filterPanelRef.current.contains(event.target) && filterButtonRef.current && !filterButtonRef.current.contains(event.target)) {
                setShowFilterPanel(false);
            }

            const openKey = Object.keys(filterDropdownOpen).find(key => filterDropdownOpen[key]);
            if (!openKey) return;

            let refsToCheck = [];
            if (openKey === 'lcNo') refsToCheck = [reportLcNoFilterRef];
            else if (openKey === 'port') refsToCheck = [reportPortFilterRef];
            else if (openKey === 'brand') refsToCheck = [reportBrandFilterRef];
            else if (openKey === 'product') refsToCheck = [reportProductFilterRef];
            else if (openKey === 'indCnf') refsToCheck = [reportLcIndCnfFilterRef];
            else if (openKey === 'bdCnf') refsToCheck = [reportLcBdCnfFilterRef];
            else if (openKey === 'billOfEntry') refsToCheck = [reportLcBillOfEntryFilterRef];

            const isOutside = refsToCheck.filter(ref => ref && ref.current).every(ref => !ref.current.contains(event.target));
            if (isOutside) {
                setFilterDropdownOpen(initialFilterDropdownState);
            }
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

    if (!isOpen) return null;

    const initialLcFilterState = {
        startDate: '',
        endDate: '',
        lcNo: '',
        port: '',
        indCnf: '',
        bdCnf: '',
        billOfEntry: '',
        productName: '',
        brand: ''
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm">
            <div className="w-[95%] h-[90%] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 print:w-full print:h-auto print:shadow-none print:bg-white print:rounded-none">
                {/* Modal Header - Hidden in Print */}
                <div className="px-8 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between print:hidden">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <BarChartIcon className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">LC Receive Report</h2>
                            <p className="text-sm text-gray-500 font-medium">Generate and print LC receiving reports</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Advanced Filter for Report */}
                        <div className="relative">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95"
                            >
                                <FunnelIcon className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium">Filter</span>
                            </button>

                            {/* Filter Panel */}
                            {showFilterPanel && (
                                <div ref={filterPanelRef} className="absolute right-0 mt-2 w-[450px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 z-[110] animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-base font-bold text-gray-900">Advance Filter</h3>
                                        <button
                                            onClick={() => {
                                                setLcFilters(initialLcFilterState);
                                                setFilterSearchInputs({
                                                    lcNoSearch: '',
                                                    portSearch: '',
                                                    indCnfSearch: '',
                                                    bdCnfSearch: '',
                                                    billOfEntrySearch: '',
                                                    productSearch: '',
                                                    brandSearch: ''
                                                });
                                                setFilterDropdownOpen(initialFilterDropdownState);
                                            }}
                                            className="text-xs font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                                        >
                                            Reset All
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <CustomDatePicker
                                            label="From Date"
                                            value={lcFilters.startDate}
                                            onChange={(e) => setLcFilters({ ...lcFilters, startDate: e.target.value })}
                                            compact={true}
                                        />
                                        <CustomDatePicker
                                            label="To Date"
                                            value={lcFilters.endDate}
                                            onChange={(e) => setLcFilters({ ...lcFilters, endDate: e.target.value })}
                                            compact={true}
                                            rightAlign={true}
                                        />

                                        {/* LC No Filter */}
                                        <div className="space-y-1.5 relative" ref={reportLcNoFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">LC No</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.lcNoSearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: e.target.value });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, lcNo: true });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, lcNo: true })}
                                                    placeholder={lcFilters.lcNo || "Search LC..."}
                                                    className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300 pr-14 ${lcFilters.lcNo ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                    {lcFilters.lcNo && (
                                                        <button
                                                            onClick={() => {
                                                                setLcFilters({ ...lcFilters, lcNo: '' });
                                                                setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: '' });
                                                            }}
                                                            className="text-gray-400 hover:text-gray-600"
                                                        >
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.lcNo && (() => {
                                                const lcOptions = [...new Set(stockRecords.map(item => (item.lcNo || '').trim()).filter(Boolean))].sort();
                                                const filtered = lcOptions.filter(lc => lc.toLowerCase().includes(filterSearchInputs.lcNoSearch.toLowerCase()));
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                                        {filtered.map(lc => (
                                                            <button
                                                                key={lc}
                                                                type="button"
                                                                onClick={() => {
                                                                    setLcFilters({ ...lcFilters, lcNo: lc });
                                                                    setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: '' });
                                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                                }}
                                                                className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                            >
                                                                {lc}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        {/* Port Filter */}
                                        <div className="space-y-1.5 relative" ref={reportPortFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Port</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.portSearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, portSearch: e.target.value });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, port: true });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, port: true })}
                                                    placeholder={lcFilters.port || "Search Port..."}
                                                    className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300 pr-14 ${lcFilters.port ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                    {lcFilters.port && (
                                                        <button
                                                            onClick={() => {
                                                                setLcFilters({ ...lcFilters, port: '' });
                                                                setFilterSearchInputs({ ...filterSearchInputs, portSearch: '' });
                                                            }}
                                                            className="text-gray-400 hover:text-gray-600"
                                                        >
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.port && (() => {
                                                const portOptions = [...new Set(stockRecords.map(item => (item.port || '').trim()).filter(Boolean))].sort();
                                                const filtered = portOptions.filter(p => p.toLowerCase().includes(filterSearchInputs.portSearch.toLowerCase()));
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                                        {filtered.map(p => (
                                                            <button
                                                                key={p}
                                                                type="button"
                                                                onClick={() => {
                                                                    setLcFilters({ ...lcFilters, port: p });
                                                                    setFilterSearchInputs({ ...filterSearchInputs, portSearch: '' });
                                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                                }}
                                                                className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                            >
                                                                {p}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        {/* Product Filter */}
                                        <div className="space-y-1.5 relative" ref={reportProductFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Product</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.productSearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, productSearch: e.target.value });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, product: true });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, product: true })}
                                                    placeholder={lcFilters.productName || "Search Product..."}
                                                    className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300 pr-14 ${lcFilters.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                    {lcFilters.productName && (
                                                        <button
                                                            onClick={() => {
                                                                setLcFilters({ ...lcFilters, productName: '' });
                                                                setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' });
                                                            }}
                                                            className="text-gray-400 hover:text-gray-600"
                                                        >
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.product && (() => {
                                                const options = [...new Set(stockRecords.map(item => (item.productName || '').trim()).filter(Boolean))].sort();
                                                const filtered = options.filter(o => o.toLowerCase().includes(filterSearchInputs.productSearch.toLowerCase()));
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                                        {filtered.map(o => (
                                                            <button
                                                                key={o}
                                                                type="button"
                                                                onClick={() => {
                                                                    setLcFilters({ ...lcFilters, productName: o });
                                                                    setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' });
                                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                                }}
                                                                className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                            >
                                                                {o}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        {/* Brand Filter */}
                                        <div className="space-y-1.5 relative" ref={reportBrandFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Brand</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.brandSearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, brandSearch: e.target.value });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true })}
                                                    placeholder={lcFilters.brand || "Search Brand..."}
                                                    className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300 pr-14 ${lcFilters.brand ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                    {lcFilters.brand && (
                                                        <button
                                                            onClick={() => {
                                                                setLcFilters({ ...lcFilters, brand: '' });
                                                                setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' });
                                                            }}
                                                            className="text-gray-400 hover:text-gray-600"
                                                        >
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.brand && (() => {
                                                const productFilteredRecords = lcFilters.productName
                                                    ? stockRecords.filter(item => (item.productName || '').trim().toLowerCase() === lcFilters.productName.toLowerCase())
                                                    : stockRecords;
                                                const options = [...new Set(productFilteredRecords.flatMap(item => {
                                                    if (item.brand) return [(item.brand || '').trim()];
                                                    return (item.brandEntries || []).map(e => (e.brand || '').trim());
                                                }).filter(Boolean))].sort();
                                                const filtered = options.filter(o => o.toLowerCase().includes(filterSearchInputs.brandSearch.toLowerCase()));
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                                        {filtered.map(o => (
                                                            <button
                                                                key={o}
                                                                type="button"
                                                                onClick={() => {
                                                                    setLcFilters({ ...lcFilters, brand: o });
                                                                    setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' });
                                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                                }}
                                                                className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                            >
                                                                {o}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        {/* IND CNF Filter */}
                                        <div className="space-y-1.5 relative" ref={reportLcIndCnfFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">IND CNF</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.indCnfSearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, indCnfSearch: e.target.value });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, indCnf: true });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, indCnf: true })}
                                                    placeholder={lcFilters.indCnf || "Search..."}
                                                    className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300 pr-14 ${lcFilters.indCnf ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                    {lcFilters.indCnf && (
                                                        <button
                                                            onClick={() => {
                                                                setLcFilters({ ...lcFilters, indCnf: '' });
                                                                setFilterSearchInputs({ ...filterSearchInputs, indCnfSearch: '' });
                                                            }}
                                                            className="text-gray-400 hover:text-gray-600"
                                                        >
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.indCnf && (() => {
                                                const options = [...new Set(stockRecords.map(item => (item.indianCnF || '').trim()).filter(Boolean))].sort();
                                                const filtered = options.filter(o => o.toLowerCase().includes(filterSearchInputs.indCnfSearch.toLowerCase()));
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                                        {filtered.map(o => (
                                                            <button
                                                                key={o}
                                                                onClick={() => {
                                                                    setLcFilters({ ...lcFilters, indCnf: o });
                                                                    setFilterSearchInputs({ ...filterSearchInputs, indCnfSearch: '' });
                                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                                }}
                                                                className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                            >
                                                                {o}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        {/* BD CNF Filter */}
                                        <div className="space-y-1.5 relative" ref={reportLcBdCnfFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">BD CNF</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.bdCnfSearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, bdCnfSearch: e.target.value });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, bdCnf: true });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, bdCnf: true })}
                                                    placeholder={lcFilters.bdCnf || "Search..."}
                                                    className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300 pr-14 ${lcFilters.bdCnf ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                    {lcFilters.bdCnf && (
                                                        <button
                                                            onClick={() => {
                                                                setLcFilters({ ...lcFilters, bdCnf: '' });
                                                                setFilterSearchInputs({ ...filterSearchInputs, bdCnfSearch: '' });
                                                            }}
                                                            className="text-gray-400 hover:text-gray-600"
                                                        >
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.bdCnf && (() => {
                                                const options = [...new Set(stockRecords.map(item => (item.bdCnF || '').trim()).filter(Boolean))].sort();
                                                const filtered = options.filter(o => o.toLowerCase().includes(filterSearchInputs.bdCnfSearch.toLowerCase()));
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                                        {filtered.map(o => (
                                                            <button
                                                                key={o}
                                                                onClick={() => {
                                                                    setLcFilters({ ...lcFilters, bdCnf: o });
                                                                    setFilterSearchInputs({ ...filterSearchInputs, bdCnfSearch: '' });
                                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                                }}
                                                                className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                            >
                                                                {o}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        {/* Bill Of Entry Filter */}
                                        <div className="col-span-2 space-y-1.5 relative" ref={reportLcBillOfEntryFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Bill Of Entry</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.billOfEntrySearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, billOfEntrySearch: e.target.value });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, billOfEntry: true });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, billOfEntry: true })}
                                                    placeholder={lcFilters.billOfEntry || "Search Bill Of Entry..."}
                                                    className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300 pr-14 ${lcFilters.billOfEntry ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                    {lcFilters.billOfEntry && (
                                                        <button
                                                            onClick={() => {
                                                                setLcFilters({ ...lcFilters, billOfEntry: '' });
                                                                setFilterSearchInputs({ ...filterSearchInputs, billOfEntrySearch: '' });
                                                            }}
                                                            className="text-gray-400 hover:text-gray-600"
                                                        >
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.billOfEntry && (() => {
                                                const options = [...new Set(stockRecords.map(item => (item.billOfEntry || '').trim()).filter(Boolean))].sort();
                                                const filtered = options.filter(o => o.toLowerCase().includes(filterSearchInputs.billOfEntrySearch.toLowerCase()));
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                                        {filtered.map(o => (
                                                            <button
                                                                key={o}
                                                                onClick={() => {
                                                                    setLcFilters({ ...lcFilters, billOfEntry: o });
                                                                    setFilterSearchInputs({ ...filterSearchInputs, billOfEntrySearch: '' });
                                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                                }}
                                                                className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                            >
                                                                {o}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        <button
                                            onClick={() => setShowFilterPanel(false)}
                                            className="col-span-2 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-all mt-2"
                                        >
                                            Apply Filters
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => generateLCReceiveReportPDF(lcReceiveRecords, lcFilters, lcReceiveSummary)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 no-print"
                        >
                            <BarChartIcon className="w-4 h-4" />
                            Print Report
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors no-print"
                        >
                            <XIcon className="w-6 h-6 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Printable Content */}
                <div className="flex-1 overflow-y-auto p-12 print:p-4 print:overflow-visible bg-white">
                    <div className="max-w-[1000px] mx-auto space-y-8">
                        {/* Company Header */}
                        <div className="text-center space-y-1">
                            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">M/S ANI ENTERPRISE</h1>
                            <p className="text-[14px] text-gray-600">766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh</p>
                            <p className="text-[14px] text-gray-600">+8802588813057, +8801711-406898, anienterprise051@gmail.com, www.anienterprises.com.bd</p>
                        </div>

                        {/* Sharp Separator */}
                        <div className="border-t-2 border-gray-900 w-full mt-4"></div>

                        {/* Report Title Box */}
                        <div className="flex justify-center -mt-6">
                            <div className="bg-white border-2 border-gray-900 px-12 py-1.5 inline-block">
                                <h2 className="text-xl font-bold text-gray-900 tracking-wide uppercase">LC Receive Report</h2>
                            </div>
                        </div>

                        {/* Date/Info Row */}
                        <div className="flex justify-between items-end text-[11px] text-black pt-6 px-2">
                            <div className="flex flex-col gap-1.5">
                                <div>
                                    <span className="font-bold text-black font-semibold">Date Range:</span> {lcFilters.startDate || 'Start'} to {lcFilters.endDate || 'Present'}
                                </div>
                                {lcFilters.lcNo && (
                                    <div>
                                        <span className="font-bold text-black font-semibold">LC No:</span> <span className="text-blue-900 font-bold">{lcFilters.lcNo}</span>
                                    </div>
                                )}
                            </div>
                            <div className="font-bold">
                                <span className="text-black font-semibold">Printed on:</span> <span className="text-black">{new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'numeric', year: 'numeric' })}</span>
                            </div>
                        </div>

                        {/* Report Table */}
                        <div className="overflow-x-auto border border-gray-900">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-900">
                                        <th className="border-r border-gray-900 px-1 py-1 text-left text-[10.5px] font-bold text-black uppercase tracking-wider w-[3%] text-center">SL</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-left text-[10.5px] font-bold text-black uppercase tracking-wider w-[8%]">Date</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-left text-[10.5px] font-bold text-blue-900 uppercase tracking-wider font-extrabold w-[10%]">LC No</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-left text-[10.5px] font-bold text-black uppercase tracking-wider w-[15%]">Importer</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-left text-[10.5px] font-bold text-black uppercase tracking-wider w-[7%]">Port</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-left text-[10.5px] font-bold text-black uppercase tracking-wider w-[8%]">BOE No</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-left text-[10.5px] font-bold text-black uppercase tracking-wider w-[15%]">Product</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-left text-[10.5px] font-bold text-black uppercase tracking-wider w-[14%] text-center">Brand</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-right text-[10.5px] font-bold text-black uppercase tracking-wider w-[6%] text-center">Packet</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-right text-[10.5px] font-bold text-black uppercase tracking-wider w-[5%] text-center">Truck</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-right text-[10.5px] font-bold text-black uppercase tracking-wider w-[9%]">QTY</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-400">
                                    {lcReceiveRecords.length > 0 ? (
                                        Object.values(lcReceiveRecords.reduce((acc, item) => {
                                            const key = item.lcNo || 'unknown';
                                            if (!acc[key]) {
                                                acc[key] = {
                                                    ...item,
                                                    entries: []
                                                };
                                            }
                                            acc[key].entries.push(item);
                                            return acc;
                                        }, {})).map((entry, index) => {
                                            // Sub-group entries by Product + Truck within each LC group
                                            const productGroups = entry.entries.reduce((acc, item) => {
                                                const key = `${item.date}-${item.productName}-${item.truckNo}`;
                                                if (!acc[key]) {
                                                    acc[key] = {
                                                        ...item,
                                                        brandList: [],
                                                        packetList: [],
                                                        qtyList: []
                                                    };
                                                }
                                                acc[key].brandList.push(item.brand || '-');
                                                acc[key].packetList.push(item.packet || '0');
                                                acc[key].qtyList.push({ quantity: item.quantity, unit: item.unit });
                                                return acc;
                                            }, {});

                                            const finalEntries = Object.values(productGroups);

                                            return (
                                                <tr key={index} className="border-b border-gray-400 last:border-0 hover:bg-gray-50 transition-colors">
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] text-black text-center align-top">{index + 1}</td>
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] text-black align-top font-medium">{formatDate(entry.date)}</td>
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] font-extrabold text-blue-900 align-top">{entry.lcNo}</td>
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] text-black align-top">{entry.importer || '-'}</td>
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] text-black align-top">{entry.port || '-'}</td>
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] text-black align-top">{entry.billOfEntry || '-'}</td>

                                                    {/* Product Column */}
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] font-bold text-black align-top">
                                                        {finalEntries.map((subItem, idx) => {
                                                            const hasTotal = subItem.qtyList.length > 1;
                                                            return (
                                                                <div key={idx} className={`${idx < finalEntries.length - 1 ? 'border-b border-gray-300 mb-2 pb-2' : ''}`}>
                                                                    <div className="leading-tight">{subItem.productName}</div>
                                                                    {Array.from({ length: subItem.brandList.length - 1 }).map((_, i) => (
                                                                        <div key={i} className="leading-tight">&nbsp;</div>
                                                                    ))}
                                                                    {hasTotal && <div className="mt-0 pt-0.5 border-t border-transparent leading-tight">&nbsp;</div>}
                                                                </div>
                                                            );
                                                        })}
                                                    </td>

                                                    {/* Brand Column */}
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] text-black align-top">
                                                        {finalEntries.map((subItem, idx) => {
                                                            const hasTotal = subItem.qtyList.length > 1;
                                                            return (
                                                                <div key={idx} className={`${idx < finalEntries.length - 1 ? 'border-b border-gray-300 mb-2 pb-2' : ''}`}>
                                                                    {subItem.brandList.map((b, i) => (
                                                                        <div key={i} className="leading-tight">{b}</div>
                                                                    ))}
                                                                    {hasTotal && <div className="mt-0 pt-0.5 border-t border-transparent leading-tight">&nbsp;</div>}
                                                                </div>
                                                            );
                                                        })}
                                                    </td>

                                                    {/* Packet Column */}
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] text-center text-black align-top">
                                                        {finalEntries.map((subItem, idx) => {
                                                            const hasTotal = subItem.qtyList.length > 1;
                                                            return (
                                                                <div key={idx} className={`${idx < finalEntries.length - 1 ? 'border-b border-gray-300 mb-2 pb-2' : ''}`}>
                                                                    {subItem.packetList.map((p, i) => (
                                                                        <div key={i} className="leading-tight">{p}</div>
                                                                    ))}
                                                                    {hasTotal && <div className="mt-0 pt-0.5 border-t border-transparent leading-tight">&nbsp;</div>}
                                                                </div>
                                                            );
                                                        })}
                                                    </td>

                                                    {/* Truck Column */}
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] text-center font-bold text-black align-top">
                                                        {finalEntries.map((subItem, idx) => {
                                                            const hasTotal = subItem.qtyList.length > 1;
                                                            return (
                                                                <div key={idx} className={`${idx < finalEntries.length - 1 ? 'border-b border-gray-300 mb-2 pb-2' : ''}`}>
                                                                    <div className="leading-tight">{subItem.truckNo}</div>
                                                                    {Array.from({ length: subItem.brandList.length - 1 }).map((_, i) => (
                                                                        <div key={i} className="leading-tight">&nbsp;</div>
                                                                    ))}
                                                                    {hasTotal && <div className="mt-0 pt-0.5 border-t border-transparent leading-tight">&nbsp;</div>}
                                                                </div>
                                                            );
                                                        })}
                                                    </td>

                                                    {/* QTY Column */}
                                                    <td className="px-2 py-0.5 text-[10.5px] text-right font-bold text-black align-top border-r border-gray-900 whitespace-nowrap">
                                                        {finalEntries.map((subItem, idx) => {
                                                            const hasTotal = subItem.qtyList.length > 1;
                                                            return (
                                                                <div key={idx} className={`${idx < finalEntries.length - 1 ? 'border-b border-gray-300 mb-2 pb-2' : ''}`}>
                                                                    {subItem.qtyList.map((q, i) => (
                                                                        <div key={i} className="leading-tight font-black">{Math.round(q.quantity)} {q.unit}</div>
                                                                    ))}
                                                                    {hasTotal && (
                                                                        <div className="mt-0 pt-0.5 border-t border-gray-900 font-extrabold leading-tight">
                                                                            {Math.round(subItem.qtyList.reduce((sum, q) => sum + (parseFloat(q.quantity) || 0), 0))} {subItem.qtyList[0].unit}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="11" className="px-4 py-8 text-center text-black italic">No receive records found for the selected criteria.</td>
                                        </tr>
                                    )}
                                </tbody>
                                {lcReceiveRecords.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-100 border-t-2 border-gray-900">
                                            <td colSpan="9" className="px-2 py-2 text-[10.5px] font-black text-black text-right uppercase tracking-wider border-r border-gray-900">Grand Total</td>
                                            <td className="px-2 py-2 text-[10.5px] text-center font-black text-black border-r border-gray-900">
                                                {lcReceiveSummary.totalTrucks}
                                            </td>
                                            <td className="px-2 py-2 text-[10.5px] text-right font-black text-black border-r border-gray-900 whitespace-nowrap">
                                                {Math.round(lcReceiveSummary.totalQuantity)} {lcReceiveSummary.unit}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {/* Summary Info Cards for Print */}
                        <div className="grid grid-cols-3 gap-6 pt-6 px-2 print:grid">
                            <div className="border-2 border-gray-100 p-6 rounded-3xl bg-white shadow-sm print:border-gray-200">
                                <div className="text-[13px] font-bold text-black uppercase tracking-wider mb-2">Total Packets</div>
                                <div className="text-2xl font-black text-black">{lcReceiveSummary.totalPackets}</div>
                            </div>
                            <div className="border-2 border-gray-100 p-6 rounded-3xl bg-white shadow-sm print:border-gray-200">
                                <div className="text-[13px] font-bold text-black uppercase tracking-wider mb-2">Total Quantity</div>
                                <div className="text-2xl font-black text-black">{Math.round(lcReceiveSummary.totalQuantity)} <span className="text-lg font-bold">{lcReceiveSummary.unit}</span></div>
                            </div>
                            <div className="border-2 border-gray-100 p-6 rounded-3xl bg-white shadow-sm print:border-gray-200">
                                <div className="text-[13px] font-bold text-black uppercase tracking-wider mb-2">Total Truck</div>
                                <div className="text-3xl font-black text-black">{lcReceiveSummary.totalTrucks}</div>
                            </div>
                        </div>

                        {/* Footer Signatures */}
                        <div className="grid grid-cols-3 gap-8 pt-24 px-4 pb-12">
                            <div className="text-center">
                                <div className="border-t border-dotted border-gray-900 pt-2 text-[13px] font-bold text-black uppercase">Prepared By</div>
                            </div>
                            <div className="text-center">
                                <div className="border-t border-dotted border-gray-900 pt-2 text-[13px] font-bold text-black uppercase">Verified By</div>
                            </div>
                            <div className="text-center">
                                <div className="border-t border-dotted border-gray-900 pt-2 text-[13px] font-bold text-black uppercase">Authorized Signature</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LCReport;
