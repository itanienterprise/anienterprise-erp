import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MenuIcon, SearchIcon, BellIcon, HomeIcon, BoxIcon, UsersIcon, AnchorIcon,
  BarChartIcon, SettingsIcon, TrendingUpIcon, DollarSignIcon,
  ShoppingCartIcon, EditIcon, TrashIcon, FunnelIcon, XIcon, PlusIcon,
  ChevronUpIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, EyeIcon, CalendarIcon
} from './components/Icons';

import { encryptData, decryptData } from './utils/encryption';

const API_BASE_URL = `http://${window.location.hostname}:5000`;

const SortIcon = ({ config, columnKey }) => {
  if (config.key !== columnKey) return <div className="w-4 h-4 ml-1 opacity-20"><ChevronDownIcon className="w-4 h-4" /></div>;
  return config.direction === 'asc'
    ? <ChevronUpIcon className="w-4 h-4 ml-1 text-blue-600" />
    : <ChevronDownIcon className="w-4 h-4 ml-1 text-blue-600" />;
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  // Parse YYYY-MM-DD manually to avoid timezone shifts
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const day = parts[2].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[0];
    return `${day}/${month}/${year}`;
  }
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const parseDate = (dateString) => {
  if (!dateString) return new Date();
  if (typeof dateString === 'string' && dateString.includes('-')) {
    const [y, m, d] = dateString.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateString);
};

