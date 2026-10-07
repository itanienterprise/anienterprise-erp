/**
 * Migration Script: Fix Stock Records in MongoDB
 * 
 * Target fixes:
 * 1. Active Baseline: Adjust Rajdhani (Mung Dal) from 26,933 kg to 26,903 kg (packet: 896.7666...)
 * 2. Sales GS0484 / ORD0170: Fill missing lcNo with '087326010792' for Chappan (Mung Dal) 1,500 kg entry
 * 3. Sales GS0519 / ORD0148: Correct placeholder lcNo '0000' to '087326010601' for Prakash Medium (Mosur Dal)
 * 
 * Usage:
 *   node server/scripts/fix_stock_records_migration.js           # Run migration with backup
 *   node server/scripts/fix_stock_records_migration.js --dry-run # Preview changes without updating DB
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const CryptoJS = require('crypto-js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const SECRET_KEY = process.env.SECRET_KEY || 'ani1820';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp_db';
const isDryRun = process.argv.includes('--dry-run');

function decryptDoc(ciphertext) {
    if (!ciphertext) return null;
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
        return JSON.parse(decryptedStr);
    } catch (e) {
        return null;
    }
}

function encryptDoc(obj) {
    return CryptoJS.AES.encrypt(JSON.stringify(obj), SECRET_KEY).toString();
}

async function runMigration() {
    console.log(`Connecting to MongoDB: ${MONGODB_URI}`);
    if (isDryRun) {
        console.log(`*** RUNNING IN DRY-RUN MODE: No database records will be modified ***\n`);
    }

    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;

    const backupData = {
        timestamp: new Date().toISOString(),
        modifiedDocuments: []
    };

    let totalUpdated = 0;

    // 1. Fix Active Stock Baseline (Rajdhani Mung Dal)
    console.log('--- 1. Checking Active Stock Baseline (Rajdhani) ---');
    const baselinesCol = db.collection('stockbaselines');
    const baselines = await baselinesCol.find({}).toArray();

    for (const doc of baselines) {
        if (!doc.data) continue;
        const parsed = decryptDoc(doc.data);
        if (!parsed || parsed.status !== 'active' || !Array.isArray(parsed.snapshotRecords)) continue;

        let modified = false;
        parsed.snapshotRecords.forEach(snap => {
            const bBrand = (snap.brand || '').trim().toUpperCase();
            const bProd = (snap.productName || snap.product || '').trim().toUpperCase();
            const bWh = (snap.warehouse || snap.whName || '').trim().toUpperCase();

            if (bBrand === 'RAJDHANI' && bProd === 'MUNG DAL' && bWh === 'HILI') {
                const currentQty = parseFloat(snap.quantity ?? snap.inHouseQuantity) || 0;
                if (currentQty > 26920) {
                    console.log(`Found Rajdhani baseline: currentQty = ${currentQty} kg`);
                    const newQty = 26903;
                    const pktSize = parseFloat(snap.packetSize) || 30;
                    const newPkt = newQty / pktSize;

                    snap.quantity = newQty;
                    snap.inHouseQuantity = newQty;
                    snap.packet = newPkt;
                    snap.inHousePacket = newPkt;

                    modified = true;
                    console.log(`-> Adjusted to newQty = ${newQty} kg (${newPkt.toFixed(2)} bags)`);
                }
            }
        });

        if (modified) {
            backupData.modifiedDocuments.push({
                collection: 'stockbaselines',
                _id: doc._id,
                originalData: doc.data
            });

            if (!isDryRun) {
                const encrypted = encryptDoc(parsed);
                await baselinesCol.updateOne({ _id: doc._id }, { $set: { data: encrypted } });
                console.log(`✓ Updated active baseline document (_id: ${doc._id})`);
            }
            totalUpdated++;
        }
    }

    // 2. Fix Sales Invoices: GS0484 (Chappan) and GS0519 (Prakash Medium)
    console.log('\n--- 2. Checking Sales Invoices (GS0484 & GS0519) ---');
    const salesCol = db.collection('sales');
    const sales = await salesCol.find({}).toArray();

    for (const doc of sales) {
        if (!doc.data) continue;
        const parsed = decryptDoc(doc.data);
        if (!parsed) continue;

        let modified = false;

        // Fix GS0484 (Chappan empty LC)
        if (parsed.invoiceNo === 'GS0484' || parsed.orderNo === 'ORD0170') {
            (parsed.items || []).forEach(it => {
                const pName = (it.productName || '').trim().toUpperCase();
                (it.brandEntries || []).forEach(be => {
                    const bBrand = (be.brand || be.brandName || '').trim().toUpperCase();
                    const qty = parseFloat(be.quantity) || 0;
                    const lc = (be.lcNo || '').trim();

                    if (pName === 'MUNG DAL' && bBrand === 'CHAPPAN' && qty === 1500 && (!lc || lc === '-' || lc === '0000')) {
                        console.log(`Found GS0484 Chappan 1500 kg entry with missing LC (was "${be.lcNo}")`);
                        be.lcNo = '087326010792';
                        modified = true;
                        console.log(`-> Set lcNo = "087326010792"`);
                    }
                });
            });
        }

        // Fix GS0519 (Prakash Medium LC 0000)
        if (parsed.invoiceNo === 'GS0519' || parsed.orderNo === 'ORD0148') {
            (parsed.items || []).forEach(it => {
                const pName = (it.productName || '').trim().toUpperCase();
                (it.brandEntries || []).forEach(be => {
                    const bBrand = (be.brand || be.brandName || '').trim().toUpperCase();
                    const lc = (be.lcNo || '').trim();

                    if (pName === 'MOSUR DAL' && bBrand.includes('PRAKASH') && (lc === '0000' || !lc)) {
                        console.log(`Found GS0519 Prakash Medium entry with placeholder LC (was "${be.lcNo}")`);
                        be.lcNo = '087326010601';
                        modified = true;
                        console.log(`-> Set lcNo = "087326010601"`);
                    }
                });
            });
        }

        if (modified) {
            backupData.modifiedDocuments.push({
                collection: 'sales',
                _id: doc._id,
                invoiceNo: parsed.invoiceNo,
                orderNo: parsed.orderNo,
                originalData: doc.data
            });

            if (!isDryRun) {
                const encrypted = encryptDoc(parsed);
                await salesCol.updateOne({ _id: doc._id }, { $set: { data: encrypted } });
                console.log(`✓ Updated sales invoice ${parsed.invoiceNo || parsed.orderNo} (_id: ${doc._id})`);
            }
            totalUpdated++;
        }
    }



    // Save Backup File if any documents were modified
    if (backupData.modifiedDocuments.length > 0 && !isDryRun) {
        const backupDir = path.resolve(__dirname, '../backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        const filename = `stock_migration_backup_${Date.now()}.json`;
        const backupPath = path.join(backupDir, filename);
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        console.log(`\n✓ Backup saved to: ${backupPath}`);
    }

    console.log(`\n========================================`);
    console.log(`Migration Summary: ${totalUpdated} document(s) ${isDryRun ? 'identified for update' : 'successfully updated'}.`);
    console.log(`========================================`);

    await mongoose.disconnect();
}

runMigration().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
