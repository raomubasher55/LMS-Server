const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  submitQuiz,
  getQuizStatus,
  getUserQuizAttempts,
  getAllUserQuizAttempts,
  getQuizSummary,
  checkQuizAttemptAllowed,
  // Instructor Dashboard endpoints
  getInstructorQuizAnalytics,
  getInstructorStudentProgress,
  resetStudentQuizProgress,
  // Migration
  migrateQuizProgressData
} = require('../controllers/quizProgressController');

// All quiz routes require authentication
router.use(authMiddleware);

// @route   POST /api/quiz/submit
// @desc    Submit quiz answers
// @access  Private
router.post('/submit', submitQuiz);

// @route   GET /api/quiz/status/:courseId/:chapterId
// @desc    Get quiz status for a chapter
// @access  Private
router.get('/status/:courseId/:chapterId', getQuizStatus);

// @route   GET /api/quiz/attempts/:courseId
// @desc    Get all quiz attempts for a user in a course
// @access  Private
router.get('/attempts/:courseId', getUserQuizAttempts);

// @route   GET /api/quiz/attempts-all  
// @desc    Get all quiz attempts for a user across all enrolled courses
// @access  Private
router.get('/attempts-all', getAllUserQuizAttempts);

// @route   GET /api/quiz/summary
// @desc    Get quiz summary statistics for a user
// @access  Private
router.get('/summary', getQuizSummary);

// @route   GET /api/quiz/attempt-allowed/:courseId/:chapterId
// @desc    Check if quiz attempt is allowed (progressive restrictions)
// @access  Private
router.get('/attempt-allowed/:courseId/:chapterId', checkQuizAttemptAllowed);

// ========== INSTRUCTOR DASHBOARD ROUTES ==========

// @route   GET /api/quiz/instructor/analytics
// @desc    Get comprehensive quiz analytics for instructor's courses
// @access  Private (Instructor only)
router.get('/instructor/analytics', getInstructorQuizAnalytics);

// @route   GET /api/quiz/instructor/student-progress
// @desc    Get detailed student progress for instructor's courses
// @access  Private (Instructor only)
router.get('/instructor/student-progress', getInstructorStudentProgress);

// @route   POST /api/quiz/instructor/reset-progress
// @desc    Reset student quiz progress (bulk action)
// @access  Private (Instructor only)
router.post('/instructor/reset-progress', resetStudentQuizProgress);

// @route   POST /api/quiz-progress/migrate-data
// @desc    One-time migration to fix quiz progress data
// @access  Private (Admin only - temporary route)
router.post('/migrate-data', migrateQuizProgressData);

module.exports = router;