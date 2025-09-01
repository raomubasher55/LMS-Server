const express = require("express");
const { 
  createCourse, 
  getInstructorCourses, 
  getCourseById,
  getInstructorCoursesById,
  getAllCourses,
  updateCourseStatus,
  getAllCourses2
} = require("../controllers/courseController");
const multer = require("multer");
const { authMiddleware, restrictTo } = require("../middleware/authMiddleware");
const { createReview, getCourseReviews, getRatingStats, getInstructorReviews, allInstructorReviews } = require("../controllers/reviewController");

const router = express.Router();

// Configure storage with filename handling
const storage = multer.memoryStorage();

// File filter for valid file types
const fileFilter = (req, file, cb) => {
  const fieldname = file.fieldname;

  if (fieldname === "pdfFiles" && file.mimetype === "application/pdf") {
    return cb(null, true);
  }

  if (fieldname === "certificateFile" && /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.mimetype)) {
    return cb(null, true);
  }

  if (fieldname === "bannerImage" && /^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
    return cb(null, true);
  }


  // ❌ If none match
  cb(new Error(`Invalid file type for ${file.fieldname}`), false);
};


// Configure multer with limits and filters
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    files: 20,
    fieldSize: 500 * 1024 * 1024, // 10 MB limit for text fields
    // fileSize: 500 * 1024 * 1024 // optional per-file limit
  },
});


const handleUploads = [
  upload.any(),
  (req, res, next) => {
    try {
      req.files.forEach((file, i) => {
        console.log(`[${i}] ${file.fieldname} (${file.mimetype}) - ${file.originalname}`);
      });

      // ✅ Parse the chapters from the request body
      let chapters = req.body.chapters;

      // Handle both stringified and parsed form of chapters
      if (typeof chapters === "string") {
        try {
          chapters = JSON.parse(chapters);
        } catch (e) {
          console.warn("❌ Failed to parse req.body.chapters");
          chapters = [];
        }
      }

      if (!Array.isArray(chapters)) chapters = [];

      req.body.chapters = chapters;

      next();
    } catch (error) {
      console.error("Middleware error:", error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },
];


// Course creation route with complete file handling
router.post(
  "/create-course",
  authMiddleware,
  restrictTo("instructor"),
  ...handleUploads,
  createCourse
);


// Get instructor courses route
router.get("/instructor-courses", authMiddleware, restrictTo("instructor"), getInstructorCourses);
router.get('/courses/:id', getCourseById);
router.post('/courses/:courseId/reviews' , authMiddleware , createReview )
router.get("/reviews/:courseId" , getCourseReviews)
router.get("/reviews/:courseId/stats", getRatingStats)
router.get("/instructor/:instructorId/course" , getInstructorCoursesById)
router.get('/allcourses' , getAllCourses)
router.get('/allcourses-about' , getAllCourses2);
router.get("/instructor/reviews", authMiddleware, restrictTo("instructor"), getInstructorReviews )
router.put("/courses/:courseId/status", authMiddleware, restrictTo("admin"), updateCourseStatus )
router.get("/admin/all-instructor-reviews", authMiddleware, restrictTo("admin"), allInstructorReviews )


module.exports = router;