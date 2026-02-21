import React, { useState, useEffect, useRef } from 'react';
import { EditIcon, TrashIcon, XIcon, SearchIcon, FunnelIcon, ChevronDownIcon, EyeIcon, ReceiptIcon, BarChartIcon, TrendingUpIcon, DollarSignIcon } from '../../Icons';
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

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        invoiceNo: '',
        customerId: '',
        companyName: '',
        customerName: '',
        address: '',
        contact: '',
        productId: '',
        productName: '',
        brand: '',
        inhouseQty: '',
        warehouseId: '',
        warehouseName: '',
        warehouseQty: '',
        quantity: '',
        unitPrice: '',
        totalAmount: '',
        paidAmount: '',
        dueAmount: '',
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
                });

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

    // Auto-fill Inhouse QTY and Warehouse Qty based on selection
    useEffect(() => {
        if (formData.productId && formData.brand) {
            const selectedProduct = products.find(p => p._id === formData.productId);
            if (selectedProduct) {
                const prodName = (selectedProduct.name || '').trim().toLowerCase();
                const brandName = (formData.brand || '').trim().toLowerCase();
                const targetWh = (formData.warehouseName || '').trim().toLowerCase();

                // Calculate stock totals from all records
                let totalInhouse = 0;
                let totalWarehouse = 0;

                stockRecords.forEach(record => {
                    const rProd = (record.productName || record.product || '').trim().toLowerCase();
                    const rBrand = (record.brand || '').trim().toLowerCase();
                    const rWh = (record.warehouse || record.whName || '').trim().toLowerCase();

                    if (rProd === prodName && rBrand === brandName) {
                        // Global Inhouse sum (all records for this product/brand)
                        totalInhouse += parseFloat(record.inHouseQuantity || record.inhouseQty || 0);

                        // Warehouse-specific sum (records matching this warehouse name)
                        if (targetWh && rWh === targetWh) {
                            totalWarehouse += parseFloat(record.whQty || record.whQuantity || 0);
                        }
                    }
                });

                setFormData(prev => ({
                    ...prev,
                    inhouseQty: totalInhouse > 0 ? totalInhouse.toFixed(2) : '0.00',
                    warehouseQty: targetWh && totalWarehouse > 0 ? totalWarehouse.toFixed(2) : targetWh ? '0.00' : ''
                }));
            }
        } else {
            setFormData(prev => ({ ...prev, inhouseQty: '', warehouseQty: '' }));
        }
    }, [formData.productId, formData.brand, formData.warehouseName, stockRecords, products]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let updatedFormData = { ...formData, [name]: value };

        if (name === 'quantity' || name === 'unitPrice') {
            const qty = parseFloat(name === 'quantity' ? value : formData.quantity) || 0;
            const price = parseFloat(name === 'unitPrice' ? value : formData.unitPrice) || 0;
            const total = qty * price;
            updatedFormData.totalAmount = total.toFixed(2);
            updatedFormData.dueAmount = (total - (parseFloat(formData.paidAmount) || 0)).toFixed(2);
        }

        if (name === 'paidAmount') {
            const total = parseFloat(formData.totalAmount) || 0;
            const paid = parseFloat(value) || 0;
            updatedFormData.dueAmount = (total - paid).toFixed(2);
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
                fetchSales();
                setTimeout(() => {
                    setShowForm(false);
                    resetForm();
                    setSubmitStatus(null);
                }, 1500);
            } else {
                setSubmitStatus('error');
            }
        } catch (error) {
            console.error('Error saving sale:', error);
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
            productId: '',
            productName: '',
            brand: '',
            inhouseQty: '',
            warehouseId: '',
            warehouseName: '',
            warehouseQty: '',
            quantity: '',
            unitPrice: '',
            totalAmount: '',
            paidAmount: '',
            dueAmount: '',
            paymentMethod: 'Cash',
            status: 'Pending',
            saleType: saleType
        });
        setCustomerSearch('');
        setProductSearch('');
        setActiveDropdown(null);
        setEditingId(null);
    };

    const handleEdit = (sale) => {
        setFormData(sale);
        setEditingId(sale._id);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        onDeleteConfirm({ show: true, type: 'sales', id, isBulk: false });
    };

    const getFilteredData = () => {
        if (!searchQuery) return sales;
        const query = searchQuery.toLowerCase();
        return sales.filter(s =>
            s.invoiceNo?.toLowerCase().includes(query) ||
            s.customerName?.toLowerCase().includes(query) ||
            s.companyName?.toLowerCase().includes(query) ||
            s.productName?.toLowerCase().includes(query) ||
            s.brand?.toLowerCase().includes(query)
        );
    };

    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [companyNameSearch, setCompanyNameSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [brandSearch, setBrandSearch] = useState('');
    const [warehouseSearch, setWarehouseSearch] = useState('');

    const companyNameDropdownRef = useRef(null);
    const productDropdownRef = useRef(null);
    const brandDropdownRef = useRef(null);
    const warehouseDropdownRef = useRef(null);

    // Handle outside clicks for dropdowns
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (companyNameDropdownRef.current && !companyNameDropdownRef.current.contains(e.target)) {
                if (activeDropdown === 'companyName') setActiveDropdown(null);
            }
            if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) {
                if (activeDropdown === 'product') setActiveDropdown(null);
            }
            if (brandDropdownRef.current && !brandDropdownRef.current.contains(e.target)) {
                if (activeDropdown === 'brand') setActiveDropdown(null);
            }
            if (warehouseDropdownRef.current && !warehouseDropdownRef.current.contains(e.target)) {
                if (activeDropdown === 'warehouse') setActiveDropdown(null);
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
        if (!formData.productId) return [];

        const selectedProduct = products.find(p => p._id === formData.productId);
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

        warehouses.forEach(w => {
            const name = (w.whName || w.warehouse || '').trim();
            if (name && !seen.has(name)) {
                seen.add(name);
                uniqueWhs.push(w);
            }
        });

        return uniqueWhs.filter(w =>
            (w.whName || w.warehouse || '').toLowerCase().includes(warehouseSearch.toLowerCase())
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

    const handleProductSelect = (product) => {
        setFormData(prev => ({
            ...prev,
            productId: product._id,
            productName: product.name,
            brand: '' // Clear brand when product changes
        }));
        setProductSearch('');
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

    const handleBrandSelect = (brand) => {
        setFormData(prev => ({ ...prev, brand }));
        setBrandSearch('');
        setActiveDropdown(null);
    };

    const handleWarehouseSelect = (warehouse) => {
        setFormData(prev => ({
            ...prev,
            warehouseId: warehouse._id,
            warehouseName: warehouse.whName
        }));
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

                <div className="w-1/4 flex justify-end gap-3 z-50">
                    <button
                        onClick={() => setShowForm(true)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center"
                    >
                        <span className="mr-2 text-xl">+</span> Add Sale
                    </button>
                </div>
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
                            <div className="space-y-2 relative" ref={companyNameDropdownRef}>
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

                        <div className="col-span-2 grid grid-cols-1 md:grid-cols-5 gap-4">
                            {/* Product Select */}
                            <div className="space-y-2 relative" ref={productDropdownRef}>
                                <label className="text-sm font-medium text-gray-700">Product</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder={formData.productName || "Search product..."}
                                        value={productSearch}
                                        onChange={(e) => { setProductSearch(e.target.value); setActiveDropdown('product'); setHighlightedIndex(-1); }}
                                        onFocus={() => { setActiveDropdown('product'); setHighlightedIndex(-1); }}
                                        onKeyDown={(e) => handleDropdownKeyDown(e, 'product', getFilteredProducts(), handleProductSelect)}
                                        className={`w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-14 ${formData.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        {formData.productName && (
                                            <button type="button" onClick={() => handleProductSelect({ _id: '', name: '' })} className="text-gray-400 hover:text-red-500">
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setActiveDropdown(activeDropdown === 'product' ? null : 'product')}
                                            className="text-gray-300 hover:text-blue-500 transition-colors"
                                        >
                                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'product' ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>
                                </div>
                                {activeDropdown === 'product' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                        {getFilteredProducts().map((p, idx) => (
                                            <button
                                                key={p._id}
                                                type="button"
                                                onClick={() => handleProductSelect(p)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.productId === p._id ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {p.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* Brand Select */}
                            <div className="space-y-2 relative" ref={brandDropdownRef}>
                                <label className="text-sm font-medium text-gray-700">Brand</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder={formData.brand || "Search brand..."}
                                        value={brandSearch}
                                        onChange={(e) => {
                                            setBrandSearch(e.target.value);
                                            setActiveDropdown('brand');
                                            setHighlightedIndex(-1);
                                            setFormData(prev => ({ ...prev, brand: e.target.value }));
                                        }}
                                        onFocus={() => { setActiveDropdown('brand'); setHighlightedIndex(-1); }}
                                        onKeyDown={(e) => handleDropdownKeyDown(e, 'brand', getFilteredBrands(), handleBrandSelect)}
                                        className={`w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-14 ${formData.brand ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        {formData.brand && (
                                            <button type="button" onClick={() => handleBrandSelect('')} className="text-gray-400 hover:text-red-500">
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setActiveDropdown(activeDropdown === 'brand' ? null : 'brand')}
                                            className="text-gray-300 hover:text-blue-500 transition-colors"
                                        >
                                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'brand' ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>
                                </div>
                                {activeDropdown === 'brand' && getFilteredBrands().length > 0 && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                        {getFilteredBrands().map((b, idx) => (
                                            <button
                                                key={b}
                                                type="button"
                                                onClick={() => handleBrandSelect(b)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.brand === b ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {b}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Inhouse QTY</label>
                                <input
                                    type="number"
                                    name="inhouseQty"
                                    value={formData.inhouseQty}
                                    readOnly
                                    placeholder="0.00"
                                    className="w-full px-4 py-2 bg-gray-50/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm cursor-not-allowed"
                                />
                            </div>
                            {/* Warehouse Select */}
                            <div className="space-y-2 relative" ref={warehouseDropdownRef}>
                                <label className="text-sm font-medium text-gray-700">Warehouse</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder={formData.warehouseName || "Search warehouse..."}
                                        value={warehouseSearch}
                                        onChange={(e) => { setWarehouseSearch(e.target.value); setActiveDropdown('warehouse'); setHighlightedIndex(-1); }}
                                        onFocus={() => { setActiveDropdown('warehouse'); setHighlightedIndex(-1); }}
                                        onKeyDown={(e) => handleDropdownKeyDown(e, 'warehouse', getFilteredWarehouses(), handleWarehouseSelect)}
                                        className={`w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-14 ${formData.warehouseName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        {formData.warehouseName && (
                                            <button type="button" onClick={() => handleWarehouseSelect({ _id: '', whName: '' })} className="text-gray-400 hover:text-red-500">
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setActiveDropdown(activeDropdown === 'warehouse' ? null : 'warehouse')}
                                            className="text-gray-300 hover:text-blue-500 transition-colors"
                                        >
                                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'warehouse' ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>
                                </div>
                                {activeDropdown === 'warehouse' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                        {getFilteredWarehouses().map((w, idx) => (
                                            <button
                                                key={w._id}
                                                type="button"
                                                onClick={() => handleWarehouseSelect(w)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.warehouseId === w._id ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {w.whName}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Warehouse Qty</label>
                                <input
                                    type="number"
                                    name="warehouseQty"
                                    value={formData.warehouseQty}
                                    readOnly
                                    placeholder="0.00"
                                    className="w-full px-4 py-2 bg-gray-50/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 col-span-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Quantity (kg)</label>
                                <input type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm" required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Unit Price</label>
                                <input type="number" name="unitPrice" value={formData.unitPrice} onChange={handleInputChange} className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm" required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Total Amount</label>
                                <input type="text" name="totalAmount" value={formData.totalAmount} className="w-full px-4 py-2 bg-gray-50/80 border border-gray-200/60 rounded-lg text-gray-600 font-semibold outline-none cursor-default" readOnly />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Paid Amount</label>
                                <input type="number" name="paidAmount" value={formData.paidAmount} onChange={handleInputChange} className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Due Amount</label>
                                <input type="text" name="dueAmount" value={formData.dueAmount} className="w-full px-4 py-2 bg-gray-50/80 border border-gray-200/60 rounded-lg text-red-600 font-semibold outline-none cursor-default" readOnly />
                            </div>
                        </div>

                        <div className="col-span-2 pt-4 flex justify-end gap-3 border-t border-gray-200/50">
                            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors">Cancel</button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {isSubmitting ? 'Processing...' : editingId ? 'Update Sale' : 'Confirm Sale'}
                            </button>
                        </div>
                    </form>
                </div >
            )}

            {/* Sales Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Invoice</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Product</th>
                                <th className="px-6 py-4">Total</th>
                                <th className="px-6 py-4">Paid</th>
                                <th className="px-6 py-4">Due</th>
                                <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                <tr><td colSpan="8" className="px-6 py-20 text-center text-gray-400 font-medium">Loading sales records...</td></tr>
                            ) : getFilteredData().length === 0 ? (
                                <tr><td colSpan="8" className="px-6 py-20 text-center text-gray-400 font-medium">No sales records found</td></tr>
                            ) : getFilteredData().map(sale => (
                                <tr key={sale._id} className="hover:bg-blue-50/30 transition-all group border-b border-gray-50 last:border-0">
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-600">{sale.date}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-600 group-hover:bg-blue-100 transition-colors">
                                                {sale.invoiceNo ? sale.invoiceNo.substring(0, 2).toUpperCase() : 'SL'}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-900 uppercase tracking-tight">{sale.invoiceNo}</div>
                                                <div className="text-[10px] text-gray-400 font-medium lowercase">invoice id</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-semibold text-gray-800">{sale.customerName}</div>
                                        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">
                                            {sale.companyName ? sale.companyName : 'Verified Customer'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-800 font-bold">{sale.productName}</div>
                                        {sale.brand && <div className="text-[10px] text-gray-400 font-medium uppercase">{sale.brand}</div>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-bold text-gray-900">৳ {parseFloat(sale.totalAmount).toLocaleString()}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold inline-block">
                                            ৳ {parseFloat(sale.paidAmount || 0).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="px-2.5 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold inline-block">
                                            ৳ {parseFloat(sale.dueAmount || 0).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                            <button
                                                onClick={() => handleEdit(sale)}
                                                className="p-2 hover:bg-blue-100 text-blue-600 rounded-xl transition-all hover:scale-110 active:scale-90"
                                                title="Edit Record"
                                            >
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(sale._id)}
                                                className="p-2 hover:bg-red-100 text-red-600 rounded-xl transition-all hover:scale-110 active:scale-90"
                                                title="Delete Record"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div >
    );
};

export default SaleManagement;
