const express = require('express');
const router = express.Router();
const { markVideoCompleted, getCourseProgress, updateWatchTime } = require('../controllers/progressController');
const { authMiddleware } = require('../middleware/authMiddleware');

// All progress routes require authentication
router.use(authMiddleware);

// Mark video/chapter as completed
router.post('/complete-video', markVideoCompleted);

// Get user's progress for a specific course
router.get('/course/:courseId', getCourseProgress);

// Update video watch time (for progress tracking)
router.post('/watch-time', updateWatchTime);

module.exports = router;