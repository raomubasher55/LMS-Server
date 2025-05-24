const express = require('express');
const router = express.Router();

const { createQuiz, getAllAttempts, getQuizSummary } = require('../controllers/quizController');
const { authMiddleware, restrictTo } = require('../middleware/authMiddleware');

// Add a quiz question for a specific lecture
router.post('/:courseId/quiz/:lectureId', authMiddleware, restrictTo('instructor'), createQuiz);

// Get all quiz attempts for a student
router.get('/attempts-all', authMiddleware, restrictTo('student'), getAllAttempts);

// Get quiz summary statistics for a student
router.get('/summary', authMiddleware, restrictTo('student'), getQuizSummary);

module.exports = router;
