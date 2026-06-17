import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SearchIcon, PlusIcon, EditIcon, TrashIcon, ShieldIcon, XIcon, ChevronDownIcon, ChevronUpIcon, DollarSignIcon, BarChartIcon, TrendingUpIcon, EyeIcon, PrinterIcon, FunnelIcon } from '../../Icons';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import CustomDatePicker from '../../shared/CustomDatePicker';

const Insurance = ({ onDeleteConfirm }) => {
    const [insuranceRecords, setInsuranceRecords] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [expandedRowKey, setExpandedRowKey] = useState(null);
    const [lcRecords, setLcRecords] = useState([]);
    const [insurancePayments, setInsurancePayments] = useState([]);
    const [isInitialLoading, setIsInitialLoading] = useState(false);

    // View Modal State
    const [viewData, setViewData] = useState(null);
    const [historySearchQuery, setHistorySearchQuery] = useState('');
    const [activeHistoryTab, setActiveHistoryTab] = useState('payments'); // 'payments' or 'lc'

    const [formData, setFormData] = useState({
        companyName: '',
        address: '',
        contactPerson: '',
        phone: '',
        email: '',
        policyType: '',
        premiumPercent: '',
        premiumReturnPercent: '',
        stampCharge: '',
        paidPremium: '',
        paidReturn: '',
        status: 'Active'
    });

    useEffect(() => {
        fetchInsurance();
    }, []);

    const fetchInsurance = async () => {
        setIsInitialLoading(true);
        try {
            const [insRes, lcRes, paymentsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/insurance`),
                axios.get(`${API_BASE_URL}/api/lc-management`),
                axios.get(`${API_BASE_URL}/api/insurance-payments`)
            ]);
            setInsuranceRecords(Array.isArray(insRes.data) ? insRes.data : []);
            setLcRecords(Array.isArray(lcRes.data) ? lcRes.data : []);
            setInsurancePayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : []);
        } catch (error) {
            console.error('Error fetching insurance data:', error);
        } finally {
            setIsInitialLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            const url = editingId
                ? `${API_BASE_URL}/api/insurance/${editingId}`
                : `${API_BASE_URL}/api/insurance`;

            if (editingId) {
                await axios.put(url, formData);
            } else {
                await axios.post(url, formData);
            }

            setSubmitStatus('success');
            fetchInsurance();
            setTimeout(() => {
                setShowForm(false);
                resetForm();
                setSubmitStatus(null);
            }, 1500);
        } catch (error) {
            console.error('Error saving insurance record:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            companyName: '',
            address: '',
            contactPerson: '',
            phone: '',
            email: '',
            policyType: '',
            premiumPercent: '',
            premiumReturnPercent: '',
            stampCharge: '',
            paidPremium: '',
            paidReturn: '',
            status: 'Active'
        });
        setEditingId(null);
        setSubmitStatus(null);
    };

    const handleEdit = (record) => {
        setFormData({
            companyName: record.companyName || '',
            address: record.address || '',
            contactPerson: record.contactPerson || '',
            phone: record.phone || '',
            email: record.email || '',
            policyType: record.policyType || '',
            premiumPercent: record.premiumPercent || '',
            premiumReturnPercent: record.premiumReturnPercent || '',
            stampCharge: record.stampCharge || '',
            paidPremium: record.paidPremium || '',
            paidReturn: record.paidReturn || '',
            status: record.status || 'Active'
        });
        setEditingId(record._id);
        setShowForm(true);
    };

    const handleView = (record) => {
        const aggregates = insuranceTotals[record.companyName] || { totalPremium: 0, returnAmount: 0 };
        const history = insurancePayments.filter(p => p.insuranceId === record._id);

        let paidPremium = parseFloat(record.paidPremium || 0);
        let paidReturn = parseFloat(record.paidReturn || 0);

        history.forEach(p => {
            const adjustment = parseFloat(p.adjustedAmount || 0);
            const amount = parseFloat(p.amount || 0);

            if (p.type === 'Return Collection') {
                paidReturn += amount;
            } else {
                paidPremium += amount + adjustment;
                if (p.isAdjustReturn) {
                    paidReturn += adjustment;
                }
            }
        });

        setViewData({
            ...record,
            aggregates,
            history,
            paidPremium,
            paidReturn,
            premiumBalance: aggregates.totalPremium - paidPremium,
            returnBalance: aggregates.returnAmount - paidReturn
        });
    };

    const handleDelete = (id) => {
        onDeleteConfirm({ show: true, type: 'insurance', id, isBulk: false });
    };

    const toggleRowExpansion = (id) => {
        setExpandedRowKey(prev => prev === id ? null : id);
    };

    const insuranceTotals = useMemo(() => {
        const totals = {};
        lcRecords.forEach(lc => {
            const co = lc.insuranceCo;
            if (!co) return;
            if (!totals[co]) {
                totals[co] = { totalPremium: 0, returnAmount: 0, lcs: [] };
            }
            totals[co].totalPremium += parseFloat(lc.grossPremium || 0);
            totals[co].returnAmount += parseFloat(lc.expectedReturnAmount || 0);
            totals[co].lcs.push(lc);
        });
        return totals;
    }, [lcRecords]);

    const displayRecords = useMemo(() => {
        return insuranceRecords.filter(item =>
            (item.companyName || '').toLowerCase().includes(searchQuery.toLowerCase())
        ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }, [insuranceRecords, searchQuery]);

    const globalAggregates = useMemo(() => {
        let totalPremium = 0;
        let returnAmount = 0;
        let paidPremium = 0;
        let paidReturn = 0;

        Object.values(insuranceTotals).forEach(co => {
            totalPremium += co.totalPremium || 0;
            returnAmount += co.returnAmount || 0;
        });

        insuranceRecords.forEach(item => {
            paidPremium += parseFloat(item.paidPremium || 0);
            paidReturn += parseFloat(item.paidReturn || 0);
        });

        insurancePayments.forEach(payment => {
            const adjustment = parseFloat(payment.adjustedAmount || 0);
            const amount = parseFloat(payment.amount || 0);

            if (payment.type === 'Return Collection') {
                paidReturn += amount;
            } else {
                paidPremium += amount + adjustment;
                if (payment.isAdjustReturn) {
                    paidReturn += adjustment;
                }
            }
        });

        return {
            totalPremium,
            paidPremium,
            premiumBalance: totalPremium - paidPremium,
            returnAmount,
            paidReturn,
            returnBalance: returnAmount - paidReturn
        };
    }, [insuranceTotals, insuranceRecords, insurancePayments]);

    // Filtered History for Modal
    const filteredHistory = useMemo(() => {
        if (!viewData) return [];
        if (activeHistoryTab === 'payments') {
            return viewData.history.filter(item =>
                (item.method || '').toLowerCase().includes(historySearchQuery.toLowerCase()) ||
                (item.reference || '').toLowerCase().includes(historySearchQuery.toLowerCase()) ||
                (item.type || '').toLowerCase().includes(historySearchQuery.toLowerCase())
            ).sort((a, b) => new Date(a.date) - new Date(b.date));
        } else {
            const companyLcs = insuranceTotals[viewData.companyName]?.lcs || [];
            return companyLcs.filter(lc =>
                (lc.lcNo || '').toLowerCase().includes(historySearchQuery.toLowerCase()) ||
                (lc.exporterName || '').toLowerCase().includes(historySearchQuery.toLowerCase())
            ).sort((a, b) => new Date(a.openingDate) - new Date(b.openingDate));
        }
    }, [viewData, historySearchQuery, activeHistoryTab, insuranceTotals]);

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {!showForm ? (
                    <>
                        <div className="w-full md:w-1/4 text-center md:text-left">
                            <h2 className="text-2xl font-bold text-gray-800">Insurance Management</h2>
                        </div>

                        <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                            <div className="absolute inset-y-0 left-0 pl-12 md:pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by company or policy..."
                                autoComplete="off"
                                className="h-10 block w-full pl-10 pr-4 bg-white/50 border border-gray-200 rounded-xl text-sm text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </>
                ) : (
                    <div className="hidden md:block md:flex-1"></div>
                )}

                {!showForm && (
                    <div className="w-full md:w-1/4 flex justify-end gap-3 z-50">
                        <button
                            onClick={() => { setShowForm(true); }}
                            className="h-10 border border-transparent w-full md:w-auto px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 md:hover:scale-105 flex items-center justify-center text-sm"
                        >
                            <span className="mr-2 text-xl font-bold">+</span>
                            <span>New Company</span>
                        </button>
                    </div>
                )}
            </div>

            {!showForm && (
                <>
                    {/* Mobile View Summary: Two rows of 3 cards */}
                    <div className="md:hidden space-y-2 mb-4">
                        <div className="flex flex-row gap-1">
                            {[
                                { label: 'Tot. Prem', value: globalAggregates.totalPremium, icon: ShieldIcon, color: 'blue' },
                                { label: 'Pd. Prem', value: globalAggregates.paidPremium, icon: DollarSignIcon, color: 'emerald' },
                                { label: 'Prem. Bal', value: globalAggregates.premiumBalance, icon: BarChartIcon, color: 'rose' }
                            ].map((card, i) => (
                                <div key={i} className="flex-1 min-w-0 bg-white py-2 px-1.5 rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md group">
                                    <div className="flex items-center gap-1 mb-1">
                                        <div className={`p-0.5 bg-${card.color}-50 text-${card.color}-600 rounded-lg group-hover:bg-${card.color}-600 group-hover:text-white transition-colors shrink-0`}>
                                            <card.icon className="w-3 h-3" />
                                        </div>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight truncate">{card.label}</span>
                                    </div>
                                    <div className="flex items-baseline gap-0.5 overflow-hidden">
                                        <span className={`text-sm font-black text-${card.color}-600 truncate`}>৳{card.value.toLocaleString('en-IN')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-row gap-1">
                            {[
                                { label: 'Ret. Amt', value: globalAggregates.returnAmount, icon: TrendingUpIcon, color: 'indigo' },
                                { label: 'Pd. Ret', value: globalAggregates.paidReturn, icon: DollarSignIcon, color: 'emerald' },
                                { label: 'Ret. Bal', value: globalAggregates.returnBalance, icon: BarChartIcon, color: 'orange' }
                            ].map((card, i) => (
                                <div key={i} className="flex-1 min-w-0 bg-white py-2 px-1.5 rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md group">
                                    <div className="flex items-center gap-1 mb-1">
                                        <div className={`p-0.5 bg-${card.color}-50 text-${card.color}-600 rounded-lg group-hover:bg-${card.color}-600 group-hover:text-white transition-colors shrink-0`}>
                                            <card.icon className="w-3 h-3" />
                                        </div>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight truncate">{card.label}</span>
                                    </div>
                                    <div className="flex items-baseline gap-0.5 overflow-hidden">
                                        <span className={`text-sm font-black text-${card.color}-600 truncate`}>৳{card.value.toLocaleString('en-IN')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Desktop View Summary: Original Grid */}
                    <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                        {[
                            { label: 'Total Premium', value: globalAggregates.totalPremium, icon: ShieldIcon, color: 'blue' },
                            { label: 'Paid Premium', value: globalAggregates.paidPremium, icon: DollarSignIcon, color: 'emerald' },
                            { label: 'Premium Balance', value: globalAggregates.premiumBalance, icon: BarChartIcon, color: 'rose', border: 'border-l-4 border-l-rose-400' },
                            { label: 'Return Amount', value: globalAggregates.returnAmount, icon: TrendingUpIcon, color: 'indigo' },
                            { label: 'Paid Return', value: globalAggregates.paidReturn, icon: DollarSignIcon, color: 'emerald' },
                            { label: 'Return Balance', value: globalAggregates.returnBalance, icon: BarChartIcon, color: 'orange', border: 'border-l-4 border-l-orange-400' }
                        ].map((card, i) => (
                            <div key={i} className={`bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-${card.color}-100 group ${card.border || ''}`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`p-2 bg-${card.color}-50 text-${card.color}-600 rounded-xl group-hover:bg-${card.color}-600 group-hover:text-white transition-colors`}>
                                        <card.icon className="w-5 h-5" />
                                    </div>
                                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{card.label}</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-xl font-black text-${card.color}-600`}>৳{card.value.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {showForm && (
                <div className="relative overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl p-5 md:p-8 animate-in fade-in slide-in-from-top-4 duration-500">

                    <div className="flex items-center justify-between mb-6 md:mb-8 relative z-10">
                        <div className="flex items-center space-x-3">
                            <h3 className="text-lg md:text-xl font-semibold text-gray-800">{editingId ? 'Edit Insurance Policy' : 'New Insurance Company'}</h3>
                        </div>
                        <button
                            onClick={() => { setShowForm(false); resetForm(); }}
                            className="p-1.5 md:p-2 hover:bg-gray-100/80 text-gray-400 hover:text-rose-500 rounded-xl transition-all"
                        >
                            <XIcon className="w-5 h-5 md:w-6 md:h-6" />
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
                        className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10"
                    >
                        <div className="md:col-span-2 space-y-4">
                            <h4 className="text-sm font-bold text-blue-600 uppercase tracking-wider bg-blue-50/50 p-2 rounded-lg">Company Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Insurance Company</label>
                                    <input
                                        type="text"
                                        name="companyName"
                                        value={formData.companyName}
                                        onChange={handleInputChange}
                                        required
                                        placeholder="Enter Company Name"
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Contact Person</label>
                                    <input
                                        type="text"
                                        name="contactPerson"
                                        value={formData.contactPerson}
                                        onChange={handleInputChange}
                                        placeholder="Name of Contact Person"
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Company Address</label>
                                    <textarea
                                        name="address"
                                        value={formData.address}
                                        onChange={handleInputChange}
                                        placeholder="Full Address"
                                        rows="2"
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Phone Number</label>
                                    <input
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        placeholder="Office Phone"
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Email Address</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        placeholder="Email"
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-4 pt-4">
                            <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50/50 p-2 rounded-lg">Policy Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Policy Type</label>
                                    <select
                                        name="policyType"
                                        value={formData.policyType}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    >
                                        <option value="">Select Type</option>
                                        <option value="Marine Insurance">Marine Insurance</option>
                                        <option value="Fire Insurance">Fire Insurance</option>
                                        <option value="Transit Insurance">Transit Insurance</option>
                                        <option value="General Asset">General Asset</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">
                                        {formData.policyType ? formData.policyType.split(' ')[0] : 'Policy type'} premium (%)
                                    </label>
                                    <input
                                        type="number"
                                        name="premiumPercent"
                                        value={formData.premiumPercent}
                                        onChange={handleInputChange}
                                        step="0.01"
                                        placeholder="0.00"
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Premium Return (%)</label>
                                    <input
                                        type="number"
                                        name="premiumReturnPercent"
                                        value={formData.premiumReturnPercent}
                                        onChange={handleInputChange}
                                        step="0.01"
                                        placeholder="0.00"
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Stamp Charge</label>
                                    <input
                                        type="number"
                                        name="stampCharge"
                                        value={formData.stampCharge}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-4 pt-4 border-t border-gray-50/50 mt-2">
                            <h4 className="text-sm font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50/50 p-2 rounded-lg">Financial Tracking</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Paid Premium (Manual)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                        <input
                                            type="number"
                                            name="paidPremium"
                                            value={formData.paidPremium}
                                            onChange={handleInputChange}
                                            placeholder="0.00"
                                            className="w-full px-4 py-2 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all font-bold"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Paid Return (Manual)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                        <input
                                            type="number"
                                            name="paidReturn"
                                            value={formData.paidReturn}
                                            onChange={handleInputChange}
                                            placeholder="0.00"
                                            className="w-full px-4 py-2 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all font-bold"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-2 flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 mt-4 border-t border-gray-100">
                            <div className="flex-1">
                                {submitStatus === 'success' && <div className="text-emerald-600 font-bold text-sm animate-in fade-in slide-in-from-left-4">Policy saved successfully!</div>}
                                {submitStatus === 'error' && <div className="text-red-600 font-bold text-sm animate-in fade-in slide-in-from-left-4">Failed to save record.</div>}
                            </div>
                            <div className="flex gap-3">
                                <button type="submit" disabled={isSubmitting} className={`px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all text-sm ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {isSubmitting ? 'Saving...' : editingId ? 'Update Policy' : 'Save Policy'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="space-y-4">
                    {/* Desktop View */}
                    <div className="hidden md:block overflow-x-auto bg-white/50 backdrop-blur-xl border border-white/40 rounded-2xl shadow-xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Company</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Email</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Phone</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total Premium</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Paid Premium</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Premium Balance</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Return Amount</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Paid Return</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Return Balance</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {isInitialLoading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan="10" className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                                        </tr>
                                    ))
                                ) : displayRecords.length > 0 ? (
                                    displayRecords.map((item) => {
                                        const aggregates = insuranceTotals[item.companyName] || { totalPremium: 0, returnAmount: 0 };
                                        let paidPremium = parseFloat(item.paidPremium || 0);
                                        let paidReturn = parseFloat(item.paidReturn || 0);

                                        insurancePayments.forEach(p => {
                                            if (p.insuranceId === item._id) {
                                                const adjustment = parseFloat(p.adjustedAmount || 0);
                                                const amount = parseFloat(p.amount || 0);

                                                if (p.type === 'Return Collection') {
                                                    paidReturn += amount;
                                                } else {
                                                    paidPremium += amount + adjustment;
                                                    if (p.isAdjustReturn) {
                                                        paidReturn += adjustment;
                                                    }
                                                }
                                            }
                                        });

                                        const premiumBalance = aggregates.totalPremium - paidPremium;
                                        const returnBalance = aggregates.returnAmount - paidReturn;

                                        return (
                                            <tr key={item._id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 group">
                                                <td className="px-6 py-4 text-sm font-bold text-gray-900">{item.companyName}</td>
                                                <td className="px-6 py-4 text-sm font-medium text-blue-600 truncate max-w-[150px]">{item.email || 'N/A'}</td>
                                                <td className="px-6 py-4 text-sm font-medium text-gray-600">{item.phone || 'N/A'}</td>
                                                <td className="px-6 py-4 text-sm font-bold text-blue-600 text-right">৳{aggregates.totalPremium.toLocaleString('en-US')}</td>
                                                <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-right">৳{paidPremium.toLocaleString('en-US')}</td>
                                                <td className="px-6 py-4 text-sm font-bold text-rose-600 text-right">৳{premiumBalance.toLocaleString('en-US')}</td>
                                                <td className="px-6 py-4 text-sm font-bold text-indigo-600 text-right">৳{aggregates.returnAmount.toLocaleString('en-IN')}</td>
                                                <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-right">৳{paidReturn.toLocaleString('en-IN')}</td>
                                                <td className="px-6 py-4 text-sm font-bold text-rose-600 text-right">৳{returnBalance.toLocaleString('en-IN')}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex justify-center items-center gap-3">
                                                        <button onClick={() => handleView(item)} className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition-all" title="View History">
                                                            <EyeIcon className="w-4.5 h-4.5" />
                                                        </button>
                                                        <button onClick={() => handleEdit(item)} className="p-1.5 hover:bg-amber-50 text-gray-400 hover:text-amber-600 rounded-lg transition-all" title="Edit">
                                                            <EditIcon className="w-4.5 h-4.5" />
                                                        </button>
                                                        <button onClick={() => handleDelete(item._id)} className="p-1.5 hover:bg-rose-50 text-gray-400 hover:text-rose-500 rounded-lg transition-all" title="Delete">
                                                            <TrashIcon className="w-4.5 h-4.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr><td colSpan="10" className="px-6 py-12 text-center text-gray-500">No insurance policies found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View */}
                    <div className="md:hidden space-y-4">
                        {displayRecords.map((item) => {
                            const isExpanded = expandedRowKey === item._id;

                            // Calculate aggregates for this specific record
                            const aggregates = insuranceTotals[item.companyName] || { totalPremium: 0, returnAmount: 0 };
                            let paidPremium = parseFloat(item.paidPremium || 0);
                            let paidReturn = parseFloat(item.paidReturn || 0);

                            insurancePayments.forEach(p => {
                                if (p.insuranceId === item._id) {
                                    const adjustment = parseFloat(p.adjustedAmount || 0);
                                    const amount = parseFloat(p.amount || 0);

                                    if (p.type === 'Return Collection') {
                                        paidReturn += amount;
                                    } else {
                                        paidPremium += amount + adjustment;
                                        if (p.isAdjustReturn) {
                                            paidReturn += adjustment;
                                        }
                                    }
                                }
                            });

                            const premiumBalance = aggregates.totalPremium - paidPremium;
                            const returnBalance = aggregates.returnAmount - paidReturn;

                            return (
                                <div key={item._id}
                                    className={`bg-white rounded-2xl border transition-all duration-300 ${isExpanded ? 'border-blue-200 shadow-lg ring-1 ring-blue-50' : 'border-gray-100 shadow-sm'}`}
                                    onClick={() => toggleRowExpansion(item._id)}
                                >
                                    <div className="p-5">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-base font-bold text-gray-800 tracking-tight uppercase tracking-widest truncate flex-1">{item.companyName}</h3>
                                            <div className={`p-1.5 rounded-lg transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'} shrink-0 ml-4`}>
                                                <ChevronDownIcon className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-300">
                                            {/* Contact Details (Shown only when expanded) */}
                                            <div className="space-y-0.5 mb-4 pb-3 border-b border-gray-50">
                                                <div className="flex flex-col space-y-0.5">
                                                    <span className="text-[11px] font-black text-gray-500 uppercase tracking-tight truncate">{item.contactPerson || 'No Contact'}</span>
                                                    <span className="text-[11px] font-bold text-blue-600 truncate">{item.email || 'No Email'}</span>
                                                    <span className="text-[11px] font-bold text-gray-900 tabular-nums">{item.phone || 'No Phone'}</span>
                                                </div>
                                            </div>

                                            {/* Card Details: Financial Metrics with Right Alignment */}
                                            <div className="space-y-1 pt-1 mb-4">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest shrink-0">Total Premium</span>
                                                    <div className="flex items-center text-right min-w-0">
                                                        <span className="text-gray-400 font-bold mx-2">-</span>
                                                        <span className="text-sm font-bold text-blue-600 truncate">৳{aggregates.totalPremium.toLocaleString('en-US')}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest shrink-0">Paid Premium</span>
                                                    <div className="flex items-center text-right min-w-0">
                                                        <span className="text-gray-400 font-bold mx-2">-</span>
                                                        <span className="text-sm font-bold text-emerald-600 truncate">৳{paidPremium.toLocaleString('en-US')}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-black text-rose-500 uppercase tracking-widest shrink-0">Premium Balance</span>
                                                    <div className="flex items-center text-right min-w-0">
                                                        <span className="text-rose-400 font-bold mx-2">-</span>
                                                        <span className="text-sm font-black text-rose-600">৳{premiumBalance.toLocaleString('en-US')}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest shrink-0">Return Amount</span>
                                                    <div className="flex items-center text-right min-w-0">
                                                        <span className="text-gray-400 font-bold mx-2">-</span>
                                                        <span className="text-sm font-bold text-indigo-600 truncate">৳{aggregates.returnAmount.toLocaleString('en-US')}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest shrink-0">Paid Return</span>
                                                    <div className="flex items-center text-right min-w-0">
                                                        <span className="text-gray-400 font-bold mx-2">-</span>
                                                        <span className="text-sm font-bold text-emerald-600 truncate">৳{paidReturn.toLocaleString('en-US')}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-black text-rose-500 uppercase tracking-widest shrink-0">Return Balance</span>
                                                    <div className="flex items-center text-right min-w-0">
                                                        <span className="text-rose-400 font-bold mx-2">-</span>
                                                        <span className="text-sm font-black text-rose-600">৳{returnBalance.toLocaleString('en-US')}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-row gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleView(item); }}
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-blue-50 text-blue-700 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                                                >
                                                    <EyeIcon className="w-3.5 h-3.5" /> View
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                                                >
                                                    <EditIcon className="w-3.5 h-3.5" /> Edit
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }}
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-red-50 text-red-600 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" /> Delete
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Insurance Detail Modal (History Card) */}
            {viewData && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-0 md:p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setViewData(null)}></div>
                    <div className="relative bg-white border-t md:border border-gray-100 rounded-t-[32px] md:rounded-2xl shadow-2xl w-full max-w-[1200px] flex flex-col h-[95vh] md:h-auto md:max-h-[90vh] animate-in slide-in-from-bottom md:zoom-in duration-300 overflow-hidden">

                        {/* Desktop Header: 100% Reverted */}
                        <div className="hidden md:flex px-6 py-5 border-b border-gray-100 flex-row items-center justify-between gap-4 bg-white rounded-t-2xl z-10 sticky top-0">
                            <div className="flex-1 text-left">
                                <h2 className="text-xl font-bold text-gray-900">{viewData.companyName}</h2>
                                <p className="text-xs text-gray-500 mt-1">{viewData.policyType} | {viewData.email || 'No Email'}</p>
                            </div>

                            <div className="flex-1 w-full max-w-md mx-auto">
                                <div className="relative group mb-3">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder={activeHistoryTab === 'payments' ? 'Search payments...' : 'Search LC history...'}
                                        value={historySearchQuery}
                                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                                        className="block w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-center"
                                    />
                                </div>
                                <div className="flex gap-1.5 justify-center">
                                    {['payments', 'lcs'].map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveHistoryTab(tab)}
                                            className={`px-6 py-2 text-xs font-bold rounded-lg transition-all ${activeHistoryTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                        >
                                            {tab === 'payments' ? 'Payment History' : 'LC History'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex-1 flex items-center justify-end">
                                <button onClick={() => setViewData(null)} className="p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-xl transition-all">
                                    <XIcon className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Mobile Header: Premium Overhaul */}
                        <div className="md:hidden px-6 pt-14 pb-6 border-b border-gray-100 bg-white rounded-t-[32px] z-20 sticky top-0">
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-widest break-words leading-tight">{viewData.companyName}</h2>
                                    <p className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-wider">{viewData.policyType} | {viewData.email || 'No Email'}</p>
                                </div>
                                <button onClick={() => setViewData(null)} className="p-2 bg-gray-50 text-gray-400 rounded-xl active:scale-95 transition-all shrink-0">
                                    <XIcon className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="flex flex-col gap-4">
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder={activeHistoryTab === 'payments' ? 'Search records...' : 'Search LC history...'}
                                        value={historySearchQuery}
                                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                                        className="block w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-center"
                                    />
                                </div>
                                <div className="flex p-1 bg-gray-100 rounded-xl">
                                    {['payments', 'lcs'].map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveHistoryTab(tab)}
                                            className={`flex-1 py-2 text-xs font-black rounded-lg transition-all uppercase tracking-widest ${activeHistoryTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            {tab === 'payments' ? 'Payments' : 'LCs'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">

                            {/* Statistics: High Density for Mobile */}
                            <div className="md:hidden space-y-2">
                                <div className="flex flex-row gap-1">
                                    {[
                                        { label: 'Tot. Prem', value: viewData.aggregates.totalPremium, color: 'blue' },
                                        { label: 'Pd. Prem', value: viewData.paidPremium, color: 'emerald' },
                                        { label: 'Prem. Bal', value: viewData.premiumBalance, color: 'rose' }
                                    ].map((stat, i) => (
                                        <div key={i} className="flex-1 bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 truncate">{stat.label}</p>
                                            <p className={`text-xs font-black text-${stat.color}-600 truncate`}>৳{stat.value.toLocaleString('en-IN')}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex flex-row gap-1">
                                    {[
                                        { label: 'Ret. Amt', value: viewData.aggregates.returnAmount, color: 'indigo' },
                                        { label: 'Pd. Ret', value: viewData.paidReturn, color: 'emerald' },
                                        { label: 'Ret. Bal', value: viewData.returnBalance, color: 'orange' }
                                    ].map((stat, i) => (
                                        <div key={i} className="flex-1 bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 truncate">{stat.label}</p>
                                            <p className={`text-xs font-black text-${stat.color}-600 truncate`}>৳{stat.value.toLocaleString('en-IN')}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Desktop Stats Grid (Restored Colors) */}
                            <div className="hidden md:grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {[
                                    { label: 'Total Premium', value: viewData.aggregates.totalPremium, color: 'blue' },
                                    { label: 'Paid Premium', value: viewData.paidPremium, color: 'emerald' },
                                    { label: 'Premium Bal.', value: viewData.premiumBalance, color: 'rose' },
                                    { label: 'Return Amount', value: viewData.aggregates.returnAmount, color: 'indigo' },
                                    { label: 'Paid Return', value: viewData.paidReturn, color: 'emerald' },
                                    { label: 'Return Bal.', value: viewData.returnBalance, color: 'orange' }
                                ].map((stat, i) => (
                                    <div key={i} className={`p-4 bg-${stat.color}-50/50 border border-gray-100 rounded-2xl`}>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                                        <p className={`text-sm font-black text-${stat.color}-600`}>৳{stat.value.toLocaleString('en-IN')}</p>
                                    </div>
                                ))}
                            </div>

                            {/* History: Cards for Mobile, Table for Desktop */}
                            <div className="space-y-4">
                                {/* Desktop Table */}
                                <div className="hidden md:block bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-gray-50/80 border-b border-gray-100">
                                            {activeHistoryTab === 'payments' ? (
                                                <tr>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Method</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Reference</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Adjusted Amount</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Paid Amount</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Total Amount</th>
                                                </tr>
                                            ) : (
                                                <tr>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">LC Date</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">LC Number</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Beneficiary</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Gross Premium</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Net Premium</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Exp. Return</th>
                                                </tr>
                                            )}
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {filteredHistory.length > 0 ? (
                                                filteredHistory.map((item, idx) => (
                                                    activeHistoryTab === 'payments' ? (
                                                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                            <td className="px-6 py-4 text-xs font-medium text-gray-600 whitespace-nowrap">{formatDate(item.date)}</td>
                                                            <td className="px-6 py-4 text-xs whitespace-nowrap text-nowrap">
                                                                <span className={`px-2 py-0.5 rounded-full font-bold ${item.type === 'Return Collection' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                                                    {item.type}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">{item.method}</td>
                                                            <td className="px-6 py-4 text-xs text-gray-500 italic truncate max-w-[120px]" title={item.reference}>{item.reference || 'No Reference'}</td>
                                                            <td className="px-6 py-4 text-xs font-bold text-blue-600 text-right whitespace-nowrap">
                                                                {item.adjustedAmount > 0 ? `৳${item.adjustedAmount.toLocaleString('en-IN')}` : '-'}
                                                            </td>
                                                            <td className="px-6 py-4 text-xs font-bold text-gray-700 text-right whitespace-nowrap">৳{parseFloat(item.amount || 0).toLocaleString('en-IN')}</td>
                                                            <td className="px-6 py-4 text-xs font-black text-gray-900 text-right bg-gray-50/30 whitespace-nowrap">
                                                                ৳{((parseFloat(item.amount || 0)) + (parseFloat(item.adjustedAmount || 0))).toLocaleString('en-IN')}
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                            <td className="px-6 py-4 text-xs font-medium text-gray-600">{formatDate(item.openingDate)}</td>
                                                            <td className="px-6 py-4 text-xs font-bold text-blue-600">{item.lcNo}</td>
                                                            <td className="px-6 py-4 text-xs text-gray-700 truncate max-w-[200px]">{item.exporterName}</td>
                                                            <td className="px-6 py-4 text-xs font-black text-blue-600 text-right">৳{parseFloat(item.grossPremium || 0).toLocaleString('en-US')}</td>
                                                            <td className="px-6 py-4 text-xs font-black text-rose-600 text-right">৳{parseFloat(item.netPremium || 0).toLocaleString('en-US')}</td>
                                                            <td className="px-6 py-4 text-xs font-black text-emerald-600 text-right">৳{parseFloat(item.expectedReturnAmount || 0).toLocaleString('en-IN')}</td>
                                                        </tr>
                                                    )
                                                ))
                                            ) : (
                                                <tr><td colSpan={activeHistoryTab === 'payments' ? 7 : 6} className="px-6 py-12 text-center text-gray-400 text-sm italic">No records found matching your search.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile History Cards */}
                                <div className="md:hidden space-y-4">
                                    {filteredHistory.length > 0 ? (
                                        filteredHistory.map((item, idx) => (
                                            <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{activeHistoryTab === 'payments' ? formatDate(item.date) : formatDate(item.openingDate)}</p>
                                                        <p className="text-sm font-black text-gray-900 uppercase tracking-tight">{activeHistoryTab === 'payments' ? item.method : item.lcNo}</p>
                                                    </div>
                                                    {activeHistoryTab === 'payments' && (
                                                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${item.type === 'Return Collection' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                                            {item.type}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 gap-2 pt-3 border-t border-gray-50">
                                                    {activeHistoryTab === 'payments' ? (
                                                        <>
                                                            <div className="flex justify-between">
                                                                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Adjusted</span>
                                                                <span className="text-sm font-bold text-blue-600">৳{parseFloat(item.adjustedAmount || 0).toLocaleString('en-IN')}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Paid</span>
                                                                <span className="text-sm font-bold text-gray-700">৳{parseFloat(item.amount || 0).toLocaleString('en-IN')}</span>
                                                            </div>
                                                            <div className="flex justify-between pt-1 border-t border-gray-50 mt-1">
                                                                <span className="text-[11px] font-black text-gray-800 uppercase tracking-widest">Total</span>
                                                                <span className="text-base font-black text-gray-900 uppercase">৳{((parseFloat(item.amount || 0)) + (parseFloat(item.adjustedAmount || 0))).toLocaleString('en-IN')}</span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="flex justify-between">
                                                                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Beneficiary</span>
                                                                <span className="text-sm font-bold text-gray-700 truncate ml-4 text-right">{item.exporterName}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Gross Premium</span>
                                                                <span className="text-sm font-black text-blue-600">৳{parseFloat(item.grossPremium || 0).toLocaleString('en-IN')}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Net Premium</span>
                                                                <span className="text-sm font-black text-rose-600">৳{parseFloat(item.netPremium || 0).toLocaleString('en-IN')}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Exp. Return</span>
                                                                <span className="text-sm font-black text-emerald-600">৳{parseFloat(item.expectedReturnAmount || 0).toLocaleString('en-IN')}</span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm text-gray-400 italic text-sm">No records found matching your search.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Insurance;
