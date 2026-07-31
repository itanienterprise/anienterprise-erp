import React, { useState, useRef, useEffect } from 'react';
import { XIcon, BarChartIcon, PrinterIcon, FunnelIcon, ChevronDownIcon, CheckIcon, SearchIcon } from '../../Icons';
import { formatDate } from '../../../utils/helpers';
import { generatePayToCustomerReportPDF } from '../../../utils/pdfGenerator';
import CustomDatePicker from '../../shared/CustomDatePicker';

const PayToCustomerReport = ({ isOpen, onClose, payments = [] }) => {
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(null);
    const [filterSearchInputs, setFilterSearchInputs] = useState({
        customer: '',
        bankName: '',
        branch: ''
    });

    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        method: '',
        customer: '',
        bankName: '',
        branch: ''
    });

    const filterPanelRef = useRef(null);
    const filterButtonRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterPanelRef.current && !filterPanelRef.current.contains(event.target) &&
                filterButtonRef.current && !filterButtonRef.current.contains(event.target)) {
                if (!event.target.closest('[data-filter-dropdown]')) {
                    setShowFilterPanel(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!isOpen) return null;

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const resetFilters = () => {
        setFilters({
            startDate: '',
            endDate: '',
            method: '',
            customer: '',
            bankName: '',
            branch: ''
        });
        setFilterSearchInputs({
            customer: '',
            bankName: '',
            branch: ''
        });
    };

    const uniqueMethods = [...new Set(payments.map(p => p.method).filter(Boolean))];
    const uniqueCustomers = [...new Set(payments.map(p => p.companyName || p.customerName).filter(Boolean))].sort();
    const uniqueBanks = [...new Set(payments.map(p => p.method === 'Cash' ? p.receiveBy : p.bankName).filter(Boolean))].sort();
    const uniqueBranches = [...new Set(payments.map(p => p.method === 'Cash' ? p.place : p.branch).filter(Boolean))].sort();

    const filteredPayments = payments.filter(payment => {
        if (filters.startDate || filters.endDate) {
            const payDate = new Date(payment.date);
            payDate.setHours(0, 0, 0, 0);

            if (filters.startDate) {
                const start = new Date(filters.startDate);
                start.setHours(0, 0, 0, 0);
                if (payDate < start) return false;
            }
            if (filters.endDate) {
                const end = new Date(filters.endDate);
                end.setHours(0, 0, 0, 0);
                if (payDate > end) return false;
            }
        }

        if (filters.method && payment.method !== filters.method) return false;
        if (filters.customer && (payment.companyName || payment.customerName) !== filters.customer) return false;

        if (filters.bankName) {
            const provider = payment.method === 'Cash' ? payment.receiveBy : payment.bankName;
            if (provider !== filters.bankName) return false;
        }

        if (filters.branch) {
            const location = payment.method === 'Cash' ? payment.place : payment.branch;
            if (location !== filters.branch) return false;
        }

        return true;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    const grandTotal = filteredPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    const handlePrint = () => {
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        generatePayToCustomerReportPDF(filteredPayments, filters, dateStr);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 print:p-0 print:bg-white print:backdrop-none app-modal-overlay">
            <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col print:max-h-none print:shadow-none print:rounded-none print:w-full print:h-auto overflow-hidden">

                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex justify-between items-center print:hidden flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-rose-400">
                            <BarChartIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Pay To Customer Report</h2>
                            <p className="text-xs text-gray-400">View and print customized payout summary reports</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Filter Toggle */}
                        <div className="relative">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border ${showFilterPanel
                                    ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/30'
                                    : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                                    }`}
                            >
                                <FunnelIcon className="w-4 h-4" />
                                <span>Filter</span>
                                {(filters.startDate || filters.endDate || filters.method || filters.customer || filters.bankName || filters.branch) && (
                                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                                )}
                            </button>

                            {/* Dropdown Filter Panel */}
                            {showFilterPanel && (
                                <div
                                    ref={filterPanelRef}
                                    className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 text-gray-800 z-50 animate-in fade-in zoom-in-95 duration-150"
                                >
                                    <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                                            <FunnelIcon className="w-3.5 h-3.5" /> Filter Report
                                        </span>
                                        <button
                                            onClick={resetFilters}
                                            className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                                        >
                                            Reset All
                                        </button>
                                    </div>

                                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                                        {/* Date Range */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Start Date</label>
                                                <CustomDatePicker
                                                    selected={filters.startDate}
                                                    onChange={(date) => handleFilterChange('startDate', date)}
                                                    placeholder="Select start date"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-gray-500 mb-1">End Date</label>
                                                <CustomDatePicker
                                                    selected={filters.endDate}
                                                    onChange={(date) => handleFilterChange('endDate', date)}
                                                    placeholder="Select end date"
                                                />
                                            </div>
                                        </div>

                                        {/* Payment Method */}
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Payment Method</label>
                                            <select
                                                value={filters.method}
                                                onChange={(e) => handleFilterChange('method', e.target.value)}
                                                className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium"
                                            >
                                                <option value="">All Methods</option>
                                                {uniqueMethods.map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Party / Customer */}
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Customer / Party Name</label>
                                            <select
                                                value={filters.customer}
                                                onChange={(e) => handleFilterChange('customer', e.target.value)}
                                                className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium"
                                            >
                                                <option value="">All Customers</option>
                                                {uniqueCustomers.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Bank / Provider */}
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Bank / Paid By</label>
                                            <select
                                                value={filters.bankName}
                                                onChange={(e) => handleFilterChange('bankName', e.target.value)}
                                                className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium"
                                            >
                                                <option value="">All Banks / Paid By</option>
                                                {uniqueBanks.map(b => (
                                                    <option key={b} value={b}>{b}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Branch / Place */}
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Branch / Place</label>
                                            <select
                                                value={filters.branch}
                                                onChange={(e) => handleFilterChange('branch', e.target.value)}
                                                className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium"
                                            >
                                                <option value="">All Branches / Places</option>
                                                {uniqueBranches.map(b => (
                                                    <option key={b} value={b}>{b}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Export PDF Button */}
                        <button
                            onClick={handlePrint}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-rose-500/20"
                        >
                            <PrinterIcon className="w-4 h-4" />
                            <span>Export PDF</span>
                        </button>

                        {/* Close Modal Button */}
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-300 hover:text-white transition-colors ml-2"
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Printable Content Area */}
                <div className="p-8 overflow-y-auto flex-1 print:p-0 print:overflow-visible">

                    {/* Company Header */}
                    <div className="text-center mb-8 border-b border-gray-200 pb-6 print:mb-4 print:pb-4">
                        <h1 className="text-2xl font-black text-gray-900 tracking-wide uppercase">ANI ENTERPRISE</h1>
                        <p className="text-xs text-gray-600 mt-1">766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh</p>
                        <p className="text-xs text-gray-500">Tel: +8802588813057 | Email: anienterprise051@gmail.com</p>
                        <div className="inline-block mt-3 px-4 py-1.5 bg-rose-50 border border-rose-200 rounded-full text-rose-700 text-xs font-bold uppercase tracking-wider">
                            Pay To Customer Report
                        </div>
                    </div>

                    {/* Report Meta Info */}
                    <div className="flex justify-between items-center text-xs text-gray-600 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div>
                            <span className="font-semibold text-gray-800">Total Payout Records:</span> {filteredPayments.length}
                        </div>
                        <div>
                            <span className="font-semibold text-gray-800">Date Generated:</span> {formatDate(new Date().toISOString().split('T')[0])}
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-gray-100 text-gray-700 uppercase font-bold text-[11px] border-b border-gray-200">
                                <tr>
                                    <th className="py-3 px-3 text-center">SL</th>
                                    <th className="py-3 px-3">Date</th>
                                    <th className="py-3 px-3">Party Name</th>
                                    <th className="py-3 px-3">Location</th>
                                    <th className="py-3 px-3">Method</th>
                                    <th className="py-3 px-3">Bank / Paid By</th>
                                    <th className="py-3 px-3">Branch</th>
                                    <th className="py-3 px-3">Account No</th>
                                    <th className="py-3 px-3 text-right">Amount (৳)</th>
                                    <th className="py-3 px-3">Remark</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {filteredPayments.length > 0 ? (
                                    filteredPayments.map((p, idx) => (
                                        <tr key={p.id || idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-2.5 px-3 text-center font-medium text-gray-500">{idx + 1}</td>
                                            <td className="py-2.5 px-3 font-semibold text-gray-800 whitespace-nowrap">{formatDate(p.date)}</td>
                                            <td className="py-2.5 px-3 font-bold text-gray-900">{p.companyName || p.customerName || '-'}</td>
                                            <td className="py-2.5 px-3 text-gray-600">{p.place || p.customerAddress || '-'}</td>
                                            <td className="py-2.5 px-3 font-medium text-rose-700">{p.method || '-'}</td>
                                            <td className="py-2.5 px-3 text-gray-700">{p.method === 'Cash' ? (p.receiveBy || '-') : (p.bankName || '-')}</td>
                                            <td className="py-2.5 px-3 text-gray-600">{(p.branch || '').trim() || '-'}</td>
                                            <td className="py-2.5 px-3 text-gray-600 font-mono">{p.accountNo || '-'}</td>
                                            <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                                                ৳{(parseFloat(p.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-2.5 px-3 text-gray-500">{p.reference || '-'}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="10" className="py-8 text-center text-gray-400 font-medium">
                                            No payout records found matching the selected criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            {filteredPayments.length > 0 && (
                                <tfoot className="bg-rose-50/50 border-t-2 border-rose-200 font-bold text-gray-900">
                                    <tr>
                                        <td colSpan="8" className="py-3 px-3 text-right uppercase tracking-wider text-xs">Grand Total:</td>
                                        <td className="py-3 px-3 text-right text-rose-700 text-sm">
                                            ৳{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    {/* Report Footer / Signature Lines */}
                    <div className="mt-16 pt-8 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500 print:mt-12">
                        <div className="text-center">
                            <div className="w-36 border-b border-gray-400 mb-1"></div>
                            <span>Prepared By</span>
                        </div>
                        <div className="text-center">
                            <div className="w-36 border-b border-gray-400 mb-1"></div>
                            <span>Verified By</span>
                        </div>
                        <div className="text-center">
                            <div className="w-36 border-b border-gray-400 mb-1"></div>
                            <span>Authorized Signature</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default PayToCustomerReport;
