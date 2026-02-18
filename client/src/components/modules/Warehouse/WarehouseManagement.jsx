import React, { useState, useMemo, useRef, useEffect } from 'react';
import './WarehouseManagement.css';
import {
    PlusIcon,
    FunnelIcon,
    BoxIcon,
    TrendingUpIcon,
    BellIcon,
    ShoppingCartIcon,
    HomeIcon,
    XIcon,
    UserIcon,
    MapPinIcon,
    SearchIcon,
    TrashIcon,
    EditIcon,
} from '../../Icons';
import { API_BASE_URL } from '../../../utils/helpers';
import { encryptData, decryptData } from '../../../utils/encryption';
import axios from 'axios';
import { ChevronDownIcon } from '../../Icons';

const WarehouseManagement = () => {
    const [activeTab, setActiveTab] = useState('stock'); // 'stock' or 'warehouses'
    const [showWarehouseForm, setShowWarehouseForm] = useState(false);
    const [warehouseFormData, setWarehouseFormData] = useState({
        name: '',
        location: '',
        manager: '',
        capacity: '',
        type: 'General',
        status: 'Active'
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [warehouseData, setWarehouseData] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [showWhDropdown, setShowWhDropdown] = useState(false);
    const whDropdownRef = useRef(null);

    // Product Dropdown State
    const [products, setProducts] = useState([]);
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const productDropdownRef = useRef(null);

    // Brand Dropdown State
    const [showBrandDropdown, setShowBrandDropdown] = useState(false);
    const brandDropdownRef = useRef(null);

    // From and To Dropdown State
    const [showToDropdown, setShowToDropdown] = useState(false);
    const toDropdownRef = useRef(null);

    const fetchProducts = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/products`);
            if (response.data) {
                const decryptedProducts = response.data.map(item => {
                    try {
                        const decrypted = decryptData(item.data);
                        return { ...decrypted, _id: item._id };
                    } catch (err) {
                        console.error("Error decrypting product:", err);
                        return null;
                    }
                }).filter(item => item !== null);
                setProducts(decryptedProducts);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    const fetchWarehouses = async () => {
        try {
            const [whRes, stockRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/warehouses`),
                axios.get(`${API_BASE_URL}/api/stock`)
            ]);

            const whData = Array.isArray(whRes.data) ? whRes.data : [];
            const stockData = Array.isArray(stockRes.data) ? stockRes.data : [];

            // 1. Calculate Global InHouse Totals from ALL Stock Data
            const globalInHouseMap = {};
            const stockDataDecrypted = stockData.map(item => {
                try {
                    return { ...decryptData(item.data), _id: item._id, createdAt: item.createdAt };
                } catch { return null; }
            }).filter(Boolean);

            stockDataDecrypted.forEach(d => {
                const key = `${(d.productName || d.product || '').trim()}_${(d.brand || '').trim()}`;
                if (!globalInHouseMap[key]) {
                    globalInHouseMap[key] = { pkt: 0, qty: 0 };
                }
                // Sum up InHouse values from all stock records (LC receives)
                globalInHouseMap[key].pkt += parseFloat(d.inHousePacket || d.inhousePkt || 0);
                globalInHouseMap[key].qty += parseFloat(d.inHouseQuantity || d.inhouseQty || 0);
            });

            // 2. Decrypt and normalize Warehouse records
            const allDecryptedWh = whData.map(item => {
                try {
                    const decrypted = decryptData(item.data);
                    const key = `${(decrypted.product || decrypted.productName || '').trim()}_${(decrypted.brand || '').trim()}`;
                    const globalStats = globalInHouseMap[key] || { pkt: 0, qty: 0 };

                    // Use Global InHouse Values instead of record-specific values
                    const inhousePkt = globalStats.pkt;
                    const inhouseQty = globalStats.qty;

                    const whPkt = decrypted.whPkt !== undefined && decrypted.whPkt !== null ? decrypted.whPkt : 0;
                    const whQty = decrypted.whQty !== undefined && decrypted.whQty !== null ? decrypted.whQty : 0;

                    return {
                        ...decrypted,
                        productName: decrypted.product,
                        inhousePkt,
                        inhouseQty,
                        whPkt,
                        whQty,
                        packetSize: decrypted.packetSize || (whQty && whPkt ? (parseFloat(whQty) / parseFloat(whPkt)).toFixed(0) : 0),
                        _id: item._id,
                        recordType: 'warehouse',
                        createdAt: item.createdAt,
                        updatedAt: item.updatedAt
                    };
                } catch {
                    return null;
                }
            }).filter(Boolean);

            // 3. Normalize Stock records (treated as Warehouse rows)
            const decryptedStock = stockDataDecrypted.map(d => {
                const rawWh = (d.warehouse || d.whName || '').trim();
                if (!rawWh) return null;

                const key = `${(d.productName || d.product || '').trim()}_${(d.brand || '').trim()}`;
                const globalStats = globalInHouseMap[key] || { pkt: 0, qty: 0 };

                // Use Global InHouse Values
                const inhousePkt = globalStats.pkt;
                const inhouseQty = globalStats.qty;

                // For Stock records, whPkt/whQty defaults to their own InHouse values if not set
                // (Initial stock is assumed to be in warehouse)
                // BUT wait - if we use global InHouse for display, we shouldn't mix it up.
                // However, whPkt/whQty represents PHYSICAL stock at this location.
                // For LC Receive records, the physical stock is the InHouse amount at that location.
                const originalInHousePkt = parseFloat(d.inHousePacket || d.inhousePkt || 0);
                const originalInHouseQty = parseFloat(d.inHouseQuantity || d.inhouseQty || 0);

                const whPkt = d.whPkt !== undefined && d.whPkt !== null ? d.whPkt : originalInHousePkt;
                const whQty = d.whQty !== undefined && d.whQty !== null ? d.whQty : originalInHouseQty;

                return {
                    ...d,
                    whName: rawWh,
                    inhousePkt,
                    inhouseQty,
                    whPkt,
                    whQty,
                    productName: d.productName || d.product,
                    packetSize: d.packetSize || d.size || 0,
                    recordType: 'stock',
                };
            }).filter(Boolean);

            // Combine for comprehensive view
            const combinedData = [...allDecryptedWh, ...decryptedStock];
            setWarehouseData(combinedData);
        } catch (error) {
            console.error('Error fetching warehouse data:', error);
        }
    };

    useEffect(() => {
        fetchWarehouses();
        fetchProducts();
    }, []);

    const [showStockForm, setShowStockForm] = useState(false);
    const [stockFormData, setStockFormData] = useState({
        whName: '',
        manager: '',
        location: '',
        capacity: '',
        to: '',
        toManager: '',
        toLocation: '',
        toCapacity: '',
        productEntries: [{
            productName: '',
            brandEntries: [{
                brand: '',
                inhousePkt: '',
                inhouseQty: '',
                whPkt: '',
                whQty: '',
                transferPkt: '',
                transferQty: ''
            }]
        }]
    });

    const [editingStockId, setEditingStockId] = useState(null);
    const [editingWarehouseId, setEditingWarehouseId] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, type: 'stock' });

    const [activeProductIndex, setActiveProductIndex] = useState(0);
    const [activeBrandIndex, setActiveBrandIndex] = useState(0);

    const handleStockInputChange = (e, pIndex = null, bIndex = null) => {
        const { name, value } = e.target;
        if (pIndex !== null) {
            const updatedProducts = [...stockFormData.productEntries];
            if (bIndex !== null) {
                // Update brand-specific field
                const updatedBrands = [...updatedProducts[pIndex].brandEntries];
                if (name === 'brand') {
                    // Auto-fill existing stock info if available for the selected "From" warehouse
                    const currentProductName = updatedProducts[pIndex].productName;
                    const matchingStockEntries = warehouseData.filter(item =>
                        item.whName === stockFormData.whName &&
                        (item.productName === currentProductName || item.product === currentProductName) &&
                        item.brand === value
                    );

                    // Sum up quantities/packets if there are multiple entries
                    const totalInPkt = matchingStockEntries.reduce((sum, entry) => sum + (parseFloat(entry.inhousePkt) || 0), 0);
                    const totalInQty = matchingStockEntries.reduce((sum, entry) => sum + (parseFloat(entry.inhouseQty) || 0), 0);
                    const totalWhPkt = matchingStockEntries.reduce((sum, entry) => sum + (parseFloat(entry.whPkt) || 0), 0);
                    const totalWhQty = matchingStockEntries.reduce((sum, entry) => sum + (parseFloat(entry.whQty) || 0), 0);

                    updatedBrands[bIndex] = {
                        ...updatedBrands[bIndex],
                        [name]: value,
                        inhousePkt: totalInPkt || 0,
                        inhouseQty: totalInQty || 0,
                        whPkt: totalWhPkt || 0,
                        whQty: totalWhQty || 0
                    };
                    setActiveProductIndex(pIndex);
                    setActiveBrandIndex(bIndex);
                    setShowBrandDropdown(true);
                } else if (name === 'transferQty') {
                    const currentProductName = updatedProducts[pIndex].productName;
                    const currentBrandName = updatedBrands[bIndex].brand;

                    const productData = products.find(p => p.name === currentProductName);
                    const brandData = productData?.brands?.find(b => b.brand === currentBrandName);
                    const packetSize = brandData?.packetSize ? parseFloat(brandData.packetSize) : 0;

                    let calculatedPkt = updatedBrands[bIndex].transferPkt;

                    if (packetSize > 0) {
                        const qty = parseFloat(value) || 0;
                        if (qty > 0) {
                            calculatedPkt = (qty / packetSize).toFixed(2);
                            if (calculatedPkt.endsWith('.00')) calculatedPkt = calculatedPkt.slice(0, -3);
                        } else {
                            calculatedPkt = '';
                        }
                    }

                    updatedBrands[bIndex] = { ...updatedBrands[bIndex], [name]: value, transferPkt: calculatedPkt };
                } else if (name === 'transferPkt') {
                    const currentProductName = updatedProducts[pIndex].productName;
                    const currentBrandName = updatedBrands[bIndex].brand;

                    const productData = products.find(p => p.name === currentProductName);
                    const brandData = productData?.brands?.find(b => b.brand === currentBrandName);
                    const packetSize = brandData?.packetSize ? parseFloat(brandData.packetSize) : 0;

                    let calculatedQty = updatedBrands[bIndex].transferQty;

                    if (packetSize > 0) {
                        const pkt = parseFloat(value) || 0;
                        if (pkt > 0) {
                            calculatedQty = (pkt * packetSize).toFixed(2);
                            if (calculatedQty.endsWith('.00')) calculatedQty = calculatedQty.slice(0, -3);
                        } else {
                            calculatedQty = '';
                        }
                    }

                    updatedBrands[bIndex] = { ...updatedBrands[bIndex], [name]: value, transferQty: calculatedQty };
                } else {
                    updatedBrands[bIndex] = { ...updatedBrands[bIndex], [name]: value };
                }
                updatedProducts[pIndex] = { ...updatedProducts[pIndex], brandEntries: updatedBrands };
            } else {
                // Update product-specific field
                if (name === 'productName') {
                    updatedProducts[pIndex] = {
                        ...updatedProducts[pIndex],
                        [name]: value,
                        brandEntries: updatedProducts[pIndex].brandEntries.map(b => ({ ...b, brand: '' }))
                    };
                    setActiveProductIndex(pIndex);
                    setShowProductDropdown(true);
                } else {
                    updatedProducts[pIndex] = { ...updatedProducts[pIndex], [name]: value };
                }
            }
            setStockFormData(prev => ({ ...prev, productEntries: updatedProducts }));
        } else {
            if (name === 'whName' && value === '') {
                setStockFormData(prev => ({
                    ...prev,
                    whName: '',
                    manager: '',
                    location: '',
                    capacity: ''
                }));
            } else if (name === 'to' && value === '') {
                setStockFormData(prev => ({
                    ...prev,
                    to: '',
                    toManager: '',
                    toLocation: '',
                    toCapacity: ''
                }));
            } else {
                setStockFormData(prev => ({ ...prev, [name]: value }));
            }
            if (name === 'whName') setShowWhDropdown(true);
            if (name === 'to') setShowToDropdown(true);
        }
    };

    const addProductEntry = () => {
        setStockFormData(prev => ({
            ...prev,
            productEntries: [...prev.productEntries, {
                productName: '',
                brandEntries: [{
                    brand: '',
                    inhousePkt: '',
                    inhouseQty: '',
                    whPkt: '',
                    whQty: '',
                    transferPkt: '',
                    transferQty: ''
                }]
            }]
        }));
    };

    const removeProductEntry = (index) => {
        if (stockFormData.productEntries.length > 1) {
            setStockFormData(prev => ({
                ...prev,
                productEntries: prev.productEntries.filter((_, i) => i !== index)
            }));
        }
    };

    const addBrandEntry = (pIndex) => {
        const updatedProducts = [...stockFormData.productEntries];
        updatedProducts[pIndex].brandEntries.push({
            brand: '',
            inhousePkt: '',
            inhouseQty: '',
            whPkt: '',
            whQty: '',
            transferPkt: '',
            transferQty: ''
        });
        setStockFormData(prev => ({ ...prev, productEntries: updatedProducts }));
    };

    const removeBrandEntry = (pIndex, bIndex) => {
        const updatedProducts = [...stockFormData.productEntries];
        if (updatedProducts[pIndex].brandEntries.length > 1) {
            updatedProducts[pIndex].brandEntries = updatedProducts[pIndex].brandEntries.filter((_, i) => i !== bIndex);
            setStockFormData(prev => ({ ...prev, productEntries: updatedProducts }));
        }
    };

    const uniqueWarehouses = useMemo(() => {
        if (!warehouseData || !Array.isArray(warehouseData)) return [];
        const warehouses = warehouseData.reduce((acc, current) => {
            if (current?.whName && !acc.find(item => item.whName === current.whName)) {
                acc.push({
                    _id: current._id, // This persists the MongoDB ID for warehouses
                    whName: current.whName,
                    manager: current.manager || '',
                    location: current.location || '',
                    capacity: current.capacity || 0
                });
            }
            return acc;
        }, []);
        return warehouses;
    }, [warehouseData]);

    const warehouseProductCounts = useMemo(() => {
        const counts = {};
        warehouseData.forEach(item => {
            if (!counts[item.whName]) counts[item.whName] = 0;
            const hasProduct = (item.productName && item.productName !== '-') || (item.product && item.product !== '-');
            if (hasProduct) {
                counts[item.whName]++;
            }
        });
        return counts;
    }, [warehouseData]);

    const availableBrands = useMemo(() => {
        const activeProduct = stockFormData.productEntries[activeProductIndex];
        if (!activeProduct || !activeProduct.productName || !products) return [];
        const selectedProduct = products.find(p => p.name === activeProduct.productName);
        return selectedProduct ? (selectedProduct.brands || []) : [];
    }, [stockFormData.productEntries, activeProductIndex, products]);

    const dashboardStats = useMemo(() => {
        const itemsWithStock = warehouseData.filter(item => (item.productName && item.productName !== '-') || (item.product && item.product !== '-'));
        const totalItems = itemsWithStock.length;

        const totalCapacity = uniqueWarehouses.reduce((sum, wh) => sum + (parseFloat(wh.capacity) || 0), 0);
        const usedCapacity = warehouseData.reduce((sum, item) => sum + (parseFloat(item.whQty) || 0), 0);

        let availableCapacityPercent = 100;
        if (totalCapacity > 0) {
            availableCapacityPercent = Math.max(0, Math.round(((totalCapacity - usedCapacity) / totalCapacity) * 100));
        }

        const pendingTransfers = warehouseData.filter(item => (parseFloat(item.transferPkt) || 0) > 0).length;
        const lowStockCount = itemsWithStock.filter(item => (parseFloat(item.whQty) || 0) < 50).length; // Default threshold of 50

        return {
            totalItems,
            availableCapacity: `${availableCapacityPercent}%`,
            pendingTransfers,
            lowStockCount
        };
    }, [warehouseData, uniqueWarehouses]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (whDropdownRef.current && !whDropdownRef.current.contains(event.target)) {
                setShowWhDropdown(false);
            }
            if (productDropdownRef.current && !productDropdownRef.current.contains(event.target)) {
                setShowProductDropdown(false);
            }
            if (brandDropdownRef.current && !brandDropdownRef.current.contains(event.target)) {
                setShowBrandDropdown(false);
            }
            if (toDropdownRef.current && !toDropdownRef.current.contains(event.target)) {
                setShowToDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleEditStock = (record) => {
        setEditingStockId(record._id);
        setStockFormData({
            whName: record.whName || '',
            manager: record.manager || '',
            location: record.location || '',
            capacity: record.capacity || '',
            to: record.to || '',
            toManager: record.toManager || '',
            toLocation: record.toLocation || '',
            toCapacity: record.toCapacity || '',
            productEntries: [{
                productName: record.product || '',
                brandEntries: [{
                    brand: record.brand || '',
                    inhousePkt: record.inhousePkt || '',
                    inhouseQty: record.inhouseQty || '',
                    whPkt: record.whPkt || '',
                    whQty: record.whQty || '',
                    transferPkt: record.transferPkt || '',
                    transferQty: record.transferQty || ''
                }]
            }]
        });
        setShowStockForm(true);
        setShowWarehouseForm(false);
    };

    const handleDeleteStock = async (id, type = 'stock') => {
        try {
            await axios.delete(`${API_BASE_URL}/api/warehouses/${id}`);
            setWarehouseData(prev => prev.filter(item => item._id !== id));
            setDeleteConfirm({ show: false, id: null, type: type });
        } catch (error) {
            console.error(`Error deleting ${type}:`, error);
        }
    };

    const handleEditWarehouse = (wh) => {
        setEditingWarehouseId(wh._id);
        setWarehouseFormData({
            name: wh.whName || '',
            location: wh.location || '',
            manager: wh.manager || '',
            capacity: wh.capacity || '',
            type: wh.type || 'General',
            status: wh.status || 'Active'
        });
        setShowWarehouseForm(true);
        setShowStockForm(false);
    };

    const handleStockSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            if (editingStockId) {
                const productEntry = stockFormData.productEntries[0];
                const brandEntry = productEntry.brandEntries[0];
                const updatedEntry = {
                    whName: stockFormData.whName,
                    manager: stockFormData.manager,
                    location: stockFormData.location,
                    capacity: parseFloat(stockFormData.capacity) || 0,
                    to: stockFormData.to,
                    toManager: stockFormData.toManager,
                    toLocation: stockFormData.toLocation,
                    toCapacity: parseFloat(stockFormData.toCapacity) || 0,
                    product: productEntry.productName,
                    brand: brandEntry.brand,
                    inhousePkt: parseFloat(brandEntry.inhousePkt) || 0,
                    inhouseQty: parseFloat(brandEntry.inhouseQty) || 0,
                    whPkt: parseFloat(brandEntry.whPkt) || 0,
                    whQty: parseFloat(brandEntry.whQty) || 0,
                    transferPkt: parseFloat(brandEntry.transferPkt) || 0,
                    transferQty: parseFloat(brandEntry.transferQty) || 0
                };

                const encryptedData = encryptData(updatedEntry);
                const response = await axios.put(`${API_BASE_URL}/api/warehouses/${editingStockId}`, { data: encryptedData });

                const decryptedResponse = {
                    ...decryptData(response.data.data),
                    _id: response.data._id,
                    createdAt: response.data.createdAt,
                    updatedAt: response.data.updatedAt
                };

                setWarehouseData(prev => prev.map(item => item._id === editingStockId ? decryptedResponse : item));
                setEditingStockId(null);
            } else {
                for (const productEntry of stockFormData.productEntries) {
                    for (const brandEntry of productEntry.brandEntries) {
                        const transferQty = parseFloat(brandEntry.transferQty) || 0;
                        const transferPkt = parseFloat(brandEntry.transferPkt) || 0;

                        // 1. Handle Source Deduction - ONLY deduct from whQty/whPkt, never touch InHouse fields
                        if (transferQty > 0 || transferPkt > 0) {
                            const sourceRecord = warehouseData.find(item =>
                                item.whName === stockFormData.whName &&
                                (item.productName || item.product) === productEntry.productName &&
                                item.brand === brandEntry.brand
                            );

                            if (sourceRecord) {
                                // Always deduct from whQty/whPkt only - InHouse is never affected by transfers
                                const updatedSource = {
                                    ...sourceRecord,
                                    whQty: (parseFloat(sourceRecord.whQty) || 0) - transferQty,
                                    whPkt: (parseFloat(sourceRecord.whPkt) || 0) - transferPkt
                                };
                                // Remove internal fields before encrypting
                                const { _id, recordType, createdAt, updatedAt, ...sourceDataToEncrypt } = updatedSource;

                                const encryptedSource = encryptData(sourceDataToEncrypt);

                                if (sourceRecord.recordType === 'stock') {
                                    await axios.put(`${API_BASE_URL}/api/stock/${sourceRecord._id}`, { data: encryptedSource });
                                } else {
                                    await axios.put(`${API_BASE_URL}/api/warehouses/${sourceRecord._id}`, { data: encryptedSource });
                                }
                            }
                        }

                        // 2. Handle Destination Addition (Transfer or New Stock)
                        const destWhName = stockFormData.to || stockFormData.whName; // Default to 'From' if no 'To' specified

                        // Check if destination record exists
                        const destRecord = warehouseData.find(item =>
                            item.whName === destWhName &&
                            (item.productName || item.product) === productEntry.productName &&
                            item.brand === brandEntry.brand
                        );

                        if (destRecord) {
                            // Update existing destination record
                            const updatedDest = {
                                ...destRecord,
                                whQty: (parseFloat(destRecord.whQty) || 0) + transferQty,
                                whPkt: (parseFloat(destRecord.whPkt) || 0) + transferPkt
                            };
                            // Remove internal fields before encrypting
                            const { _id, recordType, createdAt, updatedAt, ...destDataToEncrypt } = updatedDest;

                            const encryptedDest = encryptData(destDataToEncrypt);

                            if (destRecord.recordType === 'stock') {
                                await axios.put(`${API_BASE_URL}/api/stock/${destRecord._id}`, { data: encryptedDest });
                            } else {
                                await axios.put(`${API_BASE_URL}/api/warehouses/${destRecord._id}`, { data: encryptedDest });
                            }
                        } else {
                            // Create new destination record
                            // Use Warehouse model for new records by default
                            const newEntry = {
                                whName: destWhName,
                                manager: stockFormData.toManager || stockFormData.manager,
                                location: stockFormData.toLocation || stockFormData.location,
                                capacity: parseFloat(stockFormData.toCapacity) || parseFloat(stockFormData.capacity) || 0,
                                product: productEntry.productName,
                                brand: brandEntry.brand,
                                // For new transfer records, InHouse values should match the Source's InHouse values 
                                // (as per user request: "Transfer to New Record: InHouse values = Inhouse Values")
                                inhousePkt: parseFloat(brandEntry.inhousePkt) || 0,
                                inhouseQty: parseFloat(brandEntry.inhouseQty) || 0,
                                whPkt: transferPkt,
                                whQty: transferQty,
                                transferPkt: 0,
                                transferQty: 0
                            };
                            const encryptedData = encryptData(newEntry);
                            await axios.post(`${API_BASE_URL}/api/warehouses`, { data: encryptedData });
                        }
                    }
                }
                // Refresh data to reflect changes
                await fetchWarehouses();
            }

            setSubmitStatus('success');
            setTimeout(() => {
                setShowStockForm(false);
                setSubmitStatus(null);
                setEditingStockId(null);
                setStockFormData({
                    whName: '',
                    manager: '',
                    location: '',
                    capacity: '',
                    to: '',
                    toManager: '',
                    toLocation: '',
                    toCapacity: '',
                    productEntries: [{
                        productName: '',
                        brandEntries: [{
                            brand: '',
                            inhousePkt: '',
                            inhouseQty: '',
                            whPkt: '',
                            whQty: '',
                            transferPkt: '',
                            transferQty: ''
                        }]
                    }]
                });
            }, 1500);
        } catch (error) {
            console.error('Error saving stock:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredData = useMemo(() => {
        if (!warehouseData || !Array.isArray(warehouseData)) return [];
        return warehouseData.filter(item => {
            const search = searchQuery.toLowerCase();
            return (
                (item.whName || '').toLowerCase().includes(search) ||
                (item.manager || '').toLowerCase().includes(search) ||
                (item.product || '').toLowerCase().includes(search) ||
                (item.brand || '').toLowerCase().includes(search) ||
                (item.location || '').toLowerCase().includes(search)
            );
        });
    }, [warehouseData, searchQuery]);

    const groupedStockData = useMemo(() => {
        const groups = {};

        // Extract unique warehouses even if they have no entries in filteredData
        uniqueWarehouses.forEach(wh => {
            const whKey = wh.whName.trim();
            if (!groups[whKey]) {
                groups[whKey] = {
                    whName: whKey,
                    manager: wh.manager || '-',
                    location: wh.location || '-',
                    products: {}
                };
            }
        });

        filteredData.forEach(item => {
            const rawWhName = (item.whName || item.warehouse || '').trim();
            if (!rawWhName) return;

            const whKey = rawWhName;
            if (!groups[whKey]) {
                groups[whKey] = {
                    whName: whKey,
                    manager: item.manager || '-',
                    location: item.location || '-',
                    products: {}
                };
            }

            // Merge metadata if available from this item
            if (item.manager && item.manager !== '-') groups[whKey].manager = item.manager;
            if (item.location && item.location !== '-') groups[whKey].location = item.location;

            const prodName = (item.productName || item.product || '').trim();
            if (!prodName || prodName === '-') return;

            if (!groups[whKey].products[prodName]) {
                groups[whKey].products[prodName] = {
                    productName: prodName,
                    brands: []
                };
            }
            groups[whKey].products[prodName].brands.push(item);
        });

        return Object.values(groups)
            .map(wh => ({
                ...wh,
                products: Object.values(wh.products)
            }))
            .filter(wh => wh.products.length > 0);
    }, [filteredData, uniqueWarehouses]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setWarehouseFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const newWarehouse = {
                whName: warehouseFormData.name,
                manager: warehouseFormData.manager,
                location: warehouseFormData.location,
                capacity: parseFloat(warehouseFormData.capacity) || 0,
                type: warehouseFormData.type,
                status: warehouseFormData.status,
                product: '-',
                brand: '-',
                inhousePkt: 0,
                inhouseQty: 0,
                whPkt: 0,
                whQty: 0
            };

            const encryptedData = encryptData(newWarehouse);
            let response;
            if (editingWarehouseId) {
                response = await axios.put(`${API_BASE_URL}/api/warehouses/${editingWarehouseId}`, { data: encryptedData });
            } else {
                response = await axios.post(`${API_BASE_URL}/api/warehouses`, { data: encryptedData });
            }

            const decryptedResponse = {
                ...decryptData(response.data.data),
                _id: response.data._id,
                createdAt: response.data.createdAt,
                updatedAt: response.data.updatedAt
            };

            if (editingWarehouseId) {
                setWarehouseData(prev => prev.map(item => item._id === editingWarehouseId ? decryptedResponse : item));
            } else {
                setWarehouseData(prev => [decryptedResponse, ...prev]);
            }
            setSubmitStatus('success');
            setTimeout(() => {
                setShowWarehouseForm(false);
                setSubmitStatus(null);
                setEditingWarehouseId(null);
                setWarehouseFormData({
                    name: '',
                    location: '',
                    manager: '',
                    capacity: '',
                    type: 'General',
                    status: 'Active'
                });
            }, 1500);
        } catch (error) {
            console.error('Error adding warehouse:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Ware House Management</h2>
                    <p className="text-sm text-gray-500 mt-1">Manage and track warehouse specific stock and locations</p>
                </div>
                {!showWarehouseForm && !showStockForm && (
                    <div className="flex-1 max-w-md mx-6 relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name, location or manager..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all outline-none"
                            autoComplete="off"
                        />
                    </div>
                )}

                {!showWarehouseForm && !showStockForm && (
                    <div className="flex items-center space-x-3">
                        <button
                            className="flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-all shadow-sm font-medium"
                        >
                            <FunnelIcon className="w-4 h-4 mr-2" />
                            Filter
                        </button>
                        <button
                            onClick={() => {
                                setShowStockForm(true);
                                setShowWarehouseForm(false);
                            }}
                            className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:scale-105 font-medium"
                        >
                            <PlusIcon className="w-5 h-5 mr-2" />
                            Add Stock
                        </button>
                        <button
                            onClick={() => {
                                setShowWarehouseForm(true);
                                setShowStockForm(false);
                            }}
                            className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:scale-105 font-medium"
                        >
                            <HomeIcon className="w-5 h-5 mr-2" />
                            Add New
                        </button>
                    </div>
                )}
            </div>

            {!showWarehouseForm && !showStockForm && (
                <div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('stock')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'stock'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                            }`}
                    >
                        Stock Summary
                    </button>
                    <button
                        onClick={() => setActiveTab('warehouses')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'warehouses'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                            }`}
                    >
                        Warehouse List
                    </button>
                </div>
            )}

            {/* Add Stock to WH Form Card */}
            {showStockForm && (
                <div className="warehouse-form-container border-blue-100">
                    <div className="warehouse-form-bg-orb bg-blue-400/20 left-1/4 top-1/4"></div>
                    <div className="warehouse-form-bg-orb bg-indigo-400/20 right-1/4 bottom-1/4"></div>

                    <div className="warehouse-form-header">
                        <div>
                            <h3 className="warehouse-form-title text-blue-900">{editingStockId ? 'Edit Warehouse Stock' : 'Add Stock to Warehouse'}</h3>
                            <p className="text-sm text-gray-500">Record a new stock entry for a specific warehouse</p>
                        </div>
                        <button onClick={() => setShowStockForm(false)} className="warehouse-form-close hover:bg-blue-50 hover:text-blue-600">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleStockSubmit} className="relative z-10 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="space-y-2 relative" ref={whDropdownRef}>
                                <label className="text-sm font-bold text-gray-700 ml-1">From</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        name="whName"
                                        value={stockFormData.whName}
                                        onChange={handleStockInputChange}
                                        onFocus={() => setShowWhDropdown(true)}
                                        placeholder="Select or enter warehouse"
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all backdrop-blur-sm text-sm pr-10"
                                        required
                                        autoComplete="off"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${showWhDropdown ? 'rotate-180' : ''}`} />
                                    </div>
                                </div>

                                {showWhDropdown && (
                                    <div className="absolute z-[100] mt-1 w-full bg-white/95 backdrop-blur-md border border-gray-100 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                        <div className="max-h-60 overflow-y-auto py-1">
                                            {uniqueWarehouses
                                                .filter(wh =>
                                                    wh.whName.toLowerCase().includes(stockFormData.whName.toLowerCase()) &&
                                                    wh.whName !== stockFormData.to
                                                )
                                                .map((wh, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => {
                                                            setStockFormData(prev => ({
                                                                ...prev,
                                                                whName: wh.whName,
                                                                manager: wh.manager || prev.manager,
                                                                location: wh.location || prev.location,
                                                                capacity: wh.capacity || prev.capacity
                                                            }));
                                                            setShowWhDropdown(false);
                                                        }}
                                                        className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors group"
                                                    >
                                                        <div className="font-bold text-gray-900 text-sm group-hover:text-blue-700">{wh.whName}</div>
                                                    </button>
                                                ))}
                                            {uniqueWarehouses.filter(wh =>
                                                wh.whName.toLowerCase().includes(stockFormData.whName.toLowerCase()) &&
                                                wh.whName !== stockFormData.to
                                            ).length === 0 && (
                                                    <div className="px-4 py-3 text-xs text-gray-500 italic">No warehouses found</div>
                                                )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 ml-1">Manager</label>
                                <input
                                    type="text"
                                    name="manager"
                                    value={stockFormData.manager}
                                    onChange={handleStockInputChange}
                                    placeholder="Manager Name"
                                    className={`w-full px-4 py-2.5 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all backdrop-blur-sm text-sm ${!editingStockId ? 'bg-gray-50/80 text-gray-500' : 'bg-white/50'}`}
                                    required
                                    autoComplete="off"
                                    readOnly={!editingStockId}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 ml-1">Address</label>
                                <input
                                    type="text"
                                    name="location"
                                    value={stockFormData.location}
                                    onChange={handleStockInputChange}
                                    placeholder="Location/Address"
                                    className={`w-full px-4 py-2.5 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all backdrop-blur-sm text-sm ${!editingStockId ? 'bg-gray-50/80 text-gray-500' : 'bg-white/50'}`}
                                    autoComplete="off"
                                    readOnly={!editingStockId}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 ml-1">Capacity (KG)</label>
                                <input
                                    type="number"
                                    name="capacity"
                                    value={stockFormData.capacity}
                                    onChange={handleStockInputChange}
                                    placeholder="KG Units"
                                    className={`w-full px-4 py-2.5 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all backdrop-blur-sm text-sm ${!editingStockId ? 'bg-gray-50/80 text-gray-500' : 'bg-white/50'}`}
                                    autoComplete="off"
                                    readOnly={!editingStockId}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="space-y-2 relative" ref={toDropdownRef}>
                                <label className="text-sm font-bold text-gray-700 ml-1">To</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        name="to"
                                        value={stockFormData.to}
                                        onChange={handleStockInputChange}
                                        onFocus={() => setShowToDropdown(true)}
                                        placeholder="Select warehouse"
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all backdrop-blur-sm text-sm pr-10"
                                        required
                                        autoComplete="off"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${showToDropdown ? 'rotate-180' : ''}`} />
                                    </div>
                                </div>

                                {showToDropdown && (
                                    <div className="absolute z-[100] mt-1 w-full bg-white/95 backdrop-blur-md border border-gray-100 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                        <div className="max-h-60 overflow-y-auto py-1">
                                            {uniqueWarehouses
                                                .filter(wh =>
                                                    wh.whName.toLowerCase().includes(stockFormData.to.toLowerCase()) &&
                                                    wh.whName !== stockFormData.whName
                                                )
                                                .map((wh, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => {
                                                            setStockFormData(prev => ({
                                                                ...prev,
                                                                to: wh.whName,
                                                                toManager: wh.manager,
                                                                toLocation: wh.location,
                                                                toCapacity: wh.capacity
                                                            }));
                                                            setShowToDropdown(false);
                                                        }}
                                                        className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors group"
                                                    >
                                                        <div className="font-bold text-gray-900 text-sm group-hover:text-blue-700">{wh.whName}</div>
                                                    </button>
                                                ))}
                                            {uniqueWarehouses.filter(wh =>
                                                wh.whName.toLowerCase().includes(stockFormData.to.toLowerCase()) &&
                                                wh.whName !== stockFormData.whName
                                            ).length === 0 && (
                                                    <div className="px-4 py-3 text-xs text-gray-500 italic">No warehouses found</div>
                                                )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 ml-1">To Manager</label>
                                <input
                                    type="text"
                                    name="toManager"
                                    value={stockFormData.toManager}
                                    onChange={handleStockInputChange}
                                    placeholder="Manager Name"
                                    className={`w-full px-4 py-2.5 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all backdrop-blur-sm text-sm ${!editingStockId ? 'bg-gray-50/80 text-gray-500' : 'bg-white/50'}`}
                                    autoComplete="off"
                                    readOnly={!editingStockId}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 ml-1">To Address</label>
                                <input
                                    type="text"
                                    name="toLocation"
                                    value={stockFormData.toLocation}
                                    onChange={handleStockInputChange}
                                    placeholder="Location/Address"
                                    className={`w-full px-4 py-2.5 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all backdrop-blur-sm text-sm ${!editingStockId ? 'bg-gray-50/80 text-gray-500' : 'bg-white/50'}`}
                                    autoComplete="off"
                                    readOnly={!editingStockId}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 ml-1">To Capacity (KG)</label>
                                <input
                                    type="number"
                                    name="toCapacity"
                                    value={stockFormData.toCapacity}
                                    onChange={handleStockInputChange}
                                    placeholder="KG Units"
                                    className={`w-full px-4 py-2.5 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all backdrop-blur-sm text-sm ${!editingStockId ? 'bg-gray-50/80 text-gray-500' : 'bg-white/50'}`}
                                    autoComplete="off"
                                    readOnly={!editingStockId}
                                />
                            </div>
                        </div>

                        {/* Stock Details Section */}
                        <div className="col-span-full space-y-8 mt-4 animate-in fade-in duration-500">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                                    Product Details
                                </h4>
                                <button
                                    type="button"
                                    onClick={addProductEntry}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all duration-300 font-semibold text-sm shadow-sm active:scale-95 group"
                                >
                                    <PlusIcon className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                                    Add Product
                                </button>
                            </div>

                            <div className="space-y-12">
                                {stockFormData.productEntries.map((product, pIndex) => (
                                    <div key={pIndex} className="relative p-6 rounded-2xl bg-gray-50/30 border border-gray-100 group/product hover:border-blue-200 hover:bg-white/80 transition-all duration-500 space-y-6">
                                        {/* Remove Product Button */}
                                        {stockFormData.productEntries.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeProductEntry(pIndex)}
                                                className="absolute -top-3 -right-3 p-2 bg-white text-gray-400 hover:text-red-500 rounded-xl shadow-lg border border-gray-100 opacity-0 group-hover/product:opacity-100 transition-all duration-300 hover:scale-110 active:scale-90 z-20"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            <div className="space-y-2 relative">
                                                <label className="text-sm font-bold text-gray-700 ml-1">Product</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        name="productName"
                                                        value={product.productName}
                                                        onChange={(e) => handleStockInputChange(e, pIndex)}
                                                        onFocus={() => {
                                                            setActiveProductIndex(pIndex);
                                                            setShowProductDropdown(true);
                                                        }}
                                                        placeholder="Select Product"
                                                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm shadow-sm"
                                                        required
                                                        autoComplete="off"
                                                    />
                                                    {showProductDropdown && activeProductIndex === pIndex && (
                                                        <div className="absolute z-[100] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-2xl overflow-hidden min-w-[200px]" ref={productDropdownRef}>
                                                            <div className="max-h-60 overflow-y-auto py-1">
                                                                {products
                                                                    .filter(p => (p.name || '').toLowerCase().includes((product.productName || '').toLowerCase()))
                                                                    .map((p, pIdx) => (
                                                                        <button
                                                                            key={pIdx}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const fakeEvent = { target: { name: 'productName', value: p.name } };
                                                                                handleStockInputChange(fakeEvent, pIndex);
                                                                                setShowProductDropdown(false);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors group"
                                                                        >
                                                                            <div className="font-bold text-gray-900 text-sm group-hover:text-blue-700">{p.name}</div>
                                                                        </button>
                                                                    ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Brand Entries for this Product */}
                                        <div className="space-y-4">
                                            <div className="hidden lg:grid grid-cols-8 gap-4 px-3 mb-1 pr-[88px]">
                                                <div className="col-span-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Brand</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">InHouse QTY</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">InHouse PKT</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">WareHouse QTY</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">WareHouse PKT</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Transfer QTY</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Transfer PKT</div>
                                            </div>

                                            {product.brandEntries.map((brandEntry, bIndex) => (
                                                <div key={bIndex} className="flex items-center gap-4 p-3 bg-white/40 border border-gray-200/50 rounded-xl group/brand hover:border-blue-200 transition-all">
                                                    <div className="flex-1 grid grid-cols-8 gap-4 items-center">
                                                        <div className="col-span-2 relative">
                                                            <input
                                                                type="text"
                                                                name="brand"
                                                                value={brandEntry.brand}
                                                                onChange={(e) => handleStockInputChange(e, pIndex, bIndex)}
                                                                onFocus={() => {
                                                                    setActiveProductIndex(pIndex);
                                                                    setActiveBrandIndex(bIndex);
                                                                    setShowBrandDropdown(true);
                                                                }}
                                                                placeholder="Brand"
                                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm"
                                                                required
                                                                autoComplete="off"
                                                                disabled={!product.productName}
                                                            />
                                                            {showBrandDropdown && activeProductIndex === pIndex && activeBrandIndex === bIndex && product.productName && (
                                                                <div className="absolute z-[100] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-2xl overflow-hidden min-w-[220px]" ref={brandDropdownRef}>
                                                                    <div className="max-h-60 overflow-y-auto py-1">
                                                                        {availableBrands
                                                                            .filter(b => (b.brand || '').toLowerCase().includes((brandEntry.brand || '').toLowerCase()))
                                                                            .map((b, bIdx) => (
                                                                                <button
                                                                                    key={bIdx}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const fakeEvent = { target: { name: 'brand', value: b.brand } };
                                                                                        handleStockInputChange(fakeEvent, pIndex, bIndex);
                                                                                        setShowBrandDropdown(false);
                                                                                    }}
                                                                                    className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors group"
                                                                                >
                                                                                    <div className="font-bold text-gray-900 text-xs group-hover:text-blue-700 whitespace-nowrap">{b.brand}</div>
                                                                                </button>
                                                                            ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <input
                                                            type="number"
                                                            name="inhouseQty"
                                                            value={brandEntry.inhouseQty}
                                                            onChange={(e) => handleStockInputChange(e, pIndex, bIndex)}
                                                            placeholder="0"
                                                            className="w-full px-2 py-2 bg-gray-50/50 border border-gray-100 rounded-lg text-sm text-center font-mono outline-none focus:border-blue-400"
                                                            required
                                                            readOnly
                                                        />
                                                        <input
                                                            type="number"
                                                            name="inhousePkt"
                                                            value={brandEntry.inhousePkt}
                                                            onChange={(e) => handleStockInputChange(e, pIndex, bIndex)}
                                                            placeholder="0"
                                                            className="w-full px-2 py-2 bg-gray-50/50 border border-gray-100 rounded-lg text-sm text-center font-mono outline-none focus:border-blue-400"
                                                            required
                                                            readOnly
                                                        />
                                                        <input
                                                            type="number"
                                                            name="whQty"
                                                            value={brandEntry.whQty}
                                                            onChange={(e) => handleStockInputChange(e, pIndex, bIndex)}
                                                            placeholder="0"
                                                            className="w-full px-2 py-2 bg-gray-50/50 border border-gray-100 rounded-lg text-sm text-center font-mono outline-none focus:border-blue-400"
                                                            required
                                                            readOnly
                                                        />
                                                        <input
                                                            type="number"
                                                            name="whPkt"
                                                            value={brandEntry.whPkt}
                                                            onChange={(e) => handleStockInputChange(e, pIndex, bIndex)}
                                                            placeholder="0"
                                                            className="w-full px-2 py-2 bg-gray-50/50 border border-gray-100 rounded-lg text-sm text-center font-mono outline-none focus:border-blue-400"
                                                            required
                                                            readOnly
                                                        />
                                                        <input
                                                            type="number"
                                                            name="transferQty"
                                                            value={brandEntry.transferQty}
                                                            onChange={(e) => handleStockInputChange(e, pIndex, bIndex)}
                                                            placeholder="0"
                                                            className="w-full px-2 py-2 bg-white border border-indigo-100 rounded-lg text-sm text-center font-mono outline-none focus:border-indigo-400"
                                                            required
                                                        />
                                                        <input
                                                            type="number"
                                                            name="transferPkt"
                                                            value={brandEntry.transferPkt}
                                                            onChange={(e) => handleStockInputChange(e, pIndex, bIndex)}
                                                            placeholder="0"
                                                            className="w-full px-2 py-2 bg-white border border-indigo-100 rounded-lg text-sm text-center font-mono outline-none focus:border-indigo-400"
                                                            required
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1 w-[72px]">
                                                        <button
                                                            type="button"
                                                            onClick={() => addBrandEntry(pIndex)}
                                                            className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-all"
                                                        >
                                                            <PlusIcon className="w-4 h-4" />
                                                        </button>
                                                        {product.brandEntries.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeBrandEntry(pIndex, bIndex)}
                                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                            >
                                                                <TrashIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="warehouse-form-footer">
                            <div className="flex-1">
                                {submitStatus === 'success' && (
                                    <p className="text-green-600 font-medium flex items-center animate-bounce">
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                        Stock saved successfully!
                                    </p>
                                )}
                                {submitStatus === 'error' && (
                                    <p className="text-red-600 font-medium flex items-center">
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        Failed to save stock.
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowStockForm(false)}
                                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200 text-sm flex items-center shadow-md disabled:opacity-50 hover:scale-105"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Saving...
                                    </span>
                                ) : (
                                    <>
                                        <PlusIcon className="w-5 h-5 mr-2" />
                                        {editingStockId ? 'Update Stock' : 'Add Stock'}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {
                showWarehouseForm && (
                    <div className="warehouse-form-container">
                        <div className="warehouse-form-bg-orb warehouse-form-bg-orb-1"></div>
                        <div className="warehouse-form-bg-orb warehouse-form-bg-orb-2"></div>

                        <div className="warehouse-form-header">
                            <div>
                                <h3 className="warehouse-form-title">Add New Warehouse</h3>
                            </div>
                            <button onClick={() => setShowWarehouseForm(false)} className="warehouse-form-close">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 ml-1">Warehouse Name</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <HomeIcon className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            name="name"
                                            value={warehouseFormData.name}
                                            onChange={handleInputChange}
                                            placeholder="e.g. Main Central Warehouse"
                                            className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all backdrop-blur-sm text-sm"
                                            required
                                            autoComplete="off"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 ml-1">Location / Address</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <MapPinIcon className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            name="location"
                                            value={warehouseFormData.location}
                                            onChange={handleInputChange}
                                            placeholder="e.g. Dhaka, Bangladesh"
                                            className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all backdrop-blur-sm text-sm"
                                            required
                                            autoComplete="off"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 ml-1">Warehouse Manager</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <UserIcon className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            name="manager"
                                            value={warehouseFormData.manager}
                                            onChange={handleInputChange}
                                            placeholder="e.g. John Doe"
                                            className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all backdrop-blur-sm text-sm"
                                            autoComplete="off"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 ml-1">Capacity (KG)</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <BoxIcon className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                        </div>
                                        <input
                                            type="number"
                                            name="capacity"
                                            value={warehouseFormData.capacity}
                                            onChange={handleInputChange}
                                            placeholder="e.g. 5000 KG"
                                            className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all backdrop-blur-sm text-sm"
                                            autoComplete="off"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 ml-1">Warehouse Type</label>
                                    <select
                                        name="type"
                                        value={warehouseFormData.type}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all backdrop-blur-sm text-sm cursor-pointer"
                                    >
                                        <option value="General">General</option>
                                        <option value="Cold Storage">Cold Storage</option>
                                        <option value="Bonded">Bonded</option>
                                        <option value="Distribution Center">Distribution Center</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 ml-1">Status</label>
                                    <select
                                        name="status"
                                        value={warehouseFormData.status}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all backdrop-blur-sm text-sm cursor-pointer"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Maintenance">Maintenance</option>
                                        <option value="Full">Full</option>
                                    </select>
                                </div>
                            </div>

                            <div className="warehouse-form-footer">
                                <div className="flex-1">
                                    {submitStatus === 'success' && (
                                        <p className="text-green-600 font-medium flex items-center animate-bounce">
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                            Warehouse created successfully!
                                        </p>
                                    )}
                                    {submitStatus === 'error' && (
                                        <p className="text-red-600 font-medium flex items-center">
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                            Failed to create warehouse.
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowWarehouseForm(false)}
                                    className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex items-center justify-center disabled:opacity-50 px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200 text-sm shadow-md hover:scale-105"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <span className="flex items-center">
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Creating...
                                        </span>
                                    ) : (
                                        <>
                                            <PlusIcon className="w-5 h-5 mr-2" />
                                            Create Warehouse
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )
            }

            {
                !showWarehouseForm && !showStockForm && (
                    <>
                        {/* Placeholder Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {[
                                { label: 'Total Items', value: dashboardStats.totalItems.toString(), icon: BoxIcon, color: 'blue' },
                                { label: 'Available Capacity', value: dashboardStats.availableCapacity, icon: TrendingUpIcon, color: 'emerald' },
                                { label: 'Pending Transfers', value: dashboardStats.pendingTransfers.toString(), icon: BellIcon, color: 'amber' },
                                { label: 'Low Stock Alerts', value: dashboardStats.lowStockCount.toString(), icon: ShoppingCartIcon, color: 'red' },
                            ].map((card, i) => (
                                <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`p-3 bg-${card.color}-50 rounded-xl`}>
                                            <card.icon className={`w-6 h-6 text-${card.color}-600`} />
                                        </div>
                                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">+0%</span>
                                    </div>
                                    <p className="text-sm font-medium text-gray-500">{card.label}</p>
                                    <p className="text-2xl font-black text-gray-900 mt-1">{card.value}</p>
                                </div>
                            ))}
                        </div>

                        {activeTab === 'stock' && (
                            filteredData.length > 0 ? (
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">WH Name</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                                                    <th colSpan="6" className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        <div className="grid grid-cols-6 gap-4">
                                                            <div className="text-left font-bold text-gray-800">Brand</div>
                                                            <div className="text-right font-bold text-emerald-800 uppercase">InHouse QTY</div>
                                                            <div className="text-right font-bold text-emerald-800 uppercase">InHouse PKT</div>
                                                            <div className="text-right font-bold text-blue-800 uppercase">WareHouse QTY</div>
                                                            <div className="text-right font-bold text-blue-800 uppercase">WareHouse PKT</div>
                                                            <div className="text-right font-bold text-gray-500">Actions</div>
                                                        </div>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {groupedStockData.map((whGroup, whIdx) => (
                                                    <React.Fragment key={whIdx}>
                                                        {whGroup.products.map((prodGroup, prodIdx) => (
                                                            <tr key={`${whIdx}-${prodIdx}`} className="hover:bg-gray-50/30 transition-colors group border-b border-gray-50">
                                                                <td className="px-6 py-4 align-top">
                                                                    {prodIdx === 0 && (
                                                                        <div className="text-sm font-bold text-gray-900">{whGroup.whName}</div>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 align-top">
                                                                    <div className="text-sm font-semibold text-gray-800">{prodGroup.productName}</div>
                                                                </td>
                                                                <td className="px-6 py-4 align-top" colSpan="6">
                                                                    <div className="space-y-4">
                                                                        {prodGroup.brands.map((brand, bIdx) => (
                                                                            <div key={bIdx} className="grid grid-cols-6 gap-4 items-center">
                                                                                <div className="text-sm text-gray-600 font-medium">{brand.brand}</div>
                                                                                <div className="text-sm text-black text-right font-bold">
                                                                                    {parseFloat(brand.inhouseQty || 0).toLocaleString()} kg
                                                                                </div>
                                                                                <div className="text-sm text-black text-right font-bold">
                                                                                    {(() => {
                                                                                        const pkt = brand.inhousePkt || 0;
                                                                                        const size = brand.packetSize || 0;
                                                                                        const whole = Math.floor(pkt);
                                                                                        const remainder = Math.round((pkt % 1) * size);
                                                                                        return remainder > 0 ? `${whole.toLocaleString()} - ${remainder.toLocaleString()} kg` : whole.toLocaleString();
                                                                                    })()}
                                                                                </div>
                                                                                <div className="text-sm text-black text-right font-bold">
                                                                                    {parseFloat(brand.whQty || 0).toLocaleString()} kg
                                                                                </div>
                                                                                <div className="text-sm text-black text-right font-bold">
                                                                                    {(() => {
                                                                                        const pkt = brand.whPkt || 0;
                                                                                        const size = brand.packetSize || 0;
                                                                                        const whole = Math.floor(pkt);
                                                                                        const remainder = Math.round((pkt % 1) * size);
                                                                                        return remainder > 0 ? `${whole.toLocaleString()} - ${remainder.toLocaleString()} kg` : whole.toLocaleString();
                                                                                    })()}
                                                                                </div>
                                                                                <div className="flex items-center justify-end gap-2">
                                                                                    <button onClick={() => handleEditStock(brand)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"><EditIcon className="w-4 h-4" /></button>
                                                                                    <button onClick={() => setDeleteConfirm({ show: true, id: brand._id, type: 'stock' })} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><TrashIcon className="w-4 h-4" /></button>
                                                                                </div>
                                                                            </div>
                                                                        ))}

                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="flex flex-col items-center justify-center p-20">
                                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                                            <HomeIcon className="w-10 h-10 text-gray-300" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900">{searchQuery ? 'No Results Found' : 'Ware House is Empty'}</h3>
                                        <p className="text-gray-500 mt-2 text-center max-w-sm">
                                            {searchQuery ? `We couldn't find any warehouse records matching "${searchQuery}".` : "You haven't added any stock to the warehouse section yet. Start by transferring stock or adding new entries."}
                                        </p>
                                        {!searchQuery && (
                                            <button
                                                onClick={() => {
                                                    setShowStockForm(true);
                                                    setShowWarehouseForm(false);
                                                }}
                                                className="mt-8 px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200"
                                            >
                                                Setup Ware House
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                        {activeTab === 'warehouses' && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">WH Name</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Manager</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Location</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Capacity</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Stock Status</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {uniqueWarehouses.map((wh, idx) => {
                                                const productCount = warehouseProductCounts[wh.whName] || 0;
                                                const isEmpty = productCount === 0;
                                                return (
                                                    <tr key={idx} className={`hover:bg-gray-50/30 transition-colors group ${isEmpty ? 'bg-amber-50/20' : ''}`}>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <HomeIcon className={`w-4 h-4 ${isEmpty ? 'text-amber-500' : 'text-blue-500'}`} />
                                                                <div className="text-sm font-bold text-gray-900">{wh.whName}</div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-600">{wh.manager || '-'}</td>
                                                        <td className="px-6 py-4 text-sm text-gray-600">{wh.location || '-'}</td>
                                                        <td className="px-6 py-4 text-sm text-gray-600">{wh.capacity ? `${wh.capacity.toLocaleString()} KG` : '-'}</td>
                                                        <td className="px-6 py-4">
                                                            {isEmpty ? (
                                                                <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                                                                    No Product
                                                                </span>
                                                            ) : (
                                                                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                                    {productCount} Product{productCount > 1 ? 's' : ''}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleEditWarehouse(wh)}
                                                                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                                                >
                                                                    <EditIcon className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setDeleteConfirm({ show: true, id: wh._id, type: 'warehouse' })}
                                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                >
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )
            }
            {deleteConfirm.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setDeleteConfirm({ show: false, id: null, type: 'stock' })}></div>
                    <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-in zoom-in duration-200">
                        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                            <TrashIcon className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Confirm Delete</h3>
                        <p className="text-gray-500 text-center mb-8">Are you sure you want to delete this {deleteConfirm.type === 'warehouse' ? 'warehouse' : 'stock record'}? This action cannot be undone.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm({ show: false, id: null, type: 'stock' })}
                                className="flex-1 px-6 py-3 bg-gray-50 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteStock(deleteConfirm.id, deleteConfirm.type)}
                                className="flex-1 px-6 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-200"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default WarehouseManagement;
