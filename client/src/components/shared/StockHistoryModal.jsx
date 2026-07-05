import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    SearchIcon,
    XIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    FunnelIcon,
    FileTextIcon,
    EyeIcon
} from '../Icons';
import CustomDatePicker from './CustomDatePicker';
import { calculatePktRemainder } from '../../utils/stockHelpers';
import { formatDate } from '../../utils/helpers';

const SortIcon = ({ config, columnKey }) => {
    if (!config || config.key !== columnKey) return <ChevronDownIcon className="w-3 h-3 ml-1 text-gray-300 opacity-0 group-hover:opacity-100" />;
    return config.direction === 'asc'
        ? <ChevronUpIcon className="w-3 h-3 ml-1 text-blue-500" />
        : <ChevronDownIcon className="w-3 h-3 ml-1 text-blue-500" />;
};

const StockHistoryModal = ({
    viewRecord,
    setViewRecord,
    stockRecords,
    salesRecords,
    warehouseData,
    damages,
    setShowProductHistoryReport,
    setProductHistoryReportData
}) => {
    const [historySearchQuery, setHistorySearchQuery] = useState('');
    const [showHistoryFilterPanel, setShowHistoryFilterPanel] = useState(false);
    const [historyFilters, setHistoryFilters] = useState({ startDate: '', endDate: '', lcNo: '', port: '', brand: '' });
    const [historyTab, setHistoryTab] = useState('purchase'); // 'purchase' or 'sale'
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' });
    const [filterDropdownOpen, setFilterDropdownOpen] = useState({ lcNo: false, port: false, brand: false });
    const initialFilterDropdownState = { lcNo: false, port: false, brand: false };

    const [expandedHistoryId, setExpandedHistoryId] = useState(null);
    const [expandedSaleId, setExpandedSaleId] = useState(null);

    const historyFilterRef = useRef(null);
    const filterButtonRef = useRef(null);
    const lcNoFilterRef = useRef(null);
    const portFilterRef = useRef(null);
    const brandFilterRef = useRef(null);

    const requestSort = (key) => {
        setSortConfig(prev => {
            let direction = 'asc';
            if (prev.key === key && prev.direction === 'asc') {
                direction = 'desc';
            }
            return { key, direction };
        });
    };

    const toggleHistoryExpansion = (historyId) => {
        setExpandedHistoryId(prev => prev === historyId ? null : historyId);
        setExpandedSaleId(null);
    };

    const toggleSaleExpansion = (saleId) => {
        setExpandedSaleId(prev => prev === saleId ? null : saleId);
        setExpandedHistoryId(null);
    };

    const activePurchaseHistory = useMemo(() => {
        if (!viewRecord) return [];
        const searchLower = historySearchQuery.toLowerCase().trim();
        const productName = (viewRecord.productName || viewRecord.name || '').trim().toLowerCase();

        const filteredRaw = (stockRecords || []).filter(item => {
            const status = (item.status || '').toLowerCase();
            if (status.includes('requested') || status.includes('rejected') || status.includes('deleted')) return false;

            const matchesProduct = (item.productName || item.product || '').trim().toLowerCase() === productName;
            if (!matchesProduct) return false;

            if (historyFilters.startDate && item.date < historyFilters.startDate) return false;
            if (historyFilters.endDate && item.date > historyFilters.endDate) return false;
            if (historyFilters.lcNo && (item.lcNo || '').trim() !== historyFilters.lcNo) return false;
            if (historyFilters.port && (item.port || '').trim() !== historyFilters.port) return false;
            if (historyFilters.brand) {
                const brandLower = historyFilters.brand.toLowerCase();
                const hasBrand = (item.brand || '').trim().toLowerCase() === brandLower ||
                    (item.entries || []).some(e => (e.brand || '').trim().toLowerCase() === brandLower) ||
                    (item.brandEntries || []).some(e => (e.brand || '').trim().toLowerCase() === brandLower);
                if (!hasBrand) return false;
            }

            if (!searchLower) return true;
            const matchesLC = (item.lcNo || '').trim().toLowerCase().includes(searchLower);
            const matchesPort = (item.port || '').trim().toLowerCase().includes(searchLower);
            const matchesImporter = (item.importer || '').trim().toLowerCase().includes(searchLower);
            const matchesTruck = (item.truckNo || '').trim().toLowerCase().includes(searchLower);
            const brandList = [
                item.brand,
                ...(item.entries || []).map(e => e.brand),
                ...(item.brandEntries || []).map(e => e.brand)
            ].filter(Boolean);
            const matchesBrand = brandList.some(b => (b || '').trim().toLowerCase().includes(searchLower));
            return matchesLC || matchesPort || matchesImporter || matchesTruck || matchesBrand;
        });

        const groupedMap = filteredRaw.reduce((acc, item) => {
            const key = `${item.date}_${item.lcNo}_${item.truckNo}`;
            const normalizeStr = (s) => (s || '').toString().trim().toLowerCase();
            const targetLC = normalizeStr(item.lcNo);
            const targetTruck = normalizeStr(item.truckNo);
            const targetProd = normalizeStr(item.productName || item.product);
            const targetBrand = normalizeStr(item.brand);

            const relatedWhRecords = (warehouseData || []).filter(w => {
                if (w.recordType !== 'warehouse') return false;
                const wLC = normalizeStr(w.lcNo);
                const wTruck = normalizeStr(w.truckNo);
                const wProd = normalizeStr(w.productName || w.product);
                const wBrand = normalizeStr(w.brand);
                const isBasicMatch = wLC === targetLC && wProd === targetProd && wBrand === targetBrand && (wTruck === targetTruck || (!wTruck && !targetTruck));
                if (!isBasicMatch) return false;

                // Date-aware matching to prevent duplicate assignment when same LC/Truck/Brand/Prod has multiple arrival dates
                const wDateVal = w.date || w.createdAt || w.updatedAt;
                const wDate = wDateVal ? wDateVal.toString().split('T')[0] : '';
                const itemDate = (item.date || '').split('T')[0];
                if (wDate && itemDate && wDate < itemDate) return false;

                // Find all matching stock arrivals
                const otherMatchingStocks = filteredRaw.filter(s => {
                    const sLC = normalizeStr(s.lcNo);
                    const sTruck = normalizeStr(s.truckNo);
                    const sProd = normalizeStr(s.productName || s.product);
                    const sBrand = normalizeStr(s.brand);
                    return sLC === wLC && sProd === wProd && sBrand === wBrand && (sTruck === wTruck || (!sTruck && !wTruck));
                });

                // Find the latest arrival that happened before or on the transfer date
                let bestStock = null;
                let bestStockDate = '';
                for (const s of otherMatchingStocks) {
                    const sDate = (s.date || '').split('T')[0];
                    if (wDate && sDate && sDate <= wDate) {
                        if (!bestStockDate || sDate > bestStockDate) {
                            bestStock = s;
                            bestStockDate = sDate;
                        }
                    }
                }

                if (bestStock) {
                    return bestStock._id === item._id;
                }
                return true;
            });

            const whOnlyQty = relatedWhRecords.reduce((sum, r) => sum + (parseFloat(r.whQty) || 0), 0);
            const whOnlyPkt = relatedWhRecords.reduce((sum, r) => sum + (parseFloat(r.whPkt) || 0), 0);
            
            const itemInHouseQty = parseFloat(item.inHouseQuantity) || 0;
            const itemInHousePkt = parseFloat(item.inHousePacket) || 0;

            const physicalWhQty = itemInHouseQty + whOnlyQty;
            const physicalWhPkt = itemInHousePkt + whOnlyPkt;
            const saleQty = relatedWhRecords.reduce((sum, r) => sum + (parseFloat(r.saleQuantity) || 0), 0);
            const salePkt = relatedWhRecords.reduce((sum, r) => sum + (parseFloat(r.salePacket) || 0), 0);
            const shortageQty = parseFloat(item.sweepedQuantity) || 0;

            if (!acc[key]) {
                acc[key] = {
                    ...item,
                    allIds: [item._id],
                    brandsProcessed: new Set([targetBrand]),
                    totalQuantity: parseFloat(item.quantity) || 0,
                    totalPacket: parseFloat(item.packet) || 0,
                    totalInHousePacket: physicalWhPkt,
                    totalInHouseQuantity: physicalWhQty,
                    totalShortage: shortageQty,
                    totalSaleQuantity: saleQty,
                    totalSalePacket: salePkt,
                    entries: [{
                        brand: item.brand || item.productName,
                        purchasedPrice: item.purchasedPrice,
                        packet: item.packet,
                        packetSize: item.packetSize,
                        quantity: item.quantity,
                        inHousePacket: physicalWhPkt,
                        inHouseQuantity: physicalWhQty,
                        sweepedPacket: item.sweepedPacket,
                        sweepedQuantity: item.sweepedQuantity,
                        saleQuantity: saleQty,
                        salePacket: salePkt,
                        unit: item.unit
                    }]
                };
            } else {
                acc[key].allIds.push(item._id);
                acc[key].totalQuantity += parseFloat(item.quantity) || 0;
                acc[key].totalPacket += parseFloat(item.packet) || 0;
                
                if (!acc[key].brandsProcessed.has(targetBrand)) {
                    acc[key].totalInHousePacket += physicalWhPkt;
                    acc[key].totalInHouseQuantity += physicalWhQty;
                    acc[key].brandsProcessed.add(targetBrand);
                } else {
                    acc[key].totalInHousePacket += itemInHousePkt;
                    acc[key].totalInHouseQuantity += itemInHouseQty;
                }
                
                acc[key].totalShortage += shortageQty;
                acc[key].totalSaleQuantity += saleQty;
                acc[key].totalSalePacket += salePkt;
                acc[key].entries.push({
                    brand: item.brand || item.productName,
                    purchasedPrice: item.purchasedPrice,
                    packet: item.packet,
                    packetSize: item.packetSize,
                    quantity: item.quantity,
                    inHousePacket: physicalWhPkt,
                    inHouseQuantity: physicalWhQty,
                    sweepedPacket: item.sweepedPacket,
                    sweepedQuantity: item.sweepedQuantity,
                    saleQuantity: saleQty,
                    salePacket: salePkt,
                    unit: item.unit
                });
            }
            return acc;
        }, {});

        return Object.values(groupedMap).sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [viewRecord, stockRecords, historySearchQuery, historyFilters, warehouseData, sortConfig]);

    const activeSaleHistory = useMemo(() => {
        if (!viewRecord) return [];
        const searchLower = historySearchQuery.toLowerCase().trim();
        const productName = (viewRecord.productName || viewRecord.name || '').trim().toLowerCase();

        const filteredSales = (salesRecords || []).filter(sale => {
            const status = (sale.status || '').toLowerCase();
            if (status !== 'accepted') return false;

            const hasMatchingProduct = (sale.items || []).some(item =>
                (item.productName || '').trim().toLowerCase() === productName
            );
            if (!hasMatchingProduct) return false;
            if (historyFilters.startDate && sale.date < historyFilters.startDate) return false;
            if (historyFilters.endDate && sale.date > historyFilters.endDate) return false;
            
            if (historyFilters.lcNo) {
                const matchesLc = (sale.lcNo || '').trim() === historyFilters.lcNo ||
                    (sale.items || []).some(item =>
                        (item.productName || '').trim().toLowerCase() === productName &&
                        (item.lcNo || '').trim() === historyFilters.lcNo
                    );
                if (!matchesLc) return false;
            }
            if (historyFilters.port && (sale.port || '').trim() !== historyFilters.port) return false;

            if (searchLower) {
                const matchesInvoice = (sale.invoiceNo || '').toLowerCase().includes(searchLower);
                const matchesCompany = (sale.companyName || '').toLowerCase().includes(searchLower);
                const matchesCustomer = (sale.customerName || '').toLowerCase().includes(searchLower);
                const matchesPhone = (sale.contact || '').toLowerCase().includes(searchLower);
                const matchesLC = (sale.lcNo || '').toLowerCase().includes(searchLower) ||
                    (sale.items || []).some(item =>
                        (item.productName || '').trim().toLowerCase() === productName &&
                        (item.lcNo || '').toLowerCase().includes(searchLower)
                    );
                const matchesItemBrand = (sale.items || [])
                    .filter(item => (item.productName || '').trim().toLowerCase() === productName)
                    .some(item => (item.brandEntries || []).some(entry => (entry.brand || '').toLowerCase().includes(searchLower)));
                return matchesInvoice || matchesCompany || matchesCustomer || matchesPhone || matchesItemBrand || matchesLC;
            }
            return true;
        });

        const flattened = [];
        filteredSales.forEach(sale => {
            const matchingItems = (sale.items || []).filter(item =>
                (item.productName || '').trim().toLowerCase() === productName
            );
            matchingItems.forEach(item => {
                if (historyFilters.lcNo) {
                    const currentLc = (item.lcNo || sale.lcNo || '').trim();
                    if (currentLc !== historyFilters.lcNo) return;
                }
                (item.brandEntries || []).forEach(entry => {
                    if (historyFilters.brand && (entry.brand || '').trim().toLowerCase() !== historyFilters.brand.toLowerCase()) return;
                    
                    const brandLower = (entry.brand || '').trim().toLowerCase();
                    let purchaseRecord = stockRecords.find(s =>
                        (s.productName || '').trim().toLowerCase() === productName &&
                        (s.brand || '').trim().toLowerCase() === brandLower
                    );
                    if (!purchaseRecord) {
                        purchaseRecord = stockRecords.find(s =>
                            (s.productName || '').trim().toLowerCase() === productName
                        );
                    }
                    const pktSize = parseFloat(purchaseRecord?.packetSize) || 0;
                    const qty = parseFloat(entry.quantity) || 0;
                    const calculatedPacket = pktSize > 0 ? (qty / pktSize) : 0;

                    flattened.push({
                        ...sale,
                        lcNo: item.lcNo || sale.lcNo || '',
                        itemBrand: entry.brand,
                        itemTruck: entry.truck,
                        itemPacket: calculatedPacket,
                        itemQty: qty,
                        itemPrice: parseFloat(entry.unitPrice) || 0,
                        itemTotal: parseFloat(entry.totalAmount) || 0,
                        unit: 'kg'
                    });
                });
            });
        });

        return flattened.sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [viewRecord, salesRecords, stockRecords, historySearchQuery, historyFilters, sortConfig]);

    const historyOptions = useMemo(() => {
        if (!viewRecord) return { lcNos: [], ports: [], brands: [] };
        const productName = (viewRecord.productName || viewRecord.name || '').trim().toLowerCase();
        const records = stockRecords.filter(r => (r.productName || r.product || '').trim().toLowerCase() === productName);
        
        return {
            lcNos: [...new Set(records.map(r => r.lcNo).filter(Boolean))].sort(),
            ports: [...new Set(records.map(r => r.port).filter(Boolean))].sort(),
            brands: [...new Set(records.flatMap(r => [r.brand, ...(r.entries || []).map(e => e.brand), ...(r.brandEntries || []).map(e => e.brand)]).filter(Boolean))].sort()
        };
    }, [viewRecord, stockRecords]);

    const handleGenerateProductReport = () => {
        if (!viewRecord) return;
        const purchaseFlattened = [];
        activePurchaseHistory.forEach(record => {
            const entries = record.brandEntries || record.entries || [];
            entries.forEach(entry => {
                const brandMatch = !historyFilters.brand || (entry.brand || '').trim().toLowerCase() === historyFilters.brand.toLowerCase();
                if (brandMatch) {
                    purchaseFlattened.push({
                        ...record,
                        itemBrand: entry.brand,
                        itemPurchasedPrice: entry.purchasedPrice,
                        itemPacket: entry.packet,
                        itemQty: entry.quantity,
                        itemInHouseQty: entry.inHouseQuantity,
                        itemShortageQty: entry.sweepedQuantity,
                        itemExporter: record.exporter,
                        unit: entry.unit
                    });
                }
            });
        });

        const productName = (viewRecord.productName || viewRecord.name || '').trim().toLowerCase();
        
        // Filter Damage History
        const damageFlattened = (damages || []).filter(d => {
            const pMatch = (d.productName || '').trim().toLowerCase() === productName;
            const bMatch = !historyFilters.brand || (d.brand || '').trim().toLowerCase() === historyFilters.brand.toLowerCase();
            return pMatch && bMatch;
        }).map(d => ({
            ...d,
            itemBrand: d.brand,
            itemQty: d.quantity,
            itemPacket: d.packet,
            type: 'damage'
        }));

        setProductHistoryReportData({
            productName: viewRecord.productName || viewRecord.name,
            category: viewRecord.category,
            filters: historyFilters,
            purchaseHistory: purchaseFlattened,
            saleHistory: activeSaleHistory,
            damageHistory: damageFlattened
        });
        setShowProductHistoryReport(true);
    };

    if (!viewRecord) return null;

    return createPortal(
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 app-modal-overlay">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setViewRecord(null)}></div>
            <div className="relative bg-white/95 backdrop-blur-2xl border border-white/50 rounded-3xl shadow-2xl max-w-[95vw] w-full animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="px-4 sm:px-8 pt-2 pb-4 sm:pt-4 sm:pb-6 border-b border-gray-100 flex items-center justify-between bg-white rounded-t-3xl gap-3 flex-shrink-0 z-50 relative">
                    <div className="flex-shrink-0 min-w-0">
                        <h3 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">Stock History - {viewRecord.productName || viewRecord.name}</h3>
                    </div>

                    <div className="hidden lg:flex flex-1 max-w-xl mx-auto flex-col items-center gap-4">
                        <div className="w-full max-w-md relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder={historyTab === 'purchase' ? "Search by LC No, Brand, Port or Truck..." : "Search by LC No, Invoice, Company, Customer, Phone or Brand..."}
                                value={historySearchQuery}
                                onChange={(e) => setHistorySearchQuery(e.target.value)}
                                className="block w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100">
                            <button
                                onClick={() => setHistoryTab('purchase')}
                                className={`px-6 py-1.5 rounded-lg text-xs font-bold transition-all ${historyTab === 'purchase' ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Purchase
                            </button>
                            <button
                                onClick={() => setHistoryTab('sale')}
                                className={`px-6 py-1.5 rounded-lg text-xs font-bold transition-all ${historyTab === 'sale' ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Sale
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowHistoryFilterPanel(!showHistoryFilterPanel)}
                                className={`flex items-center justify-center sm:gap-2 w-9 h-9 sm:w-auto sm:h-10 sm:px-4 rounded-xl transition-all border ${showHistoryFilterPanel || Object.values(historyFilters).some(v => v !== '') ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                <FunnelIcon className={`w-4 h-4 ${showHistoryFilterPanel || Object.values(historyFilters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                                <span className="hidden sm:block text-sm font-medium">Filter</span>
                            </button>

                            {/* Mobile Filter Overlay Backdrop */}
                            {showHistoryFilterPanel && (
                                <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[55] lg:hidden" onClick={() => setShowHistoryFilterPanel(false)}></div>
                            )}

                            {showHistoryFilterPanel && (
                                <div ref={historyFilterRef} className="fixed inset-x-4 top-24 lg:absolute lg:inset-auto lg:right-0 lg:mt-3 w-auto lg:w-[420px] bg-white border border-gray-200 rounded-2xl shadow-2xl z-[60] p-5 animate-in fade-in zoom-in duration-200 overflow-y-auto lg:overflow-visible max-h-[70vh]">
                                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                                        <h4 className="font-bold text-gray-900">Advanced Filters</h4>
                                        <button
                                            onClick={() => {
                                                setHistoryFilters({ startDate: '', endDate: '', lcNo: '', port: '', brand: '' });
                                                setShowHistoryFilterPanel(false);
                                            }}
                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                                        >
                                            Reset All
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <CustomDatePicker
                                                label="FROM DATE"
                                                value={historyFilters.startDate}
                                                onChange={(e) => setHistoryFilters({ ...historyFilters, startDate: e.target.value })}
                                                placeholder="Select start date"
                                                compact={true}
                                                fullWidth={true}
                                            />
                                            <CustomDatePicker
                                                label="TO DATE"
                                                value={historyFilters.endDate}
                                                onChange={(e) => setHistoryFilters({ ...historyFilters, endDate: e.target.value })}
                                                placeholder="Select end date"
                                                compact={true}
                                                fullWidth={true}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1.5 relative" ref={lcNoFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">LC No</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={historyFilters.lcNo}
                                                        onClick={() => setFilterDropdownOpen({ ...initialFilterDropdownState, lcNo: !filterDropdownOpen.lcNo })}
                                                        placeholder="Select LC No..."
                                                        className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer ${historyFilters.lcNo ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                                                    />
                                                    <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                    {filterDropdownOpen.lcNo && (
                                                        <div className="absolute z-[70] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            <button onClick={() => { setHistoryFilters({ ...historyFilters, lcNo: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 font-medium border-b border-gray-50">All LCs</button>
                                                            {historyOptions.lcNos.map(lc => (
                                                                <button key={lc} onClick={() => { setHistoryFilters({ ...historyFilters, lcNo: lc }); setFilterDropdownOpen(initialFilterDropdownState); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${historyFilters.lcNo === lc ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600'}`}>{lc}</button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-1.5 relative" ref={portFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Port</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={historyFilters.port}
                                                        onClick={() => setFilterDropdownOpen({ ...initialFilterDropdownState, port: !filterDropdownOpen.port })}
                                                        placeholder="Select Port..."
                                                        className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer ${historyFilters.port ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                                                    />
                                                    <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                    {filterDropdownOpen.port && (
                                                        <div className="absolute z-[70] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            <button onClick={() => { setHistoryFilters({ ...historyFilters, port: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 font-medium border-b border-gray-50">All Ports</button>
                                                            {historyOptions.ports.map(port => (
                                                                <button key={port} onClick={() => { setHistoryFilters({ ...historyFilters, port: port }); setFilterDropdownOpen(initialFilterDropdownState); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${historyFilters.port === port ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600'}`}>{port}</button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 relative" ref={brandFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Brand</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={historyFilters.brand}
                                                    onClick={() => setFilterDropdownOpen({ ...initialFilterDropdownState, brand: !filterDropdownOpen.brand })}
                                                    placeholder="Select Brand..."
                                                    className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer ${historyFilters.brand ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                                                />
                                                <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                {filterDropdownOpen.brand && (
                                                    <div className="absolute z-[70] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                        <button onClick={() => { setHistoryFilters({ ...historyFilters, brand: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 font-medium border-b border-gray-50">All Brands</button>
                                                        {historyOptions.brands.map(brand => (
                                                            <button key={brand} onClick={() => { setHistoryFilters({ ...historyFilters, brand: brand }); setFilterDropdownOpen(initialFilterDropdownState); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${historyFilters.brand === brand ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600'}`}>{brand}</button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <button onClick={() => setShowHistoryFilterPanel(false)} className="w-full py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-all mt-2">Apply Filters</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={handleGenerateProductReport} className="flex items-center justify-center w-9 h-9 sm:w-auto sm:h-10 sm:px-4 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl hover:bg-blue-100 transition-all shadow-sm">
                            <FileTextIcon className="w-4 h-4" />
                            <span className="hidden sm:block text-sm font-medium ml-2">Report</span>
                        </button>

                        <button onClick={() => setViewRecord(null)} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors">
                            <XIcon className="w-6 h-6 text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Modal Content */}
                <div className="px-4 sm:px-8 py-6 sm:py-8 flex-1 overflow-y-auto custom-scrollbar min-h-0">
                    {historyTab === 'purchase' ? (() => {
                        const history = activePurchaseHistory;
                        const unit = history[0]?.unit || 'kg';

                        const tPkts = history.reduce((sum, item) => sum + (parseFloat(item.totalPacket) || 0), 0);
                        const tQty = history.reduce((sum, item) => sum + (parseFloat(item.totalQuantity) || 0), 0);
                        const tShort = history.reduce((sum, item) => sum + (parseFloat(item.totalShortage) || 0), 0);

                        const productName = (viewRecord.productName || viewRecord.name || '').trim().toLowerCase();
                        const shownLCTrucks = new Set(history.map(item => `${(item.lcNo || '').trim()}_${(item.truckNo || '').trim()}`));
                        
                        const historyInHouseQty = history.reduce((sum, h) => {
                            return sum + (h.entries || []).reduce((eSum, e) => eSum + (parseFloat(e.inHouseQuantity) || 0), 0);
                        }, 0);
                        const historyInHousePkt = history.reduce((sum, h) => {
                            return sum + (h.entries || []).reduce((eSum, e) => eSum + (parseFloat(e.inHousePacket) || 0), 0);
                        }, 0);

                        const tIHQty = historyInHouseQty;
                        const tIHPkt = historyInHousePkt;

                        return (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 md:flex md:flex-row gap-3 sm:gap-4 w-full">
                                    {[
                                        { label: 'TOTAL BAG', value: tPkts.toLocaleString('en-US'), bgColor: 'bg-white', borderColor: 'border-gray-200', textColor: 'text-gray-900', labelColor: 'text-gray-400' },
                                        { label: 'TOTAL QTY', value: `${Math.round(tQty).toLocaleString('en-US')} ${unit}`, bgColor: 'bg-emerald-50/10', borderColor: 'border-emerald-100', textColor: 'text-emerald-700', labelColor: 'text-emerald-600' },
                                        { label: 'INHOUSE BAG', value: tIHPkt.toLocaleString('en-US'), bgColor: 'bg-amber-50/10', borderColor: 'border-amber-100', textColor: 'text-amber-700', labelColor: 'text-amber-600' },
                                        { label: 'INHOUSE QTY', value: `${Math.round(tIHQty).toLocaleString('en-US')} ${unit}`, bgColor: 'bg-blue-50/10', borderColor: 'border-blue-100', textColor: 'text-blue-700', labelColor: 'text-blue-600' },
                                        { label: 'SHORTAGE', value: `${Math.round(tShort).toLocaleString('en-US')} ${unit}`, bgColor: 'bg-rose-50/10', borderColor: 'border-rose-100', textColor: 'text-rose-700', labelColor: 'text-rose-600', span: 'col-span-2 md:col-auto' },
                                    ].map((card, i) => (
                                        <div key={i} className={`bg-white border ${card.bgColor} ${card.borderColor} p-3 sm:p-4 rounded-xl shadow-sm transition-all hover:shadow-md ${card.span || ''} md:flex-1 min-w-[120px]`}>
                                            <div className={`text-[10px] sm:text-[11px] font-bold ${card.labelColor} uppercase tracking-wider mb-0.5 sm:mb-1`}>{card.label}</div>
                                            <div className={`text-sm sm:text-xl font-bold ${card.textColor}`}>{card.value}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-left min-w-[1000px]">
                                            <thead>
                                                <tr className="bg-white border-b border-gray-100">
                                                    <th onClick={() => requestSort('date')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-center">Date <SortIcon config={sortConfig} columnKey="date" /></div>
                                                    </th>
                                                    <th onClick={() => requestSort('lcNo')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-center">LC No <SortIcon config={sortConfig} columnKey="lcNo" /></div>
                                                    </th>
                                                    <th onClick={() => requestSort('port')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-center">Port <SortIcon config={sortConfig} columnKey="port" /></div>
                                                    </th>
                                                    <th onClick={() => requestSort('importer')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-center">Importer <SortIcon config={sortConfig} columnKey="importer" /></div>
                                                    </th>
                                                    <th onClick={() => requestSort('exporter')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-center">Exporter <SortIcon config={sortConfig} columnKey="exporter" /></div>
                                                    </th>
                                                    <th onClick={() => requestSort('truckNo')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-center">Truck <SortIcon config={sortConfig} columnKey="truckNo" /></div>
                                                    </th>
                                                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Brand</th>
                                                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Purchase Price</th>
                                                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">BAG</th>
                                                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Quantity</th>
                                                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">InHouse Pkt</th>
                                                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">InHouse Qty</th>
                                                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider text-rose-600">Shortage</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {history.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="14" className="px-6 py-12 text-center text-gray-400 font-medium italic">No history records found</td>
                                                    </tr>
                                                ) : (
                                                    history.map((item, idx) => (
                                                        <tr key={item._id || idx} className="hover:bg-gray-50/30 transition-colors group border-b border-gray-50">
                                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(item.date)}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 font-semibold">{item.lcNo}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{item.port}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 truncate max-w-[120px]" title={item.importer}>{item.importer}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 truncate max-w-[120px]" title={item.exporter}>{item.exporter || '-'}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 font-medium whitespace-nowrap">{item.truckNo || '-'}</td>
                                                            <td className="px-3 py-3 align-top whitespace-nowrap">
                                                                <div className="space-y-1">
                                                                    {item.entries.map((entry, eIdx) => (
                                                                        <div key={eIdx} className="text-sm text-gray-600 font-medium">{entry.brand}</div>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 align-top">
                                                                <div className="space-y-1">
                                                                    {item.entries.map((entry, eIdx) => (
                                                                        <div key={eIdx} className="text-sm text-gray-600">৳{parseFloat(entry.purchasedPrice || 0).toLocaleString('en-IN')}</div>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 align-top font-bold">
                                                                <div className="space-y-1">
                                                                    {item.entries.map((entry, eIdx) => (
                                                                        <div key={eIdx} className="text-sm text-gray-900">{entry.packet}</div>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 align-top font-bold">
                                                                <div className="space-y-1">
                                                                    {item.entries.map((entry, eIdx) => (
                                                                        <div key={eIdx} className="text-sm text-gray-900">{Math.round(parseFloat(entry.quantity || 0)).toLocaleString('en-US')} {entry.unit}</div>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 align-top">
                                                                <div className="space-y-1">
                                                                    {item.entries.map((entry, eIdx) => (
                                                                        <div key={eIdx} className="text-sm text-amber-600 font-bold">{entry.inHousePacket}</div>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 align-top">
                                                                <div className="space-y-1">
                                                                    {item.entries.map((entry, eIdx) => (
                                                                        <div key={eIdx} className="text-sm text-blue-600 font-bold">{Math.round(parseFloat(entry.inHouseQuantity || 0)).toLocaleString('en-US')} {entry.unit}</div>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 align-top text-rose-600 font-black">
                                                                <div className="space-y-1">
                                                                    {item.entries.map((entry, eIdx) => (
                                                                        <div key={eIdx} className="text-sm">{Math.round(parseFloat(entry.sweepedQuantity || 0)).toLocaleString('en-US')} {entry.unit}</div>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile Card View (simplified) */}
                                    <div className="md:hidden space-y-4">
                                        {history.length === 0 ? (
                                            <div className="p-8 text-center text-gray-400 font-medium italic bg-white rounded-xl border border-gray-100">No history records found</div>
                                        ) : (
                                            history.map((item, idx) => {
                                                const historyId = item._id || idx;
                                                const isExpanded = expandedHistoryId === historyId;
                                                return (
                                                    <div key={historyId} onClick={() => toggleHistoryExpansion(historyId)} className={`bg-white rounded-2xl border border-gray-100 p-4 shadow-sm transition-all duration-200 cursor-pointer hover:border-blue-100 ${isExpanded ? 'ring-1 ring-blue-500/10' : ''}`}>
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{formatDate(item.date)}</span>
                                                                <span className="text-sm font-black text-gray-900 truncate">{item.lcNo}</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{(item.totalInHouseQuantity || 0).toLocaleString()} {unit}</span>
                                                            </div>
                                                        </div>
                                                        {isExpanded && (
                                                            <div className="mt-4 pt-4 border-t border-gray-50 space-y-3">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div><span className="text-[10px] font-bold text-gray-400 uppercase block">Port</span><span className="text-xs font-medium text-gray-700">{item.port}</span></div>
                                                                    <div><span className="text-[10px] font-bold text-gray-400 uppercase block">Truck</span><span className="text-xs font-medium text-gray-700">{item.truckNo || '-'}</span></div>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    {item.entries.map((entry, eIdx) => (
                                                                        <div key={eIdx} className="bg-gray-50 p-2 rounded-xl text-xs space-y-1">
                                                                            <div className="flex justify-between font-bold"><span>{entry.brand}</span><span>৳{parseFloat(entry.purchasedPrice).toLocaleString()}</span></div>
                                                                            <div className="flex justify-between text-gray-500"><span>Bag: {entry.packet}</span><span>Qty: {entry.quantity} {entry.unit}</span></div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })() : (() => {
                        const history = activeSaleHistory;
                        const unit = history[0]?.unit || 'kg';

                        const tPkts = history.reduce((sum, item) => sum + (parseFloat(item.itemPacket) || 0), 0);
                        const tQty = history.reduce((sum, item) => sum + (parseFloat(item.itemQty) || 0), 0);
                        const tAmount = history.reduce((sum, item) => sum + (parseFloat(item.itemTotal) || 0), 0);

                        return (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 w-full">
                                    {[
                                        { label: 'TOTAL SALE BAG', value: Math.round(tPkts).toLocaleString('en-US'), bgColor: 'bg-white', borderColor: 'border-gray-200', textColor: 'text-gray-900', labelColor: 'text-gray-400' },
                                        { label: 'TOTAL SALE QTY', value: `${Math.round(tQty).toLocaleString('en-US')} ${unit}`, bgColor: 'bg-blue-50/10', borderColor: 'border-blue-100', textColor: 'text-blue-700', labelColor: 'text-blue-600' },
                                        { label: 'TOTAL AMOUNT', value: `৳${Math.round(tAmount).toLocaleString('en-IN')}`, bgColor: 'bg-emerald-50/10', borderColor: 'border-emerald-100', textColor: 'text-emerald-700', labelColor: 'text-emerald-600' },
                                    ].map((card, i) => (
                                        <div key={i} className={`bg-white border ${card.bgColor} ${card.borderColor} p-3 sm:p-4 rounded-xl shadow-sm transition-all hover:shadow-md md:flex-1`}>
                                            <div className={`text-[10px] sm:text-[11px] font-bold ${card.labelColor} uppercase tracking-wider mb-0.5 sm:mb-1`}>{card.label}</div>
                                            <div className={`text-sm sm:text-xl font-bold ${card.textColor}`}>{card.value}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-left min-w-[1000px]">
                                            <thead>
                                                <tr className="bg-white border-b border-gray-100">
                                                    <th onClick={() => requestSort('date')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-center">Date <SortIcon config={sortConfig} columnKey="date" /></div>
                                                    </th>
                                                    <th onClick={() => requestSort('lcNo')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-center">LC No <SortIcon config={sortConfig} columnKey="lcNo" /></div>
                                                    </th>
                                                    <th onClick={() => requestSort('invoiceNo')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-center">Invoice <SortIcon config={sortConfig} columnKey="invoiceNo" /></div>
                                                    </th>
                                                    <th onClick={() => requestSort('companyName')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-center">Company <SortIcon config={sortConfig} columnKey="companyName" /></div>
                                                    </th>
                                                    <th onClick={() => requestSort('customerName')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-center">Customer <SortIcon config={sortConfig} columnKey="customerName" /></div>
                                                    </th>
                                                    <th onClick={() => requestSort('itemBrand')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-center">Brand <SortIcon config={sortConfig} columnKey="itemBrand" /></div>
                                                    </th>
                                                    <th onClick={() => requestSort('itemPacket')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-center">BAG <SortIcon config={sortConfig} columnKey="itemPacket" /></div>
                                                    </th>
                                                    <th onClick={() => requestSort('itemQty')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-center">Quantity <SortIcon config={sortConfig} columnKey="itemQty" /></div>
                                                    </th>
                                                    <th onClick={() => requestSort('itemPrice')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-center">Price <SortIcon config={sortConfig} columnKey="itemPrice" /></div>
                                                    </th>
                                                    <th onClick={() => requestSort('itemTotal')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-center">Total <SortIcon config={sortConfig} columnKey="itemTotal" /></div>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {history.length === 0 ? (
                                                    <tr><td colSpan="10" className="px-6 py-12 text-center text-gray-400 font-medium italic">No sale records found</td></tr>
                                                ) : (
                                                    history.map((item, idx) => (
                                                        <tr key={item._id || idx} className="hover:bg-gray-50/30 transition-colors border-b border-gray-50">
                                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(item.date)}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 font-semibold">{item.lcNo ? item.lcNo.slice(-4) : '-'}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-600 font-bold">{item.invoiceNo}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold truncate max-w-[150px]" title={item.companyName}>{item.companyName}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 truncate max-w-[120px]" title={item.customerName}>{item.customerName}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{item.itemBrand}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-bold">{Math.round(item.itemPacket)}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-bold">{Math.round(item.itemQty).toLocaleString()} {item.unit}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">৳{item.itemPrice.toLocaleString()}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-600 font-black">৳{item.itemTotal.toLocaleString()}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
 
                                    {/* Mobile Card View (simplified) */}
                                    <div className="md:hidden space-y-4">
                                        {history.length === 0 ? (
                                            <div className="p-8 text-center text-gray-400 font-medium italic bg-white rounded-xl border border-gray-100">No sale records found</div>
                                        ) : (
                                            history.map((item, idx) => {
                                                const saleId = item._id || idx;
                                                const isExpanded = expandedSaleId === saleId;
                                                return (
                                                    <div key={saleId} onClick={() => toggleSaleExpansion(saleId)} className={`bg-white rounded-2xl border border-gray-100 p-4 shadow-sm transition-all duration-200 cursor-pointer hover:border-blue-100 ${isExpanded ? 'ring-1 ring-blue-500/10' : ''}`}>
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{formatDate(item.date)}</span>
                                                                <span className="text-sm font-black text-gray-900 truncate">{item.invoiceNo}</span>
                                                                <span className="text-xs text-gray-500 truncate">{item.companyName}</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="text-sm font-black text-blue-600">৳{item.itemTotal.toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                        {isExpanded && (
                                                            <div className="mt-4 pt-4 border-t border-gray-50 space-y-3">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div><span className="text-[10px] font-bold text-gray-400 uppercase block">Customer</span><span className="text-xs font-medium text-gray-700">{item.customerName}</span></div>
                                                                    <div><span className="text-[10px] font-bold text-gray-400 uppercase block">Brand</span><span className="text-xs font-medium text-gray-700">{item.itemBrand}</span></div>
                                                                    <div><span className="text-[10px] font-bold text-gray-400 uppercase block">LC No</span><span className="text-xs font-medium text-gray-700">{item.lcNo || '-'}</span></div>
                                                                </div>
                                                                <div className="flex justify-between items-center bg-gray-50 p-2 rounded-xl">
                                                                    <div className="text-xs text-gray-500">Qty: {Math.round(item.itemQty)} {item.unit}</div>
                                                                    <div className="text-xs text-gray-900 font-bold">৳{item.itemPrice.toLocaleString()} / {item.unit}</div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default StockHistoryModal;
