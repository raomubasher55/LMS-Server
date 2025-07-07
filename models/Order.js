const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderId: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  discountedAmount: {
    type: Number,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'INR', 'PKR'] // Add more as needed
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['credit_card', 'paypal', 'stripe', 'wallet', 'bank_transfer', 'maxicash']
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  transactionId: String, // Payment gateway transaction ID
  reference: String, // Payment reference for tracking
  invoiceUrl: String, // Link to downloadable invoice
  couponUsed: {
    code: String,
    discount: Number
  },
  revenueSplit: {
    platform: { type: Number, required: true }, // Platform commission percentage
    instructor: { type: Number, required: true } // Instructor earnings percentage
  },
  payoutStatus: {
    type: String,
    enum: ['pending', 'processed', 'rejected'],
    default: 'pending'
  },
  payoutDate: Date, // When instructor payment was processed
  payoutTransactionId: String, // Payout reference ID
  metadata: mongoose.Schema.Types.Mixed, // Additional payment gateway data
  ipAddress: String, // Customer IP for fraud detection
  deviceInfo: String, // Device used for purchase
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled', 'refunded'],
    default: 'pending'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for formatted order date
orderSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Indexes for faster queries
orderSchema.index({ user: 1 });
orderSchema.index({ course: 1 });
orderSchema.index({ instructor: 1 });
orderSchema.index({ orderId: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

// Pre-save hook to generate order ID
orderSchema.pre('save', async function(next) {
  if (!this.orderId) {
    this.orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
  next();
});



// Update instructor's pending balance when order is completed
orderSchema.post('save', async function(doc) {
  if (doc.paymentStatus === 'completed' && doc.payoutStatus === 'pending') {
    const instructorEarnings = doc.discountedAmount 
      ? doc.discountedAmount * (doc.revenueSplit.instructor / 100)
      : doc.amount * (doc.revenueSplit.instructor / 100);
    
    await mongoose.model('User').findByIdAndUpdate(doc.instructor, {
      $inc: { 
        'instructorProfile.pendingBalance': instructorEarnings,
        'instructorProfile.totalEarnings': instructorEarnings
      }
    });
  }
});


orderSchema.post('save', async function(order) {
    if (order.totalAmount > 500) {
      await Notice.create({
        title: `Premium order placed: $${order.totalAmount}`,
        type: 'financial',
        priority: 'high',
        relatedEntity: { kind: 'Order', item: order._id }
      });
    }
  });

module.exports = mongoose.model('Order', orderSchema);