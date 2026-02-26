import React, { useState, useEffect, useRef } from 'react';
import { EditIcon, TrashIcon, UserIcon, XIcon, SearchIcon, FunnelIcon, ChevronDownIcon, EyeIcon, BoxIcon } from '../../Icons';
import { API_BASE_URL, SortIcon } from '../../../utils/helpers';
import { encryptData, decryptData } from '../../../utils/encryption';
import CustomDatePicker from '../../shared/CustomDatePicker';
import './Customer.css';

const Customer = ({
    isSelectionMode,
    setIsSelectionMode,
    selectedItems,
    setSelectedItems,
    editingId,
    setEditingId,
    sortConfig,
    setSortConfig,
    onDeleteConfirm,
    startLongPress,
    endLongPress,
    isLongPressTriggered
}) => {
    const [showForm, setShowForm] = useState(false);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [filters, setFilters] = useState({ type: 'All Customer' });
    const filterButtonRef = useRef(null);
    const filterPanelRef = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewData, setViewData] = useState(null);
    const [historySearchQuery, setHistorySearchQuery] = useState('');
    const [activeHistoryTab, setActiveHistoryTab] = useState('sales'); // 'sales' or 'payment'
    const [status, setStatus] = useState('Active'); // status state for form
    const [formData, setFormData] = useState({
        customerId: '',
        companyName: '',
        customerName: '',
        address: '',
        location: '',
        phone: '+88',
        customerType: 'General Customer',
        status: 'Active'
    });

    // History Filter State
    const [showHistoryFilterPanel, setShowHistoryFilterPanel] = useState(false);
    const historyFilterPanelRef = useRef(null);
    const historyFilterButtonRef = useRef(null);

    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [paymentFormData, setPaymentFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        method: 'Bank',
        bankName: '',
        mobileType: '',
        accountNo: '',
        branch: '',
        amount: '',
        reference: '',
        status: 'Completed'
    });

    const initialHistoryFilterState = {
        startDate: '',
        endDate: '',
        lcNo: '',
        product: '',
        method: '',
        bankName: '',
        mobileType: ''
    };
    const [historyFilters, setHistoryFilters] = useState(initialHistoryFilterState);

    const [historyFilterSearchInputs, setHistoryFilterSearchInputs] = useState({
        lcNoSearch: '',
        productSearch: '',
        methodSearch: '',
        bankNameSearch: '',
        mobileTypeSearch: ''
    });

    const initialHistoryFilterDropdownState = {
        lcNo: false,
        product: false,
        method: false,
        bankName: false,
        mobileType: false
    };
    const [historyFilterDropdownOpen, setHistoryFilterDropdownOpen] = useState(initialHistoryFilterDropdownState);

    // Filter Refs
    const lcNoFilterRef = useRef(null);
    const productFilterRef = useRef(null);
    const methodFilterRef = useRef(null);
    const bankNameFilterRef = useRef(null);
    const mobileTypeFilterRef = useRef(null);


    // Click outside handler for history filter panel
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                showHistoryFilterPanel &&
                historyFilterPanelRef.current &&
                !historyFilterPanelRef.current.contains(event.target) &&
                historyFilterButtonRef.current &&
                !historyFilterButtonRef.current.contains(event.target)
            ) {
                setShowHistoryFilterPanel(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showHistoryFilterPanel]);

    // Click outside handler for history filter dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
            const openKey = Object.keys(historyFilterDropdownOpen).find(key => historyFilterDropdownOpen[key]);
            if (!openKey) return;

            let refsToCheck = [];
            if (openKey === 'lcNo') refsToCheck = [lcNoFilterRef];
            else if (openKey === 'product') refsToCheck = [productFilterRef];
            else if (openKey === 'method') refsToCheck = [methodFilterRef];
            else if (openKey === 'bankName') refsToCheck = [bankNameFilterRef];
            else if (openKey === 'mobileType') refsToCheck = [mobileTypeFilterRef];


            const isOutside = refsToCheck.every(ref => !ref.current || !ref.current.contains(event.target));
            if (isOutside) {
                setHistoryFilterDropdownOpen(initialHistoryFilterDropdownState);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [historyFilterDropdownOpen]);

    const getFilteredHistoryOptions = (type) => {
        if (!viewData) return [];
        const uniqueOptions = new Set();

        if (activeHistoryTab === 'sales') {
            (viewData.salesHistory || []).forEach(item => {
                if (type === 'lcNo' && item.invoiceNo) uniqueOptions.add(item.invoiceNo);
                if (type === 'product' && item.product) uniqueOptions.add(item.product);
            });
        } else {
            (viewData.paymentHistory || []).forEach(item => {
                if (type === 'lcNo' && item.lcNo) uniqueOptions.add(item.lcNo);
                if (type === 'method' && item.method) uniqueOptions.add(item.method);
                if (type === 'bankName' && item.bankName) uniqueOptions.add(item.bankName);
                if (type === 'mobileType' && item.mobileType) uniqueOptions.add(item.mobileType);
            });
        }

        const options = Array.from(uniqueOptions).sort();

        const searchMap = {
            lcNo: historyFilterSearchInputs.lcNoSearch,
            product: historyFilterSearchInputs.productSearch,
            method: historyFilterSearchInputs.methodSearch,
            bankName: historyFilterSearchInputs.bankNameSearch,
            mobileType: historyFilterSearchInputs.mobileTypeSearch
        };

        if (searchMap[type]) {
            return options.filter(opt => opt.toLowerCase().includes(searchMap[type].toLowerCase()));
        }

        return options;
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showFilterPanel && filterPanelRef.current && !filterPanelRef.current.contains(event.target) && !filterButtonRef.current.contains(event.target)) {
                setShowFilterPanel(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showFilterPanel]);

    const fetchCustomers = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/customers`);
            if (response.ok) {
                const rawData = await response.json();
                const decryptedCustomers = rawData.map(record => {
                    const decrypted = decryptData(record.data);
                    return { ...decrypted, _id: record._id, createdAt: record.createdAt };
                });
                setCustomers(decryptedCustomers);
            }
        } catch (error) {
            console.error('Error fetching customers:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        if (name === 'phone') {
            // Enforce +88 prefix and 14 characters limit
            if (!value.startsWith('+88')) {
                return; // Prevent removing +88
            }
            if (value.length > 14) {
                return; // Limit to 14 characters
            }
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate phone number
        if (formData.phone.length !== 14) {
            alert('Phone number must be exactly 14 characters long (e.g., +8801700000000)');
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const url = editingId ? `${API_BASE_URL}/api/customers/${editingId}` : `${API_BASE_URL}/api/customers`;
            const encryptedPayload = { data: encryptData(formData) };
            const response = await fetch(url, {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(encryptedPayload),
            });
            if (response.ok) {
                setSubmitStatus('success');
                fetchCustomers();
                setTimeout(() => {
                    setShowForm(false);
                    setEditingId(null);
                    resetForm();
                    setSubmitStatus(null);
                }, 2000);
            } else {
                setSubmitStatus('error');
            }
        } catch (error) {
            console.error('Error saving customer:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePaymentInputChange = (e) => {
        const { name, value } = e.target;
        setPaymentFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        if (!viewData) return;

        setIsSubmitting(true);
        try {
            // Get current customer record
            const response = await fetch(`${API_BASE_URL}/api/customers/${viewData._id}`);
            if (!response.ok) throw new Error('Failed to fetch customer');

            const record = await response.json();
            const customer = decryptData(record.data);

            // Add new payment to history
            const newPayment = {
                ...paymentFormData,
                id: Date.now().toString()
            };

            const updatedCustomer = {
                ...customer,
                paymentHistory: [newPayment, ...(customer.paymentHistory || [])]
            };

            // Save updated customer
            const saveResponse = await fetch(`${API_BASE_URL}/api/customers/${viewData._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: encryptData(updatedCustomer) }),
            });

            if (saveResponse.ok) {
                setSubmitStatus('success');
                fetchCustomers();
                setViewData({ ...updatedCustomer, _id: viewData._id }); // Update modal view
                setTimeout(() => {
                    setShowPaymentForm(false);
                    setSubmitStatus(null);
                    setPaymentFormData({
                        date: new Date().toISOString().split('T')[0],
                        method: 'Bank',
                        bankName: '',
                        mobileType: '',
                        accountNo: '',
                        branch: '',
                        amount: '',
                        reference: '',
                        status: 'Completed'
                    });
                }, 1500);
            }
        } catch (error) {
            console.error('Error saving payment:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            customerId: '',
            companyName: '',
            customerName: '',
            address: '',
            location: '',
            phone: '+88',
            customerType: 'General Customer',
            status: 'Active'
        });
        setEditingId(null);
    };

    const handleEdit = (customer) => {
        setFormData({
            customerId: customer.customerId || '',
            companyName: customer.companyName || '',
            customerName: customer.customerName || '',
            address: customer.address || '',
            location: customer.location || '',
            phone: customer.phone || '+88',
            customerType: customer.customerType || 'General Customer',
            status: customer.status || 'Active'
        });
        setEditingId(customer._id);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        onDeleteConfirm({ show: true, type: 'customer', id, isBulk: false });
    };

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedItems(newSelected);
        if (newSelected.size === 0) setIsSelectionMode(false);
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === customers.length) {
            setSelectedItems(new Set());
            setIsSelectionMode(false);
        } else {
            setSelectedItems(new Set(customers.map(c => c._id)));
        }
    };

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.customer?.key === key && sortConfig.customer?.direction === 'asc') direction = 'desc';
        setSortConfig({ ...sortConfig, customer: { key, direction } });
    };

    const sortData = (data) => {
        if (!sortConfig.customer) return data;
        const { key, direction } = sortConfig.customer;
        return [...data].sort((a, b) => {
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const getFilteredAndSortedData = () => {
        let filtered = customers;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = customers.filter(c =>
                c.customerId?.toLowerCase().includes(query) ||
                c.companyName?.toLowerCase().includes(query) ||
                c.customerName?.toLowerCase().includes(query) ||
                c.location?.toLowerCase().includes(query) ||
                c.phone?.toLowerCase().includes(query)
            );
        }

        if (filters.type && filters.type !== 'All Customer') {
            filtered = filtered.filter(c => (c.customerType || 'General Customer') === filters.type);
        }

        return sortData(filtered);
    };

    // Calculate Filtered History Data
    const filteredSalesHistory = (viewData?.salesHistory || []).filter(item => {
        const matchesSearch = !historySearchQuery ||
            (item.invoiceNo && item.invoiceNo.toLowerCase().includes(historySearchQuery.toLowerCase())) ||
            (item.product && item.product.toLowerCase().includes(historySearchQuery.toLowerCase())) ||
            (item.status && item.status.toLowerCase().includes(historySearchQuery.toLowerCase()));

        const matchesFilters =
            (!historyFilters.startDate || new Date(item.date) >= new Date(historyFilters.startDate)) &&
            (!historyFilters.endDate || new Date(item.date) <= new Date(historyFilters.endDate)) &&
            (!historyFilters.lcNo || item.invoiceNo === historyFilters.lcNo) &&
            (!historyFilters.product || item.product === historyFilters.product) &&
            (!historyFilters.truck || item.truck === historyFilters.truck) &&
            (!historyFilters.status || item.status === historyFilters.status);

        return matchesSearch && matchesFilters;
    });

    const filteredPaymentHistory = (viewData?.paymentHistory || []).filter(item => {
        const matchesFilters =
            (!historyFilters.startDate || new Date(item.date) >= new Date(historyFilters.startDate)) &&
            (!historyFilters.endDate || new Date(item.date) <= new Date(historyFilters.endDate)) &&
            (!historyFilters.lcNo || item.lcNo === historyFilters.lcNo) &&
            (!historyFilters.method || item.method === historyFilters.method) &&
            (!historyFilters.bankName || item.bankName === historyFilters.bankName) &&
            (!historyFilters.mobileType || item.mobileType === historyFilters.mobileType);
        return matchesFilters;
    });

    // Summary Totals
    const totalAmount = filteredSalesHistory.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const totalSalesPaid = filteredSalesHistory.reduce((sum, item) => sum + (parseFloat(item.paid) || 0), 0);
    const totalDiscount = filteredSalesHistory.reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0);
    const totalHistoryPaid = filteredPaymentHistory.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const totalPaidCalculated = totalSalesPaid + totalHistoryPaid;
    const totalDueCalculated = Math.max(0, totalAmount - totalSalesPaid - totalDiscount - totalHistoryPaid);
    const totalTruck = filteredSalesHistory.reduce((sum, item) => sum + (parseFloat(item.truck) || 0), 0);
    const totalQuantity = filteredSalesHistory.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

    return (
        <div className="customer-container space-y-6">
            {!showForm && (
                <div className="flex items-center justify-between gap-4">
                    <div className="w-1/4">
                        <h2 className="text-2xl font-bold text-gray-800">Customer Management</h2>
                    </div>

                    <div className="flex-1 max-w-md mx-auto relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by ID, Company, Name, Location or Phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                        />
                    </div>

                    <div className="w-1/4 flex justify-end gap-3 z-50">
                        <div className="flex items-center gap-2 relative">
                            {filters.type && (
                                <button
                                    ref={filterButtonRef}
                                    onClick={() => setShowFilterPanel(!showFilterPanel)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all animate-in fade-in slide-in-from-right-4 duration-300 shadow-sm whitespace-nowrap"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                    {filters.type}
                                    <ChevronDownIcon className={`w-3 h-3 ml-1 transition-transform duration-300 ${showFilterPanel ? 'rotate-180' : ''}`} />
                                </button>
                            )}

                            {showFilterPanel && (
                                <div
                                    ref={filterPanelRef}
                                    className="absolute right-0 top-full mt-3 w-72 bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-50 p-5 animate-in fade-in zoom-in duration-200"
                                >
                                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                                        <h4 className="font-bold text-gray-900">Advanced Filters</h4>
                                        <button
                                            onClick={() => {
                                                setFilters({ type: 'All Customer' });
                                                setShowFilterPanel(false);
                                            }}
                                            className="text-xs text-rose-500 hover:text-rose-600 font-medium bg-rose-50 px-2 py-1 rounded-lg transition-colors"
                                        >
                                            Clear All
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Customer Type</label>
                                            <div className="grid grid-cols-1 gap-2">
                                                {['All Customer', 'General Customer', 'Party Customer'].map((type) => (
                                                    <button
                                                        key={type}
                                                        onClick={() => setFilters(prev => ({ ...prev, type: prev.type === type ? '' : type }))}
                                                        className={`w-full px-4 py-2.5 text-left text-sm rounded-xl transition-all border ${filters.type === type
                                                            ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium shadow-sm'
                                                            : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span>{type}</span>
                                                            {filters.type === type && (
                                                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                            )}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setShowForm(!showForm)}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center"
                        >
                            <span className="mr-2 text-xl">+</span> Add New
                        </button>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="customer-form-container">
                    <div className="customer-form-bg-orb customer-form-bg-orb-1"></div>
                    <div className="customer-form-bg-orb customer-form-bg-orb-2"></div>

                    <div className="customer-form-header">
                        <h3 className="customer-form-title">{editingId ? 'Edit Customer' : 'New Customer Registration'}</h3>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="customer-form-close">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} autoComplete="off" className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">ID</label>
                            <input
                                type="text"
                                name="customerId"
                                value={formData.customerId}
                                onChange={handleInputChange}
                                required
                                placeholder="Customer ID"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Company Name</label>
                            <input
                                type="text"
                                name="companyName"
                                value={formData.companyName}
                                onChange={handleInputChange}
                                required
                                placeholder="Company Name"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Customer Name</label>
                            <input
                                type="text"
                                name="customerName"
                                value={formData.customerName}
                                onChange={handleInputChange}
                                required
                                placeholder="Customer Name"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Location</label>
                            <input
                                type="text"
                                name="location"
                                value={formData.location}
                                onChange={handleInputChange}
                                required
                                placeholder="Location"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>
                        <div className="col-span-1 md:col-span-2 space-y-2">
                            <label className="text-sm font-medium text-gray-700">Address</label>
                            <textarea
                                name="address"
                                value={formData.address}
                                onChange={handleInputChange}
                                required
                                rows="2"
                                placeholder="Full Street Address"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm resize-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Phone Number</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                required
                                placeholder="+880..."
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Customer Type</label>
                            <div className="relative">
                                <select
                                    name="customerType"
                                    value={formData.customerType}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm appearance-none pr-10 cursor-pointer"
                                >
                                    <option value="General Customer">General Customer</option>
                                    <option value="Party Customer">Party Customer</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Status</label>
                            <div className="relative">
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm appearance-none pr-10 cursor-pointer"
                                >
                                    <option>Active</option>
                                    <option>Inactive</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <div className="col-span-1 md:col-span-2 customer-form-footer">
                            {submitStatus === 'success' && (
                                <p className="customer-form-success">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    Customer saved successfully!
                                </p>
                            )}
                            {submitStatus === 'error' && (
                                <p className="customer-form-error">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    Failed to save customer.
                                </p>
                            )}
                            <div className="customer-form-spacer"></div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`customer-form-submit ${isSubmitting ? 'disabled' : ''}`}
                            >
                                {isSubmitting ? 'Saving...' : editingId ? 'Update Record' : 'Save Record'}
                            </button>
                        </div>
                    </form>
                </div>
            )
            }

            {
                !showForm && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        {isLoading ? (
                            <div className="flex items-center justify-center p-20">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            {isSelectionMode && <th className="px-6 py-4 w-10"><input type="checkbox" checked={selectedItems.size === customers.length} onChange={toggleSelectAll} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></th>}
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('customerId')}>
                                                <div className="flex items-center space-x-1">
                                                    <span>ID</span>
                                                    <SortIcon config={sortConfig.customer} columnKey="customerId" />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('companyName')}>
                                                <div className="flex items-center space-x-1">
                                                    <span>Company</span>
                                                    <SortIcon config={sortConfig.customer} columnKey="companyName" />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('customerName')}>
                                                <div className="flex items-center space-x-1">
                                                    <span>Customer</span>
                                                    <SortIcon config={sortConfig.customer} columnKey="customerName" />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('location')}>
                                                <div className="flex items-center space-x-1">
                                                    <span>Location</span>
                                                    <SortIcon config={sortConfig.customer} columnKey="location" />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {getFilteredAndSortedData().map(c => (
                                            <tr
                                                key={c._id}
                                                onMouseDown={() => startLongPress(c._id)}
                                                onMouseUp={endLongPress}
                                                onClick={() => isSelectionMode && toggleSelection(c._id)}
                                                className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                            >
                                                {isSelectionMode && <td className="px-6 py-4"><input type="checkbox" checked={selectedItems.has(c._id)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></td>}
                                                <td className="px-6 py-4 text-sm text-gray-600">{c.customerId}</td>
                                                <td className="px-6 py-4 text-sm font-bold text-gray-900">{c.companyName}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{c.customerName}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{c.location}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{c.phone}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    <span className={`customer-type-badge ${c.customerType === 'Party Customer' ? 'party' : 'general'}`}>
                                                        {c.customerType}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600"><span className={`customer-status-badge ${c.status === 'Active' ? 'active' : 'inactive'}`}>{c.status}</span></td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <button onClick={(e) => { e.stopPropagation(); setViewData(c); }} className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded transition-colors"><EyeIcon className="w-5 h-5" /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleEdit(c); }} className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors"><EditIcon className="w-5 h-5" /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(c._id); }} className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"><TrashIcon className="w-5 h-5" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )
            }
            {
                viewData && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"></div>
                        <div className="relative bg-white border border-gray-100 rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                            {/* Modal Header */}
                            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10 rounded-t-2xl">
                                <div className="flex-1">
                                    <h2 className="text-xl font-bold text-gray-900">{viewData.companyName}</h2>
                                    <p className="text-sm font-medium text-gray-600 mt-1">{viewData.customerName}</p>
                                    <p className="text-xs text-gray-500 mt-1">ID: {viewData.customerId}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{viewData.customerType}</p>
                                </div>

                                {/* Center Search bar */}
                                <div className="flex-1 max-w-sm mx-auto">
                                    <div className="relative group mb-3">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder={activeHistoryTab === 'sales' ? 'Search sales history...' : 'Search payment history...'}
                                            value={historySearchQuery}
                                            onChange={(e) => setHistorySearchQuery(e.target.value)}
                                            className="block w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        />
                                    </div>

                                    {/* Tab Navigation */}
                                    <div className="flex gap-1.5 justify-center">
                                        <button
                                            onClick={() => setActiveHistoryTab('sales')}
                                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeHistoryTab === 'sales'
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            Sales History
                                        </button>
                                        <button
                                            onClick={() => setActiveHistoryTab('payment')}
                                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeHistoryTab === 'payment'
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            Payment History
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 flex justify-end self-start gap-2 relative">
                                    <button
                                        ref={historyFilterButtonRef}
                                        onClick={() => setShowHistoryFilterPanel(!showHistoryFilterPanel)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all shadow-sm ${showHistoryFilterPanel ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'}`}
                                    >
                                        <FunnelIcon className="w-4 h-4" />
                                        <span className="text-sm font-medium">Filter</span>
                                    </button>

                                    {showHistoryFilterPanel && (
                                        <div
                                            ref={historyFilterPanelRef}
                                            className="absolute right-0 top-12 w-[320px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 z-50 animate-in fade-in zoom-in-95 duration-200"
                                        >
                                            <div className="flex items-center justify-between mb-6">
                                                <h4 className="text-lg font-bold text-gray-800">Filter History</h4>
                                                <button
                                                    onClick={() => {
                                                        setHistoryFilters(initialHistoryFilterState);
                                                        setHistoryFilterSearchInputs({
                                                            lcNoSearch: '',
                                                            productSearch: '',
                                                            methodSearch: '',
                                                            bankNameSearch: '',
                                                            mobileTypeSearch: ''
                                                        });
                                                    }}
                                                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                                                >
                                                    Reset All
                                                </button>
                                            </div>

                                            <div className="space-y-4">
                                                {/* Date Range */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <CustomDatePicker
                                                        label="START DATE"
                                                        value={historyFilters.startDate}
                                                        onChange={(e) => setHistoryFilters({ ...historyFilters, startDate: e.target.value })}
                                                        compact={true}
                                                        labelClassName="text-[11px] font-bold text-gray-400 uppercase tracking-wider"
                                                    />
                                                    <CustomDatePicker
                                                        label="END DATE"
                                                        value={historyFilters.endDate}
                                                        onChange={(e) => setHistoryFilters({ ...historyFilters, endDate: e.target.value })}
                                                        compact={true}
                                                        labelClassName="text-[11px] font-bold text-gray-400 uppercase tracking-wider"
                                                    />
                                                </div>

                                                {/* LC No Filter */}
                                                <div className="space-y-1.5 relative" ref={lcNoFilterRef}>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">LC No</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={historyFilterSearchInputs.lcNoSearch}
                                                            onChange={(e) => {
                                                                setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, lcNoSearch: e.target.value });
                                                                setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, lcNo: true });
                                                            }}
                                                            onFocus={() => setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, lcNo: true })}
                                                            placeholder={historyFilters.lcNo || "Search LC No..."}
                                                            className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${historyFilters.lcNo ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                        />
                                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                            {historyFilters.lcNo && (
                                                                <button
                                                                    onClick={() => {
                                                                        setHistoryFilters({ ...historyFilters, lcNo: '' });
                                                                        setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, lcNoSearch: '' });
                                                                    }}
                                                                    className="text-gray-400 hover:text-gray-600"
                                                                >
                                                                    <XIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                        </div>
                                                    </div>
                                                    {historyFilterDropdownOpen.lcNo && (
                                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                            {getFilteredHistoryOptions('lcNo').length > 0 ? (
                                                                getFilteredHistoryOptions('lcNo').map(opt => (
                                                                    <button
                                                                        key={opt}
                                                                        onClick={() => {
                                                                            setHistoryFilters({ ...historyFilters, lcNo: opt });
                                                                            setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, lcNoSearch: '' });
                                                                            setHistoryFilterDropdownOpen(initialHistoryFilterDropdownState);
                                                                        }}
                                                                        className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                    >
                                                                        {opt}
                                                                    </button>
                                                                ))
                                                            ) : (
                                                                <div className="px-4 py-2 text-xs text-gray-400 text-center">No options found</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Product Filter - Only for Sales */}
                                                {activeHistoryTab === 'sales' && (
                                                    <div className="space-y-1.5 relative" ref={productFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Product</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={historyFilterSearchInputs.productSearch}
                                                                onChange={(e) => {
                                                                    setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, productSearch: e.target.value });
                                                                    setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, product: true });
                                                                }}
                                                                onFocus={() => setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, product: true })}
                                                                placeholder={historyFilters.product || "Search Product..."}
                                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${historyFilters.product ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                            />
                                                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                {historyFilters.product && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setHistoryFilters({ ...historyFilters, product: '' });
                                                                            setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, productSearch: '' });
                                                                        }}
                                                                        className="text-gray-400 hover:text-gray-600"
                                                                    >
                                                                        <XIcon className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                        {historyFilterDropdownOpen.product && (
                                                            <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                                {getFilteredHistoryOptions('product').length > 0 ? (
                                                                    getFilteredHistoryOptions('product').map(opt => (
                                                                        <button
                                                                            key={opt}
                                                                            onClick={() => {
                                                                                setHistoryFilters({ ...historyFilters, product: opt });
                                                                                setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, productSearch: '' });
                                                                                setHistoryFilterDropdownOpen(initialHistoryFilterDropdownState);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            {opt}
                                                                        </button>
                                                                    ))
                                                                ) : (
                                                                    <div className="px-4 py-2 text-xs text-gray-400 text-center">No options found</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Payment specific filters */}
                                                {activeHistoryTab === 'payment' && (
                                                    <div className="space-y-4">
                                                        {/* Method Filter */}
                                                        <div className="space-y-1.5 relative" ref={methodFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Payment Method</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={historyFilterSearchInputs.methodSearch}
                                                                    onChange={(e) => {
                                                                        setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, methodSearch: e.target.value });
                                                                        setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, method: true });
                                                                    }}
                                                                    onFocus={() => setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, method: true })}
                                                                    placeholder={historyFilters.method || "Search Method..."}
                                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${historyFilters.method ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                                />
                                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                    {historyFilters.method && (
                                                                        <button
                                                                            onClick={() => {
                                                                                setHistoryFilters({ ...historyFilters, method: '' });
                                                                                setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, methodSearch: '' });
                                                                            }}
                                                                            className="text-gray-400 hover:text-gray-600"
                                                                        >
                                                                            <XIcon className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                            {historyFilterDropdownOpen.method && (
                                                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                                    {getFilteredHistoryOptions('method').length > 0 ? (
                                                                        getFilteredHistoryOptions('method').map(opt => (
                                                                            <button
                                                                                key={opt}
                                                                                onClick={() => {
                                                                                    setHistoryFilters({ ...historyFilters, method: opt });
                                                                                    setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, methodSearch: '' });
                                                                                    setHistoryFilterDropdownOpen(initialHistoryFilterDropdownState);
                                                                                }}
                                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                            >
                                                                                {opt}
                                                                            </button>
                                                                        ))
                                                                    ) : (
                                                                        <div className="px-4 py-2 text-xs text-gray-400 text-center">No options found</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Bank Name Filter */}
                                                        <div className="space-y-1.5 relative" ref={bankNameFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Bank</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={historyFilterSearchInputs.bankNameSearch}
                                                                    onChange={(e) => {
                                                                        setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, bankNameSearch: e.target.value });
                                                                        setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, bankName: true });
                                                                    }}
                                                                    onFocus={() => setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, bankName: true })}
                                                                    placeholder={historyFilters.bankName || "Search Bank..."}
                                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${historyFilters.bankName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                                />
                                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                    {historyFilters.bankName && (
                                                                        <button
                                                                            onClick={() => {
                                                                                setHistoryFilters({ ...historyFilters, bankName: '' });
                                                                                setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, bankNameSearch: '' });
                                                                            }}
                                                                            className="text-gray-400 hover:text-gray-600"
                                                                        >
                                                                            <XIcon className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                            {historyFilterDropdownOpen.bankName && (
                                                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                                    {getFilteredHistoryOptions('bankName').length > 0 ? (
                                                                        getFilteredHistoryOptions('bankName').map(opt => (
                                                                            <button
                                                                                key={opt}
                                                                                onClick={() => {
                                                                                    setHistoryFilters({ ...historyFilters, bankName: opt });
                                                                                    setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, bankNameSearch: '' });
                                                                                    setHistoryFilterDropdownOpen(initialHistoryFilterDropdownState);
                                                                                }}
                                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                            >
                                                                                {opt}
                                                                            </button>
                                                                        ))
                                                                    ) : (
                                                                        <div className="px-4 py-2 text-xs text-gray-400 text-center">No options found</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Mobile Type Filter */}
                                                        <div className="space-y-1.5 relative" ref={mobileTypeFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Mobile Banking</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={historyFilterSearchInputs.mobileTypeSearch}
                                                                    onChange={(e) => {
                                                                        setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, mobileTypeSearch: e.target.value });
                                                                        setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, mobileType: true });
                                                                    }}
                                                                    onFocus={() => setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, mobileType: true })}
                                                                    placeholder={historyFilters.mobileType || "Search Mobile Banking..."}
                                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${historyFilters.mobileType ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                                />
                                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                    {historyFilters.mobileType && (
                                                                        <button
                                                                            onClick={() => {
                                                                                setHistoryFilters({ ...historyFilters, mobileType: '' });
                                                                                setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, mobileTypeSearch: '' });
                                                                            }}
                                                                            className="text-gray-400 hover:text-gray-600"
                                                                        >
                                                                            <XIcon className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                            {historyFilterDropdownOpen.mobileType && (
                                                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                                    {getFilteredHistoryOptions('mobileType').length > 0 ? (
                                                                        getFilteredHistoryOptions('mobileType').map(opt => (
                                                                            <button
                                                                                key={opt}
                                                                                onClick={() => {
                                                                                    setHistoryFilters({ ...historyFilters, mobileType: opt });
                                                                                    setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, mobileTypeSearch: '' });
                                                                                    setHistoryFilterDropdownOpen(initialHistoryFilterDropdownState);
                                                                                }}
                                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                            >
                                                                                {opt}
                                                                            </button>
                                                                        ))
                                                                    ) : (
                                                                        <div className="px-4 py-2 text-xs text-gray-400 text-center">No options found</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}



                                                <button
                                                    onClick={() => setShowHistoryFilterPanel(false)}
                                                    className="w-full py-3 bg-[#0f172a] text-white rounded-xl text-sm font-bold shadow-xl shadow-gray-200/50 hover:bg-[#1e293b] active:scale-[0.98] transition-all mt-4"
                                                >
                                                    Apply Filters
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <button onClick={() => setViewData(null)} className="p-2 hover:bg-gray-50 text-gray-400 hover:text-gray-600 rounded-full transition-all">
                                        <XIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto p-8">
                                {/* Global Summary Cards */}
                                <div className={`grid ${activeHistoryTab === 'sales' ? 'grid-cols-6' : 'grid-cols-4'} gap-3 mb-8`}>
                                    {activeHistoryTab === 'sales' && (
                                        <>
                                            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 shadow-sm transition-all hover:shadow-md">
                                                <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider mb-1">Total Truck</p>
                                                <p className="text-lg font-black text-blue-700">{totalTruck}</p>
                                            </div>
                                            <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 shadow-sm transition-all hover:shadow-md">
                                                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-1">Total Quantity</p>
                                                <p className="text-lg font-black text-emerald-700">{totalQuantity}</p>
                                            </div>
                                        </>
                                    )}
                                    <div className="bg-violet-50/50 p-4 rounded-2xl border border-violet-100 shadow-sm transition-all hover:shadow-md">
                                        <p className="text-[10px] text-violet-500 font-bold uppercase tracking-wider mb-1">Total Amount</p>
                                        <p className="text-lg font-black text-violet-700">৳{totalAmount.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-100 shadow-sm transition-all hover:shadow-md">
                                        <p className="text-[10px] text-teal-500 font-bold uppercase tracking-wider mb-1">Total Paid</p>
                                        <p className="text-lg font-black text-teal-700">৳{totalPaidCalculated.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-pink-50/50 p-4 rounded-2xl border border-pink-100 shadow-sm transition-all hover:shadow-md">
                                        <p className="text-[10px] text-pink-500 font-bold uppercase tracking-wider mb-1">Total Discount</p>
                                        <p className="text-lg font-black text-pink-700">৳{totalDiscount.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100 shadow-sm transition-all hover:shadow-md">
                                        <p className="text-[10px] text-orange-500 font-bold uppercase tracking-wider mb-1">Total Due</p>
                                        <p className="text-lg font-black text-orange-700">৳{totalDueCalculated.toLocaleString()}</p>
                                    </div>
                                </div>

                                {/* Sales History Table */}
                                {activeHistoryTab === 'sales' && (
                                    <>
                                        <h4 className="text-lg font-bold text-gray-800 mb-4">Sales History</h4>
                                        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-white border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-600">LC No</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-600">Product</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-600">Truck</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">Qty</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">Amount</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">Paid</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">Due</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">Discount</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-600 text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredSalesHistory && filteredSalesHistory.length > 0 ? (
                                                        filteredSalesHistory.map((item, index) => (
                                                            <tr key={index} className="border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors">
                                                                <td className="px-4 py-3 text-gray-600 font-medium whitespace-nowrap">{new Date(item.date).toLocaleDateString()}</td>
                                                                <td className="px-4 py-3 text-gray-600 font-bold uppercase tracking-tight">{item.invoiceNo || '-'}</td>
                                                                <td className="px-4 py-3 text-gray-600 font-medium">{item.product || '-'}</td>
                                                                <td className="px-4 py-3 text-gray-500">{item.truck || '-'}</td>
                                                                <td className="px-4 py-3 text-right font-bold text-gray-900">{parseFloat(item.quantity || 0).toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-right font-black text-violet-700">৳{parseFloat(item.amount || 0).toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-right font-bold text-emerald-600">৳{parseFloat(item.paid || 0).toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-right font-bold text-orange-600">৳{parseFloat(item.due || 0).toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-right font-bold text-pink-600">৳{parseFloat(item.discount || 0).toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${item.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                                                                        item.status === 'Pending' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                                                                        }`}>
                                                                        {item.status || 'Pending'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan="10" className="px-4 py-12 text-center text-gray-400">
                                                                <div className="flex flex-col items-center space-y-2">
                                                                    <BoxIcon className="w-10 h-10 opacity-10" />
                                                                    <p className="text-sm font-medium">No sales transactions found</p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}

                                {/* Payment History Table */}
                                {activeHistoryTab === 'payment' && (
                                    <>
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-lg font-bold text-gray-800">Payment History</h4>
                                        </div>

                                        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-white border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-600">LC No</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-600">Payment<br />Method</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-600">Bank Name <br />Mobile Banking</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-600">Branch</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-600">Account No</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-600">Transaction ID</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">Amount</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-600 text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {viewData.paymentHistory && viewData.paymentHistory.length > 0 ? (
                                                        viewData.paymentHistory.map((payment, index) => (
                                                            <tr key={payment.id || index} className="border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors">
                                                                <td className="px-4 py-3 text-gray-600">{new Date(payment.date).toLocaleDateString()}</td>
                                                                <td className="px-4 py-3 text-gray-600 font-medium">{payment.lcNo || '-'}</td>
                                                                <td className="px-4 py-3 font-medium text-gray-900">{payment.method}</td>
                                                                <td className="px-4 py-3 text-gray-600">
                                                                    <span className="font-semibold text-xs">
                                                                        {payment.method === 'Bank' ? payment.bankName : (payment.method === 'Mobile Banking' ? payment.mobileType : 'Cash')}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-gray-600 text-xs">
                                                                    {payment.method === 'Bank' ? payment.branch : '-'}
                                                                </td>
                                                                <td className="px-4 py-3 text-gray-600 text-xs">
                                                                    {payment.accountNo || '-'}
                                                                </td>
                                                                <td className="px-4 py-3 text-gray-600 text-xs">
                                                                    {payment.transactionId || '-'}
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-bold text-gray-900">
                                                                    <div className="flex flex-col items-end">
                                                                        <span>৳{parseFloat(payment.amount).toLocaleString()}</span>
                                                                        {payment.reference && <span className="text-[9px] text-blue-500 font-normal">Ref: {payment.reference}</span>}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold">
                                                                        {payment.status}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan="7" className="px-4 py-12 text-center text-gray-400">
                                                                <div className="flex flex-col items-center">
                                                                    <BoxIcon className="w-8 h-8 mb-2 opacity-20" />
                                                                    <p>No payment history available</p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default Customer;
