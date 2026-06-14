const mongoose = require('mongoose');
const Stock = require('../src/models/Stock');
const { decryptData } = require('../src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.productName) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt.toISOString() };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawStock = await Stock.find({});
    const stocks = rawStock.map(decryptRecord);
    
    console.log("=== STOCK RECORDS IN APRIL 2026 ===");
    let count = 0;
    stocks.forEach(s => {
        if (s.date && s.date.startsWith('2026-04')) {
            console.log(`ID: ${s._id} | Date: ${s.date} | LC: ${s.lcNo} | Prod: ${s.productName} | Wh: ${s.warehouse} | Importer: ${s.importer} | Exporter: ${s.exporter}`);
            count++;
        }
    });
    console.log(`Total April stock records: ${count}`);
    process.exit(0);
});
