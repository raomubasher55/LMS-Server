const express = require('express');
const router = express.Router();

const { createQuiz } = require('../controllers/quizController');
const { authMiddleware, restrictTo } = require('../middleware/authMiddleware');

// Add a quiz question for a specific lecture
router.post('/:courseId/quiz/:lectureId', authMiddleware, restrictTo('instructor'), createQuiz);

module.exports = router;
