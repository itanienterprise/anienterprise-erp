import React, { useState, useEffect, useRef } from 'react';
import {
  MenuIcon, SearchIcon, BellIcon, HomeIcon, BoxIcon, UsersIcon, AnchorIcon,
  BarChartIcon, SettingsIcon, TrendingUpIcon, DollarSignIcon,
  ShoppingCartIcon, EditIcon, TrashIcon, FunnelIcon, XIcon,
  ChevronUpIcon, ChevronDownIcon
} from './components/Icons';
import { encryptData, decryptData } from './utils/encryption';

const API_BASE_URL = `http://${window.location.hostname}:5000`;

const SortIcon = ({ config, columnKey }) => {
  if (config.key !== columnKey) return <div className="w-4 h-4 ml-1 opacity-20"><ChevronDownIcon className="w-4 h-4" /></div>;
  return config.direction === 'asc'
    ? <ChevronUpIcon className="w-4 h-4 ml-1 text-blue-600" />
    : <ChevronDownIcon className="w-4 h-4 ml-1 text-blue-600" />;
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

      // Automatically calculate Close Date if Opening Date is changed
      if (name === 'openingDate' && value) {
        const openingDate = new Date(value);
        if (!isNaN(openingDate.getTime())) {
          const closeDate = new Date(openingDate);
          closeDate.setMonth(closeDate.getMonth() + 4);

          // Format back to YYYY-MM-DD for the input[type="date"]
          const year = closeDate.getFullYear();
          const month = String(closeDate.getMonth() + 1).padStart(2, '0');
          const day = String(closeDate.getDate()).padStart(2, '0');
          newData.closeDate = `${year}-${month}-${day}`;
        }
      }

      return newData;
    });
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
    if (currentView === 'ip-section') {
      fetchIpRecords();
      fetchImporters(); // Fetch importers to populate the dropdown
      fetchPorts(); // Fetch ports to populate the dropdown
    } else if (currentView === 'importer-section') {
      fetchImporters();
    } else if (currentView === 'port-section') {
      fetchPorts();
    }
  }, [currentView]);

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

  const endLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDelete = (type, id) => {
    setDeleteConfirm({ show: true, type, id, isBulk: false });
  };

  const confirmDelete = async () => {
    const { type, id, isBulk } = deleteConfirm;
    const endpoint = type === 'ip' ? 'ip-records' : type === 'importer' ? 'importers' : 'ports';

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
                      <input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value, quickRange: 'custom' }))}
                        className="w-full px-3 py-2 text-xs bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                      <span className="text-gray-400">to</span>
                      <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value, quickRange: 'custom' }))}
                        className="w-full px-3 py-2 text-xs bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Port */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Port</label>
                    <input
                      type="text"
                      value={filters.port}
                      onChange={(e) => setFilters(prev => ({ ...prev, port: e.target.value }))}
                      list="filter-ports-list"
                      placeholder="All Ports"
                      className="w-full px-3 py-2 text-xs bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <datalist id="filter-ports-list">
                      <option value="" />
                      {ports.map(port => <option key={port._id} value={port.name} />)}
                    </datalist>
                  </div>

                  {/* Importer */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Importer</label>
                    <input
                      type="text"
                      value={filters.importer}
                      onChange={(e) => setFilters(prev => ({ ...prev, importer: e.target.value }))}
                      list="filter-importers-list"
                      placeholder="All Importers"
                      className="w-full px-3 py-2 text-xs bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <datalist id="filter-importers-list">
                      <option value="" />
                      {importers.map(i => <option key={i._id} value={i.name} />)}
                    </datalist>
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
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Opening Date</label>
                    <input
                      type="date"
                      name="openingDate"
                      value={formData.openingDate}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                  </div>

                  {/* Close Date */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Close Date</label>
                    <input
                      type="date"
                      name="closeDate"
                      value={formData.closeDate}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                  </div>

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
                  <div className="col-span-1 md:col-span-2 space-y-2">
                    <label className="text-sm font-medium text-gray-700">Importer</label>
                    <input
                      type="text"
                      name="ipParty"
                      value={formData.ipParty}
                      onChange={handleInputChange}
                      list="importers-list"
                      required
                      placeholder="Select or type importer name"
                      className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                    <datalist id="importers-list">
                      {importers.map(importer => (
                        <option key={importer._id} value={importer.name} />
                      ))}
                    </datalist>
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
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Port</label>
                    <input
                      type="text"
                      name="port"
                      value={formData.port}
                      onChange={handleInputChange}
                      list="ports-list"
                      required
                      placeholder="Select or type port name"
                      className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                    />
                    <datalist id="ports-list">
                      {ports.map((port) => (
                        <option key={port._id} value={port.name} />
                      ))}
                    </datalist>
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
                              {new Date(record.openingDate).toLocaleDateString()}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
    </div>
  );
}

export default App;
