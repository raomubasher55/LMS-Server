// controllers/reviewController.js
const Review = require("../models/Review.js");
const Course = require("../models/Course.js");
const mongoose = require('mongoose');
const createNotification = require('../utils/createNotification');

// POST /api/reviews/:courseId
exports.createReview = async (req, res) => {
  try {
    const { review , rating , name , email , website } = req.body;
    const { courseId } = req.params;
    const userId = req.user.id;
    if (!rating || !review) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Optional: check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    // Optional: check if user has already reviewed
    const alreadyReviewed = await Review.findOne({ course: courseId, user: userId });
    if (alreadyReviewed) {
      return res.status(400).json({ message: "You have already reviewed this course." });
    }

    const newReview = new Review({
      course: courseId,
      user: userId,
      name, 
      rating,
      review,
      email, 
      website
    });

    await newReview.save();
    await createNotification({
      title: ` "${name}" added Review`,
      type: 'course',
      courseId: courseId
    });
    

    res.status(201).json({ message: "Review submitted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/reviews/:courseId
exports.getCourseReviews = async (req, res) => {
    try {
      const { courseId } = req.params;
  
      const reviews = await Review.find({ course: courseId })
        .sort({ createdAt: -1 })
        .populate("user", "firstName lastName profile"); // populate user details
  
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  };
  

// GET /api/reviews/:courseId/stats
exports.getRatingStats = async (req, res) => {
    try {
      const { courseId } = req.params;
  
      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({ message: "Invalid course ID" });
      }
  
      const stats = await Review.aggregate([
        { $match: { course: new mongoose.Types.ObjectId(courseId) } },
        {
          $group: {
            _id: "$rating",
            count: { $sum: 1 },
          },
        },
      ]);
  
      const response = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
      stats.forEach(({ _id, count }) => {
        response[_id] = count;
      });
  
      res.json(response);
    } catch (error) {
      console.error("Error in getRatingStats:", error); // ← for server logs
      res.status(500).json({ message: "Server error", error });
    }
  };
  


  // instrcutor reviews by id 

  
  exports.getInstructorReviews = async (req, res) => {
    const instructorId = req.user.id;
  
    try {
      // Step 1: Find courses by the instructor
      const instructorCourses = await Course.find({ instructor: instructorId }).select("_id");
  
      const courseIds = instructorCourses.map(course => course._id);
  
      // Step 2: Find reviews for those courses and populate needed fields
      const reviews = await Review.find({ course: { $in: courseIds } })
        .populate({
          path: "course",
          select: "title",
        })
        .populate({
          path: "user",
          select: "firstName lastName",
        })
        .sort({ createdAt: -1 }); // Optional: recent first
  
      // Step 3: Format response
      const formattedReviews = reviews.map(review => ({
        userName: `${review.user?.firstName || ""} ${review.user?.lastName || ""}`,
        date: review.createdAt,
        courseTitle: review.course?.title || "Untitled",
        rating: review.rating,
        review: review.review,
      }));
  
      res.status(200).json({ reviews: formattedReviews });
    } catch (error) {
      console.error("Error fetching instructor reviews:", error);
      res.status(500).json({ message: "Server error", error });
    }
  };
  

  // get all instructor reviews by admin 

  exports.allInstructorReviews = async (req, res) => {
    try {
      // Step 1: Get all courses with their instructors
      const allCourses = await Course.find().select("_id title instructor");
  
      const courseIds = allCourses.map(course => course._id);
      const courseMap = {};
      allCourses.forEach(course => {
        courseMap[course._id] = {
          title: course.title,
          instructorId: course.instructor,
        };
      });
  
      // Step 2: Find all reviews for these courses
      const reviews = await Review.find({ course: { $in: courseIds } })
        .populate({
          path: "user",
          select: "firstName lastName",
        })
        .sort({ createdAt: -1 });
  
      // Step 3: Format reviews
      const formattedReviews = reviews.map(review => {
        const courseInfo = courseMap[review.course] || {};
        return {
          userName: `${review.user?.firstName || ""} ${review.user?.lastName || ""}`,
          date: review.createdAt,
          courseTitle: courseInfo.title || "Untitled",
          rating: review.rating,
          review: review.review,
        };
      });
  
      res.status(200).json({ reviews: formattedReviews });
    } catch (error) {
      console.error("Error fetching all instructor reviews:", error);
      res.status(500).json({ message: "Server error", error });
    }
  };
  