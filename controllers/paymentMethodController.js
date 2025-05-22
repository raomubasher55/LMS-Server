const PaymentMethod = require('../models/PaymentMethod');
const User = require('../models/User');

/**
 * Add a new payment method for a user
 */
exports.addPaymentMethod = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, cardDetails, paypalDetails, bankDetails, paymentToken, isDefault } = req.body;

    // Validate required fields based on payment type
    if (type === 'credit_card' && (!cardDetails || !cardDetails.lastFour || !cardDetails.expiryMonth || !cardDetails.expiryYear)) {
      return res.status(400).json({
        success: false,
        message: 'Card details are incomplete'
      });
    }

    if (type === 'paypal' && (!paypalDetails || !paypalDetails.email)) {
      return res.status(400).json({
        success: false,
        message: 'PayPal email is required'
      });
    }

    if (type === 'bank_account' && (!bankDetails || !bankDetails.accountName || !bankDetails.lastFour)) {
      return res.status(400).json({
        success: false,
        message: 'Bank account details are incomplete'
      });
    }

    if (!paymentToken) {
      return res.status(400).json({
        success: false,
        message: 'Payment token is required'
      });
    }

    // Create new payment method
    const paymentMethod = new PaymentMethod({
      user: userId,
      type,
      cardDetails: type === 'credit_card' ? cardDetails : undefined,
      paypalDetails: type === 'paypal' ? paypalDetails : undefined,
      bankDetails: type === 'bank_account' ? bankDetails : undefined,
      paymentToken,
      isDefault: isDefault === true // Defaults to false if not provided
    });

    await paymentMethod.save();

    res.status(201).json({
      success: true,
      message: 'Payment method added successfully',
      data: paymentMethod
    });

  } catch (error) {
    console.error('Error adding payment method:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add payment method'
    });
  }
};

/**
 * Get all payment methods for a user
 */
exports.getPaymentMethods = async (req, res) => {
  try {
    const userId = req.user.id;

    const paymentMethods = await PaymentMethod.find({ user: userId })
      .sort({ isDefault: -1, createdAt: -1 });

    // Mask sensitive information for security
    const sanitizedMethods = paymentMethods.map(method => {
      const sanitized = method.toObject();
      
      // Remove payment token from response
      delete sanitized.paymentToken;
      
      return sanitized;
    });

    res.status(200).json({
      success: true,
      data: sanitizedMethods
    });

  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment methods'
    });
  }
};

/**
 * Update a payment method
 */
exports.updatePaymentMethod = async (req, res) => {
  try {
    const { paymentMethodId } = req.params;
    const userId = req.user.id;
    const { isDefault } = req.body;

    // Verify the payment method belongs to the user
    const paymentMethod = await PaymentMethod.findOne({
      _id: paymentMethodId,
      user: userId
    });

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    // Update the payment method
    paymentMethod.isDefault = isDefault === true;
    await paymentMethod.save();

    res.status(200).json({
      success: true,
      message: 'Payment method updated successfully',
      data: paymentMethod
    });

  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment method'
    });
  }
};

/**
 * Delete a payment method
 */
exports.deletePaymentMethod = async (req, res) => {
  try {
    const { paymentMethodId } = req.params;
    const userId = req.user.id;

    // Verify the payment method belongs to the user
    const paymentMethod = await PaymentMethod.findOne({
      _id: paymentMethodId,
      user: userId
    });

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    // Check if this is the default payment method
    if (paymentMethod.isDefault) {
      // Find another payment method to set as default
      const alternativeMethod = await PaymentMethod.findOne({
        user: userId,
        _id: { $ne: paymentMethodId }
      });

      if (alternativeMethod) {
        alternativeMethod.isDefault = true;
        await alternativeMethod.save();
      }
    }

    // Delete the payment method
    await PaymentMethod.findByIdAndDelete(paymentMethodId);

    res.status(200).json({
      success: true,
      message: 'Payment method deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting payment method:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete payment method'
    });
  }
};