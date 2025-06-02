const Reviews = require("../models/Review");
const Course = require("../models/Course");
const Wishlist = require("../models/Wishlist");

exports.getWishlist = async (req, res) => {
  try {
    // Fetch wishlist and populate course and instructor data
    const wishlist = await Wishlist.findOne({ user: req.user.id }).populate({
      path: "courses.course",
      populate: {
        path: "instructor",
        select: "firstName lastName profile",
      },
    });

    if (!wishlist || !wishlist.courses || wishlist.courses.length === 0) {
      return res.json({ wishlist: [] });
    }

    // Enrich each course item with review and rating data
    const enrichedCourses = await Promise.all(
      wishlist.courses.map(async (item) => {
        const course = item.course;
        if (!course) return null;

        const courseId = course._id;

        // Get reviews
        const reviews = await Reviews.find({ course: courseId });

        // Calculate average rating
        const totalReviews = reviews.length;
        const averageRating =
          totalReviews > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
            : 0;

        const instructorName = course.instructor
          ? `${course.instructor.firstName} ${course.instructor.lastName}`
          : "";

        return {
          course: {
            ...course.toObject(),
            instructor: {
              ...course.instructor?.toObject(),
              name: instructorName,
            },
            reviews,
            totalReviews,
            rating: averageRating,
          },
          quantity: item.quantity,
          price: item.price,
        };
      })
    );

    // Filter out any nulls (in case some course is missing)
    const validCourses = enrichedCourses.filter(Boolean);

    res.json({ wishlist: validCourses });
  } catch (err) {
    console.error("Wishlist fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
};



exports.addToWishlist = async (req, res) => {
  const userId = req.user.id;
  const { courseId, quantity } = req.body;

  try {
    let wishlist = await Wishlist.findOne({ user: userId });

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const price = course.price || 0;
    const qty = quantity || 1;

    if (!wishlist) {
      wishlist = new Wishlist({
        user: userId,
        courses: [{ course: courseId, quantity: qty, price }],
      });
    } else {
      const existing = wishlist.courses.find((c) => c.course.toString() === courseId);
      if (existing) {
        existing.quantity += qty;
      } else {
        wishlist.courses.push({ course: courseId, quantity: qty, price });
      }
    }

    await wishlist.save();
    res.status(200).json({ message: "Added to wishlist", wishlist });
  } catch (error) {
    res.status(500).json({ message: "Error adding to wishlist", error });
  }
};


  


exports.removeFromWishlist = async (req, res) => {
  const userId = req.user.id;
  const courseId = req.params.courseId;
console.log("Removing course from wishlist:", courseId);
  try {
    const wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) return res.status(404).json({ message: "Wishlist not found" });

    wishlist.courses = wishlist.courses.filter(
      (item) => item.course.toString() !== courseId
    );

    await wishlist.save();
    res.status(200).json({ message: "Course removed", wishlist });
  } catch (error) {
    res.status(500).json({ message: "Error removing course", error });
  }
};



exports.updateProductQuantity = async (req, res) => {
  const userId = req.user.id;
  const courseId = req.params.courseId;
  const { quantity } = req.body;
  console.log("Updating quantity for course:", courseId, "to", quantity);

  try {
    const wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) return res.status(404).json({ message: "Wishlist not found" });

    const courseItem = wishlist.courses.find(
      (item) => item.course.toString() === courseId
    );

    if (!courseItem) {
      return res.status(404).json({ message: "Course not found in wishlist" });
    }

    courseItem.quantity = quantity;

    await wishlist.save();
    res.status(200).json({ message: "Quantity updated", wishlist });
  } catch (error) {
    res.status(500).json({ message: "Error updating quantity", error });
  }
};


exports.emptyCart = async (req, res) => {
  const userId = req.user.id;
  console.log("Emptying wishlist for user:", userId);

  try {
    const wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) return res.status(404).json({ message: "Wishlist not found" });
    wishlist.courses = [];
    await wishlist.save();
    res.status(200).json({ message: "Wishlist emptied", wishlist });
  }
  catch (error) {
    res.status(500).json({ message: "Error emptying wishlist", error });
  }
}