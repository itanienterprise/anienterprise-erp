import React, { useState, useEffect, useRef } from 'react';
import { EditIcon, TrashIcon, EyeIcon, XIcon, BoxIcon, SearchIcon, PlusIcon } from '../../Icons';
import { API_BASE_URL, SortIcon, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import './CostOfGoods.css';
import { hasPermission } from '../../../utils/permissionHelper';

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
    const canEdit   = hasPermission(currentUser, 'costOfGoods', 'edit');
    const canDelete = hasPermission(currentUser, 'costOfGoods', 'delete');
    const canCreate = hasPermission(currentUser, 'costOfGoods', 'create');

    const [showForm,    setShowForm]    = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [records,     setRecords]     = useState([]);
    const [isLoading,   setIsLoading]   = useState(false);
    const [viewData,    setViewData]    = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig,  setSortConfig]  = useState({ key: null, direction: 'asc' });

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

    // Refs for click outside detection
    const lcDropdownRef = useRef(null);
    const supplierDropdownRef = useRef(null);
    const productDropdownRef = useRef(null);

    const [formData, setFormData] = useState({
        lcNo: '',
        importer: '',
        exporter: '',
        supplier: '',
        product: '',
        brand: '',
        amount: '',
        currency: 'BDT',
        date: '',
        status: 'Active',
        description: '',
        notes: ''
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const url = editingId
                ? `${API_BASE_URL}/api/cost-of-goods/${editingId}`
                : `${API_BASE_URL}/api/cost-of-goods`;
            if (editingId) await axios.put(url, formData);
            else           await axios.post(url, formData);
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
            product: '',
            brand: '',
            amount: '',
            currency: 'BDT',
            date: '',
            status: 'Active',
            description: '',
            notes: ''
        });
        setEditingId(null);
        setSubmitStatus(null);
        setLcSearchQuery('');
        setSupplierSearchQuery('');
    };

    const handleEdit = (record) => {
        setFormData({
            lcNo:        record.lcNo        || '',
            importer:    record.importer    || '',
            exporter:    record.exporter    || '',
            supplier:    record.supplier    || '',
            product:     record.product     || '',
            brand:       record.brand       || '',
            amount:      record.amount      || '',
            currency:    record.currency    || 'BDT',
            date:        record.date        || '',
            status:      record.status      || 'Active',
            description: record.description || '',
            notes:       record.notes       || '',
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
        (r.product || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.brand || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sortedRecords = [...filteredRecords].sort((a, b) => {
        if (!sortConfig.key) return 0;
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
                        <div className="overflow-x-auto">
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
                                        <th onClick={() => requestSort('importer')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">Importer <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="importer" /></div>
                                        </th>
                                        <th onClick={() => requestSort('exporter')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">Exporter <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="exporter" /></div>
                                        </th>
                                        <th onClick={() => requestSort('supplier')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">Supplier <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="supplier" /></div>
                                        </th>
                                        <th onClick={() => requestSort('product')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">Product <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="product" /></div>
                                        </th>
                                        <th onClick={() => requestSort('brand')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">Brand <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="brand" /></div>
                                        </th>
                                        <th onClick={() => requestSort('amount')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">Amount <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="amount" /></div>
                                        </th>
                                        <th onClick={() => requestSort('status')} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                                            <div className="flex items-center gap-1">Status <SortIcon config={sortConfig} columnKey="costOfGoods" targetKey="status" /></div>
                                        </th>
                                        <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedRecords.map(record => {
                                        const isSelected = selectedItems.has(record._id);
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
                                                <td className="px-4 py-3 text-sm font-semibold text-gray-900">{record.lcNo}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{record.importer || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{record.exporter || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{record.supplier || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{record.product || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{record.brand || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{record.amount ? `${Number(record.amount).toLocaleString()} ${record.currency || 'BDT'}` : '—'}</td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${record.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                                        {record.status}
                                                    </span>
                                                </td>
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
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Date</label>
                                <input type="date" name="date" value={formData.date} onChange={handleInputChange} required className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none" />
                            </div>

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
                                                    className={`w-full px-5 py-3 text-left text-sm transition-colors group ${
                                                        highlightedLcIndex === idx
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
                                        disabled={!formData.exporter}
                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none pr-10 ${
                                            !formData.exporter ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100' : ''
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
                                                    className={`w-full px-5 py-3 text-left text-sm transition-colors group ${
                                                        highlightedSupplierIndex === idx
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
                                                        className={`w-full px-5 py-3 text-left text-sm transition-colors group ${
                                                            highlightedProductIndex === idx
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

                            {/* Brand dropdown and show brand for selected product */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Brand</label>
                                <div className="relative">
                                    <select 
                                        name="brand" 
                                        value={formData.brand || ''} 
                                        onChange={handleInputChange} 
                                        disabled={!formData.product}
                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none appearance-none pr-9 cursor-pointer ${
                                            !formData.product ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100' : ''
                                        }`}
                                        required
                                    >
                                        <option value="">Select Brand</option>
                                        {productBrands.map(b => (
                                            <option key={b} value={b}>{b}</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                            </div>

                            {/* Amount */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Amount</label>
                                <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} required placeholder="0.00" min="0" step="0.01" className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none" />
                            </div>

                            {/* Currency */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Currency</label>
                                <div className="relative">
                                    <select name="currency" value={formData.currency} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none appearance-none pr-9 cursor-pointer">
                                        <option value="BDT">BDT</option>
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="INR">INR</option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Status</label>
                                <div className="relative">
                                    <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none appearance-none pr-9 cursor-pointer">
                                        <option>Active</option>
                                        <option>Inactive</option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="md:col-span-4 space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Description</label>
                                <textarea name="description" value={formData.description} onChange={handleInputChange} placeholder="Brief description..." rows="2" className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none resize-none" />
                            </div>

                            {/* Notes */}
                            <div className="md:col-span-4 space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Notes</label>
                                <textarea name="notes" value={formData.notes} onChange={handleInputChange} placeholder="Additional notes..." rows="2" className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none resize-none" />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                            {submitStatus === 'success' && <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-semibold"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>Saved!</span>}
                            {submitStatus === 'error'   && <span className="text-red-500 text-sm font-semibold">Failed. Try again.</span>}
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
                                ['Date',        viewData.date ? formatDate(viewData.date) : '—'],
                                ['LC No',       viewData.lcNo],
                                ['Importer',    viewData.importer],
                                ['Exporter',    viewData.exporter],
                                ['Supplier',    viewData.supplier],
                                ['Product',     viewData.product],
                                ['Brand',       viewData.brand],
                                ['Amount',      viewData.amount ? `${Number(viewData.amount).toLocaleString()} ${viewData.currency || 'BDT'}` : '—'],
                                ['Status',      viewData.status],
                                ['Description', viewData.description],
                                ['Notes',       viewData.notes],
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

            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
    );
};

export default CostOfGoods;
