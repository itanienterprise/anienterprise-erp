import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MenuIcon, SearchIcon, HomeIcon, UsersIcon, AnchorIcon,
  BarChartIcon, FunnelIcon, XIcon, DollarSignIcon, ShoppingCartIcon,
  ChevronDownIcon, BoxIcon, BellIcon, TrashIcon
} from './components/Icons';

import { encryptData, decryptData } from './utils/encryption';
import { generateLCReceiveReportPDF } from './utils/pdfGenerator';
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

  const [stockRecords, setStockRecords] = useState([]);
  const [stockFilters, setStockFilters] = useState({ startDate: '', endDate: '', lcNo: '', port: '', brand: '', importer: '', productName: '' });

  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const longPressTimer = useRef(null);
  const isLongPressTriggered = useRef(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, type: '', id: null, isBulk: false });
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
    ip: { key: 'openingDate', direction: 'desc' },
    customer: { key: 'name', direction: 'asc' }
  });

  const [showLcReport, setShowLcReport] = useState(false);
  const [showLcReportFilterPanel, setShowLcReportFilterPanel] = useState(false);
  const [products, setProducts] = useState([]);
  const lcReportFilterRef = useRef(null);
  const lcReportFilterButtonRef = useRef(null);






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
