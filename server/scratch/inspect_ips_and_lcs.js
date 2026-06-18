const mongoose = require('mongoose');
const IpRecord = require('../src/models/IpRecord');
const LCManagement = require('../src/models/LCManagement');
const { decryptData } = require('../src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.lcNo && !d.lcNoVal) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_ani').then(async () => {
    const rawIPs = await IpRecord.find({});
    const rawLCs = await LCManagement.find({});

    console.log('--- ALL IPS ---');
    rawIPs.forEach((ip, idx) => {
        const d = decryptRecord(ip);
        console.log(`${idx + 1}. IP Number: ${d.ipNumber} | Product: ${d.productName} | Qty: ${d.quantity} | Importer: ${d.ipParty}`);
    });

    console.log('--- ALL LCS ---');
    rawLCs.forEach((lc, idx) => {
        const d = decryptRecord(lc);
        console.log(`${idx + 1}. LC No: ${d.lcNo || d.lcNoVal} | Product: ${d.productName} | Qty: ${d.quantity} | ipNumbers: ${JSON.stringify(d.ipNumbers || d.ipNo)}`);
    });

    process.exit(0);
});
