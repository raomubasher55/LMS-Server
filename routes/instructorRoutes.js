// routes/instructorRoutes.js
const express = require('express');
const instructorController = require('../controllers/instructorController');
const { authMiddleware, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/apply', instructorController.createApplication);

router.get('/applications', authMiddleware , restrictTo('admin') , instructorController.getAllApplications
);

router.get('/applications/:id', authMiddleware, restrictTo('admin'),  instructorController.getApplicationById);

router.post('/applications/:id/contact', authMiddleware,  restrictTo('admin'), instructorController.contactInstructor);

router.delete('/applications/:id',  authMiddleware,  restrictTo('admin'), instructorController.deleteApplication);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Instructor routes error:', error);
  
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

module.exports = router;