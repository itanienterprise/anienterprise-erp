import React, { useState, useEffect, useRef } from 'react';
import {
  MenuIcon, SearchIcon, BellIcon, HomeIcon, BoxIcon, UsersIcon, AnchorIcon,
  BarChartIcon, SettingsIcon, TrendingUpIcon, DollarSignIcon,
  ShoppingCartIcon, EditIcon, TrashIcon, FunnelIcon, XIcon,
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
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const CustomDatePicker = ({ value, onChange, placeholder, label, required = false, name }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
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

  const years = [];
  const currentYear = new Date().getFullYear();
  for (let i = currentYear - 10; i <= currentYear + 10; i++) {
    years.push(i);
  }

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
    const selectedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    // Format as YYYY-MM-DD for consistency with existing state
    const formatted = selectedDate.toISOString().split('T')[0];
    onChange({ target: { name, value: formatted } });
    setIsOpen(false);
  };

  const daysInMonth = getDaysInMonth(viewDate.getMonth(), viewDate.getFullYear());
  const firstDay = getFirstDayOfMonth(viewDate.getMonth(), viewDate.getFullYear());
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <div className="relative">
        <input
          type="text"
          readOnly
          value={value ? formatDate(value) : ''}
          onClick={() => setIsOpen(!isOpen)}
          placeholder={placeholder || 'Select Date'}
          required={required}
          className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm cursor-pointer pr-10"
        />
        <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {isOpen && (
        <div className="absolute z-[100] mt-2 p-4 bg-white/95 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200 w-[280px]">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <div className="text-sm font-bold text-gray-800">
              {months[viewDate.getMonth()]} {viewDate.getFullYear()}
            </div>
            <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="text-[10px] font-bold text-gray-400 text-center uppercase py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {blanks.map(b => <div key={`b-${b}`} className="h-8"></div>)}
            {days.map(d => {
              const isToday = new Date().toDateString() === new Date(viewDate.getFullYear(), viewDate.getMonth(), d).toDateString();
              const isSelected = value && new Date(value).toDateString() === new Date(viewDate.getFullYear(), viewDate.getMonth(), d).toDateString();
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDateSelect(d)}
                  className={`h-8 w-8 rounded-lg text-xs font-medium flex items-center justify-center transition-all
                    ${isSelected ? 'bg-blue-600 text-white shadow-md' :
                      isToday ? 'bg-blue-50 text-blue-600 border border-blue-100' :
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
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [inventoryRecords, setInventoryRecords] = useState([]);

  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const longPressTimer = useRef(null);
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
  const portRef = useRef(null);
  const importerRef = useRef(null);
  const ipPortRef = useRef(null);
  const ipImporterRef = useRef(null);
  const filterPortRef = useRef(null);
  const filterImporterRef = useRef(null);


  const [sortConfig, setSortConfig] = useState({
    ip: { key: null, direction: 'asc' },
    importer: { key: null, direction: 'asc' },
    port: { key: null, direction: 'asc' }
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

  const [inventoryFormData, setInventoryFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    lcNo: '',
    indianCnF: '',
    indCnFCost: '',
    bdCnF: '',
    bdCnFCost: '',
    productName: '',
    trackNo: '',
    packet: '',
    packetSize: '',
    quantity: '',
    unit: 'kg',
    port: '',
    importer: '',
    status: 'In Stock'
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

      if (name === 'openingDate' && value) {
        const openingDate = new Date(value);
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

  const resetInventoryForm = () => {
    setInventoryFormData({
      date: new Date().toISOString().split('T')[0],
      lcNo: '',
      indianCnF: '',
      indCnFCost: '',
      bdCnF: '',
      bdCnFCost: '',
      productName: '',
      trackNo: '',
      packet: '',
      packetSize: '',
      quantity: '',
      unit: 'kg',
      port: '',
      importer: '',
      status: 'In Stock'
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
    const recordDate = new Date(record.openingDate);
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
    if (filters.startDate && new Date(record.openingDate) < new Date(filters.startDate)) return false;
    if (filters.endDate && new Date(record.openingDate) > new Date(filters.endDate)) return false;

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
    setShowInventoryForm(false);
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
    } else if (currentView === 'inventory-section') {
      fetchInventoryRecords();
      fetchPorts(); // Fetch ports to populate the dropdown
      fetchImporters(); // Fetch importers to populate the dropdown
    }



  }, [currentView]);

  useEffect(() => {
    const handleClickOutside = (event) => {
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
  }, []);

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
    longPressTimer.current = setTimeout(() => {
      if (id) {
        toggleSelection(id);
      } else {
        setIsSelectionMode(true);
      }
    }, 700); // 700ms for long press
  };
  const toggleInventoryGroupSelection = (productName) => {
    const records = inventoryRecords.filter(item =>
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

  const isInventoryGroupSelected = (productName) => {
    const records = inventoryRecords.filter(item =>
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
    const endpoint = type === 'ip' ? 'ip-records' : type === 'importer' ? 'importers' : type === 'port' ? 'ports' : 'inventory';


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
      else if (type === 'inventory') fetchInventoryRecords();

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
    } else if (type === 'inventory') {
      setInventoryFormData(item);
      setShowInventoryForm(true);
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

  const fetchInventoryRecords = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/inventory`);
      if (response.ok) {
        const rawData = await response.json();
        const decryptedRecords = rawData.map(record => {
          const decrypted = decryptData(record.data);
          return { ...decrypted, _id: record._id, createdAt: record.createdAt };
        });
        setInventoryRecords(decryptedRecords);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInventoryInputChange = (e) => {
    const { name, value } = e.target;
    setInventoryFormData(prev => {
      const updated = {
        ...prev,
        [name]: value
      };

      // Auto-calculate quantity when packet or packetSize changes
      if (name === 'packet' || name === 'packetSize') {
        const packet = name === 'packet' ? parseFloat(value) || 0 : parseFloat(prev.packet) || 0;
        const packetSize = name === 'packetSize' ? parseFloat(value) || 0 : parseFloat(prev.packetSize) || 0;
        updated.quantity = packet && packetSize ? (packet * packetSize).toString() : '';
      }

      return updated;
    });
    if (name === 'port' || name === 'importer') {
      setActiveDropdown(name);
    }
  };

  const handleInventoryDropdownSelect = (name, value) => {
    setInventoryFormData(prev => ({
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

  const handleInventorySubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const url = editingId
        ? `${API_BASE_URL}/api/inventory/${editingId}`
        : `${API_BASE_URL}/api/inventory`;
      const encryptedPayload = { data: encryptData(inventoryFormData) };
      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(encryptedPayload),
      });

      if (response.ok) {
        setSubmitStatus('success');
        fetchInventoryRecords();
        setTimeout(() => {
          setShowInventoryForm(false);
          setEditingId(null);
          setInventoryFormData({
            port: '',
            importer: '',
            status: 'In Stock'
          });





          setSubmitStatus(null);
        }, 2000);
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Error saving inventory:', error);
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
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 text-[10px] transition-colors flex items-center justify-between"
                        >
                          <span className="italic text-gray-400">All Ports</span>
                          {filters.port === '' && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>}
                        </button>
                        {ports
                          .filter(p => !filters.port || ports.some(x => x.name === filters.port) || p.name.toLowerCase().includes(filters.port.toLowerCase()))
                          .map((port) => (
                            <button
                              key={port._id}
                              type="button"
                              onClick={() => handleFilterDropdownSelect('port', port.name)}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-[10px] transition-colors flex items-center justify-between"
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
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 text-[10px] transition-colors flex items-center justify-between"
                        >
                          <span className="italic text-gray-400">All Importers</span>
                          {filters.importer === '' && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>}
                        </button>
                        {importers
                          .filter(imp => !filters.importer || importers.some(x => x.name === filters.importer) || imp.name.toLowerCase().includes(filters.importer.toLowerCase()))
                          .map((imp) => (
                            <button
                              key={imp._id}
                              type="button"
                              onClick={() => handleFilterDropdownSelect('importer', imp.name)}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-[10px] transition-colors flex items-center justify-between"
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
                        {importers
                          .filter(imp => imp.status === 'Active' && (!formData.ipParty || importers.some(x => x.name === formData.ipParty) || imp.name.toLowerCase().includes(formData.ipParty.toLowerCase())))
                          .map((importer) => (
                            <button
                              key={importer._id}
                              type="button"
                              onClick={() => handleIpDropdownSelect('ipParty', importer.name)}
                              className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm transition-colors flex items-center justify-between"
                            >
                              <span>{importer.name}</span>
                              {formData.ipParty === importer.name && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                            </button>
                          ))}
                        {importers.filter(imp => imp.status === 'Active' && imp.name.toLowerCase().includes(formData.ipParty.toLowerCase())).length === 0 && (
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
                        {ports
                          .filter(p => p.status === 'Active' && (!formData.port || ports.some(x => x.name === formData.port) || p.name.toLowerCase().includes(formData.port.toLowerCase())))
                          .map((port) => (
                            <button
                              key={port._id}
                              type="button"
                              onClick={() => handleIpDropdownSelect('port', port.name)}
                              className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm transition-colors flex items-center justify-between"
                            >
                              <span>{port.name}</span>
                              {formData.port === port.name && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                            </button>
                          ))}
                        {ports.filter(p => p.status === 'Active' && p.name.toLowerCase().includes(formData.port.toLowerCase())).length === 0 && (
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
                            onClick={() => isSelectionMode && toggleSelection(record._id)}
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
                            onClick={() => isSelectionMode && toggleSelection(importer._id)}
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
                            onClick={() => isSelectionMode && toggleSelection(port._id)}
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
      case 'inventory-section':
        const groupedInventory = inventoryRecords.reduce((acc, item) => {
          const name = (item.productName || '').trim().toLowerCase();
          if (!acc[name]) {
            acc[name] = {
              ...item,
              productName: item.productName.trim(),
              quantity: parseFloat(item.quantity) || 0,
              originalId: item._id
            };
          } else {
            acc[name].quantity += parseFloat(item.quantity) || 0;
          }
          return acc;
        }, {});
        const displayRecords = Object.values(groupedInventory);

        return (

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Inventory Management</h2>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowInventoryForm(!showInventoryForm)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center"
                >
                  <span className="mr-2 text-xl">+</span> Add New
                </button>
              </div>
            </div>

            {showInventoryForm && (
              <div className="relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl p-8 transition-all duration-300">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex items-center justify-between mb-6 border-b border-gray-200/50 pb-4 relative z-10">
                  <h3 className="text-xl font-semibold text-gray-800">{editingId ? 'Edit Inventory' : 'New Inventory Entry'}</h3>
                  <button onClick={() => { setShowInventoryForm(false); resetInventoryForm(); }} className="text-gray-400 hover:text-red-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>

                <form onSubmit={handleInventorySubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                  <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-6">
                    <CustomDatePicker
                      label="Date"
                      name="date"
                      value={inventoryFormData.date}
                      onChange={handleInventoryInputChange}
                      required
                    />
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">LC No</label>
                      <input
                        type="text" name="lcNo" value={inventoryFormData.lcNo} onChange={handleInventoryInputChange} required
                        placeholder="LC Number" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                      />
                    </div>
                    <div className="space-y-2 relative" ref={portRef}>
                      <label className="text-sm font-medium text-gray-700">Port</label>
                      <div className="relative">
                        <input
                          type="text"
                          name="port"
                          value={inventoryFormData.port}
                          onChange={handleInventoryInputChange}
                          onFocus={() => setActiveDropdown('port')}
                          required
                          placeholder="Select or type port name"
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
                          {ports
                            .filter(p => p.status === 'Active' && (!inventoryFormData.port || ports.some(x => x.name === inventoryFormData.port) || p.name.toLowerCase().includes(inventoryFormData.port.toLowerCase())))
                            .map((port) => (
                              <button
                                key={port._id}
                                type="button"
                                onClick={() => handleInventoryDropdownSelect('port', port.name)}
                                className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm transition-colors flex items-center justify-between"
                              >
                                <span>{port.name}</span>
                                {inventoryFormData.port === port.name && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                              </button>
                            ))}
                          {ports.filter(p => p.status === 'Active' && p.name.toLowerCase().includes(inventoryFormData.port.toLowerCase())).length === 0 && (
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
                          value={inventoryFormData.importer}
                          onChange={handleInventoryInputChange}
                          onFocus={() => setActiveDropdown('importer')}
                          required
                          placeholder="Select or type importer"
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
                          {importers
                            .filter(imp => imp.status === 'Active' && (!inventoryFormData.importer || importers.some(x => x.name === inventoryFormData.importer) || imp.name.toLowerCase().includes(inventoryFormData.importer.toLowerCase())))
                            .map((imp) => (
                              <button
                                key={imp._id}
                                type="button"
                                onClick={() => handleInventoryDropdownSelect('importer', imp.name)}
                                className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm transition-colors flex items-center justify-between"
                              >
                                <span>{imp.name}</span>
                                {inventoryFormData.importer === imp.name && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                              </button>
                            ))}
                          {importers.filter(imp => imp.status === 'Active' && imp.name.toLowerCase().includes(inventoryFormData.importer.toLowerCase())).length === 0 && (
                            <div className="px-4 py-3 text-sm text-gray-500 italic">No importers found</div>
                          )}
                        </div>
                      )}
                    </div>

                  </div>


                  <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">IND C&F</label>
                      <input
                        type="text" name="indianCnF" value={inventoryFormData.indianCnF} onChange={handleInventoryInputChange}
                        placeholder="IND C&F" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">IN C&F comm</label>
                      <input
                        type="number" name="indCnFCost" value={inventoryFormData.indCnFCost} onChange={handleInventoryInputChange}
                        placeholder="0.00" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">BD C&F</label>
                      <input
                        type="text" name="bdCnF" value={inventoryFormData.bdCnF} onChange={handleInventoryInputChange}
                        placeholder="BD C&F" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">BD C&F Cost</label>
                      <input
                        type="number" name="bdCnFCost" value={inventoryFormData.bdCnFCost} onChange={handleInventoryInputChange}
                        placeholder="0.00" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Product Name</label>
                    <input
                      type="text" name="productName" value={inventoryFormData.productName} onChange={handleInventoryInputChange} required
                      placeholder="Product Name" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Track No.</label>
                    <input
                      type="text" name="trackNo" value={inventoryFormData.trackNo} onChange={handleInventoryInputChange}
                      placeholder="Track No." className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Packet</label>
                    <input
                      type="text" name="packet" value={inventoryFormData.packet} onChange={handleInventoryInputChange}
                      placeholder="Packet" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Packet Size</label>
                    <input
                      type="text" name="packetSize" value={inventoryFormData.packetSize} onChange={handleInventoryInputChange}
                      placeholder="Packet Size" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                  </div>


                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Quantity</label>
                    <input
                      type="number" name="quantity" value={inventoryFormData.quantity} onChange={handleInventoryInputChange} required
                      placeholder="0.00" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Unit</label>
                    <select
                      name="unit" value={inventoryFormData.unit} onChange={handleInventoryInputChange}
                      className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    >
                      <option>kg</option>
                      <option>pcs</option>
                      <option>boxes</option>
                      <option>liters</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <select
                      name="status" value={inventoryFormData.status} onChange={handleInventoryInputChange}
                      className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    >
                      <option>In Stock</option>
                      <option>Out of Stock</option>
                      <option>Reserved</option>
                    </select>
                  </div>

                  <div className="col-span-1 md:col-span-2 pt-4 flex items-center justify-between">
                    {submitStatus === 'success' && (
                      <p className="text-green-600 font-medium flex items-center animate-bounce">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        Inventory saved successfully!
                      </p>
                    )}
                    {submitStatus === 'error' && (
                      <p className="text-red-600 font-medium flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        Failed to save inventory.
                      </p>
                    )}
                    <div className="flex-1"></div>
                    <button
                      type="submit" disabled={isSubmitting}
                      className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Saving...' : editingId ? 'Update Inventory' : 'Add to Inventory'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {!showInventoryForm && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {selectedItems.size > 0 && (
                  <div className="bg-blue-50 px-6 py-3 border-b border-blue-100 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <span className="text-sm font-medium text-blue-700">{displayRecords.filter(item => isInventoryGroupSelected(item.productName)).length} products selected</span>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => { setSelectedItems(new Set()); setIsSelectionMode(false); }}
                        className="px-3 py-1 text-gray-600 hover:text-gray-800 text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ show: true, type: 'inventory', id: null, isBulk: true })}
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
                ) : inventoryRecords.length > 0 ? (
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
                                checked={displayRecords.length > 0 && displayRecords.every(item => isInventoryGroupSelected(item.productName))}
                                onChange={() => {
                                  if (displayRecords.every(item => isInventoryGroupSelected(item.productName))) {
                                    setSelectedItems(new Set());
                                    setIsSelectionMode(false);
                                  } else {
                                    const allIds = inventoryRecords.map(r => r._id);
                                    setSelectedItems(new Set(allIds));
                                    setIsSelectionMode(true);
                                  }
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </th>
                          )}
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Name</th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Status</th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                        </tr>






                      </thead>

                      <tbody className="divide-y divide-gray-100">
                        {displayRecords.map((item) => (
                          <tr
                            key={item.originalId}
                            className={`${isInventoryGroupSelected(item.productName) ? 'bg-blue-50/30' : 'hover:bg-gray-50'} transition-colors cursor-pointer select-none`}
                            onMouseDown={() => {
                              longPressTimer.current = setTimeout(() => {
                                toggleInventoryGroupSelection(item.productName);
                              }, 700);
                            }}
                            onMouseUp={endLongPress}
                            onMouseLeave={endLongPress}
                            onTouchStart={() => {
                              longPressTimer.current = setTimeout(() => {
                                toggleInventoryGroupSelection(item.productName);
                              }, 700);
                            }}
                            onTouchEnd={endLongPress}
                            onClick={() => isSelectionMode && toggleInventoryGroupSelection(item.productName)}
                          >
                            {isSelectionMode && (
                              <td className="px-6 py-4">
                                <input
                                  type="checkbox"
                                  checked={isInventoryGroupSelected(item.productName)}
                                  onChange={(e) => { e.stopPropagation(); toggleInventoryGroupSelection(item.productName); }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                            )}
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.productName}</td>
                            <td className="px-6 py-4 text-sm text-gray-900 font-medium">{item.quantity} {item.unit}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.quantity > 0 ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                {item.quantity > 0 ? 'In Stock' : 'Out of Stock'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center space-x-3">
                                <button onClick={(e) => { e.stopPropagation(); handleView('inventory', item); }} className="text-gray-400 hover:text-indigo-600 transition-colors">
                                  <EyeIcon className="w-5 h-5" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleEdit('inventory', item); }} className="text-gray-400 hover:text-blue-600 transition-colors">
                                  <EditIcon className="w-5 h-5" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete('inventory', item._id); }} className="text-gray-400 hover:text-red-600 transition-colors">
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
                    <p className="text-gray-500 font-medium">No inventory items found</p>
                  </div>
                )}
              </div>
            )}
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
        <div className="flex items-center justify-center h-16 border-b border-gray-200">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">ANI Enterprise ERP</h1>
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
          <button onClick={() => { setCurrentView('inventory-section'); setSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-lg transition-all ${currentView === 'inventory-section' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
            <ShoppingCartIcon className="w-5 h-5 mr-3" />
            <span className="font-medium">Inventory</span>
          </button>
        </nav>
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center">
            <img src="https://ui-avatars.com/api/?name=Admin+User&background=3b82f6&color=fff" alt="Admin" className="w-10 h-10 rounded-full border-2 border-gray-200" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">Admin User</p>
              <p className="text-xs text-gray-500">View Profile</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100">
              <MenuIcon className="w-6 h-6" />
            </button>
            <div className="relative ml-4 md:ml-0 w-64 md:w-96">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <SearchIcon className="w-5 h-5 text-gray-400" />
              </span>
              <input type="text" placeholder="Search..." className="w-full py-2 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
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
          <div className="relative bg-white/95 backdrop-blur-2xl border border-white/50 rounded-3xl shadow-2xl overflow-hidden max-w-[95vw] w-full animate-in zoom-in duration-300">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Stock History - {viewRecord.data.productName}</h3>
              </div>
              <button onClick={() => setViewRecord(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <XIcon className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8">
              {(() => {
                const history = inventoryRecords.filter(item =>
                  (item.productName || '').trim().toLowerCase() === (viewRecord.data.productName || '').trim().toLowerCase()
                );
                const total = history.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
                const unit = history[0]?.unit || '';

                return (
                  <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-x-auto">
                    <table className="w-full text-left min-w-[600px]">
                      <thead>
                        <tr className="bg-white border-b border-gray-100">
                          <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">LC No</th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Port</th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Importer</th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">IND C&F</th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">IN C&F comm</th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">BD (C&F)</th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">BD C&F Cost</th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Track No.</th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Packet</th>
                          <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white/50">
                        {history.map((historyItem, idx) => (
                          <tr key={idx} className={`${historyItem._id === viewRecord.data._id ? 'bg-blue-50/50' : ''} whitespace-nowrap`}>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {formatDate(historyItem.date)}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-gray-900">{historyItem.lcNo || '-'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{historyItem.port || '-'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{historyItem.importer || '-'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{historyItem.indianCnF || '-'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{historyItem.indCnFCost || '-'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{historyItem.bdCnF || '-'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{historyItem.bdCnFCost || '-'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{historyItem.trackNo || '-'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{historyItem.packet || '-'}</td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{historyItem.quantity} {historyItem.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-100/50 border-t-2 border-gray-200">
                        <tr>
                          <td colSpan="10" className="px-6 py-4 text-sm font-bold text-gray-900 text-right">Total Quantity:</td>
                          <td className="px-6 py-4 text-sm font-bold text-blue-600">{total} {unit}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()}
            </div>


          </div>
        </div>
      )}
    </div>
  );
}

export default App;
/*

*/