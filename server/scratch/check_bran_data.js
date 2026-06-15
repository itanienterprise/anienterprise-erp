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

mongoose.connect('mongodb://localhost:27017/erp_db').then(async () => {
    const rawStock = await Stock.find({});
    const stockRecords = rawStock.map(decryptRecord);
    
    const rawWh = await Warehouse.find({});
    const warehouseData = rawWh.map(decryptRecord);
    
    const rawSales = await Sale.find({});
    const salesRecords = rawSales.map(decryptRecord);
    
    const rawDamages = await Damage.find({});
    const damages = rawDamages.map(decryptRecord);

    console.log('--- ALL BRANDS FOR BRAN IN STOCK RECORDS ---');
    stockRecords.forEach(s => {
        const p = (s.productName || s.product || '').trim().toUpperCase();
        if (p === 'BRAN') {
            if (s.brandEntries) {
                s.brandEntries.forEach(be => {
                    console.log(`Stock ID: ${s._id} | Brand: '${be.brand}' | Qty: ${be.quantity} | InHouseQty: ${be.inHouseQuantity ?? be.inhouseQty} | WH: ${s.warehouse || s.whName}`);
                });
            } else {
                console.log(`Stock ID: ${s._id} | Brand: '${s.brand}' | Qty: ${s.quantity} | InHouseQty: ${s.inHouseQuantity ?? s.inhouseQty} | WH: ${s.warehouse || s.whName}`);
            }
        }
    });

    console.log('\n--- ALL BRANDS FOR BRAN IN WAREHOUSE RECORDS ---');
    warehouseData.forEach(w => {
        const p = (w.productName || w.product || '').trim().toUpperCase();
        if (p === 'BRAN') {
            console.log(`WH ID: ${w._id} | Brand: '${w.brand}' | Qty: ${w.whQty ?? w.quantity} | InHouseQty: ${w.inHouseQuantity ?? w.inhouseQty} | WH: ${w.whName || w.warehouse} | Location: '${w.location}'`);
        }
    });

    console.log('\n--- ALL BRANDS FOR BRAN IN SALES RECORDS ---');
    salesRecords.forEach(s => {
        const sStatus = (s.status || '').toLowerCase();
        if (sStatus !== 'accepted' && sStatus !== 'pending') return;
        (s.items || []).forEach(si => {
            const p = (si.productName || si.product || '').trim().toUpperCase();
            if (p === 'BRAN') {
                if (si.brandEntries) {
                    si.brandEntries.forEach(be => {
                        console.log(`Sale ID: ${s._id} | Brand: '${be.brand}' | Qty: ${be.quantity} | WH: ${be.warehouseName || si.whName || s.warehouse || s.whName}`);
                    });
                } else {
                    console.log(`Sale ID: ${s._id} | Brand: '${si.brand}' | Qty: ${si.quantity} | WH: ${si.whName || s.warehouse || s.whName}`);
                }
            }
        });
    });

    process.exit(0);
});
