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
    console.log(`Total Stock records: ${rawStocks.length}`);
    
    rawStocks.forEach((s) => {
        const d = decryptRecord(s);
        if (d) {
            console.log(`ID: ${d._id} | Date: ${d.date} | LC No: ${d.lcNo} | Product: ${d.productName} | billOfEntry: ${d.billOfEntry} | bdCnF: ${d.bdCnF}`);
        }
    });
    
    process.exit(0);
});
