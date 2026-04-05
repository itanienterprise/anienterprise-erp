const mongoose = require('mongoose');

const cnfSchema = new mongoose.Schema({
    data: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CnF', cnfSchema);
