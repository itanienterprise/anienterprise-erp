import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EditIcon, TrashIcon, SearchIcon, XIcon, ChevronDownIcon, CheckIcon } from '../../Icons';
import { API_BASE_URL } from '../../../utils/helpers';
import axios from '../../../utils/api';
import CustomDatePicker from '../../shared/CustomDatePicker';

const DamageManagement = ({ currentUser, products, warehouseData, salesRecords, stockRecords, damages, fetchDamages, fetchStockRecords, addNotification }) => {
    const isDataEntry = (currentUser?.role || '').toLowerCase() === 'data entry';
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedRowId, setExpandedRowId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        productName: '',
        brand: '',
        lcNo: '',
        warehouse: '',
        price: '',
        quantity: '',
        reason: 'Broken',
        remarks: ''
    });

    useEffect(() => {
        if (fetchDamages) fetchDamages();
        if (fetchStockRecords) fetchStockRecords();
    }, []);

    const [activeDropdown, setActiveDropdown] = useState(null); // 'product', 'brand', 'lcNo', 'warehouse', 'reason'
    const [productSearch, setProductSearch] = useState('');
    const [brandSearch, setBrandSearch] = useState('');
    const [lcSearch, setLcSearch] = useState('');
    const [warehouseSearch, setWarehouseSearch] = useState('');

    const productRef = useRef(null);
    const brandRef = useRef(null);
    const lcRef = useRef(null);
    const warehouseRef = useRef(null);
    const reasonRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (activeDropdown === 'product' && productRef.current && !productRef.current.contains(event.target)) setActiveDropdown(null);
            if (activeDropdown === 'brand' && brandRef.current && !brandRef.current.contains(event.target)) setActiveDropdown(null);
            if (activeDropdown === 'lcNo' && lcRef.current && !lcRef.current.contains(event.target)) setActiveDropdown(null);
            if (activeDropdown === 'warehouse' && warehouseRef.current && !warehouseRef.current.contains(event.target)) setActiveDropdown(null);
            if (activeDropdown === 'reason' && reasonRef.current && !reasonRef.current.contains(event.target)) setActiveDropdown(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown]);

    const uniqueLcNos = useMemo(() => {
        if (!stockRecords) return [];
        return [...new Set(stockRecords.map(s => s.lcNo).filter(Boolean))].sort();
    }, [stockRecords]);

    const filteredProducts = useMemo(() => {
        if (!formData.lcNo) return [];
        const targetLc = formData.lcNo.trim().toLowerCase();
        const matchingStocks = stockRecords?.filter(s => (s.lcNo || '').trim().toLowerCase() === targetLc) || [];
        const productNames = new Set(matchingStocks.map(s => s.productName || s.product).filter(Boolean));
        if (productNames.size > 0) {
            return products?.filter(p => productNames.has(p.name)) || [];
        }
        return products || [];
    }, [formData.lcNo, products, stockRecords]);

    const selectedProductBrands = useMemo(() => {
        if (!formData.productName || !formData.lcNo) return [];
        const targetProd = formData.productName.trim().toLowerCase();
        const targetLc = formData.lcNo.trim().toLowerCase();
        
        const matches = stockRecords?.filter(s => {
            const prod = (s.productName || s.product || '').trim().toLowerCase();
            const lc = (s.lcNo || '').trim().toLowerCase();
            return prod === targetProd && lc === targetLc;
        }) || [];
        
        const uniqueBrands = [...new Set(matches.map(s => s.brand).filter(Boolean))];
        if (uniqueBrands.length > 0) {
            return uniqueBrands.map(brand => ({ brand }));
        }
        
        const product = products?.find(p => p.name === formData.productName);
        return product?.brands || [];
    }, [formData.productName, formData.lcNo, products, stockRecords]);


    const currentStock = useMemo(() => {
        if (!formData.productName || !formData.warehouse) return null; // Return null to indicate missing selection

        const targetWH = formData.warehouse.trim().toLowerCase();
        const targetProd = formData.productName.trim().toLowerCase();
        const targetBrand = (formData.brand || '').trim().toLowerCase();
        const targetLc = (formData.lcNo || '').trim().toLowerCase();

        // Standardize "General / In Stock" name matching
        const isGeneralWH = targetWH === 'general / in stock' || targetWH === '';

        // 1. Sum physical warehouse stock from warehouseData
        const matches = warehouseData?.filter(w => {
            const wh = (w.whName || w.warehouse || w.name || '').trim().toLowerCase();
            const prod = (w.productName || w.product || '').trim().toLowerCase();
            const brand = (w.brand || w.quality || '').trim().toLowerCase();
            const lc = (w.lcNo || '').trim().toLowerCase();

            const whMatch = wh === targetWH || (isGeneralWH && (wh === '' || wh === 'general / in stock'));
            const prodMatch = prod === targetProd;

            // Fixed brand match: if targetBrand is empty, sum ALL brands.
            // If targetBrand is specified, match it exactly, OR match '-' if item has no brand.
            const brandMatch = !targetBrand || brand === targetBrand || (brand === '-' && targetBrand === '');
            
            // LC match
            const lcMatch = !targetLc || lc === targetLc;

            return whMatch && prodMatch && brandMatch && lcMatch;
        });

        let physicalStock = matches?.reduce((sum, m) => sum + (parseFloat(m.whQty) || 0), 0) || 0;

        // 2. Subtract sales matching this specific warehouse + product + brand + lcNo
        let totalSales = 0;
        salesRecords?.forEach(sale => {
            const sStatus = (sale.status || '').toLowerCase();
            if (sStatus !== 'accepted' && sStatus !== 'pending') return;

            if (sale.items && Array.isArray(sale.items)) {
                sale.items.forEach(saleItem => {
                    const prodName = (saleItem.productName || '').trim().toLowerCase();
                    if (prodName !== targetProd) return;

                    if (saleItem.brandEntries && Array.isArray(saleItem.brandEntries)) {
                        saleItem.brandEntries.forEach(entry => {
                            const whName = (entry.warehouseName || '').trim().toLowerCase();
                            const brandName = (entry.brand || entry.quality || '').trim().toLowerCase();
                            const lcName = (entry.lcNo || saleItem.lcNo || sale.lcNo || '').trim().toLowerCase();

                            const whMatch = whName === targetWH || (isGeneralWH && (whName === '' || whName === 'general / in stock'));
                            if (whMatch) {
                                const brandMatch = !targetBrand || brandName === targetBrand || (brandName === '-' && targetBrand === '') || (brandName === '' && targetBrand === '');
                                const lcMatch = !targetLc || lcName === targetLc;
                                if (brandMatch && lcMatch) {
                                    totalSales += parseFloat(entry.originalQuantity || entry.quantity) || 0;
                                }
                            }
                        });
                    }
                });
            }
        });

        // 3. Subtract other damages for this specific warehouse + product + brand + lcNo
        let totalDamages = 0;
        damages?.forEach(d => {
            // Skip the current record being edited to avoid double subtraction
            if (editingId && d._id === editingId) return;

            const dWH = (d.warehouse || '').trim().toLowerCase();
            const dProd = (d.productName || '').trim().toLowerCase();
            const dBrand = (d.brand || '').trim().toLowerCase();
            const dLc = (d.lcNo || '').trim().toLowerCase();

            const whMatch = dWH === targetWH || (isGeneralWH && (dWH === '' || dWH === 'general / in stock'));
            if (whMatch && dProd === targetProd) {
                const brandMatch = !targetBrand || dBrand === targetBrand || (dBrand === '-' && targetBrand === '') || (dBrand === '' && targetBrand === '');
                const lcMatch = !targetLc || dLc === targetLc;
                if (brandMatch && lcMatch) {
                    totalDamages += parseFloat(d.quantity) || 0;
                }
            }
        });

        return Math.max(0, physicalStock - totalSales - totalDamages);
    }, [formData.productName, formData.brand, formData.lcNo, formData.warehouse, warehouseData, salesRecords, damages, editingId]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // date is handled via handleInputChange directly

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            const url = editingId ? `${API_BASE_URL}/api/damages/${editingId}` : `${API_BASE_URL}/api/damages`;
            if (editingId) {
                await axios.put(url, formData);
            } else {
                await axios.post(url, formData);
            }
            setSubmitStatus('success');
            if (addNotification) addNotification('success', `Damage record ${editingId ? 'updated' : 'added'} successfully`);
            if (fetchDamages) fetchDamages();
            setTimeout(() => {
                setShowForm(false);
                setEditingId(null);
                resetForm();
                setSubmitStatus(null);
            }, 2000);
        } catch (error) {
            console.error('Error saving damage record:', error);
            setSubmitStatus('error');
            if (addNotification) addNotification('error', 'Failed to save damage record');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            date: new Date().toISOString().split('T')[0],
            productName: '',
            brand: '',
            lcNo: '',
            warehouse: '',
            price: '',
            quantity: '',
            reason: 'Broken',
            remarks: ''
        });
        setEditingId(null);
        setSubmitStatus(null);
    };

    const handleEdit = (damage) => {
        setFormData({
            date: damage.date ? new Date(damage.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            productName: damage.productName || '',
            brand: damage.brand || '',
            lcNo: damage.lcNo || '',
            warehouse: damage.warehouse || '',
            price: damage.price || '',
            quantity: damage.quantity || '',
            reason: damage.reason || 'Broken',
            remarks: damage.remarks || ''
        });
        setEditingId(damage._id);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (isDataEntry) {
            alert('Forbidden: Data entry users are not allowed to delete damage records');
            return;
        }
        if (window.confirm('Are you sure you want to delete this damage record?')) {
            try {
                await axios.delete(`${API_BASE_URL}/api/damages/${id}`);
                if (addNotification) addNotification('success', 'Damage record deleted');
                if (fetchDamages) fetchDamages();
            } catch (error) {
                console.error('Error deleting damage:', error);
                if (addNotification) addNotification('error', 'Failed to delete damage record');
            }
        }
    };

    const uniqueWarehouses = useMemo(() => {
        if (!warehouseData) return [];
        return [...new Set(warehouseData.map(w => w.whName || w.warehouse || w.name).filter(Boolean))];
    }, [warehouseData]);

    const displayDamages = useMemo(() => {
        let filtered = damages.filter(d =>
            (d.productName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (d.warehouse || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (d.reason || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (d.lcNo || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
        return filtered;
    }, [damages, searchQuery]);

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-GB');
    };

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {!showForm ? (
                    <>
                        <div className="w-full md:w-1/3 text-center md:text-left">
                            <h2 className="text-2xl font-bold text-gray-800">Damage Management</h2>
                            <p className="text-sm text-gray-500 mt-1">Track damaged and lost stock items</p>
                        </div>

                        <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                            <div className="absolute inset-y-0 left-0 pl-5.5 md:pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by product, warehouse, or reason..."
                                className="h-10 block w-full pl-10 pr-4 bg-white/80 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </>
                ) : (
                    <div className="hidden md:block md:flex-1"></div>
                )}

                <div className={`${showForm ? 'w-full md:w-auto flex justify-end hidden' : 'w-full md:w-1/4 flex justify-end'} gap-3`}>
                    {!showForm && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="h-10 border border-transparent w-full md:w-auto px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 flex items-center justify-center text-sm"
                        >
                            <span className="mr-2 text-xl font-bold">+</span>
                            <span>Add Damage Record</span>
                        </button>
                    )}
                </div>
            </div>

            {showForm && (
                <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 p-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-800">{editingId ? 'Edit Damage Record' : 'New Damage Record'}</h3>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-red-500 transition-colors"><XIcon className="w-5 h-5" /></button>
                    </div>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Date</label>
                            <CustomDatePicker
                                name="date"
                                value={formData.date}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">LC No</label>
                            <div className="relative" ref={lcRef}>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        placeholder="Search LC No..."
                                        className="w-full pl-4 pr-16 py-2.5 bg-white border border-gray-200 rounded-xl text-sm shadow-sm hover:border-gray-300 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-medium placeholder:text-gray-400"
                                        value={activeDropdown === 'lcNo' ? lcSearch : formData.lcNo}
                                        onChange={(e) => {
                                            setLcSearch(e.target.value);
                                            setFormData({ ...formData, lcNo: e.target.value });
                                            setActiveDropdown('lcNo');
                                        }}
                                        onFocus={() => {
                                            setLcSearch(formData.lcNo || '');
                                            setActiveDropdown('lcNo');
                                        }}
                                        autoComplete="off"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        {formData.lcNo && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData({ ...formData, lcNo: '', productName: '', brand: '' });
                                                    setProductSearch('');
                                                    setBrandSearch('');
                                                    setLcSearch('');
                                                }}
                                                className="p-1 hover:bg-gray-100 rounded-md text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <XIcon className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setActiveDropdown(activeDropdown === 'lcNo' ? null : 'lcNo')}
                                            className="text-gray-400 hover:text-blue-500 transition-colors"
                                        >
                                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'lcNo' ? 'rotate-180 text-blue-500' : ''}`} />
                                        </button>
                                    </div>
                                </div>

                                {activeDropdown === 'lcNo' && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-[110] max-h-60 flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                                        <div className="overflow-y-auto py-1">
                                            {uniqueLcNos.filter(lc => (lc || '').toLowerCase().includes(lcSearch.toLowerCase())).map((lc, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({ ...formData, lcNo: lc, productName: '', brand: '' });
                                                        setProductSearch('');
                                                        setBrandSearch('');
                                                        setLcSearch(lc);
                                                        setActiveDropdown(null);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
                                                >
                                                    <span className={formData.lcNo === lc ? 'text-blue-600 font-bold' : 'text-gray-700 font-medium'}>
                                                        {lc}
                                                    </span>
                                                    {formData.lcNo === lc && <CheckIcon className="w-4 h-4 text-blue-600" />}
                                                </button>
                                            ))}
                                            {uniqueLcNos.filter(lc => (lc || '').toLowerCase().includes(lcSearch.toLowerCase())).length === 0 && (
                                                <div className="px-4 py-3 text-xs text-gray-400 text-center italic">No LC numbers found</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Product Name</label>
                            <div className="relative" ref={productRef}>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        placeholder={!formData.lcNo ? "Select LC No first" : "Search products..."}
                                        className={`w-full pl-4 pr-16 py-2.5 bg-white border border-gray-200 rounded-xl text-sm shadow-sm transition-all outline-none font-medium ${!formData.lcNo ? 'bg-gray-50/50 cursor-not-allowed opacity-60' : 'hover:border-gray-300 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500'}`}
                                        value={activeDropdown === 'product' ? productSearch : formData.productName}
                                        onChange={(e) => {
                                            if (!formData.lcNo) return;
                                            setProductSearch(e.target.value);
                                            setActiveDropdown('product');
                                        }}
                                        onFocus={() => {
                                            if (!formData.lcNo) return;
                                            setProductSearch(formData.productName || '');
                                            setActiveDropdown('product');
                                        }}
                                        disabled={!formData.lcNo}
                                        autoComplete="off"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        {formData.productName && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData({ ...formData, productName: '', brand: '' });
                                                    setProductSearch('');
                                                    setBrandSearch('');
                                                }}
                                                className="p-1 hover:bg-gray-100 rounded-md text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <XIcon className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => formData.lcNo && setActiveDropdown(activeDropdown === 'product' ? null : 'product')}
                                            className="text-gray-400 hover:text-blue-500 transition-colors"
                                            disabled={!formData.lcNo}
                                        >
                                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'product' ? 'rotate-180 text-blue-500' : ''}`} />
                                        </button>
                                    </div>
                                </div>

                                {activeDropdown === 'product' && formData.lcNo && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-[110] max-h-60 flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                                        <div className="overflow-y-auto py-1">
                                            {filteredProducts?.filter(p => (p.name || '').toLowerCase().includes(productSearch.toLowerCase())).map((p, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({ ...formData, productName: p.name, brand: '' });
                                                        setProductSearch(p.name);
                                                        setBrandSearch('');
                                                        setActiveDropdown(null);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
                                                >
                                                    <span className={formData.productName === p.name ? 'text-blue-600 font-bold' : 'text-gray-700 font-medium'}>
                                                        {p.name}
                                                    </span>
                                                    {formData.productName === p.name && <CheckIcon className="w-4 h-4 text-blue-600" />}
                                                </button>
                                            ))}
                                            {filteredProducts?.filter(p => (p.name || '').toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                                                <div className="px-4 py-3 text-xs text-gray-400 text-center italic">No products found</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Brand</label>
                            <div className="relative" ref={brandRef}>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        placeholder={!formData.productName ? "Select product first" : "Search brands..."}
                                        className={`w-full pl-4 pr-16 py-2.5 bg-white border border-gray-200 rounded-xl text-sm shadow-sm transition-all outline-none font-medium ${!formData.productName ? 'bg-gray-50/50 cursor-not-allowed opacity-60' : 'hover:border-gray-300 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500'}`}
                                        value={activeDropdown === 'brand' ? brandSearch : formData.brand}
                                        onChange={(e) => {
                                            if (!formData.productName) return;
                                            setBrandSearch(e.target.value);
                                            setActiveDropdown('brand');
                                        }}
                                        onFocus={() => {
                                            if (!formData.productName) return;
                                            setBrandSearch(formData.brand || '');
                                            setActiveDropdown('brand');
                                        }}
                                        disabled={!formData.productName}
                                        autoComplete="off"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        {formData.brand && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData({ ...formData, brand: '' });
                                                    setBrandSearch('');
                                                }}
                                                className="p-1 hover:bg-gray-100 rounded-md text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <XIcon className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => formData.productName && setActiveDropdown(activeDropdown === 'brand' ? null : 'brand')}
                                            className="text-gray-400 hover:text-blue-500 transition-colors"
                                            disabled={!formData.productName}
                                        >
                                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'brand' ? 'rotate-180 text-blue-500' : ''}`} />
                                        </button>
                                    </div>
                                </div>

                                {activeDropdown === 'brand' && formData.productName && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-[110] max-h-60 flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                                        <div className="overflow-y-auto py-1">
                                            {selectedProductBrands.filter(b => (b.brand || '').toLowerCase().includes(brandSearch.toLowerCase())).map((b, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({ ...formData, brand: b.brand });
                                                        setBrandSearch(b.brand);
                                                        setActiveDropdown(null);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
                                                >
                                                    <span className={formData.brand === b.brand ? 'text-blue-600 font-bold' : 'text-gray-700 font-medium'}>
                                                        {b.brand}
                                                    </span>
                                                    {formData.brand === b.brand && <CheckIcon className="w-4 h-4 text-blue-600" />}
                                                </button>
                                            ))}
                                            {selectedProductBrands.filter(b => (b.brand || '').toLowerCase().includes(brandSearch.toLowerCase())).length === 0 && (
                                                <div className="px-4 py-3 text-xs text-gray-400 text-center italic">No brands found</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Warehouse</label>
                            <div className="relative" ref={warehouseRef}>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        placeholder="Search warehouse..."
                                        className="w-full pl-4 pr-16 py-2.5 bg-white border border-gray-200 rounded-xl text-sm shadow-sm hover:border-gray-300 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-medium placeholder:text-gray-400"
                                        value={activeDropdown === 'warehouse' ? warehouseSearch : formData.warehouse}
                                        onChange={(e) => {
                                            setWarehouseSearch(e.target.value);
                                            setActiveDropdown('warehouse');
                                        }}
                                        onFocus={() => {
                                            setWarehouseSearch(formData.warehouse || '');
                                            setActiveDropdown('warehouse');
                                        }}
                                        autoComplete="off"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        {formData.warehouse && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData({ ...formData, warehouse: '' });
                                                    setWarehouseSearch('');
                                                }}
                                                className="p-1 hover:bg-gray-100 rounded-md text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <XIcon className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setActiveDropdown(activeDropdown === 'warehouse' ? null : 'warehouse')}
                                            className="text-gray-400 hover:text-blue-500 transition-colors"
                                        >
                                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'warehouse' ? 'rotate-180 text-blue-500' : ''}`} />
                                        </button>
                                    </div>
                                </div>

                                {activeDropdown === 'warehouse' && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-[110] max-h-60 flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                                        <div className="overflow-y-auto py-1">
                                            {uniqueWarehouses?.filter(w => (w || '').toLowerCase().includes(warehouseSearch.toLowerCase())).map((w, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({ ...formData, warehouse: w });
                                                        setWarehouseSearch(w);
                                                        setActiveDropdown(null);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
                                                >
                                                    <span className={formData.warehouse === w ? 'text-blue-600 font-bold' : 'text-gray-700 font-medium'}>
                                                        {w}
                                                    </span>
                                                    {formData.warehouse === w && <CheckIcon className="w-4 h-4 text-blue-600" />}
                                                </button>
                                            ))}
                                            {uniqueWarehouses?.filter(w => (w || '').toLowerCase().includes(warehouseSearch.toLowerCase())).length === 0 && (
                                                <div className="px-4 py-3 text-xs text-gray-400 text-center italic">No warehouses found</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Available Stock</label>
                            <div className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold h-[45px] flex items-center border transition-colors ${currentStock === null ? 'bg-gray-50 border-gray-100 text-gray-400 italic' : 'bg-blue-50/50 border-blue-100 text-blue-700'}`}>
                                {currentStock === null ? 'Select product & warehouse' : `${currentStock.toLocaleString('en-IN')} kg`}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Rate</label>
                            <input
                                type="number"
                                name="price"
                                value={formData.price}
                                onChange={handleInputChange}
                                min="0"
                                step="0.01"
                                placeholder="Enter rate..."
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Quantity</label>
                            <input
                                type="number"
                                name="quantity"
                                value={formData.quantity}
                                onChange={handleInputChange}
                                required
                                min="0"
                                step="0.01"
                                placeholder="Enter quantity..."
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Amount</label>
                            <div className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold h-[45px] flex items-center text-gray-700">
                                {formData.price && formData.quantity ? `৳ ${(formData.price * formData.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '৳ 0.00'}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Reason</label>
                            <div className="relative" ref={reasonRef}>
                                <button
                                    type="button"
                                    onClick={() => setActiveDropdown(activeDropdown === 'reason' ? null : 'reason')}
                                    className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm shadow-sm hover:border-gray-300 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none group"
                                >
                                    <span className="text-gray-900 font-medium">{formData.reason}</span>
                                    <div className="flex items-center gap-2">
                                        <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${activeDropdown === 'reason' ? 'rotate-180 text-blue-500' : 'group-hover:text-gray-600'}`} />
                                    </div>
                                </button>

                                {activeDropdown === 'reason' && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-[110] py-1 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                                        {['Broken', 'Lost', 'Expired', 'Damaged', 'Other'].map((reason) => (
                                            <button
                                                key={reason}
                                                type="button"
                                                onClick={() => {
                                                    setFormData({ ...formData, reason });
                                                    setActiveDropdown(null);
                                                }}
                                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
                                            >
                                                <span className={formData.reason === reason ? 'text-blue-600 font-bold' : 'text-gray-700 font-medium'}>
                                                    {reason}
                                                </span>
                                                {formData.reason === reason && <CheckIcon className="w-4 h-4 text-blue-600" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>



                        <div className="space-y-2 lg:col-span-2">
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Remarks</label>
                            <input
                                type="text"
                                name="remarks"
                                value={formData.remarks}
                                onChange={handleInputChange}
                                placeholder="Any additional notes..."
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="md:col-span-2 lg:col-span-3 flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                            {submitStatus === 'success' && <span className="text-emerald-600 text-sm font-bold mr-auto">✓ Saved successfully!</span>}
                            <button type="submit" disabled={isSubmitting} className={`px-8 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md transition-colors ${isSubmitting ? 'opacity-50' : ''}`}>
                                {isSubmitting ? 'Saving...' : 'Save Record'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/80">
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Date</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Product</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Brand</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">LC No</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Warehouse</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 text-right">Quantity</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 text-right">Rate</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 text-right">Total Amount</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 text-right">Reason</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {isLoading ? (
                                    Array(3).fill(0).map((_, i) => <tr key={i}><td colSpan="10" className="px-6 py-4 animate-pulse bg-gray-50"></td></tr>)
                                ) : displayDamages.length > 0 ? (
                                    displayDamages.map((item) => (
                                        <tr key={item._id} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-6 py-4 text-[13px] font-medium text-gray-500 whitespace-nowrap">{formatDate(item.date)}</td>
                                            <td className="px-6 py-4 text-[13px] font-bold text-gray-900">{item.productName}</td>
                                            <td className="px-6 py-4 text-[13px] font-semibold text-gray-600">{item.brand || '-'}</td>
                                            <td className="px-6 py-4 text-[13px] font-bold text-gray-900">{item.lcNo || '-'}</td>
                                            <td className="px-6 py-4 text-[13px] font-medium text-gray-600">{item.warehouse}</td>
                                            <td className="px-6 py-4 text-[13px] font-black text-red-600 text-right">{item.quantity}</td>
                                            <td className="px-6 py-4 text-[13px] font-bold text-gray-800 text-right">{item.price ? `৳ ${item.price.toLocaleString('en-IN')}` : '-'}</td>
                                            <td className="px-6 py-4 text-[13px] font-black text-gray-900 text-right">
                                                {item.price && item.quantity ? `৳ ${(item.price * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-bold uppercase tracking-wider">{item.reason}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => handleEdit(item)} className="p-1.5 hover:bg-blue-100 text-gray-400 hover:text-blue-600 rounded-lg transition-colors"><EditIcon className="w-4 h-4" /></button>
                                                    {!isDataEntry && (
                                                        <button onClick={() => handleDelete(item._id)} className="p-1.5 hover:bg-red-100 text-gray-400 hover:text-red-600 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="10" className="px-6 py-12 text-center text-gray-400 font-medium text-sm">No damage records found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {isLoading ? (
                            Array(3).fill(0).map((_, i) => (
                                <div key={i} className="p-4 animate-pulse">
                                    <div className="h-4 bg-gray-100 rounded w-1/2 mb-2"></div>
                                    <div className="h-3 bg-gray-100 rounded w-3/4"></div>
                                </div>
                            ))
                        ) : displayDamages.length > 0 ? (
                            displayDamages.map((item) => {
                                const isExpanded = expandedRowId === item._id;
                                return (
                                    <div
                                        key={item._id}
                                        className={`transition-all duration-200 ${isExpanded ? 'bg-blue-50/20' : 'bg-white'}`}
                                    >
                                        {/* Clickable Card Header */}
                                        <div
                                            className="flex items-center justify-between p-4 cursor-pointer select-none active:bg-gray-50 transition-colors"
                                            onClick={() => setExpandedRowId(isExpanded ? null : item._id)}
                                        >
                                            <div className="flex-1 min-w-0 pr-3">
                                                <div className="text-sm font-black text-gray-900 truncate">{item.productName}</div>
                                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{formatDate(item.date)}</span>
                                                    <span className="text-gray-300">•</span>
                                                    <span className="text-[10px] font-black text-red-600">{item.quantity} kg</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="px-2.5 py-0.5 bg-red-50 text-red-600 border border-red-100/50 rounded-lg text-[10px] font-bold uppercase tracking-wider">{item.reason}</span>
                                                <div className={`p-1.5 rounded-lg transition-all ${isExpanded ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                                    <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expandable Details */}
                                        {isExpanded && (
                                            <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                                                {/* Details Grid */}
                                                <div className="grid grid-cols-[100px_8px_1fr] gap-y-2 text-xs items-baseline text-left pt-2 pb-3 border-t border-gray-100/80">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Brand</span>
                                                    <span className="text-gray-400 font-bold">:</span>
                                                    <span className="font-semibold text-gray-700">{item.brand || '-'}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">LC No</span>
                                                    <span className="text-gray-400 font-bold">:</span>
                                                    <span className="font-bold text-blue-600">{item.lcNo || '-'}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Warehouse</span>
                                                    <span className="text-gray-400 font-bold">:</span>
                                                    <span className="font-semibold text-gray-700">{item.warehouse || '-'}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quantity</span>
                                                    <span className="text-gray-400 font-bold">:</span>
                                                    <span className="font-black text-red-600">{item.quantity}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rate</span>
                                                    <span className="text-gray-400 font-bold">:</span>
                                                    <span className="font-bold text-gray-800">{item.price ? `৳ ${item.price.toLocaleString('en-IN')}` : '-'}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Amt</span>
                                                    <span className="text-gray-400 font-bold">:</span>
                                                    <span className="font-black text-gray-900">
                                                        {item.price && item.quantity ? `৳ ${(item.price * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                                    </span>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 text-blue-700 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                                                    >
                                                        <EditIcon className="w-3.5 h-3.5" /> Edit
                                                    </button>
                                                    {!isDataEntry && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }}
                                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-50 text-red-600 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                                                        >
                                                            <TrashIcon className="w-3.5 h-3.5" /> Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="px-6 py-12 text-center text-gray-400 font-medium text-sm">No damage records found.</div>
                        )}
                    </div>

                </div>
            )}
        </div>
    );
};

export default DamageManagement;
