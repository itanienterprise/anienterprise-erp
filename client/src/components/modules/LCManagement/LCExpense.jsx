import React, { useState, useEffect } from 'react';
import axios from '../../../utils/api';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import { PlusIcon, SearchIcon, EditIcon, TrashIcon, XIcon, CalendarIcon, DollarSignIcon, FileTextIcon, FunnelIcon, ChevronDownIcon, ChevronUpIcon } from '../../Icons';
import CustomDatePicker from '../../shared/CustomDatePicker';

const LCExpense = ({ currentUser, addNotification, onDeleteConfirm, refreshKey }) => {
    const isIncharge = (currentUser?.role || '').toLowerCase() === 'incharge';
    const [expenses, setExpenses] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedExpenseIdx, setExpandedExpenseIdx] = useState(null);

    // For dropdowns
    const [lcs, setLcs] = useState([]);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const lcRef = React.useRef(null);
    const expenseHeadRef = React.useRef(null);

    const initialFilterDropdownState = {
        lcNo: false,
        expenseHead: false
    };

    const initialExpenseFilterState = {
        startDate: '',
        endDate: '',
        lcNo: '',
        expenseHead: ''
    };

    const [expenseFilters, setExpenseFilters] = useState(initialExpenseFilterState);
    const [showExpenseFilterPanel, setShowExpenseFilterPanel] = useState(false);
    const [filterSearchInputs, setFilterSearchInputs] = useState({
        lcSearch: '',
        expenseHeadSearch: ''
    });
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(initialFilterDropdownState);

    const expenseFilterPanelRef = React.useRef(null);
    const expenseFilterButtonRef = React.useRef(null);
    const lcFilterRef = React.useRef(null);
    const expenseHeadFilterRef = React.useRef(null);

    const initialFormData = {
        date: '',
        lcNo: '',
        bankName: '',
        expenseHead: '',
        cnfAgent: '',
        amount: '',
        remarks: ''
    };
    const [formData, setFormData] = useState(initialFormData);

    const getBillValue = () => {
        if (!formData.lcNo || !formData.expenseHead) return '';
        const selectedLc = lcs.find(l => l.lcNo === formData.lcNo);
        if (!selectedLc) return '';

        const cleanLc = (val) => String(val || '').replace(/\D/g, '');
        const lcNoClean = cleanLc(selectedLc.lcNo);
        const head = formData.expenseHead;

        let totalBill = 0;
        let totalPaid = 0;

        if (head === 'Margin Bill') {
            const isAdj = !!selectedLc.enableValueQtyAdjustment;
            const origMarginBill = isAdj && selectedLc.adjustedTotalAmount !== undefined
                ? (parseFloat(selectedLc.marginBill) || parseFloat(selectedLc.adjustedTotalAmount) || 0)
                : (parseFloat(selectedLc.marginBill) || parseFloat(selectedLc.totalAmount) || 0);

            const amendments = Array.isArray(selectedLc.amendments) ? selectedLc.amendments : [];
            const amndMarginBillTotal = amendments.reduce((sum, amnd) => {
                if (amnd.amendmentNo === 'Original LC') return sum;
                return sum + (parseFloat(amnd.amendmentMarginBill) || 0);
            }, 0);

            // Fetch any custom registered bills (type === 'bill')
            const customMarginBills = expenses
                .filter(e => cleanLc(e.lcNo) === lcNoClean && e.expenseHead === 'Margin Bill' && e.type === 'bill')
                .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

            totalBill = origMarginBill + amndMarginBillTotal + customMarginBills;

            // Compute paid margin bill
            const origMarginPaid = isAdj && selectedLc.adjustedTotalAmount !== undefined
                ? (parseFloat(selectedLc.marginPaid) || (origMarginBill * ((parseFloat(selectedLc.bankMargin) || 0) / 100)))
                : (parseFloat(selectedLc.marginPaid) || (origMarginBill * ((parseFloat(selectedLc.bankMargin) || 0) / 100)));

            const amndMarginPaidTotal = amendments.reduce((sum, amnd) => {
                if (amnd.amendmentNo === 'Original LC') return sum;
                const amndMarginBill = parseFloat(amnd.amendmentMarginBill) || 0;
                const amndMargin = amnd.amendmentMargin !== undefined ? (parseFloat(amnd.amendmentMargin) || 0) : (parseFloat(selectedLc.bankMargin) || 0);
                const amndMarginPaid = parseFloat(amnd.amendmentMarginPaid) || (amndMarginBill * (amndMargin / 100));
                return sum + amndMarginPaid;
            }, 0);

            // Fetch any payments from expenses (type !== bill)
            const marginExpPaid = expenses
                .filter(e => cleanLc(e.lcNo) === lcNoClean && e.expenseHead === 'Margin Bill' && e.type !== 'bill' && (!isEditMode || e._id !== editingId))
                .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

            totalPaid = origMarginPaid + amndMarginPaidTotal + marginExpPaid;
        } else if (head === 'Bank Charges') {
            const isNewBilling = selectedLc.marginPaid !== undefined || selectedLc.marginBill !== undefined;
            const origBankBill = isNewBilling 
                ? (parseFloat(selectedLc.bankBill) || 0) 
                : (parseFloat(selectedLc.totalBankBill || selectedLc.bankBill) || 0);

            const amendments = Array.isArray(selectedLc.amendments) ? selectedLc.amendments : [];
            const amndBankBillTotal = amendments.reduce((sum, amnd) => {
                if (amnd.amendmentNo === 'Original LC') return sum;
                const isAmndNewBilling = amnd.amendmentMarginPaid !== undefined || amnd.amendmentMarginBill !== undefined;
                const amndBankBill = isAmndNewBilling
                    ? (parseFloat(amnd.amendmentBankBill) || 0)
                    : (parseFloat(amnd.totalAmendmentBankBill || amnd.amendmentBill || amnd.amendmentBankBill) || 0);
                return sum + amndBankBill;
            }, 0);

            // Fetch any custom registered bills (type === 'bill')
            const customBankBills = expenses
                .filter(e => cleanLc(e.lcNo) === lcNoClean && e.expenseHead === 'Bank Charges' && e.type === 'bill')
                .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

            totalBill = origBankBill + amndBankBillTotal + customBankBills;

            // Fetch any payments from expenses (type !== bill)
            const bankChargePaid = expenses
                .filter(e => cleanLc(e.lcNo) === lcNoClean && e.expenseHead === 'Bank Charges' && e.type !== 'bill' && (!isEditMode || e._id !== editingId))
                .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

            totalPaid = bankChargePaid;
        } else if (head === 'C&F Commission') {
            // Find all stock arrivals for this LC with C&F info
            const cnfArrivals = stocks.filter(s => {
                const recordLcNoClean = cleanLc(s.lcNo);
                const status = (s.status || '').toLowerCase();
                return recordLcNoClean === lcNoClean && (status === 'accepted' || status === 'in stock') && s.bdCnF;
            });

            const cnfAgentClean = String(formData.cnfAgent || '').toLowerCase().trim();
            const filteredArrivals = cnfAgentClean 
                ? cnfArrivals.filter(s => s.bdCnF.toLowerCase().trim() === cnfAgentClean)
                : cnfArrivals;

            const amndCnfBillTotal = filteredArrivals.reduce((sum, s) => sum + (parseFloat(s.bdCnFCost) || 0), 0);

            // Fetch any custom registered bills (type === 'bill')
            const customCnfBills = expenses
                .filter(e => {
                    const matchesLc = cleanLc(e.lcNo) === lcNoClean;
                    const matchesHead = e.expenseHead === 'C&F Commission';
                    const matchesAgent = !cnfAgentClean || String(e.cnfAgent || '').toLowerCase().trim() === cnfAgentClean;
                    return matchesLc && matchesHead && e.type === 'bill' && matchesAgent;
                })
                .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

            totalBill = amndCnfBillTotal + customCnfBills;

            // Fetch C&F payments from expenses
            const cnfExpPaid = expenses
                .filter(e => {
                    const matchesLc = cleanLc(e.lcNo) === lcNoClean;
                    const matchesHead = e.expenseHead === 'C&F Commission';
                    const matchesAgent = !cnfAgentClean || String(e.cnfAgent || '').toLowerCase().trim() === cnfAgentClean;
                    return matchesLc && matchesHead && e.type !== 'bill' && matchesAgent && (!isEditMode || e._id !== editingId);
                })
                .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

            totalPaid = cnfExpPaid;
        } else if (head.toLowerCase().includes('insurance')) {
            const insBillAmt = parseFloat(selectedLc.grossPremium || selectedLc.netPremium) || 0;

            // Fetch any custom registered bills (type === 'bill')
            const customInsBills = expenses
                .filter(e => cleanLc(e.lcNo) === lcNoClean && e.expenseHead.toLowerCase().includes('insurance') && e.type === 'bill')
                .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

            totalBill = insBillAmt + customInsBills;

            // Fetch paid amount from insurancePayments
            const insPaidAmt = insurancePayments
                .filter(p => cleanLc(p.lcNo) === lcNoClean && p.type !== 'Return Collection')
                .reduce((sum, p) => sum + (parseFloat(p.amount) || 0) + (parseFloat(p.adjustedAmount) || 0), 0);

            // Fetch any payments from expenses (type !== bill)
            const insExpPaid = expenses
                .filter(e => cleanLc(e.lcNo) === lcNoClean && e.expenseHead.toLowerCase().includes('insurance') && e.type !== 'bill' && (!isEditMode || e._id !== editingId))
                .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

            totalPaid = insPaidAmt + insExpPaid;
        } else {
            // For any other expense head, the bills are custom registered bills (type === 'bill')
            const customBills = expenses
                .filter(e => cleanLc(e.lcNo) === lcNoClean && e.expenseHead.toLowerCase().trim() === head.toLowerCase().trim() && e.type === 'bill')
                .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

            totalBill = customBills;

            // Payments are custom registered payments (type !== 'bill')
            const customPayments = expenses
                .filter(e => cleanLc(e.lcNo) === lcNoClean && e.expenseHead.toLowerCase().trim() === head.toLowerCase().trim() && e.type !== 'bill' && (!isEditMode || e._id !== editingId))
                .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

            totalPaid = customPayments;
        }

        const unpaidVal = Math.max(0, totalBill - totalPaid);
        return `৳${unpaidVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    };

    const expenseHeads = [
        "Bank Charges",
        "Margin Bill",
        "Customs Duty",
        "C&F Commission",
        "Port Demurrage",
        "Transport Cost",
        "Other"
    ];

    const [bdCnfs, setBdCnfs] = useState([]);
    const [stocks, setStocks] = useState([]);
    const [insurancePayments, setInsurancePayments] = useState([]);
    const cnfAgentRef = React.useRef(null);

    useEffect(() => {
        fetchExpenses();
        fetchLCs();
        fetchCnfs();
        fetchStocks();
        fetchInsurancePayments();
        setExpandedExpenseIdx(null);
    }, [refreshKey]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (lcRef.current && !lcRef.current.contains(event.target) &&
                expenseHeadRef.current && !expenseHeadRef.current.contains(event.target) &&
                (!cnfAgentRef.current || !cnfAgentRef.current.contains(event.target))) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Click-outside detection for expense filter panel
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                showExpenseFilterPanel &&
                expenseFilterPanelRef.current &&
                !expenseFilterPanelRef.current.contains(event.target) &&
                expenseFilterButtonRef.current &&
                !expenseFilterButtonRef.current.contains(event.target)
            ) {
                setShowExpenseFilterPanel(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showExpenseFilterPanel]);

    // Click-outside detection for filter dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
            const openKey = Object.keys(filterDropdownOpen).find(key => filterDropdownOpen[key]);
            if (!openKey) return;

            let refsToCheck = [];
            if (openKey === 'lcNo') {
                refsToCheck = [lcFilterRef];
            } else if (openKey === 'expenseHead') {
                refsToCheck = [expenseHeadFilterRef];
            }

            const isOutside = refsToCheck.every(ref => !ref.current || !ref.current.contains(event.target));
            if (isOutside) {
                setFilterDropdownOpen(initialFilterDropdownState);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [filterDropdownOpen]);

    const getFilteredOptions = (type) => {
        let options = [];
        let search = '';

        switch (type) {
            case 'expenseFilterLc':
                options = [...new Set(expenses.map(e => (e.lcNo || '').trim()).filter(Boolean))].sort();
                search = filterSearchInputs.lcSearch;
                break;
            case 'expenseFilterHead':
                options = [...new Set(expenses.map(e => (e.expenseHead || '').trim()).filter(Boolean))].sort();
                search = filterSearchInputs.expenseHeadSearch;
                break;
            default:
                return [];
        }

        return options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
    };

    const handleDropdownKeyDown = (e, list, field) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev < list.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
            e.preventDefault();
            const selected = list[highlightedIndex];

            if (field === 'lcNo') {
                setFormData(prev => ({
                    ...prev,
                    lcNo: selected.value,
                    bankName: selected.bankName || ''
                }));
            } else {
                setFormData(prev => ({ ...prev, [field]: selected.value || selected }));
            }
            setActiveDropdown(null);
        } else if (e.key === 'Escape') {
            setActiveDropdown(null);
        }
    };

    const fetchExpenses = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/lc-expenses`);
            setExpenses(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching LC Expenses:', error);
            addNotification?.('Failed to load expenses', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLCs = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/lc-management`);
            setLcs(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching LCs:', error);
        }
    };

    const fetchCnfs = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/cnfs`);
            const bdAgents = Array.isArray(response.data) ? response.data.filter(c => c.type !== 'Indian') : [];
            const agentNames = Array.from(new Set(bdAgents.map(a => a.name).filter(Boolean)));
            setBdCnfs(agentNames);
        } catch (error) {
            console.error('Error fetching C&F Agents:', error);
        }
    };

    const fetchStocks = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/stock`);
            setStocks(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching Stocks:', error);
        }
    };

    const fetchInsurancePayments = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/insurance-payments`);
            setInsurancePayments(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching Insurance Payments:', error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const dataToSubmit = {
                ...formData,
                amount: parseFloat(formData.amount) || 0
            };

            if (isEditMode && editingId) {
                await axios.put(`${API_BASE_URL}/api/lc-expenses/${editingId}`, dataToSubmit);
                addNotification?.('Expense updated successfully', 'success');
            } else {
                await axios.post(`${API_BASE_URL}/api/lc-expenses`, dataToSubmit);
                addNotification?.('Expense added successfully', 'success');
            }
            fetchExpenses();
            closeModal();
        } catch (error) {
            console.error('Error saving LC Expense:', error);
            addNotification?.('Failed to save expense', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (expense) => {
        setFormData({
            date: expense.date || '',
            lcNo: expense.lcNo || '',
            bankName: expense.bankName || '',
            expenseHead: expense.expenseHead || '',
            cnfAgent: expense.cnfAgent || '',
            amount: expense.amount || '',
            remarks: expense.remarks || ''
        });
        setEditingId(expense._id);
        setIsEditMode(true);
        setShowAddModal(true);
    };

    const handleDelete = (id) => {
        if (isIncharge) {
            alert('Forbidden: Incharge users cannot delete LC expenses');
            return;
        }
        onDeleteConfirm({ show: true, type: 'lc-expense', id, isBulk: false });
    };

    const closeModal = () => {
        setShowAddModal(false);
        setIsEditMode(false);
        setEditingId(null);
        setFormData(initialFormData);
        setExpandedExpenseIdx(null);
    };

    const filteredExpenses = expenses.filter(exp => {
        if (exp.type === 'bill') return false;

        // Search Query Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesSearch = (exp.lcNo || '').toLowerCase().includes(query) ||
                (exp.expenseHead || '').toLowerCase().includes(query);
            if (!matchesSearch) return false;
        }

        // Advanced Filters
        if (expenseFilters.startDate && exp.date && exp.date < expenseFilters.startDate) return false;
        if (expenseFilters.endDate && exp.date && exp.date > expenseFilters.endDate) return false;

        if (expenseFilters.lcNo && (exp.lcNo || '').trim().toLowerCase() !== expenseFilters.lcNo.toLowerCase()) return false;
        if (expenseFilters.expenseHead && (exp.expenseHead || '').trim().toLowerCase() !== expenseFilters.expenseHead.toLowerCase()) return false;

        return true;
    });

    const totalAmount = filteredExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {!showAddModal ? (
                    <>
                        <div className="w-full md:w-auto text-center md:text-left">
                            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">LC Expense</h2>
                        </div>
                        <div className="w-full max-w-md mx-auto relative group px-2 md:px-0">
                            <div className="absolute inset-y-0 left-0 pl-12 md:pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search expenses..."
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setExpandedExpenseIdx(null); }}
                                className="block w-full pl-10 pr-4 py-2.5 md:py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                            />
                        </div>
                    </>
                ) : (
                    <div className="hidden md:block md:flex-1"></div>
                )}

                {!showAddModal && (
                    <div className="flex items-center justify-center md:justify-end gap-2 w-full md:w-auto z-[60]">
                        {/* Filter Button & Panel */}
                        <div className="relative">
                            <button
                                ref={expenseFilterButtonRef}
                                onClick={() => setShowExpenseFilterPanel(!showExpenseFilterPanel)}
                                className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all border h-[40px] ${showExpenseFilterPanel || Object.values(expenseFilters).some(v => v !== '') ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                <FunnelIcon className={`w-4 h-4 ${(showExpenseFilterPanel || (expenseFilters && Object.values(expenseFilters).some(v => v !== ''))) ? 'text-white' : 'text-gray-400'}`} />
                                <span className="text-sm font-medium">Filter</span>
                            </button>

                            {/* Floating Filter Panel */}
                            {showExpenseFilterPanel && expenseFilters && (
                                <div ref={expenseFilterPanelRef} className="fixed inset-x-4 top-24 md:absolute md:inset-auto md:right-0 md:mt-3 w-auto md:w-[400px] bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[60] p-4 md:p-6 animate-in fade-in zoom-in duration-200 text-left">
                                    <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-50">
                                        <h4 className="font-extrabold text-gray-900 text-lg">Advance Filter</h4>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setExpenseFilters(initialExpenseFilterState);
                                                setFilterSearchInputs({
                                                    lcSearch: '',
                                                    expenseHeadSearch: ''
                                                });
                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                setShowExpenseFilterPanel(false);
                                            }}
                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest"
                                        >
                                            RESET ALL
                                        </button>
                                    </div>

                                    <div className="space-y-5">
                                        {/* Date Range Row */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <CustomDatePicker
                                                label="From Date"
                                                value={expenseFilters.startDate}
                                                onChange={(e) => setExpenseFilters({ ...expenseFilters, startDate: e.target.value })}
                                                compact={true}
                                            />
                                            <CustomDatePicker
                                                label="To Date"
                                                value={expenseFilters.endDate}
                                                onChange={(e) => setExpenseFilters({ ...expenseFilters, endDate: e.target.value })}
                                                compact={true}
                                                rightAlign={true}
                                            />
                                        </div>

                                        {/* LC No Filter */}
                                        <div className="space-y-1.5 relative" ref={lcFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">LC No</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.lcSearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, lcSearch: e.target.value });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, lcNo: true });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, lcNo: true })}
                                                    placeholder={expenseFilters.lcNo || "Search LC No..."}
                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${expenseFilters.lcNo ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {expenseFilters.lcNo && (
                                                        <button type="button" onClick={() => { setExpenseFilters({ ...expenseFilters, lcNo: '' }); setFilterSearchInputs({ ...filterSearchInputs, lcSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.lcNo && (() => {
                                                const filtered = getFilteredOptions('expenseFilterLc') || [];
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                        {filtered.map(opt => (
                                                            <button key={opt} type="button" onClick={() => { setExpenseFilters({ ...expenseFilters, lcNo: opt }); setFilterSearchInputs({ ...filterSearchInputs, lcSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium">{opt}</button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        {/* Expense Head Filter */}
                                        <div className="space-y-1.5 relative" ref={expenseHeadFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Expense Head</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.expenseHeadSearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, expenseHeadSearch: e.target.value });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, expenseHead: true });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, expenseHead: true })}
                                                    placeholder={expenseFilters.expenseHead || "Search Expense Head..."}
                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${expenseFilters.expenseHead ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {expenseFilters.expenseHead && (
                                                        <button type="button" onClick={() => { setExpenseFilters({ ...expenseFilters, expenseHead: '' }); setFilterSearchInputs({ ...filterSearchInputs, expenseHeadSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.expenseHead && (() => {
                                                const filtered = getFilteredOptions('expenseFilterHead') || [];
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                        {filtered.map(opt => (
                                                            <button key={opt} type="button" onClick={() => { setExpenseFilters({ ...expenseFilters, expenseHead: opt }); setFilterSearchInputs({ ...filterSearchInputs, expenseHeadSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium">{opt}</button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setShowAddModal(true)}
                            className="w-full md:w-auto px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 md:hover:scale-105 flex items-center justify-center whitespace-nowrap h-[40px]"
                        >
                            <PlusIcon className="w-5 h-5 mr-2" />
                            <span>Add Expense</span>
                        </button>
                    </div>
                )}
            </div>

            {!showAddModal && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white rounded-2xl p-3 md:p-5 border border-gray-100 shadow-sm flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                                <p className="text-[9px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Expenses</p>
                                <h3 className="text-base md:text-2xl font-black text-gray-800">{filteredExpenses.length}</h3>
                            </div>
                            <div className="w-9 h-9 md:w-12 md:h-12 bg-blue-50 rounded-xl hidden md:flex items-center justify-center shrink-0">
                                <FileTextIcon className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-3 md:p-5 border border-gray-100 shadow-sm flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                                <p className="text-[9px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Amount</p>
                                <h3 className="text-sm sm:text-base md:text-2xl font-black text-rose-600">৳{totalAmount.toLocaleString('en-IN')}</h3>
                            </div>
                            <div className="w-9 h-9 md:w-12 md:h-12 bg-rose-50 rounded-xl hidden md:flex items-center justify-center shrink-0">
                                <DollarSignIcon className="w-5 h-5 md:w-6 md:h-6 text-rose-600" />
                            </div>
                        </div>
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block bg-white/70 backdrop-blur-sm rounded-3xl border border-white/60 shadow-sm overflow-hidden overflow-x-auto transition-all duration-500">
                        <table className="w-full text-left min-w-[1000px]">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Date</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">LC No</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Expense Head</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">Amount</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center text-nowrap">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {isLoading ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-400">Loading expenses...</td></tr>
                                ) : filteredExpenses.length === 0 ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-400">No expenses found.</td></tr>
                                ) : (
                                    filteredExpenses.map((exp) => (
                                        <tr key={exp._id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 group">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{formatDate(exp.date)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{exp.lcNo || '-'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">{exp.expenseHead}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-gray-900 text-right">
                                                ৳{parseFloat(exp.amount || 0).toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleEdit(exp)}
                                                        className="p-2 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-xl transition-all active:scale-90"
                                                        title="Edit Expense"
                                                    >
                                                        <EditIcon className="w-4 h-4" />
                                                    </button>
                                                    {!isIncharge && (
                                                        <button
                                                            onClick={() => handleDelete(exp._id)}
                                                            className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-xl transition-all active:scale-90"
                                                            title="Delete Expense"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card List View */}
                    <div className="md:hidden space-y-3">
                        {isLoading ? (
                            <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm text-gray-400">
                                Loading expenses...
                            </div>
                        ) : filteredExpenses.length === 0 ? (
                            <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm text-gray-400 italic text-sm">
                                No expenses found.
                            </div>
                        ) : (
                            filteredExpenses.map((exp, idx) => {
                                const isExpanded = expandedExpenseIdx === idx;
                                return (
                                    <div key={exp._id} className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-blue-200 shadow-md ring-1 ring-blue-50' : 'border-gray-100 shadow-sm hover:border-gray-200'}`}>
                                        {/* Card Toggle Header */}
                                        <div
                                            className="flex justify-between items-center p-4 cursor-pointer select-none active:bg-gray-50 transition-colors"
                                            onClick={() => setExpandedExpenseIdx(isExpanded ? null : idx)}
                                        >
                                            <div className="flex-1 min-w-0 pr-4">
                                                <div className="flex items-center gap-1.5 text-xs text-left min-w-0 overflow-hidden flex-wrap">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">
                                                        {formatDate(exp.date)}
                                                    </span>
                                                    <span className="text-gray-300 font-bold shrink-0">•</span>
                                                    <span className="font-bold text-gray-800 truncate max-w-[120px] shrink-0" title={exp.lcNo}>
                                                        {exp.lcNo || '-'}
                                                    </span>
                                                    <span className="text-gray-300 font-bold shrink-0">•</span>
                                                    <span className="text-blue-600 font-medium truncate max-w-[120px] shrink-0">
                                                        {exp.expenseHead}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-xs font-black text-gray-900">
                                                    ৳{parseFloat(exp.amount || 0).toLocaleString('en-IN')}
                                                </span>
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
                                                    <span className="font-semibold text-gray-700 text-[11px] truncate max-w-[180px]">{exp.lcNo || '-'}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Expense Head</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-semibold text-blue-600 text-[11px] truncate max-w-[180px]">{exp.expenseHead}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bank Name</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-semibold text-gray-700 text-[11px] truncate max-w-[180px]">{exp.bankName || '-'}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">C&F Agent</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-semibold text-gray-700 text-[11px] truncate max-w-[180px]">{exp.cnfAgent || '-'}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Amount</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-black text-gray-900 text-[11px]">
                                                        ৳{parseFloat(exp.amount || 0).toLocaleString('en-IN')}
                                                    </span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Remarks</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-semibold text-gray-600 text-[11px] break-words">{exp.remarks || '-'}</span>

                                                    <div className="col-span-3 flex gap-2 pt-3 mt-1 border-t border-gray-100 w-full">
                                                        <button
                                                            onClick={() => handleEdit(exp)}
                                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs active:scale-95 transition-all"
                                                        >
                                                            <EditIcon className="w-3.5 h-3.5" /> Edit
                                                        </button>
                                                        <button
                                                            onClick={() => !isIncharge && handleDelete(exp._id)}
                                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-xs active:scale-95 transition-all ${isIncharge ? 'hidden' : ''}`}
                                                        >
                                                            <TrashIcon className="w-3.5 h-3.5" /> Delete
                                                        </button>
                                                    </div>
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

            {/* In-Line Registration Form */}
            {showAddModal && (
                <div className="lc-form-container relative overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl p-5 md:p-8 animate-in slide-in-from-top-4 duration-300">

                    <div className="flex items-center justify-between mb-6 md:mb-8 relative z-10">
                        <div>
                            <h3 className="text-lg md:text-xl font-semibold text-gray-800">
                                {isEditMode ? 'Edit LC Expense' : 'Add New LC Expense'}
                            </h3>
                            <p className="text-[11px] text-blue-500 font-bold uppercase tracking-widest mt-1">
                                Expense Details
                            </p>
                        </div>
                        <button
                            onClick={closeModal}
                            className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all group active:scale-95"
                            title="Close Form"
                        >
                            <XIcon className="w-5 h-5 text-gray-400 group-hover:text-rose-500" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="relative z-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                            <div className="space-y-1.5 text-left">
                                <CustomDatePicker
                                    label="Date"
                                    value={formData.date}
                                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                    compact={true}
                                    required
                                />
                            </div>

                            <div className="space-y-1.5 text-left relative" ref={lcRef}>
                                <label className="text-sm font-semibold text-gray-600 ml-1">LC No <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={formData.lcNo}
                                        onChange={(e) => {
                                            setFormData(prev => ({ ...prev, lcNo: e.target.value }));
                                            setActiveDropdown('lcNo');
                                            setHighlightedIndex(-1);
                                        }}
                                        onFocus={() => { setActiveDropdown('lcNo'); setHighlightedIndex(-1); }}
                                        onKeyDown={(e) => {
                                            const filtered = lcs.filter(lc => !formData.lcNo || lc.lcNo.toLowerCase().includes(formData.lcNo.toLowerCase()));
                                            handleDropdownKeyDown(e, filtered.map(lc => ({ value: lc.lcNo, bankName: lc.bankName })), 'lcNo');
                                        }}
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                        required
                                        placeholder="Search LC No"
                                        autoComplete="nope"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                        {formData.lcNo && (
                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, lcNo: '' }))} className="text-gray-400 hover:text-gray-600">
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        <SearchIcon className="w-4 h-4 text-gray-300" />
                                    </div>
                                </div>
                                {activeDropdown === 'lcNo' && (
                                    <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1">
                                        {lcs.filter(lc => !formData.lcNo || lc.lcNo.toLowerCase().includes(formData.lcNo.toLowerCase())).map((lc, idx) => (
                                            <button
                                                key={lc._id}
                                                type="button"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        lcNo: lc.lcNo,
                                                        bankName: lc.bankName || ''
                                                    }));
                                                    setActiveDropdown(null);
                                                }}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'
                                                    }`}
                                            >
                                                <span className="font-bold">{lc.lcNo}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1.5 text-left relative" ref={expenseHeadRef}>
                                <label className="text-sm font-semibold text-gray-600 ml-1">Expense Head <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={formData.expenseHead}
                                        onChange={(e) => {
                                            setFormData(prev => ({ ...prev, expenseHead: e.target.value }));
                                            setActiveDropdown('expenseHead');
                                            setHighlightedIndex(-1);
                                        }}
                                        onFocus={() => { setActiveDropdown('expenseHead'); setHighlightedIndex(-1); }}
                                        onKeyDown={(e) => {
                                            const filtered = expenseHeads.filter(head => !formData.expenseHead || head.toLowerCase().includes(formData.expenseHead.toLowerCase()));
                                            handleDropdownKeyDown(e, filtered, 'expenseHead');
                                        }}
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                        required
                                        placeholder="Search Expense Head"
                                        autoComplete="nope"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                        {formData.expenseHead && (
                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, expenseHead: '' }))} className="text-gray-400 hover:text-gray-600">
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        <SearchIcon className="w-4 h-4 text-gray-300" />
                                    </div>
                                </div>
                                {activeDropdown === 'expenseHead' && (
                                    <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1">
                                        {expenseHeads.filter(head => !formData.expenseHead || head.toLowerCase().includes(formData.expenseHead.toLowerCase())).map((head, idx) => (
                                            <button
                                                key={head}
                                                type="button"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    setFormData(prev => ({ ...prev, expenseHead: head }));
                                                    setActiveDropdown(null);
                                                }}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'
                                                    }`}
                                            >
                                                <span className="font-medium">{head}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {(formData.expenseHead === 'Bank Charges' || formData.expenseHead === 'Margin Bill') && (
                                <div className="space-y-1.5 text-left animate-in fade-in zoom-in duration-300">
                                    <label className="text-sm font-semibold text-gray-600 ml-1">Bank Name</label>
                                    <input
                                        type="text"
                                        value={formData.bankName}
                                        readOnly
                                        className="w-full px-4 py-2.5 bg-gray-50/80 border border-gray-200/60 rounded-xl outline-none transition-all font-semibold text-gray-500 cursor-not-allowed"
                                        placeholder="Auto-filled from LC"
                                    />
                                </div>
                            )}

                            {formData.expenseHead === 'C&F Commission' && (
                                <div className="space-y-1.5 text-left relative animate-in fade-in zoom-in duration-300" ref={cnfAgentRef}>
                                    <label className="text-sm font-semibold text-gray-600 ml-1">C&F Agent (BD) <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={formData.cnfAgent}
                                            onChange={(e) => {
                                                setFormData(prev => ({ ...prev, cnfAgent: e.target.value }));
                                                setActiveDropdown('cnfAgent');
                                                setHighlightedIndex(-1);
                                            }}
                                            onFocus={() => { setActiveDropdown('cnfAgent'); setHighlightedIndex(-1); }}
                                            onKeyDown={(e) => {
                                                const filtered = bdCnfs.filter(cnf => !formData.cnfAgent || cnf.toLowerCase().includes(formData.cnfAgent.toLowerCase()));
                                                handleDropdownKeyDown(e, filtered, 'cnfAgent');
                                            }}
                                            className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                            required={formData.expenseHead === 'C&F Commission'}
                                            placeholder="Search C&F Agent"
                                            autoComplete="nope"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                            {formData.cnfAgent && (
                                                <button type="button" onClick={() => setFormData(prev => ({ ...prev, cnfAgent: '' }))} className="text-gray-400 hover:text-gray-600">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <SearchIcon className="w-4 h-4 text-gray-300" />
                                        </div>
                                    </div>
                                    {activeDropdown === 'cnfAgent' && (
                                        <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1">
                                            {bdCnfs.filter(cnf => !formData.cnfAgent || cnf.toLowerCase().includes(formData.cnfAgent.toLowerCase())).map((cnf, idx) => (
                                                <button
                                                    key={cnf}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setFormData(prev => ({ ...prev, cnfAgent: cnf }));
                                                        setActiveDropdown(null);
                                                    }}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'
                                                        }`}
                                                >
                                                    <span className="font-medium">{cnf}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {formData.expenseHead && formData.lcNo && (
                                <div className="space-y-1.5 text-left animate-in fade-in zoom-in duration-300">
                                    <label className="text-sm font-semibold text-gray-600 ml-1">Unpaid Value</label>
                                    <input
                                        type="text"
                                        value={getBillValue()}
                                        readOnly
                                        className="w-full px-4 py-2.5 bg-gray-50/80 border border-gray-200/60 rounded-xl outline-none transition-all font-bold text-gray-500 cursor-not-allowed"
                                        placeholder="Auto-filled from LC"
                                    />
                                </div>
                            )}

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Amount (৳) <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    name="amount"
                                    value={formData.amount}
                                    onChange={handleInputChange}
                                    required
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold"
                                />
                            </div>
                        </div>

                        <div className="mb-8 space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">Remarks</label>
                            <textarea
                                name="remarks"
                                value={formData.remarks}
                                onChange={handleInputChange}
                                placeholder="Optional details..."
                                rows="2"
                                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium min-h-[100px]"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-50 mt-6 relative z-10">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all text-sm flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isSubmitting ? 'Processing...' : isEditMode ? (
                                    <>Update Record</>
                                ) : (
                                    <><PlusIcon className="w-4 h-4" /> Save Expense</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default LCExpense;
