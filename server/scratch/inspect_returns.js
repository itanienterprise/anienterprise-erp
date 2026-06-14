const mongoose = require('mongoose');
const Return = require('../src/models/Return');
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
    const rawRet = await Return.find({});
    const returnData = rawRet.map(r => ({ ...decryptRecord(r), _id: r._id }));

    console.log(`Found ${returnData.length} return records:`);
    returnData.forEach(r => {
        console.log(JSON.stringify(r, null, 2));
    });

    process.exit(0);
});
