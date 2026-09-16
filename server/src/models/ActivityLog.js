const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    userId: {
        type: String,
        required: false
    },
    username: {
        type: String,
        default: 'System',
        index: true
    },
    userRole: {
        type: String,
        required: false
    },
    displayName: {
        type: String,
        required: false
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
        required: false
    },
    ip: {
        type: String,
        required: false
    },
    userAgent: {
        type: String,
        required: false
    },
    method: {
        type: String,
        required: false
    },
    path: {
        type: String,
        required: false
    },
    status: {
        type: String,
        default: 'SUCCESS',
        enum: ['SUCCESS', 'FAILED', 'INFO']
    }
}, {
    timestamps: false,
    versionKey: false
});

// Lean composite indexes for efficient querying & sorting without index bloat
activityLogSchema.index({ timestamp: -1 });
activityLogSchema.index({ timestamp: -1, username: 1 });
activityLogSchema.index({ timestamp: -1, module: 1 });
activityLogSchema.index({ timestamp: -1, actionCategory: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
