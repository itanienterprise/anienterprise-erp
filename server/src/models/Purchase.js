const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  data: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Purchase', purchaseSchema);
