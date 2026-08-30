const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../../../server/.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/anienterprise';

const StockBaseline = require('../../../server/src/models/StockBaseline');

async function inspectActiveBaseline() {
    await mongoose.connect(MONGODB_URI);
    const active = await StockBaseline.findOne({ status: 'active' }).sort({ createdAt: -1 });
    if (!active) {
        console.log('No active baseline found');
    } else {
        const decrypted = active.decryptedData || active;
        console.log('Active baseline Date:', decrypted.baselineDate);
        console.log('Active baseline Note:', decrypted.note);
        console.log('Active baseline Summary:', decrypted.summary);
        console.log('Number of snapshot records:', (decrypted.snapshotRecords || []).length);
        
        console.log('\nSnapshot records for CHICK PEAS:');
        (decrypted.snapshotRecords || []).filter(s => (s.productName || '').toLowerCase().includes('chick')).forEach(s => {
            console.log(`- Wh: ${s.warehouse}, Prod: ${s.productName}, Brand: ${s.brand}, Pkt: ${s.inHousePacket}, Qty: ${s.inHouseQuantity}, Rate: ${s.purchasedPrice}`);
        });
    }
    await mongoose.disconnect();
}

inspectActiveBaseline().catch(err => {
    console.error(err);
    process.exit(1);
});
