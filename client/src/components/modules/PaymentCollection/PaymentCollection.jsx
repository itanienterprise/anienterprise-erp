import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SearchIcon, FunnelIcon, DollarSignIcon, EyeIcon, PlusIcon, XIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon, EditIcon, UserIcon, BarChartIcon, CalendarIcon, CheckIcon, FileTextIcon } from '../../Icons';
import { API_BASE_URL, formatDate, SortIcon } from '../../../utils/helpers';
import { generateMoneyReceiptPDF } from '../../../utils/pdfGenerator';
import { decryptData, encryptData } from '../../../utils/encryption';
import { hasPermission } from '../../../utils/permissionHelper';
import CustomDatePicker from '../../shared/CustomDatePicker';
import axios from '../../../utils/api';
import PaymentCollectionReport from './PaymentCollectionReport';
import './PaymentCollection.css';

const PaymentCollection = ({ addNotification, currentUser: propCurrentUser, refreshPendingIndicators, highlightId, isRequestedNotif }) => {
    const [payments, setPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [currentUser] = useState(() => {
        if (propCurrentUser) return propCurrentUser;
        try {
            const saved = localStorage.getItem('currentUser');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const canAdd = hasPermission(currentUser, 'paymentCollection', 'add');
    const canEdit = hasPermission(currentUser, 'paymentCollection', 'edit');
    const canDelete = hasPermission(currentUser, 'paymentCollection', 'delete');
    const canManage = canEdit || canDelete;
    const isAdmin = currentUser?.username === 'admin' || (currentUser?.role || '').toLowerCase() === 'admin';
    const isDataEntry = (currentUser?.role || '').toLowerCase() === 'data entry';
    const canApprove = hasPermission(currentUser, 'paymentCollection', 'special') || hasPermission(currentUser, 'paymentCollection', 'approve') || isAdmin;
    const canApproveEditRequest = hasPermission(currentUser, 'paymentCollection', 'approveEditRequest') || isAdmin;
    const canViewEditRequest = hasPermission(currentUser, 'paymentCollection', 'editRequest') || hasPermission(currentUser, 'paymentCollection', 'approveEditRequest') || canApprove;
    const canViewPaymentRequest = hasPermission(currentUser, 'paymentCollection', 'paymentRequest') || hasPermission(currentUser, 'paymentCollection', 'paymentApprovalRequest') || canApprove;
    const canShowEntryBy = isAdmin || (currentUser?.role || '').toLowerCase() === 'incharge' || hasPermission(currentUser, 'paymentCollection', 'showEntryBy');

    // Requested & Edit Request Toggle Filters
    const [isRequestedOnly, setIsRequestedOnly] = useState(false);
    useEffect(() => { if (isRequestedNotif) { setIsRequestedOnly(true); } }, [isRequestedNotif]);
    const [isEditRequestedOnly, setIsEditRequestedOnly] = useState(false);

    // Selection & Bulk Actions
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [confirmModalConfig, setConfirmModalConfig] = useState(null);

    const longPressTimerRef = useRef(null);
    const isLongPressRef = useRef(false);
    const rowRefs = useRef({});

    // Scroll to and highlight the row matching highlightId when it arrives
    useEffect(() => {
        if (!highlightId) return;

        // Auto-switch to Requested or Edit Requested filter if the target item requires it
        const targetItem = payments.find(p => p.receiptNo === highlightId || p.id === highlightId);
        if (targetItem) {
            const isReq = (targetItem.status || '').toLowerCase() === 'requested';
            const isEditReq = (targetItem.isEdited === true || targetItem.isEdited === 'true') && !isReq;
            if (isReq) {
                setIsRequestedOnly(true);
                setIsEditRequestedOnly(false);
            } else if (isEditReq) {
                setIsEditRequestedOnly(true);
                setIsRequestedOnly(false);
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
                    if (!scrollToRow()) {
                        setSearchQuery('');
                        setTimeout(scrollToRow, 300);
                    }
                }, 700);
                return () => clearTimeout(t2);
            }
        }, 250);

        return () => clearTimeout(t1);
    }, [highlightId, payments]);

    const handleLongPressStart = (groupKey) => {
        isLongPressRef.current = false;
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            setSelectedItems(prev => {
                const next = new Set(prev);
                if (next.has(groupKey)) {
                    next.delete(groupKey);
                } else {
                    next.add(groupKey);
                }
                return next;
            });
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                try { navigator.vibrate(50); } catch (e) {}
            }
        }, 500);
    };

    const handleLongPressEnd = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const requestedCount = useMemo(() => {
        const unique = new Set(payments.filter(p => (p.status || '').toLowerCase() === 'requested').map(p => p.id || p.receiptNo));
        return unique.size;
    }, [payments]);

    const editRequestedCount = useMemo(() => {
        const unique = new Set(payments.filter(p => (p.isEdited === true || p.isEdited === 'true') && (p.status || '').toLowerCase() !== 'requested').map(p => p.id || p.receiptNo));
        return unique.size;
    }, [payments]);

    // Edit States
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingPayment, setEditingPayment] = useState(null);

    // Filter and Report States
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [showReport, setShowReport] = useState(false);

    const initialFilterState = {
        startDate: '',
        endDate: '',
        method: '',
        bankName: '',
        branch: '',
        customer: '',
        quickRange: 'monthly',
        selectedMonth: new Date().getMonth() + 1,
        selectedYear: new Date().getFullYear()
    };
    const [filters, setFilters] = useState(initialFilterState);
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(null);
    const [filterSearchInputs, setFilterSearchInputs] = useState({ bankName: '', branch: '', method: '', customer: '' });

    useEffect(() => {
        setSelectedItems(new Set());
    }, [isRequestedOnly, isEditRequestedOnly, searchQuery, filters]);

    const filterPanelRef = useRef(null);
    const filterButtonRef = useRef(null);

    // New States
    const [showAddModal, setShowAddModal] = useState(false);
    const [expandedMobileCards, setExpandedMobileCards] = useState(null);
    const [rawCustomers, setRawCustomers] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [collapsedRows, setCollapsedRows] = useState(new Set());

    const toggleRowExpansion = (groupKey) => {
        const newCollapsed = new Set(collapsedRows);
        if (newCollapsed.has(groupKey)) {
            newCollapsed.delete(groupKey);
        } else {
            newCollapsed.add(groupKey);
        }
        setCollapsedRows(newCollapsed);
    };
    const [submitStatus, setSubmitStatus] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [paymentToDelete, setPaymentToDelete] = useState(null);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [banks, setBanks] = useState([]);
    const [bankSearchQuery, setBankSearchQuery] = useState('');
    const customerDropdownRef = useRef(null);
    const methodDropdownRef = useRef(null);
    const statusDropdownRef = useRef(null);
    const bankDropdownRef = useRef(null);
    const branchDropdownRef = useRef(null);

    const [newPayment, setNewPayment] = useState({
        customerId: '',
        date: new Date().toISOString().split('T')[0],
        items: [{
            id: Date.now().toString(),
            method: 'Cash',
            bankName: '',
            accountNo: '',
            branch: '',
            receiveBy: '',
            place: '',
            amount: ''
        }],
        status: 'Completed',
        reference: '',
        discount: ''
    });

    const [employeesMap, setEmployeesMap] = useState({});

    useEffect(() => {
        fetchPayments();
        fetchBanks();
        fetchEmployees();
    }, []);

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

    const getEntryByName = (entryByCode, entryByName) => {
        if (entryByName && !entryByName.startsWith('E-') && !entryByName.startsWith('A-') && entryByName !== entryByCode) {
            return entryByName;
        }
        if (entryByCode && employeesMap[entryByCode]) {
            return employeesMap[entryByCode];
        }
        if (entryByName && employeesMap[entryByName]) {
            return employeesMap[entryByName];
        }
        if (entryByName && entryByName !== entryByCode) {
            return entryByName;
        }
        return entryByCode || '—';
    };

    const getEditedByName = (editedByCode, editedByName) => {
        if (editedByName && !editedByName.startsWith('E-') && !editedByName.startsWith('A-') && editedByName !== editedByCode) {
            return editedByName;
        }
        if (editedByCode && employeesMap[editedByCode]) {
            return employeesMap[editedByCode];
        }
        if (editedByName && employeesMap[editedByName]) {
            return employeesMap[editedByName];
        }
        if (editedByName && editedByName !== editedByCode) {
            return editedByName;
        }
        return editedByCode || '';
    };

    const fetchBanks = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/banks`);
            const rawData = Array.isArray(response.data) ? response.data : [];
            // Handle backwards compatibility for single-branch records
            const decryptedBanks = rawData.map(bank => {
                const branches = bank.branches || [{
                    branch: bank.branch,
                    accountName: bank.accountName,
                    accountNo: bank.accountNo
                }];
                return { ...bank, branches };
            });
            const filteredBanks = decryptedBanks.filter(bank => !bank.isIndian);

            const bankMap = new Map();
            filteredBanks.forEach(b => {
                const name = (b.bankName || '').trim();
                if (!name) return;
                if (!bankMap.has(name)) {
                    bankMap.set(name, {
                        ...b,
                        bankName: name,
                        branches: Array.isArray(b.branches) ? [...b.branches] : []
                    });
                } else {
                    const existing = bankMap.get(name);
                    (b.branches || []).forEach(br => {
                        if (br && br.branch && !existing.branches.some(e => (e.branch || '').trim() === (br.branch || '').trim())) {
                            existing.branches.push(br);
                        }
                    });
                }
            });

            setBanks(Array.from(bankMap.values()));
        } catch (error) {
            console.error('Error fetching banks:', error);
        }
    };

    // Click outside listener for dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target && !document.body.contains(event.target)) {
                return;
            }
            if (!activeDropdown) return;

            // Handle static dropdowns (customer)
            if (activeDropdown === 'customer' && customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
                return;
            }

            // Handle dynamic item dropdowns (method, bank, branch, status)
            const dropdownElement = document.querySelector(`[data-dropdown-id="${activeDropdown}"]`);
            if (dropdownElement && !dropdownElement.contains(event.target)) {
                setActiveDropdown(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target && !document.body.contains(event.target)) {
                return;
            }
            if (showFilterPanel && filterPanelRef.current && filterButtonRef.current) {
                if (!filterPanelRef.current.contains(event.target) && !filterButtonRef.current.contains(event.target)) {
                    // Check if click was inside a dropdown
                    const isDropdownClick = event.target.closest('[data-filter-dropdown]');
                    if (!isDropdownClick) {
                        setShowFilterPanel(false);
                        setFilterDropdownOpen(null);
                    }
                }
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setShowFilterPanel(false);
                setFilterDropdownOpen(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showFilterPanel]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => {
            const next = { ...prev, [key]: value };
            if (key === 'startDate' || key === 'endDate') {
                next.quickRange = 'custom';
            }
            return next;
        });
        setFilterDropdownOpen(null);
    };

    const resetFilters = () => {
        setFilters(initialFilterState);
        setFilterSearchInputs({ bankName: '', branch: '', method: '', customer: '' });
        setSearchQuery('');
    };

    useEffect(() => {
        setFilterSearchInputs({
            bankName: filters.bankName || '',
            branch: filters.branch || '',
            method: filters.method || '',
            customer: filters.customer || ''
        });
    }, [filters, showFilterPanel]);

    // Derived unique options for filters
    const uniqueMethods = ["Cash", "Bank Deposit", "Online Banking", "Mobile Banking", "Cheque"];
    const uniqueBanks = [...new Set(payments.map(p => p.bankName).filter(Boolean))].sort();
    const uniqueBranches = [...new Set(payments.map(p => p.branch).filter(Boolean))].sort();
    const uniqueCustomers = [...new Set(payments.map(p => p.companyName || p.customerName).filter(Boolean))].sort();

    const fetchPayments = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/customers`);
            const rawData = Array.isArray(response.data) ? response.data : [];
            const allPayments = [];
            const customersList = [];

            rawData.forEach(customer => {
                customersList.push(customer);

                const customerHistory = customer.paymentHistory || [];
                customerHistory.forEach(payment => {
                    allPayments.push({
                        ...payment,
                        customerId: customer._id,
                        customerName: customer.customerName,
                        companyName: customer.companyName,
                        customerAddress: customer.location || '',
                        readableCustomerId: customer.customerId
                    });
                });
            });

            setPayments(allPayments);
            setRawCustomers(customersList);
            refreshPendingIndicators?.();
        } catch (error) {
            console.error('Error fetching payments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateReceipt = (payment, customAmount = null, items = null) => {
        const customer = rawCustomers.find(c => c._id === payment.customerId);

        // Calculate historic balance
        const paidAmount = customAmount !== null ? customAmount : (parseFloat(payment.amount) || 0);

        const salesUpTo = (customer?.salesHistory || []).filter(s => s.date <= payment.date);
        const paymentsUpTo = (customer?.paymentHistory || []).filter(p => p.date <= payment.date);

        const totalSales = salesUpTo.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const totalSalesPaid = salesUpTo.reduce((sum, item) => sum + (parseFloat(item.paid) || 0), 0);
        const totalDiscount = salesUpTo.reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0);
        const totalHistoryPaid = paymentsUpTo.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

        const balanceDue = Math.max(0, totalSales - totalSalesPaid - totalDiscount - totalHistoryPaid);
        const previousBalance = balanceDue + paidAmount;

        // Build items array for the table
        const tableItems = items || [payment];

        const receiptData = {
            ...payment,
            amount: paidAmount,
            address: customer?.address || '',
            phone: customer?.phone || '',
            previousBalance: previousBalance,
            balanceDue: balanceDue,
            items: tableItems
        };
        generateMoneyReceiptPDF(receiptData);
    };

    const addPaymentItem = () => {
        setNewPayment(prev => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    id: Date.now().toString(),
                    method: 'Cash',
                    bankName: '',
                    accountNo: '',
                    branch: '',
                    receiveBy: '',
                    place: '',
                    amount: ''
                }
            ]
        }));
    };

    const removePaymentItem = (id) => {
        if (newPayment.items.length <= 1) return;
        setNewPayment(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== id)
        }));
    };

    const updatePaymentItem = (id, updates) => {
        setNewPayment(prev => ({
            ...prev,
            items: prev.items.map(item => item.id === id ? { ...item, ...updates } : item)
        }));
    };

    const handleDeletePayment = (payment) => {
        if (!canDelete) {
            alert('Forbidden: You do not have permission to delete payment collections');
            return;
        }
        setPaymentToDelete(payment);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!paymentToDelete) return;

        setIsSubmitting(true);
        try {
            const custRes = await axios.get(`${API_BASE_URL}/api/customers/${paymentToDelete.customerId}`);
            const customer = custRes.data;
            const updatedHistory = (customer.paymentHistory || []).filter(p => p.id !== paymentToDelete.id);
            const updatedCustomer = { ...customer, paymentHistory: updatedHistory };
            await axios.put(`${API_BASE_URL}/api/customers/${paymentToDelete.customerId}`, updatedCustomer);

            // Show success briefly
            setSubmitStatus('success');
            setTimeout(() => {
                setShowDeleteConfirm(false);
                setPaymentToDelete(null);
                setSubmitStatus(null);
                fetchPayments();
            }, 1000);

            // Notification
            try {
                const now = new Date();
                const dateStr = now.toLocaleDateString('en-GB');
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const deleterName = currentUser?.name || currentUser?.username || 'An employee';
                const partyName = paymentToDelete?.companyName || paymentToDelete?.customerName || 'Customer';
                if (addNotification) await addNotification(
                    'Payment Deleted',
                    `${dateStr} | ${timeStr} | ${deleterName} deleted payment (${paymentToDelete?.receiptNo}) from ${partyName}`,
                    ['admin', 'incharge', 'sales manager'],
                    ['admin']
                );
            } catch (notifErr) { console.error('Notification error:', notifErr); }
        } catch (error) {
            console.error('Error deleting payment:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatusUpdate = async (paymentGroup, newStatus) => {
        try {
            setIsSubmitting(true);
            const custRes = await axios.get(`${API_BASE_URL}/api/customers/${paymentGroup.customerId}`);
            const customer = custRes.data;

            const groupItemIds = new Set((paymentGroup.items || []).map(i => i.id).filter(Boolean));
            const groupReceiptNo = paymentGroup.receiptNo;

            const isItemMatch = (p) => {
                if (p.id && groupItemIds.has(p.id)) return true;
                if (groupReceiptNo && p.receiptNo && p.receiptNo === groupReceiptNo) return true;
                return false;
            };

            if (newStatus === 'Rejected') {
                if (paymentGroup.isEdited === true && (paymentGroup.status || '').toLowerCase() !== 'requested') {
                    // Revert edit request back to original data before edit
                    const updatedHistory = (customer.paymentHistory || []).map(p => {
                        if (isItemMatch(p)) {
                            if (p.originalData) {
                                const { originalData, ...rest } = p;
                                return {
                                    ...rest,
                                    ...originalData,
                                    isEdited: false
                                };
                            }
                            return { ...p, isEdited: false };
                        }
                        return p;
                    });
                    await axios.put(`${API_BASE_URL}/api/customers/${paymentGroup.customerId}`, { ...customer, paymentHistory: updatedHistory });
                } else {
                    // Remove requested payment
                    const updatedHistory = (customer.paymentHistory || []).filter(p => !isItemMatch(p));
                    await axios.put(`${API_BASE_URL}/api/customers/${paymentGroup.customerId}`, { ...customer, paymentHistory: updatedHistory });
                }
            } else {
                // Accept
                const updatedHistory = (customer.paymentHistory || []).map(p => {
                    if (isItemMatch(p)) {
                        const { originalData, ...rest } = p;
                        return { ...rest, status: 'Accepted', isEdited: false };
                    }
                    return p;
                });
                await axios.put(`${API_BASE_URL}/api/customers/${paymentGroup.customerId}`, { ...customer, paymentHistory: updatedHistory });
            }
            fetchPayments();

            // Notification
            try {
                const now = new Date();
                const dateStr = now.toLocaleDateString('en-GB');
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const actorName = currentUser?.name || currentUser?.username || 'Admin';
                const partyName = paymentGroup.companyName || paymentGroup.customerName || 'Customer';
                const receiptNo = paymentGroup.receiptNo || '';
                const isEditRequest = paymentGroup.isEdited === true && (paymentGroup.status || '').toLowerCase() !== 'requested';

                let title, msg;
                if (isEditRequest) {
                    title = newStatus === 'Accepted' ? 'Edit Request Accepted' : 'Edit Request Rejected';
                    msg = newStatus === 'Accepted'
                        ? `${dateStr} | ${timeStr} | ${actorName} accepted the edit request for payment (${receiptNo}) from ${partyName}`
                        : `${dateStr} | ${timeStr} | ${actorName} rejected the edit request for payment (${receiptNo}) from ${partyName} — reverted to original`;
                } else {
                    title = newStatus === 'Accepted' ? 'Payment Request Accepted' : 'Payment Request Rejected';
                    msg = newStatus === 'Accepted'
                        ? `${dateStr} | ${timeStr} | ${actorName} accepted the payment request (${receiptNo}) of ৳${paymentGroup.items?.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0).toLocaleString('en-IN')} from ${partyName}`
                        : `${dateStr} | ${timeStr} | ${actorName} rejected the payment request (${receiptNo}) from ${partyName}`;
                }
                if (addNotification) await addNotification(title, msg, ['admin', 'incharge', 'sales manager'], ['admin']);
            } catch (notifErr) { console.error('Notification error:', notifErr); }
        } catch (error) {
            console.error('Error updating payment status:', error);
            alert('Failed to update payment status');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBulkAccept = () => {
        if (!selectedItems || selectedItems.size === 0) return;

        const pendingSelectedGroups = displayedGroups.filter(group => {
            const isSelected = selectedItems.has(group.key);
            const isPending = (group.status || '').toLowerCase() === 'requested' || group.isEdited === true;
            return isSelected && isPending;
        });

        if (pendingSelectedGroups.length === 0) {
            setConfirmModalConfig({
                title: 'No Pending Requests Selected',
                message: (requestedCount > 0 || editRequestedCount > 0)
                    ? `The selected items are already accepted. You have pending request(s) waiting for approval.`
                    : 'The selected items are already accepted and there are no pending requests.',
                type: 'info',
                confirmText: 'OK',
                onConfirm: () => setConfirmModalConfig(null),
                onClose: () => setConfirmModalConfig(null)
            });
            return;
        }

        setConfirmModalConfig({
            title: 'Confirm Bulk Accept',
            message: `Are you sure you want to accept ${pendingSelectedGroups.length} selected Payment Collection request(s)?`,
            type: 'success',
            confirmText: 'Accept Selected',
            cancelText: 'Cancel',
            onConfirm: () => executeBulkAccept(pendingSelectedGroups),
            onClose: () => setConfirmModalConfig(null)
        });
    };

    const executeBulkAccept = async (groupsToAccept) => {
        try {
            setIsSubmitting(true);
            setConfirmModalConfig(null);

            const actorName = currentUser?.name || currentUser?.username || 'Admin';
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-GB');
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const customerMap = {};
            groupsToAccept.forEach(group => {
                if (!customerMap[group.customerId]) {
                    customerMap[group.customerId] = [];
                }
                customerMap[group.customerId].push(group);
            });

            for (const [customerId, customerGroups] of Object.entries(customerMap)) {
                const custRes = await axios.get(`${API_BASE_URL}/api/customers/${customerId}`);
                const customer = custRes.data;

                const targetItemIds = new Set();
                const targetReceiptNos = new Set();
                customerGroups.forEach(g => {
                    if (g.receiptNo) targetReceiptNos.add(g.receiptNo);
                    (g.items || []).forEach(item => {
                        if (item.id) targetItemIds.add(item.id);
                        if (item.receiptNo) targetReceiptNos.add(item.receiptNo);
                    });
                });

                const updatedHistory = (customer.paymentHistory || []).map(p => {
                    const matchesId = p.id && targetItemIds.has(p.id);
                    const matchesReceipt = p.receiptNo && targetReceiptNos.has(p.receiptNo);
                    if (matchesId || matchesReceipt) {
                        const { originalData, ...rest } = p;
                        return { ...rest, status: 'Accepted', isEdited: false };
                    }
                    return p;
                });

                await axios.put(`${API_BASE_URL}/api/customers/${customerId}`, { ...customer, paymentHistory: updatedHistory });
            }

            if (addNotification) {
                await addNotification(
                    'Bulk Payment Requests Accepted',
                    `${dateStr} | ${timeStr} | ${actorName} bulk accepted ${groupsToAccept.length} payment collection request(s)`,
                    ['admin', 'incharge', 'sales manager'],
                    ['admin']
                );
            }

            setSelectedItems(new Set());
            fetchPayments();
        } catch (error) {
            console.error('Error performing bulk accept:', error);
            setConfirmModalConfig({
                title: 'Operation Failed',
                message: 'Failed to accept selected payment requests.',
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

        const pendingSelectedGroups = displayedGroups.filter(group => {
            const isSelected = selectedItems.has(group.key);
            const isPending = (group.status || '').toLowerCase() === 'requested' || group.isEdited === true;
            return isSelected && isPending;
        });

        if (pendingSelectedGroups.length === 0) {
            setConfirmModalConfig({
                title: 'No Pending Requests Selected',
                message: 'None of the selected items are pending requests.',
                type: 'info',
                confirmText: 'OK',
                onConfirm: () => setConfirmModalConfig(null),
                onClose: () => setConfirmModalConfig(null)
            });
            return;
        }

        setConfirmModalConfig({
            title: 'Confirm Bulk Reject',
            message: `Are you sure you want to reject ${pendingSelectedGroups.length} selected Payment Collection request(s)?`,
            type: 'danger',
            confirmText: 'Reject Selected',
            cancelText: 'Cancel',
            onConfirm: () => executeBulkReject(pendingSelectedGroups),
            onClose: () => setConfirmModalConfig(null)
        });
    };

    const executeBulkReject = async (groupsToReject) => {
        try {
            setIsSubmitting(true);
            setConfirmModalConfig(null);

            const actorName = currentUser?.name || currentUser?.username || 'Admin';
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-GB');
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const customerMap = {};
            groupsToReject.forEach(group => {
                if (!customerMap[group.customerId]) {
                    customerMap[group.customerId] = [];
                }
                customerMap[group.customerId].push(group);
            });

            for (const [customerId, customerGroups] of Object.entries(customerMap)) {
                const custRes = await axios.get(`${API_BASE_URL}/api/customers/${customerId}`);
                const customer = custRes.data;

                const editRequestIds = new Set();
                const editRequestReceipts = new Set();
                const newRequestIds = new Set();
                const newRequestReceipts = new Set();

                customerGroups.forEach(g => {
                    const isEditReq = g.isEdited === true && (g.status || '').toLowerCase() !== 'requested';
                    (g.items || []).forEach(item => {
                        if (isEditReq) {
                            if (item.id) editRequestIds.add(item.id);
                            if (item.receiptNo) editRequestReceipts.add(item.receiptNo);
                        } else {
                            if (item.id) newRequestIds.add(item.id);
                            if (item.receiptNo) newRequestReceipts.add(item.receiptNo);
                        }
                    });
                    if (g.receiptNo) {
                        if (isEditReq) editRequestReceipts.add(g.receiptNo);
                        else newRequestReceipts.add(g.receiptNo);
                    }
                });

                const updatedHistory = (customer.paymentHistory || [])
                    .filter(p => !((p.id && newRequestIds.has(p.id)) || (p.receiptNo && newRequestReceipts.has(p.receiptNo))))
                    .map(p => {
                        if ((p.id && editRequestIds.has(p.id)) || (p.receiptNo && editRequestReceipts.has(p.receiptNo))) {
                            if (p.originalData) {
                                const { originalData, ...rest } = p;
                                return { ...rest, ...originalData, isEdited: false };
                            }
                            return { ...p, isEdited: false };
                        }
                        return p;
                    });

                await axios.put(`${API_BASE_URL}/api/customers/${customerId}`, { ...customer, paymentHistory: updatedHistory });
            }

            if (addNotification) {
                await addNotification(
                    'Bulk Payment Requests Rejected',
                    `${dateStr} | ${timeStr} | ${actorName} bulk rejected ${groupsToReject.length} payment collection request(s)`,
                    ['admin', 'incharge', 'sales manager'],
                    ['admin']
                );
            }

            setSelectedItems(new Set());
            fetchPayments();
        } catch (error) {
            console.error('Error performing bulk reject:', error);
            setConfirmModalConfig({
                title: 'Operation Failed',
                message: 'Failed to reject selected payment requests.',
                type: 'danger',
                confirmText: 'OK',
                onConfirm: () => setConfirmModalConfig(null)
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditInitiation = (payment) => {
        setIsEditMode(true);
        setEditingPayment(payment);

        // Find all payment items under the same receipt number
        const relatedPayments = payments.filter(p => p.receiptNo === payment.receiptNo && p.customerId === payment.customerId);

        // Sum the discount value across related payments
        const discountVal = relatedPayments.reduce((sum, p) => sum + (parseFloat(p.discount) || 0), 0);

        setNewPayment({
            customerId: payment.customerId,
            date: payment.date,
            items: relatedPayments.map(p => ({
                id: p.id,
                method: p.method,
                bankName: p.bankName || '',
                accountNo: p.accountNo || '',
                branch: p.branch || '',
                receiveBy: p.receiveBy || '',
                place: p.place || '',
                amount: p.amount.toString()
            })),
            status: payment.status || 'Completed',
            reference: payment.reference || '',
            discount: discountVal > 0 ? discountVal.toString() : ''
        });
        setCustomerSearchQuery('');
        setShowAddModal(true);
    };

    const handleAddCollection = async (e) => {
        e.preventDefault();
        if (!canAdd) {
            alert('Forbidden: You do not have permission to add payment collections');
            return;
        }
        if (!newPayment.customerId) {
            alert('Please select a Customer / Party first');
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const custRes = await axios.get(`${API_BASE_URL}/api/customers/${newPayment.customerId}`);
            const customer = custRes.data;

            const lastReceiptNo = payments.reduce((max, p) => {
                const no = parseInt(p.receiptNo?.split('-')[1]);
                return !isNaN(no) && no > max ? no : max;
            }, 0);

            const nextReceiptNo = `RC-${String(lastReceiptNo + 1).padStart(4, '0')}`;
            const initialStatus = 'Requested';
            const paymentEntries = newPayment.items
                .filter(item => item.amount !== '' && item.amount !== null && !isNaN(parseFloat(item.amount)))
                .map((item, idx) => ({
                    receiptNo: nextReceiptNo,
                    date: newPayment.date,
                    method: item.method,
                    bankName: item.bankName,
                    accountNo: item.accountNo,
                    branch: item.branch,
                    amount: parseFloat(item.amount) || 0,
                    receiveBy: item.receiveBy,
                    place: item.place,
                    reference: newPayment.reference,
                    status: initialStatus,
                    isEdited: false,
                    discount: idx === 0 ? (parseFloat(newPayment.discount) || 0) : 0,
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    entryBy: currentUser?.username || currentUser?.employeeId || currentUser?.id || 'admin',
                    entryByName: currentUser?.name || currentUser?.username || 'Admin'
                }));

            const updatedCustomer = {
                ...customer,
                paymentHistory: [...paymentEntries, ...(customer.paymentHistory || [])]
            };

            await axios.put(`${API_BASE_URL}/api/customers/${newPayment.customerId}`, updatedCustomer);
            setSubmitStatus('success');

            // Notification
            try {
                const now = new Date();
                const dateStr = now.toLocaleDateString('en-GB');
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const employeeName = currentUser?.name || currentUser?.username || 'An employee';
                const partyName = rawCustomers.find(c => c._id === newPayment.customerId)?.companyName ||
                    rawCustomers.find(c => c._id === newPayment.customerId)?.customerName || 'Customer';
                const totalAmt = newPayment.items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
                if (addNotification) await addNotification(
                    'New Payment Requested',
                    `${dateStr} | ${timeStr} | ${employeeName} requested a new payment of ৳${totalAmt.toLocaleString('en-IN')} from ${partyName} (${nextReceiptNo})`,
                    ['admin', 'incharge', 'sales manager'],
                    ['admin']
                );
            } catch (notifErr) { console.error('Notification error:', notifErr); }

            fetchPayments();
            setTimeout(() => {
                setShowAddModal(false);
                setSubmitStatus(null);
                resetNewPayment();
            }, 1500);
        } catch (error) {
            console.error('Error saving collection:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateCollection = async (e) => {
        e.preventDefault();
        if (!canEdit) {
            alert('Forbidden: You do not have permission to edit payment collections');
            return;
        }
        if (!newPayment.customerId) {
            alert('Please select a Customer / Party first');
            return;
        }
        const activeItems = newPayment.items.filter(item => item.amount !== '' && item.amount !== null && !isNaN(parseFloat(item.amount)));

        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const custRes = await axios.get(`${API_BASE_URL}/api/customers/${newPayment.customerId}`);
            const customer = custRes.data;

            // Find existing payment history items for this receipt
            const existingEntries = (customer.paymentHistory || []).filter(p => p.receiptNo === editingPayment.receiptNo);
            const remainingHistory = (customer.paymentHistory || []).filter(p => p.receiptNo !== editingPayment.receiptNo);

            const isEditReq = (!isAdmin && !canApproveEditRequest) || editingPayment?.isEdited === true;
            // Map all items currently in the form to reconstructed payment history entries
            const updatedPaymentEntries = activeItems.map((item, idx) => {
                const existingItem = existingEntries.find(p => p.id === item.id) || existingEntries[0];

                let originalData = null;
                if (isEditReq) {
                    if (existingItem && existingItem.originalData) {
                        originalData = existingItem.originalData;
                    } else if (existingItem) {
                        originalData = {
                            date: existingItem.date,
                            method: existingItem.method,
                            bankName: existingItem.bankName || '',
                            accountNo: existingItem.accountNo || '',
                            branch: existingItem.branch || '',
                            amount: parseFloat(existingItem.amount) || 0,
                            receiveBy: existingItem.receiveBy || '',
                            place: existingItem.place || '',
                            reference: existingItem.reference || '',
                            discount: parseFloat(existingItem.discount) || 0
                        };
                    }
                }

                return {
                    receiptNo: editingPayment.receiptNo,
                    date: newPayment.date,
                    method: item.method,
                    bankName: item.bankName,
                    accountNo: item.accountNo,
                    branch: item.branch,
                    amount: parseFloat(item.amount),
                    receiveBy: item.receiveBy,
                    place: item.place,
                    reference: newPayment.reference,
                    status: editingPayment.status || 'Accepted',
                    isEdited: isEditReq ? true : false,
                    ...(originalData ? { originalData } : {}),
                    // The discount is stored only on the first item to prevent duplicate totals
                    discount: idx === 0 ? (parseFloat(newPayment.discount) || 0) : 0,
                    id: item.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    entryBy: existingItem?.entryBy || existingItem?.entryByName || currentUser?.username || currentUser?.employeeId || currentUser?.id || 'admin',
                    entryByName: existingItem?.entryByName || existingItem?.entryBy || currentUser?.name || currentUser?.username || 'Admin',
                    editedBy: currentUser?.username || currentUser?.employeeId || currentUser?.id || 'admin',
                    editedByName: currentUser?.name || currentUser?.username || 'Admin'
                };
            });

            // Prepend new payment entries to the remaining history list
            const updatedCustomer = {
                ...customer,
                paymentHistory: [...updatedPaymentEntries, ...remainingHistory]
            };

            await axios.put(`${API_BASE_URL}/api/customers/${newPayment.customerId}`, updatedCustomer);
            setSubmitStatus('success');

            // Notification
            try {
                const now = new Date();
                const dateStr = now.toLocaleDateString('en-GB');
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const editorName = currentUser?.name || currentUser?.username || 'An employee';
                const partyName = rawCustomers.find(c => c._id === newPayment.customerId)?.companyName ||
                    rawCustomers.find(c => c._id === newPayment.customerId)?.customerName || 'Customer';
                const totalAmt = activeItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
                const isEditReq = (!isAdmin && !canApproveEditRequest);
                const title = isEditReq ? 'Payment Edit Requested' : 'Payment Updated';
                const msg = isEditReq
                    ? `${dateStr} | ${timeStr} | ${editorName} requested an edit on payment (${editingPayment?.receiptNo}) of ৳${totalAmt.toLocaleString('en-IN')} from ${partyName}`
                    : `${dateStr} | ${timeStr} | ${editorName} updated payment (${editingPayment?.receiptNo}) of ৳${totalAmt.toLocaleString('en-IN')} from ${partyName}`;
                if (addNotification) await addNotification(title, msg, ['admin', 'incharge', 'sales manager'], ['admin']);
            } catch (notifErr) { console.error('Notification error:', notifErr); }

            fetchPayments();
            setTimeout(() => {
                setShowAddModal(false);
                setSubmitStatus(null);
                resetNewPayment();
            }, 1500);
        } catch (error) {
            console.error('Error updating collection:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetNewPayment = () => {
        setNewPayment({
            customerId: '',
            date: new Date().toISOString().split('T')[0],
            items: [{
                id: Date.now().toString(),
                method: 'Cash',
                bankName: '',
                accountNo: '',
                branch: '',
                receiveBy: '',
                place: '',
                amount: ''
            }],
            status: 'Completed',
            reference: '',
            discount: ''
        });
        setCustomerSearchQuery('');
        setIsEditMode(false);
        setEditingPayment(null);
    };

    const renderSortIcon = (key) => {
        if (sortConfig.key !== key) {
            return <ChevronDownIcon className="w-3 h-3 ml-1 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
        }
        return sortConfig.direction === 'desc' ?
            <ChevronDownIcon className="w-3 h-3 ml-1 text-blue-600" /> :
            <ChevronUpIcon className="w-3 h-3 ml-1 text-blue-600" />;
    };

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const sortedPayments = [...payments].sort((a, b) => {
        if (sortConfig.key === 'date') {
            return sortConfig.direction === 'desc'
                ? new Date(b.date) - new Date(a.date)
                : new Date(a.date) - new Date(b.date);
        }

        let valA, valB;
        if (sortConfig.key === 'customerName') {
            valA = (a.companyName || a.customerName || '').toLowerCase();
            valB = (b.companyName || b.customerName || '').toLowerCase();
        } else {
            valA = (a[sortConfig.key] || '');
            valB = (b[sortConfig.key] || '');
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
        }

        if (sortConfig.direction === 'desc') {
            return valB < valA ? -1 : (valB > valA ? 1 : 0);
        }
        return valA < valB ? -1 : (valA > valB ? 1 : 0);
    });

    const filteredPayments = sortedPayments.filter(p => {
        const matchSearch = !searchQuery ||
            (p.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.readableCustomerId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.method || '').toLowerCase().includes(searchQuery.toLowerCase());

        let isDateMatch = true;
        if (filters.startDate && (!p.date || p.date < filters.startDate)) {
            isDateMatch = false;
        }
        if (filters.endDate && (!p.date || p.date > filters.endDate)) {
            isDateMatch = false;
        }

        // Quick range filtering
        if (filters.quickRange && filters.quickRange !== 'all' && filters.quickRange !== 'custom') {
            try {
                const rowDate = new Date(p.date);
                const now = new Date();
                if (filters.quickRange === 'weekly') {
                    const dayOfWeek = now.getDay();
                    const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
                    const weekStart = new Date(now);
                    weekStart.setDate(now.getDate() + diffToMonday);
                    weekStart.setHours(0, 0, 0, 0);
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekStart.getDate() + 6);
                    weekEnd.setHours(23, 59, 59, 999);
                    if (rowDate < weekStart || rowDate > weekEnd) {
                        isDateMatch = false;
                    }
                } else if (filters.quickRange === 'monthly') {
                    const month = filters.selectedMonth || (now.getMonth() + 1);
                    const year = filters.selectedYear || now.getFullYear();
                    if (rowDate.getMonth() + 1 !== month || rowDate.getFullYear() !== year) {
                        isDateMatch = false;
                    }
                } else if (filters.quickRange === 'yearly') {
                    const year = filters.selectedYear || now.getFullYear();
                    if (rowDate.getFullYear() !== year) {
                        isDateMatch = false;
                    }
                }
            } catch (e) {
                console.error("Error parsing date:", e);
            }
        }

        const matchMethod = !filters.method || ((p.method || '').toLowerCase() === filters.method.toLowerCase());
        const matchBankName = !filters.bankName || ((p.bankName || '').toLowerCase() === filters.bankName.toLowerCase());
        const matchBranch = !filters.branch || ((p.branch || '').toLowerCase() === filters.branch.toLowerCase());
        const matchCustomer = !filters.customer ||
            ((p.customerName || '').toLowerCase().includes(filters.customer.toLowerCase()) ||
                (p.companyName || '').toLowerCase().includes(filters.customer.toLowerCase()));

        const isReq = (p.status || '').toLowerCase() === 'requested';
        const isEditReq = (p.isEdited === true || p.isEdited === 'true') && !isReq;

        if (isRequestedOnly) {
            if (!isReq) return false;
        } else if (isEditRequestedOnly) {
            if (!isEditReq) return false;
        } else {
            if (isReq || isEditReq) return false;
        }

        return matchSearch && isDateMatch && matchMethod && matchBankName && matchBranch && matchCustomer;
    });

    const displayedGroups = useMemo(() => {
        const groups = [];
        filteredPayments.forEach(payment => {
            const groupKey = `${payment.date}-${payment.receiptNo || payment.id}-${payment.customerId}`;
            let group = groups.find(g => g.key === groupKey);
            if (!group) {
                group = {
                    key: groupKey,
                    date: payment.date,
                    receiptNo: payment.receiptNo,
                    companyName: payment.companyName,
                    customerName: payment.customerName,
                    customerId: payment.customerId,
                    customerAddress: payment.customerAddress || '',
                    status: payment.status,
                    isEdited: payment.isEdited,
                    entryBy: payment.entryBy || payment.entryByName || '',
                    entryByName: payment.entryByName || payment.entryBy || '',
                    editedBy: payment.editedBy || payment.editedByName || '',
                    editedByName: payment.editedByName || payment.editedBy || '',
                    items: []
                };
                groups.push(group);
            }
            group.items.push(payment);
            if ((payment.status || '').toLowerCase() === 'requested') {
                group.status = 'Requested';
            }
            group.isEdited = group.isEdited || payment.isEdited === true || payment.isEdited === 'true';
            // Keep the most-recent editedBy
            if (payment.editedBy || payment.editedByName) {
                group.editedBy = payment.editedBy || payment.editedByName || group.editedBy;
                group.editedByName = payment.editedByName || payment.editedBy || group.editedByName;
            }
        });
        return groups;
    }, [filteredPayments]);

    const calculateCustomerBalance = (customer) => {
        if (!customer) return 0;
        const validSales = (customer.salesHistory || []).filter(s => (s.status || '').toLowerCase() !== 'requested');
        const validPayments = (customer.paymentHistory || []).filter(p => (p.status || '').toLowerCase() !== 'requested');

        const totalAmount = validSales.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const totalSalesPaid = validSales.reduce((sum, item) => sum + (parseFloat(item.paid) || 0), 0);
        const totalDiscount = validSales.reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0);
        const totalHistoryPaid = validPayments.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const totalHistoryDiscount = validPayments.reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0);
        return Math.max(0, totalAmount - totalSalesPaid - totalDiscount - totalHistoryPaid - totalHistoryDiscount);
    };

    const selectedCustomerForBalance = rawCustomers.find(c => c._id === newPayment.customerId);
    const currentBalance = calculateCustomerBalance(selectedCustomerForBalance);
    const totalCollection = newPayment.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalAmountCollected = payments
        .filter(p => p.customerId === newPayment.customerId && (p.status || '').toLowerCase() !== 'requested')
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    return (
        <div className="space-y-6">
            {!showAddModal && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="w-full md:w-auto">
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Payment Collection</h2>
                    </div>

                    {/* Center Aligned Search Bar & Requested / Edit Request Toggles */}
                    <div className="flex-1 w-full max-w-none md:max-w-xl mx-auto flex flex-col items-center gap-2">
                        <div className="w-full relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by customer, company, ID or method..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="block w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            {canViewPaymentRequest && (
                                <button
                                    onClick={() => {
                                        setIsRequestedOnly(!isRequestedOnly);
                                        setIsEditRequestedOnly(false);
                                    }}
                                    className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${isRequestedOnly ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}
                                >
                                    Requested
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

                    <div className="w-full md:w-auto flex flex-row items-center justify-between md:justify-end gap-2">
                        {/* Advanced Filter Button & Panel Container */}
                        <div className="relative flex-1 md:flex-none">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all border ${showFilterPanel || Object.values(filters).some(v => v !== '') ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'} h-[42px]`}
                            >
                                <FunnelIcon className={`w-4 h-4 ${(showFilterPanel || Object.values(filters).some(v => v !== '')) ? 'text-white' : 'text-gray-400'}`} />
                                <span className={`text-sm font-medium ${(showFilterPanel || Object.values(filters).some(v => v !== '')) ? 'text-white' : 'text-gray-600'}`}>Filter</span>
                            </button>

                            {/* Advanced Filter Panel */}
                            {showFilterPanel && (
                                <div ref={filterPanelRef} className="fixed inset-x-4 top-[140px] md:absolute md:inset-auto md:right-0 md:mt-3 md:top-auto w-auto md:w-[400px] bg-white border border-gray-200 rounded-2xl shadow-xl z-[60] p-5 opacity-100 scale-100 transform transform-gpu transition-all duration-200 ease-out origin-top-right text-left">
                                    <div className="flex items-center justify-between mb-5 border-b border-gray-100 pb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                                <FunnelIcon className="w-4 h-4" />
                                            </div>
                                            <h3 className="font-bold text-gray-800 text-[15px]">Advanced Filter</h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={resetFilters}
                                                className="text-[12px] font-bold text-gray-500 hover:text-blue-600 transition-colors px-2 py-1 bg-gray-50 hover:bg-blue-50 rounded-md"
                                            >
                                                Reset All
                                            </button>
                                            <button onClick={() => setShowFilterPanel(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                                                <XIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {/* Quick Range */}
                                        <div className="md:col-span-2 space-y-2 text-center">
                                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Quick Range</label>
                                            <div className="flex flex-wrap justify-center gap-2">
                                                {['all', 'weekly', 'monthly', 'yearly'].map(range => (
                                                    <button
                                                        key={range}
                                                        type="button"
                                                        onClick={() => setFilters(prev => ({ ...prev, quickRange: range, startDate: '', endDate: '' }))}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filters.quickRange === range ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                                    >
                                                        {range.charAt(0).toUpperCase() + range.slice(1)}
                                                    </button>
                                                ))}
                                            </div>
                                            {/* Month dropdown for monthly */}
                                            {filters.quickRange === 'monthly' && (
                                                <div className="flex items-center justify-center gap-2 mt-1">
                                                    <select
                                                        value={filters.selectedMonth || new Date().getMonth() + 1}
                                                        onChange={(e) => setFilters(prev => ({ ...prev, selectedMonth: parseInt(e.target.value) }))}
                                                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                                    >
                                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                            <option key={m} value={m}>
                                                                {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <select
                                                        value={filters.selectedYear || new Date().getFullYear()}
                                                        onChange={(e) => setFilters(prev => ({ ...prev, selectedYear: parseInt(e.target.value) }))}
                                                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                                    >
                                                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                                            <option key={y} value={y}>{y}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                            {/* Year selector for yearly */}
                                            {filters.quickRange === 'yearly' && (
                                                <div className="flex items-center justify-center gap-2 mt-1">
                                                    <select
                                                        value={filters.selectedYear || new Date().getFullYear()}
                                                        onChange={(e) => setFilters(prev => ({ ...prev, selectedYear: parseInt(e.target.value) }))}
                                                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                                    >
                                                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                                            <option key={y} value={y}>{y}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>

                                        {/* Date Range */}
                                        <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-0.5">Start Date</label>
                                                <div className="relative">
                                                    <CustomDatePicker value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} compact />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-0.5">End Date</label>
                                                <div className="relative">
                                                    <CustomDatePicker value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} compact rightAlign={true} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Method Filter */}
                                        <div className="space-y-1.5 relative" data-filter-dropdown>
                                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-0.5">Method</label>
                                            <button
                                                onClick={() => setFilterDropdownOpen(filterDropdownOpen === 'method' ? null : 'method')}
                                                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-gray-50"
                                            >
                                                <span className={`truncate ${filters.method ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                    {filters.method || 'All Methods'}
                                                </span>
                                                <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${filterDropdownOpen === 'method' ? 'rotate-180' : ''}`} />
                                            </button>

                                            {filterDropdownOpen === 'method' && (
                                                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-60 overflow-y-auto w-full">
                                                    <button
                                                        onClick={() => handleFilterChange('method', '')}
                                                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${!filters.method ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                    >
                                                        All Methods
                                                        {!filters.method && <CheckIcon className="w-4 h-4" />}
                                                    </button>
                                                    {uniqueMethods.map(method => (
                                                        <button
                                                            key={method}
                                                            onClick={() => handleFilterChange('method', method)}
                                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${filters.method === method ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                        >
                                                            {method}
                                                            {filters.method === method && <CheckIcon className="w-4 h-4" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Customer Filter */}
                                        <div className="space-y-1.5 relative" data-filter-dropdown>
                                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-0.5">Customer / Party</label>
                                            <button
                                                onClick={() => setFilterDropdownOpen(filterDropdownOpen === 'customer' ? null : 'customer')}
                                                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-gray-50"
                                            >
                                                <span className={`truncate ${filters.customer ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                    {filters.customer || 'All Customers'}
                                                </span>
                                                <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${filterDropdownOpen === 'customer' ? 'rotate-180' : ''}`} />
                                            </button>

                                            {filterDropdownOpen === 'customer' && (
                                                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-60 flex flex-col w-full">
                                                    <div className="p-2 border-b border-gray-100 sticky top-0 bg-white z-10">
                                                        <div className="relative">
                                                            <SearchIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                                            <input
                                                                type="text"
                                                                placeholder="Search customers..."
                                                                value={filterSearchInputs.customer}
                                                                onChange={(e) => setFilterSearchInputs(p => ({ ...p, customer: e.target.value }))}
                                                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="overflow-y-auto flex-1">
                                                        <button
                                                            onClick={() => handleFilterChange('customer', '')}
                                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${!filters.customer ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                        >
                                                            All Customers
                                                            {!filters.customer && <CheckIcon className="w-4 h-4" />}
                                                        </button>
                                                        {uniqueCustomers.filter(customer => customer.toLowerCase().includes(filterSearchInputs.customer.toLowerCase())).map(customer => (
                                                            <button
                                                                key={customer}
                                                                onClick={() => handleFilterChange('customer', customer)}
                                                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${filters.customer === customer ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                            >
                                                                <span className="truncate">{customer}</span>
                                                                {filters.customer === customer && <CheckIcon className="w-4 h-4 flex-shrink-0" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Bank Name Filter */}
                                        <div className="space-y-1.5 relative" data-filter-dropdown>
                                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-0.5">Bank / Provider</label>
                                            <button
                                                onClick={() => setFilterDropdownOpen(filterDropdownOpen === 'bankName' ? null : 'bankName')}
                                                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-gray-50"
                                            >
                                                <span className={`truncate ${filters.bankName ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                    {filters.bankName || 'All Banks'}
                                                </span>
                                                <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${filterDropdownOpen === 'bankName' ? 'rotate-180' : ''}`} />
                                            </button>

                                            {filterDropdownOpen === 'bankName' && (
                                                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-60 flex flex-col w-full">
                                                    <div className="p-2 border-b border-gray-100 sticky top-0 bg-white z-10">
                                                        <div className="relative">
                                                            <SearchIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                                            <input
                                                                type="text"
                                                                placeholder="Search banks..."
                                                                value={filterSearchInputs.bankName}
                                                                onChange={(e) => setFilterSearchInputs(p => ({ ...p, bankName: e.target.value }))}
                                                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="overflow-y-auto flex-1">
                                                        <button
                                                            onClick={() => handleFilterChange('bankName', '')}
                                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${!filters.bankName ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                        >
                                                            All Banks
                                                            {!filters.bankName && <CheckIcon className="w-4 h-4" />}
                                                        </button>
                                                        {uniqueBanks.filter(bank => bank.toLowerCase().includes(filterSearchInputs.bankName.toLowerCase())).map(bank => (
                                                            <button
                                                                key={bank}
                                                                onClick={() => handleFilterChange('bankName', bank)}
                                                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${filters.bankName === bank ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                            >
                                                                <span className="truncate">{bank}</span>
                                                                {filters.bankName === bank && <CheckIcon className="w-4 h-4 flex-shrink-0" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Branch Filter */}
                                        <div className="space-y-1.5 relative" data-filter-dropdown>
                                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-0.5">Branch</label>
                                            <button
                                                onClick={() => setFilterDropdownOpen(filterDropdownOpen === 'branch' ? null : 'branch')}
                                                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-gray-50"
                                            >
                                                <span className={`truncate ${filters.branch ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                    {filters.branch || 'All Branches'}
                                                </span>
                                                <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${filterDropdownOpen === 'branch' ? 'rotate-180' : ''}`} />
                                            </button>

                                            {filterDropdownOpen === 'branch' && (
                                                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-60 flex flex-col w-full">
                                                    <div className="p-2 border-b border-gray-100 sticky top-0 bg-white z-10">
                                                        <div className="relative">
                                                            <SearchIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                                            <input
                                                                type="text"
                                                                placeholder="Search branches..."
                                                                value={filterSearchInputs.branch}
                                                                onChange={(e) => setFilterSearchInputs(p => ({ ...p, branch: e.target.value }))}
                                                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="overflow-y-auto flex-1">
                                                        <button
                                                            onClick={() => handleFilterChange('branch', '')}
                                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${!filters.branch ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                        >
                                                            All Branches
                                                            {!filters.branch && <CheckIcon className="w-4 h-4" />}
                                                        </button>
                                                        {uniqueBranches.filter(branch => branch.toLowerCase().includes(filterSearchInputs.branch.toLowerCase())).map(branch => (
                                                            <button
                                                                key={branch}
                                                                onClick={() => handleFilterChange('branch', branch)}
                                                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${filters.branch === branch ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                            >
                                                                <span className="truncate">{branch}</span>
                                                                {filters.branch === branch && <CheckIcon className="w-4 h-4 flex-shrink-0" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                    </div>

                                    <div className="mt-6 pt-4 border-t border-gray-50 flex justify-end">
                                        <button
                                            onClick={() => setShowFilterPanel(false)}
                                            className="px-6 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
                                        >
                                            Apply Filters
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Report Button */}
                        <button
                            onClick={() => setShowReport(true)}
                            className="flex-1 md:flex-none w-full md:w-auto flex justify-center items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 h-[42px]"
                        >
                            <BarChartIcon className="w-4 h-4 text-gray-400 hidden sm:block" />
                            <span className="text-sm font-medium">Report</span>
                        </button>

                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex-1 md:flex-none w-full md:w-auto justify-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all transform active:scale-95 flex items-center gap-2 text-sm h-[42px]"
                        >
                            <PlusIcon className="w-4 h-4" /> <span>Add Collection</span>
                        </button>
                    </div>
                </div>
            )}

            {!showAddModal && (
                <div className="space-y-4">
                    {/* Bulk Action Bar */}
                    {selectedItems.size > 0 && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-200">
                            <div className="flex items-center gap-3">
                                <span className="inline-flex items-center justify-center bg-blue-600 text-white font-extrabold text-xs px-3 py-1 rounded-full shadow-sm">
                                    {selectedItems.size} Selected
                                </span>
                                <span className="text-xs font-semibold text-gray-700">
                                    Payment Collection entries selected
                                </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {canApprove && (
                                    <button
                                        onClick={handleBulkAccept}
                                        disabled={isSubmitting}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
                                        title="Accept all selected payment requests"
                                    >
                                        <CheckIcon className="w-4 h-4" />
                                        <span>Bulk Accept ({selectedItems.size})</span>
                                    </button>
                                )}
                                {canApprove && (
                                    <button
                                        onClick={handleBulkReject}
                                        disabled={isSubmitting}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-red-600/20 transition-all disabled:opacity-50 cursor-pointer"
                                        title="Reject all selected payment requests"
                                    >
                                        <XIcon className="w-4 h-4" />
                                        <span>Bulk Reject ({selectedItems.size})</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedItems(new Set())}
                                    className="px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
                                >
                                    Deselect All
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl shadow-sm overflow-hidden">
                        {/* Table Header Row */}
                        <div className="overflow-x-auto">
                            <table className="sale-mgmt-table hidden md:table">
                                <thead>
                                    <tr>
                                        {selectedItems.size > 0 && (
                                            <th className="sale-mgmt-th w-10 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={displayedGroups.length > 0 && displayedGroups.every(g => selectedItems.has(g.key))}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedItems(new Set(displayedGroups.map(g => g.key)));
                                                        } else {
                                                            setSelectedItems(new Set());
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </th>
                                        )}
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('date')}>
                                            <div className="flex items-center">Date {renderSortIcon('date')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('receiptNo')}>
                                            <div className="flex items-center">Receipt No {renderSortIcon('receiptNo')}</div>
                                        </th>
                                        <th className="sale-mgmt-th cursor-pointer group" onClick={() => handleSort('customerName')}>
                                            <div className="flex items-center">Party {renderSortIcon('customerName')}</div>
                                        </th>
                                        <th className="sale-mgmt-th">Location</th>
                                        <th className="sale-mgmt-th">Payment Method</th>
                                        <th className="sale-mgmt-th">Bank Name</th>
                                        <th className="sale-mgmt-th">Branch</th>
                                        <th className="sale-mgmt-th">Account Number</th>
                                        <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('amount')}>
                                            <div className="flex items-center justify-center">Amount {renderSortIcon('amount')}</div>
                                        </th>
                                        <th className="sale-mgmt-th text-center cursor-pointer group" onClick={() => handleSort('status')}>
                                            <div className="flex items-center justify-center">Status {renderSortIcon('status')}</div>
                                        </th>
                                        {canShowEntryBy && (
                                            <th className="sale-mgmt-th text-center">Entry By</th>
                                        )}
                                        <th className="sale-mgmt-th text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {isLoading ? (
                                        Array(5).fill(0).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={(selectedItems.size > 0 ? 1 : 0) + 11 + (canShowEntryBy ? 1 : 0)} className="px-6 py-12 text-center">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                                                            <DollarSignIcon className="w-6 h-6 text-blue-500" />
                                                        </div>
                                                        <p className="text-gray-500 font-medium">Loading transaction history...</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : displayedGroups.length > 0 ? (
                                        displayedGroups.map((group) => {
                                            const isMultiple = group.items.length > 1;
                                            const isExpanded = !collapsedRows.has(group.key);
                                            const totalAmount = group.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

                                            return (
                                                <tr
                                                    key={group.key}
                                                    onMouseDown={() => handleLongPressStart(group.key)}
                                                    onMouseUp={handleLongPressEnd}
                                                    onMouseLeave={handleLongPressEnd}
                                                    onTouchStart={() => handleLongPressStart(group.key)}
                                                    onTouchEnd={handleLongPressEnd}
                                                    onTouchMove={handleLongPressEnd}
                                                    onClick={(e) => {
                                                        if (isLongPressRef.current) {
                                                            e.stopPropagation();
                                                            return;
                                                        }
                                                        if (selectedItems.size > 0) {
                                                            e.stopPropagation();
                                                            const newSelected = new Set(selectedItems);
                                                            if (newSelected.has(group.key)) {
                                                                newSelected.delete(group.key);
                                                            } else {
                                                                newSelected.add(group.key);
                                                            }
                                                            setSelectedItems(newSelected);
                                                            return;
                                                        }
                                                        if (isMultiple) toggleRowExpansion(group.key);
                                                    }}
                                                    className={`hover:bg-blue-50/50 transition-all group border-b border-gray-50 last:border-0 align-middle select-none ${isMultiple ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-blue-50/30' : ''} ${selectedItems.has(group.key) ? 'bg-blue-50/70 font-medium' : ''} ${highlightId && ((group.receiptNo && String(group.receiptNo).toLowerCase().trim() === String(highlightId).toLowerCase().trim()) || (group.ids && group.ids.some(id => String(id) === String(highlightId)))) ? "notif-row-highlight" : ""}`}
                                                    ref={el => { if (group.receiptNo) rowRefs.current[group.receiptNo] = el; }}
                                                    style={highlightId && ((group.receiptNo && String(group.receiptNo).toLowerCase().trim() === String(highlightId).toLowerCase().trim()) || (group.ids && group.ids.some(id => String(id) === String(highlightId)))) ? { borderLeft: '5px solid #f59e0b' } : undefined}
                                                >
                                                    {selectedItems.size > 0 && (
                                                        <td className="px-3 py-4 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedItems.has(group.key)}
                                                                onChange={(e) => {
                                                                    const newSelected = new Set(selectedItems);
                                                                    if (e.target.checked) {
                                                                        newSelected.add(group.key);
                                                                    } else {
                                                                        newSelected.delete(group.key);
                                                                    }
                                                                    setSelectedItems(newSelected);
                                                                }}
                                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                            />
                                                        </td>
                                                    )}
                                                    <td className={`px-3 ${!isExpanded ? 'py-4' : 'py-3'} whitespace-nowrap`}>
                                                        <div className="text-sm font-medium text-gray-600 leading-tight">{formatDate(group.date)}</div>
                                                    </td>
                                                    <td className={`px-3 ${!isExpanded ? 'py-4' : 'py-3'} whitespace-nowrap`}>
                                                        <div className="text-sm font-semibold text-blue-600 leading-tight">{group.receiptNo || '—'}</div>
                                                    </td>
                                                    <td className={`px-3 ${!isExpanded ? 'py-4' : 'py-3'} whitespace-nowrap`}>
                                                        <div className="text-sm font-semibold text-gray-800 leading-tight truncate max-w-[200px]">{group.companyName || group.customerName}</div>
                                                    </td>
                                                    <td className={`px-3 ${!isExpanded ? 'py-4' : 'py-3'} whitespace-nowrap`}>
                                                        <div className="text-sm text-gray-500 leading-tight truncate max-w-[150px]">{group.customerAddress || '—'}</div>
                                                    </td>
                                                    <td className={`px-3 ${!isExpanded ? 'py-4' : 'py-3'} whitespace-nowrap`}>
                                                        {isMultiple && !isExpanded ? (
                                                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100/50 rounded text-[9px] font-bold uppercase tracking-wider">Multiple</span>
                                                        ) : (
                                                            <div className="flex flex-col gap-1">
                                                                {group.items.map((item, idx) => (
                                                                    <div key={idx} className={`text-sm text-gray-800 font-bold leading-tight ${idx < group.items.length - 1 ? 'border-b border-gray-100 pb-1' : ''}`}>
                                                                        {item.method || '—'}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className={`px-3 ${!isExpanded ? 'py-4' : 'py-3'} whitespace-nowrap`}>
                                                        {isMultiple && !isExpanded ? (
                                                            <span className="px-1.5 py-0.5 bg-gray-50 text-gray-500 border border-gray-100 rounded text-[9px] font-bold uppercase tracking-wider">Multiple</span>
                                                        ) : (
                                                            <div className="flex flex-col gap-1">
                                                                {group.items.map((item, idx) => (
                                                                    <div key={idx} className={`text-sm font-semibold text-gray-700 leading-tight ${idx < group.items.length - 1 ? 'border-b border-gray-100 pb-1' : ''}`}>
                                                                        {item.method === 'Cash' ? (item.receiveBy || '—') : (item.bankName || '—')}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className={`px-3 ${!isExpanded ? 'py-4' : 'py-3'} whitespace-nowrap`}>
                                                        {isMultiple && !isExpanded ? (
                                                            <span className="text-[13px] font-semibold text-gray-400">—</span>
                                                        ) : (
                                                            <div className="flex flex-col gap-1">
                                                                {group.items.map((item, idx) => (
                                                                    <div key={idx} className={`text-sm font-semibold text-gray-800 leading-tight ${idx < group.items.length - 1 ? 'border-b border-gray-100 pb-1' : ''}`}>
                                                                        {item.method === 'Cash' ? (item.place || '—') : (item.branch || '—')}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className={`px-3 ${!isExpanded ? 'py-4' : 'py-3'} whitespace-nowrap`}>
                                                        {isMultiple && !isExpanded ? (
                                                            <span className="text-[13px] font-semibold text-gray-400">—</span>
                                                        ) : (
                                                            <div className="flex flex-col gap-1">
                                                                {group.items.map((item, idx) => (
                                                                    <div key={idx} className={`text-sm font-semibold text-gray-800 font-mono leading-tight ${idx < group.items.length - 1 ? 'border-b border-gray-100 pb-1' : ''}`}>
                                                                        {item.accountNo || '—'}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className={`px-3 ${!isExpanded ? 'py-4' : 'py-3'} whitespace-nowrap text-center`}>
                                                        {isMultiple && !isExpanded ? (
                                                            <div className="inline-block px-3 py-0.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100/50 text-sm font-black">
                                                                ৳{Number(totalAmount).toLocaleString('en-IN')}
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col gap-1">
                                                                {group.items.map((item, idx) => (
                                                                    <div key={idx} className={`text-sm font-black text-gray-900 leading-tight ${idx < group.items.length - 1 ? 'border-b border-gray-100 pb-1' : ''}`}>
                                                                        ৳{Number(item.amount || 0).toLocaleString('en-IN')}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className={`px-3 ${!isExpanded ? 'py-4' : 'py-3'} text-center whitespace-nowrap`}>
                                                        {group.isEdited === true ? (
                                                            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-200/60 inline-flex items-center gap-1 shadow-sm">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                                Edit Requested
                                                            </span>
                                                        ) : (
                                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${group.status === 'Requested' ? 'bg-amber-50 text-amber-700 border border-amber-200/60' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'}`}>
                                                                {group.status === 'Requested' ? 'Requested' : (group.status || 'Accepted')}
                                                            </span>
                                                        )}
                                                    </td>
                                                    {canShowEntryBy && (
                                                        <td className={`px-3 ${!isExpanded ? 'py-4' : 'py-3'} text-center whitespace-nowrap`}>
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <span className="text-xs font-semibold text-gray-700">
                                                                    {getEntryByName(group.entryBy, group.entryByName)}
                                                                </span>
                                                                {(group.editedBy || group.editedByName) && (
                                                                    <span className="text-[10px] text-amber-600 font-medium">
                                                                        ✎ {getEditedByName(group.editedBy, group.editedByName)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                    <td className={`px-3 ${!isExpanded ? 'py-4' : 'py-3'} text-center`} onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => handleGenerateReceipt(group.items[0], totalAmount, group.items)}
                                                                className="p-1 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 rounded transition-colors"
                                                                title="Money Receipt"
                                                            >
                                                                <FileTextIcon className="w-5 h-5" />
                                                            </button>
                                                            {canEdit && (
                                                                <button
                                                                    onClick={() => handleEditInitiation(group.items[0])}
                                                                    className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors"
                                                                    title="Edit Receipt"
                                                                >
                                                                    <EditIcon className="w-5 h-5" />
                                                                </button>
                                                            )}
                                                            {(group.status === 'Requested' ? canApprove : (group.isEdited === true && (canApproveEditRequest || canApprove))) && (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleStatusUpdate(group, 'Accepted')}
                                                                        className="p-1 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 rounded transition-colors"
                                                                        title="Accept Collection"
                                                                    >
                                                                        <CheckIcon className="w-5 h-5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleStatusUpdate(group, 'Rejected')}
                                                                        className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"
                                                                        title="Reject Collection"
                                                                    >
                                                                        <XIcon className="w-5 h-5" />
                                                                    </button>
                                                                </>
                                                            )}
                                                            {group.status !== 'Requested' && !group.isEdited && canDelete && (
                                                                <button
                                                                    onClick={() => handleDeletePayment(group.items[0])}
                                                                    className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"
                                                                    title="Delete Receipt"
                                                                >
                                                                    <TrashIcon className="w-5 h-5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={(selectedItems.size > 0 ? 1 : 0) + 11 + (canShowEntryBy ? 1 : 0)} className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                                                        <SearchIcon className="w-6 h-6 text-gray-400" />
                                                    </div>
                                                    <p className="text-gray-500 font-medium">No payments found</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                            </tbody>
                        </table>

                        {/* Mobile Card View */}
                        <div className="block md:hidden px-1 py-4 space-y-3">
                            {isLoading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <div key={i} className="animate-pulse bg-white border border-gray-100 rounded-xl p-4 space-y-3">
                                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                                        <div className="h-6 bg-gray-200 rounded w-full"></div>
                                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                                    </div>
                                ))
                            ) : displayedGroups.length > 0 ? (
                                displayedGroups.map((group) => {
                                    const isExpanded = expandedMobileCards === group.key;
                                    const totalAmount = group.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

                                    return (
                                        <div
                                            key={group.key}
                                            className={`mobile-card transition-all duration-300 select-none ${isExpanded ? 'expanded' : 'collapsed'} ${selectedItems.has(group.key) ? 'ring-2 ring-blue-500 bg-blue-50/30' : ''}`}
                                            onMouseDown={() => handleLongPressStart(group.key)}
                                            onMouseUp={handleLongPressEnd}
                                            onMouseLeave={handleLongPressEnd}
                                            onTouchStart={() => handleLongPressStart(group.key)}
                                            onTouchEnd={handleLongPressEnd}
                                            onTouchMove={handleLongPressEnd}
                                            onClick={(e) => {
                                                if (isLongPressRef.current) {
                                                    e.stopPropagation();
                                                    return;
                                                }
                                                if (selectedItems.size > 0) {
                                                    e.stopPropagation();
                                                    const newSelected = new Set(selectedItems);
                                                    if (newSelected.has(group.key)) {
                                                        newSelected.delete(group.key);
                                                    } else {
                                                        newSelected.add(group.key);
                                                    }
                                                    setSelectedItems(newSelected);
                                                    return;
                                                }
                                                setExpandedMobileCards(isExpanded ? null : group.key);
                                            }}
                                        >
                                            <div className="mobile-card-header">
                                                {selectedItems.size > 0 && (
                                                    <div onClick={(e) => e.stopPropagation()} className="pr-2 flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedItems.has(group.key)}
                                                            onChange={(e) => {
                                                                const newSelected = new Set(selectedItems);
                                                                if (e.target.checked) {
                                                                    newSelected.add(group.key);
                                                                } else {
                                                                    newSelected.delete(group.key);
                                                                }
                                                                setSelectedItems(newSelected);
                                                            }}
                                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <div className="mobile-card-title truncate">{group.companyName || group.customerName}</div>
                                                    <div className="text-[10px] text-gray-500 truncate mt-0.5">
                                                        {formatDate(group.date)} | {group.receiptNo || '—'}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    <span className="font-bold text-blue-600">
                                                        ৳{Number(totalAmount).toLocaleString('en-IN')}
                                                    </span>
                                                    {group.items.length > 1 && (
                                                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold">
                                                            {group.items.length} Items
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="animate-in slide-in-from-top-2 duration-300">
                                                    <div className="space-y-4 mt-4">
                                                        {group.items.map((item, idx) => (
                                                            <div key={idx} className={`space-y-2 ${idx < group.items.length - 1 ? 'border-b border-gray-100 pb-4' : ''}`}>
                                                                <div className="mobile-card-row">
                                                                    <span className="mobile-card-label">Location:</span>
                                                                    <span className="mobile-card-value line-clamp-1">{group.customerAddress || '—'}</span>
                                                                </div>
                                                                <div className="mobile-card-row">
                                                                    <span className="mobile-card-label">Method:</span>
                                                                    <span className="mobile-card-value font-bold text-gray-900">{item.method || '—'}</span>
                                                                </div>
                                                                <div className="mobile-card-row">
                                                                    <span className="mobile-card-label">{item.method === 'Cash' ? 'Receive By' : 'Bank Name'}:</span>
                                                                    <span className="mobile-card-value line-clamp-1">{item.method === 'Cash' ? (item.receiveBy || '—') : (item.bankName || '—')}</span>
                                                                </div>
                                                                <div className="mobile-card-row">
                                                                    <span className="mobile-card-label">{item.method === 'Cash' ? 'Place' : 'Branch'}:</span>
                                                                    <span className="mobile-card-value line-clamp-1">{item.method === 'Cash' ? (item.place || '—') : (item.branch || '—')}</span>
                                                                </div>
                                                                <div className="mobile-card-row">
                                                                    <span className="mobile-card-label">Account No:</span>
                                                                    <span className="mobile-card-value font-mono">{item.accountNo || '—'}</span>
                                                                </div>
                                                                <div className="mobile-card-row">
                                                                    <span className="mobile-card-label text-blue-600">Amount:</span>
                                                                    <span className="mobile-card-value font-black text-blue-600">৳{Number(item.amount || 0).toLocaleString('en-IN')}</span>
                                                                </div>

                                                                {canShowEntryBy && idx === group.items.length - 1 && (
                                                                    <div className="mobile-card-row">
                                                                        <span className="mobile-card-label">Entry By:</span>
                                                                        <div className="flex flex-col items-end">
                                                                            <span className="mobile-card-value font-semibold text-gray-700">
                                                                                {getEntryByName(group.entryBy, group.entryByName)}
                                                                            </span>
                                                                            {(group.editedBy || group.editedByName) && (
                                                                                <span className="text-[10px] text-amber-600 font-medium">
                                                                                    ✎ {getEditedByName(group.editedBy, group.editedByName)}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {canManage && (
                                                                    <div className="mobile-card-actions pt-2">
                                                                        {canEdit && (
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleEditInitiation(item); }}
                                                                                className="flex items-center justify-center gap-1.5 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold flex-1 hover:bg-blue-100 transition-colors"
                                                                            >
                                                                                <EditIcon className="w-4 h-4" /> Edit
                                                                            </button>
                                                                        )}
                                                                        {canDelete && (
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleDeletePayment(item); }}
                                                                                className="flex items-center justify-center gap-1.5 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold px-4 hover:bg-red-100 transition-colors"
                                                                            >
                                                                                <TrashIcon className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}

                                                        {/* Card-level actions */}
                                                        <div className="mobile-card-actions pt-3 border-t border-gray-100 flex gap-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleGenerateReceipt(group.items[0], totalAmount, group.items);
                                                                }}
                                                                className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold flex-1 transition-colors"
                                                            >
                                                                <FileTextIcon className="w-4 h-4" /> Money Receipt
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }) ) : (
                                    <div className="text-center py-8">
                                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-50 mb-3">
                                            <SearchIcon className="w-6 h-6 text-gray-400" />
                                        </div>
                                        <p className="text-gray-500 font-medium">No payments found</p>
                                    </div>
                                )}
                        </div>
                    </div>
                </div>
            </div>
        )}
            {/* Add Collection Card (Style Match with Add Customer) */}
            {showAddModal && (
                <div className="payment-form-container">

                    <div className="payment-form-header">
                        <div>
                            <h3 className="payment-form-title">{isEditMode ? 'Update Collection Entry' : 'New Collection Entry'}</h3>
                            <p className="text-xs text-gray-500 font-medium italic">Record a payment from a customer or party</p>
                        </div>
                        <button
                            onClick={() => {
                                setShowAddModal(false);
                                resetNewPayment();
                            }}
                            className="payment-form-close"
                        >
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <form
                        onSubmit={isEditMode ? handleUpdateCollection : handleAddCollection}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                                e.preventDefault();
                            }
                        }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10"
                    >
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                            {/* Row 1: Date, Customer, Total Balance, Total Collection */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">Collection Date</label>
                                <CustomDatePicker
                                    value={newPayment.date}
                                    onChange={(e) => setNewPayment(prev => ({ ...prev, date: e.target.value }))}
                                    compact={false}
                                />
                            </div>

                            <div ref={customerDropdownRef} className="space-y-2 relative">
                                <label className="text-sm font-medium text-gray-700 ml-1">Select Customer / Party</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder={newPayment.customerId ? rawCustomers.find(c => c._id === newPayment.customerId)?.companyName || 'Search customer...' : "Search by Company, Name or ID..."}
                                        value={customerSearchQuery}
                                        onChange={(e) => {
                                            if (!isEditMode) {
                                                setCustomerSearchQuery(e.target.value);
                                                setActiveDropdown('customer');
                                            }
                                        }}
                                        onFocus={() => !isEditMode && setActiveDropdown('customer')}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const filtered = rawCustomers.filter(c =>
                                                    (c.companyName || '').toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                                                    (c.customerId || '').toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                                                    (c.customerName || '').toLowerCase().includes(customerSearchQuery.toLowerCase())
                                                );
                                                if (filtered.length > 0) {
                                                    setNewPayment(prev => ({ ...prev, customerId: filtered[0]._id }));
                                                    setCustomerSearchQuery('');
                                                    setActiveDropdown(null);
                                                }
                                            }
                                        }}
                                        className={`payment-form-input pl-10 ${isEditMode ? 'bg-gray-50 cursor-not-allowed opacity-75' : ''}`}
                                        autoComplete="off"
                                        readOnly={isEditMode}
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center">
                                        {newPayment.customerId && !isEditMode ? (
                                            <span
                                                role="button"
                                                onClick={(e) => { e.stopPropagation(); setNewPayment(prev => ({ ...prev, customerId: '' })); setCustomerSearchQuery(''); setActiveDropdown(null); }}
                                                className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer text-lg leading-none"
                                            >×</span>
                                        ) : (
                                            !isEditMode && <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${activeDropdown === 'customer' ? 'rotate-180' : ''}`} />
                                        )}
                                    </div>
                                </div>

                                {activeDropdown === 'customer' && !isEditMode && (
                                    <div className="absolute z-[130] left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto py-2 animate-in slide-in-from-top-2 duration-200">
                                        {rawCustomers
                                            .filter(c =>
                                                (c.companyName || '').toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                                                (c.customerId || '').toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                                                (c.customerName || '').toLowerCase().includes(customerSearchQuery.toLowerCase())
                                            )
                                            .length > 0 ? (
                                            rawCustomers
                                                .filter(c =>
                                                    (c.companyName || '').toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                                                    (c.customerId || '').toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                                                    (c.customerName || '').toLowerCase().includes(customerSearchQuery.toLowerCase())
                                                )
                                                .map(customer => (
                                                    <button
                                                        key={customer._id}
                                                        type="button"
                                                        onClick={() => {
                                                            setNewPayment(prev => ({ ...prev, customerId: customer._id }));
                                                            setCustomerSearchQuery('');
                                                            setActiveDropdown(null);
                                                        }}
                                                        className="w-full px-5 py-3 text-left hover:bg-blue-50 transition-colors flex items-center justify-between group"
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-gray-900 group-hover:text-blue-700">{customer.companyName || customer.customerName}</span>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{customer.customerId}</span>
                                                        </div>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${customer.customerType === 'Party Customer' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                                                            {customer.customerType}
                                                        </span>
                                                    </button>
                                                ))
                                        ) : (
                                            <div className="px-5 py-8 text-center">
                                                <SearchIcon className="w-8 h-8 text-gray-100 mx-auto mb-2" />
                                                <p className="text-sm text-gray-400 font-medium">No customers found</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">Total Balance</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="text-orange-600 font-bold">৳</span>
                                    </div>
                                    <input
                                        type="text"
                                        readOnly
                                        value={currentBalance.toLocaleString('en-IN')}
                                        className="payment-form-input pl-9 font-bold bg-orange-50/30 text-orange-700 border-orange-100 cursor-default"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                                        <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Outstanding</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">Total Collection</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="text-blue-600 font-bold">৳</span>
                                    </div>
                                    <input
                                        type="text"
                                        readOnly
                                        value={totalCollection.toLocaleString('en-IN')}
                                        className="payment-form-input pl-9 font-bold bg-blue-50/30 text-blue-700 border-blue-100 cursor-default"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Collected</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1 font-bold">Discount (TK)</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="text-emerald-600 font-bold group-focus-within:scale-110 transition-transform">৳</span>
                                    </div>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={newPayment.discount}
                                        onChange={(e) => setNewPayment(prev => ({ ...prev, discount: e.target.value }))}
                                        className="payment-form-input pl-9 font-bold text-emerald-700 border-emerald-100 focus:border-emerald-500 focus:ring-emerald-500/20 placeholder:text-emerald-200"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest group-focus-within:text-emerald-500 transition-colors">Special</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Dynamic Payment Items List */}
                        <div className="md:col-span-2 space-y-4 mt-6">
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={addPaymentItem}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-[10px] hover:bg-blue-100 transition-all group border border-blue-100/50 uppercase tracking-widest"
                                >
                                    <PlusIcon className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                                    <span>Add More Method</span>
                                </button>
                            </div>
                            {newPayment.items.map((item, index) => (
                                <div key={item.id} className="relative p-7 bg-blue-50/10 rounded-3xl border border-blue-100/20 space-y-6 animate-in slide-in-from-top-4 duration-300 group/item">
                                    {newPayment.items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removePaymentItem(item.id)}
                                            className="absolute top-5 right-5 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all z-10 opacity-0 group-hover/item:opacity-100"
                                            title="Remove this method"
                                        >
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <div className={`grid grid-cols-1 gap-6 ${['Bank Deposit', 'Online Banking', 'Cheque'].includes(item.method)
                                        ? 'md:grid-cols-5'
                                        : (['Cash', 'Mobile Banking'].includes(item.method) ? 'md:grid-cols-4' : 'md:grid-cols-2')
                                        }`}>
                                        <div className="space-y-2 relative" data-dropdown-id={`method-${item.id}`}>
                                            <label className="text-sm font-medium text-gray-700 ml-1">Method</label>
                                            <button
                                                type="button"
                                                onClick={() => setActiveDropdown(activeDropdown === `method-${item.id}` ? null : `method-${item.id}`)}
                                                className="payment-form-input w-full flex items-center justify-between group bg-white border-blue-100/50"
                                            >
                                                <span className="font-medium text-gray-700">{item.method}</span>
                                                {item.method && item.method !== 'Cash' ? (
                                                    <span
                                                        role="button"
                                                        onClick={(e) => { e.stopPropagation(); updatePaymentItem(item.id, { method: 'Cash', bankName: '', branch: '', accountNo: '' }); setActiveDropdown(null); }}
                                                        className="ml-1 text-gray-400 hover:text-red-500 transition-colors cursor-pointer text-lg leading-none"
                                                    >×</span>
                                                ) : (
                                                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${activeDropdown === `method-${item.id}` ? 'rotate-180' : ''}`} />
                                                )}
                                            </button>
                                            {activeDropdown === `method-${item.id}` && (
                                                <div className="absolute z-[120] left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl py-2 animate-in slide-in-from-top-2 duration-200">
                                                    {["Cash", "Bank Deposit", "Online Banking", "Mobile Banking", "Cheque"].map(option => (
                                                        <button
                                                            key={option}
                                                            type="button"
                                                            onClick={() => {
                                                                updatePaymentItem(item.id, { method: option });
                                                                setActiveDropdown(null);
                                                            }}
                                                            className={`w-full px-5 py-3 text-left hover:bg-blue-50 transition-colors text-sm font-medium ${item.method === option ? 'text-blue-600 bg-blue-50/50' : 'text-gray-700'}`}
                                                        >
                                                            {option}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {item.method === 'Cash' && (
                                            <>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-gray-500 ml-1 italic">Receive By</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Receiver name..."
                                                        value={item.receiveBy}
                                                        onChange={(e) => updatePaymentItem(item.id, { receiveBy: e.target.value })}
                                                        className="payment-form-input border-gray-200/50 bg-white/50"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-gray-500 ml-1 italic">Place</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Location..."
                                                        value={item.place}
                                                        onChange={(e) => updatePaymentItem(item.id, { place: e.target.value })}
                                                        className="payment-form-input border-gray-200/50 bg-white/50"
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {(['Bank Deposit', 'Online Banking', 'Cheque', 'Mobile Banking'].includes(item.method)) && (
                                            <>
                                                <div className="space-y-2 relative" data-dropdown-id={`bank-${item.id}`}>
                                                    <label className="text-sm font-medium text-blue-700/70 ml-1 text-[11px] uppercase tracking-tighter">
                                                        {item.method === 'Mobile Banking' ? 'Provider' : 'Bank'}
                                                    </label>
                                                    {item.method === 'Mobile Banking' ? (
                                                        <input
                                                            type="text"
                                                            placeholder="bKash, Nagad, etc."
                                                            value={item.bankName || ''}
                                                            onChange={(e) => updatePaymentItem(item.id, { bankName: e.target.value })}
                                                            className="payment-form-input border-blue-200/50 bg-white/50 text-sm py-2"
                                                        />
                                                    ) : (
                                                        <div className="relative group/bank">
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Type or Select Bank..."
                                                                    value={item.bankName || ''}
                                                                    onChange={(e) => {
                                                                        updatePaymentItem(item.id, { bankName: e.target.value });
                                                                        setActiveDropdown(`bank-${item.id}`);
                                                                    }}
                                                                    onFocus={() => setActiveDropdown(`bank-${item.id}`)}
                                                                    className="payment-form-input pr-8 text-sm py-2 bg-white/50 border-blue-200/50"
                                                                    autoComplete="off"
                                                                />
                                                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                                    <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${activeDropdown === `bank-${item.id}` ? 'rotate-180' : ''}`} />
                                                                </div>
                                                            </div>
                                                            {activeDropdown === `bank-${item.id}` && (
                                                                <div className="absolute z-[140] left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-52 overflow-y-auto py-1 animate-in slide-in-from-top-2 duration-200">
                                                                    {banks.filter(b => (b.bankName || '').toLowerCase().includes((item.bankName || '').toLowerCase())).length > 0 ? (
                                                                        banks.filter(b => (b.bankName || '').toLowerCase().includes((item.bankName || '').toLowerCase())).map(bank => (
                                                                            <button
                                                                                key={bank._id || bank.bankName}
                                                                                type="button"
                                                                                onMouseDown={(e) => {
                                                                                    e.preventDefault();
                                                                                    updatePaymentItem(item.id, { bankName: bank.bankName });
                                                                                    setActiveDropdown(null);
                                                                                }}
                                                                                className={`w-full px-4 py-2 text-left text-xs font-semibold hover:bg-blue-50 transition-colors flex items-center justify-between cursor-pointer ${item.bankName === bank.bankName ? 'bg-blue-50/70 text-blue-700' : 'text-gray-700'}`}
                                                                            >
                                                                                <span>{bank.bankName}</span>
                                                                                {item.bankName === bank.bankName && <CheckIcon className="w-3.5 h-3.5 text-blue-600" />}
                                                                            </button>
                                                                        ))
                                                                    ) : (
                                                                        <div className="px-4 py-2.5 text-left text-xs text-gray-400 font-medium">Type custom bank name</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {item.method !== 'Mobile Banking' && (
                                                    <div className="space-y-2 relative" data-dropdown-id={`branch-${item.id}`}>
                                                        <label className="text-sm font-medium text-blue-700/70 ml-1 text-[11px] uppercase tracking-tighter">Branch</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                placeholder="Type or Select Branch..."
                                                                value={item.branch || ''}
                                                                onChange={(e) => updatePaymentItem(item.id, { branch: e.target.value })}
                                                                onFocus={() => setActiveDropdown(`branch-${item.id}`)}
                                                                className="payment-form-input pr-8 text-sm py-2 bg-white/50 border-blue-200/50"
                                                                autoComplete="off"
                                                            />
                                                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                                <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${activeDropdown === `branch-${item.id}` ? 'rotate-180' : ''}`} />
                                                            </div>
                                                        </div>
                                                        {activeDropdown === `branch-${item.id}` && (
                                                            <div className="absolute z-[140] left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-52 overflow-y-auto py-1 animate-in slide-in-from-top-2 duration-200">
                                                                {(() => {
                                                                    const foundBank = banks.find(b => (b.bankName || '').trim().toLowerCase() === (item.bankName || '').trim().toLowerCase());
                                                                    const availableBranches = (foundBank?.branches || []).filter(br => (br.branch || '').toLowerCase().includes((item.branch || '').toLowerCase()));
                                                                    if (availableBranches.length === 0) {
                                                                        return <div className="px-4 py-2.5 text-left text-xs text-gray-400 font-medium">Type custom branch name</div>;
                                                                    }
                                                                    return availableBranches.map((br, bi) => (
                                                                        <button
                                                                            key={bi}
                                                                            type="button"
                                                                            onMouseDown={(e) => {
                                                                                e.preventDefault();
                                                                                updatePaymentItem(item.id, { branch: br.branch, accountNo: br.accountNo || item.accountNo });
                                                                                setActiveDropdown(null);
                                                                            }}
                                                                            className={`w-full px-4 py-2 text-left text-xs font-semibold hover:bg-blue-50 transition-colors cursor-pointer ${item.branch === br.branch ? 'bg-blue-50/70 text-blue-700' : 'text-gray-700'}`}
                                                                        >
                                                                            {br.branch}
                                                                        </button>
                                                                    ));
                                                                })()}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-blue-700/70 ml-1 text-[11px] uppercase tracking-tighter">
                                                        {item.method === 'Mobile Banking' ? 'Ref/Phone' : 'Account/Cheque'}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="Number..."
                                                        value={item.accountNo || ''}
                                                        onChange={(e) => updatePaymentItem(item.id, { accountNo: e.target.value })}
                                                        className="payment-form-input border-blue-200/50 bg-white/50 text-sm py-2"
                                                    />
                                                </div>
                                            </>
                                        )}

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-blue-700/70 ml-1">Amount (TK)</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                    <span className="text-blue-600 font-bold">৳</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    placeholder="0.00"
                                                    value={item.amount}
                                                    onChange={(e) => updatePaymentItem(item.id, { amount: e.target.value })}
                                                    className="payment-form-input pl-9 font-bold text-blue-600 border-blue-200/50 bg-white"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Conditional Fields per Item (Handled in single row above) */}
                                </div>
                            ))}
                        </div>

                        {/* Global Reference Row */}
                        <div className="md:col-span-2 pt-6 border-t border-gray-100 animate-in fade-in duration-500">

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">Reference / Remarks</label>
                                <textarea
                                    placeholder="Add any internal notes or references here..."
                                    rows="1"
                                    value={newPayment.reference}
                                    onChange={(e) => setNewPayment(prev => ({ ...prev, reference: e.target.value }))}
                                    className="payment-form-input resize-none h-[64px] py-3.5"
                                />
                            </div>
                            <div className="relative w-full md:w-64" data-dropdown-id="status">
                                <button
                                    type="button"
                                    onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                    className="payment-form-input w-full flex items-center justify-between group bg-white border-blue-100/50 py-3 px-6 rounded-xl"
                                >
                                    <div className="flex flex-col items-start">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Collection Status</span>
                                        <span className={`font-bold ${newPayment.status === 'Completed' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {newPayment.status}
                                        </span>
                                    </div>
                                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${activeDropdown === 'status' ? 'rotate-180' : ''}`} />
                                </button>

                                {activeDropdown === 'status' && (
                                    <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-2xl py-2 animate-in slide-in-from-top-2 duration-200 z-[150]">
                                        {["Completed", "Pending"].map(option => (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => {
                                                    setNewPayment(prev => ({ ...prev, status: option }));
                                                    setActiveDropdown(null);
                                                }}
                                                className={`w-full px-5 py-3 text-left hover:bg-blue-50 transition-colors text-sm font-bold ${newPayment.status === option ? 'text-blue-600 bg-blue-50/50' : 'text-gray-700'}`}
                                            >
                                                <span className={option === 'Completed' ? 'text-emerald-600' : 'text-amber-600'}>{option}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status Message */}
                        {submitStatus && (
                            <div className={`md:col-span-2 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${submitStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                                }`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${submitStatus === 'success' ? 'bg-emerald-500' : 'bg-red-500'
                                    }`}>
                                    {submitStatus === 'success' ? <DollarSignIcon className="w-5 h-5" /> : <XIcon className="w-5 h-5" />}
                                </div>
                                <p className="text-sm font-bold">
                                    {submitStatus === 'success' ? 'Collection record saved successfully!' : 'Failed to save record. Please try again.'}
                                </p>
                            </div>
                        )}

                        {/* Footer Buttons */}
                        <div className="md:col-span-2 flex items-center justify-end gap-3 pt-4 border-t border-gray-50 mt-6 relative z-10">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all text-sm flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <DollarSignIcon className="w-4 h-4" />
                                        <span>Save Collection</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <PaymentCollectionReport
                isOpen={showReport}
                onClose={() => setShowReport(false)}
                payments={filteredPayments}
            />

            {/* Premium Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
                        onClick={() => !isSubmitting && setShowDeleteConfirm(false)}
                    ></div>

                    {/* Modal Card */}
                    <div className="relative bg-white/90 backdrop-blur-2xl border border-white/50 rounded-3xl shadow-2xl p-8 max-w-md w-full animate-in zoom-in slide-in-from-bottom-8 duration-500">
                        {/* Status Icon */}
                        <div className={`flex items-center justify-center w-20 h-20 rounded-full mx-auto mb-6 transition-all duration-500 ${submitStatus === 'success' ? 'bg-emerald-100 text-emerald-600' :
                                submitStatus === 'error' ? 'bg-red-100 text-red-600' : 'bg-red-50 text-red-500'
                            }`}>
                            {submitStatus === 'success' ? (
                                <CheckIcon className="w-10 h-10 animate-in zoom-in duration-300" />
                            ) : (
                                <TrashIcon className={`w-10 h-10 ${!isSubmitting && !submitStatus ? 'animate-bounce' : ''}`} />
                            )}
                        </div>

                        <h3 className="text-2xl font-black text-gray-900 text-center mb-3 tracking-tight">
                            {submitStatus === 'success' ? 'Deleted Successfully' : 'Delete Record?'}
                        </h3>

                        <p className="text-gray-500 text-center mb-8 leading-relaxed font-medium">
                            {submitStatus === 'success'
                                ? 'The payment record has been removed from the system.'
                                : `Are you sure you want to delete the payment of ৳${paymentToDelete?.amount?.toLocaleString('en-IN')} from ${paymentToDelete?.companyName || paymentToDelete?.customerName}? This action cannot be undone.`
                            }
                        </p>

                        {!submitStatus && (
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    disabled={isSubmitting}
                                    className="flex-1 px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    disabled={isSubmitting}
                                    className="flex-1 px-6 py-3.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold rounded-2xl shadow-lg shadow-red-500/25 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        'Confirm'
                                    )}
                                </button>
                            </div>
                        )}

                        {submitStatus === 'error' && (
                            <button
                                onClick={() => setSubmitStatus(null)}
                                className="w-full px-6 py-3.5 bg-red-600 text-white font-bold rounded-2xl transition-all"
                            >
                                Try Again
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Bulk Action Confirmation Modal */}
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
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white border border-gray-100 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all animate-in zoom-in-95 duration-200">
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
                            className="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onConfirm || onClose}
                        disabled={isSubmitting}
                        className={`w-full px-4 py-2.5 text-white text-xs font-bold rounded-xl shadow-lg transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer ${
                            type === 'danger'
                                ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                                : type === 'success'
                                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                        }`}
                    >
                        {isSubmitting ? 'Processing...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentCollection;
