const mongoose = require('mongoose');
const Stock = require('./src/models/Stock');

mongoose.connect('mongodb://localhost:27017/erp_db').then(async () => {
    const rawStock = await Stock.find({});
    console.log(`Total raw stock records: ${rawStock.length}`);
    if (rawStock.length > 0) {
        console.log("First 3 raw records:");
        console.log(JSON.stringify(rawStock.slice(0, 3), null, 2));
    }
    process.exit(0);
});
