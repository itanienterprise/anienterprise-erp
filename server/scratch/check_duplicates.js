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
    return { ...d, _id: r._id, createdAt: r.createdAt.toISOString() };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawSales = await Sale.find({});
    const salesRecords = rawSales.map(decryptRecord);
    
    const rawStock = await Stock.find({});
    const stockRecords = rawStock.map(decryptRecord);
    
    const rawWh = await Warehouse.find({});
    const warehouseData = rawWh.map(r => ({ ...decryptRecord(r), recordType: 'warehouse' }));
    
    // In App.jsx, warehouseData is passed as combinedData = [...allDecryptedWh, ...decryptedStock]
    // Let's simulate that!
    const allDecryptedWh = warehouseData.map(item => ({
        ...item,
        whPkt: parseFloat(item.whPkt || 0),
        whQty: parseFloat(item.whQty || 0),
        recordType: 'warehouse'
    }));
    const decryptedStock = stockRecords.map(item => {
        const itemStatus = (item.status || '').toLowerCase();
        if (itemStatus.includes('requested') || itemStatus.includes('rejected')) return null;
        return {
            ...item,
            recordType: 'stock'
        };
    }).filter(Boolean);
    const combinedWhData = [...allDecryptedWh, ...decryptedStock];

    // Let's run the rawExpanded logic
    const seenRecords = new Set();
    const rawExpanded = [];
    
    // 1. Step 1: stockRecords
    stockRecords.forEach(item => {
        const itemStatus = (item.status || '').toLowerCase();
        if (itemStatus.includes('requested') || itemStatus.includes('rejected')) return;

        if (item.brandEntries && item.brandEntries.length > 0) {
            item.brandEntries.forEach((entry, idx) => {
                const uniqueId = `${item._id}_brand_${idx}`;
                seenRecords.add(uniqueId);
                rawExpanded.push({ _id: uniqueId, productName: item.productName || item.product, brand: entry.brand || item.brand, quantity: entry.quantity, recordType: 'stock_step1_brand' });
            });
        } else {
            seenRecords.add(item._id);
            rawExpanded.push({ _id: item._id, productName: item.productName || item.product, brand: item.brand, quantity: item.quantity, recordType: 'stock_step1_nobrand' });
        }
    });

    console.log(`After Step 1: rawExpanded count = ${rawExpanded.length}`);

    // 2. Step 2: combinedWhData
    let duplicates = 0;
    combinedWhData.forEach(whItem => {
        if (!whItem || (whItem.location || '').trim().toLowerCase() === 'returned stock') return;
        if (whItem.recordType !== 'warehouse' && !whItem.productName && !whItem.product) return;
        if (seenRecords.has(whItem._id)) return;
        seenRecords.add(whItem._id);
        
        rawExpanded.push({ _id: whItem._id, productName: whItem.productName || whItem.product, brand: whItem.brand, quantity: whItem.whQty || whItem.quantity, recordType: whItem.recordType + '_step2' });
        if (whItem.recordType === 'stock') {
            duplicates++;
            console.log(`Duplicate Stock added in Step 2: ID=${whItem._id} | Prod=${whItem.productName} | Brand=${whItem.brand} | Qty=${whItem.quantity}`);
        }
    });

    console.log(`After Step 2: rawExpanded count = ${rawExpanded.length}, duplicate stock records added = ${duplicates}`);
    
    process.exit(0);
});
