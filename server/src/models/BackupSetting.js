const mongoose = require('mongoose');

const backupSettingSchema = new mongoose.Schema({
    enabled: {
        type: Boolean,
        default: false
    },
    schedule: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        default: 'daily'
    },
    time: {
        type: String,
        default: '02:00' // Format 'HH:MM'
    },
    dayOfWeek: {
        type: Number,
        default: 0 // 0 = Sunday, 1 = Monday, etc.
    },
    dayOfMonth: {
        type: Number,
        default: 1 // 1 to 31
    },
    lastRun: {
        type: Date,
        default: null
    },
    backupDirectory: {
        type: String,
        default: 'backups'
    },
    timezoneOffset: {
        type: Number,
        default: 0 // offset in minutes
    }
}, { timestamps: true });

module.exports = mongoose.model('BackupSetting', backupSettingSchema);
