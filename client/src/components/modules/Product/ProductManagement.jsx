import React, { useState } from 'react';
import { PlusIcon, XIcon, EditIcon, TrashIcon, BoxIcon } from '../../Icons';
import { API_BASE_URL } from '../../../utils/helpers';
import { encryptData } from '../../../utils/encryption';
import './ProductManagement.css';

const ProductManagement = ({ products, fetchProducts }) => {
    const [showProductForm, setShowProductForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [productFormData, setProductFormData] = useState({
        hsCode: '',
        name: '',
        category: '',
        uom: 'kg',
        brands: [{ brand: '', packetSize: '', purchasedPrice: '' }],
        description: ''
    });

    const resetProductForm = () => {
        setProductFormData({
            hsCode: '',
            name: '',
            category: '',
            uom: 'kg',
            brands: [{ brand: '', packetSize: '', purchasedPrice: '' }],
            description: ''
        });
        setEditingId(null);
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
            const encryptedPayload = { data: encryptData(productFormData) };
            const url = editingId
                ? `${API_BASE_URL}/api/products/${editingId}`
                : `${API_BASE_URL}/api/products`;
            const method = editingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(encryptedPayload)
            });

            if (response.ok) {
                await fetchProducts();
                setShowProductForm(false);
                resetProductForm();
            } else {
                console.error('Failed to save product');
            }
        } catch (error) {
            console.error('Error saving product:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleProductEdit = (product) => {
        setProductFormData({
            hsCode: product.hsCode || '',
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
            const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await fetchProducts();
            } else {
                console.error('Failed to delete product');
            }
        } catch (error) {
            console.error('Error deleting product:', error);
        }
    };

    return (
        <div className="product-management space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">Products Management</h2>
                <button
                    onClick={() => setShowProductForm(!showProductForm)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Add New Product
                </button>
            </div>

            {showProductForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                        onClick={() => { setShowProductForm(false); resetProductForm(); }}
                    />
                    <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-6 w-full max-w-2xl transform transition-all relative z-10 animate-scale-in">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-800">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
                            <button
                                onClick={() => { setShowProductForm(false); resetProductForm(); }}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleProductSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">HS Code</label>
                                <input
                                    type="text"
                                    value={productFormData.hsCode}
                                    onChange={(e) => setProductFormData(prev => ({ ...prev, hsCode: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Enter HS Code"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
                                <input
                                    type="text"
                                    value={productFormData.name}
                                    onChange={(e) => setProductFormData(prev => ({ ...prev, name: e.target.value }))}
                                    required
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Enter product name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                                <input
                                    type="text"
                                    value={productFormData.category}
                                    onChange={(e) => setProductFormData(prev => ({ ...prev, category: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Enter category"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">UOM (Unit)</label>
                                <select
                                    value={productFormData.uom}
                                    onChange={(e) => setProductFormData(prev => ({ ...prev, uom: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                >
                                    <option value="kg">kg</option>
                                    <option value="lbs">lbs</option>
                                    <option value="pcs">pcs</option>
                                    <option value="box">box</option>
                                    <option value="set">set</option>
                                    <option value="m">m</option>
                                </select>
                            </div>

                            <div className="md:col-span-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-bold text-gray-700">Brands & Packaging</label>
                                    <button
                                        type="button"
                                        onClick={handleAddProductBrand}
                                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                    >
                                        <PlusIcon className="w-3 h-3" /> Add New Brand
                                    </button>
                                </div>
                                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                                    {productFormData.brands.map((brandEntry, bIndex) => (
                                        <div key={bIndex} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 bg-gray-50 rounded-xl relative group">
                                            {productFormData.brands.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveProductBrand(bIndex)}
                                                    className="absolute -top-2 -right-2 p-1 bg-white text-gray-400 hover:text-red-500 rounded-lg shadow-sm border border-gray-100 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <XIcon className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <div className="md:col-span-5">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Brand</label>
                                                <input
                                                    type="text"
                                                    value={brandEntry.brand}
                                                    onChange={(e) => handleProductBrandChange(bIndex, 'brand', e.target.value)}
                                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 transition-all"
                                                    placeholder="Enter brand"
                                                />
                                            </div>
                                            <div className="md:col-span-3">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Packet Size</label>
                                                <input
                                                    type="text"
                                                    value={brandEntry.packetSize}
                                                    onChange={(e) => handleProductBrandChange(bIndex, 'packetSize', e.target.value)}
                                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 transition-all"
                                                    placeholder="Size"
                                                />
                                            </div>
                                            <div className="md:col-span-4">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Purchased Price</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={brandEntry.purchasedPrice}
                                                    onChange={(e) => handleProductBrandChange(bIndex, 'purchasedPrice', e.target.value)}
                                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 transition-all"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="md:col-span-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                                <textarea
                                    value={productFormData.description}
                                    onChange={(e) => setProductFormData(prev => ({ ...prev, description: e.target.value }))}
                                    rows="3"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                                    placeholder="Enter product description"
                                />
                            </div>
                            <div className="md:col-span-4 flex justify-end space-x-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => { setShowProductForm(false); resetProductForm(); }}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Saving...
                                        </>
                                    ) : (
                                        editingId ? 'Update Product' : 'Add Product'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                {products.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">HS Code</th>
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
