import React, { useState } from 'react';
import { XIcon, BarChartIcon, PrinterIcon, SearchIcon } from '../../Icons';
import { formatDate } from '../../../utils/helpers';
import { generateCustomerReportPDF } from '../../../utils/pdfGenerator';

const CustomerReport = ({ isOpen, onClose, customers = [] }) => {
    if (!isOpen) return null;

    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('All Customer');

    // --- Calculate due per customer from salesHistory & paymentHistory ---
    const computeDue = (customer) => {
        const salesHistory = customer.salesHistory || [];
        const paymentHistory = customer.paymentHistory || [];

        const totalAmount = salesHistory.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        const totalPaid = salesHistory.reduce((s, i) => s + (parseFloat(i.paid) || 0), 0);
        const totalDiscount = salesHistory.reduce((s, i) => s + (parseFloat(i.discount) || 0), 0);
        const totalHistoryPaid = paymentHistory.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

        return Math.max(0, totalAmount - totalPaid - totalDiscount - totalHistoryPaid);
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
    });

    const grandTotalDue = filtered.reduce((s, c) => s + computeDue(c), 0);

    const handlePrint = () => {
        generateCustomerReportPDF(filtered, typeFilter, grandTotalDue, formatDate(new Date().toISOString().split('T')[0]));
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 print:p-0 print:bg-white print:backdrop-none">
            <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col print:max-h-none print:shadow-none print:rounded-none print:w-full print:h-auto">

                {/* Modal Header — hidden on print */}
                <div className="flex flex-row items-center justify-between px-4 sm:px-8 py-4 border-b border-gray-100 print:hidden gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-blue-50 rounded-lg sm:rounded-xl">
                            <BarChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                        </div>
                        <h3 className="text-base sm:text-xl font-black text-gray-800 truncate leading-none">Customer Report</h3>
                    </div>

                    <div className="flex items-center gap-2 flex-1 justify-center max-w-xs mx-4">
                        <div className="relative w-full">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search customers..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
                        {/* Type filter tabs */}
                        <div className="flex bg-gray-100/50 p-0.5 rounded-xl border border-gray-200/50 text-xs">
                            {['All Customer', 'General Customer', 'Party Customer'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setTypeFilter(type)}
                                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${typeFilter === type
                                        ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    {type.replace(' Customer', '')}
                                </button>
                            ))}
                        </div>

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
                    </div>
                </div>

                {/* Printable Content */}
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
                                <h2 className="text-xl font-bold text-gray-900 tracking-wide uppercase">Customer Due Report</h2>
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
                                <div className="flex">
                                    <span className="font-bold text-gray-900 w-32">Total Records:</span>
                                    <span className="text-gray-900">{filtered.length}</span>
                                </div>
                            </div>
                            <div className="font-bold">
                                <span className="text-gray-900">Printed on: </span>
                                <span className="text-gray-900">{formatDate(new Date().toISOString().split('T')[0])}</span>
                            </div>
                        </div>

                        {/* Desktop / Print Table */}
                        <div className="hidden md:block print:block overflow-x-auto border border-gray-900">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-900">
                                        <th className="border-r border-gray-900 px-2 py-2 text-center text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[5%]">SL</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-left text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[10%]">ID</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-left text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[22%]">Company</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-left text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[22%]">Customer</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-left text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[18%]">Phone</th>
                                        <th className="px-2 py-2 text-right text-[12px] font-bold text-gray-900 uppercase tracking-wider w-[18%]">Total Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-900">
                                    {filtered.length > 0 ? (
                                        filtered.map((c, idx) => {
                                            const due = computeDue(c);
                                            return (
                                                <tr key={c._id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                                                    <td className="border-r border-gray-200 px-2 py-2 text-[13px] text-gray-900 text-center">{idx + 1}</td>
                                                    <td className="border-r border-gray-200 px-2 py-2 text-[13px] font-bold text-gray-700">{c.customerId || '-'}</td>
                                                    <td className="border-r border-gray-200 px-2 py-2 text-[13px] text-gray-900">{c.companyName || '-'}</td>
                                                    <td className="border-r border-gray-200 px-2 py-2 text-[13px] font-medium text-gray-900">{c.customerName || '-'}</td>
                                                    <td className="border-r border-gray-200 px-2 py-2 text-[13px] text-gray-700">{c.phone || '-'}</td>
                                                    <td className={`px-2 py-2 text-[14px] text-right font-black ${due > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        ৳{due.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                {filtered.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-100 border-t-2 border-gray-900">
                                            <td colSpan="5" className="px-2 py-2 text-[14px] font-black text-gray-900 text-right uppercase tracking-wider border-r border-gray-900">Grand Total Due</td>
                                            <td className="px-2 py-2 text-[14px] text-right font-black text-rose-700">
                                                ৳{grandTotalDue.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                                        ৳{due.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Due</p>
                                        <p className="text-3xl font-black text-rose-400">
                                            ৳{grandTotalDue.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                <div className="text-[10px] sm:text-[11px] font-bold text-rose-500 uppercase tracking-wider mb-2">Grand Total Due</div>
                                <div className="text-xl sm:text-2xl font-black text-rose-600">
                                    ৳{grandTotalDue.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        </div>
    );
};

export default CustomerReport;
