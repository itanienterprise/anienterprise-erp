const mongoose = require('mongoose');

const damageSchema = new mongoose.Schema({
    data: {
        type: String, // Encrypted data
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Damage', damageSchema);
