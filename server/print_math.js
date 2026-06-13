const mongoose = require('mongoose');
const Sale = require('./src/models/Sale');
const Stock = require('./src/models/Stock');
const Warehouse = require('./src/models/Warehouse');
const Damage = require('./src/models/Damage');
const { decryptData } = require('./src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.productName && !d.whName && !d.warehouse) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id };
}

mongoose.connect('mongodb://localhost:27017/erp_db').then(async () => {
    const rawSales = await Sale.find({});
    const sales = rawSales.map(decryptRecord);
    
    const rawStock = await Stock.find({});
    const stockRecords = rawStock.map(decryptRecord);
    
    const rawWh = await Warehouse.find({});
    const warehouseRecords = rawWh.map(decryptRecord);
    
    const rawDamages = await Damage.find({});
    const damages = rawDamages.map(decryptRecord);
    
    console.log("=== STOCKS ===");
    stockRecords.forEach(s => {
        if (s && (s.productName || '').toLowerCase().trim() === 'bran' && (s.brand || '').toLowerCase().trim() === 'kheshari vusi') {
            console.log(`LC: ${s.lcNo} | Wh: ${s.warehouse} | Qty: ${s.quantity} | InHouseQty: ${s.inHouseQuantity}`);
        }
    });

    console.log("=== WAREHOUSES ===");
    warehouseRecords.forEach(w => {
        if (w && (w.productName || w.product || '').toLowerCase().trim() === 'bran' && (w.brand || '').toLowerCase().trim() === 'kheshari vusi') {
            console.log(`Name: ${w.whName} | Qty: ${w.whQty}`);
        }
    });

    console.log("=== SALES ===");
    sales.forEach(s => {
        const sStatus = (s.status || '').toLowerCase();
        if (sStatus !== 'accepted' && sStatus !== 'pending') return;
        (s.items || []).forEach(item => {
            if ((item.productName || '').toLowerCase().trim() === 'bran') {
                (item.brandEntries || []).forEach(be => {
                    if ((be.brand || '').toLowerCase().trim() === 'kheshari vusi') {
                        console.log(`Invoice: ${s.invoiceNo} | Wh: ${be.warehouseName} | Qty: ${be.quantity}`);
                    }
                });
            }
        });
    });

    console.log("=== DAMAGES ===");
    damages.forEach(d => {
        if (d && (d.productName || d.product || '').toLowerCase().trim() === 'bran' && (d.brand || '').toLowerCase().trim() === 'kheshari vusi') {
            console.log(`Wh: ${d.warehouse} | Qty: ${d.quantity}`);
        }
    });

    process.exit(0);
});
