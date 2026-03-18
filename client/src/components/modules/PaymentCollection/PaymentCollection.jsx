import React, { useState, useEffect, useRef } from 'react';
import { SearchIcon, FunnelIcon, DollarSignIcon, EyeIcon, PlusIcon, XIcon, ChevronDownIcon, TrashIcon } from '../../Icons';
import { API_BASE_URL, formatDate, SortIcon } from '../../../utils/helpers';
import { decryptData, encryptData } from '../../../utils/encryption';
import CustomDatePicker from '../../shared/CustomDatePicker';
import axios from 'axios';
import './PaymentCollection.css';

const PaymentCollection = () => {
    const [payments, setPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

    // New States
    const [showAddModal, setShowAddModal] = useState(false);
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
            const response = await fetch(`${API_BASE_URL}/api/banks`);
            if (response.ok) {
                const rawData = await response.json();
                const decryptedBanks = rawData.map(record => {
                    const decrypted = decryptData(record.data);
                    // Handle backwards compatibility for single-branch records
                    const branches = decrypted.branches || [{
                        branch: decrypted.branch,
                        accountName: decrypted.accountName,
                        accountNo: decrypted.accountNo
                    }];
                    return { ...decrypted, branches, _id: record._id };
                });
                setBanks(decryptedBanks);
            }
        } catch (error) {
            console.error('Error fetching banks:', error);
        }
    };

    // Click outside listener for dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
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

    const fetchPayments = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/customers`);
            if (response.ok) {
                const rawData = await response.json();
                const allPayments = [];
                const customersList = [];

                rawData.forEach(record => {
                    const customer = decryptData(record.data);
                    customersList.push({ ...customer, _id: record._id });

                    const customerHistory = customer.paymentHistory || [];
                    customerHistory.forEach(payment => {
                        allPayments.push({
                            ...payment,
                            customerId: record._id,
                            customerName: customer.customerName,
                            companyName: customer.companyName,
                            readableCustomerId: customer.customerId
                        });
                    });
                });

                setPayments(allPayments);
                setRawCustomers(customersList);
            }
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
            const response = await fetch(`${API_BASE_URL}/api/customers/${payment.customerId}`);
            if (!response.ok) throw new Error('Failed to fetch customer');
            const record = await response.json();
            const customer = decryptData(record.data);
            const updatedHistory = (customer.paymentHistory || []).filter(p => p.id !== payment.id);
            const updatedCustomer = { ...customer, paymentHistory: updatedHistory };
            const saveResponse = await fetch(`${API_BASE_URL}/api/customers/${payment.customerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: encryptData(updatedCustomer) }),
            });
            if (saveResponse.ok) fetchPayments();
        } catch (error) {
            console.error('Error deleting payment:', error);
        }
    };

    const handleAddCollection = async (e) => {
        e.preventDefault();
        const totalAmountValue = newPayment.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        if (!newPayment.customerId || totalAmountValue <= 0) return;

        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            // Get current customer record
            const response = await fetch(`${API_BASE_URL}/api/customers/${newPayment.customerId}`);
            if (!response.ok) throw new Error('Failed to fetch customer');

            const record = await response.json();
            const customer = decryptData(record.data);

            // Add new payments to history
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

            // Save updated customer
            const saveResponse = await fetch(`${API_BASE_URL}/api/customers/${newPayment.customerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: encryptData(updatedCustomer) }),
            });

            if (saveResponse.ok) {
                setSubmitStatus('success');
                fetchPayments();
                setTimeout(() => {
                    setShowAddModal(false);
                    setSubmitStatus(null);
                    resetNewPayment();
                }, 1500);
            } else {
                setSubmitStatus('error');
            }
        } catch (error) {
            console.error('Error saving collection:', error);
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

    const filteredPayments = sortedPayments.filter(p =>
        (p.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.readableCustomerId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.method || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

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

                    <div className="w-full md:w-auto flex items-center gap-2">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="w-full md:w-auto justify-center px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all transform active:scale-95 flex items-center gap-2 text-sm"
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
                        <table className="w-full">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100/50 transition-colors">Date</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100/50 transition-colors">Party</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100/50 transition-colors">Payment Method</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100/50 transition-colors">Bank Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100/50 transition-colors">Branch</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100/50 transition-colors">Account Number</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {isLoading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan="8" className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
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
                                            <td className="px-6 py-4 text-sm font-bold text-blue-600 text-right">৳{parseFloat(payment.amount || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end">
                                                    <button
                                                        onClick={() => handleDeletePayment(payment)}
                                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-12 text-center text-gray-400 bg-white/50">
                                            <DollarSignIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p>No payments found</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
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
                            <h3 className="payment-form-title">New Collection Entry</h3>
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

                    <form onSubmit={handleAddCollection} className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
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
                                            setCustomerSearchQuery(e.target.value);
                                            setActiveDropdown('customer');
                                        }}
                                        onFocus={() => setActiveDropdown('customer')}
                                        className="payment-form-input pl-10"
                                        autoComplete="off"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center">
                                        {newPayment.customerId ? (
                                            <span
                                                role="button"
                                                onClick={(e) => { e.stopPropagation(); setNewPayment(prev => ({ ...prev, customerId: '' })); setCustomerSearchQuery(''); setActiveDropdown(null); }}
                                                className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer text-lg leading-none"
                                            >×</span>
                                        ) : (
                                            <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${activeDropdown === 'customer' ? 'rotate-180' : ''}`} />
                                        )}
                                    </div>
                                </div>

                                {activeDropdown === 'customer' && (
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
                                <button
                                    type="button"
                                    onClick={addPaymentItem}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-[10px] hover:bg-blue-100 transition-all group border border-blue-100/50 uppercase tracking-widest"
                                >
                                    <PlusIcon className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                                    <span>Add More Method</span>
                                </button>
                            </div>
                            {newPayment.items.map((item, index) => (
                                <div key={item.id} className="relative p-7 bg-blue-50/10 rounded-3xl border border-blue-100/20 space-y-6 animate-in slide-in-from-top-4 duration-300 group/item">
                                    {newPayment.items.length > 1 && (
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
        </div>
    );
};

export default PaymentCollection;
