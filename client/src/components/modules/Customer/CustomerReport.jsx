import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XIcon, BarChartIcon, PrinterIcon, SearchIcon, FunnelIcon } from '../../Icons';
import { formatDate, computeCustomerBalance, getLocalDateString, getIsoDateString } from '../../../utils/helpers';
import { generateCustomerReportPDF } from '../../../utils/pdfGenerator';
import CustomDatePicker from '../../shared/CustomDatePicker';

const CustomerReport = ({
    isOpen,
    onClose,
    customers = [],
    purchasesList = [],
    salesRecords = [],
    purchaseReceivesList = [],
    stockList = [],
    asOfDate = ''
}) => {
    if (!isOpen) return null;

    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('General Customer');
    const [reportDate, setReportDate] = useState(asOfDate || '');
    const [showFilterCard, setShowFilterCard] = useState(false);
    const filterButtonRef = useRef(null);
    const filterPanelRef = useRef(null);

    useEffect(() => {
        setReportDate(asOfDate || '');
    }, [asOfDate]);

    // Click outside listener for filter card
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showFilterCard && filterPanelRef.current && !filterPanelRef.current.contains(e.target) && !filterButtonRef.current?.contains(e.target)) {
                setShowFilterCard(false);
            }
        };
        if (showFilterCard) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showFilterCard]);

    // --- Calculate running balance per customer from all history (sales, payments, payouts, purchases) ---
    const computeDue = (customer) => {
        return computeCustomerBalance(customer, { salesRecords, purchasesList, purchaseReceivesList, stockList, asOfDate: reportDate });
    };

    const getLastTransDay = (customer) => {
        const targetCutoff = reportDate ? getIsoDateString(reportDate) : null;
        const payments = (customer.paymentHistory || []).filter(p => {
            if ((p.status || '').toLowerCase() === 'requested') return false;
            if (targetCutoff) {
                const pDate = getIsoDateString(p.date);
                if (pDate && pDate >= targetCutoff) return false;
            }
            return true;
        });

        if (payments.length === 0) return '-';
        
        const latestPayment = payments.reduce((latest, current) => {
            return new Date(current.date) > new Date(latest.date) ? current : latest;
        }, payments[0]);
    
        if (!latestPayment || !latestPayment.date) return '-';
    
        const lastDate = new Date(latestPayment.date);
        const today = new Date();
        lastDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        const diffTime = Math.abs(today - lastDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return '1 day ago';
        return `${diffDays} days ago`;
    };

    const setQuickReportDate = (type) => {
        if (type === 'today') {
            setReportDate(getLocalDateString(new Date()));
        } else if (type === 'yesterday') {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            setReportDate(getLocalDateString(d));
        } else if (type === 'lastMonthEnd') {
            const d = new Date();
            d.setDate(0);
            setReportDate(getLocalDateString(d));
        } else if (type === 'clear') {
            setReportDate('');
        }
    };

    const filtered = customers.filter(c => {
        const matchType = typeFilter === 'All Customer' || (c.customerType || 'General Customer') === typeFilter;
        const q = searchQuery.toLowerCase();
        const matchSearch = !q ||
            (c.customerId || '').toLowerCase().includes(q) ||
            (c.companyName || '').toLowerCase().includes(q) ||
            (c.customerName || '').toLowerCase().includes(q) ||
            (c.phone || '').toLowerCase().includes(q);
        return matchType && matchSearch;
    }).sort((a, b) => {
        const nameA = (a.companyName || a.customerName || '').trim().toLowerCase();
        const nameB = (b.companyName || b.customerName || '').trim().toLowerCase();
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });

    const grandTotalDue = filtered.reduce((s, c) => s + computeDue(c), 0);
    // Only show customers with positive or negative (advance/credit) balances in alphabetical order — exclude zero
    const displayCustomers = filtered.filter(c => Math.abs(computeDue(c)) > 0.01);

    const handlePrint = () => {
        generateCustomerReportPDF(
            filtered,
            typeFilter,
            grandTotalDue,
            reportDate ? formatDate(reportDate) : formatDate(getLocalDateString(new Date())),
            purchasesList,
            salesRecords,
            purchaseReceivesList,
            reportDate,
            stockList
        );
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 print:p-0 print:bg-white print:backdrop-none app-modal-overlay">
            <div className="bg-white w-full max-w-5xl max-h-[85vh] sm:max-h-[92vh] rounded-3xl shadow-2xl flex flex-col print:max-h-none print:shadow-none print:rounded-none print:w-full print:h-auto overflow-hidden">

                {/* Modal Header/Toolbar (Hidden on Print) */}
                <div className="flex flex-row items-center justify-between px-3 sm:px-8 py-2.5 sm:py-4 border-b border-gray-100 print:hidden gap-1.5 sm:gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-shrink-0">
                        <div className="w-7 h-7 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-blue-50 rounded-lg sm:rounded-xl">
                            <BarChartIcon className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-xs sm:text-lg lg:text-xl font-black text-gray-800 truncate leading-none">Customer Report</h3>
                            <div className="text-[9px] sm:text-[11px] font-bold text-gray-400 mt-0.5 sm:mt-1">
                                {reportDate ? `As of ${formatDate(reportDate)}` : 'Live balances'}
                            </div>
                        </div>
                    </div>

                    {/* Quick Search Bar */}
                    <div className="hidden md:flex relative flex-1 max-w-sm mx-4 no-print">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search customers..."
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

                    <div className="flex items-center justify-end gap-1 sm:gap-3 flex-shrink-0">
                        <div className="relative group no-print">
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="appearance-none bg-white border border-gray-200 text-gray-700 py-1.5 sm:py-2.5 pl-2.5 sm:pl-4 pr-6 sm:pr-10 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer hover:border-gray-300"
                            >
                                <option value="All Customer">All Customer</option>
                                <option value="General Customer">General Customer</option>
                                <option value="Party Customer">Party Customer</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 sm:px-3 text-gray-400">
                                <svg className="fill-current h-3.5 w-3.5 sm:h-4 sm:w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                </svg>
                            </div>
                        </div>

                        <div className="relative flex items-center">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterCard(!showFilterCard)}
                                className={`w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-xl transition-all border ${showFilterCard || reportDate
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30'
                                    }`}
                                title="Advance Filter"
                            >
                                <FunnelIcon className={`w-3.5 h-3.5 sm:w-5 sm:h-5 ${showFilterCard || reportDate ? 'text-white' : 'text-gray-400'}`} />
                            </button>

                            {/* Floating Filter Panel */}
                            {showFilterCard && (
                                <>
                                    {/* Backdrop for mobile */}
                                    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[2005] md:hidden" onClick={() => setShowFilterCard(false)} />
                                    <div ref={filterPanelRef} className="fixed inset-x-4 top-24 md:absolute md:top-full md:left-auto md:right-0 md:mt-2 w-auto md:w-[22rem] bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[2010] p-4 flex flex-col mb-4 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 flex-shrink-0">
                                            <h4 className="font-bold text-gray-900 text-sm">Advance Filter</h4>
                                            <div className="flex items-center gap-2">
                                                {reportDate && (
                                                    <button
                                                        onClick={() => setQuickReportDate('clear')}
                                                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                                                    >
                                                        Reset
                                                    </button>
                                                )}
                                                <button onClick={() => setShowFilterCard(false)} className="text-gray-400 hover:text-gray-600 md:hidden">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                                                    Balance As Of Date
                                                </label>
                                                <div className="flex flex-wrap gap-1 mb-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setQuickReportDate('today')}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                                                            reportDate === getLocalDateString(new Date())
                                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                                        }`}
                                                    >
                                                        Today
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setQuickReportDate('yesterday')}
                                                        className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                                                    >
                                                        Yesterday
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setQuickReportDate('lastMonthEnd')}
                                                        className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                                                    >
                                                        Last Month End
                                                    </button>
                                                </div>
                                                <CustomDatePicker
                                                    value={reportDate || ''}
                                                    onChange={(e) => setReportDate(e.target.value)}
                                                    placeholder="Select Date"
                                                    compact
                                                />
                                            </div>

                                            <button
                                                onClick={() => setShowFilterCard(false)}
                                                className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all mt-2 flex-shrink-0 active:scale-[0.98]"
                                            >
                                                APPLY FILTERS
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            onClick={handlePrint}
                            className="w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg sm:rounded-xl shadow-lg shadow-blue-500/30 transition-all no-print flex-shrink-0"
                            title="Print"
                        >
                            <PrinterIcon className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                        </button>
                        <button
                            onClick={onClose}
                            className="w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg sm:rounded-xl transition-colors no-print flex-shrink-0"
                            title="Close"
                        >
                            <XIcon className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Mobile Search Bar (Only shown on small screens below md) */}
                <div className="md:hidden px-3 py-2 border-b border-gray-100 print:hidden bg-gray-50/50">
                    <div className="relative w-full">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search customers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600"
                            >
                                <XIcon className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Printable Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-12 print:p-4 print:overflow-visible bg-white">
                    <div className="max-w-[1000px] mx-auto space-y-6 sm:space-y-8">

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
                                <h2 className="text-xs sm:text-sm font-bold tracking-wider uppercase">CUSTOMER REPORT</h2>
                            </div>
                        </div>

                        {/* Meta row */}
                        <div className="flex justify-between items-end text-[14px] text-gray-800 pt-6 px-2">
                            <div className="flex flex-col gap-1">
                                {typeFilter !== 'All Customer' && (
                                    <div className="flex">
                                        <span className="font-bold text-gray-900 w-32">Customer Type:</span>
                                        <span className="text-blue-700 font-extrabold">{typeFilter}</span>
                                    </div>
                                )}
                                {reportDate ? (
                                    <div className="flex">
                                        <span className="font-bold text-gray-900 w-32">Balance As Of:</span>
                                        <span className="text-blue-700 font-extrabold">{formatDate(reportDate)}</span>
                                    </div>
                                ) : (
                                    <div className="flex">
                                        <span className="font-bold text-gray-900 w-32">Balance Type:</span>
                                        <span className="text-emerald-700 font-extrabold">Live Current Balance</span>
                                    </div>
                                )}
                                <div className="flex">
                                    <span className="font-bold text-gray-900 w-32">Total Records:</span>
                                    <span className="text-gray-900">{filtered.length}</span>
                                </div>
                            </div>
                            <div className="font-bold">
                                <span className="text-gray-900">Printed on: </span>
                                <span className="text-gray-900">{formatDate(getLocalDateString(new Date()))}</span>
                            </div>
                        </div>

                        {/* Desktop / Print Table */}
                        <div className="hidden md:block print:block overflow-x-auto border border-gray-900">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-900">
                                        <th className="border-r border-gray-900 px-2 py-2 text-center text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[5%]">SL</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-left text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[15%]">ID</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-left text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[40%]">Company</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-center text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[20%]">Last Trans. Day</th>
                                        <th className="px-2 py-2 text-right text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[20%]">Total Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-900">
                                    {displayCustomers.length > 0 ? (
                                        displayCustomers.map((c, idx) => {
                                            const due = computeDue(c);
                                            const isNegative = due < 0;
                                            return (
                                                <tr key={c._id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                                                    <td className="border-r border-gray-200 px-2 py-2 text-[13px] text-gray-900 text-center">{idx + 1}</td>
                                                    <td className="border-r border-gray-200 px-2 py-2 text-[13px] font-bold text-gray-700">{c.customerId || '-'}</td>
                                                    <td className="border-r border-gray-200 px-2 py-2 text-[13px] text-gray-900">{c.companyName || c.customerName || '-'}</td>
                                                    <td className="border-r border-gray-200 px-2 py-2 text-[13px] font-medium text-gray-700 text-center">{getLastTransDay(c)}</td>
                                                    <td className={`px-2 py-2 text-[14px] text-right font-black ${isNegative ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {isNegative
                                                            ? `৳(-${Math.round(Math.abs(due)).toLocaleString('en-IN')})`
                                                            : `৳${Math.round(due).toLocaleString('en-IN')}`
                                                        }
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="px-4 py-8 text-center text-gray-500 italic text-[14px]">No customers found.</td>
                                        </tr>
                                    )}
                                </tbody>
                                {displayCustomers.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-100 border-t-2 border-gray-900">
                                            <td colSpan="4" className="px-2 py-2 text-[14px] font-black text-gray-900 text-right uppercase tracking-wider border-r border-gray-900">Grand Total Balance</td>
                                            <td className={`px-2 py-2 text-[14px] text-right font-black ${grandTotalDue < 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                {grandTotalDue < 0
                                                    ? `৳(-${Math.round(Math.abs(grandTotalDue)).toLocaleString('en-IN')})`
                                                    : `৳${Math.round(grandTotalDue).toLocaleString('en-IN')}`
                                                }
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden print:hidden space-y-3">
                            {filtered.length > 0 ? (
                                filtered.map((c, idx) => {
                                    const due = computeDue(c);
                                    return (
                                        <div key={c._id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                            <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{c.customerId || '—'}</span>
                                                    <h4 className="font-black text-gray-900 text-sm leading-tight">{c.companyName || c.customerName || '-'}</h4>
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">#{idx + 1}</span>
                                            </div>
                                            <div className="px-4 py-3 flex justify-between items-center">
                                                <div>
                                                    <p className="text-sm text-gray-700 font-medium">{c.customerName || '-'}</p>
                                                    <p className="text-xs text-gray-500">{c.phone || '-'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Due</p>
                                                    <p className={`text-lg font-black ${due > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        ৳{Math.round(due).toLocaleString('en-IN')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-12 px-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                    <p className="text-gray-500 italic">No customers found.</p>
                                </div>
                            )}

                            {filtered.length > 0 && (
                                <div className="mt-6 p-5 bg-gray-900 rounded-2xl shadow-xl">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 text-center">Grand Total</h4>
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Net Balance</p>
                                        <p className={`text-3xl font-black ${grandTotalDue < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {grandTotalDue < 0
                                                ? `৳(-${Math.round(Math.abs(grandTotalDue)).toLocaleString('en-IN')})`
                                                : `৳${Math.round(grandTotalDue).toLocaleString('en-IN')}`
                                            }
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 px-2 print:grid">
                            <div className="border border-gray-200 p-4 sm:p-5 rounded-2xl bg-gray-50 shadow-sm">
                                <div className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Total Customers</div>
                                <div className="text-2xl sm:text-3xl font-black text-gray-900">{filtered.length}</div>
                            </div>
                            <div className="border border-gray-200 p-4 sm:p-5 rounded-2xl bg-gray-50 shadow-sm">
                                <div className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Customers with Due</div>
                                <div className="text-2xl sm:text-3xl font-black text-rose-600">
                                    {filtered.filter(c => computeDue(c) > 0).length}
                                </div>
                            </div>
                            <div className="border border-gray-200 p-4 sm:p-5 rounded-2xl bg-white shadow-sm">
                                <div className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mb-2 ${grandTotalDue < 0 ? 'text-emerald-500' : 'text-rose-500'}`}>Grand Total Balance</div>
                                <div className={`text-xl sm:text-2xl font-black ${grandTotalDue < 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {grandTotalDue < 0
                                        ? `৳(-${Math.round(Math.abs(grandTotalDue)).toLocaleString('en-IN')})`
                                        : `৳${Math.round(grandTotalDue).toLocaleString('en-IN')}`
                                    }
                                </div>
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 pt-16 sm:pt-24 px-4 pb-12 print:grid-cols-3 print:pt-24 print:gap-8">
                            <div className="text-center sm:text-left"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Prepared By</div></div>
                            <div className="text-center"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase text-center">Verified By</div></div>
                            <div className="text-center sm:text-right"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Authorized Signature</div></div>
                        </div>

                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CustomerReport;
