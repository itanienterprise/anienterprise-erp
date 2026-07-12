import React, { useState, useEffect, useRef } from 'react';
import { SearchIcon, FunnelIcon, DollarSignIcon, EyeIcon, PlusIcon, XIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon, EditIcon, ShieldIcon, BarChartIcon, CalendarIcon, CheckIcon, TrendingUpIcon } from '../../Icons';
import { API_BASE_URL, formatDate, SortIcon } from '../../../utils/helpers';
import axios from '../../../utils/api';
import CustomDatePicker from '../../shared/CustomDatePicker';
import { hasPermission } from '../../../utils/permissionHelper';

const InsurancePayment = () => {
    const [payments, setPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [currentUser] = useState(() => {
        try {
            const saved = localStorage.getItem('currentUser');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const isAdmin = currentUser?.username === 'admin' || (currentUser?.role || '').toLowerCase() === 'admin';
    const isIncharge = (currentUser?.role || '').toLowerCase() === 'incharge';
    const isSalesManager = (currentUser?.role || '').toLowerCase() === 'sales manager';
    const isAccountsManager = (currentUser?.role || '').toLowerCase() === 'accounts manager' || (currentUser?.role || '').toLowerCase() === 'account manager';
    const isDataEntry = (currentUser?.role || '').toLowerCase() === 'data entry';
    // Use hasPermission so custom role assignments (e.g. Incharge with add toggled on) work correctly
    const canAdd = hasPermission(currentUser, 'insurancePayment', 'add');
    const canEdit = hasPermission(currentUser, 'insurancePayment', 'edit');
    const canDelete = hasPermission(currentUser, 'insurancePayment', 'delete');
    const canManage = canAdd || canEdit || canDelete;

    // Edit States
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingPayment, setEditingPayment] = useState(null);

    // Filter States
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const initialFilterState = {
        startDate: '',
        endDate: '',
        method: '',
        companyName: ''
    };
    const [filters, setFilters] = useState(initialFilterState);
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(null);

    // New Payment States
    const [showAddModal, setShowAddModal] = useState(false);
    const [insurances, setInsurances] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [paymentToDelete, setPaymentToDelete] = useState(null);
    const [insuranceSearchQuery, setInsuranceSearchQuery] = useState('');
    const [lcSearchQuery, setLcSearchQuery] = useState('');
    const insuranceDropdownRef = useRef(null);
    const methodDropdownRef = useRef(null);
    const lcDropdownRef = useRef(null);
    const [highlightedLcIndex, setHighlightedLcIndex] = useState(-1);
    const [highlightedInsuranceIndex, setHighlightedInsuranceIndex] = useState(-1);

    const handleLcKeyDown = (e) => {
        const filteredLcs = lcs.filter(lc => (lc.lcNo || '').toLowerCase().includes(lcSearchQuery.toLowerCase()));
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedLcIndex(prev => Math.min(prev + 1, filteredLcs.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedLcIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const indexToSelect = highlightedLcIndex >= 0 ? highlightedLcIndex : 0;
            if (filteredLcs && filteredLcs[indexToSelect]) {
                const lc = filteredLcs[indexToSelect];
                const insCoName = (lc.insuranceCo || '').toLowerCase().trim();
                const matchingIns = insurances.find(i => (i.companyName || '').toLowerCase().trim() === insCoName);

                setNewPayment(prev => ({
                    ...prev,
                    lcNo: lc.lcNo,
                    insuranceId: matchingIns ? matchingIns._id : prev.insuranceId
                }));
                setLcSearchQuery(lc.lcNo);
                if (matchingIns) {
                    setInsuranceSearchQuery(matchingIns.companyName);
                }
                setActiveDropdown(null);
                setHighlightedLcIndex(-1);
            } else {
                setActiveDropdown(null);
            }
        } else if (e.key === 'Escape') {
            setActiveDropdown(null);
        }
    };

    const handleInsuranceKeyDown = (e) => {
        const filteredInsurances = insurances.filter(i => i.companyName.toLowerCase().includes(insuranceSearchQuery.toLowerCase()));
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedInsuranceIndex(prev => Math.min(prev + 1, filteredInsurances.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedInsuranceIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const indexToSelect = highlightedInsuranceIndex >= 0 ? highlightedInsuranceIndex : 0;
            if (filteredInsurances && filteredInsurances[indexToSelect]) {
                const i = filteredInsurances[indexToSelect];
                setNewPayment(prev => ({ ...prev, insuranceId: i._id }));
                setInsuranceSearchQuery(i.companyName);
                setActiveDropdown(null);
                setHighlightedInsuranceIndex(-1);
            } else {
                setActiveDropdown(null);
            }
        } else if (e.key === 'Escape') {
            setActiveDropdown(null);
        }
    };
    const filterPanelRef = useRef(null);
    const filterButtonRef = useRef(null);
    const [lcs, setLcs] = useState([]);
    const [expandedPaymentIdx, setExpandedPaymentIdx] = useState(null);

    const [newPayment, setNewPayment] = useState({
        insuranceId: '',
        lcNo: '',
        type: 'Premium Payment',
        isAdjustReturn: true,
        date: new Date().toISOString().split('T')[0],
        method: 'Cash',
        amount: '',
        reference: '',
        remarks: ''
    });

    useEffect(() => {
        fetchPayments();
        fetchInsurances();
    }, []);

    const fetchInsurances = async () => {
        try {
            const [insRes, lcRes, paymentsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/insurance`),
                axios.get(`${API_BASE_URL}/api/lc-management`),
                axios.get(`${API_BASE_URL}/api/insurance-payments`)
            ]);

            const allInsurances = Array.isArray(insRes.data) ? insRes.data : [];
            const allLc = Array.isArray(lcRes.data) ? lcRes.data : [];
            const allPayments = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];

            const insurancesWithBalance = allInsurances.map(ins => {
                const targetName = (ins.companyName || '').toLowerCase().trim();

                // 1. Total Premium and Expected Return from LCs
                let totalPremium = 0;
                let expectedReturn = 0;
                allLc.forEach(lc => {
                    if ((lc.insuranceCo || '').toLowerCase().trim() === targetName) {
                        totalPremium += (parseFloat(lc.grossPremium) || 0);
                        expectedReturn += (parseFloat(lc.expectedReturnAmount) || 0);
                    }
                });

                // 2. Subtract Payments/Collections from Insurance Payment module
                let premiumPaid = 0;
                let returnCollected = 0;
                allPayments.forEach(payment => {
                    if (payment.insuranceId === ins._id) {
                        const adjustment = parseFloat(payment.adjustedAmount || 0);
                        const amount = parseFloat(payment.amount || 0);
                        if (payment.type === 'Return Collection') {
                            returnCollected += amount;
                        } else {
                            // Default to Premium Payment if type missing or is Premium Payment
                            premiumPaid += amount + adjustment;
                            if (payment.isAdjustReturn) {
                                returnCollected += adjustment;
                            }
                        }
                    }
                });

                // Add manual paid fields from insurance record if any
                const manualPremiumPaid = parseFloat(ins.paidPremium || 0);
                const manualReturnCollected = parseFloat(ins.paidReturn || 0);

                return {
                    ...ins,
                    premiumBalance: totalPremium - premiumPaid - manualPremiumPaid,
                    returnBalance: expectedReturn - returnCollected - manualReturnCollected
                };
            });

            setInsurances(insurancesWithBalance);
            setLcs(allLc);
        } catch (error) {
            console.error('Error fetching insurance companies:', error);
        }
    };

    const fetchPayments = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/insurance-payments`);
            setPayments(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching insurance payments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Click outside listener for dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target && !document.body.contains(event.target)) return;
            if (!activeDropdown) return;

            if (activeDropdown === 'insurance' && insuranceDropdownRef.current && !insuranceDropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
                const ins = insurances.find(i => i._id === newPayment.insuranceId);
                setInsuranceSearchQuery(ins?.companyName || '');
            }
            if (activeDropdown === 'method' && methodDropdownRef.current && !methodDropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
            if (activeDropdown === 'lc' && lcDropdownRef.current && !lcDropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
                setLcSearchQuery(newPayment.lcNo || '');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown, newPayment, insurances]);

    // Click outside and keydown listener for Filter Panel
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showFilterPanel && filterPanelRef.current && !filterPanelRef.current.contains(event.target) && !filterButtonRef.current?.contains(event.target)) {
                setShowFilterPanel(false);
            }
        };
        const handleEscape = (e) => {
            if (e.key === 'Escape') setShowFilterPanel(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showFilterPanel]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setFilterDropdownOpen(null);
        setExpandedPaymentIdx(null);
    };

    const resetFilters = () => {
        setFilters(initialFilterState);
        setSearchQuery('');
        setExpandedPaymentIdx(null);
    };

    const uniqueMethods = ["Cash", "Bank Transfer", "Online Banking", "Mobile Banking", "Cheque", "Other"];
    const uniqueInsuranceNames = [...new Set(insurances.map(i => i.companyName).filter(Boolean))].sort();

    const handleAddPayment = async (e) => {
        e.preventDefault();
        const amountVal = parseFloat(newPayment.amount || 0);
        const selectedIns = insurances.find(i => i._id === newPayment.insuranceId);
        if (!selectedIns) return;

        const returnBal = displayReturnBalance;

        if (!newPayment.isAdjustReturn && amountVal <= 0) return;
        if (newPayment.isAdjustReturn && amountVal <= 0 && returnBal <= 0) return;

        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const paymentData = {
                ...newPayment,
                companyName: selectedIns.companyName,
                amount: parseFloat(newPayment.amount || 0),
                adjustedAmount: newPayment.isAdjustReturn ? returnBal : 0
            };

            if (isEditMode) {
                await axios.put(`${API_BASE_URL}/api/insurance-payments/${editingPayment._id}`, paymentData);
            } else {
                await axios.post(`${API_BASE_URL}/api/insurance-payments`, paymentData);
            }

            setSubmitStatus('success');
            fetchPayments();
            fetchInsurances(); // Refresh balances
            setTimeout(() => {
                setShowAddModal(false);
                setSubmitStatus(null);
                resetNewPayment();
            }, 1500);
        } catch (error) {
            console.error('Error saving insurance payment:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetNewPayment = () => {
        setNewPayment({
            insuranceId: '',
            lcNo: '',
            type: 'Premium Payment',
            isAdjustReturn: true,
            date: new Date().toISOString().split('T')[0],
            method: 'Cash',
            amount: '',
            reference: '',
            remarks: ''
        });
        setInsuranceSearchQuery('');
        setLcSearchQuery('');
        setIsEditMode(false);
        setEditingPayment(null);
        setExpandedPaymentIdx(null);
    };

    const handleEditPayment = (payment) => {
        setIsEditMode(true);
        setEditingPayment(payment);
        setNewPayment({
            insuranceId: payment.insuranceId,
            lcNo: payment.lcNo || '',
            type: payment.type || 'Premium Payment',
            isAdjustReturn: payment.isAdjustReturn !== undefined ? payment.isAdjustReturn : true,
            date: payment.date,
            method: payment.method,
            amount: payment.amount.toString(),
            reference: payment.reference || '',
            remarks: payment.remarks || ''
        });
        const ins = insurances.find(i => i._id === payment.insuranceId);
        setInsuranceSearchQuery(ins?.companyName || '');
        setLcSearchQuery(payment.lcNo || '');
        setShowAddModal(true);
    };

    const handleDeletePayment = (payment) => {
        if (!canDelete) {
            alert('Forbidden: You do not have permission to delete insurance payments');
            return;
        }
        setPaymentToDelete(payment);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!paymentToDelete) return;
        setIsSubmitting(true);
        try {
            await axios.delete(`${API_BASE_URL}/api/insurance-payments/${paymentToDelete._id}`);
            setSubmitStatus('success');
            setTimeout(() => {
                setShowDeleteConfirm(false);
                setPaymentToDelete(null);
                setSubmitStatus(null);
                setExpandedPaymentIdx(null);
                fetchPayments();
                fetchInsurances();
            }, 1000);
        } catch (error) {
            console.error('Error deleting insurance payment:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const filteredPayments = payments.filter(p => {
        const matchSearch = !searchQuery ||
            (p.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.method || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.reference || '').toLowerCase().includes(searchQuery.toLowerCase());

        const matchStartDate = !filters.startDate || p.date >= filters.startDate;
        const matchEndDate = !filters.endDate || p.date <= filters.endDate;
        const matchMethod = !filters.method || p.method === filters.method;
        const matchCompanyName = !filters.companyName || p.companyName === filters.companyName;

        return matchSearch && matchStartDate && matchEndDate && matchMethod && matchCompanyName;
    }).sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (sortConfig.key === 'date') {
            return sortConfig.direction === 'desc' ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date);
        }
        if (sortConfig.direction === 'desc') return valB < valA ? -1 : 1;
        return valA < valB ? -1 : 1;
    });

    const totalPaid = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
    const transactionCount = filteredPayments.length;

    let displayPremiumBalance = 0;
    let displayReturnBalance = 0;

    if (newPayment.lcNo) {
        const selectedLc = lcs.find(lc => lc.lcNo === newPayment.lcNo);
        if (selectedLc) {
            let premiumPaid = 0;
            let returnCollected = 0;

            payments.forEach(payment => {
                if (isEditMode && editingPayment && payment._id === editingPayment._id) {
                    return;
                }
                if (payment.lcNo === newPayment.lcNo) {
                    const adjustment = parseFloat(payment.adjustedAmount || 0);
                    const amount = parseFloat(payment.amount || 0);
                    if (payment.type === 'Return Collection') {
                        returnCollected += amount;
                    } else {
                        premiumPaid += amount + adjustment;
                        if (payment.isAdjustReturn) {
                            returnCollected += adjustment;
                        }
                    }
                }
            });

            displayPremiumBalance = (parseFloat(selectedLc.grossPremium) || 0) - premiumPaid;
            displayReturnBalance = (parseFloat(selectedLc.expectedReturnAmount) || 0) - returnCollected;
        }
    } else if (newPayment.insuranceId) {
        const selectedIns = insurances.find(i => i._id === newPayment.insuranceId);
        if (selectedIns) {
            displayPremiumBalance = selectedIns.premiumBalance || 0;
            displayReturnBalance = selectedIns.returnBalance || 0;

            if (isEditMode && editingPayment && editingPayment.insuranceId === newPayment.insuranceId) {
                const adjustment = parseFloat(editingPayment.adjustedAmount || 0);
                const amount = parseFloat(editingPayment.amount || 0);
                if (editingPayment.type === 'Return Collection') {
                    displayReturnBalance += amount;
                } else {
                    displayPremiumBalance += amount + adjustment;
                    if (editingPayment.isAdjustReturn) {
                        displayReturnBalance += adjustment;
                    }
                }
            }
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="w-full md:w-auto text-center md:text-left">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800">Insurance Payment</h2>
                </div>

                {!showAddModal && (
                    <div className="w-full max-w-md mx-auto relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by company, method, reference..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setExpandedPaymentIdx(null); }}
                            className="h-10 block w-full pl-10 pr-4 bg-white/50 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                        />
                    </div>
                )}

                <div className="flex items-center justify-center md:justify-end gap-2 w-full md:w-auto">
                    {!showAddModal && (
                        <div className="relative">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`h-10 flex items-center justify-center gap-2 px-4 rounded-xl border transition-all active:scale-95 text-sm font-medium shadow-sm ${showFilterPanel || Object.values(filters).some(v => v !== '') ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                <FunnelIcon className="w-4 h-4" />
                                <span className="text-sm font-medium">Filter</span>
                            </button>
                            {showFilterPanel && (
                                <>
                                    {/* Mobile backdrop */}
                                    <div className="fixed inset-0 bg-black/10 z-[2005] md:hidden" onClick={() => setShowFilterPanel(false)} />
                                    <div ref={filterPanelRef} className="fixed inset-x-4 top-24 md:absolute md:top-full md:left-auto md:right-0 md:mt-2 w-auto md:w-72 bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[2010] p-4 flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-visible">
                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                                            <h4 className="font-bold text-gray-900 text-sm">Filter Payments</h4>
                                            <button onClick={resetFilters} className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider">Reset</button>
                                        </div>

                                        <div className="space-y-3">
                                            <CustomDatePicker
                                                label="Start Date"
                                                value={filters.startDate}
                                                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                                compact={true}
                                            />
                                            <CustomDatePicker
                                                label="End Date"
                                                value={filters.endDate}
                                                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                                compact={true}
                                            />

                                            <div className="space-y-1.5 relative">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Company Name</label>
                                                <button
                                                    onClick={() => setFilterDropdownOpen(filterDropdownOpen === 'companyName' ? null : 'companyName')}
                                                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm"
                                                >
                                                    <span className="truncate">{filters.companyName || 'All Companies'}</span>
                                                    <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                                </button>
                                                {filterDropdownOpen === 'companyName' && (
                                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                                                        <button onClick={() => handleFilterChange('companyName', '')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">All Companies</button>
                                                        {uniqueInsuranceNames.map(name => (
                                                            <button key={name} onClick={() => handleFilterChange('companyName', name)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">{name}</button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => setShowFilterPanel(false)}
                                                className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all mt-2 active:scale-[0.98]"
                                            >
                                                APPLY FILTERS
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {canAdd && !showAddModal && (
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="h-10 border border-transparent flex items-center justify-center gap-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 text-sm hover:shadow-blue-500/30"
                        >
                            <PlusIcon className="w-4 h-4" />
                            <span>Add Payment</span>
                        </button>
                    )}
                </div>
            </div>

            {showAddModal ? (
                /* Add/Edit Form Card */
                <div className="relative group mb-8">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2.5rem] blur opacity-5 group-hover:opacity-10 transition duration-1000"></div>
                    <div className="relative bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white shadow-2xl animate-in slide-in-from-top-4 duration-500">
                        <div className="px-8 py-6 border-b border-gray-100/50 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white rounded-t-[2rem]">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 tracking-tight">{isEditMode ? 'Edit Insurance Payment' : 'New Insurance Payment'}</h3>
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Insurance Financial Record</p>
                            </div>
                            <button onClick={() => { setShowAddModal(false); resetNewPayment(); }} className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-90">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAddPayment} className="p-8 space-y-8">
                            {/* Adjustment & Type Selection (Moved to Top) */}
                            <div className="flex items-center gap-8 py-4 border border-blue-50 bg-blue-50/30 px-5 rounded-2xl shadow-sm">
                                <div className="flex items-center gap-6">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Adjustment:</label>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <div className="relative flex items-center justify-center">
                                                <input
                                                    type="radio"
                                                    name="isAdjustReturn"
                                                    checked={newPayment.isAdjustReturn}
                                                    onChange={() => setNewPayment(prev => ({ ...prev, isAdjustReturn: true, type: 'Premium Payment' }))}
                                                    className="peer appearance-none w-5 h-5 border-2 border-gray-200 rounded-full checked:border-blue-600 transition-all"
                                                />
                                                <div className="absolute w-2.5 h-2.5 bg-blue-600 rounded-full scale-0 peer-checked:scale-100 transition-all" />
                                            </div>
                                            <span className={`text-xs font-bold transition-colors ${newPayment.isAdjustReturn ? 'text-blue-600' : 'text-gray-400'}`}>Adjust Return Balance</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <div className="relative flex items-center justify-center">
                                                <input
                                                    type="radio"
                                                    name="isAdjustReturn"
                                                    checked={!newPayment.isAdjustReturn}
                                                    onChange={() => setNewPayment(prev => ({ ...prev, isAdjustReturn: false }))}
                                                    className="peer appearance-none w-5 h-5 border-2 border-gray-200 rounded-full checked:border-rose-600 transition-all"
                                                />
                                                <div className="absolute w-2.5 h-2.5 bg-rose-600 rounded-full scale-0 peer-checked:scale-100 transition-all" />
                                            </div>
                                            <span className={`text-xs font-bold transition-colors ${!newPayment.isAdjustReturn ? 'text-rose-600' : 'text-gray-400'}`}>Direct Payment</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 flex-1">
                                    <label className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${newPayment.isAdjustReturn ? 'text-gray-300' : 'text-gray-500'}`}>
                                        Payment Type:
                                    </label>
                                    <div className="flex gap-2">
                                        {['Premium Payment', 'Return Collection'].map((t) => (
                                            <button
                                                key={t}
                                                type="button"
                                                disabled={newPayment.isAdjustReturn}
                                                onClick={() => setNewPayment(prev => ({ ...prev, type: t }))}
                                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${newPayment.isAdjustReturn
                                                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed border-transparent'
                                                        : newPayment.type === t
                                                            ? t === 'Premium Payment' ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                                                            : 'bg-white border border-gray-200 text-gray-400 hover:border-gray-300'
                                                    }`}
                                            >
                                                {t.split(' ')[0]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                                {/* Row 1: Primary Info */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Payment Date</label>
                                    <CustomDatePicker value={newPayment.date} onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })} compact />
                                </div>

                                <div className="space-y-1.5 relative" ref={lcDropdownRef}>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">LC No</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search LC..."
                                            value={lcSearchQuery}
                                            onFocus={() => {
                                                setActiveDropdown('lc');
                                                setHighlightedLcIndex(-1);
                                            }}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setLcSearchQuery(val);
                                                setActiveDropdown('lc');
                                                setHighlightedLcIndex(-1);
                                                if (val === '') {
                                                    setNewPayment(prev => ({ ...prev, lcNo: '' }));
                                                }
                                            }}
                                            onKeyDown={handleLcKeyDown}
                                            autoComplete="off"
                                            className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none pr-10"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                            {newPayment.lcNo && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setNewPayment(prev => ({ ...prev, lcNo: '' }));
                                                        setLcSearchQuery('');
                                                        setHighlightedLcIndex(-1);
                                                    }}
                                                    className="p-0.5 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                                                >
                                                    <XIcon className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                                                </button>
                                            )}
                                            <ChevronDownIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    {activeDropdown === 'lc' && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[110] max-h-60 overflow-y-auto flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                            {lcs.filter(lc => (lc.lcNo || '').toLowerCase().includes(lcSearchQuery.toLowerCase())).map((lc, idx) => (
                                                <button
                                                    key={lc._id}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const insCoName = (lc.insuranceCo || '').toLowerCase().trim();
                                                        const matchingIns = insurances.find(i => (i.companyName || '').toLowerCase().trim() === insCoName);

                                                        setNewPayment(prev => ({
                                                            ...prev,
                                                            lcNo: lc.lcNo,
                                                            insuranceId: matchingIns ? matchingIns._id : prev.insuranceId
                                                        }));
                                                        setLcSearchQuery(lc.lcNo);
                                                        if (matchingIns) {
                                                            setInsuranceSearchQuery(matchingIns.companyName);
                                                        }
                                                        setActiveDropdown(null);
                                                        setHighlightedLcIndex(-1);
                                                    }}
                                                    onMouseEnter={() => setHighlightedLcIndex(idx)}
                                                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${highlightedLcIndex === idx ? 'bg-blue-50' : 'hover:bg-blue-50'}`}
                                                >
                                                    <div>
                                                        <div className="font-bold text-gray-900">{lc.lcNo}</div>
                                                        <div className="text-[10px] text-gray-500">{lc.importer}</div>
                                                    </div>
                                                    {newPayment.lcNo === lc.lcNo && <CheckIcon className="w-4 h-4 text-blue-600" />}
                                                </button>
                                            ))}
                                            {lcs.filter(lc => (lc.lcNo || '').toLowerCase().includes(lcSearchQuery.toLowerCase())).length === 0 && (
                                                <div className="px-4 py-3 text-sm text-gray-500 text-center">No LC matches found</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5 relative" ref={insuranceDropdownRef}>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Insurance Company</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search Company..."
                                            value={insuranceSearchQuery}
                                            onFocus={() => {
                                                setActiveDropdown('insurance');
                                                setHighlightedInsuranceIndex(-1);
                                            }}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setInsuranceSearchQuery(val);
                                                setActiveDropdown('insurance');
                                                setHighlightedInsuranceIndex(-1);
                                                if (val === '') {
                                                    setNewPayment(prev => ({ ...prev, insuranceId: '' }));
                                                }
                                            }}
                                            onKeyDown={handleInsuranceKeyDown}
                                            autoComplete="off"
                                            className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none pr-10"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                            {newPayment.insuranceId && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setNewPayment(prev => ({ ...prev, insuranceId: '' }));
                                                        setInsuranceSearchQuery('');
                                                        setHighlightedInsuranceIndex(-1);
                                                    }}
                                                    className="p-0.5 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                                                >
                                                    <XIcon className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                                                </button>
                                            )}
                                            <ChevronDownIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    {activeDropdown === 'insurance' && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[110] max-h-60 overflow-y-auto flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                            {insurances.filter(i => i.companyName.toLowerCase().includes(insuranceSearchQuery.toLowerCase())).map((i, idx) => (
                                                <button
                                                    key={i._id}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setNewPayment(prev => ({ ...prev, insuranceId: i._id }));
                                                        setInsuranceSearchQuery(i.companyName);
                                                        setActiveDropdown(null);
                                                        setHighlightedInsuranceIndex(-1);
                                                    }}
                                                    onMouseEnter={() => setHighlightedInsuranceIndex(idx)}
                                                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${highlightedInsuranceIndex === idx ? 'bg-blue-50' : 'hover:bg-blue-50'}`}
                                                >
                                                    <div>
                                                        <div className="font-bold text-gray-900">{i.companyName}</div>
                                                        <div className="text-[10px] text-gray-500">{i.policyType}</div>
                                                    </div>
                                                    {newPayment.insuranceId === i._id && <CheckIcon className="w-4 h-4 text-blue-600" />}
                                                </button>
                                            ))}
                                            {insurances.filter(i => i.companyName.toLowerCase().includes(insuranceSearchQuery.toLowerCase())).length === 0 && (
                                                <div className="px-4 py-3 text-sm text-gray-500 text-center">No company matches found</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5 relative">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Payment Method</label>
                                    <div ref={methodDropdownRef} className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setActiveDropdown(activeDropdown === 'method' ? null : 'method')}
                                            className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                        >
                                            <span className="truncate">{newPayment.method || 'Select Method'}</span>
                                            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                        </button>
                                        {activeDropdown === 'method' && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[110] py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                                {uniqueMethods.map(m => (
                                                    <button
                                                        key={m}
                                                        type="button"
                                                        onClick={() => { setNewPayment({ ...newPayment, method: m }); setActiveDropdown(null); }}
                                                        className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
                                                    >
                                                        <span className={newPayment.method === m ? 'font-bold text-blue-600' : 'text-gray-700'}>{m}</span>
                                                        {newPayment.method === m && <CheckIcon className="w-3.5 h-3.5 text-blue-600" />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Reference / Note</label>
                                    <input
                                        type="text"
                                        value={newPayment.reference}
                                        onChange={(e) => setNewPayment({ ...newPayment, reference: e.target.value })}
                                        placeholder="Ref No, Note..."
                                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>



                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start pt-4 border-t border-gray-50">
                                {/* Dynamic Balance Section */}
                                {newPayment.isAdjustReturn ? (
                                    <>
                                        {/* Adjustment Mode: Show Premium, Return and Payable */}
                                        <div className="space-y-1.5 animate-in fade-in slide-in-from-left-2 duration-300">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Premium Bal.</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <span className="text-gray-400 font-bold text-[10px]">৳</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={(newPayment.lcNo || newPayment.insuranceId) ? displayPremiumBalance.toLocaleString('en-US') : '0.00'}
                                                    className="w-full pl-6 pr-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-black text-gray-900 shadow-sm outline-none cursor-not-allowed"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 animate-in fade-in slide-in-from-left-2 duration-300">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Return Bal.</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <span className="text-gray-400 font-bold text-[10px]">৳</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={(newPayment.lcNo || newPayment.insuranceId) ? displayReturnBalance.toLocaleString('en-IN') : '0.00'}
                                                    className="w-full pl-6 pr-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-black text-gray-900 shadow-sm outline-none cursor-not-allowed"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 animate-in fade-in slide-in-from-left-2 duration-300">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Net Payable</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <span className="text-gray-400 font-bold text-[10px]">৳</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={(newPayment.lcNo || newPayment.insuranceId) ? (displayPremiumBalance - displayReturnBalance).toLocaleString('en-US') : '0.00'}
                                                    className="w-full pl-6 pr-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-black text-gray-900 shadow-sm outline-none cursor-not-allowed"
                                                />
                                            </div>
                                        </div>
                                        {/* Payment Entry Section for Adjustment Mode */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Amount (৳)</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                    <span className="text-gray-400 font-bold text-sm">৳</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    value={newPayment.amount}
                                                    onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                                                    placeholder="0.00"
                                                    required
                                                    className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-bold shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Direct Mode: Show only active type balance and Amount next to it */}
                                        <div className="space-y-1.5 animate-in fade-in slide-in-from-left-2 duration-300">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                                                {newPayment.type === 'Premium Payment' ? 'Premium Balance' : 'Return Balance'}
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <span className="text-gray-400 font-bold text-[10px]">৳</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={(newPayment.lcNo || newPayment.insuranceId) ? (newPayment.type === 'Premium Payment' ? displayPremiumBalance : displayReturnBalance).toLocaleString('en-US') : '0.00'}
                                                    className="w-full pl-6 pr-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-black text-gray-900 shadow-sm outline-none cursor-not-allowed"
                                                />
                                            </div>
                                        </div>
                                        {/* Amount field immediately after balance */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Amount (৳)</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                    <span className="text-gray-400 font-bold text-sm">৳</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    value={newPayment.amount}
                                                    onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                                                    placeholder="0.00"
                                                    required
                                                    className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-bold shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                        {/* Spacers for the rest of the 4-column grid */}
                                        <div></div>
                                        <div></div>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-50">

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-10 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Processing...' : isEditMode ? 'Update Payment' : 'Confirm Payment'}
                                </button>
                            </div>
                        </form>

                        {submitStatus === 'success' && (
                            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in">
                                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                    <CheckIcon className="w-8 h-8" />
                                </div>
                                <h4 className="text-xl font-black text-gray-900">Success!</h4>
                                <p className="text-gray-500">Payment record saved successfully.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Main View: Summary Cards + Table */
                <>
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Total Paid (Premium) */}
                        <div className="bg-white p-3.5 md:p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-blue-100 group">
                            <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                                <div className="p-1.5 md:p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <DollarSignIcon className="w-4 h-4 md:w-5 md:h-5" />
                                </div>
                                <span className="text-[9px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">Total Paid (Premium)</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-lg md:text-2xl font-black text-gray-900 truncate">৳{filteredPayments.reduce((sum, p) => {
                                    if (p.type === 'Return Collection') return sum;
                                    return sum + (p.amount || 0) + (p.adjustedAmount || 0);
                                }, 0).toLocaleString('en-IN')}</span>
                            </div>
                        </div>

                        {/* Total Collected (Return) */}
                        <div className="bg-white p-3.5 md:p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-emerald-100 group">
                            <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                                <div className="p-1.5 md:p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                    <TrendingUpIcon className="w-4 h-4 md:w-5 md:h-5" />
                                </div>
                                <span className="text-[9px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">Total Collected (Return)</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-lg md:text-2xl font-black text-emerald-600 truncate">৳{filteredPayments.reduce((sum, p) => {
                                    const amount = p.type === 'Return Collection' ? (p.amount || 0) : 0;
                                    const adjustment = p.adjustedAmount || 0;
                                    return sum + amount + adjustment;
                                }, 0).toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    </div>



                    {/* Table / List View */}
                    {/* Desktop View */}
                    <div className="hidden md:block bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-[13px]">
                                <thead className="bg-gray-50/50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('date')}>
                                            <div className="flex items-center gap-1">
                                                <span>Date</span>
                                                <SortIcon config={sortConfig} columnKey="date" />
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('companyName')}>
                                            <div className="flex items-center gap-1">
                                                <span>Insurance Company</span>
                                                <SortIcon config={sortConfig} columnKey="companyName" />
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('lcNo')}>
                                            <div className="flex items-center gap-1">
                                                <span>LC No</span>
                                                <SortIcon config={sortConfig} columnKey="lcNo" />
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider">Method</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider">Reference</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">Gross Premium</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">Return Amount</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">Paid</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">Adjusted</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-center">Status</th>
                                        {canManage && <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-center">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {isLoading ? (
                                        <tr><td colSpan={canManage ? 11 : 10} className="px-4 py-12 text-center text-gray-400">Loading payments...</td></tr>
                                    ) : filteredPayments.length === 0 ? (
                                        <tr><td colSpan={canManage ? 11 : 10} className="px-4 py-12 text-center text-gray-400">No payment records found.</td></tr>
                                    ) : (
                                        filteredPayments.map((p) => {
                                            const lc = lcs.find(l => l.lcNo === p.lcNo);
                                            return (
                                                <tr key={p._id} className="hover:bg-gray-50/50 transition-colors group">
                                                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDate(p.date)}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="font-bold text-gray-900">{p.companyName}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{p.lcNo || '-'}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{p.method}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-gray-500 truncate max-w-[150px]" title={p.reference}>{p.reference || '-'}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-blue-600">
                                                        {lc ? `৳${(parseFloat(lc.grossPremium) || 0).toLocaleString('en-IN')}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-indigo-600">
                                                        {(p.isAdjustReturn || p.type === 'Return Collection')
                                                            ? (lc ? `৳${(parseFloat(lc.expectedReturnAmount) || 0).toLocaleString('en-IN')}` : '-')
                                                            : '৳0'}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-gray-700">
                                                        {p.type === 'Return Collection' ? '৳0' : `৳${p.amount.toLocaleString('en-IN')}`}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-rose-600">
                                                        {p.adjustedAmount > 0 ? `৳${p.adjustedAmount.toLocaleString('en-IN')}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                                        {p.isAdjustReturn ? (
                                                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-blue-50 text-blue-600 border-blue-100/50">
                                                                Adjust
                                                            </span>
                                                        ) : p.type === 'Return Collection' ? (
                                                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-600 border-emerald-100/50">
                                                                Return
                                                            </span>
                                                        ) : (
                                                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-rose-50 text-rose-600 border-rose-100/50">
                                                                Paid
                                                            </span>
                                                        )}
                                                    </td>
                                                    {canManage && (
                                                        <td className="px-4 py-3 whitespace-nowrap text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                                {canEdit && (
                                                                    <button onClick={() => handleEditPayment(p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><EditIcon className="w-4 h-4" /></button>
                                                                )}
                                                                {canDelete && (
                                                                    <button onClick={() => handleDeletePayment(p)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile View */}
                    <div className="md:hidden space-y-3">
                        {isLoading ? (
                            <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm text-gray-400">
                                Loading payments...
                            </div>
                        ) : filteredPayments.length === 0 ? (
                            <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm text-gray-400 italic text-sm">
                                No payment records found.
                            </div>
                        ) : (
                            filteredPayments.map((p, idx) => {
                                const lc = lcs.find(l => l.lcNo === p.lcNo);
                                const isExpanded = expandedPaymentIdx === idx;
                                return (
                                    <div key={p._id} className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-blue-200 shadow-md ring-1 ring-blue-50' : 'border-gray-100 shadow-sm hover:border-gray-200'}`}>
                                        {/* Card Toggle Header */}
                                        <div
                                            className="flex justify-between items-center p-4 cursor-pointer select-none active:bg-gray-50 transition-colors"
                                            onClick={() => setExpandedPaymentIdx(isExpanded ? null : idx)}
                                        >
                                            <div className="flex-1 min-w-0 pr-4">
                                                <div className="flex items-center gap-1.5 text-xs text-left min-w-0 overflow-hidden flex-wrap">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">
                                                        {formatDate(p.date)}
                                                    </span>
                                                    <span className="text-gray-300 font-bold shrink-0">•</span>
                                                    <span className="font-bold text-gray-800 truncate max-w-[120px] shrink-0" title={p.companyName}>
                                                        {p.companyName}
                                                    </span>
                                                    <span className="text-gray-300 font-bold shrink-0">•</span>
                                                    <span className="text-gray-500 font-medium truncate max-w-[80px] shrink-0">
                                                        {p.method}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {p.isAdjustReturn ? (
                                                    <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border bg-blue-50 text-blue-600 border-blue-100/50">
                                                        Adjust
                                                    </span>
                                                ) : p.type === 'Return Collection' ? (
                                                    <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-600 border-emerald-100/50">
                                                        Return
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border bg-rose-50 text-rose-600 border-rose-100/50">
                                                        Paid
                                                    </span>
                                                )}
                                                {isExpanded ? (
                                                    <ChevronUpIcon className="w-4 h-4 text-gray-400" />
                                                ) : (
                                                    <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Expandable Details */}
                                        {isExpanded && (
                                            <div className="px-4 pb-4 pt-1 space-y-2 bg-gray-50/30 border-t border-gray-100/50 text-xs text-left animate-in slide-in-from-top-4 duration-300">
                                                <div className="grid grid-cols-[125px_8px_1fr] gap-y-2 pt-3 text-xs items-baseline">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">LC No</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-semibold text-gray-700 uppercase truncate text-[11px]">{p.lcNo || '-'}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reference</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-semibold text-gray-700 text-[11px] truncate max-w-[150px]" title={p.reference}>{p.reference || '-'}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Gross Premium</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-bold text-blue-600 text-[11px]">
                                                        {lc ? `৳${(parseFloat(lc.grossPremium) || 0).toLocaleString('en-IN')}` : '-'}
                                                    </span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Return Amount</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-bold text-indigo-600 text-[11px]">
                                                        {(p.isAdjustReturn || p.type === 'Return Collection')
                                                            ? (lc ? `৳${(parseFloat(lc.expectedReturnAmount) || 0).toLocaleString('en-IN')}` : '-')
                                                            : '৳0'}
                                                    </span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Paid</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-bold text-gray-700 text-[11px]">
                                                        {p.type === 'Return Collection' ? '৳0' : `৳${p.amount.toLocaleString('en-IN')}`}
                                                    </span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Adjusted</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-bold text-rose-600 text-[11px]">
                                                        {p.adjustedAmount > 0 ? `৳${p.adjustedAmount.toLocaleString('en-IN')}` : '-'}
                                                    </span>

                                                    {canManage && (
                                                        <div className="col-span-3 flex gap-2 pt-3 mt-1 border-t border-gray-100 w-full">
                                                            {canEdit && (
                                                                <button
                                                                    onClick={() => handleEditPayment(p)}
                                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs active:scale-95 transition-all"
                                                                >
                                                                    <EditIcon className="w-3.5 h-3.5" /> Edit
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDeletePayment(p)}
                                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-xs active:scale-95 transition-all"
                                                                >
                                                                    <TrashIcon className="w-3.5 h-3.5" /> Delete
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => !isSubmitting && setShowDeleteConfirm(false)} />
                    <div className="relative bg-white w-full max-w-[340px] rounded-[2.5rem] shadow-2xl p-8 text-center animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-12 shadow-inner">
                            <TrashIcon className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2">Delete Payment?</h3>
                        <p className="text-gray-500 mb-8 text-sm leading-relaxed px-2">
                            This action will permanently remove this record from the system. This cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl transition-all hover:bg-gray-200 active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={isSubmitting}
                                className="flex-1 py-4 bg-gradient-to-br from-red-500 to-red-600 text-white font-bold rounded-2xl shadow-xl shadow-red-200 transition-all hover:shadow-red-300 active:scale-95 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>

                        {submitStatus === 'success' && (
                            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300 z-50">
                                <div className="w-20 h-20 bg-green-50 text-green-500 rounded-3xl flex items-center justify-center mb-4 animate-bounce">
                                    <CheckIcon className="w-10 h-10" />
                                </div>
                                <h4 className="text-2xl font-black text-gray-900">Deleted!</h4>
                                <p className="text-gray-500">Record removed successfully.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default InsurancePayment;
