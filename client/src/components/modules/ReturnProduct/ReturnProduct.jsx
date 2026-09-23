import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    PlusIcon,
    SearchIcon,
    RotateCcwIcon,
    TrashIcon,
    EditIcon,
    XIcon,
    CalendarIcon,
    UserIcon,
    BoxIcon,
    FileTextIcon,
    ChevronDownIcon,
    ChevronUpIcon
} from '../../Icons';
import axios from '../../../utils/api';
import CustomDatePicker from '../../shared/CustomDatePicker';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import './ReturnProduct.css';
import { hasPermission } from '../../../utils/permissionHelper';
import { formatFirstName } from '../IPManagement/IPManagement';
import { decryptData } from '../../../utils/encryption';

const ReturnProduct = ({ currentUser, refreshPendingIndicators, onReturnsUpdated }) => {
    const [showForm, setShowForm] = useState(false);
    const [returns, setReturns] = useState([]);
    const [sales, setSales] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [expandedReturnId, setExpandedReturnId] = useState(null);
    const [deleteConfirmReturn, setDeleteConfirmReturn] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [toast, setToast] = useState(null);
    const toastTimerRef = useRef(null);

    const showToast = (message, type = 'success') => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ message, type });
        toastTimerRef.current = setTimeout(() => setToast(null), 3500);
    };

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, []);

    // Searchable Invoice State
    const [invoiceSearch, setInvoiceSearch] = useState('');
    const [showInvoiceDropdown, setShowInvoiceDropdown] = useState(false);
    const invoiceDropdownRef = React.useRef(null);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        invoiceNo: '',
        invoiceDate: '',
        companyName: '',
        phone: '',
        customerName: '',
        productName: '',
        lcNo: '',
        brand: '',
        quantity: '',
        bags: '',
        warehouse: '',
        reason: '',
        returnPrice: '',
        returnExpense: '',
        entryBy: '',
        entryByName: '',
        status: 'Pending',
        packetSize: 0,
        purchaseItems: []
    });

    const [employeesFirstNameMap, setEmployeesFirstNameMap] = useState({});

    const [warehouses, setWarehouses] = useState([]);
    const [warehouseSearch, setWarehouseSearch] = useState('');
    const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
    const warehouseRef = useRef(null);

    const [highlightedInvoiceIndex, setHighlightedInvoiceIndex] = useState(-1);
    const [highlightedWarehouseIndex, setHighlightedWarehouseIndex] = useState(-1);

    const handleInvoiceKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedInvoiceIndex(prev => Math.min(prev + 1, filteredSales.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedInvoiceIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const indexToSelect = highlightedInvoiceIndex >= 0 ? highlightedInvoiceIndex : 0;
            if (filteredSales && filteredSales[indexToSelect]) {
                handleInvoiceSelect(filteredSales[indexToSelect]);
            } else {
                setShowInvoiceDropdown(false);
            }
        } else if (e.key === 'Escape') {
            setShowInvoiceDropdown(false);
        }
    };

    const handleWarehouseKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedWarehouseIndex(prev => Math.min(prev + 1, filteredWarehouses.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedWarehouseIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const indexToSelect = highlightedWarehouseIndex >= 0 ? highlightedWarehouseIndex : 0;
            if (filteredWarehouses && filteredWarehouses[indexToSelect]) {
                const w = filteredWarehouses[indexToSelect];
                const selectedName = w.whName || w.name || w.warehouse;
                setFormData(prev => ({ ...prev, warehouse: selectedName }));
                setWarehouseSearch(selectedName);
                setShowWarehouseDropdown(false);
                setHighlightedWarehouseIndex(-1);
            } else {
                setShowWarehouseDropdown(false);
            }
        } else if (e.key === 'Escape') {
            setShowWarehouseDropdown(false);
        }
    };

    useEffect(() => {
        const qty = parseFloat(formData.quantity);
        const pktSize = parseFloat(formData.packetSize);

        if (qty > 0 && pktSize > 0) {
            const calculatedBags = (qty / pktSize).toFixed(2);
            // Only update if it's different to avoid infinite loops
            if (parseFloat(formData.bags) !== parseFloat(calculatedBags)) {
                setFormData(prev => ({ ...prev, bags: calculatedBags }));
            }
        }
    }, [formData.quantity, formData.packetSize, formData.bags]);

    const fetchReturns = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/returns`);
            setReturns(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching returns:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSales = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/sales`);
            setSales(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching sales:', error);
        }
    };

    const fetchWarehouses = async () => {
        try {
            console.log('Fetching warehouses and stock for names...');
            const [whRes, stockRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/warehouses`),
                axios.get(`${API_BASE_URL}/api/stock`)
            ]);

            const whList = Array.isArray(whRes.data) ? whRes.data : [];
            const stockList = Array.isArray(stockRes.data) ? stockRes.data : [];

            // Get unique warehouse names from both sources
            const names = new Set();
            whList.forEach(w => {
                const name = w.whName || w.name || w.warehouse;
                if (name) names.add(name);
            });
            stockList.forEach(s => {
                const name = s.warehouse || s.whName;
                if (name) names.add(name);
            });

            const uniqueWhList = Array.from(names).map(name => ({
                _id: name, // Use name as ID for unique-ness in this list
                whName: name
            })).sort((a, b) => a.whName.localeCompare(b.whName));

            console.log('Merged Warehouse List:', uniqueWhList);
            setWarehouses(uniqueWhList);
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/employees`);
            const rawData = Array.isArray(res.data) ? res.data : [];
            const firstMap = {};

            rawData.forEach(e => {
                let d = e;
                if (e && e.data) {
                    if (typeof e.data === 'string') {
                        try { d = { ...decryptData(e.data), _id: e._id }; } catch { /* ignore */ }
                    } else if (typeof e.data === 'object') {
                        d = { ...e.data, _id: e._id };
                    }
                }
                const empId = (d.employeeId || '').toLowerCase().trim();
                const uName = (d.username || '').toLowerCase().trim();
                const rawFName = (d.firstName || '').trim();
                const rawFullName = (d.name || '').trim();
                const fName = formatFirstName(rawFName || rawFullName);

                if (empId && fName) firstMap[empId] = fName;
                if (uName && fName) firstMap[uName] = fName;
                if (rawFullName && fName) firstMap[rawFullName.toLowerCase()] = fName;
            });

            firstMap['admin'] = 'Administrator';
            firstMap['administrator'] = 'Administrator';
            firstMap['a-1001'] = 'Anil';

            setEmployeesFirstNameMap(firstMap);
        } catch (error) {
            console.error('Error fetching employees in ReturnProduct:', error);
        }
    };

    const getFirstNameFromIdentifier = (identifier) => {
        if (!identifier || identifier === '-' || identifier === '—') return '';
        const rawStr = String(identifier).trim();
        const key = rawStr.toLowerCase();
        if (key === 'admin' || key === 'administrator') {
            return 'Administrator';
        }
        if (employeesFirstNameMap[key]) {
            return employeesFirstNameMap[key];
        }
        if (employeesFirstNameMap[rawStr]) {
            return employeesFirstNameMap[rawStr];
        }
        const parts = rawStr.split(/\s+/);
        if (['md', 'md.', 'mohammad', 'mst', 'mst.'].includes(parts[0].toLowerCase()) && parts.length > 1) {
            const prefixKey = `${parts[0]} ${parts[1]}`.toLowerCase();
            if (employeesFirstNameMap[prefixKey]) return employeesFirstNameMap[prefixKey];
        }
        const firstWord = parts[0];
        if (employeesFirstNameMap[firstWord.toLowerCase()]) {
            return employeesFirstNameMap[firstWord.toLowerCase()];
        }
        if (key === 'a-1001') {
            return 'Anil';
        }
        if (/^[EA]-\d+$/i.test(rawStr)) {
            return rawStr;
        }
        let candidate = firstWord;
        if (['md', 'md.', 'mohammad', 'mst', 'mst.'].includes(firstWord.toLowerCase()) && parts.length > 1) {
            candidate = `${parts[0]} ${parts[1]}`;
        }
        return formatFirstName(candidate || rawStr);
    };

    const getEntryByFirstName = (item) => {
        if (!item) return '—';
        const candidate = item.entryByName || item.entryBy || item.requestedBy || item.createdBy || item.createdByName || item.userName || item.user;
        if (!candidate || candidate === '-' || candidate === '—') return 'Administrator';
        return getFirstNameFromIdentifier(candidate) || candidate;
    };

    const getReturnLcNo = (ret) => {
        if (!ret) return '-';
        if (ret.lcNo) return ret.lcNo;
        const pItems = ret.purchaseItems && ret.purchaseItems.length > 0 ? ret.purchaseItems : null;
        if (pItems) {
            const item = pItems.find(i => i.productName === ret.productName);
            if (item) {
                if (item.brandEntries && item.brandEntries.length > 0) {
                    const be = item.brandEntries.find(b => (b.brandName || b.brand) === ret.brand);
                    if (be && (be.lcNo || be.lcNumber)) return be.lcNo || be.lcNumber;
                }
                if (item.lcNo || item.lcNumber) return item.lcNo || item.lcNumber;
            }
        }
        const orig = sales.find(s => s.invoiceNo === ret.invoiceNo);
        if (orig) {
            if (orig.items) {
                const item = orig.items.find(i => i.productName === ret.productName);
                if (item) {
                    if (item.brandEntries && item.brandEntries.length > 0) {
                        const be = item.brandEntries.find(b => (b.brandName || b.brand) === ret.brand);
                        if (be && (be.lcNo || be.lcNumber)) return be.lcNo || be.lcNumber;
                    }
                    if (item.lcNo || item.lcNumber) return item.lcNo || item.lcNumber;
                }
            }
            if (orig.lcNo) return orig.lcNo;
        }
        return '-';
    };

    useEffect(() => {
        fetchReturns();
        fetchSales();
        fetchWarehouses();
        fetchEmployees();
    }, []);

    // Handle outside click for warehouse dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (warehouseRef.current && !warehouseRef.current.contains(event.target)) {
                setShowWarehouseDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredWarehouses = warehouses.filter(w => {
        const query = (warehouseSearch || '').trim().toLowerCase();
        if (!query) return true;
        const name = (w.whName || w.name || w.warehouse || '').toLowerCase();
        if (query === (formData.warehouse || '').trim().toLowerCase()) return true;
        return name.includes(query);
    });

    // Handle outside click for invoice dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (invoiceDropdownRef.current && !invoiceDropdownRef.current.contains(event.target)) {
                setShowInvoiceDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const returnQty = parseFloat(formData.quantity) || 0;
            const returnPkt = parseFloat(formData.bags) || (formData.packetSize > 0 ? returnQty / formData.packetSize : 0);

            // 1. Update Warehouse Stock (Dedicated 'Returned Stock' records)
            if (formData.warehouse && formData.productName) {
                const whResponse = await axios.get(`${API_BASE_URL}/api/warehouses`);
                let allWh = Array.isArray(whResponse.data) ? whResponse.data : [];
                
                const targetWhName = (formData.warehouse || '').trim().toLowerCase();
                const targetProdName = (formData.productName || '').trim().toLowerCase();
                const targetBrand = (formData.brand || '').trim().toLowerCase();

                // If editing, reverse the previous return's stock from its warehouse first
                if (editingId) {
                    const oldReturn = returns.find(r => r._id === editingId);
                    if (oldReturn) {
                        const oldWhName = (oldReturn.warehouse || '').trim().toLowerCase();
                        const oldProdName = (oldReturn.productName || '').trim().toLowerCase();
                        const oldBrand = (oldReturn.brand || '').trim().toLowerCase();
                        const oldQty = parseFloat(oldReturn.quantity) || 0;
                        const oldPkt = parseFloat(oldReturn.bags) || 0;

                        const oldStockEntry = allWh.find(w => {
                            const isRet = (w.location || '').trim().toLowerCase() === 'returned stock' && !w.isTransferLog;
                            const wName = (w.whName || w.name || w.warehouse || '').trim().toLowerCase();
                            const wProd = (w.productName || w.product || '').trim().toLowerCase();
                            const wBrand = (w.brand || '').trim().toLowerCase();
                            return isRet && wName === oldWhName && wProd === oldProdName && (wBrand === oldBrand || (!wBrand && !oldBrand));
                        });

                        if (oldStockEntry) {
                            const currentQty = parseFloat(oldStockEntry.whQty ?? oldStockEntry.inHouseQuantity) || 0;
                            if (currentQty - oldQty <= 0) {
                                await axios.delete(`${API_BASE_URL}/api/warehouses/${oldStockEntry._id}`);
                                allWh = allWh.filter(w => w._id !== oldStockEntry._id);
                            } else {
                                const decrementedWh = {
                                    ...oldStockEntry,
                                    whQty: Math.max(0, (parseFloat(oldStockEntry.whQty) || 0) - oldQty),
                                    whPkt: Math.max(0, (parseFloat(oldStockEntry.whPkt) || 0) - oldPkt),
                                    inHouseQuantity: Math.max(0, (parseFloat(oldStockEntry.inHouseQuantity || oldStockEntry.whQty) || 0) - oldQty),
                                    inHousePacket: Math.max(0, (parseFloat(oldStockEntry.inHousePacket || oldStockEntry.whPkt) || 0) - oldPkt),
                                    recordType: 'warehouse',
                                    isTransferLog: false,
                                    location: 'Returned Stock'
                                };
                                await axios.put(`${API_BASE_URL}/api/warehouses/${oldStockEntry._id}`, decrementedWh);
                                const idx = allWh.findIndex(w => w._id === oldStockEntry._id);
                                if (idx !== -1) allWh[idx] = decrementedWh;
                            }
                        }
                    }
                }

                // Find or create 'Returned Stock' entry in target warehouse
                const existingReturnedStock = allWh.find(w => {
                    const isRet = (w.location || '').trim().toLowerCase() === 'returned stock' && !w.isTransferLog;
                    const wName = (w.whName || w.name || w.warehouse || '').trim().toLowerCase();
                    const wProd = (w.productName || w.product || '').trim().toLowerCase();
                    const wBrand = (w.brand || '').trim().toLowerCase();
                    const wLc = (w.lcNo || '').trim().toLowerCase();
                    const targetLc = (formData.lcNo || '').trim().toLowerCase();
                    return isRet && wName === targetWhName && wProd === targetProdName && (wBrand === targetBrand || (!wBrand && !targetBrand)) && (!targetLc || !wLc || wLc === targetLc);
                });

                if (existingReturnedStock) {
                    const updatedWh = {
                        ...existingReturnedStock,
                        whQty: (parseFloat(existingReturnedStock.whQty) || 0) + returnQty,
                        whPkt: (parseFloat(existingReturnedStock.whPkt) || 0) + returnPkt,
                        inHouseQuantity: (parseFloat(existingReturnedStock.inHouseQuantity || existingReturnedStock.whQty) || 0) + returnQty,
                        inHousePacket: (parseFloat(existingReturnedStock.inHousePacket || existingReturnedStock.whPkt) || 0) + returnPkt,
                        date: formData.date || new Date().toISOString().split('T')[0],
                        recordType: 'warehouse',
                        isTransferLog: false,
                        location: 'Returned Stock'
                    };
                    await axios.put(`${API_BASE_URL}/api/warehouses/${existingReturnedStock._id}`, updatedWh);
                } else {
                    const newWh = {
                        whName: formData.warehouse,
                        warehouse: formData.warehouse,
                        productName: formData.productName,
                        product: formData.productName,
                        brand: formData.brand,
                        lcNo: formData.lcNo || '',
                        whQty: returnQty,
                        whPkt: returnPkt,
                        inHouseQuantity: returnQty,
                        inHousePacket: returnPkt,
                        status: 'Active',
                        manager: '-',
                        location: 'Returned Stock',
                        packetSize: formData.packetSize || 0,
                        recordType: 'warehouse',
                        isTransferLog: false,
                        invoiceNo: formData.invoiceNo || '',
                        date: formData.date || new Date().toISOString().split('T')[0]
                    };
                    await axios.post(`${API_BASE_URL}/api/warehouses`, newWh);
                }
            }

            // 2. Save Return Record
            const dataToSave = {
                ...formData,
                entryBy: editingId ? (formData.entryBy || currentUser?.username || currentUser?.employeeId || currentUser?.name || 'Administrator') : (currentUser?.username || currentUser?.employeeId || currentUser?.name || 'Administrator'),
                entryByName: currentUser?.name || currentUser?.username || 'Administrator'
            };
            if (editingId) {
                await axios.put(`${API_BASE_URL}/api/returns/${editingId}`, dataToSave);
            } else {
                await axios.post(`${API_BASE_URL}/api/returns`, dataToSave);
            }

            // 4. Update Quantity in Original Sale Invoice (Absolute Sync)
            const originalSale = sales.find(s => s.invoiceNo === formData.invoiceNo);
            if (originalSale) {
                // Fetch all returns for this specific invoice to get the absolute truth
                const allReturnsResponse = await axios.get(`${API_BASE_URL}/api/returns`);
                const allReturns = Array.isArray(allReturnsResponse.data) ? allReturnsResponse.data : [];
                const invoiceReturns = allReturns.filter(r => r.invoiceNo === formData.invoiceNo);

                const updatedSale = JSON.parse(JSON.stringify(originalSale));
                let itemModified = false;

                if (updatedSale.items && updatedSale.items.length > 0) {
                    updatedSale.items = updatedSale.items.map(item => {
                        // Calculate total returned for this product across all return records
                        const productReturns = invoiceReturns.filter(r => r.productName === item.productName);
                        
                        if (item.brandEntries && item.brandEntries.length > 0) {
                            item.brandEntries = item.brandEntries.map(be => {
                                const brandName = be.brandName || be.brand;
                                const brandReturns = productReturns.filter(r => (r.brandName || r.brand) === brandName);
                                
                                const totalRetQty = brandReturns.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
                                const totalRetPkt = brandReturns.reduce((sum, r) => sum + (parseFloat(r.bags) || 0), 0);

                                // Purchase Qty = Current Net + Current Return (from DB)
                                // We want to keep Purchase Qty constant. 
                                // Purchase = Original Qty.
                                // If data is corrupted, we might need a fallback.
                                // Let's assume the Purchase Qty is (be.quantity + be.returnQty) IF we haven't fixed it yet.
                                // But wait, if we use the sum of returns, we can just update the be.returnQty.
                                // To fix the corrupted be.quantity, we need the original value.
                                // We can estimate original = be.quantity + (old totalRetQty).
                                
                                // Use user-provided original quantity if available to fix distorted data
                                const trueOriginalQty = parseFloat(formData.originalQuantity) || be.originalQuantity || (parseFloat(be.quantity) || 0) + (parseFloat(be.returnQty) || 0);
                                be.originalQuantity = trueOriginalQty;

                                be.returnQty = totalRetQty;
                                be.returnPkt = totalRetPkt;
                                be.quantity = Math.max(0, be.originalQuantity - totalRetQty);
                                be.packet = Math.max(0, (be.originalPacket || be.originalQuantity / (formData.packetSize || 50)) - totalRetPkt);
                                if (be.bags) be.bags = be.packet;

                                const price = parseFloat(be.unitPrice) || 0;
                                be.totalAmount = (be.quantity * price).toFixed(2);
                                itemModified = true;
                                return be;
                            });
                        } else {
                            // Single item product
                            const totalRetQty = productReturns.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
                            
                            const trueOriginalQty = parseFloat(formData.originalQuantity) || item.originalQuantity || (parseFloat(item.quantity) || 0) + (parseFloat(item.returnQty) || 0);
                            item.originalQuantity = trueOriginalQty;

                            item.returnQty = totalRetQty;
                            item.quantity = Math.max(0, item.originalQuantity - totalRetQty);
                            
                            const price = parseFloat(item.unitPrice || item.rate) || 0;
                            item.totalAmount = (item.quantity * price).toFixed(2);
                            itemModified = true;
                        }
                        return item;
                    });
                    const calcItemTotal = (item) => {
                        if (item.brandEntries && item.brandEntries.length > 0) {
                            return item.brandEntries.reduce((bSum, be) => bSum + (parseFloat(be.totalAmount) || (parseFloat(be.quantity) || 0) * (parseFloat(be.unitPrice || be.rate) || 0)), 0);
                        }
                        return parseFloat(item.totalAmount) || (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice || item.rate) || 0);
                    };
                    updatedSale.totalAmount = updatedSale.items.reduce((sum, item) => sum + calcItemTotal(item), 0).toFixed(2);
                } else {
                    // Legacy format
                    const productReturns = invoiceReturns.filter(r => r.productName === updatedSale.productName);
                    const totalRetQty = productReturns.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
                    
                    if (!updatedSale.originalQuantity) {
                        updatedSale.originalQuantity = (parseFloat(updatedSale.quantity) || 0) + (parseFloat(updatedSale.returnQty) || 0);
                    }
                    
                    updatedSale.returnQty = totalRetQty;
                    updatedSale.quantity = Math.max(0, updatedSale.originalQuantity - totalRetQty);
                    const price = parseFloat(updatedSale.unitPrice || updatedSale.rate) || 0;
                    updatedSale.totalAmount = (updatedSale.quantity * price).toFixed(2);
                    itemModified = true;
                }

                if (itemModified) {
                    const total = parseFloat(updatedSale.totalAmount) || 0;
                    const disc = parseFloat(updatedSale.discount) || 0;
                    const paid = parseFloat(updatedSale.paidAmount) || 0;
                    updatedSale.dueAmount = Math.max(0, total - disc - paid);

                    const { _id, createdAt, updatedAt, __v, ...dataToSend } = updatedSale;
                    await axios.put(`${API_BASE_URL}/api/sales/${originalSale._id}`, dataToSend);
                }
            }

            setShowForm(false);
            setEditingId(null);
            setInvoiceSearch('');
            setWarehouseSearch('');
            setFormData({
                date: new Date().toISOString().split('T')[0],
                invoiceNo: '',
                invoiceDate: '',
                companyName: '',
                phone: '',
                customerName: '',
                productName: '',
                lcNo: '',
                brand: '',
                quantity: '',
                bags: '',
                warehouse: '',
                reason: '',
                returnPrice: '',
                returnExpense: '',
                entryBy: '',
                entryByName: '',
                status: 'Pending',
                packetSize: 0,
                originalQuantity: '',
                purchaseItems: []
            });
            await fetchReturns();
            if (typeof onReturnsUpdated === 'function') {
                onReturnsUpdated();
            }
            if (typeof refreshPendingIndicators === 'function') {
                refreshPendingIndicators();
            }
            window.dispatchEvent(new CustomEvent('returnsUpdated'));
            window.dispatchEvent(new CustomEvent('stockUpdated'));
            window.dispatchEvent(new CustomEvent('warehousesUpdated'));
        } catch (error) {
            console.error('Error saving return:', error);
            showToast('Error saving return record. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (ret) => {
        // Find the original sale to populate purchaseItems if editing
        const originalSale = sales.find(s => s.invoiceNo === ret.invoiceNo);
        let retLcNo = ret.lcNo || '';
        if (!retLcNo) {
            const pItems = originalSale ? (originalSale.items || []) : (ret.purchaseItems || []);
            const matchedItem = pItems.find(i => i.productName === ret.productName);
            if (matchedItem) {
                if (matchedItem.brandEntries && matchedItem.brandEntries.length > 0) {
                    const matchedBe = matchedItem.brandEntries.find(b => (b.brandName || b.brand) === ret.brand);
                    retLcNo = (matchedBe && (matchedBe.lcNo || matchedBe.lcNumber)) || matchedItem.lcNo || '';
                } else {
                    retLcNo = matchedItem.lcNo || '';
                }
            }
            if (!retLcNo && originalSale) retLcNo = originalSale.lcNo || '';
        }
        setFormData({
            ...ret,
            lcNo: retLcNo,
            entryBy: ret.entryBy || '',
            entryByName: ret.entryByName || '',
            returnExpense: ret.returnExpense !== undefined ? ret.returnExpense : '',
            purchaseItems: originalSale ? (originalSale.items || []) : (ret.purchaseItems || [])
        });
        setEditingId(ret._id);
        setInvoiceSearch(ret.invoiceNo);
        setWarehouseSearch(ret.warehouse || '');
        setShowForm(true);
    };

    const handleDelete = (idOrRecord) => {
        if (!canDelete) {
            showToast('Forbidden: You do not have permission to delete return records', 'error');
            return;
        }
        const record = (typeof idOrRecord === 'object' && idOrRecord !== null)
            ? idOrRecord
            : returns.find(r => r._id === idOrRecord);
        if (!record) {
            setDeleteConfirmReturn({ _id: idOrRecord });
        } else {
            setDeleteConfirmReturn(record);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfirmReturn) return;
        setIsDeleting(true);
        try {
            const id = deleteConfirmReturn._id;
            let returnToDelete = returns.find(r => r._id === id) || deleteConfirmReturn;
            if (!returnToDelete || !returnToDelete.quantity) {
                const res = await axios.get(`${API_BASE_URL}/api/returns/${id}`).catch(() => null);
                returnToDelete = res?.data || returnToDelete;
            }
            if (!returnToDelete) {
                setDeleteConfirmReturn(null);
                return;
            }

            const retQty = parseFloat(returnToDelete.quantity) || 0;
            const retPkt = parseFloat(returnToDelete.bags) || 0;
            const targetWhName = (returnToDelete.warehouse || '').trim().toLowerCase();
            const targetProdName = (returnToDelete.productName || '').trim().toLowerCase();
            const targetBrand = (returnToDelete.brand || '').trim().toLowerCase();

            // 1. Reverse Warehouse Stock
            const whResponse = await axios.get(`${API_BASE_URL}/api/warehouses`);
            const allWh = Array.isArray(whResponse.data) ? whResponse.data : [];

            // Check for a warehouse record that was created as "Returned Stock"
            let returnedStockWh = allWh.find(w => {
                const loc = (w.location || '').trim().toLowerCase();
                const isRet = loc === 'returned stock' && !w.isTransferLog;
                const wProd = (w.productName || w.product || '').trim().toLowerCase();
                const wBrand = (w.brand || '').trim().toLowerCase();
                const wName = (w.whName || w.name || w.warehouse || '').trim().toLowerCase();
                return isRet && wProd === targetProdName && (wBrand === targetBrand || !targetBrand || !wBrand) && (!targetWhName || wName === targetWhName);
            });

            if (!returnedStockWh) {
                returnedStockWh = allWh.find(w => {
                    const loc = (w.location || '').trim().toLowerCase();
                    const isRet = loc === 'returned stock' && !w.isTransferLog;
                    const wProd = (w.productName || w.product || '').trim().toLowerCase();
                    const wBrand = (w.brand || '').trim().toLowerCase();
                    return isRet && wProd === targetProdName && (wBrand === targetBrand || !targetBrand || !wBrand);
                });
            }

            if (returnedStockWh) {
                const currentWhQty = parseFloat(returnedStockWh.whQty ?? returnedStockWh.inHouseQuantity) || 0;
                if (currentWhQty - retQty <= 0) {
                    // Completely remove the orphaned / returned stock record!
                    await axios.delete(`${API_BASE_URL}/api/warehouses/${returnedStockWh._id}`);
                } else {
                    const updatedWh = {
                        ...returnedStockWh,
                        whQty: Math.max(0, (parseFloat(returnedStockWh.whQty) || 0) - retQty),
                        whPkt: Math.max(0, (parseFloat(returnedStockWh.whPkt) || 0) - retPkt),
                        inHouseQuantity: Math.max(0, (parseFloat(returnedStockWh.inHouseQuantity || returnedStockWh.whQty) || 0) - retQty),
                        inHousePacket: Math.max(0, (parseFloat(returnedStockWh.inHousePacket || returnedStockWh.whPkt) || 0) - retPkt),
                        recordType: 'warehouse',
                        isTransferLog: false,
                        location: 'Returned Stock'
                    };
                    await axios.put(`${API_BASE_URL}/api/warehouses/${returnedStockWh._id}`, updatedWh);
                }
            }

            // 2. Delete the Return Record
            await axios.delete(`${API_BASE_URL}/api/returns/${id}`);

            // 3. Sync Sale Invoice (Recalculate based on REMAINING returns)
            let originalSale = sales.find(s => s.invoiceNo === returnToDelete.invoiceNo);
            if (!originalSale && returnToDelete.invoiceNo) {
                const salesRes = await axios.get(`${API_BASE_URL}/api/sales`);
                const allSales = Array.isArray(salesRes.data) ? salesRes.data : [];
                originalSale = allSales.find(s => s.invoiceNo === returnToDelete.invoiceNo);
            }

            if (originalSale) {
                // Fetch remaining returns to get new absolute truth
                const allReturnsResponse = await axios.get(`${API_BASE_URL}/api/returns`);
                const remainingReturns = (Array.isArray(allReturnsResponse.data) ? allReturnsResponse.data : [])
                    .filter(r => r.invoiceNo === returnToDelete.invoiceNo && r._id !== id);

                const updatedSale = JSON.parse(JSON.stringify(originalSale));
                let itemModified = false;

                const calcItemTotal = (item) => {
                    if (item.brandEntries && item.brandEntries.length > 0) {
                        return item.brandEntries.reduce((bSum, be) => bSum + (parseFloat(be.totalAmount) || (parseFloat(be.quantity) || 0) * (parseFloat(be.unitPrice || be.rate) || 0)), 0);
                    }
                    return parseFloat(item.totalAmount) || (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice || item.rate) || 0);
                };

                if (updatedSale.items && updatedSale.items.length > 0) {
                    updatedSale.items = updatedSale.items.map(item => {
                        const productReturns = remainingReturns.filter(r => (r.productName || '').trim().toLowerCase() === (item.productName || '').trim().toLowerCase());
                        if (item.brandEntries && item.brandEntries.length > 0) {
                            item.brandEntries = item.brandEntries.map(be => {
                                const brandName = (be.brandName || be.brand || '').trim().toLowerCase();
                                const brandReturns = productReturns.filter(r => (r.brandName || r.brand || '').trim().toLowerCase() === brandName);
                                const totalRetQty = brandReturns.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
                                const totalRetPkt = brandReturns.reduce((sum, r) => sum + (parseFloat(r.bags) || 0), 0);

                                // Use stored original quantity
                                const originalQty = be.originalQuantity || (parseFloat(be.quantity) || 0) + (parseFloat(be.returnQty) || 0);
                                be.originalQuantity = originalQty;
                                be.returnQty = totalRetQty;
                                be.returnPkt = totalRetPkt;
                                be.quantity = Math.max(0, originalQty - totalRetQty);
                                
                                const price = parseFloat(be.unitPrice || be.rate) || 0;
                                be.totalAmount = (be.quantity * price).toFixed(2);
                                itemModified = true;
                                return be;
                            });
                        } else if ((item.productName || '').trim().toLowerCase() === targetProdName) {
                            const totalRetQty = productReturns.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
                            const originalQty = item.originalQuantity || (parseFloat(item.quantity) || 0) + (parseFloat(item.returnQty) || 0);
                            item.originalQuantity = originalQty;
                            item.returnQty = totalRetQty;
                            item.quantity = Math.max(0, originalQty - totalRetQty);
                            item.totalAmount = (item.quantity * (parseFloat(item.unitPrice || item.rate) || 0)).toFixed(2);
                            itemModified = true;
                        }
                        return item;
                    });
                    updatedSale.totalAmount = updatedSale.items.reduce((sum, item) => sum + calcItemTotal(item), 0).toFixed(2);
                } else {
                    // Legacy format
                    const productReturns = remainingReturns.filter(r => (r.productName || '').trim().toLowerCase() === (updatedSale.productName || '').trim().toLowerCase());
                    const totalRetQty = productReturns.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
                    
                    if (!updatedSale.originalQuantity) {
                        updatedSale.originalQuantity = (parseFloat(updatedSale.quantity) || 0) + (parseFloat(updatedSale.returnQty) || 0);
                    }
                    
                    updatedSale.returnQty = totalRetQty;
                    updatedSale.quantity = Math.max(0, updatedSale.originalQuantity - totalRetQty);
                    const price = parseFloat(updatedSale.unitPrice || updatedSale.rate) || 0;
                    updatedSale.totalAmount = (updatedSale.quantity * price).toFixed(2);
                    itemModified = true;
                }

                if (itemModified) {
                    const total = parseFloat(updatedSale.totalAmount) || 0;
                    const disc = parseFloat(updatedSale.discount) || 0;
                    const paid = parseFloat(updatedSale.paidAmount) || 0;
                    updatedSale.dueAmount = Math.max(0, total - disc - paid);
                    const { _id, createdAt, updatedAt, __v, ...dataToSend } = updatedSale;
                    await axios.put(`${API_BASE_URL}/api/sales/${originalSale._id}`, dataToSend);
                }
            }

            setDeleteConfirmReturn(null);
            await fetchReturns();
            showToast('Return record deleted successfully.', 'success');
            if (typeof onReturnsUpdated === 'function') {
                onReturnsUpdated();
            }
            if (typeof refreshPendingIndicators === 'function') {
                refreshPendingIndicators();
            }
            window.dispatchEvent(new CustomEvent('returnsUpdated'));
            window.dispatchEvent(new CustomEvent('stockUpdated'));
            window.dispatchEvent(new CustomEvent('warehousesUpdated'));
        } catch (error) {
            console.error('Error deleting return:', error);
            showToast('Error deleting return record. Please try again.', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredReturns = returns.filter(ret =>
        (ret.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ret.productName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ret.lcNo || getReturnLcNo(ret) || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ret.invoiceNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ret.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ret.brand || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ret.warehouse || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ret.entryBy || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ret.entryByName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        getEntryByFirstName(ret).toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredSales = sales.filter(sale =>
        ((sale.saleType || '').toLowerCase() === 'general' || (sale.invoiceNo || '').startsWith('GS')) &&
        (sale.invoiceNo || '').toLowerCase().includes(invoiceSearch.toLowerCase())
    ).slice(0, 5); // Limit to 5 results for better UX

    const handleInvoiceSelect = (sale) => {
        // Get the first product name if items exist
        let prodName = '';
        const items = sale.items || [];

        if (items.length > 0) {
            prodName = items[0].productName;
        } else if (sale.productName) {
            prodName = sale.productName;
            // Fallback for legacy records
            items.push({
                productName: sale.productName,
                quantity: sale.quantity,
                unitPrice: sale.rate || sale.unitPrice || '-'
            });
        }

        let defaultWh = sale.port || '';
        let defaultLcNo = sale.lcNo || sale.lcNumber || '';
        if (items.length > 0) {
            const firstItem = items[0];
            if (firstItem.brandEntries && firstItem.brandEntries.length > 0) {
                defaultWh = firstItem.brandEntries[0].warehouseName || firstItem.brandEntries[0].warehouse || defaultWh;
                defaultLcNo = firstItem.brandEntries[0].lcNo || firstItem.brandEntries[0].lcNumber || firstItem.lcNo || defaultLcNo;
            } else {
                defaultWh = firstItem.warehouseName || firstItem.warehouse || defaultWh;
                defaultLcNo = firstItem.lcNo || defaultLcNo;
            }
        }

        setFormData(prev => ({
            ...prev,
            invoiceNo: sale.invoiceNo,
            invoiceDate: sale.date || '',
            companyName: sale.companyName || '',
            phone: sale.contact || sale.phone || '',
            customerName: sale.customerName || sale.companyName || '',
            customerId: sale.customerId || '',
            productName: prodName,
            lcNo: defaultLcNo || prev.lcNo || '',
            purchaseItems: items,
            warehouse: defaultWh || prev.warehouse || ''
        }));
        setInvoiceSearch(sale.invoiceNo);
        if (defaultWh) setWarehouseSearch(defaultWh);
        setShowInvoiceDropdown(false);
        setHighlightedInvoiceIndex(-1);
    };

    const isAdmin = currentUser?.username === 'admin' || (currentUser?.role || '').toLowerCase() === 'admin';
    const isIncharge = (currentUser?.role || '').toLowerCase() === 'incharge';
    const isSalesManager = (currentUser?.role || '').toLowerCase() === 'sales manager';
    const isDataEntry = (currentUser?.role || '').toLowerCase() === 'data entry';
    const canAdd = hasPermission(currentUser, 'returnProduct', 'add');
    const canEdit = hasPermission(currentUser, 'returnProduct', 'edit');
    const canDelete = hasPermission(currentUser, 'returnProduct', 'delete');
    const canManage = canAdd || canEdit || canDelete;

    return (
        <div className="return-product-container">
            {!showForm && (
                <div className="return-product-header flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="w-full md:w-1/4 text-center md:text-left">
                        <h2 className="return-product-title" style={{ margin: 0 }}>Return Product</h2>
                    </div>

                    <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                        <div className="absolute inset-y-0 left-0 pl-5 md:pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-12 md:pl-10 pr-4 py-2.5 md:py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] md:text-[13px] text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none shadow-sm"
                            placeholder="Search by customer, product, invoice..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {canManage && (
                    <div className="w-full md:w-1/4 flex justify-end z-10">
                        <button
                            onClick={() => {
                                setShowForm(true);
                                setEditingId(null);
                                setInvoiceSearch('');
                                setFormData({
                                    date: new Date().toISOString().split('T')[0],
                                    invoiceNo: '',
                                    customerName: '',
                                    productName: '',
                                    lcNo: '',
                                    brand: '',
                                    quantity: '',
                                    returnPrice: '',
                                    returnExpense: '',
                                    reason: '',
                                    status: 'Pending',
                                    originalQuantity: '',
                                    purchaseItems: []
                                });
                            }}
                            className="w-full md:w-auto return-product-add-btn whitespace-nowrap"
                        >
                            <span className="return-product-add-icon">+</span> Add New
                        </button>
                    </div>
                    )}
                </div>
            )}

            {showForm ? (
                <div className="return-product-form-container animate-in">

                    <div className="return-product-form-header">
                        <h3 className="return-product-form-title">
                            {editingId ? 'Edit Return Entry' : 'New Return Entry'}
                        </h3>
                        <button
                            onClick={() => { setShowForm(false); setEditingId(null); }}
                            className="return-product-form-close"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="return-product-form">
                        <div className="return-product-form-field">
                            <label className="return-product-form-label">Return Date</label>
                            <CustomDatePicker
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required={true}
                            />
                        </div>

                        <div className="return-product-form-field relative" ref={invoiceDropdownRef}>
                            <label className="return-product-form-label">Original Invoice No</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="return-product-form-input"
                                    placeholder="Search invoice (e.g. GS0001)"
                                    value={invoiceSearch}
                                    onChange={(e) => {
                                        setInvoiceSearch(e.target.value);
                                        setShowInvoiceDropdown(true);
                                        setFormData({ ...formData, invoiceNo: e.target.value });
                                        setHighlightedInvoiceIndex(-1);
                                    }}
                                    onFocus={() => {
                                        setHighlightedInvoiceIndex(-1);
                                        if (invoiceSearch.length > 0) setShowInvoiceDropdown(true);
                                    }}
                                    onKeyDown={handleInvoiceKeyDown}
                                    required
                                    autoComplete="off"
                                />
                                {showInvoiceDropdown && invoiceSearch.length > 0 && filteredSales.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 max-h-48 overflow-y-auto">
                                        {filteredSales.map((sale, idx) => (
                                            <div
                                                key={sale._id}
                                                className={`px-4 py-2 cursor-pointer transition-colors border-b border-gray-50 last:border-0 ${highlightedInvoiceIndex === idx ? 'bg-blue-50' : 'hover:bg-blue-50'}`}
                                                onClick={() => handleInvoiceSelect(sale)}
                                                onMouseEnter={() => setHighlightedInvoiceIndex(idx)}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-sm text-blue-600">{sale.invoiceNo}</span>
                                                    <span className="text-[10px] text-gray-400">{sale.date}</span>
                                                </div>
                                                <div className="text-xs text-gray-600 truncate">{sale.customerName || sale.companyName}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="return-product-form-field">
                            <label className="return-product-form-label">Invoice Date</label>
                            <input
                                type="text"
                                className="return-product-form-input"
                                placeholder="Auto-filled from invoice"
                                value={formData.invoiceDate}
                                onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                                required
                            />
                        </div>

                        <div className="return-product-form-field">
                            <label className="return-product-form-label">Company Name</label>
                            <input
                                type="text"
                                className="return-product-form-input"
                                placeholder="Auto-filled from invoice"
                                value={formData.companyName}
                                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                required
                            />
                        </div>

                        <div className="return-product-form-field">
                            <label className="return-product-form-label">Phone No</label>
                            <input
                                type="text"
                                className="return-product-form-input"
                                placeholder="Auto-filled from invoice"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                required
                            />
                        </div>

                        <div className="return-product-form-field">
                            <label className="return-product-form-label">Customer Name</label>
                            <input
                                type="text"
                                className="return-product-form-input"
                                placeholder="Auto-filled from invoice"
                                value={formData.customerName}
                                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                required
                            />
                        </div>

                        {formData.purchaseItems && formData.purchaseItems.length > 0 && (
                            <div className="return-product-form-field-full mt-2">
                                <label className="return-product-form-label mb-3 flex items-center gap-2">
                                    <BoxIcon className="w-4 h-4 text-blue-500" />
                                    Purchased Products in this Invoice
                                </label>
                                <div className="purchase-items-preview-container">
                                    <table className="purchase-items-preview-table">
                                        <thead>
                                            <tr>
                                                <th>Product</th>
                                                <th>LC No</th>
                                                <th>Brand</th>
                                                <th className="text-center">Qty</th>
                                                <th className="text-right">Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {formData.purchaseItems.map((item, idx) => (
                                                <React.Fragment key={idx}>
                                                    {item.brandEntries && item.brandEntries.length > 0 ? (
                                                        item.brandEntries.map((be, beIdx) => {
                                                            const beWh = be.warehouseName || be.warehouse || item.warehouseName || item.warehouse || '';
                                                            const rowLcNo = be.lcNo || be.lcNumber || item.lcNo || item.lcNumber || '';
                                                            return (
                                                                <tr key={`${idx}-${beIdx}`} className="cursor-pointer hover:bg-blue-50/50" onClick={() => {
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        productName: item.productName,
                                                                        lcNo: rowLcNo,
                                                                        brand: be.brand || be.brandName || '',
                                                                        quantity: '',
                                                                        returnPrice: be.unitPrice || 0,
                                                                        originalQuantity: parseFloat(be.quantity || 0) + (parseFloat(be.returnQty) || 0),
                                                                        packetSize: parseFloat(be.packetSize || item.packetSize || be.bagSize || item.bagSize || 50),
                                                                        warehouse: beWh || prev.warehouse || ''
                                                                    }));
                                                                    if (beWh) setWarehouseSearch(beWh);
                                                                }}>
                                                                    <td>{item.productName}</td>
                                                                    <td className="font-semibold text-gray-700">{rowLcNo || '-'}</td>
                                                                    <td>{be.brandName || be.brand}</td>
                                                                    <td className="text-center font-bold text-blue-600">{parseFloat(be.quantity || 0) + (parseFloat(be.returnQty) || 0)}</td>
                                                                    <td className="text-right">৳ {parseFloat(be.unitPrice || 0).toLocaleString()}</td>
                                                                </tr>
                                                            );
                                                        })
                                                    ) : (
                                                        (() => {
                                                            const itemWh = item.warehouseName || item.warehouse || '';
                                                            const rowLcNo = item.lcNo || item.lcNumber || '';
                                                            return (
                                                                <tr className="cursor-pointer hover:bg-blue-50/50" onClick={() => {
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        productName: item.productName,
                                                                        lcNo: rowLcNo,
                                                                        brand: '-',
                                                                        quantity: '',
                                                                        returnPrice: item.unitPrice || item.rate || 0,
                                                                        originalQuantity: parseFloat(item.quantity || 0) + (parseFloat(item.returnQty) || 0),
                                                                        packetSize: parseFloat(item.packetSize || item.bagSize || 50),
                                                                        warehouse: itemWh || prev.warehouse || ''
                                                                    }));
                                                                    if (itemWh) setWarehouseSearch(itemWh);
                                                                }}>
                                                                    <td>{item.productName}</td>
                                                                    <td className="font-semibold text-gray-700">{rowLcNo || '-'}</td>
                                                                    <td>-</td>
                                                                    <td className="text-center font-bold text-blue-600">{parseFloat(item.quantity || 0) + (parseFloat(item.returnQty) || 0)}</td>
                                                                    <td className="text-right">৳ {parseFloat(item.unitPrice || 0).toLocaleString()}</td>
                                                                </tr>
                                                            );
                                                        })()
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                    <p className="text-[10px] text-gray-400 mt-2 px-1">* Click on a row to auto-fill the return details below</p>
                                </div>
                            </div>
                        )}

                        <div className="return-product-form-field-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
                            <div className="return-product-form-field">
                                <label className="return-product-form-label">Product Name</label>
                                <input
                                    type="text"
                                    className="return-product-form-input"
                                    placeholder="Auto-filled"
                                    value={formData.productName}
                                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="return-product-form-field">
                                <label className="return-product-form-label">LC No</label>
                                <input
                                    type="text"
                                    className="return-product-form-input"
                                    placeholder="Auto-filled"
                                    value={formData.lcNo || ''}
                                    onChange={(e) => setFormData({ ...formData, lcNo: e.target.value })}
                                />
                            </div>

                            <div className="return-product-form-field">
                                <label className="return-product-form-label">Brand</label>
                                <input
                                    type="text"
                                    className="return-product-form-input"
                                    placeholder="Auto-filled"
                                    value={formData.brand}
                                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="return-product-form-field">
                                <label className="return-product-form-label">Return Quantity</label>
                                <input
                                    type="number"
                                    className="return-product-form-input"
                                    placeholder="Enter qty"
                                    value={formData.quantity}
                                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="return-product-form-field">
                                <label className="return-product-form-label">Return Bags</label>
                                <input
                                    type="number"
                                    className="return-product-form-input"
                                    placeholder="Bags"
                                    value={formData.bags}
                                    onChange={(e) => setFormData({ ...formData, bags: e.target.value })}
                                />
                            </div>

                            <div className="return-product-form-field">
                                <label className="return-product-form-label">Return Price</label>
                                <input
                                    type="number"
                                    className="return-product-form-input"
                                    placeholder="Price"
                                    value={formData.returnPrice}
                                    onChange={(e) => setFormData({ ...formData, returnPrice: e.target.value })}
                                />
                            </div>

                            <div className="return-product-form-field">
                                <label className="return-product-form-label">Return Expense</label>
                                <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    className="return-product-form-input"
                                    placeholder="Expense (৳)"
                                    value={formData.returnExpense}
                                    onChange={(e) => setFormData({ ...formData, returnExpense: e.target.value })}
                                />
                            </div>

                            <div className="return-product-form-field" ref={warehouseRef}>
                                <label className="return-product-form-label">Warehouse</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        className="return-product-form-input pr-10"
                                        placeholder="Search..."
                                        value={warehouseSearch}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setWarehouseSearch(val);
                                            setFormData(prev => ({ ...prev, warehouse: val }));
                                            setShowWarehouseDropdown(true);
                                            setHighlightedWarehouseIndex(-1);
                                        }}
                                        onFocus={() => {
                                            setShowWarehouseDropdown(true);
                                            setHighlightedWarehouseIndex(-1);
                                        }}
                                        onKeyDown={handleWarehouseKeyDown}
                                        required
                                        autoComplete="off"
                                    />
                                    <div 
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer p-1"
                                        onClick={() => setShowWarehouseDropdown(prev => !prev)}
                                    >
                                        <ChevronDownIcon className={`transition-transform duration-200 ${showWarehouseDropdown ? 'rotate-180' : ''} w-4 h-4`} />
                                    </div>

                                    {showWarehouseDropdown && filteredWarehouses.length > 0 && (
                                        <div className="invoice-dropdown-list">
                                            {filteredWarehouses.map((w, idx) => (
                                                <div
                                                    key={w._id}
                                                    className={`invoice-dropdown-item ${highlightedWarehouseIndex === idx ? 'bg-blue-50' : ''}`}
                                                    onClick={() => {
                                                        const selectedName = w.whName || w.name || w.warehouse;
                                                        setFormData(prev => ({ ...prev, warehouse: selectedName }));
                                                        setWarehouseSearch(selectedName);
                                                        setShowWarehouseDropdown(false);
                                                        setHighlightedWarehouseIndex(-1);
                                                    }}
                                                    onMouseEnter={() => setHighlightedWarehouseIndex(idx)}
                                                >
                                                    <div className="text-sm font-semibold text-gray-700">{w.whName || w.name || w.warehouse}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>


                        <div className="return-product-form-field return-product-form-field-full">
                            <label className="return-product-form-label">Reason for Return</label>
                            <textarea
                                className="return-product-form-textarea"
                                placeholder="Describe the reason for return..."
                                rows="3"
                                value={formData.reason}
                                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            ></textarea>
                        </div>

                        <div className="return-product-form-footer">
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); setEditingId(null); }}
                                className="return-product-form-cancel"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`return-product-form-submit ${isSubmitting ? 'disabled' : ''}`}
                            >
                                {isSubmitting ? 'Saving...' : editingId ? 'Update Record' : 'Save Record'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block return-product-table-container">
                        <div className="return-product-table-wrapper">
                            <table className="return-product-table">
                                <thead>
                                    <tr className="return-product-table-header-row">
                                        <th className="return-product-table-header">Date</th>
                                        <th className="return-product-table-header">Invoice No</th>
                                        <th className="return-product-table-header">Company Name</th>
                                        <th className="return-product-table-header">Product</th>
                                        <th className="return-product-table-header">LC No</th>
                                        <th className="return-product-table-header">Brand</th>
                                        <th className="return-product-table-header text-center">Quantity</th>
                                        <th className="return-product-table-header text-center">Bags</th>
                                        <th className="return-product-table-header text-right">Return Price</th>
                                        <th className="return-product-table-header text-right">Return Expense</th>
                                        <th className="return-product-table-header text-center whitespace-nowrap">Entry By</th>
                                        {canManage && <th className="return-product-table-header text-right">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredReturns.map((ret) => (
                                        <tr key={ret._id} className="return-product-table-row">
                                            <td className="return-product-table-cell whitespace-nowrap">{ret.date}</td>
                                            <td className="return-product-table-cell">
                                                <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-600 w-fit">
                                                    {ret.invoiceNo}
                                                </span>
                                            </td>
                                            <td className="return-product-table-cell font-bold text-gray-900">{ret.companyName}</td>
                                            <td className="return-product-table-cell font-bold text-gray-900">{ret.productName}</td>
                                            <td className="return-product-table-cell font-semibold text-gray-700 text-xs">{getReturnLcNo(ret)}</td>
                                            <td className="return-product-table-cell text-purple-600 font-bold text-[11px]">{ret.brand !== '-' ? ret.brand : ''}</td>
                                            <td className="return-product-table-cell text-center font-bold">{ret.quantity}</td>
                                            <td className="return-product-table-cell text-center font-bold">{ret.bags || '-'}</td>
                                            <td className="return-product-table-cell text-right font-bold text-emerald-600">
                                                {(() => {
                                                    let rate = parseFloat(ret.returnPrice || ret.unitPrice || ret.rate) || 0;
                                                    if (!rate) {
                                                        // Fallback: Try to find rate from original sale if not saved in return record
                                                        const originalSale = sales.find(s => s.invoiceNo === ret.invoiceNo);
                                                        if (originalSale && originalSale.items) {
                                                            const item = originalSale.items.find(i => i.productName === ret.productName);
                                                            if (item) {
                                                                if (item.brandEntries && item.brandEntries.length > 0) {
                                                                    const be = item.brandEntries.find(b => (b.brandName || b.brand) === ret.brand);
                                                                    if (be) rate = parseFloat(be.unitPrice || be.rate) || 0;
                                                                } else {
                                                                    rate = parseFloat(item.unitPrice || item.rate) || 0;
                                                                }
                                                            }
                                                        } else if (originalSale) {
                                                            rate = parseFloat(originalSale.rate || originalSale.unitPrice) || 0;
                                                        }
                                                    }
                                                    
                                                    const qty = parseFloat(ret.quantity) || 0;
                                                    return rate > 0 ? `৳ ${(rate * qty).toLocaleString()}` : '-';
                                                })()}
                                            </td>
                                            <td className="return-product-table-cell text-right font-bold text-rose-600">
                                                {parseFloat(ret.returnExpense || 0) > 0 ? `৳ ${parseFloat(ret.returnExpense).toLocaleString()}` : '-'}
                                            </td>
                                            <td className="return-product-table-cell text-center font-bold text-gray-700 whitespace-nowrap text-xs">
                                                {getEntryByFirstName(ret)}
                                            </td>
                                            {canManage && (
                                            <td className="return-product-table-cell">
                                                <div className="return-product-table-actions justify-end">
                                                    {canEdit && (
                                                        <button
                                                            onClick={() => handleEdit(ret)}
                                                            className="return-product-action-btn return-product-action-edit"
                                                        >
                                                            <EditIcon className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                    {canDelete && (
                                                        <button
                                                            onClick={() => handleDelete(ret)}
                                                            className="return-product-action-btn return-product-action-delete"
                                                        >
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            )}
                                        </tr>
                                    ))}
                                    {filteredReturns.length === 0 && (
                                        <tr>
                                            <td colSpan={(canManage) ? 12 : 11} className="py-20 text-center text-gray-400">
                                                <RotateCcwIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                                <p className="text-sm">No return records found</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Card List */}
                    <div className="block md:hidden px-2 py-3 space-y-3">
                        {filteredReturns.map((ret) => {
                            const isExpanded = expandedReturnId === ret._id;
                            return (
                                <div
                                    key={ret._id}
                                    className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'ring-1 ring-blue-50 shadow-md border-blue-200' : 'border-gray-100 shadow-sm'}`}
                                    onClick={() => setExpandedReturnId(isExpanded ? null : ret._id)}
                                >
                                    <div className="flex justify-between items-center p-4">
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-900 text-sm truncate uppercase tracking-tight">{ret.companyName || ret.customerName}</p>
                                            <p className="text-[10px] font-bold text-blue-600 mt-0.5 tracking-wider uppercase opacity-80">{ret.invoiceNo}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`return-product-status-badge ${ret.status.toLowerCase()} text-[10px] py-0.5 px-2`}>
                                                {ret.status}
                                            </span>
                                            <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}>
                                                {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                                            <div className="space-y-2.5 pt-3 border-t border-gray-50">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Date</span>
                                                    <span className="text-gray-900 font-black">{ret.date}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Invoice Info</span>
                                                    <span className="text-gray-900 font-black text-right">{ret.invoiceNo} ({ret.invoiceDate})</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Company / Phone</span>
                                                    <span className="text-gray-900 font-black text-right">{ret.companyName} <br /> <span className="text-[10px] opacity-60">{ret.phone}</span></span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Customer</span>
                                                    <span className="text-gray-900 font-black">{ret.customerName}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Product</span>
                                                    <span className="text-gray-900 font-black">{ret.productName}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">LC No</span>
                                                    <span className="text-gray-900 font-black">{getReturnLcNo(ret)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Quantity</span>
                                                    <span className="text-gray-900 font-black font-mono">{ret.quantity}</span>
                                                </div>
                                                {parseFloat(ret.returnExpense || 0) > 0 && (
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-rose-500 font-bold uppercase tracking-widest text-[9px]">Return Expense</span>
                                                        <span className="text-rose-600 font-black">৳ {parseFloat(ret.returnExpense).toLocaleString()}</span>
                                                    </div>
                                                )}
                                                {ret.reason && (
                                                    <div className="flex justify-between items-start text-xs pt-1">
                                                        <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px] shrink-0">Reason</span>
                                                        <span className="text-gray-900 font-black text-right max-w-[65%] line-clamp-2">{ret.reason}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Entry By</span>
                                                    <span className="text-gray-900 font-black">{getEntryByFirstName(ret)}</span>
                                                </div>
                                            </div>

                                            {canManage && (
                                            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                                                {canEdit && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEdit(ret); }}
                                                        className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-50 text-blue-700 rounded-xl text-xs font-black flex-1 hover:bg-blue-100 transition-all active:scale-95"
                                                    >
                                                        <EditIcon className="w-4 h-4" /> Edit
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(ret); }}
                                                        className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all active:scale-95"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Standard Delete Confirmation Modal */}
            {deleteConfirmReturn && typeof document !== 'undefined' && document.body && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div
                        className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
                        onClick={() => !isDeleting && setDeleteConfirmReturn(null)}
                    />
                    <div className="relative bg-white/80 backdrop-blur-2xl border border-white/50 rounded-2xl shadow-2xl p-8 max-w-md w-full animate-in zoom-in duration-300">
                        <div className="flex items-center justify-center w-16 h-16 bg-red-100/50 rounded-full mx-auto mb-6">
                            <TrashIcon className="w-8 h-8 text-red-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Delete Confirmation</h3>
                        <p className="text-gray-600 text-center mb-8">
                            Are you sure you want to delete this record? This action cannot be undone.
                        </p>
                        <div className="flex space-x-4">
                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => setDeleteConfirmReturn(null)}
                                className="flex-1 px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={handleConfirmDelete}
                                className="flex-1 px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl shadow-lg shadow-red-500/30 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isDeleting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Deleting...</span>
                                    </>
                                ) : (
                                    <span>Confirm Delete</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Notification Toast */}
            {toast && typeof document !== 'undefined' && document.body && createPortal(
                <div className={`fixed top-4 right-4 z-[99999] px-4 py-3 rounded-xl shadow-xl border text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200 flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-50/95 border-red-200 text-red-700 shadow-red-500/10' : 'bg-emerald-50/95 border-emerald-200 text-emerald-700 shadow-emerald-500/10'}`}>
                    <span>{toast.message}</span>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ReturnProduct;
