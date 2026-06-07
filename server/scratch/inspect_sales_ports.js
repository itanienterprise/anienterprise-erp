const mongoose = require('mongoose');
const Sale = require('../src/models/Sale');
const { decryptData } = require('../src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.invoiceNo) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt.toISOString() };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawSales = await Sale.find({});
    const salesRecords = rawSales.map(decryptRecord);
    const withPort = salesRecords.filter(s => s.port);
    console.log(`Sales with non-empty Port: ${withPort.length}`);
    withPort.slice(0, 10).forEach(s => {
        console.log(`Invoice: ${s.invoiceNo || s.invoice} | Port: "${s.port}" | Importer: "${s.importer}" | LcNo: "${s.lcNo}"`);
    });
    process.exit(0);
});
