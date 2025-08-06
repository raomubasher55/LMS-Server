const express = require('express');
const router = express.Router();
const { 
  getInstructorAssignments,
  createAssignment, 
  getCourseAssignments,
  updateAssignment,
  deleteAssignment,
  getStudentAssignments
 } = require('../controllers/assignmentController');
const { upload } = require('../middleware/multer');
const { authMiddleware } = require('../middleware/authMiddleware');

// Upload assignment with up to 5 files
router.post(
  '/:CourseId/assignments',
  authMiddleware,
  upload.array('files', 5),
  createAssignment
);

// routes/assignmentRoutes.js
router.get('/instructor/assignments', authMiddleware, getInstructorAssignments);

// Get all assignments for a student across enrolled courses
router.get('/student/assignments', authMiddleware, getStudentAssignments);

// Get all assignments for a course
router.get('/:courseId/assignments', authMiddleware, getCourseAssignments);

// Update an assignment
router.put('/assignments/:assignmentId', authMiddleware, updateAssignment);

// Delete an assignment
router.delete('/assignments/:assignmentId', authMiddleware, deleteAssignment);

module.exports = router;
