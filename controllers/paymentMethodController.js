const PaymentMethod = require('../models/PaymentMethod');

/**
 * Get all payment methods for a user
 */
exports.getPaymentMethods = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const paymentMethods = await PaymentMethod.find({ 
      userId, 
      isActive: true 
    }).sort({ isDefault: -1, createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: paymentMethods
    });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment methods',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Add a new payment method
 */
exports.addPaymentMethod = async (req, res) => {
  try {
    const userId = req.user.id;
    const paymentMethodData = {
      ...req.body,
      userId
    };
    
    // If this is set as default and user has no payment methods, keep it as default
    // If user has payment methods and this is set as default, update others
    if (paymentMethodData.isDefault) {
      await PaymentMethod.updateMany(
        { userId },
        { isDefault: false }
      );
    }
    
    const paymentMethod = new PaymentMethod(paymentMethodData);
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
      message: 'Failed to add payment method',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update a payment method
 */
exports.updatePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updateData = req.body;
    
    // If setting as default, unset other defaults first
    if (updateData.isDefault) {
      await PaymentMethod.updateMany(
        { userId, _id: { $ne: id } },
        { isDefault: false }
      );
    }
    
    const paymentMethod = await PaymentMethod.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true }
    );
    
    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Payment method updated successfully',
      data: paymentMethod
    });
  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment method',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete a payment method
 */
exports.deletePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const paymentMethod = await PaymentMethod.findOneAndUpdate(
      { _id: id, userId },
      { isActive: false },
      { new: true }
    );
    
    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }
    
    // If this was the default payment method, set another one as default
    if (paymentMethod.isDefault) {
      const nextPaymentMethod = await PaymentMethod.findOne({
        userId,
        isActive: true,
        _id: { $ne: id }
      }).sort({ createdAt: -1 });
      
      if (nextPaymentMethod) {
        nextPaymentMethod.isDefault = true;
        await nextPaymentMethod.save();
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Payment method deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete payment method',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get default payment method for a user
 */
exports.getDefaultPaymentMethod = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const defaultPaymentMethod = await PaymentMethod.findOne({ 
      userId, 
      isDefault: true, 
      isActive: true 
    });
    
    res.status(200).json({
      success: true,
      data: defaultPaymentMethod
    });
  } catch (error) {
    console.error('Error fetching default payment method:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch default payment method',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};