const mongoose = require('mongoose');
const Stock = require('../src/models/Stock');
const { decryptData } = require('../src/utils/encryption');

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawStock = await Stock.find({});
    console.log(`Total raw stock records: ${rawStock.length}`);
    
    let decryptFailures = 0;
    rawStock.forEach((s, idx) => {
        try {
            let d = decryptData(s.data);
            if (d && d.data && typeof d.data === 'string' && !d.productName) {
                d = decryptData(d.data);
            }
            if (!d) {
                console.log(`${idx + 1}. FAILED to decrypt. ID: ${s._id} | Raw data: ${s.data}`);
                decryptFailures++;
            }
        } catch (e) {
            console.log(`${idx + 1}. ERROR decrypting. ID: ${s._id} | Error: ${e.message} | Raw data: ${s.data}`);
            decryptFailures++;
        }
    });
    
    console.log(`Total decryption failures: ${decryptFailures}`);
    process.exit(0);
});
