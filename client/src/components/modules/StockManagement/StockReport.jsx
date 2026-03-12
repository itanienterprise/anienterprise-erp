import React, { useState, useEffect, useRef } from 'react';
import { SearchIcon, XIcon, BarChartIcon, FunnelIcon, PrinterIcon } from '../../Icons';
import CustomDatePicker from "../../shared/CustomDatePicker";
import { generateStockReportPDF } from '../../../utils/pdfGenerator';
import { formatDate } from '../../../utils/helpers';
import { calculatePktRemainder } from '../../../utils/stockHelpers';

const StockReport = ({
    isOpen,
    onClose,
    stockRecords,
    stockFilters,
    setStockFilters,
    stockData,
    products
}) => {
    if (!isOpen) return null;

    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [filterSearchInputs, setFilterSearchInputs] = useState({ lcNoSearch: '', portSearch: '', brandSearch: '', productSearch: '', categorySearch: '' });
    const [filterDropdownOpen, setFilterDropdownOpen] = useState({ lcNo: false, port: false, brand: false, product: false, category: false });
    const initialFilterDropdownState = { lcNo: false, port: false, brand: false, product: false, category: false };

    const filterButtonRef = useRef(null);
    const filterPanelRef = useRef(null);
    const lcNoFilterRef = useRef(null);
    const portFilterRef = useRef(null);
    const productFilterRef = useRef(null);
    const brandFilterRef = useRef(null);
    const categoryFilterRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showFilterPanel && filterPanelRef.current && !filterPanelRef.current.contains(event.target) && !filterButtonRef.current.contains(event.target)) {
                setShowFilterPanel(false);
            }
            if (filterDropdownOpen.lcNo && lcNoFilterRef.current && !lcNoFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, lcNo: false }));
            if (filterDropdownOpen.port && portFilterRef.current && !portFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, port: false }));
            if (filterDropdownOpen.product && productFilterRef.current && !productFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, product: false }));
            if (filterDropdownOpen.brand && brandFilterRef.current && !brandFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, brand: false }));
            if (filterDropdownOpen.category && categoryFilterRef.current && !categoryFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, category: false }));
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

    // Helper to get Unique Options
    const getUniqueOptions = (key) => {
        if (key === 'productName') {
            return [...new Set(stockRecords.map(item => (item.productName || item.product || '').trim()).filter(Boolean))].sort();
        }
        return [...new Set(stockRecords.map(item => (item[key] || '').trim()).filter(Boolean))].sort();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 print:p-0 print:bg-white print:backdrop-none">
            <div className="bg-white w-full max-w-5xl max-h-[90vh] overflow-visible rounded-3xl shadow-2xl flex flex-col print:max-h-none print:shadow-none print:rounded-none print:w-full print:h-auto">
                {/* Modal Header/Toolbar (Hidden on Print) */}
                <div className="flex flex-row items-center justify-between px-4 sm:px-8 py-4 border-b border-gray-100 print:hidden gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-blue-50 rounded-lg sm:rounded-xl">
                            <BarChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                        </div>
                        <h3 className="text-base sm:text-xl font-black text-gray-800 truncate leading-none">Stock Report</h3>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 sm:gap-3 flex-shrink-0">
                        <div className="relative flex items-center">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-xl transition-all border ${showFilterPanel || Object.values(stockFilters).some(v => v !== '')
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30'
                                    }`}
                            >
                                <FunnelIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${showFilterPanel || Object.values(stockFilters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                            </button>

                            {/* Floating Filter Panel */}
                            {showFilterPanel && (
                                <>
                                    {/* Backdrop for mobile */}
                                    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[2005] md:hidden" onClick={() => setShowFilterPanel(false)} />
                                    <div ref={filterPanelRef} className="fixed inset-x-4 top-24 md:absolute md:top-full md:right-0 md:mt-2 w-auto md:w-72 bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[2010] p-4 flex flex-col max-h-[78vh] animate-in fade-in zoom-in-95 duration-200">
                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 flex-shrink-0">
                                            <h4 className="font-bold text-gray-900 text-sm">Advance Filter</h4>
                                            <button
                                                onClick={() => {
                                                    setStockFilters({ startDate: '', endDate: '', lcNo: '', port: '', brand: '', productName: '', category: '' });
                                                    setFilterSearchInputs({ lcNoSearch: '', portSearch: '', brandSearch: '', productSearch: '', categorySearch: '' });
                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                }}
                                                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                                            >
                                                Reset
                                            </button>
                                        </div>

                                        <div className="space-y-3 overflow-y-auto flex-1 pr-0.5">
                                            {/* Date Range */}
                                            <div className="space-y-2">
                                                <CustomDatePicker
                                                    label="From Date"
                                                    value={stockFilters.startDate}
                                                    onChange={(e) => setStockFilters({ ...stockFilters, startDate: e.target.value })}
                                                    compact={true}
                                                />
                                                <CustomDatePicker
                                                    label="To Date"
                                                    value={stockFilters.endDate}
                                                    onChange={(e) => setStockFilters({ ...stockFilters, endDate: e.target.value })}
                                                    compact={true}
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                {/* LC No Selection */}
                                                <div className="space-y-1.5 relative" ref={lcNoFilterRef}>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">LC No</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={filterSearchInputs.lcNoSearch}
                                                            onChange={(e) => {
                                                                setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: e.target.value });
                                                                setFilterDropdownOpen({ ...initialFilterDropdownState, lcNo: true });
                                                            }}
                                                            onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, lcNo: true })}
                                                            placeholder={stockFilters.lcNo || "Search LC..."}
                                                            className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${stockFilters.lcNo ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                        />
                                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                            {stockFilters.lcNo && (
                                                                <button onClick={() => { setStockFilters({ ...stockFilters, lcNo: '' }); setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="text-gray-400 hover:text-gray-600">
                                                                    <XIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                        </div>
                                                    </div>
                                                    {filterDropdownOpen.lcNo && (() => {
                                                        const options = getUniqueOptions('lcNo');
                                                        const filtered = options.filter(lc => lc.toLowerCase().includes(filterSearchInputs.lcNoSearch.toLowerCase()));
                                                        return filtered.length > 0 ? (
                                                            <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                {filtered.map(lc => (
                                                                    <button key={lc} type="button" onClick={() => { setStockFilters({ ...stockFilters, lcNo: lc }); setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors">{lc}</button>
                                                                ))}
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                </div>

                                                {/* Port Selection */}
                                                <div className="space-y-1.5 relative" ref={portFilterRef}>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Port</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={filterSearchInputs.portSearch}
                                                            onChange={(e) => {
                                                                setFilterSearchInputs({ ...filterSearchInputs, portSearch: e.target.value });
                                                                setFilterDropdownOpen({ ...initialFilterDropdownState, port: true });
                                                            }}
                                                            onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, port: true })}
                                                            placeholder={stockFilters.port || "Search Port..."}
                                                            className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${stockFilters.port ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                        />
                                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                            {stockFilters.port && (
                                                                <button onClick={() => { setStockFilters({ ...stockFilters, port: '' }); setFilterSearchInputs({ ...filterSearchInputs, portSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="text-gray-400 hover:text-gray-600">
                                                                    <XIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                        </div>
                                                    </div>
                                                    {filterDropdownOpen.port && (() => {
                                                        const options = getUniqueOptions('port');
                                                        const filtered = options.filter(p => p.toLowerCase().includes(filterSearchInputs.portSearch.toLowerCase()));
                                                        return filtered.length > 0 ? (
                                                            <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                {filtered.map(p => (
                                                                    <button key={p} type="button" onClick={() => { setStockFilters({ ...stockFilters, port: p }); setFilterSearchInputs({ ...filterSearchInputs, portSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors">{p}</button>
                                                                ))}
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {/* Category Selection */}
                                                <div className="space-y-1.5 relative" ref={categoryFilterRef}>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Category</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={filterSearchInputs.categorySearch}
                                                            onChange={(e) => {
                                                                setFilterSearchInputs({ ...filterSearchInputs, categorySearch: e.target.value });
                                                                setFilterDropdownOpen({ ...initialFilterDropdownState, category: true });
                                                            }}
                                                            onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, category: true })}
                                                            placeholder={stockFilters.category || "Search Category..."}
                                                            className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${stockFilters.category ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                        />
                                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                            {stockFilters.category && (
                                                                <button onClick={() => { setStockFilters({ ...stockFilters, category: '' }); setFilterSearchInputs({ ...filterSearchInputs, categorySearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="text-gray-400 hover:text-gray-600">
                                                                    <XIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                        </div>
                                                    </div>
                                                    {filterDropdownOpen.category && (() => {
                                                        const options = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
                                                        const filtered = options.filter(c => c.toLowerCase().includes(filterSearchInputs.categorySearch.toLowerCase()));
                                                        return filtered.length > 0 ? (
                                                            <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                {filtered.map(c => (
                                                                    <button key={c} type="button" onClick={() => { setStockFilters({ ...stockFilters, category: c }); setFilterSearchInputs({ ...filterSearchInputs, categorySearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors">{c}</button>
                                                                ))}
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                </div>

                                                {/* Product Name Selection */}
                                                <div className="space-y-1.5 relative" ref={productFilterRef}>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Product</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={filterSearchInputs.productSearch}
                                                            onChange={(e) => {
                                                                setFilterSearchInputs({ ...filterSearchInputs, productSearch: e.target.value });
                                                                setFilterDropdownOpen({ ...initialFilterDropdownState, product: true });
                                                            }}
                                                            onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, product: true })}
                                                            placeholder={stockFilters.productName || "Search Product..."}
                                                            className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${stockFilters.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                        />
                                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                            {stockFilters.productName && (
                                                                <button onClick={() => { setStockFilters({ ...stockFilters, productName: '', brand: '' }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '', brandSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="text-gray-400 hover:text-gray-600">
                                                                    <XIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                        </div>
                                                    </div>
                                                    {filterDropdownOpen.product && (() => {
                                                        let options = getUniqueOptions('productName');
                                                        if (stockFilters.category && products && products.length > 0) {
                                                            const categoryProducts = new Set(
                                                                products.filter(p => (p.category || '').toLowerCase() === stockFilters.category.toLowerCase())
                                                                    .map(p => (p.name || p.productName || '').toLowerCase())
                                                            );
                                                            options = options.filter(o => categoryProducts.has(o.toLowerCase()));
                                                        }
                                                        const filtered = options.filter(p => p.toLowerCase().includes(filterSearchInputs.productSearch.toLowerCase()));
                                                        return filtered.length > 0 ? (
                                                            <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                {filtered.map(p => (
                                                                    <button key={p} type="button" onClick={() => { setStockFilters({ ...stockFilters, productName: p, brand: '' }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '', brandSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors">{p}</button>
                                                                ))}
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                </div>

                                                {/* Brand Selection - Only if Product selected */}
                                                {stockFilters.productName && (
                                                    <div className="space-y-1.5 relative animate-in fade-in slide-in-from-top-2 duration-300" ref={brandFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Brand</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={filterSearchInputs.brandSearch}
                                                                onChange={(e) => {
                                                                    setFilterSearchInputs({ ...filterSearchInputs, brandSearch: e.target.value });
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true });
                                                                }}
                                                                onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true })}
                                                                placeholder={stockFilters.brand || "Search Brand..."}
                                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${stockFilters.brand ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                            />
                                                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                {stockFilters.brand && (
                                                                    <button onClick={() => { setStockFilters({ ...stockFilters, brand: '' }); setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="text-gray-400 hover:text-gray-600">
                                                                        <XIcon className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                        {filterDropdownOpen.brand && (() => {
                                                            const brandsSet = new Set();
                                                            stockRecords.forEach(r => {
                                                                // STRICT FILTER: If a product is selected, ONLY show brands for that product
                                                                if (stockFilters.productName && (r.productName || '').trim() !== stockFilters.productName) return;

                                                                if (r.brand) brandsSet.add(r.brand);
                                                                if (r.brandList) r.brandList.forEach(b => brandsSet.add(b.brand));
                                                            });
                                                            const options = Array.from(brandsSet).sort().filter(b => b.toLowerCase().includes(filterSearchInputs.brandSearch.toLowerCase()));
                                                            return options.length > 0 ? (
                                                                <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                    {options.map(brand => (
                                                                        <button key={brand} type="button" onClick={() => { setStockFilters({ ...stockFilters, brand }); setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors">{brand}</button>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl py-2 px-4 text-sm text-gray-500 text-center">
                                                                    No brands found
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                )}
                                            </div>

                                            <button onClick={() => setShowFilterPanel(false)} className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all mt-3 flex-shrink-0 active:scale-[0.98]">APPLY FILTERS</button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <button onClick={() => generateStockReportPDF(stockData, stockFilters)} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg sm:rounded-xl shadow-lg shadow-blue-500/30 transition-all no-print">
                            <PrinterIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </button>
                        <button onClick={onClose} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg sm:rounded-xl transition-colors no-print"><XIcon className="w-4 h-4 sm:w-6 sm:h-6 text-gray-500" /></button>
                    </div>
                </div>

                {/* Printable Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-12 print:p-4 print:overflow-visible bg-white">
                    <div className="max-w-[1000px] mx-auto space-y-6 sm:space-y-8">
                        <div className="text-center space-y-1">
                            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">M/S ANI ENTERPRISE</h1>
                            <p className="text-[12px] sm:text-[14px] text-gray-600">766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh</p>
                            <p className="text-[12px] sm:text-[14px] text-gray-600">+8802588813057, anienterprise051@gmail.com, www.anienterprises.com.bd</p>
                        </div>
                        <div className="border-t-2 border-gray-900 w-full mt-4"></div>
                        <div className="flex justify-center -mt-6">
                            <div className="bg-white border-2 border-gray-900 px-12 py-1.5 inline-block">
                                <h2 className="text-xl font-bold text-gray-900 tracking-wide uppercase">Stock Report</h2>
                            </div>
                        </div>
                        <div className="flex justify-between items-end text-[14px] text-gray-800 pt-6 px-2">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex"><span className="font-bold text-gray-900 w-28">Date Range:</span> <span className="text-gray-900">{formatDate(stockFilters.startDate) === '-' ? 'Start' : formatDate(stockFilters.startDate)} to {formatDate(stockFilters.endDate) === '-' ? 'Present' : formatDate(stockFilters.endDate)}</span></div>
                                {stockFilters.productName && <div className="flex"><span className="font-bold text-gray-900 w-28">Product:</span> <span className="text-gray-900">{stockFilters.productName}</span></div>}
                                {stockFilters.lcNo && <div className="flex"><span className="font-bold text-gray-900 w-28">LC No:</span> <span className="text-blue-700 font-extrabold">{stockFilters.lcNo}</span></div>}
                            </div>
                            <div className="font-bold"><span className="text-gray-900">Printed on:</span> <span className="text-gray-900">{formatDate(new Date().toISOString().split('T')[0])}</span></div>
                        </div>

                        {/* Desktop/Print Table View */}
                        <div className="hidden md:block print:block overflow-x-auto border border-gray-900">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-900">
                                        <th className="border-r border-gray-900 px-2 py-1 text-left text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[4%] text-center">SL</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-left text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[12%]">Product<br />Name</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-left text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[18%]">Brand</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">Total Inhouse<br />PKT</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[13%] whitespace-nowrap">Total Inhouse<br />QTY</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[8%] whitespace-nowrap">Sale<br />PKT</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[8%] whitespace-nowrap">Sale<br />QTY</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[13%] whitespace-nowrap">Inhouse<br />PKT</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">Inhouse<br />QTY</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-900">
                                    {stockData.displayRecords.length > 0 ? (
                                        stockData.displayRecords.map((item, index) => {
                                            const hasTotal = item.brandList.length > 1;
                                            return (
                                                <tr key={index} className="border-b border-gray-900 last:border-0 hover:bg-gray-50 transition-colors">
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[14px] text-gray-900 text-center align-top">{index + 1}</td>
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[14px] font-bold text-gray-900 align-top">
                                                        <div className="leading-tight">{item.productName}</div>
                                                        {item.brandList.map((_, i) => i > 0 && <div key={i} className="leading-tight">&nbsp;</div>)}
                                                        {hasTotal && <div className="mt-0 pt-0.5 border-t border-transparent leading-tight">&nbsp;</div>}
                                                    </td>
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[14px] text-gray-900 align-top whitespace-nowrap">
                                                        {item.brandList.map((ent, i) => (
                                                            <div key={i} className="leading-tight">{ent.brand}</div>
                                                        ))}
                                                        {hasTotal && <div className="mt-0 pt-0.5 border-t border-transparent leading-tight font-bold">&nbsp;</div>}
                                                    </td>
                                                    {/* Total Inhouse Column */}
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[14px] text-right text-gray-900 font-medium align-top whitespace-nowrap">
                                                        {item.brandList.map((ent, i) => {
                                                            const { whole, remainder } = calculatePktRemainder(ent.totalInHouseQuantity, ent.packetSize);
                                                            return <div key={i} className="leading-tight">{whole}{remainder !== 0 ? ` - ${Math.abs(remainder)} kg` : ''}</div>;
                                                        })}
                                                        {hasTotal && (
                                                            <div className="mt-0 pt-0.5 border-t border-gray-900 font-bold leading-tight">
                                                                {(() => {
                                                                    const pktSize = item.brandList[0]?.packetSize || 0;
                                                                    const { whole, remainder } = calculatePktRemainder(item.totalInHouseQuantity, pktSize);
                                                                    return `${whole}${remainder !== 0 ? ` - ${Math.abs(remainder)} kg` : ''}`;
                                                                })()}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[14px] text-right text-gray-900 font-bold align-top whitespace-nowrap">
                                                        {item.brandList.map((ent, i) => <div key={i} className="leading-tight">{Math.round(ent.totalInHouseQuantity)}</div>)}
                                                        {hasTotal && <div className="mt-0 pt-0.5 border-t border-gray-900 font-black leading-tight">{Math.round(item.totalInHouseQuantity)}</div>}
                                                    </td>
                                                    {/* Sales Column */}
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[14px] text-right text-gray-900 font-medium align-top whitespace-nowrap">
                                                        {item.brandList.map((ent, i) => {
                                                            const sPkt = parseFloat(ent.salePacket) || 0;
                                                            return <div key={i} className="leading-tight">{Number.isInteger(sPkt) ? sPkt : sPkt.toFixed(2)}</div>;
                                                        })}
                                                        {hasTotal && <div className="mt-0 pt-0.5 border-t border-gray-900 font-bold leading-tight text-right">{Number.isInteger(item.salePacket) ? item.salePacket : item.salePacket.toFixed(2)}</div>}
                                                    </td>
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[14px] text-right text-gray-900 font-bold align-top whitespace-nowrap">
                                                        {item.brandList.map((ent, i) => <div key={i} className="leading-tight">{Math.round(ent.saleQuantity)}</div>)}
                                                        {hasTotal && <div className="mt-0 pt-0.5 border-t border-gray-900 font-black leading-tight">{Math.round(item.saleQuantity)}</div>}
                                                    </td>
                                                    {/* Inhouse Remaining Column */}
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[14px] text-right text-gray-900 font-medium align-top whitespace-nowrap">
                                                        {item.brandList.map((ent, i) => {
                                                            const { whole, remainder } = calculatePktRemainder(ent.inHouseQuantity, ent.packetSize);
                                                            return <div key={i} className="leading-tight">{whole}{remainder !== 0 ? ` - ${Math.abs(remainder)} kg` : ''}</div>;
                                                        })}
                                                        {hasTotal && (
                                                            <div className="mt-0 pt-0.5 border-t border-gray-900 font-bold leading-tight">
                                                                {(() => {
                                                                    const pktSize = item.brandList[0]?.packetSize || 0;
                                                                    const { whole, remainder } = calculatePktRemainder(item.inHouseQuantity, pktSize);
                                                                    return `${whole}${remainder !== 0 ? ` - ${Math.abs(remainder)} kg` : ''}`;
                                                                })()}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-0.5 text-[14px] text-right text-gray-900 font-bold whitespace-nowrap border-gray-900 align-top">
                                                        {item.brandList.map((ent, i) => <div key={i} className="leading-tight">{Math.round(ent.inHouseQuantity)}</div>)}
                                                        {hasTotal && <div className="mt-0 pt-0.5 border-t border-gray-900 font-black leading-tight">{Math.round(item.inHouseQuantity)}</div>}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr><td colSpan="9" className="px-4 py-8 text-center text-gray-500 italic text-[14px]">No records found for the selected criteria.</td></tr>
                                    )}
                                </tbody>
                                {stockData.displayRecords.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-100 border-t-2 border-gray-900">
                                            <td colSpan="3" className="px-2 py-1.5 text-[14px] font-black text-gray-900 text-right uppercase tracking-wider border-r border-gray-900">Grand Total</td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900">
                                                {(() => {
                                                    const totalWhole = stockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + calculatePktRemainder(ent.totalInHouseQuantity, ent.packetSize).whole, 0), 0);
                                                    const totalRem = stockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + calculatePktRemainder(ent.totalInHouseQuantity, ent.packetSize).remainder, 0), 0);
                                                    return `${totalWhole}${totalRem !== 0 ? ` - ${Math.abs(totalRem).toLocaleString()} kg` : ''}`;
                                                })()}
                                            </td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900">
                                                {Math.round(stockData.totalTotalInHouseQty)}
                                            </td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900">
                                                {Number.isInteger(stockData.totalSalePkt) ? stockData.totalSalePkt : stockData.totalSalePkt.toFixed(2)}
                                            </td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900">
                                                {Math.round(stockData.totalSaleQty)}
                                            </td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900">
                                                {(() => {
                                                    const totalWhole = stockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + calculatePktRemainder(ent.inHouseQuantity, ent.packetSize).whole, 0), 0);
                                                    const totalRem = stockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + calculatePktRemainder(ent.inHouseQuantity, ent.packetSize).remainder, 0), 0);
                                                    return `${totalWhole}${totalRem !== 0 ? ` - ${Math.abs(totalRem).toLocaleString()} kg` : ''}`;
                                                })()}
                                            </td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900">
                                                {Math.round(stockData.totalInHouseQty)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden print:hidden space-y-4">
                            {stockData.displayRecords.length > 0 ? (
                                stockData.displayRecords.map((item, index) => (
                                    <div key={index} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                        <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                                            <h4 className="font-black text-gray-900 tracking-tight">{item.productName}</h4>
                                            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">#{index + 1}</span>
                                        </div>
                                        <div className="p-4 space-y-4">
                                            {item.brandList.map((ent, bIndex) => (
                                                <div key={bIndex} className="space-y-3 pb-4 last:pb-0 border-b last:border-0 border-gray-50">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm font-bold text-blue-600">{ent.brand}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                                        <div className="space-y-0.5">
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Inhouse</p>
                                                            <p className="text-xs font-bold text-gray-700">
                                                                {(() => {
                                                                    const { whole, remainder } = calculatePktRemainder(ent.totalInHouseQuantity, ent.packetSize);
                                                                    return `${whole}${remainder !== 0 ? ` - ${Math.abs(remainder)} kg` : ''}`;
                                                                })()} PKT
                                                            </p>
                                                            <p className="text-sm font-black text-gray-900">{Math.round(ent.totalInHouseQuantity)} kg</p>
                                                        </div>
                                                        <div className="space-y-0.5 text-right">
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sale</p>
                                                            <p className="text-xs font-bold text-gray-700">
                                                                {Number.isInteger(parseFloat(ent.salePacket)) ? parseFloat(ent.salePacket) : parseFloat(ent.salePacket).toFixed(2)} PKT
                                                            </p>
                                                            <p className="text-sm font-black text-gray-900">{Math.round(ent.saleQuantity)} kg</p>
                                                        </div>
                                                        <div className="space-y-0.5 col-span-2 pt-1 border-t border-gray-50">
                                                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Remaining Inhouse</p>
                                                            <div className="flex justify-between items-end">
                                                                <p className="text-xs font-bold text-blue-700">
                                                                    {(() => {
                                                                        const { whole, remainder } = calculatePktRemainder(ent.inHouseQuantity, ent.packetSize);
                                                                        return `${whole}${remainder !== 0 ? ` - ${Math.abs(remainder)} kg` : ''}`;
                                                                    })()} PKT
                                                                </p>
                                                                <p className="text-lg font-black text-blue-600">{Math.round(ent.inHouseQuantity)} kg</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {item.brandList.length > 1 && (
                                                <div className="mt-2 pt-3 border-t-2 border-dashed border-gray-100 bg-blue-50/30 -mx-4 -mb-4 p-4">
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Product Summary</p>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <p className="text-[10px] font-bold text-gray-400">Total Inhouse</p>
                                                            <p className="text-sm font-black text-gray-900">{Math.round(item.totalInHouseQuantity)} kg</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] font-bold text-blue-500">Net Stock</p>
                                                            <p className="text-sm font-black text-blue-600">{Math.round(item.inHouseQuantity)} kg</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 px-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                    <p className="text-gray-500 italic">No records found for the selected criteria.</p>
                                </div>
                            )}

                            {/* Mobile Grand Total */}
                            {stockData.displayRecords.length > 0 && (
                                <div className="mt-8 p-5 bg-gray-900 rounded-2xl shadow-xl shadow-gray-200">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 text-center">Grand Total Summary</h4>
                                    <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Total Inhouse</p>
                                            <p className="text-xl font-black text-white text-center">{Math.round(stockData.totalTotalInHouseQty)}<span className="text-[10px] ml-1 text-gray-400 uppercase">kg</span></p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Total Sale</p>
                                            <p className="text-xl font-black text-white text-center">{Math.round(stockData.totalSaleQty)}<span className="text-[10px] ml-1 text-gray-400 uppercase">kg</span></p>
                                        </div>
                                        <div className="col-span-2 pt-4 border-t border-gray-800 flex flex-col items-center">
                                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-1 text-center">Net Inhouse Stock</p>
                                            <p className="text-4xl font-black text-blue-500 tracking-tighter text-center">{Math.round(stockData.totalInHouseQty)}<span className="text-sm ml-2 text-blue-400 uppercase">kg</span></p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 px-2 print:grid">
                            {/* Card 1: TOTAL INHOUSE STOCK */}
                            <div className="border border-gray-200 p-4 sm:p-5 rounded-2xl bg-gray-50 shadow-sm print:border-gray-200">
                                <div className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">Total Inhouse Stock</div>
                                <div className="text-xs sm:text-sm font-bold text-gray-700 mb-1">
                                    PKT: {(() => {
                                        const totalWhole = stockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + calculatePktRemainder(ent.totalInHouseQuantity, ent.packetSize).whole, 0), 0);
                                        const totalRem = stockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + calculatePktRemainder(ent.totalInHouseQuantity, ent.packetSize).remainder, 0), 0);
                                        return `${totalWhole}${totalRem !== 0 ? ` - ${Math.abs(totalRem).toLocaleString()} kg` : ''}`;
                                    })()}
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-gray-900">
                                    QTY: {Math.round(stockData.totalTotalInHouseQty)} <span className="text-xs sm:text-sm font-bold">{stockData.unit}</span>
                                </div>
                            </div>

                            {/* Card 2: TOTAL SALE */}
                            <div className="border border-gray-200 p-4 sm:p-5 rounded-2xl bg-gray-50 shadow-sm print:border-gray-200">
                                <div className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">Total Sale</div>
                                <div className="text-xs sm:text-sm font-bold text-gray-700 mb-1">
                                    PKT: {Number.isInteger(stockData.totalSalePkt) ? stockData.totalSalePkt : stockData.totalSalePkt.toFixed(2)}
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-gray-900">
                                    QTY: {Math.round(stockData.totalSaleQty)} <span className="text-xs sm:text-sm font-bold">{stockData.unit}</span>
                                </div>
                            </div>

                            {/* Card 3: CURRENT INHOUSE */}
                            <div className="border border-gray-200 p-4 sm:p-5 rounded-2xl bg-white shadow-sm print:border-gray-200">
                                <div className="text-[10px] sm:text-[11px] font-bold text-blue-500 uppercase tracking-wider mb-2 sm:mb-3">Current Inhouse</div>
                                <div className="text-xs sm:text-sm font-bold text-gray-700 mb-1">
                                    PKT: {(() => {
                                        const totalWhole = stockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + calculatePktRemainder(ent.inHouseQuantity, ent.packetSize).whole, 0), 0);
                                        const totalRem = stockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + calculatePktRemainder(ent.inHouseQuantity, ent.packetSize).remainder, 0), 0);
                                        return `${totalWhole}${totalRem !== 0 ? ` - ${Math.abs(totalRem).toLocaleString()} kg` : ''}`;
                                    })()}
                                </div>
                                <div className="text-2xl sm:text-3xl font-black text-blue-600">
                                    QTY: {Math.round(stockData.totalInHouseQty)} <span className="text-sm sm:text-lg font-bold">{stockData.unit}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 pt-12 sm:pt-24 px-4 pb-12 print:grid-cols-3 print:pt-24 print:gap-8">
                            <div className="text-center sm:text-left"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Prepared By</div></div>
                            <div className="text-center"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase text-center">Verified By</div></div>
                            <div className="text-center sm:text-right"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Authorized Signature</div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockReport;
