import React, { useState, useEffect, useRef } from 'react';
import { SearchIcon, XIcon, BarChartIcon, FunnelIcon, MapPinIcon, PrinterIcon } from '../../Icons';
import CustomDatePicker from "../../shared/CustomDatePicker";
import { generateWarehouseReportPDF } from '../../../utils/pdfGenerator';
import { formatDate } from '../../../utils/helpers';
import { calculatePktRemainder } from '../../../utils/stockHelpers';

const WarehouseReport = ({
    isOpen,
    onClose,
    warehouseData,
    uniqueWarehouses,
    filters,
    setFilters,
    salesRecords = [],
    products = []
}) => {
    if (!isOpen) return null;

    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [filterSearchInputs, setFilterSearchInputs] = useState({
        warehouseSearch: '',
        productSearch: '',
        brandSearch: '',
        categorySearch: ''
    });
    const [filterDropdownOpen, setFilterDropdownOpen] = useState({
        warehouse: false,
        product: false,
        brand: false,
        category: false
    });

    // --- Mobile Accordion State ---
    const [expandedMobileWHIndex, setExpandedMobileWHIndex] = useState(null);
    const [expandedMobileProdIndex, setExpandedMobileProdIndex] = useState(null);

    const toggleMobileWH = (idx) => {
        setExpandedMobileWHIndex(prev => {
            if (prev !== idx) setExpandedMobileProdIndex(null);
            return prev === idx ? null : idx;
        });
    };

    const toggleMobileProd = (idx) => {
        setExpandedMobileProdIndex(prev => prev === idx ? null : idx);
    };

    const filterButtonRef = useRef(null);
    const filterPanelRef = useRef(null);
    const warehouseRef = useRef(null);
    const productRef = useRef(null);
    const brandRef = useRef(null);
    const categoryRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showFilterPanel && filterPanelRef.current && !filterPanelRef.current.contains(event.target) && !filterButtonRef.current.contains(event.target)) {
                setShowFilterPanel(false);
            }
            if (filterDropdownOpen.warehouse && warehouseRef.current && !warehouseRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, warehouse: false }));
            if (filterDropdownOpen.product && productRef.current && !productRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, product: false }));
            if (filterDropdownOpen.brand && brandRef.current && !brandRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, brand: false }));
            if (filterDropdownOpen.category && categoryRef.current && !categoryRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, category: false }));
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                setShowFilterPanel(false);
                setFilterDropdownOpen({ warehouse: false, product: false, brand: false, category: false });
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
    // 1. Calculate Global Stock Map: { [brandKey]: { inhouseQty, inhousePkt } }
    // This is the total stock (received) for each brand, minus ALL sales for that brand.
    const globalStockMap = {};

    // Sum from all records
    warehouseData.forEach(item => {
        if (!item.hasLCRecord && item.recordType !== 'warehouse') return;
        // Exclude "Requested" items from stock calculations as they are not yet officially in stock
        if ((item.status || '').toLowerCase().includes('requested')) return;

        const prodName = (item.productName || item.product || '').trim().toLowerCase();
        const brandName = (item.brand || '').trim().toLowerCase();
        const brandKey = `${prodName}|${brandName}`;

        if (!globalStockMap[brandKey]) {
            globalStockMap[brandKey] = { inhouseQty: 0, inhousePkt: 0, pktSize: parseFloat(item.packetSize || item.size || 0) };
        }
        globalStockMap[brandKey].inhouseQty += parseFloat(item.whQty) || 0;
        globalStockMap[brandKey].inhousePkt += parseFloat(item.whPkt) || 0;
    });

    // Subtract ALL sales for each brand
    salesRecords.forEach(sale => {
        if (sale.items) {
            sale.items.forEach(si => {
                const prodName = (si.productName || si.product || '').trim().toLowerCase();
                if (si.brandEntries) {
                    si.brandEntries.forEach(be => {
                        const brandName = (be.brand || '').trim().toLowerCase();
                        const brandKey = `${prodName}|${brandName}`;
                        const sQty = parseFloat(be.quantity) || 0;

                        if (globalStockMap[brandKey]) {
                            globalStockMap[brandKey].inhouseQty -= sQty;
                            const size = globalStockMap[brandKey].pktSize || 0;
                            if (size > 0) globalStockMap[brandKey].inhousePkt -= (sQty / size);
                        } else if (brandName === '') {
                            // Single-entry: try product-name-as-brand key (e.g., 'maize|-')
                            const fallbackKey = `${prodName}|-`;
                            const target = globalStockMap[fallbackKey] ||
                                Object.entries(globalStockMap).find(([k]) => k.startsWith(`${prodName}|`))?.[1];
                            const targetKey = globalStockMap[fallbackKey] ? fallbackKey :
                                Object.keys(globalStockMap).find(k => k.startsWith(`${prodName}|`));
                            if (targetKey && globalStockMap[targetKey]) {
                                globalStockMap[targetKey].inhouseQty -= sQty;
                                const size = globalStockMap[targetKey].pktSize || 0;
                                if (size > 0) globalStockMap[targetKey].inhousePkt -= (sQty / size);
                            }
                        }
                    });
                }
            });
        }
    });

    // Ensure no negatives — except for 'GENERAL' category products which allow pre-sales
    Object.keys(globalStockMap).forEach(key => {
        const [prodName] = key.split('|');
        const product = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === prodName);
        const category = (product?.category || '').trim().toUpperCase();

        if (category !== 'GENERAL') {
            globalStockMap[key].inhouseQty = Math.max(0, globalStockMap[key].inhouseQty);
            globalStockMap[key].inhousePkt = Math.max(0, globalStockMap[key].inhousePkt);
        }
    });

    // --- SECOND PASS: Include sales for 'GENERAL' products that have NO stock records ---
    salesRecords.forEach(sale => {
        if (!sale.items || !Array.isArray(sale.items)) return;
        sale.items.forEach(si => {
            const prodName = (si.productName || si.product || '').trim().toLowerCase();
            const product = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === prodName);
            if ((product?.category || '').trim().toUpperCase() !== 'GENERAL') return;

            if (si.brandEntries && Array.isArray(si.brandEntries)) {
                si.brandEntries.forEach(be => {
                    const brandName = (be.brand || '').trim().toLowerCase();
                    const brandKey = `${prodName}|${brandName}`;
                    const sQty = parseFloat(be.quantity) || 0;

                    // If it doesn't exist in 'globalStockMap', it means there are NO stock records for this brand
                    if (!globalStockMap[brandKey]) {
                        const pktSize = parseFloat(si.packetSize || be.packetSize) || 0;
                        globalStockMap[brandKey] = {
                            inhouseQty: -sQty,
                            inhousePkt: pktSize > 0 ? -(sQty / pktSize) : 0,
                            pktSize: pktSize
                        };
                    }
                });
            }
        });
    });

    // 2. Calculate Sales Map by Warehouse: { [whKey]: { [brandKey]: qty } }
    const salesMapByWh = {};
    salesRecords.forEach(sale => {
        if (sale.items) {
            sale.items.forEach(si => {
                const prodName = (si.productName || si.product || '').trim().toLowerCase();
                if (si.brandEntries) {
                    si.brandEntries.forEach(be => {
                        const brandName = (be.brand || '').trim().toLowerCase();
                        const whNameRaw = (be.warehouseName || '').trim();
                        const whKey = (whNameRaw || 'General / In Stock').toLowerCase();

                        // Store under exact key and '-' fallback for single-entry products
                        const brandKey = brandName === '' ? `${prodName}|-` : `${prodName}|${brandName}`;

                        if (!salesMapByWh[whKey]) salesMapByWh[whKey] = {};
                        if (!salesMapByWh[whKey][brandKey]) salesMapByWh[whKey][brandKey] = { qty: 0 };
                        salesMapByWh[whKey][brandKey].qty += parseFloat(be.quantity) || 0;

                        // Also store under original empty-brand key for multi-brand fallback
                        if (brandName === '') {
                            const emptyKey = `${prodName}|`;
                            if (!salesMapByWh[whKey][emptyKey]) salesMapByWh[whKey][emptyKey] = { qty: 0 };
                            salesMapByWh[whKey][emptyKey].qty += parseFloat(be.quantity) || 0;
                        }
                    });
                }
            });
        }
    });

    // 3. Group for Display: Warehouse -> Product -> Brands
    const groupedData = warehouseData.reduce((acc, item) => {
        // Exclude "Requested" items from stock calculations as they are not yet officially in stock
        if ((item.status || '').toLowerCase().includes('requested')) return acc;

        // Date filter
        const itemDate = item.createdAt ? new Date(item.createdAt) : null;
        if (filters.startDate && itemDate && itemDate < new Date(filters.startDate)) return acc;
        if (filters.endDate && itemDate && itemDate > new Date(filters.endDate + 'T23:59:59')) return acc;

        // Grouping keys
        const rawWhName = (item.whName || item.warehouse || '').trim();
        const whName = rawWhName || 'General / In Stock';

        // Warehouse filter (strict)
        if (filters.warehouse && whName !== filters.warehouse) return acc;

        const prodName = (item.productName || item.product || 'Unknown').trim();
        // Product filter
        if (filters.productName && prodName !== filters.productName) return acc;

        // Category filter
        if (filters.category) {
            const productMatch = products.find(p => {
                const pName = (p.name || p.productName || '').trim().toLowerCase();
                return pName === prodName.toLowerCase();
            });
            if (!productMatch || (productMatch.category || '').trim() !== filters.category) return acc;
        }

        const brand = (item.brand || '-').trim();
        // Brand filter
        if (filters.brand && brand !== filters.brand) return acc;

        const brandKey = `${prodName.toLowerCase()}|${brand.toLowerCase()}`;

        if (!acc[whName]) acc[whName] = { whName, products: {} };
        if (!acc[whName].products[prodName]) {
            acc[whName].products[prodName] = { productName: prodName, brands: {} };
        }
        if (!acc[whName].products[prodName].brands[brand]) {
            acc[whName].products[prodName].brands[brand] = {
                brand,
                inhouseQty: globalStockMap[brandKey]?.inhouseQty || 0,
                inhousePkt: globalStockMap[brandKey]?.inhousePkt || 0,
                whQty: 0,
                whPkt: 0,
                packetSize: parseFloat(item.packetSize || item.size || 0)
            };
        }

        const qty = parseFloat(item.whQty) || 0;
        const pkt = parseFloat(item.whPkt) || 0;

        const isRealWarehouse = item.recordType === 'warehouse' ||
            (item.recordType === 'stock' && rawWhName && rawWhName.toLowerCase() !== 'general / in stock');

        if (isRealWarehouse) {
            acc[whName].products[prodName].brands[brand].whQty += qty;
            acc[whName].products[prodName].brands[brand].whPkt += pkt;
        }
        return acc;
    }, {});

    // 4. Subtract warehouse-specific sales from whQty
    Object.values(groupedData).forEach(whGroup => {
        Object.values(whGroup.products).forEach(pGroup => {
            Object.values(pGroup.brands).forEach(brandItem => {
                const whKey = whGroup.whName.toLowerCase();
                const prodNameLower = pGroup.productName.toLowerCase();
                const brandNameLower = brandItem.brand.toLowerCase();

                const exactBrandKey = `${prodNameLower}|${brandNameLower}`;
                let saleData = salesMapByWh[whKey]?.[exactBrandKey];

                // If no exact match, and it's a single-entry product (brand equals product name)
                if (!saleData && brandNameLower === prodNameLower) {
                    saleData = salesMapByWh[whKey]?.[`${prodNameLower}|-`] ||
                        salesMapByWh[whKey]?.[`${prodNameLower}|`];
                }

                if (saleData) {
                    const sQty = saleData.qty;
                    const size = brandItem.packetSize || 0;

                    const product = products.find(prod => (prod.name || prod.productName || '').trim().toLowerCase() === prodNameLower);
                    const category = (product?.category || '').trim().toUpperCase();

                    if (category === 'GENERAL') {
                        brandItem.whQty -= sQty;
                        if (size > 0) brandItem.whPkt -= (sQty / size);
                    } else {
                        brandItem.whQty = Math.max(0, brandItem.whQty - sQty);
                        if (size > 0) brandItem.whPkt = Math.max(0, brandItem.whPkt - (sQty / size));
                    }
                }
            });

            // --- SECOND PASS: Include sales for 'GENERAL' products that have NO warehouse stock records yet ---
            const whKey = whGroup.whName.toLowerCase();
            Object.keys(salesMapByWh[whKey] || {}).forEach(brandKey => {
                const [prodNameLower, brandNameLower] = brandKey.split('|');
                const product = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === prodNameLower);

                if ((product?.category || '').trim().toUpperCase() === 'GENERAL') {
                    // Find actual product name from products array to preserve casing
                    const actualProdName = product.name || product.productName || prodNameLower;
                    const actualBrandName = brandNameLower === '-' ? '' : brandNameLower;

                    if (!whGroup.products[actualProdName]) {
                        whGroup.products[actualProdName] = { productName: actualProdName, brands: {} };
                    }

                    if (!whGroup.products[actualProdName].brands[actualBrandName]) {
                        const saleData = salesMapByWh[whKey][brandKey];
                        const sQty = saleData.qty;
                        const pktSize = globalStockMap[brandKey]?.pktSize || 0;

                        whGroup.products[actualProdName].brands[actualBrandName] = {
                            brand: actualBrandName,
                            inhouseQty: globalStockMap[brandKey]?.inhouseQty || 0,
                            inhousePkt: globalStockMap[brandKey]?.inhousePkt || 0,
                            whQty: -sQty,
                            whPkt: pktSize > 0 ? -(sQty / pktSize) : 0,
                            packetSize: pktSize
                        };
                    }
                }
            });

            // Filter out empty brands and SORT them
            const brandList = Object.values(pGroup.brands)
                .filter(b => {
                    const product = products.find(prod => (prod.name || prod.productName || '').trim().toLowerCase() === prodNameLower);
                    const isGeneral = (product?.category || '').trim().toUpperCase() === 'GENERAL';
                    return b.whQty !== 0 || (whGroup.whName === 'General / In Stock' && b.inhouseQty !== 0) || isGeneral;
                })
                .sort((a, b) => (a.brand || '').localeCompare(b.brand || '', undefined, { sensitivity: 'base' }));
            pGroup.brands = brandList;
        });
        // Filter out empty products
        whGroup.products = Object.values(whGroup.products).filter(p => p.brands.length > 0);
    });

    const displayGroups = Object.values(groupedData).filter(wh => wh.products.length > 0).map(wh => ({
        ...wh,
        products: wh.products.sort((a, b) => (a.productName || '').localeCompare(b.productName || '', undefined, { sensitivity: 'base' }))
    })).sort((a, b) => (a.whName || '').localeCompare(b.whName || '', undefined, { sensitivity: 'base' }));

    // 5. Overall Totals (Avoid double counting brands)
    const uniqueBrandsInReport = new Set();
    displayGroups.forEach(wh => {
        wh.products.forEach(p => {
            p.brands.forEach(b => {
                uniqueBrandsInReport.add(`${p.productName.toLowerCase()}|${b.brand.toLowerCase()}`);
            });
        });
    });

    const totals = [...uniqueBrandsInReport].reduce((acc, brandKey) => {
        const globalInfo = globalStockMap[brandKey];
        if (globalInfo) {
            acc.totalInHouseQty += globalInfo.inhouseQty;
            const size = globalInfo.pktSize || 0;
            const whole = Math.floor(globalInfo.inhousePkt);
            acc.totalInHouseWhole += whole;
            acc.totalInHouseRem += (globalInfo.inhouseQty - (whole * size));
        }
        return acc;
    }, { totalInHouseQty: 0, totalInHouseWhole: 0, totalInHouseRem: 0, totalWhQty: 0, totalWhWhole: 0, totalWhRem: 0 });

    // Calculate total warehouse stock separately because physical stock across warehouses IS additive
    displayGroups.forEach(wh => {
        wh.products.forEach(p => {
            p.brands.forEach(b => {
                const qty = b.whQty || 0;
                const pkt = b.whPkt || 0;
                const size = b.packetSize || 0;
                const whole = Math.floor(pkt);
                totals.totalWhQty += qty;
                totals.totalWhWhole += whole;
                totals.totalWhRem += (qty - (whole * size));
            });
        });
    });

    // Final rounding for remainders
    totals.totalInHouseRem = Math.round(totals.totalInHouseRem);
    totals.totalWhRem = Math.round(totals.totalWhRem);

    const getUniqueOptions = (key) => {
        if (key === 'productName') {
            return [...new Set(warehouseData.map(item => (item.productName || item.product || '').trim()).filter(Boolean))].sort();
        }
        return [...new Set(warehouseData.map(item => (item[key] || '').trim()).filter(Boolean))].sort();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 print:p-0 print:bg-white print:backdrop-none">
            <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col print:max-h-none print:shadow-none print:rounded-none print:w-full print:h-auto">
                {/* Header */}
                <div className="flex flex-row items-center justify-between px-4 sm:px-8 py-4 border-b border-gray-100 print:hidden gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-blue-50 rounded-lg sm:rounded-xl">
                            <BarChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                        </div>
                        <h3 className="text-base sm:text-xl font-black text-gray-800 truncate leading-none">Warehouse Report</h3>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 sm:gap-3 flex-shrink-0">
                        <div className="relative flex items-center">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-xl transition-all border ${showFilterPanel || Object.values(filters).some(v => v !== '')
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30'
                                    }`}
                            >
                                <FunnelIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${showFilterPanel || Object.values(filters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                            </button>

                            {/* Floating Filter Panel */}
                            {showFilterPanel && (
                                <>
                                    {/* Backdrop for mobile */}
                                    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[2005] md:hidden" onClick={() => setShowFilterPanel(false)} />

                                    <div ref={filterPanelRef} className="fixed inset-x-4 md:inset-x-auto top-24 md:absolute md:top-full md:right-0 md:mt-3 w-auto md:w-72 bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[2010] p-5 flex flex-col max-h-[calc(100vh-160px)] animate-in fade-in zoom-in-95 duration-200">
                                        <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100 flex-shrink-0">
                                            <h4 className="font-bold text-gray-900 tracking-tight">Advance Filter</h4>
                                            <button
                                                onClick={() => {
                                                    setFilters({ startDate: '', endDate: '', warehouse: '', productName: '', brand: '', category: '' });
                                                    setFilterSearchInputs({ warehouseSearch: '', productSearch: '', brandSearch: '', categorySearch: '' });
                                                    setFilterDropdownOpen({ warehouse: false, product: false, brand: false, category: false });
                                                }}
                                                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest"
                                            >
                                                RESET ALL
                                            </button>
                                        </div>

                                        <div className="space-y-4 overflow-y-auto pr-1 custom-scrollbar">
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

                                            {/* Category Filter */}
                                            <div className="space-y-1.5 relative" ref={categoryRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">CATEGORY</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.categorySearch}
                                                        onChange={(e) => {
                                                            setFilterSearchInputs({ ...filterSearchInputs, categorySearch: e.target.value });
                                                            setFilterDropdownOpen({ warehouse: false, product: false, brand: false, category: true });
                                                        }}
                                                        onFocus={() => setFilterDropdownOpen({ warehouse: false, product: false, brand: false, category: true })}
                                                        placeholder={filters.category || "Search Category..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${filters.category ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {filters.category && (
                                                            <button onClick={() => { setFilters({ ...filters, category: '' }); setFilterSearchInputs({ ...filterSearchInputs, categorySearch: '' }); setFilterDropdownOpen({ warehouse: false, product: false, brand: false, category: false }); }} className="text-gray-400 hover:text-gray-600">
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
                                                        <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(c => (
                                                                <button key={c} type="button" onClick={() => { setFilters({ ...filters, category: c }); setFilterSearchInputs({ ...filterSearchInputs, categorySearch: '' }); setFilterDropdownOpen({ warehouse: false, product: false, brand: false, category: false }); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">{c}</button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>

                                            {/* Warehouse Filter */}
                                            <div className="space-y-1.5 relative" ref={warehouseRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">WAREHOUSE</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.warehouseSearch}
                                                        onChange={(e) => {
                                                            setFilterSearchInputs({ ...filterSearchInputs, warehouseSearch: e.target.value });
                                                            setFilterDropdownOpen({ warehouse: true, product: false, brand: false, category: false });
                                                        }}
                                                        onFocus={() => setFilterDropdownOpen({ warehouse: true, product: false, brand: false, category: false })}
                                                        placeholder={filters.warehouse || "Search warehouse..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${filters.warehouse ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {filters.warehouse && (
                                                            <button onClick={() => { setFilters({ ...filters, warehouse: '' }); setFilterSearchInputs({ ...filterSearchInputs, warehouseSearch: '' }); setFilterDropdownOpen({ warehouse: false, product: false, brand: false, category: false }); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.warehouse && (() => {
                                                    const filtered = uniqueWarehouses.filter(wh => wh.whName.toLowerCase().includes(filterSearchInputs.warehouseSearch.toLowerCase()));
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(wh => (
                                                                <button key={wh.whName} type="button" onClick={() => { setFilters({ ...filters, warehouse: wh.whName }); setFilterSearchInputs({ ...filterSearchInputs, warehouseSearch: '' }); setFilterDropdownOpen({ warehouse: false, product: false, brand: false, category: false }); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">{wh.whName}</button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>

                                            {/* Product Filter */}
                                            <div className="space-y-1.5 relative" ref={productRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">PRODUCT</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.productSearch}
                                                        onChange={(e) => {
                                                            setFilterSearchInputs({ ...filterSearchInputs, productSearch: e.target.value });
                                                            setFilterDropdownOpen({ warehouse: false, product: true, brand: false, category: false });
                                                        }}
                                                        onFocus={() => setFilterDropdownOpen({ warehouse: false, product: true, brand: false, category: false })}
                                                        placeholder={filters.productName || "Search product..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${filters.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {filters.productName && (
                                                            <button onClick={() => { setFilters({ ...filters, productName: '', brand: '' }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '', brandSearch: '' }); setFilterDropdownOpen({ warehouse: false, product: false, brand: false, category: false }); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.product && (() => {
                                                    let options = getUniqueOptions('productName');
                                                    if (filters.category && products && products.length > 0) {
                                                        const categoryProducts = new Set(
                                                            products.filter(p => (p.category || '').toLowerCase() === filters.category.toLowerCase())
                                                                .map(p => (p.name || p.productName || '').toLowerCase())
                                                        );
                                                        options = options.filter(o => categoryProducts.has(o.toLowerCase()));
                                                    }
                                                    const filtered = options.filter(p => p.toLowerCase().includes(filterSearchInputs.productSearch.toLowerCase()));
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(p => (
                                                                <button key={p} type="button" onClick={() => { setFilters({ ...filters, productName: p, brand: '' }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '', brandSearch: '' }); setFilterDropdownOpen({ warehouse: false, product: false, brand: false, category: false }); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">{p}</button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>

                                            {/* Brand Filter */}
                                            {filters.productName && (
                                                <div className="space-y-1.5 relative" ref={brandRef}>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">BRAND</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={filterSearchInputs.brandSearch}
                                                            onChange={(e) => {
                                                                setFilterSearchInputs({ ...filterSearchInputs, brandSearch: e.target.value });
                                                                setFilterDropdownOpen({ warehouse: false, product: false, brand: true, category: false });
                                                            }}
                                                            onFocus={() => setFilterDropdownOpen({ warehouse: false, product: false, brand: true, category: false })}
                                                            placeholder={filters.brand || "Search brand..."}
                                                            className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${filters.brand ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                        />
                                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                            {filters.brand && (
                                                                <button onClick={() => { setFilters({ ...filters, brand: '' }); setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' }); setFilterDropdownOpen({ warehouse: false, product: false, brand: false, category: false }); }} className="text-gray-400 hover:text-gray-600">
                                                                    <XIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                        </div>
                                                    </div>
                                                    {filterDropdownOpen.brand && (() => {
                                                        const options = getUniqueOptions('brand');
                                                        const filtered = options.filter(b => b.toLowerCase().includes(filterSearchInputs.brandSearch.toLowerCase()));
                                                        return filtered.length > 0 ? (
                                                            <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                {filtered.map(b => (
                                                                    <button key={b} type="button" onClick={() => { setFilters({ ...filters, brand: b }); setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' }); setFilterDropdownOpen({ warehouse: false, product: false, brand: false, category: false }); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">{b}</button>
                                                                ))}
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                </div>
                                            )}

                                            <button onClick={() => setShowFilterPanel(false)} className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all mt-2 flex-shrink-0 active:scale-[0.98]">APPLY FILTERS</button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <button onClick={() => generateWarehouseReportPDF(displayGroups, filters, totals)} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg sm:rounded-xl shadow-lg shadow-blue-500/30 transition-all flex-shrink-0 no-print">
                            <PrinterIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </button>
                        <button onClick={onClose} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg sm:rounded-xl transition-colors no-print"><XIcon className="w-4 h-4 sm:w-6 sm:h-6 text-gray-500" /></button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-12 print:p-4 print:overflow-visible bg-white">
                    <div className="max-w-[1000px] mx-auto space-y-6 sm:space-y-8">
                        {/* Company Header */}
                        <div className="text-center space-y-1">
                            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">M/S ANI ENTERPRISE</h1>
                            <p className="text-[12px] sm:text-[14px] text-gray-600">766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh</p>
                            <p className="text-[12px] sm:text-[14px] text-gray-600">+8802588813057, anienterprise051@gmail.com, www.anienterprises.com.bd</p>
                        </div>

                        <div className="border-t-2 border-gray-900 w-full mt-4"></div>

                        {/* Title */}
                        <div className="flex justify-center -mt-6">
                            <div className="bg-white border-2 border-gray-900 px-12 py-1.5 inline-block">
                                <h2 className="text-xl font-bold text-gray-900 tracking-wide uppercase">Warehouse Stock Report</h2>
                            </div>
                        </div>

                        {/* Info Row */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end text-[14px] text-gray-800 pt-6 px-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex"><span className="font-bold text-gray-900 w-28">Date Range:</span> <span className="text-gray-900">{formatDate(filters.startDate) === '-' ? 'Start' : formatDate(filters.startDate)} to {formatDate(filters.endDate) === '-' ? 'Present' : formatDate(filters.endDate)}</span></div>
                                {filters.warehouse && <div className="flex"><span className="font-bold text-gray-900 w-28">Warehouse:</span> <span className="text-blue-700 font-extrabold">{filters.warehouse}</span></div>}
                                {filters.productName && <div className="flex"><span className="font-bold text-gray-900 w-28">Product:</span> <span className="text-gray-900">{filters.productName}</span></div>}
                            </div>
                            <div className="font-bold"><span className="text-gray-900">Printed on:</span> <span className="text-gray-900">{formatDate(new Date().toISOString().split('T')[0])}</span></div>
                        </div>

                        {/* Table */}
                        <div className="hidden md:block print:block overflow-x-auto border border-gray-900">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-900">
                                        <th className="border-r border-gray-900 px-2 py-1 text-center text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[3%]">SL</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-left text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[10%]">Warehouse</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-left text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[15%]">Product Name</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-left text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[15%]">Brand</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[13%]">Inhouse QTY</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[14%]">Inhouse PKT</th>
                                        <th className="border-r border-gray-900 px-2 py-1 text-right text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[15%]">Warehouse QTY</th>
                                        <th className="px-2 py-1 text-right text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[15%]">Warehouse PKT</th>
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
                                                                    {Math.round(parseFloat(brandItem.inhouseQty) || 0).toLocaleString()} <span className="text-[10px] text-gray-400">kg</span>
                                                                </td>
                                                                <td className="border-r border-gray-900 px-2 py-1 text-right text-[13px] text-gray-900 align-top font-medium">
                                                                    {(() => {
                                                                        const { whole, remainder } = calculatePktRemainder(brandItem.inhouseQty, brandItem.packetSize);
                                                                        return `${whole.toLocaleString()}${remainder > 0 ? ` - ${remainder.toLocaleString()} kg` : ''}`;
                                                                    })()}
                                                                </td>
                                                                <td className="border-r border-gray-900 px-2 py-1 text-right text-[13px] text-gray-900 align-top font-bold">
                                                                    {Math.round(parseFloat(brandItem.whQty) || 0).toLocaleString()} <span className="text-[10px] text-gray-400">kg</span>
                                                                </td>
                                                                <td className="px-2 py-1 text-right text-[13px] text-gray-900 align-top font-bold">
                                                                    {(() => {
                                                                        const { whole, remainder } = calculatePktRemainder(brandItem.whQty, brandItem.packetSize);
                                                                        return `${whole.toLocaleString()}${remainder > 0 ? ` - ${remainder.toLocaleString()} kg` : ''}`;
                                                                    })()}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {hasTotal && (
                                                            <tr className="border-b border-gray-900 bg-gray-50/50">
                                                                <td className="border-r border-gray-900 px-2 py-1 text-[13px] font-bold text-gray-900 text-right uppercase tracking-wider bg-gray-50/30 italic">Sub Total</td>
                                                                <td className="border-r border-gray-900 px-2 py-1 text-right text-[13px] font-black text-gray-900">
                                                                    {Math.round(pGroup.brands.reduce((sum, b) => sum + (parseFloat(b.inhouseQty) || 0), 0)).toLocaleString()} <span className="text-[10px] text-gray-400">kg</span>
                                                                </td>
                                                                <td className="border-r border-gray-900 px-2 py-1 text-right text-[13px] font-black text-gray-900 text-emerald-700">
                                                                    {(() => {
                                                                        const totalQty = pGroup.brands.reduce((sum, b) => sum + (parseFloat(b.inhouseQty) || 0), 0);
                                                                        // Use first brand's size for subtotal rollover (standard for same-product groups)
                                                                        const pktSize = pGroup.brands[0]?.packetSize || 0;
                                                                        const { whole, remainder } = calculatePktRemainder(totalQty, pktSize);
                                                                        return `${whole.toLocaleString()}${remainder > 0 ? ` - ${remainder.toLocaleString()} kg` : ''}`;
                                                                    })()}
                                                                </td>
                                                                <td className="border-r border-gray-900 px-2 py-1 text-right text-[13px] font-black text-gray-900">
                                                                    {Math.round(pGroup.brands.reduce((sum, b) => sum + (parseFloat(b.whQty) || 0), 0)).toLocaleString()} <span className="text-[10px] text-gray-400">kg</span>
                                                                </td>
                                                                <td className="px-2 py-1 text-right text-[13px] font-black text-gray-900 text-blue-700">
                                                                    {(() => {
                                                                        const totalQty = pGroup.brands.reduce((sum, b) => sum + (parseFloat(b.whQty) || 0), 0);
                                                                        const pktSize = pGroup.brands[0]?.packetSize || 0;
                                                                        const { whole, remainder } = calculatePktRemainder(totalQty, pktSize);
                                                                        return `${whole.toLocaleString()}${remainder > 0 ? ` - ${remainder.toLocaleString()} kg` : ''}`;
                                                                    })()}
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
                                                {Math.round(totals.totalInHouseQty).toLocaleString()} <span className="text-[11px] text-gray-400">kg</span>
                                            </td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900 text-emerald-700">
                                                {`${totals.totalInHouseWhole.toLocaleString()}${totals.totalInHouseRem > 0 ? ` - ${totals.totalInHouseRem.toLocaleString()} kg` : ''}`}
                                            </td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 border-r border-gray-900">
                                                {Math.round(totals.totalWhQty).toLocaleString()} <span className="text-[11px] text-gray-400">kg</span>
                                            </td>
                                            <td className="px-2 py-1.5 text-[14px] text-right font-black text-gray-900 text-blue-700">
                                                {`${totals.totalWhWhole.toLocaleString()}${totals.totalWhRem > 0 ? ` - ${totals.totalWhRem.toLocaleString()} kg` : ''}`}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden print:hidden space-y-4">
                            {displayGroups.length > 0 ? (
                                displayGroups.map((whGroup, whIdx) => {
                                    const isExpanded = expandedMobileWHIndex === whIdx;
                                    return (
                                        <div key={whIdx} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
                                            <div
                                                className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-100/50 transition-colors"
                                                onClick={() => toggleMobileWH(whIdx)}
                                            >
                                                <h4 className="font-black text-gray-900 tracking-tight">{whGroup.whName}</h4>
                                                <div className="flex items-center gap-2">
                                                    {!isExpanded && (
                                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                                                            {whGroup.products.reduce((total, p) => total + p.brands.length, 0)} Items
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">#{whIdx + 1}</span>
                                                </div>
                                            </div>
                                            {isExpanded && (
                                                <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                                    {whGroup.products.map((pGroup, pIdx) => {
                                                        const isProdExpanded = expandedMobileProdIndex === pIdx;
                                                        return (
                                                            <div key={pIdx} className="border border-gray-100 rounded-xl overflow-hidden bg-white/50">
                                                                <div
                                                                    className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-white transition-colors"
                                                                    onClick={() => toggleMobileProd(pIdx)}
                                                                >
                                                                    <h5 className="font-bold text-sm text-gray-800">{pGroup.productName}</h5>
                                                                    <div className="flex items-center gap-2">
                                                                        {!isProdExpanded && (
                                                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                                                {pGroup.brands.length} {pGroup.brands.length > 1 ? 'Brands' : 'Brand'}
                                                                            </span>
                                                                        )}
                                                                        {/* Using text label since Chevron might not be imported if not in Icons list, 
                                                                            but Icons.js usually has them. Checking imports... 
                                                                            WarehouseReport.jsx doesn't import Chevron. Let me use +/- or common text.
                                                                            Wait, I should check Icons.js or just add them to imports if possible.
                                                                            Actually, let me use simple text or CSS arrows to avoid import errors.
                                                                        */}
                                                                        <span className="text-gray-400 text-xs">{isProdExpanded ? '▲' : '▼'}</span>
                                                                    </div>
                                                                </div>

                                                                {isProdExpanded && (
                                                                    <div className="p-3 pt-0 space-y-4 animate-in slide-in-from-top-1 duration-200">
                                                                        {pGroup.brands.map((brandItem, bIdx) => (
                                                                            <div key={bIdx} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                                                                <div className="flex justify-between items-center pb-2 border-b border-gray-200 mb-2">
                                                                                    <span className="text-sm font-bold text-blue-600">{brandItem.brand || '-'}</span>
                                                                                </div>
                                                                                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                                                                    <div className="space-y-0.5">
                                                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Inhouse</p>
                                                                                        <p className="text-xs font-bold text-gray-700">
                                                                                            {(() => {
                                                                                                const { whole, remainder } = calculatePktRemainder(brandItem.inhouseQty, brandItem.packetSize);
                                                                                                return `${whole.toLocaleString()}${remainder > 0 ? ` - ${remainder.toLocaleString()} kg` : ''}`;
                                                                                            })()} PKT
                                                                                        </p>
                                                                                        <p className="text-sm font-black text-gray-900">{Math.round(parseFloat(brandItem.inhouseQty) || 0).toLocaleString()} kg</p>
                                                                                    </div>
                                                                                    <div className="space-y-0.5 text-right">
                                                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Warehouse</p>
                                                                                        <p className="text-xs font-bold text-gray-700">
                                                                                            {(() => {
                                                                                                const { whole, remainder } = calculatePktRemainder(brandItem.whQty, brandItem.packetSize);
                                                                                                return `${whole.toLocaleString()}${remainder > 0 ? ` - ${remainder.toLocaleString()} kg` : ''}`;
                                                                                            })()} PKT
                                                                                        </p>
                                                                                        <p className="text-sm font-black text-gray-900">{Math.round(parseFloat(brandItem.whQty) || 0).toLocaleString()} kg</p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}

                                                                        {pGroup.brands.length > 1 && (
                                                                            <div className="mt-2 pt-3 border-t-2 border-dashed border-gray-200 bg-blue-50/50 rounded-xl p-3">
                                                                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Product Subtotal</p>
                                                                                <div className="grid grid-cols-2 gap-4">
                                                                                    <div>
                                                                                        <p className="text-[10px] font-bold text-gray-400">Inhouse</p>
                                                                                        <p className="text-sm font-black text-emerald-700">{Math.round(pGroup.brands.reduce((sum, b) => sum + (parseFloat(b.inhouseQty) || 0), 0)).toLocaleString()} kg</p>
                                                                                    </div>
                                                                                    <div className="text-right">
                                                                                        <p className="text-[10px] font-bold text-gray-400">Warehouse</p>
                                                                                        <p className="text-sm font-black text-blue-700">{Math.round(pGroup.brands.reduce((sum, b) => sum + (parseFloat(b.whQty) || 0), 0)).toLocaleString()} kg</p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-12 px-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                    <p className="text-gray-500 italic">No warehouse stock data matches your criteria.</p>
                                </div>
                            )}

                            {/* Mobile Grand Total */}
                            {displayGroups.length > 0 && (
                                <div className="mt-8 p-5 bg-gray-900 rounded-2xl shadow-xl shadow-gray-200">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 text-center">Grand Total Summary</h4>
                                    <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Total Inhouse</p>
                                            <p className="text-xl font-black text-emerald-400 text-center">{Math.round(totals.totalInHouseQty).toLocaleString()}<span className="text-[10px] ml-1 text-gray-500 uppercase">kg</span></p>
                                            <p className="text-xs font-bold text-gray-400 text-center">
                                                {`${totals.totalInHouseWhole.toLocaleString()}${totals.totalInHouseRem > 0 ? ` - ${totals.totalInHouseRem.toLocaleString()} kg` : ''}`} PKT
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Total Warehouse</p>
                                            <p className="text-xl font-black text-blue-400 text-center">{Math.round(totals.totalWhQty).toLocaleString()}<span className="text-[10px] ml-1 text-gray-500 uppercase">kg</span></p>
                                            <p className="text-xs font-bold text-gray-400 text-center">
                                                {`${totals.totalWhWhole.toLocaleString()}${totals.totalWhRem > 0 ? ` - ${totals.totalWhRem.toLocaleString()} kg` : ''}`} PKT
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-6 px-2 print:grid no-print">
                            {/* Card 1: Total InHouse Stock */}
                            <div className="border border-gray-200 p-3 sm:p-5 rounded-2xl bg-gray-50 shadow-sm print:border-gray-200 flex flex-col justify-center">
                                <div className="text-[9px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 sm:mb-3 text-center sm:text-left">Total Inhouse Stock</div>
                                <div className="text-[10px] sm:text-sm font-bold text-gray-700 mb-1 text-center sm:text-left">
                                    PKT: <span className="text-xs sm:text-[15px] font-black text-gray-900">{`${totals.totalInHouseWhole.toLocaleString()}${totals.totalInHouseRem > 0 ? ` - ${totals.totalInHouseRem.toLocaleString()} kg` : ''}`}</span>
                                </div>
                                <div className="text-sm sm:text-2xl font-black text-gray-900 text-center sm:text-left">
                                    QTY: {Math.round(totals.totalInHouseQty).toLocaleString()} <span className="text-[9px] sm:text-[11px] font-semibold text-gray-400">kg</span>
                                </div>
                            </div>

                            {/* Card 2: Warehouse Stock */}
                            <div className="border border-blue-100 p-3 sm:p-5 rounded-2xl bg-blue-50 shadow-sm print:border-gray-200 flex flex-col justify-center">
                                <div className="text-[9px] sm:text-[11px] font-bold text-blue-500 uppercase tracking-wider mb-1 sm:mb-3 text-center sm:text-left">Warehouse Stock</div>
                                <div className="text-[10px] sm:text-sm font-bold text-gray-700 mb-1 text-center sm:text-left">
                                    PKT: <span className="text-xs sm:text-[15px] font-black text-blue-700">{`${totals.totalWhWhole.toLocaleString()}${totals.totalWhRem > 0 ? ` - ${totals.totalWhRem.toLocaleString()} kg` : ''}`}</span>
                                </div>
                                <div className="text-sm sm:text-2xl font-black text-blue-600 text-center sm:text-left">
                                    QTY: {Math.round(totals.totalWhQty).toLocaleString()} <span className="text-[9px] sm:text-[11px] font-semibold text-blue-300">kg</span>
                                </div>
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 pt-12 sm:pt-24 px-4 pb-12 print:grid-cols-3 print:pt-24 print:gap-8">
                            <div className="text-center sm:text-left"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Prepared By</div></div>
                            <div className="text-center"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Verified By</div></div>
                            <div className="text-center sm:text-right"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Authorized Signature</div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WarehouseReport;
