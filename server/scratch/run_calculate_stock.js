const mongoose = require('mongoose');
const Sale = require('../src/models/Sale');
const Stock = require('../src/models/Stock');
const Warehouse = require('../src/models/Warehouse');
const Product = require('../src/models/Product');
const Damage = require('../src/models/Damage');
const { decryptData } = require('../src/utils/encryption');
const { calculateStockData } = require('../../client/src/utils/stockHelpers.js');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.productName && !d.whName && !d.warehouse) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id.toString(), createdAt: r.createdAt.toISOString() };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawSales = await Sale.find({});
    const salesRecords = rawSales.map(decryptRecord);
    
    const rawStock = await Stock.find({});
    const stockRecords = rawStock.map(decryptRecord);
    
    const rawWh = await Warehouse.find({});
    const warehouseData = rawWh.map(r => ({ ...decryptRecord(r), recordType: 'warehouse' }));
    
    const rawProd = await Product.find({});
    const products = rawProd.map(decryptRecord);

    const rawDamages = await Damage.find({});
    const damages = rawDamages.map(decryptRecord);

    console.log("=== CALCULATING STOCK DATA FOR CHICK PEAS ===");
    const res = calculateStockData(stockRecords, {}, '', warehouseData, salesRecords, products, damages);
    const cpGroup = res.displayRecords.find(g => g.productName === 'CHICK PEAS');
    
    if (cpGroup) {
        console.log("CP Group totals:");
        console.log(`  openingQuantity: ${cpGroup.openingQuantity}`);
        console.log(`  periodArrivalQuantity: ${cpGroup.periodArrivalQuantity}`);
        console.log(`  saleQuantity: ${cpGroup.saleQuantity}`);
        console.log(`  damageQuantity: ${cpGroup.damageQuantity}`);
        console.log(`  inHouseQuantity: ${cpGroup.inHouseQuantity}`);
        
        console.log("\nBrands inside CP Group:");
        cpGroup.brandList.forEach(b => {
            console.log(`\nBrand: ${b.brand}`);
            console.log(`  openingQuantity: ${b.openingQuantity}`);
            console.log(`  periodArrivalQuantity: ${b.periodArrivalQuantity}`);
            console.log(`  saleQuantity: ${b.saleQuantity}`);
            console.log(`  damageQuantity: ${b.damageQuantity}`);
            console.log(`  inHouseQuantity: ${b.inHouseQuantity}`);
            console.log(`  lcNos: ${JSON.stringify(b.lcNos)}`);
        });
    } else {
        console.log("CHICK PEAS not found in display records!");
    }

    process.exit(0);
});
