const mongoose = require('mongoose');
const Sale = require('../server/src/models/Sale');
const { decryptData } = require('../server/src/utils/encryption');

mongoose.connect('mongodb://localhost:27017/erp_db').then(async () => {
    const sales = await Sale.find({}).sort({createdAt: -1}).limit(5);
    sales.forEach(sale => {
        const d = decryptData(sale.data);
        console.log("Sale ID:", sale._id, "Status:", d.status, "Invoice No:", d.invoiceNo);
        if (d.items) {
            d.items.forEach(i => {
                console.log("  Item:", i.productName, "BrandEntries:", i.brandEntries);
            });
        } else {
             console.log("  No items.");
        }
    });
    process.exit(0);
});
