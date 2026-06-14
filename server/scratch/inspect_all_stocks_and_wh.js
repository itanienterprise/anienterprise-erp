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
    return { ...d, _id: r._id, createdAt: r.createdAt.toISOString() };
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

    console.log("=== BRAN STOCK RECORDS ===");
    stockRecords.forEach(s => {
        if ((s.productName || s.product || '').toUpperCase() === 'BRAN') {
            console.log(`StockID: ${s._id} | LC: ${s.lcNo} | Prod: ${s.productName} | Brand: ${s.brand} | Wh: ${s.warehouse || s.whName} | Qty: ${s.quantity} | InHouseQty: ${s.inHouseQuantity} | status: ${s.status}`);
            if (s.brandEntries && s.brandEntries.length > 0) {
                console.log(`  -> BrandEntries:`, JSON.stringify(s.brandEntries));
            }
        }
    });

    console.log("\n=== BRAN WAREHOUSE RECORDS ===");
    warehouseData.forEach(w => {
        if ((w.productName || w.product || '').toUpperCase() === 'BRAN') {
            console.log(`WhID: ${w._id} | Name: ${w.whName} | Prod: ${w.productName} | Brand: ${w.brand} | Qty: ${w.whQty} | Pkt: ${w.whPkt} | Location: ${w.location} | status: ${w.status}`);
        }
    });

    console.log("\n=== BRAN SALES RECORDS ===");
    salesRecords.forEach(s => {
        let matches = false;
        (s.items || []).forEach(item => {
            if ((item.productName || '').toUpperCase() === 'BRAN') {
                matches = true;
            }
        });
        if (matches) {
            console.log(`Sale Invoice: ${s.invoiceNo} | Date: ${s.date} | Status: ${s.status}`);
            (s.items || []).forEach(item => {
                if ((item.productName || '').toUpperCase() === 'BRAN') {
                    console.log(`  Item: ${item.productName}`);
                    (item.brandEntries || []).forEach(be => {
                        console.log(`    Brand: ${be.brand} | Wh: ${be.warehouseName} | Qty: ${be.quantity} | Pkt: ${be.packet}`);
                    });
                }
            });
        }
    });

    console.log("\n=== RUNNING STOCK DATA ===");
    const res = calculateStockData(stockRecords, {}, '', warehouseData, salesRecords, products, damages);
    res.displayRecords.forEach(group => {
        console.log(`\nProduct: ${group.productName} | Closing: ${group.closingQuantity}`);
        group.brandList.forEach(b => {
            console.log(`  Brand: ${b.brand} | Closing: ${b.closingQuantity} | Opening: ${b.openingQuantity} | Sale: ${b.saleQuantity} | Damage: ${b.damageQuantity} | Arrival: ${b.periodArrivalQuantity}`);
        });
    });

    process.exit(0);
});
