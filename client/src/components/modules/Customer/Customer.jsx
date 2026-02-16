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
    const [filters, setFilters] = useState({ type: '' });
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

    const initialHistoryFilterState = {
        startDate: '',
        endDate: '',
        invoiceNo: '',
        product: '',
        truck: '',
        status: ''
    };
    const [historyFilters, setHistoryFilters] = useState(initialHistoryFilterState);

    const [historyFilterSearchInputs, setHistoryFilterSearchInputs] = useState({
        invoiceNoSearch: '',
        productSearch: '',
        truckSearch: ''
    });

    const initialHistoryFilterDropdownState = {
        invoiceNo: false,
        product: false,
        truck: false,
        status: false
    };
    const [historyFilterDropdownOpen, setHistoryFilterDropdownOpen] = useState(initialHistoryFilterDropdownState);

    // Filter Refs
    const invoiceNoFilterRef = useRef(null);
    const productFilterRef = useRef(null);
    const truckFilterRef = useRef(null);
    const statusFilterRef = useRef(null);

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
            if (openKey === 'invoiceNo') refsToCheck = [invoiceNoFilterRef];
            else if (openKey === 'product') refsToCheck = [productFilterRef];
            else if (openKey === 'truck') refsToCheck = [truckFilterRef];
            else if (openKey === 'status') refsToCheck = [statusFilterRef];

            const isOutside = refsToCheck.every(ref => !ref.current || !ref.current.contains(event.target));
            if (isOutside) {
                setHistoryFilterDropdownOpen(initialHistoryFilterDropdownState);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [historyFilterDropdownOpen]);

    const getFilteredHistoryOptions = (type) => {
        if (!viewData || !viewData.salesHistory) return [];
        const uniqueOptions = new Set();

        viewData.salesHistory.forEach(item => {
            if (type === 'invoiceNo' && item.invoiceNo) uniqueOptions.add(item.invoiceNo);
            if (type === 'product' && item.product) uniqueOptions.add(item.product);
            if (type === 'truck' && item.truck) uniqueOptions.add(item.truck);
            if (type === 'status' && item.status) uniqueOptions.add(item.status);
        });

        const options = Array.from(uniqueOptions).sort();

        if (type === 'invoiceNo' && historyFilterSearchInputs.invoiceNoSearch) {
            return options.filter(opt => opt.toLowerCase().includes(historyFilterSearchInputs.invoiceNoSearch.toLowerCase()));
        }
        if (type === 'product' && historyFilterSearchInputs.productSearch) {
            return options.filter(opt => opt.toLowerCase().includes(historyFilterSearchInputs.productSearch.toLowerCase()));
        }
        if (type === 'truck' && historyFilterSearchInputs.truckSearch) {
            return options.filter(opt => opt.toLowerCase().includes(historyFilterSearchInputs.truckSearch.toLowerCase()));
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

        if (filters.type) {
            filtered = filtered.filter(c => c.customerType === filters.type);
        }

        return sortData(filtered);
    };

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
                        <div className="relative">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${showFilterPanel || filters.type
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <FunnelIcon className={`w-4 h-4 ${showFilterPanel || filters.type ? 'text-white' : 'text-gray-400'}`} />
                                <span className="text-sm font-medium">Filter</span>
                            </button>

                            {showFilterPanel && (
                                <div
                                    ref={filterPanelRef}
                                    className="absolute right-0 mt-3 w-72 bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-50 p-5 animate-in fade-in zoom-in duration-200"
                                >
                                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                                        <h4 className="font-bold text-gray-900">Advanced Filters</h4>
                                        <button
                                            onClick={() => {
                                                setFilters({ type: '' });
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
                                                {['General Customer', 'Party Customer'].map((type) => (
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
            )}

            {!showForm && (
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
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
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
                                                <div className="flex space-x-2">
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
            )}
            {viewData && (
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
                                        className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 z-50 animate-in fade-in zoom-in-95 duration-200"
                                    >
                                        <div className="flex items-center justify-between mb-6">
                                            <h4 className="text-lg font-bold text-gray-800">Filter History</h4>
                                            <button
                                                onClick={() => {
                                                    setHistoryFilters(initialHistoryFilterState);
                                                    setHistoryFilterSearchInputs({ invoiceNoSearch: '', productSearch: '', truckSearch: '' });
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
                                                />
                                                <CustomDatePicker
                                                    label="END DATE"
                                                    value={historyFilters.endDate}
                                                    onChange={(e) => setHistoryFilters({ ...historyFilters, endDate: e.target.value })}
                                                    compact={true}
                                                />
                                            </div>

                                            {/* Invoice No Filter */}
                                            <div className="space-y-1.5 relative" ref={invoiceNoFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Invoice No</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={historyFilterSearchInputs.invoiceNoSearch}
                                                        onChange={(e) => {
                                                            setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, invoiceNoSearch: e.target.value });
                                                            setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, invoiceNo: true });
                                                        }}
                                                        onFocus={() => setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, invoiceNo: true })}
                                                        placeholder={historyFilters.invoiceNo || "Search Invoice No..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${historyFilters.invoiceNo ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {historyFilters.invoiceNo && (
                                                            <button
                                                                onClick={() => {
                                                                    setHistoryFilters({ ...historyFilters, invoiceNo: '' });
                                                                    setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, invoiceNoSearch: '' });
                                                                }}
                                                                className="text-gray-400 hover:text-gray-600"
                                                            >
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {historyFilterDropdownOpen.invoiceNo && (
                                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                        {getFilteredHistoryOptions('invoiceNo').length > 0 ? (
                                                            getFilteredHistoryOptions('invoiceNo').map(opt => (
                                                                <button
                                                                    key={opt}
                                                                    onClick={() => {
                                                                        setHistoryFilters({ ...historyFilters, invoiceNo: opt });
                                                                        setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, invoiceNoSearch: '' });
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

                                            {/* Product Filter */}
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

                                            {/* Truck Filter */}
                                            <div className="space-y-1.5 relative" ref={truckFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Truck</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={historyFilterSearchInputs.truckSearch}
                                                        onChange={(e) => {
                                                            setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, truckSearch: e.target.value });
                                                            setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, truck: true });
                                                        }}
                                                        onFocus={() => setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, truck: true })}
                                                        placeholder={historyFilters.truck || "Search Truck..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${historyFilters.truck ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {historyFilters.truck && (
                                                            <button
                                                                onClick={() => {
                                                                    setHistoryFilters({ ...historyFilters, truck: '' });
                                                                    setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, truckSearch: '' });
                                                                }}
                                                                className="text-gray-400 hover:text-gray-600"
                                                            >
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {historyFilterDropdownOpen.truck && (
                                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                        {getFilteredHistoryOptions('truck').length > 0 ? (
                                                            getFilteredHistoryOptions('truck').map(opt => (
                                                                <button
                                                                    key={opt}
                                                                    onClick={() => {
                                                                        setHistoryFilters({ ...historyFilters, truck: opt });
                                                                        setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, truckSearch: '' });
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

                                            {/* Status Filter */}
                                            <div className="space-y-1.5 relative" ref={statusFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</label>
                                                <div className="relative">
                                                    <div
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm flex items-center justify-between cursor-pointer shadow-sm hover:border-gray-200 transition-all ${historyFilters.status ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}
                                                        onClick={() => setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, status: !historyFilterDropdownOpen.status })}
                                                    >
                                                        <span>{historyFilters.status || "Select Status"}</span>
                                                        <div className="flex items-center gap-2">
                                                            {historyFilters.status && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setHistoryFilters({ ...historyFilters, status: '' });
                                                                    }}
                                                                    className="text-gray-400 hover:text-gray-600"
                                                                >
                                                                    <XIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${historyFilterDropdownOpen.status ? 'rotate-180' : ''}`} />
                                                        </div>
                                                    </div>
                                                </div>
                                                {historyFilterDropdownOpen.status && (
                                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-1">
                                                        {['Active', 'Inactive'].map(opt => (
                                                            <button
                                                                key={opt}
                                                                onClick={() => {
                                                                    setHistoryFilters({ ...historyFilters, status: opt });
                                                                    setHistoryFilterDropdownOpen(initialHistoryFilterDropdownState);
                                                                }}
                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                            >
                                                                {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

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
                            {/* Sales History Table */}
                            {activeHistoryTab === 'sales' && (
                                <>
                                    <div className="grid grid-cols-6 gap-4 mb-6">
                                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                            <p className="text-xs text-blue-500 font-semibold mb-1">Total Truck</p>
                                            <p className="text-lg font-bold text-blue-700">
                                                {viewData.salesHistory?.filter(item => {
                                                    const matchesSearch = !historySearchQuery ||
                                                        (item.invoiceNo && item.invoiceNo.toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                                                        (item.product && item.product.toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                                                        (item.status && item.status.toLowerCase().includes(historySearchQuery.toLowerCase()));

                                                    const matchesFilters =
                                                        (!historyFilters.startDate || new Date(item.date) >= new Date(historyFilters.startDate)) &&
                                                        (!historyFilters.endDate || new Date(item.date) <= new Date(historyFilters.endDate)) &&
                                                        (!historyFilters.invoiceNo || item.invoiceNo === historyFilters.invoiceNo) &&
                                                        (!historyFilters.product || item.product === historyFilters.product) &&
                                                        (!historyFilters.truck || item.truck === historyFilters.truck) &&
                                                        (!historyFilters.status || item.status === historyFilters.status);

                                                    return matchesSearch && matchesFilters;
                                                }).reduce((sum, item) => sum + (parseFloat(item.truck) || 0), 0) || 0}
                                            </p>
                                        </div>
                                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                            <p className="text-xs text-emerald-500 font-semibold mb-1">Total Quantity</p>
                                            <p className="text-lg font-bold text-emerald-700">
                                                {viewData.salesHistory?.filter(item => {
                                                    const matchesSearch = !historySearchQuery ||
                                                        (item.invoiceNo && item.invoiceNo.toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                                                        (item.product && item.product.toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                                                        (item.status && item.status.toLowerCase().includes(historySearchQuery.toLowerCase()));

                                                    const matchesFilters =
                                                        (!historyFilters.startDate || new Date(item.date) >= new Date(historyFilters.startDate)) &&
                                                        (!historyFilters.endDate || new Date(item.date) <= new Date(historyFilters.endDate)) &&
                                                        (!historyFilters.invoiceNo || item.invoiceNo === historyFilters.invoiceNo) &&
                                                        (!historyFilters.product || item.product === historyFilters.product) &&
                                                        (!historyFilters.truck || item.truck === historyFilters.truck) &&
                                                        (!historyFilters.status || item.status === historyFilters.status);

                                                    return matchesSearch && matchesFilters;
                                                }).reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0) || 0}
                                            </p>
                                        </div>
                                        <div className="bg-violet-50 p-4 rounded-xl border border-violet-100">
                                            <p className="text-xs text-violet-500 font-semibold mb-1">Total Amount</p>
                                            <p className="text-lg font-bold text-violet-700">
                                                ৳{viewData.salesHistory?.filter(item => {
                                                    const matchesSearch = !historySearchQuery ||
                                                        (item.invoiceNo && item.invoiceNo.toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                                                        (item.product && item.product.toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                                                        (item.status && item.status.toLowerCase().includes(historySearchQuery.toLowerCase()));

                                                    const matchesFilters =
                                                        (!historyFilters.startDate || new Date(item.date) >= new Date(historyFilters.startDate)) &&
                                                        (!historyFilters.endDate || new Date(item.date) <= new Date(historyFilters.endDate)) &&
                                                        (!historyFilters.invoiceNo || item.invoiceNo === historyFilters.invoiceNo) &&
                                                        (!historyFilters.product || item.product === historyFilters.product) &&
                                                        (!historyFilters.truck || item.truck === historyFilters.truck) &&
                                                        (!historyFilters.status || item.status === historyFilters.status);

                                                    return matchesSearch && matchesFilters;
                                                }).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0).toLocaleString() || 0}
                                            </p>
                                        </div>
                                        <div className="bg-teal-50 p-4 rounded-xl border border-teal-100">
                                            <p className="text-xs text-teal-500 font-semibold mb-1">Total Paid</p>
                                            <p className="text-lg font-bold text-teal-700">
                                                ৳{viewData.salesHistory?.filter(item => {
                                                    const matchesSearch = !historySearchQuery ||
                                                        (item.invoiceNo && item.invoiceNo.toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                                                        (item.product && item.product.toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                                                        (item.status && item.status.toLowerCase().includes(historySearchQuery.toLowerCase()));

                                                    const matchesFilters =
                                                        (!historyFilters.startDate || new Date(item.date) >= new Date(historyFilters.startDate)) &&
                                                        (!historyFilters.endDate || new Date(item.date) <= new Date(historyFilters.endDate)) &&
                                                        (!historyFilters.invoiceNo || item.invoiceNo === historyFilters.invoiceNo) &&
                                                        (!historyFilters.product || item.product === historyFilters.product) &&
                                                        (!historyFilters.truck || item.truck === historyFilters.truck) &&
                                                        (!historyFilters.status || item.status === historyFilters.status);

                                                    return matchesSearch && matchesFilters;
                                                }).reduce((sum, item) => sum + (parseFloat(item.paid) || 0), 0).toLocaleString() || 0}
                                            </p>
                                        </div>
                                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                                            <p className="text-xs text-orange-500 font-semibold mb-1">Total Due</p>
                                            <p className="text-lg font-bold text-orange-700">
                                                ৳{viewData.salesHistory?.filter(item => {
                                                    const matchesSearch = !historySearchQuery ||
                                                        (item.invoiceNo && item.invoiceNo.toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                                                        (item.product && item.product.toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                                                        (item.status && item.status.toLowerCase().includes(historySearchQuery.toLowerCase()));

                                                    const matchesFilters =
                                                        (!historyFilters.startDate || new Date(item.date) >= new Date(historyFilters.startDate)) &&
                                                        (!historyFilters.endDate || new Date(item.date) <= new Date(historyFilters.endDate)) &&
                                                        (!historyFilters.invoiceNo || item.invoiceNo === historyFilters.invoiceNo) &&
                                                        (!historyFilters.product || item.product === historyFilters.product) &&
                                                        (!historyFilters.truck || item.truck === historyFilters.truck) &&
                                                        (!historyFilters.status || item.status === historyFilters.status);

                                                    return matchesSearch && matchesFilters;
                                                }).reduce((sum, item) => sum + (parseFloat(item.due) || 0), 0).toLocaleString() || 0}
                                            </p>
                                        </div>
                                        <div className="bg-pink-50 p-4 rounded-xl border border-pink-100">
                                            <p className="text-xs text-pink-500 font-semibold mb-1">Total Discount</p>
                                            <p className="text-lg font-bold text-pink-700">
                                                ৳{viewData.salesHistory?.filter(item => {
                                                    const matchesSearch = !historySearchQuery ||
                                                        (item.invoiceNo && item.invoiceNo.toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                                                        (item.product && item.product.toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                                                        (item.status && item.status.toLowerCase().includes(historySearchQuery.toLowerCase()));

                                                    const matchesFilters =
                                                        (!historyFilters.startDate || new Date(item.date) >= new Date(historyFilters.startDate)) &&
                                                        (!historyFilters.endDate || new Date(item.date) <= new Date(historyFilters.endDate)) &&
                                                        (!historyFilters.invoiceNo || item.invoiceNo === historyFilters.invoiceNo) &&
                                                        (!historyFilters.product || item.product === historyFilters.product) &&
                                                        (!historyFilters.truck || item.truck === historyFilters.truck) &&
                                                        (!historyFilters.status || item.status === historyFilters.status);

                                                    return matchesSearch && matchesFilters;
                                                }).reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0).toLocaleString() || 0}
                                            </p>
                                        </div>
                                    </div>

                                    <h4 className="text-lg font-bold text-gray-800 mb-4">Sales History</h4>
                                    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-white border-b border-gray-200">
                                                <tr>
                                                    <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-600">Invoice No</th>
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
                                                <tr>
                                                    <td colSpan="10" className="px-4 py-12 text-center text-gray-400">
                                                        <div className="flex flex-col items-center">
                                                            <BoxIcon className="w-8 h-8 mb-2 opacity-20" />
                                                            <p>No transaction history available</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}

                            {/* Payment History Table */}
                            {activeHistoryTab === 'payment' && (
                                <>
                                    <h4 className="text-lg font-bold text-gray-800 mb-4">Payment History</h4>
                                    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-white border-b border-gray-200">
                                                <tr>
                                                    <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-600">Payment Method</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-600">Reference</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-600 text-right">Amount</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-600 text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-12 text-center text-gray-400">
                                                        <div className="flex flex-col items-center">
                                                            <BoxIcon className="w-8 h-8 mb-2 opacity-20" />
                                                            <p>No payment history available</p>
                                                        </div>
                                                    </td>
                                                </tr>
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
        </div >
    );
};

export default Customer;
