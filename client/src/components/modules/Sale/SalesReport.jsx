import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from '../../../utils/api';
import { SearchIcon, XIcon, BarChartIcon, FunnelIcon, PrinterIcon, ChevronDownIcon } from '../../Icons';
import CustomDatePicker from "../../shared/CustomDatePicker";
import { generateSalesReportPDF } from '../../../utils/pdfGenerator';
import { formatDate } from '../../../utils/helpers';
import { calculateStockData, isLcMatch } from '../../../utils/stockHelpers';

const SalesReport = ({
    isOpen,
    onClose,
    salesRecords = [],
    allSalesRecords = [],
    saleFilters,
    setSaleFilters,
    searchQuery = '',
    saleType = 'General',
    products = [],
    stockRecords: propStockRecords,
    warehouseData = [],
    damages = [],
    activeBaseline = null
}) => {
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

    const [reportTab, setReportTab] = useState('general');
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [expandedRows, setExpandedRows] = useState([]);
    const [filterSearchInputs, setFilterSearchInputs] = useState({ companySearch: '', invoiceSearch: '', lcSearch: '', productSearch: '', brandSearch: '', portSearch: '', indCnfSearch: '', bdCnfSearch: '' });
    const [filterDropdownOpen, setFilterDropdownOpen] = useState({ company: false, invoice: false, lc: false, product: false, brand: false, port: false, indCnf: false, bdCnf: false, from: false, to: false });
    const initialFilterDropdownState = { company: false, invoice: false, lc: false, product: false, brand: false, port: false, indCnf: false, bdCnf: false, from: false, to: false };

    const [customerLocationMap, setCustomerLocationMap] = useState({});
    const [fetchedStockRecords, setFetchedStockRecords] = useState([]);

    useEffect(() => {
        const fetchStocks = async () => {
            try {
                const res = await axios.get('/api/stock');
                const data = Array.isArray(res.data) ? res.data : [];
                setFetchedStockRecords(data);
            } catch (err) {
                console.error("Error fetching stock for LC report:", err);
            }
        };
        if (isOpen && (!propStockRecords || propStockRecords.length === 0)) {
            fetchStocks();
        }
    }, [isOpen, propStockRecords]);

    const activeStockRecords = (propStockRecords && propStockRecords.length > 0) ? propStockRecords : fetchedStockRecords;

    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                const res = await axios.get('/api/customers');
                const data = res.data?.data || res.data || [];
                const map = {};
                data.forEach(c => {
                    const loc = c.location || '';
                    if (c.companyName) map[c.companyName.trim().toLowerCase()] = loc;
                    if (c.customerName) map[c.customerName.trim().toLowerCase()] = loc;
                });
                setCustomerLocationMap(map);
            } catch (err) {
                console.error("Error fetching customers for location map:", err);
            }
        };
        if (isOpen) {
            fetchCustomers();
        }
    }, [isOpen]);

    const getCustomerLocation = (sale) => {
        if (sale.location && sale.location.trim() !== '') return sale.location;
        const keyComp = (sale.companyName || sale.customerName || '').trim().toLowerCase();
        if (keyComp && customerLocationMap[keyComp] && customerLocationMap[keyComp].trim() !== '') {
            return customerLocationMap[keyComp];
        }
        return sale.address || sale.customerAddress || '-';
    };

    const filterButtonRef = useRef(null);
    const filterPanelRef = useRef(null);
    const companyFilterRef = useRef(null);
    const invoiceFilterRef = useRef(null);
    const lcFilterRef = useRef(null);
    const productFilterRef = useRef(null);
    const brandFilterRef = useRef(null);
    const portFilterRef = useRef(null);
    const indCnfFilterRef = useRef(null);
    const bdCnfFilterRef = useRef(null);
    const fromDateFilterRef = useRef(null);
    const toDateFilterRef = useRef(null);

    // Close Dropdowns on Click Outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showFilterPanel && filterPanelRef.current && !filterPanelRef.current.contains(event.target) && !filterButtonRef.current.contains(event.target)) {
                setShowFilterPanel(false);
            }
            if (filterDropdownOpen.company && companyFilterRef.current && !companyFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, company: false }));
            if (filterDropdownOpen.invoice && invoiceFilterRef.current && !invoiceFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, invoice: false }));
            if (filterDropdownOpen.lc && lcFilterRef.current && !lcFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, lc: false }));
            if (filterDropdownOpen.product && productFilterRef.current && !productFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, product: false }));
            if (filterDropdownOpen.brand && brandFilterRef.current && !brandFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, brand: false }));
            if (filterDropdownOpen.port && portFilterRef.current && !portFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, port: false }));
            if (filterDropdownOpen.indCnf && indCnfFilterRef.current && !indCnfFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, indCnf: false }));
            if (filterDropdownOpen.bdCnf && bdCnfFilterRef.current && !bdCnfFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, bdCnf: false }));
            if (filterDropdownOpen.from && fromDateFilterRef.current && !fromDateFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, from: false }));
            if (filterDropdownOpen.to && toDateFilterRef.current && !toDateFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, to: false }));
        };

        if (showFilterPanel || Object.values(filterDropdownOpen).some(Boolean)) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showFilterPanel, filterDropdownOpen]);

    // Scroll Lock when Modal or Filter Panel is active
    useEffect(() => {
        if (isOpen || showFilterPanel) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, showFilterPanel]);

    // Calculate global saleable stock across all warehouses using reportType: 'price' to preserve LC numbers
    const stockSaleableData = useMemo(() => {
        if (!isOpen) return { displayRecords: [] };
        try {
            return calculateStockData(
                activeStockRecords,
                { reportType: 'price' },
                '',
                warehouseData,
                allSalesRecords && allSalesRecords.length > 0 ? allSalesRecords : salesRecords,
                products,
                damages,
                activeBaseline
            );
        } catch (err) {
            console.error("Error calculating stock data in SalesReport:", err);
            return { displayRecords: [] };
        }
    }, [isOpen, activeStockRecords, warehouseData, allSalesRecords, salesRecords, products, damages, activeBaseline]);

    if (!isOpen) return null;

    const getSaleableStock = (lcNo, prodName, brandName) => {
        let matchedQty = 0;
        let matchedPkt = 0;

        const cleanProd = (prodName || '').trim().toLowerCase();
        const cleanBrand = (brandName || '').trim().toLowerCase();
        const cleanLc = (lcNo || '').trim();

        const displayRecords = stockSaleableData?.displayRecords || [];
        displayRecords.forEach(p => {
            if ((p.productName || '').trim().toLowerCase() !== cleanProd) return;
            (p.brandList || []).forEach(b => {
                const bBrand = (b.brand || '').trim().toLowerCase();
                if (cleanBrand && bBrand !== cleanBrand) return;

                const matchesLc = cleanLc ? isLcMatch(b.lcNo, cleanLc) || (b.lcNos && b.lcNos.some(l => isLcMatch(l, cleanLc))) : true;
                if (matchesLc) {
                    matchedQty += (b.saleableQuantity || 0);
                    matchedPkt += (b.saleablePacket || 0);
                }
            });
        });

        return {
            saleablePkt: Math.max(0, Math.round(matchedPkt * 100) / 100),
            saleableQty: Math.max(0, Math.round(matchedQty * 100) / 100)
        };
    };

    const getUniqueOptions = (key) => {
        if (key === 'lcNo') {
            const options = new Set();
            salesRecords.forEach(sale => {
                if (sale.lcNo) options.add(sale.lcNo.trim());
                (sale.items || []).forEach(item => {
                    if (item.lcNo) options.add(item.lcNo.trim());
                    (item.brandEntries || []).forEach(entry => {
                        if (entry.lcNo) options.add(entry.lcNo.trim());
                    });
                });
            });
            activeStockRecords.forEach(stock => {
                if (stock.lcNo) options.add(stock.lcNo.trim());
            });
            return [...options].filter(Boolean).filter(x => x !== '-' && x.toLowerCase() !== 'null' && x.toLowerCase() !== 'undefined').sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        }
        if (key === 'productName' || key === 'brandName') {
            const options = new Set();
            salesRecords.forEach(sale => {
                const items = sale.items || [];
                items.forEach(item => {
                    if (key === 'productName') {
                        const pName = item.productName || item.product;
                        if (pName) options.add(pName.trim());
                    } else {
                        const brandEntries = item.brandEntries || [];
                        brandEntries.forEach(entry => {
                            const bName = entry.brandName || entry.brand;
                            if (bName) options.add(bName.trim());
                        });
                    }
                });
            });
            return [...options].sort();
        }
        return [...new Set(salesRecords.map(item => (item[key] || '').trim()).filter(Boolean))].sort();
    };

    const parseRecordDate = (dVal) => {
        if (!dVal) return null;
        if (dVal instanceof Date) return isNaN(dVal.getTime()) ? null : dVal;
        const str = String(dVal).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
            const [y, m, d] = str.split('T')[0].split('-').map(Number);
            return new Date(y, m - 1, d);
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    };

    const checkDateMatchesFilter = (dateVal, createdAtVal) => {
        const targetDate = parseRecordDate(dateVal) || parseRecordDate(createdAtVal);

        // Date range filtering (custom startDate / endDate)
        if (saleFilters.startDate) {
            const start = parseRecordDate(saleFilters.startDate);
            if (start) {
                start.setHours(0, 0, 0, 0);
                if (!targetDate || targetDate < start) return false;
            }
        }
        if (saleFilters.endDate) {
            const end = parseRecordDate(saleFilters.endDate);
            if (end) {
                end.setHours(23, 59, 59, 999);
                if (!targetDate || targetDate > end) return false;
            }
        }

        // Quick range filtering
        if (saleFilters.quickRange && saleFilters.quickRange !== 'all' && saleFilters.quickRange !== 'custom') {
            if (!targetDate) return false;
            const now = new Date();
            if (saleFilters.quickRange === 'weekly') {
                const dayOfWeek = now.getDay();
                const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() + diffToMonday);
                weekStart.setHours(0, 0, 0, 0);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                weekEnd.setHours(23, 59, 59, 999);

                const rollingWeekStart = new Date(now);
                rollingWeekStart.setDate(now.getDate() - 7);
                rollingWeekStart.setHours(0, 0, 0, 0);

                const matchesWeekly = (targetDate >= weekStart && targetDate <= weekEnd) || (targetDate >= rollingWeekStart && targetDate <= now);
                if (!matchesWeekly) return false;
            } else if (saleFilters.quickRange === 'monthly') {
                const month = parseInt(saleFilters.selectedMonth || (now.getMonth() + 1));
                const year = parseInt(saleFilters.selectedYear || now.getFullYear());
                if (targetDate.getMonth() + 1 !== month || targetDate.getFullYear() !== year) {
                    return false;
                }
            } else if (saleFilters.quickRange === 'yearly') {
                const year = parseInt(saleFilters.selectedYear || now.getFullYear());
                if (targetDate.getFullYear() !== year) {
                    return false;
                }
            }
        }

        return true;
    };

    // Calculate aggregated data for the report
    const filteredSales = salesRecords.filter(sale => {
        const statusLower = (sale.status || '').toLowerCase();
        if (statusLower === 'rejected') return false;

        if (!checkDateMatchesFilter(sale.date, sale.createdAt)) return false;

        if (saleFilters.companyName && (sale.companyName || sale.customerName) !== saleFilters.companyName) return false;
        if (saleFilters.invoiceNo && sale.invoiceNo !== saleFilters.invoiceNo) return false;
        if (saleFilters.lcNo) {
            const targetLc = saleFilters.lcNo.trim().toLowerCase();
            const matchesSaleLc = (sale.lcNo || '').trim().toLowerCase().includes(targetLc);
            const matchesItemLc = (sale.items || []).some(item => {
                if ((item.lcNo || '').trim().toLowerCase().includes(targetLc)) return true;
                return (item.brandEntries || []).some(b => (b.lcNo || '').trim().toLowerCase().includes(targetLc));
            });
            if (!matchesSaleLc && !matchesItemLc) return false;
        }

        // Exclude order records from non-Order sale type reports
        const sTypeLow = (sale.saleType || '').toLowerCase().trim();
        const invUpper = (sale.invoiceNo || sale.orderNo || '').toUpperCase();
        const isOrderRecord = sTypeLow === 'order' || invUpper.startsWith('ORD') || sale.isOrderEntry === true;
        if (isOrderRecord && saleType !== 'Order') return false;

        // Border Specific Filters
        if (saleType === 'Border') {
            if (saleFilters.port && sale.port !== saleFilters.port) return false;
            if (saleFilters.indCnf && sale.indianCnF !== saleFilters.indCnf) return false;
            if (saleFilters.bdCnf && sale.bdCnf !== saleFilters.bdCnf) return false;
        }

        return true;

    }).sort((a, b) => {
        const d1 = new Date(a.date || 0).getTime();
        const d2 = new Date(b.date || 0).getTime();
        if (d1 !== d2) return d1 - d2;
        const invA = String(a.invoiceNo || a.orderNo || '').toUpperCase();
        const invB = String(b.invoiceNo || b.orderNo || '').toUpperCase();
        if (invA && invB) {
            return invA.localeCompare(invB, undefined, { numeric: true, sensitivity: 'base' });
        }
        return (a.createdAt || a._id || 0) > (b.createdAt || b._id || 0) ? 1 : -1;
    });

    const activeFilterCount = Object.entries(saleFilters || {}).filter(([key, val]) => {
        if (key === 'quickRange') return val !== 'all' && val !== '' && val !== undefined;
        if (key === 'selectedMonth' || key === 'selectedYear') return false;
        return val !== '' && val !== undefined && val !== null;
    }).length;
    const hasActiveFilters = activeFilterCount > 0;

    const getDateRangeDisplay = () => {
        if (saleFilters.quickRange && saleFilters.quickRange !== 'all') {
            if (saleFilters.quickRange === 'weekly') {
                return 'Weekly (Current Week)';
            } else if (saleFilters.quickRange === 'monthly') {
                const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                const monthName = months[(saleFilters.selectedMonth || new Date().getMonth() + 1) - 1];
                const year = saleFilters.selectedYear || new Date().getFullYear();
                return `${monthName} ${year}`;
            } else if (saleFilters.quickRange === 'yearly') {
                const year = saleFilters.selectedYear || new Date().getFullYear();
                return `Year: ${year}`;
            } else if (saleFilters.quickRange === 'custom') {
                const start = saleFilters.startDate ? formatDate(saleFilters.startDate) : 'Start';
                const end = saleFilters.endDate ? formatDate(saleFilters.endDate) : 'Present';
                return `${start} to ${end}`;
            }
        }
        const start = saleFilters.startDate ? formatDate(saleFilters.startDate) : 'Start';
        const end = saleFilters.endDate ? formatDate(saleFilters.endDate) : 'Present';
        return `${start} to ${end}`;
    };

    // Construct flat items per sale, applying search query filters to display only matching products/brands/LCs
    const salesWithItems = filteredSales.map(sale => {
        const items = sale.items || [];
        let flatItems = items.flatMap(item => {
            const entries = (item.brandEntries && item.brandEntries.length > 0)
                ? item.brandEntries
                : [{ brandName: item.brand || '-', quantity: item.quantity, rate: item.rate || item.unitPrice || item.price || 0, amount: item.amount || item.totalAmount || item.total || 0 }];

            return entries.map((entry, subIdx) => {
                const qty = parseFloat(entry.quantity || item.quantity || 0);
                const prc = entry.rate !== undefined && entry.rate !== '' && entry.rate !== null ? parseFloat(entry.rate) : parseFloat(entry.unitPrice || entry.price || item.rate || item.unitPrice || item.price || 0);
                const tot = entry.amount !== undefined && entry.amount !== '' && entry.amount !== null ? parseFloat(entry.amount) : (entry.totalAmount !== undefined ? parseFloat(entry.totalAmount) : (entry.total !== undefined ? parseFloat(entry.total) : (item.amount || item.totalAmount || item.total || (qty * prc))));

                return {
                    productName: resolveProductName(item.productName || item.product || '-'),
                    brand: entry.brandName || entry.brand || item.brand || '-',
                    quantity: qty,
                    bag: entry.bag || item.bag || 0,
                    truck: entry.truck || sale.truck || '-',
                    price: prc,
                    total: tot,
                    lcNo: entry.lcNo || entry.lcNumber || item.lcNo || item.lcNumber || sale.lcNo || sale.lcNumber || '-',
                    uom: entry.uom || item.uom || 'QTY',
                    isFirstInProduct: subIdx === 0,
                    productSpan: entries.length,
                    warehouseName: entry.warehouseName || item.warehouseName || sale.warehouseName || '-'
                };
            });
        });

        if (flatItems.length === 0) {
            const qty = parseFloat(sale.quantity || 0);
            const prc = parseFloat(sale.rate || sale.unitPrice || sale.price || 0);
            const tot = parseFloat(sale.amount || sale.totalAmount || sale.total || (qty * prc));
            flatItems.push({
                productName: resolveProductName(sale.productName || '-'),
                brand: sale.brand || '-',
                quantity: qty,
                bag: sale.bag || 0,
                price: prc,
                total: tot,
                lcNo: sale.lcNo || sale.lcNumber || '-',
                uom: sale.uom || 'QTY',
                isFirstInProduct: true,
                productSpan: 1,
                warehouseName: sale.warehouseName || '-'
            });
        }

        // Filter flat items based on search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            flatItems = flatItems.filter(item => {
                return (
                    (item.productName || '').toLowerCase().includes(query) ||
                    (item.brand || '').toLowerCase().includes(query) ||
                    (item.lcNo || '').toLowerCase().includes(query) ||
                    (item.truck || '').toLowerCase().includes(query)
                );
            });
        }

        // Apply specific saleFilters
        if (saleFilters.productName) {
            flatItems = flatItems.filter(item => item.productName === saleFilters.productName);
        }
        if (saleFilters.brandName) {
            flatItems = flatItems.filter(item => item.brand === saleFilters.brandName);
        }
        if (saleFilters.lcNo) {
            flatItems = flatItems.filter(item => (item.lcNo || '').toLowerCase().includes(saleFilters.lcNo.toLowerCase().trim()));
        }

        // Recalculate spans and first flags for rendering
        const productGroups = {};
        flatItems.forEach(item => {
            if (!productGroups[item.productName]) {
                productGroups[item.productName] = [];
            }
            productGroups[item.productName].push(item);
        });

        const recalculatedFlatItems = [];
        Object.keys(productGroups).forEach(prodName => {
            const group = productGroups[prodName];
            group.forEach((item, subIdx) => {
                recalculatedFlatItems.push({
                    ...item,
                    isFirstInProduct: subIdx === 0,
                    productSpan: group.length
                });
            });
        });

        return {
            ...sale,
            location: getCustomerLocation(sale),
            flatItems: recalculatedFlatItems
        };
    }).filter(sale => sale.flatItems.length > 0);

    const summary = {
        totalQty: salesWithItems.reduce((sum, sale) => {
            return sum + sale.flatItems.reduce((fSum, item) => fSum + (parseFloat(item.quantity) || 0), 0);
        }, 0),
        totalTrucks: saleType === 'Border' ? salesWithItems.reduce((sum, sale) => {
            return sum + sale.flatItems.reduce((fSum, item) => fSum + (parseFloat(item.truck) || 0), 0);
        }, 0) : 0,
        totalAmount: salesWithItems.reduce((sum, sale) => {
            return sum + sale.flatItems.reduce((fSum, item) => fSum + (parseFloat(item.total) || 0), 0);
        }, 0),
        totalPaid: salesWithItems.reduce((sum, sale) => sum + (parseFloat(sale.paidAmount) || 0), 0)
    };

    const toggleRowExpansion = (id) => {
        setExpandedRows(prev => prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]);
    };

    const productWiseList = (() => {
        const map = {};
        salesWithItems.forEach(sale => {
            (sale.flatItems || []).forEach(item => {
                const prod = (item.productName || '-').trim();
                const brand = (item.brand || '-').trim();
                if (!map[prod]) map[prod] = {};
                if (!map[prod][brand]) {
                    map[prod][brand] = {
                        productName: prod,
                        brand: brand,
                        bag: 0,
                        quantity: 0,
                        total: 0
                    };
                }
                map[prod][brand].bag += (parseFloat(item.bag) || 0);
                map[prod][brand].quantity += (parseFloat(item.quantity) || 0);
                map[prod][brand].total += (parseFloat(item.total) || 0);
            });
        });

        const result = [];
        const sortedProducts = Object.keys(map).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

        sortedProducts.forEach(prodName => {
            const brandEntries = Object.values(map[prodName]).sort((a, b) => a.brand.localeCompare(b.brand, undefined, { sensitivity: 'base' }));
            brandEntries.forEach((entry, bIdx) => {
                result.push({
                    ...entry,
                    isFirstInProduct: bIdx === 0,
                    productSpan: brandEntries.length
                });
            });
        });

        return result;
    })();

    const productWiseTotals = productWiseList.reduce((acc, item) => {
        acc.totalBags += (parseFloat(item.bag) || 0);
        acc.totalQty += (parseFloat(item.quantity) || 0);
        acc.totalAmount += (parseFloat(item.total) || 0);
        return acc;
    }, { totalBags: 0, totalQty: 0, totalAmount: 0 });

    const lcWiseList = (() => {
        const map = {};

        // 1. Process Stock (Purchases)
        activeStockRecords.forEach(s => {
            if (s.status && s.status.toLowerCase() === 'rejected') return;
            const lc = (s.lcNo || s.lcNumber || '').trim();
            if (!lc || lc === '-' || lc.toLowerCase() === 'null' || lc.toLowerCase() === 'undefined') return;

            // Filter stock purchases by selected filter option (all, weekly, monthly, yearly, date range)
            if (!checkDateMatchesFilter(s.date, s.createdAt)) return;

            const prod = resolveProductName(s.productName || s.product || '-').trim();
            const brand = (s.brand || '-').trim();

            if (saleFilters.productName && prod.toLowerCase() !== saleFilters.productName.trim().toLowerCase()) return;
            if (saleFilters.brand && brand.toLowerCase() !== saleFilters.brand.trim().toLowerCase()) return;
            if (saleFilters.lcNo && !lc.toLowerCase().includes(saleFilters.lcNo.trim().toLowerCase())) return;

            const query = (searchQuery || '').toLowerCase().trim();
            if (query && !lc.toLowerCase().includes(query) && !prod.toLowerCase().includes(query) && !brand.toLowerCase().includes(query)) return;

            const key = `${lc}___${prod}___${brand}`.toLowerCase();
            if (!map[key]) {
                map[key] = {
                    lcNo: lc,
                    product: prod,
                    brand: brand,
                    pBag: 0,
                    pQty: 0,
                    sBag: 0,
                    sQty: 0
                };
            }
            map[key].pBag += (parseFloat(s.packet || s.bag) || 0);
            map[key].pQty += (parseFloat(s.quantity) || 0);
        });

        // 2. Process Sales
        salesWithItems.forEach(sale => {
            (sale.flatItems || []).forEach(item => {
                const lc = (item.lcNo || '').trim();
                if (!lc || lc === '-' || lc.toLowerCase() === 'null' || lc.toLowerCase() === 'undefined') return;

                const prod = resolveProductName(item.productName || '-').trim();
                const brand = (item.brand || '-').trim();

                if (saleFilters.productName && prod.toLowerCase() !== saleFilters.productName.trim().toLowerCase()) return;
                if (saleFilters.brand && brand.toLowerCase() !== saleFilters.brand.trim().toLowerCase()) return;
                if (saleFilters.lcNo && !lc.toLowerCase().includes(saleFilters.lcNo.trim().toLowerCase())) return;

                const query = (searchQuery || '').toLowerCase().trim();
                if (query && !lc.toLowerCase().includes(query) && !prod.toLowerCase().includes(query) && !brand.toLowerCase().includes(query)) return;

                const key = `${lc}___${prod}___${brand}`.toLowerCase();
                if (!map[key]) {
                    map[key] = {
                        lcNo: lc,
                        product: prod,
                        brand: brand,
                        pBag: 0,
                        pQty: 0,
                        sBag: 0,
                        sQty: 0
                    };
                }
                map[key].sBag += (parseFloat(item.bag) || 0);
                map[key].sQty += (parseFloat(item.quantity) || 0);
            });
        });

        const groupedByLc = {};
        Object.values(map).forEach(row => {
            const lcKey = row.lcNo.toUpperCase();
            if (!groupedByLc[lcKey]) groupedByLc[lcKey] = [];
            const saleable = getSaleableStock(row.lcNo, row.product, row.brand);
            groupedByLc[lcKey].push({
                ...row,
                rBag: saleable.saleablePkt,
                rQty: saleable.saleableQty
            });
        });

        const sortedLcKeys = Object.keys(groupedByLc).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        const result = [];
        sortedLcKeys.forEach(lcKey => {
            const lcRows = groupedByLc[lcKey];
            lcRows.sort((a, b) => {
                const pComp = a.product.localeCompare(b.product, undefined, { sensitivity: 'base' });
                if (pComp !== 0) return pComp;
                return a.brand.localeCompare(b.brand, undefined, { sensitivity: 'base' });
            });

            const prodCounts = {};
            lcRows.forEach(r => {
                prodCounts[r.product] = (prodCounts[r.product] || 0) + 1;
            });
            const prodSeen = {};

            lcRows.forEach((row, idx) => {
                const isFirstInProd = !prodSeen[row.product];
                prodSeen[row.product] = true;

                result.push({
                    ...row,
                    isFirstInLc: idx === 0,
                    lcSpan: lcRows.length,
                    isFirstInProduct: isFirstInProd,
                    productSpan: prodCounts[row.product]
                });
            });
        });

        return result;
    })();

    const lcWiseTotals = lcWiseList.reduce((acc, item) => {
        acc.pBag += (parseFloat(item.pBag) || 0);
        acc.pQty += (parseFloat(item.pQty) || 0);
        acc.sBag += (parseFloat(item.sBag) || 0);
        acc.sQty += (parseFloat(item.sQty) || 0);
        acc.rBag += (parseFloat(item.rBag) || 0);
        acc.rQty += (parseFloat(item.rQty) || 0);
        return acc;
    }, { pBag: 0, pQty: 0, sBag: 0, sQty: 0, rBag: 0, rQty: 0 });

    if (typeof document === 'undefined' || !document.body) return null;
    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:backdrop-none app-modal-overlay">
            <div className="bg-white w-full max-w-[96vw] xl:max-w-[94vw] 2xl:max-w-[1700px] max-h-[92vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col print:max-h-none print:shadow-none print:rounded-none print:w-full print:h-auto">
                {/* Modal Header/Toolbar */}
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between px-4 sm:px-8 py-3 sm:py-4 border-b border-gray-100 print:hidden gap-2.5 sm:gap-2">
                    {/* Left: Title */}
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 order-1 sm:order-1 sm:flex-1 sm:justify-start">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-blue-50 rounded-lg sm:rounded-xl">
                            <BarChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                        </div>
                        <h3 className="text-base sm:text-xl font-black text-gray-800 truncate leading-none">
                            {reportTab === 'lc_wise'
                                ? 'LC Wise Sales Report'
                                : reportTab === 'product_wise'
                                ? 'Product Wise Sales Report'
                                : saleType === 'Order' ? 'Order Report' : `${saleType} Sales Report`}
                        </h3>
                    </div>

                    {/* Center: Buttons (General, Product Wise, LC Wise) */}
                    <div className="w-full sm:w-auto order-3 sm:order-2 sm:flex-shrink-0 flex items-center justify-center">
                        <div className="flex items-center p-0.5 sm:p-1 bg-gray-100/80 rounded-xl border border-gray-200/80 shadow-inner">
                            <button
                                type="button"
                                onClick={() => setReportTab('general')}
                                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                    reportTab === 'general'
                                        ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                                        : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                General
                            </button>
                            <button
                                type="button"
                                onClick={() => setReportTab('product_wise')}
                                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                    reportTab === 'product_wise'
                                        ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                                        : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                Product Wise
                            </button>
                            <button
                                type="button"
                                onClick={() => setReportTab('lc_wise')}
                                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                    reportTab === 'lc_wise'
                                        ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                                        : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                LC Wise
                            </button>
                        </div>
                    </div>

                    {/* Right: Action Buttons */}
                    <div className="flex items-center justify-end gap-1.5 sm:gap-3 order-2 sm:order-3 sm:flex-1">
                        <div className="relative flex items-center">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-xl transition-all border ${showFilterPanel || hasActiveFilters
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30'
                                    }`}
                            >
                                <FunnelIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${showFilterPanel || hasActiveFilters ? 'text-white' : 'text-gray-400'}`} />
                            </button>

                            {/* Floating Filter Panel */}
                            {showFilterPanel && (
                                <>
                                    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[2005] md:hidden" onClick={() => setShowFilterPanel(false)} />
                                    <div ref={filterPanelRef} className={`fixed inset-x-4 top-24 md:absolute md:top-full md:left-auto md:right-0 md:mt-2 w-auto md:w-84 bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[2010] p-4 flex flex-col animate-in fade-in zoom-in-95 duration-200 ${Object.values(filterDropdownOpen).some(Boolean) ? 'overflow-visible' : 'max-h-[calc(90vh-100px)] overflow-y-auto custom-scrollbar'}`}>
                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 flex-shrink-0">
                                            <h4 className="font-bold text-gray-900 text-sm">Advance Filter</h4>
                                            <button
                                                onClick={() => {
                                                    localStorage.setItem('sale_quick_range_default', 'all');
                                                    setSaleFilters({
                                                        quickRange: 'all',
                                                        selectedMonth: new Date().getMonth() + 1,
                                                        selectedYear: new Date().getFullYear(),
                                                        startDate: '',
                                                        endDate: '',
                                                        companyName: '',
                                                        invoiceNo: '',
                                                        lcNo: '',
                                                        productName: '',
                                                        brandName: '',
                                                        port: '',
                                                        indCnf: '',
                                                        bdCnf: ''
                                                    });
                                                    setFilterSearchInputs({ companySearch: '', invoiceSearch: '', lcSearch: '', productSearch: '', brandSearch: '', portSearch: '', indCnfSearch: '', bdCnfSearch: '' });
                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                }}
                                                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                                            >
                                                Reset
                                            </button>
                                        </div>

                                        <div className="space-y-3 flex-1 pr-0.5">
                                            {/* Quick Range */}
                                            <div className="space-y-2 text-center">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block font-mono">QUICK RANGE</label>
                                                <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
                                                    {['all', 'weekly', 'monthly', 'yearly'].map(range => (
                                                        <button
                                                            key={range}
                                                            type="button"
                                                            onClick={() => {
                                                                localStorage.setItem('sale_quick_range_default', range);
                                                                setSaleFilters(prev => ({ ...prev, quickRange: range, startDate: '', endDate: '' }));
                                                            }}
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
                                                            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                                        >
                                                            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                                                                <option key={i + 1} value={i + 1}>{m}</option>
                                                            ))}
                                                        </select>
                                                        <select
                                                            value={saleFilters.selectedYear || new Date().getFullYear()}
                                                            onChange={(e) => setSaleFilters(prev => ({ ...prev, selectedYear: parseInt(e.target.value) }))}
                                                            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
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
                                                            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                                        >
                                                            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                                                <option key={y} value={y}>{y}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <div ref={fromDateFilterRef}>
                                                    <CustomDatePicker
                                                        label="From Date"
                                                        value={saleFilters.startDate}
                                                        onChange={(e) => setSaleFilters(prev => ({ ...prev, startDate: e.target.value, quickRange: 'custom' }))}
                                                        compact={true}
                                                        isOpen={filterDropdownOpen.from}
                                                        onToggle={(val) => setFilterDropdownOpen(prev => ({ ...prev, from: val }))}
                                                    />
                                                </div>
                                                <div ref={toDateFilterRef}>
                                                    <CustomDatePicker
                                                        label="To Date"
                                                        value={saleFilters.endDate}
                                                        onChange={(e) => setSaleFilters(prev => ({ ...prev, endDate: e.target.value, quickRange: 'custom' }))}
                                                        compact={true}
                                                        isOpen={filterDropdownOpen.to}
                                                        onToggle={(val) => setFilterDropdownOpen(prev => ({ ...prev, to: val }))}
                                                    />
                                                </div>
                                            </div>

                                            {saleType === 'Border' ? (
                                                <>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {/* Company Selection - Party Name */}
                                                        <div className={`space-y-1.5 relative ${filterDropdownOpen.company ? 'z-50' : 'z-10'}`} ref={companyFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">PARTY NAME</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={filterSearchInputs.companySearch}
                                                                    onChange={(e) => {
                                                                        setFilterSearchInputs({ ...filterSearchInputs, companySearch: e.target.value });
                                                                        setSaleFilters(prev => ({ ...prev, companyName: e.target.value }));
                                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, company: true });
                                                                    }}
                                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, company: true })}
                                                                    placeholder={saleFilters.companyName || "Search Party..."}
                                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.companyName ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                                />
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                    {saleFilters.companyName && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSaleFilters(prev => ({ ...prev, companyName: '' }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, companySearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                        >
                                                                            <XIcon className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                            {filterDropdownOpen.company && (() => {
                                                                const options = getUniqueOptions('companyName');
                                                                const filtered = options.filter(c => c.toLowerCase().includes(filterSearchInputs.companySearch.toLowerCase()));
                                                                return filtered.length > 0 ? (
                                                                    <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        {filtered.map(c => (
                                                                            <button
                                                                                key={c}
                                                                                type="button"
                                                                                onMouseDown={(e) => {
                                                                                    e.preventDefault();
                                                                                    setSaleFilters(prev => ({ ...prev, companyName: c }));
                                                                                    setFilterSearchInputs(prev => ({ ...prev, companySearch: '' }));
                                                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                                                }}
                                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                            >
                                                                                {c}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                        </div>

                                                        {/* Port Filter */}
                                                        <div className={`space-y-1.5 relative ${filterDropdownOpen.port ? 'z-50' : 'z-10'}`} ref={portFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">PORT</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={filterSearchInputs.portSearch}
                                                                    onChange={(e) => {
                                                                        setFilterSearchInputs({ ...filterSearchInputs, portSearch: e.target.value });
                                                                        setSaleFilters(prev => ({ ...prev, port: e.target.value }));
                                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, port: true });
                                                                    }}
                                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, port: true })}
                                                                    placeholder={saleFilters.port || "Search Port..."}
                                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.port ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                                />
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                    {saleFilters.port && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSaleFilters(prev => ({ ...prev, port: '' }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, portSearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                        >
                                                                            <XIcon className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                            {filterDropdownOpen.port && (() => {
                                                                const options = getUniqueOptions('port');
                                                                const filtered = options.filter(p => p.toLowerCase().includes(filterSearchInputs.portSearch.toLowerCase()));
                                                                return filtered.length > 0 ? (
                                                                    <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        {filtered.map(p => (
                                                                            <button
                                                                                key={p}
                                                                                type="button"
                                                                                onMouseDown={(e) => {
                                                                                    e.preventDefault();
                                                                                    setSaleFilters(prev => ({ ...prev, port: p }));
                                                                                    setFilterSearchInputs(prev => ({ ...prev, portSearch: '' }));
                                                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                                                }}
                                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                            >
                                                                                {p}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        {/* IND C&F Filter */}
                                                        <div className={`space-y-1.5 relative ${filterDropdownOpen.indCnf ? 'z-50' : 'z-10'}`} ref={indCnfFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">IND C&F</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={filterSearchInputs.indCnfSearch}
                                                                    onChange={(e) => {
                                                                        setFilterSearchInputs({ ...filterSearchInputs, indCnfSearch: e.target.value });
                                                                        setSaleFilters(prev => ({ ...prev, indCnf: e.target.value }));
                                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, indCnf: true });
                                                                    }}
                                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, indCnf: true })}
                                                                    placeholder={saleFilters.indCnf || "Search IND C&F..."}
                                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.indCnf ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                                />
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                    {saleFilters.indCnf && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSaleFilters(prev => ({ ...prev, indCnf: '' }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, indCnfSearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                        >
                                                                            <XIcon className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                            {filterDropdownOpen.indCnf && (() => {
                                                                const options = getUniqueOptions('indianCnF');
                                                                const filtered = options.filter(ic => ic.toLowerCase().includes(filterSearchInputs.indCnfSearch.toLowerCase()));
                                                                return filtered.length > 0 ? (
                                                                    <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        {filtered.map(ic => (
                                                                            <button
                                                                                key={ic}
                                                                                type="button"
                                                                                onMouseDown={(e) => {
                                                                                    e.preventDefault();
                                                                                    setSaleFilters(prev => ({ ...prev, indCnf: ic }));
                                                                                    setFilterSearchInputs(prev => ({ ...prev, indCnfSearch: '' }));
                                                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                                                }}
                                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                            >
                                                                                {ic}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                        </div>

                                                        {/* BD C&F Filter */}
                                                        <div className={`space-y-1.5 relative ${filterDropdownOpen.bdCnf ? 'z-50' : 'z-10'}`} ref={bdCnfFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">BD C&F</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={filterSearchInputs.bdCnfSearch}
                                                                    onChange={(e) => {
                                                                        setFilterSearchInputs({ ...filterSearchInputs, bdCnfSearch: e.target.value });
                                                                        setSaleFilters(prev => ({ ...prev, bdCnf: e.target.value }));
                                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, bdCnf: true });
                                                                    }}
                                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, bdCnf: true })}
                                                                    placeholder={saleFilters.bdCnf || "Search BD C&F..."}
                                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.bdCnf ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                                />
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                    {saleFilters.bdCnf && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSaleFilters(prev => ({ ...prev, bdCnf: '' }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, bdCnfSearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                        >
                                                                            <XIcon className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                            {filterDropdownOpen.bdCnf && (() => {
                                                                const options = getUniqueOptions('bdCnf');
                                                                const filtered = options.filter(bc => bc.toLowerCase().includes(filterSearchInputs.bdCnfSearch.toLowerCase()));
                                                                return filtered.length > 0 ? (
                                                                    <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        {filtered.map(bc => (
                                                                            <button
                                                                                key={bc}
                                                                                type="button"
                                                                                onMouseDown={(e) => {
                                                                                    e.preventDefault();
                                                                                    setSaleFilters(prev => ({ ...prev, bdCnf: bc }));
                                                                                    setFilterSearchInputs(prev => ({ ...prev, bdCnfSearch: '' }));
                                                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                                                }}
                                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                            >
                                                                                {bc}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                        </div>
                                                    </div>

                                                    {/* Product Selection */}
                                                    <div className={`space-y-1.5 relative ${filterDropdownOpen.product ? 'z-50' : 'z-10'}`} ref={productFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">PRODUCT</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={filterSearchInputs.productSearch}
                                                                onChange={(e) => {
                                                                    setFilterSearchInputs({ ...filterSearchInputs, productSearch: e.target.value });
                                                                    setSaleFilters(prev => ({ ...prev, productName: e.target.value }));
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, product: true });
                                                                }}
                                                                onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, product: true })}
                                                                placeholder={saleFilters.productName || "Search Product..."}
                                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.productName ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                {saleFilters.productName && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSaleFilters(prev => ({ ...prev, productName: '' }));
                                                                            setFilterSearchInputs(prev => ({ ...prev, productSearch: '' }));
                                                                            setFilterDropdownOpen(initialFilterDropdownState);
                                                                        }}
                                                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                    >
                                                                        <XIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                        {filterDropdownOpen.product && (() => {
                                                            const options = getUniqueOptions('productName');
                                                            const filtered = options.filter(p => p.toLowerCase().includes(filterSearchInputs.productSearch.toLowerCase()));
                                                            return filtered.length > 0 ? (
                                                                <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                    {filtered.map(p => (
                                                                        <button
                                                                            key={p}
                                                                            type="button"
                                                                            onMouseDown={(e) => {
                                                                                e.preventDefault();
                                                                                setSaleFilters(prev => ({ ...prev, productName: p }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, productSearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            {p}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    {/* Company Selection - General */}
                                                    <div className={`space-y-1.5 relative ${filterDropdownOpen.company ? 'z-50' : 'z-10'}`} ref={companyFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">CUSTOMER NAME</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={filterSearchInputs.companySearch}
                                                                onChange={(e) => {
                                                                    setFilterSearchInputs({ ...filterSearchInputs, companySearch: e.target.value });
                                                                    setSaleFilters(prev => ({ ...prev, companyName: e.target.value }));
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, company: true });
                                                                }}
                                                                onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, company: true })}
                                                                placeholder={saleFilters.companyName || "Search Customer..."}
                                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.companyName ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                {saleFilters.companyName && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSaleFilters(prev => ({ ...prev, companyName: '' }));
                                                                            setFilterSearchInputs(prev => ({ ...prev, companySearch: '' }));
                                                                            setFilterDropdownOpen(initialFilterDropdownState);
                                                                        }}
                                                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                    >
                                                                        <XIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                        {filterDropdownOpen.company && (() => {
                                                            const options = getUniqueOptions('companyName');
                                                            const filtered = options.filter(c => c.toLowerCase().includes(filterSearchInputs.companySearch.toLowerCase()));
                                                            return filtered.length > 0 ? (
                                                                <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                    {filtered.map(c => (
                                                                        <button
                                                                            key={c}
                                                                            type="button"
                                                                            onMouseDown={(e) => {
                                                                                e.preventDefault();
                                                                                setSaleFilters(prev => ({ ...prev, companyName: c }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, companySearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            {c}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>

                                                    {/* Invoice No Selection - General only */}
                                                    <div className={`space-y-1.5 relative ${filterDropdownOpen.invoice ? 'z-50' : 'z-10'}`} ref={invoiceFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">INVOICE NO</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={filterSearchInputs.invoiceSearch}
                                                                onChange={(e) => {
                                                                    setFilterSearchInputs({ ...filterSearchInputs, invoiceSearch: e.target.value });
                                                                    setSaleFilters(prev => ({ ...prev, invoiceNo: e.target.value }));
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, invoice: true });
                                                                }}
                                                                onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, invoice: true })}
                                                                placeholder={saleFilters.invoiceNo || (saleType === 'Order' ? "Search Order No..." : "Search Invoice...")}
                                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.invoiceNo ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                {saleFilters.invoiceNo && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSaleFilters(prev => ({ ...prev, invoiceNo: '' }));
                                                                            setFilterSearchInputs(prev => ({ ...prev, invoiceSearch: '' }));
                                                                            setFilterDropdownOpen(initialFilterDropdownState);
                                                                        }}
                                                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                    >
                                                                        <XIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                        {filterDropdownOpen.invoice && (() => {
                                                            const options = getUniqueOptions('invoiceNo');
                                                            const filtered = options.filter(i => i.toLowerCase().includes(filterSearchInputs.invoiceSearch.toLowerCase()));
                                                            return filtered.length > 0 ? (
                                                                <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                    {filtered.map(i => (
                                                                        <button
                                                                            key={i}
                                                                            type="button"
                                                                            onMouseDown={(e) => {
                                                                                e.preventDefault();
                                                                                setSaleFilters(prev => ({ ...prev, invoiceNo: i }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, invoiceSearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            {i}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>

                                                    {/* LC No Selection */}
                                                    <div className={`space-y-1.5 relative ${filterDropdownOpen.lc ? 'z-50' : 'z-10'}`} ref={lcFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">LC NO</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={filterSearchInputs.lcSearch}
                                                                onChange={(e) => {
                                                                    setFilterSearchInputs({ ...filterSearchInputs, lcSearch: e.target.value });
                                                                    setSaleFilters(prev => ({ ...prev, lcNo: e.target.value }));
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, lc: true });
                                                                }}
                                                                onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, lc: true })}
                                                                placeholder={saleFilters.lcNo || "Search LC No..."}
                                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.lcNo ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                {saleFilters.lcNo && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSaleFilters(prev => ({ ...prev, lcNo: '' }));
                                                                            setFilterSearchInputs(prev => ({ ...prev, lcSearch: '' }));
                                                                            setFilterDropdownOpen(initialFilterDropdownState);
                                                                        }}
                                                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                    >
                                                                        <XIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                        {filterDropdownOpen.lc && (() => {
                                                            const options = getUniqueOptions('lcNo');
                                                            const filtered = options.filter(l => l.toLowerCase().includes(filterSearchInputs.lcSearch.toLowerCase()));
                                                            return filtered.length > 0 ? (
                                                                <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                    {filtered.map(l => (
                                                                        <button
                                                                            key={l}
                                                                            type="button"
                                                                            onMouseDown={(e) => {
                                                                                e.preventDefault();
                                                                                setSaleFilters(prev => ({ ...prev, lcNo: l }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, lcSearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            {l}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>

                                                    {/* Product Selection - General */}
                                                    <div className={`space-y-1.5 relative ${filterDropdownOpen.product ? 'z-50' : 'z-10'}`} ref={productFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">PRODUCT</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={filterSearchInputs.productSearch}
                                                                onChange={(e) => {
                                                                    setFilterSearchInputs({ ...filterSearchInputs, productSearch: e.target.value });
                                                                    setSaleFilters(prev => ({ ...prev, productName: e.target.value }));
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, product: true });
                                                                }}
                                                                onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, product: true })}
                                                                placeholder={saleFilters.productName || "Search Product..."}
                                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.productName ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                {saleFilters.productName && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSaleFilters(prev => ({ ...prev, productName: '' }));
                                                                            setFilterSearchInputs(prev => ({ ...prev, productSearch: '' }));
                                                                            setFilterDropdownOpen(initialFilterDropdownState);
                                                                        }}
                                                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                    >
                                                                        <XIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                        {filterDropdownOpen.product && (() => {
                                                            const options = getUniqueOptions('productName');
                                                            const filtered = options.filter(p => p.toLowerCase().includes(filterSearchInputs.productSearch.toLowerCase()));
                                                            return filtered.length > 0 ? (
                                                                <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                    {filtered.map(p => (
                                                                        <button
                                                                            key={p}
                                                                            type="button"
                                                                            onMouseDown={(e) => {
                                                                                e.preventDefault();
                                                                                setSaleFilters(prev => ({ ...prev, productName: p }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, productSearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            {p}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>

                                                    {/* Brand Selection - General only */}
                                                    <div className={`space-y-1.5 relative ${filterDropdownOpen.brand ? 'z-50' : 'z-10'}`} ref={brandFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-mono">BRAND</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={filterSearchInputs.brandSearch}
                                                                onChange={(e) => {
                                                                    setFilterSearchInputs({ ...filterSearchInputs, brandSearch: e.target.value });
                                                                    setSaleFilters(prev => ({ ...prev, brandName: e.target.value }));
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true });
                                                                }}
                                                                onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true })}
                                                                placeholder={saleFilters.brandName || "Search Brand..."}
                                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${saleFilters.brandName ? 'placeholder:text-gray-900 placeholder:font-semibold text-gray-900 font-semibold' : 'placeholder:text-gray-300'}`}
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                {saleFilters.brandName && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSaleFilters(prev => ({ ...prev, brandName: '' }));
                                                                            setFilterSearchInputs(prev => ({ ...prev, brandSearch: '' }));
                                                                            setFilterDropdownOpen(initialFilterDropdownState);
                                                                        }}
                                                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                                                    >
                                                                        <XIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                        {filterDropdownOpen.brand && (() => {
                                                            const options = getUniqueOptions('brandName');
                                                            const filtered = options.filter(b => b.toLowerCase().includes(filterSearchInputs.brandSearch.toLowerCase()));
                                                            return filtered.length > 0 ? (
                                                                <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                    {filtered.map(b => (
                                                                        <button
                                                                            key={b}
                                                                            type="button"
                                                                            onMouseDown={(e) => {
                                                                                e.preventDefault();
                                                                                setSaleFilters(prev => ({ ...prev, brandName: b }));
                                                                                setFilterSearchInputs(prev => ({ ...prev, brandSearch: '' }));
                                                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            {b}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>
                                                </>
                                            )}

                                            <button onClick={() => setShowFilterPanel(false)} className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all mt-3 flex-shrink-0 active:scale-[0.98]">APPLY FILTERS</button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <button onClick={() => generateSalesReportPDF(salesWithItems, saleFilters, summary, saleType, reportTab, productWiseList, productWiseTotals, lcWiseList, lcWiseTotals)} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg sm:rounded-xl shadow-lg shadow-blue-500/30 transition-all no-print">
                            <PrinterIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </button>
                        <button onClick={onClose} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg sm:rounded-xl transition-colors no-print"><XIcon className="w-4 h-4 sm:w-6 sm:h-6 text-gray-500" /></button>
                    </div>
                </div>

                {/* Printable Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 print:p-4 print:overflow-visible bg-white">
                    <div className="w-full mx-auto space-y-3 sm:space-y-4">
                        {/* Header matching Stock Report layout */}
                        <div className="flex justify-between items-center pb-1">
                            {/* Left: Logo & Company Name */}
                            <div className="flex items-center gap-3">
                                <img src="/logo.png" alt="ANI Enterprise Logo" className="w-12 h-12 sm:w-14 sm:h-14 object-contain flex-shrink-0" />
                                <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ fontFamily: "'Fraunces', serif", color: '#f97316', textShadow: '1px 2px 4px rgba(0, 0, 0, 0.15)' }}>
                                    ANI ENTERPRISE
                                </h1>
                            </div>

                            {/* Right: Address Info */}
                            <div className="text-right text-[11px] sm:text-[12px] text-gray-700 leading-tight">
                                <p className="font-semibold text-gray-800">766, H.M Tower, Level-06</p>
                                <p>Borogola, Bogura, Bangladesh</p>
                                <p>Tel: +8802588813057</p>
                                <p>Email: anienterprise051@gmail.com</p>
                            </div>
                        </div>

                        {/* Orange Divider Line */}
                        <div className="border-t-2 border-[#f97316] w-full mt-3"></div>

                        {/* Centered Title Badge */}
                        <div className="flex justify-center -mt-5">
                            <div className="bg-[#f97316] text-white px-8 py-1 rounded shadow-sm">
                                <h2 className="text-xs sm:text-sm font-bold tracking-wider uppercase">
                                    {reportTab === 'lc_wise'
                                        ? 'LC WISE SALES REPORT'
                                        : reportTab === 'product_wise'
                                        ? 'PRODUCT WISE SALES REPORT'
                                        : saleType === 'Order' ? 'ORDER REPORT' : `${saleType.toUpperCase()} SALES REPORT`}
                                </h2>
                            </div>
                        </div>

                        <div className="flex justify-between items-end text-[14px] text-gray-800 pt-2 px-2">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex"><span className="font-bold text-gray-900 w-28">Date Range:</span> <span className="text-gray-900">{getDateRangeDisplay()}</span></div>
                                {saleFilters.companyName && <div className="flex"><span className="font-bold text-gray-900 w-28">Customer:</span> <span className="text-gray-900">{saleFilters.companyName}</span></div>}
                                {saleFilters.lcNo && <div className="flex"><span className="font-bold text-gray-900 w-28">LC No:</span> <span className="text-gray-900">{saleFilters.lcNo}</span></div>}
                            </div>
                            <div className="font-bold"><span className="text-gray-900">Printed on:</span> <span className="text-gray-900">{formatDate(new Date().toISOString().split('T')[0])}</span></div>
                        </div>

                        {/* On-screen Quick Range Selector (Screen Only) */}
                        <div className="no-print print:hidden flex flex-wrap items-center justify-between gap-2 pt-1 pb-1 px-1">
                            <div className="flex items-center gap-1 bg-gray-100/90 p-1 rounded-xl border border-gray-200/80 shadow-inner">
                                {['all', 'weekly', 'monthly', 'yearly'].map(range => (
                                    <button
                                        key={range}
                                        type="button"
                                        onClick={() => {
                                            localStorage.setItem('sale_quick_range_default', range);
                                            setSaleFilters(prev => ({ ...prev, quickRange: range, startDate: '', endDate: '' }));
                                        }}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                            (saleFilters.quickRange || 'all') === range
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                                        }`}
                                    >
                                        {range === 'all' ? 'All' : range.charAt(0).toUpperCase() + range.slice(1)}
                                    </button>
                                ))}
                            </div>
                            {saleFilters.quickRange === 'monthly' && (
                                <div className="flex items-center gap-1.5 text-xs font-semibold">
                                    <span className="text-gray-500 font-bold uppercase text-[11px]">Month:</span>
                                    <select
                                        value={saleFilters.selectedMonth || new Date().getMonth() + 1}
                                        onChange={(e) => setSaleFilters(prev => ({ ...prev, selectedMonth: parseInt(e.target.value) }))}
                                        className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                                            <option key={i + 1} value={i + 1}>{m}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={saleFilters.selectedYear || new Date().getFullYear()}
                                        onChange={(e) => setSaleFilters(prev => ({ ...prev, selectedYear: parseInt(e.target.value) }))}
                                        className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        {[2024, 2025, 2026, 2027, 2028].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {saleFilters.quickRange === 'yearly' && (
                                <div className="flex items-center gap-1.5 text-xs font-semibold">
                                    <span className="text-gray-500 font-bold uppercase text-[11px]">Year:</span>
                                    <select
                                        value={saleFilters.selectedYear || new Date().getFullYear()}
                                        onChange={(e) => setSaleFilters(prev => ({ ...prev, selectedYear: parseInt(e.target.value) }))}
                                        className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        {[2024, 2025, 2026, 2027, 2028].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                                                        {/* Desktop Table View */}
                        <div className="hidden md:block print:block overflow-x-auto border border-gray-900">
                            <table className="w-full border-collapse">
                                {reportTab === 'lc_wise' ? (
                                    <>
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-900">
                                                <th rowSpan={2} className="border-r border-gray-900 px-1 py-1 text-center text-[11px] font-bold text-gray-900 uppercase w-[4%] align-middle whitespace-nowrap">Sl</th>
                                                <th rowSpan={2} className="border-r border-gray-900 px-2 py-1 text-center text-[11px] font-bold text-gray-900 uppercase w-[12%] align-middle whitespace-nowrap">LC No</th>
                                                <th rowSpan={2} className="border-r border-gray-900 px-2 py-1 text-left text-[11px] font-bold text-gray-900 uppercase w-[14%] align-middle whitespace-nowrap">Product</th>
                                                <th rowSpan={2} className="border-r border-gray-900 px-2 py-1 text-left text-[11px] font-bold text-gray-900 uppercase w-[14%] align-middle whitespace-nowrap">Brand</th>
                                                <th colSpan={2} className="border-r border-gray-900 px-2 py-1 text-center text-[11px] font-bold text-gray-900 uppercase w-[19%] border-b border-gray-900">Purchase</th>
                                                <th colSpan={2} className="border-r border-gray-900 px-2 py-1 text-center text-[11px] font-bold text-gray-900 uppercase w-[19%] border-b border-gray-900">Sales</th>
                                                <th colSpan={2} className="px-2 py-1 text-center text-[11px] font-bold text-gray-900 uppercase w-[18%] border-b border-gray-900">Remain</th>
                                            </tr>
                                            <tr className="bg-gray-50 border-b border-gray-900">
                                                <th className="border-r border-gray-900 px-1 py-1 text-right text-[10px] font-bold text-gray-900 uppercase w-[9%] whitespace-nowrap">Qty in Bag</th>
                                                <th className="border-r border-gray-900 px-1 py-1 text-right text-[10px] font-bold text-gray-900 uppercase w-[10%] whitespace-nowrap">Qty in KG</th>
                                                <th className="border-r border-gray-900 px-1 py-1 text-right text-[10px] font-bold text-gray-900 uppercase w-[9%] whitespace-nowrap">Qty in Bags</th>
                                                <th className="border-r border-gray-900 px-1 py-1 text-right text-[10px] font-bold text-gray-900 uppercase w-[10%] whitespace-nowrap">Qty in KG</th>
                                                <th className="border-r border-gray-900 px-1 py-1 text-right text-[10px] font-bold text-gray-900 uppercase w-[9%] whitespace-nowrap">Qty in Bags</th>
                                                <th className="px-1 py-1 text-right text-[10px] font-bold text-gray-900 uppercase w-[9%] whitespace-nowrap">Qty in KG</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-900">
                                            {lcWiseList.length > 0 ? (
                                                lcWiseList.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="border-r border-gray-900 px-1 py-1 text-center text-[12px] text-gray-900">{idx + 1}</td>
                                                        <td className="border-r border-gray-900 px-2 py-1 text-center text-[12px] font-bold text-gray-900 whitespace-nowrap">
                                                            {item.lcNo}
                                                        </td>
                                                        <td className="border-r border-gray-900 px-2 py-1 text-left text-[12px] font-semibold text-gray-900">
                                                            {item.product}
                                                        </td>
                                                        <td className="border-r border-gray-900 px-2 py-1 text-left text-[12px] text-gray-900">{item.brand || '-'}</td>
                                                        <td className="border-r border-gray-900 px-1 py-1 text-right font-medium text-[12px] text-gray-900">
                                                            {item.pBag > 0 ? Number(item.pBag.toFixed(2)).toLocaleString('en-US') : '-'}
                                                        </td>
                                                        <td className="border-r border-gray-900 px-1 py-1 text-right font-bold text-[12px] text-gray-900">
                                                            {item.pQty > 0 ? Number(item.pQty.toFixed(2)).toLocaleString('en-US') : '0'}
                                                        </td>
                                                        <td className="border-r border-gray-900 px-1 py-1 text-right font-medium text-[12px] text-gray-900">
                                                            {item.sBag > 0 ? Number(item.sBag.toFixed(2)).toLocaleString('en-US') : '-'}
                                                        </td>
                                                        <td className="border-r border-gray-900 px-1 py-1 text-right font-bold text-[12px] text-gray-900">
                                                            {item.sQty > 0 ? Number(item.sQty.toFixed(2)).toLocaleString('en-US') : '0'}
                                                        </td>
                                                        <td className={`border-r border-gray-900 px-1 py-1 text-right font-bold text-[12px] ${item.rBag < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                                            {item.rBag > 0 ? Number(item.rBag.toFixed(2)).toLocaleString('en-US') : '0'}
                                                        </td>
                                                        <td className={`px-1 py-1 text-right font-black text-[12px] ${item.rQty < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                                            {item.rQty > 0 ? Number(item.rQty.toFixed(2)).toLocaleString('en-US') : '0'}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="10" className="px-4 py-8 text-center text-gray-500 italic text-[12px]">
                                                        No LC records found for the selected criteria.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        {lcWiseList.length > 0 && (
                                            <tfoot>
                                                <tr className="bg-gray-100 border-t-2 border-gray-900 font-black text-gray-900 text-[12px]">
                                                    <td colSpan={4} className="px-3 py-2 text-right uppercase tracking-wider border-r border-gray-900">
                                                        Grand Total
                                                    </td>
                                                    <td className="px-1 py-2 text-right border-r border-gray-900">
                                                        {lcWiseTotals.pBag > 0 ? Number(lcWiseTotals.pBag.toFixed(2)).toLocaleString('en-US') : '-'}
                                                    </td>
                                                    <td className="px-1 py-2 text-right border-r border-gray-900">
                                                        {Number(lcWiseTotals.pQty.toFixed(2)).toLocaleString('en-US')}
                                                    </td>
                                                    <td className="px-1 py-2 text-right border-r border-gray-900">
                                                        {lcWiseTotals.sBag > 0 ? Number(lcWiseTotals.sBag.toFixed(2)).toLocaleString('en-US') : '-'}
                                                    </td>
                                                    <td className="px-1 py-2 text-right border-r border-gray-900">
                                                        {Number(lcWiseTotals.sQty.toFixed(2)).toLocaleString('en-US')}
                                                    </td>
                                                    <td className={`px-1 py-2 text-right border-r border-gray-900 ${lcWiseTotals.rBag < 0 ? 'text-red-600' : ''}`}>
                                                        {Number(lcWiseTotals.rBag.toFixed(2)).toLocaleString('en-US')}
                                                    </td>
                                                    <td className={`px-1 py-2 text-right ${lcWiseTotals.rQty < 0 ? 'text-red-600' : ''}`}>
                                                        {Number(lcWiseTotals.rQty.toFixed(2)).toLocaleString('en-US')}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </>
                                ) : reportTab === 'product_wise' ? (
                                    <>
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-900">
                                                <th className="border-r border-gray-900 px-2 py-1.5 text-center text-[11px] font-bold text-gray-900 uppercase w-[6%] whitespace-nowrap">SL</th>
                                                <th className="border-r border-gray-900 px-3 py-1.5 text-left text-[11px] font-bold text-gray-900 uppercase w-[34%] whitespace-nowrap">Product</th>
                                                <th className="border-r border-gray-900 px-3 py-1.5 text-left text-[11px] font-bold text-gray-900 uppercase w-[24%] whitespace-nowrap">Brand</th>
                                                <th className="border-r border-gray-900 px-2 py-1.5 text-right text-[11px] font-bold text-gray-900 uppercase w-[12%] whitespace-nowrap">Bag</th>
                                                <th className="border-r border-gray-900 px-2 py-1.5 text-right text-[11px] font-bold text-gray-900 uppercase w-[12%] whitespace-nowrap">Qty</th>
                                                <th className="px-3 py-1.5 text-right text-[11px] font-bold text-gray-900 uppercase w-[12%] whitespace-nowrap">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-900">
                                            {(() => {
                                                let pSl = 1;
                                                return productWiseList.length > 0 ? (
                                                    productWiseList.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                            <td className="border-r border-gray-900 px-2 py-1 text-center text-[12px] text-gray-900">{pSl++}</td>
                                                            {item.isFirstInProduct ? (
                                                                <td rowSpan={item.productSpan} className="border-r border-gray-900 px-3 py-1 text-left text-[12px] font-bold text-gray-900 align-top bg-white">
                                                                    {item.productName}
                                                                </td>
                                                            ) : null}
                                                            <td className="border-r border-gray-900 px-3 py-1 text-left text-[12px] text-gray-900">{item.brand || '-'}</td>
                                                            <td className="border-r border-gray-900 px-2 py-1 text-right font-bold text-[12px] text-gray-900">
                                                                {item.bag > 0 ? item.bag.toLocaleString('en-US') : '-'}
                                                            </td>
                                                            <td className="border-r border-gray-900 px-2 py-1 text-right font-bold text-[12px] text-gray-900">
                                                                {parseFloat(item.quantity || 0).toLocaleString('en-US')}
                                                            </td>
                                                            <td className="px-3 py-1 text-right font-black text-[12px] text-gray-900">
                                                                ৳{parseFloat(item.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="6" className="px-4 py-8 text-center text-gray-500 italic text-[12px]">
                                                            No product records found for the selected criteria.
                                                        </td>
                                                    </tr>
                                                );
                                            })()}
                                        </tbody>
                                        {productWiseList.length > 0 && (
                                            <tfoot>
                                                <tr className="bg-gray-100 border-t-2 border-gray-900 font-black text-gray-900 text-[12px]">
                                                    <td colSpan="3" className="px-3 py-2 text-right uppercase tracking-wider border-r border-gray-900">Grand Total</td>
                                                    <td className="px-2 py-2 text-right border-r border-gray-900">
                                                        {productWiseTotals.totalBags > 0 ? productWiseTotals.totalBags.toLocaleString('en-US') : '-'}
                                                    </td>
                                                    <td className="px-2 py-2 text-right border-r border-gray-900">
                                                        {productWiseTotals.totalQty.toLocaleString('en-US')}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        ৳{productWiseTotals.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <thead>
                                    <tr className="bg-gray-50 border-b border-gray-900">
                                        {saleType === 'Order' ? (
                                            <>
                                                <th className="border-r border-gray-900 px-1 py-1.5 text-center text-[11px] font-bold text-gray-900 uppercase w-[4%] whitespace-nowrap">SL</th>
                                                <th className="border-r border-gray-900 px-1 py-1.5 text-center text-[11px] font-bold text-gray-900 uppercase w-[7%] whitespace-nowrap">Date</th>
                                                <th className="border-r border-gray-900 px-1 py-1.5 text-center text-[11px] font-bold text-gray-900 uppercase w-[9%] whitespace-nowrap">Order No</th>
                                                <th className="border-r border-gray-900 px-2 py-1.5 text-left text-[11px] font-bold text-gray-900 uppercase w-[11%] whitespace-nowrap">Company</th>
                                                <th className="border-r border-gray-900 px-2 py-1.5 text-left text-[11px] font-bold text-gray-900 uppercase w-[11%] whitespace-nowrap">Location</th>
                                                <th className="border-r border-gray-900 px-1 py-1.5 text-left text-[11px] font-bold text-gray-900 uppercase w-[8%] whitespace-nowrap">Warehouse</th>
                                                <th className="border-r border-gray-900 px-1 py-1.5 text-left text-[11px] font-bold text-gray-900 uppercase w-[9%] whitespace-nowrap">Product</th>
                                                <th className="border-r border-gray-900 px-1 py-1.5 text-left text-[11px] font-bold text-gray-900 uppercase w-[8%] whitespace-nowrap">Brand</th>
                                                <th className="border-r border-gray-900 px-1 py-1.5 text-center text-[11px] font-bold text-gray-900 uppercase w-[7%] whitespace-nowrap">Qty</th>
                                                <th className="border-r border-gray-900 px-1 py-1.5 text-right text-[11px] font-bold text-gray-900 uppercase w-[6%] whitespace-nowrap">Price</th>
                                                <th className="border-r border-gray-900 px-1 py-1.5 text-right text-[11px] font-bold text-gray-900 uppercase w-[10%] whitespace-nowrap">Total</th>
                                                <th className="px-1 py-1.5 text-left text-[11px] font-bold text-gray-900 uppercase w-[10%] whitespace-nowrap">Remark</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1.5 text-center ${saleType === 'Border' ? 'text-[12px]' : 'text-[11px]'} font-bold text-gray-900 uppercase w-[4%] whitespace-nowrap`}>SL</th>
                                                <th className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1.5 text-center ${saleType === 'Border' ? 'text-[12px]' : 'text-[11px]'} font-bold text-gray-900 uppercase w-[7%] whitespace-nowrap`}>Date</th>
                                                {saleType !== 'Border' && (
                                                    <th className="border-r border-gray-900 px-1 py-1.5 text-center text-[11px] font-bold text-gray-900 uppercase w-[12%] whitespace-nowrap">Invoice</th>
                                                )}
                                                {saleType !== 'Border' ? (
                                                    <>
                                                        <th className="border-r border-gray-900 px-1 py-1.5 text-center text-[11px] font-bold text-gray-900 uppercase w-[7%] whitespace-nowrap">LC No</th>
                                                        <th className="border-r border-gray-900 px-1 py-1.5 text-left text-[11px] font-bold text-gray-900 uppercase w-[7%] whitespace-nowrap">CH. No</th>
                                                        <th className="border-r border-gray-900 px-1 py-1.5 text-left text-[11px] font-bold text-gray-900 uppercase w-[7%] whitespace-nowrap">Truck No</th>
                                                        <th className="border-r border-gray-900 px-1 py-1.5 text-left text-[11px] font-bold text-gray-900 uppercase w-[7%] whitespace-nowrap">W.HHOUSE</th>
                                                    </>
                                                ) : (
                                                    <th className="border-r border-gray-900 px-0.5 py-1.5 text-center text-[12px] font-bold text-gray-900 uppercase w-[12%] whitespace-nowrap">LC No</th>
                                                )}
                                                {saleType === 'Border' ? (
                                                    <>
                                                        <th className="border-r border-gray-900 px-0.5 py-1.5 text-center text-[12px] font-bold text-gray-900 uppercase whitespace-nowrap">Importer</th>
                                                        <th className="border-r border-gray-900 px-0.5 py-1.5 text-center text-[12px] font-bold text-gray-900 uppercase whitespace-nowrap">Port</th>
                                                        <th className="border-r border-gray-900 px-0.5 py-1.5 text-center text-[12px] font-bold text-gray-900 uppercase whitespace-nowrap">IND C&F</th>
                                                        <th className="border-r border-gray-900 px-0.5 py-1.5 text-center text-[12px] font-bold text-gray-900 uppercase whitespace-nowrap">BD C&F</th>
                                                        <th className="border-r border-gray-900 px-1 py-1.5 text-left text-[12px] font-bold text-gray-900 uppercase whitespace-nowrap">Party Name</th>
                                                    </>
                                                ) : (
                                                    <th className="border-r border-gray-900 px-2 py-1.5 text-left text-[11px] font-bold text-gray-900 uppercase w-[10%] whitespace-nowrap">Company</th>
                                                )}
                                                <th className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1.5 text-left ${saleType === 'Border' ? 'text-[12px]' : 'text-[11px]'} font-bold text-gray-900 uppercase w-[7%] whitespace-nowrap`}>Product</th>
                                                {saleType !== 'Border' && (
                                                    <th className="border-r border-gray-900 px-1 py-1.5 text-left text-[11px] font-bold text-gray-900 uppercase w-[10%] whitespace-nowrap">Brand</th>
                                                )}
                                                <th className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1.5 text-center ${saleType === 'Border' ? 'text-[12px]' : 'text-[11px]'} font-bold text-gray-900 uppercase w-[7%] whitespace-nowrap`}>QTY</th>
                                                {saleType === 'Border' && (
                                                    <th className="border-r border-gray-900 px-0.5 py-1.5 text-center text-[12px] font-bold text-gray-900 uppercase w-[5%] whitespace-nowrap">Truck</th>
                                                )}
                                                <th className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1.5 text-right ${saleType === 'Border' ? 'text-[12px]' : 'text-[11px]'} font-bold text-gray-900 uppercase w-[5%] whitespace-nowrap`}>Price</th>
                                                <th className={`${saleType === 'Border' ? '' : 'border-r'} border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1.5 text-right ${saleType === 'Border' ? 'text-[12px]' : 'text-[11px]'} font-bold text-gray-900 uppercase w-[10%] whitespace-nowrap`}>Total</th>
                                                {saleType !== 'Border' && (
                                                    <>
                                                        <th className="border-r border-gray-900 px-1 py-1.5 text-right text-[11px] font-bold text-gray-900 uppercase w-[6%] whitespace-nowrap">Disc</th>
                                                        <th className="border-r border-gray-900 px-1 py-1.5 text-right text-[11px] font-bold text-gray-900 uppercase w-[9%] whitespace-nowrap">Truck Fare</th>
                                                        <th className="px-1 py-1.5 text-right text-[11px] font-bold text-gray-900 uppercase w-[10%] whitespace-nowrap">Balance</th>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-900">
                                    {(() => {
                                        let sl = 1;
                                         return salesWithItems.length > 0 ? (
                                             salesWithItems.flatMap((sale) => {
                                                 const flatItems = sale.flatItems;

                                                 return flatItems.map((item, idx) => (
                                                        <tr key={`${sale._id}-${idx}`} className="hover:bg-gray-50 transition-colors">
                                                            {saleType === 'Order' ? (
                                                                <>
                                                                    {idx === 0 && (
                                                                        <>
                                                                            <td rowSpan={flatItems.length} className="border-r border-gray-900 px-1 py-1 text-[12px] text-gray-900 text-center">{sl++}</td>
                                                                            <td rowSpan={flatItems.length} className="border-r border-gray-900 px-1 py-1 text-[12px] text-gray-900 text-center">{formatDate(sale.date)}</td>
                                                                            <td rowSpan={flatItems.length} className="border-r border-gray-900 px-1 py-1 text-[12px] text-gray-900 font-bold text-center">{sale.orderNo || '-'}</td>
                                                                            <td rowSpan={flatItems.length} className="border-r border-gray-900 px-2 py-1 text-[12px] text-gray-900 font-bold">{sale.companyName || sale.customerName || '-'}</td>
                                                                            <td rowSpan={flatItems.length} className="border-r border-gray-900 px-2 py-1 text-[12px] text-gray-900 font-medium">{sale.location || '-'}</td>
                                                                        </>
                                                                    )}
                                                                    <td className="border-r border-gray-900 px-1 py-1 text-[12px] text-gray-900">{item.warehouseName || item.warehouse || sale.warehouse || '-'}</td>
                                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-gray-900 truncate font-semibold">{item.productName}</td>
                                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-gray-900 truncate">{item.brand || '-'}</td>
                                                                    <td className="border-r border-gray-900 px-1 py-1 text-[12px] text-right font-bold text-gray-900">{parseFloat(item.quantity || 0).toLocaleString('en-US')}</td>
                                                                    <td className="border-r border-gray-900 px-1 py-1 text-[12px] text-right text-gray-900">{parseFloat(item.price || 0).toLocaleString('en-IN')}</td>
                                                                    <td className="border-r border-gray-900 px-1 py-1 text-[12px] text-right font-bold text-gray-900">{parseFloat(item.total || 0).toLocaleString('en-IN')}</td>
                                                                    {idx === 0 && (
                                                                        <td rowSpan={flatItems.length} className="px-1 py-1 text-[12px] text-gray-900">{sale.remark || sale.remarks || sale.notes || sale.note || '-'}</td>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {idx === 0 && (
                                                                        <>
                                                                            <td rowSpan={flatItems.length} className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1 ${saleType === 'Border' ? 'text-[12px]' : 'text-[12px]'} text-gray-900 text-center`}>{sl++}</td>
                                                                            <td rowSpan={flatItems.length} className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1 ${saleType === 'Border' ? 'text-[12px]' : 'text-[12px]'} text-gray-900 text-center`}>{formatDate(sale.date)}</td>
                                                                            {saleType !== 'Border' && (
                                                                                <td rowSpan={flatItems.length} className="border-r border-gray-900 px-1 py-1 text-[12px] font-bold text-gray-900 text-center">{sale.invoiceNo || sale.orderNo || '-'}</td>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                    {item.isFirstInProduct && (
                                                                        <td rowSpan={item.productSpan} className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1 text-[12px] font-bold text-gray-900 text-center whitespace-nowrap`}>
                                                                            {item.lcNo || '-'}
                                                                        </td>
                                                                    )}
                                                                    {saleType !== 'Border' && idx === 0 && (
                                                                        <>
                                                                            <td rowSpan={flatItems.length} className="border-r border-gray-900 px-1 py-1 text-[12px] text-gray-900 text-center">
                                                                                {sale.challanNo ? (
                                                                                    sale.challanNo.split(/(.{5})/).filter(Boolean).map((chunk, idx) => (
                                                                                        <div key={idx}>{chunk}</div>
                                                                                    ))
                                                                                ) : (
                                                                                    '-'
                                                                                )}
                                                                            </td>
                                                                            <td rowSpan={flatItems.length} className="border-r border-gray-900 px-1 py-1 text-[12px] text-gray-900 text-center">
                                                                                {sale.truckNo ? (
                                                                                    sale.truckNo.split(/(.{14})/).filter(Boolean).map((chunk, idx) => (
                                                                                        <div key={idx}>{chunk}</div>
                                                                                    ))
                                                                                ) : (
                                                                                    '-'
                                                                                )}
                                                                            </td>
                                                                            <td rowSpan={flatItems.length} className="border-r border-gray-900 px-1 py-1 text-[12px] text-gray-900 text-center">
                                                                                {flatItems.map((it, fIdx) => (
                                                                                    <div key={fIdx} className={fIdx < flatItems.length - 1 ? 'border-b border-gray-200 pb-0.5 mb-0.5' : ''}>
                                                                                        {it.warehouseName || '-'}
                                                                                    </div>
                                                                                ))}
                                                                            </td>
                                                                        </>
                                                                    )}
                                                                    {idx === 0 && (
                                                                        <>
                                                                            {saleType === 'Border' ? (
                                                                                <>
                                                                                    <td rowSpan={flatItems.length} className="border-r border-gray-900 px-0.5 py-1 text-[12px] text-gray-900 text-left whitespace-nowrap">{sale.importer || '-'}</td>
                                                                                    <td rowSpan={flatItems.length} className="border-r border-gray-900 px-0.5 py-1 text-[12px] text-gray-900 text-center whitespace-nowrap">{sale.port || '-'}</td>
                                                                                    <td rowSpan={flatItems.length} className="border-r border-gray-900 px-0.5 py-1 text-[12px] text-gray-900 text-center whitespace-nowrap">{sale.indianCnF || '-'}</td>
                                                                                    <td rowSpan={flatItems.length} className="border-r border-gray-900 px-0.5 py-1 text-[12px] text-gray-900 text-center whitespace-nowrap">{sale.bdCnf || '-'}</td>
                                                                                    <td rowSpan={flatItems.length} className="border-r border-gray-900 px-1 py-1 text-[12px] text-gray-900 whitespace-nowrap">{sale.companyName || sale.customerName || '-'}</td>
                                                                                </>
                                                                            ) : (
                                                                                <td rowSpan={flatItems.length} className="border-r border-gray-900 px-2 py-1 text-[12px] text-gray-900">{sale.companyName}</td>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                {item.isFirstInProduct && (
                                                                    <td rowSpan={item.productSpan} className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-2'} py-1 ${saleType === 'Border' ? 'text-[12px]' : 'text-[12px]'} text-gray-900 truncate`}>{item.productName}</td>
                                                                )}
                                                                {saleType !== 'Border' && (
                                                                    <td className="border-r border-gray-900 px-2 py-1 text-[12px] text-gray-900 truncate">{item.brand}</td>
                                                                )}
                                                                <td className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1 ${saleType === 'Border' ? 'text-[12px]' : 'text-[12px]'} text-right font-bold text-gray-900`}>{parseFloat(item.quantity).toLocaleString('en-US')}</td>
                                                                {saleType === 'Border' && (
                                                                    <td className="border-r border-gray-900 px-0.5 py-1 text-[12px] text-gray-900 text-center">{item.truck || sale.truck || '-'}</td>
                                                                )}
                                                                <td className={`border-r border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1 ${saleType === 'Border' ? 'text-[12px]' : 'text-[12px]'} text-right text-gray-900`}>{parseFloat(item.price).toLocaleString('en-IN')}</td>
                                                                <td className={`${saleType === 'Border' ? '' : 'border-r'} border-gray-900 ${saleType === 'Border' ? 'px-0.5' : 'px-1'} py-1 ${saleType === 'Border' ? 'text-[12px]' : 'text-[12px]'} text-right font-bold text-gray-900`}>{parseFloat(item.total).toLocaleString('en-IN')}</td>
                                                                {saleType !== 'Border' && idx === 0 && (
                                                                    <>
                                                                        <td rowSpan={flatItems.length} className="border-r border-gray-900 px-1 py-1 text-[12px] text-right text-gray-600">{parseFloat(sale.discount || 0).toLocaleString('en-IN')}</td>
                                                                        <td rowSpan={flatItems.length} className="border-r border-gray-900 px-1 py-1 text-[12px] text-right text-green-700 font-bold">{parseFloat(sale.paidAmount || 0).toLocaleString('en-IN')}</td>
                                                                        <td rowSpan={flatItems.length} className="px-1 py-1 text-[12px] text-right text-red-700 font-black">{(parseFloat(sale.totalAmount || 0) - parseFloat(sale.paidAmount || 0)).toLocaleString('en-IN')}</td>
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                     </tr>
                                                 ));
                                             })
                                         ) : (
                                             <tr><td colSpan={saleType === 'Order' ? "12" : "12"} className="px-4 py-8 text-center text-gray-500 italic text-[12px]">No records found for the selected criteria.</td></tr>
                                         )
                                     })()}
                                </tbody>
                                {salesWithItems.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-100 border-t-2 border-gray-900">
                                            {saleType === 'Order' ? (
                                                <>
                                                    <td colSpan="8" className="px-2 py-2 text-[12px] font-black text-gray-900 text-right uppercase tracking-wider border-r border-gray-900">Grand Total</td>
                                                    <td className="px-1 py-2 text-[12px] text-right font-black text-gray-900 border-r border-gray-900">{summary.totalQty.toLocaleString('en-US')}</td>
                                                    <td className="px-1 py-2 text-[12px] text-right font-bold text-gray-900 border-r border-gray-900"></td>
                                                    <td className="px-1 py-2 text-[12px] text-right font-black text-gray-900 border-r border-gray-900">{summary.totalAmount.toLocaleString('en-IN')}</td>
                                                    <td className="px-1 py-2 text-[12px]"></td>
                                                </>
                                            ) : (
                                                <>
                                                    {saleType === 'Border' ? (
                                                        <>
                                                            <td colSpan="9" className="px-0.5 py-1 text-[12px] font-black text-gray-900 text-right uppercase tracking-wider border-r border-gray-900">Grand Total</td>
                                                            <td className="px-0.5 py-1 text-[12px] text-right font-black text-gray-900 border-r border-gray-900">{summary.totalQty.toLocaleString('en-US')}</td>
                                                            <td className="px-0.5 py-1 text-[12px] text-center font-black text-gray-900 border-r border-gray-900">{summary.totalTrucks.toLocaleString('en-US')}</td>
                                                            <td className="px-0.5 py-1 text-[12px] text-right font-bold text-gray-900 border-r border-gray-900"></td>
                                                            <td className="px-0.5 py-1 text-[12px] text-right font-black text-gray-900">{Math.round(summary.totalAmount).toLocaleString('en-IN')}</td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td colSpan="10" className="px-2 py-2 text-[12px] font-black text-gray-900 text-right uppercase tracking-wider border-r border-gray-900">Grand Total</td>
                                                            <td className="px-1 py-2 text-[12px] text-right font-black text-gray-900 border-r border-gray-900">{summary.totalQty.toLocaleString('en-US')}</td>
                                                            <td className="px-1 py-2 text-[12px] text-right font-bold text-gray-900 border-r border-gray-900"></td>
                                                            <td className="px-1 py-2 text-[12px] text-right font-black text-gray-900 border-r border-gray-900">{summary.totalAmount.toLocaleString('en-IN')}</td>
                                                            <td className="px-1 py-2 text-[12px] text-right font-bold text-gray-900 border-r border-gray-900"></td>
                                                            <td className="px-1 py-2 text-[12px] text-right font-black text-green-800 border-r border-gray-900">{summary.totalPaid.toLocaleString('en-IN')}</td>
                                                            <td className="px-1 py-2 text-[12px] text-right font-black text-red-800">{(summary.totalAmount - summary.totalPaid).toLocaleString('en-IN')}</td>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </tr>
                                    </tfoot>
                                )}
                            </>
                        )}
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        {reportTab === 'lc_wise' ? (
                            <div className="md:hidden print:hidden space-y-3 px-1">
                                {lcWiseList.length > 0 ? (
                                    lcWiseList.map((item, idx) => (
                                        <div key={idx} className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">Sl: {idx + 1}</span>
                                                <span className="text-xs font-black text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md">LC: {item.lcNo}</span>
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-gray-900">{item.product}</div>
                                                <div className="text-xs text-gray-500 font-semibold">{item.brand || '-'}</div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 text-center">
                                                <div className="bg-gray-50 p-2 rounded-xl">
                                                    <div className="text-[10px] font-bold text-gray-500 uppercase">Purchase</div>
                                                    <div className="text-[11px] font-bold text-gray-800">{item.pBag > 0 ? Number(item.pBag.toFixed(2)).toLocaleString('en-US') : '0'} Bags</div>
                                                    <div className="text-xs font-black text-gray-900">{Number(item.pQty.toFixed(2)).toLocaleString('en-US')} KG</div>
                                                </div>
                                                <div className="bg-blue-50/50 p-2 rounded-xl">
                                                    <div className="text-[10px] font-bold text-blue-600 uppercase">Sales</div>
                                                    <div className="text-[11px] font-bold text-blue-800">{item.sBag > 0 ? Number(item.sBag.toFixed(2)).toLocaleString('en-US') : '0'} Bags</div>
                                                    <div className="text-xs font-black text-blue-900">{Number(item.sQty.toFixed(2)).toLocaleString('en-US')} KG</div>
                                                </div>
                                                <div className="bg-emerald-50/50 p-2 rounded-xl">
                                                    <div className="text-[10px] font-bold text-emerald-600 uppercase">Remain</div>
                                                    <div className={`text-[11px] font-bold ${item.rBag < 0 ? 'text-red-600' : 'text-emerald-800'}`}>{Number(item.rBag.toFixed(2)).toLocaleString('en-US')} Bags</div>
                                                    <div className={`text-xs font-black ${item.rQty < 0 ? 'text-red-600' : 'text-emerald-900'}`}>{Number(item.rQty.toFixed(2)).toLocaleString('en-US')} KG</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center text-gray-400 font-medium italic text-sm shadow-sm">
                                        No LC records found for the selected criteria.
                                    </div>
                                )}
                            </div>
                        ) : reportTab === 'product_wise' ? (
                            <div className="md:hidden print:hidden space-y-3 px-1">
                                {productWiseList.length > 0 ? (
                                    productWiseList.map((item, idx) => (
                                        <div key={idx} className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-4 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">SL: {idx + 1}</span>
                                                <span className="text-xs font-bold text-gray-500">{item.brand || '-'}</span>
                                            </div>
                                            <div className="text-sm font-black text-gray-900">{item.productName}</div>
                                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 text-center">
                                                <div className="bg-gray-50 p-2 rounded-xl">
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase">Bag</div>
                                                    <div className="text-xs font-black text-gray-800">{item.bag > 0 ? item.bag.toLocaleString('en-US') : '-'}</div>
                                                </div>
                                                <div className="bg-gray-50 p-2 rounded-xl">
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase">Qty</div>
                                                    <div className="text-xs font-black text-gray-800">{parseFloat(item.quantity || 0).toLocaleString('en-US')}</div>
                                                </div>
                                                <div className="bg-gray-50 p-2 rounded-xl">
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase">Amount</div>
                                                    <div className="text-xs font-black text-blue-600">৳{parseFloat(item.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center text-gray-400 font-medium italic text-sm shadow-sm">
                                        No product records found for the selected criteria.
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="md:hidden space-y-4 px-1">
                            {salesWithItems.length > 0 ? (
                                salesWithItems.map((sale) => {
                                    const isExpanded = expandedRows.includes(sale._id);
                                    const flatItems = sale.flatItems;

                                    return (
                                        <div
                                            key={sale._id}
                                            className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-4 space-y-3 relative transition-all ${isExpanded ? 'ring-1 ring-blue-500/10 shadow-md' : 'hover:bg-gray-50/30'}`}
                                            onClick={() => toggleRowExpansion(sale._id)}
                                        >
                                            {/* Header Section */}
                                            <div className="flex items-center justify-between min-w-0">
                                                <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                                                    <div className="flex-shrink-0">
                                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">{formatDate(sale.date)}</div>
                                                        <div className={`text-sm font-black text-gray-900 truncate`}>{sale.invoiceNo || 'No ID'}</div>
                                                    </div>

                                                    {!isExpanded && (
                                                        <>
                                                            <div className="flex-1 min-w-0 border-l border-gray-100 pl-3">
                                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Company</div>
                                                                <div className="text-[11px] font-bold text-gray-800 truncate">{sale.companyName || '-'}</div>
                                                            </div>
                                                            <div className="flex-shrink-0 border-l border-gray-100 pl-3 text-right">
                                                                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest leading-none mb-1">Total</div>
                                                                <div className="text-[11px] font-black text-gray-900">৳{parseFloat(sale.totalAmount).toLocaleString('en-IN')}</div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 ml-2">
                                                    <ChevronDownIcon className={`w-5 h-5 text-gray-300 transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'opacity-60'}`} />
                                                </div>
                                            </div>

                                            {/* Expanded Content */}
                                            {isExpanded && (
                                                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                                    <div className="border-t border-gray-50 pt-3 mt-1 space-y-4">
                                                        <div>
                                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Company Name</div>
                                                            <div className="text-sm font-bold text-gray-800">{sale.companyName || '-'}</div>
                                                        </div>

                                                        <div className="bg-gray-50/50 rounded-xl p-3 space-y-2">
                                                            <div className="text-[10px] font-bold text-gray-600 uppercase">Products & Quantities</div>
                                                            <div className="grid grid-cols-12 gap-1 px-1 pb-1 border-b border-gray-100 mb-1 mt-2">
                                                                <div className="col-span-4 text-[9px] font-bold text-gray-400 uppercase">Brand</div>
                                                                <div className="col-span-2 text-[9px] font-bold text-gray-400 uppercase text-right">Qty</div>
                                                                <div className="col-span-3 text-[9px] font-bold text-gray-400 uppercase text-right">Price</div>
                                                                <div className="col-span-3 text-[9px] font-bold text-gray-400 uppercase text-right">Total</div>
                                                            </div>
                                                            <div className="space-y-3 mt-2">
                                                                {flatItems.map((item, idx) => (
                                                                    <div key={idx} className="border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                                                                        <div className="text-[12px] font-black text-gray-800 mb-0.5">{item.productName}</div>
                                                                        <div className="grid grid-cols-12 gap-1 items-center">
                                                                            <div className="col-span-4 min-w-0">
                                                                                <span className="text-[11px] font-medium text-gray-500 italic truncate block">{item.brand}</span>
                                                                            </div>
                                                                            <div className="col-span-2 text-right">
                                                                                <div className="text-[10px] font-bold text-gray-900">{parseFloat(item.quantity).toLocaleString('en-US')}</div>
                                                                            </div>
                                                                            <div className="col-span-3 text-right">
                                                                                <div className="text-[11px] font-medium text-blue-600">৳{parseFloat(item.price).toLocaleString('en-IN')}</div>
                                                                            </div>
                                                                            <div className="col-span-3 text-right">
                                                                                <div className="text-[11px] font-black text-gray-900 text-truncate">৳{parseFloat(item.total).toLocaleString('en-IN')}</div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Money Summary */}
                                                        <div className="grid grid-cols-2 gap-2 mt-4">
                                                            <div className="text-center p-2 rounded-lg border bg-blue-50/40 border-blue-100/50">
                                                                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Total Amount</div>
                                                                <div className="text-[13px] font-black text-gray-900">৳{parseFloat(sale.totalAmount).toLocaleString('en-IN')}</div>
                                                            </div>
                                                            <div className="text-center p-2 rounded-lg border bg-red-50/40 border-red-100/50">
                                                                <div className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1">Discount</div>
                                                                <div className="text-[13px] font-black text-red-600">৳{parseFloat(sale.discount || 0).toLocaleString('en-IN')}</div>
                                                            </div>
                                                            <div className="text-center p-2 rounded-lg border bg-emerald-50/40 border-emerald-100/50">
                                                                <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Truck Fare</div>
                                                                <div className="text-[13px] font-black text-emerald-700">৳{parseFloat(sale.paidAmount || 0).toLocaleString('en-IN')}</div>
                                                            </div>
                                                            <div className="text-center p-2 rounded-lg border bg-orange-50/40 border-orange-100/50">
                                                                <div className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-1">Balance</div>
                                                                <div className="text-[13px] font-black text-orange-700">৳{(parseFloat(sale.totalAmount || 0) - parseFloat(sale.paidAmount || 0)).toLocaleString('en-IN')}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center text-gray-400 font-medium italic text-sm shadow-sm">
                                    No records found for the selected criteria.
                                </div>
                            )}

                            {/* Mobile Grand Total Card */}
                            {filteredSales.length > 0 && (
                                <div className="bg-gray-900 rounded-2xl p-4 shadow-lg space-y-3 mt-6">
                                    <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Grand Total Summary</div>
                                        <div className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold tracking-wider">{filteredSales.length} Invoices</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Total Qty</div>
                                            <div className="text-lg font-black text-white">{summary.totalQty.toLocaleString('en-US')} <span className="text-[10px] font-bold text-gray-400 uppercase">KG</span></div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Total Sales</div>
                                            <div className="text-lg font-black text-white">৳{summary.totalAmount.toLocaleString('en-IN')}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Total Truck Fare</div>
                                            <div className="text-lg font-black text-emerald-400">৳{summary.totalPaid.toLocaleString('en-IN')}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-bold text-orange-400 uppercase mb-1">Total Balance</div>
                                            <div className="text-xl font-black text-red-500">৳{(summary.totalAmount - summary.totalPaid).toLocaleString('en-IN')}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        )}

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 px-2">
                            <div className="border border-gray-200 p-5 rounded-2xl bg-gray-50 shadow-sm transition-all hover:shadow-md">
                                <div className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    {reportTab === 'lc_wise'
                                        ? 'Total Purchase'
                                        : reportTab === 'product_wise'
                                        ? 'Total Bags'
                                        : 'Total Sales Quantity'}
                                </div>
                                <div className="text-2xl font-black text-gray-900">
                                    {reportTab === 'lc_wise'
                                        ? `${Number(lcWiseTotals.pQty.toFixed(2)).toLocaleString('en-US')} KG`
                                        : reportTab === 'product_wise'
                                        ? `${productWiseTotals.totalBags > 0 ? productWiseTotals.totalBags.toLocaleString('en-US') : '0'} Bags`
                                        : `${summary.totalQty.toLocaleString('en-US')} KG`}
                                </div>
                                {reportTab === 'lc_wise' && (
                                    <div className="text-xs font-bold text-gray-500 mt-1">
                                        {Number(lcWiseTotals.pBag.toFixed(2)).toLocaleString('en-US')} Bags
                                    </div>
                                )}
                            </div>
                            {reportTab === 'lc_wise' ? (
                                <div className="border border-gray-200 p-5 rounded-2xl bg-white shadow-sm transition-all hover:shadow-md ring-2 ring-blue-500/10">
                                    <div className="text-[12px] font-bold text-blue-500 uppercase tracking-wider mb-2">Total Sales</div>
                                    <div className="text-2xl font-black text-gray-900">
                                        {Number(lcWiseTotals.sQty.toFixed(2)).toLocaleString('en-US')} <span className="text-sm font-bold">KG</span>
                                    </div>
                                    <div className="text-xs font-bold text-blue-600 mt-1">
                                        {Number(lcWiseTotals.sBag.toFixed(2)).toLocaleString('en-US')} Bags
                                    </div>
                                </div>
                            ) : reportTab === 'product_wise' ? (
                                <div className="border border-gray-200 p-5 rounded-2xl bg-white shadow-sm transition-all hover:shadow-md ring-2 ring-blue-500/10">
                                    <div className="text-[12px] font-bold text-blue-500 uppercase tracking-wider mb-2">Total Sales Quantity</div>
                                    <div className="text-2xl font-black text-gray-900">
                                        {productWiseTotals.totalQty.toLocaleString('en-US')} <span className="text-sm font-bold">KG</span>
                                    </div>
                                </div>
                            ) : saleType === 'Border' ? (
                                <div className="border border-gray-200 p-5 rounded-2xl bg-white shadow-sm transition-all hover:shadow-md ring-2 ring-blue-500/10">
                                    <div className="text-[12px] font-bold text-blue-500 uppercase tracking-wider mb-2">Total Trucks</div>
                                    <div className="text-3xl font-black text-gray-900">
                                        {summary.totalTrucks.toLocaleString('en-US')} <span className="text-sm font-bold text-gray-500">Trucks</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="border border-gray-200 p-5 rounded-2xl bg-white shadow-sm transition-all hover:shadow-md ring-2 ring-blue-500/10">
                                    <div className="text-[12px] font-bold text-blue-500 uppercase tracking-wider mb-2">Net Balance</div>
                                    <div className="text-3xl font-black text-red-600">
                                        TK {(summary.totalAmount - summary.totalPaid).toLocaleString('en-IN')}
                                    </div>
                                </div>
                            )}
                            <div className="border border-gray-200 p-5 rounded-2xl bg-gray-50 shadow-sm transition-all hover:shadow-md">
                                <div className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    {reportTab === 'lc_wise' ? 'Total Remaining (Saleable)' : 'Total Sales Amount'}
                                </div>
                                <div className={`text-2xl font-black ${reportTab === 'lc_wise' && lcWiseTotals.rQty < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                    {reportTab === 'lc_wise'
                                        ? `${Number(lcWiseTotals.rQty.toFixed(2)).toLocaleString('en-US')} KG`
                                        : `TK ${(reportTab === 'product_wise' ? productWiseTotals.totalAmount : summary.totalAmount).toLocaleString('en-IN')}`}
                                </div>
                                {reportTab === 'lc_wise' && (
                                    <div className={`text-xs font-bold mt-1 ${lcWiseTotals.rBag < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                        {Number(lcWiseTotals.rBag.toFixed(2)).toLocaleString('en-US')} Bags
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="grid grid-cols-3 gap-8 pt-24 px-4 pb-12">
                            <div className="text-center"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Prepared By</div></div>
                            <div className="text-center"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Verified By</div></div>
                            <div className="text-center"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Authorized Signature</div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SalesReport;
