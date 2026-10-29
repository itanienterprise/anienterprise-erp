import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PlusIcon, XIcon, EditIcon, TrashIcon, BoxIcon, ChevronDownIcon, EyeIcon, SearchIcon } from '../../Icons';
import { API_BASE_URL } from '../../../utils/helpers';
import axios from '../../../utils/api';
import { queryClient } from '../../../utils/queryClient';
import { QUERY_KEYS } from '../../../hooks/useQueries';
import StockHistoryModal from '../../shared/StockHistoryModal';
import TableScrollNav from '../../shared/TableScrollNav';
import './ProductManagement.css';
import { hasPermission } from '../../../utils/permissionHelper';

const ProductManagement = ({ 
    products, 
    fetchProducts,
    stockRecords,
    warehouseData,
    salesRecords,
    damages,
    setShowProductHistoryReport,
    setProductHistoryReportData
}) => {
    const [showProductForm, setShowProductForm] = useState(false);
    const [viewData, setViewData] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const canAdd = hasPermission(currentUser, 'product', 'add');
    const canEdit = hasPermission(currentUser, 'product', 'edit');
    const canDelete = hasPermission(currentUser, 'product', 'delete');
    const cannotDelete = !canDelete;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedCard, setExpandedCard] = useState(null);
    const [originalBrands, setOriginalBrands] = useState([]);
    const [toast, setToast] = useState(null);
    const toastTimerRef = useRef(null);

    const showToast = (message, type = 'success') => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ message, type });
        toastTimerRef.current = setTimeout(() => setToast(null), 4000);
    };

    const filteredProducts = useMemo(() => {
        if (!products || !Array.isArray(products)) return [];
        if (!searchQuery.trim()) return products;

        const query = searchQuery.toLowerCase().trim();

        return products
            .map(product => {
                const nameMatch = (product.name || '').toLowerCase().includes(query);
                const ipNameMatch = (product.ipName || '').toLowerCase().includes(query);
                const hsCodeMatch = (product.hsCode || '').toLowerCase().includes(query);
                const hsCodeIndMatch = (product.hsCodeInd || '').toLowerCase().includes(query);
                const categoryMatch = (product.category || '').toLowerCase().includes(query);
                const descMatch = (product.description || '').toLowerCase().includes(query);

                const matchingBrands = (product.brands || []).filter(b =>
                    (b.brand || '').toLowerCase().includes(query) ||
                    (b.quality || '').toLowerCase().includes(query)
                );
                const singleBrandMatch = (product.brand || '').toLowerCase().includes(query);

                const isProductLevelMatch = nameMatch || ipNameMatch || hsCodeMatch || hsCodeIndMatch || categoryMatch || descMatch;
                const isBrandMatch = matchingBrands.length > 0 || singleBrandMatch;

                if (!isProductLevelMatch && !isBrandMatch) {
                    return null;
                }

                // If matched specifically by brand (and not by product-level fields), filter brands to only matching brands
                let displayBrands = product.brands;
                if (isBrandMatch && !isProductLevelMatch && matchingBrands.length > 0) {
                    displayBrands = matchingBrands;
                }

                return {
                    ...product,
                    brands: displayBrands
                };
            })
            .filter(Boolean);
    }, [products, searchQuery]);
    const [productFormData, setProductFormData] = useState({
        hsCode: '',
        hsCodeInd: '',
        ipName: '',
        name: '',
        category: '',
        cnfOther: '',
        uom: 'kg',
        brands: [{ brand: '', quality: '', packetSize: '', purchasedPrice: '' }],
        description: ''
    });

    const resetProductForm = () => {
        setProductFormData({
            hsCode: '',
            hsCodeInd: '',
            ipName: '',
            name: '',
            category: '',
            cnfOther: '',
            uom: 'kg',
            brands: [{ brand: '', quality: '', packetSize: '', purchasedPrice: '' }],
            description: ''
        });
        setOriginalBrands([]);
        setEditingId(null);
    };

    const toggleCard = (id) => {
        setExpandedCard(prev => prev === id ? null : id);
    };

    const handleProductBrandChange = (index, field, value) => {
        const newBrands = [...productFormData.brands];
        newBrands[index][field] = value;
        setProductFormData(prev => ({ ...prev, brands: newBrands }));
    };

    const handleAddProductBrand = () => {
        setProductFormData(prev => ({
            ...prev,
            brands: [...prev.brands, { brand: '', quality: '', packetSize: '', purchasedPrice: '' }]
        }));
    };

    const handleRemoveProductBrand = (index) => {
        if (productFormData.brands.length > 1) {
            setProductFormData(prev => ({
                ...prev,
                brands: prev.brands.filter((_, i) => i !== index)
            }));
        }
    };

    const handleProductSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const brandRenames = [];
        if (editingId && originalBrands.length > 0) {
            const currentBrandNames = (productFormData.brands || []).map(b => (b.brand || '').trim().toLowerCase()).filter(Boolean);
            const origBrandNames = originalBrands.map(ob => (ob || '').trim().toLowerCase()).filter(Boolean);

            (productFormData.brands || []).forEach(b => {
                const oldBrand = (b.origBrand || '').trim();
                const newBrand = (b.brand || '').trim();
                if (
                    oldBrand &&
                    newBrand &&
                    oldBrand.toLowerCase() !== newBrand.toLowerCase() &&
                    origBrandNames.includes(oldBrand.toLowerCase()) &&
                    !currentBrandNames.includes(oldBrand.toLowerCase()) &&
                    !origBrandNames.includes(newBrand.toLowerCase())
                ) {
                    brandRenames.push({
                        oldBrand,
                        newBrand,
                        productName: (productFormData.name || '').trim()
                    });
                }
            });
        }

        const submissionData = {
            ...productFormData,
            name: (productFormData.name || '').trim(),
            category: (productFormData.category || '').trim(),
            brands: (productFormData.brands || []).map(b => ({
                brand: (b.brand || '').trim(),
                quality: (b.quality || '').trim(),
                packetSize: b.packetSize || '',
                purchasedPrice: b.purchasedPrice || ''
            })),
            brandRenames
        };

        try {
            const url = editingId
                ? `${API_BASE_URL}/api/products/${editingId}`
                : `${API_BASE_URL}/api/products`;

            // Optimistic cache update for products
            if (editingId) {
                queryClient.setQueryData(QUERY_KEYS.products, (old) => {
                    if (!Array.isArray(old)) return old;
                    return old.map(p => p._id === editingId ? { ...p, ...submissionData } : p);
                });
            }

            if (editingId) {
                const res = await axios.put(url, submissionData);
                const cascadeResults = res?.data?.cascadeResults || [];
                let totalUpdated = 0;
                cascadeResults.forEach(cr => {
                    if (cr.counts) {
                        totalUpdated += Object.values(cr.counts).reduce((a, b) => a + b, 0);
                    }
                });
                if (brandRenames.length > 0) {
                    const renameTexts = brandRenames.map(r => `"${r.oldBrand}" ➔ "${r.newBrand}"`).join(', ');
                    showToast(`Product updated! Brand ${renameTexts} auto-updated across ${totalUpdated} record(s).`, 'success');
                } else {
                    showToast('Product updated successfully!', 'success');
                }
            } else {
                const res = await axios.post(url, submissionData);
                const newProd = res?.data?.product || res?.data;
                if (newProd && newProd._id) {
                    queryClient.setQueryData(QUERY_KEYS.products, (old) => [newProd, ...(Array.isArray(old) ? old : [])]);
                }
                showToast('Product created successfully!', 'success');
            }
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products });
            fetchProducts();
            setShowProductForm(false);
            resetProductForm();
            window.dispatchEvent(new CustomEvent('erp_data_updated', { detail: { module: 'products' } }));
        } catch (error) {
            console.error('Error saving product:', error);
            showToast('Failed to save product.', 'error');
            fetchProducts();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleProductEdit = (product) => {
        const fullProduct = (products || []).find(p => p._id === product._id) || product;
        const brandsList = fullProduct.brands && fullProduct.brands.length > 0
            ? fullProduct.brands.map(b => ({
                brand: b.brand || '',
                quality: b.quality || '',
                packetSize: b.packetSize || '',
                purchasedPrice: b.purchasedPrice || '',
                origBrand: (b.brand || '').trim()
            }))
            : [{
                brand: fullProduct.brand || '',
                quality: fullProduct.quality || '',
                packetSize: fullProduct.packetSize || '',
                purchasedPrice: fullProduct.purchasedPrice || '',
                origBrand: (fullProduct.brand || '').trim()
            }];

        setProductFormData({
            hsCode: fullProduct.hsCode || '',
            hsCodeInd: fullProduct.hsCodeInd || '',
            ipName: fullProduct.ipName || '',
            name: fullProduct.name || '',
            category: fullProduct.category || '',
            cnfOther: fullProduct.cnfOther || (fullProduct.cnf && fullProduct.other ? `${fullProduct.cnf} / ${fullProduct.other}` : fullProduct.cnf || fullProduct.other || ''),
            uom: fullProduct.uom || fullProduct.unit || 'kg',
            brands: brandsList,
            description: fullProduct.description || ''
        });
        setOriginalBrands(brandsList.map(b => (b.brand || '').trim()));
        setEditingId(fullProduct._id);
        setShowProductForm(true);
    };

    const handleProductDelete = async (id) => {
        if (cannotDelete) {
            alert('Forbidden: You do not have permission to delete products');
            return;
        }
        if (!window.confirm('Are you sure you want to delete this product?')) return;

        // Optimistic delete
        queryClient.setQueryData(QUERY_KEYS.products, (old) => {
            if (!Array.isArray(old)) return old;
            return old.filter(p => p._id !== id);
        });

        try {
            await axios.delete(`${API_BASE_URL}/api/products/${id}`);
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products });
            fetchProducts();
            window.dispatchEvent(new CustomEvent('erp_data_updated', { detail: { module: 'products' } }));
        } catch (error) {
            console.error('Error deleting product:', error);
            fetchProducts();
        }
    };

    return (
        <div className="product-management space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                <div className="w-full md:w-auto md:shrink-0 text-center md:text-left">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800">Products Management</h2>
                </div>

                {/* Search Bar + Mobile Add Button */}
                <div className="flex items-center gap-2 w-full md:flex-1 md:max-w-md md:mx-auto">
                    <div className="flex-1 relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by Product, Brand, HS Code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full h-10 pl-10 pr-10 bg-white/50 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <XIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Mobile-only inline Add Button */}
                    {!showProductForm && canAdd && (
                        <button
                            onClick={() => setShowProductForm(true)}
                            data-action="Create New Product"
                            className="md:hidden h-10 flex items-center justify-center px-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-md shadow-blue-500/20 transition-all transform active:scale-95 text-sm shrink-0 whitespace-nowrap"
                        >
                            <PlusIcon className="w-4 h-4 mr-1" />
                            <span>Add</span>
                        </button>
                    )}
                </div>

                {/* Desktop-only Add Button */}
                {!showProductForm && canAdd && (
                    <div className="hidden md:flex w-auto justify-end">
                        <button
                            onClick={() => setShowProductForm(true)}
                            data-action="Create New Product"
                            className="h-10 flex items-center px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 text-sm md:text-base whitespace-nowrap"
                        >
                            <PlusIcon className="w-5 h-5 mr-1.5" />
                            <span>Add New Product</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showProductForm && typeof document !== 'undefined' && document.body && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                        onClick={() => { setShowProductForm(false); resetProductForm(); }}
                    />
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 md:p-6 w-full max-w-5xl transform transition-all relative z-10 animate-scale-in max-h-[92vh] overflow-y-auto mx-auto mt-[4vh] md:mt-0 custom-scrollbar">
                        <div className="flex items-center justify-between mb-5 md:mb-6 px-4 md:px-6">
                            <h3 className="text-lg md:text-xl font-bold text-gray-800">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
                            <button
                                onClick={() => { setShowProductForm(false); resetProductForm(); }}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <form 
                            onSubmit={handleProductSubmit} 
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                                    e.preventDefault();
                                }
                            }}
                            className="w-full flex flex-col gap-6"
                        >
                            {/* Row 0: Top Grid Fields */}
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 md:gap-6 w-full">
                                <div className="col-span-1 md:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">HS Code</label>
                                    <input
                                        type="text"
                                        value={productFormData.hsCode}
                                        onChange={(e) => setProductFormData(prev => ({ ...prev, hsCode: e.target.value }))}
                                        maxLength={10}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                        placeholder="10-digit HS Code"
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">HS Code (IND)</label>
                                    <input
                                        type="text"
                                        value={productFormData.hsCodeInd}
                                        onChange={(e) => setProductFormData(prev => ({ ...prev, hsCodeInd: e.target.value }))}
                                        maxLength={10}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                        placeholder="10-digit HS Code (IND)"
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">IP Product Name</label>
                                    <input
                                        type="text"
                                        value={productFormData.ipName}
                                        onChange={(e) => setProductFormData(prev => ({ ...prev, ipName: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                        placeholder="IP Product name"
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
                                    <input
                                        type="text"
                                        value={productFormData.name}
                                        onChange={(e) => setProductFormData(prev => ({ ...prev, name: e.target.value }))}
                                        required
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                        placeholder="Product name"
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                                    <input
                                        type="text"
                                        value={productFormData.category}
                                        onChange={(e) => setProductFormData(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                        placeholder="Category"
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">C&F & OTHER</label>
                                    <input
                                        type="text"
                                        value={productFormData.cnfOther}
                                        onChange={(e) => setProductFormData(prev => ({ ...prev, cnfOther: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                        placeholder="C&F & OTHER"
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">UOM (Unit)</label>
                                    <select
                                        value={productFormData.uom}
                                        onChange={(e) => setProductFormData(prev => ({ ...prev, uom: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                    >
                                        <option value="kg">kg</option>
                                        <option value="lbs">lbs</option>
                                        <option value="pcs">pcs</option>
                                        <option value="box">box</option>
                                        <option value="set">set</option>
                                        <option value="m">m</option>
                                    </select>
                                </div>
                            </div>

                            {/* Sequential Footer Stack (Flexbox) - Forces width independently of top grid */}
                            <div className="flex flex-col gap-6 mt-2 border-t border-gray-100 pt-6 w-full">
                                {/* Row 1: Brands & Packaging */}
                                <div className="space-y-3 w-full">
                                    <div className="flex items-center justify-between pb-1 w-full">
                                        <label className="block text-sm font-bold text-gray-700">Brands &amp; Packaging</label>
                                        <button
                                            type="button"
                                            onClick={handleAddProductBrand}
                                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                        >
                                            <PlusIcon className="w-3 h-3" /> Add Brand
                                        </button>
                                    </div>
                                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar w-full">
                                        {productFormData.brands.map((brandEntry, bIndex) => (
                                            <div key={bIndex} className="flex flex-col md:flex-row gap-4 md:gap-6 items-end relative group w-full pb-2">
                                                {productFormData.brands.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveProductBrand(bIndex)}
                                                        className="absolute -top-1 -right-1 p-1 bg-white text-gray-400 hover:text-red-500 rounded-lg shadow-sm border border-gray-100 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all z-20"
                                                    >
                                                        <XIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                <div className="w-full md:flex-grow">
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Brand Name</label>
                                                    <input
                                                        type="text"
                                                        value={brandEntry.brand}
                                                        onChange={(e) => handleProductBrandChange(bIndex, 'brand', e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 transition-all bg-white"
                                                        placeholder="Brand Name"
                                                    />
                                                </div>
                                                <div className="w-full md:w-32">
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Quality</label>
                                                    <input
                                                        type="text"
                                                        value={brandEntry.quality}
                                                        onChange={(e) => handleProductBrandChange(bIndex, 'quality', e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 transition-all bg-white"
                                                        placeholder="Quality"
                                                    />
                                                </div>
                                                <div className="w-full md:w-32">
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Size</label>
                                                    <input
                                                        type="text"
                                                        value={brandEntry.packetSize}
                                                        onChange={(e) => handleProductBrandChange(bIndex, 'packetSize', e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 transition-all bg-white"
                                                        placeholder="Size"
                                                    />
                                                </div>
                                                <div className="w-full md:w-32">
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Price</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={brandEntry.purchasedPrice}
                                                        onChange={(e) => handleProductBrandChange(bIndex, 'purchasedPrice', e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 transition-all bg-white"
                                                        placeholder="Price"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Row 2: Description */}
                                <div className="flex flex-col w-full">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                                    <textarea
                                        value={productFormData.description}
                                        onChange={(e) => setProductFormData(prev => ({ ...prev, description: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none text-sm min-h-[100px]"
                                        placeholder="Product description"
                                    />
                                </div>

                                {/* Row 3: Action Buttons */}
                                <div className="flex justify-end pt-4 border-t border-gray-100/50 w-full mt-2 relative z-10">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        data-action={editingId ? `Update Product (${productFormData.name || ''})` : `Save New Product`}
                                        className={`px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all text-sm flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {isSubmitting ? (
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : (
                                            <span className="text-center">{editingId ? 'Update Product' : 'Add Product'}</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                {filteredProducts.length > 0 ? (
                    <>
                        {/* ─── Desktop Table (md and above) ─── */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">HS Code</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">HS Code (IND)</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">IP Product Name</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Name</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Brand</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Quality</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Packet Size</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">C&F & OTHER</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">UOM</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredProducts.map((product) => (
                                        <tr key={product._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-600 font-mono align-top">{product.hsCode || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600 font-mono align-top">{product.hsCodeInd || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600 align-top">{product.ipName || '-'}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 align-top">{product.name}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600 leading-relaxed align-top">
                                                {product.brands?.map((b, i) => (
                                                    <div key={i}>{b.brand || '-'}</div>
                                                )) || product.brand || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 leading-relaxed align-top">
                                                {product.brands?.map((b, i) => (
                                                    <div key={i}>{b.quality || '-'}</div>
                                                )) || product.quality || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 leading-relaxed align-top">
                                                {product.brands?.map((b, i) => (
                                                    <div key={i}>{b.packetSize || '-'}</div>
                                                )) || product.packetSize || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 align-top">{product.cnfOther || (product.cnf && product.other ? `${product.cnf} / ${product.other}` : product.cnf || product.other || '-')}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600 align-top">
                                                {product.uom || product.unit || 'kg'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 leading-relaxed align-top">
                                                {product.brands?.map((b, i) => (
                                                    <div key={i}>{b.purchasedPrice ? `TK ${b.purchasedPrice}` : '-'}</div>
                                                )) || (product.purchasedPrice ? `TK ${product.purchasedPrice}` : '-')}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 align-top">{product.category || '-'}</td>
                                            <td className="px-6 py-4 text-center align-top">
                                                <div className="flex items-center justify-center space-x-3">
                                                    <button onClick={() => setViewData((products || []).find(p => p._id === product._id) || product)} data-action={`View Product (${product.name || ''})`} title={`View Product (${product.name || ''})`} className="text-gray-400 hover:text-blue-600 transition-colors">
                                                        <EyeIcon className="w-5 h-5" />
                                                    </button>
                                                    <button onClick={() => handleProductEdit(product)} data-action={`Edit Product (${product.name || ''})`} title={`Edit Product (${product.name || ''})`} className="text-gray-400 hover:text-blue-600 transition-colors">
                                                        <EditIcon className="w-5 h-5" />
                                                    </button>
                                                    {!cannotDelete && (
                                                         <button onClick={() => handleProductDelete(product._id)} data-action={`Delete Product (${product.name || ''})`} title={`Delete Product (${product.name || ''})`} className="text-gray-400 hover:text-red-600 transition-colors">
                                                             <TrashIcon className="w-5 h-5" />
                                                         </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <TableScrollNav className="hidden md:flex" count={filteredProducts.length} />

                        {/* ─── Mobile Cards (below md) ─── */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {filteredProducts.map((product) => {
                                const isExpanded = expandedCard === product._id;
                                const brandCount = product.brands?.length || 0;
                                const displayName = product.ipName && product.ipName.trim() !== product.name?.trim()
                                    ? `${product.ipName} / ${product.name}`
                                    : product.name;

                                return (
                                    <div
                                        key={product._id}
                                        className="p-4 bg-white hover:bg-gray-50/80 transition-all cursor-pointer select-none text-left"
                                        onClick={() => toggleCard(product._id)}
                                    >
                                        {/* Card Header */}
                                        <div className="space-y-1.5">
                                            {/* Row 1: Product Name (Left) + Category Badge & Chevron (Right) */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="text-sm font-black text-gray-900 font-sans tracking-tight leading-snug break-words flex-1 min-w-0">
                                                    {displayName}
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                                                    {product.category && (
                                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100/80 px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
                                                            {product.category}
                                                        </span>
                                                    )}
                                                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180 text-blue-600' : ''}`} />
                                                </div>
                                            </div>

                                            {/* Row 2: HS Code (Left) & Brands Count (Right) */}
                                            <div className="flex items-center justify-between gap-2 text-xs">
                                                <div className="text-gray-600 font-mono text-[11px] font-semibold truncate">
                                                    {product.hsCode ? (
                                                        <span><span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-sans">HS:</span> {product.hsCode}</span>
                                                    ) : (
                                                        <span className="text-gray-400 font-sans font-normal text-[11px]">—</span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] font-medium text-gray-400 shrink-0">
                                                    {brandCount > 0 ? `${brandCount} brand${brandCount > 1 ? 's' : ''}` : 'No brands'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className="mt-3 pt-3 border-t border-gray-100 space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                                {/* Key Details Rows - Label : Value */}
                                                <div className="space-y-2 text-xs text-left">
                                                    <div className="flex items-baseline">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-28 shrink-0">HS Code</span>
                                                        <span className="text-gray-400 font-bold mx-2 shrink-0">:</span>
                                                        <span className="font-semibold text-gray-700 font-mono break-all">{product.hsCode || '-'}</span>
                                                    </div>

                                                    <div className="flex items-baseline">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-28 shrink-0">HS Code (IND)</span>
                                                        <span className="text-gray-400 font-bold mx-2 shrink-0">:</span>
                                                        <span className="font-semibold text-gray-700 font-mono break-all">{product.hsCodeInd || '-'}</span>
                                                    </div>

                                                    {product.ipName && (
                                                        <div className="flex items-baseline">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-28 shrink-0">IP Product</span>
                                                            <span className="text-gray-400 font-bold mx-2 shrink-0">:</span>
                                                            <span className="font-semibold text-gray-700 break-words flex-1">{product.ipName}</span>
                                                        </div>
                                                    )}

                                                    <div className="flex items-baseline">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-28 shrink-0">Category</span>
                                                        <span className="text-gray-400 font-bold mx-2 shrink-0">:</span>
                                                        <span className="font-semibold text-gray-700">{product.category || '-'}</span>
                                                    </div>

                                                    <div className="flex items-baseline">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-28 shrink-0">UOM / Unit</span>
                                                        <span className="text-gray-400 font-bold mx-2 shrink-0">:</span>
                                                        <span className="font-semibold text-gray-700">{product.uom || product.unit || 'kg'}</span>
                                                    </div>

                                                    {(product.cnfOther || product.cnf || product.other) && (
                                                        <div className="flex items-baseline">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-28 shrink-0">C&F & Other</span>
                                                            <span className="text-gray-400 font-bold mx-2 shrink-0">:</span>
                                                            <span className="font-semibold text-gray-700 break-words flex-1">
                                                                {product.cnfOther || (product.cnf && product.other ? `${product.cnf} / ${product.other}` : product.cnf || product.other || '-')}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {product.description && (
                                                        <div className="flex items-baseline">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-28 shrink-0">Description</span>
                                                            <span className="text-gray-400 font-bold mx-2 shrink-0">:</span>
                                                            <span className="font-semibold text-gray-700 leading-relaxed break-words flex-1">{product.description}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Brands Section */}
                                                {product.brands && product.brands.length > 0 && (
                                                    <div className="pt-2 border-t border-gray-100">
                                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                                            Brands ({product.brands.length})
                                                        </div>
                                                        <div className="bg-gray-50/70 rounded-xl border border-gray-200/70 divide-y divide-gray-200/60 overflow-hidden">
                                                            {product.brands.map((b, i) => (
                                                                <div key={i} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="font-bold text-gray-800 truncate">{b.brand || '-'}</div>
                                                                        {b.quality && (
                                                                            <div className="text-[10px] text-gray-400 font-medium">{b.quality}</div>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        <div className="font-semibold text-gray-700">
                                                                            {b.packetSize ? `${b.packetSize} ${product.uom || product.unit || 'kg'}` : '-'}
                                                                        </div>
                                                                        {b.purchasedPrice && (
                                                                            <div className="text-[11px] font-bold text-emerald-600">
                                                                                ৳{parseFloat(b.purchasedPrice).toLocaleString('en-IN')}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Card Actions - Bottom Round Shape Buttons */}
                                                <div className="pt-3 border-t border-gray-100 flex items-start justify-around gap-1 mt-2">
                                                    {/* View */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setViewData((products || []).find(p => p._id === product._id) || product);
                                                        }}
                                                        className="group flex-1 flex flex-col items-center justify-center gap-1.5 py-1 px-1 min-w-0 transition-transform active:scale-95 cursor-pointer bg-transparent border-0"
                                                        title={`View Product (${product.name || ''})`}
                                                    >
                                                        <div className="w-11 h-11 rounded-full flex items-center justify-center bg-[#f8fafc] border border-[#e2e8f0] text-blue-600 shadow-[0_2px_6px_rgba(0,0,0,0.04)] transition-all duration-200 group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-200 group-hover:scale-105 group-active:scale-95 shrink-0">
                                                            <EyeIcon className="w-5 h-5 transition-transform duration-150" />
                                                        </div>
                                                        <span className="text-[11.5px] font-semibold text-[#475569] text-center leading-[1.2] tracking-[-0.01em] transition-colors group-hover:text-blue-700">
                                                            View
                                                        </span>
                                                    </button>

                                                    {/* Edit */}
                                                    {canEdit && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleProductEdit(product);
                                                            }}
                                                            className="group flex-1 flex flex-col items-center justify-center gap-1.5 py-1 px-1 min-w-0 transition-transform active:scale-95 cursor-pointer bg-transparent border-0"
                                                            title={`Edit Product (${product.name || ''})`}
                                                        >
                                                            <div className="w-11 h-11 rounded-full flex items-center justify-center bg-[#f8fafc] border border-[#e2e8f0] text-[#475569] shadow-[0_2px_6px_rgba(0,0,0,0.04)] transition-all duration-200 group-hover:bg-[#f1f5f9] group-hover:text-[#1e293b] group-hover:border-[#cbd5e1] group-hover:scale-105 group-active:scale-95 shrink-0">
                                                                <EditIcon className="w-5 h-5 transition-transform duration-150" />
                                                            </div>
                                                            <span className="text-[11.5px] font-semibold text-[#475569] text-center leading-[1.2] tracking-[-0.01em] transition-colors group-hover:text-[#1e293b]">
                                                                Edit
                                                            </span>
                                                        </button>
                                                    )}

                                                    {/* Delete */}
                                                    {!cannotDelete && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleProductDelete(product._id);
                                                            }}
                                                            className="group flex-1 flex flex-col items-center justify-center gap-1.5 py-1 px-1 min-w-0 transition-transform active:scale-95 cursor-pointer bg-transparent border-0"
                                                            title={`Delete Product (${product.name || ''})`}
                                                        >
                                                            <div className="w-11 h-11 rounded-full flex items-center justify-center bg-[#f8fafc] border border-[#e2e8f0] text-[#475569] shadow-[0_2px_6px_rgba(0,0,0,0.04)] transition-all duration-200 group-hover:bg-red-50 group-hover:text-red-600 group-hover:border-red-200 group-hover:scale-105 group-active:scale-95 shrink-0">
                                                                <TrashIcon className="w-5 h-5 transition-transform duration-150" />
                                                            </div>
                                                            <span className="text-[11.5px] font-semibold text-[#475569] text-center leading-[1.2] tracking-[-0.01em] transition-colors group-hover:text-red-600">
                                                                Delete
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center p-12">
                        <div className="p-4 bg-gray-50 rounded-full mb-4">
                            <BoxIcon className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">
                            {searchQuery ? `No products matching "${searchQuery}"` : 'No products found'}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                            {searchQuery ? 'Try searching for a different keyword' : 'Click "Add New Product" to create a product'}
                        </p>
                    </div>
                )}
            </div>

            {viewData && (
                <StockHistoryModal
                    viewRecord={viewData}
                    setViewRecord={setViewData}
                    stockRecords={stockRecords}
                    salesRecords={salesRecords}
                    warehouseData={warehouseData}
                    damages={damages}
                    setShowProductHistoryReport={setShowProductHistoryReport}
                    setProductHistoryReportData={setProductHistoryReportData}
                />
            )}

            {toast && createPortal(
                <div className="fixed bottom-6 right-6 z-[9999] animate-in fade-in slide-in-from-bottom-5 duration-300">
                    <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border text-sm font-medium ${
                        toast.type === 'error'
                            ? 'bg-red-50 text-red-800 border-red-200 shadow-red-500/10'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-emerald-500/10'
                    }`}>
                        <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
                        <span>{toast.message}</span>
                        <button onClick={() => setToast(null)} className="ml-2 text-gray-400 hover:text-gray-600">
                            ✕
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ProductManagement;
