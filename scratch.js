const mongoose = require('mongoose');
const Warehouse = require('./server/src/models/Warehouse');
const { decryptData } = require('./server/src/utils/encryption');

mongoose.connect('mongodb://localhost:27017/erp_db').then(async () => {
    const rawWh = await Warehouse.find({});
    const whRecords = rawWh.map(r => {
        let d = decryptData(r.data);
        if (d && d.data && typeof d.data === 'string' && !d.productName) {
            try { d = decryptData(d.data); } catch (e) {}
        }
        return { ...d, _id: r._id, createdAt: r.createdAt };
    });

    const matching = whRecords.filter(r => r.date === '2026-06-01');
    console.log(`Found ${matching.length} warehouse records on 2026-06-01`);
    matching.forEach((m, idx) => {
        console.log(`[${idx}] WH: ${m.whName || m.warehouse} | Product: ${m.productName || m.product} | Brand: ${m.brand} | Qty: ${m.whQty || m.quantity} | Pkt: ${m.whPkt || m.packet} | Location: ${m.location} | RecordType: ${m.recordType}`);
    });

    process.exit(0);
});
