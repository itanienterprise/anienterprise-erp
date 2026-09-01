import React, { useRef, useState, useEffect, useMemo } from 'react';
import axios from '../../../utils/api';
import {
    SearchIcon, PlusIcon, EditIcon, TrashIcon, CheckIcon, XIcon,
    FileTextIcon, DollarSignIcon, ChevronDownIcon
} from '../../Icons';
import { API_BASE_URL, formatDate, SortIcon } from '../../../utils/helpers';
import { hasPermission } from '../../../utils/permissionHelper';
import CustomDatePicker from '../../shared/CustomDatePicker';

const PurchaseReceiveManagement = ({ currentUser, addNotification, fetchStockRecords, refreshPendingIndicators, highlightId, isRequestedNotif }) => {

    const [purchaseReceives, setPurchaseReceives] = useState([]);
    const [warehousesList, setWarehousesList] = useState(['HILI', 'DINAJPUR', 'CHATTOGRAM', 'DHAKA']);
    const [customersList, setCustomersList] = useState([]);
    const [productsList, setProductsList] = useState([]);

    const rowRefs = useRef({});
    useEffect(() => {
        if (!highlightId) return;

        const targetItem = purchaseReceives.find(p => p.purchaseReceiveNo === highlightId || p.purchaseNo === highlightId || p._id === highlightId);
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
                    if (!scrollToRow()) { setSearchQuery(''); setTimeout(scrollToRow, 300); }
                }, 700);
                return () => clearTimeout(t2);
            }
        }, 250);
        return () => clearTimeout(t1);
    }, [highlightId, purchaseReceives]);

    const [activeProductDropdown, setActiveProductDropdown] = useState(null);
    const [productSearch, setProductSearch] = useState('');
    const [activeBrandDropdown, setActiveBrandDropdown] = useState(null);
    const [brandSearch, setBrandSearch] = useState('');
    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    const [purchasesList, setPurchasesList] = useState([]);
    const [isPurchaseDropdownOpen, setIsPurchaseDropdownOpen] = useState(false);
    const [purchaseSearch, setPurchaseSearch] = useState('');
    const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
    const [highlightedCustomerIdx, setHighlightedCustomerIdx] = useState(0);
    const [highlightedProductIdx, setHighlightedProductIdx] = useState(0);
    const [highlightedBrandIdx, setHighlightedBrandIdx] = useState(0);
    const [highlightedWhIdx, setHighlightedWhIdx] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isRequestedOnly, setIsRequestedOnly] = useState(false);
    useEffect(() => { if (isRequestedNotif) { setIsRequestedOnly(true); } }, [isRequestedNotif]);

    // Form Modal States
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form Fields
    const [formData, setFormData] = useState({
        purchaseReceiveNo: '',
        purchaseNo: '',
        date: new Date().toISOString().split('T')[0],
        supplierName: '',
        companyName: '',
        lcNo: '',
        challanNo: '',
        truckNo: '',
        warehouse: 'HILI',
        items: [
            { productName: '', brandEntries: [{ brand: '', bag: '', qty: '', rate: '', total: 0 }], total: 0 }
        ],
        discount: 0,
        totalAmount: 0,
        paidAmount: 0,
        dueAmount: 0,
        remarks: ''
    });

    const canAdd = hasPermission(currentUser, 'purchaseReceive', 'add') || hasPermission(currentUser, 'purchase', 'add') || currentUser?.role === 'admin';
    const canEdit = hasPermission(currentUser, 'purchaseReceive', 'edit') || hasPermission(currentUser, 'purchase', 'edit') || currentUser?.role === 'admin';
    const canDelete = hasPermission(currentUser, 'purchaseReceive', 'delete') || hasPermission(currentUser, 'purchase', 'delete') || currentUser?.role === 'admin';
    const canApprove = hasPermission(currentUser, 'purchaseReceive', 'special') || hasPermission(currentUser, 'purchase', 'special') || currentUser?.role === 'admin';

    const syncPurchaseReceiveStock = async (purchasesList) => {
        await syncAllPurchaseReceiveStock(purchasesList);
    };

    const fetchPurchaseReceives = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/purchase-receives`);
            const data = res.data || [];
            setPurchaseReceives(data);
            if (data.length > 0) {
                syncPurchaseReceiveStock(data);
            }
        } catch (error) {
            console.error('Error fetching purchase receives:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPurchaseReceives();
        const fetchWH = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/api/warehouses`);
                if (Array.isArray(res.data) && res.data.length > 0) {
                    const list = Array.from(new Set(res.data.map(w => (w.whName || w.warehouse || w.name || '').trim()).filter(Boolean)));
                    if (list.length > 0) setWarehousesList(list);
                }
            } catch (e) { }
        };
        const fetchCustomers = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/api/customers`);
                if (Array.isArray(res.data)) {
                    setCustomersList(res.data);
                }
            } catch (e) { }
        };
        const fetchProducts = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/api/products`);
                if (Array.isArray(res.data)) {
                    setProductsList(res.data);
                }
            } catch (e) { }
        };
        const fetchPurchases = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/api/purchases`);
                if (Array.isArray(res.data)) {
                    setPurchasesList(res.data);
                }
            } catch (e) { }
        };
        fetchWH();
        fetchCustomers();
        fetchProducts();
        fetchPurchases();
    }, []);

    const requestedCount = useMemo(() => {
        return purchaseReceives.filter(p => (p.status || '').toLowerCase() === 'requested').length;
    }, [purchaseReceives]);

    const filteredPurchaseReceives = useMemo(() => {
        return purchaseReceives.filter(p => {
            const statusLower = (p.status || 'Accepted').toLowerCase();
            if (isRequestedOnly && statusLower !== 'requested') return false;
            if (!isRequestedOnly && statusLower === 'requested') return false;

            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const pNo = (p.purchaseReceiveNo || p.purchaseNo || '').toLowerCase();
                const comp = (p.companyName || p.supplierName || '').toLowerCase();
                const lc = (p.lcNo || '').toLowerCase();
                const ch = (p.challanNo || '').toLowerCase();
                return pNo.includes(q) || comp.includes(q) || lc.includes(q) || ch.includes(q);
            }
            return true;
        });
    }, [purchaseReceives, isRequestedOnly, searchQuery]);

    const getPurchaseBrandEntries = (purchase) => {
        const results = [];
        (purchase.items || []).forEach(item => {
            const pName = item.productName || item.product || '';
            const bEntries = item.brandEntries && item.brandEntries.length > 0
                ? item.brandEntries
                : [{ brand: item.brand || '', qty: item.qty || 0, rate: item.rate || item.purchasedPrice || 0 }];

            bEntries.forEach(be => {
                const arrQty = parseFloat(be.qty) || 0;
                const swpQty = parseFloat(be.sweepedQuantity || be.swpQty) || 0;
                const ihQty = be.inHouseQuantity !== undefined && be.inHouseQuantity !== '' ? parseFloat(be.inHouseQuantity) : Math.max(0, arrQty - swpQty);

                results.push({
                    productName: pName,
                    brand: be.brand || '—',
                    qty: arrQty,
                    swpQty: swpQty,
                    inHouseQty: ihQty,
                    rate: parseFloat(be.rate) || 0,
                    total: be.total !== undefined ? parseFloat(be.total) : (ihQty * (parseFloat(be.rate) || 0))
                });
            });
        });
        return results.length > 0 ? results : [{ productName: '—', brand: '—', qty: 0, swpQty: 0, inHouseQty: 0, rate: 0, total: 0 }];
    };

    const getPRTotals = (p) => {
        const entries = getPurchaseBrandEntries(p);
        let calculatedTotal = 0;
        entries.forEach(e => {
            calculatedTotal += (e.total ? parseFloat(e.total) : (parseFloat(e.inHouseQty || 0) * parseFloat(e.rate || 0)));
        });

        const totalAmount = (p.totalAmount !== undefined && p.totalAmount !== null && parseFloat(p.totalAmount) > 0)
            ? parseFloat(p.totalAmount)
            : calculatedTotal;

        const paidAmount = parseFloat(p.paidAmount ?? p.paid ?? 0);
        const discount = parseFloat(p.discount || 0);

        const dueAmount = (p.dueAmount !== undefined && p.dueAmount !== null && parseFloat(p.dueAmount) > 0)
            ? parseFloat(p.dueAmount)
            : Math.max(0, totalAmount - paidAmount - discount);

        return { totalAmount, paidAmount, dueAmount };
    };

    const stats = useMemo(() => {
        const valid = purchaseReceives.filter(p => (p.status || '').toLowerCase() !== 'requested');
        let totalPurchases = 0;
        let totalDiscount = 0;
        let totalPaid = 0;
        let totalDue = 0;
        valid.forEach(p => {
            const { totalAmount, paidAmount, dueAmount } = getPRTotals(p);
            totalPurchases += totalAmount;
            totalDiscount += parseFloat(p.discount || 0);
            totalPaid += paidAmount;
            totalDue += dueAmount;
        });
        return { totalPurchases, totalDiscount, totalPaid, totalDue };
    }, [purchaseReceives]);

    const filteredCustomers = useMemo(() => {
        if (!customerSearch) return customersList;
        const q = customerSearch.toLowerCase();
        return customersList.filter(c => {
            const comp = (c.companyName || '').toLowerCase();
            const cust = (c.customerName || c.name || '').toLowerCase();
            const ph = (c.phone || c.proprietorPhone || c.mobile || '').toLowerCase();
            return comp.includes(q) || cust.includes(q) || ph.includes(q);
        });
    }, [customersList, customerSearch]);

    const filteredPurchasesDropdown = useMemo(() => {
        if (!purchaseSearch) return purchasesList;
        const q = purchaseSearch.toLowerCase().trim();
        return purchasesList.filter(p => {
            const pNo = (p.purchaseNo || '').toLowerCase();
            const comp = (p.companyName || p.supplierName || '').toLowerCase();
            const lc = (p.lcNo || '').toLowerCase();
            return pNo.includes(q) || comp.includes(q) || lc.includes(q);
        });
    }, [purchasesList, purchaseSearch]);

    const availableProducts = useMemo(() => {
        const defaultProds = ['MUNG DAL', 'LENTIL', 'SUGAR', 'CHANA DAL', 'SOYABEAN OIL', 'WHEAT', 'RICE', 'YELLOW PEAS', 'MUSTARD SEED'];
        if (!productsList || productsList.length === 0) return defaultProds;
        const fetchedNames = productsList.map(p => typeof p === 'string' ? p : (p.name || p.productName || p.title || '')).filter(Boolean);
        return Array.from(new Set([...fetchedNames, ...defaultProds]));
    }, [productsList]);

    const getProductPacketSize = (productName, brandName = '') => {
        if (!productName || !productsList) return 0;

        const normProd = productName.trim().toLowerCase();
        const normBrand = (brandName || '').trim().toLowerCase();

        const matchedProd = productsList.find(p => {
            const name = typeof p === 'string' ? p : (p.name || p.productName || p.title || '');
            return name.trim().toLowerCase() === normProd;
        });

        if (matchedProd && typeof matchedProd === 'object') {
            if (normBrand && Array.isArray(matchedProd.brands)) {
                const bObj = matchedProd.brands.find(b => {
                    const bName = typeof b === 'string' ? b : (b.brand || b.name || '');
                    return bName.trim().toLowerCase() === normBrand;
                });
                if (bObj && typeof bObj === 'object') {
                    const size = parseFloat(bObj.packetSize || bObj.bagSize || bObj.size || 0);
                    if (size > 0) return size;
                }
            }

            if (normBrand && Array.isArray(matchedProd.brandEntries)) {
                const bObj = matchedProd.brandEntries.find(b => {
                    const bName = typeof b === 'string' ? b : (b.brand || b.name || '');
                    return bName.trim().toLowerCase() === normBrand;
                });
                if (bObj && typeof bObj === 'object') {
                    const size = parseFloat(bObj.packetSize || bObj.bagSize || bObj.size || 0);
                    if (size > 0) return size;
                }
            }

            if (Array.isArray(matchedProd.brands) && matchedProd.brands.length > 0) {
                const firstB = matchedProd.brands[0];
                const size = parseFloat(typeof firstB === 'object' ? (firstB.packetSize || firstB.bagSize || firstB.size || 0) : 0);
                if (size > 0) return size;
            }

            const topSize = parseFloat(matchedProd.packetSize || matchedProd.bagSize || matchedProd.size || 0);
            if (topSize > 0) return topSize;
        }

        return 0;
    };

    const getBrandsForProduct = (productName) => {
        if (!productName || !productName.trim()) return [];

        const matchedProd = productsList.find(p => {
            const name = typeof p === 'string' ? p : (p.name || p.productName || p.title || '');
            return name.trim().toLowerCase() === productName.trim().toLowerCase();
        });

        let prodBrands = [];
        if (matchedProd && typeof matchedProd === 'object') {
            if (Array.isArray(matchedProd.brands)) {
                prodBrands = matchedProd.brands.map(b => typeof b === 'string' ? b : (b.name || b.brand || '')).filter(Boolean);
            } else if (Array.isArray(matchedProd.brandEntries)) {
                prodBrands = matchedProd.brandEntries.map(b => typeof b === 'string' ? b : (b.brand || b.name || '')).filter(Boolean);
            }
        }

        return Array.from(new Set(prodBrands));
    };

    const resetForm = () => {
        setFormData({
            purchaseReceiveNo: '',
            purchaseNo: '',
            date: new Date().toISOString().split('T')[0],
            supplierName: '',
            companyName: '',
            lcNo: '',
            challanNo: '',
            truckNo: '',
            warehouse: warehousesList[0] || 'HILI',
            items: [
                { productName: '', brandEntries: [{ brand: '', bag: '', qty: '', sweepedPacket: '', sweepedQuantity: '', inHousePacket: '', inHouseQuantity: '', rate: '', total: 0 }], total: 0 }
            ],
            discount: 0,
            totalAmount: 0,
            paidAmount: 0,
            dueAmount: 0,
            remarks: ''
        });
        setEditingId(null);
    };

    const handleSelectPurchase = (p) => {
        const pNo = p.purchaseNo || '';
        const normalizedItems = (p.items || []).map(item => {
            if (item.brandEntries && item.brandEntries.length > 0) {
                const bEntries = item.brandEntries.map(be => {
                    const pktSize = getProductPacketSize(item.productName || item.product || '', be.brand || '');
                    const qVal = parseFloat(be.qty) || 0;
                    const bVal = be.bag !== undefined && be.bag !== '' ? be.bag : (be.packet !== undefined && be.packet !== '' ? be.packet : (qVal > 0 && pktSize > 0 ? (qVal / pktSize) : ''));
                    const swpPkt = be.sweepedPacket || be.swpBag || '';
                    const swpQty = be.sweepedQuantity || be.swpQty || '';
                    const inHousePkt = be.inHousePacket !== undefined && be.inHousePacket !== '' ? be.inHousePacket : (bVal !== '' ? (Math.max(0, parseFloat(bVal) - (parseFloat(swpPkt) || 0))).toString() : '');
                    const inHouseQty = be.inHouseQuantity !== undefined && be.inHouseQuantity !== '' ? be.inHouseQuantity : (qVal !== 0 ? (Math.max(0, qVal - (parseFloat(swpQty) || 0))).toString() : '');

                    return {
                        ...be,
                        brand: be.brand || '',
                        bag: bVal,
                        qty: be.qty !== undefined ? be.qty : '',
                        sweepedPacket: swpPkt,
                        sweepedQuantity: swpQty,
                        inHousePacket: inHousePkt,
                        inHouseQuantity: inHouseQty,
                        rate: be.rate !== undefined ? be.rate : '',
                        total: be.total || 0
                    };
                });
                return { ...item, brandEntries: bEntries };
            }
            const pktSize = getProductPacketSize(item.productName || item.product || '', item.brand || '');
            const qVal = parseFloat(item.qty) || 0;
            const bVal = item.bag !== undefined && item.bag !== '' ? item.bag : (item.packet !== undefined && item.packet !== '' ? item.packet : (qVal > 0 && pktSize > 0 ? (qVal / pktSize) : ''));
            const swpPkt = item.sweepedPacket || '';
            const swpQty = item.sweepedQuantity || '';
            const inHousePkt = item.inHousePacket !== undefined && item.inHousePacket !== '' ? item.inHousePacket : (bVal !== '' ? (Math.max(0, parseFloat(bVal) - (parseFloat(swpPkt) || 0))).toString() : '');
            const inHouseQty = item.inHouseQuantity !== undefined && item.inHouseQuantity !== '' ? item.inHouseQuantity : (qVal !== 0 ? (Math.max(0, qVal - (parseFloat(swpQty) || 0))).toString() : '');

            return {
                productName: item.productName || item.product || '',
                brandEntries: [
                    {
                        brand: item.brand || '',
                        bag: bVal,
                        qty: item.qty || '',
                        sweepedPacket: swpPkt,
                        sweepedQuantity: swpQty,
                        inHousePacket: inHousePkt,
                        inHouseQuantity: inHouseQty,
                        rate: item.rate || item.purchasedPrice || '',
                        total: item.total || 0
                    }
                ],
                total: item.total || 0
            };
        });

        setFormData(prev => ({
            ...prev,
            purchaseReceiveNo: pNo || prev.purchaseReceiveNo,
            purchaseNo: pNo,
            supplierName: p.supplierName || p.companyName || prev.supplierName,
            companyName: p.companyName || p.supplierName || prev.companyName,
            lcNo: p.lcNo || prev.lcNo,
            challanNo: p.challanNo || prev.challanNo,
            truckNo: p.truckNo || prev.truckNo,
            warehouse: p.warehouse || prev.warehouse,
            items: normalizedItems.length > 0 ? normalizedItems : prev.items,
            discount: p.discount !== undefined ? p.discount : prev.discount,
            totalAmount: p.totalAmount !== undefined ? p.totalAmount : prev.totalAmount,
            paidAmount: p.paidAmount !== undefined ? p.paidAmount : prev.paidAmount,
            dueAmount: p.dueAmount !== undefined ? p.dueAmount : prev.dueAmount,
            remarks: p.remarks || prev.remarks
        }));
        setIsPurchaseDropdownOpen(false);
    };

    const handleOpenModal = (purchaseToEdit = null) => {
        if (purchaseToEdit) {
            setEditingId(purchaseToEdit._id);
            const normalizedItems = (purchaseToEdit.items || []).map(item => {
                if (item.brandEntries && item.brandEntries.length > 0) {
                    const bEntries = item.brandEntries.map(be => {
                        const pktSize = getProductPacketSize(item.productName || item.product || '', be.brand || '');
                        const qVal = parseFloat(be.qty) || 0;
                        const bVal = be.bag !== undefined && be.bag !== '' ? be.bag : (be.packet !== undefined && be.packet !== '' ? be.packet : (qVal > 0 && pktSize > 0 ? (qVal / pktSize) : ''));
                        return {
                            ...be,
                            bag: bVal,
                            qty: be.qty !== undefined ? be.qty : '',
                            rate: be.rate !== undefined ? be.rate : '',
                            total: be.total || 0
                        };
                    });
                    return { ...item, brandEntries: bEntries };
                }
                const pktSize = getProductPacketSize(item.productName || item.product || '', item.brand || '');
                const qVal = parseFloat(item.qty) || 0;
                const bVal = item.bag !== undefined && item.bag !== '' ? item.bag : (item.packet !== undefined && item.packet !== '' ? item.packet : (qVal > 0 && pktSize > 0 ? (qVal / pktSize) : ''));
                return {
                    productName: item.productName || item.product || '',
                    brandEntries: [
                        { brand: item.brand || '', bag: bVal, qty: item.qty || '', rate: item.rate || item.purchasedPrice || '', total: item.total || 0 }
                    ],
                    total: item.total || 0
                };
            });
            setFormData({
                ...purchaseToEdit,
                purchaseReceiveNo: purchaseToEdit.purchaseReceiveNo || purchaseToEdit.purchaseNo || '',
                items: normalizedItems
            });
        } else {
            resetForm();
        }
        setShowModal(true);
    };

    const recalculateTotals = (updatedItems) => {
        let grandTotal = 0;
        updatedItems.forEach(item => {
            let itemTotal = 0;
            if (item.brandEntries && item.brandEntries.length > 0) {
                item.brandEntries.forEach(b => {
                    const effQty = parseFloat(b.inHouseQuantity) || parseFloat(b.qty) || 0;
                    const r = parseFloat(b.rate) || 0;
                    b.total = effQty * r;
                    itemTotal += b.total;
                });
            }
            item.total = itemTotal;
            grandTotal += itemTotal;
        });

        const paid = parseFloat(formData.paidAmount) || 0;
        const due = Math.max(0, grandTotal - paid);

        setFormData(prev => ({
            ...prev,
            items: updatedItems,
            totalAmount: grandTotal,
            dueAmount: due
        }));
    };

    const handleProductChange = (pIdx, name) => {
        const updatedItems = [...formData.items];
        updatedItems[pIdx].productName = name;
        if (updatedItems[pIdx].brandEntries) {
            updatedItems[pIdx].brandEntries.forEach(be => {
                const pktSize = getProductPacketSize(name, be.brand);
                if (pktSize > 0) {
                    if (be.bag && !be.qty) {
                        const bagVal = parseFloat(be.bag) || 0;
                        be.qty = (bagVal * pktSize).toString();
                    } else if (be.qty && !be.bag) {
                        const qtyVal = parseFloat(be.qty) || 0;
                        const calcBag = qtyVal / pktSize;
                        be.bag = calcBag % 1 === 0 ? calcBag.toString() : calcBag.toFixed(2);
                    }
                }
            });
        }
        setFormData(prev => ({ ...prev, items: updatedItems }));
    };

    const handleBrandChange = (pIdx, bIdx, field, value) => {
        const updatedItems = [...formData.items];
        if (!updatedItems[pIdx].brandEntries) {
            updatedItems[pIdx].brandEntries = [{ brand: '', bag: '', qty: '', sweepedPacket: '', sweepedQuantity: '', inHousePacket: '', inHouseQuantity: '', rate: '', total: 0 }];
        }
        const bRow = updatedItems[pIdx].brandEntries[bIdx];
        bRow[field] = value;

        const currentBrand = bRow.brand || '';
        let pktSize = getProductPacketSize(updatedItems[pIdx].productName, currentBrand);

        if (pktSize <= 0) {
            const arrQty = parseFloat(bRow.qty) || 0;
            const arrBag = parseFloat(bRow.bag) || 0;
            if (arrQty > 0 && arrBag > 0) {
                pktSize = arrQty / arrBag;
            }
        }

        if (field === 'brand') {
            const currentBag = parseFloat(bRow.bag) || 0;
            const currentQty = parseFloat(bRow.qty) || 0;
            if (pktSize > 0) {
                if (currentBag > 0 && !bRow.qty) {
                    const calculatedQty = currentBag * pktSize;
                    bRow.qty = calculatedQty.toString();
                } else if (currentQty > 0 && !bRow.bag) {
                    const calculatedBag = currentQty / pktSize;
                    bRow.bag = calculatedBag % 1 === 0 ? calculatedBag.toString() : calculatedBag.toFixed(2);
                }
            }
        } else if (field === 'bag') {
            const bagVal = parseFloat(value);
            if (!isNaN(bagVal) && bagVal >= 0 && value !== '') {
                if (pktSize > 0) {
                    const calculatedQty = bagVal * pktSize;
                    bRow.qty = calculatedQty === 0 ? '' : calculatedQty.toString();
                }
            } else if (value === '') {
                bRow.qty = '';
            }
        } else if (field === 'qty') {
            const qtyVal = parseFloat(value);
            if (!isNaN(qtyVal) && qtyVal >= 0 && value !== '') {
                if (pktSize > 0) {
                    const calculatedBag = qtyVal / pktSize;
                    const formattedBag = calculatedBag % 1 === 0 ? calculatedBag.toString() : calculatedBag.toFixed(2);
                    bRow.bag = calculatedBag === 0 ? '' : formattedBag;
                }
            } else if (value === '') {
                bRow.bag = '';
            }
        } else if (field === 'sweepedPacket') {
            const swpBagVal = parseFloat(value);
            if (!isNaN(swpBagVal) && swpBagVal >= 0 && value !== '') {
                if (pktSize > 0) {
                    const calculatedSwpQty = swpBagVal * pktSize;
                    bRow.sweepedQuantity = calculatedSwpQty === 0 ? '' : calculatedSwpQty.toString();
                }
            } else if (value === '') {
                bRow.sweepedQuantity = '';
            }
        } else if (field === 'sweepedQuantity') {
            const swpQtyVal = parseFloat(value);
            if (!isNaN(swpQtyVal) && swpQtyVal >= 0 && value !== '') {
                if (pktSize > 0) {
                    const calculatedSwpBag = swpQtyVal / pktSize;
                    const formattedSwpBag = calculatedSwpBag % 1 === 0 ? calculatedSwpBag.toString() : calculatedSwpBag.toFixed(2);
                    bRow.sweepedPacket = calculatedSwpBag === 0 ? '' : formattedSwpBag;
                }
            } else if (value === '') {
                bRow.sweepedPacket = '';
            }
        } else if (field === 'inHousePacket') {
            const ihBagVal = parseFloat(value);
            if (!isNaN(ihBagVal) && ihBagVal >= 0 && value !== '') {
                if (pktSize > 0) {
                    const calculatedIhQty = ihBagVal * pktSize;
                    bRow.inHouseQuantity = calculatedIhQty === 0 ? '' : calculatedIhQty.toString();
                }
            } else if (value === '') {
                bRow.inHouseQuantity = '';
            }
        } else if (field === 'inHouseQuantity') {
            const ihQtyVal = parseFloat(value);
            if (!isNaN(ihQtyVal) && ihQtyVal >= 0 && value !== '') {
                if (pktSize > 0) {
                    const calculatedIhBag = ihQtyVal / pktSize;
                    const formattedIhBag = calculatedIhBag % 1 === 0 ? calculatedIhBag.toString() : calculatedIhBag.toFixed(2);
                    bRow.inHousePacket = calculatedIhBag === 0 ? '' : formattedIhBag;
                }
            } else if (value === '') {
                bRow.inHousePacket = '';
            }
        }

        // Auto-recalculate InHouse from (Arrival - SWP) when editing Arrival or SWP fields
        if (['brand', 'bag', 'qty', 'sweepedPacket', 'sweepedQuantity'].includes(field)) {
            const arrBag = parseFloat(bRow.bag) || 0;
            const arrQty = parseFloat(bRow.qty) || 0;
            const swpBag = parseFloat(bRow.sweepedPacket) || 0;
            const swpQty = parseFloat(bRow.sweepedQuantity) || 0;

            const ihBag = Math.max(0, arrBag - swpBag);
            const ihQty = Math.max(0, arrQty - swpQty);

            bRow.inHousePacket = (bRow.bag !== '' || bRow.sweepedPacket !== '') ? (ihBag % 1 === 0 ? ihBag.toString() : ihBag.toFixed(2)) : '';
            bRow.inHouseQuantity = (bRow.qty !== '' || bRow.sweepedQuantity !== '') ? (ihQty % 1 === 0 ? ihQty.toString() : ihQty.toFixed(2)) : '';
        }

        const effQty = parseFloat(bRow.inHouseQuantity) || parseFloat(bRow.qty) || 0;

        if (field === 'total') {
            const totVal = parseFloat(value) || 0;
            if (effQty > 0) {
                const calcRate = totVal / effQty;
                bRow.rate = calcRate % 1 === 0 ? calcRate.toString() : calcRate.toFixed(2);
            }
            bRow.total = totVal;
        }

        if (field !== 'total') {
            const r = parseFloat(bRow.rate) || 0;
            bRow.total = effQty * r;
        }

        recalculateTotals(updatedItems);
    };

    const addBrandRow = (pIdx) => {
        const updatedItems = [...formData.items];
        if (!updatedItems[pIdx].brandEntries) {
            updatedItems[pIdx].brandEntries = [];
        }
        updatedItems[pIdx].brandEntries.push({ brand: '', bag: '', qty: '', sweepedPacket: '', sweepedQuantity: '', inHousePacket: '', inHouseQuantity: '', rate: '', total: 0 });
        setFormData(prev => ({ ...prev, items: updatedItems }));
    };

    const removeBrandRow = (pIdx, bIdx) => {
        const updatedItems = [...formData.items];
        updatedItems[pIdx].brandEntries.splice(bIdx, 1);
        if (updatedItems[pIdx].brandEntries.length === 0) {
            updatedItems[pIdx].brandEntries.push({ brand: '', bag: '', qty: '', sweepedPacket: '', sweepedQuantity: '', inHousePacket: '', inHouseQuantity: '', rate: '', total: 0 });
        }
        recalculateTotals(updatedItems);
    };

    const addProductItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [
                ...prev.items,
                { productName: '', brandEntries: [{ brand: '', bag: '', qty: '', sweepedPacket: '', sweepedQuantity: '', inHousePacket: '', inHouseQuantity: '', rate: '', total: 0 }], total: 0 }
            ]
        }));
    };

    const removeProductItem = (pIdx) => {
        if (formData.items.length <= 1) return;
        const updatedItems = formData.items.filter((_, idx) => idx !== pIdx);
        recalculateTotals(updatedItems);
    };

    const updateWarehouseStockForPurchaseReceive = async (purchaseData) => {
        if (!purchaseData) return;
        try {
            const prId = (purchaseData._id || '').toString();
            const pNo = (purchaseData.purchaseNo || purchaseData.purchaseReceiveNo || '').trim();
            const prDate = purchaseData.date || new Date().toISOString().split('T')[0];
            const prWarehouse = (purchaseData.warehouse || 'HILI').trim();
            const prCompany = (purchaseData.companyName || purchaseData.supplierName || '').trim();
            const prCreatedAt = purchaseData.createdAt || new Date().toISOString();

            const stockRes = await axios.get(`${API_BASE_URL}/api/stock`);
            const existingStock = Array.isArray(stockRes.data) ? stockRes.data : [];

            const myStockRecords = existingStock.filter(s =>
                (prId && s.purchaseReceiveId === prId) ||
                (!s.purchaseReceiveId && (s.lcNo || '').trim().toUpperCase() === pNo.toUpperCase() && s.date === prDate && (s.warehouse || s.whName || '').trim().toUpperCase() === prWarehouse.toUpperCase())
            );

            const claimedStockIds = new Set();

            for (const item of (purchaseData.items || [])) {
                const pName = (item.productName || item.product || '').trim();
                if (!pName) continue;
                const unit = item.unit || 'kg';

                const entries = (item.brandEntries && item.brandEntries.length > 0)
                    ? item.brandEntries
                    : [{ brand: item.brand || '', qty: item.qty || 0, rate: item.rate || 0, bag: item.bag || 0 }];

                for (const be of entries) {
                    const bName = (be.brand || '').trim();
                    if (!bName) continue;

                    const inHouseQ = parseFloat(be.inHouseQuantity);
                    const normalQ = parseFloat(be.qty);
                    const swpQ = parseFloat(be.sweepedQuantity || be.swpQty || 0);
                    const effQty = (!isNaN(inHouseQ) && inHouseQ > 0) ? inHouseQ : Math.max(0, (isNaN(normalQ) ? 0 : normalQ) - swpQ);

                    const inHouseB = parseFloat(be.inHousePacket);
                    const normalB = parseFloat(be.bag || be.packet);
                    const swpB = parseFloat(be.sweepedPacket || be.swpBag || 0);
                    const effBag = (!isNaN(inHouseB) && inHouseB > 0) ? inHouseB : Math.max(0, (isNaN(normalB) ? 0 : normalB) - swpB);

                    if (effQty <= 0) continue;

                    const pktSize = getProductPacketSize(pName, bName) || (effBag > 0 ? effQty / effBag : 25);
                    const rate = parseFloat(be.rate) || 0;

                    const matchedStock = myStockRecords.find(s =>
                        !claimedStockIds.has(s._id) &&
                        (s.productName || s.product || '').trim().toLowerCase() === pName.toLowerCase() &&
                        (s.brand || '').trim().toLowerCase() === bName.toLowerCase()
                    );

                    const recordPayload = {
                        purchaseReceiveId: prId,
                        date: prDate,
                        createdAt: prCreatedAt,
                        lcNo: pNo,
                        warehouse: prWarehouse,
                        whName: prWarehouse,
                        port: prWarehouse,
                        productName: pName,
                        brand: bName,
                        quantity: effQty,
                        inHouseQuantity: effQty,
                        totalInHouseQuantity: effQty,
                        packet: effBag,
                        inHousePacket: effBag,
                        totalInHousePacket: effBag,
                        packetSize: pktSize,
                        exporter: prCompany,
                        purchasedPrice: rate,
                        status: 'Accepted',
                        requestedBy: 'PurchaseReceive',
                        requestedByUsername: 'PurchaseReceive',
                        unit: unit
                    };

                    if (matchedStock) {
                        claimedStockIds.add(matchedStock._id);
                        const { _id, ...rest } = matchedStock;
                        await axios.put(`${API_BASE_URL}/api/stock/${_id}`, {
                            ...rest,
                            ...recordPayload
                        });
                    } else {
                        const postRes = await axios.post(`${API_BASE_URL}/api/stock`, recordPayload);
                        if (postRes?.data?._id) {
                            claimedStockIds.add(postRes.data._id);
                        }
                    }
                }
            }

            for (const s of myStockRecords) {
                if (!claimedStockIds.has(s._id) && s.purchaseReceiveId === prId) {
                    await axios.delete(`${API_BASE_URL}/api/stock/${s._id}`);
                }
            }

            if (typeof fetchStockRecords === 'function') {
                fetchStockRecords();
            }
        } catch (err) {
            console.error('Error updating warehouse stock for purchase receive:', err);
        }
    };

    const reverseWarehouseStockForPurchaseReceive = async (purchaseData) => {
        if (!purchaseData) return;
        try {
            const prId = (purchaseData._id || '').toString();
            const pNo = (purchaseData.purchaseNo || purchaseData.purchaseReceiveNo || '').trim();
            const prDate = purchaseData.date;

            const stockRes = await axios.get(`${API_BASE_URL}/api/stock`);
            const existingStock = Array.isArray(stockRes.data) ? stockRes.data : [];

            const stockToDelete = existingStock.filter(s =>
                (prId && s.purchaseReceiveId === prId) ||
                (!s.purchaseReceiveId && (s.lcNo || '').trim().toUpperCase() === pNo.toUpperCase() && s.date === prDate)
            );

            for (const s of stockToDelete) {
                await axios.delete(`${API_BASE_URL}/api/stock/${s._id}`);
            }

            if (typeof fetchStockRecords === 'function') {
                fetchStockRecords();
            }
        } catch (err) {
            console.error('Error reversing warehouse stock for purchase receive:', err);
        }
    };

    const syncAllPurchaseReceiveStock = async (purchasesList) => {
        try {
            const stockRes = await axios.get(`${API_BASE_URL}/api/stock`);
            const existingStock = Array.isArray(stockRes.data) ? stockRes.data : [];

            const acceptedPRs = (purchasesList || []).filter(p => {
                const s = (p.status || 'Accepted').toLowerCase();
                return s === 'accepted' || s === 'approved';
            });

            const claimedStockIds = new Set();
            let hasChanges = false;

            for (const pr of acceptedPRs) {
                const prId = (pr._id || '').toString();
                const pNo = (pr.purchaseNo || pr.purchaseReceiveNo || '').trim();
                const prDate = pr.date || new Date().toISOString().split('T')[0];
                const prWarehouse = (pr.warehouse || 'HILI').trim();
                const prCompany = (pr.companyName || pr.supplierName || '').trim();
                const prCreatedAt = pr.createdAt || new Date().toISOString();

                for (const item of (pr.items || [])) {
                    const pName = (item.productName || item.product || '').trim();
                    if (!pName) continue;
                    const unit = item.unit || 'kg';

                    const entries = (item.brandEntries && item.brandEntries.length > 0)
                        ? item.brandEntries
                        : [{ brand: item.brand || '', qty: item.qty || 0, rate: item.rate || 0, bag: item.bag || 0 }];

                    for (const be of entries) {
                        const bName = (be.brand || '').trim();
                        if (!bName) continue;

                        const inHouseQ = parseFloat(be.inHouseQuantity);
                        const normalQ = parseFloat(be.qty);
                        const swpQ = parseFloat(be.sweepedQuantity || be.swpQty || 0);
                        const effQty = (!isNaN(inHouseQ) && inHouseQ > 0) ? inHouseQ : Math.max(0, (isNaN(normalQ) ? 0 : normalQ) - swpQ);

                        const inHouseB = parseFloat(be.inHousePacket);
                        const normalB = parseFloat(be.bag || be.packet);
                        const swpB = parseFloat(be.sweepedPacket || be.swpBag || 0);
                        const effBag = (!isNaN(inHouseB) && inHouseB > 0) ? inHouseB : Math.max(0, (isNaN(normalB) ? 0 : normalB) - swpB);

                        if (effQty <= 0) continue;

                        const pktSize = getProductPacketSize(pName, bName) || (effBag > 0 ? effQty / effBag : 25);
                        const rate = parseFloat(be.rate) || 0;

                        let match = existingStock.find(s =>
                            !claimedStockIds.has(s._id) &&
                            s.purchaseReceiveId === prId &&
                            (s.productName || s.product || '').trim().toLowerCase() === pName.toLowerCase() &&
                            (s.brand || '').trim().toLowerCase() === bName.toLowerCase()
                        );

                        if (!match) {
                            match = existingStock.find(s =>
                                !claimedStockIds.has(s._id) &&
                                !s.purchaseReceiveId &&
                                (s.lcNo || '').trim().toUpperCase() === pNo.toUpperCase() &&
                                (s.productName || s.product || '').trim().toLowerCase() === pName.toLowerCase() &&
                                (s.brand || '').trim().toLowerCase() === bName.toLowerCase() &&
                                s.date === prDate
                            );
                        }

                        if (!match) {
                            match = existingStock.find(s =>
                                !claimedStockIds.has(s._id) &&
                                !s.purchaseReceiveId &&
                                (s.lcNo || '').trim().toUpperCase() === pNo.toUpperCase() &&
                                (s.productName || s.product || '').trim().toLowerCase() === pName.toLowerCase() &&
                                (s.brand || '').trim().toLowerCase() === bName.toLowerCase()
                            );
                        }

                        const recordPayload = {
                            purchaseReceiveId: prId,
                            date: prDate,
                            createdAt: prCreatedAt,
                            lcNo: pNo,
                            warehouse: prWarehouse,
                            whName: prWarehouse,
                            port: prWarehouse,
                            productName: pName,
                            brand: bName,
                            quantity: effQty,
                            inHouseQuantity: effQty,
                            totalInHouseQuantity: effQty,
                            packet: effBag,
                            inHousePacket: effBag,
                            totalInHousePacket: effBag,
                            packetSize: pktSize,
                            exporter: prCompany,
                            purchasedPrice: rate,
                            status: 'Accepted',
                            requestedBy: 'PurchaseReceive',
                            requestedByUsername: 'PurchaseReceive',
                            unit: unit
                        };

                        if (match) {
                            claimedStockIds.add(match._id);
                            if (match.purchaseReceiveId !== prId || match.date !== prDate || parseFloat(match.quantity) !== effQty || (match.warehouse || match.whName) !== prWarehouse) {
                                const { _id, ...rest } = match;
                                await axios.put(`${API_BASE_URL}/api/stock/${_id}`, { ...rest, ...recordPayload });
                                hasChanges = true;
                            }
                        } else {
                            const postRes = await axios.post(`${API_BASE_URL}/api/stock`, recordPayload);
                            if (postRes?.data?._id) claimedStockIds.add(postRes.data._id);
                            hasChanges = true;
                        }
                    }
                }
            }

            if (hasChanges && typeof fetchStockRecords === 'function') {
                fetchStockRecords();
            }
        } catch (e) {
            console.error('Error syncing all purchase receive stock:', e);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const isAdmin = currentUser?.username === 'admin' || (currentUser?.role || '').toLowerCase() === 'admin';
            const initialStatus = (canApprove || isAdmin) ? 'Accepted' : 'Requested';
            const generatedNo = formData.purchaseReceiveNo || formData.purchaseNo || `PR-REC-${String(purchaseReceives.length + 1).padStart(4, '0')}`;
            const payload = {
                ...formData,
                purchaseReceiveNo: generatedNo,
                purchaseNo: generatedNo,
                status: editingId ? (formData.status || 'Requested') : initialStatus,
                createdBy: currentUser?.username || 'User'
            };

            const now = new Date();
            const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const employeeName = currentUser?.name || currentUser?.username || 'An employee';
            const targetRoles = ['admin', 'incharge', 'purchase manager'];
            const targetUsers = [payload.createdBy].filter(Boolean);
            if (!targetUsers.includes('admin')) targetUsers.push('admin');

            if (editingId) {
                const res = await axios.put(`${API_BASE_URL}/api/purchase-receives/${editingId}`, payload);
                const savedPR = res.data || { ...payload, _id: editingId };
                if (savedPR.status === 'Accepted' || savedPR.status === 'Approved') {
                    await updateWarehouseStockForPurchaseReceive(savedPR);
                } else {
                    await reverseWarehouseStockForPurchaseReceive(savedPR);
                }
                if (addNotification) {
                    await addNotification(
                        'Purchase Receive Updated',
                        `${dateStr} | ${timeStr} | ${employeeName} has updated purchase receive entry (${generatedNo})`,
                        targetRoles,
                        targetUsers
                    );
                }
            } else {
                const res = await axios.post(`${API_BASE_URL}/api/purchase-receives`, payload);
                const savedPR = res.data || payload;
                if (savedPR.status === 'Accepted' || savedPR.status === 'Approved') {
                    await updateWarehouseStockForPurchaseReceive(savedPR);
                }
                if (addNotification) {
                    await addNotification(
                        payload.status === 'Accepted'
                            ? 'New Purchase Receive Entry Saved'
                            : 'New Purchase Receive Requested',
                        `${dateStr} | ${timeStr} | ${employeeName} has ${payload.status === 'Accepted' ? 'added' : 'requested'} purchase receive entry (${generatedNo})`,
                        targetRoles,
                        targetUsers
                    );
                }
            }

            setShowModal(false);
            if (!editingId && payload.status === 'Requested') setIsRequestedOnly(true);
            fetchPurchaseReceives();
            if (typeof fetchStockRecords === 'function') fetchStockRecords();
            if (typeof refreshPendingIndicators === 'function') refreshPendingIndicators();
        } catch (error) {
            console.error('Error saving purchase receive:', error);
            if (addNotification) addNotification('Error', 'Failed to save purchase receive entry.', ['admin'], [currentUser?.username]);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatusUpdate = async (purchase, newStatus) => {
        try {
            const updated = { ...purchase, status: newStatus };
            const res = await axios.put(`${API_BASE_URL}/api/purchase-receives/${purchase._id}`, updated);
            const savedPR = res.data || updated;
            const statusLower = (newStatus || '').toLowerCase();
            if (statusLower === 'approved' || statusLower === 'accepted') {
                await updateWarehouseStockForPurchaseReceive(savedPR);
            } else if (statusLower === 'rejected' || statusLower === 'deleted' || statusLower === 'requested') {
                await reverseWarehouseStockForPurchaseReceive(savedPR);
            }
            if (addNotification) {
                const now = new Date();
                const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const employeeName = currentUser?.name || currentUser?.username || 'An employee';
                await addNotification(
                    `Purchase Receive Request ${newStatus}`,
                    `${dateStr} | ${timeStr} | Purchase receive entry (${purchase.purchaseReceiveNo || purchase.purchaseNo}) was ${newStatus.toLowerCase()} by ${employeeName}`,
                    ['admin', 'incharge', 'purchase manager'],
                    [purchase.createdBy, 'admin'].filter(Boolean)
                );
            }
            fetchPurchaseReceives();
            if (typeof fetchStockRecords === 'function') fetchStockRecords();
            if (typeof refreshPendingIndicators === 'function') refreshPendingIndicators();
        } catch (error) {
            console.error('Error updating purchase receive status:', error);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this purchase receive entry?')) return;
        try {
            const purchaseToDelete = purchaseReceives.find(p => p._id === id);
            await axios.delete(`${API_BASE_URL}/api/purchase-receives/${id}`);
            if (purchaseToDelete) {
                await reverseWarehouseStockForPurchaseReceive(purchaseToDelete);
            }
            if (addNotification) addNotification('Purchase receive deleted and stock reversed successfully!', 'success');
            fetchPurchaseReceives();
            if (typeof fetchStockRecords === 'function') fetchStockRecords();
        } catch (error) {
            console.error('Error deleting purchase receive:', error);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Purchase Receive Management</h2>
                </div>

                {/* Center Search & Requested Toggle */}
                <div className="flex-1 w-full max-w-none md:max-w-xl mx-auto flex flex-col items-center gap-2">
                    <div className="w-full relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by receipt no, company, LC no, challan..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsRequestedOnly(!isRequestedOnly)}
                            className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${isRequestedOnly ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}
                        >
                            Requested
                            {requestedCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center px-1 rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-pulse border-2 border-white">
                                    {requestedCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="w-full md:w-auto flex items-center justify-end gap-2">
                    {canAdd && (
                        <button
                            onClick={() => handleOpenModal()}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all transform active:scale-95 flex items-center gap-2 text-sm h-[42px]"
                        >
                            <PlusIcon className="w-4 h-4" /> <span>Add Purchase Receive</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-blue-100 p-4 rounded-2xl shadow-sm">
                    <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">Total Purchase Receives</div>
                    <div className="text-xl font-black text-gray-900 mt-1">৳ {stats.totalPurchases.toLocaleString('en-IN')}</div>
                </div>
                <div className="bg-white border border-emerald-100 p-4 rounded-2xl shadow-sm">
                    <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Total Paid</div>
                    <div className="text-xl font-black text-emerald-600 mt-1">৳ {stats.totalPaid.toLocaleString('en-IN')}</div>
                </div>
                <div className="bg-white border border-orange-100 p-4 rounded-2xl shadow-sm">
                    <div className="text-xs font-bold text-orange-600 uppercase tracking-wider">Total Balance</div>
                    <div className="text-xl font-black text-orange-600 mt-1">৳ {stats.totalDue.toLocaleString('en-IN')}</div>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="sale-mgmt-table hidden md:table w-full">
                        <thead>
                            <tr>
                                <th className="sale-mgmt-th">Date</th>
                                <th className="sale-mgmt-th">Receipt No</th>
                                <th className="sale-mgmt-th">Supplier / Company</th>
                                <th className="sale-mgmt-th">Warehouse</th>
                                <th className="sale-mgmt-th">Product</th>
                                <th className="sale-mgmt-th">Brand</th>
                                <th className="sale-mgmt-th text-center">Arrival Qty</th>
                                <th className="sale-mgmt-th text-center">SWP Qty</th>
                                <th className="sale-mgmt-th text-center">InHouse Qty</th>
                                <th className="sale-mgmt-th text-center">Price</th>
                                <th className="sale-mgmt-th text-center">Total Amount</th>
                                <th className="sale-mgmt-th text-center">Paid</th>
                                <th className="sale-mgmt-th text-center">Balance</th>
                                <th className="sale-mgmt-th text-center">Status</th>
                                <th className="sale-mgmt-th text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={15} className="px-6 py-12 text-center text-gray-500 font-medium">
                                        Loading purchase receive records...
                                    </td>
                                </tr>
                            ) : filteredPurchaseReceives.length > 0 ? (
                                filteredPurchaseReceives.map(p => (
                                    <tr key={p._id} className={`hover:bg-blue-50/50 transition-all border-b border-gray-50 last:border-0 align-middle ${highlightId && (String(p._id) === String(highlightId) || ((p.purchaseReceiveNo || p.purchaseNo) && String(p.purchaseReceiveNo || p.purchaseNo).toLowerCase().trim() === String(highlightId).toLowerCase().trim())) ? "notif-row-highlight" : ""}`} ref={el => { if (p.purchaseReceiveNo || p.purchaseNo) rowRefs.current[p.purchaseReceiveNo || p.purchaseNo] = el; }}
                                        style={highlightId && (String(p._id) === String(highlightId) || ((p.purchaseReceiveNo || p.purchaseNo) && String(p.purchaseReceiveNo || p.purchaseNo).toLowerCase().trim() === String(highlightId).toLowerCase().trim())) ? { borderLeft: '5px solid #f59e0b' } : undefined}>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-600 align-top">{formatDate(p.date)}</td>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 align-top">{p.purchaseReceiveNo || p.purchaseNo || '—'}</td>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm font-semibold text-gray-800 align-top">{p.companyName || p.supplierName || '—'}</td>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-600 font-bold align-top">{p.warehouse || 'HILI'}</td>
                                        <td className="px-3 py-4 text-sm font-semibold text-gray-800 align-top">
                                            <div className="space-y-1">
                                                {getPurchaseBrandEntries(p).map((e, idx) => (
                                                    <div key={idx}>{e.productName}</div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 text-sm text-gray-600 align-top">
                                            <div className="space-y-1">
                                                {getPurchaseBrandEntries(p).map((e, idx) => (
                                                    <div key={idx}>{e.brand}</div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 text-center text-sm font-bold text-blue-600 align-top">
                                            <div className="space-y-1">
                                                {getPurchaseBrandEntries(p).map((e, idx) => (
                                                    <div key={idx}>{e.qty ? e.qty.toLocaleString('en-US') : '0'}</div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 text-center text-sm font-bold text-rose-600 align-top">
                                            <div className="space-y-1">
                                                {getPurchaseBrandEntries(p).map((e, idx) => (
                                                    <div key={idx}>{e.swpQty ? e.swpQty.toLocaleString('en-US') : '0'}</div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 text-center text-sm font-bold text-emerald-600 align-top">
                                            <div className="space-y-1">
                                                {getPurchaseBrandEntries(p).map((e, idx) => (
                                                    <div key={idx}>{e.inHouseQty ? e.inHouseQty.toLocaleString('en-US') : '0'}</div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 text-center text-sm text-gray-600 align-top">
                                            <div className="space-y-1">
                                                {getPurchaseBrandEntries(p).map((e, idx) => (
                                                    <div key={idx}>৳ {e.rate ? e.rate.toLocaleString('en-IN') : '0'}</div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 text-center text-sm font-bold text-gray-900 align-top">
                                            ৳ {getPRTotals(p).totalAmount.toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-3 py-4 text-center text-sm font-semibold text-emerald-600 align-top">
                                            ৳ {getPRTotals(p).paidAmount.toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-3 py-4 text-center text-sm font-semibold text-orange-600 align-top">
                                            ৳ {getPRTotals(p).dueAmount.toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-3 py-4 text-center whitespace-nowrap align-top">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                (p.status || 'Accepted').toLowerCase() === 'accepted' || (p.status || '').toLowerCase() === 'approved'
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    : (p.status || '').toLowerCase() === 'requested'
                                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    : 'bg-red-50 text-red-700 border border-red-200'
                                            }`}>
                                                {p.status || 'Accepted'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-4 text-center whitespace-nowrap text-sm align-top">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {canApprove && ((p.status || '').toLowerCase() === 'requested') && (
                                                    <>
                                                        <button
                                                            onClick={() => handleStatusUpdate(p, 'Accepted')}
                                                            className="p-1 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 rounded transition-colors"
                                                            title="Accept"
                                                        >
                                                            <CheckIcon className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleStatusUpdate(p, 'Rejected')}
                                                            className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"
                                                            title="Reject"
                                                        >
                                                            <XIcon className="w-5 h-5" />
                                                        </button>
                                                    </>
                                                )}
                                                {canEdit && (
                                                    <button
                                                        onClick={() => handleOpenModal(p)}
                                                        className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors"
                                                        title="Edit"
                                                    >
                                                        <EditIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDelete(p._id)}
                                                        className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"
                                                        title="Delete"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={15} className="px-6 py-12 text-center text-gray-400">
                                        No purchase receive records found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Mobile View Cards */}
                    <div className="block md:hidden divide-y divide-gray-100">
                        {filteredPurchaseReceives.map(p => (
                            <div key={p._id} className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-blue-600">{p.purchaseReceiveNo || p.purchaseNo || '—'}</span>
                                    <span className="text-xs text-gray-500">{formatDate(p.date)}</span>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-gray-900">{p.companyName || p.supplierName || '—'}</div>
                                    <div className="text-xs text-gray-500">Warehouse: {p.warehouse || 'HILI'}</div>
                                </div>
                                <div className="bg-gray-50 p-2.5 rounded-xl space-y-1.5 text-xs">
                                    {getPurchaseBrandEntries(p).map((e, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-gray-700">
                                            <span>{e.productName} ({e.brand})</span>
                                            <div className="text-right">
                                                <span className="font-bold text-blue-600">Arr: {e.qty}</span>
                                                {e.swpQty > 0 && <span className="font-bold text-rose-600 ml-1">SWP: {e.swpQty}</span>}
                                                <span className="font-bold text-emerald-600 ml-1">IH: {e.inHouseQty}</span>
                                                <span className="font-semibold text-gray-600 ml-1">@ ৳{e.rate}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                                    <div>Total: <span className="font-bold text-gray-900">৳{getPRTotals(p).totalAmount.toLocaleString('en-IN')}</span></div>
                                    <div>Paid: <span className="font-bold text-emerald-600">৳{getPRTotals(p).paidAmount.toLocaleString('en-IN')}</span></div>
                                    <div>Due: <span className="font-bold text-orange-600">৳{getPRTotals(p).dueAmount.toLocaleString('en-IN')}</span></div>
                                </div>
                                 <div className="flex items-center justify-between pt-1">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                        (p.status || 'Accepted').toLowerCase() === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                    }`}>{p.status || 'Requested'}</span>
                                    <div className="flex items-center gap-1.5">
                                        {canApprove && ((p.status || '').toLowerCase() === 'requested') && (
                                            <>
                                                <button
                                                    onClick={() => handleStatusUpdate(p, 'Accepted')}
                                                    className="p-1 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 rounded transition-colors"
                                                    title="Accept"
                                                >
                                                    <CheckIcon className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleStatusUpdate(p, 'Rejected')}
                                                    className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"
                                                    title="Reject"
                                                >
                                                    <XIcon className="w-5 h-5" />
                                                </button>
                                            </>
                                        )}
                                        {canEdit && (
                                            <button
                                                onClick={() => handleOpenModal(p)}
                                                className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors"
                                                title="Edit"
                                            >
                                                <EditIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                        {canDelete && (
                                            <button
                                                onClick={() => handleDelete(p._id)}
                                                className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Modal for Create/Edit */}
            {showModal && (
                <div className="fixed inset-0 z-[5000] overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 app-modal-overlay">
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-gray-100">
                        {/* Header */}
                        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
                            <h3 className="text-lg font-bold">
                                {editingId ? 'Edit Purchase Receive' : 'New Purchase Receive Entry'}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                            {/* Form Header Info Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <CustomDatePicker
                                    label="Date"
                                    name="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                    compact={true}
                                    required
                                />
                                <div className="relative">
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Receipt / Purchase No</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Select or enter Purchase No"
                                            value={formData.purchaseReceiveNo || formData.purchaseNo || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFormData(prev => ({ ...prev, purchaseReceiveNo: val, purchaseNo: val }));
                                                setPurchaseSearch(val);
                                                setIsPurchaseDropdownOpen(true);
                                            }}
                                            onFocus={() => setIsPurchaseDropdownOpen(true)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none pr-8 font-semibold text-blue-600"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setIsPurchaseDropdownOpen(!isPurchaseDropdownOpen)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                                        >
                                            <ChevronDownIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {isPurchaseDropdownOpen && filteredPurchasesDropdown.length > 0 && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                                            {filteredPurchasesDropdown.map((p, idx) => (
                                                <div
                                                    key={p._id || idx}
                                                    onClick={() => handleSelectPurchase(p)}
                                                    className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-50 last:border-0 flex items-center justify-between"
                                                >
                                                    <div>
                                                        <span className="font-bold text-blue-600 mr-2">{p.purchaseNo}</span>
                                                        <span className="text-gray-700 font-medium">{p.companyName || p.supplierName || 'No Company'}</span>
                                                    </div>
                                                    <span className="text-xs text-gray-400">{formatDate(p.date)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="relative">
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Supplier / Company Name</label>
                                    <input
                                        type="text"
                                        placeholder="Type or select supplier/company"
                                        value={formData.companyName || formData.supplierName || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setFormData(prev => ({ ...prev, companyName: val, supplierName: val }));
                                            setCustomerSearch(val);
                                            setIsCustomerDropdownOpen(true);
                                        }}
                                        onFocus={() => setIsCustomerDropdownOpen(true)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    />
                                    {isCustomerDropdownOpen && filteredCustomers.length > 0 && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                                            {filteredCustomers.map((c, idx) => (
                                                <div
                                                    key={c._id || idx}
                                                    onClick={() => {
                                                        const name = c.companyName || c.customerName || c.name;
                                                        setFormData(prev => ({ ...prev, companyName: name, supplierName: name }));
                                                        setIsCustomerDropdownOpen(false);
                                                    }}
                                                    className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm font-medium border-b border-gray-50 last:border-0"
                                                >
                                                    {c.companyName ? `${c.companyName} (${c.customerName || c.name})` : c.customerName || c.name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Warehouse</label>
                                    <select
                                        value={formData.warehouse}
                                        onChange={(e) => setFormData(prev => ({ ...prev, warehouse: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    >
                                        {warehousesList.map((wh, idx) => (
                                            <option key={idx} value={wh}>{wh}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Challan No</label>
                                    <input
                                        type="text"
                                        placeholder="Enter Challan No"
                                        value={formData.challanNo || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, challanNo: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Truck No</label>
                                    <input
                                        type="text"
                                        placeholder="Enter Truck No"
                                        value={formData.truckNo || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, truckNo: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Product Items Breakdown */}
                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-wider">Product Items</h4>
                                    <button
                                        type="button"
                                        onClick={addProductItem}
                                        className="px-3 py-1.5 bg-blue-50 text-blue-600 font-bold rounded-lg text-xs hover:bg-blue-100 transition-colors flex items-center gap-1"
                                    >
                                        <PlusIcon className="w-3.5 h-3.5" /> Add Product
                                    </button>
                                </div>

                                {formData.items.map((item, pIdx) => (
                                    <div key={pIdx} className="bg-gray-50/80 p-4 rounded-xl border border-gray-200/80 space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex-1 relative">
                                                <label className="block text-[11px] font-bold text-gray-600 mb-1">Product Name</label>
                                                <input
                                                    type="text"
                                                    placeholder="Select or enter product"
                                                    value={item.productName || ''}
                                                    onChange={(e) => handleProductChange(pIdx, e.target.value)}
                                                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                                />
                                            </div>
                                            {formData.items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeProductItem(pIdx)}
                                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-5"
                                                    title="Remove Product"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Brand Entries for Product */}
                                        <div className="space-y-3">
                                            {(item.brandEntries || []).map((bRow, bIdx) => (
                                                <div key={bIdx} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-3">
                                                    {/* Top Row: Brand, Rate, Total, Action */}
                                                    <div className="grid grid-cols-12 gap-2.5 items-center">
                                                        <div className="col-span-5">
                                                            <label className="block text-[10px] font-bold text-gray-600 mb-1">Brand Name</label>
                                                            <input
                                                                type="text"
                                                                placeholder="Brand Name"
                                                                value={bRow.brand || ''}
                                                                onChange={(e) => handleBrandChange(pIdx, bIdx, 'brand', e.target.value)}
                                                                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                        <div className="col-span-3">
                                                            <label className="block text-[10px] font-bold text-gray-600 mb-1">Rate / Price</label>
                                                            <input
                                                                type="number"
                                                                placeholder="Unit Rate"
                                                                value={bRow.rate || ''}
                                                                onChange={(e) => handleBrandChange(pIdx, bIdx, 'rate', e.target.value)}
                                                                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                        <div className="col-span-3">
                                                            <label className="block text-[10px] font-bold text-gray-600 mb-1">Total Price</label>
                                                            <input
                                                                type="number"
                                                                placeholder="Total"
                                                                value={bRow.total !== undefined && bRow.total !== '' ? bRow.total : ''}
                                                                onChange={(e) => handleBrandChange(pIdx, bIdx, 'total', e.target.value)}
                                                                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-center text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                        <div className="col-span-1 flex items-center justify-center pt-3.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeBrandRow(pIdx, bIdx)}
                                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Remove Brand Row"
                                                            >
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Quantities Grid: Arrival, SWP, InHouse */}
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50/80 p-2.5 rounded-lg border border-gray-200/80">
                                                        {/* Arrival Section */}
                                                        <div className="space-y-1">
                                                            <span className="block text-[10px] font-black text-blue-700 uppercase tracking-wider">Arrival</span>
                                                            <div className="grid grid-cols-2 gap-1.5">
                                                                <div>
                                                                    <label className="block text-[9px] font-bold text-gray-500 mb-0.5">Bag</label>
                                                                    <input
                                                                        type="number"
                                                                        placeholder="Bag"
                                                                        value={bRow.bag || ''}
                                                                        onChange={(e) => handleBrandChange(pIdx, bIdx, 'bag', e.target.value)}
                                                                        className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs font-semibold text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[9px] font-bold text-gray-500 mb-0.5">Qty (KG)</label>
                                                                    <input
                                                                        type="number"
                                                                        placeholder="KG"
                                                                        value={bRow.qty || ''}
                                                                        onChange={(e) => handleBrandChange(pIdx, bIdx, 'qty', e.target.value)}
                                                                        className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs font-bold text-center text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* SWP Section */}
                                                        <div className="space-y-1">
                                                            <span className="block text-[10px] font-black text-rose-700 uppercase tracking-wider">SWP (Sweeped)</span>
                                                            <div className="grid grid-cols-2 gap-1.5">
                                                                <div>
                                                                    <label className="block text-[9px] font-bold text-gray-500 mb-0.5">SWP Bag</label>
                                                                    <input
                                                                        type="number"
                                                                        placeholder="SWP Bag"
                                                                        value={bRow.sweepedPacket || ''}
                                                                        onChange={(e) => handleBrandChange(pIdx, bIdx, 'sweepedPacket', e.target.value)}
                                                                        className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs font-semibold text-center focus:outline-none focus:ring-1 focus:ring-rose-500"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[9px] font-bold text-gray-500 mb-0.5">SWP Qty (KG)</label>
                                                                    <input
                                                                        type="number"
                                                                        placeholder="SWP KG"
                                                                        value={bRow.sweepedQuantity || ''}
                                                                        onChange={(e) => handleBrandChange(pIdx, bIdx, 'sweepedQuantity', e.target.value)}
                                                                        className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs font-bold text-center text-rose-600 focus:outline-none focus:ring-1 focus:ring-rose-500"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* InHouse Section */}
                                                        <div className="space-y-1">
                                                            <span className="block text-[10px] font-black text-emerald-700 uppercase tracking-wider">InHouse</span>
                                                            <div className="grid grid-cols-2 gap-1.5">
                                                                <div>
                                                                    <label className="block text-[9px] font-bold text-gray-500 mb-0.5">InHouse Bag</label>
                                                                    <input
                                                                        type="number"
                                                                        placeholder="IH Bag"
                                                                        value={bRow.inHousePacket || ''}
                                                                        onChange={(e) => handleBrandChange(pIdx, bIdx, 'inHousePacket', e.target.value)}
                                                                        className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs font-semibold text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[9px] font-bold text-gray-500 mb-0.5">InHouse Qty (KG)</label>
                                                                    <input
                                                                        type="number"
                                                                        placeholder="IH KG"
                                                                        value={bRow.inHouseQuantity || ''}
                                                                        onChange={(e) => handleBrandChange(pIdx, bIdx, 'inHouseQuantity', e.target.value)}
                                                                        className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs font-bold text-center text-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => addBrandRow(pIdx)}
                                                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 pt-1"
                                            >
                                                <PlusIcon className="w-3 h-3" /> Add Brand Row
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Financial Calculations */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Total Amount</label>
                                    <div className="text-xl font-black text-gray-900 py-1">
                                        ৳ {(formData.totalAmount || 0).toLocaleString('en-IN')}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Paid Amount</label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={formData.paidAmount || ''}
                                        onChange={(e) => {
                                            const paid = parseFloat(e.target.value) || 0;
                                            const tot = parseFloat(formData.totalAmount) || 0;
                                            setFormData(prev => ({
                                                ...prev,
                                                paidAmount: e.target.value,
                                                dueAmount: Math.max(0, tot - paid)
                                            }));
                                        }}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Due / Balance</label>
                                    <div className="text-xl font-black text-orange-600 py-1">
                                        ৳ {(formData.dueAmount || 0).toLocaleString('en-IN')}
                                    </div>
                                </div>
                            </div>

                            {/* Remarks */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Remarks / Notes</label>
                                <textarea
                                    rows="2"
                                    placeholder="Optional notes or references"
                                    value={formData.remarks || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                                />
                            </div>

                            {/* Submit Buttons */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-5 py-2.5 border border-gray-200 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Saving...' : editingId ? 'Update Purchase Receive' : 'Save Purchase Receive'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchaseReceiveManagement;
