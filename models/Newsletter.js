const mongoose = require("mongoose");

const newsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      "Please enter a valid email address"
    ]
  },
  status: {
    type: String,
    enum: ["active", "unsubscribed", "bounced"],
    default: "active"
  },
  subscribedAt: {
    type: Date,
    default: Date.now
  },
  unsubscribedAt: {
    type: Date
  },
  source: {
    type: String,
    default: "website" 
  },
  preferences: {
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      default: "weekly"
    },
    categories: [{
      type: String,
      enum: ["tech", "business", "health", "education", "general"]
    }]
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    referrer: String
  }
}, {
  timestamps: true
});

// Index for better query performance
newsletterSchema.index({ email: 1 });
newsletterSchema.index({ status: 1 });
newsletterSchema.index({ subscribedAt: -1 });

// Pre-save middleware to handle unsubscription timestamp
newsletterSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'unsubscribed' && !this.unsubscribedAt) {
    this.unsubscribedAt = new Date();
  }
  next();
});

// Static method to get active subscribers count
newsletterSchema.statics.getActiveCount = function() {
  return this.countDocuments({ status: 'active' });
};

// Instance method to unsubscribe
newsletterSchema.methods.unsubscribe = function() {
  this.status = 'unsubscribed';
  this.unsubscribedAt = new Date();
  return this.save();
};

module.exports = mongoose.model("Newsletter", newsletterSchema);