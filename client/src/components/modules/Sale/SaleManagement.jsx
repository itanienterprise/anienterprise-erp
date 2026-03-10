import React, { useState, useEffect, useRef } from 'react';
import { EditIcon, TrashIcon, XIcon, SearchIcon, FunnelIcon, ChevronDownIcon, EyeIcon, ReceiptIcon, BarChartIcon, TrendingUpIcon, DollarSignIcon, FileTextIcon } from '../../Icons';
import { generateSaleInvoicePDF } from '../../../utils/pdfGenerator';
import { API_BASE_URL, SortIcon, formatDate } from '../../../utils/helpers';
import { encryptData, decryptData } from '../../../utils/encryption';
import CustomDatePicker from '../../shared/CustomDatePicker';
import './SaleManagement.css';

const SaleManagement = ({
    saleType,
    isSelectionMode,
    setIsSelectionMode,
    selectedItems,
    setSelectedItems,
    onDeleteConfirm,
    startLongPress,
    endLongPress,
    setShowSalesReport,
    saleFilters,
    setSaleFilters
}) => {
    const [showForm, setShowForm] = useState(false);
    const [sales, setSales] = useState([]);
    const [allSalesRecords, setAllSalesRecords] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [stockRecords, setStockRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [viewData, setViewData] = useState(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [expandedRows, setExpandedRows] = useState([]);
    const [showSaleFilterPanel, setShowSaleFilterPanel] = useState(false);
    const [saleFilterSearch, setSaleFilterSearch] = useState({ companySearch: '', invoiceSearch: '' });
    const [activeFilterDropdown, setActiveFilterDropdown] = useState(null); // 'from', 'to', 'company', 'invoice'
    const saleFilterRef = useRef(null);
    const saleFilterButtonRef = useRef(null);
    const saleCompanyFilterRef = useRef(null);
    const saleInvoiceFilterRef = useRef(null);

    const toggleRowExpansion = (saleId) => {
        setExpandedRows(prev =>
            prev.includes(saleId) ? prev.filter(id => id !== saleId) : [...prev, saleId]
        );
    };

    const hasActiveFilters = Object.values(saleFilters).some(v => v !== '');

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                showSaleFilterPanel &&
                saleFilterRef.current &&
                !saleFilterRef.current.contains(event.target) &&
                saleFilterButtonRef.current &&
                !saleFilterButtonRef.current.contains(event.target)
            ) {
                setShowSaleFilterPanel(false);
            }
            if (
                activeFilterDropdown &&
                saleFilterRef.current &&
                !saleFilterRef.current.contains(event.target)
            ) {
                // Determine if click was inside any specific filter container
                const inCompany = saleCompanyFilterRef.current?.contains(event.target);
                const inInvoice = saleInvoiceFilterRef.current?.contains(event.target);

                if (!inCompany && !inInvoice) {
                    setActiveFilterDropdown(null);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showSaleFilterPanel, activeFilterDropdown]);

    const [formData, setFormData] = useState({
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
                unitPrice: '',
                totalAmount: ''
            }]
        }],
        totalAmount: '0.00',
        discount: '0.00',
        paidAmount: '0.00',
        dueAmount: '0.00',
        paymentMethod: 'Cash',
        status: 'Pending',
        saleType: saleType, // Initialize with prop value
        previousBalance: '0.00'
    });

    useEffect(() => {
        fetchSales();
        fetchCustomers();
        fetchProducts();
        fetchWarehouses();
        fetchStockRecords();
    }, [saleType]); // Refetch if saleType changes

    const fetchSales = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/sales`);
            if (response.ok) {
                const rawData = await response.json();
                const decryptedSales = rawData.map(record => {
                    const decrypted = decryptData(record.data);
                    return { ...decrypted, _id: record._id, createdAt: record.createdAt };
                }).filter(Boolean);

                setAllSalesRecords(decryptedSales);

                // Filter by saleType. Match legacy records to 'General'.
                const filteredSales = decryptedSales.filter(s => {
                    if (saleType === 'General') {
                        return s.saleType === 'General' || !s.saleType;
                    }
                    return s.saleType === saleType;
                });

                setSales(filteredSales);
            }
        } catch (error) {
            console.error('Error fetching sales:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCustomers = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/customers`);
            if (response.ok) {
                const rawData = await response.json();
                const decryptedRes = rawData.map(record => {
                    const decrypted = decryptData(record.data);
                    return { ...decrypted, _id: record._id };
                });
                setCustomers(decryptedRes);
            }
        } catch (error) {
            console.error('Error fetching customers:', error);
        }
    };

    const fetchProducts = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/products`);
            if (response.ok) {
                const rawData = await response.json();
                const decryptedRes = rawData.map(record => {
                    const decrypted = decryptData(record.data);
                    return { ...decrypted, _id: record._id };
                });
                setProducts(decryptedRes);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };
    const fetchWarehouses = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/warehouses`);
            if (response.ok) {
                const rawData = await response.json();
                const decryptedRes = rawData.map(record => {
                    const decrypted = decryptData(record.data);
                    return { ...decrypted, _id: record._id };
                });
                setWarehouses(decryptedRes);
            }
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };
    const fetchStockRecords = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/stock`);
            if (response.ok) {
                const rawData = await response.json();
                const decryptedRes = rawData.map(record => {
                    try {
                        const decrypted = decryptData(record.data);
                        return { ...decrypted, _id: record._id };
                    } catch (err) {
                        return null;
                    }
                }).filter(Boolean);
                setStockRecords(decryptedRes);
            }
        } catch (error) {
            console.error('Error fetching stock records:', error);
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

                            if (rName === targetWh && rProd === targetProd && rBrand === targetBrand) {
                                totalWhQty += parseFloat(record.inHouseQuantity) || 0;
                            }
                        });

                        // Subtract ALL matching sales for this specific warehouse
                        allSalesRecords.forEach(s => {
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

                            if (rName === targetWh && rProd === targetProd) {
                                totalWhQty += parseFloat(record.inHouseQuantity) || 0;
                            }
                        });

                        // Subtract ALL matching sales for this warehouse (across all brands)
                        allSalesRecords.forEach(s => {
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
                // Border Sale: Total = Truck * Price
                if (name === 'truck' || name === 'unitPrice') {
                    const truck = parseFloat(name === 'truck' ? value : entry.truck) || 0;
                    const price = parseFloat(name === 'unitPrice' ? value : entry.unitPrice) || 0;
                    entry.totalAmount = (truck * price).toFixed(2);
                }
            } else {
                // General Sale: Total = Quantity * Price
                if (name === 'quantity' || name === 'unitPrice') {
                    const qty = parseFloat(name === 'quantity' ? value : entry.quantity) || 0;
                    const price = parseFloat(name === 'unitPrice' ? value : entry.unitPrice) || 0;
                    entry.totalAmount = (qty * price).toFixed(2);
                }
            }

            brandEntries[entryIdx] = entry;
            product.brandEntries = brandEntries;
            newItems[productIdx] = product;

            // Recalculate invoice totals
            const subtotal = newItems.reduce((sum, p) =>
                sum + p.brandEntries.reduce((eSum, e) => eSum + (parseFloat(e.totalAmount) || 0), 0)
                , 0);
            const disc = parseFloat(prev.discount) || 0;
            const paid = parseFloat(prev.paidAmount) || 0;
            const grandTotal = Math.max(0, subtotal - disc);

            return {
                ...prev,
                items: newItems,
                totalAmount: grandTotal.toFixed(2),
                dueAmount: (grandTotal - paid).toFixed(2)
            };
        });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let updatedFormData = { ...formData, [name]: value };

        if (name === 'paidAmount' || name === 'discount') {
            const subtotal = formData.items.reduce(
                (sum, i) => sum + (i.brandEntries || []).reduce((eSum, e) => eSum + (parseFloat(e.totalAmount) || 0), 0),
                0
            );
            const disc = parseFloat(name === 'discount' ? value : formData.discount) || 0;
            const paid = parseFloat(name === 'paidAmount' ? value : formData.paidAmount) || 0;

            const grandTotal = Math.max(0, subtotal - disc);
            updatedFormData.totalAmount = grandTotal.toFixed(2);
            updatedFormData.dueAmount = (grandTotal - paid).toFixed(2);
        }

        setFormData(updatedFormData);
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const url = editingId ? `${API_BASE_URL}/api/sales/${editingId}` : `${API_BASE_URL}/api/sales`;
            const encryptedPayload = { data: encryptData(formData) };
            const response = await fetch(url, {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(encryptedPayload),
            });

            if (response.ok) {
                setSubmitStatus('success');

                // Resolve Customer ID if missing but name is present
                let targetCustomerId = formData.customerId;
                if (!targetCustomerId && (formData.companyName || formData.customerName)) {
                    const matched = customers.find(c =>
                        (c.companyName && formData.companyName && c.companyName.trim().toLowerCase() === formData.companyName.trim().toLowerCase()) ||
                        (c.customerName && formData.customerName && c.customerName.trim().toLowerCase() === formData.customerName.trim().toLowerCase())
                    );
                    if (matched) targetCustomerId = matched._id;
                }

                // Update Customer History
                if (targetCustomerId) {
                    try {
                        const custRes = await fetch(`${API_BASE_URL}/api/customers/${targetCustomerId}`);
                        if (custRes.ok) {
                            const custRecord = await custRes.json();
                            const customer = decryptData(custRecord.data);

                            const newSaleEntries = [];
                            formData.items.forEach((product, pIdx) => {
                                (product.brandEntries || []).forEach((entry, eIdx) => {
                                    const isFirstEntry = pIdx === 0 && eIdx === 0;
                                    newSaleEntries.push({
                                        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                        date: formData.date,
                                        invoiceNo: formData.invoiceNo,
                                        product: product.productName || '',
                                        brand: entry.brand || '',
                                        quantity: entry.quantity || 0,
                                        amount: entry.totalAmount || 0,
                                        paid: isFirstEntry ? (parseFloat(formData.paidAmount) || 0) : 0,
                                        due: isFirstEntry ? (parseFloat(formData.dueAmount) || 0) : (entry.totalAmount || 0),
                                        discount: isFirstEntry ? (parseFloat(formData.discount) || 0) : 0,
                                        warehouse: entry.warehouseName || '',
                                        status: 'Pending'
                                    });
                                });
                            });

                            let baseHistory = customer.salesHistory || [];
                            // If editing, remove existing entries for this invoice to prevent duplicates
                            if (editingId) {
                                baseHistory = baseHistory.filter(item => item.invoiceNo !== formData.invoiceNo);
                            }

                            const updatedCustomer = {
                                ...customer,
                                salesHistory: [...newSaleEntries, ...baseHistory]
                            };

                            await fetch(`${API_BASE_URL}/api/customers/${targetCustomerId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ data: encryptData(updatedCustomer) }),
                            });
                        }
                    } catch (err) {
                        console.error('Error updating customer history:', err);
                    }
                }

                // Border Sale: Auto-deduct sold Qty from matching warehouse records
                if (formData.saleType === 'Border') {
                    try {
                        // Re-fetch latest warehouse data to avoid stale state
                        const whRes = await fetch(`${API_BASE_URL}/api/warehouses`);
                        if (whRes.ok) {
                            const rawWarehouses = await whRes.json();
                            const liveWarehouses = rawWarehouses.map(record => ({
                                ...decryptData(record.data),
                                _id: record._id
                            }));

                            // Build a map of warehouse updates needed: id -> qty to deduct
                            const deductions = {}; // { warehouseId: amountToDeduct }

                            formData.items.forEach(product => {
                                const soldProductName = (product.productName || '').trim().toLowerCase();
                                (product.brandEntries || []).forEach(entry => {
                                    const soldQty = parseFloat(entry.quantity) || 0;
                                    if (soldQty === 0) return;

                                    // Find matching warehouse record by product name
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

                            // Apply deductions and PUT each affected warehouse
                            await Promise.all(
                                Object.values(deductions).map(async ({ wh, totalDeduct }) => {
                                    const currentQty = parseFloat(wh.whQty) || 0;
                                    const updatedWh = {
                                        ...wh,
                                        whQty: Math.max(0, currentQty - totalDeduct).toString()
                                    };
                                    await fetch(`${API_BASE_URL}/api/warehouses/${wh._id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ data: encryptData(updatedWh) }),
                                    });
                                })
                            );
                        }
                    } catch (err) {
                        console.error('Error auto-deducting warehouse stock for Border Sale:', err);
                    }
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
                    unitPrice: '',
                    totalAmount: ''
                }]
            }],
            totalAmount: '0.00',
            discount: '0.00',
            paidAmount: '0.00',
            dueAmount: '0.00',
            paymentMethod: 'Cash',
            status: 'Pending',
            saleType: saleType,
            previousBalance: '0.00'
        });
        setCustomerSearch('');
        setProductSearch('');
        setCompanyNameSearch('');
        setActiveDropdown(null);
        setEditingId(null);
        setActiveItemIndex(null);
        setActiveEntryIndex(null);
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
                        unitPrice: item.unitPrice,
                        totalAmount: item.totalAmount
                    }]
                };
            });
        }

        setFormData({
            ...sale,
            items: initialItems,
            discount: sale.discount || '0.00',
            previousBalance: sale.previousBalance || '0.00'
        });
        setEditingId(sale._id);
        setShowForm(true);
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
        if (!searchQuery) return displayedSales;
        const query = searchQuery.toLowerCase();
        return displayedSales.filter(s => {
            const matchesBasic =
                s.invoiceNo?.toLowerCase().includes(query) ||
                s.customerName?.toLowerCase().includes(query) ||
                s.companyName?.toLowerCase().includes(query) ||
                s.productName?.toLowerCase().includes(query) ||
                s.brand?.toLowerCase().includes(query);

            if (matchesBasic) return true;

            // Search within items array
            if (s.items && Array.isArray(s.items)) {
                return s.items.some(item =>
                    item.productName?.toLowerCase().includes(query) ||
                    item.brand?.toLowerCase().includes(query)
                );
            }

            return false;
        });
    };

    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [companyNameSearch, setCompanyNameSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [brandSearch, setBrandSearch] = useState('');
    const [warehouseSearch, setWarehouseSearch] = useState('');

    // Handle outside clicks for dropdowns
    useEffect(() => {
        const handleClickOutside = (e) => {
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
    }, [activeDropdown]);

    const getFilteredCompanies = () => {
        return customers.filter(c =>
            (c.companyName || '').toLowerCase().includes(companyNameSearch.toLowerCase())
        );
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
            lcNo: customer.lcNo || '',
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
                lcNo: '',
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
        setFormData(prev => {
            const newItems = [...prev.items];
            const item = { ...newItems[activeItemIndex] };
            const brandEntries = [...item.brandEntries];
            brandEntries[activeEntryIndex] = {
                ...brandEntries[activeEntryIndex],
                brand: brand,
                brandName: brand // Ensure both are set for UI/Stock calculation
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
            <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 relative animate-scale-in custom-scrollbar">
                    <button onClick={() => setViewData(null)} className="absolute top-6 right-6 text-gray-400 hover:text-red-500 transition-colors bg-white/50 p-2 rounded-xl border border-gray-100 shadow-sm">
                        <XIcon className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-sm border border-blue-100">
                            <ReceiptIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 leading-tight">Sale Invoice Details</h2>
                            <p className="text-gray-500 font-medium tracking-tight mt-0.5">{viewData.invoiceNo || 'No Invoice Number'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10 p-6 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Transaction Date</span>
                            <div className="font-bold text-gray-900 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                {formatDate(viewData.date)}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Company Name</span>
                            <div className="font-bold text-gray-900 truncate" title={viewData.companyName}>{viewData.companyName || '-'}</div>
                        </div>
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Point of Contact</span>
                            <div className="font-bold text-gray-900">{viewData.customerName}</div>
                        </div>
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Payment Status</span>
                            <div className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${parseFloat(viewData.dueAmount) > 0 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${parseFloat(viewData.dueAmount) > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                                {parseFloat(viewData.dueAmount) > 0 ? 'Partial Payment' : 'Paid in Full'}
                            </div>
                        </div>
                    </div>

                    <div className="mb-10 overflow-hidden rounded-2xl border border-gray-100 shadow-sm bg-white">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Product Description</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Brand Information</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Qty (kg)</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Unit Price</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {viewData.items?.map((product, pIdx) => (
                                    <React.Fragment key={pIdx}>
                                        <tr className="bg-blue-50/10 transition-colors">
                                            <td className="px-6 py-3.5 font-bold text-blue-800 bg-blue-50/30 flex items-center gap-2" colSpan="5">
                                                <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
                                                {product.productName}
                                            </td>
                                        </tr>
                                        {product.brandEntries?.map((entry, eIdx) => (
                                            <tr key={eIdx} className="group hover:bg-gray-50/80 transition-all duration-200">
                                                <td className="px-6 py-4"></td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="text-[13px] font-bold text-gray-800">{entry.brand}</div>
                                                        <div className="text-[10px] font-bold text-blue-500 uppercase flex items-center gap-1">
                                                            <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                                                            {entry.warehouseName}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="text-[13px] font-black text-gray-900">{parseFloat(entry.quantity).toLocaleString()} kg</div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="text-[13px] font-semibold text-gray-500">৳{parseFloat(entry.unitPrice || 0).toLocaleString()}</div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="text-[14px] font-black text-blue-900 group-hover:scale-105 transition-transform origin-right">৳{parseFloat(entry.totalAmount || 0).toLocaleString()}</div>
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        <div className="p-5 bg-orange-50/50 rounded-2xl border border-orange-100/50 group hover:bg-orange-50 transition-colors">
                            <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1">Total Discount</div>
                            <div className="text-xl font-black text-orange-600 group-hover:scale-105 transition-transform origin-left">৳{parseFloat(viewData.discount || 0).toLocaleString()}</div>
                        </div>
                        <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 group hover:bg-emerald-50 transition-colors">
                            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Paid Amount</div>
                            <div className="text-xl font-black text-emerald-600 group-hover:scale-105 transition-transform origin-left">৳{parseFloat(viewData.paidAmount || 0).toLocaleString()}</div>
                        </div>
                        <div className="p-5 bg-blue-900 rounded-2xl border border-blue-800 shadow-xl shadow-blue-500/10 group overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -mr-12 -mt-12 blur-2xl"></div>
                            <div className="text-[10px] font-bold text-blue-300 uppercase tracking-wider mb-1 relative z-10">Grand Total Invoice</div>
                            <div className="text-2xl font-black text-white relative z-10 group-hover:scale-105 transition-transform origin-left">৳{parseFloat(viewData.totalAmount || 0).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Apply search + advanced filters
    const displayedSales = sales.filter(sale => {
        // Text search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const inv = (sale.invoiceNo || '').toLowerCase();
            const cname = (sale.companyName || sale.customerName || '').toLowerCase();
            if (!inv.includes(q) && !cname.includes(q)) return false;
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
        // Invoice
        if (saleFilters.invoiceNo) {
            const inv = (sale.invoiceNo || '').toLowerCase();
            if (!inv.includes(saleFilters.invoiceNo.toLowerCase())) return false;
        }
        return true;
    });

    const stats = {
        totalSales: displayedSales.reduce((sum, s) => sum + (parseFloat(s.totalAmount) || 0), 0),
        totalDiscount: displayedSales.reduce((sum, s) => sum + (parseFloat(s.discount) || 0), 0),
        totalPaid: displayedSales.reduce((sum, s) => sum + (parseFloat(s.paidAmount) || 0), 0),
        totalDue: displayedSales.reduce((sum, s) => sum + (parseFloat(s.dueAmount) || 0), 0)
    };

    return (
        <div className="sale-management-container">
            <div className="sale-mgmt-header">
                <div className="w-full md:w-auto">
                    <h2 className="sale-mgmt-title">{saleType} Sale Management</h2>
                </div>

                {!showForm && (
                    <div className="sale-mgmt-search-container group">
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
                )}

                {!showForm && (
                    <div className="flex items-center justify-end gap-2 md:gap-3 z-50 flex-nowrap">
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
                                        className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-[55]"
                                        onClick={() => setShowSaleFilterPanel(false)}
                                    />
                                    <div
                                        ref={saleFilterRef}
                                        className="fixed inset-x-4 top-24 md:absolute md:inset-auto md:right-0 md:mt-3 md:w-80 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[60] p-5 animate-in fade-in zoom-in duration-200"
                                    >
                                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                                            <h4 className="font-bold text-gray-900 tracking-tight">Advance Filter</h4>
                                            <button
                                                onClick={() => {
                                                    setSaleFilters({ startDate: '', endDate: '', companyName: '', invoiceNo: '' });
                                                    setSaleFilterSearch({ companySearch: '', invoiceSearch: '' });
                                                    setActiveFilterDropdown(null);
                                                }}
                                                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest"
                                            >
                                                RESET ALL
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Date Range */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <CustomDatePicker
                                                    label="From Date"
                                                    value={saleFilters.startDate}
                                                    onChange={(e) => setSaleFilters({ ...saleFilters, startDate: e.target.value })}
                                                    compact={true}
                                                    isOpen={activeFilterDropdown === 'from'}
                                                    onToggle={(val) => setActiveFilterDropdown(val ? 'from' : null)}
                                                />
                                                <CustomDatePicker
                                                    label="To Date"
                                                    value={saleFilters.endDate}
                                                    onChange={(e) => setSaleFilters({ ...saleFilters, endDate: e.target.value })}
                                                    compact={true}
                                                    rightAlign={true}
                                                    isOpen={activeFilterDropdown === 'to'}
                                                    onToggle={(val) => setActiveFilterDropdown(val ? 'to' : null)}
                                                />
                                            </div>

                                            {/* Company / Customer Name Filter */}
                                            <div className="space-y-1.5 relative" ref={saleCompanyFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">COMPANY NAME</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={saleFilterSearch.companySearch}
                                                        onChange={(e) => {
                                                            setSaleFilterSearch({ ...saleFilterSearch, companySearch: e.target.value });
                                                            setSaleFilters({ ...saleFilters, companyName: e.target.value });
                                                            setActiveFilterDropdown('company');
                                                        }}
                                                        onFocus={() => setActiveFilterDropdown('company')}
                                                        placeholder={saleFilters.companyName || 'Search company...'}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${saleFilters.companyName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'
                                                            }`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {saleFilters.companyName && (
                                                            <button
                                                                onClick={() => { setSaleFilters({ ...saleFilters, companyName: '' }); setSaleFilterSearch({ ...saleFilterSearch, companySearch: '' }); setActiveFilterDropdown(null); }}
                                                                className="text-gray-400 hover:text-gray-600"
                                                            >
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
                                                                <button
                                                                    key={c}
                                                                    type="button"
                                                                    onClick={() => { setSaleFilters({ ...saleFilters, companyName: c }); setSaleFilterSearch({ ...saleFilterSearch, companySearch: c }); setActiveFilterDropdown(null); }}
                                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                >
                                                                    {c}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>

                                            {/* Invoice No Filter */}
                                            <div className="space-y-1.5 relative" ref={saleInvoiceFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">INVOICE NUMBER</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={saleFilterSearch.invoiceSearch}
                                                        onChange={(e) => {
                                                            setSaleFilterSearch({ ...saleFilterSearch, invoiceSearch: e.target.value });
                                                            setSaleFilters({ ...saleFilters, invoiceNo: e.target.value });
                                                            setActiveFilterDropdown('invoice');
                                                        }}
                                                        onFocus={() => setActiveFilterDropdown('invoice')}
                                                        placeholder={saleFilters.invoiceNo || 'Search invoice...'}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${saleFilters.invoiceNo ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'
                                                            }`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {saleFilters.invoiceNo && (
                                                            <button
                                                                onClick={() => { setSaleFilters({ ...saleFilters, invoiceNo: '' }); setSaleFilterSearch({ ...saleFilterSearch, invoiceSearch: '' }); setActiveFilterDropdown(null); }}
                                                                className="text-gray-400 hover:text-gray-600"
                                                            >
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
                                                                <button
                                                                    key={inv}
                                                                    type="button"
                                                                    onClick={() => { setSaleFilters({ ...saleFilters, invoiceNo: inv }); setSaleFilterSearch({ ...saleFilterSearch, invoiceSearch: inv }); setActiveFilterDropdown(null); }}
                                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                >
                                                                    {inv}
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
                            onClick={() => setShowSalesReport(true)}
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
                <div className="sale-mgmt-summary-grid">
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
                        <div className="sale-mgmt-card-label text-orange-600">Total Due</div>
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
                            />
                            <div className="sale-mgmt-input-group">
                                <label className="sale-mgmt-label">Invoice No</label>
                                <input type="text" name="invoiceNo" value={formData.invoiceNo} onChange={handleInputChange} placeholder="SALE-001" className="sale-mgmt-input" required />
                            </div>
                            <div className="sale-mgmt-input-group">
                                <label className="sale-mgmt-label">LC No</label>
                                <input type="text" name="lcNo" value={formData.lcNo} onChange={handleInputChange} placeholder="LC-001" className="sale-mgmt-input" />
                            </div>
                            {/* Company Name Select */}
                            <div className="sale-mgmt-input-group relative company-dropdown-container">
                                <label className="sale-mgmt-label">Company Name</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder={formData.companyName || "Search company..."}
                                        value={companyNameSearch}
                                        onChange={(e) => {
                                            setCompanyNameSearch(e.target.value);
                                            setActiveDropdown('companyName');
                                            setHighlightedIndex(-1);
                                            setFormData(prev => ({ ...prev, companyName: e.target.value }));
                                        }}
                                        onFocus={() => { setActiveDropdown('companyName'); setHighlightedIndex(-1); }}
                                        onKeyDown={(e) => handleDropdownKeyDown(e, 'companyName', getFilteredCompanies(), handleCompanyNameSelect)}
                                        className={`sale-mgmt-input pr-14 ${formData.companyName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
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
                            <div className="sale-mgmt-input-group">
                                <label className="sale-mgmt-label">Customer</label>
                                <input type="text" name="customerName" value={formData.customerName} readOnly placeholder="Customer" className="sale-mgmt-input sale-mgmt-input-readonly" />
                            </div>
                            <div className="sale-mgmt-input-group">
                                <label className="sale-mgmt-label">Contact</label>
                                <input type="text" name="contact" value={formData.contact} readOnly placeholder="Contact" className="sale-mgmt-input sale-mgmt-input-readonly" />
                            </div>
                            {saleType === 'Border' && (
                                <>
                                    <div className="sale-mgmt-input-group">
                                        <label className="sale-mgmt-label">Importer</label>
                                        <input type="text" name="importer" value={formData.importer} onChange={handleInputChange} placeholder="Importer" className="sale-mgmt-input" />
                                    </div>
                                    <div className="sale-mgmt-input-group">
                                        <label className="sale-mgmt-label">Port</label>
                                        <input type="text" name="port" value={formData.port} onChange={handleInputChange} placeholder="Port" className="sale-mgmt-input" />
                                    </div>
                                    <div className="sale-mgmt-input-group">
                                        <label className="sale-mgmt-label">IND CNF</label>
                                        <input type="text" name="indianCnF" value={formData.indianCnF} onChange={handleInputChange} placeholder="IND CNF" className="sale-mgmt-input" />
                                    </div>
                                    <div className="sale-mgmt-input-group">
                                        <label className="sale-mgmt-label">BD CNF</label>
                                        <input type="text" name="bdCnf" value={formData.bdCnf} onChange={handleInputChange} placeholder="BD CNF" className="sale-mgmt-input" />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="col-span-2 space-y-6">
                            <div className="flex items-center justify-between">
                                <h4 className="text-base font-bold text-gray-800 flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                                    Product Details
                                </h4>
                                <button
                                    type="button"
                                    onClick={addProductItem}
                                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-2"
                                >
                                    <span className="text-lg">+</span> Add Product
                                </button>
                            </div>

                            <div className="space-y-8">
                                {formData.items.map((item, index) => (
                                    <div key={index} className="sale-mgmt-product-card group/item">
                                        {/* Remove Product Button */}
                                        {formData.items.length > 1 && (
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
                                                        onChange={(e) => {
                                                            setProductSearch(e.target.value);
                                                            setActiveDropdown('product');
                                                            setActiveItemIndex(index);
                                                            handleItemInputChange(index, null, { target: { name: 'productName', value: e.target.value } });
                                                        }}
                                                        onFocus={() => {
                                                            setActiveDropdown('product');
                                                            setActiveItemIndex(index);
                                                            setProductSearch(item.productName || '');
                                                        }}
                                                        className={`sale-mgmt-input pr-14 ${item.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
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
                                                    <div className="hidden md:grid grid-cols-5 gap-4 px-4">
                                                        <div className="sale-mgmt-item-label text-center">Warehouse</div>
                                                        <div className="sale-mgmt-item-label text-center">Qty</div>
                                                        <div className="sale-mgmt-item-label text-center">Truck</div>
                                                        <div className="sale-mgmt-item-label text-center">Price</div>
                                                        <div className="sale-mgmt-item-label text-center">Total</div>
                                                    </div>
                                                    {item.brandEntries.map((entry, entryIndex) => (
                                                        <div key={entryIndex} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center px-4">
                                                            {/* Warehouse Selection */}
                                                            <div className="relative warehouse-dropdown-container">
                                                                <label className="md:hidden sale-mgmt-item-label mb-1 block">Warehouse</label>
                                                                <input
                                                                    type="text"
                                                                    placeholder={entry.warehouseName || "Warehouse"}
                                                                    value={activeDropdown === 'warehouse' && activeItemIndex === index && activeEntryIndex === entryIndex ? warehouseSearch : ''}
                                                                    onChange={(e) => {
                                                                        setWarehouseSearch(e.target.value);
                                                                        setActiveDropdown('warehouse');
                                                                        setActiveItemIndex(index);
                                                                        setActiveEntryIndex(entryIndex);
                                                                        handleItemInputChange(index, entryIndex, { target: { name: 'warehouseName', value: e.target.value } });
                                                                    }}
                                                                    onFocus={() => {
                                                                        setActiveDropdown('warehouse');
                                                                        setActiveItemIndex(index);
                                                                        setActiveEntryIndex(entryIndex);
                                                                        setWarehouseSearch(entry.warehouseName || '');
                                                                    }}
                                                                    className={`sale-mgmt-input pr-9 !text-xs ${entry.warehouseName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                                                />
                                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                                    {entry.warehouseName ? (
                                                                        <button type="button" onClick={() => { handleWarehouseSelect({ _id: '', whName: '' }); setWarehouseSearch(''); }} className="text-gray-400 hover:text-red-500">
                                                                            <XIcon className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    ) : (
                                                                        <button type="button" onClick={() => { setActiveDropdown(activeDropdown === 'warehouse' && activeItemIndex === index && activeEntryIndex === entryIndex ? null : 'warehouse'); setActiveItemIndex(index); setActiveEntryIndex(entryIndex); }} className="text-gray-300 hover:text-blue-500 transition-colors">
                                                                            <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'warehouse' && activeItemIndex === index && activeEntryIndex === entryIndex ? 'rotate-180' : ''}`} />
                                                                        </button>
                                                                    )}
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
                                                            <div>
                                                                <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Qty</label>
                                                                <input type="number" name="quantity" value={entry.quantity} onChange={(e) => handleItemInputChange(index, entryIndex, e)} placeholder="0" className="sale-mgmt-input !px-2 !text-[13px] font-black text-gray-900 text-center" />
                                                            </div>
                                                            <div>
                                                                <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Truck</label>
                                                                <input type="number" name="truck" value={entry.truck || ''} onChange={(e) => handleItemInputChange(index, entryIndex, e)} placeholder="0" className="sale-mgmt-input !px-2 !text-[13px] font-bold text-gray-600 text-center" />
                                                            </div>
                                                            <div>
                                                                <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Price</label>
                                                                <input type="number" name="unitPrice" value={entry.unitPrice} onChange={(e) => handleItemInputChange(index, entryIndex, e)} placeholder="0" className="sale-mgmt-input !px-2 !text-[13px] font-bold text-gray-600 text-center" />
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1">
                                                                    <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Total</label>
                                                                    <div className="h-10 flex items-center justify-center bg-white/50 border border-gray-200/60 rounded-lg backdrop-blur-sm text-[13px] font-black text-blue-600">
                                                                        {parseFloat(entry.totalAmount || 0).toLocaleString()}
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-row gap-1 items-center justify-center">
                                                                    {entryIndex === item.brandEntries.length - 1 && (
                                                                        <button type="button" onClick={() => addBrandEntry(index)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all active:scale-90" title="Add Brand"><span className="text-xl font-bold">+</span></button>
                                                                    )}
                                                                    {item.brandEntries.length > 1 && (
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
                                                <div className="hidden md:grid grid-cols-9 gap-4 px-6 py-1 border border-transparent">
                                                    <div className="col-span-2 sale-mgmt-item-label text-center">Brand</div>
                                                    <div className="sale-mgmt-item-label text-center">Inhouse</div>
                                                    <div className="sale-mgmt-item-label text-center">Warehouse</div>
                                                    <div className="sale-mgmt-item-label text-center">Wh Stock</div>
                                                    <div className="sale-mgmt-item-label text-center">Qty</div>
                                                    <div className="sale-mgmt-item-label text-center">Price</div>
                                                    <div className="col-span-2 sale-mgmt-item-label text-center">Total</div>
                                                </div>

                                                {item.brandEntries.map((entry, entryIndex) => (
                                                    <div key={entryIndex} className="grid grid-cols-1 md:grid-cols-9 gap-4 items-center px-6 group/entry transition-all hover:bg-gray-50/50 rounded-xl py-1.5 border border-transparent hover:border-gray-100/50 relative">
                                                        {/* Brand Selection */}
                                                        <div className="col-span-2 space-y-1 relative brand-dropdown-container">
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block">Brand</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    placeholder={entry.brandName || "Brand"}
                                                                    value={activeDropdown === 'brand' && activeItemIndex === index && activeEntryIndex === entryIndex ? brandSearch : ''}
                                                                    onChange={(e) => {
                                                                        setBrandSearch(e.target.value);
                                                                        setActiveDropdown('brand');
                                                                        setActiveItemIndex(index);
                                                                        setActiveEntryIndex(entryIndex);
                                                                        handleItemInputChange(index, entryIndex, { target: { name: 'brandName', value: e.target.value } });
                                                                    }}
                                                                    onFocus={() => {
                                                                        setActiveDropdown('brand');
                                                                        setActiveItemIndex(index);
                                                                        setActiveEntryIndex(entryIndex);
                                                                        setBrandSearch(entry.brandName || '');
                                                                    }}
                                                                    className={`sale-mgmt-input pr-10 !text-xs ${entry.brandName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
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
                                                                        onChange={(e) => {
                                                                            setWarehouseSearch(e.target.value);
                                                                            setActiveDropdown('warehouse');
                                                                            setActiveItemIndex(index);
                                                                            setActiveEntryIndex(entryIndex);
                                                                            handleItemInputChange(index, entryIndex, { target: { name: 'warehouseName', value: e.target.value } });
                                                                        }}
                                                                        onFocus={() => {
                                                                            setActiveDropdown('warehouse');
                                                                            setActiveItemIndex(index);
                                                                            setActiveEntryIndex(entryIndex);
                                                                            setWarehouseSearch(entry.warehouseName || '');
                                                                        }}
                                                                        className={`sale-mgmt-input pr-10 !text-xs ${entry.warehouseName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
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

                                                        {/* Quantity */}
                                                        <div>
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Qty</label>
                                                            <input
                                                                type="number"
                                                                name="quantity"
                                                                value={entry.quantity}
                                                                onChange={(e) => handleItemInputChange(index, entryIndex, e)}
                                                                placeholder="0"
                                                                className="sale-mgmt-input !px-2 !text-[13px] font-black text-gray-900 text-center"
                                                            />
                                                        </div>

                                                        {/* Unit Price */}
                                                        <div>
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Price</label>
                                                            <input
                                                                type="number"
                                                                name="unitPrice"
                                                                value={entry.unitPrice}
                                                                onChange={(e) => handleItemInputChange(index, entryIndex, e)}
                                                                placeholder="0"
                                                                className="sale-mgmt-input !px-2 !text-[13px] font-bold text-gray-600 text-center"
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
                                                                {entryIndex === item.brandEntries.length - 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => addBrandEntry(index)}
                                                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded-full transition-all active:scale-95 hover:scale-110"
                                                                        title="Add Brand"
                                                                    >
                                                                        <span className="text-xl font-black">+</span>
                                                                    </button>
                                                                )}
                                                                {item.brandEntries.length > 1 && (
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
                                            onChange={handleInputChange}
                                            className="w-full pl-8 pr-4 py-2.5 bg-white border border-orange-200 rounded-xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-orange-700"
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
                                            onChange={handleInputChange}
                                            className="w-full pl-8 pr-4 py-2.5 bg-white border border-blue-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-blue-700"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Due Amount</label>
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

            {/* Sales Table & Cards */}
            {!showForm && (
                <div className="sale-mgmt-table-container">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="sale-mgmt-table">
                            <thead>
                                {saleType === 'Border' ? (
                                    <tr>
                                        <th className="sale-mgmt-th">Date</th>
                                        <th className="sale-mgmt-th">Importer</th>
                                        <th className="sale-mgmt-th">Port</th>
                                        <th className="sale-mgmt-th">IND CNF</th>
                                        <th className="sale-mgmt-th">BD CNF</th>
                                        <th className="sale-mgmt-th">Party Name</th>
                                        <th className="sale-mgmt-th">Product</th>
                                        <th className="sale-mgmt-th text-center">QTY</th>
                                        <th className="sale-mgmt-th">Truck</th>
                                        <th className="sale-mgmt-th text-center">Rate</th>
                                        <th className="sale-mgmt-th text-center">Total Rate</th>
                                        <th className="sale-mgmt-th text-center">Actions</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th className="sale-mgmt-th">Date</th>
                                        <th className="sale-mgmt-th text-center">Invoice</th>
                                        <th className="sale-mgmt-th">Company</th>
                                        <th className="sale-mgmt-th">Customer</th>
                                        <th className="sale-mgmt-th">Product</th>
                                        <th className="sale-mgmt-th">Brand</th>
                                        <th className="sale-mgmt-th text-center">Quantity</th>
                                        <th className="sale-mgmt-th text-center">Rate</th>
                                        <th className="sale-mgmt-th text-center">Discount</th>
                                        <th className="sale-mgmt-th text-center">Total</th>
                                        <th className="sale-mgmt-th text-center">Paid</th>
                                        <th className="sale-mgmt-th text-center">Due</th>
                                        <th className="sale-mgmt-th text-center">Actions</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {isLoading ? (
                                    <tr><td colSpan={saleType === 'Border' ? "12" : "13"} className="px-3 py-20 text-center text-gray-400 font-medium">No sales records found</td></tr>
                                ) : getFilteredData().map(sale => {
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
                                            <tr key={sale._id} className="hover:bg-blue-50/50 transition-all border-b border-gray-50 text-[13px]">
                                                <td className="px-3 py-4 whitespace-nowrap text-gray-600">{formatDate(sale.date)}</td>
                                                <td className="px-3 py-4 whitespace-nowrap font-semibold text-gray-800">{sale.importer || '-'}</td>
                                                <td className="px-3 py-4 whitespace-nowrap font-semibold text-gray-800">{sale.port || '-'}</td>
                                                <td className="px-3 py-4 whitespace-nowrap font-semibold text-gray-800">{sale.indianCnF || '-'}</td>
                                                <td className="px-3 py-4 whitespace-nowrap font-semibold text-gray-800">{sale.bdCnf || '-'}</td>
                                                <td className="px-3 py-4 whitespace-nowrap font-semibold text-gray-800">{sale.companyName || sale.customerName || '-'}</td>
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
                                                <td className="px-3 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button onClick={() => generateSaleInvoicePDF(sale, customers)} className="p-2 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-all" title="Invoice"><FileTextIcon className="w-4 h-4" /></button>
                                                        <button onClick={() => handleEdit(sale)} className="p-2 hover:bg-blue-100 text-blue-600 rounded-xl transition-all" title="Edit"><EditIcon className="w-4 h-4" /></button>
                                                        <button onClick={() => handleDelete(sale)} className="p-2 hover:bg-red-100 text-red-600 rounded-xl transition-all" title="Delete"><TrashIcon className="w-4 h-4" /></button>
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
                                                <div className="text-[13px] font-semibold text-gray-800">{sale.companyName || '-'}</div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap">
                                                <div className="text-[13px] font-semibold text-gray-800">{sale.customerName}</div>
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
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => generateSaleInvoicePDF(sale, customers)} className="p-2 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-all" title="Invoice"><FileTextIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => handleEdit(sale)} className="p-2 hover:bg-blue-100 text-blue-600 rounded-xl transition-all" title="Edit"><EditIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(sale)} className="p-2 hover:bg-red-100 text-red-600 rounded-xl transition-all" title="Delete"><TrashIcon className="w-4 h-4" /></button>
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
                        ) : getFilteredData().map(sale => {
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
                                    className={`sale-mgmt-mobile-card group cursor-pointer transition-all ${isExpanded ? 'shadow-md ring-1 ring-blue-500/10 p-4' : 'hover:bg-gray-50/30 p-2.5'}`}
                                    onClick={() => toggleRowExpansion(sale._id)}
                                >
                                    {/* Collapsed Single Line View / Expanded Header Row */}
                                    <div className={`flex items-center justify-between min-w-0 ${isExpanded ? 'border-b border-gray-50 pb-3 mb-4' : ''}`}>
                                        <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                                            {/* Date & Inv */}
                                            <div className="flex-shrink-0">
                                                <div className="sale-mgmt-mobile-label">{formatDate(sale.date)}</div>
                                                <div className={`${!isExpanded ? 'text-[11px]' : 'text-sm'} font-black text-gray-900 truncate`}>{sale.invoiceNo || sale.importer || 'No ID'}</div>
                                            </div>

                                            {!isExpanded && (
                                                <>
                                                    <div className="flex-1 min-w-0 border-l border-gray-100 pl-3">
                                                        <div className="sale-mgmt-mobile-label">Company</div>
                                                        <div className="text-[11px] font-bold text-gray-800 truncate">{sale.companyName || sale.port || '-'}</div>
                                                    </div>
                                                    <div className="flex-shrink-0 border-l border-gray-100 pl-3 text-right">
                                                        <div className="sale-mgmt-mobile-label text-blue-600">Total</div>
                                                        <div className="text-[11px] font-black text-gray-900">৳{parseFloat(sale.totalAmount).toLocaleString()}</div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 ml-2">
                                            {isExpanded ? (
                                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                    <button onClick={() => generateSaleInvoicePDF(sale, customers)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg transition-colors hover:bg-emerald-100"><FileTextIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => handleEdit(sale)} className="p-2 bg-blue-50 text-blue-600 rounded-lg transition-colors hover:bg-blue-100"><EditIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(sale)} className="p-2 bg-red-50 text-red-600 rounded-lg transition-colors hover:bg-red-100"><TrashIcon className="w-4 h-4" /></button>
                                                </div>
                                            ) : (
                                                <ChevronDownIcon className="w-5 h-5 text-gray-300 opacity-60" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded Only Content */}
                                    {isExpanded && (
                                        <>
                                            {/* Customer/Company Info */}
                                            <div className="grid grid-cols-2 gap-4 text-xs mb-4">
                                                <div>
                                                    <div className="sale-mgmt-mobile-label">Customer</div>
                                                    <div className="sale-mgmt-mobile-value">{sale.customerName || '-'}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="sale-mgmt-mobile-label">Company</div>
                                                    <div className="sale-mgmt-mobile-value truncate">{sale.companyName || sale.port || '-'}</div>
                                                </div>
                                            </div>

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
                                                    <div className="sale-mgmt-mobile-label text-orange-600">Due</div>
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
        </div>
    );
};

export default SaleManagement;
