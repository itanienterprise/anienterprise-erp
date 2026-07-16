const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');

const SECRET_KEY = 'ani1820';

function decryptData(ciphertext) {
    if (!ciphertext) return ciphertext;
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        return decryptedData;
    } catch (error) {
        return null;
    }
}

const backupPath = path.join(__dirname, '../../../server/backups/auto_backup_2026-07-15_19-00-14.json');
const backupContent = fs.readFileSync(backupPath, 'utf8');
const backup = JSON.parse(backupContent);

const stocks = backup.data.Stock || [];
const decryptedStocks = stocks.map(s => {
    const dec = decryptData(s.data);
    return { ...s, dec };
}).filter(s => s.dec);

console.log("\n--- SEARCHING FOR HASINA MIX STOCK RECORDS ---");
decryptedStocks.forEach(s => {
    const brandEntries = s.dec.brandEntries || [];
    brandEntries.forEach(be => {
        const bName = (be.brand || '').trim().toLowerCase();
        if (bName.includes('hasina mix')) {
            console.log(`Stock Record ID: ${s._id}, LC No: ${s.dec.lcNo}, Date: ${s.dec.date}`);
            console.log(`  Brand: ${be.brand}, qty: ${be.quantity}, rate: ${be.purchasedPrice || be.rate}, wh: ${be.warehouseName}`);
        }
    });
});
