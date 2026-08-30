const mongoose = require('mongoose');

async function inspect() {
    await mongoose.connect('mongodb://localhost:27017/erp_db');
    const Stock = mongoose.model('Stock', new mongoose.Schema({}, { strict: false }), 'stocks');
    const records = await Stock.find({ lcNo: '087326010687' }).lean();
    console.log(`Found ${records.length} stock records for LC 087326010687:`);
    records.forEach((r, idx) => {
        console.log(`[${idx}] date: ${r.date}, prod: ${r.productName || r.product}, brand: ${r.brand}, qty: ${r.quantity}, inHouseQty: ${r.inHouseQuantity}, truck: ${r.truckNo}, invoice: ${r.invoiceNo}`);
        if (r.entries) console.log('   entries:', JSON.stringify(r.entries));
        if (r.brandEntries) console.log('   brandEntries:', JSON.stringify(r.brandEntries));
    });

    const LCReceive = mongoose.model('LCReceive', new mongoose.Schema({}, { strict: false }), 'lcreceives');
    const lcs = await LCReceive.find({ lcNo: '087326010687' }).lean();
    console.log(`\nFound ${lcs.length} LCReceive records for LC 087326010687:`);
    lcs.forEach((l, idx) => {
        console.log(`[${idx}] date: ${l.date}, truck: ${l.truckNo}, invoice: ${l.invoiceNo}`);
        if (l.entries) console.log('   entries:', JSON.stringify(l.entries));
    });

    await mongoose.disconnect();
}

inspect();
