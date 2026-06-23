const mongoose = require('mongoose');
const Stock = require('../src/models/Stock');
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
    
    // Check Stock records for L1001 and 100001
    const rawStocks = await Stock.find({});
    console.log(`\n=== Stock records matching L1001 or 100001 ===`);
    rawStocks.forEach((s) => {
        const d = decryptRecord(s);
        if (d && (d.lcNo === 'L1001' || d.lcNo === '100001')) {
            console.log(JSON.stringify({
                _id: d._id,
                lcNo: d.lcNo,
                importer: d.importer,
                productName: d.productName,
                billOfEntry: d.billOfEntry,
                boeNo: d.boeNo,
                bill_of_entry: d.bill_of_entry,
                billOfEntryNo: d.billOfEntryNo
            }, null, 2));
        }
    });

    // Check LC records for L1001 and 100001
    const rawLCs = await LCManagement.find({});
    console.log(`\n=== LC Management records matching L1001 or 100001 ===`);
    rawLCs.forEach((lc) => {
        const d = decryptRecord(lc);
        if (d && (d.lcNo === 'L1001' || d.lcNo === '100001' || d.lcNoVal === 'L1001' || d.lcNoVal === '100001')) {
            console.log(JSON.stringify({
                _id: d._id,
                lcNo: d.lcNo || d.lcNoVal,
                importer: d.importer,
                productName: d.productName,
                billOfEntry: d.billOfEntry,
                boeNo: d.boeNo,
                bill_of_entry: d.bill_of_entry,
                billOfEntryNo: d.billOfEntryNo,
                ipNumbers: d.ipNumbers,
                ipNo: d.ipNo
            }, null, 2));
        }
    });
    
    process.exit(0);
}).catch(err => {
    console.error('Connection error', err);
    process.exit(1);
});
