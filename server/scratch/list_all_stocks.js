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
    
    console.log(`Total stock records: ${stockRecords.length}`);
    stockRecords.forEach((s, idx) => {
        console.log(`${idx + 1}. ID: ${s._id} | LC: ${s.lcNo} | Prod: ${s.productName || s.product} | Brand: ${s.brand} | Wh: ${s.warehouse || s.whName} | Qty: ${s.quantity} | InHouseQty: ${s.inHouseQuantity} | status: ${s.status}`);
        if (s.brandEntries && s.brandEntries.length > 0) {
            console.log(`   BrandEntries:`, JSON.stringify(s.brandEntries));
        }
    });

    process.exit(0);
});
