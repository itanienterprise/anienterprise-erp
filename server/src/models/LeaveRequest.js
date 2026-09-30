const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  employeeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeName: { type: String, default: '' },
  employeeEmpId:{ type: String, default: '' },
  leaveType:    { type: String, enum: ['SICK', 'ANNUAL', 'CASUAL', 'UNPAID', 'OTHER'], required: true },
  fromDate:     { type: String, required: true },  // "YYYY-MM-DD"
  toDate:       { type: String, required: true },  // "YYYY-MM-DD"
  totalDays:    { type: Number, default: 1 },
  reason:       { type: String, default: '' },
  status:       { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  approvedBy:   { type: String, default: '' },
  approvedAt:   { type: Date, default: null },
  approveNote:  { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
