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

mongoose.connect('mongodb://localhost:27017/erp_db').then(async () => {
    const rawSales = await Sale.find({});
    const salesRecords = rawSales.map(decryptRecord);
    
    const rawStock = await Stock.find({});
    const stockRecords = rawStock.map(decryptRecord);
    
    const rawWh = await Warehouse.find({});
    const warehouseData = rawWh.map(r => ({ ...decryptRecord(r), recordType: 'warehouse' }));

    console.log("=== GDP MOSUR DAL STOCK RECORDS ===");
    stockRecords.forEach(s => {
        const prod = (s.productName || s.product || '').toUpperCase();
        if (prod.includes('MOSUR')) {
            if (s.brandEntries && s.brandEntries.length > 0) {
                s.brandEntries.forEach(be => {
                    if ((be.brand || '').includes('G D P')) {
                        console.log(`StockID: ${s._id} | LC: ${s.lcNo} | Prod: ${s.productName} | Brand: ${be.brand} | Wh: ${s.warehouse || s.whName} | Qty: ${be.quantity} | InHouseQty: ${be.inhouseQty || be.inHouseQuantity}`);
                    }
                });
            } else if ((s.brand || '').includes('G D P')) {
                console.log(`StockID: ${s._id} | LC: ${s.lcNo} | Prod: ${s.productName} | Brand: ${s.brand} | Wh: ${s.warehouse || s.whName} | Qty: ${s.quantity} | InHouseQty: ${s.inHouseQuantity}`);
            }
        }
    });

    console.log("\n=== GDP MOSUR DAL WAREHOUSE RECORDS ===");
    warehouseData.forEach(w => {
        const prod = (w.productName || w.product || '').toUpperCase();
        const brand = (w.brand || '').toUpperCase();
        if (prod.includes('MOSUR') && brand.includes('G D P')) {
            console.log(`WhID: ${w._id} | Prod: ${w.productName} | Brand: ${w.brand} | WhName: ${w.whName} | Qty: ${w.whQty} | Location: ${w.location}`);
        }
    });

    process.exit(0);
});
