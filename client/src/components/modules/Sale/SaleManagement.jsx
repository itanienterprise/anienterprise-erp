import React, { useState, useEffect, useRef, useMemo } from 'react';
import { EditIcon, TrashIcon, XIcon, SearchIcon, FunnelIcon, ChevronDownIcon, ChevronUpIcon, EyeIcon, ReceiptIcon, BarChartIcon, TrendingUpIcon, DollarSignIcon, FileTextIcon, CheckIcon } from '../../Icons';
import { generateSaleInvoicePDF } from '../../../utils/pdfGenerator';
import { API_BASE_URL, SortIcon, formatDate } from '../../../utils/helpers';
import { encryptData, decryptData } from '../../../utils/encryption';
import CustomDatePicker from '../../shared/CustomDatePicker';
import axios from '../../../utils/api';
import './SaleManagement.css';

const getSafeString = (val) => {
    if (!val) return '';
    if (typeof val === 'object') return val.customerName || val.companyName || val.name || '';
    return String(val);
};

const SaleManagement = ({
    saleType,
    isSelectionMode,
    setIsSelectionMode,
    selectedItems,
    setSelectedItems,
    toggleSelection,
    isLongPressTriggered,
    onDeleteConfirm,
    startLongPress,
    endLongPress,
    setShowSalesReport,
    setSalesReportData,
    saleFilters,
    setSaleFilters,
    currentUser,
    addNotification
}) => {
    const [showForm, setShowForm] = useState(false);
    const [sales, setSales] = useState([]);
    const [allSalesRecords, setAllSalesRecords] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [stockRecords, setStockRecords] = useState([]);
    const [exportersList, setExportersList] = useState([]);
    const [importersList, setImportersList] = useState([]);
    const [portsList, setPortsList] = useState([]);
    const [cnfsList, setCnfsList] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [viewData, setViewData] = useState(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [expandedRows, setExpandedRows] = useState([]);
    const [showSaleFilterPanel, setShowSaleFilterPanel] = useState(false);
    const [saleFilterSearch, setSaleFilterSearch] = useState({ companySearch: '', invoiceSearch: '', portSearch: '', productSearch: '', indCnfSearch: '', bdCnfSearch: '' });
    const [activeFilterDropdown, setActiveFilterDropdown] = useState(null); // 'from', 'to', 'company', 'invoice', 'port', 'product', 'indCnf', 'bdCnf'
    const [isRequestedOnly, setIsRequestedOnly] = useState(false);
    const [originalData, setOriginalData] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

    const [showBulkRateModal, setShowBulkRateModal] = useState(false);
    const [bulkRate, setBulkRate] = useState('');

    const handleBulkRateUpdate = async () => {
        if (!bulkRate || isNaN(parseFloat(bulkRate))) {
            alert('Please enter a valid rate');
            return;
        }

        setIsSubmitting(true);
        try {
            const selectedIds = Array.from(selectedItems);
            const updates = selectedIds.map(async (id) => {
                const sale = allSalesRecords.find(s => s._id === id);
                if (!sale) return;

                const newRate = parseFloat(bulkRate);

                // Update items
                const updatedItems = (sale.items || []).map(item => {
                    const updatedBrandEntries = (item.brandEntries || []).map(be => {
                        const activeUOM = be.uom || item.uom || sale.uom || 'Truck';
                        const qty = parseFloat(be.quantity || item.quantity || sale.quantity) || 0;
                        const truckCount = parseFloat(be.truck || item.truck || sale.truck) || 0;
                        const price = newRate;

                        let entryTotal = 0;
                        if (activeUOM === 'QTY') {
                            entryTotal = qty * price;
                        } else {
                            entryTotal = truckCount * price;
                        }
                        return { ...be, unitPrice: price, totalAmount: entryTotal.toFixed(2) };
                    });

                    // Calculate item total amount from brand entries OR item quantity
                    let itemTotalAmount = 0;
                    if (updatedBrandEntries.length > 0) {
                        itemTotalAmount = updatedBrandEntries.reduce((sum, be) => sum + (parseFloat(be.totalAmount) || 0), 0);
                    } else {
                        const activeItemUOM = item.uom || sale.uom || 'Truck';
                        const itemQty = parseFloat(item.quantity || sale.quantity) || 0;
                        const itemTruck = parseFloat(item.truck || sale.truck) || 0;
                        const itemPrice = newRate;

                        if (activeItemUOM === 'QTY') {
                            itemTotalAmount = itemQty * itemPrice;
                        } else {
                            itemTotalAmount = itemTruck * itemPrice;
                        }
                    }

                    return {
                        ...item,
                        brandEntries: updatedBrandEntries,
                        unitPrice: newRate,
                        totalAmount: itemTotalAmount.toFixed(2)
                    };
                });

                // If no items (old format)
                let updatedSale = { ...sale };
                if (updatedItems.length > 0) {
                    updatedSale.items = updatedItems;
                    updatedSale.totalAmount = updatedItems.reduce((sum, item) => sum + (parseFloat(item.totalAmount) || 0), 0).toFixed(2);
                } else {
                    const activeSaleUOM = sale.uom || 'Truck';
                    const saleQty = parseFloat(sale.quantity) || 0;
                    const saleTruck = parseFloat(sale.truck) || 0;
                    const salePrice = newRate;

                    let saleTotal = 0;
                    if (activeSaleUOM === 'QTY') {
                        saleTotal = saleQty * salePrice;
                    } else {
                        saleTotal = saleTruck * salePrice;
                    }

                    updatedSale.unitPrice = newRate;
                    updatedSale.totalAmount = saleTotal.toFixed(2);
                }

                // Update due amount
                updatedSale.dueAmount = Math.max(0, (parseFloat(updatedSale.totalAmount) || 0) - (parseFloat(updatedSale.discount) || 0) - (parseFloat(updatedSale.paidAmount) || 0));

                const { _id, createdAt, ...dataToSend } = updatedSale;

                if (id) {
                    return axios.put(`${API_BASE_URL}/api/sales/${id}`, dataToSend);
                }
            });

            await Promise.all(updates);
            addNotification('Bulk Update Success', `Updated rate for ${selectedIds.length} sales`);
            fetchSales();
            setSelectedItems(new Set());
            setIsSelectionMode(false);
            setShowBulkRateModal(false);
            setBulkRate('');
        } catch (err) {
            console.error('Bulk update error:', err);
            alert('Failed to update sales in bulk');
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

    const renderSortIcon = (key) => {
        if (sortConfig.key !== key) {
            return <ChevronDownIcon className="w-3 h-3 ml-1 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
        }
        return sortConfig.direction === 'desc' ?
            <ChevronDownIcon className="w-3 h-3 ml-1 text-blue-600" /> :
            <ChevronUpIcon className="w-3 h-3 ml-1 text-blue-600" />;
    };

    const isFullAdmin = useMemo(() => {
        if (!currentUser) return false;
        if (currentUser.username === 'admin') return true;
        const role = (currentUser.role || '').toLowerCase();
        return role === 'admin';
    }, [currentUser]);

    const canApprove = useMemo(() => {
        if (!currentUser) return false;
        if (currentUser.username === 'admin') return true;
        const role = (currentUser.role || '').toLowerCase();
        return ['admin', 'incharge', 'sales manager'].includes(role);
    }, [currentUser]);

    const canUserEditSale = (sale) => {
        if (isFullAdmin) return true;
        // Non-admin can only edit if rate was missing and it hasn't been edited yet
        return sale.rateMissing === true && sale.isEdited !== true;
    };

    const isFieldReadOnly = (value) => {
        if (isFullAdmin) return false;
        if (!editingId) return false; // New entries are always editable
        if (value === null || value === undefined) return false;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') return value.trim() !== '' && value.trim() !== '0';
        return !!value;
    };

    const fetchExporters = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/exporters`);
            setExportersList(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching exporters:', error);
        }
    };

    useEffect(() => {
        if (saleType === 'Border') {
            fetchExporters();
        }
    }, [saleType]);


    const processSaleEffects = async (saleData, isEditing = false) => {
        // Resolve Customer ID if missing but name is present
        let targetCustomerId = saleData.customerId;
        if (!targetCustomerId && (saleData.companyName || saleData.customerName)) {
            const matched = customers.find(c =>
                (c.companyName && saleData.companyName && c.companyName.trim().toLowerCase() === saleData.companyName.trim().toLowerCase()) ||
                (c.customerName && saleData.customerName && c.customerName.trim().toLowerCase() === saleData.customerName.trim().toLowerCase())
            );
            if (matched) targetCustomerId = matched._id;
        }

        // Update Customer History
        if (targetCustomerId) {
            try {
                const custRes = await axios.get(`${API_BASE_URL}/api/customers/${targetCustomerId}`);
                const customer = custRes.data;

                const newSaleEntries = [];
                (saleData.items || []).forEach((product, pIdx) => {
                    (product.brandEntries || []).forEach((entry, eIdx) => {
                        const isFirstEntry = pIdx === 0 && eIdx === 0;
                        newSaleEntries.push({
                            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            date: saleData.date,
                            invoiceNo: saleData.invoiceNo,
                            lcNo: saleData.lcNo || '',
                            product: product.productName || '',
                            brand: entry.brand || '',
                            quantity: entry.quantity || 0,
                            rate: entry.unitPrice || 0,
                            truck: entry.truck || '',
                            amount: entry.totalAmount || 0,
                            paid: isFirstEntry ? (parseFloat(saleData.paidAmount) || 0) : 0,
                            due: isFirstEntry ? (parseFloat(saleData.dueAmount) || 0) : (entry.totalAmount || 0),
                            discount: isFirstEntry ? (parseFloat(saleData.discount) || 0) : 0,
                            warehouse: entry.warehouseName || '',
                            requestedBy: saleData.requestedBy || '',
                            requestedByUsername: saleData.requestedByUsername || '',
                            acceptedBy: saleData.acceptedBy || '',
                            status: 'Pending'
                        });
                    });
                });

                let baseHistory = customer.salesHistory || [];
                if (isEditing) {
                    baseHistory = baseHistory.filter(item => item.invoiceNo !== saleData.invoiceNo);
                }

                const updatedCustomer = {
                    ...customer,
                    salesHistory: [...newSaleEntries, ...baseHistory]
                };

                await axios.put(`${API_BASE_URL}/api/customers/${targetCustomerId}`, updatedCustomer);
            } catch (err) {
                console.error('Error updating customer history:', err);
            }
        }

        // Border Sale: Auto-deduct sold Qty from matching warehouse records
        if (saleData.saleType === 'Border') {
            try {
                const whRes = await axios.get(`${API_BASE_URL}/api/warehouses`);
                const liveWarehouses = Array.isArray(whRes.data) ? whRes.data : [];

                const deductions = {};
                (saleData.items || []).forEach(product => {
                    const soldProductName = (product.productName || '').trim().toLowerCase();
                    (product.brandEntries || []).forEach(entry => {
                        const soldQty = parseFloat(entry.quantity) || 0;
                        if (soldQty === 0) return;

                        const matchingWh = liveWarehouses.find(wh => {
                            const whProduct = (wh.productName || wh.product || '').trim().toLowerCase();
                            return whProduct === soldProductName;
                        });

                        if (matchingWh) {
                            if (!deductions[matchingWh._id]) {
                                deductions[matchingWh._id] = { wh: matchingWh, totalDeduct: 0 };
                            }
                            deductions[matchingWh._id].totalDeduct += soldQty;
                        }
                    });
                });

                await Promise.all(
                    Object.values(deductions).map(async ({ wh, totalDeduct }) => {
                        const currentQty = parseFloat(wh.whQty) || 0;
                        const updatedWh = {
                            ...wh,
                            whQty: Math.max(0, currentQty - totalDeduct).toString()
                        };
                        await axios.put(`${API_BASE_URL}/api/warehouses/${wh._id}`, updatedWh);
                    })
                );
            } catch (err) {
                console.error('Error auto-deducting warehouse stock:', err);
            }
        }
    };

    const handleStatusUpdate = async (sale, newStatus) => {
        console.log(`[handleStatusUpdate] Initiating status update to: ${newStatus} for sale ID:`, sale._id);
        console.log(`[handleStatusUpdate] Current user:`, currentUser);
        try {
            setIsSubmitting(true);
            const actionBy = currentUser ? (currentUser.name || currentUser.username || '') : '';
            const { _id, createdAt, ...rest } = sale;

            const updatedData = {
                ...rest,
                status: newStatus,
                ...(newStatus === 'Pending' ? { acceptedBy: actionBy } : {}),
                ...(newStatus === 'Rejected' ? { rejectedBy: actionBy } : {}),
            };

            console.log(`[handleStatusUpdate] Sending PUT request with data:`, updatedData);
            const response = await axios.put(`${API_BASE_URL}/api/sales/${_id}`, updatedData);
            console.log(`[handleStatusUpdate] Response status:`, response.status);

            if (response.status >= 200 && response.status < 300) {
                // If accepted, trigger history and stock updates
                if (newStatus === 'Pending') {
                    console.log(`[handleStatusUpdate] Status is Pending. Triggering processSaleEffects...`);
                    try {
                        await processSaleEffects(updatedData, false);
                        console.log(`[handleStatusUpdate] processSaleEffects successful.`);
                    } catch (err) {
                        console.error(`[handleStatusUpdate] Error in processSaleEffects:`, err);
                        alert(`Successfully updated status, but failed to process warehouse/customer effects: ${err.message}`);
                    }
                }

                // Send notification
                if (addNotification) {
                    console.log(`[handleStatusUpdate] Target recipients: roles=["admin", "incharge", "sales manager"], users=[${sale.requestedByUsername}]`);
                    try {
                        const now = new Date();
                        const dateStr = formatDate(now);
                        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const adminName = currentUser?.name || currentUser?.username || 'Admin';
                        const statusLabel = newStatus === 'Pending' ? 'Accepted' : newStatus;
                        const actionLabel = newStatus === 'Pending' ? 'accepted' : 'rejected';
                        const requesterName = sale.requestedBy || sale.requestedByUsername || 'an employee';
                        const sType = saleType === 'Border' ? 'Border Sale' : 'General Sale';

                        const targetRoles = ['admin', 'incharge', 'sales manager'];
                        const targetUsers = [sale.requestedByUsername].filter(Boolean);
                        // Explicitly include 'admin' username to be sure they get it regardless of role filter
                        if (!targetUsers.includes('admin')) targetUsers.push('admin');

                        console.log(`[handleStatusUpdate] Calling addNotification for ${sType} ${statusLabel}`);
                        await addNotification(
                            `${sType} ${statusLabel}`,
                            `${dateStr} | ${timeStr} | ${adminName} has ${actionLabel} the ${sType.toLowerCase()} entry (${sale.invoiceNo}) requested by ${requesterName}`,
                            targetRoles,
                            targetUsers
                        );
                        console.log(`[handleStatusUpdate] addNotification successful.`);
                    } catch (err) {
                        console.error(`[handleStatusUpdate] Error in addNotification:`, err);
                    }
                }

                console.log(`[handleStatusUpdate] Re-fetching data...`);
                try { fetchSales(); } catch (e) { console.error('fetchSales error', e); }
                try { fetchCustomers(); } catch (e) { console.error('fetchCustomers error', e); }
                try { fetchWarehouses(); } catch (e) { console.error('fetchWarehouses error', e); }
                try { fetchStockRecords(); } catch (e) { console.error('fetchStockRecords error', e); }
                console.log(`[handleStatusUpdate] Update successfully finished!`);
            } else {
                console.warn(`[handleStatusUpdate] Unexpected response status:`, response.status);
                alert(`Status update returned unexpected status code: ${response.status}`);
            }
        } catch (error) {
            console.error(`Error updating sale status to ${newStatus}:`, error);
            alert(`Failed to update status to ${newStatus}. See console for details: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
            console.log(`[handleStatusUpdate] Submitting state reset to false.`);
        }
    };
    const saleFilterRef = useRef(null);
    const saleFilterButtonRef = useRef(null);
    const saleCompanyFilterRef = useRef(null);
    const saleInvoiceFilterRef = useRef(null);
    const salePortFilterRef = useRef(null);
    const saleProductFilterRef = useRef(null);
    const saleIndCnfFilterRef = useRef(null);
    const saleBdCnfFilterRef = useRef(null);
    const saleFromDateFilterRef = useRef(null);
    const saleToDateFilterRef = useRef(null);

    const toggleRowExpansion = (saleId) => {
        setExpandedRows(prev =>
            prev.includes(saleId) ? prev.filter(id => id !== saleId) : [...prev, saleId]
        );
    };

    const hasActiveFilters = Object.values(saleFilters).some(v => v !== '');

    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if the click is on an element that is still in the document
            // If the element is detached (e.g., a selection item that just got removed),
            // don't close the panel.
            if (event.target && !document.body.contains(event.target)) {
                return;
            }

            if (
                showSaleFilterPanel &&
                saleFilterRef.current &&
                !saleFilterRef.current.contains(event.target) &&
                saleFilterButtonRef.current &&
                !saleFilterButtonRef.current.contains(event.target)
            ) {
                setShowSaleFilterPanel(false);
            }
            if (activeFilterDropdown) {
                // Determine if click was inside any specific filter container
                const inCompany = saleCompanyFilterRef.current?.contains(event.target);
                const inInvoice = saleInvoiceFilterRef.current?.contains(event.target);
                const inPort = salePortFilterRef.current?.contains(event.target);
                const inProduct = saleProductFilterRef.current?.contains(event.target);
                const inIndCnf = saleIndCnfFilterRef.current?.contains(event.target);
                const inBdCnf = saleBdCnfFilterRef.current?.contains(event.target);
                const inFromDate = saleFromDateFilterRef.current?.contains(event.target);
                const inToDate = saleToDateFilterRef.current?.contains(event.target);

                if (
                    (activeFilterDropdown === 'company' && !inCompany) ||
                    (activeFilterDropdown === 'invoice' && !inInvoice) ||
                    (activeFilterDropdown === 'port' && !inPort) ||
                    (activeFilterDropdown === 'product' && !inProduct) ||
                    (activeFilterDropdown === 'indCnf' && !inIndCnf) ||
                    (activeFilterDropdown === 'bdCnf' && !inBdCnf) ||
                    (activeFilterDropdown === 'from' && !inFromDate) ||
                    (activeFilterDropdown === 'to' && !inToDate)
                ) {
                    setActiveFilterDropdown(null);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showSaleFilterPanel, activeFilterDropdown]);

    // Scroll Lock when Filter Panel is active
    useEffect(() => {
        if (showSaleFilterPanel) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [showSaleFilterPanel]);

    const [formData, setFormData] = useState({
        date: '',
        invoiceNo: '',
        customerId: '',
        companyName: '',
        customerName: '',
        address: '',
        lcNo: '',
        contact: '',
        importer: '',
        port: '',
        indianCnF: '',
        bdCnf: '',
        truck: '',
        items: [{
            productId: '',
            productName: '',
            brandEntries: [{
                brand: '',
                brandName: '',
                inhouseQty: '',
                warehouseId: '',
                warehouseName: '',
                warehouseQty: '',
                quantity: '',
                truck: '',
                uom: 'Truck', // Default UOM
                unitPrice: '',
                totalAmount: ''
            }]
        }],
        currentTotalTrucks: 0,
        currentTotalQty: 0,
        indCommissionRate: '',
        indCommissionUom: 'Truck',
        indCommissionTotal: '0.00',
        bdCommissionRate: '',
        bdCommissionUom: 'Truck',
        bdCommissionTotal: '0.00',
        indCommissionEdited: false,
        bdCommissionEdited: false,
        totalAmount: '0.00',
        discount: '0.00',
        paidAmount: '0.00',
        dueAmount: '0.00',
        paymentMethod: 'Cash',
        status: 'Requested',
        saleType: saleType, // Initialize with prop value
        previousBalance: '0.00',
        requestedBy: currentUser?.name || currentUser?.username || '',
        requestedByUsername: currentUser?.username || ''
    });

    useEffect(() => {
        fetchSales();
        fetchCustomers();
        fetchProducts();
        fetchWarehouses();
        fetchStockRecords();
        fetchImportersList();
        fetchPortsList();
        fetchCnfsList();
    }, [saleType]); // Refetch if saleType changes

    // Reset filters when switching between General and Border sales
    useEffect(() => {
        if (setSaleFilters) {
            setSaleFilters({
                startDate: '',
                endDate: '',
                companyName: '',
                invoiceNo: '',
                port: '',
                productName: '',
                indCnf: '',
                bdCnf: ''
            });
        }
        if (setSearchQuery) setSearchQuery('');
        setIsRequestedOnly(false);
    }, [saleType, setSaleFilters, setSearchQuery]);

    const generateInvoiceNo = () => {
        const prefix = saleType === 'Border' ? 'BS' : 'GS';
        // Extract all numeric parts from invoice numbers starting with the same prefix
        const numbers = allSalesRecords
            .filter(s => (s.invoiceNo || '').startsWith(prefix))
            .map(s => {
                const match = (s.invoiceNo || '').match(/\d+/);
                return match ? parseInt(match[0]) : 0;
            });
        const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
        return `${prefix}${nextNum.toString().padStart(4, '0')}`;
    };

    useEffect(() => {
        if (showForm && !editingId && allSalesRecords.length >= 0) {
            setFormData(prev => ({ ...prev, invoiceNo: generateInvoiceNo() }));
        }
    }, [showForm, editingId, saleType, allSalesRecords]);

    const fetchSales = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/sales`);
            const decryptedSales = Array.isArray(response.data) ? response.data : [];

            setAllSalesRecords(decryptedSales);

            // Filter by saleType
            const filteredSales = decryptedSales.filter(s => {
                const sTypeLow = (s.saleType || '').toLowerCase().trim();
                const isBorder = sTypeLow === 'border' || sTypeLow === 'border sale' ||
                    (s.invoiceNo || '').startsWith('BS') ||
                    (!s.saleType && !!(s.lcNo || s.port || s.importer));

                if (saleType === 'General') {
                    return !isBorder && (sTypeLow === 'general' || sTypeLow === 'general sale' || !s.saleType || (s.invoiceNo || '').startsWith('GS'));
                }
                if (saleType === 'Border') {
                    return isBorder;
                }
                return sTypeLow === saleType.toLowerCase();
            });

            setSales(filteredSales);
        } catch (error) {
            console.error('Error fetching sales:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCustomers = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/customers`);
            setCustomers(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching customers:', error);
        }
    };

    const fetchProducts = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/products`);
            setProducts(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };
    const fetchWarehouses = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/warehouses`);
            setWarehouses(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };
    const fetchStockRecords = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/stock`);
            // Stock records are now decrypted server-side or by axios interceptor
            const decryptedStock = Array.isArray(response.data) ? response.data : [];
            setStockRecords(decryptedStock);
        } catch (error) {
            console.error('Error fetching stock records:', error);
        }
    };

    const fetchImportersList = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/importers`);
            setImportersList(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching importers:', error);
        }
    };

    const fetchPortsList = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/ports`);
            setPortsList(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching ports:', error);
        }
    };

    const fetchCnfsList = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/cnfs`);
            setCnfsList(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching C&Fs:', error);
        }
    };

    const [activeItemIndex, setActiveItemIndex] = useState(null);
    const [activeEntryIndex, setActiveEntryIndex] = useState(null);

    useEffect(() => {
        // Skip stock calculations for Border Sales - they have no connection to stock/LC Receive
        if (formData.saleType === 'Border') return;

        setFormData(prev => {
            let hasChanges = false;
            const newItems = prev.items.map(item => {
                if (!item.productId) return item;

                let itemChanged = false;
                const newBrandEntries = item.brandEntries.map(entry => {
                    let updatedEntry = { ...entry };

                    // 1. Calculate Total Inhouse Quantity for the selected product and brand
                    // The user requested: "Inhouse quantity and warehouse quantity will show seleted product seledted brand"
                    let totalInhouseQty = 0;

                    if (item.productName && entry.brand) {
                        // Add stock from main store matching product and brand
                        stockRecords.forEach(record => {
                            const recName = (record.productName || record.product || '').toLowerCase().trim();
                            const targetName = (item.productName || '').toLowerCase().trim();
                            const recBrand = (record.brand || '').toLowerCase().trim();
                            const targetBrand = (entry.brand || '').toLowerCase().trim();

                            if ((record.status || '').toLowerCase().includes('requested')) return;

                            if (recName === targetName && recBrand === targetBrand) {
                                totalInhouseQty += parseFloat(record.inHouseQuantity) || 0;
                            }
                        });

                        // Add stock from all warehouses for this product and brand
                        warehouses.forEach(w => {
                            const wProd = (w.productName || w.product || '').toLowerCase().trim();
                            const targetProd = (item.productName || '').toLowerCase().trim();
                            const wBrand = (w.brand || '').toLowerCase().trim();
                            const targetBrand = (entry.brand || '').toLowerCase().trim();

                            if (wProd === targetProd && wBrand === targetBrand) {
                                totalInhouseQty += parseFloat(w.whQty) || 0;
                            }
                        });

                        // Subtract ALL matching sales to get REMAINING stock
                        allSalesRecords.forEach(s => {
                            const sStatus = (s.status || '').toLowerCase();
                            if (sStatus !== 'accepted' && sStatus !== 'pending') return;
                            if (s.items) {
                                s.items.forEach(si => {
                                    const sProdName = (si.productName || '').toLowerCase().trim();
                                    const tProdName = (item.productName || '').toLowerCase().trim();
                                    if (sProdName === tProdName && si.brandEntries) {
                                        si.brandEntries.forEach(be => {
                                            const sBrandName = (be.brand || '').toLowerCase().trim();
                                            const tBrandName = (entry.brand || '').toLowerCase().trim();
                                            const tProdNameMatched = (item.productName || '').toLowerCase().trim();

                                            // Regular brand match OR (Sale brand is empty/hyphen AND stock brand matches product name)
                                            if (sBrandName === tBrandName || ((sBrandName === '' || sBrandName === '-') && tBrandName === tProdNameMatched)) {
                                                totalInhouseQty -= parseFloat(be.quantity) || 0;
                                            }
                                        });
                                    }
                                });
                            }
                        });
                        totalInhouseQty = Math.max(0, totalInhouseQty);
                    } else if (item.productName && !entry.brand) {
                        // Fallback: just product if no brand is selected yet
                        stockRecords.forEach(record => {
                            if ((record.status || '').toLowerCase().includes('requested')) return;
                            const recName = (record.productName || record.product || '').toLowerCase().trim();
                            const targetName = (item.productName || '').toLowerCase().trim();
                            if (recName === targetName) {
                                totalInhouseQty += parseFloat(record.inHouseQuantity) || 0;
                            }
                        });

                        warehouses.forEach(w => {
                            const wProd = (w.productName || w.product || '').toLowerCase().trim();
                            const targetProd = (item.productName || '').toLowerCase().trim();
                            if (wProd === targetProd) {
                                totalInhouseQty += parseFloat(w.whQty) || 0;
                            }
                        });

                        // Subtract ALL sales for this product
                        allSalesRecords.forEach(s => {
                            const sStatus = (s.status || '').toLowerCase();
                            if (sStatus !== 'accepted' && sStatus !== 'pending') return;
                            if (s.items) {
                                s.items.forEach(si => {
                                    const sProdName = (si.productName || '').toLowerCase().trim();
                                    const tProdName = (item.productName || '').toLowerCase().trim();
                                    if (sProdName === tProdName && si.brandEntries) {
                                        si.brandEntries.forEach(be => {
                                            totalInhouseQty -= parseFloat(be.quantity) || 0;
                                        });
                                    }
                                });
                            }
                        });
                        totalInhouseQty = Math.max(0, totalInhouseQty);
                    }

                    if (updatedEntry.inhouseQty !== totalInhouseQty.toString()) {
                        updatedEntry.inhouseQty = totalInhouseQty.toString();
                        itemChanged = true;
                    }

                    // 2. Calculate Warehouse Stock for the selected product + brand + warehouse
                    // The user requested: "warehouse stock will show the selected product's selected warehouse quantity"
                    if (entry.warehouseName && entry.brand) {
                        let totalWhQty = 0;
                        warehouses.forEach(w => {
                            const wName = (w.whName || w.warehouse || '').toLowerCase().trim();
                            const targetWh = (entry.warehouseName || '').toLowerCase().trim();
                            const wProd = (w.productName || w.product || '').toLowerCase().trim();
                            const targetProd = (item.productName || '').toLowerCase().trim();
                            const wBrand = (w.brand || '').toLowerCase().trim();
                            const targetBrand = (entry.brand || '').toLowerCase().trim();

                            if (wName === targetWh && wProd === targetProd && wBrand === targetBrand) {
                                totalWhQty += parseFloat(w.whQty) || 0;
                            }
                        });

                        // Also check stockRecords if warehouse name matches exactly
                        stockRecords.forEach(record => {
                            const rName = (record.warehouse || record.whName || '').toLowerCase().trim();
                            const targetWh = (entry.warehouseName || '').toLowerCase().trim();
                            const rProd = (record.productName || record.product || '').toLowerCase().trim();
                            const targetProd = (item.productName || '').toLowerCase().trim();
                            const rBrand = (record.brand || '').toLowerCase().trim();
                            const targetBrand = (entry.brand || '').toLowerCase().trim();

                            if ((record.status || '').toLowerCase().includes('requested')) return;

                            if (rName === targetWh && rProd === targetProd && rBrand === targetBrand) {
                                totalWhQty += parseFloat(record.inHouseQuantity) || 0;
                            }
                        });

                        // Subtract ALL matching sales for this specific warehouse
                        allSalesRecords.forEach(s => {
                            const sStatus = (s.status || '').toLowerCase();
                            if (sStatus !== 'accepted' && sStatus !== 'pending') return;
                            if (s.items) {
                                s.items.forEach(si => {
                                    const sProdName = (si.productName || '').toLowerCase().trim();
                                    const tProdName = (item.productName || '').toLowerCase().trim();
                                    if (sProdName === tProdName && si.brandEntries) {
                                        si.brandEntries.forEach(be => {
                                            const sBrandName = (be.brand || '').toLowerCase().trim();
                                            const tBrandName = (entry.brand || '').toLowerCase().trim();
                                            const sWhName = (be.warehouseName || '').toLowerCase().trim();
                                            const tWhName = (entry.warehouseName || '').toLowerCase().trim();
                                            const tProdNameMatched = (item.productName || '').toLowerCase().trim();

                                            const brandMatches = sBrandName === tBrandName || ((sBrandName === '' || sBrandName === '-') && tBrandName === tProdNameMatched);
                                            if (brandMatches && sWhName === tWhName) {
                                                totalWhQty -= parseFloat(be.quantity) || 0;
                                            }
                                        });
                                    }
                                });
                            }
                        });
                        totalWhQty = Math.max(0, totalWhQty);

                        if (updatedEntry.warehouseQty !== totalWhQty.toString()) {
                            updatedEntry.warehouseQty = totalWhQty.toString();
                            itemChanged = true;
                        }
                    } else if (entry.warehouseName && !entry.brand) {
                        // Fallback for single-entry products: no brand selected, calculate product-level warehouse stock
                        let totalWhQty = 0;
                        warehouses.forEach(w => {
                            const wName = (w.whName || w.warehouse || '').toLowerCase().trim();
                            const targetWh = (entry.warehouseName || '').toLowerCase().trim();
                            const wProd = (w.productName || w.product || '').toLowerCase().trim();
                            const targetProd = (item.productName || '').toLowerCase().trim();

                            if (wName === targetWh && wProd === targetProd) {
                                totalWhQty += parseFloat(w.whQty) || 0;
                            }
                        });

                        // Also check stockRecords for warehouse-level stock
                        stockRecords.forEach(record => {
                            const rName = (record.warehouse || record.whName || '').toLowerCase().trim();
                            const targetWh = (entry.warehouseName || '').toLowerCase().trim();
                            const rProd = (record.productName || record.product || '').toLowerCase().trim();
                            const targetProd = (item.productName || '').toLowerCase().trim();

                            if ((record.status || '').toLowerCase().includes('requested')) return;

                            if (rName === targetWh && rProd === targetProd) {
                                totalWhQty += parseFloat(record.inHouseQuantity) || 0;
                            }
                        });

                        // Subtract ALL matching sales for this warehouse (across all brands)
                        allSalesRecords.forEach(s => {
                            const sStatus = (s.status || '').toLowerCase();
                            if (sStatus !== 'accepted' && sStatus !== 'pending') return;
                            if (s.items) {
                                s.items.forEach(si => {
                                    const sProdName = (si.productName || '').toLowerCase().trim();
                                    const tProdName = (item.productName || '').toLowerCase().trim();
                                    if (sProdName === tProdName && si.brandEntries) {
                                        si.brandEntries.forEach(be => {
                                            const sWhName = (be.warehouseName || '').toLowerCase().trim();
                                            const tWhName = (entry.warehouseName || '').toLowerCase().trim();
                                            if (sWhName === tWhName) {
                                                totalWhQty -= parseFloat(be.quantity) || 0;
                                            }
                                        });
                                    }
                                });
                            }
                        });
                        totalWhQty = Math.max(0, totalWhQty);

                        if (updatedEntry.warehouseQty !== totalWhQty.toString()) {
                            updatedEntry.warehouseQty = totalWhQty.toString();
                            itemChanged = true;
                        }
                    } else if (!entry.warehouseName) {
                        if (updatedEntry.warehouseQty !== '') {
                            updatedEntry.warehouseQty = '';
                            itemChanged = true;
                        }
                    }

                    return updatedEntry;
                });

                if (itemChanged) {
                    hasChanges = true;
                    return { ...item, brandEntries: newBrandEntries };
                }
                return item;
            });

            return hasChanges ? { ...prev, items: newItems } : prev;
        });
    }, [formData.items.map(i => i.productId).join(','), formData.items.map(i => i.brandEntries.map(e => `${e.brand}-${e.warehouseName}`).join(',')).join('|'), stockRecords, warehouses, allSalesRecords]);

    const addProductItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, {
                productId: '',
                productName: '',
                brandEntries: [{
                    brand: '',
                    brandName: '',
                    inhouseQty: '',
                    warehouseId: '',
                    warehouseName: '',
                    warehouseQty: '',
                    quantity: '',
                    truck: '',
                    uom: 'Truck',
                    unitPrice: '',
                    totalAmount: ''
                }]
            }]
        }));
    };

    const addBrandEntry = (productIdx) => {
        setFormData(prev => {
            const newItems = [...prev.items];
            newItems[productIdx] = {
                ...newItems[productIdx],
                brandEntries: [...newItems[productIdx].brandEntries, {
                    brand: '',
                    brandName: '',
                    inhouseQty: '',
                    warehouseId: '',
                    warehouseName: '',
                    warehouseQty: '',
                    quantity: '',
                    truck: '',
                    uom: 'Truck',
                    unitPrice: '',
                    totalAmount: ''
                }]
            };
            return { ...prev, items: newItems };
        });
    };

    const removeProductItem = (index) => {
        if (formData.items.length <= 1) return;
        setFormData(prev => {
            const newItems = prev.items.filter((_, i) => i !== index);
            const subtotal = newItems.reduce((sum, product) =>
                sum + product.brandEntries.reduce((pSum, entry) => pSum + (parseFloat(entry.totalAmount) || 0), 0)
                , 0);
            const grandTotal = Math.max(0, subtotal - (parseFloat(prev.discount) || 0));
            return {
                ...prev,
                items: newItems,
                totalAmount: grandTotal.toFixed(2),
                dueAmount: (grandTotal - (parseFloat(prev.paidAmount) || 0)).toFixed(2)
            };
        });
    };

    const removeBrandEntry = (productIdx, entryIdx) => {
        setFormData(prev => {
            const newItems = [...prev.items];
            const product = { ...newItems[productIdx] };
            if (product.brandEntries.length <= 1) return prev; // Don't remove last brand row

            product.brandEntries = product.brandEntries.filter((_, i) => i !== entryIdx);
            newItems[productIdx] = product;

            const subtotal = newItems.reduce((sum, p) =>
                sum + p.brandEntries.reduce((eSum, e) => eSum + (parseFloat(e.totalAmount) || 0), 0)
                , 0);
            const grandTotal = Math.max(0, subtotal - (parseFloat(prev.discount) || 0));

            return {
                ...prev,
                items: newItems,
                totalAmount: grandTotal.toFixed(2),
                dueAmount: (grandTotal - (parseFloat(prev.paidAmount) || 0)).toFixed(2)
            };
        });
    };

    const handleItemInputChange = (productIdx, entryIdx, e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newItems = [...prev.items];
            const product = { ...newItems[productIdx] };
            const brandEntries = [...product.brandEntries];
            const entry = { ...brandEntries[entryIdx], [name]: value };

            // Synchronize brand and brandName for consistency
            if (name === 'brandName') {
                entry.brand = value;
            } else if (name === 'brand') {
                entry.brandName = value;
            }

            if (prev.saleType === 'Border') {
                // Border Sale: Total depends on selected UOM (QTY or Truck)
                if (name === 'truck' || name === 'quantity' || name === 'bag' || name === 'unitPrice' || name === 'uom') {
                    const activeUOM = name === 'uom' ? value : entry.uom;
                    const bSize = parseFloat(String(entry.bagSize || '').replace(/[^0-9.]/g, '')) || 0;

                    if (name === 'quantity' && bSize > 0) {
                        entry.bag = (parseFloat(value) / bSize).toFixed(2);
                    } else if (name === 'bag' && bSize > 0) {
                        entry.quantity = (parseFloat(value) * bSize).toFixed(2);
                    }

                    const qty = parseFloat(name === 'quantity' ? value : entry.quantity) || 0;
                    const truck = parseFloat(name === 'truck' ? value : entry.truck) || 0;
                    const price = parseFloat(name === 'unitPrice' ? value : entry.unitPrice) || 0;

                    if (activeUOM === 'QTY') {
                        entry.totalAmount = (qty * price).toFixed(2);
                    } else {
                        // Default to Truck
                        entry.totalAmount = (truck * price).toFixed(2);
                    }
                }
            } else {
                // General Sale: Total = Quantity * Price
                if (name === 'quantity' || name === 'bag' || name === 'unitPrice') {
                    const bSize = parseFloat(String(entry.bagSize || '').replace(/[^0-9.]/g, '')) || 0;

                    if (name === 'quantity' && bSize > 0) {
                        entry.bag = (parseFloat(value) / bSize).toFixed(2);
                    } else if (name === 'bag' && bSize > 0) {
                        entry.quantity = (parseFloat(value) * bSize).toFixed(2);
                    }

                    const qty = parseFloat(name === 'quantity' ? value : entry.quantity) || 0;
                    const price = parseFloat(name === 'unitPrice' ? value : entry.unitPrice) || 0;
                    entry.totalAmount = (qty * price).toFixed(2);
                }
            }

            brandEntries[entryIdx] = entry;
            product.brandEntries = brandEntries;
            newItems[productIdx] = product;

            // Recalculate invoice totals and C&F commissions
            const subtotal = newItems.reduce((sum, p) =>
                sum + p.brandEntries.reduce((eSum, e) => eSum + (parseFloat(e.totalAmount) || 0), 0)
                , 0);

            const totalTrucks = newItems.reduce((sum, p) =>
                sum + (p.brandEntries || []).reduce((eSum, e) => eSum + (parseFloat(e.truck) || 0), 0)
                , 0);

            const totalQty = newItems.reduce((sum, p) =>
                sum + (p.brandEntries || []).reduce((eSum, e) => eSum + (parseFloat(e.quantity) || 0), 0)
                , 0);

            const indRate = parseFloat(prev.indCommissionRate) || 0;
            const bdRate = parseFloat(prev.bdCommissionRate) || 0;

            const indTotal = (prev.indCommissionUom === 'Truck' ? totalTrucks : totalQty) * indRate;
            const bdTotal = (prev.bdCommissionUom === 'Truck' ? totalTrucks : totalQty) * bdRate;

            const disc = parseFloat(prev.discount) || 0;
            const paid = parseFloat(prev.paidAmount) || 0;
            const grandTotal = Math.max(0, subtotal - disc);

            return {
                ...prev,
                items: newItems,
                currentTotalTrucks: totalTrucks,
                currentTotalQty: totalQty,
                indCommissionTotal: indTotal.toFixed(2),
                bdCommissionTotal: bdTotal.toFixed(2),
                totalAmount: grandTotal.toFixed(2),
                dueAmount: (grandTotal - paid).toFixed(2)
            };
        });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            let updatedFormData = { ...prev, [name]: value };

            if (name === 'paidAmount' || name === 'discount' || name.includes('Commission')) {
                const subtotal = prev.items.reduce(
                    (sum, i) => sum + (i.brandEntries || []).reduce((eSum, e) => eSum + (parseFloat(e.totalAmount) || 0), 0),
                    0
                );

                const totalTrucks = prev.items.reduce((sum, p) =>
                    sum + (p.brandEntries || []).reduce((eSum, e) => eSum + (parseFloat(e.truck) || 0), 0)
                    , 0);

                const totalQty = prev.items.reduce((sum, p) =>
                    sum + (p.brandEntries || []).reduce((eSum, e) => eSum + (parseFloat(e.quantity) || 0), 0)
                    , 0);

                const indRate = parseFloat(name === 'indCommissionRate' ? value : prev.indCommissionRate) || 0;
                const bdRate = parseFloat(name === 'bdCommissionRate' ? value : prev.bdCommissionRate) || 0;
                const indUom = name === 'indCommissionUom' ? value : prev.indCommissionUom;
                const bdUom = name === 'bdCommissionUom' ? value : prev.bdCommissionUom;

                const indTotal = (indUom === 'Truck' ? totalTrucks : totalQty) * indRate;
                const bdTotal = (bdUom === 'Truck' ? totalTrucks : totalQty) * bdRate;

                const disc = parseFloat(name === 'discount' ? value : prev.discount) || 0;
                const paid = parseFloat(name === 'paidAmount' ? value : prev.paidAmount) || 0;

                const grandTotal = Math.max(0, subtotal - disc);
                updatedFormData.totalAmount = grandTotal.toFixed(2);
                updatedFormData.dueAmount = (grandTotal - paid).toFixed(2);
                updatedFormData.indCommissionTotal = indTotal.toFixed(2);
                updatedFormData.bdCommissionTotal = bdTotal.toFixed(2);
                updatedFormData.currentTotalTrucks = totalTrucks;
                updatedFormData.currentTotalQty = totalQty;
            }
            return updatedFormData;
        });
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const url = editingId ? `${API_BASE_URL}/api/sales/${editingId}` : `${API_BASE_URL}/api/sales`;

            let response;
            if (editingId) {
                response = await axios.put(url, formData);
            } else {
                response = await axios.post(url, formData);
            }

            if (response.status >= 200 && response.status < 300) {
                setSubmitStatus('success');

                const currentStatus = (formData.status || '').toLowerCase();
                const isRequested = currentStatus.includes('requested');

                if (addNotification && isRequested) {
                    const now = new Date();
                    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
                    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const employeeName = currentUser?.name || currentUser?.username || 'An employee';
                    const sType = saleType === 'Border' ? 'Border Sale' : 'General Sale';
                    const targetRoles = ['admin', 'incharge', 'sales manager'];
                    const targetUsers = [formData.requestedByUsername].filter(Boolean);
                    if (!targetUsers.includes('admin')) targetUsers.push('admin');

                    if (!editingId) {
                        console.log(`[handleSubmit] Notifying for NEW ${sType} Request`);
                        await addNotification(
                            `New ${sType} Requested`,
                            `${dateStr} | ${timeStr} | ${employeeName} has requested a new ${sType.toLowerCase()} entry (${formData.invoiceNo || 'No Invoice'})`,
                            targetRoles,
                            targetUsers
                        );
                    } else {
                        console.log(`[handleSubmit] Notifying for UPDATED ${sType} Request`);

                        // Compare for detailed changes
                        const changedFields = [];
                        const fieldLabels = {
                            date: 'Date',
                            invoiceNo: 'Invoice',
                            companyName: 'Company',
                            customerName: 'Customer',
                            lcNo: 'LC No',
                            contact: 'Contact',
                            importer: 'Importer',
                            port: 'Port',
                            indianCnF: 'Indian C&F',
                            bdCnf: 'BD C&F',
                            truck: 'Truck',
                            discount: 'Discount',
                            paidAmount: 'Paid',
                            creditPeriod: 'Credit Period'
                        };

                        // Compare simple top-level fields
                        Object.keys(fieldLabels).forEach(field => {
                            if (originalData && String(formData[field]) !== String(originalData[field])) {
                                changedFields.push(fieldLabels[field]);
                            }
                        });

                        // Granular comparison of items (Price vs QTY)
                        let qtyChanged = false;
                        let rateChanged = false;

                        if (originalData && originalData.items) {
                            formData.items.forEach((item, pIdx) => {
                                const origItem = originalData.items[pIdx];
                                if (!origItem) {
                                    qtyChanged = true; // New item added
                                    return;
                                }

                                item.brandEntries.forEach((entry, eIdx) => {
                                    const origEntry = (origItem.brandEntries || [])[eIdx];
                                    if (!origEntry) {
                                        qtyChanged = true;
                                        return;
                                    }

                                    if (String(entry.quantity) !== String(origEntry.quantity)) qtyChanged = true;
                                    if (String(entry.unitPrice) !== String(origEntry.unitPrice)) rateChanged = true;
                                    if (entry.brand !== origEntry.brand || entry.warehouseName !== origEntry.warehouseName) {
                                        // If brand/warehouse changed, we just call it a QTY/Product update contextually
                                        qtyChanged = true;
                                    }
                                });
                            });

                            // Check if items were removed
                            if (formData.items.length < originalData.items.length) qtyChanged = true;
                        }

                        if (qtyChanged) changedFields.push('QTY');
                        if (rateChanged) changedFields.push('Price');

                        // Only check derived fields if root cause wasn't items
                        if (!qtyChanged && !rateChanged) {
                            if (originalData && formData.totalAmount !== originalData.totalAmount) changedFields.push('Price');
                            if (originalData && formData.dueAmount !== originalData.dueAmount) changedFields.push('Due');
                        }

                        const detailMsg = changedFields.length > 0
                            ? `\nUpdated fields: ${[...new Set(changedFields)].join(', ')}`
                            : '';

                        await addNotification(
                            `${sType} Request Updated`,
                            `${dateStr} | ${timeStr} | ${employeeName} has updated the requested ${sType.toLowerCase()} entry (${formData.invoiceNo || 'No Invoice'})${detailMsg}`,
                            targetRoles,
                            targetUsers
                        );
                    }
                }

                if (formData.status !== 'Requested') {
                    await processSaleEffects(formData, !!editingId);
                }

                setTimeout(() => {
                    setShowForm(false);
                    resetForm();
                    fetchSales();
                    fetchCustomers();
                    fetchStockRecords();
                    fetchWarehouses();
                }, 1500);
            } else {
                setSubmitStatus('error');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            date: '',
            invoiceNo: '',
            customerId: '',
            companyName: '',
            customerName: '',
            lcNo: '',
            contact: '',
            importer: '',
            port: '',
            indianCnF: '',
            bdCnf: '',
            exporter: '',
            truck: '',
            items: [{
                productId: '',
                productName: '',
                brandEntries: [{
                    brand: '',
                    brandName: '',
                    inhouseQty: '',
                    warehouseId: '',
                    warehouseName: '',
                    warehouseQty: '',
                    quantity: '',
                    bag: '',
                    bagSize: '',
                    truck: '',
                    uom: 'Truck',
                    unitPrice: '',
                    totalAmount: ''
                }]
            }],
            currentTotalTrucks: 0,
            currentTotalQty: 0,
            indCommissionRate: '',
            indCommissionUom: 'Truck',
            indCommissionTotal: '0.00',
            bdCommissionRate: '',
            bdCommissionUom: 'Truck',
            bdCommissionTotal: '0.00',
            indCommissionEdited: false,
            bdCommissionEdited: false,
            totalAmount: '0.00',
            discount: '0.00',
            paidAmount: '0.00',
            dueAmount: '0.00',
            paymentMethod: 'Cash',
            status: 'Requested',
            saleType: saleType,
            previousBalance: '0.00',
            requestedBy: currentUser?.name || currentUser?.username || '',
            requestedByUsername: currentUser?.username || ''
        });
        setCustomerSearch('');
        setProductSearch('');
        setCompanyNameSearch('');
        setActiveDropdown(null);
        setEditingId(null);
        setOriginalData(null);
        setActiveItemIndex(null);
        setActiveEntryIndex(null);
        setSubmitStatus(null);
    };

    const handleEdit = (sale) => {
        let initialItems = sale.items || [];

        // Migrate single-item legacy
        if (initialItems.length === 0 && sale.productId) {
            initialItems = [{
                productId: sale.productId,
                productName: sale.productName,
                brandEntries: [{
                    brand: sale.brand,
                    inhouseQty: sale.inhouseQty,
                    warehouseId: sale.warehouseId,
                    warehouseName: sale.warehouseName,
                    warehouseQty: sale.warehouseQty,
                    quantity: sale.quantity,
                    uom: sale.uom || 'Truck',
                    unitPrice: sale.unitPrice,
                    totalAmount: sale.totalAmount
                }]
            }];
        } else {
            // Check if items are flat or nested
            initialItems = initialItems.map(item => {
                if (item.brandEntries) return item;
                // Migrate previous flat multi-item to nested brand entries
                return {
                    productId: item.productId,
                    productName: item.productName,
                    brandEntries: [{
                        brand: item.brand,
                        inhouseQty: item.inhouseQty,
                        warehouseId: item.warehouseId,
                        warehouseName: item.warehouseName,
                        warehouseQty: item.warehouseQty,
                        quantity: item.quantity,
                        uom: item.uom || 'Truck',
                        unitPrice: item.unitPrice,
                        totalAmount: item.totalAmount
                    }]
                };
            });
        }

        setOriginalData({
            ...sale,
            items: JSON.parse(JSON.stringify(initialItems)) // Deep copy
        });

        setFormData({
            ...sale,
            items: initialItems,
            date: sale.date ? new Date(sale.date).toISOString().split('T')[0] : '',
            discount: sale.discount || '0.00',
            previousBalance: sale.previousBalance || '0.00',
            indCommissionRate: sale.indCommissionRate || '',
            indCommissionUom: sale.indCommissionUom || 'Truck',
            indCommissionTotal: sale.indCommissionTotal || '0.00',
            bdCommissionRate: sale.bdCommissionRate || '',
            bdCommissionUom: sale.bdCommissionUom || 'Truck',
            bdCommissionTotal: sale.bdCommissionTotal || '0.00',
            indCommissionEdited: sale.indCommissionEdited || false,
            bdCommissionEdited: sale.bdCommissionEdited || false
        });
        setEditingId(sale._id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = (sale) => {
        onDeleteConfirm({
            show: true,
            type: 'sales',
            id: sale._id,
            isBulk: false,
            extraData: {
                customerId: sale.customerId,
                invoiceNo: sale.invoiceNo,
                items: sale.items // Include items for stock restoration
            }
        });
    };

    const getFilteredData = () => {
        let result = [];
        if (!searchQuery) {
            result = displayedSales;
        } else {
            const query = searchQuery.toLowerCase();
            result = displayedSales.filter(s => {
                if (saleType === 'Border') {
                    const date = (s.date || '').toLowerCase();
                    const lcNo = (s.lcNo || '').toLowerCase();
                    const importer = (s.importer || '').toLowerCase();
                    const port = (s.port || '').toLowerCase();
                    const indCnf = (s.indianCnF || '').toLowerCase();
                    const bdCnf = (s.bdCnf || '').toLowerCase();
                    const party = (s.companyName || s.customerName || '').toLowerCase();
                    const truck = String(s.truck || '').toLowerCase();
                    const total = String(s.totalAmount || '').toLowerCase();

                    const itemsMatch = (s.items || []).some(item => {
                        const pName = (item.productName || item.product || '').toLowerCase();
                        return pName.includes(query) || (item.brandEntries || []).some(e =>
                            String(e.quantity || '').includes(query) || String(e.truck || '').includes(query) ||
                            String(e.unitPrice || '').includes(query) || String(e.totalAmount || '').includes(query)
                        );
                    });

                    return date.includes(query) || lcNo.includes(query) || importer.includes(query) ||
                        port.includes(query) || indCnf.includes(query) || bdCnf.includes(query) ||
                        party.includes(query) || truck.includes(query) || total.includes(query) || itemsMatch;
                }

                const matchesBasic =
                    s.invoiceNo?.toLowerCase().includes(query) ||
                    s.lcNo?.toLowerCase().includes(query) ||
                    s.customerName?.toLowerCase().includes(query) ||
                    s.companyName?.toLowerCase().includes(query) ||
                    s.productName?.toLowerCase().includes(query) ||
                    s.brand?.toLowerCase().includes(query);

                if (matchesBasic) return true;

                if (s.items && Array.isArray(s.items)) {
                    return s.items.some(item =>
                        item.productName?.toLowerCase().includes(query) ||
                        item.brand?.toLowerCase().includes(query)
                    );
                }
                return false;
            });
        }

        // Apply Interactive Sort
        return [...result].sort((a, b) => {
            const key = sortConfig.key;
            let valA = a[key] || '';
            let valB = b[key] || '';

            if (key === 'date') {
                valA = new Date(valA);
                valB = new Date(valB);
            } else if (key === 'party') {
                valA = (a.companyName || a.customerName || '').toString().toLowerCase();
                valB = (b.companyName || b.customerName || '').toString().toLowerCase();
            } else if (['totalAmount', 'discount', 'paidAmount', 'dueAmount'].includes(key)) {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            } else {
                valA = valA.toString().toLowerCase();
                valB = valB.toString().toLowerCase();
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [companyNameSearch, setCompanyNameSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [brandSearch, setBrandSearch] = useState('');
    const [warehouseSearch, setWarehouseSearch] = useState('');
    const [importerSearch, setImporterSearch] = useState('');
    const [portSearch, setPortSearch] = useState('');
    const [indCnfSearch, setIndCnfSearch] = useState('');
    const [bdCnfSearch, setBdCnfSearch] = useState('');

    // Handle outside clicks for dropdowns
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (e.target && !document.body.contains(e.target)) {
                return;
            }
            if (activeDropdown === 'companyName' && !e.target.closest('.company-dropdown-container')) {
                setActiveDropdown(null);
            }
            if (activeDropdown === 'product' && !e.target.closest('.product-dropdown-container')) {
                setActiveDropdown(null);
            }
            if (activeDropdown === 'brand' && !e.target.closest('.brand-dropdown-container')) {
                setActiveDropdown(null);
            }
            if (activeDropdown === 'warehouse' && !e.target.closest('.warehouse-dropdown-container')) {
                setActiveDropdown(null);
            }
            if (activeDropdown === 'importer' && !e.target.closest('.importer-dropdown-container')) {
                setActiveDropdown(null);
            }
            if (
                (activeDropdown === 'port' && !e.target.closest('.port-dropdown-container')) ||
                (activeDropdown === 'indianCnF' && !e.target.closest('.ind-cnf-dropdown-container')) ||
                (activeDropdown === 'bdCnf' && !e.target.closest('.bd-cnf-dropdown-container'))
            ) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown]);

    const getFilteredImporters = () => {
        return importersList
            .filter(imp => imp.status !== 'Inactive')
            .filter(imp => (imp.name || '').toLowerCase().includes(importerSearch.toLowerCase()));
    };

    const getFilteredPorts = () => {
        return portsList
            .filter(p => p.status !== 'Inactive')
            .filter(p => (p.name || '').toLowerCase().includes(portSearch.toLowerCase()));
    };

    const getFilteredCompanies = () => {
        return customers.filter(c =>
            (c.companyName || '').toLowerCase().includes(companyNameSearch.toLowerCase())
        );
    };

    const getFilteredIndianCnfs = () => {
        const query = (indCnfSearch || '').toLowerCase();
        return cnfsList
            .filter(c => c.type === 'Indian' && (c.name || '').toLowerCase().includes(query))
            .slice(0, 50);
    };

    const getFilteredBdCnfs = () => {
        const query = (bdCnfSearch || '').toLowerCase();
        return cnfsList
            .filter(c => c.type === 'BD' && (c.name || '').toLowerCase().includes(query))
            .slice(0, 50);
    };

    const getFilteredProducts = () => {
        return products.filter(p =>
            (p.name || '').toLowerCase().includes(productSearch.toLowerCase()) ||
            (p.hsCode || '').toLowerCase().includes(productSearch.toLowerCase())
        );
    };

    const getFilteredBrands = () => {
        // Only show brands if a product is selected
        if (activeItemIndex === null) return [];
        const item = formData.items[activeItemIndex];
        if (!item.productId) return [];

        const selectedProduct = products.find(p => p._id === item.productId);
        if (!selectedProduct) return [];

        const brandsSet = new Set();
        if (selectedProduct.brand) brandsSet.add(selectedProduct.brand);
        if (selectedProduct.brands && Array.isArray(selectedProduct.brands)) {
            selectedProduct.brands.forEach(b => {
                if (b.brand) brandsSet.add(b.brand);
            });
        }

        const brands = [...brandsSet].filter(Boolean);
        return brands.filter(b => b.toLowerCase().includes(brandSearch.toLowerCase()));
    };
    const getFilteredWarehouses = () => {
        const uniqueWhs = [];
        const seen = new Set();

        // 1. Add all warehouses from the master list
        warehouses.forEach(w => {
            const name = (w.whName || w.warehouse || '').trim();
            if (name && !seen.has(name.toLowerCase())) {
                seen.add(name.toLowerCase());
                uniqueWhs.push({ _id: w._id, whName: name });
            }
        });

        // 2. Add any additional warehouses found in stockRecords (e.g. initial LC receives)
        stockRecords.forEach(record => {
            const name = (record.whName || record.warehouse || '').trim();
            if (name && !seen.has(name.toLowerCase())) {
                seen.add(name.toLowerCase());
                uniqueWhs.push({ _id: `stock-${name}`, whName: name });
            }
        });

        return uniqueWhs.filter(w =>
            w.whName.toLowerCase().includes(warehouseSearch.toLowerCase())
        );
    };

    const handleCustomerSelect = (customer) => {
        // Calculate Previous Balance
        const salesHistory = customer.salesHistory || [];
        const paymentHistory = customer.paymentHistory || [];

        const totalAmount = salesHistory.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const totalSalesPaid = salesHistory.reduce((sum, item) => sum + (parseFloat(item.paid) || 0), 0);
        const totalDiscount = salesHistory.reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0);
        const totalHistoryPaid = paymentHistory.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const previousBalance = Math.max(0, totalAmount - totalSalesPaid - totalDiscount - totalHistoryPaid);

        setFormData(prev => ({
            ...prev,
            customerId: customer._id,
            companyName: customer.companyName || '',
            customerName: customer.customerName || '',
            address: customer.address || '',
            contact: customer.phone || '',
            previousBalance: previousBalance.toFixed(2)
        }));
        setActiveDropdown(null);
    };

    const handleCompanyNameSelect = (customer) => {
        if (!customer) {
            setFormData(prev => ({
                ...prev,
                companyName: '',
                customerId: '',
                customerName: '',
                address: '',
                contact: '',
                previousBalance: '0.00'
            }));
            setCompanyNameSearch('');
            setActiveDropdown(null);
            return;
        }
        setCompanyNameSearch('');
        handleCustomerSelect(customer);
    };

    const handleImporterSelect = (importer) => {
        if (importer === null) {
            setFormData(prev => ({ ...prev, importer: '' }));
            setImporterSearch('');
        } else {
            setFormData(prev => ({ ...prev, importer }));
            setImporterSearch('');
        }
        setActiveDropdown(null);
    };

    const handlePortSelect = (port) => {
        if (port === null) {
            setFormData(prev => ({ ...prev, port: '' }));
            setPortSearch('');
        } else {
            setFormData(prev => ({ ...prev, port }));
            setPortSearch('');
        }
        setActiveDropdown(null);
    };

    const handleProductSelect = (product) => {
        if (activeItemIndex === null) return;
        setFormData(prev => {
            const newItems = [...prev.items];
            newItems[activeItemIndex] = {
                ...newItems[activeItemIndex],
                productId: product._id,
                productName: product.name,
                brand: '', // Clear item-level brand
                brandEntries: [{ // Reset brand entries for new product
                    brand: '',
                    brandName: '',
                    inhouseQty: '',
                    warehouseId: '',
                    warehouseName: '',
                    warehouseQty: '',
                    quantity: '',
                    bag: '',
                    bagSize: '',
                    truck: '',
                    unitPrice: '',
                    totalAmount: ''
                }]
            };
            return { ...prev, items: newItems };
        });
        setProductSearch('');
        setActiveDropdown(null);
    };

    const handleBrandSelect = (brand) => {
        if (activeItemIndex === null || activeEntryIndex === null) return;

        // polymorphic: can be a string (from dropdown) or an object (from reset button)
        const brandNameStr = typeof brand === 'string' ? brand : (brand?.brandName || '');

        setFormData(prev => {
            const newItems = [...prev.items];
            const item = { ...newItems[activeItemIndex] };
            const brandEntries = [...item.brandEntries];

            // Link packet size for bag calculations
            const selectedProduct = products.find(p => p._id === item.productId);
            const selectedBrandObj = selectedProduct?.brands?.find(b => b.brand === brandNameStr);
            const packetSize = selectedBrandObj?.packetSize || selectedProduct?.packetSize || '';

            brandEntries[activeEntryIndex] = {
                ...brandEntries[activeEntryIndex],
                brand: brandNameStr,
                brandName: brandNameStr, // Ensure both are set for UI/Stock calculation
                bagSize: packetSize
            };
            item.brandEntries = brandEntries;
            newItems[activeItemIndex] = item;
            return { ...prev, items: newItems };
        });
        setBrandSearch('');
        setActiveDropdown(null);
    };

    const handleWarehouseSelect = (warehouse) => {
        if (activeItemIndex === null || activeEntryIndex === null) return;
        setFormData(prev => {
            const newItems = [...prev.items];
            const item = { ...newItems[activeItemIndex] };
            const brandEntries = [...item.brandEntries];
            brandEntries[activeEntryIndex] = {
                ...brandEntries[activeEntryIndex],
                warehouseId: warehouse._id,
                warehouseName: warehouse.whName
            };
            item.brandEntries = brandEntries;
            newItems[activeItemIndex] = item;
            return { ...prev, items: newItems };
        });
        setWarehouseSearch('');
        setActiveDropdown(null);
    };

    const handleIndCnfSelect = (cnfName) => {
        setFormData(prev => ({ ...prev, indianCnF: cnfName || '' }));
        setIndCnfSearch('');
        setActiveDropdown(null);
    };

    const handleBdCnfSelect = (cnfName) => {
        setFormData(prev => ({ ...prev, bdCnf: cnfName || '' }));
        setBdCnfSearch('');
        setActiveDropdown(null);
    };

    const handleDropdownKeyDown = (e, type, filteredOptions, onSelect) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
            e.preventDefault();
            onSelect(filteredOptions[highlightedIndex]);
        } else if (e.key === 'Escape') {
            setActiveDropdown(null);
        }
    };

    const renderViewModal = () => {
        if (!viewData) return null;
        return (
            <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setViewData(null)}></div>
                <div className="relative bg-white border border-gray-100 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-300">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-white">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                                <ReceiptIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 tracking-tight">Sale Invoice Details</h3>
                                <p className="text-xs text-gray-500 font-medium">{viewData.invoiceNo || 'No Invoice Number'}</p>
                            </div>
                        </div>
                        <button onClick={() => setViewData(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl border border-gray-100 hover:bg-gray-50 transition-all shadow-sm">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="overflow-y-auto max-h-[70vh] p-6 space-y-6 bg-gray-50/30">

                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 p-6 bg-white rounded-2xl border border-gray-100/50 shadow-sm">
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Transaction Date</span>
                                <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                    {formatDate(viewData.date)}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Company Name</span>
                                <div className="text-sm font-bold text-gray-900 truncate" title={getSafeString(viewData.companyName)}>{getSafeString(viewData.companyName) || '-'}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Customer</span>
                                <div className="text-sm font-bold text-gray-900">{getSafeString(viewData.customerName) || '-'}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Requested By</span>
                                <div className="text-sm font-bold text-gray-900">{viewData.requestedBy || 'N/A'}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status / Payment</span>
                                <div className="flex flex-col gap-1.5">
                                    <div className={`px-2 py-0.5 w-fit rounded text-[10px] font-bold uppercase tracking-wider ${viewData.status === 'Requested' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                        viewData.status === 'Rejected' ? 'bg-red-50 text-red-600 border border-red-100' :
                                            'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                        }`}>
                                        {viewData.status || 'Completed'}
                                    </div>
                                    <div className={`px-2 py-0.5 w-fit rounded text-[10px] font-bold inline-flex items-center gap-1 ${parseFloat(viewData.dueAmount) > 0 ? 'bg-amber-50 text-amber-600 border border-amber-100/50' : 'bg-emerald-50 text-emerald-600 border border-emerald-100/50'}`}>
                                        <div className={`w-1 h-1 rounded-full ${parseFloat(viewData.dueAmount) > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                                        {parseFloat(viewData.dueAmount) > 0 ? 'Partial Pay' : 'Paid in Full'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white border-b border-gray-50 group">
                                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest w-1/4">Product Description</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Brand Information</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Qty (kg)</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Unit Price</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {viewData.items?.map((product, pIdx) => (
                                        <React.Fragment key={pIdx}>
                                            <tr className="bg-white transition-colors">
                                                <td className="px-6 py-5 align-top border-r border-gray-50/50" rowSpan={product.brandEntries?.length ? product.brandEntries.length + 1 : 1}>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-4 bg-blue-600 rounded-sm"></div>
                                                        <span className="text-[13px] font-bold text-blue-800">{product.productName}</span>
                                                    </div>
                                                </td>
                                                {/* If there are no brand entries, render empty columns so layout doesn't break */}
                                                {!product.brandEntries?.length && (
                                                    <>
                                                        <td className="px-6 py-4"></td>
                                                        <td className="px-6 py-4"></td>
                                                        <td className="px-6 py-4"></td>
                                                        <td className="px-6 py-4"></td>
                                                    </>
                                                )}
                                            </tr>
                                            {product.brandEntries?.map((entry, eIdx) => (
                                                <tr key={eIdx} className="bg-white hover:bg-gray-50/30 transition-all duration-200">
                                                    <td className="px-6 py-4 align-middle">
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="text-[12px] font-bold text-gray-800">{entry.brand}</div>
                                                            <div className="text-[9px] font-black text-blue-500 uppercase tracking-wider flex items-center gap-1">
                                                                <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                                                                {entry.warehouseName}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right align-middle">
                                                        <div className="text-[13px] font-bold text-gray-900">{parseFloat(entry.quantity).toLocaleString()} kg</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right align-middle">
                                                        <div className="text-[12px] font-bold text-gray-400">৳{parseFloat(entry.unitPrice || 0).toLocaleString()}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right align-middle">
                                                        <div className="text-[14px] font-black text-blue-900 group-hover:scale-[1.02] transition-transform origin-right">৳{parseFloat(entry.totalAmount || 0).toLocaleString()}</div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                            <div className="p-5 bg-orange-50/30 rounded-2xl border border-orange-100/50 group hover:bg-orange-50/50 transition-colors">
                                <div className="text-[9px] font-black text-orange-400 uppercase tracking-widest mb-1.5">Total Discount</div>
                                <div className="text-xl font-black text-orange-600 group-hover:scale-[1.02] transition-transform origin-left">৳{parseFloat(viewData.discount || 0).toLocaleString()}</div>
                            </div>
                            <div className="p-5 bg-emerald-50/30 rounded-2xl border border-emerald-100/50 group hover:bg-emerald-50/50 transition-colors">
                                <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1.5">Paid Amount</div>
                                <div className="text-xl font-black text-emerald-500 group-hover:scale-[1.02] transition-transform origin-left">৳{parseFloat(viewData.paidAmount || 0).toLocaleString()}</div>
                            </div>
                            <div className="p-5 bg-[#1a368b] rounded-2xl border border-blue-900 shadow-xl shadow-blue-500/10 group overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                                <div className="text-[9px] font-black text-blue-200 uppercase tracking-widest mb-1.5 relative z-10">Grand Total Invoice</div>
                                <div className="text-2xl font-black text-white relative z-10 group-hover:scale-[1.02] transition-transform origin-left tracking-tight">৳{parseFloat(viewData.totalAmount || 0).toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const requestedCount = useMemo(() => {
        return sales.filter(s => (s.status || '').toLowerCase().includes('requested')).length;
    }, [sales]);

    // Apply search + advanced filters
    const displayedSales = sales.filter(sale => {
        const matchesRequestFilter = isRequestedOnly
            ? (sale.status || '').toLowerCase().includes('requested') && (sale.status || '').toLowerCase() !== 'rejected'
            : !(sale.status || '').toLowerCase().includes('requested') && (sale.status || '').toLowerCase() !== 'rejected';

        if (!matchesRequestFilter) return false;

        // Text search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();

            if (saleType === 'Border') {
                // Gather searchable flat-text fields
                const date = (sale.date || '').toLowerCase();
                const lcNo = (sale.lcNo || '').toLowerCase();
                const importer = (sale.importer || '').toLowerCase();
                const port = (sale.port || '').toLowerCase();
                const indCnf = (sale.indianCnF || '').toLowerCase();
                const bdCnf = (sale.bdCnf || '').toLowerCase();
                const party = (sale.companyName || sale.customerName || '').toLowerCase();
                const truck = String(sale.truck || '').toLowerCase();
                const total = String(sale.totalAmount || '').toLowerCase();

                // Search inside product names and quantities across items
                const itemsMatch = (sale.items || []).some(item => {
                    const pName = (item.productName || item.product || '').toLowerCase();
                    return pName.includes(q) || (item.brandEntries || []).some(e =>
                        String(e.quantity || '').includes(q) || String(e.truck || '').includes(q) ||
                        String(e.unitPrice || '').includes(q) || String(e.totalAmount || '').includes(q)
                    );
                });

                const matches = date.includes(q) || lcNo.includes(q) || importer.includes(q) ||
                    port.includes(q) || indCnf.includes(q) || bdCnf.includes(q) ||
                    party.includes(q) || truck.includes(q) || total.includes(q) || itemsMatch;

                if (!matches) return false;
            } else {
                const inv = (sale.invoiceNo || '').toLowerCase();
                const cname = (sale.companyName || sale.customerName || '').toLowerCase();
                if (!inv.includes(q) && !cname.includes(q)) return false;
            }
        }
        // Date range
        if (saleFilters.startDate && sale.date) {
            if (sale.date < saleFilters.startDate) return false;
        }
        if (saleFilters.endDate && sale.date) {
            if (sale.date > saleFilters.endDate) return false;
        }
        // Company
        if (saleFilters.companyName) {
            const c = (sale.companyName || sale.customerName || '').toLowerCase();
            if (!c.includes(saleFilters.companyName.toLowerCase())) return false;
        }
        // Invoice or LC No
        if (saleFilters.invoiceNo && saleType !== 'Border') {
            const inv = (sale.invoiceNo || '').toLowerCase();
            if (!inv.includes(saleFilters.invoiceNo.toLowerCase())) return false;
        }
        // Port
        if (saleFilters.port) {
            const p = (sale.port || '').toLowerCase();
            if (!p.includes(saleFilters.port.toLowerCase())) return false;
        }
        // Product
        if (saleFilters.productName) {
            const hasProduct = (sale.items || []).some(item =>
                (item.productName || item.product || '').toLowerCase().includes(saleFilters.productName.toLowerCase())
            );
            if (!hasProduct) return false;
        }
        // IND C&F
        if (saleFilters.indCnf) {
            const ic = (sale.indianCnF || '').toLowerCase();
            if (!ic.includes(saleFilters.indCnf.toLowerCase())) return false;
        }
        // BD C&F
        if (saleFilters.bdCnf) {
            const bc = (sale.bdCnf || '').toLowerCase();
            if (!bc.includes(saleFilters.bdCnf.toLowerCase())) return false;
        }
        return true;
    });

    const stats = {
        totalSales: displayedSales.reduce((sum, s) => sum + (parseFloat(s.totalAmount) || 0), 0),
        totalDiscount: displayedSales.reduce((sum, s) => sum + (parseFloat(s.discount) || 0), 0),
        totalPaid: displayedSales.reduce((sum, s) => sum + (parseFloat(s.paidAmount) || 0), 0),
        totalDue: displayedSales.reduce((sum, s) => sum + (parseFloat(s.dueAmount) || 0), 0),
        totalTrucks: saleType === 'Border' ? displayedSales.reduce((sum, sale) => {
            const items = sale.items || [];
            const truckTotal = items.reduce((iSum, item) => {
                const brandEntries = item.brandEntries || [];
                return iSum + brandEntries.reduce((bSum, entry) => bSum + (parseFloat(entry.truck) || 0), 0);
            }, 0);
            return sum + (items.length > 0 ? truckTotal : (parseFloat(sale.truck) || 0));
        }, 0) : 0
    };

    return (
        <div className="sale-management-container">
            <div className="sale-mgmt-header">
                <div className="w-full md:w-auto">
                    <h2 className="sale-mgmt-title">{saleType} Sale Management</h2>
                </div>

                {!showForm && (
                    <div className="flex-1 w-full max-w-none md:max-w-md mx-auto flex flex-col items-center gap-2">
                        <div className="sale-mgmt-search-container group w-full relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search invoice, customer..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="sale-mgmt-search-input"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsRequestedOnly(!isRequestedOnly)}
                                className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${isRequestedOnly ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}
                            >
                                Requested
                                {requestedCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center px-1 rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-pulse border-2 border-white">
                                        {requestedCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {!showForm && (
                    <div className="grid grid-cols-3 md:flex items-center justify-center md:justify-end gap-1.5 md:gap-3 z-50 w-full md:w-auto">
                        {/* Filter Button */}
                        <div className="relative">
                            <button
                                ref={saleFilterButtonRef}
                                onClick={() => setShowSaleFilterPanel(prev => !prev)}
                                className={`sale-mgmt-btn-action ${showSaleFilterPanel || hasActiveFilters
                                    ? 'sale-mgmt-btn-blue'
                                    : 'sale-mgmt-btn-white'
                                    }`}
                            >
                                <FunnelIcon className="w-5 h-5" />
                                <span>Filter</span>
                                {hasActiveFilters && (
                                    <span className="flex items-center justify-center w-4 h-4 text-[10px] font-black bg-white text-blue-600 rounded-full ml-1">
                                        {Object.values(saleFilters).filter(v => v !== '').length}
                                    </span>
                                )}
                            </button>

                            {showSaleFilterPanel && (
                                <>
                                    {/* Mobile backdrop */}
                                    <div
                                        className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-2xl z-[55]"
                                        onClick={() => setShowSaleFilterPanel(false)}
                                    />
                                    <div ref={saleFilterRef} className="fixed inset-x-4 top-24 md:absolute md:inset-auto md:right-0 md:mt-3 w-auto md:w-[450px] bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[60] p-4 md:p-6 animate-in fade-in zoom-in duration-200">
                                        {/* Filter Header */}
                                        <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-50">
                                            <h4 className="font-extrabold text-gray-900 text-lg">Advance Filter</h4>
                                            <button
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    setSaleFilters({ startDate: '', endDate: '', companyName: '', invoiceNo: '', port: '', productName: '', indCnf: '', bdCnf: '' });
                                                    setSaleFilterSearch({ companySearch: '', invoiceSearch: '', portSearch: '', productSearch: '', indCnfSearch: '', bdCnfSearch: '' });
                                                    setActiveFilterDropdown(null);
                                                }}
                                                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest transition-colors"
                                            >
                                                RESET ALL
                                            </button>
                                        </div>

                                        <div className="space-y-5">
                                            {/* Date Range Row */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div ref={saleFromDateFilterRef}>
                                                    <CustomDatePicker
                                                        label="From Date"
                                                        value={saleFilters.startDate}
                                                        onChange={(e) => setSaleFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                                        compact={true}
                                                        isOpen={activeFilterDropdown === 'from'}
                                                        onToggle={(val) => setActiveFilterDropdown(val ? 'from' : null)}
                                                    />
                                                </div>
                                                <div ref={saleToDateFilterRef}>
                                                    <CustomDatePicker
                                                        label="To Date"
                                                        value={saleFilters.endDate}
                                                        onChange={(e) => setSaleFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                                        compact={true}
                                                        rightAlign={true}
                                                        isOpen={activeFilterDropdown === 'to'}
                                                        onToggle={(val) => setActiveFilterDropdown(val ? 'to' : null)}
                                                    />
                                                </div>
                                            </div>

                                            {/* Type Specific and Product Filters */}
                                            <div className="space-y-5">
                                                {saleType === 'Border' ? (
                                                    <>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            {/* Party Name Filter */}
                                                            <div className="space-y-1.5 relative" ref={saleCompanyFilterRef}>
                                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">PARTY NAME</label>
                                                                <div className="relative">
                                                                    <input
                                                                        type="text"
                                                                        value={saleFilterSearch.companySearch}
                                                                        onChange={(e) => {
                                                                            setSaleFilterSearch(prev => ({ ...prev, companySearch: e.target.value }));
                                                                            setSaleFilters(prev => ({ ...prev, companyName: e.target.value }));
                                                                            setActiveFilterDropdown('company');
                                                                        }}
                                                                        onFocus={() => setActiveFilterDropdown('company')}
                                                                        placeholder={saleFilters.companyName || 'Search party...'}
                                                                        className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${saleFilters.companyName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                                    />
                                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                        {saleFilters.companyName && (
                                                                            <button onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, companyName: '' })); setSaleFilterSearch(prev => ({ ...prev, companySearch: '' })); setActiveFilterDropdown(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                                <XIcon className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                    </div>
                                                                </div>
                                                                {activeFilterDropdown === 'company' && (() => {
                                                                    const options = [...new Set(sales.map(s => s.companyName || s.customerName).filter(Boolean))].sort();
                                                                    const filtered = options.filter(name => name.toLowerCase().includes((saleFilterSearch.companySearch || '').toLowerCase()));
                                                                    return filtered.length > 0 ? (
                                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                            {filtered.map(name => (
                                                                                <button key={name} type="button" onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, companyName: name })); setSaleFilterSearch(prev => ({ ...prev, companySearch: name })); setActiveFilterDropdown(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">
                                                                                    {name}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    ) : null;
                                                                })()}
                                                            </div>

                                                            {/* Entry Port Filter */}
                                                            <div className="space-y-1.5 relative" ref={salePortFilterRef}>
                                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">ENTRY PORT</label>
                                                                <div className="relative">
                                                                    <input
                                                                        type="text"
                                                                        value={saleFilterSearch.portSearch}
                                                                        onChange={(e) => {
                                                                            setSaleFilterSearch(prev => ({ ...prev, portSearch: e.target.value }));
                                                                            setSaleFilters(prev => ({ ...prev, port: e.target.value }));
                                                                            setActiveFilterDropdown('port');
                                                                        }}
                                                                        onFocus={() => setActiveFilterDropdown('port')}
                                                                        placeholder={saleFilters.port || 'Search port...'}
                                                                        className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${saleFilters.port ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                                    />
                                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                        {saleFilters.port && (
                                                                            <button onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, port: '' })); setSaleFilterSearch(prev => ({ ...prev, portSearch: '' })); setActiveFilterDropdown(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                                <XIcon className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                    </div>
                                                                </div>
                                                                {activeFilterDropdown === 'port' && (() => {
                                                                    const options = [...new Set(sales.map(s => s.port).filter(Boolean))].sort();
                                                                    const filtered = options.filter(port => port.toLowerCase().includes((saleFilterSearch.portSearch || '').toLowerCase()));
                                                                    return filtered.length > 0 ? (
                                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                            {filtered.map(port => (
                                                                                <button key={port} type="button" onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, port: port })); setSaleFilterSearch(prev => ({ ...prev, portSearch: port })); setActiveFilterDropdown(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">
                                                                                    {port}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    ) : null;
                                                                })()}
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-4">
                                                            {/* Indian C&F Filter */}
                                                            <div className="space-y-1.5 relative" ref={saleIndCnfFilterRef}>
                                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">INDIAN C&F</label>
                                                                <div className="relative">
                                                                    <input
                                                                        type="text"
                                                                        value={saleFilterSearch.indCnfSearch}
                                                                        onChange={(e) => {
                                                                            setSaleFilterSearch(prev => ({ ...prev, indCnfSearch: e.target.value }));
                                                                            setSaleFilters(prev => ({ ...prev, indCnf: e.target.value }));
                                                                            setActiveFilterDropdown('indCnf');
                                                                        }}
                                                                        onFocus={() => setActiveFilterDropdown('indCnf')}
                                                                        placeholder={saleFilters.indCnf || 'India...'}
                                                                        className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${saleFilters.indCnf ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                                    />
                                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                        {saleFilters.indCnf && (
                                                                            <button onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, indCnf: '' })); setSaleFilterSearch(prev => ({ ...prev, indCnfSearch: '' })); setActiveFilterDropdown(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                                <XIcon className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                    </div>
                                                                </div>
                                                                {activeFilterDropdown === 'indCnf' && (() => {
                                                                    const options = [...new Set(sales.map(s => s.indianCnF).filter(Boolean))].sort();
                                                                    const filtered = options.filter(name => name.toLowerCase().includes((saleFilterSearch.indCnfSearch || '').toLowerCase()));
                                                                    return filtered.length > 0 ? (
                                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                            {filtered.map(name => (
                                                                                <button key={name} type="button" onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, indCnf: name })); setSaleFilterSearch(prev => ({ ...prev, indCnfSearch: name })); setActiveFilterDropdown(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">
                                                                                    {name}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    ) : null;
                                                                })()}
                                                            </div>
                                                            {/* BD C&F Filter */}
                                                            <div className="space-y-1.5 relative" ref={saleBdCnfFilterRef}>
                                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">BD C&F</label>
                                                                <div className="relative">
                                                                    <input
                                                                        type="text"
                                                                        value={saleFilterSearch.bdCnfSearch}
                                                                        onChange={(e) => {
                                                                            setSaleFilterSearch(prev => ({ ...prev, bdCnfSearch: e.target.value }));
                                                                            setSaleFilters(prev => ({ ...prev, bdCnf: e.target.value }));
                                                                            setActiveFilterDropdown('bdCnf');
                                                                        }}
                                                                        onFocus={() => setActiveFilterDropdown('bdCnf')}
                                                                        placeholder={saleFilters.bdCnf || 'BD...'}
                                                                        className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${saleFilters.bdCnf ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                                    />
                                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                        {saleFilters.bdCnf && (
                                                                            <button onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, bdCnf: '' })); setSaleFilterSearch(prev => ({ ...prev, bdCnfSearch: '' })); setActiveFilterDropdown(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                                <XIcon className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                    </div>
                                                                </div>
                                                                {activeFilterDropdown === 'bdCnf' && (() => {
                                                                    const options = [...new Set(sales.map(s => s.bdCnf).filter(Boolean))].sort();
                                                                    const filtered = options.filter(name => name.toLowerCase().includes((saleFilterSearch.bdCnfSearch || '').toLowerCase()));
                                                                    return filtered.length > 0 ? (
                                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                            {filtered.map(name => (
                                                                                <button key={name} type="button" onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, bdCnf: name })); setSaleFilterSearch(prev => ({ ...prev, bdCnfSearch: name })); setActiveFilterDropdown(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">
                                                                                    {name}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    ) : null;
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {/* Company Filter (General) */}
                                                        <div className="space-y-1.5 relative" ref={saleCompanyFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">COMPANY NAME</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={saleFilterSearch.companySearch}
                                                                    onChange={(e) => {
                                                                        setSaleFilterSearch(prev => ({ ...prev, companySearch: e.target.value }));
                                                                        setSaleFilters(prev => ({ ...prev, companyName: e.target.value }));
                                                                        setActiveFilterDropdown('company');
                                                                    }}
                                                                    onFocus={() => setActiveFilterDropdown('company')}
                                                                    placeholder={saleFilters.companyName || 'Search company...'}
                                                                    className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${saleFilters.companyName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                                />
                                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                    {saleFilters.companyName && (
                                                                        <button onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, companyName: '' })); setSaleFilterSearch(prev => ({ ...prev, companySearch: '' })); setActiveFilterDropdown(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                            <XIcon className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                            {activeFilterDropdown === 'company' && (() => {
                                                                const options = [...new Set(sales.map(s => s.companyName || s.customerName).filter(Boolean))].sort();
                                                                const filtered = options.filter(c => c.toLowerCase().includes((saleFilterSearch.companySearch || '').toLowerCase()));
                                                                return filtered.length > 0 ? (
                                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        {filtered.map(c => (
                                                                            <button key={c} type="button" onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, companyName: c })); setSaleFilterSearch(prev => ({ ...prev, companySearch: c })); setActiveFilterDropdown(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">
                                                                                {c}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                        </div>

                                                        {/* Invoice Filter (General) */}
                                                        <div className="space-y-1.5 relative" ref={saleInvoiceFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">INVOICE NUMBER</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={saleFilterSearch.invoiceSearch}
                                                                    onChange={(e) => {
                                                                        setSaleFilterSearch(prev => ({ ...prev, invoiceSearch: e.target.value }));
                                                                        setSaleFilters(prev => ({ ...prev, invoiceNo: e.target.value }));
                                                                        setActiveFilterDropdown('invoice');
                                                                    }}
                                                                    onFocus={() => setActiveFilterDropdown('invoice')}
                                                                    placeholder={saleFilters.invoiceNo || 'Search invoice...'}
                                                                    className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${saleFilters.invoiceNo ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                                />
                                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                    {saleFilters.invoiceNo && (
                                                                        <button onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, invoiceNo: '' })); setSaleFilterSearch(prev => ({ ...prev, invoiceSearch: '' })); setActiveFilterDropdown(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                            <XIcon className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                            {activeFilterDropdown === 'invoice' && (() => {
                                                                const options = [...new Set(sales.map(s => s.invoiceNo).filter(Boolean))].sort();
                                                                const filtered = options.filter(inv => inv.toLowerCase().includes((saleFilterSearch.invoiceSearch || '').toLowerCase()));
                                                                return filtered.length > 0 ? (
                                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        {filtered.map(inv => (
                                                                            <button key={inv} type="button" onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, invoiceNo: inv })); setSaleFilterSearch(prev => ({ ...prev, invoiceSearch: inv })); setActiveFilterDropdown(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">
                                                                                {inv}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Common Product Filter */}
                                                <div className="space-y-1.5 relative" ref={saleProductFilterRef}>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">PRODUCT NAME</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={saleFilterSearch.productSearch}
                                                            onChange={(e) => {
                                                                setSaleFilterSearch(prev => ({ ...prev, productSearch: e.target.value }));
                                                                setSaleFilters(prev => ({ ...prev, productName: e.target.value }));
                                                                setActiveFilterDropdown('product');
                                                            }}
                                                            onFocus={() => setActiveFilterDropdown('product')}
                                                            placeholder={saleFilters.productName || 'Search product...'}
                                                            className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${saleFilters.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                        />
                                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                            {saleFilters.productName && (
                                                                <button onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, productName: '' })); setSaleFilterSearch(prev => ({ ...prev, productSearch: '' })); setActiveFilterDropdown(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                    <XIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                        </div>
                                                    </div>
                                                    {activeFilterDropdown === 'product' && (() => {
                                                        const allProds = sales.flatMap(s => (s.items || []).map(i => i.productName || i.product)).filter(Boolean);
                                                        const options = [...new Set(allProds)].sort();
                                                        const filtered = options.filter(p => p.toLowerCase().includes((saleFilterSearch.productSearch || '').toLowerCase()));
                                                        return filtered.length > 0 ? (
                                                            <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                {filtered.map(p => (
                                                                    <button key={p} type="button" onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, productName: p })); setSaleFilterSearch(prev => ({ ...prev, productSearch: p })); setActiveFilterDropdown(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">
                                                                        {p}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                if (setSalesReportData) setSalesReportData(getFilteredData());
                                setShowSalesReport(true);
                            }}
                            className="sale-mgmt-btn-action sale-mgmt-btn-white"
                        >
                            <BarChartIcon className="w-5 h-5" />
                            <span>Report</span>
                        </button>

                        <button
                            onClick={() => setShowForm(true)}
                            className="sale-mgmt-btn-action sale-mgmt-btn-blue"
                        >
                            <span className="flex items-center gap-2"><span className="text-xl leading-none">+</span> {saleType === 'Border' ? 'New G.P' : 'Add Sale'}</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Summary Cards */}
            {!showForm && (
                <div className={`sale-mgmt-summary-grid ${saleType === 'Border' ? 'md:!grid-cols-5' : ''}`}>
                    {saleType === 'Border' && (
                        <div className="sale-mgmt-card bg-blue-50/50 border-blue-100">
                            <div className="sale-mgmt-card-label text-blue-500">Total Truck</div>
                            <div className="sale-mgmt-card-value text-blue-700">{stats.totalTrucks.toLocaleString()}</div>
                        </div>
                    )}
                    <div className="sale-mgmt-card sale-mgmt-card-default">
                        <div className="sale-mgmt-card-label text-gray-400">Total Sales</div>
                        <div className="sale-mgmt-card-value text-gray-900">৳ {stats.totalSales.toLocaleString()}</div>
                    </div>
                    <div className="sale-mgmt-card sale-mgmt-card-red">
                        <div className="sale-mgmt-card-label text-red-600">Total Disc.</div>
                        <div className="sale-mgmt-card-value text-red-700">৳ {stats.totalDiscount.toLocaleString()}</div>
                    </div>
                    <div className="sale-mgmt-card sale-mgmt-card-emerald">
                        <div className="sale-mgmt-card-label text-emerald-600">Total Paid</div>
                        <div className="sale-mgmt-card-value text-emerald-700">৳ {stats.totalPaid.toLocaleString()}</div>
                    </div>
                    <div className="sale-mgmt-card sale-mgmt-card-orange">
                        <div className="sale-mgmt-card-label text-orange-600">Total Balance</div>
                        <div className="sale-mgmt-card-value text-orange-700">৳ {stats.totalDue.toLocaleString()}</div>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="sale-mgmt-form-container">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="sale-mgmt-form-header">
                        <h3 className="sale-mgmt-form-title">{editingId ? 'Edit Sale' : (saleType === 'Border' ? 'New Gate Pass Entry' : 'New Sale Entry')}</h3>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-red-500 transition-colors">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} autoComplete="off" className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                        <div className={`grid grid-cols-1 ${saleType === 'Border' ? 'md:grid-cols-5' : 'md:grid-cols-6'} gap-4 col-span-2`}>
                                <CustomDatePicker
                                    label="Date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleInputChange}
                                    required
                                    compact={true}
                                    readOnly={isFieldReadOnly(originalData?.date)}
                                />
                            <div className="sale-mgmt-input-group">
                                <label className="sale-mgmt-label">Invoice No</label>
                                <input type="text" name="invoiceNo" value={formData.invoiceNo} readOnly placeholder="Auto-generated" className="sale-mgmt-input sale-mgmt-input-readonly cursor-default" required />
                            </div>

                            {/* Border Field: Importer */}
                            {saleType === 'Border' && (
                                <div className="sale-mgmt-input-group relative importer-dropdown-container">
                                    <label className="sale-mgmt-label">Importer</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="importer"
                                            placeholder={formData.importer || "Search importer..."}
                                            value={activeDropdown === 'importer' ? importerSearch : formData.importer}
                                            readOnly={isFieldReadOnly(originalData?.importer)}
                                            onChange={(e) => {
                                                if (isFieldReadOnly(originalData?.importer)) return;
                                                setImporterSearch(e.target.value);
                                                setActiveDropdown('importer');
                                                setHighlightedIndex(-1);
                                                handleInputChange(e); // allow fallback text input
                                            }}
                                            onFocus={() => {
                                                if (isFieldReadOnly(originalData?.importer)) return;
                                                setActiveDropdown('importer');
                                                setHighlightedIndex(-1);
                                            }}
                                            onKeyDown={(e) => !isFieldReadOnly(originalData?.importer) && handleDropdownKeyDown(e, 'importer', getFilteredImporters(), handleImporterSelect)}
                                            className={`sale-mgmt-input pr-14 ${formData.importer ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.importer) ? 'bg-gray-50' : ''}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {formData.importer && (
                                                <button type="button" onClick={() => handleImporterSelect(null)} className="text-gray-400 hover:text-red-500">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setActiveDropdown(activeDropdown === 'importer' ? null : 'importer')}
                                                className="text-gray-300 hover:text-blue-500 transition-colors"
                                            >
                                                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'importer' ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                    {activeDropdown === 'importer' && getFilteredImporters().length > 0 && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                            {getFilteredImporters().map((importer, idx) => (
                                                <button
                                                    key={importer._id || `imp-${idx}`}
                                                    type="button"
                                                    onClick={() => handleImporterSelect(importer.name)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.importer === importer.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {importer.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {saleType === 'Border' && (
                                <div className="sale-mgmt-input-group">
                                    <label className="sale-mgmt-label">LC No</label>
                                    <input type="text" name="lcNo" value={formData.lcNo} onChange={handleInputChange} readOnly={isFieldReadOnly(originalData?.lcNo)} placeholder="LC-001" className={`sale-mgmt-input ${isFieldReadOnly(originalData?.lcNo) ? 'bg-gray-50' : ''}`} />
                                </div>
                            )}

                            {/* Border Field: Exporter */}
                            {saleType === 'Border' && (
                                <div className="sale-mgmt-input-group relative exporter-dropdown-container">
                                    <label className="sale-mgmt-label">Exporter</label>
                                    <div className="relative">
                                        <select
                                            name="exporter"
                                            value={formData.exporter || ''}
                                            disabled={isFieldReadOnly(originalData?.exporter)}
                                            onChange={handleInputChange}
                                            className={`sale-mgmt-input appearance-none bg-white pr-10 ${isFieldReadOnly(originalData?.exporter) ? 'bg-gray-50' : ''}`}
                                        >
                                            <option value="">Select Exporter</option>
                                            {exportersList.map(exp => (
                                                <option key={exp._id} value={exp.name}>{exp.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                            <ChevronDownIcon className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Border Field: IND C&F */}
                            {saleType === 'Border' && (
                                <div className="sale-mgmt-input-group relative ind-cnf-dropdown-container">
                                    <label className="sale-mgmt-label">IND C&F</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="indianCnF"
                                            placeholder={formData.indianCnF || "Search IND C&F..."}
                                            value={activeDropdown === 'indianCnF' ? indCnfSearch : formData.indianCnF}
                                            readOnly={isFieldReadOnly(originalData?.indianCnF)}
                                            onChange={(e) => {
                                                if (isFieldReadOnly(originalData?.indianCnF)) return;
                                                setIndCnfSearch(e.target.value);
                                                setActiveDropdown('indianCnF');
                                                setHighlightedIndex(-1);
                                                handleInputChange(e); // allow fallback text input
                                            }}
                                            onFocus={() => {
                                                if (isFieldReadOnly(originalData?.indianCnF)) return;
                                                setActiveDropdown('indianCnF');
                                                setHighlightedIndex(-1);
                                            }}
                                            onKeyDown={(e) => !isFieldReadOnly(originalData?.indianCnF) && handleDropdownKeyDown(e, 'indianCnF', getFilteredIndianCnfs(), handleIndCnfSelect)}
                                            className={`sale-mgmt-input pr-14 ${formData.indianCnF ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.indianCnF) ? 'bg-gray-50' : ''}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {formData.indianCnF && (
                                                <button type="button" onClick={() => handleIndCnfSelect(null)} className="text-gray-400 hover:text-red-500">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setActiveDropdown(activeDropdown === 'indianCnF' ? null : 'indianCnF')}
                                                className="text-gray-300 hover:text-blue-500 transition-colors"
                                            >
                                                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'indianCnF' ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                    {activeDropdown === 'indianCnF' && getFilteredIndianCnfs().length > 0 && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                            {getFilteredIndianCnfs().map((cnf, idx) => (
                                                <button
                                                    key={cnf._id || `indcnf-${idx}`}
                                                    type="button"
                                                    onClick={() => handleIndCnfSelect(cnf.name)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.indianCnF === cnf.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {cnf.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Border Field: BD C&F */}
                            {saleType === 'Border' && (
                                <div className="sale-mgmt-input-group relative bd-cnf-dropdown-container">
                                    <label className="sale-mgmt-label">BD C&F</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="bdCnf"
                                            placeholder={formData.bdCnf || "Search BD C&F..."}
                                            value={activeDropdown === 'bdCnf' ? bdCnfSearch : formData.bdCnf}
                                            readOnly={isFieldReadOnly(originalData?.bdCnf)}
                                            onChange={(e) => {
                                                if (isFieldReadOnly(originalData?.bdCnf)) return;
                                                setBdCnfSearch(e.target.value);
                                                setActiveDropdown('bdCnf');
                                                setHighlightedIndex(-1);
                                                handleInputChange(e); // allow fallback text input
                                            }}
                                            onFocus={() => {
                                                if (isFieldReadOnly(originalData?.bdCnf)) return;
                                                setActiveDropdown('bdCnf');
                                                setHighlightedIndex(-1);
                                            }}
                                            onKeyDown={(e) => !isFieldReadOnly(originalData?.bdCnf) && handleDropdownKeyDown(e, 'bdCnf', getFilteredBdCnfs(), handleBdCnfSelect)}
                                            className={`sale-mgmt-input pr-14 ${formData.bdCnf ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.bdCnf) ? 'bg-gray-50' : ''}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {formData.bdCnf && (
                                                <button type="button" onClick={() => handleBdCnfSelect(null)} className="text-gray-400 hover:text-red-500">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setActiveDropdown(activeDropdown === 'bdCnf' ? null : 'bdCnf')}
                                                className="text-gray-300 hover:text-blue-500 transition-colors"
                                            >
                                                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'bdCnf' ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                    {activeDropdown === 'bdCnf' && getFilteredBdCnfs().length > 0 && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                            {getFilteredBdCnfs().map((cnf, idx) => (
                                                <button
                                                    key={cnf._id || `bdcnf-${idx}`}
                                                    type="button"
                                                    onClick={() => handleBdCnfSelect(cnf.name)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.bdCnf === cnf.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {cnf.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Border Field: Port */}
                            {saleType === 'Border' && (
                                <div className="sale-mgmt-input-group relative port-dropdown-container">
                                    <label className="sale-mgmt-label">Port</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="port"
                                            placeholder={formData.port || "Search port..."}
                                            value={activeDropdown === 'port' ? portSearch : formData.port}
                                            readOnly={isFieldReadOnly(originalData?.port)}
                                            onChange={(e) => {
                                                if (isFieldReadOnly(originalData?.port)) return;
                                                setPortSearch(e.target.value);
                                                setActiveDropdown('port');
                                                setHighlightedIndex(-1);
                                                handleInputChange(e); // allow fallback text input
                                            }}
                                            onFocus={() => {
                                                if (isFieldReadOnly(originalData?.port)) return;
                                                setActiveDropdown('port');
                                                setHighlightedIndex(-1);
                                            }}
                                            onKeyDown={(e) => !isFieldReadOnly(originalData?.port) && handleDropdownKeyDown(e, 'port', getFilteredPorts(), handlePortSelect)}
                                            className={`sale-mgmt-input pr-14 ${formData.port ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.port) ? 'bg-gray-50' : ''}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {formData.port && (
                                                <button type="button" onClick={() => handlePortSelect(null)} className="text-gray-400 hover:text-red-500">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setActiveDropdown(activeDropdown === 'port' ? null : 'port')}
                                                className="text-gray-300 hover:text-blue-500 transition-colors"
                                            >
                                                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'port' ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                    {activeDropdown === 'port' && getFilteredPorts().length > 0 && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                            {getFilteredPorts().map((port, idx) => (
                                                <button
                                                    key={port._id || `port-${idx}`}
                                                    type="button"
                                                    onClick={() => handlePortSelect(port.name)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.port === port.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {port.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Company Name Select */}
                            <div className="sale-mgmt-input-group relative company-dropdown-container">
                                <label className="sale-mgmt-label">Company Name</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder={formData.companyName || "Search company..."}
                                        value={companyNameSearch}
                                        readOnly={isFieldReadOnly(originalData?.companyName)}
                                        onChange={(e) => {
                                            if (isFieldReadOnly(originalData?.companyName)) return;
                                            setCompanyNameSearch(e.target.value);
                                            setActiveDropdown('companyName');
                                            setHighlightedIndex(-1);
                                            setFormData(prev => ({ ...prev, companyName: e.target.value }));
                                        }}
                                        onFocus={() => {
                                            if (isFieldReadOnly(originalData?.companyName)) return;
                                            setActiveDropdown('companyName');
                                            setHighlightedIndex(-1);
                                        }}
                                        onKeyDown={(e) => !isFieldReadOnly(originalData?.companyName) && handleDropdownKeyDown(e, 'companyName', getFilteredCompanies(), handleCompanyNameSelect)}
                                        className={`sale-mgmt-input pr-14 ${formData.companyName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.companyName) ? 'bg-gray-50' : ''}`}
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        {formData.companyName && (
                                            <button type="button" onClick={() => handleCompanyNameSelect(null)} className="text-gray-400 hover:text-red-500">
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setActiveDropdown(activeDropdown === 'companyName' ? null : 'companyName')}
                                            className="text-gray-300 hover:text-blue-500 transition-colors"
                                        >
                                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'companyName' ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>
                                </div>
                                {activeDropdown === 'companyName' && getFilteredCompanies().length > 0 && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                        {getFilteredCompanies().map((c, idx) => (
                                            <button
                                                key={c._id}
                                                type="button"
                                                onClick={() => handleCompanyNameSelect(c)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.customerId === c._id ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {c.companyName} ({c.customerName})
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {saleType !== 'Border' && (
                                <div className="sale-mgmt-input-group">
                                    <label className="sale-mgmt-label">Customer</label>
                                    <input type="text" name="customerName" value={formData.customerName} readOnly placeholder="Customer" className="sale-mgmt-input sale-mgmt-input-readonly" />
                                </div>
                            )}
                            <div className="sale-mgmt-input-group">
                                <label className="sale-mgmt-label">Contact</label>
                                <input type="text" name="contact" value={formData.contact} readOnly placeholder="Contact" className="sale-mgmt-input sale-mgmt-input-readonly" />
                            </div>
                            {saleType !== 'Border' && (
                                <div className="sale-mgmt-input-group">
                                    <label className="sale-mgmt-label">Address</label>
                                    <input type="text" name="address" value={formData.address} readOnly placeholder="Address" className="sale-mgmt-input sale-mgmt-input-readonly" />
                                </div>
                            )}

                            {/* Border Field: Commissions Row */}
                            {saleType === 'Border' && (
                                <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-blue-50/30 rounded-2xl border border-blue-100/50 mb-2">
                                    {/* Indian C&F Commission */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest pl-1">IND C&F Commission</span>
                                            <div className="flex items-center bg-white p-0.5 rounded-lg border border-blue-100 shadow-sm h-7 w-32">
                                                <button
                                                    type="button"
                                                    onClick={() => handleInputChange({ target: { name: 'indCommissionUom', value: 'Truck' } })}
                                                    className={`flex-1 h-full flex items-center justify-center rounded-md text-[9px] font-bold transition-all ${formData.indCommissionUom === 'Truck' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-blue-500'}`}
                                                >
                                                    TRUCK
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleInputChange({ target: { name: 'indCommissionUom', value: 'QTY' } })}
                                                    className={`flex-1 h-full flex items-center justify-center rounded-md text-[9px] font-bold transition-all ${formData.indCommissionUom === 'QTY' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-blue-500'}`}
                                                >
                                                    QTY
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 relative">
                                                <input
                                                    type="number"
                                                    name="indCommissionRate"
                                                    value={formData.indCommissionRate}
                                                    onChange={handleInputChange}
                                                    placeholder="Rate"
                                                    className="w-full px-4 py-2 bg-white border border-blue-100 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">Rate</div>
                                            </div>
                                            <div className="flex-1 px-4 py-2 bg-blue-100/50 border border-blue-200 rounded-xl flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-blue-400 uppercase">Total</span>
                                                <span className="text-sm font-black text-blue-700">৳{formData.indCommissionTotal}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* BD C&F Commission */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest pl-1">BD C&F Commission</span>
                                            <div className="flex items-center bg-white p-0.5 rounded-lg border border-blue-100 shadow-sm h-7 w-32">
                                                <button
                                                    type="button"
                                                    onClick={() => handleInputChange({ target: { name: 'bdCommissionUom', value: 'Truck' } })}
                                                    className={`flex-1 h-full flex items-center justify-center rounded-md text-[9px] font-bold transition-all ${formData.bdCommissionUom === 'Truck' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-blue-500'}`}
                                                >
                                                    TRUCK
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleInputChange({ target: { name: 'bdCommissionUom', value: 'QTY' } })}
                                                    className={`flex-1 h-full flex items-center justify-center rounded-md text-[9px] font-bold transition-all ${formData.bdCommissionUom === 'QTY' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-blue-500'}`}
                                                >
                                                    QTY
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 relative">
                                                <input
                                                    type="number"
                                                    name="bdCommissionRate"
                                                    value={formData.bdCommissionRate}
                                                    readOnly={isFieldReadOnly(originalData?.bdCommissionRate)}
                                                    onChange={handleInputChange}
                                                    placeholder="Rate"
                                                    className={`w-full px-4 py-2 bg-white border border-blue-100 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${isFieldReadOnly(originalData?.bdCommissionRate) ? 'bg-gray-50' : ''}`}
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">Rate</div>
                                            </div>
                                            <div className="flex-1 px-4 py-2 bg-blue-100/50 border border-blue-200 rounded-xl flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-blue-400 uppercase">Total</span>
                                                <span className="text-sm font-black text-blue-700">৳{formData.bdCommissionTotal}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="col-span-2 space-y-6">
                            <div className="flex items-center justify-between">
                                <h4 className="text-base font-bold text-gray-800 flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                                    Product Details
                                </h4>
                                {(isFullAdmin || !editingId) && (
                                    <button
                                        type="button"
                                        onClick={addProductItem}
                                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-2"
                                    >
                                        <span className="text-lg">+</span> Add Product
                                    </button>
                                )}
                            </div>

                            <div className="space-y-8">
                                {formData.items.map((item, index) => (
                                    <div key={index} className="sale-mgmt-product-card group/item">
                                        {/* Remove Product Button */}
                                        {formData.items.length > 1 && (isFullAdmin || !editingId) && (
                                            <button
                                                type="button"
                                                onClick={() => removeProductItem(index)}
                                                className="absolute -top-3 -right-3 p-2.5 bg-white text-gray-400 hover:text-red-500 rounded-xl shadow-lg border border-gray-100 opacity-0 group-hover/item:opacity-100 transition-all z-20"
                                            >
                                                < TrashIcon className="w-4 h-4" />
                                            </button>
                                        )}

                                        <div className={`${saleType === 'Border' ? 'flex flex-row items-center gap-4' : 'space-y-6'}`}>
                                            {/* Product Selection */}
                                            <div className={`space-y-1.5 relative px-4 product-dropdown-container ${saleType === 'Border' ? 'flex-1' : 'max-w-sm'}`}>
                                                <label className="sale-mgmt-item-label">Product</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder={item.productName || "Select Product"}
                                                        value={activeDropdown === 'product' && activeItemIndex === index ? productSearch : ''}
                                                        autoComplete="off"
                                                        readOnly={isFieldReadOnly(originalData?.items?.[index]?.productName)}
                                                        onChange={(e) => {
                                                            if (isFieldReadOnly(originalData?.items?.[index]?.productName)) return;
                                                            setProductSearch(e.target.value);
                                                            setActiveDropdown('product');
                                                            setActiveItemIndex(index);
                                                            handleItemInputChange(index, null, { target: { name: 'productName', value: e.target.value } });
                                                        }}
                                                        onFocus={() => {
                                                            if (isFieldReadOnly(originalData?.items?.[index]?.productName)) return;
                                                            setActiveDropdown('product');
                                                            setActiveItemIndex(index);
                                                            setProductSearch(item.productName || '');
                                                        }}
                                                        className={`sale-mgmt-input pr-14 ${item.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.items?.[index]?.productName) ? 'bg-gray-50' : ''}`}
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {item.productName && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    handleProductSelect({ _id: '', name: '' });
                                                                    setProductSearch('');
                                                                }}
                                                                className="text-gray-400 hover:text-red-500"
                                                            >
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setActiveDropdown(activeDropdown === 'product' && activeItemIndex === index ? null : 'product');
                                                                setActiveItemIndex(index);
                                                            }}
                                                            className="text-gray-300 hover:text-blue-500 transition-colors"
                                                        >
                                                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'product' && activeItemIndex === index ? 'rotate-180' : ''}`} />
                                                        </button>
                                                    </div>
                                                    {activeDropdown === 'product' && activeItemIndex === index && getFilteredProducts().length > 0 && (
                                                        <div className="absolute z-[70] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                                            {getFilteredProducts().map((p) => (
                                                                <button
                                                                    key={p._id}
                                                                    type="button"
                                                                    onClick={() => handleProductSelect(p)}
                                                                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-blue-50 font-medium text-gray-700 transition-colors"
                                                                >
                                                                    {p.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {saleType === 'Border' && (
                                                <div className="flex-[3] space-y-4 pt-1">
                                                    <div className="hidden md:grid grid-cols-6 gap-4 px-4">
                                                        <div className="sale-mgmt-item-label text-center">UOM</div>
                                                        <div className="sale-mgmt-item-label text-center">Qty</div>
                                                        <div className="sale-mgmt-item-label text-center">Bag</div>
                                                        <div className="sale-mgmt-item-label text-center">Truck</div>
                                                        <div className="sale-mgmt-item-label text-center">Price</div>
                                                        <div className="sale-mgmt-item-label text-center">Total</div>
                                                    </div>
                                                    {item.brandEntries.map((entry, entryIndex) => (
                                                        <div key={entryIndex} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center px-4">
                                                            {/* UOM Toggle */}
                                                            <div className="relative">
                                                                <label className="md:hidden sale-mgmt-item-label mb-1 block">UOM</label>
                                                                <div className="flex items-center bg-gray-50/50 p-1 rounded-xl border border-gray-100/50 h-10 shadow-inner group/uom">
                                                                    <button
                                                                        type="button"
                                                                        disabled={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.uom)}
                                                                        onClick={() => handleItemInputChange(index, entryIndex, { target: { name: 'uom', value: 'QTY' } })}
                                                                        className={`flex-1 h-full flex items-center justify-center rounded-lg text-[10px] font-black transition-all duration-200 ${entry.uom === 'QTY' ? 'bg-white text-blue-600 shadow-md ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'} ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.uom) ? 'cursor-not-allowed opacity-50' : ''}`}
                                                                    >
                                                                        QTY
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.uom)}
                                                                        onClick={() => handleItemInputChange(index, entryIndex, { target: { name: 'uom', value: 'Truck' } })}
                                                                        className={`flex-1 h-full flex items-center justify-center rounded-lg text-[10px] font-black transition-all duration-200 ${entry.uom === 'Truck' || !entry.uom ? 'bg-white text-blue-600 shadow-md ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'} ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.uom) ? 'cursor-not-allowed opacity-50' : ''}`}
                                                                    >
                                                                        TRUCK
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Qty</label>
                                                                <input type="number" name="quantity" value={entry.quantity} onChange={(e) => handleItemInputChange(index, entryIndex, e)} readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.quantity)} placeholder="0" className={`sale-mgmt-input !px-2 !text-[13px] font-black text-gray-900 text-center ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.quantity) ? 'bg-gray-50' : ''}`} />
                                                            </div>
                                                            <div>
                                                                <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Bag</label>
                                                                <input type="number" name="bag" value={entry.bag} onChange={(e) => handleItemInputChange(index, entryIndex, e)} readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.bag)} placeholder="0" className={`sale-mgmt-input !px-2 !text-[13px] font-bold text-blue-600 text-center ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.bag) ? 'bg-gray-50' : ''}`} />
                                                            </div>
                                                            <div>
                                                                <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Truck</label>
                                                                <input type="number" name="truck" value={entry.truck || ''} onChange={(e) => handleItemInputChange(index, entryIndex, e)} readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.truck)} placeholder="0" className={`sale-mgmt-input !px-2 !text-[13px] font-bold text-gray-600 text-center ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.truck) ? 'bg-gray-50' : ''}`} />
                                                            </div>
                                                            <div>
                                                                <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Price</label>
                                                                <input type="number" name="unitPrice" value={entry.unitPrice} onChange={(e) => handleItemInputChange(index, entryIndex, e)} readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.unitPrice)} placeholder="0" className={`sale-mgmt-input !px-2 !text-[13px] font-bold text-gray-600 text-center ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.unitPrice) ? 'bg-gray-50' : ''}`} />
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1">
                                                                    <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Total</label>
                                                                    <div className="h-10 flex items-center justify-center bg-white/50 border border-gray-200/60 rounded-lg backdrop-blur-sm text-[13px] font-black text-blue-600">
                                                                        {parseFloat(entry.totalAmount || 0).toLocaleString()}
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-row gap-1 items-center justify-center">
                                                                    {entryIndex === item.brandEntries.length - 1 && (isFullAdmin || !editingId) && (
                                                                        <button type="button" onClick={() => addBrandEntry(index)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all active:scale-90" title="Add Brand"><span className="text-xl font-bold">+</span></button>
                                                                    )}
                                                                    {item.brandEntries.length > 1 && (isFullAdmin || !editingId) && (
                                                                        <button type="button" onClick={() => removeBrandEntry(index, entryIndex)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90" title="Remove Brand"><TrashIcon className="w-3.5 h-3.5" /></button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {saleType !== 'Border' && (
                                            <div className="space-y-1">
                                                {/* Header Row for Brands (Hidden on Mobile) */}
                                                <div className="hidden md:grid grid-cols-10 gap-4 px-6 py-1 border border-transparent">
                                                    <div className="col-span-2 sale-mgmt-item-label text-center">Brand</div>
                                                    <div className="sale-mgmt-item-label text-center">Inhouse</div>
                                                    <div className="sale-mgmt-item-label text-center">Warehouse</div>
                                                    <div className="sale-mgmt-item-label text-center">Wh Stock</div>
                                                    <div className="sale-mgmt-item-label text-center">Bag</div>
                                                    <div className="sale-mgmt-item-label text-center">Qty</div>
                                                    <div className="sale-mgmt-item-label text-center">Price</div>
                                                    <div className="col-span-2 sale-mgmt-item-label text-center">Total</div>
                                                </div>

                                                {item.brandEntries.map((entry, entryIndex) => (
                                                    <div key={entryIndex} className="grid grid-cols-1 md:grid-cols-10 gap-4 items-center px-6 group/entry transition-all hover:bg-gray-50/50 rounded-xl py-1.5 border border-transparent hover:border-gray-100/50 relative">
                                                        {/* Brand Selection */}
                                                        <div className="col-span-2 space-y-1 relative brand-dropdown-container">
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block">Brand</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    placeholder={entry.brandName || "Brand"}
                                                                    value={activeDropdown === 'brand' && activeItemIndex === index && activeEntryIndex === entryIndex ? brandSearch : ''}
                                                                    readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.brandName)}
                                                                    onChange={(e) => {
                                                                        if (isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.brandName)) return;
                                                                        setBrandSearch(e.target.value);
                                                                        setActiveDropdown('brand');
                                                                        setActiveItemIndex(index);
                                                                        setActiveEntryIndex(entryIndex);
                                                                        handleItemInputChange(index, entryIndex, { target: { name: 'brandName', value: e.target.value } });
                                                                    }}
                                                                    onFocus={() => {
                                                                        if (isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.brandName)) return;
                                                                        setActiveDropdown('brand');
                                                                        setActiveItemIndex(index);
                                                                        setActiveEntryIndex(entryIndex);
                                                                        setBrandSearch(entry.brandName || '');
                                                                    }}
                                                                    className={`sale-mgmt-input pr-10 !text-xs ${entry.brandName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.brandName) ? 'bg-gray-50' : ''}`}
                                                                />
                                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                                    {entry.brandName && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                handleBrandSelect({ _id: '', brandName: '' });
                                                                                setBrandSearch('');
                                                                            }}
                                                                            className="text-gray-400 hover:text-red-500"
                                                                        >
                                                                            <XIcon className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setActiveDropdown(activeDropdown === 'brand' && activeItemIndex === index && activeEntryIndex === entryIndex ? null : 'brand');
                                                                            setActiveItemIndex(index);
                                                                            setActiveEntryIndex(entryIndex);
                                                                        }}
                                                                        className="text-gray-300 hover:text-blue-500 transition-colors"
                                                                    >
                                                                        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'brand' && activeItemIndex === index && activeEntryIndex === entryIndex ? 'rotate-180' : ''}`} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            {activeDropdown === 'brand' && activeItemIndex === index && activeEntryIndex === entryIndex && getFilteredBrands().length > 0 && (
                                                                <div className="absolute z-[70] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                    {getFilteredBrands().map((sb, idx) => (
                                                                        <button key={idx} type="button" onClick={() => handleBrandSelect(sb)} className="w-full px-4 py-2 text-left text-xs hover:bg-blue-50 font-medium text-gray-700 transition-colors">
                                                                            {sb}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Inhouse Qty */}
                                                        <div>
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Inhouse</label>
                                                            <div className="w-full h-10 flex items-center justify-center bg-white/50 border border-gray-200/60 rounded-lg backdrop-blur-sm text-[13px] font-bold text-gray-900">
                                                                {entry.inhouseQty || '0'}
                                                            </div>
                                                        </div>

                                                        {/* Warehouse Selection */}
                                                        <div className="">
                                                            <div className="space-y-1 relative warehouse-dropdown-container">
                                                                <label className="md:hidden sale-mgmt-item-label mb-1 block">Warehouse</label>
                                                                <div className="relative">
                                                                    <input
                                                                        type="text"
                                                                        placeholder={entry.warehouseName || "Warehouse"}
                                                                        value={activeDropdown === 'warehouse' && activeItemIndex === index && activeEntryIndex === entryIndex ? warehouseSearch : ''}
                                                                        readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.warehouseName)}
                                                                        onChange={(e) => {
                                                                            if (isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.warehouseName)) return;
                                                                            setWarehouseSearch(e.target.value);
                                                                            setActiveDropdown('warehouse');
                                                                            setActiveItemIndex(index);
                                                                            setActiveEntryIndex(entryIndex);
                                                                            handleItemInputChange(index, entryIndex, { target: { name: 'warehouseName', value: e.target.value } });
                                                                        }}
                                                                        onFocus={() => {
                                                                            if (isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.warehouseName)) return;
                                                                            setActiveDropdown('warehouse');
                                                                            setActiveItemIndex(index);
                                                                            setActiveEntryIndex(entryIndex);
                                                                            setWarehouseSearch(entry.warehouseName || '');
                                                                        }}
                                                                        className={`sale-mgmt-input pr-10 !text-xs ${entry.warehouseName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.warehouseName) ? 'bg-gray-50' : ''}`}
                                                                    />
                                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                                        {entry.warehouseName && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    handleWarehouseSelect({ _id: '', whName: '' });
                                                                                    setWarehouseSearch('');
                                                                                }}
                                                                                className="text-gray-400 hover:text-red-500"
                                                                            >
                                                                                <XIcon className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setActiveDropdown(activeDropdown === 'warehouse' && activeItemIndex === index && activeEntryIndex === entryIndex ? null : 'warehouse');
                                                                                setActiveItemIndex(index);
                                                                                setActiveEntryIndex(entryIndex);
                                                                            }}
                                                                            className="text-gray-300 hover:text-blue-500 transition-colors"
                                                                        >
                                                                            <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'warehouse' && activeItemIndex === index && activeEntryIndex === entryIndex ? 'rotate-180' : ''}`} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                {activeDropdown === 'warehouse' && activeItemIndex === index && activeEntryIndex === entryIndex && getFilteredWarehouses().length > 0 && (
                                                                    <div className="absolute z-[70] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1">
                                                                        {getFilteredWarehouses().map((w) => (
                                                                            <button key={w._id} type="button" onClick={() => handleWarehouseSelect(w)} className="w-full px-4 py-2 text-left text-xs hover:bg-blue-50 font-medium text-gray-700">
                                                                                {w.whName}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Wh Stock */}
                                                        <div>
                                                            <label className="md:hidden text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block text-center">Wh Stock</label>
                                                            <div className="w-full h-10 flex items-center justify-center bg-white/50 border border-gray-200/60 rounded-lg backdrop-blur-sm text-[13px] font-bold text-gray-900">
                                                                {entry.warehouseQty || '0'}
                                                            </div>
                                                        </div>

                                                        {/* Bag */}
                                                        <div>
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Bag</label>
                                                            <input
                                                                type="number"
                                                                name="bag"
                                                                value={entry.bag}
                                                                readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.bag)}
                                                                onChange={(e) => handleItemInputChange(index, entryIndex, e)}
                                                                placeholder="0"
                                                                className={`sale-mgmt-input !px-2 !text-[13px] font-bold text-blue-600 text-center ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.bag) ? 'bg-gray-50' : ''}`}
                                                            />
                                                        </div>

                                                        {/* Quantity */}
                                                        <div>
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Qty</label>
                                                            <input
                                                                type="number"
                                                                name="quantity"
                                                                value={entry.quantity}
                                                                readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.quantity)}
                                                                onChange={(e) => handleItemInputChange(index, entryIndex, e)}
                                                                placeholder="0"
                                                                className={`sale-mgmt-input !px-2 !text-[13px] font-black text-gray-900 text-center ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.quantity) ? 'bg-gray-50' : ''}`}
                                                            />
                                                        </div>

                                                        {/* Unit Price */}
                                                        <div>
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Price</label>
                                                            <input
                                                                type="number"
                                                                name="unitPrice"
                                                                value={entry.unitPrice}
                                                                readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.unitPrice)}
                                                                onChange={(e) => handleItemInputChange(index, entryIndex, e)}
                                                                placeholder="0"
                                                                className={`sale-mgmt-input !px-2 !text-[13px] font-bold text-gray-600 text-center ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.unitPrice) ? 'bg-gray-50' : ''}`}
                                                            />
                                                        </div>

                                                        {/* Total + Add/Remove */}
                                                        <div className="col-span-2 flex items-center gap-1.5">
                                                            <div className="flex-1">
                                                                <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Total</label>
                                                                <div className="w-full h-10 flex items-center justify-center bg-white/50 border border-gray-200/60 rounded-lg backdrop-blur-sm text-[13px] font-black text-blue-600">
                                                                    {parseFloat(entry.totalAmount || 0).toLocaleString()}
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-row items-center gap-0.5 shrink-0">
                                                                {entryIndex === item.brandEntries.length - 1 && (isFullAdmin || !editingId) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => addBrandEntry(index)}
                                                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded-full transition-all active:scale-95 hover:scale-110"
                                                                        title="Add Brand"
                                                                    >
                                                                        <span className="text-xl font-black">+</span>
                                                                    </button>
                                                                )}
                                                                {item.brandEntries.length > 1 && (isFullAdmin || !editingId) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeBrandEntry(index, entryIndex)}
                                                                        className="p-1 text-gray-300 hover:text-red-500 transition-all opacity-0 group-hover/entry:opacity-100"
                                                                        title="Remove Brand"
                                                                    >
                                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Invoice Summary */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 col-span-2 pt-4 bg-blue-50/50 p-6 rounded-2xl border border-blue-100/50 mt-4 overflow-hidden">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Discount</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">৳</span>
                                        <input
                                            type="number"
                                            name="discount"
                                            value={formData.discount}
                                            readOnly={isFieldReadOnly(originalData?.discount)}
                                            onChange={handleInputChange}
                                            className={`w-full pl-8 pr-4 py-2.5 bg-white border border-orange-200 rounded-xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-orange-700 ${isFieldReadOnly(originalData?.discount) ? 'bg-gray-50' : ''}`}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Grand Total</label>
                                    <div className="text-2xl font-black text-gray-900">৳ {parseFloat(formData.totalAmount).toLocaleString()}</div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Paid Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">৳</span>
                                        <input
                                            type="number"
                                            name="paidAmount"
                                            value={formData.paidAmount}
                                            readOnly={isFieldReadOnly(originalData?.paidAmount)}
                                            onChange={handleInputChange}
                                            className={`w-full pl-8 pr-4 py-2.5 bg-white border border-blue-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-blue-700 ${isFieldReadOnly(originalData?.paidAmount) ? 'bg-gray-50' : ''}`}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Balance</label>
                                    <div className={`text-2xl font-black ${parseFloat(formData.dueAmount) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        ৳ {parseFloat(formData.dueAmount).toLocaleString()}
                                    </div>
                                </div>
                                <div className="flex flex-col md:flex-row items-center gap-4 justify-end border-t border-gray-100 pt-4 mt-2">
                                    <div className="flex-1 w-full text-center md:text-left">
                                        {submitStatus === 'success' && (
                                            <p className="text-green-600 font-medium flex items-center justify-center md:justify-start animate-bounce">
                                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                                Sale saved successfully!
                                            </p>
                                        )}
                                        {submitStatus === 'error' && (
                                            <p className="text-red-600 font-medium flex items-center justify-center md:justify-start">
                                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                Failed to save sale. Please try again.
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                        <button
                                            type="button"
                                            onClick={() => { setShowForm(false); resetForm(); }}
                                            className="sale-mgmt-btn-secondary"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="sale-mgmt-btn-primary"
                                        >
                                            {isSubmitting ? (
                                                <span className="flex items-center">
                                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Processing...
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1">
                                                    <span className="text-base">+</span>
                                                    {editingId ? 'Update Sale' : 'Confirm Sale'}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form >
                </div >
            )}

            {/* Bulk Actions Bar */}
            {isSelectionMode && saleType === 'Border' && selectedItems.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] ring-1 ring-white/20 px-4 py-2 rounded-full flex items-center gap-4 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-tr from-blue-50/20 to-white/5 pointer-events-none"></div>
                        <div className="flex items-center gap-2.5 pr-4 border-r border-slate-900/10 relative z-10">
                            <div className="w-7 h-7 rounded-full bg-blue-600 shadow-md flex items-center justify-center font-black text-[11px] text-white border border-white/20">
                                {selectedItems.size}
                            </div>
                            <span className="text-[11px] font-black text-slate-800 tracking-tight">Items Selected</span>
                        </div>
                        <div className="flex items-center gap-2 relative z-10">
                            <button
                                onClick={() => setShowBulkRateModal(true)}
                                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-[11px] font-black transition-all active:scale-95 flex items-center gap-2 shadow-sm group"
                            >
                                <EditIcon className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                                Edit Rate
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedItems(new Set());
                                    setIsSelectionMode(false);
                                }}
                                className="px-4 py-1.5 bg-slate-900/10 hover:bg-slate-900/20 text-slate-800 rounded-full text-[11px] font-black transition-all active:scale-95 border border-white/20"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sales Table & Cards */}
            {!showForm && (
                <div className="sale-mgmt-table-container">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="sale-mgmt-table">
                            <thead>
                                {saleType === 'Border' ? (
                                    <tr>
                                        <th className="sale-mgmt-th text-center">
                                            {isSelectionMode ? (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.size === getFilteredData().length && getFilteredData().length > 0}
                                                    onChange={() => {
                                                        const data = getFilteredData();
                                                        if (selectedItems.size === data.length) {
                                                            setSelectedItems(new Set());
                                                            setIsSelectionMode(false);
                                                        } else {
                                                            setSelectedItems(new Set(data.map(s => s._id)));
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                            ) : '#'}
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('date')}>
                                            <div className="flex items-center">Date {renderSortIcon('date')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('lcNo')}>
                                            <div className="flex items-center">LC No {renderSortIcon('lcNo')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('importer')}>
                                            <div className="flex items-center">Importer {renderSortIcon('importer')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('port')}>
                                            <div className="flex items-center">port {renderSortIcon('port')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('indianCnF')}>
                                            <div className="flex items-center">IND C&F {renderSortIcon('indianCnF')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('bdCnf')}>
                                            <div className="flex items-center">BD C&F {renderSortIcon('bdCnf')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('party')}>
                                            <div className="flex items-center">Party {renderSortIcon('party')}</div>
                                        </th>
                                        <th className="sale-mgmt-th">Product</th>
                                        <th className="sale-mgmt-th text-center">QTY</th>
                                        <th className="sale-mgmt-th">Truck</th>
                                        <th className="sale-mgmt-th text-center">rate</th>
                                        <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('totalAmount')}>
                                            <div className="flex items-center justify-center">total price {renderSortIcon('totalAmount')}</div>
                                        </th>
                                        <th className="sale-mgmt-th text-center">Actions</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('date')}>
                                            <div className="flex items-center">Date {renderSortIcon('date')}</div>
                                        </th>
                                        <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('invoiceNo')}>
                                            <div className="flex items-center justify-center">Invoice {renderSortIcon('invoiceNo')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('companyName')}>
                                            <div className="flex items-center">Company {renderSortIcon('companyName')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('customerName')}>
                                            <div className="flex items-center">Customer {renderSortIcon('customerName')}</div>
                                        </th>
                                        <th className="sale-mgmt-th">Product</th>
                                        <th className="sale-mgmt-th">Brand</th>
                                        <th className="sale-mgmt-th text-center font-bold">Quantity</th>
                                        <th className="sale-mgmt-th text-center font-bold">Rate</th>
                                        <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('discount')}>
                                            <div className="flex items-center justify-center">Discount {renderSortIcon('discount')}</div>
                                        </th>
                                        <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('totalAmount')}>
                                            <div className="flex items-center justify-center">Total {renderSortIcon('totalAmount')}</div>
                                        </th>
                                        <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('paidAmount')}>
                                            <div className="flex items-center justify-center">Paid {renderSortIcon('paidAmount')}</div>
                                        </th>
                                        <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('dueAmount')}>
                                            <div className="flex items-center justify-center">Balance {renderSortIcon('dueAmount')}</div>
                                        </th>
                                        <th className="sale-mgmt-th text-center">Actions</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {isLoading ? (
                                    <tr><td colSpan={saleType === 'Border' ? "12" : "12"} className="px-3 py-20 text-center text-gray-400 font-medium">No sales records found</td></tr>
                                ) : getFilteredData().map((sale, index) => {
                                    const isExpanded = expandedRows.includes(sale._id);
                                    const isMultiple = (sale.items && sale.items.length > 0)
                                        ? sale.items.flatMap(item => (item.brandEntries || [])).length > 1
                                        : false;

                                    const items = sale.items && sale.items.length > 0
                                        ? sale.items.flatMap(item =>
                                            (item.brandEntries || []).length > 0
                                                ? item.brandEntries.map(be => ({ ...be, productName: item.productName }))
                                                : [{ ...item, productName: item.productName }]
                                        )
                                        : [{
                                            productName: sale.productName,
                                            brand: sale.brand,
                                            quantity: sale.quantity,
                                            unitPrice: sale.unitPrice
                                        }];

                                    if (saleType === 'Border') {
                                        return (
                                            <tr
                                                key={sale._id}
                                                onMouseDown={() => startLongPress(sale._id)}
                                                onMouseUp={endLongPress}
                                                onMouseLeave={endLongPress}
                                                onTouchStart={() => startLongPress(sale._id)}
                                                onTouchEnd={endLongPress}
                                                onClick={() => {
                                                    if (isLongPressTriggered && isLongPressTriggered.current) return;
                                                    isSelectionMode && toggleSelection(sale._id);
                                                }}
                                                className={`hover:bg-blue-50/50 transition-all border-b border-gray-50 text-[13px] ${selectedItems.has(sale._id) ? 'bg-blue-50' : ''}`}
                                            >
                                                <td className="px-3 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                    {isSelectionMode ? (
                                                        (isFullAdmin || canUserEditSale(sale)) ? (
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedItems.has(sale._id)}
                                                                onChange={() => toggleSelection(sale._id)}
                                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                        ) : (
                                                            <div className="w-4 h-4" /> // Empty space for non-editable
                                                        )
                                                    ) : (
                                                        <span className="text-gray-400 font-medium">{index + 1}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-gray-600">{formatDate(sale.date)}</td>
                                                <td className="px-3 py-4 whitespace-nowrap font-semibold text-gray-800">{sale.lcNo || '-'}</td>
                                                <td className="px-3 py-4 whitespace-nowrap font-semibold text-gray-800">{getSafeString(sale.importer) || '-'}</td>
                                                <td className="px-3 py-4 whitespace-nowrap font-semibold text-gray-800">{getSafeString(sale.port) || '-'}</td>
                                                <td className="px-3 py-4 whitespace-nowrap font-semibold text-gray-800">{getSafeString(sale.indianCnF) || '-'}</td>
                                                <td className="px-3 py-4 whitespace-nowrap font-semibold text-gray-800">{getSafeString(sale.bdCnf) || '-'}</td>
                                                <td className="px-3 py-4 whitespace-nowrap font-semibold text-gray-800">{getSafeString(sale.companyName) || getSafeString(sale.customerName) || '-'}</td>
                                                <td className="px-3 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-1">
                                                        {items.map((it, idx) => (
                                                            <div key={idx} className="font-bold text-gray-800 border-b border-gray-100 last:border-0 pb-0.5">{it.productName || '-'}</div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-center">
                                                    <div className="flex flex-col gap-1">
                                                        {items.map((it, idx) => (
                                                            <div key={idx} className="font-semibold text-gray-800 border-b border-gray-100 last:border-0 pb-0.5">{parseFloat(it.quantity || 0).toLocaleString()}</div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-center text-gray-800">
                                                    <div className="flex flex-col gap-1">
                                                        {items.map((it, idx) => (
                                                            <div key={idx} className="font-semibold text-gray-800 border-b border-gray-100 last:border-0 pb-0.5">
                                                                {it.truck || sale.truck || '-'}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-center">
                                                    <div className="flex flex-col gap-1">
                                                        {items.map((it, idx) => (
                                                            <div key={idx} className="font-semibold text-gray-800 border-b border-gray-100 last:border-0 pb-0.5">৳ {parseFloat(it.unitPrice || 0).toLocaleString()}</div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-center font-black text-gray-900">৳ {parseFloat(sale.totalAmount).toLocaleString()}</td>
                                                <td className="px-3 py-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {sale.status === 'Requested' ? (
                                                            <>
                                                                <button onClick={(e) => { e.stopPropagation(); setViewData(sale); }} className="text-gray-400 hover:text-blue-600 transition-colors" title="View Details"><EyeIcon className="w-5 h-5" /></button>
                                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(sale); }} className="text-gray-400 hover:text-blue-600 transition-colors" title="Edit"><EditIcon className="w-5 h-5" /></button>
                                                                {canApprove && (
                                                                    <>
                                                                        <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(sale, 'Pending'); }} className="text-gray-400 hover:text-emerald-600 transition-colors" title="Accept"><CheckIcon className="w-5 h-5" /></button>
                                                                        <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(sale, 'Rejected'); }} className="text-gray-400 hover:text-red-600 transition-colors" title="Reject"><XIcon className="w-5 h-5" /></button>
                                                                    </>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button onClick={(e) => { e.stopPropagation(); generateSaleInvoicePDF(sale, customers); }} className="p-2 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-all" title="Invoice"><FileTextIcon className="w-4 h-4" /></button>
                                                                {(isFullAdmin || canUserEditSale(sale)) && (
                                                                    <>
                                                                        <button onClick={(e) => { e.stopPropagation(); handleEdit(sale); }} className="p-2 hover:bg-blue-100 text-blue-600 rounded-xl transition-all" title="Edit"><EditIcon className="w-4 h-4" /></button>
                                                                        {isFullAdmin && <button onClick={(e) => { e.stopPropagation(); handleDelete(sale); }} className="p-2 hover:bg-red-100 text-red-600 rounded-xl transition-all" title="Delete"><TrashIcon className="w-4 h-4" /></button>}
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    return (
                                        <tr
                                            key={sale._id}
                                            onClick={() => isMultiple && toggleRowExpansion(sale._id)}
                                            className={`hover:bg-blue-50/50 transition-all group border-b border-gray-50 last:border-0 align-middle ${isMultiple ? 'cursor-pointer' : ''}`}
                                        >
                                            <td className="px-3 py-4 whitespace-nowrap">
                                                <div className="text-[13px] font-medium text-gray-600">{formatDate(sale.date)}</div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                <div className="text-[13px] font-semibold text-gray-800">{sale.invoiceNo || '-'}</div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap">
                                                <div className="text-[13px] font-semibold text-gray-800">{getSafeString(sale.companyName) || '-'}</div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap">
                                                <div className="text-[13px] font-semibold text-gray-800">{getSafeString(sale.customerName) || '-'}</div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap">
                                                {isMultiple && !isExpanded ? (
                                                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100/50 rounded text-[9px] font-bold uppercase tracking-wider">Multiple</span>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {items.map((it, idx) => (
                                                            <div key={idx} className={`text-[13px] text-gray-800 font-bold ${idx < items.length - 1 ? 'border-b border-gray-100 pb-1' : ''}`}>
                                                                {it.productName || '-'}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap">
                                                {isMultiple && !isExpanded ? (
                                                    <span className="px-1.5 py-0.5 bg-gray-50 text-gray-500 border border-gray-100 rounded text-[9px] font-bold uppercase tracking-wider">Multiple</span>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {items.map((it, idx) => (
                                                            <div key={idx} className={`text-[13px] font-semibold text-gray-700 ${idx < items.length - 1 ? 'border-b border-gray-100 pb-1' : ''}`}>
                                                                {it.brand || '-'}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                {isMultiple && !isExpanded ? (
                                                    <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-100/50 text-[13px] font-black">
                                                        {items.reduce((sum, it) => sum + (parseFloat(it.quantity) || 0), 0).toLocaleString()}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {items.map((it, idx) => (
                                                            <div key={idx} className={`text-[13px] font-semibold text-gray-800 ${idx < items.length - 1 ? 'border-b border-gray-100 pb-1' : ''}`}>
                                                                {parseFloat(it.quantity || 0).toLocaleString()}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                {isMultiple && !isExpanded ? (
                                                    <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-bold uppercase tracking-wider inline-block">Multiple</span>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {items.map((it, idx) => (
                                                            <div key={idx} className={`text-[13px] font-semibold text-gray-800 ${idx < items.length - 1 ? 'border-b border-gray-100 pb-1' : ''}`}>
                                                                ৳ {parseFloat(it.unitPrice || 0).toLocaleString()}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                <div className="text-[13px] font-bold text-red-600">
                                                    {parseFloat(sale.discount || 0) > 0 ? `-৳ ${parseFloat(sale.discount).toLocaleString()}` : '-'}
                                                </div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                <div className="text-[13px] font-black text-gray-900">৳ {parseFloat(sale.totalAmount).toLocaleString()}</div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                <div className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold inline-block border border-emerald-100/50">
                                                    ৳ {parseFloat(sale.paidAmount || 0).toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                <div className="px-2 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold inline-block border border-orange-100/50">
                                                    ৳ {parseFloat(sale.dueAmount || 0).toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="px-3 py-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {sale.status === 'Requested' ? (
                                                        <>
                                                            <button onClick={(e) => { e.stopPropagation(); setViewData(sale); }} className="text-gray-400 hover:text-blue-600 transition-colors" title="View Details"><EyeIcon className="w-5 h-5" /></button>
                                                            {(isFullAdmin || canUserEditSale(sale)) && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(sale); }} className="text-gray-400 hover:text-blue-600 transition-colors" title="Edit"><EditIcon className="w-5 h-5" /></button>
                                                            )}
                                                            {canApprove && (
                                                                <>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(sale, 'Pending'); }} className="text-gray-400 hover:text-emerald-600 transition-colors" title="Accept"><CheckIcon className="w-5 h-5" /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(sale, 'Rejected'); }} className="text-gray-400 hover:text-red-600 transition-colors" title="Reject"><XIcon className="w-5 h-5" /></button>
                                                                </>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={(e) => { e.stopPropagation(); generateSaleInvoicePDF(sale, customers); }} className="p-2 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-all" title="Invoice"><FileTextIcon className="w-4 h-4" /></button>
                                                            {(isFullAdmin || canUserEditSale(sale)) && (
                                                                <>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(sale); }} className="p-2 hover:bg-blue-100 text-blue-600 rounded-xl transition-all" title="Edit"><EditIcon className="w-4 h-4" /></button>
                                                                    {isFullAdmin && <button onClick={(e) => { e.stopPropagation(); handleDelete(sale); }} className="p-2 hover:bg-red-100 text-red-600 rounded-xl transition-all" title="Delete"><TrashIcon className="w-4 h-4" /></button>}
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4 px-1">
                        {isLoading ? (
                            <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center text-gray-400 font-medium shadow-sm">
                                No sales records found
                            </div>
                        ) : getFilteredData().map((sale, index) => {
                            const isExpanded = expandedRows.includes(sale._id);
                            const isMultiple = (sale.items && sale.items.length > 0)
                                ? sale.items.flatMap(item => (item.brandEntries || [])).length > 1
                                : false;

                            const items = sale.items && sale.items.length > 0
                                ? sale.items.flatMap(item =>
                                    (item.brandEntries || []).length > 0
                                        ? item.brandEntries.map(be => ({ ...be, productName: item.productName }))
                                        : [{ ...item, productName: item.productName }]
                                )
                                : [{
                                    productName: sale.productName,
                                    brand: sale.brand,
                                    quantity: sale.quantity,
                                    unitPrice: sale.unitPrice
                                }];

                            return (
                                <div
                                    key={sale._id}
                                    onMouseDown={() => saleType === 'Border' && startLongPress(sale._id)}
                                    onMouseUp={endLongPress}
                                    onMouseLeave={endLongPress}
                                    onTouchStart={() => saleType === 'Border' && startLongPress(sale._id)}
                                    onTouchEnd={endLongPress}
                                    className={`sale-mgmt-mobile-card group cursor-pointer transition-all ${isExpanded ? 'shadow-md ring-1 ring-blue-500/10 p-4' : 'hover:bg-gray-50/30 p-2.5'} ${selectedItems.has(sale._id) ? 'bg-blue-50 ring-1 ring-blue-500/30' : ''}`}
                                    onClick={() => {
                                        if (isLongPressTriggered && isLongPressTriggered.current) return;
                                        isSelectionMode && saleType === 'Border' ? toggleSelection(sale._id) : toggleRowExpansion(sale._id);
                                    }}
                                >
                                    {/* Collapsed Single Line View / Expanded Header Row */}
                                    <div className={`flex items-center justify-between min-w-0 ${isExpanded ? 'border-b border-gray-50 pb-3 mb-4' : ''}`}>
                                        <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                                            {isSelectionMode && saleType === 'Border' && (
                                                <div className="flex-shrink-0 pr-1" onClick={(e) => e.stopPropagation()}>
                                                    {(isFullAdmin || canUserEditSale(sale)) ? (
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedItems.has(sale._id)}
                                                            onChange={() => toggleSelection(sale._id)}
                                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                    ) : (
                                                        <div className="w-4 h-4" />
                                                    )}
                                                </div>
                                            )}
                                            {/* Date & Inv */}
                                            <div className="flex-shrink-0">
                                                <div className="sale-mgmt-mobile-label">{formatDate(sale.date)}</div>
                                                <div className={`${!isExpanded ? 'text-[11px]' : 'text-sm'} font-black text-gray-900 truncate`}>{saleType === 'Border' ? (sale.lcNo || sale.importer || 'No ID') : (sale.invoiceNo || sale.importer || 'No ID')}</div>
                                            </div>

                                            {!isExpanded && (
                                                <>
                                                    <div className="flex-1 min-w-0 border-l border-gray-100 pl-3">
                                                        <div className="sale-mgmt-mobile-label">Company</div>
                                                        <div className="text-[11px] font-bold text-gray-800 truncate">{getSafeString(sale.companyName) || sale.port || '-'}</div>
                                                    </div>
                                                    <div className="flex-shrink-0 border-l border-gray-100 pl-3 text-right">
                                                        <div className="sale-mgmt-mobile-label text-blue-600">Total</div>
                                                        <div className="text-[11px] font-black text-gray-900">৳{parseFloat(sale.totalAmount).toLocaleString()}</div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 ml-2">
                                            {sale.isEdited && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[9px] font-medium border border-amber-100">
                                                    Edited
                                                </span>
                                            )}
                                            {isExpanded ? (
                                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                    {sale.status === 'Requested' ? (
                                                        <>
                                                            <button onClick={(e) => { e.stopPropagation(); setViewData(sale); }} className="p-2 text-blue-600 bg-blue-50/50 rounded-lg transition-colors hover:bg-blue-100" title="View Details"><EyeIcon className="w-4 h-4" /></button>
                                                            {(isFullAdmin || canUserEditSale(sale)) && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(sale); }} className="p-2 text-blue-600 bg-blue-50/50 rounded-lg transition-colors hover:bg-blue-100" title="Edit"><EditIcon className="w-4 h-4" /></button>
                                                            )}
                                                            {canApprove && (
                                                                <>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(sale, 'Pending'); }} className="p-2 text-emerald-600 bg-emerald-50/50 rounded-lg transition-colors hover:bg-emerald-100" title="Accept"><CheckIcon className="w-4 h-4" /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(sale, 'Rejected'); }} className="p-2 text-red-600 bg-red-50/50 rounded-lg transition-colors hover:bg-red-100" title="Reject"><XIcon className="w-4 h-4" /></button>
                                                                </>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={(e) => { e.stopPropagation(); generateSaleInvoicePDF(sale, customers); }} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg transition-colors hover:bg-emerald-100"><FileTextIcon className="w-4 h-4" /></button>
                                                            {(isFullAdmin || canUserEditSale(sale)) && (
                                                                <>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(sale); }} className="p-2 bg-blue-50 text-blue-600 rounded-lg transition-colors hover:bg-blue-100"><EditIcon className="w-4 h-4" /></button>
                                                                    {isFullAdmin && <button onClick={(e) => { e.stopPropagation(); handleDelete(sale); }} className="p-2 bg-red-50 text-red-600 rounded-lg transition-colors hover:bg-red-100"><TrashIcon className="w-4 h-4" /></button>}
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>

                                    {/* Expanded Only Content */}
                                    {isExpanded && (
                                        <>
                                            {/* Customer/Company Info */}
                                            <div className="grid grid-cols-2 gap-4 text-xs mb-4">
                                                <div>
                                                    <div className="sale-mgmt-mobile-label">Customer</div>
                                                    <div className="sale-mgmt-mobile-value">{getSafeString(sale.customerName) || '-'}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="sale-mgmt-mobile-label">Company</div>
                                                    <div className="sale-mgmt-mobile-value truncate">{getSafeString(sale.companyName) || sale.port || '-'}</div>
                                                </div>
                                            </div>
                                            {sale.requestedBy && (
                                                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                                                    <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Requested By</div>
                                                    <div className="text-[12px] font-bold text-indigo-700 ml-1">{sale.requestedBy}</div>
                                                </div>
                                            )}

                                            {/* Items Section */}
                                            <div className="sale-mgmt-mobile-section mt-1">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-[10px] font-bold text-gray-600 uppercase">Products & Quantities</div>
                                                    {isMultiple && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleRowExpansion(sale._id);
                                                            }}
                                                            className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors"
                                                        >
                                                            Show Less
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-12 gap-1 px-1 pb-1 border-b border-gray-100 mb-1 mt-2">
                                                    <div className="col-span-3 text-[9px] font-bold text-gray-400 uppercase">Brand</div>
                                                    <div className="col-span-3 text-[9px] font-bold text-gray-400 uppercase text-right">Qty</div>
                                                    <div className="col-span-3 text-[9px] font-bold text-gray-400 uppercase text-right">Price</div>
                                                    <div className="col-span-3 text-[9px] font-bold text-gray-400 uppercase text-right">Total</div>
                                                </div>
                                                <div className="space-y-2.5">
                                                    {items.map((it, idx) => (
                                                        <div key={idx} className="border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                                                            <div className="text-[12px] font-black text-gray-800 mb-0.5">{it.productName || '-'}</div>
                                                            <div className="grid grid-cols-12 gap-1 items-center text-[10px]">
                                                                <div className="col-span-3 min-w-0">
                                                                    <span className="text-[10px] font-medium text-gray-500 italic truncate">{it.brand || '-'}</span>
                                                                </div>
                                                                <div className="col-span-3 text-right">
                                                                    <div className="font-bold text-gray-900">{parseFloat(it.quantity || 0).toLocaleString()}</div>
                                                                </div>
                                                                <div className="col-span-3 text-right">
                                                                    <div className="font-medium text-blue-600 truncate">{parseFloat(it.unitPrice || 0).toLocaleString()}</div>
                                                                </div>
                                                                <div className="col-span-3 text-right">
                                                                    <div className="font-black text-gray-900 truncate">৳{(parseFloat(it.quantity || 0) * parseFloat(it.unitPrice || 0)).toLocaleString()}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Money Summary */}
                                            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-50 mt-4">
                                                <div className="sale-mgmt-mobile-money-card bg-red-50/40 border-red-100/50">
                                                    <div className="sale-mgmt-mobile-label text-red-600">Discount</div>
                                                    <div className="text-[14px] font-black text-red-600">৳{parseFloat(sale.discount || 0).toLocaleString()}</div>
                                                </div>
                                                <div className="sale-mgmt-mobile-money-card bg-blue-50/40 border-blue-100/50">
                                                    <div className="sale-mgmt-mobile-label text-blue-600 mb-0">Total</div>
                                                    <div className="text-[14px] font-black text-gray-900">৳{parseFloat(sale.totalAmount).toLocaleString()}</div>
                                                </div>
                                                <div className="sale-mgmt-mobile-money-card bg-emerald-50/40 border-emerald-100/50">
                                                    <div className="sale-mgmt-mobile-label text-emerald-600">Paid</div>
                                                    <div className="text-[14px] font-black text-emerald-700">৳{parseFloat(sale.paidAmount || 0).toLocaleString()}</div>
                                                </div>
                                                <div className="sale-mgmt-mobile-money-card bg-orange-50/40 border-orange-100/50">
                                                    <div className="sale-mgmt-mobile-label text-orange-600">Balance</div>
                                                    <div className="text-[14px] font-black text-orange-700">৳{parseFloat(sale.dueAmount || 0).toLocaleString()}</div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {viewData && renderViewModal()}

            {/* Bulk Rate Edit Modal */}
            {showBulkRateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowBulkRateModal(false)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-900">Edit Rate</h3>
                            <button onClick={() => setShowBulkRateModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                <p className="text-sm text-blue-700 font-medium">
                                    Updating rate for <span className="font-bold">{selectedItems.size}</span> selected border sales.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">New Rate (৳)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">৳</span>
                                    <input
                                        type="number"
                                        value={bulkRate}
                                        onChange={(e) => setBulkRate(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-gray-900"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setShowBulkRateModal(false)}
                                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkRateUpdate}
                                disabled={isSubmitting || !bulkRate}
                                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                            >
                                {isSubmitting ? 'Updating...' : 'Update Rate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SaleManagement;
