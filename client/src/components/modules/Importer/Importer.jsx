import React, { useState, useEffect, useRef } from 'react';
import { EditIcon, TrashIcon, UsersIcon } from '../../Icons';
import { API_BASE_URL, SortIcon } from '../../../utils/helpers';
import { encryptData, decryptData } from '../../../utils/encryption';
import './Importer.css';

const Importer = ({
    // Shared state from parent
    isSelectionMode,
    setIsSelectionMode,
    selectedItems,
    setSelectedItems,
    editingId,
    setEditingId,
    sortConfig,
    setSortConfig,
    // Callbacks
    onDeleteConfirm,
    startLongPress,
    endLongPress,
    isLongPressTriggered
}) => {
    // Local state
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [importers, setImporters] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        contactPerson: '',
        email: '',
        phone: '+88',
        licenseNo: '',
        status: 'Active'
    });

    // Fetch importers on mount
    useEffect(() => {
        fetchImporters();
    }, []);

    const fetchImporters = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/importers`);
            if (response.ok) {
                const rawData = await response.json();
                const decryptedImporters = rawData.map(record => {
                    const decrypted = decryptData(record.data);
                    return { ...decrypted, _id: record._id, createdAt: record.createdAt };
                });
                setImporters(decryptedImporters);
            }
        } catch (error) {
            console.error('Error fetching importers:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        if (name === 'phone') {
            // Enforce +88 prefix and 14 characters limit
            if (!value.startsWith('+88')) {
                return; // Prevent removing +88
            }
            if (value.length > 14) {
                return; // Limit to 14 characters
            }
        }

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate phone number
        if (formData.phone.length !== 14) {
            alert('Phone number must be exactly 14 characters long (e.g., +8801700000000)');
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            const url = editingId
                ? `${API_BASE_URL}/api/importers/${editingId}`
                : `${API_BASE_URL}/api/importers`;
            const encryptedPayload = { data: encryptData(formData) };
            const response = await fetch(url, {
                method: editingId ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(encryptedPayload),
            });

            if (response.ok) {
                setSubmitStatus('success');
                fetchImporters();
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
            console.error('Error saving importer:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            address: '',
            contactPerson: '',
            email: '',
            phone: '+88',
            licenseNo: '',
            status: 'Active'
        });
        setEditingId(null);
        setSubmitStatus(null);
    };

    const handleEdit = (importer) => {
        setFormData({
            name: importer.name || '',
            address: importer.address || '',
            contactPerson: importer.contactPerson || '',
            email: importer.email || '',
            phone: importer.phone || '+88',
            licenseNo: importer.licenseNo || '',
            status: importer.status || 'Active'
        });
        setEditingId(importer._id);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        onDeleteConfirm({ show: true, type: 'importer', id, isBulk: false });
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
        if (selectedItems.size === importers.length) {
            setSelectedItems(new Set());
            setIsSelectionMode(false);
        } else {
            setSelectedItems(new Set(importers.map(i => i._id)));
        }
    };

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.importer?.key === key && sortConfig.importer?.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ ...sortConfig, importer: { key, direction } });
    };

    const sortData = (data) => {
        if (!sortConfig.importer) return data;
        const { key, direction } = sortConfig.importer;
        return [...data].sort((a, b) => {
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    return (
        <div className="importer-container">
            <div className="importer-header">
                <h2 className="importer-title">Importer Management</h2>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="importer-add-btn"
                >
                    <span className="importer-add-icon">+</span> Add New
                </button>
            </div>

            {showForm && (
                <div className="importer-form-container">
                    <div className="importer-form-bg-orb importer-form-bg-orb-1"></div>
                    <div className="importer-form-bg-orb importer-form-bg-orb-2"></div>

                    <div className="importer-form-header">
                        <h3 className="importer-form-title">{editingId ? 'Edit Importer' : 'New Importer Registration'}</h3>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="importer-form-close">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="importer-form">
                        <div className="importer-form-field">
                            <label className="importer-form-label">Importer Name</label>
                            <input
                                type="text" name="name" value={formData.name} onChange={handleInputChange} required
                                placeholder="Full Name" className="importer-form-input"
                            />
                        </div>
                        <div className="importer-form-field">
                            <label className="importer-form-label">License No</label>
                            <input
                                type="text" name="licenseNo" value={formData.licenseNo} onChange={handleInputChange} required
                                placeholder="LIC-00000" className="importer-form-input"
                            />
                        </div>
                        <div className="importer-form-field importer-form-field-full">
                            <label className="importer-form-label">Address</label>
                            <textarea
                                name="address" value={formData.address} onChange={handleInputChange} required
                                placeholder="Full Address" rows="2" className="importer-form-textarea"
                            />
                        </div>
                        <div className="importer-form-field">
                            <label className="importer-form-label">Contact Person</label>
                            <input
                                type="text" name="contactPerson" value={formData.contactPerson} onChange={handleInputChange} required
                                placeholder="Contact Name" className="importer-form-input"
                            />
                        </div>
                        <div className="importer-form-field">
                            <label className="importer-form-label">Email</label>
                            <input
                                type="email" name="email" value={formData.email} onChange={handleInputChange} required
                                placeholder="email@example.com" className="importer-form-input"
                            />
                        </div>
                        <div className="importer-form-field">
                            <label className="importer-form-label">Phone</label>
                            <input
                                type="tel" name="phone" value={formData.phone} onChange={handleInputChange} required
                                placeholder="+880..." className="importer-form-input"
                            />
                        </div>
                        <div className="importer-form-field">
                            <label className="importer-form-label">Status</label>
                            <select
                                name="status" value={formData.status} onChange={handleInputChange}
                                className="importer-form-select"
                            >
                                <option>Active</option>
                                <option>Inactive</option>
                            </select>
                        </div>

                        <div className="importer-form-footer">
                            {submitStatus === 'success' && (
                                <p className="importer-form-success">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    Importer saved successfully!
                                </p>
                            )}
                            {submitStatus === 'error' && (
                                <p className="importer-form-error">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    Failed to save importer.
                                </p>
                            )}
                            <div className="importer-form-spacer"></div>
                            <button
                                type="submit" disabled={isSubmitting}
                                className={`importer-form-submit ${isSubmitting ? 'disabled' : ''}`}
                            >
                                {isSubmitting ? 'Saving...' : editingId ? 'Update Record' : 'Save Record'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="importer-table-container">
                    {selectedItems.size > 0 && (
                        <div className="importer-selection-bar">
                            <span className="importer-selection-count">{selectedItems.size} items selected</span>
                            <div className="importer-selection-actions">
                                <button
                                    onClick={() => { setSelectedItems(new Set()); setIsSelectionMode(false); }}
                                    className="importer-selection-cancel"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => onDeleteConfirm({ show: true, type: 'importer', id: null, isBulk: true })}
                                    className="importer-selection-delete"
                                >
                                    <TrashIcon className="w-3.5 h-3.5 mr-1" /> Delete Bulk
                                </button>
                            </div>
                        </div>
                    )}
                    {isLoading ? (
                        <div className="importer-loading">
                            <div className="importer-spinner"></div>
                        </div>
                    ) : importers.length > 0 ? (
                        <div className="importer-table-wrapper">
                            <table className="importer-table">
                                <thead>
                                    <tr
                                        className="importer-table-header-row"
                                        onMouseDown={() => startLongPress(null)}
                                        onMouseUp={endLongPress}
                                        onMouseLeave={endLongPress}
                                        onTouchStart={() => startLongPress(null)}
                                        onTouchEnd={endLongPress}
                                    >
                                        {isSelectionMode && (
                                            <th className="importer-table-checkbox-header">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.size === importers.length}
                                                    onChange={toggleSelectAll}
                                                    className="importer-checkbox"
                                                />
                                            </th>
                                        )}
                                        <th className="importer-table-header" onClick={() => requestSort('name')}>
                                            <div className="importer-table-header-content">Importer Name <SortIcon config={sortConfig.importer} columnKey="name" /></div>
                                        </th>
                                        <th className="importer-table-header" onClick={() => requestSort('licenseNo')}>
                                            <div className="importer-table-header-content">License No <SortIcon config={sortConfig.importer} columnKey="licenseNo" /></div>
                                        </th>
                                        <th className="importer-table-header" onClick={() => requestSort('contactPerson')}>
                                            <div className="importer-table-header-content">Contact Person <SortIcon config={sortConfig.importer} columnKey="contactPerson" /></div>
                                        </th>
                                        <th className="importer-table-header" onClick={() => requestSort('phone')}>
                                            <div className="importer-table-header-content">Phone <SortIcon config={sortConfig.importer} columnKey="phone" /></div>
                                        </th>
                                        <th className="importer-table-header" onClick={() => requestSort('status')}>
                                            <div className="importer-table-header-content">Status <SortIcon config={sortConfig.importer} columnKey="status" /></div>
                                        </th>
                                        <th className="importer-table-header">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="importer-table-body">
                                    {sortData(importers).map((importer) => (
                                        <tr
                                            key={importer._id}
                                            className={`importer-table-row ${selectedItems.has(importer._id) ? 'selected' : ''}`}
                                            onMouseDown={() => startLongPress(importer._id)}
                                            onMouseUp={endLongPress}
                                            onMouseLeave={endLongPress}
                                            onTouchStart={() => startLongPress(importer._id)}
                                            onTouchEnd={endLongPress}
                                            onClick={() => {
                                                if (isLongPressTriggered.current) {
                                                    isLongPressTriggered.current = false;
                                                    return;
                                                }
                                                if (isSelectionMode) toggleSelection(importer._id);
                                            }}
                                        >
                                            {isSelectionMode && (
                                                <td className="importer-table-cell">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItems.has(importer._id)}
                                                        onChange={(e) => { e.stopPropagation(); toggleSelection(importer._id); }}
                                                        className="importer-checkbox"
                                                    />
                                                </td>
                                            )}
                                            <td className="importer-table-cell importer-table-cell-name">{importer.name}</td>
                                            <td className="importer-table-cell importer-table-cell-license">{importer.licenseNo}</td>
                                            <td className="importer-table-cell">{importer.contactPerson}</td>
                                            <td className="importer-table-cell importer-table-cell-muted">{importer.phone}</td>
                                            <td className="importer-table-cell">
                                                <span className={`importer-status-badge ${importer.status === 'Active' ? 'active' : 'inactive'}`}>
                                                    {importer.status}
                                                </span>
                                            </td>
                                            <td className="importer-table-cell">
                                                <div className="importer-table-actions">
                                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(importer); }} className="importer-action-btn importer-action-edit">
                                                        <EditIcon className="w-5 h-5" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(importer._id); }} className="importer-action-btn importer-action-delete">
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
                        <div className="importer-empty">
                            <div className="importer-empty-icon-wrapper">
                                <UsersIcon className="importer-empty-icon" />
                            </div>
                            <p className="importer-empty-title">No importers found</p>
                            <p className="importer-empty-subtitle">Click "Add New" to register a new importer</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Importer;
