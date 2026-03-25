import React, { useState } from 'react';
import { PlusIcon, XIcon, EditIcon, TrashIcon, BoxIcon, ChevronDownIcon } from '../../Icons';
import { API_BASE_URL } from '../../../utils/helpers';
import axios from '../../../utils/api';
import './ProductManagement.css';

const ProductManagement = ({ products, fetchProducts }) => {
    const [showProductForm, setShowProductForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedCard, setExpandedCard] = useState(null);
    const [productFormData, setProductFormData] = useState({
        hsCode: '',
        hsCodeInd: '',
        name: '',
        category: '',
        uom: 'kg',
        brands: [{ brand: '', packetSize: '', purchasedPrice: '' }],
        description: ''
    });

    const resetProductForm = () => {
        setProductFormData({
            hsCode: '',
            hsCodeInd: '',
            name: '',
            category: '',
            uom: 'kg',
            brands: [{ brand: '', packetSize: '', purchasedPrice: '' }],
            description: ''
        });
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
            brands: [...prev.brands, { brand: '', packetSize: '', purchasedPrice: '' }]
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

        try {
            const url = editingId
                ? `${API_BASE_URL}/api/products/${editingId}`
                : `${API_BASE_URL}/api/products`;

            if (editingId) {
                await axios.put(url, productFormData);
            } else {
                await axios.post(url, productFormData);
            }
            await fetchProducts();
            setShowProductForm(false);
            resetProductForm();
        } catch (error) {
            console.error('Error saving product:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleProductEdit = (product) => {
        setProductFormData({
            hsCode: product.hsCode || '',
            hsCodeInd: product.hsCodeInd || '',
            name: product.name || '',
            category: product.category || '',
            uom: product.uom || product.unit || 'kg',
            brands: product.brands && product.brands.length > 0
                ? product.brands
                : [{
                    brand: product.brand || '',
                    packetSize: product.packetSize || '',
                    purchasedPrice: product.purchasedPrice || ''
                }],
            description: product.description || ''
        });
        setEditingId(product._id);
        setShowProductForm(true);
    };

    const handleProductDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this product?')) return;

        try {
            await axios.delete(`${API_BASE_URL}/api/products/${id}`);
            await fetchProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
        }
    };

    return (
        <div className="product-management space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">Products Management</h2>
                <button
                    onClick={() => setShowProductForm(!showProductForm)}
                    className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 text-sm md:text-base"
                >
                    <span className="text-lg font-light mr-1 md:mr-2">+</span>
                    <span className="hidden sm:inline">Add New Product</span>
                    <span className="sm:hidden">Add</span>
                </button>
            </div>

            {/* Add/Edit Modal */}
            {showProductForm && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
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
                        <form onSubmit={handleProductSubmit} className="w-full flex flex-col gap-6">
                            {/* Row 0: Top Grid Fields */}
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 md:gap-6 w-full">
                                <div className="col-span-1 md:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">HS Code</label>
                                    <input
                                        type="text"
                                        value={productFormData.hsCode}
                                        onChange={(e) => setProductFormData(prev => ({ ...prev, hsCode: e.target.value }))}
                                        maxLength={8}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                        placeholder="HS Code"
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">HS Code (IND)</label>
                                    <input
                                        type="text"
                                        value={productFormData.hsCodeInd}
                                        onChange={(e) => setProductFormData(prev => ({ ...prev, hsCodeInd: e.target.value }))}
                                        maxLength={8}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                        placeholder="HS Code (IND)"
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-2">
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
                                                        placeholder="Enter Brand Name"
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
                                <div className="flex justify-center md:justify-end pt-4 border-t border-gray-100/50 w-full">
                                    <div className="flex items-center space-x-3 w-full md:w-auto">
                                        <button
                                            type="button"
                                            onClick={() => { setShowProductForm(false); resetProductForm(); }}
                                            className="flex-1 md:flex-none px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="flex-1 md:flex-none justify-center px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center text-sm font-semibold"
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
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                {products.length > 0 ? (
                    <>
                        {/* ─── Desktop Table (md and above) ─── */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">HS Code</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">HS Code (IND)</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Name</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Brand</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Packet Size</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">UOM</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {products.map((product) => (
                                        <tr key={product._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-600 font-mono align-top">{product.hsCode || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600 font-mono align-top">{product.hsCodeInd || '-'}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 align-top">{product.name}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600 leading-relaxed align-top">
                                                {product.brands?.map((b, i) => (
                                                    <div key={i}>{b.brand || '-'}</div>
                                                )) || product.brand || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 leading-relaxed align-top">
                                                {product.brands?.map((b, i) => (
                                                    <div key={i}>{b.packetSize || '-'}</div>
                                                )) || product.packetSize || '-'}
                                            </td>
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
                                                    <button onClick={() => handleProductEdit(product)} className="text-gray-400 hover:text-blue-600 transition-colors">
                                                        <EditIcon className="w-5 h-5" />
                                                    </button>
                                                    <button onClick={() => handleProductDelete(product._id)} className="text-gray-400 hover:text-red-600 transition-colors">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* ─── Mobile Cards (below md) ─── */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {products.map((product) => {
                                const isExpanded = expandedCard === product._id;
                                return (
                                    <div
                                        key={product._id}
                                        className="p-4 bg-white hover:bg-gray-50 transition-all cursor-pointer"
                                        onClick={() => toggleCard(product._id)}
                                    >
                                        {/* Card Header */}
                                        <div className={`flex justify-between items-center ${isExpanded ? 'mb-3' : ''}`}>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between w-full pr-2">
                                                    <div className="flex items-center gap-2 overflow-hidden mr-2">
                                                        <div className="text-sm font-bold text-gray-900 truncate"> {product.name}</div>
                                                        {!isExpanded && product.hsCode && (
                                                            <span className="text-sm font-bold text-gray-900 shrink-0 uppercase tracking-tighter"> | HS CODE:  {product.hsCode}</span>
                                                        )}

                                                    </div>
                                                    {product.category && (
                                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">{product.category}</span>
                                                    )}
                                                </div>
                                                {!isExpanded && (
                                                    <div className="text-[11px] text-gray-400 mt-0.5">
                                                        {product.brands?.length > 0 ? `${product.brands.length} brand${product.brands.length > 1 ? 's' : ''}` : 'No brands'}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                {isExpanded && (
                                                    <>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleProductEdit(product); }}
                                                            className="p-2 text-blue-600 bg-blue-50/50 rounded-lg transition-colors hover:bg-blue-100"
                                                        >
                                                            <EditIcon className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleProductDelete(product._id); }}
                                                            className="p-2 text-red-600 bg-red-50/50 rounded-lg transition-colors hover:bg-red-100"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                                <div className={`p-1 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                                    <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                                {/* Info Row */}
                                                <div className="flex justify-between items-start pt-4 border-t border-gray-100 mb-4">
                                                    <div className="">
                                                        <span className="block text-gray-400 uppercase font-black tracking-widest text-[9px] mb-0.5">HS Code</span>
                                                        <div className="text-gray-700 text-xs font-semibold font-mono">{product.hsCode || '-'}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="block text-gray-400 uppercase font-black tracking-widest text-[9px] mb-0.5">HS Code (IND)</span>
                                                        <div className="text-gray-700 text-xs font-semibold font-mono">{product.hsCodeInd || '-'}</div>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                                    {product.description && (
                                                        <div className="col-span-2">
                                                            <span className="block text-gray-400 uppercase font-black tracking-widest text-[9px] mb-0.5">Description</span>
                                                            <div className="text-gray-600 text-xs leading-relaxed">{product.description}</div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Brands */}
                                                {product.brands && product.brands.length > 0 && (
                                                    <div className="pt-4 border-t border-gray-100">
                                                        <div className="flex px-1 mb-2">
                                                            <div className="w-[55%] text-[9px] text-gray-400 uppercase font-black tracking-widest pl-2">Brand</div>
                                                            <div className="w-[20%] text-[9px] text-gray-400 uppercase font-black tracking-widest text-right">BAG</div>
                                                            <div className="w-[20%] text-[9px] text-gray-400 uppercase font-black tracking-widest text-right">UOM</div>

                                                        </div>
                                                        <div className="bg-gray-50/50 rounded-xl border border-gray-100 divide-y divide-gray-100/80">
                                                            {product.brands.map((b, i) => (
                                                                <div key={i} className="flex items-center px-2 py-3">
                                                                    <div className="w-[55%] text-[10px] md:text-xs font-semibold text-gray-800 px-1 truncate">{b.brand || '-'}</div>
                                                                    <div className="w-[20%] text-[10px] md:text-xs font-semibold text-gray-800 text-right">{b.packetSize || '-'}</div>
                                                                    <div className="w-[20%] text-[10px] md:text-xs font-semibold text-gray-400 text-right">{product.uom || product.unit || 'kg'}</div>

                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
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
                        <p className="text-gray-500 font-medium">No products found</p>
                        <p className="text-sm text-gray-400 mt-1">Click "Add New Product" to create a product</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductManagement;
