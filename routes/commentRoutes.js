const express = require('express');
const router = express.Router();

const { createComment, getCourseComments, replyToComment } = require('../controllers/commentController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/comments', authMiddleware, createComment);
router.put('/comments/reply', authMiddleware, replyToComment);
router.get("/comments/course/:courseId", getCourseComments)

module.exports = router;
