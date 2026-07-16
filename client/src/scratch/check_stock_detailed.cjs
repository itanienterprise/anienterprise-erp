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

stocks.forEach(s => {
    const dec = decryptData(s.data);
    if (!dec) return;
    
    // Check if the stock record matches HASINA MIX or LC 087326010601
    const matchLc = dec.lcNo === '087326010601';
    const matchBrand = (dec.brand || '').trim().toLowerCase() === 'hasina mix';
    const matchBrandEntries = (dec.brandEntries || []).some(b => (b.brand || '').trim().toLowerCase() === 'hasina mix');
    
    if (matchLc || matchBrand || matchBrandEntries) {
        console.log(`Stock Record ID: ${s._id}, Date: ${dec.date}, LC: ${dec.lcNo}, Brand: ${dec.brand}, Qty: ${dec.quantity}, inHouseQty: ${dec.inHouseQuantity}`);
        if (dec.brandEntries) {
            dec.brandEntries.forEach(b => console.log(`  BrandEntry: brand: ${b.brand}, qty: ${b.quantity}`));
        }
    }
});
