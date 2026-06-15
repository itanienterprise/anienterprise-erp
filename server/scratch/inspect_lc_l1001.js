const mongoose = require('mongoose');
const LCManagement = require('../src/models/LCManagement');
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
    const rawLCs = await LCManagement.find({});
    
    rawLCs.forEach((lc) => {
        const d = decryptRecord(lc);
        if (d.lcNo === 'L1001') {
            console.log(JSON.stringify(d, null, 2));
        }
    });
    
    process.exit(0);
});
