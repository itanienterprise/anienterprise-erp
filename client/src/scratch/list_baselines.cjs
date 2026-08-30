const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../../../server/.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/anienterprise';

const StockBaseline = require('../../../server/src/models/StockBaseline');

async function listAllBaselines() {
    await mongoose.connect(MONGODB_URI);
    const baselines = await StockBaseline.find({});
    console.log('Total baselines in Mongo:', baselines.length);
    baselines.forEach(b => {
        console.log('- ID:', b._id, 'Status:', b.status, 'Date:', b.baselineDate, 'Created:', b.createdAt);
    });
    await mongoose.disconnect();
}

listAllBaselines().catch(err => {
    console.error(err);
    process.exit(1);
});