const CustomDatePicker = ({ value, onChange, placeholder, label, required = false, name, labelClassName = "text-sm font-medium text-gray-700", compact = false, rightAlign = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value && value.includes('-')) {
      const [y, m] = value.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date();
  });
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDateSelect = (day) => {
    const year = viewDate.getFullYear();
    const month = String(viewDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const formatted = `${year}-${month}-${d}`;

    onChange({ target: { name, value: formatted } });
    setIsOpen(false);
  };

  const daysInMonth = getDaysInMonth(viewDate.getMonth(), viewDate.getFullYear());
  const firstDay = getFirstDayOfMonth(viewDate.getMonth(), viewDate.getFullYear());
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      {label && <label className={labelClassName}>{label}</label>}
      <div className="relative">
        <input
          type="text"
          readOnly
          value={value ? formatDate(value) : ''}
          onClick={() => setIsOpen(!isOpen)}
          placeholder={placeholder || 'Select Date'}
          required={required}
          autoComplete="off"
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300 cursor-pointer pr-10"
        />
        <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {isOpen && (
        <div className={`absolute z-[100] mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl ${compact ? 'p-3 w-[260px]' : 'p-5 w-[320px]'} ${rightAlign ? 'right-0' : 'left-0'}`}>
          <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-4'}`}>
            <button type="button" onClick={handlePrevMonth} className="p-2 hover:bg-gray-50 rounded-lg text-gray-700 transition-colors">
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <div className={`font-bold text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}>
              {months[viewDate.getMonth()]} {viewDate.getFullYear()}
            </div>
            <button type="button" onClick={handleNextMonth} className="p-2 hover:bg-gray-50 rounded-lg text-gray-700 transition-colors">
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>

          <div className={`grid grid-cols-7 ${compact ? 'gap-0.5 mb-2' : 'gap-1 mb-3'}`}>
            {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(d => (
              <div key={d} className={`text-[11px] font-semibold text-gray-400 text-center uppercase ${compact ? 'py-1' : 'py-2'}`}>{d}</div>
            ))}
          </div>

          <div className={`grid grid-cols-7 ${compact ? 'gap-0.5' : 'gap-1'}`}>
            {blanks.map(b => <div key={`b-${b}`} className={compact ? 'h-8' : 'h-10'}></div>)}
            {days.map(d => {
              const today = new Date();
              const isToday = today.getFullYear() === viewDate.getFullYear() &&
                today.getMonth() === viewDate.getMonth() &&
                today.getDate() === d;

              let isSelected = false;
              if (value && value.includes('-')) {
                const [vY, vM, vD] = value.split('-').map(Number);
                isSelected = vY === viewDate.getFullYear() &&
                  vM === (viewDate.getMonth() + 1) &&
                  vD === d;
              }

              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDateSelect(d)}
                  className={`${compact ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'} rounded-xl font-medium flex items-center justify-center transition-all
                    ${isSelected ? 'bg-blue-600 text-white shadow-md scale-105' :
                      isToday ? 'bg-blue-50 text-blue-600 font-semibold' :
                        'hover:bg-gray-100 text-gray-700'}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};


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
  const [isLoading, setIsLoading] = useState(false);
  const [showImporterForm, setShowImporterForm] = useState(false);
  const [showPortForm, setShowPortForm] = useState(false);
  const [showStockForm, setShowStockForm] = useState(false);
  const [stockRecords, setStockRecords] = useState([]);

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
    productSearch: ''
  });
  const [filterDropdownOpen, setFilterDropdownOpen] = useState({
    lcNo: false,
    port: false,
    brand: false,
    product: false
  });
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [showStockFilterPanel, setShowStockFilterPanel] = useState(false);
  const [stockFilters, setStockFilters] = useState({
    startDate: '',
    endDate: '',
    lcNo: '',
    port: '',
    brand: '',
    productName: ''
  });
  const [showStockReport, setShowStockReport] = useState(false);
  const [showStockReportFilterPanel, setShowStockReportFilterPanel] = useState(false);
  const [products, setProducts] = useState([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [productFormData, setProductFormData] = useState({
    name: '',
    hsCode: '',
    brand: '',
    purchasedPrice: '',
    uom: 'kg',
    packetSize: '',
    description: '',
    category: ''
  });
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
  const stockFilterRef = useRef(null);
  const stockFilterButtonRef = useRef(null);
  const stockLcNoFilterRef = useRef(null);
  const stockPortFilterRef = useRef(null);
  const stockBrandFilterRef = useRef(null);
  const stockProductFilterRef = useRef(null);
  const stockReportFilterRef = useRef(null);
  const stockReportFilterButtonRef = useRef(null);


  const stockData = useMemo(() => {
    const searchLower = stockSearchQuery.toLowerCase().trim();
    const filteredRecords = stockRecords.filter(item => {
      // Apply Advanced Filters
      if (stockFilters.startDate && item.date < stockFilters.startDate) return false;
      if (stockFilters.endDate && item.date > stockFilters.endDate) return false;
      if (stockFilters.lcNo && (item.lcNo || '').trim() !== stockFilters.lcNo) return false;
      if (stockFilters.port && (item.port || '').trim() !== stockFilters.port) return false;
      if (stockFilters.productName && (item.productName || '').trim().toLowerCase() !== stockFilters.productName.toLowerCase()) return false;
      if (stockFilters.brand) {
        const brandList = item.brand ? [item.brand] : (item.entries || []).map(e => e.brand);
        if (!brandList.some(b => (b || '').trim().toLowerCase() === stockFilters.brand.toLowerCase())) return false;
      }

      // Apply Search Query
      if (!searchLower) return true;

      const matchesProduct = (item.productName || '').toLowerCase().includes(searchLower);
      const matchesLC = (item.lcNo || '').toLowerCase().includes(searchLower);
      const matchesPort = (item.port || '').toLowerCase().includes(searchLower);
      const matchesImporter = (item.importer || '').toLowerCase().includes(searchLower);
      const matchesTruck = (item.truckNo || '').toLowerCase().includes(searchLower);
      const brandList = item.brand ? [item.brand] : (item.entries || []).map(e => e.brand);
      const matchesBrand = brandList.some(b => (b || '').trim().toLowerCase().includes(searchLower));

      return matchesProduct || matchesLC || matchesPort || matchesImporter || matchesTruck || matchesBrand;
    });

    const groupedStock = filteredRecords.reduce((acc, item) => {
      const name = (item.productName || '').trim().toLowerCase();
      const itemBrand = (item.brand || item.productName || '').trim();
      const itemQty = parseFloat(item.quantity) || 0;
      const itemPacket = parseFloat(item.packet) || 0;
      const itemIHPacket = parseFloat(item.inHousePacket || item.packet) || 0;
      const itemIHQty = parseFloat(item.inHouseQuantity || item.quantity) || 0;
      const itemSize = parseFloat(item.packetSize) || 0;

      const brandEntry = {
        brand: itemBrand,
        purchasedPrice: item.purchasedPrice || '',
        packet: itemPacket,
        packetSize: itemSize,
        quantity: itemQty,
        inHousePacket: itemIHPacket,
        inHouseQuantity: itemIHQty,
        salePacket: itemPacket - itemIHPacket,
        saleQuantity: itemQty - itemIHQty,
        sweepedPacket: item.sweepedPacket || '',
        sweepedQuantity: item.sweepedQuantity || '',
        unit: item.unit
      };

      if (!acc[name]) {
        acc[name] = {
          ...item,
          productName: (item.productName || '').trim(),
          quantity: itemIHQty,
          packet: itemIHPacket,
          salePacket: itemPacket - itemIHPacket,
          saleQuantity: itemQty - itemIHQty,
          originalId: item._id,
          allIds: [item._id],
          entries: [brandEntry]
        };
      } else {
        acc[name].allIds.push(item._id);
        acc[name].quantity += itemIHQty;
        acc[name].packet += itemIHPacket;
        acc[name].salePacket += (itemPacket - itemIHPacket);
        acc[name].saleQuantity += (itemQty - itemIHQty);
        const existingEntry = acc[name].entries.find(e => e.brand === itemBrand);
        if (existingEntry) {
          existingEntry.packet += itemPacket;
          existingEntry.quantity += itemQty;
          existingEntry.inHousePacket += itemIHPacket;
          existingEntry.inHouseQuantity += itemIHQty;
        } else {
          acc[name].entries.push(brandEntry);
        }
      }
      return acc;
    }, {});

    const displayRecords = Object.values(groupedStock);
    const totalPackets = filteredRecords.reduce((sum, item) => sum + (parseFloat(item.packet) || 0), 0);
    const totalQuantity = filteredRecords.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
    const totalInHousePkt = filteredRecords.reduce((sum, item) => sum + (parseFloat(item.inHousePacket || item.packet) || 0), 0);
    const totalInHouseQty = filteredRecords.reduce((sum, item) => sum + (parseFloat(item.inHouseQuantity || item.quantity) || 0), 0);
    const totalSalePkt = totalPackets - totalInHousePkt;
    const totalSaleQty = totalQuantity - totalInHouseQty;
    const totalShortage = filteredRecords.reduce((sum, item) => sum + (parseFloat(item.sweepedQuantity) || 0), 0);

    const unit = filteredRecords[0]?.unit || 'kg';

    return { displayRecords, totalPackets, totalQuantity, totalInHousePkt, totalInHouseQty, totalSalePkt, totalSaleQty, totalShortage, unit };
  }, [stockRecords, stockSearchQuery, stockFilters]);

  const [sortConfig, setSortConfig] = useState({
    ip: { key: null, direction: 'asc' },
    importer: { key: null, direction: 'asc' },
    port: { key: null, direction: 'asc' },
    history: { key: 'date', direction: 'desc' }
  });

  const [importerFormData, setImporterFormData] = useState({
    name: '',
    address: '',
    contactPerson: '',
    email: '',
    phone: '',
    licenseNo: '',
    status: 'Active'
  });

  const [portFormData, setPortFormData] = useState({
    name: '',
    location: '',
    code: '',
    type: 'Seaport',
    status: 'Active'
  });

  const [stockFormData, setStockFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    lcNo: '',
    indianCnF: '',
    indCnFCost: '',
    bdCnF: '',
    bdCnFCost: '',
    billOfEntry: '',
    port: '',
    importer: '',
    status: 'In Stock',
    totalLcTruck: '',
    totalLcQuantity: '',
    allIds: [], // Track all record IDs in a group for editing
    productEntries: [
      {
        productName: '',
        truckNo: '',
        isMultiBrand: true,
        brandEntries: [
          {
            brand: '',
            purchasedPrice: '',
            packet: '',
            packetSize: '',
            quantity: '',
            unit: 'kg'
          }
        ]
      }
    ]
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

  const resetStockForm = () => {
    setStockFormData({
      date: new Date().toISOString().split('T')[0],
      lcNo: '',
      indianCnF: '',
      indCnFCost: '',
      bdCnF: '',
      bdCnFCost: '',
      billOfEntry: '',
      port: '',
      importer: '',
      status: 'In Stock',
      totalLcTruck: '',
      totalLcQuantity: '',
      productEntries: [
        {
          productName: '',
          truckNo: '',
          isMultiBrand: true,
          brandEntries: [
            {
              brand: '',
              purchasedPrice: '',
              packet: '',
              packetSize: '',
              sweepedPacket: '',
              sweepedSize: '',
              sweepedQuantity: '',
              inHousePacket: '',
              inHouseQuantity: '',
              quantity: '',
              unit: 'kg'
            }
          ]
        }
      ]
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
    setShowProductForm(false);
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

  const productRefs = useRef({});
  const brandRefs = useRef({});

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Handle product dropdowns
      if (activeDropdown && activeDropdown.startsWith('product-')) {
        const index = parseInt(activeDropdown.split('-')[1]);
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
        (stockPortRef.current && !stockPortRef.current.contains(event.target)) &&
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
      case 'port':
        return ports.filter(p => p.status === 'Active' && (!stockFormData.port || ports.some(x => x.name === stockFormData.port) || p.name.toLowerCase().includes(stockFormData.port.toLowerCase())));
      case 'importer':
        return importers.filter(imp => imp.status === 'Active' && (!stockFormData.importer || importers.some(x => x.name === stockFormData.importer) || imp.name.toLowerCase().includes(stockFormData.importer.toLowerCase())));
      case 'ipPort':
        return ports.filter(p => p.status === 'Active' && (!formData.port || ports.some(x => x.name === formData.port) || p.name.toLowerCase().includes(formData.port.toLowerCase())));
      case 'ipImporter':
        return importers.filter(imp => imp.status === 'Active' && (!formData.ipParty || importers.some(x => x.name === formData.ipParty) || imp.name.toLowerCase().includes(formData.ipParty.toLowerCase())));
      case 'filterPort':
        return ports.filter(p => p.status === 'Active' && (!filters.port || ports.some(x => x.name === filters.port) || p.name.toLowerCase().includes(filters.port.toLowerCase())));
      case 'filterImporter':
        return importers.filter(imp => imp.status === 'Active' && (!filters.importer || importers.some(x => x.name === filters.importer) || imp.name.toLowerCase().includes(filters.importer.toLowerCase())));
      default:
        if (type.startsWith('product-')) {
          const pIndex = parseInt(type.split('-')[1]);
          const query = stockFormData.productEntries[pIndex].productName;
          return getFilteredProducts(query).map(p => ({ ...p, name: p.name }));
        }
        if (type.startsWith('brand-')) {
          const parts = type.split('-');
          const pIndex = parseInt(parts[1]);
          const bIndex = parseInt(parts[2]);
          const product = stockFormData.productEntries[pIndex];
          const currentProductBrand = products.find(p => p.name === product.productName)?.brand;
          const query = product.brandEntries[bIndex].brand;
          return getFilteredBrands(query, currentProductBrand).map(b => ({ name: b }));
        }
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
  useEffect(() => {
    if (!stockFormData.productEntries) return;

    // Sum truckNo per product entry
    const totalTruck = stockFormData.productEntries.reduce((sum, p) => sum + (parseFloat(p.truckNo) || 0), 0);

    // Sum quantity across all brand entries in all products
    const totalQty = stockFormData.productEntries.reduce((pSum, p) =>
      pSum + p.brandEntries.reduce((bSum, b) => bSum + (parseFloat(b.quantity) || 0), 0)
      , 0);

    const truckStr = totalTruck.toString();
    const qtyStr = totalQty.toFixed(2);

    // Update state if calculation differs
    if (stockFormData.totalLcTruck !== truckStr || stockFormData.totalLcQuantity !== qtyStr) {
      setStockFormData(prev => ({
        ...prev,
        totalLcTruck: truckStr,
        totalLcQuantity: qtyStr
      }));
    }
  }, [stockFormData.productEntries]);

  // Click-outside detection for filter dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        lcNoFilterRef.current && !lcNoFilterRef.current.contains(event.target) &&
        portFilterRef.current && !portFilterRef.current.contains(event.target) &&
        brandFilterRef.current && !brandFilterRef.current.contains(event.target) &&
        stockLcNoFilterRef.current && !stockLcNoFilterRef.current.contains(event.target) &&
        stockPortFilterRef.current && !stockPortFilterRef.current.contains(event.target) &&
        stockBrandFilterRef.current && !stockBrandFilterRef.current.contains(event.target) &&
        stockProductFilterRef.current && !stockProductFilterRef.current.contains(event.target)
      ) {
        setFilterDropdownOpen({ lcNo: false, port: false, brand: false, product: false });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showStockFilterPanel &&
        stockFilterRef.current &&
        !stockFilterRef.current.contains(event.target) &&
        stockFilterButtonRef.current &&
        !stockFilterButtonRef.current.contains(event.target) &&
        (!stockReportFilterRef.current || !stockReportFilterRef.current.contains(event.target)) &&
        (!stockReportFilterButtonRef.current || !stockReportFilterButtonRef.current.contains(event.target))
      ) {
        setShowStockFilterPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStockFilterPanel]);

  // Click-outside detection for stock report filter panel
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showStockReportFilterPanel &&
        stockReportFilterRef.current &&
        !stockReportFilterRef.current.contains(event.target) &&
        stockReportFilterButtonRef.current &&
        !stockReportFilterButtonRef.current.contains(event.target)
      ) {
        setShowStockReportFilterPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStockReportFilterPanel]);

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
                isMultiBrand: true, // Safe default for grouped edits
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
          // Update isMultiBrand for each product
          result.forEach(p => {
            p.isMultiBrand = p.brandEntries.length > 1;
          });
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

  const resetProductForm = () => {
    setProductFormData({
      name: '',
      hsCode: '',
      brand: '',
      purchasedPrice: '',
      uom: 'kg',
      packetSize: '',
      description: '',
      category: ''
    });
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const url = editingId
        ? `${API_BASE_URL}/api/products/${editingId}`
        : `${API_BASE_URL}/api/products`;
      const method = editingId ? 'PUT' : 'POST';
      const encryptedPayload = { data: encryptData(productFormData) };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(encryptedPayload),
      });

      if (response.ok) {
        setSubmitStatus('success');
        fetchProducts();
        setTimeout(() => {
          setShowProductForm(false);
          resetProductForm();
          setEditingId(null);
        }, 2000);
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProductEdit = (product) => {
    setProductFormData({
      name: product.name,
      hsCode: product.hsCode || '',
      brand: product.brand || '',
      purchasedPrice: product.purchasedPrice || '',
      uom: product.uom || product.unit || 'kg',
      packetSize: product.packetSize || '',
      description: product.description || '',
      category: product.category || ''
    });
    setEditingId(product._id);
    setShowProductForm(true);
  };

  const handleProductDelete = async (id) => {
    setDeleteConfirm({ show: true, type: 'product', id, isBulk: false });
  };

  const handleStockInputChange = (e, productIndex = null) => {
    const { name, value } = e.target;
    setStockFormData(prev => {
      if (productIndex !== null) {
        const updatedProducts = [...prev.productEntries];
        updatedProducts[productIndex] = {
          ...updatedProducts[productIndex],
          [name]: value
        };
        return { ...prev, productEntries: updatedProducts };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleProductModeToggle = (index, isMulti) => {
    setStockFormData(prev => {
      const updatedProducts = [...prev.productEntries];
      updatedProducts[index] = {
        ...updatedProducts[index],
        isMultiBrand: isMulti
      };
      return { ...prev, productEntries: updatedProducts };
    });
  };

  // Handle brand entry field changes
  const handleBrandEntryChange = (productIndex, brandIndex, field, value) => {
    setStockFormData(prev => {
      const updatedProducts = [...prev.productEntries];
      const updatedEntries = [...updatedProducts[productIndex].brandEntries];

      const newEntry = { ...updatedEntries[brandIndex], [field]: value };

      // Auto-fill size/unit if brand is selected and product exists
      if (field === 'brand' && value) {
        const productName = updatedProducts[productIndex].productName;
        const selectedProduct = products.find(p => p.name === productName);
        if (selectedProduct) {
          if (selectedProduct.packetSize) newEntry.packetSize = selectedProduct.packetSize;
          if (selectedProduct.uom) newEntry.unit = selectedProduct.uom;
        }
      }

      if (['packet', 'packetSize', 'sweepedPacket', 'sweepedQuantity', 'brand'].includes(field)) {
        const pkt = parseFloat(field === 'packet' ? value : newEntry.packet) || 0;
        const size = parseFloat(field === 'packetSize' ? value : newEntry.packetSize) || 0;
        const swpPkt = parseFloat(field === 'sweepedPacket' ? value : newEntry.sweepedPacket) || 0;
        const swpQty = parseFloat(field === 'sweepedQuantity' ? value : newEntry.sweepedQuantity) || 0;

        // Calculate total quantity
        const totalQty = pkt * size;
        newEntry.quantity = Math.round(totalQty);

        if (field === 'sweepedPacket') {
          // If packet changed, update quantity
          const newSwpQty = Math.round(swpPkt * size);
          newEntry.sweepedQuantity = newSwpQty;
          newEntry.inHouseQuantity = (totalQty - newSwpQty).toFixed(2);
          newEntry.inHousePacket = (pkt - swpPkt).toFixed(2);
        } else if (field === 'sweepedQuantity') {
          // If quantity changed, update packet
          newEntry.inHouseQuantity = (totalQty - swpQty).toFixed(2);
          newEntry.inHousePacket = size > 0 ? ((totalQty - swpQty) / size).toFixed(2) : 0;
          newEntry.sweepedPacket = size > 0 ? (swpQty / size).toFixed(2) : 0;
        } else {
          // If total packet or size changed, update everything based on current sweeped packet
          const currentSwpQty = Math.round(swpPkt * size);
          newEntry.sweepedQuantity = currentSwpQty;
          newEntry.inHouseQuantity = (totalQty - currentSwpQty).toFixed(2);
          newEntry.inHousePacket = (pkt - swpPkt).toFixed(2);
        }
      }

      updatedEntries[brandIndex] = newEntry;
      updatedProducts[productIndex] = {
        ...updatedProducts[productIndex],
        brandEntries: updatedEntries
      };

      return { ...prev, productEntries: updatedProducts };
    });
  };

  // Add new product entry
  const addProductEntry = () => {
    setStockFormData(prev => ({
      ...prev,
      productEntries: [
        ...prev.productEntries,
        {
          productName: '',
          truckNo: '',
          isMultiBrand: true,
          brandEntries: [
            {
              brand: '',
              packet: '',
              packetSize: '',
              sweepedPacket: '',
              sweepedSize: '',
              sweepedQuantity: '',
              inHousePacket: '',
              inHouseQuantity: '',
              quantity: '',
              unit: 'kg'
            }
          ]
        }
      ]
    }));
  };

  // Remove product entry
  const removeProductEntry = (index) => {
    if (stockFormData.productEntries.length === 1) return;
    setStockFormData(prev => ({
      ...prev,
      productEntries: prev.productEntries.filter((_, i) => i !== index)
    }));
  };

  // Add new brand entry
  const addBrandEntry = (productIndex) => {
    setStockFormData(prev => {
      const updatedProducts = [...prev.productEntries];
      updatedProducts[productIndex] = {
        ...updatedProducts[productIndex],
        brandEntries: [
          ...updatedProducts[productIndex].brandEntries,
          {
            brand: '',
            packet: '',
            packetSize: '',
            sweepedPacket: '',
            sweepedSize: '',
            sweepedQuantity: '',
            inHousePacket: '',
            inHouseQuantity: '',
            quantity: '',
            unit: 'kg'
          }
        ]
      };
      return { ...prev, productEntries: updatedProducts };
    });
  };

  // Remove brand entry
  const removeBrandEntry = (productIndex, brandIndex) => {
    setStockFormData(prev => {
      const updatedProducts = [...prev.productEntries];
      updatedProducts[productIndex] = {
        ...updatedProducts[productIndex],
        brandEntries: updatedProducts[productIndex].brandEntries.filter((_, i) => i !== brandIndex)
      };
      return { ...prev, productEntries: updatedProducts };
    });
  };

  const handleStockDropdownSelect = (name, value) => {
    setStockFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setActiveDropdown(null);
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

  const handleProductSelect = (pIndex, selectedProductName) => {
    const selectedProduct = products.find(p => p.name === selectedProductName);

    const newProductEntries = [...stockFormData.productEntries];
    newProductEntries[pIndex] = {
      ...newProductEntries[pIndex],
      productName: selectedProductName
    };

    // Auto-fill details if product found
    if (selectedProduct) {
      // Note: Auto-fill for size/unit moved to handleBrandEntryChange to trigger after brand selection
    }

    setStockFormData(prev => ({
      ...prev,
      productEntries: newProductEntries
    }));
    setActiveDropdown(null);
  };

  const getFilteredProducts = (query) => {
    if (!query) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      (p.hsCode && p.hsCode.toLowerCase().includes(query.toLowerCase()))
    );
  };

  const getFilteredBrands = (query, currentProductBrand) => {
    const uniqueBrands = [...new Set([
      ...(currentProductBrand ? [currentProductBrand] : []),
      ...products.map(p => p.brand).filter(Boolean)
    ])].filter(Boolean).sort();

    if (!query) return uniqueBrands;
    return uniqueBrands.filter(b => b.toLowerCase().includes(query.toLowerCase()));
  };

  const handleStockSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      let isSuccess = false;
      // Flatten all product and brand combinations into a single array of items to save
      const itemsToSave = [];
      const calcTotalLcTruck = stockFormData.productEntries.reduce((sum, p) => sum + (parseFloat(p.truckNo) || 0), 0).toString();
      const calcTotalLcQuantity = stockFormData.productEntries.reduce((pSum, p) =>
        pSum + p.brandEntries.reduce((bSum, b) => bSum + (parseFloat(b.quantity) || 0), 0)
        , 0).toFixed(2);

      stockFormData.productEntries.forEach(product => {
        product.brandEntries.forEach(brand => {
          itemsToSave.push({
            date: stockFormData.date,
            lcNo: stockFormData.lcNo,
            indianCnF: stockFormData.indianCnF,
            indCnFCost: stockFormData.indCnFCost,
            bdCnF: stockFormData.bdCnF,
            bdCnFCost: stockFormData.bdCnFCost,
            billOfEntry: stockFormData.billOfEntry,
            port: stockFormData.port,
            importer: stockFormData.importer,
            status: stockFormData.status,
            totalLcTruck: calcTotalLcTruck,
            totalLcQuantity: calcTotalLcQuantity,
            productName: product.productName,
            truckNo: product.truckNo,
            isMultiBrand: product.isMultiBrand,
            brand: brand.brand || product.productName,
            purchasedPrice: brand.purchasedPrice,
            packet: brand.packet,
            packetSize: brand.packetSize,
            quantity: brand.quantity,
            inHousePacket: brand.inHousePacket,
            inHouseQuantity: brand.inHouseQuantity,
            sweepedPacket: brand.sweepedPacket,
            sweepedQuantity: brand.sweepedQuantity,
            unit: brand.unit
          });
        });
      });

      if (editingId) {
        // Handle grouped updates to prevent ghost/replicate records
        const originalIds = stockFormData.allIds || [editingId];
        const itemsCount = itemsToSave.length;
        const idsCount = originalIds.length;

        // Perform updates for matching indices
        const updatePromises = itemsToSave.slice(0, Math.min(itemsCount, idsCount)).map((item, index) => {
          const url = `${API_BASE_URL}/api/stock/${originalIds[index]}`;
          const encryptedPayload = { data: encryptData(item) };
          return fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(encryptedPayload),
          });
        });

        // Perform deletions for orphans
        const deletePromises = idsCount > itemsCount
          ? originalIds.slice(itemsCount).map(id =>
            fetch(`${API_BASE_URL}/api/stock/${id}`, { method: 'DELETE' })
          )
          : [];

        // Perform creations for extras
        const createPromises = itemsCount > idsCount
          ? itemsToSave.slice(idsCount).map(item => {
            const url = `${API_BASE_URL}/api/stock`;
            const encryptedPayload = { data: encryptData(item) };
            return fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(encryptedPayload),
            });
          })
          : [];

        const allResults = await Promise.all([...updatePromises, ...deletePromises, ...createPromises]);

        if (allResults.every(res => res.ok)) {
          isSuccess = true;
          setSubmitStatus('success');
          fetchStockRecords();
        } else {
          setSubmitStatus('error');
        }
      } else {
        // For new records, send separate POST requests for each item
        const results = await Promise.all(itemsToSave.map(async (item) => {
          const url = `${API_BASE_URL}/api/stock`;
          const encryptedPayload = { data: encryptData(item) };
          return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(encryptedPayload),
          });
        }));

        if (results.every(res => res.ok)) {
          isSuccess = true;
          setSubmitStatus('success');
          fetchStockRecords();
        } else {
          setSubmitStatus('error');
        }
      }

      if (isSuccess) {
        setTimeout(() => {
          setShowStockForm(false);
          resetStockForm();
        }, 2000);
      }
    } catch (error) {
      console.error('Error saving stock:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
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
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">LC Receive Management</h2>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-2 ${showFilters ? 'bg-indigo-100 text-indigo-600 border-indigo-200' : 'bg-white text-gray-600 border border-gray-200'} font-medium rounded-lg shadow-sm transition-all flex items-center hover:bg-gray-50 border`}
                >
                  <FunnelIcon className="w-4 h-4 mr-2" /> {showFilters ? 'Hide Filters' : 'Filter'}
                </button>
                <button
                  onClick={() => setShowStockForm(!showStockForm)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center"
                >
                  <span className="mr-2 text-xl">+</span> Add New
                </button>
              </div>
            </div>

            {/* Placeholder message - Stock form will appear here when Add New is clicked */}
            {showStockForm && (
              <div className="relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl p-8 transition-all duration-300">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex items-center justify-between mb-6 border-b border-gray-200/50 pb-4 relative z-10">
                  <h3 className="text-xl font-semibold text-gray-800">{editingId ? 'Edit Stock' : 'New LC Receive'}</h3>
                  <button onClick={() => { setShowStockForm(false); resetStockForm(); }} className="text-gray-400 hover:text-red-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>

                <form onSubmit={handleStockSubmit} autoComplete="off" className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                  <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-6">
                    <CustomDatePicker
                      label="Date"
                      name="date"
                      value={stockFormData.date}
                      onChange={handleStockInputChange}
                      required
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
                          onChange={handleStockInputChange}
                          onFocus={() => setActiveDropdown('port')}
                          onKeyDown={(e) => handleDropdownKeyDown(e, 'port', handleStockDropdownSelect, 'port')}
                          required
                          placeholder="Select or type port name"
                          autoComplete="off"
                          className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setActiveDropdown(activeDropdown === 'port' ? null : 'port')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <ChevronDownIcon className={`w-4 h-4 transition-transform ${activeDropdown === 'port' ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      {activeDropdown === 'port' && (
                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto animate-in fade-in zoom-in duration-200">
                          {getFilteredOptions('port').map((port, index) => (
                            <button
                              key={port._id}
                              type="button"
                              onClick={() => handleStockDropdownSelect('port', port.name)}
                              onMouseEnter={() => setHighlightedIndex(index)}
                              className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${highlightedIndex === index ? 'bg-blue-50 text-blue-700' : 'hover:bg-blue-50'}`}
                            >
                              <span>{port.name}</span>
                              {stockFormData.port === port.name && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                            </button>
                          ))}
                          {getFilteredOptions('port').length === 0 && (
                            <div className="px-4 py-3 text-sm text-gray-500 italic">No ports found</div>
                          )}
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
                          onChange={handleStockInputChange}
                          onFocus={() => setActiveDropdown('importer')}
                          onKeyDown={(e) => handleDropdownKeyDown(e, 'importer', handleStockDropdownSelect, 'importer')}
                          required
                          placeholder="Select or type importer"
                          autoComplete="off"
                          className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setActiveDropdown(activeDropdown === 'importer' ? null : 'importer')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <ChevronDownIcon className={`w-4 h-4 transition-transform ${activeDropdown === 'importer' ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      {activeDropdown === 'importer' && (
                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto animate-in fade-in zoom-in duration-200">
                          {getFilteredOptions('importer').map((imp, index) => (
                            <button
                              key={imp._id}
                              type="button"
                              onClick={() => handleStockDropdownSelect('importer', imp.name)}
                              onMouseEnter={() => setHighlightedIndex(index)}
                              className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${highlightedIndex === index ? 'bg-blue-50 text-blue-700' : 'hover:bg-blue-50'}`}
                            >
                              <span>{imp.name}</span>
                              {stockFormData.importer === imp.name && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                            </button>
                          ))}
                          {getFilteredOptions('importer').length === 0 && (
                            <div className="px-4 py-3 text-sm text-gray-500 italic">No importers found</div>
                          )}
                        </div>
                      )}
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
                            {/* Product Info Row */}
                            {product.isMultiBrand ? (
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
                                  <div className="relative" ref={el => productRefs.current[pIndex] = el}>
                                    <input
                                      type="text"
                                      name="productName"
                                      value={product.productName}
                                      onChange={(e) => handleStockInputChange(e, pIndex)}
                                      onFocus={() => {
                                        setActiveDropdown(`product-${pIndex}`);
                                        setHighlightedIndex(-1);
                                      }}
                                      onKeyDown={(e) => handleDropdownKeyDown(e, `product-${pIndex}`, (field, name) => handleProductSelect(pIndex, name), 'productName')}
                                      required
                                      placeholder="Select or type product"
                                      autoComplete="off"
                                      className="w-full h-[42px] px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-10"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setActiveDropdown(activeDropdown === `product-${pIndex}` ? null : `product-${pIndex}`)}
                                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                    >
                                      <ChevronDownIcon className={`w-4 h-4 transition-transform ${activeDropdown === `product-${pIndex}` ? 'rotate-180' : ''}`} />
                                    </button>

                                    {activeDropdown === `product-${pIndex}` && (
                                      <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto animate-in fade-in zoom-in duration-200">
                                        {getFilteredProducts(product.productName).map((prod, idx) => (
                                          <button
                                            key={prod._id}
                                            type="button"
                                            onClick={() => handleProductSelect(pIndex, prod.name)}
                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                            className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'hover:bg-blue-50'}`}
                                          >
                                            <span className="font-medium text-gray-900">{prod.name}</span>
                                            {product.productName === prod.name && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                                          </button>
                                        ))}
                                        {getFilteredProducts(product.productName).length === 0 && (
                                          <div className="px-4 py-3 text-sm text-gray-500 italic">
                                            No products found. Type to create new.
                                          </div>
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
                            ) : (
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
                                  <input
                                    type="text" name="productName" value={product.productName}
                                    onChange={(e) => handleStockInputChange(e, pIndex)}
                                    onFocus={() => {
                                      setActiveDropdown(`product-${pIndex}`);
                                      setHighlightedIndex(-1);
                                    }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, `product-${pIndex}`, (field, name) => handleProductSelect(pIndex, name), 'productName')}
                                    required
                                    placeholder="Product Name" autoComplete="off" className="w-full h-[42px] px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-sm"
                                  />
                                  {activeDropdown === `product-${pIndex}` && !product.isMultiBrand && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto animate-in fade-in zoom-in duration-200">
                                      {getFilteredProducts(product.productName).map((prod, idx) => (
                                        <button
                                          key={prod._id}
                                          type="button"
                                          onClick={() => handleProductSelect(pIndex, prod.name)}
                                          onMouseEnter={() => setHighlightedIndex(idx)}
                                          className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'hover:bg-blue-50'}`}
                                        >
                                          <span className="font-medium text-gray-900">{prod.name}</span>
                                          {product.productName === prod.name && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                                        </button>
                                      ))}
                                    </div>
                                  )}
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
                                              placeholder="Select Brand"
                                              onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'brand', e.target.value)}
                                              onFocus={() => {
                                                setActiveDropdown(`brand-${pIndex}-${bIndex}`);
                                                setHighlightedIndex(-1);
                                              }}
                                              onKeyDown={(e) => handleDropdownKeyDown(e, `brand-${pIndex}-${bIndex}`, (field, val) => handleBrandEntryChange(pIndex, bIndex, 'brand', val), 'brand')}
                                              className="w-full h-9 px-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            />
                                            {activeDropdown === `brand-${pIndex}-${bIndex}` && (
                                              <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                {getFilteredBrands(entry.brand, products.find(p => p.name === product.productName)?.brand).map((brand, idx) => (
                                                  <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                      handleBrandEntryChange(pIndex, bIndex, 'brand', brand);
                                                      setActiveDropdown(null);
                                                    }}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'hover:bg-blue-50'}`}
                                                  >
                                                    <span>{brand}</span>
                                                    {products.find(p => p.name === product.productName)?.brand === brand && (
                                                      <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">Product Brand</span>
                                                    )}
                                                  </button>
                                                ))}
                                                {getFilteredBrands(entry.brand, products.find(p => p.name === product.productName)?.brand).length === 0 && (
                                                  <div className="px-3 py-2 text-sm text-gray-500 italic">Type to add new brand</div>
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
                  <div className="col-span-1 md:col-span-2 pt-4 border-t border-gray-100">
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
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 pt-4 flex items-center justify-between">
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
                    <div className="flex-1"></div>
                    <button
                      type="submit" disabled={isSubmitting}
                      className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Saving...' : editingId ? 'Update Stock' : 'Add to Stock'}
                    </button>
                  </div>
                </form>
              </div>
            )}
            {/* LC Receive Table */}
            {!showStockForm && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50">
                      <tr className="border-b border-gray-100 select-none">
                        {isSelectionMode && <th className="px-6 py-4 w-12"></th>}
                        {[
                          { key: 'date', label: 'Date' },
                          { key: 'lcNo', label: 'LC No' },
                          { key: 'importer', label: 'Importer' },
                          { key: 'port', label: 'Port' },
                          { key: 'indianCnF', label: 'IND CNF' },
                          { key: 'indianCnFCost', label: 'IND CNF Cost' },
                          { key: 'bdCnF', label: 'BD CNF' },
                          { key: 'bdCnFCost', label: 'BD CNF Cost' },
                          { key: 'billOfEntry', label: 'Bill Of Entry' },
                          { key: 'products', label: 'Products' },
                          { key: 'truck', label: 'Truck' },
                          { key: 'quantity', label: 'Quantity' },
                          { key: 'actions', label: 'Actions' },
                        ].map((col) => (
                          <th key={col.key} className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {Object.values(stockRecords.reduce((acc, item) => {
                        const key = item.lcNo || 'unknown';
                        if (!acc[key]) {
                          acc[key] = {
                            ...item,
                            totalQuantity: 0,
                            totalLcTruck: 0,
                            products: new Set(),
                            truckEntries: new Set(), // Track unique product-truck combos
                            ids: [], // Collect all IDs for bulk action
                            allIds: [],
                            originalId: item._id,
                            groupedKey: key,
                            entries: []
                          };
                        }
                        const itemQty = parseFloat(item.quantity) || 0;
                        acc[key].totalQuantity += itemQty;

                        // Sum truck load only once per product-truck entry
                        const truckEntryKey = `${item.productName}-${item.truckNo}`;
                        if (!acc[key].truckEntries.has(truckEntryKey)) {
                          acc[key].totalLcTruck += (parseFloat(item.truckNo) || 0);
                          acc[key].truckEntries.add(truckEntryKey);
                        }

                        if (item.productName) acc[key].products.add(item.productName);
                        acc[key].ids.push(item._id); // Add ID
                        acc[key].allIds.push(item._id);
                        acc[key].entries.push(item);
                        return acc;
                      }, {})).map((entry, index) => (
                        <tr
                          key={entry.groupedKey}
                          className={`${selectedItems.has(entry.groupedKey) ? 'bg-blue-50/30' : 'hover:bg-gray-50'} transition-colors duration-200 cursor-pointer select-none`}
                          onMouseDown={() => startLongPress(entry.groupedKey)}
                          onMouseUp={endLongPress}
                          onMouseLeave={endLongPress}
                          onTouchStart={() => startLongPress(entry.groupedKey)}
                          onTouchEnd={endLongPress}
                          onClick={() => {
                            if (isLongPressTriggered.current) {
                              isLongPressTriggered.current = false;
                              return;
                            }
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
                          <td className="px-6 py-4 text-sm text-gray-600">{entry.port || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{entry.indianCnF || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                            {!isNaN(parseFloat(entry.indCnFCost)) && entry.indCnFCost !== '' ? `৳${parseFloat(entry.indCnFCost).toLocaleString()}` : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{entry.bdCnF || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                            {!isNaN(parseFloat(entry.bdCnFCost)) && entry.bdCnFCost !== '' ? `৳${parseFloat(entry.bdCnFCost).toLocaleString()}` : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{entry.billOfEntry || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={Array.from(entry.products).join(', ')}>
                            {Array.from(entry.products).join(', ') || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {Math.round(entry.totalLcTruck) || '0'}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{Math.round(entry.totalQuantity)}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit('stock', entry);
                                }}
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                title="Edit"
                              >
                                <EditIcon className="w-5 h-5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Delete logic: Select all IDs and trigger bulk delete
                                  const ids = entry.ids;
                                  setSelectedItems(new Set(ids));
                                  handleDelete('stock', null, true);
                                }}
                                className="text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete"
                              >
                                <TrashIcon className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {Object.keys(stockRecords).length === 0 && (
                        <tr>
                          <td colSpan="12" className="px-6 py-12 text-center text-gray-500">
                            <div className="flex flex-col items-center justify-center">
                              <DollarSignIcon className="w-12 h-12 text-gray-300 mb-3" />
                              <p className="text-lg font-medium text-gray-600">No LC Entries Found</p>
                              <p className="text-sm text-gray-400 mt-1">Add a new entry to see it here</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      case 'ip-section':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">IP Management</h2>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-2 ${showFilters ? 'bg-indigo-100 text-indigo-600 border-indigo-200' : 'bg-white text-gray-600 border border-gray-200'} font-medium rounded-lg shadow-sm transition-all flex items-center hover:bg-gray-50 border`}
                >
                  <FunnelIcon className="w-4 h-4 mr-2" /> {showFilters ? 'Hide Filters' : 'Filter'}
                </button>
                <button
                  onClick={() => setShowIpForm(!showIpForm)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center"
                >
                  <span className="mr-2 text-xl">+</span> Add New
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl p-6 transition-all duration-300 animate-in slide-in-from-top-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
                  {/* Quick Range */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Quick Range</label>
                    <div className="flex flex-wrap gap-2">
                      {['all', 'weekly', 'monthly', 'yearly'].map(range => (
                        <button
                          key={range}
                          onClick={() => setFilters(prev => ({ ...prev, quickRange: range, startDate: '', endDate: '' }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filters.quickRange === range ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                          {range.charAt(0).toUpperCase() + range.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Range */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Date Range</label>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 min-w-0 pointer-cursor">
                        <CustomDatePicker
                          value={filters.startDate}
                          onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value, quickRange: 'custom' }))}
                          name="startDate"
                          placeholder="From"
                        />
                      </div>
                      <span className="text-gray-400">to</span>
                      <div className="flex-1 min-w-0">
                        <CustomDatePicker
                          value={filters.endDate}
                          onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value, quickRange: 'custom' }))}
                          name="endDate"
                          placeholder="To"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Port */}
                  <div className="space-y-3 relative" ref={filterPortRef}>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Port</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={filters.port}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFilters(prev => ({ ...prev, port: val }));
                          setActiveDropdown('filterPort');
                        }}
                        onFocus={() => setActiveDropdown('filterPort')}
                        onKeyDown={(e) => handleDropdownKeyDown(e, 'filterPort', handleFilterDropdownSelect, 'port')}
                        placeholder="All Ports"
                        className="w-full px-3 py-2 text-xs bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setActiveDropdown(activeDropdown === 'filterPort' ? null : 'filterPort')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <ChevronDownIcon className={`w-3 h-3 transition-transform ${activeDropdown === 'filterPort' ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    {activeDropdown === 'filterPort' && (
                      <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto animate-in fade-in zoom-in duration-200">
                        <button
                          type="button"
                          onClick={() => handleFilterDropdownSelect('port', '')}
                          onMouseEnter={() => setHighlightedIndex(0)}
                          className={`w-full text-left px-3 py-2 text-[10px] transition-colors flex items-center justify-between ${highlightedIndex === 0 ? 'bg-blue-50 text-blue-700' : 'hover:bg-blue-50'}`}
                        >
                          <span className="italic text-gray-400">All Ports</span>
                          {filters.port === '' && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>}
                        </button>
                        {getFilteredOptions('filterPort').map((port, index) => (
                          <button
                            key={port._id}
                            type="button"
                            onClick={() => handleFilterDropdownSelect('port', port.name)}
                            onMouseEnter={() => setHighlightedIndex(index + 1)}
                            className={`w-full text-left px-3 py-2 text-[10px] transition-colors flex items-center justify-between ${highlightedIndex === index + 1 ? 'bg-blue-50 text-blue-700' : 'hover:bg-blue-50'}`}
                          >
                            <span>{port.name}</span>
                            {filters.port === port.name && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>


                  {/* Importer */}
                  <div className="space-y-3 relative" ref={filterImporterRef}>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Importer</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={filters.importer}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFilters(prev => ({ ...prev, importer: val }));
                          setActiveDropdown('filterImporter');
                        }}
                        onFocus={() => setActiveDropdown('filterImporter')}
                        onKeyDown={(e) => handleDropdownKeyDown(e, 'filterImporter', handleFilterDropdownSelect, 'importer')}
                        placeholder="All Importers"
                        className="w-full px-3 py-2 text-xs bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setActiveDropdown(activeDropdown === 'filterImporter' ? null : 'filterImporter')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <ChevronDownIcon className={`w-3 h-3 transition-transform ${activeDropdown === 'filterImporter' ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    {activeDropdown === 'filterImporter' && (
                      <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto animate-in fade-in zoom-in duration-200">
                        <button
                          type="button"
                          onClick={() => handleFilterDropdownSelect('importer', '')}
                          onMouseEnter={() => setHighlightedIndex(0)}
                          className={`w-full text-left px-3 py-2 text-[10px] transition-colors flex items-center justify-between ${highlightedIndex === 0 ? 'bg-blue-50 text-blue-700' : 'hover:bg-blue-50'}`}
                        >
                          <span className="italic text-gray-400">All Importers</span>
                          {filters.importer === '' && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>}
                        </button>
                        {getFilteredOptions('filterImporter').map((imp, index) => (
                          <button
                            key={imp._id}
                            type="button"
                            onClick={() => handleFilterDropdownSelect('importer', imp.name)}
                            onMouseEnter={() => setHighlightedIndex(index + 1)}
                            className={`w-full text-left px-3 py-2 text-[10px] transition-colors flex items-center justify-between ${highlightedIndex === index + 1 ? 'bg-blue-50 text-blue-700' : 'hover:bg-blue-50'}`}
                          >
                            <span>{imp.name}</span>
                            {filters.importer === imp.name && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

                <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
                  <button
                    onClick={resetFilters}
                    className="flex items-center text-xs font-bold text-gray-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                  >
                    <XIcon className="w-3 h-3 mr-1" /> Clear Filters
                  </button>
                </div>
              </div>
            )}

            {showIpForm && (
              <div className="relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl p-8 transition-all duration-300">
                {/* Decorative gradient orb for glass effect enhancement */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex items-center justify-between mb-6 border-b border-gray-200/50 pb-4 relative z-10">
                  <h3 className="text-xl font-semibold text-gray-800">{editingId ? 'Edit IP Record' : 'New IP Insertion'}</h3>
                  <button onClick={() => { setShowIpForm(false); resetIpForm(); }} className="text-gray-400 hover:text-red-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                  {/* Opening Date */}
                  <CustomDatePicker
                    label="Opening Date"
                    name="openingDate"
                    value={formData.openingDate}
                    onChange={handleInputChange}
                    required
                  />

                  {/* Close Date */}
                  <CustomDatePicker
                    label="Close Date"
                    name="closeDate"
                    value={formData.closeDate}
                    onChange={handleInputChange}
                  />

                  {/* IP Number */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">IP Number</label>
                    <input
                      type="text"
                      name="ipNumber"
                      value={formData.ipNumber}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter IP Number"
                      className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                  </div>

                  {/* Reference No */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Reference No</label>
                    <input
                      type="text"
                      name="referenceNo"
                      value={formData.referenceNo}
                      onChange={handleInputChange}
                      required
                      placeholder="REF-12345"
                      className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                  </div>

                  {/* Importer Select Dropdown */}
                  <div className="col-span-1 md:col-span-2 space-y-2 relative" ref={ipImporterRef}>
                    <label className="text-sm font-medium text-gray-700">Importer</label>
                    <div className="relative">
                      <input
                        type="text"
                        name="ipParty"
                        value={formData.ipParty}
                        onChange={handleInputChange}
                        onFocus={() => setActiveDropdown('ipImporter')}
                        onKeyDown={(e) => handleDropdownKeyDown(e, 'ipImporter', handleIpDropdownSelect, 'ipParty')}
                        required
                        placeholder="Select or type importer name"
                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setActiveDropdown(activeDropdown === 'ipImporter' ? null : 'ipImporter')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <ChevronDownIcon className={`w-4 h-4 transition-transform ${activeDropdown === 'ipImporter' ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    {activeDropdown === 'ipImporter' && (
                      <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto animate-in fade-in zoom-in duration-200">
                        {getFilteredOptions('ipImporter').map((importer, index) => (
                          <button
                            key={importer._id}
                            type="button"
                            onClick={() => handleIpDropdownSelect('ipParty', importer.name)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${highlightedIndex === index ? 'bg-blue-50 text-blue-700' : 'hover:bg-blue-50'}`}
                          >
                            <span>{importer.name}</span>
                            {formData.ipParty === importer.name && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                          </button>
                        ))}
                        {getFilteredOptions('ipImporter').length === 0 && (
                          <div className="px-4 py-3 text-sm text-gray-500 italic">No importers found</div>
                        )}
                      </div>
                    )}
                  </div>


                  {/* Product Name */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Product Name</label>
                    <input
                      type="text"
                      name="productName"
                      value={formData.productName}
                      onChange={handleInputChange}
                      required
                      placeholder="Product Name"
                      className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                  </div>

                  {/* Quantity */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Quantity (kg)</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="quantity"
                        value={formData.quantity}
                        onChange={handleInputChange}
                        required
                        placeholder="0.00"
                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-400 text-sm">kg</span>
                      </div>
                    </div>
                  </div>

                  {/* Port */}
                  <div className="space-y-2 relative" ref={ipPortRef}>
                    <label className="text-sm font-medium text-gray-700">Port</label>
                    <div className="relative">
                      <input
                        type="text"
                        name="port"
                        value={formData.port}
                        onChange={handleInputChange}
                        onFocus={() => setActiveDropdown('ipPort')}
                        onKeyDown={(e) => handleDropdownKeyDown(e, 'ipPort', handleIpDropdownSelect, 'port')}
                        required
                        placeholder="Select or type port name"
                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setActiveDropdown(activeDropdown === 'ipPort' ? null : 'ipPort')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <ChevronDownIcon className={`w-4 h-4 transition-transform ${activeDropdown === 'ipPort' ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    {activeDropdown === 'ipPort' && (
                      <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto animate-in fade-in zoom-in duration-200">
                        {getFilteredOptions('ipPort').map((port, index) => (
                          <button
                            key={port._id}
                            type="button"
                            onClick={() => handleIpDropdownSelect('port', port.name)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${highlightedIndex === index ? 'bg-blue-50 text-blue-700' : 'hover:bg-blue-50'}`}
                          >
                            <span>{port.name}</span>
                            {formData.port === port.name && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                          </button>
                        ))}
                        {getFilteredOptions('ipPort').length === 0 && (
                          <div className="px-4 py-3 text-sm text-gray-500 italic">No ports found</div>
                        )}
                      </div>
                    )}
                  </div>


                  {/* Status */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    >
                      <option>Active</option>
                      <option>Closed</option>
                      <option>Pending</option>
                    </select>
                  </div>

                  {/* Submit Button */}
                  <div className="col-span-1 md:col-span-2 pt-4 flex items-center justify-between">
                    {submitStatus === 'success' && (
                      <p className="text-green-600 font-medium flex items-center animate-bounce">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        Record saved successfully!
                      </p>
                    )}
                    {submitStatus === 'error' && (
                      <p className="text-red-600 font-medium flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        Failed to save record.
                      </p>
                    )}
                    <div className="flex-1"></div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center ${isSubmitting ? 'opacity-70 cursor-not-allowed scale-100' : ''}`}
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : 'Save IP Record'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {!showIpForm && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {selectedItems.size > 0 && (
                  <div className="bg-blue-50 px-6 py-3 border-b border-blue-100 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <span className="text-sm font-medium text-blue-700">{selectedItems.size} items selected</span>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => { setSelectedItems(new Set()); setIsSelectionMode(false); }}
                        className="px-3 py-1 text-gray-600 hover:text-gray-800 text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ show: true, type: 'ip', id: null, isBulk: true })}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition-colors flex items-center"
                      >
                        <TrashIcon className="w-3.5 h-3.5 mr-1" /> Delete Bulk
                      </button>
                    </div>
                  </div>
                )}
                {isLoading ? (
                  <div className="flex items-center justify-center p-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : filteredIpRecords.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr
                          className="bg-gray-50 border-b border-gray-100 select-none cursor-pointer"
                          onMouseDown={() => startLongPress(null)}
                          onMouseUp={endLongPress}
                          onMouseLeave={endLongPress}
                          onTouchStart={() => startLongPress(null)}
                          onTouchEnd={endLongPress}
                        >
                          {isSelectionMode && (
                            <th className="px-6 py-4 w-10">
                              <input
                                type="checkbox"
                                checked={selectedItems.size === filteredIpRecords.length && filteredIpRecords.length > 0}
                                onChange={() => toggleSelectAll(filteredIpRecords)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </th>
                          )}
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('ip', 'openingDate')}>
                            <div className="flex items-center">Opening Date <SortIcon config={sortConfig.ip} columnKey="openingDate" /></div>
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('ip', 'ipNumber')}>
                            <div className="flex items-center">IP Number <SortIcon config={sortConfig.ip} columnKey="ipNumber" /></div>
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('ip', 'ipParty')}>
                            <div className="flex items-center">Importer <SortIcon config={sortConfig.ip} columnKey="ipParty" /></div>
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('ip', 'productName')}>
                            <div className="flex items-center">Product <SortIcon config={sortConfig.ip} columnKey="productName" /></div>
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('ip', 'quantity')}>
                            <div className="flex items-center">Quantity (kg) <SortIcon config={sortConfig.ip} columnKey="quantity" /></div>
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('ip', 'status')}>
                            <div className="flex items-center">Status <SortIcon config={sortConfig.ip} columnKey="status" /></div>
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sortData(filteredIpRecords, 'ip').map((record) => (
                          <tr
                            key={record._id}
                            className={`${selectedItems.has(record._id) ? 'bg-blue-50/30' : 'hover:bg-gray-50'} transition-colors cursor-pointer select-none`}
                            onMouseDown={() => startLongPress(record._id)}
                            onMouseUp={endLongPress}
                            onMouseLeave={endLongPress}
                            onTouchStart={() => startLongPress(record._id)}
                            onTouchEnd={endLongPress}
                            onClick={() => {
                              if (isLongPressTriggered.current) {
                                isLongPressTriggered.current = false;
                                return;
                              }
                              if (isSelectionMode) toggleSelection(record._id);
                            }}
                          >
                            {isSelectionMode && (
                              <td className="px-6 py-4">
                                <input
                                  type="checkbox"
                                  checked={selectedItems.has(record._id)}
                                  onChange={(e) => { e.stopPropagation(); toggleSelection(record._id); }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                            )}
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {formatDate(record.openingDate)}
                            </td>

                            <td className="px-6 py-4 text-sm font-medium text-blue-600">{record.ipNumber}</td>
                            <td className="px-6 py-4 text-sm text-gray-900">{record.ipParty}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{record.productName}</td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{record.quantity} kg</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${record.status === 'Active' ? 'bg-green-50 text-green-700 border border-green-100' :
                                record.status === 'Closed' ? 'bg-gray-50 text-gray-700 border border-gray-100' :
                                  'bg-yellow-50 text-yellow-700 border border-yellow-100'
                                }`}>
                                {record.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <button onClick={(e) => { e.stopPropagation(); handleEdit('ip', record); }} className="text-gray-400 hover:text-blue-600 transition-colors">
                                  <EditIcon className="w-5 h-5" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete('ip', record._id); }} className="text-gray-400 hover:text-red-600 transition-colors">
                                  <TrashIcon className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12">
                    <div className="p-4 bg-gray-50 rounded-full mb-4">
                      <BoxIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium">No IP records found</p>
                    <p className="text-sm text-gray-400 mt-1">Click "Add New" to create a new entry</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      case 'importer-section':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Importer Management</h2>
              <button
                onClick={() => setShowImporterForm(!showImporterForm)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center"
              >
                <span className="mr-2 text-xl">+</span> Add New
              </button>
            </div>

            {showImporterForm && (
              <div className="relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl p-8 transition-all duration-300">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex items-center justify-between mb-6 border-b border-gray-200/50 pb-4 relative z-10">
                  <h3 className="text-xl font-semibold text-gray-800">{editingId ? 'Edit Importer' : 'New Importer Registration'}</h3>
                  <button onClick={() => { setShowImporterForm(false); resetImporterForm(); }} className="text-gray-400 hover:text-red-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>

                <form onSubmit={handleImporterSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Importer Name</label>
                    <input
                      type="text" name="name" value={importerFormData.name} onChange={handleImporterInputChange} required
                      placeholder="Full Name" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">License No</label>
                    <input
                      type="text" name="licenseNo" value={importerFormData.licenseNo} onChange={handleImporterInputChange} required
                      placeholder="LIC-00000" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-2 space-y-2">
                    <label className="text-sm font-medium text-gray-700">Address</label>
                    <textarea
                      name="address" value={importerFormData.address} onChange={handleImporterInputChange} required
                      placeholder="Full Address" rows="2" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Contact Person</label>
                    <input
                      type="text" name="contactPerson" value={importerFormData.contactPerson} onChange={handleImporterInputChange} required
                      placeholder="Contact Name" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email" name="email" value={importerFormData.email} onChange={handleImporterInputChange} required
                      placeholder="email@example.com" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Phone</label>
                    <input
                      type="tel" name="phone" value={importerFormData.phone} onChange={handleImporterInputChange} required
                      placeholder="+880..." className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <select
                      name="status" value={importerFormData.status} onChange={handleImporterInputChange}
                      className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    >
                      <option>Active</option>
                      <option>Inactive</option>
                    </select>
                  </div>

                  <div className="col-span-1 md:col-span-2 pt-4 flex items-center justify-between">
                    {submitStatus === 'success' && (
                      <p className="text-green-600 font-medium flex items-center animate-bounce">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        Importer saved successfully!
                      </p>
                    )}
                    {submitStatus === 'error' && (
                      <p className="text-red-600 font-medium flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        Failed to save importer.
                      </p>
                    )}
                    <div className="flex-1"></div>
                    <button
                      type="submit" disabled={isSubmitting}
                      className={`px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg transition-all transform hover:scale-105 flex items-center ${isSubmitting ? 'opacity-70 cursor-not-allowed scale-100' : ''}`}
                    >
                      {isSubmitting ? 'Saving...' : editingId ? 'Update Record' : 'Save Record'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {!showImporterForm && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {selectedItems.size > 0 && (
                  <div className="bg-blue-50 px-6 py-3 border-b border-blue-100 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <span className="text-sm font-medium text-blue-700">{selectedItems.size} items selected</span>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => { setSelectedItems(new Set()); setIsSelectionMode(false); }}
                        className="px-3 py-1 text-gray-600 hover:text-gray-800 text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ show: true, type: 'importer', id: null, isBulk: true })}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition-colors flex items-center"
                      >
                        <TrashIcon className="w-3.5 h-3.5 mr-1" /> Delete Bulk
                      </button>
                    </div>
                  </div>
                )}
                {isLoading ? (
                  <div className="flex items-center justify-center p-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : importers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr
                          className="bg-gray-50 border-b border-gray-100 select-none cursor-pointer"
                          onMouseDown={() => startLongPress(null)}
                          onMouseUp={endLongPress}
                          onMouseLeave={endLongPress}
                          onTouchStart={() => startLongPress(null)}
                          onTouchEnd={endLongPress}
                        >
                          {isSelectionMode && (
                            <th className="px-6 py-4 w-10">
                              <input
                                type="checkbox"
                                checked={selectedItems.size === importers.length}
                                onChange={() => toggleSelectAll(importers)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </th>
                          )}
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('importer', 'name')}>
                            <div className="flex items-center">Importer Name <SortIcon config={sortConfig.importer} columnKey="name" /></div>
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('importer', 'licenseNo')}>
                            <div className="flex items-center">License No <SortIcon config={sortConfig.importer} columnKey="licenseNo" /></div>
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('importer', 'contactPerson')}>
                            <div className="flex items-center">Contact Person <SortIcon config={sortConfig.importer} columnKey="contactPerson" /></div>
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('importer', 'phone')}>
                            <div className="flex items-center">Phone <SortIcon config={sortConfig.importer} columnKey="phone" /></div>
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('importer', 'status')}>
                            <div className="flex items-center">Status <SortIcon config={sortConfig.importer} columnKey="status" /></div>
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sortData(importers, 'importer').map((importer) => (
                          <tr
                            key={importer._id}
                            className={`${selectedItems.has(importer._id) ? 'bg-blue-50/30' : 'hover:bg-gray-50'} transition-colors cursor-pointer select-none`}
                            onMouseDown={() => startLongPress(importer._id)}
                            onMouseUp={endLongPress}
                            onMouseLeave={endLongPress}
                            onTouchStart={() => startLongPress(importer._id)}
                            onTouchEnd={endLongPress}
                            onClick={() => {
                              if (isLongPressTriggered.current) {
                                isLongPressTriggered.current = false;
                                return;
                              }
                              if (isSelectionMode) toggleSelection(importer._id);
                            }}
                          >
                            {isSelectionMode && (
                              <td className="px-6 py-4">
                                <input
                                  type="checkbox"
                                  checked={selectedItems.has(importer._id)}
                                  onChange={(e) => { e.stopPropagation(); toggleSelection(importer._id); }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                            )}
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{importer.name}</td>
                            <td className="px-6 py-4 text-sm text-blue-600">{importer.licenseNo}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{importer.contactPerson}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{importer.phone}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${importer.status === 'Active' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-gray-50 text-gray-700 border border-gray-100'
                                }`}>
                                {importer.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <button onClick={(e) => { e.stopPropagation(); handleEdit('importer', importer); }} className="text-gray-400 hover:text-blue-600 transition-colors">
                                  <EditIcon className="w-5 h-5" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete('importer', importer._id); }} className="text-gray-400 hover:text-red-600 transition-colors">
                                  <TrashIcon className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12">
                    <div className="p-4 bg-gray-50 rounded-full mb-4">
                      <UsersIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium">No importers found</p>
                    <p className="text-sm text-gray-400 mt-1">Click "Add New" to register a new importer</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      case 'port-section':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Port Management</h2>
              <button
                onClick={() => setShowPortForm(!showPortForm)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center"
              >
                <span className="mr-2 text-xl">+</span> Add New
              </button>
            </div>

            {showPortForm && (
              <div className="relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl p-8 transition-all duration-300">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex items-center justify-between mb-6 border-b border-gray-200/50 pb-4 relative z-10">
                  <h3 className="text-xl font-semibold text-gray-800">{editingId ? 'Edit Port' : 'New Port Registration'}</h3>
                  <button onClick={() => { setShowPortForm(false); resetPortForm(); }} className="text-gray-400 hover:text-red-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>

                <form onSubmit={handlePortSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Port Name</label>
                    <input
                      type="text" name="name" value={portFormData.name} onChange={handlePortInputChange} required
                      placeholder="e.g., Chittagong Port" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Port Code</label>
                    <input
                      type="text" name="code" value={portFormData.code} onChange={handlePortInputChange} required
                      placeholder="e.g., BDCGP" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Location</label>
                    <input
                      type="text" name="location" value={portFormData.location} onChange={handlePortInputChange} required
                      placeholder="City, Country" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Port Type</label>
                    <select
                      name="type" value={portFormData.type} onChange={handlePortInputChange}
                      className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    >
                      <option>Seaport</option>
                      <option>Airport</option>
                      <option>Land Port</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <select
                      name="status" value={portFormData.status} onChange={handlePortInputChange}
                      className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    >
                      <option>Active</option>
                      <option>Inactive</option>
                    </select>
                  </div>

                  <div className="col-span-1 md:col-span-2 pt-4 flex items-center justify-between">
                    {submitStatus === 'success' && (
                      <p className="text-green-600 font-medium flex items-center animate-bounce">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        Port saved successfully!
                      </p>
                    )}
                    {submitStatus === 'error' && (
                      <p className="text-red-600 font-medium flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        Failed to save port.
                      </p>
                    )}
                    <div className="flex-1"></div>
                    <button
                      type="submit" disabled={isSubmitting}
                      className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Saving...' : editingId ? 'Update Port' : 'Register Port'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {!showPortForm && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {selectedItems.size > 0 && (
                  <div className="bg-blue-50 px-6 py-3 border-b border-blue-100 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <span className="text-sm font-medium text-blue-700">{selectedItems.size} items selected</span>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => { setSelectedItems(new Set()); setIsSelectionMode(false); }}
                        className="px-3 py-1 text-gray-600 hover:text-gray-800 text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ show: true, type: 'port', id: null, isBulk: true })}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition-colors flex items-center"
                      >
                        <TrashIcon className="w-3.5 h-3.5 mr-1" /> Delete Bulk
                      </button>
                    </div>
                  </div>
                )}
                {isLoading ? (
                  <div className="flex items-center justify-center p-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : ports.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr
                          className="bg-gray-50 border-b border-gray-100 select-none cursor-pointer"
                          onMouseDown={() => startLongPress(null)}
                          onMouseUp={endLongPress}
                          onMouseLeave={endLongPress}
                          onTouchStart={() => startLongPress(null)}
                          onTouchEnd={endLongPress}
                        >
                          {isSelectionMode && (
                            <th className="px-6 py-4 w-10">
                              <input
                                type="checkbox"
                                checked={selectedItems.size === ports.length}
                                onChange={() => toggleSelectAll(ports)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </th>
                          )}
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('port', 'name')}>
                            <div className="flex items-center">Port Name <SortIcon config={sortConfig.port} columnKey="name" /></div>
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('port', 'code')}>
                            <div className="flex items-center">Code <SortIcon config={sortConfig.port} columnKey="code" /></div>
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('port', 'location')}>
                            <div className="flex items-center">Location <SortIcon config={sortConfig.port} columnKey="location" /></div>
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('port', 'type')}>
                            <div className="flex items-center">Type <SortIcon config={sortConfig.port} columnKey="type" /></div>
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('port', 'status')}>
                            <div className="flex items-center">Status <SortIcon config={sortConfig.port} columnKey="status" /></div>
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sortData(ports, 'port').map((port) => (
                          <tr
                            key={port._id}
                            className={`${selectedItems.has(port._id) ? 'bg-blue-50/30' : 'hover:bg-gray-50'} transition-colors cursor-pointer select-none`}
                            onMouseDown={() => startLongPress(port._id)}
                            onMouseUp={endLongPress}
                            onMouseLeave={endLongPress}
                            onTouchStart={() => startLongPress(port._id)}
                            onTouchEnd={endLongPress}
                            onClick={() => {
                              if (isLongPressTriggered.current) {
                                isLongPressTriggered.current = false;
                                return;
                              }
                              if (isSelectionMode) toggleSelection(port._id);
                            }}
                          >
                            {isSelectionMode && (
                              <td className="px-6 py-4">
                                <input
                                  type="checkbox"
                                  checked={selectedItems.has(port._id)}
                                  onChange={(e) => { e.stopPropagation(); toggleSelection(port._id); }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                            )}
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{port.name}</td>
                            <td className="px-6 py-4 text-sm text-blue-600">{port.code}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{port.location}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{port.type}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${port.status === 'Active' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-gray-50 text-gray-700 border border-gray-100'}`}>
                                {port.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <button onClick={(e) => { e.stopPropagation(); handleEdit('port', port); }} className="text-gray-400 hover:text-blue-600 transition-colors">
                                  <EditIcon className="w-5 h-5" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete('port', port._id); }} className="text-gray-400 hover:text-red-600 transition-colors">
                                  <TrashIcon className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12">
                    <div className="p-4 bg-gray-50 rounded-full mb-4">
                      <AnchorIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium">No ports found</p>
                    <p className="text-sm text-gray-400 mt-1">Click "Add New" to register a new port</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      case 'stock-section':
        const { displayRecords, totalPackets, totalQuantity, totalInHousePkt, totalInHouseQty, totalShortage, unit } = stockData;

        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="w-1/4">
                <h2 className="text-2xl font-bold text-gray-800">Stock Management</h2>
              </div>

              {/* Center Aligned Search Bar */}
              <div className="flex-1 max-w-md mx-auto relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Search by LC, Port, Importer, Truck or Brand..."
                  value={stockSearchQuery}
                  onChange={(e) => setStockSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                />
              </div>

              <div className="w-1/4 flex justify-end items-center gap-2">
                <div className="relative">
                  <button
                    ref={stockFilterButtonRef}
                    onClick={() => setShowStockFilterPanel(!showStockFilterPanel)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${showStockFilterPanel || Object.values(stockFilters).some(v => v !== '')
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    <FunnelIcon className={`w-4 h-4 ${showStockFilterPanel || Object.values(stockFilters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                    <span className="text-sm font-medium">Filter</span>
                  </button>

                  {/* Floating Filter Panel */}
                  {showStockFilterPanel && (
                    <div ref={stockFilterRef} className="absolute right-0 mt-3 w-80 bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[60] p-5 animate-in fade-in zoom-in duration-200">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                        <h4 className="font-bold text-gray-900">Advanced Filters</h4>
                        <button
                          onClick={() => {
                            setStockFilters({ startDate: '', endDate: '', lcNo: '', port: '', brand: '', productName: '' });
                            setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: '', portSearch: '', brandSearch: '', productSearch: '' });
                            setShowStockFilterPanel(false);
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
                            value={stockFilters.startDate}
                            onChange={(e) => setStockFilters({ ...stockFilters, startDate: e.target.value })}
                            placeholder="Select start date"
                            name="startDate"
                            labelClassName="text-[11px] font-bold text-gray-400 uppercase tracking-wider"
                            compact={true}
                          />
                          <CustomDatePicker
                            label="TO DATE"
                            value={stockFilters.endDate}
                            onChange={(e) => setStockFilters({ ...stockFilters, endDate: e.target.value })}
                            placeholder="Select end date"
                            name="endDate"
                            labelClassName="text-[11px] font-bold text-gray-400 uppercase tracking-wider"
                            compact={true}
                            rightAlign={true}
                          />
                        </div>

                        {/* LC No Selection */}
                        <div className="space-y-1.5 relative" ref={stockLcNoFilterRef}>
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">LC No</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={filterSearchInputs.lcNoSearch}
                              onChange={(e) => {
                                setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: e.target.value });
                                setFilterDropdownOpen({ lcNo: true, port: false, brand: false });
                              }}
                              onFocus={() => setFilterDropdownOpen({ lcNo: true, port: false, brand: false })}
                              placeholder={stockFilters.lcNo || "Search LC No..."}
                              className="w-full px-3 py-2 pr-8 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300"
                            />
                            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            {stockFilters.lcNo && (
                              <button
                                onClick={() => {
                                  setStockFilters({ ...stockFilters, lcNo: '' });
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
                                      setStockFilters({ ...stockFilters, lcNo: lc });
                                      setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: '' });
                                      setFilterDropdownOpen({ lcNo: false, port: false, brand: false, product: false });
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
                        <div className="space-y-1.5 relative" ref={stockPortFilterRef}>
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Port</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={filterSearchInputs.portSearch}
                              onChange={(e) => {
                                setFilterSearchInputs({ ...filterSearchInputs, portSearch: e.target.value });
                                setFilterDropdownOpen({ lcNo: false, port: true, brand: false, product: false });
                              }}
                              onFocus={() => setFilterDropdownOpen({ lcNo: false, port: true, brand: false, product: false })}
                              placeholder={stockFilters.port || "Search Port..."}
                              className="w-full px-3 py-2 pr-8 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300"
                            />
                            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            {stockFilters.port && (
                              <button
                                onClick={() => {
                                  setStockFilters({ ...stockFilters, port: '' });
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
                              .map(item => (item.port || '').trim())
                              .filter(Boolean)
                            )].sort();
                            const filtered = portOptions.filter(p =>
                              p.toLowerCase().includes(filterSearchInputs.portSearch.toLowerCase())
                            );
                            return filtered.length > 0 ? (
                              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map(p => (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => {
                                      setStockFilters({ ...stockFilters, port: p });
                                      setFilterSearchInputs({ ...filterSearchInputs, portSearch: '' });
                                      setFilterDropdownOpen({ lcNo: false, port: false, brand: false, product: false });
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

                        {/* Product Name Selection */}
                        <div className="space-y-1.5 relative" ref={stockProductFilterRef}>
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Product Name</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={filterSearchInputs.productSearch}
                              onChange={(e) => {
                                setFilterSearchInputs({ ...filterSearchInputs, productSearch: e.target.value });
                                setFilterDropdownOpen({ lcNo: false, port: false, brand: false, product: true });
                              }}
                              onFocus={() => setFilterDropdownOpen({ lcNo: false, port: false, brand: false, product: true })}
                              placeholder={stockFilters.productName || "Search Product..."}
                              className="w-full px-3 py-2 pr-8 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300"
                            />
                            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            {stockFilters.productName && (
                              <button
                                onClick={() => {
                                  setStockFilters({ ...stockFilters, productName: '' });
                                  setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' });
                                }}
                                className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                <XIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {filterDropdownOpen.product && (() => {
                            const productOptions = [...new Set(stockRecords
                              .map(item => (item.productName || '').trim())
                              .filter(Boolean)
                            )].sort();
                            const filtered = productOptions.filter(p =>
                              p.toLowerCase().includes(filterSearchInputs.productSearch.toLowerCase())
                            );
                            return filtered.length > 0 ? (
                              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map(p => (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => {
                                      setStockFilters({ ...stockFilters, productName: p });
                                      setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' });
                                      setFilterDropdownOpen({ lcNo: false, port: false, brand: false, product: false });
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

                        {/* Brand Selection */}
                        <div className="space-y-1.5 relative" ref={stockBrandFilterRef}>
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Brand</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={filterSearchInputs.brandSearch}
                              onChange={(e) => {
                                setFilterSearchInputs({ ...filterSearchInputs, brandSearch: e.target.value });
                                setFilterDropdownOpen({ lcNo: false, port: false, brand: true });
                              }}
                              onFocus={() => setFilterDropdownOpen({ lcNo: false, port: false, brand: true })}
                              placeholder={stockFilters.brand || "Search Brand..."}
                              className="w-full px-3 py-2 pr-8 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300"
                            />
                            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            {stockFilters.brand && (
                              <button
                                onClick={() => {
                                  setStockFilters({ ...stockFilters, brand: '' });
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
                              .map(item => (item.brand || item.productName || '').trim())
                              .filter(Boolean)
                            )].sort();
                            const filtered = brandOptions.filter(b =>
                              b.toLowerCase().includes(filterSearchInputs.brandSearch.toLowerCase())
                            );
                            return filtered.length > 0 ? (
                              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map(b => (
                                  <button
                                    key={b}
                                    type="button"
                                    onClick={() => {
                                      setStockFilters({ ...stockFilters, brand: b });
                                      setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' });
                                      setFilterDropdownOpen({ lcNo: false, port: false, brand: false, product: false });
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                  >
                                    {b}
                                  </button>
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </div>

                        <button
                          onClick={() => setShowStockFilterPanel(false)}
                          className="w-full py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-all mt-2"
                        >
                          Apply Filters
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowStockReport(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95"
                >
                  <BarChartIcon className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium">Report</span>
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm transition-all hover:shadow-md">
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Packet</div>
                <div className="text-xl font-bold text-gray-900">{totalPackets}</div>
              </div>
              <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl shadow-sm transition-all hover:shadow-md">
                <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Total Quantity</div>
                <div className="text-xl font-bold text-emerald-700">{Math.round(totalQuantity)} {unit}</div>
              </div>
              <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-xl shadow-sm transition-all hover:shadow-md">
                <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-1">InHouse PKT</div>
                <div className="text-xl font-bold text-amber-700">{Math.round(totalInHousePkt)}</div>
              </div>
              <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl shadow-sm transition-all hover:shadow-md">
                <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">InHouse QTY</div>
                <div className="text-xl font-bold text-blue-700">{Math.round(totalInHouseQty)} {unit}</div>
              </div>
              <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-xl shadow-sm transition-all hover:shadow-md">
                <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-1">Shortage</div>
                <div className="text-xl font-bold text-rose-700">{Math.round(totalShortage)} {unit}</div>
              </div>
            </div>

            {showStockForm && (
              <div className="relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl p-8 transition-all duration-300">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex items-center justify-between mb-6 border-b border-gray-200/50 pb-4 relative z-10">
                  <h3 className="text-xl font-semibold text-gray-800">{editingId ? 'Edit Stock' : 'New Stock Entry'}</h3>
                  <button onClick={() => { setShowStockForm(false); resetStockForm(); }} className="text-gray-400 hover:text-red-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>

                <form onSubmit={handleStockSubmit} autoComplete="off" className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                  <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-6">
                    <CustomDatePicker
                      label="Date"
                      name="date"
                      value={stockFormData.date}
                      onChange={handleStockInputChange}
                      required
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
                          onChange={handleStockInputChange}
                          onFocus={() => setActiveDropdown('port')}
                          onKeyDown={(e) => handleDropdownKeyDown(e, 'port', handleStockDropdownSelect, 'port')}
                          required
                          placeholder="Select or type port name"
                          autoComplete="off"
                          className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setActiveDropdown(activeDropdown === 'port' ? null : 'port')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <ChevronDownIcon className={`w-4 h-4 transition-transform ${activeDropdown === 'port' ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      {activeDropdown === 'port' && (
                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto animate-in fade-in zoom-in duration-200">
                          {getFilteredOptions('port').map((port, index) => (
                            <button
                              key={port._id}
                              type="button"
                              onClick={() => handleStockDropdownSelect('port', port.name)}
                              onMouseEnter={() => setHighlightedIndex(index)}
                              className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${highlightedIndex === index ? 'bg-blue-50 text-blue-700' : 'hover:bg-blue-50'}`}
                            >
                              <span>{port.name}</span>
                              {stockFormData.port === port.name && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                            </button>
                          ))}
                          {getFilteredOptions('port').length === 0 && (
                            <div className="px-4 py-3 text-sm text-gray-500 italic">No ports found</div>
                          )}
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
                          onChange={handleStockInputChange}
                          onFocus={() => setActiveDropdown('importer')}
                          onKeyDown={(e) => handleDropdownKeyDown(e, 'importer', handleStockDropdownSelect, 'importer')}
                          required
                          placeholder="Select or type importer"
                          autoComplete="off"
                          className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setActiveDropdown(activeDropdown === 'importer' ? null : 'importer')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <ChevronDownIcon className={`w-4 h-4 transition-transform ${activeDropdown === 'importer' ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      {activeDropdown === 'importer' && (
                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto animate-in fade-in zoom-in duration-200">
                          {getFilteredOptions('importer').map((imp, index) => (
                            <button
                              key={imp._id}
                              type="button"
                              onClick={() => handleStockDropdownSelect('importer', imp.name)}
                              onMouseEnter={() => setHighlightedIndex(index)}
                              className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${highlightedIndex === index ? 'bg-blue-50 text-blue-700' : 'hover:bg-blue-50'}`}
                            >
                              <span>{imp.name}</span>
                              {stockFormData.importer === imp.name && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                            </button>
                          ))}
                          {getFilteredOptions('importer').length === 0 && (
                            <div className="px-4 py-3 text-sm text-gray-500 italic">No importers found</div>
                          )}
                        </div>
                      )}
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
                            {/* Product Info Row */}
                            {product.isMultiBrand ? (
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
                                  <input
                                    type="text" name="productName" value={product.productName} onChange={(e) => handleStockInputChange(e, pIndex)} required
                                    placeholder="Product Name" autoComplete="off" className="w-full h-[42px] px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                                  />
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
                            ) : (
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
                                  <input
                                    type="text" name="productName" value={product.productName} onChange={(e) => handleStockInputChange(e, pIndex)} required
                                    placeholder="Product Name" autoComplete="off" className="w-full h-[42px] px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-sm"
                                  />
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
                                              placeholder="Select Brand"
                                              onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'brand', e.target.value)}
                                              onFocus={() => {
                                                setActiveDropdown(`brand-${pIndex}-${bIndex}`);
                                                setHighlightedIndex(-1);
                                              }}
                                              onKeyDown={(e) => handleDropdownKeyDown(e, `brand-${pIndex}-${bIndex}`, (field, val) => handleBrandEntryChange(pIndex, bIndex, 'brand', val), 'brand')}
                                              className="w-full h-9 px-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            />
                                            {activeDropdown === `brand-${pIndex}-${bIndex}` && (
                                              <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                {getFilteredBrands(entry.brand, products.find(p => p.name === product.productName)?.brand).map((brand, idx) => (
                                                  <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                      handleBrandEntryChange(pIndex, bIndex, 'brand', brand);
                                                      setActiveDropdown(null);
                                                    }}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'hover:bg-blue-50'}`}
                                                  >
                                                    <span>{brand}</span>
                                                    {products.find(p => p.name === product.productName)?.brand === brand && (
                                                      <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">Product Brand</span>
                                                    )}
                                                  </button>
                                                ))}
                                                {getFilteredBrands(entry.brand, products.find(p => p.name === product.productName)?.brand).length === 0 && (
                                                  <div className="px-3 py-2 text-sm text-gray-500 italic">Type to add new brand</div>
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
                  <div className="col-span-1 md:col-span-2 pt-4 border-t border-gray-100">
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
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 pt-4 flex items-center justify-between">
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
                    <div className="flex-1"></div>
                    <button
                      type="submit" disabled={isSubmitting}
                      className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Saving...' : editingId ? 'Update Stock' : 'Add to Stock'}
                    </button>
                  </div>
                </form>
              </div>
            )
            }

            {
              !showStockForm && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {selectedItems.size > 0 && (
                    <div className="bg-blue-50 px-6 py-3 border-b border-blue-100 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                      <span className="text-sm font-medium text-blue-700">{displayRecords.filter(item => isStockGroupSelected(item.productName)).length} products selected</span>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => { setSelectedItems(new Set()); setIsSelectionMode(false); }}
                          className="px-3 py-1 text-gray-600 hover:text-gray-800 text-xs font-medium transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ show: true, type: 'stock', id: null, isBulk: true })}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition-colors flex items-center"
                        >
                          <TrashIcon className="w-3.5 h-3.5 mr-1" /> Delete Bulk
                        </button>
                      </div>
                    </div>
                  )}
                  {isLoading ? (
                    <div className="flex items-center justify-center p-20">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                  ) : stockRecords.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr
                            className="bg-gray-50 border-b border-gray-100 select-none cursor-pointer"
                            onMouseDown={() => startLongPress(null)}
                            onMouseUp={endLongPress}
                            onMouseLeave={endLongPress}
                            onTouchStart={() => startLongPress(null)}
                            onTouchEnd={endLongPress}
                          >
                            {isSelectionMode && (
                              <th className="px-6 py-4 w-10">
                                <input
                                  type="checkbox"
                                  checked={displayRecords.length > 0 && displayRecords.every(item => isStockGroupSelected(item.productName))}
                                  onChange={() => {
                                    if (displayRecords.every(item => isStockGroupSelected(item.productName))) {
                                      setSelectedItems(new Set());
                                      setIsSelectionMode(false);
                                    } else {
                                      const allIds = stockRecords.map(r => r._id);
                                      setSelectedItems(new Set(allIds));
                                      setIsSelectionMode(true);
                                    }
                                  }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </th>
                            )}
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Name</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Brand</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Inhouse Packet</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Inhouse Quantity</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sale Packet</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sale Quantity</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Status</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                          </tr>






                        </thead>

                        <tbody className="divide-y divide-gray-100">
                          {displayRecords.map((item) => (
                            <tr
                              key={item.originalId}
                              className={`${isStockGroupSelected(item.productName) ? 'bg-blue-50/30' : 'hover:bg-gray-50'} transition-colors cursor-pointer select-none`}
                              onMouseDown={() => {
                                isLongPressTriggered.current = false;
                                longPressTimer.current = setTimeout(() => {
                                  isLongPressTriggered.current = true;
                                  toggleStockGroupSelection(item.productName);
                                }, 700);
                              }}
                              onMouseUp={endLongPress}
                              onMouseLeave={endLongPress}
                              onTouchStart={() => {
                                isLongPressTriggered.current = false;
                                longPressTimer.current = setTimeout(() => {
                                  isLongPressTriggered.current = true;
                                  toggleStockGroupSelection(item.productName);
                                }, 700);
                              }}
                              onTouchEnd={endLongPress}
                              onClick={() => {
                                if (isLongPressTriggered.current) {
                                  isLongPressTriggered.current = false;
                                  return;
                                }
                                if (isSelectionMode) toggleStockGroupSelection(item.productName);
                              }}
                            >
                              {isSelectionMode && (
                                <td className="px-6 py-4">
                                  <input
                                    type="checkbox"
                                    checked={isStockGroupSelected(item.productName)}
                                    onChange={(e) => { e.stopPropagation(); toggleStockGroupSelection(item.productName); }}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                              )}
                              <td className="px-6 py-4 text-sm font-medium text-gray-900 align-top">{item.productName}</td>
                              <td className="px-6 py-4 text-sm text-gray-600 leading-relaxed align-top">
                                {item.entries.map((ent, i) => (
                                  <div key={i}>{ent.brand || '-'}</div>
                                ))}
                                {item.entries.length > 1 && (
                                  <div className="text-[11px] text-gray-500 mt-1 font-medium italic pt-1 border-t border-gray-100">Total Packet</div>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 leading-relaxed align-top">
                                {item.entries.map((ent, i) => {
                                  const pkt = parseFloat(ent.inHousePacket) || 0;
                                  const qty = parseFloat(ent.inHouseQuantity) || 0;
                                  const size = parseFloat(ent.packetSize) || 0;
                                  const whole = Math.floor(pkt);
                                  const rem = Math.round(qty - (whole * size));
                                  return (
                                    <div key={i}>
                                      {whole}{rem > 0 ? ` - ${rem} kg` : ''}
                                    </div>
                                  );
                                })}
                                {item.entries.length > 1 && (
                                  <div className="flex items-center justify-between gap-2 mt-1 pt-1 border-t border-gray-100">
                                    <div className="text-gray-900 font-bold">
                                      {(() => {
                                        const totalWhole = item.entries.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.inHousePacket) || 0), 0);
                                        const totalRem = Math.round(item.entries.reduce((sum, ent) => sum + (parseFloat(ent.inHouseQuantity) || 0) - (Math.floor(parseFloat(ent.inHousePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0));
                                        return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                                      })()}
                                    </div>
                                    <div className="text-[11px] text-gray-500 font-medium italic whitespace-nowrap">Total QTY</div>
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900 leading-relaxed align-top">
                                {item.entries.map((ent, i) => (
                                  <div key={i}>{Math.round(parseFloat(ent.inHouseQuantity) || 0) || '-'} {ent.unit}</div>
                                ))}
                                {item.entries.length > 1 && (
                                  <div className="text-gray-900 mt-1 font-bold pt-1 border-t border-gray-100">
                                    {Math.round(item.quantity)} {item.unit}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 leading-relaxed align-top">
                                {item.entries.map((ent, i) => {
                                  const pkt = parseFloat(ent.salePacket) || 0;
                                  const qty = parseFloat(ent.saleQuantity) || 0;
                                  const size = parseFloat(ent.packetSize) || 0;
                                  const whole = Math.floor(pkt);
                                  const rem = Math.round(qty - (whole * size));
                                  return (
                                    <div key={i}>
                                      {whole > 0 || rem > 0 ? `${whole}${rem > 0 ? ` - ${rem} kg` : ''}` : '-'}
                                    </div>
                                  );
                                })}
                                {item.entries.length > 1 && (
                                  <div className="flex items-center justify-between gap-2 mt-1 pt-1 border-t border-gray-100">
                                    <div className="text-gray-900 font-bold">
                                      {(() => {
                                        const totalWhole = item.entries.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.salePacket) || 0), 0);
                                        const totalRem = Math.round(item.entries.reduce((sum, ent) => sum + (parseFloat(ent.saleQuantity) || 0) - (Math.floor(parseFloat(ent.salePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0));
                                        return totalWhole > 0 || totalRem > 0 ? `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}` : '0';
                                      })()}
                                    </div>
                                    <div className="text-[11px] text-gray-500 font-medium italic whitespace-nowrap">Total QTY</div>
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900 leading-relaxed align-top">
                                {item.entries.map((ent, i) => (
                                  <div key={i}>{Math.round(parseFloat(ent.saleQuantity) || 0) || '-'} {ent.unit}</div>
                                ))}
                                {item.entries.length > 1 && (
                                  <div className="text-gray-900 mt-1 font-bold pt-1 border-t border-gray-100">
                                    {Math.round(item.saleQuantity)} {item.unit}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.quantity > 0 ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                  {item.quantity > 0 ? 'In Stock' : 'Out of Stock'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className="flex items-center justify-center space-x-3">
                                  <button onClick={(e) => { e.stopPropagation(); handleView('stock', item); }} className="text-gray-400 hover:text-indigo-600 transition-colors">
                                    <EyeIcon className="w-5 h-5" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleEdit('stock', item); }} className="text-gray-400 hover:text-blue-600 transition-colors">
                                    <EditIcon className="w-5 h-5" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDelete('stock', item._id); }} className="text-gray-400 hover:text-red-600 transition-colors">
                                    <TrashIcon className="w-5 h-5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>

                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12">
                      <div className="p-4 bg-gray-50 rounded-full mb-4">
                        <ShoppingCartIcon className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">No stock items found</p>
                    </div>
                  )}
                </div>
              )
            }
          </div >
        );
      case 'products-section':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Products Management</h2>
              <button
                onClick={() => setShowProductForm(!showProductForm)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Add New Product
              </button>
            </div>

            {showProductForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                  onClick={() => { setShowProductForm(false); setEditingId(null); }}
                />
                <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-6 w-full max-w-2xl transform transition-all relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-800">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
                    <button
                      onClick={() => { setShowProductForm(false); setEditingId(null); }}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <form onSubmit={handleProductSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">HS Code</label>
                      <input
                        type="text"
                        value={productFormData.hsCode}
                        onChange={(e) => setProductFormData(prev => ({ ...prev, hsCode: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        placeholder="Enter HS Code"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
                      <input
                        type="text"
                        value={productFormData.name}
                        onChange={(e) => setProductFormData(prev => ({ ...prev, name: e.target.value }))}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        placeholder="Enter product name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
                      <input
                        type="text"
                        value={productFormData.brand}
                        onChange={(e) => setProductFormData(prev => ({ ...prev, brand: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        placeholder="Enter brand"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Purchased Price</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={productFormData.purchasedPrice}
                        onChange={(e) => setProductFormData(prev => ({ ...prev, purchasedPrice: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">UOM (Unit)</label>
                      <select
                        value={productFormData.uom}
                        onChange={(e) => setProductFormData(prev => ({ ...prev, uom: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      >
                        <option value="kg">kg</option>
                        <option value="lbs">lbs</option>
                        <option value="pcs">pcs</option>
                        <option value="box">box</option>
                        <option value="set">set</option>
                        <option value="m">m</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Packet Size</label>
                      <input
                        type="text"
                        value={productFormData.packetSize}
                        onChange={(e) => setProductFormData(prev => ({ ...prev, packetSize: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        placeholder="Enter packet size"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <input
                        type="text"
                        value={productFormData.category}
                        onChange={(e) => setProductFormData(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        placeholder="Enter category"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                      <textarea
                        value={productFormData.description}
                        onChange={(e) => setProductFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                        placeholder="Enter product description"
                      />
                    </div>
                    <div className="md:col-span-2 flex justify-end space-x-3 pt-4 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => { setShowProductForm(false); setEditingId(null); }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center"
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                          </>
                        ) : (
                          editingId ? 'Update Product' : 'Add Product'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
              {products.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">HS Code</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Name</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Brand</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Packet Size</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">UOM</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {products.map((product) => (
                        <tr key={product._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-600 font-mono">{product.hsCode || '-'}</td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{product.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{product.brand || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{product.packetSize || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{product.uom || product.unit}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{product.purchasedPrice ? `TK ${product.purchasedPrice}` : '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{product.category || '-'}</td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center space-x-3">
                              <button onClick={() => handleProductEdit(product)} className="text-gray-400 hover:text-blue-600 transition-colors">
                                <EditIcon className="w-5 h-5" />
                              </button>
                              <button onClick={() => handleProductDelete(product._id)} className="text-gray-400 hover:text-red-600 transition-colors">
                                <TrashIcon className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12">
                  <div className="p-4 bg-gray-50 rounded-full mb-4">
                    <BoxIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">No products found</p>
                  <p className="text-sm text-gray-400 mt-1">Click "Add New Product" to create a product</p>
                </div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
      {/* Sidebar Backdrop for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-40 md:hidden animate-in fade-in duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white text-gray-900 border-r border-gray-200 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 flex flex-col`}>
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
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
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
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
                                setFilterDropdownOpen({ lcNo: true, port: false, brand: false });
                              }}
                              onFocus={() => setFilterDropdownOpen({ lcNo: true, port: false, brand: false })}
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
                                      setFilterDropdownOpen({ lcNo: false, port: false, brand: false });
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
                                setFilterDropdownOpen({ lcNo: false, port: true, brand: false });
                              }}
                              onFocus={() => setFilterDropdownOpen({ lcNo: false, port: true, brand: false })}
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
                                      setFilterDropdownOpen({ lcNo: false, port: false, brand: false });
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
                                setFilterDropdownOpen({ lcNo: false, port: false, brand: true });
                              }}
                              onFocus={() => setFilterDropdownOpen({ lcNo: false, port: false, brand: true })}
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
                                      setFilterDropdownOpen({ lcNo: false, port: false, brand: false });
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
                                {historyItem.truckNo || '-'}
                              </td>
                              <td className="px-3 py-3 text-[13px] text-gray-600 leading-relaxed">
                                {historyItem.entries.map((ent, i) => (
                                  <div key={i}>{ent.brand || '-'}</div>
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
                                  <div key={i}>{ent.packet || '-'}</div>
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
                                  <div key={i}>{ent.quantity} {ent.unit}</div>
                                ))}
                                {historyItem.isGrouped && (
                                  <div className="text-gray-900 mt-2 font-bold">
                                    {Math.round(historyItem.entries.reduce((sum, ent) => sum + (parseFloat(ent.quantity) || 0), 0))} {historyItem.unit}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3 text-[13px] text-gray-600 leading-relaxed">
                                {historyItem.entries.map((ent, i) => (
                                  <div key={i}>{ent.inHousePacket || '-'}</div>
                                ))}
                                {historyItem.isGrouped && (
                                  <div className="text-gray-900 mt-2 font-bold">
                                    {Math.round(historyItem.entries.reduce((sum, ent) => sum + (parseFloat(ent.inHousePacket) || 0), 0))}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3 text-[13px] text-gray-600 leading-relaxed font-bold">
                                {historyItem.entries.map((ent, i) => (
                                  <div key={i}>{ent.inHouseQuantity ? Math.round(parseFloat(ent.inHouseQuantity)) : '-'} {ent.unit}</div>
                                ))}
                                {historyItem.isGrouped && (
                                  <div className="text-gray-900 mt-2 font-bold">
                                    {Math.round(historyItem.entries.reduce((sum, ent) => sum + (parseFloat(ent.inHouseQuantity) || 0), 0))} {historyItem.unit}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3 text-[13px] text-red-600 leading-relaxed font-bold">
                                {historyItem.entries.map((ent, i) => (
                                  <div key={i}>{ent.sweepedQuantity ? `${ent.sweepedQuantity} ${ent.unit}` : '-'}</div>
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
      {showStockReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 print:p-0 print:bg-white print:backdrop-none">
          <div className="bg-white w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col print:max-h-none print:shadow-none print:rounded-none">
            {/* Modal Header/Toolbar (Hidden on Print) */}
            <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 print:hidden">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-xl">
                  <BarChartIcon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Stock Report</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button
                    ref={stockReportFilterButtonRef}
                    onClick={() => setShowStockReportFilterPanel(!showStockReportFilterPanel)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${showStockReportFilterPanel || Object.values(stockFilters).some(v => v !== '')
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    <FunnelIcon className={`w-4 h-4 ${showStockReportFilterPanel || Object.values(stockFilters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                    <span className="text-sm font-medium">Filter</span>
                  </button>

                  {/* Floating Filter Panel */}
                  {showStockReportFilterPanel && (
                    <div ref={stockReportFilterRef} className="absolute right-0 mt-3 w-80 bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[110] p-5 animate-in fade-in zoom-in duration-200">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                        <h4 className="font-bold text-gray-900">Advanced Filters</h4>
                        <button
                          onClick={() => {
                            setStockFilters({ startDate: '', endDate: '', lcNo: '', port: '', brand: '', productName: '' });
                            setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: '', portSearch: '', brandSearch: '', productSearch: '' });
                            setShowStockReportFilterPanel(false);
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
                            value={stockFilters.startDate}
                            onChange={(e) => setStockFilters({ ...stockFilters, startDate: e.target.value })}
                            placeholder="Select start date"
                            name="startDate"
                            labelClassName="text-[11px] font-bold text-gray-400 uppercase tracking-wider"
                            compact={true}
                          />
                          <CustomDatePicker
                            label="TO DATE"
                            value={stockFilters.endDate}
                            onChange={(e) => setStockFilters({ ...stockFilters, endDate: e.target.value })}
                            placeholder="Select end date"
                            name="endDate"
                            labelClassName="text-[11px] font-bold text-gray-400 uppercase tracking-wider"
                            compact={true}
                            rightAlign={true}
                          />
                        </div>

                        {/* LC No Selection */}
                        <div className="space-y-1.5 relative" ref={stockLcNoFilterRef}>
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">LC No</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={filterSearchInputs.lcNoSearch}
                              onChange={(e) => {
                                setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: e.target.value });
                                setFilterDropdownOpen({ lcNo: true, port: false, brand: false, product: false });
                              }}
                              onFocus={() => setFilterDropdownOpen({ lcNo: true, port: false, brand: false, product: false })}
                              placeholder={stockFilters.lcNo || "Search LC No..."}
                              className="w-full px-3 py-2 pr-8 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300"
                            />
                            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            {stockFilters.lcNo && (
                              <button
                                onClick={() => {
                                  setStockFilters({ ...stockFilters, lcNo: '' });
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
                              .map(item => (item.lcNo || '').trim())
                              .filter(Boolean)
                            )].sort();
                            const filtered = lcOptions.filter(lc =>
                              lc.toLowerCase().includes(filterSearchInputs.lcNoSearch.toLowerCase())
                            );
                            return filtered.length > 0 ? (
                              <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map(lc => (
                                  <button
                                    key={lc}
                                    type="button"
                                    onClick={() => {
                                      setStockFilters({ ...stockFilters, lcNo: lc });
                                      setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: '' });
                                      setFilterDropdownOpen({ lcNo: false, port: false, brand: false, product: false });
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
                        <div className="space-y-1.5 relative" ref={stockPortFilterRef}>
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Port</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={filterSearchInputs.portSearch}
                              onChange={(e) => {
                                setFilterSearchInputs({ ...filterSearchInputs, portSearch: e.target.value });
                                setFilterDropdownOpen({ lcNo: false, port: true, brand: false, product: false });
                              }}
                              onFocus={() => setFilterDropdownOpen({ lcNo: false, port: true, brand: false, product: false })}
                              placeholder={stockFilters.port || "Search Port..."}
                              className="w-full px-3 py-2 pr-8 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300"
                            />
                            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            {stockFilters.port && (
                              <button
                                onClick={() => {
                                  setStockFilters({ ...stockFilters, port: '' });
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
                              .map(item => (item.port || '').trim())
                              .filter(Boolean)
                            )].sort();
                            const filtered = portOptions.filter(p =>
                              p.toLowerCase().includes(filterSearchInputs.portSearch.toLowerCase())
                            );
                            return filtered.length > 0 ? (
                              <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map(p => (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => {
                                      setStockFilters({ ...stockFilters, port: p });
                                      setFilterSearchInputs({ ...filterSearchInputs, portSearch: '' });
                                      setFilterDropdownOpen({ lcNo: false, port: false, brand: false, product: false });
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

                        {/* Product Name Selection */}
                        <div className="space-y-1.5 relative" ref={stockProductFilterRef}>
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Product Name</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={filterSearchInputs.productSearch}
                              onChange={(e) => {
                                setFilterSearchInputs({ ...filterSearchInputs, productSearch: e.target.value });
                                setFilterDropdownOpen({ lcNo: false, port: false, brand: false, product: true });
                              }}
                              onFocus={() => setFilterDropdownOpen({ lcNo: false, port: false, brand: false, product: true })}
                              placeholder={stockFilters.productName || "Search Product..."}
                              className="w-full px-3 py-2 pr-8 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300"
                            />
                            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            {stockFilters.productName && (
                              <button
                                onClick={() => {
                                  setStockFilters({ ...stockFilters, productName: '' });
                                  setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' });
                                }}
                                className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                <XIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {filterDropdownOpen.product && (() => {
                            const productOptions = [...new Set(stockRecords
                              .map(item => (item.productName || '').trim())
                              .filter(Boolean)
                            )].sort();
                            const filtered = productOptions.filter(p =>
                              p.toLowerCase().includes(filterSearchInputs.productSearch.toLowerCase())
                            );
                            return filtered.length > 0 ? (
                              <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map(p => (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => {
                                      setStockFilters({ ...stockFilters, productName: p });
                                      setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' });
                                      setFilterDropdownOpen({ lcNo: false, port: false, brand: false, product: false });
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

                        {/* Brand Selection */}
                        <div className="space-y-1.5 relative" ref={stockBrandFilterRef}>
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Brand</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={filterSearchInputs.brandSearch}
                              onChange={(e) => {
                                setFilterSearchInputs({ ...filterSearchInputs, brandSearch: e.target.value });
                                setFilterDropdownOpen({ lcNo: false, port: false, brand: true, product: false });
                              }}
                              onFocus={() => setFilterDropdownOpen({ lcNo: false, port: false, brand: true, product: false })}
                              placeholder={stockFilters.brand || "Search Brand..."}
                              className="w-full px-3 py-2 pr-8 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-300"
                            />
                            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            {stockFilters.brand && (
                              <button
                                onClick={() => {
                                  setStockFilters({ ...stockFilters, brand: '' });
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
                              .map(item => (item.brand || item.productName || '').trim())
                              .filter(Boolean)
                            )].sort();
                            const filtered = brandOptions.filter(b =>
                              b.toLowerCase().includes(filterSearchInputs.brandSearch.toLowerCase())
                            );
                            return filtered.length > 0 ? (
                              <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map(b => (
                                  <button
                                    key={b}
                                    type="button"
                                    onClick={() => {
                                      setStockFilters({ ...stockFilters, brand: b });
                                      setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' });
                                      setFilterDropdownOpen({ lcNo: false, port: false, brand: false, product: false });
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                  >
                                    {b}
                                  </button>
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </div>

                        <button
                          onClick={() => setShowStockReportFilterPanel(false)}
                          className="w-full py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-all mt-2"
                        >
                          Apply Filters
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2"
                >
                  <BarChartIcon className="w-4 h-4" />
                  Print Report
                </button>
                <button
                  onClick={() => setShowStockReport(false)}
                  className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors"
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
                    <h2 className="text-xl font-bold text-gray-900 tracking-wide uppercase">Stock Report</h2>
                  </div>
                </div>

                {/* Date/Info Row */}
                <div className="flex justify-between items-end text-sm text-gray-600 pt-4 px-2">
                  <div className="flex flex-col gap-1">
                    <div>
                      <span className="font-semibold">Date Range:</span> {stockFilters.startDate || 'Start'} to {stockFilters.endDate || 'Present'}
                    </div>
                    {stockFilters.productName && (
                      <div>
                        <span className="font-semibold">Product:</span> {stockFilters.productName}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="font-semibold">Printed on:</span> {new Date().toLocaleDateString()}
                  </div>
                </div>

                {/* Report Table */}
                <div className="overflow-x-auto border border-gray-900">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-900">
                        <th className="border-r border-gray-900 px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider w-12 text-center">SL</th>
                        <th className="border-r border-gray-900 px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">Product Name</th>
                        <th className="border-r border-gray-900 px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">Brand</th>
                        <th className="border-r border-gray-900 px-4 py-3 text-right text-xs font-bold text-gray-900 uppercase tracking-wider">InHouse PKT</th>
                        <th className="border-r border-gray-900 px-4 py-3 text-right text-xs font-bold text-gray-900 uppercase tracking-wider">InHouse QTY</th>
                        <th className="border-r border-gray-900 px-4 py-3 text-right text-xs font-bold text-gray-900 uppercase tracking-wider">Sale PKT</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-900 uppercase tracking-wider">Sale QTY</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-900">
                      {stockData.displayRecords.length > 0 ? (
                        stockData.displayRecords.map((item, index) => (
                          <tr key={index} className="border-b border-gray-900 last:border-0">
                            <td className="border-r border-gray-900 px-4 py-3 text-sm text-gray-900 text-center align-top">{index + 1}</td>
                            <td className="border-r border-gray-900 px-4 py-3 text-sm font-semibold text-gray-900 align-top">{item.productName}</td>
                            <td className="border-r border-gray-900 px-4 py-3 text-sm text-gray-600 align-top">
                              {item.entries.map((ent, i) => (
                                <div key={i} className="leading-tight mb-0.5 last:mb-0">{ent.brand}</div>
                              ))}
                            </td>
                            <td className="border-r border-gray-900 px-4 py-3 text-sm text-right text-gray-900 font-medium whitespace-pre-line align-top">
                              {item.entries.map((ent, i) => {
                                const pkt = parseFloat(ent.inHousePacket) || 0;
                                const qty = parseFloat(ent.inHouseQuantity) || 0;
                                const size = parseFloat(ent.packetSize) || 0;
                                const whole = Math.floor(pkt);
                                const rem = Math.round(qty - (whole * size));
                                return (
                                  <div key={i} className="leading-tight mb-0.5 last:mb-0">
                                    {whole}{rem > 0 ? ` - ${rem} kg` : ''}
                                  </div>
                                );
                              })}
                              {item.entries.length > 1 && (
                                <div className="border-t border-gray-300 mt-1 pt-1 font-bold">
                                  {(() => {
                                    const totalWhole = item.entries.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.inHousePacket) || 0), 0);
                                    const totalRem = Math.round(item.entries.reduce((sum, ent) => sum + (parseFloat(ent.inHouseQuantity) || 0) - (Math.floor(parseFloat(ent.inHousePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0));
                                    return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                                  })()}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900 font-bold whitespace-pre-line border-r border-gray-900 align-top">
                              {item.entries.map((ent, i) => (
                                <div key={i} className="leading-tight mb-0.5 last:mb-0">{Math.round(ent.inHouseQuantity)} {ent.unit}</div>
                              ))}
                              {item.entries.length > 1 && (
                                <div className="border-t border-gray-300 mt-1 pt-1">
                                  {Math.round(item.quantity)} {item.unit}
                                </div>
                              )}
                            </td>
                            <td className="border-r border-gray-900 px-4 py-3 text-sm text-right text-gray-900 font-medium whitespace-pre-line align-top">
                              {item.entries.map((ent, i) => {
                                const pkt = parseFloat(ent.salePacket) || 0;
                                const qty = parseFloat(ent.saleQuantity) || 0;
                                const size = parseFloat(ent.packetSize) || 0;
                                const whole = Math.floor(pkt);
                                const rem = Math.round(qty - (whole * size));
                                return (
                                  <div key={i} className="leading-tight mb-0.5 last:mb-0">
                                    {whole > 0 || rem > 0 ? `${whole}${rem > 0 ? ` - ${rem} kg` : ''}` : '-'}
                                  </div>
                                );
                              })}
                              {item.entries.length > 1 && (
                                <div className="border-t border-gray-300 mt-1 pt-1 font-bold">
                                  {(() => {
                                    const totalWhole = item.entries.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.salePacket) || 0), 0);
                                    const totalRem = Math.round(item.entries.reduce((sum, ent) => sum + (parseFloat(ent.saleQuantity) || 0) - (Math.floor(parseFloat(ent.salePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0));
                                    return totalWhole > 0 || totalRem > 0 ? `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}` : '0';
                                  })()}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900 font-bold whitespace-pre-line align-top">
                              {item.entries.map((ent, i) => (
                                <div key={i} className="leading-tight mb-0.5 last:mb-0">{Math.round(ent.saleQuantity)} {ent.unit}</div>
                              ))}
                              {item.entries.length > 1 && (
                                <div className="border-t border-gray-300 mt-1 pt-1">
                                  {Math.round(item.saleQuantity)} {item.unit}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="px-4 py-8 text-center text-gray-500 italic">No records found for the selected criteria.</td>
                        </tr>
                      )}
                    </tbody>
                    {stockData.displayRecords.length > 0 && (
                      <tfoot>
                        <tr className="bg-gray-100 border-t-2 border-gray-900">
                          <td colSpan="3" className="px-4 py-3 text-sm font-black text-gray-900 text-right uppercase tracking-wider border-r border-gray-900">Grand Total</td>
                          <td className="px-4 py-3 text-sm text-right font-black text-gray-900 border-r border-gray-900">
                            {(() => {
                              const totalWhole = stockData.displayRecords.reduce((accWhole, item) =>
                                accWhole + item.entries.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.inHousePacket) || 0), 0), 0);
                              const totalRem = Math.round(stockData.displayRecords.reduce((accRem, item) =>
                                accRem + item.entries.reduce((sum, ent) => sum + (parseFloat(ent.inHouseQuantity) || 0) - (Math.floor(parseFloat(ent.inHousePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0), 0));
                              return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                            })()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-black text-gray-900 border-r border-gray-900">
                            {Math.round(stockData.totalInHouseQty)} {stockData.unit}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-black text-gray-900 border-r border-gray-900">
                            {(() => {
                              const totalWhole = stockData.displayRecords.reduce((accWhole, item) =>
                                accWhole + item.entries.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.salePacket) || 0), 0), 0);
                              const totalRem = Math.round(stockData.displayRecords.reduce((accRem, item) =>
                                accRem + item.entries.reduce((sum, ent) => sum + (parseFloat(ent.saleQuantity) || 0) - (Math.floor(parseFloat(ent.salePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0), 0));
                              return totalWhole > 0 || totalRem > 0 ? `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}` : '0';
                            })()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-black text-gray-900">
                            {Math.round(stockData.totalSaleQty)} {stockData.unit}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Footer Signatures */}
                <div className="grid grid-cols-3 gap-8 pt-24 px-4 pb-12">
                  <div className="text-center">
                    <div className="border-t border-dotted border-gray-900 pt-2 text-xs font-bold text-gray-900 uppercase">Prepared By</div>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-dotted border-gray-900 pt-2 text-xs font-bold text-gray-900 uppercase">Verified By</div>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-dotted border-gray-900 pt-2 text-xs font-bold text-gray-900 uppercase">Authorized Signature</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div >
  );
}

export default App;
