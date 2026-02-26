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

    // Helper for robust Inhouse data handling
    const getIHPkt = (item) => {
        if (item.inHousePacket !== undefined && item.inHousePacket !== '') return parseFloat(item.inHousePacket) || 0;
        return (parseFloat(item.packet) || 0) - (parseFloat(item.sweepedPacket) || 0);
    };

    const getIHQty = (item) => {
        if (item.inHouseQuantity !== undefined && item.inHouseQuantity !== '') return parseFloat(item.inHouseQuantity) || 0;
        const ihPkt = getIHPkt(item);
        const size = parseFloat(item.packetSize) || 0;
        return ihPkt * size;
    };

    const formatPktDisplay = (pkt, qty, size) => {
        const pSize = parseFloat(size) || 0;
        const whole = Math.floor(pkt);
        const rem = Math.round(qty - (whole * pSize));
        if (pSize <= 0) return Math.round(pkt).toString();
        return `${whole}${rem > 0 ? ` - ${rem} kg` : ''}`;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm">
            <style>{`
                @media print {
                    @page { size: landscape; margin: 5mm; }
                    body { margin: 0; }
                }
            `}</style>
            <div className="w-[98%] h-[94%] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 print:w-full print:h-auto print:shadow-none print:bg-white print:rounded-none">
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
                <div className="flex-1 overflow-y-auto p-12 print:p-6 print:overflow-visible bg-white">
                    <div className="w-full max-w-[1400px] mx-auto space-y-8">
                        {/* Company Header */}
                        <div className="text-center space-y-1">
                            <h1 className="text-5xl font-bold text-gray-900 tracking-tight">M/S ANI ENTERPRISE</h1>
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
                                    <span className="font-bold text-black font-semibold">Date Range:</span> {formatDate(lcFilters.startDate) === '-' ? 'Start' : formatDate(lcFilters.startDate)} to {formatDate(lcFilters.endDate) === '-' ? 'Present' : formatDate(lcFilters.endDate)}
                                </div>
                                {lcFilters.lcNo && (
                                    <div>
                                        <span className="font-bold text-black font-semibold">LC No:</span> <span className="text-blue-900 font-bold">{lcFilters.lcNo}</span>
                                    </div>
                                )}
                            </div>
                            <div className="font-bold">
                                <span className="text-black font-semibold">Printed on:</span> <span className="text-black">{formatDate(new Date().toISOString().split('T')[0])}</span>
                            </div>
                        </div>

                        {/* Report Table */}
                        <div className="overflow-x-auto border border-gray-900">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 border-b border-gray-900">
                                        <th className="border-r border-gray-900 px-1 py-1 text-center text-[12px] font-bold text-black uppercase tracking-tight" style={{ width: '7.5%' }}>Date</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-center text-[12px] font-bold text-blue-900 uppercase tracking-tight" style={{ width: '9.5%' }}>LC No</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-left text-[12px] font-bold text-black uppercase tracking-tight" style={{ width: '10.5%' }}>Importer</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-center text-[12px] font-bold text-black uppercase tracking-tight" style={{ width: '5.2%' }}>Port</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-center text-[12px] font-bold text-black uppercase tracking-tight" style={{ width: '6.2%' }}>BOE No</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-center text-[12px] font-bold text-black uppercase tracking-tight" style={{ width: '4.8%' }}>Truck</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-center text-[12px] font-bold text-black uppercase tracking-tight" style={{ width: '8.2%' }}>Product</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-left text-[12px] font-bold text-black uppercase tracking-tight" style={{ width: '16.5%' }}>Brand</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-right text-[12px] font-bold text-black uppercase tracking-tight" style={{ width: '6.8%' }}>Packet</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-right text-[12px] font-bold text-black uppercase tracking-tight" style={{ width: '6.8%' }}>QTY</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-right text-[12px] font-bold text-black uppercase tracking-tight" style={{ width: '6.8%' }}>IH Qty</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-right text-[12px] font-bold text-black uppercase tracking-tight" style={{ width: '5.2%' }}>IH PKT</th>
                                        <th className="border-r border-gray-900 px-1 py-1 text-right text-[12px] font-bold text-black uppercase tracking-tight" style={{ width: '5.2%' }}>Short</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-400">
                                    {lcReceiveRecords.length > 0 ? (() => {
                                        // 1. Group by Date + LC No
                                        const lcGroupMap = lcReceiveRecords.reduce((acc, item) => {
                                            const dateStr = formatDate(item.date);
                                            const key = `${dateStr}_${item.lcNo || 'unknown'}`;
                                            if (!acc[key]) {
                                                acc[key] = {
                                                    date: item.date,
                                                    lcNo: item.lcNo,
                                                    importer: item.importer,
                                                    port: item.port,
                                                    billOfEntry: item.billOfEntry,
                                                    rows: []
                                                };
                                            }
                                            acc[key].rows.push(item);
                                            return acc;
                                        }, {});

                                        const lcGroups = Object.values(lcGroupMap);

                                        return lcGroups.flatMap((lcGroup, lcIdx) => {
                                            // 2. Sub-group by Product + Truck within LC group
                                            const subGroupMap = lcGroup.rows.reduce((acc, item) => {
                                                const key = `${item.productName}-${item.truckNo}`;
                                                if (!acc[key]) {
                                                    acc[key] = {
                                                        productName: item.productName,
                                                        truckNo: item.truckNo,
                                                        rows: []
                                                    };
                                                }
                                                acc[key].rows.push(item);
                                                return acc;
                                            }, {});

                                            const subGroups = Object.values(subGroupMap);
                                            const totalLcRows = lcGroup.rows.length + subGroups.filter(sg => sg.rows.length > 1).length;

                                            return subGroups.flatMap((subGroup, sgIdx) => {
                                                const subRows = subGroup.rows;
                                                const hasTotalRow = subRows.length > 1;
                                                const subGroupSpan = subRows.length + (hasTotalRow ? 1 : 0);

                                                return [
                                                    ...subRows.map((item, rowIdx) => (
                                                        <tr key={`${lcIdx}-${sgIdx}-${rowIdx}`} className="border-b border-gray-400 hover:bg-gray-50 transition-colors">
                                                            {/* Group 1: LC Level (Spans entire LC group) */}
                                                            {sgIdx === 0 && rowIdx === 0 && (
                                                                <>
                                                                    <td rowSpan={totalLcRows} className="border-r border-gray-900 px-2 py-0.5 text-[12px] text-black text-center align-middle">{formatDate(lcGroup.date)}</td>
                                                                    <td rowSpan={totalLcRows} className="border-r border-gray-900 px-2 py-0.5 text-[12px] font-bold text-blue-900 text-center align-middle">{lcGroup.lcNo}</td>
                                                                    <td rowSpan={totalLcRows} className="border-r border-gray-900 px-2 py-0.5 text-[12px] text-black align-middle">{lcGroup.importer || '-'}</td>
                                                                    <td rowSpan={totalLcRows} className="border-r border-gray-900 px-2 py-0.5 text-[12px] text-black text-center align-middle">{lcGroup.port || '-'}</td>
                                                                    <td rowSpan={totalLcRows} className="border-r border-gray-900 px-2 py-0.5 text-[12px] text-black text-center align-middle">{lcGroup.billOfEntry || '-'}</td>
                                                                </>
                                                            )}

                                                            {/* Group 2: Product + Truck Level */}
                                                            {rowIdx === 0 && (
                                                                <>
                                                                    <td rowSpan={subGroupSpan} className="border-r border-gray-900 px-2 py-0.5 text-[12px] font-bold text-black text-center align-middle">{item.truckNo || '-'}</td>
                                                                    <td rowSpan={subGroupSpan} className="border-r border-gray-900 px-2 py-0.5 text-[12px] font-bold text-black text-center align-middle">{item.productName || '-'}</td>
                                                                </>
                                                            )}

                                                            {/* Item Level: Brand, Packet, Qty, IH Qty, IH Pkt, Short */}
                                                            <td className="border-r border-gray-900 px-2 py-0.5 text-[12px] text-black">{item.brand || '-'}</td>
                                                            <td className="border-r border-gray-900 px-2 py-0.5 text-[12px] text-right text-black">{item.packet || '0'}</td>
                                                            <td className="border-r border-gray-900 px-2 py-0.5 text-[12px] text-right font-black text-black">{Math.round(item.quantity)} {item.unit}</td>
                                                            <td className="border-r border-gray-900 px-2 py-0.5 text-[12px] text-right font-bold text-black">{Math.round(getIHQty(item)) || 0} {item.unit}</td>
                                                            <td className="border-r border-gray-900 px-2 py-0.5 text-[12px] text-right font-bold text-black">
                                                                {formatPktDisplay(getIHPkt(item), getIHQty(item), item.packetSize)}
                                                            </td>
                                                            <td className="border-r border-gray-900 px-2 py-0.5 text-[12px] text-right font-bold text-black">{Math.round(item.sweepedQuantity)} {item.unit}</td>
                                                        </tr>
                                                    )),
                                                    // Sub-Group Total Row
                                                    ...(hasTotalRow ? [(
                                                        <tr key={`${lcIdx}-${sgIdx}-total`} className="border-b border-gray-400 font-bold bg-gray-50/30">
                                                            <td className="border-r border-gray-900 px-2 py-0.5 text-[12px] text-black italic">Sub Total</td>
                                                            <td className="border-r border-gray-900 px-2 py-0.5 text-[12px] text-right text-black"></td>
                                                            <td className="border-r border-gray-900 px-2 py-0.5 text-[12px] text-right border-t border-gray-900 font-black text-black">
                                                                {Math.round(subRows.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0))} {subRows[0].unit}
                                                            </td>
                                                            <td className="border-r border-gray-900 px-2 py-0.5 text-[12px] text-right border-t border-gray-900 font-bold text-black">
                                                                {Math.round(subRows.reduce((sum, r) => sum + getIHQty(r), 0))} {subRows[0].unit}
                                                            </td>
                                                            <td className="border-r border-gray-900 px-2 py-0.5 text-[12px] text-right border-t border-gray-900 font-bold text-black">
                                                                {(() => {
                                                                    const totalPkt = subRows.reduce((sum, r) => sum + getIHPkt(r), 0);
                                                                    const totalQty = subRows.reduce((sum, r) => sum + getIHQty(r), 0);
                                                                    const totalWhole = subRows.reduce((sum, r) => sum + Math.floor(getIHPkt(r)), 0);
                                                                    const totalRem = Math.round(subRows.reduce((sum, r) => {
                                                                        const pkt = getIHPkt(r);
                                                                        const qty = getIHQty(r);
                                                                        const size = parseFloat(r.packetSize) || 0;
                                                                        const whole = Math.floor(pkt);
                                                                        return sum + (qty - (whole * size));
                                                                    }, 0));

                                                                    // Re-sum wholes and remainders
                                                                    return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                                                                })()}
                                                            </td>
                                                            <td className="border-r border-gray-900 px-2 py-0.5 text-[12px] text-right border-t border-gray-900 font-bold text-black">
                                                                {Math.round(subRows.reduce((sum, r) => sum + (parseFloat(r.sweepedQuantity) || 0), 0))} {subRows[0].unit}
                                                            </td>
                                                        </tr>
                                                    )] : [])
                                                ];
                                            });
                                        });
                                    })() : (
                                        <tr>
                                            <td colSpan="13" className="px-4 py-8 text-center text-black italic">No receive records found for the selected criteria.</td>
                                        </tr>
                                    )}
                                </tbody>
                                {lcReceiveRecords.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-100 border-t-2 border-gray-900">
                                            <td colSpan="8" className="px-2 py-2 text-[12px] font-black text-black text-right uppercase tracking-wider border-r border-gray-900">Grand Total</td>
                                            <td className="px-2 py-2 text-[12px] text-right font-black text-black border-r border-gray-900 whitespace-nowrap">
                                                {lcReceiveSummary.totalPackets}
                                            </td>
                                            <td className="px-2 py-2 text-[12px] text-right font-black text-black border-r border-gray-900 whitespace-nowrap">
                                                {Math.round(lcReceiveSummary.totalQuantity)} {lcReceiveSummary.unit}
                                            </td>
                                            <td className="px-2 py-2 text-[12px] text-right font-black text-black border-r border-gray-900 whitespace-nowrap">
                                                {Math.round(lcReceiveRecords.reduce((sum, item) => sum + getIHQty(item), 0)) || 0} {lcReceiveSummary.unit}
                                            </td>
                                            <td className="px-2 py-2 text-[12px] text-right font-black text-black border-r border-gray-900 whitespace-nowrap">
                                                {(() => {
                                                    const totalWhole = lcReceiveRecords.reduce((sum, item) => sum + Math.floor(getIHPkt(item)), 0);
                                                    const totalRem = Math.round(lcReceiveRecords.reduce((sum, item) => {
                                                        const pkt = getIHPkt(item);
                                                        const qty = getIHQty(item);
                                                        const size = parseFloat(item.packetSize) || 0;
                                                        const whole = Math.floor(pkt);
                                                        return sum + (qty - (whole * size));
                                                    }, 0));
                                                    return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                                                })()}
                                            </td>
                                            <td className="px-2 py-2 text-[12px] text-right font-black text-black border-r border-gray-900 whitespace-nowrap">
                                                {Math.round(lcReceiveRecords.reduce((sum, item) => sum + (parseFloat(item.sweepedQuantity) || 0), 0))} {lcReceiveSummary.unit}
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
