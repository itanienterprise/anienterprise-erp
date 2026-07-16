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

const sales = backup.data.Sale || [];
const decryptedSales = sales.map(s => {
    const dec = decryptData(s.data);
    return { ...s, dec };
}).filter(s => s.dec);

console.log("\n--- SEARCHING FOR HASINA MIX BRAND SALES ---");
let totalHasinaMixQty = 0;
let totalHasinaMixBags = 0;

decryptedSales.forEach(s => {
    const items = s.dec.items || [];
    items.forEach(item => {
        (item.brandEntries || []).forEach(be => {
            const bName = (be.brand || '').trim().toLowerCase();
            if (bName.includes('hasina mix')) {
                console.log(`Invoice: ${s.dec.invoiceNo}, SaleType: ${s.dec.saleType}, Date: ${s.dec.date}`);
                console.log(`  Product: ${item.productName}, Brand: ${be.brand}, lcNo: ${be.lcNo}, qty: ${be.quantity}, bags: ${be.bag}, wh: ${be.warehouseName}`);
                totalHasinaMixQty += parseFloat(be.quantity) || 0;
                totalHasinaMixBags += parseFloat(be.bag) || 0;
            }
        });
    });
});

console.log(`\nTotal Hasina Mix sold quantity in backup: ${totalHasinaMixQty} kg (${totalHasinaMixBags} bags)`);
