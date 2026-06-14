const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
    invoiceNo: {
        type: String,
        unique: true,
        sparse: true
    },
    saleType: {
        type: String
    },
    data: {
        type: String, // Encrypted data
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema);
