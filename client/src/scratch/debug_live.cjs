const mongoose = require('mongoose');
const CryptoJS = require('crypto-js');

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

async function run() {
    await mongoose.connect('mongodb://localhost:27017/erp_db');
    console.log("Connected to MongoDB");

    const genericSchema = new mongoose.Schema({ data: String, createdAt: Date }, { strict: false });
    
    const Stock = mongoose.model('Stock', genericSchema, 'stocks');
    const Warehouse = mongoose.model('Warehouse', genericSchema, 'warehouses');
    const Sale = mongoose.model('Sale', genericSchema, 'sales');
    const Product = mongoose.model('Product', genericSchema, 'products');
    const Damage = mongoose.model('Damage', genericSchema, 'damages');

    const rawStocks = await Stock.find({});
    const rawWarehouses = await Warehouse.find({});
    const rawSales = await Sale.find({});
    const rawProducts = await Product.find({});
    const rawDamages = await Damage.find({});

    const stockRecords = rawStocks.map(r => {
        let d = decryptData(r.toObject().data);
        if (d && d.data && typeof d.data === 'string' && !d.productName) {
            try { d = decryptData(d.data); } catch (e) {}
        }
        return { ...d, _id: r._id.toString(), createdAt: r.createdAt };
    }).filter(Boolean);

    const warehouseData = rawWarehouses.map(r => {
        let d = decryptData(r.toObject().data);
        if (d && d.data && typeof d.data === 'string' && !d.whName && !d.name) {
            try { d = decryptData(d.data); } catch (e) {}
        }
        return { ...d, _id: r._id.toString(), createdAt: r.createdAt };
    }).filter(Boolean);

    const salesRecords = rawSales.map(r => {
        let d = decryptData(r.toObject().data);
        if (d && d.data && typeof d.data === 'string' && !d.invoiceNo) {
            try { d = decryptData(d.data); } catch (e) {}
        }
        return { ...d, _id: r._id.toString(), createdAt: r.createdAt, saleType: d.saleType || r.saleType, invoiceNo: d.invoiceNo || r.invoiceNo };
    }).filter(Boolean);

    const products = rawProducts.map(r => {
        let d = decryptData(r.toObject().data);
        return { ...d, _id: r._id.toString(), createdAt: r.createdAt };
    }).filter(Boolean);

    const damages = rawDamages.map(r => {
        let d = decryptData(r.toObject().data);
        return { ...d, _id: r._id.toString(), createdAt: r.createdAt };
    }).filter(Boolean);

    console.log(`Loaded from live DB:
      Stocks: ${stockRecords.length}
      Warehouse: ${warehouseData.length}
      Sales: ${salesRecords.length}
      Products: ${products.length}
      Damages: ${damages.length}
    `);

    const { calculateStockData } = await import('../utils/stockHelpers.js');

    console.log("\n--- PRICE REPORT (showRate = true) ---");
    const resPrice = calculateStockData(stockRecords, { reportType: 'price' }, '', warehouseData, salesRecords, products, damages);
    const mosurDalPrice = resPrice.displayRecords.find(r => r.productName.toLowerCase() === 'mosur dal');
    if (mosurDalPrice) {
        const matches = mosurDalPrice.brandList.filter(b => b.brand.toLowerCase().includes('green diamond'));
        console.log(JSON.stringify(matches, null, 2));
    }

    console.log("\n--- NORMAL REPORT (showRate = false) ---");
    const resNormal = calculateStockData(stockRecords, {}, '', warehouseData, salesRecords, products, damages);
    const mosurDalNormal = resNormal.displayRecords.find(r => r.productName.toLowerCase() === 'mosur dal');
    if (mosurDalNormal) {
        const matches = mosurDalNormal.brandList.filter(b => b.brand.toLowerCase().includes('green diamond'));
        console.log(JSON.stringify(matches, null, 2));
    }

    await mongoose.disconnect();
}

run().catch(console.error);
