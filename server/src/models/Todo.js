const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  completed: {
    type: Boolean,
    default: false,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'medium', 'high'],
    default: 'normal'
  },
  dueDate: {
    type: String, // 'YYYY-MM-DD'
    default: null
  },
  category: {
    type: String,
    default: 'General'
  },
  assignedTo: {
    type: String,
    default: 'All', // 'All' or specific username
    index: true
  },
  createdBy: {
    type: String,
    required: true,
    index: true
  },
  createdByName: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Todo', todoSchema);
