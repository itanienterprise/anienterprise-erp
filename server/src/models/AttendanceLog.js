const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema({
  employeeId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeName:  { type: String, default: '' },
  employeeEmpId: { type: String, default: '' }, // ERP employeeId like E-1001
  date:          { type: String, required: true },  // "YYYY-MM-DD"
  shiftId:       { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftConfig', default: null },
  firstPunchIn:  { type: Date, default: null },
  lastPunchOut:  { type: Date, default: null },
  totalHours:    { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  status:        { type: String, enum: ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'HOLIDAY', 'LEAVE', 'WEEKEND'], default: 'ABSENT' },
  leaveType:     { type: String, default: null },
  remarks:       { type: String, default: '' },
  manualOverride:{ type: Boolean, default: false },
  overriddenBy:  { type: String, default: '' }
}, { timestamps: true });

// Unique constraint: one log per employee per date
attendanceLogSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceLog', attendanceLogSchema);
