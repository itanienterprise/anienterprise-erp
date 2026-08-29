import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { EditIcon, TrashIcon, XIcon, SearchIcon, FunnelIcon, ChevronDownIcon, ChevronUpIcon, EyeIcon, ReceiptIcon, BarChartIcon, TrendingUpIcon, DollarSignIcon, FileTextIcon, CheckIcon } from '../../Icons';
import { generateSaleInvoicePDF, generateSaleChallanPDF } from '../../../utils/pdfGenerator';
import { API_BASE_URL, SortIcon, formatDate } from '../../../utils/helpers';
import { hasPermission } from '../../../utils/permissionHelper';
import { decryptData } from '../../../utils/encryption';
import CustomDatePicker from '../../shared/CustomDatePicker';
import axios from '../../../utils/api';
import { calculateStockData, isLcMatch } from '../../../utils/stockHelpers';
import './SaleManagement.css';

const getSafeString = (val) => {
    if (!val) return '';
    if (typeof val === 'object') return val.customerName || val.companyName || val.name || '';
    return String(val);
};

const SaleManagement = ({
    saleType,
    isSelectionMode,
    setIsSelectionMode,
    selectedItems,
    setSelectedItems,
    toggleSelection,
    isAllSelected,
    toggleSelectAll,
    setTotalCount,
    setPaginationDetails,
    onSaveSuccess,
    triggerReset,
    currentUser,
    addNotification,
    hasLoadedOnce,
    setHasLoadedOnce,
    activeTab,
    searchTerm = '',
    onSearchChange,
    customFilters = {},
    onFilterChange,
    onSortChange,
    isLongPressTriggered,
    onDeleteConfirm,
    startLongPress,
    endLongPress,
    setShowSalesReport,
    setSalesReportData,
    setSalesReportSearchQuery,
    saleFilters,
    setSaleFilters,
    refreshPendingIndicators,
    fetchSalesGlobal,
    highlightId, isRequestedNotif
}) => {
    
    const [showForm, setShowForm] = useState(false);
    const [sales, setSales] = useState([]);
    const [allSalesRecords, setAllSalesRecords] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [employeesMap, setEmployeesMap] = useState({});
    const [activePdfDropdown, setActivePdfDropdown] = useState(null);

    const fetchEmployees = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/employees`);
            const rawData = Array.isArray(response.data) ? response.data : [];
            const map = {};
            rawData.forEach(emp => {
                let d = emp;
                if (emp && emp.data) {
                    if (typeof emp.data === 'string') {
                        try { d = { ...decryptData(emp.data), _id: emp._id }; } catch(e){}
                    } else if (typeof emp.data === 'object') {
                        d = { ...emp.data, _id: emp._id };
                    }
                }
                const empName = (d.name || d.nameEn || d.employeeName || d.username || '').trim();
                if (d.employeeId) map[d.employeeId] = empName;
                if (d.username) map[d.username] = empName;
                if (d._id) map[d._id] = empName;
            });
            setEmployeesMap(map);
        } catch (error) {
            console.error('Error fetching employees map:', error);
        }
    };

    const getDisplayName = (code, name) => {
        if (name && !name.startsWith('E-') && !name.startsWith('A-') && name !== code) {
            return name;
        }
        if (code && employeesMap[code]) {
            return employeesMap[code];
        }
        if (name && employeesMap[name]) {
            return employeesMap[name];
        }
        return name || code || '';
    };

    const rowRefs = useRef({});
    useEffect(() => {
        if (isRequestedNotif) {
            setIsRequestedOnly(true);
        }
    }, [isRequestedNotif]);

    useEffect(() => {
        if (!highlightId) return;

        const cleanH = String(highlightId).toLowerCase().trim();
        const targetItem = sales.find(s => 
            (s.invoiceNo && String(s.invoiceNo).toLowerCase().trim() === cleanH) ||
            String(s._id) === cleanH
        );
        if (targetItem) {
            const isReq = (targetItem.status || '').toLowerCase() === 'requested';
            const isEditReq = (targetItem.isEdited === true || targetItem.isEdited === 'true') && !isReq;
            if (isReq) {
                setIsRequestedOnly(true);
                setIsEditRequestedOnly(false);
            } else if (isEditReq) {
                setIsEditRequestedOnly(true);
                setIsRequestedOnly(false);
            } else {
                setIsRequestedOnly(false);
                setIsEditRequestedOnly(false);
            }
        }

        const scrollToRow = () => {
            if (!highlightId) return false;
            const target = String(highlightId).trim().toLowerCase();
            const keys = Object.keys(rowRefs.current);
            const matchedKey = keys.find(k => k.trim().toLowerCase() === target || k.trim().toLowerCase().includes(target) || target.includes(k.trim().toLowerCase()));
            const el = matchedKey ? rowRefs.current[matchedKey] : rowRefs.current[highlightId];
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return true;
            }
            return false;
        };
        const t1 = setTimeout(() => {
            if (!scrollToRow()) {
                const t2 = setTimeout(() => {
                    if (!scrollToRow()) { setSearchQuery(""); setTimeout(scrollToRow, 300); }
                }, 700);
                return () => clearTimeout(t2);
            }
        }, 250);
        return () => clearTimeout(t1);
    }, [highlightId, sales]);

    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [stockRecords, setStockRecords] = useState([]);
    const [exportersList, setExportersList] = useState([]);
    const [importersList, setImportersList] = useState([]);
    const [portsList, setPortsList] = useState([]);
    const [cnfsList, setCnfsList] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [viewData, setViewData] = useState(null);
    const [confirmModalConfig, setConfirmModalConfig] = useState(null);
    const [_customerSearch, setCustomerSearch] = useState('');
    const [collapsedRows, setCollapsedRows] = useState([]);
    const [expandedMobileRows, setExpandedMobileRows] = useState([]);

    const toggleMobileRowExpansion = (saleId) => {
        setExpandedMobileRows(prev =>
            prev.includes(saleId) ? prev.filter(id => id !== saleId) : [...prev, saleId]
        );
    };
    const [showSaleFilterPanel, setShowSaleFilterPanel] = useState(false);
    const [saleFilterSearch, setSaleFilterSearch] = useState({ companySearch: '', invoiceSearch: '', portSearch: '', productSearch: '', brandSearch: '', indCnfSearch: '', bdCnfSearch: '' });
    const [activeFilterDropdown, setActiveFilterDropdown] = useState(null); // 'from', 'to', 'company', 'invoice', 'port', 'product', 'brand', 'indCnf', 'bdCnf'
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [companyNameSearch, setCompanyNameSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [brandSearch, setBrandSearch] = useState('');
    const [warehouseSearch, setWarehouseSearch] = useState('');
    const [importerSearch, setImporterSearch] = useState('');
    const [portSearch, setPortSearch] = useState('');
    const [indCnfSearch, setIndCnfSearch] = useState('');
    const [bdCnfSearch, setBdCnfSearch] = useState('');
    const [exporterSearch, setExporterSearch] = useState('');
    const [isRequestedOnly, setIsRequestedOnly] = useState(false);
    useEffect(() => { if (isRequestedNotif) { setIsRequestedOnly(true); } }, [isRequestedNotif]);
    const [isEditRequestedOnly, setIsEditRequestedOnly] = useState(false);
    const [originalData, setOriginalData] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    // Show Unit Preference (BAG | QTY | BOTH)
    const [displayUnit, setDisplayUnit] = useState(() => {
        const saved = localStorage.getItem('sale_displayUnit_default');
        if (saved) return saved;
        const oldShowBag = localStorage.getItem('sale_showBag_default');
        if (oldShowBag === 'true') return 'BOTH';
        if (oldShowBag === 'false') return 'QTY';
        return 'BOTH';
    });

    useEffect(() => {
        localStorage.setItem('sale_displayUnit_default', displayUnit);
    }, [displayUnit]);

    const showBag = displayUnit === 'BOTH' || displayUnit === 'BAG';
    const showQty = displayUnit === 'BOTH' || displayUnit === 'QTY';

    const [showBulkRateModal, setShowBulkRateModal] = useState(false);
    const [lcRecords, setLcRecords] = useState([]);
    const [lcSearch, setLcSearch] = useState('');
    const [orderSearch, setOrderSearch] = useState('');
    const [bulkRate, setBulkRate] = useState('');

    const handleBulkRateUpdate = async () => {
        if (!bulkRate || isNaN(parseFloat(bulkRate))) {
            alert('Please enter a valid rate');
            return;
        }

        setIsSubmitting(true);
        try {
            const selectedIds = Array.from(selectedItems);
            const updates = selectedIds.map(async (id) => {
                const sale = allSalesRecords.find(s => s._id === id);
                if (!sale) return;

                const newRate = parseFloat(bulkRate);

                // Update items
                const updatedItems = (sale.items || []).map(item => {
                    const updatedBrandEntries = (item.brandEntries || []).map(be => {
                        const activeUOM = be.uom || item.uom || sale.uom || (sale.saleType === 'General' ? 'QTY' : 'Truck');
                        const qty = parseFloat(be.quantity || item.quantity || sale.quantity) || 0;
                        const bag = parseFloat(be.bag || item.bag || sale.bag) || 0;
                        const truckCount = parseFloat(be.truck || item.truck || sale.truck) || 0;
                        const price = newRate;

                        let entryTotal = 0;
                        if (activeUOM === 'QTY') {
                            entryTotal = qty * price;
                        } else if (activeUOM === 'BAG') {
                            entryTotal = bag * price;
                        } else {
                            entryTotal = truckCount * price;
                        }
                        return { ...be, unitPrice: price, totalAmount: entryTotal.toFixed(2) };
                    });

                    // Calculate item total amount from brand entries OR item quantity
                    let itemTotalAmount = 0;
                    if (updatedBrandEntries.length > 0) {
                        itemTotalAmount = updatedBrandEntries.reduce((sum, be) => sum + (parseFloat(be.totalAmount) || 0), 0);
                    } else {
                        const activeItemUOM = item.uom || sale.uom || (sale.saleType === 'General' ? 'QTY' : 'Truck');
                        const itemQty = parseFloat(item.quantity || sale.quantity) || 0;
                        const itemBag = parseFloat(item.bag || sale.bag) || 0;
                        const itemTruck = parseFloat(item.truck || sale.truck) || 0;
                        const itemPrice = newRate;

                        if (activeItemUOM === 'QTY') {
                            itemTotalAmount = itemQty * itemPrice;
                        } else if (activeItemUOM === 'BAG') {
                            itemTotalAmount = itemBag * itemPrice;
                        } else {
                            itemTotalAmount = itemTruck * itemPrice;
                        }
                    }

                    return {
                        ...item,
                        brandEntries: updatedBrandEntries,
                        unitPrice: newRate,
                        totalAmount: itemTotalAmount.toFixed(2)
                    };
                });

                // If no items (old format)
                let updatedSale = { ...sale };
                if (updatedItems.length > 0) {
                    updatedSale.items = updatedItems;
                    updatedSale.totalAmount = updatedItems.reduce((sum, item) => sum + (parseFloat(item.totalAmount) || 0), 0).toFixed(2);
                } else {
                    const activeSaleUOM = sale.uom || (sale.saleType === 'General' ? 'QTY' : 'Truck');
                    const saleQty = parseFloat(sale.quantity) || 0;
                    const saleBag = parseFloat(sale.bag) || 0;
                    const saleTruck = parseFloat(sale.truck) || 0;
                    const salePrice = newRate;

                    let saleTotal = 0;
                    if (activeSaleUOM === 'QTY') {
                        saleTotal = saleQty * salePrice;
                    } else if (activeSaleUOM === 'BAG') {
                        saleTotal = saleBag * salePrice;
                    } else {
                        saleTotal = saleTruck * salePrice;
                    }

                    updatedSale.unitPrice = newRate;
                    updatedSale.totalAmount = saleTotal.toFixed(2);
                }

                // Update due amount
                updatedSale.dueAmount = Math.max(0, (parseFloat(updatedSale.totalAmount) || 0) - (parseFloat(updatedSale.discount) || 0) - (parseFloat(updatedSale.paidAmount) || 0));

                const { _id, createdAt: _createdAt, ...dataToSend } = updatedSale;

                if (id) {
                    return axios.put(`${API_BASE_URL}/api/sales/${id}`, dataToSend);
                }
            });

            await Promise.all(updates);
            addNotification('Bulk Update Success', `Updated rate for ${selectedIds.length} sales`);
            fetchSales();
            setSelectedItems(new Set());
            setIsSelectionMode(false);
            setShowBulkRateModal(false);
            setBulkRate('');
        } catch (err) {
            console.error('Bulk update error:', err);
            alert('Failed to update sales in bulk');
        } finally {
            setIsSubmitting(false);
        }
    };

    const executeBulkAccept = async (recordsToAccept) => {
        try {
            setIsSubmitting(true);
            setConfirmModalConfig(null);

            const actionBy = currentUser ? (currentUser.name || currentUser.username || '') : '';
            const now = new Date();
            const dateStr = formatDate(now);
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const adminName = currentUser?.name || currentUser?.username || 'Admin';

            for (const sale of recordsToAccept) {
                const { _id, createdAt: _createdAt, ...rest } = sale;
                const finalStatus = (parseFloat(sale.paidAmount || 0) >= parseFloat(sale.totalAmount || 0) && parseFloat(sale.totalAmount || 0) > 0)
                    ? 'Complete'
                    : 'Pending';

                const isEditAcceptance = sale.isEdited === true || (sale.status || '').toLowerCase() === 'edit_requested';
                const updatedData = {
                    ...rest,
                    status: finalStatus,
                    isEdited: false,
                    acceptedBy: sale.acceptedBy || actionBy,
                    acceptedByUsername: sale.acceptedByUsername || (currentUser?.username || ''),
                    approvedBy: sale.approvedBy || actionBy,
                    approvedByName: sale.approvedByName || actionBy,
                    ...(isEditAcceptance ? {
                        editApprovedBy: actionBy,
                        editApprovedByName: actionBy,
                        editApprovedByUsername: (currentUser?.username || '')
                    } : {})
                };

                await axios.put(`${API_BASE_URL}/api/sales/${_id}`, updatedData);

                if (finalStatus === 'Complete' || finalStatus === 'Pending') {
                    try {
                        await processSaleEffects(updatedData, false);
                    } catch (err) {
                        console.error(`Error in processSaleEffects for bulk accept on sale ${_id}:`, err);
                    }
                }

                if (addNotification) {
                    try {
                        const requesterName = sale.requestedBy || sale.requestedByUsername || 'an employee';
                        const sType = saleType === 'Border' ? 'Border Sale' : 'General Sale';

                        const targetRoles = ['admin', 'incharge', 'sales manager'];
                        const targetUsers = [sale.requestedByUsername].filter(Boolean);
                        if (!targetUsers.includes('admin')) targetUsers.push('admin');

                        await addNotification(
                            `${sType} Accepted`,
                            `${dateStr} | ${timeStr} | ${adminName} has accepted the ${sType.toLowerCase()} entry (${sale.invoiceNo || 'No Invoice'}) requested by ${requesterName}`,
                            targetRoles,
                            targetUsers
                        );
                    } catch (err) {
                        console.error('Error sending bulk accept notification:', err);
                    }
                }
            }

            setSelectedItems(new Set());
            if (setIsSelectionMode) setIsSelectionMode(false);
            try { fetchSales(); } catch (e) { console.error('fetchSales error', e); }
            try { fetchCustomers(); } catch (e) { console.error('fetchCustomers error', e); }
            try { fetchWarehouses(); } catch (e) { console.error('fetchWarehouses error', e); }
            try { fetchStockRecords(); } catch (e) { console.error('fetchStockRecords error', e); }
            if (refreshPendingIndicators) refreshPendingIndicators();
        } catch (error) {
            console.error('Error performing bulk accept:', error);
            setConfirmModalConfig({
                title: 'Operation Failed',
                message: 'Failed to accept selected items. Please try again.',
                type: 'danger',
                confirmText: 'OK',
                onConfirm: () => setConfirmModalConfig(null)
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBulkAccept = () => {
        if (!selectedItems || selectedItems.size === 0) return;

        const requestedSelectedRecords = displayedSales.filter(item => {
            const isSelected = selectedItems.has(item._id);
            const statusLow = (item.status || '').toLowerCase();
            const isReq = statusLow.includes('requested') || item.isEdited === true;
            return isSelected && isReq;
        });

        if (requestedSelectedRecords.length === 0) {
            setConfirmModalConfig({
                title: 'No Pending Requests Selected',
                message: requestedCount > 0 
                    ? `The selected items are already approved. You have ${requestedCount} pending request(s) waiting for approval.`
                    : 'The selected items are already approved and there are no pending requests.',
                type: 'info',
                confirmText: requestedCount > 0 ? `Switch to Requested (${requestedCount})` : 'OK',
                cancelText: requestedCount > 0 ? 'Close' : null,
                onConfirm: () => {
                    setConfirmModalConfig(null);
                    if (requestedCount > 0) {
                        setIsRequestedOnly(true);
                        setSelectedItems(new Set());
                    }
                },
                onClose: () => setConfirmModalConfig(null)
            });
            return;
        }

        setConfirmModalConfig({
            title: 'Confirm Bulk Accept',
            message: `Are you sure you want to accept ${requestedSelectedRecords.length} selected ${saleType === 'Border' ? 'Border Sale' : 'Sale'} request(s)?`,
            type: 'success',
            confirmText: 'Accept Selected',
            cancelText: 'Cancel',
            onConfirm: () => executeBulkAccept(requestedSelectedRecords),
            onClose: () => setConfirmModalConfig(null)
        });
    };

    const executeBulkReject = async (recordsToReject) => {
        try {
            setIsSubmitting(true);
            setConfirmModalConfig(null);

            const actionBy = currentUser ? (currentUser.name || currentUser.username || '') : '';
            const now = new Date();
            const dateStr = formatDate(now);
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const adminName = currentUser?.name || currentUser?.username || 'Admin';

            for (const sale of recordsToReject) {
                const { _id, createdAt: _createdAt, ...rest } = sale;
                const updatedData = {
                    ...rest,
                    status: 'Rejected',
                    isEdited: false,
                    rejectedBy: actionBy,
                };

                await axios.put(`${API_BASE_URL}/api/sales/${_id}`, updatedData);

                if (addNotification) {
                    try {
                        const requesterName = sale.requestedBy || sale.requestedByUsername || 'an employee';
                        const sType = saleType === 'Border' ? 'Border Sale' : 'General Sale';

                        const targetRoles = ['admin', 'incharge', 'sales manager'];
                        const targetUsers = [sale.requestedByUsername].filter(Boolean);
                        if (!targetUsers.includes('admin')) targetUsers.push('admin');

                        await addNotification(
                            `${sType} Rejected`,
                            `${dateStr} | ${timeStr} | ${adminName} has rejected the ${sType.toLowerCase()} entry (${sale.invoiceNo || 'No Invoice'}) requested by ${requesterName}`,
                            targetRoles,
                            targetUsers
                        );
                    } catch (err) {
                        console.error('Error sending bulk reject notification:', err);
                    }
                }
            }

            setSelectedItems(new Set());
            if (setIsSelectionMode) setIsSelectionMode(false);
            try { fetchSales(); } catch (e) { console.error('fetchSales error', e); }
            try { fetchCustomers(); } catch (e) { console.error('fetchCustomers error', e); }
            try { fetchWarehouses(); } catch (e) { console.error('fetchWarehouses error', e); }
            try { fetchStockRecords(); } catch (e) { console.error('fetchStockRecords error', e); }
            if (refreshPendingIndicators) refreshPendingIndicators();
        } catch (error) {
            console.error('Error performing bulk reject:', error);
            setConfirmModalConfig({
                title: 'Operation Failed',
                message: 'Failed to reject selected items.',
                type: 'danger',
                confirmText: 'OK',
                onConfirm: () => setConfirmModalConfig(null)
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBulkReject = () => {
        if (!selectedItems || selectedItems.size === 0) return;

        const requestedSelectedRecords = displayedSales.filter(item => {
            const isSelected = selectedItems.has(item._id);
            const statusLow = (item.status || '').toLowerCase();
            const isReq = statusLow.includes('requested') || item.isEdited === true;
            return isSelected && isReq;
        });

        if (requestedSelectedRecords.length === 0) {
            setConfirmModalConfig({
                title: 'No Pending Requests Selected',
                message: requestedCount > 0 
                    ? `The selected items are already processed. You have ${requestedCount} pending request(s) waiting for approval.`
                    : 'The selected items are already processed and there are no pending requests.',
                type: 'info',
                confirmText: requestedCount > 0 ? `Switch to Requested (${requestedCount})` : 'OK',
                cancelText: requestedCount > 0 ? 'Close' : null,
                onConfirm: () => {
                    setConfirmModalConfig(null);
                    if (requestedCount > 0) {
                        setIsRequestedOnly(true);
                        setSelectedItems(new Set());
                    }
                },
                onClose: () => setConfirmModalConfig(null)
            });
            return;
        }

        setConfirmModalConfig({
            title: 'Confirm Bulk Reject',
            message: `Are you sure you want to reject ${requestedSelectedRecords.length} selected ${saleType === 'Border' ? 'Border Sale' : 'Sale'} request(s)?`,
            type: 'danger',
            confirmText: 'Reject Selected',
            cancelText: 'Cancel',
            onConfirm: () => executeBulkReject(requestedSelectedRecords),
            onClose: () => setConfirmModalConfig(null)
        });
    };

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const renderSortIcon = (key) => {
        if (sortConfig.key !== key) {
            return <ChevronDownIcon className="w-3 h-3 ml-1 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
        }
        return sortConfig.direction === 'desc' ?
            <ChevronDownIcon className="w-3 h-3 ml-1 text-blue-600" /> :
            <ChevronUpIcon className="w-3 h-3 ml-1 text-blue-600" />;
    };

    const isFullAdmin = useMemo(() => {
        if (!currentUser) return false;
        return currentUser.username === 'admin' || (currentUser.role || '').toLowerCase() === 'admin';
    }, [currentUser]);

    const isIncharge = useMemo(() => {
        if (!currentUser) return false;
        return (currentUser.role || '').toLowerCase() === 'incharge';
    }, [currentUser]);

    const isSalesManager = useMemo(() => {
        if (!currentUser) return false;
        return (currentUser.role || '').toLowerCase() === 'sales manager';
    }, [currentUser]);

    const isBorderManager = useMemo(() => {
        if (!currentUser) return false;
        return (currentUser.role || '').toLowerCase() === 'border manager';
    }, [currentUser]);

    const moduleKey = saleType === 'Border' ? 'borderSale' : (saleType === 'Order' ? 'order' : (saleType === 'Purchase' ? 'purchase' : 'sales'));
    const canApprove = hasPermission(currentUser, moduleKey, 'special');
    const canViewSaleRequest = hasPermission(currentUser, moduleKey, 'saleRequest');
    const canViewEditRequest = hasPermission(currentUser, moduleKey, 'editRequest');

    // Fine-grained permission flags from System Access
    const canAdd = hasPermission(currentUser, moduleKey, 'add');
    const canEdit = hasPermission(currentUser, moduleKey, 'edit');
    const canDelete = hasPermission(currentUser, moduleKey, 'delete');

    const canUserEditSale = (sale) => {
        if (!sale) return false;
        const sStatus = (sale.status || '').toLowerCase();
        if (sStatus === 'requested') {
            const owner = sale.requestedByUsername || sale.createdByName || sale.createdByUsername || sale.createdBy;
            const currentUsername = currentUser ? currentUser.username : null;
            if (owner && currentUsername && owner.toString().toLowerCase() === currentUsername.toString().toLowerCase()) {
                return true;
            }
            if (isFullAdmin || canEdit) return true;
        }
        if (!canEdit && !isFullAdmin) return false;
        return true;
    };

    const canUserDeleteSale = (sale) => {
        if (sale && (sale.status || '').toLowerCase() === 'requested') return false;
        return canDelete;
    };

    const canViewSale = (sale) => {
        return true;
    };

    const canEditRequestedSale = (sale) => {
        if (!currentUser || !sale) return false;
        if (currentUser.username === 'admin' || isFullAdmin || canEdit) return true;
        const owner = sale.requestedByUsername || sale.createdByName || sale.createdByUsername || sale.createdBy;
        const currentUsername = currentUser.username;
        return !!(owner && currentUsername && owner.toString().toLowerCase() === currentUsername.toString().toLowerCase());
    };

    const isFieldReadOnly = (value) => {
        if (isFullAdmin || canEdit) return false;
        if (!editingId) return false; // New entries are always editable
        if (formData && (formData.status || '').toLowerCase() === 'requested') {
            const owner = formData.requestedByUsername || formData.createdByName || formData.createdByUsername || formData.createdBy;
            const currentUsername = currentUser ? currentUser.username : null;
            if (owner && currentUsername && owner.toString().toLowerCase() === currentUsername.toString().toLowerCase()) {
                return false;
            }
        }
        if (value === null || value === undefined) return false;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') return value.trim() !== '' && value.trim() !== '0';
        return !!value;
    };

    async function fetchExporters() {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/exporters`);
            setExportersList(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching exporters:', error);
        }
    };

    useEffect(() => {
        if (saleType === 'Border') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchExporters();
        }
    }, [saleType]);


    const processSaleEffects = async (saleData, isEditing = false) => {
        // Exclude Order bookings (saleType === 'Order' or ORD...) from customer sales history
        if (saleData.saleType === 'Order' || (saleData.invoiceNo || '').startsWith('ORD')) {
            return;
        }
        // Resolve Customer ID if missing or match directly by Customer ID
        let targetCustomerId = saleData.customerId;
        let matchedCustomer = null;

        if (targetCustomerId) {
            matchedCustomer = customers.find(c =>
                c._id === targetCustomerId || c.customerId === targetCustomerId
            );
        }

        if (!matchedCustomer && (saleData.companyName || saleData.customerName)) {
            const cleanComp = (saleData.companyName || '').trim().toLowerCase();
            const cleanCust = (saleData.customerName || '').trim().toLowerCase();

            matchedCustomer = customers.find(c => {
                const compMatch = cleanComp && (c.companyName || '').trim().toLowerCase() === cleanComp;
                const custMatch = cleanCust && (c.customerName || '').trim().toLowerCase() === cleanCust;
                return compMatch && custMatch;
            }) || customers.find(c =>
                cleanComp && (c.companyName || '').trim().toLowerCase() === cleanComp
            ) || customers.find(c =>
                cleanCust && (c.customerName || '').trim().toLowerCase() === cleanCust
            );
        }

        if (matchedCustomer) {
            targetCustomerId = matchedCustomer._id;
        }

        // Update Customer History
        if (targetCustomerId) {
            try {
                const custRes = await axios.get(`${API_BASE_URL}/api/customers/${targetCustomerId}`);
                const customer = custRes.data;

                const newSaleEntries = [];
                (saleData.items || []).forEach((product, pIdx) => {
                    (product.brandEntries || []).forEach((entry, eIdx) => {
                        const isFirstEntry = pIdx === 0 && eIdx === 0;
                        newSaleEntries.push({
                            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            date: saleData.date,
                            invoiceNo: saleData.invoiceNo,
                            lcNo: saleData.lcNo || '',
                            product: product.productName || '',
                            brand: entry.brand || '',
                            quantity: entry.quantity || 0,
                            rate: entry.unitPrice || 0,
                            truck: entry.truck || '',
                            amount: entry.totalAmount || 0,
                            paid: isFirstEntry ? (parseFloat(saleData.paidAmount) || 0) : 0,
                            due: isFirstEntry ? (parseFloat(saleData.dueAmount) || 0) : (entry.totalAmount || 0),
                            discount: isFirstEntry ? (parseFloat(saleData.discount) || 0) : 0,
                            warehouse: entry.warehouseName || '',
                            requestedBy: saleData.requestedBy || '',
                            requestedByUsername: saleData.requestedByUsername || '',
                            acceptedBy: saleData.acceptedBy || '',
                            status: 'Pending'
                        });
                    });
                });

                let baseHistory = customer.salesHistory || [];
                // Always filter out any existing entries with matching invoiceNo or orderNo to prevent duplicates on edit/acceptance
                const targetInv = (saleData.invoiceNo || '').trim().toLowerCase();
                const targetOrd = (saleData.orderNo || '').trim().toLowerCase();

                baseHistory = baseHistory.filter(item => {
                    const itemInv = (item.invoiceNo || '').trim().toLowerCase();
                    const itemOrd = (item.orderNo || '').trim().toLowerCase();
                    if (targetInv && itemInv === targetInv) return false;
                    if (targetOrd && itemOrd && itemOrd === targetOrd) return false;
                    if (targetOrd && itemInv && itemInv === targetOrd) return false;
                    return true;
                });

                const updatedCustomer = {
                    ...customer,
                    salesHistory: [...newSaleEntries, ...baseHistory]
                };

                await axios.put(`${API_BASE_URL}/api/customers/${targetCustomerId}`, updatedCustomer);

                // Clean up old entries from other customers if customer was changed during edit
                if (targetInv) {
                    customers.forEach(async (c) => {
                        if (c._id !== targetCustomerId && c.salesHistory && Array.isArray(c.salesHistory)) {
                            const hasInv = c.salesHistory.some(h => (h.invoiceNo || '').trim().toLowerCase() === targetInv);
                            if (hasInv) {
                                const cleanedHistory = c.salesHistory.filter(h => (h.invoiceNo || '').trim().toLowerCase() !== targetInv);
                                try {
                                    await axios.put(`${API_BASE_URL}/api/customers/${c._id}`, {
                                        ...c,
                                        salesHistory: cleanedHistory
                                    });
                                } catch (e) { }
                            }
                        }
                    });
                }
            } catch (err) {
                console.error('Error updating customer history:', err);
            }
        }

        // Border Sale: Auto-deduct sold Qty from matching warehouse records
        if (saleData.saleType === 'Border') {
            try {
                const whRes = await axios.get(`${API_BASE_URL}/api/warehouses`);
                const liveWarehouses = Array.isArray(whRes.data) ? whRes.data : [];

                const deductions = {};
                (saleData.items || []).forEach(product => {
                    const soldProductName = (product.productName || '').trim().toLowerCase();
                    (product.brandEntries || []).forEach(entry => {
                        const soldQty = parseFloat(entry.quantity) || 0;
                        if (soldQty === 0) return;

                        const matchingWh = liveWarehouses.find(wh => {
                            const whProduct = (wh.productName || wh.product || '').trim().toLowerCase();
                            return whProduct === soldProductName;
                        });

                        if (matchingWh) {
                            if (!deductions[matchingWh._id]) {
                                deductions[matchingWh._id] = { wh: matchingWh, totalDeduct: 0 };
                            }
                            deductions[matchingWh._id].totalDeduct += soldQty;
                        }
                    });
                });

                await Promise.all(
                    Object.values(deductions).map(async ({ wh, totalDeduct }) => {
                        const currentQty = parseFloat(wh.whQty) || 0;
                        const updatedWh = {
                            ...wh,
                            whQty: Math.max(0, currentQty - totalDeduct).toString()
                        };
                        await axios.put(`${API_BASE_URL}/api/warehouses/${wh._id}`, updatedWh);
                    })
                );
            } catch (err) {
                console.error('Error auto-deducting warehouse stock:', err);
            }
        }
    };

    const handleStatusUpdate = async (sale, newStatus) => {
        try {
            setIsSubmitting(true);
            const actionBy = currentUser ? (currentUser.name || currentUser.username || '') : '';
            const actionUsername = currentUser ? (currentUser.username || '') : '';
            const { _id, createdAt: _createdAt, ...rest } = sale;

            const finalStatus = newStatus === 'accepted'
                ? ((parseFloat(sale.paidAmount || 0) >= parseFloat(sale.totalAmount || 0) && parseFloat(sale.totalAmount || 0) > 0) ? 'Complete' : 'Pending')
                : newStatus;

            const isEditAcceptance = sale.isEdited === true || (sale.status || '').toLowerCase() === 'edit_requested';

            const updatedData = {
                ...rest,
                status: finalStatus,
                isEdited: false,
                ...(newStatus === 'Pending' || newStatus === 'accepted' ? {
                    acceptedBy: sale.acceptedBy || actionBy,
                    acceptedByUsername: sale.acceptedByUsername || actionUsername,
                    approvedBy: sale.approvedBy || actionBy,
                    approvedByName: sale.approvedByName || actionBy,
                    approvedByUsername: sale.approvedByUsername || actionUsername,
                    ...(isEditAcceptance ? {
                        editApprovedBy: actionBy,
                        editApprovedByName: actionBy,
                        editApprovedByUsername: actionUsername
                    } : {})
                } : {}),
                ...(newStatus === 'Rejected' ? { rejectedBy: actionBy } : {}),
            };

            const response = await axios.put(`${API_BASE_URL}/api/sales/${_id}`, updatedData);

            if (response.status >= 200 && response.status < 300) {
                if (newStatus === 'accepted') {
                    try {
                        await processSaleEffects(updatedData, false);
                    } catch (err) {
                        alert(`Successfully updated status, but failed to process warehouse/customer effects: ${err.message}`);
                    }
                }

                if (addNotification) {
                    try {
                        const now = new Date();
                        const dateStr = formatDate(now);
                        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const adminName = currentUser?.name || currentUser?.username || 'Admin';
                        const statusLabel = newStatus === 'accepted' ? 'Accepted' : (newStatus === 'Pending' ? 'Pending' : newStatus);
                        const actionLabel = newStatus === 'accepted' ? 'accepted' : (newStatus === 'Pending' ? 'set to pending' : 'rejected');
                        const requesterName = sale.requestedBy || sale.requestedByUsername || 'an employee';
                        const sType = saleType === 'Border' ? 'Border Sale' : 'General Sale';

                        const targetRoles = ['admin', 'incharge', 'sales manager'];
                        const targetUsers = [sale.requestedByUsername].filter(Boolean);
                        // Explicitly include 'admin' username to be sure they get it regardless of role filter
                        if (!targetUsers.includes('admin')) targetUsers.push('admin');

                        console.log(`[handleStatusUpdate] Calling addNotification for ${sType} ${statusLabel}`);
                        await addNotification(
                            `${sType} ${statusLabel}`,
                            `${dateStr} | ${timeStr} | ${adminName} has ${actionLabel} the ${sType.toLowerCase()} entry (${sale.invoiceNo}) requested by ${requesterName}`,
                            targetRoles,
                            targetUsers
                        );
                        console.log(`[handleStatusUpdate] addNotification successful.`);
                    } catch (err) {
                        console.error(`[handleStatusUpdate] Error in addNotification:`, err);
                    }
                }

                console.log(`[handleStatusUpdate] Re-fetching data...`);
                try { fetchSales(); } catch (e) { console.error('fetchSales error', e); }
                try { fetchCustomers(); } catch (e) { console.error('fetchCustomers error', e); }
                try { fetchWarehouses(); } catch (e) { console.error('fetchWarehouses error', e); }
                try { fetchStockRecords(); } catch (e) { console.error('fetchStockRecords error', e); }
                if (refreshPendingIndicators) refreshPendingIndicators();
                console.log(`[handleStatusUpdate] Update successfully finished!`);
            } else {
                console.warn(`[handleStatusUpdate] Unexpected response status:`, response.status);
                alert(`Status update returned unexpected status code: ${response.status}`);
            }
        } catch (error) {
            console.error(`Error updating sale status to ${newStatus}:`, error);
            alert(`Failed to update status to ${newStatus}. See console for details: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
            console.log(`[handleStatusUpdate] Submitting state reset to false.`);
        }
    };
    const saleFilterRef = useRef(null);
    const saleFilterButtonRef = useRef(null);
    const saleCompanyFilterRef = useRef(null);
    const saleInvoiceFilterRef = useRef(null);
    const salePortFilterRef = useRef(null);
    const saleProductFilterRef = useRef(null);
    const saleIndCnfFilterRef = useRef(null);
    const saleBdCnfFilterRef = useRef(null);
    const saleFromDateFilterRef = useRef(null);
    const saleToDateFilterRef = useRef(null);
    const saleBrandFilterRef = useRef(null);
    const lcRef = useRef(null);

    const toggleRowExpansion = (saleId) => {
        setCollapsedRows(prev =>
            prev.includes(saleId) ? prev.filter(id => id !== saleId) : [...prev, saleId]
        );
    };

    const activeFilterCount = Object.entries(saleFilters).filter(([key, val]) => {
        if (key === 'quickRange') return val !== 'all' && val !== 'monthly' && val !== 'custom' && val !== '';
        if (key === 'selectedMonth' || key === 'selectedYear') return false;
        return val !== '';
    }).length;

    const hasActiveFilters = activeFilterCount > 0;

    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if the click is on an element that is still in the document
            // If the element is detached (e.g., a selection item that just got removed),
            // don't close the panel.
            if (event.target && !document.body.contains(event.target)) {
                return;
            }

            if (
                showSaleFilterPanel &&
                saleFilterRef.current &&
                !saleFilterRef.current.contains(event.target) &&
                saleFilterButtonRef.current &&
                !saleFilterButtonRef.current.contains(event.target)
            ) {
                setShowSaleFilterPanel(false);
            }
            if (activeFilterDropdown) {
                // Determine if click was inside any specific filter container
                const inCompany = saleCompanyFilterRef.current?.contains(event.target);
                const inInvoice = saleInvoiceFilterRef.current?.contains(event.target);
                const inPort = salePortFilterRef.current?.contains(event.target);
                const inProduct = saleProductFilterRef.current?.contains(event.target);
                const inBrand = saleBrandFilterRef.current?.contains(event.target);
                const inIndCnf = saleIndCnfFilterRef.current?.contains(event.target);
                const inBdCnf = saleBdCnfFilterRef.current?.contains(event.target);
                const inFromDate = saleFromDateFilterRef.current?.contains(event.target);
                const inToDate = saleToDateFilterRef.current?.contains(event.target);
                const inLc = lcRef.current?.contains(event.target);

                if (
                    (activeFilterDropdown === 'company' && !inCompany) ||
                    (activeFilterDropdown === 'invoice' && !inInvoice) ||
                    (activeFilterDropdown === 'port' && !inPort) ||
                    (activeFilterDropdown === 'product' && !inProduct) ||
                    (activeFilterDropdown === 'brand' && !inBrand) ||
                    (activeFilterDropdown === 'indCnf' && !inIndCnf) ||
                    (activeFilterDropdown === 'bdCnf' && !inBdCnf) ||
                    (activeFilterDropdown === 'from' && !inFromDate) ||
                    (activeFilterDropdown === 'to' && !inToDate) ||
                    (activeDropdown === 'lcNo' && !inLc)
                ) {
                    setActiveFilterDropdown(null);
                }
            }
            if (activePdfDropdown && !event.target.closest('.sale-pdf-dropdown-container')) {
                setActivePdfDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showSaleFilterPanel, activeFilterDropdown, activePdfDropdown]);

    // Scroll Lock when Filter Panel is active
    useEffect(() => {
        if (showSaleFilterPanel) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [showSaleFilterPanel]);

    const [formData, setFormData] = useState({
        date: '',
        invoiceNo: '',
        orderNo: '',
        challanNo: '',
        truckNo: '',
        customerId: '',
        companyName: '',
        customerName: '',
        address: '',
        lcNo: '',
        contact: '',
        importer: '',
        port: '',
        indianCnF: '',
        bdCnf: '',
        truck: '',
        items: [{
            productId: '',
            productName: '',
            uom: saleType === 'General' ? 'QTY' : 'Truck',
            brandEntries: [{
                lcNo: '',
                brand: '',
                brandName: '',
                inhouseQty: '',
                warehouseId: '',
                warehouseName: '',
                warehouseQty: '',
                quantity: '',
                truck: '',
                uom: saleType === 'General' ? 'QTY' : 'Truck',
                unitPrice: '',
                totalAmount: ''
            }]
        }],
        currentTotalTrucks: 0,
        currentTotalQty: 0,
        indCommissionRate: '',
        indCommissionUom: 'Truck',
        indCommissionTotal: '0.00',
        bdCommissionRate: '',
        bdCommissionUom: 'Truck',
        bdCommissionTotal: '0.00',
        indCommissionEdited: false,
        bdCommissionEdited: false,
        totalAmount: '0.00',
        discount: '0.00',
        paidAmount: '0.00',
        dueAmount: '0.00',
        paymentMethod: 'Cash',
        status: 'Requested',
        saleType: saleType, // Initialize with prop value
        previousBalance: '0.00',
        requestedBy: currentUser?.name || currentUser?.username || '',
        requestedByUsername: currentUser?.username || ''
    });
    const [damagesRecords, setDamagesRecords] = useState([]);

    useEffect(() => {
        fetchSales();
        fetchCustomers();
        fetchProducts();
        fetchWarehouses();
        fetchStockRecords();
        fetchDamagesRecords();
        fetchImportersList();
        fetchPortsList();
        fetchCnfsList();
        fetchLCRecords();
        fetchEmployees();
    }, [saleType]); // Refetch if saleType changes

    async function fetchLCRecords() {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/lc-management`);
            setLcRecords(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching LC records:', error);
        }
    };

    // Reset filters when switching between General and Border sales
    useEffect(() => {
        if (setSaleFilters) {
            setSaleFilters({
                quickRange: 'monthly',
                selectedMonth: new Date().getMonth() + 1,
                selectedYear: new Date().getFullYear(),
                startDate: '',
                endDate: '',
                companyName: '',
                invoiceNo: '',
                port: '',
                productName: '',
                brand: '',
                indCnf: '',
                bdCnf: ''
            });
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (setSearchQuery) setSearchQuery('');
        if (saleType === 'Order') {
            setIsRequestedOnly(true);
        } else {
            setIsRequestedOnly(false);
        }
        setIsEditRequestedOnly(false);
    }, [saleType, setSaleFilters, setSearchQuery]);

    const _generateInvoiceNo = () => {
        const prefix = saleType === 'Border' ? 'BS' : 'GS';
        // Extract all numeric parts from invoice numbers starting with the same prefix
        const numbers = [];
        let maxDigits = 4;
        allSalesRecords
            .filter(s => {
                const st = (s.status || '').toLowerCase();
                if (saleType === 'Order') return st === 'requested' && (s.invoiceNo || '').startsWith(prefix);
                return st !== 'rejected' && st !== 'cancelled' && (s.invoiceNo || '').startsWith(prefix);
            })
            .forEach(s => {
                const match = (s.invoiceNo || '').match(/\d+/);
                if (match) {
                    numbers.push(parseInt(match[0], 10));
                    if (match[0].length > maxDigits) maxDigits = match[0].length;
                }
            });
        const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
        return `${prefix}${nextNum.toString().padStart(maxDigits, '0')}`;
    };

    /* Moved to backend for better uniqueness
    useEffect(() => {
        if (showForm && !editingId && allSalesRecords.length >= 0) {
            setFormData(prev => ({ ...prev, invoiceNo: generateInvoiceNo() }));
        }
    }, [showForm, editingId, saleType, allSalesRecords]);
    */

    async function fetchSales() {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/sales`);
            const decryptedSales = Array.isArray(response.data) ? response.data : [];

            setAllSalesRecords(decryptedSales);

            // Filter by saleType
            const filteredSales = decryptedSales.filter(s => {
                const sTypeLow = (s.saleType || '').toLowerCase().trim();
                const invUpper = (s.invoiceNo || s.orderNo || '').toUpperCase();
                const isOrderRecord = sTypeLow === 'order' || invUpper.startsWith('ORD') || s.isOrderEntry === true;

                if (isOrderRecord && saleType !== 'Order') return false;

                const isBorder = sTypeLow === 'border' || sTypeLow === 'border sale' ||
                    invUpper.startsWith('BS') ||
                    (!s.saleType && !!(s.lcNo || s.port || s.importer));

                if (saleType === 'Order') {
                    return isOrderRecord;
                }
                if (saleType === 'General') {
                    return !isBorder && !isOrderRecord && (sTypeLow === 'general' || sTypeLow === 'general sale' || !s.saleType || invUpper.startsWith('GS'));
                }
                if (saleType === 'Border') {
                    return isBorder && !isOrderRecord;
                }
                return sTypeLow === saleType.toLowerCase();
            });

            setSales(filteredSales);
            if (fetchSalesGlobal) {
                fetchSalesGlobal();
            }
        } catch (error) {
            console.error('Error fetching sales:', error);
        } finally {
            setIsLoading(false);
        }
    };

    async function fetchCustomers() {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/customers`);
            setCustomers(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching customers:', error);
        }
    };

    async function fetchProducts() {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/products`);
            setProducts(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };
    async function fetchWarehouses() {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/warehouses`);
            const list = Array.isArray(response.data) ? response.data : [];
            const decrypted = list.map(item => {
                let d = item.data ? decryptData(item.data) : item;
                if (typeof d === 'string') { try { d = decryptData(d); } catch (e) { } }
                if (d && typeof d === 'object' && d.data && typeof d.data === 'string') {
                    try { d = decryptData(d.data); } catch (e) { }
                }
                return d && typeof d === 'object' ? { ...d, _id: item._id } : item;
            });
            setWarehouses(decrypted);
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };

    async function fetchStockRecords() {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/stock`);
            const list = Array.isArray(response.data) ? response.data : [];
            const decrypted = list.map(item => {
                let d = item.data ? decryptData(item.data) : item;
                if (typeof d === 'string') { try { d = decryptData(d); } catch (e) { } }
                if (d && typeof d === 'object' && d.data && typeof d.data === 'string') {
                    try { d = decryptData(d.data); } catch (e) { }
                }
                return d && typeof d === 'object' ? { ...d, _id: item._id } : item;
            });
            setStockRecords(decrypted);
        } catch (error) {
            console.error('Error fetching stock records:', error);
        }
    };

    async function fetchDamagesRecords() {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/damages`);
            const list = Array.isArray(response.data) ? response.data : [];
            const decrypted = list.map(item => {
                let d = item.data ? decryptData(item.data) : item;
                if (typeof d === 'string') { try { d = decryptData(d); } catch (e) { } }
                if (d && typeof d === 'object' && d.data && typeof d.data === 'string') {
                    try { d = decryptData(d.data); } catch (e) { }
                }
                return d && typeof d === 'object' ? { ...d, _id: item._id } : item;
            });
            setDamagesRecords(decrypted);
        } catch (error) {
            console.error('Error fetching damages records:', error);
        }
    };

    async function fetchImportersList() {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/importers`);
            setImportersList(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching importers:', error);
        }
    };

    async function fetchPortsList() {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/ports`);
            setPortsList(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching ports:', error);
        }
    };

    async function fetchCnfsList() {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/cnfs`);
            setCnfsList(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching C&Fs:', error);
        }
    };

    const [activeItemIndex, setActiveItemIndex] = useState(null);
    const [activeEntryIndex, setActiveEntryIndex] = useState(null);

    // Helper to calculate inhouse and warehouse saleable stock for an entry
    const getStockForEntry = (pName, bName, lcNo, whName, isBagUom) => {
        let inhouseSaleable = 0;
        let whSaleable = 0;
        const cleanPName = (pName || '').trim();
        if (!cleanPName) return { inhouseQty: '0', warehouseQty: '' };

        const salesForCalc = editingId
            ? allSalesRecords.filter(s => s._id !== editingId && s.invoiceNo !== formData.invoiceNo && s.orderNo !== formData.orderNo)
            : allSalesRecords;

        const cleanBrand = (bName || '').trim();
        const cleanLc = (lcNo || '').trim();

        // 1. Overall inhouse stock across all warehouses
        const stockFilters = {
            productName: cleanPName,
            brand: cleanBrand || undefined,
            reportType: 'price'
        };
        const stockRes = calculateStockData(
            stockRecords,
            stockFilters,
            '',
            warehouses,
            salesForCalc,
            products,
            damagesRecords
        );
        const calculatedStock = stockRes?.displayRecords || [];
        const matchedGroup = calculatedStock.find(g => (g.productName || '').trim().toLowerCase() === cleanPName.toLowerCase());
        if (matchedGroup && matchedGroup.brandList) {
            const targetBrandLower = cleanBrand.toLowerCase();
            let targetBrands = matchedGroup.brandList;
            if (targetBrandLower) {
                targetBrands = targetBrands.filter(b => (b.brand || '').trim().toLowerCase() === targetBrandLower);
            }
            if (cleanLc) {
                targetBrands = targetBrands.filter(b => isLcMatch(b.lcNo, cleanLc));
            }
            inhouseSaleable = targetBrands.reduce((sum, b) => {
                return sum + (isBagUom ? (b.saleablePacket || 0) : (b.saleableQuantity || 0));
            }, 0);
        }

        // 2. Warehouse specific stock
        const cleanWhName = (whName || '').trim();
        if (cleanWhName) {
            const whStockFilters = {
                productName: cleanPName,
                brand: cleanBrand || undefined,
                warehouse: cleanWhName,
                reportType: 'price'
            };
            const whStockRes = calculateStockData(
                stockRecords,
                whStockFilters,
                '',
                warehouses,
                salesForCalc,
                products,
                damagesRecords
            );
            const calculatedWhStock = whStockRes?.displayRecords || [];
            const matchedWhGroup = calculatedWhStock.find(g => (g.productName || '').trim().toLowerCase() === cleanPName.toLowerCase());
            if (matchedWhGroup && matchedWhGroup.brandList) {
                const targetBrandLower = cleanBrand.toLowerCase();
                let targetBrands = matchedWhGroup.brandList;
                if (targetBrandLower) {
                    targetBrands = targetBrands.filter(b => (b.brand || '').trim().toLowerCase() === targetBrandLower);
                }
                if (cleanLc) {
                    targetBrands = targetBrands.filter(b => isLcMatch(b.lcNo, cleanLc));
                }
                whSaleable = targetBrands.reduce((sum, b) => {
                    return sum + (isBagUom ? (b.saleablePacket || 0) : (b.saleableQuantity || 0));
                }, 0);
            }
        }

        return {
            inhouseQty: Number(Math.max(0, inhouseSaleable).toFixed(2)).toString(),
            warehouseQty: cleanWhName ? Number(Math.max(0, whSaleable).toFixed(2)).toString() : ''
        };
    };

    // Refetch latest stock and warehouse data whenever the modal opens
    useEffect(() => {
        if (showForm) {
            fetchWarehouses();
            fetchStockRecords();
            fetchDamagesRecords();
            fetchSales();
        }
    }, [showForm]);

    // Recalculate and update Inhouse & Warehouse Saleable stock for all brand entries in formData
    useEffect(() => {
        if (!formData.items || formData.items.length === 0) return;

        setFormData(prev => {
            let hasChanges = false;
            const newItems = prev.items.map(item => {
                if (!item.productId && !item.productName) return item;

                const isBagUom = item.uom === 'BAG';
                const pName = (item.productName || '').trim();
                if (!pName) return item;

                let itemChanged = false;
                const newBrandEntries = item.brandEntries.map(entry => {
                    let updatedEntry = { ...entry };
                    const bName = (entry.brand || entry.brandName || '').trim();
                    const lcNo = (entry.lcNo || '').trim();
                    const whName = (entry.warehouseName || '').trim();

                    const stockInfo = getStockForEntry(pName, bName, lcNo, whName, isBagUom);

                    if (updatedEntry.inhouseQty !== stockInfo.inhouseQty) {
                        updatedEntry.inhouseQty = stockInfo.inhouseQty;
                        itemChanged = true;
                    }
                    if (updatedEntry.warehouseQty !== stockInfo.warehouseQty) {
                        updatedEntry.warehouseQty = stockInfo.warehouseQty;
                        itemChanged = true;
                    }

                    return updatedEntry;
                });

                if (itemChanged) {
                    hasChanges = true;
                    return { ...item, brandEntries: newBrandEntries };
                }
                return item;
            });

            return hasChanges ? { ...prev, items: newItems } : prev;
        });
    }, [
        formData.items.map(i => `${i.productId}-${i.productName}-${i.uom}`).join(','),
        formData.items.map(i => i.brandEntries.map(e => `${e.brand}-${e.brandName}-${e.warehouseName}-${e.lcNo}`).join(',')).join('|'),
        stockRecords,
        warehouses,
        allSalesRecords,
        damagesRecords,
        editingId
    ]);

    const addProductItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, {
                productId: '',
                productName: '',
                uom: saleType === 'General' ? 'QTY' : 'Truck',
                brandEntries: [{
                    lcNo: '',
                    brand: '',
                    brandName: '',
                    inhouseQty: '',
                    warehouseId: '',
                    warehouseName: '',
                    warehouseQty: '',
                    quantity: '',
                    truck: '',
                    uom: saleType === 'General' ? 'QTY' : 'Truck',
                    unitPrice: '',
                    totalAmount: ''
                }]
            }]
        }));
    };

    const addBrandEntry = (productIdx) => {
        setFormData(prev => {
            const newItems = [...prev.items];
            newItems[productIdx] = {
                ...newItems[productIdx],
                brandEntries: [...newItems[productIdx].brandEntries, {
                    lcNo: '',
                    brand: '',
                    brandName: '',
                    inhouseQty: '',
                    warehouseId: '',
                    warehouseName: '',
                    warehouseQty: '',
                    quantity: '',
                    truck: '',
                    uom: newItems[productIdx].uom || (saleType === 'General' ? 'QTY' : 'Truck'),
                    unitPrice: '',
                    totalAmount: ''
                }]
            };
            return { ...prev, items: newItems };
        });
    };

    const removeProductItem = (index) => {
        if (formData.items.length <= 1) return;
        setFormData(prev => {
            const newItems = prev.items.filter((_, i) => i !== index);
            const subtotal = newItems.reduce((sum, product) =>
                sum + product.brandEntries.reduce((pSum, entry) => pSum + (parseFloat(entry.totalAmount) || 0), 0)
                , 0);
            const grandTotal = Math.max(0, subtotal - (parseFloat(prev.discount) || 0));
            return {
                ...prev,
                items: newItems,
                totalAmount: grandTotal.toFixed(2),
                dueAmount: (grandTotal - (parseFloat(prev.paidAmount) || 0)).toFixed(2)
            };
        });
    };

    const removeBrandEntry = (productIdx, entryIdx) => {
        setFormData(prev => {
            const newItems = [...prev.items];
            const product = { ...newItems[productIdx] };
            if (product.brandEntries.length <= 1) return prev; // Don't remove last brand row

            product.brandEntries = product.brandEntries.filter((_, i) => i !== entryIdx);
            newItems[productIdx] = product;

            const subtotal = newItems.reduce((sum, p) =>
                sum + p.brandEntries.reduce((eSum, e) => eSum + (parseFloat(e.totalAmount) || 0), 0)
                , 0);
            const grandTotal = Math.max(0, subtotal - (parseFloat(prev.discount) || 0));

            return {
                ...prev,
                items: newItems,
                totalAmount: grandTotal.toFixed(2),
                dueAmount: (grandTotal - (parseFloat(prev.paidAmount) || 0)).toFixed(2)
            };
        });
    };

    const handleItemInputChange = (productIdx, entryIdx, e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newItems = [...prev.items];
            const product = { ...newItems[productIdx] };

            if (entryIdx === null || entryIdx === undefined) {
                product[name] = value;
                if (name === 'uom' && prev.saleType !== 'Border') {
                    product.brandEntries = (product.brandEntries || []).map(entry => {
                        const qty = parseFloat(entry.quantity) || 0;
                        const bag = parseFloat(entry.bag) || 0;
                        const price = parseFloat(entry.unitPrice) || 0;

                        let total = 0;
                        if (value === 'BAG') {
                            total = bag * price;
                        } else {
                            total = qty * price;
                        }
                        return {
                            ...entry,
                            uom: value,
                            totalAmount: total.toFixed(2)
                        };
                    });
                }
            } else {
                const brandEntries = [...product.brandEntries];
                const entry = { ...brandEntries[entryIdx], [name]: value };

                // Synchronize brand and brandName for consistency
                if (name === 'brandName') {
                    entry.brand = value;
                } else if (name === 'brand') {
                    entry.brandName = value;
                }

                if (name === 'brandName' || name === 'brand' || name === 'warehouseName' || name === 'lcNo') {
                    const b = (name === 'brandName' || name === 'brand') ? value : (entry.brand || entry.brandName);
                    const w = name === 'warehouseName' ? value : entry.warehouseName;
                    const l = name === 'lcNo' ? value : entry.lcNo;
                    const stockInfo = getStockForEntry(product.productName, b, l, w, product.uom === 'BAG');
                    entry.inhouseQty = stockInfo.inhouseQty;
                    entry.warehouseQty = stockInfo.warehouseQty;
                }

                if (prev.saleType === 'Border') {
                    // Border Sale: Total depends on selected UOM (QTY or Truck)
                    if (name === 'truck' || name === 'quantity' || name === 'bag' || name === 'unitPrice' || name === 'uom') {
                        const activeUOM = name === 'uom' ? value : entry.uom;
                        const rawSize = entry.bagSize || entry.packetSize || product.packetSize || products.find(p => p._id === product.productId || (p.name || p.productName || '').toLowerCase().trim() === (product.productName || '').toLowerCase().trim())?.packetSize;
                        const bSize = parseFloat(String(rawSize || '').replace(/[^0-9.]/g, '')) || 30;

                        if (name === 'quantity' && bSize > 0) {
                            const valNum = parseFloat(value);
                            entry.bag = isNaN(valNum) || value === '' ? '' : Number.isInteger(valNum / bSize) ? (valNum / bSize).toString() : (valNum / bSize).toFixed(2);
                        } else if (name === 'bag' && bSize > 0) {
                            const valNum = parseFloat(value);
                            entry.quantity = isNaN(valNum) || value === '' ? '' : Number.isInteger(valNum * bSize) ? (valNum * bSize).toString() : (valNum * bSize).toFixed(2);
                        }

                        const qty = parseFloat(entry.quantity) || 0;
                        const truck = parseFloat(name === 'truck' ? value : entry.truck) || 0;
                        const price = parseFloat(name === 'unitPrice' ? value : entry.unitPrice) || 0;

                        if (activeUOM === 'QTY') {
                            entry.totalAmount = (qty * price).toFixed(2);
                        } else {
                            // Default to Truck
                            entry.totalAmount = (truck * price).toFixed(2);
                        }
                    }
                } else {
                    // General Sale: Total = Quantity * Price OR Bag * Price based on selected UOM
                    if (name === 'quantity' || name === 'bag' || name === 'unitPrice') {
                        const rawSize = entry.bagSize || entry.packetSize || product.packetSize || products.find(p => p._id === product.productId || (p.name || p.productName || '').toLowerCase().trim() === (product.productName || '').toLowerCase().trim())?.packetSize;
                        const bSize = parseFloat(String(rawSize || '').replace(/[^0-9.]/g, '')) || 30;

                        if (name === 'quantity' && bSize > 0) {
                            const valNum = parseFloat(value);
                            entry.bag = isNaN(valNum) || value === '' ? '' : Number.isInteger(valNum / bSize) ? (valNum / bSize).toString() : (valNum / bSize).toFixed(2);
                        } else if (name === 'bag' && bSize > 0) {
                            const valNum = parseFloat(value);
                            entry.quantity = isNaN(valNum) || value === '' ? '' : Number.isInteger(valNum * bSize) ? (valNum * bSize).toString() : (valNum * bSize).toFixed(2);
                        }

                        const activeUOM = product.uom || 'QTY';
                        const qty = parseFloat(entry.quantity) || 0;
                        const bag = parseFloat(entry.bag) || 0;
                        const price = parseFloat(name === 'unitPrice' ? value : entry.unitPrice) || 0;

                        if (activeUOM === 'BAG') {
                            entry.totalAmount = (bag * price).toFixed(2);
                        } else {
                            entry.totalAmount = (qty * price).toFixed(2);
                        }
                    }
                }

                brandEntries[entryIdx] = entry;
                product.brandEntries = brandEntries;
            }

            newItems[productIdx] = product;

            // Recalculate invoice totals and C&F commissions
            const subtotal = newItems.reduce((sum, p) =>
                sum + p.brandEntries.reduce((eSum, e) => eSum + (parseFloat(e.totalAmount) || 0), 0)
                , 0);

            const totalTrucks = newItems.reduce((sum, p) =>
                sum + (p.brandEntries || []).reduce((eSum, e) => eSum + (parseFloat(e.truck) || 0), 0)
                , 0);

            const totalQty = newItems.reduce((sum, p) =>
                sum + (p.brandEntries || []).reduce((eSum, e) => eSum + (parseFloat(e.quantity) || 0), 0)
                , 0);

            const indRate = parseFloat(prev.indCommissionRate) || 0;
            const bdRate = parseFloat(prev.bdCommissionRate) || 0;

            const indTotal = (prev.indCommissionUom === 'Truck' ? totalTrucks : totalQty) * indRate;
            const bdTotal = (prev.bdCommissionUom === 'Truck' ? totalTrucks : totalQty) * bdRate;

            const disc = parseFloat(prev.discount) || 0;
            const paid = parseFloat(prev.paidAmount) || 0;
            const grandTotal = Math.max(0, subtotal - disc);

            return {
                ...prev,
                items: newItems,
                currentTotalTrucks: totalTrucks,
                currentTotalQty: totalQty,
                indCommissionTotal: indTotal.toFixed(2),
                bdCommissionTotal: bdTotal.toFixed(2),
                totalAmount: grandTotal.toFixed(2),
                dueAmount: (grandTotal - paid).toFixed(2)
            };
        });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            let updatedFormData = { ...prev, [name]: value };

            if (name === 'paidAmount' || name === 'discount' || name.includes('Commission')) {
                const subtotal = prev.items.reduce(
                    (sum, i) => sum + (i.brandEntries || []).reduce((eSum, e) => eSum + (parseFloat(e.totalAmount) || 0), 0),
                    0
                );

                const totalTrucks = prev.items.reduce((sum, p) =>
                    sum + (p.brandEntries || []).reduce((eSum, e) => eSum + (parseFloat(e.truck) || 0), 0)
                    , 0);

                const totalQty = prev.items.reduce((sum, p) =>
                    sum + (p.brandEntries || []).reduce((eSum, e) => eSum + (parseFloat(e.quantity) || 0), 0)
                    , 0);

                const indRate = parseFloat(name === 'indCommissionRate' ? value : prev.indCommissionRate) || 0;
                const bdRate = parseFloat(name === 'bdCommissionRate' ? value : prev.bdCommissionRate) || 0;
                const indUom = name === 'indCommissionUom' ? value : prev.indCommissionUom;
                const bdUom = name === 'bdCommissionUom' ? value : prev.bdCommissionUom;

                const indTotal = (indUom === 'Truck' ? totalTrucks : totalQty) * indRate;
                const bdTotal = (bdUom === 'Truck' ? totalTrucks : totalQty) * bdRate;

                const disc = parseFloat(name === 'discount' ? value : prev.discount) || 0;
                const paid = parseFloat(name === 'paidAmount' ? value : prev.paidAmount) || 0;

                const grandTotal = Math.max(0, subtotal - disc);
                updatedFormData.totalAmount = grandTotal.toFixed(2);
                updatedFormData.dueAmount = (grandTotal - paid).toFixed(2);
                updatedFormData.indCommissionTotal = indTotal.toFixed(2);
                updatedFormData.bdCommissionTotal = bdTotal.toFixed(2);
                updatedFormData.currentTotalTrucks = totalTrucks;
                updatedFormData.currentTotalQty = totalQty;
            }
            return updatedFormData;
        });
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        const isRequestedEdit = formData && (formData.status || '').toLowerCase() === 'requested';
        const isOwner = isRequestedEdit && (() => {
            const owner = formData.requestedByUsername || formData.createdByName || formData.createdByUsername || formData.createdBy;
            const currentUsername = currentUser ? currentUser.username : null;
            return !!(owner && currentUsername && owner.toString().toLowerCase() === currentUsername.toString().toLowerCase());
        })();

        const hasAccess = editingId ? (canEdit || isFullAdmin || isOwner) : canAdd;
        if (!hasAccess) {
            alert(`Forbidden: You do not have permission to ${editingId ? 'edit' : 'add'} sales`);
            return;
        }

        if (saleType === 'Border') {
            if (!formData.indianCnF || !formData.indianCnF.trim()) {
                alert('IND C&F is required');
                return;
            }
            if (!formData.bdCnf || !formData.bdCnf.trim()) {
                alert('BD C&F is required');
                return;
            }
            if (!formData.companyName || !formData.companyName.trim()) {
                alert('Company Name is required');
                return;
            }
        }
        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const url = editingId ? `${API_BASE_URL}/api/sales/${editingId}` : `${API_BASE_URL}/api/sales`;

            let response;
            if (editingId) {
                const origStatus = (originalData?.status || '').toLowerCase();
                const isAcceptedEdit = origStatus !== 'requested';
                const isAdminUser = currentUser?.username === 'admin' || (currentUser?.role || '').toLowerCase() === 'admin';
                const editorName = currentUser ? (currentUser.name || currentUser.username || '') : '';
                const editorUsername = currentUser ? (currentUser.username || '') : '';
                const payload = {
                    ...formData,
                    isEdited: isAdminUser ? false : (isAcceptedEdit ? true : false),
                    editedBy: editorUsername || editorName,
                    editedByName: editorName || editorUsername,
                    editedByUsername: editorUsername,
                    ...(isAcceptedEdit ? {
                        editRequestedBy: editorName || editorUsername,
                        editRequestedByUsername: editorUsername
                    } : {})
                };
                response = await axios.put(url, payload);
            } else {
                response = await axios.post(url, formData);
            }

            if (response.status >= 200 && response.status < 300) {
                setSubmitStatus('success');

                const currentStatus = (formData.status || '').toLowerCase();
                const isRequested = currentStatus.includes('requested');

                if (addNotification && isRequested) {
                    const now = new Date();
                    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
                    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const employeeName = currentUser?.name || currentUser?.username || 'An employee';
                    const sType = saleType === 'Border' ? 'Border Sale' : 'General Sale';
                    const targetRoles = ['admin', 'incharge', 'sales manager'];
                    const targetUsers = [formData.requestedByUsername].filter(Boolean);
                    if (!targetUsers.includes('admin')) targetUsers.push('admin');

                    if (!editingId) {
                        const finalInvoiceNo = response.data?.invoiceNo || formData.invoiceNo || 'No Invoice';
                        await addNotification(
                            `New ${sType} Requested`,
                            `${dateStr} | ${timeStr} | ${employeeName} has requested a new ${sType.toLowerCase()} entry (${finalInvoiceNo})`,
                            targetRoles,
                            targetUsers
                        );
                    } else {

                        // Compare for detailed changes
                        const changedFields = [];
                        const fieldLabels = {
                            date: 'Date',
                            invoiceNo: 'Invoice',
                            companyName: 'Company',
                            customerName: 'Customer',
                            lcNo: 'LC No',
                            contact: 'Contact',
                            importer: 'Importer',
                            port: 'Port',
                            indianCnF: 'Indian C&F',
                            bdCnf: 'BD C&F',
                            truck: 'Truck',
                            discount: 'Discount',
                            paidAmount: 'Paid',
                            creditPeriod: 'Credit Period'
                        };

                        // Compare simple top-level fields
                        Object.keys(fieldLabels).forEach(field => {
                            if (originalData && String(formData[field]) !== String(originalData[field])) {
                                changedFields.push(fieldLabels[field]);
                            }
                        });

                        // Granular comparison of items (Price vs QTY)
                        let qtyChanged = false;
                        let rateChanged = false;

                        if (originalData && originalData.items) {
                            formData.items.forEach((item, pIdx) => {
                                const origItem = originalData.items[pIdx];
                                if (!origItem) {
                                    qtyChanged = true; // New item added
                                    return;
                                }

                                item.brandEntries.forEach((entry, eIdx) => {
                                    const origEntry = (origItem.brandEntries || [])[eIdx];
                                    if (!origEntry) {
                                        qtyChanged = true;
                                        return;
                                    }

                                    if (String(entry.quantity) !== String(origEntry.quantity)) qtyChanged = true;
                                    if (String(entry.unitPrice) !== String(origEntry.unitPrice)) rateChanged = true;
                                    if (entry.brand !== origEntry.brand || entry.warehouseName !== origEntry.warehouseName) {
                                        // If brand/warehouse changed, we just call it a QTY/Product update contextually
                                        qtyChanged = true;
                                    }
                                });
                            });

                            // Check if items were removed
                            if (formData.items.length < originalData.items.length) qtyChanged = true;
                        }

                        if (qtyChanged) changedFields.push('QTY');
                        if (rateChanged) changedFields.push('Price');

                        // Only check derived fields if root cause wasn't items
                        if (!qtyChanged && !rateChanged) {
                            if (originalData && formData.totalAmount !== originalData.totalAmount) changedFields.push('Price');
                            if (originalData && formData.dueAmount !== originalData.dueAmount) changedFields.push('Due');
                        }

                        const detailMsg = changedFields.length > 0
                            ? `\nUpdated fields: ${[...new Set(changedFields)].join(', ')}`
                            : '';

                        await addNotification(
                            `${sType} Request Updated`,
                            `${dateStr} | ${timeStr} | ${employeeName} has updated the requested ${sType.toLowerCase()} entry (${formData.invoiceNo || 'No Invoice'})${detailMsg}`,
                            targetRoles,
                            targetUsers
                        );
                    }
                }

                if (!isRequested) {
                    await processSaleEffects(formData, !!editingId);
                }

                setTimeout(() => {
                    setShowForm(false);
                    resetForm();
                    fetchSales();
                    fetchCustomers();
                    fetchStockRecords();
                    fetchWarehouses();
                }, 1500);
            } else {
                setSubmitStatus('error');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            date: '',
            invoiceNo: '',
            challanNo: '',
            truckNo: '',
            customerId: '',
            companyName: '',
            customerName: '',
            lcNo: '',
            contact: '',
            importer: '',
            port: '',
            indianCnF: '',
            bdCnf: '',
            exporter: '',
            truck: '',
            items: [{
                productId: '',
                productName: '',
                uom: saleType === 'General' ? 'QTY' : 'Truck',
                brandEntries: [{
                    lcNo: '',
                    brand: '',
                    brandName: '',
                    inhouseQty: '',
                    warehouseId: '',
                    warehouseName: '',
                    warehouseQty: '',
                    quantity: '',
                    bag: '',
                    bagSize: '',
                    truck: '',
                    uom: saleType === 'General' ? 'QTY' : 'Truck',
                    unitPrice: '',
                    totalAmount: ''
                }]
            }],
            currentTotalTrucks: 0,
            currentTotalQty: 0,
            indCommissionRate: '',
            indCommissionUom: 'Truck',
            indCommissionTotal: '0.00',
            bdCommissionRate: '',
            bdCommissionUom: 'Truck',
            bdCommissionTotal: '0.00',
            indCommissionEdited: false,
            bdCommissionEdited: false,
            totalAmount: '0.00',
            discount: '0.00',
            paidAmount: '0.00',
            dueAmount: '0.00',
            paymentMethod: 'Cash',
            status: 'Requested',
            saleType: saleType,
            previousBalance: '0.00',
            requestedBy: currentUser?.name || currentUser?.username || '',
            requestedByUsername: currentUser?.username || ''
        });
        setCustomerSearch('');
        setProductSearch('');
        setCompanyNameSearch('');
        setLcSearch('');
        setImporterSearch('');
        setExporterSearch('');
        setPortSearch('');
        setIndCnfSearch('');
        setBdCnfSearch('');
        setActiveDropdown(null);
        setEditingId(null);
        setOriginalData(null);
        setActiveItemIndex(null);
        setActiveEntryIndex(null);
        setSubmitStatus(null);
    };

    const handleEdit = (sale) => {
        let initialItems = sale.items || [];

        // Migrate single-item legacy
        if (initialItems.length === 0 && sale.productId) {
            const defUom = sale.uom || (saleType === 'General' ? 'QTY' : 'Truck');
            initialItems = [{
                productId: sale.productId,
                productName: sale.productName,
                lcNo: sale.lcNo || '',
                uom: defUom,
                brandEntries: [{
                    brand: sale.brand,
                    inhouseQty: sale.inhouseQty,
                    warehouseId: sale.warehouseId,
                    warehouseName: sale.warehouseName,
                    warehouseQty: sale.warehouseQty,
                    quantity: sale.quantity,
                    uom: defUom,
                    unitPrice: sale.unitPrice,
                    totalAmount: sale.totalAmount
                }]
            }];
        } else {
            // Check if items are flat or nested
            initialItems = initialItems.map(item => {
                const itemLcNo = (item.lcNo !== undefined && item.lcNo !== null) ? item.lcNo : (sale.lcNo || '');
                const itemUom = item.uom || sale.uom || (saleType === 'General' ? 'QTY' : 'Truck');
                if (item.brandEntries) {
                    return {
                        ...item,
                        uom: itemUom,
                        brandEntries: item.brandEntries.map(be => ({
                            ...be,
                            lcNo: (be.lcNo !== undefined && be.lcNo !== null) ? be.lcNo : itemLcNo,
                            uom: be.uom || itemUom
                        }))
                    };
                }
                // Migrate previous flat multi-item to nested brand entries
                return {
                    productId: item.productId,
                    productName: item.productName,
                    uom: itemUom,
                    brandEntries: [{
                        lcNo: itemLcNo,
                        brand: item.brand,
                        inhouseQty: item.inhouseQty,
                        warehouseId: item.warehouseId,
                        warehouseName: item.warehouseName,
                        warehouseQty: item.warehouseQty,
                        quantity: item.quantity,
                        uom: item.uom || itemUom,
                        unitPrice: item.unitPrice,
                        totalAmount: item.totalAmount
                    }]
                };
            });
        }

        setOriginalData({
            ...sale,
            items: JSON.parse(JSON.stringify(initialItems)) // Deep copy
        });

        setFormData({
            ...sale,
            items: initialItems,
            date: sale.date ? new Date(sale.date).toISOString().split('T')[0] : '',
            discount: sale.discount || '0.00',
            previousBalance: sale.previousBalance || '0.00',
            indCommissionRate: sale.indCommissionRate || '',
            indCommissionUom: sale.indCommissionUom || 'Truck',
            indCommissionTotal: sale.indCommissionTotal || '0.00',
            bdCommissionRate: sale.bdCommissionRate || '',
            bdCommissionUom: sale.bdCommissionUom || 'Truck',
            bdCommissionTotal: sale.bdCommissionTotal || '0.00',
            indCommissionEdited: sale.indCommissionEdited || false,
            bdCommissionEdited: sale.bdCommissionEdited || false
        });
        setEditingId(sale._id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = (sale) => {
        if (!canDelete) {
            alert('Forbidden: You do not have permission to delete sales');
            return;
        }
        onDeleteConfirm({
            show: true,
            type: 'sales',
            id: sale._id,
            isBulk: false,
            extraData: {
                customerId: sale.customerId,
                invoiceNo: sale.invoiceNo,
                items: sale.items // Include items for stock restoration
            }
        });
    };

    const getFilteredData = () => {
        let result = [];
        if (!searchQuery) {
            result = displayedSales;
        } else {
            const query = searchQuery.toLowerCase();
            result = displayedSales.filter(s => {
                if (saleType === 'Border') {
                    const date = (s.date || '').toLowerCase();
                    const lcNo = (s.lcNo || s.lcNumber || s.lc_no || s.lcNoClean || '').toLowerCase();
                    const invNo = (s.invoiceNo || s.orderNo || s.challanNo || '').toLowerCase();
                    const importer = (s.importer || '').toLowerCase();
                    const port = (s.port || '').toLowerCase();
                    const indCnf = (s.indianCnF || '').toLowerCase();
                    const bdCnf = (s.bdCnf || '').toLowerCase();
                    const party = (s.companyName || s.customerName || '').toLowerCase();
                    const truck = String(s.truck || '').toLowerCase();
                    const total = String(s.totalAmount || '').toLowerCase();

                    const itemsMatch = (s.items || []).some(item => {
                        const pName = (item.productName || item.product || '').toLowerCase();
                        const resolvedPName = (resolveProductName(item.productName || item.product || '')).toLowerCase();
                        const itemLcNo = (item.lcNo || item.lcNumber || item.lc_no || '').toLowerCase();
                        const brandLcMatch = (item.brandEntries || []).some(e =>
                            (e.lcNo || e.lcNumber || e.lc_no || '').toLowerCase().includes(query) ||
                            String(e.quantity || '').includes(query) || String(e.truck || '').includes(query) ||
                            String(e.unitPrice || '').includes(query) || String(e.totalAmount || '').includes(query)
                        );
                        return pName.includes(query) || resolvedPName.includes(query) || itemLcNo.includes(query) || brandLcMatch;
                    });

                    return date.includes(query) || lcNo.includes(query) || invNo.includes(query) || importer.includes(query) ||
                        port.includes(query) || indCnf.includes(query) || bdCnf.includes(query) ||
                        party.includes(query) || truck.includes(query) || total.includes(query) || itemsMatch;
                }

                const matchesBasic =
                    s.invoiceNo?.toLowerCase().includes(query) ||
                    s.lcNo?.toLowerCase().includes(query) ||
                    s.customerName?.toLowerCase().includes(query) ||
                    s.companyName?.toLowerCase().includes(query) ||
                    s.productName?.toLowerCase().includes(query) ||
                    resolveProductName(s.productName)?.toLowerCase().includes(query) ||
                    s.brand?.toLowerCase().includes(query) ||
                    (s.remarks || '').toLowerCase().includes(query);

                if (matchesBasic) return true;

                if (s.items && Array.isArray(s.items)) {
                    return s.items.some(item => {
                        const pName = (item.productName || item.product || '').toLowerCase();
                        const resolvedPName = (resolveProductName(item.productName || item.product || '')).toLowerCase();
                        const itemBrand = (item.brand || item.brandName || '').toLowerCase();
                        const itemLc = (item.lcNo || '').toLowerCase();
                        const brandEntriesMatch = (item.brandEntries || []).some(be =>
                            (be.lcNo || '').toLowerCase().includes(query) ||
                            (be.brand || be.brandName || '').toLowerCase().includes(query) ||
                            (be.warehouseName || be.whName || '').toLowerCase().includes(query)
                        );
                        return pName.includes(query) ||
                            resolvedPName.includes(query) ||
                            itemBrand.includes(query) ||
                            itemLc.includes(query) ||
                            brandEntriesMatch;
                    });
                }
                return false;
            });
        }

        // Apply Interactive Sort
        return [...result].sort((a, b) => {
            const key = sortConfig.key;
            let valA = a[key] || '';
            let valB = b[key] || '';

            if (key === 'date') {
                valA = new Date(valA);
                valB = new Date(valB);
            } else if (key === 'party') {
                valA = (a.companyName || a.customerName || '').toString().toLowerCase();
                valB = (b.companyName || b.customerName || '').toString().toLowerCase();
            } else if (key === 'warehouseName') {
                const getWhName = (sale) => {
                    if (sale.warehouseName) return sale.warehouseName;
                    if (sale.items && sale.items.length > 0) {
                        const item = sale.items[0];
                        if (item.brandEntries && item.brandEntries.length > 0) {
                            return item.brandEntries[0].warehouseName || '';
                        }
                        return item.warehouseName || '';
                    }
                    return '';
                };
                valA = getWhName(a).toString().toLowerCase();
                valB = getWhName(b).toString().toLowerCase();
            } else if (['totalAmount', 'discount', 'paidAmount', 'dueAmount'].includes(key)) {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            } else {
                valA = valA.toString().toLowerCase();
                valB = valB.toString().toLowerCase();
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    // Handle outside clicks for dropdowns
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (e.target && !document.body.contains(e.target)) {
                return;
            }
            if (activeDropdown === 'companyName' && !e.target.closest('.company-dropdown-container')) {
                setActiveDropdown(null);
            }
            if (activeDropdown === 'product' && !e.target.closest('.product-dropdown-container')) {
                setActiveDropdown(null);
            }
            if (activeDropdown === 'brand' && !e.target.closest('.brand-dropdown-container')) {
                setActiveDropdown(null);
            }
            if (activeDropdown === 'warehouse' && !e.target.closest('.warehouse-dropdown-container')) {
                setActiveDropdown(null);
            }
            if (activeDropdown === 'importer' && !e.target.closest('.importer-dropdown-container')) {
                setActiveDropdown(null);
            }
            if (activeDropdown === 'exporter' && !e.target.closest('.exporter-dropdown-container')) {
                setActiveDropdown(null);
            }
            if (
                (activeDropdown === 'port' && !e.target.closest('.port-dropdown-container')) ||
                (activeDropdown === 'indianCnF' && !e.target.closest('.ind-cnf-dropdown-container')) ||
                (activeDropdown === 'bdCnf' && !e.target.closest('.bd-cnf-dropdown-container')) ||
                (activeDropdown === 'lcNo' && !e.target.closest('.lc-dropdown-container')) ||
                (activeDropdown === 'orderNo' && !e.target.closest('.order-dropdown-container'))
            ) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown]);

    const getFilteredOrders = () => {
        return allSalesRecords.filter(item => {
            const sType = (item.saleType || '').toLowerCase();
            const inv = (item.invoiceNo || item.orderNo || '').toUpperCase();

            // Exclude Border Sales (BS...) from the Order ID dropdown
            if (sType === 'border' || inv.startsWith('BS')) return false;

            const st = (item.status || '').toLowerCase();
            const isOrd = sType === 'order' || inv.startsWith('ORD') || item.isOrderEntry || (st === 'requested' && sType !== 'border' && !inv.startsWith('BS'));
            if (!isOrd) return false;

            // Exclude orders that are currently in Edit Request status
            if (item.isEdited === true) return false;

            if (orderSearch) {
                const q = orderSearch.toLowerCase();
                const ordNo = (item.orderNo || item.invoiceNo || '').toLowerCase();
                const comp = (item.companyName || item.customerName || '').toLowerCase();
                return ordNo.includes(q) || comp.includes(q);
            }
            return true;
        });
    };

    const handleOrderSelect = (order) => {
        if (!order) {
            setFormData(prev => ({ ...prev, orderNo: '' }));
            setOrderSearch('');
        } else {
            const ordId = order.orderNo || order.invoiceNo || '';
            const comp = order.companyName || order.customerName || '';
            const custName = order.customerName || order.companyName || '';
            const phone = order.phone || order.contact || '';
            const address = order.address || '';

            setCompanyNameSearch(comp);

            const mappedItems = (order.items && order.items.length > 0) ? order.items.map((item, pIdx) => {
                const existingProduct = formData.items && formData.items[pIdx];
                const mappedBrandEntries = (item.brandEntries && item.brandEntries.length > 0) ? item.brandEntries.map((be, bIdx) => {
                    const existingBrand = existingProduct && existingProduct.brandEntries && existingProduct.brandEntries[bIdx];
                    const preservedLcNo = be.lcNo || (existingBrand ? existingBrand.lcNo : '') || '';

                    const pktSize = parseFloat(be.packetSize) || 30;
                    const qty = parseFloat(be.quantity) || 0;
                    const rawBag = (be.bag !== undefined && be.bag !== null && be.bag !== '') ? be.bag : (be.packet !== undefined && be.packet !== null && be.packet !== '') ? be.packet : '';
                    const bagVal = rawBag !== '' ? rawBag : (pktSize > 0 && qty > 0 ? (qty / pktSize) : '');
                    const rateVal = (be.unitPrice !== undefined && be.unitPrice !== null && be.unitPrice !== '') ? be.unitPrice : (be.rate !== undefined && be.rate !== null && be.rate !== '') ? be.rate : '';
                    const totalVal = (be.totalAmount !== undefined && be.totalAmount !== null && be.totalAmount !== '') ? be.totalAmount : (qty > 0 && rateVal !== '' ? (qty * parseFloat(rateVal)) : '');

                    return {
                        ...be,
                        lcNo: preservedLcNo,
                        brand: be.brand || be.brandName || '',
                        brandName: be.brandName || be.brand || '',
                        warehouseName: be.warehouseName || be.warehouse || '',
                        warehouseId: be.warehouseId || '',
                        bag: bagVal,
                        packet: bagVal,
                        packetSize: pktSize,
                        quantity: qty || '',
                        unitPrice: rateVal,
                        rate: rateVal,
                        totalAmount: totalVal
                    };
                }) : [{
                    lcNo: (existingProduct && existingProduct.brandEntries && existingProduct.brandEntries[0]) ? existingProduct.brandEntries[0].lcNo : '',
                    brand: '',
                    brandName: '',
                    inhouseQty: '',
                    warehouseId: '',
                    warehouseName: '',
                    warehouseQty: '',
                    bag: '',
                    packet: '',
                    quantity: '',
                    unitPrice: '',
                    totalAmount: ''
                }];

                return {
                    ...item,
                    productId: item.productId || '',
                    productName: item.productName || item.product || '',
                    uom: item.uom || 'QTY',
                    brandEntries: mappedBrandEntries
                };
            }) : (formData.items || []);

            const subtotal = mappedItems.reduce((sum, p) =>
                sum + (p.brandEntries || []).reduce((eSum, e) => eSum + (parseFloat(e.totalAmount) || 0), 0)
                , 0);

            const disc = parseFloat(order.discount !== undefined && order.discount !== null ? order.discount : (formData.discount || 0));
            const paid = parseFloat(order.paidAmount !== undefined && order.paidAmount !== null ? order.paidAmount : (formData.paidAmount || 0));
            const grandTotal = Math.max(0, subtotal - disc);
            const due = Math.max(0, grandTotal - paid);

            const ordRequestedBy = order.requestedBy || order.createdByName || order.createdBy || order.requestedByUsername || order.createdByUsername || '';
            const ordRequestedByUsername = order.requestedByUsername || order.createdByUsername || '';
            const ordCreatedByName = order.createdByName || order.requestedBy || order.createdBy || '';
            const ordCreatedBy = order.createdBy || order.createdByName || order.requestedBy || '';

            setFormData(prev => ({
                ...prev,
                orderNo: ordId,
                orderRequestedBy: ordRequestedBy,
                orderRequestedByUsername: ordRequestedByUsername,
                orderCreatedByName: ordCreatedByName,
                orderCreatedBy: ordCreatedBy,
                companyName: comp,
                customerName: custName,
                contact: phone,
                address: address,
                discount: order.discount !== undefined && order.discount !== null ? order.discount : prev.discount,
                paidAmount: order.paidAmount !== undefined && order.paidAmount !== null ? order.paidAmount : prev.paidAmount,
                totalAmount: grandTotal.toFixed(2),
                dueAmount: due.toFixed(2),
                items: mappedItems
            }));
            setOrderSearch('');
        }
        setActiveDropdown(null);
        setHighlightedIndex(-1);
    };

    const getOrderQtyForBrand = (prodName, bName = '', whName = '') => {
        if (!prodName || !formData.orderNo) return 0;
        const pLower = prodName.trim().toLowerCase();
        const bLower = bName ? bName.trim().toLowerCase() : '';
        const wLower = whName ? whName.trim().toLowerCase() : '';
        const targetOrderNo = formData.orderNo.trim().toUpperCase();

        const selectedOrder = allSalesRecords.find(s => {
            const inv = (s.orderNo || s.invoiceNo || '').trim().toUpperCase();
            return inv === targetOrderNo;
        });

        if (!selectedOrder) return 0;

        let totalOrd = 0;
        (selectedOrder.items || []).forEach(it => {
            const itProd = (it.productName || it.product || '').trim().toLowerCase();
            if (itProd === pLower) {
                (it.brandEntries || []).forEach(be => {
                    const beBrand = (be.brand || be.brandName || '').trim().toLowerCase();
                    const beWh = (be.warehouseName || be.warehouse || '').trim().toLowerCase();
                    if (!bLower || beBrand === bLower) {
                        if (!wLower || !beWh || beWh === wLower) {
                            totalOrd += (parseFloat(be.quantity) || 0);
                        }
                    }
                });
            }
        });
        return Math.round(totalOrd);
    };

    const getFilteredImporters = () => {
        return importersList
            .filter(imp => imp.status !== 'Inactive')
            .filter(imp => (imp.name || '').toLowerCase().includes(importerSearch.toLowerCase()));
    };

    const getFilteredExporters = () => {
        return exportersList
            .filter(exp => exp.status !== 'Inactive')
            .filter(exp => (exp.name || '').toLowerCase().includes(exporterSearch.toLowerCase()));
    };

    const getFilteredPorts = () => {
        return portsList
            .filter(p => p.status !== 'Inactive')
            .filter(p => p.name && p.name.toUpperCase() !== 'ANY PLACE OF INDIA')
            .filter(p => (p.name || '').toLowerCase().includes(portSearch.toLowerCase()));
    };

    const resolveProductName = (name) => {
        if (!name) return '';
        if (!products || !Array.isArray(products) || products.length === 0) return name;

        const normalize = (str) => {
            if (!str) return '';
            let s = str.trim().toLowerCase();
            if (s.endsWith('s')) {
                s = s.slice(0, -1);
            }
            return s;
        };

        const target = normalize(name);
        if (!target) return name;

        // Try exact match first
        const lowerName = name.trim().toLowerCase();
        let found = products.find(p =>
            (p.name || '').trim().toLowerCase() === lowerName ||
            (p.ipName || '').trim().toLowerCase() === lowerName
        );

        if (found) return found.name;

        // Try normalized match (ignoring plural 's')
        found = products.find(p =>
            normalize(p.name) === target ||
            normalize(p.ipName) === target
        );

        return found ? found.name : name;
    };

    const getFilteredLCs = () => {
        const query = (lcSearch || '').toLowerCase();
        let filtered = lcRecords;
        if (saleType !== 'Border' && activeItemIndex !== null) {
            const item = formData.items[activeItemIndex];
            if (item && item.productName) {
                const targetProd = item.productName.toLowerCase().trim();
                const matchedProdDef = products.find(p => p.name.toLowerCase().trim() === targetProd);
                const targetIpName = matchedProdDef?.ipName?.toLowerCase().trim();

                filtered = filtered.filter(lc => {
                    const lcProd = (lc.productName || '').toLowerCase().trim();
                    return lcProd === targetProd || (targetIpName && lcProd === targetIpName);
                });
            }
        }
        return filtered.filter(lc => {
            const matchedProduct = products.find(p =>
                (p.name || '').toLowerCase().trim() === (lc.productName || '').toLowerCase().trim() ||
                (p.ipName || '').toLowerCase().trim() === (lc.productName || '').toLowerCase().trim()
            );
            const dispProductName = matchedProduct ? matchedProduct.name : (lc.productName || '');
            return (lc.lcNo || '').toLowerCase().includes(query) ||
                (lc.importerName || '').toLowerCase().includes(query) ||
                (lc.productName || '').toLowerCase().includes(query) ||
                dispProductName.toLowerCase().includes(query);
        }).slice(0, 50);
    };

    const getFilteredCompanies = () => {
        return customers.filter(c =>
            (c.companyName || '').toLowerCase().includes(companyNameSearch.toLowerCase())
        );
    };

    const getFilteredIndianCnfs = () => {
        const query = (indCnfSearch || '').toLowerCase();
        return cnfsList
            .filter(c => c.type === 'Indian' && (c.name || '').toLowerCase().includes(query))
            .slice(0, 50);
    };

    const getFilteredBdCnfs = () => {
        const query = (bdCnfSearch || '').toLowerCase();
        return cnfsList
            .filter(c => c.type === 'BD' && (c.name || '').toLowerCase().includes(query))
            .slice(0, 50);
    };

    const getProductsForLc = (lcNo) => {
        if (!lcNo || !lcNo.toString().trim()) return [];
        const cleanLc = lcNo.toString().trim().toLowerCase();

        const productNamesSet = new Set();

        // 1. From lcRecords (LC Management records)
        (lcRecords || []).forEach(lc => {
            const curLcNo = (lc.lcNo || lc.lcNumber || '').toString().trim().toLowerCase();
            if (curLcNo === cleanLc) {
                if (Array.isArray(lc.productsList) && lc.productsList.length > 0) {
                    lc.productsList.forEach(p => {
                        if (p.productName) productNamesSet.add(p.productName.toString().trim());
                        else if (p.product) productNamesSet.add(p.product.toString().trim());
                    });
                }
                if (lc.productName) productNamesSet.add(lc.productName.toString().trim());
                if (lc.product) productNamesSet.add(lc.product.toString().trim());
            }
        });

        // 2. From stockRecords (LC Receive / Stock)
        (stockRecords || []).forEach(st => {
            const curLcNo = (st.lcNo || '').toString().trim().toLowerCase();
            if (curLcNo === cleanLc) {
                if (st.productName) productNamesSet.add(st.productName.toString().trim());
                if (st.product) productNamesSet.add(st.product.toString().trim());
                if (Array.isArray(st.entries)) {
                    st.entries.forEach(e => {
                        if (e.productName) productNamesSet.add(e.productName.toString().trim());
                        if (e.product) productNamesSet.add(e.product.toString().trim());
                    });
                }
                if (Array.isArray(st.brandEntries)) {
                    st.brandEntries.forEach(be => {
                        if (be.productName) productNamesSet.add(be.productName.toString().trim());
                        if (be.product) productNamesSet.add(be.product.toString().trim());
                    });
                }
            }
        });

        const matchedProducts = [];
        const matchedIds = new Set();

        productNamesSet.forEach(pName => {
            const resolvedName = resolveProductName(pName);
            const prodObj = products.find(p =>
                (p.name || '').trim().toLowerCase() === (resolvedName || '').trim().toLowerCase() ||
                (p.name || '').trim().toLowerCase() === (pName || '').trim().toLowerCase() ||
                (p.ipName || '').trim().toLowerCase() === (pName || '').trim().toLowerCase()
            );

            if (prodObj && !matchedIds.has(prodObj._id)) {
                matchedIds.add(prodObj._id);
                matchedProducts.push(prodObj);
            } else if (!prodObj) {
                const dummyId = `raw-${pName}`;
                if (!matchedIds.has(dummyId)) {
                    matchedIds.add(dummyId);
                    matchedProducts.push({ _id: dummyId, name: pName });
                }
            }
        });

        return matchedProducts;
    };

    const getFilteredProducts = () => {
        let selectedLcNo = '';
        if (saleType === 'Border') {
            selectedLcNo = formData.lcNo || '';
        } else if (activeItemIndex !== null) {
            const item = formData.items[activeItemIndex];
            const entry = item?.brandEntries?.[activeEntryIndex || 0];
            selectedLcNo = entry?.lcNo || formData.lcNo || '';
        }

        const lcProducts = getProductsForLc(selectedLcNo);

        let targetProducts = products;
        if (selectedLcNo && lcProducts.length > 0) {
            targetProducts = lcProducts;
        }

        const search = (productSearch || '').toLowerCase();
        return targetProducts.filter(p =>
            (p.name || '').toLowerCase().includes(search) ||
            (p.hsCode || '').toLowerCase().includes(search)
        );
    };

    const getFilteredBrands = (pIdx) => {
        const targetIdx = (pIdx !== undefined && pIdx !== null) ? pIdx : activeItemIndex;
        let selectedProductName = '';
        let selectedProductId = '';
        let selectedLcNo = '';
        if (targetIdx !== null && targetIdx !== undefined && formData.items?.[targetIdx]) {
            selectedProductName = formData.items[targetIdx].productName || '';
            selectedProductId = formData.items[targetIdx].productId || '';
            if (activeEntryIndex !== null && activeEntryIndex !== undefined) {
                selectedLcNo = formData.items[targetIdx].brandEntries?.[activeEntryIndex]?.lcNo || '';
            }
        }

        const brandsSet = new Set();
        const selectedProduct = (products || []).find(p =>
            (selectedProductId && p._id === selectedProductId) ||
            (selectedProductName && (
                (p.name || '').toLowerCase().trim() === selectedProductName.toLowerCase().trim() ||
                (p.ipName || '').toLowerCase().trim() === selectedProductName.toLowerCase().trim()
            ))
        );

        if (selectedProduct) {
            if (selectedProduct.brand) brandsSet.add(selectedProduct.brand);
            if (Array.isArray(selectedProduct.brands)) {
                selectedProduct.brands.forEach(b => { if (b && b.brand) brandsSet.add(b.brand); });
            }
        }

        // Check stockRecords for matching product
        if (stockRecords && Array.isArray(stockRecords)) {
            const pNameLower = (selectedProductName || selectedProduct?.name || '').toLowerCase().trim();
            stockRecords.forEach(r => {
                const rProdName = (r.productName || r.product || '').trim().toLowerCase();
                if (!pNameLower || rProdName === pNameLower) {
                    if (r.brand) brandsSet.add(r.brand);
                    if (Array.isArray(r.entries)) r.entries.forEach(e => { if (e && e.brand) brandsSet.add(e.brand); });
                    if (Array.isArray(r.brandEntries)) r.brandEntries.forEach(e => { if (e && e.brand) brandsSet.add(e.brand); });
                }
            });
        }

        // Check lcRecords for matching product or LC
        if (lcRecords && Array.isArray(lcRecords)) {
            const pNameLower = (selectedProductName || selectedProduct?.name || '').toLowerCase().trim();
            const cleanLc = (selectedLcNo || '').toLowerCase().trim();
            lcRecords.forEach(lc => {
                const lcProdName = (lc.productName || '').trim().toLowerCase();
                const curLcNo = (lc.lcNo || lc.lcNumber || '').toString().trim().toLowerCase();
                if ((!pNameLower || lcProdName === pNameLower) || (cleanLc && curLcNo === cleanLc)) {
                    if (lc.brand) brandsSet.add(lc.brand);
                }
            });
        }

        // Fallback: if no product selected or set is empty, collect all brands from products list
        if (brandsSet.size === 0 && (!selectedProductName && !selectedProductId)) {
            (products || []).forEach(p => {
                if (p.brand) brandsSet.add(p.brand);
                if (Array.isArray(p.brands)) {
                    p.brands.forEach(b => { if (b && b.brand) brandsSet.add(b.brand); });
                }
            });
        }

        const query = (brandSearch || '').toLowerCase();
        return Array.from(brandsSet)
            .filter(Boolean)
            .filter(b => (b || '').toLowerCase().includes(query))
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    };

    const getBrandsForSelectedProduct = () => {
        const pName = saleFilters.productName;
        if (!pName) return [];
        const pNameLower = pName.toLowerCase().trim();
        const brandsSet = new Set();

        const selectedProduct = (products || []).find(p =>
            (p.name || '').toLowerCase().trim() === pNameLower ||
            (p.ipName || '').toLowerCase().trim() === pNameLower ||
            p._id === pName
        );
        if (selectedProduct) {
            if (selectedProduct.brand) brandsSet.add(selectedProduct.brand);
            if (Array.isArray(selectedProduct.brands)) {
                selectedProduct.brands.forEach(b => { if (b && b.brand) brandsSet.add(b.brand); });
            }
        }

        if (stockRecords && Array.isArray(stockRecords)) {
            stockRecords.forEach(r => {
                const rProdName = (r.productName || r.product || '').trim().toLowerCase();
                if (rProdName === pNameLower) {
                    if (r.brand) brandsSet.add(r.brand);
                    if (Array.isArray(r.entries)) r.entries.forEach(e => { if (e && e.brand) brandsSet.add(e.brand); });
                    if (Array.isArray(r.brandEntries)) r.brandEntries.forEach(e => { if (e && e.brand) brandsSet.add(e.brand); });
                }
            });
        }

        if (allSalesRecords && Array.isArray(allSalesRecords)) {
            allSalesRecords.forEach(s => {
                (s.items || []).forEach(item => {
                    if ((item.productName || '').trim().toLowerCase() === pNameLower) {
                        (item.brandEntries || []).forEach(b => {
                            if (b && (b.brand || b.brandName)) brandsSet.add(b.brand || b.brandName);
                        });
                    }
                });
            });
        }

        return Array.from(brandsSet).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    };

    const getFilteredWarehouses = () => {
        const query = (warehouseSearch || '').toLowerCase().trim();
        const seen = new Set();
        const uniqueWarehouses = [];

        (warehouses || []).forEach(w => {
            const name = (w?.whName || w?.name || '').trim();
            if (name && !seen.has(name.toLowerCase())) {
                seen.add(name.toLowerCase());
                uniqueWarehouses.push({
                    _id: w._id || name,
                    whName: name,
                    name: name
                });
            }
        });

        if (uniqueWarehouses.length === 0) {
            ['HILI', 'DINAJPUR', 'CHATTOGRAM', 'DHAKA'].forEach(name => {
                if (!seen.has(name.toLowerCase())) {
                    seen.add(name.toLowerCase());
                    uniqueWarehouses.push({ _id: name, whName: name, name: name });
                }
            });
        }

        return uniqueWarehouses.filter(w =>
            (w.whName || '').toLowerCase().includes(query)
        );
    };

    const handleLcSelect = (lc) => {
        const selectedLcNo = lc?.lcNo || (typeof lc === 'string' ? lc : '');

        if (saleType === 'Border') {
            if (!lc) {
                setFormData(prev => ({
                    ...prev,
                    lcNo: ''
                }));
                setLcSearch('');
            } else {
                const lcProducts = getProductsForLc(selectedLcNo);
                if (lc.productName && !lcProducts.some(p => p.name === lc.productName)) {
                    const resolved = resolveProductName(lc.productName);
                    const matched = products.find(p => p.name === resolved || p.name === lc.productName);
                    if (matched) lcProducts.push(matched);
                    else lcProducts.push({ _id: `raw-${lc.productName}`, name: lc.productName });
                }
                if (Array.isArray(lc.productsList)) {
                    lc.productsList.forEach(p => {
                        const pName = p.productName || p.product;
                        if (pName && !lcProducts.some(lp => lp.name === pName)) {
                            const resolved = resolveProductName(pName);
                            const matched = products.find(m => m.name === resolved || m.name === pName);
                            if (matched) lcProducts.push(matched);
                            else lcProducts.push({ _id: `raw-${pName}`, name: pName });
                        }
                    });
                }

                setFormData(prev => {
                    const newData = {
                        ...prev,
                        lcNo: selectedLcNo
                    };

                    // Auto-fill associated fields if they are empty
                    if (!newData.importer && lc.importerName) newData.importer = lc.importerName;
                    if (!newData.exporter && lc.exporterName) newData.exporter = lc.exporterName;
                    if (!newData.port && lc.port) newData.port = lc.port;

                    // Auto-select product if there is ONLY 1 product for this LC No
                    if (lcProducts.length === 1 && newData.items && newData.items.length > 0) {
                        const singleProd = lcProducts[0];
                        const newItems = [...newData.items];
                        newItems[0] = {
                            ...newItems[0],
                            productId: singleProd._id,
                            productName: singleProd.name,
                            brand: '',
                            brandEntries: (newItems[0].brandEntries || [{}]).map(be => ({
                                ...be,
                                lcNo: selectedLcNo
                            }))
                        };
                        newData.items = newItems;
                    }

                    return newData;
                });
                setLcSearch('');
            }
        } else {
            // General sale (brand-wise LC)
            if (activeItemIndex === null || activeEntryIndex === null) return;

            const lcProducts = getProductsForLc(selectedLcNo);

            setFormData(prev => {
                const newItems = [...prev.items];
                const item = { ...newItems[activeItemIndex] };
                const newBrandEntries = [...item.brandEntries];
                const entry = { ...newBrandEntries[activeEntryIndex] };

                if (!lc) {
                    entry.lcNo = '';
                } else {
                    entry.lcNo = selectedLcNo;
                    if (lc.brand) {
                        entry.brand = lc.brand;
                        entry.brandName = lc.brand;
                    }
                }

                const stockInfo = getStockForEntry(item.productName, entry.brand || entry.brandName, entry.lcNo, entry.warehouseName, item.uom === 'BAG');
                entry.inhouseQty = stockInfo.inhouseQty;
                entry.warehouseQty = stockInfo.warehouseQty;

                newBrandEntries[activeEntryIndex] = entry;
                item.brandEntries = newBrandEntries;

                // Auto-select product if there is ONLY 1 product for this LC and item doesn't have a product selected yet
                if (lc && lcProducts.length === 1 && !item.productId) {
                    const singleProd = lcProducts[0];
                    item.productId = singleProd._id;
                    item.productName = singleProd.name;
                }

                newItems[activeItemIndex] = item;

                const newData = {
                    ...prev,
                    items: newItems
                };

                if (lc) {
                    if (!newData.importer && lc.importerName) newData.importer = lc.importerName;
                    if (!newData.exporter && lc.exporterName) newData.exporter = lc.exporterName;
                    if (!newData.port && lc.port) newData.port = lc.port;
                }

                return newData;
            });
            setLcSearch('');
        }
        setActiveDropdown(null);
    };

    const handleProductSelect = (product) => {
        if (activeItemIndex === null) return;
        setFormData(prev => {
            const newItems = [...prev.items];
            newItems[activeItemIndex] = {
                ...newItems[activeItemIndex],
                productId: product._id,
                productName: product.name,
                brand: '', // Clear item-level brand
                brandEntries: [{ // Reset brand entries for new product
                    lcNo: '',
                    brand: '',
                    brandName: '',
                    inhouseQty: '',
                    warehouseId: '',
                    warehouseName: '',
                    warehouseQty: '',
                    quantity: '',
                    bag: '',
                    bagSize: '',
                    truck: '',
                    unitPrice: '',
                    totalAmount: ''
                }]
            };
            return { ...prev, items: newItems };
        });
        setProductSearch('');
        setActiveDropdown(null);
    };

    const handleBrandSelect = (brand) => {
        if (activeItemIndex === null || activeEntryIndex === null) return;

        // polymorphic: can be a string (from dropdown) or an object (from reset button)
        const brandNameStr = typeof brand === 'string' ? brand : (brand?.brandName || '');

        setFormData(prev => {
            const newItems = [...prev.items];
            const item = { ...newItems[activeItemIndex] };
            const brandEntries = [...item.brandEntries];

            // Link packet size for bag calculations
            const selectedProduct = products.find(p => p._id === item.productId || (p.name || '').toLowerCase().trim() === (item.productName || '').toLowerCase().trim());
            const selectedBrandObj = selectedProduct?.brands?.find(b => b.brand === brandNameStr);
            const packetSize = selectedBrandObj?.packetSize || selectedProduct?.packetSize || '';

            const stockInfo = getStockForEntry(item.productName, brandNameStr, brandEntries[activeEntryIndex]?.lcNo, brandEntries[activeEntryIndex]?.warehouseName, item.uom === 'BAG');

            brandEntries[activeEntryIndex] = {
                ...brandEntries[activeEntryIndex],
                brand: brandNameStr,
                brandName: brandNameStr, // Ensure both are set for UI/Stock calculation
                bagSize: packetSize,
                inhouseQty: stockInfo.inhouseQty,
                warehouseQty: stockInfo.warehouseQty
            };
            item.brandEntries = brandEntries;
            newItems[activeItemIndex] = item;
            return { ...prev, items: newItems };
        });
        setBrandSearch('');
        setActiveDropdown(null);
    };

    const handleWarehouseSelect = (warehouse) => {
        if (activeItemIndex === null || activeEntryIndex === null) return;
        const whName = typeof warehouse === 'string' ? warehouse : (warehouse?.whName || warehouse?.name || '');
        const whId = typeof warehouse === 'object' ? (warehouse?._id || '') : '';
        setFormData(prev => {
            const newItems = [...prev.items];
            const item = { ...newItems[activeItemIndex] };
            const brandEntries = [...item.brandEntries];
            const stockInfo = getStockForEntry(item.productName, brandEntries[activeEntryIndex]?.brand || brandEntries[activeEntryIndex]?.brandName, brandEntries[activeEntryIndex]?.lcNo, whName, item.uom === 'BAG');
            brandEntries[activeEntryIndex] = {
                ...brandEntries[activeEntryIndex],
                warehouseId: whId,
                warehouseName: whName,
                inhouseQty: stockInfo.inhouseQty,
                warehouseQty: stockInfo.warehouseQty
            };
            item.brandEntries = brandEntries;
            newItems[activeItemIndex] = item;
            return { ...prev, items: newItems };
        });
        setWarehouseSearch('');
        setActiveDropdown(null);
    };

    const handleIndCnfSelect = (cnfName) => {
        const value = typeof cnfName === 'object' ? (cnfName.name || '') : (cnfName || '');
        setFormData(prev => ({ ...prev, indianCnF: value }));
        setIndCnfSearch('');
        setActiveDropdown(null);
    };

    const handleBdCnfSelect = (cnfName) => {
        const value = typeof cnfName === 'object' ? (cnfName.name || '') : (cnfName || '');
        setFormData(prev => ({ ...prev, bdCnf: value }));
        setBdCnfSearch('');
        setActiveDropdown(null);
    };

    const handleCompanyNameSelect = (customer) => {
        if (!customer) {
            setFormData(prev => ({
                ...prev,
                customerId: '',
                companyName: '',
                customerName: '',
                contact: '',
                address: ''
            }));
            setCompanyNameSearch('');
        } else {
            const comp = typeof customer === 'object' ? (customer.companyName || customer.customerName || '') : customer;
            const custName = typeof customer === 'object' ? (customer.customerName || customer.companyName || '') : customer;
            const custId = typeof customer === 'object' ? (customer._id || '') : '';
            const phone = typeof customer === 'object' ? (customer.phone || customer.contact || '') : '';
            const addr = typeof customer === 'object' ? (customer.address || '') : '';

            setFormData(prev => ({
                ...prev,
                customerId: custId,
                companyName: comp,
                customerName: custName,
                contact: phone,
                address: addr
            }));
            setCompanyNameSearch(comp);
        }
        setActiveDropdown(null);
        setHighlightedIndex(-1);
    };

    const handleImporterSelect = (importer) => {
        const value = typeof importer === 'object' ? (importer.name || '') : (importer || '');
        setFormData(prev => ({ ...prev, importer: value }));
        setImporterSearch('');
        setActiveDropdown(null);
        setHighlightedIndex(-1);
    };

    const handleExporterSelect = (exporter) => {
        const value = typeof exporter === 'object' ? (exporter.name || '') : (exporter || '');
        setFormData(prev => ({ ...prev, exporter: value }));
        setExporterSearch('');
        setActiveDropdown(null);
        setHighlightedIndex(-1);
    };

    const handlePortSelect = (port) => {
        const value = typeof port === 'object' ? (port.name || '') : (port || '');
        setFormData(prev => ({ ...prev, port: value }));
        setPortSearch('');
        setActiveDropdown(null);
        setHighlightedIndex(-1);
    };

    const handleDropdownKeyDown = (e, type, filteredOptions, onSelect) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && filteredOptions && filteredOptions[highlightedIndex]) {
                onSelect(filteredOptions[highlightedIndex]);
            } else if (filteredOptions && filteredOptions.length > 0) {
                onSelect(filteredOptions[0]);
            } else {
                setActiveDropdown(null);
            }
        } else if (e.key === 'Escape') {
            setActiveDropdown(null);
        }
    };

    const renderViewModal = () => {
        if (!viewData || typeof document === 'undefined' || !document.body) return null;
        return createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setViewData(null)}></div>
                <div className="relative bg-white border border-gray-100 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-300 z-10">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-white">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                                <ReceiptIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 tracking-tight">Sale Invoice Details</h3>
                                <p className="text-xs text-gray-500 font-medium">{viewData.invoiceNo || 'No Invoice Number'}</p>
                            </div>
                        </div>
                        <button onClick={() => setViewData(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl border border-gray-100 hover:bg-gray-50 transition-all shadow-sm">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="overflow-y-auto max-h-[70vh] p-6 space-y-6 bg-gray-50/30">

                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 p-6 bg-white rounded-2xl border border-gray-100/50 shadow-sm">
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Transaction Date</span>
                                <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                    {formatDate(viewData.date)}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Company Name</span>
                                <div className="text-sm font-bold text-gray-900 truncate" title={getSafeString(viewData.companyName)}>{getSafeString(viewData.companyName) || '-'}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Customer</span>
                                <div className="text-sm font-bold text-gray-900">{getSafeString(viewData.customerName) || '-'}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Entry / Audit</span>
                                <div className="text-xs space-y-0.5">
                                    <div className="font-bold text-gray-900"><span className="text-gray-500 font-normal">Entry:</span> {getDisplayName(viewData.requestedByUsername || viewData.createdByUsername, viewData.requestedBy || viewData.createdByName || 'N/A')}</div>
                                    {(viewData.acceptedBy || viewData.approvedByName || viewData.approvedBy) && (
                                        <div className="text-emerald-600 font-semibold"><span className="text-emerald-500 font-normal">Approved:</span> ✓ {getDisplayName(viewData.acceptedByUsername || viewData.approvedByUsername, viewData.acceptedBy || viewData.approvedByName || viewData.approvedBy)}</div>
                                    )}
                                    {(viewData.editedByName || viewData.editedBy || viewData.editRequestedBy) && (
                                        <div className="text-amber-600 font-medium"><span className="text-amber-500 font-normal">Edited:</span> ✎ {getDisplayName(viewData.editedByUsername || viewData.editRequestedByUsername, viewData.editedByName || viewData.editedBy || viewData.editRequestedBy)}</div>
                                    )}
                                    {(viewData.editApprovedByName || viewData.editApprovedBy) && !viewData.isEdited && (
                                        <div className="text-purple-600 font-medium"><span className="text-purple-500 font-normal">Edit Approved:</span> ✓✎ {getDisplayName(viewData.editApprovedByUsername, viewData.editApprovedByName || viewData.editApprovedBy)}</div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status / Payment</span>
                                <div className="flex flex-col gap-1.5">
                                    <div className={`px-2 py-0.5 w-fit rounded text-[10px] font-bold uppercase tracking-wider ${viewData.status === 'Requested' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                        viewData.status === 'Rejected' ? 'bg-red-50 text-red-600 border border-red-100' :
                                            'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                        }`}>
                                        {viewData.status || 'Completed'}
                                    </div>
                                    <div className={`px-2 py-0.5 w-fit rounded text-[10px] font-bold inline-flex items-center gap-1 ${parseFloat(viewData.dueAmount) > 0 ? 'bg-amber-50 text-amber-600 border border-amber-100/50' : 'bg-emerald-50 text-emerald-600 border border-emerald-100/50'}`}>
                                        <div className={`w-1 h-1 rounded-full ${parseFloat(viewData.dueAmount) > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                                        {parseFloat(viewData.dueAmount) > 0 ? 'Partial Pay' : 'Paid in Full'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white border-b border-gray-50 group">
                                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest w-1/4">Product Description</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Brand Information</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Qty / Bag</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Unit Price</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {viewData.items?.map((product, pIdx) => (
                                        <React.Fragment key={pIdx}>
                                            <tr className="bg-white transition-colors">
                                                <td className="px-6 py-5 align-top border-r border-gray-50/50" rowSpan={product.brandEntries?.length ? product.brandEntries.length + 1 : 1}>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-4 bg-blue-600 rounded-sm"></div>
                                                        <span className="text-[13px] font-bold text-blue-800">{resolveProductName(product.productName)}</span>
                                                    </div>
                                                </td>
                                                {/* If there are no brand entries, render empty columns so layout doesn't break */}
                                                {!product.brandEntries?.length && (
                                                    <>
                                                        <td className="px-6 py-4"></td>
                                                        <td className="px-6 py-4"></td>
                                                        <td className="px-6 py-4"></td>
                                                        <td className="px-6 py-4"></td>
                                                    </>
                                                )}
                                            </tr>
                                            {product.brandEntries?.map((entry, eIdx) => (
                                                <tr key={eIdx} className="bg-white hover:bg-gray-50/30 transition-all duration-200">
                                                    <td className="px-6 py-4 align-middle">
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="text-[12px] font-bold text-gray-800">{entry.brand}</div>
                                                            <div className="text-[9px] font-black text-blue-500 uppercase tracking-wider flex items-center gap-1">
                                                                <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                                                                {entry.warehouseName}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right align-middle">
                                                        <div className="text-[13px] font-bold text-gray-900">
                                                            {product.uom === 'BAG'
                                                                ? `${parseFloat(entry.bag || 0).toLocaleString('en-US')} Bag`
                                                                : `${parseFloat(entry.quantity || 0).toLocaleString('en-US')} kg`}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right align-middle">
                                                        <div className="text-[12px] font-bold text-gray-400">৳{parseFloat(entry.unitPrice || 0).toLocaleString('en-IN')}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right align-middle">
                                                        <div className="text-[14px] font-black text-blue-900 group-hover:scale-[1.02] transition-transform origin-right">৳{parseFloat(entry.totalAmount || 0).toLocaleString('en-IN')}</div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                            <div className="p-5 bg-orange-50/30 rounded-2xl border border-orange-100/50 group hover:bg-orange-50/50 transition-colors">
                                <div className="text-[9px] font-black text-orange-400 uppercase tracking-widest mb-1.5">Total Discount</div>
                                <div className="text-xl font-black text-orange-600 group-hover:scale-[1.02] transition-transform origin-left">৳{parseFloat(viewData.discount || 0).toLocaleString('en-IN')}</div>
                            </div>
                            <div className="p-5 bg-emerald-50/30 rounded-2xl border border-emerald-100/50 group hover:bg-emerald-50/50 transition-colors">
                                <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1.5">Truck Fare</div>
                                <div className="text-xl font-black text-emerald-500 group-hover:scale-[1.02] transition-transform origin-left">৳{parseFloat(viewData.paidAmount || 0).toLocaleString('en-IN')}</div>
                            </div>
                            <div className="p-5 bg-[#1a368b] rounded-2xl border border-blue-900 shadow-xl shadow-blue-500/10 group overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                                <div className="text-[9px] font-black text-blue-200 uppercase tracking-widest mb-1.5 relative z-10">Grand Total Invoice</div>
                                <div className="text-2xl font-black text-white relative z-10 group-hover:scale-[1.02] transition-transform origin-left tracking-tight">৳{parseFloat(viewData.totalAmount || 0).toLocaleString('en-IN')}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        );
    };

    const requestedCount = useMemo(() => {
        return sales.filter(s => (s.status || '').toLowerCase().includes('requested')).length;
    }, [sales]);

    const editRequestedCount = useMemo(() => {
        return sales.filter(s => s.isEdited === true && (s.status || '').toLowerCase() !== 'requested').length;
    }, [sales]);

    // Apply search + advanced filters
    const displayedSales = sales.filter(sale => {
        const statusLower = (sale.status || '').toLowerCase();
        if (statusLower === 'rejected') return false;

        const isReq = statusLower === 'requested';
        const isEditReq = sale.isEdited === true && !isReq;

        if (isRequestedOnly) {
            if (!isReq) return false;
        } else if (isEditRequestedOnly) {
            if (!isEditReq) return false;
        } else {
            if (isReq || isEditReq) return false;
        }

        // Text search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();

            if (saleType === 'Border') {
                // Gather searchable flat-text fields
                const date = (sale.date || '').toLowerCase();
                const lcNo = (sale.lcNo || sale.lcNumber || sale.lc_no || sale.lcNoClean || '').toLowerCase();
                const invNo = (sale.invoiceNo || sale.orderNo || sale.challanNo || '').toLowerCase();
                const importer = (sale.importer || '').toLowerCase();
                const port = (sale.port || '').toLowerCase();
                const indCnf = (sale.indianCnF || '').toLowerCase();
                const bdCnf = (sale.bdCnf || '').toLowerCase();
                const party = (sale.companyName || sale.customerName || '').toLowerCase();
                const truck = String(sale.truck || '').toLowerCase();
                const total = String(sale.totalAmount || '').toLowerCase();

                // Search inside product names, LC numbers, and quantities across items
                const itemsMatch = (sale.items || []).some(item => {
                    const pName = (item.productName || item.product || '').toLowerCase();
                    const resolvedPName = (resolveProductName(item.productName || item.product || '')).toLowerCase();
                    const itemLcNo = (item.lcNo || item.lcNumber || item.lc_no || '').toLowerCase();
                    const brandLcMatch = (item.brandEntries || []).some(e =>
                        (e.lcNo || e.lcNumber || e.lc_no || '').toLowerCase().includes(q) ||
                        (e.brand || e.brandName || '').toLowerCase().includes(q) ||
                        String(e.quantity || '').includes(q) || String(e.truck || '').includes(q) ||
                        String(e.unitPrice || '').includes(q) || String(e.totalAmount || '').includes(q)
                    );
                    return pName.includes(q) || resolvedPName.includes(q) || itemLcNo.includes(q) || (item.brand || '').toLowerCase().includes(q) || brandLcMatch;
                });

                const matches = date.includes(q) || lcNo.includes(q) || invNo.includes(q) || importer.includes(q) ||
                    port.includes(q) || indCnf.includes(q) || bdCnf.includes(q) ||
                    party.includes(q) || truck.includes(q) || total.includes(q) || itemsMatch;

                if (!matches) return false;
            } else {
                const inv = (sale.invoiceNo || '').toLowerCase();
                const lcNo = (sale.lcNo || '').toLowerCase();
                const challan = (sale.challanNo || '').toLowerCase();
                const truck = (sale.truckNo || '').toLowerCase();
                const cname = (sale.companyName || sale.customerName || '').toLowerCase();
                const remarks = (sale.remarks || '').toLowerCase();
                const itemsMatch = (sale.items || []).some(item => {
                    const pName = (item.productName || item.product || '').toLowerCase();
                    const resolvedPName = (resolveProductName(item.productName || item.product || '')).toLowerCase();
                    const itemBrand = (item.brand || item.brandName || '').toLowerCase();
                    const itemLc = (item.lcNo || '').toLowerCase();
                    const brandEntriesMatch = (item.brandEntries || []).some(e =>
                        (e.lcNo || '').toLowerCase().includes(q) ||
                        (e.brand || e.brandName || '').toLowerCase().includes(q) ||
                        (e.warehouseName || e.whName || '').toLowerCase().includes(q) ||
                        String(e.quantity || '').includes(q) || String(e.unitPrice || '').includes(q) || String(e.totalAmount || '').includes(q)
                    );
                    return pName.includes(q) || resolvedPName.includes(q) || itemBrand.includes(q) || itemLc.includes(q) || brandEntriesMatch;
                });
                if (!inv.includes(q) && !lcNo.includes(q) && !challan.includes(q) && !truck.includes(q) && !cname.includes(q) && !remarks.includes(q) && !itemsMatch) return false;
            }
        }
        // Date range
        if (saleFilters.startDate && sale.date) {
            if (sale.date < saleFilters.startDate) return false;
        }
        if (saleFilters.endDate && sale.date) {
            if (sale.date > saleFilters.endDate) return false;
        }
        // Quick range filtering
        if (saleFilters.quickRange && saleFilters.quickRange !== 'all' && saleFilters.quickRange !== 'custom') {
            const now = new Date();
            const recordDate = new Date(sale.date);
            if (saleFilters.quickRange === 'weekly') {
                // Running week: Monday to Sunday of current week
                const dayOfWeek = now.getDay();
                const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() + diffToMonday);
                weekStart.setHours(0, 0, 0, 0);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                weekEnd.setHours(23, 59, 59, 999);
                if (recordDate < weekStart || recordDate > weekEnd) return false;
            }
            if (saleFilters.quickRange === 'monthly') {
                const month = saleFilters.selectedMonth || (now.getMonth() + 1);
                const year = saleFilters.selectedYear || now.getFullYear();
                if (recordDate.getMonth() + 1 !== month || recordDate.getFullYear() !== year) return false;
            }
            if (saleFilters.quickRange === 'yearly') {
                const year = saleFilters.selectedYear || now.getFullYear();
                if (recordDate.getFullYear() !== year) return false;
            }
        }
        // Company
        if (saleFilters.companyName) {
            const c = (sale.companyName || sale.customerName || '').toLowerCase();
            if (!c.includes(saleFilters.companyName.toLowerCase())) return false;
        }
        // Port
        if (saleFilters.port) {
            const p = (sale.port || '').toLowerCase();
            if (!p.includes(saleFilters.port.toLowerCase())) return false;
        }
        // Product
        if (saleFilters.productName) {
            const hasProduct = (sale.items || []).some(item => {
                const rawName = (item.productName || item.product || '').toLowerCase();
                const resName = resolveProductName(item.productName || item.product || '').toLowerCase();
                return rawName.includes(saleFilters.productName.toLowerCase()) || resName.includes(saleFilters.productName.toLowerCase());
            });
            if (!hasProduct) return false;
        }
        // Brand filter
        if (saleFilters.brand) {
            const hasBrand = (sale.items || []).some(item => {
                const legacyBrandMatch = (item.brand || '').toLowerCase().includes(saleFilters.brand.toLowerCase());
                const brandEntriesMatch = (item.brandEntries || []).some(be =>
                    (be.brand || be.brandName || '').toLowerCase().includes(saleFilters.brand.toLowerCase())
                );
                return legacyBrandMatch || brandEntriesMatch;
            });
            if (!hasBrand) return false;
        }
        // IND C&F
        if (saleFilters.indCnf) {
            const ic = (sale.indianCnF || '').toLowerCase();
            if (!ic.includes(saleFilters.indCnf.toLowerCase())) return false;
        }
        // BD C&F
        if (saleFilters.bdCnf) {
            const bc = (sale.bdCnf || '').toLowerCase();
            if (!bc.includes(saleFilters.bdCnf.toLowerCase())) return false;
        }
        return true;
    });

    const stats = {
        totalSales: displayedSales.reduce((sum, s) => sum + (parseFloat(s.totalAmount) || 0), 0),
        totalDiscount: displayedSales.reduce((sum, s) => sum + (parseFloat(s.discount) || 0), 0),
        totalPaid: displayedSales.reduce((sum, s) => sum + (parseFloat(s.paidAmount) || 0), 0),
        totalDue: displayedSales.reduce((sum, s) => sum + (parseFloat(s.dueAmount) || 0), 0),
        totalTrucks: saleType === 'Border' ? displayedSales.reduce((sum, sale) => {
            const items = sale.items || [];
            const truckTotal = items.reduce((iSum, item) => {
                const brandEntries = item.brandEntries || [];
                return iSum + brandEntries.reduce((bSum, entry) => bSum + (parseFloat(entry.truck) || 0), 0);
            }, 0);
            return sum + (items.length > 0 ? truckTotal : (parseFloat(sale.truck) || 0));
        }, 0) : 0
    };

    return (
        <div className="sale-management-container">
            <div className="sale-mgmt-header">
                <div className="w-full md:w-auto">
                    <h2 className="sale-mgmt-title">{saleType === 'Order' ? 'Order Management' : `${saleType} Sale Management`}</h2>
                </div>

                {!showForm && (
                    <div className="flex-1 w-full max-w-none md:max-w-md mx-auto flex flex-col items-center gap-2">
                        <div className="sale-mgmt-search-container group w-full relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input autoComplete="off"
                                type="text"
                                placeholder={saleType === 'Border' ? "Search invoice, customer, LC no, product, brand..." : "Search invoice, customer, product, brand, warehouse..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="sale-mgmt-search-input"
                            />
                        </div>
                        <div className="flex items-center gap-2 overflow-visible">
                            {canViewSaleRequest && (
                                <button
                                    onClick={() => {
                                        setIsRequestedOnly(!isRequestedOnly);
                                        setIsEditRequestedOnly(false);
                                    }}
                                    className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${isRequestedOnly ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}
                                >
                                    Sale Request
                                    {requestedCount > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center px-1 rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-pulse border-2 border-white">
                                            {requestedCount}
                                        </span>
                                    )}
                                </button>
                            )}

                            {canViewEditRequest && (
                                <button
                                    onClick={() => {
                                        setIsEditRequestedOnly(!isEditRequestedOnly);
                                        setIsRequestedOnly(false);
                                    }}
                                    className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${isEditRequestedOnly ? 'bg-amber-600 border-amber-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-600'}`}
                                >
                                    Edit Request
                                    {editRequestedCount > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center px-1 rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-sm animate-pulse border-2 border-white">
                                            {editRequestedCount}
                                        </span>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {!showForm && (
                    <div className="grid grid-cols-3 md:flex items-center justify-center md:justify-end gap-1.5 md:gap-3 z-50 w-full md:w-auto">
                        {/* Filter Button */}
                        <div className="relative">
                            <button
                                ref={saleFilterButtonRef}
                                onClick={() => setShowSaleFilterPanel(prev => !prev)}
                                className={`sale-mgmt-btn-action ${showSaleFilterPanel || hasActiveFilters
                                    ? 'sale-mgmt-btn-blue'
                                    : 'sale-mgmt-btn-white'
                                    }`}
                            >
                                <FunnelIcon className="w-5 h-5" />
                                <span>Filter</span>
                                {hasActiveFilters && (
                                    <span className="flex items-center justify-center w-4 h-4 text-[10px] font-black bg-white text-blue-600 rounded-full ml-1">
                                        {activeFilterCount}
                                    </span>
                                )}
                            </button>

                            {showSaleFilterPanel && (
                                <>
                                    {/* Mobile backdrop */}
                                    <div
                                        className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-2xl z-[55]"
                                        onClick={() => setShowSaleFilterPanel(false)}
                                    />
                                    <div ref={saleFilterRef} className={`fixed inset-x-4 top-24 md:absolute md:inset-auto md:right-0 md:mt-3 w-auto md:w-[450px] bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[60] p-4 md:p-6 animate-in fade-in zoom-in duration-200 ${activeFilterDropdown ? 'overflow-visible' : 'max-h-[85vh] overflow-y-auto custom-scrollbar'}`}>
                                        {/* Filter Header */}
                                        <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-50">
                                            <h4 className="font-extrabold text-gray-900 text-lg">Advance Filter</h4>
                                            <button
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    setSaleFilters({ quickRange: 'monthly', selectedMonth: new Date().getMonth() + 1, selectedYear: new Date().getFullYear(), startDate: '', endDate: '', companyName: '', invoiceNo: '', port: '', productName: '', brand: '', indCnf: '', bdCnf: '' });
                                                    setSaleFilterSearch({ companySearch: '', invoiceSearch: '', portSearch: '', productSearch: '', brandSearch: '', indCnfSearch: '', bdCnfSearch: '' });
                                                    setActiveFilterDropdown(null);
                                                }}
                                                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest transition-colors"
                                            >
                                                RESET ALL
                                            </button>
                                        </div>

                                        <div className="space-y-5">
                                            {/* Show Unit Control (BAG | QTY | BOTH) */}
                                            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                                <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">SHOW UNIT</span>
                                                <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl border border-gray-200/60">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDisplayUnit('BAG')}
                                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${displayUnit === 'BAG' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                                    >
                                                        BAG
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDisplayUnit('QTY')}
                                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${displayUnit === 'QTY' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                                    >
                                                        QTY
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDisplayUnit('BOTH')}
                                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${displayUnit === 'BOTH' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                                    >
                                                        BOTH
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Quick Range */}
                                            <div className="space-y-2 text-center">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Quick Range</label>
                                                <div className="flex flex-wrap justify-center gap-2">
                                                    {['all', 'weekly', 'monthly', 'yearly'].map(range => (
                                                        <button
                                                            key={range}
                                                            type="button"
                                                            onClick={() => setSaleFilters(prev => ({ ...prev, quickRange: range, startDate: '', endDate: '' }))}
                                                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${saleFilters.quickRange === range ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                                        >
                                                            {range.charAt(0).toUpperCase() + range.slice(1)}
                                                        </button>
                                                    ))}
                                                </div>
                                                {/* Month dropdown for monthly */}
                                                {saleFilters.quickRange === 'monthly' && (
                                                    <div className="flex items-center justify-center gap-2 mt-1">
                                                        <select
                                                            value={saleFilters.selectedMonth || new Date().getMonth() + 1}
                                                            onChange={(e) => setSaleFilters(prev => ({ ...prev, selectedMonth: parseInt(e.target.value) }))}
                                                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                                        >
                                                            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                                                                <option key={i + 1} value={i + 1}>{m}</option>
                                                            ))}
                                                        </select>
                                                        <select
                                                            value={saleFilters.selectedYear || new Date().getFullYear()}
                                                            onChange={(e) => setSaleFilters(prev => ({ ...prev, selectedYear: parseInt(e.target.value) }))}
                                                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                                        >
                                                            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                                                <option key={y} value={y}>{y}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                                {/* Year dropdown for yearly */}
                                                {saleFilters.quickRange === 'yearly' && (
                                                    <div className="flex items-center justify-center gap-2 mt-1">
                                                        <select
                                                            value={saleFilters.selectedYear || new Date().getFullYear()}
                                                            onChange={(e) => setSaleFilters(prev => ({ ...prev, selectedYear: parseInt(e.target.value) }))}
                                                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                                        >
                                                            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                                                <option key={y} value={y}>{y}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Date Range Row */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div ref={saleFromDateFilterRef}>
                                                    <CustomDatePicker
                                                        label="From Date"
                                                        value={saleFilters.startDate}
                                                        onChange={(e) => setSaleFilters(prev => ({ ...prev, startDate: e.target.value, quickRange: 'custom' }))}
                                                        compact={true}
                                                        isOpen={activeFilterDropdown === 'from'}
                                                        onToggle={(val) => setActiveFilterDropdown(val ? 'from' : null)}
                                                    />
                                                </div>
                                                <div ref={saleToDateFilterRef}>
                                                    <CustomDatePicker
                                                        label="To Date"
                                                        value={saleFilters.endDate}
                                                        onChange={(e) => setSaleFilters(prev => ({ ...prev, endDate: e.target.value, quickRange: 'custom' }))}
                                                        compact={true}
                                                        rightAlign={true}
                                                        isOpen={activeFilterDropdown === 'to'}
                                                        onToggle={(val) => setActiveFilterDropdown(val ? 'to' : null)}
                                                    />
                                                </div>
                                            </div>

                                            {/* Type Specific and Product Filters */}
                                            <div className="space-y-5">
                                                {saleType === 'Border' ? (
                                                    <>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            {/* Party Name Filter */}
                                                            <div className="space-y-1.5 relative" ref={saleCompanyFilterRef}>
                                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">PARTY NAME</label>
                                                                <div className="relative">
                                                                    <input autoComplete="off"
                                                                        type="text"
                                                                        value={saleFilterSearch.companySearch}
                                                                        onChange={(e) => {
                                                                            setSaleFilterSearch(prev => ({ ...prev, companySearch: e.target.value }));
                                                                            setSaleFilters(prev => ({ ...prev, companyName: e.target.value }));
                                                                            setActiveFilterDropdown('company');
                                                                        }}
                                                                        onFocus={() => setActiveFilterDropdown('company')}
                                                                        placeholder={saleFilters.companyName || 'Search party...'}
                                                                        className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${saleFilters.companyName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                                    />
                                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                        {saleFilters.companyName && (
                                                                            <button onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, companyName: '' })); setSaleFilterSearch(prev => ({ ...prev, companySearch: '' })); setActiveFilterDropdown(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                                <XIcon className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                    </div>
                                                                </div>
                                                                {activeFilterDropdown === 'company' && (() => {
                                                                    const options = [...new Set(sales.map(s => s.companyName || s.customerName).filter(Boolean))].sort();
                                                                    const filtered = options.filter(name => name.toLowerCase().includes((saleFilterSearch.companySearch || '').toLowerCase()));
                                                                    return filtered.length > 0 ? (
                                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                            {filtered.map(name => (
                                                                                <button key={name} type="button" onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, companyName: name })); setSaleFilterSearch(prev => ({ ...prev, companySearch: name })); setActiveFilterDropdown(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">
                                                                                    {name}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    ) : null;
                                                                })()}
                                                            </div>

                                                            {/* Entry Port Filter */}
                                                            <div className="space-y-1.5 relative" ref={salePortFilterRef}>
                                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">ENTRY PORT</label>
                                                                <div className="relative">
                                                                    <input autoComplete="off"
                                                                        type="text"
                                                                        value={saleFilterSearch.portSearch}
                                                                        onChange={(e) => {
                                                                            setSaleFilterSearch(prev => ({ ...prev, portSearch: e.target.value }));
                                                                            setSaleFilters(prev => ({ ...prev, port: e.target.value }));
                                                                            setActiveFilterDropdown('port');
                                                                        }}
                                                                        onFocus={() => setActiveFilterDropdown('port')}
                                                                        placeholder={saleFilters.port || 'Search port...'}
                                                                        className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${saleFilters.port ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                                    />
                                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                        {saleFilters.port && (
                                                                            <button onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, port: '' })); setSaleFilterSearch(prev => ({ ...prev, portSearch: '' })); setActiveFilterDropdown(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                                <XIcon className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                    </div>
                                                                </div>
                                                                {activeFilterDropdown === 'port' && (() => {
                                                                    const options = [...new Set(sales.map(s => s.port).filter(Boolean))].sort();
                                                                    const filtered = options.filter(port => port.toLowerCase().includes((saleFilterSearch.portSearch || '').toLowerCase()));
                                                                    return filtered.length > 0 ? (
                                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                            {filtered.map(port => (
                                                                                <button key={port} type="button" onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, port: port })); setSaleFilterSearch(prev => ({ ...prev, portSearch: port })); setActiveFilterDropdown(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">
                                                                                    {port}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    ) : null;
                                                                })()}
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-4">
                                                            {/* Indian C&F Filter */}
                                                            <div className="space-y-1.5 relative" ref={saleIndCnfFilterRef}>
                                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">INDIAN C&F</label>
                                                                <div className="relative">
                                                                    <input autoComplete="off"
                                                                        type="text"
                                                                        value={saleFilterSearch.indCnfSearch}
                                                                        onChange={(e) => {
                                                                            setSaleFilterSearch(prev => ({ ...prev, indCnfSearch: e.target.value }));
                                                                            setSaleFilters(prev => ({ ...prev, indCnf: e.target.value }));
                                                                            setActiveFilterDropdown('indCnf');
                                                                        }}
                                                                        onFocus={() => setActiveFilterDropdown('indCnf')}
                                                                        placeholder={saleFilters.indCnf || 'India...'}
                                                                        className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${saleFilters.indCnf ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                                    />
                                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                        {saleFilters.indCnf && (
                                                                            <button onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, indCnf: '' })); setSaleFilterSearch(prev => ({ ...prev, indCnfSearch: '' })); setActiveFilterDropdown(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                                <XIcon className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                    </div>
                                                                </div>
                                                                {activeFilterDropdown === 'indCnf' && (() => {
                                                                    const options = [...new Set(sales.map(s => s.indianCnF).filter(Boolean))].sort();
                                                                    const filtered = options.filter(name => name.toLowerCase().includes((saleFilterSearch.indCnfSearch || '').toLowerCase()));
                                                                    return filtered.length > 0 ? (
                                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                            {filtered.map(name => (
                                                                                <button key={name} type="button" onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, indCnf: name })); setSaleFilterSearch(prev => ({ ...prev, indCnfSearch: name })); setActiveFilterDropdown(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">
                                                                                    {name}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    ) : null;
                                                                })()}
                                                            </div>
                                                            {/* BD C&F Filter */}
                                                            <div className="space-y-1.5 relative" ref={saleBdCnfFilterRef}>
                                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">BD C&F</label>
                                                                <div className="relative">
                                                                    <input autoComplete="off"
                                                                        type="text"
                                                                        value={saleFilterSearch.bdCnfSearch}
                                                                        onChange={(e) => {
                                                                            setSaleFilterSearch(prev => ({ ...prev, bdCnfSearch: e.target.value }));
                                                                            setSaleFilters(prev => ({ ...prev, bdCnf: e.target.value }));
                                                                            setActiveFilterDropdown('bdCnf');
                                                                        }}
                                                                        onFocus={() => setActiveFilterDropdown('bdCnf')}
                                                                        placeholder={saleFilters.bdCnf || 'BD...'}
                                                                        className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${saleFilters.bdCnf ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                                    />
                                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                        {saleFilters.bdCnf && (
                                                                            <button onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, bdCnf: '' })); setSaleFilterSearch(prev => ({ ...prev, bdCnfSearch: '' })); setActiveFilterDropdown(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                                <XIcon className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                    </div>
                                                                </div>
                                                                {activeFilterDropdown === 'bdCnf' && (() => {
                                                                    const options = [...new Set(sales.map(s => s.bdCnf).filter(Boolean))].sort();
                                                                    const filtered = options.filter(name => name.toLowerCase().includes((saleFilterSearch.bdCnfSearch || '').toLowerCase()));
                                                                    return filtered.length > 0 ? (
                                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                            {filtered.map(name => (
                                                                                <button key={name} type="button" onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, bdCnf: name })); setSaleFilterSearch(prev => ({ ...prev, bdCnfSearch: name })); setActiveFilterDropdown(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">
                                                                                    {name}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    ) : null;
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {/* Company Filter (General) */}
                                                        <div className="space-y-1.5 relative" ref={saleCompanyFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">COMPANY NAME</label>
                                                            <div className="relative">
                                                                <input autoComplete="off"
                                                                    type="text"
                                                                    value={saleFilterSearch.companySearch}
                                                                    onChange={(e) => {
                                                                        setSaleFilterSearch(prev => ({ ...prev, companySearch: e.target.value }));
                                                                        setSaleFilters(prev => ({ ...prev, companyName: e.target.value }));
                                                                        setActiveFilterDropdown('company');
                                                                    }}
                                                                    onFocus={() => setActiveFilterDropdown('company')}
                                                                    placeholder={saleFilters.companyName || 'Search company...'}
                                                                    className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${saleFilters.companyName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                                />
                                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                    {saleFilters.companyName && (
                                                                        <button onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, companyName: '' })); setSaleFilterSearch(prev => ({ ...prev, companySearch: '' })); setActiveFilterDropdown(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                            <XIcon className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                            {activeFilterDropdown === 'company' && (() => {
                                                                const options = [...new Set(sales.map(s => s.companyName || s.customerName).filter(Boolean))].sort();
                                                                const filtered = options.filter(c => c.toLowerCase().includes((saleFilterSearch.companySearch || '').toLowerCase()));
                                                                return filtered.length > 0 ? (
                                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        {filtered.map(c => (
                                                                            <button key={c} type="button" onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, companyName: c })); setSaleFilterSearch(prev => ({ ...prev, companySearch: c })); setActiveFilterDropdown(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">
                                                                                {c}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                        </div>

                                                        {/* Invoice Filter (General) */}
                                                        <div className="space-y-1.5 relative" ref={saleInvoiceFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">INVOICE NUMBER</label>
                                                            <div className="relative">
                                                                <input autoComplete="off"
                                                                    type="text"
                                                                    value={saleFilterSearch.invoiceSearch}
                                                                    onChange={(e) => {
                                                                        setSaleFilterSearch(prev => ({ ...prev, invoiceSearch: e.target.value }));
                                                                        setSaleFilters(prev => ({ ...prev, invoiceNo: e.target.value }));
                                                                        setActiveFilterDropdown('invoice');
                                                                    }}
                                                                    onFocus={() => setActiveFilterDropdown('invoice')}
                                                                    placeholder={saleFilters.invoiceNo || 'Search invoice...'}
                                                                    className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${saleFilters.invoiceNo ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                                />
                                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                    {saleFilters.invoiceNo && (
                                                                        <button onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, invoiceNo: '' })); setSaleFilterSearch(prev => ({ ...prev, invoiceSearch: '' })); setActiveFilterDropdown(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                            <XIcon className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                            {activeFilterDropdown === 'invoice' && (() => {
                                                                const options = [...new Set(sales.map(s => s.invoiceNo).filter(Boolean))].sort();
                                                                const filtered = options.filter(inv => inv.toLowerCase().includes((saleFilterSearch.invoiceSearch || '').toLowerCase()));
                                                                return filtered.length > 0 ? (
                                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        {filtered.map(inv => (
                                                                            <button key={inv} type="button" onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, invoiceNo: inv })); setSaleFilterSearch(prev => ({ ...prev, invoiceSearch: inv })); setActiveFilterDropdown(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">
                                                                                {inv}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Common Product Filter */}
                                                <div className="space-y-1.5 relative" ref={saleProductFilterRef}>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">PRODUCT NAME</label>
                                                    <div className="relative">
                                                        <input autoComplete="off"
                                                            type="text"
                                                            value={saleFilterSearch.productSearch}
                                                            onChange={(e) => {
                                                                setSaleFilterSearch(prev => ({ ...prev, productSearch: e.target.value }));
                                                                setSaleFilters(prev => ({ ...prev, productName: e.target.value, brand: '' }));
                                                                setActiveFilterDropdown('product');
                                                            }}
                                                            onFocus={() => setActiveFilterDropdown('product')}
                                                            placeholder={saleFilters.productName || 'Search product...'}
                                                            className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${saleFilters.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                        />
                                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                            {saleFilters.productName && (
                                                                <button onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, productName: '', brand: '' })); setSaleFilterSearch(prev => ({ ...prev, productSearch: '', brandSearch: '' })); setActiveFilterDropdown(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                    <XIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                        </div>
                                                    </div>
                                                    {activeFilterDropdown === 'product' && (() => {
                                                        const allProds = sales.flatMap(s => (s.items || []).map(i => resolveProductName(i.productName || i.product))).filter(Boolean);
                                                        const options = [...new Set(allProds)].sort();
                                                        const filtered = options.filter(p => p.toLowerCase().includes((saleFilterSearch.productSearch || '').toLowerCase()));
                                                        return filtered.length > 0 ? (
                                                            <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                {filtered.map(p => (
                                                                    <button key={p} type="button" onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, productName: p, brand: '' })); setSaleFilterSearch(prev => ({ ...prev, productSearch: p, brandSearch: '' })); setActiveFilterDropdown(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">
                                                                        {p}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                </div>

                                                {/* Common Brand Filter */}
                                                <div className="space-y-1.5 relative" ref={saleBrandFilterRef}>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">BRAND</label>
                                                    <div className="relative">
                                                        <input autoComplete="off"
                                                            type="text"
                                                            value={saleFilterSearch.brandSearch || ''}
                                                            onChange={(e) => {
                                                                if (!saleFilters.productName) return;
                                                                setSaleFilterSearch(prev => ({ ...prev, brandSearch: e.target.value }));
                                                                setSaleFilters(prev => ({ ...prev, brand: e.target.value }));
                                                                setActiveFilterDropdown('brand');
                                                            }}
                                                            onFocus={() => {
                                                                if (saleFilters.productName) {
                                                                    setActiveFilterDropdown('brand');
                                                                }
                                                            }}
                                                            disabled={!saleFilters.productName}
                                                            placeholder={!saleFilters.productName ? 'Select product first' : (saleFilters.brand || 'Search brand...')}
                                                            className={`w-full px-4 py-2 rounded-xl text-sm focus:ring-2 outline-none transition-all shadow-sm pr-14 ${!saleFilters.productName ? 'bg-gray-50 border border-gray-100 text-gray-400 cursor-not-allowed' : `bg-white border border-gray-100 hover:border-gray-200 focus:ring-blue-500/10 focus:border-blue-500 ${saleFilters.brand ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}`}
                                                        />
                                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                            {saleFilters.brand && (
                                                                <button onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, brand: '' })); setSaleFilterSearch(prev => ({ ...prev, brandSearch: '' })); setActiveFilterDropdown(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                    <XIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                        </div>
                                                    </div>
                                                    {activeFilterDropdown === 'brand' && saleFilters.productName && (() => {
                                                        const brands = getBrandsForSelectedProduct();
                                                        const filtered = brands.filter(b => b.toLowerCase().includes((saleFilterSearch.brandSearch || '').toLowerCase()));
                                                        return filtered.length > 0 ? (
                                                            <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                {filtered.map(b => (
                                                                    <button key={b} type="button" onMouseDown={(e) => { e.preventDefault(); setSaleFilters(prev => ({ ...prev, brand: b })); setSaleFilterSearch(prev => ({ ...prev, brandSearch: b })); setActiveFilterDropdown(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700">
                                                                        {b}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                if (setSalesReportData) setSalesReportData(getFilteredData());
                                if (setSalesReportSearchQuery) setSalesReportSearchQuery(searchQuery);
                                setShowSalesReport(true);
                            }}
                            className="sale-mgmt-btn-action sale-mgmt-btn-white"
                        >
                            <BarChartIcon className="w-5 h-5" />
                            <span>Report</span>
                        </button>

                        {canAdd && (
                            <button
                                onClick={() => {
                                    resetForm();
                                    setEditingId(null);
                                    setShowForm(true);
                                }}
                                className="sale-mgmt-btn-action sale-mgmt-btn-blue"
                            >
                                <span className="flex items-center gap-2"><span className="text-xl leading-none">+</span> {saleType === 'Border' ? 'New G.P' : 'Add Sale'}</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Summary Cards */}
            {!showForm && (
                <div className={`sale-mgmt-summary-grid ${saleType === 'Border' ? 'md:!grid-cols-5' : ''}`}>
                    {saleType === 'Border' && (
                        <div className="sale-mgmt-card bg-blue-50/50 border-blue-100">
                            <div className="sale-mgmt-card-label text-blue-500">Total Truck</div>
                            <div className="sale-mgmt-card-value text-blue-700">{stats.totalTrucks.toLocaleString('en-US')}</div>
                        </div>
                    )}
                    <div className="sale-mgmt-card sale-mgmt-card-default">
                        <div className="sale-mgmt-card-label text-gray-400">Total Sales</div>
                        <div className="sale-mgmt-card-value text-gray-900">৳ {stats.totalSales.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="sale-mgmt-card sale-mgmt-card-red">
                        <div className="sale-mgmt-card-label text-red-600">Total Disc.</div>
                        <div className="sale-mgmt-card-value text-red-700">৳ {stats.totalDiscount.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="sale-mgmt-card sale-mgmt-card-emerald">
                        <div className="sale-mgmt-card-label text-emerald-600">Truck Fare</div>
                        <div className="sale-mgmt-card-value text-emerald-700">৳ {stats.totalPaid.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="sale-mgmt-card sale-mgmt-card-orange">
                        <div className="sale-mgmt-card-label text-orange-600">Total Balance</div>
                        <div className="sale-mgmt-card-value text-orange-700">৳ {stats.totalDue.toLocaleString('en-IN')}</div>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="sale-mgmt-form-container">

                    <div className="sale-mgmt-form-header">
                        <h3 className="sale-mgmt-form-title">{editingId ? 'Edit Sale' : (saleType === 'Border' ? 'New Gate Pass Entry' : 'New Sale Entry')}</h3>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-red-500 transition-colors">
                            <XIcon className="w-6 h-6" />
                        </button>
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
                        <div className={`grid grid-cols-1 gap-4 col-span-2 ${saleType === 'Border' ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
                            <CustomDatePicker
                                label="Date"
                                name="date"
                                value={formData.date}
                                onChange={handleInputChange}
                                compact={true}
                                readOnly={isFieldReadOnly(originalData?.date)}
                            />
                            {saleType !== 'Border' && (
                                <div className="sale-mgmt-input-group relative order-dropdown-container">
                                    <label className="sale-mgmt-label">Order ID</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="orderNo"
                                            placeholder={formData.orderNo || "Search Order..."}
                                            value={activeDropdown === 'orderNo' ? orderSearch : formData.orderNo}
                                            readOnly={isFieldReadOnly(originalData?.orderNo)}
                                            onChange={(e) => {
                                                if (isFieldReadOnly(originalData?.orderNo)) return;
                                                setOrderSearch(e.target.value);
                                                setActiveDropdown('orderNo');
                                                setHighlightedIndex(-1);
                                                handleInputChange(e);
                                            }}
                                            autoComplete="off"
                                            onFocus={() => {
                                                if (isFieldReadOnly(originalData?.orderNo)) return;
                                                setOrderSearch(formData.orderNo || '');
                                                setActiveDropdown('orderNo');
                                                setHighlightedIndex(-1);
                                            }}
                                            onKeyDown={(e) => !isFieldReadOnly(originalData?.orderNo) && handleDropdownKeyDown(e, 'orderNo', getFilteredOrders(), handleOrderSelect)}
                                            className={`sale-mgmt-input pr-14 ${formData.orderNo ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.orderNo) ? 'bg-gray-50' : ''}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {formData.orderNo && (
                                                <button type="button" onClick={() => handleOrderSelect(null)} className="text-gray-400 hover:text-red-500">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setActiveDropdown(activeDropdown === 'orderNo' ? null : 'orderNo')}
                                                className="text-gray-300 hover:text-blue-500 transition-colors"
                                            >
                                                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'orderNo' ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                    {activeDropdown === 'orderNo' && getFilteredOrders().length > 0 && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                            {getFilteredOrders().map((ord, idx) => {
                                                const ordId = ord.orderNo || ord.invoiceNo || '-';
                                                const comp = ord.companyName || ord.customerName || '-';
                                                return (
                                                    <button
                                                        key={ord._id || `ord-${idx}`}
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            handleOrderSelect(ord);
                                                        }}
                                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                                        className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.orderNo === ordId ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-blue-600">{ordId}</span>
                                                            <span className="text-[11px] text-gray-500">{comp} | {formatDate(ord.date)}</span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="sale-mgmt-input-group" style={saleType !== 'Border' ? { display: 'none' } : {}}>
                                <label className="sale-mgmt-label">Invoice No</label>
                                <input autoComplete="off" type="text" name="invoiceNo" value={formData.invoiceNo} readOnly placeholder="Auto-generated" className="sale-mgmt-input sale-mgmt-input-readonly cursor-default" />
                            </div>

                            {saleType === 'Border' && (
                                <div className="sale-mgmt-input-group relative lc-dropdown-container">
                                    <label className="sale-mgmt-label">LC No</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="lcNo"
                                            placeholder={formData.lcNo || "Search LC..."}
                                            value={activeDropdown === 'lcNo' ? lcSearch : formData.lcNo}
                                            readOnly={isFieldReadOnly(originalData?.lcNo)}
                                            onChange={(e) => {
                                                if (isFieldReadOnly(originalData?.lcNo)) return;
                                                setLcSearch(e.target.value);
                                                setActiveDropdown('lcNo');
                                                setHighlightedIndex(-1);
                                                handleInputChange(e);
                                            }}
                                            autoComplete="off"
                                            onFocus={() => {
                                                if (isFieldReadOnly(originalData?.lcNo)) return;
                                                setLcSearch(formData.lcNo || '');
                                                setActiveDropdown('lcNo');
                                                setHighlightedIndex(-1);
                                            }}
                                            onKeyDown={(e) => !isFieldReadOnly(originalData?.lcNo) && handleDropdownKeyDown(e, 'lcNo', getFilteredLCs(), handleLcSelect)}
                                            className={`sale-mgmt-input pr-14 ${formData.lcNo ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.lcNo) ? 'bg-gray-50' : ''}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {formData.lcNo && (
                                                <button type="button" onClick={() => handleLcSelect(null)} className="text-gray-400 hover:text-red-500">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setActiveDropdown(activeDropdown === 'lcNo' ? null : 'lcNo')}
                                                className="text-gray-300 hover:text-blue-500 transition-colors"
                                            >
                                                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'lcNo' ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                    {activeDropdown === 'lcNo' && getFilteredLCs().length > 0 && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                            {getFilteredLCs().map((lc, idx) => (
                                                <button
                                                    key={lc._id || `lc-${idx}`}
                                                    type="button"
                                                    onClick={() => handleLcSelect(lc)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.lcNo === lc.lcNo ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-bold">{lc.lcNo}</span>
                                                        <span className="text-[10px] text-gray-500">
                                                            {lc.importerName} | {
                                                                (() => {
                                                                    const matched = products.find(p =>
                                                                        (p.name || '').toLowerCase().trim() === (lc.productName || '').toLowerCase().trim() ||
                                                                        (p.ipName || '').toLowerCase().trim() === (lc.productName || '').toLowerCase().trim()
                                                                    );
                                                                    return matched ? matched.name : (lc.productName || '');
                                                                })()
                                                            }
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {saleType !== 'Border' && (
                                <>
                                    <div className="sale-mgmt-input-group">
                                        <label className="sale-mgmt-label">Challan- No</label>
                                        <input
                                            autoComplete="off"
                                            type="text"
                                            name="challanNo"
                                            value={formData.challanNo || ''}
                                            onChange={handleInputChange}
                                            placeholder="Challan No"
                                            className="sale-mgmt-input"
                                        />
                                    </div>
                                    <div className="sale-mgmt-input-group">
                                        <label className="sale-mgmt-label">Truck No</label>
                                        <input
                                            autoComplete="off"
                                            type="text"
                                            name="truckNo"
                                            value={formData.truckNo || ''}
                                            onChange={handleInputChange}
                                            placeholder="Truck No"
                                            className="sale-mgmt-input"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Border Field: Importer */}
                            {saleType === 'Border' && (
                                <div className="sale-mgmt-input-group relative importer-dropdown-container">
                                    <label className="sale-mgmt-label">Importer</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="importer"
                                            placeholder={formData.importer || "Search importer..."}
                                            value={activeDropdown === 'importer' ? importerSearch : formData.importer}
                                            readOnly={isFieldReadOnly(originalData?.importer)}
                                            onChange={(e) => {
                                                if (isFieldReadOnly(originalData?.importer)) return;
                                                setImporterSearch(e.target.value);
                                                setActiveDropdown('importer');
                                                setHighlightedIndex(-1);
                                                handleInputChange(e); // allow fallback text input
                                            }}
                                            autoComplete="off"
                                            onFocus={() => {
                                                if (isFieldReadOnly(originalData?.importer)) return;
                                                setImporterSearch(formData.importer || '');
                                                setActiveDropdown('importer');
                                                setHighlightedIndex(-1);
                                            }}
                                            onKeyDown={(e) => !isFieldReadOnly(originalData?.importer) && handleDropdownKeyDown(e, 'importer', getFilteredImporters(), handleImporterSelect)}
                                            className={`sale-mgmt-input pr-14 ${formData.importer ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.importer) ? 'bg-gray-50' : ''}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {formData.importer && (
                                                <button type="button" onClick={() => handleImporterSelect(null)} className="text-gray-400 hover:text-red-500">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setActiveDropdown(activeDropdown === 'importer' ? null : 'importer')}
                                                className="text-gray-300 hover:text-blue-500 transition-colors"
                                            >
                                                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'importer' ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                    {activeDropdown === 'importer' && getFilteredImporters().length > 0 && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                            {getFilteredImporters().map((importer, idx) => (
                                                <button
                                                    key={importer._id || `imp-${idx}`}
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); handleImporterSelect(importer.name); }}
                                                    onClick={() => handleImporterSelect(importer.name)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.importer === importer.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {importer.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Border Field: Exporter */}
                            {saleType === 'Border' && (
                                <div className="sale-mgmt-input-group relative exporter-dropdown-container">
                                    <label className="sale-mgmt-label">Exporter</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="exporter"
                                            placeholder={formData.exporter || "Search exporter..."}
                                            value={activeDropdown === 'exporter' ? exporterSearch : formData.exporter}
                                            readOnly={isFieldReadOnly(originalData?.exporter)}
                                            onChange={(e) => {
                                                if (isFieldReadOnly(originalData?.exporter)) return;
                                                setExporterSearch(e.target.value);
                                                setActiveDropdown('exporter');
                                                setHighlightedIndex(-1);
                                                handleInputChange(e); // allow fallback text input
                                            }}
                                            autoComplete="off"
                                            onFocus={() => {
                                                if (isFieldReadOnly(originalData?.exporter)) return;
                                                setExporterSearch(formData.exporter || '');
                                                setActiveDropdown('exporter');
                                                setHighlightedIndex(-1);
                                            }}
                                            onKeyDown={(e) => !isFieldReadOnly(originalData?.exporter) && handleDropdownKeyDown(e, 'exporter', getFilteredExporters(), handleExporterSelect)}
                                            className={`sale-mgmt-input appearance-none pr-14 ${formData.exporter ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.exporter) ? 'bg-gray-50' : ''}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {formData.exporter && (
                                                <button type="button" onClick={() => handleExporterSelect(null)} className="text-gray-400 hover:text-red-500">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setActiveDropdown(activeDropdown === 'exporter' ? null : 'exporter')}
                                                className="text-gray-300 hover:text-blue-500 transition-colors"
                                            >
                                                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'exporter' ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                    {activeDropdown === 'exporter' && getFilteredExporters().length > 0 && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                            {getFilteredExporters().map((exp, idx) => (
                                                <button
                                                    key={exp._id || `exp-${idx}`}
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); handleExporterSelect(exp.name); }}
                                                    onClick={() => handleExporterSelect(exp.name)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.exporter === exp.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {exp.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Border Field: IND C&F */}
                            {saleType === 'Border' && (
                                <div className="sale-mgmt-input-group relative ind-cnf-dropdown-container">
                                    <label className="sale-mgmt-label">IND C&F <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="indianCnF"
                                            placeholder={formData.indianCnF || "Search IND C&F..."}
                                            value={activeDropdown === 'indianCnF' ? indCnfSearch : formData.indianCnF}
                                            readOnly={isFieldReadOnly(originalData?.indianCnF)}
                                            onChange={(e) => {
                                                if (isFieldReadOnly(originalData?.indianCnF)) return;
                                                setIndCnfSearch(e.target.value);
                                                setActiveDropdown('indianCnF');
                                                setHighlightedIndex(-1);
                                                handleInputChange(e); // allow fallback text input
                                            }}
                                            autoComplete="off"
                                            onFocus={() => {
                                                if (isFieldReadOnly(originalData?.indianCnF)) return;
                                                setIndCnfSearch(formData.indianCnF || '');
                                                setActiveDropdown('indianCnF');
                                                setHighlightedIndex(-1);
                                            }}
                                            onKeyDown={(e) => !isFieldReadOnly(originalData?.indianCnF) && handleDropdownKeyDown(e, 'indianCnF', getFilteredIndianCnfs(), handleIndCnfSelect)}
                                            className={`sale-mgmt-input pr-14 ${formData.indianCnF ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.indianCnF) ? 'bg-gray-50' : ''}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {formData.indianCnF && (
                                                <button type="button" onClick={() => handleIndCnfSelect(null)} className="text-gray-400 hover:text-red-500">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setActiveDropdown(activeDropdown === 'indianCnF' ? null : 'indianCnF')}
                                                className="text-gray-300 hover:text-blue-500 transition-colors"
                                            >
                                                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'indianCnF' ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                    {activeDropdown === 'indianCnF' && getFilteredIndianCnfs().length > 0 && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                            {getFilteredIndianCnfs().map((cnf, idx) => (
                                                <button
                                                    key={cnf._id || `indcnf-${idx}`}
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); handleIndCnfSelect(cnf.name); }}
                                                    onClick={() => handleIndCnfSelect(cnf.name)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.indianCnF === cnf.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {cnf.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Border Field: BD C&F */}
                            {saleType === 'Border' && (
                                <div className="sale-mgmt-input-group relative bd-cnf-dropdown-container">
                                    <label className="sale-mgmt-label">BD C&F <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="bdCnf"
                                            placeholder={formData.bdCnf || "Search BD C&F..."}
                                            value={activeDropdown === 'bdCnf' ? bdCnfSearch : formData.bdCnf}
                                            readOnly={isFieldReadOnly(originalData?.bdCnf)}
                                            onChange={(e) => {
                                                if (isFieldReadOnly(originalData?.bdCnf)) return;
                                                setBdCnfSearch(e.target.value);
                                                setActiveDropdown('bdCnf');
                                                setHighlightedIndex(-1);
                                                handleInputChange(e); // allow fallback text input
                                            }}
                                            autoComplete="off"
                                            onFocus={() => {
                                                if (isFieldReadOnly(originalData?.bdCnf)) return;
                                                setBdCnfSearch(formData.bdCnf || '');
                                                setActiveDropdown('bdCnf');
                                                setHighlightedIndex(-1);
                                            }}
                                            onKeyDown={(e) => !isFieldReadOnly(originalData?.bdCnf) && handleDropdownKeyDown(e, 'bdCnf', getFilteredBdCnfs(), handleBdCnfSelect)}
                                            className={`sale-mgmt-input pr-14 ${formData.bdCnf ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.bdCnf) ? 'bg-gray-50' : ''}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {formData.bdCnf && (
                                                <button type="button" onClick={() => handleBdCnfSelect(null)} className="text-gray-400 hover:text-red-500">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setActiveDropdown(activeDropdown === 'bdCnf' ? null : 'bdCnf')}
                                                className="text-gray-300 hover:text-blue-500 transition-colors"
                                            >
                                                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'bdCnf' ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                    {activeDropdown === 'bdCnf' && getFilteredBdCnfs().length > 0 && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                            {getFilteredBdCnfs().map((cnf, idx) => (
                                                <button
                                                    key={cnf._id || `bdcnf-${idx}`}
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); handleBdCnfSelect(cnf.name); }}
                                                    onClick={() => handleBdCnfSelect(cnf.name)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.bdCnf === cnf.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {cnf.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Border Field: Port */}
                            {saleType === 'Border' && (
                                <div className="sale-mgmt-input-group relative port-dropdown-container">
                                    <label className="sale-mgmt-label">Port</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="port"
                                            placeholder={formData.port || "Search port..."}
                                            value={activeDropdown === 'port' ? portSearch : formData.port}
                                            readOnly={isFieldReadOnly(originalData?.port)}
                                            onChange={(e) => {
                                                if (isFieldReadOnly(originalData?.port)) return;
                                                setPortSearch(e.target.value);
                                                setActiveDropdown('port');
                                                setHighlightedIndex(-1);
                                                handleInputChange(e); // allow fallback text input
                                            }}
                                            autoComplete="off"
                                            onFocus={() => {
                                                if (isFieldReadOnly(originalData?.port)) return;
                                                setPortSearch(formData.port || '');
                                                setActiveDropdown('port');
                                                setHighlightedIndex(-1);
                                            }}
                                            onKeyDown={(e) => !isFieldReadOnly(originalData?.port) && handleDropdownKeyDown(e, 'port', getFilteredPorts(), handlePortSelect)}
                                            className={`sale-mgmt-input pr-14 ${formData.port ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.port) ? 'bg-gray-50' : ''}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {formData.port && (
                                                <button type="button" onClick={() => handlePortSelect(null)} className="text-gray-400 hover:text-red-500">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setActiveDropdown(activeDropdown === 'port' ? null : 'port')}
                                                className="text-gray-300 hover:text-blue-500 transition-colors"
                                            >
                                                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'port' ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                    {activeDropdown === 'port' && getFilteredPorts().length > 0 && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                            {getFilteredPorts().map((port, idx) => (
                                                <button
                                                    key={port._id || `port-${idx}`}
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); handlePortSelect(port.name); }}
                                                    onClick={() => handlePortSelect(port.name)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.port === port.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {port.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* Border Field: Company Name & Contact (relocated after Port) */}
                            {saleType === 'Border' && (
                                <>
                                    {/* Company Name Select */}
                                    <div className="sale-mgmt-input-group relative company-dropdown-container">
                                        <label className="sale-mgmt-label">Company Name <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder={formData.companyName || "Search company..."}
                                                value={activeDropdown === 'companyName' ? companyNameSearch : (formData.companyName || '')}
                                                readOnly={isFieldReadOnly(originalData?.companyName)}
                                                onChange={(e) => {
                                                    if (isFieldReadOnly(originalData?.companyName)) return;
                                                    setCompanyNameSearch(e.target.value);
                                                    setActiveDropdown('companyName');
                                                    setHighlightedIndex(-1);
                                                    setFormData(prev => ({ ...prev, companyName: e.target.value }));
                                                }}
                                                autoComplete="off"
                                                onFocus={() => {
                                                    if (isFieldReadOnly(originalData?.companyName)) return;
                                                    setCompanyNameSearch(formData.companyName || '');
                                                    setActiveDropdown('companyName');
                                                    setHighlightedIndex(-1);
                                                }}
                                                onKeyDown={(e) => !isFieldReadOnly(originalData?.companyName) && handleDropdownKeyDown(e, 'companyName', getFilteredCompanies(), handleCompanyNameSelect)}
                                                className={`sale-mgmt-input pr-14 ${formData.companyName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.companyName) ? 'bg-gray-50' : ''}`}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                {formData.companyName && (
                                                    <button type="button" onClick={() => handleCompanyNameSelect(null)} className="text-gray-400 hover:text-red-500">
                                                        <XIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveDropdown(activeDropdown === 'companyName' ? null : 'companyName')}
                                                    className="text-gray-300 hover:text-blue-500 transition-colors"
                                                >
                                                    <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'companyName' ? 'rotate-180' : ''}`} />
                                                </button>
                                            </div>
                                        </div>
                                        {activeDropdown === 'companyName' && getFilteredCompanies().length > 0 && (
                                            <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                {getFilteredCompanies().map((c, idx) => (
                                                    <button
                                                        key={c._id}
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            handleCompanyNameSelect(c);
                                                        }}
                                                        onClick={() => handleCompanyNameSelect(c)}
                                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                                        className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.customerId === c._id ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                    >
                                                        {c.companyName} ({c.customerName})
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="sale-mgmt-input-group">
                                        <label className="sale-mgmt-label">Contact</label>
                                        <input autoComplete="off" type="text" name="contact" value={formData.contact} readOnly placeholder="Contact" className="sale-mgmt-input sale-mgmt-input-readonly" />
                                    </div>
                                </>
                            )}

                        </div>

                        {/* Second row: Company Name, Customer, Contact, Address */}
                        {saleType !== 'Border' && (
                            <div className="grid grid-cols-1 gap-4 col-span-2 md:grid-cols-4">

                                {/* Company Name Select */}
                                <div className="sale-mgmt-input-group relative company-dropdown-container">
                                    <label className="sale-mgmt-label">Company Name</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder={formData.companyName || "Search company..."}
                                            value={activeDropdown === 'companyName' ? companyNameSearch : (formData.companyName || '')}
                                            readOnly={isFieldReadOnly(originalData?.companyName)}
                                            onChange={(e) => {
                                                if (isFieldReadOnly(originalData?.companyName)) return;
                                                setCompanyNameSearch(e.target.value);
                                                setActiveDropdown('companyName');
                                                setHighlightedIndex(-1);
                                                setFormData(prev => ({ ...prev, companyName: e.target.value }));
                                            }}
                                            autoComplete="off"
                                            onFocus={() => {
                                                if (isFieldReadOnly(originalData?.companyName)) return;
                                                setCompanyNameSearch(formData.companyName || '');
                                                setActiveDropdown('companyName');
                                                setHighlightedIndex(-1);
                                            }}
                                            onKeyDown={(e) => !isFieldReadOnly(originalData?.companyName) && handleDropdownKeyDown(e, 'companyName', getFilteredCompanies(), handleCompanyNameSelect)}
                                            className={`sale-mgmt-input pr-14 ${formData.companyName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.companyName) ? 'bg-gray-50' : ''}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {formData.companyName && (
                                                <button type="button" onClick={() => handleCompanyNameSelect(null)} className="text-gray-400 hover:text-red-500">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setActiveDropdown(activeDropdown === 'companyName' ? null : 'companyName')}
                                                className="text-gray-300 hover:text-blue-500 transition-colors"
                                            >
                                                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'companyName' ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                    {activeDropdown === 'companyName' && getFilteredCompanies().length > 0 && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                            {getFilteredCompanies().map((c, idx) => (
                                                <button
                                                    key={c._id}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        handleCompanyNameSelect(c);
                                                    }}
                                                    onClick={() => handleCompanyNameSelect(c)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.customerId === c._id ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {c.companyName} ({c.customerName})
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="sale-mgmt-input-group">
                                    <label className="sale-mgmt-label">Customer</label>
                                    <input autoComplete="off" type="text" name="customerName" value={formData.customerName} readOnly placeholder="Customer" className="sale-mgmt-input sale-mgmt-input-readonly" />
                                </div>
                                <div className="sale-mgmt-input-group">
                                    <label className="sale-mgmt-label">Contact</label>
                                    <input autoComplete="off" type="text" name="contact" value={formData.contact} readOnly placeholder="Contact" className="sale-mgmt-input sale-mgmt-input-readonly" />
                                </div>
                                <div className="sale-mgmt-input-group">
                                    <label className="sale-mgmt-label">Address</label>
                                    <input autoComplete="off" type="text" name="address" value={formData.address} readOnly placeholder="Address" className="sale-mgmt-input sale-mgmt-input-readonly" />
                                </div>

                            </div>
                        )}

                        {/* Dummy spacer div to maintain col-span-2 for Border commissions row */}
                        {/* Border Field: Commissions Row */}
                        {saleType === 'Border' && (
                            <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-blue-50/30 rounded-2xl border border-blue-100/50 mb-2">
                                {/* Indian C&F Commission */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest pl-1">IND C&F Commission</span>
                                        <div className="flex items-center bg-white p-0.5 rounded-lg border border-blue-100 shadow-sm h-7 w-32">
                                            <button
                                                type="button"
                                                onClick={() => handleInputChange({ target: { name: 'indCommissionUom', value: 'Truck' } })}
                                                className={`flex-1 h-full flex items-center justify-center rounded-md text-[9px] font-bold transition-all ${formData.indCommissionUom === 'Truck' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-blue-500'}`}
                                            >
                                                TRUCK
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleInputChange({ target: { name: 'indCommissionUom', value: 'QTY' } })}
                                                className={`flex-1 h-full flex items-center justify-center rounded-md text-[9px] font-bold transition-all ${formData.indCommissionUom === 'QTY' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-blue-500'}`}
                                            >
                                                QTY
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 relative">
                                            <input autoComplete="off"
                                                type="number"
                                                name="indCommissionRate"
                                                value={formData.indCommissionRate}
                                                onChange={handleInputChange}
                                                placeholder="Rate"
                                                className="w-full px-4 py-2 bg-white border border-blue-100 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">Rate</div>
                                        </div>
                                        <div className="flex-1 px-4 py-2 bg-blue-100/50 border border-blue-200 rounded-xl flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-blue-400 uppercase">Total</span>
                                            <span className="text-sm font-black text-blue-700">৳{formData.indCommissionTotal}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* BD C&F Commission */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest pl-1">BD C&F Commission</span>
                                        <div className="flex items-center bg-white p-0.5 rounded-lg border border-blue-100 shadow-sm h-7 w-32">
                                            <button
                                                type="button"
                                                onClick={() => handleInputChange({ target: { name: 'bdCommissionUom', value: 'Truck' } })}
                                                className={`flex-1 h-full flex items-center justify-center rounded-md text-[9px] font-bold transition-all ${formData.bdCommissionUom === 'Truck' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-blue-500'}`}
                                            >
                                                TRUCK
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleInputChange({ target: { name: 'bdCommissionUom', value: 'QTY' } })}
                                                className={`flex-1 h-full flex items-center justify-center rounded-md text-[9px] font-bold transition-all ${formData.bdCommissionUom === 'QTY' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-blue-500'}`}
                                            >
                                                QTY
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 relative">
                                            <input autoComplete="off"
                                                type="number"
                                                name="bdCommissionRate"
                                                value={formData.bdCommissionRate}
                                                readOnly={isFieldReadOnly(originalData?.bdCommissionRate)}
                                                onChange={handleInputChange}
                                                placeholder="Rate"
                                                className={`w-full px-4 py-2 bg-white border border-blue-100 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${isFieldReadOnly(originalData?.bdCommissionRate) ? 'bg-gray-50' : ''}`}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">Rate</div>
                                        </div>
                                        <div className="flex-1 px-4 py-2 bg-blue-100/50 border border-blue-200 rounded-xl flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-blue-400 uppercase">Total</span>
                                            <span className="text-sm font-black text-blue-700">৳{formData.bdCommissionTotal}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="col-span-2 space-y-6">
                            <div className="flex items-center justify-between">
                                <h4 className="text-base font-bold text-gray-800 flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                                    Product Details
                                </h4>
                                {(isFullAdmin || canEdit || !editingId) && (
                                    <button
                                        type="button"
                                        onClick={addProductItem}
                                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-2"
                                    >
                                        <span className="text-lg">+</span> Add Product
                                    </button>
                                )}
                            </div>

                            <div className="space-y-8">
                                {formData.items.map((item, index) => (
                                    <div key={index} className="sale-mgmt-product-card group/item">
                                        {/* Remove Product Button */}
                                        {formData.items.length > 1 && (isFullAdmin || canEdit || !editingId) && (
                                            <button
                                                type="button"
                                                onClick={() => removeProductItem(index)}
                                                className="absolute -top-3 -right-3 p-2.5 bg-white text-gray-400 hover:text-red-500 rounded-xl shadow-lg border border-gray-100 opacity-0 group-hover/item:opacity-100 transition-all z-20"
                                            >
                                                < TrashIcon className="w-4 h-4" />
                                            </button>
                                        )}

                                        <div className="flex flex-row items-center gap-4 mb-6 px-4">
                                            {/* Product Selection */}
                                            <div className="space-y-1.5 relative product-dropdown-container flex-1">
                                                <label className="sale-mgmt-item-label">Product</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Select Product"
                                                        value={activeDropdown === 'product' && activeItemIndex === index ? productSearch : (item.productName || '')}
                                                        readOnly={isFieldReadOnly(originalData?.items?.[index]?.productName)}
                                                        onChange={(e) => {
                                                            if (isFieldReadOnly(originalData?.items?.[index]?.productName)) return;
                                                            setProductSearch(e.target.value);
                                                            setActiveDropdown('product');
                                                            setActiveItemIndex(index);
                                                            setHighlightedIndex(-1);
                                                            handleItemInputChange(index, null, { target: { name: 'productName', value: e.target.value } });
                                                        }}
                                                        required
                                                        autoComplete="off"
                                                        onFocus={() => {
                                                            if (isFieldReadOnly(originalData?.items?.[index]?.productName)) return;
                                                            setProductSearch(item.productName || '');
                                                            setActiveDropdown('product');
                                                            setActiveItemIndex(index);
                                                            setHighlightedIndex(-1);
                                                        }}
                                                        onKeyDown={(e) => !isFieldReadOnly(originalData?.items?.[index]?.productName) && handleDropdownKeyDown(e, 'product', getFilteredProducts(), handleProductSelect)}
                                                        className={`sale-mgmt-input pr-14 ${item.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.items?.[index]?.productName) ? 'bg-gray-50' : ''}`}
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {item.productName && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    handleProductSelect({ _id: '', name: '' });
                                                                    setProductSearch('');
                                                                }}
                                                                className="text-gray-400 hover:text-red-500"
                                                            >
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setActiveDropdown(activeDropdown === 'product' && activeItemIndex === index ? null : 'product');
                                                                setActiveItemIndex(index);
                                                            }}
                                                            className="text-gray-300 hover:text-blue-500 transition-colors"
                                                        >
                                                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'product' && activeItemIndex === index ? 'rotate-180' : ''}`} />
                                                        </button>
                                                    </div>
                                                    {activeDropdown === 'product' && activeItemIndex === index && getFilteredProducts().length > 0 && (
                                                        <div className="absolute z-[70] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                                            {getFilteredProducts().map((p, idx) => (
                                                                <button
                                                                    key={p._id || `prod-${idx}`}
                                                                    type="button"
                                                                    onClick={() => handleProductSelect(p)}
                                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors font-medium ${item.productName === p.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                >
                                                                    {p.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Order QTY Display after Product on same line - only for selected order no */}
                                            {formData.orderNo && (
                                                <div className="space-y-1.5 flex-1 md:max-w-[180px]">
                                                    <label className="sale-mgmt-item-label">Order QTY</label>
                                                    <div className="h-10 flex items-center justify-center bg-purple-50/50 border border-purple-100 rounded-xl text-sm font-bold text-purple-900 shadow-sm">
                                                        {getOrderQtyForBrand(item.productName)} kg
                                                    </div>
                                                </div>
                                            )}

                                            {/* UOM Selector for General Sales */}
                                            {saleType !== 'Border' && (
                                                <div className="space-y-1.5 flex-1 md:max-w-[200px]">
                                                    <label className="sale-mgmt-item-label">UOM</label>
                                                    <div className="flex items-center bg-gray-50/50 p-1 rounded-xl border border-gray-100/50 h-10 shadow-inner group/uom">
                                                        <button
                                                            type="button"
                                                            disabled={isFieldReadOnly(originalData?.items?.[index]?.uom)}
                                                            onClick={() => handleItemInputChange(index, null, { target: { name: 'uom', value: 'QTY' } })}
                                                            className={`flex-1 h-full flex items-center justify-center rounded-lg text-xs font-black transition-all duration-200 ${item.uom === 'QTY' || !item.uom ? 'bg-white text-blue-600 shadow-md ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'} ${isFieldReadOnly(originalData?.items?.[index]?.uom) ? 'cursor-not-allowed opacity-50' : ''}`}
                                                        >
                                                            QTY
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={isFieldReadOnly(originalData?.items?.[index]?.uom)}
                                                            onClick={() => handleItemInputChange(index, null, { target: { name: 'uom', value: 'BAG' } })}
                                                            className={`flex-1 h-full flex items-center justify-center rounded-lg text-xs font-black transition-all duration-200 ${item.uom === 'BAG' ? 'bg-white text-blue-600 shadow-md ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'} ${isFieldReadOnly(originalData?.items?.[index]?.uom) ? 'cursor-not-allowed opacity-50' : ''}`}
                                                        >
                                                            BAG
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {saleType === 'Border' && (
                                            <div className="flex-[3] space-y-4 pt-1">
                                                <div className="hidden md:grid grid-cols-6 gap-4 px-4">
                                                    <div className="sale-mgmt-item-label text-center">UOM</div>
                                                    <div className="sale-mgmt-item-label text-center">Qty</div>
                                                    <div className="sale-mgmt-item-label text-center">Bag</div>
                                                    <div className="sale-mgmt-item-label text-center">Truck</div>
                                                    <div className="sale-mgmt-item-label text-center">Price</div>
                                                    <div className="sale-mgmt-item-label text-center">Total</div>
                                                </div>
                                                {item.brandEntries.map((entry, entryIndex) => (
                                                    <div key={entryIndex} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center px-4">
                                                        {/* UOM Toggle */}
                                                        <div className="relative">
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block">UOM</label>
                                                            <div className="flex items-center bg-gray-50/50 p-1 rounded-xl border border-gray-100/50 h-10 shadow-inner group/uom">
                                                                <button
                                                                    type="button"
                                                                    disabled={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.uom)}
                                                                    onClick={() => handleItemInputChange(index, entryIndex, { target: { name: 'uom', value: 'QTY' } })}
                                                                    className={`flex-1 h-full flex items-center justify-center rounded-lg text-[10px] font-black transition-all duration-200 ${entry.uom === 'QTY' ? 'bg-white text-blue-600 shadow-md ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'} ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.uom) ? 'cursor-not-allowed opacity-50' : ''}`}
                                                                >
                                                                    QTY
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.uom)}
                                                                    onClick={() => handleItemInputChange(index, entryIndex, { target: { name: 'uom', value: 'Truck' } })}
                                                                    className={`flex-1 h-full flex items-center justify-center rounded-lg text-[10px] font-black transition-all duration-200 ${entry.uom === 'Truck' || !entry.uom ? 'bg-white text-blue-600 shadow-md ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'} ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.uom) ? 'cursor-not-allowed opacity-50' : ''}`}
                                                                >
                                                                    TRUCK
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Qty</label>
                                                            <input autoComplete="off" type="number" name="quantity" value={entry.quantity} onChange={(e) => handleItemInputChange(index, entryIndex, e)} readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.quantity)} placeholder="0" required className={`sale-mgmt-input !px-2 !text-[13px] font-black text-gray-900 text-center ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.quantity) ? 'bg-gray-50' : ''}`} />
                                                        </div>
                                                        <div>
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Bag</label>
                                                            <input autoComplete="off" type="number" name="bag" value={entry.bag} onChange={(e) => handleItemInputChange(index, entryIndex, e)} readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.bag)} placeholder="0" className={`sale-mgmt-input !px-2 !text-[13px] font-bold text-blue-600 text-center ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.bag) ? 'bg-gray-50' : ''}`} />
                                                        </div>
                                                        <div>
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Truck</label>
                                                            <input autoComplete="off" type="number" name="truck" value={entry.truck || ''} onChange={(e) => handleItemInputChange(index, entryIndex, e)} readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.truck)} placeholder="0" required className={`sale-mgmt-input !px-2 !text-[13px] font-bold text-gray-600 text-center ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.truck) ? 'bg-gray-50' : ''}`} />
                                                        </div>
                                                        <div>
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Price</label>
                                                            <input autoComplete="off" type="number" name="unitPrice" value={entry.unitPrice} onChange={(e) => handleItemInputChange(index, entryIndex, e)} readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.unitPrice)} placeholder="0" className={`sale-mgmt-input !px-2 !text-[13px] font-bold text-gray-600 text-center ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.unitPrice) ? 'bg-gray-50' : ''}`} />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1">
                                                                <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Total</label>
                                                                <div className="h-10 flex items-center justify-center bg-white/50 border border-gray-200/60 rounded-lg backdrop-blur-sm text-[13px] font-black text-blue-600">
                                                                    {parseFloat(entry.totalAmount || 0).toLocaleString('en-IN')}
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-row gap-1 items-center justify-center">
                                                                {entryIndex === item.brandEntries.length - 1 && (isFullAdmin || canEdit || !editingId) && (
                                                                    <button type="button" onClick={() => addBrandEntry(index)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all active:scale-90" title="Add Brand"><span className="text-xl font-bold">+</span></button>
                                                                )}
                                                                {item.brandEntries.length > 1 && (isFullAdmin || canEdit || !editingId) && (
                                                                    <button type="button" onClick={() => removeBrandEntry(index, entryIndex)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90" title="Remove Brand"><TrashIcon className="w-3.5 h-3.5" /></button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {saleType !== 'Border' && (
                                            <div className="space-y-1">
                                                {/* Header Row for Brands (Hidden on Mobile) */}
                                                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-1 border border-transparent">
                                                    <div className="col-span-2 sale-mgmt-item-label text-center">LC No</div>
                                                    <div className="col-span-2 sale-mgmt-item-label text-center">Brand</div>
                                                    <div className="sale-mgmt-item-label text-center">Inhouse</div>
                                                    <div className="sale-mgmt-item-label text-center">Warehouse</div>
                                                    <div className="sale-mgmt-item-label text-center leading-tight">Saleable Wh Stock ({item.uom === 'BAG' ? 'BAG' : 'KG'})</div>
                                                    <div className="sale-mgmt-item-label text-center">Bag</div>
                                                    <div className="sale-mgmt-item-label text-center">Qty</div>
                                                    <div className="sale-mgmt-item-label text-center">Price</div>
                                                    <div className="col-span-2 sale-mgmt-item-label text-center">Total</div>
                                                </div>

                                                {item.brandEntries.map((entry, entryIndex) => (
                                                    <div key={entryIndex} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center px-6 group/entry transition-all hover:bg-gray-50/50 rounded-xl py-1.5 border border-transparent hover:border-gray-100/50 relative">
                                                        {/* LC No Selection */}
                                                        <div className="col-span-2 space-y-1 relative lc-dropdown-container">
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block">LC No</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    placeholder={entry.lcNo || "LC No"}
                                                                    value={activeDropdown === 'lcNo' && activeItemIndex === index && activeEntryIndex === entryIndex ? lcSearch : (entry.lcNo || '')}
                                                                    readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.lcNo)}
                                                                    onChange={(e) => {
                                                                        if (isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.lcNo)) return;
                                                                        setLcSearch(e.target.value);
                                                                        setActiveDropdown('lcNo');
                                                                        setActiveItemIndex(index);
                                                                        setActiveEntryIndex(entryIndex);
                                                                        setHighlightedIndex(-1);
                                                                        handleItemInputChange(index, entryIndex, { target: { name: 'lcNo', value: e.target.value } });
                                                                    }}
                                                                    autoComplete="off"
                                                                    onFocus={() => {
                                                                        if (isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.lcNo)) return;
                                                                        setActiveDropdown('lcNo');
                                                                        setActiveItemIndex(index);
                                                                        setActiveEntryIndex(entryIndex);
                                                                        setLcSearch(entry.lcNo || '');
                                                                        setHighlightedIndex(-1);
                                                                    }}
                                                                    onKeyDown={(e) => !isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.lcNo) && handleDropdownKeyDown(e, 'lcNo', getFilteredLCs(), handleLcSelect)}
                                                                    className={`sale-mgmt-input pr-10 !text-xs ${entry.lcNo ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.lcNo) ? 'bg-gray-50' : ''}`}
                                                                />
                                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                                    {entry.lcNo && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setActiveItemIndex(index);
                                                                                setActiveEntryIndex(entryIndex);
                                                                                handleLcSelect(null);
                                                                            }}
                                                                            className="text-gray-400 hover:text-red-500"
                                                                        >
                                                                            <XIcon className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setActiveDropdown(activeDropdown === 'lcNo' && activeItemIndex === index && activeEntryIndex === entryIndex ? null : 'lcNo');
                                                                            setActiveItemIndex(index);
                                                                            setActiveEntryIndex(entryIndex);
                                                                        }}
                                                                        className="text-gray-300 hover:text-blue-500 transition-colors"
                                                                    >
                                                                        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'lcNo' && activeItemIndex === index && activeEntryIndex === entryIndex ? 'rotate-180' : ''}`} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            {activeDropdown === 'lcNo' && activeItemIndex === index && activeEntryIndex === entryIndex && getFilteredLCs().length > 0 && (
                                                                <div className="absolute z-[70] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                    {getFilteredLCs().map((lc, idx) => (
                                                                        <button
                                                                            key={lc._id || `lc-${idx}`}
                                                                            type="button"
                                                                            onClick={() => handleLcSelect(lc)}
                                                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                                                            className={`w-full px-4 py-2 text-left text-xs font-medium transition-colors ${entry.lcNo === lc.lcNo ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                        >
                                                                            <div className="flex flex-col">
                                                                                <span className="font-bold text-[11px]">{lc.lcNo}</span>
                                                                                <span className="text-[9px] text-gray-500">
                                                                                    {lc.importerName} | {
                                                                                        (() => {
                                                                                            const matched = products.find(p =>
                                                                                                (p.name || '').toLowerCase().trim() === (lc.productName || '').toLowerCase().trim() ||
                                                                                                (p.ipName || '').toLowerCase().trim() === (lc.productName || '').toLowerCase().trim()
                                                                                            );
                                                                                            return matched ? matched.name : (lc.productName || '');
                                                                                        })()
                                                                                    }
                                                                                </span>
                                                                            </div>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Brand Selection */}
                                                        <div className="col-span-2 space-y-1 relative brand-dropdown-container">
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block">Brand</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    placeholder={entry.brandName || "Brand"}
                                                                    value={activeDropdown === 'brand' && activeItemIndex === index && activeEntryIndex === entryIndex ? brandSearch : (entry.brandName || '')}
                                                                    readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.brandName)}
                                                                    onChange={(e) => {
                                                                        if (isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.brandName)) return;
                                                                        setBrandSearch(e.target.value);
                                                                        setActiveDropdown('brand');
                                                                        setActiveItemIndex(index);
                                                                        setActiveEntryIndex(entryIndex);
                                                                        setHighlightedIndex(-1);
                                                                        handleItemInputChange(index, entryIndex, { target: { name: 'brandName', value: e.target.value } });
                                                                    }}
                                                                    autoComplete="off"
                                                                    onFocus={() => {
                                                                        if (isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.brandName)) return;
                                                                        setActiveDropdown('brand');
                                                                        setActiveItemIndex(index);
                                                                        setActiveEntryIndex(entryIndex);
                                                                        setBrandSearch(entry.brandName || '');
                                                                        setHighlightedIndex(-1);
                                                                    }}
                                                                    onKeyDown={(e) => !isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.brandName) && handleDropdownKeyDown(e, 'brand', getFilteredBrands(), handleBrandSelect)}
                                                                    className={`sale-mgmt-input pr-10 !text-xs ${entry.brandName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.brandName) ? 'bg-gray-50' : ''}`}
                                                                />
                                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                                    {entry.brandName && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                handleBrandSelect({ _id: '', brandName: '' });
                                                                                setBrandSearch('');
                                                                            }}
                                                                            className="text-gray-400 hover:text-red-500"
                                                                        >
                                                                            <XIcon className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setActiveDropdown(activeDropdown === 'brand' && activeItemIndex === index && activeEntryIndex === entryIndex ? null : 'brand');
                                                                            setActiveItemIndex(index);
                                                                            setActiveEntryIndex(entryIndex);
                                                                        }}
                                                                        className="text-gray-300 hover:text-blue-500 transition-colors"
                                                                    >
                                                                        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'brand' && activeItemIndex === index && activeEntryIndex === entryIndex ? 'rotate-180' : ''}`} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            {activeDropdown === 'brand' && activeItemIndex === index && activeEntryIndex === entryIndex && getFilteredBrands().length > 0 && (
                                                                <div className="absolute z-[70] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                    {getFilteredBrands().map((sb, idx) => (
                                                                        <button
                                                                            key={idx}
                                                                            type="button"
                                                                            onClick={() => handleBrandSelect(sb)}
                                                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                                                            className={`w-full px-4 py-2 text-left text-xs font-medium transition-colors ${entry.brandName === sb ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                        >
                                                                            {sb}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Inhouse Qty */}
                                                        <div>
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Inhouse</label>
                                                            <div className="w-full h-10 flex items-center justify-center bg-white/50 border border-gray-200/60 rounded-lg backdrop-blur-sm text-[13px] font-bold text-gray-900">
                                                                {entry.inhouseQty || '0'}
                                                            </div>
                                                        </div>

                                                        {/* Warehouse Selection */}
                                                        <div className="">
                                                            <div className="space-y-1 relative warehouse-dropdown-container">
                                                                <label className="md:hidden sale-mgmt-item-label mb-1 block">Warehouse</label>
                                                                <div className="relative">
                                                                    <input
                                                                        type="text"
                                                                        placeholder={entry.warehouseName || "Warehouse"}
                                                                        value={activeDropdown === 'warehouse' && activeItemIndex === index && activeEntryIndex === entryIndex ? warehouseSearch : (entry.warehouseName || '')}
                                                                        readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.warehouseName)}
                                                                        onChange={(e) => {
                                                                            if (isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.warehouseName)) return;
                                                                            setWarehouseSearch(e.target.value);
                                                                            setActiveDropdown('warehouse');
                                                                            setActiveItemIndex(index);
                                                                            setActiveEntryIndex(entryIndex);
                                                                            setHighlightedIndex(-1);
                                                                            handleItemInputChange(index, entryIndex, { target: { name: 'warehouseName', value: e.target.value } });
                                                                        }}
                                                                        autoComplete="off"
                                                                        onFocus={() => {
                                                                            if (isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.warehouseName)) return;
                                                                            setActiveDropdown('warehouse');
                                                                            setActiveItemIndex(index);
                                                                            setActiveEntryIndex(entryIndex);
                                                                            setWarehouseSearch(entry.warehouseName || '');
                                                                            setHighlightedIndex(-1);
                                                                        }}
                                                                        onKeyDown={(e) => !isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.warehouseName) && handleDropdownKeyDown(e, 'warehouse', getFilteredWarehouses(), handleWarehouseSelect)}
                                                                        className={`sale-mgmt-input pr-10 !text-xs ${entry.warehouseName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'} ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.warehouseName) ? 'bg-gray-50' : ''}`}
                                                                    />
                                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                                        {entry.warehouseName && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    handleWarehouseSelect({ _id: '', whName: '' });
                                                                                    setWarehouseSearch('');
                                                                                }}
                                                                                className="text-gray-400 hover:text-red-500"
                                                                            >
                                                                                <XIcon className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setActiveDropdown(activeDropdown === 'warehouse' && activeItemIndex === index && activeEntryIndex === entryIndex ? null : 'warehouse');
                                                                                setActiveItemIndex(index);
                                                                                setActiveEntryIndex(entryIndex);
                                                                            }}
                                                                            className="text-gray-300 hover:text-blue-500 transition-colors"
                                                                        >
                                                                            <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'warehouse' && activeItemIndex === index && activeEntryIndex === entryIndex ? 'rotate-180' : ''}`} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                {activeDropdown === 'warehouse' && activeItemIndex === index && activeEntryIndex === entryIndex && getFilteredWarehouses().length > 0 && (
                                                                    <div className="absolute z-[70] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1">
                                                                        {getFilteredWarehouses().map((w, idx) => (
                                                                            <button
                                                                                key={w._id || `wh-${idx}`}
                                                                                type="button"
                                                                                onClick={() => handleWarehouseSelect(w)}
                                                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                                                className={`w-full px-4 py-2 text-left text-xs font-medium transition-colors ${entry.warehouseName === w.whName ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                            >
                                                                                {w.whName}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Wh Stock */}
                                                        <div>
                                                            <label className="md:hidden text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block text-center leading-tight">Saleable Wh Stock ({item.uom === 'BAG' ? 'BAG' : 'KG'})</label>
                                                            <div className="w-full h-10 flex items-center justify-center bg-white/50 border border-gray-200/60 rounded-lg backdrop-blur-sm text-[13px] font-bold text-gray-900">
                                                                {entry.warehouseQty || '0'}
                                                            </div>
                                                        </div>

                                                        {/* Bag */}
                                                        <div>
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Bag</label>
                                                            <input autoComplete="off"
                                                                type="number"
                                                                name="bag"
                                                                value={entry.bag}
                                                                readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.bag)}
                                                                onChange={(e) => handleItemInputChange(index, entryIndex, e)}
                                                                placeholder="0"
                                                                className={`sale-mgmt-input !px-2 !text-[13px] font-bold text-blue-600 text-center ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.bag) ? 'bg-gray-50' : ''}`}
                                                            />
                                                        </div>

                                                        {/* Quantity */}
                                                        <div>
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Qty</label>
                                                            <input autoComplete="off"
                                                                type="number"
                                                                name="quantity"
                                                                value={entry.quantity}
                                                                readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.quantity)}
                                                                onChange={(e) => handleItemInputChange(index, entryIndex, e)}
                                                                placeholder="0"
                                                                required
                                                                className={`sale-mgmt-input !px-2 !text-[13px] font-black text-gray-900 text-center ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.quantity) ? 'bg-gray-50' : ''}`}
                                                            />
                                                        </div>

                                                        {/* Unit Price */}
                                                        <div>
                                                            <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Price</label>
                                                            <input autoComplete="off"
                                                                type="number"
                                                                name="unitPrice"
                                                                value={entry.unitPrice}
                                                                readOnly={isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.unitPrice)}
                                                                onChange={(e) => handleItemInputChange(index, entryIndex, e)}
                                                                placeholder="0"
                                                                className={`sale-mgmt-input !px-2 !text-[13px] font-bold text-gray-600 text-center ${isFieldReadOnly(originalData?.items?.[index]?.brandEntries?.[entryIndex]?.unitPrice) ? 'bg-gray-50' : ''}`}
                                                            />
                                                        </div>

                                                        {/* Total + Add/Remove */}
                                                        <div className="col-span-2 flex items-center gap-1.5">
                                                            <div className="flex-1">
                                                                <label className="md:hidden sale-mgmt-item-label mb-1 block text-center">Total</label>
                                                                <div className="w-full h-10 flex items-center justify-center bg-white/50 border border-gray-200/60 rounded-lg backdrop-blur-sm text-[13px] font-black text-blue-600">
                                                                    {parseFloat(entry.totalAmount || 0).toLocaleString('en-IN')}
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-row items-center gap-0.5 shrink-0">
                                                                {(entryIndex === item.brandEntries.length - 1 && (isFullAdmin || canEdit || !editingId)) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => addBrandEntry(index)}
                                                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded-full transition-all active:scale-95 hover:scale-110"
                                                                        title="Add Brand"
                                                                    >
                                                                        <span className="text-xl font-black">+</span>
                                                                    </button>
                                                                )}
                                                                {(item.brandEntries.length > 1 && (isFullAdmin || canEdit || !editingId)) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeBrandEntry(index, entryIndex)}
                                                                        className="p-1 text-gray-300 hover:text-red-500 transition-all opacity-0 group-hover/entry:opacity-100"
                                                                        title="Remove Brand"
                                                                    >
                                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Invoice Summary */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 col-span-2 pt-4 bg-blue-50/50 p-6 rounded-2xl border border-blue-100/50 mt-4 overflow-hidden">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Discount</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">৳</span>
                                        <input autoComplete="off"
                                            type="number"
                                            name="discount"
                                            value={formData.discount}
                                            readOnly={isFieldReadOnly(originalData?.discount)}
                                            onChange={handleInputChange}
                                            className={`w-full pl-8 pr-4 py-2.5 bg-white border border-orange-200 rounded-xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-orange-700 ${isFieldReadOnly(originalData?.discount) ? 'bg-gray-50' : ''}`}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Grand Total</label>
                                    <div className="text-2xl font-black text-gray-900">৳ {parseFloat(formData.totalAmount).toLocaleString('en-IN')}</div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Truck Fare</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">৳</span>
                                        <input autoComplete="off"
                                            type="number"
                                            name="paidAmount"
                                            value={formData.paidAmount}
                                            readOnly={isFieldReadOnly(originalData?.paidAmount)}
                                            onChange={handleInputChange}
                                            className={`w-full pl-8 pr-4 py-2.5 bg-white border border-blue-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-blue-700 ${isFieldReadOnly(originalData?.paidAmount) ? 'bg-gray-50' : ''}`}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Balance</label>
                                    <div className={`text-2xl font-black ${parseFloat(formData.dueAmount) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        ৳ {parseFloat(formData.dueAmount).toLocaleString('en-IN')}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Status</label>
                                    <div className="relative">
                                        <select
                                            name="status"
                                            value={(formData.status === 'accepted' || formData.status === 'Complete') ? 'Complete' : 'Pending'}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const newStatus = val === 'Complete' ? 'accepted' : 'Pending';
                                                setFormData(prev => ({
                                                    ...prev,
                                                    status: newStatus
                                                }));
                                            }}
                                            className={`w-full pl-4 pr-10 py-2.5 bg-white border rounded-xl font-bold text-sm outline-none transition-all cursor-pointer appearance-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 ${(formData.status === 'accepted' || formData.status === 'Complete')
                                                ? 'border-emerald-300 text-emerald-700 bg-emerald-50/50'
                                                : 'border-amber-300 text-amber-700 bg-amber-50/50'
                                                }`}
                                        >
                                            <option value="Pending" className="text-amber-700 font-bold">Pending</option>
                                            <option value="Complete" className="text-emerald-700 font-bold">Complete</option>
                                        </select>
                                        <ChevronDownIcon className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="col-span-full flex flex-col items-center justify-center border-t border-blue-100/60 pt-4 mt-2 gap-3 w-full text-center">
                                    {submitStatus === 'success' && (
                                        <p className="text-green-600 font-medium flex items-center justify-center animate-bounce">
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                            Sale saved successfully!
                                        </p>
                                    )}
                                    {submitStatus === 'error' && (
                                        <p className="text-red-600 font-medium flex items-center justify-center">
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                            Failed to save sale. Please try again.
                                        </p>
                                    )}
                                    <div className="flex items-center justify-center w-full relative z-10">
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className={`px-10 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all text-sm flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {isSubmitting ? (
                                                <span className="flex items-center">
                                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Processing...
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1">
                                                    <span className="text-base">+</span>
                                                    {editingId ? 'Update Sale' : 'Confirm Sale'}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form >
                </div >
            )}

            {/* Bulk Actions Bar */}
            {selectedItems.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] ring-1 ring-white/20 px-4 py-2 rounded-full flex items-center gap-4 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-tr from-blue-50/20 to-white/5 pointer-events-none"></div>
                        <div className="flex items-center gap-2.5 pr-4 border-r border-slate-900/10 relative z-10">
                            <div className="w-7 h-7 rounded-full bg-blue-600 shadow-md flex items-center justify-center font-black text-[11px] text-white border border-white/20">
                                {selectedItems.size}
                            </div>
                            <span className="text-[11px] font-black text-slate-800 tracking-tight">Items Selected</span>
                        </div>
                        <div className="flex items-center gap-2 relative z-10">
                            <button
                                onClick={() => setShowBulkRateModal(true)}
                                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-[11px] font-black transition-all active:scale-95 flex items-center gap-2 shadow-sm group"
                            >
                                <EditIcon className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                                Edit Rate
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedItems(new Set());
                                    setIsSelectionMode(false);
                                }}
                                className="px-4 py-1.5 bg-slate-900/10 hover:bg-slate-900/20 text-slate-800 rounded-full text-[11px] font-black transition-all active:scale-95 border border-white/20"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sales Table & Cards */}
            {!showForm && (
                <div className="space-y-4">
                    {/* Bulk Action Bar - LC Receive Style */}
                    {selectedItems.size > 0 && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-200">
                            <div className="flex items-center gap-3">
                                <span className="inline-flex items-center justify-center bg-blue-600 text-white font-extrabold text-xs px-3 py-1 rounded-full shadow-sm">
                                    {selectedItems.size} Selected
                                </span>
                                <span className="text-xs font-semibold text-gray-700">
                                    {saleType === 'Border' ? 'Border Sale' : 'Sale'} entries selected
                                </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {isRequestedOnly && canApprove && (
                                    <button
                                        onClick={handleBulkAccept}
                                        disabled={isSubmitting}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
                                        title="Accept all selected requests"
                                    >
                                        <CheckIcon className="w-4 h-4" />
                                        <span>Bulk Accept ({selectedItems.size})</span>
                                    </button>
                                )}
                                {isRequestedOnly && canApprove && (
                                    <button
                                        onClick={handleBulkReject}
                                        disabled={isSubmitting}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-red-600/20 transition-all disabled:opacity-50 cursor-pointer"
                                        title="Reject all selected requests"
                                    >
                                        <XIcon className="w-4 h-4" />
                                        <span>Bulk Reject ({selectedItems.size})</span>
                                    </button>
                                )}
                                {saleType === 'Border' && !isRequestedOnly && (
                                    <button
                                        onClick={() => setShowBulkRateModal(true)}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                        <EditIcon className="w-4 h-4" />
                                        <span>Edit Rate</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => { setSelectedItems(new Set()); if (setIsSelectionMode) setIsSelectionMode(false); }}
                                    className="px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
                                >
                                    Deselect All
                                </button>
                            </div>
                        </div>
                    )}

                <div className="sale-mgmt-table-container">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="sale-mgmt-table">
                            <thead>
                                {saleType === 'Border' ? (
                                    <tr>
                                        <th className="sale-mgmt-th text-center">
                                            {(isSelectionMode || selectedItems.size > 0) ? (
                                                <input autoComplete="off"
                                                    type="checkbox"
                                                    checked={getFilteredData().length > 0 && selectedItems.size === getFilteredData().length}
                                                    onChange={() => {
                                                        const data = getFilteredData();
                                                        if (selectedItems.size === data.length) {
                                                            setSelectedItems(new Set());
                                                            if (setIsSelectionMode) setIsSelectionMode(false);
                                                        } else {
                                                            setSelectedItems(new Set(data.map(s => s._id)));
                                                            if (setIsSelectionMode) setIsSelectionMode(true);
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            ) : '#'}
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('date')}>
                                            <div className="flex items-center">Date {renderSortIcon('date')}</div>
                                        </th>
                                        <th className="sale-mgmt-th text-center cursor-pointer group whitespace-nowrap" onClick={() => handleSort('orderNo')}>
                                            <div className="flex items-center justify-center">Order No {renderSortIcon('orderNo')}</div>
                                        </th>
                                        <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('invoiceNo')}>
                                            <div className="flex items-center justify-center">Invoice {renderSortIcon('invoiceNo')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('lcNo')}>
                                            <div className="flex items-center">LC No {renderSortIcon('lcNo')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('importer')}>
                                            <div className="flex items-center">Importer {renderSortIcon('importer')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('port')}>
                                            <div className="flex items-center">port {renderSortIcon('port')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('indianCnF')}>
                                            <div className="flex items-center">IND C&F {renderSortIcon('indianCnF')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('bdCnf')}>
                                            <div className="flex items-center">BD C&F {renderSortIcon('bdCnf')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('party')}>
                                            <div className="flex items-center">Party {renderSortIcon('party')}</div>
                                        </th>
                                        <th className="sale-mgmt-th">Product</th>
                                        <th className="sale-mgmt-th text-center">QTY</th>
                                        <th className="sale-mgmt-th">Truck</th>
                                        <th className="sale-mgmt-th text-center">rate</th>
                                        <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('totalAmount')}>
                                            <div className="flex items-center justify-center">total price {renderSortIcon('totalAmount')}</div>
                                        </th>
                                        <th className="sale-mgmt-th text-center">Actions</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th className="sale-mgmt-th text-center">
                                            {(isSelectionMode || selectedItems.size > 0) ? (
                                                <input autoComplete="off"
                                                    type="checkbox"
                                                    checked={getFilteredData().length > 0 && selectedItems.size === getFilteredData().length}
                                                    onChange={() => {
                                                        const data = getFilteredData();
                                                        if (selectedItems.size === data.length) {
                                                            setSelectedItems(new Set());
                                                            if (setIsSelectionMode) setIsSelectionMode(false);
                                                        } else {
                                                            setSelectedItems(new Set(data.map(s => s._id)));
                                                            if (setIsSelectionMode) setIsSelectionMode(true);
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            ) : 'SL'}
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('date')}>
                                            <div className="flex items-center">Date {renderSortIcon('date')}</div>
                                        </th>
                                        <th className="sale-mgmt-th text-center cursor-pointer group whitespace-nowrap" onClick={() => handleSort('orderNo')}>
                                            <div className="flex items-center justify-center">Order No {renderSortIcon('orderNo')}</div>
                                        </th>
                                        <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('invoiceNo')}>
                                            <div className="flex items-center justify-center">Invoice {renderSortIcon('invoiceNo')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('lcNo')}>
                                            <div className="flex items-center">LC No {renderSortIcon('lcNo')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('challanNo')}>
                                            <div className="flex items-center">CH. No {renderSortIcon('challanNo')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group whitespace-nowrap" onClick={() => handleSort('truckNo')}>
                                            <div className="flex items-center">Truck No {renderSortIcon('truckNo')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group whitespace-nowrap" onClick={() => handleSort('warehouseName')}>
                                            <div className="flex items-center">W.HHOUSE {renderSortIcon('warehouseName')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group !px-1.5" onClick={() => handleSort('companyName')}>
                                            <div className="flex items-center">Company {renderSortIcon('companyName')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group !px-1.5" onClick={() => handleSort('customerName')}>
                                            <div className="flex items-center">Customer {renderSortIcon('customerName')}</div>
                                        </th>
                                        <th className="sale-mgmt-th">Product</th>
                                        <th className="sale-mgmt-th">Brand</th>
                                        <th className="sale-mgmt-th text-center font-bold">Bag</th>
                                        <th className="sale-mgmt-th text-center font-bold">Quantity</th>
                                        <th className="sale-mgmt-th text-center font-bold">Rate</th>
                                        <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('discount')} style={{ display: 'none' }}>
                                            <div className="flex items-center justify-center">Discount {renderSortIcon('discount')}</div>
                                        </th>
                                        <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('totalAmount')}>
                                            <div className="flex items-center justify-center">Total {renderSortIcon('totalAmount')}</div>
                                        </th>
                                        <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('paidAmount')}>
                                            <div className="flex items-center justify-center">Truck Fare {renderSortIcon('paidAmount')}</div>
                                        </th>
                                        <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('dueAmount')}>
                                            <div className="flex items-center justify-center">Balance {renderSortIcon('dueAmount')}</div>
                                        </th>
                                        <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('status')} style={{ display: 'none' }}>
                                            <div className="flex items-center justify-center">Status {renderSortIcon('status')}</div>
                                        </th>
                                        <th className="sale-mgmt-th text-center whitespace-nowrap font-bold">Entry By</th>
                                        <th className="sale-mgmt-th text-center">Actions</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {isLoading ? (
                                    <tr><td colSpan="21" className="px-3 py-20 text-center text-gray-400 font-medium">Loading sales records...</td></tr>
                                ) : getFilteredData().length === 0 ? (
                                    <tr><td colSpan="21" className="px-3 py-20 text-center text-gray-400 font-medium">No sales records found</td></tr>
                                ) : getFilteredData().map((sale, index) => {
                                    const isExpanded = !collapsedRows.includes(sale._id);
                                    const isMultiple = (sale.items && sale.items.length > 0)
                                        ? sale.items.flatMap(item => (item.brandEntries || [])).length > 1
                                        : false;

                                    let items = sale.items && sale.items.length > 0
                                        ? sale.items.flatMap(item =>
                                            (item.brandEntries || []).length > 0
                                                ? item.brandEntries.map(be => ({
                                                    ...be,
                                                    productName: item.productName,
                                                    lcNo: (be.lcNo !== undefined && be.lcNo !== null) ? be.lcNo : (item.lcNo || sale.lcNo || ''),
                                                    bag: (be.bag !== undefined && be.bag !== null && be.bag !== '') ? be.bag : (item.bag !== undefined && item.bag !== null && item.bag !== '') ? item.bag : (sale.bag || ''),
                                                    warehouseName: be.warehouseName || item.warehouseName || sale.warehouseName || '',
                                                    uom: be.uom || item.uom || 'QTY'
                                                }))
                                                : [{
                                                    ...item,
                                                    productName: item.productName,
                                                    bag: (item.bag !== undefined && item.bag !== null && item.bag !== '') ? item.bag : (sale.bag || ''),
                                                    lcNo: (item.lcNo !== undefined && item.lcNo !== null) ? item.lcNo : (sale.lcNo || ''),
                                                    warehouseName: item.warehouseName || sale.warehouseName || '',
                                                    uom: item.uom || 'QTY'
                                                }]
                                        )
                                        : [{
                                            productName: sale.productName,
                                            brand: sale.brand,
                                            bag: sale.bag || '',
                                            quantity: sale.quantity,
                                            unitPrice: sale.unitPrice,
                                            lcNo: sale.lcNo || '',
                                            warehouseName: sale.warehouseName || '',
                                            uom: sale.uom || 'QTY'
                                        }];


                                    if (searchQuery) {
                                        const query = searchQuery.toLowerCase();
                                        const filteredItems = items.filter(it => {
                                            const lcNoMatch = (it.lcNo || '').toLowerCase().includes(query);
                                            const prodMatch = (it.productName || '').toLowerCase().includes(query);
                                            const brandMatch = (it.brand || '').toLowerCase().includes(query);
                                            const truckMatch = (it.truck || '').toLowerCase().includes(query);
                                            return lcNoMatch || prodMatch || brandMatch || truckMatch;
                                        });
                                        if (filteredItems.length > 0) {
                                            items = filteredItems;
                                        }
                                    }

                                    if (saleType === 'Border') {
                                        return (
                                            <tr
                                                key={sale._id}
                                                onMouseDown={() => startLongPress(sale._id)}
                                                onMouseUp={endLongPress}
                                                onMouseLeave={endLongPress}
                                                onTouchStart={() => startLongPress(sale._id)}
                                                onTouchEnd={endLongPress}
                                                onClick={() => {
                                                    if (isLongPressTriggered && isLongPressTriggered.current) return;
                                                    (isSelectionMode || selectedItems.size > 0) && toggleSelection(sale._id);
                                                }}
                                                className={`hover:bg-blue-50/50 transition-all border-b border-gray-50 text-[13px] ${selectedItems.has(sale._id) ? 'bg-blue-50' : ''} ${highlightId && (String(sale._id) === String(highlightId) || (sale.invoiceNo && String(sale.invoiceNo).toLowerCase().trim() === String(highlightId).toLowerCase().trim())) ? "notif-row-highlight" : ""}`}
                                                ref={el => { const id = sale.invoiceNo || sale._id; if (id) rowRefs.current[id] = el; }}
                                                    style={highlightId && (String(sale._id) === String(highlightId) || (sale.invoiceNo && String(sale.invoiceNo).toLowerCase().trim() === String(highlightId).toLowerCase().trim())) ? { borderLeft: '5px solid #f59e0b' } : undefined}
                                            >
                                                <td className="px-3 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                    {(isSelectionMode || selectedItems.size > 0) ? (
                                                        <input autoComplete="off"
                                                            type="checkbox"
                                                            checked={selectedItems.has(sale._id)}
                                                            onChange={() => toggleSelection(sale._id)}
                                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                    ) : (
                                                        <span className="text-gray-400 font-medium">{index + 1}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-gray-600">{formatDate(sale.date)}</td>
                                                <td className="px-3 py-4 whitespace-nowrap text-center font-semibold text-gray-800">{sale.orderNo || '-'}</td>
                                                <td className="px-3 py-4 whitespace-nowrap text-center font-semibold text-gray-800">{sale.invoiceNo || '-'}</td>
                                                <td className="px-3 py-4 whitespace-nowrap font-semibold text-gray-800">{sale.lcNo || '-'}</td>
                                                <td className="px-3 py-4 whitespace-nowrap font-semibold text-gray-800">{getSafeString(sale.importer) || '-'}</td>
                                                <td className="px-3 py-4 whitespace-nowrap font-semibold text-gray-800">{getSafeString(sale.port) || '-'}</td>
                                                <td className="px-3 py-4 whitespace-nowrap font-semibold text-gray-800">{getSafeString(sale.indianCnF) || '-'}</td>
                                                <td className="px-3 py-4 whitespace-nowrap font-semibold text-gray-800">{getSafeString(sale.bdCnf) || '-'}</td>
                                                <td className="px-3 py-4 whitespace-nowrap font-semibold text-gray-800">{getSafeString(sale.companyName) || getSafeString(sale.customerName) || '-'}</td>
                                                <td className="px-3 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-1">
                                                        {items.map((it, idx) => (
                                                            <div key={idx} className="font-bold text-gray-800 border-b border-gray-100 last:border-0 pb-0.5">{resolveProductName(it.productName) || '-'}</div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-center">
                                                    <div className="flex flex-col gap-1">
                                                        {items.map((it, idx) => (
                                                            <div key={idx} className="font-semibold text-gray-800 border-b border-gray-100 last:border-0 pb-0.5">{parseFloat(it.quantity || 0).toLocaleString('en-US')}</div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-center text-gray-800">
                                                    <div className="flex flex-col gap-1">
                                                        {items.map((it, idx) => (
                                                            <div key={idx} className="font-semibold text-gray-800 border-b border-gray-100 last:border-0 pb-0.5">
                                                                {it.truck || sale.truck || '-'}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-center">
                                                    <div className="flex flex-col gap-1">
                                                        {items.map((it, idx) => (
                                                            <div key={idx} className="font-semibold text-gray-800 border-b border-gray-100 last:border-0 pb-0.5">৳ {parseFloat(it.unitPrice || 0).toLocaleString('en-IN')}</div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-center font-black text-gray-900">৳ {parseFloat(sale.totalAmount).toLocaleString('en-IN')}</td>
                                                <td className="px-3 py-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {(sale.status === 'Requested' || sale.status === 'Edit_Requested' || sale.isEdited === true) ? (
                                                            <>
                                                                <button onClick={(e) => { e.stopPropagation(); setViewData(sale); }} className="text-gray-400 hover:text-blue-600 transition-colors" title="View Details"><EyeIcon className="w-5 h-5" /></button>
                                                                {canEditRequestedSale(sale) && (
                                                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(sale); }} className="text-gray-400 hover:text-blue-600 transition-colors" title="Edit"><EditIcon className="w-5 h-5" /></button>
                                                                )}
                                                                {canApprove && (
                                                                    <>
                                                                        <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(sale, 'accepted'); }} className="text-gray-400 hover:text-emerald-600 transition-colors" title="Accept"><CheckIcon className="w-5 h-5" /></button>
                                                                        <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(sale, 'Rejected'); }} className="text-gray-400 hover:text-red-600 transition-colors" title="Reject"><XIcon className="w-5 h-5" /></button>
                                                                    </>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <>
                                                                {canViewSale(sale) && (
                                                                    <button onClick={(e) => { e.stopPropagation(); setViewData(sale); }} className="text-gray-400 hover:text-blue-600 transition-colors" title="View Details"><EyeIcon className="w-5 h-5" /></button>
                                                                )}
                                                                {saleType === 'General' ? (
                                                                    <div className="relative inline-block sale-pdf-dropdown-container">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setActivePdfDropdown(activePdfDropdown === sale._id ? null : sale._id);
                                                                            }}
                                                                            className={`transition-colors ${activePdfDropdown === sale._id ? 'text-emerald-600' : 'text-gray-400 hover:text-emerald-600'}`}
                                                                            title="Download PDF"
                                                                        >
                                                                            <FileTextIcon className="w-5 h-5" />
                                                                        </button>
                                                                        {activePdfDropdown === sale._id && (
                                                                            <div
                                                                                className="absolute right-0 top-full mt-1.5 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setActivePdfDropdown(null);
                                                                                        generateSaleInvoicePDF(sale, customers);
                                                                                    }}
                                                                                    className="w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 transition-colors"
                                                                                >
                                                                                    <FileTextIcon className="w-4 h-4 text-emerald-600" />
                                                                                    <span>Invoice</span>
                                                                                </button>
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setActivePdfDropdown(null);
                                                                                        generateSaleChallanPDF(sale, customers);
                                                                                    }}
                                                                                    className="w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors border-t border-gray-50"
                                                                                >
                                                                                    <ReceiptIcon className="w-4 h-4 text-blue-600" />
                                                                                    <span>Challan</span>
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <button onClick={(e) => { e.stopPropagation(); generateSaleInvoicePDF(sale, customers); }} className="text-gray-400 hover:text-emerald-600 transition-colors" title="Invoice"><FileTextIcon className="w-5 h-5" /></button>
                                                                )}
                                                                {canUserEditSale(sale) && (
                                                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(sale); }} className="text-gray-400 hover:text-blue-600 transition-colors" title="Edit"><EditIcon className="w-5 h-5" /></button>
                                                                )}
                                                                {canUserDeleteSale(sale) && (
                                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(sale); }} className="text-gray-400 hover:text-red-600 transition-colors" title="Delete"><TrashIcon className="w-5 h-5" /></button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    return (
                                        <tr
                                            key={sale._id}
                                            onMouseDown={() => startLongPress(sale._id)}
                                            onMouseUp={endLongPress}
                                            onMouseLeave={endLongPress}
                                            onTouchStart={() => startLongPress(sale._id)}
                                            onTouchEnd={endLongPress}
                                            onClick={() => {
                                                if (isLongPressTriggered && isLongPressTriggered.current) return;
                                                if (isSelectionMode || selectedItems.size > 0) {
                                                    toggleSelection(sale._id);
                                                } else if (isMultiple) {
                                                    toggleRowExpansion(sale._id);
                                                }
                                            }}
                                            className={`hover:bg-blue-50/50 transition-all group border-b border-gray-50 last:border-0 align-top ${isMultiple ? 'cursor-pointer' : ''} ${highlightId && (String(sale._id) === String(highlightId) || (sale.invoiceNo && String(sale.invoiceNo).toLowerCase().trim() === String(highlightId).toLowerCase().trim())) ? "notif-row-highlight" : ""}`}
                                        ref={el => { if (sale.invoiceNo) rowRefs.current[sale.invoiceNo] = el; }}
                                                    style={highlightId && (String(sale._id) === String(highlightId) || (sale.invoiceNo && String(sale.invoiceNo).toLowerCase().trim() === String(highlightId).toLowerCase().trim())) ? { borderLeft: '5px solid #f59e0b' } : undefined}
                                        >
                                            <td className="px-3 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                {(isSelectionMode || selectedItems.size > 0) ? (
                                                    <input autoComplete="off"
                                                        type="checkbox"
                                                        checked={selectedItems.has(sale._id)}
                                                        onChange={() => toggleSelection(sale._id)}
                                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                ) : (
                                                    <span className="text-gray-400 font-medium">{index + 1}</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap">
                                                <div className="text-[13px] font-medium text-gray-600">{formatDate(sale.date)}</div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                <div className="text-[13px] font-semibold text-gray-800">{sale.orderNo || '-'}</div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                <div className="text-[13px] font-semibold text-gray-800">{sale.invoiceNo || '-'}</div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap">
                                                {isMultiple && !isExpanded ? (
                                                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100/50 rounded text-[9px] font-bold uppercase tracking-wider">Multiple</span>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {items.map((it, idx) => {
                                                            const rawLc = it.lcNo || sale.lcNo || '-';
                                                            const displayLc = (!rawLc || rawLc === '-') ? '-' : (/^\d+$/.test(rawLc.toString().trim()) && rawLc.toString().trim().length > 4 ? rawLc.toString().trim().slice(-4) : rawLc.toString().trim());
                                                            return (
                                                                <div key={idx} className={`text-[13px] font-semibold text-gray-800 ${idx < items.length - 1 ? 'border-b border-gray-100 pb-1' : ''}`}>
                                                                    {displayLc}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-4">
                                                <div className="text-[13px] font-semibold text-gray-800">
                                                    {sale.challanNo ? (
                                                        sale.challanNo.split(/(.{5})/).filter(Boolean).map((chunk, idx) => (
                                                            <div key={idx}>{chunk}</div>
                                                        ))
                                                    ) : (
                                                        '-'
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-4">
                                                <div className="text-[13px] font-semibold text-gray-800">
                                                    {sale.truckNo ? (
                                                        sale.truckNo.split(/(.{14})/).filter(Boolean).map((chunk, idx) => (
                                                            <div key={idx}>{chunk}</div>
                                                        ))
                                                    ) : (
                                                        '-'
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap">
                                                {isMultiple && !isExpanded ? (
                                                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100/50 rounded text-[9px] font-bold uppercase tracking-wider">Multiple</span>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {items.map((it, idx) => (
                                                            <div key={idx} className={`text-[13px] font-semibold text-gray-800 ${idx < items.length - 1 ? 'border-b border-gray-100 pb-1' : ''}`}>
                                                                {it.warehouseName || sale.warehouseName || '-'}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="!px-1.5 py-4 max-w-[130px]">
                                                <div className="text-[13px] font-semibold text-gray-800 break-words leading-tight">{getSafeString(sale.companyName) || '-'}</div>
                                            </td>
                                            <td className="!px-1.5 py-4 max-w-[110px]">
                                                <div className="text-[13px] font-semibold text-gray-800 break-words leading-tight">{getSafeString(sale.customerName) || '-'}</div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap">
                                                {isMultiple && !isExpanded ? (
                                                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100/50 rounded text-[9px] font-bold uppercase tracking-wider">Multiple</span>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {items.map((it, idx) => (
                                                            <div key={idx} className={`text-[13px] text-gray-800 font-bold ${idx < items.length - 1 ? 'border-b border-gray-100 pb-1' : ''}`}>
                                                                {it.productName || '-'}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap">
                                                {isMultiple && !isExpanded ? (
                                                    <span className="px-1.5 py-0.5 bg-gray-50 text-gray-500 border border-gray-100 rounded text-[9px] font-bold uppercase tracking-wider">Multiple</span>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {items.map((it, idx) => (
                                                            <div key={idx} className={`text-[13px] font-semibold text-gray-700 ${idx < items.length - 1 ? 'border-b border-gray-100 pb-1' : ''}`}>
                                                                {it.brand || '-'}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                {isMultiple && !isExpanded ? (
                                                    <div className="inline-block px-2 py-0.5 bg-gray-50 text-gray-700 rounded border border-gray-200 text-[12px] font-bold">
                                                        {items.reduce((sum, it) => sum + (parseFloat(it.bag) || 0), 0).toLocaleString('en-US')}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {items.map((it, idx) => (
                                                            <div key={idx} className={`text-[13px] font-semibold text-gray-800 ${idx < items.length - 1 ? 'border-b border-gray-100 pb-1' : ''}`}>
                                                                {it.bag !== undefined && it.bag !== null && it.bag !== '' ? parseFloat(it.bag || 0).toLocaleString('en-US') : '-'}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                {isMultiple && !isExpanded ? (
                                                    <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-100/50 text-[13px] font-black">
                                                        {(() => {
                                                            const sumQty = items.reduce((sum, it) => sum + (parseFloat(it.quantity) || 0), 0);
                                                            return `${sumQty.toLocaleString('en-US')} kg`;
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {items.map((it, idx) => (
                                                            <div key={idx} className={`text-[13px] font-semibold text-gray-800 ${idx < items.length - 1 ? 'border-b border-gray-100 pb-1' : ''}`}>
                                                                {parseFloat(it.quantity || 0).toLocaleString('en-US')} kg
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                {isMultiple && !isExpanded ? (
                                                    <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-bold uppercase tracking-wider inline-block">Multiple</span>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {items.map((it, idx) => (
                                                            <div key={idx} className={`text-[13px] font-semibold text-gray-800 ${idx < items.length - 1 ? 'border-b border-gray-100 pb-1' : ''}`}>
                                                                ৳ {parseFloat(it.unitPrice || 0).toLocaleString('en-IN')}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-center" style={{ display: 'none' }}>
                                                <div className="text-[13px] font-bold text-red-600">
                                                    {parseFloat(sale.discount || 0) > 0 ? `-৳ ${parseFloat(sale.discount).toLocaleString('en-IN')}` : '-'}
                                                </div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                <div className="text-[13px] font-black text-gray-900">
                                                    ৳ {(() => {
                                                        const storedTotal = parseFloat(sale.totalAmount) || 0;
                                                        if (storedTotal > 0) return storedTotal.toLocaleString('en-IN');
                                                        // Fallback for corrupted data: Recalculate from items
                                                        const calculatedTotal = items.reduce((sum, it) => {
                                                            const qty = it.uom === 'BAG' ? (parseFloat(it.bag) || 0) : (parseFloat(it.quantity) || 0);
                                                            return sum + (qty * parseFloat(it.unitPrice || 0));
                                                        }, 0);
                                                        return calculatedTotal.toLocaleString('en-IN');
                                                    })()}
                                                </div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                <div className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold inline-block border border-emerald-100/50">
                                                    ৳ {parseFloat(sale.paidAmount || 0).toLocaleString('en-IN')}
                                                </div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-center">
                                                <div className="px-2 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold inline-block border border-orange-100/50">
                                                    ৳ {(() => {
                                                        const storedDue = parseFloat(sale.dueAmount) || 0;
                                                        const storedTotal = parseFloat(sale.totalAmount) || 0;
                                                        if (storedDue > 0 || storedTotal > 0) return storedDue.toLocaleString('en-IN');

                                                        // Fallback calculation
                                                        const calculatedTotal = items.reduce((sum, it) => {
                                                            const qty = it.uom === 'BAG' ? (parseFloat(it.bag) || 0) : (parseFloat(it.quantity) || 0);
                                                            return sum + (qty * parseFloat(it.unitPrice || 0));
                                                        }, 0);
                                                        const calculatedDue = Math.max(0, calculatedTotal - parseFloat(sale.discount || 0) - parseFloat(sale.paidAmount || 0));
                                                        return calculatedDue.toLocaleString('en-IN');
                                                    })()}
                                                </div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-center" style={{ display: 'none' }}>
                                                {(() => {
                                                    const storedDue = parseFloat(sale.dueAmount);
                                                    const storedTotal = parseFloat(sale.totalAmount) || 0;
                                                    let dueVal = 0;
                                                    if (!isNaN(storedDue) && (storedDue > 0 || storedTotal > 0)) {
                                                        dueVal = storedDue;
                                                    } else {
                                                        const calculatedTotal = items.reduce((sum, it) => {
                                                            const qty = it.uom === 'BAG' ? (parseFloat(it.bag) || 0) : (parseFloat(it.quantity) || 0);
                                                            return sum + (qty * parseFloat(it.unitPrice || 0));
                                                        }, 0);
                                                        dueVal = Math.max(0, calculatedTotal - parseFloat(sale.discount || 0) - parseFloat(sale.paidAmount || 0));
                                                    }
                                                    const st = (sale.status || '').toLowerCase();
                                                    if (st === 'requested') {
                                                        return (
                                                            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-200/60 inline-flex items-center gap-1 shadow-sm">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                                Requested
                                                            </span>
                                                        );
                                                    }
                                                    if (st === 'rejected') {
                                                        return (
                                                            <span className="px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-xs font-bold border border-red-200/60 inline-flex items-center gap-1 shadow-sm">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                                Rejected
                                                            </span>
                                                        );
                                                    }
                                                    const isComplete = st === 'complete' || st === 'accepted' || (st !== 'pending' && dueVal <= 0);
                                                    return isComplete ? (
                                                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200/60 inline-flex items-center gap-1 shadow-sm">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                            Complete
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-200/60 inline-flex items-center gap-1 shadow-sm">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                            Pending
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-3 py-4 text-center whitespace-nowrap">
                                                {(() => {
                                                    const rawEntryUser = sale.requestedBy || sale.requestedByUsername || sale.createdByName || sale.createdByUsername || sale.createdBy || sale.entryBy || sale.entryByName || '-';
                                                    const entryUser = getDisplayName(sale.requestedByUsername || sale.createdByUsername || sale.entryBy, rawEntryUser);

                                                    const isReq = (sale.status || '').toLowerCase() === 'requested';
                                                    const isEditReq = sale.isEdited === true || (sale.status || '').toLowerCase() === 'edit_requested';

                                                    const rawApproved = sale.acceptedBy || sale.approvedByName || sale.approvedBy;
                                                    const approvedUser = !isReq && rawApproved ? getDisplayName(sale.acceptedByUsername || sale.approvedByUsername || sale.approvedBy, rawApproved) : null;

                                                    const rawEdited = sale.editedByName || sale.editedBy || sale.editRequestedBy;
                                                    const editedUser = rawEdited && rawEdited.toLowerCase() !== 'admin' ? getDisplayName(sale.editedByUsername || sale.editRequestedByUsername || sale.editedBy, rawEdited) : (rawEdited && rawEdited.toLowerCase() === 'admin' ? 'Admin' : null);

                                                    const rawEditApproved = sale.editApprovedByName || sale.editApprovedBy;
                                                    const editApprovedUser = !isEditReq && rawEditApproved ? getDisplayName(sale.editApprovedByUsername || sale.editApprovedBy, rawEditApproved) : null;

                                                    return (
                                                        <div className="flex flex-col items-center justify-center gap-0.5">
                                                            <span className="text-xs font-bold text-gray-800" title="Entry By">
                                                                {entryUser}
                                                            </span>

                                                            {approvedUser && (
                                                                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5" title={`Approved by: ${approvedUser}`}>
                                                                    <span>✓</span> {approvedUser}
                                                                </span>
                                                            )}

                                                            {editedUser && (
                                                                <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5" title={`Edited by: ${editedUser}`}>
                                                                    <span>✎</span> {editedUser}
                                                                </span>
                                                            )}

                                                            {editApprovedUser && (
                                                                <span className="text-[10px] text-purple-600 font-medium flex items-center gap-0.5" title={`Edit Approved by: ${editApprovedUser}`}>
                                                                    <span>✓✎</span> {editApprovedUser}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-3 py-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {(sale.status === 'Requested' || sale.status === 'Edit_Requested' || sale.isEdited === true) ? (
                                                        <>
                                                            <button onClick={(e) => { e.stopPropagation(); setViewData(sale); }} className="text-gray-400 hover:text-blue-600 transition-colors" title="View Details"><EyeIcon className="w-5 h-5" /></button>
                                                            {(canEditRequestedSale(sale) || canUserEditSale(sale)) && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(sale); }} className="text-gray-400 hover:text-blue-600 transition-colors" title="Edit"><EditIcon className="w-5 h-5" /></button>
                                                            )}
                                                            {canApprove && (
                                                                <>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(sale, 'accepted'); }} className="text-gray-400 hover:text-emerald-600 transition-colors" title="Accept"><CheckIcon className="w-5 h-5" /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(sale, 'Rejected'); }} className="text-gray-400 hover:text-red-600 transition-colors" title="Reject"><XIcon className="w-5 h-5" /></button>
                                                                </>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {canViewSale(sale) && (
                                                                <button onClick={(e) => { e.stopPropagation(); setViewData(sale); }} className="text-gray-400 hover:text-blue-600 transition-colors" title="View Details"><EyeIcon className="w-5 h-5" /></button>
                                                            )}
                                                            {saleType === 'General' ? (
                                                                <div className="relative inline-block sale-pdf-dropdown-container">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActivePdfDropdown(activePdfDropdown === sale._id ? null : sale._id);
                                                                        }}
                                                                        className={`transition-colors ${activePdfDropdown === sale._id ? 'text-emerald-600' : 'text-gray-400 hover:text-emerald-600'}`}
                                                                        title="Download PDF"
                                                                    >
                                                                        <FileTextIcon className="w-5 h-5" />
                                                                    </button>
                                                                    {activePdfDropdown === sale._id && (
                                                                        <div
                                                                            className="absolute right-0 top-full mt-1.5 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setActivePdfDropdown(null);
                                                                                    generateSaleInvoicePDF(sale, customers);
                                                                                }}
                                                                                className="w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 transition-colors"
                                                                            >
                                                                                <FileTextIcon className="w-4 h-4 text-emerald-600" />
                                                                                <span>Invoice</span>
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setActivePdfDropdown(null);
                                                                                    generateSaleChallanPDF(sale, customers);
                                                                                }}
                                                                                className="w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors border-t border-gray-50"
                                                                            >
                                                                                <ReceiptIcon className="w-4 h-4 text-blue-600" />
                                                                                <span>Challan</span>
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <button onClick={(e) => { e.stopPropagation(); generateSaleInvoicePDF(sale, customers); }} className="text-gray-400 hover:text-emerald-600 transition-colors" title="Invoice"><FileTextIcon className="w-5 h-5" /></button>
                                                            )}
                                                            {canUserEditSale(sale) && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(sale); }} className="text-gray-400 hover:text-blue-600 transition-colors" title="Edit"><EditIcon className="w-5 h-5" /></button>
                                                            )}
                                                            {canUserDeleteSale(sale) && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(sale); }} className="text-gray-400 hover:text-red-600 transition-colors" title="Delete"><TrashIcon className="w-5 h-5" /></button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4 px-1">
                        {isLoading ? (
                            <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center text-gray-400 font-medium shadow-sm">
                                No sales records found
                            </div>
                        ) : getFilteredData().map((sale) => {
                            const isExpanded = expandedMobileRows.includes(sale._id);
                            const isMultiple = (sale.items && sale.items.length > 0)
                                ? sale.items.flatMap(item => (item.brandEntries || [])).length > 1
                                : false;

                            let items = sale.items && sale.items.length > 0
                                ? sale.items.flatMap(item =>
                                    (item.brandEntries || []).length > 0
                                        ? item.brandEntries.map(be => ({
                                            ...be,
                                            productName: item.productName,
                                            lcNo: be.lcNo || item.lcNo || sale.lcNo || '',
                                            bag: (be.bag !== undefined && be.bag !== null && be.bag !== '') ? be.bag : (item.bag !== undefined && item.bag !== null && item.bag !== '') ? item.bag : (sale.bag || ''),
                                            warehouseName: be.warehouseName || item.warehouseName || sale.warehouseName || '',
                                            uom: be.uom || item.uom || 'QTY'
                                        }))
                                        : [{
                                            ...item,
                                            productName: item.productName,
                                            bag: (item.bag !== undefined && item.bag !== null && item.bag !== '') ? item.bag : (sale.bag || ''),
                                            lcNo: item.lcNo || sale.lcNo || '',
                                            warehouseName: item.warehouseName || sale.warehouseName || '',
                                            uom: item.uom || 'QTY'
                                        }]
                                )
                                : [{
                                    productName: sale.productName,
                                    brand: sale.brand,
                                    bag: sale.bag || '',
                                    quantity: sale.quantity,
                                    unitPrice: sale.unitPrice,
                                    lcNo: sale.lcNo || '',
                                    warehouseName: sale.warehouseName || '',
                                    uom: sale.uom || 'QTY'
                                }];

                            if (searchQuery) {
                                const query = searchQuery.toLowerCase();
                                const filteredItems = items.filter(it => {
                                    const lcNoMatch = (it.lcNo || '').toLowerCase().includes(query);
                                    const prodMatch = (it.productName || '').toLowerCase().includes(query);
                                    const brandMatch = (it.brand || '').toLowerCase().includes(query);
                                    const truckMatch = (it.truck || '').toLowerCase().includes(query);
                                    return lcNoMatch || prodMatch || brandMatch || truckMatch;
                                });
                                if (filteredItems.length > 0) {
                                    items = filteredItems;
                                }
                            }

                            return (
                                <div
                                    key={sale._id}
                                    onMouseDown={() => startLongPress(sale._id)}
                                    onMouseUp={endLongPress}
                                    onMouseLeave={endLongPress}
                                    onTouchStart={() => startLongPress(sale._id)}
                                    onTouchEnd={endLongPress}
                                    className={`sale-mgmt-mobile-card group cursor-pointer transition-all ${isExpanded ? 'shadow-md ring-1 ring-blue-500/10 p-4' : 'hover:bg-gray-50/30 p-2.5'} ${selectedItems.has(sale._id) ? 'bg-blue-50 ring-1 ring-blue-500/30' : ''}`}
                                    onClick={() => {
                                        if (isLongPressTriggered && isLongPressTriggered.current) return;
                                        (isSelectionMode || selectedItems.size > 0) ? toggleSelection(sale._id) : toggleMobileRowExpansion(sale._id);
                                    }}
                                >
                                    {/* Collapsed Single Line View / Expanded Header Row */}
                                    <div className={`flex items-center justify-between min-w-0 ${isExpanded ? 'border-b border-gray-50 pb-3 mb-4' : ''}`}>
                                        <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                                            {(isSelectionMode || selectedItems.size > 0) && (
                                                <div className="flex-shrink-0 pr-1" onClick={(e) => e.stopPropagation()}>
                                                    <input autoComplete="off"
                                                        type="checkbox"
                                                        checked={selectedItems.has(sale._id)}
                                                        onChange={() => toggleSelection(sale._id)}
                                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                </div>
                                            )}
                                            {/* Date & Inv */}
                                            <div className="flex-shrink-0">
                                                <div className="sale-mgmt-mobile-label">{formatDate(sale.date)}</div>
                                                <div className={`${!isExpanded ? 'text-[11px]' : 'text-sm'} font-black text-gray-900 truncate`}>{sale.invoiceNo || (saleType === 'Border' ? (sale.lcNo || sale.importer) : (sale.companyName || sale.customerName)) || 'No ID'}</div>
                                            </div>

                                            {!isExpanded && (
                                                <>
                                                    <div className="flex-1 min-w-0 border-l border-gray-100 pl-3">
                                                        <div className="sale-mgmt-mobile-label">Company</div>
                                                        <div className="text-[11px] font-bold text-gray-800 truncate">{getSafeString(sale.companyName) || sale.port || '-'}</div>
                                                    </div>
                                                    <div className="flex-shrink-0 border-l border-gray-100 pl-3 text-right">
                                                        <div className="sale-mgmt-mobile-label text-blue-600">Total</div>
                                                        <div className="text-[11px] font-black text-gray-900">৳{parseFloat(sale.totalAmount).toLocaleString('en-IN')}</div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 ml-2">
                                            {sale.isEdited && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[9px] font-medium border border-amber-100">
                                                    Edited
                                                </span>
                                            )}
                                            {isExpanded ? (
                                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                    {(sale.status === 'Requested' || sale.status === 'Edit_Requested') ? (
                                                        <>
                                                            <button onClick={(e) => { e.stopPropagation(); setViewData(sale); }} className="p-2 text-blue-600 bg-blue-50/50 rounded-lg transition-colors hover:bg-blue-100" title="View Details"><EyeIcon className="w-4 h-4" /></button>
                                                            {(canEditRequestedSale(sale) || canUserEditSale(sale)) && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(sale); }} className="p-2 text-blue-600 bg-blue-50/50 rounded-lg transition-colors hover:bg-blue-100" title="Edit"><EditIcon className="w-4 h-4" /></button>
                                                            )}
                                                            {canApprove && (
                                                                <>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(sale, 'accepted'); }} className="p-2 text-emerald-600 bg-emerald-50/50 rounded-lg transition-colors hover:bg-emerald-100" title="Accept"><CheckIcon className="w-4 h-4" /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(sale, 'Rejected'); }} className="p-2 text-red-600 bg-red-50/50 rounded-lg transition-colors hover:bg-red-100" title="Reject"><XIcon className="w-4 h-4" /></button>
                                                                </>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {canViewSale(sale) && (
                                                                <button onClick={(e) => { e.stopPropagation(); setViewData(sale); }} className="p-2 text-blue-600 bg-blue-50/50 rounded-lg transition-colors hover:bg-blue-100" title="View Details"><EyeIcon className="w-4 h-4" /></button>
                                                            )}
                                                            {canUserEditSale(sale) && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(sale); }} className="p-2 text-blue-600 bg-blue-50/50 rounded-lg transition-colors hover:bg-blue-100" title="Edit"><EditIcon className="w-4 h-4" /></button>
                                                            )}
                                                            {saleType === 'General' ? (
                                                                <div className="relative inline-block sale-pdf-dropdown-container">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActivePdfDropdown(activePdfDropdown === sale._id ? null : sale._id);
                                                                        }}
                                                                        className="p-2 bg-emerald-50 text-emerald-600 rounded-lg transition-colors hover:bg-emerald-100"
                                                                        title="Download PDF"
                                                                    >
                                                                        <FileTextIcon className="w-4 h-4" />
                                                                    </button>
                                                                    {activePdfDropdown === sale._id && (
                                                                        <div
                                                                            className="absolute right-0 top-full mt-1.5 w-32 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 z-[100] animate-in fade-in zoom-in-95 duration-100"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setActivePdfDropdown(null);
                                                                                    generateSaleInvoicePDF(sale, customers);
                                                                                }}
                                                                                className="w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 transition-colors"
                                                                            >
                                                                                <FileTextIcon className="w-3.5 h-3.5 text-emerald-600" />
                                                                                <span>Invoice</span>
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setActivePdfDropdown(null);
                                                                                    generateSaleChallanPDF(sale, customers);
                                                                                }}
                                                                                className="w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors border-t border-gray-50"
                                                                            >
                                                                                <ReceiptIcon className="w-3.5 h-3.5 text-blue-600" />
                                                                                <span>Challan</span>
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <button onClick={(e) => { e.stopPropagation(); generateSaleInvoicePDF(sale, customers); }} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg transition-colors hover:bg-emerald-100"><FileTextIcon className="w-4 h-4" /></button>
                                                            )}
                                                            {canUserDeleteSale(sale) && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(sale); }} className="p-2 bg-red-50 text-red-600 rounded-lg transition-colors hover:bg-red-100"><TrashIcon className="w-4 h-4" /></button>
                                                            )}
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleMobileRowExpansion(sale._id); }}
                                                        className="p-1.5 text-gray-400 bg-gray-100 rounded-lg transition-all ml-1"
                                                    >
                                                        <ChevronDownIcon className="w-4 h-4 rotate-180" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="p-1.5 bg-gray-100 text-gray-400 rounded-lg">
                                                    <ChevronDownIcon className="w-3.5 h-3.5" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded Only Content */}
                                    {isExpanded && (
                                        <>
                                            {/* Customer/Company Info */}
                                            <div className="grid grid-cols-[100px_8px_1fr] gap-y-2 text-xs items-baseline text-left px-1 pb-3 mb-3 border-b border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Inv No</span>
                                                <span className="text-gray-400 font-bold">:</span>
                                                <span className="font-bold text-gray-900">{sale.invoiceNo || '-'}</span>

                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Customer</span>
                                                <span className="text-gray-400 font-bold">:</span>
                                                <span className="font-bold text-gray-900">{getSafeString(sale.customerName) || '-'}</span>

                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Company</span>
                                                <span className="text-gray-400 font-bold">:</span>
                                                <span className="font-semibold text-gray-700">{getSafeString(sale.companyName) || sale.port || '-'}</span>

                                                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Entry By</span>
                                                <span className="text-indigo-400 font-bold">:</span>
                                                <span className="font-bold text-indigo-700">{getDisplayName(sale.requestedByUsername || sale.createdByUsername || sale.entryBy, sale.requestedBy || sale.requestedByUsername || sale.createdByName || sale.createdBy || '-')}</span>

                                                {(sale.acceptedBy || sale.approvedByName || sale.approvedBy) && (sale.status || '').toLowerCase() !== 'requested' && (
                                                    <>
                                                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Approved By</span>
                                                        <span className="text-emerald-400 font-bold">:</span>
                                                        <span className="font-bold text-emerald-700">✓ {getDisplayName(sale.acceptedByUsername || sale.approvedByUsername, sale.acceptedBy || sale.approvedByName || sale.approvedBy)}</span>
                                                    </>
                                                )}

                                                {(sale.editedByName || sale.editedBy || sale.editRequestedBy) && (
                                                    <>
                                                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Edited By</span>
                                                        <span className="text-amber-400 font-bold">:</span>
                                                        <span className="font-bold text-amber-700">✎ {getDisplayName(sale.editedByUsername || sale.editRequestedByUsername, sale.editedByName || sale.editedBy || sale.editRequestedBy)}</span>
                                                    </>
                                                )}

                                                {(sale.editApprovedByName || sale.editApprovedBy) && !sale.isEdited && (
                                                    <>
                                                        <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">Edit Approved</span>
                                                        <span className="text-purple-400 font-bold">:</span>
                                                        <span className="font-bold text-purple-700">✓✎ {getDisplayName(sale.editApprovedByUsername, sale.editApprovedByName || sale.editApprovedBy)}</span>
                                                    </>
                                                )}
                                            </div>

                                            {/* Items Section */}
                                            <div className="sale-mgmt-mobile-section mt-1">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="text-[10px] font-bold text-gray-600 uppercase">Products & Quantities</div>
                                                    {isMultiple && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleMobileRowExpansion(sale._id);
                                                            }}
                                                            className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors"
                                                        >
                                                            Show Less
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="space-y-3">
                                                    {items.map((it, idx) => (
                                                        <div key={idx} className="border border-gray-100 rounded-xl p-3 bg-gray-50/30">
                                                            <div className="grid grid-cols-[100px_8px_1fr] gap-y-2 text-xs items-baseline text-left">
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Product</span>
                                                                <span className="text-gray-400 font-bold">:</span>
                                                                <span className="font-bold text-gray-900">{it.productName || '-'}</span>

                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Brand</span>
                                                                <span className="text-gray-400 font-bold">:</span>
                                                                <span className="font-semibold text-gray-700">{it.brand || '-'}</span>

                                                                {(it.bag !== undefined && it.bag !== null && it.bag !== '') && (
                                                                    <>
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bag</span>
                                                                        <span className="text-gray-400 font-bold">:</span>
                                                                        <span className="font-semibold text-gray-800">{parseFloat(it.bag || 0).toLocaleString('en-US')}</span>
                                                                    </>
                                                                )}

                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Qty</span>
                                                                <span className="text-gray-400 font-bold">:</span>
                                                                <span className="font-bold text-gray-800">
                                                                    {parseFloat(it.quantity || 0).toLocaleString('en-US')} kg
                                                                </span>

                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Price</span>
                                                                <span className="text-gray-400 font-bold">:</span>
                                                                <span className="font-medium text-blue-600">৳{parseFloat(it.unitPrice || 0).toLocaleString('en-IN')}</span>

                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total</span>
                                                                <span className="text-gray-400 font-bold">:</span>
                                                                <span className="font-black text-gray-900">
                                                                    ৳ {(() => {
                                                                        const qty = it.uom === 'BAG' ? (parseFloat(it.bag) || 0) : (parseFloat(it.quantity) || 0);
                                                                        return (qty * parseFloat(it.unitPrice || 0)).toLocaleString('en-US');
                                                                    })()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Money Summary Details List */}
                                            <div className="grid grid-cols-[100px_8px_1fr] gap-y-2 text-xs items-baseline text-left pt-3 border-t border-gray-100 mt-4">
                                                <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Discount</span>
                                                <span className="text-red-400 font-bold">:</span>
                                                <span className="font-black text-red-600">৳{parseFloat(sale.discount || 0).toLocaleString('en-IN')}</span>

                                                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Total</span>
                                                <span className="text-blue-400 font-bold">:</span>
                                                <span className="font-black text-gray-900">৳{parseFloat(sale.totalAmount).toLocaleString('en-IN')}</span>

                                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Truck Fare</span>
                                                <span className="text-emerald-400 font-bold">:</span>
                                                <span className="font-black text-emerald-700">৳{parseFloat(sale.paidAmount || 0).toLocaleString('en-IN')}</span>

                                                <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Balance</span>
                                                <span className="text-orange-400 font-bold">:</span>
                                                <span className="font-black text-orange-700">৳{parseFloat(sale.dueAmount || 0).toLocaleString('en-IN')}</span>

                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</span>
                                                <span className="text-gray-400 font-bold">:</span>
                                                <span>
                                                    {(() => {
                                                        const storedDue = parseFloat(sale.dueAmount);
                                                        const storedTotal = parseFloat(sale.totalAmount) || 0;
                                                        let dueVal = 0;
                                                        if (!isNaN(storedDue) && (storedDue > 0 || storedTotal > 0)) {
                                                            dueVal = storedDue;
                                                        } else {
                                                            const calculatedTotal = items.reduce((sum, it) => {
                                                                const qty = it.uom === 'BAG' ? (parseFloat(it.bag) || 0) : (parseFloat(it.quantity) || 0);
                                                                return sum + (qty * parseFloat(it.unitPrice || 0));
                                                            }, 0);
                                                            dueVal = Math.max(0, calculatedTotal - parseFloat(sale.discount || 0) - parseFloat(sale.paidAmount || 0));
                                                        }
                                                        const st = (sale.status || '').toLowerCase();
                                                        if (st === 'requested') {
                                                            return (
                                                                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-200/60 inline-flex items-center gap-1 shadow-sm">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                                    Requested
                                                                </span>
                                                            );
                                                        }
                                                        if (st === 'rejected') {
                                                            return (
                                                                <span className="px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-xs font-bold border border-red-200/60 inline-flex items-center gap-1 shadow-sm">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                                    Rejected
                                                                </span>
                                                            );
                                                        }
                                                        const isComplete = st === 'complete' || st === 'accepted' || (st !== 'pending' && dueVal <= 0);
                                                        return isComplete ? (
                                                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200/60 inline-flex items-center gap-1 shadow-sm">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                Complete
                                                            </span>
                                                        ) : (
                                                            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-200/60 inline-flex items-center gap-1 shadow-sm">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                                Pending
                                                            </span>
                                                        );
                                                    })()}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                </div>
            )}
            {viewData && renderViewModal()}

            {/* Bulk Rate Edit Modal */}
            {showBulkRateModal && typeof document !== 'undefined' && document.body && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowBulkRateModal(false)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 z-10">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-900">Edit Rate</h3>
                            <button onClick={() => setShowBulkRateModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                <p className="text-sm text-blue-700 font-medium">
                                    Updating rate for <span className="font-bold">{selectedItems.size}</span> selected border sales.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">New Rate (৳)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">৳</span>
                                    <input autoComplete="off"
                                        type="number"
                                        value={bulkRate}
                                        onChange={(e) => setBulkRate(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-gray-900"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setShowBulkRateModal(false)}
                                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkRateUpdate}
                                disabled={isSubmitting || !bulkRate}
                                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                            >
                                {isSubmitting ? 'Updating...' : 'Update Rate'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {confirmModalConfig && (
                <ConfirmModal
                    isOpen={!!confirmModalConfig}
                    title={confirmModalConfig.title}
                    message={confirmModalConfig.message}
                    type={confirmModalConfig.type}
                    confirmText={confirmModalConfig.confirmText}
                    cancelText={confirmModalConfig.cancelText}
                    onConfirm={confirmModalConfig.onConfirm}
                    onClose={confirmModalConfig.onClose || (() => setConfirmModalConfig(null))}
                    isSubmitting={isSubmitting}
                />
            )}
        </div>
    );
};

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, type = 'danger', confirmText = 'Confirm', cancelText = 'Cancel', isSubmitting = false }) => {
    if (!isOpen || typeof document === 'undefined' || !document.body) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white border border-gray-100 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all animate-in zoom-in-95 duration-200 z-10">
                <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
                    type === 'danger' ? 'bg-red-100 text-red-600' :
                    type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                }`}>
                    {type === 'danger' ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    ) : type === 'success' ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    )}
                </div>

                <h3 className="text-base font-extrabold text-gray-900 mb-1.5">{title}</h3>
                <p className="text-xs text-gray-500 mb-6 leading-relaxed">{message}</p>

                <div className="flex items-center justify-center gap-3">
                    {onClose && cancelText && (
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isSubmitting}
                        className={`px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                            type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20' :
                            type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                        }`}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Processing...</span>
                            </>
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SaleManagement;
