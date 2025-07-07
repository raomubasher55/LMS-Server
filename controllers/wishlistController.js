const Reviews = require("../models/Review");
const Course = require("../models/Course");
const Wishlist = require("../models/Wishlist");

exports.getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user.id }).populate({
      path: "courses",
      populate: {
        path: "instructor",
        select: "firstName lastName profile",
      },
    });

    if (!wishlist || !wishlist.courses || wishlist.courses.length === 0) {
      return res.json({ wishlist: [] });
    }

    const enrichedCourses = await Promise.all(
      wishlist.courses.map(async (courseDoc) => {
        const courseId = courseDoc._id;

        // Get reviews
        const reviews = await Reviews.find({ course: courseId });

        // Calculate rating
        const totalReviews = reviews.length;
        const averageRating =
          totalReviews > 0
            ? reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews
            : 0;

        // Combine instructor name
        let instructorName = "";
        if (courseDoc.instructor) {
          instructorName = `${courseDoc.instructor.firstName} ${courseDoc.instructor.lastName}`;
        }

        return {
          ...courseDoc.toObject(),
          instructor: {
            ...courseDoc.instructor?.toObject(),
            name: instructorName,
          },
          reviews,
          totalReviews,
          rating: averageRating,
        };
      })
    );

    res.json({ wishlist: enrichedCourses });
  } catch (err) {
    console.error("Wishlist fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.addToWishlist = async (req, res) => {
    const { courseId } = req.body;
  
    try {
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
  
      let wishlist = await Wishlist.findOne({ user: req.user.id });
  
      if (!wishlist) {
        wishlist = new Wishlist({ user: req.user.id, courses: [courseId] });
        await wishlist.save();
        return res.json({ message: "Added to wishlist", wishlist: wishlist.courses });
      }
  
      const courseIndex = wishlist.courses.findIndex(
        (id) => id.toString() === courseId.toString()
      );
  
      if (courseIndex > -1) {
        wishlist.courses.splice(courseIndex, 1);
        await wishlist.save();
        return res.json({ message: "Removed from wishlist", wishlist: wishlist.courses });
      } else {
        wishlist.courses.push(courseId);
        await wishlist.save();
        return res.json({ message: "Added to wishlist", wishlist: wishlist.courses });
      }
    } catch (err) {
      console.error("Wishlist toggle error:", err);
      res.status(500).json({ message: "Server error" });
    }
  };
  


exports.removeFromWishlist = async (req, res) => {
  const { courseId } = req.params;

  try {
    const wishlist = await Wishlist.findOne({ user: req.user.id });
    if (!wishlist) return res.status(404).json({ message: "Wishlist not found" });

    wishlist.courses = wishlist.courses.filter((id) => id.toString() !== courseId);
    await wishlist.save();
    const updated = await wishlist.populate("courses");
    res.json({ wishlist: updated.courses });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove from wishlist" });
  }
};
