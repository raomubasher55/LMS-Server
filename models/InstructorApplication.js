// models/InstructorApplication.js
const mongoose = require('mongoose');

const instructorApplicationSchema = new mongoose.Schema({
  // Personal Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please provide a valid phone number']
  },
  
  // Professional Information
  bio: {
    type: String,
    required: [true, 'Bio is required'],
    trim: true,
    maxlength: [1000, 'Bio cannot exceed 1000 characters']
  },
  expertise: {
    type: String,
    required: [true, 'Area of expertise is required'],
    trim: true,
    maxlength: [200, 'Expertise cannot exceed 200 characters']
  },
  experience: {
    type: String,
    required: [true, 'Professional experience is required'],
    trim: true,
    maxlength: [2000, 'Experience description cannot exceed 2000 characters']
  },
  courseTopics: {
    type: String,
    required: [true, 'Course topics are required'],
    trim: true,
    maxlength: [500, 'Course topics cannot exceed 500 characters']
  },
  teachingExperience: {
    type: String,
    required: [true, 'Teaching experience is required'],
    trim: true,
    maxlength: [1500, 'Teaching experience cannot exceed 1500 characters']
  },
  
  // Application Status
  status: {
    type: String,
    enum: ['pending', 'under_review', 'interview_scheduled', 'approved', 'rejected'],
    default: 'pending'
  },
  
  // Legal Agreement
  agreeToTerms: {
    type: Boolean,
    required: [true, 'You must agree to the terms and conditions'],
    validate: {
      validator: function(v) {
        return v === true;
      },
      message: 'You must agree to the terms and conditions'
    }
  },
  
  // Timestamps and Review Information
  submittedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  
  // Additional Information
  notes: [{
    content: {
      type: String,
      required: true
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Interview Information
  interviewScheduled: {
    type: Boolean,
    default: false
  },
  interviewDate: {
    type: Date,
    default: null
  },
  interviewLink: {
    type: String,
    default: null
  },
  
  // Rejection Reason (if applicable)
  rejectionReason: {
    type: String,
    default: null
  },
  
  // Social Media Links (optional)
  socialMedia: {
    linkedin: { type: String, default: null },
    twitter: { type: String, default: null },
    website: { type: String, default: null }
  },
  
  // Skills and Qualifications
  skills: [{
    type: String,
    trim: true
  }],
  qualifications: [{
    title: { type: String, required: true },
    institution: { type: String, required: true },
    year: { type: Number, required: true },
    verified: { type: Boolean, default: false }
  }],
  
  // Course Creation Preferences
  preferredCourseFormat: {
    type: String,
    enum: ['video', 'text', 'mixed', 'live'],
    default: 'video'
  },
  estimatedCoursesPerYear: {
    type: Number,
    min: 1,
    max: 50,
    default: 1
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
instructorApplicationSchema.index({ email: 1 });
instructorApplicationSchema.index({ status: 1 });
instructorApplicationSchema.index({ submittedAt: -1 });
instructorApplicationSchema.index({ expertise: 1 });

// Virtual for full name
instructorApplicationSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for application age
instructorApplicationSchema.virtual('applicationAge').get(function() {
  return Math.floor((Date.now() - this.submittedAt) / (1000 * 60 * 60 * 24)); // Days
});

// Pre-save middleware
instructorApplicationSchema.pre('save', function(next) {
  // Convert email to lowercase
  if (this.email) {
    this.email = this.email.toLowerCase();
  }
  
  // Set reviewedAt when status changes to approved or rejected
  if (this.isModified('status') && ['approved', 'rejected'].includes(this.status)) {
    this.reviewedAt = new Date();
  }
  
  next();
});

// Static methods
instructorApplicationSchema.statics.getPendingApplications = function() {
  return this.find({ status: 'pending' }).sort({ submittedAt: -1 });
};

instructorApplicationSchema.statics.getApplicationsByStatus = function(status) {
  return this.find({ status }).sort({ submittedAt: -1 });
};

instructorApplicationSchema.statics.getApplicationStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Instance methods
instructorApplicationSchema.methods.approve = function(reviewerId) {
  this.status = 'approved';
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  return this.save();
};

instructorApplicationSchema.methods.reject = function(reviewerId, reason) {
  this.status = 'rejected';
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.rejectionReason = reason;
  return this.save();
};

instructorApplicationSchema.methods.addNote = function(content, adminId) {
  this.notes.push({
    content,
    addedBy: adminId,
    addedAt: new Date()
  });
  return this.save();
};

instructorApplicationSchema.methods.scheduleInterview = function(date, link) {
  this.status = 'interview_scheduled';
  this.interviewScheduled = true;
  this.interviewDate = date;
  this.interviewLink = link;
  return this.save();
};

const InstructorApplication = mongoose.model('InstructorApplication', instructorApplicationSchema);

module.exports = InstructorApplication;