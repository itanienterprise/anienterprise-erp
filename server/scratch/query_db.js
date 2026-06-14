const mongoose = require('mongoose');
const CryptoJS = require('crypto-js');

const SECRET_KEY = 'ani1820';

const decryptData = (ciphertext) => {
    if (!ciphertext) return ciphertext;
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        return decryptedData;
    } catch (error) {
        return null;
    }
};

const dataSchema = new mongoose.Schema({
    data: String
}, { strict: false });

const Stock = mongoose.model('Stock', dataSchema, 'stocks');
const Sale = mongoose.model('Sale', dataSchema, 'sales');
const Product = mongoose.model('Product', dataSchema, 'products');
const Damage = mongoose.model('Damage', dataSchema, 'damages');
const Warehouse = mongoose.model('Warehouse', dataSchema, 'warehouses');

async function run() {
    await mongoose.connect('mongodb://localhost:27017/erp_db');
    console.log('Connected to DB');

    const stocksRaw = await Stock.find({});
    const salesRaw = await Sale.find({});
    const productsRaw = await Product.find({});
    const damagesRaw = await Damage.find({});
    const warehousesRaw = await Warehouse.find({});

    const decryptList = (records) => records.map(r => {
        let d = decryptData(r.data);
        if (d && d.data && typeof d.data === 'string') {
            try { d = decryptData(d.data); } catch(e) {}
        }
        if (d) {
            if (d.date) d.date = new Date(d.date).toISOString();
            if (d.createdAt) d.createdAt = new Date(d.createdAt).toISOString();
        }
        const createdAtStr = r.createdAt ? new Date(r.createdAt).toISOString() : undefined;
        return { ...d, _id: r._id, createdAt: createdAtStr };
    }).filter(Boolean);

    const stocks = decryptList(stocksRaw);
    const sales = decryptList(salesRaw);
    const products = decryptList(productsRaw);
    const damages = decryptList(damagesRaw);
    const warehouses = decryptList(warehousesRaw);

    const { calculateStockData } = await import('/Users/mdriyadahmed/Documents/anienterprise-erp/client/src/utils/stockHelpers.js');

    const result = calculateStockData(stocks, {}, '', warehouses, sales, products, damages);
    console.log('--- GLOBAL VIEW SUMMARY ---');
    console.log(`totalQuantity (Arrivals): ${result.totalQuantity}`);
    console.log(`totalSaleQty: ${result.totalSaleQty}`);
    console.log(`totalInHouseQty: ${result.totalInHouseQty}`);
    console.log(`totalShortage: ${result.totalShortage}`);
    console.log(`totalDamageQty: ${result.totalDamageQty}`);

    console.log('\n--- BY PRODUCT GROUP ---');
    result.displayRecords.forEach(p => {
        const productShortage = p.brandList.reduce((sum, b) => sum + (b.sweepedQuantity || 0), 0);
        console.log(`${p.productName} | opening: ${p.openingQuantity} | closing/inhouse: ${p.inHouseQuantity} | sale: ${p.saleQuantity} | shortage: ${productShortage}`);
        p.brandList.forEach(b => {
            console.log(`  -> Brand: ${b.brand} | opening: ${b.openingQuantity} | closing/inhouse: ${b.inHouseQuantity} | sale: ${b.saleQuantity} | shortage: ${b.sweepedQuantity}`);
        });
    });

    await mongoose.disconnect();
}

run().catch(console.error);
