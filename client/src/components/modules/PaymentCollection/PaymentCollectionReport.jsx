import React, { useState, useRef, useEffect } from 'react';
import { XIcon, BarChartIcon, PrinterIcon, FunnelIcon, ChevronDownIcon, CheckIcon, SearchIcon } from '../../Icons';
import { formatDate } from '../../../utils/helpers';
import { generatePaymentCollectionReportPDF } from '../../../utils/pdfGenerator';
import CustomDatePicker from '../../shared/CustomDatePicker';

const PaymentCollectionReport = ({ isOpen, onClose, payments = [] }) => {
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

    // Handle clicking outside to close filter panel
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

    // Derive unique values for filters from the payments prop
    const uniqueMethods = [...new Set(payments.map(p => p.method).filter(Boolean))];
    const uniqueCustomers = [...new Set(payments.map(p => p.companyName || p.customerName).filter(Boolean))].sort();
    const uniqueBanks = [...new Set(payments.map(p => p.method === 'Cash' ? p.receiveBy : p.bankName).filter(Boolean))].sort();
    const uniqueBranches = [...new Set(payments.map(p => p.method === 'Cash' ? p.place : p.branch).filter(Boolean))].sort();

    const filteredPayments = payments.filter(payment => {
        // Date range filter
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

        // Method filter
        if (filters.method && payment.method !== filters.method) return false;

        // Customer filter
        if (filters.customer && (payment.companyName || payment.customerName) !== filters.customer) return false;

        // Bank Name / Provider filter
        if (filters.bankName) {
            const provider = payment.method === 'Cash' ? payment.receiveBy : payment.bankName;
            if (provider !== filters.bankName) return false;
        }

        // Branch filter
        if (filters.branch) {
            const location = payment.method === 'Cash' ? payment.place : payment.branch;
            if (location !== filters.branch) return false;
        }

        return true;
    });

    const grandTotal = filteredPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    const handlePrint = () => {
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        generatePaymentCollectionReportPDF(filteredPayments, filters, dateStr);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 print:p-0 print:bg-white print:backdrop-none">
            <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col print:max-h-none print:shadow-none print:rounded-none print:w-full print:h-auto overflow-hidden">

                {/* Modal Header — hidden on print */}
                <div className="flex flex-row items-center justify-between px-4 sm:px-8 py-4 border-b border-gray-100 print:hidden gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-blue-50 rounded-lg sm:rounded-xl">
                            <BarChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                        </div>
                        <h3 className="text-base sm:text-lg font-black text-gray-800 truncate leading-none">Payment Collection Report</h3>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0 relative">
                        {/* Filter Toggle Button */}
                        <button
                            ref={filterButtonRef}
                            onClick={() => setShowFilterPanel(!showFilterPanel)}
                            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all border ${showFilterPanel || Object.values(filters).some(v => v !== '') ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'} h-[40px]`}
                        >
                            <FunnelIcon className={`w-4 h-4 ${(showFilterPanel || Object.values(filters).some(v => v !== '')) ? 'text-white' : 'text-gray-400'}`} />
                            <span className="text-sm font-bold hidden sm:block">Filter</span>
                        </button>

                        <button
                            onClick={handlePrint}
                            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg sm:rounded-xl shadow-lg shadow-blue-500/30 transition-all no-print"
                        >
                            <PrinterIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </button>
                        <button
                            onClick={onClose}
                            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg sm:rounded-xl transition-colors no-print"
                        >
                            <XIcon className="w-4 h-4 sm:w-6 sm:h-6 text-gray-500" />
                        </button>

                        {/* Advanced Filter Panel (Inside Modal) */}
                        {showFilterPanel && (
                            <div ref={filterPanelRef} className="absolute top-[50px] right-0 w-[320px] sm:w-[500px] md:w-[600px] bg-white border border-gray-200 rounded-2xl shadow-2xl z-[10000] p-5 opacity-100 scale-100 transform origin-top-right transition-all animate-in fade-in zoom-in duration-200">
                                <div className="flex items-center justify-between mb-5 border-b border-gray-100 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                            <FunnelIcon className="w-4 h-4" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-[15px]">Advanced Filter</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={resetFilters}
                                            className="text-[12px] font-bold text-gray-500 hover:text-blue-600 transition-colors px-2 py-1 bg-gray-50 hover:bg-blue-50 rounded-md"
                                        >
                                            Reset All
                                        </button>
                                        <button onClick={() => setShowFilterPanel(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                                            <XIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Date Range */}
                                    <div className="sm:col-span-2 grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-0.5">Start Date</label>
                                            <CustomDatePicker value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} compact />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-0.5">End Date</label>
                                            <CustomDatePicker value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} compact />
                                        </div>
                                    </div>

                                    {/* Method Filter */}
                                    <div className="space-y-1.5 relative" data-filter-dropdown>
                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-0.5">Method</label>
                                        <button
                                            onClick={() => setFilterDropdownOpen(filterDropdownOpen === 'method' ? null : 'method')}
                                            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm hover:bg-gray-100 transition-colors"
                                        >
                                            <span className={`truncate ${filters.method ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                {filters.method || 'All Methods'}
                                            </span>
                                            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                        </button>

                                        {filterDropdownOpen === 'method' && (
                                            <div className="absolute z-[10001] left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-48 overflow-y-auto w-full">
                                                <button onClick={() => { handleFilterChange('method', ''); setFilterDropdownOpen(null); }} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50">All Methods</button>
                                                {uniqueMethods.map(m => (
                                                    <button key={m} onClick={() => { handleFilterChange('method', m); setFilterDropdownOpen(null); }} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between">
                                                        {m}
                                                        {filters.method === m && <CheckIcon className="w-4 h-4 text-blue-600" />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Customer Filter */}
                                    <div className="space-y-1.5 relative" data-filter-dropdown>
                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-0.5">Customer / Party</label>
                                        <button
                                            onClick={() => setFilterDropdownOpen(filterDropdownOpen === 'customer' ? null : 'customer')}
                                            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm hover:bg-gray-100 transition-colors"
                                        >
                                            <span className={`truncate ${filters.customer ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                {filters.customer || 'All Customers'}
                                            </span>
                                            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                        </button>

                                        {filterDropdownOpen === 'customer' && (
                                            <div className="absolute z-[10001] left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-48 flex flex-col w-full">
                                                <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                                                    <input
                                                        type="text"
                                                        placeholder="Search..."
                                                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md outline-none focus:border-blue-500"
                                                        value={filterSearchInputs.customer}
                                                        onChange={(e) => setFilterSearchInputs(p => ({ ...p, customer: e.target.value }))}
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                </div>
                                                <div className="overflow-y-auto flex-1">
                                                    <button onClick={() => { handleFilterChange('customer', ''); setFilterDropdownOpen(null); }} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50">All Customers</button>
                                                    {uniqueCustomers.filter(c => c.toLowerCase().includes(filterSearchInputs.customer.toLowerCase())).map(c => (
                                                        <button key={c} onClick={() => { handleFilterChange('customer', c); setFilterDropdownOpen(null); }} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between">
                                                            <span className="truncate">{c}</span>
                                                            {filters.customer === c && <CheckIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bank Filter */}
                                    <div className="space-y-1.5 relative" data-filter-dropdown>
                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-0.5">Bank / Provider</label>
                                        <button
                                            onClick={() => setFilterDropdownOpen(filterDropdownOpen === 'bankName' ? null : 'bankName')}
                                            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm hover:bg-gray-100 transition-colors"
                                        >
                                            <span className={`truncate ${filters.bankName ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                {filters.bankName || 'All Banks'}
                                            </span>
                                            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                        </button>

                                        {filterDropdownOpen === 'bankName' && (
                                            <div className="absolute z-[10001] left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-48 flex flex-col w-full">
                                                <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                                                    <input
                                                        type="text"
                                                        placeholder="Search..."
                                                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md outline-none focus:border-blue-500"
                                                        value={filterSearchInputs.bankName}
                                                        onChange={(e) => setFilterSearchInputs(p => ({ ...p, bankName: e.target.value }))}
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                </div>
                                                <div className="overflow-y-auto flex-1">
                                                    <button onClick={() => { handleFilterChange('bankName', ''); setFilterDropdownOpen(null); }} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50">All Banks</button>
                                                    {uniqueBanks.filter(b => b.toLowerCase().includes(filterSearchInputs.bankName.toLowerCase())).map(b => (
                                                        <button key={b} onClick={() => { handleFilterChange('bankName', b); setFilterDropdownOpen(null); }} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between">
                                                            <span className="truncate">{b}</span>
                                                            {filters.bankName === b && <CheckIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Branch Filter */}
                                    <div className="space-y-1.5 relative" data-filter-dropdown>
                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-0.5">Branch</label>
                                        <button
                                            onClick={() => setFilterDropdownOpen(filterDropdownOpen === 'branch' ? null : 'branch')}
                                            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm hover:bg-gray-100 transition-colors"
                                        >
                                            <span className={`truncate ${filters.branch ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                {filters.branch || 'All Branches'}
                                            </span>
                                            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                        </button>

                                        {filterDropdownOpen === 'branch' && (
                                            <div className="absolute z-[10001] left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-48 flex flex-col w-full">
                                                <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                                                    <input
                                                        type="text"
                                                        placeholder="Search..."
                                                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md outline-none focus:border-blue-500"
                                                        value={filterSearchInputs.branch}
                                                        onChange={(e) => setFilterSearchInputs(p => ({ ...p, branch: e.target.value }))}
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                </div>
                                                <div className="overflow-y-auto flex-1">
                                                    <button onClick={() => { handleFilterChange('branch', ''); setFilterDropdownOpen(null); }} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50">All Branches</button>
                                                    {uniqueBranches.filter(b => b.toLowerCase().includes(filterSearchInputs.branch.toLowerCase())).map(b => (
                                                        <button key={b} onClick={() => { handleFilterChange('branch', b); setFilterDropdownOpen(null); }} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between">
                                                            <span className="truncate">{b}</span>
                                                            {filters.branch === b && <CheckIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="sm:col-span-2 pt-2">
                                        <button
                                            onClick={() => setShowFilterPanel(false)}
                                            className="w-full py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-colors"
                                        >
                                            Apply Filters
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Printable Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-12 print:p-0 print:overflow-visible bg-white">
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
                                <h2 className="text-xl font-bold text-gray-900 tracking-wide uppercase">Payment Collection Report</h2>
                            </div>
                        </div>

                        {/* Meta row */}
                        <div className="flex justify-between items-end text-[12px] sm:text-[14px] text-gray-800 pt-6 px-2">
                            <div className="flex flex-col gap-1">
                                <div className="flex">
                                    <span className="font-bold text-gray-900 w-24 sm:w-32">Total Records:</span>
                                    <span className="text-gray-900">{filteredPayments.length}</span>
                                </div>
                                {filters.startDate && (
                                    <div className="flex">
                                        <span className="font-bold text-gray-900 w-24 sm:w-32">Start Date:</span>
                                        <span className="text-gray-900">{formatDate(filters.startDate)}</span>
                                    </div>
                                )}
                                {filters.endDate && (
                                    <div className="flex">
                                        <span className="font-bold text-gray-900 w-24 sm:w-32">End Date:</span>
                                        <span className="text-gray-900">{formatDate(filters.endDate)}</span>
                                    </div>
                                )}
                            </div>
                            <div className="font-bold text-right">
                                <span className="text-gray-900">Printed on: </span>
                                <span className="text-gray-900">{formatDate(new Date().toISOString().split('T')[0])}</span>
                            </div>
                        </div>

                        {/* Desktop / Print Table */}
                        <div className="hidden md:block print:block overflow-x-auto border border-gray-900">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-900">
                                        <th className="border-r border-gray-900 px-2 py-2 text-center text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[5%] whitespace-nowrap">SL</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-left text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">Date</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-left text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[18%] whitespace-nowrap">Party Name</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-left text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">Method</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-left text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[18%] whitespace-nowrap">Bank/Receiver</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-left text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">Branch</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-left text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[12%] whitespace-nowrap">A/C No</th>
                                        <th className="px-2 py-2 text-right text-[11px] font-bold text-gray-900 uppercase tracking-wider w-[11%] whitespace-nowrap">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-900 text-[12px]">
                                    {filteredPayments.length > 0 ? (
                                        filteredPayments.map((p, idx) => {
                                            const amount = parseFloat(p.amount) || 0;
                                            return (
                                                <tr key={idx} className="border-b border-gray-200">
                                                    <td className="border-r border-gray-900 px-2 py-1.5 text-center">{idx + 1}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1.5">{formatDate(p.date)}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1.5 font-bold">{p.companyName || p.customerName || '-'}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1.5">{p.method || '-'}</td>
                                                    <td className="border-r border-gray-900 px-2 py-1.5">
                                                        {p.method === 'Cash' ? (p.receiveBy || '-') : (p.bankName || '-')}
                                                    </td>
                                                    <td className="border-r border-gray-900 px-2 py-1.5">
                                                        {p.method === 'Cash' ? (p.place || '-') : (p.branch || '-')}
                                                    </td>
                                                    <td className="border-r border-gray-900 px-2 py-1.5">
                                                        {p.accountNo || '-'}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right font-bold text-blue-600 whitespace-nowrap">
                                                        ৳{amount.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="8" className="px-4 py-8 text-center text-gray-500 italic">No payments found.</td>
                                        </tr>
                                    )}
                                </tbody>
                                {filteredPayments.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-100 border-t-2 border-gray-900">
                                            <td colSpan="7" className="px-2 py-2 text-[12px] font-black text-gray-900 text-right uppercase tracking-wider border-r border-gray-900 whitespace-nowrap">Grand Total</td>
                                            <td className="px-2 py-2 text-[12px] text-right font-black text-blue-700 whitespace-nowrap">
                                                ৳{grandTotal.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 px-2 print:grid print:grid-cols-2">
                            <div className="border border-gray-200 p-4 sm:p-5 rounded-2xl bg-gray-50 shadow-sm">
                                <div className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Total Collections</div>
                                <div className="text-2xl sm:text-3xl font-black text-gray-900">{filteredPayments.length}</div>
                            </div>
                            <div className="border border-gray-200 p-4 sm:p-5 rounded-2xl bg-white shadow-sm">
                                <div className="text-[10px] sm:text-[11px] font-bold text-blue-500 uppercase tracking-wider mb-2">Grand Total Collected</div>
                                <div className="text-xl sm:text-2xl font-black text-blue-600">
                                    ৳{grandTotal.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 pt-16 sm:pt-24 px-4 pb-12 print:grid print:grid-cols-3 print:pt-24 print:gap-8">
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

export default PaymentCollectionReport;
