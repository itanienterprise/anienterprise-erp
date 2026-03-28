import React, { useState, useEffect, useRef } from 'react';
import { SearchIcon, FunnelIcon, DollarSignIcon, EyeIcon, PlusIcon, XIcon, ChevronDownIcon, TrashIcon, EditIcon, UserIcon, BarChartIcon, CalendarIcon, CheckIcon } from '../../Icons';
import { API_BASE_URL, formatDate, SortIcon } from '../../../utils/helpers';
import { decryptData, encryptData } from '../../../utils/encryption';
import CustomDatePicker from '../../shared/CustomDatePicker';
import axios from '../../../utils/api';
import PaymentCollectionReport from './PaymentCollectionReport';
import './PaymentCollection.css';

const PaymentCollection = () => {
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

    // Filter and Report States
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [showReport, setShowReport] = useState(false);

    const initialFilterState = {
        startDate: '',
        endDate: '',
        method: '',
        bankName: '',
        branch: '',
        customer: ''
    };
    const [filters, setFilters] = useState(initialFilterState);
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(null);
    const [filterSearchInputs, setFilterSearchInputs] = useState({ bankName: '', branch: '', method: '', customer: '' });

    const filterPanelRef = useRef(null);
    const filterButtonRef = useRef(null);

    // New States
    const [showAddModal, setShowAddModal] = useState(false);
    const [expandedMobileCards, setExpandedMobileCards] = useState(null);
    const [rawCustomers, setRawCustomers] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [banks, setBanks] = useState([]);
    const [bankSearchQuery, setBankSearchQuery] = useState('');
    const customerDropdownRef = useRef(null);
    const methodDropdownRef = useRef(null);
    const statusDropdownRef = useRef(null);
    const bankDropdownRef = useRef(null);
    const branchDropdownRef = useRef(null);

    const [newPayment, setNewPayment] = useState({
        customerId: '',
        date: new Date().toISOString().split('T')[0],
        items: [{
            id: Date.now().toString(),
            method: 'Cash',
            bankName: '',
            accountNo: '',
            branch: '',
            receiveBy: '',
            place: '',
            amount: ''
        }],
        status: 'Completed',
        reference: ''
    });

    useEffect(() => {
        fetchPayments();
        fetchBanks();
    }, []);

    const fetchBanks = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/banks`);
            const rawData = Array.isArray(response.data) ? response.data : [];
            // Handle backwards compatibility for single-branch records
            const decryptedBanks = rawData.map(bank => {
                const branches = bank.branches || [{
                    branch: bank.branch,
                    accountName: bank.accountName,
                    accountNo: bank.accountNo
                }];
                return { ...bank, branches };
            });
            setBanks(decryptedBanks);
        } catch (error) {
            console.error('Error fetching banks:', error);
        }
    };

    // Click outside listener for dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target && !document.body.contains(event.target)) {
                return;
            }
            if (!activeDropdown) return;

            // Handle static dropdowns (customer)
            if (activeDropdown === 'customer' && customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
                return;
            }

            // Handle dynamic item dropdowns (method, bank, branch, status)
            const dropdownElement = document.querySelector(`[data-dropdown-id="${activeDropdown}"]`);
            if (dropdownElement && !dropdownElement.contains(event.target)) {
                setActiveDropdown(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target && !document.body.contains(event.target)) {
                return;
            }
            if (showFilterPanel && filterPanelRef.current && filterButtonRef.current) {
                if (!filterPanelRef.current.contains(event.target) && !filterButtonRef.current.contains(event.target)) {
                    // Check if click was inside a dropdown
                    const isDropdownClick = event.target.closest('[data-filter-dropdown]');
                    if (!isDropdownClick) {
                        setShowFilterPanel(false);
                        setFilterDropdownOpen(null);
                    }
                }
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setShowFilterPanel(false);
                setFilterDropdownOpen(null);
            }
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
        setFilterSearchInputs({ bankName: '', branch: '', method: '', customer: '' });
        setSearchQuery('');
    };

    useEffect(() => {
        setFilterSearchInputs({
            bankName: filters.bankName || '',
            branch: filters.branch || '',
            method: filters.method || '',
            customer: filters.customer || ''
        });
    }, [filters, showFilterPanel]);

    // Derived unique options for filters
    const uniqueMethods = ["Cash", "Bank Deposit", "Online Banking", "Mobile Banking", "Cheque"];
    const uniqueBanks = [...new Set(payments.map(p => p.bankName).filter(Boolean))].sort();
    const uniqueBranches = [...new Set(payments.map(p => p.branch).filter(Boolean))].sort();
    const uniqueCustomers = [...new Set(payments.map(p => p.companyName || p.customerName).filter(Boolean))].sort();

    const fetchPayments = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/customers`);
            const rawData = Array.isArray(response.data) ? response.data : [];
            const allPayments = [];
            const customersList = [];

            rawData.forEach(customer => {
                customersList.push(customer);

                const customerHistory = customer.paymentHistory || [];
                customerHistory.forEach(payment => {
                    allPayments.push({
                        ...payment,
                        customerId: customer._id,
                        customerName: customer.customerName,
                        companyName: customer.companyName,
                        readableCustomerId: customer.customerId
                    });
                });
            });

            setPayments(allPayments);
            setRawCustomers(customersList);
        } catch (error) {
            console.error('Error fetching payments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const addPaymentItem = () => {
        setNewPayment(prev => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    id: Date.now().toString(),
                    method: 'Cash',
                    bankName: '',
                    accountNo: '',
                    branch: '',
                    receiveBy: '',
                    place: '',
                    amount: ''
                }
            ]
        }));
    };

    const removePaymentItem = (id) => {
        if (newPayment.items.length <= 1) return;
        setNewPayment(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== id)
        }));
    };

    const updatePaymentItem = (id, updates) => {
        setNewPayment(prev => ({
            ...prev,
            items: prev.items.map(item => item.id === id ? { ...item, ...updates } : item)
        }));
    };

    const handleDeletePayment = async (payment) => {
        if (!window.confirm('Are you sure you want to delete this payment record?')) return;
        try {
            const custRes = await axios.get(`${API_BASE_URL}/api/customers/${payment.customerId}`);
            const customer = custRes.data;
            const updatedHistory = (customer.paymentHistory || []).filter(p => p.id !== payment.id);
            const updatedCustomer = { ...customer, paymentHistory: updatedHistory };
            await axios.put(`${API_BASE_URL}/api/customers/${payment.customerId}`, updatedCustomer);
            fetchPayments();
        } catch (error) {
            console.error('Error deleting payment:', error);
        }
    };

    const handleEditInitiation = (payment) => {
        setIsEditMode(true);
        setEditingPayment(payment);
        setNewPayment({
            customerId: payment.customerId,
            date: payment.date,
            items: [{
                id: payment.id,
                method: payment.method,
                bankName: payment.bankName || '',
                accountNo: payment.accountNo || '',
                branch: payment.branch || '',
                receiveBy: payment.receiveBy || '',
                place: payment.place || '',
                amount: payment.amount.toString()
            }],
            status: payment.status || 'Completed',
            reference: payment.reference || ''
        });
        setCustomerSearchQuery('');
        setShowAddModal(true);
    };

    const handleAddCollection = async (e) => {
        e.preventDefault();
        const totalAmountValue = newPayment.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        if (!newPayment.customerId || totalAmountValue <= 0) return;

        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const custRes = await axios.get(`${API_BASE_URL}/api/customers/${newPayment.customerId}`);
            const customer = custRes.data;

            const paymentEntries = newPayment.items
                .filter(item => parseFloat(item.amount) > 0)
                .map(item => ({
                    date: newPayment.date,
                    method: item.method,
                    bankName: item.bankName,
                    accountNo: item.accountNo,
                    branch: item.branch,
                    amount: parseFloat(item.amount),
                    receiveBy: item.receiveBy,
                    place: item.place,
                    reference: newPayment.reference,
                    status: newPayment.status,
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                }));

            const updatedCustomer = {
                ...customer,
                paymentHistory: [...paymentEntries, ...(customer.paymentHistory || [])]
            };

            await axios.put(`${API_BASE_URL}/api/customers/${newPayment.customerId}`, updatedCustomer);
            setSubmitStatus('success');
            fetchPayments();
            setTimeout(() => {
                setShowAddModal(false);
                setSubmitStatus(null);
                resetNewPayment();
            }, 1500);
        } catch (error) {
            console.error('Error saving collection:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateCollection = async (e) => {
        e.preventDefault();
        const item = newPayment.items[0];
        if (!newPayment.customerId || (parseFloat(item.amount) || 0) <= 0) return;

        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const custRes = await axios.get(`${API_BASE_URL}/api/customers/${newPayment.customerId}`);
            const customer = custRes.data;

            const updatedHistory = (customer.paymentHistory || []).map(p => {
                if (p.id === editingPayment.id) {
                    return {
                        ...p,
                        date: newPayment.date,
                        method: item.method,
                        bankName: item.bankName,
                        accountNo: item.accountNo,
                        branch: item.branch,
                        amount: parseFloat(item.amount),
                        receiveBy: item.receiveBy,
                        place: item.place,
                        reference: newPayment.reference,
                        status: newPayment.status
                    };
                }
                return p;
            });

            const updatedCustomer = { ...customer, paymentHistory: updatedHistory };
            await axios.put(`${API_BASE_URL}/api/customers/${newPayment.customerId}`, updatedCustomer);
            setSubmitStatus('success');
            fetchPayments();
            setTimeout(() => {
                setShowAddModal(false);
                setSubmitStatus(null);
                resetNewPayment();
            }, 1500);
        } catch (error) {
            console.error('Error updating collection:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetNewPayment = () => {
        setNewPayment({
            customerId: '',
            date: new Date().toISOString().split('T')[0],
            items: [{
                id: Date.now().toString(),
                method: 'Cash',
                bankName: '',
                accountNo: '',
                branch: '',
                receiveBy: '',
                place: '',
                amount: ''
            }],
            status: 'Completed',
            reference: ''
        });
        setCustomerSearchQuery('');
        setIsEditMode(false);
        setEditingPayment(null);
    };

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const sortedPayments = [...payments].sort((a, b) => {
        if (sortConfig.key === 'date') {
            return sortConfig.direction === 'desc'
                ? new Date(b.date) - new Date(a.date)
                : new Date(a.date) - new Date(b.date);
        }
        const valA = a[sortConfig.key] || '';
        const valB = b[sortConfig.key] || '';
        if (sortConfig.direction === 'desc') {
            return valB < valA ? -1 : 1;
        }
        return valA < valB ? -1 : 1;
    });

    const filteredPayments = sortedPayments.filter(p => {
        const matchSearch = !searchQuery ||
            (p.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.readableCustomerId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.method || '').toLowerCase().includes(searchQuery.toLowerCase());

        const matchStartDate = !filters.startDate || (p.date && p.date >= filters.startDate);
        const matchEndDate = !filters.endDate || (p.date && p.date <= filters.endDate);
        const matchMethod = !filters.method || ((p.method || '').toLowerCase() === filters.method.toLowerCase());
        const matchBankName = !filters.bankName || ((p.bankName || '').toLowerCase() === filters.bankName.toLowerCase());
        const matchBranch = !filters.branch || ((p.branch || '').toLowerCase() === filters.branch.toLowerCase());
        const matchCustomer = !filters.customer ||
            ((p.customerName || '').toLowerCase().includes(filters.customer.toLowerCase()) ||
                (p.companyName || '').toLowerCase().includes(filters.customer.toLowerCase()));

        return matchSearch && matchStartDate && matchEndDate && matchMethod && matchBankName && matchBranch && matchCustomer;
    });

    const calculateCustomerBalance = (customer) => {
        if (!customer) return 0;
        const totalAmount = (customer.salesHistory || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const totalSalesPaid = (customer.salesHistory || []).reduce((sum, item) => sum + (parseFloat(item.paid) || 0), 0);
        const totalDiscount = (customer.salesHistory || []).reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0);
        const totalHistoryPaid = (customer.paymentHistory || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        return Math.max(0, totalAmount - totalSalesPaid - totalDiscount - totalHistoryPaid);
    };

    const selectedCustomerForBalance = rawCustomers.find(c => c._id === newPayment.customerId);
    const currentBalance = calculateCustomerBalance(selectedCustomerForBalance);
    const totalCollection = newPayment.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalAmountCollected = payments
        .filter(p => p.customerId === newPayment.customerId)
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    return (
        <div className="space-y-6">
            {!showAddModal && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="w-full md:w-auto">
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Payment Collection</h2>
                    </div>

                    {/* Center Aligned Search Bar */}
                    <div className="flex-1 w-full max-w-none md:max-w-md mx-auto relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by customer, company, ID or method..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                        />
                    </div>

                    <div className="w-full md:w-auto flex flex-row items-center justify-between md:justify-end gap-2">
                        {/* Advanced Filter Button & Panel Container */}
                        <div className="relative flex-1 md:flex-none">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all border ${showFilterPanel || Object.values(filters).some(v => v !== '') ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'} h-[42px]`}
                            >
                                <FunnelIcon className={`w-4 h-4 ${(showFilterPanel || Object.values(filters).some(v => v !== '')) ? 'text-white' : 'text-gray-400'}`} />
                                <span className={`text-sm font-medium ${(showFilterPanel || Object.values(filters).some(v => v !== '')) ? 'text-white' : 'text-gray-600'}`}>Filter</span>
                            </button>

                            {/* Advanced Filter Panel */}
                            {showFilterPanel && (
                                <div ref={filterPanelRef} className="fixed inset-x-4 top-[140px] md:absolute md:inset-auto md:right-0 md:mt-3 md:top-auto w-auto md:w-[400px] bg-white border border-gray-200 rounded-2xl shadow-xl z-[60] p-5 opacity-100 scale-100 transform transform-gpu transition-all duration-200 ease-out origin-top-right text-left">
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

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {/* Date Range */}
                                        <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-0.5">Start Date</label>
                                                <div className="relative">
                                                    <CustomDatePicker value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} compact />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-0.5">End Date</label>
                                                <div className="relative">
                                                    <CustomDatePicker value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} compact rightAlign={true} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Method Filter */}
                                        <div className="space-y-1.5 relative" data-filter-dropdown>
                                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-0.5">Method</label>
                                            <button
                                                onClick={() => setFilterDropdownOpen(filterDropdownOpen === 'method' ? null : 'method')}
                                                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-gray-50"
                                            >
                                                <span className={`truncate ${filters.method ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                    {filters.method || 'All Methods'}
                                                </span>
                                                <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${filterDropdownOpen === 'method' ? 'rotate-180' : ''}`} />
                                            </button>

                                            {filterDropdownOpen === 'method' && (
                                                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-60 overflow-y-auto w-full">
                                                    <button
                                                        onClick={() => handleFilterChange('method', '')}
                                                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${!filters.method ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                    >
                                                        All Methods
                                                        {!filters.method && <CheckIcon className="w-4 h-4" />}
                                                    </button>
                                                    {uniqueMethods.map(method => (
                                                        <button
                                                            key={method}
                                                            onClick={() => handleFilterChange('method', method)}
                                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${filters.method === method ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                        >
                                                            {method}
                                                            {filters.method === method && <CheckIcon className="w-4 h-4" />}
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
                                                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-gray-50"
                                            >
                                                <span className={`truncate ${filters.customer ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                    {filters.customer || 'All Customers'}
                                                </span>
                                                <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${filterDropdownOpen === 'customer' ? 'rotate-180' : ''}`} />
                                            </button>

                                            {filterDropdownOpen === 'customer' && (
                                                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-60 flex flex-col w-full">
                                                    <div className="p-2 border-b border-gray-100 sticky top-0 bg-white z-10">
                                                        <div className="relative">
                                                            <SearchIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                                            <input
                                                                type="text"
                                                                placeholder="Search customers..."
                                                                value={filterSearchInputs.customer}
                                                                onChange={(e) => setFilterSearchInputs(p => ({ ...p, customer: e.target.value }))}
                                                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="overflow-y-auto flex-1">
                                                        <button
                                                            onClick={() => handleFilterChange('customer', '')}
                                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${!filters.customer ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                        >
                                                            All Customers
                                                            {!filters.customer && <CheckIcon className="w-4 h-4" />}
                                                        </button>
                                                        {uniqueCustomers.filter(customer => customer.toLowerCase().includes(filterSearchInputs.customer.toLowerCase())).map(customer => (
                                                            <button
                                                                key={customer}
                                                                onClick={() => handleFilterChange('customer', customer)}
                                                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${filters.customer === customer ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                            >
                                                                <span className="truncate">{customer}</span>
                                                                {filters.customer === customer && <CheckIcon className="w-4 h-4 flex-shrink-0" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Bank Name Filter */}
                                        <div className="space-y-1.5 relative" data-filter-dropdown>
                                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-0.5">Bank / Provider</label>
                                            <button
                                                onClick={() => setFilterDropdownOpen(filterDropdownOpen === 'bankName' ? null : 'bankName')}
                                                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-gray-50"
                                            >
                                                <span className={`truncate ${filters.bankName ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                    {filters.bankName || 'All Banks'}
                                                </span>
                                                <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${filterDropdownOpen === 'bankName' ? 'rotate-180' : ''}`} />
                                            </button>

                                            {filterDropdownOpen === 'bankName' && (
                                                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-60 flex flex-col w-full">
                                                    <div className="p-2 border-b border-gray-100 sticky top-0 bg-white z-10">
                                                        <div className="relative">
                                                            <SearchIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                                            <input
                                                                type="text"
                                                                placeholder="Search banks..."
                                                                value={filterSearchInputs.bankName}
                                                                onChange={(e) => setFilterSearchInputs(p => ({ ...p, bankName: e.target.value }))}
                                                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="overflow-y-auto flex-1">
                                                        <button
                                                            onClick={() => handleFilterChange('bankName', '')}
                                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${!filters.bankName ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                        >
                                                            All Banks
                                                            {!filters.bankName && <CheckIcon className="w-4 h-4" />}
                                                        </button>
                                                        {uniqueBanks.filter(bank => bank.toLowerCase().includes(filterSearchInputs.bankName.toLowerCase())).map(bank => (
                                                            <button
                                                                key={bank}
                                                                onClick={() => handleFilterChange('bankName', bank)}
                                                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${filters.bankName === bank ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                            >
                                                                <span className="truncate">{bank}</span>
                                                                {filters.bankName === bank && <CheckIcon className="w-4 h-4 flex-shrink-0" />}
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
                                                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-gray-50"
                                            >
                                                <span className={`truncate ${filters.branch ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                    {filters.branch || 'All Branches'}
                                                </span>
                                                <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${filterDropdownOpen === 'branch' ? 'rotate-180' : ''}`} />
                                            </button>

                                            {filterDropdownOpen === 'branch' && (
                                                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-60 flex flex-col w-full">
                                                    <div className="p-2 border-b border-gray-100 sticky top-0 bg-white z-10">
                                                        <div className="relative">
                                                            <SearchIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                                            <input
                                                                type="text"
                                                                placeholder="Search branches..."
                                                                value={filterSearchInputs.branch}
                                                                onChange={(e) => setFilterSearchInputs(p => ({ ...p, branch: e.target.value }))}
                                                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="overflow-y-auto flex-1">
                                                        <button
                                                            onClick={() => handleFilterChange('branch', '')}
                                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${!filters.branch ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                        >
                                                            All Branches
                                                            {!filters.branch && <CheckIcon className="w-4 h-4" />}
                                                        </button>
                                                        {uniqueBranches.filter(branch => branch.toLowerCase().includes(filterSearchInputs.branch.toLowerCase())).map(branch => (
                                                            <button
                                                                key={branch}
                                                                onClick={() => handleFilterChange('branch', branch)}
                                                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${filters.branch === branch ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                            >
                                                                <span className="truncate">{branch}</span>
                                                                {filters.branch === branch && <CheckIcon className="w-4 h-4 flex-shrink-0" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                    </div>

                                    <div className="mt-6 pt-4 border-t border-gray-50 flex justify-end">
                                        <button
                                            onClick={() => setShowFilterPanel(false)}
                                            className="px-6 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
                                        >
                                            Apply Filters
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Report Button */}
                        <button
                            onClick={() => setShowReport(true)}
                            className="flex-1 md:flex-none w-full md:w-auto flex justify-center items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 h-[42px]"
                        >
                            <BarChartIcon className="w-4 h-4 text-gray-400 hidden sm:block" />
                            <span className="text-sm font-medium">Report</span>
                        </button>

                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex-1 md:flex-none w-full md:w-auto justify-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all transform active:scale-95 flex items-center gap-2 text-sm h-[42px]"
                        >
                            <PlusIcon className="w-4 h-4" /> <span>Add Collection</span>
                        </button>
                    </div>
                </div>
            )}

            {!showAddModal && (
                <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl shadow-sm overflow-hidden">
                    {/* Table Header Row */}
                    <div className="overflow-x-auto">
                        <table className="w-full hidden md:table">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100/50 transition-colors">Date</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100/50 transition-colors">Party</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100/50 transition-colors">Payment Method</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100/50 transition-colors">Bank Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100/50 transition-colors">Branch</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100/50 transition-colors">Account Number</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                                    {isAdmin && (
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100/50 transition-colors">Actions</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {isLoading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={isAdmin ? 8 : 7} className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                                                        <DollarSignIcon className="w-6 h-6 text-blue-500" />
                                                    </div>
                                                    <p className="text-gray-500 font-medium">Loading transaction history...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : filteredPayments.length > 0 ? (
                                    filteredPayments.map((payment, index) => (
                                        <tr key={index} className="hover:bg-gray-50 transition-colors duration-200">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">{formatDate(payment.date)}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{payment.companyName || payment.customerName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{payment.method || '—'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {payment.method === 'Cash' ? (payment.receiveBy || '—') : (payment.bankName || '—')}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {payment.method === 'Cash' ? (payment.place || '—') : (payment.branch || '—')}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 font-mono">{payment.accountNo || '—'}</td>
                                            <td className="px-6 py-4 text-sm font-bold text-blue-600 text-right">
                                                ৳{(payment.amount || 0).toLocaleString()}
                                            </td>
                                            {isAdmin && (
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => handleEditInitiation(payment)}
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Edit Payment"
                                                        >
                                                            <EditIcon className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletePayment(payment)}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete Payment"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={isAdmin ? 8 : 7} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                                                    <SearchIcon className="w-6 h-6 text-gray-400" />
                                                </div>
                                                <p className="text-gray-500 font-medium">No payments found</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* Mobile Card View */}
                        <div className="block md:hidden px-1 py-4 space-y-3">
                            {isLoading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <div key={i} className="animate-pulse bg-white border border-gray-100 rounded-xl p-4 space-y-3">
                                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                                        <div className="h-6 bg-gray-200 rounded w-full"></div>
                                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                                    </div>
                                ))
                            ) : filteredPayments.length > 0 ? (
                                filteredPayments.map((payment, index) => {
                                    const itemId = payment.id || index;
                                    const isExpanded = expandedMobileCards === itemId;
                                    return (
                                        <div 
                                            key={itemId}
                                            className={`mobile-card transition-all duration-300 ${isExpanded ? 'expanded' : 'collapsed'}`}
                                            onClick={() => setExpandedMobileCards(isExpanded ? null : itemId)}
                                        >
                                            <div className="mobile-card-header">
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <div className="mobile-card-title truncate">{payment.companyName || payment.customerName}</div>
                                                    <div className="text-[10px] text-gray-500 truncate mt-0.5">
                                                        {formatDate(payment.date)} | {payment.method || '—'}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    <span className="font-bold text-blue-600">
                                                        ৳{(payment.amount || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {isExpanded && (
                                                <div className="animate-in slide-in-from-top-2 duration-300">
                                                    <div className="space-y-2 mt-4 text-sm">
                                                        <div className="mobile-card-row">
                                                            <span className="mobile-card-label">Method:</span>
                                                            <span className="mobile-card-value">{payment.method || '—'}</span>
                                                        </div>
                                                        <div className="mobile-card-row">
                                                            <span className="mobile-card-label">{payment.method === 'Cash' ? 'Receive By' : 'Bank Name'}:</span>
                                                            <span className="mobile-card-value line-clamp-1">{payment.method === 'Cash' ? (payment.receiveBy || '—') : (payment.bankName || '—')}</span>
                                                        </div>
                                                        <div className="mobile-card-row">
                                                            <span className="mobile-card-label">{payment.method === 'Cash' ? 'Place' : 'Branch'}:</span>
                                                            <span className="mobile-card-value line-clamp-1">{payment.method === 'Cash' ? (payment.place || '—') : (payment.branch || '—')}</span>
                                                        </div>
                                                        <div className="mobile-card-row">
                                                            <span className="mobile-card-label">Account No:</span>
                                                            <span className="mobile-card-value font-mono">{payment.accountNo || '—'}</span>
                                                        </div>
                                                    </div>

                                                    {isAdmin && (
                                                        <div className="mobile-card-actions">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleEditInitiation(payment); }}
                                                                className="flex items-center justify-center gap-1.5 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold flex-1 hover:bg-blue-100 transition-colors"
                                                            >
                                                                <EditIcon className="w-4 h-4" /> Edit
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleDeletePayment(payment); }}
                                                                className="flex items-center justify-center gap-1.5 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold px-4 hover:bg-red-100 transition-colors"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-8">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-50 mb-3">
                                        <SearchIcon className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <p className="text-gray-500 font-medium">No payments found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Add Collection Card (Style Match with Add Customer) */}
            {showAddModal && (
                <div className="payment-form-container">
                    <div className="payment-form-bg-orb payment-form-bg-orb-1"></div>
                    <div className="payment-form-bg-orb payment-form-bg-orb-2"></div>

                    <div className="payment-form-header">
                        <div>
                            <h3 className="payment-form-title">{isEditMode ? 'Update Collection Entry' : 'New Collection Entry'}</h3>
                            <p className="text-xs text-gray-500 font-medium italic">Record a payment from a customer or party</p>
                        </div>
                        <button
                            onClick={() => {
                                setShowAddModal(false);
                                resetNewPayment();
                            }}
                            className="payment-form-close"
                        >
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={isEditMode ? handleUpdateCollection : handleAddCollection} className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                            {/* Row 1: Date, Customer, Total Balance, Total Collection */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">Collection Date</label>
                                <CustomDatePicker
                                    value={newPayment.date}
                                    onChange={(e) => setNewPayment(prev => ({ ...prev, date: e.target.value }))}
                                    compact={false}
                                />
                            </div>

                            <div ref={customerDropdownRef} className="space-y-2 relative">
                                <label className="text-sm font-medium text-gray-700 ml-1">Select Customer / Party</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder={newPayment.customerId ? rawCustomers.find(c => c._id === newPayment.customerId)?.companyName || 'Search customer...' : "Search by Company, Name or ID..."}
                                        value={customerSearchQuery}
                                        onChange={(e) => {
                                            if (!isEditMode) {
                                                setCustomerSearchQuery(e.target.value);
                                                setActiveDropdown('customer');
                                            }
                                        }}
                                        onFocus={() => !isEditMode && setActiveDropdown('customer')}
                                        className={`payment-form-input pl-10 ${isEditMode ? 'bg-gray-50 cursor-not-allowed opacity-75' : ''}`}
                                        autoComplete="off"
                                        readOnly={isEditMode}
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center">
                                        {newPayment.customerId && !isEditMode ? (
                                            <span
                                                role="button"
                                                onClick={(e) => { e.stopPropagation(); setNewPayment(prev => ({ ...prev, customerId: '' })); setCustomerSearchQuery(''); setActiveDropdown(null); }}
                                                className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer text-lg leading-none"
                                            >×</span>
                                        ) : (
                                            !isEditMode && <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${activeDropdown === 'customer' ? 'rotate-180' : ''}`} />
                                        )}
                                    </div>
                                </div>

                                {activeDropdown === 'customer' && !isEditMode && (
                                    <div className="absolute z-[130] left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto py-2 animate-in slide-in-from-top-2 duration-200">
                                        {rawCustomers
                                            .filter(c =>
                                                (c.companyName || '').toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                                                (c.customerId || '').toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                                                (c.customerName || '').toLowerCase().includes(customerSearchQuery.toLowerCase())
                                            )
                                            .length > 0 ? (
                                            rawCustomers
                                                .filter(c =>
                                                    (c.companyName || '').toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                                                    (c.customerId || '').toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                                                    (c.customerName || '').toLowerCase().includes(customerSearchQuery.toLowerCase())
                                                )
                                                .map(customer => (
                                                    <button
                                                        key={customer._id}
                                                        type="button"
                                                        onClick={() => {
                                                            setNewPayment(prev => ({ ...prev, customerId: customer._id }));
                                                            setCustomerSearchQuery('');
                                                            setActiveDropdown(null);
                                                        }}
                                                        className="w-full px-5 py-3 text-left hover:bg-blue-50 transition-colors flex items-center justify-between group"
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-gray-900 group-hover:text-blue-700">{customer.companyName || customer.customerName}</span>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{customer.customerId}</span>
                                                        </div>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${customer.customerType === 'Party Customer' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                                                            {customer.customerType}
                                                        </span>
                                                    </button>
                                                ))
                                        ) : (
                                            <div className="px-5 py-8 text-center">
                                                <SearchIcon className="w-8 h-8 text-gray-100 mx-auto mb-2" />
                                                <p className="text-sm text-gray-400 font-medium">No customers found</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">Total Balance</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="text-orange-600 font-bold">৳</span>
                                    </div>
                                    <input
                                        type="text"
                                        readOnly
                                        value={currentBalance.toLocaleString()}
                                        className="payment-form-input pl-9 font-bold bg-orange-50/30 text-orange-700 border-orange-100 cursor-default"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                                        <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Outstanding</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">Total Collection</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="text-blue-600 font-bold">৳</span>
                                    </div>
                                    <input
                                        type="text"
                                        readOnly
                                        value={totalCollection.toLocaleString()}
                                        className="payment-form-input pl-9 font-bold bg-blue-50/30 text-blue-700 border-blue-100 cursor-default"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Collected</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Dynamic Payment Items List */}
                        <div className="md:col-span-2 space-y-4 mt-6">
                            <div className="flex justify-end">
                                {!isEditMode && (
                                    <button
                                        type="button"
                                        onClick={addPaymentItem}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-[10px] hover:bg-blue-100 transition-all group border border-blue-100/50 uppercase tracking-widest"
                                    >
                                        <PlusIcon className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                                        <span>Add More Method</span>
                                    </button>
                                )}
                            </div>
                            {newPayment.items.map((item, index) => (
                                <div key={item.id} className="relative p-7 bg-blue-50/10 rounded-3xl border border-blue-100/20 space-y-6 animate-in slide-in-from-top-4 duration-300 group/item">
                                    {newPayment.items.length > 1 && !isEditMode && (
                                        <button
                                            type="button"
                                            onClick={() => removePaymentItem(item.id)}
                                            className="absolute top-5 right-5 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all z-10 opacity-0 group-hover/item:opacity-100"
                                            title="Remove this method"
                                        >
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <div className={`grid grid-cols-1 gap-6 ${['Bank Deposit', 'Online Banking', 'Cheque'].includes(item.method)
                                        ? 'md:grid-cols-5'
                                        : (['Cash', 'Mobile Banking'].includes(item.method) ? 'md:grid-cols-4' : 'md:grid-cols-2')
                                        }`}>
                                        <div className="space-y-2 relative" data-dropdown-id={`method-${item.id}`}>
                                            <label className="text-sm font-medium text-gray-700 ml-1">Method</label>
                                            <button
                                                type="button"
                                                onClick={() => setActiveDropdown(activeDropdown === `method-${item.id}` ? null : `method-${item.id}`)}
                                                className="payment-form-input w-full flex items-center justify-between group bg-white border-blue-100/50"
                                            >
                                                <span className="font-medium text-gray-700">{item.method}</span>
                                                {item.method && item.method !== 'Cash' ? (
                                                    <span
                                                        role="button"
                                                        onClick={(e) => { e.stopPropagation(); updatePaymentItem(item.id, { method: 'Cash', bankName: '', branch: '', accountNo: '' }); setActiveDropdown(null); }}
                                                        className="ml-1 text-gray-400 hover:text-red-500 transition-colors cursor-pointer text-lg leading-none"
                                                    >×</span>
                                                ) : (
                                                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${activeDropdown === `method-${item.id}` ? 'rotate-180' : ''}`} />
                                                )}
                                            </button>
                                            {activeDropdown === `method-${item.id}` && (
                                                <div className="absolute z-[120] left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl py-2 animate-in slide-in-from-top-2 duration-200">
                                                    {["Cash", "Bank Deposit", "Online Banking", "Mobile Banking", "Cheque"].map(option => (
                                                        <button
                                                            key={option}
                                                            type="button"
                                                            onClick={() => {
                                                                updatePaymentItem(item.id, { method: option });
                                                                setActiveDropdown(null);
                                                            }}
                                                            className={`w-full px-5 py-3 text-left hover:bg-blue-50 transition-colors text-sm font-medium ${item.method === option ? 'text-blue-600 bg-blue-50/50' : 'text-gray-700'}`}
                                                        >
                                                            {option}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {item.method === 'Cash' && (
                                            <>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-gray-500 ml-1 italic">Receive By</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Receiver name..."
                                                        value={item.receiveBy}
                                                        onChange={(e) => updatePaymentItem(item.id, { receiveBy: e.target.value })}
                                                        className="payment-form-input border-gray-200/50 bg-white/50"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-gray-500 ml-1 italic">Place</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Location..."
                                                        value={item.place}
                                                        onChange={(e) => updatePaymentItem(item.id, { place: e.target.value })}
                                                        className="payment-form-input border-gray-200/50 bg-white/50"
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {(['Bank Deposit', 'Online Banking', 'Cheque', 'Mobile Banking'].includes(item.method)) && (
                                            <>
                                                <div className="space-y-2 relative" data-dropdown-id={`bank-${item.id}`}>
                                                    <label className="text-sm font-medium text-blue-700/70 ml-1 text-[11px] uppercase tracking-tighter">
                                                        {item.method === 'Mobile Banking' ? 'Provider' : 'Bank'}
                                                    </label>
                                                    {item.method === 'Mobile Banking' ? (
                                                        <input
                                                            type="text"
                                                            placeholder="bKash etc."
                                                            value={item.bankName}
                                                            onChange={(e) => updatePaymentItem(item.id, { bankName: e.target.value })}
                                                            className="payment-form-input border-blue-200/50 bg-white/50 text-sm"
                                                        />
                                                    ) : (
                                                        <div className="relative group/bank">
                                                            <button
                                                                type="button"
                                                                onClick={() => setActiveDropdown(activeDropdown === `bank-${item.id}` ? null : `bank-${item.id}`)}
                                                                className="payment-form-input w-full flex items-center justify-between border-blue-200/50 group bg-white/50 text-sm py-2"
                                                            >
                                                                <span className={`truncate ${item.bankName ? 'text-gray-900' : 'text-gray-400'}`}>
                                                                    {item.bankName || 'Select Bank'}
                                                                </span>
                                                                {item.bankName ? (
                                                                    <span
                                                                        role="button"
                                                                        onClick={(e) => { e.stopPropagation(); updatePaymentItem(item.id, { bankName: '', branch: '', accountNo: '' }); setActiveDropdown(null); }}
                                                                        className="ml-1 text-gray-400 hover:text-red-500 transition-colors cursor-pointer leading-none"
                                                                    >×</span>
                                                                ) : (
                                                                    <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                                                                )}
                                                            </button>
                                                            {activeDropdown === `bank-${item.id}` && (
                                                                <div className="absolute z-[130] left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl py-2 animate-in slide-in-from-top-2 duration-200 max-h-52 overflow-y-auto">
                                                                    <div className="px-3 pb-2 border-b border-gray-50 mb-2">
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Search bank..."
                                                                            value={bankSearchQuery}
                                                                            onChange={(e) => setBankSearchQuery(e.target.value)}
                                                                            className="w-full px-3 py-1.5 bg-gray-50 border-none rounded-lg text-xs"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        />
                                                                    </div>
                                                                    {banks.filter(b => b.bankName.toLowerCase().includes(bankSearchQuery.toLowerCase())).map(bank => (
                                                                        <button
                                                                            key={bank._id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                updatePaymentItem(item.id, { bankName: bank.bankName, branch: '', accountNo: '' });
                                                                                setBankSearchQuery('');
                                                                                setActiveDropdown(null);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-left hover:bg-blue-50 text-xs font-medium text-gray-700"
                                                                        >
                                                                            {bank.bankName}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {item.method !== 'Mobile Banking' && (
                                                    <div className="space-y-2 relative" data-dropdown-id={`branch-${item.id}`}>
                                                        <label className="text-sm font-medium text-blue-700/70 ml-1 text-[11px] uppercase tracking-tighter">Branch</label>
                                                        <button
                                                            type="button"
                                                            disabled={!item.bankName}
                                                            onClick={() => setActiveDropdown(activeDropdown === `branch-${item.id}` ? null : `branch-${item.id}`)}
                                                            className={`payment-form-input w-full flex items-center justify-between border-blue-200/50 group bg-white/50 text-sm py-2 ${!item.bankName ? 'opacity-50' : ''}`}
                                                        >
                                                            <span className="truncate">{item.branch || 'Select'}</span>
                                                            {item.branch ? (
                                                                <span
                                                                    role="button"
                                                                    onClick={(e) => { e.stopPropagation(); updatePaymentItem(item.id, { branch: '', accountNo: '' }); setActiveDropdown(null); }}
                                                                    className="ml-1 text-gray-400 hover:text-red-500 transition-colors cursor-pointer leading-none"
                                                                >×</span>
                                                            ) : (
                                                                <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                                                            )}
                                                        </button>
                                                        {activeDropdown === `branch-${item.id}` && item.bankName && (
                                                            <div className="absolute z-[130] left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl py-2 animate-in slide-in-from-top-2 duration-200 max-h-52 overflow-y-auto">
                                                                {banks.find(b => b.bankName === item.bankName)?.branches.map((br, bi) => (
                                                                    <button
                                                                        key={bi}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            updatePaymentItem(item.id, { branch: br.branch, accountNo: br.accountNo });
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className="w-full px-4 py-2 text-left hover:bg-blue-50 text-xs"
                                                                    >
                                                                        {br.branch}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-blue-700/70 ml-1 text-[11px] uppercase tracking-tighter">
                                                        {item.method === 'Mobile Banking' ? 'Ref/Phone' : 'Account/Cheque'}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="Number..."
                                                        value={item.accountNo}
                                                        onChange={(e) => updatePaymentItem(item.id, { accountNo: e.target.value })}
                                                        className="payment-form-input border-blue-200/50 bg-white/50 text-sm py-2"
                                                    />
                                                </div>
                                            </>
                                        )}

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-blue-700/70 ml-1">Amount (TK)</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                    <span className="text-blue-600 font-bold">৳</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    placeholder="0.00"
                                                    value={item.amount}
                                                    onChange={(e) => updatePaymentItem(item.id, { amount: e.target.value })}
                                                    className="payment-form-input pl-9 font-bold text-blue-600 border-blue-200/50 bg-white"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Conditional Fields per Item (Handled in single row above) */}
                                </div>
                            ))}
                        </div>

                        {/* Global Reference Row */}
                        <div className="md:col-span-2 pt-6 border-t border-gray-100 animate-in fade-in duration-500">

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">Reference / Remarks</label>
                                <textarea
                                    placeholder="Add any internal notes or references here..."
                                    rows="1"
                                    value={newPayment.reference}
                                    onChange={(e) => setNewPayment(prev => ({ ...prev, reference: e.target.value }))}
                                    className="payment-form-input resize-none h-[64px] py-3.5"
                                />
                            </div>
                            <div className="relative w-full md:w-64" data-dropdown-id="status">
                                <button
                                    type="button"
                                    onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                    className="payment-form-input w-full flex items-center justify-between group bg-white border-blue-100/50 py-3 px-6 rounded-xl"
                                >
                                    <div className="flex flex-col items-start">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Collection Status</span>
                                        <span className={`font-bold ${newPayment.status === 'Completed' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {newPayment.status}
                                        </span>
                                    </div>
                                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${activeDropdown === 'status' ? 'rotate-180' : ''}`} />
                                </button>

                                {activeDropdown === 'status' && (
                                    <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-2xl py-2 animate-in slide-in-from-top-2 duration-200 z-[150]">
                                        {["Completed", "Pending"].map(option => (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => {
                                                    setNewPayment(prev => ({ ...prev, status: option }));
                                                    setActiveDropdown(null);
                                                }}
                                                className={`w-full px-5 py-3 text-left hover:bg-blue-50 transition-colors text-sm font-bold ${newPayment.status === option ? 'text-blue-600 bg-blue-50/50' : 'text-gray-700'}`}
                                            >
                                                <span className={option === 'Completed' ? 'text-emerald-600' : 'text-amber-600'}>{option}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status Message */}
                        {submitStatus && (
                            <div className={`md:col-span-2 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${submitStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                                }`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${submitStatus === 'success' ? 'bg-emerald-500' : 'bg-red-500'
                                    }`}>
                                    {submitStatus === 'success' ? <DollarSignIcon className="w-5 h-5" /> : <XIcon className="w-5 h-5" />}
                                </div>
                                <p className="text-sm font-bold">
                                    {submitStatus === 'success' ? 'Collection record saved successfully!' : 'Failed to save record. Please try again.'}
                                </p>
                            </div>
                        )}

                        {/* Footer Buttons */}
                        <div className="md:col-span-2 flex items-center justify-end gap-4 pt-6 border-t border-gray-100 mt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAddModal(false);
                                    resetNewPayment();
                                }}
                                className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !newPayment.customerId || totalCollection <= 0}
                                className="payment-form-submit disabled:opacity-50 disabled:grayscale disabled:scale-100"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <DollarSignIcon className="w-4 h-4 mr-2" />
                                        <span>Save Collection</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <PaymentCollectionReport
                isOpen={showReport}
                onClose={() => setShowReport(false)}
                payments={filteredPayments}
            />
        </div>
    );
};

export default PaymentCollection;
