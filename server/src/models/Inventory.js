const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    data: {
        type: String, // Encrypted data
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Inventory', inventorySchema);
