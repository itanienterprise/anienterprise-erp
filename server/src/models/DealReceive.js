const mongoose = require('mongoose');

const dealReceiveSchema = new mongoose.Schema({
  data: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('DealReceive', dealReceiveSchema);

