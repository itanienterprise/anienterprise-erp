const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../../../server/.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/anienterprise';

const StockBaseline = require('../../../server/src/models/StockBaseline');
const { decryptData } = require('../../../server/src/utils/encryption');

async function inspectDecryptedBaselines() {
    await mongoose.connect(MONGODB_URI);
    const baselines = await StockBaseline.find({}).sort({ createdAt: -1 });
    console.log('Total baselines:', baselines.length);
    baselines.forEach((b, idx) => {
        const d = decryptData(b.data);
        console.log(`\n--- Baseline #${idx + 1} (${b._id}) ---`);
        console.log('Status:', d.status);
        console.log('Baseline Date:', d.baselineDate);
        console.log('Note:', d.note);
        console.log('Set By:', d.setBy);
        console.log('Summary:', d.summary);
        console.log('Snapshot Items count:', (d.snapshotRecords || []).length);
        
        console.log('CHICK PEAS items in snapshot:');
        (d.snapshotRecords || []).filter(s => (s.productName || '').toLowerCase().includes('chick')).forEach(s => {
            console.log(`  * Wh: ${s.warehouse}, Brand: ${s.brand}, Pkt: ${s.inHousePacket}, Qty: ${s.inHouseQuantity}, Rate: ${s.purchasedPrice}`);
        });
    });
    await mongoose.disconnect();
}

inspectDecryptedBaselines().catch(err => {
    console.error(err);
    process.exit(1);
});
