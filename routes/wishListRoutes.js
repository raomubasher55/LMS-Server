const express = require("express");
const { getWishlist, addToWishlist, removeFromWishlist } = require("../controllers/wishlistController");
const { authMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/" , authMiddleware, getWishlist);  
router.post("/", authMiddleware, addToWishlist); 
router.delete("/:courseId", authMiddleware, removeFromWishlist);  

module.exports = router;
