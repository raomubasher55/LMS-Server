const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }, 
  title: { type: String, required: true },
  type: { type: String, enum: ['profile_update', 'security', 'application', 'course', 'video', 'message'], required: true },
  courseId: { type: String },
  name:{ type: String },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
