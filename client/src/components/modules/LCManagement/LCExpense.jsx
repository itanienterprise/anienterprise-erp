import React, { useState, useEffect } from 'react';
import axios from '../../../utils/api';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import { PlusIcon, SearchIcon, EditIcon, TrashIcon, XIcon, CalendarIcon, DollarSignIcon, FileTextIcon } from '../../Icons';
import CustomDatePicker from '../../shared/CustomDatePicker';

const LCExpense = ({ currentUser, addNotification, onDeleteConfirm, refreshKey }) => {
    const [expenses, setExpenses] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // For dropdowns
    const [lcs, setLcs] = useState([]);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const lcRef = React.useRef(null);
    const expenseHeadRef = React.useRef(null);

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
    const cnfAgentRef = React.useRef(null);
    const [stockRecords, setStockRecords] = useState([]);

    useEffect(() => {
        fetchExpenses();
        fetchLCs();
        fetchCnfs();
        fetchStockRecords();
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

    const fetchStockRecords = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/stock`);
            setStockRecords(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching stock records:', error);
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
        onDeleteConfirm({ show: true, type: 'lc-expense', id, isBulk: false });
    };

    const closeModal = () => {
        setShowAddModal(false);
        setIsEditMode(false);
        setEditingId(null);
        setFormData(initialFormData);
    };

    const combinedExpenses = React.useMemo(() => {
        const list = [...expenses.filter(e => e.type !== 'bill')];
        
        lcs.forEach(data => {
            const marginPaidAmt = parseFloat(data.marginPaid) || (() => {
                const total = parseFloat(data.totalAmount) || 0;
                const margin = parseFloat(data.bankMargin) || 0;
                return total * (margin / 100);
            })();
            if (marginPaidAmt > 0) {
                list.push({
                    _id: `margin-paid-virtual-${data._id || data.lcNo}`,
                    date: data.openingDate || data.createdAt,
                    lcNo: data.lcNo,
                    expenseHead: `Margin Paid (${data.bankMargin || 0}%)`,
                    bankName: data.bankName || 'Bank',
                    amount: marginPaidAmt,
                    remarks: 'Paid Margin',
                    isVirtual: true
                });
            }

            if (data.amendments && data.amendments.length > 0) {
                data.amendments.forEach((amnd, idx) => {
                    if (amnd.amendmentNo === 'Original LC') return;
                    const margin = amnd.amendmentMargin !== undefined ? (parseFloat(amnd.amendmentMargin) || 0) : (data.bankMargin !== undefined ? parseFloat(data.bankMargin) : 0);
                    const amndMarginPaid = parseFloat(amnd.amendmentMarginPaid) || (() => {
                        const amndMarginBill = parseFloat(amnd.amendmentMarginBill) || 0;
                        return amndMarginBill * (margin / 100);
                    })();
                    if (amndMarginPaid > 0) {
                        list.push({
                            _id: `amnd-margin-paid-virtual-${data._id || data.lcNo}-\idx}`.replace('idx', idx),
                            date: amnd.amendmentDate || data.openingDate,
                            lcNo: data.lcNo,
                            expenseHead: `Margin Paid (${margin}%) (${amnd.amendmentNo || `Amend #${idx + 1}`})`,
                            bankName: data.bankName || 'Bank',
                            amount: amndMarginPaid,
                            remarks: `Paid Margin for ${amnd.amendmentNo || `Amend #${idx + 1}`}`,
                            isVirtual: true
                        });
                    }
                });
            }
        });

        return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [expenses, lcs]);

    const filteredExpenses = combinedExpenses.filter(exp => {
        const query = searchQuery.toLowerCase();
        return (
            (exp.lcNo || '').toLowerCase().includes(query) ||
            (exp.expenseHead || '').toLowerCase().includes(query)
        );
    });

    const totalAmount = filteredExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

    const getCalculatedTotalBill = () => {
        if (!formData.lcNo || !formData.expenseHead) return 0;
        
        const selectedLc = lcs.find(lc => lc.lcNo === formData.lcNo);
        if (!selectedLc) return 0;

        const head = formData.expenseHead;
        if (!head) return 0;

        if (head === 'Bank Charges') {
            const originalBankBill = parseFloat(selectedLc.bankBill) || 0;
            const amendmentsBankBill = selectedLc.amendments ? selectedLc.amendments.reduce((sum, amnd) => {
                return sum + (parseFloat(amnd.amendmentBankBill) || 0);
            }, 0) : 0;
            const customBankBills = expenses
                .filter(exp => exp.lcNo === formData.lcNo && exp.expenseHead === 'Bank Charges' && exp.type === 'bill')
                .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
            const totalBankBill = originalBankBill + amendmentsBankBill + customBankBills;

            // Subtract already registered bank charges (excluding current record being edited)
            const registeredBankCharges = expenses
                .filter(exp => exp.lcNo === formData.lcNo && exp.expenseHead === 'Bank Charges' && exp._id !== editingId && exp.type !== 'bill')
                .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

            return Math.max(0, totalBankBill - registeredBankCharges);
        }

        if (head === 'Margin Bill') {
            const originalMarginBill = parseFloat(selectedLc.marginBill || selectedLc.totalAmount || 0);
            const amendmentsMarginBill = selectedLc.amendments ? selectedLc.amendments.reduce((sum, amnd) => {
                if (amnd.amendmentNo === 'Original LC') return sum;
                return sum + (parseFloat(amnd.amendmentMarginBill) || 0);
            }, 0) : 0;
            const customMarginBills = expenses
                .filter(exp => exp.lcNo === formData.lcNo && exp.expenseHead === 'Margin Bill' && exp.type === 'bill')
                .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
            const totalMarginBill = originalMarginBill + amendmentsMarginBill + customMarginBills;

            const originalMarginPaid = parseFloat(selectedLc.marginPaid) || (() => {
                const total = parseFloat(selectedLc.totalAmount) || 0;
                const margin = parseFloat(selectedLc.bankMargin) || 0;
                return total * (margin / 100);
            })();
            const amendmentsMarginPaid = selectedLc.amendments ? selectedLc.amendments.reduce((sum, amnd) => {
                if (amnd.amendmentNo === 'Original LC') return sum;
                const margin = amnd.amendmentMargin !== undefined ? (parseFloat(amnd.amendmentMargin) || 0) : (selectedLc.bankMargin !== undefined ? parseFloat(selectedLc.bankMargin) : 0);
                const amndMarginPaid = parseFloat(amnd.amendmentMarginPaid) || (() => {
                    const amndMarginBill = parseFloat(amnd.amendmentMarginBill) || 0;
                    return amndMarginBill * (margin / 100);
                })();
                return sum + amndMarginPaid;
            }, 0) : 0;
            const totalMarginPaid = originalMarginPaid + amendmentsMarginPaid;

            // Subtract already registered payments for Margin Bill (excluding current record being edited)
            const registeredPayments = expenses
                .filter(exp => exp.lcNo === formData.lcNo && exp.expenseHead === 'Margin Bill' && exp._id !== editingId && exp.type !== 'bill')
                .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

            return Math.max(0, totalMarginBill - totalMarginPaid - registeredPayments);
        }

        if (head === 'C&F Commission') {
            if (!formData.cnfAgent) return 0;
            const cleanAgent = formData.cnfAgent.toLowerCase().trim();
            const filteredStock = stockRecords.filter(
                record => record.lcNo === formData.lcNo &&
                (record.bdCnF || '').toLowerCase().trim() === cleanAgent
            );
            const customCnfBills = expenses
                .filter(exp => exp.lcNo === formData.lcNo && exp.expenseHead === 'C&F Commission' && exp.cnfAgent && exp.cnfAgent.toLowerCase().trim() === cleanAgent && exp.type === 'bill')
                .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
            const totalCnfBill = filteredStock.reduce((sum, r) => sum + (parseFloat(r.bdCnFCost) || 0), 0) + customCnfBills;

            const registeredCnfPaid = expenses
                .filter(exp => exp.lcNo === formData.lcNo && exp.expenseHead === 'C&F Commission' && exp.cnfAgent && exp.cnfAgent.toLowerCase().trim() === cleanAgent && exp._id !== editingId && exp.type !== 'bill')
                .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

            return Math.max(0, totalCnfBill - registeredCnfPaid);
        }

        // For any other custom heads (e.g. Customs Duty, Port Demurrage, Transport Cost, Other)
        const customBills = expenses
            .filter(exp => exp.lcNo === formData.lcNo && exp.expenseHead === head && exp.type === 'bill')
            .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

        if (customBills > 0) {
            const registeredPayments = expenses
                .filter(exp => exp.lcNo === formData.lcNo && exp.expenseHead === head && exp._id !== editingId && exp.type !== 'bill')
                .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
            return Math.max(0, customBills - registeredPayments);
        }

        return 0;
    };

    const totalBillVal = getCalculatedTotalBill();

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {!showAddModal ? (
                    <>
                        <div className="w-full md:w-1/4 text-center md:text-left">
                            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">LC Expense</h2>
                        </div>
                        <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                            <div className="absolute inset-y-0 left-0 pl-12 md:pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search expenses..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="block w-full pl-10 pr-4 py-2.5 md:py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                            />
                        </div>
                    </>
                ) : (
                    <div className="hidden md:block md:flex-1"></div>
                )}

                {!showAddModal && (
                    <div className="w-full md:w-1/4 flex justify-end gap-3 z-50">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="w-full md:w-auto px-6 py-2.5 md:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 md:hover:scale-105 flex items-center justify-center whitespace-nowrap"
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Expenses</p>
                                <h3 className="text-2xl font-black text-gray-800">{filteredExpenses.length}</h3>
                            </div>
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                                <FileTextIcon className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Amount</p>
                                <h3 className="text-2xl font-black text-rose-600">৳{totalAmount.toLocaleString('en-IN')}</h3>
                            </div>
                            <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center">
                                <DollarSignIcon className="w-6 h-6 text-rose-600" />
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/60 shadow-sm overflow-hidden overflow-x-auto transition-all duration-500">
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
                                                {!exp.isVirtual ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => handleEdit(exp)}
                                                            className="p-2 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-xl transition-all active:scale-90"
                                                            title="Edit Expense"
                                                        >
                                                            <EditIcon className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(exp._id)}
                                                            className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-xl transition-all active:scale-90"
                                                            title="Delete Expense"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-semibold text-gray-400 italic">Read-only</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
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

                            <div key={formData.expenseHead} className="space-y-1.5 text-left animate-in fade-in zoom-in duration-300">
                                <label className="text-sm font-semibold text-gray-600 ml-1">
                                    {(() => {
                                        const head = formData.expenseHead;
                                        if (!head) return 'Total Bill';
                                        
                                        if (head === 'Bank Charges' || head === 'Margin Bill' || head === 'C&F Commission') {
                                            return `${head} Balance`;
                                        }
                                        
                                        const hasBills = expenses.some(exp => exp.lcNo === formData.lcNo && exp.expenseHead === head && exp.type === 'bill');
                                        if (hasBills) {
                                            return `${head} Balance`;
                                        }
                                        
                                        return `Total ${head} Bill`;
                                    })()}
                                </label>
                                <input
                                    type="text"
                                    value={(totalBillVal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    readOnly
                                    className="w-full px-4 py-2.5 bg-gray-50/80 border border-gray-200/60 rounded-xl outline-none transition-all font-bold text-gray-500 cursor-not-allowed"
                                />
                            </div>

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
