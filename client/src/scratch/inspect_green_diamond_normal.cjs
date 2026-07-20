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

const backupPath = path.join(__dirname, '../../../server/backups/auto_backup_2026-07-19_19-00-34.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

const stockRecords = (backup.data.Stock || []).map(r => {
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.productName) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt };
}).filter(Boolean);

const warehouseData = (backup.data.Warehouse || []).map(r => {
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.whName && !d.name) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt };
}).filter(Boolean);

const salesRecords = (backup.data.Sale || []).map(r => {
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.invoiceNo) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt, saleType: d.saleType || r.saleType, invoiceNo: d.invoiceNo || r.invoiceNo };
}).filter(Boolean);

const products = (backup.data.Product || []).map(r => {
    let d = decryptData(r.data);
    return { ...d, _id: r._id, createdAt: r.createdAt };
}).filter(Boolean);

const damages = (backup.data.Damage || []).map(r => {
    let d = decryptData(r.data);
    return { ...d, _id: r._id, createdAt: r.createdAt };
}).filter(Boolean);

(async () => {
    try {
        const { calculateStockData } = await import('../utils/stockHelpers.js');
        const resNormal = calculateStockData(stockRecords, {}, '', warehouseData, salesRecords, products, damages);
        const mosurDalNormal = resNormal.displayRecords.find(r => r.productName.toLowerCase() === 'mosur dal');
        if (mosurDalNormal) {
            const matches = mosurDalNormal.brandList.filter(b => b.brand.toLowerCase().includes('green diamond'));
            console.log(JSON.stringify(matches, null, 2));
        }
    } catch (err) {
        console.error(err);
    }
})();
