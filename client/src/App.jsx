import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MenuIcon, SearchIcon, HomeIcon, UsersIcon, UserIcon, AnchorIcon,
  BarChartIcon, FunnelIcon, XIcon, DollarSignIcon, ShoppingCartIcon,
  ChevronDownIcon, BoxIcon, BellIcon, TrashIcon
} from './components/Icons';

import { encryptData, decryptData } from './utils/encryption';
import { API_BASE_URL, formatDate, parseDate, SortIcon } from './utils/helpers';
import CustomDatePicker from './components/shared/CustomDatePicker';
import Importer from './components/modules/Importer/Importer';
import Port from './components/modules/Port/Port';
import IPManagement from './components/modules/IPManagement/IPManagement';
import ProductManagement from './components/modules/Product/ProductManagement';
import Customer from './components/modules/Customer/Customer';
import LCReceive from './components/modules/LCReceive/LCReceive';
import WarehouseManagement from './components/modules/Warehouse/WarehouseManagement';
import StockManagement from "./components/modules/StockManagement/StockManagement";
import StockReport from './components/modules/StockManagement/StockReport';
import LCReport from './components/modules/LCReceive/LCReport';
import { calculateStockData } from './utils/stockHelpers';


function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stockDropdownOpen, setStockDropdownOpen] = useState(false);
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('currentView') || 'dashboard';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [importers, setImporters] = useState([]);
  const [ports, setPorts] = useState([]);
  const [showStockForm, setShowStockForm] = useState(false);
  const [showStockReport, setShowStockReport] = useState(false);
  const [stockFormData, setStockFormData] = useState({
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
    totalLcTruck: '',
    totalLcQuantity: '',
    status: 'In Stock',
    productEntries: [{
      isMultiBrand: true,
      productName: '',
      truckNo: '',
      brandEntries: [{ brand: '', purchasedPrice: '', packet: '', packetSize: '', quantity: '', unit: 'kg', sweepedPacket: '', sweepedQuantity: '', totalInHousePacket: '', totalInHouseQuantity: '', salePacket: '', saleQuantity: '', inHousePacket: '', inHouseQuantity: '' }]
    }]
  });

  const [isLoading, setIsLoading] = useState(false);
  const [stockRecords, setStockRecords] = useState([]);
  const [stockFilters, setStockFilters] = useState({ startDate: '', endDate: '', lcNo: '', port: '', brand: '', importer: '', exporter: '', productName: '' });
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const longPressTimer = useRef(null);
  const isLongPressTriggered = useRef(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, type: '', id: null, isBulk: false });

  const [sortConfig, setSortConfig] = useState({
    stock: { key: 'date', direction: 'desc' },
    history: { key: 'date', direction: 'desc' },
    importer: { key: 'name', direction: 'asc' },
    port: { key: 'name', direction: 'asc' },
    ip: { key: 'openingDate', direction: 'desc' },
    customer: { key: 'name', direction: 'asc' }
  });

  const [showLcReport, setShowLcReport] = useState(false);
  const [products, setProducts] = useState([]);


  const initialLcFilterState = {
    startDate: '',
    endDate: '',
    lcNo: '',
    port: '',
    indCnf: '',
    exporter: '',
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
      const matchesExporter = (item.exporter || '').toLowerCase().includes(searchLower);
      const matchesBillOfEntry = (item.billOfEntry || '').toLowerCase().includes(searchLower);
      const matchesPort = (item.port || '').toLowerCase().includes(searchLower);
      const matchesTruck = (item.truckNo || '').toLowerCase().includes(searchLower);
      const matchesProduct = (item.productName || '').toLowerCase().includes(searchLower);
      const brandList = item.brand ? [item.brand] : (item.brandEntries || []).map(e => e.brand);
      const matchesBrand = brandList.some(b => (b || '').trim().toLowerCase().includes(searchLower));

      return matchesLC || matchesImporter || matchesExporter || matchesBillOfEntry || matchesPort || matchesTruck || matchesProduct || matchesBrand;
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


  useEffect(() => {
    setSelectedItems(new Set());
    setEditingId(null);
    localStorage.setItem('currentView', currentView);

    // Close all forms when changing sections
    if (currentView === 'ip-section' || currentView === 'customer-section') {
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


  // Click-outside detection for stock report filter panel

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
    if (type === 'stock') {
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
        exporter: item.exporter || '',
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
      case 'customer-section':
        return (
          <Customer
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
          <button onClick={() => { setCurrentView('customer-section'); setSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-lg transition-all ${currentView === 'customer-section' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
            <UsersIcon className="w-5 h-5 mr-3" />
            <span className="font-medium">Customer</span>
          </button>
          <button onClick={() => { setCurrentView('importer-section'); setSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-lg transition-all ${currentView === 'importer-section' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
            <UserIcon className="w-5 h-5 mr-3" />
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

      {/* LC Receive Report Modal */}
      <LCReport
        isOpen={showLcReport}
        onClose={() => setShowLcReport(false)}
        stockRecords={stockRecords}
        lcFilters={lcFilters}
        setLcFilters={setLcFilters}
        lcReceiveRecords={lcReceiveRecords}
        lcReceiveSummary={lcReceiveSummary}
      />

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
