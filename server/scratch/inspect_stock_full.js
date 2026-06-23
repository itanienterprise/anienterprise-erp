const mongoose = require('mongoose');
const Stock = require('../src/models/Stock');
const { decryptData } = require('../src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string') {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt ? r.createdAt.toISOString() : '' };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawStocks = await Stock.find({});
    
    rawStocks.forEach((s) => {
        const d = decryptRecord(s);
        if (d && (d.lcNo === 'L1001' || d.lcNo === '100001')) {
            console.log("MATCHED STOCK RECORD:");
            console.log(d);
        }
    });
    
    process.exit(0);
});
