const express = require("express");
const router = express.Router();

const { authMiddleware, restrictTo } = require("../middleware/authMiddleware");
const {
  updatePassword,
  updateSocialLinks,
  updateProfile,
  getProfile,
  getStudentOrderHistory,
  getUnreadMessageCount,
  getAllStudents,
  getInstructors,
  getInstructorById
} = require("../controllers/userController");

router.put('/update-password', authMiddleware, updatePassword);
router.put('/social-links', authMiddleware, updateSocialLinks);
router.put('/:id', authMiddleware, updateProfile);
router.get("/profile/:id" , getProfile);

// Get student order history
router.get('/student/order-history', authMiddleware, getStudentOrderHistory);

// Get unread message count
router.get('/unread-messages', authMiddleware, getUnreadMessageCount);

// Get all students (admin only)
router.get('/students', authMiddleware, restrictTo('admin'), getAllStudents);


router.get('/instructors', getInstructors);
router.get('/instructors/:id', getInstructorById);

module.exports = router;
