import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { XIcon, BarChartIcon, PrinterIcon, FunnelIcon, SearchIcon } from '../../Icons';
import { formatDate } from '../../../utils/helpers';
import { generateDealReceiveReportPDF } from '../../../utils/pdfGenerator';
import CustomDatePicker from '../../shared/CustomDatePicker';
import ReportFormatModal from '../../shared/ReportFormatModal';
import api from '../../../utils/api';

/* ─────────────────────────── helpers ─────────────────────────── */
const fmtInt = (n) => Math.round(parseFloat(n) || 0).toLocaleString('en-IN');

export const resolveLcNo = (r, deal, cogList = []) => {
    if (!r) return '';
    if (r.lcNo) return String(r.lcNo).trim();
    if (r.lcNumber) return String(r.lcNumber).trim();
    if (r.lc) return String(r.lc).trim();

    if (deal) {
        if (deal.lcNo) return String(deal.lcNo).trim();
        if (deal.lcNumber) return String(deal.lcNumber).trim();
        if (deal.lc) return String(deal.lc).trim();
    }

    if (Array.isArray(cogList) && cogList.length > 0) {
        const recId = String(r._id || '').trim();
        const recReceiveId = String(r.receiveId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const recInvoice = String(r.invoiceNo || '').trim().toLowerCase();
        const recProduct = String(r.product || r.productName || deal?.productName || '').trim().toLowerCase();

        const matched = cogList.find(cog => {
            const cogDrId = String(cog.dealReceiveId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const cogDrRef = String(cog.dealReceiveRefId || '').trim();
            if (recReceiveId && cogDrId && cogDrId === recReceiveId) return true;
            if (recId && cogDrRef && cogDrRef === recId) return true;
            if (recId && cogDrId && cogDrId === recId) return true;
            return false;
        }) || (recInvoice ? cogList.find(cog => {
            const cogInv = String(cog.invoiceNo || '').trim().toLowerCase();
            const cogProd = String(cog.product || '').trim().toLowerCase();
            return cogInv && cogInv === recInvoice && (!recProduct || !cogProd || recProduct === cogProd);
        }) : null);

        if (matched && matched.lcNo) return String(matched.lcNo).trim();
    }

    return '';
};

export const resolveLcReceiveInfo = (r, deal, cogList = [], stockList = []) => {
    if (!r) return { lcReceiveDate: null, status: 'Not Received', lcNo: '' };

    const recReceiveId = String(r.receiveId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const recId = String(r._id || '').trim();
    const recInvoice = String(r.invoiceNo || '').trim().toLowerCase();
    const recProduct = String(r.product || r.productName || deal?.productName || '').trim().toLowerCase();
    const recBrand = String(r.brand || deal?.brand || '').trim().toLowerCase();
    const targetTruck = String(r.truckNo || '').trim().toLowerCase();

    // 1. Match Cost of Goods entry for this Deal Receive
    const matchedCog = (cogList || []).find(cog => {
        const cogDrId = String(cog.dealReceiveId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const cogDrRef = String(cog.dealReceiveRefId || '').trim();
        if (recReceiveId && cogDrId && cogDrId === recReceiveId) return true;
        if (recId && cogDrRef && cogDrRef === recId) return true;
        if (recId && cogDrId && cogDrId === recId) return true;
        return false;
    }) || (recInvoice ? (cogList || []).find(cog => {
        const cogInv = String(cog.invoiceNo || '').trim().toLowerCase();
        const cogProd = String(cog.product || '').trim().toLowerCase();
        return cogInv && cogInv === recInvoice && (!recProduct || !cogProd || recProduct === cogProd);
    }) : null);

    const baseLcNo = (matchedCog && matchedCog.lcNo) || r.lcNo || r.lcNumber || r.lc || deal?.lcNo || deal?.lcNumber || deal?.lc || '';

    // 2. Match LC Receive (Stock) entry using COG or direct Deal Receive invoice
    let matchedStock = null;
    if (Array.isArray(stockList) && stockList.length > 0) {
        const cogIdStr = String(matchedCog?._id || '');
        const targetLc = String(matchedCog?.lcNo || baseLcNo || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const targetInv = String(matchedCog?.invoiceNo || r.invoiceNo || '').trim().toLowerCase();
        const targetProd = String(matchedCog?.product || recProduct || '').trim().toLowerCase();
        const targetBrand = String(matchedCog?.brand || recBrand || '').trim().toLowerCase();

        matchedStock = stockList.find(st => {
            if (cogIdStr && st.matchedCogId && String(st.matchedCogId) === cogIdStr) return true;
            const stLc = String(st.lcNo || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const stInv = String(st.invoiceNo || '').trim().toLowerCase();
            const stProd = String(st.productName || st.product || '').trim().toLowerCase();
            const stBrand = String(st.brand || '').trim().toLowerCase();

            const lcMatches = targetLc && stLc && targetLc === stLc;
            const invMatches = targetInv && stInv && targetInv === stInv;
            if (lcMatches && invMatches) {
                const prodMatches = !targetProd || !stProd || targetProd === stProd;
                const brandMatches = !targetBrand || !stBrand || targetBrand === stBrand;
                return prodMatches && brandMatches;
            }
            return false;
        }) || (targetInv ? stockList.find(st => {
            const stInv = String(st.invoiceNo || '').trim().toLowerCase();
            const stProd = String(st.productName || st.product || '').trim().toLowerCase();
            const stBrand = String(st.brand || '').trim().toLowerCase();
            if (stInv && stInv === targetInv) {
                const prodMatches = !targetProd || !stProd || targetProd === stProd;
                const brandMatches = !targetBrand || !stBrand || targetBrand === stBrand;
                return prodMatches && brandMatches;
            }
            return false;
        }) : null) || (targetLc ? stockList.find(st => {
            const stLc = String(st.lcNo || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const stTruck = String(st.truckNo || '').trim().toLowerCase();
            return stLc && targetLc === stLc && targetTruck && stTruck && targetTruck === stTruck;
        }) : null);
    }

    if (!matchedStock) {
        return {
            lcReceiveDate: null,
            status: 'Not Received',
            lcNo: baseLcNo
        };
    }

    const lcReceiveDate = matchedStock.date || matchedStock.receivedDate || (Array.isArray(matchedStock.entries) ? matchedStock.entries[0]?.date : null) || null;
    const rawStatus = matchedStock.status || (Array.isArray(matchedStock.entries) ? matchedStock.entries[0]?.status : null) || 'Received';
    const s = String(rawStatus).toLowerCase();
    let displayStatus = 'Received';
    if (s.includes('pending') || s.includes('request')) {
        displayStatus = 'Pending';
    } else if (s.includes('reject')) {
        displayStatus = 'Rejected';
    } else if (s.includes('stock') || s.includes('accept') || s.includes('received')) {
        displayStatus = 'Received';
    } else {
        displayStatus = rawStatus;
    }

    return {
        lcReceiveDate,
        status: displayStatus,
        lcNo: matchedStock.lcNo || baseLcNo || ''
    };
};

export const formatLcLast6 = (val) => {
    if (!val) return '—';
    const str = String(val).trim();
    if (!str) return '—';
    return str.length > 6 ? str.slice(-6) : str;
};

const DealReceiveReport = ({
    isOpen,
    onClose,
    records = [],         // deal-receive records (or via dealReceives prop)
    dealReceives = [],
    dealsList = [],       // lc-purchases records (or via deals prop)
    deals = [],
    costOfGoods = [],
    cogsList = [],
    stockList = [],
    stocksList = [],
    initialFilters = {}
}) => {
    const rawRecords = (records && records.length > 0) ? records : (dealReceives || []);
    const rawDeals = (dealsList && dealsList.length > 0) ? dealsList : (deals || []);

    const [cogs, setCogs] = useState(costOfGoods?.length ? costOfGoods : (cogsList || []));
    const [stocks, setStocks] = useState(stockList?.length ? stockList : (stocksList || []));
    const [showReportFormatModal, setShowReportFormatModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilterPanel, setShowFilterPanel] = useState(false);

    const filterButtonRef = useRef(null);
    const filterPanelRef = useRef(null);

    // Keep state in sync with passed props
    useEffect(() => {
        if (costOfGoods && costOfGoods.length > 0) setCogs(costOfGoods);
        else if (cogsList && cogsList.length > 0) setCogs(cogsList);
    }, [costOfGoods, cogsList]);

    useEffect(() => {
        if (stockList && stockList.length > 0) setStocks(stockList);
        else if (stocksList && stocksList.length > 0) setStocks(stocksList);
    }, [stockList, stocksList]);

    // Filters state
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        quickRange: 'all',
        supplier: '',
        product: '',
        brand: '',
        status: 'All',
        ...initialFilters
    });

    const [filterDropdownOpen, setFilterDropdownOpen] = useState({
        supplier: false,
        product: false,
        brand: false
    });

    const [filterSearchInputs, setFilterSearchInputs] = useState({
        supplier: '',
        product: '',
        brand: ''
    });

    // Reset when opened
    useEffect(() => {
        if (isOpen) {
            setFilters({
                startDate: '',
                endDate: '',
                quickRange: 'all',
                supplier: '',
                product: '',
                brand: '',
                status: 'All',
                ...initialFilters
            });
            setSearchQuery('');
            setShowFilterPanel(false);
            setFilterDropdownOpen({ supplier: false, product: false, brand: false });
        }
    }, [isOpen]);

    // Fetch COGs and Stock if empty
    useEffect(() => {
        if (!isOpen) return;
        const fetchAuxData = async () => {
            try {
                if (!cogs || cogs.length === 0) {
                    const cogRes = await api.get('/api/cost-of-goods');
                    if (cogRes.data && Array.isArray(cogRes.data)) {
                        setCogs(cogRes.data);
                    }
                }
            } catch (e) {
                console.error("Failed to load auxiliary Cost of Goods for report:", e);
            }
            try {
                if (!stocks || stocks.length === 0) {
                    const stRes = await api.get('/api/stock');
                    if (stRes.data && Array.isArray(stRes.data)) {
                        setStocks(stRes.data);
                    }
                }
            } catch (e) {
                console.error("Failed to load auxiliary Stock for report:", e);
            }
        };
        fetchAuxData();
    }, [isOpen]);

    // Click outside filter panel
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (
                filterPanelRef.current &&
                !filterPanelRef.current.contains(e.target) &&
                filterButtonRef.current &&
                !filterButtonRef.current.contains(e.target)
            ) {
                setShowFilterPanel(false);
                setFilterDropdownOpen({ supplier: false, product: false, brand: false });
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    // Escape key closes modal
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (e.key === 'Escape' && !showReportFormatModal) onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, showReportFormatModal, onClose]);

    const resetFilters = () => {
        setFilters({
            startDate: '',
            endDate: '',
            quickRange: 'all',
            supplier: '',
            product: '',
            brand: '',
            status: 'All'
        });
        setFilterSearchInputs({ supplier: '', product: '', brand: '' });
        setFilterDropdownOpen({ supplier: false, product: false, brand: false });
        setSearchQuery('');
    };

    /* ── Filter Options from dataset ── */
    const uniqueSuppliers = useMemo(() => {
        const s = new Set();
        rawRecords.forEach(r => {
            const name = r.supplier || r.supplierName;
            if (name) s.add(String(name).trim());
        });
        return Array.from(s).sort();
    }, [rawRecords]);

    const uniqueProducts = useMemo(() => {
        const s = new Set();
        rawRecords.forEach(r => {
            const prod = r.product || r.productName;
            if (prod) s.add(String(prod).trim());
        });
        return Array.from(s).sort();
    }, [rawRecords]);

    const uniqueBrands = useMemo(() => {
        const s = new Set();
        rawRecords.forEach(r => {
            if (r.brand) s.add(String(r.brand).trim());
        });
        return Array.from(s).sort();
    }, [rawRecords]);

    /* ── Enriched Records ── */
    const enrichedRecords = useMemo(() => {
        return rawRecords.map((r, idx) => {
            const rawDeal = rawDeals.find(d => {
                const dPId = String(d.purchaseId || '').replace(/-/g, '').toLowerCase();
                const rPId = String(r.purchaseId || '').replace(/-/g, '').toLowerCase();
                if (dPId && rPId && dPId === rPId) return true;
                const dId = String(d._id || '');
                const rRef = String(r.dealRefId || r.dealId || '');
                return dId && rRef && dId === rRef;
            });

            const lcInfo = resolveLcReceiveInfo(r, rawDeal, cogs, stocks);
            const trucksCount = Number(r.trucks || (Array.isArray(r.truckNumbers) && r.truckNumbers.length ? r.truckNumbers.length : 1)) || 1;
            const qtyVal = parseFloat(r.quantity) || 0;
            const netBillVal = parseFloat(r.netBill !== undefined && r.netBill !== '' ? r.netBill : r.totalBill) || 0;
            const dollarRateVal = parseFloat(r.dollarRateBdt || r.dollarRate) || 0;
            const costingVal = parseFloat(r.costingKg) || 0;

            const recIdStr = r.receiveId || `DR${String(idx + 1).padStart(4, '0')}`;
            const cleanPurId = (r.purchaseId || '').replace(/-/g, '');
            const supplierStr = r.supplier || r.supplierName || '—';
            const productStr = r.product || r.productName || '—';
            const brandStr = r.brand || '—';
            const invoiceStr = r.invoiceNo || '—';
            const truckNoStr = r.truckNo || (Array.isArray(r.truckNumbers) ? r.truckNumbers.filter(Boolean).join(', ') : '—') || '—';

            return {
                ...r,
                _idx: idx,
                _recId: recIdStr,
                _cleanPurId: cleanPurId,
                _supplier: supplierStr,
                _product: productStr,
                _brand: brandStr,
                _invoice: invoiceStr,
                _truckNo: truckNoStr,
                _trucksCount: trucksCount,
                _qtyVal: qtyVal,
                _netBillVal: netBillVal,
                _dollarRateVal: dollarRateVal,
                _costingVal: costingVal,
                _lcRecDate: lcInfo.lcReceiveDate,
                _lcNo: lcInfo.lcNo,
                _status: lcInfo.status || 'Not Received'
            };
        });
    }, [rawRecords, rawDeals, cogs, stocks]);

    const filteredRecords = useMemo(() => {
        return enrichedRecords.filter(r => {
            // Date Filter
            if (filters.startDate || filters.endDate) {
                const rDateStr = r.date ? String(r.date).split('T')[0] : '';
                if (filters.startDate && rDateStr < filters.startDate) return false;
                if (filters.endDate && rDateStr > filters.endDate) return false;
            }

            // Supplier Filter
            if (filters.supplier) {
                if (r._supplier.toLowerCase() !== filters.supplier.toLowerCase()) return false;
            }

            // Product Filter
            if (filters.product) {
                if (r._product.toLowerCase() !== filters.product.toLowerCase()) return false;
            }

            // Brand Filter
            if (filters.brand) {
                if (r._brand.toLowerCase() !== filters.brand.toLowerCase()) return false;
            }

            // Status Filter
            if (filters.status && filters.status !== 'All') {
                if (filters.status === 'Received') {
                    if (r._status !== 'Received' && r._status !== 'In Stock') return false;
                } else if (filters.status === 'Not Received') {
                    if (r._status !== 'Not Received' && r._status !== 'Pending') return false;
                }
            }

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchRecId = r._recId.toLowerCase().includes(q);
                const matchPurId = r._cleanPurId.toLowerCase().includes(q);
                const matchSupplier = r._supplier.toLowerCase().includes(q);
                const matchProduct = r._product.toLowerCase().includes(q);
                const matchBrand = r._brand.toLowerCase().includes(q);
                const matchInvoice = r._invoice.toLowerCase().includes(q);
                const matchTruckNo = r._truckNo.toLowerCase().includes(q);
                const matchLcNo = String(r._lcNo || '').toLowerCase().includes(q);
                if (!matchRecId && !matchPurId && !matchSupplier && !matchProduct && !matchBrand && !matchInvoice && !matchTruckNo && !matchLcNo) {
                    return false;
                }
            }

            return true;
        }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }, [enrichedRecords, filters, searchQuery]);

    // Summary Totals
    const totalTrucks = useMemo(() => filteredRecords.reduce((acc, r) => acc + r._trucksCount, 0), [filteredRecords]);
    const totalQty = useMemo(() => filteredRecords.reduce((acc, r) => acc + r._qtyVal, 0), [filteredRecords]);
    const receivedCount = useMemo(() => filteredRecords.filter(r => r._status === 'Received' || r._status === 'In Stock').length, [filteredRecords]);

    const hasActiveFilters = Boolean(
        filters.startDate || filters.endDate || (filters.quickRange && filters.quickRange !== 'all') ||
        filters.supplier || filters.product || filters.brand || (filters.status && filters.status !== 'All')
    );

    /* ── Export handlers ── */
    const handleExportPdf = async () => {
        setShowReportFormatModal(false);
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        await generateDealReceiveReportPDF(filteredRecords, filters, dateStr, rawDeals, cogs, stocks);
    };

    const handleExportExcel = () => {
        setShowReportFormatModal(false);
        try {
            const headers = [
                'SL', 'DATE', 'RECEIVE ID', 'PUR. ID', 'SUPPLIER', 'PRODUCT', 'BRAND',
                'INVOICE NO', 'TRUCK NO / VEHICLE', 'TRUCKS', 'QUANTITY (KG)',
                'COSTING / KG (BDT)', 'LC REC. DATE', 'LC NO', 'STATUS'
            ];
            const rows = filteredRecords.map((r, i) => [
                i + 1,
                formatDate(r.date),
                r._recId,
                r._cleanPurId || '—',
                `"${(r._supplier || '').replace(/"/g, '""')}"`,
                `"${(r._product || '').replace(/"/g, '""')}"`,
                `"${(r._brand || '').replace(/"/g, '""')}"`,
                `"${(r._invoice || '').replace(/"/g, '""')}"`,
                `"${(r._truckNo || '').replace(/"/g, '""')}"`,
                r._trucksCount,
                r._qtyVal,
                r._costingVal,
                r._lcRecDate ? formatDate(r._lcRecDate) : '—',
                formatLcLast6(r._lcNo),
                r._status
            ]);
            const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `Deal_Receive_Report_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error('CSV Export Error:', e);
        }
    };

    if (!isOpen || typeof document === 'undefined' || !document.body) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 pt-6 sm:p-4 lg:p-6 print:p-0 print:bg-white print:backdrop-none app-modal-overlay">
            <div className="bg-white w-full max-w-[96vw] 2xl:max-w-[1650px] max-h-[92vh] overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col print:max-h-none print:shadow-none print:rounded-none print:w-full print:h-auto">

                {/* ── Modal Header / Toolbar matching Purchase Deal Report exactly ── */}
                <div className="flex flex-row items-center justify-between px-3 sm:px-8 py-2.5 sm:py-4 border-b border-gray-100 print:hidden gap-1.5 sm:gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-shrink-0">
                        <div className="w-7 h-7 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-blue-50 rounded-lg sm:rounded-xl">
                            <BarChartIcon className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-blue-600" />
                        </div>
                        <h3 className="text-xs sm:text-lg lg:text-xl font-black text-gray-800 truncate leading-none">Deal Receive Report</h3>
                    </div>

                    {/* Quick Search Bar */}
                    <div className="hidden md:flex relative flex-1 max-w-md mx-6 no-print">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Find Receive ID, Pur. ID, supplier, product or brand..."
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

                    {/* Right controls */}
                    <div className="flex items-center justify-end gap-1 sm:gap-3 flex-shrink-0">
                        {/* Filter Button */}
                        <div className="relative flex items-center">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-xl transition-all border ${
                                    showFilterPanel || hasActiveFilters
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                        : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30'
                                }`}
                                title="Filter Records"
                            >
                                <FunnelIcon className={`w-3.5 h-3.5 sm:w-5 sm:h-5 ${showFilterPanel || hasActiveFilters ? 'text-white' : 'text-gray-400'}`} />
                            </button>

                            {/* Floating Advance Filter Panel matching PurchaseDealReport */}
                            {showFilterPanel && (
                                <>
                                    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[2005] md:hidden" onClick={() => setShowFilterPanel(false)} />
                                    <div ref={filterPanelRef} className="fixed inset-x-4 top-24 md:absolute md:top-full md:left-auto md:right-0 md:mt-2 w-auto md:w-[22rem] bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[2010] p-4 flex flex-col mb-4 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 flex-shrink-0">
                                            <h4 className="font-bold text-gray-900 text-sm">Advance Filter</h4>
                                            <button
                                                onClick={resetFilters}
                                                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                                            >
                                                Reset
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            {/* Status Filter */}
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Status</label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {[
                                                        { value: 'All', label: 'All' },
                                                        { value: 'Received', label: 'Received' },
                                                        { value: 'Not Received', label: 'Not Received' }
                                                    ].map((s) => (
                                                        <button
                                                            key={s.value}
                                                            type="button"
                                                            onClick={() => setFilters(prev => ({ ...prev, status: s.value }))}
                                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                                                filters.status === s.value
                                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                            }`}
                                                        >
                                                            {s.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Date Pickers */}
                                            <div className="space-y-2">
                                                <CustomDatePicker
                                                    label="From Date"
                                                    value={filters.startDate}
                                                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value, quickRange: 'custom' })}
                                                    compact={true}
                                                />
                                                <CustomDatePicker
                                                    label="To Date"
                                                    value={filters.endDate}
                                                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value, quickRange: 'custom' })}
                                                    compact={true}
                                                />
                                            </div>

                                            {/* Supplier Filter */}
                                            <div className="space-y-1.5 relative">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Supplier</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.supplier}
                                                        onChange={(e) => setFilterSearchInputs({ ...filterSearchInputs, supplier: e.target.value })}
                                                        onFocus={() => setFilterDropdownOpen({ supplier: true, product: false, brand: false })}
                                                        placeholder={filters.supplier || "Search Supplier..."}
                                                        className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${filters.supplier ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                        {filters.supplier && (
                                                            <button onClick={() => setFilters({ ...filters, supplier: '' })} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.supplier && (() => {
                                                    const filtered = uniqueSuppliers.filter(s => s.toLowerCase().includes((filterSearchInputs.supplier || '').toLowerCase()));
                                                    return (
                                                        <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => { setFilters({ ...filters, supplier: '' }); setFilterDropdownOpen({ ...filterDropdownOpen, supplier: false }); }}
                                                                className="w-full px-3 py-1.5 text-left text-xs hover:bg-blue-50 text-gray-500"
                                                            >
                                                                All Suppliers
                                                            </button>
                                                            {filtered.map(s => (
                                                                <button
                                                                    key={s}
                                                                    type="button"
                                                                    onClick={() => { setFilters({ ...filters, supplier: s }); setFilterDropdownOpen({ ...filterDropdownOpen, supplier: false }); }}
                                                                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-blue-50 font-semibold text-gray-800"
                                                                >
                                                                    {s}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Product Filter */}
                                            <div className="space-y-1.5 relative">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Product</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.product}
                                                        onChange={(e) => setFilterSearchInputs({ ...filterSearchInputs, product: e.target.value })}
                                                        onFocus={() => setFilterDropdownOpen({ supplier: false, product: true, brand: false })}
                                                        placeholder={filters.product || "Search Product..."}
                                                        className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${filters.product ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                        {filters.product && (
                                                            <button onClick={() => setFilters({ ...filters, product: '' })} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.product && (() => {
                                                    const filtered = uniqueProducts.filter(p => p.toLowerCase().includes((filterSearchInputs.product || '').toLowerCase()));
                                                    return (
                                                        <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => { setFilters({ ...filters, product: '' }); setFilterDropdownOpen({ ...filterDropdownOpen, product: false }); }}
                                                                className="w-full px-3 py-1.5 text-left text-xs hover:bg-blue-50 text-gray-500"
                                                            >
                                                                All Products
                                                            </button>
                                                            {filtered.map(p => (
                                                                <button
                                                                    key={p}
                                                                    type="button"
                                                                    onClick={() => { setFilters({ ...filters, product: p }); setFilterDropdownOpen({ ...filterDropdownOpen, product: false }); }}
                                                                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-blue-50 font-semibold text-gray-800 uppercase"
                                                                >
                                                                    {p}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Brand Filter */}
                                            <div className="space-y-1.5 relative">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Brand</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.brand}
                                                        onChange={(e) => setFilterSearchInputs({ ...filterSearchInputs, brand: e.target.value })}
                                                        onFocus={() => setFilterDropdownOpen({ supplier: false, product: false, brand: true })}
                                                        placeholder={filters.brand || "Search Brand..."}
                                                        className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${filters.brand ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                        {filters.brand && (
                                                            <button onClick={() => setFilters({ ...filters, brand: '' })} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.brand && (() => {
                                                    const filtered = uniqueBrands.filter(b => b.toLowerCase().includes((filterSearchInputs.brand || '').toLowerCase()));
                                                    return (
                                                        <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => { setFilters({ ...filters, brand: '' }); setFilterDropdownOpen({ ...filterDropdownOpen, brand: false }); }}
                                                                className="w-full px-3 py-1.5 text-left text-xs hover:bg-blue-50 text-gray-500"
                                                            >
                                                                All Brands
                                                            </button>
                                                            {filtered.map(b => (
                                                                <button
                                                                    key={b}
                                                                    type="button"
                                                                    onClick={() => { setFilters({ ...filters, brand: b }); setFilterDropdownOpen({ ...filterDropdownOpen, brand: false }); }}
                                                                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-blue-50 font-semibold text-gray-800"
                                                                >
                                                                    {b}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            <button
                                                onClick={() => {
                                                    setShowFilterPanel(false);
                                                    setFilterDropdownOpen({ supplier: false, product: false, brand: false });
                                                }}
                                                className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all mt-3 flex-shrink-0 active:scale-[0.98]"
                                            >
                                                APPLY FILTERS
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Print Button */}
                        <button
                            onClick={() => setShowReportFormatModal(true)}
                            className="w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg sm:rounded-xl shadow-lg shadow-blue-500/30 transition-all no-print"
                            title="Print / Export Report"
                        >
                            <PrinterIcon className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                        </button>

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg sm:rounded-xl transition-colors no-print"
                        >
                            <XIcon className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* ── Printable Content matching Purchase Deal Report exactly ── */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10 print:p-4 print:overflow-visible bg-white">
                    <div className="w-full max-w-[1550px] mx-auto space-y-6 sm:space-y-8 print:max-w-none">

                        {/* Header matching PDF layout */}
                        <div className="flex justify-between items-center pb-1">
                            {/* Left: Logo & Company Name */}
                            <div className="flex items-center gap-3">
                                <img src="/logo.png" alt="ANI Enterprise Logo" className="w-12 h-12 sm:w-14 sm:h-14 object-contain flex-shrink-0" />
                                <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ fontFamily: "'Fraunces', serif", color: '#f97316', textShadow: '1px 2px 4px rgba(0, 0, 0, 0.15)' }}>
                                    ANI ENTERPRISE
                                </h1>
                            </div>

                            {/* Right: Address Info */}
                            <div className="text-right text-[11px] sm:text-[12px] text-gray-700 leading-tight">
                                <p className="font-semibold text-gray-800">766, H.M Tower, Level-06</p>
                                <p>Borogola, Bogura, Bangladesh</p>
                                <p>Tel: +8802588813057</p>
                                <p>Email: anienterprise051@gmail.com</p>
                            </div>
                        </div>

                        {/* Orange Divider Line */}
                        <div className="border-t-2 border-[#f97316] w-full mt-3"></div>

                        {/* Centered Title Badge */}
                        <div className="flex justify-center -mt-5">
                            <div className="bg-[#f97316] text-white px-8 py-1 rounded shadow-sm">
                                <h2 className="text-xs sm:text-sm font-bold tracking-wider uppercase">
                                    DEAL RECEIVE REPORT
                                </h2>
                            </div>
                        </div>

                        {/* Filter Metadata Row */}
                        <div className="flex justify-between items-end text-[14px] text-gray-800 pt-6 px-2">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex">
                                    <span className="font-bold text-gray-900 w-28">Date Range:</span>
                                    <span className="text-gray-900">
                                        {filters.startDate ? formatDate(filters.startDate) : 'Start'} to {filters.endDate ? formatDate(filters.endDate) : 'Present'}
                                    </span>
                                </div>
                                {filters.supplier && (
                                    <div className="flex">
                                        <span className="font-bold text-gray-900 w-28">Supplier:</span>
                                        <span className="text-blue-700 font-extrabold">{filters.supplier}</span>
                                    </div>
                                )}
                                {filters.product && (
                                    <div className="flex">
                                        <span className="font-bold text-gray-900 w-28">Product:</span>
                                        <span className="text-gray-900 font-semibold">{filters.product}</span>
                                    </div>
                                )}
                                {filters.brand && (
                                    <div className="flex">
                                        <span className="font-bold text-gray-900 w-28">Brand:</span>
                                        <span className="text-gray-900">{filters.brand}</span>
                                    </div>
                                )}
                                {filters.status && filters.status !== 'All' && (
                                    <div className="flex">
                                        <span className="font-bold text-gray-900 w-28">Status:</span>
                                        <span className="text-gray-900 font-semibold">{filters.status}</span>
                                    </div>
                                )}
                            </div>
                            <div className="font-bold">
                                <span className="text-gray-900">Printed on:</span> <span className="text-gray-900">{formatDate(new Date().toISOString().split('T')[0])}</span>
                            </div>
                        </div>

                        {/* Full Deal Receive Table */}
                        <div className="overflow-x-auto border border-gray-900 rounded-none shadow-xs">
                            <table className="w-full border-collapse text-xs min-w-[1450px]">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-900 text-gray-900">
                                        <th className="border-r border-gray-900 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider whitespace-nowrap w-10">SL</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">DATE</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">RECEIVE ID</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">PUR. ID</th>
                                        <th className="border-r border-gray-900 px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">SUPPLIER</th>
                                        <th className="border-r border-gray-900 px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">PRODUCT</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">BRAND</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">INVOICE NO</th>
                                        <th className="border-r border-gray-900 px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">TRUCK NO / VEHICLE</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">TRUCKS</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">QUANTITY</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-right text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">COSTING / KG</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">LC REC. DATE</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">LC NO</th>
                                        <th className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">STATUS</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-900 text-xs">
                                    {filteredRecords.length > 0 ? (
                                        filteredRecords.map((r, idx) => {
                                            const isReceived = r._status === 'Received' || r._status === 'In Stock';
                                            return (
                                                <tr key={r._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                    <td className="border-r border-gray-900 px-2 py-1.5 text-center font-bold text-gray-900 whitespace-nowrap">{idx + 1}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1.5 text-center font-semibold text-gray-900 whitespace-nowrap">{formatDate(r.date)}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1.5 text-center font-bold text-blue-700 whitespace-nowrap">{r._recId}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1.5 text-center font-bold text-blue-700 whitespace-nowrap">{r._cleanPurId || '—'}</td>
                                                    <td className="border-r border-gray-900 px-2.5 py-1.5 font-bold text-gray-900 whitespace-nowrap">{r._supplier}</td>
                                                    <td className="border-r border-gray-900 px-2.5 py-1.5 font-bold text-gray-900 whitespace-nowrap uppercase">{r._product}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1.5 text-gray-800 whitespace-nowrap font-medium">{r._brand}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1.5 text-center font-bold text-blue-700 whitespace-nowrap">{r._invoice}</td>
                                                    <td className="border-r border-gray-900 px-2.5 py-1.5 font-medium text-gray-800 whitespace-nowrap">{r._truckNo}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1.5 text-center whitespace-nowrap">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                            {r._trucksCount} {r._trucksCount === 1 ? 'Truck' : 'Trucks'}
                                                        </span>
                                                    </td>
                                                    <td className="border-r border-gray-900 px-2 py-1.5 text-center font-bold text-green-700 whitespace-nowrap">
                                                        {r._qtyVal ? `${r._qtyVal.toLocaleString('en-IN')} KG` : '0 KG'}
                                                    </td>
                                                    <td className="border-r border-gray-900 px-2 py-1.5 text-right font-bold text-gray-900 whitespace-nowrap">
                                                        {r._costingVal ? `৳${r._costingVal.toFixed(2)}` : '—'}
                                                    </td>
                                                    <td className="border-r border-gray-900 px-2 py-1.5 text-center font-semibold text-gray-800 whitespace-nowrap">
                                                        {r._lcRecDate ? formatDate(r._lcRecDate) : '—'}
                                                    </td>
                                                    <td className="border-r border-gray-900 px-2 py-1.5 text-center font-bold text-gray-900 whitespace-nowrap">
                                                        {formatLcLast6(r._lcNo)}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-center whitespace-nowrap">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                                            isReceived
                                                                ? 'bg-green-100 text-green-800 border border-green-200'
                                                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                                                        }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${isReceived ? 'bg-green-600' : 'bg-amber-600'}`} />
                                                            {isReceived ? 'Received' : 'Not Received'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={15} className="px-6 py-12 text-center text-gray-400 font-semibold">
                                                No Deal Receive records matching your filters
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-blue-50/60 border-t-2 border-gray-900 font-black text-gray-900 text-xs">
                                        <td colSpan={9} className="border-r border-gray-900 px-3 py-2 text-right uppercase tracking-wider text-[11px]">
                                            TOTAL SUMMARY:
                                        </td>
                                        <td className="border-r border-gray-900 px-2 py-2 text-center whitespace-nowrap">
                                            {totalTrucks} Trucks
                                        </td>
                                        <td className="border-r border-gray-900 px-2 py-2 text-center text-green-700 whitespace-nowrap">
                                            {totalQty.toLocaleString('en-IN')} KG
                                        </td>
                                        <td className="border-r border-gray-900 px-2 py-2 text-center text-gray-400">—</td>
                                        <td className="border-r border-gray-900 px-2 py-2 text-center text-gray-400">—</td>
                                        <td className="border-r border-gray-900 px-2 py-2 text-center text-gray-400">—</td>
                                        <td className="px-2 py-2 text-center text-gray-400">—</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Summary Metric Cards matching Purchase Deal Report style below table */}
                        <div className="space-y-4 pt-6 px-2">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 print:grid-cols-4">
                                {/* Card 1: TOTAL RECEIVES */}
                                <div className="border border-gray-200 rounded-2xl bg-gray-50 shadow-sm print:border-gray-200 p-4 flex flex-col justify-between items-center text-center gap-2 min-h-[140px] sm:min-h-[150px] w-full">
                                    <div className="flex flex-col items-center gap-1 w-full">
                                        <div className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Receives</div>
                                        <div className="text-xs sm:text-sm font-bold text-gray-700 w-full break-words">
                                            RECORDS: {filteredRecords.length}
                                        </div>
                                    </div>
                                    <div className="w-full border-t border-gray-200"></div>
                                    <div className="flex flex-col items-center justify-center w-full">
                                        <div className="text-lg sm:text-xl font-black text-gray-900 w-full break-words">
                                            {filteredRecords.length} Receives
                                        </div>
                                    </div>
                                </div>

                                {/* Card 2: TOTAL TRUCKS */}
                                <div className="border border-gray-200 rounded-2xl bg-gray-50 shadow-sm print:border-gray-200 p-4 flex flex-col justify-between items-center text-center gap-2 min-h-[140px] sm:min-h-[150px] w-full">
                                    <div className="flex flex-col items-center gap-1 w-full">
                                        <div className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Trucks</div>
                                        <div className="text-xs sm:text-sm font-bold text-gray-700 w-full break-words">
                                            VEHICLES
                                        </div>
                                    </div>
                                    <div className="w-full border-t border-gray-200"></div>
                                    <div className="flex flex-col items-center justify-center w-full">
                                        <div className="text-lg sm:text-xl font-black text-blue-700 w-full break-words">
                                            {totalTrucks} Trucks
                                        </div>
                                    </div>
                                </div>

                                {/* Card 3: TOTAL RECEIVED QTY */}
                                <div className="border border-gray-200 rounded-2xl bg-gray-50 shadow-sm print:border-gray-200 p-4 flex flex-col justify-between items-center text-center gap-2 min-h-[140px] sm:min-h-[150px] w-full">
                                    <div className="flex flex-col items-center gap-1 w-full">
                                        <div className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Received</div>
                                        <div className="text-xs sm:text-sm font-bold text-gray-700 w-full break-words">
                                            RECEIVED QTY
                                        </div>
                                    </div>
                                    <div className="w-full border-t border-gray-200"></div>
                                    <div className="flex flex-col items-center justify-center w-full">
                                        <div className="text-lg sm:text-xl font-black text-green-700 w-full break-words">
                                            {fmtInt(totalQty)} KG
                                        </div>
                                    </div>
                                </div>

                                {/* Card 4: RECEIVED IN STOCK */}
                                <div className="border border-gray-200 rounded-2xl bg-gray-50 shadow-sm print:border-gray-200 p-4 flex flex-col justify-between items-center text-center gap-2 min-h-[140px] sm:min-h-[150px] w-full">
                                    <div className="flex flex-col items-center gap-1 w-full">
                                        <div className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Received in Stock</div>
                                        <div className="text-xs sm:text-sm font-bold text-gray-700 w-full break-words">
                                            ARRIVED AT WAREHOUSE
                                        </div>
                                    </div>
                                    <div className="w-full border-t border-gray-200"></div>
                                    <div className="flex flex-col items-center justify-center w-full">
                                        <div className="text-lg sm:text-xl font-black text-blue-700 w-full break-words">
                                            {receivedCount} / {filteredRecords.length}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="grid grid-cols-3 gap-6 pt-10 text-center text-xs font-bold text-gray-800">
                            <div>
                                <div className="border-t border-gray-900 pt-2 mx-6">PREPARED BY</div>
                            </div>
                            <div>
                                <div className="border-t border-gray-900 pt-2 mx-6">VERIFIED BY</div>
                            </div>
                            <div>
                                <div className="border-t border-gray-900 pt-2 mx-6">AUTHORIZED SIGNATURE</div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Report Format Modal */}
            {showReportFormatModal && (
                <ReportFormatModal
                    isOpen={showReportFormatModal}
                    onClose={() => setShowReportFormatModal(false)}
                    title="Deal Receive Report"
                    subtitle="Select export format for Deal Receive records"
                    onExportPdf={handleExportPdf}
                    onExportExcel={handleExportExcel}
                />
            )}
        </div>,
        document.body
    );
};

export default DealReceiveReport;
