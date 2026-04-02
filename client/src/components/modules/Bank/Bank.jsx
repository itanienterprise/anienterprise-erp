import React, { useState, useEffect, useMemo } from 'react';
import { SearchIcon, PlusIcon, EditIcon, TrashIcon, UserIcon, XIcon, ChevronDownIcon, ChevronUpIcon } from '../../Icons';
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
    const [expandedRowKey, setExpandedRowKey] = useState(null);
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

    const toggleRowExpansion = (uniqueKey) => {
        setExpandedRowKey(prev => prev === uniqueKey ? null : uniqueKey);
    };

    const displayBanks = useMemo(() => {
        const flattened = banks.flatMap(bank => {
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
        );

        // Group by bank name
        const groups = flattened.reduce((acc, current) => {
            const name = (current.bankName || '').trim().toUpperCase();
            if (!acc[name]) {
                acc[name] = {
                    bankName: current.bankName,
                    items: []
                };
            }
            acc[name].items.push(current);
            return acc;
        }, {});

        return Object.values(groups).sort((a, b) => (a.bankName || '').localeCompare(b.bankName || ''));
    }, [banks, searchQuery]);

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {!showForm ? (
                    <>
                        <div className="w-full md:w-1/4 text-center md:text-left">
                            <h2 className="text-2xl font-bold text-gray-800">Bank Management</h2>
                        </div>

                        <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                            <div className="absolute inset-y-0 left-0 pl-5.5 md:pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by bank name or account..."
                                autoComplete="off"
                                className="block w-full pl-10 md:pl-10 pr-4 py-2.5 md:py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] md:text-[13px] text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
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
                        onClick={() => setShowForm(!showForm)}
                        className="w-full md:w-auto px-4 py-2.5 md:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 md:hover:scale-105 flex items-center justify-center"
                    >
                        <span className="mr-2 text-xl font-bold">+</span>
                        <span>{showForm ? 'Cancel Registration' : 'Add New Bank'}</span>
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="relative overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl p-5 md:p-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse text-sm"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

                    <div className="flex items-center justify-between mb-6 md:mb-8 relative z-10">
                        <div className="flex items-center space-x-3">
                            <h3 className="text-lg md:text-xl font-semibold text-gray-800">{editingId ? 'Edit Bank Account' : 'New Bank Registration'}</h3>
                        </div>
                        <button 
                            onClick={() => { setShowForm(false); resetForm(); }}
                            className="p-1.5 md:p-2 hover:bg-gray-100/80 text-gray-400 hover:text-rose-500 rounded-xl transition-all"
                        >
                            <XIcon className="w-5 h-5 md:w-6 md:h-6" />
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

                        <div className="col-span-1 md:col-span-2 flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 mt-4 border-t border-gray-100">
                            <div className="flex-1">
                                {submitStatus === 'success' && (
                                    <div className="flex items-center text-emerald-600 font-bold text-sm animate-in fade-in slide-in-from-left-4">
                                        <div className="p-1 bg-emerald-100 rounded-full mr-2">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                        </div>
                                        Bank saved successfully!
                                    </div>
                                )}
                                {submitStatus === 'error' && (
                                    <div className="flex items-center text-red-600 font-bold text-sm animate-in fade-in slide-in-from-left-4">
                                        <div className="p-1 bg-red-100 rounded-full mr-2">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        </div>
                                        Failed to save bank records.
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowForm(false); resetForm(); }}
                                    className="flex-1 md:flex-none px-6 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`flex-1 md:flex-none px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all text-sm ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isSubmitting ? 'Saving...' : editingId ? 'Update Bank' : 'Save Bank'}
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
                                ) : displayBanks.length > 0 ? (
                                    displayBanks.map((group) => (
                                        <React.Fragment key={group.bankName}>
                                            {group.items.map((item, idx) => (
                                                <tr key={item.uniqueRowKey} className="hover:bg-gray-50/50 transition-colors group border-b border-gray-100 last:border-b-0">
                                                    <td className="px-6 py-4 text-[13px] font-bold text-gray-700">
                                                        {idx === 0 ? group.bankName : ''}
                                                    </td>
                                                    <td className="px-6 py-4 text-[13px] font-medium text-gray-600">{item.branch}</td>
                                                    <td className="px-6 py-4 text-[13px] font-medium text-gray-600">{item.accountName}</td>
                                                    <td className="px-6 py-4 text-[13px] font-medium text-gray-600">{item.accountNo}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex justify-center items-center gap-2">
                                                            <button 
                                                                onClick={() => handleEdit(item)}
                                                                className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition-all"
                                                                title="Edit"
                                                            >
                                                                <EditIcon className="w-4 h-4" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDelete(item._id)}
                                                                className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-all"
                                                                title="Delete"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-sm md:text-base">
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

                {/* Mobile View */}
                <div className="md:hidden space-y-4">
                    {isLoading ? (
                        Array(3).fill(0).map((_, i) => (
                            <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm animate-pulse">
                                <div className="h-4 bg-gray-100 rounded w-1/2 mb-3"></div>
                                <div className="h-3 bg-gray-50 rounded w-3/4 mb-2"></div>
                                <div className="h-3 bg-gray-50 rounded w-1/4"></div>
                            </div>
                        ))
                    ) : displayBanks.length > 0 ? (
                        displayBanks.map((group) => {
                            const isExpanded = expandedRowKey === group.bankName;
                            return (
                                <div 
                                    key={group.bankName} 
                                    onClick={() => toggleRowExpansion(group.bankName)}
                                    className={`bg-white rounded-2xl border ${isExpanded ? 'border-blue-100 ring-4 ring-blue-500/5 shadow-lg' : 'border-gray-100 shadow-sm'} p-5 transition-all duration-500 cursor-pointer overflow-hidden`}
                                >
                                    <div className="flex justify-between items-center group">
                                        <div className="space-y-1">
                                            <h3 className={`text-base md:text-lg font-black transition-colors duration-300 ${isExpanded ? 'text-blue-600' : 'text-gray-800'}`}>
                                                {group.bankName}
                                            </h3>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                                                <span className={`w-1.5 h-1.5 rounded-full mr-2 ${isExpanded ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></span>
                                                {group.items.length} {group.items.length > 1 ? 'Accounts' : 'Account'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center bg-gray-50/80 p-0.5 rounded-lg border border-gray-100 divide-x divide-gray-100">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleEdit(group.items[0]); }}
                                                    className="p-2 hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-all"
                                                    title="Edit Bank"
                                                >
                                                    <EditIcon className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(group.items[0]._id); }}
                                                    className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-500 transition-all"
                                                    title="Delete Bank"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {isExpanded && (
                                        <div className="mt-6 space-y-4 animate-in slide-in-from-top-4 duration-500">
                                            {group.items.map((item, idx) => (
                                                <div key={item.uniqueRowKey} className="relative bg-gray-50/50 rounded-xl p-3 border border-gray-100/50">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 flex items-start gap-2 min-w-0">
                                                            <div className="flex-[0.8] min-w-0">
                                                                <div className="text-[7px] font-bold text-gray-400 uppercase leading-none mb-1">Branch</div>
                                                                <div className="text-[10px] font-bold text-gray-800 break-all">{item.branch}</div>
                                                            </div>
                                                            <div className="flex-[1.2] min-w-0 border-l border-gray-200/50 pl-2">
                                                                <div className="text-[7px] font-bold text-gray-400 uppercase leading-none mb-1">Name</div>
                                                                <div className="text-[10px] font-bold text-gray-700 break-words leading-tight">{item.accountName}</div>
                                                            </div>
                                                            <div className="flex-[1.1] min-w-0 border-l border-gray-200/50 pl-2">
                                                                <div className="text-[7px] font-bold text-blue-400 uppercase leading-none mb-1">Acc No</div>
                                                                <div className="text-[11px] font-black text-blue-600 break-all select-all">{item.accountNo}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                            <div className="flex flex-col items-center justify-center">
                                <div className="p-3 bg-gray-50 rounded-full mb-3">
                                    <UserIcon className="w-6 h-6 text-gray-300" />
                                </div>
                                <p className="text-gray-500 font-medium text-sm">No bank accounts found</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
);
};

export default Bank;
