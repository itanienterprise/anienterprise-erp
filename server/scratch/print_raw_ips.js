const mongoose = require('mongoose');
const IpRecord = require('../src/models/IpRecord');

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawIPs = await IpRecord.find({});
    console.log(`Total IP records in database: ${rawIPs.length}`);
    rawIPs.forEach((ip, idx) => {
        console.log(`${idx + 1}. ID: ${ip._id} | Length: ${ip.data.length} | Start: ${ip.data.substring(0, 30)}`);
    });
    process.exit(0);
});
