import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from '../../../utils/api';
import { 
    PlusIcon, SearchIcon, FunnelIcon, 
    EditIcon, TrashIcon, FileTextIcon, CalendarIcon,
    ArrowUpRightIcon, CheckIcon, XIcon, LayoutIcon,
    ChevronDownIcon, ChevronUpIcon
} from '../../Icons';
import { API_BASE_URL, formatDate, SortIcon } from '../../../utils/helpers';
import CustomDatePicker from '../../shared/CustomDatePicker';
import { hasPermission } from '../../../utils/permissionHelper';

const LCGatePass = ({ currentUser, addNotification }) => {
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        gpDate: new Date().toISOString().split('T')[0],
        lcNumber: '',
        partyName: '',
        productName: '',
        lcQuantity: '',
        lcRate: '',
        totalLcValue: '',
        dollarRate: '',
        party: '',
        gpQuantity: '',
        gpRate: '',
        gpValue: '',
        remarks: '',
        status: 'Active'
    });
    const [editingId, setEditingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        product: '',
        status: ''
    });
    const [lcRecordsRaw, setLcRecordsRaw] = useState([]);
    const [customerRecordsRaw, setCustomerRecordsRaw] = useState([]);
    const [salesRecordsRaw, setSalesRecordsRaw] = useState([]);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [expandedGpIdx, setExpandedGpIdx] = useState(null);
    const lcRef = useRef(null);
    const partyRef = useRef(null);

    const canAdd = hasPermission(currentUser, 'lcManagement', 'add');
    const canEdit = hasPermission(currentUser, 'lcManagement', 'edit');
    const canDelete = hasPermission(currentUser, 'lcManagement', 'delete');
    const canManage = canAdd || canEdit || canDelete;
    const isBorderManager = (currentUser?.role || '').toLowerCase() === 'border manager';
    const isDataEntry = (currentUser?.role || '').toLowerCase() === 'data entry';
    const cannotDelete = !canDelete;

    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const [gpRes, lcRes, custRes, salesRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/lc-gp`),
                axios.get(`${API_BASE_URL}/api/lc-management`),
                axios.get(`${API_BASE_URL}/api/customers`),
                axios.get(`${API_BASE_URL}/api/sales`)
            ]);
            setRecords(gpRes.data);
            setLcRecordsRaw(lcRes.data);
            setCustomerRecordsRaw(custRes.data);
            setSalesRecordsRaw(salesRes.data);
        } catch (error) {
            console.error('Error fetching records:', error);
            addNotification?.('Failed to fetch records', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, []);

    // Outside click handler for dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (lcRef.current && !lcRef.current.contains(event.target) && 
                partyRef.current && !partyRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Auto-calculations for LC and GP values (BDT)
    useEffect(() => {
        const rate = parseFloat(formData.dollarRate) || 0;
        const totalLc = (parseFloat(formData.lcQuantity) || 0) * (parseFloat(formData.lcRate) || 0) * rate;
        const totalGp = (parseFloat(formData.gpQuantity) || 0) * (parseFloat(formData.gpRate) || 0) * rate;
        
        setFormData(prev => ({
            ...prev,
            totalLcValue: totalLc.toFixed(2),
            gpValue: totalGp.toFixed(2)
        }));
    }, [formData.lcQuantity, formData.lcRate, formData.gpQuantity, formData.gpRate, formData.dollarRate]);

    const filteredRecords = useMemo(() => {
        return records.filter(record => {
            const matchesSearch = 
                (record.partyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (record.party || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (record.lcNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (record.productName || '').toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesDate = 
                (!filters.startDate || record.gpDate >= filters.startDate) &&
                (!filters.endDate || record.gpDate <= filters.endDate);
            
            const matchesProduct = !filters.product || record.productName === filters.product;
            const matchesStatus = !filters.status || record.status === filters.status;

            return matchesSearch && matchesDate && matchesProduct && matchesStatus;
        });
    }, [records, searchQuery, filters]);

    const stats = useMemo(() => {
        return {
            total: records.length,
            active: records.filter(r => r.status === 'Active').length,
            completed: records.filter(r => r.status === 'Completed').length,
            today: records.filter(r => r.gpDate === new Date().toISOString().split('T')[0]).length
        };
    }, [records]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingId) {
                await axios.put(`${API_BASE_URL}/api/lc-gp/${editingId}`, formData);
                addNotification?.('Gate Pass updated successfully', 'success');
            } else {
                await axios.post(`${API_BASE_URL}/api/lc-gp`, formData);
                addNotification?.('New Gate Pass created successfully', 'success');
            }
            setShowForm(false);
            setEditingId(null);
            setExpandedGpIdx(null);
            setFormData({
                gpDate: new Date().toISOString().split('T')[0],
                lcNumber: '',
                partyName: '',
                productName: '',
                lcQuantity: '',
                lcRate: '',
                totalLcValue: '',
                dollarRate: '',
                party: '',
                gpQuantity: '',
                gpRate: '',
                gpValue: '',
                remarks: '',
                status: 'Active'
            });
            fetchRecords();
        } catch (error) {
            console.error('Error saving GP record:', error);
            addNotification?.('Failed to save Gate Pass', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (record) => {
        setFormData({ ...record });
        setEditingId(record._id);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (cannotDelete) {
            alert('Forbidden: You do not have permission to delete LC Gate Passes');
            return;
        }
        if (!window.confirm('Are you sure you want to delete this Gate Pass?')) return;
        try {
            await axios.delete(`${API_BASE_URL}/api/lc-gp/${id}`);
            addNotification?.('Gate Pass deleted successfully', 'success');
            setExpandedGpIdx(null);
            fetchRecords();
        } catch (error) {
            console.error('Error deleting GP record:', error);
            addNotification?.('Failed to delete Gate Pass', 'error');
        }
    };

    const handleLcSelect = (lc) => {
        if (!lc) {
            setFormData(prev => ({ ...prev, lcNumber: '' }));
            setActiveDropdown(null);
            return;
        }

        setFormData(prev => ({
            ...prev,
            lcNumber: lc.lcNo,
            partyName: lc.importerName || '',
            productName: lc.productName || '',
            lcQuantity: (parseFloat(lc.quantity || 0) * 1000).toString(),
            lcRate: (parseFloat(lc.rate || 0) / 1000).toString(),
            gpRate: (parseFloat(lc.rate || 0) / 1000).toString(),
            dollarRate: (lc.dollarRate || 0).toString()
        }));
        setActiveDropdown(null);
    };

    const handleDropdownKeyDown = (e, list) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev < list.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
            e.preventDefault();
            handleLcSelect(list[highlightedIndex]);
        } else if (e.key === 'Escape') {
            setActiveDropdown(null);
        }
    };

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Main Header Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {!showForm ? (
                    <>
                        <div className="w-full md:w-1/4 text-center md:text-left">
                            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">LC G.P Management</h2>
                        </div>

                        <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                            <div className="absolute inset-y-0 left-0 pl-12 md:pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by GP No, LC Number, Truck..."
                                autoComplete="off"
                                className="block w-full pl-10 pr-4 py-2.5 md:py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setExpandedGpIdx(null); }}
                            />
                        </div>
                    </>
                ) : (
                    <div className="hidden md:block md:flex-1"></div>
                )}

                {!showForm && canManage && (
                    <div className="w-full md:w-1/4 flex justify-end gap-3 z-50">
                        <button
                            onClick={() => setShowForm(true)}
                            className="w-full md:w-auto px-6 py-2.5 md:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 md:hover:scale-105 flex items-center justify-center"
                        >
                            <PlusIcon className="w-5 h-5 mr-2" />
                            <span> New Gate Pass</span>
                        </button>
                    </div>
                )}
            </div>

            {/* The stats, filters, and toolbar have been removed to match the LC Open module layout */}

            {/* Table / List View */}
            {!showForm && (
                <>
                    {/* Desktop View */}
                    <div className="hidden md:block bg-white/70 backdrop-blur-sm rounded-3xl border border-white/60 shadow-sm overflow-hidden overflow-x-auto transition-all duration-500">
                        <table className="w-full text-left min-w-[1000px]">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Date</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">LC Number</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Importer</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Party</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Product</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">LC Qty</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">G.P Qty</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">Border Sale</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">Rem. G.P</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">G.P Value</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center text-nowrap">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {isLoading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            {Array(11).fill(0).map((_, j) => (
                                                <td key={j} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-full" /></td>
                                            ))}
                                        </tr>
                                    ))
                                ) : filteredRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan="11" className="px-6 py-32 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="p-6 bg-gray-50 rounded-full">
                                                    <FileTextIcon className="w-12 h-12 text-gray-300" />
                                                </div>
                                                <div>
                                                    <p className="text-lg font-black text-gray-900">No Records Found</p>
                                                    <p className="text-sm text-gray-500">Try adjusting your filters or search query</p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRecords.map((record) => (
                                        <tr key={record._id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 group">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <p className="text-sm font-medium text-gray-600">{formatDate(record.gpDate)}</p>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <p className="text-sm font-bold text-gray-900">{record.lcNumber}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-medium text-gray-700">{record.partyName}</p>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-sm text-gray-700">{record.party || '-'}</td>
                                            <td className="px-6 py-4 font-bold text-sm text-gray-900">{record.productName}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-bold text-gray-900">
                                                    {parseFloat(record.lcQuantity || 0).toLocaleString('en-US')} <span className="text-[10px] text-gray-400 font-normal">Kg</span>
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-bold text-blue-600">
                                                    {parseFloat(record.gpQuantity || 0).toLocaleString('en-US')} <span className="text-[10px] text-gray-400 font-normal">Kg</span>
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {(() => {
                                                    const borderSaleForThisRow = salesRecordsRaw
                                                        .filter(s => {
                                                            const sTypeLow = (s.saleType || '').toLowerCase().trim();
                                                            const isBorder = sTypeLow === 'border' || sTypeLow === 'border sale' || (s.invoiceNo || '').startsWith('BS');
                                                            const sCompany = (s.companyName || '').toLowerCase().trim();
                                                            const sCustomer = (s.customerName || '').toLowerCase().trim();
                                                            const rParty = (record.party || '').toLowerCase().trim();
                                                            const isSameParty = sCompany === rParty || sCustomer === rParty;
                                                            return isBorder && s.lcNo === record.lcNumber && isSameParty && s.status !== 'Rejected';
                                                        })
                                                        .reduce((sum, sale) => {
                                                            const saleQty = (sale.items || []).reduce((itemSum, item) => {
                                                                const brandQty = (item.brandEntries || []).reduce((entrySum, entry) => entrySum + (parseFloat(entry.quantity) || 0), 0);
                                                                return itemSum + (brandQty > 0 ? brandQty : (parseFloat(item.quantity) || 0));
                                                            }, 0);
                                                            return sum + saleQty;
                                                        }, 0);
                                                    return (
                                                        <span className="text-sm font-bold text-orange-600">
                                                            {borderSaleForThisRow.toLocaleString('en-IN')} <span className="text-[10px] text-gray-400 font-normal">Kg</span>
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {(() => {
                                                    const borderSaleForThisRow = salesRecordsRaw
                                                        .filter(s => {
                                                            const sTypeLow = (s.saleType || '').toLowerCase().trim();
                                                            const isBorder = sTypeLow === 'border' || sTypeLow === 'border sale' || (s.invoiceNo || '').startsWith('BS');
                                                            const sCompany = (s.companyName || '').toLowerCase().trim();
                                                            const sCustomer = (s.customerName || '').toLowerCase().trim();
                                                            const rParty = (record.party || '').toLowerCase().trim();
                                                            const isSameParty = sCompany === rParty || sCustomer === rParty;
                                                            return isBorder && s.lcNo === record.lcNumber && isSameParty && s.status !== 'Rejected';
                                                        })
                                                        .reduce((sum, sale) => {
                                                            const saleQty = (sale.items || []).reduce((itemSum, item) => {
                                                                const brandQty = (item.brandEntries || []).reduce((entrySum, entry) => entrySum + (parseFloat(entry.quantity) || 0), 0);
                                                                return itemSum + (brandQty > 0 ? brandQty : (parseFloat(item.quantity) || 0));
                                                            }, 0);
                                                            return sum + saleQty;
                                                        }, 0);
                                                    const remGp = Math.max(0, parseFloat(record.gpQuantity || 0) - borderSaleForThisRow);
                                                    return (
                                                        <span className={`text-sm font-bold ${remGp <= 0 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                                            {remGp.toLocaleString('en-US')} <span className="text-[10px] text-gray-400 font-normal">Kg</span>
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                <p className="text-sm font-black text-gray-900">৳{parseFloat(record.gpValue || 0).toLocaleString('en-IN')}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-4">
                                                    {canManage && (
                                                        <>
                                                            <button 
                                                                onClick={() => handleEdit(record)}
                                                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                                                title="Edit Gate Pass"
                                                            >
                                                                <EditIcon className="w-5 h-5" />
                                                            </button>
                                                            {!cannotDelete && (
                                                                <button 
                                                                    onClick={() => handleDelete(record._id)}
                                                                    className="text-gray-400 hover:text-red-600 transition-colors"
                                                                    title="Delete Gate Pass"
                                                                >
                                                                    <TrashIcon className="w-5 h-5" />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View */}
                    <div className="md:hidden space-y-3">
                        {isLoading ? (
                            <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm text-gray-400">
                                Loading records...
                            </div>
                        ) : filteredRecords.length === 0 ? (
                            <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm text-gray-400 italic text-sm">
                                No records found.
                            </div>
                        ) : (
                            filteredRecords.map((record, idx) => {
                                const isExpanded = expandedGpIdx === idx;
                                return (
                                    <div key={record._id} className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-blue-200 shadow-md ring-1 ring-blue-50' : 'border-gray-100 shadow-sm hover:border-gray-200'}`}>
                                        {/* Card Toggle Header */}
                                        <div
                                            className="flex justify-between items-center p-4 cursor-pointer select-none active:bg-gray-50 transition-colors"
                                            onClick={() => setExpandedGpIdx(isExpanded ? null : idx)}
                                        >
                                            <div className="flex-1 min-w-0 pr-4">
                                                <div className="flex items-center gap-1.5 text-xs text-left min-w-0 overflow-hidden flex-wrap">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">
                                                        {formatDate(record.gpDate)}
                                                    </span>
                                                    <span className="text-gray-300 font-bold shrink-0">•</span>
                                                    <span className="font-bold text-gray-800 truncate max-w-[120px] shrink-0" title={record.lcNumber}>
                                                        {record.lcNumber}
                                                    </span>
                                                    <span className="text-gray-300 font-bold shrink-0">•</span>
                                                    <span className="text-gray-500 font-medium truncate max-w-[120px] shrink-0">
                                                        {record.partyName}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-xs font-bold text-blue-600">
                                                    {parseFloat(record.gpQuantity || 0).toLocaleString('en-US')} Kg
                                                </span>
                                                {isExpanded ? (
                                                    <ChevronUpIcon className="w-4 h-4 text-gray-400" />
                                                ) : (
                                                    <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Expandable Details */}
                                        {isExpanded && (
                                            <div className="px-4 pb-4 pt-1 space-y-2 bg-gray-50/30 border-t border-gray-100/50 text-xs text-left animate-in slide-in-from-top-4 duration-300">
                                                <div className="grid grid-cols-[125px_8px_1fr] gap-y-2 pt-3 text-xs items-baseline">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Importer</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-semibold text-gray-700 text-[11px] truncate max-w-[180px]">{record.partyName}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Party</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-semibold text-gray-700 text-[11px] truncate max-w-[180px]">{record.party || '-'}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Product</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-bold text-gray-900 text-[11px] truncate max-w-[180px]">{record.productName}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">LC Qty</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-semibold text-gray-700 text-[11px]">
                                                        {parseFloat(record.lcQuantity || 0).toLocaleString('en-US')} Kg
                                                    </span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">G.P Qty</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-bold text-blue-600 text-[11px]">
                                                        {parseFloat(record.gpQuantity || 0).toLocaleString('en-US')} Kg
                                                    </span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Border Sale</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-bold text-orange-600 text-[11px]">
                                                        {(() => {
                                                            const borderSaleForThisRow = salesRecordsRaw
                                                                .filter(s => {
                                                                    const sTypeLow = (s.saleType || '').toLowerCase().trim();
                                                                    const isBorder = sTypeLow === 'border' || sTypeLow === 'border sale' || (s.invoiceNo || '').startsWith('BS');
                                                                    const sCompany = (s.companyName || '').toLowerCase().trim();
                                                                    const sCustomer = (s.customerName || '').toLowerCase().trim();
                                                                    const rParty = (record.party || '').toLowerCase().trim();
                                                                    const isSameParty = sCompany === rParty || sCustomer === rParty;
                                                                    return isBorder && s.lcNo === record.lcNumber && isSameParty && s.status !== 'Rejected';
                                                                })
                                                                .reduce((sum, sale) => {
                                                                    const saleQty = (sale.items || []).reduce((itemSum, item) => {
                                                                        const brandQty = (item.brandEntries || []).reduce((entrySum, entry) => entrySum + (parseFloat(entry.quantity) || 0), 0);
                                                                        return itemSum + (brandQty > 0 ? brandQty : (parseFloat(item.quantity) || 0));
                                                                    }, 0);
                                                                    return sum + saleQty;
                                                                }, 0);
                                                            return borderSaleForThisRow.toLocaleString('en-IN');
                                                        })()} Kg
                                                    </span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rem. G.P</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    {(() => {
                                                        const borderSaleForThisRow = salesRecordsRaw
                                                            .filter(s => {
                                                                const sTypeLow = (s.saleType || '').toLowerCase().trim();
                                                                const isBorder = sTypeLow === 'border' || sTypeLow === 'border sale' || (s.invoiceNo || '').startsWith('BS');
                                                                const sCompany = (s.companyName || '').toLowerCase().trim();
                                                                const sCustomer = (s.customerName || '').toLowerCase().trim();
                                                                const rParty = (record.party || '').toLowerCase().trim();
                                                                const isSameParty = sCompany === rParty || sCustomer === rParty;
                                                                return isBorder && s.lcNo === record.lcNumber && isSameParty && s.status !== 'Rejected';
                                                            })
                                                            .reduce((sum, sale) => {
                                                                const saleQty = (sale.items || []).reduce((itemSum, item) => {
                                                                    const brandQty = (item.brandEntries || []).reduce((entrySum, entry) => entrySum + (parseFloat(entry.quantity) || 0), 0);
                                                                    return itemSum + (brandQty > 0 ? brandQty : (parseFloat(item.quantity) || 0));
                                                                }, 0);
                                                                return sum + saleQty;
                                                            }, 0);
                                                        const remGp = Math.max(0, parseFloat(record.gpQuantity || 0) - borderSaleForThisRow);
                                                        return (
                                                            <span className={`font-bold text-[11px] ${remGp <= 0 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                                                {remGp.toLocaleString('en-US')} Kg
                                                            </span>
                                                        );
                                                    })()}

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">G.P Value</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-black text-gray-900 text-[11px]">
                                                        ৳{parseFloat(record.gpValue || 0).toLocaleString('en-IN')}
                                                    </span>

                                                    {canManage && (
                                                        <div className="col-span-3 flex gap-2 pt-3 mt-1 border-t border-gray-100 w-full">
                                                            <button
                                                                onClick={() => handleEdit(record)}
                                                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs active:scale-95 transition-all"
                                                            >
                                                                <EditIcon className="w-3.5 h-3.5" /> Edit
                                                            </button>
                                                            {!cannotDelete && (
                                                                <button
                                                                    onClick={() => handleDelete(record._id)}
                                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-xs active:scale-95 transition-all"
                                                                >
                                                                    <TrashIcon className="w-3.5 h-3.5" /> Delete
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}

            {/* In-Line Registration Form */}
            {showForm && (
                <div className="lc-form-container relative overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl p-5 md:p-8 animate-in slide-in-from-top-4 duration-300">

                    <div className="flex items-center justify-between mb-6 md:mb-8 relative z-10">
                        <div>
                            <h3 className="text-lg md:text-xl font-semibold text-gray-800">
                                {editingId ? 'Edit Gate Pass Record' : 'New Gate Pass Registration'}
                            </h3>
                            <p className="text-[11px] text-blue-500 font-bold uppercase tracking-widest mt-1">
                                Document Details
                            </p>
                        </div>
                        <button
                            onClick={() => { setShowForm(false); setEditingId(null); }}
                            className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all group active:scale-95"
                            title="Close Form"
                        >
                            <XIcon className="w-5 h-5 text-gray-400 group-hover:text-rose-500" />
                        </button>
                    </div>

                        <form onSubmit={handleSubmit} className="p-8 relative z-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                <div className="space-y-1.5 text-left">
                                    <CustomDatePicker
                                        label="G.P Date"
                                        value={formData.gpDate}
                                        onChange={(val) => setFormData(prev => ({ ...prev, gpDate: val }))}
                                        required
                                        compact={true}
                                    />
                                </div>
                                <div className="space-y-1.5 text-left relative" ref={lcRef}>
                                    <label className="text-sm font-semibold text-gray-600 ml-1">LC Number</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={formData.lcNumber}
                                            onChange={(e) => {
                                                setFormData(prev => ({ ...prev, lcNumber: e.target.value }));
                                                setActiveDropdown('lcNumber');
                                                setHighlightedIndex(-1);
                                            }}
                                            onFocus={() => { setActiveDropdown('lcNumber'); setHighlightedIndex(-1); }}
                                            onKeyDown={(e) => {
                                                const filtered = lcRecordsRaw.filter(lc => 
                                                    !formData.lcNumber || lc.lcNo.toLowerCase().includes(formData.lcNumber.toLowerCase())
                                                );
                                                handleDropdownKeyDown(e, filtered);
                                            }}
                                            className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                            required
                                            placeholder="Search LC Number"
                                            autoComplete="off"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                            {formData.lcNumber && (
                                                <button type="button" onClick={() => handleLcSelect(null)} className="text-gray-400 hover:text-gray-600">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <SearchIcon className="w-4 h-4 text-gray-300" />
                                        </div>
                                    </div>

                                    {activeDropdown === 'lcNumber' && (
                                        <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1">
                                            {lcRecordsRaw
                                                .filter(lc => !formData.lcNumber || lc.lcNo.toLowerCase().includes(formData.lcNumber.toLowerCase()))
                                                .map((lc, idx) => (
                                                    <button
                                                        key={lc._id}
                                                        type="button"
                                                        onMouseDown={(e) => { e.preventDefault(); handleLcSelect(lc); }}
                                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${
                                                            highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'
                                                        }`}
                                                    >
                                                        <div>
                                                            <p className="font-bold">{lc.lcNo}</p>
                                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{lc.importerName}</p>
                                                        </div>
                                                        <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full text-gray-500 font-bold uppercase">{lc.productName}</span>
                                                    </button>
                                                ))}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1.5 text-left">
                                    <label className="text-sm font-semibold text-gray-600 ml-1">Importer</label>
                                    <input
                                        type="text"
                                        value={formData.partyName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, partyName: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                        required
                                        placeholder="Enter Importer Name"
                                    />
                                </div>
                                <div className="space-y-1.5 text-left">
                                    <label className="text-sm font-semibold text-gray-600 ml-1">Product</label>
                                    <input
                                        type="text"
                                        value={formData.productName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, productName: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                        required
                                        placeholder="Enter Product Name"
                                    />
                                </div>
                                <div className="space-y-1.5 text-left">
                                    <label className="text-sm font-semibold text-gray-600 ml-1">LC Quantity</label>
                                    <input
                                        type="number"
                                        value={formData.lcQuantity}
                                        onChange={(e) => setFormData(prev => ({ ...prev, lcQuantity: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                        required
                                        placeholder="Enter LC Quantity"
                                    />
                                </div>
                                <div className="space-y-1.5 text-left">
                                    <label className="text-sm font-semibold text-gray-600 ml-1">Rem G.P</label>
                                    {(() => {
                                        let remGpForModal = 0;
                                        if (formData.lcNumber) {
                                            const lc = lcRecordsRaw.find(l => l.lcNo === formData.lcNumber);
                                            const lcTotalKg = lc ? (parseFloat(lc.quantity) * 1000) : (parseFloat(formData.lcQuantity) || 0);
                                            
                                            const totalGp = records
                                                .filter(r => r.lcNumber === formData.lcNumber && r.status !== 'Rejected' && r._id !== editingId)
                                                .reduce((sum, r) => sum + (parseFloat(r.gpQuantity) || 0), 0);
                                                
                                            remGpForModal = Math.max(0, lcTotalKg - totalGp);
                                        }
                                        return (
                                            <input
                                                type="text"
                                                value={formData.lcNumber ? remGpForModal.toLocaleString('en-US') : '0'}
                                                readOnly
                                                className={`w-full px-4 py-2.5 bg-gray-50 border border-gray-200/60 rounded-xl outline-none font-bold cursor-not-allowed ${remGpForModal <= 0 && formData.lcNumber ? 'text-emerald-600' : 'text-blue-600'}`}
                                                placeholder="0"
                                            />
                                        );
                                    })()}
                                </div>
                                <div className="space-y-1.5 text-left">
                                    <label className="text-sm font-semibold text-gray-600 ml-1">LC Rate</label>
                                    <input
                                        type="number"
                                        value={formData.lcRate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, lcRate: e.target.value, gpRate: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                        required
                                        placeholder="Enter Rate"
                                    />
                                </div>
                                <div className="space-y-1.5 text-left">
                                    <label className="text-sm font-semibold text-gray-600 ml-1">Total LC Value (৳)</label>
                                    <input
                                        type="text"
                                        value={formData.totalLcValue}
                                        readOnly
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/60 rounded-xl outline-none font-bold text-blue-600 cursor-not-allowed"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="space-y-1.5 text-left relative" ref={partyRef}>
                                    <label className="text-sm font-semibold text-gray-600 ml-1">Party</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={formData.party}
                                            onChange={(e) => {
                                                setFormData(prev => ({ ...prev, party: e.target.value }));
                                                setActiveDropdown('party');
                                                setHighlightedIndex(-1);
                                            }}
                                            onFocus={() => { setActiveDropdown('party'); setHighlightedIndex(-1); }}
                                            onKeyDown={(e) => {
                                                const filtered = customerRecordsRaw.filter(c => 
                                                    (c.customerType === 'Party Customer') &&
                                                    (!formData.party || c.companyName.toLowerCase().includes(formData.party.toLowerCase()))
                                                );
                                                handleDropdownKeyDown(e, filtered.map(c => ({ _id: c._id, name: c.companyName })));
                                            }}
                                            className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                            required
                                            placeholder="Search Party"
                                            autoComplete="off"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                            {formData.party && (
                                                <button type="button" onClick={() => setFormData(prev => ({ ...prev, party: '' }))} className="text-gray-400 hover:text-gray-600">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <SearchIcon className="w-4 h-4 text-gray-300" />
                                        </div>
                                    </div>

                                    {activeDropdown === 'party' && (
                                        <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1">
                                            {customerRecordsRaw
                                                .filter(c => 
                                                    (c.customerType === 'Party Customer') &&
                                                    (!formData.party || c.companyName.toLowerCase().includes(formData.party.toLowerCase()))
                                                )
                                                .map((c, idx) => (
                                                    <button
                                                        key={c._id}
                                                        type="button"
                                                        onMouseDown={(e) => { 
                                                            e.preventDefault(); 
                                                            setFormData(prev => ({ ...prev, party: c.companyName }));
                                                            setActiveDropdown(null);
                                                        }}
                                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${
                                                            highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'
                                                        }`}
                                                    >
                                                        <div>
                                                            <p className="font-bold">{c.companyName}</p>
                                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{c.location}</p>
                                                        </div>
                                                        <span className="text-[10px] bg-indigo-50 px-2 py-0.5 rounded-full text-indigo-500 font-bold uppercase">{c.customerId}</span>
                                                    </button>
                                                ))}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1.5 text-left">
                                    <label className="text-sm font-semibold text-gray-600 ml-1">G.P Quantity</label>
                                    <input
                                        type="number"
                                        value={formData.gpQuantity}
                                        onChange={(e) => setFormData(prev => ({ ...prev, gpQuantity: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                        required
                                        placeholder="Enter G.P Quantity"
                                    />
                                </div>
                                <div className="space-y-1.5 text-left">
                                    <label className="text-sm font-semibold text-gray-600 ml-1">G.P Rate</label>
                                    <input
                                        type="number"
                                        value={formData.gpRate}
                                        readOnly
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/60 rounded-xl outline-none font-medium cursor-not-allowed"
                                        placeholder="Same as LC Rate"
                                    />
                                </div>
                                <div className="space-y-1.5 text-left">
                                    <label className="text-sm font-semibold text-gray-600 ml-1">G.P Value (৳)</label>
                                    <input
                                        type="text"
                                        value={formData.gpValue}
                                        readOnly
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/60 rounded-xl outline-none font-bold text-emerald-600 cursor-not-allowed"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="mb-0 relative z-10 space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Remarks</label>
                                <textarea
                                    value={formData.remarks}
                                    onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium min-h-[100px]"
                                    placeholder="Add any additional notes here..."
                                />
                            </div>

                            <div className="flex justify-end relative z-10">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full md:w-auto px-10 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wider"
                                >
                                    {isSubmitting ? 'Saving...' : editingId ? 'Update Record' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
            )}
        </div>
    );
};

export default LCGatePass;
