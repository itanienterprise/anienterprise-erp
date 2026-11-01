import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  BarChartIcon, FunnelIcon, TrendingUpIcon, PrinterIcon,
  DollarSignIcon, ReceiptIcon, SearchIcon, XIcon, BoxIcon
} from '../../Icons';
import axios from '../../../utils/api';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import { getAdjustedLcValues, getCogNetBillBdt, getRecCostingKg, calculateLcConclusion } from '../../../utils/lcValueUtils';
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

  const cx = 360;
  const cy = 200;
  const outerR = 175;
  const innerR = 92;
  const plateR = 188;

  // Compute Donut Slice Paths
  const slices = items.map((item, idx) => {
    const midAngle = (item.startAngle + item.endAngle) / 2;
    const isHovered = hoveredIdx === idx;
    const explodeDist = isHovered ? 5 : 0;

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
      <div className="relative w-full aspect-[780/400] min-h-[220px] sm:min-h-[260px] flex items-center justify-center">
        <svg viewBox="-30 0 780 400" className="w-full h-full overflow-visible">
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
            strokeWidth="2.5"
            filter="url(#center-shadow)"
          />
          <text
            x={cx}
            y={cy - 12}
            textAnchor="middle"
            className="fill-slate-400 font-black uppercase tracking-wider"
            style={{ fontSize: '15px', fontWeight: 900 }}
          >
            TOTAL VALUE
          </text>
          <text
            x={cx}
            y={cy + 24}
            textAnchor="middle"
            className="fill-slate-900 font-black"
            style={{ fontSize: Math.round(total).toLocaleString('en-IN').length > 12 ? '22px' : '26px', fontWeight: 900 }}
          >
            ৳ {Math.round(total).toLocaleString('en-IN')}
          </text>

          {/* Callout Lines & Text Labels */}
          {callouts.map((item) => {
            const isHovered = hoveredIdx === item.idx;
            const isRight = item.isRight;

            const elbowX = isRight ? Math.min(535, Math.max(450, item.dotX + 30)) : Math.max(185, Math.min(270, item.dotX - 30));
            const elbowY = item.adjustedY;
            const targetX = isRight ? 545 : 175;

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
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Anchor Dot on Slice */}
                <circle cx={item.dotX} cy={item.dotY} r="6" fill="#1e293b" stroke="#ffffff" strokeWidth="2" />

                {/* Header Title & Subtitle */}
                <g transform={`translate(${isRight ? targetX + 10 : targetX - 10}, ${elbowY})`}>
                  <text
                    x="0"
                    y="-8"
                    textAnchor={isRight ? 'start' : 'end'}
                    fill={item.color}
                    className="font-black tracking-wide"
                    style={{ fontSize: '19px', fontWeight: 900 }}
                  >
                    {item.label}
                  </text>
                  <text
                    x="0"
                    y="18"
                    textAnchor={isRight ? 'start' : 'end'}
                    className="fill-slate-800 font-extrabold"
                    style={{ fontSize: '17px', fontWeight: 800 }}
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

// Helper to compute net sale quantity for an entry taking into account returns
const calculateNetSaleQty = (sale, item, entry, returnMap = {}) => {
  const invRef = (sale.invoiceNo || sale.saleNo || '').trim().toUpperCase();
  const pName = (item.productName || item.product || '').trim().toLowerCase();
  const bName = (entry.brandName || entry.brand || item.brand || '').trim().toLowerCase();
  const entryRetQty = parseFloat(entry.returnQty) || 0;
  const listRetQty = returnMap[`${invRef}_${pName}_${bName}`] || returnMap[`${invRef}_${pName}`] || 0;
  const totalRet = Math.max(entryRetQty, listRetQty);

  const orig = parseFloat(entry.originalQuantity) || 0;
  const rawQty = parseFloat(entry.quantity) || 0;
  const baseQty = (orig > 0 && orig >= rawQty) ? orig : rawQty;
  const netQty = totalRet > 0 ? Math.max(0, baseQty - totalRet) : rawQty;
  return { netQty, totalRet };
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
  const [returnsRecords, setReturnsRecords] = useState([]);
  const [expandedCogIds, setExpandedCogIds] = useState(new Set());
  const [expandedSalesIds, setExpandedSalesIds] = useState(new Set());
  const [expandedReceiveIds, setExpandedReceiveIds] = useState(new Set());

  const toggleExpandCog = (id) => {
    setExpandedCogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandSales = (id) => {
    setExpandedSalesIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandReceive = (id) => {
    setExpandedReceiveIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Lookup map of return quantities for fast matching by invoice, product, brand
  const returnQtyMap = useMemo(() => {
    const map = {};
    (returnsRecords || []).forEach(r => {
      const rStatus = (r.status || '').toLowerCase();
      if (rStatus === 'cancelled' || rStatus === 'rejected') return;
      const inv = (r.invoiceNo || '').trim().toUpperCase();
      const p = (r.productName || r.product || '').trim().toLowerCase();
      const b = (r.brandName || r.brand || '').trim().toLowerCase();
      const q = parseFloat(r.quantity) || 0;
      if (q > 0 && inv) {
        if (p && b) map[`${inv}_${p}_${b}`] = (map[`${inv}_${p}_${b}`] || 0) + q;
        if (p) map[`${inv}_${p}`] = (map[`${inv}_${p}`] || 0) + q;
        map[inv] = (map[inv] || 0) + q;
      }
    });
    return map;
  }, [returnsRecords]);

  // Cost of Goods states
  const [costOfGoodsRecords, setCostOfGoodsRecords] = useState([]);
  const [useActualCog, setUseActualCog] = useState(true);
  const [cogProductFilter, setCogProductFilter] = useState('ALL');
  const [salesProductFilter, setSalesProductFilter] = useState('ALL');

  useEffect(() => {
    setCogProductFilter('ALL');
    setSalesProductFilter('ALL');
  }, [selectedLcNo]);

  useEffect(() => {
    const fetchLCData = async () => {
      try {
        const [lcRes, expRes, insRes, stockRes, damageRes, cogRes, retRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/lc-management`),
          axios.get(`${API_BASE_URL}/api/lc-expenses`),
          axios.get(`${API_BASE_URL}/api/insurance-payments`),
          axios.get(`${API_BASE_URL}/api/stock`),
          axios.get(`${API_BASE_URL}/api/damages`),
          axios.get(`${API_BASE_URL}/api/cost-of-goods`),
          axios.get(`${API_BASE_URL}/api/returns`).catch(() => ({ data: [] }))
        ]);
        setLcRecords(Array.isArray(lcRes.data) ? lcRes.data : []);
        setLcExpenses(Array.isArray(expRes.data) ? expRes.data : []);
        setInsurancePayments(Array.isArray(insRes.data) ? insRes.data : []);
        setStockRecords(Array.isArray(stockRes.data) ? stockRes.data : []);
        setDamages(Array.isArray(damageRes.data) ? damageRes.data : []);
        setCostOfGoodsRecords(Array.isArray(cogRes.data) ? cogRes.data : []);
        setReturnsRecords(Array.isArray(retRes?.data) ? retRes.data : []);
      } catch (error) {
        console.error('Error fetching LC, expenses, stock, damage, returns, and cost of goods data:', error);
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

  // Group Cost of Goods records by product (product-based)
  const cogByProduct = useMemo(() => {
    if (!selectedLcCostOfGoods || selectedLcCostOfGoods.length === 0) return [];
    const map = {};
    selectedLcCostOfGoods.forEach(rec => {
      const prodName = (rec.product || 'Other Products').trim();
      if (!map[prodName]) {
        map[prodName] = {
          productName: prodName,
          records: [],
          totalQty: 0,
          totalNetBill: 0,
        };
      }
      const costingKgVal = getRecCostingKg(rec);
      const rowQty = parseFloat(rec.quantity || 0);
      const rowNetBill = Math.round(costingKgVal * rowQty);

      map[prodName].records.push({
        ...rec,
        costingKgVal,
        rowQty,
        rowNetBill
      });
      map[prodName].totalQty += rowQty;
      map[prodName].totalNetBill += rowNetBill;
    });

    return Object.values(map).map(group => ({
      ...group,
      avgCostKg: group.totalQty > 0 ? (group.totalNetBill / group.totalQty) : 0
    }));
  }, [selectedLcCostOfGoods]);

  // Insurance premium for selected LC
  const selectedLcInsuranceAmount = useMemo(() => {
    if (!selectedLc) return 0;
    const cleanLc = (val) => String(val || '').replace(/\D/g, '').toLowerCase();
    const lcNoClean = cleanLc(selectedLc.lcNo);
    const insPayments = (insurancePayments || []).filter(p => cleanLc(p.lcNo) === lcNoClean && p.type !== 'Return Collection');
    const paymentSum = insPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0) + (parseFloat(p.adjustedAmount) || 0), 0);
    return paymentSum || parseFloat(selectedLc.insurance || selectedLc.netPremium || selectedLc.grossPremium || 0);
  }, [selectedLc, insurancePayments]);

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
    return stockRecords
      .filter(item => {
        const status = (item.status || '').toLowerCase();
        if (status.includes('requested') || status.includes('rejected') || status.includes('deleted')) return false;
        return cleanLc(item.lcNo) === lcNoClean;
      })
      .map(item => {
        let invNo = item.invoiceNo ? String(item.invoiceNo).trim() : '';
        if (!invNo && costOfGoodsRecords && costOfGoodsRecords.length > 0) {
          const prodName = (item.productName || item.product || '').trim().toLowerCase();
          const brandName = (item.brand || item.brandName || '').trim().toLowerCase();
          const matchedWithTruck = costOfGoodsRecords.find(cog => {
            const lcMatch = cleanLc(cog.lcNo) === lcNoClean;
            const pMatch = (cog.product || '').trim().toLowerCase() === prodName;
            const bMatch = (cog.brand || '').trim().toLowerCase() === brandName;
            const tMatch = item.truckNo && cog.truckNo && String(cog.truckNo).trim().toLowerCase() === String(item.truckNo).trim().toLowerCase();
            return lcMatch && pMatch && bMatch && tMatch && cog.invoiceNo;
          });
          if (matchedWithTruck) {
            invNo = matchedWithTruck.invoiceNo;
          } else {
            const matched = costOfGoodsRecords.find(cog => {
              const lcMatch = cleanLc(cog.lcNo) === lcNoClean;
              const pMatch = (cog.product || '').trim().toLowerCase() === prodName;
              const bMatch = (cog.brand || '').trim().toLowerCase() === brandName;
              return lcMatch && pMatch && bMatch && cog.invoiceNo;
            });
            if (matched) {
              invNo = matched.invoiceNo;
            } else {
              const matchedProd = costOfGoodsRecords.find(cog => {
                const lcMatch = cleanLc(cog.lcNo) === lcNoClean;
                const pMatch = (cog.product || '').trim().toLowerCase() === prodName;
                return lcMatch && pMatch && cog.invoiceNo;
              });
              if (matchedProd) invNo = matchedProd.invoiceNo;
            }
          }
        }
        return {
          ...item,
          invoiceNo: invNo || item.invoiceNo || ''
        };
      });
  }, [selectedLc, stockRecords, costOfGoodsRecords]);

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

  // Sales records for the selected LC (without returns / net active sales)
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
            const { netQty, totalRet } = calculateNetSaleQty(sale, item, entry, returnQtyMap);
            if (netQty <= 0) return; // Skip 0 quantity (e.g. fully returned sales) from active sales
            const unitPrice = parseFloat(entry.unitPrice) || 0;
            const totalAmount = netQty * unitPrice;
            list.push({
              _id: sale._id || `${sale.invoiceNo}_${item.productName}_${entry.brandName}`,
              date: sale.date || sale.createdAt,
              invoiceNo: sale.invoiceNo || sale.saleNo || '-',
              customerName: sale.customerName || sale.customer || 'General Sale',
              productName: item.productName || item.product || '-',
              brandName: entry.brandName || entry.brand || item.brand || '-',
              quantity: netQty,
              returnedQty: totalRet,
              unitPrice: unitPrice,
              totalAmount: totalAmount,
              saleType: sale.saleType || 'General'
            });
          }
        });
      });
    });

    return list;
  }, [selectedLc, salesRecords, returnQtyMap]);

  // Group Sales records by product for product tabs and filtering
  const salesByProduct = useMemo(() => {
    if (!selectedLcSales || selectedLcSales.length === 0) return [];
    const map = {};
    selectedLcSales.forEach(sale => {
      const prodName = (sale.productName || 'Other Products').trim();
      if (!map[prodName]) {
        map[prodName] = {
          productName: prodName,
          records: [],
          totalQty: 0,
          totalAmount: 0
        };
      }
      map[prodName].records.push(sale);
      map[prodName].totalQty += parseFloat(sale.quantity) || 0;
      map[prodName].totalAmount += parseFloat(sale.totalAmount) || 0;
    });
    return Object.values(map);
  }, [selectedLcSales]);

  // Return sales records for the selected LC
  const selectedLcReturns = useMemo(() => {
    if (!selectedLc || !selectedLc.lcNo) return [];
    const cleanLc = (val) => String(val || '').replace(/\D/g, '').toLowerCase();
    const lcNoClean = cleanLc(selectedLc.lcNo);
    if (!lcNoClean) return [];

    // Collect all invoice numbers belonging to this LC from sales
    const lcInvoiceSet = new Set();
    (salesRecords || []).forEach(sale => {
      (sale.items || []).forEach(item => {
        const itemLc = (item.lcNo !== undefined && item.lcNo !== null) ? item.lcNo : (sale.lcNo || '');
        (item.brandEntries || [{ lcNo: itemLc }]).forEach(be => {
          const entryLc = (be.lcNo !== undefined && be.lcNo !== null) ? be.lcNo : itemLc;
          if (cleanLc(entryLc) === lcNoClean && sale.invoiceNo) {
            lcInvoiceSet.add(sale.invoiceNo.trim().toUpperCase());
          }
        });
      });
    });

    const list = [];
    const seenKeys = new Set();

    // 1. From returnsRecords (/api/returns)
    (returnsRecords || []).forEach(r => {
      const rLc = cleanLc(r.lcNo);
      const rInv = (r.invoiceNo || '').trim().toUpperCase();
      if (rLc === lcNoClean || (rInv && lcInvoiceSet.has(rInv))) {
        const prodName = r.productName || r.product || '-';
        const brandName = r.brand || r.brandName || '-';
        const key = `${r.invoiceNo}_${prodName}_${brandName}`.toUpperCase();
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const qty = parseFloat(r.quantity) || 0;
          const price = parseFloat(r.returnPrice || r.unitPrice || r.rate) || 0;
          const totalAmount = parseFloat(r.totalAmount) || (qty * price);
          list.push({
            _id: r._id || key,
            invoiceNo: r.invoiceNo || '-',
            customerName: r.customerName || r.companyName || '-',
            date: r.date || r.createdAt || r.invoiceDate,
            productName: prodName,
            brandName: brandName,
            quantity: qty,
            unitPrice: price,
            totalAmount: totalAmount,
            reason: r.reason || ''
          });
        }
      }
    });

    // 2. Also check if any sales record brandEntry has returnQty > 0 that was not in returnsRecords
    (salesRecords || []).forEach(sale => {
      (sale.items || []).forEach(item => {
        const itemLc = (item.lcNo !== undefined && item.lcNo !== null) ? item.lcNo : (sale.lcNo || '');
        (item.brandEntries || []).forEach(entry => {
          const entryLc = (entry.lcNo !== undefined && entry.lcNo !== null) ? entry.lcNo : itemLc;
          if (cleanLc(entryLc) === lcNoClean) {
            const retQty = parseFloat(entry.returnQty) || 0;
            if (retQty > 0) {
              const prodName = item.productName || item.product || '-';
              const brandName = entry.brandName || entry.brand || '-';
              const key = `${sale.invoiceNo}_${prodName}_${brandName}`.toUpperCase();
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                const price = parseFloat(entry.unitPrice || entry.rate) || 0;
                list.push({
                  _id: `ret-${sale._id}_${prodName}_${brandName}`,
                  invoiceNo: sale.invoiceNo || '-',
                  customerName: sale.customerName || sale.customer || '-',
                  date: sale.date || sale.createdAt,
                  productName: prodName,
                  brandName: brandName,
                  quantity: retQty,
                  unitPrice: price,
                  totalAmount: retQty * price,
                  reason: 'Returned'
                });
              }
            }
          }
        });
      });
    });

    return list;
  }, [selectedLc, returnsRecords, salesRecords]);

  const totalLcReturnsAmount = useMemo(() => {
    return selectedLcReturns.reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);
  }, [selectedLcReturns]);

  const totalLcReturnsQty = useMemo(() => {
    return selectedLcReturns.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
  }, [selectedLcReturns]);

  const totalLcSalesAmount = useMemo(() => {
    return selectedLcSales.reduce((sum, s) => sum + s.totalAmount, 0);
  }, [selectedLcSales]);

  const totalLcSalesQty = useMemo(() => {
    return selectedLcSales.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);
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

          const { netQty } = calculateNetSaleQty(sale, item, entry, returnQtyMap);
          if (netQty <= 0) return;

          const unitPrice = parseFloat(entry.unitPrice) || 0;
          const totalAmount = netQty * unitPrice;
          summaryMap[prodName].saleQty += netQty;
          summaryMap[prodName].salePrice += totalAmount;
        });
      });
    });

    return Object.values(summaryMap);
  }, [selectedLc, selectedLcStocks, selectedLcDamages, salesRecords, returnQtyMap]);

  // LC Conclusion summary statement data matching the conclusion sheet
  const conclusionData = useMemo(() => {
    if (!selectedLc) return null;
    return calculateLcConclusion({
      selectedLc,
      adjustedLcValues,
      selectedLcCostOfGoods,
      totalLcCostOfGoodsQty,
      totalLcCostOfGoodsAmount,
      selectedLcExpenses,
      totalLcExpensesAmount,
      selectedLcStocks,
      selectedLcSales,
      totalLcSalesAmount,
      totalLcSalesQty,
      productSummary,
      selectedLcDamages
    });
  }, [
    selectedLc,
    adjustedLcValues,
    selectedLcCostOfGoods,
    totalLcCostOfGoodsQty,
    totalLcCostOfGoodsAmount,
    selectedLcExpenses,
    totalLcExpensesAmount,
    selectedLcStocks,
    selectedLcSales,
    totalLcSalesAmount,
    totalLcSalesQty,
    productSummary,
    selectedLcDamages
  ]);

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

  // Helper to get product-wise average cost (COG cost if available, otherwise inhouse/purchase cost)
  const getProductAvgCost = (prodName, prodSummaryItem = null) => {
    const clean = (val) => String(val || '').trim().toLowerCase();
    const targetClean = clean(prodName);

    // 1. Check Cost of Goods (COG)
    if (useActualCog && selectedLcCostOfGoods && selectedLcCostOfGoods.length > 0) {
      const matchingCog = selectedLcCostOfGoods.filter(rec => clean(rec.product) === targetClean);
      if (matchingCog.length > 0) {
        let totalQty = 0;
        let totalBill = 0;
        matchingCog.forEach(rec => {
          const costingKg = getRecCostingKg(rec);
          const q = parseFloat(rec.quantity) || 0;
          totalQty += q;
          totalBill += Math.round(costingKg * q);
        });
        if (totalQty > 0 && totalBill > 0) {
          return totalBill / totalQty;
        }
      }
    }

    // 2. Check product summary / inhouse stock
    if (prodSummaryItem) {
      if (prodSummaryItem.inhouseQty > 0 && prodSummaryItem.inhousePrice > 0) {
        return prodSummaryItem.inhousePrice / prodSummaryItem.inhouseQty;
      }
      if (prodSummaryItem.purchaseQty > 0 && prodSummaryItem.purchasePrice > 0) {
        return prodSummaryItem.purchasePrice / prodSummaryItem.purchaseQty;
      }
    }

    // 3. Fallback from selectedLcStocks
    if (selectedLcStocks && selectedLcStocks.length > 0) {
      const matchingStocks = selectedLcStocks.filter(item => clean(item.productName || item.product) === targetClean);
      if (matchingStocks.length > 0) {
        let stockQty = 0;
        let stockVal = 0;
        matchingStocks.forEach(item => {
          const q = parseFloat(item.inHouseQuantity) || parseFloat(item.quantity) || 0;
          const p = parseFloat(item.purchasedPrice) || getPurchasePrice(item.productName || item.product, item.brand || item.brandName) || 0;
          stockQty += q;
          stockVal += q * p;
        });
        if (stockQty > 0 && stockVal > 0) {
          return stockVal / stockQty;
        }
      }
    }

    // 4. Overall LC average rate
    return conclusionData?.totalRatePerKgBdt || 0;
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

        return brandEntries.map(entry => {
          const { netQty } = calculateNetSaleQty(sale, item, entry, returnQtyMap);
          const unitPrice = parseFloat(entry.unitPrice) || 0;
          return {
            productName: item.productName || item.product || '-',
            brandName: entry.brandName || entry.brand || '-',
            quantity: netQty,
            unitPrice: unitPrice,
            totalAmount: netQty * unitPrice,
            lcNo: (entry.lcNo !== undefined && entry.lcNo !== null) ? entry.lcNo : itemLcNo
          };
        });
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
        productStockMap[prodName] = { productName: prodName, purchaseQty: 0, purchasePrice: 0, inhouseQty: 0, saleQty: 0, damageQty: 0, fallbackPrice: 0 };
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
            productStockMap[prodName] = { productName: prodName, purchaseQty: 0, purchasePrice: 0, inhouseQty: 0, saleQty: 0, damageQty: 0, fallbackPrice: getPurchasePrice(prodName), salePrice: 0 };
          }
          const { netQty } = calculateNetSaleQty(sale, item, entry, returnQtyMap);
          const unitPrice = parseFloat(entry.unitPrice) || 0;
          const entryTotal = netQty * unitPrice;
          productStockMap[prodName].saleQty += netQty;
          productStockMap[prodName].salePrice = (productStockMap[prodName].salePrice || 0) + entryTotal;
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
        productStockMap[prodName] = { productName: prodName, purchaseQty: 0, purchasePrice: 0, inhouseQty: 0, saleQty: 0, damageQty: 0, fallbackPrice: parseFloat(d.price) || getPurchasePrice(prodName), salePrice: 0 };
      }
      productStockMap[prodName].damageQty += parseFloat(d.quantity) || 0;
    });

    // 4. Calculate Current Stock Value (in hand)
    let currentStockValue = 0;
    const totalLcSalesQtyVal = salesRecords.reduce((sum, s) => {
      const sStatus = (s.status || '').toLowerCase();
      if (sStatus !== 'accepted' && sStatus !== 'pending') return sum;
      if (!hasLcFilter && !isDateInRange(s.date)) return sum;
      return sum + (s.items || []).reduce((iSum, item) => {
        const itemLc = (item.lcNo !== undefined && item.lcNo !== null) ? item.lcNo : (s.lcNo || '');
        const brandEntries = (item.brandEntries && item.brandEntries.length > 0)
          ? item.brandEntries
          : [{ quantity: item.quantity, lcNo: itemLc }];
        return iSum + brandEntries.reduce((bSum, b) => {
          const entryLc = (b.lcNo !== undefined && b.lcNo !== null) ? b.lcNo : itemLc;
          if (hasLcFilter && cleanLc(entryLc) !== targetLcClean) return bSum;
          const { netQty } = calculateNetSaleQty(s, item, b, returnQtyMap);
          return bSum + netQty;
        }, 0);
      }, 0);
    }, 0);
    const overallLcSalesRate = (hasLcFilter && totalLcSalesQtyVal > 0) ? (salesRevenue / totalLcSalesQtyVal) : 0;

    Object.entries(productStockMap).forEach(([pName, prod]) => {
      const currentStockQty = Math.max(0, prod.inhouseQty - prod.saleQty - prod.damageQty);
      if (currentStockQty <= 0) return;
      const effectiveRate = getProductAvgCost(prod.productName || pName, prod);
      currentStockValue += Math.round(currentStockQty * effectiveRate);
    });

    const finalRevenue = salesRevenue + currentStockValue;
    const actualCogWithInsurance = totalLcCostOfGoodsAmount + (selectedLcInsuranceAmount || 0);
    const finalCost = (useActualCog && selectedLc) ? actualCogWithInsurance : totalCost;
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
  }, [salesRecords, stockRecords, damages, products, filterType, selectedMonth, selectedYear, startDate, endDate, saleTypeFilter, selectedProduct, selectedLcNo, useActualCog, selectedLc, totalLcCostOfGoodsAmount, selectedLcInsuranceAmount, returnQtyMap, selectedLcCostOfGoods, selectedLcStocks, conclusionData]);

  // Effective summary synchronized with LC Conclusion Statement when an LC is selected
  const effectiveSummary = useMemo(() => {
    if (selectedLc && conclusionData && selectedProduct === 'All') {
      const salesRevenue = Math.round(conclusionData.salesValue || 0);
      const currentStockValue = Math.round(conclusionData.unsoldStockPriceAppx || 0);
      const totalRevenue = salesRevenue + currentStockValue;
      const totalCost = Math.round(conclusionData.totalInvest || 0);
      const totalProfit = Math.round(conclusionData.profitOrLoss !== undefined && conclusionData.profitOrLoss !== null ? conclusionData.profitOrLoss : (totalRevenue - totalCost));
      const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
      return {
        salesRevenue,
        currentStockValue,
        totalRevenue,
        totalCost,
        totalProfit,
        margin
      };
    }
    return profitLossData.summary;
  }, [selectedLc, conclusionData, selectedProduct, profitLossData.summary]);

  // Financial Breakdown 3D Pie Chart data for the selected LC
  const pieData = useMemo(() => {
    if (!selectedLc) return { total: 0, items: [] };

    const cog = (useActualCog && selectedLc) ? (totalLcCostOfGoodsAmount + selectedLcInsuranceAmount) : (totalLcCostOfGoodsAmount || 0);
    const exp = Math.max(0, (totalLcExpensesAmount || 0) - (useActualCog ? selectedLcInsuranceAmount : 0));
    const profit = Math.max(0, effectiveSummary.totalProfit || 0);

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
  }, [selectedLc, totalLcCostOfGoodsAmount, totalLcExpensesAmount, effectiveSummary.totalProfit, useActualCog, selectedLcInsuranceAmount]);

  const handlePrint = () => {
    generateProfitLossPDF({
      profitLossData: {
        ...profitLossData,
        summary: effectiveSummary
      },
      selectedLc,
      selectedLcExpenses,
      selectedLcCostOfGoods,
      selectedLcStocks,
      selectedLcSales,
      selectedLcDamages,
      productSummary,
      totalLcExpensesAmount,
      totalLcCostOfGoodsAmount,
      totalLcCostOfGoodsQty,
      totalLcReceiveAmount,
      totalLcSalesAmount,
      totalLcSalesQty,
      selectedLcReturns,
      totalLcReturnsAmount,
      totalLcReturnsQty,
      filterType,
      selectedMonth,
      selectedYear,
      startDate,
      endDate,
      saleTypeFilter,
      selectedProduct,
      selectedLcNo,
      pieData,
      adjustedLcValues,
      conclusionData
    });
  };

  // Product Stock & Arrivals card (used in Row 2 for both mobile & desktop layouts)
  const productStockArrivalsCard = selectedLc ? (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-200 flex flex-col">
      <div className="px-4 py-3 sm:px-6 sm:py-5 border-b border-gray-200 bg-slate-50/50">
        <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">Product Stock & Arrivals</h2>
        <p className="text-xs text-gray-500 font-medium">Arrival summaries, in-house inventory, short and damage records for LC No: <span className="text-blue-600 font-bold">{selectedLc.lcNo}</span></p>
      </div>
      <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 flex-1">
        {productSummary.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-400 font-bold">No product arrivals or damages found for this LC.</div>
        ) : (
          productSummary.map((prod, idx) => (
            <div key={idx} className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-6 bg-blue-600 rounded-full" />
                <h3 className="text-base font-black text-gray-950">{prod.productName}</h3>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                <div className="bg-slate-50 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-blue-100 hover:bg-blue-50/10 transition-all">
                  <div className="text-[9px] sm:text-[10px] text-gray-400 font-black uppercase tracking-wider mb-0.5 sm:mb-1 truncate">Purchase (Total Arrival)</div>
                  <div className="text-xs sm:text-sm font-black text-gray-900 truncate">{Math.round(prod.purchaseQty).toLocaleString()} {prod.unit}</div>
                  <div className="text-xs sm:text-sm font-bold text-blue-600 mt-0.5 sm:mt-1 truncate">৳ {Math.round(prod.purchasePrice).toLocaleString('en-IN')}</div>
                </div>
                {/* Inhouse Quantity */}
                <div className="bg-slate-50 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/10 transition-all">
                  <div className="text-[9px] sm:text-[10px] text-gray-400 font-black uppercase tracking-wider mb-0.5 sm:mb-1 truncate">Inhouse Quantity</div>
                  <div className="text-xs sm:text-sm font-black text-gray-900 truncate">{Math.round(prod.inhouseQty).toLocaleString()} {prod.unit}</div>
                  <div className="text-xs sm:text-sm font-bold text-emerald-600 mt-0.5 sm:mt-1 truncate">৳ {Math.round(prod.inhousePrice).toLocaleString('en-IN')}</div>
                </div>
                {/* Short Quantity */}
                <div className="bg-slate-50 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-amber-100 hover:bg-amber-50/10 transition-all">
                  <div className="text-[9px] sm:text-[10px] text-gray-400 font-black uppercase tracking-wider mb-0.5 sm:mb-1 truncate">Short Quantity</div>
                  <div className="text-xs sm:text-sm font-black text-rose-600 truncate">{Math.round(prod.shortQty).toLocaleString()} {prod.unit}</div>
                  <div className="text-xs sm:text-sm font-bold text-amber-600 mt-0.5 sm:mt-1 truncate">৳ {Math.round(prod.shortPrice).toLocaleString('en-IN')}</div>
                </div>
                {/* Damage Quantity */}
                <div className="bg-slate-50 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-rose-100 hover:bg-rose-50/10 transition-all">
                  <div className="text-[9px] sm:text-[10px] text-gray-400 font-black uppercase tracking-wider mb-0.5 sm:mb-1 truncate">Damage Quantity</div>
                  <div className="text-xs sm:text-sm font-black text-rose-700 truncate">{Math.round(prod.damageQty).toLocaleString()} {prod.unit}</div>
                  <div className="text-xs sm:text-sm font-bold text-rose-500 mt-0.5 sm:mt-1 truncate">৳ {Math.round(prod.damagePrice).toLocaleString('en-IN')}</div>
                </div>
                {/* Sold Quantity */}
                <div className="bg-slate-50 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-violet-100 hover:bg-violet-50/10 transition-all">
                  <div className="text-[9px] sm:text-[10px] text-gray-400 font-black uppercase tracking-wider mb-0.5 sm:mb-1 truncate">Sold Quantity</div>
                  <div className="text-xs sm:text-sm font-black text-gray-900 truncate">{Math.round(prod.saleQty || 0).toLocaleString()} {prod.unit}</div>
                  <div className="text-xs sm:text-sm font-bold text-violet-600 mt-0.5 sm:mt-1 truncate">৳ {Math.round(prod.salePrice || 0).toLocaleString('en-IN')}</div>
                </div>
                {/* Current Stock */}
                <div className="bg-slate-50 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/10 transition-all">
                  <div className="text-[9px] sm:text-[10px] text-gray-400 font-black uppercase tracking-wider mb-0.5 sm:mb-1 truncate">Current Stock</div>
                  <div className="text-xs sm:text-sm font-black text-gray-900 truncate">{Math.round(prod.inhouseQty - (prod.saleQty || 0) - (prod.damageQty || 0)).toLocaleString()} {prod.unit}</div>
                  <div className="text-xs sm:text-sm font-bold text-indigo-600 mt-0.5 sm:mt-1 truncate">
                    ৳ {(() => {
                      const currentStockQty = Math.max(0, prod.inhouseQty - (prod.saleQty || 0) - (prod.damageQty || 0));
                      if (currentStockQty <= 0) return '0';
                      const avgCost = getProductAvgCost(prod.productName, prod);
                      return Math.round(currentStockQty * avgCost).toLocaleString('en-IN');
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
    <div className="bg-white p-5 sm:p-8 print:p-3 print:py-4 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm text-center min-h-[180px] sm:min-h-[220px] print:min-h-0 flex-1 flex flex-col justify-center">
      <div className="w-16 h-16 print:w-8 print:h-8 print:mb-2 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mx-auto mb-4 animate-pulse">
        <BoxIcon className="w-8 h-8 print:w-4 print:h-4" />
      </div>
      <h3 className="text-lg print:text-sm font-black text-gray-900 mb-1">Product Stock & Arrivals</h3>
      <p className="text-sm print:text-xs text-gray-500 max-w-sm mx-auto">Select an LC Number from the header input to analyze product quantities, inhouse stock, shortage amounts, and damages.</p>
    </div>
  );

  // LC Receive History card (used in Row 2 for both mobile & desktop layouts)
  const lcReceiveHistoryCard = selectedLc ? (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-200 flex flex-col">
      <div className="px-4 py-3 sm:px-6 sm:py-5 border-b border-gray-200 bg-slate-50/50">
        <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">LC Receive History</h2>
        <p className="text-xs text-gray-500 font-medium">Stock receive records for LC No: <span className="text-blue-600 font-bold">{selectedLc.lcNo}</span></p>
      </div>

      {/* Mobile View: Responsive Stock Receive Cards */}
      <div className="block md:hidden p-3.5 space-y-3">
        {selectedLcStocks.length === 0 ? (
          <div className="py-8 text-center text-gray-400 font-semibold text-xs">
            No stock receive records found for this LC.
          </div>
        ) : (
          <div className="space-y-2.5">
            {selectedLcStocks.map((item, idx) => {
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
              const cardId = item._id || `rcv-${idx}`;
              const isExpanded = expandedReceiveIds.has(cardId);

              return (
                <div
                  key={`rcv-mob-${cardId}-${idx}`}
                  className="bg-slate-50 rounded-2xl border border-gray-200/70 overflow-hidden transition-all duration-200"
                >
                  {/* Clickable Header for Collapse / Expand */}
                  <div
                    onClick={() => toggleExpandReceive(cardId)}
                    className="p-3.5 cursor-pointer select-none hover:bg-slate-100/60 active:bg-slate-100 transition-colors flex items-center justify-between gap-3"
                  >
                    {/* Left Side: Date, Invoice No, Brand */}
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {dateStr ? formatDate(dateStr) : 'N/A'}
                      </div>
                      <div className="font-black text-gray-900 text-sm tracking-tight truncate mt-0.5">
                        {item.invoiceNo || '-'}
                      </div>
                      <div className="text-xs font-bold text-gray-600 truncate mt-0.5">
                        {brandName && brandName !== '-' ? brandName : prodName}
                      </div>
                    </div>

                    {/* Right Side: Truck, Inhouse Qty, Amount */}
                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-bold text-gray-500 truncate max-w-[130px]">
                        {item.truckNo ? `Truck: ${item.truckNo}` : 'Inhouse'}
                      </div>
                      <div className="text-xs font-black text-emerald-600 mt-0.5">
                        {Math.round(inhouseQty).toLocaleString()} KG
                      </div>
                      <div className="text-sm font-black text-blue-600 mt-0.5">
                        ৳ {Math.round(totalVal).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Details Body */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-2 border-t border-gray-200/60 space-y-2 text-xs animate-in fade-in duration-200">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Product & Brand :</span>
                        <span className="font-bold text-gray-800 text-right">
                          {prodName} {brandName && brandName !== '-' ? `(${brandName})` : ''}
                        </span>
                      </div>

                      {item.truckNo && (
                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/60">
                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Truck No :</span>
                          <span className="font-bold text-gray-800 text-right">{item.truckNo}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/60">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Arrival Qty :</span>
                        <span className="font-bold text-gray-900 text-right">{Math.round(qty).toLocaleString()} KG</span>
                      </div>

                      {shortQty > 0 && (
                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/60">
                          <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider shrink-0">Short Qty :</span>
                          <span className="font-black text-rose-600 text-right">-{Math.round(shortQty).toLocaleString()} KG</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/60">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Inhouse Qty :</span>
                        <span className="font-black text-emerald-600 text-right">{Math.round(inhouseQty).toLocaleString()} KG</span>
                      </div>

                      {price > 0 && (
                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/60">
                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Purchased Price :</span>
                          <span className="font-bold text-gray-800 text-right">৳ {price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / KG</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/70">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Total Value :</span>
                        <span className="font-black text-blue-600 text-right text-sm">৳ {Math.round(totalVal).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Total Received Summary Card */}
            <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200/70 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-black text-blue-950 uppercase tracking-wider">Total Arrival :</span>
                <span className="font-black text-gray-900 text-right">
                  {Math.round(selectedLcStocks.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0)).toLocaleString()} KG
                </span>
              </div>
              {selectedLcStocks.some(i => (parseFloat(i.sweepedQuantity) || 0) > 0) && (
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-blue-200/60">
                  <span className="text-[11px] font-black text-rose-700 uppercase tracking-wider">Total Short :</span>
                  <span className="font-black text-rose-600 text-right">
                    {Math.round(selectedLcStocks.reduce((sum, i) => sum + (parseFloat(i.sweepedQuantity) || 0), 0)).toLocaleString()} KG
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-blue-200/60">
                <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">Total Inhouse :</span>
                <span className="font-black text-emerald-600 text-right">
                  {Math.round(selectedLcStocks.reduce((sum, i) => {
                    const q = parseFloat(i.quantity) || 0;
                    const s = parseFloat(i.sweepedQuantity) || 0;
                    const inh = (i.inHouseQuantity !== undefined && i.inHouseQuantity !== null) ? parseFloat(i.inHouseQuantity) || 0 : Math.max(0, q - s);
                    return sum + inh;
                  }, 0)).toLocaleString()} KG
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-blue-200/70">
                <span className="text-[11px] font-black text-blue-950 uppercase tracking-wider">Total Received Value :</span>
                <span className="font-black text-blue-600 text-right text-sm">
                  ৳ {Math.round(totalLcReceiveAmount).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop View & Print: Full 7-column Table */}
      <div className="hidden md:block print:!block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider">
              <th className="py-2.5 px-4">Date</th>
              <th className="py-2.5 px-4">Invoice No</th>
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
                <td colSpan="7" className="py-8 text-center text-gray-400 font-semibold">No stock receive records found for this LC.</td>
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
                      <div className="font-bold text-gray-950 whitespace-nowrap">{item.invoiceNo || '-'}</div>
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
                <td colSpan="3" className="py-3.5 px-4 font-black text-gray-500 uppercase tracking-wider text-[11px]">Total Received</td>
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
    <div className="bg-white p-5 sm:p-8 print:p-3 print:py-4 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm text-center min-h-[160px] print:min-h-0 flex-1 flex flex-col justify-center">
      <div className="w-16 h-16 print:w-8 print:h-8 print:mb-2 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mx-auto mb-4 animate-pulse">
        <BoxIcon className="w-8 h-8 print:w-4 print:h-4" />
      </div>
      <h3 className="text-lg print:text-sm font-black text-gray-900 mb-1">LC Receive History</h3>
      <p className="text-sm print:text-xs text-gray-500 max-w-sm mx-auto">Select an LC to view stock receive history.</p>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-3 sm:p-6 md:p-8 print:bg-white print:p-2 print:overflow-visible">
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
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-4 gap-3 sm:gap-4 print:hidden">
        {/* Left column: Title and Icon */}
        <div className="flex items-center justify-center md:justify-start gap-3 w-full md:w-auto text-center md:text-left">
          <div className="hidden md:flex w-10 h-10 rounded-xl bg-blue-500/10 items-center justify-center text-blue-600 shadow-inner shrink-0">
            <BarChartIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Profit & Loss Report</h1>
            <p className="text-xs text-gray-500 font-medium">Analyze revenue, costs, and margins from sales</p>
          </div>
        </div>

        {/* Center & Right: Search bar + Action buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto md:flex-1 md:justify-between min-w-0">
          {/* Center column: LC No Searchable Dropdown Button */}
          <div className="flex-1 md:flex-initial md:w-[240px] md:max-w-[240px] md:mx-auto relative min-w-0" ref={lcDropdownRef}>
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

          {/* Right column: Action buttons (Filter & Print) */}
          <div className="flex items-center gap-2 shrink-0 md:justify-end">
            <div className="relative">
              <button
                ref={filterButtonRef}
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                title="Filter Report"
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border font-medium text-sm shrink-0 ${showFilterPanel || filterType !== 'monthly' || saleTypeFilter !== 'All' || selectedProduct !== 'All'
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
                className="fixed inset-x-3 top-20 max-h-[85vh] overflow-y-auto md:absolute md:inset-auto md:right-0 md:mt-3 md:top-auto md:max-h-[80vh] w-auto md:w-[420px] bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[130] p-4 md:p-6 animate-in fade-in zoom-in duration-200"
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
            title="Print Report"
            className="w-10 h-10 md:w-auto md:h-10 md:px-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 font-semibold text-xs tracking-wider transition-all shrink-0"
          >
            <PrinterIcon className="w-4 h-4 text-white shrink-0" />
            <span className="hidden md:inline">PRINT REPORT</span>
          </button>
        </div>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 print:grid-cols-4 print:gap-2 print:break-inside-avoid">

          {/* Metric 1: Total Revenue */}
          <div className="bg-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl print:p-3 print:rounded-xl border border-gray-200/90 shadow-xs relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-14 h-14 sm:w-24 sm:h-24 print:w-10 print:h-10 bg-blue-500/5 rounded-bl-full flex items-start justify-end p-2.5 sm:p-4 print:p-2 group-hover:scale-105 transition-transform pointer-events-none">
              <DollarSignIcon className="w-4 h-4 sm:w-6 sm:h-6 print:w-4 print:h-4 text-blue-500" />
            </div>
            <div>
              <div className="text-[10px] sm:text-xs print:text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 sm:mb-2 truncate">Total Revenue</div>
              <div className="text-base sm:text-2xl print:text-base font-black text-gray-900 leading-tight">৳ {Math.round(effectiveSummary.totalRevenue).toLocaleString('en-IN')}</div>
            </div>
            <div className="text-[10px] sm:text-[11px] print:text-[9px] mt-2 sm:mt-2.5 print:mt-1 flex items-center gap-1 sm:gap-1.5 flex-wrap font-semibold">
              {selectedLc ? (
                <>
                  <span className="inline-flex items-center px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md sm:rounded-lg bg-blue-50 text-blue-700 font-extrabold border border-blue-100/80 text-[9px] sm:text-[10px]">
                    Sales: ৳ {Math.round(effectiveSummary.salesRevenue || 0).toLocaleString('en-IN')}
                  </span>
                  {effectiveSummary.currentStockValue > 0 && (
                    <>
                      <span className="text-gray-400 font-black">+</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md sm:rounded-lg bg-emerald-50 text-emerald-700 font-extrabold border border-emerald-100/80 text-[9px] sm:text-[10px]">
                        Stock: ৳ {Math.round(effectiveSummary.currentStockValue).toLocaleString('en-IN')}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-gray-400 font-medium text-[10px] sm:text-xs">Select an LC No</span>
              )}
            </div>
          </div>

          {/* Metric 2: Total COGS */}
          <div className="bg-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl print:p-3 print:rounded-xl border border-gray-200/90 shadow-xs relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-14 h-14 sm:w-24 sm:h-24 print:w-10 print:h-10 bg-amber-500/5 rounded-bl-full flex items-start justify-end p-2.5 sm:p-4 print:p-2 group-hover:scale-105 transition-transform pointer-events-none">
              <ReceiptIcon className="w-4 h-4 sm:w-6 sm:h-6 print:w-4 print:h-4 text-amber-500" />
            </div>
            <div>
              <div className="text-[10px] sm:text-xs print:text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 sm:mb-2 truncate">Cost of Goods (COGS)</div>
              <div className="text-base sm:text-2xl print:text-base font-black text-gray-900 leading-tight">৳ {Math.round(effectiveSummary.totalCost).toLocaleString('en-IN')}</div>
            </div>
            <div className="text-[10px] sm:text-[11px] print:text-[9px] text-gray-400 mt-2 sm:mt-2 print:mt-1 font-medium line-clamp-2">
              {useActualCog && selectedLc && selectedLcInsuranceAmount > 0
                ? `Includes Insurance: ৳ ${Math.round(selectedLcInsuranceAmount).toLocaleString('en-IN')}`
                : 'Calculated based on product costs'}
            </div>
          </div>

          {/* Metric 3: Gross Profit */}
          <div className="bg-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl print:p-3 print:rounded-xl border border-gray-200/90 shadow-xs relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-14 h-14 sm:w-24 sm:h-24 print:w-10 print:h-10 bg-emerald-500/5 rounded-bl-full flex items-start justify-end p-2.5 sm:p-4 print:p-2 group-hover:scale-105 transition-transform pointer-events-none">
              <TrendingUpIcon className="w-4 h-4 sm:w-6 sm:h-6 print:w-4 print:h-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-[10px] sm:text-xs print:text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 sm:mb-2 truncate">Net Profit / Loss</div>
              <div className={`text-base sm:text-2xl print:text-base font-black leading-tight ${effectiveSummary.totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                ৳ {Math.round(effectiveSummary.totalProfit).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="text-[10px] sm:text-[11px] print:text-[9px] text-gray-400 mt-2 sm:mt-2 print:mt-1 font-medium line-clamp-1">Net profit before overheads</div>
          </div>

          {/* Metric 4: Profit Margin */}
          <div className="bg-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl print:p-3 print:rounded-xl border border-gray-200/90 shadow-xs relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-14 h-14 sm:w-24 sm:h-24 print:w-10 print:h-10 bg-indigo-500/5 rounded-bl-full flex items-start justify-end p-2.5 sm:p-4 print:p-2 group-hover:scale-105 transition-transform pointer-events-none">
              <BarChartIcon className="w-4 h-4 sm:w-6 sm:h-6 print:w-4 print:h-4 text-indigo-500" />
            </div>
            <div>
              <div className="text-[10px] sm:text-xs print:text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 sm:mb-2 truncate">Net Margin</div>
              <div className={`text-base sm:text-2xl print:text-base font-black leading-tight ${effectiveSummary.totalProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                {effectiveSummary.margin.toFixed(2)} %
              </div>
            </div>
            <div className="text-[10px] sm:text-[11px] print:text-[9px] text-gray-400 mt-2 sm:mt-2 print:mt-1 font-medium line-clamp-1">Percentage of revenue retained</div>
          </div>
        </div>

        {/* Mobile View: Financial Breakdown 3D Pie Chart directly after cards */}
        <div className="block lg:hidden print:hidden">
          {selectedLc ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-2.5 sm:p-5 animate-in fade-in duration-200 flex flex-col items-center justify-center">
              <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-gray-100 px-1">
                <span className="text-xs font-black text-gray-800 uppercase tracking-wider">Financial Breakdown</span>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{selectedLc.lcNo}</span>
              </div>
              <ThreeDPieChart items={pieData.items} total={pieData.total} />

              {/* Mobile Breakdown Legend Cards */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100">
                {pieData.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-gray-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-xs font-bold text-gray-800 truncate">{item.label}</span>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="text-xs font-black text-gray-900">৳ {Math.round(item.value).toLocaleString('en-IN')}</span>
                      <span className="text-[10px] font-bold text-gray-500 ml-1">({item.pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 text-center flex flex-col justify-center items-center">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mb-2 animate-pulse">
                <BarChartIcon className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-gray-900 mb-0.5">Financial 3D Pie Chart</h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">Select an LC to view cost breakdown.</p>
            </div>
          )}
        </div>

        {/* Row 1: LC Details (left 50%) | LC Expense (right 50%) */}
        <div className="flex flex-col lg:flex-row gap-4 mt-6 print:grid print:grid-cols-2 print:gap-3 print:mt-3 print:break-inside-avoid">

          {/* LEFT: LC Details Card — 50% */}
          <div className="w-full lg:w-[calc(50%-0.5rem)] flex flex-col">
            {selectedLc ? (
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-200 flex flex-col flex-1">
                <div className="px-4 py-3 sm:px-6 sm:py-5 border-b border-gray-200 bg-slate-50/50">
                  {/* Mobile Header: LC Details on left, status tag on right */}
                  <div className="flex md:hidden items-center justify-between gap-2">
                    <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">LC Details</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${selectedLc.status === 'Opened' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-blue-50 text-blue-700 border border-blue-200/60'}`}>
                      {selectedLc.status || 'Opened'}
                    </span>
                  </div>
                  <p className="block md:hidden text-xs text-gray-500 font-medium mt-0.5">Core information & values for LC No: <span className="text-blue-600 font-bold">{selectedLc.lcNo}</span></p>

                  {/* Desktop Header: Original 2-column flex layout */}
                  <div className="hidden md:flex sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">LC Details</h2>
                      <p className="text-xs text-gray-500 font-medium">Core information & values for LC No: <span className="text-blue-600 font-bold">{selectedLc.lcNo}</span></p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider self-start sm:self-center ${selectedLc.status === 'Opened' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                      {selectedLc.status || 'Opened'}
                    </span>
                  </div>
                </div>

                <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                  {/* Parties & Bank */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Parties & Bank</h3>

                    {/* Mobile View: Label : Value row layout */}
                    <div className="block md:hidden bg-slate-50 p-4 rounded-2xl space-y-3 text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0 pt-0.5">Importer :</span>
                        <span className="font-bold text-gray-800 text-right break-words">{selectedLc.importerName || 'N/A'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 pt-2.5 border-t border-gray-200/60">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0 pt-0.5">Exporter :</span>
                        <span className="font-bold text-gray-800 text-right break-words">{selectedLc.exporterName || 'N/A'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 pt-2.5 border-t border-gray-200/60">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0 pt-0.5">Bank & Branch :</span>
                        <span className="font-bold text-gray-800 text-right break-words">{getBankName(selectedLc.bankName) || 'N/A'} {selectedLc.bankBranch ? `(${selectedLc.bankBranch})` : ''}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 pt-2.5 border-t border-gray-200/60">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0 pt-0.5">Insurance Name :</span>
                        <span className="font-bold text-gray-800 text-right break-words">{selectedLc.insuranceCo || selectedLc.insuranceName || selectedLc.insuranceCompany || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Desktop View: Original Stacked Layout */}
                    <div className="hidden md:block bg-slate-50 p-4 rounded-2xl space-y-3">
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
                      const stockInHandKg = (productSummary && productSummary.length > 0)
                        ? productSummary.reduce((sum, p) => sum + Math.max(0, (parseFloat(p.inhouseQty) || 0) - (parseFloat(p.saleQty) || 0) - (parseFloat(p.damageQty) || 0)), 0)
                        : Math.max(0, receiveQtyKg - saleQtyKg - damageQtyKg - shortQtyKg);

                      return (
                        <>
                          {/* Mobile View: Label : Value row layout */}
                          <div className="block md:hidden bg-slate-50 p-4 rounded-2xl space-y-3 text-xs">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Opening Date :</span>
                              <span className="font-bold text-gray-800 text-right">{selectedLc.openingDate ? formatDate(selectedLc.openingDate) : 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-gray-200/60">
                              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Expiry Date :</span>
                              <span className="font-bold text-gray-800 text-right">{selectedLc.expiryDate ? formatDate(selectedLc.expiryDate) : 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-gray-200/60">
                              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Total Volume :</span>
                              <span className="font-black text-gray-900 text-right">{selectedLc.quantity || '0'} Ton</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-gray-200/60">
                              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Port of Entry :</span>
                              <span className="font-bold text-gray-800 text-right">{selectedLc.port || 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-gray-200/60">
                              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Receive Qty :</span>
                              <span className="font-black text-blue-600 text-right">{Math.round(receiveQtyKg).toLocaleString('en-US')} Kg</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-gray-200/60">
                              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Balance :</span>
                              <span className={`font-black text-right ${balanceQtyKg <= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{Math.round(balanceQtyKg).toLocaleString('en-US')} Kg</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-gray-200/60">
                              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Sale Qty :</span>
                              <span className="font-black text-emerald-600 text-right">{Math.round(saleQtyKg).toLocaleString('en-US')} Kg</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-gray-200/60">
                              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Stock in Hand :</span>
                              <span className="font-black text-purple-600 text-right">{Math.round(stockInHandKg).toLocaleString('en-US')} Kg</span>
                            </div>
                          </div>

                          {/* Desktop View: Original Layout */}
                          <div className="hidden md:block bg-slate-50 p-4 rounded-2xl space-y-3">
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
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Financial Summary */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Financial Summary</h3>
                    
                    {/* Mobile View: Label : Value row layout */}
                    <div className="block md:hidden bg-slate-50 p-4 rounded-2xl space-y-3 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">LC Value (USD) :</span>
                        <span className="font-black text-gray-900 text-right">$ {parseFloat(selectedLc.totalDollar || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-gray-200/60">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Exchange Rate :</span>
                        <span className="font-bold text-gray-800 text-right">{selectedLc.dollarRate || '0.00'} BDT</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-gray-200/60">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Total (BDT) :</span>
                        <span className="font-black text-gray-900 text-right">৳ {((parseFloat(selectedLc.totalDollar || 0) * parseFloat(selectedLc.dollarRate || 0)) || parseFloat(selectedLc.totalAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-gray-200/60">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Margin (%) :</span>
                        <span className="font-bold text-gray-800 text-right">{selectedLc.bankMargin || '0'} %</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-gray-200/60">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Margin Paid :</span>
                        <span className="font-black text-emerald-600 text-right">৳ {parseFloat(selectedLc.marginPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-gray-200/60">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Bill Value ($) :</span>
                        <span className="font-black text-blue-600 text-right">$ {(adjustedLcValues?.billValueUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-gray-200/60">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Bill Exchange Rate :</span>
                        <span className="font-bold text-gray-800 text-right">{(adjustedLcValues?.dollarRate || selectedLc.dollarRate || 0)} BDT</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-gray-200/60">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Bill Total (BDT) :</span>
                        <span className="font-black text-blue-600 text-right">৳ {parseFloat(adjustedLcValues?.adjustedTotalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    {/* Desktop View: Original Layout */}
                    <div className="hidden md:block bg-slate-50 p-4 rounded-2xl space-y-3">
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
                    </div>
                  </div>
                </div>

                {/* Products list nested table */}
                {selectedLc.productsList && selectedLc.productsList.length > 0 && (
                  <div className="border-t border-gray-100">
                    <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-50/20 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                      Products list in LC
                    </div>

                    <div className="border-t border-gray-100">
                      {/* Mobile View: Responsive Product Cards */}
                      <div className="block md:hidden p-3.5 space-y-3">
                        {selectedLc.productsList.map((prod, idx) => {
                          const qty = parseFloat(prod.quantity) || 0;
                          const rate = parseFloat(prod.rate) || 0;
                          const freight = parseFloat(prod.freight) || 0;
                          const totalVal = qty * (rate + freight);
                          return (
                            <div key={idx} className="bg-slate-50 p-3.5 rounded-2xl border border-gray-200/70 space-y-2.5 text-xs">
                              {/* Product Header */}
                              <div className="flex items-center justify-between gap-2 border-b border-gray-200/70 pb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-1.5 h-3.5 bg-blue-600 rounded-full shrink-0" />
                                  <span className="font-black text-gray-900 text-sm tracking-tight truncate">{prod.productName || 'N/A'}</span>
                                </div>
                                {prod.hsCode && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white text-gray-600 border border-gray-200 shadow-2xs shrink-0">
                                    HS: {prod.hsCode}
                                  </span>
                                )}
                              </div>

                              {/* Label : Value Rows */}
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Quantity (Ton) :</span>
                                <span className="font-black text-gray-800 text-right">{qty.toLocaleString()} Ton</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/60">
                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Rate ($) :</span>
                                <span className="font-bold text-gray-800 text-right">${rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/60">
                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Freight ($) :</span>
                                <span className="font-bold text-gray-800 text-right">${freight.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/70">
                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Total Value (USD) :</span>
                                <span className="font-black text-blue-600 text-right text-sm">${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop View & Print: Full 6-column Table */}
                      <div className="hidden md:block print:!block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                              <th className="py-2.5 px-4 sm:px-6">Product Name</th>
                              <th className="py-2.5 px-4 text-center">HS Code</th>
                              <th className="py-2.5 px-4 text-right">Quantity (Ton)</th>
                              <th className="py-2.5 px-4 text-right">Rate ($)</th>
                              <th className="py-2.5 px-4 text-right">Freight ($)</th>
                              <th className="py-2.5 px-4 sm:px-6 text-right font-black">Total Value (USD)</th>
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
                                  <td className="py-2.5 px-4 sm:px-6 font-bold text-gray-900">{prod.productName || 'N/A'}</td>
                                  <td className="py-2.5 px-4 text-center text-gray-500">{prod.hsCode || 'N/A'}</td>
                                  <td className="py-2.5 px-4 text-right font-bold">{qty.toLocaleString()}</td>
                                  <td className="py-2.5 px-4 text-right">${rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  <td className="py-2.5 px-4 text-right">${freight.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  <td className="py-2.5 px-4 sm:px-6 text-right font-black text-blue-600">${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm text-center min-h-[180px] sm:min-h-[220px] flex-1 flex flex-col justify-center">
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
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-200 flex flex-col flex-1">
                <div className="px-4 py-3 sm:px-6 sm:py-5 border-b border-gray-200 bg-slate-50/50">
                  <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">LC Expense</h2>
                  <p className="text-xs text-gray-500 font-medium">Payments for LC No: <span className="text-blue-600 font-bold">{selectedLc.lcNo}</span></p>
                </div>
                {/* Mobile View: Clean Responsive Expense Rows */}
                <div className="block md:hidden p-3.5 space-y-3">
                  {selectedLcExpenses.length === 0 ? (
                    <div className="py-6 text-center text-gray-400 font-semibold text-xs">No expenses found for this LC.</div>
                  ) : (
                    <div className="bg-slate-50 p-4 rounded-2xl space-y-3 text-xs">
                      {selectedLcExpenses.map((exp, idx) => {
                        const partyName = getBankName(exp.cnfAgent) || getBankName(exp.bankName) || getBankName(exp.name);
                        const expDate = exp.date ? formatDate(exp.date) : null;
                        
                        let headTitle = exp.expenseHead || '-';
                        let amendBadge = null;
                        const amendMatch = headTitle.match(/\((AMENDMENT[^\)]+|Amend[^\)]+)\)/i);
                        if (amendMatch) {
                          amendBadge = amendMatch[1];
                          headTitle = headTitle.replace(amendMatch[0], '').trim();
                        }

                        return (
                          <div key={`exp-mob-${exp._id || idx}-${idx}`} className="flex items-start justify-between gap-3 pt-2.5 border-t border-gray-200/60 first:pt-0 first:border-0">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                                <span>{headTitle}</span>
                                {amendBadge && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 whitespace-nowrap">
                                    {amendBadge}
                                  </span>
                                )}
                              </div>
                              {(partyName || expDate) && (
                                <div className="text-[10px] text-gray-400 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                                  {partyName && <span>{partyName}</span>}
                                  {partyName && expDate && <span className="text-gray-300">•</span>}
                                  {expDate && <span>{expDate}</span>}
                                </div>
                              )}
                            </div>
                            <span className="font-black text-rose-600 text-right shrink-0 whitespace-nowrap pt-0.5">
                              ৳ {Math.round(exp.amount).toLocaleString('en-IN')}
                            </span>
                          </div>
                        );
                      })}

                      {/* Mobile Total Row */}
                      <div className="flex items-center justify-between gap-3 pt-3 border-t-2 border-gray-200/80 mt-1">
                        <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider">Total Expenses :</span>
                        <span className="font-black text-rose-600 text-right text-sm">
                          ৳ {Math.round(totalLcExpensesAmount).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Desktop View & Print: Original Table Layout */}
                <div className="hidden md:flex flex-col flex-1">
                  <div className="overflow-x-auto min-h-[160px] flex-1">
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
                          selectedLcExpenses.map((exp, idx) => {
                            const partyName = getBankName(exp.cnfAgent) || getBankName(exp.bankName) || getBankName(exp.name);
                            const expDate = exp.date ? formatDate(exp.date) : null;
                            
                            let headTitle = exp.expenseHead || '-';
                            let amendBadge = null;
                            const amendMatch = headTitle.match(/\((AMENDMENT[^\)]+|Amend[^\)]+)\)/i);
                            if (amendMatch) {
                              amendBadge = amendMatch[1];
                              headTitle = headTitle.replace(amendMatch[0], '').trim();
                            }

                            return (
                              <tr key={`exp-${exp._id || idx}-${idx}`} className="hover:bg-slate-50/30 transition-colors">
                                <td className="py-2.5 px-4">
                                  <div className="font-bold text-gray-950 flex items-center gap-1.5 flex-wrap">
                                    <span>{headTitle}</span>
                                    {amendBadge && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 whitespace-nowrap">
                                        {amendBadge}
                                      </span>
                                    )}
                                  </div>
                                  {(partyName || expDate) && (
                                    <div className="text-[10px] text-gray-400 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                                      {partyName && <span>{partyName}</span>}
                                      {partyName && expDate && <span className="text-gray-300">•</span>}
                                      {expDate && <span>{expDate}</span>}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-right font-black text-rose-600 whitespace-nowrap">৳ {Math.round(exp.amount).toLocaleString('en-IN')}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs font-black text-gray-500 uppercase tracking-wider">Total Expenses</span>
                    <span className="text-sm font-black text-rose-600">৳ {Math.round(totalLcExpensesAmount).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-5 sm:p-8 print:p-3 print:py-4 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm text-center min-h-[180px] sm:min-h-[220px] print:min-h-0 flex-1 flex flex-col justify-center">
                <div className="w-16 h-16 print:w-8 print:h-8 print:mb-2 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mx-auto mb-4 animate-pulse">
                  <BarChartIcon className="w-8 h-8 print:w-4 print:h-4" />
                </div>
                <h3 className="text-lg print:text-sm font-black text-gray-900 mb-1">LC Details</h3>
                <p className="text-sm print:text-xs text-gray-500 max-w-sm mx-auto">Search or select an LC Number from the header input to inspect its details, margin status, products, and values.</p>
              </div>
            )}

            {/* Financial Breakdown 3D Pie Chart (Desktop / Print - inside Row 1) */}
            {selectedLc ? (
              <div className="hidden lg:flex print:flex animate-in fade-in duration-200 flex-col flex-1 items-center justify-center p-3 print:p-1">
                <ThreeDPieChart items={pieData.items} total={pieData.total} />
              </div>
            ) : (
              <div className="hidden lg:flex print:flex p-5 sm:p-8 print:p-3 print:py-4 text-center min-h-[160px] print:min-h-0 flex-1 flex-col justify-center items-center">
                <div className="w-16 h-16 print:w-8 print:h-8 print:mb-2 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mb-4 animate-pulse">
                  <BarChartIcon className="w-8 h-8 print:w-4 print:h-4" />
                </div>
                <h3 className="text-lg print:text-sm font-black text-gray-900 mb-1">Financial 3D Pie Chart</h3>
                <p className="text-sm print:text-xs text-gray-500 max-w-sm mx-auto">Select an LC to view cost breakdown.</p>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: COG & Sales History (Left 50%) | LC Receive History & Product Stock (Right 50%) */}
        <div className="flex flex-col lg:flex-row gap-4 mt-6 items-start print:grid print:grid-cols-2 print:gap-3 print:mt-3 print:break-inside-avoid">

          {/* LEFT 50%: Cost of Goods (COG) Card + Sales History Card (directly under COG) */}
          <div className="w-full lg:w-[calc(50%-0.5rem)] flex flex-col gap-4">

            {/* Cost of Goods (COG) Card */}
            {selectedLc ? (
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-200 flex flex-col">
                <div className="px-4 py-3 sm:px-6 sm:py-5 border-b border-gray-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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

                {/* Product Filter Tabs (when multiple products exist) */}
                {cogByProduct.length > 1 && (
                  <div className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-slate-100/70 border-b border-gray-200 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setCogProductFilter('ALL')}
                      className={`px-3 py-1 rounded-full text-xs font-black transition-all ${
                        cogProductFilter === 'ALL'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      All Products ({selectedLcCostOfGoods.length})
                    </button>
                    {cogByProduct.map(group => (
                      <button
                        key={`cog-tab-${group.productName}`}
                        type="button"
                        onClick={() => setCogProductFilter(group.productName)}
                        className={`px-3 py-1 rounded-full text-xs font-black transition-all ${
                          cogProductFilter === group.productName
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        {group.productName} ({group.records.length})
                      </button>
                    ))}
                  </div>
                )}

                {/* Mobile View: Responsive COG Cards */}
                <div className="block md:hidden">
                  {selectedLcCostOfGoods.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 font-semibold text-xs">
                      No Cost of Goods records found for this LC.
                    </div>
                  ) : (
                    (() => {
                      const displayedGroups = (cogProductFilter === 'ALL' || !cogByProduct.some(g => g.productName === cogProductFilter))
                        ? cogByProduct
                        : cogByProduct.filter(g => g.productName === cogProductFilter);
                      const fQty = displayedGroups.reduce((s, g) => s + g.totalQty, 0);
                      const fAmt = displayedGroups.reduce((s, g) => s + g.totalNetBill, 0);

                      return (
                        <div className="space-y-4 p-3.5">
                          {displayedGroups.map((group, gIdx) => (
                            <div key={`cog-mob-group-${group.productName}-${gIdx}`} className="space-y-3">
                              {/* Product Group Header Banner */}
                              <div className="bg-blue-50/80 px-3.5 py-2.5 rounded-xl border border-blue-200/70 flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                                  <span className="font-black text-gray-900 uppercase tracking-wider text-xs truncate">
                                    {group.productName}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 shrink-0">
                                    {group.records.length}
                                  </span>
                                </div>
                                <span className="text-[11px] font-bold text-blue-900 shrink-0">
                                  {Math.round(group.totalQty).toLocaleString()} KG
                                </span>
                              </div>

                              {/* Records Cards with Collapse / Expand */}
                              <div className="space-y-2.5">
                                {group.records.map((rec, idx) => {
                                  const cardId = rec._id || `${group.productName}-${idx}`;
                                  const isExpanded = expandedCogIds.has(cardId);

                                  return (
                                    <div
                                      key={`cog-mob-rec-${rec._id || idx}-${idx}`}
                                      className="bg-slate-50 rounded-2xl border border-gray-200/70 overflow-hidden transition-all duration-200"
                                    >
                                      {/* Clickable Header for Collapse / Expand */}
                                      <div
                                        onClick={() => toggleExpandCog(cardId)}
                                        className="p-3.5 cursor-pointer select-none hover:bg-slate-100/60 active:bg-slate-100 transition-colors flex items-center justify-between gap-3"
                                      >
                                        {/* Left Side: Date, Invoice No, Brand */}
                                        <div className="min-w-0 flex-1">
                                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                            {rec.date ? formatDate(rec.date) : 'N/A'}
                                          </div>
                                          <div className="font-black text-gray-900 text-sm tracking-tight truncate mt-0.5">
                                            {rec.invoiceNo || '-'}
                                          </div>
                                          <div className="text-xs font-bold text-gray-600 truncate mt-0.5">
                                            {rec.brand || rec.product || '-'}
                                          </div>
                                        </div>

                                        {/* Right Side: Truck, Qty, Amount */}
                                        <div className="text-right shrink-0">
                                          <div className="text-[11px] font-bold text-gray-500 truncate">
                                            {rec.truckNo ? `Truck: ${rec.truckNo}` : '-'}
                                          </div>
                                          <div className="text-xs font-black text-gray-800 mt-0.5">
                                            {rec.rowQty.toLocaleString()} KG
                                          </div>
                                          <div className="text-sm font-black text-blue-600 mt-0.5">
                                            ৳ {rec.rowNetBill.toLocaleString('en-IN')}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Collapsible Details Body */}
                                      {isExpanded && (
                                        <div className="px-3.5 pb-3.5 pt-2 border-t border-gray-200/60 space-y-2 text-xs animate-in fade-in duration-200">
                                          {/* Product & Brand */}
                                          <div className="flex items-center justify-between gap-3">
                                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Product & Brand :</span>
                                            <span className="font-bold text-gray-800 text-right">
                                              {rec.product || '-'} {rec.brand ? `(${rec.brand})` : ''}
                                            </span>
                                          </div>

                                          {/* Quantity */}
                                          <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/60">
                                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Quantity :</span>
                                            <span className="font-black text-gray-900 text-right">{rec.rowQty.toLocaleString()} KG</span>
                                          </div>

                                          {/* Cost/KG */}
                                          <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/60">
                                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Cost/KG :</span>
                                            <span className="font-bold text-gray-800 text-right">৳{rec.costingKgVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                          </div>

                                          {/* Net Bill */}
                                          <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/70">
                                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Net Bill :</span>
                                            <span className="font-black text-blue-600 text-right text-sm">৳ {rec.rowNetBill.toLocaleString('en-IN')}</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Product Subtotal Card */}
                              <div className="bg-slate-100/90 p-3 rounded-xl border border-gray-200/80 flex items-center justify-between text-xs">
                                <div>
                                  <div className="font-black text-gray-800 text-[11px] uppercase tracking-wider">
                                    Subtotal ({group.productName})
                                  </div>
                                  <div className="text-[10px] text-gray-500 font-bold mt-0.5">
                                    Avg: ৳ {group.avgCostKg.toFixed(2)}/KG
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-black text-blue-700 text-sm">
                                    ৳ {Math.round(group.totalNetBill).toLocaleString('en-IN')}
                                  </div>
                                  <div className="text-[10px] text-gray-500 font-bold mt-0.5">
                                    {Math.round(group.totalQty).toLocaleString()} KG
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* Overall Total Banner on Mobile */}
                          <div className="bg-slate-100 p-3.5 rounded-2xl border-2 border-gray-300 flex items-center justify-between text-xs mt-2">
                            <div>
                              <div className="font-black text-gray-900 uppercase tracking-wider text-xs">
                                {cogProductFilter === 'ALL' ? 'Total COG' : `Total COG (${cogProductFilter})`}
                              </div>
                              <div className="text-[10px] text-gray-500 font-bold mt-0.5">
                                Avg: ৳ {fQty > 0 ? (fAmt / fQty).toFixed(2) : '0.00'}/KG • {Math.round(fQty).toLocaleString('en-US')} KG
                              </div>
                            </div>
                            <span className="font-black text-blue-700 text-base">
                              ৳ {Math.round(fAmt).toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Desktop View & Print: Original 6-Column Table */}
                <div className="hidden md:block print:!block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                        <th className="py-2.5 px-4 sm:px-6">Date</th>
                        <th className="py-2.5 px-4">Invoice / Truck</th>
                        <th className="py-2.5 px-4">Product & Brand</th>
                        <th className="py-2.5 px-4 text-right">Cost/KG</th>
                        <th className="py-2.5 px-4 text-right">Quantity</th>
                        <th className="py-2.5 px-4 sm:px-6 text-right font-black">Net Bill</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-medium">
                      {selectedLcCostOfGoods.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-gray-400 font-semibold">No Cost of Goods records found for this LC.</td>
                        </tr>
                      ) : (
                        (() => {
                          const displayedGroups = (cogProductFilter === 'ALL' || !cogByProduct.some(g => g.productName === cogProductFilter))
                            ? cogByProduct
                            : cogByProduct.filter(g => g.productName === cogProductFilter);

                          return displayedGroups.map((group, gIdx) => (
                            <React.Fragment key={`cog-group-${group.productName}-${gIdx}`}>
                              {/* Product Group Header Banner */}
                              <tr className="bg-blue-50/70 border-y border-blue-200/80">
                                <td colSpan="6" className="py-2 px-4 sm:px-6">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                                      <span className="font-black text-gray-900 uppercase tracking-wider text-xs">
                                        {group.productName}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                                        {group.records.length} {group.records.length === 1 ? 'Record' : 'Records'}
                                      </span>
                                    </div>
                                    <span className="text-xs font-bold text-blue-900">
                                      {Math.round(group.totalQty).toLocaleString()} KG • ৳ {Math.round(group.totalNetBill).toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                </td>
                              </tr>

                              {/* Group Records */}
                              {group.records.map((rec, idx) => (
                                <tr key={`cog-${rec._id || idx}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-2.5 px-4 sm:px-6 whitespace-nowrap text-gray-500">{formatDate(rec.date)}</td>
                                  <td className="py-2.5 px-4">
                                    <div className="font-black text-gray-900">{rec.invoiceNo || '-'}</div>
                                    <div className="text-xs text-black font-semibold mt-0.5">{rec.truckNo || '-'}</div>
                                  </td>
                                  <td className="py-2.5 px-4">
                                    <div className="font-black text-gray-900">{rec.product || '-'}</div>
                                    <div className="text-xs text-black font-semibold mt-0.5">{rec.brand || '-'}</div>
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-bold text-gray-900">৳{rec.costingKgVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="py-2.5 px-4 text-right font-semibold text-gray-900">{rec.rowQty.toLocaleString()} KG</td>
                                  <td className="py-2.5 px-4 sm:px-6 text-right font-black text-blue-600">৳ {rec.rowNetBill.toLocaleString('en-IN')}</td>
                                </tr>
                              ))}

                              {/* Product Subtotal Row */}
                              <tr className="bg-slate-50/90 font-bold border-b-2 border-gray-200 text-xs">
                                <td colSpan="3" className="py-2.5 px-4 sm:px-6 text-right font-black text-gray-700">
                                  Subtotal - {group.productName}
                                </td>
                                <td className="py-2.5 px-4 text-right font-black text-gray-900 whitespace-nowrap">
                                  ৳ {group.avgCostKg.toFixed(2)}
                                </td>
                                <td className="py-2.5 px-4 text-right font-black text-gray-900 whitespace-nowrap">
                                  {Math.round(group.totalQty).toLocaleString()} KG
                                </td>
                                <td className="py-2.5 px-4 sm:px-6 text-right font-black text-blue-700 whitespace-nowrap">
                                  ৳ {Math.round(group.totalNetBill).toLocaleString('en-IN')}
                                </td>
                              </tr>
                            </React.Fragment>
                          ));
                        })()
                      )}
                    </tbody>
                    {selectedLcCostOfGoods.length > 0 && (() => {
                      const displayedGroups = (cogProductFilter === 'ALL' || !cogByProduct.some(g => g.productName === cogProductFilter))
                        ? cogByProduct
                        : cogByProduct.filter(g => g.productName === cogProductFilter);
                      const fQty = displayedGroups.reduce((s, g) => s + g.totalQty, 0);
                      const fAmt = displayedGroups.reduce((s, g) => s + g.totalNetBill, 0);

                      return (
                        <tfoot className="bg-slate-100/90 border-t-2 border-gray-300">
                          <tr className="text-xs">
                            <td colSpan="3" className="py-3 px-4 sm:px-6 font-black text-gray-900 uppercase tracking-wider text-[11px]">
                              {cogProductFilter === 'ALL' ? 'Total COG' : `Total COG (${cogProductFilter})`}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-gray-900 whitespace-nowrap">
                              ৳ {fQty > 0 ? (fAmt / fQty).toFixed(2) : '0.00'}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-gray-900 whitespace-nowrap">
                              {Math.round(fQty).toLocaleString('en-US')} KG
                            </td>
                            <td className="py-3 px-4 sm:px-6 text-right font-black text-blue-700 whitespace-nowrap text-sm">
                              ৳ {Math.round(fAmt).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tfoot>
                      );
                    })()}
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white p-5 sm:p-8 print:p-3 print:py-4 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm text-center min-h-[180px] sm:min-h-[200px] print:min-h-0 flex-1 flex flex-col justify-center">
                <div className="w-16 h-16 print:w-8 print:h-8 print:mb-2 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mx-auto mb-4 animate-pulse">
                  <ReceiptIcon className="w-8 h-8 print:w-4 print:h-4" />
                </div>
                <h3 className="text-lg print:text-sm font-black text-gray-900 mb-1">Cost of Goods (COG)</h3>
                <p className="text-sm print:text-xs text-gray-500 max-w-sm mx-auto">Select an LC Number from the header input to inspect all related Cost of Goods records, invoicing details, and actual costs.</p>
              </div>
            )}

            {/* Mobile View: LC Receive History & Product Stock & Arrivals shown right after Cost of Goods */}
            <div className="block lg:hidden print:hidden space-y-4">
              {lcReceiveHistoryCard}
              {productStockArrivalsCard}
            </div>

            {/* Sales History Card (Under COG on Left) */}
            {selectedLc ? (
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
                <div className="px-4 py-3 sm:px-6 sm:py-5 border-b border-gray-200 bg-slate-50/50">
                  <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">Sales History</h2>
                  <p className="text-xs text-gray-500 font-medium">Sales records for LC No: <span className="text-blue-600 font-bold">{selectedLc.lcNo}</span></p>
                </div>

                {/* Product Filter Tabs (when multiple products exist) */}
                {salesByProduct.length > 1 && (
                  <div className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-slate-100/70 border-b border-gray-200 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setSalesProductFilter('ALL')}
                      className={`px-3 py-1 rounded-full text-xs font-black transition-all ${
                        salesProductFilter === 'ALL'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      All Products ({selectedLcSales.length})
                    </button>
                    {salesByProduct.map(group => (
                      <button
                        key={`sales-tab-${group.productName}`}
                        type="button"
                        onClick={() => setSalesProductFilter(group.productName)}
                        className={`px-3 py-1 rounded-full text-xs font-black transition-all ${
                          salesProductFilter === group.productName
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        {group.productName} ({group.records.length})
                      </button>
                    ))}
                  </div>
                )}

                {(() => {
                  const displayedSales = (salesProductFilter === 'ALL' || !salesByProduct.some(g => g.productName === salesProductFilter))
                    ? selectedLcSales
                    : selectedLcSales.filter(s => (s.productName || '').trim().toLowerCase() === salesProductFilter.trim().toLowerCase());

                  return (
                    <>
                      {/* Mobile View: Responsive Sales Cards */}
                      <div className="block md:hidden p-3.5 space-y-3">
                        {displayedSales.length === 0 ? (
                          <div className="py-8 text-center text-gray-400 font-semibold text-xs">
                            No sales history found for this LC.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {displayedSales.map((sale, idx) => {
                              const cardId = sale._id || `sale-${idx}`;
                              const isExpanded = expandedSalesIds.has(cardId);

                              return (
                                <div
                                  key={`sale-mob-${cardId}-${idx}`}
                                  className="bg-slate-50 rounded-2xl border border-gray-200/70 overflow-hidden transition-all duration-200"
                                >
                                  {/* Clickable Header for Collapse / Expand */}
                                  <div
                                    onClick={() => toggleExpandSales(cardId)}
                                    className="p-3.5 cursor-pointer select-none hover:bg-slate-100/60 active:bg-slate-100 transition-colors flex items-center justify-between gap-3"
                                  >
                                    {/* Left Side: Date, Invoice No, Customer */}
                                    <div className="min-w-0 flex-1">
                                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                        {sale.date ? formatDate(sale.date) : 'N/A'}
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                        <span className="font-black text-gray-900 text-sm tracking-tight truncate">
                                          {sale.invoiceNo || '-'}
                                        </span>
                                        {sale.returnedQty > 0 && (
                                          <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-black tracking-wide shrink-0">
                                            -{Math.round(sale.returnedQty).toLocaleString()} KG RET
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs font-bold text-gray-600 truncate mt-0.5">
                                        {sale.customerName || 'General Sale'}
                                      </div>
                                    </div>

                                    {/* Right Side: Brand, Qty, Amount */}
                                    <div className="text-right shrink-0">
                                      <div className="text-[11px] font-bold text-gray-500 truncate max-w-[130px]">
                                        {sale.brandName || sale.productName || '-'}
                                      </div>
                                      <div className="text-xs font-black text-gray-800 mt-0.5">
                                        {Math.round(sale.quantity).toLocaleString()} KG
                                      </div>
                                      <div className="text-sm font-black text-emerald-600 mt-0.5">
                                        ৳ {Math.round(sale.totalAmount).toLocaleString('en-IN')}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Collapsible Details Body */}
                                  {isExpanded && (
                                    <div className="px-3.5 pb-3.5 pt-2 border-t border-gray-200/60 space-y-2 text-xs animate-in fade-in duration-200">
                                      <div className="flex items-center justify-between gap-3">
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Customer :</span>
                                        <span className="font-bold text-gray-800 text-right truncate">{sale.customerName || 'General Sale'}</span>
                                      </div>

                                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/60">
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Product & Brand :</span>
                                        <span className="font-bold text-gray-800 text-right">
                                          {sale.productName} {sale.brandName && sale.brandName !== '-' ? `(${sale.brandName})` : ''}
                                        </span>
                                      </div>

                                      {sale.saleType && (
                                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/60">
                                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Sale Type :</span>
                                          <span className="font-bold text-gray-700 text-right">{sale.saleType}</span>
                                        </div>
                                      )}

                                      {sale.unitPrice > 0 && (
                                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/60">
                                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Rate :</span>
                                          <span className="font-bold text-gray-800 text-right">৳ {sale.unitPrice.toLocaleString('en-IN')} / KG</span>
                                        </div>
                                      )}

                                      {sale.returnedQty > 0 && (
                                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/60">
                                          <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider shrink-0">Returned :</span>
                                          <span className="font-black text-rose-600 text-right">-{Math.round(sale.returnedQty).toLocaleString()} KG</span>
                                        </div>
                                      )}

                                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/60">
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Net Quantity :</span>
                                        <span className="font-black text-gray-900 text-right">{Math.round(sale.quantity).toLocaleString()} KG</span>
                                      </div>

                                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/70">
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Total Revenue :</span>
                                        <span className="font-black text-emerald-600 text-right text-sm">৳ {Math.round(sale.totalAmount).toLocaleString('en-IN')}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Total Sales Summary Card */}
                            <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/70 space-y-2 text-xs">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[11px] font-black text-emerald-900 uppercase tracking-wider">
                                  {salesProductFilter === 'ALL' ? 'Total Sales' : `Total (${salesProductFilter})`} :
                                </span>
                                <span className="font-black text-gray-900 text-right">
                                  {Math.round(displayedSales.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0)).toLocaleString('en-US')} KG
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3 pt-2 border-t border-emerald-200/60">
                                <span className="text-[11px] font-black text-emerald-900 uppercase tracking-wider">Total Revenue :</span>
                                <span className="font-black text-emerald-700 text-right text-sm">
                                  ৳ {Math.round(displayedSales.reduce((sum, s) => sum + (parseFloat(s.totalAmount) || 0), 0)).toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Desktop View & Print: Original Full Table */}
                      <div className="hidden md:block print:!block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm">
                            <tr className="border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                              <th className="py-2.5 px-4">Invoice / Customer</th>
                              <th className="py-2.5 px-4">Product & Brand</th>
                              <th className="py-2.5 px-4 text-right">Qty</th>
                              <th className="py-2.5 px-4 text-right font-black">Total Revenue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-medium">
                            {displayedSales.length === 0 ? (
                              <tr>
                                <td colSpan="4" className="py-8 text-center text-gray-400 font-semibold">No sales history found for this LC.</td>
                              </tr>
                            ) : (
                              displayedSales.map((sale, idx) => (
                                <tr key={`sale-${sale._id || idx}-${idx}`} className="hover:bg-slate-50/30 transition-colors">
                                  <td className="py-2.5 px-4">
                                    <div className="font-bold text-gray-950 break-words flex items-center gap-1.5 flex-wrap">
                                      <span>{sale.invoiceNo}</span>
                                      {sale.returnedQty > 0 && (
                                        <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-black tracking-wide">
                                          -{Math.round(sale.returnedQty).toLocaleString()} KG RETURNED
                                        </span>
                                      )}
                                    </div>
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
                          {displayedSales.length > 0 && (
                            <tfoot className="bg-slate-50 border-t-2 border-gray-200">
                              <tr className="text-xs">
                                <td colSpan="2" className="py-3.5 px-4 font-black text-gray-500 uppercase tracking-wider text-[11px]">
                                  {salesProductFilter === 'ALL' ? 'Total Sales' : `Total Sales (${salesProductFilter})`}
                                </td>
                                <td className="py-3.5 px-4 text-right font-black text-gray-900 whitespace-nowrap">
                                  {Math.round(displayedSales.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0)).toLocaleString('en-US')} KG
                                </td>
                                <td className="py-3.5 px-4 text-right font-black text-emerald-600 whitespace-nowrap">
                                  ৳ {Math.round(displayedSales.reduce((sum, s) => sum + (parseFloat(s.totalAmount) || 0), 0)).toLocaleString('en-IN')}
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </>
                  );
                })()}

              </div>
            ) : (
              <div className="bg-white p-5 sm:p-8 print:p-3 print:py-4 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm text-center min-h-[160px] print:min-h-0 flex-1 flex flex-col justify-center">
                <div className="w-16 h-16 print:w-8 print:h-8 print:mb-2 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 mx-auto mb-4 animate-pulse">
                  <TrendingUpIcon className="w-8 h-8 print:w-4 print:h-4" />
                </div>
                <h3 className="text-lg print:text-sm font-black text-gray-900 mb-1">Sales History</h3>
                <p className="text-sm print:text-xs text-gray-500 max-w-sm mx-auto">Select an LC to view sales history.</p>
              </div>
            )}
          </div>

          {/* RIGHT 50%: LC Receive History + Product Stock & Arrivals (Desktop & Print) */}
          <div className="hidden lg:flex print:flex w-full lg:w-[calc(50%-0.5rem)] flex-col gap-4">
            {lcReceiveHistoryCard}
            {productStockArrivalsCard}
          </div>
        </div>

        {/* Row 3: Return Sales (Left) + LC Conclusion Statement (Right) */}
        {selectedLc && (conclusionData || selectedLcReturns.length > 0) && (
          <div className={`mt-6 print:mt-6 print:break-before-page ${selectedLcReturns.length > 0 ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 items-start' : 'flex justify-center'}`}>
            
            {/* Left Column: Return Sales (when returns exist) */}
            {selectedLcReturns.length > 0 && (
              <div className="w-full min-w-0 bg-white rounded-2xl sm:rounded-3xl border border-rose-200/80 shadow-sm overflow-hidden animate-in fade-in duration-200">
                <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-rose-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-rose-50/50">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-5 bg-rose-500 rounded-full" />
                    <div>
                      <h2 className="text-sm font-black text-rose-950 uppercase tracking-wider flex items-center gap-2">
                        <span>Return Sales</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700">
                          {selectedLcReturns.length} {selectedLcReturns.length === 1 ? 'Record' : 'Records'}
                        </span>
                      </h2>
                      <p className="text-xs text-rose-600/80 font-medium mt-0.5">
                        Returned goods and invoices for LC No: <span className="font-bold text-rose-900">{selectedLc.lcNo}</span>
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider bg-rose-100/70 text-rose-700 border border-rose-200/60 self-start sm:self-center">
                    {Math.round(totalLcReturnsQty).toLocaleString('en-US')} KG • ৳ {Math.round(totalLcReturnsAmount).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-rose-50/30 border-b border-rose-100 text-[10px] font-black text-rose-600 uppercase tracking-wider">
                        <th className="py-2.5 px-3 sm:px-5">Invoice / Customer</th>
                        <th className="py-2.5 px-3 sm:px-5">Product & Brand</th>
                        <th className="py-2.5 px-3 sm:px-5 text-right">Return Qty</th>
                        <th className="py-2.5 px-3 sm:px-5 text-right font-black">Return Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100/60 text-xs text-gray-700 font-medium">
                      {selectedLcReturns.map((ret, idx) => (
                        <tr key={`ret-left-${ret._id || idx}`} className="hover:bg-rose-50/40 transition-colors">
                          <td className="py-3 px-3 sm:px-5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-gray-950 break-words">{ret.invoiceNo}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold uppercase tracking-wider">Return</span>
                            </div>
                            <div className="text-[10px] text-gray-400 font-medium break-words mt-0.5">{ret.customerName} • {formatDate(ret.date)}</div>
                          </td>
                          <td className="py-3 px-3 sm:px-5">
                            <div className="font-bold text-gray-950 break-words">{ret.productName}</div>
                            <div className="text-[10px] text-gray-400 font-medium break-words">{ret.brandName}</div>
                          </td>
                          <td className="py-3 px-3 sm:px-5 text-right font-bold text-rose-600 whitespace-nowrap">
                            {Math.round(ret.quantity).toLocaleString()} KG
                          </td>
                          <td className="py-3 px-3 sm:px-5 text-right font-black text-rose-600 whitespace-nowrap">
                            ৳ {Math.round(ret.totalAmount).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-rose-50/70 border-t-2 border-rose-200">
                      <tr className="text-xs">
                        <td colSpan="2" className="py-3 px-3 sm:px-5 font-black text-rose-800 uppercase tracking-wider text-[11px]">Total Return Sale</td>
                        <td className="py-3 px-3 sm:px-5 text-right font-black text-rose-700 whitespace-nowrap">
                          {Math.round(totalLcReturnsQty).toLocaleString('en-US')} KG
                        </td>
                        <td className="py-3 px-3 sm:px-5 text-right font-black text-rose-700 whitespace-nowrap text-sm">
                          ৳ {Math.round(totalLcReturnsAmount).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Right Column: LC Conclusion Statement */}
            {conclusionData && (
              <div className={`w-full min-w-0 ${selectedLcReturns.length > 0 ? '' : 'max-w-2xl'} bg-white rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-200`}>
              <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-5 bg-blue-600 rounded-full" />
                    <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">Conclusion Statement</h2>
                  </div>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">Comprehensive cost, inventory, investment & profit/loss summary for LC No: <span className="text-blue-600 font-bold">{selectedLc.lcNo}</span></p>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60 self-start sm:self-center">
                  Financial Conclusion
                </span>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse table-auto">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-200 text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <th className="py-2.5 px-4 sm:px-5 w-1/2">Particular / Metric</th>
                      <th className="py-2.5 px-4 sm:px-5 text-right w-1/2">Details & Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs sm:text-sm text-gray-700 font-medium">
                    {/* 1. LC No */}
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-4 sm:px-5 font-bold text-gray-900">LC No</td>
                      <td className="py-2 px-4 sm:px-5 text-right font-black text-gray-900">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200/80">
                          {conclusionData.lcNo}
                        </span>
                      </td>
                    </tr>

                    {/* 2. Item */}
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-4 sm:px-5 font-semibold text-gray-700">Item</td>
                      <td className="py-2 px-4 sm:px-5 text-right font-black text-gray-900 break-words">{conclusionData.item}</td>
                    </tr>

                    {/* 3. Supplier */}
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-4 sm:px-5 font-semibold text-gray-700">Supplier</td>
                      <td className="py-2 px-4 sm:px-5 text-right font-bold text-gray-900 break-words">{conclusionData.supplier}</td>
                    </tr>

                    {/* Total LC Value */}
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-4 sm:px-5 font-semibold text-gray-700">Total LC Value</td>
                      <td className="py-2 px-4 sm:px-5 text-right font-bold text-gray-900">
                        {conclusionData.totalLcValue ? `$ ${Math.round(conclusionData.totalLcValue).toLocaleString('en-US')}` : '-'}
                      </td>
                    </tr>

                    {/* 5. Calculation USD Rate */}
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-4 sm:px-5 font-semibold text-gray-700">Calculation USD Rate</td>
                      <td className="py-2 px-4 sm:px-5 text-right font-bold text-gray-900">
                        ৳ {conclusionData.dollarRate ? conclusionData.dollarRate.toFixed(2) : '0.00'}
                      </td>
                    </tr>

                    {/* 6. Total Value in BDT */}
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-4 sm:px-5 font-semibold text-gray-700">Total Value in BDT</td>
                      <td className="py-2 px-4 sm:px-5 text-right font-black text-blue-600">
                        ৳ {Math.round(conclusionData.totalRateKgBdt).toLocaleString('en-IN')}
                      </td>
                    </tr>

                    {/* Total COG IN BDT (C&F/Others) */}
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-4 sm:px-5 font-semibold text-gray-700">Total COG IN BDT (C&F/Others)</td>
                      <td className="py-2 px-4 sm:px-5 text-right font-black text-gray-900">
                        ৳ {Math.round(conclusionData.totalCogBdt || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>

                    {/* Insurance */}
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-4 sm:px-5 font-semibold text-gray-700">Insurance</td>
                      <td className="py-2 px-4 sm:px-5 text-right font-bold text-gray-900">
                        ৳ {Math.round(conclusionData.insuranceAmount).toLocaleString('en-IN')}
                      </td>
                    </tr>

                    {/* Total Invest */}
                    <tr className="bg-blue-50/40 hover:bg-blue-50/60 transition-colors border-t border-b border-blue-100">
                      <td className="py-2.5 px-4 sm:px-5 font-black text-blue-950 text-sm sm:text-base">Total Invest</td>
                      <td className="py-2.5 px-4 sm:px-5 text-right font-black text-blue-700 text-sm sm:text-base">
                        ৳ {Math.round(conclusionData.totalInvest).toLocaleString('en-IN')}
                      </td>
                    </tr>

                    {/* 7. LC Inv Qty in kg */}
                    <tr className="bg-blue-50/30 hover:bg-blue-50/50 transition-colors">
                      <td className="py-2.5 px-4 sm:px-5 font-bold text-blue-950">LC Inv Qty in kg</td>
                      <td className="py-2.5 px-4 sm:px-5 text-right font-black text-blue-900">
                        {Math.round(conclusionData.invQtyKg).toLocaleString('en-US')} KG
                      </td>
                    </tr>

                    {/* Total Rate/kg in BDT */}
                    <tr className="bg-emerald-50/40 hover:bg-emerald-50/60 transition-colors">
                      <td className="py-2.5 px-4 sm:px-5 font-bold text-emerald-950">Total Rate/kg in BDT</td>
                      <td className="py-2.5 px-4 sm:px-5 text-right font-black text-emerald-700 break-words leading-relaxed">
                        {conclusionData.isMultiProduct
                          ? conclusionData.totalRatePerKgDisplay
                          : (conclusionData.totalRatePerKgBdt > 0 ? `৳ ${conclusionData.totalRatePerKgBdt.toFixed(2)}` : '-')}
                      </td>
                    </tr>

                    {/* 8. Rcv Qty in kg */}
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-4 sm:px-5 font-semibold text-gray-700">Rcv Qty in kg</td>
                      <td className="py-2 px-4 sm:px-5 text-right font-bold text-gray-900">
                        {Math.round(conclusionData.rcvQtyKg).toLocaleString('en-US')} KG
                      </td>
                    </tr>

                    {/* 14. Short Qty in kg */}
                    <tr className="bg-rose-50/40 hover:bg-rose-50/60 transition-colors">
                      <td className="py-2.5 px-4 sm:px-5 font-bold text-rose-950">Short Qty in kg</td>
                      <td className="py-2.5 px-4 sm:px-5 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-700 border border-rose-200">
                          {Math.round(conclusionData.shortQtyKg).toLocaleString('en-US')} KG
                        </span>
                      </td>
                    </tr>

                    {/* Damage Qty in kg */}
                    <tr className="bg-rose-50/30 hover:bg-rose-50/50 transition-colors">
                      <td className="py-2.5 px-4 sm:px-5 font-bold text-rose-950">Damage Qty in kg</td>
                      <td className="py-2.5 px-4 sm:px-5 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-700 border border-rose-200">
                          {Math.round(conclusionData.damageQtyKg || 0).toLocaleString('en-US')} KG
                        </span>
                      </td>
                    </tr>

                    {/* 12. Sales Qty in kg */}
                    <tr className="bg-orange-50/30 hover:bg-orange-50/50 transition-colors">
                      <td className="py-2.5 px-4 sm:px-5 font-bold text-orange-950">Sales Qty in kg</td>
                      <td className="py-2.5 px-4 sm:px-5 text-right font-black text-orange-800">
                        {Math.round(conclusionData.salesQtyKg).toLocaleString('en-US')} KG
                      </td>
                    </tr>

                    {/* 19. Sales Value/kg */}
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-4 sm:px-5 font-semibold text-gray-700">Sales Value/kg</td>
                      <td className="py-2 px-4 sm:px-5 text-right font-bold text-gray-900 break-words leading-relaxed">
                        {conclusionData.isMultiProduct
                          ? conclusionData.salesValuePerKgDisplay
                          : (conclusionData.salesValuePerKg > 0 ? `৳ ${conclusionData.salesValuePerKg.toFixed(2)}` : '-')}
                      </td>
                    </tr>

                    {/* 18. Sales Value */}
                    <tr className="bg-amber-50/30 hover:bg-amber-50/50 transition-colors">
                      <td className="py-2.5 px-4 sm:px-5 font-black text-amber-950 text-sm sm:text-base">Sales Value</td>
                      <td className="py-2.5 px-4 sm:px-5 text-right font-black text-gray-900 text-sm sm:text-base">
                        ৳ {Math.round(conclusionData.salesValue).toLocaleString('en-IN')}
                      </td>
                    </tr>

                    {/* 13. Unsold Stock in kg */}
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-4 sm:px-5 font-semibold text-gray-700">Unsold Stock in kg</td>
                      <td className="py-2 px-4 sm:px-5 text-right font-bold text-gray-900">
                        {Math.round(conclusionData.unsoldStockKg).toLocaleString('en-US')} KG
                      </td>
                    </tr>

                    {/* 20. Unsold Stock Price (Appx) */}
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-4 sm:px-5 font-semibold text-gray-700">Unsold Stock Price (Appx)</td>
                      <td className="py-2 px-4 sm:px-5 text-right font-bold text-gray-900">
                        {conclusionData.unsoldStockPriceAppx > 0 ? `৳ ${Math.round(conclusionData.unsoldStockPriceAppx).toLocaleString('en-IN')}` : '-'}
                      </td>
                    </tr>

                    {/* 21. Profit/Loss */}
                    <tr className="bg-slate-50 hover:bg-slate-100/80 transition-colors border-t-2 border-gray-200">
                      <td className="py-3 px-4 sm:px-5 font-black text-gray-900 text-sm sm:text-base uppercase tracking-wider">
                        {conclusionData.profitOrLoss >= 0 ? 'Profit' : 'Loss'}
                      </td>
                      <td className="py-3 px-4 sm:px-5 text-right">
                        <span className={`text-base sm:text-lg font-black ${conclusionData.profitOrLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {conclusionData.profitOrLoss < 0 ? `- ৳ ${Math.abs(Math.round(conclusionData.profitOrLoss)).toLocaleString('en-IN')}` : `৳ ${Math.round(conclusionData.profitOrLoss).toLocaleString('en-IN')}`}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      </div>
    </div>
  );
}
