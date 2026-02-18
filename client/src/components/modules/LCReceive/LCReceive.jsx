import React, { useState, useMemo, useRef, useEffect } from 'react';
import axios from 'axios';
import {
    SearchIcon, FunnelIcon, XIcon, BarChartIcon, EditIcon, TrashIcon, BoxIcon, ChevronDownIcon, PlusIcon
} from '../../Icons';
import { formatDate, API_BASE_URL } from '../../../utils/helpers';
import { encryptData, decryptData } from '../../../utils/encryption';
import CustomDatePicker from '../../shared/CustomDatePicker';
import './LCReceive.css';

function LCReceive({
    stockRecords,
    fetchStockRecords,
    importers,
    ports,
    products,
    brands,
    isSelectionMode,
    setIsSelectionMode,
    selectedItems,
    setSelectedItems,
    startLongPress,
    endLongPress,
    isLongPressTriggered,
    onDelete,
    setShowLcReport,
    lcSearchQuery,
    setLcSearchQuery,
    lcFilters,
    setLcFilters,
    stockFormData,
    setStockFormData,
    showStockForm,
    setShowStockForm,
    editingId,
    setEditingId,
    isSubmitting,
    setIsSubmitting,
    submitStatus,
    setSubmitStatus,
    lcReceiveRecords,
    lcReceiveSummary
}) {
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [warehouses, setWarehouses] = useState([]);
    const [allWhRecords, setAllWhRecords] = useState([]);
    const [whSearchQuery, setWhSearchQuery] = useState('');
    const [validationErrors, setValidationErrors] = useState([]);
    const [showWhSelectDropdown, setShowWhSelectDropdown] = useState(false);

    const productRefs = useRef([]);
    const brandRefs = useRef({});
    const portRef = useRef(null);
    const importerRef = useRef(null);
    const exporterRef = useRef(null);
    const whSelectRef = useRef(null);

    const fetchWarehouses = async () => {
        try {
            // Fetch from both sources
            const [whRes, stockRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/warehouses`),
                axios.get(`${API_BASE_URL}/api/stock`)
            ]);

            const whData = Array.isArray(whRes.data) ? whRes.data : [];
            const stockData = Array.isArray(stockRes.data) ? stockRes.data : [];

            // Decrypt all Warehouse records
            const allDecryptedWh = whData.map(item => {
                const decrypted = decryptData(item.data);
                return {
                    ...decrypted,
                    productName: decrypted.product,
                    packetSize: decrypted.packetSize || (decrypted.whQty && decrypted.whPkt ? (parseFloat(decrypted.whQty) / parseFloat(decrypted.whPkt)).toFixed(0) : 0),
                    _id: item._id
                };
            }).filter(Boolean);

            // Get unique warehouse names for the dropdown (from ALL warehouse records)
            const seen = new Set();
            const uniqueWarehouses = allDecryptedWh.filter(item => {
                if (item.whName && !seen.has(item.whName)) {
                    seen.add(item.whName);
                    return true;
                }
                return false;
            });

            // Filter for stock display (exclude metadata entries)
            const whStockOnly = allDecryptedWh.filter(d => d.product !== '-').map(d => ({
                ...d,
                productName: d.product,
                whPkt: d.whPkt,
                whQty: d.whQty
            }));

            // Decrypt and normalize Stock records
            const decryptedStock = stockData.map(item => {
                try {
                    const d = decryptData(item.data);
                    const rawWh = (d.warehouse || '').trim();
                    if (!rawWh) return null;
                    return {
                        ...d,
                        whName: rawWh,
                        whPkt: d.inHousePacket || 0,
                        whQty: d.inHouseQuantity || 0,
                        productName: d.productName || d.product,
                        packetSize: d.packetSize || d.size || 0,
                        _id: item._id
                    };
                } catch {
                    return null;
                }
            }).filter(Boolean);

            // Combine for comprehensive view
            const allRecords = [...whStockOnly, ...decryptedStock];

            setWarehouses(uniqueWarehouses);
            setAllWhRecords(allRecords);
        } catch (err) {
            console.error('Failed to fetch warehouse data:', err);
        }
    };

    // Fetch warehouses
    useEffect(() => {
        fetchWarehouses();
    }, []);

    // Close warehouse dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (whSelectRef.current && !whSelectRef.current.contains(e.target)) {
                setShowWhSelectDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedWhStock = useMemo(() => {
        const selectedWh = (stockFormData.warehouse || '').trim();
        if (!selectedWh || !allWhRecords.length) return null;
        const filtered = allWhRecords.filter(r => (r.whName || '').trim() === selectedWh);
        const groups = {};
        filtered.forEach(item => {
            const prodKey = item.productName || 'Unnamed Product';
            if (!groups[prodKey]) {
                groups[prodKey] = {
                    productName: prodKey,
                    brands: []
                };
            }
            groups[prodKey].brands.push(item);
        });
        return Object.values(groups);
    }, [stockFormData.warehouse, allWhRecords]);

    // --- Handlers ---
    const resetStockForm = () => {
        setStockFormData({
            date: new Date().toISOString().split('T')[0],
            lcNo: '',
            port: '',
            importer: '',
            exporter: '',
            indianCnF: '',
            indCnFCost: '',
            bdCnF: '',
            bdCnFCost: '',
            billOfEntry: '',
            totalLcTruck: 0,
            totalLcQuantity: '',
            status: 'In Stock',
            warehouse: '',
            productEntries: [{
                isMultiBrand: true,
                productName: '',
                truckNo: '',
                brandEntries: [{ brand: '', purchasedPrice: '', packet: '', packetSize: '', quantity: '', unit: 'kg', sweepedPacket: '', sweepedQuantity: '', inHousePacket: '', inHouseQuantity: '' }]
            }]
        });
        setEditingId(null);
    };

    const recalculateEntry = (entry) => {
        const packet = parseFloat(entry.packet) || 0;
        const size = parseFloat(entry.packetSize) || 0;
        const sweepedPacket = parseFloat(entry.sweepedPacket) || 0;

        entry.quantity = (packet * size).toFixed(2);
        entry.inHousePacket = (packet - sweepedPacket).toFixed(2);
        entry.sweepedQuantity = (sweepedPacket * size).toFixed(2);
        entry.inHouseQuantity = ((packet - sweepedPacket) * size).toFixed(2);
        return entry;
    };

    const calculateSummaries = (productEntries) => {
        let totalLcTruck = 0;
        let totalLcQuantity = 0;

        productEntries.forEach(prod => {
            // Sum the truck numbers
            totalLcTruck += parseFloat(prod.truckNo) || 0;

            // Sum quantities from all brand entries
            prod.brandEntries.forEach(brandEntry => {
                totalLcQuantity += parseFloat(brandEntry.quantity) || 0;
            });
        });

        return { totalLcTruck, totalLcQuantity: totalLcQuantity.toFixed(2) };
    };

    const handleStockInputChange = (e, pIndex = null) => {
        const { name, value } = e.target;
        if (pIndex !== null) {
            const updatedProducts = [...stockFormData.productEntries];
            updatedProducts[pIndex] = { ...updatedProducts[pIndex], [name]: value };

            const summaries = calculateSummaries(updatedProducts);
            setStockFormData({
                ...stockFormData,
                productEntries: updatedProducts,
                ...summaries
            });
        } else {
            setStockFormData({ ...stockFormData, [name]: value });
        }
    };

    const handleProductModeToggle = (pIndex, isMulti) => {
        const updatedProducts = [...stockFormData.productEntries];
        updatedProducts[pIndex].isMultiBrand = isMulti;
        if (!isMulti && updatedProducts[pIndex].brandEntries.length > 1) {
            updatedProducts[pIndex].brandEntries = [updatedProducts[pIndex].brandEntries[0]];
        }

        const summaries = calculateSummaries(updatedProducts);
        setStockFormData({
            ...stockFormData,
            productEntries: updatedProducts,
            ...summaries
        });
    };

    const handleBrandEntryChange = (pIndex, bIndex, field, value) => {
        const updatedProducts = [...stockFormData.productEntries];
        const entry = { ...updatedProducts[pIndex].brandEntries[bIndex] };
        entry[field] = value;

        if (field === 'brand') {
            const product = products.find(p => p.name === updatedProducts[pIndex].productName);
            if (product && product.brands) {
                const brandData = product.brands.find(b => b.brand === value);
                if (brandData) {
                    entry.packetSize = brandData.packetSize || entry.packetSize;
                    entry.purchasedPrice = brandData.purchasedPrice || entry.purchasedPrice;
                    recalculateEntry(entry);
                }
            }
        }

        if (['packet', 'packetSize', 'sweepedPacket'].includes(field)) {
            recalculateEntry(entry);
        }

        if (field === 'sweepedQuantity') {
            const packet = parseFloat(entry.packet) || 0;
            const size = parseFloat(entry.packetSize) || 0;
            const sq = parseFloat(value) || 0;
            const sp = size > 0 ? (sq / size) : 0;

            entry.sweepedPacket = sp.toFixed(2);
            entry.inHousePacket = (packet - sp).toFixed(2);
            entry.inHouseQuantity = (packet * size - sq).toFixed(2);
        }

        updatedProducts[pIndex].brandEntries[bIndex] = entry;

        const summaries = calculateSummaries(updatedProducts);
        setStockFormData({
            ...stockFormData,
            productEntries: updatedProducts,
            ...summaries
        });
    };

    const addProductEntry = () => {
        const updatedProducts = [
            ...stockFormData.productEntries,
            {
                isMultiBrand: true,
                productName: '',
                truckNo: '',
                brandEntries: [{ brand: '', purchasedPrice: '', packet: '', packetSize: '', quantity: '', unit: 'kg', sweepedPacket: '', sweepedQuantity: '', inHousePacket: '', inHouseQuantity: '' }]
            }
        ];
        const summaries = calculateSummaries(updatedProducts);
        setStockFormData({
            ...stockFormData,
            productEntries: updatedProducts,
            ...summaries
        });
    };

    const removeProductEntry = (index) => {
        const updatedProducts = stockFormData.productEntries.filter((_, i) => i !== index);
        const summaries = calculateSummaries(updatedProducts);
        setStockFormData({
            ...stockFormData,
            productEntries: updatedProducts,
            ...summaries
        });
    };

    const addBrandEntry = (pIndex) => {
        const updatedProducts = [...stockFormData.productEntries];
        updatedProducts[pIndex].brandEntries.push({ brand: '', purchasedPrice: '', packet: '', packetSize: '', quantity: '', unit: 'kg', sweepedPacket: '', sweepedQuantity: '', inHousePacket: '', inHouseQuantity: '' });
        const summaries = calculateSummaries(updatedProducts);
        setStockFormData({
            ...stockFormData,
            productEntries: updatedProducts,
            ...summaries
        });
    };

    const removeBrandEntry = (pIndex, bIndex) => {
        const updatedProducts = [...stockFormData.productEntries];
        updatedProducts[pIndex].brandEntries = updatedProducts[pIndex].brandEntries.filter((_, i) => i !== bIndex);
        const summaries = calculateSummaries(updatedProducts);
        setStockFormData({
            ...stockFormData,
            productEntries: updatedProducts,
            ...summaries
        });
    };

    const handleStockDropdownSelect = (field, value) => {
        setStockFormData({ ...stockFormData, [field]: value });
        setActiveDropdown(null);
    };

    const handleProductSelect = (pIndex, productName) => {
        const updatedProducts = [...stockFormData.productEntries];
        updatedProducts[pIndex].productName = productName;
        const summaries = calculateSummaries(updatedProducts);
        setStockFormData({
            ...stockFormData,
            productEntries: updatedProducts,
            ...summaries
        });
        setActiveDropdown(null);
    };

    const handleDropdownKeyDown = (e, dropdownId, onSelect, fieldOrValue, options = []) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.min(prev + 1, options.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < options.length) {
                const selected = options[highlightedIndex];
                const value = typeof selected === 'object' ? (selected.name || selected.port || selected.brand) : selected;
                onSelect(fieldOrValue, value);
                setHighlightedIndex(-1);
            }
        } else if (e.key === 'Escape') {
            setActiveDropdown(null);
        }
    };

    const handleStockSubmit = async (e) => {
        e.preventDefault();
        setValidationErrors([]);

        // Detailed manual validation
        const errors = [];
        if (!stockFormData.lcNo) errors.push("LC Number is required");
        if (!stockFormData.port) errors.push("Port is required");
        if (!stockFormData.importer) errors.push("Importer is required");
        if (!stockFormData.warehouse) errors.push("Warehouse is required");

        stockFormData.productEntries.forEach((p, pIdx) => {
            const prodLabel = p.productName || `Product #${pIdx + 1}`;
            if (!p.productName) errors.push(`Product Name is required for entry #${pIdx + 1}`);

            p.brandEntries.forEach((b, bIdx) => {
                const brandLabel = b.brand || `Brand #${bIdx + 1}`;
                if (!b.brand) errors.push(`${prodLabel}: Brand is required for entry #${bIdx + 1}`);
                if (!b.packetSize) errors.push(`${prodLabel} (${brandLabel}): Size is required`);
                if (b.packet === '' || isNaN(parseFloat(b.packet))) errors.push(`${prodLabel} (${brandLabel}): Packet count is required`);
            });
        });

        if (errors.length > 0) {
            setValidationErrors(errors);
            setSubmitStatus('error');
            setTimeout(() => setSubmitStatus(null), 5000);
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            if (editingId) {
                const originalIds = stockFormData.originalIds || [editingId];
                const validIds = new Set();
                const promises = [];

                for (let i = 0; i < stockFormData.productEntries.length; i++) {
                    const product = stockFormData.productEntries[i];
                    for (let j = 0; j < product.brandEntries.length; j++) {
                        const brandEntry = product.brandEntries[j];

                        const recordData = {
                            date: stockFormData.date,
                            lcNo: stockFormData.lcNo,
                            port: stockFormData.port,
                            importer: stockFormData.importer,
                            exporter: stockFormData.exporter,
                            indianCnF: stockFormData.indianCnF,
                            indCnFCost: stockFormData.indCnFCost,
                            bdCnF: stockFormData.bdCnF,
                            bdCnFCost: stockFormData.bdCnFCost,
                            billOfEntry: stockFormData.billOfEntry,
                            totalLcTruck: stockFormData.totalLcTruck,
                            totalLcQuantity: stockFormData.totalLcQuantity,
                            status: stockFormData.status,
                            warehouse: stockFormData.warehouse,
                            productName: product.productName,
                            truckNo: product.truckNo,
                            brand: brandEntry.brand,
                            purchasedPrice: brandEntry.purchasedPrice,
                            packet: brandEntry.packet,
                            packetSize: brandEntry.packetSize,
                            quantity: brandEntry.quantity,
                            unit: brandEntry.unit,
                            sweepedPacket: brandEntry.sweepedPacket,
                            sweepedQuantity: brandEntry.sweepedQuantity,
                            inHousePacket: brandEntry.inHousePacket,
                            inHouseQuantity: brandEntry.inHouseQuantity,
                        };

                        const encryptedData = encryptData(recordData);

                        if (brandEntry._id) {
                            validIds.add(brandEntry._id);
                            promises.push(axios.put(`${API_BASE_URL}/api/stock/${brandEntry._id}`, { data: encryptedData }));
                        } else {
                            promises.push(axios.post(`${API_BASE_URL}/api/stock`, { data: encryptedData }));
                        }
                    }
                }

                const idsToDelete = originalIds.filter(id => !validIds.has(id));
                idsToDelete.forEach(id => {
                    promises.push(axios.delete(`${API_BASE_URL}/api/stock/${id}`));
                });

                await Promise.all(promises);

            } else {
                const newRecords = [];
                stockFormData.productEntries.forEach(product => {
                    product.brandEntries.forEach(brandEntry => {
                        newRecords.push({
                            date: stockFormData.date,
                            lcNo: stockFormData.lcNo,
                            port: stockFormData.port,
                            importer: stockFormData.importer,
                            exporter: stockFormData.exporter,
                            indianCnF: stockFormData.indianCnF,
                            indCnFCost: stockFormData.indCnFCost,
                            bdCnF: stockFormData.bdCnF,
                            bdCnFCost: stockFormData.bdCnFCost,
                            billOfEntry: stockFormData.billOfEntry,
                            totalLcTruck: stockFormData.totalLcTruck,
                            totalLcQuantity: stockFormData.totalLcQuantity,
                            status: stockFormData.status,
                            warehouse: stockFormData.warehouse,
                            productName: product.productName,
                            truckNo: product.truckNo,
                            brand: brandEntry.brand,
                            purchasedPrice: brandEntry.purchasedPrice,
                            packet: brandEntry.packet,
                            packetSize: brandEntry.packetSize,
                            quantity: brandEntry.quantity,
                            unit: brandEntry.unit,
                            sweepedPacket: brandEntry.sweepedPacket,
                            sweepedQuantity: brandEntry.sweepedQuantity,
                            inHousePacket: brandEntry.inHousePacket,
                            inHouseQuantity: brandEntry.inHouseQuantity
                        });
                    });
                });

                const createPromises = newRecords.map(record =>
                    axios.post(`${API_BASE_URL}/api/stock`, { data: encryptData(record) })
                );

                await Promise.all(createPromises);
            }

            setSubmitStatus('success');
            setTimeout(() => {
                resetStockForm();
                setShowStockForm(false);
                setSubmitStatus(null);
                if (fetchStockRecords) fetchStockRecords();
                fetchWarehouses(); // Refresh warehouse stock display immediately
            }, 1500);

        } catch (error) {
            console.error("Error submitting stock:", error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditInternal = (type, record) => {
        setEditingId(record._id || record.originalId);

        const isGrouped = record.entries && Array.isArray(record.entries);

        if (isGrouped) {
            const formProductEntry = {
                isMultiBrand: record.entries.length > 1,
                productName: record.productName,
                truckNo: record.entries[0].truckNo || '',
                brandEntries: record.entries.map(e => ({
                    _id: e._id,
                    brand: e.brand,
                    purchasedPrice: e.purchasedPrice,
                    packet: e.packet,
                    packetSize: e.packetSize,
                    quantity: e.quantity,
                    unit: e.unit,
                    sweepedPacket: e.sweepedPacket,
                    sweepedQuantity: e.sweepedQuantity,
                    inHousePacket: e.inHousePacket,
                    inHouseQuantity: e.inHouseQuantity
                }))
            };

            setStockFormData({
                date: record.date || new Date().toISOString().split('T')[0],
                lcNo: record.lcNo,
                port: record.port,
                importer: record.importer,
                exporter: record.exporter,
                indianCnF: record.indianCnF,
                indCnFCost: record.indCnFCost,
                bdCnF: record.bdCnF,
                bdCnFCost: record.bdCnFCost,
                billOfEntry: record.billOfEntry,
                totalLcTruck: record.totalLcTruck,
                totalLcQuantity: record.totalLcQuantity,
                status: record.status,
                productEntries: [formProductEntry],
                originalIds: record.allIds
            });

        } else {
            setStockFormData({
                date: record.date || new Date().toISOString().split('T')[0],
                lcNo: record.lcNo,
                port: record.port,
                importer: record.importer,
                exporter: record.exporter,
                indianCnF: record.indianCnF,
                indCnFCost: record.indCnFCost,
                bdCnF: record.bdCnF,
                bdCnFCost: record.bdCnFCost,
                billOfEntry: record.billOfEntry,
                totalLcTruck: record.totalLcTruck,
                totalLcQuantity: record.totalLcQuantity,
                status: record.status,
                productEntries: [{
                    isMultiBrand: false,
                    productName: record.productName,
                    truckNo: record.truckNo,
                    brandEntries: [{
                        _id: record._id,
                        brand: record.brand,
                        purchasedPrice: record.purchasedPrice,
                        packet: record.packet,
                        packetSize: record.packetSize,
                        quantity: record.quantity,
                        unit: record.unit,
                        sweepedPacket: record.sweepedPacket,
                        sweepedQuantity: record.sweepedQuantity,
                        inHousePacket: record.inHousePacket,
                        inHouseQuantity: record.inHouseQuantity
                    }]
                }]
            });
        }
        setShowStockForm(true);
    };

    const getFilteredProducts = (input) => {
        if (!input) return products;
        return products.filter(p => p.name.toLowerCase().includes(input.toLowerCase()));
    };

    const getFilteredBrands = (input, productName) => {
        // No product selected → no brands to show
        if (!productName) return [];

        const allBrands = new Set();

        // 1. Get brands defined in the product definition
        if (products) {
            const product = products.find(p => p.name === productName);
            if (product && product.brands) {
                product.brands.forEach(b => {
                    if (b.brand) allBrands.add(b.brand);
                });
            } else if (product && product.brand) {
                allBrands.add(product.brand);
            }
        }

        // 2. Get brands from existing stock records for this product only
        stockRecords.forEach(r => {
            if (r.productName === productName && r.brand) allBrands.add(r.brand);
        });

        const brandsArr = Array.from(allBrands).sort();
        if (!input) return brandsArr;
        return brandsArr.filter(b => b.toLowerCase().includes(input.toLowerCase()));
    };

    const [showLcFilterPanel, setShowLcFilterPanel] = useState(false);

    const initialLcFilterState = {
        startDate: '',
        endDate: '',
        lcNo: '',
        port: '',
        indCnf: '',
        bdCnf: '',
        billOfEntry: '',
        productName: '',
        brand: ''
    };

    const [filterSearchInputs, setFilterSearchInputs] = useState({
        lcNoSearch: '',
        portSearch: '',
        brandSearch: '',
        productSearch: '',
        indCnfSearch: '',
        bdCnfSearch: '',
        billOfEntrySearch: ''
    });

    const initialFilterDropdownState = {
        lcNo: false,
        port: false,
        brand: false,
        product: false,
        indCnf: false,
        bdCnf: false,
        billOfEntry: false
    };

    const [filterDropdownOpen, setFilterDropdownOpen] = useState(initialFilterDropdownState);

    // Refs for filters - using Refs to manage focus/click outside if needed, 
    // though for now simple state might suffice. Kept for consistency.
    // Refs for filters
    const lcFilterPanelRef = useRef(null);
    const lcFilterButtonRef = useRef(null);

    const lcNoFilterRef = useRef(null);
    const portFilterRef = useRef(null);
    const indCnfFilterRef = useRef(null);
    const bdCnfFilterRef = useRef(null);
    const billOfEntryFilterRef = useRef(null);
    const productFilterRef = useRef(null);
    const brandFilterRef = useRef(null);

    // Click-outside detection for LC filter panel
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                showLcFilterPanel &&
                lcFilterPanelRef.current &&
                !lcFilterPanelRef.current.contains(event.target) &&
                lcFilterButtonRef.current &&
                !lcFilterButtonRef.current.contains(event.target)
            ) {
                setShowLcFilterPanel(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showLcFilterPanel]);

    // Click-outside detection for filter dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Find which filter is currently open
            const openKey = Object.keys(filterDropdownOpen).find(key => filterDropdownOpen[key]);
            if (!openKey) return;

            // Map open keys to their corresponding DOM containers (refs)
            let refsToCheck = [];
            if (openKey === 'lcNo') {
                refsToCheck = [lcNoFilterRef];
            } else if (openKey === 'port') {
                refsToCheck = [portFilterRef];
            } else if (openKey === 'brand') {
                refsToCheck = [brandFilterRef];
            } else if (openKey === 'product') {
                refsToCheck = [productFilterRef];
            } else if (openKey === 'indCnf') {
                refsToCheck = [indCnfFilterRef];
            } else if (openKey === 'bdCnf') {
                refsToCheck = [bdCnfFilterRef];
            } else if (openKey === 'billOfEntry') {
                refsToCheck = [billOfEntryFilterRef];
            }

            // If click is outside all associated refs for the open dropdown, close it
            const isOutside = refsToCheck.every(ref => !ref.current || !ref.current.contains(event.target));
            if (isOutside) {
                setFilterDropdownOpen(initialFilterDropdownState);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [filterDropdownOpen, showLcFilterPanel]);

    // Click-outside detection for form's activeDropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!activeDropdown) return;

            // Define refs for all possible searchable dropdowns in the form
            const refs = [
                portRef,
                importerRef,
                ...Object.values(productRefs.current).map(r => ({ current: r })),
                ...Object.values(brandRefs.current).map(r => ({ current: r }))
            ];

            const isOutside = refs.every(ref => !ref.current || !ref.current.contains(event.target));
            if (isOutside) {
                setActiveDropdown(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown]);

    // Handlers for dropdown filtering
    const getFilteredOptions = (type) => {
        let options = [];
        let search = '';

        switch (type) {
            case 'lcFilterLcNo':
                options = [...new Set(stockRecords.map(r => (r.lcNo || '').trim()).filter(Boolean))].sort();
                search = filterSearchInputs.lcNoSearch;
                break;
            case 'lcFilterPort':
                options = [...new Set(stockRecords.map(r => (r.port || '').trim()).filter(Boolean))].sort();
                search = filterSearchInputs.portSearch;
                break;
            case 'lcFilterIndCnf':
                options = [...new Set(stockRecords.map(r => (r.indianCnF || '').trim()).filter(Boolean))].sort();
                search = filterSearchInputs.indCnfSearch;
                break;
            case 'lcFilterBdCnf':
                options = [...new Set(stockRecords.map(r => (r.bdCnF || '').trim()).filter(Boolean))].sort();
                search = filterSearchInputs.bdCnfSearch;
                break;
            case 'lcFilterBillOfEntry':
                options = [...new Set(stockRecords.map(r => (r.billOfEntry || '').trim()).filter(Boolean))].sort();
                search = filterSearchInputs.billOfEntrySearch;
                break;
            default:
                return [];
        }

        return options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
    };

    const toggleSelection = (id) => {
        const newSelection = new Set(selectedItems);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedItems(newSelection);
        if (newSelection.size === 0) {
            setIsSelectionMode(false);
        }
    };

    return (
        <div className="space-y-6">
            {!showStockForm && (
                <div className="flex items-center justify-between gap-4">
                    <div className="w-1/4">
                        <h2 className="text-2xl font-bold text-gray-800">LC Receive Management</h2>
                    </div>

                    {/* Center Aligned Search Bar */}
                    <div className="flex-1 max-w-md mx-auto relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by LC, Port, Importer, Truck..."
                            value={lcSearchQuery}
                            onChange={(e) => setLcSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                        />
                    </div>

                    <div className="w-1/4 flex justify-end items-center gap-2">
                        <div className="relative">
                            <button
                                ref={lcFilterButtonRef}
                                onClick={() => setShowLcFilterPanel(!showLcFilterPanel)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${showLcFilterPanel || Object.values(lcFilters).some(v => v !== '') ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                <FunnelIcon className={`w-4 h-4 ${(showLcFilterPanel || (lcFilters && Object.values(lcFilters).some(v => v !== ''))) ? 'text-white' : 'text-gray-400'}`} />
                                <span className="text-sm font-medium">Filter</span>
                            </button>

                            {/* Floating Filter Panel */}
                            {showLcFilterPanel && lcFilters && (
                                <div ref={lcFilterPanelRef} className="absolute right-0 mt-3 w-[450px] bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[60] p-6 animate-in fade-in zoom-in duration-200">
                                    <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-50">
                                        <h4 className="font-extrabold text-gray-900 text-lg">Advance Filter</h4>
                                        <button
                                            onClick={() => {
                                                if (setLcFilters) setLcFilters(initialLcFilterState);
                                                setFilterSearchInputs({
                                                    lcNoSearch: '',
                                                    portSearch: '',
                                                    brandSearch: '',
                                                    productSearch: '',
                                                    indCnfSearch: '',
                                                    bdCnfSearch: '',
                                                    billOfEntrySearch: ''
                                                });
                                                if (setLcSearchQuery) setLcSearchQuery('');
                                                setShowLcFilterPanel(false);
                                            }}
                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest"
                                        >
                                            RESET ALL
                                        </button>
                                    </div>

                                    <div className="space-y-5">
                                        {/* Date Range Row */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <CustomDatePicker
                                                label="From Date"
                                                value={lcFilters.startDate}
                                                onChange={(e) => setLcFilters({ ...lcFilters, startDate: e.target.value })}
                                                compact={true}
                                            />
                                            <CustomDatePicker
                                                label="To Date"
                                                value={lcFilters.endDate}
                                                onChange={(e) => setLcFilters({ ...lcFilters, endDate: e.target.value })}
                                                compact={true}
                                                rightAlign={true}
                                            />
                                        </div>

                                        {/* LC and Port Row */}
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* LC No Filter */}
                                            <div className="space-y-1.5 relative" ref={lcNoFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">LC NO</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.lcNoSearch}
                                                        onChange={(e) => {
                                                            setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: e.target.value });
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, lcNo: true });
                                                        }}
                                                        onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, lcNo: true })}
                                                        placeholder={lcFilters.lcNo || "Search LC..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${lcFilters.lcNo ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {lcFilters.lcNo && (
                                                            <button onClick={() => { setLcFilters({ ...lcFilters, lcNo: '' }); setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.lcNo && (() => {
                                                    const filtered = getFilteredOptions('lcFilterLcNo') || [];
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(opt => (
                                                                <button key={opt} type="button" onClick={() => { setLcFilters({ ...lcFilters, lcNo: opt }); setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors uppercase font-medium">{opt}</button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>

                                            {/* Port Filter */}
                                            <div className="space-y-1.5 relative" ref={portFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">PORT</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.portSearch}
                                                        onChange={(e) => {
                                                            setFilterSearchInputs({ ...filterSearchInputs, portSearch: e.target.value });
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, port: true });
                                                        }}
                                                        onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, port: true })}
                                                        placeholder={lcFilters.port || "Search Port..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${lcFilters.port ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {lcFilters.port && (
                                                            <button onClick={() => { setLcFilters({ ...lcFilters, port: '' }); setFilterSearchInputs({ ...filterSearchInputs, portSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.port && (() => {
                                                    const filtered = getFilteredOptions('lcFilterPort') || [];
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(opt => (
                                                                <button key={opt} type="button" onClick={() => { setLcFilters({ ...lcFilters, port: opt }); setFilterSearchInputs({ ...filterSearchInputs, portSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors uppercase font-medium">{opt}</button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>
                                        </div>

                                        {/* Product and Brand Row */}
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Product Filter */}
                                            <div className="space-y-1.5 relative" ref={productFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">PRODUCT</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.productSearch}
                                                        onChange={(e) => {
                                                            setFilterSearchInputs({ ...filterSearchInputs, productSearch: e.target.value });
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, product: true });
                                                        }}
                                                        onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, product: true })}
                                                        placeholder={lcFilters.productName || "Search Product..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${lcFilters.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {lcFilters.productName && (
                                                            <button onClick={() => { setLcFilters({ ...lcFilters, productName: '' }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.product && (() => {
                                                    const options = stockRecords ? [...new Set(stockRecords.map(item => (item.productName || '').trim()).filter(Boolean))].sort() : [];
                                                    const filtered = options.filter(o => o.toLowerCase().includes((filterSearchInputs.productSearch || '').toLowerCase()));
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(o => (
                                                                <button key={o} type="button" onClick={() => { setLcFilters({ ...lcFilters, productName: o }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors uppercase font-medium">{o}</button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>

                                            {/* Brand Filter */}
                                            <div className="space-y-1.5 relative" ref={brandFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">BRAND</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.brandSearch}
                                                        onChange={(e) => {
                                                            setFilterSearchInputs({ ...filterSearchInputs, brandSearch: e.target.value });
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true });
                                                        }}
                                                        onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true })}
                                                        placeholder={lcFilters.brand || "Search Brand..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${lcFilters.brand ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {lcFilters.brand && (
                                                            <button onClick={() => { setLcFilters({ ...lcFilters, brand: '' }); setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.brand && (() => {
                                                    if (!stockRecords) return null;
                                                    const productFilteredRecords = lcFilters.productName
                                                        ? stockRecords.filter(item => (item.productName || '').trim().toLowerCase() === lcFilters.productName.toLowerCase())
                                                        : stockRecords;
                                                    const options = [...new Set(productFilteredRecords.flatMap(item => {
                                                        if (item.brand) return [(item.brand || '').trim()];
                                                        return (item.brandEntries || []).map(e => (e.brand || '').trim());
                                                    }).filter(Boolean))].sort();
                                                    const filtered = options.filter(o => o.toLowerCase().includes((filterSearchInputs.brandSearch || '').toLowerCase()));
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(o => (
                                                                <button key={o} type="button" onClick={() => { setLcFilters({ ...lcFilters, brand: o }); setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors uppercase font-medium">{o}</button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>
                                        </div>

                                        {/* CNF Row */}
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* IND CNF Filter */}
                                            <div className="space-y-1.5 relative" ref={indCnfFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">IND CNF</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.indCnfSearch}
                                                        onChange={(e) => {
                                                            setFilterSearchInputs({ ...filterSearchInputs, indCnfSearch: e.target.value });
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, indCnf: true });
                                                        }}
                                                        onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, indCnf: true })}
                                                        placeholder={lcFilters.indCnf || "Search..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${lcFilters.indCnf ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {lcFilters.indCnf && (
                                                            <button onClick={() => { setLcFilters({ ...lcFilters, indCnf: '' }); setFilterSearchInputs({ ...filterSearchInputs, indCnfSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.indCnf && (() => {
                                                    const filtered = getFilteredOptions('lcFilterIndCnf');
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(opt => (
                                                                <button key={opt} onClick={() => { setLcFilters({ ...lcFilters, indCnf: opt }); setFilterSearchInputs({ ...filterSearchInputs, indCnfSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors">{opt}</button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>

                                            {/* BD CNF Filter */}
                                            <div className="space-y-1.5 relative" ref={bdCnfFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">BD CNF</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.bdCnfSearch}
                                                        onChange={(e) => {
                                                            setFilterSearchInputs({ ...filterSearchInputs, bdCnfSearch: e.target.value });
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, bdCnf: true });
                                                        }}
                                                        onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, bdCnf: true })}
                                                        placeholder={lcFilters.bdCnf || "Search..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${lcFilters.bdCnf ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {lcFilters.bdCnf && (
                                                            <button onClick={() => { setLcFilters({ ...lcFilters, bdCnf: '' }); setFilterSearchInputs({ ...filterSearchInputs, bdCnfSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.bdCnf && (() => {
                                                    const filtered = getFilteredOptions('lcFilterBdCnf');
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(opt => (
                                                                <button key={opt} onClick={() => { setLcFilters({ ...lcFilters, bdCnf: opt }); setFilterSearchInputs({ ...filterSearchInputs, bdCnfSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors">{opt}</button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>
                                        </div>

                                        {/* Bill Of Entry Full Row */}
                                        <div className="space-y-1.5 relative" ref={billOfEntryFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">BILL OF ENTRY</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.billOfEntrySearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, billOfEntrySearch: e.target.value });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, billOfEntry: true });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, billOfEntry: true })}
                                                    placeholder={lcFilters.billOfEntry || "Search Bill Of Entry..."}
                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${lcFilters.billOfEntry ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {lcFilters.billOfEntry && (
                                                        <button onClick={() => { setLcFilters({ ...lcFilters, billOfEntry: '' }); setFilterSearchInputs({ ...filterSearchInputs, billOfEntrySearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.billOfEntry && (() => {
                                                const filtered = getFilteredOptions('lcFilterBillOfEntry');
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                        {filtered.map(opt => (
                                                            <button key={opt} onClick={() => { setLcFilters({ ...lcFilters, billOfEntry: opt }); setFilterSearchInputs({ ...filterSearchInputs, billOfEntrySearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors">{opt}</button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        <button
                                            onClick={() => setShowLcFilterPanel(false)}
                                            className="w-full py-3 bg-[#0f172a] text-white rounded-xl text-sm font-bold shadow-xl shadow-gray-200/50 hover:bg-[#1e293b] active:scale-[0.98] transition-all mt-4"
                                        >
                                            Apply Filters
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setShowLcReport(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95"
                        >
                            <BarChartIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium">Report</span>
                        </button>
                        <button
                            onClick={() => setShowStockForm(!showStockForm)}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center"
                        >
                            <span className="mr-2 text-xl font-light">+</span> Add New
                        </button>
                    </div>
                </div >
            )
            }

            {/* Summary Cards */}
            {
                !showStockForm && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm transition-all hover:shadow-md">
                            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Packet</div>
                            <div className="text-xl font-bold text-gray-900">{lcReceiveSummary.totalPackets}</div>
                        </div>
                        <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl shadow-sm transition-all hover:shadow-md">
                            <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Total Quantity</div>
                            <div className="text-xl font-bold text-emerald-700">{Math.round(lcReceiveSummary.totalQuantity)} {lcReceiveSummary.unit}</div>
                        </div>
                        <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl shadow-sm transition-all hover:shadow-md">
                            <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">Truck</div>
                            <div className="text-xl font-bold text-blue-700">{lcReceiveSummary.totalTrucks}</div>
                        </div>
                    </div>
                )
            }

            {/* Form Section */}
            {
                showStockForm && (
                    <div className="relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl p-8 transition-all duration-300">
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none"></div>

                        <div className="flex items-center justify-between mb-6 border-b border-gray-200/50 pb-4 relative z-10">
                            <h3 className="text-xl font-semibold text-gray-800">{editingId ? 'Edit LC Receive' : 'New LC Receive'}</h3>
                            <button onClick={() => { setShowStockForm(false); resetStockForm(); }} className="text-gray-400 hover:text-red-500 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <form onSubmit={handleStockSubmit} autoComplete="off" className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                            {/* Form Fields - Reusing logic by passing handlers */}
                            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-5 gap-6">
                                <CustomDatePicker
                                    label="Date"
                                    name="date"
                                    value={stockFormData.date}
                                    onChange={handleStockInputChange}
                                    required
                                    compact={true}
                                />
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">LC No</label>
                                    <input
                                        type="text" name="lcNo" value={stockFormData.lcNo} onChange={handleStockInputChange} required
                                        placeholder="LC Number" autoComplete="off" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                                    />
                                </div>
                                <div className="space-y-2 relative" ref={portRef}>
                                    <label className="text-sm font-medium text-gray-700">Port</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="port"
                                            value={stockFormData.port}
                                            onChange={(e) => { handleStockInputChange(e); setActiveDropdown('lcr-port'); setHighlightedIndex(-1); }}
                                            onFocus={() => { setActiveDropdown('lcr-port'); setHighlightedIndex(-1); }}
                                            onKeyDown={(e) => handleDropdownKeyDown(e, 'lcr-port', handleStockDropdownSelect, 'port', ports.filter(p => p.status === 'Active' && (!stockFormData.port || ports.some(x => x.name === stockFormData.port) || p.name.toLowerCase().includes(stockFormData.port.toLowerCase()))))}
                                            placeholder="Search port..."
                                            autoComplete="off"
                                            className={`w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-14 ${stockFormData.port ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {stockFormData.port && (
                                                <button type="button" onClick={() => handleStockDropdownSelect('port', '')} className="text-gray-400 hover:text-gray-600">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                        </div>
                                    </div>
                                    {activeDropdown === 'lcr-port' && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                            {ports.filter(p => p.status === 'Active' && (!stockFormData.port || ports.some(x => x.name === stockFormData.port) || p.name.toLowerCase().includes(stockFormData.port.toLowerCase()))).map((port, idx) => (
                                                <button
                                                    key={port._id}
                                                    type="button"
                                                    onClick={() => handleStockDropdownSelect('port', port.name)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${stockFormData.port === port.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {port.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2 relative" ref={importerRef}>
                                    <label className="text-sm font-medium text-gray-700">Importer</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="importer"
                                            value={stockFormData.importer}
                                            onChange={(e) => { handleStockInputChange(e); setActiveDropdown('lcr-importer'); setHighlightedIndex(-1); }}
                                            onFocus={() => { setActiveDropdown('lcr-importer'); setHighlightedIndex(-1); }}
                                            onKeyDown={(e) => handleDropdownKeyDown(e, 'lcr-importer', handleStockDropdownSelect, 'importer', importers.filter(imp => imp.status === 'Active' && (!stockFormData.importer || importers.some(x => x.name === stockFormData.importer) || imp.name.toLowerCase().includes(stockFormData.importer.toLowerCase()))))}
                                            placeholder="Search importer..."
                                            autoComplete="off"
                                            className={`w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-14 ${stockFormData.importer ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {stockFormData.importer && (
                                                <button type="button" onClick={() => handleStockDropdownSelect('importer', '')} className="text-gray-400 hover:text-gray-600">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                        </div>
                                    </div>
                                    {activeDropdown === 'lcr-importer' && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                            {importers.filter(imp => imp.status === 'Active' && (!stockFormData.importer || importers.some(x => x.name === stockFormData.importer) || imp.name.toLowerCase().includes(stockFormData.importer.toLowerCase()))).map((imp, idx) => (
                                                <button
                                                    key={imp._id}
                                                    type="button"
                                                    onClick={() => handleStockDropdownSelect('importer', imp.name)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${stockFormData.importer === imp.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {imp.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2 relative" ref={exporterRef}>
                                    <label className="text-sm font-medium text-gray-700">Exporter</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="exporter"
                                            value={stockFormData.exporter}
                                            onChange={(e) => { handleStockInputChange(e); setActiveDropdown('lcr-exporter'); setHighlightedIndex(-1); }}
                                            onFocus={() => { setActiveDropdown('lcr-exporter'); setHighlightedIndex(-1); }}
                                            placeholder="Search exporter..."
                                            autoComplete="off"
                                            className={`w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-14 ${stockFormData.exporter ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {stockFormData.exporter && (
                                                <button type="button" onClick={() => handleStockDropdownSelect('exporter', '')} className="text-gray-400 hover:text-gray-600">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-5 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">IND CNF</label>
                                    <input
                                        type="text" name="indianCnF" value={stockFormData.indianCnF} onChange={handleStockInputChange}
                                        placeholder="IND CNF" autoComplete="off" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">IND CNF Cost</label>
                                    <input
                                        type="number" name="indCnFCost" value={stockFormData.indCnFCost} onChange={handleStockInputChange}
                                        placeholder="0.00" autoComplete="off" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">BD CNF</label>
                                    <input
                                        type="text" name="bdCnF" value={stockFormData.bdCnF} onChange={handleStockInputChange}
                                        placeholder="BD CNF" autoComplete="off" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">BD CNF Cost</label>
                                    <input
                                        type="number" name="bdCnFCost" value={stockFormData.bdCnFCost} onChange={handleStockInputChange}
                                        placeholder="0.00" autoComplete="off" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Bill Of Entry</label>
                                    <input
                                        type="text" name="billOfEntry" value={stockFormData.billOfEntry} onChange={handleStockInputChange}
                                        placeholder="Bill Of Entry" autoComplete="off" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                                    />
                                </div>
                            </div>

                            {/* Total LC Truck/Quantity Row */}
                            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Total LC Truck</label>
                                    <input
                                        type="text"
                                        name="totalLcTruck"
                                        value={stockFormData.totalLcTruck || '0'}
                                        readOnly
                                        placeholder="Total LC Truck"
                                        autoComplete="off"
                                        className="w-full px-4 py-2 bg-gray-50/80 border border-gray-200/60 rounded-lg text-gray-600 font-semibold outline-none cursor-default backdrop-blur-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Total LC Quantity</label>
                                    <input
                                        type="text"
                                        name="totalLcQuantity"
                                        value={stockFormData.totalLcQuantity || '0.00'}
                                        readOnly
                                        placeholder="Total LC Quantity"
                                        autoComplete="off"
                                        className="w-full px-4 py-2 bg-gray-50/80 border border-gray-200/60 rounded-lg text-gray-600 font-semibold outline-none cursor-default backdrop-blur-sm"
                                    />
                                </div>
                            </div>

                            {/* Product Entries Section */}
                            <div className="col-span-1 md:col-span-2 space-y-8 animate-in fade-in duration-500">
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
                                        <div key={pIndex} className="relative p-6 rounded-2xl bg-gray-50/30 border border-gray-100 group/product hover:border-blue-200 hover:bg-white/80 transition-all duration-500">
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

                                            <div className="space-y-6">
                                                {/* Product Info - Single Brand Mode */}
                                                {!product.isMultiBrand && (
                                                    <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-4 items-end animate-in fade-in duration-300">
                                                        <div className="md:col-span-2 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700 text-center block w-full">Mode</label>
                                                            <div className="h-[42px] flex items-center gap-1 p-1 bg-gray-100/50 rounded-lg w-full">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleProductModeToggle(pIndex, false)}
                                                                    className={`flex-1 h-full text-[10px] font-bold rounded flex items-center justify-center transition-all ${!product.isMultiBrand ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                                >
                                                                    SINGLE
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleProductModeToggle(pIndex, true)}
                                                                    className={`flex-1 h-full text-[10px] font-bold rounded flex items-center justify-center transition-all ${product.isMultiBrand ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                                >
                                                                    MULTI
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="md:col-span-3 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700">Product Name</label>
                                                            <div className="relative w-full" ref={el => productRefs.current[pIndex] = el}>
                                                                <input
                                                                    type="text"
                                                                    name="productName"
                                                                    value={product.productName}
                                                                    onChange={(e) => {
                                                                        handleStockInputChange(e, pIndex);
                                                                        setActiveDropdown(`lcr-product-${pIndex}`);
                                                                        setHighlightedIndex(-1);
                                                                    }}
                                                                    onFocus={() => {
                                                                        setActiveDropdown(`lcr-product-${pIndex}`);
                                                                        setHighlightedIndex(-1);
                                                                    }}
                                                                    onKeyDown={(e) => handleDropdownKeyDown(e, `lcr-product-${pIndex}`, (field, val) => handleProductSelect(pIndex, val), 'name', getFilteredProducts(product.productName))}
                                                                    placeholder="Search product..."
                                                                    autoComplete="off"
                                                                    className={`w-full h-[42px] px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-sm pr-14 ${product.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                                                />
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                    {product.productName && (
                                                                        <button type="button" onClick={() => handleProductSelect(pIndex, '')} className="text-gray-400 hover:text-gray-600">
                                                                            <XIcon className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                                {activeDropdown === `lcr-product-${pIndex}` && (
                                                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        {getFilteredProducts(product.productName).map((p, idx) => (
                                                                            <button
                                                                                key={p._id}
                                                                                type="button"
                                                                                onClick={() => handleProductSelect(pIndex, p.name)}
                                                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                                                className={`w-full text-left px-4 py-2 text-sm transition-colors font-medium ${product.productName === p.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                            >
                                                                                {p.name}
                                                                            </button>
                                                                        ))}
                                                                        {getFilteredProducts(product.productName).length === 0 && (
                                                                            <div className="px-4 py-3 text-sm text-gray-500 italic">No products found</div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="md:col-span-2 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700">Brand</label>
                                                            <div className="relative w-full" ref={el => brandRefs.current[`${pIndex}-0`] = el}>
                                                                <input
                                                                    type="text"
                                                                    value={product.brandEntries[0].brand}
                                                                    placeholder="Search brand..."
                                                                    onChange={(e) => { handleBrandEntryChange(pIndex, 0, 'brand', e.target.value); setActiveDropdown(`lcr-brand-${pIndex}-0`); setHighlightedIndex(-1); }}
                                                                    onFocus={() => {
                                                                        setActiveDropdown(`lcr-brand-${pIndex}-0`);
                                                                        setHighlightedIndex(-1);
                                                                    }}
                                                                    onKeyDown={(e) => handleDropdownKeyDown(e, `lcr-brand-${pIndex}-0`, (field, val) => { handleBrandEntryChange(pIndex, 0, 'brand', val); setActiveDropdown(null); }, 'brand', getFilteredBrands(product.brandEntries[0].brand, product.productName))}
                                                                    className={`w-full h-[42px] px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-sm pr-14 ${product.brandEntries[0].brand ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                                                />
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                    {product.brandEntries[0].brand && (
                                                                        <button type="button" onClick={() => { handleBrandEntryChange(pIndex, 0, 'brand', ''); setActiveDropdown(null); }} className="text-gray-400 hover:text-gray-600">
                                                                            <XIcon className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                                {activeDropdown === `lcr-brand-${pIndex}-0` && (
                                                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-48 overflow-y-auto py-1">
                                                                        {getFilteredBrands(product.brandEntries[0].brand, product.productName).map((brand, idx) => (
                                                                            <button
                                                                                key={idx}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    handleBrandEntryChange(pIndex, 0, 'brand', brand);
                                                                                    setActiveDropdown(null);
                                                                                }}
                                                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                                                className={`w-full text-left px-4 py-2 text-sm transition-colors font-medium ${product.brandEntries[0].brand === brand ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                            >
                                                                                {brand}
                                                                            </button>
                                                                        ))}
                                                                        {getFilteredBrands(product.brandEntries[0].brand, product.productName).length === 0 && (
                                                                            <div className="px-3 py-2 text-sm text-gray-500 italic">
                                                                                {!product.productName ? 'Please select a product first' : 'Type to add new brand'}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="md:col-span-2 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700">Truck No.</label>
                                                            <input
                                                                type="text" name="truckNo" value={product.truckNo} onChange={(e) => handleStockInputChange(e, pIndex)}
                                                                placeholder="Truck #" autoComplete="off" className="w-full h-[42px] px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-sm"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-1 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700">Swp. Pkt</label>
                                                            <input
                                                                type="text"
                                                                value={product.brandEntries[0].sweepedPacket}
                                                                onChange={(e) => handleBrandEntryChange(pIndex, 0, 'sweepedPacket', e.target.value)}
                                                                placeholder="Qty" autoComplete="off" className="w-full h-[42px] px-2 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-sm"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-1 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700">SwpQty</label>
                                                            <input
                                                                type="text"
                                                                value={product.brandEntries[0].sweepedQuantity}
                                                                onChange={(e) => handleBrandEntryChange(pIndex, 0, 'sweepedQuantity', e.target.value)}
                                                                placeholder="Qty" className="w-full h-[42px] px-2 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-sm"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-1 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700">InHouse Pkt</label>
                                                            <input
                                                                type="text"
                                                                value={product.brandEntries[0].inHousePacket}
                                                                readOnly
                                                                placeholder="Qty" autoComplete="off" className="w-full h-[42px] px-4 py-2 bg-gray-50/80 border border-gray-200/60 rounded-lg text-gray-600 font-medium outline-none cursor-default backdrop-blur-sm text-sm"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-1 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700">InHouse Qty</label>
                                                            <input
                                                                type="text"
                                                                value={product.brandEntries[0].inHouseQuantity}
                                                                readOnly
                                                                placeholder="Qty" className="w-full h-[42px] px-4 py-2 bg-gray-50/80 border border-gray-200/60 rounded-lg text-gray-600 font-medium outline-none cursor-default backdrop-blur-sm text-sm"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-1 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700 text-center block w-full">Packet</label>
                                                            <input
                                                                type="text"
                                                                value={product.brandEntries[0].packet}
                                                                onChange={(e) => handleBrandEntryChange(pIndex, 0, 'packet', e.target.value)}
                                                                placeholder="Qty" autoComplete="off" className="w-full h-[42px] px-2 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-sm text-center"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-1 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700 text-center block w-full">Size</label>
                                                            <input
                                                                type="text"
                                                                value={product.brandEntries[0].packetSize}
                                                                onChange={(e) => handleBrandEntryChange(pIndex, 0, 'packetSize', e.target.value)}
                                                                placeholder="Size" autoComplete="off" className="w-full h-[42px] px-2 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-sm text-center"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-2 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700 text-center block w-full">Total</label>
                                                            <div className="relative h-[42px]">
                                                                <input
                                                                    type="text"
                                                                    value={product.brandEntries.reduce((sum, entry) => sum + (parseFloat(entry.inHouseQuantity) || 0), 0).toFixed(2)}
                                                                    readOnly
                                                                    className="w-full h-full px-1 py-2 bg-gray-50/80 border border-gray-200/60 rounded-lg text-gray-600 font-bold outline-none cursor-default text-xs text-center"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="md:col-span-1 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700 text-center block w-full">Unit</label>
                                                            <select
                                                                value={product.brandEntries[0].unit}
                                                                onChange={(e) => handleBrandEntryChange(pIndex, 0, 'unit', e.target.value)}
                                                                className="w-full h-[42px] px-1 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all backdrop-blur-sm text-sm"
                                                            >
                                                                <option>kg</option>
                                                                <option>pcs</option>
                                                                <option>boxes</option>
                                                                <option>liters</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Product Info - Multi Brand Mode */}
                                                {product.isMultiBrand && (
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in duration-300">
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-medium text-gray-700">Entry Mode</label>
                                                            <div className="h-[42px] flex items-center gap-1 p-1 bg-gray-100/50 rounded-lg w-full">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleProductModeToggle(pIndex, false)}
                                                                    className={`flex-1 h-full text-xs font-semibold rounded-md transition-all ${!product.isMultiBrand ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                                >
                                                                    Single
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleProductModeToggle(pIndex, true)}
                                                                    className={`flex-1 h-full text-xs font-semibold rounded-md transition-all ${product.isMultiBrand ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                                >
                                                                    Multi
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-medium text-gray-700">Product Name</label>
                                                            <div className="relative w-full" ref={el => productRefs.current[pIndex] = el}>
                                                                <input
                                                                    type="text"
                                                                    name="productName"
                                                                    value={product.productName}
                                                                    onChange={(e) => {
                                                                        handleStockInputChange(e, pIndex);
                                                                        setActiveDropdown(`lcr-product-${pIndex}`);
                                                                        setHighlightedIndex(-1);
                                                                    }}
                                                                    onFocus={() => {
                                                                        setActiveDropdown(`lcr-product-${pIndex}`);
                                                                        setHighlightedIndex(-1);
                                                                    }}
                                                                    onKeyDown={(e) => handleDropdownKeyDown(e, `lcr-product-${pIndex}`, (field, val) => handleProductSelect(pIndex, val), 'name', getFilteredProducts(product.productName))}
                                                                    placeholder="Search product..."
                                                                    autoComplete="off"
                                                                    className={`w-full h-[42px] px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-14 ${product.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                                                />
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                    {product.productName && (
                                                                        <button type="button" onClick={() => handleProductSelect(pIndex, '')} className="text-gray-400 hover:text-gray-600">
                                                                            <XIcon className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                                {activeDropdown === `lcr-product-${pIndex}` && (
                                                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        {getFilteredProducts(product.productName).map((p, idx) => (
                                                                            <button
                                                                                key={p._id}
                                                                                type="button"
                                                                                onClick={() => handleProductSelect(pIndex, p.name)}
                                                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                                                className={`w-full text-left px-4 py-2 text-sm transition-colors font-medium ${product.productName === p.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                            >
                                                                                {p.name}
                                                                            </button>
                                                                        ))}
                                                                        {getFilteredProducts(product.productName).length === 0 && (
                                                                            <div className="px-4 py-3 text-sm text-gray-500 italic">No products found</div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-medium text-gray-700">Truck No.</label>
                                                            <input
                                                                type="text" name="truckNo" value={product.truckNo} onChange={(e) => handleStockInputChange(e, pIndex)}
                                                                placeholder="Truck No." autoComplete="off" className="w-full h-[42px] px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-medium text-gray-700">Total Quantity</label>
                                                            <div className="relative h-[42px]">
                                                                <input
                                                                    type="text"
                                                                    value={product.brandEntries.reduce((sum, entry) => sum + (parseFloat(entry.inHouseQuantity) || 0), 0).toFixed(2)}
                                                                    readOnly
                                                                    className="w-full h-full px-4 py-2 bg-gray-50/80 border border-gray-200/60 rounded-lg text-gray-600 font-semibold outline-none cursor-default"
                                                                />
                                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                                                                    {product.brandEntries[0]?.unit || 'kg'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Brand Entries Section (Multi-Brand Only) */}
                                                {product.isMultiBrand && (
                                                    <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                                                        <div className="flex items-center justify-between mb-1 px-1">
                                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Brand Breakdown</label>
                                                        </div>
                                                        <div className="hidden md:grid grid-cols-6 gap-2 px-1 mb-1 pr-12">
                                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">BRAND</div>
                                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PURCHASED PRICE</div>
                                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PACKET</div>
                                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">SIZE</div>
                                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">QTY</div>
                                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">UNIT</div>
                                                        </div>
                                                        <div className="space-y-4">
                                                            {product.brandEntries.map((entry, bIndex) => (
                                                                <div key={bIndex} className="p-3 bg-white/40 border border-gray-200/50 rounded-lg space-y-3 group/brand">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-2">
                                                                            <div className="relative w-full" ref={el => brandRefs.current[`${pIndex}-${bIndex}`] = el}>
                                                                                <input
                                                                                    type="text"
                                                                                    value={entry.brand}
                                                                                    placeholder="Search brand..."
                                                                                    onChange={(e) => { handleBrandEntryChange(pIndex, bIndex, 'brand', e.target.value); setActiveDropdown(`lcr-brand-${pIndex}-${bIndex}`); setHighlightedIndex(-1); }}
                                                                                    onFocus={() => {
                                                                                        setActiveDropdown(`lcr-brand-${pIndex}-${bIndex}`);
                                                                                        setHighlightedIndex(-1);
                                                                                    }}
                                                                                    onKeyDown={(e) => handleDropdownKeyDown(e, `lcr-brand-${pIndex}-${bIndex}`, (field, val) => { handleBrandEntryChange(pIndex, bIndex, 'brand', val); setActiveDropdown(null); }, 'brand', getFilteredBrands(entry.brand, product.productName))}
                                                                                    className={`w-full h-9 px-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-12 ${entry.brand ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                                                                />
                                                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                                                    {entry.brand && (
                                                                                        <button type="button" onClick={() => { handleBrandEntryChange(pIndex, bIndex, 'brand', ''); setActiveDropdown(null); }} className="text-gray-400 hover:text-gray-600">
                                                                                            <XIcon className="w-3.5 h-3.5" />
                                                                                        </button>
                                                                                    )}
                                                                                    <SearchIcon className="w-3.5 h-3.5 text-gray-300 pointer-events-none" />
                                                                                </div>
                                                                                {activeDropdown === `lcr-brand-${pIndex}-${bIndex}` && (
                                                                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-48 overflow-y-auto py-1">
                                                                                        {getFilteredBrands(entry.brand, product.productName).map((brand, idx) => (
                                                                                            <button
                                                                                                key={idx}
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    handleBrandEntryChange(pIndex, bIndex, 'brand', brand);
                                                                                                    setActiveDropdown(null);
                                                                                                }}
                                                                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                                                                className={`w-full text-left px-3 py-2 text-sm transition-colors font-medium ${entry.brand === brand ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                                            >
                                                                                                {brand}
                                                                                            </button>
                                                                                        ))}
                                                                                        {getFilteredBrands(entry.brand, product.productName).length === 0 && (
                                                                                            <div className="px-3 py-2 text-sm text-gray-500 italic">
                                                                                                {!product.productName ? 'Please select a product first' : 'Type to add new brand'}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <input
                                                                                type="number" value={entry.purchasedPrice} placeholder="Price" onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'purchasedPrice', e.target.value)}
                                                                                className="w-full h-9 px-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                            />
                                                                            <input
                                                                                type="number" value={entry.packet} placeholder="Packet" onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'packet', e.target.value)}
                                                                                className="w-full h-9 px-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                            />
                                                                            <input
                                                                                type="number" value={entry.packetSize} placeholder="Size" onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'packetSize', e.target.value)}
                                                                                className="w-full h-9 px-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                            />
                                                                            <input
                                                                                type="number" value={entry.quantity} readOnly className="w-full h-9 px-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-500 font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                            />
                                                                            <select
                                                                                value={entry.unit} onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'unit', e.target.value)}
                                                                                className="w-full h-9 px-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                                            >
                                                                                <option>kg</option><option>pcs</option><option>boxes</option><option>liters</option>
                                                                            </select>
                                                                        </div>
                                                                        <div className="flex items-center">
                                                                            <button
                                                                                type="button" onClick={() => addBrandEntry(pIndex)}
                                                                                className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-all"
                                                                            >
                                                                                <PlusIcon className="w-4 h-4" />
                                                                            </button>
                                                                            {product.brandEntries.length > 1 && (
                                                                                <button
                                                                                    type="button" onClick={() => removeBrandEntry(pIndex, bIndex)}
                                                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                                >
                                                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Combined line for Sweeped and InHouse fields */}
                                                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pl-0 md:pl-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <label className="text-[10px] font-bold text-gray-400 uppercase min-w-[60px]">SWP. PKT</label>
                                                                            <input
                                                                                type="number" value={entry.sweepedPacket} placeholder="Packet" onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'sweepedPacket', e.target.value)}
                                                                                className="flex-1 h-8 px-2 text-xs bg-white/70 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                            />
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <label className="text-[10px] font-bold text-gray-400 uppercase min-w-[60px]">SWPQTY</label>
                                                                            <input
                                                                                type="number" value={entry.sweepedQuantity}
                                                                                onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'sweepedQuantity', e.target.value)}
                                                                                placeholder="Qty"
                                                                                className="flex-1 h-8 px-2 text-xs bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                            />
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <label className="text-[10px] font-bold text-gray-400 uppercase min-w-[60px]">INHOUSE PKT</label>
                                                                            <input
                                                                                type="number" value={entry.inHousePacket} placeholder="Packet" readOnly
                                                                                className="flex-1 h-8 px-2 text-xs bg-gray-50/70 border border-gray-200 rounded-md text-gray-500 outline-none cursor-default [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                            />
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <label className="text-[10px] font-bold text-gray-400 uppercase min-w-[60px]">INHOUSE QTY</label>
                                                                            <input
                                                                                type="number" value={entry.inHouseQuantity} placeholder="Qty" readOnly
                                                                                className="flex-1 h-8 px-2 text-xs bg-gray-50/70 border border-gray-200 rounded-md text-gray-500 outline-none cursor-default [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Status */}
                            < div className="col-span-1 md:col-span-2 pt-4 border-t border-gray-100" >
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                    <div className="w-full sm:w-64 space-y-2">
                                        <label className="text-sm font-medium text-gray-700">Status</label>
                                        <select
                                            name="status" value={stockFormData.status} onChange={handleStockInputChange}
                                            className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                                        >
                                            <option>In Stock</option>
                                            <option>Sale From Panama</option>
                                        </select>
                                    </div>

                                    {/* Warehouse Selection */}
                                    <div className="w-full sm:w-64 space-y-2 relative" ref={whSelectRef}>
                                        <label className="text-sm font-medium text-gray-700">Warehouse</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={whSearchQuery}
                                                onChange={(e) => {
                                                    setWhSearchQuery(e.target.value);
                                                    setShowWhSelectDropdown(true);
                                                }}
                                                onFocus={() => setShowWhSelectDropdown(true)}
                                                placeholder={stockFormData.warehouse || "Search warehouse..."}
                                                autoComplete="off"
                                                className={`w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-14 ${stockFormData.warehouse ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                {stockFormData.warehouse && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setStockFormData(prev => ({ ...prev, warehouse: '' }));
                                                            setWhSearchQuery('');
                                                            setShowWhSelectDropdown(false);
                                                        }}
                                                        className="text-gray-400 hover:text-gray-600"
                                                    >
                                                        <XIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                            </div>
                                        </div>
                                        {showWhSelectDropdown && (
                                            <div className="absolute z-[200] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                {warehouses
                                                    .filter(wh => !whSearchQuery || wh.whName.toLowerCase().includes(whSearchQuery.toLowerCase()))
                                                    .map((wh, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => {
                                                                setStockFormData(prev => ({ ...prev, warehouse: wh.whName }));
                                                                setWhSearchQuery('');
                                                                setShowWhSelectDropdown(false);
                                                            }}
                                                            className={`w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium ${stockFormData.warehouse === wh.whName ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                                                        >
                                                            {wh.whName}
                                                        </button>
                                                    ))}
                                                {warehouses.filter(wh => !whSearchQuery || wh.whName.toLowerCase().includes(whSearchQuery.toLowerCase())).length === 0 && (
                                                    <div className="px-4 py-3 text-xs text-gray-400 italic">No warehouses found</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {selectedWhStock && (
                                    <div className="col-span-1 md:col-span-2 mt-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                        <div className="bg-blue-50/50 backdrop-blur-sm border border-blue-100 rounded-2xl overflow-hidden shadow-sm">
                                            <div className="px-6 py-4 border-b border-blue-100 flex items-center justify-between bg-blue-50/80">
                                                <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                                                    <BoxIcon className="w-4 h-4" />
                                                    What's in {stockFormData.warehouse}
                                                </h4>
                                                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Current Inventory</span>
                                            </div>
                                            <div className="max-h-64 overflow-y-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead className="bg-white/50 sticky top-0 z-10">
                                                        <tr>
                                                            <th className="px-6 py-3 text-[10px] font-bold text-blue-400 uppercase tracking-wider">Product</th>
                                                            <th className="px-6 py-3 text-[10px] font-bold text-blue-400 uppercase tracking-wider">Brand</th>
                                                            <th className="px-6 py-3 text-[10px] font-bold text-blue-400 uppercase tracking-wider text-right">INHOUSE PACKET</th>
                                                            <th className="px-6 py-3 text-[10px] font-bold text-blue-400 uppercase tracking-wider text-right">INHOUSE QUANTITY</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-blue-50">
                                                        {selectedWhStock.length === 0 ? (
                                                            <tr>
                                                                <td colSpan="4" className="px-6 py-8 text-center text-blue-300 italic text-sm">
                                                                    This warehouse is currently empty
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            selectedWhStock.map((prod, pIdx) => (
                                                                <React.Fragment key={pIdx}>
                                                                    {prod.brands.map((brand, bIdx) => (
                                                                        <tr key={`${pIdx}-${bIdx}`} className="hover:bg-blue-50/80 transition-colors group">
                                                                            <td className="px-6 py-3">
                                                                                {bIdx === 0 && (
                                                                                    <span className="text-sm font-bold text-gray-800">{prod.productName}</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-6 py-3">
                                                                                <span className="text-sm text-gray-600 font-medium">{brand.brand}</span>
                                                                            </td>
                                                                            <td className="px-6 py-3 text-right font-bold text-gray-900 text-sm">
                                                                                {(() => {
                                                                                    const pkt = brand.whPkt || 0;
                                                                                    const size = brand.packetSize || 0;
                                                                                    const whole = Math.floor(pkt);
                                                                                    const remainder = Math.round((pkt % 1) * size);
                                                                                    return remainder > 0 ? `${whole.toLocaleString()} - ${remainder.toLocaleString()} kg` : whole.toLocaleString();
                                                                                })()}
                                                                            </td>
                                                                            <td className="px-6 py-3 text-right font-bold text-gray-900 text-sm">
                                                                                {parseFloat(brand.whQty || 0).toLocaleString()} kg
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </React.Fragment>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="col-span-1 md:col-span-2 pt-4 flex items-center justify-between">
                                {validationErrors.length > 0 && (
                                    <div className="col-span-1 md:col-span-2 mb-4 bg-red-50 border border-red-100 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                                        <h5 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                            Please correct the following:
                                        </h5>
                                        <ul className="list-disc list-inside space-y-1">
                                            {validationErrors.map((err, i) => (
                                                <li key={i} className="text-xs text-red-500 font-medium">{err}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {submitStatus === 'success' && (
                                    <p className="text-green-600 font-medium flex items-center animate-bounce">
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                        Stock saved successfully!
                                    </p>
                                )}
                                {submitStatus === 'error' && validationErrors.length === 0 && (
                                    <p className="text-red-600 font-medium flex items-center">
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        Failed to save LC receive.
                                    </p>
                                )}
                                <div className="flex-1"></div>
                                <button
                                    type="submit" disabled={isSubmitting}
                                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? 'Saving...' : editingId ? 'Update LC Receive' : 'Add LC Receive'}
                                </button>
                            </div>
                        </form>
                    </div >
                )
            }

            {/* Table Section */}
            {
                !showStockForm && (
                    <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl shadow-sm overflow-hidden">
                        {/* ... Table logic ... */}
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                    <tr>
                                        {isSelectionMode && (
                                            <th className="px-6 py-4 w-12">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.size === lcReceiveRecords.length && lcReceiveRecords.length > 0}
                                                    onChange={(e) => {
                                                        // Bulk select logic if needed
                                                    }}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                            </th>
                                        )}
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">LC No</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Importer</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Exporter</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Port</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ind CNF</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Cost</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">BD CNF</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Cost</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Bill Entry</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Truck</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Quantity</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {lcReceiveRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan="14" className="px-6 py-12 text-center text-gray-400 bg-white/50">
                                                <BoxIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                <p>No LC receive records found</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        // Grouping logic is complex (see App.jsx), recreating simplify logic here or reuse grouped records
                                        // For this extraction, I'll iterate directly or implement the grouping if needed.
                                        // App.jsx implements grouping within the map. I'll stick to a simpler rendering for now or copy the grouping logic.
                                        // IMPORTANT: The original code Groups by Date+LC+Port.
                                        // I will simplify for now to render row-by-row or recreate the reduce logic:

                                        Object.values(lcReceiveRecords.reduce((acc, item) => {
                                            // Lines 2753-2818 in App.jsx
                                            const groupedKey = `${item.date}-${item.lcNo}-${item.port}-${item.indianCnF}-${item.bdCnF}-${item.importer}-${item.exporter}`;

                                            if (!acc[groupedKey]) {
                                                acc[groupedKey] = {
                                                    groupedKey,
                                                    date: item.date,
                                                    lcNo: item.lcNo,
                                                    port: item.port,
                                                    indianCnF: item.indianCnF,
                                                    indCnFCost: item.indCnFCost,
                                                    bdCnF: item.bdCnF,
                                                    bdCnFCost: item.bdCnFCost,
                                                    importer: item.importer,
                                                    exporter: item.exporter,
                                                    billOfEntry: item.billOfEntry,
                                                    totalLcTruck: 0,
                                                    totalQuantity: 0,
                                                    truckEntries: new Set(),
                                                    products: new Set(),
                                                    ids: [],
                                                    allIds: [],
                                                    entries: []
                                                };
                                            }

                                            const itemQty = parseFloat(item.quantity) || 0;
                                            acc[groupedKey].totalQuantity += itemQty;

                                            const truckEntryKey = `${item.date}-${item.productName}-${item.truckNo}`;
                                            if (!acc[groupedKey].truckEntries.has(truckEntryKey)) {
                                                acc[groupedKey].truckEntries.add(truckEntryKey);
                                                acc[groupedKey].totalLcTruck += (parseFloat(item.truckNo) || 0);
                                            }

                                            if (item.productName) acc[groupedKey].products.add(item.productName);
                                            acc[groupedKey].ids.push(item._id);
                                            acc[groupedKey].allIds.push(item._id);
                                            acc[groupedKey].entries.push(item);
                                            return acc;
                                        }, {})).map((entry) => {
                                            const uniqueEntriesMap = entry.entries.reduce((acc, item) => {
                                                const key = `${item.productName}-${item.truckNo}-${item.unit}`;
                                                if (!acc[key]) {
                                                    acc[key] = { ...item, quantity: 0 };
                                                }
                                                acc[key].quantity += (parseFloat(item.quantity) || 0);
                                                return acc;
                                            }, {});
                                            const uniqueEntries = Object.values(uniqueEntriesMap);

                                            return (
                                                <tr
                                                    key={entry.groupedKey}
                                                    className={`transition-colors duration-200 cursor-pointer select-none ${selectedItems.has(entry.groupedKey) ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}
                                                    onMouseDown={() => startLongPress(entry.groupedKey)}
                                                    onMouseUp={endLongPress}
                                                    onMouseLeave={endLongPress}
                                                    onClick={() => {
                                                        if (isLongPressTriggered.current) return;
                                                        if (isSelectionMode) toggleSelection(entry.groupedKey);
                                                    }}
                                                >
                                                    {isSelectionMode && (
                                                        <td className="px-6 py-4">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedItems.has(entry.groupedKey)}
                                                                onChange={(e) => { e.stopPropagation(); toggleSelection(entry.groupedKey); }}
                                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatDate(entry.date)}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{entry.lcNo || '-'}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{entry.importer || '-'}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{entry.exporter || '-'}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{entry.port || '-'}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{entry.indianCnF || '-'}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                        {!isNaN(parseFloat(entry.indCnFCost)) && entry.indCnFCost !== '' ? `৳${parseFloat(entry.indCnFCost).toLocaleString()}` : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{entry.bdCnF || '-'}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                        {!isNaN(parseFloat(entry.bdCnFCost)) && entry.bdCnFCost !== '' ? `৳${parseFloat(entry.bdCnFCost).toLocaleString()}` : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{entry.billOfEntry || '-'}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 align-top">
                                                        {uniqueEntries.map((item, idx) => (
                                                            <div key={idx} className="leading-6 py-1 border-b border-gray-100 last:border-0 truncate max-w-xs">{item.productName || '-'}</div>
                                                        ))}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 align-top">
                                                        {uniqueEntries.map((item, idx) => (
                                                            <div key={idx} className="leading-6 py-1 border-b border-gray-100 last:border-0">{item.truckNo || '0'}</div>
                                                        ))}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-900 align-top">
                                                        {uniqueEntries.map((item, idx) => (
                                                            <div key={idx} className="leading-6 py-1 border-b border-gray-100 last:border-0">{Math.round(item.quantity)}</div>
                                                        ))}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end space-x-3">
                                                            <button onClick={(e) => { e.stopPropagation(); handleEditInternal('stock', entry); }} className="text-gray-400 hover:text-blue-600 transition-colors">
                                                                <EditIcon className="w-5 h-5" />
                                                            </button>
                                                            <button onClick={(e) => {
                                                                e.stopPropagation();
                                                                // Handling bulk delete via parent handler logic
                                                                // Assuming onDelete takes type, id, isBulk. 
                                                                // Here we pass null for id and handle selection manually if expected, 
                                                                // But typically we should select the item first.
                                                                // Replicating original code:
                                                                const ids = entry.ids;
                                                                setSelectedItems(new Set(ids));
                                                                onDelete('stock', null, true);
                                                            }} className="text-gray-400 hover:text-red-600 transition-colors">
                                                                <TrashIcon className="w-5 h-5" />
                                                            </button>
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
                )
            }
        </div >
    );
}

export default LCReceive;
