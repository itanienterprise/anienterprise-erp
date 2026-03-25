import React, { useState, useEffect } from 'react';
import { SearchIcon, PlusIcon, EditIcon, TrashIcon, UserIcon, XIcon } from '../../Icons';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import { encryptData, decryptData } from '../../../utils/encryption';
import axios from '../../../utils/api';

const Bank = ({ onDeleteConfirm }) => {
    const [banks, setBanks] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        bankName: '',
        branches: [{ branch: '', accountName: '', accountNo: '' }],
        status: 'Active'
    });

    useEffect(() => {
        fetchBanks();
    }, []);

    const fetchBanks = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/banks`);
            setBanks(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching banks:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleBranchChange = (index, e) => {
        const { name, value } = e.target;
        const updatedBranches = [...formData.branches];
        updatedBranches[index] = { ...updatedBranches[index], [name]: value };
        setFormData(prev => ({ ...prev, branches: updatedBranches }));
    };

    const addBranchRow = () => {
        setFormData(prev => ({
            ...prev,
            branches: [...prev.branches, { branch: '', accountName: '', accountNo: '' }]
        }));
    };

    const removeBranchRow = (index) => {
        if (formData.branches.length > 1) {
            const updatedBranches = formData.branches.filter((_, i) => i !== index);
            setFormData(prev => ({ ...prev, branches: updatedBranches }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            const url = editingId
                ? `${API_BASE_URL}/api/banks/${editingId}`
                : `${API_BASE_URL}/api/banks`;

            if (editingId) {
                await axios.put(url, formData);
            } else {
                await axios.post(url, formData);
            }

            setSubmitStatus('success');
            fetchBanks();
            setTimeout(() => {
                setShowForm(false);
                setEditingId(null);
                resetForm();
                setSubmitStatus(null);
            }, 2000);
        } catch (error) {
            console.error('Error saving bank:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            bankName: '',
            branches: [{ branch: '', accountName: '', accountNo: '' }],
            status: 'Active'
        });
        setEditingId(null);
        setSubmitStatus(null);
    };

    const handleEdit = (bank) => {
        // Handle backwards compatibility for banks saved with old structure
        const branches = bank.branches || [
            {
                branch: bank.branch || '',
                accountName: bank.accountName || '',
                accountNo: bank.accountNo || ''
            }
        ];

        setFormData({
            bankName: bank.bankName || '',
            branches: branches,
            status: bank.status || 'Active'
        });
        setEditingId(bank._id);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        onDeleteConfirm({ show: true, type: 'bank', id, isBulk: false });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                {!showForm ? (
                    <>
                        <div className="w-1/4">
                            <h2 className="text-2xl font-bold text-gray-800">Bank Management</h2>
                        </div>

                        <div className="flex-1 max-w-md mx-auto relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by bank name or account..."
                                autoComplete="off"
                                className="block w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </>
                ) : (
                    <div className="flex-1"></div>
                )}

                <div className="w-1/4 flex justify-end gap-3 z-50">
                    <button 
                        onClick={() => setShowForm(!showForm)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center"
                    >
                        <span className="mr-2 text-xl">+</span> Add New Bank
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="relative overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl p-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <div className="flex items-center space-x-3">
                            <h3 className="text-xl font-semibold text-gray-800">{editingId ? 'Edit Bank Account' : 'New Bank Registration'}</h3>
                        </div>
                        <button 
                            onClick={() => { setShowForm(false); resetForm(); }}
                            className="p-2 hover:bg-gray-100/80 text-gray-400 hover:text-rose-500 rounded-xl transition-all"
                        >
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} autoComplete="off" className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                        <div className="col-span-1 md:col-span-2 space-y-2">
                            <label className="text-sm font-medium text-gray-700">Bank Name</label>
                            <input
                                type="text"
                                name="bankName"
                                value={formData.bankName}
                                onChange={handleInputChange}
                                required
                                placeholder="Enter Bank Name"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm shadow-sm"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2 space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Branch Details</label>
                                <button
                                    type="button"
                                    onClick={addBranchRow}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all border border-blue-100"
                                >
                                    <PlusIcon className="w-3.5 h-3.5" />
                                    Add Branch
                                </button>
                            </div>

                            <div className="space-y-3">
                                {formData.branches.map((branch, index) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-100 relative group/row">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Branch</label>
                                            <input
                                                type="text"
                                                name="branch"
                                                value={branch.branch}
                                                onChange={(e) => handleBranchChange(index, e)}
                                                required
                                                placeholder="Branch Name"
                                                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Account Name</label>
                                            <input
                                                type="text"
                                                name="accountName"
                                                value={branch.accountName}
                                                onChange={(e) => handleBranchChange(index, e)}
                                                required
                                                placeholder="Account Name"
                                                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1.5 relative">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Account No</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    name="accountNo"
                                                    value={branch.accountNo}
                                                    onChange={(e) => handleBranchChange(index, e)}
                                                    required
                                                    placeholder="Account Number"
                                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                                />
                                                {formData.branches.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeBranchRow(index)}
                                                        className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-2 flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
                            <div className="flex-1">
                                {submitStatus === 'success' && (
                                    <div className="flex items-center text-emerald-600 font-bold animate-in fade-in slide-in-from-left-4">
                                        <div className="p-1 bg-emerald-100 rounded-full mr-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                        </div>
                                        Bank saved successfully!
                                    </div>
                                )}
                                {submitStatus === 'error' && (
                                    <div className="flex items-center text-red-600 font-bold animate-in fade-in slide-in-from-left-4">
                                        <div className="p-1 bg-red-100 rounded-full mr-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        </div>
                                        Failed to save bank records.
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowForm(false); resetForm(); }}
                                    className="px-6 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isSubmitting ? 'Saving...' : editingId ? 'Update Bank' : 'Save Bank'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Bank</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Branch</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Account Name</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Account No</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {isLoading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan="5" className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                                        </tr>
                                    ))
                                ) : banks.length > 0 ? (
                                    banks.flatMap(bank => {
                                        // Handle backwards compatibility for single-branch records
                                        const branches = bank.branches || [{
                                            branch: bank.branch,
                                            accountName: bank.accountName,
                                            accountNo: bank.accountNo
                                        }];
                                        
                                        return branches.map((branch, idx) => ({
                                            ...bank,
                                            ...branch,
                                            uniqueRowKey: `${bank._id}-${idx}`
                                        }));
                                    }).filter(item => 
                                        (item.bankName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        (item.accountNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        (item.accountName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        (item.branch || '').toLowerCase().includes(searchQuery.toLowerCase())
                                    ).map((item) => (
                                        <tr key={item.uniqueRowKey} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4 text-[13px] font-medium text-gray-600">{item.bankName}</td>
                                            <td className="px-6 py-4 text-[13px] font-medium text-gray-600">{item.branch}</td>
                                            <td className="px-6 py-4 text-[13px] font-medium text-gray-600">{item.accountName}</td>
                                            <td className="px-6 py-4 text-[13px] font-medium text-gray-600">{item.accountNo}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center items-center gap-2">
                                                    <button 
                                                        onClick={() => handleEdit(item)}
                                                        className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition-all"
                                                    >
                                                        <EditIcon className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(item._id)}
                                                        className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-all"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="p-4 bg-gray-50 rounded-full mb-4">
                                                    <UserIcon className="w-8 h-8 text-gray-300" />
                                                </div>
                                                <p className="text-gray-500 font-medium">No bank accounts found</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Bank;
