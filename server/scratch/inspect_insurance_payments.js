const mongoose = require('mongoose');
const InsurancePayment = require('../src/models/InsurancePayment');
const { decryptData } = require('../src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.lcNo) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt.toISOString() };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawPayments = await InsurancePayment.find({});
    console.log(`Total Insurance Payment records: ${rawPayments.length}`);
    
    rawPayments.forEach((pay, idx) => {
        const d = decryptRecord(pay);
        console.log(`${idx + 1}. ID: ${d._id} | LC No: "${d.lcNo}" | amount: ${d.amount} | type: "${d.type}" | date: "${d.date}"`);
    });
    
    process.exit(0);
});
