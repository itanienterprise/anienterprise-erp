import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  BarChartIcon, FunnelIcon, TrendingUpIcon, PrinterIcon, 
  DollarSignIcon, ReceiptIcon, SearchIcon, XIcon, BoxIcon
} from '../../Icons';
import axios from '../../../utils/api';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';

export default function ProfitLoss({ salesRecords, products }) {
  // Filters State
  const [filterType, setFilterType] = useState('monthly'); // 'monthly', 'yearly', 'custom', 'all'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saleTypeFilter, setSaleTypeFilter] = useState('All'); // 'All', 'General', 'Border'
  const [selectedProduct, setSelectedProduct] = useState('All');
  const [selectedLcNo, setSelectedLcNo] = useState('All');
  const [lcSearch, setLcSearch] = useState('');
  const [showLcDropdown, setShowLcDropdown] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [lcRecords, setLcRecords] = useState([]);
  const [lcExpenses, setLcExpenses] = useState([]);
  const [insurancePayments, setInsurancePayments] = useState([]);
  const [stockRecords, setStockRecords] = useState([]);
  const [damages, setDamages] = useState([]);

  useEffect(() => {
    const fetchLCData = async () => {
      try {
        const [lcRes, expRes, insRes, stockRes, damageRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/lc-management`),
          axios.get(`${API_BASE_URL}/api/lc-expenses`),
          axios.get(`${API_BASE_URL}/api/insurance-payments`),
          axios.get(`${API_BASE_URL}/api/stock`),
          axios.get(`${API_BASE_URL}/api/damages`)
        ]);
        setLcRecords(Array.isArray(lcRes.data) ? lcRes.data : []);
        setLcExpenses(Array.isArray(expRes.data) ? expRes.data : []);
        setInsurancePayments(Array.isArray(insRes.data) ? insRes.data : []);
        setStockRecords(Array.isArray(stockRes.data) ? stockRes.data : []);
        setDamages(Array.isArray(damageRes.data) ? damageRes.data : []);
      } catch (error) {
        console.error('Error fetching LC, expenses, stock, and damage data:', error);
      }
    };
    fetchLCData();
  }, []);

  const lcDropdownRef = useRef(null);
  const filterPanelRef = useRef(null);
  const filterButtonRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (lcDropdownRef.current && !lcDropdownRef.current.contains(event.target)) {
        setShowLcDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        filterPanelRef.current && !filterPanelRef.current.contains(event.target) &&
        filterButtonRef.current && !filterButtonRef.current.contains(event.target)
      ) {
        setShowFilterPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to find the unit purchase price (cost) of a product/brand
  const getPurchasePrice = (productName, brandName) => {
    if (!products || !Array.isArray(products)) return 0;
    
    // Find product matching name
    const product = products.find(p => 
      (p.productName || p.product || '').trim().toLowerCase() === (productName || '').trim().toLowerCase()
    );
    if (!product) return 0;

    // Try to find the specific brand entry
    if (product.brands && Array.isArray(product.brands)) {
      const brandEntry = product.brands.find(b => 
        (b.brand || '').trim().toLowerCase() === (brandName || '').trim().toLowerCase()
      );
      if (brandEntry && brandEntry.purchasedPrice) {
        return parseFloat(brandEntry.purchasedPrice) || 0;
      }
    }

    // Fallback to product level purchased price
    return parseFloat(product.purchasedPrice) || 0;
  };

  // Helper to check if a sale date matches the selected range
  const isDateInRange = (saleDateStr) => {
    if (!saleDateStr) return false;
    const saleDate = new Date(saleDateStr);
    if (isNaN(saleDate.getTime())) return false;

    if (filterType === 'monthly') {
      return saleDate.getMonth() + 1 === selectedMonth && saleDate.getFullYear() === selectedYear;
    }
    if (filterType === 'yearly') {
      return saleDate.getFullYear() === selectedYear;
    }
    if (filterType === 'custom') {
      const sDate = startDate ? new Date(startDate) : null;
      const eDate = endDate ? new Date(endDate) : null;
      
      // Normalize times for date comparison
      if (sDate) sDate.setHours(0,0,0,0);
      if (eDate) eDate.setHours(23,59,59,999);
      saleDate.setHours(0,0,0,0);

      if (sDate && saleDate < sDate) return false;
      if (eDate && saleDate > eDate) return false;
      return true;
    }
    return true; // 'all'
  };

  // Process and Filter Sales Data
  const profitLossData = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;

    salesRecords.forEach(sale => {
      // Filter by date
      if (!isDateInRange(sale.date)) return;

      // Filter by Sale Type
      if (saleTypeFilter !== 'All' && sale.saleType !== saleTypeFilter) return;

      const items = sale.items || [];

      // Create flat list of entries for calculations
      const entries = items.flatMap(item => {
        const itemLcNo = item.lcNo || sale.lcNo || '';
        
        // Filter by LC Number at the item level if specified
        if (selectedLcNo && selectedLcNo !== 'All' && selectedLcNo.trim() !== '') {
          const entryLcNo = itemLcNo.trim().toLowerCase();
          const searchLcNo = selectedLcNo.trim().toLowerCase();
          if (!entryLcNo.includes(searchLcNo)) return [];
        }

        const brandEntries = (item.brandEntries && item.brandEntries.length > 0)
          ? item.brandEntries
          : [{ brandName: item.brand || '-', quantity: item.quantity, unitPrice: item.unitPrice || 0, totalAmount: item.totalAmount || 0 }];
        
        return brandEntries.map(entry => ({
          productName: item.productName || item.product || '-',
          brandName: entry.brandName || entry.brand || '-',
          quantity: parseFloat(entry.quantity) || 0,
          unitPrice: parseFloat(entry.unitPrice) || 0,
          totalAmount: parseFloat(entry.totalAmount) || (parseFloat(entry.quantity) * parseFloat(entry.unitPrice)) || 0
        }));
      });

      // Filter by Product Name if specified
      const matchesProductFilter = selectedProduct === 'All' || entries.some(e => e.productName === selectedProduct);
      if (!matchesProductFilter) return;

      entries.forEach(entry => {
        if (selectedProduct !== 'All' && entry.productName !== selectedProduct) return;

        const purchasePrice = getPurchasePrice(entry.productName, entry.brandName);
        const itemCost = entry.quantity * purchasePrice;
        const itemRevenue = entry.totalAmount;

        totalRevenue += itemRevenue;
        totalCost += itemCost;
      });
    });

    const totalProfit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
      summary: {
        totalRevenue,
        totalCost,
        totalProfit,
        margin
      }
    };
  }, [salesRecords, products, filterType, selectedMonth, selectedYear, startDate, endDate, saleTypeFilter, selectedProduct, selectedLcNo]);

  // Unique product names for filter dropdown
  const uniqueProducts = useMemo(() => {
    const names = new Set();
    salesRecords.forEach(sale => {
      (sale.items || []).forEach(item => {
        const name = item.productName || item.product;
        if (name) names.add(name);
      });
    });
    return Array.from(names).sort();
  }, [salesRecords]);

  // Unique LC Numbers from LC Management module
  const uniqueLcNos = useMemo(() => {
    const nos = new Set();
    lcRecords.forEach(lc => {
      if (lc.lcNo) {
        const trimmed = lc.lcNo.trim();
        if (trimmed) nos.add(trimmed);
      }
    });
    return Array.from(nos).sort();
  }, [lcRecords]);

  // Selected LC Details
  const selectedLc = useMemo(() => {
    if (!selectedLcNo || selectedLcNo === 'All') return null;
    return lcRecords.find(lc => (lc.lcNo || '').trim().toLowerCase() === selectedLcNo.trim().toLowerCase());
  }, [selectedLcNo, lcRecords]);

  // Expenses for the selected LC (matching LCManagement's logic)
  const selectedLcExpenses = useMemo(() => {
    if (!selectedLc) return [];
    const cleanLc = (val) => String(val || '').replace(/\D/g, '').toLowerCase();
    const lcNoClean = cleanLc(selectedLc.lcNo);

    // 1. Custom expenses where type !== 'bill'
    const customExpenses = lcExpenses.filter(exp => 
      cleanLc(exp.lcNo) === lcNoClean && exp.type !== 'bill'
    );

    // 2. Insurance payments (where type !== 'Return Collection')
    const insPayments = insurancePayments
      .filter(p => cleanLc(p.lcNo) === lcNoClean && p.type !== 'Return Collection')
      .map(p => ({
        _id: p._id,
        date: p.date,
        expenseHead: 'Insurance Premium',
        name: p.companyName || 'Insurance',
        amount: (parseFloat(p.amount) || 0) + (parseFloat(p.adjustedAmount) || 0),
        remarks: p.remarks || 'Premium Payment'
      }));

    const list = [...customExpenses, ...insPayments];

    // 3. Margin Paid (virtual)
    const marginPaidAmt = parseFloat(selectedLc.marginPaid) || (() => {
      const total = parseFloat(selectedLc.totalAmount) || 0;
      const margin = parseFloat(selectedLc.bankMargin) || 0;
      return total * (margin / 100);
    })();
    if (marginPaidAmt > 0) {
      list.unshift({
        _id: 'margin-paid-virtual',
        date: selectedLc.openingDate || selectedLc.createdAt,
        expenseHead: `Margin Paid (${selectedLc.bankMargin || 0}%)`,
        bankName: selectedLc.bankName || 'Bank',
        amount: marginPaidAmt,
        remarks: 'Paid Margin'
      });
    }

    // 4. Amendment Margin Paid (virtual)
    if (selectedLc.amendments && selectedLc.amendments.length > 0) {
      selectedLc.amendments.forEach((amnd, idx) => {
        if (amnd.amendmentNo === 'Original LC') return;
        const margin = amnd.amendmentMargin !== undefined ? (parseFloat(amnd.amendmentMargin) || 0) : (selectedLc.bankMargin !== undefined ? parseFloat(selectedLc.bankMargin) : 0);
        const amndMarginPaid = parseFloat(amnd.amendmentMarginPaid) || (() => {
          const amndMarginBill = parseFloat(amnd.amendmentMarginBill) || 0;
          return amndMarginBill * (margin / 100);
        })();
        if (amndMarginPaid > 0) {
          list.push({
            _id: `amnd-margin-paid-virtual-${idx}`,
            date: amnd.amendmentDate || selectedLc.openingDate,
            expenseHead: `Margin Paid (${margin}%) (${amnd.amendmentNo || `Amend #${idx + 1}`})`,
            bankName: selectedLc.bankName || 'Bank',
            amount: amndMarginPaid,
            remarks: `Paid Margin for ${amnd.amendmentNo || `Amend #${idx + 1}`}`
          });
        }
      });
    }

    return list.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [selectedLc, lcExpenses, insurancePayments]);

  const totalLcExpensesAmount = useMemo(() => {
    return selectedLcExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
  }, [selectedLcExpenses]);

  // Stock / Arrival records for the selected LC
  const selectedLcStocks = useMemo(() => {
    if (!selectedLc) return [];
    const cleanLc = (val) => String(val || '').replace(/\D/g, '').toLowerCase();
    const lcNoClean = cleanLc(selectedLc.lcNo);
    return stockRecords.filter(item => {
      const status = (item.status || '').toLowerCase();
      if (status.includes('requested') || status.includes('rejected') || status.includes('deleted')) return false;
      return cleanLc(item.lcNo) === lcNoClean;
    });
  }, [selectedLc, stockRecords]);

  // Damage records for the selected LC
  const selectedLcDamages = useMemo(() => {
    if (!selectedLc) return [];
    const cleanLc = (val) => String(val || '').replace(/\D/g, '').toLowerCase();
    const lcNoClean = cleanLc(selectedLc.lcNo);
    return damages.filter(d => cleanLc(d.lcNo) === lcNoClean);
  }, [selectedLc, damages]);

  // Product arrival, inhouse, short, and damage summary
  const productSummary = useMemo(() => {
    if (!selectedLc) return [];
    
    const summaryMap = {};
    
    // Aggregate stock (arrival) records
    selectedLcStocks.forEach(item => {
      const prodName = item.productName || item.product || 'Unknown Product';
      if (!summaryMap[prodName]) {
        summaryMap[prodName] = {
          productName: prodName,
          purchaseQty: 0,
          purchasePrice: 0,
          inhouseQty: 0,
          inhousePrice: 0,
          shortQty: 0,
          shortPrice: 0,
          damageQty: 0,
          damagePrice: 0,
          saleQty: 0,
          salePrice: 0,
          unit: item.unit || 'kg'
        };
      }
      
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.purchasedPrice) || 0;
      const shortQty = parseFloat(item.sweepedQuantity) || 0;
      const inhouseQty = parseFloat(item.inHouseQuantity) || (qty - shortQty);
      
      summaryMap[prodName].purchaseQty += qty;
      summaryMap[prodName].purchasePrice += qty * price;
      
      summaryMap[prodName].inhouseQty += inhouseQty;
      summaryMap[prodName].inhousePrice += inhouseQty * price;
      
      summaryMap[prodName].shortQty += shortQty;
      summaryMap[prodName].shortPrice += shortQty * price;
    });

    // Aggregate damage records
    selectedLcDamages.forEach(d => {
      const prodName = d.productName || 'Unknown Product';
      if (!summaryMap[prodName]) {
        summaryMap[prodName] = {
          productName: prodName,
          purchaseQty: 0,
          purchasePrice: 0,
          inhouseQty: 0,
          inhousePrice: 0,
          shortQty: 0,
          shortPrice: 0,
          damageQty: 0,
          damagePrice: 0,
          saleQty: 0,
          salePrice: 0,
          unit: d.unit || 'kg'
        };
      }
      
      const dQty = parseFloat(d.quantity) || 0;
      const dPrice = parseFloat(d.price) || 0;
      
      summaryMap[prodName].damageQty += dQty;
      summaryMap[prodName].damagePrice += dQty * dPrice;
    });

    // Aggregate sales records for this LC
    const cleanLc = (val) => String(val || '').replace(/\D/g, '').toLowerCase();
    const lcNoClean = cleanLc(selectedLc.lcNo);

    salesRecords.forEach(sale => {
      const sStatus = (sale.status || '').toLowerCase();
      if (sStatus !== 'accepted' && sStatus !== 'pending') return;

      const items = sale.items || [];
      items.forEach(item => {
        const itemLc = item.lcNo || sale.lcNo || '';
        if (cleanLc(itemLc) !== lcNoClean) return;

        const prodName = item.productName || item.product || 'Unknown Product';
        if (!summaryMap[prodName]) {
          summaryMap[prodName] = {
            productName: prodName,
            purchaseQty: 0,
            purchasePrice: 0,
            inhouseQty: 0,
            inhousePrice: 0,
            shortQty: 0,
            shortPrice: 0,
            damageQty: 0,
            damagePrice: 0,
            saleQty: 0,
            salePrice: 0,
            unit: item.unit || 'kg'
          };
        }

        const brandEntries = (item.brandEntries && item.brandEntries.length > 0)
          ? item.brandEntries
          : [{ quantity: item.quantity, totalAmount: item.totalAmount || (parseFloat(item.quantity) * parseFloat(item.unitPrice)) || 0 }];
        
        brandEntries.forEach(entry => {
          const qty = parseFloat(entry.quantity) || 0;
          const totalAmount = parseFloat(entry.totalAmount) || (qty * (parseFloat(entry.unitPrice) || 0));
          summaryMap[prodName].saleQty += qty;
          summaryMap[prodName].salePrice += totalAmount;
        });
      });
    });

    return Object.values(summaryMap);
  }, [selectedLc, selectedLcStocks, selectedLcDamages, salesRecords]);



  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-8 print:bg-white print:p-0">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-4 gap-4 print:hidden">
        {/* Left column: Title and Icon */}
        <div className="flex items-center gap-3 md:flex-1">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 shadow-inner">
            <BarChartIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Profit & Loss Report</h1>
            <p className="text-xs text-gray-500 font-medium">Analyze revenue, costs, and margins from sales</p>
          </div>
        </div>

        {/* Center column: LC No Searchable Dropdown Button */}
        <div className="flex items-center justify-center gap-2 md:flex-1">
          <div className="relative w-full max-w-[240px]" ref={lcDropdownRef}>
            <div className="relative">
              <input
                autoComplete="off"
                type="text"
                value={lcSearch}
                onChange={(e) => {
                  setLcSearch(e.target.value);
                  setSelectedLcNo(e.target.value);
                  setShowLcDropdown(true);
                }}
                onFocus={() => setShowLcDropdown(true)}
                placeholder={selectedLcNo === 'All' ? 'Search LC No...' : selectedLcNo}
                className={`w-full pl-3 pr-14 py-2 bg-white border border-gray-100 rounded-xl text-xs sm:text-sm font-bold text-gray-800 outline-none transition-all shadow-sm hover:border-gray-200 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 ${selectedLcNo !== 'All' ? 'placeholder:text-gray-900 placeholder:font-black' : 'placeholder:text-gray-300'}`}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {selectedLcNo !== 'All' && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelectedLcNo('All');
                      setLcSearch('');
                      setShowLcDropdown(false);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                )}
                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
              </div>
            </div>
            {showLcDropdown && (() => {
              const filtered = uniqueLcNos.filter(lc =>
                lc.toLowerCase().includes(lcSearch.toLowerCase())
              );
              return filtered.length > 0 ? (
                <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                  {filtered.map(lc => (
                    <button
                      key={lc}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSelectedLcNo(lc);
                        setLcSearch(lc);
                        setShowLcDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-xs sm:text-sm hover:bg-blue-50 transition-colors font-medium text-gray-700"
                    >
                      {lc}
                    </button>
                  ))}
                </div>
              ) : null;
            })()}
          </div>
        </div>

          {/* Right column: Action buttons */}
        <div className="flex items-center gap-2 justify-between sm:justify-end md:flex-1">
          <div className="relative">
            <button
              ref={filterButtonRef}
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center gap-2 px-3 rounded-xl transition-all border font-medium text-sm ${
                showFilterPanel || filterType !== 'monthly' || saleTypeFilter !== 'All' || selectedProduct !== 'All'
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200'
              }`}
            >
              <FunnelIcon className={`w-4 h-4 ${showFilterPanel || filterType !== 'monthly' || saleTypeFilter !== 'All' || selectedProduct !== 'All' ? 'text-white' : 'text-gray-400'}`} />
            </button>

            {/* Floating Filter Panel */}
            {showFilterPanel && (
              <div
                ref={filterPanelRef}
                className="fixed inset-x-4 top-24 md:absolute md:inset-auto md:right-0 md:mt-3 w-auto md:w-[420px] bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[60] p-4 md:p-6 animate-in fade-in zoom-in duration-200"
              >
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100">
                  <h4 className="font-extrabold text-gray-900 text-base">Filter Report</h4>
                  <button
                    onClick={() => {
                      setFilterType('monthly');
                      setSelectedMonth(new Date().getMonth() + 1);
                      setSelectedYear(new Date().getFullYear());
                      setStartDate('');
                      setEndDate('');
                      setSaleTypeFilter('All');
                      setSelectedProduct('All');
                      setShowFilterPanel(false);
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest"
                  >
                    RESET ALL
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Time Period */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Time Period</label>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-gray-50 hover:bg-gray-100/70 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="custom">Custom Range</option>
                      <option value="all">All Time</option>
                    </select>
                  </div>

                  {/* Month / Year pickers */}
                  {filterType === 'monthly' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Month</label>
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                          className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {new Date(2026, i, 1).toLocaleString('en-US', { month: 'long' })}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Year</label>
                        <select
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                          className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          {[2024, 2025, 2026, 2027, 2028].map(yr => (
                            <option key={yr} value={yr}>{yr}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {filterType === 'yearly' && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Year</label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        {[2024, 2025, 2026, 2027, 2028].map(yr => (
                          <option key={yr} value={yr}>{yr}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {filterType === 'custom' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">From Date</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">To Date</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>
                  )}

                  {/* Sale Type */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Sale Type</label>
                    <select
                      value={saleTypeFilter}
                      onChange={(e) => setSaleTypeFilter(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                    >
                      <option value="All">All Types</option>
                      <option value="General">General Sales Only</option>
                      <option value="Border">Border Sales Only</option>
                    </select>
                  </div>

                  {/* Product Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Product</label>
                    <select
                      value={selectedProduct}
                      onChange={(e) => setSelectedProduct(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                    >
                      <option value="All">All Products</option>
                      {uniqueProducts.map(pName => (
                        <option key={pName} value={pName}>{pName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handlePrint}
            className="h-9 sm:h-10 px-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 font-semibold text-xs tracking-wider transition-all"
          >
            <PrinterIcon className="w-4 h-4 text-white" />
            <span>PRINT REPORT</span>
          </button>
        </div>
      </div>

      <div className="space-y-6 mt-3">
      {/* Print-Only Header */}
      <div className="hidden print:block text-center space-y-2 border-b border-gray-300 pb-6 mb-6">
        <h1 className="text-3xl font-black text-gray-900">M/S ANI ENTERPRISE</h1>
        <p className="text-xs text-gray-500">766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh</p>
        <div className="text-lg font-bold text-gray-800 uppercase tracking-wider py-1 border border-gray-800 inline-block px-8 mt-2">PROFIT & LOSS STATEMENT</div>
        <p className="text-xs text-gray-600 mt-2 font-medium">
          Period: {filterType === 'monthly' ? `Month: ${selectedMonth}/${selectedYear}` : filterType === 'yearly' ? `Year: ${selectedYear}` : filterType === 'custom' ? `${startDate} to ${endDate}` : 'All Time'}
          {saleTypeFilter !== 'All' ? ` | Type: ${saleTypeFilter} Sales` : ''}
          {selectedProduct !== 'All' ? ` | Product: ${selectedProduct}` : ''}
          {selectedLcNo !== 'All' ? ` | LC No: ${selectedLcNo}` : ''}
        </p>
      </div>


      {/* Metrics Grid Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Total Revenue */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full flex items-start justify-end p-4 group-hover:scale-105 transition-transform">
            <DollarSignIcon className="w-6 h-6 text-blue-500" />
          </div>
          <div className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Total Revenue</div>
          <div className="text-xl sm:text-2xl font-black text-gray-900">৳ {Math.round(profitLossData.summary.totalRevenue).toLocaleString('en-IN')}</div>
          <div className="text-[11px] text-gray-400 mt-2 font-medium">Accumulated invoice totals</div>
        </div>

        {/* Metric 2: Total COGS */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full flex items-start justify-end p-4 group-hover:scale-105 transition-transform">
            <ReceiptIcon className="w-6 h-6 text-amber-500" />
          </div>
          <div className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Cost of Goods Sold (COGS)</div>
          <div className="text-xl sm:text-2xl font-black text-gray-900">৳ {Math.round(profitLossData.summary.totalCost).toLocaleString('en-IN')}</div>
          <div className="text-[11px] text-gray-400 mt-2 font-medium">Calculated based on product costs</div>
        </div>

        {/* Metric 3: Gross Profit */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full flex items-start justify-end p-4 group-hover:scale-105 transition-transform">
            <TrendingUpIcon className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Net Profit / Loss</div>
          <div className={`text-xl sm:text-2xl font-black ${profitLossData.summary.totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            ৳ {Math.round(profitLossData.summary.totalProfit).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-gray-400 mt-2 font-medium">Net profit before overheads</div>
        </div>

        {/* Metric 4: Profit Margin */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full flex items-start justify-end p-4 group-hover:scale-105 transition-transform">
            <BarChartIcon className="w-6 h-6 text-indigo-500" />
          </div>
          <div className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Net Margin</div>
          <div className={`text-xl sm:text-2xl font-black ${profitLossData.summary.totalProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
            {profitLossData.summary.margin.toFixed(2)} %
          </div>
          <div className="text-[11px] text-gray-400 mt-2 font-medium">Percentage of revenue retained</div>
        </div>
      </div>

      {/* LC Details Card (restricted to left side, 50% width on desktop) */}
      <div className="w-full lg:w-[calc(50%-0.5rem)]">
        {selectedLc ? (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
            <div className="px-6 py-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50/50">
              <div>
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">LC Details</h2>
                <p className="text-xs text-gray-500 font-medium">Core information & values for LC No: <span className="text-blue-600 font-bold">{selectedLc.lcNo}</span></p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider self-start sm:self-center ${selectedLc.status === 'Opened' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                {selectedLc.status || 'Opened'}
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Parties & Bank */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Parties & Bank</h3>
                <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                  <div>
                    <div className="text-[10px] text-gray-400 font-black uppercase">Importer</div>
                    <div className="text-sm font-bold text-gray-800">{selectedLc.importerName || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-black uppercase">Exporter</div>
                    <div className="text-sm font-bold text-gray-800">{selectedLc.exporterName || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-black uppercase">Bank & Branch</div>
                    <div className="text-sm font-bold text-gray-800">{selectedLc.bankName || 'N/A'} {selectedLc.bankBranch ? `(${selectedLc.bankBranch})` : ''}</div>
                  </div>
                </div>
              </div>

              {/* Dates & Metrics */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Timeline & Volume</h3>
                <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] text-gray-400 font-black uppercase">Opening Date</div>
                      <div className="text-xs font-bold text-gray-800">{selectedLc.openingDate ? formatDate(selectedLc.openingDate) : 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 font-black uppercase">Expiry Date</div>
                      <div className="text-xs font-bold text-gray-800">{selectedLc.expiryDate ? formatDate(selectedLc.expiryDate) : 'N/A'}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-black uppercase">Total Volume (Ton)</div>
                    <div className="text-sm font-black text-gray-800">{selectedLc.quantity || '0'} Ton</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-black uppercase">Port of Entry</div>
                    <div className="text-sm font-semibold text-gray-800">{selectedLc.port || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Financial Summary</h3>
                <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                  <div>
                    <div className="text-[10px] text-gray-400 font-black uppercase">LC Value (USD)</div>
                    <div className="text-sm font-black text-gray-800">$ {parseFloat(selectedLc.totalDollar || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] text-gray-400 font-black uppercase">Exchange Rate</div>
                      <div className="text-xs font-semibold text-gray-800">{selectedLc.dollarRate || '0.00'} BDT</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 font-black uppercase">Total (BDT)</div>
                      <div className="text-xs font-black text-gray-800">৳ {parseFloat(selectedLc.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-gray-200/60 pt-2 mt-1">
                    <div>
                      <div className="text-[10px] text-gray-400 font-black uppercase">Margin (%)</div>
                      <div className="text-xs font-bold text-gray-800">{selectedLc.bankMargin || '0'} %</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 font-black uppercase">Margin Paid</div>
                      <div className="text-xs font-black text-emerald-600">৳ {parseFloat(selectedLc.marginPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Products list nested table */}
            {selectedLc.productsList && selectedLc.productsList.length > 0 && (
              <div className="border-t border-gray-100">
                <div className="px-6 py-3 bg-slate-50/20 text-[10px] font-black text-gray-400 uppercase tracking-wider">Products list in LC</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                        <th className="py-2.5 px-6">Product Name</th>
                        <th className="py-2.5 px-4 text-center">HS Code</th>
                        <th className="py-2.5 px-4 text-right">Quantity (Ton)</th>
                        <th className="py-2.5 px-4 text-right">Rate ($)</th>
                        <th className="py-2.5 px-4 text-right">Freight ($)</th>
                        <th className="py-2.5 px-6 text-right font-black">Total Value (USD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-medium">
                      {selectedLc.productsList.map((prod, idx) => {
                        const qty = parseFloat(prod.quantity) || 0;
                        const rate = parseFloat(prod.rate) || 0;
                        const freight = parseFloat(prod.freight) || 0;
                        const totalVal = qty * (rate + freight);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                            <td className="py-2.5 px-6 font-bold text-gray-900">{prod.productName || 'N/A'}</td>
                            <td className="py-2.5 px-4 text-center text-gray-500">{prod.hsCode || 'N/A'}</td>
                            <td className="py-2.5 px-4 text-right font-bold">{qty.toLocaleString()}</td>
                            <td className="py-2.5 px-4 text-right">${rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="py-2.5 px-4 text-right">${freight.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="py-2.5 px-6 text-right font-black text-blue-600">${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mx-auto mb-4 animate-pulse">
              <BarChartIcon className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-1">LC Details</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">Search or select an LC Number from the header input to inspect its details, margin status, products, and values.</p>
          </div>
        )}
      </div>

      {/* Row container for LC Expense (Left) and Product Stock & Arrivals (Right) */}
      <div className="flex flex-col lg:flex-row gap-4 mt-6">
        
        {/* LC Expense Card (Left) */}
        <div className="w-full lg:w-[calc(50%-0.5rem)] flex flex-col">
          {selectedLc ? (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-200 flex-1 flex flex-col justify-between">
              <div>
                <div className="px-6 py-5 border-b border-gray-200 bg-slate-50/50">
                  <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">LC Expense</h2>
                  <p className="text-xs text-gray-500 font-medium">All registered payments, virtual margins and premium details for LC No: <span className="text-blue-600 font-bold">{selectedLc.lcNo}</span></p>
                </div>
                <div className="overflow-x-auto min-h-[220px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                        <th className="py-2.5 px-6">Date</th>
                        <th className="py-2.5 px-4">Expense Head</th>
                        <th className="py-2.5 px-4">Paid To / Bank</th>
                        <th className="py-2.5 px-6 text-right font-black">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-medium">
                      {selectedLcExpenses.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="py-8 text-center text-gray-400 font-semibold">No expenses found for this LC.</td>
                        </tr>
                      ) : (
                        selectedLcExpenses.map((exp, idx) => (
                          <tr key={exp._id || idx} className="hover:bg-slate-50/30 transition-colors">
                            <td className="py-2.5 px-6 whitespace-nowrap text-gray-500">{formatDate(exp.date)}</td>
                            <td className="py-2.5 px-4 font-bold text-gray-950">{exp.expenseHead || '-'}</td>
                            <td className="py-2.5 px-4 text-gray-600 truncate max-w-[120px]">{exp.cnfAgent || exp.bankName || exp.name || '-'}</td>
                            <td className="py-2.5 px-6 text-right font-black text-rose-600">৳ {Math.round(exp.amount).toLocaleString('en-IN')}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-black text-gray-500 uppercase tracking-wider">Total Expenses</span>
                <span className="text-sm font-black text-rose-600">৳ {Math.round(totalLcExpensesAmount).toLocaleString('en-IN')}</span>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm text-center min-h-[220px] flex-1 flex flex-col justify-center">
              <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-4 animate-pulse">
                <ReceiptIcon className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-1">LC Expense</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">Select an LC Number from the header input to inspect all related payments, insurance premiums, and virtual margins.</p>
            </div>
          )}
        </div>

        {/* Product Stock & Arrivals Card (Right) */}
        <div className="w-full lg:w-[calc(50%-0.5rem)] flex flex-col">
          {selectedLc ? (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-200 flex-1 flex flex-col">
              <div className="px-6 py-5 border-b border-gray-200 bg-slate-50/50">
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">Product Stock & Arrivals</h2>
                <p className="text-xs text-gray-500 font-medium">Arrival summaries, in-house inventory, short and damage records for LC No: <span className="text-blue-600 font-bold">{selectedLc.lcNo}</span></p>
              </div>
              <div className="p-6 space-y-8 flex-1">
                {productSummary.length === 0 ? (
                  <div className="text-center py-6 text-sm text-gray-400 font-bold">No product arrivals or damages found for this LC.</div>
                ) : (
                  productSummary.map((prod, idx) => (
                    <div key={idx} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-6 bg-blue-600 rounded-full" />
                        <h3 className="text-base font-black text-gray-950">{prod.productName}</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Purchase Arrival */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-blue-100 hover:bg-blue-50/10 transition-all">
                          <div className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Purchase (Total Arrival)</div>
                          <div className="text-sm font-black text-gray-900">{Math.round(prod.purchaseQty).toLocaleString()} {prod.unit}</div>
                          <div className="text-xs font-bold text-blue-600 mt-1">৳ {Math.round(prod.purchasePrice).toLocaleString('en-IN')}</div>
                        </div>

                        {/* Inhouse Quantity */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/10 transition-all">
                          <div className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Inhouse Quantity</div>
                          <div className="text-sm font-black text-gray-900">{Math.round(prod.inhouseQty).toLocaleString()} {prod.unit}</div>
                          <div className="text-xs font-bold text-emerald-600 mt-1">৳ {Math.round(prod.inhousePrice).toLocaleString('en-IN')}</div>
                        </div>

                        {/* Short Quantity */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-amber-100 hover:bg-amber-50/10 transition-all">
                          <div className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Short Quantity</div>
                          <div className="text-sm font-black text-rose-600">{Math.round(prod.shortQty).toLocaleString()} {prod.unit}</div>
                          <div className="text-xs font-bold text-amber-600 mt-1">৳ {Math.round(prod.shortPrice).toLocaleString('en-IN')}</div>
                        </div>

                        {/* Damage Quantity */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-rose-100 hover:bg-rose-50/10 transition-all">
                          <div className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Damage Quantity</div>
                          <div className="text-sm font-black text-rose-700">{Math.round(prod.damageQty).toLocaleString()} {prod.unit}</div>
                          <div className="text-xs font-bold text-rose-500 mt-1">৳ {Math.round(prod.damagePrice).toLocaleString('en-IN')}</div>
                        </div>

                        {/* Sold Quantity */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-violet-100 hover:bg-violet-50/10 transition-all">
                          <div className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Sold Quantity</div>
                          <div className="text-sm font-black text-gray-900">{Math.round(prod.saleQty || 0).toLocaleString()} {prod.unit}</div>
                          <div className="text-xs font-bold text-violet-600 mt-1">৳ {Math.round(prod.salePrice || 0).toLocaleString('en-IN')}</div>
                        </div>

                        {/* Current Stock */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/10 transition-all">
                          <div className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Current Stock</div>
                          <div className="text-sm font-black text-gray-900">{Math.round(prod.inhouseQty - (prod.saleQty || 0) - (prod.damageQty || 0)).toLocaleString()} {prod.unit}</div>
                          <div className="text-xs font-bold text-indigo-600 mt-1">
                            ৳ {(() => {
                              const currentStockQty = prod.inhouseQty - (prod.saleQty || 0) - (prod.damageQty || 0);
                              const avgPurchasePrice = prod.purchaseQty > 0 ? (prod.purchasePrice / prod.purchaseQty) : 0;
                              return Math.round(currentStockQty * avgPurchasePrice).toLocaleString('en-IN');
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm text-center min-h-[220px] flex-1 flex flex-col justify-center">
              <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mx-auto mb-4 animate-pulse">
                <BoxIcon className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-1">Product Stock & Arrivals</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">Select an LC Number from the header input to analyze product quantities, inhouse stock, shortage amounts, and damages.</p>
            </div>
          )}
        </div>

      </div>

      </div>
    </div>
  );
}
