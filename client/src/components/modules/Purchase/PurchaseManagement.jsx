import React, { useState, useEffect, useMemo } from 'react';
import axios from '../../../utils/api';
import {
    SearchIcon, PlusIcon, EditIcon, TrashIcon, CheckIcon, XIcon,
    FileTextIcon, DollarSignIcon, ChevronDownIcon
} from '../../Icons';
import { API_BASE_URL, formatDate, SortIcon } from '../../../utils/helpers';
import { hasPermission } from '../../../utils/permissionHelper';
import CustomDatePicker from '../../shared/CustomDatePicker';

const PurchaseManagement = ({ currentUser, addNotification }) => {
    const [purchases, setPurchases] = useState([]);
    const [warehousesList, setWarehousesList] = useState(['HILI', 'DINAJPUR', 'CHATTOGRAM', 'DHAKA']);
    const [customersList, setCustomersList] = useState([]);
    const [productsList, setProductsList] = useState([]);
    const [activeProductDropdown, setActiveProductDropdown] = useState(null);
    const [productSearch, setProductSearch] = useState('');
    const [activeBrandDropdown, setActiveBrandDropdown] = useState(null);
    const [brandSearch, setBrandSearch] = useState('');
    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
    const [highlightedCustomerIdx, setHighlightedCustomerIdx] = useState(0);
    const [highlightedProductIdx, setHighlightedProductIdx] = useState(0);
    const [highlightedBrandIdx, setHighlightedBrandIdx] = useState(0);
    const [highlightedWhIdx, setHighlightedWhIdx] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isRequestedOnly, setIsRequestedOnly] = useState(false);

    // Form Modal States
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form Fields
    const [formData, setFormData] = useState({
        purchaseNo: '',
        date: new Date().toISOString().split('T')[0],
        supplierName: '',
        companyName: '',
        lcNo: '',
        challanNo: '',
        truckNo: '',
        warehouse: 'HILI',
        items: [
            { productName: '', brandEntries: [{ brand: '', qty: '', rate: '', total: 0 }], total: 0 }
        ],
        discount: 0,
        totalAmount: 0,
        paidAmount: 0,
        dueAmount: 0,
        remarks: ''
    });

    const canAdd = hasPermission(currentUser, 'purchase', 'add') || hasPermission(currentUser, 'sales', 'add') || currentUser?.role === 'admin';
    const canEdit = hasPermission(currentUser, 'purchase', 'edit') || currentUser?.role === 'admin';
    const canDelete = hasPermission(currentUser, 'purchase', 'delete') || currentUser?.role === 'admin';
    const canApprove = hasPermission(currentUser, 'purchase', 'special') || currentUser?.role === 'admin';

    const syncPurchaseStock = async (purchasesList) => {
        try {
            for (const p of purchasesList) {
                if ((p.status || 'Accepted') === 'Accepted') {
                    await updateWarehouseStockForPurchase(p);
                }
            }
        } catch (e) {
            console.error('Error syncing purchase stock:', e);
        }
    };

    const fetchPurchases = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/purchases`);
            const data = res.data || [];
            setPurchases(data);
            if (data.length > 0) {
                syncPurchaseStock(data);
            }
        } catch (error) {
            console.error('Error fetching purchases:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPurchases();
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
        fetchWH();
        fetchCustomers();
        fetchProducts();
    }, []);

    const requestedCount = useMemo(() => {
        return purchases.filter(p => (p.status || '').toLowerCase() === 'requested').length;
    }, [purchases]);

    const filteredPurchases = useMemo(() => {
        return purchases.filter(p => {
            if (isRequestedOnly && (p.status || '').toLowerCase() !== 'requested') return false;
            if (!isRequestedOnly && (p.status || '').toLowerCase() === 'requested' && !canApprove) return false;

            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const pNo = (p.purchaseNo || '').toLowerCase();
                const comp = (p.companyName || p.supplierName || '').toLowerCase();
                const lc = (p.lcNo || '').toLowerCase();
                return pNo.includes(q) || comp.includes(q) || lc.includes(q);
            }
            return true;
        });
    }, [purchases, isRequestedOnly, searchQuery, canApprove]);

    const stats = useMemo(() => {
        const valid = purchases.filter(p => (p.status || '').toLowerCase() !== 'requested');
        const totalPurchases = valid.reduce((sum, p) => sum + (parseFloat(p.totalAmount) || 0), 0);
        const totalDiscount = valid.reduce((sum, p) => sum + (parseFloat(p.discount) || 0), 0);
        const totalPaid = valid.reduce((sum, p) => sum + (parseFloat(p.paidAmount) || 0), 0);
        const totalDue = valid.reduce((sum, p) => sum + (parseFloat(p.dueAmount) || 0), 0);
        return { totalPurchases, totalDiscount, totalPaid, totalDue };
    }, [purchases]);

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

    const getPurchaseBrandEntries = (purchase) => {
        const results = [];
        (purchase.items || []).forEach(item => {
            const pName = item.productName || item.product || '';
            const bEntries = item.brandEntries && item.brandEntries.length > 0
                ? item.brandEntries
                : [{ brand: item.brand || '', qty: item.qty || 0, rate: item.rate || item.purchasedPrice || 0 }];

            bEntries.forEach(be => {
                results.push({
                    productName: pName,
                    brand: be.brand || '—',
                    qty: parseFloat(be.qty) || 0,
                    rate: parseFloat(be.rate) || 0
                });
            });
        });
        return results.length > 0 ? results : [{ productName: '—', brand: '—', qty: 0, rate: 0 }];
    };

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
            purchaseNo: '',
            date: new Date().toISOString().split('T')[0],
            supplierName: '',
            companyName: '',
            lcNo: '',
            challanNo: '',
            truckNo: '',
            warehouse: warehousesList[0] || 'HILI',
            items: [
                { productName: '', brandEntries: [{ brand: '', bag: '', qty: '', rate: '', total: 0 }], total: 0 }
            ],
            discount: 0,
            totalAmount: 0,
            paidAmount: 0,
            dueAmount: 0,
            remarks: ''
        });
        setEditingId(null);
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
            setFormData({ ...purchaseToEdit, items: normalizedItems });
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
                    const q = parseFloat(b.qty) || 0;
                    const r = parseFloat(b.rate) || 0;
                    b.total = q * r;
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
            updatedItems[pIdx].brandEntries = [{ brand: '', bag: '', qty: '', rate: '', total: 0 }];
        }
        updatedItems[pIdx].brandEntries[bIdx][field] = value;

        const currentBrand = updatedItems[pIdx].brandEntries[bIdx].brand || '';
        const pktSize = getProductPacketSize(updatedItems[pIdx].productName, currentBrand);

        if (field === 'brand') {
            const currentBag = parseFloat(updatedItems[pIdx].brandEntries[bIdx].bag) || 0;
            const currentQty = parseFloat(updatedItems[pIdx].brandEntries[bIdx].qty) || 0;
            if (pktSize > 0) {
                if (currentBag > 0) {
                    const calculatedQty = currentBag * pktSize;
                    updatedItems[pIdx].brandEntries[bIdx].qty = calculatedQty.toString();
                } else if (currentQty > 0) {
                    const calculatedBag = currentQty / pktSize;
                    const formattedBag = calculatedBag % 1 === 0 ? calculatedBag.toString() : calculatedBag.toFixed(2);
                    updatedItems[pIdx].brandEntries[bIdx].bag = formattedBag;
                }
            }
        } else if (field === 'bag') {
            const bagVal = parseFloat(value);
            if (!isNaN(bagVal) && bagVal >= 0 && value !== '') {
                if (pktSize > 0) {
                    const calculatedQty = bagVal * pktSize;
                    updatedItems[pIdx].brandEntries[bIdx].qty = calculatedQty === 0 ? '' : calculatedQty.toString();
                }
            } else if (value === '') {
                updatedItems[pIdx].brandEntries[bIdx].qty = '';
            }
        } else if (field === 'qty') {
            const qtyVal = parseFloat(value);
            if (!isNaN(qtyVal) && qtyVal >= 0 && value !== '') {
                if (pktSize > 0) {
                    const calculatedBag = qtyVal / pktSize;
                    const formattedBag = calculatedBag % 1 === 0 ? calculatedBag.toString() : calculatedBag.toFixed(2);
                    updatedItems[pIdx].brandEntries[bIdx].bag = calculatedBag === 0 ? '' : formattedBag;
                }
            } else if (value === '') {
                updatedItems[pIdx].brandEntries[bIdx].bag = '';
            }
        }

        const q = parseFloat(updatedItems[pIdx].brandEntries[bIdx].qty) || 0;
        const r = parseFloat(updatedItems[pIdx].brandEntries[bIdx].rate) || 0;
        updatedItems[pIdx].brandEntries[bIdx].total = q * r;

        recalculateTotals(updatedItems);
    };

    const addBrandEntry = (pIdx) => {
        const updatedItems = [...formData.items];
        if (!updatedItems[pIdx].brandEntries) {
            updatedItems[pIdx].brandEntries = [];
        }
        updatedItems[pIdx].brandEntries.push({ brand: '', bag: '', qty: '', rate: '', total: 0 });
        recalculateTotals(updatedItems);
    };

    const removeBrandEntry = (pIdx, bIdx) => {
        const updatedItems = [...formData.items];
        if (!updatedItems[pIdx].brandEntries || updatedItems[pIdx].brandEntries.length <= 1) return;
        updatedItems[pIdx].brandEntries = updatedItems[pIdx].brandEntries.filter((_, idx) => idx !== bIdx);
        recalculateTotals(updatedItems);
    };

    const handleAddItem = () => {
        const newItem = { productName: '', brandEntries: [{ brand: '', bag: '', qty: '', rate: '', total: 0 }], total: 0 };
        const updatedItems = [...formData.items, newItem];
        recalculateTotals(updatedItems);
    };

    const handleRemoveItem = (index) => {
        if (formData.items.length === 1) return;
        const updatedItems = formData.items.filter((_, idx) => idx !== index);
        recalculateTotals(updatedItems);
    };

    const updateWarehouseStockForPurchase = async (purchaseData) => {
        try {
            const stockRes = await axios.get(`${API_BASE_URL}/api/stock`);
            const existingStock = Array.isArray(stockRes.data) ? stockRes.data : [];
            const purchaseNo = (purchaseData.purchaseNo || '').trim();
            const targetWarehouse = (purchaseData.warehouse || 'HILI').trim();

            for (const item of (purchaseData.items || [])) {
                const pName = (item.productName || '').trim();
                if (!pName) continue;
                const pktSize = getProductPacketSize(pName);

                const entries = item.brandEntries && item.brandEntries.length > 0
                    ? item.brandEntries
                    : [{ brand: item.brand || '', bag: item.bag || item.packet || 0, qty: item.qty || 0, rate: item.rate || 0 }];

                for (const be of entries) {
                    const bName = (be.brand || '').trim();
                    const qty = parseFloat(be.qty) || 0;
                    const pkt = parseFloat(be.bag || be.packet || 0);
                    if (!bName || qty <= 0) continue;

                    // Find a dedicated stock record for this purchase + product + brand
                    const existing = existingStock.find(s =>
                        (s.lcNo || '').trim() === purchaseNo &&
                        (s.productName || s.product || '').trim().toLowerCase() === pName.toLowerCase() &&
                        (s.brand || '').trim().toLowerCase() === bName.toLowerCase()
                    );

                    if (existing) {
                        // Update the dedicated record in place
                        const { _id, createdAt, updatedAt, ...rest } = existing;
                        await axios.put(`${API_BASE_URL}/api/stock/${_id}`, {
                            ...rest,
                            quantity: qty,
                            inHouseQuantity: qty,
                            totalInHouseQuantity: qty,
                            packet: pkt,
                            inHousePacket: pkt,
                            totalInHousePacket: pkt,
                            packetSize: pktSize,
                            port: targetWarehouse,
                            exporter: purchaseData.companyName || purchaseData.supplierName || rest.exporter || '',
                            purchasedPrice: parseFloat(be.rate) || rest.purchasedPrice || 0,
                        });
                    } else {
                        // Create a new dedicated stock record for this purchase
                        await axios.post(`${API_BASE_URL}/api/stock`, {
                            date: purchaseData.date || new Date().toISOString().split('T')[0],
                            lcNo: purchaseNo,
                            warehouse: targetWarehouse,
                            whName: targetWarehouse,
                            productName: pName,
                            brand: bName,
                            quantity: qty,
                            inHouseQuantity: qty,
                            totalInHouseQuantity: qty,
                            inHousePacket: pkt,
                            totalInHousePacket: pkt,
                            packet: pkt,
                            packetSize: pktSize,
                            port: targetWarehouse,
                            exporter: purchaseData.companyName || purchaseData.supplierName || '',
                            purchasedPrice: parseFloat(be.rate) || 0,
                            status: 'Accepted',
                            requestedBy: purchaseData.createdBy || 'Purchase',
                            requestedByUsername: purchaseData.createdBy || 'Purchase',
                            unit: item.unit || 'kg',
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Error updating warehouse stock for purchase:', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const initialStatus = 'Requested';
            const generatedNo = formData.purchaseNo || `PUR-${String(purchases.length + 1).padStart(4, '0')}`;
            const payload = {
                ...formData,
                purchaseNo: generatedNo,
                status: editingId ? formData.status : initialStatus,
                createdBy: currentUser?.username || 'User'
            };

            if (editingId) {
                await axios.put(`${API_BASE_URL}/api/purchases/${editingId}`, payload);
                await updateWarehouseStockForPurchase(payload);
                if (addNotification) addNotification('Purchase updated successfully!', 'success');
            } else {
                await axios.post(`${API_BASE_URL}/api/purchases`, payload);
                await updateWarehouseStockForPurchase(payload);
                if (addNotification) addNotification('Purchase entry saved and stock updated successfully!', 'success');
            }

            setShowModal(false);
            fetchPurchases();
            if (typeof fetchStockRecords === 'function') fetchStockRecords();
        } catch (error) {
            console.error('Error saving purchase:', error);
            if (addNotification) addNotification('Failed to save purchase entry.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatusUpdate = async (purchase, newStatus) => {
        try {
            const updated = { ...purchase, status: newStatus };
            await axios.put(`${API_BASE_URL}/api/purchases/${purchase._id}`, updated);
            const statusLower = (newStatus || '').toLowerCase();
            if (statusLower === 'approved' || statusLower === 'accepted') {
                await updateWarehouseStockForPurchase(updated);
            } else if (statusLower === 'rejected' || statusLower === 'deleted') {
                await reverseWarehouseStockForPurchase(purchase);
            }
            if (addNotification) addNotification(`Purchase ${newStatus.toLowerCase()} successfully!`, 'success');
            fetchPurchases();
            if (typeof fetchStockRecords === 'function') fetchStockRecords();
        } catch (error) {
            console.error('Error updating purchase status:', error);
        }
    };

    const reverseWarehouseStockForPurchase = async (purchaseData) => {
        try {
            const stockRes = await axios.get(`${API_BASE_URL}/api/stock`);
            const existingStock = Array.isArray(stockRes.data) ? stockRes.data : [];
            const purchaseNo = (purchaseData.purchaseNo || '').trim();

            const purchaseStockRecords = existingStock.filter(s =>
                (s.lcNo || '').trim() === purchaseNo
            );

            for (const record of purchaseStockRecords) {
                try {
                    await axios.delete(`${API_BASE_URL}/api/stock/${record._id}`);
                } catch (delErr) {
                    console.error(`Failed to delete stock record ${record._id}:`, delErr);
                }
            }
        } catch (err) {
            console.error('Error reversing warehouse stock for purchase:', err);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this purchase entry?')) return;
        try {
            const purchaseToDelete = purchases.find(p => p._id === id);
            if (purchaseToDelete) {
                await reverseWarehouseStockForPurchase(purchaseToDelete);
            }
            await axios.delete(`${API_BASE_URL}/api/purchases/${id}`);
            if (addNotification) addNotification('Purchase deleted and stock reversed successfully!', 'success');
            fetchPurchases();
            if (typeof fetchStockRecords === 'function') fetchStockRecords();
        } catch (error) {
            console.error('Error deleting purchase:', error);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Purchase Management</h2>
                </div>

                {/* Center Search & Requested Toggle */}
                <div className="flex-1 w-full max-w-none md:max-w-xl mx-auto flex flex-col items-center gap-2">
                    <div className="w-full relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by purchase no, company, LC no..."
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
                            <PlusIcon className="w-4 h-4" /> <span>Add Purchase</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-blue-100 p-4 rounded-2xl shadow-sm">
                    <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">Total Purchases</div>
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
                                <th className="sale-mgmt-th">Purchase No</th>
                                <th className="sale-mgmt-th">Supplier / Company</th>
                                <th className="sale-mgmt-th">Warehouse</th>
                                <th className="sale-mgmt-th">Product</th>
                                <th className="sale-mgmt-th">Brand</th>
                                <th className="sale-mgmt-th text-center">Qty (KG)</th>
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
                                    <td colSpan={13} className="px-6 py-12 text-center text-gray-500 font-medium">
                                        Loading purchase records...
                                    </td>
                                </tr>
                            ) : filteredPurchases.length > 0 ? (
                                filteredPurchases.map(p => (
                                    <tr key={p._id} className="hover:bg-blue-50/50 transition-all border-b border-gray-50 last:border-0 align-middle">
                                        <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-600 align-top">{formatDate(p.date)}</td>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 align-top">{p.purchaseNo || '—'}</td>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm font-semibold text-gray-800 align-top">{p.companyName || p.supplierName || '—'}</td>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-600 font-bold align-top">{p.warehouse || 'HILI'}</td>
                                        <td className="px-3 py-4 text-sm font-semibold text-gray-800 align-top">
                                            <div className="space-y-1">
                                                {getPurchaseBrandEntries(p).map((e, idx) => (
                                                    <div key={idx}>{e.productName}</div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 text-sm font-medium text-gray-700 align-top">
                                            <div className="space-y-1">
                                                {getPurchaseBrandEntries(p).map((e, idx) => (
                                                    <div key={idx}>{e.brand}</div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 text-sm text-center font-bold text-gray-900 align-top">
                                            <div className="space-y-1">
                                                {getPurchaseBrandEntries(p).map((e, idx) => (
                                                    <div key={idx}>{e.qty > 0 ? `${Number(e.qty).toLocaleString('en-US')} kg` : '—'}</div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 text-sm text-center font-bold text-gray-700 align-top">
                                            <div className="space-y-1">
                                                {getPurchaseBrandEntries(p).map((e, idx) => (
                                                    <div key={idx}>{e.rate > 0 ? `৳${Number(e.rate).toLocaleString('en-IN')}` : '—'}</div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap text-center text-sm font-black text-gray-900 align-top">৳{Number(p.totalAmount || 0).toLocaleString('en-IN')}</td>
                                        <td className="px-3 py-4 whitespace-nowrap text-center text-sm font-bold text-emerald-600 align-top">৳{Number(p.paidAmount || 0).toLocaleString('en-IN')}</td>
                                        <td className="px-3 py-4 whitespace-nowrap text-center text-sm font-bold text-orange-600 align-top">৳{Number(p.dueAmount || 0).toLocaleString('en-IN')}</td>
                                        <td className="px-3 py-4 whitespace-nowrap text-center align-top">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${p.status === 'Requested' ? 'bg-amber-50 text-amber-700 border border-amber-200/60' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'}`}>
                                                {p.status || 'Accepted'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap text-center align-top">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {canApprove && (p.status === 'Requested') && (
                                                    <>
                                                        <button onClick={() => handleStatusUpdate(p, 'Accepted')} className="p-1 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 rounded transition-colors" title="Accept">
                                                            <CheckIcon className="w-5 h-5" />
                                                        </button>
                                                        <button onClick={() => handleStatusUpdate(p, 'Rejected')} className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors" title="Reject">
                                                            <XIcon className="w-5 h-5" />
                                                        </button>
                                                    </>
                                                )}
                                                {canEdit && (
                                                    <button onClick={() => handleOpenModal(p)} className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors" title="Edit">
                                                        <EditIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button onClick={() => handleDelete(p._id)} className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors" title="Delete">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={13} className="px-6 py-12 text-center text-gray-400">
                                        No purchase records found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for Add / Edit Purchase */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 border border-gray-100">
                        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
                            <h3 className="text-xl font-black text-gray-900">{editingId ? 'Edit Purchase Entry' : 'New Purchase Entry'}</h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                <XIcon className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <CustomDatePicker
                                    label="Date"
                                    name="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    compact={true}
                                    required
                                />
                                <div className="relative font-sans">
                                    <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Supplier / Company</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={formData.companyName}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFormData({ ...formData, companyName: val, supplierName: val });
                                                setCustomerSearch(val);
                                                setIsCustomerDropdownOpen(true);
                                                setHighlightedCustomerIdx(0);
                                            }}
                                            onFocus={() => {
                                                setCustomerSearch(formData.companyName || '');
                                                setIsCustomerDropdownOpen(true);
                                                setHighlightedCustomerIdx(0);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'ArrowDown') {
                                                    e.preventDefault();
                                                    setHighlightedCustomerIdx(prev => (prev < filteredCustomers.length - 1 ? prev + 1 : 0));
                                                } else if (e.key === 'ArrowUp') {
                                                    e.preventDefault();
                                                    setHighlightedCustomerIdx(prev => (prev > 0 ? prev - 1 : filteredCustomers.length - 1));
                                                } else if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (filteredCustomers.length > 0) {
                                                        const hIdx = highlightedCustomerIdx >= 0 && highlightedCustomerIdx < filteredCustomers.length ? highlightedCustomerIdx : 0;
                                                        const selected = filteredCustomers[hIdx];
                                                        const comp = selected.companyName || '';
                                                        const cust = selected.customerName || selected.name || '';
                                                        const selectedName = comp || cust;
                                                        setFormData(prev => ({ ...prev, companyName: selectedName, supplierName: cust || selectedName, customerId: selected._id }));
                                                        setIsCustomerDropdownOpen(false);
                                                        setHighlightedCustomerIdx(0);
                                                    }
                                                } else if (e.key === 'Escape') {
                                                    setIsCustomerDropdownOpen(false);
                                                }
                                            }}
                                            placeholder="Select or search Supplier / Company"
                                            required
                                            className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
                                        >
                                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isCustomerDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>

                                    {isCustomerDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsCustomerDropdownOpen(false)} />
                                            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-56 overflow-y-auto py-1 animate-in fade-in duration-150">
                                                {filteredCustomers.length > 0 ? (
                                                    filteredCustomers.map((c, cIdx) => {
                                                        const comp = c.companyName || '';
                                                        const cust = c.customerName || c.name || '';
                                                        const displayName = comp && cust ? `${comp} (${cust})` : (comp || cust || 'Unnamed Customer');
                                                        const phone = c.phone || c.proprietorPhone || c.mobile || '';
                                                        const isHighlighted = highlightedCustomerIdx === cIdx;
                                                        return (
                                                            <button
                                                                key={c._id || cIdx}
                                                                type="button"
                                                                onClick={() => {
                                                                    const selectedName = comp || cust;
                                                                    setFormData({ ...formData, companyName: selectedName, supplierName: cust || selectedName, customerId: c._id });
                                                                    setIsCustomerDropdownOpen(false);
                                                                }}
                                                                className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between border-b border-gray-50 last:border-0 ${isHighlighted ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-blue-50/80 text-gray-800'}`}
                                                            >
                                                                <span className="font-semibold">{displayName}</span>
                                                                {phone && <span className="text-xs opacity-75">{phone}</span>}
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="px-4 py-3 text-xs text-gray-400 text-center font-medium">No matching customers found</div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Challan No</label>
                                    <input type="text" value={formData.challanNo} onChange={(e) => setFormData({ ...formData, challanNo: e.target.value })} placeholder="Challan No" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Truck No</label>
                                    <input type="text" value={formData.truckNo} onChange={(e) => setFormData({ ...formData, truckNo: e.target.value })} placeholder="Truck No" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                                <div className="relative font-sans">
                                    <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Warehouse</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={formData.warehouse || 'HILI'}
                                            onClick={() => setIsWarehouseDropdownOpen(!isWarehouseDropdownOpen)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'ArrowDown') {
                                                    e.preventDefault();
                                                    setHighlightedWhIdx(prev => (prev < warehousesList.length - 1 ? prev + 1 : 0));
                                                } else if (e.key === 'ArrowUp') {
                                                    e.preventDefault();
                                                    setHighlightedWhIdx(prev => (prev > 0 ? prev - 1 : warehousesList.length - 1));
                                                } else if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (warehousesList.length > 0) {
                                                        const hIdx = highlightedWhIdx >= 0 && highlightedWhIdx < warehousesList.length ? highlightedWhIdx : 0;
                                                        setFormData(prev => ({ ...prev, warehouse: warehousesList[hIdx] }));
                                                        setIsWarehouseDropdownOpen(false);
                                                        setHighlightedWhIdx(0);
                                                    }
                                                } else if (e.key === 'Escape') {
                                                    setIsWarehouseDropdownOpen(false);
                                                }
                                            }}
                                            readOnly
                                            className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 bg-white cursor-pointer"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setIsWarehouseDropdownOpen(!isWarehouseDropdownOpen)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
                                        >
                                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isWarehouseDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>

                                    {isWarehouseDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsWarehouseDropdownOpen(false)} />
                                            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1 animate-in fade-in duration-150">
                                                {warehousesList.map((wh, wIdx) => {
                                                    const isHighlighted = highlightedWhIdx === wIdx;
                                                    return (
                                                        <button
                                                            key={wIdx}
                                                            type="button"
                                                            onClick={() => {
                                                                setFormData({ ...formData, warehouse: wh });
                                                                setIsWarehouseDropdownOpen(false);
                                                            }}
                                                            className={`w-full px-4 py-2.5 text-left text-sm transition-colors font-semibold border-b border-gray-50 last:border-0 ${isHighlighted || formData.warehouse === wh ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-blue-50/80 text-gray-800'}`}
                                                        >
                                                            {wh}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Product Details Section - Styled exact same as Sale with Add Brand */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-base font-bold text-gray-800 flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                                        Product Details
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-2"
                                    >
                                        <span className="text-lg">+</span> Add Product
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    {formData.items.map((item, idx) => {
                                        const entries = item.brandEntries && item.brandEntries.length > 0
                                            ? item.brandEntries
                                            : [{ brand: item.brand || '', qty: item.qty || '', rate: item.rate || '', total: item.total || 0 }];

                                        return (
                                            <div key={idx} className="relative bg-white border border-gray-200/80 p-5 rounded-2xl shadow-sm space-y-4 group/item hover:border-blue-200 transition-all">
                                                {formData.items.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(idx)}
                                                        className="absolute -top-3 -right-3 p-2 bg-white text-gray-400 hover:text-red-500 rounded-xl shadow-md border border-gray-100 opacity-0 group-hover/item:opacity-100 transition-all z-20"
                                                        title="Remove Product"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                )}

                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                                    <div className="md:col-span-12 relative font-sans">
                                                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">Product Name</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={activeProductDropdown === idx ? productSearch : (item.productName || '')}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setProductSearch(val);
                                                                    setActiveProductDropdown(idx);
                                                                    handleProductChange(idx, val);
                                                                    setHighlightedProductIdx(0);
                                                                }}
                                                                onFocus={() => {
                                                                    setProductSearch(item.productName || '');
                                                                    setActiveProductDropdown(idx);
                                                                    setHighlightedProductIdx(0);
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    const matchingProds = availableProducts.filter(p => p.toLowerCase().includes((productSearch || '').toLowerCase()));
                                                                    if (e.key === 'ArrowDown') {
                                                                        e.preventDefault();
                                                                        setHighlightedProductIdx(prev => (prev < matchingProds.length - 1 ? prev + 1 : 0));
                                                                    } else if (e.key === 'ArrowUp') {
                                                                        e.preventDefault();
                                                                        setHighlightedProductIdx(prev => (prev > 0 ? prev - 1 : matchingProds.length - 1));
                                                                    } else if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        if (matchingProds.length > 0) {
                                                                            const hIdx = highlightedProductIdx >= 0 && highlightedProductIdx < matchingProds.length ? highlightedProductIdx : 0;
                                                                            handleProductChange(idx, matchingProds[hIdx]);
                                                                            setActiveProductDropdown(null);
                                                                            setHighlightedProductIdx(0);
                                                                        }
                                                                    } else if (e.key === 'Escape') {
                                                                        setActiveProductDropdown(null);
                                                                    }
                                                                }}
                                                                placeholder="Select or search Product Name"
                                                                required
                                                                className="w-full px-3.5 py-2 pr-10 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setActiveProductDropdown(activeProductDropdown === idx ? null : idx)}
                                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
                                                            >
                                                                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeProductDropdown === idx ? 'rotate-180' : ''}`} />
                                                            </button>
                                                        </div>

                                                        {activeProductDropdown === idx && (
                                                            <>
                                                                <div className="fixed inset-0 z-10" onClick={() => setActiveProductDropdown(null)} />
                                                                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1 animate-in fade-in duration-150">
                                                                    {availableProducts.filter(p => p.toLowerCase().includes((productSearch || '').toLowerCase())).length > 0 ? (
                                                                        availableProducts.filter(p => p.toLowerCase().includes((productSearch || '').toLowerCase())).map((pName, pIdx) => {
                                                                            const isHighlighted = highlightedProductIdx === pIdx;
                                                                            return (
                                                                                <button
                                                                                    key={pIdx}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        handleProductChange(idx, pName);
                                                                                        setActiveProductDropdown(null);
                                                                                    }}
                                                                                    className={`w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors border-b border-gray-50 last:border-0 ${isHighlighted ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-blue-50/80 text-gray-800'}`}
                                                                                >
                                                                                    {pName}
                                                                                </button>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <div className="px-4 py-3 text-xs text-gray-400 text-center font-medium">No matching products found</div>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-3 pt-2">
                                                    <div className="hidden md:grid grid-cols-12 gap-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        <div className="col-span-3">Brand</div>
                                                        <div className="col-span-2 text-center">Bag</div>
                                                        <div className="col-span-2 text-center">Qty (KG)</div>
                                                        <div className="col-span-2 text-center">Price (৳)</div>
                                                        <div className="col-span-2 text-center">Total (৳)</div>
                                                        <div className="col-span-1 text-center">Action</div>
                                                    </div>

                                                    {entries.map((entry, bIdx) => (
                                                        <div key={bIdx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                                                            <div className="col-span-3 relative font-sans">
                                                                <label className="md:hidden text-[10px] font-bold text-gray-500 uppercase block mb-1">Brand</label>
                                                                <div className="relative">
                                                                    <input
                                                                        type="text"
                                                                        value={activeBrandDropdown === `${idx}-${bIdx}` ? brandSearch : (entry.brand || '')}
                                                                        disabled={!item.productName}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            setBrandSearch(val);
                                                                            setActiveBrandDropdown(`${idx}-${bIdx}`);
                                                                            handleBrandChange(idx, bIdx, 'brand', val);
                                                                            setHighlightedBrandIdx(0);
                                                                        }}
                                                                        onFocus={() => {
                                                                            setBrandSearch(entry.brand || '');
                                                                            setActiveBrandDropdown(`${idx}-${bIdx}`);
                                                                            setHighlightedBrandIdx(0);
                                                                        }}
                                                                        onKeyDown={(e) => {
                                                                            const matchingBrands = getBrandsForProduct(item.productName).filter(b => b.toLowerCase().includes((brandSearch || '').toLowerCase()));
                                                                            if (e.key === 'ArrowDown') {
                                                                                e.preventDefault();
                                                                                setHighlightedBrandIdx(prev => (prev < matchingBrands.length - 1 ? prev + 1 : 0));
                                                                            } else if (e.key === 'ArrowUp') {
                                                                                e.preventDefault();
                                                                                setHighlightedBrandIdx(prev => (prev > 0 ? prev - 1 : matchingBrands.length - 1));
                                                                            } else if (e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                                if (matchingBrands.length > 0) {
                                                                                    const hIdx = highlightedBrandIdx >= 0 && highlightedBrandIdx < matchingBrands.length ? highlightedBrandIdx : 0;
                                                                                    handleBrandChange(idx, bIdx, 'brand', matchingBrands[hIdx]);
                                                                                    setActiveBrandDropdown(null);
                                                                                    setHighlightedBrandIdx(0);
                                                                                }
                                                                            } else if (e.key === 'Escape') {
                                                                                setActiveBrandDropdown(null);
                                                                            }
                                                                        }}
                                                                        placeholder={item.productName ? "Select or enter Brand" : "Select Product first"}
                                                                        className={`w-full px-3 py-2 pr-8 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 ${!item.productName ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-800'}`}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        disabled={!item.productName}
                                                                        onClick={() => setActiveBrandDropdown(activeBrandDropdown === `${idx}-${bIdx}` ? null : `${idx}-${bIdx}`)}
                                                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-40"
                                                                    >
                                                                        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${activeBrandDropdown === `${idx}-${bIdx}` ? 'rotate-180' : ''}`} />
                                                                    </button>
                                                                </div>

                                                                {activeBrandDropdown === `${idx}-${bIdx}` && (
                                                                    <>
                                                                        <div className="fixed inset-0 z-10" onClick={() => setActiveBrandDropdown(null)} />
                                                                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1 animate-in fade-in duration-150">
                                                                            {!item.productName ? (
                                                                                <div className="px-3 py-2.5 text-xs text-amber-600 text-center font-bold">Please select a Product first</div>
                                                                            ) : getBrandsForProduct(item.productName).filter(b => b.toLowerCase().includes((brandSearch || '').toLowerCase())).length > 0 ? (
                                                                                getBrandsForProduct(item.productName).filter(b => b.toLowerCase().includes((brandSearch || '').toLowerCase())).map((bName, bKey) => {
                                                                                    const isHighlighted = highlightedBrandIdx === bKey;
                                                                                    return (
                                                                                        <button
                                                                                            key={bKey}
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                handleBrandChange(idx, bIdx, 'brand', bName);
                                                                                                setActiveBrandDropdown(null);
                                                                                            }}
                                                                                            className={`w-full px-3.5 py-2 text-left text-xs font-semibold transition-colors border-b border-gray-50 last:border-0 ${isHighlighted ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-blue-50/80 text-gray-800'}`}
                                                                                        >
                                                                                            {bName}
                                                                                        </button>
                                                                                    );
                                                                                })
                                                                            ) : (
                                                                                <div className="px-3 py-2 text-xs text-gray-400 text-center font-medium">No matching brands found</div>
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>

                                                            <div className="col-span-2">
                                                                <label className="md:hidden text-[10px] font-bold text-gray-500 uppercase block mb-1">Bag</label>
                                                                <input
                                                                    type="number"
                                                                    value={entry.bag || ''}
                                                                    onChange={(e) => handleBrandChange(idx, bIdx, 'bag', e.target.value)}
                                                                    placeholder="0"
                                                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 text-center outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                                                />
                                                            </div>

                                                            <div className="col-span-2">
                                                                <label className="md:hidden text-[10px] font-bold text-gray-500 uppercase block mb-1">Qty (KG)</label>
                                                                <input
                                                                    type="number"
                                                                    value={entry.qty || ''}
                                                                    onChange={(e) => handleBrandChange(idx, bIdx, 'qty', e.target.value)}
                                                                    placeholder="0"
                                                                    required
                                                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-black text-gray-900 text-center outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                                                />
                                                            </div>

                                                            <div className="col-span-2">
                                                                <label className="md:hidden text-[10px] font-bold text-gray-500 uppercase block mb-1">Price (৳)</label>
                                                                <input
                                                                    type="number"
                                                                    value={entry.rate || ''}
                                                                    onChange={(e) => handleBrandChange(idx, bIdx, 'rate', e.target.value)}
                                                                    placeholder="0"
                                                                    required
                                                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 text-center outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                                                />
                                                            </div>

                                                            <div className="col-span-2">
                                                                <label className="md:hidden text-[10px] font-bold text-gray-500 uppercase block mb-1">Total (৳)</label>
                                                                <div className="h-10 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-sm font-black text-blue-600 shadow-sm">
                                                                    ৳{Number(entry.total || 0).toLocaleString('en-IN')}
                                                                </div>
                                                            </div>

                                                            <div className="col-span-1 flex items-center justify-center gap-1">
                                                                {bIdx === entries.length - 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => addBrandEntry(idx)}
                                                                        className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center"
                                                                        title="Add Brand"
                                                                    >
                                                                        <span className="text-lg leading-none">+</span>
                                                                    </button>
                                                                )}
                                                                {entries.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeBrandEntry(idx, bIdx)}
                                                                        className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center"
                                                                        title="Remove Brand"
                                                                    >
                                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Financial Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                                <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Grand Total (৳)</label>
                                    <div className="text-xl font-black text-gray-900 py-1.5">৳{Number(formData.totalAmount || 0).toLocaleString('en-IN')}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Paid (৳)</label>
                                    <input type="number" value={formData.paidAmount} onChange={(e) => {
                                        const paid = parseFloat(e.target.value) || 0;
                                        const due = Math.max(0, (formData.totalAmount || 0) - paid);
                                        setFormData(prev => ({ ...prev, paidAmount: e.target.value, dueAmount: due }));
                                    }} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Balance (৳)</label>
                                    <div className="text-xl font-black text-orange-600 py-1.5">৳{Number(formData.dueAmount || 0).toLocaleString('en-IN')}</div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-blue-500/20">
                                    {isSubmitting ? 'Saving...' : (editingId ? 'Update Purchase' : 'Save Purchase')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchaseManagement;
