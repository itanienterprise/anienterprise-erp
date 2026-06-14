const mongoose = require('mongoose');
const MetaData = require('../src/models/MetaData');
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
    const rawMeta = await MetaData.find({});
    console.log(`Total meta records: ${rawMeta.length}`);
    
    rawMeta.forEach((m, idx) => {
        const d = decryptRecord(m);
        console.log(`${idx + 1}. ID: ${d._id} | Key: ${d.key} | Value: ${JSON.stringify(d.value)}`);
    });
    
    process.exit(0);
});
