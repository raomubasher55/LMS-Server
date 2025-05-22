const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['credit_card', 'paypal', 'bank_account'],
    required: true
  },
  // For credit cards
  cardDetails: {
    lastFour: String,
    brand: String,
    expiryMonth: Number,
    expiryYear: Number,
    nameOnCard: String
  },
  // For PayPal
  paypalDetails: {
    email: String
  },
  // For bank accounts
  bankDetails: {
    accountName: String,
    lastFour: String,
    bankName: String
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  // This would be the token or ID from payment processor (e.g. Stripe)
  paymentToken: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure a user can have only one default payment method
paymentMethodSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);