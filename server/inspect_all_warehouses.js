const mongoose = require('mongoose');
const Warehouse = require('./src/models/Warehouse');
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
    const rawWh = await Warehouse.find({});
    const warehouses = rawWh.map(decryptRecord);
    
    console.log("=== ALL WAREHOUSE RECORDS ===");
    console.log(JSON.stringify(warehouses, null, 2));
    process.exit(0);
});
