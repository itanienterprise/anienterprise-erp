import React, { useState, useEffect, useRef } from 'react';
import { SearchIcon, XIcon, BarChartIcon, FunnelIcon, MapPinIcon } from '../../Icons';
import CustomDatePicker from "../../shared/CustomDatePicker";
import { generateWarehouseReportPDF } from '../../../utils/pdfGenerator';
import { formatDate } from '../../../utils/helpers';

const WarehouseReport = ({
    isOpen,
    onClose,
    warehouseData,
    uniqueWarehouses,
    filters,
    setFilters
}) => {
    if (!isOpen) return null;

    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [filterSearchInputs, setFilterSearchInputs] = useState({
        warehouseSearch: '',
        productSearch: '',
        brandSearch: ''
    });
    const [filterDropdownOpen, setFilterDropdownOpen] = useState({
        warehouse: false,
        product: false,
        brand: false
    });

    const filterButtonRef = useRef(null);
    const filterPanelRef = useRef(null);
    const warehouseRef = useRef(null);
    const productRef = useRef(null);
    const brandRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showFilterPanel && filterPanelRef.current && !filterPanelRef.current.contains(event.target) && !filterButtonRef.current.contains(event.target)) {
                setShowFilterPanel(false);
            }
            if (filterDropdownOpen.warehouse && warehouseRef.current && !warehouseRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, warehouse: false }));
            if (filterDropdownOpen.product && productRef.current && !productRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, product: false }));
            if (filterDropdownOpen.brand && brandRef.current && !brandRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, brand: false }));
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                setShowFilterPanel(false);
                setFilterDropdownOpen({ warehouse: false, product: false, brand: false });
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showFilterPanel, filterDropdownOpen]);

    // --- TWO SEPARATE DATA STREAMS ---
    // Stream 1: InHouse records — all stock records, NO warehouse filter (date/product/brand only)
    //   Used to compute global InHouse totals so they are never zeroed out by a warehouse filter
    const inhouseRecords = warehouseData.filter(item => {
        if (item.recordType !== 'stock') return false;
        const itemDate = item.createdAt ? new Date(item.createdAt) : null;
        if (filters.startDate && itemDate && itemDate < new Date(filters.startDate)) return false;
        if (filters.endDate && itemDate && itemDate > new Date(filters.endDate + 'T23:59:59')) return false;
        if (filters.productName && (item.productName || '').trim() !== filters.productName) return false;
        if (filters.brand && (item.brand || '').trim() !== filters.brand) return false;
        const ihQty = parseFloat(item.inhouseQty) || 0;
        return item.hasLCRecord && ihQty > 0;
    });

    // Stream 2: Display records — ALL record types, ALL filters applied strictly (including warehouse)
    const displayRecords = warehouseData.filter(item => {
        const itemDate = item.createdAt ? new Date(item.createdAt) : null;
        if (filters.startDate && itemDate && itemDate < new Date(filters.startDate)) return false;
        if (filters.endDate && itemDate && itemDate > new Date(filters.endDate + 'T23:59:59')) return false;
        if (filters.warehouse && (item.whName || '').trim() !== filters.warehouse) return false;
        if (filters.productName && (item.productName || '').trim() !== filters.productName) return false;
        if (filters.brand && (item.brand || '').trim() !== filters.brand) return false;
        const whQty = parseFloat(item.whQty) || 0;
        if (item.recordType === 'warehouse') return whQty > 0;
        const ihQty = parseFloat(item.inhouseQty) || 0;
        return item.hasLCRecord && (ihQty > 0 || whQty > 0);
    });

    // 1. Compute Global InHouse Totals from inhouseRecords (no warehouse filter applied)
    const globalInHouseTotals = inhouseRecords.reduce((acc, item) => {
        const brandKey = `${(item.productName || '').trim()}|${(item.brand || '-').trim()}`;
        if (!acc[brandKey]) acc[brandKey] = { brandKey, inhouseQty: 0, inhousePkt: 0 };
        acc[brandKey].inhouseQty += parseFloat(item.inhouseQty) || 0;
        acc[brandKey].inhousePkt += parseFloat(item.inhousePkt) || 0;
        return acc;
    }, {});

    // 2. Compute Warehouse Totals from displayRecords (strict warehouse filter)
    const globalBrandTotals = displayRecords.reduce((acc, item) => {
        const brandKey = `${(item.productName || '').trim()}|${(item.brand || '-').trim()}`;
        if (!acc[brandKey]) {
            acc[brandKey] = {
                brandKey,
                // Pull InHouse from the global (unfiltered by warehouse) source
                inhouseQty: globalInHouseTotals[brandKey]?.inhouseQty || 0,
                inhousePkt: globalInHouseTotals[brandKey]?.inhousePkt || 0,
                whQty: 0,
                whPkt: 0
            };
        }
        const isRealWarehouse = item.recordType === 'warehouse' ||
            (item.recordType === 'stock' && (item.whName || '').trim() && (item.whName || '').trim() !== 'General / In Stock');
        if (isRealWarehouse) {
            acc[brandKey].whQty += parseFloat(item.whQty) || 0;
            acc[brandKey].whPkt += parseFloat(item.whPkt) || 0;
        }
        return acc;
    }, {});

    // Ensure all brands that have InHouse stock appear in globalBrandTotals (for grand totals)
    Object.keys(globalInHouseTotals).forEach(brandKey => {
        if (!globalBrandTotals[brandKey]) {
            globalBrandTotals[brandKey] = {
                brandKey,
                inhouseQty: globalInHouseTotals[brandKey].inhouseQty,
                inhousePkt: globalInHouseTotals[brandKey].inhousePkt,
                whQty: 0,
                whPkt: 0
            };
        }
    });

    // 3. Group displayRecords for table: Warehouse -> Product -> Brands
    const groupedData = displayRecords.reduce((acc, item) => {
        const rawWhName = (item.whName || '').trim();
        const whName = rawWhName || 'General / In Stock';
        const prodName = (item.productName || 'Unknown').trim();
        const brand = (item.brand || '-').trim();
        const brandKey = `${prodName}|${brand}`;

        if (!acc[whName]) acc[whName] = { whName, products: {} };
        if (!acc[whName].products[prodName]) {
            acc[whName].products[prodName] = { productName: prodName, brands: {} };
        }
        if (!acc[whName].products[prodName].brands[brand]) {
            acc[whName].products[prodName].brands[brand] = {
                brand,
                inhouseQty: globalBrandTotals[brandKey]?.inhouseQty || 0,
                inhousePkt: globalBrandTotals[brandKey]?.inhousePkt || 0,
                whQty: 0,
                whPkt: 0
            };
        }
        const isRealWarehouse = item.recordType === 'warehouse' ||
            (item.recordType === 'stock' && rawWhName && rawWhName !== 'General / In Stock');
        if (isRealWarehouse) {
            acc[whName].products[prodName].brands[brand].whQty += parseFloat(item.whQty) || 0;
            acc[whName].products[prodName].brands[brand].whPkt += parseFloat(item.whPkt) || 0;
        }
        return acc;
    }, {});


    const displayGroups = Object.values(groupedData).map(wh => ({
        ...wh,
        products: Object.values(wh.products).map(p => ({
            ...p,
            brands: Object.values(p.brands).sort((a, b) => a.brand.localeCompare(b.brand))
        })).sort((a, b) => a.productName.localeCompare(b.productName))
    })).sort((a, b) => a.whName.localeCompare(b.whName));

    // 3. Overall Totals
    const totals = Object.values(globalBrandTotals).reduce((acc, b) => {
        acc.totalInHouseQty += b.inhouseQty;
        acc.totalInHousePkt += b.inhousePkt;
        acc.totalWhQty += b.whQty;
        acc.totalWhPkt += b.whPkt;
        return acc;
    }, { totalInHouseQty: 0, totalInHousePkt: 0, totalWhQty: 0, totalWhPkt: 0 });

    const getUniqueOptions = (key) => {
        return [...new Set(warehouseData.map(item => (item[key] || '').trim()).filter(Boolean))].sort();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 print:p-0 print:bg-white print:backdrop-none">
            <div className="bg-white w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col print:max-h-none print:shadow-none print:rounded-none print:w-full print:h-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 print:hidden">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-xl">
                            <BarChartIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">Warehouse Report</h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${showFilterPanel || Object.values(filters).some(v => v !== '')
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <FunnelIcon className={`w-4 h-4 ${showFilterPanel || Object.values(filters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                                <span className="text-sm font-medium">Filter</span>
                            </button>

                            {/* Floating Filter Panel */}
                            {showFilterPanel && (
                                <div ref={filterPanelRef} className="absolute right-0 mt-3 w-80 bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[110] p-5 animate-in fade-in zoom-in duration-200">
                                    <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
                                        <h4 className="font-bold text-gray-900 text-sm">Advance Filter</h4>
                                        <button
                                            onClick={() => {
                                                setFilters({ startDate: '', endDate: '', warehouse: '', productName: '', brand: '' });
                                                setFilterSearchInputs({ warehouseSearch: '', productSearch: '', brandSearch: '' });
                                                setFilterDropdownOpen({ warehouse: false, product: false, brand: false });
                                            }}
                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                                        >
                                            Reset All
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <CustomDatePicker
                                                label="From Date"
                                                value={filters.startDate}
                                                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                                compact={true}
                                            />
                                            <CustomDatePicker
                                                label="To Date"
                                                value={filters.endDate}
                                                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                                compact={true}
                                                rightAlign={true}
                                            />
                                        </div>

                                        <div className="space-y-1.5 relative" ref={warehouseRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Warehouse</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.warehouseSearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, warehouseSearch: e.target.value });
                                                        setFilterDropdownOpen({ warehouse: true, product: false, brand: false });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ warehouse: true, product: false, brand: false })}
                                                    placeholder={filters.warehouse || "Search warehouse..."}
                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${filters.warehouse ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {filters.warehouse && (
                                                        <button onClick={() => { setFilters({ ...filters, warehouse: '' }); setFilterSearchInputs({ ...filterSearchInputs, warehouseSearch: '' }); setFilterDropdownOpen({ warehouse: false, product: false, brand: false }); }} className="text-gray-400 hover:text-gray-600">
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.warehouse && (() => {
                                                const filtered = uniqueWarehouses.filter(wh => wh.whName.toLowerCase().includes(filterSearchInputs.warehouseSearch.toLowerCase()));
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                        {filtered.map(wh => (
                                                            <button key={wh.whName} type="button" onClick={() => { setFilters({ ...filters, warehouse: wh.whName }); setFilterSearchInputs({ ...filterSearchInputs, warehouseSearch: '' }); setFilterDropdownOpen({ warehouse: false, product: false, brand: false }); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">{wh.whName}</button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        <div className="space-y-1.5 relative" ref={productRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Product</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.productSearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, productSearch: e.target.value });
                                                        setFilterDropdownOpen({ warehouse: false, product: true, brand: false });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ warehouse: false, product: true, brand: false })}
                                                    placeholder={filters.productName || "Search product..."}
                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${filters.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {filters.productName && (
                                                        <button onClick={() => { setFilters({ ...filters, productName: '', brand: '' }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '', brandSearch: '' }); setFilterDropdownOpen({ warehouse: false, product: false, brand: false }); }} className="text-gray-400 hover:text-gray-600">
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
                                                            <button key={p} type="button" onClick={() => { setFilters({ ...filters, productName: p, brand: '' }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '', brandSearch: '' }); setFilterDropdownOpen({ warehouse: false, product: false, brand: false }); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">{p}</button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        <button onClick={() => setShowFilterPanel(false)} className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all mt-2 active:scale-[0.98]">APPLY FILTERS</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button onClick={() => generateWarehouseReportPDF(displayRecords, filters, warehouseData)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 no-print">
                            <BarChartIcon className="w-4 h-4" /> Print Report
                        </button>
                        <button onClick={onClose} className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors no-print"><XIcon className="w-6 h-6 text-gray-500" /></button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-12 bg-white print:p-0">
                    <div className="max-w-[1000px] mx-auto space-y-8">
                        {/* Company Header */}
                        <div className="text-center space-y-1">
                            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">M/S ANI ENTERPRISE</h1>
                            <p className="text-[14px] text-gray-600">766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh</p>
                            <p className="text-[14px] text-gray-600">+8802588813057, +8801711-406898, anienterprise051@gmail.com, www.anienterprises.com.bd</p>
                        </div>

                        <div className="border-t-2 border-gray-900 w-full mt-4"></div>

                        {/* Title */}
                        <div className="flex justify-center -mt-6">
                            <div className="bg-white border-2 border-gray-900 px-12 py-1.5 inline-block">
                                <h2 className="text-xl font-bold text-gray-900 tracking-wide uppercase">Warehouse Stock Report</h2>
                            </div>
                        </div>

                        {/* Info Row */}
                        <div className="flex justify-between items-end text-[14px] text-gray-800 pt-6 px-2">
                            <div className="flex flex-col gap-1.5">
                                <div><span className="font-bold text-gray-900">Date Range:</span> {filters.startDate || 'Start'} to {filters.endDate || 'Present'}</div>
                                {filters.warehouse && <div><span className="font-bold text-gray-900">Warehouse:</span> {filters.warehouse}</div>}
                                {filters.productName && <div><span className="font-bold text-gray-900">Product:</span> {filters.productName}</div>}
                            </div>
                            <div className="font-bold"><span className="text-gray-900">Printed on:</span> <span className="text-gray-900">{new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'numeric', year: 'numeric' })}</span></div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto border border-gray-900">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-900">
                                        <th className="border-r border-gray-900 px-2 py-1 text-center text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[4%]">SL</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-left text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[10%]">Warehouse</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-left text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[15%]">Product Name</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-left text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[33%]">Brand</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[10%]">Inhouse QTY</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[8%]">Inhouse PKT</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[10%]">Warehouse QTY</th>
                                        <th className="px-2 py-1 text-right text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[8%]">Warehouse PKT</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-900">
                                    {displayGroups.length > 0 ? (() => {
                                        return displayGroups.map((whGroup, whIdx) => {
                                            const totalRowsForWarehouse = whGroup.products.reduce((sum, p) => sum + p.brands.length + (p.brands.length > 1 ? 1 : 0), 0);

                                            return whGroup.products.map((pGroup, pIdx) => {
                                                const hasTotal = pGroup.brands.length > 1;
                                                const totalRowsForProduct = pGroup.brands.length + (hasTotal ? 1 : 0);

                                                return (
                                                    <React.Fragment key={`${whGroup.whName}-${pIdx}`}>
                                                        {pGroup.brands.map((brandItem, bIdx) => (
                                                            <tr key={bIdx} className="border-b border-gray-900 hover:bg-gray-50 transition-colors">
                                                                {pIdx === 0 && bIdx === 0 && (
                                                                    <>
                                                                        <td rowSpan={totalRowsForWarehouse} className="border-r border-gray-900 px-2 py-1 text-[13px] text-gray-900 text-center align-top font-medium bg-white">{whIdx + 1}</td>
                                                                        <td rowSpan={totalRowsForWarehouse} className="border-r border-gray-900 px-2 py-1 text-[13px] font-bold text-gray-900 align-top uppercase leading-tight bg-white">
                                                                            {whGroup.whName}
                                                                        </td>
                                                                    </>
                                                                )}
                                                                {bIdx === 0 && (
                                                                    <td rowSpan={totalRowsForProduct} className="border-r border-gray-900 px-2 py-1 text-[13px] font-bold text-gray-900 align-top uppercase leading-tight bg-white">
                                                                        {pGroup.productName}
                                                                    </td>
                                                                )}
                                                                <td className="border-r border-gray-900 px-2 py-1 text-[13px] text-gray-900 align-top uppercase whitespace-nowrap">
                                                                    {brandItem.brand || '-'}
                                                                </td>
                                                                <td className="border-r border-gray-900 px-2 py-1 text-right text-[13px] text-gray-900 align-top font-medium">
                                                                    {Math.round(parseFloat(brandItem.inhouseQty) || 0).toLocaleString()}
                                                                </td>
                                                                <td className="border-r border-gray-900 px-2 py-1 text-right text-[13px] text-gray-900 align-top font-medium">
                                                                    {Math.round(parseFloat(brandItem.inhousePkt) || 0).toLocaleString()}
                                                                </td>
                                                                <td className="border-r border-gray-900 px-2 py-1 text-right text-[13px] text-gray-900 align-top font-bold">
                                                                    {Math.round(parseFloat(brandItem.whQty) || 0).toLocaleString()}
                                                                </td>
                                                                <td className="px-2 py-1 text-right text-[13px] text-gray-900 align-top font-bold">
                                                                    {Math.round(parseFloat(brandItem.whPkt) || 0).toLocaleString()}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {hasTotal && (
                                                            <tr className="border-b border-gray-900 bg-gray-50/50">
                                                                <td className="border-r border-gray-900 px-2 py-1 text-[13px] font-bold text-gray-900 text-right uppercase tracking-wider bg-gray-50/30 italic">Sub Total</td>
                                                                <td className="border-r border-gray-900 px-2 py-1 text-right text-[13px] font-black text-gray-900">
                                                                    {Math.round(pGroup.brands.reduce((sum, b) => sum + (parseFloat(b.inhouseQty) || 0), 0)).toLocaleString()}
                                                                </td>
                                                                <td className="border-r border-gray-900 px-2 py-1 text-right text-[13px] font-black text-gray-900 text-emerald-700">
                                                                    {Math.round(pGroup.brands.reduce((sum, b) => sum + (parseFloat(b.inhousePkt) || 0), 0)).toLocaleString()}
                                                                </td>
                                                                <td className="border-r border-gray-900 px-2 py-1 text-right text-[13px] font-black text-gray-900">
                                                                    {Math.round(pGroup.brands.reduce((sum, b) => sum + (parseFloat(b.whQty) || 0), 0)).toLocaleString()}
                                                                </td>
                                                                <td className="px-2 py-1 text-right text-[13px] font-black text-gray-900 text-blue-700">
                                                                    {Math.round(pGroup.brands.reduce((sum, b) => sum + (parseFloat(b.whPkt) || 0), 0)).toLocaleString()}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            });
                                        });
                                    })() : (
                                        <tr>
                                            <td colSpan="8" className="px-4 py-8 text-center text-gray-500 italic text-[14px]">No warehouse stock data matches your criteria</td>
                                        </tr>
                                    )}
                                </tbody>
                                {displayGroups.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-100 border-t-2 border-gray-900">
                                            <td colSpan="4" className="px-2 py-1.5 text-[14px] font-black text-gray-900 text-right uppercase tracking-wider border-r border-gray-900">Grand Total</td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900">
                                                {Math.round(totals.totalInHouseQty).toLocaleString()}
                                            </td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900 text-emerald-700">
                                                {Math.round(totals.totalInHousePkt).toLocaleString()}
                                            </td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900">
                                                {Math.round(totals.totalWhQty).toLocaleString()}
                                            </td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 text-blue-700">
                                                {Math.round(totals.totalWhPkt).toLocaleString()}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-4 pt-6 px-2 no-print">
                            {/* Card 1: Total InHouse Stock */}
                            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-center">
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Total InHouse Stock</span>
                                </div>
                                <div className="px-4 py-3 space-y-1.5 text-center">
                                    <div>
                                        <span className="text-[12px] font-semibold text-gray-500">PKT: </span>
                                        <span className="text-[15px] font-black text-gray-900">{Math.round(totals.totalInHousePkt).toLocaleString()}</span>
                                    </div>
                                    <div>
                                        <span className="text-[12px] font-semibold text-gray-500">QTY: </span>
                                        <span className="text-[15px] font-black text-gray-900">{Math.round(totals.totalInHouseQty).toLocaleString()} <span className="text-[11px] font-semibold text-gray-400">kg</span></span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Warehouse Stock */}
                            <div className="rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden">
                                <div className="bg-blue-50 px-4 py-2 border-b border-blue-100 text-center">
                                    <span className="text-[11px] font-bold text-blue-500 uppercase tracking-widest">Warehouse Stock</span>
                                </div>
                                <div className="px-4 py-3 space-y-1.5 text-center">
                                    <div>
                                        <span className="text-[12px] font-semibold text-gray-500">PKT: </span>
                                        <span className="text-[15px] font-black text-blue-700">{Math.round(totals.totalWhPkt).toLocaleString()}</span>
                                    </div>
                                    <div>
                                        <span className="text-[12px] font-semibold text-gray-500">QTY: </span>
                                        <span className="text-[15px] font-black text-blue-700">{Math.round(totals.totalWhQty).toLocaleString()} <span className="text-[11px] font-semibold text-blue-300">kg</span></span>
                                    </div>
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

export default WarehouseReport;
