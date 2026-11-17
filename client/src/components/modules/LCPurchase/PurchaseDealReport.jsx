import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { XIcon, BarChartIcon, PrinterIcon, FunnelIcon, SearchIcon, ChevronDownIcon, CheckIcon } from '../../Icons';
import { formatDate } from '../../../utils/helpers';
import { generatePurchaseDealReportPDF } from '../../../utils/pdfGenerator';
import CustomDatePicker from '../../shared/CustomDatePicker';
import ReportFormatModal from '../../shared/ReportFormatModal';
import api from '../../../utils/api';

/* ─────────────────────────── helpers ─────────────────────────── */
const fmt = (n, dec = 2) =>
    (parseFloat(n) || 0).toLocaleString('en-IN', {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec
    });

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

export const formatLcLast6 = (val) => {
    if (!val) return '—';
    const str = String(val).trim();
    if (!str) return '—';
    return str.length > 6 ? str.slice(-6) : str;
};

const PurchaseDealReport = ({
    isOpen,
    onClose,
    deals = [],         // lc-purchases records
    dealReceives = [],  // deal-receive records
    costOfGoods = [],   // optional cost-of-goods list
    initialFilters = {}
}) => {
    const [reportType, setReportType] = useState('summary'); // 'summary' or 'deal_wise'
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showReportFormatModal, setShowReportFormatModal] = useState(false);
    const [cogs, setCogs] = useState(costOfGoods || []);

    useEffect(() => {
        if (costOfGoods && costOfGoods.length > 0) {
            setCogs(costOfGoods);
        } else if (isOpen) {
            api.get('/api/cost-of-goods')
                .then(res => {
                    const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
                    setCogs(data);
                })
                .catch(() => {});
        }
    }, [isOpen, costOfGoods]);

    const filterPanelRef = useRef(null);
    const filterButtonRef = useRef(null);

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

    /* ── Quick date range ── */
    const handleQuickRange = (range) => {
        const today = new Date();
        const iso = (d) => d.toISOString().split('T')[0];
        if (range === 'all') {
            setFilters(p => ({ ...p, quickRange: 'all', startDate: '', endDate: '' }));
        } else if (range === 'today') {
            const t = iso(today);
            setFilters(p => ({ ...p, quickRange: 'today', startDate: t, endDate: t }));
        } else if (range === 'weekly') {
            const w = new Date(today); w.setDate(w.getDate() - 7);
            setFilters(p => ({ ...p, quickRange: 'weekly', startDate: iso(w), endDate: iso(today) }));
        } else if (range === 'monthly') {
            const first = new Date(today.getFullYear(), today.getMonth(), 1);
            const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            setFilters(p => ({ ...p, quickRange: 'monthly', startDate: iso(first), endDate: iso(last) }));
        } else if (range === 'yearly') {
            const first = new Date(today.getFullYear(), 0, 1);
            const last = new Date(today.getFullYear(), 11, 31);
            setFilters(p => ({ ...p, quickRange: 'yearly', startDate: iso(first), endDate: iso(last) }));
        }
    };

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
    const uniqueSuppliers = useMemo(() =>
        [...new Set(deals.map(d => d.supplierName).filter(Boolean))].sort()
        , [deals]);

    const uniqueProducts = useMemo(() =>
        [...new Set(deals.map(d => d.productName).filter(Boolean))].sort()
        , [deals]);

    const uniqueBrands = useMemo(() => {
        const s = new Set();
        deals.forEach(d => {
            if (filters.product && d.productName !== filters.product) return;
            if (d.brand) s.add(d.brand);
        });
        return [...s].sort();
    }, [deals, filters.product]);

    /* ── Build enriched deals joining with receive records ── */
    const enrichedDeals = useMemo(() => {
        return deals.map(deal => {
            const cleanPId = String(deal.purchaseId || '').replace(/-/g, '');
            const relatedReceives = dealReceives.filter(r =>
                r.dealRefId === deal._id ||
                String(r.purchaseId || '').replace(/-/g, '') === cleanPId
            );
            const isTruck = deal.uom === 'Truck';
            const totalReceived = relatedReceives.reduce((sum, r) => {
                if (isTruck) {
                    return sum + (parseFloat(r.trucks) ||
                        (Array.isArray(r.truckNumbers) ? r.truckNumbers.length : 1));
                }
                return sum + (parseFloat(r.quantity || r.receiveQty) || 0);
            }, 0);
            const totalQty = parseFloat(deal.qty) || 0;
            const remaining = Math.max(0, totalQty - totalReceived);

            return {
                ...deal,
                _cleanPId: cleanPId,
                _relatedReceives: relatedReceives,
                _totalReceived: totalReceived,
                _totalQty: totalQty,
                _remaining: remaining,
                _isTruck: isTruck,
            };
        });
    }, [deals, dealReceives]);

    /* ── Status computation ── */
    const computeStatus = (d) => {
        if (d._totalQty > 0 && d._remaining <= 0.001) return 'Completed';
        if (d._totalQty > 0 && d._totalReceived > 0 && d._remaining > 0.001) return 'Not Completed';
        return 'Active';
    };

    /* ── Filtered Deals ── */
    const filteredDeals = useMemo(() => {
        return enrichedDeals.filter(d => {
            const dDate = (d.date || '').split('T')[0];
            if (filters.startDate && dDate && dDate < filters.startDate) return false;
            if (filters.endDate && dDate && dDate > filters.endDate) return false;
            if (filters.supplier && d.supplierName !== filters.supplier) return false;
            if (filters.product && d.productName !== filters.product) return false;
            if (filters.brand && d.brand !== filters.brand) return false;

            if (filters.status && filters.status !== 'All') {
                const s = computeStatus(d);
                if (s !== filters.status) return false;
            }

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const pId = (d._cleanPId || '').toLowerCase();
                const sup = (d.supplierName || '').toLowerCase();
                const prod = (d.productName || '').toLowerCase();
                const brand = (d.brand || '').toLowerCase();
                const exp = (d.exporter || '').toLowerCase();
                const truck = (d.truckNo || '').toLowerCase();

                if (!pId.includes(q) && !sup.includes(q) && !prod.includes(q) && !brand.includes(q) && !exp.includes(q) && !truck.includes(q))
                    return false;
            }

            return true;
        }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }, [enrichedDeals, filters, searchQuery]);

    /* ── Summary Stats ── */
    const stats = useMemo(() => {
        let totalQty = 0;
        let totalReceived = 0;
        let totalRemaining = 0;
        let totalAmount = 0;

        filteredDeals.forEach(d => {
            totalQty += d._totalQty;
            totalReceived += d._totalReceived;
            totalRemaining += d._remaining;
            totalAmount += (parseFloat(d.rate) || 0) * d._totalQty;
        });

        return {
            totalDeals: filteredDeals.length,
            totalQty,
            totalReceived,
            totalRemaining,
            totalAmount
        };
    }, [filteredDeals]);

    const hasActiveFilters = Boolean(
        filters.startDate || filters.endDate || (filters.quickRange && filters.quickRange !== 'all') ||
        filters.supplier || filters.product || filters.brand || (filters.status && filters.status !== 'All')
    );

    /* ── Status Badge matching Purchase Deal table ── */
    const StatusBadge = ({ record }) => {
        const s = computeStatus(record);
        if (s === 'Completed') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Completed
                </span>
            );
        } else if (s === 'Not Completed') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Not Completed
                </span>
            );
        } else {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active
                </span>
            );
        }
    };

    /* ── Print & Export ── */
    const handlePrint = () => {
        window.print();
    };

    const handleExportPdf = async () => {
        setShowReportFormatModal(false);
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        await generatePurchaseDealReportPDF(filteredDeals, filters, dateStr, reportType, cogs);
    };

    const handleExportExcel = () => {
        setShowReportFormatModal(false);
        try {
            const headers = ['SL', 'DATE', 'PUR. ID', 'SUPPLIER', 'PRODUCT', 'BRAND', 'PUR. RATE', 'PUR. TRUCK/KG', 'RECEIVE TRUCK/KG', 'REMAINING', 'STATUS'];
            const rows = filteredDeals.map((d, i) => [
                i + 1,
                formatDate(d.date),
                d._cleanPId,
                `"${(d.supplierName || '').replace(/"/g, '""')}"`,
                `"${(d.productName || '').replace(/"/g, '""')}"`,
                `"${(d.brand || '').replace(/"/g, '""')}"`,
                d.rate || 0,
                `${d._totalQty} ${d.uom || 'Truck'}`,
                `${d._totalReceived} ${d.uom || 'Truck'}`,
                `${d._remaining} ${d.uom || 'Truck'}`,
                computeStatus(d)
            ]);
            const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `Purchase_Deal_Report_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error('CSV Export Error:', e);
        }
    };

    /* ── Render Formal Table ── */
    const renderTable = (records) => {
        const totalPurQty = records.reduce((s, r) => s + r._totalQty, 0);
        const totalRecvQty = records.reduce((s, r) => s + r._totalReceived, 0);
        const totalRemQty = records.reduce((s, r) => s + r._remaining, 0);

        return (
            <div className="overflow-x-auto border border-gray-900 rounded-none">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-900 text-gray-900">
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2.5 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap w-10">SL</th>
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2.5 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">DATE</th>
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2.5 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">PUR. ID</th>
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2.5 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">SUPPLIER</th>
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2.5 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">PRODUCT</th>
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2.5 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">BRAND</th>
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2.5 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap">PUR. RATE</th>
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2.5 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">PUR. TRUCK / KG</th>
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2.5 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">RECEIVE TRUCK / KG</th>
                            <th className="border-r border-gray-900 px-2 sm:px-2.5 py-2.5 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">REMAINING</th>
                            <th className="px-2 sm:px-2.5 py-2.5 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">STATUS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-900">
                        {records.length > 0 ? (
                            records.map((d, idx) => {
                                const unitLabel = d._isTruck ? (d._totalQty === 1 ? 'Truck' : 'Trucks') : 'KG';
                                const recvUnitLabel = d._isTruck ? (d._totalReceived === 1 ? 'Truck' : 'Trucks') : 'KG';
                                const remUnitLabel = d._isTruck ? (d._remaining === 1 ? 'Truck' : 'Trucks') : 'KG';

                                return (
                                    <tr key={d._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center font-bold text-gray-900 text-xs whitespace-nowrap">{idx + 1}</td>
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center font-semibold text-gray-900 text-xs whitespace-nowrap">{formatDate(d.date)}</td>
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center font-bold text-blue-700 text-xs whitespace-nowrap">{d._cleanPId || '—'}</td>
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 font-bold text-gray-900 text-xs whitespace-nowrap">{d.supplierName || '—'}</td>
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 font-bold text-gray-900 text-xs whitespace-nowrap uppercase">{d.productName || '—'}</td>
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-gray-800 text-xs whitespace-nowrap font-medium">{d.brand || '—'}</td>
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-right font-black text-gray-900 text-xs whitespace-nowrap">
                                            ৳{Number(d.rate || 0).toLocaleString('en-IN')}/kg
                                        </td>
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100/70 text-blue-700">
                                                {d._totalQty} {unitLabel}
                                            </span>
                                        </td>
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100/70 text-green-700">
                                                {d._totalReceived} {recvUnitLabel}
                                            </span>
                                        </td>
                                        <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                                                {d._remaining} {remUnitLabel}
                                            </span>
                                        </td>
                                        <td className="px-2 sm:px-2.5 py-2 text-center whitespace-nowrap">
                                            <StatusBadge record={d} />
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={11} className="py-8 text-center text-gray-500 italic text-sm whitespace-nowrap">
                                    No purchase deal records found for the selected criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    {records.length > 0 && (
                        <tfoot className="bg-gray-100 border-t-2 border-gray-900 font-black text-gray-900 text-xs">
                            <tr>
                                <td colSpan={7} className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center uppercase tracking-wider font-black whitespace-nowrap">
                                    Grand Total ({records.length} Deals)
                                </td>
                                <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center font-black whitespace-nowrap text-blue-700">
                                    {fmtInt(totalPurQty)}
                                </td>
                                <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center font-black whitespace-nowrap text-green-700">
                                    {fmtInt(totalRecvQty)}
                                </td>
                                <td className="border-r border-gray-900 px-2 sm:px-2.5 py-2 text-center font-black whitespace-nowrap text-gray-700">
                                    {fmtInt(totalRemQty)}
                                </td>
                                <td className="px-2 sm:px-2.5 py-2 text-center text-gray-400">—</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        );
    };

    /* ── Render Deal Wise Detailed Report ── */
    const renderDealWiseReport = (records) => {
        if (!records || records.length === 0) {
            return (
                <div className="py-12 text-center text-gray-500 italic text-sm border border-gray-200 bg-gray-50 rounded-xl">
                    No purchase deal records found for the selected criteria.
                </div>
            );
        }

        return (
            <div className="space-y-6">
                {records.map((deal, dIdx) => {
                    const purUnit = deal._isTruck ? (deal._totalQty === 1 ? 'Truck' : 'Trucks') : 'KG';
                    const recvUnit = deal._isTruck ? (deal._totalReceived === 1 ? 'Truck' : 'Trucks') : 'KG';
                    const remUnit = deal._isTruck ? (deal._remaining === 1 ? 'Truck' : 'Trucks') : 'KG';
                    const receives = deal._relatedReceives || [];
                    const dealTotalNetBill = receives.reduce((sum, r) => sum + (parseFloat(r.netBill !== undefined && r.netBill !== '' ? r.netBill : r.totalBill) || 0), 0);

                    return (
                        <div key={deal._id || dIdx} className="border border-gray-900 overflow-hidden shadow-xs">
                            {/* Deal Master Info Table (Header on TOP, Value on BOTTOM) */}
                            <div className="overflow-x-auto border-b border-gray-900 bg-blue-50/20">
                                <table className="w-full border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-gray-100 border-b border-gray-900 text-gray-900 font-bold uppercase">
                                            <th className="border-r border-gray-900 px-2 py-2 text-center w-10">SL</th>
                                            <th className="border-r border-gray-900 px-2.5 py-2 text-center whitespace-nowrap">Date</th>
                                            <th className="border-r border-gray-900 px-2.5 py-2 text-center whitespace-nowrap">Pur. ID</th>
                                            <th className="border-r border-gray-900 px-2.5 py-2 text-left whitespace-nowrap">Supplier</th>
                                            <th className="border-r border-gray-900 px-2.5 py-2 text-left whitespace-nowrap">Product</th>
                                            <th className="border-r border-gray-900 px-2.5 py-2 text-left whitespace-nowrap">Brand</th>
                                            <th className="border-r border-gray-900 px-2.5 py-2 text-right whitespace-nowrap">Pur. Rate</th>
                                            <th className="border-r border-gray-900 px-2.5 py-2 text-center whitespace-nowrap">Pur. Truck / KG</th>
                                            <th className="border-r border-gray-900 px-2.5 py-2 text-center whitespace-nowrap">Receive Truck / KG</th>
                                            <th className="border-r border-gray-900 px-2.5 py-2 text-center whitespace-nowrap">Remaining</th>
                                            <th className="px-2.5 py-2 text-center whitespace-nowrap">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="bg-white text-gray-900 font-bold">
                                            <td className="border-r border-gray-900 px-2 py-2 text-center font-bold">#{dIdx + 1}</td>
                                            <td className="border-r border-gray-900 px-2.5 py-2 text-center font-semibold whitespace-nowrap">{formatDate(deal.date)}</td>
                                            <td className="border-r border-gray-900 px-2.5 py-2 text-center font-black text-blue-700 whitespace-nowrap">{deal._cleanPId}</td>
                                            <td className="border-r border-gray-900 px-2.5 py-2 text-left font-bold whitespace-nowrap">{deal.supplierName || '—'}</td>
                                            <td className="border-r border-gray-900 px-2.5 py-2 text-left font-bold uppercase whitespace-nowrap">{deal.productName || '—'}</td>
                                            <td className="border-r border-gray-900 px-2.5 py-2 text-left font-medium text-gray-700 whitespace-nowrap">{deal.brand || '—'}</td>
                                            <td className="border-r border-gray-900 px-2.5 py-2 text-right font-black whitespace-nowrap">৳{Number(deal.rate || 0).toLocaleString('en-IN')}/kg</td>
                                            <td className="border-r border-gray-900 px-2.5 py-2 text-center whitespace-nowrap">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                                                    {deal._totalQty} {purUnit}
                                                </span>
                                            </td>
                                            <td className="border-r border-gray-900 px-2.5 py-2 text-center whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                                    {deal._totalReceived} {recvUnit}
                                                </span>
                                            </td>
                                            <td className="border-r border-gray-900 px-2.5 py-2 text-center whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                                                    {deal._remaining} {remUnit}
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-2 text-center whitespace-nowrap">
                                                <StatusBadge record={deal} />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Sub-table Section Label */}
                            <div className="bg-gray-100/90 px-3 py-1.5 border-b border-gray-900 flex items-center justify-between text-[11px] font-black uppercase text-gray-700 tracking-wider">
                                <span>Receive Entries Breakdown ({receives.length} {receives.length === 1 ? 'Entry' : 'Entries'})</span>
                            </div>

                            {/* Nested Sub-table for Receives */}
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-gray-50/90 border-b border-gray-900 text-gray-800">
                                            <th className="border-r border-gray-900 px-2.5 py-2 text-center font-bold uppercase w-10">SL</th>
                                            <th className="border-r border-gray-900 px-2.5 py-2 text-center font-bold uppercase whitespace-nowrap">Receive Date</th>
                                            <th className="border-r border-gray-900 px-2.5 py-2 text-center font-bold uppercase whitespace-nowrap">LC No</th>
                                            <th className="border-r border-gray-900 px-2.5 py-2 text-center font-bold uppercase whitespace-nowrap">Invoice No</th>
                                            <th className="border-r border-gray-900 px-2.5 py-2 text-left font-bold uppercase whitespace-nowrap">Truck No / Vehicle</th>
                                            <th className="border-r border-gray-900 px-2.5 py-2 text-center font-bold uppercase whitespace-nowrap">Received Qty</th>
                                            <th className="border-r border-gray-900 px-2.5 py-2 text-right font-bold uppercase whitespace-nowrap">Net Bill</th>
                                            <th className="border-r border-gray-900 px-2.5 py-2 text-right font-bold uppercase whitespace-nowrap">Dollar Rate BDT</th>
                                            <th className="px-2.5 py-2 text-right font-bold uppercase whitespace-nowrap">Costing / KG</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-300">
                                        {receives.length > 0 ? (
                                            receives.map((r, rIdx) => {
                                                const rTrucks = parseFloat(r.trucks) || (Array.isArray(r.truckNumbers) && r.truckNumbers.length ? r.truckNumbers.length : 1);
                                                const rQty = deal._isTruck ? `${rTrucks} ${rTrucks === 1 ? 'Truck' : 'Trucks'}` : `${fmtInt(r.quantity || r.receiveQty || 0)} KG`;
                                                const truckStr = Array.isArray(r.truckNumbers) && r.truckNumbers.length > 0
                                                    ? r.truckNumbers.filter(Boolean).join(', ')
                                                    : (r.truckNo || '—');
                                                const rawLc = resolveLcNo(r, deal, cogs);
                                                const lcStr = formatLcLast6(rawLc);
                                                const rNetBill = parseFloat(r.netBill !== undefined && r.netBill !== '' ? r.netBill : r.totalBill) || 0;

                                                return (
                                                    <tr key={r._id || rIdx} className="hover:bg-blue-50/20 transition-colors">
                                                        <td className="border-r border-gray-900 px-2.5 py-2 text-center font-medium text-gray-500">{rIdx + 1}</td>
                                                        <td className="border-r border-gray-900 px-2.5 py-2 text-center font-medium text-gray-800 whitespace-nowrap">{formatDate(r.date)}</td>
                                                        <td className="border-r border-gray-900 px-2.5 py-2 text-center font-bold text-gray-900 whitespace-nowrap" title={rawLc ? `Full LC: ${rawLc}` : ''}>
                                                            {lcStr}
                                                        </td>
                                                        <td className="border-r border-gray-900 px-2.5 py-2 text-center font-bold text-blue-700 whitespace-nowrap">{r.invoiceNo || '—'}</td>
                                                        <td className="border-r border-gray-900 px-2.5 py-2 text-left font-medium text-gray-800">{truckStr}</td>
                                                        <td className="border-r border-gray-900 px-2.5 py-2 text-center font-black text-green-700 whitespace-nowrap">{rQty}</td>
                                                        <td className="border-r border-gray-900 px-2.5 py-2 text-right font-black text-gray-900 whitespace-nowrap">
                                                            {rNetBill > 0 ? `৳${Math.round(rNetBill).toLocaleString('en-IN')}` : '—'}
                                                        </td>
                                                        <td className="border-r border-gray-900 px-2.5 py-2 text-right font-bold text-gray-900 whitespace-nowrap">
                                                            {r.dollarRateBdt ? `৳${Number(r.dollarRateBdt).toFixed(2)}` : '—'}
                                                        </td>
                                                        <td className="px-2.5 py-2 text-right font-black text-gray-900 whitespace-nowrap">
                                                            {r.costingKg ? `৳${Number(r.costingKg).toFixed(2)}` : '—'}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={9} className="px-4 py-4 text-center text-gray-400 italic">
                                                    No receive records entered for this deal yet.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {receives.length > 0 && (
                                        <tfoot className="bg-gray-100/90 border-t border-gray-900 font-bold text-gray-900">
                                            <tr>
                                                <td colSpan={5} className="border-r border-gray-900 px-3 py-1.5 text-right uppercase tracking-wider text-[11px]">
                                                    Deal Receive Subtotal:
                                                </td>
                                                <td className="border-r border-gray-900 px-2.5 py-1.5 text-center font-black text-green-700 text-xs whitespace-nowrap">
                                                    {deal._totalReceived} {recvUnit}
                                                </td>
                                                <td className="border-r border-gray-900 px-2.5 py-1.5 text-right font-black text-gray-900 text-xs whitespace-nowrap">
                                                    {dealTotalNetBill > 0 ? `৳${Math.round(dealTotalNetBill).toLocaleString('en-IN')}` : '—'}
                                                </td>
                                                <td className="border-r border-gray-900 px-2.5 py-1.5 text-right text-gray-400 text-xs">—</td>
                                                <td className="px-2.5 py-1.5 text-right text-gray-400 text-xs">—</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (!isOpen || typeof document === 'undefined' || !document.body) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 pt-6 sm:p-4 lg:p-6 print:p-0 print:bg-white print:backdrop-none app-modal-overlay">
            <div className="bg-white w-full max-w-[96vw] 2xl:max-w-[1650px] max-h-[92vh] overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col print:max-h-none print:shadow-none print:rounded-none print:w-full print:h-auto">

                {/* ── Modal Header / Toolbar matching Stock Report exactly ── */}
                <div className="flex flex-row items-center justify-between px-3 sm:px-8 py-2.5 sm:py-4 border-b border-gray-100 print:hidden gap-1.5 sm:gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-shrink-0">
                        <div className="w-7 h-7 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-blue-50 rounded-lg sm:rounded-xl">
                            <BarChartIcon className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-blue-600" />
                        </div>
                        <h3 className="text-xs sm:text-lg lg:text-xl font-black text-gray-800 truncate leading-none">Purchase Deal Report</h3>
                    </div>

                    {/* Quick Search Bar */}
                    <div className="hidden md:flex relative flex-1 max-w-md mx-6 no-print">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Find Pur. ID, supplier, product or brand..."
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
                        {/* Report Type Select dropdown */}
                        <div className="relative group no-print">
                            <select
                                value={reportType}
                                onChange={(e) => setReportType(e.target.value)}
                                className="appearance-none bg-white border border-gray-200 text-gray-700 py-1.5 sm:py-2.5 pl-2.5 sm:pl-4 pr-6 sm:pr-10 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer hover:border-gray-300"
                            >
                                <option value="summary">Summary Report</option>
                                <option value="deal_wise">Deal Wise Report</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 sm:px-3 text-gray-400">
                                <svg className="fill-current h-3.5 w-3.5 sm:h-4 sm:w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                </svg>
                            </div>
                        </div>

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
                                title="Filter Deals"
                            >
                                <FunnelIcon className={`w-3.5 h-3.5 sm:w-5 sm:h-5 ${showFilterPanel || hasActiveFilters ? 'text-white' : 'text-gray-400'}`} />
                            </button>

                            {/* Floating Advance Filter Panel */}
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
                                                        { value: 'Active', label: 'Active' },
                                                        { value: 'Not Completed', label: 'Not Completed' },
                                                        { value: 'Completed', label: 'Completed' }
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
                                                            <button onClick={() => setFilters({ ...filters, product: '', brand: '' })} className="text-gray-400 hover:text-gray-600">
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
                                                                onClick={() => { setFilters({ ...filters, product: '', brand: '' }); setFilterDropdownOpen({ ...filterDropdownOpen, product: false }); }}
                                                                className="w-full px-3 py-1.5 text-left text-xs hover:bg-blue-50 text-gray-500"
                                                            >
                                                                All Products
                                                            </button>
                                                            {filtered.map(p => (
                                                                <button
                                                                    key={p}
                                                                    type="button"
                                                                    onClick={() => { setFilters({ ...filters, product: p, brand: '' }); setFilterDropdownOpen({ ...filterDropdownOpen, product: false }); }}
                                                                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-blue-50 font-semibold text-gray-800"
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

                        {/* Print Button (blue square matching screenshot) */}
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

                {/* ── Printable Content Card matching Stock Report exactly ── */}
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
                                    {reportType === 'deal_wise' ? 'PURCHASE DEAL WISE REPORT' : 'PURCHASE DEAL REPORT'}
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

                        {/* Data Table / Deal Wise View */}
                        <div className="pt-2">
                            {reportType === 'deal_wise' ? renderDealWiseReport(filteredDeals) : renderTable(filteredDeals)}
                        </div>

                        {/* Summary Metric Cards matching Stock Report style below table */}
                        <div className="space-y-4 pt-6 px-2">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 print:grid-cols-4">
                                {/* Card 1: TOTAL DEALS */}
                                <div className="border border-gray-200 rounded-2xl bg-gray-50 shadow-sm print:border-gray-200 p-4 flex flex-col justify-between items-center text-center gap-2 min-h-[140px] sm:min-h-[150px] w-full">
                                    <div className="flex flex-col items-center gap-1 w-full">
                                        <div className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Deals</div>
                                        <div className="text-xs sm:text-sm font-bold text-gray-700 w-full break-words">
                                            RECORDS: {stats.totalDeals}
                                        </div>
                                    </div>
                                    <div className="w-full border-t border-gray-200"></div>
                                    <div className="flex flex-col items-center justify-center w-full">
                                        <div className="text-lg sm:text-xl font-black text-gray-900 w-full break-words">
                                            {stats.totalDeals} Deals
                                        </div>
                                    </div>
                                </div>

                                {/* Card 2: TOTAL PUR. QTY */}
                                <div className="border border-gray-200 rounded-2xl bg-gray-50 shadow-sm print:border-gray-200 p-4 flex flex-col justify-between items-center text-center gap-2 min-h-[140px] sm:min-h-[150px] w-full">
                                    <div className="flex flex-col items-center gap-1 w-full">
                                        <div className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Pur. Qty</div>
                                        <div className="text-xs sm:text-sm font-bold text-gray-700 w-full break-words">
                                            PURCHASED
                                        </div>
                                    </div>
                                    <div className="w-full border-t border-gray-200"></div>
                                    <div className="flex flex-col items-center justify-center w-full">
                                        <div className="text-lg sm:text-xl font-black text-blue-700 w-full break-words">
                                            {fmtInt(stats.totalQty)}
                                        </div>
                                    </div>
                                </div>

                                {/* Card 3: TOTAL RECEIVED */}
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
                                            {fmtInt(stats.totalReceived)}
                                        </div>
                                    </div>
                                </div>

                                {/* Card 4: TOTAL REMAINING */}
                                <div className="border border-gray-200 rounded-2xl bg-gray-50 shadow-sm print:border-gray-200 p-4 flex flex-col justify-between items-center text-center gap-2 min-h-[140px] sm:min-h-[150px] w-full">
                                    <div className="flex flex-col items-center gap-1 w-full">
                                        <div className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Remaining</div>
                                        <div className="text-xs sm:text-sm font-bold text-gray-700 w-full break-words">
                                            REMAINING QTY
                                        </div>
                                    </div>
                                    <div className="w-full border-t border-gray-200"></div>
                                    <div className="flex flex-col items-center justify-center w-full">
                                        <div className="text-lg sm:text-xl font-black text-rose-600 w-full break-words">
                                            {fmtInt(stats.totalRemaining)}
                                        </div>
                                    </div>
                                </div>
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
                    onExportPdf={handleExportPdf}
                    onExportExcel={handleExportExcel}
                />
            )}
        </div>,
        document.body
    );
};

export default PurchaseDealReport;
