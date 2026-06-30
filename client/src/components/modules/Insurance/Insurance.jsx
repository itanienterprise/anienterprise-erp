import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SearchIcon, PlusIcon, EditIcon, TrashIcon, ShieldIcon, XIcon, ChevronDownIcon, ChevronUpIcon, DollarSignIcon, BarChartIcon, TrendingUpIcon, EyeIcon, PrinterIcon, FunnelIcon } from '../../Icons';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import CustomDatePicker from '../../shared/CustomDatePicker';
const getLcInsuranceStatus = (lc, payments) => {
    const lcNo = lc.lcNo;
    const lcPayments = payments.filter(p => p.lcNo === lcNo);
    
    let premiumPaid = 0;
    let returnCollected = 0;
    
    lcPayments.forEach(p => {
        const amount = parseFloat(p.amount || 0);
        const adj = parseFloat(p.adjustedAmount || 0);
        if (p.type === 'Return Collection') {
            returnCollected += amount;
        } else {
            premiumPaid += amount + adj;
            if (p.isAdjustReturn) {
                returnCollected += adj;
            }
        }
    });

    const grossPremium = parseFloat(lc.grossPremium || 0);
    const netPremium = parseFloat(lc.netPremium || 0);
    const expectedReturn = parseFloat(lc.expectedReturnAmount || 0);

    const isPremiumPaidFully = premiumPaid >= (netPremium - 1) || premiumPaid >= (grossPremium - 1);
    const isReturnCollectedFully = expectedReturn <= 0 || returnCollected >= (expectedReturn - 1);

    if (isPremiumPaidFully && isReturnCollectedFully) {
        return 'complete';
    }
    if (returnCollected > 0) {
        return 'return recived';
    }
    if (premiumPaid > 0) {
        return 'premium paid';
    }
    return 'not paid';
};

