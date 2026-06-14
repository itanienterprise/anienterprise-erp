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

    // Look for records containing transfer properties or location with "transfer" or negative values
    const transfers = warehouseData.filter(w =>
        (w.location || '').toLowerCase().includes('transfer') ||
        (w.transferPkt !== undefined && w.transferPkt !== 0) ||
        (w.whQty < 0)
    );

    console.log(`Found ${transfers.length} potential transfer warehouse records:`);
    transfers.slice(0, 10).forEach(w => {
        console.log(JSON.stringify(w, null, 2));
    });

    process.exit(0);
});
