const mongoose = require('mongoose');

const lcPurchaseSchema = new mongoose.Schema({
  data: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('LCPurchase', lcPurchaseSchema);
