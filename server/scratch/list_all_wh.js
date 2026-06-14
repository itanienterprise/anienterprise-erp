const mongoose = require('mongoose');
const Warehouse = require('../src/models/Warehouse');
const { decryptData } = require('../src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.whName) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt.toISOString() };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawWh = await Warehouse.find({});
    console.log(`Total warehouse records: ${rawWh.length}`);
    
    rawWh.forEach((w, idx) => {
        const d = decryptRecord(w);
        console.log(`${idx + 1}. ID: ${d._id} | Wh: ${d.whName} | Prod: ${d.productName || d.product} | Brand: ${d.brand} | Qty: ${d.whQty} | Pkt: ${d.whPkt} | Location: ${d.location} | Status: ${d.status}`);
    });
    
    process.exit(0);
});
