import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MenuIcon, SearchIcon, BellIcon, HomeIcon, BoxIcon, UsersIcon, AnchorIcon,
  BarChartIcon, SettingsIcon, TrendingUpIcon, DollarSignIcon,
  ShoppingCartIcon, EditIcon, TrashIcon, FunnelIcon, XIcon, PlusIcon,
  ChevronUpIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, EyeIcon, CalendarIcon
} from './components/Icons';

import { encryptData, decryptData } from './utils/encryption';
import { generateLCReceiveReportPDF } from './utils/pdfGenerator';
import { API_BASE_URL, formatDate, parseDate, SortIcon } from './utils/helpers';
import CustomDatePicker from './components/shared/CustomDatePicker';
import Importer from './components/modules/Importer/Importer';
import Port from './components/modules/Port/Port';
import IPManagement from './components/modules/IPManagement/IPManagement';
import ProductManagement from './components/modules/Product/ProductManagement';
import LCReceive from './components/modules/LCReceive/LCReceive';
import WarehouseManagement from './components/modules/Warehouse/WarehouseManagement';
import StockManagement from "./components/modules/StockManagement/StockManagement";
import StockReport from './components/modules/StockManagement/StockReport';
import { calculateStockData } from './utils/stockHelpers';



function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stockDropdownOpen, setStockDropdownOpen] = useState(false);
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('currentView') || 'dashboard';
  });
  const [showIpForm, setShowIpForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [ipRecords, setIpRecords] = useState([]);
  const [importers, setImporters] = useState([]);
  const [ports, setPorts] = useState([]);
  const [showStockForm, setShowStockForm] = useState(false);
  const [showStockReport, setShowStockReport] = useState(false);
  const [stockFormData, setStockFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    lcNo: '',
    port: '',
    importer: '',
    indianCnF: '',
    indCnFCost: '',
    bdCnF: '',
    bdCnFCost: '',
    billOfEntry: '',
    totalLcTruck: '',
    totalLcQuantity: '',
    status: 'In Stock',
    productEntries: [{
      isMultiBrand: true,
      productName: '',
      truckNo: '',
      brandEntries: [{ brand: '', purchasedPrice: '', packet: '', packetSize: '', quantity: '', unit: 'kg', sweepedPacket: '', sweepedQuantity: '', inHousePacket: '', inHouseQuantity: '' }]
    }]
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showImporterForm, setShowImporterForm] = useState(false);
  const [showPortForm, setShowPortForm] = useState(false);

  const [stockRecords, setStockRecords] = useState([]);
  const [stockFilters, setStockFilters] = useState({ startDate: '', endDate: '', lcNo: '', port: '', brand: '', importer: '', productName: '' });

  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const longPressTimer = useRef(null);
  const isLongPressTriggered = useRef(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, type: '', id: null, isBulk: false });
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    quickRange: 'all',
    port: '',
    importer: ''
  });
  const [viewRecord, setViewRecord] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [showHistoryFilterPanel, setShowHistoryFilterPanel] = useState(false);
  const [historyFilters, setHistoryFilters] = useState({
    startDate: '',
    endDate: '',
    lcNo: '',
    port: '',
    brand: ''
  });
  const [filterSearchInputs, setFilterSearchInputs] = useState({
    lcNoSearch: '',
    portSearch: '',
    brandSearch: '',
    productSearch: '',
    indCnfSearch: '',
    bdCnfSearch: '',
    billOfEntrySearch: ''
  });

  const [sortConfig, setSortConfig] = useState({
    stock: { key: 'date', direction: 'desc' },
    history: { key: 'date', direction: 'desc' },
    importer: { key: 'name', direction: 'asc' },
    port: { key: 'name', direction: 'asc' },
    ip: { key: 'openingDate', direction: 'desc' }
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



  const [showLcReport, setShowLcReport] = useState(false);
  const [showLcReportFilterPanel, setShowLcReportFilterPanel] = useState(false);
  const [products, setProducts] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const portRef = useRef(null);
  const importerRef = useRef(null);
  const ipPortRef = useRef(null);
  const ipImporterRef = useRef(null);
  const filterPortRef = useRef(null);
  const filterImporterRef = useRef(null);
  const lcNoFilterRef = useRef(null);
  const portFilterRef = useRef(null);
  const brandFilterRef = useRef(null);
  const historyFilterRef = useRef(null);
  const filterButtonRef = useRef(null);

  const reportLcNoFilterRef = useRef(null);
  const reportPortFilterRef = useRef(null);
  const reportBrandFilterRef = useRef(null);
  const reportProductFilterRef = useRef(null);
  const lcReportFilterRef = useRef(null);
  const lcReportFilterButtonRef = useRef(null);
  const reportLcIndCnfFilterRef = useRef(null);
  const reportLcBdCnfFilterRef = useRef(null);
  const reportLcBillOfEntryFilterRef = useRef(null);
  const productRefs = useRef({});
  const brandRefs = useRef({});



  const [portFormData, setPortFormData] = useState({
    name: '',
    location: '',
    code: '',
    type: 'Seaport',
    status: 'Active'
  });


  const [formData, setFormData] = useState({
    openingDate: '',
    closeDate: '',
    ipNumber: '',
    referenceNo: '',
    ipParty: '',
    productName: '',
    quantity: '',
    port: '',
    status: 'Active'
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => {
      const newData = { ...prev, [name]: value };

      if (name === 'openingDate') {
        const openingDate = parseDate(value);
        if (!isNaN(openingDate.getTime())) {
          const closeDate = new Date(openingDate);
          closeDate.setMonth(closeDate.getMonth() + 4);

          const year = closeDate.getFullYear();
          const month = String(closeDate.getMonth() + 1).padStart(2, '0');
          const day = String(closeDate.getDate()).padStart(2, '0');
          newData.closeDate = `${year}-${month}-${day}`;
        }
      }

      return newData;
    });

    if (name === 'port' || name === 'ipParty') {
      setActiveDropdown(name === 'port' ? 'ipPort' : 'ipImporter');
    }
  };

  const resetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      quickRange: 'all',
      port: '',
      importer: ''
    });
  };

  const resetIpForm = () => {
    setFormData({
      openingDate: '',
      closeDate: '',
      ipNumber: '',
      referenceNo: '',
      ipParty: '',
      productName: '',
      quantity: '',
      port: '',
      status: 'Active'
    });
    setEditingId(null);
    setSubmitStatus(null);
  };

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

  const [lcFilters, setLcFilters] = useState(initialLcFilterState);
  const [lcSearchQuery, setLcSearchQuery] = useState('');


  const lcReceiveRecords = useMemo(() => {
    const searchLower = lcSearchQuery.toLowerCase().trim();
    return stockRecords.filter(item => {
      // Apply Advanced Filters
      if (lcFilters.startDate && item.date < lcFilters.startDate) return false;
      if (lcFilters.endDate && item.date > lcFilters.endDate) return false;
      if (lcFilters.lcNo && (item.lcNo || '').trim().toLowerCase() !== lcFilters.lcNo.toLowerCase()) return false;
      if (lcFilters.port && (item.port || '').trim().toLowerCase() !== lcFilters.port.toLowerCase()) return false;
      if (lcFilters.indCnf && (item.indianCnF || '').trim().toLowerCase() !== lcFilters.indCnf.toLowerCase()) return false;
      if (lcFilters.bdCnf && (item.bdCnF || '').trim().toLowerCase() !== lcFilters.bdCnf.toLowerCase()) return false;
      if (lcFilters.billOfEntry && (item.billOfEntry || '').trim().toLowerCase() !== lcFilters.billOfEntry.toLowerCase()) return false;
      if (lcFilters.productName && (item.productName || '').trim().toLowerCase() !== lcFilters.productName.toLowerCase()) return false;
      if (lcFilters.brand) {
        const brandList = item.brand ? [item.brand] : (item.brandEntries || []).map(e => e.brand);
        if (!brandList.some(b => (b || '').trim().toLowerCase() === lcFilters.brand.toLowerCase())) return false;
      }

      // Apply Search Query
      if (!searchLower) return true;

      const matchesLC = (item.lcNo || '').toLowerCase().includes(searchLower);
      const matchesImporter = (item.importer || '').toLowerCase().includes(searchLower);
      const matchesBillOfEntry = (item.billOfEntry || '').toLowerCase().includes(searchLower);
      const matchesPort = (item.port || '').toLowerCase().includes(searchLower);
      const matchesTruck = (item.truckNo || '').toLowerCase().includes(searchLower);
      const matchesProduct = (item.productName || '').toLowerCase().includes(searchLower);
      const brandList = item.brand ? [item.brand] : (item.brandEntries || []).map(e => e.brand);
      const matchesBrand = brandList.some(b => (b || '').trim().toLowerCase().includes(searchLower));

      return matchesLC || matchesImporter || matchesBillOfEntry || matchesPort || matchesTruck || matchesProduct || matchesBrand;
    });
  }, [stockRecords, lcSearchQuery, lcFilters]);

  const lcReceiveSummary = useMemo(() => {
    const totalPackets = lcReceiveRecords.reduce((sum, item) => sum + (parseFloat(item.packet) || 0), 0);
    const totalQuantity = lcReceiveRecords.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

    // Count truckNo only once per unique product entry (date + lcNo + product + truck)
    const uniqueTrucksMap = lcReceiveRecords.reduce((acc, item) => {
      const key = `${item.date}-${item.lcNo}-${item.productName}-${item.truckNo}`;
      if (!acc[key]) {
        acc[key] = parseFloat(item.truckNo) || 0;
      }
      return acc;
    }, {});
    const totalTrucks = Object.values(uniqueTrucksMap).reduce((sum, val) => sum + val, 0);

    const unit = lcReceiveRecords[0]?.unit || 'kg';

    return { totalPackets, totalQuantity, totalTrucks, unit };
  }, [lcReceiveRecords]);

  const resetImporterForm = () => {
    setImporterFormData({
      name: '',
      address: '',
      contactPerson: '',
      email: '',
      phone: '',
      licenseNo: '',
      status: 'Active'
    });
    setEditingId(null);
    setSubmitStatus(null);
  };

  const resetPortForm = () => {
    setPortFormData({
      name: '',
      location: '',
      code: '',
      type: 'Seaport',
      status: 'Active'
    });
    setEditingId(null);
    setSubmitStatus(null);
  };



  const requestSort = (type, key) => {
    setSortConfig(prev => {
      let direction = 'asc';
      if (prev[type].key === key && prev[type].direction === 'asc') {
        direction = 'desc';
      }
      return {
        ...prev,
        [type]: { key, direction }
      };
    });
  };

  const sortData = (data, type) => {
    const { key, direction } = sortConfig[type];
    if (!key) return data;

    return [...data].sort((a, b) => {
      let aVal = a[key] || '';
      let bVal = b[key] || '';

      // Handle numeric values
      if (!isNaN(parseFloat(aVal)) && isFinite(aVal) && !isNaN(parseFloat(bVal)) && isFinite(bVal)) {
        aVal = parseFloat(aVal);
        bVal = parseFloat(bVal);
      } else {
        aVal = aVal.toString().toLowerCase();
        bVal = bVal.toString().toLowerCase();
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const filteredIpRecords = ipRecords.filter(record => {
    const recordDate = parseDate(record.openingDate);
    const now = new Date();

    // Quick Range Filter
    if (filters.quickRange === 'weekly') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      if (recordDate < oneWeekAgo) return false;
    } else if (filters.quickRange === 'monthly') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(now.getMonth() - 1);
      if (recordDate < oneMonthAgo) return false;
    } else if (filters.quickRange === 'yearly') {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      if (recordDate < oneYearAgo) return false;
    }

    // Custom Date Range
    if (filters.startDate && parseDate(record.openingDate) < parseDate(filters.startDate)) return false;
    if (filters.endDate && parseDate(record.openingDate) > parseDate(filters.endDate)) return false;

    // Port Filter
    if (filters.port && record.port !== filters.port) return false;

    // Importer Filter
    if (filters.importer && record.ipParty !== filters.importer) return false;

    return true;
  });


  const fetchIpRecords = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/ip-records`);
      if (response.ok) {
        const rawData = await response.json();
        const decryptedRecords = rawData.map(record => {
          const decrypted = decryptData(record.data);
          return { ...decrypted, _id: record._id, createdAt: record.createdAt };
        });
        setIpRecords(decryptedRecords);
      }
    } catch (error) {
      console.error('Error fetching IP records:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSelectedItems(new Set());
    setEditingId(null);
    localStorage.setItem('currentView', currentView);

    // Close all forms when changing sections
    setShowIpForm(false);
    setShowImporterForm(false);
    setShowPortForm(false);
    setShowStockForm(false);
    setActiveDropdown(null);
    setViewRecord(null);

    if (currentView === 'ip-section') {
      fetchIpRecords();
      fetchImporters(); // Fetch importers to populate the dropdown
      fetchPorts(); // Fetch ports to populate the dropdown
    } else if (currentView === 'importer-section') {
      fetchImporters();
    } else if (currentView === 'port-section') {
      fetchPorts();
    } else if (currentView === 'stock-section' || currentView === 'lc-entry-section') {
      fetchStockRecords();
      fetchPorts(); // Fetch ports to populate the dropdown
      fetchImporters(); // Fetch importers to populate the dropdown
      fetchProducts(); // Fetch products to populate the dropdown
    } else if (currentView === 'products-section') {
      fetchProducts();
    }



  }, [currentView]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Ignore LCReceive-specific dropdowns (managed by LCReceive itself)
      if (activeDropdown && activeDropdown.startsWith('lcr-')) return;

      // Handle product dropdowns (Stock and LC)
      if (activeDropdown && (activeDropdown.startsWith('product-') || activeDropdown.startsWith('lc-product-'))) {
        const parts = activeDropdown.split('-');
        const index = parseInt(parts[parts.length - 1]);
        if (productRefs.current[index] && !productRefs.current[index].contains(event.target)) {
          setActiveDropdown(null);
        }
        return;
      }

      // Handle brand dropdowns
      if (activeDropdown && activeDropdown.startsWith('brand-')) {
        const parts = activeDropdown.split('-');
        const key = `${parts[1]}-${parts[2]}`;
        if (brandRefs.current[key] && !brandRefs.current[key].contains(event.target)) {
          setActiveDropdown(null);
        }
        return;
      }

      if (
        (portRef.current && !portRef.current.contains(event.target)) &&
        (importerRef.current && !importerRef.current.contains(event.target)) &&
        (ipPortRef.current && !ipPortRef.current.contains(event.target)) &&
        (ipImporterRef.current && !ipImporterRef.current.contains(event.target)) &&
        (filterPortRef.current && !filterPortRef.current.contains(event.target)) &&
        (filterImporterRef.current && !filterImporterRef.current.contains(event.target))
      ) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeDropdown]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [activeDropdown]);

  const getFilteredOptions = (type) => {
    switch (type) {

      case 'ipPort':
        return ports.filter(p => p.status === 'Active' && (!formData.port || ports.some(x => x.name === formData.port) || p.name.toLowerCase().includes(formData.port.toLowerCase())));
      case 'ipImporter':
        return importers.filter(imp => imp.status === 'Active' && (!formData.ipParty || importers.some(x => x.name === formData.ipParty) || imp.name.toLowerCase().includes(formData.ipParty.toLowerCase())));
      case 'filterPort':
        return ports.filter(p => p.status === 'Active' && (!filters.port || ports.some(x => x.name === filters.port) || p.name.toLowerCase().includes(filters.port.toLowerCase())));
      case 'filterImporter':
        return importers.filter(imp => imp.status === 'Active' && (!filters.importer || importers.some(x => x.name === filters.importer) || imp.name.toLowerCase().includes(filters.importer.toLowerCase())));
      case 'lcFilterLcNo': {
        const lcOptions = [...new Set(stockRecords.map(item => (item.lcNo || '').trim()).filter(Boolean))].sort();
        return lcOptions.filter(lc => !filterSearchInputs.lcNoSearch || lc.toLowerCase().includes(filterSearchInputs.lcNoSearch.toLowerCase())).map(lc => ({ name: lc }));
      }
      case 'lcFilterPort': {
        const portOptions = [...new Set(stockRecords.map(item => (item.port || '').trim()).filter(Boolean))].sort();
        return portOptions.filter(p => !filterSearchInputs.portSearch || p.toLowerCase().includes(filterSearchInputs.portSearch.toLowerCase())).map(p => ({ name: p }));
      }
      case 'lcFilterIndCnf': {
        const options = [...new Set(stockRecords.map(item => (item.indianCnF || '').trim()).filter(Boolean))].sort();
        return options.filter(opt => !filterSearchInputs.indCnfSearch || opt.toLowerCase().includes(filterSearchInputs.indCnfSearch.toLowerCase())).map(opt => ({ name: opt }));
      }
      case 'lcFilterBdCnf': {
        const options = [...new Set(stockRecords.map(item => (item.bdCnF || '').trim()).filter(Boolean))].sort();
        return options.filter(opt => !filterSearchInputs.bdCnfSearch || opt.toLowerCase().includes(filterSearchInputs.bdCnfSearch.toLowerCase())).map(opt => ({ name: opt }));
      }
      case 'lcFilterBillOfEntry': {
        const options = [...new Set(stockRecords.map(item => (item.billOfEntry || '').trim()).filter(Boolean))].sort();
        return options.filter(opt => !filterSearchInputs.billOfEntrySearch || opt.toLowerCase().includes(filterSearchInputs.billOfEntrySearch.toLowerCase())).map(opt => ({ name: opt }));
      }
      case 'lcFilterProduct': {
        const options = [...new Set(stockRecords.map(item => (item.productName || '').trim()).filter(Boolean))].sort();
        return options.filter(opt => !filterSearchInputs.productSearch || opt.toLowerCase().includes(filterSearchInputs.productSearch.toLowerCase())).map(opt => ({ name: opt }));
      }
      case 'lcFilterBrand': {
        const productFilteredRecords = lcFilters.productName
          ? stockRecords.filter(item => (item.productName || '').trim().toLowerCase() === lcFilters.productName.toLowerCase())
          : stockRecords;
        const options = [...new Set(productFilteredRecords.flatMap(item => {
          if (item.brand) return [(item.brand || '').trim()];
          return (item.brandEntries || []).map(e => (e.brand || '').trim());
        }).filter(Boolean))].sort();
        return options.filter(opt => !filterSearchInputs.brandSearch || opt.toLowerCase().includes(filterSearchInputs.brandSearch.toLowerCase())).map(opt => ({ name: opt }));
      }
      default:

        return [];
    }
  };

  const handleDropdownKeyDown = (e, type, selectHandler, fieldName) => {
    const options = getFilteredOptions(type);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (activeDropdown !== type) setActiveDropdown(type);
      setHighlightedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (activeDropdown !== type) setActiveDropdown(type);
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < options.length) {
        e.preventDefault();
        selectHandler(fieldName, options[highlightedIndex].name);
      }
    } else if (e.key === 'Escape') {
      setActiveDropdown(null);
    }
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
    } else if (newSelection.size > 0) {
      setIsSelectionMode(true);
    }
  };

  // Auto-synchronize Total LC Truck and Quantity in the form

  // Click-outside detection for filter dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Find which filter is currently open
      const openKey = Object.keys(filterDropdownOpen).find(key => filterDropdownOpen[key]);
      if (!openKey) return;

      // Map open keys to their corresponding DOM containers (refs)
      let refsToCheck = [];
      if (openKey === 'lcNo') {
        refsToCheck = [lcNoFilterRef, reportLcNoFilterRef];
      } else if (openKey === 'port') {
        refsToCheck = [portFilterRef, reportPortFilterRef];
      } else if (openKey === 'brand') {
        refsToCheck = [brandFilterRef, reportBrandFilterRef];
      } else if (openKey === 'product') {
        refsToCheck = [reportProductFilterRef];
      } else if (openKey === 'indCnf') {
        refsToCheck = [reportLcIndCnfFilterRef];
      } else if (openKey === 'bdCnf') {
        refsToCheck = [reportLcBdCnfFilterRef];
      } else if (openKey === 'billOfEntry') {
        refsToCheck = [reportLcBillOfEntryFilterRef];
      }

      // If click is outside all associated refs for the open dropdown, close it
      const isOutside = refsToCheck.filter(ref => ref && ref.current).every(ref => !ref.current.contains(event.target));
      if (isOutside) {
        setFilterDropdownOpen(initialFilterDropdownState);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [filterDropdownOpen]);

  // Click-outside detection for filter panel
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showHistoryFilterPanel &&
        historyFilterRef.current &&
        !historyFilterRef.current.contains(event.target) &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(event.target)
      ) {
        setShowHistoryFilterPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHistoryFilterPanel]);

  // Click-outside detection for stock filter panel



  // Click-outside detection for stock report filter panel

  // Click-outside detection for LC report filter panel
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showLcReportFilterPanel &&
        lcReportFilterRef.current &&
        !lcReportFilterRef.current.contains(event.target) &&
        lcReportFilterButtonRef.current &&
        !lcReportFilterButtonRef.current.contains(event.target)
      ) {
        setShowLcReportFilterPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLcReportFilterPanel]);

  const toggleSelectAll = (items) => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
      setIsSelectionMode(false);
    } else {
      setSelectedItems(new Set(items.map(item => item._id)));
      setIsSelectionMode(true);
    }
  };

  const startLongPress = (id) => {
    isLongPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      if (id) {
        toggleSelection(id);
      } else {
        setIsSelectionMode(true);
      }
    }, 700); // 700ms for long press
  };
  const toggleStockGroupSelection = (productName) => {
    const records = stockRecords.filter(item =>
      (item.productName || '').trim().toLowerCase() === productName.toLowerCase()
    );
    const ids = records.map(r => r._id);
    const newSelection = new Set(selectedItems);

    // Check if the whole group is already selected
    const allSelected = ids.every(id => newSelection.has(id));

    if (allSelected) {
      // Deselect all
      ids.forEach(id => newSelection.delete(id));
    } else {
      // Select all
      ids.forEach(id => newSelection.add(id));
    }

    setSelectedItems(newSelection);
    setIsSelectionMode(newSelection.size > 0);
  };

  const isStockGroupSelected = (productName) => {
    const records = stockRecords.filter(item =>
      (item.productName || '').trim().toLowerCase() === productName.toLowerCase()
    );
    if (records.length === 0) return false;
    return records.every(r => selectedItems.has(r._id));
  };
  const endLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDelete = (type, id, isBulk = false) => {
    setDeleteConfirm({ show: true, type, id, isBulk });
  };

  const confirmDelete = async () => {
    const { type, id, isBulk } = deleteConfirm;
    const endpoint = type === 'ip' ? 'ip-records' : type === 'importer' ? 'importers' : type === 'port' ? 'ports' : type === 'product' ? 'products' : 'stock';


    try {
      if (isBulk) {
        // Bulk delete logic
        await Promise.all(Array.from(selectedItems).map(itemId =>
          fetch(`${API_BASE_URL}/api/${endpoint}/${itemId}`, { method: 'DELETE' })
        ));
        setSelectedItems(new Set());
      } else {
        // Single delete
        await fetch(`${API_BASE_URL}/api/${endpoint}/${id}`, { method: 'DELETE' });
      }

      if (type === 'ip') fetchIpRecords();
      else if (type === 'importer') fetchImporters();
      else if (type === 'port') fetchPorts();
      else if (type === 'stock') fetchStockRecords();
      else if (type === 'product') fetchProducts();

      setDeleteConfirm({ show: false, type: '', id: null, isBulk: false });
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleEdit = (type, item) => {
    setEditingId(item._id);
    if (type === 'ip') {
      setFormData(item);
      setShowIpForm(true);
    } else if (type === 'importer') {
      setImporterFormData(item);
      setShowImporterForm(true);
    } else if (type === 'port') {
      setPortFormData(item);
      setShowPortForm(true);
    } else if (type === 'stock') {
      // Convert single record to productEntries format for editing
      const formattedData = {
        date: item.date,
        lcNo: item.lcNo,
        indianCnF: item.indianCnF,
        indCnFCost: item.indCnFCost,
        bdCnF: item.bdCnF,
        bdCnFCost: item.bdCnFCost,
        billOfEntry: item.billOfEntry || '',
        port: item.port || '',
        importer: item.importer || '',
        status: item.status || 'In Stock',
        totalLcTruck: item.totalLcTruck || '',
        totalLcQuantity: item.totalLcQuantity || '',
        allIds: item.allIds || [item._id],
        productEntries: (() => {
          if (!item.entries || item.entries.length === 0) {
            return [{
              productName: item.productName || item.brand || '',
              truckNo: item.truckNo || '',
              isMultiBrand: item.isMultiBrand || false,
              brandEntries: [{
                brand: item.brand || '',
                purchasedPrice: item.purchasedPrice || '',
                packet: item.packet || '',
                packetSize: item.packetSize || '',
                quantity: item.quantity || '',
                inHousePacket: item.inHousePacket || '',
                inHouseQuantity: item.inHouseQuantity || '',
                sweepedPacket: item.sweepedPacket || '',
                sweepedQuantity: item.sweepedQuantity || '',
                unit: item.unit || 'kg'
              }]
            }];
          }
          // Group entries by productName and truckNo
          const productMap = item.entries.reduce((acc, ent) => {
            const pKey = `${ent.productName || ent.brand}-${ent.truckNo}`;
            if (!acc[pKey]) {
              acc[pKey] = {
                productName: ent.productName || ent.brand || '',
                truckNo: ent.truckNo || '',
                isMultiBrand: ent.isMultiBrand,
                brandEntries: []
              };
            }
            acc[pKey].brandEntries.push({
              brand: ent.brand || '',
              purchasedPrice: ent.purchasedPrice || '',
              packet: ent.packet || '',
              packetSize: ent.packetSize || '',
              quantity: ent.quantity || '',
              inHousePacket: ent.inHousePacket || '',
              inHouseQuantity: ent.inHouseQuantity || '',
              sweepedPacket: ent.sweepedPacket || '',
              sweepedQuantity: ent.sweepedQuantity || '',
              unit: ent.unit || 'kg'
            });
            return acc;
          }, {});
          const result = Object.values(productMap);
          return result;
        })()
      };
      setStockFormData(formattedData);
      setShowStockForm(true);
    }
  };


  const fetchImporters = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/importers`);
      if (response.ok) {
        const rawData = await response.json();
        const decryptedImporters = rawData.map(record => {
          const decrypted = decryptData(record.data);
          return { ...decrypted, _id: record._id, createdAt: record.createdAt };
        });
        setImporters(decryptedImporters);
      }
    } catch (error) {
      console.error('Error fetching importers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = (type, record) => {
    setViewRecord({ type, data: record });
  };

  const handleImporterInputChange = (e) => {
    const { name, value } = e.target;
    setImporterFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImporterSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const url = editingId
        ? `${API_BASE_URL}/api/importers/${editingId}`
        : `${API_BASE_URL}/api/importers`;
      const encryptedPayload = { data: encryptData(importerFormData) };
      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(encryptedPayload),
      });

      if (response.ok) {
        setSubmitStatus('success');
        fetchImporters();
        setTimeout(() => {
          setShowImporterForm(false);
          setEditingId(null);
          setImporterFormData({
            name: '',
            address: '',
            contactPerson: '',
            email: '',
            phone: '',
            licenseNo: '',
            status: 'Active'
          });
          setSubmitStatus(null);
        }, 2000);
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Error saving importer:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchPorts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/ports`);
      if (response.ok) {
        const rawData = await response.json();
        const decryptedPorts = rawData.map(record => {
          const decrypted = decryptData(record.data);
          return { ...decrypted, _id: record._id, createdAt: record.createdAt };
        });
        setPorts(decryptedPorts);
      }
    } catch (error) {
      console.error('Error fetching ports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePortInputChange = (e) => {
    const { name, value } = e.target;
    setPortFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePortSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const url = editingId
        ? `${API_BASE_URL}/api/ports/${editingId}`
        : `${API_BASE_URL}/api/ports`;
      const encryptedPayload = { data: encryptData(portFormData) };
      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(encryptedPayload),
      });

      if (response.ok) {
        setSubmitStatus('success');
        fetchPorts();
        setTimeout(() => {
          setShowPortForm(false);
          setEditingId(null);
          setPortFormData({
            name: '',
            location: '',
            code: '',
            type: 'Seaport',
            status: 'Active'
          });
          setSubmitStatus(null);
        }, 2000);
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Error saving port:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteStockGroup = async (ids) => {
    if (!window.confirm(`Are you sure you want to delete this shipment (${ids.length} records)?`)) return;
    try {
      const results = await Promise.all(ids.map(async (id) => {
        const response = await fetch(`${API_BASE_URL}/api/stock/${id}`, { method: 'DELETE' });
        return response.ok;
      }));

      if (results.every(res => res)) {
        fetchStockRecords();
      } else {
        alert('Some records could not be deleted');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const fetchStockRecords = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stock`);
      if (response.ok) {
        const rawData = await response.json();
        const decryptedRecords = rawData.map(record => {
          const decrypted = decryptData(record.data);
          return { ...decrypted, _id: record._id, createdAt: record.createdAt };
        });
        setStockRecords(decryptedRecords);
      }
    } catch (error) {
      console.error('Error fetching stock:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Products CRUD Functions
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/products`);
      if (response.ok) {
        const rawData = await response.json();
        const decryptedProducts = rawData.map(record => {
          const decrypted = decryptData(record.data);
          return { ...decrypted, _id: record._id, createdAt: record.createdAt };
        });
        setProducts(decryptedProducts);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setIsLoading(false);
    }
  };





  const handleIpDropdownSelect = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setActiveDropdown(null);
  };

  const handleFilterDropdownSelect = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setActiveDropdown(null);
  };



  const getFilteredProducts = (query) => {
    if (!query) return products;

    // If query exactly matches a product name, show all products (allows user to see alternatives)
    const exactMatch = products.some(p => p.name.toLowerCase() === query.toLowerCase());
    if (exactMatch) return products;

    return products.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      (p.hsCode && p.hsCode.toLowerCase().includes(query.toLowerCase()))
    );
  };

  const getFilteredBrands = (query, currentProductName) => {
    if (!currentProductName) return [];

    const selectedProduct = products.find(p => p.name === currentProductName);
    if (!selectedProduct) return [];

    // Determine base list (only from the selected product)
    let baseBrands = [];
    if (selectedProduct.brands && selectedProduct.brands.length > 0) {
      baseBrands = selectedProduct.brands.map(b => b.brand).filter(Boolean);
    } else if (selectedProduct.brand) {
      // Handle products that might still have a single top-level brand field
      baseBrands = [selectedProduct.brand];
    }

    if (!query) return baseBrands;

    // If query exactly matches a brand in our list, show all brands in the base list
    const exactMatch = baseBrands.some(b => b.toLowerCase() === query.toLowerCase());
    if (exactMatch) return baseBrands;

    return baseBrands.filter(b => b.toLowerCase().includes(query.toLowerCase()));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const url = editingId
        ? `${API_BASE_URL}/api/ip-records/${editingId}`
        : `${API_BASE_URL}/api/ip-records`;
      const encryptedPayload = { data: encryptData(formData) };
      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(encryptedPayload),
      });

      if (response.ok) {
        setSubmitStatus('success');
        fetchIpRecords(); // Refresh list
        // Reset form after 2 seconds and close
        setTimeout(() => {
          setShowIpForm(false);
          setEditingId(null);
          setFormData({
            openingDate: '',
            closeDate: '',
            ipNumber: '',
            referenceNo: '',
            ipParty: '',
            productName: '',
            quantity: '',
            port: '',
            status: 'Active'
          });
          setSubmitStatus(null);
        }, 2000);
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Error saving IP record:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <div className="flex flex-col items-center justify-center h-[80vh] text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome to ANI Enterprise ERP</h2>
            <p className="text-gray-500">Select an option from the sidebar to get started.</p>
          </div>
        );
      case 'lc-entry-section':
        return (
          <LCReceive
            stockRecords={stockRecords}
            fetchStockRecords={fetchStockRecords}
            importers={importers}
            ports={ports}
            products={products}
            lcSearchQuery={lcSearchQuery}
            setLcSearchQuery={setLcSearchQuery}
            lcFilters={lcFilters}
            setLcFilters={setLcFilters}
            lcReceiveRecords={lcReceiveRecords}
            lcReceiveSummary={lcReceiveSummary}
            activeDropdown={activeDropdown}
            setActiveDropdown={setActiveDropdown}
            highlightedIndex={highlightedIndex}
            setHighlightedIndex={setHighlightedIndex}
            isSelectionMode={isSelectionMode}
            setIsSelectionMode={setIsSelectionMode}
            selectedItems={selectedItems}
            setSelectedItems={setSelectedItems}
            startLongPress={startLongPress}
            endLongPress={endLongPress}
            isLongPressTriggered={isLongPressTriggered}
            onDelete={handleDelete}
            setShowLcReport={setShowLcReport}
            stockFormData={stockFormData}
            setStockFormData={setStockFormData}
            showStockForm={showStockForm}
            setShowStockForm={setShowStockForm}
            editingId={editingId}
            setEditingId={setEditingId}
            isSubmitting={isSubmitting}
            setIsSubmitting={setIsSubmitting}
            submitStatus={submitStatus}
            setSubmitStatus={setSubmitStatus}
          />
        );


      case 'ip-section':
        return (
          <IPManagement
            isSelectionMode={isSelectionMode}
            setIsSelectionMode={setIsSelectionMode}
            selectedItems={selectedItems}
            setSelectedItems={setSelectedItems}
            editingId={editingId}
            setEditingId={setEditingId}
            sortConfig={sortConfig}
            setSortConfig={setSortConfig}
            onDeleteConfirm={setDeleteConfirm}
            startLongPress={startLongPress}
            endLongPress={endLongPress}
            isLongPressTriggered={isLongPressTriggered}
            importers={importers}
            ports={ports}
          />
        );
      case 'importer-section':
        return (
          <Importer
            isSelectionMode={isSelectionMode}
            setIsSelectionMode={setIsSelectionMode}
            selectedItems={selectedItems}
            setSelectedItems={setSelectedItems}
            editingId={editingId}
            setEditingId={setEditingId}
            sortConfig={sortConfig}
            setSortConfig={setSortConfig}
            onDeleteConfirm={setDeleteConfirm}
            startLongPress={startLongPress}
            endLongPress={endLongPress}
            isLongPressTriggered={isLongPressTriggered}
          />
        );
      case 'port-section':
        return (
          <Port
            isSelectionMode={isSelectionMode}
            setIsSelectionMode={setIsSelectionMode}
            selectedItems={selectedItems}
            setSelectedItems={setSelectedItems}
            editingId={editingId}
            setEditingId={setEditingId}
            sortConfig={sortConfig}
            setSortConfig={setSortConfig}
            onDeleteConfirm={setDeleteConfirm}
            startLongPress={startLongPress}
            endLongPress={endLongPress}
            isLongPressTriggered={isLongPressTriggered}
          />
        );
      case "stock-section":
        return (
          <StockManagement
            stockRecords={stockRecords}
            setStockRecords={setStockRecords}
            products={products}
            deleteConfirm={deleteConfirm}
            setDeleteConfirm={setDeleteConfirm}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isLoading={isLoading}
            fetchStockRecords={fetchStockRecords}
            stockFormData={stockFormData}
            setStockFormData={setStockFormData}
            showStockForm={showStockForm}
            setShowStockForm={setShowStockForm}
            editingId={editingId}
            setEditingId={setEditingId}
            isSubmitting={isSubmitting}
            setIsSubmitting={setIsSubmitting}
            submitStatus={submitStatus}
            setSubmitStatus={setSubmitStatus}
            showStockReport={showStockReport}
            setShowStockReport={setShowStockReport}
            stockFilters={stockFilters}
            setStockFilters={setStockFilters}
          />
        );
      case 'products-section':
        return (
          <ProductManagement
            products={products}
            fetchProducts={fetchProducts}
          />
        );
      case 'warehouse-section':
        return (
          <WarehouseManagement />
        );
      default:
        return null;
    }
  };

  const stockData = useMemo(() => {
    return calculateStockData(stockRecords, stockFilters, '');
  }, [stockRecords, stockFilters]);

  return (
    <div className={`flex h-screen bg-gray-50 font-sans text-gray-900 ${(showLcReport || showStockReport) ? 'is-printing-report' : ''}`}>

      {/* Sidebar Backdrop for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-40 md:hidden animate-in fade-in duration-300 no-print"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white text-gray-900 border-r border-gray-200 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 flex flex-col print:hidden`}>
        <div className="p-5 border-b border-gray-200 bg-gray-50/50">
          <div className="flex items-center">
            <img src="https://ui-avatars.com/api/?name=Admin+User&background=3b82f6&color=fff" alt="Admin" className="w-12 h-12 rounded-full border-2 border-white shadow-md transition-transform hover:scale-105" />
            <div className="ml-4">
              <p className="text-base font-bold text-gray-900 leading-tight">Admin User</p>
              <p className="text-sm text-blue-600 font-medium hover:underline cursor-pointer">View Profile</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          <button onClick={() => { setCurrentView('dashboard'); setSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-lg transition-all ${currentView === 'dashboard' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
            <HomeIcon className="w-5 h-5 mr-3" />
            <span className="font-medium">Dashboard</span>
          </button>
          <button onClick={() => { setCurrentView('importer-section'); setSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-lg transition-all ${currentView === 'importer-section' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
            <UsersIcon className="w-5 h-5 mr-3" />
            <span className="font-medium">Importer</span>
          </button>
          <button onClick={() => { setCurrentView('port-section'); setSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-lg transition-all ${currentView === 'port-section' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
            <AnchorIcon className="w-5 h-5 mr-3" />
            <span className="font-medium">Port</span>
          </button>
          <button onClick={() => { setCurrentView('ip-section'); setSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-lg transition-all ${currentView === 'ip-section' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
            <BoxIcon className="w-5 h-5 mr-3" />
            <span className="font-medium">IP</span>
          </button>
          <button onClick={() => { setCurrentView('lc-entry-section'); setSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-lg transition-all ${currentView === 'lc-entry-section' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
            <DollarSignIcon className="w-5 h-5 mr-3" />
            <span className="font-medium">LC Receive</span>
          </button>
          <div>
            <button
              onClick={() => setStockDropdownOpen(!stockDropdownOpen)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${currentView.includes('stock') || currentView === 'products-section' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <div className="flex items-center">
                <ShoppingCartIcon className="w-5 h-5 mr-3" />
                <span className="font-medium">Stock</span>
              </div>
              <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${stockDropdownOpen ? 'transform rotate-180' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${stockDropdownOpen ? 'max-h-40 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
              <div className="pl-12 pr-4 space-y-1">
                <button
                  onClick={() => { setCurrentView('stock-section'); setSidebarOpen(false); }}
                  className={`w-full text-left py-2 px-3 rounded-md text-sm transition-colors ${currentView === 'stock-section' ? 'text-blue-600 bg-blue-50/50 font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                >
                  Stock Management
                </button>
                <button
                  onClick={() => { setCurrentView('warehouse-section'); setSidebarOpen(false); }}
                  className={`w-full text-left py-2 px-3 rounded-md text-sm transition-colors ${currentView === 'warehouse-section' ? 'text-blue-600 bg-blue-50/50 font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                >
                  Ware House
                </button>
                <button
                  onClick={() => { setCurrentView('products-section'); setSidebarOpen(false); }}
                  className={`w-full text-left py-2 px-3 rounded-md text-sm transition-colors ${currentView === 'products-section' ? 'text-blue-600 bg-blue-50/50 font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                >
                  Products
                </button>
              </div>
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col overflow-hidden ${(showLcReport || showStockReport) ? 'print:hidden' : ''}`}>
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm print:hidden">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100">
              <MenuIcon className="w-6 h-6" />
            </button>
            <div className="ml-4 md:ml-0">
              <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
                ANI Enterprise ERP
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
              <BellIcon className="w-6 h-6" />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className={`flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6 ${(showLcReport || showStockReport) ? 'no-print' : ''}`}>
          {renderContent()}
        </main>
      </div>

      {/* Custom Deletion Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setDeleteConfirm({ show: false, type: '', id: null, isBulk: false })}></div>
          <div className="relative bg-white/80 backdrop-blur-2xl border border-white/50 rounded-2xl shadow-2xl p-8 max-w-md w-full animate-in zoom-in duration-300">
            <div className="flex items-center justify-center w-16 h-16 bg-red-100/50 rounded-full mx-auto mb-6">
              <TrashIcon className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Delete Confirmation</h3>
            <p className="text-gray-600 text-center mb-8">
              {deleteConfirm.isBulk
                ? `Are you sure you want to delete ${selectedItems.size} items? This action cannot be undone.`
                : "Are you sure you want to delete this record? This action cannot be undone."}
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setDeleteConfirm({ show: false, type: '', id: null, isBulk: false })}
                className="flex-1 px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl shadow-lg shadow-red-500/30 transition-all transform hover:scale-105"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* View Detail Modal */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setViewRecord(null)}></div>
          <div className="relative bg-white/95 backdrop-blur-2xl border border-white/50 rounded-3xl shadow-2xl max-w-[95vw] w-full animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10 rounded-t-3xl">
              <div className="w-1/4">
                <h3 className="text-2xl font-bold text-gray-900">Stock History - {viewRecord.data.productName}</h3>
              </div>

              {/* Center Aligned Search Bar */}
              <div className="flex-1 max-w-md mx-auto relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Search by LC, Port, Importer, Truck or Brand..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                />
              </div>

              <div className="w-1/4 flex justify-end items-center gap-2">
                <div className="relative">
                  <button
                    ref={filterButtonRef}
                    onClick={() => setShowHistoryFilterPanel(!showHistoryFilterPanel)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${showHistoryFilterPanel || Object.values(historyFilters).some(v => v !== '')
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    <FunnelIcon className={`w-4 h-4 ${showHistoryFilterPanel || Object.values(historyFilters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                    <span className="text-sm font-medium">Filter</span>
                  </button>

                  {/* Floating Filter Panel */}
                  {showHistoryFilterPanel && (
                    <div ref={historyFilterRef} className="absolute right-0 mt-3 w-80 bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[60] p-5 animate-in fade-in zoom-in duration-200">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                        <h4 className="font-bold text-gray-900">Advanced Filters</h4>
                        <button
                          onClick={() => {
                            setHistoryFilters({ startDate: '', endDate: '', lcNo: '', port: '', brand: '' });
                            setShowHistoryFilterPanel(false);
                          }}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                        >
                          Reset All
                        </button>
                      </div>

                      <div className="space-y-4">
                        {/* Date Range */}
                        <div className="grid grid-cols-2 gap-3">
                          <CustomDatePicker
                            label="FROM DATE"
                            value={historyFilters.startDate}
                            onChange={(e) => setHistoryFilters({ ...historyFilters, startDate: e.target.value })}
                            placeholder="Select start date"
                            name="startDate"
                            labelClassName="text-[11px] font-bold text-gray-400 uppercase tracking-wider"
                            compact={true}
                          />
                          <CustomDatePicker
                            label="TO DATE"
                            value={historyFilters.endDate}
                            onChange={(e) => setHistoryFilters({ ...historyFilters, endDate: e.target.value })}
                            placeholder="Select end date"
                            name="endDate"
                            labelClassName="text-[11px] font-bold text-gray-400 uppercase tracking-wider"
                            compact={true}
                            rightAlign={true}
                          />
                        </div>

                        {/* LC No Selection */}
                        <div className="space-y-1.5 relative" ref={lcNoFilterRef}>
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">LC No</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={filterSearchInputs.lcNoSearch}
                              onChange={(e) => {
                                setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: e.target.value });
                                setFilterDropdownOpen({ ...initialFilterDropdownState, lcNo: true });
                              }}
                              onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, lcNo: true })}
                              placeholder={historyFilters.lcNo || "Search LC No..."}
                              className="w-full px-3 py-2 pr-8 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300"
                            />
                            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            {historyFilters.lcNo && (
                              <button
                                onClick={() => {
                                  setHistoryFilters({ ...historyFilters, lcNo: '' });
                                  setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: '' });
                                }}
                                className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                <XIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {filterDropdownOpen.lcNo && (() => {
                            const lcOptions = [...new Set(stockRecords
                              .filter(item => (item.productName || '').trim().toLowerCase() === (viewRecord.data.productName || '').trim().toLowerCase())
                              .map(item => (item.lcNo || '').trim())
                              .filter(Boolean)
                            )].sort();
                            const filtered = lcOptions.filter(lc =>
                              lc.toLowerCase().includes(filterSearchInputs.lcNoSearch.toLowerCase())
                            );
                            return filtered.length > 0 ? (
                              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map(lc => (
                                  <button
                                    key={lc}
                                    type="button"
                                    onClick={() => {
                                      setHistoryFilters({ ...historyFilters, lcNo: lc });
                                      setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: '' });
                                      setFilterDropdownOpen(initialFilterDropdownState);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                  >
                                    {lc}
                                  </button>
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </div>

                        {/* Port Selection */}
                        <div className="space-y-1.5 relative" ref={portFilterRef}>
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Port</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={filterSearchInputs.portSearch}
                              onChange={(e) => {
                                setFilterSearchInputs({ ...filterSearchInputs, portSearch: e.target.value });
                                setFilterDropdownOpen({ ...initialFilterDropdownState, port: true });
                              }}
                              onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, port: true })}
                              placeholder={historyFilters.port || "Search Port..."}
                              className="w-full px-3 py-2 pr-8 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300"
                            />
                            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            {historyFilters.port && (
                              <button
                                onClick={() => {
                                  setHistoryFilters({ ...historyFilters, port: '' });
                                  setFilterSearchInputs({ ...filterSearchInputs, portSearch: '' });
                                }}
                                className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                <XIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {filterDropdownOpen.port && (() => {
                            const portOptions = [...new Set(stockRecords
                              .filter(item => (item.productName || '').trim().toLowerCase() === (viewRecord.data.productName || '').trim().toLowerCase())
                              .map(item => (item.port || '').trim())
                              .filter(Boolean)
                            )].sort();
                            const filtered = portOptions.filter(port =>
                              port.toLowerCase().includes(filterSearchInputs.portSearch.toLowerCase())
                            );
                            return filtered.length > 0 ? (
                              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map(port => (
                                  <button
                                    key={port}
                                    type="button"
                                    onClick={() => {
                                      setHistoryFilters({ ...historyFilters, port });
                                      setFilterSearchInputs({ ...filterSearchInputs, portSearch: '' });
                                      setFilterDropdownOpen(initialFilterDropdownState);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                  >
                                    {port}
                                  </button>
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </div>

                        {/* Brand Selection */}
                        <div className="space-y-1.5 relative" ref={brandFilterRef}>
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Brand</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={filterSearchInputs.brandSearch}
                              onChange={(e) => {
                                setFilterSearchInputs({ ...filterSearchInputs, brandSearch: e.target.value });
                                setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true });
                              }}
                              onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true })}
                              placeholder={historyFilters.brand || "Search Brand..."}
                              className="w-full px-3 py-2 pr-8 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300"
                            />
                            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            {historyFilters.brand && (
                              <button
                                onClick={() => {
                                  setHistoryFilters({ ...historyFilters, brand: '' });
                                  setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' });
                                }}
                                className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                <XIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {filterDropdownOpen.brand && (() => {
                            const brandOptions = [...new Set(stockRecords
                              .filter(item => (item.productName || '').trim().toLowerCase() === (viewRecord.data.productName || '').trim().toLowerCase())
                              .flatMap(item => (item.brand ? [item.brand] : (item.entries || []).map(e => e.brand)))
                              .map(brand => (brand || '').trim())
                              .filter(Boolean)
                            )].sort();
                            const filtered = brandOptions.filter(brand =>
                              brand.toLowerCase().includes(filterSearchInputs.brandSearch.toLowerCase())
                            );
                            return filtered.length > 0 ? (
                              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map(brand => (
                                  <button
                                    key={brand}
                                    type="button"
                                    onClick={() => {
                                      setHistoryFilters({ ...historyFilters, brand });
                                      setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' });
                                      setFilterDropdownOpen(initialFilterDropdownState);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                  >
                                    {brand}
                                  </button>
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </div>

                        <button
                          onClick={() => setShowHistoryFilterPanel(false)}
                          className="w-full py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-all mt-2"
                        >
                          Apply Filters
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={() => { setViewRecord(null); setHistorySearchQuery(''); setHistoryFilters({ startDate: '', endDate: '', lcNo: '', port: '', brand: '' }); setShowHistoryFilterPanel(false); }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <XIcon className="w-6 h-6 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-8 flex-1 overflow-y-auto">
              {(() => {
                const searchLower = historySearchQuery.toLowerCase().trim();
                const filteredRaw = stockRecords.filter(item => {
                  const matchesProduct = (item.productName || '').trim().toLowerCase() === (viewRecord.data.productName || '').trim().toLowerCase();
                  if (!matchesProduct) return false;

                  // Apply Advanced Filters
                  if (historyFilters.startDate && item.date < historyFilters.startDate) return false;
                  if (historyFilters.endDate && item.date > historyFilters.endDate) return false;
                  if (historyFilters.lcNo && (item.lcNo || '').trim() !== historyFilters.lcNo) return false;
                  if (historyFilters.port && (item.port || '').trim() !== historyFilters.port) return false;
                  if (historyFilters.brand) {
                    const itemBrand = (item.brand || item.productName || '').trim().toLowerCase();
                    const filterBrand = historyFilters.brand.toLowerCase();
                    if (itemBrand !== filterBrand) return false;
                  }

                  // Apply Search Query
                  if (!searchLower) return true;

                  const matchesLC = (item.lcNo || '').trim().toLowerCase().includes(searchLower);
                  const matchesPort = (item.port || '').trim().toLowerCase().includes(searchLower);
                  const matchesImporter = (item.importer || '').trim().toLowerCase().includes(searchLower);
                  const matchesTruck = (item.truckNo || '').trim().toLowerCase().includes(searchLower);
                  const brandList = item.brand ? [item.brand] : (item.entries || []).map(e => e.brand);
                  const matchesBrand = brandList.some(b => (b || '').trim().toLowerCase().includes(searchLower));

                  return matchesLC || matchesPort || matchesImporter || matchesTruck || matchesBrand;
                });

                // Group by date, lcNo, and truckNo
                const groupedHistoryMap = filteredRaw.reduce((acc, item) => {
                  const key = `${item.date}_${item.lcNo}_${item.truckNo}`;
                  const quantity = parseFloat(item.quantity) || 0;
                  const packet = parseFloat(item.packet) || 0;
                  const inHousePacket = parseFloat(item.inHousePacket || item.packet) || 0;
                  const inHouseQuantity = parseFloat(item.inHouseQuantity || item.quantity) || 0;
                  const sweepedQuantity = parseFloat(item.sweepedQuantity) || 0;

                  if (!acc[key]) {
                    acc[key] = {
                      ...item,
                      allIds: [item._id],
                      totalQuantity: quantity,
                      totalPacket: packet,
                      totalInHousePacket: inHousePacket,
                      totalInHouseQuantity: inHouseQuantity,
                      totalShortage: sweepedQuantity,
                      isGrouped: false,
                      entries: [
                        {
                          brand: item.brand || item.productName,
                          purchasedPrice: item.purchasedPrice,
                          packet: item.packet,
                          packetSize: item.packetSize,
                          quantity: item.quantity,
                          inHousePacket: item.inHousePacket || item.packet,
                          inHouseQuantity: item.inHouseQuantity || item.quantity,
                          sweepedPacket: item.sweepedPacket,
                          sweepedQuantity: item.sweepedQuantity,
                          unit: item.unit,
                          totalLcTruck: item.totalLcTruck,
                          totalLcQuantity: item.totalLcQuantity
                        }
                      ]
                    };
                  } else {
                    acc[key].allIds.push(item._id);
                    acc[key].totalQuantity += quantity;
                    acc[key].totalPacket += packet;
                    acc[key].totalInHousePacket += inHousePacket;
                    acc[key].totalInHouseQuantity += inHouseQuantity;
                    acc[key].totalShortage += sweepedQuantity;
                    acc[key].isGrouped = true;
                    acc[key].entries.push({
                      brand: item.brand || item.productName,
                      purchasedPrice: item.purchasedPrice,
                      packet: item.packet,
                      packetSize: item.packetSize,
                      quantity: item.quantity,
                      inHousePacket: item.inHousePacket || item.packet,
                      inHouseQuantity: item.inHouseQuantity || item.quantity,
                      sweepedPacket: item.sweepedPacket,
                      sweepedQuantity: item.sweepedQuantity,
                      unit: item.unit,
                      totalLcTruck: item.totalLcTruck,
                      totalLcQuantity: item.totalLcQuantity
                    });
                  }
                  return acc;
                }, {});

                const history = sortData(Object.values(groupedHistoryMap), 'history');
                const unit = history[0]?.unit || '';

                // Calculate Totals for Summary Cards
                const totalPackets = history.reduce((sum, item) => sum + item.entries.reduce((pSum, ent) => pSum + (parseFloat(ent.packet) || 0), 0), 0);
                const totalQuantity = history.reduce((sum, item) => sum + item.entries.reduce((qSum, ent) => qSum + (parseFloat(ent.quantity) || 0), 0), 0);
                const totalInHousePkt = history.reduce((sum, item) => sum + item.entries.reduce((pSum, ent) => pSum + (parseFloat(ent.inHousePacket) || 0), 0), 0);
                const totalInHouseQty = history.reduce((sum, item) => sum + item.entries.reduce((pSum, ent) => pSum + (parseFloat(ent.inHouseQuantity) || 0), 0), 0);
                const totalShortage = history.reduce((sum, item) => sum + item.entries.reduce((pSum, ent) => pSum + (parseFloat(ent.sweepedQuantity) || 0), 0), 0);

                return (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Packet</div>
                        <div className="text-xl font-bold text-gray-900">{totalPackets}</div>
                      </div>
                      <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl shadow-sm">
                        <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Total Quantity</div>
                        <div className="text-xl font-bold text-emerald-700">{Math.round(totalQuantity)} {unit}</div>
                      </div>
                      <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-xl shadow-sm">
                        <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-1">InHouse PKT</div>
                        <div className="text-xl font-bold text-amber-700">{Math.round(totalInHousePkt)}</div>
                      </div>
                      <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl shadow-sm">
                        <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">InHouse QTY</div>
                        <div className="text-xl font-bold text-blue-700">{Math.round(totalInHouseQty)} {unit}</div>
                      </div>
                      <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-xl shadow-sm">
                        <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-1">Shortage</div>
                        <div className="text-xl font-bold text-rose-700">{Math.round(totalShortage)} {unit}</div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-x-auto">
                      <table className="w-full text-left min-w-[600px]">
                        <thead>
                          <tr className="bg-white border-b border-gray-100">
                            <th onClick={() => requestSort('history', 'date')} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                              <div className="flex items-center">Date <SortIcon config={sortConfig.history} columnKey="date" /></div>
                            </th>
                            <th onClick={() => requestSort('history', 'lcNo')} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                              <div className="flex items-center">LC No <SortIcon config={sortConfig.history} columnKey="lcNo" /></div>
                            </th>
                            <th onClick={() => requestSort('history', 'port')} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                              <div className="flex items-center">Port <SortIcon config={sortConfig.history} columnKey="port" /></div>
                            </th>
                            <th onClick={() => requestSort('history', 'importer')} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                              <div className="flex items-center">Importer <SortIcon config={sortConfig.history} columnKey="importer" /></div>
                            </th>
                            <th onClick={() => requestSort('history', 'truckNo')} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                              <div className="flex items-center">Truck No. <SortIcon config={sortConfig.history} columnKey="truckNo" /></div>
                            </th>
                            <th onClick={() => requestSort('history', 'brand')} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                              <div className="flex items-center">Brand <SortIcon config={sortConfig.history} columnKey="brand" /></div>
                            </th>
                            <th className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                              Purchase<br />Price
                            </th>
                            <th onClick={() => requestSort('history', 'totalPacket')} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                              <div className="flex items-center">Packet <SortIcon config={sortConfig.history} columnKey="totalPacket" /></div>
                            </th>
                            <th onClick={() => requestSort('history', 'totalQuantity')} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                              <div className="flex items-center">Quantity <SortIcon config={sortConfig.history} columnKey="totalQuantity" /></div>
                            </th>
                            <th onClick={() => requestSort('history', 'totalInHousePacket')} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                              <div className="flex items-center">InHouse Pkt <SortIcon config={sortConfig.history} columnKey="totalInHousePacket" /></div>
                            </th>
                            <th onClick={() => requestSort('history', 'totalInHouseQuantity')} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                              <div className="flex items-center">InHouse Qty <SortIcon config={sortConfig.history} columnKey="totalInHouseQuantity" /></div>
                            </th>
                            <th onClick={() => requestSort('history', 'totalShortage')} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                              <div className="flex items-center">Shortage <SortIcon config={sortConfig.history} columnKey="totalShortage" /></div>
                            </th>
                            <th className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white/50">
                          {history.map((historyItem, idx) => (
                            <tr key={idx} className={`${historyItem._id === (viewRecord?.data?._id) ? 'bg-blue-50/50' : ''} align-top`}>
                              <td className="px-3 py-3 text-[13px] text-gray-600">
                                {formatDate(historyItem.date)}
                              </td>
                              <td className="px-3 py-3 text-[13px] font-bold text-gray-900">{historyItem.lcNo || '-'}</td>
                              <td className="px-3 py-3 text-[13px] text-gray-600">{historyItem.port || '-'}</td>
                              <td className="px-3 py-3 text-[13px] text-gray-600">{historyItem.importer || '-'}</td>
                              <td className="px-3 py-3 text-[13px] text-gray-600">
                                {historyItem.truckNo ? historyItem.truckNo.toString().split(',').map((t, i) => (
                                  <div key={i} className="leading-tight">{t.trim()}</div>
                                )) : '-'}
                              </td>
                              <td className="px-3 py-3 text-[13px] text-gray-600 leading-relaxed">
                                {historyItem.entries.map((ent, i) => (
                                  <div key={i}>
                                    {ent.brand ? ent.brand.toString().split(',').map((b, j) => (
                                      <div key={j}>{b.trim()}</div>
                                    )) : '-'}
                                  </div>
                                ))}
                              </td>
                              <td className="px-3 py-3 text-[13px] text-gray-600 leading-relaxed">
                                {historyItem.entries.map((ent, i) => (
                                  <div key={i}>{ent.purchasedPrice || '-'}</div>
                                ))}
                                {historyItem.isGrouped && (
                                  <div className="text-[12px] text-gray-900 mt-2 font-bold text-left">Total:</div>
                                )}
                              </td>
                              <td className="px-3 py-3 text-[13px] text-gray-600 leading-relaxed font-bold">
                                {historyItem.entries.map((ent, i) => (
                                  <div key={i}>
                                    {ent.packet ? ent.packet.toString().split(',').map((p, j) => (
                                      <div key={j}>{p.trim()}</div>
                                    )) : '-'}
                                  </div>
                                ))}
                                {historyItem.isGrouped && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <div className="text-blue-700 font-bold">
                                      {historyItem.entries.reduce((sum, ent) => sum + (parseFloat(ent.packet) || 0), 0)}
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3 text-[13px] font-medium text-gray-900 leading-relaxed">
                                {historyItem.entries.map((ent, i) => (
                                  <div key={i}>
                                    {ent.quantity ? ent.quantity.toString().split(',').map((q, j) => (
                                      <div key={j}>{q.trim()} {ent.unit}</div>
                                    )) : '-'}
                                  </div>
                                ))}
                                {historyItem.isGrouped && (
                                  <div className="text-gray-900 mt-2 font-bold">
                                    {Math.round(historyItem.entries.reduce((sum, ent) => sum + (parseFloat(ent.quantity) || 0), 0))} {historyItem.unit}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3 text-[13px] text-gray-600 leading-relaxed">
                                {historyItem.entries.map((ent, i) => (
                                  <div key={i}>
                                    {ent.inHousePacket ? ent.inHousePacket.toString().split(',').map((p, j) => (
                                      <div key={j}>{p.trim()}</div>
                                    )) : '-'}
                                  </div>
                                ))}
                                {historyItem.isGrouped && (
                                  <div className="text-gray-900 mt-2 font-bold">
                                    {Math.round(historyItem.entries.reduce((sum, ent) => sum + (parseFloat(ent.inHousePacket) || 0), 0))}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3 text-[13px] text-gray-600 leading-relaxed font-bold">
                                {historyItem.entries.map((ent, i) => (
                                  <div key={i}>{ent.inHouseQuantity ? ent.inHouseQuantity.toString().split(',').map((q, j) => (
                                    <div key={j}>{Math.round(parseFloat(q))} {ent.unit}</div>
                                  )) : '-'}</div>
                                ))}
                                {historyItem.isGrouped && (
                                  <div className="text-gray-900 mt-2 font-bold">
                                    {Math.round(historyItem.entries.reduce((sum, ent) => sum + (parseFloat(ent.inHouseQuantity) || 0), 0))} {historyItem.unit}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3 text-[13px] text-red-600 leading-relaxed font-bold">
                                {historyItem.entries.map((ent, i) => (
                                  <div key={i}>{ent.sweepedQuantity ? ent.sweepedQuantity.toString().split(',').map((q, j) => (
                                    <div key={j}>{q.trim()} {ent.unit}</div>
                                  )) : '-'}</div>
                                ))}
                                {historyItem.isGrouped && (
                                  <div className="text-red-700 mt-2 font-bold">
                                    {Math.round(historyItem.entries.reduce((sum, ent) => sum + (parseFloat(ent.sweepedQuantity) || 0), 0))} {historyItem.unit}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3 text-[13px]">
                                <div className="flex items-center justify-center space-x-2">
                                  <button
                                    onClick={() => { setViewRecord(null); handleEdit('stock', historyItem); }}
                                    className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors group"
                                    title="Edit"
                                  >
                                    <EditIcon className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                                  </button>
                                  <button
                                    onClick={() => { setViewRecord(null); deleteStockGroup(historyItem.allIds || [historyItem._id]); }}
                                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors group"
                                    title="Delete"
                                  >
                                    <TrashIcon className="w-4 h-4 text-gray-400 group-hover:text-red-600" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>
        </div >
      )}

      {/* Stock Report Modal */}
      {/* LC Receive Report Modal */}
      {showLcReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm">
          <div className="w-[95%] h-[90%] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 print:w-full print:h-auto print:shadow-none print:bg-white print:rounded-none">
            {/* Modal Header - Hidden in Print */}
            <div className="px-8 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <BarChartIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">LC Receive Report</h2>
                  <p className="text-sm text-gray-500 font-medium">Generate and print LC receiving reports</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Advanced Filter for Report */}
                <div className="relative" ref={lcReportFilterRef}>
                  <button
                    ref={lcReportFilterButtonRef}
                    onClick={() => setShowLcReportFilterPanel(!showLcReportFilterPanel)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95"
                  >
                    <FunnelIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium">Filter</span>
                  </button>

                  {/* Filter Panel */}
                  {showLcReportFilterPanel && (
                    <div className="absolute right-0 mt-2 w-[450px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 z-[110] animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-base font-bold text-gray-900">Advance Filter</h3>
                        <button
                          onClick={() => {
                            setLcFilters(initialLcFilterState);
                            setFilterSearchInputs({
                              ...filterSearchInputs,
                              lcNoSearch: '',
                              portSearch: '',
                              indCnfSearch: '',
                              bdCnfSearch: '',
                              billOfEntrySearch: '',
                              productSearch: '',
                              brandSearch: ''
                            });
                          }}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                        >
                          Reset All
                        </button>
                      </div>

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

                        {/* LC No Filter */}
                        <div className="space-y-1.5 relative" ref={reportLcNoFilterRef}>
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">LC No</label>
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
                              className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300 pr-14 ${lcFilters.lcNo ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                              {lcFilters.lcNo && (
                                <button
                                  onClick={() => {
                                    setLcFilters({ ...lcFilters, lcNo: '' });
                                    setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: '' });
                                  }}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <XIcon className="w-4 h-4" />
                                </button>
                              )}
                              <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                          </div>
                          {filterDropdownOpen.lcNo && (() => {
                            const lcOptions = [...new Set(stockRecords.map(item => (item.lcNo || '').trim()).filter(Boolean))].sort();
                            const filtered = lcOptions.filter(lc => lc.toLowerCase().includes(filterSearchInputs.lcNoSearch.toLowerCase()));
                            return filtered.length > 0 ? (
                              <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map(lc => (
                                  <button
                                    key={lc}
                                    type="button"
                                    onClick={() => {
                                      setLcFilters({ ...lcFilters, lcNo: lc });
                                      setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: '' });
                                      setFilterDropdownOpen(initialFilterDropdownState);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                  >
                                    {lc}
                                  </button>
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </div>

                        {/* Port Filter */}
                        <div className="space-y-1.5 relative" ref={reportPortFilterRef}>
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Port</label>
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
                              className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300 pr-14 ${lcFilters.port ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                              {lcFilters.port && (
                                <button
                                  onClick={() => {
                                    setLcFilters({ ...lcFilters, port: '' });
                                    setFilterSearchInputs({ ...filterSearchInputs, portSearch: '' });
                                  }}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <XIcon className="w-4 h-4" />
                                </button>
                              )}
                              <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                          </div>
                          {filterDropdownOpen.port && (() => {
                            const portOptions = [...new Set(stockRecords.map(item => (item.port || '').trim()).filter(Boolean))].sort();
                            const filtered = portOptions.filter(p => p.toLowerCase().includes(filterSearchInputs.portSearch.toLowerCase()));
                            return filtered.length > 0 ? (
                              <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map(p => (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => {
                                      setLcFilters({ ...lcFilters, port: p });
                                      setFilterSearchInputs({ ...filterSearchInputs, portSearch: '' });
                                      setFilterDropdownOpen(initialFilterDropdownState);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                  >
                                    {p}
                                  </button>
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </div>

                        {/* Product Filter */}
                        <div className="space-y-1.5 relative" ref={reportProductFilterRef}>
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Product</label>
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
                              className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300 pr-14 ${lcFilters.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                              {lcFilters.productName && (
                                <button
                                  onClick={() => {
                                    setLcFilters({ ...lcFilters, productName: '' });
                                    setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' });
                                  }}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <XIcon className="w-4 h-4" />
                                </button>
                              )}
                              <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                          </div>
                          {filterDropdownOpen.product && (() => {
                            const options = [...new Set(stockRecords.map(item => (item.productName || '').trim()).filter(Boolean))].sort();
                            const filtered = options.filter(o => o.toLowerCase().includes(filterSearchInputs.productSearch.toLowerCase()));
                            return filtered.length > 0 ? (
                              <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map(o => (
                                  <button
                                    key={o}
                                    type="button"
                                    onClick={() => {
                                      setLcFilters({ ...lcFilters, productName: o });
                                      setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' });
                                      setFilterDropdownOpen(initialFilterDropdownState);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                  >
                                    {o}
                                  </button>
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </div>

                        {/* Brand Filter */}
                        <div className="space-y-1.5 relative" ref={reportBrandFilterRef}>
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Brand</label>
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
                              className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300 pr-14 ${lcFilters.brand ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                              {lcFilters.brand && (
                                <button
                                  onClick={() => {
                                    setLcFilters({ ...lcFilters, brand: '' });
                                    setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' });
                                  }}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <XIcon className="w-4 h-4" />
                                </button>
                              )}
                              <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                          </div>
                          {filterDropdownOpen.brand && (() => {
                            const productFilteredRecords = lcFilters.productName
                              ? stockRecords.filter(item => (item.productName || '').trim().toLowerCase() === lcFilters.productName.toLowerCase())
                              : stockRecords;
                            const options = [...new Set(productFilteredRecords.flatMap(item => {
                              if (item.brand) return [(item.brand || '').trim()];
                              return (item.brandEntries || []).map(e => (e.brand || '').trim());
                            }).filter(Boolean))].sort();
                            const filtered = options.filter(o => o.toLowerCase().includes(filterSearchInputs.brandSearch.toLowerCase()));
                            return filtered.length > 0 ? (
                              <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map(o => (
                                  <button
                                    key={o}
                                    type="button"
                                    onClick={() => {
                                      setLcFilters({ ...lcFilters, brand: o });
                                      setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' });
                                      setFilterDropdownOpen(initialFilterDropdownState);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                  >
                                    {o}
                                  </button>
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </div>

                        {/* IND CNF Filter */}
                        <div className="space-y-1.5 relative" ref={reportLcIndCnfFilterRef}>
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
                              className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300 pr-14 ${lcFilters.indCnf ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                              {lcFilters.indCnf && (
                                <button
                                  onClick={() => {
                                    setLcFilters({ ...lcFilters, indCnf: '' });
                                    setFilterSearchInputs({ ...filterSearchInputs, indCnfSearch: '' });
                                  }}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <XIcon className="w-4 h-4" />
                                </button>
                              )}
                              <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                          </div>
                          {filterDropdownOpen.indCnf && (() => {
                            const options = [...new Set(stockRecords.map(item => (item.indianCnF || '').trim()).filter(Boolean))].sort();
                            const filtered = options.filter(o => o.toLowerCase().includes(filterSearchInputs.indCnfSearch.toLowerCase()));
                            return filtered.length > 0 ? (
                              <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map(o => (
                                  <button
                                    key={o}
                                    onClick={() => {
                                      setLcFilters({ ...lcFilters, indCnf: o });
                                      setFilterSearchInputs({ ...filterSearchInputs, indCnfSearch: '' });
                                      setFilterDropdownOpen(initialFilterDropdownState);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                  >
                                    {o}
                                  </button>
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </div>

                        {/* BD CNF Filter */}
                        <div className="space-y-1.5 relative" ref={reportLcBdCnfFilterRef}>
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
                              className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300 pr-14 ${lcFilters.bdCnf ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                              {lcFilters.bdCnf && (
                                <button
                                  onClick={() => {
                                    setLcFilters({ ...lcFilters, bdCnf: '' });
                                    setFilterSearchInputs({ ...filterSearchInputs, bdCnfSearch: '' });
                                  }}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <XIcon className="w-4 h-4" />
                                </button>
                              )}
                              <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                          </div>
                          {filterDropdownOpen.bdCnf && (() => {
                            const options = [...new Set(stockRecords.map(item => (item.bdCnF || '').trim()).filter(Boolean))].sort();
                            const filtered = options.filter(o => o.toLowerCase().includes(filterSearchInputs.bdCnfSearch.toLowerCase()));
                            return filtered.length > 0 ? (
                              <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map(o => (
                                  <button
                                    key={o}
                                    onClick={() => {
                                      setLcFilters({ ...lcFilters, bdCnf: o });
                                      setFilterSearchInputs({ ...filterSearchInputs, bdCnfSearch: '' });
                                      setFilterDropdownOpen(initialFilterDropdownState);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                  >
                                    {o}
                                  </button>
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </div>

                        {/* Bill Of Entry Filter */}
                        <div className="col-span-2 space-y-1.5 relative" ref={reportLcBillOfEntryFilterRef}>
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Bill Of Entry</label>
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
                              className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300 pr-14 ${lcFilters.billOfEntry ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                              {lcFilters.billOfEntry && (
                                <button
                                  onClick={() => {
                                    setLcFilters({ ...lcFilters, billOfEntry: '' });
                                    setFilterSearchInputs({ ...filterSearchInputs, billOfEntrySearch: '' });
                                  }}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <XIcon className="w-4 h-4" />
                                </button>
                              )}
                              <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                          </div>
                          {filterDropdownOpen.billOfEntry && (() => {
                            const options = [...new Set(stockRecords.map(item => (item.billOfEntry || '').trim()).filter(Boolean))].sort();
                            const filtered = options.filter(o => o.toLowerCase().includes(filterSearchInputs.billOfEntrySearch.toLowerCase()));
                            return filtered.length > 0 ? (
                              <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map(o => (
                                  <button
                                    key={o}
                                    onClick={() => {
                                      setLcFilters({ ...lcFilters, billOfEntry: o });
                                      setFilterSearchInputs({ ...filterSearchInputs, billOfEntrySearch: '' });
                                      setFilterDropdownOpen(initialFilterDropdownState);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                  >
                                    {o}
                                  </button>
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </div>

                        <button
                          onClick={() => setShowLcReportFilterPanel(false)}
                          className="col-span-2 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-all mt-2"
                        >
                          Apply Filters
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => generateLCReceiveReportPDF(lcReceiveRecords, lcFilters, lcReceiveSummary)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 no-print"
                >
                  <BarChartIcon className="w-4 h-4" />
                  Print Report
                </button>
                <button
                  onClick={() => setShowLcReport(false)}
                  className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors no-print"
                >
                  <XIcon className="w-6 h-6 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Printable Content */}
            <div className="flex-1 overflow-y-auto p-12 print:p-4 print:overflow-visible bg-white">
              <div className="max-w-[1000px] mx-auto space-y-8">
                {/* Company Header */}
                <div className="text-center space-y-1">
                  <h1 className="text-4xl font-bold text-gray-900 tracking-tight">M/S ANI ENTERPRISE</h1>
                  <p className="text-[14px] text-gray-600">766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh</p>
                  <p className="text-[14px] text-gray-600">+8802588813057, +8801711-406898, anienterprise051@gmail.com, www.anienterprises.com.bd</p>
                </div>

                {/* Sharp Separator */}
                <div className="border-t-2 border-gray-900 w-full mt-4"></div>

                {/* Report Title Box */}
                <div className="flex justify-center -mt-6">
                  <div className="bg-white border-2 border-gray-900 px-12 py-1.5 inline-block">
                    <h2 className="text-xl font-bold text-gray-900 tracking-wide uppercase">LC Receive Report</h2>
                  </div>
                </div>

                {/* Date/Info Row */}
                <div className="flex justify-between items-end text-[11px] text-black pt-6 px-2">
                  <div className="flex flex-col gap-1.5">
                    <div>
                      <span className="font-bold text-black font-semibold">Date Range:</span> {lcFilters.startDate || 'Start'} to {lcFilters.endDate || 'Present'}
                    </div>
                    {lcFilters.lcNo && (
                      <div>
                        <span className="font-bold text-black font-semibold">LC No:</span> <span className="text-blue-900 font-bold">{lcFilters.lcNo}</span>
                      </div>
                    )}
                  </div>
                  <div className="font-bold">
                    <span className="text-black font-semibold">Printed on:</span> <span className="text-black">{new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>

                {/* Report Table */}
                <div className="overflow-x-auto border border-gray-900">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-900">
                        <th className="border-r border-gray-900 px-1 py-1 text-left text-[10.5px] font-bold text-black uppercase tracking-wider w-[3%] text-center">SL</th>
                        <th className="border-r border-gray-900 px-1 py-1 text-left text-[10.5px] font-bold text-black uppercase tracking-wider w-[8%]">Date</th>
                        <th className="border-r border-gray-900 px-1 py-1 text-left text-[10.5px] font-bold text-blue-900 uppercase tracking-wider font-extrabold w-[10%]">LC No</th>
                        <th className="border-r border-gray-900 px-1 py-1 text-left text-[10.5px] font-bold text-black uppercase tracking-wider w-[15%]">Importer</th>
                        <th className="border-r border-gray-900 px-1 py-1 text-left text-[10.5px] font-bold text-black uppercase tracking-wider w-[7%]">Port</th>
                        <th className="border-r border-gray-900 px-1 py-1 text-left text-[10.5px] font-bold text-black uppercase tracking-wider w-[8%]">BOE No</th>
                        <th className="border-r border-gray-900 px-1 py-1 text-left text-[10.5px] font-bold text-black uppercase tracking-wider w-[15%]">Product</th>
                        <th className="border-r border-gray-900 px-1 py-1 text-left text-[10.5px] font-bold text-black uppercase tracking-wider w-[14%] text-center">Brand</th>
                        <th className="border-r border-gray-900 px-1 py-1 text-right text-[10.5px] font-bold text-black uppercase tracking-wider w-[6%] text-center">Packet</th>
                        <th className="border-r border-gray-900 px-1 py-1 text-right text-[10.5px] font-bold text-black uppercase tracking-wider w-[5%] text-center">Truck</th>
                        <th className="border-r border-gray-900 px-1 py-1 text-right text-[10.5px] font-bold text-black uppercase tracking-wider w-[9%]">QTY</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-400">
                      {lcReceiveRecords.length > 0 ? (
                        Object.values(lcReceiveRecords.reduce((acc, item) => {
                          const key = item.lcNo || 'unknown';
                          if (!acc[key]) {
                            acc[key] = {
                              ...item,
                              entries: []
                            };
                          }
                          acc[key].entries.push(item);
                          return acc;
                        }, {})).map((entry, index) => {
                          // Sub-group entries by Product + Truck within each LC group
                          const productGroups = entry.entries.reduce((acc, item) => {
                            const key = `${item.date}-${item.productName}-${item.truckNo}`;
                            if (!acc[key]) {
                              acc[key] = {
                                ...item,
                                brandList: [],
                                packetList: [],
                                qtyList: []
                              };
                            }
                            acc[key].brandList.push(item.brand || '-');
                            acc[key].packetList.push(item.packet || '0');
                            acc[key].qtyList.push({ quantity: item.quantity, unit: item.unit });
                            return acc;
                          }, {});

                          const finalEntries = Object.values(productGroups);

                          return (
                            <tr key={index} className="border-b border-gray-400 last:border-0 hover:bg-gray-50 transition-colors">
                              <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] text-black text-center align-top">{index + 1}</td>
                              <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] text-black align-top font-medium">{formatDate(entry.date)}</td>
                              <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] font-extrabold text-blue-900 align-top">{entry.lcNo}</td>
                              <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] text-black align-top">{entry.importer || '-'}</td>
                              <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] text-black align-top">{entry.port || '-'}</td>
                              <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] text-black align-top">{entry.billOfEntry || '-'}</td>

                              {/* Product Column */}
                              <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] font-bold text-black align-top">
                                {finalEntries.map((subItem, idx) => {
                                  const hasTotal = subItem.qtyList.length > 1;
                                  return (
                                    <div key={idx} className={`${idx < finalEntries.length - 1 ? 'border-b border-gray-300 mb-2 pb-2' : ''}`}>
                                      <div className="leading-tight">{subItem.productName}</div>
                                      {Array.from({ length: subItem.brandList.length - 1 }).map((_, i) => (
                                        <div key={i} className="leading-tight">&nbsp;</div>
                                      ))}
                                      {hasTotal && <div className="mt-0 pt-0.5 border-t border-transparent leading-tight">&nbsp;</div>}
                                    </div>
                                  );
                                })}
                              </td>

                              {/* Brand Column */}
                              <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] text-black align-top">
                                {finalEntries.map((subItem, idx) => {
                                  const hasTotal = subItem.qtyList.length > 1;
                                  return (
                                    <div key={idx} className={`${idx < finalEntries.length - 1 ? 'border-b border-gray-300 mb-2 pb-2' : ''}`}>
                                      {subItem.brandList.map((b, i) => (
                                        <div key={i} className="leading-tight">{b}</div>
                                      ))}
                                      {hasTotal && <div className="mt-0 pt-0.5 border-t border-transparent leading-tight">&nbsp;</div>}
                                    </div>
                                  );
                                })}
                              </td>

                              {/* Packet Column */}
                              <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] text-center text-black align-top">
                                {finalEntries.map((subItem, idx) => {
                                  const hasTotal = subItem.qtyList.length > 1;
                                  return (
                                    <div key={idx} className={`${idx < finalEntries.length - 1 ? 'border-b border-gray-300 mb-2 pb-2' : ''}`}>
                                      {subItem.packetList.map((p, i) => (
                                        <div key={i} className="leading-tight">{p}</div>
                                      ))}
                                      {hasTotal && <div className="mt-0 pt-0.5 border-t border-transparent leading-tight">&nbsp;</div>}
                                    </div>
                                  );
                                })}
                              </td>

                              {/* Truck Column */}
                              <td className="border-r border-gray-900 px-2 py-0.5 text-[10.5px] text-center font-bold text-black align-top">
                                {finalEntries.map((subItem, idx) => {
                                  const hasTotal = subItem.qtyList.length > 1;
                                  return (
                                    <div key={idx} className={`${idx < finalEntries.length - 1 ? 'border-b border-gray-300 mb-2 pb-2' : ''}`}>
                                      <div className="leading-tight">{subItem.truckNo}</div>
                                      {Array.from({ length: subItem.brandList.length - 1 }).map((_, i) => (
                                        <div key={i} className="leading-tight">&nbsp;</div>
                                      ))}
                                      {hasTotal && <div className="mt-0 pt-0.5 border-t border-transparent leading-tight">&nbsp;</div>}
                                    </div>
                                  );
                                })}
                              </td>

                              {/* QTY Column */}
                              <td className="px-2 py-0.5 text-[10.5px] text-right font-bold text-black align-top border-r border-gray-900 whitespace-nowrap">
                                {finalEntries.map((subItem, idx) => {
                                  const hasTotal = subItem.qtyList.length > 1;
                                  return (
                                    <div key={idx} className={`${idx < finalEntries.length - 1 ? 'border-b border-gray-300 mb-2 pb-2' : ''}`}>
                                      {subItem.qtyList.map((q, i) => (
                                        <div key={i} className="leading-tight font-black">{Math.round(q.quantity)} {q.unit}</div>
                                      ))}
                                      {hasTotal && (
                                        <div className="mt-0 pt-0.5 border-t border-gray-900 font-extrabold leading-tight">
                                          {Math.round(subItem.qtyList.reduce((sum, q) => sum + (parseFloat(q.quantity) || 0), 0))} {subItem.qtyList[0].unit}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="11" className="px-4 py-8 text-center text-black italic">No receive records found for the selected criteria.</td>
                        </tr>
                      )}
                    </tbody>
                    {lcReceiveRecords.length > 0 && (
                      <tfoot>
                        <tr className="bg-gray-100 border-t-2 border-gray-900">
                          <td colSpan="9" className="px-2 py-2 text-[10.5px] font-black text-black text-right uppercase tracking-wider border-r border-gray-900">Grand Total</td>
                          <td className="px-2 py-2 text-[10.5px] text-center font-black text-black border-r border-gray-900">
                            {lcReceiveSummary.totalTrucks}
                          </td>
                          <td className="px-2 py-2 text-[10.5px] text-right font-black text-black border-r border-gray-900 whitespace-nowrap">
                            {Math.round(lcReceiveSummary.totalQuantity)} {lcReceiveSummary.unit}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Summary Info Cards for Print */}
                <div className="grid grid-cols-3 gap-6 pt-6 px-2 print:grid">
                  <div className="border-2 border-gray-100 p-6 rounded-3xl bg-white shadow-sm print:border-gray-200">
                    <div className="text-[13px] font-bold text-black uppercase tracking-wider mb-2">Total Packets</div>
                    <div className="text-2xl font-black text-black">{lcReceiveSummary.totalPackets}</div>
                  </div>
                  <div className="border-2 border-gray-100 p-6 rounded-3xl bg-white shadow-sm print:border-gray-200">
                    <div className="text-[13px] font-bold text-black uppercase tracking-wider mb-2">Total Quantity</div>
                    <div className="text-2xl font-black text-black">{Math.round(lcReceiveSummary.totalQuantity)} <span className="text-lg font-bold">{lcReceiveSummary.unit}</span></div>
                  </div>
                  <div className="border-2 border-gray-100 p-6 rounded-3xl bg-white shadow-sm print:border-gray-200">
                    <div className="text-[13px] font-bold text-black uppercase tracking-wider mb-2">Total Truck</div>
                    <div className="text-3xl font-black text-black">{lcReceiveSummary.totalTrucks}</div>
                  </div>
                </div>

                {/* Footer Signatures */}
                <div className="grid grid-cols-3 gap-8 pt-24 px-4 pb-12">
                  <div className="text-center">
                    <div className="border-t border-dotted border-gray-900 pt-2 text-[13px] font-bold text-black uppercase">Prepared By</div>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-dotted border-gray-900 pt-2 text-[13px] font-bold text-black uppercase">Verified By</div>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-dotted border-gray-900 pt-2 text-[13px] font-bold text-black uppercase">Authorized Signature</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Report Modal */}
      <StockReport
        isOpen={showStockReport}
        onClose={() => setShowStockReport(false)}
        stockRecords={stockRecords}
        stockFilters={stockFilters}
        setStockFilters={setStockFilters}
        stockData={stockData}
      />

    </div >
  );
}

export default App;
