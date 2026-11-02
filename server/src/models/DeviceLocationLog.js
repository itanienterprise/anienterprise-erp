const mongoose = require('mongoose');

const deviceLocationLogSchema = new mongoose.Schema({
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
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  accuracy: {
    type: Number, // Accuracy in meters
    default: null
  },
  speed: {
    type: Number, // Speed in km/h
    default: null
  },
  heading: {
    type: Number, // Direction in degrees
    default: null
  },
  altitude: {
    type: Number,
    default: null
  },
  batteryLevel: {
    type: Number, // Percentage 0-100
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
    default: 'cellular'
  },
  address: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

// Compound index for querying employee location history over a time range efficiently
deviceLocationLogSchema.index({ employeeId: 1, timestamp: -1 });
deviceLocationLogSchema.index({ deviceId: 1, timestamp: -1 });

module.exports = mongoose.model('DeviceLocationLog', deviceLocationLogSchema);

