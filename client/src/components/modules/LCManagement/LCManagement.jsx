import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from '../../../utils/api';
import {
    PlusIcon, XIcon, EditIcon, TrashIcon, SearchIcon,
    LCManagerIcon, ShieldIcon, BuildingIcon, GlobeIcon,
    DollarSignIcon, CalendarIcon, ChevronDownIcon, EyeIcon, FileTextIcon, CheckIcon
} from '../../Icons';
import { formatDate, API_BASE_URL } from '../../../utils/helpers';
import { decryptData } from '../../../utils/encryption';
import CustomDatePicker from '../../shared/CustomDatePicker';
const ViewDetailsModal = ({ data, onClose, allStockRecords = [], allSalesRecords = [], gpRecords = [], lcExpenses = [] }) => {
    const [showConsumption, setShowConsumption] = useState(true);
    const [consumptionSearchQuery, setConsumptionSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('history');
    if (!data) return null;

    // Failsafe LC Matching helper
    const cleanLc = (val) => String(val || '').replace(/\D/g, '');
    const parseNum = (val) => {
        if (val === null || val === undefined) return 0;
        return parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0;
    };

    const lcNoClean = cleanLc(data.lcNo);

    // Calculate Consumptions
    const receiptsMap = {};
    allStockRecords
        .filter(s => {
            const recordLcNoClean = cleanLc(s.lcNo);
            const status = (s.status || '').toLowerCase();
            return recordLcNoClean === lcNoClean && (status === 'accepted' || status === 'in stock');
        })
        .forEach(s => {
            // Ensure date key is just the day, so milliseconds in createdAt don't break grouping
            const rawDate = s.date || s.receiveDate || s.createdAt || '';
            const dateStr = typeof rawDate === 'string' && rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
            
            // Group by date, and total quantity or truck to merge split records from the same transaction
            const groupVal = s.totalLcQuantity || s.billOfEntry || s.totalLcTruck || s.truckNo || s.truck || 'single';
            const key = `${dateStr}_${groupVal}`;
            
            if (!receiptsMap[key]) {
                const itemSubtotal = (s.entries || []).reduce((iSum, item) => iSum + parseNum(item.inHouseQuantity || item.quantity), 0);
                const truckNumeric = parseFloat(s.totalLcTruck || s.truckNo || s.truck) || 0;
                receiptsMap[key] = {
                    date: rawDate,
                    importer: s.importer || data.importer,
                    exporter: s.exporter || data.exporter,
                    product: s.productName || data.productName,
                    truck: s.totalLcTruck || s.truckNo || s.truck || '-',
                    truckCount: truckNumeric,
                    quantity: parseNum(s.totalLcQuantity) || itemSubtotal || parseNum(s.inHouseQuantity) || parseNum(s.quantity),
                    source: 'LC Receive',
                    _products: new Set([s.productName || data.productName])
                };
            } else {
                receiptsMap[key]._products.add(s.productName || data.productName);
                if (receiptsMap[key]._products.size > 1) {
                    receiptsMap[key].product = 'Multiple Products';
                }
                // If the group doesn't have a totalLcQuantity, accumulate the individual pieces
                if (!s.totalLcQuantity) {
                    receiptsMap[key].quantity += parseNum(s.inHouseQuantity) || parseNum(s.quantity);
                }
            }
        });
        
    const relatedReceipts = Object.values(receiptsMap);

    const relatedSales = allSalesRecords
        .filter(s => {
            const recordLcNoClean = cleanLc(s.lcNo);
            const sTypeLow = (s.saleType || '').toLowerCase().trim();
            const isBorder = sTypeLow.includes('border') || (s.invoiceNo || '').startsWith('BS') || (!s.saleType && !!(s.lcNo || s.port || s.importer)) || (recordLcNoClean === lcNoClean && !!(s.port || s.importer));
            const status = (s.status || '').toLowerCase();
            return recordLcNoClean === lcNoClean && status === 'accepted' && isBorder;
        })
        .map(s => {
            const itemSubtotal = (s.items || []).reduce((iSum, item) => {
                const brandSubtotal = (item.brandEntries || []).reduce((bSum, b) => bSum + parseNum(b.quantity), 0);
                return iSum + (brandSubtotal || parseNum(item.quantity));
            }, 0);
            // truckNo for sales — check all possible locations matching the display truck field
            const truckRaw = s.truckNo || s.truck || (s.items && s.items[0]?.brandEntries && s.items[0].brandEntries[0]?.truck) || 0;
            const truckNumeric = parseFloat(truckRaw) || 0;
            return {
                date: s.date || s.createdAt,
                importer: s.importer || data.importer,
                exporter: s.exporter || data.exporter,
                product: (s.items && s.items[0]?.productName) || s.productName || data.productName,
                truck: s.truckNo || s.truck || (s.items && s.items[0]?.brandEntries && s.items[0].brandEntries[0]?.truck) || '-',
                truckCount: truckNumeric,
                quantity: parseNum(s.currentTotalQty) || parseNum(s.totalQuantity) || parseNum(s.totalQty) || parseNum(s.qty) || parseNum(s.quantity) || parseNum(s.total) || itemSubtotal,
                source: 'Border sale'
            };
        });

    const consumptionHistory = [...relatedReceipts, ...relatedSales].sort((a, b) => new Date(a.date) - new Date(b.date));

    // G.P List for this LC
    const relatedGpRecords = gpRecords.filter(gp => {
        const gpLcClean = cleanLc(gp.lcNumber);
        return gpLcClean === lcNoClean;
    });

    // Filter consumption history based on search query
    const filteredConsumptionHistory = consumptionHistory.filter(item => {
        if (!consumptionSearchQuery.trim()) return true;
        const q = consumptionSearchQuery.toLowerCase().trim();
        return (
            (formatDate(item.date) || '').toLowerCase().includes(q) ||
            (item.importer || '').toLowerCase().includes(q) ||
            (item.exporter || '').toLowerCase().includes(q) ||
            (item.product || '').toLowerCase().includes(q) ||
            String(item.truck || '').toLowerCase().includes(q) ||
            (item.source || '').toLowerCase().includes(q) ||
            String(parseNum(item.quantity)).includes(q)
        );
    });

    // Filter GP records based on search query
    const filteredGpRecords = relatedGpRecords.filter(gp => {
        if (!consumptionSearchQuery.trim()) return true;
        const q = consumptionSearchQuery.toLowerCase().trim();
        return (
            (formatDate(gp.gpDate) || '').toLowerCase().includes(q) ||
            (gp.partyName || '').toLowerCase().includes(q) ||
            (gp.party || '').toLowerCase().includes(q) ||
            (gp.productName || '').toLowerCase().includes(q) ||
            String(parseNum(gp.gpQuantity)).includes(q) ||
            (gp.remarks || '').toLowerCase().includes(q)
        );
    });

    // Summary Calculations
    const products = data.productsList?.length > 0
        ? data.productsList
        : [{
            productName: data.productName || '',
            hsCode: data.hsCode || '',
            quantity: data.quantity || '',
            rate: data.rate || '',
            freight: data.freight || '',
            totalFreight: data.totalFreight || '',
            totalDollar: data.totalDollar || ''
          }];

    const totalLcQtyTons = products.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
    const totalLcQtyKg = totalLcQtyTons * 1000;
    const consumedQtyKg = consumptionHistory.reduce((sum, item) => sum + parseNum(item.quantity), 0);
    const remQtyKg = totalLcQtyKg - consumedQtyKg;
    // truckNo is a numeric count per entry — sum all values instead of counting unique strings
    const truckCount = consumptionHistory.reduce((sum, item) => sum + (item.truckCount || 0), 0);

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-white border border-gray-100 rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    {/* Left: LC Info */}
                    <div className="flex items-center gap-3 min-w-0 shrink-0">
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                            <LCManagerIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg font-bold text-gray-900 truncate">{showConsumption ? 'LC Consumption History' : 'LC Record Details'}</h3>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                                LC NO: <span className="text-sm font-black text-blue-600">{data.lcNo}</span>
                            </p>
                        </div>
                    </div>

                    {/* Center: Search + Tabs (only in consumption view) */}
                    {showConsumption && (
                        <div className="flex flex-col items-center gap-2 flex-1 mx-6">
                            {/* Search Bar */}
                            <div className="relative group w-full max-w-md">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search consumption history..."
                                    autoComplete="off"
                                    className="block w-full pl-10 pr-4 py-2 bg-white/70 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                    value={consumptionSearchQuery}
                                    onChange={(e) => setConsumptionSearchQuery(e.target.value)}
                                />
                                {consumptionSearchQuery && (
                                    <button
                                        onClick={() => setConsumptionSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <XIcon className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            {/* Tab Buttons */}
                            <div className="flex items-center gap-2">
                                {['history', 'gp', 'expense'].map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => { setActiveTab(tab); setConsumptionSearchQuery(''); }}
                                        className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${activeTab === tab
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        {tab === 'history' ? 'LC History' : tab === 'gp' ? 'G.P List' : 'Expense'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Right: Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setShowConsumption(!showConsumption)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${showConsumption
                                ? 'bg-blue-50 text-blue-600 border-blue-100'
                                : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-white'
                                }`}
                        >
                            <LCManagerIcon className="w-4 h-4" />
                            {showConsumption ? 'Show Details' : 'LC History'}
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white transition-all">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto max-h-[80vh] p-8 custom-scrollbar">
                    {showConsumption ? (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-blue-100 group">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            <LCManagerIcon className="w-5 h-5" />
                                        </div>
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">LC Quantity</span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-gray-900">{totalLcQtyKg.toLocaleString('en-US')}</span>
                                        <span className="text-xs font-bold text-gray-400">Kg</span>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-indigo-100 group">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                            <GlobeIcon className="w-5 h-5" />
                                        </div>
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Consumption</span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-gray-900">{consumedQtyKg.toLocaleString('en-US')}</span>
                                        <span className="text-xs font-bold text-gray-400">Kg</span>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-emerald-100 group">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                            <ShieldIcon className="w-5 h-5" />
                                        </div>
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Rem. Quantity</span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-2xl font-black ${remQtyKg <= 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
                                            {remQtyKg.toLocaleString('en-US')}
                                        </span>
                                        <span className="text-xs font-bold text-gray-400">Kg</span>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-gray-200 group">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-gray-50 text-gray-600 rounded-xl group-hover:bg-gray-800 group-hover:text-white transition-colors">
                                            <BuildingIcon className="w-5 h-5" />
                                        </div>
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Truck</span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-gray-900">{truckCount}</span>
                                        <span className="text-xs font-bold text-gray-400">Units</span>
                                    </div>
                                </div>
                            </div>

                            {/* Consumption History Table or GP List */}
                            {activeTab === 'history' ? (
                                <div className="overflow-hidden border border-gray-100 rounded-2xl shadow-sm">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Importer</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Exporter</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Truck</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Quantity</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Source</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {filteredConsumptionHistory.length > 0 ? (
                                                filteredConsumptionHistory.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                                                        <td className="px-6 py-4 text-sm font-medium text-gray-600 whitespace-nowrap">{formatDate(item.date)}</td>
                                                        <td className="px-6 py-4 text-sm font-medium text-gray-800 uppercase">{item.importer || '-'}</td>
                                                        <td className="px-6 py-4 text-sm font-medium text-gray-800 uppercase">{item.exporter || '-'}</td>
                                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.product || '-'}</td>
                                                        <td className="px-6 py-4 text-sm font-medium text-blue-600 uppercase whitespace-nowrap">{item.truck || '-'}</td>
                                                        <td className="px-6 py-4 text-sm font-medium text-right text-gray-900 whitespace-nowrap">
                                                            {parseNum(item.quantity).toLocaleString('en-US')} <span className="text-[10px] text-gray-400 font-normal">Kg</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${item.source === 'LC Receive'
                                                                ? 'bg-blue-50 text-blue-600 border-blue-100/50'
                                                                : 'bg-indigo-50 text-indigo-600 border-indigo-100/50'
                                                                }`}>
                                                                {item.source}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-400 font-bold">
                                                        {consumptionSearchQuery ? 'No results match your search.' : 'No consumption history found for this LC.'}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot className="bg-gray-50/30">
                                            <tr>
                                                <td colSpan="5" className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Total Consumption:</td>
                                                <td className="px-6 py-4 text-sm font-medium text-right text-blue-600">
                                                    {filteredConsumptionHistory.reduce((sum, item) => sum + parseNum(item.quantity), 0).toLocaleString('en-US')} <span className="text-[10px] font-normal">Kg</span>
                                                </td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : activeTab === 'gp' ? (
                                /* G.P List Table */
                                <div className="overflow-hidden border border-gray-100 rounded-2xl shadow-sm">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Party Name</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Sold To</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">GP Qty (Kg)</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">GP Value</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {filteredGpRecords.length > 0 ? (
                                                filteredGpRecords.map((gp, idx) => (
                                                    <tr key={gp._id || idx} className="hover:bg-gray-50/50 transition-colors group">
                                                        <td className="px-6 py-4 text-sm font-medium text-gray-600 whitespace-nowrap">{formatDate(gp.gpDate)}</td>
                                                        <td className="px-6 py-4 text-sm font-medium text-gray-800 uppercase">{gp.partyName || '-'}</td>
                                                        <td className="px-6 py-4 text-sm font-medium text-gray-800 uppercase">{gp.party || '-'}</td>
                                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{gp.productName || '-'}</td>
                                                        <td className="px-6 py-4 text-sm font-medium text-right text-gray-900 whitespace-nowrap">
                                                            {parseNum(gp.gpQuantity).toLocaleString('en-US')} <span className="text-[10px] text-gray-400 font-normal">Kg</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm font-medium text-right text-gray-900 whitespace-nowrap">
                                                            ৳{parseNum(gp.gpValue).toLocaleString('en-IN')}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${gp.status === 'Active'
                                                                ? 'bg-blue-50 text-blue-600 border-blue-100/50'
                                                                : 'bg-gray-100 text-gray-500 border-gray-200/50'
                                                                }`}>
                                                                {gp.status || 'Active'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-400 font-bold">
                                                        {consumptionSearchQuery ? 'No G.P records match your search.' : 'No Gate Pass records found for this LC.'}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot className="bg-gray-50/30">
                                            <tr>
                                                <td colSpan="4" className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Total GP Qty:</td>
                                                <td className="px-6 py-4 text-sm font-medium text-right text-blue-600">
                                                    {filteredGpRecords.reduce((sum, gp) => sum + parseNum(gp.gpQuantity), 0).toLocaleString('en-US')} <span className="text-[10px] font-normal">Kg</span>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-medium text-right text-blue-600">
                                                    ৳{filteredGpRecords.reduce((sum, gp) => sum + parseNum(gp.gpValue), 0).toLocaleString('en-IN')}
                                                </td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : (
                                /* Expense Table */
                                <div className="overflow-hidden border border-gray-100 rounded-2xl shadow-sm">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Expense Head</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">C&F Agent</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Remarks</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {(() => {
                                                const filtered = lcExpenses.filter(exp => exp.lcNo === data.lcNo);
                                                return filtered.length > 0 ? (
                                                    filtered.map((exp, idx) => (
                                                        <tr key={exp._id || idx} className="hover:bg-gray-50/50 transition-colors group">
                                                            <td className="px-6 py-4 text-sm font-medium text-gray-600 whitespace-nowrap">{formatDate(exp.date)}</td>
                                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{exp.expenseHead || '-'}</td>
                                                            <td className="px-6 py-4 text-sm font-medium text-gray-800">{exp.cnfAgent || '-'}</td>
                                                            <td className="px-6 py-4 text-sm font-bold text-right text-rose-600 whitespace-nowrap">৳{parseNum(exp.amount).toLocaleString('en-IN')}</td>
                                                            <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-[200px]">{exp.remarks || '-'}</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="5" className="px-6 py-12 text-center text-gray-400 font-bold">
                                                            No expense records found for this LC.
                                                        </td>
                                                    </tr>
                                                );
                                            })()}
                                        </tbody>
                                        <tfoot className="bg-gray-50/30">
                                            <tr>
                                                <td colSpan="3" className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Total Expense:</td>
                                                <td className="px-6 py-4 text-sm font-bold text-right text-rose-600">
                                                    ৳{lcExpenses.filter(exp => exp.lcNo === data.lcNo).reduce((sum, exp) => sum + parseNum(exp.amount), 0).toLocaleString('en-IN')}
                                                </td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Section 1: General Information */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <GlobeIcon className="w-4 h-4 text-gray-400" />
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">General Information</h4>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 px-2">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PI Number</span>
                                        <p className="text-sm font-bold text-blue-600">{data.piNo || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">IP Number</span>
                                        <p className="text-sm font-bold text-gray-800">
                                            {(data.ipNumbers?.length ? data.ipNumbers.join(', ') : data.ipNo) || 'N/A'}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Opening Date</span>
                                        <p className="text-sm font-bold text-gray-800 font-mono tracking-tight">{formatDate(data.openingDate)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-red-500">Expiry Date</span>
                                        <p className="text-sm font-bold text-red-500 font-mono tracking-tight">{formatDate(data.expiryDate)}</p>
                                    </div>
                                    <div className="space-y-1 col-span-2">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bank Name</span>
                                        <p className="text-sm font-bold text-gray-800 truncate" title={data.bankName}>{data.bankName}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Importer</span>
                                        <p className="text-sm font-bold text-gray-800 truncate">{data.importerName}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Exporter</span>
                                        <p className="text-sm font-bold text-gray-800 truncate">{data.exporterName}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Product & Financials */}
                            <div className="pt-6 border-t border-gray-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <DollarSignIcon className="w-4 h-4 text-gray-400" />
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Product & Financial Details</h4>
                                </div>
                                <div className="space-y-4">
                                    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-gray-50/50">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100/50 border-b border-gray-200/60">
                                                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Product Name</th>
                                                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">HS Code</th>
                                                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Quantity (Ton)</th>
                                                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Rate (/Ton)</th>
                                                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Total Dollar</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {products.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-white/40 transition-colors">
                                                        <td className="px-4 py-3 text-sm font-bold text-gray-900">{item.productName || '-'}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 font-medium">{item.hsCode || '-'}</td>
                                                        <td className="px-4 py-3 text-sm text-right text-gray-900 font-black">{parseFloat(item.quantity || 0).toLocaleString('en-US')} <span className="text-[10px] text-gray-400 font-normal">Ton</span></td>
                                                        <td className="px-4 py-3 text-sm text-right text-gray-700 font-semibold">${parseFloat(item.rate || 0).toLocaleString('en-US')}</td>
                                                        <td className="px-4 py-3 text-sm text-right text-blue-600 font-black">${parseFloat(item.totalDollar || 0).toLocaleString('en-US')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Summary Stats */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 flex flex-col justify-center">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Port</span>
                                            <p className="text-sm font-bold text-gray-800">{data.port || '-'}</p>
                                        </div>
                                        <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 flex flex-col justify-center">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Dollar Rate</span>
                                            <p className="text-sm font-bold text-gray-800">৳{parseFloat(data.dollarRate || 0).toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-100/50 flex justify-between items-center">
                                            <span className="text-xs font-black text-blue-800 uppercase tracking-widest">Total Dollar</span>
                                            <span className="text-lg font-black text-blue-700">${products.reduce((sum, item) => sum + (parseFloat(item.totalDollar) || 0), 0).toLocaleString('en-US')}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 p-4 bg-gray-50 rounded-xl flex justify-between items-center">
                                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Total LC Value</span>
                                    <span className="text-xl font-black text-gray-900">৳{parseFloat(data.totalAmount || 0).toLocaleString('en-IN')}</span>
                                </div>
                            </div>

                            {/* Section 3: Insurance Details */}
                            <div className="pt-6 border-t border-gray-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <ShieldIcon className="w-4 h-4 text-gray-400" />
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Insurance Information</h4>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 px-2">
                                    <div className="space-y-1 col-span-2">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Insurance Company</span>
                                        <p className="text-sm font-bold text-gray-800 truncate">{data.insuranceCo || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Policy Type</span>
                                        <p className="text-sm font-bold text-gray-800">{data.policyType || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Extra %</span>
                                        <p className="text-sm font-bold text-gray-800">{data.extraPercent || '0'}%</p>
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Marine Cover Note</span>
                                        <p className="text-sm font-bold text-gray-800">{data.marineCoverNote || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Marine C.N Date</span>
                                        <p className="text-sm font-bold text-gray-800">{data.marineCNDate ? formatDate(data.marineCNDate) : '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Premium Rate</span>
                                        <p className="text-sm font-bold text-gray-800">{data.premium || '0'}%</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Premium Return</span>
                                        <p className="text-sm font-bold text-blue-600">{data.premiumReturn || '0'}%</p>
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Return Amount</span>
                                        <p className="text-sm font-bold text-blue-600">৳{parseFloat(data.expectedReturnAmount || 0).toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">VAT ({data.premiumVat || '0'}%)</span>
                                        <p className="text-sm font-bold text-gray-800">
                                            ৳{(parseFloat(data.netPremium || 0) * (parseFloat(data.premiumVat || 0) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Stamp Duty</span>
                                        <p className="text-sm font-bold text-gray-800">৳{parseFloat(data.stampCharge || 0).toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Gross Premium</span>
                                        <p className="text-sm font-bold text-gray-800">৳{parseFloat(data.grossPremium || 0).toLocaleString('en-US')}</p>
                                    </div>
                                </div>
                                <div className="mt-4 p-4 bg-blue-50 rounded-xl flex justify-between items-center border border-blue-100">
                                    <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Net Payable Premium</span>
                                    <span className="text-lg font-black text-blue-700">৳{parseFloat(data.netPremium || 0).toLocaleString('en-US')}</span>
                                </div>
                            </div>

                            {/* Section 4: Amendment History */}
                            {data.amendments && data.amendments.length > 0 && (
                                <div className="pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex items-center gap-2 mb-4">
                                        <FileTextIcon className="w-4 h-4 text-gray-400" />
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Amendment History</h4>
                                    </div>
                                    <div className="overflow-x-auto border border-gray-100 rounded-2xl shadow-sm bg-white">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Amnd No</th>
                                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Amnd Date</th>
                                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">New Expiry Date</th>
                                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">New Qty</th>
                                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">New Rate</th>
                                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">New Value ($)</th>
                                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">New Value (৳)</th>
                                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Remarks / Details</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {data.amendments.map((amnd, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                                                        <td className="px-6 py-3.5 text-sm font-bold text-gray-900 whitespace-nowrap">{amnd.amendmentNo}</td>
                                                        <td className="px-6 py-3.5 text-sm font-medium text-gray-600 whitespace-nowrap font-mono">{formatDate(amnd.amendmentDate)}</td>
                                                        <td className="px-6 py-3.5 text-sm font-medium text-rose-500 whitespace-nowrap font-mono">{amnd.expiryDate ? formatDate(amnd.expiryDate) : '—'}</td>
                                                        <td className="px-6 py-3.5 text-sm text-right text-gray-800 font-bold whitespace-nowrap">{amnd.quantity ? `${parseFloat(amnd.quantity).toLocaleString('en-US')} Ton` : '—'}</td>
                                                        <td className="px-6 py-3.5 text-sm text-right text-gray-800 whitespace-nowrap">{amnd.rate ? `$${parseFloat(amnd.rate).toLocaleString('en-IN')}` : '—'}</td>
                                                        <td className="px-6 py-3.5 text-sm text-right text-blue-600 font-bold whitespace-nowrap">{amnd.totalDollar ? `$${parseFloat(amnd.totalDollar).toLocaleString('en-IN')}` : '—'}</td>
                                                        <td className="px-6 py-3.5 text-sm text-right text-gray-800 font-bold whitespace-nowrap">{amnd.totalAmount ? `৳${parseFloat(amnd.totalAmount).toLocaleString('en-IN')}` : '—'}</td>
                                                        <td className="px-6 py-3.5 text-sm text-gray-500 max-w-[200px] truncate" title={amnd.remarks}>{amnd.remarks || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const getPiIpNumbers = (pi) => {
    if (!pi) return [];
    if (Array.isArray(pi.ipNumbers) && pi.ipNumbers.length > 0) return pi.ipNumbers;
    if (pi.ipNumber) return pi.ipNumber.split(',').map(s => s.trim()).filter(Boolean);
    return [];
};

const getRemIpQtyTon = (ipNo, ipRecordsRaw, lcRecords, editingId) => {
    const selectedIp = ipRecordsRaw.find(ip => ip.ipNumber === ipNo);
    if (!selectedIp) return 0;
    const totalLcQtyOnThisIp = lcRecords
        .filter(lc => {
            const lcIps = lc.ipNumbers?.length ? lc.ipNumbers : (lc.ipNo ? [lc.ipNo] : []);
            return lcIps.includes(ipNo) && lc._id !== editingId;
        })
        .reduce((sum, lc) => sum + (parseFloat(lc.quantity) || 0), 0);
    return (parseFloat(selectedIp.quantity || 0) / 1000) - totalLcQtyOnThisIp;
};

const mapPiProductsToLc = (pi) => {
    const piProducts = (pi.productsList?.length > 0)
        ? pi.productsList
        : (pi.productName
            ? [{ productName: pi.productName, hsCode: pi.hsCode || '', quantity: pi.quantity || '', rate: pi.rate || '', amount: pi.amount || '' }]
            : []);
    return piProducts.map(p => {
        const qtyTon = p.quantity ? parseFloat(p.quantity) / 1000 : 0;
        const amt = parseFloat(p.amount) || qtyTon * (parseFloat(p.rate) || 0);
        const lineFreight = parseFloat(p.totalFreight) || qtyTon * (parseFloat(p.freight) || 0);
        const totalDollar = amt + lineFreight;
        return {
            productName: p.productName || '',
            hsCode: p.hsCode || '',
            quantity: qtyTon ? String(qtyTon) : '',
            rate: p.rate || '',
            freight: p.freight || '',
            totalFreight: lineFreight > 0 ? String(lineFreight) : '',
            totalDollar: totalDollar > 0 ? totalDollar.toFixed(2) : '',
        };
    });
};

const calcLcProductLine = (item) => {
    const qty = parseFloat(item.quantity) || 0;
    const r = parseFloat(item.rate) || 0;
    const f = parseFloat(item.freight) || 0;
    const amt = qty * r;
    const totalFreight = qty * f;
    const totalDollar = amt + totalFreight;
    return {
        ...item,
        totalFreight: totalFreight > 0 ? totalFreight.toFixed(2) : '',
        totalDollar: totalDollar > 0 ? totalDollar.toFixed(2) : '',
    };
};

const syncRootFromProductsList = (state) => {
    const first = (state.productsList || [])[0];
    if (first) {
        state.productName = first.productName || '';
        state.hsCode = first.hsCode || '';
        state.quantity = first.quantity || '';
        state.rate = first.rate || '';
        state.totalDollar = first.totalDollar || '';
    }
    return state;
};

const LCManagement = ({ addNotification, currentUser }) => {
    const [lcRecords, setLcRecords] = useState([]);
    const [banks, setBanks] = useState([]);
    const [importers, setImporters] = useState([]);
    const [exporters, setExporters] = useState([]);
    const [insuranceCos, setInsuranceCos] = useState([]);
    const [insuranceRecordsRaw, setInsuranceRecordsRaw] = useState([]);
    const [ipList, setIpList] = useState([]);
    const [ipRecordsRaw, setIpRecordsRaw] = useState([]);
    const [piList, setPiList] = useState([]);
    const [piRecordsRaw, setPiRecordsRaw] = useState([]);
    const [productItems, setProductItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [viewData, setViewData] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [allStockRecords, setAllStockRecords] = useState([]);
    const [allSalesRecords, setAllSalesRecords] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [idToDelete, setIdToDelete] = useState(null);
    const [deleteStatus, setDeleteStatus] = useState(null);

    // Amendment states
    const [showAmendmentForm, setShowAmendmentForm] = useState(false);
    const [selectedAmendmentLcId, setSelectedAmendmentLcId] = useState('');
    const [amendmentSearchQuery, setAmendmentSearchQuery] = useState('');
    const [amendmentFormData, setAmendmentFormData] = useState({
        amendmentNo: '',
        amendmentDate: '',
        expiryDate: '',
        quantity: '',
        rate: '',
        dollarRate: '',
        remarks: '',
        piNo: ''
    });

    const canManage = ['admin', 'incharge', 'lc manager', 'border manager', 'data entry'].includes((currentUser?.role || '').toLowerCase());

    const piRef = useRef(null);
    const bankRef = useRef(null);
    const importerRef = useRef(null);
    const exporterRef = useRef(null);
    const productRef = useRef(null);
    const insuranceRef = useRef(null);
    const statusRef = useRef(null);
    const amendmentLcRef = useRef(null);
    const amendmentPiRef = useRef(null);


    const [formData, setFormData] = useState({
        ipNo: '',
        piNo: '',
        lcNo: '',
        openingDate: '',
        expiryDate: '',
        bankName: '',
        importerName: '',
        exporterName: '',
        hsCode: '',
        productName: '',
        quantity: '',
        rate: '',
        totalDollar: '',
        dollarRate: '',
        insuranceCo: '',
        policyType: '',
        extraPercent: '',
        premium: '',
        grossPremium: '',
        premiumReturn: '',
        expectedReturnAmount: '',
        netPremium: '',
        premiumVat: '15',
        stampCharge: '',
        totalAmount: '',
        status: 'Opened',
        piOpeningDate: '',
        latestShipmentDate: '',
        marineCoverNote: '',
        marineCNDate: '',
        port: '',
        productsList: [{ productName: '', hsCode: '', quantity: '', rate: '', freight: '', totalFreight: '', totalDollar: '' }],
    });
    const [gpRecords, setGpRecords] = useState([]);
    const [lcExpenses, setLcExpenses] = useState([]);

    const informativeQuantities = useMemo(() => {
        const selectedPi = piRecordsRaw.find(pi => pi.piNumber === formData.piNo);
        const piQtyTon = selectedPi ? (parseFloat(selectedPi.quantity || 0) / 1000) : 0;

        const ipNumbers = formData.ipNumbers?.length
            ? formData.ipNumbers
            : (formData.ipNo ? [formData.ipNo] : []);

        const ipEntries = ipNumbers.map(ipNo => ({
            ipNo,
            remIpQtyTon: getRemIpQtyTon(ipNo, ipRecordsRaw, lcRecords, editingId),
        }));

        return { piQtyTon, ipEntries };
    }, [formData.ipNo, formData.ipNumbers, formData.piNo, ipRecordsRaw, piRecordsRaw, lcRecords, editingId]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            const refs = [piRef, bankRef, importerRef, exporterRef, productRef, insuranceRef, statusRef, amendmentLcRef, amendmentPiRef];
            const isClickInside = refs.some(ref => ref.current && ref.current.contains(e.target));
            if (!isClickInside) {
                setActiveDropdown(null);
                setHighlightedIndex(-1);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDropdownSelect = (field, value) => {
        if (field === 'amendmentPiNo') {
            setAmendmentFormData(prev => ({ ...prev, piNo: value }));
            setActiveDropdown(null);
            return;
        }
        setFormData(prev => {
            const newState = { ...prev, [field]: value };

            // Auto-fill logic when PI Number is selected
            if (field === 'piNo') {
                if (value) {
                    const selectedPi = piRecordsRaw.find(pi => pi.piNumber === value);
                    if (selectedPi) {
                        if (selectedPi.partyName) newState.importerName = selectedPi.partyName;
                        if (selectedPi.exporterName) newState.exporterName = selectedPi.exporterName;
                        if (selectedPi.date) newState.piOpeningDate = selectedPi.date;
                        const piPort = selectedPi.port || selectedPi.portOfDischarge || selectedPi.portOfLoading;
                        if (piPort) newState.port = piPort;

                        const ipNums = getPiIpNumbers(selectedPi);
                        newState.ipNumbers = ipNums;
                        newState.ipNo = ipNums[0] || '';

                        newState.productsList = mapPiProductsToLc(selectedPi);
                        if (newState.productsList.length === 0) {
                            newState.productsList = [{ productName: '', hsCode: '', quantity: '', rate: '', freight: '', totalFreight: '', totalDollar: '' }];
                        }
                        syncRootFromProductsList(newState);
                    }
                } else {
                    newState.importerName = '';
                    newState.exporterName = '';
                    newState.hsCode = '';
                    newState.productName = '';
                    newState.quantity = '';
                    newState.rate = '';
                    newState.totalDollar = '';
                    newState.piOpeningDate = '';
                    newState.port = '';
                    newState.ipNumbers = [];
                    newState.ipNo = '';
                    newState.productsList = [{ productName: '', hsCode: '', quantity: '', rate: '', freight: '', totalFreight: '', totalDollar: '' }];
                }
            }

            // Auto-fill logic when Insurance Company is selected
            if (field === 'insuranceCo') {
                if (value) {
                    const selectedIns = insuranceRecordsRaw.find(ins => ins.companyName === value);
                    if (selectedIns) {
                        if (selectedIns.policyType) newState.policyType = selectedIns.policyType;
                        if (selectedIns.premiumPercent) newState.premium = selectedIns.premiumPercent;
                        if (selectedIns.premiumReturnPercent) newState.premiumReturn = selectedIns.premiumReturnPercent;
                        if (selectedIns.stampCharge) newState.stampCharge = selectedIns.stampCharge;

                        // Auto-calculate Net Premium, Gross Premium, and Return Amount
                        const totalAmount = parseFloat(newState.totalAmount || prev.totalAmount) || 0;
                        const exPct = parseFloat(newState.extraPercent || prev.extraPercent) || 0;
                        const prem = parseFloat(selectedIns.premiumPercent || newState.premium || prev.premium) || 0;
                        const premRet = parseFloat(selectedIns.premiumReturnPercent || newState.premiumReturn || prev.premiumReturn) || 0;
                        const pVat = parseFloat(newState.premiumVat || prev.premiumVat) || 0;
                        const stamp = parseFloat(selectedIns.stampCharge || newState.stampCharge || prev.stampCharge) || 0;

                        const baseNetPrem = (totalAmount * (prem / 100)) / 100;
                        const netPrem = baseNetPrem + (baseNetPrem * (exPct / 100));
                        newState.netPremium = netPrem > 0 ? netPrem.toFixed(2) : '';

                        const expRet = netPrem * (premRet / 100);
                        newState.expectedReturnAmount = expRet > 0 ? expRet.toFixed(2) : '';

                        const vatAmount = netPrem * (pVat / 100);
                        const gPrem = netPrem + vatAmount + stamp;
                        newState.grossPremium = gPrem > 0 ? gPrem.toFixed(2) : '';
                    }
                } else {
                    newState.policyType = '';
                    newState.premium = '';
                    newState.premiumReturn = '';
                    newState.stampCharge = '';
                    newState.netPremium = '';
                    newState.expectedReturnAmount = '';
                    newState.grossPremium = '';
                }
            }

            return newState;
        });
        setActiveDropdown(null);
        setHighlightedIndex(-1);
    };

    const handleDropdownKeyDown = (e, dropdownId, field, options = []) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.min(prev + 1, options.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < options.length) {
                handleDropdownSelect(field, options[highlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            setActiveDropdown(null);
        }
    };

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const [lcRes, bankRes, impRes, expRes, insRes, ipRes, piRes, prodRes, stockRes, saleRes, gpRes, expenseRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/lc-management`),
                axios.get(`${API_BASE_URL}/api/banks`),
                axios.get(`${API_BASE_URL}/api/importers`),
                axios.get(`${API_BASE_URL}/api/exporters`),
                axios.get(`${API_BASE_URL}/api/insurance`),
                axios.get(`${API_BASE_URL}/api/ip-records`),
                axios.get(`${API_BASE_URL}/api/pi`),
                axios.get(`${API_BASE_URL}/api/products`),
                axios.get(`${API_BASE_URL}/api/stock`),
                axios.get(`${API_BASE_URL}/api/sales`),
                axios.get(`${API_BASE_URL}/api/lc-gp`),
                axios.get(`${API_BASE_URL}/api/lc-expenses`)
            ]);
            setGpRecords(Array.isArray(gpRes.data) ? gpRes.data : []);
            setLcExpenses(Array.isArray(expenseRes.data) ? expenseRes.data : []);

            setLcRecords(Array.isArray(lcRes.data) ? lcRes.data : []);

            const rawStock = Array.isArray(stockRes.data) ? stockRes.data : [];
            const decryptedStock = rawStock.map(item => {
                try {
                    let d = item.data ? decryptData(item.data) : item;
                    // Robust Guard: If the result is a string or still has an inner 'data' string, decrypt again
                    if (typeof d === 'string') {
                        try { d = decryptData(d); } catch (e) { }
                    } else if (d && d.data && typeof d.data === 'string' && !d.lcNo) {
                        try { d = decryptData(d.data); } catch (e) { }
                    }
                    return d;
                } catch {
                    return item;
                }
            });
            setAllStockRecords(decryptedStock);

            const rawSales = Array.isArray(saleRes.data) ? saleRes.data : [];
            const decryptedSales = rawSales.map(item => {
                try {
                    let d = item.data ? decryptData(item.data) : item;
                    // Robust Guard: If the result is a string or still has an inner 'data' string, decrypt again
                    if (typeof d === 'string') {
                        try { d = decryptData(d); } catch (e) { }
                    } else if (d && d.data && typeof d.data === 'string' && !d.lcNo && !d.saleType) {
                        try { d = decryptData(d.data); } catch (e) { }
                    }
                    return d;
                } catch {
                    return item;
                }
            });
            setAllSalesRecords(decryptedSales);

            // Filter banks to only show those NOT marked as Indian (from PI Module)
            const moduleBanks = Array.isArray(bankRes.data) ? bankRes.data.filter(b => !b.isIndian) : [];
            const uniqueBankNames = Array.from(new Set(moduleBanks.map(b => (b.bankName || '').trim().toUpperCase()))).filter(Boolean);
            setBanks(uniqueBankNames);

            setImporters(Array.isArray(impRes.data) ? impRes.data.map(i => i.name) : []);
            setExporters(Array.isArray(expRes.data) ? expRes.data.map(e => e.name) : []);

            const rawIns = Array.isArray(insRes.data) ? insRes.data : [];
            setInsuranceRecordsRaw(rawIns);
            setInsuranceCos(rawIns.map(i => i.companyName));

            const rawIps = Array.isArray(ipRes.data) ? ipRes.data : [];
            setIpRecordsRaw(rawIps);
            setIpList(rawIps.map(ip => ip.ipNumber));

            const rawPis = Array.isArray(piRes.data) ? piRes.data : [];
            setPiRecordsRaw(rawPis);
            setPiList(rawPis.map(pi => pi.piNumber));

            setProductItems(Array.isArray(prodRes.data) ? prodRes.data.map(p => p.name) : []);
        } catch (error) {
            console.error('Error fetching LC initial data:', error);
            addNotification?.('Failed to load LC records', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLcProductChange = (idx, field, value) => {
        setFormData(prev => {
            const list = [...(prev.productsList || [])];
            list[idx] = calcLcProductLine({ ...list[idx], [field]: value });

            const newState = { ...prev, productsList: list };
            syncRootFromProductsList(newState);

            if (idx === 0 && ['quantity', 'rate', 'freight', 'totalDollar'].includes(field)) {
                const dRate = parseFloat(newState.dollarRate) || 0;
                let tDollar = parseFloat(newState.totalDollar) || 0;
                if (field === 'quantity' || field === 'rate' || field === 'freight') {
                    tDollar = parseFloat(list[0]?.totalDollar) || 0;
                    newState.totalDollar = list[0]?.totalDollar || '';
                }
                const totalVal = tDollar * dRate;
                newState.totalAmount = totalVal > 0 ? totalVal.toFixed(2) : '';

                const exPct = parseFloat(newState.extraPercent) || 0;
                const prem = parseFloat(newState.premium) || 0;
                const premRet = parseFloat(newState.premiumReturn) || 0;
                const pVat = parseFloat(newState.premiumVat) || 0;
                const stamp = parseFloat(newState.stampCharge) || 0;
                const baseNetPrem = (totalVal * (prem / 100)) / 100;
                const netPrem = baseNetPrem + (baseNetPrem * (exPct / 100));
                newState.netPremium = netPrem > 0 ? netPrem.toFixed(2) : '';
                const expRet = netPrem * (premRet / 100);
                newState.expectedReturnAmount = expRet > 0 ? expRet.toFixed(2) : '';
                const vatAmount = netPrem * (pVat / 100);
                const gPrem = netPrem + vatAmount + stamp;
                newState.grossPremium = gPrem > 0 ? gPrem.toFixed(2) : '';
            }

            return newState;
        });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newState = { ...prev, [name]: value };

            if (['quantity', 'rate', 'totalDollar', 'dollarRate', 'extraPercent', 'premium', 'premiumReturn', 'totalAmount', 'premiumVat', 'stampCharge'].includes(name)) {
                let latestTotalAmount = parseFloat(prev.totalAmount) || 0;

                if (['quantity', 'rate', 'totalDollar', 'dollarRate'].includes(name)) {
                    const qty = parseFloat(name === 'quantity' ? value : prev.quantity) || 0;
                    const r = parseFloat(name === 'rate' ? value : prev.rate) || 0;
                    const dRate = parseFloat(name === 'dollarRate' ? value : prev.dollarRate) || 0;

                    let tDollar = parseFloat(prev.totalDollar) || 0;
                    if (name === 'quantity' || name === 'rate') {
                        tDollar = qty * r;
                        newState.totalDollar = tDollar > 0 ? tDollar.toFixed(2) : '';
                    } else if (name === 'totalDollar') {
                        tDollar = parseFloat(value) || 0;
                    }

                    const totalVal = tDollar * dRate;
                    latestTotalAmount = totalVal;
                    newState.totalAmount = totalVal > 0 ? totalVal.toFixed(2) : '';
                } else if (name === 'totalAmount') {
                    latestTotalAmount = parseFloat(value) || 0;
                }

                const exPct = parseFloat(name === 'extraPercent' ? value : prev.extraPercent) || 0;
                const prem = parseFloat(name === 'premium' ? value : prev.premium) || 0;
                const premRet = parseFloat(name === 'premiumReturn' ? value : prev.premiumReturn) || 0;
                const pVat = parseFloat(name === 'premiumVat' ? value : prev.premiumVat) || 0;
                const stamp = parseFloat(name === 'stampCharge' ? value : prev.stampCharge) || 0;

                const baseNetPrem = (latestTotalAmount * (prem / 100)) / 100;
                const netPrem = baseNetPrem + (baseNetPrem * (exPct / 100));
                newState.netPremium = netPrem > 0 ? netPrem.toFixed(2) : '';

                const expRet = netPrem * (premRet / 100);
                newState.expectedReturnAmount = expRet > 0 ? expRet.toFixed(2) : '';

                const vatAmount = netPrem * (pVat / 100);
                const gPrem = netPrem + vatAmount + stamp;
                newState.grossPremium = gPrem > 0 ? gPrem.toFixed(2) : '';
            }

            return newState;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (editingId) {
                await axios.put(`${API_BASE_URL}/api/lc-management/${editingId}`, formData);

                // Add persistent notification for LC Update
                if (addNotification) {
                    addNotification(
                        'LC Record Updated',
                        `LC No: ${formData.lcNo} has been updated by ${currentUser?.name || currentUser?.username}.`,
                        ['Admin', 'Incharge', 'Border Manager', 'LC Manager', 'Data Entry']
                    );
                }

                addNotification?.('LC record updated successfully', 'success');
            } else {
                await axios.post(`${API_BASE_URL}/api/lc-management`, formData);

                // Add persistent notification for management roles
                if (addNotification) {
                    addNotification(
                        'New LC Opened',
                        `A new LC (No: ${formData.lcNo}) has been opened for ${formData.importerName} by ${currentUser?.name || currentUser?.username}.`,
                        ['Admin', 'Incharge', 'Border Manager', 'LC Manager', 'Data Entry']
                    );
                }

                addNotification?.('New LC record created successfully', 'success');
            }
            resetForm();
            fetchInitialData();
        } catch (error) {
            console.error('Error saving LC record:', error);
            addNotification?.('Failed to save LC record', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (record) => {
        const loadedProducts = (record.productsList?.length > 0
            ? record.productsList
            : [{ productName: record.productName || '', hsCode: record.hsCode || '', quantity: record.quantity || '', rate: record.rate || '', freight: record.freight || '', totalFreight: record.totalFreight || '', totalDollar: record.totalDollar || '' }]
        ).map(calcLcProductLine);
        const parsedIpNumbers = record.ipNumbers?.length
            ? record.ipNumbers
            : (record.ipNo ? record.ipNo.split(',').map(s => s.trim()).filter(Boolean) : []);

        setFormData({
            ipNo: record.ipNo || parsedIpNumbers[0] || '',
            ipNumbers: parsedIpNumbers,
            lcNo: record.lcNo || '',
            openingDate: record.openingDate || '',
            expiryDate: record.expiryDate || '',
            bankName: record.bankName || '',
            importerName: record.importerName || '',
            exporterName: record.exporterName || '',
            hsCode: record.hsCode || '',
            productName: record.productName || '',
            quantity: record.quantity || '',
            rate: record.rate || '',
            totalDollar: record.totalDollar || '',
            dollarRate: record.dollarRate || '',
            insuranceCo: record.insuranceCo || '',
            policyType: record.policyType || '',
            extraPercent: record.extraPercent || '',
            premium: record.premium || '',
            grossPremium: record.grossPremium || '',
            premiumReturn: record.premiumReturn || '',
            expectedReturnAmount: record.expectedReturnAmount || '',
            netPremium: record.netPremium || '',
            premiumVat: record.premiumVat || '',
            stampCharge: record.stampCharge || '',
            totalAmount: record.totalAmount || '',
            status: record.status || 'Opened',
            piNo: record.piNo || '',
            piOpeningDate: record.piOpeningDate || '',
            latestShipmentDate: record.latestShipmentDate || '',
            marineCoverNote: record.marineCoverNote || '',
            marineCNDate: record.marineCNDate || '',
            port: record.port || '',
            productsList: loadedProducts,
        });
        setEditingId(record._id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = (id) => {
        setIdToDelete(id);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!idToDelete) return;
        setDeleteStatus('loading');
        try {
            await axios.delete(`${API_BASE_URL}/api/lc-management/${idToDelete}`);
            setDeleteStatus('success');
            fetchInitialData();
            setTimeout(() => {
                setShowDeleteConfirm(false);
                setDeleteStatus(null);
                setIdToDelete(null);
            }, 1500);
        } catch (error) {
            console.error('Error deleting LC record:', error);
            setDeleteStatus('error');
            setTimeout(() => setDeleteStatus(null), 3000);
        }
    };

    const selectedLcForAmendment = useMemo(() => {
        return lcRecords.find(lc => lc._id === selectedAmendmentLcId) || null;
    }, [selectedAmendmentLcId, lcRecords]);

    const selectedPiForAmendment = useMemo(() => {
        if (!amendmentFormData.piNo) return null;
        return piRecordsRaw.find(p => p.piNumber === amendmentFormData.piNo) || null;
    }, [amendmentFormData.piNo, piRecordsRaw]);

    const piBalanceTon = useMemo(() => {
        if (!amendmentFormData.piNo) return 0;
        const linkedPi = piRecordsRaw.find(p => p.piNumber === amendmentFormData.piNo);
        if (!linkedPi) return 0;
        const piQtyTon = parseFloat(linkedPi.quantity || 0) / 1000;
        
        // Sum of other LC quantities registered under this PI
        const currentLcId = selectedLcForAmendment?._id;
        const otherLcQtyTon = lcRecords
            .filter(lc => lc.piNo === amendmentFormData.piNo && lc._id !== currentLcId)
            .reduce((sum, lc) => sum + (parseFloat(lc.quantity) || 0), 0);
            
        return piQtyTon - otherLcQtyTon;
    }, [amendmentFormData.piNo, selectedLcForAmendment, piRecordsRaw, lcRecords]);

    const filteredLcRecordsForAmendment = useMemo(() => {
        const q = amendmentSearchQuery.toLowerCase().trim();
        if (!q) return lcRecords;
        return lcRecords.filter(lc => (lc.lcNo || '').toLowerCase().includes(q));
    }, [amendmentSearchQuery, lcRecords]);

    const handleAmendmentLcSelect = (lc) => {
        setSelectedAmendmentLcId(lc._id);
        const nextNo = (lc.amendments || []).length + 1;
        const nextNoStr = `AMENDMENT NO-${String(nextNo).padStart(2, '0')}`;
        setAmendmentFormData({
            amendmentNo: nextNoStr,
            amendmentDate: new Date().toISOString().split('T')[0],
            expiryDate: lc.expiryDate ? lc.expiryDate.split('T')[0] : '',
            quantity: lc.quantity || '',
            rate: lc.rate || '',
            dollarRate: lc.dollarRate || '',
            remarks: '',
            piNo: lc.piNo || ''
        });
        setAmendmentSearchQuery(lc.lcNo || '');
        setActiveDropdown(null);
        setHighlightedIndex(-1);
    };

    const handleAmendmentSubmit = async (e) => {
        e.preventDefault();
        if (!selectedAmendmentLcId) {
            addNotification?.('Please select an LC Number first.', 'error');
            return;
        }
        if (!amendmentFormData.amendmentNo || !amendmentFormData.amendmentDate) {
            addNotification?.('Amendment Number and Date are required.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const lc = selectedLcForAmendment;
            if (!lc) throw new Error('Selected LC not found');

            // Calculate new financial totals
            const qty = parseFloat(amendmentFormData.quantity) || 0;
            const r = parseFloat(amendmentFormData.rate) || 0;
            const dRate = parseFloat(amendmentFormData.dollarRate) || 0;

            const totalDollar = qty * r;
            const totalAmount = totalDollar * dRate;

            // Recalculate insurance based on the new total amount if there is an insurance company
            let netPremium = lc.netPremium;
            let expectedReturnAmount = lc.expectedReturnAmount;
            let grossPremium = lc.grossPremium;

            if (lc.insuranceCo) {
                const prem = parseFloat(lc.premium) || 0;
                const exPct = parseFloat(lc.extraPercent) || 0;
                const premRet = parseFloat(lc.premiumReturn) || 0;
                const pVat = parseFloat(lc.premiumVat) || 15;
                const stamp = parseFloat(lc.stampCharge) || 0;

                const baseNetPrem = (totalAmount * (prem / 100)) / 100;
                const netP = baseNetPrem + (baseNetPrem * (exPct / 100));
                netPremium = netP > 0 ? netP.toFixed(2) : '';

                const expRet = netP * (premRet / 100);
                expectedReturnAmount = expRet > 0 ? expRet.toFixed(2) : '';

                const vatAmount = netP * (pVat / 100);
                const gPrem = netP + vatAmount + stamp;
                grossPremium = gPrem > 0 ? gPrem.toFixed(2) : '';
            }

            // Create amendment log entry
            const newAmendment = {
                amendmentNo: amendmentFormData.amendmentNo,
                amendmentDate: amendmentFormData.amendmentDate,
                expiryDate: amendmentFormData.expiryDate,
                quantity: amendmentFormData.quantity,
                rate: amendmentFormData.rate,
                dollarRate: amendmentFormData.dollarRate,
                totalDollar: totalDollar > 0 ? totalDollar.toFixed(2) : '',
                totalAmount: totalAmount > 0 ? totalAmount.toFixed(2) : '',
                remarks: amendmentFormData.remarks,
                piNo: amendmentFormData.piNo,
                createdAt: new Date().toISOString()
            };

            // Update main LC record fields
            const updatedLcData = {
                ...lc,
                expiryDate: amendmentFormData.expiryDate,
                quantity: amendmentFormData.quantity,
                rate: amendmentFormData.rate,
                dollarRate: amendmentFormData.dollarRate,
                totalDollar: totalDollar > 0 ? totalDollar.toFixed(2) : '',
                totalAmount: totalAmount > 0 ? totalAmount.toFixed(2) : '',
                netPremium,
                expectedReturnAmount,
                grossPremium,
                piNo: amendmentFormData.piNo,
                lcAmendment: `${amendmentFormData.amendmentNo} DATE: ${formatDate(amendmentFormData.amendmentDate)}`,
                amendments: [...(lc.amendments || []), newAmendment]
            };

            // Save via PUT
            await axios.put(`${API_BASE_URL}/api/lc-management/${selectedAmendmentLcId}`, updatedLcData);

            if (addNotification) {
                addNotification(
                    'LC Amendment Saved',
                    `LC No: ${lc.lcNo} has been amended (${amendmentFormData.amendmentNo}) by ${currentUser?.name || currentUser?.username}.`,
                    ['Admin', 'Incharge', 'Border Manager', 'LC Manager', 'Data Entry']
                );
            }
            addNotification?.('LC Amendment saved successfully', 'success');

            // Reset state
            setShowAmendmentForm(false);
            setSelectedAmendmentLcId('');
            setAmendmentSearchQuery('');
            setAmendmentFormData({
                amendmentNo: '',
                amendmentDate: '',
                expiryDate: '',
                quantity: '',
                rate: '',
                dollarRate: '',
                remarks: '',
                piNo: ''
            });
            fetchInitialData();
        } catch (error) {
            console.error('Error saving LC amendment:', error);
            addNotification?.('Failed to save LC amendment', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const resetForm = () => {
        setFormData({
            ipNo: '',
            ipNumbers: [],
            lcNo: '',
            openingDate: '',
            expiryDate: '',
            bankName: '',
            importerName: '',
            exporterName: '',
            hsCode: '',
            productName: '',
            quantity: '',
            rate: '',
            totalDollar: '',
            dollarRate: '',
            insuranceCo: '',
            policyType: '',
            extraPercent: '',
            premium: '',
            grossPremium: '',
            premiumReturn: '',
            expectedReturnAmount: '',
            netPremium: '',
            premiumVat: '15',
            stampCharge: '',
            totalAmount: '',
            status: 'Opened',
            piNo: '',
            piOpeningDate: '',
            latestShipmentDate: '',
            marineCoverNote: '',
            marineCNDate: '',
            port: '',
            productsList: [{ productName: '', hsCode: '', quantity: '', rate: '', freight: '', totalFreight: '', totalDollar: '' }],
        });
        setEditingId(null);
        setShowForm(false);
    };

    const filteredRecords = lcRecords.filter(record => {
        const query = searchQuery.toLowerCase();
        const matchesProduct = (record.productName || '').toLowerCase().includes(query) ||
            (record.productsList && record.productsList.some(p => (p.productName || '').toLowerCase().includes(query)));
        return (record.ipNo || '').toLowerCase().includes(query) ||
            (record.lcNo || '').toLowerCase().includes(query) ||
            (record.importerName || '').toLowerCase().includes(query) ||
            (record.bankName || '').toLowerCase().includes(query) ||
            matchesProduct;
    });

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Standard Module Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {!showForm && !showAmendmentForm ? (
                    <>
                        <div className="w-full md:w-1/4 text-center md:text-left">
                            <h2 className="text-2xl font-bold text-gray-800">LC Management</h2>
                        </div>

                        <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                            <div className="absolute inset-y-0 left-0 pl-12 md:pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by IP, LC Number, Importer or Bank..."
                                autoComplete="off"
                                className="block w-full pl-10 pr-4 py-2.5 md:py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </>
                ) : (
                    <div className="hidden md:block md:flex-1"></div>
                )}

                {!showForm && !showAmendmentForm && canManage && (
                    <div className="w-full md:w-auto flex flex-row justify-end gap-3 z-50">
                        <button
                            onClick={() => setShowAmendmentForm(true)}
                            className="w-1/2 md:w-auto px-4 py-2 border border-blue-200 bg-blue-50/10 hover:bg-blue-50/50 text-blue-600 font-bold rounded-xl transition-all transform active:scale-95 md:hover:scale-105 flex items-center justify-center whitespace-nowrap text-sm h-[40px]"
                        >
                            <FileTextIcon className="w-4 h-4 mr-1.5 text-blue-500" />
                            <span>Amendment</span>
                        </button>
                        <button
                            onClick={() => setShowForm(true)}
                            className="w-1/2 md:w-auto px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 md:hover:scale-105 flex items-center justify-center whitespace-nowrap text-sm h-[40px]"
                        >
                            <PlusIcon className="w-4 h-4 mr-1.5" />
                            <span>New LC</span>
                        </button>
                    </div>
                )}
            </div>

            {showForm && (
                <div className="lc-form-container relative bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl p-5 md:p-8 pb-10">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl text-sm"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl delay-1000"></div>

                    <div className="flex items-center justify-between mb-6 md:mb-8 relative z-10">
                        <h3 className="text-lg md:text-xl font-semibold text-gray-800">
                            {editingId ? 'Edit LC Record' : 'New LC Registration'}
                        </h3>
                        <button
                            onClick={resetForm}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-all group active:scale-95"
                            title="Close Form"
                        >
                            <XIcon className="w-5 h-5 text-gray-400 group-hover:text-rose-500" />
                        </button>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                                e.preventDefault();
                            }
                        }}
                        autoComplete="off"
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10"
                    >
                        <div className="col-span-full mb-2">
                            <div className="bg-blue-50/30 border-l-4 border-blue-500 px-4 py-2 rounded-r-xl">
                                <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">LC Details</h3>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <CustomDatePicker
                                label="Opening Date"
                                value={formData.openingDate}
                                onChange={(e) => {
                                    const opening = e.target.value;
                                    setFormData(prev => {
                                        const newState = { ...prev, openingDate: opening };
                                        if (opening) {
                                            const date = new Date(opening);
                                            date.setDate(date.getDate() + 90);
                                            newState.expiryDate = date.toISOString().split('T')[0];
                                        }
                                        return newState;
                                    });
                                }}
                                required
                                compact={true}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <CustomDatePicker
                                label="Expiry Date"
                                value={formData.expiryDate}
                                onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                                required
                                compact={true}
                            />
                        </div>

                        <div className="space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">LC Number</label>
                            <input
                                type="text"
                                name="lcNo"
                                value={formData.lcNo}
                                onChange={handleInputChange}
                                required
                                autoComplete="off"
                                placeholder="Enter LC Number"
                                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                            />
                        </div>

                        <div className="space-y-1.5 text-left relative" ref={bankRef}>
                            <label className="text-sm font-semibold text-gray-600 ml-1">Issuing Bank</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="bankName"
                                    value={formData.bankName}
                                    onChange={handleInputChange}
                                    onFocus={() => { setActiveDropdown('bankName'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'bankName', 'bankName', banks.filter(b => !formData.bankName || b.toLowerCase().includes(formData.bankName.toLowerCase())))}
                                    placeholder="Select Bank"
                                    autoComplete="off"
                                    required
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {formData.bankName && (
                                        <button type="button" onClick={() => handleDropdownSelect('bankName', '')} className="text-gray-400 hover:text-gray-600">
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                </div>
                            </div>
                            {activeDropdown === 'bankName' && (
                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                    {banks.filter(b => !formData.bankName || b.toLowerCase().includes(formData.bankName.toLowerCase())).map((bank, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onMouseDown={(e) => { e.preventDefault(); handleDropdownSelect('bankName', bank); }}
                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                            className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.bankName === bank ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                        >
                                            {bank}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5 text-left relative" ref={piRef}>
                            <label className="text-sm font-semibold text-gray-600 ml-1">PI Number</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="piNo"
                                    value={formData.piNo}
                                    onChange={handleInputChange}
                                    onFocus={() => { setActiveDropdown('piNo'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'piNo', 'piNo', piList.filter(pi => !formData.piNo || pi.toLowerCase().includes(formData.piNo.toLowerCase())))}
                                    placeholder="Select PI Number"
                                    autoComplete="off"
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {formData.piNo && (
                                        <button type="button" onClick={() => handleDropdownSelect('piNo', '')} className="text-gray-400 hover:text-gray-600">
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                </div>
                            </div>
                            {activeDropdown === 'piNo' && (
                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                    {piList.filter(pi => !formData.piNo || pi.toLowerCase().includes(formData.piNo.toLowerCase())).map((pi, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onMouseDown={(e) => { e.preventDefault(); handleDropdownSelect('piNo', pi); }}
                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                            className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.piNo === pi ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                        >
                                            {pi}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-600 ml-1">PI Quantity (Ton)</label>
                            <input
                                type="text"
                                readOnly
                                value={formData.piNo ? informativeQuantities.piQtyTon.toLocaleString('en-IN', { minimumFractionDigits: 3 }) : ''}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/60 rounded-xl outline-none text-gray-500 font-bold"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <CustomDatePicker
                                label="PI Date"
                                value={formData.piOpeningDate}
                                onChange={(e) => setFormData(prev => ({ ...prev, piOpeningDate: e.target.value }))}
                                compact={true}
                                readOnly={true}
                            />
                        </div>

                        <div className="space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">Port</label>
                            <input
                                type="text"
                                name="port"
                                value={formData.port}
                                onChange={handleInputChange}
                                placeholder="Enter Port Name"
                                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                            />
                        </div>

                        {informativeQuantities.ipEntries.map((entry, idx) => (
                            <React.Fragment key={entry.ipNo || idx}>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-600 ml-1">
                                        IP Number{informativeQuantities.ipEntries.length > 1 ? ` (${idx + 1})` : ''}
                                    </label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={entry.ipNo}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/60 rounded-xl outline-none text-gray-700 font-bold"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-600 ml-1">
                                        Remaining IP Qty (Ton){informativeQuantities.ipEntries.length > 1 ? ` (${idx + 1})` : ''}
                                    </label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={entry.remIpQtyTon.toLocaleString('en-IN', { minimumFractionDigits: 3 })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/60 rounded-xl outline-none text-gray-500 font-bold"
                                    />
                                </div>
                            </React.Fragment>
                        ))}

                        <div className="space-y-1.5 text-left relative" ref={importerRef}>
                            <label className="text-sm font-semibold text-gray-600 ml-1">Importer</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="importerName"
                                    value={formData.importerName}
                                    onChange={handleInputChange}
                                    onFocus={() => { setActiveDropdown('importerName'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'importerName', 'importerName', importers.filter(i => !formData.importerName || i.toLowerCase().includes(formData.importerName.toLowerCase())))}
                                    placeholder="Select Importer"
                                    autoComplete="off"
                                    required
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {formData.importerName && (
                                        <button type="button" onClick={() => handleDropdownSelect('importerName', '')} className="text-gray-400 hover:text-gray-600">
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                </div>
                            </div>
                            {activeDropdown === 'importerName' && (
                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                    {importers.filter(i => !formData.importerName || i.toLowerCase().includes(formData.importerName.toLowerCase())).map((imp, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onMouseDown={(e) => { e.preventDefault(); handleDropdownSelect('importerName', imp); }}
                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                            className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.importerName === imp ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                        >
                                            {imp}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5 text-left relative" ref={exporterRef}>
                            <label className="text-sm font-semibold text-gray-600 ml-1">Exporter</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="exporterName"
                                    value={formData.exporterName}
                                    onChange={handleInputChange}
                                    onFocus={() => { setActiveDropdown('exporterName'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'exporterName', 'exporterName', exporters.filter(exp => !formData.exporterName || exp.toLowerCase().includes(formData.exporterName.toLowerCase())))}
                                    placeholder="Select Exporter"
                                    autoComplete="off"
                                    required
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {formData.exporterName && (
                                        <button type="button" onClick={() => handleDropdownSelect('exporterName', '')} className="text-gray-400 hover:text-gray-600">
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                </div>
                            </div>
                            {activeDropdown === 'exporterName' && (
                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                    {exporters.filter(exp => !formData.exporterName || exp.toLowerCase().includes(formData.exporterName.toLowerCase())).map((exp, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onMouseDown={(e) => { e.preventDefault(); handleDropdownSelect('exporterName', exp); }}
                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                            className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.exporterName === exp ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                        >
                                            {exp}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">Dollar Rate (BDT)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                <input
                                    type="number"
                                    name="dollarRate"
                                    value={formData.dollarRate}
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">Total LC Value</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                <input
                                    type="number"
                                    name="totalAmount"
                                    value={formData.totalAmount}
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <CustomDatePicker
                                label="Latest Shipment Date"
                                value={formData.latestShipmentDate}
                                onChange={(e) => setFormData(prev => ({ ...prev, latestShipmentDate: e.target.value }))}
                                compact={true}
                            />
                        </div>

                        <div className="space-y-1.5 text-left relative" ref={statusRef}>
                            <label className="text-sm font-semibold text-gray-600 ml-1">Status</label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl text-left focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium flex items-center justify-between"
                                >
                                    <span className={formData.status ? 'text-gray-900' : 'text-gray-400'}>{formData.status}</span>
                                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${activeDropdown === 'status' ? 'rotate-180' : ''}`} />
                                </button>
                                {activeDropdown === 'status' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl py-1">
                                        {['Opened', 'In-Transit', 'Received', 'Closed', 'Cancelled'].map((s, idx) => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => handleDropdownSelect('status', s)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.status === s ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="col-span-full mb-2 mt-4">
                            <div className="bg-blue-50/30 border-l-4 border-blue-500 px-4 py-2 rounded-r-xl">
                                <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Product Details</h3>
                            </div>
                        </div>

                        {(formData.productsList || [{ productName: '', hsCode: '', quantity: '', rate: '', freight: '', totalFreight: '', totalDollar: '' }]).map((item, prodIdx) => (
                            <div key={prodIdx} className="col-span-full space-y-3">
                                {(formData.productsList?.length || 0) > 1 && (
                                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wider ml-1">Product #{prodIdx + 1}</p>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-6">
                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">H.S Code</label>
                                        <input
                                            type="text"
                                            value={item.hsCode}
                                            onChange={(e) => handleLcProductChange(prodIdx, 'hsCode', e.target.value)}
                                            placeholder="Enter H.S Code"
                                            className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                        />
                                    </div>

                                    <div className="space-y-1.5 text-left relative" ref={prodIdx === 0 ? productRef : null}>
                                        <label className="text-sm font-semibold text-gray-600 ml-1">Product</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={item.productName}
                                                onChange={(e) => handleLcProductChange(prodIdx, 'productName', e.target.value)}
                                                onFocus={() => { setActiveDropdown(`productName_${prodIdx}`); setHighlightedIndex(-1); }}
                                                onKeyDown={(e) => {
                                                    const options = productItems.filter(p => !item.productName || p.toLowerCase().includes(item.productName.toLowerCase()));
                                                    if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < options.length) {
                                                        e.preventDefault();
                                                        handleLcProductChange(prodIdx, 'productName', options[highlightedIndex]);
                                                        setActiveDropdown(null);
                                                        setHighlightedIndex(-1);
                                                        return;
                                                    }
                                                    handleDropdownKeyDown(e, `productName_${prodIdx}`, 'productName', options);
                                                }}
                                                placeholder="Select Product"
                                                autoComplete="off"
                                                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                {item.productName && (
                                                    <button type="button" onClick={() => handleLcProductChange(prodIdx, 'productName', '')} className="text-gray-400 hover:text-gray-600">
                                                        <XIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                            </div>
                                        </div>
                                        {activeDropdown === `productName_${prodIdx}` && (
                                            <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                {productItems.filter(p => !item.productName || p.toLowerCase().includes(item.productName.toLowerCase())).map((p, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onMouseDown={(e) => { e.preventDefault(); handleLcProductChange(prodIdx, 'productName', p); }}
                                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                                        className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${item.productName === p ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">Quantity (Ton)</label>
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => handleLcProductChange(prodIdx, 'quantity', e.target.value)}
                                            placeholder="0"
                                            className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                        />
                                    </div>

                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">Rate (Per Ton)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                                            <input
                                                type="number"
                                                value={item.rate}
                                                onChange={(e) => handleLcProductChange(prodIdx, 'rate', e.target.value)}
                                                step="0.001"
                                                placeholder="0.00"
                                                className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">Freight (Per Ton)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                                            <input
                                                type="number"
                                                value={item.freight}
                                                onChange={(e) => handleLcProductChange(prodIdx, 'freight', e.target.value)}
                                                step="0.001"
                                                placeholder="0.00"
                                                className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">Total Freight</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                                            <input
                                                type="text"
                                                readOnly
                                                value={item.totalFreight}
                                                placeholder="0.00"
                                                className="w-full px-4 py-2.5 pl-8 bg-gray-50 border border-gray-200/60 rounded-xl outline-none text-gray-600 font-medium cursor-not-allowed"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">Total Dollar</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                                            <input
                                                type="text"
                                                readOnly
                                                value={item.totalDollar}
                                                placeholder="0.00"
                                                className="w-full px-4 py-2.5 pl-8 bg-gray-50 border border-gray-200/60 rounded-xl outline-none text-gray-700 font-bold cursor-not-allowed"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="col-span-full mb-2 mt-4">
                            <div className="bg-blue-50/30 border-l-4 border-blue-500 px-4 py-2 rounded-r-xl">
                                <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Insurance Details</h3>
                            </div>
                        </div>

                        <div className="col-span-full grid grid-cols-1 md:grid-cols-3 lg:grid-cols-[2.2fr_0.9fr_1.2fr_1fr_1.2fr_2.2fr_1fr_1.2fr_1.2fr] gap-x-3 gap-y-4 items-end">
                            <div className="space-y-1.5 text-left relative md:col-span-2 lg:col-span-1" ref={insuranceRef}>
                                <label className="text-sm font-semibold text-gray-600 ml-1 whitespace-nowrap">Insurance Company</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="insuranceCo"
                                        value={formData.insuranceCo}
                                        onChange={handleInputChange}
                                        onFocus={() => { setActiveDropdown('insuranceCo'); setHighlightedIndex(-1); }}
                                        onKeyDown={(e) => handleDropdownKeyDown(e, 'insuranceCo', 'insuranceCo', insuranceCos.filter(ins => !formData.insuranceCo || ins.toLowerCase().includes(formData.insuranceCo.toLowerCase())))}
                                        placeholder="Select Insurance"
                                        autoComplete="off"
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        {formData.insuranceCo && (
                                            <button type="button" onClick={() => handleDropdownSelect('insuranceCo', '')} className="text-gray-400 hover:text-gray-600">
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                    </div>
                                </div>
                                {activeDropdown === 'insuranceCo' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                        {insuranceCos.filter(ins => !formData.insuranceCo || ins.toLowerCase().includes(formData.insuranceCo.toLowerCase())).map((ins, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onMouseDown={(e) => { e.preventDefault(); handleDropdownSelect('insuranceCo', ins); }}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.insuranceCo === ins ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {ins}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1 whitespace-nowrap">
                                    {formData.policyType ? `${formData.policyType.replace(/insurance/i, '').trim()} Premium` : 'Premium'}
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        name="premium"
                                        value={formData.premium}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 pr-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1 whitespace-nowrap">Premium Return</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        name="premiumReturn"
                                        value={formData.premiumReturn}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 pr-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1 whitespace-nowrap">Extra Percent</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        name="extraPercent"
                                        value={formData.extraPercent}
                                        onChange={handleInputChange}
                                        placeholder="0"
                                        className="w-full px-4 py-2.5 pr-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1 whitespace-nowrap">Net Premium</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                    <input
                                        type="number"
                                        name="netPremium"
                                        value={formData.netPremium}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1 whitespace-nowrap">Premium VAT</label>
                                <div className="grid grid-cols-[1.5fr_1fr] gap-1">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                        <input
                                            type="text"
                                            readOnly
                                            value={(parseFloat(formData.netPremium || 0) * (parseFloat(formData.premiumVat || 0) / 100)).toFixed(2)}
                                            className="w-full px-4 py-2.5 pl-8 bg-gray-50/50 border border-gray-200/60 rounded-xl outline-none font-medium text-gray-500 cursor-not-allowed"
                                        />
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            name="premiumVat"
                                            value={formData.premiumVat}
                                            onChange={handleInputChange}
                                            placeholder="15"
                                            className="w-full px-4 py-2.5 pr-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1 whitespace-nowrap">Stamp Charge</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                    <input
                                        type="number"
                                        name="stampCharge"
                                        value={formData.stampCharge}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1 whitespace-nowrap">Gross Premium</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                    <input
                                        type="number"
                                        name="grossPremium"
                                        value={formData.grossPremium}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1 whitespace-nowrap">Return Amount</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                    <input
                                        type="number"
                                        name="expectedReturnAmount"
                                        value={formData.expectedReturnAmount}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4 relative z-10 items-end">
                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Marine Cover Note</label>
                                <input
                                    type="text"
                                    name="marineCoverNote"
                                    value={formData.marineCoverNote}
                                    onChange={handleInputChange}
                                    placeholder="Enter Cover Note No"
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <CustomDatePicker
                                    label="Marine C.N Date"
                                    value={formData.marineCNDate}
                                    onChange={(e) => setFormData(prev => ({ ...prev, marineCNDate: e.target.value }))}
                                    compact={true}
                                    dropUp={true}
                                />
                            </div>

                            <div className="lg:col-span-2 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="w-full md:w-auto px-10 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wider"
                                >
                                    {isSaving ? 'Saving...' : editingId ? 'Update LC Record' : 'Save '}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {showAmendmentForm && (
                <div className="lc-form-container relative bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl p-5 md:p-8 pb-10">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl text-sm"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl delay-1000"></div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8 relative z-30 border-b border-gray-200/40 pb-4">
                        {/* Title */}
                        <div className="flex items-center gap-2 shrink-0">
                            <FileTextIcon className="w-5 h-5 text-blue-500" />
                            <span className="text-base font-bold text-gray-800">LC Amendment Registration</span>
                        </div>

                        {/* Search Dropdown in same line */}
                        <div className="flex-1 max-w-md w-full relative dropdown-container" ref={amendmentLcRef}>
                            <div className="relative w-full">
                                <input
                                    type="text"
                                    placeholder="Search or select LC number..."
                                    value={amendmentSearchQuery}
                                    onChange={(e) => {
                                        setAmendmentSearchQuery(e.target.value);
                                        setActiveDropdown('amendmentLc');
                                        setHighlightedIndex(-1);
                                    }}
                                    onFocus={() => {
                                        setActiveDropdown('amendmentLc');
                                        setHighlightedIndex(-1);
                                    }}
                                    className="w-full px-4 py-2 bg-white/70 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-center text-sm shadow-sm h-[38px]"
                                    required
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <ChevronDownIcon className="w-4 h-4" />
                                </div>
                            </div>
                            {activeDropdown === 'amendmentLc' && filteredLcRecordsForAmendment.length > 0 && (
                                <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                    {filteredLcRecordsForAmendment.map((lc, idx) => (
                                        <button
                                            key={lc._id}
                                            type="button"
                                            onClick={() => handleAmendmentLcSelect(lc)}
                                            className="w-full px-4 py-2 text-center text-sm flex justify-between items-center hover:bg-blue-50 text-gray-700 font-semibold"
                                        >
                                            <span className="flex-1 text-center">{lc.lcNo}</span>
                                            <span className="text-xs text-gray-400 font-normal pr-4">Date: {lc.openingDate ? formatDate(lc.openingDate) : '-'}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Close button */}
                        <button
                            onClick={() => {
                                setShowAmendmentForm(false);
                                setSelectedAmendmentLcId('');
                                setAmendmentSearchQuery('');
                                setAmendmentFormData({
                                    amendmentNo: '',
                                    amendmentDate: '',
                                    expiryDate: '',
                                    quantity: '',
                                    rate: '',
                                    dollarRate: '',
                                    remarks: '',
                                    piNo: ''
                                });
                            }}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-all group active:scale-95 shrink-0"
                            title="Close Form"
                        >
                            <XIcon className="w-5 h-5 text-gray-400 group-hover:text-rose-500" />
                        </button>
                    </div>

                    <form onSubmit={handleAmendmentSubmit} className="space-y-8 relative z-10 w-full">
                        {selectedAmendmentLcId && selectedLcForAmendment && (
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 w-full text-left">
                                {/* Left Side: Original Details View (Read-Only) */}
                                <div className="lg:col-span-1 space-y-6 bg-gray-50/50 border border-gray-100 rounded-2xl p-6">
                                    <div>
                                        <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4">Current LC Details</h4>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4 border-b border-gray-200/50 pb-2">
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PI Number</span>
                                                    <p className="text-sm font-bold text-gray-800 truncate" title={selectedLcForAmendment.piNo}>{selectedLcForAmendment.piNo || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">IP Number</span>
                                                    <p className="text-sm font-bold text-gray-800 truncate" title={selectedLcForAmendment.ipNumbers?.length ? selectedLcForAmendment.ipNumbers.join(', ') : selectedLcForAmendment.ipNo}>
                                                        {(selectedLcForAmendment.ipNumbers?.length ? selectedLcForAmendment.ipNumbers.join(', ') : selectedLcForAmendment.ipNo) || 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="border-b border-gray-200/50 pb-2">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Importer</span>
                                                <p className="text-sm font-bold text-gray-800 truncate">{selectedLcForAmendment.importerName}</p>
                                            </div>
                                            <div className="border-b border-gray-200/50 pb-2">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Exporter</span>
                                                <p className="text-sm font-bold text-gray-800 truncate">{selectedLcForAmendment.exporterName}</p>
                                            </div>
                                            <div className="border-b border-gray-200/50 pb-2">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bank Name</span>
                                                <p className="text-sm font-bold text-gray-800 truncate" title={selectedLcForAmendment.bankName}>{selectedLcForAmendment.bankName}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 border-b border-gray-200/50 pb-2">
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Opening Date</span>
                                                    <p className="text-sm font-bold text-gray-800 font-mono">{formatDate(selectedLcForAmendment.openingDate)}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current Expiry Date</span>
                                                    <p className="text-sm font-bold text-rose-500 font-mono">{formatDate(selectedLcForAmendment.expiryDate)}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 border-b border-gray-200/50 pb-2">
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current Quantity</span>
                                                    <p className="text-sm font-bold text-gray-800">{parseFloat(selectedLcForAmendment.quantity || 0).toLocaleString('en-US')} Ton</p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current Rate</span>
                                                    <p className="text-sm font-bold text-gray-800">${parseFloat(selectedLcForAmendment.rate || 0).toLocaleString('en-IN')}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Dollar</span>
                                                    <p className="text-sm font-bold text-blue-600">${parseFloat(selectedLcForAmendment.totalDollar || 0).toLocaleString('en-IN')}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Amount</span>
                                                    <p className="text-sm font-bold text-gray-800">৳{parseFloat(selectedLcForAmendment.totalAmount || 0).toLocaleString('en-IN')}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Amendment Details Inputs */}
                                <div className="lg:col-span-2 space-y-6 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4">Amendment Details</h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Amendment Number *</label>
                                            <input
                                                type="text"
                                                name="amendmentNo"
                                                value={amendmentFormData.amendmentNo}
                                                onChange={(e) => setAmendmentFormData(prev => ({ ...prev, amendmentNo: e.target.value }))}
                                                placeholder="e.g. AMENDMENT NO-01"
                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <CustomDatePicker
                                                label="Amendment Date *"
                                                value={amendmentFormData.amendmentDate}
                                                onChange={(e) => setAmendmentFormData(prev => ({ ...prev, amendmentDate: e.target.value }))}
                                                required
                                                compact={true}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <CustomDatePicker
                                                label="New Expiry Date"
                                                value={amendmentFormData.expiryDate}
                                                onChange={(e) => setAmendmentFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                                                compact={true}
                                            />
                                        </div>

                                         <div className="space-y-1.5 text-left relative" ref={amendmentPiRef}>
                                             <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">PI Number</label>
                                             <div className="relative">
                                                 <input
                                                     type="text"
                                                     value={amendmentFormData.piNo}
                                                     onChange={(e) => setAmendmentFormData(prev => ({ ...prev, piNo: e.target.value }))}
                                                     onFocus={() => { setActiveDropdown('amendmentPiNo'); setHighlightedIndex(-1); }}
                                                     onKeyDown={(e) => handleDropdownKeyDown(e, 'amendmentPiNo', 'amendmentPiNo', piList.filter(pi => !amendmentFormData.piNo || pi.toLowerCase().includes(amendmentFormData.piNo.toLowerCase())))}
                                                     placeholder="Select PI Number"
                                                     autoComplete="off"
                                                     className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10 text-sm"
                                                 />
                                                 <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                     {amendmentFormData.piNo && (
                                                         <button type="button" onClick={() => setAmendmentFormData(prev => ({ ...prev, piNo: '' }))} className="text-gray-400 hover:text-gray-600">
                                                             <XIcon className="w-4 h-4" />
                                                         </button>
                                                     )}
                                                     <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                 </div>
                                             </div>
                                             {activeDropdown === 'amendmentPiNo' && (
                                                 <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                     {piList.filter(pi => !amendmentFormData.piNo || pi.toLowerCase().includes(amendmentFormData.piNo.toLowerCase())).map((pi, idx) => (
                                                         <button
                                                             key={idx}
                                                             type="button"
                                                             onMouseDown={(e) => {
                                                                 e.preventDefault();
                                                                 setAmendmentFormData(prev => ({ ...prev, piNo: pi }));
                                                                 setActiveDropdown(null);
                                                             }}
                                                             onMouseEnter={() => setHighlightedIndex(idx)}
                                                             className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${amendmentFormData.piNo === pi ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                         >
                                                             {pi}
                                                         </button>
                                                     ))}
                                                 </div>
                                             )}
                                         </div>

                                         <div className="space-y-1.5 text-left">
                                             <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">PI Balance (Ton)</label>
                                             <input
                                                 type="text"
                                                 readOnly
                                                 value={selectedPiForAmendment ? `${piBalanceTon.toLocaleString('en-US', { minimumFractionDigits: 3 })} Ton` : 'N/A'}
                                                 className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-blue-600 font-bold text-sm"
                                             />
                                         </div>

                                         <div className="space-y-1.5 text-left">
                                             <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">PI Expiry Date</label>
                                             <input
                                                 type="text"
                                                 readOnly
                                                 value={selectedPiForAmendment?.validityDate ? formatDate(selectedPiForAmendment.validityDate) : 'N/A'}
                                                 className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-gray-500 font-bold text-sm"
                                             />
                                         </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">New Quantity (Ton)</label>
                                            <input
                                                type="number"
                                                step="any"
                                                name="quantity"
                                                value={amendmentFormData.quantity}
                                                onChange={(e) => setAmendmentFormData(prev => ({ ...prev, quantity: e.target.value }))}
                                                placeholder="e.g. 520.50"
                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">New Rate ($/Ton)</label>
                                            <input
                                                type="number"
                                                step="any"
                                                name="rate"
                                                value={amendmentFormData.rate}
                                                onChange={(e) => setAmendmentFormData(prev => ({ ...prev, rate: e.target.value }))}
                                                placeholder="e.g. 350.00"
                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">New Dollar Rate (৳)</label>
                                            <input
                                                type="number"
                                                step="any"
                                                name="dollarRate"
                                                value={amendmentFormData.dollarRate}
                                                onChange={(e) => setAmendmentFormData(prev => ({ ...prev, dollarRate: e.target.value }))}
                                                placeholder="e.g. 120.00"
                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>

                                        <div className="col-span-full space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Remarks / Amendment Details</label>
                                            <textarea
                                                name="remarks"
                                                value={amendmentFormData.remarks}
                                                onChange={(e) => setAmendmentFormData(prev => ({ ...prev, remarks: e.target.value }))}
                                                placeholder="Describe the details of the amendment..."
                                                rows="3"
                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowAmendmentForm(false);
                                                setSelectedAmendmentLcId('');
                                                setAmendmentSearchQuery('');
                                                setAmendmentFormData({
                                                    amendmentNo: '',
                                                    amendmentDate: '',
                                                    expiryDate: '',
                                                    quantity: '',
                                                    rate: '',
                                                    dollarRate: '',
                                                    remarks: '',
                                                    piNo: ''
                                                });
                                            }}
                                            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all active:scale-95"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSaving}
                                            className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSaving ? 'Saving...' : 'Save Amendment'}
                                        </button>
                                    </div>
                                </div>

                                {/* Right Side: Product & Insurance Details (Read-Only) */}
                                <div className="lg:col-span-1 space-y-6 bg-gray-50/50 border border-gray-100 rounded-2xl p-6">
                                    <div>
                                        <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4">Product & Insurance</h4>
                                        <div className="space-y-4">
                                            {/* Product Details Section */}
                                            <div className="bg-blue-50/30 p-3 rounded-xl border border-blue-100/50 space-y-3">
                                                <div className="flex items-center gap-1.5 border-b border-blue-100/50 pb-1.5 mb-1">
                                                    <DollarSignIcon className="w-3.5 h-3.5 text-blue-500" />
                                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Product Info</span>
                                                </div>
                                                {selectedLcForAmendment.productsList && selectedLcForAmendment.productsList.length > 0 ? (
                                                    <div className="space-y-3">
                                                        {selectedLcForAmendment.productsList.map((prod, pIdx) => (
                                                            <div key={pIdx} className="border-b border-gray-200/40 pb-2 last:border-0 last:pb-0">
                                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Item {selectedLcForAmendment.productsList.length > 1 ? pIdx + 1 : ''}</span>
                                                                <p className="text-xs font-bold text-gray-800 truncate" title={prod.productName}>{prod.productName || '-'}</p>
                                                                <div className="grid grid-cols-2 gap-2 mt-1">
                                                                    <div>
                                                                        <span className="text-[8px] font-semibold text-gray-400 uppercase">Qty</span>
                                                                        <p className="text-[11px] font-bold text-gray-700">{parseFloat(prod.quantity || 0).toLocaleString('en-US')} Ton</p>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-[8px] font-semibold text-gray-400 uppercase">Rate</span>
                                                                        <p className="text-[11px] font-bold text-gray-700">${parseFloat(prod.rate || 0).toLocaleString('en-IN')}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Product Name</span>
                                                            <p className="text-xs font-bold text-gray-800 truncate">{selectedLcForAmendment.productName || selectedLcForAmendment.product || '-'}</p>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Quantity</span>
                                                                <p className="text-xs font-bold text-gray-800">{parseFloat(selectedLcForAmendment.quantity || 0).toLocaleString('en-US')} Ton</p>
                                                            </div>
                                                            <div>
                                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Rate</span>
                                                                <p className="text-xs font-bold text-gray-800">${parseFloat(selectedLcForAmendment.rate || 0).toLocaleString('en-IN')}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="border-t border-blue-100/50 pt-2 mt-2 text-left">
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Port</span>
                                                    <p className="text-xs font-bold text-gray-800">{selectedLcForAmendment.port || '-'}</p>
                                                </div>
                                            </div>

                                            {/* Insurance Details Section */}
                                            <div className="bg-indigo-50/30 p-3 rounded-xl border border-indigo-100/50 space-y-3">
                                                <div className="flex items-center gap-1.5 border-b border-indigo-100/50 pb-1.5 mb-1">
                                                    <ShieldIcon className="w-3.5 h-3.5 text-indigo-500" />
                                                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Insurance Info</span>
                                                </div>
                                                <div className="space-y-2 text-left">
                                                    <div>
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Company</span>
                                                        <p className="text-xs font-bold text-gray-800 truncate" title={selectedLcForAmendment.insuranceCo}>{selectedLcForAmendment.insuranceCo || '-'}</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Policy Type</span>
                                                            <p className="text-xs font-bold text-gray-800 truncate">{selectedLcForAmendment.policyType || '-'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Cover Note No</span>
                                                            <p className="text-xs font-bold text-gray-800 truncate" title={selectedLcForAmendment.marineCoverNote}>{selectedLcForAmendment.marineCoverNote || '-'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">C.N Date</span>
                                                            <p className="text-xs font-bold text-gray-800 truncate">{selectedLcForAmendment.marineCNDate ? formatDate(selectedLcForAmendment.marineCNDate) : '-'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Policy No</span>
                                                            <p className="text-xs font-bold text-gray-800 truncate" title={selectedLcForAmendment.policyNo}>{selectedLcForAmendment.policyNo || '-'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 border-t border-indigo-100/50 pt-1.5">
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Extra %</span>
                                                            <p className="text-xs font-bold text-gray-800">{selectedLcForAmendment.extraPercent || '0'}%</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Premium Rate</span>
                                                            <p className="text-xs font-bold text-gray-800">{selectedLcForAmendment.premium || '0'}%</p>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Premium Return</span>
                                                            <p className="text-xs font-bold text-blue-600">{selectedLcForAmendment.premiumReturn || '0'}%</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Return Amount</span>
                                                            <p className="text-xs font-bold text-blue-600 truncate">৳{parseFloat(selectedLcForAmendment.expectedReturnAmount || 0).toLocaleString('en-IN')}</p>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">VAT ({selectedLcForAmendment.premiumVat || '0'}%)</span>
                                                            <p className="text-xs font-bold text-gray-800 truncate">
                                                                ৳{(parseFloat(selectedLcForAmendment.netPremium || 0) * (parseFloat(selectedLcForAmendment.premiumVat || 0) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Stamp Duty</span>
                                                            <p className="text-xs font-bold text-gray-800">৳{parseFloat(selectedLcForAmendment.stampCharge || 0).toLocaleString('en-IN')}</p>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 border-t border-indigo-100/50 pt-1.5 mt-1">
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Gross Premium</span>
                                                            <p className="text-xs font-bold text-gray-800">৳{parseFloat(selectedLcForAmendment.grossPremium || 0).toLocaleString('en-US')}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Net Premium</span>
                                                            <p className="text-xs font-bold text-indigo-600 truncate">৳{parseFloat(selectedLcForAmendment.netPremium || 0).toLocaleString('en-US')}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            )}

            {!showForm && !showAmendmentForm && (
                <div className="overflow-x-auto bg-white/50 backdrop-blur-xl border border-white/40 rounded-2xl shadow-xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Date</th>
                                <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Expire Date</th>
                                <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">LC No</th>
                                <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Importer</th>
                                <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Exporter</th>
                                <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Bank</th>
                                <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Port</th>
                                <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Product</th>
                                <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">Quantity (Kg)</th>
                                <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">Total Value (৳)</th>
                                <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">LC Balance</th>
                                <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">Rem G.P</th>
                                <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">Expense</th>
                                <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center text-nowrap">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="14" className="px-6 py-12 text-center text-sm text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="font-medium text-gray-400">Loading records...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredRecords.length > 0 ? (
                                filteredRecords.map((record) => {
                                    // Helper for sanitized numeric parsing
                                    const parseNum = (val) => {
                                        if (val === null || val === undefined) return 0;
                                        return parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0;
                                    };

                                    // Failsafe LC Matching: Compare only the numeric digits
                                    const cleanLc = (val) => String(val || '').replace(/\D/g, '');

                                    // Dynamic fallback for Port if empty in LC record
                                    const linkedPi = record.piNo ? piRecordsRaw.find(p => p.piNumber === record.piNo) : null;
                                    const displayPort = record.port || (linkedPi && (linkedPi.port || linkedPi.portOfDischarge || linkedPi.portOfLoading)) || '-';

                                    const displayProducts = record.productsList && record.productsList.length > 0
                                         ? record.productsList.map(p => p.productName).filter(Boolean).join(', ')
                                         : record.productName || '-';

                                     // Unit conversion for display (Data is in Tons, Table shows Kg)
                                     const totalQtyTons = record.productsList && record.productsList.length > 0
                                         ? record.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)
                                         : (parseFloat(record.quantity) || 0);
                                     const qtyKg = totalQtyTons * 1000;

                                    // Calculate Remaining Quantities
                                    // Received: From allStockRecords where lcNo matches and status is NOT requested/rejected
                                    const lcNoClean = cleanLc(record.lcNo);

                                    const receiptsMapForBalance = {};
                                    allStockRecords
                                        .filter(s => {
                                            const recordLcNoClean = cleanLc(s.lcNo);
                                            const status = (s.status || '').toLowerCase();
                                            return recordLcNoClean === lcNoClean && (status === 'accepted' || status === 'in stock');
                                        })
                                        .forEach(s => {
                                            const rawDate = s.date || s.receiveDate || s.createdAt || '';
                                            const dateStr = typeof rawDate === 'string' && rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
                                            const groupVal = s.totalLcQuantity || s.billOfEntry || s.totalLcTruck || s.truckNo || s.truck || 'single';
                                            const key = `${dateStr}_${groupVal}`;
                                            
                                            if (!receiptsMapForBalance[key]) {
                                                const itemSubtotal = (s.entries || []).reduce((iSum, item) => iSum + parseNum(item.inHouseQuantity || item.quantity), 0);
                                                receiptsMapForBalance[key] = parseNum(s.totalLcQuantity) || itemSubtotal || parseNum(s.inHouseQuantity) || parseNum(s.quantity);
                                            } else {
                                                if (!s.totalLcQuantity) {
                                                    receiptsMapForBalance[key] += parseNum(s.inHouseQuantity) || parseNum(s.quantity);
                                                }
                                            }
                                        });
                                    const receivedQtyKg = Object.values(receiptsMapForBalance).reduce((sum, qty) => sum + qty, 0);

                                    // Border Sale: From allSalesRecords where lcNo matches and is a Border Sale
                                    const borderSaleQtyKg = allSalesRecords
                                        .filter(s => {
                                            const recordLcNoClean = cleanLc(s.lcNo);

                                            // Adopt robust Border Sale detection
                                            const sTypeLow = (s.saleType || '').toLowerCase().trim();
                                            // Permissive: Catch by BS prefix OR explicit sale type OR presence of matching LC + port details
                                            const isBorder = sTypeLow.includes('border') ||
                                                (s.invoiceNo || '').startsWith('BS') ||
                                                (!s.saleType && !!(s.lcNo || s.port || s.importer)) ||
                                                (recordLcNoClean === lcNoClean && !!(s.port || s.importer));

                                            const status = (s.status || '').toLowerCase();
                                            return recordLcNoClean === lcNoClean && status === 'accepted' && isBorder;
                                        })
                                        .reduce((sum, s) => {
                                            const itemSubtotal = (s.items || []).reduce((iSum, item) => {
                                                const brandSubtotal = (item.brandEntries || []).reduce((bSum, b) => bSum + parseNum(b.quantity), 0);
                                                return iSum + (brandSubtotal || parseNum(item.quantity));
                                            }, 0);
                                            const qty = parseNum(s.currentTotalQty) || parseNum(s.totalQuantity) || parseNum(s.totalQty) || parseNum(s.qty) || parseNum(s.quantity) || parseNum(s.total) || itemSubtotal;
                                            return sum + qty;
                                        }, 0);

                                    const combinedRemKg = qtyKg - (receivedQtyKg + borderSaleQtyKg);

                                    // Calculate Rem G.P
                                    const totalGpQtyKg = gpRecords
                                        .filter(gp => String(gp.lcNumber || '').replace(/\D/g, '') === lcNoClean)
                                        .reduce((sum, gp) => sum + (parseFloat(gp.gpQuantity) || 0), 0);
                                    const remGpKg = Math.max(0, qtyKg - totalGpQtyKg);

                                    return (
                                        <tr key={record._id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 group">
                                            <td className="px-3 py-4 text-sm font-medium text-gray-600 whitespace-nowrap">{formatDate(record.openingDate)}</td>
                                            <td className="px-3 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">{formatDate(record.expiryDate)}</td>
                                            <td className="px-3 py-4 text-sm font-bold text-gray-900 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span>{record.lcNo}</span>
                                                    {record.amendments?.length > 0 && (
                                                        <span className="self-start mt-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200/50 rounded text-[9px] font-extrabold uppercase tracking-wide">
                                                            {record.lcAmendment?.split(' ')[0] || 'Amended'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-4 text-sm font-medium text-gray-700 whitespace-nowrap truncate max-w-[120px]" title={record.importerName}>{record.importerName}</td>
                                            <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap truncate max-w-[120px]" title={record.exporterName}>{record.exporterName}</td>
                                            <td className="px-3 py-4 text-sm text-gray-600 font-medium whitespace-nowrap truncate max-w-[120px]" title={record.bankName}>{record.bankName}</td>
                                            <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap truncate max-w-[80px]" title={displayPort}>{displayPort}</td>
                                            <td className="px-3 py-4 text-sm font-bold text-gray-900 whitespace-nowrap truncate max-w-[120px]" title={displayProducts}>{displayProducts}</td>
                                            <td className="px-3 py-4 text-sm text-right text-gray-600 whitespace-nowrap">
                                                <span className="font-bold text-gray-900">{qtyKg.toLocaleString('en-US')}</span> <span className="text-[10px] text-gray-400 font-normal">Kg</span>
                                            </td>
                                            <td className="px-3 py-4 text-sm text-right font-black text-gray-900 whitespace-nowrap">৳{parseFloat(record.totalAmount || 0).toLocaleString('en-IN')}</td>
                                            <td className="px-3 py-4 text-sm text-right whitespace-nowrap">
                                                <span className={`font-black ${combinedRemKg <= 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                    {combinedRemKg.toLocaleString('en-IN')} <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">Kg</span>
                                                </span>
                                            </td>
                                            <td className="px-3 py-4 text-sm text-right whitespace-nowrap">
                                                <span className={`font-black ${remGpKg <= 0 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                                    {remGpKg.toLocaleString('en-US')} <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">Kg</span>
                                                </span>
                                            </td>
                                            <td className="px-3 py-4 text-sm text-right whitespace-nowrap">
                                                {(() => {
                                                    const totalExpense = lcExpenses
                                                        .filter(exp => exp.lcNo === record.lcNo)
                                                        .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
                                                    return (
                                                        <span className={`font-black ${totalExpense > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                                                            {totalExpense > 0 ? `৳${totalExpense.toLocaleString('en-IN')}` : '—'}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-3 py-4 text-center">
                                                <div className="flex items-center justify-center gap-4">
                                                    <button
                                                        onClick={() => setViewData(record)}
                                                        className="text-gray-400 hover:text-blue-600 transition-colors"
                                                        title="View Details"
                                                    >
                                                        <EyeIcon className="w-5 h-5" />
                                                    </button>
                                                    {canManage && (
                                                        <>
                                                            <button
                                                                onClick={() => handleEdit(record)}
                                                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                                                title="Edit Record"
                                                            >
                                                                <EditIcon className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(record._id)}
                                                                className="text-gray-400 hover:text-red-600 transition-colors"
                                                                title="Delete Record"
                                                            >
                                                                <TrashIcon className="w-5 h-5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="14" className="px-6 py-12 text-center text-gray-400 font-medium whitespace-nowrap italic">
                                        No LC records found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            {viewData && (
                <ViewDetailsModal
                    data={viewData}
                    onClose={() => setViewData(null)}
                    allStockRecords={allStockRecords}
                    allSalesRecords={allSalesRecords}
                    gpRecords={gpRecords}
                    lcExpenses={lcExpenses}
                />
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"></div>
                    <div className="relative bg-white border border-gray-100 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-300">
                        {deleteStatus === 'success' ? (
                            <div className="p-12 text-center">
                                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-in zoom-in duration-500">
                                    <CheckIcon className="w-10 h-10 text-emerald-500" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 mb-2">Deleted!</h3>
                                <p className="text-sm text-gray-500">The LC record has been removed.</p>
                            </div>
                        ) : (
                            <div className="p-8">
                                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6 mx-auto rotate-3">
                                    <TrashIcon className="w-8 h-8 text-red-500" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 text-center mb-2">Delete Record?</h3>
                                <p className="text-sm text-gray-500 text-center mb-8">Are you sure you want to delete this LC record? This action cannot be undone.</p>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => {
                                            setShowDeleteConfirm(false);
                                            setIdToDelete(null);
                                        }}
                                        className="py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-2xl transition-all active:scale-95"
                                        disabled={deleteStatus === 'loading'}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        className="py-3.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-lg shadow-red-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                                        disabled={deleteStatus === 'loading'}
                                    >
                                        {deleteStatus === 'loading' ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            'Delete Now'
                                        )}
                                    </button>
                                </div>
                                {deleteStatus === 'error' && (
                                    <p className="text-center text-xs font-bold text-red-500 mt-4 animate-bounce">Failed to delete record. Please try again.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LCManagement;
