import React, { useState, useEffect, useRef } from 'react';
import { EditIcon, TrashIcon, XIcon, SearchIcon, FunnelIcon, ChevronDownIcon, EyeIcon, ReceiptIcon, BarChartIcon, TrendingUpIcon, DollarSignIcon, FileTextIcon } from '../../Icons';
import { generateSaleInvoicePDF } from '../../../utils/pdfGenerator';
import { API_BASE_URL, SortIcon } from '../../../utils/helpers';
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
    endLongPress
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

    const toggleRowExpansion = (saleId) => {
        setExpandedRows(prev =>
            prev.includes(saleId) ? prev.filter(id => id !== saleId) : [...prev, saleId]
        );
    };

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        invoiceNo: '',
        customerId: '',
        companyName: '',
        customerName: '',
        address: '',
        contact: '',
        items: [{
            productId: '',
            productName: '',
            brandEntries: [{
                brand: '',
                inhouseQty: '',
                warehouseId: '',
                warehouseName: '',
                warehouseQty: '',
                quantity: '',
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
        saleType: saleType // Initialize with prop value
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
                    inhouseQty: '',
                    warehouseId: '',
                    warehouseName: '',
                    warehouseQty: '',
                    quantity: '',
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
                    inhouseQty: '',
                    warehouseId: '',
                    warehouseName: '',
                    warehouseQty: '',
                    quantity: '',
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

            if (name === 'quantity' || name === 'unitPrice') {
                const qty = parseFloat(name === 'quantity' ? value : entry.quantity) || 0;
                const price = parseFloat(name === 'unitPrice' ? value : entry.unitPrice) || 0;
                entry.totalAmount = (qty * price).toFixed(2);
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

                // Mathematical stock deduction logic connecting sales to warehouse/stock has been removed

                setTimeout(() => {
                    setShowForm(false);
                    resetForm();
                    fetchSales();
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
            date: new Date().toISOString().split('T')[0],
            invoiceNo: '',
            customerId: '',
            companyName: '',
            customerName: '',
            address: '',
            contact: '',
            items: [{
                productId: '',
                productName: '',
                brandEntries: [{
                    brand: '',
                    inhouseQty: '',
                    warehouseId: '',
                    warehouseName: '',
                    warehouseQty: '',
                    quantity: '',
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
            saleType: saleType
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
            discount: sale.discount || '0.00'
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
        if (!searchQuery) return sales;
        const query = searchQuery.toLowerCase();
        return sales.filter(s => {
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
        setFormData(prev => ({
            ...prev,
            customerId: customer._id,
            companyName: customer.companyName || '',
            customerName: customer.customerName || '',
            address: customer.address || customer.location || '',
            contact: customer.phone || ''
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
                contact: ''
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
                brand: '' // Clear brand when product changes
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
                brand: brand
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
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
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
                                {viewData.date}
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

    const stats = {
        totalSales: sales.reduce((sum, s) => sum + (parseFloat(s.totalAmount) || 0), 0),
        totalPaid: sales.reduce((sum, s) => sum + (parseFloat(s.paidAmount) || 0), 0),
        totalDue: sales.reduce((sum, s) => sum + (parseFloat(s.dueAmount) || 0), 0)
    };

    return (
        <div className="sale-management-container space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="w-1/4">
                    <h2 className="text-2xl font-bold text-gray-800">{saleType} Sale Management</h2>
                </div>

                {!showForm && (
                    <div className="flex-1 max-w-md mx-auto relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search invoice, customer..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                        />
                    </div>
                )}

                {!showForm && (
                    <div className="w-1/4 flex justify-end gap-3 z-50">
                        <button
                            onClick={() => setShowForm(true)}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center"
                        >
                            <span className="mr-2 text-xl">+</span> Add Sale
                        </button>
                    </div>
                )}
            </div>

            {/* Summary Cards */}
            {!showForm && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm transition-all hover:shadow-md">
                        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Sales</div>
                        <div className="text-xl font-bold text-gray-900">৳ {stats.totalSales.toLocaleString()}</div>
                    </div>
                    <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl shadow-sm transition-all hover:shadow-md">
                        <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Total Paid</div>
                        <div className="text-xl font-bold text-emerald-700">৳ {stats.totalPaid.toLocaleString()}</div>
                    </div>
                    <div className="bg-orange-50/50 border border-orange-100 p-4 rounded-xl shadow-sm transition-all hover:shadow-md">
                        <div className="text-[11px] font-bold text-orange-600 uppercase tracking-wider mb-1">Total Due</div>
                        <div className="text-xl font-bold text-orange-700">৳ {stats.totalDue.toLocaleString()}</div>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl p-8 transition-all duration-300">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="flex items-center justify-between mb-6 border-b border-gray-200/50 pb-4 relative z-10">
                        <h3 className="text-xl font-semibold text-gray-800">{editingId ? 'Edit Sale' : 'New Sale Entry'}</h3>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-red-500 transition-colors">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} autoComplete="off" className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 col-span-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Date</label>
                                <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm" required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Invoice No</label>
                                <input type="text" name="invoiceNo" value={formData.invoiceNo} onChange={handleInputChange} placeholder="SALE-001" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm" required />
                            </div>
                            {/* Company Name Select */}
                            <div className="space-y-2 relative company-dropdown-container">
                                <label className="text-sm font-medium text-gray-700">Company Name</label>
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
                                        className={`w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-14 ${formData.companyName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
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
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Customer</label>
                                <input type="text" name="customerName" value={formData.customerName} readOnly placeholder="Customer" className="w-full px-4 py-2 bg-gray-50/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm cursor-not-allowed" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Address</label>
                                <input type="text" name="address" value={formData.address} readOnly placeholder="Address" className="w-full px-4 py-2 bg-gray-50/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm cursor-not-allowed" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Contact</label>
                                <input type="text" name="contact" value={formData.contact} readOnly placeholder="Contact" className="w-full px-4 py-2 bg-gray-50/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm cursor-not-allowed" />
                            </div>
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
                                    <div key={index} className="relative p-6 rounded-3xl bg-white/40 border border-gray-200/50 shadow-sm transition-all hover:shadow-md group/item">
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

                                        <div className="space-y-6">
                                            {/* Product Selection Row */}
                                            <div className="space-y-1.5 relative max-w-sm px-4 product-dropdown-container">
                                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Product</label>
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
                                                        className={`w-full px-4 py-2 pr-14 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm ${item.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
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

                                            {/* Brand Entries Section */}
                                            <div className="space-y-4">
                                                {/* Header Row for Brands (Hidden on Mobile) */}
                                                <div className="hidden md:grid grid-cols-7 gap-4 px-4">
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Brand</div>
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Inhouse</div>
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Warehouse</div>
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Wh Stock</div>
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Qty</div>
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Price</div>
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Total</div>
                                                </div>

                                                {item.brandEntries.map((entry, entryIndex) => (
                                                    <div key={entryIndex} className="relative grid grid-cols-1 md:grid-cols-7 gap-4 items-center px-4 py-1 transition-all group/entry">
                                                        {/* Brand Selection */}
                                                        <div className="relative brand-dropdown-container">
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    placeholder={entry.brand || "Brand"}
                                                                    value={activeItemIndex === index && activeEntryIndex === entryIndex && activeDropdown === 'brand' ? brandSearch : ''}
                                                                    onChange={(e) => {
                                                                        setBrandSearch(e.target.value);
                                                                        setActiveDropdown('brand');
                                                                        setActiveItemIndex(index);
                                                                        setActiveEntryIndex(entryIndex);
                                                                        handleItemInputChange(index, entryIndex, { target: { name: 'brand', value: e.target.value } });
                                                                    }}
                                                                    onFocus={() => {
                                                                        setActiveDropdown('brand');
                                                                        setActiveItemIndex(index);
                                                                        setActiveEntryIndex(entryIndex);
                                                                        setBrandSearch(entry.brand || '');
                                                                    }}
                                                                    className={`w-full px-4 py-2 pr-10 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-xs ${entry.brand ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                                                />
                                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                                    {entry.brand && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                handleBrandSelect('');
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
                                                                <div className="absolute z-[70] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1">
                                                                    {getFilteredBrands().map((b) => (
                                                                        <button key={b} type="button" onClick={() => handleBrandSelect(b)} className="w-full px-4 py-2 text-left text-xs hover:bg-blue-50 font-medium text-gray-700">
                                                                            {b}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Inhouse Qty */}
                                                        <div>
                                                            <div className="w-full h-10 flex items-center justify-center bg-white/50 border border-gray-200/60 rounded-lg backdrop-blur-sm text-[13px] font-bold text-gray-900">
                                                                {entry.inhouseQty || '0'}
                                                            </div>
                                                        </div>

                                                        {/* Warehouse */}
                                                        <div className="relative warehouse-dropdown-container">
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    placeholder={entry.warehouseName || "Warehouse"}
                                                                    value={activeItemIndex === index && activeEntryIndex === entryIndex && activeDropdown === 'warehouse' ? warehouseSearch : ''}
                                                                    onChange={(e) => {
                                                                        setWarehouseSearch(e.target.value);
                                                                        setActiveDropdown('warehouse');
                                                                        setActiveItemIndex(index);
                                                                        setActiveEntryIndex(entryIndex);
                                                                    }}
                                                                    onFocus={() => {
                                                                        setActiveDropdown('warehouse');
                                                                        setActiveItemIndex(index);
                                                                        setActiveEntryIndex(entryIndex);
                                                                        setWarehouseSearch(entry.warehouseName || '');
                                                                    }}
                                                                    className={`w-full px-4 py-2 pr-10 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-xs ${entry.warehouseName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
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

                                                        {/* Wh Stock */}
                                                        <div>
                                                            <div className="w-full h-10 flex items-center justify-center bg-white/50 border border-gray-200/60 rounded-lg backdrop-blur-sm text-[13px] font-bold text-gray-900">
                                                                {entry.warehouseQty || '0'}
                                                            </div>
                                                        </div>

                                                        {/* Quantity */}
                                                        <div>
                                                            <input
                                                                type="number"
                                                                name="quantity"
                                                                value={entry.quantity}
                                                                onChange={(e) => handleItemInputChange(index, entryIndex, e)}
                                                                placeholder="0"
                                                                className="w-full px-2 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-[13px] font-black text-gray-900 text-center"
                                                            />
                                                        </div>

                                                        {/* Unit Price */}
                                                        <div>
                                                            <input
                                                                type="number"
                                                                name="unitPrice"
                                                                value={entry.unitPrice}
                                                                onChange={(e) => handleItemInputChange(index, entryIndex, e)}
                                                                placeholder="0"
                                                                className="w-full px-2 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-[13px] font-bold text-gray-600 text-center"
                                                            />
                                                        </div>

                                                        {/* Total + Add/Remove */}
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-10 flex items-center justify-center bg-white/50 border border-gray-200/60 rounded-lg backdrop-blur-sm text-[13px] font-black text-blue-600">
                                                                {parseFloat(entry.totalAmount || 0).toLocaleString()}
                                                            </div>
                                                            <div className="flex flex-row gap-1 items-center justify-center">
                                                                {entryIndex === item.brandEntries.length - 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => addBrandEntry(index)}
                                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all active:scale-90"
                                                                        title="Add Brand"
                                                                    >
                                                                        <span className="text-xl font-bold">+</span>
                                                                    </button>
                                                                )}
                                                                {item.brandEntries.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeBrandEntry(index, entryIndex)}
                                                                        className="p-1.5 text-gray-300 hover:text-red-500 transition-all opacity-0 group-hover/entry:opacity-100"
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
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Invoice Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 col-span-2 pt-4 bg-blue-50/50 p-6 rounded-2xl border border-blue-100/50 mt-4">
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
                                <div className="flex items-center gap-4 justify-end border-t border-gray-100 pt-4 mt-2">
                                    <div className="flex-1">
                                        {submitStatus === 'success' && (
                                            <p className="text-green-600 font-medium flex items-center animate-bounce">
                                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                                Sale saved successfully!
                                            </p>
                                        )}
                                        {submitStatus === 'error' && (
                                            <p className="text-red-600 font-medium flex items-center">
                                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                Failed to save sale. Please try again.
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setShowForm(false); resetForm(); }}
                                        className="min-w-[150px] px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm flex justify-center items-center"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="min-w-[150px] px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200 text-sm flex items-center justify-center shadow-md disabled:opacity-50 hover:scale-105 whitespace-nowrap"
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
                    </form >
                </div >
            )}

            {/* Sales Table */}
            {
                !showForm && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="px-3 py-4 whitespace-nowrap">Date</th>
                                        <th className="px-3 py-4 whitespace-nowrap text-center">Invoice</th>
                                        <th className="px-3 py-4 whitespace-nowrap">Company</th>
                                        <th className="px-3 py-4 whitespace-nowrap">Customer</th>
                                        <th className="px-3 py-4 whitespace-nowrap">Product</th>
                                        <th className="px-3 py-4 whitespace-nowrap">Brand</th>
                                        <th className="px-3 py-4 whitespace-nowrap text-center">Quantity</th>
                                        <th className="px-3 py-4 whitespace-nowrap text-center">Rate</th>
                                        <th className="px-3 py-4 whitespace-nowrap text-center">Discount</th>
                                        <th className="px-3 py-4 whitespace-nowrap text-center">Total</th>
                                        <th className="px-3 py-4 whitespace-nowrap text-center">Paid</th>
                                        <th className="px-3 py-4 whitespace-nowrap text-center">Due</th>
                                        <th className="px-3 py-4 text-center whitespace-nowrap">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {isLoading ? (
                                        <tr><td colSpan="13" className="px-3 py-20 text-center text-gray-400 font-medium">Loading sales records...</td></tr>
                                    ) : getFilteredData().length === 0 ? (
                                        <tr><td colSpan="13" className="px-3 py-20 text-center text-gray-400 font-medium">No sales records found</td></tr>
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
                                            <tr
                                                key={sale._id}
                                                onClick={() => isMultiple && toggleRowExpansion(sale._id)}
                                                className={`hover:bg-blue-50/50 transition-all group border-b border-gray-50 last:border-0 align-middle ${isMultiple ? 'cursor-pointer' : ''}`}
                                            >
                                                <td className="px-3 py-4 whitespace-nowrap">
                                                    <div className="text-[13px] font-medium text-gray-600">{sale.date}</div>
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
                                                        <button
                                                            onClick={() => generateSaleInvoicePDF(sale)}
                                                            className="p-2 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-all hover:scale-110 active:scale-90"
                                                            title="Generate Invoice/Challan"
                                                        >
                                                            <FileTextIcon className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleEdit(sale)}
                                                            className="p-2 hover:bg-blue-100 text-blue-600 rounded-xl transition-all hover:scale-110 active:scale-90"
                                                            title="Edit Record"
                                                        >
                                                            <EditIcon className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(sale)}
                                                            className="p-2 hover:bg-red-100 text-red-600 rounded-xl transition-all hover:scale-110 active:scale-90"
                                                            title="Delete Record"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }
            {viewData && renderViewModal()}
        </div >
    );
};

export default SaleManagement;
