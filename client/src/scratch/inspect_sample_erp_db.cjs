const mongoose = require('mongoose');

async function inspectDb() {
    await mongoose.connect('mongodb://localhost:27017/erp_db');
    const Stock = mongoose.model('Stock', new mongoose.Schema({}, { strict: false }), 'stocks');
    const stocks = await Stock.find({}).limit(5).lean();
    console.log('Sample stock records:', JSON.stringify(stocks, null, 2));

    const LCReceive = mongoose.model('LCReceive', new mongoose.Schema({}, { strict: false }), 'lcreceives');
    const lcs = await LCReceive.find({}).limit(5).lean();
    console.log('Sample LCReceive records:', JSON.stringify(lcs, null, 2));

    await mongoose.disconnect();
}
inspectDb();
