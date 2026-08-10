const mongoose = require('mongoose');

const purchaseReceiveSchema = new mongoose.Schema({
  data: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('PurchaseReceive', purchaseReceiveSchema);
