const express = require("express");
const router = express.Router();
const {
  subscribe,
  unsubscribe,
  getAllSubscribers,
  getStats
} = require("../controllers/newsletterController");
const { authMiddleware, restrictTo } = require("../middleware/authMiddleware");

// Middleware to protect admin routes (add your auth middleware)

// Public routes
router.post("/subscribe", subscribe);
router.post("/unsubscribe", unsubscribe);

// Protected admin routes
router.get("/subscribers", authMiddleware, restrictTo('admin'), getAllSubscribers);
router.get("/stats", authMiddleware, restrictTo('admin'), getStats);

module.exports = router;