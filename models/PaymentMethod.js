const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['credit_card', 'paypal', 'bank_account'],
    required: true
  },
  // Credit card details
  cardDetails: {
    lastFour: String,
    brand: String, // visa, mastercard, amex, etc.
    expiryMonth: String,
    expiryYear: String,
    nameOnCard: String
  },
  // PayPal details
  paypalDetails: {
    email: String
  },
  // Bank account details
  bankDetails: {
    accountName: String,
    lastFour: String,
    bankName: String
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  paymentToken: {
    type: String,
    required: true // This would be the token from payment processor
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Ensure only one default payment method per user
paymentMethodSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await this.constructor.updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);