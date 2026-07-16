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

console.log(`Total decrypted stocks: ${decryptedStocks.length}`);
decryptedStocks.forEach(s => {
    console.log(`Stock: Product: ${s.dec.productName || s.dec.product}, LC: ${s.dec.lcNo}`);
    const brandEntries = s.dec.brandEntries || [];
    brandEntries.forEach(be => {
        console.log(`  Brand: ${be.brand}, qty: ${be.quantity}, rate: ${be.rate || be.purchasedPrice}`);
    });
    if (s.dec.brand) {
        console.log(`  Single Brand: ${s.dec.brand}, qty: ${s.dec.quantity}`);
    }
});
