const mongoose = require('mongoose');

const costOfGoodsSchema = new mongoose.Schema({
    data: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CostOfGoods', costOfGoodsSchema);
