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

console.log("Collections in backup:", Object.keys(backup.data));

const sales = backup.data.Sale || [];
const stocks = backup.data.Stock || [];
const warehouses = backup.data.Warehouse || [];

console.log(`Loaded ${sales.length} sales, ${stocks.length} stocks, ${warehouses.length} warehouses`);

console.log("\n--- DECRYPTING SALES ---");
const decryptedSales = sales.map(s => {
    const dec = decryptData(s.data);
    return { ...s, dec };
}).filter(s => s.dec);

console.log("\n--- SEARCHING FOR HASINA MIX SALES ---");
decryptedSales.forEach(s => {
    const items = s.dec.items || [];
    items.forEach(item => {
        const name = (item.productName || '').trim().toLowerCase();
        if (name.includes('hasina mix')) {
            console.log(`Invoice: ${s.dec.invoiceNo}, SaleType: ${s.dec.saleType}, Date: ${s.dec.date}`);
            console.log(`  Item details: productName: ${item.productName}, lcNo: ${item.lcNo}, qty: ${item.quantity}`);
            (item.brandEntries || []).forEach(be => {
                console.log(`    BrandEntry: brand: ${be.brand}, lcNo: ${be.lcNo}, qty: ${be.quantity}, whName: ${be.warehouseName}`);
            });
        }
    });
});

console.log("\n--- SEARCHING SPECIFICALLY FOR GS0244 ---");
const gs0244 = decryptedSales.find(s => s.dec.invoiceNo === 'GS0244');
if (gs0244) {
    console.log(JSON.stringify(gs0244.dec, null, 2));
} else {
    console.log("GS0244 not found.");
}
