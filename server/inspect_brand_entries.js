const mongoose = require('mongoose');
const Stock = require('./src/models/Stock');
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
    const rawStock = await Stock.find({});
    const stockRecords = rawStock.map(decryptRecord);
    
    stockRecords.forEach(s => {
        const prod = (s.productName || s.product || '').toUpperCase();
        if (prod.includes('MOSUR')) {
            console.log(`ID: ${s._id} | Prod: ${s.productName} | Brand: ${s.brand} | Wh: ${s.warehouse || s.whName} | Qty: ${s.quantity} | BrandEntries:`, s.brandEntries);
        }
    });
    process.exit(0);
});
