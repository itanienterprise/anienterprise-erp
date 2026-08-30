import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SearchIcon, XIcon, ChevronDownIcon, TrashIcon, EyeIcon, RotateCcwIcon, PrinterIcon, PlusIcon, FileTextIcon, HomeIcon, BoxIcon, EditIcon, CheckIcon } from '../../Icons';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import CustomDatePicker from '../../shared/CustomDatePicker';
import { hasPermission } from '../../../utils/permissionHelper';
import { encryptData, decryptData } from '../../../utils/encryption';
import { calculateStockData, isLcMatch } from '../../../utils/stockHelpers';

const TransferManagement = ({ currentUser, addNotification, highlightId, isRequestedNotif }) => {
    const canDelete = hasPermission(currentUser, 'warehouse', 'delete') || hasPermission(currentUser, 'transfer', 'delete');
    const canTransfer = hasPermission(currentUser, 'stock', 'special') || hasPermission(currentUser, 'transfer', 'add') || hasPermission(currentUser, 'warehouse', 'edit');
    const canApprove = hasPermission(currentUser, 'transfer', 'approve') || hasPermission(currentUser, 'warehouse', 'approve') || currentUser?.username === 'admin' || (currentUser?.role || '').toLowerCase() === 'admin';

    // States
    const [warehouseData, setWarehouseData] = useState([]);
    const [stockRecords, setStockRecords] = useState([]);
    const [salesRecords, setSalesRecords] = useState([]);
    const [damagesRecords, setDamagesRecords] = useState([]);
    const [products, setProducts] = useState([]);
    const [transferLogs, setTransferLogs] = useState([]);
    const [activeBaseline, setActiveBaseline] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isRequestedOnly, setIsRequestedOnly] = useState(false);
    const [viewingTransfer, setViewingTransfer] = useState(null);

    const rowRefs = useRef({});

    useEffect(() => {
        if (!highlightId) return;

        const cleanH = String(highlightId).toLowerCase().trim();
        const targetItem = (transferLogs || []).find(t => 
            String(t._id) === cleanH ||
            (t.truckNo && String(t.truckNo).toLowerCase().trim() === cleanH) ||
            (t.gatePassNo && String(t.gatePassNo).toLowerCase().trim() === cleanH) ||
            (t.lcNo && String(t.lcNo).toLowerCase().trim() === cleanH)
        );

        if (targetItem) {
            const isReq = (targetItem.status || '').toLowerCase() === 'requested';
            setIsRequestedOnly(isReq);
        } else if (isRequestedNotif) {
            setIsRequestedOnly(true);
        } else {
            setIsRequestedOnly(false);
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
    }, [highlightId, transferLogs]);

    const requestedCount = useMemo(() => (transferLogs || []).filter(t => t.status === 'Requested').length, [transferLogs]);

    // Form Data State
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        fromWh: '',
        toWh: '',
        manager: '',
        toManager: '',
        truckNo: '',
        gatePassNo: '',
        remarks: '',
        productName: '',
        brand: '',
        lcNo: '',
        transferPkt: '',
        transferQty: '',
        packetSize: '30'
    });

    // Auto-complete Dropdowns State
    const [activeDropdown, setActiveDropdown] = useState(null); // 'fromWh', 'toWh', 'product', 'brand', 'lcNo'
    const fromWhRef = useRef(null);
    const toWhRef = useRef(null);
    const productRef = useRef(null);
    const brandRef = useRef(null);
    const lcRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (activeDropdown === 'fromWh' && fromWhRef.current && !fromWhRef.current.contains(event.target)) setActiveDropdown(null);
            if (activeDropdown === 'toWh' && toWhRef.current && !toWhRef.current.contains(event.target)) setActiveDropdown(null);
            if (activeDropdown === 'product' && productRef.current && !productRef.current.contains(event.target)) setActiveDropdown(null);
            if (activeDropdown === 'brand' && brandRef.current && !brandRef.current.contains(event.target)) setActiveDropdown(null);
            if (activeDropdown === 'lcNo' && lcRef.current && !lcRef.current.contains(event.target)) setActiveDropdown(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown]);

    // Fetch and Decrypt Data
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [whRes, stockRes, prodRes, salesRes, damagesRes, baselineRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/warehouses`),
                axios.get(`${API_BASE_URL}/api/stock`),
                axios.get(`${API_BASE_URL}/api/products`),
                axios.get(`${API_BASE_URL}/api/sales`),
                axios.get(`${API_BASE_URL}/api/damages`),
                axios.get(`${API_BASE_URL}/api/stock-baseline/active`).catch(() => ({ data: null }))
            ]);

            setActiveBaseline(baselineRes.data || null);

            const rawWh = Array.isArray(whRes.data) ? whRes.data : [];
            const logs = [];
            const allDecryptedWh = [];

            rawWh.forEach(item => {
                try {
                    let decrypted = item.data ? decryptData(item.data) : item;
                    if (typeof decrypted === 'string') {
                        try { decrypted = decryptData(decrypted); } catch (e) { }
                    }
                    if (decrypted && typeof decrypted === 'object' && decrypted.data && typeof decrypted.data === 'string') {
                        try { decrypted = decryptData(decrypted.data); } catch (e) { }
                    }
                    if (!decrypted || typeof decrypted !== 'object') decrypted = item;

                    const record = {
                        ...decrypted,
                        _id: item._id,
                        createdAt: item.createdAt,
                        updatedAt: item.updatedAt
                    };

                    if (decrypted.isTransferLog || (parseFloat(decrypted.transferQty) > 0 || parseFloat(decrypted.transferPkt) > 0)) {
                        logs.push({
                            ...record,
                            date: decrypted.date || item.createdAt || new Date().toISOString()
                        });
                    }
                    allDecryptedWh.push(record);
                } catch (e) {
                    console.error('Error decrypting record:', e);
                }
            });

            // Decrypt stock records
            const rawStock = Array.isArray(stockRes.data) ? stockRes.data : [];
            const decryptedStock = rawStock.map(item => {
                let dec = item.data ? decryptData(item.data) : item;
                if (typeof dec === 'string') {
                    try { dec = decryptData(dec); } catch (e) { }
                }
                return { ...dec, _id: item._id };
            });

            // Decrypt sales records
            const rawSales = Array.isArray(salesRes.data) ? salesRes.data : [];
            const decryptedSales = rawSales.map(item => {
                let dec = item.data ? decryptData(item.data) : item;
                if (typeof dec === 'string') {
                    try { dec = decryptData(dec); } catch (e) { }
                }
                if (dec && typeof dec === 'object' && dec.data && typeof dec.data === 'string') {
                    try { dec = decryptData(dec.data); } catch (e) { }
                }
                return { ...dec, _id: item._id, saleType: dec.saleType || item.saleType, invoiceNo: dec.invoiceNo || item.invoiceNo };
            });

            // Decrypt damages records
            const rawDamages = Array.isArray(damagesRes?.data) ? damagesRes.data : [];
            const decryptedDamages = rawDamages.map(item => {
                let dec = item.data ? decryptData(item.data) : item;
                if (typeof dec === 'string') {
                    try { dec = decryptData(dec); } catch (e) { }
                }
                return { ...dec, _id: item._id };
            });

            setWarehouseData(allDecryptedWh);
            setStockRecords(decryptedStock);
            setSalesRecords(decryptedSales);
            setDamagesRecords(decryptedDamages);
            setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);

            // Sort logs: Requested items first, then date/createdAt desc
            logs.sort((a, b) => {
                const aReq = a.status === 'Requested';
                const bReq = b.status === 'Requested';
                if (aReq && !bReq) return -1;
                if (!aReq && bReq) return 1;
                return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
            });
            setTransferLogs(logs);

        } catch (err) {
            console.error('Error loading transfer data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Extract unique warehouses
    const uniqueWarehouses = useMemo(() => {
        const whSet = new Set();
        (warehouseData || []).forEach(w => {
            const name = (w.name || w.whName || w.warehouse || w.fromWh || w.toWh || '').trim();
            if (name && name !== 'Inventory Adjustment') whSet.add(name);
        });
        (stockRecords || []).forEach(s => {
            const name = (s.name || s.whName || s.warehouse || '').trim();
            if (name && name !== 'Inventory Adjustment') whSet.add(name);
        });
        return Array.from(whSet).sort();
    }, [warehouseData, stockRecords]);

    // Calculate source warehouse stock breakdown using centralized stock calculation
    const sourceWarehouseStock = useMemo(() => {
        const sourceWh = (formData.fromWh || '').trim();
        if (!sourceWh) return [];

        const res = calculateStockData(
            stockRecords,
            { warehouse: sourceWh, reportType: 'price' },
            '',
            warehouseData,
            salesRecords,
            products,
            damagesRecords,
            activeBaseline
        );

        return res?.displayRecords || [];
    }, [formData.fromWh, stockRecords, warehouseData, salesRecords, products, damagesRecords, activeBaseline]);

    // Available Products for Form
    const availableFormProducts = useMemo(() => {
        if (!formData.fromWh) {
            return (products || []).map(p => p.name || p.productName).filter(Boolean).sort();
        }

        const prodSet = new Set();
        (sourceWarehouseStock || []).forEach(prod => {
            const hasStock = (prod.brandList || []).some(b => (b.inHouseQuantity || 0) > 0.001 || (b.inHousePacket || 0) > 0.001);
            if (hasStock && prod.productName) {
                prodSet.add(prod.productName.trim());
            }
        });

        if (prodSet.size === 0) {
            (products || []).forEach(p => {
                if (p.name || p.productName) prodSet.add(p.name || p.productName);
            });
        }

        return Array.from(prodSet).sort();
    }, [formData.fromWh, sourceWarehouseStock, products]);

    // Available Brands for Form
    const availableFormBrands = useMemo(() => {
        const targetProd = (formData.productName || '').trim().toLowerCase();
        if (!targetProd) return [];

        const brandMap = {};
        const matchedProd = (sourceWarehouseStock || []).find(p => (p.productName || '').trim().toLowerCase() === targetProd);

        if (matchedProd && matchedProd.brandList) {
            matchedProd.brandList.forEach(b => {
                const bName = (b.brand || '').trim();
                const inHouseQty = b.inHouseQuantity || 0;
                const inHousePkt = b.inHousePacket || 0;
                if (bName && (inHouseQty > 0.001 || inHousePkt > 0.001)) {
                    brandMap[bName.toLowerCase()] = {
                        brand: bName,
                        packetSize: b.packetSize || matchedProd.packetSize || 30
                    };
                }
            });
        }

        // Fallback: If no brands found with stock, pull from products master list
        if (Object.keys(brandMap).length === 0) {
            const productMatch = (products || []).find(p => (p.name || p.productName || '').trim().toLowerCase() === targetProd);
            if (productMatch && productMatch.brands) {
                productMatch.brands.forEach(b => {
                    if (b.brand) brandMap[b.brand.toLowerCase()] = { brand: b.brand, packetSize: b.packetSize || 30 };
                });
            }
        }

        return Object.values(brandMap).sort((a, b) => a.brand.localeCompare(b.brand));
    }, [formData.productName, sourceWarehouseStock, products]);

    // Available LCs for Form
    const availableFormLcs = useMemo(() => {
        const targetProd = (formData.productName || '').trim().toLowerCase();
        const targetBrand = (formData.brand || '').trim().toLowerCase();
        if (!targetProd) return [];

        const lcSet = new Set();
        const prodLcSet = new Set();

        const matchedProd = (sourceWarehouseStock || []).find(p => (p.productName || '').trim().toLowerCase() === targetProd);
        if (matchedProd && matchedProd.brandList) {
            matchedProd.brandList.forEach(b => {
                const bName = (b.brand || '').trim().toLowerCase();
                const inHouseQty = b.inHouseQuantity || 0;
                const inHousePkt = b.inHousePacket || 0;
                const lc = (b.lcNo || '').trim();

                if (lc && (inHouseQty > 0.001 || inHousePkt > 0.001)) {
                    prodLcSet.add(lc);
                    if (!targetBrand || bName === targetBrand || bName.includes(targetBrand) || targetBrand.includes(bName)) {
                        lcSet.add(lc);
                    }
                }
            });
        }

        const result = lcSet.size > 0 ? lcSet : prodLcSet;
        return Array.from(result).sort();
    }, [formData.productName, formData.brand, sourceWarehouseStock]);

    // Calculate Available Stock for Form
    const availableStock = useMemo(() => {
        const sourceWh = (formData.fromWh || '').trim();
        const targetProd = (formData.productName || '').trim().toLowerCase();
        const targetBrand = (formData.brand || '').trim().toLowerCase();
        const targetLc = (formData.lcNo || '').trim();

        if (!targetProd || !sourceWh) return { bags: 0, qty: 0 };

        const matchedProd = (sourceWarehouseStock || []).find(p => (p.productName || '').trim().toLowerCase() === targetProd);
        if (!matchedProd || !matchedProd.brandList) return { bags: 0, qty: 0 };

        let totalPkt = 0;
        let totalQty = 0;

        matchedProd.brandList.forEach(b => {
            const bName = (b.brand || '').trim().toLowerCase();
            const bLc = (b.lcNo || '').trim();

            const brandMatch = !targetBrand || bName === targetBrand || bName.includes(targetBrand) || targetBrand.includes(bName);
            const lcMatch = !targetLc || isLcMatch(bLc, targetLc);

            if (brandMatch && lcMatch) {
                totalPkt += (b.inHousePacket || 0);
                totalQty += (b.inHouseQuantity || 0);
            }
        });

        return {
            bags: Math.round(totalPkt * 100) / 100,
            qty: Math.round(totalQty * 100) / 100
        };
    }, [formData.fromWh, formData.productName, formData.brand, formData.lcNo, sourceWarehouseStock]);

    // Form input handler
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name === 'brand') {
            const foundBrand = availableFormBrands.find(b => b.brand.toLowerCase() === value.trim().toLowerCase());
            const pktSize = foundBrand ? foundBrand.packetSize : formData.packetSize;
            setFormData(prev => ({ ...prev, brand: value, packetSize: pktSize }));
        } else if (name === 'transferQty') {
            const pktSize = parseFloat(formData.packetSize) || 30;
            const calculatedPkt = value !== '' && !isNaN(value) && pktSize > 0 ? (parseFloat(value) / pktSize).toFixed(2) : formData.transferPkt;
            setFormData(prev => ({ ...prev, transferQty: value, transferPkt: calculatedPkt }));
        } else if (name === 'transferPkt') {
            const pktSize = parseFloat(formData.packetSize) || 30;
            const calculatedQty = value !== '' && !isNaN(value) && pktSize > 0 ? (parseFloat(value) * pktSize).toFixed(2) : formData.transferQty;
            setFormData(prev => ({ ...prev, transferPkt: value, transferQty: calculatedQty }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const [editingTransferId, setEditingTransferId] = useState(null);

    const resetForm = () => {
        setFormData({
            date: new Date().toISOString().split('T')[0],
            fromWh: '',
            toWh: '',
            manager: '',
            toManager: '',
            truckNo: '',
            gatePassNo: '',
            remarks: '',
            productName: '',
            brand: '',
            lcNo: '',
            transferPkt: '',
            transferQty: '',
            packetSize: '30'
        });
        setEditingTransferId(null);
        setSubmitStatus(null);
    };

    // Helper to revert stock back to source warehouse when a transfer is deleted or updated
    const revertTransferStock = async (logItem) => {
        if (!logItem) return;
        const oldQty = parseFloat(logItem.transferQty ?? logItem.whQty ?? logItem.inHouseQuantity ?? 0);
        const oldPkt = parseFloat(logItem.transferPkt ?? logItem.whPkt ?? logItem.inHousePacket ?? 0);
        if (oldQty <= 0 && oldPkt <= 0) return;

        const fromWh = (logItem.fromWh || '').trim().toLowerCase();
        const toWh = (logItem.toWh || logItem.whName || logItem.warehouse || '').trim().toLowerCase();
        const prod = (logItem.productName || logItem.product || '').trim().toLowerCase();
        const brand = (logItem.brand || '').trim().toLowerCase();
        const lc = (logItem.lcNo || '').trim().toLowerCase();

        // 1. Restore stock to Source warehouse (fromWh)
        const allSources = [
            ...(warehouseData || []).map(r => ({ ...r, _sourceType: 'warehouse' })),
            ...(stockRecords || []).map(r => ({ ...r, _sourceType: 'stock' }))
        ];

        const sourceMatch = allSources.find(item => {
            const itemWh = (item.name || item.whName || item.warehouse || '').trim().toLowerCase();
            const itemProd = (item.productName || item.product || '').trim().toLowerCase();
            const itemBrand = (item.brand || '').trim().toLowerCase();
            const itemLc = (item.lcNo || '').trim().toLowerCase();

            return itemWh === fromWh && itemProd === prod && (!brand || itemBrand === brand || itemBrand.includes(brand)) && (!lc || isLcMatch(itemLc, lc));
        });

        if (sourceMatch) {
            const curQty = parseFloat(sourceMatch.whQty ?? sourceMatch.inHouseQuantity ?? sourceMatch.quantity ?? 0);
            const curPkt = parseFloat(sourceMatch.whPkt ?? sourceMatch.inHousePacket ?? sourceMatch.packet ?? 0);
            const updatedQty = curQty + oldQty;
            const updatedPkt = curPkt + oldPkt;

            const updatedRecord = {
                ...sourceMatch,
                whQty: updatedQty,
                whPkt: updatedPkt,
                inHouseQuantity: updatedQty,
                inHousePacket: updatedPkt,
                totalInHouseQuantity: updatedQty,
                totalInHousePacket: updatedPkt,
                lastUpdated: new Date().toISOString()
            };
            delete updatedRecord._sourceType;

            if (sourceMatch._sourceType === 'stock') {
                await axios.put(`${API_BASE_URL}/api/stock/${sourceMatch._id}`, updatedRecord);
            } else {
                await axios.put(`${API_BASE_URL}/api/warehouses/${sourceMatch._id}`, updatedRecord);
            }
        } else if (logItem.fromWh) {
            // Create source warehouse record if none exists
            const restoredRecord = {
                whName: logItem.fromWh,
                warehouse: logItem.fromWh,
                productName: logItem.productName || logItem.product,
                product: logItem.productName || logItem.product,
                brand: logItem.brand,
                lcNo: logItem.lcNo,
                packetSize: logItem.packetSize || 30,
                whPkt: oldPkt,
                whQty: oldQty,
                inHousePacket: oldPkt,
                inHouseQuantity: oldQty,
                quantity: oldQty,
                packet: oldPkt,
                recordType: 'warehouse',
                createdAt: new Date().toISOString()
            };
            await axios.post(`${API_BASE_URL}/api/warehouses`, restoredRecord);
        }

        // 2. Deduct stock from Destination warehouse (toWh)
        const destMatch = (warehouseData || []).find(item => {
            if (item.isTransferLog || item._id === logItem._id) return false;
            const itemWh = (item.name || item.whName || item.warehouse || '').trim().toLowerCase();
            const itemProd = (item.productName || item.product || '').trim().toLowerCase();
            const itemBrand = (item.brand || '').trim().toLowerCase();
            const itemLc = (item.lcNo || '').trim().toLowerCase();

            return itemWh === toWh && itemProd === prod && (!brand || itemBrand === brand || itemBrand.includes(brand)) && (!lc || isLcMatch(itemLc, lc));
        });

        if (destMatch) {
            const curQty = parseFloat(destMatch.whQty ?? destMatch.inHouseQuantity ?? destMatch.quantity ?? 0);
            const curPkt = parseFloat(destMatch.whPkt ?? destMatch.inHousePacket ?? destMatch.packet ?? 0);
            const updatedQty = Math.max(0, curQty - oldQty);
            const updatedPkt = Math.max(0, curPkt - oldPkt);

            const updatedRecord = {
                ...destMatch,
                whQty: updatedQty,
                whPkt: updatedPkt,
                inHouseQuantity: updatedQty,
                inHousePacket: updatedPkt,
                totalInHouseQuantity: updatedQty,
                totalInHousePacket: updatedPkt,
                lastUpdated: new Date().toISOString()
            };

            await axios.put(`${API_BASE_URL}/api/warehouses/${destMatch._id}`, updatedRecord);
        }
    };

    // Edit Transfer Record
    const handleEdit = (item) => {
        if (!canTransfer) {
            alert('Forbidden: You do not have permission to edit transfer records');
            return;
        }
        setFormData({
            date: item.date ? item.date.split('T')[0] : new Date().toISOString().split('T')[0],
            fromWh: item.fromWh || '',
            toWh: item.toWh || item.whName || item.warehouse || '',
            manager: item.manager || '',
            toManager: item.toManager || '',
            truckNo: item.truckNo || '',
            gatePassNo: item.gatePassNo || '',
            remarks: item.remarks || '',
            productName: item.productName || item.product || '',
            brand: item.brand || '',
            lcNo: item.lcNo || '',
            transferPkt: (item.transferPkt ?? item.whPkt ?? 0).toString(),
            transferQty: (item.transferQty ?? item.whQty ?? 0).toString(),
            packetSize: (item.packetSize || 30).toString()
        });
        setEditingTransferId(item._id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Submit Stock Transfer (Create or Edit as Requested status awaiting approval)
    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!canTransfer) {
            alert('Forbidden: You do not have permission to record stock transfer');
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            let transferQty = parseFloat(formData.transferQty) || 0;
            let transferPkt = parseFloat(formData.transferPkt) || 0;

            if (transferQty <= 0 && transferPkt <= 0) {
                alert('Please enter valid transfer quantity or bags');
                setIsSubmitting(false);
                return;
            }

            // Create or Update Destination Transfer Entry with status: Requested
            const destWhName = formData.toWh || formData.fromWh;
            const transferLog = {
                date: formData.date,
                fromWh: formData.fromWh,
                whName: destWhName,
                warehouse: destWhName,
                toWh: destWhName,
                productName: formData.productName,
                product: formData.productName,
                brand: formData.brand,
                lcNo: formData.lcNo,
                packetSize: parseFloat(formData.packetSize) || 30,
                transferPkt: parseFloat(formData.transferPkt) || 0,
                transferQty: parseFloat(formData.transferQty) || 0,
                whPkt: parseFloat(formData.transferPkt) || 0,
                whQty: parseFloat(formData.transferQty) || 0,
                inHousePacket: parseFloat(formData.transferPkt) || 0,
                inHouseQuantity: parseFloat(formData.transferQty) || 0,
                truckNo: formData.truckNo,
                gatePassNo: formData.gatePassNo,
                remarks: formData.remarks,
                manager: formData.toManager || formData.manager || '-',
                isTransferLog: true,
                recordType: 'warehouse',
                status: 'Requested',
                requestedBy: currentUser?.username || 'user',
                createdAt: new Date().toISOString()
            };

            if (editingTransferId) {
                await axios.put(`${API_BASE_URL}/api/warehouses/${editingTransferId}`, transferLog);
                if (addNotification) addNotification('success', `Transfer request updated for ${formData.productName}`);
            } else {
                await axios.post(`${API_BASE_URL}/api/warehouses`, transferLog);
                if (addNotification) addNotification('success', `Transfer request submitted for ${formData.productName} (${formData.transferPkt} bags). Awaiting approval.`);
            }

            setSubmitStatus('success');

            setTimeout(() => {
                setShowForm(false);
                resetForm();
                fetchData();
            }, 1200);

        } catch (error) {
            console.error('Error submitting stock transfer:', error);
            setSubmitStatus('error');
            if (addNotification) addNotification('error', 'Failed to submit stock transfer request');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Approve Transfer Request
    const handleApprove = async (item) => {
        const canApproveUser = hasPermission(currentUser, 'transfer', 'approve') || hasPermission(currentUser, 'warehouse', 'approve') || currentUser?.username === 'admin' || (currentUser?.role || '').toLowerCase() === 'admin';
        if (!canApproveUser) {
            alert('Forbidden: You do not have permission to approve transfer requests');
            return;
        }

        try {
            let transferQty = parseFloat(item.transferQty ?? item.whQty ?? item.inHouseQuantity ?? 0);
            let transferPkt = parseFloat(item.transferPkt ?? item.whPkt ?? item.inHousePacket ?? 0);

            const targetWh = (item.fromWh || '').trim().toLowerCase();
            const targetProd = (item.productName || item.product || '').trim().toLowerCase();
            const targetBrand = (item.brand || '').trim().toLowerCase();
            const targetLc = (item.lcNo || '').trim().toLowerCase();

            // Find matching source records to deduct from
            const allSources = [
                ...(warehouseData || []).map(r => ({ ...r, _sourceType: 'warehouse' })),
                ...(stockRecords || []).map(r => ({ ...r, _sourceType: 'stock' }))
            ];

            const sourceRecords = allSources.filter(s => {
                const itemWh = (s.name || s.whName || s.warehouse || '').trim().toLowerCase();
                const itemProd = (s.productName || s.product || '').trim().toLowerCase();
                const itemBrand = (s.brand || '').trim().toLowerCase();
                const itemLc = (s.lcNo || '').trim().toLowerCase();

                const whMatch = !targetWh || itemWh === targetWh || itemWh.includes(targetWh);
                const prodMatch = itemProd === targetProd;
                const brandMatch = !targetBrand || itemBrand === targetBrand || itemBrand.includes(targetBrand);
                const lcMatch = !targetLc || isLcMatch(itemLc, targetLc);
                const availQty = parseFloat(s.whQty ?? s.inHouseQuantity ?? s.quantity ?? 0);
                const availPkt = parseFloat(s.whPkt ?? s.inHousePacket ?? s.packet ?? 0);

                return whMatch && prodMatch && brandMatch && lcMatch && (availQty > 0 || availPkt > 0);
            });

            // Deduct from Source
            for (const sourceRecord of sourceRecords) {
                if (transferQty <= 0 && transferPkt <= 0) break;

                const availQty = parseFloat(sourceRecord.whQty ?? sourceRecord.inHouseQuantity ?? sourceRecord.quantity ?? 0);
                const availPkt = parseFloat(sourceRecord.whPkt ?? sourceRecord.inHousePacket ?? sourceRecord.packet ?? 0);

                const deductQty = Math.min(transferQty, availQty);
                const deductPkt = Math.min(transferPkt, availPkt);

                const newWhQty = Math.max(0, availQty - deductQty);
                const newWhPkt = Math.max(0, availPkt - deductPkt);

                const updatedRecord = {
                    ...sourceRecord,
                    whQty: newWhQty,
                    whPkt: newWhPkt,
                    inHouseQuantity: newWhQty,
                    inHousePacket: newWhPkt,
                    totalInHouseQuantity: newWhQty,
                    totalInHousePacket: newWhPkt,
                    lastUpdated: new Date().toISOString()
                };
                delete updatedRecord._sourceType;

                // Protect pre-baseline historical records from mutation
                const isPreBaseline = activeBaseline && activeBaseline.status === 'active' &&
                    (sourceRecord.date || sourceRecord.createdAt || '') < activeBaseline.baselineDate;

                if (!isPreBaseline) {
                    if (sourceRecord._sourceType === 'stock') {
                        await axios.put(`${API_BASE_URL}/api/stock/${sourceRecord._id}`, updatedRecord);
                    } else {
                        await axios.put(`${API_BASE_URL}/api/warehouses/${sourceRecord._id}`, updatedRecord);
                    }
                }

                transferQty -= deductQty;
                transferPkt -= deductPkt;
            }

            // Update transfer status to Approved
            const updatedLog = {
                ...item,
                status: 'Approved',
                approvedAt: new Date().toISOString(),
                approvedBy: currentUser?.username || 'admin'
            };

            await axios.put(`${API_BASE_URL}/api/warehouses/${item._id}`, updatedLog);

            if (addNotification) addNotification('success', `Stock transfer for ${item.productName || item.product} approved successfully`);
            fetchData();
        } catch (error) {
            console.error('Error approving transfer request:', error);
            if (addNotification) addNotification('error', 'Failed to approve transfer request');
        }
    };

    // Reject Transfer Request
    const handleReject = async (item) => {
        const canApproveUser = hasPermission(currentUser, 'transfer', 'approve') || hasPermission(currentUser, 'warehouse', 'approve') || currentUser?.username === 'admin' || (currentUser?.role || '').toLowerCase() === 'admin';
        if (!canApproveUser) {
            alert('Forbidden: You do not have permission to reject transfer requests');
            return;
        }

        if (window.confirm('Are you sure you want to reject this transfer request?')) {
            try {
                const updatedLog = {
                    ...item,
                    status: 'Rejected',
                    rejectedAt: new Date().toISOString(),
                    rejectedBy: currentUser?.username || 'admin'
                };

                await axios.put(`${API_BASE_URL}/api/warehouses/${item._id}`, updatedLog);

                if (addNotification) addNotification('info', `Stock transfer request for ${item.productName || item.product} rejected`);
                fetchData();
            } catch (error) {
                console.error('Error rejecting transfer request:', error);
                if (addNotification) addNotification('error', 'Failed to reject transfer request');
            }
        }
    };

    // Delete Transfer Log and Restore Stock to Source Warehouse
    const handleDelete = async (item) => {
        if (!canDelete) {
            alert('Forbidden: You do not have permission to delete transfer records');
            return;
        }
        const recordId = typeof item === 'object' ? item._id : item;
        const logItem = typeof item === 'object' ? item : (transferLogs || []).find(t => t._id === recordId);

        if (window.confirm('Are you sure you want to delete this stock transfer record? Transferred stock will be restored back to the source warehouse.')) {
            try {
                if (logItem) {
                    await revertTransferStock(logItem);
                }
                await axios.delete(`${API_BASE_URL}/api/warehouses/${recordId}`);
                if (addNotification) addNotification('success', 'Transfer record deleted and stock restored to source warehouse');
                fetchData();
            } catch (error) {
                console.error('Error deleting transfer record:', error);
                if (addNotification) addNotification('error', 'Failed to delete transfer record');
            }
        }
    };

    // Filtered Transfer Logs
    const displayLogs = useMemo(() => {
        return (transferLogs || []).filter(t => {
            if (isRequestedOnly) {
                if (t.status !== 'Requested') return false;
            } else {
                if (t.status === 'Requested') return false;
            }
            const fromWh = (t.fromWh || '').toLowerCase();
            const toWh = (t.toWh || t.whName || t.warehouse || '').toLowerCase();
            const prod = (t.productName || t.product || '').toLowerCase();
            const brand = (t.brand || '').toLowerCase();
            const lc = (t.lcNo || '').toLowerCase();
            const truck = (t.truckNo || '').toLowerCase();
            const q = searchQuery.toLowerCase().trim();

            return !q || fromWh.includes(q) || toWh.includes(q) || prod.includes(q) || brand.includes(q) || lc.includes(q) || truck.includes(q);
        });
    }, [transferLogs, searchQuery, isRequestedOnly]);

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Header section matching Sale Management */}
            <div className="grid grid-cols-1 md:grid-cols-3 items-center justify-between gap-4">
                {!showForm ? (
                    <>
                        <div className="text-center md:text-left">
                            <h2 className="text-2xl font-bold text-gray-800">Transfer Management</h2>
                            <p className="text-sm text-gray-500 mt-1">Record & track inter-warehouse stock transfers</p>
                        </div>

                        <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center gap-2 px-2 md:px-0">
                            <div className="relative w-full group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search product, warehouse, brand..."
                                    className="h-10 block w-full pl-10 pr-4 bg-white/80 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="flex items-center justify-center gap-2">
                                <button
                                    onClick={() => setIsRequestedOnly(!isRequestedOnly)}
                                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                        isRequestedOnly
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    Transfer Request
                                    {requestedCount > 0 && (
                                        <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-red-500 text-[10px] font-bold text-white">
                                            {requestedCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2.5">
                            <button
                                onClick={() => { resetForm(); setShowForm(true); }}
                                className="h-10 border border-transparent px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 flex items-center justify-center text-sm gap-1.5"
                            >
                                <span className="text-lg font-bold">+</span>
                                <span>Record Transfer</span>
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="col-span-3"></div>
                )}
            </div>

            {/* Record Stock Transfer Form */}
            {showForm && (
                <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 p-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">{editingTransferId ? 'Edit Stock Transfer' : 'Record New Stock Transfer'}</h3>
                            <p className="text-xs text-gray-500">Transfer stock from source location to destination warehouse</p>
                        </div>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-red-500 transition-colors">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Date */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Date</label>
                            <CustomDatePicker
                                name="date"
                                value={formData.date}
                                onChange={handleInputChange}
                            />
                        </div>

                        {/* From Location */}
                        <div className="space-y-2 relative" ref={fromWhRef}>
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">From Location (Source)</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="fromWh"
                                    value={formData.fromWh}
                                    onChange={handleInputChange}
                                    onFocus={() => setActiveDropdown('fromWh')}
                                    placeholder="Select Source Warehouse / Port"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    required
                                    autoComplete="off"
                                />
                                <ChevronDownIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>

                            {activeDropdown === 'fromWh' && (
                                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                    {uniqueWarehouses
                                        .filter(wh => wh.toLowerCase().includes((formData.fromWh || '').toLowerCase()))
                                        .map((wh, idx) => (
                                             <button
                                                 key={idx}
                                                 type="button"
                                                 onClick={() => {
                                                     setFormData(prev => ({ ...prev, fromWh: wh, productName: '', brand: '', lcNo: '' }));
                                                     setActiveDropdown(null);
                                                 }}
                                                 className="w-full text-left px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-blue-50 hover:text-blue-600"
                                             >
                                                 {wh}
                                             </button>
                                         ))}
                                </div>
                            )}
                        </div>

                        {/* To Warehouse */}
                        <div className="space-y-2 relative" ref={toWhRef}>
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">To Warehouse (Destination)</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="toWh"
                                    value={formData.toWh}
                                    onChange={handleInputChange}
                                    onFocus={() => setActiveDropdown('toWh')}
                                    placeholder="Select Destination Warehouse"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    required
                                    autoComplete="off"
                                />
                                <ChevronDownIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>

                            {activeDropdown === 'toWh' && (
                                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                    {uniqueWarehouses
                                        .filter(wh => wh.toLowerCase().includes((formData.toWh || '').toLowerCase()) && wh !== formData.fromWh)
                                        .map((wh, idx) => (
                                             <button
                                                 key={idx}
                                                 type="button"
                                                 onClick={() => {
                                                     setFormData(prev => ({ ...prev, toWh: wh }));
                                                     setActiveDropdown(null);
                                                 }}
                                                 className="w-full text-left px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-blue-50 hover:text-blue-600"
                                             >
                                                 {wh}
                                             </button>
                                         ))}
                                </div>
                            )}
                        </div>

                        {/* Product Name */}
                        <div className="space-y-2 relative" ref={productRef}>
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Product Name</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="productName"
                                    value={formData.productName}
                                    onChange={handleInputChange}
                                    onFocus={() => setActiveDropdown('product')}
                                    placeholder="Select Product"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    required
                                    autoComplete="off"
                                />
                                <ChevronDownIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>

                            {activeDropdown === 'product' && (
                                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                    {availableFormProducts
                                        .filter(p => p.toLowerCase().includes((formData.productName || '').toLowerCase()))
                                        .map((p, idx) => (
                                             <button
                                                 key={idx}
                                                 type="button"
                                                 onClick={() => {
                                                     setFormData(prev => ({ ...prev, productName: p, brand: '', lcNo: '' }));
                                                     setActiveDropdown(null);
                                                 }}
                                                 className="w-full text-left px-4 py-2 text-sm font-bold text-gray-800 hover:bg-blue-50 hover:text-blue-600"
                                             >
                                                 {p}
                                             </button>
                                         ))}
                                </div>
                            )}
                        </div>

                        {/* Brand */}
                        <div className="space-y-2 relative" ref={brandRef}>
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Brand</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="brand"
                                    value={formData.brand}
                                    onChange={handleInputChange}
                                    onFocus={() => setActiveDropdown('brand')}
                                    placeholder="Select Brand"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    required
                                    autoComplete="off"
                                />
                                <ChevronDownIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>

                            {activeDropdown === 'brand' && (
                                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                    {availableFormBrands
                                        .filter(b => b.brand.toLowerCase().includes((formData.brand || '').toLowerCase()))
                                        .map((b, idx) => (
                                             <button
                                                 key={idx}
                                                 type="button"
                                                 onClick={() => {
                                                     setFormData(prev => ({ ...prev, brand: b.brand, packetSize: b.packetSize, lcNo: '' }));
                                                     setActiveDropdown(null);
                                                 }}
                                                 className="w-full text-left px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-blue-50 hover:text-blue-600"
                                             >
                                                 {b.brand}
                                             </button>
                                         ))}
                                </div>
                            )}
                        </div>

                        {/* LC No */}
                        <div className="space-y-2 relative" ref={lcRef}>
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">LC Number</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="lcNo"
                                    value={formData.lcNo}
                                    onChange={handleInputChange}
                                    onFocus={() => setActiveDropdown('lcNo')}
                                    placeholder="Select LC No"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    autoComplete="off"
                                />
                                <ChevronDownIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>

                            {activeDropdown === 'lcNo' && (
                                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                    {availableFormLcs
                                        .filter(lc => lc.toLowerCase().includes((formData.lcNo || '').toLowerCase()))
                                        .map((lc, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, lcNo: lc }));
                                                    setActiveDropdown(null);
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm font-mono text-gray-800 hover:bg-blue-50 hover:text-blue-600"
                                            >
                                                {lc}
                                            </button>
                                        ))}
                                </div>
                            )}
                        </div>

                        {/* Available Stock Indicator */}
                        {formData.productName && (
                            <div className="lg:col-span-3 p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between text-xs">
                                <span className="font-bold text-blue-900">Available Source Stock:</span>
                                <span className="font-black text-blue-700 bg-white px-3 py-1 rounded-lg border border-blue-200">
                                    {Math.round(availableStock.bags)} Bags ({Math.round(availableStock.qty)} kg)
                                </span>
                            </div>
                        )}

                        {/* Transfer Bags */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Transfer Bags</label>
                            <input
                                type="number"
                                name="transferPkt"
                                value={formData.transferPkt}
                                onChange={handleInputChange}
                                placeholder="Number of Bags"
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                required
                            />
                        </div>

                        {/* Transfer Weight KG */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Transfer Weight (KG)</label>
                            <input
                                type="number"
                                name="transferQty"
                                value={formData.transferQty}
                                onChange={handleInputChange}
                                placeholder="Weight in KG"
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                required
                            />
                        </div>

                        {/* Truck No */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Truck / Vehicle No</label>
                            <input
                                type="text"
                                name="truckNo"
                                value={formData.truckNo}
                                onChange={handleInputChange}
                                placeholder="e.g. DHK-METRO-11-2030"
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>

                        {/* Gate Pass / Remarks */}
                        <div className="space-y-2 lg:col-span-3">
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Remarks / Notes</label>
                            <input
                                type="text"
                                name="remarks"
                                value={formData.remarks}
                                onChange={handleInputChange}
                                placeholder="Optional transfer notes..."
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>

                        {/* Buttons */}
                        <div className="lg:col-span-3 flex items-center justify-between pt-4 border-t border-gray-100">
                            <div>
                                {submitStatus === 'success' && <p className="text-xs font-bold text-emerald-600">✓ Transfer request submitted successfully!</p>}
                                {submitStatus === 'error' && <p className="text-xs font-bold text-red-600">✗ Failed to submit transfer request</p>}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowForm(false); resetForm(); }}
                                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all"
                                >
                                    {isSubmitting ? 'Submitting...' : (editingTransferId ? 'Update Transfer' : 'Submit Transfer')}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* Transfer History Records Table */}
            {!showForm && (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                                    <th className="py-3.5 px-4">Date</th>
                                    <th className="py-3.5 px-4">Truck / Ref</th>
                                    <th className="py-3.5 px-4">From Location</th>
                                    <th className="py-3.5 px-4">To Warehouse</th>
                                    <th className="py-3.5 px-4">Product</th>
                                    <th className="py-3.5 px-4">Brand</th>
                                    <th className="py-3.5 px-4">LC No</th>
                                    <th className="py-3.5 px-4 text-right">Bags</th>
                                    <th className="py-3.5 px-4 text-right">Weight (KG)</th>
                                    <th className="py-3.5 px-4 text-center">Status</th>
                                    <th className="py-3.5 px-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan="11" className="py-12 text-center text-gray-400">
                                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-2" />
                                            <p className="font-medium text-xs">Loading transfer records...</p>
                                        </td>
                                    </tr>
                                ) : displayLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan="11" className="py-12 text-center text-gray-400">
                                            <p className="font-bold text-gray-700 text-base">No Transfer Records Found</p>
                                            <p className="text-xs text-gray-500 mt-1">Start by recording a stock transfer or adjust your search query.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    displayLogs.map((item, idx) => {
                                        const bagVal = parseFloat(item.transferPkt ?? item.whPkt ?? item.inHousePacket ?? 0);
                                        const qtyVal = parseFloat(item.transferQty ?? item.whQty ?? item.inHouseQuantity ?? 0);

                                        const isHighlighted = highlightId && (
                                            String(item._id) === String(highlightId) ||
                                            (item.truckNo && String(item.truckNo).toLowerCase().trim() === String(highlightId).toLowerCase().trim()) ||
                                            (item.gatePassNo && String(item.gatePassNo).toLowerCase().trim() === String(highlightId).toLowerCase().trim()) ||
                                            (item.lcNo && String(item.lcNo).toLowerCase().trim() === String(highlightId).toLowerCase().trim())
                                        );

                                        return (
                                            <tr 
                                                key={idx} 
                                                className={`hover:bg-blue-50/40 transition-colors group ${isHighlighted ? 'notif-row-highlight' : ''}`}
                                                ref={el => {
                                                    if (item._id) rowRefs.current[item._id] = el;
                                                    if (item.truckNo) rowRefs.current[item.truckNo] = el;
                                                    if (item.gatePassNo) rowRefs.current[item.gatePassNo] = el;
                                                    if (item.lcNo) rowRefs.current[item.lcNo] = el;
                                                }}
                                                style={isHighlighted ? { borderLeft: '5px solid #f59e0b' } : undefined}
                                            >
                                                <td className="py-3 px-4 font-bold text-gray-900 whitespace-nowrap">
                                                    {formatDate(item.date || item.createdAt)}
                                                </td>
                                                <td className="py-3 px-4 font-medium text-gray-700 whitespace-nowrap">
                                                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-md text-xs font-mono font-bold">
                                                        {item.truckNo || item.gatePassNo || 'TR-LOG'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-gray-700 font-semibold">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                                                        {item.fromWh || 'Stock'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-gray-700 font-semibold">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200/60">
                                                        {item.toWh || item.whName || item.warehouse || '-'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-bold text-gray-900">
                                                    {item.productName || item.product || '-'}
                                                </td>
                                                <td className="py-3 px-4 text-gray-700 font-medium">
                                                    {item.brand || '-'}
                                                </td>
                                                <td className="py-3 px-4 text-gray-600 font-mono text-xs">
                                                    {item.lcNo || '-'}
                                                </td>
                                                <td className="py-3 px-4 text-right font-black text-gray-900">
                                                    {Math.round(bagVal).toLocaleString('en-US')}
                                                </td>
                                                <td className="py-3 px-4 text-right font-black text-blue-700">
                                                    {Math.round(qtyVal).toLocaleString('en-US')} kg
                                                </td>
                                                <td className="py-3 px-4 text-center whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                                        item.status === 'Requested'
                                                            ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                                            : item.status === 'Rejected'
                                                            ? 'bg-red-50 text-red-700 border border-red-200/60'
                                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                                    }`}>
                                                        {item.status || 'Approved'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {canApprove && item.status === 'Requested' && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleApprove(item)}
                                                                    className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                                                    title="Approve Transfer Request"
                                                                >
                                                                    <CheckIcon className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleReject(item)}
                                                                    className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                                                    title="Reject Transfer Request"
                                                                >
                                                                    <XIcon className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                        <button
                                                            onClick={() => setViewingTransfer(item)}
                                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="View Receipt Details"
                                                        >
                                                            <EyeIcon className="w-4 h-4" />
                                                        </button>
                                                        {canTransfer && (
                                                            <button
                                                                onClick={() => handleEdit(item)}
                                                                className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                                title="Edit Transfer Record"
                                                            >
                                                                <EditIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {canDelete && item._id && (
                                                            <button
                                                                onClick={() => handleDelete(item)}
                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Delete Record"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* View Receipt Details Modal */}
            {viewingTransfer && typeof document !== 'undefined' && document.body && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setViewingTransfer(null)}></div>
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-xl overflow-hidden relative z-10 animate-in zoom-in duration-200">
                        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/10 rounded-xl">
                                    <FileTextIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Transfer Receipt</h3>
                                    <p className="text-xs text-slate-300 font-mono">Ref: {viewingTransfer.truckNo || viewingTransfer._id}</p>
                                </div>
                            </div>
                            <button onClick={() => setViewingTransfer(null)} className="p-2 text-gray-400 hover:text-white">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl text-xs space-y-1">
                                <div>
                                    <p className="text-gray-500 uppercase font-bold">Transfer Date</p>
                                    <p className="font-black text-gray-900 text-sm">{formatDate(viewingTransfer.date || viewingTransfer.createdAt)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 uppercase font-bold">Truck / Vehicle No</p>
                                    <p className="font-mono font-bold text-gray-900 text-sm">{viewingTransfer.truckNo || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 uppercase font-bold">From Location</p>
                                    <p className="font-bold text-amber-700 text-sm">{viewingTransfer.fromWh || 'Stock'}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 uppercase font-bold">To Destination Warehouse</p>
                                    <p className="font-bold text-blue-700 text-sm">{viewingTransfer.toWh || viewingTransfer.whName || viewingTransfer.warehouse || '-'}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-xs font-black uppercase text-gray-500">Transferred Item Details</h4>
                                <div className="border border-gray-100 rounded-xl overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-50 border-b border-gray-100 font-bold text-gray-600">
                                            <tr>
                                                <th className="p-3">Product</th>
                                                <th className="p-3">Brand</th>
                                                <th className="p-3">LC No</th>
                                                <th className="p-3 text-right">Bags</th>
                                                <th className="p-3 text-right">Weight (KG)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            <tr>
                                                <td className="p-3 font-bold text-gray-900">{viewingTransfer.productName || viewingTransfer.product || '-'}</td>
                                                <td className="p-3 text-gray-700">{viewingTransfer.brand || '-'}</td>
                                                <td className="p-3 text-gray-600 font-mono">{viewingTransfer.lcNo || '-'}</td>
                                                <td className="p-3 text-right font-black text-gray-900">
                                                    {Math.round(parseFloat(viewingTransfer.transferPkt ?? viewingTransfer.whPkt ?? 0)).toLocaleString('en-US')}
                                                </td>
                                                <td className="p-3 text-right font-black text-blue-700">
                                                    {Math.round(parseFloat(viewingTransfer.transferQty ?? viewingTransfer.whQty ?? 0)).toLocaleString('en-US')} kg
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {viewingTransfer.remarks && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase">Remarks</p>
                                    <p className="text-xs text-gray-700 p-3 bg-gray-50 rounded-xl">{viewingTransfer.remarks}</p>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    onClick={() => window.print()}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl flex items-center gap-1.5"
                                >
                                    <PrinterIcon className="w-4 h-4" />
                                    <span>Print Receipt</span>
                                </button>
                                <button
                                    onClick={() => setViewingTransfer(null)}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default TransferManagement;
