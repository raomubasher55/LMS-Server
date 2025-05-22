const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  submitQuiz,
  getQuizStatus,
  getUserQuizAttempts,
  getAllUserQuizAttempts,
  getQuizSummary
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

module.exports = router;