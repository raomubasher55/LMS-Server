const express = require('express');
const router = express.Router();
const { authMiddleware, restrictTo } = require('../middleware/authMiddleware');
const { 
  submitAssignment,
  getAssignmentSubmissions,
  getSubmission,
  gradeSubmission,
  getStudentCourseSubmissions,
  getAllStudentSubmissions,
  getSubmissionSummary
} = require('../controllers/submissionController');
const multer = require('multer');

// Configure multer storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
    files: 5 // Max 5 files per submission
  },
  fileFilter: (req, file, cb) => {
    // Allow various document formats, images, and PDFs
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'application/zip',
      'application/x-rar-compressed'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only documents, images, and PDFs are allowed.'), false);
    }
  }
});

// Submit an assignment (student)
router.post(
  '/:assignmentId/submit',
  authMiddleware,
  restrictTo('student'),
  upload.array('files'),
  submitAssignment
);

// Get all submissions for an assignment (instructor)
router.get(
  '/assignment/:assignmentId',
  authMiddleware,
  restrictTo('instructor'),
  getAssignmentSubmissions
);

// Get a specific submission (student/instructor)
router.get(
  '/:submissionId',
  authMiddleware,
  getSubmission
);

// Grade a submission (instructor)
router.post(
  '/:submissionId/grade',
  authMiddleware,
  restrictTo('instructor'),
  gradeSubmission
);

// Get all submissions for a student in a course (student)
router.get(
  '/student/course/:courseId',
  authMiddleware,
  restrictTo('student'),
  getStudentCourseSubmissions
);

// Get all assignments and submissions for a student across all enrolled courses (student)
router.get(
  '/student/all',
  authMiddleware,
  restrictTo('student'),
  getAllStudentSubmissions
);

// Get assignment submission summary statistics for a student (student)
router.get(
  '/student/summary',
  authMiddleware,
  restrictTo('student'),
  getSubmissionSummary
);

module.exports = router;