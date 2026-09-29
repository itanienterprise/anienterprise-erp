const mongoose = require('mongoose');

const userDailyActivitySchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        index: true
    },
    date: {
        type: String, // 'YYYY-MM-DD'
        required: true,
        index: true
    },
    activeSeconds: {
        type: Number,
        default: 0
    },
    firstActive: {
        type: Date,
        default: Date.now
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    lastHeartbeat: {
        type: Date,
        default: Date.now
    },
    actionCount: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

userDailyActivitySchema.index({ username: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('UserDailyActivity', userDailyActivitySchema);
