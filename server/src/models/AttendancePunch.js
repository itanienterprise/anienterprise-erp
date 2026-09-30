const mongoose = require('mongoose');

const attendancePunchSchema = new mongoose.Schema({
  deviceId:   { type: String, default: 'F8-DEFAULT' },
  enrollId:   { type: Number, required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  punchTime:  { type: Date, required: true },
  punchType:  { type: String, enum: ['IN', 'OUT', 'BREAK_IN', 'BREAK_OUT', 'UNKNOWN'], default: 'UNKNOWN' },
  verifyMode: { type: String, default: 'UNKNOWN' },
  rawPayload: { type: String, default: '' },
  processed:  { type: Boolean, default: false },
  unmatched:  { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('AttendancePunch', attendancePunchSchema);
