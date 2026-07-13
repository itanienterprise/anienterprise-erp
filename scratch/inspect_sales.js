const mongoose = require('mongoose');
const CryptoJS = require('crypto-js');

const SECRET_KEY = 'ani1820';

const decryptData = (ciphertext) => {
    if (!ciphertext) return ciphertext;
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (error) {
        return null;
    }
};

async function main() {
    await mongoose.connect('mongodb://localhost:27017/erp_db');
    console.log('Connected to DB');

    const docs = await mongoose.connection.db.collection('sales').find().toArray();
    console.log(`Total Sales Docs: ${docs.length}`);

    const decryptedDocs = docs.map(d => {
        if (d.data) {
            let decrypted = decryptData(d.data);
            if (typeof decrypted === 'string') {
                try { decrypted = decryptData(decrypted); } catch (e) {}
            }
            return { ...decrypted, _id: d._id, createdAt: d.createdAt };
        }
        return d;
    }).filter(Boolean);

    console.log('\nMatching Sales for LC 073926010090:');
    let count = 0;
    let sumTotalAmount = 0;
    let sumItemTotal = 0;
    
    const targetLc = '073926010090';

    decryptedDocs.forEach(sale => {
        const saleLc = String(sale.lcNo || '').trim();
        let matches = saleLc.includes(targetLc);
        
        const items = sale.items || [];
        const matchingItems = items.filter(item => {
            const itemLc = String(item.lcNo || sale.lcNo || '').trim();
            return itemLc.includes(targetLc);
        });

        if (matches || matchingItems.length > 0) {
            count++;
            console.log(`\nSale #${count}:`);
            console.log(`  Date: ${sale.date}`);
            console.log(`  InvoiceNo: ${sale.invoiceNo}`);
            console.log(`  Parent lcNo: "${sale.lcNo}"`);
            console.log(`  Parent totalAmount: ${sale.totalAmount}`);
            sumTotalAmount += parseFloat(sale.totalAmount || 0);

            console.log('  Items:');
            items.forEach((item, idx) => {
                const itemLc = String(item.lcNo || sale.lcNo || '').trim();
                const isMatch = itemLc.includes(targetLc);
                console.log(`    Item ${idx+1}: Product: ${item.productName || item.product}, Brand: ${item.brand}, Qty: ${item.quantity}, UnitPrice: ${item.unitPrice}, Total: ${item.totalAmount}, LC: "${item.lcNo}" (Match: ${isMatch})`);
                if (isMatch) {
                    // Let's compute item level totalAmount
                    const brandEntries = (item.brandEntries && item.brandEntries.length > 0)
                      ? item.brandEntries
                      : [{ brandName: item.brand || '-', quantity: item.quantity, unitPrice: item.unitPrice || 0, totalAmount: item.totalAmount || 0 }];
                    
                    brandEntries.forEach(entry => {
                        const amt = parseFloat(entry.totalAmount) || (parseFloat(entry.quantity) * parseFloat(entry.unitPrice)) || 0;
                        sumItemTotal += amt;
                        console.log(`      BrandEntry: Brand: ${entry.brandName || entry.brand}, Qty: ${entry.quantity}, UnitPrice: ${entry.unitPrice}, Total: ${entry.totalAmount} (Contribution: ${amt})`);
                    });
                }
            });
        }
    });

    console.log(`\nSummary:`);
    console.log(`  Total matched sales: ${count}`);
    console.log(`  Sum of parent totalAmount: ${sumTotalAmount}`);
    console.log(`  Sum of matched item totalAmount: ${sumItemTotal}`);

    await mongoose.disconnect();
}

main().catch(console.error);
