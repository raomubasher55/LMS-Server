const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { 
  addPaymentMethod,
  getPaymentMethods,
  updatePaymentMethod,
  deletePaymentMethod
} = require('../controllers/paymentMethodController');

// Add a new payment method
router.post('/', authMiddleware, addPaymentMethod);

// Get all payment methods for a user
router.get('/', authMiddleware, getPaymentMethods);

// Update a payment method (currently only supports changing default status)
router.put('/:paymentMethodId', authMiddleware, updatePaymentMethod);

// Delete a payment method
router.delete('/:paymentMethodId', authMiddleware, deletePaymentMethod);

module.exports = router;