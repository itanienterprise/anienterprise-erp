const mongoose = require('mongoose');

const stockBaselineSchema = new mongoose.Schema({
    data: {
        type: String, // Encrypted data { baselineDate, note, setBy, summary, snapshotRecords, status }
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('StockBaseline', stockBaselineSchema);
