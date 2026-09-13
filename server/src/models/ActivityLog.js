const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    userId: {
        type: String,
        default: ''
    },
    username: {
        type: String,
        default: 'System',
        index: true
    },
    userRole: {
        type: String,
        default: ''
    },
    displayName: {
        type: String,
        default: ''
    },
    module: {
        type: String,
        default: 'System',
        index: true
    },
    action: {
        type: String,
        default: 'OPERATION',
        index: true
    },
    actionCategory: {
        type: String,
        default: 'MUTATION',
        enum: ['MUTATION', 'APPROVAL', 'AUTH', 'UI_CLICK', 'SYSTEM'],
        index: true
    },
    description: {
        type: String,
        required: true
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ip: {
        type: String,
        default: ''
    },
    userAgent: {
        type: String,
        default: ''
    },
    method: {
        type: String,
        default: ''
    },
    path: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        default: 'SUCCESS',
        enum: ['SUCCESS', 'FAILED', 'INFO']
    }
}, {
    timestamps: true
});

// Composite index for fast querying & sorting
activityLogSchema.index({ timestamp: -1, username: 1 });
activityLogSchema.index({ timestamp: -1, module: 1 });
activityLogSchema.index({ timestamp: -1, actionCategory: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
