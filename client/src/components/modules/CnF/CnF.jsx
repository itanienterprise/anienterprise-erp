import React, { useState, useEffect, useRef } from 'react';
import { EditIcon, TrashIcon, UserIcon, EyeIcon, XIcon, BoxIcon, SearchIcon, ChevronDownIcon, ChevronUpIcon, TrendingUpIcon, DollarSignIcon, FunnelIcon, PrinterIcon } from '../../Icons';
import CustomDatePicker from "../../shared/CustomDatePicker";
import { generateCnFHistoryReportPDF } from '../../../utils/pdfGenerator';
import { API_BASE_URL, SortIcon, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import './CnF.css';

const CnF = ({
    moduleType,
    currentUser,
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
    const [toast, setToast] = useState(null);
    const toastTimerRef = useRef(null);
    const getEffectiveUser = () => {
        if (currentUser && currentUser.username) return currentUser;
        try {
            const stored = localStorage.getItem('erp_user');
            if (stored) return JSON.parse(stored);
        } catch (e) {
            console.error('Error parsing stored user:', e);
        }
        return null;
    };
    const effectiveUser = getEffectiveUser();
    const isAdmin = effectiveUser?.username === 'admin' || String(effectiveUser?.role || '').toLowerCase() === 'admin';
    const showToast = (type, message, duration = 3000) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ type, message });
        toastTimerRef.current = setTimeout(() => setToast(null), duration);
    };
    const [cnfs, setCnfs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [viewData, setViewData] = useState(null);
    const [historySearchQuery, setHistorySearchQuery] = useState('');
    const [historyRecords, setHistoryRecords] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [expandedHistoryIdx, setExpandedHistoryIdx] = useState(null);
    const [expandedCnFId, setExpandedCnFId] = useState(null);
    const [editRecord, setEditRecord] = useState(null);
    const [isSavingHistory, setIsSavingHistory] = useState(false);
    const [editHistoryData, setEditHistoryData] = useState({
        uom: 'QTY',
        commission: '',
        totalCommission: 0
    });
    const [formData, setFormData] = useState({
        cnfId: '',
        name: '',
        cnf_location_full: '',
        contactPerson: '',
        email: '',
        phone: '+880',
        uom: 'QTY',
        commission: '',
        status: 'Active'
    });

    const [isHistorySelectionMode, setIsHistorySelectionMode] = useState(false);
    const [selectedHistoryIds, setSelectedHistoryIds] = useState(new Set());
    const [showHistoryFilterPanel, setShowHistoryFilterPanel] = useState(false);
    const [historyFilters, setHistoryFilters] = useState({
        startDate: '',
        endDate: '',
        lcNo: '',
        productName: ''
    });
    const historyFilterButtonRef = useRef(null);
    const historyFilterPanelRef = useRef(null);
    const [historyFilterSearchInputs, setHistoryFilterSearchInputs] = useState({ lcNo: '', product: '' });
    const [historyFilterDropdownOpen, setHistoryFilterDropdownOpen] = useState({ lcNo: false, product: false });
    const lcNoFilterRef = useRef(null);
    const productFilterSearchRef = useRef(null);

    const getUniqueHistoryOptions = (key) => {
        return [...new Set(historyRecords.map(item => (item[key] || '').trim()).filter(Boolean))].sort();
    };

    const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
    const [bulkEditData, setBulkEditData] = useState({ uom: 'QTY', commission: '' });

    const historyLongPressTimer = React.useRef(null);
    const isHistoryLongPressTriggered = React.useRef(false);

    useEffect(() => { fetchCnFs(); }, [moduleType]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showHistoryFilterPanel && historyFilterPanelRef.current && !historyFilterPanelRef.current.contains(event.target) && !historyFilterButtonRef.current?.contains(event.target)) {
                setShowHistoryFilterPanel(false);
            }
            if (historyFilterDropdownOpen.lcNo && lcNoFilterRef.current && !lcNoFilterRef.current.contains(event.target)) {
                setHistoryFilterDropdownOpen(prev => ({ ...prev, lcNo: false }));
            }
            if (historyFilterDropdownOpen.product && productFilterSearchRef.current && !productFilterSearchRef.current.contains(event.target)) {
                setHistoryFilterDropdownOpen(prev => ({ ...prev, product: false }));
            }
        };
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                setShowHistoryFilterPanel(false);
                setHistoryFilterDropdownOpen({ lcNo: false, product: false });
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showHistoryFilterPanel]);

    useEffect(() => {
        if (viewData) {
            document.body.style.overflow = 'hidden';
            fetchCnFHistory(viewData.name);
            setHistorySearchQuery('');
            setHistoryFilters({ startDate: '', endDate: '', lcNo: '', productName: '' });
            setExpandedHistoryIdx(null);
            setIsHistorySelectionMode(false);
            setSelectedHistoryIds(new Set());
        } else {
            document.body.style.overflow = 'auto';
            setHistoryRecords([]);
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [viewData]);

    const handlePrintHistory = () => {
        if (!viewData || filteredHistory.length === 0) return;
        generateCnFHistoryReportPDF(filteredHistory, { name: viewData.name, cnfId: viewData.cnfId }, historyFilters);
    };

    const fetchCnFs = async () => {
        setIsLoading(true);
        try {
            const [cnfsRes, stockRes, salesRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/cnfs`),
                axios.get(`${API_BASE_URL}/api/stock`),
                axios.get(`${API_BASE_URL}/api/sales`)
            ]);

            const allCnfs = Array.isArray(cnfsRes.data) ? cnfsRes.data : [];
            const allStock = Array.isArray(stockRes.data) ? stockRes.data : [];
            const allSales = Array.isArray(salesRes.data) ? salesRes.data : [];

            const cnfsWithBalance = allCnfs.map(cnf => {
                const targetName = (cnf.name || '').toLowerCase().trim();
                
                // 1. Earned from Stock (LC Arrivals)
                const stockEarned = allStock.reduce((acc, record) => {
                    const recordIndCnF = (record.indianCnF || '').toLowerCase().trim();
                    const recordBdCnF = (record.bdCnF || '').toLowerCase().trim();

                    const isMatch = cnf.type === 'Indian'
                        ? recordIndCnF === targetName
                        : cnf.type === 'BD'
                            ? recordBdCnF === targetName
                            : (recordIndCnF === targetName || recordBdCnF === targetName);

                    if (isMatch) {
                        let commission = parseFloat(cnf.commission) || 0;
                        if (recordIndCnF === targetName && record.indCnFComm !== undefined && record.indCnFComm !== null && record.indCnFComm !== '') {
                            commission = parseFloat(record.indCnFComm);
                        } else if (recordBdCnF === targetName && record.bdCnFComm !== undefined && record.bdCnFComm !== null && record.bdCnFComm !== '') {
                            commission = parseFloat(record.bdCnFComm);
                        }

                        const rawUom = recordIndCnF === targetName
                            ? (record.indCnFUom || record.uom || cnf.uom || cnf.commissionType || 'QTY')
                            : (record.bdCnFUom || record.uom || cnf.uom || cnf.commissionType || 'QTY');
                        const uom = typeof rawUom === 'string' ? rawUom.toUpperCase() : 'QTY';

                        const isAccepted = !record.status || record.status === 'In Stock';
                        if (!isAccepted) return acc;

                        if (uom === 'QTY') {
                            const qty = !isNaN(parseFloat(record.quantity)) ? parseFloat(record.quantity) : (parseFloat(record.inHouseQuantity) || 0);
                            return acc + (qty * commission);
                        } else if (uom === 'BAG') {
                            const bag = !isNaN(parseFloat(record.packet)) ? parseFloat(record.packet) : (parseFloat(record.inHousePacket) || 0);
                            return acc + (bag * commission);
                        } else if (uom === 'TRUCK') {
                            const truckCount = parseFloat(record.truckNo) || 1;
                            return acc + (truckCount * commission);
                        } else {
                            return acc + commission;
                        }
                    }
                    return acc;
                }, 0);

                // 2. Earned from Border Sales
                const salesEarned = allSales.reduce((acc, sale) => {
                    const sTypeLow = (sale.saleType || '').toLowerCase().trim();
                    const isBorder = sTypeLow === 'border' || sTypeLow === 'border sale' || (sale.invoiceNo || '').startsWith('BS');
                    if (!isBorder) return acc;

                    // Skip rejected sales
                    if (sale.status && sale.status.toLowerCase().includes('rejected')) return acc;

                    const saleIndCnF = (sale.indianCnF || '').toLowerCase().trim();
                    const saleBdCnf = (sale.bdCnf || '').toLowerCase().trim();

                    const isMatch = cnf.type === 'Indian'
                        ? saleIndCnF === targetName
                        : cnf.type === 'BD'
                            ? saleBdCnf === targetName
                            : (saleIndCnF === targetName || saleBdCnf === targetName);

                    if (isMatch) {
                        let totalSaleComm = 0;
                        const commissionFactor = parseFloat(cnf.commission) || 0;
                        const uom = (typeof cnf.uom === 'string' ? cnf.uom : (cnf.commissionType || 'QTY')).toUpperCase();

                        (sale.items || []).forEach(item => {
                            (item.brandEntries || []).forEach(entry => {
                                if (uom === 'QTY') {
                                    totalSaleComm += (parseFloat(entry.quantity) || 0) * commissionFactor;
                                } else if (uom === 'TRUCK') {
                                    totalSaleComm += (parseFloat(entry.truck) || 1) * commissionFactor;
                                } else {
                                    totalSaleComm += commissionFactor;
                                }
                            });
                        });
                        return acc + totalSaleComm;
                    }
                    return acc;
                }, 0);

                return { ...cnf, totalBalance: stockEarned + salesEarned };
            });

            const filtered = moduleType
                ? cnfsWithBalance.filter(c => c.type === moduleType)
                : cnfsWithBalance;
            setCnfs(filtered);
        } catch (error) {
            console.error('Error fetching C&Fs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCnFHistory = async (cnfName) => {
        setHistoryLoading(true);
        try {
            const [stockRes, salesRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/stock`),
                axios.get(`${API_BASE_URL}/api/sales`)
            ]);
            
            const stockData = Array.isArray(stockRes.data) ? stockRes.data : [];
            const salesData = Array.isArray(salesRes.data) ? salesRes.data : [];
            const rows = [];
            const targetCnF = (cnfName || '').toLowerCase().trim();

            // 1. Process Stock (LC) Records
            stockData.forEach(record => {
                const indCnF = (record.indianCnF || '').toLowerCase().trim();
                const bdCnF = (record.bdCnF || '').toLowerCase().trim();

                const isBaseMatch = moduleType === 'Indian'
                    ? indCnF === targetCnF
                    : moduleType === 'BD'
                        ? bdCnF === targetCnF
                        : (indCnF === targetCnF || bdCnF === targetCnF);
                        
                const isAccepted = !record.status || record.status === 'In Stock';
                const isMatch = isBaseMatch && isAccepted;

                if (isMatch) {
                    const qty = !isNaN(parseFloat(record.quantity)) ? parseFloat(record.quantity) : (parseFloat(record.inHouseQuantity) || 0);
                    
                    let commissionRate = parseFloat(viewData?.commission) || 0;
                    if (indCnF === targetCnF && record.indCnFComm !== undefined && record.indCnFComm !== null && record.indCnFComm !== '') {
                        commissionRate = parseFloat(record.indCnFComm);
                    } else if (bdCnF === targetCnF && record.bdCnFComm !== undefined && record.bdCnFComm !== null && record.bdCnFComm !== '') {
                        commissionRate = parseFloat(record.bdCnFComm);
                    }
                    
                    const rawUom = indCnF === targetCnF
                        ? (record.indCnFUom || record.uom || viewData?.uom || viewData?.commissionType || 'QTY')
                        : (record.bdCnFUom || record.uom || viewData?.uom || viewData?.commissionType || 'QTY');
                    const uom = typeof rawUom === 'string' ? rawUom.toUpperCase() : 'QTY';
                    
                    let totalCommission = 0;
                    if (uom === 'QTY') {
                        totalCommission = qty * commissionRate;
                    } else if (uom === 'BAG') {
                        const bagQty = !isNaN(parseFloat(record.packet)) ? parseFloat(record.packet) : (record.inHousePacket || 0);
                        totalCommission = bagQty * commissionRate;
                    } else if (uom === 'TRUCK') {
                        const truckCount = parseFloat(record.truckNo) || 1;
                        totalCommission = truckCount * commissionRate;
                    } else {
                        totalCommission = commissionRate;
                    }
                    totalCommission = parseFloat(totalCommission.toFixed(2));

                    rows.push({
                        _id: record._id,
                        date: record.date,
                        lcNo: record.lcNo,
                        port: record.port,
                        product: record.productName,
                        brand: record.brand,
                        rate: record.purchasedPrice,
                        bag: !isNaN(parseFloat(record.packet)) ? parseFloat(record.packet) : (record.inHousePacket || 0),
                        qty: qty,
                        truck: record.truckNo || record.truck || record.itemTruck || '-',
                        commission: commissionRate,
                        uom: uom,
                        totalCommission: totalCommission,
                        cnfType: indCnF === targetCnF ? 'Indian' : 'BD',
                        source: 'LC',
                        indCnFEdited: record.indCnFEdited,
                        bdCnFEdited: record.bdCnFEdited,
                        indCnFBulkEdited: record.indCnFBulkEdited,
                        bdCnFBulkEdited: record.bdCnFBulkEdited
                    });
                }
            });

            // 2. Process Border Sale Records
            salesData.forEach(sale => {
                const sTypeLow = (sale.saleType || '').toLowerCase().trim();
                const isBorder = sTypeLow === 'border' || sTypeLow === 'border sale' || (sale.invoiceNo || '').startsWith('BS');
                if (!isBorder) return;

                // Skip rejected sales
                if (sale.status && sale.status.toLowerCase().includes('rejected')) return;

                const saleIndCnF = (sale.indianCnF || '').toLowerCase().trim();
                const saleBdCnf = (sale.bdCnf || '').toLowerCase().trim();

                const isMatch = cnfName.toLowerCase().trim() === saleIndCnF || cnfName.toLowerCase().trim() === saleBdCnf;
                if (!isMatch) return;

                const commissionFactor = parseFloat(viewData?.commission) || 0;
                const uom = (typeof viewData?.uom === 'string' ? viewData.uom : (viewData?.commissionType || 'QTY')).toUpperCase();

                (sale.items || []).forEach(item => {
                    (item.brandEntries || []).forEach(entry => {
                        let totalEntryComm = 0;
                        const qty = parseFloat(entry.quantity) || 0;
                        const truck = parseFloat(entry.truck) || 1;

                        if (uom === 'QTY') {
                            totalEntryComm = qty * commissionFactor;
                        } else if (uom === 'TRUCK') {
                            totalEntryComm = truck * commissionFactor;
                        } else {
                            totalEntryComm = commissionFactor;
                        }

                        rows.push({
                            _id: `${sale._id}-${entry.brand}-${entry.warehouseName}`,
                            date: sale.date,
                            lcNo: sale.lcNo || '-',
                            port: sale.port || '-',
                            product: item.productName || '-',
                            brand: entry.brand || '-',
                            rate: entry.unitPrice || 0,
                            bag: '-',
                            qty: qty,
                            truck: truck,
                            commission: commissionFactor,
                            uom: uom,
                            totalCommission: parseFloat(totalEntryComm.toFixed(2)),
                            cnfType: (sale.indianCnF || '').toLowerCase().trim() === targetCnF ? 'Indian' : 'BD',
                            source: 'Sale'
                        });
                    });
                });
            });

            rows.sort((a, b) => new Date(b.date) - new Date(a.date));
            setHistoryRecords(rows);
        } catch (error) {
            console.error('Error fetching C&F history:', error);
            setHistoryRecords([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleEditHistory = (record) => {
        setEditRecord(record);
        
        // record.uom is already resolved per C&F type by fetchCnFHistory (reads indCnFUom or bdCnFUom)
        const resolvedUom = record.uom || viewData?.uom || viewData?.commissionType || 'QTY';
        
        setEditHistoryData({
            uom: (typeof resolvedUom === 'string' ? resolvedUom : 'QTY').toUpperCase(),
            commission: record.commission || 0,
            totalCommission: record.totalCommission || 0
        });
    };

    const handleEditHistoryChange = (e) => {
        const { name, value } = e.target;
        
        setEditHistoryData(prev => {
            const newData = { ...prev, [name]: value };
            const currentUom = name === 'uom' ? value : prev.uom;
            const rate = name === 'commission' ? parseFloat(value) || 0 : parseFloat(prev.commission) || 0;
            const qty = parseFloat(editRecord?.qty) || 0;
            
            if (currentUom === 'QTY') {
                newData.totalCommission = qty * rate;
            } else {
                newData.totalCommission = rate;
            }
            return newData;
        });
    };

    const handleSaveHistory = async () => {
        if (!editRecord || !editRecord._id) return;
        setIsSavingHistory(true);
        try {
            const res = await axios.get('/api/stock');
            const originalRecord = res.data.find(r => r._id === editRecord._id);
            if (!originalRecord) throw new Error('Original record not found');

            const updatedData = { ...originalRecord };
            const targetCnF = (viewData?.name || '').toLowerCase().trim();
            const recordIndCnF = (originalRecord.indianCnF || '').toLowerCase().trim();
            const recordBdCnF = (originalRecord.bdCnF || '').toLowerCase().trim();

            if (editRecord.cnfType === 'Indian' || recordIndCnF === targetCnF) {
                updatedData.indCnFComm = editHistoryData.commission;
                updatedData.indCnFCost = editHistoryData.totalCommission;
                updatedData.indCnFUom = editHistoryData.uom;
                updatedData.indCnFEdited = true;
                updatedData.indCnFBulkEdited = true; // Set both to be safe
            } else if (editRecord.cnfType === 'BD' || recordBdCnF === targetCnF) {
                updatedData.bdCnFComm = editHistoryData.commission;
                updatedData.bdCnFCost = editHistoryData.totalCommission;
                updatedData.bdCnFUom = editHistoryData.uom;
                updatedData.bdCnFEdited = true;
                updatedData.bdCnFBulkEdited = true; // Set both to be safe
            }

            await axios.put(`/api/stock/${editRecord._id}`, updatedData);
            setEditRecord(null);
            fetchCnFHistory(viewData.name);
            fetchCnFs();
        } catch (error) {
            console.error('Error saving history update:', error);
            showToast('error', 'Failed to save changes. Please try again.');
        } finally {
            setIsSavingHistory(false);
        }
    };

    const startHistoryLongPress = (id) => {
        historyLongPressTimer.current = setTimeout(() => {
            isHistoryLongPressTriggered.current = true;
            setIsHistorySelectionMode(true);
            setSelectedHistoryIds(new Set([id]));
        }, 500);
    };

    const endHistoryLongPress = () => {
        if (historyLongPressTimer.current) {
            clearTimeout(historyLongPressTimer.current);
            historyLongPressTimer.current = null;
        }
    };

    const toggleHistorySelection = (id) => {
        const row = filteredHistory.find(r => r._id === id);
        if (!row) return;
        
        const isEditable = isAdmin || (!row.indCnFEdited && !row.bdCnFEdited && !row.indCnFBulkEdited && !row.bdCnFBulkEdited);
        if (!isEditable) return;

        setSelectedHistoryIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
                if (next.size === 0) setIsHistorySelectionMode(false);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleSelectAllHistory = () => {
        const editableIds = filteredHistory
            .filter(row => isAdmin || (!row.indCnFEdited && !row.bdCnFEdited && !row.indCnFBulkEdited && !row.bdCnFBulkEdited))
            .map(row => row._id);

        if (selectedHistoryIds.size === editableIds.length && editableIds.length > 0) {
            setSelectedHistoryIds(new Set());
            setIsHistorySelectionMode(false);
        } else {
            setSelectedHistoryIds(new Set(editableIds));
        }
    };

    const handleBulkUpdateHistory = async () => {
        if (selectedHistoryIds.size === 0) return;
        setIsSubmitting(true);
        try {
            const res = await axios.get('/api/stock');
            const targetCnF = (viewData?.name || '').toUpperCase();
            const selectedStocks = res.data.filter(r => selectedHistoryIds.has(r._id));
            
            for (const originalRecord of selectedStocks) {
                const updatedData = { ...originalRecord };
                const indCnF = (originalRecord.indianCnF || '').toLowerCase().trim();
                const bdCnF = (originalRecord.bdCnF || '').toLowerCase().trim();
                const targetCnF = (viewData?.name || '').toLowerCase().trim();
                const commissionRate = parseFloat(bulkEditData.commission) || 0;
                const qty = parseFloat(originalRecord.qty) || 0;
                
                let totalCommission = 0;
                if (bulkEditData.uom === 'QTY') {
                    totalCommission = qty * commissionRate;
                } else {
                    totalCommission = commissionRate;
                }

                if (indCnF === targetCnF) {
                    updatedData.indCnFComm = commissionRate;
                    updatedData.indCnFCost = totalCommission;
                    updatedData.indCnFUom = bulkEditData.uom;
                    updatedData.indCnFBulkEdited = true;
                } else if (bdCnF === targetCnF) {
                    updatedData.bdCnFComm = commissionRate;
                    updatedData.bdCnFCost = totalCommission;
                    updatedData.bdCnFUom = bulkEditData.uom;
                    updatedData.bdCnFBulkEdited = true;
                }
                await axios.put(`/api/stock/${originalRecord._id}`, updatedData);
            }

            setIsBulkEditModalOpen(false);
            setIsHistorySelectionMode(false);
            setSelectedHistoryIds(new Set());
            fetchCnFHistory(viewData.name);
            fetchCnFs();
            showToast('success', `Bulk updated successfully!`);
        } catch (error) {
            console.error('Error in bulk update:', error);
            showToast('error', 'Failed to update some records. Please try again.');
        } finally {
            setIsSubmitting(false);
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

    const generateNextId = (type, existing) => {
        const prefix = type === 'Indian' ? 'IND' : 'BD';
        const padding = type === 'Indian' ? 3 : 4;
        const typedAgents = existing.filter(a => (a.cnfId || '').startsWith(prefix));
        if (typedAgents.length === 0) return prefix + (1).toString().padStart(padding, '0');
        const numbers = typedAgents.map(a => parseInt((a.cnfId || '').replace(prefix, '')) || 0);
        return prefix + (Math.max(...numbers) + 1).toString().padStart(padding, '0');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.phone.length !== 14) {
            showToast('error', 'Phone number must be exactly 14 characters long.');
            return;
        }
        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const { cnf_location_full, ...rest } = formData;
            const submitData = { ...rest, address: cnf_location_full, type: moduleType };
            const url = editingId ? `${API_BASE_URL}/api/cnfs/${editingId}` : `${API_BASE_URL}/api/cnfs`;
            if (editingId) await axios.put(url, submitData);
            else await axios.post(url, submitData);
            setSubmitStatus('success');
            fetchCnFs();
            setTimeout(() => { setShowForm(false); setEditingId(null); resetForm(); setSubmitStatus(null); }, 2000);
        } catch (error) {
            console.error('Error saving C&F:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            cnfId: generateNextId(moduleType, cnfs),
            name: '',
            cnf_location_full: '',
            contactPerson: '',
            email: '',
            phone: '+880',
            uom: 'QTY',
            commission: '',
            status: 'Active'
        });
        setEditingId(null);
        setSubmitStatus(null);
    };

    const handleEdit = (cnf) => {
        setFormData({
            cnfId: cnf.cnfId || '',
            name: cnf.name || '',
            cnf_location_full: cnf.address || '',
            contactPerson: cnf.contactPerson || '',
            email: cnf.email || '',
            phone: cnf.phone || '+880',
            uom: cnf.uom || cnf.commissionType || 'QTY',
            commission: cnf.commission || '',
            status: cnf.status || 'Active'
        });
        setEditingId(cnf._id);
        setShowForm(true);
    };

    const handleDelete = (id) => onDeleteConfirm({ show: true, type: 'cnf', id, isBulk: false });

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id);
        setSelectedItems(newSelected);
        if (newSelected.size === 0) setIsSelectionMode(false);
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === cnfs.length) { setSelectedItems(new Set()); setIsSelectionMode(false); }
        else setSelectedItems(new Set(cnfs.map(i => i._id)));
    };

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.cnf?.key === key && sortConfig.cnf?.direction === 'asc') direction = 'desc';
        setSortConfig({ ...sortConfig, cnf: { key, direction } });
    };

    const sortData = (data) => {
        if (!sortConfig.cnf) return data;
        const { key, direction } = sortConfig.cnf;
        return [...data].sort((a, b) => {
            const aVal = (a[key] || '').toString().toLowerCase();
            const bVal = (b[key] || '').toString().toLowerCase();
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const filteredHistory = historyRecords.filter(row => {
        const q = historySearchQuery.toLowerCase();
        
        // Date Filtering
        if (historyFilters.startDate || historyFilters.endDate) {
            const rowDate = new Date(row.date);
            if (historyFilters.startDate && rowDate < new Date(historyFilters.startDate)) return false;
            if (historyFilters.endDate && rowDate > new Date(historyFilters.endDate)) return false;
        }

        // Field Specific Filtering
        if (historyFilters.lcNo && !(row.lcNo || '').toLowerCase().includes(historyFilters.lcNo.toLowerCase())) return false;
        if (historyFilters.productName && !(row.product || '').toLowerCase().includes(historyFilters.productName.toLowerCase())) return false;

        // Search Query Filtering
        if (!q) return true;
        return (row.date || '').toLowerCase().includes(q) || (row.lcNo || '').toLowerCase().includes(q) || (row.port || '').toLowerCase().includes(q) || (row.product || '').toLowerCase().includes(q) || (row.brand || '').toLowerCase().includes(q) || String(row.truck || '').toLowerCase().includes(q);
    });

    return (
        <div className="cnf-container">
            {/* Toast Notification */}
            {toast && (
                <div style={{
                    position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px 18px', borderRadius: '12px', minWidth: '260px', maxWidth: '380px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                    background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                    animation: 'fadeIn 0.3s ease',
                }}>
                    <span style={{ fontSize: '18px' }}>{toast.type === 'success' ? '✅' : '❌'}</span>
                    <p style={{
                        margin: 0, fontSize: '13px', fontWeight: 600,
                        color: toast.type === 'success' ? '#166534' : '#991b1b'
                    }}>{toast.message}</p>
                    <button onClick={() => setToast(null)} style={{
                        marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                        color: toast.type === 'success' ? '#166534' : '#991b1b', fontSize: '16px', lineHeight: 1
                    }}>×</button>
                </div>
            )}
            <div className="cnf-header">
                <h2 className="cnf-title">{moduleType || 'C&F'} C&F Agent Management</h2>
                <button onClick={() => setShowForm(!showForm)} className="cnf-add-btn">+ Add New</button>
            </div>

            {showForm && (
                <div className="cnf-form-container">
                    <div className="cnf-form-header">
                        <h3 className="cnf-form-title">{editingId ? `Edit ${moduleType}` : `New ${moduleType} Registration`}</h3>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="cnf-form-close"><XIcon className="w-6 h-6" /></button>
                    </div>
                    <form onSubmit={handleSubmit} className="cnf-form" autoComplete="off">
                        <div className="cnf-form-field"><label className="cnf-form-label">ID</label><input type="text" name="cnfId" value={formData.cnfId} readOnly className="cnf-form-input bg-gray-50/50 cursor-not-allowed font-bold" /></div>
                        <div className="cnf-form-field"><label className="cnf-form-label">{moduleType} Name</label><input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder="Full Name" className="cnf-form-input" /></div>
                        <div className="cnf-form-field"><label className="cnf-form-label">Address</label><textarea name="cnf_location_full" value={formData.cnf_location_full} onChange={handleInputChange} required placeholder="Full Address" rows="1" className="cnf-form-textarea" /></div>
                        <div className="cnf-form-field"><label className="cnf-form-label">Contact Person</label><input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleInputChange} required placeholder="Contact Name" className="cnf-form-input" /></div>
                        <div className="cnf-form-field"><label className="cnf-form-label">Email</label><input type="email" name="email" value={formData.email} onChange={handleInputChange} required placeholder="email@example.com" className="cnf-form-input" /></div>
                        <div className="cnf-form-field"><label className="cnf-form-label">Phone</label><input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} required className="cnf-form-input" /></div>
                        <div className="cnf-form-field">
                            <label className="cnf-form-label">UOM</label>
                            <select name="uom" value={formData.uom} onChange={handleInputChange} className="cnf-form-select">
                                <option value="QTY">QTY</option>
                                <option value="Truck">Truck</option>
                            </select>
                        </div>
                        <div className="cnf-form-field"><label className="cnf-form-label">Commission</label><input type="number" step="0.01" name="commission" value={formData.commission} onChange={handleInputChange} placeholder="0.00" className="cnf-form-input" /></div>
                        <div className="cnf-form-field">
                            <label className="cnf-form-label">Status</label>
                            <select name="status" value={formData.status} onChange={handleInputChange} className="cnf-form-select">
                                <option>Active</option>
                                <option>Inactive</option>
                            </select>
                        </div>
                        <div className="cnf-form-footer">
                            {submitStatus === 'success' && <p className="cnf-form-success">C&F saved successfully!</p>}
                            {submitStatus === 'error' && <p className="cnf-form-error">Failed to save C&F.</p>}
                            <button type="submit" disabled={isSubmitting} className="cnf-form-submit">{isSubmitting ? 'Saving...' : 'Save Record'}</button>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="cnf-table-container">
                    {selectedItems.size > 0 && (
                        <div className="cnf-selection-bar flex items-center justify-between px-6 py-4 bg-gray-900 rounded-2xl mb-4 shadow-xl shadow-gray-900/20 animate-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center gap-3 font-black text-white">
                                <div className="px-2 py-1 bg-white/20 rounded-md text-[10px]">{selectedItems.size}</div>
                                <span className="text-sm">Items Selected</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setSelectedItems(new Set()); setIsSelectionMode(false); }} className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors">Cancel</button>
                                <button onClick={() => onDeleteConfirm({ show: true, type: 'cnf', id: null, isBulk: true })} className="px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-black hover:bg-red-600 transition-all flex items-center gap-2">
                                    <TrashIcon className="w-3.5 h-3.5" /> Delete Bulk
                                </button>
                            </div>
                        </div>
                    )}
                    {isLoading ? (
                        <div className="cnf-loading"><div className="cnf-spinner"></div></div>
                    ) : cnfs.length > 0 ? (
                        <>
                            <div className="hidden md:block overflow-x-auto">
                                <table className="cnf-table">
                                    <thead>
                                        <tr className="cnf-table-header-row">
                                            {isSelectionMode && <th className="cnf-table-checkbox-header"><input type="checkbox" checked={selectedItems.size === cnfs.length} onChange={toggleSelectAll} /></th>}
                                            <th className="cnf-table-header" onClick={() => requestSort('cnfId')}>ID <SortIcon config={sortConfig.cnf} columnKey="cnfId" /></th>
                                            <th className="cnf-table-header" onClick={() => requestSort('name')}>Name <SortIcon config={sortConfig.cnf} columnKey="name" /></th>
                                            <th className="cnf-table-header">Contact</th>
                                            <th className="cnf-table-header">Phone</th>
                                            <th className="cnf-table-header">UOM</th>
                                            <th className="cnf-table-header">Commission</th>
                                            <th className="cnf-table-header">Balance</th>
                                            <th className="cnf-table-header">Status</th>
                                            <th className="cnf-table-header">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="cnf-table-body">
                                        {sortData(cnfs).map((cnf) => (
                                            <tr key={cnf._id} className="cnf-table-row" 
                                            onMouseDown={() => startLongPress(cnf._id)} 
                                            onMouseUp={endLongPress} 
                                            onMouseLeave={endLongPress}
                                            onTouchStart={(e) => startLongPress(cnf._id)} 
                                            onTouchEnd={endLongPress}
                                            onClick={(e) => {
                                                if (isLongPressTriggered.current) {
                                                    isLongPressTriggered.current = false;
                                                    return;
                                                }
                                                if (isSelectionMode) toggleSelection(cnf._id);
                                            }}>
                                                {isSelectionMode && <td className="cnf-table-cell"><input type="checkbox" checked={selectedItems.has(cnf._id)} readOnly /></td>}
                                                <td className="cnf-table-cell font-bold">{cnf.cnfId}</td>
                                                <td className="cnf-table-cell">{cnf.name}</td>
                                                <td className="cnf-table-cell">{cnf.contactPerson}</td>
                                                <td className="cnf-table-cell">{cnf.phone}</td>
                                                <td className="cnf-table-cell">{cnf.uom || 'QTY'}</td>
                                                <td className="cnf-table-cell font-bold">{cnf.commission} Tk</td>
                                                <td className="cnf-table-cell font-black">{(cnf.totalBalance || 0).toLocaleString()} Tk</td>
                                                <td className="cnf-table-cell"><span className={`cnf-status-badge ${cnf.status === 'Active' ? 'active' : 'inactive'}`}>{cnf.status}</span></td>
                                                <td className="cnf-table-cell">
                                                    <div className="cnf-table-actions">
                                                        <button onClick={(e) => { e.stopPropagation(); setViewData(cnf); }} className="cnf-action-btn hover:bg-gray-100 text-gray-400 hover:text-gray-600"><EyeIcon className="w-5 h-5" /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleEdit(cnf); }} className="cnf-action-btn cnf-action-edit"><EditIcon className="w-5 h-5" /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(cnf._id); }} className="cnf-action-btn cnf-action-delete"><TrashIcon className="w-5 h-5" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="block md:hidden px-2 py-3 space-y-3">
                                {sortData(cnfs).map((cnf) => {
                                    const isExpanded = expandedCnFId === cnf._id;
                                    return (
                                        <div
                                            key={cnf._id}
                                            className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${selectedItems.has(cnf._id) ? 'border-blue-300 bg-blue-50/30' : 'border-gray-100 shadow-sm'} ${isExpanded ? 'ring-1 ring-blue-50 shadow-md border-blue-200' : 'hover:border-gray-200 shadow-sm'}`}
                                            onMouseDown={() => startLongPress(cnf._id)} 
                                            onMouseUp={endLongPress} 
                                            onMouseLeave={endLongPress}
                                            onTouchStart={(e) => startLongPress(cnf._id)}
                                            onTouchEnd={endLongPress}
                                            onClick={(e) => {
                                                if (isLongPressTriggered.current) {
                                                    isLongPressTriggered.current = false;
                                                    return;
                                                }
                                                if (isSelectionMode) {
                                                    toggleSelection(cnf._id);
                                                } else {
                                                    setExpandedCnFId(isExpanded ? null : cnf._id);
                                                }
                                            }}
                                        >
                                            <div className="flex justify-between items-center p-4">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    {isSelectionMode && (
                                                        <input type="checkbox" checked={selectedItems.has(cnf._id)} readOnly className="w-5 h-5 accent-blue-600 shrink-0" />
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-gray-900 text-sm truncate uppercase tracking-tight">{cnf.name}</p>
                                                        <p className="text-[10px] font-bold text-gray-900 mt-0.5 tracking-wider uppercase opacity-80">{cnf.cnfId}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`cnf-status-badge ${cnf.status === 'Active' ? 'active' : 'inactive'} shrink-0 text-[10px] py-0.5 px-2`}>{cnf.status}</span>
                                                    <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}>
                                                        {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                                                    </div>
                                                </div>
                                            </div>
                                            {isExpanded && (
                                                <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                                                    <div className="space-y-2.5 pt-3 border-t border-gray-50 text-xs">
                                                        <div className="flex justify-between items-center"><span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Contact Person</span><span className="text-gray-900 font-black">{cnf.contactPerson}</span></div>
                                                        <div className="flex justify-between items-center"><span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Phone</span><span className="text-gray-900 font-black font-mono">{cnf.phone}</span></div>
                                                        <div className="flex justify-between items-center bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                                                            <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Balance</span>
                                                            <span className="text-gray-900 font-black">{(cnf.totalBalance || 0).toLocaleString()} Tk</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                                                        <button onClick={(e) => { e.stopPropagation(); setViewData(cnf); }} className="flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-50 text-gray-700 rounded-xl text-xs font-black flex-1 hover:bg-gray-100 transition-all active:scale-95"><EyeIcon className="w-4 h-4" /> History</button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleEdit(cnf); }} className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-50 text-blue-700 rounded-xl text-xs font-black flex-1 hover:bg-blue-100 transition-all active:scale-95"><EditIcon className="w-4 h-4" /> Edit</button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(cnf._id); }} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all active:scale-95"><TrashIcon className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : <div className="cnf-empty"><p>No agents found</p></div>}
                </div>
            )}

            {viewData && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setViewData(null)}></div>
                    <div className="relative bg-white border border-gray-100 rounded-2xl shadow-2xl max-w-[1400px] w-full flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                        <div className="relative px-4 py-4 md:px-8 md:py-6 border-b border-gray-100 flex flex-col md:flex-row items-start md:items-center gap-4 bg-white sticky top-0 z-10 rounded-t-2xl">
                            <div className="flex-1 text-left">
                                <h2 className="text-xl font-bold text-gray-900">{viewData.name}</h2>
                                <p className="text-xs text-gray-500 mt-1">ID: {viewData.cnfId}</p>
                            </div>
                            {/* Search bar - centered */}
                            <div className="flex-1 flex justify-center">
                                <div className="w-full max-w-sm relative">
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Search history..."
                                        value={historySearchQuery}
                                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="flex-1 flex items-center justify-end gap-2">
                                <div className="relative">
                                    <button
                                        ref={historyFilterButtonRef}
                                        onClick={() => setShowHistoryFilterPanel(!showHistoryFilterPanel)}
                                        className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-xl transition-all border ${showHistoryFilterPanel || Object.values(historyFilters).some(v => v !== '')
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30'
                                            }`}
                                    >
                                        <FunnelIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${showHistoryFilterPanel || Object.values(historyFilters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                                    </button>

                                    {/* History Filter Panel */}
                                    {showHistoryFilterPanel && (
                                        <div ref={historyFilterPanelRef} className="absolute top-full right-0 mt-2 w-72 md:w-80 bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[2010] p-4 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                                                <h4 className="font-bold text-gray-900 text-sm">Advanced Filter</h4>
                                                <button
                                                    onClick={() => {
                                                        setHistoryFilters({ startDate: '', endDate: '', lcNo: '', productName: '' });
                                                        setHistoryFilterSearchInputs({ lcNo: '', product: '' });
                                                    }}
                                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                                                >
                                                    Reset
                                                </button>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <CustomDatePicker
                                                        label="From Date"
                                                        value={historyFilters.startDate}
                                                        onChange={(e) => setHistoryFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                                        compact={true}
                                                    />
                                                    <CustomDatePicker
                                                        label="To Date"
                                                        value={historyFilters.endDate}
                                                        onChange={(e) => setHistoryFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                                        compact={true}
                                                    />
                                                </div>

                                                <div className="space-y-3 pt-2">
                                                    {/* LC No Dropdown */}
                                                    <div className="space-y-1.5 relative" ref={lcNoFilterRef}>
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">LC NUMBER</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={historyFilterSearchInputs.lcNo}
                                                                onChange={(e) => {
                                                                    setHistoryFilterSearchInputs(prev => ({ ...prev, lcNo: e.target.value }));
                                                                    setHistoryFilters(prev => ({ ...prev, lcNo: e.target.value }));
                                                                    setHistoryFilterDropdownOpen(prev => ({ ...prev, lcNo: true, product: false }));
                                                                }}
                                                                onFocus={() => setHistoryFilterDropdownOpen(prev => ({ ...prev, lcNo: true, product: false }))}
                                                                placeholder={historyFilters.lcNo || "Select LC No..."}
                                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all pr-8"
                                                            />
                                                            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                                        </div>
                                                        {historyFilterDropdownOpen.lcNo && (() => {
                                                            const options = getUniqueHistoryOptions('lcNo');
                                                            const filtered = options.filter(opt => opt.toLowerCase().includes(historyFilterSearchInputs.lcNo.toLowerCase()));
                                                            return filtered.length > 0 ? (
                                                                <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1">
                                                                    {filtered.map(opt => (
                                                                        <button
                                                                            key={opt}
                                                                            onClick={() => {
                                                                                setHistoryFilters(prev => ({ ...prev, lcNo: opt }));
                                                                                setHistoryFilterSearchInputs(prev => ({ ...prev, lcNo: '' }));
                                                                                setHistoryFilterDropdownOpen(prev => ({ ...prev, lcNo: false }));
                                                                            }}
                                                                            className="w-full px-4 py-1.5 text-left text-xs hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            {opt}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>

                                                    {/* Product Dropdown */}
                                                    <div className="space-y-1.5 relative" ref={productFilterSearchRef}>
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">PRODUCT</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={historyFilterSearchInputs.product}
                                                                onChange={(e) => {
                                                                    setHistoryFilterSearchInputs(prev => ({ ...prev, product: e.target.value }));
                                                                    setHistoryFilters(prev => ({ ...prev, productName: e.target.value }));
                                                                    setHistoryFilterDropdownOpen(prev => ({ ...prev, product: true, lcNo: false }));
                                                                }}
                                                                onFocus={() => setHistoryFilterDropdownOpen(prev => ({ ...prev, product: true, lcNo: false }))}
                                                                placeholder={historyFilters.productName || "Select Product..."}
                                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all pr-8"
                                                            />
                                                            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                                        </div>
                                                        {historyFilterDropdownOpen.product && (() => {
                                                            const options = getUniqueHistoryOptions('product');
                                                            const filtered = options.filter(opt => opt.toLowerCase().includes(historyFilterSearchInputs.product.toLowerCase()));
                                                            return filtered.length > 0 ? (
                                                                <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1">
                                                                    {filtered.map(opt => (
                                                                        <button
                                                                            key={opt}
                                                                            onClick={() => {
                                                                                setHistoryFilters(prev => ({ ...prev, productName: opt }));
                                                                                setHistoryFilterSearchInputs(prev => ({ ...prev, product: '' }));
                                                                                setHistoryFilterDropdownOpen(prev => ({ ...prev, product: false }));
                                                                            }}
                                                                            className="w-full px-4 py-1.5 text-left text-xs hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            {opt}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>
                                                </div>

                                                <button onClick={() => setShowHistoryFilterPanel(false)} className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all shadow-lg active:scale-[0.98]">
                                                    APPLY FILTERS
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={handlePrintHistory}
                                    className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-xl transition-all border bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30"
                                    title="Print Report"
                                >
                                    <PrinterIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                </button>

                                {isHistorySelectionMode && (
                                    <button onClick={() => setIsBulkEditModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 transition-all shadow shadow-blue-500/30 text-sm font-medium">
                                        Bulk Edit ({selectedHistoryIds.size})
                                    </button>
                                )}
                                <button onClick={() => setViewData(null)} className="p-2 hover:bg-gray-50 text-gray-400 hover:text-gray-600 rounded-full transition-all">
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4 md:p-8 pt-6 md:pt-8">
                            {historyLoading ? <div className="flex justify-center p-12"><div className="w-8 h-8 border-2 border-t-blue-600 rounded-full animate-spin"></div></div> : (
                                <div className="space-y-4">
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="cnf-table">
                                            <thead>
                                                <tr className="cnf-table-header-row">
                                                    {isHistorySelectionMode && <th className="cnf-table-checkbox-header"><input type="checkbox" checked={selectedHistoryIds.size === filteredHistory.length} onChange={toggleSelectAllHistory} /></th>}
                                                    <th className="cnf-table-header">Date</th>
                                                    <th className="cnf-table-header whitespace-nowrap">LC No</th>
                                                    <th className="cnf-table-header">Product</th>
                                                    <th className="cnf-table-header">Port</th>
                                                    <th className="cnf-table-header">Truck</th>
                                                    <th className="cnf-table-header">Bag</th>
                                                    <th className="cnf-table-header">Qty</th>
                                                    <th className="cnf-table-header">Commission</th>
                                                    <th className="cnf-table-header">Total</th>
                                                    <th className="cnf-table-header text-center whitespace-nowrap">Source</th>
                                                    <th className="cnf-table-header text-center">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="cnf-table-body">
                                                {filteredHistory.map((row, idx) => (
                                                    <tr key={idx} className={`cnf-table-row cursor-pointer transition-colors ${selectedHistoryIds.has(row._id) ? 'bg-blue-50/50' : ''}`} 
                                                    onMouseDown={() => startHistoryLongPress(row._id)} 
                                                    onMouseUp={endHistoryLongPress} 
                                                    onMouseLeave={endHistoryLongPress} 
                                                    onTouchStart={(e) => startHistoryLongPress(row._id)} 
                                                    onTouchEnd={endHistoryLongPress} 
                                                    onClick={(e) => {
                                                        if (isHistoryLongPressTriggered.current) { 
                                                            isHistoryLongPressTriggered.current = false; 
                                                            return; 
                                                        }
                                                        if (isHistorySelectionMode) {
                                                            toggleHistorySelection(row._id);
                                                        }
                                                    }}>
                                                        {isHistorySelectionMode && (
                                                            <td className="cnf-table-cell">
                                                                {(isAdmin || (!row.indCnFEdited && !row.bdCnFEdited && !row.indCnFBulkEdited && !row.bdCnFBulkEdited)) ? (
                                                                    <input type="checkbox" checked={selectedHistoryIds.has(row._id)} readOnly />
                                                                ) : null}
                                                            </td>
                                                        )}
                                                        <td className="cnf-table-cell whitespace-nowrap">{formatDate(row.date)}</td>
                                                        <td className="cnf-table-cell font-bold whitespace-nowrap">{row.lcNo}</td>
                                                        <td className="cnf-table-cell font-medium">{row.product || '-'}</td>
                                                        <td className="cnf-table-cell">{row.port || '-'}</td>
                                                        <td className="cnf-table-cell uppercase">{row.truck || '-'}</td>
                                                        <td className="cnf-table-cell font-bold">{(!isNaN(parseFloat(row.bag))) ? Math.round(row.bag).toLocaleString() : '-'}</td>
                                                        <td className="cnf-table-cell font-bold">{(!isNaN(parseFloat(row.qty))) ? Math.round(row.qty).toLocaleString() : '-'}</td>
                                                        <td className="cnf-table-cell">{row.commission}</td>
                                                        <td className="cnf-table-cell font-black">{(row.totalCommission || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        <td className="cnf-table-cell text-center">
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${row.source === 'Sale' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'} border ${row.source === 'Sale' ? 'border-amber-200' : 'border-blue-200'}`}>
                                                                {row.source || 'LC'}
                                                            </span>
                                                        </td>
                                                        <td className="cnf-table-cell text-center">
                                                            {(isAdmin || (!row.indCnFEdited && !row.bdCnFEdited && !row.indCnFBulkEdited && !row.bdCnFBulkEdited)) ? (
                                                                <button onClick={(e) => { e.stopPropagation(); handleEditHistory(row); }} className="hover:bg-gray-100 p-1.5 rounded-md transition-colors">
                                                                    <EditIcon className="w-4 h-4 text-gray-400 hover:text-gray-900" />
                                                                </button>
                                                            ) : (
                                                                <span className="text-[8px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter shadow-sm inline-block">Edited</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="block md:hidden space-y-3">
                                        {filteredHistory.length > 0 ? (
                                            filteredHistory.map((row, idx) => {
                                                const isExpanded = expandedHistoryIdx === idx;
                                                const isSelected = selectedHistoryIds.has(row._id);
                                                return (
                                                    <div 
                                                        key={idx} 
                                                        className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${isSelected ? 'border-gray-900 shadow-md ring-1 ring-gray-900/10' : 'border-gray-100 shadow-sm hover:border-gray-200'} ${isExpanded ? 'border-gray-200' : ''}`}
                                                        onMouseDown={() => startHistoryLongPress(row._id)} 
                                                        onMouseUp={endHistoryLongPress} 
                                                        onMouseLeave={endHistoryLongPress}
                                                        onTouchStart={(e) => startHistoryLongPress(row._id)} 
                                                        onTouchEnd={endHistoryLongPress}
                                                        onClick={(e) => {
                                                            if (isHistoryLongPressTriggered.current) { 
                                                                isHistoryLongPressTriggered.current = false; 
                                                                return; 
                                                            }
                                                            if (isHistorySelectionMode) {
                                                                const isEditable = isAdmin || (!row.indCnFEdited && !row.bdCnFEdited && !row.indCnFBulkEdited && !row.bdCnFBulkEdited);
                                                                if (isEditable) {
                                                                    toggleHistorySelection(row._id);
                                                                }
                                                            } else {
                                                                setExpandedHistoryIdx(isExpanded ? null : idx);
                                                            }
                                                        }}
                                                    >
                                                        <div className="flex justify-between items-center p-4 cursor-pointer select-none active:bg-gray-50 transition-colors">
                                                            <div className="flex-1 min-w-0 pr-4 flex items-center gap-3">
                                                                {isHistorySelectionMode && (isAdmin || (!row.indCnFEdited && !row.bdCnFEdited && !row.indCnFBulkEdited && !row.bdCnFBulkEdited)) && (
                                                                    <input type="checkbox" checked={isSelected} readOnly className="w-5 h-5 accent-gray-900 shrink-0" onClick={(e) => e.stopPropagation()} />
                                                                )}
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{formatDate(row.date)}</p>
                                                                        <span className="h-1 w-1 bg-gray-300 rounded-full"></span>
                                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${row.source === 'Sale' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                                                                            {row.source || 'LC'}
                                                                        </span>
                                                                        <span className="h-1 w-1 bg-gray-300 rounded-full"></span>
                                                                        <p className="text-xs font-bold text-gray-800 truncate">{row.product || '-'}</p>
                                                                        {(row.indCnFEdited || row.bdCnFEdited || row.indCnFBulkEdited || row.bdCnFBulkEdited) && (
                                                                            <span className="text-[8px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter">Edited</span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-sm font-black text-gray-900 truncate">{row.lcNo || '-'}</p>
                                                                </div>
                                                            </div>
                                                            <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-gray-50 text-gray-600' : 'bg-gray-50 text-gray-400'}`}>{isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}</div>
                                                        </div>
                                                        {isExpanded && (
                                                            <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-4 duration-300">
                                                                <div className="flex justify-between items-start pt-3 border-t border-gray-50">
                                                                    <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Port</p><p className="text-xs font-medium text-gray-700">{row.port || '-'}</p></div>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-3 py-2.5 bg-gray-50/70 rounded-xl px-4">
                                                                    <div className="space-y-1"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Truck No</p><p className="text-xs font-semibold text-gray-700">{row.truck || '-'}</p></div>
                                                                    <div className="space-y-1 text-right"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bag / Qty</p><p className="text-xs font-bold text-gray-900">{row.bag ? Math.round(parseFloat(row.bag)).toLocaleString() : '0'} / {row.qty ? Math.round(parseFloat(row.qty)).toLocaleString() : '0'}</p></div>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-50">
                                                                    <div>
                                                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Commission ({row.uom || viewData?.uom || 'QTY'})</p>
                                                                        <p className="text-xs font-black text-gray-900 font-mono">{(row.commission || 0).toLocaleString()} Tk</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Commission</p>
                                                                        <p className="text-xs font-black text-gray-900 font-mono">{(row.totalCommission || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tk</p>
                                                                    </div>
                                                                </div>
                                                                <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                                                                    {(isAdmin || (!row.indCnFEdited && !row.bdCnFEdited && !row.indCnFBulkEdited && !row.bdCnFBulkEdited)) ? (
                                                                        <button onClick={() => handleEditHistory(row)} className="flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-black flex-1 active:scale-95 shadow-lg shadow-gray-900/20"><EditIcon className="w-4 h-4" /> Edit Record</button>
                                                                    ) : (
                                                                        <div className="flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-500 rounded-xl text-[10px] font-black flex-1 uppercase tracking-widest"><LockIcon className="w-4 h-4" /> Edited & Locked</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="text-center py-12 text-gray-400"><BoxIcon className="w-8 h-8 mb-2 mx-auto opacity-20" /><p className="text-sm">No history results found</p></div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {editRecord && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setEditRecord(null)}></div>
                    <div className="cnf-form-container w-full max-w-xl">
                        <div className="cnf-form-bg-orb cnf-form-bg-orb-1"></div>
                        <div className="cnf-form-bg-orb cnf-form-bg-orb-2"></div>
                        
                        <div className="cnf-form-header">
                            <h3 className="cnf-form-title">Edit History Record</h3>
                            <button onClick={() => setEditRecord(null)} className="cnf-form-close"><XIcon className="w-6 h-6" /></button>
                        </div>
                        
                        <div className="relative z-10 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="cnf-form-field">
                                    <label className="cnf-form-label">Calculation UOM</label>
                                    <select name="uom" value={editHistoryData.uom || 'QTY'} onChange={handleEditHistoryChange} className="cnf-form-select cursor-pointer">
                                        <option value="QTY">Based on QTY</option>
                                        <option value="BAG">Based on BAG</option>
                                        <option value="TRUCK">Based on TRUCK</option>
                                    </select>
                                </div>
                                <div className="cnf-form-field">
                                    <label className="cnf-form-label">Commission Rate</label>
                                    <input type="number" step="0.01" name="commission" value={editHistoryData.commission} onChange={handleEditHistoryChange} className="cnf-form-input" />
                                </div>
                            </div>
                            
                            <div className="flex gap-3">
                                <button onClick={() => setEditRecord(null)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 transition-colors rounded-xl font-bold text-gray-700">Cancel</button>
                                <button onClick={handleSaveHistory} className="cnf-form-submit flex-[2] justify-center text-lg h-[50px]">Update Record</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isBulkEditModalOpen && (
                <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsBulkEditModalOpen(false)}></div>
                    <div className="cnf-form-container w-full max-w-xl">
                        <div className="cnf-form-bg-orb cnf-form-bg-orb-1"></div>
                        <div className="cnf-form-bg-orb cnf-form-bg-orb-2"></div>
                        
                        <div className="cnf-form-header">
                            <h3 className="cnf-form-title">Bulk Edit History</h3>
                            <button onClick={() => setIsBulkEditModalOpen(false)} className="cnf-form-close"><XIcon className="w-6 h-6" /></button>
                        </div>
                        
                        <div className="relative z-10 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="cnf-form-field">
                                    <label className="cnf-form-label">Calculation UOM</label>
                                    <select value={bulkEditData.uom} onChange={(e) => setBulkEditData(p => ({...p, uom: e.target.value}))} className="cnf-form-select cursor-pointer">
                                        <option value="QTY">Based on QTY</option>
                                        <option value="BAG">Based on BAG</option>
                                        <option value="TRUCK">Based on TRUCK</option>
                                    </select>
                                </div>
                                <div className="cnf-form-field">
                                    <label className="cnf-form-label">Commission Rate</label>
                                    <input type="number" step="0.01" value={bulkEditData.commission} onChange={(e) => setBulkEditData(p => ({...p, commission: e.target.value}))} className="cnf-form-input" />
                                </div>
                            </div>
                            
                            <div className="flex gap-3">
                                <button onClick={() => setIsBulkEditModalOpen(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 transition-colors rounded-xl font-bold text-gray-700">Cancel</button>
                                <button onClick={handleBulkUpdateHistory} className="cnf-form-submit flex-[2] justify-center text-lg h-[50px]">Apply to {selectedHistoryIds.size} Records</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CnF;
