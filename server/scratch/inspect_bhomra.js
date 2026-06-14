const mongoose = require('mongoose');
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
    const rawWh = await Warehouse.find({});
    const warehouseData = rawWh.map(r => ({ ...decryptRecord(r), _id: r._id }));

    const filtered = warehouseData.filter(w =>
        (w.productName || w.product || '').toLowerCase().trim() === 'bran' &&
        (w.brand || '').toLowerCase().trim() === 'kheshari vusi' &&
        (w.whName || w.warehouse || '').toLowerCase().trim() === 'bhomra'
    );

    console.log(`Found ${filtered.length} warehouse records:`);
    filtered.forEach(w => {
        console.log(`ID: ${w._id} | WH Name: ${w.whName} | Location: ${w.location} | Qty: ${w.whQty} | Pkt: ${w.whPkt} | Date: ${w.date} | recordType: ${w.recordType}`);
    });

    process.exit(0);
});
