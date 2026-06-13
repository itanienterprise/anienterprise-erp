const mongoose = require('mongoose');
const Stock = require('../src/models/Stock');
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
    const rawStock = await Stock.find({});
    const stockRecords = rawStock.map(decryptRecord);
    
    stockRecords.forEach(s => {
        if ((s.productName || s.product || '').toUpperCase() === 'BRAN') {
            console.log(`StockID: ${s._id}`);
            console.log(`  LC: ${s.lcNo} | Prod: ${s.productName} | Brand: ${s.brand} | Wh: ${s.warehouse || s.whName}`);
            console.log(`  Qty: ${s.quantity} | InHouseQty: ${s.inHouseQuantity} | status: ${s.status}`);
            console.log(`  brandEntries:`, JSON.stringify(s.brandEntries));
        }
    });
    process.exit(0);
});
