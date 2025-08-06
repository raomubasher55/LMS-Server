const Cart = require("../models/Cart");
const Course = require("../models/Course");

// GET Cart for a User
exports.getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      // Return empty cart instead of 404
      return res.status(200).json({ 
        cart: { 
          userId, 
          courses: [], 
          total: 0 
        } 
      });
    }

    return res.status(200).json({ cart });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching cart", error });
  }
};

// POST Add a Course to Cart
exports.addProductToCart = async (req, res) => {
  const userId = req.user.id;
  const { courseId, quantity } = req.body;

  try {
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Check if the course has a valid discounted price
    const priceToUse = course.discountedPrice && course.discountedPrice > 0 
                        ? Math.min(course.price, course.discountedPrice)  // Use discounted price if valid and less than regular price
                        : course.price;  // If no valid discounted price, use the regular price

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      // If no cart exists, create a new one
      cart = new Cart({
        userId,
        products: [{
          id: course._id,
          title: course.title,
          price: priceToUse,  // Use the calculated price (discounted or regular)
          quantity,
          bannerImage: course.bannerImage,
        }],
        totalPrice: priceToUse * quantity,  // Calculate the total price for the initial cart
      });
    } else {
      // If the cart exists, check if the product is already in the cart
      const existingProduct = cart.products.find(
        (item) => item.id.toString() === course._id.toString()
      );

      if (existingProduct) {
        // If product exists, update its quantity
        existingProduct.quantity += quantity;
        // Update the total price based on the updated quantity
      } else {
        // If product doesn't exist, add it to the cart
        cart.products.push({
          id: course._id,
          title: course.title,
          price: priceToUse,  // Use the calculated price
          quantity,
          bannerImage: course.bannerImage,
        });
      }

      // Recalculate the total price after adding the new product or updating the quantity
      cart.totalPrice = cart.products.reduce(
        (total, product) => total + product.price * product.quantity,
        0
      );
    }

    // Save the updated cart
    await cart.save();
    return res.status(200).json({ message: "Product added to cart", cart });
  } catch (error) {
    return res.status(500).json({ message: "Error adding product to cart", error });
  }
};


// PUT Update Quantity of a Course in Cart
exports.updateProductQuantity = async (req, res) => {
  const userId = req.user.id;
  const courseId = req.params.courseId;
  const { quantity } = req.body;

  try {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const product = cart.products.find(
      (item) => item.id.toString() === courseId.toString()
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found in cart" });
    }

    product.quantity = quantity;

    cart.totalPrice = cart.products.reduce(
      (total, product) => total + product.price * product.quantity,
      0
    );

    await cart.save();
    return res.status(200).json({ message: "Cart updated", cart });
  } catch (error) {
    return res.status(500).json({ message: "Error updating cart", error });
  }
};

// DELETE Course from Cart
exports.deleteProductFromCart = async (req, res) => {
  const userId = req.user.id;
  const courseId = req.params.courseId;

  try {
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const productIndex = cart.products.findIndex(
      (item) => item.id.toString() === courseId.toString()
    );

    if (productIndex === -1) {
      return res.status(404).json({ message: "Product not found in cart" });
    }

    const [removedProduct] = cart.products.splice(productIndex, 1);

    cart.totalPrice -= removedProduct.price * removedProduct.quantity;

    if (cart.products.length === 0) {
      await Cart.deleteOne({ userId });
      return res.status(200).json({ message: "Cart is empty, cart deleted" });
    }

    await cart.save();

    return res.status(200).json({ message: "Product removed from cart", cart });
  } catch (error) {
    return res.status(500).json({ message: "Error removing product from cart", error });
  }
};


// empty user cart 

exports.emptyCart = async (req, res) => {
  const userId = req.user.id;

  console.log("Emptying cart for user:", userId);  // Log user info for debugging

  try {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // Empty the cart
    cart.products = [];
    cart.totalPrice = 0;

    await cart.save();  // Save the updated cart

    return res.status(200).json({ message: "All products removed from cart", cart });
  } catch (error) {
    console.error("Error clearing cart:", error);  // Log error for debugging
    return res.status(500).json({ message: "Error clearing the cart", error });
  }
};


