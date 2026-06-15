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
    const rawLCs = await LCManagement.find({});
    
    const keys = new Set();
    rawLCs.forEach(lc => {
        const d = decryptRecord(lc);
        Object.keys(d).forEach(k => keys.add(k));
        if (d.amendments) {
            d.amendments.forEach(am => {
                Object.keys(am).forEach(k => keys.add("amnd_" + k));
            });
        }
    });
    
    console.log("All keys found in LC records:", Array.from(keys).sort());
    process.exit(0);
});
