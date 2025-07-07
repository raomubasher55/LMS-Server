const express = require('express');
const router = express.Router();
const { authMiddleware, restrictTo } = require('../middleware/authMiddleware');
const { 
  getEnrolledCourses, 
  updateCourseProgress, 
  markCourseAsCompleted, 
  getCourseInvestmentStats 
} = require('../controllers/enrollmentController');

// Get enrolled courses for current user
router.get('/enrolled-courses', authMiddleware, restrictTo('student'), getEnrolledCourses);

// Update course progress 
router.put('/progress', authMiddleware, restrictTo('student'), updateCourseProgress);

// Mark course as completed
router.put('/complete/:courseId', authMiddleware, restrictTo('student'), markCourseAsCompleted);

// Get investment statistics
router.get('/investment-stats', authMiddleware, restrictTo('student'), getCourseInvestmentStats);

module.exports = router;