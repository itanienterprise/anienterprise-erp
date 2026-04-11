import React, { useState, useEffect, useRef, useMemo } from 'react';
import { EditIcon, TrashIcon, UserIcon, XIcon, SearchIcon, FunnelIcon, ChevronDownIcon, ChevronUpIcon, EyeIcon, BoxIcon, FileTextIcon, BarChartIcon, PrinterIcon, RefreshIcon } from '../../Icons';
import { API_BASE_URL, SortIcon, formatDate } from '../../../utils/helpers';
import { generateSaleInvoicePDF, generateCustomerHistoryPDF } from '../../../utils/pdfGenerator';
import { api } from '../../../utils/api';
import CustomDatePicker from '../../shared/CustomDatePicker';
import CustomerReport from './CustomerReport';
import './Customer.css';

const Customer = ({
    currentUser,
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
    const [showReport, setShowReport] = useState(false);
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
    const [historySortConfig, setHistorySortConfig] = useState({ key: 'date', direction: 'desc' });
    const [status, setStatus] = useState('Active'); // status state for form
    const [formData, setFormData] = useState({
        customerId: '',
        companyName: '',
        customerName: '',
        address: '',
        location: '',
        phone: '+880',
        customerType: 'General Customer',
        status: 'Active'
    });

    // History Filter State
    const [showHistoryFilterPanel, setShowHistoryFilterPanel] = useState(false);
    const historyFilterPanelRef = useRef(null);
    const historyFilterButtonRef = useRef(null);

    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [expandedRows, setExpandedRows] = useState([]);
    const [expandedMobileCards, setExpandedMobileCards] = useState(null);
    const [expandedSalesHistoryCards, setExpandedSalesHistoryCards] = useState(null);
    const [expandedPaymentHistoryCards, setExpandedPaymentHistoryCards] = useState(null);
    const [expandedAllHistoryCards, setExpandedAllHistoryCards] = useState(null);
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
            if (event.target && !document.body.contains(event.target)) {
                return;
            }
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
        } else if (activeHistoryTab === 'payment') {
            (viewData.paymentHistory || []).forEach(item => {
                if (type === 'lcNo' && item.lcNo) uniqueOptions.add(item.lcNo);
                if (type === 'method' && item.method) uniqueOptions.add(item.method);
                if (type === 'bankName' && item.bankName) uniqueOptions.add(item.bankName);
                if (type === 'mobileType' && item.mobileType) uniqueOptions.add(item.mobileType);
            });
        } else {
            // All Tab
            (viewData.salesHistory || []).forEach(item => {
                if (type === 'lcNo' && (item.lcNo || item.invoiceNo)) uniqueOptions.add(item.lcNo || item.invoiceNo);
                if (type === 'product' && item.product) uniqueOptions.add(item.product);
            });
            (viewData.paymentHistory || []).forEach(item => {
                if (type === 'lcNo' && item.lcNo) uniqueOptions.add(item.lcNo);
                if (type === 'method' && item.method) uniqueOptions.add(item.method);
                if (type === 'bankName' && item.bankName) uniqueOptions.add(item.bankName);
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

    const isFullAdmin = useMemo(() => {
        if (!currentUser) return false;
        if (currentUser.username === 'admin') return true;
        const role = (currentUser.role || '').toLowerCase();
        return role === 'admin';
    }, [currentUser]);

    useEffect(() => {
        fetchCustomers();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target && !document.body.contains(event.target)) {
                return;
            }
            if (showFilterPanel && filterPanelRef.current && !filterPanelRef.current.contains(event.target) && !filterButtonRef.current.contains(event.target)) {
                setShowFilterPanel(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showFilterPanel]);

    const generateNextCustomerId = (type, allCustomers) => {
        const prefix = type === 'Party Customer' ? 'B' : 'G';
        const typedCustomers = (allCustomers || []).filter(c => (c.customerId || '').startsWith(prefix));
        
        let maxNum = 0;
        typedCustomers.forEach(c => {
            const numPart = parseInt(c.customerId.substring(1));
            if (!isNaN(numPart) && numPart > maxNum) {
                maxNum = numPart;
            }
        });
        
        const nextNum = maxNum + 1;
        return `${prefix}${nextNum.toString().padStart(4, '0')}`;
    };

    const fetchCustomers = async () => {
        setIsLoading(true);
        try {
            const decryptedCustomers = await api.get('/api/customers');
            setCustomers(decryptedCustomers);
        } catch (error) {
            console.error('Error fetching customers:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        if (name === 'phone') {
            if (value.length > 14) return;
            if (!value.startsWith('+880')) {
                if ('+880'.startsWith(value)) {
                    setFormData(prev => ({ ...prev, [name]: '+880' }));
                    return;
                }
                return;
            }
        }

        if (name === 'customerType') {
            const nextId = !editingId ? generateNextCustomerId(value, customers) : formData.customerId;
            setFormData(prev => ({ ...prev, [name]: value, customerId: nextId }));
            return;
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
            const url = editingId ? `/api/customers/${editingId}` : `/api/customers`;
            if (editingId) {
                await api.put(url, formData);
            } else {
                await api.post(url, formData);
            }
            setSubmitStatus('success');
            fetchCustomers();
            setTimeout(() => {
                setShowForm(false);
                setEditingId(null);
                resetForm();
                setSubmitStatus(null);
            }, 2000);
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
            const customer = await api.get(`/api/customers/${viewData._id}`);

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
            await api.put(`/api/customers/${viewData._id}`, updatedCustomer);

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
        } catch (error) {
            console.error('Error saving payment:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        const initialType = 'General Customer';
        const initialId = generateNextCustomerId(initialType, customers);
        setFormData({
            customerId: initialId,
            companyName: '',
            customerName: '',
            address: '',
            location: '',
            phone: '+880',
            customerType: initialType,
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
            phone: (customer.phone && customer.phone.startsWith('+880')) ? customer.phone : '+880',
            customerType: customer.customerType || 'General Customer',
            status: customer.status || 'Active'
        });
        setEditingId(customer._id);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        if (!isFullAdmin) return;
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

    const requestHistorySort = (key) => {
        let direction = 'asc';
        if (historySortConfig.key === key && historySortConfig.direction === 'asc') direction = 'desc';
        setHistorySortConfig({ key, direction });
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
    const filteredSalesHistory = useMemo(() => {
        const filtered = (viewData?.salesHistory || []).filter(item => {
            const matchesSearch = !historySearchQuery ||
                ((item.invoiceNo || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.lcNo || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.product || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.brand || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.truck || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.status || '').toLowerCase().includes(historySearchQuery.toLowerCase()));

            const matchesFilters =
                (!historyFilters.startDate || new Date(item.date) >= new Date(historyFilters.startDate)) &&
                (!historyFilters.endDate || new Date(item.date) <= new Date(historyFilters.endDate)) &&
                (!historyFilters.lcNo || item.invoiceNo === historyFilters.lcNo) &&
                (!historyFilters.product || item.product === historyFilters.product) &&
                (!historyFilters.truck || item.truck === historyFilters.truck) &&
                (!historyFilters.status || item.status === historyFilters.status);

            return matchesSearch && matchesFilters;
        });

        if (!historySortConfig.key) return filtered;

        return [...filtered].sort((a, b) => {
            const { key, direction } = historySortConfig;
            let aVal = a[key];
            let bVal = b[key];

            if (key === 'date') {
                aVal = new Date(a.date);
                bVal = new Date(b.date);
            } else if (key === 'amount' || key === 'rate' || key === 'quantity' || key === 'paid' || key === 'discount') {
                aVal = parseFloat(a[key]) || 0;
                bVal = parseFloat(b[key]) || 0;
            }

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [viewData, historySearchQuery, historyFilters, historySortConfig]);

    const filteredPaymentHistory = useMemo(() => {
        const filtered = (viewData?.paymentHistory || []).filter(item => {
            const matchesSearch = !historySearchQuery ||
                ((item.method || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.bankName || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.mobileType || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.accountNo || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.branch || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.reference || '').toLowerCase().includes(historySearchQuery.toLowerCase()));

            const matchesFilters =
                (!historyFilters.startDate || new Date(item.date) >= new Date(historyFilters.startDate)) &&
                (!historyFilters.endDate || new Date(item.date) <= new Date(historyFilters.endDate)) &&
                (!historyFilters.lcNo || item.lcNo === historyFilters.lcNo) &&
                (!historyFilters.method || item.method === historyFilters.method) &&
                (!historyFilters.bankName || item.bankName === historyFilters.bankName) &&
                (!historyFilters.mobileType || item.mobileType === historyFilters.mobileType);

            return matchesSearch && matchesFilters;
        });

        if (!historySortConfig.key) return filtered;

        return [...filtered].sort((a, b) => {
            const { key, direction } = historySortConfig;
            let aVal = a[key];
            let bVal = b[key];

            if (key === 'date') {
                aVal = new Date(a.date);
                bVal = new Date(b.date);
            } else if (key === 'amount') {
                aVal = parseFloat(a[key]) || 0;
                bVal = parseFloat(b[key]) || 0;
            }

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [viewData, historySearchQuery, historyFilters, historySortConfig]);

    const combinedHistory = useMemo(() => {
        if (!viewData) return [];
        
        // Combine sales and payments
        const sales = (viewData.salesHistory || []).map(s => ({
            ...s,
            type: 'sale',
            sortDate: new Date(s.date)
        }));
        
        const payments = (viewData.paymentHistory || []).map(p => ({
            ...p,
            type: 'payment',
            sortDate: new Date(p.date)
        }));
        
        // Combine and sort chronologically (earliest first for absolute balance calculation)
        const all = [...sales, ...payments].sort((a, b) => a.sortDate - b.sortDate);
        
        // Calculate running balance on ALL history records
        let currentBalance = 0;
        const historyWithBalance = all.map(item => {
            if (item.type === 'sale') {
                const amt = parseFloat(item.amount) || 0;
                const pd = parseFloat(item.paid) || 0;
                const disc = parseFloat(item.discount) || 0;
                currentBalance += (amt - pd - disc);
            } else {
                const amt = parseFloat(item.amount) || 0;
                currentBalance -= amt;
            }
            return { ...item, runningBalance: currentBalance };
        });

        // Now filter the records with balance info
        const filteredAll = historyWithBalance.filter(item => {
            const matchesSearch = !historySearchQuery ||
                ((item.invoiceNo || item.lcNo || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.product || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.method || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.reference || '').toLowerCase().includes(historySearchQuery.toLowerCase()));

            const matchesFilters =
                (!historyFilters.startDate || new Date(item.date) >= new Date(historyFilters.startDate)) &&
                (!historyFilters.endDate || new Date(item.date) <= new Date(historyFilters.endDate)) &&
                (!historyFilters.lcNo || (item.invoiceNo === historyFilters.lcNo || item.lcNo === historyFilters.lcNo)) &&
                (!historyFilters.product || item.product === historyFilters.product) &&
                (!historyFilters.method || item.method === historyFilters.method);
                
            return matchesSearch && matchesFilters;
        });

        const { key, direction } = historySortConfig;
        return [...filteredAll].sort((a, b) => {
            let aVal = a[key];
            let bVal = b[key];

            if (key === 'date') {
                aVal = new Date(a.date);
                bVal = new Date(b.date);
            } else if (key === 'lcNo') {
                aVal = (a.invoiceNo || a.lcNo || '').toLowerCase();
                bVal = (b.invoiceNo || b.lcNo || '').toLowerCase();
            } else if (key === 'amount') {
                aVal = a.type === 'sale' ? (parseFloat(a.amount) || 0) : 0;
                bVal = b.type === 'sale' ? (parseFloat(b.amount) || 0) : 0;
            } else if (key === 'paid') {
                aVal = a.type === 'sale' ? (parseFloat(a.paid) || 0) : (parseFloat(a.amount) || 0);
                bVal = b.type === 'sale' ? (parseFloat(b.paid) || 0) : (parseFloat(b.amount) || 0);
            } else if (key === 'balance') {
                aVal = a.runningBalance;
                bVal = b.runningBalance;
            } else if (key === 'rate' || key === 'quantity') {
                aVal = parseFloat(a[key]) || 0;
                bVal = parseFloat(b[key]) || 0;
            } else if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = (bVal || '').toLowerCase();
            }

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [viewData, historySearchQuery, historyFilters, historySortConfig]);

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
        <>
            <div className="customer-container space-y-6">
                {!showForm && (
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                        <div className="w-full md:w-1/4">
                            <h2 className="text-xl md:text-2xl font-bold text-gray-800 text-center md:text-left">Customer Management</h2>
                        </div>

                        <div className="w-full md:flex-1 max-w-none md:max-w-md mx-auto relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by ID, Company, Name, Location or Phone..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="block w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                autoComplete="off"
                            />
                        </div>

                        <div className="w-full md:w-auto flex flex-row items-center justify-between md:justify-end gap-2">
                            <button
                                onClick={() => setShowReport(true)}
                                className="flex-1 md:flex-none w-full md:w-auto flex justify-center items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 h-[42px]"
                            >
                                <BarChartIcon className="w-4 h-4 text-gray-400 hidden sm:block" />
                                <span className="text-sm font-medium">Report</span>
                            </button>
                            <button
                                onClick={() => {
                                    if (!showForm) resetForm();
                                    setShowForm(!showForm);
                                }}
                                className="flex-1 md:flex-none w-full md:w-auto flex justify-center items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:scale-105 h-[42px]"
                            >
                                <span className="text-sm font-medium">+ Add New</span>
                            </button>
                        </div>
                    </div>
                )}

                {!showForm && (
                    <div className="flex items-center justify-between w-full md:w-auto">
                        <div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-xl w-full md:w-fit justify-between md:justify-start">
                            {['All Customer', 'General Customer', 'Party Customer'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setFilters({ type })}
                                    className={`flex-1 md:flex-none px-4 md:px-6 py-2 rounded-lg text-sm font-bold transition-all text-center ${filters.type === type
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
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
                        <form onSubmit={handleSubmit} autoComplete="off" className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 relative z-10">
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
                                <label className="text-sm font-medium text-gray-700">ID</label>
                                <input
                                    type="text"
                                    name="customerId"
                                    value={formData.customerId}
                                    onChange={handleInputChange}
                                    readOnly
                                    required
                                    placeholder="Customer ID"
                                    autoComplete="off"
                                    className="w-full px-4 py-2 bg-gray-50/80 border border-gray-200/60 rounded-lg focus:ring-0 focus:border-gray-200 outline-none transition-all backdrop-blur-sm font-semibold text-gray-600 cursor-not-allowed"
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
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Address</label>
                                <textarea
                                    name="address"
                                    value={formData.address}
                                    onChange={handleInputChange}
                                    required
                                    rows="1"
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
                            <div className="col-span-1 lg:col-span-2 customer-form-footer">
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
                                <div className="overflow-x-auto min-w-full">
                                    {/* Desktop Table View */}
                                    <table className="w-full text-left hidden md:table">
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
                                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Balance</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {getFilteredAndSortedData().map(c => {
                                                // Calculate this customer's total due
                                                const custSales = c.salesHistory || [];
                                                const custPayments = c.paymentHistory || [];

                                                const totalSalesAmount = custSales.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
                                                const totalSalesPaid = custSales.reduce((sum, item) => sum + (parseFloat(item.paid) || 0), 0);
                                                const totalSalesDiscount = custSales.reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0);
                                                const totalHistoryPaid = custPayments.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

                                                const custTotalDue = Math.max(0, totalSalesAmount - totalSalesPaid - totalSalesDiscount - totalHistoryPaid);

                                                return (
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
                                                        <td className="px-6 py-4 text-sm font-bold text-red-600 text-right">
                                                            {Math.round(custTotalDue).toLocaleString('en-IN')}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-600"><span className={`customer-status-badge ${c.status === 'Active' ? 'active' : 'inactive'}`}>{c.status}</span></td>
                                                        <td className="px-6 py-4 text-sm text-gray-600">
                                                            <div className="flex items-center justify-center space-x-2">
                                                                <button onClick={(e) => { e.stopPropagation(); setViewData(c); }} className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded transition-colors"><EyeIcon className="w-5 h-5" /></button>
                                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(c); }} className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors"><EditIcon className="w-5 h-5" /></button>
                                                                {isFullAdmin && (
                                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(c._id); }} className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"><TrashIcon className="w-5 h-5" /></button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>

                                    {/* Mobile Card View */}
                                    <div className="block md:hidden px-1 py-4 space-y-3">
                                        {getFilteredAndSortedData().map(c => {
                                            const custSales = c.salesHistory || [];
                                            const custPayments = c.paymentHistory || [];

                                            const totalSalesAmount = custSales.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
                                            const totalSalesPaid = custSales.reduce((sum, item) => sum + (parseFloat(item.paid) || 0), 0);
                                            const totalSalesDiscount = custSales.reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0);
                                            const totalHistoryPaid = custPayments.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

                                            const custTotalDue = Math.max(0, totalSalesAmount - totalSalesPaid - totalSalesDiscount - totalHistoryPaid);
                                            const isExpanded = expandedMobileCards === c._id;

                                            return (
                                                <div 
                                                    key={c._id} 
                                                    className={`mobile-card transition-all duration-300 ${isExpanded ? 'expanded' : 'collapsed'}`}
                                                    onClick={() => {
                                                        setExpandedMobileCards(isExpanded ? null : c._id);
                                                    }}
                                                >
                                                    <div className="mobile-card-header">
                                                        <div className="flex-1 min-w-0 pr-2">
                                                            <div className="mobile-card-title truncate">{c.companyName}</div>
                                                            <div className="text-[10px] text-gray-500 truncate">
                                                                ID: {c.customerId} | {c.customerType}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`customer-status-badge ${c.status === 'Active' ? 'active' : 'inactive'} flex items-center justify-center`}>
                                                                {isExpanded ? (
                                                                    <span className="shrink-0">{c.status}</span>
                                                                ) : (
                                                                    <span className="font-bold">
                                                                        ৳{Math.round(custTotalDue).toLocaleString('en-IN')}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    {isExpanded && (
                                                        <div className="animate-in slide-in-from-top-2 duration-300">
                                                            <div className="space-y-2 mt-4">
                                                                <div className="mobile-card-row">
                                                                    <span className="mobile-card-label">Customer:</span>
                                                                    <span className="mobile-card-value">{c.customerName}</span>
                                                                </div>
                                                                <div className="mobile-card-row">
                                                                    <span className="mobile-card-label">Location:</span>
                                                                    <span className="mobile-card-value">{c.location}</span>
                                                                </div>
                                                                <div className="mobile-card-row">
                                                                    <span className="mobile-card-label">Phone:</span>
                                                                    <span className="mobile-card-value font-mono">{c.phone}</span>
                                                                </div>
                                                                <div className="mobile-card-row">
                                                                    <span className="mobile-card-label">Balance:</span>
                                                                    <span className="mobile-card-value text-red-600 font-bold">
                                                                        ৳{Math.round(custTotalDue).toLocaleString('en-IN')}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="mobile-card-actions">
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); setViewData(c); }} 
                                                                    className="flex items-center justify-center gap-1.5 py-2 bg-gray-50 text-gray-600 rounded-lg text-xs font-bold flex-1"
                                                                >
                                                                    <EyeIcon className="w-4 h-4" /> View
                                                                </button>
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); handleEdit(c); }} 
                                                                    className="flex items-center justify-center gap-1.5 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold flex-1"
                                                                >
                                                                    <EditIcon className="w-4 h-4" /> Edit
                                                                </button>
                                                                {isFullAdmin && (
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); handleDelete(c._id); }} 
                                                                        className="flex items-center justify-center gap-1.5 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold px-3"
                                                                    >
                                                                        <TrashIcon className="w-4 h-4" />
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
                        </div>
                    )
                }
                {
                    viewData && (
                        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"></div>
                            <div className="relative bg-white border border-gray-100 rounded-2xl shadow-2xl max-w-[1400px] w-full flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                                {/* Modal Header */}
                                <div className="relative px-4 py-4 md:px-8 md:py-6 border-b border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white flex-shrink-0 z-10 rounded-t-2xl">
                                    <div className="flex-1 text-left">
                                        <h2 className="text-xl font-bold text-gray-900">{viewData.companyName}</h2>
                                        {viewData.customerName && viewData.customerName !== viewData.companyName && (
                                            <p className="text-sm font-medium text-gray-600 mt-1">{viewData.customerName}</p>
                                        )}
                                        <p className="text-xs text-gray-500 mt-1">ID: {viewData.customerId}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{viewData.customerType}</p>
                                    </div>

                                    {/* Center Search bar */}
                                    <div className="flex-1 w-full md:max-w-sm md:mx-auto">
                                        <div className="relative group mb-3">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder={activeHistoryTab === 'sales' ? 'Search sales history...' : activeHistoryTab === 'payment' ? 'Search payment history...' : 'Search all history...'}
                                                value={historySearchQuery}
                                                onChange={(e) => setHistorySearchQuery(e.target.value)}
                                                className="block w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                            />
                                        </div>

                                        {/* Tab Navigation */}
                                        <div className="flex gap-1.5 justify-center">
                                            <button
                                                onClick={() => setActiveHistoryTab('sales')}
                                                className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeHistoryTab === 'sales'
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                    }`}
                                            >
                                                Sales History
                                            </button>
                                            <button
                                                onClick={() => setActiveHistoryTab('payment')}
                                                className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeHistoryTab === 'payment'
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                    }`}
                                            >
                                                Payment History
                                            </button>
                                            <button
                                                onClick={() => setActiveHistoryTab('all')}
                                                className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeHistoryTab === 'all'
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                    }`}
                                            >
                                                All History
                                            </button>
                                        </div>
                                    </div>

                                    <div className="w-full md:flex-1 flex md:self-start justify-center md:justify-end gap-2 md:relative">
                                        <button
                                            onClick={() => generateCustomerHistoryPDF(
                                                viewData,
                                                activeHistoryTab === 'sales' ? filteredSalesHistory : activeHistoryTab === 'payment' ? filteredPaymentHistory : combinedHistory,
                                                { totalAmount, totalPaid: totalPaidCalculated, totalDiscount, totalBalance: totalDueCalculated },
                                                historyFilters,
                                                activeHistoryTab
                                            )}
                                            className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full border bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm group"
                                        >
                                            <PrinterIcon className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                                            <span className="text-sm font-medium">Print</span>
                                        </button>

                                        <button
                                            ref={historyFilterButtonRef}
                                            onClick={() => setShowHistoryFilterPanel(!showHistoryFilterPanel)}
                                            className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full border transition-all shadow-sm ${showHistoryFilterPanel ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'}`}
                                        >
                                            <FunnelIcon className="w-4 h-4" />
                                            <span className="text-sm font-medium">Filter</span>
                                        </button>

                                        {showHistoryFilterPanel && (
                                            <>
                                                {/* Backdrop for mobile */}
                                                <div 
                                                    className="fixed inset-0 bg-gray-900/20 backdrop-blur-[2px] z-[40] md:hidden"
                                                    onClick={() => setShowHistoryFilterPanel(false)}
                                                ></div>
                                                <div
                                                    ref={historyFilterPanelRef}
                                                    className="absolute right-0 top-12 w-[320px] sm:w-[320px] max-sm:fixed max-sm:inset-x-0 max-sm:top-1/2 max-sm:-translate-y-1/2 max-sm:mx-4 max-sm:w-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 md:p-6 z-50 animate-in fade-in zoom-in-95 duration-200"
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
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <CustomDatePicker
                                                            label="START DATE"
                                                            value={historyFilters.startDate}
                                                            onChange={(e) => setHistoryFilters({ ...historyFilters, startDate: e.target.value })}
                                                            compact={true}
                                                            labelClassName="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider"
                                                        />
                                                        <CustomDatePicker
                                                            label="END DATE"
                                                            value={historyFilters.endDate}
                                                            onChange={(e) => setHistoryFilters({ ...historyFilters, endDate: e.target.value })}
                                                            compact={true}
                                                            rightAlign={true}
                                                            labelClassName="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider"
                                                        />
                                                    </div>

                                                    {/* LC No Filter */}
                                                    <div className="space-y-1.5 relative" ref={lcNoFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                                            {viewData?.customerType?.toLowerCase().includes('party') ? 'LC No' : 'Invoice No'}
                                                        </label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={historyFilterSearchInputs.lcNoSearch}
                                                                onChange={(e) => {
                                                                    setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, lcNoSearch: e.target.value });
                                                                    setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, lcNo: true });
                                                                }}
                                                                onFocus={() => setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, lcNo: true })}
                                                                placeholder={historyFilters.lcNo || `Search ${viewData?.customerType?.toLowerCase().includes('party') ? 'LC No' : 'Invoice No'}...`}
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
                                        </>
                                    )}

                                        <button onClick={() => setViewData(null)} className="absolute right-4 top-4 md:static p-2 hover:bg-gray-50 text-gray-400 hover:text-gray-600 rounded-full transition-all">
                                            <XIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-auto p-4 md:p-8 pt-6 md:pt-8 min-h-0">
                                    {/* Global Summary Cards */}
                                    <div className={`grid ${activeHistoryTab === 'all' ? 'grid-cols-2 md:grid-cols-4' : (activeHistoryTab === 'sales' ? 'grid-cols-2 md:grid-cols-6' : 'grid-cols-2 md:grid-cols-4')} gap-2 md:gap-3 mb-4 md:mb-8 summary-grid-mobile`}>
                                        {activeHistoryTab === 'sales' && (
                                            <>
                                                {viewData.customerType?.includes('Party') && (
                                                    <div className="bg-blue-50/50 p-3 md:p-4 rounded-2xl border border-blue-100 shadow-sm transition-all hover:shadow-md">
                                                        <p className="text-[9px] md:text-[10px] text-blue-500 font-bold uppercase tracking-wider mb-1">Total Truck</p>
                                                        <p className="text-base md:text-lg font-black text-blue-700">{totalTruck}</p>
                                                    </div>
                                                )}
                                                <div className="bg-emerald-50/50 p-3 md:p-4 rounded-2xl border border-emerald-100 shadow-sm transition-all hover:shadow-md">
                                                    <p className="text-[9px] md:text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-1">Total Quantity</p>
                                                    <p className="text-base md:text-lg font-black text-emerald-700">{totalQuantity}</p>
                                                </div>
                                            </>
                                        )}
                                        <div className="bg-violet-50/50 p-3 md:p-4 rounded-2xl border border-violet-100 shadow-sm transition-all hover:shadow-md">
                                            <p className="text-[9px] md:text-[10px] text-violet-500 font-bold uppercase tracking-wider mb-1">Total Amount</p>
                                            <p className="text-base md:text-lg font-black text-violet-700">৳{totalAmount.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-teal-50/50 p-3 md:p-4 rounded-2xl border border-teal-100 shadow-sm transition-all hover:shadow-md">
                                            <p className="text-[9px] md:text-[10px] text-teal-500 font-bold uppercase tracking-wider mb-1">Total Paid</p>
                                            <p className="text-base md:text-lg font-black text-teal-700">৳{totalPaidCalculated.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-pink-50/50 p-3 md:p-4 rounded-2xl border border-pink-100 shadow-sm transition-all hover:shadow-md">
                                            <p className="text-[9px] md:text-[10px] text-pink-500 font-bold uppercase tracking-wider mb-1">Total Discount</p>
                                            <p className="text-base md:text-lg font-black text-pink-700">৳{totalDiscount.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-orange-50/50 p-3 md:p-4 rounded-2xl border border-orange-100 shadow-sm transition-all hover:shadow-md">
                                            <p className="text-[9px] md:text-[10px] text-orange-500 font-bold uppercase tracking-wider mb-1">Total Balance</p>
                                            <p className="text-base md:text-lg font-black text-orange-700">৳{totalDueCalculated.toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {/* Sales History Table */}
                                    {activeHistoryTab === 'sales' && (
                                        <>
                                            <div className="flex items-center gap-4 mb-3 md:mb-4">
                                                <h4 className="text-base md:text-lg font-bold text-gray-800">Sales History</h4>
                                            </div>
                                            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                                {/* Desktop Sales History Table */}
                                                <table className="w-full text-left text-sm hidden md:table">
                                                    <thead className="bg-white border-b border-gray-200">
                                                        {viewData.customerType === 'Party Customer' ? (
                                                            <tr>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('date')}>
                                                                    <div className="flex items-center gap-1">
                                                                        <span>Date</span>
                                                                        <SortIcon config={historySortConfig} columnKey="date" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('lcNo')}>
                                                                    <div className="flex items-center gap-1">
                                                                        <span>LC No</span>
                                                                        <SortIcon config={historySortConfig} columnKey="lcNo" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('product')}>
                                                                    <div className="flex items-center gap-1">
                                                                        <span>Product</span>
                                                                        <SortIcon config={historySortConfig} columnKey="product" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('quantity')}>
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <span>Qty</span>
                                                                        <SortIcon config={historySortConfig} columnKey="quantity" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('truck')}>
                                                                    <div className="flex items-center gap-1">
                                                                        <span>Truck</span>
                                                                        <SortIcon config={historySortConfig} columnKey="truck" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('rate')}>
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <span>Rate</span>
                                                                        <SortIcon config={historySortConfig} columnKey="rate" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('amount')}>
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <span>Amount</span>
                                                                        <SortIcon config={historySortConfig} columnKey="amount" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('discount')}>
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <span>Discount</span>
                                                                        <SortIcon config={historySortConfig} columnKey="discount" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-center">Action</th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-center">Status</th>
                                                            </tr>
                                                        ) : (
                                                            <tr>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('date')}>
                                                                    <div className="flex items-center gap-1">
                                                                        <span>Date</span>
                                                                        <SortIcon config={historySortConfig} columnKey="date" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('lcNo')}>
                                                                    <div className="flex items-center gap-1">
                                                                        <span>Invoice No</span>
                                                                        <SortIcon config={historySortConfig} columnKey="lcNo" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('product')}>
                                                                    <div className="flex items-center gap-1">
                                                                        <span>Product</span>
                                                                        <SortIcon config={historySortConfig} columnKey="product" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('brand')}>
                                                                    <div className="flex items-center gap-1">
                                                                        <span>Brand</span>
                                                                        <SortIcon config={historySortConfig} columnKey="brand" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('quantity')}>
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <span>Qty</span>
                                                                        <SortIcon config={historySortConfig} columnKey="quantity" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('rate')}>
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <span>Rate</span>
                                                                        <SortIcon config={historySortConfig} columnKey="rate" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('amount')}>
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <span>Amount</span>
                                                                        <SortIcon config={historySortConfig} columnKey="amount" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('discount')}>
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <span>Discount</span>
                                                                        <SortIcon config={historySortConfig} columnKey="discount" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-center">Action</th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-center">Status</th>
                                                            </tr>
                                                        )}
                                                    </thead>
                                                    <tbody>
                                                        {filteredSalesHistory && filteredSalesHistory.length > 0 ? (
                                                            Object.entries(
                                                                filteredSalesHistory.reduce((groups, item) => {
                                                                    const invoice = item.invoiceNo || 'Unknown';
                                                                    if (!groups[invoice]) {
                                                                        groups[invoice] = {
                                                                            invoiceNo: invoice,
                                                                            lcNo: item.lcNo || '',
                                                                            date: item.date,
                                                                            status: item.status,
                                                                            items: [],
                                                                            totalAmount: 0,
                                                                            totalDiscount: 0,
                                                                            totalQty: 0,
                                                                            trucks: new Set()
                                                                        };
                                                                    }
                                                                    groups[invoice].items.push(item);
                                                                    groups[invoice].totalAmount += parseFloat(item.amount || 0);
                                                                    groups[invoice].totalDiscount += parseFloat(item.discount || 0);
                                                                    groups[invoice].totalQty += parseFloat(item.quantity || 0);
                                                                    if (item.lcNo && !groups[invoice].lcNo) groups[invoice].lcNo = item.lcNo;
                                                                    if (item.truck) groups[invoice].trucks.add(item.truck);
                                                                    return groups;
                                                                }, {})
                                                            ).map(([invoiceNo, group], index) => {
                                                                const isExpanded = expandedRows.includes(invoiceNo);
                                                                const isMulti = group.items.length > 1;
                                                                const toggleRow = () => {
                                                                    if (!isMulti) return;
                                                                    if (isExpanded) {
                                                                        setExpandedRows(expandedRows.filter(id => id !== invoiceNo));
                                                                    } else {
                                                                        setExpandedRows([...expandedRows, invoiceNo]);
                                                                    }
                                                                };
                                                                const isParty = viewData?.customerType?.toLowerCase().includes('party');
                                                                const colSpan = isParty ? "10" : "10";

                                                                return (
                                                                    <React.Fragment key={index}>
                                                                        {/* Summary/Single Row */}
                                                                        <tr
                                                                            onClick={toggleRow}
                                                                            className={`border-b border-gray-100 bg-white transition-colors ${isMulti ? 'hover:bg-blue-50/50 cursor-pointer group' : ''} ${isExpanded ? 'bg-blue-50/30' : ''}`}
                                                                        >
                                                                            <td className="px-4 py-4 text-gray-600 font-medium whitespace-nowrap">
                                                                                <div className="flex items-center gap-2">
                                                                                    {isMulti ? (
                                                                                        isExpanded ? <ChevronUpIcon className="w-4 h-4 text-blue-500" /> : <ChevronDownIcon className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                                                                                    ) : (
                                                                                        <div className="w-4" /> // Spacer instead of chevron
                                                                                    )}
                                                                                    {formatDate(group.date)}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-4 py-4 text-gray-900 font-bold uppercase tracking-tight">
                                                                                {isParty ? (group.lcNo || group.invoiceNo) : (group.invoiceNo)}
                                                                            </td>
                                                                            <td className="px-4 py-4">
                                                                                {isMulti ? (
                                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700 uppercase tracking-wider">
                                                                                        Multiple
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-gray-900 font-medium">{group.items[0]?.product || '-'}</span>
                                                                                )}
                                                                            </td>
                                                                            {/* Column 4: Qty (Party) or Brand (General) */}
                                                                            {isParty ? (
                                                                                <td className="px-4 py-4 text-right font-bold text-gray-900">{group.totalQty.toLocaleString()}</td>
                                                                            ) : (
                                                                                <td className="px-4 py-4">
                                                                                    {isMulti ? (
                                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700 uppercase tracking-wider">
                                                                                            Multiple
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-gray-600 font-medium">{group.items[0]?.brand || '-'}</span>
                                                                                    )}
                                                                                </td>
                                                                            )}
                                                                            {/* Column 5: Truck (Party) or Qty (General) */}
                                                                            {isParty ? (
                                                                                <td className="px-4 py-4 text-center text-gray-900 font-bold">
                                                                                    {isMulti ? (group.trucks.size > 0 ? group.trucks.size : '-') : (group.items[0]?.truck || '-')}
                                                                                </td>
                                                                            ) : (
                                                                                <td className="px-4 py-4 text-right font-bold text-gray-900">{group.totalQty.toLocaleString()}</td>
                                                                            )}
                                                                            {/* Column 6: Rate */}
                                                                            <td className="px-4 py-4 text-right font-bold text-gray-500">
                                                                                {isMulti ? (
                                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700 uppercase tracking-wider">
                                                                                        Multiple
                                                                                    </span>
                                                                                ) : (group.items[0]?.rate ? `৳${parseFloat(group.items[0].rate).toLocaleString()}` : (group.totalQty > 0 ? `৳${(group.totalAmount / group.totalQty).toFixed(2)}` : '-'))}
                                                                            </td>
                                                                            <td className="px-4 py-4 text-right font-black text-violet-700">৳{group.totalAmount.toLocaleString()}</td>
                                                                            <td className="px-4 py-4 text-right font-bold text-pink-600">৳{group.totalDiscount.toLocaleString()}</td>
                                                                            <td className="px-4 py-4 text-center">
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        // Reconstruct a sale object for the PDF generator
                                                                                        const firstItem = group.items[0];
                                                                                        const saleObject = {
                                                                                             ...firstItem,
                                                                                             date: group.date,
                                                                                             invoiceNo: group.invoiceNo,
                                                                                             customerId: viewData?._id,
                                                                                             customerName: viewData?.customerName,
                                                                                             companyName: viewData?.companyName,
                                                                                             address: viewData?.address,
                                                                                             contact: viewData?.phone,
                                                                                             customerType: viewData?.customerType,
                                                                                             items: group.items,
                                                                                             totalAmount: group.totalAmount,
                                                                                             discount: group.totalDiscount,
                                                                                             paid: firstItem?.paid || 0,
                                                                                             status: group.status
                                                                                         };
                                                                                         generateSaleInvoicePDF(saleObject);
                                                                                     }}
                                                                                     className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-blue-600 rounded-lg transition-colors"
                                                                                 >
                                                                                     <FileTextIcon className="w-4 h-4" />
                                                                                 </button>
                                                                             </td>
                                                                            <td className="px-4 py-4 text-center">
                                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${group.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                                    {group.status}
                                                                                </span>
                                                                            </td>
                                                                        </tr>

                                                                        {/* Detailed Rows */}
                                                                        {isExpanded && group.items.map((item, idx) => (
                                                                            <tr key={`${index}-${idx}`} className="bg-blue-50/10 border-b border-gray-50/50">
                                                                                <td className="px-4 py-3 pl-10 text-xs text-gray-400"></td>
                                                                                <td className="px-4 py-3 text-xs text-gray-500 italic">{item.lcNo || '-'}</td>
                                                                                <td className="px-4 py-3 text-xs text-gray-900 font-medium">{item.product}</td>
                                                                                {isParty ? (
                                                                                    <td className="px-4 py-3 text-right text-xs font-bold text-gray-900">{parseFloat(item.quantity).toLocaleString()}</td>
                                                                                ) : (
                                                                                    <td className="px-4 py-3 text-xs text-gray-600">{item.brand || '-'}</td>
                                                                                )}
                                                                                {isParty ? (
                                                                                    viewData.customerType?.includes('Party') ? (
                                                                                        <td className="px-4 py-3 text-center text-xs text-gray-900 font-medium">{item.truck || '-'}</td>
                                                                                    ) : null
                                                                                ) : (
                                                                                    <td className="px-4 py-3 text-right text-xs font-bold text-gray-900">{parseFloat(item.quantity).toLocaleString()}</td>
                                                                                )}
                                                                                <td className="px-4 py-3 text-right text-xs text-gray-500">৳{parseFloat(item.rate).toLocaleString()}</td>
                                                                                <td className="px-4 py-3 text-right text-xs font-bold text-violet-600">৳{parseFloat(item.amount).toLocaleString()}</td>
                                                                                <td className="px-4 py-3 text-right text-xs font-bold text-pink-500">৳{parseFloat(item.discount || 0).toLocaleString()}</td>
                                                                                <td className="px-4 py-3"></td>
                                                                                <td className="px-4 py-3"></td>
                                                                            </tr>
                                                                        ))}
                                                                    </React.Fragment>
                                                                );
                                                            })
                                                        ) : (
                                                            <tr>
                                                                <td colSpan="10" className="px-4 py-8 text-center text-gray-400 font-medium italic">No sales history found matching filters</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>

                                                {/* Mobile Sales History Card View */}
                                                <div className="block md:hidden p-4 space-y-3">
                                                    {filteredSalesHistory && filteredSalesHistory.length > 0 ? (
                                                        Object.entries(
                                                            filteredSalesHistory.reduce((groups, item) => {
                                                                const invoice = item.invoiceNo || 'Unknown';
                                                                if (!groups[invoice]) {
                                                                    groups[invoice] = {
                                                                        invoiceNo: invoice,
                                                                        lcNo: item.lcNo || '',
                                                                        date: item.date,
                                                                        status: item.status,
                                                                        items: [],
                                                                        totalAmount: 0,
                                                                        totalDiscount: 0,
                                                                        totalQty: 0,
                                                                        trucks: new Set()
                                                                    };
                                                                }
                                                                groups[invoice].items.push(item);
                                                                groups[invoice].totalAmount += parseFloat(item.amount || 0);
                                                                groups[invoice].totalDiscount += parseFloat(item.discount || 0);
                                                                groups[invoice].totalQty += parseFloat(item.quantity || 0);
                                                                if (item.lcNo && !groups[invoice].lcNo) groups[invoice].lcNo = item.lcNo;
                                                                if (item.truck) groups[invoice].trucks.add(item.truck);
                                                                return groups;
                                                            }, {})
                                                        ).map(([invoiceNo, group], index) => {
                                                            const isParty = viewData?.customerType?.toLowerCase().includes('party');
                                                            const isExpanded = expandedSalesHistoryCards === invoiceNo;
                                                            return (
                                                                <div 
                                                                    key={index} 
                                                                    className={`mobile-card transition-all duration-300 ${isExpanded ? 'expanded' : 'collapsed'}`}
                                                                    onClick={() => {
                                                                        setExpandedSalesHistoryCards(isExpanded ? null : invoiceNo);
                                                                    }}
                                                                >
                                                                    <div className="mobile-card-header">
                                                                        <div>
                                                                            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{formatDate(group.date)}</div>
                                                                            <div className="text-sm font-black text-gray-900">{isParty ? (group.lcNo || group.invoiceNo) : (group.invoiceNo)}</div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`customer-status-badge ${group.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                                {isExpanded ? (
                                                                                    <span className="shrink-0">{group.status}</span>
                                                                                ) : (
                                                                                    <span className="font-bold">
                                                                                        ৳{group.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[800px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                                                                        <div className="space-y-1">
                                                                            <div className="flex justify-between text-xs">
                                                                                <span className="text-gray-500">Products:</span>
                                                                                <span className="font-bold text-gray-900">
                                                                                    {group.items.length > 1 ? `${group.items.length} Items` : group.items[0]?.product}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex justify-between text-xs">
                                                                                <span className="text-gray-500">Total Qty:</span>
                                                                                <span className="font-bold text-gray-900">{group.totalQty.toLocaleString()}</span>
                                                                            </div>
                                                                            <div className="flex justify-between text-xs pt-1 border-t border-gray-100 mt-1">
                                                                                <span className="text-gray-500">Amount:</span>
                                                                                <span className="font-black text-violet-700">৳{group.totalAmount.toLocaleString()}</span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex gap-2 mt-3">
                                                                            <button 
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const firstItem = group.items[0];
                                                                                    const saleObject = {
                                                                                        ...firstItem,
                                                                                        date: group.date,
                                                                                        invoiceNo: group.invoiceNo,
                                                                                        customerId: viewData?._id,
                                                                                        customerName: viewData?.customerName,
                                                                                        companyName: viewData?.companyName,
                                                                                        address: viewData?.address,
                                                                                        contact: viewData?.phone,
                                                                                        customerType: viewData?.customerType,
                                                                                        items: group.items,
                                                                                        totalAmount: group.totalAmount,
                                                                                        discount: group.totalDiscount,
                                                                                        paid: firstItem?.paid || 0,
                                                                                        status: group.status
                                                                                    };
                                                                                    generateSaleInvoicePDF(saleObject);
                                                                                }}
                                                                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-[10px] font-bold"
                                                                            >
                                                                                <FileTextIcon className="w-3 h-3" /> Print Invoice
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="py-8 text-center text-xs text-gray-400 font-medium italic">No sales history found matching filters</div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Payment History Table */}
                                    {activeHistoryTab === 'payment' && (
                                        <>
                                            <div className="flex items-center justify-between mb-3 md:mb-4">
                                                <h4 className="text-base md:text-lg font-bold text-gray-800">Payment History</h4>
                                            </div>

                                            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                                {/* Desktop Payment History Table */}
                                                <table className="w-full text-left text-sm hidden md:table">
                                                    <thead className="bg-white border-b border-gray-200">
                                                        <tr>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('date')}>
                                                                <div className="flex items-center gap-1">
                                                                    <span>Date</span>
                                                                    <SortIcon config={historySortConfig} columnKey="date" />
                                                                </div>
                                                            </th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('method')}>
                                                                <div className="flex items-center gap-1">
                                                                    <span>Payment<br />Method</span>
                                                                    <SortIcon config={historySortConfig} columnKey="method" />
                                                                </div>
                                                            </th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('bankName')}>
                                                                <div className="flex items-center gap-1">
                                                                    <span>Bank Name <br />Mobile Banking</span>
                                                                    <SortIcon config={historySortConfig} columnKey="bankName" />
                                                                </div>
                                                            </th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('branch')}>
                                                                <div className="flex items-center gap-1">
                                                                    <span>Branch</span>
                                                                    <SortIcon config={historySortConfig} columnKey="branch" />
                                                                </div>
                                                            </th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('accountNo')}>
                                                                <div className="flex items-center gap-1">
                                                                    <span>Account No</span>
                                                                    <SortIcon config={historySortConfig} columnKey="accountNo" />
                                                                </div>
                                                            </th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('amount')}>
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <span>Amount</span>
                                                                    <SortIcon config={historySortConfig} columnKey="amount" />
                                                                </div>
                                                            </th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 text-center">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredPaymentHistory && filteredPaymentHistory.length > 0 ? (
                                                            filteredPaymentHistory.map((payment, index) => (
                                                                <tr key={payment.id || index} className="border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors">
                                                                    <td className="px-4 py-3 text-gray-600">{formatDate(payment.date)}</td>
                                                                    <td className="px-4 py-3 font-medium text-gray-900">{payment.method}</td>
                                                                    <td className="px-4 py-3 text-gray-600">
                                                                        <span className="font-semibold text-xs">
                                                                            {payment.method === 'Cash' ? (payment.receiveBy || '—') : (payment.bankName || '—')}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-gray-600 text-xs">
                                                                        {payment.method === 'Cash' ? (payment.place || '—') :
                                                                            (payment.method === 'Mobile Banking' ? '—' : (payment.branch || '—'))}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-gray-600 text-xs">
                                                                        {payment.accountNo || '-'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                                                                        <div className="flex flex-col items-end">
                                                                            <span>৳{parseFloat(payment.amount).toLocaleString()}</span>
                                                                            {payment.reference && <span className="text-[9px] text-blue-500 font-normal">Ref: {payment.reference}</span>}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold">
                                                                            {payment.status || 'Received'}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        ) : (
                                                            <tr>
                                                                <td colSpan="7" className="px-4 py-8 text-center text-gray-400 font-medium italic">No payment history found matching filters</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>

                                                {/* Mobile Payment History Card View */}
                                                <div className="block md:hidden p-4 space-y-3">
                                                    {filteredPaymentHistory && filteredPaymentHistory.length > 0 ? (
                                                        filteredPaymentHistory.map((payment, index) => {
                                                            const isExpanded = expandedPaymentHistoryCards === index;
                                                            return (
                                                                <div 
                                                                    key={index} 
                                                                    className={`mobile-card transition-all duration-300 ${isExpanded ? 'expanded' : 'collapsed'}`}
                                                                    onClick={() => {
                                                                        setExpandedPaymentHistoryCards(isExpanded ? null : index);
                                                                    }}
                                                                >
                                                                    <div className="mobile-card-header">
                                                                        <div>
                                                                            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{formatDate(payment.date)}</div>
                                                                            <div className="text-sm font-black text-gray-900">{payment.method}</div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`customer-status-badge ${payment.status === 'Completed' || payment.status === 'Received' || !payment.status ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                                {isExpanded ? (
                                                                                    <span className="shrink-0">{payment.status || 'Received'}</span>
                                                                                ) : (
                                                                                    <span className="font-bold">
                                                                                        ৳{parseFloat(payment.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                                                                        <div className="space-y-1">
                                                                            {(payment.bankName || payment.receiveBy) && (
                                                                                <div className="flex justify-between text-xs">
                                                                                    <span className="text-gray-500">
                                                                                        {payment.method === 'Cash' ? 'Received By:' : 'Bank/Provider:'}
                                                                                    </span>
                                                                                    <span className="font-bold text-gray-900">
                                                                                        {payment.method === 'Cash' ? payment.receiveBy : payment.bankName}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            {payment.method === 'Cash' && payment.place && (
                                                                                <div className="flex justify-between text-xs">
                                                                                    <span className="text-gray-500">Place:</span>
                                                                                    <span className="font-bold text-gray-900">{payment.place}</span>
                                                                                </div>
                                                                            )}
                                                                            {payment.method !== 'Cash' && payment.method !== 'Mobile Banking' && payment.branch && (
                                                                                <div className="flex justify-between text-xs">
                                                                                    <span className="text-gray-500">Branch:</span>
                                                                                    <span className="font-bold text-gray-900">{payment.branch}</span>
                                                                                </div>
                                                                            )}
                                                                            {payment.accountNo && (
                                                                                <div className="flex justify-between text-xs">
                                                                                    <span className="text-gray-500">Account No:</span>
                                                                                    <span className="font-mono text-gray-900">{payment.accountNo}</span>
                                                                                </div>
                                                                            )}
                                                                            <div className="flex justify-between text-xs pt-1 border-t border-gray-100 mt-1">
                                                                                <span className="text-gray-500">Amount:</span>
                                                                                <span className="font-black text-emerald-600">৳{parseFloat(payment.amount).toLocaleString()}</span>
                                                                            </div>
                                                                            {payment.reference && (
                                                                                <div className="text-[10px] text-blue-500 italic mt-1">
                                                                                    Ref: {payment.reference}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="py-8 text-center text-xs text-gray-400 font-medium italic">No payment history found</div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* All History Table */}
                                    {activeHistoryTab === 'all' && (
                                        <>
                                            <div className="flex items-center justify-between mb-3 md:mb-4">
                                                <h4 className="text-base md:text-lg font-bold text-gray-800">All Transaction History</h4>
                                            </div>

                                            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                                <div className="overflow-x-auto min-w-full">
                                                    <table className="w-full text-left text-sm hidden md:table">
                                                        <thead className="bg-white border-b border-gray-200">
                                                            <tr>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('date')}>
                                                                    <div className="flex items-center gap-1">
                                                                        <span>Date</span>
                                                                        <SortIcon config={historySortConfig} columnKey="date" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('lcNo')}>
                                                                    <div className="flex items-center gap-1">
                                                                        <span>{viewData?.customerType?.toLowerCase().includes('party') ? 'LC No' : 'Invoice No'}</span>
                                                                        <SortIcon config={historySortConfig} columnKey="lcNo" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('product')}>
                                                                    <div className="flex items-center gap-1">
                                                                        <span>Product</span>
                                                                        <SortIcon config={historySortConfig} columnKey="product" />
                                                                    </div>
                                                                </th>
                                                                {viewData.customerType?.includes('Party') && (
                                                                    <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('truck')}>
                                                                        <div className="flex items-center gap-1">
                                                                            <span>Truck</span>
                                                                            <SortIcon config={historySortConfig} columnKey="truck" />
                                                                        </div>
                                                                    </th>
                                                                )}
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('quantity')}>
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <span>Qty</span>
                                                                        <SortIcon config={historySortConfig} columnKey="quantity" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('rate')}>
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <span>Rate</span>
                                                                        <SortIcon config={historySortConfig} columnKey="rate" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('amount')}>
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <span>Amount</span>
                                                                        <SortIcon config={historySortConfig} columnKey="amount" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600">Payment Details</th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('paid')}>
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <span>Paid</span>
                                                                        <SortIcon config={historySortConfig} columnKey="paid" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('balance')}>
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <span>Balance</span>
                                                                        <SortIcon config={historySortConfig} columnKey="balance" />
                                                                    </div>
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {combinedHistory && combinedHistory.length > 0 ? (
                                                                combinedHistory.reduce((acc, item) => {
                                                                    const invoice = item.invoiceNo || item.lcNo;
                                                                    const existing = item.type === 'sale' && invoice 
                                                                        ? acc.find(x => x.type === 'sale' && (x.invoiceNo === invoice || x.lcNo === invoice))
                                                                        : null;
                                                                    
                                                                    if (existing) {
                                                                        existing.amount = (parseFloat(existing.amount) || 0) + (parseFloat(item.amount) || 0);
                                                                        existing.paid = (parseFloat(existing.paid) || 0) + (parseFloat(item.paid) || 0);
                                                                        existing.truck = (parseFloat(existing.truck) || 0) + (parseFloat(item.truck) || 0);
                                                                        
                                                                        // Initialize sub-items for merging logic if not present
                                                                        if (!existing.items) {
                                                                            existing.items = [{
                                                                                product: existing.product_original || existing.product,
                                                                                quantity: parseFloat(existing.quantity_original || existing.quantity),
                                                                                rate: parseFloat(existing.rate_original || existing.rate)
                                                                            }];
                                                                        }
                                                                        
                                                                        const itemRate = parseFloat(item.rate || 0);
                                                                        const matchingItem = existing.items.find(si => 
                                                                            (si.product?.trim() === item.product?.trim()) && 
                                                                            (parseFloat(si.rate || 0) === itemRate)
                                                                        );
                                                                        if (matchingItem) {
                                                                            matchingItem.quantity += parseFloat(item.quantity || 0);
                                                                        } else {
                                                                            existing.items.push({
                                                                                product: item.product,
                                                                                quantity: parseFloat(item.quantity || 0),
                                                                                rate: itemRate
                                                                            });
                                                                        }
                                                                        
                                                                        // Rebuild display properties
                                                                        existing.product = existing.items.map(si => si.product || '—').join('\n');
                                                                        existing.quantity_display = existing.items.map(si => si.quantity.toLocaleString()).join('\n');
                                                                        existing.rate_display = existing.items.map(si => si.rate > 0 ? `৳${si.rate.toLocaleString()}` : '—').join('\n');
                                                                        
                                                                        existing.quantity = (parseFloat(existing.quantity || 0)) + (parseFloat(item.quantity || 0));
                                                                        existing.runningBalance = item.runningBalance;
                                                                        return acc;
                                                                    }
                                                                    
                                                                    acc.push({ 
                                                                        ...item,
                                                                        product_original: item.product,
                                                                        quantity_original: item.quantity,
                                                                        rate_original: item.rate
                                                                    });
                                                                    return acc;
                                                                }, []).map((item, index) => (
                                                                    <tr key={index} className={`border-b border-gray-100 transition-colors hover:bg-gray-50 ${item.type === 'payment' ? 'bg-emerald-50/20' : 'bg-white'}`}>
                                                                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(item.date)}</td>
                                                                        <td className="px-4 py-3 font-bold text-gray-900 uppercase">{item.invoiceNo || item.lcNo || '—'}</td>
                                                                        <td className="px-4 py-3 text-gray-700 whitespace-pre-wrap">{item.product || '—'}</td>
                                                                         {viewData.customerType?.includes('Party') && (
                                                                            <td className="px-4 py-3 text-gray-700">{item.truck || '—'}</td>
                                                                        )}
                                                                        <td className="px-4 py-3 text-right text-gray-900 whitespace-pre-wrap">{item.quantity_display || (parseFloat(item.quantity || 0) > 0 ? parseFloat(item.quantity).toLocaleString() : '—')}</td>
                                                                        <td className="px-4 py-3 text-right text-gray-500 whitespace-pre-wrap">{item.rate_display || (parseFloat(item.rate || 0) > 0 ? `৳${parseFloat(item.rate).toLocaleString()}` : '—')}</td>
                                                                        <td className="px-4 py-3 text-right font-black text-violet-700">{item.type === 'sale' ? `৳${parseFloat(item.amount || 0).toLocaleString()}` : '—'}</td>
                                                                        <td className="px-4 py-3 text-gray-600 text-xs">
                                                                            {item.type === 'payment' ? (
                                                                                <div className="flex flex-col">
                                                                                    <span className="font-bold text-gray-900">{item.bankName || item.receiveBy || '—'}</span>
                                                                                    <span className="text-[10px] text-emerald-600 font-medium">
                                                                                        {item.method} {item.reference ? `(Ref: ${item.reference})` : ''}
                                                                                    </span>
                                                                                </div>
                                                                            ) : '—'}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right font-black text-emerald-600">
                                                                            {item.type === 'sale' 
                                                                                ? (parseFloat(item.paid || 0) > 0 ? `৳${parseFloat(item.paid).toLocaleString()}` : '—')
                                                                                : `৳${parseFloat(item.amount || 0).toLocaleString()}`
                                                                            }
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right font-black text-orange-600">৳{item.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                                    </tr>
                                                                ))
                                                            ) : (
                                                                <tr>
                                                                    <td colSpan="10" className="px-4 py-12 text-center text-gray-400 font-medium italic">No combined history found</td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>

                                                    {/* Mobile All History Card View */}
                                                    <div className="block md:hidden p-4 space-y-3">
                                                        {combinedHistory && combinedHistory.length > 0 ? (
                                                            combinedHistory.reduce((acc, item) => {
                                                                const invoice = item.invoiceNo || item.lcNo;
                                                                const existing = item.type === 'sale' && invoice 
                                                                    ? acc.find(x => x.type === 'sale' && (x.invoiceNo === invoice || x.lcNo === invoice))
                                                                    : null;
                                                                
                                                                 if (existing) {
                                                                    existing.amount = (parseFloat(existing.amount) || 0) + (parseFloat(item.amount) || 0);
                                                                    existing.paid = (parseFloat(existing.paid) || 0) + (parseFloat(item.paid) || 0);
                                                                    existing.truck = (parseFloat(existing.truck) || 0) + (parseFloat(item.truck) || 0);
                                                                    
                                                                    // Initialize sub-items for merging logic if not present
                                                                    if (!existing.items) {
                                                                        existing.items = [{
                                                                            product: existing.product_original || existing.product,
                                                                            quantity: parseFloat(existing.quantity_original || existing.quantity),
                                                                            rate: parseFloat(existing.rate_original || existing.rate)
                                                                        }];
                                                                    }
                                                                    
                                                                    const itemRate = parseFloat(item.rate || 0);
                                                                    const matchingItem = existing.items.find(si => 
                                                                        (si.product?.trim() === item.product?.trim()) && 
                                                                        (parseFloat(si.rate || 0) === itemRate)
                                                                    );
                                                                    if (matchingItem) {
                                                                        matchingItem.quantity += parseFloat(item.quantity || 0);
                                                                    } else {
                                                                        existing.items.push({
                                                                            product: item.product,
                                                                            quantity: parseFloat(item.quantity || 0),
                                                                            rate: itemRate
                                                                        });
                                                                    }
                                                                    
                                                                    // Rebuild display properties
                                                                    existing.product = existing.items.map(si => si.product || '—').join('\n');
                                                                    existing.quantity_display = existing.items.map(si => si.quantity.toLocaleString()).join('\n');
                                                                    existing.rate_display = existing.items.map(si => si.rate > 0 ? `৳${si.rate.toLocaleString()}` : '—').join('\n');
                                                                    
                                                                    existing.quantity = (parseFloat(existing.quantity || 0)) + (parseFloat(item.quantity || 0));
                                                                    existing.runningBalance = item.runningBalance;
                                                                    return acc;
                                                                }
                                                                
                                                                acc.push({ 
                                                                    ...item,
                                                                    product_original: item.product,
                                                                    quantity_original: item.quantity,
                                                                    rate_original: item.rate
                                                                });
                                                                return acc;
                                                            }, []).map((item, index) => {
                                                                const isExpanded = expandedAllHistoryCards === index;
                                                                return (
                                                                    <div 
                                                                        key={index}
                                                                        className={`mobile-card transition-all duration-300 ${item.type === 'payment' ? 'border-l-4 border-l-emerald-500' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}
                                                                        onClick={() => setExpandedAllHistoryCards(isExpanded ? null : index)}
                                                                    >
                                                                        <div className="mobile-card-header">
                                                                            <div>
                                                                                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{formatDate(item.date)}</div>
                                                                                <div className="text-sm font-black text-gray-900">
                                                                                    {item.type === 'sale' ? (item.invoiceNo || item.lcNo) : `Payment: ${item.method}`}
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <div className={`text-sm font-black ${item.type === 'sale' ? 'text-violet-700' : 'text-emerald-600'}`}>
                                                                                    {item.type === 'sale' ? `+৳${parseFloat(item.amount || 0).toLocaleString()}` : `-৳${parseFloat(item.amount || 0).toLocaleString()}`}
                                                                                </div>
                                                                                <div className="text-[10px] font-bold text-orange-600">Balance: ৳{item.runningBalance.toLocaleString()}</div>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                                                                            <div className="space-y-1 text-xs">
                                                                                {item.type === 'sale' ? (
                                                                                    <>
                                                                                        <div className="flex justify-between items-start">
                                                                                            <span className="text-gray-500">Product:</span>
                                                                                            <span className="font-bold text-right whitespace-pre-wrap">{item.product}</span>
                                                                                        </div>
                                                                                        <div className="flex justify-between items-start">
                                                                                            <span className="text-gray-500">Qty:</span>
                                                                                            <span className="font-bold text-right whitespace-pre-wrap">{item.quantity_display || (parseFloat(item.quantity || 0) > 0 ? parseFloat(item.quantity).toLocaleString() : '—')}</span>
                                                                                        </div>
                                                                                        <div className="flex justify-between items-start">
                                                                                            <span className="text-gray-500">Rate:</span>
                                                                                            <span className="font-bold text-right whitespace-pre-wrap">{item.rate_display || (parseFloat(item.rate || 0) > 0 ? `৳${parseFloat(item.rate).toLocaleString()}` : '—')}</span>
                                                                                        </div>
                                                                                        <div className="flex justify-between"><span className="text-gray-500">Paid:</span><span className="font-bold text-emerald-600">৳{parseFloat(item.paid || 0).toLocaleString()}</span></div>
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <div className="flex justify-between"><span className="text-gray-500">Account:</span><span className="font-bold">{item.accountNo || '—'}</span></div>
                                                                                        <div className="flex justify-between"><span className="text-gray-500">Bank:</span><span className="font-bold">{item.bankName || '—'}</span></div>
                                                                                        <div className="flex justify-between"><span className="text-gray-500">Ref:</span><span className="font-bold text-blue-600">{item.reference || '—'}</span></div>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        ) : (
                                                            <div className="py-8 text-center text-xs text-gray-400 font-medium italic">No transactions found</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }
            </div>

            <CustomerReport
                isOpen={showReport}
                onClose={() => setShowReport(false)}
                customers={customers}
            />
        </>
    );
};

export default Customer;
