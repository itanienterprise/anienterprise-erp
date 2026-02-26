import React, { useState, useRef, useEffect } from 'react';
import { XIcon, FileTextIcon, BarChartIcon, PrinterIcon, FunnelIcon, ChevronDownIcon } from '../../Icons';
import { generateProductHistoryPDF } from '../../../utils/pdfGenerator';
import CustomDatePicker from '../../shared/CustomDatePicker';

const ProductHistoryReport = ({
    isOpen,
    onClose,
    reportData, // { productName, filters, purchaseHistory, saleHistory }
}) => {
    const [activeTab, setActiveTab] = useState('total');
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [modalFilters, setModalFilters] = useState({ startDate: '', endDate: '', party: '', brand: '' });
    const [dropdownOpen, setDropdownOpen] = useState({ party: false, brand: false });
    const [dropdownSearch, setDropdownSearch] = useState({ party: '', brand: '' });
    const partyDropdownRef = useRef(null);
    const brandDropdownRef = useRef(null);
    const filterPanelRef = useRef(null);
    const filterButtonRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            // Check if click is outside party dropdown
            if (partyDropdownRef.current && !partyDropdownRef.current.contains(e.target)) {
                setDropdownOpen(d => ({ ...d, party: false }));
                setDropdownSearch(s => ({ ...s, party: '' }));
            }
            // Check if click is outside brand dropdown
            if (brandDropdownRef.current && !brandDropdownRef.current.contains(e.target)) {
                setDropdownOpen(d => ({ ...d, brand: false }));
                setDropdownSearch(s => ({ ...s, brand: '' }));
            }
            // Check if click is outside main filter panel AND not on the toggle button
            if (showFilterPanel &&
                filterPanelRef.current && !filterPanelRef.current.contains(e.target) &&
                filterButtonRef.current && !filterButtonRef.current.contains(e.target)) {
                setShowFilterPanel(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showFilterPanel]);

    useEffect(() => {
        if (reportData?.filters) {
            setModalFilters(prev => ({
                ...prev,
                startDate: reportData.filters.startDate || '',
                endDate: reportData.filters.endDate || '',
                brand: reportData.filters.brand || ''
            }));
        }
    }, [reportData]);
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    if (!isOpen || !reportData) return null;

    const { productName, filters, purchaseHistory: rawPurchaseHistory, saleHistory: rawSaleHistory } = reportData;

    const partyOptions = [...new Set((rawSaleHistory || []).map(s => s.companyName).filter(Boolean))].sort();
    const brandOptions = [...new Set([
        ...(rawPurchaseHistory || []).map(p => p.itemBrand),
        ...(rawSaleHistory || []).map(s => s.itemBrand)
    ].filter(Boolean))].sort();

    const purchaseHistory = (rawPurchaseHistory || []).filter(p => {
        if (modalFilters.startDate && p.date < modalFilters.startDate) return false;
        if (modalFilters.endDate && p.date > modalFilters.endDate) return false;
        if (modalFilters.brand && (p.itemBrand || '').toLowerCase() !== modalFilters.brand.toLowerCase()) return false;
        return true;
    });
    const saleHistory = (rawSaleHistory || []).filter(s => {
        if (modalFilters.startDate && s.date < modalFilters.startDate) return false;
        if (modalFilters.endDate && s.date > modalFilters.endDate) return false;
        if (modalFilters.party && (s.companyName || '') !== modalFilters.party) return false;
        if (modalFilters.brand && (s.itemBrand || '').toLowerCase() !== modalFilters.brand.toLowerCase()) return false;
        return true;
    });

    const isFilterApplied = Object.values(modalFilters).some(v => v !== '');

    // Calculate Unified History with Running Balance
    const unifiedHistory = (() => {
        const purchases = Object.values(purchaseHistory.reduce((acc, p) => {
            const key = `${p.date}_${p.lcNo}`;
            if (!acc[key]) acc[key] = { ...p, type: 'purchase', itemQty: 0, itemInHouseQty: 0, itemShortageQty: 0 };
            acc[key].itemQty += parseFloat(p.itemQty) || 0;
            acc[key].itemInHouseQty += parseFloat(p.itemInHouseQty) || 0;
            acc[key].itemShortageQty += parseFloat(p.itemShortageQty) || 0;
            return acc;
        }, {}));

        const sales = Object.values(saleHistory.reduce((acc, s) => {
            const key = `${s.date}_${s.invoiceNo}`;
            if (!acc[key]) acc[key] = { ...s, type: 'sale', itemQty: 0 };
            acc[key].itemQty += parseFloat(s.itemQty) || 0;
            return acc;
        }, {}));

        const combined = [...purchases, ...sales].sort((a, b) => new Date(a.date) - new Date(b.date));

        let currentBalance = 0;
        return combined.map(item => {
            if (item.type === 'purchase') {
                currentBalance += item.itemInHouseQty;
            } else {
                currentBalance -= item.itemQty;
            }
            return { ...item, runningInHouse: currentBalance };
        });
    })();

    const handlePrint = () => {
        const totalPurchaseQty = purchaseHistory.reduce((sum, item) => sum + (parseFloat(item.itemQty) || 0), 0);
        const totalInHouseQty = purchaseHistory.reduce((sum, item) => sum + (parseFloat(item.itemInHouseQty) || 0), 0);
        const totalShortageQty = purchaseHistory.reduce((sum, item) => sum + (parseFloat(item.itemShortageQty) || 0), 0);
        const totalSaleAmount = saleHistory.reduce((sum, s) => sum + (parseFloat(s.itemTotal) || 0), 0);

        generateProductHistoryPDF(
            productName,
            activeTab,
            purchaseHistory,
            saleHistory,
            {
                totalQty: totalPurchaseQty,
                totalInHouseQty,
                totalShortageQty,
                totalAmount: totalSaleAmount
            },
            filters
        );
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 print:p-0 print:bg-white print:backdrop-none">
            <div className="bg-white w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col print:max-h-none print:shadow-none print:rounded-none print:w-full print:h-auto">
                {/* Modal Header/Toolbar */}
                <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 print:hidden">
                    <div className="flex items-center gap-3 w-1/4">
                        <div className="p-2 bg-blue-50 rounded-xl">
                            <FileTextIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-800">Product Report</h3>
                            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{productName}</p>
                        </div>
                    </div>

                    {/* Tabs in Center */}
                    <div className="flex items-center gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100">
                        <button
                            onClick={() => setActiveTab('purchase')}
                            className={`px-6 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'purchase'
                                ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Purchase History
                        </button>
                        <button
                            onClick={() => setActiveTab('sale')}
                            className={`px-6 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'sale'
                                ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Sale History
                        </button>
                        <button
                            onClick={() => setActiveTab('total')}
                            className={`px-6 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'total'
                                ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Total History
                        </button>
                    </div>

                    <div className="flex items-center justify-end gap-3 w-1/4">
                        <div className="relative">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`p-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center group relative ${showFilterPanel || isFilterApplied ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                title="Filter"
                            >
                                <FunnelIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                {isFilterApplied && !showFilterPanel && (
                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-400 rounded-full border-2 border-white" />
                                )}
                            </button>

                            {showFilterPanel && (
                                <div ref={filterPanelRef} className="absolute right-0 mt-3 w-[380px] bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[110] p-5 animate-in fade-in zoom-in duration-200">
                                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                                        <h4 className="font-bold text-gray-900">Advanced Filters</h4>
                                        <button
                                            onClick={() => {
                                                setModalFilters({ startDate: '', endDate: '', party: '', brand: '' });
                                                setDropdownOpen({ party: false, brand: false });
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
                                                label="FROM DATE"
                                                value={modalFilters.startDate}
                                                onChange={(e) => setModalFilters({ ...modalFilters, startDate: e.target.value })}
                                                placeholder="Select start date"
                                                name="startDate"
                                                compact={true}
                                                fullWidth={true}
                                            />
                                            <CustomDatePicker
                                                label="TO DATE"
                                                value={modalFilters.endDate}
                                                onChange={(e) => setModalFilters({ ...modalFilters, endDate: e.target.value })}
                                                placeholder="Select end date"
                                                name="endDate"
                                                compact={true}
                                                fullWidth={true}
                                            />
                                        </div>

                                        {/* Party and Brand */}
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Party Dropdown */}
                                            <div ref={partyDropdownRef} className="space-y-1.5 relative">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Party</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={dropdownOpen.party ? dropdownSearch.party : modalFilters.party}
                                                        onFocus={() => {
                                                            setDropdownOpen({ party: true, brand: false });
                                                            setDropdownSearch(s => ({ ...s, party: '' }));
                                                        }}
                                                        onChange={e => setDropdownSearch(s => ({ ...s, party: e.target.value }))}
                                                        placeholder={modalFilters.party || 'Search Party...'}
                                                        className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm ${modalFilters.party && !dropdownOpen.party ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                                                    />
                                                    <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                    {dropdownOpen.party && (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            <button type="button" onClick={() => { setModalFilters({ ...modalFilters, party: '' }); setDropdownOpen({ party: false, brand: false }); setDropdownSearch(s => ({ ...s, party: '' })); }} className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 font-medium border-b border-gray-50">All Parties</button>
                                                            {partyOptions.filter(p => p.toLowerCase().includes(dropdownSearch.party.toLowerCase())).map(p => (
                                                                <button key={p} type="button" onClick={() => { setModalFilters({ ...modalFilters, party: p }); setDropdownOpen({ party: false, brand: false }); setDropdownSearch(s => ({ ...s, party: '' })); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${modalFilters.party === p ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600'}`}>{p}</button>
                                                            ))}
                                                            {partyOptions.filter(p => p.toLowerCase().includes(dropdownSearch.party.toLowerCase())).length === 0 && (
                                                                <p className="px-4 py-3 text-sm text-gray-400 italic">No results found</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Brand Dropdown */}
                                            <div ref={brandDropdownRef} className="space-y-1.5 relative">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Brand</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={dropdownOpen.brand ? dropdownSearch.brand : modalFilters.brand}
                                                        onFocus={() => {
                                                            setDropdownOpen({ party: false, brand: true });
                                                            setDropdownSearch(s => ({ ...s, brand: '' }));
                                                        }}
                                                        onChange={e => setDropdownSearch(s => ({ ...s, brand: e.target.value }))}
                                                        placeholder={modalFilters.brand || 'Search Brand...'}
                                                        className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm ${modalFilters.brand && !dropdownOpen.brand ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                                                    />
                                                    <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                    {dropdownOpen.brand && (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            <button type="button" onClick={() => { setModalFilters({ ...modalFilters, brand: '' }); setDropdownOpen({ party: false, brand: false }); setDropdownSearch(s => ({ ...s, brand: '' })); }} className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 font-medium border-b border-gray-50">All Brands</button>
                                                            {brandOptions.filter(b => b.toLowerCase().includes(dropdownSearch.brand.toLowerCase())).map(b => (
                                                                <button key={b} type="button" onClick={() => { setModalFilters({ ...modalFilters, brand: b }); setDropdownOpen({ party: false, brand: false }); setDropdownSearch(s => ({ ...s, brand: '' })); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${modalFilters.brand === b ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600'}`}>{b}</button>
                                                            ))}
                                                            {brandOptions.filter(b => b.toLowerCase().includes(dropdownSearch.brand.toLowerCase())).length === 0 && (
                                                                <p className="px-4 py-3 text-sm text-gray-400 italic">No results found</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setShowFilterPanel(false)}
                                            className="w-full py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-all mt-2"
                                        >
                                            Apply Filters
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handlePrint}
                            className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all shadow-sm flex items-center justify-center group"
                            title="Print Report"
                        >
                            <PrinterIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                        </button>
                        <button onClick={onClose} className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors">
                            <XIcon className="w-6 h-6 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Printable Content */}
                <div className="flex-1 overflow-y-auto p-12 print:p-4 print:overflow-visible bg-white">
                    <div className="max-w-[1000px] mx-auto space-y-8">
                        {/* Header */}
                        <div className="text-center space-y-1">
                            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">M/S ANI ENTERPRISE</h1>
                            <p className="text-[14px] text-gray-600">766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh</p>
                            <p className="text-[14px] text-gray-600">+8802588813057, +8801711-406898, anienterprise051@gmail.com, www.anienterprises.com.bd</p>
                        </div>
                        <div className="border-t-2 border-gray-900 w-full mt-4"></div>
                        <div className="flex justify-center -mt-6">
                            <div className="bg-white border-2 border-gray-900 px-12 py-1.5 inline-block">
                                <h2 className="text-xl font-bold text-gray-900 tracking-wide uppercase">
                                    {activeTab === 'purchase' ? 'Purchase History Report' : activeTab === 'sale' ? 'Sale History Report' : 'Product History Report'}
                                </h2>
                            </div>
                        </div>

                        {/* Metadata */}
                        <div className="flex justify-between items-end text-[14px] text-gray-800 pt-6 px-2">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex"><span className="font-bold text-gray-900 w-28">Product:</span> <span>{productName}</span></div>
                                <div className="flex"><span className="font-bold text-gray-900 w-28">Date Range:</span> <span>{formatDate(modalFilters.startDate) || 'Start'} to {formatDate(modalFilters.endDate) || 'Present'}</span></div>
                                {modalFilters.party && <div className="flex"><span className="font-bold text-gray-900 w-28">Party Filter:</span> <span>{modalFilters.party}</span></div>}
                                {modalFilters.brand && <div className="flex"><span className="font-bold text-gray-900 w-28">Brand Filter:</span> <span>{modalFilters.brand}</span></div>}
                            </div>
                            <div className="font-bold"><span className="text-gray-900">Printed on:</span> <span className="text-gray-900">{formatDate(new Date())}</span></div>
                        </div>

                        {/* Unified History Section (for Total Tab) */}
                        {activeTab === 'total' && (
                            <div className="space-y-4">
                                <div className="overflow-x-auto border border-gray-900">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-900 text-center">
                                                <th className="border-r border-gray-900 px-2 py-1 text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[9%] whitespace-nowrap">Date</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">LC No</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">Exporter</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[8%] whitespace-nowrap">Invoice</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[16%] whitespace-nowrap">Party</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-right text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[11%] whitespace-nowrap">Purchase Qty</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-right text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[10%] whitespace-nowrap">Sale Qty</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-right text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[10%] whitespace-nowrap">InHouse Qty</th>
                                                <th className="px-2 py-1 text-right text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">Short</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-900">
                                            {unifiedHistory.map((item, idx) => (
                                                <tr key={idx} className="border-b border-gray-900 last:border-0 hover:bg-gray-50 transition-colors">
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-gray-900 text-center whitespace-nowrap">{formatDate(item.date)}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] font-bold text-gray-900 text-center ">{item.lcNo || '-'}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-gray-900 whitespace-nowrap">{item.itemExporter || '-'}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-gray-900 text-center">{item.invoiceNo || '-'}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-gray-900 font-medium whitespace-nowrap">{item.type === 'purchase' ? '-' : (item.companyName || '-')}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-right text-gray-900 font-bold">{item.type === 'purchase' ? `${Math.round(item.itemQty).toLocaleString()} kg` : '-'}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-right text-blue-600 font-bold">{item.type === 'sale' ? `${Math.round(item.itemQty).toLocaleString()} kg` : '-'}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-right text-blue-700 font-black">{Math.round(item.runningInHouse).toLocaleString()} kg</td>
                                                    <td className="px-2 py-1 text-[12px] text-right text-rose-600 font-bold">{item.type === 'purchase' ? `${Math.round(item.itemShortageQty || 0).toLocaleString()} kg` : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-gray-100 border-t-2 border-gray-900 font-black text-center">
                                                <td colSpan="5" className="px-2 py-1.5 text-[12px] text-right uppercase border-r border-gray-900">Total History</td>
                                                <td className="px-2 py-1.5 text-[12px] text-right border-r border-gray-900">
                                                    {Math.round(purchaseHistory.reduce((sum, i) => sum + (parseFloat(i.itemQty) || 0), 0)).toLocaleString()} kg
                                                </td>
                                                <td className="px-2 py-1.5 text-[12px] text-right border-r border-gray-900 text-blue-600">
                                                    {Math.round(saleHistory.reduce((sum, s) => sum + (parseFloat(s.itemQty) || 0), 0)).toLocaleString()} kg
                                                </td>
                                                <td className="px-2 py-1.5 text-[12px] text-right border-r border-gray-900 text-blue-700">
                                                    {Math.round(unifiedHistory[unifiedHistory.length - 1]?.runningInHouse || 0).toLocaleString()} kg
                                                </td>
                                                <td className="px-2 py-1.5 text-[12px] text-right text-rose-600">
                                                    {Math.round(purchaseHistory.reduce((sum, i) => sum + (parseFloat(i.itemShortageQty) || 0), 0)).toLocaleString()} kg
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Purchase History Section (Indiviual Tab) */}
                        {activeTab === 'purchase' && purchaseHistory.length > 0 && (
                            <div className="space-y-4">
                                <div className="overflow-x-auto border border-gray-900">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-900">
                                                <th className="border-r border-gray-900 px-2 py-1 text-left text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">Date</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-left text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[15%] whitespace-nowrap">LC No</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-left text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[15%] whitespace-nowrap">Exporter</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-left text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[15%] whitespace-nowrap">Brand</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-right text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">Price</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-right text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[10%] whitespace-nowrap">Packet</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-right text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">LC Quantity</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-right text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">InHouse Qty</th>
                                                <th className="px-2 py-1 text-right text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">Short Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-900">
                                            {purchaseHistory.map((item, idx) => (
                                                <tr key={idx} className="border-b border-gray-900 last:border-0 hover:bg-gray-50 transition-colors">
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-gray-900 whitespace-nowrap">{formatDate(item.date)}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] font-bold text-gray-900">{item.lcNo}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-gray-900">{item.itemExporter || '-'}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-gray-900 whitespace-nowrap">{item.itemBrand}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-right text-gray-900">৳{parseFloat(item.itemPurchasedPrice || 0).toLocaleString()}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-right text-gray-900">{item.itemPacket}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-right text-gray-900 font-bold">{Math.round(item.itemQty).toLocaleString()} {item.unit}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-right text-blue-600 font-bold">{Math.round(item.itemInHouseQty).toLocaleString()} {item.unit}</td>
                                                    <td className="px-2 py-1 text-[12px] text-right text-rose-600 font-bold">{Math.round(item.itemShortageQty || 0).toLocaleString()} {item.unit}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-gray-100 border-t-2 border-gray-900 font-black">
                                                <td colSpan="4" className="px-2 py-1.5 text-[12px] text-right uppercase border-r border-gray-900">Total Purchase</td>
                                                <td className="px-2 py-1.5 text-[12px] text-right border-r border-gray-900 text-blue-700">
                                                    ৳{Math.round(purchaseHistory.reduce((sum, i) => sum + ((parseFloat(i.itemPurchasedPrice) || 0) * (parseFloat(i.itemQty) || 0)), 0)).toLocaleString()}
                                                </td>
                                                <td className="px-2 py-1.5 text-[12px] text-right border-r border-gray-900">
                                                    {purchaseHistory.reduce((sum, i) => sum + (parseInt(i.itemPacket) || 0), 0).toLocaleString()}
                                                </td>
                                                <td className="px-2 py-1.5 text-[12px] text-right border-r border-gray-900">
                                                    {Math.round(purchaseHistory.reduce((sum, i) => sum + (parseFloat(i.itemQty) || 0), 0)).toLocaleString()} {purchaseHistory[0]?.unit}
                                                </td>
                                                <td className="px-2 py-1.5 text-[12px] text-right border-r border-gray-900 text-blue-600">
                                                    {Math.round(purchaseHistory.reduce((sum, i) => sum + (parseFloat(i.itemInHouseQty) || 0), 0)).toLocaleString()} {purchaseHistory[0]?.unit}
                                                </td>
                                                <td className="px-2 py-1.5 text-[12px] text-right text-rose-600">
                                                    {Math.round(purchaseHistory.reduce((sum, i) => sum + (parseFloat(i.itemShortageQty) || 0), 0)).toLocaleString()} {purchaseHistory[0]?.unit}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Sale History Section (Individual Tab) */}
                        {activeTab === 'sale' && saleHistory.length > 0 && (
                            <div className="space-y-4 pt-4">
                                <div className="overflow-x-auto border border-gray-900">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-900">
                                                <th className="border-r border-gray-900 px-2 py-1 text-left text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">Date</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-left text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">Invoice</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-left text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[20%] whitespace-nowrap">Company</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-left text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[15%] whitespace-nowrap">Brand</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-right text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">Quantity</th>
                                                <th className="border-r border-gray-900 px-2 py-1 text-right text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">Price</th>
                                                <th className="px-2 py-1 text-right text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">Total Price</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-900">
                                            {saleHistory.map((sale, idx) => (
                                                <tr key={idx} className="border-b border-gray-900 last:border-0 hover:bg-gray-50 transition-colors">
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-gray-900 whitespace-nowrap">{formatDate(sale.date)}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] font-bold text-gray-900">{sale.invoiceNo}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-gray-900 font-medium">{sale.companyName || '-'}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-gray-900 whitespace-nowrap">{sale.itemBrand}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-right text-gray-900 font-bold">{sale.itemQty.toLocaleString()} kg</td>
                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-right text-gray-900">৳{sale.itemPrice.toLocaleString()}</td>
                                                    <td className="px-2 py-1 text-[12px] text-right text-blue-600 font-bold">৳{sale.itemTotal.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-gray-100 border-t-2 border-gray-900 font-black">
                                                <td colSpan="4" className="px-2 py-1.5 text-[12px] text-right uppercase border-r border-gray-900">Total Sale</td>
                                                <td className="px-2 py-1.5 text-[12px] text-right border-r border-gray-900">
                                                    {saleHistory.reduce((sum, s) => sum + s.itemQty, 0).toLocaleString()} kg
                                                </td>
                                                <td className="px-2 py-1.5 text-[12px] text-right border-r border-gray-900">-</td>
                                                <td className="px-2 py-1.5 text-[12px] text-right text-blue-700">
                                                    ৳{saleHistory.reduce((sum, s) => sum + s.itemTotal, 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Summary Cards */}
                        <div className="flex flex-wrap justify-center gap-6 pt-8 px-2 print:flex print:justify-center">
                            {(activeTab === 'total' || activeTab === 'purchase') && (
                                <div className="border border-gray-200 p-5 rounded-2xl bg-gray-50 shadow-sm print:border-gray-200 min-w-[350px] max-w-[450px] w-full">
                                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Final Conclusion</div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Total Purchase Qty:</span>
                                            <span className="font-bold">{Math.round(purchaseHistory.reduce((sum, i) => sum + (parseFloat(i.itemQty) || 0), 0)).toLocaleString()} kg</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Total Short Qty:</span>
                                            <span className="font-bold text-rose-600">{Math.round(purchaseHistory.reduce((sum, i) => sum + (parseFloat(i.itemShortageQty) || 0), 0)).toLocaleString()} kg</span>
                                        </div>
                                        {activeTab === 'total' && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Total Sale Qty:</span>
                                                <span className="font-bold">{saleHistory.reduce((sum, s) => sum + s.itemQty, 0).toLocaleString()} kg</span>
                                            </div>
                                        )}
                                        <div className="border-t border-gray-300 pt-1 mt-1 flex justify-between text-base font-black">
                                            <span className="text-blue-600 uppercase">Remaining InHouse:</span>
                                            <span className="text-blue-700">
                                                {Math.round(purchaseHistory.reduce((sum, i) => sum + (parseFloat(i.itemInHouseQty) || 0), 0)).toLocaleString()} kg
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(activeTab === 'total' || activeTab === 'sale') && (
                                <div className="border border-gray-200 p-5 rounded-2xl bg-blue-50/30 shadow-sm print:border-gray-200 min-w-[350px] max-w-[450px] w-full">
                                    <div className="text-[11px] font-bold text-blue-500 uppercase tracking-wider mb-2">Financial Summary</div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Total Sales Value:</span>
                                            <span className="font-bold text-blue-700">৳{saleHistory.reduce((sum, s) => sum + s.itemTotal, 0).toLocaleString()}</span>
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-4 leading-tight italic">
                                            * This report provides a comprehensive overview of the product movement, including {activeTab === 'total' ? 'purchases and sales' : activeTab} history.
                                        </p>
                                    </div>
                                </div>
                            )}
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

export default ProductHistoryReport;
