import React, { useState, useEffect, useRef } from 'react';
import { SearchIcon, FunnelIcon, DollarSignIcon, EyeIcon, PlusIcon, XIcon, ChevronDownIcon, TrashIcon, EditIcon, UserIcon, BarChartIcon, CalendarIcon, CheckIcon } from '../../Icons';
import { API_BASE_URL, formatDate, SortIcon } from '../../../utils/helpers';
import { decryptData, encryptData } from '../../../utils/encryption';
import CustomDatePicker from '../../shared/CustomDatePicker';
import axios from '../../../utils/api';

const CnFPayment = () => {
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

    // Edit States
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingPayment, setEditingPayment] = useState(null);

    // Filter States
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const initialFilterState = {
        startDate: '',
        endDate: '',
        method: '',
        cnfName: '',
        cnfType: ''
    };
    const [filters, setFilters] = useState(initialFilterState);
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(null);
    const [filterSearchInputs, setFilterSearchInputs] = useState({ cnfName: '', method: '' });

    const filterPanelRef = useRef(null);
    const filterButtonRef = useRef(null);

    // New Payment States
    const [showAddModal, setShowAddModal] = useState(false);
    const [cnfs, setCnfs] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [paymentToDelete, setPaymentToDelete] = useState(null);
    const [cnfSearchQuery, setCnfSearchQuery] = useState('');
    const [expandedCard, setExpandedCard] = useState(null);
    const cnfDropdownRef = useRef(null);
    const methodDropdownRef = useRef(null);
    const bankDropdownRef = useRef(null);
    const [banks, setBanks] = useState([]);

    const [newPayment, setNewPayment] = useState({
        cnfId: '',
        date: new Date().toISOString().split('T')[0],
        method: 'Cash',
        amount: '',
        discount: '',
        reference: '',
        bankName: '',
        remarks: ''
    });

    useEffect(() => {
        fetchPayments();
        fetchCnFs();
    }, []);

    const fetchCnFs = async () => {
        try {
            const [cnfsRes, stockRes, salesRes, paymentsRes, expenseRes, banksRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/cnfs`),
                axios.get(`${API_BASE_URL}/api/stock`),
                axios.get(`${API_BASE_URL}/api/sales`),
                axios.get(`${API_BASE_URL}/api/cnf-payments`),
                axios.get(`${API_BASE_URL}/api/lc-expenses`),
                axios.get(`${API_BASE_URL}/api/banks`)
            ]);

            const allCnfs = Array.isArray(cnfsRes.data) ? cnfsRes.data : [];
            const allStock = Array.isArray(stockRes.data) ? stockRes.data : [];
            const allSales = Array.isArray(salesRes.data) ? salesRes.data : [];
            const allPayments = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
            const allExpenses = Array.isArray(expenseRes.data) ? expenseRes.data : [];
            const allBanks = Array.isArray(banksRes.data) ? banksRes.data : [];

            setBanks(allBanks);

            const cnfsWithBalance = allCnfs.map(cnf => {
                const targetName = (cnf.name || '').toLowerCase().trim();

                // 1. Earned from Stock (LC Arrivals)
                const stockEarned = allStock.reduce((acc, record) => {
                    const recordIndCnF = (record.indianCnF || '').toLowerCase().trim();
                    const recordBdCnF = (record.bdCnF || '').toLowerCase().trim();

                    const isMatch = cnf.type === 'Indian'
                        ? recordIndCnF === targetName
                        : cnf.type === 'BD'
                            ? recordBdCnF === targetName
                            : (recordIndCnF === targetName || recordBdCnF === targetName);

                    if (isMatch) {
                        const status = (record.status || '').toLowerCase();
                        if (status.includes('requested') || status.includes('rejected')) return acc;

                        if (recordIndCnF === targetName && record.indCnFCost !== undefined && record.indCnFCost !== null && record.indCnFCost !== '') {
                            return acc + (parseFloat(record.indCnFCost) || 0);
                        } else if (recordBdCnF === targetName && record.bdCnFCost !== undefined && record.bdCnFCost !== null && record.bdCnFCost !== '') {
                            return acc + (parseFloat(record.bdCnFCost) || 0);
                        }

                        let commission = parseFloat(cnf.commission) || 0;
                        if (recordIndCnF === targetName && record.indCnFComm !== undefined && record.indCnFComm !== null && record.indCnFComm !== '') {
                            commission = parseFloat(record.indCnFComm);
                        } else if (recordBdCnF === targetName && record.bdCnFComm !== undefined && record.bdCnFComm !== null && record.bdCnFComm !== '') {
                            commission = parseFloat(record.bdCnFComm);
                        }

                        const rawUom = recordIndCnF === targetName
                            ? (record.indCnFUom || record.uom || cnf.uom || cnf.commissionType || 'QTY')
                            : (record.bdCnFUom || record.uom || cnf.uom || cnf.commissionType || 'QTY');
                        const uom = typeof rawUom === 'string' ? rawUom.toUpperCase() : 'QTY';

                        if (uom === 'QTY') {
                            const qty = !isNaN(parseFloat(record.totalLcQuantity)) ? parseFloat(record.totalLcQuantity) : (!isNaN(parseFloat(record.quantity)) ? parseFloat(record.quantity) : (parseFloat(record.inHouseQuantity) || 0));
                            return acc + (qty * commission);
                        } else if (uom === 'BAG') {
                            const bag = !isNaN(parseFloat(record.totalLcPacket)) ? parseFloat(record.totalLcPacket) : (!isNaN(parseFloat(record.packet)) ? parseFloat(record.packet) : (parseFloat(record.inHousePacket) || 0));
                            return acc + (bag * commission);
                        } else if (uom === 'TRUCK') {
                            const truckCount = !isNaN(parseFloat(record.totalLcTruck)) ? parseFloat(record.totalLcTruck) : (parseFloat(record.truckNo) || 1);
                            return acc + (truckCount * commission);
                        } else {
                            return acc + commission;
                        }
                    }
                    return acc;
                }, 0);

                // 2. Earned from Border Sales
                const salesEarned = allSales.reduce((acc, sale) => {
                    const sTypeLow = (sale.saleType || '').toLowerCase().trim();
                    const isBorder = sTypeLow === 'border' || sTypeLow === 'border sale' || (sale.invoiceNo || '').startsWith('BS');
                    if (!isBorder) return acc;

                    // Skip rejected sales
                    if (sale.status && sale.status.toLowerCase().includes('rejected')) return acc;

                    const saleIndCnF = (sale.indianCnF || '').toLowerCase().trim();
                    const saleBdCnf = (sale.bdCnf || '').toLowerCase().trim();

                    const isMatch = cnf.type === 'Indian'
                        ? saleIndCnF === targetName
                        : cnf.type === 'BD'
                            ? saleBdCnf === targetName
                            : (saleIndCnF === targetName || saleBdCnf === targetName);

                    if (isMatch) {
                        let totalSaleComm = 0;
                        const isIndian = cnf.type === 'Indian' || (saleIndCnF === targetName);

                        if (isIndian && sale.indCommissionTotal) {
                            totalSaleComm = parseFloat(sale.indCommissionTotal) || 0;
                        } else if (!isIndian && sale.bdCommissionTotal) {
                            totalSaleComm = parseFloat(sale.bdCommissionTotal) || 0;
                        } else {
                            // Fallback to default calculation if no sale-specific commission exists
                            const commissionFactor = parseFloat(cnf.commission) || 0;
                            const uom = (typeof cnf.uom === 'string' ? cnf.uom : (cnf.commissionType || 'QTY')).toUpperCase();

                            (sale.items || []).forEach(item => {
                                (item.brandEntries || []).forEach(entry => {
                                    if (uom === 'QTY') {
                                        totalSaleComm += (parseFloat(entry.quantity) || 0) * commissionFactor;
                                    } else if (uom === 'TRUCK') {
                                        totalSaleComm += (parseFloat(entry.truck) || 1) * commissionFactor;
                                    } else {
                                        totalSaleComm += commissionFactor;
                                    }
                                });
                            });
                        }
                        return acc + totalSaleComm;
                    }
                    return acc;
                }, 0);

                // 3. Subtract Payments (including discount)
                const paid = allPayments.reduce((acc, payment) => {
                    if (payment.cnfId === cnf._id) {
                        return acc + (parseFloat(payment.amount) || 0) + (parseFloat(payment.discount) || 0);
                    }
                    return acc;
                }, 0);

                // 4. Earned from LC Expenses
                const expenseEarned = allExpenses.reduce((acc, exp) => {
                    const expCnF = (exp.cnfAgent || '').toLowerCase().trim();
                    if (expCnF === targetName && exp.type === 'bill') {
                        return acc + (parseFloat(exp.amount) || 0);
                    }
                    return acc;
                }, 0);

                return { ...cnf, totalBalance: stockEarned + salesEarned + expenseEarned - paid };
            });

            setCnfs(cnfsWithBalance);
        } catch (error) {
            console.error('Error fetching C&Fs:', error);
        }
    };

    const fetchPayments = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/cnf-payments`);
            setPayments(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching C&F payments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Click outside listener for dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target && !document.body.contains(event.target)) return;
            if (!activeDropdown) return;

            if (activeDropdown === 'cnf' && cnfDropdownRef.current && !cnfDropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
            if (activeDropdown === 'method' && methodDropdownRef.current && !methodDropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
            if (activeDropdown === 'bank' && bankDropdownRef.current && !bankDropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown]);

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
    };

    const resetFilters = () => {
        setFilters(initialFilterState);
        setFilterSearchInputs({ cnfName: '', method: '' });
        setSearchQuery('');
    };

    const uniqueMethods = ["Cash", "Bank Transfer", "Online Banking", "Mobile Banking", "Cheque", "Other"];
    const uniqueCnfNames = [...new Set(cnfs.map(c => c.name).filter(Boolean))].sort();

    const handleAddPayment = async (e) => {
        e.preventDefault();
        if (!newPayment.cnfId || !newPayment.amount || parseFloat(newPayment.amount) <= 0) return;

        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const selectedCnf = cnfs.find(c => c._id === newPayment.cnfId);
            const paymentData = {
                ...newPayment,
                cnfName: selectedCnf?.name,
                cnfType: selectedCnf?.type,
                amount: parseFloat(newPayment.amount),
                discount: parseFloat(newPayment.discount || 0)
            };

            if (isEditMode) {
                await axios.put(`${API_BASE_URL}/api/cnf-payments/${editingPayment._id}`, paymentData);
            } else {
                await axios.post(`${API_BASE_URL}/api/cnf-payments`, paymentData);
            }

            setSubmitStatus('success');
            fetchPayments();
            setTimeout(() => {
                setShowAddModal(false);
                setSubmitStatus(null);
                resetNewPayment();
            }, 1500);
        } catch (error) {
            console.error('Error saving C&F payment:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetNewPayment = () => {
        setNewPayment({
            cnfId: '',
            date: new Date().toISOString().split('T')[0],
            method: 'Cash',
            amount: '',
            discount: '',
            reference: '',
            bankName: '',
            remarks: ''
        });
        setCnfSearchQuery('');
        setIsEditMode(false);
        setEditingPayment(null);
    };

    const handleEditPayment = (payment) => {
        setIsEditMode(true);
        setEditingPayment(payment);
        setNewPayment({
            cnfId: payment.cnfId,
            date: payment.date,
            method: payment.method,
            amount: payment.amount.toString(),
            discount: (payment.discount || 0).toString(),
            reference: payment.reference || '',
            bankName: payment.bankName || '',
            remarks: payment.remarks || ''
        });
        const cnf = cnfs.find(c => c._id === payment.cnfId);
        setCnfSearchQuery(cnf?.name || '');
        setShowAddModal(true);
    };

    const handleDeletePayment = (payment) => {
        setPaymentToDelete(payment);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!paymentToDelete) return;
        setIsSubmitting(true);
        try {
            await axios.delete(`${API_BASE_URL}/api/cnf-payments/${paymentToDelete._id}`);
            setSubmitStatus('success');
            setTimeout(() => {
                setShowDeleteConfirm(false);
                setPaymentToDelete(null);
                setSubmitStatus(null);
                fetchPayments();
            }, 1000);
        } catch (error) {
            console.error('Error deleting C&F payment:', error);
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

    const toggleCard = (id) => {
        setExpandedCard(prev => prev === id ? null : id);
    };

    const filteredPayments = payments.filter(p => {
        const matchSearch = !searchQuery ||
            (p.cnfName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.method || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.reference || '').toLowerCase().includes(searchQuery.toLowerCase());

        const matchStartDate = !filters.startDate || p.date >= filters.startDate;
        const matchEndDate = !filters.endDate || p.date <= filters.endDate;
        const matchMethod = !filters.method || p.method === filters.method;
        const matchCnfName = !filters.cnfName || p.cnfName === filters.cnfName;
        const matchCnfType = !filters.cnfType || p.cnfType === filters.cnfType;

        return matchSearch && matchStartDate && matchEndDate && matchMethod && matchCnfName && matchCnfType;
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
    const totalDiscount = filteredPayments.reduce((sum, p) => sum + (p.discount || 0), 0);
    const transactionCount = filteredPayments.length;

    return (
        <div className="space-y-6">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="text-center md:text-left w-full md:w-auto">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800">C&F Payment</h2>
                </div>

                {!showAddModal && (
                    <div className="flex-1 w-full max-w-md mx-auto relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by C&F, method, reference..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
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
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">C&F Name</label>
                                                <button
                                                    onClick={() => setFilterDropdownOpen(filterDropdownOpen === 'cnfName' ? null : 'cnfName')}
                                                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm"
                                                >
                                                    <span className="truncate">{filters.cnfName || 'All C&Fs'}</span>
                                                    <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                                </button>
                                                {filterDropdownOpen === 'cnfName' && (
                                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                                                        <button onClick={() => handleFilterChange('cnfName', '')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">All C&Fs</button>
                                                        {uniqueCnfNames.map(name => (
                                                            <button key={name} onClick={() => handleFilterChange('cnfName', name)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">{name}</button>
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
                    {!showAddModal && (
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
                        <div className="px-8 py-6 border-b border-gray-100/50 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 tracking-tight">{isEditMode ? 'Edit C&F Payment' : 'New C&F Payment'}</h3>
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">C&F Financial Record</p>
                            </div>
                            <button onClick={() => { setShowAddModal(false); resetNewPayment(); }} className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-90">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAddPayment} className="p-8 space-y-6">
                            {/* Row 1: Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-gray-50">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Payment Date</label>
                                    <CustomDatePicker value={newPayment.date} onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })} compact />
                                </div>

                                <div className="space-y-1.5 relative">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">C&F Agent</label>
                                    <div ref={cnfDropdownRef} className="relative group">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search C&F..."
                                                value={activeDropdown === 'cnf' ? cnfSearchQuery : (cnfs.find(c => c._id === newPayment.cnfId)?.name || '')}
                                                onChange={(e) => {
                                                    setCnfSearchQuery(e.target.value);
                                                    if (activeDropdown !== 'cnf') setActiveDropdown('cnf');
                                                }}
                                                onFocus={() => {
                                                    setActiveDropdown('cnf');
                                                    setCnfSearchQuery('');
                                                }}
                                                className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none pr-10 font-medium text-gray-900"
                                            />
                                            <SearchIcon className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${activeDropdown === 'cnf' ? 'text-blue-500' : 'text-gray-400'}`} />
                                        </div>
                                        {activeDropdown === 'cnf' && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[110] max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 border-t-0 py-1">
                                                {cnfs.filter(c => c.name.toLowerCase().includes(cnfSearchQuery.toLowerCase())).length > 0 ? (
                                                    cnfs.filter(c => c.name.toLowerCase().includes(cnfSearchQuery.toLowerCase())).map(c => (
                                                        <button
                                                            key={c._id}
                                                            type="button"
                                                            onClick={() => { 
                                                                setNewPayment({ ...newPayment, cnfId: c._id }); 
                                                                setActiveDropdown(null); 
                                                                setCnfSearchQuery(c.name);
                                                            }}
                                                            className="w-full px-5 py-3 text-left text-sm hover:bg-blue-50 transition-colors flex items-center justify-between group"
                                                        >
                                                            <div>
                                                                <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{c.name}</div>
                                                                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{c.cnfId || c.type}</div>
                                                            </div>
                                                            {newPayment.cnfId === c._id && <CheckIcon className="w-4 h-4 text-blue-600" />}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="px-5 py-8 text-center text-gray-400">
                                                        <BoxIcon className="w-8 h-8 mb-2 mx-auto opacity-20" />
                                                        <p className="text-xs font-medium">No matching agent found</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Current Balance</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <span className="text-gray-400 font-bold text-sm">৳</span>
                                        </div>
                                        <input
                                            type="text"
                                            readOnly
                                            value={newPayment.cnfId ? (cnfs.find(c => c._id === newPayment.cnfId)?.totalBalance || 0).toLocaleString('en-IN') : '0.00'}
                                            className={`w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black shadow-sm outline-none cursor-not-allowed transition-colors ${newPayment.cnfId ? ((cnfs.find(c => c._id === newPayment.cnfId)?.totalBalance || 0) > 0 ? 'text-amber-600' : 'text-emerald-600') : 'text-gray-400'}`}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Payment Details */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

                                {['Bank Transfer', 'Online Banking', 'Cheque'].includes(newPayment.method) ? (
                                    <div className="space-y-1.5 relative">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Select Bank</label>
                                        <div ref={bankDropdownRef} className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setActiveDropdown(activeDropdown === 'bank' ? null : 'bank')}
                                                className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                            >
                                                <span className="truncate">{newPayment.bankName || 'Select Bank'}</span>
                                                <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                            </button>
                                            {activeDropdown === 'bank' && (
                                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[110] py-1 animate-in fade-in slide-in-from-top-2 duration-200 max-h-48 overflow-y-auto">
                                                    {banks.map(b => (
                                                        <button
                                                            key={b._id}
                                                            type="button"
                                                            onClick={() => { setNewPayment({ ...newPayment, bankName: b.bankName }); setActiveDropdown(null); }}
                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
                                                        >
                                                            <span className={newPayment.bankName === b.bankName ? 'font-bold text-blue-600' : 'text-gray-700'}>{b.bankName}</span>
                                                            {newPayment.bankName === b.bankName && <CheckIcon className="w-3.5 h-3.5 text-blue-600" />}
                                                        </button>
                                                    ))}
                                                    {banks.length === 0 && <div className="px-4 py-2 text-xs text-gray-400">No banks found</div>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Reference / Note</label>
                                        <input
                                            type="text"
                                            value={newPayment.reference}
                                            onChange={(e) => setNewPayment({ ...newPayment, reference: e.target.value })}
                                            placeholder="Cheque No, Txn ID, or any reference..."
                                            className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                )}

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
                                            className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-bold shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Discount (৳)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <span className="text-gray-400 font-bold text-sm">৳</span>
                                        </div>
                                        <input
                                            type="number"
                                            value={newPayment.discount}
                                            onChange={(e) => setNewPayment({ ...newPayment, discount: e.target.value })}
                                            placeholder="0.00"
                                            className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-bold shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Total Paid */}
                        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-blue-100 group">
                            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                                <div className="p-1.5 sm:p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <DollarSignIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Paid</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl sm:text-2xl font-black text-gray-900">৳{totalPaid.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="text-[9px] sm:text-[10px] text-gray-400 mt-1 italic">Across filtered records</div>
                        </div>

                        {/* Total Discount */}
                        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-emerald-100 group">
                            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                                <div className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                    <DollarSignIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Discount</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl sm:text-2xl font-black text-gray-900">৳{totalDiscount.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="text-[9px] sm:text-[10px] text-gray-400 mt-1 italic">Across filtered records</div>
                        </div>

                        {/* Transactions */}
                        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-indigo-100 group col-span-2 md:col-span-1">
                            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                                <div className="p-1.5 sm:p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    <BarChartIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Transactions</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl sm:text-2xl font-black text-gray-900">{transactionCount}</span>
                                <span className="text-xs font-bold text-gray-400 ml-1">Entries</span>
                            </div>
                            <div className="text-[9px] sm:text-[10px] text-gray-400 mt-1 italic">Total entries</div>
                        </div>
                    </div>



                    {/* Table Section */}
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                        {/* ─── Desktop Table (md and above) ─── */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50/50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('date')}>
                                            <div className="flex items-center gap-1">
                                                <span>Date</span>
                                                <SortIcon config={sortConfig} columnKey="date" />
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('cnfName')}>
                                            <div className="flex items-center gap-1">
                                                <span>C&F Agent</span>
                                                <SortIcon config={sortConfig} columnKey="cnfName" />
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider">Type</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider">Method</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Reference / Bank</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('amount')}>
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Amount</span>
                                                <SortIcon config={sortConfig} columnKey="amount" />
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">Discount</th>
                                        {isAdmin && <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-center">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {isLoading ? (
                                        <tr><td colSpan={isAdmin ? 8 : 7} className="px-4 py-12 text-center text-gray-400">Loading payments...</td></tr>
                                    ) : filteredPayments.length === 0 ? (
                                        <tr><td colSpan={isAdmin ? 8 : 7} className="px-4 py-12 text-center text-gray-400">No payment records found.</td></tr>
                                    ) : (
                                        filteredPayments.map((p) => (
                                            <tr key={p._id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDate(p.date)}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="font-bold text-gray-900">{p.cnfName}</div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-500">{p.cnfType}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-500">{p.method}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-500">{p.bankName || p.reference || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right font-black text-gray-900">৳{p.amount.toLocaleString('en-IN')}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-emerald-600">
                                                    {p.discount > 0 ? `৳${p.discount.toLocaleString('en-IN')}` : '-'}
                                                </td>
                                                {isAdmin && (
                                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button onClick={() => handleEditPayment(p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><EditIcon className="w-4 h-4" /></button>
                                                            <button onClick={() => handleDeletePayment(p)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* ─── Mobile Cards (below md) ─── */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {isLoading ? (
                                <div className="px-4 py-12 text-center text-gray-400">Loading payments...</div>
                            ) : filteredPayments.length === 0 ? (
                                <div className="px-4 py-12 text-center text-gray-400">No payment records found.</div>
                            ) : (
                                filteredPayments.map((p) => {
                                    const isExpanded = expandedCard === p._id;
                                    return (
                                        <div key={p._id} className="p-5 bg-white hover:bg-gray-50 transition-all cursor-pointer" onClick={() => toggleCard(p._id)}>
                                            <div className="flex flex-col gap-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2 overflow-hidden mr-2">
                                                            <div className="text-base md:text-lg font-black text-gray-900 truncate tracking-tight">{p.cnfName}</div>
                                                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">{p.cnfType}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-base md:text-lg font-black text-gray-900">৳{p.amount.toLocaleString('en-IN')}</div>
                                                            {p.discount > 0 && <div className="text-[10px] font-bold text-emerald-600 leading-none">(-৳{p.discount.toLocaleString('en-IN')})</div>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                                            <CalendarIcon className="w-3.5 h-3.5" />
                                                            {formatDate(p.date)}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                            {p.method}
                                                        </div>
                                                    </div>
                                                </div>

                                                {isExpanded && (
                                                    <div className="mt-5 pt-5 border-t border-gray-100 space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <div className="grid grid-cols-[140px_8px_1fr] gap-y-2 text-xs items-baseline text-left">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Payment Method</span>
                                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                            <span className="font-semibold text-gray-900 text-[11px]">{p.method}</span>

                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Agent Type</span>
                                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                            <span className="font-semibold text-gray-900 text-[11px] uppercase">{p.cnfType}</span>

                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reference / Bank</span>
                                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                            <span className="font-semibold text-gray-800 text-[11px] leading-relaxed">{p.bankName || p.reference || '-'}</span>

                                                            {p.discount > 0 && (
                                                                <>
                                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Discount Given</span>
                                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                    <span className="font-bold text-emerald-600 text-[11px] italic">৳{p.discount.toLocaleString('en-IN')}</span>
                                                                </>
                                                            )}

                                                            {p.remarks && (
                                                                <>
                                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Remarks</span>
                                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                    <span className="text-gray-600 text-[11px] leading-relaxed italic">{p.remarks}</span>
                                                                </>
                                                            )}
                                                        </div>

                                                    {/* Action Buttons in Expanded View */}
                                                    {isAdmin && (
                                                        <div className="flex items-center gap-3 pt-2">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleEditPayment(p); }}
                                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-black transition-all active:scale-95"
                                                            >
                                                                <EditIcon className="w-4 h-4" />
                                                                <span>EDIT RECORD</span>
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeletePayment(p); }}
                                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-black transition-all active:scale-95"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                                <span>DELETE</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
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

export default CnFPayment;
