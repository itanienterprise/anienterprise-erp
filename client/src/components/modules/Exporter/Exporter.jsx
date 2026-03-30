import React, { useState, useEffect } from 'react';
import { EditIcon, TrashIcon, UserIcon, EyeIcon, XIcon, BoxIcon, SearchIcon } from '../../Icons';
import { API_BASE_URL, SortIcon, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import './Exporter.css';

const Exporter = ({
    isSelectionMode,
    setIsSelectionMode,
    selectedItems,
    setSelectedItems,
    editingId,
    setEditingId,
    sortConfig,
    setSortConfig,
    onDeleteConfirm,
    startLongPress,
    endLongPress,
    isLongPressTriggered
}) => {
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [exporters, setExporters] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [viewData, setViewData] = useState(null);
    const [historySearchQuery, setHistorySearchQuery] = useState('');
    const [historyRecords, setHistoryRecords] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        contactPerson: '',
        email: '',
        phone: '+880',
        licenseNo: '',
        status: 'Active'
    });

    useEffect(() => { fetchExporters(); }, []);

    useEffect(() => {
        if (viewData) {
            fetchExportHistory(viewData.name);
            setHistorySearchQuery('');
        } else {
            setHistoryRecords([]);
        }
    }, [viewData]);

    const fetchExporters = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/exporters`);
            setExporters(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching exporters:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchExportHistory = async (exporterName) => {
        setHistoryLoading(true);
        try {
            const [stockRes, salesRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/stock`),
                axios.get(`${API_BASE_URL}/api/sales`)
            ]);

            const stockData = Array.isArray(stockRes.data) ? stockRes.data : [];
            const salesData = Array.isArray(salesRes.data) ? salesRes.data : [];

            const rows = [];
            const targetExporter = (exporterName || '').toLowerCase().trim();

            // 1. Process Stock (LC Receive) - records are flat
            stockData.forEach(record => {
                if ((record.exporter || '').toLowerCase().trim() === targetExporter) {
                    rows.push({
                        date: record.date,
                        lcNo: record.lcNo,
                        port: record.port,
                        product: record.productName,
                        brand: record.brand,
                        rate: record.purchasedPrice,
                        bag: !isNaN(parseFloat(record.packet)) ? parseFloat(record.packet) : (record.inHousePacket || 0),
                        qty: !isNaN(parseFloat(record.quantity)) ? parseFloat(record.quantity) : (record.inHouseQuantity || 0),
                        truck: record.truckNo || '-',
                        source: 'stock'
                    });
                }
            });

            // 2. Process Sales (Border Sale)
            salesData.forEach(sale => {
                const sTypeLow = (sale.saleType || '').toLowerCase();
                if ((sTypeLow === 'border' || sTypeLow === 'border sale') &&
                    (sale.exporter || '').toLowerCase().trim() === targetExporter) {
                    if (sale.items && Array.isArray(sale.items)) {
                        sale.items.forEach(item => {
                            if (item.brandEntries && Array.isArray(item.brandEntries)) {
                                item.brandEntries.forEach(be => {
                                    rows.push({
                                        date: sale.date,
                                        lcNo: sale.lcNo,
                                        port: sale.port,
                                        product: item.productName || item.product,
                                        brand: be.brand,
                                        rate: 0, 
                                        bag: be.bag || be.packet || '-',
                                        qty: be.quantity || 0,
                                        truck: be.truck || sale.truck || '-',
                                        source: 'sale'
                                    });
                                });
                            }
                        });
                    }
                }
            });

            // Sort by date (newest first)
            rows.sort((a, b) => new Date(b.date) - new Date(a.date));

            setHistoryRecords(rows);
        } catch (error) {
            console.error('Error fetching export history:', error);
            setHistoryRecords([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name } = e.target;
        let { value } = e.target;
        if (name === 'phone') {
            if (!value.startsWith('+880')) value = '+880' + value.replace(/^\+880?/, '');
            if (value.length <= 14) setFormData(prev => ({ ...prev, [name]: value }));
            return;
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.phone.length !== 14) {
            alert('Phone number must be exactly 14 characters long (e.g., +8801700000000)');
            return;
        }
        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const url = editingId
                ? `${API_BASE_URL}/api/exporters/${editingId}`
                : `${API_BASE_URL}/api/exporters`;
            if (editingId) await axios.put(url, formData);
            else await axios.post(url, formData);
            setSubmitStatus('success');
            fetchExporters();
            setTimeout(() => { setShowForm(false); setEditingId(null); resetForm(); setSubmitStatus(null); }, 2000);
        } catch (error) {
            console.error('Error saving exporter:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', address: '', contactPerson: '', email: '', phone: '+880', licenseNo: '', status: 'Active' });
        setEditingId(null);
        setSubmitStatus(null);
    };

    const handleEdit = (exporter) => {
        setFormData({
            name: exporter.name || '',
            address: exporter.address || '',
            contactPerson: exporter.contactPerson || '',
            email: exporter.email || '',
            phone: exporter.phone || '+880',
            licenseNo: exporter.licenseNo || '',
            status: exporter.status || 'Active'
        });
        setEditingId(exporter._id);
        setShowForm(true);
    };

    const handleDelete = (id) => onDeleteConfirm({ show: true, type: 'exporter', id, isBulk: false });

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id);
        setSelectedItems(newSelected);
        if (newSelected.size === 0) setIsSelectionMode(false);
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === exporters.length) { setSelectedItems(new Set()); setIsSelectionMode(false); }
        else setSelectedItems(new Set(exporters.map(i => i._id)));
    };

    const requestSort = (key) => {
        const direction = (sortConfig.exporter?.key === key && sortConfig.exporter?.direction === 'asc') ? 'desc' : 'asc';
        setSortConfig({ ...sortConfig, exporter: { key, direction } });
    };

    const sortData = (data) => {
        if (!sortConfig.exporter) return data;
        const { key, direction } = sortConfig.exporter;
        return [...data].sort((a, b) => {
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const filteredHistory = historyRecords.filter(row => {
        const q = historySearchQuery.toLowerCase();
        if (!q) return true;
        return (
            (row.date || '').toLowerCase().includes(q) ||
            (row.lcNo || '').toLowerCase().includes(q) ||
            (row.port || '').toLowerCase().includes(q) ||
            (row.product || '').toLowerCase().includes(q) ||
            (row.brand || '').toLowerCase().includes(q) ||
            String(row.truck || '').toLowerCase().includes(q)
        );
    });

    const totalBag = filteredHistory.reduce((s, r) => s + (parseFloat(r.bag) || 0), 0);
    const totalQty = filteredHistory.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);
    const totalAmount = filteredHistory.reduce((s, r) => s + (parseFloat(r.rate) || 0) * (parseFloat(r.qty) || 0), 0);

    return (
        <div className="exporter-container">
            <div className="exporter-header">
                <h2 className="exporter-title">Exporter Management</h2>
                <button onClick={() => setShowForm(!showForm)} className="exporter-add-btn">
                    <span className="exporter-add-icon">+</span> Add New
                </button>
            </div>

            {showForm && (
                <div className="exporter-form-container">
                    <div className="exporter-form-bg-orb exporter-form-bg-orb-1"></div>
                    <div className="exporter-form-bg-orb exporter-form-bg-orb-2"></div>
                    <div className="exporter-form-header">
                        <h3 className="exporter-form-title">{editingId ? 'Edit Exporter' : 'New Exporter Registration'}</h3>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="exporter-form-close">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="exporter-form">
                        <div className="exporter-form-field">
                            <label className="exporter-form-label">Exporter Name</label>
                            <input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder="Full Name" className="exporter-form-input" />
                        </div>
                        <div className="exporter-form-field">
                            <label className="exporter-form-label">License No</label>
                            <input type="text" name="licenseNo" value={formData.licenseNo} onChange={handleInputChange} required placeholder="LIC-00000" className="exporter-form-input" />
                        </div>
                        <div className="exporter-form-field exporter-form-field-full">
                            <label className="exporter-form-label">Address</label>
                            <textarea name="address" value={formData.address} onChange={handleInputChange} required placeholder="Full Address" rows="2" className="exporter-form-textarea" />
                        </div>
                        <div className="exporter-form-field">
                            <label className="exporter-form-label">Contact Person</label>
                            <input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleInputChange} required placeholder="Contact Name" className="exporter-form-input" />
                        </div>
                        <div className="exporter-form-field">
                            <label className="exporter-form-label">Email</label>
                            <input type="email" name="email" value={formData.email} onChange={handleInputChange} required placeholder="email@example.com" className="exporter-form-input" />
                        </div>
                        <div className="exporter-form-field">
                            <label className="exporter-form-label">Phone</label>
                            <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} required placeholder="+880..." className="exporter-form-input" />
                        </div>
                        <div className="exporter-form-field">
                            <label className="exporter-form-label">Status</label>
                            <select name="status" value={formData.status} onChange={handleInputChange} className="exporter-form-select">
                                <option>Active</option>
                                <option>Inactive</option>
                            </select>
                        </div>
                        <div className="exporter-form-footer">
                            {submitStatus === 'success' && (
                                <p className="exporter-form-success">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    Exporter saved successfully!
                                </p>
                            )}
                            {submitStatus === 'error' && (
                                <p className="exporter-form-error">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    Failed to save exporter.
                                </p>
                            )}
                            <div className="exporter-form-spacer"></div>
                            <button type="submit" disabled={isSubmitting} className={`exporter-form-submit ${isSubmitting ? 'disabled' : ''}`}>
                                {isSubmitting ? 'Saving...' : editingId ? 'Update Record' : 'Save Record'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="exporter-table-container">
                    {selectedItems.size > 0 && (
                        <div className="exporter-selection-bar">
                            <span className="exporter-selection-count">{selectedItems.size} items selected</span>
                            <div className="exporter-selection-actions">
                                <button onClick={() => { setSelectedItems(new Set()); setIsSelectionMode(false); }} className="exporter-selection-cancel">Cancel</button>
                                <button onClick={() => onDeleteConfirm({ show: true, type: 'exporter', id: null, isBulk: true })} className="exporter-selection-delete">
                                    <TrashIcon className="w-3.5 h-3.5 mr-1" /> Delete Bulk
                                </button>
                            </div>
                        </div>
                    )}
                    {isLoading ? (
                        <div className="exporter-loading"><div className="exporter-spinner"></div></div>
                    ) : exporters.length > 0 ? (
                        <div className="exporter-table-wrapper">
                            <table className="exporter-table">
                                <thead>
                                    <tr className="exporter-table-header-row" onMouseDown={() => startLongPress(null)} onMouseUp={endLongPress} onMouseLeave={endLongPress} onTouchStart={() => startLongPress(null)} onTouchEnd={endLongPress}>
                                        {isSelectionMode && (
                                            <th className="exporter-table-checkbox-header">
                                                <input type="checkbox" checked={selectedItems.size === exporters.length} onChange={toggleSelectAll} className="exporter-checkbox" />
                                            </th>
                                        )}
                                        <th className="exporter-table-header" onClick={() => requestSort('name')}><div className="exporter-table-header-content">Exporter Name <SortIcon config={sortConfig.exporter} columnKey="name" /></div></th>
                                        <th className="exporter-table-header" onClick={() => requestSort('licenseNo')}><div className="exporter-table-header-content">License No <SortIcon config={sortConfig.exporter} columnKey="licenseNo" /></div></th>
                                        <th className="exporter-table-header" onClick={() => requestSort('contactPerson')}><div className="exporter-table-header-content">Contact Person <SortIcon config={sortConfig.exporter} columnKey="contactPerson" /></div></th>
                                        <th className="exporter-table-header" onClick={() => requestSort('phone')}><div className="exporter-table-header-content">Phone <SortIcon config={sortConfig.exporter} columnKey="phone" /></div></th>
                                        <th className="exporter-table-header" onClick={() => requestSort('status')}><div className="exporter-table-header-content">Status <SortIcon config={sortConfig.exporter} columnKey="status" /></div></th>
                                        <th className="exporter-table-header">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="exporter-table-body">
                                    {sortData(exporters).map((exporter) => (
                                        <tr
                                            key={exporter._id}
                                            className={`exporter-table-row ${selectedItems.has(exporter._id) ? 'selected' : ''}`}
                                            onMouseDown={() => startLongPress(exporter._id)} onMouseUp={endLongPress} onMouseLeave={endLongPress}
                                            onTouchStart={() => startLongPress(exporter._id)} onTouchEnd={endLongPress}
                                            onClick={() => { if (isLongPressTriggered.current) { isLongPressTriggered.current = false; return; } if (isSelectionMode) toggleSelection(exporter._id); }}
                                        >
                                            {isSelectionMode && (
                                                <td className="exporter-table-cell">
                                                    <input type="checkbox" checked={selectedItems.has(exporter._id)} onChange={(e) => { e.stopPropagation(); toggleSelection(exporter._id); }} className="exporter-checkbox" />
                                                </td>
                                            )}
                                            <td className="exporter-table-cell exporter-table-cell-name">{exporter.name}</td>
                                            <td className="exporter-table-cell exporter-table-cell-license">{exporter.licenseNo}</td>
                                            <td className="exporter-table-cell">{exporter.contactPerson}</td>
                                            <td className="exporter-table-cell exporter-table-cell-muted">{exporter.phone}</td>
                                            <td className="exporter-table-cell">
                                                <span className={`exporter-status-badge ${exporter.status === 'Active' ? 'active' : 'inactive'}`}>{exporter.status}</span>
                                            </td>
                                            <td className="exporter-table-cell">
                                                <div className="exporter-table-actions">
                                                    <button onClick={(e) => { e.stopPropagation(); setViewData(exporter); }} className="exporter-action-btn hover:bg-gray-100 text-gray-400 hover:text-gray-600"><EyeIcon className="w-5 h-5" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(exporter); }} className="exporter-action-btn exporter-action-edit"><EditIcon className="w-5 h-5" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(exporter._id); }} className="exporter-action-btn exporter-action-delete"><TrashIcon className="w-5 h-5" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="exporter-empty">
                            <div className="exporter-empty-icon-wrapper"><UserIcon className="exporter-empty-icon" /></div>
                            <p className="exporter-empty-title">No exporters found</p>
                            <p className="exporter-empty-subtitle">Click "Add New" to register a new exporter</p>
                        </div>
                    )}
                </div>
            )}

            {/* Export History Modal */}
            {viewData && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setViewData(null)}></div>
                    <div className="relative bg-white border border-gray-100 rounded-2xl shadow-2xl max-w-6xl w-full flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-gray-100 bg-white sticky top-0 z-10 rounded-t-2xl relative flex items-center">
                            {/* Left: Title */}
                            <div className="flex-1 min-w-0 pr-4">
                                <h3 className="text-xl font-bold text-gray-900">Export History — {viewData.name}</h3>
                                <p className="text-sm text-gray-500 mt-0.5 truncate">License No: {viewData.licenseNo} | {viewData.address}</p>
                            </div>
                            {/* Center: Search bar — absolutely centered */}
                            <div className="absolute left-1/2 -translate-x-1/2 w-72 group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search history..."
                                    value={historySearchQuery}
                                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                                    className="block w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            {/* Right: Close button */}
                            <div className="flex-1 flex justify-end pl-4">
                                <button onClick={() => setViewData(null)} className="p-2 hover:bg-gray-50 text-gray-400 hover:text-gray-600 rounded-full transition-all">
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-6">
                            {historyLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-white border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Date</th>
                                                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">LC No</th>
                                                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Port</th>
                                                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Product</th>
                                                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Brand</th>
                                                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide text-center whitespace-nowrap">Truck</th>
                                                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide text-right whitespace-nowrap">Bag</th>
                                                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide text-right whitespace-nowrap">Qty</th>
                                                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide text-right whitespace-nowrap">Rate</th>
                                                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide text-right whitespace-nowrap">Total</th>
                                                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide text-right whitespace-nowrap">Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredHistory.length > 0 ? (
                                                <>
                                                    {(() => {
                                                        let runningBalance = 0;
                                                        return filteredHistory.map((row, idx) => {
                                                            const rowTotal = (parseFloat(row.rate) || 0) * (parseFloat(row.qty) || 0);
                                                            runningBalance += rowTotal;
                                                            return (
                                                                <tr key={idx} className="hover:bg-white transition-colors">
                                                                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDate(row.date)}</td>
                                                                    <td className="px-4 py-3 font-semibold text-blue-600 whitespace-nowrap">{row.lcNo || '-'}</td>
                                                                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.port || '-'}</td>
                                                                    <td className="px-4 py-3 font-medium text-gray-800">{row.product || '-'}</td>
                                                                    <td className="px-4 py-3 text-purple-700 font-medium">{row.brand || '-'}</td>
                                                                    <td className="px-4 py-3 text-center text-gray-600">{row.truck || '-'}</td>
                                                                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{row.bag ? Math.round(parseFloat(row.bag)).toLocaleString() : '-'}</td>
                                                                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{row.qty ? Math.round(parseFloat(row.qty)).toLocaleString() : '-'}</td>
                                                                    <td className="px-4 py-3 text-right text-gray-700">{row.rate ? `৳${parseFloat(row.rate).toLocaleString()}` : '-'}</td>
                                                                    <td className="px-4 py-3 text-right font-bold text-emerald-700">{rowTotal > 0 ? `৳${rowTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}</td>
                                                                    <td className="px-4 py-3 text-right font-bold text-blue-700">{(row.source !== 'sale' && runningBalance > 0) ? `৳${runningBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}</td>
                                                                </tr>
                                                            );
                                                        });
                                                    })()}
                                                    <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold">
                                                        <td colSpan={6} className="px-4 py-3 text-blue-700 text-xs uppercase tracking-wide">Grand Total</td>
                                                        <td className="px-4 py-3 text-right text-blue-800">{Math.round(totalBag).toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right text-blue-800">{Math.round(totalQty).toLocaleString()}</td>
                                                        <td></td>
                                                        <td className="px-4 py-3 text-right text-emerald-800">৳{totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                                        <td className="px-4 py-3 text-right text-blue-800">৳{totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                                    </tr>
                                                </>
                                            ) : (
                                                <tr>
                                                    <td colSpan="11" className="px-4 py-12 text-center text-gray-400">
                                                        <div className="flex flex-col items-center">
                                                            <BoxIcon className="w-8 h-8 mb-2 opacity-20" />
                                                            <p>No export history available</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Exporter;
