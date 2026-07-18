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

    const StockSchema = new mongoose.Schema({ data: String }, { collection: 'stocks' });
    const Stock = mongoose.model('Stock', StockSchema);

    const WarehouseSchema = new mongoose.Schema({ data: String }, { collection: 'warehouses' });
    const Warehouse = mongoose.model('Warehouse', WarehouseSchema);

    const SaleSchema = new mongoose.Schema({ data: String }, { collection: 'sales' });
    const Sale = mongoose.model('Sale', SaleSchema);

    const DamageSchema = new mongoose.Schema({ data: String }, { collection: 'damages' });
    const Damage = mongoose.model('Damage', DamageSchema);

    const stocks = await Stock.find({});
    console.log(`Stocks count: ${stocks.length}`);
    stocks.forEach(s => {
        const dec = decryptData(s.data);
        if (!dec) return;
        const pName = (dec.productName || dec.product || '').trim().toLowerCase();
        if (pName.includes('hasina') || pName.includes('mix')) {
            console.log(`STOCKS MATCH: ID: ${s._id}, Date: ${dec.date}, Product: ${dec.productName || dec.product}, Brand: ${dec.brand}, Qty: ${dec.quantity}, inHouseQty: ${dec.inHouseQuantity}, LC: ${dec.lcNo}`);
            if (dec.brandEntries) {
                dec.brandEntries.forEach(b => console.log(`  BrandEntry: brand: ${b.brand}, qty: ${b.quantity}, inHouse: ${b.inHouseQuantity}`));
            }
        }
    });

    const warehouses = await Warehouse.find({});
    console.log(`Warehouses count: ${warehouses.length}`);
    warehouses.forEach(w => {
        const dec = decryptData(w.data);
        if (!dec) return;
        const pName = (dec.productName || dec.product || '').trim().toLowerCase();
        if (pName.includes('hasina') || pName.includes('mix')) {
            console.log(`WAREHOUSE MATCH: ID: ${w._id}, Date: ${dec.date}, Product: ${dec.productName || dec.product}, Brand: ${dec.brand}, Qty: ${dec.whQty || dec.quantity}, WH: ${dec.whName}, isTransferLog: ${dec.isTransferLog}, location: ${dec.location}, recordType: ${dec.recordType}`);
        }
    });

    const sales = await Sale.find({});
    console.log(`Sales count: ${sales.length}`);
    sales.forEach(sl => {
        const dec = decryptData(sl.data);
        if (!dec) return;
        (dec.items || []).forEach(item => {
            const pName = (item.productName || item.product || '').trim().toLowerCase();
            if (pName.includes('hasina') || pName.includes('mix')) {
                console.log(`SALES MATCH: ID: ${sl._id}, Date: ${dec.date}, Product: ${item.productName || item.product}, Qty: ${item.quantity}, Status: ${dec.status}`);
                if (item.brandEntries) {
                    item.brandEntries.forEach(b => console.log(`  BrandEntry: brand: ${b.brand}, qty: ${b.quantity}, wh: ${b.warehouseName}`));
                }
            }
        });
    });

    const damages = await Damage.find({});
    console.log(`Damages count: ${damages.length}`);
    damages.forEach(d => {
        const dec = decryptData(d.data);
        if (!dec) return;
        const pName = (dec.productName || dec.product || '').trim().toLowerCase();
        if (pName.includes('hasina') || pName.includes('mix')) {
            console.log(`DAMAGES MATCH: ID: ${d._id}, Product: ${dec.productName}, Qty: ${dec.quantity}`);
        }
    });

    await mongoose.disconnect();
}

run().catch(console.error);
