const express = require('express');
const router = express.Router();
const { authMiddleware, restrictTo } = require('../middleware/authMiddleware');
const {
  getInstructorAnnouncements,
  getCourseAnnouncements,
  getStudentAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  markAnnouncementAsRead
} = require('../controllers/announcementController');

// Instructor routes
router.get('/instructor/announcements', authMiddleware, restrictTo('instructor'), getInstructorAnnouncements);
router.post('/instructor/announcements', authMiddleware, restrictTo('instructor'), createAnnouncement);
router.put('/instructor/announcements/:id', authMiddleware, restrictTo('instructor'), updateAnnouncement);
router.delete('/instructor/announcements/:id', authMiddleware, restrictTo('instructor'), deleteAnnouncement);

// Student routes
router.get('/student/announcements', authMiddleware, getStudentAnnouncements);
router.get('/course/:courseId/announcements', authMiddleware, getCourseAnnouncements);
router.put('/announcements/:id/read', authMiddleware, markAnnouncementAsRead);

module.exports = router;