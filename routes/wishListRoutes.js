const express = require("express");
const { getWishlist, addToWishlist, removeFromWishlist, updateProductQuantity, emptyCart } = require("../controllers/wishlistController");
const { authMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/" , authMiddleware, getWishlist);  
router.post("/", authMiddleware, addToWishlist); 
router.delete("/:courseId", authMiddleware, removeFromWishlist); 
router.delete("/emptyCart", authMiddleware, emptyCart); 
router.put("/:courseId", authMiddleware, updateProductQuantity);
module.exports = router;
