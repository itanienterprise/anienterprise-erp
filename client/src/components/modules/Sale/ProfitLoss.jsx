import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  BarChartIcon, FunnelIcon, TrendingUpIcon, PrinterIcon,
  DollarSignIcon, ReceiptIcon, SearchIcon, XIcon, BoxIcon
} from '../../Icons';
import axios from '../../../utils/api';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import { getAdjustedLcValues, getCogNetBillBdt } from '../../../utils/lcValueUtils';
import CustomDatePicker from '../../shared/CustomDatePicker';
import { generateProfitLossPDF } from '../../../utils/pdfGenerator';

const ThreeDPieChart = ({ items, total }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!items || items.length === 0 || total === 0) {
    return (
      <div className="text-center text-xs text-gray-400 font-medium py-6">
        No financial distribution data available.
      </div>
    );
  }

  const cx = 330;
  const cy = 200;
  const outerR = 150;
  const innerR = 80;
  const plateR = 162;

  // Compute Donut Slice Paths
  const slices = items.map((item, idx) => {
    const midAngle = (item.startAngle + item.endAngle) / 2;
    const isHovered = hoveredIdx === idx;
    const explodeDist = isHovered ? 4 : 0;

    const dx = explodeDist * Math.cos(midAngle);
    const dy = explodeDist * Math.sin(midAngle);

    const sCx = cx + dx;
    const sCy = cy + dy;

    // Slice arc points
    const p1Out = { x: sCx + outerR * Math.cos(item.startAngle), y: sCy + outerR * Math.sin(item.startAngle) };
    const p2Out = { x: sCx + outerR * Math.cos(item.endAngle), y: sCy + outerR * Math.sin(item.endAngle) };
    const p1In  = { x: sCx + innerR * Math.cos(item.endAngle), y: sCy + innerR * Math.sin(item.endAngle) };
    const p2In  = { x: sCx + innerR * Math.cos(item.startAngle), y: sCy + innerR * Math.sin(item.startAngle) };

    const largeArc = (item.endAngle - item.startAngle) > Math.PI ? 1 : 0;

    const pathD = `M ${p1Out.x} ${p1Out.y} A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2Out.x} ${p2Out.y} L ${p1In.x} ${p1In.y} A ${innerR} ${innerR} 0 ${largeArc} 0 ${p2In.x} ${p2In.y} Z`;

    // Anchor dot on mid radius
    const dotR = (innerR + outerR) / 2;
    const dotX = sCx + dotR * Math.cos(midAngle);
    const dotY = sCy + dotR * Math.sin(midAngle);

    const isRight = Math.cos(midAngle) >= 0;

    return {
      ...item,
      idx,
      midAngle,
      pathD,
      dotX,
      dotY,
      isRight,
      naturalY: dotY,
      adjustedY: dotY
    };
  });

  // Collision resolution for callout lines
  const callouts = useMemo(() => {
    const solveSide = (sideItems) => {
      if (sideItems.length <= 1) return sideItems;
      const sorted = [...sideItems].sort((a, b) => a.naturalY - b.naturalY);
      const minGap = 65;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].adjustedY - sorted[i - 1].adjustedY < minGap) {
          sorted[i].adjustedY = sorted[i - 1].adjustedY + minGap;
        }
      }
      const avgNat = sorted.reduce((sum, i) => sum + i.naturalY, 0) / sorted.length;
      const avgAdj = sorted.reduce((sum, i) => sum + i.adjustedY, 0) / sorted.length;
      const shift = avgNat - avgAdj;
      return sorted.map(item => ({
        ...item,
        adjustedY: Math.max(40, Math.min(360, item.adjustedY + shift))
      }));
    };

    const left = solveSide(slices.filter(c => !c.isRight));
    const right = solveSide(slices.filter(c => c.isRight));

    return [...left, ...right];
  }, [slices]);

  return (
    <div className="flex flex-col items-center justify-center w-full flex-1 my-auto py-1">
      <div className="relative w-full aspect-[660/400] max-w-[660px] flex items-center justify-center">
        <svg viewBox="0 0 660 400" className="w-full h-full overflow-visible">
          <defs>
            <filter id="plate-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.12" />
            </filter>
            <filter id="center-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.08" />
            </filter>
          </defs>

          {/* Outer 3D Plate Disc */}
          <circle
            cx={cx}
            cy={cy}
            r={plateR}
            fill="#ffffff"
            stroke="#f1f5f9"
            strokeWidth="3"
            filter="url(#plate-shadow)"
          />

          {/* Donut Segment Slices */}
          {slices.map((s, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <path
                key={idx}
                d={s.pathD}
                fill={s.color}
                stroke="#ffffff"
                strokeWidth="2.5"
                className="cursor-pointer transition-all duration-200 hover:brightness-110"
                style={{ opacity: hoveredIdx === null || isHovered ? 1 : 0.7 }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}

          {/* Inner Central Disc */}
          <circle
            cx={cx}
            cy={cy}
            r={innerR - 1}
            fill="#ffffff"
            stroke="#e2e8f0"
            strokeWidth="2"
            filter="url(#center-shadow)"
          />
          <text
            x={cx}
            y={cy - 9}
            textAnchor="middle"
            className="fill-slate-400 font-black uppercase tracking-wider"
            style={{ fontSize: '13px' }}
          >
            Total Value
          </text>
          <text
            x={cx}
            y={cy + 20}
            textAnchor="middle"
            className="fill-slate-900 font-black"
            style={{ fontSize: '20px' }}
          >
            ৳ {Math.round(total).toLocaleString('en-IN')}
          </text>

          {/* Callout Lines & Text Labels */}
          {callouts.map((item) => {
            const isHovered = hoveredIdx === item.idx;
            const isRight = item.isRight;

            const elbowX = isRight ? item.dotX + 40 : item.dotX - 40;
            const elbowY = item.adjustedY;
            const targetX = isRight ? 535 : 125;

            return (
              <g
                key={`callout-${item.idx}`}
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredIdx(item.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ opacity: hoveredIdx === null || isHovered ? 1 : 0.65 }}
              >
                {/* Connecting Polyline */}
                <polyline
                  points={`${item.dotX},${item.dotY} ${elbowX},${elbowY} ${targetX},${elbowY}`}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Anchor Dot on Slice */}
                <circle cx={item.dotX} cy={item.dotY} r="6" fill="#1e293b" stroke="#ffffff" strokeWidth="2" />

                {/* Header Title & Subtitle */}
                <g transform={`translate(${isRight ? targetX + 12 : targetX - 12}, ${elbowY})`}>
                  <text
                    x="0"
                    y="-7"
                    textAnchor={isRight ? 'start' : 'end'}
                    fill={item.color}
                    className="font-black tracking-wide"
                    style={{ fontSize: '17px', fontWeight: 900 }}
                  >
                    {item.label}
                  </text>
                  <text
                    x="0"
                    y="18"
                    textAnchor={isRight ? 'start' : 'end'}
                    className="fill-slate-800 font-extrabold"
                    style={{ fontSize: '15px', fontWeight: 800 }}
                  >
                    ৳ {Math.round(item.value).toLocaleString('en-IN')} ({item.pct.toFixed(1)}%)
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

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

  // Cost of Goods states
  const [costOfGoodsRecords, setCostOfGoodsRecords] = useState([]);
  const [useActualCog, setUseActualCog] = useState(true);

  useEffect(() => {
    const fetchLCData = async () => {
      try {
        const [lcRes, expRes, insRes, stockRes, damageRes, cogRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/lc-management`),
          axios.get(`${API_BASE_URL}/api/lc-expenses`),
          axios.get(`${API_BASE_URL}/api/insurance-payments`),
          axios.get(`${API_BASE_URL}/api/stock`),
          axios.get(`${API_BASE_URL}/api/damages`),
          axios.get(`${API_BASE_URL}/api/cost-of-goods`)
        ]);
        setLcRecords(Array.isArray(lcRes.data) ? lcRes.data : []);
        setLcExpenses(Array.isArray(expRes.data) ? expRes.data : []);
        setInsurancePayments(Array.isArray(insRes.data) ? insRes.data : []);
        setStockRecords(Array.isArray(stockRes.data) ? stockRes.data : []);
        setDamages(Array.isArray(damageRes.data) ? damageRes.data : []);
        setCostOfGoodsRecords(Array.isArray(cogRes.data) ? cogRes.data : []);
      } catch (error) {
        console.error('Error fetching LC, expenses, stock, damage, and cost of goods data:', error);
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

  const getBankName = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      return val.bankName || val.name || val.shortName || '';
    }
    return String(val);
  };

  // Selected LC Details
  const selectedLc = useMemo(() => {
    if (!selectedLcNo || selectedLcNo === 'All') return null;
    return lcRecords.find(lc => (lc.lcNo || '').trim().toLowerCase() === selectedLcNo.trim().toLowerCase());
  }, [selectedLcNo, lcRecords]);

  // Filtered Cost of Goods records for selected LC
  const selectedLcCostOfGoods = useMemo(() => {
    if (!selectedLc) return [];
    const cleanLc = (val) => String(val || '').replace(/\D/g, '').toLowerCase();
    const lcNoClean = cleanLc(selectedLc.lcNo);
    return costOfGoodsRecords.filter(rec => cleanLc(rec.lcNo) === lcNoClean);
  }, [selectedLc, costOfGoodsRecords]);

  // Sum of netBill in BDT for these Cost of Goods records
  const totalLcCostOfGoodsAmount = useMemo(() => {
    const fallbackRate = selectedLc?.dollarRate || 0;
    return selectedLcCostOfGoods.reduce((sum, rec) => sum + getCogNetBillBdt(rec, fallbackRate), 0);
  }, [selectedLcCostOfGoods, selectedLc]);

  // Sum of quantity for these Cost of Goods records
  const totalLcCostOfGoodsQty = useMemo(() => {
    return selectedLcCostOfGoods.reduce((sum, rec) => sum + (parseFloat(rec.quantity) || 0), 0);
  }, [selectedLcCostOfGoods]);

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
      if (sDate) sDate.setHours(0, 0, 0, 0);
      if (eDate) eDate.setHours(23, 59, 59, 999);
      saleDate.setHours(0, 0, 0, 0);

      if (sDate && saleDate < sDate) return false;
      if (eDate && saleDate > eDate) return false;
      return true;
    }
    return true; // 'all'
  };

  // Process and Filter Sales & Stock Data
  const profitLossData = useMemo(() => {
    const hasLcFilter = selectedLcNo && selectedLcNo !== 'All' && selectedLcNo.trim() !== '';

    if (!hasLcFilter) {
      return {
        summary: {
          salesRevenue: 0,
          currentStockValue: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          margin: 0
        }
      };
    }

    let salesRevenue = 0;
    let totalCost = 0;

    salesRecords.forEach(sale => {
      // Filter by date (bypass if a specific LC is selected)
      if (!hasLcFilter && !isDateInRange(sale.date)) return;

      // Filter by Sale Type
      if (saleTypeFilter !== 'All' && sale.saleType !== saleTypeFilter) return;

      const items = sale.items || [];

      // Create flat list of entries for calculations
      const entries = items.flatMap(item => {
        const itemLcNo = (item.lcNo !== undefined && item.lcNo !== null) ? item.lcNo : (sale.lcNo || '');
        const brandEntries = (item.brandEntries && item.brandEntries.length > 0)
          ? item.brandEntries
          : [{ brandName: item.brand || '-', quantity: item.quantity, unitPrice: item.unitPrice || 0, totalAmount: item.totalAmount || 0 }];

        return brandEntries.map(entry => ({
          productName: item.productName || item.product || '-',
          brandName: entry.brandName || entry.brand || '-',
          quantity: parseFloat(entry.quantity) || 0,
          unitPrice: parseFloat(entry.unitPrice) || 0,
          totalAmount: parseFloat(entry.totalAmount) || (parseFloat(entry.quantity) * parseFloat(entry.unitPrice)) || 0,
          lcNo: (entry.lcNo !== undefined && entry.lcNo !== null) ? entry.lcNo : itemLcNo
        }));
      }).filter(entry => {
        // Filter by LC Number if specified
        if (selectedLcNo && selectedLcNo !== 'All' && selectedLcNo.trim() !== '') {
          const entryLcNo = (entry.lcNo || '').trim().toLowerCase();
          const searchLcNo = selectedLcNo.trim().toLowerCase();
          return entryLcNo.includes(searchLcNo);
        }
        return true;
      });

      // Filter by Product Name if specified
      const matchesProductFilter = selectedProduct === 'All' || entries.some(e => e.productName === selectedProduct);
      if (!matchesProductFilter) return;

      entries.forEach(entry => {
        if (selectedProduct !== 'All' && entry.productName !== selectedProduct) return;

        const purchasePrice = getPurchasePrice(entry.productName, entry.brandName);
        const itemCost = entry.quantity * purchasePrice;
        const itemRevenue = entry.totalAmount;

        salesRevenue += itemRevenue;
        totalCost += itemCost;
      });
    });

    // Calculate Current Stock Value (unsold stock in hand) matching active filters
    const cleanLc = (val) => String(val || '').replace(/\D/g, '').toLowerCase();
    const targetLcClean = hasLcFilter ? cleanLc(selectedLcNo) : '';

    const productStockMap = {};

    // 1. Aggregate stock arrivals
    stockRecords.forEach(item => {
      const status = (item.status || '').toLowerCase();
      if (status.includes('requested') || status.includes('rejected') || status.includes('deleted')) return;

      if (hasLcFilter && cleanLc(item.lcNo) !== targetLcClean) return;
      if (!hasLcFilter && !isDateInRange(item.date || item.createdAt || item.receiveDate)) return;

      const prodName = item.productName || item.product || 'Unknown Product';
      if (selectedProduct !== 'All' && prodName !== selectedProduct) return;

      if (!productStockMap[prodName]) {
        productStockMap[prodName] = { purchaseQty: 0, purchasePrice: 0, inhouseQty: 0, saleQty: 0, damageQty: 0, fallbackPrice: 0 };
      }

      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.purchasedPrice) || getPurchasePrice(prodName, item.brand);
      const shortQty = parseFloat(item.sweepedQuantity) || 0;
      const inhouseQty = (item.inHouseQuantity !== undefined && item.inHouseQuantity !== null)
        ? (parseFloat(item.inHouseQuantity) || 0)
        : Math.max(0, qty - shortQty);

      productStockMap[prodName].purchaseQty += qty;
      productStockMap[prodName].purchasePrice += qty * price;
      productStockMap[prodName].inhouseQty += inhouseQty;
      if (price) productStockMap[prodName].fallbackPrice = price;
    });

    // 2. Aggregate sales quantities for matching stock products
    salesRecords.forEach(sale => {
      const sStatus = (sale.status || '').toLowerCase();
      if (sStatus !== 'accepted' && sStatus !== 'pending') return;
      if (!hasLcFilter && !isDateInRange(sale.date)) return;
      if (saleTypeFilter !== 'All' && sale.saleType !== saleTypeFilter) return;

      (sale.items || []).forEach(item => {
        const itemLc = (item.lcNo !== undefined && item.lcNo !== null) ? item.lcNo : (sale.lcNo || '');
        const brandEntries = (item.brandEntries && item.brandEntries.length > 0)
          ? item.brandEntries
          : [{ brandName: item.brand || '-', quantity: item.quantity, lcNo: itemLc }];

        brandEntries.forEach(entry => {
          const entryLc = (entry.lcNo !== undefined && entry.lcNo !== null) ? entry.lcNo : itemLc;
          if (hasLcFilter && cleanLc(entryLc) !== targetLcClean) return;

          const prodName = item.productName || item.product || 'Unknown Product';
          if (selectedProduct !== 'All' && prodName !== selectedProduct) return;

          if (!productStockMap[prodName]) {
            productStockMap[prodName] = { purchaseQty: 0, purchasePrice: 0, inhouseQty: 0, saleQty: 0, damageQty: 0, fallbackPrice: getPurchasePrice(prodName) };
          }
          productStockMap[prodName].saleQty += parseFloat(entry.quantity) || 0;
        });
      });
    });

    // 3. Aggregate damage quantities
    damages.forEach(d => {
      if (hasLcFilter && cleanLc(d.lcNo) !== targetLcClean) return;
      if (!hasLcFilter && !isDateInRange(d.date || d.createdAt)) return;

      const prodName = d.productName || 'Unknown Product';
      if (selectedProduct !== 'All' && prodName !== selectedProduct) return;

      if (!productStockMap[prodName]) {
        productStockMap[prodName] = { purchaseQty: 0, purchasePrice: 0, inhouseQty: 0, saleQty: 0, damageQty: 0, fallbackPrice: parseFloat(d.price) || getPurchasePrice(prodName) };
      }
      productStockMap[prodName].damageQty += parseFloat(d.quantity) || 0;
    });

    // 4. Calculate Current Stock Value (in hand)
    let currentStockValue = 0;
    Object.values(productStockMap).forEach(prod => {
      const currentStockQty = Math.max(0, prod.inhouseQty - prod.saleQty - prod.damageQty);
      const avgPurchasePrice = prod.purchaseQty > 0 ? (prod.purchasePrice / prod.purchaseQty) : (prod.fallbackPrice || 0);
      currentStockValue += currentStockQty * avgPurchasePrice;
    });

    const finalRevenue = salesRevenue + currentStockValue;
    const finalCost = (useActualCog && selectedLc) ? totalLcCostOfGoodsAmount : totalCost;
    const totalProfit = finalRevenue - finalCost;
    const margin = finalRevenue > 0 ? (totalProfit / finalRevenue) * 100 : 0;

    return {
      summary: {
        salesRevenue,
        currentStockValue,
        totalRevenue: finalRevenue,
        totalCost: finalCost,
        totalProfit,
        margin
      }
    };
  }, [salesRecords, stockRecords, damages, products, filterType, selectedMonth, selectedYear, startDate, endDate, saleTypeFilter, selectedProduct, selectedLcNo, useActualCog, selectedLc, totalLcCostOfGoodsAmount]);

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
        bankName: getBankName(selectedLc.bankName) || 'Bank',
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
            bankName: getBankName(selectedLc.bankName) || 'Bank',
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

  // Adjusted LC values (Bill Value USD & Total BDT)
  const adjustedLcValues = useMemo(() => {
    if (!selectedLc) return null;
    return getAdjustedLcValues(selectedLc, stockRecords, salesRecords);
  }, [selectedLc, stockRecords, salesRecords]);

  // Sales records for the selected LC
  const selectedLcSales = useMemo(() => {
    if (!selectedLc || !selectedLc.lcNo) return [];
    const cleanLc = (val) => String(val || '').replace(/\D/g, '').toLowerCase();
    const lcNoClean = cleanLc(selectedLc.lcNo);
    if (!lcNoClean) return [];

    const list = [];
    (salesRecords || []).forEach(sale => {
      const sStatus = (sale.status || '').toLowerCase();
      if (sStatus !== 'accepted' && sStatus !== 'pending') return;

      const items = sale.items || [];
      items.forEach(item => {
        const itemLc = (item.lcNo !== undefined && item.lcNo !== null) ? item.lcNo : (sale.lcNo || '');
        const brandEntries = (item.brandEntries && item.brandEntries.length > 0)
          ? item.brandEntries
          : [{ brandName: item.brand || item.brandName || '-', quantity: item.quantity, unitPrice: item.unitPrice || 0, totalAmount: item.totalAmount || (parseFloat(item.quantity) * parseFloat(item.unitPrice)) || 0 }];

        brandEntries.forEach(entry => {
          const entryLc = (entry.lcNo !== undefined && entry.lcNo !== null) ? entry.lcNo : itemLc;
          if (cleanLc(entryLc) === lcNoClean) {
            const qty = parseFloat(entry.quantity) || 0;
            const unitPrice = parseFloat(entry.unitPrice) || 0;
            const totalAmount = parseFloat(entry.totalAmount) || (qty * unitPrice);
            list.push({
              _id: sale._id || `${sale.invoiceNo}_${item.productName}_${entry.brandName}`,
              date: sale.date || sale.createdAt,
              invoiceNo: sale.invoiceNo || sale.saleNo || '-',
              customerName: sale.customerName || sale.customer || 'General Sale',
              productName: item.productName || item.product || '-',
              brandName: entry.brandName || entry.brand || item.brand || '-',
              quantity: qty,
              unitPrice: unitPrice,
              totalAmount: totalAmount,
              saleType: sale.saleType || 'General'
            });
          }
        });
      });
    });

    return list;
  }, [selectedLc, salesRecords]);

  const totalLcSalesAmount = useMemo(() => {
    return selectedLcSales.reduce((sum, s) => sum + s.totalAmount, 0);
  }, [selectedLcSales]);

  const totalLcReceiveAmount = useMemo(() => {
    return selectedLcStocks.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const shortQty = parseFloat(item.sweepedQuantity) || 0;
      const inhouseQty = (item.inHouseQuantity !== undefined && item.inHouseQuantity !== null)
        ? (parseFloat(item.inHouseQuantity) || 0)
        : Math.max(0, qty - shortQty);
      const prodName = item.productName || item.product || '';
      const brandName = item.brand || item.brandName || '';
      const price = parseFloat(item.purchasedPrice) || getPurchasePrice(prodName, brandName);
      return sum + (inhouseQty * price);
    }, 0);
  }, [selectedLcStocks, products]);

  // Financial Breakdown 3D Pie Chart data for the selected LC
  const pieData = useMemo(() => {
    if (!selectedLc) return { total: 0, items: [] };

    const cog = totalLcCostOfGoodsAmount || 0;
    const exp = totalLcExpensesAmount || 0;
    const profit = Math.max(0, profitLossData.summary.totalProfit || 0);

    const rawItems = [
      { label: 'Cost of Goods (COG)', value: cog, color: '#3b82f6', darkColor: '#1d4ed8', bgClass: 'bg-blue-500', textClass: 'text-blue-600' },
      { label: 'LC Expenses', value: exp, color: '#f43f5e', darkColor: '#be123c', bgClass: 'bg-rose-500', textClass: 'text-rose-600' },
      { label: 'Net Profit', value: profit, color: '#10b981', darkColor: '#047857', bgClass: 'bg-emerald-500', textClass: 'text-emerald-600' },
    ];

    const items = rawItems.filter(item => item.value > 0);
    const total = items.reduce((sum, i) => sum + i.value, 0);

    if (total === 0) {
      return { total: 0, items: [] };
    }

    let currentAngle = -Math.PI / 2;
    const slices = items.map(item => {
      const pct = (item.value / total) * 100;
      const angle = (pct / 100) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle += angle;
      return { ...item, pct, startAngle, endAngle };
    });

    return { total, items: slices };
  }, [selectedLc, totalLcCostOfGoodsAmount, totalLcExpensesAmount, profitLossData.summary.totalProfit]);

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
        const itemLc = (item.lcNo !== undefined && item.lcNo !== null) ? item.lcNo : (sale.lcNo || '');

        const prodName = item.productName || item.product || 'Unknown Product';
        const brandEntries = (item.brandEntries && item.brandEntries.length > 0)
          ? item.brandEntries
          : [{ quantity: item.quantity, totalAmount: item.totalAmount || (parseFloat(item.quantity) * parseFloat(item.unitPrice)) || 0 }];

        brandEntries.forEach(entry => {
          const entryLc = (entry.lcNo !== undefined && entry.lcNo !== null) ? entry.lcNo : itemLc;
          if (cleanLc(entryLc) !== lcNoClean) return;

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
    generateProfitLossPDF({
      profitLossData,
      selectedLc,
      selectedLcExpenses,
      selectedLcCostOfGoods,
      selectedLcStocks,
      selectedLcSales,
      productSummary,
      totalLcExpensesAmount,
      totalLcCostOfGoodsAmount,
      totalLcCostOfGoodsQty,
      totalLcReceiveAmount,
      totalLcSalesAmount,
      filterType,
      selectedMonth,
      selectedYear,
      startDate,
      endDate,
      saleTypeFilter,
      selectedProduct,
      selectedLcNo,
      pieData
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-8 print:bg-white print:p-2 print:overflow-visible">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .print\\:grid-cols-2 {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 0.75rem !important;
          }
          .print\\:grid-cols-4 {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 0.5rem !important;
          }
          .print\\:min-h-0 {
            min-height: 0 !important;
          }
          .print\\:p-3 {
            padding: 0.75rem !important;
          }
          .print\\:py-2 {
            padding-top: 0.5rem !important;
            padding-bottom: 0.5rem !important;
          }
        }
      `}</style>

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
              className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center gap-2 px-3 rounded-xl transition-all border font-medium text-sm ${showFilterPanel || filterType !== 'monthly' || saleTypeFilter !== 'All' || selectedProduct !== 'All'
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
                      <CustomDatePicker
                        label="From Date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        compact={true}
                      />
                      <CustomDatePicker
                        label="To Date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        compact={true}
                        rightAlign={true}
                      />
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
        <div className="hidden print:block text-center space-y-1 border-b border-gray-300 pb-3 mb-3">
          <h1 className="text-2xl font-black text-gray-900">M/S ANI ENTERPRISE</h1>
          <p className="text-[10px] text-gray-500">766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh</p>
          <div className="text-sm font-bold text-gray-800 uppercase tracking-wider py-0.5 border border-gray-800 inline-block px-6 mt-1">PROFIT & LOSS STATEMENT</div>
          <p className="text-[10px] text-gray-600 mt-1 font-medium">
            Period: {filterType === 'monthly' ? `Month: ${selectedMonth}/${selectedYear}` : filterType === 'yearly' ? `Year: ${selectedYear}` : filterType === 'custom' ? `${startDate} to ${endDate}` : 'All Time'}
            {saleTypeFilter !== 'All' ? ` | Type: ${saleTypeFilter} Sales` : ''}
            {selectedProduct !== 'All' ? ` | Product: ${selectedProduct}` : ''}
            {selectedLcNo !== 'All' ? ` | LC No: ${selectedLcNo}` : ''}
          </p>
        </div>


        {/* Metrics Grid Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2 print:break-inside-avoid">

          {/* Metric 1: Total Revenue */}
          <div className="bg-white p-6 print:p-3 print:rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 print:w-10 print:h-10 bg-blue-500/5 rounded-bl-full flex items-start justify-end p-4 print:p-2 group-hover:scale-105 transition-transform">
              <DollarSignIcon className="w-6 h-6 print:w-4 print:h-4 text-blue-500" />
            </div>
            <div className="text-xs print:text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 print:mb-1">Total Revenue</div>
            <div className="text-xl sm:text-2xl print:text-base font-black text-gray-900">৳ {Math.round(profitLossData.summary.totalRevenue).toLocaleString('en-IN')}</div>
            <div className="text-[11px] print:text-[9px] mt-2.5 print:mt-1 flex items-center gap-1.5 flex-wrap font-semibold">
              {selectedLc ? (
                <>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-extrabold border border-blue-100/80 shadow-2xs">
                    Sales: ৳ {Math.round(profitLossData.summary.salesRevenue || 0).toLocaleString('en-IN')}
                  </span>
                  {profitLossData.summary.currentStockValue > 0 && (
                    <>
                      <span className="text-gray-400 font-black">+</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-extrabold border border-emerald-100/80 shadow-2xs">
                        Current Stock: ৳ {Math.round(profitLossData.summary.currentStockValue).toLocaleString('en-IN')}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-gray-400 font-medium">Select an LC No to view revenue</span>
              )}
            </div>
          </div>

          {/* Metric 2: Total COGS */}
          <div className="bg-white p-6 print:p-3 print:rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 print:w-10 print:h-10 bg-amber-500/5 rounded-bl-full flex items-start justify-end p-4 print:p-2 group-hover:scale-105 transition-transform">
              <ReceiptIcon className="w-6 h-6 print:w-4 print:h-4 text-amber-500" />
            </div>
            <div className="text-xs print:text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 print:mb-1">Cost of Goods Sold (COGS)</div>
            <div className="text-xl sm:text-2xl print:text-base font-black text-gray-900">৳ {Math.round(profitLossData.summary.totalCost).toLocaleString('en-IN')}</div>
            <div className="text-[11px] print:text-[9px] text-gray-400 mt-2 print:mt-1 font-medium">Calculated based on product costs</div>
          </div>

          {/* Metric 3: Gross Profit */}
          <div className="bg-white p-6 print:p-3 print:rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 print:w-10 print:h-10 bg-emerald-500/5 rounded-bl-full flex items-start justify-end p-4 print:p-2 group-hover:scale-105 transition-transform">
              <TrendingUpIcon className="w-6 h-6 print:w-4 print:h-4 text-emerald-500" />
            </div>
            <div className="text-xs print:text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 print:mb-1">Net Profit / Loss</div>
            <div className={`text-xl sm:text-2xl print:text-base font-black ${profitLossData.summary.totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              ৳ {Math.round(profitLossData.summary.totalProfit).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] print:text-[9px] text-gray-400 mt-2 print:mt-1 font-medium">Net profit before overheads</div>
          </div>

          {/* Metric 4: Profit Margin */}
          <div className="bg-white p-6 print:p-3 print:rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 print:w-10 print:h-10 bg-indigo-500/5 rounded-bl-full flex items-start justify-end p-4 print:p-2 group-hover:scale-105 transition-transform">
              <BarChartIcon className="w-6 h-6 print:w-4 print:h-4 text-indigo-500" />
            </div>
            <div className="text-xs print:text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 print:mb-1">Net Margin</div>
            <div className={`text-xl sm:text-2xl print:text-base font-black ${profitLossData.summary.totalProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
              {profitLossData.summary.margin.toFixed(2)} %
            </div>
            <div className="text-[11px] print:text-[9px] text-gray-400 mt-2 print:mt-1 font-medium">Percentage of revenue retained</div>
          </div>
        </div>

        {/* Row 1: LC Details (left 50%) | LC Expense (right 50%) */}
        <div className="flex flex-col lg:flex-row gap-4 mt-6 print:grid print:grid-cols-2 print:gap-3 print:mt-3 print:break-inside-avoid">

          {/* LEFT: LC Details Card — 50% */}
          <div className="w-full lg:w-[calc(50%-0.5rem)] flex flex-col">
            {selectedLc ? (
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-200 flex flex-col flex-1">
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
                        <div className="text-sm font-bold text-gray-800">{getBankName(selectedLc.bankName) || 'N/A'} {selectedLc.bankBranch ? `(${selectedLc.bankBranch})` : ''}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 font-black uppercase">Insurance Name</div>
                        <div className="text-sm font-bold text-gray-800">{selectedLc.insuranceCo || selectedLc.insuranceName || selectedLc.insuranceCompany || 'N/A'}</div>
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
                      {(() => {
                        const totalQtyKg = (parseFloat(selectedLc.quantity) || 0) * 1000;
                        const receiptsMap = {};
                        selectedLcStocks.forEach(s => {
                          const rawDate = s.date || s.receiveDate || s.createdAt || '';
                          const dateStr = typeof rawDate === 'string' && rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
                          const groupVal = s.totalLcQuantity || s.billOfEntry || s.totalLcTruck || s.truckNo || s.truck || 'single';
                          const key = `${dateStr}_${groupVal}`;
                          if (!receiptsMap[key]) {
                            const itemSubtotal = (s.entries || []).reduce((sum, e) => sum + (parseFloat(e.inHouseQuantity || e.quantity) || 0), 0);
                            receiptsMap[key] = parseFloat(s.totalLcQuantity) || itemSubtotal || parseFloat(s.inHouseQuantity) || parseFloat(s.quantity) || 0;
                          } else if (!s.totalLcQuantity) {
                            receiptsMap[key] += parseFloat(s.inHouseQuantity) || parseFloat(s.quantity) || 0;
                          }
                        });
                        const receiveQtyKg = Object.values(receiptsMap).reduce((sum, v) => sum + v, 0);
                        const balanceQtyKg = Math.max(0, totalQtyKg - receiveQtyKg);
                        const saleQtyKg = selectedLcSales.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);
                        const damageQtyKg = (productSummary || []).reduce((sum, p) => sum + (parseFloat(p.damageQty) || 0), 0);
                        const shortQtyKg = (productSummary || []).reduce((sum, p) => sum + (parseFloat(p.shortQty) || 0), 0);
                        const stockInHandKg = Math.max(0, receiveQtyKg - saleQtyKg - damageQtyKg - shortQtyKg);
                        return (
                          <div className="space-y-2 border-t border-gray-200/60 pt-2 mt-1">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="text-[10px] text-gray-400 font-black uppercase">Receive Qty</div>
                                <div className="text-sm font-black text-blue-600">{Math.round(receiveQtyKg).toLocaleString('en-US')} Kg</div>
                              </div>
                              <div>
                                <div className="text-[10px] text-gray-400 font-black uppercase">Balance</div>
                                <div className={`text-sm font-black ${balanceQtyKg <= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{Math.round(balanceQtyKg).toLocaleString('en-US')} Kg</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 border-t border-gray-200/40 pt-1.5">
                              <div>
                                <div className="text-[10px] text-gray-400 font-black uppercase">Sale Qty</div>
                                <div className="text-sm font-black text-emerald-600">{Math.round(saleQtyKg).toLocaleString('en-US')} Kg</div>
                              </div>
                              <div>
                                <div className="text-[10px] text-gray-400 font-black uppercase">Stock in Hand</div>
                                <div className="text-sm font-black text-purple-600">{Math.round(stockInHandKg).toLocaleString('en-US')} Kg</div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
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
                          <div className="text-xs font-black text-gray-800">৳ {((parseFloat(selectedLc.totalDollar || 0) * parseFloat(selectedLc.dollarRate || 0)) || parseFloat(selectedLc.totalAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                      </div>
                      <div className="border-t border-gray-200/60 pt-2 mt-1">
                        <div className="text-[10px] text-gray-400 font-black uppercase">Bill Value ($)</div>
                        <div className="text-sm font-black text-blue-600">$ {(adjustedLcValues?.billValueUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10px] text-gray-400 font-black uppercase">Exchange Rate</div>
                          <div className="text-xs font-semibold text-gray-800">{(adjustedLcValues?.dollarRate || selectedLc.dollarRate || 0)} BDT</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-400 font-black uppercase">Bill Total (BDT)</div>
                          <div className="text-xs font-black text-blue-600">৳ {parseFloat(adjustedLcValues?.adjustedTotalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
              <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm text-center min-h-[220px] flex-1 flex flex-col justify-center">
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mx-auto mb-4 animate-pulse">
                  <BarChartIcon className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-gray-900 mb-1">LC Details</h3>
                <p className="text-sm text-gray-500 max-w-sm mx-auto">Search or select an LC Number from the header input to inspect its details, margin status, products, and values.</p>
              </div>
            )}
          </div>

          {/* RIGHT: LC Expense (25%) + Financial Breakdown Pie Chart (25%) — side by side */}
          <div className="w-full lg:w-[calc(50%-0.5rem)] flex flex-col sm:flex-row gap-4">
            {selectedLc ? (
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-200 flex flex-col flex-1">
                <div className="px-6 py-5 border-b border-gray-200 bg-slate-50/50">
                  <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">LC Expense</h2>
                  <p className="text-xs text-gray-500 font-medium">Payments for LC No: <span className="text-blue-600 font-bold">{selectedLc.lcNo}</span></p>
                </div>
                <div className="overflow-x-auto min-h-[160px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Expense Head</th>
                        <th className="py-2.5 px-4 text-right font-black">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-medium">
                      {selectedLcExpenses.length === 0 ? (
                        <tr>
                          <td colSpan="2" className="py-8 text-center text-gray-400 font-semibold">No expenses found for this LC.</td>
                        </tr>
                      ) : (
                        selectedLcExpenses.map((exp, idx) => (
                          <tr key={`exp-${exp._id || idx}-${idx}`} className="hover:bg-slate-50/30 transition-colors">
                            <td className="py-2.5 px-4">
                              <div className="font-bold text-gray-950 break-words">{exp.expenseHead || '-'}</div>
                              <div className="text-[10px] text-gray-400 font-medium break-words">{getBankName(exp.cnfAgent) || getBankName(exp.bankName) || getBankName(exp.name) || formatDate(exp.date)}</div>
                            </td>
                            <td className="py-2.5 px-4 text-right font-black text-rose-600 whitespace-nowrap">৳ {Math.round(exp.amount).toLocaleString('en-IN')}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-black text-gray-500 uppercase tracking-wider">Total Expenses</span>
                  <span className="text-sm font-black text-rose-600">৳ {Math.round(totalLcExpensesAmount).toLocaleString('en-IN')}</span>
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 print:p-3 print:py-4 rounded-3xl border border-gray-200 shadow-sm text-center min-h-[220px] print:min-h-0 flex-1 flex flex-col justify-center">
                <div className="w-16 h-16 print:w-8 print:h-8 print:mb-2 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mx-auto mb-4 animate-pulse">
                  <BarChartIcon className="w-8 h-8 print:w-4 print:h-4" />
                </div>
                <h3 className="text-lg print:text-sm font-black text-gray-900 mb-1">LC Details</h3>
                <p className="text-sm print:text-xs text-gray-500 max-w-sm mx-auto">Search or select an LC Number from the header input to inspect its details, margin status, products, and values.</p>
              </div>
            )}

            {/* Financial Breakdown 3D Pie Chart (No Card) */}
            {selectedLc ? (
              <div className="animate-in fade-in duration-200 flex flex-col flex-1 items-center justify-center p-3 print:p-1">
                <ThreeDPieChart items={pieData.items} total={pieData.total} />
              </div>
            ) : (
              <div className="p-8 print:p-3 print:py-4 text-center min-h-[160px] print:min-h-0 flex-1 flex flex-col justify-center items-center">
                <div className="w-16 h-16 print:w-8 print:h-8 print:mb-2 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mb-4 animate-pulse">
                  <BarChartIcon className="w-8 h-8 print:w-4 print:h-4" />
                </div>
                <h3 className="text-lg print:text-sm font-black text-gray-900 mb-1">Financial 3D Pie Chart</h3>
                <p className="text-sm print:text-xs text-gray-500 max-w-sm mx-auto">Select an LC to view cost breakdown.</p>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: COG & LC Receive History (Left 50%) | Sales History & Product Stock (Right 50%) */}
        <div className="flex flex-col lg:flex-row gap-4 mt-6 print:grid print:grid-cols-2 print:gap-3 print:mt-3 print:break-inside-avoid">

          {/* LEFT 50%: Cost of Goods (COG) Card + LC Receive History Card (directly under COG) */}
          <div className="w-full lg:w-[calc(50%-0.5rem)] flex flex-col gap-4">

            {/* Cost of Goods (COG) Card */}
            {selectedLc ? (
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-200 flex flex-col">
                <div className="px-6 py-5 border-b border-gray-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">Cost of Goods (COG)</h2>
                    <p className="text-xs text-gray-500 font-medium">Actual costing records and net bills for LC No: <span className="text-blue-600 font-bold">{selectedLc.lcNo}</span></p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Use actual COG in P&L</span>
                    <input
                      type="checkbox"
                      checked={useActualCog}
                      onChange={(e) => setUseActualCog(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500/20 border-gray-300"
                    />
                  </label>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                        <th className="py-2.5 px-6">Date</th>
                        <th className="py-2.5 px-4">Invoice / Truck</th>
                        <th className="py-2.5 px-4">Product & Brand</th>
                        <th className="py-2.5 px-4 text-right">Cost/KG</th>
                        <th className="py-2.5 px-4 text-right">Quantity</th>
                        <th className="py-2.5 px-6 text-right font-black">Net Bill</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-medium">
                      {selectedLcCostOfGoods.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-gray-400 font-semibold">No Cost of Goods records found for this LC.</td>
                        </tr>
                      ) : (
                        selectedLcCostOfGoods.map((rec, idx) => {
                          const costingKgVal = rec.costingKg !== undefined && rec.costingKg !== null
                            ? parseFloat(rec.costingKg)
                            : (() => {
                              const billSum = rec.totalBill !== undefined ? rec.totalBill : ((parseFloat(rec.amount) || 0) + (parseFloat(rec.indTruckFare) || 0) + (parseFloat(rec.slofCf) || 0));
                              const rebatePct = rec.rebate !== undefined ? rec.rebate : (rec.redate !== undefined ? rec.redate : '2.9');
                              const rebateVal = rec.rebateAmount !== undefined ? rec.rebateAmount : (rec.redateAmount !== undefined ? rec.redateAmount : ((billSum * (parseFloat(rebatePct) || 0)) / 100));
                              const netBillVal = rec.netBill !== undefined ? rec.netBill : (billSum - rebateVal);
                              const qtyVal = parseFloat(rec.quantity) || 0;
                              const rateKgVal = qtyVal ? (netBillVal / qtyVal) : 0;
                              const dollarRateVal = parseFloat(rec.rsToDollar) || 0;
                              const rateKgUsdVal = dollarRateVal ? (rateKgVal / dollarRateVal) : 0;
                              const bdtRateVal = parseFloat(rec.dollarRateBdt) || 0;
                              const rateKgBdtVal = rateKgUsdVal * bdtRateVal;
                              const cfExpVal = rec.cfOtherExpense !== undefined ? rec.cfOtherExpense : '9';
                              return rateKgBdtVal + (parseFloat(cfExpVal) || 0);
                            })();

                          return (
                            <tr key={`cog-${rec._id || idx}-${idx}`} className="hover:bg-slate-50/30 transition-colors">
                              <td className="py-2.5 px-6 whitespace-nowrap text-gray-500">{formatDate(rec.date)}</td>
                              <td className="py-2.5 px-4">
                                <div className="font-black text-gray-900">{rec.invoiceNo || '-'}</div>
                                <div className="text-xs text-black font-semibold mt-0.5">{rec.truckNo || '-'}</div>
                              </td>
                              <td className="py-2.5 px-4">
                                <div className="font-black text-gray-900">{rec.product || '-'}</div>
                                <div className="text-xs text-black font-semibold mt-0.5">{rec.brand || '-'}</div>
                              </td>
                              <td className="py-2.5 px-4 text-right font-bold text-gray-900">৳{costingKgVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="py-2.5 px-4 text-right font-semibold text-gray-900">{parseFloat(rec.quantity || 0).toLocaleString()} KG</td>
                              <td className="py-2.5 px-6 text-right font-black text-blue-600">৳ {Math.round(costingKgVal * (parseFloat(rec.quantity) || 0)).toLocaleString('en-IN')}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {selectedLcCostOfGoods.length > 0 && (
                      <tfoot className="bg-slate-50 border-t-2 border-gray-200">
                        <tr className="text-xs">
                          <td colSpan="4" className="py-3.5 px-6 font-black text-gray-500 uppercase tracking-wider text-[11px]">Total COG</td>
                          <td className="py-3.5 px-4 text-right font-black text-gray-900 whitespace-nowrap">
                            {Math.round(totalLcCostOfGoodsQty).toLocaleString('en-US')} KG
                          </td>
                          <td className="py-3.5 px-6 text-right font-black text-blue-600 whitespace-nowrap">
                            ৳ {Math.round(totalLcCostOfGoodsAmount).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 print:p-3 print:py-4 rounded-3xl border border-gray-200 shadow-sm text-center min-h-[200px] print:min-h-0 flex-1 flex flex-col justify-center">
                <div className="w-16 h-16 print:w-8 print:h-8 print:mb-2 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mx-auto mb-4 animate-pulse">
                  <ReceiptIcon className="w-8 h-8 print:w-4 print:h-4" />
                </div>
                <h3 className="text-lg print:text-sm font-black text-gray-900 mb-1">Cost of Goods (COG)</h3>
                <p className="text-sm print:text-xs text-gray-500 max-w-sm mx-auto">Select an LC Number from the header input to inspect all related Cost of Goods records, invoicing details, and actual costs.</p>
              </div>
            )}

            {/* LC Receive History Card (Under COG) */}
            {selectedLc ? (
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-200 flex flex-col">
                <div className="px-6 py-5 border-b border-gray-200 bg-slate-50/50">
                  <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">LC Receive History</h2>
                  <p className="text-xs text-gray-500 font-medium">Stock receive records for LC No: <span className="text-blue-600 font-bold">{selectedLc.lcNo}</span></p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Product & Brand</th>
                        <th className="py-2.5 px-3 text-right">Arrival Qty</th>
                        <th className="py-2.5 px-3 text-right">Short</th>
                        <th className="py-2.5 px-3 text-right">Inhouse Qty</th>
                        <th className="py-2.5 px-4 text-right font-black">Total Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-medium">
                      {selectedLcStocks.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-gray-400 font-semibold">No stock receive records found for this LC.</td>
                        </tr>
                      ) : (
                        selectedLcStocks.map((item, idx) => {
                          const qty = parseFloat(item.quantity) || 0;
                          const shortQty = parseFloat(item.sweepedQuantity) || 0;
                          const inhouseQty = (item.inHouseQuantity !== undefined && item.inHouseQuantity !== null)
                            ? (parseFloat(item.inHouseQuantity) || 0)
                            : Math.max(0, qty - shortQty);
                          const prodName = item.productName || item.product || '-';
                          const brandName = item.brand || item.brandName || '-';
                          const price = parseFloat(item.purchasedPrice) || getPurchasePrice(prodName, brandName);
                          const totalVal = inhouseQty * price;
                          const dateStr = item.date || item.createdAt || item.receiveDate;

                          return (
                            <tr key={`stock-${item._id || idx}-${idx}`} className="hover:bg-slate-50/30 transition-colors">
                              <td className="py-2.5 px-4">
                                <div className="font-bold text-gray-950 whitespace-nowrap">{formatDate(dateStr)}</div>
                              </td>
                              <td className="py-2.5 px-4">
                                <div className="font-bold text-gray-950 break-words">{prodName}</div>
                                <div className="text-[10px] text-gray-400 font-medium break-words">{brandName}</div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-gray-900 whitespace-nowrap">
                                {Math.round(qty).toLocaleString()} KG
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-rose-600 whitespace-nowrap">
                                {shortQty > 0 ? `${Math.round(shortQty).toLocaleString()} KG` : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                                {Math.round(inhouseQty).toLocaleString()} KG
                              </td>
                              <td className="py-2.5 px-4 text-right font-black text-blue-600 whitespace-nowrap">
                                ৳ {Math.round(totalVal).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {selectedLcStocks.length > 0 && (
                      <tfoot className="bg-slate-50 border-t-2 border-gray-200">
                        <tr className="text-xs">
                          <td colSpan="2" className="py-3.5 px-4 font-black text-gray-500 uppercase tracking-wider text-[11px]">Total Received</td>
                          <td className="py-3.5 px-3 text-right font-black text-gray-900 whitespace-nowrap">
                            {Math.round(selectedLcStocks.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0)).toLocaleString()} KG
                          </td>
                          <td className="py-3.5 px-3 text-right font-black text-rose-600 whitespace-nowrap">
                            {Math.round(selectedLcStocks.reduce((sum, i) => sum + (parseFloat(i.sweepedQuantity) || 0), 0)).toLocaleString()} KG
                          </td>
                          <td className="py-3.5 px-3 text-right font-black text-emerald-600 whitespace-nowrap">
                            {Math.round(selectedLcStocks.reduce((sum, i) => {
                              const q = parseFloat(i.quantity) || 0;
                              const s = parseFloat(i.sweepedQuantity) || 0;
                              const inh = (i.inHouseQuantity !== undefined && i.inHouseQuantity !== null) ? parseFloat(i.inHouseQuantity) || 0 : Math.max(0, q - s);
                              return sum + inh;
                            }, 0)).toLocaleString()} KG
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-blue-600 whitespace-nowrap">
                            ৳ {Math.round(totalLcReceiveAmount).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 print:p-3 print:py-4 rounded-3xl border border-gray-200 shadow-sm text-center min-h-[160px] print:min-h-0 flex-1 flex flex-col justify-center">
                <div className="w-16 h-16 print:w-8 print:h-8 print:mb-2 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mx-auto mb-4 animate-pulse">
                  <BoxIcon className="w-8 h-8 print:w-4 print:h-4" />
                </div>
                <h3 className="text-lg print:text-sm font-black text-gray-900 mb-1">LC Receive History</h3>
                <p className="text-sm print:text-xs text-gray-500 max-w-sm mx-auto">Select an LC to view stock receive history.</p>
              </div>
            )}
          </div>

          {/* RIGHT 50%: Sales History (25%) + Product Stock & Arrivals (25%) — side by side */}
          <div className="w-full lg:w-[calc(50%-0.5rem)] flex flex-col sm:flex-row gap-4">

            {/* Sales History Card */}
            {selectedLc ? (
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-200 flex flex-col">
                <div className="px-6 py-5 border-b border-gray-200 bg-slate-50/50">
                  <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">Sales History</h2>
                  <p className="text-xs text-gray-500 font-medium">Sales records for LC No: <span className="text-blue-600 font-bold">{selectedLc.lcNo}</span></p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Invoice / Customer</th>
                        <th className="py-2.5 px-4">Product & Brand</th>
                        <th className="py-2.5 px-4 text-right">Qty</th>
                        <th className="py-2.5 px-4 text-right font-black">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-medium">
                      {selectedLcSales.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="py-8 text-center text-gray-400 font-semibold">No sales history found for this LC.</td>
                        </tr>
                      ) : (
                        selectedLcSales.map((sale, idx) => (
                          <tr key={`sale-${sale._id || idx}-${idx}`} className="hover:bg-slate-50/30 transition-colors">
                            <td className="py-2.5 px-4">
                              <div className="font-bold text-gray-950 break-words">{sale.invoiceNo}</div>
                              <div className="text-[10px] text-gray-400 font-medium break-words">{sale.customerName} • {formatDate(sale.date)}</div>
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="font-bold text-gray-950 break-words">{sale.productName}</div>
                              <div className="text-[10px] text-gray-400 font-medium break-words">{sale.brandName}</div>
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-gray-900 whitespace-nowrap">
                              {sale.quantity.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right font-black text-emerald-600 whitespace-nowrap">
                              ৳ {Math.round(sale.totalAmount).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-black text-gray-500 uppercase tracking-wider">Total Sales</span>
                  <span className="text-sm font-black text-emerald-600">৳ {Math.round(totalLcSalesAmount).toLocaleString('en-IN')}</span>
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 print:p-3 print:py-4 rounded-3xl border border-gray-200 shadow-sm text-center min-h-[160px] print:min-h-0 flex-1 flex flex-col justify-center">
                <div className="w-16 h-16 print:w-8 print:h-8 print:mb-2 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 mx-auto mb-4 animate-pulse">
                  <TrendingUpIcon className="w-8 h-8 print:w-4 print:h-4" />
                </div>
                <h3 className="text-lg print:text-sm font-black text-gray-900 mb-1">Sales History</h3>
                <p className="text-sm print:text-xs text-gray-500 max-w-sm mx-auto">Select an LC to view sales history.</p>
              </div>
            )}

            {/* Product Stock & Arrivals Card */}
            {selectedLc ? (
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-200 flex flex-col">
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
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-blue-100 hover:bg-blue-50/10 transition-all">
                            <div className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Purchase (Total Arrival)</div>
                            <div className="text-sm font-black text-gray-900">{Math.round(prod.purchaseQty).toLocaleString()} {prod.unit}</div>
                            <div className="text-sm font-bold text-blue-600 mt-1">৳ {Math.round(prod.purchasePrice).toLocaleString('en-IN')}</div>
                          </div>
                          {/* Inhouse Quantity */}
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/10 transition-all">
                            <div className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Inhouse Quantity</div>
                            <div className="text-sm font-black text-gray-900">{Math.round(prod.inhouseQty).toLocaleString()} {prod.unit}</div>
                            <div className="text-sm font-bold text-emerald-600 mt-1">৳ {Math.round(prod.inhousePrice).toLocaleString('en-IN')}</div>
                          </div>
                          {/* Short Quantity */}
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-amber-100 hover:bg-amber-50/10 transition-all">
                            <div className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Short Quantity</div>
                            <div className="text-sm font-black text-rose-600">{Math.round(prod.shortQty).toLocaleString()} {prod.unit}</div>
                            <div className="text-sm font-bold text-amber-600 mt-1">৳ {Math.round(prod.shortPrice).toLocaleString('en-IN')}</div>
                          </div>
                          {/* Damage Quantity */}
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-rose-100 hover:bg-rose-50/10 transition-all">
                            <div className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Damage Quantity</div>
                            <div className="text-sm font-black text-rose-700">{Math.round(prod.damageQty).toLocaleString()} {prod.unit}</div>
                            <div className="text-sm font-bold text-rose-500 mt-1">৳ {Math.round(prod.damagePrice).toLocaleString('en-IN')}</div>
                          </div>
                          {/* Sold Quantity */}
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-violet-100 hover:bg-violet-50/10 transition-all">
                            <div className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Sold Quantity</div>
                            <div className="text-sm font-black text-gray-900">{Math.round(prod.saleQty || 0).toLocaleString()} {prod.unit}</div>
                            <div className="text-sm font-bold text-violet-600 mt-1">৳ {Math.round(prod.salePrice || 0).toLocaleString('en-IN')}</div>
                          </div>
                          {/* Current Stock */}
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/10 transition-all">
                            <div className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Current Stock</div>
                            <div className="text-sm font-black text-gray-900">{Math.round(prod.inhouseQty - (prod.saleQty || 0) - (prod.damageQty || 0)).toLocaleString()} {prod.unit}</div>
                            <div className="text-sm font-bold text-indigo-600 mt-1">
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
              <div className="bg-white p-8 print:p-3 print:py-4 rounded-3xl border border-gray-200 shadow-sm text-center min-h-[220px] print:min-h-0 flex-1 flex flex-col justify-center">
                <div className="w-16 h-16 print:w-8 print:h-8 print:mb-2 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mx-auto mb-4 animate-pulse">
                  <BoxIcon className="w-8 h-8 print:w-4 print:h-4" />
                </div>
                <h3 className="text-lg print:text-sm font-black text-gray-900 mb-1">Product Stock & Arrivals</h3>
                <p className="text-sm print:text-xs text-gray-500 max-w-sm mx-auto">Select an LC Number from the header input to analyze product quantities, inhouse stock, shortage amounts, and damages.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