const Insurance = ({ onDeleteConfirm }) => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const isIncharge = (currentUser?.role || '').toLowerCase() === 'incharge';
    const isLcManager = (currentUser?.role || '').toLowerCase() === 'lc manager';
    const cannotDelete = isIncharge || isLcManager;
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
    const [expandedHistoryIdx, setExpandedHistoryIdx] = useState(null);

    // History Filter State
    const [historyFilters, setHistoryFilters] = useState({ startDate: '', endDate: '', lcNo: '' });
    const [showHistoryFilterPanel, setShowHistoryFilterPanel] = useState(false);
    const [historyFilterSearchInputs, setHistoryFilterSearchInputs] = useState({ lcNo: '' });
    const [historyFilterDropdownOpen, setHistoryFilterDropdownOpen] = useState({ lcNo: false });

    // Refs for filter panel and buttons
    const filterCardRef = useRef(null);
    const filterButtonDesktopRef = useRef(null);
    const filterButtonMobileRef = useRef(null);
    const lcNoFilterRef = useRef(null);

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

    // Click-outside handlers for filter panel and LC No dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Close LC No dropdown if clicking outside
            if (lcNoFilterRef.current && !lcNoFilterRef.current.contains(event.target)) {
                setHistoryFilterDropdownOpen(prev => prev.lcNo ? { ...prev, lcNo: false } : prev);
            }
            // Close filter panel if clicking outside the card and outside both filter buttons
            if (
                filterCardRef.current &&
                !filterCardRef.current.contains(event.target) &&
                !filterButtonDesktopRef.current?.contains(event.target) &&
                !filterButtonMobileRef.current?.contains(event.target)
            ) {
                setShowHistoryFilterPanel(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
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
        setExpandedHistoryIdx(null);
    };

    const handleDelete = (id) => {
        if (cannotDelete) {
            alert('Forbidden: You do not have permission to delete insurance records');
            return;
        }
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

    // Helper: unique LC numbers in this insurance company's payments
    const getUniqueHistoryLcOptions = () => {
        if (!viewData) return [];
        const allLcs = viewData.history.map(p => (p.lcNo || '').trim()).filter(Boolean);
        return [...new Set(allLcs)].sort();
    };

    // Filtered History for Modal (with date + lcNo filters applied)
    const filteredHistory = useMemo(() => {
        if (!viewData) return [];
        if (activeHistoryTab === 'payments') {
            return viewData.history.filter(item => {
                // Date filter
                if (historyFilters.startDate || historyFilters.endDate) {
                    const rowDate = new Date(item.date);
                    if (historyFilters.startDate && rowDate < new Date(historyFilters.startDate)) return false;
                    if (historyFilters.endDate && rowDate > new Date(historyFilters.endDate)) return false;
                }
                // LC No filter
                if (historyFilters.lcNo && !(item.lcNo || '').toLowerCase().includes(historyFilters.lcNo.toLowerCase())) return false;
                // Search query
                const q = historySearchQuery.toLowerCase();
                if (!q) return true;
                return (
                    (item.method || '').toLowerCase().includes(q) ||
                    (item.reference || '').toLowerCase().includes(q) ||
                    (item.type || '').toLowerCase().includes(q) ||
                    (item.lcNo || '').toLowerCase().includes(q)
                );
            }).sort((a, b) => new Date(a.date) - new Date(b.date));
        } else {
            const companyLcs = insuranceTotals[viewData.companyName]?.lcs || [];
            return companyLcs.filter(lc => {
                // Date filter
                if (historyFilters.startDate || historyFilters.endDate) {
                    const rowDate = new Date(lc.openingDate);
                    if (historyFilters.startDate && rowDate < new Date(historyFilters.startDate)) return false;
                    if (historyFilters.endDate && rowDate > new Date(historyFilters.endDate)) return false;
                }
                // LC No filter
                if (historyFilters.lcNo && !(lc.lcNo || '').toLowerCase().includes(historyFilters.lcNo.toLowerCase())) return false;
                // Search query
                const q = historySearchQuery.toLowerCase();
                if (!q) return true;
                return (
                    (lc.lcNo || '').toLowerCase().includes(q) ||
                    (lc.exporterName || '').toLowerCase().includes(q)
                );
            }).sort((a, b) => new Date(a.openingDate) - new Date(b.openingDate));
        }
    }, [viewData, historySearchQuery, activeHistoryTab, insuranceTotals, historyFilters]);

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
                                                        {!cannotDelete && (
                                                            <button onClick={() => handleDelete(item._id)} className="p-1.5 hover:bg-rose-50 text-gray-400 hover:text-rose-500 rounded-lg transition-all" title="Delete">
                                                                <TrashIcon className="w-4.5 h-4.5" />
                                                            </button>
                                                        )}
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
                                            {/* Contact & Card Details: Financial Metrics in clean Exporter-style Flex rows */}
                                            <div className="space-y-2.5 pt-3 border-t border-gray-50 mb-4">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Contact Person</span>
                                                    <span className="text-gray-900 font-black">{item.contactPerson || '-'}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Email</span>
                                                    <span className="text-blue-600 font-black truncate max-w-[65%]">{item.email || '-'}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Phone</span>
                                                    <span className="text-gray-900 font-black font-mono">{item.phone || '-'}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs pt-1 border-t border-gray-100/50">
                                                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Total Premium</span>
                                                    <span className="text-blue-600 font-black">৳{aggregates.totalPremium.toLocaleString('en-IN')}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Paid Premium</span>
                                                    <span className="text-emerald-600 font-black">৳{paidPremium.toLocaleString('en-IN')}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-rose-500 font-bold uppercase tracking-widest text-[9px]">Premium Balance</span>
                                                    <span className="text-rose-600 font-black">৳{premiumBalance.toLocaleString('en-IN')}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Return Amount</span>
                                                    <span className="text-indigo-600 font-black">৳{aggregates.returnAmount.toLocaleString('en-IN')}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Paid Return</span>
                                                    <span className="text-emerald-600 font-black">৳{paidReturn.toLocaleString('en-IN')}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-rose-500 font-bold uppercase tracking-widest text-[9px]">Return Balance</span>
                                                    <span className="text-rose-600 font-black">৳{returnBalance.toLocaleString('en-IN')}</span>
                                                </div>
                                            </div>
 
                                            <div className="flex flex-row gap-2 pt-2 border-t border-gray-100">
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
                                                {!cannotDelete && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-red-50 text-red-600 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                                                    >
                                                        <TrashIcon className="w-3.5 h-3.5" /> Delete
                                                    </button>
                                                )}
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
            {viewData && createPortal(
                <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 app-modal-overlay">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setViewData(null)}></div>
                    <div className="relative bg-white border border-gray-100 rounded-2xl shadow-2xl w-full max-w-[1200px] flex flex-col max-h-[90vh] animate-in zoom-in duration-300">

                        {/* Desktop Header */}
                        <div className="hidden md:flex px-6 py-5 border-b border-gray-100 flex-row items-center justify-between gap-4 bg-white rounded-t-2xl flex-shrink-0">
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
                                            onClick={() => {
                                                setActiveHistoryTab(tab);
                                                setExpandedHistoryIdx(null);
                                            }}
                                            className={`px-6 py-2 text-xs font-bold rounded-lg transition-all ${activeHistoryTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                        >
                                            {tab === 'payments' ? 'Payment History' : 'LC History'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex-1 flex items-center justify-end gap-2">
                                <button
                                    ref={filterButtonDesktopRef}
                                    onClick={() => setShowHistoryFilterPanel(prev => !prev)}
                                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border ${
                                        showHistoryFilterPanel || Object.values(historyFilters).some(v => v !== '')
                                            ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/30'
                                            : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-blue-50/30'
                                    }`}
                                    title="Advanced Filter"
                                >
                                    <FunnelIcon className={`w-4 h-4 ${showHistoryFilterPanel || Object.values(historyFilters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                                </button>

                                <button onClick={() => setViewData(null)} className="p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-xl transition-all">
                                    <XIcon className="w-6 h-6" />
                                </button>
                            </div>
                        </div>


                        {/* Mobile Header */}
                        <div className="relative md:hidden px-6 py-5 border-b border-gray-100 bg-white rounded-t-2xl flex-shrink-0">
                            <div className="mb-4">
                                <div className="flex items-center justify-between gap-4">
                                    <h3 className="text-lg font-bold text-gray-900 truncate min-w-0 flex-1" title={viewData.companyName}>{viewData.companyName}</h3>
                                    <button onClick={() => setViewData(null)} className="p-2 hover:bg-gray-50 text-gray-400 hover:text-gray-600 rounded-full transition-all shrink-0 -mr-2">
                                        <XIcon className="w-5 h-5" />
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{viewData.policyType} | {viewData.email || 'No Email'}</p>
                            </div>
                            <div className="flex flex-col gap-3">
                                {/* Search + Filter button row */}
                                <div className="flex gap-2">
                                    <div className="relative group flex-1">
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
                                    <button
                                        ref={filterButtonMobileRef}
                                        onClick={() => setShowHistoryFilterPanel(prev => !prev)}
                                        className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all border ${
                                            showHistoryFilterPanel || Object.values(historyFilters).some(v => v !== '')
                                                ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/30'
                                                : 'bg-white border-gray-200 hover:border-blue-200'
                                        }`}
                                    >
                                        <FunnelIcon className={`w-4 h-4 ${showHistoryFilterPanel || Object.values(historyFilters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                                    </button>
                                </div>

                                <div className="flex p-1 bg-gray-100 rounded-xl">
                                    {['payments', 'lcs'].map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => {
                                                setActiveHistoryTab(tab);
                                                setExpandedHistoryIdx(null);
                                            }}
                                            className={`flex-1 py-2 text-xs font-black rounded-lg transition-all uppercase tracking-widest ${activeHistoryTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            {tab === 'payments' ? 'Payments' : 'LCs'}
                                        </button>
                                    ))}
                                </div>

                                {/* Statistics: High Density for Mobile */}
                                <div className="space-y-2 mt-1">
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
                            </div>
                        </div>

                        {/* Filter Panel — desktop: absolute from modal container; mobile: fixed */}
                        {showHistoryFilterPanel && (
                            <>
                                {/* Mobile backdrop */}
                                <div
                                    className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[2005] md:hidden"
                                    onClick={() => setShowHistoryFilterPanel(false)}
                                />
                                <div
                                    ref={filterCardRef}
                                    className="fixed inset-x-4 top-24 md:absolute md:top-[80px] md:left-auto md:right-6 w-auto md:w-80 bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[2010] p-4 flex flex-col animate-in fade-in zoom-in-95 duration-200"
                                >
                                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                                        <h4 className="font-bold text-gray-900 text-sm">Advanced Filter</h4>
                                        <button
                                            onClick={() => {
                                                setHistoryFilters({ startDate: '', endDate: '', lcNo: '' });
                                                setHistoryFilterSearchInputs({ lcNo: '' });
                                            }}
                                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                                        >
                                            Reset
                                        </button>
                                    </div>

                                    <div className="space-y-4 text-left">
                                        <div className="space-y-2">
                                            <CustomDatePicker
                                                label="From Date"
                                                value={historyFilters.startDate}
                                                onChange={(e) => setHistoryFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                                compact={true}
                                            />
                                            <CustomDatePicker
                                                label="To Date"
                                                value={historyFilters.endDate}
                                                onChange={(e) => setHistoryFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                                compact={true}
                                            />
                                        </div>

                                        <div className="space-y-1.5 relative" ref={lcNoFilterRef}>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">LC NUMBER</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={historyFilterSearchInputs.lcNo}
                                                    onChange={(e) => {
                                                        setHistoryFilterSearchInputs(prev => ({ ...prev, lcNo: e.target.value }));
                                                        setHistoryFilters(prev => ({ ...prev, lcNo: e.target.value }));
                                                        setHistoryFilterDropdownOpen(prev => ({ ...prev, lcNo: true }));
                                                    }}
                                                    onFocus={() => setHistoryFilterDropdownOpen(prev => ({ ...prev, lcNo: true }))}
                                                    placeholder={historyFilters.lcNo || 'Select LC No...'}
                                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all pr-8"
                                                />
                                                <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                            </div>
                                            {historyFilterDropdownOpen.lcNo && (() => {
                                                const opts = getUniqueHistoryLcOptions();
                                                const filtered = opts.filter(opt => opt.toLowerCase().includes(historyFilterSearchInputs.lcNo.toLowerCase()));
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1">
                                                        {filtered.map(opt => (
                                                            <button
                                                                key={opt}
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    setHistoryFilters(prev => ({ ...prev, lcNo: opt }));
                                                                    setHistoryFilterSearchInputs(prev => ({ ...prev, lcNo: '' }));
                                                                    setHistoryFilterDropdownOpen(prev => ({ ...prev, lcNo: false }));
                                                                }}
                                                                className="w-full px-4 py-1.5 text-left text-xs hover:bg-blue-50 transition-colors"
                                                            >
                                                                {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        <button
                                            onClick={() => setShowHistoryFilterPanel(false)}
                                            className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all shadow-lg active:scale-[0.98]"
                                        >
                                            APPLY FILTERS
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">



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
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">LC No</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Method</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Reference</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Gross Premium</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Return Amount</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Paid</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Adjusted</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                                                </tr>
                                            ) : (
                                                <tr>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">LC Date</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">LC Number</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Beneficiary</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Gross Premium</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Net Premium</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Exp. Return</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                                                </tr>
                                            )}
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {filteredHistory.length > 0 ? (
                                                filteredHistory.map((item, idx) => {
                                                    const lc = lcRecords.find(l => l.lcNo === item.lcNo);
                                                    return activeHistoryTab === 'payments' ? (
                                                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                            <td className="px-6 py-4 text-xs font-medium text-gray-600 whitespace-nowrap">{formatDate(item.date)}</td>
                                                            <td className="px-6 py-4 text-xs font-bold text-gray-500 whitespace-nowrap">{item.lcNo || '-'}</td>
                                                            <td className="px-6 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">{item.method}</td>
                                                            <td className="px-6 py-4 text-xs text-gray-500 italic truncate max-w-[120px]" title={item.reference}>{item.reference || '-'}</td>
                                                            <td className="px-6 py-4 text-xs font-bold text-blue-600 text-right whitespace-nowrap">
                                                                {lc ? `৳${(parseFloat(lc.grossPremium) || 0).toLocaleString('en-IN')}` : '-'}
                                                            </td>
                                                            <td className="px-6 py-4 text-xs font-bold text-indigo-600 text-right whitespace-nowrap">
                                                                {(item.isAdjustReturn || item.type === 'Return Collection')
                                                                    ? (lc ? `৳${(parseFloat(lc.expectedReturnAmount) || 0).toLocaleString('en-IN')}` : '-')
                                                                    : '৳0'}
                                                            </td>
                                                            <td className="px-6 py-4 text-xs font-bold text-gray-700 text-right whitespace-nowrap">
                                                                {item.type === 'Return Collection' ? '৳0' : `৳${(parseFloat(item.amount) || 0).toLocaleString('en-IN')}`}
                                                            </td>
                                                            <td className="px-6 py-4 text-xs font-bold text-rose-600 text-right whitespace-nowrap">
                                                                {item.adjustedAmount > 0 ? `৳${(parseFloat(item.adjustedAmount) || 0).toLocaleString('en-IN')}` : '-'}
                                                            </td>
                                                            <td className="px-6 py-4 text-xs text-center whitespace-nowrap">
                                                                {item.isAdjustReturn ? (
                                                                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-blue-50 text-blue-600 border-blue-100/50">
                                                                        Adjust
                                                                    </span>
                                                                ) : item.type === 'Return Collection' ? (
                                                                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-600 border-emerald-100/50">
                                                                        Return
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-rose-50 text-rose-600 border-rose-100/50">
                                                                        Paid
                                                                    </span>
                                                                )}
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
                                                            <td className="px-6 py-4 text-xs text-center whitespace-nowrap">
                                                                {(() => {
                                                                    const status = getLcInsuranceStatus(item, insurancePayments);
                                                                    if (status === 'complete') {
                                                                        return (
                                                                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-600 border-emerald-100/50">
                                                                                complete
                                                                            </span>
                                                                        );
                                                                    } else if (status === 'return recived') {
                                                                        return (
                                                                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-amber-50 text-amber-600 border-amber-100/50">
                                                                                return recived
                                                                            </span>
                                                                        );
                                                                    } else if (status === 'premium paid') {
                                                                        return (
                                                                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-blue-50 text-blue-600 border-blue-100/50">
                                                                                premium paid
                                                                            </span>
                                                                        );
                                                                    } else {
                                                                        return (
                                                                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-rose-50 text-rose-600 border-rose-100/50">
                                                                                not paid
                                                                            </span>
                                                                        );
                                                                    }
                                                                })()}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr><td colSpan={activeHistoryTab === 'payments' ? 9 : 7} className="px-6 py-12 text-center text-gray-400 text-sm italic">No records found matching your search.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile History Cards */}
                                <div className="md:hidden space-y-3">
                                    {filteredHistory.length > 0 ? (
                                        filteredHistory.map((item, idx) => {
                                            const lc = lcRecords.find(l => l.lcNo === item.lcNo);
                                            const isExpanded = expandedHistoryIdx === idx;
                                            return (
                                                <div key={idx} className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-blue-200 shadow-md ring-1 ring-blue-50' : 'border-gray-100 shadow-sm hover:border-gray-200'}`}>
                                                    {/* Card Toggle Header */}
                                                    <div
                                                        className="flex justify-between items-center p-4 cursor-pointer select-none active:bg-gray-50 transition-colors"
                                                        onClick={() => setExpandedHistoryIdx(isExpanded ? null : idx)}
                                                    >
                                                        <div className="flex-1 min-w-0 pr-4">
                                                            <div className="flex items-center gap-1.5 text-xs text-left min-w-0 overflow-hidden flex-wrap">
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">
                                                                    {activeHistoryTab === 'payments' ? formatDate(item.date) : formatDate(item.openingDate)}
                                                                </span>
                                                                <span className="text-gray-300 font-bold shrink-0">•</span>
                                                                <span className="font-bold text-gray-800 truncate max-w-[120px] shrink-0" title={activeHistoryTab === 'payments' ? item.method : item.exporterName}>
                                                                    {activeHistoryTab === 'payments' ? item.method : item.exporterName || '-'}
                                                                </span>
                                                                <span className="text-gray-300 font-bold shrink-0">•</span>
                                                                <span className="font-black text-blue-600 truncate min-w-0" title={item.lcNo}>
                                                                    {item.lcNo || '-'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {activeHistoryTab === 'payments' ? (
                                                                item.isAdjustReturn ? (
                                                                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-blue-50 text-blue-600 border-blue-100/50">
                                                                        Adjust
                                                                    </span>
                                                                ) : item.type === 'Return Collection' ? (
                                                                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-600 border-emerald-100/50">
                                                                        Return
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-rose-50 text-rose-600 border-rose-100/50">
                                                                        Paid
                                                                    </span>
                                                                )
                                                            ) : (() => {
                                                                const status = getLcInsuranceStatus(item, insurancePayments);
                                                                if (status === 'complete') {
                                                                    return (
                                                                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-600 border-emerald-100/50">
                                                                            complete
                                                                        </span>
                                                                    );
                                                                } else if (status === 'return recived') {
                                                                    return (
                                                                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-amber-50 text-amber-600 border-amber-100/50">
                                                                            return recived
                                                                        </span>
                                                                    );
                                                                } else if (status === 'premium paid') {
                                                                    return (
                                                                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-blue-50 text-blue-600 border-blue-100/50">
                                                                            premium paid
                                                                        </span>
                                                                    );
                                                                } else {
                                                                    return (
                                                                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-rose-50 text-rose-600 border-rose-100/50">
                                                                            not paid
                                                                        </span>
                                                                    );
                                                                }
                                                            })()}
                                                            <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
                                                                {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Expandable Details */}
                                                    {isExpanded && (
                                                        <div className="px-4 pb-4 pt-1 space-y-2 bg-gray-50/30 border-t border-gray-100/50 text-xs text-left animate-in slide-in-from-top-4 duration-300">
                                                            <div className="grid grid-cols-[125px_8px_1fr] gap-y-2 pt-3 text-xs items-baseline">
                                                                {activeHistoryTab === 'payments' ? (
                                                                    <>
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">LC No</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-semibold text-gray-700 uppercase truncate text-[11px]">{item.lcNo || '-'}</span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Method</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-semibold text-gray-700 uppercase truncate text-[11px]">{item.method || '-'}</span>

                                                                        {item.reference && (
                                                                            <>
                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reference</span>
                                                                                <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                                <span className="font-semibold text-gray-700 text-[11px]">{item.reference}</span>
                                                                            </>
                                                                        )}

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Gross Premium</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-blue-600 text-[11px]">৳{lc ? (parseFloat(lc.grossPremium) || 0).toLocaleString('en-IN') : '-'}</span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Return Amount</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-indigo-600 text-[11px]">
                                                                            ৳{(item.isAdjustReturn || item.type === 'Return Collection')
                                                                                ? (lc ? (parseFloat(lc.expectedReturnAmount) || 0).toLocaleString('en-IN') : '-')
                                                                                : '0'}
                                                                        </span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Paid</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-gray-700 text-[11px]">৳{item.type === 'Return Collection' ? '0' : (parseFloat(item.amount) || 0).toLocaleString('en-IN')}</span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Adjusted</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-rose-600 text-[11px]">{item.adjustedAmount > 0 ? `৳${parseFloat(item.adjustedAmount).toLocaleString('en-IN')}` : '-'}</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Beneficiary</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-semibold text-gray-700 truncate text-[11px]">{item.exporterName || '-'}</span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Gross Premium</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-blue-600 text-[11px]">৳{parseFloat(item.grossPremium || 0).toLocaleString('en-IN')}</span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Net Premium</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-rose-600 text-[11px]">৳{parseFloat(item.netPremium || 0).toLocaleString('en-IN')}</span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Exp. Return</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-emerald-600 text-[11px]">৳{parseFloat(item.expectedReturnAmount || 0).toLocaleString('en-IN')}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm text-gray-400 italic text-sm">No records found matching your search.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Insurance;
