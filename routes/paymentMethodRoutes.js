const express = require('express');
const router = express.Router();
const { authMiddleware, restrictTo } = require('../middleware/authMiddleware');
const {
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  getDefaultPaymentMethod
} = require('../controllers/paymentMethodController');

// All routes require authentication and student role
router.use(authMiddleware);
router.use(restrictTo('student'));

// Get all payment methods for the authenticated user
router.get('/', getPaymentMethods);

// Get default payment method
router.get('/default', getDefaultPaymentMethod);

// Add a new payment method
router.post('/', addPaymentMethod);

// Update a payment method
router.put('/:id', updatePaymentMethod);

// Delete a payment method (soft delete)
router.delete('/:id', deletePaymentMethod);

module.exports = router;