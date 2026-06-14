const mongoose = require('mongoose');
const Warehouse = require('../src/models/Warehouse');
const { decryptData } = require('../src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string') {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt.toISOString() };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawWh = await Warehouse.find({});
    const warehouseData = rawWh.map(r => ({ ...decryptRecord(r), _id: r._id }));

    console.log("Details of first 10 warehouse records:");
    warehouseData.slice(0, 10).forEach((w, idx) => {
        console.log(`\nRecord ${idx + 1}:`);
        console.log(JSON.stringify(w, null, 2));
    });

    process.exit(0);
});
