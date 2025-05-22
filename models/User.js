const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Notice = require('./Notice');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, "First name is required"],
    trim: true,
    minlength: 2,
    maxlength: 50,
  },
  lastName: {
    type: String,
    required: [true, "Last name is required"],
    trim: true,
    minlength: 2,
    maxlength: 50,
  },
  username: {
    type: String,
    required: [true, "Username is required"],
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  },
  profile:{
    type: String,
    required:true
  },
  email: {
    type: String,
    required: [true, "Email address is required"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/.+\@.+\..+/, "Please fill a valid email address"]
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: 6,
  },
  role: {
    type: String,
    enum: ['admin', 'student', 'instructor'],
    default: 'student',
  },
  phoneNumber: {
    type: String,
    trim: true,
  },
  
  skill: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  
  bio: {
    type: String,
    trim: true,
    maxlength: 200,
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false, 
  },
  verificationToken: {
    type: String, 
  },
  instructorProfile: {
    bio: { type: String, maxlength: 500 },
    expertise: [String],
    socialLinks: {
      facebook: String,
      twitter: String,
      linkedin: String,
      website: String,
      github: String,
    },
    totalEarnings: { type: Number, default: 0 }, // Lifetime earnings (after admin cut)
    pendingBalance: { type: Number, default: 0 }, // Withdrawable amount
    certificateFile: { type: String, default: "" }, 
  },
  
  // 👇 For students (track progress + certificates)
  studentProfile: {
    completedCourses: [
      {
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
        completedOn: Date,
        certificateId: { type: mongoose.Schema.Types.ObjectId, ref: "Certificate" },
      }
    ],
    quizScores: [
      {
        quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz" },
        score: Number, // Percentage
        passed: Boolean,
      }
    ],
  },
  // 👇 Shared fields (for all roles)
  wallet: {
    type: Number,
    default: 0, // For admin revenue tracking
  },
  withdrawalHistory: [
    {
      amount: Number,
      date: { type: Date, default: Date.now },
      status: { type: String, enum: ['pending', 'completed', 'rejected'], default: 'pending' },
      transactionId: String, // For PayPal/Stripe reference
    }
  ],
  purchasedCourses: [
    {
      course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
      purchasedAt: { type: Date, default: Date.now },
      progress: { type: Number, default: 0 }, // 0-100% completion
      lastAccessed: Date, // Last watched lecture
      paymentAmount: { type: Number }, // Amount paid for the course
      paymentMethod: { type: String, default: 'stripe' }, // Payment method used
      transactionId: { type: String }, // Stripe transaction ID
    }
  ],
  // Simple array for enrolled courses (both free and paid)
  enrolledCourses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  
  // Course progress tracking
  courseProgress: [{
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },  
    completedChapters: [{ type: mongoose.Schema.Types.ObjectId }], // Array of completed chapter IDs
    chapterWatchTimes: [{
      chapterId: { type: mongoose.Schema.Types.ObjectId },
      watchTime: { type: Number, default: 0 }, // Seconds watched
      totalDuration: { type: Number, default: 0 } // Total video duration
    }],
    overallProgress: { type: Number, default: 0 }, // 0-100% completion
    lastAccessedAt: { type: Date, default: Date.now }
  }],

  // Quiz progress tracking
  quizProgress: [{
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    chapterId: { type: mongoose.Schema.Types.ObjectId },
    attempts: [{
      score: { type: Number, min: 0, max: 100 },
      answers: [String],
      attemptedAt: { type: Date, default: Date.now },
      passed: { type: Boolean, default: false }
    }],
    bestScore: { type: Number, default: 0, min: 0, max: 100 },
    passed: { type: Boolean, default: false },
    lastAttemptAt: { type: Date, default: Date.now },
    // Progressive restriction fields
    totalAttempts: { type: Number, default: 0 },
    nextAttemptAllowedAt: { type: Date, default: null },
    mustReWatchVideo: { type: Boolean, default: false },
    videoReWatchedAt: { type: Date, default: null },
    instructorApprovalRequired: { type: Boolean, default: false },
    instructorApprovalGranted: { type: Boolean, default: false },
    instructorApprovalGrantedAt: { type: Date, default: null },
    instructorApprovalGrantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
}, { timestamps: true });


userSchema.pre('save', async function(next) {
  if (this.isModified('password') || this.isNew) {
    try {
      const salt = await bcrypt.genSalt(10); 
      this.password = await bcrypt.hash(this.password, salt); 
      next(); 
    } catch (err) {
      next(err); 
    }
  } else {
    next();
  }
});


userSchema.post('save', async function(user) {
  if (user.role === 'instructor') {
    await Notice.create({
      title: `New instructor registered: ${user.name}`,
      type: 'user',
      priority: 'high',
      relatedEntity: { kind: 'User', item: user._id }
    });
  }
});

module.exports = mongoose.model('User', userSchema);