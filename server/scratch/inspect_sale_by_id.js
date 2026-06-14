const mongoose = require('mongoose');
const Sale = require('../src/models/Sale');
const { decryptData } = require('../src/utils/encryption');

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const s = await Sale.findById('6a0569430979cd2e701b4e9a');
    if (!s) {
        console.log("Sale not found!");
    } else {
        console.log("Raw sale from MongoDB:", s);
        let d = decryptData(s.data);
        if (d && d.data && typeof d.data === 'string') {
            try { d = decryptData(d.data); } catch (e) {}
        }
        console.log("Decrypted sale data:", JSON.stringify(d, null, 2));
    }
    process.exit(0);
});
