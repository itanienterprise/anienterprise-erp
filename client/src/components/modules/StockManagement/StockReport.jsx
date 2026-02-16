import React, { useState, useEffect, useRef } from 'react';
import { SearchIcon, XIcon, BarChartIcon, FunnelIcon } from '../../Icons';
import CustomDatePicker from "../../shared/CustomDatePicker";
import { generateStockReportPDF } from '../../../utils/pdfGenerator';

const StockReport = ({
    isOpen,
    onClose,
    stockRecords,
    stockFilters,
    setStockFilters,
    stockData
}) => {
    if (!isOpen) return null;

    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [filterSearchInputs, setFilterSearchInputs] = useState({ lcNoSearch: '', portSearch: '', brandSearch: '', productSearch: '' });
    const [filterDropdownOpen, setFilterDropdownOpen] = useState({ lcNo: false, port: false, brand: false, product: false });
    const initialFilterDropdownState = { lcNo: false, port: false, brand: false, product: false };

    const filterButtonRef = useRef(null);
    const filterPanelRef = useRef(null);
    const lcNoFilterRef = useRef(null);
    const portFilterRef = useRef(null);
    const productFilterRef = useRef(null);
    const brandFilterRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showFilterPanel && filterPanelRef.current && !filterPanelRef.current.contains(event.target) && !filterButtonRef.current.contains(event.target)) {
                setShowFilterPanel(false);
            }
            if (filterDropdownOpen.lcNo && lcNoFilterRef.current && !lcNoFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, lcNo: false }));
            if (filterDropdownOpen.port && portFilterRef.current && !portFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, port: false }));
            if (filterDropdownOpen.product && productFilterRef.current && !productFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, product: false }));
            if (filterDropdownOpen.brand && brandFilterRef.current && !brandFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, brand: false }));
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
        return [...new Set(stockRecords.map(item => (item[key] || '').trim()).filter(Boolean))].sort();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 print:p-0 print:bg-white print:backdrop-none">
            <div className="bg-white w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col print:max-h-none print:shadow-none print:rounded-none print:w-full print:h-auto">
                {/* Modal Header/Toolbar (Hidden on Print) */}
                <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 print:hidden">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-xl">
                            <BarChartIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">Stock Report</h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${showFilterPanel || Object.values(stockFilters).some(v => v !== '')
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <FunnelIcon className={`w-4 h-4 ${showFilterPanel || Object.values(stockFilters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                                <span className="text-sm font-medium">Filter</span>
                            </button>

                            {/* Floating Filter Panel */}
                            {showFilterPanel && (
                                <div ref={filterPanelRef} className="absolute right-0 mt-3 w-80 bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[110] p-5 animate-in fade-in zoom-in duration-200">
                                    <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
                                        <h4 className="font-bold text-gray-900 text-sm">Advance Filter</h4>
                                        <button
                                            onClick={() => {
                                                setStockFilters({ startDate: '', endDate: '', lcNo: '', port: '', brand: '', productName: '' });
                                                setFilterSearchInputs({ lcNoSearch: '', portSearch: '', brandSearch: '', productSearch: '' });
                                                setFilterDropdownOpen(initialFilterDropdownState);
                                            }}
                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                                        >
                                            Reset All
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Date Range */}
                                        <div className="grid grid-cols-2 gap-3">
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
                                                rightAlign={true}
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
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
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
                                                    const options = getUniqueOptions('productName');
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

                                        <button onClick={() => setShowFilterPanel(false)} className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all mt-2 active:scale-[0.98]">APPLY FILTERS</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button onClick={() => generateStockReportPDF(stockData, stockFilters)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 no-print">
                            <BarChartIcon className="w-4 h-4" /> Print Report
                        </button>
                        <button onClick={onClose} className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors no-print"><XIcon className="w-6 h-6 text-gray-500" /></button>
                    </div>
                </div>

                {/* Printable Content */}
                <div className="flex-1 overflow-y-auto p-12 print:p-4 print:overflow-visible bg-white">
                    <div className="max-w-[1000px] mx-auto space-y-8">
                        <div className="text-center space-y-1">
                            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">M/S ANI ENTERPRISE</h1>
                            <p className="text-[14px] text-gray-600">766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh</p>
                            <p className="text-[14px] text-gray-600">+8802588813057, +8801711-406898, anienterprise051@gmail.com, www.anienterprises.com.bd</p>
                        </div>
                        <div className="border-t-2 border-gray-900 w-full mt-4"></div>
                        <div className="flex justify-center -mt-6">
                            <div className="bg-white border-2 border-gray-900 px-12 py-1.5 inline-block">
                                <h2 className="text-xl font-bold text-gray-900 tracking-wide uppercase">Stock Report</h2>
                            </div>
                        </div>
                        <div className="flex justify-between items-end text-[14px] text-gray-800 pt-6 px-2">
                            <div className="flex flex-col gap-1.5">
                                <div><span className="font-bold text-gray-900">Date Range:</span> {stockFilters.startDate || 'Start'} to {stockFilters.endDate || 'Present'}</div>
                                {stockFilters.productName && <div><span className="font-bold text-gray-900">Product:</span> {stockFilters.productName}</div>}
                                {stockFilters.lcNo && <div><span className="font-bold text-gray-900">LC No:</span> <span className="text-blue-700 font-extrabold">{stockFilters.lcNo}</span></div>}
                            </div>
                            <div className="font-bold"><span className="text-gray-900">Printed on:</span> <span className="text-gray-900">{new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'numeric', year: 'numeric' })}</span></div>
                        </div>

                        <div className="overflow-x-auto border border-gray-900">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-900">
                                        <th className="border-r border-gray-900 px-2 py-1 text-left text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[4%] text-center">SL</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-left text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[20%]">Product<br />Name</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-left text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[12%]">Brand</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">Total Inhouse<br />PKT</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[13%] whitespace-nowrap">Total Inhouse<br />QTY</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[11%] whitespace-nowrap">Inhouse<br />PKT</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">Inhouse<br />QTY</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[8%] whitespace-nowrap">Sale<br />PKT</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[8%] whitespace-nowrap">Sale<br />QTY</th>
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
                                                            const pkt = parseFloat(ent.totalInHousePacket) || 0;
                                                            const qty = parseFloat(ent.totalInHouseQuantity) || 0;
                                                            const size = parseFloat(ent.packetSize) || 0;
                                                            const whole = Math.floor(pkt);
                                                            const rem = Math.round(qty - (whole * size));
                                                            return <div key={i} className="leading-tight">{whole}{rem > 0 ? ` - ${rem} kg` : ''}</div>;
                                                        })}
                                                        {hasTotal && (
                                                            <div className="mt-0 pt-0.5 border-t border-gray-900 font-bold leading-tight">
                                                                {(() => {
                                                                    const totalWhole = item.brandList.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.totalInHousePacket) || 0), 0);
                                                                    const totalRem = Math.round(item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.totalInHouseQuantity) || 0) - (Math.floor(parseFloat(ent.totalInHousePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0));
                                                                    return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                                                                })()}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[14px] text-right text-gray-900 font-bold align-top whitespace-nowrap">
                                                        {item.brandList.map((ent, i) => <div key={i} className="leading-tight">{Math.round(ent.totalInHouseQuantity)}</div>)}
                                                        {hasTotal && <div className="mt-0 pt-0.5 border-t border-gray-900 font-black leading-tight">{Math.round(item.totalInHouseQuantity)}</div>}
                                                    </td>
                                                    {/* Inhouse Remaining Column */}
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[14px] text-right text-gray-900 font-medium align-top whitespace-nowrap">
                                                        {item.brandList.map((ent, i) => {
                                                            const pkt = parseFloat(ent.inHousePacket) || 0;
                                                            const qty = parseFloat(ent.inHouseQuantity) || 0;
                                                            const size = parseFloat(ent.packetSize) || 0;
                                                            const whole = Math.floor(pkt);
                                                            const rem = Math.round(qty - (whole * size));
                                                            return <div key={i} className="leading-tight">{whole}{rem > 0 ? ` - ${rem} kg` : ''}</div>;
                                                        })}
                                                        {hasTotal && (
                                                            <div className="mt-0 pt-0.5 border-t border-gray-900 font-bold leading-tight">
                                                                {(() => {
                                                                    const totalWhole = item.brandList.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.inHousePacket) || 0), 0);
                                                                    const totalRem = Math.round(item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.inHouseQuantity) || 0) - (Math.floor(parseFloat(ent.inHousePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0));
                                                                    return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                                                                })()}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[14px] text-right text-gray-900 font-bold align-top whitespace-nowrap">
                                                        {item.brandList.map((ent, i) => <div key={i} className="leading-tight">{Math.round(ent.inHouseQuantity)}</div>)}
                                                        {hasTotal && <div className="mt-0 pt-0.5 border-t border-gray-900 font-black leading-tight">{Math.round(item.inHouseQuantity)}</div>}
                                                    </td>
                                                    {/* Sales Column */}
                                                    <td className="border-r border-gray-900 px-2 py-0.5 text-[14px] text-right text-gray-900 font-medium align-top whitespace-nowrap">
                                                        {item.brandList.map((ent, i) => <div key={i} className="leading-tight">{parseFloat(ent.salePacket) || 0}</div>)}
                                                        {hasTotal && <div className="mt-0 pt-0.5 border-t border-gray-900 font-bold leading-tight text-right">{item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.salePacket) || 0), 0)}</div>}
                                                    </td>
                                                    <td className="px-2 py-0.5 text-[14px] text-right text-gray-900 font-bold whitespace-nowrap border-gray-900 align-top">
                                                        {item.brandList.map((ent, i) => <div key={i} className="leading-tight">{Math.round(ent.saleQuantity)}</div>)}
                                                        {hasTotal && <div className="mt-0 pt-0.5 border-t border-gray-900 font-black leading-tight">{Math.round(item.saleQuantity)}</div>}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-500 italic text-[14px]">No records found for the selected criteria.</td></tr>
                                    )}
                                </tbody>
                                {stockData.displayRecords.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-100 border-t-2 border-gray-900">
                                            <td colSpan="3" className="px-2 py-1.5 text-[14px] font-black text-gray-900 text-right uppercase tracking-wider border-r border-gray-900">Grand Total</td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900">
                                                {(() => {
                                                    const totalWhole = stockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.totalInHousePacket) || 0), 0), 0);
                                                    const totalRem = Math.round(stockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.totalInHouseQuantity) || 0) - (Math.floor(parseFloat(ent.totalInHousePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0), 0));
                                                    return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                                                })()}
                                            </td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900">
                                                {Math.round(stockData.totalTotalInHouseQty)}
                                            </td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900">
                                                {(() => {
                                                    const totalWhole = stockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.inHousePacket) || 0), 0), 0);
                                                    const totalRem = Math.round(stockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.inHouseQuantity) || 0) - (Math.floor(parseFloat(ent.inHousePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0), 0));
                                                    return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                                                })()}
                                            </td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900">
                                                {Math.round(stockData.totalInHouseQty)}
                                            </td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900">
                                                {stockData.displayRecords.reduce((sum, item) => sum + item.brandList.reduce((s, ent) => s + (parseFloat(ent.salePacket) || 0), 0), 0)}
                                            </td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900">
                                                {Math.round(stockData.totalSaleQty)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        <div className="grid grid-cols-2 gap-6 pt-6 px-2 print:grid">
                            <div className="border-2 border-gray-100 p-6 rounded-3xl bg-white shadow-sm print:border-gray-200">
                                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Total Packets</div>
                                <div className="text-2xl font-black text-gray-900">
                                    {(() => {
                                        const totalWhole = stockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.inHousePacket) || 0), 0), 0);
                                        const totalRem = Math.round(stockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.inHouseQuantity) || 0) - (Math.floor(parseFloat(ent.inHousePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0), 0));
                                        return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                                    })()}
                                </div>
                            </div>
                            <div className="border-2 border-gray-100 p-6 rounded-3xl bg-white shadow-sm print:border-gray-200">
                                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 text-blue-500">Total Quantity</div>
                                <div className="text-3xl font-black text-blue-600">{Math.round(stockData.totalInHouseQty)} <span className="text-lg font-bold">{stockData.unit}</span></div>
                            </div>
                        </div>

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

export default StockReport;
