const express = require("express");
const { authMiddleware } = require("../middleware/authMiddleware");
const {
  getCart,
  addProductToCart,
  updateProductQuantity,
  deleteProductFromCart,
  emptyCart,
} = require("../controllers/cartController");

const router = express.Router();

// Get the user's cart
router.get("/", authMiddleware, getCart);

// Add a course to the user's cart
router.post("/", authMiddleware, addProductToCart); // frontend sends POST to /api/cart

// Update quantity of a course in the cart using courseId as URL param
router.put("/:courseId", authMiddleware, updateProductQuantity); // PUT to /api/cart/:courseId

// Delete a course from the cart using courseId as URL param
router.delete("/:courseId/delete", authMiddleware, deleteProductFromCart); // DELETE to /api/cart/:courseId
router.delete("/emptyCart", authMiddleware, emptyCart);

module.exports = router;
