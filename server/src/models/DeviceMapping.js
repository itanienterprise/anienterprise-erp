const mongoose = require('mongoose');

// Maps ZKTech enrollId → ERP Employee _id
const deviceMappingSchema = new mongoose.Schema({
  enrollId:     { type: Number, required: true, unique: true },
  employeeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeName: { type: String, default: '' },
  employeeEmpId:{ type: String, default: '' },  // E-1001 etc
  deviceId:     { type: String, default: 'F8-DEFAULT' },
  notes:        { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('DeviceMapping', deviceMappingSchema);
