const mongoose = require('mongoose');
const LCManagement = require('../src/models/LCManagement');
const { decryptData } = require('../src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.lcNo && !d.lcNoVal) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt.toISOString() };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawLC = await LCManagement.findOne({ _id: '6a2665f060f99da58927272b' });
    if (rawLC) {
        console.log(JSON.stringify(decryptRecord(rawLC), null, 2));
    } else {
        console.log("LC not found");
    }
    process.exit(0);
});
