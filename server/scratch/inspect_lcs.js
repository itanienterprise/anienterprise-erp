const mongoose = require('mongoose');
const LCManagement = require('../src/models/LCManagement');
const { decryptData } = require('../src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.lcNo && !d.lcNoVal) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt.toISOString() };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawLCs = await LCManagement.find({});
    console.log(`Total LC records: ${rawLCs.length}`);
    
    rawLCs.forEach((lc, idx) => {
        const d = decryptRecord(lc);
        console.log(`${idx + 1}. ID: ${d._id} | LC No: ${d.lcNo || d.lcNoVal} | Importer: ${d.importer} | Exporter: ${d.exporter} | Product: ${d.productName || d.product} | Qty: ${d.quantity || d.lcQty}`);
    });
    
    process.exit(0);
});
