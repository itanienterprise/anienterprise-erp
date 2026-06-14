const mongoose = require('mongoose');
const Sale = require('../src/models/Sale');
const Stock = require('../src/models/Stock');
const Warehouse = require('../src/models/Warehouse');
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

    console.log("=== DESHI TATKA WAREHOUSE RECORDS ===");
    warehouseData.forEach(w => {
        if ((w.brand || '').includes('DESHI TATKA')) {
            console.log(`WhID: ${w._id} | Name: ${w.whName} | Prod: ${w.productName || w.product} | Brand: ${w.brand} | Qty: ${w.whQty} | Location: ${w.location}`);
        }
    });

    console.log("\n=== DESHI TATKA SALES RECORDS ===");
    let totalSaleQty = 0;
    salesRecords.forEach(s => {
        (s.items || []).forEach(item => {
            (item.brandEntries || []).forEach(be => {
                if ((be.brand || '').includes('DESHI TATKA')) {
                    console.log(`Invoice: ${s.invoiceNo} | Date: ${s.date} | Status: ${s.status} | Brand: ${be.brand} | Qty: ${be.quantity} | Wh: ${be.warehouseName}`);
                    totalSaleQty += parseFloat(be.quantity || 0);
                }
            });
        });
    });
    console.log(`Total Sales Quantity: ${totalSaleQty}`);

    process.exit(0);
});
