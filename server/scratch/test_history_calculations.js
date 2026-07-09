const mongoose = require('mongoose');
const Sale = require('../src/models/Sale');
const Stock = require('../src/models/Stock');
const Warehouse = require('../src/models/Warehouse');
const Product = require('../src/models/Product');
const Damage = require('../src/models/Damage');
const { decryptData } = require('../src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.productName && !d.whName && !d.warehouse) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id.toString(), createdAt: r.createdAt.toISOString() };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawSales = await Sale.find({});
    const salesRecords = rawSales.map(decryptRecord);
    
    const rawStock = await Stock.find({});
    const stockRecords = rawStock.map(decryptRecord);
    
    const rawWh = await Warehouse.find({});
    const warehouseData = rawWh.map(r => ({ ...decryptRecord(r), recordType: 'warehouse' }));
    
    const rawProd = await Product.find({});
    const products = rawProd.map(decryptRecord);

    const rawDamages = await Damage.find({});
    const damages = rawDamages.map(decryptRecord);

    const productName = 'chick peas';
    const historyFilters = {};
    const historySearchQuery = '';
    const searchLower = '';

    console.log("=== RUNNING HISTORY SIMULATION FOR CHICK PEAS ===");

    // 1. activePurchaseHistory Simulation
    const consumedWhIds = new Set();

    const filteredRaw = (stockRecords || []).filter(item => {
        const status = (item.status || '').toLowerCase();
        if (status.includes('requested') || status.includes('rejected') || status.includes('deleted')) return false;

        const matchesProduct = (item.productName || item.product || '').trim().toLowerCase() === productName;
        if (!matchesProduct) return false;

        return true;
    });

    const groupedMap = filteredRaw.reduce((acc, item) => {
        const key = `${item.date}_${item.lcNo}_${item.truckNo}`;
        const normalizeStr = (s) => (s || '').toString().trim().toLowerCase();
        const targetLC = normalizeStr(item.lcNo);
        const targetTruck = normalizeStr(item.truckNo);
        const targetProd = normalizeStr(item.productName || item.product);
        const targetBrand = normalizeStr(item.brand);

        const relatedWhRecords = (warehouseData || []).filter(w => {
            if (w.recordType !== 'warehouse') return false;
            
            const wLC = normalizeStr(w.lcNo);
            const wTruck = normalizeStr(w.truckNo);
            const wProd = normalizeStr(w.productName || w.product);
            const wBrand = normalizeStr(w.brand);
            const isBasicMatch = wLC === targetLC && wProd === targetProd && wBrand === targetBrand && (wTruck === targetTruck || (!wTruck && !targetTruck));
            if (!isBasicMatch) return false;

            const wDateVal = w.date || w.createdAt || w.updatedAt;
            const wDate = wDateVal ? wDateVal.toString().split('T')[0] : '';
            const itemDate = (item.date || '').split('T')[0];
            if (wDate && itemDate && wDate < itemDate) return false;

            const otherMatchingStocks = filteredRaw.filter(s => {
                const sLC = normalizeStr(s.lcNo);
                const sTruck = normalizeStr(s.truckNo);
                const sProd = normalizeStr(s.productName || s.product);
                const sBrand = normalizeStr(s.brand);
                return sLC === wLC && sProd === wProd && sBrand === wBrand && (sTruck === wTruck || (!sTruck && !wTruck));
            });

            let bestStock = null;
            let bestStockDate = '';
            for (const s of otherMatchingStocks) {
                const sDate = (s.date || '').split('T')[0];
                if (wDate && sDate && sDate <= wDate) {
                    if (!bestStockDate || sDate > bestStockDate) {
                        bestStock = s;
                        bestStockDate = sDate;
                    }
                }
            }

            if (bestStock) {
                const matches = bestStock._id === item._id;
                if (matches) consumedWhIds.add(w._id);
                return matches;
            }
            consumedWhIds.add(w._id);
            return true;
        });

        const whOnlyQty = relatedWhRecords.reduce((sum, r) => sum + (parseFloat(r.whQty) || 0), 0);
        const whOnlyPkt = relatedWhRecords.reduce((sum, r) => sum + (parseFloat(r.whPkt) || 0), 0);
        
        const itemInHouseQty = parseFloat(item.inHouseQuantity) || 0;
        const itemInHousePkt = parseFloat(item.inHousePacket) || 0;

        const physicalWhQty = itemInHouseQty + whOnlyQty;
        const physicalWhPkt = itemInHousePkt + whOnlyPkt;
        const saleQty = relatedWhRecords.reduce((sum, r) => sum + (parseFloat(r.saleQuantity) || 0), 0);
        const salePkt = relatedWhRecords.reduce((sum, r) => sum + (parseFloat(r.salePacket) || 0), 0);
        const shortageQty = parseFloat(item.sweepedQuantity) || 0;

        if (!acc[key]) {
            acc[key] = {
                ...item,
                allIds: [item._id],
                brandsProcessed: new Set([targetBrand]),
                totalQuantity: parseFloat(item.quantity) || 0,
                totalPacket: parseFloat(item.packet) || 0,
                totalInHousePacket: physicalWhPkt,
                totalInHouseQuantity: physicalWhQty,
                totalShortage: shortageQty,
                totalSaleQuantity: saleQty,
                totalSalePacket: salePkt,
                entries: [{
                    brand: item.brand || item.productName,
                    purchasedPrice: item.purchasedPrice,
                    packet: item.packet,
                    packetSize: item.packetSize,
                    quantity: item.quantity,
                    inHousePacket: physicalWhPkt,
                    inHouseQuantity: physicalWhQty,
                    sweepedPacket: item.sweepedPacket,
                    sweepedQuantity: item.sweepedQuantity,
                    saleQuantity: saleQty,
                    salePacket: salePkt,
                    unit: item.unit
                }]
            };
        } else {
            acc[key].allIds.push(item._id);
            acc[key].totalQuantity += parseFloat(item.quantity) || 0;
            acc[key].totalPacket += parseFloat(item.packet) || 0;
            
            if (!acc[key].brandsProcessed.has(targetBrand)) {
                acc[key].totalInHousePacket += physicalWhPkt;
                acc[key].totalInHouseQuantity += physicalWhQty;
                acc[key].brandsProcessed.add(targetBrand);
            } else {
                acc[key].totalInHousePacket += itemInHousePkt;
                acc[key].totalInHouseQuantity += itemInHouseQty;
            }
            
            acc[key].totalShortage += shortageQty;
            acc[key].totalSaleQuantity += saleQty;
            acc[key].totalSalePacket += salePkt;
            acc[key].entries.push({
                brand: item.brand || item.productName,
                purchasedPrice: item.purchasedPrice,
                packet: item.packet,
                packetSize: item.packetSize,
                quantity: item.quantity,
                inHousePacket: physicalWhPkt,
                inHouseQuantity: physicalWhQty,
                sweepedPacket: item.sweepedPacket,
                sweepedQuantity: item.sweepedQuantity,
                saleQuantity: saleQty,
                salePacket: salePkt,
                unit: item.unit
            });
        }
        return acc;
    }, {});

    // Include unmatched warehouse records
    const unmatchedWhRecords = (warehouseData || []).filter(w => {
        if (w.recordType !== 'warehouse') return false;
        if (consumedWhIds.has(w._id)) return false;

        const wProd = (w.productName || w.product || '').trim().toLowerCase();
        if (wProd !== productName) return false;

        return true;
    });

    unmatchedWhRecords.forEach(w => {
        const wDateVal = w.date || w.createdAt || w.updatedAt;
        const wDate = wDateVal ? wDateVal.toString().split('T')[0] : new Date().toISOString().split('T')[0];
        const wBrand = w.brand || 'No Brand';
        const key = `${wDate}_${w.lcNo || 'adjustment'}_wh_${w._id}`;

        const whQty = parseFloat(w.whQty) || parseFloat(w.quantity) || 0;
        const whPkt = parseFloat(w.whPkt) || parseFloat(w.packet) || 0;

        groupedMap[key] = {
            ...w,
            _id: w._id,
            date: wDate,
            lcNo: w.lcNo || '-',
            truckNo: w.truckNo || '-',
            allIds: [w._id],
            brandsProcessed: new Set([wBrand.trim().toLowerCase()]),
            totalQuantity: whQty,
            totalPacket: whPkt,
            totalInHousePacket: whPkt,
            totalInHouseQuantity: whQty,
            totalShortage: 0,
            totalSaleQuantity: 0,
            totalSalePacket: 0,
            entries: [{
                brand: wBrand,
                purchasedPrice: w.purchasedPrice || '',
                packet: whPkt,
                packetSize: w.packetSize || 30,
                quantity: whQty,
                inHousePacket: whPkt,
                inHouseQuantity: whQty,
                sweepedPacket: 0,
                sweepedQuantity: 0,
                saleQuantity: 0,
                salePacket: 0,
                unit: w.unit || 'kg'
            }]
        };
    });

    const activePurchaseHistory = Object.values(groupedMap).sort((a, b) => new Date(a.date) - new Date(b.date));

    // 2. activeSaleHistory Simulation
    const filteredSales = (salesRecords || []).filter(sale => {
        const status = (sale.status || '').toLowerCase();
        if (status !== 'accepted' && status !== 'pending') return false;

        const hasMatchingProduct = (sale.items || []).some(item =>
            (item.productName || '').trim().toLowerCase() === productName
        );
        if (!hasMatchingProduct) return false;
        return true;
    });

    const activeSaleHistory = [];
    filteredSales.forEach(sale => {
        const matchingItems = (sale.items || []).filter(item =>
            (item.productName || '').trim().toLowerCase() === productName
        );
        matchingItems.forEach(item => {
            (item.brandEntries || []).forEach(entry => {
                activeSaleHistory.push({
                    ...sale,
                    itemBrand: entry.brand,
                    itemQty: entry.quantity,
                    itemPacket: entry.packet,
                    itemTotal: sale.invoiceTotal || sale.totalAmount
                });
            });
        });
    });

    // 3. Flatten purchase history (just like handleGenerateProductReport does)
    const purchaseFlattened = [];
    activePurchaseHistory.forEach(record => {
        const entries = record.brandEntries || record.entries || [];
        entries.forEach(entry => {
            purchaseFlattened.push({
                ...record,
                itemBrand: entry.brand,
                itemQty: entry.quantity,
                itemInHouseQty: entry.inHouseQuantity,
                itemShortageQty: entry.sweepedQuantity,
                type: 'purchase'
            });
        });
    });

    const saleFlattened = activeSaleHistory.map(s => ({ ...s, type: 'sale', itemQty: parseFloat(s.itemQty) || 0 }));
    
    const damageFlattened = (damages || []).filter(d => {
        const pMatch = (d.productName || '').trim().toLowerCase() === productName;
        return pMatch;
    }).map(d => ({
        ...d,
        itemBrand: d.brand,
        itemQty: d.quantity,
        type: 'damage'
    }));

    // 4. Calculate Running Balance
    const combined = [...purchaseFlattened, ...saleFlattened, ...damageFlattened].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let currentBalance = 0;
    const unifiedHistory = combined.map(item => {
        if (item.type === 'purchase') {
            currentBalance += item.itemQty - (item.itemShortageQty || 0);
        } else if (item.type === 'sale') {
            currentBalance -= item.itemQty;
        } else if (item.type === 'damage') {
            currentBalance -= item.itemQty;
        }
        return { ...item, runningInHouse: currentBalance };
    });

    console.log(`\nTotal Purchase Qty: ${purchaseFlattened.reduce((sum, item) => sum + (parseFloat(item.itemQty) || 0), 0)}`);
    console.log(`Total Shortage Qty: ${purchaseFlattened.reduce((sum, item) => sum + (parseFloat(item.itemShortageQty) || 0), 0)}`);
    console.log(`Total Sale Qty: ${saleFlattened.reduce((sum, item) => sum + (parseFloat(item.itemQty) || 0), 0)}`);
    console.log(`Final Running InHouse Balance: ${unifiedHistory[unifiedHistory.length - 1]?.runningInHouse}`);

    process.exit(0);
});
