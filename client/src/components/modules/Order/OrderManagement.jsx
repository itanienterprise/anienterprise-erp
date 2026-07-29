import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from '../../../utils/api';
import {
    PlusIcon, EditIcon, TrashIcon, SearchIcon, FunnelIcon, EyeIcon, XIcon,
    ShoppingCartIcon, ChevronDownIcon, ChevronUpIcon, RotateCcwIcon, DownloadIcon, CheckIcon, BarChartIcon
} from '../../Icons';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import { encryptData, decryptData } from '../../../utils/encryption';
import CustomDatePicker from '../../shared/CustomDatePicker';
import { calculatePktRemainder } from '../../../utils/stockHelpers';
import { hasPermission } from '../../../utils/permissionHelper';

const OrderManagement = ({
    currentUser,
    addNotification,
    fetchSalesGlobal,
    refreshPendingIndicators,
    onDeleteConfirm,
    setShowSalesReport,
    setSalesReportData,
    setSalesReportSearchQuery
}) => {
    // --- State Management ---
    const [sales, setSales] = useState([]);
    const [allSalesRecords, setAllSalesRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- Permission Checks ---
    const canAdd = useMemo(() => hasPermission(currentUser, 'order', 'add') || hasPermission(currentUser, 'sales', 'add'), [currentUser]);
    const canEdit = useMemo(() => hasPermission(currentUser, 'order', 'edit') || hasPermission(currentUser, 'sales', 'edit'), [currentUser]);
    const canDelete = useMemo(() => hasPermission(currentUser, 'order', 'delete') || hasPermission(currentUser, 'sales', 'delete'), [currentUser]);
    const canApprove = useMemo(() => hasPermission(currentUser, 'order', 'special') || hasPermission(currentUser, 'sales', 'special'), [currentUser]);
    const canViewOrderRequest = useMemo(() => hasPermission(currentUser, 'order', 'orderRequest') || hasPermission(currentUser, 'sales', 'saleRequest'), [currentUser]);
    const canViewEditRequest = useMemo(() => hasPermission(currentUser, 'order', 'editRequest') || hasPermission(currentUser, 'sales', 'editRequest'), [currentUser]);

    // Requested & Edit Request Toggle Filters
    const [isRequestedOnly, setIsRequestedOnly] = useState(false);
    const [isEditRequestedOnly, setIsEditRequestedOnly] = useState(false);

    // Form & View States
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [originalData, setOriginalData] = useState(null);
    const [viewRecord, setViewRecord] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedRows, setCollapsedRows] = useState([]);

    // Show Bag Preference
    const [showBag, setShowBag] = useState(() => {
        const saved = localStorage.getItem('order_showBag_default');
        return saved !== null ? saved === 'true' : true;
    });

    useEffect(() => {
        localStorage.setItem('order_showBag_default', showBag ? 'true' : 'false');
    }, [showBag]);

    // Sorting State
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

    // Filter Panel State
    const [showSaleFilterPanel, setShowSaleFilterPanel] = useState(false);
    const saleFilterRef = useRef(null);
    const saleFilterButtonRef = useRef(null);
    const saleFromDateFilterRef = useRef(null);
    const saleToDateFilterRef = useRef(null);
    const saleCompanyFilterRef = useRef(null);
    const saleProductFilterRef = useRef(null);
    const saleBrandFilterRef = useRef(null);
    const [saleFilters, setSaleFilters] = useState({
        quickRange: 'monthly',
        selectedMonth: new Date().getMonth() + 1,
        selectedYear: new Date().getFullYear(),
        startDate: '',
        endDate: '',
        companyName: '',
        invoiceNo: '',
        port: '',
        productName: '',
        brand: '',
        indCnf: '',
        bdCnf: ''
    });

    const [saleFilterSearch, setSaleFilterSearch] = useState({
        companySearch: '',
        invoiceSearch: '',
        portSearch: '',
        productSearch: '',
        brandSearch: '',
        indCnfSearch: '',
        bdCnfSearch: ''
    });

    const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);

    // Form Data State
    const initialFormState = {
        date: new Date().toISOString().split('T')[0],
        invoiceNo: '',
        companyName: '',
        customerName: '',
        phone: '',
        address: '',
        notes: '',
        status: 'Requested',
        saleType: 'Order',
        items: [{
            productName: '',
            uom: 'QTY',
            brandEntries: [{
                brand: '',
                warehouseName: '',
                packetSize: '30',
                packet: '',
                quantity: '',
                rate: '',
                amount: ''
            }]
        }]
    };

    const [formData, setFormData] = useState(initialFormState);

    // Reference Data: Customers
    const [customers, setCustomers] = useState([]);
    const [companyNameSearch, setCompanyNameSearch] = useState('');
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    // Reference Data: Products
    const [products, setProducts] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [brandSearch, setBrandSearch] = useState('');

    // Reference Data: Warehouses & Stock
    const [warehouses, setWarehouses] = useState([]);
    const [stockRecords, setStockRecords] = useState([]);
    const [warehouseSearch, setWarehouseSearch] = useState('');
    const [activeItemIndex, setActiveItemIndex] = useState(null);
    const [activeEntryIndex, setActiveEntryIndex] = useState(null);

    // Close Filter & Dropdowns on Outside Click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (e.target && !document.body.contains(e.target)) return;
            if (
                saleFilterRef.current &&
                !saleFilterRef.current.contains(e.target) &&
                saleFilterButtonRef.current &&
                !saleFilterButtonRef.current.contains(e.target)
            ) {
                setShowSaleFilterPanel(false);
            }
            if (activeFilterDropdown && saleFilterRef.current && saleFilterRef.current.contains(e.target)) {
                if (
                    (activeFilterDropdown === 'from' && saleFromDateFilterRef.current && !saleFromDateFilterRef.current.contains(e.target)) ||
                    (activeFilterDropdown === 'to' && saleToDateFilterRef.current && !saleToDateFilterRef.current.contains(e.target)) ||
                    (activeFilterDropdown === 'company' && saleCompanyFilterRef.current && !saleCompanyFilterRef.current.contains(e.target)) ||
                    (activeFilterDropdown === 'product' && saleProductFilterRef.current && !saleProductFilterRef.current.contains(e.target)) ||
                    (activeFilterDropdown === 'brand' && saleBrandFilterRef.current && !saleBrandFilterRef.current.contains(e.target))
                ) {
                    setActiveFilterDropdown(null);
                }
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
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown, activeFilterDropdown]);

    // --- Data Fetching ---
    useEffect(() => {
        fetchOrders();
        fetchCustomers();
        fetchWarehouses();
        fetchProducts();
        fetchStockRecords();
    }, []);

    const fetchCustomers = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/customers`);
            setCustomers(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching customers:', err);
        }
    };

    const fetchWarehouses = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/warehouses`);
            setWarehouses(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching warehouses:', err);
        }
    };

    const fetchStockRecords = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/stock`);
            setStockRecords(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching stock records:', err);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/products`);
            setProducts(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching products:', err);
        }
    };

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/sales`);
            const data = Array.isArray(res.data) ? res.data : [];
            setAllSalesRecords(data);

            const filtered = data.filter(item => {
                const sType = (item.saleType || '').toLowerCase();
                const inv = (item.invoiceNo || item.orderNo || '').toUpperCase();
                return sType === 'order' || inv.startsWith('ORD') || item.isOrderEntry === true;
            });

            setSales(filtered);
        } catch (err) {
            console.error('Error fetching orders:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const getFilteredCustomers = () => {
        // Only show General type customers (field is 'customerType', value is 'General Customer')
        const generalCustomers = customers.filter(c => {
            const cType = (c.customerType || 'General Customer').toLowerCase();
            return cType.includes('general');
        });
        if (!companyNameSearch) return generalCustomers;
        const q = companyNameSearch.toLowerCase();
        return generalCustomers.filter(c =>
            (c.companyName || '').toLowerCase().includes(q) ||
            (c.customerName || '').toLowerCase().includes(q) ||
            (c.contact || c.phone || '').toLowerCase().includes(q)
        );
    };

    const getFilteredWarehouses = () => {
        const uniqueWhs = [];
        const seen = new Set();
        warehouses.forEach(w => {
            const name = (w.whName || w.warehouse || '').trim();
            if (name && !seen.has(name.toLowerCase())) {
                seen.add(name.toLowerCase());
                uniqueWhs.push({ _id: w._id, whName: name });
            }
        });
        return uniqueWhs.filter(w =>
            w.whName.toLowerCase().includes((warehouseSearch || '').toLowerCase())
        );
    };

    const getFilteredProducts = () => {
        return products.filter(p =>
            (p.name || '').toLowerCase().includes((productSearch || '').toLowerCase())
        );
    };

    const getFilteredBrands = (pIdx) => {
        const targetIdx = pIdx !== undefined ? pIdx : activeItemIndex;
        if (targetIdx === null) return [];
        const item = formData.items[targetIdx];
        if (!item?.productId) return [];
        const selectedProduct = products.find(p => p._id === item.productId);
        if (!selectedProduct) return [];
        const brandsSet = new Set();
        if (selectedProduct.brand) brandsSet.add(selectedProduct.brand);
        if (selectedProduct.brands && Array.isArray(selectedProduct.brands)) {
            selectedProduct.brands.forEach(b => { if (b.brand) brandsSet.add(b.brand); });
        }
        return [...brandsSet].filter(Boolean).filter(b =>
            b.toLowerCase().includes((brandSearch || '').toLowerCase())
        );
    };

    const handleProductSelect = (product, pIdx) => {
        const targetIdx = pIdx !== undefined ? pIdx : activeItemIndex;
        if (targetIdx === null) return;
        const updated = [...formData.items];
        updated[targetIdx] = {
            ...updated[targetIdx],
            productId: product._id,
            productName: product.name || '',
            brandEntries: [{ brand: '', brandName: '', warehouseId: '', warehouseName: '', packetSize: '', packet: '', quantity: '', rate: '', amount: '' }]
        };
        setFormData({ ...formData, items: updated });
        setProductSearch('');
        setActiveDropdown(null);
        setHighlightedIndex(-1);
    };

    const handleBrandSelect = (brandName, pIdx, bIdx) => {
        const targetPIdx = pIdx !== undefined ? pIdx : activeItemIndex;
        const targetBIdx = bIdx !== undefined ? bIdx : activeEntryIndex;
        if (targetPIdx === null || targetBIdx === null) return;
        const brandNameStr = typeof brandName === 'string' ? brandName : (brandName?.brand || brandName?.brandName || '');
        const updated = [...formData.items];
        const selectedProduct = products.find(p => p._id === updated[targetPIdx]?.productId);
        const selectedBrandObj = selectedProduct?.brands?.find(b => b.brand === brandNameStr);
        const packetSize = selectedBrandObj?.packetSize || selectedProduct?.packetSize || '';
        updated[targetPIdx].brandEntries[targetBIdx] = {
            ...updated[targetPIdx].brandEntries[targetBIdx],
            brand: brandNameStr,
            brandName: brandNameStr,
            packetSize: packetSize
        };
        setFormData({ ...formData, items: updated });
        setBrandSearch('');
        setActiveDropdown(null);
        setHighlightedIndex(-1);
    };

    const handleWarehouseSelect = (warehouse, pIdx, bIdx) => {
        const targetPIdx = pIdx !== undefined ? pIdx : activeItemIndex;
        const targetBIdx = bIdx !== undefined ? bIdx : activeEntryIndex;
        if (targetPIdx === null || targetBIdx === null) return;
        const updated = [...formData.items];
        updated[targetPIdx].brandEntries[targetBIdx] = {
            ...updated[targetPIdx].brandEntries[targetBIdx],
            warehouseId: warehouse._id,
            warehouseName: warehouse.whName
        };
        setFormData({ ...formData, items: updated });
        setWarehouseSearch('');
        setActiveDropdown(null);
        setHighlightedIndex(-1);
    };

    // Calculate Warehouse Stock (Warehouse Qty) automatically
    useEffect(() => {
        if (!formData.items || formData.items.length === 0) return;
        let hasChanges = false;
        const newItems = formData.items.map(item => {
            let itemChanged = false;
            const newBrandEntries = item.brandEntries.map(entry => {
                let updatedEntry = { ...entry };
                if (entry.warehouseName) {
                    let totalWhQty = 0;
                    warehouses.forEach(w => {
                        const wName = (w.whName || w.warehouse || '').toLowerCase().trim();
                        const targetWh = (entry.warehouseName || '').toLowerCase().trim();
                        const wProd = (w.productName || w.product || '').toLowerCase().trim();
                        const targetProd = (item.productName || '').toLowerCase().trim();
                        const wBrand = (w.brand || '').toLowerCase().trim();
                        const targetBrand = (entry.brandName || entry.brand || '').toLowerCase().trim();

                        const brandMatches = !targetBrand || wBrand === targetBrand;
                        if (wName === targetWh && wProd === targetProd && brandMatches) {
                            totalWhQty += parseFloat(w.whQty) || 0;
                        }
                    });

                    stockRecords.forEach(record => {
                        const rName = (record.warehouse || record.whName || '').toLowerCase().trim();
                        const targetWh = (entry.warehouseName || '').toLowerCase().trim();
                        const rProd = (record.productName || record.product || '').toLowerCase().trim();
                        const targetProd = (item.productName || '').toLowerCase().trim();
                        const rBrand = (record.brand || '').toLowerCase().trim();
                        const targetBrand = (entry.brandName || entry.brand || '').toLowerCase().trim();

                        if (['requested', 'rejected'].includes((record.status || '').toLowerCase())) return;

                        const brandMatches = !targetBrand || rBrand === targetBrand;
                        if (rName === targetWh && rProd === targetProd && brandMatches) {
                            totalWhQty += parseFloat(record.inHouseQuantity) || 0;
                        }
                    });

                    allSalesRecords.forEach(s => {
                        const sStatus = (s.status || '').toLowerCase();
                        if (sStatus !== 'accepted' && sStatus !== 'pending') return;
                        if (s.items) {
                            s.items.forEach(si => {
                                const sProdName = (si.productName || '').toLowerCase().trim();
                                const tProdName = (item.productName || '').toLowerCase().trim();
                                if (sProdName === tProdName && si.brandEntries) {
                                    si.brandEntries.forEach(be => {
                                        const sBrandName = (be.brand || be.brandName || '').toLowerCase().trim();
                                        const tBrandName = (entry.brandName || entry.brand || '').toLowerCase().trim();
                                        const sWhName = (be.warehouseName || '').toLowerCase().trim();
                                        const tWhName = (entry.warehouseName || '').toLowerCase().trim();

                                        const brandMatches = !tBrandName ? true : (sBrandName === tBrandName || ((sBrandName === '' || sBrandName === '-') && tBrandName === tProdName));
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
                } else {
                    if (updatedEntry.warehouseQty !== '0') {
                        updatedEntry.warehouseQty = '0';
                        itemChanged = true;
                    }
                }
                return updatedEntry;
            });
            if (itemChanged) hasChanges = true;
            return { ...item, brandEntries: newBrandEntries };
        });
        if (hasChanges) {
            setFormData(prev => ({ ...prev, items: newItems }));
        }
    }, [formData.items.map(i => i.productName).join(','), formData.items.map(i => i.brandEntries.map(e => `${e.brandName}-${e.brand}-${e.warehouseName}`).join(',')).join('|'), stockRecords, warehouses, allSalesRecords]);

    const handleCustomerSelect = (customer) => {
        if (!customer) {
            setFormData(prev => ({
                ...prev,
                companyName: '',
                customerName: '',
                address: '',
                phone: ''
            }));
            setCompanyNameSearch('');
            setActiveDropdown(null);
            setHighlightedIndex(-1);
            return;
        }

        const compName = customer.companyName || customer.customerName || '';
        const custName = customer.customerName || customer.companyName || '';
        const addr = customer.address || '';
        const ph = customer.contact || customer.phone || '';

        setFormData(prev => ({
            ...prev,
            companyName: compName,
            customerName: custName,
            address: addr,
            phone: ph
        }));

        setCompanyNameSearch(compName);
        setActiveDropdown(null);
        setHighlightedIndex(-1);
    };

    const handleDropdownKeyDown = (e, filteredOptions, onSelect) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
                onSelect(filteredOptions[highlightedIndex]);
            } else if (filteredOptions.length > 0) {
                onSelect(filteredOptions[0]);
            } else {
                setActiveDropdown(null);
            }
        } else if (e.key === 'Escape') {
            setActiveDropdown(null);
            setHighlightedIndex(-1);
        }
    };

    // Auto-generate Order Invoice Number (fills missing sequence numbers e.g. ORD0002 if ORD0001 & ORD0003 exist)
    const generateInvoiceNo = () => {
        const numbers = [];
        let maxDigits = 4;
        allSalesRecords.forEach(s => {
            const inv = s.orderNo || s.invoiceNo || '';
            if (typeof inv === 'string' && inv.toUpperCase().startsWith('ORD')) {
                const match = inv.match(/\d+/);
                if (match) {
                    numbers.push(parseInt(match[0], 10));
                    if (match[0].length > maxDigits) {
                        maxDigits = match[0].length;
                    }
                }
            }
        });

        const setOfNums = new Set(numbers);
        let nextNum = 1;
        while (setOfNums.has(nextNum)) {
            nextNum++;
        }
        return `ORD${nextNum.toString().padStart(maxDigits, '0')}`;
    };

    // --- Handlers for Sorting ---
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

    // --- Item Calculation Helpers ---
    const calculateItemTotals = (brandEntries) => {
        return (brandEntries || []).reduce((acc, be) => {
            const qty = parseFloat(be.quantity) || 0;
            const rate = parseFloat(be.rate) || 0;
            const amt = parseFloat(be.amount) || (qty * rate);
            const pkt = parseFloat(be.packet) || 0;
            return {
                totalQty: acc.totalQty + qty,
                totalAmt: acc.totalAmt + amt,
                totalPkt: acc.totalPkt + pkt
            };
        }, { totalQty: 0, totalAmt: 0, totalPkt: 0 });
    };

    const calculateOrderTotal = (items) => {
        return (items || []).reduce((sum, item) => {
            const { totalAmt } = calculateItemTotals(item.brandEntries);
            return sum + totalAmt;
        }, 0);
    };

    // Form Action Handlers
    const handleOpenCreateForm = () => {
        setEditingId(null);
        setCompanyNameSearch('');
        setFormData({
            ...initialFormState,
            date: new Date().toISOString().split('T')[0],
            invoiceNo: ''
        });
        setShowForm(true);
    };

    const handleEdit = (sale) => {
        setEditingId(sale._id);
        setOriginalData(sale);
        const comp = sale.companyName || sale.customerName || '';
        setCompanyNameSearch(comp);
        const ordId = sale.orderNo || sale.invoiceNo || generateInvoiceNo();
        setFormData({
            date: sale.date || new Date().toISOString().split('T')[0],
            invoiceNo: ordId,
            orderNo: ordId,
            companyName: comp,
            customerName: sale.customerName || comp,
            phone: sale.phone || '',
            address: sale.address || '',
            notes: sale.notes || '',
            status: sale.status || 'Requested',
            saleType: 'Order',
            items: sale.items && sale.items.length > 0 ? sale.items : initialFormState.items
        });
        setShowForm(true);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.companyName && !formData.customerName) {
            alert('Please enter Company or Customer Name');
            return;
        }

        setIsSubmitting(true);
        try {
            const finalInvoiceNo = editingId ? (formData.invoiceNo || generateInvoiceNo()) : generateInvoiceNo();
            const totalAmount = calculateOrderTotal(formData.items);
            const isAdminUser = currentUser?.username === 'admin' || (currentUser?.role || '').toLowerCase() === 'admin';
            const origStatus = (originalData?.status || '').toLowerCase();
            const isAcceptedEdit = editingId && origStatus !== 'requested';

            const payload = {
                date: formData.date,
                invoiceNo: finalInvoiceNo,
                orderNo: finalInvoiceNo,
                companyName: formData.companyName || formData.customerName,
                customerName: formData.customerName || formData.companyName,
                phone: formData.phone,
                address: formData.address,
                notes: formData.notes,
                status: formData.status,
                saleType: 'Order',
                uom: 'QTY',
                items: formData.items,
                totalAmount: totalAmount,
                isEdited: (editingId && !isAdminUser && isAcceptedEdit) ? true : false
            };

            if (editingId) {
                await axios.put(`${API_BASE_URL}/api/sales/${editingId}`, payload);
                if (addNotification) addNotification(`Order ${finalInvoiceNo} updated successfully!`, 'success');
            } else {
                await axios.post(`${API_BASE_URL}/api/sales`, payload);
                if (addNotification) addNotification(`New Order ${finalInvoiceNo} created!`, 'success');
            }

            setShowForm(false);
            fetchOrders();
            if (fetchSalesGlobal) fetchSalesGlobal();
            if (refreshPendingIndicators) refreshPendingIndicators();
        } catch (err) {
            console.error('Error saving order:', err);
            alert('Failed to save order. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatusUpdate = async (order, newStatus) => {
        try {
            const payload = {
                ...order,
                status: newStatus
            };
            await axios.put(`${API_BASE_URL}/api/sales/${order._id}`, payload);
            if (addNotification) {
                addNotification(`Order ${order.invoiceNo || order.orderNo} ${newStatus.toLowerCase()} successfully!`, 'success');
            }
            fetchOrders();
            if (fetchSalesGlobal) fetchSalesGlobal();
            if (refreshPendingIndicators) refreshPendingIndicators();
        } catch (err) {
            console.error(`Error updating order status to ${newStatus}:`, err);
            alert('Failed to update order status');
        }
    };

    const handleDeleteOrder = (sale) => {
        if (onDeleteConfirm) {
            onDeleteConfirm({
                type: 'sales',
                id: sale._id,
                isBulk: false,
                extraData: { invoiceNo: sale.invoiceNo || sale.orderNo }
            });
        }
    };

    // Nested Item Updates (2-way vice-versa calculation between Bag/Pkt & Qty kg)
    const updateBrandEntry = (pIdx, bIdx, field, value) => {
        const updatedItems = [...formData.items];
        const item = { ...updatedItems[pIdx] };
        const brand = { ...item.brandEntries[bIdx], [field]: value };

        const pktSize = parseFloat(field === 'packetSize' ? value : brand.packetSize) || 30;

        if (field === 'packet') {
            const pkt = parseFloat(value) || 0;
            if (pktSize > 0 && value !== '') {
                const calcQty = (pkt * pktSize);
                brand.quantity = Number.isInteger(calcQty) ? calcQty.toString() : calcQty.toFixed(2);
            } else if (value === '') {
                brand.quantity = '';
            }
        } else if (field === 'quantity') {
            const qty = parseFloat(value) || 0;
            if (pktSize > 0 && value !== '') {
                const calcPkt = (qty / pktSize);
                brand.packet = Number.isInteger(calcPkt) ? calcPkt.toString() : calcPkt.toFixed(2);
            } else if (value === '') {
                brand.packet = '';
            }
        } else if (field === 'packetSize') {
            if (pktSize > 0) {
                const qty = parseFloat(brand.quantity);
                const pkt = parseFloat(brand.packet);
                if (!isNaN(qty) && qty > 0) {
                    const calcPkt = (qty / pktSize);
                    brand.packet = Number.isInteger(calcPkt) ? calcPkt.toString() : calcPkt.toFixed(2);
                } else if (!isNaN(pkt) && pkt > 0) {
                    const calcQty = (pkt * pktSize);
                    brand.quantity = Number.isInteger(calcQty) ? calcQty.toString() : calcQty.toFixed(2);
                }
            }
        }

        const qty = parseFloat(brand.quantity) || 0;
        const bag = parseFloat(brand.packet) || 0;
        const rate = parseFloat(field === 'rate' ? value : brand.rate) || 0;
        const uom = item.uom || 'QTY';

        if (uom === 'BAG') {
            brand.amount = (bag * rate).toFixed(2);
        } else {
            brand.amount = (qty * rate).toFixed(2);
        }

        updatedItems[pIdx].brandEntries[bIdx] = brand;
        setFormData({ ...formData, items: updatedItems });
    };

    const addProductItem = () => {
        setFormData({
            ...formData,
            items: [
                ...formData.items,
                {
                    productName: '',
                    uom: 'QTY',
                    brandEntries: [{ brand: '', packetSize: '30', packet: '', quantity: '', rate: '', amount: '' }]
                }
            ]
        });
    };

    const removeProductItem = (pIdx) => {
        if (formData.items.length <= 1) return;
        setFormData({
            ...formData,
            items: formData.items.filter((_, idx) => idx !== pIdx)
        });
    };

    const addBrandEntry = (pIdx) => {
        const updated = [...formData.items];
        updated[pIdx].brandEntries.push({ brand: '', warehouseName: '', packetSize: '30', packet: '', quantity: '', rate: '', amount: '' });
        setFormData({ ...formData, items: updated });
    };

    const removeBrandEntry = (pIdx, bIdx) => {
        const updated = [...formData.items];
        if (updated[pIdx].brandEntries.length <= 1) return;
        updated[pIdx].brandEntries = updated[pIdx].brandEntries.filter((_, idx) => idx !== bIdx);
        setFormData({ ...formData, items: updated });
    };

    const toggleRowCollapse = (id) => {
        setCollapsedRows(prev =>
            prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
        );
    };

    // Filter Logic matching Order records only
    const getFilteredData = useMemo(() => {
        let result = sales.filter(sale => {
            const sType = (sale.saleType || '').toLowerCase();
            const inv = (sale.invoiceNo || sale.orderNo || '').toUpperCase();
            const isOrder = sType === 'order' || inv.startsWith('ORD');
            if (!isOrder) return false;

            const statusLower = (sale.status || '').toLowerCase();
            if (statusLower === 'rejected') return false;

            const isReq = statusLower === 'requested';
            const isEditReq = sale.isEdited === true && !isReq;

            if (isRequestedOnly) {
                if (!isReq) return false;
            } else if (isEditRequestedOnly) {
                if (!isEditReq) return false;
            } else {
                if (isReq || isEditReq) return false;
            }

            // Quick Date Range Filter
            if (saleFilters.quickRange && saleFilters.quickRange !== 'all' && saleFilters.quickRange !== 'custom') {
                const now = new Date();
                const recordDate = new Date(sale.date);
                if (!isNaN(recordDate.getTime())) {
                    if (saleFilters.quickRange === 'weekly') {
                        const dayOfWeek = now.getDay();
                        const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
                        const weekStart = new Date(now);
                        weekStart.setDate(now.getDate() + diffToMonday);
                        weekStart.setHours(0, 0, 0, 0);
                        const weekEnd = new Date(weekStart);
                        weekEnd.setDate(weekStart.getDate() + 6);
                        weekEnd.setHours(23, 59, 59, 999);
                        if (recordDate < weekStart || recordDate > weekEnd) return false;
                    } else if (saleFilters.quickRange === 'monthly') {
                        const month = saleFilters.selectedMonth || (now.getMonth() + 1);
                        const year = saleFilters.selectedYear || now.getFullYear();
                        if (recordDate.getMonth() + 1 !== parseInt(month) || recordDate.getFullYear() !== parseInt(year)) return false;
                    } else if (saleFilters.quickRange === 'yearly') {
                        const year = saleFilters.selectedYear || now.getFullYear();
                        if (recordDate.getFullYear() !== parseInt(year)) return false;
                    }
                }
            } else if (saleFilters.quickRange === 'custom') {
                const saleDate = (sale.date || '').split('T')[0];
                if (saleFilters.startDate && saleDate < saleFilters.startDate) return false;
                if (saleFilters.endDate && saleDate > saleFilters.endDate) return false;
            }

            // Field Filters
            if (saleFilters.companyName && (sale.companyName || sale.customerName || '').toLowerCase() !== saleFilters.companyName.toLowerCase()) return false;
            if (saleFilters.invoiceNo && (sale.invoiceNo || sale.orderNo || '').toLowerCase() !== saleFilters.invoiceNo.toLowerCase()) return false;

            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const inv = (sale.invoiceNo || sale.orderNo || '').toLowerCase();
                const cust = (sale.companyName || sale.customerName || '').toLowerCase();
                return inv.includes(q) || cust.includes(q);
            }

            return true;
        });

        // Sorting
        return result.sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];

            if (sortConfig.key === 'totalAmount') {
                aVal = calculateOrderTotal(a.items);
                bVal = calculateOrderTotal(b.items);
            } else if (sortConfig.key === 'companyName' || sortConfig.key === 'customerName') {
                aVal = (a.companyName || a.customerName || '').toLowerCase();
                bVal = (b.companyName || b.customerName || '').toLowerCase();
            } else if (sortConfig.key === 'invoiceNo') {
                aVal = (a.invoiceNo || a.orderNo || '').toLowerCase();
                bVal = (b.invoiceNo || b.orderNo || '').toLowerCase();
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [sales, isRequestedOnly, isEditRequestedOnly, saleFilters, searchQuery, sortConfig]);

    // Counters for Toggle Pills
    const requestedCount = useMemo(() => {
        return sales.filter(s => {
            const sType = (s.saleType || '').toLowerCase();
            const inv = (s.invoiceNo || s.orderNo || '').toUpperCase();
            const isOrder = sType === 'order' || inv.startsWith('ORD');
            return isOrder && (s.status || '').toLowerCase() === 'requested';
        }).length;
    }, [sales]);

    const editRequestedCount = useMemo(() => {
        return sales.filter(s => {
            const sType = (s.saleType || '').toLowerCase();
            const inv = (s.invoiceNo || s.orderNo || '').toUpperCase();
            const isOrder = sType === 'order' || inv.startsWith('ORD');
            return isOrder && s.isEdited === true && (s.status || '').toLowerCase() !== 'requested';
        }).length;
    }, [sales]);

    // Metric Summary Statistics matching General Sale
    const stats = useMemo(() => {
        const filtered = getFilteredData;
        let totalVal = 0;
        let totalDisc = 0;
        let totalPaid = 0;
        let totalDue = 0;
        let totalQty = 0;
        let totalPkt = 0;

        filtered.forEach(sale => {
            const saleAmt = parseFloat(sale.totalAmount) || calculateOrderTotal(sale.items);
            const disc = parseFloat(sale.discount) || 0;
            const paid = parseFloat(sale.paidAmount) || 0;
            const due = !isNaN(parseFloat(sale.dueAmount)) ? parseFloat(sale.dueAmount) : Math.max(0, saleAmt - paid);

            totalVal += saleAmt;
            totalDisc += disc;
            totalPaid += paid;
            totalDue += due;

            (sale.items || []).forEach(item => {
                const { totalQty: q, totalPkt: p } = calculateItemTotals(item.brandEntries);
                totalQty += q;
                totalPkt += p;
            });
        });

        return {
            totalOrders: filtered.length,
            totalSales: totalVal,
            totalDiscount: totalDisc,
            totalPaid: totalPaid,
            totalDue: totalDue,
            totalQty: totalQty,
            totalPkt: totalPkt
        };
    }, [getFilteredData]);

    const hasActiveFilters = useMemo(() => {
        return Object.entries(saleFilters).some(([key, val]) => {
            if (key === 'quickRange') return val !== 'all' && val !== 'custom' && val !== '';
            if (key === 'selectedMonth' || key === 'selectedYear') return false;
            return val !== '';
        });
    }, [saleFilters]);

    return (
        <div className="sale-management-container">
            {/* Module Header */}
            <div className="sale-mgmt-header">
                <div className="w-full md:w-auto">
                    <h2 className="sale-mgmt-title">Order Management</h2>
                </div>

                {!showForm && (
                    <div className="flex-1 w-full max-w-none md:max-w-md mx-auto flex flex-col items-center gap-2">
                        <div className="sale-mgmt-search-container group w-full relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                autoComplete="off"
                                type="text"
                                placeholder="Search order no, customer..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="sale-mgmt-search-input"
                            />
                        </div>

                        {/* Order Request Toggle Pills */}
                        <div className="flex items-center gap-2">
                            {canViewOrderRequest && (
                                <button
                                    onClick={() => {
                                        setIsRequestedOnly(!isRequestedOnly);
                                        setIsEditRequestedOnly(false);
                                    }}
                                    className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${isRequestedOnly ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600'}`}
                                >
                                    Requested
                                    {requestedCount > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center px-1 rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-pulse border-2 border-white">
                                            {requestedCount}
                                        </span>
                                    )}
                                </button>
                            )}

                            {canViewEditRequest && (
                                <button
                                    onClick={() => {
                                        setIsEditRequestedOnly(!isEditRequestedOnly);
                                        setIsRequestedOnly(false);
                                    }}
                                    className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${isEditRequestedOnly ? 'bg-amber-600 border-amber-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-600'}`}
                                >
                                    Edit Request
                                    {editRequestedCount > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center px-1 rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-sm animate-pulse border-2 border-white">
                                            {editRequestedCount}
                                        </span>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {!showForm && (
                    <div className="grid grid-cols-2 md:flex items-center justify-center md:justify-end gap-1.5 md:gap-3 z-50 w-full md:w-auto">
                        {/* Filter Button */}
                        <div className="relative">
                            <button
                                ref={saleFilterButtonRef}
                                onClick={() => setShowSaleFilterPanel(prev => !prev)}
                                className={`sale-mgmt-btn-action ${showSaleFilterPanel || hasActiveFilters ? 'sale-mgmt-btn-blue' : 'sale-mgmt-btn-white'}`}
                            >
                                <FunnelIcon className="w-5 h-5" />
                                <span>Filter</span>
                                {hasActiveFilters && (
                                    <span className="flex items-center justify-center w-4 h-4 text-[10px] font-black bg-white text-blue-600 rounded-full ml-1">
                                        !
                                    </span>
                                )}
                            </button>

                            {/* Advance Filter Dropdown */}
                            {showSaleFilterPanel && (
                                <>
                                    <div
                                        className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-2xl z-[55]"
                                        onClick={() => setShowSaleFilterPanel(false)}
                                    />
                                    <div ref={saleFilterRef} className={`fixed inset-x-4 top-20 md:absolute md:inset-auto md:right-0 md:mt-3 w-auto md:w-[450px] bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[60] p-4 md:p-6 animate-in fade-in zoom-in duration-200 ${activeFilterDropdown ? 'overflow-visible' : 'max-h-[85vh] overflow-y-auto custom-scrollbar'}`}>
                                        {/* Filter Header */}
                                        <div className="flex items-center justify-between mb-5 pb-2 border-b border-gray-100">
                                            <h4 className="font-extrabold text-gray-900 text-lg">Advance Filter</h4>
                                            <button
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    setSaleFilters({ quickRange: 'monthly', selectedMonth: new Date().getMonth() + 1, selectedYear: new Date().getFullYear(), startDate: '', endDate: '', companyName: '', invoiceNo: '', port: '', productName: '', brand: '', indCnf: '', bdCnf: '' });
                                                    setSaleFilterSearch({ companySearch: '', invoiceSearch: '', portSearch: '', productSearch: '', brandSearch: '', indCnfSearch: '', bdCnfSearch: '' });
                                                    setActiveFilterDropdown(null);
                                                }}
                                                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest transition-colors"
                                            >
                                                RESET ALL
                                            </button>
                                        </div>

                                        <div className="space-y-5">
                                            {/* Show Bag Control */}
                                            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                                <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">SHOW BAG</span>
                                                <div className="flex items-center gap-1.5 bg-gray-100/80 p-1 rounded-xl border border-gray-200/60">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowBag(true)}
                                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${showBag ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                                    >
                                                        Enable
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowBag(false)}
                                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${!showBag ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                                    >
                                                        Disable
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Quick Range */}
                                            <div className="space-y-2 text-center">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">FILTER BY RANGE</label>
                                                <div className="flex flex-wrap justify-center gap-2">
                                                    {['all', 'weekly', 'monthly', 'yearly'].map(range => (
                                                        <button
                                                            key={range}
                                                            type="button"
                                                            onClick={() => setSaleFilters(prev => ({ ...prev, quickRange: range, startDate: '', endDate: '' }))}
                                                            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${saleFilters.quickRange === range ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                                        >
                                                            {range.charAt(0).toUpperCase() + range.slice(1)}
                                                        </button>
                                                    ))}
                                                </div>
                                                {/* Month & Year dropdown for monthly */}
                                                {saleFilters.quickRange === 'monthly' && (
                                                    <div className="flex items-center justify-center gap-2 mt-2">
                                                        <select
                                                            value={saleFilters.selectedMonth || new Date().getMonth() + 1}
                                                            onChange={(e) => setSaleFilters(prev => ({ ...prev, selectedMonth: parseInt(e.target.value) }))}
                                                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                                        >
                                                            {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                                                                <option key={i+1} value={i+1}>{m}</option>
                                                            ))}
                                                        </select>
                                                        <select
                                                            value={saleFilters.selectedYear || new Date().getFullYear()}
                                                            onChange={(e) => setSaleFilters(prev => ({ ...prev, selectedYear: parseInt(e.target.value) }))}
                                                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                                        >
                                                            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                                                <option key={y} value={y}>{y}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                                {/* Year dropdown for yearly */}
                                                {saleFilters.quickRange === 'yearly' && (
                                                    <div className="flex items-center justify-center gap-2 mt-2">
                                                        <select
                                                            value={saleFilters.selectedYear || new Date().getFullYear()}
                                                            onChange={(e) => setSaleFilters(prev => ({ ...prev, selectedYear: parseInt(e.target.value) }))}
                                                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                                        >
                                                            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                                                <option key={y} value={y}>{y}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Date Range Row */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div ref={saleFromDateFilterRef}>
                                                    <CustomDatePicker
                                                        label="From Date"
                                                        value={saleFilters.startDate}
                                                        onChange={(e) => setSaleFilters(prev => ({ ...prev, startDate: e.target.value, quickRange: 'custom' }))}
                                                        compact={true}
                                                        isOpen={activeFilterDropdown === 'from'}
                                                        onToggle={(val) => setActiveFilterDropdown(val ? 'from' : null)}
                                                    />
                                                </div>
                                                <div ref={saleToDateFilterRef}>
                                                    <CustomDatePicker
                                                        label="To Date"
                                                        value={saleFilters.endDate}
                                                        onChange={(e) => setSaleFilters(prev => ({ ...prev, endDate: e.target.value, quickRange: 'custom' }))}
                                                        compact={true}
                                                        rightAlign={true}
                                                        isOpen={activeFilterDropdown === 'to'}
                                                        onToggle={(val) => setActiveFilterDropdown(val ? 'to' : null)}
                                                    />
                                                </div>
                                            </div>

                                            {/* Customer / Party Name Filter */}
                                            <div className="space-y-1.5 relative" ref={saleCompanyFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">CUSTOMER / PARTY NAME</label>
                                                <div className="relative">
                                                    <input
                                                        autoComplete="off"
                                                        type="text"
                                                        value={saleFilterSearch.companySearch}
                                                        onChange={(e) => {
                                                            setSaleFilterSearch(prev => ({ ...prev, companySearch: e.target.value }));
                                                            setSaleFilters(prev => ({ ...prev, companyName: e.target.value }));
                                                            setActiveFilterDropdown('company');
                                                        }}
                                                        onFocus={() => setActiveFilterDropdown('company')}
                                                        placeholder={saleFilters.companyName || 'Search customer...'}
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

                                            {/* Product Name Filter */}
                                            <div className="space-y-1.5 relative" ref={saleProductFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">PRODUCT NAME</label>
                                                <div className="relative">
                                                    <input
                                                        autoComplete="off"
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
                                                    const options = [...new Set(products.map(p => p.name || p.productName).concat(sales.flatMap(s => (s.items || []).map(i => i.productName))).filter(Boolean))].sort();
                                                    const filtered = options.filter(name => name.toLowerCase().includes((saleFilterSearch.productSearch || '').toLowerCase()));
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(name => (
                                                                <button key={name} type="button" onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, productName: name })); setSaleFilterSearch(prev => ({ ...prev, productSearch: name })); setActiveFilterDropdown(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">
                                                                    {name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>

                                            {/* Brand Filter */}
                                            <div className="space-y-1.5 relative" ref={saleBrandFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">BRAND</label>
                                                <div className="relative">
                                                    <input
                                                        autoComplete="off"
                                                        type="text"
                                                        value={saleFilterSearch.brandSearch}
                                                        onChange={(e) => {
                                                            setSaleFilterSearch(prev => ({ ...prev, brandSearch: e.target.value }));
                                                            setSaleFilters(prev => ({ ...prev, brand: e.target.value }));
                                                            setActiveFilterDropdown('brand');
                                                        }}
                                                        onFocus={() => setActiveFilterDropdown('brand')}
                                                        placeholder={saleFilters.brand || 'Search brand...'}
                                                        className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${saleFilters.brand ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {saleFilters.brand && (
                                                            <button onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, brand: '' })); setSaleFilterSearch(prev => ({ ...prev, brandSearch: '' })); setActiveFilterDropdown(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {activeFilterDropdown === 'brand' && (() => {
                                                    const options = [...new Set(sales.flatMap(s => (s.items || []).flatMap(i => (i.brandEntries || []).map(b => b.brand))).filter(Boolean))].sort();
                                                    const filtered = options.filter(b => b.toLowerCase().includes((saleFilterSearch.brandSearch || '').toLowerCase()));
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(b => (
                                                                <button key={b} type="button" onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, brand: b })); setSaleFilterSearch(prev => ({ ...prev, brandSearch: b })); setActiveFilterDropdown(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">
                                                                    {b}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Report Button */}
                        <button
                            onClick={() => {
                                if (setSalesReportData) setSalesReportData(getFilteredData);
                                if (setSalesReportSearchQuery) setSalesReportSearchQuery(searchQuery);
                                if (setShowSalesReport) setShowSalesReport(true);
                            }}
                            className="sale-mgmt-btn-action sale-mgmt-btn-white"
                        >
                            <BarChartIcon className="w-5 h-5" />
                            <span>Report</span>
                        </button>

                        {/* Add Order Button */}
                        {canAdd && (
                            <button
                                onClick={handleOpenCreateForm}
                                className="sale-mgmt-btn-action sale-mgmt-btn-blue"
                            >
                                <span className="flex items-center gap-2"><span className="text-xl leading-none">+</span> Add Order</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Summary Cards matching General Sale */}
            {!showForm && (
                <div className="sale-mgmt-summary-grid">
                    <div className="sale-mgmt-card sale-mgmt-card-default">
                        <div className="sale-mgmt-card-label text-gray-400">Total Sales</div>
                        <div className="sale-mgmt-card-value text-gray-900">৳ {stats.totalSales.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="sale-mgmt-card sale-mgmt-card-red">
                        <div className="sale-mgmt-card-label text-red-600">Total Disc.</div>
                        <div className="sale-mgmt-card-value text-red-700">৳ {stats.totalDiscount.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="sale-mgmt-card sale-mgmt-card-emerald">
                        <div className="sale-mgmt-card-label text-emerald-600">Total Paid</div>
                        <div className="sale-mgmt-card-value text-emerald-700">৳ {stats.totalPaid.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="sale-mgmt-card sale-mgmt-card-orange">
                        <div className="sale-mgmt-card-label text-orange-600">Total Balance</div>
                        <div className="sale-mgmt-card-value text-orange-700">৳ {stats.totalDue.toLocaleString('en-IN')}</div>
                    </div>
                </div>
            )}

            {/* Form Container matching General Sale */}
            {showForm && (
                <div className="sale-mgmt-form-container">
                    <div className="sale-mgmt-form-header">
                        <h3 className="sale-mgmt-form-title">{editingId ? 'Edit Order Entry' : 'New Order Entry'}</h3>
                        <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <form
                        onSubmit={handleFormSubmit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                                e.preventDefault();
                            }
                        }}
                        autoComplete="off"
                        className="space-y-6 relative z-10"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <CustomDatePicker
                                label="Date"
                                name="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                compact={true}
                            />

                            {/* Company Name Searchable Dropdown */}
                            <div className="sale-mgmt-input-group relative company-dropdown-container">
                                <label className="sale-mgmt-label">Company Name</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        required
                                        placeholder={formData.companyName || "Search company..."}
                                        value={activeDropdown === 'companyName' ? companyNameSearch : formData.companyName}
                                        onChange={(e) => {
                                            setCompanyNameSearch(e.target.value);
                                            setActiveDropdown('companyName');
                                            setHighlightedIndex(-1);
                                            setFormData(prev => ({ ...prev, companyName: e.target.value }));
                                        }}
                                        onFocus={() => {
                                            setCompanyNameSearch(formData.companyName || '');
                                            setActiveDropdown('companyName');
                                            setHighlightedIndex(-1);
                                        }}
                                        onKeyDown={(e) => handleDropdownKeyDown(e, getFilteredCustomers(), handleCustomerSelect)}
                                        autoComplete="off"
                                        className="sale-mgmt-input pr-12"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                        {formData.companyName && (
                                            <button
                                                type="button"
                                                onClick={() => handleCustomerSelect(null)}
                                                className="text-gray-400 hover:text-red-500"
                                            >
                                                <XIcon className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setActiveDropdown(activeDropdown === 'companyName' ? null : 'companyName')}
                                            className="text-gray-400 hover:text-blue-500 transition-colors"
                                        >
                                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'companyName' ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>
                                </div>

                                {activeDropdown === 'companyName' && getFilteredCustomers().length > 0 && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                        {getFilteredCustomers().map((c, idx) => (
                                            <button
                                                key={c._id || `cust-${idx}`}
                                                type="button"
                                                onMouseDown={(e) => { e.preventDefault(); handleCustomerSelect(c); }}
                                                onClick={() => handleCustomerSelect(c)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{c.companyName || c.customerName}</span>
                                                    {(c.contact || c.phone || c.address) && (
                                                        <span className="text-[11px] text-gray-400 font-normal">
                                                            {[c.contact || c.phone, c.address].filter(Boolean).join(' • ')}
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Customer Name Field */}
                            <div className="sale-mgmt-input-group">
                                <label className="sale-mgmt-label">Customer Name</label>
                                <input
                                    autoComplete="off"
                                    type="text"
                                    placeholder="Customer name..."
                                    value={formData.customerName}
                                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                    className="sale-mgmt-input"
                                />
                            </div>

                            <div className="sale-mgmt-input-group">
                                <label className="sale-mgmt-label">Address</label>
                                <input
                                    autoComplete="off"
                                    type="text"
                                    placeholder="Address..."
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="sale-mgmt-input"
                                />
                            </div>

                            <div className="sale-mgmt-input-group">
                                <label className="sale-mgmt-label">Phone</label>
                                <input
                                    autoComplete="off"
                                    type="text"
                                    placeholder="Phone number..."
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="sale-mgmt-input"
                                />
                            </div>
                        </div>

                        {/* Items Section */}
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <label className="sale-mgmt-label text-sm font-bold text-gray-900 mb-0">Order Items</label>
                                <button
                                    type="button"
                                    onClick={addProductItem}
                                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-2"
                                >
                                    <span className="text-lg">+</span> Add Product
                                </button>
                            </div>

                            <div className="space-y-8">
                            {formData.items.map((item, pIdx) => (
                                <div key={pIdx} className="sale-mgmt-product-card group/item relative">
                                    {/* Remove Product */}
                                    {formData.items.length > 1 && (
                                        <button type="button" onClick={() => removeProductItem(pIdx)} className="absolute -top-3 -right-3 p-2.5 bg-white text-gray-400 hover:text-red-500 rounded-xl shadow-lg border border-gray-100 opacity-0 group-hover/item:opacity-100 transition-all z-20">
                                            ×
                                        </button>
                                    )}

                                    {/* Product Name + UOM Row */}
                                    <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6 px-4">
                                        <div className="space-y-1.5 relative flex-1 product-dropdown-container">
                                            <label className="sale-mgmt-item-label">Product</label>
                                            <div className="relative">
                                                <input
                                                    autoComplete="off"
                                                    type="text"
                                                    required
                                                    placeholder="Select Product"
                                                    value={activeDropdown === 'product' && activeItemIndex === pIdx ? productSearch : (item.productName || '')}
                                                    onChange={(e) => {
                                                        setProductSearch(e.target.value);
                                                        setActiveDropdown('product');
                                                        setActiveItemIndex(pIdx);
                                                        setHighlightedIndex(-1);
                                                    }}
                                                    onFocus={() => {
                                                        setProductSearch(item.productName || '');
                                                        setActiveDropdown('product');
                                                        setActiveItemIndex(pIdx);
                                                        setHighlightedIndex(-1);
                                                    }}
                                                    onKeyDown={(e) => handleDropdownKeyDown(e, getFilteredProducts(), (p) => handleProductSelect(p, pIdx))}
                                                    className={`sale-mgmt-input pr-14 ${item.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {item.productName && (
                                                        <button type="button" onClick={() => { const u = [...formData.items]; u[pIdx].productName = ''; u[pIdx].productId = ''; setFormData({ ...formData, items: u }); setProductSearch(''); }} className="text-gray-400 hover:text-red-500">
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button type="button" onClick={() => { setActiveDropdown(activeDropdown === 'product' && activeItemIndex === pIdx ? null : 'product'); setActiveItemIndex(pIdx); }} className="text-gray-300 hover:text-blue-500 transition-colors">
                                                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'product' && activeItemIndex === pIdx ? 'rotate-180' : ''}`} />
                                                    </button>
                                                </div>
                                            </div>
                                            {activeDropdown === 'product' && activeItemIndex === pIdx && getFilteredProducts().length > 0 && (
                                                <div className="absolute z-[70] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                                    {getFilteredProducts().map((p, idx) => (
                                                        <button key={p._id || `prod-${idx}`} type="button" onMouseDown={(e) => { e.preventDefault(); handleProductSelect(p, pIdx); }} onClick={() => handleProductSelect(p, pIdx)} onMouseEnter={() => setHighlightedIndex(idx)}
                                                            className={`w-full px-4 py-2.5 text-left text-sm transition-colors font-medium ${item.productName === p.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}>
                                                            {p.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                         {/* UOM Toggle */}
                                        <div className="space-y-1.5 flex-1 md:max-w-[200px]">
                                            <label className="sale-mgmt-item-label">UOM</label>
                                            <div className="flex items-center bg-gray-50/50 p-1 rounded-xl border border-gray-100/50 h-10 shadow-inner">
                                                <button type="button" onClick={() => {
                                                    const u = [...formData.items];
                                                    u[pIdx].uom = 'QTY';
                                                    u[pIdx].brandEntries = u[pIdx].brandEntries.map(be => {
                                                        const q = parseFloat(be.quantity) || 0;
                                                        const r = parseFloat(be.rate) || 0;
                                                        return { ...be, amount: (q * r).toFixed(2) };
                                                    });
                                                    setFormData({ ...formData, items: u });
                                                }}
                                                    className={`flex-1 h-full flex items-center justify-center rounded-lg text-xs font-black transition-all duration-200 ${item.uom === 'QTY' || !item.uom ? 'bg-white text-blue-600 shadow-md ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}>QTY</button>
                                                <button type="button" onClick={() => {
                                                    const u = [...formData.items];
                                                    u[pIdx].uom = 'BAG';
                                                    u[pIdx].brandEntries = u[pIdx].brandEntries.map(be => {
                                                        const b = parseFloat(be.packet) || 0;
                                                        const r = parseFloat(be.rate) || 0;
                                                        return { ...be, amount: (b * r).toFixed(2) };
                                                    });
                                                    setFormData({ ...formData, items: u });
                                                }}
                                                    className={`flex-1 h-full flex items-center justify-center rounded-lg text-xs font-black transition-all duration-200 ${item.uom === 'BAG' ? 'bg-white text-blue-600 shadow-md ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}>BAG</button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Brand Entries Table */}
                                    <div className="space-y-1">
                                        {/* Column Headers */}
                                        <div className="hidden md:grid grid-cols-12 gap-3 px-6 py-1">
                                            <div className="col-span-2 sale-mgmt-item-label text-center">Brand</div>
                                            <div className="col-span-2 sale-mgmt-item-label text-center">Warehouse</div>
                                            <div className="sale-mgmt-item-label text-center">Wh Stock</div>
                                            <div className="sale-mgmt-item-label text-center">Pkt Size</div>
                                            <div className="sale-mgmt-item-label text-center">Bag / Pkt</div>
                                            <div className="sale-mgmt-item-label text-center">Qty (kg)</div>
                                            <div className="sale-mgmt-item-label text-center">Rate (৳)</div>
                                            <div className="col-span-2 sale-mgmt-item-label text-center">Total</div>
                                            <div></div>
                                        </div>

                                        {item.brandEntries.map((be, bIdx) => (
                                            <div key={bIdx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center px-6 group/entry hover:bg-gray-50/50 rounded-xl py-1.5 border border-transparent hover:border-gray-100/50 relative transition-all">

                                                {/* Brand Searchable Dropdown */}
                                                <div className="col-span-2 relative brand-dropdown-container">
                                                    <label className="md:hidden sale-mgmt-item-label mb-1 block">Brand</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            placeholder={be.brandName || "Brand"}
                                                            value={activeDropdown === 'brand' && activeItemIndex === pIdx && activeEntryIndex === bIdx ? brandSearch : (be.brandName || '')}
                                                            onChange={(e) => { setBrandSearch(e.target.value); setActiveDropdown('brand'); setActiveItemIndex(pIdx); setActiveEntryIndex(bIdx); setHighlightedIndex(-1); updateBrandEntry(pIdx, bIdx, 'brandName', e.target.value); }}
                                                            onFocus={() => { setActiveDropdown('brand'); setActiveItemIndex(pIdx); setActiveEntryIndex(bIdx); setBrandSearch(be.brandName || ''); setHighlightedIndex(-1); }}
                                                            onKeyDown={(e) => handleDropdownKeyDown(e, getFilteredBrands(pIdx), (b) => handleBrandSelect(b, pIdx, bIdx))}
                                                            autoComplete="off"
                                                            className={`sale-mgmt-input !text-xs pr-8 ${be.brandName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                                        />
                                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                                                            {be.brandName && (<button type="button" onClick={() => { updateBrandEntry(pIdx, bIdx, 'brand', ''); updateBrandEntry(pIdx, bIdx, 'brandName', ''); setBrandSearch(''); }} className="text-gray-400 hover:text-red-500"><XIcon className="w-3 h-3" /></button>)}
                                                            <button type="button" onClick={() => { setActiveDropdown(activeDropdown === 'brand' && activeItemIndex === pIdx && activeEntryIndex === bIdx ? null : 'brand'); setActiveItemIndex(pIdx); setActiveEntryIndex(bIdx); }} className="text-gray-300 hover:text-blue-500 transition-colors">
                                                                <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'brand' && activeItemIndex === pIdx && activeEntryIndex === bIdx ? 'rotate-180' : ''}`} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {activeDropdown === 'brand' && activeItemIndex === pIdx && activeEntryIndex === bIdx && getFilteredBrands(pIdx).length > 0 && (
                                                        <div className="absolute z-[70] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                                            {getFilteredBrands(pIdx).map((b, idx) => (
                                                                <button key={idx} type="button" onMouseDown={(e) => { e.preventDefault(); handleBrandSelect(b, pIdx, bIdx); }} onClick={() => handleBrandSelect(b, pIdx, bIdx)} onMouseEnter={() => setHighlightedIndex(idx)}
                                                                    className={`w-full px-3 py-1.5 text-left text-xs font-medium transition-colors ${be.brandName === b ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}>
                                                                    {b}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Warehouse Searchable Dropdown */}
                                                <div className="col-span-2 relative warehouse-dropdown-container">
                                                    <label className="md:hidden sale-mgmt-item-label mb-1 block">Warehouse</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            placeholder={be.warehouseName || "Warehouse"}
                                                            value={activeDropdown === 'warehouse' && activeItemIndex === pIdx && activeEntryIndex === bIdx ? warehouseSearch : (be.warehouseName || '')}
                                                            onChange={(e) => { setWarehouseSearch(e.target.value); setActiveDropdown('warehouse'); setActiveItemIndex(pIdx); setActiveEntryIndex(bIdx); setHighlightedIndex(-1); updateBrandEntry(pIdx, bIdx, 'warehouseName', e.target.value); }}
                                                            onFocus={() => { setActiveDropdown('warehouse'); setActiveItemIndex(pIdx); setActiveEntryIndex(bIdx); setWarehouseSearch(be.warehouseName || ''); setHighlightedIndex(-1); }}
                                                            onKeyDown={(e) => handleDropdownKeyDown(e, getFilteredWarehouses(), (w) => handleWarehouseSelect(w, pIdx, bIdx))}
                                                            autoComplete="off"
                                                            className={`sale-mgmt-input !text-xs pr-8 ${be.warehouseName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                                        />
                                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                                                            {be.warehouseName && (<button type="button" onClick={() => { updateBrandEntry(pIdx, bIdx, 'warehouseName', ''); updateBrandEntry(pIdx, bIdx, 'warehouseId', ''); setWarehouseSearch(''); }} className="text-gray-400 hover:text-red-500"><XIcon className="w-3 h-3" /></button>)}
                                                            <button type="button" onClick={() => { setActiveDropdown(activeDropdown === 'warehouse' && activeItemIndex === pIdx && activeEntryIndex === bIdx ? null : 'warehouse'); setActiveItemIndex(pIdx); setActiveEntryIndex(bIdx); }} className="text-gray-300 hover:text-blue-500 transition-colors">
                                                                <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'warehouse' && activeItemIndex === pIdx && activeEntryIndex === bIdx ? 'rotate-180' : ''}`} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {activeDropdown === 'warehouse' && activeItemIndex === pIdx && activeEntryIndex === bIdx && getFilteredWarehouses().length > 0 && (
                                                        <div className="absolute z-[70] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1">
                                                            {getFilteredWarehouses().map((w, idx) => (
                                                                <button key={w._id || `wh-${idx}`} type="button" onMouseDown={(e) => { e.preventDefault(); handleWarehouseSelect(w, pIdx, bIdx); }} onClick={() => handleWarehouseSelect(w, pIdx, bIdx)} onMouseEnter={() => setHighlightedIndex(idx)}
                                                                    className={`w-full px-3 py-1.5 text-left text-xs font-medium transition-colors ${be.warehouseName === w.whName ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}>
                                                                    {w.whName}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Wh Stock (Warehouse Qty) */}
                                                <div>
                                                    <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Wh Stock</label>
                                                    <div className="w-full h-10 flex items-center justify-center bg-white/50 border border-gray-200/60 rounded-lg text-[13px] font-bold text-gray-900">
                                                        {be.warehouseQty || '0'}
                                                    </div>
                                                </div>
                                                {/* Packet Size */}
                                                <div>
                                                    <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Pkt Size</label>
                                                    <input autoComplete="off" type="number" placeholder="30" value={be.packetSize} onChange={(e) => updateBrandEntry(pIdx, bIdx, 'packetSize', e.target.value)} className="sale-mgmt-input !px-2 !text-[13px] font-bold text-center" />
                                                </div>

                                                {/* Bag / Pkt */}
                                                <div>
                                                    <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Bag / Pkt</label>
                                                    <input autoComplete="off" type="number" placeholder="0" value={be.packet} onChange={(e) => updateBrandEntry(pIdx, bIdx, 'packet', e.target.value)} className="sale-mgmt-input !px-2 !text-[13px] font-bold text-blue-600 text-center" />
                                                </div>

                                                {/* Qty */}
                                                <div>
                                                    <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Qty (kg)</label>
                                                    <input autoComplete="off" type="number" required placeholder="0" value={be.quantity} onChange={(e) => updateBrandEntry(pIdx, bIdx, 'quantity', e.target.value)} className="sale-mgmt-input !px-2 !text-[13px] font-black text-orange-700 text-center" />
                                                </div>

                                                {/* Rate */}
                                                <div>
                                                    <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Rate (৳)</label>
                                                    <input autoComplete="off" type="number" placeholder="0" value={be.rate} onChange={(e) => updateBrandEntry(pIdx, bIdx, 'rate', e.target.value)} className="sale-mgmt-input !px-2 !text-[13px] font-bold text-center" />
                                                </div>

                                                {/* Total + Actions */}
                                                <div className="col-span-2 flex items-center gap-2">
                                                    <div className="flex-1">
                                                        <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Total</label>
                                                        <div className="h-10 flex items-center justify-center bg-white/50 border border-gray-200/60 rounded-lg text-[13px] font-black text-blue-600">
                                                            {Math.round(parseFloat(be.amount) || 0).toLocaleString('en-US')}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-row gap-1 items-center">
                                                        {bIdx === item.brandEntries.length - 1 && (
                                                            <button type="button" onClick={() => addBrandEntry(pIdx)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Add Brand">
                                                                <span className="text-xl font-bold">+</span>
                                                            </button>
                                                        )}
                                                        {item.brandEntries.length > 1 && (
                                                            <button type="button" onClick={() => removeBrandEntry(pIdx, bIdx)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all">×</button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                            <span className="font-bold text-blue-900 text-sm">Total Order Value:</span>
                            <span className="text-xl font-black text-blue-950">
                                ৳{Math.round(calculateOrderTotal(formData.items)).toLocaleString('en-US')}
                            </span>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                                Remark
                            </label>
                            <input
                                type="text"
                                name="notes"
                                value={formData.notes || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Enter remark..."
                                className="sale-mgmt-input w-full"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg text-sm"
                            >
                                {isSubmitting ? 'Saving...' : editingId ? 'Update Order' : 'Save Order'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Table Container matching General Sale */}
            {!showForm && (
                <div className="sale-mgmt-table-container">
                    <div className="overflow-x-auto">
                        <table className="sale-mgmt-table">
                            <thead>
                                <tr>
                                    <th className="sale-mgmt-th text-center">SL</th>
                                    <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('date')}>
                                        <div className="flex items-center">Date {renderSortIcon('date')}</div>
                                    </th>
                                    <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('invoiceNo')}>
                                        <div className="flex items-center justify-center">Order No {renderSortIcon('invoiceNo')}</div>
                                    </th>
                                    <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('companyName')}>
                                        <div className="flex items-center">Customer {renderSortIcon('companyName')}</div>
                                    </th>
                                    <th className="sale-mgmt-th">Product</th>
                                    <th className="sale-mgmt-th">Brand</th>
                                    <th className="sale-mgmt-th">Warehouse</th>
                                    {showBag && <th className="sale-mgmt-th text-center font-bold">Order Bag</th>}
                                    <th className="sale-mgmt-th text-center font-bold">Quantity</th>
                                    <th className="sale-mgmt-th text-center font-bold">Rate</th>
                                    <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('totalAmount')}>
                                        <div className="flex items-center justify-center">Total {renderSortIcon('totalAmount')}</div>
                                    </th>
                                    <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('status')}>
                                        <div className="flex items-center justify-center">Status {renderSortIcon('status')}</div>
                                    </th>
                                    <th className="sale-mgmt-th text-center">Actions</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-50">
                                {isLoading ? (
                                    <tr><td colSpan="13" className="px-3 py-20 text-center text-gray-400 font-medium">Loading orders...</td></tr>
                                ) : getFilteredData.length === 0 ? (
                                    <tr><td colSpan="13" className="px-3 py-20 text-center text-gray-400 font-medium">No order records found</td></tr>
                                ) : getFilteredData.map((order, index) => {
                                    const { totalQty, totalAmt, totalPkt } = (order.items || []).reduce((acc, item) => {
                                        const { totalQty: q, totalAmt: a, totalPkt: p } = calculateItemTotals(item.brandEntries);
                                        return { totalQty: acc.totalQty + q, totalAmt: acc.totalAmt + a, totalPkt: acc.totalPkt + p };
                                    }, { totalQty: 0, totalAmt: 0, totalPkt: 0 });

                                    const st = (order.status || '').toLowerCase();
                                    const isRequested = st === 'requested';

                                    return (
                                        <tr key={order._id} className="hover:bg-blue-50/50 transition-all group border-b border-gray-50 last:border-0 align-middle">
                                            <td className="px-3 py-4 text-center">
                                                <span className="text-gray-400 font-medium">{index + 1}</span>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap">
                                                <div className="text-[13px] font-medium text-gray-600">{formatDate(order.date)}</div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                <div className="text-[13px] font-semibold text-blue-600">
                                                    {(order.orderNo && order.orderNo.toUpperCase().startsWith('ORD')) ? order.orderNo : (order.invoiceNo && order.invoiceNo.toUpperCase().startsWith('ORD')) ? order.invoiceNo : (order.orderNo || order.invoiceNo || '-')}
                                                </div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap">
                                                <div className="text-[13px] font-semibold text-gray-800">{order.companyName || order.customerName || '-'}</div>
                                            </td>

                                            <td className="px-3 py-4">
                                                <div className="flex flex-col gap-1">
                                                    {(order.items || []).map((item, i) => (
                                                        <div key={i} className="text-[13px] font-semibold text-gray-800">{item.productName || '-'}</div>
                                                    ))}
                                                </div>
                                            </td>

                                            <td className="px-3 py-4">
                                                <div className="flex flex-col gap-1">
                                                    {(order.items || []).map((item, i) => (
                                                        <div key={i} className="text-[13px] font-medium text-gray-600">
                                                            {(item.brandEntries || []).map(b => b.brandName || b.brand).filter(Boolean).join(', ') || '-'}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>

                                            <td className="px-3 py-4">
                                                <div className="flex flex-col gap-1">
                                                    {(order.items || []).map((item, i) => (
                                                        <div key={i} className="text-[13px] font-medium text-gray-600">
                                                            {(item.brandEntries || []).map(b => b.warehouseName || b.warehouse).filter(Boolean).join(', ') || '-'}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>

                                            {showBag && (
                                                <td className="px-3 py-4 whitespace-nowrap text-center">
                                                    <div className="text-[13px] font-bold text-purple-700">
                                                        {Math.round(totalPkt).toLocaleString('en-US')} Bag
                                                    </div>
                                                </td>
                                            )}

                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                <div className="text-[13px] font-bold text-orange-800">
                                                    {Math.round(totalQty).toLocaleString('en-US')} kg
                                                </div>
                                            </td>

                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                <div className="flex flex-col gap-1">
                                                    {(order.items || []).map((item, i) => (
                                                        <div key={i} className="text-[13px] font-bold text-gray-700">
                                                            {(item.brandEntries || []).map(b => b.rate ? `৳${parseFloat(b.rate).toLocaleString('en-US')}` : '-').join(', ') || '-'}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>

                                            <td className="px-3 py-4 whitespace-nowrap text-center font-black text-emerald-700">
                                                ৳{Math.round(totalAmt).toLocaleString('en-US')}
                                            </td>

                                            <td className="px-3 py-4 text-center whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${isRequested ? 'bg-amber-50 text-amber-700 border border-amber-200/60' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'}`}>
                                                    {isRequested ? 'Requested' : (order.status || 'Accepted')}
                                                </span>
                                            </td>

                                            <td className="px-3 py-4 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => setViewRecord(order)}
                                                        className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                                                        title="View Details"
                                                    >
                                                        <EyeIcon className="w-5 h-5" />
                                                    </button>
                                                    {canEdit && (
                                                        <button
                                                            onClick={() => handleEdit(order)}
                                                            className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                                                            title="Edit Order"
                                                        >
                                                            <EditIcon className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                    {isRequested && canApprove && (
                                                        <>
                                                            <button
                                                                onClick={() => handleStatusUpdate(order, 'Accepted')}
                                                                className="text-gray-400 hover:text-emerald-600 transition-colors p-1"
                                                                title="Accept Order"
                                                            >
                                                                <CheckIcon className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleStatusUpdate(order, 'Rejected')}
                                                                className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                                                title="Reject Order"
                                                            >
                                                                <XIcon className="w-5 h-5" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {canDelete && (
                                                        <button
                                                            onClick={() => handleDeleteOrder(order)}
                                                            className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                                            title="Delete Order"
                                                        >
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* View Order Modal */}
            {viewRecord && (
                <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setViewRecord(null)}></div>
                    <div className="relative bg-white border border-gray-100 rounded-3xl shadow-2xl max-w-2xl w-full p-6 md:p-8 animate-in zoom-in duration-200">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                            <div>
                                <h3 className="text-xl font-black text-gray-900">Order Details - {viewRecord.invoiceNo || viewRecord.orderNo}</h3>
                                <p className="text-xs text-gray-500 font-medium">Date: {formatDate(viewRecord.date)}</p>
                            </div>
                            <button onClick={() => setViewRecord(null)} className="text-gray-400 hover:text-gray-600">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Customer Info</div>
                                <div className="text-base font-bold text-gray-900 mt-1">{viewRecord.companyName || viewRecord.customerName}</div>
                                {viewRecord.phone && <div className="text-xs text-gray-600 mt-0.5">Phone: {viewRecord.phone}</div>}
                            </div>

                            <div className="space-y-2">
                                <div className="text-xs font-bold text-gray-500 uppercase">Items Breakdown</div>
                                {(viewRecord.items || []).map((item, idx) => (
                                    <div key={idx} className="p-3 bg-white border border-gray-100 rounded-xl space-y-2">
                                        <div className="font-bold text-gray-900 text-sm">{item.productName}</div>
                                        <div className="space-y-1">
                                            {(item.brandEntries || []).map((b, bIdx) => (
                                                <div key={bIdx} className="flex items-center justify-between text-xs text-gray-600 border-t border-gray-50 pt-1">
                                                    <span>Brand: <strong>{b.brand || '-'}</strong></span>
                                                    <span>{b.packet ? `${b.packet} Bag` : ''} ({b.quantity} kg)</span>
                                                    <span className="font-bold text-gray-900">৳{b.amount || (b.quantity * b.rate)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-xl border border-blue-100 mt-4">
                                <span className="font-bold text-blue-900 text-sm">Total Order Value:</span>
                                <span className="text-lg font-black text-blue-950">৳{Math.round(calculateOrderTotal(viewRecord.items)).toLocaleString('en-US')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrderManagement;
