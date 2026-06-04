const mongoose = require('mongoose');
const Stock = require('./src/models/Stock');
const { decryptData } = require('./src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (typeof d === 'string') {
        try { d = decryptData(d); } catch (e) {}
    } else if (d && d.data && typeof d.data === 'string' && !d.lcNo) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt.toISOString() };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawStock = await Stock.find({});
    const stocks = rawStock.map(decryptRecord);
    
    console.log("=== STOCK RECORDS LC NUMBERS ===");
    stocks.forEach(s => {
        if (s.lcNo) {
            console.log(`ID: ${s._id}, LC No: "${s.lcNo}", status: "${s.status}", bdCnF: "${s.bdCnF}", bdCnFCost: "${s.bdCnFCost}"`);
        }
    });

    process.exit(0);
});
