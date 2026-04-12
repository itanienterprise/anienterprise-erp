import React, { useState, useEffect } from 'react';
import axios from '../../../utils/api';
import { 
    PlusIcon, XIcon, EditIcon, TrashIcon, SearchIcon, 
    LCManagerIcon, ShieldIcon, BuildingIcon, GlobeIcon, 
    DollarSignIcon, CalendarIcon, ChevronDownIcon 
} from '../../Icons';
import { formatDate, API_BASE_URL } from '../../../utils/helpers';
import CustomDatePicker from '../../shared/CustomDatePicker';
import './LCManagement.css';

const LCManagement = ({ addNotification }) => {
    const [lcRecords, setLcRecords] = useState([]);
    const [banks, setBanks] = useState([]);
    const [importers, setImporters] = useState([]);
    const [exporters, setExporters] = useState([]);
    const [insuranceCos, setInsuranceCos] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [formData, setFormData] = useState({
        lcNo: '',
        openingDate: '',
        expiryDate: '',
        bankName: '',
        importerName: '',
        exporterName: '',
        insuranceCo: '',
        totalAmount: '',
        margin: '',
        status: 'Opened'
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const [lcRes, bankRes, impRes, expRes, insRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/lc-management`),
                axios.get(`${API_BASE_URL}/api/banks`),
                axios.get(`${API_BASE_URL}/api/importers`),
                axios.get(`${API_BASE_URL}/api/exporters`),
                axios.get(`${API_BASE_URL}/api/insurance`)
            ]);
            
            setLcRecords(Array.isArray(lcRes.data) ? lcRes.data : []);
            setBanks(Array.isArray(bankRes.data) ? bankRes.data.map(b => b.bankName) : []);
            setImporters(Array.isArray(impRes.data) ? impRes.data.map(i => i.name) : []);
            setExporters(Array.isArray(expRes.data) ? expRes.data.map(e => e.name) : []);
            setInsuranceCos(Array.isArray(insRes.data) ? insRes.data.map(i => i.companyName) : []);
        } catch (error) {
            console.error('Error fetching LC initial data:', error);
            addNotification?.('Failed to load LC records', 'error');
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
        try {
            if (editingId) {
                await axios.put(`${API_BASE_URL}/api/lc-management/${editingId}`, formData);
                addNotification?.('LC record updated successfully', 'success');
            } else {
                await axios.post(`${API_BASE_URL}/api/lc-management`, formData);
                addNotification?.('New LC record created successfully', 'success');
            }
            resetForm();
            fetchInitialData();
        } catch (error) {
            console.error('Error saving LC record:', error);
            addNotification?.('Failed to save LC record', 'error');
        }
    };

    const handleEdit = (record) => {
        setFormData({
            lcNo: record.lcNo || '',
            openingDate: record.openingDate || '',
            expiryDate: record.expiryDate || '',
            bankName: record.bankName || '',
            importerName: record.importerName || '',
            exporterName: record.exporterName || '',
            insuranceCo: record.insuranceCo || '',
            totalAmount: record.totalAmount || '',
            margin: record.margin || '',
            status: record.status || 'Opened'
        });
        setEditingId(record._id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this LC record?')) return;
        try {
            await axios.delete(`${API_BASE_URL}/api/lc-management/${id}`);
            addNotification?.('LC record deleted', 'success');
            fetchInitialData();
        } catch (error) {
            console.error('Error deleting LC record:', error);
            addNotification?.('Failed to delete LC record', 'error');
        }
    };

    const resetForm = () => {
        setFormData({
            lcNo: '',
            openingDate: '',
            expiryDate: '',
            bankName: '',
            importerName: '',
            exporterName: '',
            insuranceCo: '',
            totalAmount: '',
            margin: '',
            status: 'Opened'
        });
        setEditingId(null);
        setShowForm(false);
    };

    const filteredRecords = lcRecords.filter(record => 
        (record.lcNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (record.importerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (record.bankName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Standard Module Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {!showForm ? (
                    <>
                        <div className="w-full md:w-1/4 text-center md:text-left">
                            <h2 className="text-2xl font-bold text-gray-800">LC Management</h2>
                        </div>

                        <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                            <div className="absolute inset-y-0 left-0 pl-12 md:pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by LC Number, Importer or Bank..."
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
                        <span className="mr-2 text-xl font-bold">{showForm ? '×' : '+'}</span>
                        <span>{showForm ? 'Cancel Registration' : 'Register New LC'}</span>
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="lc-form-container relative overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl p-5 md:p-8">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl text-sm"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl delay-1000"></div>

                    <div className="flex items-center justify-between mb-6 md:mb-8 relative z-10">
                        <h3 className="text-lg md:text-xl font-semibold text-gray-800">
                            {editingId ? 'Edit LC Record' : 'New LC Registration'}
                        </h3>
                    </div>

                    <form 
                        onSubmit={handleSubmit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                                e.preventDefault();
                            }
                        }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10"
                    >
                        <div className="space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">LC Number</label>
                            <div className="relative">
                                <LCManagerIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                                <input
                                    type="text"
                                    name="lcNo"
                                    value={formData.lcNo}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="Enter LC Number"
                                    className="w-full px-4 py-2.5 pl-10 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">Status</label>
                            <select 
                                name="status" 
                                value={formData.status} 
                                onChange={handleInputChange}
                                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                            >
                                <option value="Opened">Opened</option>
                                <option value="In-Transit">In-Transit</option>
                                <option value="Received">Received</option>
                                <option value="Closed">Closed</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <CustomDatePicker
                                label="Opening Date"
                                value={formData.openingDate}
                                onChange={(e) => setFormData(prev => ({ ...prev, openingDate: e.target.value }))}
                                required
                                compact={true}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <CustomDatePicker
                                label="Expiry Date"
                                value={formData.expiryDate}
                                onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                                required
                                compact={true}
                            />
                        </div>

                        <div className="space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">Issuing Bank</label>
                            <select 
                                name="bankName" 
                                value={formData.bankName} 
                                onChange={handleInputChange}
                                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                required
                            >
                                <option value="">Select Bank</option>
                                {banks.map((bank, idx) => (
                                    <option key={idx} value={bank}>{bank}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">Importer</label>
                            <select 
                                name="importerName" 
                                value={formData.importerName} 
                                onChange={handleInputChange}
                                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                required
                            >
                                <option value="">Select Importer</option>
                                {importers.map((imp, idx) => (
                                    <option key={idx} value={imp}>{imp}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">Exporter</label>
                            <select 
                                name="exporterName" 
                                value={formData.exporterName} 
                                onChange={handleInputChange}
                                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                required
                            >
                                <option value="">Select Exporter</option>
                                {exporters.map((exp, idx) => (
                                    <option key={idx} value={exp}>{exp}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">Insurance Company</label>
                            <select 
                                name="insuranceCo" 
                                value={formData.insuranceCo} 
                                onChange={handleInputChange}
                                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                            >
                                <option value="">Select Insurance</option>
                                {insuranceCos.map((ins, idx) => (
                                    <option key={idx} value={ins}>{ins}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">Total LC Amount</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                <input
                                    type="number"
                                    name="totalAmount"
                                    value={formData.totalAmount}
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">Margin (%)</label>
                            <input
                                type="number"
                                name="margin"
                                value={formData.margin}
                                onChange={handleInputChange}
                                placeholder="0"
                                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                            />
                        </div>

                        <div className="md:col-span-2 lg:col-span-3 flex justify-end mt-4">
                            <button 
                                type="submit" 
                                className="px-10 py-3 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-black hover:to-gray-800 text-white font-bold rounded-xl shadow-xl transition-all active:scale-95 transform"
                            >
                                {editingId ? 'Update LC Record' : 'Complete Registration'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="overflow-x-auto bg-white/50 backdrop-blur-xl border border-white/40 rounded-2xl shadow-xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">LC Number</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Dates</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Parties</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">LC Amount</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-sm text-gray-500 font-medium">Loading records...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredRecords.length > 0 ? (
                                filteredRecords.map((record) => (
                                    <tr key={record._id} className="lc-table-row hover:bg-white/80 transition-all group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-900">{record.lcNo}</span>
                                                <span className="text-[11px] font-bold text-blue-500 uppercase">{record.bankName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium">
                                            <span className={`lc-status-badge status-${record.status?.toLowerCase().replace(' ', '-')}`}>
                                                {record.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5 text-[11px]">
                                                    <span className="text-gray-400 font-bold w-12">OPEN:</span>
                                                    <span className="text-gray-700 font-medium">{formatDate(record.openingDate)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[11px]">
                                                    <span className="text-gray-400 font-bold w-12">EXP:</span>
                                                    <span className="text-red-500 font-bold">{formatDate(record.expiryDate)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <BuildingIcon className="w-3.5 h-3.5 text-indigo-400" />
                                                    <span className="text-xs font-bold text-gray-700">{record.importerName}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <GlobeIcon className="w-3.5 h-3.5 text-emerald-400" />
                                                    <span className="text-[11px] font-semibold text-gray-500">{record.exporterName}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-bold text-gray-900">৳{parseFloat(record.totalAmount || 0).toLocaleString()}</span>
                                                <span className="text-[10px] text-gray-400 font-bold tracking-tight">MARGIN: {record.margin}%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleEdit(record)}
                                                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                                    title="Edit Record"
                                                >
                                                    <EditIcon className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(record._id)}
                                                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                                    title="Delete Record"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                <LCManagerIcon className="w-12 h-12 text-gray-200" />
                                            <span className="text-gray-400 font-medium">No LC records found</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default LCManagement;
