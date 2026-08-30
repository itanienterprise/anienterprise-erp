const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Connect to MongoDB
require('dotenv').config({ path: path.join(__dirname, '../../../server/.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/anienterprise';

const Stock = require('../../../server/src/models/Stock');
const Warehouse = require('../../../server/src/models/Warehouse');
const StockBaseline = require('../../../server/src/models/StockBaseline');

async function restorePreBaselineCollections() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const backupPath = path.join(__dirname, '../../../server/backups/backup-pre_stock_baseline-2026-08-29T18-16-25-198Z.json');
    const raw = fs.readFileSync(backupPath, 'utf8');
    const backup = JSON.parse(raw);

    const stockItems = backup.data.Stock || [];
    const warehouseItems = backup.data.Warehouse || [];

    console.log(`Restoring ${stockItems.length} stock items and ${warehouseItems.length} warehouse items from pre-baseline backup...`);

    // Clear and restore Stock
    await Stock.deleteMany({});
    if (stockItems.length > 0) {
        await Stock.insertMany(stockItems);
    }
    console.log('Stock collection restored to exact pre-baseline state.');

    // Clear and restore Warehouse (except we want to remove the test transfer created after baseline)
    await Warehouse.deleteMany({});
    if (warehouseItems.length > 0) {
        await Warehouse.insertMany(warehouseItems);
    }
    console.log('Warehouse collection restored to exact pre-baseline state.');

    await mongoose.disconnect();
    console.log('Database restore complete!');
}

restorePreBaselineCollections().catch(err => {
    console.error('Error restoring:', err);
    process.exit(1);
});
