import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { EditIcon, TrashIcon, UserIcon, XIcon, SearchIcon, FunnelIcon, ChevronDownIcon, ChevronUpIcon, EyeIcon, BoxIcon, FileTextIcon, BarChartIcon, PrinterIcon, RefreshIcon } from '../../Icons';
import { API_BASE_URL, SortIcon, formatDate, computeCustomerBalance } from '../../../utils/helpers';
import { generateSaleInvoicePDF, generateCustomerHistoryPDF } from '../../../utils/pdfGenerator';
import { api } from '../../../utils/api';
import { hasPermission } from '../../../utils/permissionHelper';
import CustomDatePicker from '../../shared/CustomDatePicker';
import CustomerReport from './CustomerReport';
import './Customer.css';

const Customer = ({
    currentUser,
    salesRecords = [],
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
    const [filters, setFilters] = useState({ type: 'General Customer' });
    const [showReport, setShowReport] = useState(false);
    const filterButtonRef = useRef(null);
    const filterPanelRef = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [gatePasses, setGatePasses] = useState([]);
    const [lcRecords, setLcRecords] = useState([]);
    const [purchasesList, setPurchasesList] = useState([]);
    const [stockList, setStockList] = useState([]);
    const [purchaseReceivesList, setPurchaseReceivesList] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewData, setViewData] = useState(null);
    const [historySearchQuery, setHistorySearchQuery] = useState('');
    const [activeHistoryTab, setActiveHistoryTab] = useState('sales'); // 'purchase', 'sales', 'payment', or 'gp'
    const [paymentSubTab, setPaymentSubTab] = useState('collection'); // 'collection' or 'paid'
    const [historySortConfig, setHistorySortConfig] = useState({ key: 'date', direction: 'asc' });
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
        } else if (activeHistoryTab === 'gp') {
            (gatePasses || []).filter(item => item.party === viewData.companyName).forEach(item => {
                if (type === 'lcNo' && item.lcNumber) uniqueOptions.add(item.lcNumber);
                if (type === 'product' && item.productName) uniqueOptions.add(item.productName);
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

    const canAdd = useMemo(() => hasPermission(currentUser, 'customer', 'add'), [currentUser]);
    const canEdit = useMemo(() => hasPermission(currentUser, 'customer', 'edit'), [currentUser]);
    const canDelete = useMemo(() => hasPermission(currentUser, 'customer', 'delete'), [currentUser]);

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
        if (viewData && customers && customers.length > 0) {
            const updated = customers.find(c => c._id === viewData._id);
            if (updated) setViewData(updated);
        }
    }, [customers]);

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

    const getLcPort = (lcNumber) => {
        if (!lcNumber) return '-';
        const cleanNo = String(lcNumber).replace(/\D/g, '');
        const lc = lcRecords.find(l => String(l.lcNo || '').replace(/\D/g, '') === cleanNo);
        return lc?.port || '-';
    };

    const fetchCustomers = async () => {
        setIsLoading(true);
        try {
            const [decryptedCustomers, gpRecords, lcData, purchasesData, stockData, prData] = await Promise.all([
                api.get('/api/customers'),
                api.get('/api/lc-gp'),
                api.get('/api/lc-management'),
                api.get('/api/purchases').catch(() => []),
                api.get('/api/stock').catch(() => []),
                api.get('/api/purchase-receives').catch(() => [])
            ]);
            setCustomers(decryptedCustomers);
            setGatePasses(gpRecords);
            setLcRecords(Array.isArray(lcData) ? lcData : []);
            setPurchasesList(Array.isArray(purchasesData) ? purchasesData : []);
            setStockList(Array.isArray(stockData) ? stockData : []);
            setPurchaseReceivesList(Array.isArray(prData) ? prData : []);
        } catch (error) {
            console.error('Error fetching data:', error);
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

        const isEditing = !!editingId;
        const hasAccess = isEditing ? canEdit : canAdd;
        if (!hasAccess) {
            alert(`Forbidden: You do not have permission to ${isEditing ? 'edit' : 'add'} customers`);
            return;
        }

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
                const existingCustomer = await api.get(url);
                const payload = { ...existingCustomer, ...formData };
                await api.put(url, payload);
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
        if (!canDelete) return;
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

    const getCustomerFinalBalance = (c) => {
        return computeCustomerBalance(c, { salesRecords, purchasesList, purchaseReceivesList });
    };

    const sortData = (data) => {
        if (!sortConfig.customer) return data;
        const { key, direction } = sortConfig.customer;
        return [...data].sort((a, b) => {
            let aVal = a[key];
            let bVal = b[key];
            if (key === 'balance') {
                aVal = getCustomerFinalBalance(a);
                bVal = getCustomerFinalBalance(b);
            }
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
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

    // Map raw sales history with updated prices from live salesRecords
    const rawSalesWithUpdatedPrices = useMemo(() => {
        return (viewData?.salesHistory || []).map(item => {
            if (salesRecords && salesRecords.length > 0) {
                const itemInv = (item.invoiceNo || '').trim().toUpperCase();
                const itemOrd = (item.orderNo || '').trim().toUpperCase();
                const matchingSale = salesRecords.find(s => {
                    const sInv = (s.invoiceNo || '').trim().toUpperCase();
                    const sOrd = (s.orderNo || '').trim().toUpperCase();
                    return (itemInv && (sInv === itemInv || sOrd === itemInv)) ||
                           (itemOrd && (sInv === itemOrd || sOrd === itemOrd));
                });

                if (matchingSale) {
                    const pName = (item.product || item.productName || '').trim().toLowerCase();
                    const bName = (item.brand || item.brandName || '').trim().toLowerCase();
                    let latestRate = null;

                    (matchingSale.items || []).forEach(si => {
                        const siProd = (si.productName || si.product || '').trim().toLowerCase();
                        if (!pName || siProd === pName) {
                            if (si.brandEntries && si.brandEntries.length > 0) {
                                si.brandEntries.forEach(be => {
                                    const beBrand = (be.brand || be.brandName || '').trim().toLowerCase();
                                    if (!bName || beBrand === bName) {
                                        const r = parseFloat(be.rate !== undefined && be.rate !== null && be.rate !== '' ? be.rate : be.unitPrice) || 0;
                                        if (r > 0) latestRate = r;
                                    }
                                });
                            } else {
                                const r = parseFloat(si.rate !== undefined && si.rate !== null && si.rate !== '' ? si.rate : si.unitPrice) || 0;
                                if (r > 0) latestRate = r;
                            }
                        }
                    });

                    if (latestRate && Math.abs((parseFloat(item.rate) || 0) - latestRate) > 0.001) {
                        const qty = parseFloat(item.quantity || item.qty) || 0;
                        const bag = parseFloat(item.bag || item.packet) || 0;
                        const isBagUom = (item.uom || viewData?.uom || '').toLowerCase() === 'bag';
                        const newAmt = isBagUom && bag > 0 ? (bag * latestRate) : (qty * latestRate);
                        const disc = parseFloat(item.discount) || 0;
                        const paid = parseFloat(item.paid) || 0;
                        return {
                            ...item,
                            rate: latestRate,
                            amount: Number(newAmt.toFixed(2)),
                            due: Number(Math.max(0, newAmt - disc - paid).toFixed(2))
                        };
                    }
                }
            }
            return item;
        });
    }, [viewData, salesRecords]);

    // Calculate Filtered History Data
    const filteredSalesHistory = useMemo(() => {
        const rawHistory = rawSalesWithUpdatedPrices;

        const filtered = rawHistory.filter(item => {
            if (item.saleType === 'Order' || (item.invoiceNo || '').startsWith('ORD')) return false;
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
    }, [viewData, salesRecords, historySearchQuery, historyFilters, historySortConfig]);

    const resolveInHousePurchaseItem = (p, item, b) => {
        const pNo = (p?.purchaseNo || p?.invoiceNo || 'PUR-0000').trim().toUpperCase();
        const pName = (item?.productName || item?.product || p?.productName || p?.product || '').trim().toLowerCase();
        const bName = (b?.brand || p?.brand || '').trim().toLowerCase();

        const matchedStock = (stockList || []).find(s =>
            (s.status || '').toLowerCase() === 'accepted' &&
            ((s.lcNo || '').trim().toUpperCase() === pNo || (s.purchaseNo || '').trim().toUpperCase() === pNo) &&
            (!pName || (s.productName || s.product || '').trim().toLowerCase() === pName) &&
            (!bName || (s.brand || '').trim().toLowerCase() === bName)
        );

        const matchedPR = (purchaseReceivesList || []).find(pr =>
            (pr.status || '').toLowerCase() === 'accepted' &&
            ((pr.purchaseNo || pr.purchaseReceiveNo || '').trim().toUpperCase() === pNo)
        );

        let prQty = 0;
        if (matchedPR && matchedPR.items) {
            matchedPR.items.forEach(prItem => {
                if (!pName || (prItem.productName || prItem.product || '').trim().toLowerCase() === pName) {
                    (prItem.brandEntries || []).forEach(be => {
                        if (!bName || (be.brand || '').trim().toLowerCase() === bName) {
                            prQty += parseFloat((be.inHouseQuantity ?? be.inHouseQty ?? be.inhouseQty ?? be.qty) || 0);
                        }
                    });
                }
            });
        }

        const finalInHouseQty = matchedStock
            ? parseFloat((matchedStock.inHouseQuantity ?? matchedStock.quantity) || 0)
            : (prQty > 0
                ? prQty
                : parseFloat((b?.inHouseQuantity ?? b?.inHouseQty ?? b?.inhouseQty ?? b?.qty ?? item?.qty ?? item?.quantity ?? p?.quantity ?? p?.qty) || 0));

        const rate = parseFloat((b?.rate ?? item?.rate ?? p?.rate) || 0);
        const origTotal = parseFloat((b?.total ?? item?.total ?? item?.amount ?? p?.totalAmount ?? p?.amount) || 0);
        const origQty = parseFloat((b?.qty ?? b?.quantity ?? item?.qty ?? item?.quantity ?? p?.quantity ?? p?.qty) || 0);
        const amount = (rate > 0 && finalInHouseQty > 0) ? (finalInHouseQty * rate) : (origQty > 0 ? (origTotal * (finalInHouseQty / origQty)) : origTotal);

        return { quantity: finalInHouseQty, rate, amount };
    };

    const getPRHistoryEntries = (viewData) => {
        if (!viewData) return { prEntries: [], coveredPurchaseNos: new Set() };

        const matchedPRs = (purchaseReceivesList || []).filter(pr => {
            if ((pr.status || '').toLowerCase() === 'requested') return false;
            const sName = (pr.supplierName || pr.companyName || '').trim().toLowerCase();
            const cComp = (viewData?.companyName || '').trim().toLowerCase();
            const cCust = (viewData?.customerName || '').trim().toLowerCase();
            return (
                pr.customerId === viewData?._id ||
                pr.customerId === viewData?.customerId ||
                (cComp && (sName === cComp || sName.includes(cComp) || cComp.includes(sName))) ||
                (cCust && (sName === cCust || sName.includes(cCust) || cCust.includes(sName)))
            );
        });

        const prEntries = matchedPRs.flatMap(pr => {
            const pNo = pr.purchaseNo || pr.purchaseReceiveNo || 'PUR-0000';
            if (pr.items && Array.isArray(pr.items)) {
                return pr.items.flatMap(item => {
                    if (item.brandEntries && Array.isArray(item.brandEntries)) {
                        return item.brandEntries.map(b => {
                            const q = parseFloat((b.inHouseQuantity ?? b.inHouseQty ?? b.inhouseQty ?? b.qty) || 0);
                            const r = parseFloat(b.rate || 0);
                            const amt = b.total ? parseFloat(b.total) : (q * r);
                            return {
                                _id: `${pr._id}-${item.productName}-${b.brand}`,
                                purchaseNo: pNo,
                                invoiceNo: pNo,
                                date: pr.date,
                                product: item.productName || item.product,
                                brand: b.brand,
                                quantity: q,
                                rate: r,
                                amount: amt,
                                discount: pr.discount || 0,
                                paid: pr.paid || pr.paidAmount || 0,
                                warehouse: pr.warehouse || item.warehouse || '-',
                                status: pr.status || 'Accepted',
                                type: 'purchase',
                                sortDate: new Date(pr.date || 0)
                            };
                        });
                    }
                    const q = parseFloat((item.inHouseQuantity ?? item.inHouseQty ?? item.qty) || 0);
                    const r = parseFloat(item.rate || 0);
                    const amt = item.total ? parseFloat(item.total) : (q * r);
                    return [{
                        _id: `${pr._id}-${item.productName}`,
                        purchaseNo: pNo,
                        invoiceNo: pNo,
                        date: pr.date,
                        product: item.productName || item.product,
                        brand: item.brand || '-',
                        quantity: q,
                        rate: r,
                        amount: amt,
                        discount: pr.discount || 0,
                        paid: pr.paid || pr.paidAmount || 0,
                        warehouse: pr.warehouse || item.warehouse || '-',
                        status: pr.status || 'Accepted',
                        type: 'purchase',
                        sortDate: new Date(pr.date || 0)
                    }];
                });
            }
            return [];
        });

        const coveredPurchaseNos = new Set(prEntries.map(e => e.purchaseNo.trim().toUpperCase()));
        return { prEntries, coveredPurchaseNos };
    };

    // Calculate Filtered Purchase History Data
    const filteredPurchaseHistory = useMemo(() => {
        const directHistory = viewData?.purchaseHistory || [];
        const { prEntries, coveredPurchaseNos } = getPRHistoryEntries(viewData);

        const matchedPurchases = (purchasesList || []).filter(p => {
            if ((p.status || '').toLowerCase() === 'requested') return false;
            const pNo = (p.purchaseNo || p.invoiceNo || '').trim().toUpperCase();
            if (pNo && coveredPurchaseNos.has(pNo)) return false;

            return (
                p.customerId === viewData?._id ||
                p.customerId === viewData?.customerId ||
                (p.companyName && p.companyName.toLowerCase() === (viewData?.companyName || '').toLowerCase()) ||
                (p.customerName && p.customerName.toLowerCase() === (viewData?.customerName || '').toLowerCase()) ||
                (p.supplierName && (
                    p.supplierName.toLowerCase() === (viewData?.companyName || '').toLowerCase() ||
                    p.supplierName.toLowerCase() === (viewData?.customerName || '').toLowerCase()
                ))
            );
        }).flatMap(p => {
            if (p.items && Array.isArray(p.items)) {
                return p.items.flatMap(item => {
                    if (item.brandEntries && Array.isArray(item.brandEntries)) {
                        return item.brandEntries.map(b => {
                            const res = resolveInHousePurchaseItem(p, item, b);
                            return {
                                _id: `${p._id}-${item.productName}-${b.brand}`,
                                purchaseNo: p.purchaseNo || p.invoiceNo || 'PUR-0000',
                                date: p.date,
                                product: item.productName || item.product,
                                brand: b.brand,
                                quantity: res.quantity,
                                rate: res.rate,
                                amount: res.amount,
                                discount: p.discount || 0,
                                paid: p.paid || p.paidAmount || item.paid || item.paidAmount || 0,
                                warehouse: p.warehouse || '-',
                                status: p.status || 'Completed'
                            };
                        });
                    }
                    const res = resolveInHousePurchaseItem(p, item, null);
                    return [{
                        _id: `${p._id}-${item.productName}`,
                        purchaseNo: p.purchaseNo || p.invoiceNo || 'PUR-0000',
                        date: p.date,
                        product: item.productName || item.product,
                        brand: item.brand || '-',
                        quantity: res.quantity,
                        rate: res.rate,
                        amount: res.amount,
                        discount: p.discount || 0,
                        paid: p.paid || p.paidAmount || item.paid || item.paidAmount || 0,
                        warehouse: p.warehouse || '-',
                        status: p.status || 'Completed'
                    }];
                });
            }
            const res = resolveInHousePurchaseItem(p, null, null);
            return [{
                _id: p._id,
                purchaseNo: p.purchaseNo || p.invoiceNo || 'PUR-0000',
                date: p.date,
                product: p.product || p.productName || '-',
                brand: p.brand || '-',
                quantity: res.quantity,
                rate: res.rate,
                amount: res.amount,
                discount: p.discount || 0,
                paid: p.paid || p.paidAmount || 0,
                warehouse: p.warehouse || '-',
                status: p.status || 'Completed'
            }];
        });

        const combined = prEntries.length > 0 ? prEntries : matchedPurchases;

        const filtered = combined.filter(item => {
            const matchesSearch = !historySearchQuery ||
                ((item.purchaseNo || item.invoiceNo || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.product || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.brand || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.warehouse || '').toLowerCase().includes(historySearchQuery.toLowerCase()));

            const matchesFilters =
                (!historyFilters.startDate || new Date(item.date) >= new Date(historyFilters.startDate)) &&
                (!historyFilters.endDate || new Date(item.date) <= new Date(historyFilters.endDate)) &&
                (!historyFilters.product || item.product === historyFilters.product);

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
            } else if (key === 'amount' || key === 'rate' || key === 'quantity' || key === 'discount') {
                aVal = parseFloat(a[key]) || 0;
                bVal = parseFloat(b[key]) || 0;
            }

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [viewData, purchasesList, stockList, purchaseReceivesList, historySearchQuery, historyFilters, historySortConfig]);

    const filteredPaymentHistory = useMemo(() => {
        const filtered = (viewData?.paymentHistory || []).filter(item => {
            if ((item.status || '').toLowerCase() === 'requested') return false;

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

    const filteredPayToCustomerHistory = useMemo(() => {
        const filtered = (viewData?.payToCustomerHistory || []).filter(item => {
            if ((item.status || '').toLowerCase() === 'requested') return false;

            const matchesSearch = !historySearchQuery ||
                ((item.method || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.bankName || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.accountNo || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.branch || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.reference || item.remarks || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.receiptNo || '').toLowerCase().includes(historySearchQuery.toLowerCase()));

            const matchesFilters =
                (!historyFilters.startDate || new Date(item.date) >= new Date(historyFilters.startDate)) &&
                (!historyFilters.endDate || new Date(item.date) <= new Date(historyFilters.endDate)) &&
                (!historyFilters.method || item.method === historyFilters.method) &&
                (!historyFilters.bankName || item.bankName === historyFilters.bankName);

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

        // Combine sales, payments, payouts, and purchases
        const sales = rawSalesWithUpdatedPrices.map(s => ({
            ...s,
            type: 'sale',
            sortDate: new Date(s.date)
        }));

        const payments = (viewData.paymentHistory || [])
            .filter(p => (p.status || '').toLowerCase() !== 'requested')
            .map(p => ({
                ...p,
                type: 'payment',
                sortDate: new Date(p.date)
            }));

        const payouts = (viewData.payToCustomerHistory || [])
            .filter(pc => (pc.status || '').toLowerCase() !== 'requested')
            .map(pc => ({
                ...pc,
                type: 'payToCustomer',
                sortDate: new Date(pc.date)
            }));

        const directPurchases = (viewData.purchaseHistory || []).map(pu => ({
            ...pu,
            type: 'purchase',
            invoiceNo: pu.purchaseNo || pu.invoiceNo || 'PUR-0000',
            sortDate: new Date(pu.date)
        }));

        const { prEntries, coveredPurchaseNos } = getPRHistoryEntries(viewData);

        const matchedPurchases = (purchasesList || []).filter(p => {
            if ((p.status || '').toLowerCase() === 'requested') return false;
            const pNo = (p.purchaseNo || p.invoiceNo || '').trim().toUpperCase();
            if (pNo && coveredPurchaseNos.has(pNo)) return false;

            return (
                p.customerId === viewData?._id ||
                p.customerId === viewData?.customerId ||
                (p.companyName && p.companyName.toLowerCase() === (viewData?.companyName || '').toLowerCase()) ||
                (p.customerName && p.customerName.toLowerCase() === (viewData?.customerName || '').toLowerCase()) ||
                (p.supplierName && (
                    p.supplierName.toLowerCase() === (viewData?.companyName || '').toLowerCase() ||
                    p.supplierName.toLowerCase() === (viewData?.customerName || '').toLowerCase()
                ))
            );
        }).flatMap(p => {
            if (p.items && Array.isArray(p.items)) {
                return p.items.flatMap(item => {
                    if (item.brandEntries && Array.isArray(item.brandEntries)) {
                        return item.brandEntries.map(b => {
                            const res = resolveInHousePurchaseItem(p, item, b);
                            return {
                                _id: `${p._id}-${item.productName}-${b.brand}`,
                                invoiceNo: p.purchaseNo || p.invoiceNo || 'PUR-0000',
                                date: p.date,
                                product: item.productName || item.product,
                                brand: b.brand,
                                quantity: res.quantity,
                                rate: res.rate,
                                amount: res.amount,
                                discount: p.discount || 0,
                                paid: p.paid || p.paidAmount || item.paid || item.paidAmount || 0,
                                type: 'purchase',
                                sortDate: new Date(p.date)
                            };
                        });
                    }
                    const res = resolveInHousePurchaseItem(p, item, null);
                    return [{
                        _id: `${p._id}-${item.productName}`,
                        invoiceNo: p.purchaseNo || p.invoiceNo || 'PUR-0000',
                        date: p.date,
                        product: item.productName || item.product,
                        brand: item.brand || '-',
                        quantity: res.quantity,
                        rate: res.rate,
                        amount: res.amount,
                        discount: p.discount || 0,
                        paid: p.paid || p.paidAmount || item.paid || item.paidAmount || 0,
                        type: 'purchase',
                        sortDate: new Date(p.date)
                    }];
                });
            }
            const res = resolveInHousePurchaseItem(p, null, null);
            return [{
                _id: p._id,
                invoiceNo: p.purchaseNo || p.invoiceNo || 'PUR-0000',
                date: p.date,
                product: p.product || p.productName || '-',
                brand: p.brand || '-',
                quantity: res.quantity,
                rate: res.rate,
                amount: res.amount,
                discount: p.discount || 0,
                paid: p.paid || p.paidAmount || 0,
                type: 'purchase',
                sortDate: new Date(p.date)
            }];
        });

        const purchases = prEntries.length > 0 ? prEntries : matchedPurchases;

        // Combine and sort chronologically (earliest first for absolute balance calculation)
        const all = [...sales, ...payments, ...payouts, ...purchases].sort((a, b) => a.sortDate - b.sortDate);

        // Calculate running balance on ALL history records
        let currentBalance = 0;
        const historyWithBalance = all.map(item => {
            if (item.type === 'sale') {
                const amt = parseFloat(item.amount) || 0;
                const pd = parseFloat(item.paid) || 0;
                const disc = parseFloat(item.discount) || 0;
                currentBalance += (amt - pd - disc);
            } else if (item.type === 'payment') {
                const amt = parseFloat(item.amount) || 0;
                const disc = parseFloat(item.discount) || 0;
                currentBalance -= (amt + disc);
            } else if (item.type === 'payToCustomer') {
                const amt = parseFloat(item.amount) || 0;
                currentBalance += amt;
            } else if (item.type === 'purchase') {
                const amt = parseFloat(item.amount) || 0;
                const pd = parseFloat(item.paid) || 0;
                const disc = parseFloat(item.discount) || 0;
                currentBalance -= (amt - pd - disc);
            }
            return { ...item, runningBalance: currentBalance };
        });

        // Now filter the records with balance info
        const filteredAll = historyWithBalance.filter(item => {
            const matchesSearch = !historySearchQuery ||
                ((item.invoiceNo || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.reference || item.referenceNo || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.method || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.bankName || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.product || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.brand || '').toLowerCase().includes(historySearchQuery.toLowerCase()));

            const matchesFilters =
                (!historyFilters.startDate || new Date(item.date) >= new Date(historyFilters.startDate)) &&
                (!historyFilters.endDate || new Date(item.date) <= new Date(historyFilters.endDate)) &&
                (!historyFilters.lcNo || item.lcNo === historyFilters.lcNo) &&
                (!historyFilters.product || item.product === historyFilters.product) &&
                (!historyFilters.method || item.method === historyFilters.method) &&
                (!historyFilters.bankName || item.bankName === historyFilters.bankName) &&
                (!historyFilters.mobileType || item.mobileType === historyFilters.mobileType);

            return matchesSearch && matchesFilters;
        });

        if (!historySortConfig.key) return filteredAll;

        return [...filteredAll].sort((a, b) => {
            const { key, direction } = historySortConfig;
            let aVal = a[key];
            let bVal = b[key];

            if (key === 'date') {
                aVal = new Date(a.date);
                bVal = new Date(b.date);
            } else if (key === 'lcNo') {
                aVal = (a.invoiceNo || a.lcNo || a.receiptNo || '').toLowerCase();
                bVal = (b.invoiceNo || b.lcNo || b.receiptNo || '').toLowerCase();
            } else if (key === 'amount') {
                aVal = a.type === 'sale' ? (parseFloat(a.amount) || 0) : (a.type === 'payToCustomer' ? (parseFloat(a.amount) || 0) : 0);
                bVal = b.type === 'sale' ? (parseFloat(b.amount) || 0) : (b.type === 'payToCustomer' ? (parseFloat(b.amount) || 0) : 0);
            } else if (key === 'paid') {
                aVal = a.type === 'payment' ? (parseFloat(a.amount) || 0) : (a.type === 'sale' ? (parseFloat(a.paid) || 0) : 0);
                bVal = b.type === 'payment' ? (parseFloat(b.amount) || 0) : (a.type === 'sale' ? (parseFloat(b.paid) || 0) : 0);
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
    }, [viewData, purchasesList, historySearchQuery, historyFilters, historySortConfig]);

    const openingBalance = useMemo(() => {
        if (!viewData) return 0;

        const sales = rawSalesWithUpdatedPrices.map(s => ({
            ...s,
            type: 'sale',
            sortDate: new Date(s.date)
        }));
        const payments = (viewData.paymentHistory || [])
            .filter(p => (p.status || '').toLowerCase() !== 'requested')
            .map(p => ({
                ...p,
                type: 'payment',
                sortDate: new Date(p.date)
            }));
        const all = [...sales, ...payments].sort((a, b) => a.sortDate - b.sortDate);

        let currentBalance = 0;
        const historyWithBalance = all.map(item => {
            if (item.type === 'sale') {
                const amt = parseFloat(item.amount) || 0;
                const pd = parseFloat(item.paid) || 0;
                const disc = parseFloat(item.discount) || 0;
                currentBalance += (amt - pd - disc);
            } else {
                const amt = parseFloat(item.amount) || 0;
                const disc = parseFloat(item.discount) || 0;
                currentBalance -= (amt + disc);
            }
            return { ...item, runningBalance: currentBalance };
        });

        // Apply filters only (do not sort)
        const visibleChrono = historyWithBalance.filter(item => {
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

        if (visibleChrono.length === 0) return 0;

        const firstVisibleItem = visibleChrono[0];
        const firstIdx = historyWithBalance.indexOf(firstVisibleItem);

        if (firstIdx > 0) {
            return historyWithBalance[firstIdx - 1].runningBalance;
        }
        return 0;
    }, [viewData, historySearchQuery, historyFilters]);

    const isFiltered = useMemo(() => {
        return !!(
            historyFilters.startDate ||
            historyFilters.endDate ||
            historyFilters.lcNo ||
            historyFilters.product ||
            historyFilters.method ||
            historySearchQuery
        );
    }, [historyFilters, historySearchQuery]);

    const filteredGatePasses = useMemo(() => {
        if (!viewData) return [];
        const filtered = (gatePasses || []).filter(item => {
            // Filter by customer (party)
            if (item.party !== viewData.companyName) return false;

            const matchesSearch = !historySearchQuery ||
                ((item.lcNumber || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.productName || '').toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                ((item.remarks || '').toLowerCase().includes(historySearchQuery.toLowerCase()));

            const matchesFilters =
                (!historyFilters.startDate || new Date(item.gpDate) >= new Date(historyFilters.startDate)) &&
                (!historyFilters.endDate || new Date(item.gpDate) <= new Date(historyFilters.endDate)) &&
                (!historyFilters.lcNo || item.lcNumber === historyFilters.lcNo) &&
                (!historyFilters.product || item.productName === historyFilters.product);

            return matchesSearch && matchesFilters;
        });

        if (!historySortConfig.key) return filtered;

        return [...filtered].sort((a, b) => {
            const { key, direction } = historySortConfig;
            let aVal = a[key === 'date' ? 'gpDate' : key];
            let bVal = b[key === 'date' ? 'gpDate' : key];

            if (key === 'date') {
                aVal = new Date(a.gpDate);
                bVal = new Date(b.gpDate);
            } else if (key === 'quantity' || key === 'gpQuantity') {
                aVal = parseFloat(a.gpQuantity) || 0;
                bVal = parseFloat(b.gpQuantity) || 0;
            } else if (key === 'rate' || key === 'gpRate') {
                aVal = parseFloat(a.gpRate) || 0;
                bVal = parseFloat(b.gpRate) || 0;
            } else if (key === 'amount' || key === 'gpValue') {
                aVal = parseFloat(a.gpValue) || 0;
                bVal = parseFloat(b.gpValue) || 0;
            }

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [viewData, gatePasses, historySearchQuery, historyFilters, historySortConfig]);

    // Summary Totals
    const totalAmount = filteredSalesHistory.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const totalSalesPaid = filteredSalesHistory.reduce((sum, item) => sum + (parseFloat(item.paid) || 0), 0);
    const totalSalesDiscount = filteredSalesHistory.reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0);
    const totalPaymentDiscount = filteredPaymentHistory.reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0);
    const totalDiscount = totalSalesDiscount + totalPaymentDiscount;
    const totalHistoryPaid = filteredPaymentHistory.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const totalPaidCalculated = totalSalesPaid + totalHistoryPaid;
    const totalDueCalculated = Math.max(0, totalAmount - totalSalesPaid - totalDiscount - totalHistoryPaid);
    const totalTruck = filteredSalesHistory.reduce((sum, item) => sum + (parseFloat(item.truck) || 0), 0);
    const totalQuantity = filteredSalesHistory.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

    // Purchase Summaries
    const purchaseTotalAmount = filteredPurchaseHistory.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const purchaseTotalPaid = filteredPurchaseHistory.reduce((sum, item) => sum + (parseFloat(item.paid) || 0), 0);
    const purchaseTotalDiscount = filteredPurchaseHistory.reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0);
    const totalPayToCustomer = (viewData?.payToCustomerHistory || [])
        .filter(item => (item.status || '').toLowerCase() !== 'requested')
        .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const purchaseTotalBalance = Math.max(0, purchaseTotalAmount - purchaseTotalDiscount - purchaseTotalPaid - totalPayToCustomer);

    // G.P Summaries
    const totalGpQuantity = filteredGatePasses.reduce((sum, item) => sum + (parseFloat(item.gpQuantity) || 0), 0);
    const totalGpValue = filteredGatePasses.reduce((sum, item) => sum + (parseFloat(item.gpValue) || 0), 0);

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
                                className="h-10 block w-full pl-10 pr-4 bg-white/50 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                autoComplete="off"
                            />
                        </div>

                        <div className="w-full md:w-auto flex flex-row items-center justify-between md:justify-end gap-2">
                            <button
                                onClick={() => setShowReport(true)}
                                className="h-10 flex-1 md:flex-none w-full md:w-auto flex justify-center items-center gap-2 px-4 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 text-sm font-medium"
                            >
                                <BarChartIcon className="w-4 h-4 text-gray-400 hidden sm:block" />
                                <span className="text-sm font-medium">Report</span>
                            </button>
                            {canAdd && (
                                <button
                                    onClick={() => {
                                        if (!showForm) resetForm();
                                        setShowForm(!showForm);
                                    }}
                                    className="h-10 border border-transparent flex-1 md:flex-none w-full md:w-auto flex justify-center items-center gap-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-blue-500/30 active:scale-95 text-sm font-medium"
                                >
                                    <span className="text-sm font-medium">+ Add New</span>
                                </button>
                            )}
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

                        <div className="customer-form-header">
                            <h3 className="customer-form-title">{editingId ? 'Edit Customer' : 'New Customer Registration'}</h3>
                            <button onClick={() => { setShowForm(false); resetForm(); }} className="customer-form-close">
                                <XIcon className="w-6 h-6" />
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
                            className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 relative z-10"
                        >
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
                                                // Calculate this customer's last running balance from all history
                                                const custTotalDue = getCustomerFinalBalance(c);

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
                                                        <td className={`px-6 py-4 text-sm font-bold text-right ${custTotalDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                            {Math.round(custTotalDue).toLocaleString('en-IN')}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-600"><span className={`customer-status-badge ${c.status === 'Active' ? 'active' : 'inactive'}`}>{c.status}</span></td>
                                                        <td className="px-6 py-4 text-sm text-gray-600">
                                                            <div className="flex items-center justify-center space-x-2">
                                                                <button onClick={(e) => { e.stopPropagation(); setViewData(c); }} className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded transition-colors"><EyeIcon className="w-5 h-5" /></button>
                                                                {canEdit && (
                                                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(c); }} className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors"><EditIcon className="w-5 h-5" /></button>
                                                                )}
                                                                {canDelete && (
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
                                            const custTotalDue = getCustomerFinalBalance(c);
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
                                                            <span className={`customer-status-badge ${isExpanded
                                                                ? (c.status === 'Active' ? 'active' : 'inactive')
                                                                : (custTotalDue > 0 ? 'inactive' : 'active')
                                                                } flex items-center justify-center`}>
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
                                                                    <span className={`mobile-card-value font-bold ${custTotalDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
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
                                                                {canEdit && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleEdit(c); }}
                                                                        className="flex items-center justify-center gap-1.5 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold flex-1"
                                                                    >
                                                                        <EditIcon className="w-4 h-4" /> Edit
                                                                    </button>
                                                                )}
                                                                {canDelete && (
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
                    viewData && createPortal(
                        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 app-modal-overlay">
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
                                                placeholder={
                                                    activeHistoryTab === 'purchase'
                                                        ? 'Search purchase history...'
                                                        : activeHistoryTab === 'sales'
                                                        ? 'Search sales history...'
                                                        : activeHistoryTab === 'payment'
                                                        ? 'Search payment history...'
                                                        : activeHistoryTab === 'gp'
                                                        ? 'Search G.P history...'
                                                        : 'Search all history...'
                                                }
                                                value={historySearchQuery}
                                                onChange={(e) => setHistorySearchQuery(e.target.value)}
                                                className="block w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                            />
                                        </div>

                                        {/* Tab Navigation */}
                                        <div className="flex gap-1.5 justify-center">
                                            {viewData?.customerType === 'General Customer' ? (
                                                <button
                                                    onClick={() => setActiveHistoryTab('purchase')}
                                                    className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeHistoryTab === 'purchase'
                                                        ? 'bg-blue-600 text-white shadow-sm'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    Purchase History
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setActiveHistoryTab('gp')}
                                                    className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeHistoryTab === 'gp'
                                                        ? 'bg-blue-600 text-white shadow-sm'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    G.P List
                                                </button>
                                            )}
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
                                                activeHistoryTab === 'purchase' ? filteredPurchaseHistory : activeHistoryTab === 'sales' ? filteredSalesHistory : activeHistoryTab === 'payment' ? filteredPaymentHistory : combinedHistory,
                                                { totalAmount, totalPaid: totalPaidCalculated, totalDiscount, totalBalance: totalDueCalculated, openingBalance, isFiltered },
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
                                    <div className={`grid ${activeHistoryTab === 'all' ? 'grid-cols-2 md:grid-cols-5' : (activeHistoryTab === 'sales' ? (viewData.customerType?.includes('Party') ? 'grid-cols-2 md:grid-cols-7' : 'grid-cols-2 md:grid-cols-6') : (activeHistoryTab === 'gp' ? 'grid-cols-2 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-5'))} gap-2 md:gap-3 mb-4 md:mb-8 summary-grid-mobile`}>
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
                                        {activeHistoryTab === 'gp' && (
                                            <>
                                                <div className="bg-blue-50/50 p-3 md:p-4 rounded-2xl border border-blue-100 shadow-sm transition-all hover:shadow-md">
                                                    <p className="text-[9px] md:text-[10px] text-blue-500 font-bold uppercase tracking-wider mb-1">Total G.P Qty</p>
                                                    <p className="text-base md:text-lg font-black text-blue-700">{totalGpQuantity.toLocaleString('en-US')} Kg</p>
                                                </div>
                                                <div className="bg-emerald-50/50 p-3 md:p-4 rounded-2xl border border-emerald-100 shadow-sm transition-all hover:shadow-md">
                                                    <p className="text-[9px] md:text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-1">Total G.P Value</p>
                                                    <p className="text-base md:text-lg font-black text-emerald-700">৳{totalGpValue.toLocaleString('en-IN')}</p>
                                                </div>
                                            </>
                                        )}
                                        {activeHistoryTab !== 'gp' && (
                                            <>
                                                {(() => {
                                                    const isPurchaseMode = activeHistoryTab === 'purchase' || (activeHistoryTab === 'payment' && paymentSubTab === 'paid');
                                                    return (
                                                        <>
                                                            <div className="bg-violet-50/50 p-3 md:p-4 rounded-2xl border border-violet-100 shadow-sm transition-all hover:shadow-md">
                                                                <p className="text-[9px] md:text-[10px] text-violet-500 font-bold uppercase tracking-wider mb-1">Total Amount</p>
                                                                <p className="text-base md:text-lg font-black text-violet-700">৳{(isPurchaseMode ? purchaseTotalAmount : totalAmount).toLocaleString('en-IN')}</p>
                                                            </div>
                                                            <div className="bg-teal-50/50 p-3 md:p-4 rounded-2xl border border-teal-100 shadow-sm transition-all hover:shadow-md">
                                                                <p className="text-[9px] md:text-[10px] text-teal-500 font-bold uppercase tracking-wider mb-1">{(viewData?.customerType === 'General Customer' && activeHistoryTab === 'sales') ? 'Total Truck Fare' : 'Total Paid'}</p>
                                                                <p className="text-base md:text-lg font-black text-teal-700">৳{(isPurchaseMode ? purchaseTotalPaid : ((viewData?.customerType === 'General Customer' && activeHistoryTab === 'sales') ? totalTruck : totalSalesPaid)).toLocaleString('en-IN')}</p>
                                                            </div>
                                                            <div className="bg-indigo-50/50 p-3 md:p-4 rounded-2xl border border-indigo-100 shadow-sm transition-all hover:shadow-md">
                                                                <p className="text-[9px] md:text-[10px] text-indigo-500 font-bold uppercase tracking-wider mb-1">{isPurchaseMode ? 'Paid To Customer' : 'Payment Collection'}</p>
                                                                <p className="text-base md:text-lg font-black text-indigo-700">৳{(isPurchaseMode ? totalPayToCustomer : totalHistoryPaid).toLocaleString('en-IN')}</p>
                                                            </div>
                                                            <div className="bg-pink-50/50 p-3 md:p-4 rounded-2xl border border-pink-100 shadow-sm transition-all hover:shadow-md">
                                                                <p className="text-[9px] md:text-[10px] text-pink-500 font-bold uppercase tracking-wider mb-1">Total Discount</p>
                                                                <p className="text-base md:text-lg font-black text-pink-700">৳{(isPurchaseMode ? purchaseTotalDiscount : totalDiscount).toLocaleString('en-IN')}</p>
                                                            </div>
                                                            <div className="bg-orange-50/50 p-3 md:p-4 rounded-2xl border border-orange-100 shadow-sm transition-all hover:shadow-md">
                                                                <p className="text-[9px] md:text-[10px] text-orange-500 font-bold uppercase tracking-wider mb-1">Total Balance</p>
                                                                <p className="text-base md:text-lg font-black text-orange-700">৳{(isPurchaseMode ? purchaseTotalBalance : totalDueCalculated).toLocaleString('en-IN')}</p>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </>
                                        )}
                                    </div>

                                    {/* G.P List Table */}
                                    {activeHistoryTab === 'gp' && (
                                        <>
                                            <div className="flex items-center gap-4 mb-3 md:mb-4">
                                                <h4 className="text-base md:text-lg font-bold text-gray-800">Gate Pass List</h4>
                                            </div>
                                            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                                {/* Desktop G.P List Table */}
                                                <table className="w-full text-left text-sm hidden md:table">
                                                    <thead className="bg-white border-b border-gray-200">
                                                        <tr>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('date')}>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-4" />
                                                                    <span>Date</span>
                                                                    <SortIcon config={historySortConfig} columnKey="date" />
                                                                </div>
                                                            </th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('lcNo')}>
                                                                <div className="flex items-center gap-1">
                                                                    <span>LC Number</span>
                                                                    <SortIcon config={historySortConfig} columnKey="lcNo" />
                                                                </div>
                                                            </th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600">Port</th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('product')}>
                                                                <div className="flex items-center gap-1">
                                                                    <span>Product</span>
                                                                    <SortIcon config={historySortConfig} columnKey="product" />
                                                                </div>
                                                            </th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('quantity')}>
                                                                <div className="flex items-center gap-1">
                                                                    <span>G.P Qty</span>
                                                                    <SortIcon config={historySortConfig} columnKey="quantity" />
                                                                </div>
                                                            </th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('rate')}>
                                                                <div className="flex items-center gap-1">
                                                                    <span>G.P Rate</span>
                                                                    <SortIcon config={historySortConfig} columnKey="rate" />
                                                                </div>
                                                            </th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('amount')}>
                                                                <div className="flex items-center gap-1">
                                                                    <span>G.P Value</span>
                                                                    <SortIcon config={historySortConfig} columnKey="amount" />
                                                                </div>
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredGatePasses && filteredGatePasses.length > 0 ? (
                                                            filteredGatePasses.map((item) => (
                                                                <tr key={item._id} className="hover:bg-white border-b border-gray-200 transition-colors">
                                                                    <td className="px-4 py-3 text-gray-600">{formatDate(item.gpDate)}</td>
                                                                    <td className="px-4 py-3 font-bold text-gray-900">{item.lcNumber}</td>
                                                                    <td className="px-4 py-3 text-xs font-bold text-blue-600 uppercase">{getLcPort(item.lcNumber)}</td>
                                                                    <td className="px-4 py-3 text-gray-600">{item.productName}</td>
                                                                    <td className="px-4 py-3 font-bold text-blue-600">{parseFloat(item.gpQuantity || 0).toLocaleString('en-US')} Kg</td>
                                                                    <td className="px-4 py-3 text-gray-600">৳{parseFloat(item.gpRate || 0).toLocaleString('en-IN')}</td>
                                                                    <td className="px-4 py-3 font-bold text-gray-900">৳{parseFloat(item.gpValue || 0).toLocaleString('en-IN')}</td>
                                                                </tr>
                                                            ))
                                                        ) : (
                                                            <tr>
                                                                <td colSpan="7" className="px-4 py-8 text-left text-gray-400 font-medium italic">No gate pass records found</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>

                                                {/* Mobile G.P List Card View */}
                                                <div className="block md:hidden p-3 space-y-3">
                                                    {filteredGatePasses && filteredGatePasses.length > 0 ? (
                                                        filteredGatePasses.map((item) => (
                                                            <div key={item._id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                                                                <div className="flex justify-between items-start">
                                                                    <div>
                                                                        <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">{formatDate(item.gpDate)}</div>
                                                                        <div className="flex items-center gap-2 mt-0.5">
                                                                            <span className="text-sm font-bold text-gray-900">{item.lcNumber}</span>
                                                                            <span className="text-[10px] font-bold text-blue-600 uppercase bg-blue-50 px-1.5 py-0.5 rounded">{getLcPort(item.lcNumber)}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-left">
                                                                        <div className="text-xs font-bold text-gray-900">৳{parseFloat(item.gpValue || 0).toLocaleString('en-IN')}</div>
                                                                        <div className="text-[10px] text-gray-400">G.P Value</div>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4 py-2 border-y border-gray-50">
                                                                    <div>
                                                                        <div className="text-[10px] text-gray-400 uppercase">Product</div>
                                                                        <div className="text-xs font-medium text-gray-700">{item.productName}</div>
                                                                    </div>
                                                                    <div className="text-left">
                                                                        <div className="text-[10px] text-gray-400 uppercase">G.P Qty</div>
                                                                        <div className="text-xs font-bold text-blue-600">{parseFloat(item.gpQuantity || 0).toLocaleString('en-US')} Kg</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="py-8 text-left text-xs text-gray-400 font-medium italic">No gate pass records found</div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Purchase History Table */}
                                    {activeHistoryTab === 'purchase' && (
                                        <>
                                            <div className="flex items-center gap-4 mb-3 md:mb-4">
                                                <h4 className="text-base md:text-lg font-bold text-gray-800">Purchase History</h4>
                                            </div>
                                            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                                {/* Desktop Purchase History Table */}
                                                <table className="w-full text-left text-sm hidden md:table">
                                                    <thead className="bg-white border-b border-gray-200">
                                                        <tr>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('date')}>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-4" />
                                                                    <span>Date</span>
                                                                    <SortIcon config={historySortConfig} columnKey="date" />
                                                                </div>
                                                            </th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('purchaseNo')}>
                                                                <div className="flex items-center gap-1">
                                                                    <span>Purchase No</span>
                                                                    <SortIcon config={historySortConfig} columnKey="purchaseNo" />
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
                                                            <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('quantity')}>
                                                                <div className="flex items-center justify-start gap-1">
                                                                    <span>Qty</span>
                                                                    <SortIcon config={historySortConfig} columnKey="quantity" />
                                                                </div>
                                                            </th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('rate')}>
                                                                <div className="flex items-center justify-start gap-1">
                                                                    <span>Rate</span>
                                                                    <SortIcon config={historySortConfig} columnKey="rate" />
                                                                </div>
                                                            </th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('amount')}>
                                                                <div className="flex items-center justify-start gap-1">
                                                                    <span>Amount</span>
                                                                    <SortIcon config={historySortConfig} columnKey="amount" />
                                                                </div>
                                                            </th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('discount')}>
                                                                <div className="flex items-center justify-start gap-1">
                                                                    <span>Discount</span>
                                                                    <SortIcon config={historySortConfig} columnKey="discount" />
                                                                </div>
                                                            </th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('paid')}>
                                                                <div className="flex items-center justify-start gap-1">
                                                                    <span>Paid Amount</span>
                                                                    <SortIcon config={historySortConfig} columnKey="paid" />
                                                                </div>
                                                            </th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('balance')}>
                                                                <div className="flex items-center justify-start gap-1">
                                                                    <span>Balance</span>
                                                                    <SortIcon config={historySortConfig} columnKey="balance" />
                                                                </div>
                                                            </th>
                                                            <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('warehouse')}>
                                                                <div className="flex items-center gap-1">
                                                                    <span>Warehouse</span>
                                                                    <SortIcon config={historySortConfig} columnKey="warehouse" />
                                                                </div>
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredPurchaseHistory && filteredPurchaseHistory.length > 0 ? (
                                                            filteredPurchaseHistory.map((item, idx) => (
                                                                <tr key={item._id || idx} className="hover:bg-white border-b border-gray-200 transition-colors">
                                                                    <td className="px-4 py-3 text-gray-600">{formatDate(item.date)}</td>
                                                                    <td className="px-4 py-3 font-bold text-gray-900">{item.purchaseNo || item.invoiceNo || '-'}</td>
                                                                    <td className="px-4 py-3 text-gray-800 font-medium">{item.product || '-'}</td>
                                                                    <td className="px-4 py-3 text-gray-600">{item.brand || '-'}</td>
                                                                    <td className="px-4 py-3 font-bold text-blue-600">{parseFloat(item.quantity || 0).toLocaleString('en-US')}</td>
                                                                    <td className="px-4 py-3 text-gray-600">৳{parseFloat(item.rate || 0).toLocaleString('en-IN')}</td>
                                                                    <td className="px-4 py-3 font-bold text-gray-900">৳{parseFloat(item.amount || 0).toLocaleString('en-IN')}</td>
                                                                    <td className="px-4 py-3 text-gray-600">৳{parseFloat(item.discount || 0).toLocaleString('en-IN')}</td>
                                                                    <td className="px-4 py-3 font-bold text-teal-600">৳{parseFloat(item.paid || 0).toLocaleString('en-IN')}</td>
                                                                    <td className="px-4 py-3 font-bold text-orange-600">৳{Math.max(0, parseFloat(item.amount || 0) - parseFloat(item.discount || 0) - parseFloat(item.paid || 0)).toLocaleString('en-IN')}</td>
                                                                    <td className="px-4 py-3 text-gray-600">{item.warehouse || '-'}</td>
                                                                </tr>
                                                            ))
                                                        ) : (
                                                            <tr>
                                                                <td colSpan="11" className="px-4 py-8 text-left text-gray-400 font-medium italic">No purchase history found matching filters</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>

                                                {/* Mobile Purchase History Card View */}
                                                <div className="block md:hidden p-3 space-y-3">
                                                    {filteredPurchaseHistory && filteredPurchaseHistory.length > 0 ? (
                                                        filteredPurchaseHistory.map((item, idx) => (
                                                            <div key={item._id || idx} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                                                                <div className="flex justify-between items-start">
                                                                    <div>
                                                                        <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">{formatDate(item.date)}</div>
                                                                        <div className="text-sm font-bold text-gray-900 mt-0.5">{item.purchaseNo || '-'}</div>
                                                                    </div>
                                                                    <div className="text-left">
                                                                        <div className="text-xs font-bold text-gray-900">৳{parseFloat(item.amount || 0).toLocaleString('en-IN')}</div>
                                                                        <div className="text-[10px] text-gray-400">Total Amount</div>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4 py-2 border-y border-gray-50">
                                                                    <div>
                                                                        <div className="text-[10px] text-gray-400 uppercase">Product / Brand</div>
                                                                        <div className="text-xs font-medium text-gray-700">{item.product} {item.brand ? `(${item.brand})` : ''}</div>
                                                                    </div>
                                                                    <div className="text-left">
                                                                        <div className="text-[10px] text-gray-400 uppercase">Qty / Rate</div>
                                                                        <div className="text-xs font-bold text-blue-600">{item.quantity} @ ৳{item.rate}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                                                                    <div>
                                                                        <div className="text-[10px] text-gray-400 uppercase">Discount</div>
                                                                        <div className="text-xs font-bold text-pink-600">৳{parseFloat(item.discount || 0).toLocaleString('en-IN')}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[10px] text-gray-400 uppercase">Paid</div>
                                                                        <div className="text-xs font-bold text-teal-600">৳{parseFloat(item.paid || 0).toLocaleString('en-IN')}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[10px] text-gray-400 uppercase">Balance</div>
                                                                        <div className="text-xs font-bold text-orange-600">৳{Math.max(0, parseFloat(item.amount || 0) - parseFloat(item.discount || 0) - parseFloat(item.paid || 0)).toLocaleString('en-IN')}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="py-8 text-left text-xs text-gray-400 font-medium italic">No purchase history found matching filters</div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}

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
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-4" />
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
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('quantity')}>
                                                                    <div className="flex items-center justify-start gap-1">
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
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('rate')}>
                                                                    <div className="flex items-center justify-start gap-1">
                                                                        <span>Rate</span>
                                                                        <SortIcon config={historySortConfig} columnKey="rate" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('amount')}>
                                                                    <div className="flex items-center justify-start gap-1">
                                                                        <span>Amount</span>
                                                                        <SortIcon config={historySortConfig} columnKey="amount" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('discount')}>
                                                                    <div className="flex items-center justify-start gap-1">
                                                                        <span>Discount</span>
                                                                        <SortIcon config={historySortConfig} columnKey="discount" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('paid')}>
                                                                    <div className="flex items-center justify-start gap-1">
                                                                        <span>Paid</span>
                                                                        <SortIcon config={historySortConfig} columnKey="paid" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors">
                                                                    <div className="flex items-center justify-start gap-1">
                                                                        <span>Balance</span>
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left">Action</th>
                                                            </tr>
                                                        ) : (
                                                            <tr>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('date')}>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-4" />
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
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('quantity')}>
                                                                    <div className="flex items-center justify-start gap-1">
                                                                        <span>Qty</span>
                                                                        <SortIcon config={historySortConfig} columnKey="quantity" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('rate')}>
                                                                    <div className="flex items-center justify-start gap-1">
                                                                        <span>Rate</span>
                                                                        <SortIcon config={historySortConfig} columnKey="rate" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('amount')}>
                                                                    <div className="flex items-center justify-start gap-1">
                                                                        <span>Amount</span>
                                                                        <SortIcon config={historySortConfig} columnKey="amount" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('discount')}>
                                                                    <div className="flex items-center justify-start gap-1">
                                                                        <span>Discount</span>
                                                                        <SortIcon config={historySortConfig} columnKey="discount" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('paid')}>
                                                                    <div className="flex items-center justify-start gap-1">
                                                                        <span>{viewData?.customerType === 'General Customer' ? 'Truck Fare' : 'Paid'}</span>
                                                                        <SortIcon config={historySortConfig} columnKey="paid" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors">
                                                                    <div className="flex items-center justify-start gap-1">
                                                                        <span>Balance</span>
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left">Action</th>
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
                                                                            totalPaid: 0,
                                                                            totalQty: 0,
                                                                            trucks: new Set()
                                                                        };
                                                                    }
                                                                    groups[invoice].items.push(item);
                                                                    groups[invoice].totalAmount += parseFloat(item.amount || 0);
                                                                    groups[invoice].totalDiscount += parseFloat(item.discount || 0);
                                                                    groups[invoice].totalPaid += parseFloat(item.paid || 0);
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
                                                                const colSpan = isParty ? "11" : "11";

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
                                                                                <td className="px-4 py-4 text-left font-bold text-gray-900">{group.totalQty.toLocaleString('en-US')}</td>
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
                                                                                <td className="px-4 py-4 text-left text-gray-900 font-bold">
                                                                                    {isMulti ? (group.trucks.size > 0 ? group.trucks.size : '-') : (group.items[0]?.truck || '-')}
                                                                                </td>
                                                                            ) : (
                                                                                <td className="px-4 py-4 text-left font-bold text-gray-900">{group.totalQty.toLocaleString('en-US')}</td>
                                                                            )}
                                                                            {/* Column 6: Rate */}
                                                                            <td className="px-4 py-4 text-left font-bold text-gray-500">
                                                                                {isMulti ? (
                                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700 uppercase tracking-wider">
                                                                                        Multiple
                                                                                    </span>
                                                                                ) : (group.items[0]?.rate ? `৳${parseFloat(group.items[0].rate).toLocaleString('en-US')}` : (group.totalQty > 0 ? `৳${(group.totalAmount / group.totalQty).toFixed(2)}` : '-'))}
                                                                            </td>
                                                                            <td className="px-4 py-4 text-left font-black text-violet-700">৳{group.totalAmount.toLocaleString('en-IN')}</td>
                                                                            <td className="px-4 py-4 text-left font-bold text-pink-600">৳{group.totalDiscount.toLocaleString('en-IN')}</td>
                                                                            <td className="px-4 py-4 text-left font-bold text-teal-600">৳{group.totalPaid.toLocaleString('en-IN')}</td>
                                                                            <td className="px-4 py-4 text-left font-bold text-orange-600">৳{Math.max(0, group.totalAmount - group.totalDiscount - group.totalPaid).toLocaleString('en-IN')}</td>
                                                                            <td className="px-4 py-4 text-left">
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
                                                                                            paid: group.totalPaid,
                                                                                            status: group.status
                                                                                        };
                                                                                        generateSaleInvoicePDF(saleObject);
                                                                                    }}
                                                                                    className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-blue-600 rounded-lg transition-colors"
                                                                                >
                                                                                    <FileTextIcon className="w-4 h-4" />
                                                                                </button>
                                                                            </td>
                                                                        </tr>

                                                                        {/* Detailed Rows */}
                                                                        {isExpanded && group.items.map((item, idx) => (
                                                                            <tr key={`${index}-${idx}`} className="bg-blue-50/10 border-b border-gray-50/50">
                                                                                <td className="px-4 py-3 pl-10 text-xs text-gray-400"></td>
                                                                                <td className="px-4 py-3 text-xs text-gray-500 italic">{item.lcNo || '-'}</td>
                                                                                <td className="px-4 py-3 text-xs text-gray-900 font-medium">{item.product}</td>
                                                                                {isParty ? (
                                                                                    <td className="px-4 py-3 text-left text-xs font-bold text-gray-900">{parseFloat(item.quantity).toLocaleString('en-US')}</td>
                                                                                ) : (
                                                                                    <td className="px-4 py-3 text-xs text-gray-600">{item.brand || '-'}</td>
                                                                                )}
                                                                                {isParty ? (
                                                                                    viewData.customerType?.includes('Party') ? (
                                                                                        <td className="px-4 py-3 text-left text-xs text-gray-900 font-medium">{item.truck || '-'}</td>
                                                                                    ) : null
                                                                                ) : (
                                                                                    <td className="px-4 py-3 text-left text-xs font-bold text-gray-900">{parseFloat(item.quantity).toLocaleString('en-US')}</td>
                                                                                )}
                                                                                <td className="px-4 py-3 text-left text-xs text-gray-500">৳{parseFloat(item.rate).toLocaleString('en-IN')}</td>
                                                                                <td className="px-4 py-3 text-left text-xs font-bold text-violet-600">৳{parseFloat(item.amount).toLocaleString('en-IN')}</td>
                                                                                <td className="px-4 py-3 text-left text-xs font-bold text-pink-500">৳{parseFloat(item.discount || 0).toLocaleString('en-IN')}</td>
                                                                                <td className="px-4 py-3 text-left text-xs font-bold text-teal-500">৳{parseFloat(item.paid || 0).toLocaleString('en-IN')}</td>
                                                                                <td className="px-4 py-3 text-left text-xs font-bold text-orange-500">৳{Math.max(0, parseFloat(item.amount || 0) - parseFloat(item.discount || 0) - parseFloat(item.paid || 0)).toLocaleString('en-IN')}</td>
                                                                                <td className="px-4 py-3"></td>
                                                                            </tr>
                                                                        ))}
                                                                    </React.Fragment>
                                                                );
                                                            })
                                                        ) : (
                                                            <tr>
                                                                <td colSpan="11" className="px-4 py-8 text-left text-gray-400 font-medium italic">No sales history found matching filters</td>
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
                                                                        totalPaid: 0,
                                                                        totalQty: 0,
                                                                        trucks: new Set()
                                                                    };
                                                                }
                                                                groups[invoice].items.push(item);
                                                                groups[invoice].totalAmount += parseFloat(item.amount || 0);
                                                                groups[invoice].totalDiscount += parseFloat(item.discount || 0);
                                                                groups[invoice].totalPaid += parseFloat(item.paid || 0);
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
                                                                                <span className="font-bold text-gray-900">{group.totalQty.toLocaleString('en-US')}</span>
                                                                            </div>
                                                                            <div className="flex justify-between text-xs pt-1 border-t border-gray-100 mt-1">
                                                                                <span className="text-gray-500">Amount:</span>
                                                                                <span className="font-black text-violet-700">৳{group.totalAmount.toLocaleString('en-IN')}</span>
                                                                            </div>
                                                                            <div className="flex justify-between text-xs">
                                                                                <span className="text-gray-500">{viewData?.customerType === 'General Customer' ? 'Truck Fare:' : 'Paid:'}</span>
                                                                                <span className="font-bold text-teal-700">৳{group.totalPaid.toLocaleString('en-IN')}</span>
                                                                            </div>
                                                                            <div className="flex justify-between text-xs">
                                                                                <span className="text-gray-500">Balance:</span>
                                                                                <span className="font-bold text-orange-700">৳{Math.max(0, group.totalAmount - group.totalDiscount - group.totalPaid).toLocaleString('en-IN')}</span>
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
                                                                                        paid: group.totalPaid,
                                                                                        status: group.status
                                                                                    };
                                                                                    generateSaleInvoicePDF(saleObject);
                                                                                }}
                                                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                                                                            >
                                                                                <FileTextIcon className="w-3.5 h-3.5" /> Print Invoice
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="py-8 text-left text-xs text-gray-400 font-medium italic">No sales history found matching filters</div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Payment History Table */}
                                    {activeHistoryTab === 'payment' && (
                                        <>
                                            <div className="flex flex-row items-center justify-between gap-3 mb-3 md:mb-4">
                                                <h4 className="text-base md:text-lg font-bold text-gray-800">Payment History</h4>
                                                <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPaymentSubTab('collection')}
                                                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                                                            paymentSubTab === 'collection'
                                                                ? 'bg-white text-blue-600 shadow-sm'
                                                                : 'text-gray-600 hover:text-gray-900'
                                                        }`}
                                                    >
                                                        Collection History
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPaymentSubTab('paid')}
                                                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                                                            paymentSubTab === 'paid'
                                                                ? 'bg-white text-indigo-600 shadow-sm'
                                                                : 'text-gray-600 hover:text-gray-900'
                                                        }`}
                                                    >
                                                        Paid History
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                                {paymentSubTab === 'paid' ? (
                                                    <>
                                                        {/* Desktop Paid History Table */}
                                                        <table className="w-full text-left text-sm hidden md:table">
                                                            <thead className="bg-white border-b border-gray-200">
                                                                <tr>
                                                                    <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('date')}>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-4" />
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
                                                                    <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('amount')}>
                                                                        <div className="flex items-center justify-start gap-1">
                                                                            <span>Amount</span>
                                                                            <SortIcon config={historySortConfig} columnKey="amount" />
                                                                        </div>
                                                                    </th>
                                                                    <th className="px-4 py-3 font-semibold text-gray-600 text-left">Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {filteredPayToCustomerHistory && filteredPayToCustomerHistory.length > 0 ? (
                                                                    filteredPayToCustomerHistory.map((payout, index) => (
                                                                        <tr key={payout.id || index} className="border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors">
                                                                            <td className="px-4 py-3 text-gray-600">{formatDate(payout.date)}</td>
                                                                            <td className="px-4 py-3 font-medium text-gray-900">{payout.method}</td>
                                                                            <td className="px-4 py-3 text-gray-600">
                                                                                <span className="font-semibold text-xs">
                                                                                    {payout.method === 'Cash' ? (payout.receiveBy || payout.paidBy || '—') : (payout.bankName || '—')}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-4 py-3 text-gray-600 text-xs">
                                                                                {payout.method === 'Cash' ? (payout.place || '—') : (payout.branch || '—')}
                                                                            </td>
                                                                            <td className="px-4 py-3 text-gray-600 text-xs">
                                                                                {payout.accountNo || '-'}
                                                                            </td>
                                                                            <td className="px-4 py-3 text-left font-bold text-gray-900">
                                                                                <div className="flex flex-col items-start">
                                                                                    <span>৳{parseFloat(payout.amount || 0).toLocaleString('en-IN')}</span>
                                                                                    {(payout.reference || payout.remarks) && <span className="text-[9px] text-blue-500 font-normal">Ref: {payout.reference || payout.remarks}</span>}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-4 py-3 text-left">
                                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                                    (payout.status || '').toLowerCase() === 'requested'
                                                                                        ? 'bg-amber-50 text-amber-600'
                                                                                        : 'bg-emerald-50 text-emerald-600'
                                                                                }`}>
                                                                                    {payout.status || 'Completed'}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    ))
                                                                ) : (
                                                                    <tr>
                                                                        <td colSpan="7" className="px-4 py-8 text-left text-gray-400 font-medium italic">No paid to customer history found matching filters</td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>

                                                        {/* Mobile Paid History Card View */}
                                                        <div className="block md:hidden p-4 space-y-3">
                                                            {filteredPayToCustomerHistory && filteredPayToCustomerHistory.length > 0 ? (
                                                                filteredPayToCustomerHistory.map((payout, index) => {
                                                                    const isExpanded = expandedPaymentHistoryCards === index;
                                                                    return (
                                                                        <div
                                                                            key={index}
                                                                            className={`mobile-card transition-all duration-300 ${isExpanded ? 'expanded' : 'collapsed'}`}
                                                                            onClick={() => setExpandedPaymentHistoryCards(isExpanded ? null : index)}
                                                                        >
                                                                            <div className="mobile-card-header">
                                                                                <div>
                                                                                    <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{formatDate(payout.date)}</div>
                                                                                    <div className="text-sm font-black text-gray-900">{payout.method}</div>
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="font-bold text-indigo-600">
                                                                                        ৳{parseFloat(payout.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                                                                                <div className="space-y-1">
                                                                                    {(payout.bankName || payout.receiveBy || payout.paidBy) && (
                                                                                        <div className="flex justify-between text-xs">
                                                                                            <span className="text-gray-500">{payout.method === 'Cash' ? 'Paid By:' : 'Bank:'}</span>
                                                                                            <span className="font-bold text-gray-900">{payout.method === 'Cash' ? (payout.receiveBy || payout.paidBy) : payout.bankName}</span>
                                                                                        </div>
                                                                                    )}
                                                                                    {payout.accountNo && (
                                                                                        <div className="flex justify-between text-xs">
                                                                                            <span className="text-gray-500">Account No:</span>
                                                                                            <span className="font-mono text-gray-900">{payout.accountNo}</span>
                                                                                        </div>
                                                                                    )}
                                                                                    <div className="flex justify-between text-xs pt-1 border-t border-gray-100 mt-1">
                                                                                        <span className="text-gray-500">Amount:</span>
                                                                                        <span className="font-black text-indigo-600">৳{parseFloat(payout.amount || 0).toLocaleString('en-IN')}</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })
                                                            ) : (
                                                                <div className="py-8 text-left text-xs text-gray-400 font-medium italic">No paid to customer history found matching filters</div>
                                                            )}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        {/* Desktop Payment History Table */}
                                                        <table className="w-full text-left text-sm hidden md:table">
                                                            <thead className="bg-white border-b border-gray-200">
                                                                <tr>
                                                                    <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('date')}>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-4" />
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
                                                                    <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('amount')}>
                                                                        <div className="flex items-center justify-start gap-1">
                                                                            <span>Amount</span>
                                                                            <SortIcon config={historySortConfig} columnKey="amount" />
                                                                        </div>
                                                                    </th>
                                                                    <th className="px-4 py-3 font-semibold text-gray-600 text-left">Status</th>
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
                                                                            <td className="px-4 py-3 text-left font-bold text-gray-900">
                                                                                <div className="flex flex-col items-end">
                                                                                    <span>৳{parseFloat(payment.amount).toLocaleString('en-IN')}</span>
                                                                                    {payment.reference && <span className="text-[9px] text-blue-500 font-normal">Ref: {payment.reference}</span>}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-4 py-3 text-left">
                                                                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold">
                                                                                    {payment.status || 'Received'}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    ))
                                                                ) : (
                                                                    <tr>
                                                                        <td colSpan="7" className="px-4 py-8 text-left text-gray-400 font-medium italic">No payment history found matching filters</td>
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
                                                                                        <span className="font-black text-emerald-600">৳{parseFloat(payment.amount).toLocaleString('en-IN')}</span>
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
                                                                <div className="py-8 text-left text-xs text-gray-400 font-medium italic">No payment history found</div>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {/* All History Table (Customer Account Ledger) */}
                                    {activeHistoryTab === 'all' && (
                                        <>
                                            <div className="flex items-center justify-between mb-3 md:mb-4">
                                                <div>
                                                    <h4 className="text-base md:text-lg font-bold text-gray-800">Customer Account Ledger</h4>
                                                    <p className="text-xs text-gray-500 font-medium">Chronological ledger statement of all debits, credits, and running balance</p>
                                                </div>
                                            </div>

                                            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                                <div className="overflow-x-auto min-w-full">
                                                    <table className="w-full text-left text-sm hidden md:table">
                                                        <thead className="bg-white border-b border-gray-200">
                                                            <tr>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('date')}>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-4" />
                                                                        <span>Date</span>
                                                                        <SortIcon config={historySortConfig} columnKey="date" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('lcNo')}>
                                                                    <div className="flex items-center gap-1">
                                                                        <span>Ref No</span>
                                                                        <SortIcon config={historySortConfig} columnKey="lcNo" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('product')}>
                                                                    <div className="flex items-center gap-1">
                                                                        <span>Particulars</span>
                                                                        <SortIcon config={historySortConfig} columnKey="product" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('quantity')}>
                                                                    <div className="flex items-center justify-start gap-1">
                                                                        <span>Qty</span>
                                                                        <SortIcon config={historySortConfig} columnKey="quantity" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('rate')}>
                                                                    <div className="flex items-center justify-start gap-1">
                                                                        <span>Rate</span>
                                                                        <SortIcon config={historySortConfig} columnKey="rate" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('amount')}>
                                                                    <div className="flex items-center justify-start gap-1">
                                                                        <span>Debit (Dr)</span>
                                                                        <SortIcon config={historySortConfig} columnKey="amount" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('paid')}>
                                                                    <div className="flex items-center justify-start gap-1">
                                                                        <span>Credit (Cr)</span>
                                                                        <SortIcon config={historySortConfig} columnKey="paid" />
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left">Discount</th>
                                                                <th className="px-4 py-3 font-semibold text-gray-600 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestHistorySort('balance')}>
                                                                    <div className="flex items-center justify-start gap-1">
                                                                        <span>Balance</span>
                                                                        <SortIcon config={historySortConfig} columnKey="balance" />
                                                                    </div>
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {isFiltered && combinedHistory && combinedHistory.length > 0 && (
                                                                <tr className="border-b border-gray-100 bg-gray-50/30 font-medium">
                                                                    <td colSpan="8" className="px-4 py-3 text-gray-950 font-bold text-center">
                                                                        Opening Balance
                                                                    </td>
                                                                    <td className="px-4 py-3 text-left font-black text-orange-600">৳{openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                                </tr>
                                                            )}
                                                            {combinedHistory && combinedHistory.length > 0 ? (
                                                                combinedHistory.reduce((acc, item) => {
                                                                    const invoice = item.invoiceNo || item.lcNo;
                                                                    const existing = item.type === 'sale' && invoice
                                                                        ? acc.find(x => x.type === 'sale' && (x.invoiceNo === invoice || x.lcNo === invoice))
                                                                        : null;

                                                                    if (existing) {
                                                                        existing.amount = (parseFloat(existing.amount) || 0) + (parseFloat(item.amount) || 0);
                                                                        existing.paid = (parseFloat(existing.paid) || 0) + (parseFloat(item.paid) || 0);

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

                                                                        existing.product = existing.items.map(si => si.product || '—').join('\n');
                                                                        existing.quantity_display = existing.items.map(si => si.quantity.toLocaleString('en-US')).join('\n');
                                                                        existing.rate_display = existing.items.map(si => si.rate > 0 ? `৳${si.rate.toLocaleString('en-IN')}` : '—').join('\n');

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
                                                                    <tr key={index} className={`border-b border-gray-100 transition-colors hover:bg-gray-50 ${item.type === 'payment' ? 'bg-emerald-50/10' : (item.type === 'payToCustomer' ? 'bg-indigo-50/10' : (item.type === 'purchase' ? 'bg-amber-50/10' : 'bg-white'))}`}>
                                                                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(item.date)}</td>
                                                                        <td className="px-4 py-3 font-bold text-gray-900 uppercase text-xs">{item.invoiceNo || item.lcNo || item.receiptNo || '—'}</td>
                                                                        <td className="px-4 py-3 text-gray-800 text-xs">
                                                                            <div className="flex flex-col gap-0.5">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                                                                                        item.type === 'sale'
                                                                                            ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                                                                            : (item.type === 'payment'
                                                                                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                                                                : (item.type === 'payToCustomer'
                                                                                                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                                                                                    : 'bg-amber-50 text-amber-600 border border-amber-100'))
                                                                                    }`}>
                                                                                        {item.type === 'sale' ? 'Sale' : (item.type === 'payment' ? 'Collection' : (item.type === 'payToCustomer' ? 'Payout' : 'Purchase'))}
                                                                                    </span>
                                                                                    <span className="whitespace-pre-wrap font-medium">
                                                                                        {item.type === 'sale'
                                                                                            ? (item.product
                                                                                                ? `${item.product}${item.brand && item.brand !== '-' ? ` (${item.brand})` : ''}`
                                                                                                : 'Sales Invoice')
                                                                                            : (item.type === 'purchase'
                                                                                                ? (item.product
                                                                                                    ? `${item.product}${item.brand && item.brand !== '-' ? ` (${item.brand})` : ''}`
                                                                                                    : 'Purchase Invoice')
                                                                                                : (item.type === 'payment'
                                                                                                    ? `${item.method}${item.bankName || item.receiveBy ? ` (${item.bankName || item.receiveBy})` : ''}`
                                                                                                    : `${item.method}${item.bankName || item.paidBy ? ` (${item.bankName || item.paidBy})` : ''}`
                                                                                                )
                                                                                            )
                                                                                        }
                                                                                    </span>
                                                                                </div>
                                                                                {(item.type === 'sale' || item.type === 'purchase') && parseFloat(item.paid || item.truckFare || 0) > 0 && (
                                                                                    <div className="text-[10px] text-teal-600 font-medium pl-0.5">
                                                                                        Truck Fare paid (৳{parseFloat(item.paid || item.truckFare).toLocaleString('en-IN')})
                                                                                    </div>
                                                                                )}
                                                                                {(item.remarks || item.note || item.reference || item.narration) && (
                                                                                    <div className="text-[10px] text-gray-500 italic pl-0.5">
                                                                                        Note: {item.remarks || item.note || item.reference || item.narration}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-left text-gray-900 whitespace-pre-wrap text-xs">{item.quantity_display || (parseFloat(item.quantity || 0) > 0 ? parseFloat(item.quantity).toLocaleString('en-US') : '—')}</td>
                                                                        <td className="px-4 py-3 text-left text-gray-500 whitespace-pre-wrap text-xs">{item.rate_display || (parseFloat(item.rate || 0) > 0 ? `৳${parseFloat(item.rate).toLocaleString('en-IN')}` : '—')}</td>
                                                                        <td className="px-4 py-3 text-left font-black text-violet-700 text-xs">
                                                                            {item.type === 'sale'
                                                                                ? `৳${parseFloat(item.amount || 0).toLocaleString('en-IN')}`
                                                                                : (item.type === 'payToCustomer'
                                                                                    ? `৳${parseFloat(item.amount || 0).toLocaleString('en-IN')}`
                                                                                    : '—'
                                                                                )
                                                                            }
                                                                        </td>
                                                                        <td className="px-4 py-3 text-left font-black text-emerald-600 text-xs">
                                                                            {item.type === 'payment'
                                                                                ? `৳${parseFloat(item.amount || 0).toLocaleString('en-IN')}`
                                                                                : (item.type === 'purchase'
                                                                                    ? `৳${parseFloat(item.amount || 0).toLocaleString('en-IN')}`
                                                                                    : (item.type === 'sale' && parseFloat(item.paid || 0) > 0
                                                                                        ? `৳${parseFloat(item.paid).toLocaleString('en-IN')}`
                                                                                        : '—'
                                                                                    )
                                                                                )
                                                                            }
                                                                        </td>
                                                                        <td className="px-4 py-3 text-left text-xs font-bold text-pink-600">
                                                                            {parseFloat(item.discount || 0) > 0 ? `৳${parseFloat(item.discount).toLocaleString('en-IN')}` : '—'}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-left font-black text-orange-600 text-xs">৳{item.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                                    </tr>
                                                                ))
                                                            ) : (
                                                                <tr>
                                                                    <td colSpan="9" className="px-4 py-12 text-left text-gray-400 font-medium italic">No ledger entries found</td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>

                                                    {/* Mobile Customer Account Ledger Card View */}
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
                                                                    existing.quantity_display = existing.items.map(si => si.quantity.toLocaleString('en-US')).join('\n');
                                                                    existing.rate_display = existing.items.map(si => si.rate > 0 ? `৳${si.rate.toLocaleString('en-IN')}` : '—').join('\n');

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
                                                                            <div className="text-left">
                                                                                <div className={`text-sm font-black ${item.type === 'sale' ? 'text-violet-700' : 'text-emerald-600'}`}>
                                                                                    {item.type === 'sale' ? `+৳${parseFloat(item.amount || 0).toLocaleString('en-IN')}` : `-৳${parseFloat(item.amount || 0).toLocaleString('en-IN')}`}
                                                                                </div>
                                                                                <div className="text-[10px] font-bold text-orange-600">Balance: ৳{item.runningBalance.toLocaleString('en-IN')}</div>
                                                                            </div>
                                                                        </div>

                                                                        <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                                                                            <div className="space-y-1 text-xs">
                                                                                {item.type === 'sale' ? (
                                                                                    <>
                                                                                        <div className="flex justify-between items-start">
                                                                                            <span className="text-gray-500">Product:</span>
                                                                                            <span className="font-bold text-left whitespace-pre-wrap">{item.product}</span>
                                                                                        </div>
                                                                                        <div className="flex justify-between items-start">
                                                                                            <span className="text-gray-500">Qty:</span>
                                                                                            <span className="font-bold text-left whitespace-pre-wrap">{item.quantity_display || (parseFloat(item.quantity || 0) > 0 ? parseFloat(item.quantity).toLocaleString('en-US') : '—')}</span>
                                                                                        </div>
                                                                                        <div className="flex justify-between items-start">
                                                                                            <span className="text-gray-500">Rate:</span>
                                                                                            <span className="font-bold text-left whitespace-pre-wrap">{item.rate_display || (parseFloat(item.rate || 0) > 0 ? `৳${parseFloat(item.rate).toLocaleString('en-IN')}` : '—')}</span>
                                                                                        </div>
                                                                                        <div className="flex justify-between"><span className="text-gray-500">Paid:</span><span className="font-bold text-emerald-600">৳{parseFloat(item.paid || 0).toLocaleString('en-IN')}</span></div>
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <div className="flex justify-between"><span className="text-gray-500">Account:</span><span className="font-bold">{item.accountNo || '—'}</span></div>
                                                                                        <div className="flex justify-between"><span className="text-gray-500">Bank:</span><span className="font-bold">{item.bankName || '—'}</span></div>
                                                                                        <div className="flex justify-between"><span className="text-gray-500">Ref:</span><span className="font-bold text-blue-600">{item.reference || '—'}</span></div>
                                                                                        {parseFloat(item.discount) > 0 && (
                                                                                            <div className="flex justify-between pt-1 border-t border-gray-100 mt-1">
                                                                                                <span className="text-pink-500 font-bold">Discount:</span>
                                                                                                <span className="font-black text-pink-600">৳{parseFloat(item.discount).toLocaleString('en-IN')}</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        ) : (
                                                            <div className="py-8 text-left text-xs text-gray-400 font-medium italic">No transactions found</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>,
                        document.body
                    )
                }
            </div>

            <CustomerReport
                isOpen={showReport}
                onClose={() => setShowReport(false)}
                customers={customers}
                purchasesList={purchasesList}
                salesRecords={salesRecords}
                purchaseReceivesList={purchaseReceivesList}
            />
        </>
    );
};

export default Customer;
