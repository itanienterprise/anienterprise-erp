const mongoose = require('mongoose');

const shiftConfigSchema = new mongoose.Schema({
  shiftName:       { type: String, required: true },
  startTime:       { type: String, required: true },  // "09:00"
  endTime:         { type: String, required: true },  // "18:00"
  graceMinutes:    { type: Number, default: 15 },
  breakMinutes:    { type: Number, default: 60 },
  isDefault:       { type: Boolean, default: false },
  applicableTo:    [{ type: mongoose.Schema.Types.ObjectId }] // Employee _ids; empty = all
}, { timestamps: true });

module.exports = mongoose.model('ShiftConfig', shiftConfigSchema);
