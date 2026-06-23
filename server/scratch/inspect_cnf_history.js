const mongoose = require('mongoose');
const Stock = require('../src/models/Stock');
const Sale = require('../src/models/Sale');
const LCExpense = require('../src/models/LCExpense');
const LCManagement = require('../src/models/LCManagement');
const { decryptData } = require('../src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string') {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt ? r.createdAt.toISOString() : '' };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    console.log('Connected to MongoDB');
    
    const targetCnF = "abc"; // Agent Name in screenshot is abc
    
    const stockRes = await Stock.find({});
    const salesRes = await Sale.find({});
    
    const stockData = stockRes.map(decryptRecord).filter(Boolean);
    const salesData = salesRes.map(decryptRecord).filter(Boolean);
    
    const rows = [];
    
    // 1. Process Stock (LC) Records
    stockData.forEach(record => {
        const indCnF = (record.indianCnF || '').toLowerCase().trim();
        const bdCnF = (record.bdCnF || '').toLowerCase().trim();

        // Let's do the exact match logic from CnF.jsx:
        const isBaseMatch = (indCnF === targetCnF || bdCnF === targetCnF);
        const status = (record.status || '').toLowerCase();
        const isAccepted = !status.includes('requested') && !status.includes('rejected');
        const isMatch = isBaseMatch && isAccepted;

        if (isMatch) {
            console.log(`Matched Stock Record: ID=${record._id}, lcNo=${record.lcNo}, billOfEntry=${record.billOfEntry}, indianCnF=${record.indianCnF}, bdCnF=${record.bdCnF}`);
            rows.push({
                _id: record._id,
                date: record.date,
                lcNo: record.lcNo,
                importer: record.importer,
                exporter: record.exporter,
                port: record.port,
                product: record.productName,
                billOfEntry: record.billOfEntry || '-',
                source: 'LC'
            });
        }
    });

    console.log("\n=== Generated C&F History Rows ===");
    console.log(JSON.stringify(rows, null, 2));
    
    process.exit(0);
}).catch(err => {
    console.error('Connection error', err);
    process.exit(1);
});
