const express = require('express');
const router = express.Router();
const { authMiddleware, restrictTo } = require('../middleware/authMiddleware');
const chatUpload = require('../middleware/chatUpload');
const { 
  getUserChats,
  getChatMessages,
  createOrGetChat,
  sendMessage,
  deleteChat,
  getStudentChatContacts,
  getInstructorChatContacts,
  createCourseChat,
  debugStudentEnrollment,
  getAdminChatContacts,
  getInstructorAdminContacts
} = require('../controllers/chatController');

// Get all chats for a user
router.get('/user-chats', authMiddleware, getUserChats);

// Get messages for a specific chat
router.get('/:chatId', authMiddleware, getChatMessages);

// Create a new chat or get existing chat between users
router.post('/', authMiddleware, createOrGetChat);

// Send a message in a chat (with optional file uploads)
router.post('/:chatId/messages', authMiddleware, chatUpload.array('attachments', 5), sendMessage);

// Get chat contacts for students (instructors from enrolled courses)
router.get('/student/contacts', authMiddleware, restrictTo('student'), getStudentChatContacts);

// Get chat contacts for instructors (students from their courses)
router.get('/instructor/contacts', authMiddleware, restrictTo('instructor'), getInstructorChatContacts);

// Get chat contacts for admin (all instructors)
router.get('/admin/contacts', authMiddleware, restrictTo('admin'), getAdminChatContacts);

// Get admin contacts for instructor (all admins)
router.get('/instructor/admin-contacts', authMiddleware, restrictTo('instructor'), getInstructorAdminContacts);

// Create course-based chat with enrollment verification
router.post('/course-chat', authMiddleware, createCourseChat);

// Debug endpoint to check student enrollment
router.get('/debug/enrollment', authMiddleware, debugStudentEnrollment);

// Delete a chat (admin only)
router.delete('/:chatId', authMiddleware, restrictTo('admin'), deleteChat);

module.exports = router;