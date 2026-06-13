const mongoose = require('mongoose');
const Warehouse = require('./src/models/Warehouse');
const { decryptData } = require('./src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.productName && !d.whName && !d.warehouse) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id };
}

mongoose.connect('mongodb://localhost:27017/erp_db').then(async () => {
    const rawWh = await Warehouse.find({});
    const warehouseRecords = rawWh.map(decryptRecord);
    console.log(`=== WAREHOUSE RECORDS COUNT: ${warehouseRecords.length} ===`);
    warehouseRecords.forEach(w => {
        if (!w) return;
        console.log(`Name: ${w.whName} | Prod: ${w.productName || w.product} | Brand: ${w.brand} | Qty: ${w.whQty}`);
    });
    process.exit(0);
});
