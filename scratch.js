const { calculateStockData } = require('./client/src/utils/stockHelpers.js');
const mongoose = require('mongoose');
const Sale = require('./server/src/models/Sale');
const Stock = require('./server/src/models/Stock');
const Warehouse = require('./server/src/models/Warehouse');
const Product = require('./server/src/models/Product');
const { decryptData } = require('./server/src/utils/encryption');

mongoose.connect('mongodb://localhost:27017/erp_db').then(async () => {
    const rawSales = await Sale.find({});
    const salesRecords = rawSales.map(r => ({ ...decryptData(r.data), _id: r._id, createdAt: r.createdAt }));
    
    const rawStock = await Stock.find({});
    const stockRecords = rawStock.map(r => ({ ...decryptData(r.data), _id: r._id, createdAt: r.createdAt }));
    
    const rawWh = await Warehouse.find({});
    const warehouseData = rawWh.map(r => ({ ...decryptData(r.data), _id: r._id, createdAt: r.createdAt, recordType: 'warehouse' }));
    
    const rawProd = await Product.find({});
    const products = rawProd.map(r => ({ ...decryptData(r.data), _id: r._id, createdAt: r.createdAt }));
    
    const result = calculateStockData(stockRecords, {}, '', warehouseData, salesRecords, products);
    
    const mosur = result.displayRecords.find(r => r.productName === 'MOSUR DAL' || r.productName === 'Maize');
    console.log(JSON.stringify(mosur, null, 2));
    
    process.exit(0);
});
