const { calculateStockData } = require('../client/src/utils/stockHelpers.js');
const mongoose = require('mongoose');
const Sale = require('./src/models/Sale');
const Stock = require('./src/models/Stock');
const Warehouse = require('./src/models/Warehouse');
const Product = require('./src/models/Product');
const Damage = require('./src/models/Damage');
const { decryptData } = require('./src/utils/encryption');

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
    console.log(`rawSales: ${rawSales.length}, salesRecords: ${salesRecords.length}`);
    
    const rawStock = await Stock.find({});
    const stockRecords = rawStock.map(decryptRecord);
    console.log(`rawStock: ${rawStock.length}, stockRecords: ${stockRecords.length}`);
    
    const rawWh = await Warehouse.find({});
    const warehouseData = rawWh.map(r => ({ ...decryptRecord(r), recordType: 'warehouse' }));
    console.log(`rawWh: ${rawWh.length}, warehouseData: ${warehouseData.length}`);
    
    const rawProd = await Product.find({});
    const products = rawProd.map(r => ({ ...decryptData(r.data), _id: r._id, createdAt: r.createdAt.toISOString() }));

    const rawDamages = await Damage.find({});
    const damages = rawDamages.map(r => ({ ...decryptData(r.data), _id: r._id, createdAt: r.createdAt.toISOString() }));

    console.log("=== RUNNING DETAILED STOCK LOGS ===");

    // We can print the rawExpanded items for BRAN / KHESHARI VUSI
    const rawExpanded = [];
    const seenRecords = new Set();
    
    // Copy the logic from stockHelpers to inspect rawExpanded
    stockRecords.forEach(item => {
        const itemStatus = (item.status || '').toLowerCase();
        if (itemStatus.includes('requested') || itemStatus.includes('rejected')) return;
        if (item.brandEntries && item.brandEntries.length > 0) {
            item.brandEntries.forEach((entry, idx) => {
                const uniqueId = `${item._id}_brand_${idx}`;
                if (seenRecords.has(uniqueId)) return;
                seenRecords.add(uniqueId);
                rawExpanded.push({
                    ...item,
                    _id: uniqueId,
                    brand: entry.brand || item.brand || '',
                    productName: item.productName || item.product || '',
                    warehouse: item.warehouse || item.whName || '',
                    quantity: parseFloat(entry.quantity ?? item.quantity) || 0,
                    packet: parseFloat(entry.packet ?? item.packet) || 0,
                    inHousePacket: parseFloat(entry.inHousePacket ?? entry.inhousePkt ?? item.inHousePacket) || 0,
                    inHouseQuantity: parseFloat(entry.inHouseQuantity ?? entry.inhouseQty ?? item.inHouseQuantity) || 0,
                    recordType: 'stock'
                });
            });
        } else {
            if (seenRecords.has(item._id)) return;
            seenRecords.add(item._id);
            rawExpanded.push({
                ...item,
                recordType: 'stock',
                inHouseQuantity: parseFloat(item.inHouseQuantity ?? item.inhouseQty ?? item.quantity) || 0,
                inHousePacket: parseFloat(item.inHousePacket ?? item.inhousePkt ?? item.packet) || 0
            });
        }
    });

    warehouseData.forEach(whItem => {
        if (!whItem || (whItem.recordType !== 'warehouse' && !whItem.productName && !whItem.product && (whItem.location || '').trim().toLowerCase() !== 'returned stock')) return;
        if (seenRecords.has(whItem._id)) return;
        seenRecords.add(whItem._id);
        rawExpanded.push({
            ...whItem,
            productName: whItem.productName || whItem.product || '',
            warehouse: whItem.whName || whItem.warehouse || '',
            quantity: parseFloat(whItem.whQty ?? whItem.quantity) || 0,
            packet: parseFloat(whItem.whPkt ?? whItem.packet) || 0,
            inHouseQuantity: parseFloat(whItem.whQty ?? whItem.inHouseQuantity) || 0,
            inHousePacket: parseFloat(whItem.whPkt ?? whItem.inHousePacket) || 0,
            recordType: 'warehouse'
        });
    });

    console.log("=== rawExpanded for KHESHARI VUSI ===");
    rawExpanded.forEach(x => {
        const prod = (x.productName || x.product || '').trim().toLowerCase();
        const brand = (x.brand || '').trim().toLowerCase();
        if (prod.includes('bran') || brand.includes('kheshari')) {
            console.log(`ID: ${x._id} | Prod: ${x.productName} | Brand: ${x.brand} | Wh: ${x.warehouse} | Qty: ${x.quantity} | inHouseQty: ${x.inHouseQuantity} | location: ${x.location} | recordType: ${x.recordType}`);
        }
    });

    const resNo = calculateStockData(stockRecords, {}, '', warehouseData, salesRecords, products, damages);
    const resWh = calculateStockData(stockRecords, { warehouse: 'BHOMRA' }, '', warehouseData, salesRecords, products, damages);

    // Let's trace GS0148 in salesRecords
    const sale = salesRecords.find(s => s.invoiceNo === 'GS0148');
    console.log("=== TRACING GS0148 ===");
    console.log("All invoice numbers:", salesRecords.map(s => s.invoiceNo).filter(Boolean));
    if (!sale) {
        console.log("GS0148 NOT FOUND!");
        process.exit(0);
    }
    console.log("Sale status:", sale.status);
    sale.items.forEach((si, siIdx) => {
        console.log(`Item ${siIdx}: ${si.productName}`);
        si.brandEntries.forEach((be, beIdx) => {
            console.log(`  BrandEntry ${beIdx}: Brand=${be.brand}, WhName=${be.warehouseName}, Qty=${be.quantity}, returnQty=${be.returnQty}`);
            
            // Check matching logic
            const keyLower = 'bran';
            const normBrand = 'kheshari vusi';
            const normQuality = '-';
            const siName = (si.productName || si.product || '').trim().toLowerCase();
            console.log("    siName matches keyLower:", siName === keyLower);
            
            const beBrand = (be.brand || 'No Brand').trim().toLowerCase();
            const rq = resolveQuality(siName, be.brand);
            let beQualityRaw = rq !== '-' ? rq : (be.quality || '-');
            let beQuality = beQualityRaw.trim().toLowerCase();

            if (beBrand === normBrand && beQuality === '-' && normQuality !== '-') {
                beQuality = normQuality;
            }
            console.log("    beBrand matches normBrand:", beBrand === normBrand);
            console.log(`    beQuality matches normQuality (${beQuality} vs ${normQuality}):`, beQuality === normQuality);
        });
    });

    function resolveQuality(pName, bName) {
        if (!products || !Array.isArray(products)) return '-';
        const targetP = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === (pName || '').trim().toLowerCase());
        if (!targetP) return '-';
        if (bName) {
            const targetB = (targetP.brands || []).find(b => (b.brand || '').trim().toLowerCase() === (bName || '').trim().toLowerCase());
            if (targetB && targetB.quality && targetB.quality.trim() !== '') return targetB.quality.trim();
        }
        if (targetP.quality && targetP.quality.trim() !== '') return targetP.quality.trim();
        return '-';
    }

    process.exit(0);
});
