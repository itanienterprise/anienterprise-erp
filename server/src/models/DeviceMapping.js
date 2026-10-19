const mongoose = require('mongoose');

// Maps ZKTech enrollId → ERP Employee _id
const deviceMappingSchema = new mongoose.Schema({
  enrollId:     { type: Number, required: true, unique: true },
  employeeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  employeeName: { type: String, default: '' },
  employeeEmpId:{ type: String, default: '' },  // E-1001 or CARD-5 etc
  deviceId:     { type: String, default: 'F8-DEFAULT' },
  shiftId:      { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftConfig', default: null },
  shiftName:    { type: String, default: '' },
  notes:        { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('DeviceMapping', deviceMappingSchema);
