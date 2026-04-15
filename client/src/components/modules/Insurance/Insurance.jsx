import React, { useState, useEffect, useMemo } from 'react';
import { SearchIcon, PlusIcon, EditIcon, TrashIcon, ShieldIcon, XIcon, ChevronDownIcon, ChevronUpIcon } from '../../Icons';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import CustomDatePicker from '../../shared/CustomDatePicker';

const Insurance = ({ onDeleteConfirm }) => {
    const [insuranceRecords, setInsuranceRecords] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [expandedRowKey, setExpandedRowKey] = useState(null);
    
    const [formData, setFormData] = useState({
        companyName: '',
        address: '',
        contactPerson: '',
        phone: '',
        email: '',
        policyType: '',
        premiumPercent: '',
        premiumReturnPercent: '',
        stampCharge: '',
        status: 'Active'
    });

    useEffect(() => {
        fetchInsurance();
    }, []);

    const fetchInsurance = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/insurance`);
            setInsuranceRecords(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching insurance records:', error);
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
            const url = editingId
                ? `${API_BASE_URL}/api/insurance/${editingId}`
                : `${API_BASE_URL}/api/insurance`;

            if (editingId) {
                await axios.put(url, formData);
            } else {
                await axios.post(url, formData);
            }

            setSubmitStatus('success');
            fetchInsurance();
            setTimeout(() => {
                setShowForm(false);
                resetForm();
                setSubmitStatus(null);
            }, 1500);
        } catch (error) {
            console.error('Error saving insurance record:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            companyName: '',
            address: '',
            contactPerson: '',
            phone: '',
            email: '',
            policyType: '',
            premiumPercent: '',
            premiumReturnPercent: '',
            stampCharge: '',
            status: 'Active'
        });
        setEditingId(null);
        setSubmitStatus(null);
    };

    const handleEdit = (record) => {
        setFormData({
            companyName: record.companyName || '',
            address: record.address || '',
            contactPerson: record.contactPerson || '',
            phone: record.phone || '',
            email: record.email || '',
            policyType: record.policyType || '',
            premiumPercent: record.premiumPercent || '',
            premiumReturnPercent: record.premiumReturnPercent || '',
            stampCharge: record.stampCharge || '',
            status: record.status || 'Active'
        });
        setEditingId(record._id);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        onDeleteConfirm({ show: true, type: 'insurance', id, isBulk: false });
    };

    const toggleRowExpansion = (id) => {
        setExpandedRowKey(prev => prev === id ? null : id);
    };

    const displayRecords = useMemo(() => {
        return insuranceRecords.filter(item => 
            (item.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.policyType || '').toLowerCase().includes(searchQuery.toLowerCase())
        ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [insuranceRecords, searchQuery]);

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {!showForm ? (
                    <>
                        <div className="w-full md:w-1/4 text-center md:text-left">
                            <h2 className="text-2xl font-bold text-gray-800">Insurance Management</h2>
                        </div>

                        <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                            <div className="absolute inset-y-0 left-0 pl-12 md:pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by company or policy..."
                                autoComplete="off"
                                className="block w-full pl-10 pr-4 py-2.5 md:py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </>
                ) : (
                    <div className="hidden md:block md:flex-1"></div>
                )}

                <div className={`${showForm ? 'w-full md:w-auto flex justify-end' : 'w-full md:w-1/4 flex justify-end'} gap-3 z-50`}>
                    <button 
                        onClick={() => { setShowForm(!showForm); if(showForm) resetForm(); }}
                        className="w-full md:w-auto px-4 py-2.5 md:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 md:hover:scale-105 flex items-center justify-center"
                    >
                        <span className="mr-2 text-xl font-bold">+</span>
                        <span>{showForm ? 'Cancel Policy' : 'New Company'}</span>
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="relative overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl p-5 md:p-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl text-sm"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl delay-1000"></div>

                    <div className="flex items-center justify-between mb-6 md:mb-8 relative z-10">
                        <div className="flex items-center space-x-3">
                            <h3 className="text-lg md:text-xl font-semibold text-gray-800">{editingId ? 'Edit Insurance Policy' : 'New Insurance Company'}</h3>
                        </div>
                    </div>

                    <form 
                        onSubmit={handleSubmit} 
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                                e.preventDefault();
                            }
                        }}
                        autoComplete="off" 
                        className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10"
                    >
                        <div className="md:col-span-2 space-y-4">
                            <h4 className="text-sm font-bold text-blue-600 uppercase tracking-wider bg-blue-50/50 p-2 rounded-lg">Company Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Insurance Company</label>
                                    <input
                                        type="text"
                                        name="companyName"
                                        value={formData.companyName}
                                        onChange={handleInputChange}
                                        required
                                        placeholder="Enter Company Name"
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Contact Person</label>
                                    <input
                                        type="text"
                                        name="contactPerson"
                                        value={formData.contactPerson}
                                        onChange={handleInputChange}
                                        placeholder="Name of Contact Person"
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Company Address</label>
                                    <textarea
                                        name="address"
                                        value={formData.address}
                                        onChange={handleInputChange}
                                        placeholder="Full Address"
                                        rows="2"
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Phone Number</label>
                                    <input
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        placeholder="Office Phone"
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Email Address</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        placeholder="Email"
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-4 pt-4">
                            <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50/50 p-2 rounded-lg">Policy Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Policy Type</label>
                                    <select
                                        name="policyType"
                                        value={formData.policyType}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    >
                                        <option value="">Select Type</option>
                                        <option value="Marine Insurance">Marine Insurance</option>
                                        <option value="Fire Insurance">Fire Insurance</option>
                                        <option value="Transit Insurance">Transit Insurance</option>
                                        <option value="General Asset">General Asset</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>




                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">
                                        {formData.policyType ? formData.policyType.split(' ')[0] : 'Policy type'} premium (%)
                                    </label>
                                    <input
                                        type="number"
                                        name="premiumPercent"
                                        value={formData.premiumPercent}
                                        onChange={handleInputChange}
                                        step="0.01"
                                        placeholder="0.00"
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>


                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Premium Return (%)</label>
                                    <input
                                        type="number"
                                        name="premiumReturnPercent"
                                        value={formData.premiumReturnPercent}
                                        onChange={handleInputChange}
                                        step="0.01"
                                        placeholder="0.00"
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Stamp Charge</label>
                                    <input
                                        type="number"
                                        name="stampCharge"
                                        value={formData.stampCharge}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-2 flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 mt-4 border-t border-gray-100">
                            <div className="flex-1">
                                {submitStatus === 'success' && (
                                    <div className="flex items-center text-emerald-600 font-bold text-sm animate-in fade-in slide-in-from-left-4">
                                        Policy saved successfully!
                                    </div>
                                )}
                                {submitStatus === 'error' && (
                                    <div className="flex items-center text-red-600 font-bold text-sm animate-in fade-in slide-in-from-left-4">
                                        Failed to save record.
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowForm(false); resetForm(); }}
                                    className="px-6 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all text-sm ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isSubmitting ? 'Saving...' : editingId ? 'Update Policy' : 'Save Policy'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="space-y-4">
                    {/* Desktop View */}
                    <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Company</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Phone</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Email</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Type</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Premium (%)</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Return (%)</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {isLoading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan="7" className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                                        </tr>
                                    ))
                                ) : displayRecords.length > 0 ? (
                                    displayRecords.map((item) => (
                                        <tr key={item._id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4 text-[13px] font-bold text-gray-700">{item.companyName}</td>
                                            <td className="px-6 py-4 text-[13px] font-medium text-gray-600">{item.phone || 'N/A'}</td>
                                            <td className="px-6 py-4 text-[13px] font-medium text-blue-600">{item.email || 'N/A'}</td>
                                            <td className="px-6 py-4 text-[13px] font-medium text-gray-600">{item.policyType}</td>
                                            <td className="px-6 py-4 text-[13px] font-bold text-indigo-600 text-center">{item.premiumPercent || '0.00'}%</td>
                                            <td className="px-6 py-4 text-[13px] font-bold text-emerald-600 text-center">{item.premiumReturnPercent || '0.00'}%</td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center items-center gap-2">
                                                    <button onClick={() => handleEdit(item)} className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition-all" title="Edit">
                                                        <EditIcon className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(item._id)} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-all" title="Delete">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center text-gray-500">No insurance policies found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View */}
                    <div className="md:hidden space-y-4">
                        {displayRecords.map((item) => {
                            const isExpanded = expandedRowKey === item._id;
                            return (
                                <div key={item._id} onClick={() => toggleRowExpansion(item._id)} className={`bg-white rounded-2xl border ${isExpanded ? 'border-blue-100 shadow-lg' : 'border-gray-100 shadow-sm'} p-5 transition-all cursor-pointer`}>
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <h3 className="text-base font-bold text-gray-800">{item.companyName}</h3>
                                            <p className="text-xs text-gray-500">{item.policyType}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="p-2 hover:bg-blue-50 text-gray-400 hover:text-blue-500 rounded-lg transition-all">
                                                <EditIcon className="w-5 h-5" />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }} className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-500 rounded-lg transition-all">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-6 animate-in fade-in duration-300">
                                            {/* Company Contact */}
                                            <div className="grid grid-cols-1 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                                                <div className="md:col-span-1 space-y-1">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Address</p>
                                                    <p className="text-[13px] text-gray-600 leading-relaxed font-medium">{item.address || 'N/A'}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contact Person</p>
                                                        <p className="text-[13px] text-gray-700 font-bold">{item.contactPerson || 'N/A'}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone</p>
                                                        <p className="text-[13px] text-gray-700 font-bold">{item.phone || 'N/A'}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email</p>
                                                        <p className="text-[13px] text-blue-600 font-bold break-all">{item.email || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Detailed Policy Metrics */}
                                            <div className="grid grid-cols-2 gap-4 px-1">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                        {item.policyType ? item.policyType.split(' ')[0] : 'Policy type'} premium (%)
                                                    </p>
                                                    <p className="text-sm font-bold text-indigo-600">{item.premiumPercent || '0.00'}%</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Return (%)</p>
                                                    <p className="text-sm font-bold text-emerald-600">{item.premiumReturnPercent || '0.00'}%</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stamp Charge</p>
                                                    <p className="text-sm font-bold text-gray-800">{parseFloat(item.stampCharge || 0).toLocaleString()}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</p>
                                                    <p className={`text-sm font-bold ${item.status === 'Active' ? 'text-emerald-600' : 'text-amber-600'}`}>{item.status}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Insurance;
