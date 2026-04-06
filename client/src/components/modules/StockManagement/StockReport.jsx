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
    const [reportType, setReportType] = useState('short'); // 'short' or 'detailed'
    const [searchQuery, setSearchQuery] = useState('');
    const [filterSearchInputs, setFilterSearchInputs] = useState({ warehouseSearch: '', brandSearch: '', productSearch: '', categorySearch: '' });
    const [filterDropdownOpen, setFilterDropdownOpen] = useState({ warehouse: false, brand: false, product: false, category: false });
    const initialFilterDropdownState = { warehouse: false, brand: false, product: false, category: false };

    // --- Search & Filter Logic ---
    const filteredRecords = React.useMemo(() => {
        if (!searchQuery.trim()) return stockData.displayRecords;

        const query = searchQuery.toLowerCase().trim();
        return stockData.displayRecords.map(item => {
            const matchesProduct = (item.productName || '').toLowerCase().includes(query);

            // Filter brands within the product
            const filteredBrands = item.brandList.filter(brand =>
                (brand.brand || '').toLowerCase().includes(query) || matchesProduct
            );

            if (filteredBrands.length > 0) {
                // IMPORTANT: Recalculate item-level totals for the filtered brands
                const inHouseQuantity = filteredBrands.reduce((sum, b) => sum + Math.max(0, b.inHouseQuantity || 0), 0);
                const totalInHouseQuantity = filteredBrands.reduce((sum, b) => sum + Math.max(0, b.totalInHouseQuantity || 0), 0);
                const saleQuantity = filteredBrands.reduce((sum, b) => sum + Math.max(0, b.saleQuantity || 0), 0);
                const salePacket = filteredBrands.reduce((sum, b) => sum + Math.max(0, parseFloat(b.salePacket) || 0), 0);

                return {
                    ...item,
                    brandList: filteredBrands,
                    inHouseQuantity,
                    totalInHouseQuantity,
                    saleQuantity,
                    salePacket
                };
            }
            return null;
        }).filter(Boolean);
    }, [stockData.displayRecords, searchQuery]);

    // Recalculate totals based on filteredRecords
    const totals = React.useMemo(() => {
        let totalTotalInHouseQty = 0;
        let totalSaleQty = 0;
        let totalInHouseQty = 0;
        let totalSalePkt = 0;

        filteredRecords.forEach(item => {
            totalTotalInHouseQty += Math.max(0, item.totalInHouseQuantity || 0);
            totalSaleQty += Math.max(0, item.saleQuantity || 0);
            totalInHouseQty += Math.max(0, item.inHouseQuantity || 0);
            totalSalePkt += Math.max(0, item.salePacket || 0);
        });

        return { totalTotalInHouseQty, totalSaleQty, totalInHouseQty, totalSalePkt };
    }, [filteredRecords]);

    const filteredStockData = React.useMemo(() => ({
        ...stockData,
        displayRecords: filteredRecords,
        totalTotalInHouseQty: totals.totalTotalInHouseQty,
        totalSaleQty: totals.totalSaleQty,
        totalInHouseQty: totals.totalInHouseQty,
        totalSalePkt: totals.totalSalePkt
    }), [stockData, filteredRecords, totals]);

    const filterButtonRef = useRef(null);
    const filterPanelRef = useRef(null);
    const warehouseFilterRef = useRef(null);
    const productFilterRef = useRef(null);
    const brandFilterRef = useRef(null);
    const categoryFilterRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target && !document.body.contains(event.target)) {
                return;
            }
            if (showFilterPanel && filterPanelRef.current && !filterPanelRef.current.contains(event.target) && !filterButtonRef.current.contains(event.target)) {
                setShowFilterPanel(false);
            }
            if (filterDropdownOpen.warehouse && warehouseFilterRef.current && !warehouseFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, warehouse: false }));
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
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-blue-50 rounded-lg sm:rounded-xl">
                            <BarChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                        </div>
                        <h3 className="text-base sm:text-lg lg:text-xl font-black text-gray-800 truncate leading-none">Stock Report</h3>
                    </div>

                    {/* Quick Search Bar */}
                    <div className="hidden md:flex relative flex-1 max-w-sm mx-4 no-print">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Find product or brand..."
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

                    <div className="flex items-center justify-end gap-1.5 sm:gap-3 flex-shrink-0">
                        <div className="relative group no-print">
                            <select
                                value={reportType}
                                onChange={(e) => setReportType(e.target.value)}
                                className="appearance-none bg-white border border-gray-200 text-gray-700 py-2.5 pl-4 pr-10 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer hover:border-gray-300"
                            >
                                <option value="short">Short Report</option>
                                <option value="detailed">Details Report</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                </svg>
                            </div>
                        </div>

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
                                    <div ref={filterPanelRef} className="fixed inset-x-4 top-24 md:absolute md:top-full md:right-0 md:mt-2 w-auto md:w-[22rem] bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[2010] p-4 flex flex-col mb-4 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 flex-shrink-0">
                                            <h4 className="font-bold text-gray-900 text-sm">Advance Filter</h4>
                                            <button
                                                onClick={() => {
                                                    setStockFilters({ startDate: '', endDate: '', warehouse: '', brand: '', productName: '', category: '' });
                                                    setFilterSearchInputs({ warehouseSearch: '', brandSearch: '', productSearch: '', categorySearch: '' });
                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                }}
                                                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                                            >
                                                Reset
                                            </button>
                                        </div>

                                        <div className="space-y-3">
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

                                            {/* Warehouse Selection */}
                                            <div className="space-y-1.5 relative" ref={warehouseFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Warehouse</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.warehouseSearch}
                                                        onChange={(e) => {
                                                            setFilterSearchInputs({ ...filterSearchInputs, warehouseSearch: e.target.value });
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, warehouse: true });
                                                        }}
                                                        onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, warehouse: true })}
                                                        placeholder={stockFilters.warehouse || "Search Warehouse..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${stockFilters.warehouse ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {stockFilters.warehouse && (
                                                            <button onClick={() => { setStockFilters({ ...stockFilters, warehouse: '' }); setFilterSearchInputs({ ...filterSearchInputs, warehouseSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.warehouse && (() => {
                                                    const options = getUniqueOptions('warehouse');
                                                    const filtered = options.filter(wh => wh.toLowerCase().includes(filterSearchInputs.warehouseSearch.toLowerCase()));
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(wh => (
                                                                <button key={wh} type="button" onClick={() => { setStockFilters({ ...stockFilters, warehouse: wh }); setFilterSearchInputs({ ...filterSearchInputs, warehouseSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors">{wh}</button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
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
                        <button onClick={() => generateStockReportPDF(filteredStockData, stockFilters, reportType)} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg sm:rounded-xl shadow-lg shadow-blue-500/30 transition-all no-print">
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
                                {stockFilters.warehouse && <div className="flex"><span className="font-bold text-gray-900 w-28">Warehouse:</span> <span className="text-blue-700 font-extrabold">{stockFilters.warehouse}</span></div>}
                            </div>
                            <div className="font-bold"><span className="text-gray-900">Printed on:</span> <span className="text-gray-900">{formatDate(new Date().toISOString().split('T')[0])}</span></div>
                        </div>

                        {/* Desktop/Print Table View */}
                        <div className="hidden md:block print:block overflow-x-auto border border-gray-900">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-900">
                                        <th className="border-r border-gray-900 px-2 py-1 text-left text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[4%] text-center" rowSpan={2}>SL</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-left text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[12%]" rowSpan={2}>Product<br />Name</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-left text-[13px] font-bold text-gray-900 uppercase tracking-wider w-[18%]" rowSpan={2}>Brand</th>
                                        {reportType === 'detailed' && (
                                            <>
                                                <th className="border-r border-gray-900 px-1 py-1 text-center text-[11px] font-bold text-gray-900 uppercase tracking-wider" colSpan={2}>Opening Stock</th>
                                                <th className="border-r border-gray-900 px-1 py-1 text-center text-[11px] font-bold text-gray-900 uppercase tracking-wider" colSpan={2}>Sale</th>
                                            </>
                                        )}
                                        <th className="px-1 py-1 text-center text-[11px] font-bold text-gray-900 uppercase tracking-wider border-b border-gray-900" colSpan={2}>Closing Stock</th>
                                    </tr>
                                    <tr className="bg-gray-50 border-b border-gray-900">
                                        {reportType === 'detailed' && (
                                            <>
                                                <th className="border-r border-gray-900 px-2 py-1 text-right text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[10%]">BAG</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-right text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[10%]">QTY</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-right text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[8%]">BAG</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-right text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[8%]">QTY</th>
                                            </>
                                        )}
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[10%]">BAG</th>
                                        <th className="px-2 py-1 text-right text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[10%]">QTY</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-900">
                                    {filteredRecords.length > 0 ? (
                                        filteredRecords.map((item, index) => {
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
                                                    {reportType === 'detailed' && (
                                                        <>
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
                                                            <td className="border-r border-gray-900 px-2 py-0.5 text-[14px] text-right text-gray-900 font-medium align-top whitespace-nowrap">
                                                                {item.brandList.map((ent, i) => {
                                                                    const sPkt = parseFloat(ent.salePacket) || 0;
                                                                    return <div key={i} className="leading-tight">{Number.isInteger(sPkt) ? sPkt : sPkt.toFixed(2)}</div>;
                                                                })}
                                                                {hasTotal && <div className="mt-0 pt-0.5 border-t border-gray-900 font-bold leading-tight text-right">{Number.isInteger(item.salePacket) ? item.salePacket : (item.salePacket || 0).toFixed(2)}</div>}
                                                            </td>
                                                            <td className="border-r border-gray-900 px-2 py-0.5 text-[14px] text-right text-gray-900 font-bold align-top whitespace-nowrap">
                                                                {item.brandList.map((ent, i) => <div key={i} className="leading-tight">{Math.round(ent.saleQuantity)}</div>)}
                                                                {hasTotal && <div className="mt-0 pt-0.5 border-t border-gray-900 font-black leading-tight">{Math.round(item.saleQuantity)}</div>}
                                                            </td>
                                                        </>
                                                    )}
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
                                {filteredRecords.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-100 border-t-2 border-gray-900">
                                            <td colSpan="3" className="px-2 py-1.5 text-[14px] font-black text-gray-900 text-right uppercase tracking-wider border-r border-gray-900">Grand Total</td>
                                            {reportType === 'detailed' && (
                                                <>
                                                    <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900">
                                                        {(() => {
                                                            const totalWhole = filteredRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + calculatePktRemainder(Math.max(0, ent.totalInHouseQuantity || 0), ent.packetSize).whole, 0), 0);
                                                            const totalRem = filteredRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + calculatePktRemainder(Math.max(0, ent.totalInHouseQuantity || 0), ent.packetSize).remainder, 0), 0);
                                                            return `${totalWhole}${totalRem !== 0 ? ` - ${Math.abs(totalRem).toLocaleString()} kg` : ''}`;
                                                        })()}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900">
                                                        {Math.round(totals.totalTotalInHouseQty)}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900">
                                                        {Number.isInteger(totals.totalSalePkt) ? totals.totalSalePkt : (totals.totalSalePkt || 0).toFixed(2)}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900">
                                                        {Math.round(totals.totalSaleQty)}
                                                    </td>
                                                </>
                                            )}
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900">
                                                {(() => {
                                                    const totalWhole = filteredRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + calculatePktRemainder(Math.max(0, ent.inHouseQuantity || 0), ent.packetSize).whole, 0), 0);
                                                    const totalRem = filteredRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + calculatePktRemainder(Math.max(0, ent.inHouseQuantity || 0), ent.packetSize).remainder, 0), 0);
                                                    return `${totalWhole}${totalRem !== 0 ? ` - ${Math.abs(totalRem).toLocaleString()} kg` : ''}`;
                                                })()}
                                            </td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900">
                                                {Math.round(totals.totalInHouseQty)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        <div className="md:hidden print:hidden space-y-4">
                            {filteredRecords.length > 0 ? (
                                filteredRecords.map((item, index) => (
                                    <div key={index} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                        <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                                            <h4 className="font-black text-gray-900 tracking-tight">{item.productName}</h4>
                                            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">#{index + 1}</span>
                                        </div>
                                        <div className="p-4 space-y-4">
                                            {item.brandList.map((ent, bIndex) => (
                                                <div key={bIndex} className="space-y-3 pb-4 last:pb-0 border-b last:border-0 border-gray-50">
                                                    <div className="flex justify-center items-center w-full">
                                                        <span className="text-lg sm:text-xl font-black text-blue-600 text-center">{ent.brand}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                                        <div className="space-y-0.5">
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Inhouse</p>
                                                            <p className="text-xs font-bold text-gray-700">
                                                                {(() => {
                                                                    const { whole, remainder } = calculatePktRemainder(ent.totalInHouseQuantity, ent.packetSize);
                                                                    return `${whole}${remainder !== 0 ? ` - ${Math.abs(remainder)} kg` : ''}`;
                                                                })()} BAG
                                                            </p>
                                                            <p className="text-sm font-black text-gray-900">{Math.round(ent.totalInHouseQuantity).toLocaleString()} kg</p>
                                                        </div>
                                                        <div className="space-y-0.5 text-right">
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sale</p>
                                                            <p className="text-xs font-bold text-gray-700">
                                                                {Number.isInteger(parseFloat(ent.salePacket)) ? parseFloat(ent.salePacket) : (parseFloat(ent.salePacket) || 0).toFixed(2)} BAG
                                                            </p>
                                                            <p className="text-sm font-black text-gray-900">{Math.round(ent.saleQuantity).toLocaleString()} kg</p>
                                                        </div>
                                                        <div className="col-span-full w-full pt-3 pb-2 border-t border-gray-100 flex flex-col items-center justify-center text-center">
                                                            <p className="text-[10px] sm:text-xs font-bold text-blue-400 uppercase tracking-[0.1em] mb-1">Remaining Inhouse</p>
                                                            <div className="flex flex-col items-center justify-center w-full space-y-0.5">
                                                                <p className="text-lg sm:text-xl font-black text-blue-600 text-center">
                                                                    {(() => {
                                                                        const { whole, remainder } = calculatePktRemainder(ent.inHouseQuantity, ent.packetSize);
                                                                        return `${whole}${remainder !== 0 ? ` - ${Math.abs(remainder)} kg` : ''}`;
                                                                    })()} BAG
                                                                </p>
                                                                <p className="text-lg sm:text-xl font-black text-blue-600 text-center">
                                                                    {Math.round(ent.inHouseQuantity).toLocaleString()} kg
                                                                </p>
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
                                                            <p className="text-sm font-black text-gray-900">{Math.round(item.totalInHouseQuantity).toLocaleString()} kg</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] font-bold text-blue-500">Net Stock</p>
                                                            <p className="text-sm font-black text-blue-600">{Math.round(item.inHouseQuantity).toLocaleString()} kg</p>
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
                            {filteredRecords.length > 0 && (
                                <div className="mt-8 p-5 bg-gray-900 rounded-2xl shadow-xl shadow-gray-200">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 text-center">Grand Total Summary</h4>
                                    <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Total Inhouse</p>
                                            <p className="text-xl font-black text-white text-center">{Math.round(totals.totalTotalInHouseQty).toLocaleString()}<span className="text-[10px] ml-1 text-gray-400 uppercase">kg</span></p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Total Sale</p>
                                            <p className="text-xl font-black text-white text-center">{Math.round(totals.totalSaleQty).toLocaleString()}<span className="text-[10px] ml-1 text-gray-400 uppercase">kg</span></p>
                                        </div>
                                        <div className="col-span-full pt-4 border-t border-gray-800 flex flex-col items-center">
                                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-1 text-center">Net Inhouse Stock</p>
                                            <p className="text-4xl font-black text-blue-500 tracking-tighter text-center">{Math.round(totals.totalInHouseQty).toLocaleString()}<span className="text-sm ml-2 text-blue-400 uppercase">kg</span></p>
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
                                    BAG: {(() => {
                                        const totalWhole = filteredRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + calculatePktRemainder(ent.totalInHouseQuantity, ent.packetSize).whole, 0), 0);
                                        const totalRem = filteredRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + calculatePktRemainder(ent.totalInHouseQuantity, ent.packetSize).remainder, 0), 0);
                                        return `${totalWhole}${totalRem !== 0 ? ` - ${Math.abs(totalRem).toLocaleString()} kg` : ''}`;
                                    })()}
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-gray-900">
                                    QTY: {Math.round(totals.totalTotalInHouseQty)} <span className="text-xs sm:text-sm font-bold">{stockData.unit}</span>
                                </div>
                            </div>

                            {/* Card 2: TOTAL SALE */}
                            <div className="border border-gray-200 p-4 sm:p-5 rounded-2xl bg-gray-50 shadow-sm print:border-gray-200">
                                <div className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">Total Sale</div>
                                <div className="text-xs sm:text-sm font-bold text-gray-700 mb-1">
                                    BAG: {Number.isInteger(totals.totalSalePkt) ? totals.totalSalePkt : (totals.totalSalePkt || 0).toFixed(2)}
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-gray-900">
                                    QTY: {Math.round(totals.totalSaleQty)} <span className="text-xs sm:text-sm font-bold">{stockData.unit}</span>
                                </div>
                            </div>

                            {/* Card 3: CURRENT INHOUSE */}
                            <div className="border border-gray-200 p-4 sm:p-5 rounded-2xl bg-white shadow-sm print:border-gray-200">
                                <div className="text-[10px] sm:text-[11px] font-bold text-blue-500 uppercase tracking-wider mb-2 sm:mb-3">Current Inhouse</div>
                                <div className="text-xs sm:text-sm font-bold text-gray-700 mb-1">
                                    BAG: {(() => {
                                        const totalWhole = filteredRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + calculatePktRemainder(ent.inHouseQuantity, ent.packetSize).whole, 0), 0);
                                        const totalRem = filteredRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + calculatePktRemainder(ent.inHouseQuantity, ent.packetSize).remainder, 0), 0);
                                        return `${totalWhole}${totalRem !== 0 ? ` - ${Math.abs(totalRem).toLocaleString()} kg` : ''}`;
                                    })()}
                                </div>
                                <div className="text-2xl sm:text-3xl font-black text-blue-600">
                                    QTY: {Math.round(totals.totalInHouseQty)} <span className="text-sm sm:text-lg font-bold">{stockData.unit}</span>
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
