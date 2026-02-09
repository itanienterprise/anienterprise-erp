const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    data: {
        type: String, // Encrypted data
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
