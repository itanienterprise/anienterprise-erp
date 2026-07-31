import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SearchIcon, FunnelIcon, DollarSignIcon, EyeIcon, PlusIcon, XIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon, EditIcon, UserIcon, BarChartIcon, CalendarIcon, CheckIcon, FileTextIcon } from '../../Icons';
import { API_BASE_URL, formatDate, SortIcon } from '../../../utils/helpers';
import { generatePayToCustomerVoucherPDF } from '../../../utils/pdfGenerator';
import { decryptData, encryptData } from '../../../utils/encryption';
import { hasPermission } from '../../../utils/permissionHelper';
import CustomDatePicker from '../../shared/CustomDatePicker';
import axios, { api } from '../../../utils/api';
import PayToCustomerReport from './PayToCustomerReport';
import './PayToCustomer.css';

const PayToCustomer = ({ addNotification, currentUser: propCurrentUser }) => {
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

    const canAdd = hasPermission(currentUser, 'payToCustomer', 'add');
    const canEdit = hasPermission(currentUser, 'payToCustomer', 'edit');
    const canDelete = hasPermission(currentUser, 'payToCustomer', 'delete');
    const canManage = canEdit || canDelete;
    const isAdmin = currentUser?.username === 'admin' || (currentUser?.role || '').toLowerCase() === 'admin';
    const isDataEntry = (currentUser?.role || '').toLowerCase() === 'data entry';
    const canApprove = hasPermission(currentUser, 'payToCustomer', 'special') || hasPermission(currentUser, 'payToCustomer', 'approve') || isAdmin;
    const canApproveEditRequest = hasPermission(currentUser, 'payToCustomer', 'approveEditRequest') || isAdmin;
    const canViewEditRequest = hasPermission(currentUser, 'payToCustomer', 'editRequest') || hasPermission(currentUser, 'payToCustomer', 'approveEditRequest') || canApprove;
    const canViewPaymentRequest = hasPermission(currentUser, 'payToCustomer', 'paymentRequest') || hasPermission(currentUser, 'payToCustomer', 'paymentApprovalRequest') || canApprove;

    // Requested & Edit Request Toggle Filters
    const [isRequestedOnly, setIsRequestedOnly] = useState(false);
    const [isEditRequestedOnly, setIsEditRequestedOnly] = useState(false);

    const requestedCount = useMemo(() => {
        const unique = new Set(payments.filter(p => (p.status || '').toLowerCase() === 'requested').map(p => p.receiptNo || p.id));
        return unique.size;
    }, [payments]);

    const editRequestedCount = useMemo(() => {
        const unique = new Set(payments.filter(p => (p.isEdited === true || p.isEdited === 'true') && (p.status || '').toLowerCase() !== 'requested').map(p => p.receiptNo || p.id));
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

    const filterPanelRef = useRef(null);
    const filterButtonRef = useRef(null);

    // New States
    const [showAddModal, setShowAddModal] = useState(false);
    const [expandedMobileCards, setExpandedMobileCards] = useState(null);
    const [rawCustomers, setRawCustomers] = useState([]);
    const [purchasesList, setPurchasesList] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedRows, setExpandedRows] = useState(new Set());

    const toggleRowExpansion = (groupKey) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(groupKey)) {
            newExpanded.delete(groupKey);
        } else {
            newExpanded.add(groupKey);
        }
        setExpandedRows(newExpanded);
    };

    const [submitStatus, setSubmitStatus] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [paymentToDelete, setPaymentToDelete] = useState(null);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [banks, setBanks] = useState([]);

    const customerDropdownRef = useRef(null);

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

    useEffect(() => {
        fetchPayments();
        fetchBanks();
    }, []);

    const fetchBanks = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/banks`);
            const rawData = Array.isArray(response.data) ? response.data : [];
            const decryptedBanks = rawData.map(bank => {
                const branches = bank.branches || [{
                    branch: bank.branch,
                    accountName: bank.accountName,
                    accountNo: bank.accountNo
                }];
                return { ...bank, branches };
            });
            const filteredBanks = decryptedBanks.filter(bank => !bank.isIndian);
            setBanks(filteredBanks);
        } catch (error) {
            console.error('Error fetching banks:', error);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target && !document.body.contains(event.target)) return;
            if (!activeDropdown) return;

            if (activeDropdown === 'customer' && customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
                return;
            }

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
            if (event.target && !document.body.contains(event.target)) return;
            if (showFilterPanel && filterPanelRef.current && filterButtonRef.current) {
                if (!filterPanelRef.current.contains(event.target) && !filterButtonRef.current.contains(event.target)) {
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

    const uniqueMethods = ["Cash", "Bank Deposit", "Online Banking", "Mobile Banking", "Cheque"];
    const uniqueBanks = [...new Set(payments.map(p => p.bankName).filter(Boolean))].sort();
    const uniqueBranches = [...new Set(payments.map(p => p.branch).filter(Boolean))].sort();
    const uniqueCustomers = [...new Set(payments.map(p => p.companyName || p.customerName).filter(Boolean))].sort();

    const fetchPayments = async () => {
        setIsLoading(true);
        try {
            const [customersData, purchasesData] = await Promise.all([
                api.get('/api/customers').catch(() => []),
                api.get('/api/purchases').catch(() => [])
            ]);

            const rawData = Array.isArray(customersData) ? customersData : [];
            const purData = Array.isArray(purchasesData) ? purchasesData : [];
            const allPayments = [];
            const customersList = [];

            rawData.forEach(customer => {
                customersList.push(customer);

                const customerHistory = customer.payToCustomerHistory || [];
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
            setPurchasesList(purData);
        } catch (error) {
            console.error('Error fetching pay to customer records:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const calculateCustomerPurchaseBalance = (customer) => {
        if (!customer) return 0;

        const directHistory = customer.purchaseHistory || [];

        const cId = String(customer._id || '').toLowerCase();
        const cReadId = String(customer.customerId || '').toLowerCase();
        const cComp = (customer.companyName || '').trim().toLowerCase();
        const cName = (customer.customerName || '').trim().toLowerCase();

        const matchedPurchases = (purchasesList || []).filter(p => {
            if ((p.status || '').toLowerCase() === 'requested') return false;

            const pCustId = String(p.customerId || '').toLowerCase();
            const pComp = (p.companyName || '').trim().toLowerCase();
            const pName = (p.customerName || '').trim().toLowerCase();
            const pSupp = (p.supplierName || '').trim().toLowerCase();
            const pParty = (p.party || '').trim().toLowerCase();

            const isIdMatch = !!(pCustId && (pCustId === cId || pCustId === cReadId));
            const isNameMatch = !!(
                (cComp && (pComp === cComp || pName === cComp || pSupp === cComp || pParty === cComp || (pComp && pComp.includes(cComp)) || (pSupp && pSupp.includes(cComp)))) ||
                (cName && (pComp === cName || pName === cName || pSupp === cName || pParty === cName || (pName && pName.includes(cName)) || (pSupp && pSupp.includes(cName))))
            );

            return isIdMatch || isNameMatch;
        }).flatMap(p => {
            if (p.items && Array.isArray(p.items) && p.items.length > 0) {
                return p.items.flatMap(item => {
                    if (item.brandEntries && Array.isArray(item.brandEntries) && item.brandEntries.length > 0) {
                        return item.brandEntries.map(b => ({
                            amount: parseFloat(b.total) || (parseFloat(b.qty || b.quantity || 0) * parseFloat(b.rate || 0)),
                            discount: parseFloat(p.discount || 0),
                            paid: parseFloat(p.paid || p.paidAmount || item.paid || item.paidAmount || 0)
                        }));
                    }
                    return [{
                        amount: parseFloat(item.total || item.amount || (parseFloat(item.qty || item.quantity || 0) * parseFloat(item.rate || 0)) || 0),
                        discount: parseFloat(p.discount || 0),
                        paid: parseFloat(p.paid || p.paidAmount || item.paid || item.paidAmount || 0)
                    }];
                });
            }
            return [{
                amount: parseFloat(p.totalAmount || p.amount || 0),
                discount: parseFloat(p.discount || 0),
                paid: parseFloat(p.paid || p.paidAmount || 0)
            }];
        });

        const combinedPurchases = [...directHistory, ...matchedPurchases];
        const totalPurchaseAmount = combinedPurchases.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const totalPurchaseDiscount = combinedPurchases.reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0);
        const totalPurchasePaid = combinedPurchases.reduce((sum, item) => sum + (parseFloat(item.paid) || 0), 0);

        const validPayouts = (customer.payToCustomerHistory || []).filter(p => (p.status || '').toLowerCase() !== 'requested');
        const totalHistoryPayout = validPayouts.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

        return Math.max(0, totalPurchaseAmount - totalPurchaseDiscount - totalPurchasePaid - totalHistoryPayout);
    };

    const handleGenerateReceipt = (payment, customAmount = null, items = null) => {
        const customer = rawCustomers.find(c => c._id === payment.customerId);
        const paidAmount = customAmount !== null ? customAmount : (parseFloat(payment.amount) || 0);
        const tableItems = items || [payment];

        const dueBal = customer ? calculateCustomerPurchaseBalance(customer) : 0;
        const prevBal = dueBal + paidAmount;

        const receiptData = {
            ...payment,
            amount: paidAmount,
            address: customer?.address || customer?.location || '',
            phone: customer?.phone || '',
            previousBalance: payment.previousBalance !== undefined ? payment.previousBalance : prevBal,
            balanceDue: payment.balanceDue !== undefined ? payment.balanceDue : dueBal,
            items: tableItems
        };

        generatePayToCustomerVoucherPDF(receiptData);
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
            alert('Forbidden: You do not have permission to delete pay to customer records');
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
            const updatedHistory = (customer.payToCustomerHistory || []).filter(p => p.id !== paymentToDelete.id);
            const updatedCustomer = { ...customer, payToCustomerHistory: updatedHistory };
            await axios.put(`${API_BASE_URL}/api/customers/${paymentToDelete.customerId}`, updatedCustomer);

            setSubmitStatus('success');
            setTimeout(() => {
                setShowDeleteConfirm(false);
                setPaymentToDelete(null);
                setSubmitStatus(null);
                fetchPayments();
            }, 1000);

            try {
                const now = new Date();
                const dateStr = now.toLocaleDateString('en-GB');
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const deleterName = currentUser?.name || currentUser?.username || 'An employee';
                const partyName = paymentToDelete?.companyName || paymentToDelete?.customerName || 'Customer';
                if (addNotification) await addNotification(
                    'Payout Deleted',
                    `${dateStr} | ${timeStr} | ${deleterName} deleted payout (${paymentToDelete?.receiptNo}) to ${partyName}`,
                    ['admin', 'incharge', 'sales manager'],
                    ['admin']
                );
            } catch (notifErr) { console.error('Notification error:', notifErr); }
        } catch (error) {
            console.error('Error deleting payout:', error);
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

            if (newStatus === 'Rejected') {
                if (paymentGroup.isEdited === true && (paymentGroup.status || '').toLowerCase() !== 'requested') {
                    const updatedHistory = (customer.payToCustomerHistory || []).map(p => {
                        if (p.receiptNo === paymentGroup.receiptNo) {
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
                    await axios.put(`${API_BASE_URL}/api/customers/${paymentGroup.customerId}`, { ...customer, payToCustomerHistory: updatedHistory });
                } else {
                    const updatedHistory = (customer.payToCustomerHistory || []).filter(p => p.receiptNo !== paymentGroup.receiptNo);
                    await axios.put(`${API_BASE_URL}/api/customers/${paymentGroup.customerId}`, { ...customer, payToCustomerHistory: updatedHistory });
                }
            } else {
                const updatedHistory = (customer.payToCustomerHistory || []).map(p => {
                    if (p.receiptNo === paymentGroup.receiptNo) {
                        const { originalData, ...rest } = p;
                        return { ...rest, status: 'Accepted', isEdited: false };
                    }
                    return p;
                });
                await axios.put(`${API_BASE_URL}/api/customers/${paymentGroup.customerId}`, { ...customer, payToCustomerHistory: updatedHistory });
            }
            fetchPayments();

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
                    title = newStatus === 'Accepted' ? 'Payout Edit Request Accepted' : 'Payout Edit Request Rejected';
                    msg = newStatus === 'Accepted'
                        ? `${dateStr} | ${timeStr} | ${actorName} accepted edit request for payout (${receiptNo}) to ${partyName}`
                        : `${dateStr} | ${timeStr} | ${actorName} rejected edit request for payout (${receiptNo}) to ${partyName} — reverted to original`;
                } else {
                    title = newStatus === 'Accepted' ? 'Payout Request Accepted' : 'Payout Request Rejected';
                    msg = newStatus === 'Accepted'
                        ? `${dateStr} | ${timeStr} | ${actorName} accepted payout request (${receiptNo}) of ৳${paymentGroup.items?.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0).toLocaleString('en-IN')} to ${partyName}`
                        : `${dateStr} | ${timeStr} | ${actorName} rejected payout request (${receiptNo}) to ${partyName}`;
                }
                if (addNotification) await addNotification(title, msg, ['admin', 'incharge', 'sales manager'], ['admin']);
            } catch (notifErr) { console.error('Notification error:', notifErr); }
        } catch (error) {
            console.error('Error updating payout status:', error);
            alert('Failed to update payout status');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditInitiation = (payment) => {
        setIsEditMode(true);
        setEditingPayment(payment);

        const relatedPayments = payments.filter(p => p.receiptNo === payment.receiptNo && p.customerId === payment.customerId);
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
            alert('Forbidden: You do not have permission to add pay to customer records');
            return;
        }
        const totalAmountValue = newPayment.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        if (!newPayment.customerId || totalAmountValue <= 0) return;

        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const custRes = await axios.get(`${API_BASE_URL}/api/customers/${newPayment.customerId}`);
            const customer = custRes.data;

            const lastReceiptNo = payments.reduce((max, p) => {
                const parts = (p.receiptNo || '').split('-');
                const no = parseInt(parts[1] || parts[0]);
                return !isNaN(no) && no > max ? no : max;
            }, 0);

            const nextReceiptNo = `PTC-${String(lastReceiptNo + 1).padStart(4, '0')}`;
            const initialStatus = 'Requested';
            const paymentEntries = newPayment.items
                .filter(item => parseFloat(item.amount) > 0)
                .map((item, idx) => ({
                    receiptNo: nextReceiptNo,
                    date: newPayment.date,
                    method: item.method,
                    bankName: item.bankName,
                    accountNo: item.accountNo,
                    branch: item.branch,
                    amount: parseFloat(item.amount),
                    receiveBy: item.receiveBy,
                    place: item.place,
                    reference: newPayment.reference,
                    status: initialStatus,
                    isEdited: false,
                    discount: idx === 0 ? (parseFloat(newPayment.discount) || 0) : 0,
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                }));

            const updatedCustomer = {
                ...customer,
                payToCustomerHistory: [...paymentEntries, ...(customer.payToCustomerHistory || [])]
            };

            await axios.put(`${API_BASE_URL}/api/customers/${newPayment.customerId}`, updatedCustomer);
            setSubmitStatus('success');

            try {
                const now = new Date();
                const dateStr = now.toLocaleDateString('en-GB');
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const employeeName = currentUser?.name || currentUser?.username || 'An employee';
                const partyName = rawCustomers.find(c => c._id === newPayment.customerId)?.companyName ||
                    rawCustomers.find(c => c._id === newPayment.customerId)?.customerName || 'Customer';
                const totalAmt = newPayment.items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
                if (addNotification) await addNotification(
                    'New Payout Requested',
                    `${dateStr} | ${timeStr} | ${employeeName} requested a payout of ৳${totalAmt.toLocaleString('en-IN')} to ${partyName} (${nextReceiptNo})`,
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
            console.error('Error saving payout:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateCollection = async (e) => {
        e.preventDefault();
        if (!canEdit) {
            alert('Forbidden: You do not have permission to edit pay to customer records');
            return;
        }
        const activeItems = newPayment.items.filter(item => parseFloat(item.amount) > 0);
        if (!newPayment.customerId || activeItems.length === 0) return;

        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const custRes = await axios.get(`${API_BASE_URL}/api/customers/${newPayment.customerId}`);
            const customer = custRes.data;

            const existingEntries = (customer.payToCustomerHistory || []).filter(p => p.receiptNo === editingPayment.receiptNo);
            const remainingHistory = (customer.payToCustomerHistory || []).filter(p => p.receiptNo !== editingPayment.receiptNo);

            const isEditReq = (!isAdmin && !canApproveEditRequest) || editingPayment?.isEdited === true;
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
                    discount: idx === 0 ? (parseFloat(newPayment.discount) || 0) : 0,
                    id: item.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                };
            });

            const updatedCustomer = {
                ...customer,
                payToCustomerHistory: [...updatedPaymentEntries, ...remainingHistory]
            };

            await axios.put(`${API_BASE_URL}/api/customers/${newPayment.customerId}`, updatedCustomer);
            setSubmitStatus('success');

            try {
                const now = new Date();
                const dateStr = now.toLocaleDateString('en-GB');
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const editorName = currentUser?.name || currentUser?.username || 'An employee';
                const partyName = rawCustomers.find(c => c._id === newPayment.customerId)?.companyName ||
                    rawCustomers.find(c => c._id === newPayment.customerId)?.customerName || 'Customer';
                const totalAmt = activeItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
                const title = isEditReq ? 'Payout Edit Requested' : 'Payout Updated';
                const msg = isEditReq
                    ? `${dateStr} | ${timeStr} | ${editorName} requested an edit on payout (${editingPayment?.receiptNo}) of ৳${totalAmt.toLocaleString('en-IN')} to ${partyName}`
                    : `${dateStr} | ${timeStr} | ${editorName} updated payout (${editingPayment?.receiptNo}) of ৳${totalAmt.toLocaleString('en-IN')} to ${partyName}`;
                if (addNotification) await addNotification(title, msg, ['admin', 'incharge', 'sales manager'], ['admin']);
            } catch (notifErr) { console.error('Notification error:', notifErr); }

            fetchPayments();
            setTimeout(() => {
                setShowAddModal(false);
                setSubmitStatus(null);
                resetNewPayment();
            }, 1500);
        } catch (error) {
            console.error('Error updating payout:', error);
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

    const filteredPayments = payments.filter(p => {
        const query = searchQuery.toLowerCase();
        const matchSearch = !searchQuery || (
            (p.customerName || '').toLowerCase().includes(query) ||
            (p.companyName || '').toLowerCase().includes(query) ||
            (p.receiptNo || '').toLowerCase().includes(query) ||
            (p.method || '').toLowerCase().includes(query) ||
            (p.receiveBy || '').toLowerCase().includes(query) ||
            (p.bankName || '').toLowerCase().includes(query)
        );

        let isDateMatch = true;
        if (filters.startDate && (!p.date || p.date < filters.startDate)) {
            isDateMatch = false;
        }
        if (filters.endDate && (!p.date || p.date > filters.endDate)) {
            isDateMatch = false;
        }

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

    return (
        <div className="space-y-6">
            {!showAddModal && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="w-full md:w-auto">
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Pay To Customer</h2>
                    </div>

                    {/* Search Bar & Requested / Edit Request Toggles */}
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
                        {/* Filter Button & Popup */}
                        <div className="relative flex-1 md:flex-none">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all border ${showFilterPanel || Object.values(filters).some(v => v !== '') ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'} h-[42px]`}
                            >
                                <FunnelIcon className={`w-4 h-4 ${(showFilterPanel || Object.values(filters).some(v => v !== '')) ? 'text-white' : 'text-gray-400'}`} />
                                <span className={`text-sm font-medium ${(showFilterPanel || Object.values(filters).some(v => v !== '')) ? 'text-white' : 'text-gray-600'}`}>Filter</span>
                            </button>

                            {/* Filter Panel Popup */}
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
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-0.5">Start Date</label>
                                            <CustomDatePicker value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} compact />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-0.5">End Date</label>
                                            <CustomDatePicker value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} compact rightAlign={true} />
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

                        {/* Add Payout Button */}
                        {canAdd && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="flex-1 md:flex-none w-full md:w-auto justify-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all transform active:scale-95 flex items-center gap-2 text-sm h-[42px]"
                            >
                                <PlusIcon className="w-4 h-4" /> <span>Add Payout</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {!showAddModal && (
                <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="sale-mgmt-table hidden md:table">
                            <thead>
                                <tr>
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
                                    <th className="sale-mgmt-th text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {isLoading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={11} className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                                                        <DollarSignIcon className="w-6 h-6 text-blue-500" />
                                                    </div>
                                                    <p className="text-gray-500 font-medium">Loading payout history...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : filteredPayments.length > 0 ? (
                                    (() => {
                                        const groups = [];
                                        filteredPayments.forEach(payment => {
                                            const groupKey = `${payment.date}-${payment.receiptNo}-${payment.customerId}`;
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
                                                    items: []
                                                };
                                                groups.push(group);
                                            }
                                            group.items.push(payment);
                                            group.isEdited = group.isEdited || payment.isEdited === true || payment.isEdited === 'true';
                                        });

                                        return groups.map((group) => {
                                            const isMultiple = group.items.length > 1;
                                            const isExpanded = expandedRows.has(group.key);
                                            const totalAmount = group.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

                                            return (
                                                <tr
                                                    key={group.key}
                                                    onClick={() => isMultiple && toggleRowExpansion(group.key)}
                                                    className={`hover:bg-blue-50/50 transition-all group border-b border-gray-50 last:border-0 align-middle ${isMultiple ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-blue-50/30' : ''}`}
                                                >
                                                    <td className="px-3 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-medium text-gray-600 leading-tight">{formatDate(group.date)}</div>
                                                    </td>
                                                    <td className="px-3 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-semibold text-blue-600 leading-tight">{group.receiptNo || '—'}</div>
                                                    </td>
                                                    <td className="px-3 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-semibold text-gray-800 leading-tight truncate max-w-[200px]">{group.companyName || group.customerName}</div>
                                                    </td>
                                                    <td className="px-3 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-500 leading-tight truncate max-w-[150px]">{group.customerAddress || '—'}</div>
                                                    </td>
                                                    <td className="px-3 py-4 whitespace-nowrap">
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
                                                    <td className="px-3 py-4 whitespace-nowrap">
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
                                                    <td className="px-3 py-4 whitespace-nowrap">
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
                                                    <td className="px-3 py-4 whitespace-nowrap">
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
                                                    <td className="px-3 py-4 whitespace-nowrap text-center">
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
                                                    <td className="px-3 py-4 text-center whitespace-nowrap">
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
                                                    <td className="px-3 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => handleGenerateReceipt(group.items[0], totalAmount, group.items)}
                                                                className="p-1 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 rounded transition-colors"
                                                                title="Voucher Receipt"
                                                            >
                                                                <FileTextIcon className="w-5 h-5" />
                                                            </button>
                                                            {((group.status === 'Requested' && canApprove) || (group.isEdited && canApproveEditRequest)) && (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleStatusUpdate(group, 'Accepted')}
                                                                        className="p-1 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 rounded transition-colors"
                                                                        title="Accept"
                                                                    >
                                                                        <CheckIcon className="w-5 h-5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleStatusUpdate(group, 'Rejected')}
                                                                        className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"
                                                                        title="Reject"
                                                                    >
                                                                        <XIcon className="w-5 h-5" />
                                                                    </button>
                                                                </>
                                                            )}
                                                            {canEdit && (
                                                                <button
                                                                    onClick={() => handleEditInitiation(group.items[0])}
                                                                    className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors"
                                                                    title="Edit"
                                                                >
                                                                    <EditIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDeletePayment(group.items[0])}
                                                                    className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })()
                                ) : (
                                    <tr>
                                        <td colSpan={11} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                                                    <SearchIcon className="w-6 h-6 text-gray-400" />
                                                </div>
                                                <p className="text-gray-500 font-medium">No pay to customer records found.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Add Payout Card (Style Match with Payment Collection) */}
            {showAddModal && (
                <div className="payment-form-container">

                    <div className="payment-form-header">
                        <div>
                            <h3 className="payment-form-title">{isEditMode ? 'Update Pay To Customer Entry' : 'New Pay To Customer Entry'}</h3>
                            <p className="text-xs text-gray-500 font-medium italic">Record a payout or refund to a customer or party</p>
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
                            {/* Row 1: Date, Customer, Total Balance, Total Payout, Discount */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">Payout Date</label>
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
                                        value={calculateCustomerPurchaseBalance(rawCustomers.find(c => c._id === newPayment.customerId)).toLocaleString('en-IN')}
                                        className="payment-form-input pl-9 font-bold bg-orange-50/30 text-orange-700 border-orange-100 cursor-default"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                                        <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Outstanding</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">Total Payout</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="text-blue-600 font-bold">৳</span>
                                    </div>
                                    <input
                                        type="text"
                                        readOnly
                                        value={newPayment.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toLocaleString('en-IN')}
                                        className="payment-form-input pl-9 font-bold bg-blue-50/30 text-blue-700 border-blue-100 cursor-default"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Paid Out</span>
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
                            {newPayment.items.map((item) => (
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
                                                    <label className="text-sm font-medium text-gray-500 ml-1 italic">Paid By</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Payer name..."
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
                                                            placeholder="bKash etc."
                                                            value={item.bankName}
                                                            onChange={(e) => updatePaymentItem(item.id, { bankName: e.target.value })}
                                                            className="payment-form-input border-blue-200/50 bg-white/50 text-sm"
                                                        />
                                                    ) : (
                                                        <div className="relative group/bank">
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Search or Select Bank"
                                                                    value={activeDropdown === `bank-${item.id}` ? bankSearchQuery : (item.bankName || '')}
                                                                    onChange={(e) => {
                                                                        setBankSearchQuery(e.target.value);
                                                                        setActiveDropdown(`bank-${item.id}`);
                                                                    }}
                                                                    onFocus={() => {
                                                                        setBankSearchQuery(item.bankName || '');
                                                                        setActiveDropdown(`bank-${item.id}`);
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            const filtered = banks.filter(b => b.bankName.toLowerCase().includes(bankSearchQuery.toLowerCase()));
                                                                            if (filtered.length > 0) {
                                                                                updatePaymentItem(item.id, { bankName: filtered[0].bankName, branch: '', accountNo: '' });
                                                                                setBankSearchQuery('');
                                                                                setActiveDropdown(null);
                                                                            }
                                                                        }
                                                                    }}
                                                                    className="payment-form-input pr-10 text-sm py-2 bg-white/50 border-blue-200/50"
                                                                    autoComplete="off"
                                                                />
                                                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5">
                                                                    {item.bankName ? (
                                                                        <span
                                                                            role="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                updatePaymentItem(item.id, { bankName: '', branch: '', accountNo: '' });
                                                                                setBankSearchQuery('');
                                                                                setActiveDropdown(null);
                                                                            }}
                                                                            className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer text-lg leading-none"
                                                                        >×</span>
                                                                    ) : (
                                                                        <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${activeDropdown === `bank-${item.id}` ? 'rotate-180' : ''}`} />
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {activeDropdown === `bank-${item.id}` && (
                                                                <div className="absolute z-[130] left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl py-2 max-h-52 overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                                                                    {banks.filter(b => b.bankName.toLowerCase().includes(bankSearchQuery.toLowerCase())).length > 0 ? (
                                                                        banks.filter(b => b.bankName.toLowerCase().includes(bankSearchQuery.toLowerCase())).map(bank => (
                                                                            <button
                                                                                key={bank._id}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    updatePaymentItem(item.id, { bankName: bank.bankName, branch: '', accountNo: '' });
                                                                                    setBankSearchQuery('');
                                                                                    setActiveDropdown(null);
                                                                                }}
                                                                                className="w-full px-5 py-2.5 text-left hover:bg-blue-50 text-xs font-semibold text-gray-700 transition-colors"
                                                                            >
                                                                                {bank.bankName}
                                                                            </button>
                                                                        ))
                                                                    ) : (
                                                                        <div className="px-5 py-3 text-left text-xs text-gray-400 font-medium">No banks found</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {item.method !== 'Mobile Banking' && (
                                                    <div className="space-y-2 relative" data-dropdown-id={`branch-${item.id}`}>
                                                        <label className="text-sm font-medium text-blue-700/70 ml-1 text-[11px] uppercase tracking-tighter">Branch</label>
                                                        <button
                                                            type="button"
                                                            disabled={!item.bankName}
                                                            onClick={() => setActiveDropdown(activeDropdown === `branch-${item.id}` ? null : `branch-${item.id}`)}
                                                            className={`payment-form-input w-full flex items-center justify-between border-blue-200/50 group bg-white/50 text-sm py-2 ${!item.bankName ? 'opacity-50' : ''}`}
                                                        >
                                                            <span className="truncate">{item.branch || 'Select'}</span>
                                                            {item.branch ? (
                                                                <span
                                                                    role="button"
                                                                    onClick={(e) => { e.stopPropagation(); updatePaymentItem(item.id, { branch: '', accountNo: '' }); setActiveDropdown(null); }}
                                                                    className="ml-1 text-gray-400 hover:text-red-500 transition-colors cursor-pointer leading-none"
                                                                >×</span>
                                                            ) : (
                                                                <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                                                            )}
                                                        </button>
                                                        {activeDropdown === `branch-${item.id}` && item.bankName && (
                                                            <div className="absolute z-[130] left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl py-2 animate-in slide-in-from-top-2 duration-200 max-h-52 overflow-y-auto">
                                                                {banks.find(b => b.bankName === item.bankName)?.branches.map((br, bi) => (
                                                                    <button
                                                                        key={bi}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            updatePaymentItem(item.id, { branch: br.branch, accountNo: br.accountNo });
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className="w-full px-4 py-2 text-left hover:bg-blue-50 text-xs"
                                                                    >
                                                                        {br.branch}
                                                                    </button>
                                                                ))}
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
                                                        value={item.accountNo}
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
                                </div>
                            ))}
                        </div>

                        {/* Global Reference Row */}
                        <div className="md:col-span-2 pt-6 border-t border-gray-100 animate-in fade-in duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Reference / Remarks</label>
                                    <textarea
                                        placeholder="Add any internal notes or references here..."
                                        rows="1"
                                        value={newPayment.reference}
                                        onChange={(e) => setNewPayment(prev => ({ ...prev, reference: e.target.value }))}
                                        className="payment-form-input resize-none h-[64px] py-3.5"
                                    />
                                </div>
                                <div className="relative w-full" data-dropdown-id="status">
                                    <button
                                        type="button"
                                        onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                        className="payment-form-input w-full flex items-center justify-between group bg-white border-blue-100/50 py-3 px-6 rounded-xl"
                                    >
                                        <div className="flex flex-col items-start">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Payout Status</span>
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
                                    {submitStatus === 'success' ? 'Payout record saved successfully!' : 'Failed to save record. Please try again.'}
                                </p>
                            </div>
                        )}

                        {/* Footer Buttons */}
                        <div className="md:col-span-2 flex items-center justify-end gap-3 pt-4 border-t border-gray-50 mt-6 relative z-10">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAddModal(false);
                                    resetNewPayment();
                                }}
                                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !newPayment.customerId || newPayment.items.reduce((s, i) => s + (Number(i.amount) || 0), 0) <= 0}
                                className={`px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all text-sm flex items-center justify-center gap-2 ${(isSubmitting || !newPayment.customerId || newPayment.items.reduce((s, i) => s + (Number(i.amount) || 0), 0) <= 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <DollarSignIcon className="w-4 h-4" />
                                        <span>Save Payout</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Delete Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white max-w-sm w-full p-6 rounded-2xl shadow-xl text-center space-y-4">
                        <h3 className="text-lg font-bold text-gray-900">Confirm Delete</h3>
                        <p className="text-xs text-gray-500">Are you sure you want to delete payout ({paymentToDelete?.receiptNo})?</p>
                        <div className="flex justify-center gap-3">
                            <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-gray-100 text-xs font-bold rounded-xl">Cancel</button>
                            <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Modal */}
            <PayToCustomerReport
                isOpen={showReport}
                onClose={() => setShowReport(false)}
                payments={payments}
            />

        </div>
    );
};

export default PayToCustomer;
