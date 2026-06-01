const mongoose = require('mongoose');
const Sale = require('./src/models/Sale');
const Stock = require('./src/models/Stock');
const Warehouse = require('./src/models/Warehouse');
const Product = require('./src/models/Product');
const Damage = require('./src/models/Damage');

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    console.log("Sales:", await Sale.countDocuments({}));
    console.log("Stocks:", await Stock.countDocuments({}));
    console.log("Warehouses:", await Warehouse.countDocuments({}));
    console.log("Products:", await Product.countDocuments({}));
    console.log("Damages:", await Damage.countDocuments({}));
    process.exit(0);
});
