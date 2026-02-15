import React, { useState, useEffect } from 'react';
import { EditIcon, TrashIcon, AnchorIcon } from '../../Icons';
import { API_BASE_URL, SortIcon } from '../../../utils/helpers';
import { encryptData, decryptData } from '../../../utils/encryption';
import './Port.css';

const Port = ({
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
    const [ports, setPorts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        location: '',
        code: '',
        type: 'Seaport',
        status: 'Active'
    });

    useEffect(() => {
        fetchPorts();
    }, []);

    const fetchPorts = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/ports`);
            if (response.ok) {
                const rawData = await response.json();
                const decryptedPorts = rawData.map(record => {
                    const decrypted = decryptData(record.data);
                    return { ...decrypted, _id: record._id, createdAt: record.createdAt };
                });
                setPorts(decryptedPorts);
            }
        } catch (error) {
            console.error('Error fetching ports:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            const url = editingId ? `${API_BASE_URL}/api/ports/${editingId}` : `${API_BASE_URL}/api/ports`;
            const encryptedPayload = { data: encryptData(formData) };
            const response = await fetch(url, {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(encryptedPayload),
            });

            if (response.ok) {
                setSubmitStatus('success');
                fetchPorts();
                setTimeout(() => {
                    setShowForm(false);
                    setEditingId(null);
                    resetForm();
                    setSubmitStatus(null);
                }, 2000);
            } else {
                setSubmitStatus('error');
            }
        } catch (error) {
            console.error('Error saving port:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', location: '', code: '', type: 'Seaport', status: 'Active' });
        setEditingId(null);
        setSubmitStatus(null);
    };

    const handleEdit = (port) => {
        setFormData({
            name: port.name || '',
            location: port.location || '',
            code: port.code || '',
            type: port.type || 'Seaport',
            status: port.status || 'Active'
        });
        setEditingId(port._id);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        onDeleteConfirm({ show: true, type: 'port', id, isBulk: false });
    };

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedItems(newSelected);
        if (newSelected.size === 0) {
            setIsSelectionMode(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === ports.length) {
            setSelectedItems(new Set());
            setIsSelectionMode(false);
        } else {
            setSelectedItems(new Set(ports.map(p => p._id)));
        }
    };

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.port?.key === key && sortConfig.port?.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ ...sortConfig, port: { key, direction } });
    };

    const sortData = (data) => {
        if (!sortConfig.port) return data;
        const { key, direction } = sortConfig.port;
        return [...data].sort((a, b) => {
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    return (
        <div className="port-container">
            <div className="port-header">
                <h2 className="port-title">Port Management</h2>
                <button onClick={() => setShowForm(!showForm)} className="port-add-btn">
                    <span className="port-add-icon">+</span> Add New
                </button>
            </div>

            {showForm && (
                <div className="port-form-container">
                    <div className="port-form-bg-orb port-form-bg-orb-1"></div>
                    <div className="port-form-bg-orb port-form-bg-orb-2"></div>

                    <div className="port-form-header">
                        <h3 className="port-form-title">{editingId ? 'Edit Port' : 'New Port Registration'}</h3>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="port-form-close">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="port-form">
                        <div className="port-form-field">
                            <label className="port-form-label">Port Name</label>
                            <input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder="e.g., Chittagong Port" className="port-form-input" />
                        </div>
                        <div className="port-form-field">
                            <label className="port-form-label">Port Code</label>
                            <input type="text" name="code" value={formData.code} onChange={handleInputChange} required placeholder="e.g., BDCGP" className="port-form-input" />
                        </div>
                        <div className="port-form-field">
                            <label className="port-form-label">Location</label>
                            <input type="text" name="location" value={formData.location} onChange={handleInputChange} required placeholder="City, Country" className="port-form-input" />
                        </div>
                        <div className="port-form-field">
                            <label className="port-form-label">Port Type</label>
                            <select name="type" value={formData.type} onChange={handleInputChange} className="port-form-select">
                                <option>Seaport</option>
                                <option>Airport</option>
                                <option>Land Port</option>
                            </select>
                        </div>
                        <div className="port-form-field">
                            <label className="port-form-label">Status</label>
                            <select name="status" value={formData.status} onChange={handleInputChange} className="port-form-select">
                                <option>Active</option>
                                <option>Inactive</option>
                            </select>
                        </div>

                        <div className="port-form-footer">
                            {submitStatus === 'success' && (
                                <p className="port-form-success">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    Port saved successfully!
                                </p>
                            )}
                            {submitStatus === 'error' && (
                                <p className="port-form-error">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    Failed to save port.
                                </p>
                            )}
                            <div className="port-form-spacer"></div>
                            <button type="submit" disabled={isSubmitting} className={`port-form-submit ${isSubmitting ? 'disabled' : ''}`}>
                                {isSubmitting ? 'Saving...' : editingId ? 'Update Port' : 'Register Port'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="port-table-container">
                    {selectedItems.size > 0 && (
                        <div className="port-selection-bar">
                            <span className="port-selection-count">{selectedItems.size} items selected</span>
                            <div className="port-selection-actions">
                                <button onClick={() => { setSelectedItems(new Set()); setIsSelectionMode(false); }} className="port-selection-cancel">Cancel</button>
                                <button onClick={() => onDeleteConfirm({ show: true, type: 'port', id: null, isBulk: true })} className="port-selection-delete">
                                    <TrashIcon className="w-3.5 h-3.5 mr-1" /> Delete Bulk
                                </button>
                            </div>
                        </div>
                    )}
                    {isLoading ? (
                        <div className="port-loading"><div className="port-spinner"></div></div>
                    ) : ports.length > 0 ? (
                        <div className="port-table-wrapper">
                            <table className="port-table">
                                <thead>
                                    <tr className="port-table-header-row" onMouseDown={() => startLongPress(null)} onMouseUp={endLongPress} onMouseLeave={endLongPress} onTouchStart={() => startLongPress(null)} onTouchEnd={endLongPress}>
                                        {isSelectionMode && (
                                            <th className="port-table-checkbox-header">
                                                <input type="checkbox" checked={selectedItems.size === ports.length} onChange={toggleSelectAll} className="port-checkbox" />
                                            </th>
                                        )}
                                        <th className="port-table-header" onClick={() => requestSort('name')}>
                                            <div className="port-table-header-content">Port Name <SortIcon config={sortConfig.port} columnKey="name" /></div>
                                        </th>
                                        <th className="port-table-header" onClick={() => requestSort('code')}>
                                            <div className="port-table-header-content">Code <SortIcon config={sortConfig.port} columnKey="code" /></div>
                                        </th>
                                        <th className="port-table-header" onClick={() => requestSort('location')}>
                                            <div className="port-table-header-content">Location <SortIcon config={sortConfig.port} columnKey="location" /></div>
                                        </th>
                                        <th className="port-table-header" onClick={() => requestSort('type')}>
                                            <div className="port-table-header-content">Type <SortIcon config={sortConfig.port} columnKey="type" /></div>
                                        </th>
                                        <th className="port-table-header" onClick={() => requestSort('status')}>
                                            <div className="port-table-header-content">Status <SortIcon config={sortConfig.port} columnKey="status" /></div>
                                        </th>
                                        <th className="port-table-header">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="port-table-body">
                                    {sortData(ports).map((port) => (
                                        <tr key={port._id} className={`port-table-row ${selectedItems.has(port._id) ? 'selected' : ''}`}
                                            onMouseDown={() => startLongPress(port._id)} onMouseUp={endLongPress} onMouseLeave={endLongPress}
                                            onTouchStart={() => startLongPress(port._id)} onTouchEnd={endLongPress}
                                            onClick={() => {
                                                if (isLongPressTriggered.current) {
                                                    isLongPressTriggered.current = false;
                                                    return;
                                                }
                                                if (isSelectionMode) toggleSelection(port._id);
                                            }}>
                                            {isSelectionMode && (
                                                <td className="port-table-cell">
                                                    <input type="checkbox" checked={selectedItems.has(port._id)} onChange={(e) => { e.stopPropagation(); toggleSelection(port._id); }} className="port-checkbox" />
                                                </td>
                                            )}
                                            <td className="port-table-cell port-table-cell-name">{port.name}</td>
                                            <td className="port-table-cell port-table-cell-code">{port.code}</td>
                                            <td className="port-table-cell">{port.location}</td>
                                            <td className="port-table-cell port-table-cell-muted">{port.type}</td>
                                            <td className="port-table-cell">
                                                <span className={`port-status-badge ${port.status === 'Active' ? 'active' : 'inactive'}`}>{port.status}</span>
                                            </td>
                                            <td className="port-table-cell">
                                                <div className="port-table-actions">
                                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(port); }} className="port-action-btn port-action-edit">
                                                        <EditIcon className="w-5 h-5" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(port._id); }} className="port-action-btn port-action-delete">
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
                        <div className="port-empty">
                            <div className="port-empty-icon-wrapper"><AnchorIcon className="port-empty-icon" /></div>
                            <p className="port-empty-title">No ports found</p>
                            <p className="port-empty-subtitle">Click "Add New" to register a new port</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Port;
