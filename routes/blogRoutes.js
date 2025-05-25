const express = require("express");
const {
  createBlog,
  getAllBlogs,
  getBlog,
  updateBlog,
  deleteBlog,
  getBlogStats,
  bulkUpdateBlogStatus
} = require("../controllers/blogController");
const multer = require("multer");
const { authMiddleware, restrictTo } = require("../middleware/authMiddleware");

const router = express.Router();

// Configure storage with filename handling
const storage = multer.memoryStorage();

// File filter for blog images
const fileFilter = (req, file, cb) => {
  if (file.fieldname === "featuredImage" && /^image\/(jpeg|png|jpg|webp)$/.test(file.mimetype)) {
    return cb(null, true);
  }
  cb(new Error(`Invalid file type for ${file.fieldname}`), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  }
});

// Admin routes for blog management
router.post("/", authMiddleware, restrictTo("admin"), upload.any(), createBlog);
router.get("/", authMiddleware, restrictTo("admin"), getAllBlogs);
router.get("/stats", authMiddleware, restrictTo("admin"), getBlogStats);
router.put("/bulk-update", authMiddleware, restrictTo("admin"), bulkUpdateBlogStatus);
router.get("/:id", authMiddleware, restrictTo("admin"), getBlog);
router.put("/:id", authMiddleware, restrictTo("admin"), upload.any(), updateBlog);
router.delete("/:id", authMiddleware, restrictTo("admin"), deleteBlog);

module.exports = router;