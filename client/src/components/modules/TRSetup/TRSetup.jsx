import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SearchIcon, PlusIcon, EditIcon, TrashIcon, XIcon } from '../../Icons';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';

function TRSetup({ onDeleteConfirm, currentUser }) {
    const canManage = ['admin', 'incharge', 'lc manager', 'border manager', 'data entry'].includes((currentUser?.role || '').toLowerCase());

    const [records, setRecords] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [toast, setToast] = useState(null);
    const toastTimerRef = useRef(null);

    const [formData, setFormData] = useState({
        name: '',
        trFormat: ''
    });

    const showToast = (message, type = 'success') => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ message, type });
        toastTimerRef.current = setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        fetchRecords();
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, []);

    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/tr-setups`);
            setRecords(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching TR setups:', error);
            showToast('Failed to load TR setups.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', trFormat: '' });
        setEditingId(null);
        setSubmitStatus(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleTrFormatChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            showToast('Please upload a JPG or PNG image.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({ ...prev, trFormat: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    const removeTrFormat = () => {
        setFormData(prev => ({ ...prev, trFormat: '' }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setSubmitStatus({ type: 'error', message: 'Name is required.' });
            return;
        }
        if (!formData.trFormat) {
            setSubmitStatus({ type: 'error', message: 'TR Formate image is required.' });
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            const payload = {
                name: formData.name.trim(),
                trFormat: formData.trFormat
            };

            if (editingId) {
                await axios.put(`${API_BASE_URL}/api/tr-setups/${editingId}`, payload);
                showToast('TR Setup updated successfully.');
            } else {
                await axios.post(`${API_BASE_URL}/api/tr-setups`, payload);
                showToast('TR Setup created successfully.');
            }

            await fetchRecords();
            setShowForm(false);
            resetForm();
        } catch (error) {
            console.error('Error saving TR setup:', error);
            setSubmitStatus({
                type: 'error',
                message: error.response?.data?.message || 'Failed to save TR Setup.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (record) => {
        setFormData({
            name: record.name || '',
            trFormat: record.trFormat || ''
        });
        setEditingId(record._id);
        setShowForm(true);
        setSubmitStatus(null);
    };

    const handleDelete = (id) => {
        onDeleteConfirm({ show: true, type: 'tr-setup', id, isBulk: false });
    };

    const displayRecords = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return records.filter(r => (r.name || '').toLowerCase().includes(q));
    }, [records, searchQuery]);

    return (
        <div className="space-y-4 md:space-y-6 p-4 md:p-6">
            {toast && (
                <div className={`fixed top-4 right-4 z-[9999] px-4 py-2.5 rounded-xl shadow-lg border text-sm font-medium ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                    {toast.message}
                </div>
            )}

            {!showForm && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="w-full md:w-1/4 text-center md:text-left">
                        <h2 className="text-2xl font-bold text-gray-800" style={{ margin: 0 }}>TR Setup</h2>
                    </div>

                    <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                        <div className="absolute inset-y-0 left-0 pl-5 md:pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-12 md:pl-10 pr-4 py-2.5 md:py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none shadow-sm focus:bg-white"
                        />
                    </div>

                    <div className="w-full md:w-1/4 flex justify-end z-10">
                        {canManage && (
                            <button
                                type="button"
                                onClick={() => { setShowForm(true); resetForm(); }}
                                className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center justify-center whitespace-nowrap"
                            >
                                <span className="mr-1.5 font-bold text-lg leading-none">+</span> Add New
                            </button>
                        )}
                    </div>
                </div>
            )}

            {showForm && (
                <div className="relative rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl p-6 md:p-8">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />

                    <div className="flex items-center justify-between mb-6 border-b border-gray-200/50 pb-4 relative z-10">
                        <h3 className="text-xl font-semibold text-gray-800">
                            {editingId ? 'Edit TR Setup' : 'New TR Setup'}
                        </h3>
                        <button
                            type="button"
                            onClick={() => { setShowForm(false); resetForm(); }}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                        <div className="space-y-2 max-w-xl">
                            <label className="text-sm font-medium text-gray-700">Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                required
                                placeholder="Enter setup name"
                                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2 max-w-2xl">
                            <label className="text-sm font-medium text-gray-700">TR Formate</label>
                            <div className="rounded-xl border border-gray-200 shadow-sm bg-white/50 p-4">
                                {formData.trFormat ? (
                                    <div className="relative group">
                                        <img
                                            src={formData.trFormat}
                                            alt="TR Formate preview"
                                            className="w-full max-h-[400px] object-contain rounded-lg border border-gray-200 bg-gray-50 p-2"
                                        />
                                        <button
                                            type="button"
                                            onClick={removeTrFormat}
                                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100"
                                            title="Remove image"
                                        >
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-blue-50/30 hover:border-blue-400 transition-all group">
                                        <div className="flex flex-col items-center justify-center py-6">
                                            <PlusIcon className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mb-2 transition-colors" />
                                            <p className="text-sm font-semibold text-gray-500 group-hover:text-blue-600 transition-colors">
                                                Click to upload TR Formate
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">Supports JPG, PNG</p>
                                        </div>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/png, image/jpeg, image/jpg"
                                            onChange={handleTrFormatChange}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>

                        {submitStatus?.type === 'error' && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold max-w-2xl">
                                {submitStatus.message}
                            </div>
                        )}

                        <div className="flex justify-end gap-4 border-t border-gray-200/50 pt-6">
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); resetForm(); }}
                                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 disabled:scale-100 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Saving...' : editingId ? 'Update Setup' : 'Save Setup'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl shadow-xl overflow-hidden">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="spinner w-10 h-10" />
                            <p className="text-sm font-medium text-gray-500">Loading TR setups...</p>
                        </div>
                    ) : displayRecords.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                            <h3 className="text-lg font-bold text-gray-800 mb-1">No TR Setups Found</h3>
                            <p className="text-sm text-gray-500">
                                {searchQuery ? 'Try adjusting your search.' : 'Click "+ Add New" to create a TR setup.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 md:p-6">
                            {displayRecords.map(record => (
                                <div
                                    key={record._id}
                                    className="rounded-xl border border-gray-200/80 bg-white/70 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                                >
                                    {record.trFormat ? (
                                        <img
                                            src={record.trFormat}
                                            alt={record.name || 'TR Formate'}
                                            className="w-full h-40 object-contain bg-gray-50 border-b border-gray-100 p-2"
                                        />
                                    ) : (
                                        <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-sm text-gray-400 border-b border-gray-100">
                                            No image
                                        </div>
                                    )}
                                    <div className="p-4">
                                        <h4 className="font-semibold text-gray-800 truncate">{record.name || '—'}</h4>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {record.createdAt ? formatDate(record.createdAt) : ''}
                                        </p>
                                        {canManage && (
                                            <div className="flex gap-2 mt-4">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEdit(record)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                                >
                                                    <EditIcon className="w-4 h-4" />
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(record._id)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default TRSetup;
