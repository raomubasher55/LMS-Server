const mongoose = require('mongoose');

const submissionFileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalname: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  path: { type: String, required: true }
}, { _id: false });

const submissionSchema = new mongoose.Schema({
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  files: [submissionFileSchema],
  comment: { type: String },
  grade: {
    points: { type: Number, default: null },
    feedback: { type: String, default: '' },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    gradedAt: { type: Date, default: null }
  },
  status: {
    type: String,
    enum: ['submitted', 'graded', 'resubmit'],
    default: 'submitted'
  },
  submittedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save hook to update updatedAt on every update
submissionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Submission', submissionSchema);