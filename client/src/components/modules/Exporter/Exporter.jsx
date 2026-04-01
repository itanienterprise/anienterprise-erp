import React, { useState, useEffect } from 'react';
import { EditIcon, TrashIcon, UserIcon, EyeIcon, XIcon, BoxIcon, SearchIcon, ChevronDownIcon, ChevronUpIcon, TrendingUpIcon, DollarSignIcon } from '../../Icons';
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
    const [expandedHistoryIdx, setExpandedHistoryIdx] = useState(null);
    const [expandedExporterId, setExpandedExporterId] = useState(null);
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
            document.body.style.overflow = 'hidden';
            fetchExportHistory(viewData.name);
            setHistorySearchQuery('');
            setExpandedHistoryIdx(null); // Reset expansion on new view
        } else {
            document.body.style.overflow = 'auto';
            setHistoryRecords([]);
        }

        return () => {
            document.body.style.overflow = 'auto';
        };
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
                        <>
                            {/* Desktop Table - hidden on mobile */}
                            <div className="hidden md:block overflow-x-auto">
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

                            {/* Mobile Card List - hidden on desktop */}
                            <div className="block md:hidden px-2 py-3 space-y-3">
                                {sortData(exporters).map((exporter) => {
                                    const isExpanded = expandedExporterId === exporter._id;
                                    return (
                                        <div
                                            key={exporter._id}
                                            className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${selectedItems.has(exporter._id) ? 'border-blue-300 bg-blue-50/30' : 'border-gray-100 shadow-sm'} ${isExpanded ? 'ring-1 ring-blue-50 shadow-md border-blue-200' : 'hover:border-gray-200 shadow-sm'}`}
                                            onTouchStart={() => startLongPress(exporter._id)}
                                            onTouchEnd={endLongPress}
                                            onClick={() => {
                                                if (isLongPressTriggered.current) {
                                                    isLongPressTriggered.current = false;
                                                    return;
                                                }
                                                if (isSelectionMode) {
                                                    toggleSelection(exporter._id);
                                                } else {
                                                    setExpandedExporterId(isExpanded ? null : exporter._id);
                                                }
                                            }}
                                        >
                                            {/* Card Header - Always Visible */}
                                            <div className="flex justify-between items-center p-4">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    {isSelectionMode && (
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedItems.has(exporter._id)}
                                                            onChange={(e) => { e.stopPropagation(); toggleSelection(exporter._id); }}
                                                            className="w-5 h-5 accent-blue-600 shrink-0"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-gray-900 text-sm truncate uppercase tracking-tight">{exporter.name}</p>
                                                        <p className="text-[10px] font-bold text-blue-600 mt-0.5 tracking-wider uppercase opacity-80">{exporter.licenseNo}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`exporter-status-badge ${exporter.status === 'Active' ? 'active' : 'inactive'} shrink-0 text-[10px] py-0.5 px-2`}>
                                                        {exporter.status}
                                                    </span>
                                                    <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}>
                                                        {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expandable Body */}
                                            {isExpanded && (
                                                <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                                                    <div className="space-y-2.5 pt-3 border-t border-gray-50">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Contact Person</span>
                                                            <span className="text-gray-900 font-black">{exporter.contactPerson}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Phone Number</span>
                                                            <span className="text-gray-900 font-black font-mono">{exporter.phone}</span>
                                                        </div>
                                                        {exporter.address && (
                                                            <div className="flex justify-between items-start text-xs pt-1">
                                                                <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px] shrink-0">Office Address</span>
                                                                <span className="text-gray-900 font-black text-right max-w-[65%] line-clamp-2">{exporter.address}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Card Actions */}
                                                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setViewData(exporter); }}
                                                            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-50 text-gray-700 rounded-xl text-xs font-black flex-1 hover:bg-gray-100 transition-all active:scale-95"
                                                        >
                                                            <EyeIcon className="w-4 h-4" /> View History
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleEdit(exporter); }}
                                                            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-50 text-blue-700 rounded-xl text-xs font-black flex-1 hover:bg-blue-100 transition-all active:scale-95"
                                                        >
                                                            <EditIcon className="w-4 h-4" /> Edit
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(exporter._id); }}
                                                            className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all active:scale-95"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
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
                        {/* Modal Header */}
                        <div className="relative px-4 py-4 md:px-8 md:py-6 border-b border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white sticky top-0 z-10 rounded-t-2xl">
                            <div className="flex-1 text-left min-w-0 pr-8 md:pr-0">
                                <h3 className="text-lg md:text-xl font-bold text-gray-900 truncate">{viewData.name}</h3>
                                <p className="text-xs text-gray-500 mt-1 truncate">License: {viewData.licenseNo}{viewData.address ? ` | ${viewData.address}` : ''}</p>
                            </div>

                            {/* Search bar */}
                            <div className="flex-1 w-full md:max-w-sm md:mx-auto">
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search export history..."
                                        value={historySearchQuery}
                                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                                        className="block w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Close button */}
                            <button onClick={() => setViewData(null)} className="absolute right-4 top-4 md:static p-2 hover:bg-gray-50 text-gray-400 hover:text-gray-600 rounded-full transition-all">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-auto p-4 md:p-8">
                            {historyLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Desktop Table View */}
                                    <div className="hidden md:block bg-gray-50 rounded-xl border border-gray-200 overflow-x-auto">
                                        <table className="w-full text-left text-sm" style={{ minWidth: '45rem' }}>
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

                                    {/* Mobile Card View */}
                                    <div className="block md:hidden space-y-3">
                                        {filteredHistory.length > 0 ? (
                                            <>
                                                {(() => {
                                                    let runningBalance = 0;
                                                    return filteredHistory.map((row, idx) => {
                                                        const rowTotal = (parseFloat(row.rate) || 0) * (parseFloat(row.qty) || 0);
                                                        runningBalance += rowTotal;
                                                        const isExpanded = expandedHistoryIdx === idx;
                                                        return (
                                                            <div key={idx} className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-blue-200 shadow-md ring-1 ring-blue-50' : 'border-gray-100 shadow-sm hover:border-gray-200'}`}>
                                                                {/* Card Toggle Header */}
                                                                <div
                                                                    className="flex justify-between items-center p-4 cursor-pointer select-none active:bg-gray-50 transition-colors"
                                                                    onClick={() => setExpandedHistoryIdx(isExpanded ? null : idx)}
                                                                >
                                                                    <div className="flex-1 min-w-0 pr-4">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{formatDate(row.date)}</p>
                                                                            <span className="h-1 w-1 bg-gray-300 rounded-full"></span>
                                                                            <p className="text-xs font-bold text-gray-800 truncate">{row.product || '-'}</p>
                                                                        </div>
                                                                        <p className="text-sm font-black text-blue-600 truncate">{row.lcNo || '-'}</p>
                                                                    </div>
                                                                    <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
                                                                        {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                                                                    </div>
                                                                </div>

                                                                {/* Expandable Details */}
                                                                {isExpanded && (
                                                                    <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-4 duration-300">
                                                                        <div className="flex justify-between items-start pt-3 border-t border-gray-50">
                                                                            <div>
                                                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Port</p>
                                                                                <p className="text-xs font-medium text-gray-700">{row.port || '-'}</p>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Brand</p>
                                                                                <p className="text-[11px] font-bold text-purple-600">{row.brand || '-'}</p>
                                                                            </div>
                                                                        </div>

                                                                        <div className="grid grid-cols-2 gap-3 py-2.5 bg-gray-50/70 rounded-xl px-4">
                                                                            <div className="space-y-1">
                                                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Truck No</p>
                                                                                <p className="text-xs font-semibold text-gray-700">{row.truck || '-'}</p>
                                                                            </div>
                                                                            <div className="space-y-1 text-right">
                                                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bag / Qty</p>
                                                                                <p className="text-xs font-bold text-gray-900">
                                                                                    {row.bag ? Math.round(parseFloat(row.bag)).toLocaleString() : '0'} / {row.qty ? Math.round(parseFloat(row.qty)).toLocaleString() : '0'}
                                                                                </p>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex justify-between items-end">
                                                                            <div className="space-y-0.5">
                                                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rate</p>
                                                                                <p className="text-xs font-bold text-gray-700">{row.rate ? `৳${parseFloat(row.rate).toLocaleString()}` : '-'}</p>
                                                                            </div>
                                                                            <div className="space-y-0.5 text-right">
                                                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Row Total</p>
                                                                                <p className="text-sm font-black text-emerald-700">{rowTotal > 0 ? `৳${rowTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}</p>
                                                                            </div>
                                                                        </div>

                                                                        <div className="pt-3 border-t border-gray-50 flex justify-between items-center">
                                                                            <div className="flex items-center gap-1.5 ">
                                                                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                                                                                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Running Balance</span>
                                                                            </div>
                                                                            <span className="text-base font-black text-blue-700">
                                                                                {(row.source !== 'sale' && runningBalance > 0) ? `৳${runningBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    });
                                                })()}

                                                {/* Mobile Total Summary Card - Redesigned */}
                                                <div className="grid grid-cols-2 gap-3 mt-6 mb-4">
                                                    {/* Total Bag Card */}
                                                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center transition-all hover:shadow-md">
                                                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-2.5">
                                                            <BoxIcon className="w-5 h-5 text-blue-600" />
                                                        </div>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-1">Total Bag</p>
                                                        <p className="text-base font-black text-gray-900">{Math.round(totalBag).toLocaleString()}</p>
                                                    </div>

                                                    {/* Total Qty Card */}
                                                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center transition-all hover:shadow-md">
                                                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-2.5">
                                                            <TrendingUpIcon className="w-5 h-5 text-emerald-600" />
                                                        </div>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-1">Total Qty</p>
                                                        <p className="text-base font-black text-gray-900">{Math.round(totalQty).toLocaleString()}</p>
                                                    </div>

                                                    {/* Grand Total Card (Full Width) */}
                                                    <div className="col-span-full bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 shadow-lg shadow-gray-200 flex items-center justify-between overflow-hidden relative group">
                                                        {/* Decorative Elements */}
                                                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all duration-500"></div>
                                                        
                                                        <div className="flex items-center gap-4 relative z-10">
                                                            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/10">
                                                                <DollarSignIcon className="w-6 h-6 text-white" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-0.5">Grand Total Amount</p>
                                                                <p className="text-xl font-black text-white leading-tight font-mono">৳{totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="hidden sm:block relative z-10">
                                                            <div className="h-10 w-px bg-white/10 mx-4"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center text-gray-400">
                                                <BoxIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                                <p className="text-sm">No export history available</p>
                                            </div>
                                        )}
                                    </div>
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
