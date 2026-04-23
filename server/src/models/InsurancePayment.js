const mongoose = require('mongoose');

const insurancePaymentSchema = new mongoose.Schema({
    data: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('InsurancePayment', insurancePaymentSchema);
