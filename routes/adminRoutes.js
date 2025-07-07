const express = require('express');
const router = express.Router();
const { getAdminDashboardStats, coursesState, allCourses, getAllUsers } = require('../controllers/adminController');
const { authMiddleware, restrictTo } = require('../middleware/authMiddleware');
const { getEnrollmentTrends } = require('../controllers/adminController');
const { getCourseDistribution } = require('../controllers/adminController');
const { getRevenueData } = require('../controllers/adminController');
const { getTopInstructors } = require('../controllers/adminController');
const { getRecentCourses } = require('../controllers/adminController');
const { getNotices } = require('../controllers/adminController');
const { markAsRead } = require('../controllers/adminController');
const { getNotifications } = require('../controllers/adminController');

// Admin dashboard stats
router.get('/dashboard/stats', authMiddleware, restrictTo('admin') , getAdminDashboardStats);
router.get('/charts/enrollment-trends', authMiddleware,  restrictTo('admin'), getEnrollmentTrends);
router.get('/charts/course-distribution', authMiddleware,  restrictTo('admin'), getCourseDistribution);
router.get('/charts/revenue-data', authMiddleware,  restrictTo('admin'), getRevenueData);
router.get('/instructors/top', authMiddleware, restrictTo('admin'), getTopInstructors);
router.get('/courses/recent', authMiddleware, restrictTo('admin'), getRecentCourses);

router.route('/notices').get(authMiddleware, restrictTo('admin'), getNotices);
router.route('/notices/:id/read').put(authMiddleware, restrictTo('admin'), markAsRead);
router.get('/notifications', authMiddleware, restrictTo('admin'), getNotifications)
router.get('/courses-stats', authMiddleware, restrictTo('admin'), coursesState)
router.get('/all-courses', authMiddleware, restrictTo('admin'), allCourses)
router.get('/all-users', authMiddleware, restrictTo('admin'), getAllUsers)




module.exports = router;