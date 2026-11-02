const mongoose = require('mongoose');

const deviceRegistrySchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: false,
    default: null,
    index: true
  },
  employeeName: {
    type: String,
    default: ''
  },
  employeeEmpId: {
    type: String,
    default: ''
  },
  deviceId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  deviceModel: {
    type: String,
    default: 'Unknown Device' // e.g. "Samsung Galaxy A54", "Pixel 7"
  },
  imei: {
    type: String,
    default: '',
    trim: true,
    index: true
  },
  macAddress: {
    type: String,
    default: '',
    trim: true
  },
  manufacturer: {
    type: String,
    default: ''
  },
  osVersion: {
    type: String,
    default: '' // e.g. "Android 14"
  },
  platform: {
    type: String,
    default: 'android' // 'android' | 'ios' | 'web'
  },
  appVersion: {
    type: String,
    default: '1.0.0'
  },
  batteryLevel: {
    type: Number,
    min: 0,
    max: 100,
    default: null
  },
  isCharging: {
    type: Boolean,
    default: false
  },
  networkType: {
    type: String,
    enum: ['wifi', 'cellular', 'none', 'unknown'],
    default: 'unknown'
  },
  isGpsEnabled: {
    type: Boolean,
    default: true
  },
  trackingPermission: {
    type: String,
    enum: ['granted', 'denied', 'restricted', 'not_determined'],
    default: 'granted'
  },
  lastLocation: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    accuracy: { type: Number, default: null }, // meters
    speed: { type: Number, default: null }, // km/h
    heading: { type: Number, default: null }, // degrees
    address: { type: String, default: '' },
    updatedAt: { type: Date, default: null }
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['approved', 'pending', 'suspended', 'revoked'],
    default: 'approved'
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Helper to determine if device is currently considered online (pinged within last 5 minutes)
deviceRegistrySchema.methods.checkOnline = function() {
  if (!this.lastSeen) return false;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.lastSeen >= fiveMinutesAgo;
};

module.exports = mongoose.model('DeviceRegistry', deviceRegistrySchema);

