const mongoose = require('mongoose');

const trSetupSchema = new mongoose.Schema({
    data: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TRSetup', trSetupSchema);
