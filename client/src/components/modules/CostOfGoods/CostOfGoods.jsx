import React, { useState, useEffect, useRef } from 'react';
import { EditIcon, TrashIcon, EyeIcon, XIcon, BoxIcon, SearchIcon, PlusIcon } from '../../Icons';
import { API_BASE_URL, SortIcon, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import './CostOfGoods.css';
import { hasPermission } from '../../../utils/permissionHelper';
import CustomDatePicker from '../../shared/CustomDatePicker';

const CostOfGoods = ({
    currentUser,
    isSelectionMode,
    setIsSelectionMode,
    selectedItems,
    setSelectedItems,
    editingId,
    setEditingId,
    onDeleteConfirm,
    addNotification,
}) => {
    const canEdit = hasPermission(currentUser, 'costOfGoods', 'edit');
    const canDelete = hasPermission(currentUser, 'costOfGoods', 'delete');
    const canCreate = hasPermission(currentUser, 'costOfGoods', 'create');

    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [viewData, setViewData] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Relational options states
    const [lcs, setLcs] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);

    // Dropdown search & toggle states
    const [lcDropdownOpen, setLcDropdownOpen] = useState(false);
    const [lcSearchQuery, setLcSearchQuery] = useState('');
    const [highlightedLcIndex, setHighlightedLcIndex] = useState(-1);

    const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
    const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
    const [highlightedSupplierIndex, setHighlightedSupplierIndex] = useState(-1);

    const [productDropdownOpen, setProductDropdownOpen] = useState(false);
    const [highlightedProductIndex, setHighlightedProductIndex] = useState(-1);

    const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
    const [brandSearchQuery, setBrandSearchQuery] = useState('');
    const [highlightedBrandIndex, setHighlightedBrandIndex] = useState(-1);

    // Refs for click outside detection
    const lcDropdownRef = useRef(null);
    const supplierDropdownRef = useRef(null);
    const productDropdownRef = useRef(null);
    const brandDropdownRef = useRef(null);

    const [formData, setFormData] = useState({
        lcNo: '',
        importer: '',
        exporter: '',
        supplier: '',
        invoiceNo: '',
        truckNo: '',
        product: '',
        brand: '',
        quantity: '',
        amount: '',
        indTruckFare: '',
        slofCf: '',
        rebate: '2.9',
        rebateAmount: '',
        netBill: '',
        rateKg: '',
        rsToDollar: '',
        rateKgUsd: '',
        dollarRateBdt: '',
        rateKgBdt: '',
        cfOtherExpense: '9',
        costingKg: '',
        date: ''
    });

    useEffect(() => {
        fetchRecords();
        fetchLCs();
        fetchSuppliers();
        fetchProducts();
    }, []);

    useEffect(() => {
        function handleClickOutside(event) {
            if (lcDropdownRef.current && !lcDropdownRef.current.contains(event.target)) {
                setLcDropdownOpen(false);
            }
            if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target)) {
                setSupplierDropdownOpen(false);
            }
            if (productDropdownRef.current && !productDropdownRef.current.contains(event.target)) {
                setProductDropdownOpen(false);
            }
            if (brandDropdownRef.current && !brandDropdownRef.current.contains(event.target)) {
                setBrandDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/cost-of-goods`);
            setRecords(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching cost of goods:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLCs = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/lc-management`);
            setLcs(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching LCs:', error);
        }
    };

    const fetchSuppliers = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/suppliers`);
            setSuppliers(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching suppliers:', error);
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

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleLcSelect = (lc) => {
        // Extract unique products from productsList and productName fields of selected LC
        const uniqueProducts = [...new Set([
            ...(lc.productsList || []).map(p => p.productName || p.product).filter(Boolean),
            lc.productName
        ].filter(Boolean))];

        const autoProduct = uniqueProducts.length === 1 ? uniqueProducts[0] : '';

        let autoBrand = '';
        if (autoProduct) {
            const selectedProductObj = products.find(p => p.name === autoProduct);
            const availableBrands = selectedProductObj ? [
                ...(selectedProductObj.brands || []).map(b => b.brand).filter(Boolean),
                selectedProductObj.brand
            ].filter(Boolean) : [];
            const uniqueBrands = [...new Set(availableBrands)];
            autoBrand = uniqueBrands.length === 1 ? uniqueBrands[0] : '';
        }

        setFormData(prev => ({
            ...prev,
            lcNo: lc.lcNo || '',
            importer: lc.importerName || lc.importer || '',
            exporter: lc.exporterName || lc.exporter || '',
            product: autoProduct,
            brand: autoBrand,
            supplier: '' // Reset supplier on LC change since exporter changes
        }));

        setLcDropdownOpen(false);
        setLcSearchQuery('');
        setHighlightedLcIndex(-1);
    };

    const handleProductSelect = (prodName) => {
        const selectedProductObj = products.find(p => p.name === prodName);
        const availableBrands = selectedProductObj ? [
            ...(selectedProductObj.brands || []).map(b => b.brand).filter(Boolean),
            selectedProductObj.brand
        ].filter(Boolean) : [];
        const uniqueBrands = [...new Set(availableBrands)];
        const autoBrand = uniqueBrands.length === 1 ? uniqueBrands[0] : '';

        setFormData(prev => ({
            ...prev,
            product: prodName,
            brand: autoBrand
        }));

        setProductDropdownOpen(false);
        setHighlightedProductIndex(-1);
    };

    // Filter suppliers where supplier.exporter matches selected exporter string
    const filteredSuppliersForExporter = suppliers.filter(s =>
        formData.exporter &&
        (s.exporter || '').trim().toLowerCase() === (formData.exporter || '').trim().toLowerCase()
    );

    // Get products for the currently selected LC
    const getSelectedLcProducts = () => {
        const selectedLcObj = lcs.find(l => l.lcNo === formData.lcNo);
        if (!selectedLcObj) return [];
        return [...new Set([
            ...(selectedLcObj.productsList || []).map(p => p.productName || p.product).filter(Boolean),
            selectedLcObj.productName
        ].filter(Boolean))];
    };

    const selectedLcProducts = getSelectedLcProducts();
    const hasMultipleProducts = selectedLcProducts.length > 1;

    // Get unique brand options for selected product from database
    const getProductBrands = () => {
        if (!formData.product) return [];
        const selectedProductObj = products.find(p => p.name === formData.product);
        const availableBrands = selectedProductObj ? [
            ...(selectedProductObj.brands || []).map(b => b.brand).filter(Boolean),
            selectedProductObj.brand
        ].filter(Boolean) : [];
        return [...new Set(availableBrands)];
    };

    const productBrands = getProductBrands();
    const filteredBrands = productBrands.filter(b => b.toLowerCase().includes(brandSearchQuery.toLowerCase()));

    const handleLcKeyDown = (e) => {
        const filtered = lcs.filter(l =>
            (l.lcNo || '').toLowerCase().includes(lcSearchQuery.toLowerCase())
        );
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!lcDropdownOpen) setLcDropdownOpen(true);
            setHighlightedLcIndex(prev => Math.min(prev + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedLcIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedLcIndex >= 0 && filtered[highlightedLcIndex]) {
                handleLcSelect(filtered[highlightedLcIndex]);
            } else if (filtered.length === 1) {
                handleLcSelect(filtered[0]);
            }
        } else if (e.key === 'Escape') {
            setLcDropdownOpen(false);
            setHighlightedLcIndex(-1);
        }
    };

    const handleSupplierKeyDown = (e) => {
        const filtered = filteredSuppliersForExporter.filter(s =>
            (s.name || '').toLowerCase().includes(supplierSearchQuery.toLowerCase())
        );
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!supplierDropdownOpen) setSupplierDropdownOpen(true);
            setHighlightedSupplierIndex(prev => Math.min(prev + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedSupplierIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedSupplierIndex >= 0 && filtered[highlightedSupplierIndex]) {
                const sup = filtered[highlightedSupplierIndex];
                setFormData(prev => ({ ...prev, supplier: sup.name }));
                setSupplierDropdownOpen(false);
                setSupplierSearchQuery('');
                setHighlightedSupplierIndex(-1);
            } else if (filtered.length === 1) {
                const sup = filtered[0];
                setFormData(prev => ({ ...prev, supplier: sup.name }));
                setSupplierDropdownOpen(false);
                setSupplierSearchQuery('');
                setHighlightedSupplierIndex(-1);
            }
        } else if (e.key === 'Escape') {
            setSupplierDropdownOpen(false);
            setHighlightedSupplierIndex(-1);
        }
    };

    const handleProductKeyDown = (e) => {
        const filtered = selectedLcProducts;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!productDropdownOpen) setProductDropdownOpen(true);
            setHighlightedProductIndex(prev => Math.min(prev + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedProductIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedProductIndex >= 0 && filtered[highlightedProductIndex]) {
                handleProductSelect(filtered[highlightedProductIndex]);
            } else if (filtered.length === 1) {
                handleProductSelect(filtered[0]);
            }
        } else if (e.key === 'Escape') {
            setProductDropdownOpen(false);
            setHighlightedProductIndex(-1);
        }
    };

    const handleBrandKeyDown = (e) => {
        const filtered = filteredBrands;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!brandDropdownOpen) setBrandDropdownOpen(true);
            setHighlightedBrandIndex(prev => Math.min(prev + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedBrandIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedBrandIndex >= 0 && filtered[highlightedBrandIndex]) {
                const brandVal = filtered[highlightedBrandIndex];
                setFormData(prev => ({ ...prev, brand: brandVal }));
                setBrandDropdownOpen(false);
                setBrandSearchQuery('');
                setHighlightedBrandIndex(-1);
            } else if (filtered.length === 1) {
                const brandVal = filtered[0];
                setFormData(prev => ({ ...prev, brand: brandVal }));
                setBrandDropdownOpen(false);
                setBrandSearchQuery('');
                setHighlightedBrandIndex(-1);
            }
        } else if (e.key === 'Escape') {
            setBrandDropdownOpen(false);
            setHighlightedBrandIndex(-1);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const calculatedTotalBill = (parseFloat(formData.amount) || 0) + (parseFloat(formData.indTruckFare) || 0) + (parseFloat(formData.slofCf) || 0);
            const calculatedRebateAmount = (calculatedTotalBill * (parseFloat(formData.rebate) || 0)) / 100;
            const calculatedNetBill = calculatedTotalBill - calculatedRebateAmount;
            const qty = parseFloat(formData.quantity) || 0;
            const calculatedRateKg = qty ? (calculatedNetBill / qty) : 0;
            const dollarRate = parseFloat(formData.rsToDollar) || 0;
            const calculatedRateKgUsd = dollarRate ? (calculatedRateKg / dollarRate) : 0;
            const bdtRate = parseFloat(formData.dollarRateBdt) || 0;
            const calculatedRateKgBdt = calculatedRateKgUsd * bdtRate;
            const expense = parseFloat(formData.cfOtherExpense) || 0;
            const calculatedCostingKg = calculatedRateKgBdt + expense;
            const payload = {
                ...formData,
                totalBill: calculatedTotalBill,
                rebateAmount: calculatedRebateAmount,
                netBill: calculatedNetBill,
                rateKg: calculatedRateKg,
                rateKgUsd: calculatedRateKgUsd,
                rateKgBdt: calculatedRateKgBdt,
                costingKg: calculatedCostingKg
            };
            const url = editingId
                ? `${API_BASE_URL}/api/cost-of-goods/${editingId}`
                : `${API_BASE_URL}/api/cost-of-goods`;
            if (editingId) await axios.put(url, payload);
            else await axios.post(url, payload);
            setSubmitStatus('success');
            fetchRecords();
            setTimeout(() => { setShowForm(false); setEditingId(null); resetForm(); setSubmitStatus(null); }, 2000);
        } catch (error) {
            console.error('Error saving cost of goods:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            lcNo: '',
            importer: '',
            exporter: '',
            supplier: '',
            invoiceNo: '',
            truckNo: '',
            product: '',
            brand: '',
            quantity: '',
            amount: '',
            indTruckFare: '',
            slofCf: '',
            totalBill: '',
            rebate: '2.9',
            rebateAmount: '',
            netBill: '',
            rateKg: '',
            rsToDollar: '',
            rateKgUsd: '',
            dollarRateBdt: '',
            rateKgBdt: '',
            cfOtherExpense: '9',
            costingKg: '',
            date: ''
        });
        setEditingId(null);
        setSubmitStatus(null);
        setLcSearchQuery('');
        setSupplierSearchQuery('');
        setBrandSearchQuery('');
    };

    const handleEdit = (record) => {
        setFormData({
            lcNo: record.lcNo || '',
            importer: record.importer || '',
            exporter: record.exporter || '',
            supplier: record.supplier || '',
            invoiceNo: record.invoiceNo || '',
            truckNo: record.truckNo || '',
            product: record.product || '',
            brand: record.brand || '',
            quantity: record.quantity || '',
            amount: record.amount || '',
            indTruckFare: record.indTruckFare || '',
            slofCf: record.slofCf || '',
            totalBill: record.totalBill || '',
            rebate: record.rebate !== undefined ? record.rebate : (record.redate !== undefined ? record.redate : '2.9'),
            rebateAmount: record.rebateAmount || record.redateAmount || '',
            netBill: record.netBill || '',
            rateKg: record.rateKg || '',
            rsToDollar: record.rsToDollar || '',
            rateKgUsd: record.rateKgUsd || '',
            dollarRateBdt: record.dollarRateBdt || '',
            rateKgBdt: record.rateKgBdt || '',
            cfOtherExpense: record.cfOtherExpense !== undefined ? record.cfOtherExpense : '9',
            costingKg: record.costingKg || '',
            date: record.date || '',
        });
        setEditingId(record._id);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        if (!canDelete) { alert('Forbidden: You do not have permission to delete records'); return; }
        onDeleteConfirm({ show: true, type: 'cost-of-goods', id, isBulk: false });
    };

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id);
        setSelectedItems(newSelected);
        if (newSelected.size === 0) setIsSelectionMode(false);
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === filteredRecords.length) {
            setSelectedItems(new Set());
            setIsSelectionMode(false);
        } else {
            setSelectedItems(new Set(filteredRecords.map(r => r._id)));
        }
    };

    const requestSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const filteredRecords = records.filter(r =>
        (r.lcNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.importer || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.exporter || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.supplier || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.invoiceNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.truckNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.product || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.brand || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.quantity || '').toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.indTruckFare || '').toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.slofCf || '').toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.totalBill || '').toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.rebate || r.redate || '').toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.rebateAmount || r.redateAmount || '').toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.netBill || '').toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.rateKg || '').toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.rsToDollar || '').toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.rateKgUsd || '').toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.dollarRateBdt || '').toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.rateKgBdt || '').toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.cfOtherExpense || '').toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.costingKg || '').toString().toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sortedRecords = [...filteredRecords].sort((a, b) => {
        if (!sortConfig.key) return 0;
        const numericKeys = ['amount', 'indTruckFare', 'slofCf', 'totalBill', 'rebate', 'rebateAmount', 'redate', 'redateAmount', 'netBill', 'rateKg', 'rsToDollar', 'rateKgUsd', 'dollarRateBdt', 'rateKgBdt', 'cfOtherExpense', 'costingKg', 'quantity'];
        if (numericKeys.includes(sortConfig.key)) {
            const aVal = parseFloat(a[sortConfig.key] !== undefined ? a[sortConfig.key] : (sortConfig.key === 'rebate' ? a.redate : (sortConfig.key === 'rebateAmount' ? a.redateAmount : 0))) || 0;
            const bVal = parseFloat(b[sortConfig.key] !== undefined ? b[sortConfig.key] : (sortConfig.key === 'rebate' ? b.redate : (sortConfig.key === 'rebateAmount' ? b.redateAmount : 0))) || 0;
            return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const aVal = (a[sortConfig.key] || '').toString().toLowerCase();
        const bVal = (b[sortConfig.key] || '').toString().toLowerCase();
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }} className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="w-full md:w-auto">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800 text-center md:text-left">Cost of Goods</h2>
                </div>
                <div className="flex-1 w-full max-w-none md:max-w-md mx-auto flex items-center gap-2">
                    <div className="flex-1 w-full relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            autoComplete="off"
                            type="text"
                            placeholder="Search records..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                        />
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 w-full md:w-auto">
                    {canCreate && (
                        <button
                            onClick={() => { resetForm(); setShowForm(true); }}
                            className="w-full md:w-auto px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center justify-center gap-2 text-sm"
                        >
                            <PlusIcon className="w-4 h-4" />
                            Add New
                        </button>
                    )}
                </div>
            </div>

            {/* Table / Content */}
            {!showForm && (
                isLoading ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
                        <p className="text-gray-400 text-sm">Loading...</p>
                    </div>
                ) : sortedRecords.length > 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto pb-3">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        {isSelectionMode && (
                                            <th className="px-4 py-3 text-left" style={{ width: 40 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.size === sortedRecords.length && sortedRecords.length > 0}
                                                    onChange={toggleSelectAll}
                                                    className="rounded"
                                                />
                                            </th>
                                        )}
                                        <th onClick={() => requestSort('date')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">Date <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="date" /></div>
                                        </th>
                                        <th onClick={() => requestSort('lcNo')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">LC No <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="lcNo" /></div>
                                        </th>
                                        <th onClick={() => requestSort('supplier')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">Supplier <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="supplier" /></div>
                                        </th>
                                        <th onClick={() => requestSort('invoiceNo')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">Invoice No <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="invoiceNo" /></div>
                                        </th>
                                        <th onClick={() => requestSort('truckNo')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">Truck No <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="truckNo" /></div>
                                        </th>
                                        <th onClick={() => requestSort('product')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">Product <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="product" /></div>
                                        </th>
                                        <th onClick={() => requestSort('brand')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">Brand <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="brand" /></div>
                                        </th>
                                        <th onClick={() => requestSort('quantity')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">Quantity <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="quantity" /></div>
                                        </th>
                                        <th onClick={() => requestSort('amount')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">Invoice Value <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="amount" /></div>
                                        </th>
                                        <th onClick={() => requestSort('netBill')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">Net Bill <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="netBill" /></div>
                                        </th>
                                        <th onClick={() => requestSort('rateKgBdt')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">Rate/KG BDT <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="rateKgBdt" /></div>
                                        </th>
                                        <th onClick={() => requestSort('cfOtherExpense')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">C&F & Other <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="cfOtherExpense" /></div>
                                        </th>
                                        <th onClick={() => requestSort('costingKg')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">Costing/kg <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="costingKg" /></div>
                                        </th>
                                        <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedRecords.map(record => {
                                        const isSelected = selectedItems.has(record._id);
                                        const billSum = record.totalBill !== undefined ? record.totalBill : ((parseFloat(record.amount) || 0) + (parseFloat(record.indTruckFare) || 0) + (parseFloat(record.slofCf) || 0));
                                        const rebatePct = record.rebate !== undefined ? record.rebate : (record.redate !== undefined ? record.redate : '2.9');
                                        const rebateVal = record.rebateAmount !== undefined ? record.rebateAmount : (record.redateAmount !== undefined ? record.redateAmount : ((billSum * (parseFloat(rebatePct) || 0)) / 100));
                                        const netBillVal = record.netBill !== undefined ? record.netBill : (billSum - rebateVal);
                                        const qtyVal = parseFloat(record.quantity) || 0;
                                        const rateKgVal = qtyVal ? (netBillVal / qtyVal) : 0;
                                        const dollarRateVal = parseFloat(record.rsToDollar) || 0;
                                        const rateKgUsdVal = dollarRateVal ? (rateKgVal / dollarRateVal) : 0;
                                        const bdtRateVal = parseFloat(record.dollarRateBdt) || 0;
                                        const rateKgBdtVal = rateKgUsdVal * bdtRateVal;
                                        const cfExpVal = record.cfOtherExpense !== undefined ? record.cfOtherExpense : '9';
                                        const costingKgVal = rateKgBdtVal + (parseFloat(cfExpVal) || 0);
                                        return (
                                            <tr
                                                key={record._id}
                                                className={`border-b border-gray-50 transition-colors hover:bg-gray-50/70 ${isSelected ? 'bg-blue-50' : ''}`}
                                                onClick={() => { if (isSelectionMode) toggleSelection(record._id); }}
                                                onContextMenu={e => {
                                                    e.preventDefault();
                                                    setIsSelectionMode(true);
                                                    toggleSelection(record._id);
                                                }}
                                            >
                                                {isSelectionMode && (
                                                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => { if (!isSelectionMode) setIsSelectionMode(true); toggleSelection(record._id); }}
                                                            className="rounded"
                                                        />
                                                    </td>
                                                )}
                                                <td className="px-4 py-3 text-sm text-gray-600">{record.date ? formatDate(record.date) : '—'}</td>
                                                <td className="px-4 py-3 text-sm font-semibold text-gray-900">{record.lcNo ? record.lcNo.slice(-5) : '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{record.supplier || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{record.invoiceNo || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{record.truckNo || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{record.product || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{record.brand || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{record.quantity || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{record.amount ? `${Number(record.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RS` : '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{netBillVal !== undefined && netBillVal !== null && netBillVal !== '' ? `${Number(netBillVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RS` : '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{rateKgBdtVal !== undefined && rateKgBdtVal !== null && rateKgBdtVal !== '' ? `${Number(rateKgBdtVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT` : '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{cfExpVal !== undefined && cfExpVal !== null && cfExpVal !== '' ? `${Number(cfExpVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT` : '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{costingKgVal !== undefined && costingKgVal !== null && costingKgVal !== '' ? `${Number(costingKgVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT` : '—'}</td>
                                                <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button onClick={() => setViewData(record)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="View">
                                                            <EyeIcon className="w-4 h-4 text-gray-500 hover:text-blue-600 transition-colors" />
                                                        </button>
                                                        {canEdit && (
                                                            <button onClick={() => handleEdit(record)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Edit">
                                                                <EditIcon className="w-4 h-4 text-gray-500 hover:text-yellow-500 transition-colors" />
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button onClick={() => handleDelete(record._id)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Delete">
                                                                <TrashIcon className="w-4 h-4 text-gray-500 hover:text-red-500 transition-colors" />
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
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
                        <BoxIcon className="w-14 h-14 text-gray-200 mx-auto mb-4" />
                        <p className="text-base font-semibold text-gray-500 mb-1">No records found</p>
                        <p className="text-sm text-gray-400">Add a new Cost of Goods entry to get started.</p>
                    </div>
                )
            )}

            {showForm && (
                <div className="relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-[40px] border border-white/50 shadow-2xl p-8 transition-all duration-300">
                    <div className="flex items-center justify-between pb-6 mb-6 border-b border-gray-100">
                        <div>
                            <h3 className="text-lg font-black text-gray-900 tracking-tight">{editingId ? 'Edit Record' : 'New Cost of Goods Entry'}</h3>
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Cost of Goods Record</p>
                        </div>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                                e.preventDefault();
                            }
                        }}
                        className="space-y-4"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Date Field */}
                            <CustomDatePicker
                                label="Date"
                                value={formData.date}
                                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                name="date"
                                required
                                compact={true}
                                labelClassName="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1"
                            />

                            {/* Lc No Searchable Dropdown */}
                            <div className="space-y-1.5 relative" ref={lcDropdownRef}>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">LC No</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search & Select LC No..."
                                        value={lcDropdownOpen ? lcSearchQuery : (formData.lcNo || '')}
                                        onChange={(e) => {
                                            setLcSearchQuery(e.target.value);
                                            setHighlightedLcIndex(-1);
                                            if (!lcDropdownOpen) setLcDropdownOpen(true);
                                        }}
                                        onFocus={() => {
                                            setLcDropdownOpen(true);
                                            setLcSearchQuery('');
                                            setHighlightedLcIndex(-1);
                                        }}
                                        onKeyDown={handleLcKeyDown}
                                        autoComplete="off"
                                        className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none pr-10"
                                        required
                                    />
                                    <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                </div>
                                {lcDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[110] max-h-56 overflow-y-auto py-1">
                                        {lcs.filter(l => (l.lcNo || '').toLowerCase().includes(lcSearchQuery.toLowerCase())).length > 0 ? (
                                            lcs.filter(l => (l.lcNo || '').toLowerCase().includes(lcSearchQuery.toLowerCase())).map((lc, idx) => (
                                                <button
                                                    key={lc._id}
                                                    type="button"
                                                    onMouseEnter={() => setHighlightedLcIndex(idx)}
                                                    onClick={() => handleLcSelect(lc)}
                                                    className={`w-full px-5 py-3 text-left text-sm transition-colors group ${highlightedLcIndex === idx
                                                        ? 'bg-blue-50'
                                                        : formData.lcNo === lc.lcNo
                                                            ? 'bg-blue-50/60'
                                                            : 'hover:bg-blue-50'
                                                        }`}
                                                >
                                                    <div className="font-bold text-blue-600 group-hover:text-blue-700">{lc.lcNo}</div>
                                                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-0.5">
                                                        {lc.importerName || '—'} → {lc.exporterName || '—'}
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-5 py-6 text-center text-gray-400">
                                                <BoxIcon className="w-7 h-7 mb-2 mx-auto opacity-20" />
                                                <p className="text-xs font-medium">No LC found</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Importer (Auto Fill) */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Importer (Auto fill)</label>
                                <input
                                    type="text"
                                    value={formData.importer}
                                    readOnly
                                    placeholder="Select LC No first"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 cursor-not-allowed outline-none"
                                />
                            </div>

                            {/* Exporter (Auto Fill) */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Exporter (Auto fill)</label>
                                <input
                                    type="text"
                                    value={formData.exporter}
                                    readOnly
                                    placeholder="Select LC No first"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 cursor-not-allowed outline-none"
                                />
                            </div>

                            {/* Supplier Searchable Dropdown */}
                            <div className="space-y-1.5 relative" ref={supplierDropdownRef}>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Supplier</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder={formData.exporter ? "Search & Select Supplier..." : "Select LC / Exporter first"}
                                        value={supplierDropdownOpen ? supplierSearchQuery : (formData.supplier || '')}
                                        onChange={(e) => {
                                            setSupplierSearchQuery(e.target.value);
                                            setHighlightedSupplierIndex(-1);
                                            if (!supplierDropdownOpen) setSupplierDropdownOpen(true);
                                        }}
                                        onFocus={() => {
                                            if (!formData.exporter) return;
                                            setSupplierDropdownOpen(true);
                                            setSupplierSearchQuery('');
                                            setHighlightedSupplierIndex(-1);
                                        }}
                                        onKeyDown={handleSupplierKeyDown}
                                        autoComplete="off"
                                        disabled={!formData.exporter}
                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none pr-10 ${!formData.exporter ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100' : ''
                                            }`}
                                        required
                                    />
                                    <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                </div>
                                {supplierDropdownOpen && formData.exporter && (
                                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[110] max-h-56 overflow-y-auto py-1">
                                        {filteredSuppliersForExporter.filter(s => (s.name || '').toLowerCase().includes(supplierSearchQuery.toLowerCase())).length > 0 ? (
                                            filteredSuppliersForExporter.filter(s => (s.name || '').toLowerCase().includes(supplierSearchQuery.toLowerCase())).map((sup, idx) => (
                                                <button
                                                    key={sup._id}
                                                    type="button"
                                                    onMouseEnter={() => setHighlightedSupplierIndex(idx)}
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, supplier: sup.name }));
                                                        setSupplierDropdownOpen(false);
                                                        setSupplierSearchQuery('');
                                                        setHighlightedSupplierIndex(-1);
                                                    }}
                                                    className={`w-full px-5 py-3 text-left text-sm transition-colors group ${highlightedSupplierIndex === idx
                                                        ? 'bg-blue-50'
                                                        : formData.supplier === sup.name
                                                            ? 'bg-blue-50/60'
                                                            : 'hover:bg-blue-50'
                                                        }`}
                                                >
                                                    <div className="font-bold text-blue-600 group-hover:text-blue-700">{sup.name}</div>
                                                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-0.5">
                                                        Exporter: {sup.exporter || '—'}
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-5 py-6 text-center text-gray-400">
                                                <BoxIcon className="w-7 h-7 mb-2 mx-auto opacity-20" />
                                                <p className="text-xs font-medium">No suppliers found for "{formData.exporter}"</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Invoice No */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Invoice No</label>
                                <input
                                    type="text"
                                    name="invoiceNo"
                                    value={formData.invoiceNo}
                                    onChange={handleInputChange}
                                    placeholder="Enter Invoice No..."
                                    className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                />
                            </div>

                            {/* Truck No */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Truck No</label>
                                <input
                                    type="text"
                                    name="truckNo"
                                    value={formData.truckNo}
                                    onChange={handleInputChange}
                                    placeholder="Enter Truck No..."
                                    className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                />
                            </div>

                            {/* Product Auto Fill or Dropdown Select */}
                            <div className="space-y-1.5 relative" ref={productDropdownRef}>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Product</label>
                                {hasMultipleProducts ? (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            readOnly
                                            placeholder="Select Product (Multiple available)"
                                            value={formData.product || ''}
                                            onClick={() => setProductDropdownOpen(true)}
                                            onKeyDown={handleProductKeyDown}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 cursor-pointer outline-none select-none"
                                            required
                                        />
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                        {productDropdownOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[110] max-h-56 overflow-y-auto py-1">
                                                {selectedLcProducts.map((prod, idx) => (
                                                    <button
                                                        key={prod}
                                                        type="button"
                                                        onMouseEnter={() => setHighlightedProductIndex(idx)}
                                                        onClick={() => handleProductSelect(prod)}
                                                        className={`w-full px-5 py-3 text-left text-sm transition-colors group ${highlightedProductIndex === idx
                                                            ? 'bg-blue-50'
                                                            : formData.product === prod
                                                                ? 'bg-blue-50/60'
                                                                : 'hover:bg-blue-50'
                                                            }`}
                                                    >
                                                        <div className="font-bold text-blue-600 group-hover:text-blue-700">{prod}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        value={formData.product}
                                        readOnly
                                        placeholder={formData.lcNo ? "Auto filled" : "Select LC No first"}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 cursor-not-allowed outline-none"
                                    />
                                )}
                            </div>

                            {/* Brand searchable dropdown */}
                            <div className="space-y-1.5 relative" ref={brandDropdownRef}>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Brand</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder={formData.product ? "Search & Select Brand..." : "Select Product first"}
                                        value={brandDropdownOpen ? brandSearchQuery : (formData.brand || '')}
                                        onChange={(e) => {
                                            setBrandSearchQuery(e.target.value);
                                            setHighlightedBrandIndex(-1);
                                            if (!brandDropdownOpen) setBrandDropdownOpen(true);
                                        }}
                                        onFocus={() => {
                                            if (!formData.product) return;
                                            setBrandDropdownOpen(true);
                                            setBrandSearchQuery('');
                                            setHighlightedBrandIndex(-1);
                                        }}
                                        onKeyDown={handleBrandKeyDown}
                                        autoComplete="off"
                                        disabled={!formData.product}
                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none pr-10 ${!formData.product ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100' : ''
                                            }`}
                                        required
                                    />
                                    <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                </div>
                                {brandDropdownOpen && formData.product && (
                                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[110] max-h-56 overflow-y-auto py-1">
                                        {filteredBrands.length > 0 ? (
                                            filteredBrands.map((b, idx) => (
                                                <button
                                                    key={b}
                                                    type="button"
                                                    onMouseEnter={() => setHighlightedBrandIndex(idx)}
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, brand: b }));
                                                        setBrandDropdownOpen(false);
                                                        setBrandSearchQuery('');
                                                        setHighlightedBrandIndex(-1);
                                                    }}
                                                    className={`w-full px-5 py-3 text-left text-sm transition-colors group ${highlightedBrandIndex === idx
                                                        ? 'bg-blue-50'
                                                        : formData.brand === b
                                                            ? 'bg-blue-50/60'
                                                            : 'hover:bg-blue-50'
                                                        }`}
                                                >
                                                    <div className="font-bold text-blue-600 group-hover:text-blue-700">{b}</div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-5 py-6 text-center text-gray-400">
                                                <BoxIcon className="w-7 h-7 mb-2 mx-auto opacity-20" />
                                                <p className="text-xs font-medium">No brands found for "{formData.product}"</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Quantity */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Quantity</label>
                                <input
                                    type="number"
                                    name="quantity"
                                    value={formData.quantity}
                                    onChange={handleInputChange}
                                    placeholder="0"
                                    min="0"
                                    step="any"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                />
                            </div>

                            {/* Amount */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Invoice Value</label>
                                <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} required placeholder="0.00" min="0" step="0.01" className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none" />
                            </div>

                            {/* IND Truck Fare */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">IND Truck Fare</label>
                                <input
                                    type="number"
                                    name="indTruckFare"
                                    value={formData.indTruckFare}
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                />
                            </div>

                            {/* SLOF / CF */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">SLOF / CF</label>
                                <input
                                    type="number"
                                    name="slofCf"
                                    value={formData.slofCf}
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                />
                            </div>

                            {/* Total BILL */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Total BILL</label>
                                <input
                                    type="text"
                                    name="totalBill"
                                    value={(() => {
                                        const amount = parseFloat(formData.amount) || 0;
                                        const indTruckFare = parseFloat(formData.indTruckFare) || 0;
                                        const slofCf = parseFloat(formData.slofCf) || 0;
                                        return (amount + indTruckFare + slofCf).toLocaleString() + ' RS';
                                    })()}
                                    disabled
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 font-semibold cursor-not-allowed outline-none"
                                />
                            </div>

                            {/* Rebate */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Rebate (%)</label>
                                <input
                                    type="number"
                                    name="rebate"
                                    value={formData.rebate}
                                    onChange={handleInputChange}
                                    placeholder="2.9"
                                    step="0.01"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                />
                            </div>

                            {/* Rebate Amount */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Rebate</label>
                                <input
                                    type="text"
                                    name="rebateAmount"
                                    value={(() => {
                                        const amount = parseFloat(formData.amount) || 0;
                                        const indTruckFare = parseFloat(formData.indTruckFare) || 0;
                                        const slofCf = parseFloat(formData.slofCf) || 0;
                                        const totalBill = amount + indTruckFare + slofCf;
                                        const rebatePct = parseFloat(formData.rebate) || 0;
                                        const calculatedRebateVal = (totalBill * rebatePct) / 100;
                                        return calculatedRebateVal.toLocaleString() + ' RS';
                                    })()}
                                    disabled
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 font-semibold cursor-not-allowed outline-none"
                                />
                            </div>

                            {/* Net Bill */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Net Bill</label>
                                <input
                                    type="text"
                                    name="netBill"
                                    value={(() => {
                                        const amount = parseFloat(formData.amount) || 0;
                                        const indTruckFare = parseFloat(formData.indTruckFare) || 0;
                                        const slofCf = parseFloat(formData.slofCf) || 0;
                                        const totalBill = amount + indTruckFare + slofCf;
                                        const rebatePct = parseFloat(formData.rebate) || 0;
                                        const calculatedRebateVal = (totalBill * rebatePct) / 100;
                                        const calculatedNetBill = totalBill - calculatedRebateVal;
                                        return calculatedNetBill.toLocaleString() + ' RS';
                                    })()}
                                    disabled
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 font-semibold cursor-not-allowed outline-none"
                                />
                            </div>

                            {/* Rate/KG */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Rate/KG</label>
                                <input
                                    type="text"
                                    name="rateKg"
                                    value={(() => {
                                        const amount = parseFloat(formData.amount) || 0;
                                        const indTruckFare = parseFloat(formData.indTruckFare) || 0;
                                        const slofCf = parseFloat(formData.slofCf) || 0;
                                        const totalBill = amount + indTruckFare + slofCf;
                                        const rebatePct = parseFloat(formData.rebate) || 0;
                                        const calculatedRebateVal = (totalBill * rebatePct) / 100;
                                        const calculatedNetBill = totalBill - calculatedRebateVal;
                                        const qty = parseFloat(formData.quantity) || 0;
                                        const calculatedRateKg = qty ? (calculatedNetBill / qty) : 0;
                                        return calculatedRateKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' RS';
                                    })()}
                                    disabled
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 font-semibold cursor-not-allowed outline-none"
                                />
                            </div>

                            {/* Rs to Dollar Rate */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Rs to Dollar Rate</label>
                                <input
                                    type="number"
                                    name="rsToDollar"
                                    value={formData.rsToDollar}
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.0001"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                />
                            </div>

                            {/* Rate/Kg USD */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Rate/Kg USD</label>
                                <input
                                    type="text"
                                    name="rateKgUsd"
                                    value={(() => {
                                        const amount = parseFloat(formData.amount) || 0;
                                        const indTruckFare = parseFloat(formData.indTruckFare) || 0;
                                        const slofCf = parseFloat(formData.slofCf) || 0;
                                        const totalBill = amount + indTruckFare + slofCf;
                                        const rebatePct = parseFloat(formData.rebate) || 0;
                                        const calculatedRebateVal = (totalBill * rebatePct) / 100;
                                        const calculatedNetBill = totalBill - calculatedRebateVal;
                                        const qty = parseFloat(formData.quantity) || 0;
                                        const calculatedRateKg = qty ? (calculatedNetBill / qty) : 0;
                                        const dollarRate = parseFloat(formData.rsToDollar) || 0;
                                        const calculatedRateKgUsd = dollarRate ? (calculatedRateKg / dollarRate) : 0;
                                        return calculatedRateKgUsd.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' USD';
                                    })()}
                                    disabled
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 font-semibold cursor-not-allowed outline-none"
                                />
                            </div>

                            {/* Dollar rate BDT */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Dollar rate BDT</label>
                                <input
                                    type="number"
                                    name="dollarRateBdt"
                                    value={formData.dollarRateBdt}
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                />
                            </div>

                            {/* Rate/KG BDT */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Rate/KG BDT</label>
                                <input
                                    type="text"
                                    name="rateKgBdt"
                                    value={(() => {
                                        const amount = parseFloat(formData.amount) || 0;
                                        const indTruckFare = parseFloat(formData.indTruckFare) || 0;
                                        const slofCf = parseFloat(formData.slofCf) || 0;
                                        const totalBill = amount + indTruckFare + slofCf;
                                        const rebatePct = parseFloat(formData.rebate) || 0;
                                        const calculatedRebateVal = (totalBill * rebatePct) / 100;
                                        const calculatedNetBill = totalBill - calculatedRebateVal;
                                        const qty = parseFloat(formData.quantity) || 0;
                                        const calculatedRateKg = qty ? (calculatedNetBill / qty) : 0;
                                        const dollarRate = parseFloat(formData.rsToDollar) || 0;
                                        const calculatedRateKgUsd = dollarRate ? (calculatedRateKg / dollarRate) : 0;
                                        const bdtRate = parseFloat(formData.dollarRateBdt) || 0;
                                        const calculatedRateKgBdt = calculatedRateKgUsd * bdtRate;
                                        return calculatedRateKgBdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' BDT';
                                    })()}
                                    disabled
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 font-semibold cursor-not-allowed outline-none"
                                />
                            </div>

                            {/* C&F & Other Expance */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">C&F & Other Expance</label>
                                <input
                                    type="number"
                                    name="cfOtherExpense"
                                    value={formData.cfOtherExpense}
                                    onChange={handleInputChange}
                                    placeholder="9"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                />
                            </div>

                            {/* Costing/kg */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Costing/kg</label>
                                <input
                                    type="text"
                                    name="costingKg"
                                    value={(() => {
                                        const amount = parseFloat(formData.amount) || 0;
                                        const indTruckFare = parseFloat(formData.indTruckFare) || 0;
                                        const slofCf = parseFloat(formData.slofCf) || 0;
                                        const totalBill = amount + indTruckFare + slofCf;
                                        const rebatePct = parseFloat(formData.rebate) || 0;
                                        const calculatedRebateVal = (totalBill * rebatePct) / 100;
                                        const calculatedNetBill = totalBill - calculatedRebateVal;
                                        const qty = parseFloat(formData.quantity) || 0;
                                        const calculatedRateKg = qty ? (calculatedNetBill / qty) : 0;
                                        const dollarRate = parseFloat(formData.rsToDollar) || 0;
                                        const calculatedRateKgUsd = dollarRate ? (calculatedRateKg / dollarRate) : 0;
                                        const bdtRate = parseFloat(formData.dollarRateBdt) || 0;
                                        const calculatedRateKgBdt = calculatedRateKgUsd * bdtRate;
                                        const expense = parseFloat(formData.cfOtherExpense) || 0;
                                        const calculatedCostingKg = calculatedRateKgBdt + expense;
                                        return calculatedCostingKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' BDT';
                                    })()}
                                    disabled
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 font-semibold cursor-not-allowed outline-none"
                                />
                            </div>

                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                            {submitStatus === 'success' && <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-semibold"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>Saved!</span>}
                            {submitStatus === 'error' && <span className="text-red-500 text-sm font-semibold">Failed. Try again.</span>}
                            <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-5 py-2 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all">Cancel</button>
                            <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                                {isSubmitting ? 'Saving...' : editingId ? 'Update Record' : 'Save Record'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* View Detail Modal */}
            {viewData && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setViewData(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 tracking-tight">Cost of Goods Entry</h3>
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Detail View</p>
                            </div>
                            <button onClick={() => setViewData(null)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-8 grid grid-cols-2 gap-5">
                            {[
                                ['Date', viewData.date ? formatDate(viewData.date) : '—'],
                                ['LC No', viewData.lcNo],
                                ['Importer', viewData.importer],
                                ['Exporter', viewData.exporter],
                                ['Supplier', viewData.supplier],
                                ['Invoice No', viewData.invoiceNo],
                                ['Truck No', viewData.truckNo || '—'],
                                ['Product', viewData.product],
                                ['Brand', viewData.brand],
                                ['Quantity', viewData.quantity],
                                ['Invoice Value', viewData.amount ? `${Number(viewData.amount).toLocaleString()} RS` : '—'],
                                ['IND Truck Fare', viewData.indTruckFare ? `${Number(viewData.indTruckFare).toLocaleString()} RS` : '—'],
                                ['SLOF / CF', viewData.slofCf ? `${Number(viewData.slofCf).toLocaleString()} RS` : '—'],
                                ['Total BILL', (() => {
                                    const sumVal = viewData.totalBill !== undefined ? viewData.totalBill : ((parseFloat(viewData.amount) || 0) + (parseFloat(viewData.indTruckFare) || 0) + (parseFloat(viewData.slofCf) || 0));
                                    return sumVal ? `${Number(sumVal).toLocaleString()} RS` : '—';
                                })()],
                                ['Rebate %', (() => {
                                    const pct = viewData.rebate !== undefined ? viewData.rebate : (viewData.redate !== undefined ? viewData.redate : '2.9');
                                    return pct !== undefined && pct !== null && pct !== '' ? `${pct}%` : '—';
                                })()],
                                ['Rebate', (() => {
                                    const sumVal = viewData.totalBill !== undefined ? viewData.totalBill : ((parseFloat(viewData.amount) || 0) + (parseFloat(viewData.indTruckFare) || 0) + (parseFloat(viewData.slofCf) || 0));
                                    const rebatePct = parseFloat(viewData.rebate !== undefined ? viewData.rebate : (viewData.redate !== undefined ? viewData.redate : '2.9')) || 0;
                                    const rebateVal = viewData.rebateAmount !== undefined ? viewData.rebateAmount : (viewData.redateAmount !== undefined ? viewData.redateAmount : ((sumVal * rebatePct) / 100));
                                    return rebateVal !== undefined && rebateVal !== null && rebateVal !== '' ? `${Number(rebateVal).toLocaleString()} RS` : '—';
                                })()],
                                ['Net Bill', (() => {
                                    const sumVal = viewData.totalBill !== undefined ? viewData.totalBill : ((parseFloat(viewData.amount) || 0) + (parseFloat(viewData.indTruckFare) || 0) + (parseFloat(viewData.slofCf) || 0));
                                    const rebatePct = parseFloat(viewData.rebate !== undefined ? viewData.rebate : (viewData.redate !== undefined ? viewData.redate : '2.9')) || 0;
                                    const rebateVal = viewData.rebateAmount !== undefined ? viewData.rebateAmount : (viewData.redateAmount !== undefined ? viewData.redateAmount : ((sumVal * rebatePct) / 100));
                                    const netBillVal = viewData.netBill !== undefined ? viewData.netBill : (sumVal - rebateVal);
                                    return netBillVal !== undefined && netBillVal !== null && netBillVal !== '' ? `${Number(netBillVal).toLocaleString()} RS` : '—';
                                })()],
                                ['Rate/KG', (() => {
                                    const sumVal = viewData.totalBill !== undefined ? viewData.totalBill : ((parseFloat(viewData.amount) || 0) + (parseFloat(viewData.indTruckFare) || 0) + (parseFloat(viewData.slofCf) || 0));
                                    const rebatePct = parseFloat(viewData.rebate !== undefined ? viewData.rebate : (viewData.redate !== undefined ? viewData.redate : '2.9')) || 0;
                                    const rebateVal = viewData.rebateAmount !== undefined ? viewData.rebateAmount : (viewData.redateAmount !== undefined ? viewData.redateAmount : ((sumVal * rebatePct) / 100));
                                    const netBillVal = viewData.netBill !== undefined ? viewData.netBill : (sumVal - rebateVal);
                                    const qtyVal = parseFloat(viewData.quantity) || 0;
                                    const rateKgVal = qtyVal ? (netBillVal / qtyVal) : 0;
                                    return rateKgVal !== undefined && rateKgVal !== null && rateKgVal !== '' ? `${Number(rateKgVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RS` : '—';
                                })()],
                                ['Rs to Dollar Rate', viewData.rsToDollar || '—'],
                                ['Rate/Kg USD', (() => {
                                    const sumVal = viewData.totalBill !== undefined ? viewData.totalBill : ((parseFloat(viewData.amount) || 0) + (parseFloat(viewData.indTruckFare) || 0) + (parseFloat(viewData.slofCf) || 0));
                                    const rebatePct = parseFloat(viewData.rebate !== undefined ? viewData.rebate : (viewData.redate !== undefined ? viewData.redate : '2.9')) || 0;
                                    const rebateVal = viewData.rebateAmount !== undefined ? viewData.rebateAmount : (viewData.redateAmount !== undefined ? viewData.redateAmount : ((sumVal * rebatePct) / 100));
                                    const netBillVal = viewData.netBill !== undefined ? viewData.netBill : (sumVal - rebateVal);
                                    const qtyVal = parseFloat(viewData.quantity) || 0;
                                    const rateKgVal = qtyVal ? (netBillVal / qtyVal) : 0;
                                    const dollarRateVal = parseFloat(viewData.rsToDollar) || 0;
                                    const rateKgUsdVal = dollarRateVal ? (rateKgVal / dollarRateVal) : 0;
                                    return rateKgUsdVal !== undefined && rateKgUsdVal !== null && rateKgUsdVal !== '' ? `${Number(rateKgUsdVal).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} USD` : '—';
                                })()],
                                ['Dollar rate BDT', viewData.dollarRateBdt ? `${Number(viewData.dollarRateBdt).toLocaleString()} BDT` : '—'],
                                ['Rate/KG BDT', (() => {
                                    const sumVal = viewData.totalBill !== undefined ? viewData.totalBill : ((parseFloat(viewData.amount) || 0) + (parseFloat(viewData.indTruckFare) || 0) + (parseFloat(viewData.slofCf) || 0));
                                    const rebatePct = parseFloat(viewData.rebate !== undefined ? viewData.rebate : (viewData.redate !== undefined ? viewData.redate : '2.9')) || 0;
                                    const rebateVal = viewData.rebateAmount !== undefined ? viewData.rebateAmount : (viewData.redateAmount !== undefined ? viewData.redateAmount : ((sumVal * rebatePct) / 100));
                                    const netBillVal = viewData.netBill !== undefined ? viewData.netBill : (sumVal - rebateVal);
                                    const qtyVal = parseFloat(viewData.quantity) || 0;
                                    const rateKgVal = qtyVal ? (netBillVal / qtyVal) : 0;
                                    const dollarRateVal = parseFloat(viewData.rsToDollar) || 0;
                                    const rateKgUsdVal = dollarRateVal ? (rateKgVal / dollarRateVal) : 0;
                                    const bdtRateVal = parseFloat(viewData.dollarRateBdt) || 0;
                                    const rateKgBdtVal = rateKgUsdVal * bdtRateVal;
                                    return rateKgBdtVal !== undefined && rateKgBdtVal !== null && rateKgBdtVal !== '' ? `${Number(rateKgBdtVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT` : '—';
                                })()],
                                ['C&F & Other Expance', (() => {
                                    const val = viewData.cfOtherExpense !== undefined ? viewData.cfOtherExpense : '9';
                                    return val ? `${Number(val).toLocaleString()} BDT` : '—';
                                })()],
                                ['Costing/kg', (() => {
                                    const sumVal = viewData.totalBill !== undefined ? viewData.totalBill : ((parseFloat(viewData.amount) || 0) + (parseFloat(viewData.indTruckFare) || 0) + (parseFloat(viewData.slofCf) || 0));
                                    const rebatePct = parseFloat(viewData.rebate !== undefined ? viewData.rebate : (viewData.redate !== undefined ? viewData.redate : '2.9')) || 0;
                                    const rebateVal = viewData.rebateAmount !== undefined ? viewData.rebateAmount : (viewData.redateAmount !== undefined ? viewData.redateAmount : ((sumVal * rebatePct) / 100));
                                    const netBillVal = viewData.netBill !== undefined ? viewData.netBill : (sumVal - rebateVal);
                                    const qtyVal = parseFloat(viewData.quantity) || 0;
                                    const rateKgVal = qtyVal ? (netBillVal / qtyVal) : 0;
                                    const dollarRateVal = parseFloat(viewData.rsToDollar) || 0;
                                    const rateKgUsdVal = dollarRateVal ? (rateKgVal / dollarRateVal) : 0;
                                    const bdtRateVal = parseFloat(viewData.dollarRateBdt) || 0;
                                    const rateKgBdtVal = rateKgUsdVal * bdtRateVal;
                                    const cfExpVal = parseFloat(viewData.cfOtherExpense !== undefined ? viewData.cfOtherExpense : '9') || 0;
                                    const costingKgVal = rateKgBdtVal + cfExpVal;
                                    return costingKgVal !== undefined && costingKgVal !== null && costingKgVal !== '' ? `${Number(costingKgVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT` : '—';
                                })()],
                            ].map(([label, value]) => (
                                <div key={label} className="space-y-1">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                                    <p className="text-sm font-medium text-gray-800">{value || '—'}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } table th, table td { white-space: nowrap; }`}</style>
        </div>
    );
};

export default CostOfGoods;
