const mongoose = require('mongoose');
const Stock = require('./src/models/Stock');
const { decryptData } = require('./src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.productName && !d.whName && !d.warehouse) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return d;
}

mongoose.connect('mongodb://localhost:27017/erp_db').then(async () => {
    const rawStock = await Stock.find({});
    let failCount = 0;
    let successCount = 0;
    rawStock.forEach((r, idx) => {
        const dec = decryptRecord(r);
        if (!dec) {
            failCount++;
        } else {
            successCount++;
            if (!dec.productName) {
                console.log(`Record #${idx} has no productName:`, dec);
            }
        }
    });
    console.log(`Decryption summary: Success ${successCount}, Fail ${failCount}`);
    process.exit(0);
});
