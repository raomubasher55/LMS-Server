const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/authMiddleware");
const {
  updatePassword,
  updateSocialLinks,
  updateProfile,
  getProfile,
} = require("../controllers/userController");

router.put('/update-password', authMiddleware, updatePassword);
router.put('/social-links', authMiddleware, updateSocialLinks);
router.put('/:id', authMiddleware, updateProfile);
router.get("/profile/:id" , getProfile)

module.exports = router;
