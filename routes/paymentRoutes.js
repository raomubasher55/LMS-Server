const express = require('express');
const { 
  createPaymentSession, 
  handlePaymentSuccess,
  handleWebhook,
  enrollFreeCourse, 
  checkCourseAccess,
  getPurchasedCourses,
  checkPaymentStatus,
  fixUserEnrollmentData,
  getInstructorOrderHistory,
  testMaxicashCredentials
} = require('../controllers/paymentController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Create payment session for premium course
router.post('/create-session', authMiddleware, createPaymentSession);

// Handle payment success
router.get('/success', handlePaymentSuccess);

// Enroll in free course
router.post('/enroll-free', authMiddleware, enrollFreeCourse);

// Check if user has access to course
router.get('/check-access/:courseId', authMiddleware, checkCourseAccess);

// Get user's purchased courses
router.get('/purchased-courses', authMiddleware, getPurchasedCourses);

// Webhook handler for Maxicash notifications
router.post('/webhook', handleWebhook);

// Check payment status by reference
router.get('/status/:reference', authMiddleware, checkPaymentStatus);

// Fix user enrollment data (migration endpoint)
router.post('/fix-user-data', authMiddleware, fixUserEnrollmentData);

// Get instructor order history
router.get('/instructor/order-history', authMiddleware, getInstructorOrderHistory);

// Test Maxicash credentials
router.get('/test-maxicash', testMaxicashCredentials);

module.exports = router;