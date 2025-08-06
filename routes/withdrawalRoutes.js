const express = require("express");
const {
  getInstructorEarnings,
  createWithdrawalRequest,
  getAllWithdrawalRequests,
  updateWithdrawalStatus,
  getWithdrawalRequest,
  getWithdrawalStats
} = require("../controllers/withdrawalController");
const { authMiddleware, restrictTo } = require("../middleware/authMiddleware");

const router = express.Router();

// Instructor routes
router.get("/earnings", authMiddleware, restrictTo("instructor"), getInstructorEarnings);
router.post("/request", authMiddleware, restrictTo("instructor"), createWithdrawalRequest);

// Admin routes
router.get("/admin/requests", authMiddleware, restrictTo("admin"), getAllWithdrawalRequests);
router.get("/admin/stats", authMiddleware, restrictTo("admin"), getWithdrawalStats);
router.get("/admin/requests/:id", authMiddleware, restrictTo("admin"), getWithdrawalRequest);
router.put("/admin/requests/:id/status", authMiddleware, restrictTo("admin"), updateWithdrawalStatus);

// Shared routes (instructor can view their own requests, admin can view all)
router.get("/requests", authMiddleware, async (req, res, next) => {
  if (req.user.role === 'admin') {
    return getAllWithdrawalRequests(req, res, next);
  } else if (req.user.role === 'instructor') {
    // Get only instructor's own requests
    const WithdrawalRequest = require("../models/WithdrawalRequest");
    try {
      const requests = await WithdrawalRequest.find({ instructor: req.user.id })
        .sort({ requestDate: -1 });
      
      res.status(200).json({
        success: true,
        data: { requests }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch withdrawal requests",
        error: error.message
      });
    }
  } else {
    res.status(403).json({
      success: false,
      message: "Access denied"
    });
  }
});

module.exports = router;