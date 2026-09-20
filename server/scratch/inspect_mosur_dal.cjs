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
    const StockBaseline = mongoose.model('StockBaseline', genericSchema, 'stockbaselines');

    let stockRecords = await Stock.find({});
    let warehouseData = await Warehouse.find({});
    let salesRecords = await Sale.find({});
    let products = await Product.find({});
    let damages = await Damage.find({});
    let baselines = await StockBaseline.find({});

    const decryptAll = (arr) => arr.map(r => {
        let d = decryptData(r.toObject().data);
        if (d && d.data && typeof d.data === 'string') {
            try { d = decryptData(d.data); } catch (e) {}
        }
        return { ...d, _id: r._id.toString(), createdAt: r.createdAt };
    }).filter(Boolean);

    stockRecords = JSON.parse(JSON.stringify(decryptAll(stockRecords)));
    warehouseData = JSON.parse(JSON.stringify(decryptAll(warehouseData)));
    salesRecords = JSON.parse(JSON.stringify(decryptAll(salesRecords)));
    products = JSON.parse(JSON.stringify(decryptAll(products)));
    damages = JSON.parse(JSON.stringify(decryptAll(damages)));
    baselines = JSON.parse(JSON.stringify(decryptAll(baselines)));

    const { calculateStockData } = await import('../../client/src/utils/stockHelpers.js');

    console.log("=== Active Baselines ===");
    console.log("Baselines count:", baselines.length);
    const activeBaseline = baselines.find(b => b.status === 'Active' || b.isActive);
    console.log("Active baseline:", activeBaseline ? { date: activeBaseline.date, name: activeBaseline.name } : 'None');

    console.log("\n=== OrderManagement calculation for MOSUR DAL, HASINA MEDIUM, HLI ===");
    const whStockFilters = {
        productName: 'MOSUR DAL',
        brand: 'HASINA MEDIUM',
        warehouse: 'HLI',
        reportType: 'price'
    };
    const resOM = calculateStockData(
        stockRecords,
        whStockFilters,
        '',
        warehouseData,
        salesRecords,
        products,
        damages
    );
    const matchedOM = resOM?.displayRecords?.find(g => (g.productName || '').trim().toLowerCase() === 'mosur dal');
    console.log("OM displayRecords count:", resOM?.displayRecords?.length);
    if (matchedOM) {
        console.log("Matched product:", matchedOM.productName);
        console.log("Brands in matched group:");
        matchedOM.brandList.forEach(b => {
            console.log(`  Brand: "${b.brand}", LC: "${b.lcNo}", saleableQty: ${b.saleableQuantity}, saleablePkt: ${b.saleablePacket}, inHouseQty: ${b.inHouseQuantity}, orderQty: ${b.orderQuantity}`);
        });
    } else {
        console.log("No matched group found for MOSUR DAL in OM calculation!");
    }

    console.log("\n=== StockManagement calculation (with activeBaseline if any) ===");
    const resStockMgmt = calculateStockData(
        stockRecords,
        { productName: 'MOSUR DAL', warehouse: 'HLI', reportType: 'price' },
        '',
        warehouseData,
        salesRecords,
        products,
        damages,
        activeBaseline
    );
    const matchedSM = resStockMgmt?.displayRecords?.find(g => (g.productName || '').trim().toLowerCase() === 'mosur dal');
    if (matchedSM) {
        console.log("Matched SM product:", matchedSM.productName);
        matchedSM.brandList.forEach(b => {
            console.log(`  Brand: "${b.brand}", LC: "${b.lcNo}", saleableQty: ${b.saleableQuantity}, saleablePkt: ${b.saleablePacket}, inHouseQty: ${b.inHouseQuantity}, orderQty: ${b.orderQuantity}`);
        });
    }

    console.log("\n=== Global Stock (All Warehouses) for MOSUR DAL ===");
    const resGlobal = calculateStockData(
        stockRecords,
        { productName: 'MOSUR DAL', reportType: 'price' },
        '',
        warehouseData,
        salesRecords,
        products,
        damages,
        activeBaseline
    );
    const matchedGlobal = resGlobal?.displayRecords?.find(g => (g.productName || '').trim().toLowerCase() === 'mosur dal');
    if (matchedGlobal) {
        matchedGlobal.brandList.forEach(b => {
            console.log(`  Brand: "${b.brand}", LC: "${b.lcNo}", saleableQty: ${b.saleableQuantity}, saleablePkt: ${b.saleablePacket}, inHouseQty: ${b.inHouseQuantity}, orderQty: ${b.orderQuantity}`);
        });
    }

    await mongoose.disconnect();
}

run().catch(console.error);
