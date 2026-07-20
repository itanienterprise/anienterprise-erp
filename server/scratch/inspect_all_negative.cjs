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

    const genericSchema = new mongoose.Schema({ data: String, createdAt: Date }, { strict: false });
    const Stock = mongoose.model('Stock', genericSchema, 'stocks');
    const Warehouse = mongoose.model('Warehouse', genericSchema, 'warehouses');
    const Sale = mongoose.model('Sale', genericSchema, 'sales');
    const Product = mongoose.model('Product', genericSchema, 'products');
    const Damage = mongoose.model('Damage', genericSchema, 'damages');

    let stockRecords = await Stock.find({});
    let warehouseData = await Warehouse.find({});
    let salesRecords = await Sale.find({});
    let products = await Product.find({});
    let damages = await Damage.find({});

    const decryptAll = (arr, isWh = false) => arr.map(r => {
        let d = decryptData(r.toObject().data);
        if (d && d.data && typeof d.data === 'string') {
            try { d = decryptData(d.data); } catch (e) {}
        }
        return { ...d, _id: r._id.toString(), createdAt: r.createdAt };
    }).filter(Boolean);

    stockRecords = decryptAll(stockRecords);
    warehouseData = decryptAll(warehouseData);
    salesRecords = decryptAll(salesRecords);
    products = decryptAll(products);
    damages = decryptAll(damages);

    stockRecords = JSON.parse(JSON.stringify(stockRecords));
    warehouseData = JSON.parse(JSON.stringify(warehouseData));
    salesRecords = JSON.parse(JSON.stringify(salesRecords));
    products = JSON.parse(JSON.stringify(products));
    damages = JSON.parse(JSON.stringify(damages));

    const { calculateStockData } = await import('../client/src/utils/stockHelpers.js');

    // Run original calculateStockData (without our changes in memory since we are importing the updated file)
    const res = calculateStockData(stockRecords, {}, '', warehouseData, salesRecords, products, damages);
    
    console.log("All brand entries with negative closing quantity in normal report:");
    res.displayRecords.forEach(p => {
        p.brandList.forEach(b => {
            if (b.inHouseQuantity < 0) {
                console.log(`Product: ${p.productName}, Brand: ${b.brand}, LC: ${b.lcNo || '—'}, InHouseQty: ${b.inHouseQuantity}, Opening: ${b.openingQuantity}`);
            }
        });
    });

    await mongoose.disconnect();
}

run().catch(console.error);
