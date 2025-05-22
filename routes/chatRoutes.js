const express = require('express');
const router = express.Router();
const { authMiddleware, restrictTo } = require('../middleware/authMiddleware');
const { 
  getUserChats,
  getChatMessages,
  createOrGetChat,
  sendMessage,
  deleteChat,
  getStudentChatContacts,
  getInstructorChatContacts,
  createCourseChat,
  debugStudentEnrollment
} = require('../controllers/chatController');

// Get all chats for a user
router.get('/user-chats', authMiddleware, getUserChats);

// Get messages for a specific chat
router.get('/:chatId', authMiddleware, getChatMessages);

// Create a new chat or get existing chat between users
router.post('/', authMiddleware, createOrGetChat);

// Send a message in a chat
router.post('/:chatId/messages', authMiddleware, sendMessage);

// Get chat contacts for students (instructors from enrolled courses)
router.get('/student/contacts', authMiddleware, restrictTo('student'), getStudentChatContacts);

// Get chat contacts for instructors (students from their courses)
router.get('/instructor/contacts', authMiddleware, restrictTo('instructor'), getInstructorChatContacts);

// Create course-based chat with enrollment verification
router.post('/course-chat', authMiddleware, createCourseChat);

// Debug endpoint to check student enrollment
router.get('/debug/enrollment', authMiddleware, debugStudentEnrollment);

// Delete a chat (admin only)
router.delete('/:chatId', authMiddleware, restrictTo('admin'), deleteChat);

module.exports = router;