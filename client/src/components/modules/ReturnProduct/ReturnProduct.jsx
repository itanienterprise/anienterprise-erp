import React, { useState, useEffect, useRef } from 'react';
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

const ReturnProduct = ({ currentUser }) => {
    const [showForm, setShowForm] = useState(false);
    const [returns, setReturns] = useState([]);
    const [sales, setSales] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [expandedReturnId, setExpandedReturnId] = useState(null);

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
        brand: '',
        quantity: '',
        bags: '',
        warehouse: '',
        reason: '',
        returnPrice: '',
        status: 'Pending',
        packetSize: 0,
        purchaseItems: []
    });

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

    useEffect(() => {
        fetchReturns();
        fetchSales();
        fetchWarehouses();
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
        const name = (w.whName || w.name || w.warehouse || '').toLowerCase();
        return name.includes(warehouseSearch.toLowerCase());
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

            // 1. Update Warehouse Stock (Differential update for Edit, Simple add for New)
            if (formData.warehouse && formData.productName) {
                const whResponse = await axios.get(`${API_BASE_URL}/api/warehouses`);
                const allWh = Array.isArray(whResponse.data) ? whResponse.data : [];
                
                const targetWhName = (formData.warehouse || '').trim().toLowerCase();
                const targetProdName = (formData.productName || '').trim().toLowerCase();
                const targetBrand = (formData.brand || '').trim().toLowerCase();

                const targetWh = allWh.find(w => {
                    const wName = (w.whName || w.name || w.warehouse || '').trim().toLowerCase();
                    const wProd = (w.productName || w.product || '').trim().toLowerCase();
                    const wBrand = (w.brand || '').trim().toLowerCase();
                    return wName === targetWhName && wProd === targetProdName && (wBrand === targetBrand || (wBrand === '' && targetBrand === ''));
                });

                let diffQty = returnQty;
                let diffPkt = returnPkt;

                if (editingId) {
                    const oldReturn = returns.find(r => r._id === editingId);
                    if (oldReturn) {
                        diffQty = returnQty - (parseFloat(oldReturn.quantity) || 0);
                        diffPkt = returnPkt - (parseFloat(oldReturn.bags) || 0);
                    }
                }

                if (targetWh) {
                    const updatedWh = {
                        ...targetWh,
                        whQty: (parseFloat(targetWh.whQty) || 0) + diffQty,
                        whPkt: (parseFloat(targetWh.whPkt) || 0) + diffPkt,
                        inHouseQuantity: (parseFloat(targetWh.inHouseQuantity || targetWh.whQty) || 0) + diffQty,
                        inHousePacket: (parseFloat(targetWh.inHousePacket || targetWh.whPkt) || 0) + diffPkt,
                        recordType: targetWh.recordType || 'warehouse'
                    };
                    await axios.put(`${API_BASE_URL}/api/warehouses/${targetWh._id}`, updatedWh);
                } else if (!editingId) {
                    const newWh = {
                        whName: formData.warehouse,
                        productName: formData.productName,
                        brand: formData.brand,
                        whQty: returnQty,
                        whPkt: returnPkt,
                        inHouseQuantity: returnQty,
                        inHousePacket: returnPkt,
                        status: 'Active',
                        manager: '-',
                        location: 'Returned Stock',
                        packetSize: formData.packetSize || 0,
                        recordType: 'warehouse',
                        date: formData.date || new Date().toISOString()
                    };
                    await axios.post(`${API_BASE_URL}/api/warehouses`, newWh);
                }
            }

            // 2. Save Return Record
            if (editingId) {
                await axios.put(`${API_BASE_URL}/api/returns/${editingId}`, formData);
            } else {
                await axios.post(`${API_BASE_URL}/api/returns`, formData);
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
                    updatedSale.totalAmount = updatedSale.items.reduce((sum, item) => sum + (parseFloat(item.totalAmount) || 0), 0).toFixed(2);
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
                brand: '',
                quantity: '',
                bags: '',
                warehouse: '',
                reason: '',
                returnPrice: '',
                status: 'Pending',
                packetSize: 0,
                originalQuantity: '',
                purchaseItems: []
            });
            fetchReturns();
        } catch (error) {
            console.error('Error saving return:', error);
            alert('Error saving return record. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (ret) => {
        // Find the original sale to populate purchaseItems if editing
        const originalSale = sales.find(s => s.invoiceNo === ret.invoiceNo);
        setFormData({
            ...ret,
            purchaseItems: originalSale ? (originalSale.items || []) : []
        });
        setEditingId(ret._id);
        setInvoiceSearch(ret.invoiceNo);
        setWarehouseSearch(ret.warehouse || '');
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this return record?')) {
            try {
                const returnToDelete = returns.find(r => r._id === id);
                if (!returnToDelete) return;

                // 1. Reverse Warehouse Stock
                const whResponse = await axios.get(`${API_BASE_URL}/api/warehouses`);
                const allWh = Array.isArray(whResponse.data) ? whResponse.data : [];
                
                const targetWhName = (returnToDelete.warehouse || '').trim().toLowerCase();
                const targetProdName = (returnToDelete.productName || '').trim().toLowerCase();
                const targetBrand = (returnToDelete.brand || '').trim().toLowerCase();

                const targetWh = allWh.find(w => {
                    const wName = (w.whName || w.name || w.warehouse || '').trim().toLowerCase();
                    const wProd = (w.productName || w.product || '').trim().toLowerCase();
                    const wBrand = (w.brand || '').trim().toLowerCase();
                    return wName === targetWhName && wProd === targetProdName && (wBrand === targetBrand || (wBrand === '' && targetBrand === ''));
                });

                if (targetWh) {
                    const retQty = parseFloat(returnToDelete.quantity) || 0;
                    const retPkt = parseFloat(returnToDelete.bags) || 0;

                    const updatedWh = {
                        ...targetWh,
                        whQty: Math.max(0, (parseFloat(targetWh.whQty) || 0) - retQty),
                        whPkt: Math.max(0, (parseFloat(targetWh.whPkt) || 0) - retPkt),
                        inHouseQuantity: Math.max(0, (parseFloat(targetWh.inHouseQuantity || targetWh.whQty) || 0) - retQty),
                        inHousePacket: Math.max(0, (parseFloat(targetWh.inHousePacket || targetWh.whPkt) || 0) - retPkt),
                        recordType: targetWh.recordType || 'warehouse'
                    };
                    await axios.put(`${API_BASE_URL}/api/warehouses/${targetWh._id}`, updatedWh);
                }

                // 2. Delete the Return Record
                await axios.delete(`${API_BASE_URL}/api/returns/${id}`);

                // 3. Sync Sale Invoice (Recalculate based on REMAINING returns)
                const originalSale = sales.find(s => s.invoiceNo === returnToDelete.invoiceNo);
                if (originalSale) {
                    // Fetch remaining returns to get new absolute truth
                    const allReturnsResponse = await axios.get(`${API_BASE_URL}/api/returns`);
                    const remainingReturns = (Array.isArray(allReturnsResponse.data) ? allReturnsResponse.data : [])
                        .filter(r => r.invoiceNo === returnToDelete.invoiceNo && r._id !== id);

                    const updatedSale = JSON.parse(JSON.stringify(originalSale));
                    let itemModified = false;

                    if (updatedSale.items && updatedSale.items.length > 0) {
                        updatedSale.items = updatedSale.items.map(item => {
                            const productReturns = remainingReturns.filter(r => r.productName === item.productName);
                            if (item.brandEntries && item.brandEntries.length > 0) {
                                item.brandEntries = item.brandEntries.map(be => {
                                    const brandName = be.brandName || be.brand;
                                    const brandReturns = productReturns.filter(r => (r.brandName || r.brand) === brandName);
                                    const totalRetQty = brandReturns.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
                                    const totalRetPkt = brandReturns.reduce((sum, r) => sum + (parseFloat(r.bags) || 0), 0);

                                    // Use stored original quantity
                                    const originalQty = be.originalQuantity || (parseFloat(be.quantity) || 0) + (parseFloat(be.returnQty) || 0);
                                    be.originalQuantity = originalQty;
                                    be.returnQty = totalRetQty;
                                    be.returnPkt = totalRetPkt;
                                    be.quantity = Math.max(0, originalQty - totalRetQty);
                                    
                                    const price = parseFloat(be.unitPrice) || 0;
                                    be.totalAmount = (be.quantity * price).toFixed(2);
                                    itemModified = true;
                                    return be;
                                });
                            } else if (item.productName === returnToDelete.productName) {
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
                        updatedSale.totalAmount = updatedSale.items.reduce((sum, item) => sum + (parseFloat(item.totalAmount) || 0), 0).toFixed(2);
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

                fetchReturns();
            } catch (error) {
                console.error('Error deleting return:', error);
                alert('Error deleting return record. Please try again.');
            }
        }
    };

    const filteredReturns = returns.filter(ret =>
        (ret.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ret.productName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ret.invoiceNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ret.companyName || '').toLowerCase().includes(searchQuery.toLowerCase())
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

        setFormData({
            ...formData,
            invoiceNo: sale.invoiceNo,
            invoiceDate: sale.date || '',
            companyName: sale.companyName || '',
            phone: sale.contact || sale.phone || '',
            customerName: sale.customerName || sale.companyName || '',
            productName: prodName,
            purchaseItems: items
        });
        setInvoiceSearch(sale.invoiceNo);
        setShowInvoiceDropdown(false);
        setHighlightedInvoiceIndex(-1);
    };

    const isAdmin = currentUser?.username === 'admin' || (currentUser?.role || '').toLowerCase() === 'admin';
    const isIncharge = (currentUser?.role || '').toLowerCase() === 'incharge';
    const isSalesManager = (currentUser?.role || '').toLowerCase() === 'sales manager';
    const isDataEntry = (currentUser?.role || '').toLowerCase() === 'data entry';
    const canManage = isAdmin || isIncharge || isSalesManager || isDataEntry;

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
                                    quantity: '',
                                    returnPrice: '',
                                    reason: '',
                                    status: 'Pending',
                                    originalQuantity: ''
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
                                                <th>Brand</th>
                                                <th className="text-center">Qty</th>
                                                <th className="text-right">Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {formData.purchaseItems.map((item, idx) => (
                                                <React.Fragment key={idx}>
                                                    {item.brandEntries && item.brandEntries.length > 0 ? (
                                                        item.brandEntries.map((be, beIdx) => (
                                                            <tr key={`${idx}-${beIdx}`} className="cursor-pointer hover:bg-blue-50/50" onClick={() => {
                                                                setFormData({
                                                                    ...formData,
                                                                    productName: item.productName,
                                                                    brand: be.brand || be.brandName || '',
                                                                    quantity: '',
                                                                    returnPrice: be.unitPrice || 0,
                                                                    originalQuantity: parseFloat(be.quantity || 0) + (parseFloat(be.returnQty) || 0),
                                                                    packetSize: parseFloat(be.packetSize || item.packetSize || be.bagSize || item.bagSize || 50)
                                                                });
                                                            }}>
                                                                <td>{item.productName}</td>
                                                                <td>{be.brandName || be.brand}</td>
                                                                <td className="text-center font-bold text-blue-600">{parseFloat(be.quantity || 0) + (parseFloat(be.returnQty) || 0)}</td>
                                                                <td className="text-right">৳ {parseFloat(be.unitPrice || 0).toLocaleString()}</td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr className="cursor-pointer hover:bg-blue-50/50" onClick={() => {
                                                            setFormData({
                                                                ...formData,
                                                                productName: item.productName,
                                                                brand: '-',
                                                                quantity: '',
                                                                returnPrice: item.unitPrice || item.rate || 0,
                                                                originalQuantity: parseFloat(item.quantity || 0) + (parseFloat(item.returnQty) || 0),
                                                                packetSize: parseFloat(item.packetSize || item.bagSize || 50)
                                                            });
                                                        }}>
                                                            <td>{item.productName}</td>
                                                            <td>-</td>
                                                            <td className="text-center font-bold text-blue-600">{parseFloat(item.quantity || 0) + (parseFloat(item.returnQty) || 0)}</td>
                                                            <td className="text-right">৳ {parseFloat(item.unitPrice || 0).toLocaleString()}</td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                    <p className="text-[10px] text-gray-400 mt-2 px-1">* Click on a row to auto-fill the return details below</p>
                                </div>
                            </div>
                        )}

                        <div className="return-product-form-field-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
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

                            <div className="return-product-form-field" ref={warehouseRef}>
                                <label className="return-product-form-label">Warehouse</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        className="return-product-form-input pr-10"
                                        placeholder="Search..."
                                        value={warehouseSearch}
                                        onChange={(e) => {
                                            setWarehouseSearch(e.target.value);
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
                                    <ChevronDownIcon className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform duration-200 ${showWarehouseDropdown ? 'rotate-180' : ''} w-4 h-4`} />

                                    {showWarehouseDropdown && filteredWarehouses.length > 0 && (
                                        <div className="invoice-dropdown-list">
                                            {filteredWarehouses.map((w, idx) => (
                                                <div
                                                    key={w._id}
                                                    className={`invoice-dropdown-item ${highlightedWarehouseIndex === idx ? 'bg-blue-50' : ''}`}
                                                    onClick={() => {
                                                        const selectedName = w.whName || w.name || w.warehouse;
                                                        setFormData({ ...formData, warehouse: selectedName });
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
                                        <th className="return-product-table-header">Brand</th>
                                        <th className="return-product-table-header text-center">Quantity</th>
                                        <th className="return-product-table-header text-center">Bags</th>
                                        <th className="return-product-table-header text-right">Return Price</th>
                                        {isAdmin && <th className="return-product-table-header text-right">Actions</th>}
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
                                                    if (rate > 0) {
                                                        return `৳ ${(rate * qty).toLocaleString()}`;
                                                    }
                                                    return '-';
                                                })()}
                                            </td>
                                            {canManage && (
                                            <td className="return-product-table-cell">
                                                <div className="return-product-table-actions justify-end">
                                                    <button
                                                        onClick={() => handleEdit(ret)}
                                                        className="return-product-action-btn return-product-action-edit"
                                                    >
                                                        <EditIcon className="w-5 h-5" />
                                                    </button>
                                                    {isAdmin && (
                                                        <button
                                                            onClick={() => handleDelete(ret._id)}
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
                                            <td colSpan={(isAdmin || isSalesManager) ? 9 : 8} className="py-20 text-center text-gray-400">
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
                                                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Quantity</span>
                                                    <span className="text-gray-900 font-black font-mono">{ret.quantity}</span>
                                                </div>
                                                {ret.reason && (
                                                    <div className="flex justify-between items-start text-xs pt-1">
                                                        <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px] shrink-0">Reason</span>
                                                        <span className="text-gray-900 font-black text-right max-w-[65%] line-clamp-2">{ret.reason}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {canManage && (
                                            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleEdit(ret); }}
                                                    className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-50 text-blue-700 rounded-xl text-xs font-black flex-1 hover:bg-blue-100 transition-all active:scale-95"
                                                >
                                                    <EditIcon className="w-4 h-4" /> Edit
                                                </button>
                                                {isAdmin && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(ret._id); }}
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
        </div>
    );
};

export default ReturnProduct;
