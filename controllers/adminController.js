
const Course = require('../models/Course');
const User = require('../models/User');
const Order = require('../models/Order');
const Notice = require('../models/Notice.js');
const Notification = require("../models/Notification.js")
const Reviews = require("../models/Review.js")

const { getLatestNotices } = require('../services/noticeService.js');


exports.getAdminDashboardStats = async (req, res) => {
  try {
    // Get all counts in parallel for better performance
    const [
      totalCourses,
      activeCourses,
      pendingCourses,
      totalStudents,
      totalInstructors,
      totalPurchases,
      recentPurchases,
      totalRevenue
    ] = await Promise.all([
      // Total courses count
      Course.countDocuments(),
      
      // Active courses (published)
      Course.countDocuments({ 
        status: 'published'
      }),
      
      // Pending courses (under review)
      Course.countDocuments({ 
        status: 'pending' 
      }),
      
      // Total students
      User.countDocuments({ role: 'student' }),
      
      // Total instructors
      User.countDocuments({ role: 'instructor' }),
      
      // Total completed purchases
      Order.countDocuments({ 
        paymentStatus: 'completed',
        status: 'completed'
      }),
      
      // Recent purchases (last 5)
      Order.find({ 
        paymentStatus: 'completed',
        status: 'completed'
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'firstName lastName email')
        .populate('course', 'title')
        .populate('instructor', 'firstName lastName'),
      
      // Calculate total platform revenue
      Order.aggregate([
        {
          $match: {
            paymentStatus: 'completed',
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $multiply: [
                  { $cond: [{ $gt: ['$discountedAmount', 0] }, '$discountedAmount', '$amount'] },
                  { $divide: ['$revenueSplit.platform', 100] }
                ]
              }
            }
          }
        }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalCourses,
        activeCourses,
        pendingCourses,
        totalStudents,
        totalInstructors,
        totalPurchases,
        totalRevenue: totalRevenue[0]?.total || 0,
        recentPurchases,
        stats: [
          { title: 'Total Courses', value: totalCourses, icon: 'book' },
          { title: 'Active Courses', value: activeCourses, icon: 'check-circle' },
          { title: 'Pending Courses', value: pendingCourses, icon: 'clock' },
          { title: 'Total Students', value: totalStudents, icon: 'users' },
          { title: 'Total Instructors', value: totalInstructors, icon: 'user-tie' },
          { title: 'Total Purchases', value: totalPurchases, icon: 'shopping-cart' },
          { title: 'Platform Revenue', value: totalRevenue[0]?.total || 0, icon: 'money-bill-wave', isMoney: true }
        ]
      }
    });

  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
};





exports.getEnrollmentTrends = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    // Get monthly enrollments from orders
    const monthlyData = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(`${currentYear}-01-01`),
            $lt: new Date(`${currentYear + 1}-01-01`)
          },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          enrollments: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // Format data for Chart.js
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const enrollmentData = Array(12).fill(0);

    monthlyData.forEach(month => {
      enrollmentData[month._id - 1] = month.enrollments;
    });

    res.status(200).json({
      success: true,
      data: {
        labels,
        datasets: [
          {
            label: "Course Enrollments",
            data: enrollmentData,
            borderColor: "#5F2DED",
            backgroundColor: "rgba(95, 45, 237, 0.1)"
          }
        ]
      }
    });

  } catch (error) {
    console.error('Error fetching enrollment trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch enrollment data'
    });
  }
};

exports.getCourseDistribution = async (req, res) => {
  try {
    // Get course count by category
    const categories = await Course.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        labels: categories.map(c => c._id),
        datasets: [{
          data: categories.map(c => c.count),
          backgroundColor: [
            "#5F2DED", "#4BC0C0", "#FFCE56", 
            "#FF6384", "#36A2EB"
          ]
        }]
      }
    });

  } catch (error) {
    console.error('Error fetching course distribution:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course distribution'
    });
  }
};

exports.getRevenueData = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    // Get monthly revenue
    const revenueData = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(`${currentYear}-01-01`),
            $lt: new Date(`${currentYear + 1}-01-01`)
          },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          revenue: { 
            $sum: { 
              $multiply: [
                { $cond: [{ $gt: ["$discountedAmount", 0] }, "$discountedAmount", "$amount"] },
                { $divide: ["$revenueSplit.platform", 100] }
              ]
            }
          }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // Format data
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const revenue = Array(12).fill(0);

    revenueData.forEach(month => {
      revenue[month._id - 1] = month.revenue;
    });

    res.status(200).json({
      success: true,
      data: {
        labels,
        datasets: [
          {
            label: "Platform Revenue",
            data: revenue,
            borderColor: "#4BC0C0",
            backgroundColor: "rgba(75, 192, 192, 0.1)",
            fill: true
          }
        ]
      }
    });

  } catch (error) {
    console.error('Error fetching revenue data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue data'
    });
  }
};


// get top instractures 


exports.getTopInstructors = async (req, res) => {
    try {
      const instructors = await User.aggregate([
        { $match: { role: 'instructor' } },
        {
          $lookup: {
            from: 'courses',
            localField: '_id',
            foreignField: 'instructor',
            as: 'courses'
          }
        },
        {
          $lookup: {
            from: 'orders',
            let: { courseIds: '$courses._id' },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ['$course', '$$courseIds'] },
                  status: 'completed'
                }
              },
              { $count: 'total' }
            ],
            as: 'enrollments'
          }
        },
        {
          $lookup: {
            from: 'reviews',
            let: { courseIds: '$courses._id' },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ['$course', '$$courseIds'] }
                }
              },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  averageRating: { $avg: '$rating' }
                }
              }
            ],
            as: 'reviews'
          }
        },
        {
          $addFields: {
            studentCount: { $ifNull: [{ $arrayElemAt: ['$enrollments.total', 0] }, 0] },
            courseCount: { $size: '$courses' },
            reviewCount: { $ifNull: [{ $arrayElemAt: ['$reviews.count', 0] }, 0] },
            averageRating: { $ifNull: [{ $arrayElemAt: ['$reviews.averageRating', 0] }, 0] }
          }
        },
        { $sort: { studentCount: -1 } },
        { $limit: 5 },
        {
          $project: {
            firstName: 1,
            lastName: 1,
            profile: 1,
            studentCount: 1,
            courseCount: 1,
            reviewCount: 1,
            averageRating: 1
          }
        }
      ]);
  
      res.status(200).json({ 
        success: true, 
        data: instructors.map(instructor => ({
          ...instructor,
          averageRating: parseFloat(instructor.averageRating.toFixed(1)) // Round to 1 decimal
        }))
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };


  // controllers/courseController.js
exports.getRecentCourses = async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 4;
      
      const courses = await Course.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('instructor', 'firstName lastName'); // Assuming your Course schema has instructor reference
  
      const formattedCourses = courses.map(course => ({
        _id: course._id,
        title: course.title,
        bannerImage: course.bannerImage,
        duration: formatDuration(course.totalDuration), // You'll need to implement this
        chapters: course.chapters,
        instructor: {
          name: `${course.instructor.firstName} ${course.instructor.lastName}`
        }
      }));
  
      res.status(200).json({
        success: true,
        data: formattedCourses
      });
    } catch (error) {
      console.error('Error fetching recent courses:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch recent courses'
      });
    }
  };
  
  // Helper function to format duration
  function formatDuration(seconds) {
    if (!seconds && seconds !== 0) return "0h 0m";
    const totalSeconds = Number(seconds);
    if (isNaN(totalSeconds) || totalSeconds < 0) return "0h 0m";
    const totalMinutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  }





exports.getNotices = async (req, res) => {
  try {
    const notices = await getLatestNotices();
    res.json(notices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notice = await Notice.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    res.json(notice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



// get notifications 

exports.getNotifications =  async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: null })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}



exports.coursesState = async (req, res) => {
  try {
    const courses = await Course.aggregate([
      {
        $lookup: {
          from: 'orders',
          let: { courseId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$course', '$$courseId'] }, status: 'completed' } }
          ],
          as: 'enrollments'
        }
      },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'course',
          as: 'reviews'
        }
      },
      {
        $project: {
          title: 1,
          instructor: 1,
          enrolled: { $size: '$enrollments' },
          averageRating: { $avg: '$reviews.rating' }
        }
      },
      { $sort: { enrolled: -1 } },
      { $limit: 20 }
    ]);

    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



// all courses by admin token 

exports.allCourses = async (req, res) => {
  try {
    // Fetch all courses and populate instructor info
    const allCourses = await Course.find()
      .sort({ createdAt: -1 })
      .populate({
        path: "instructor",
        select: "firstName lastName profile"
      });

    const courses = await Promise.all(
      allCourses.map(async (course) => {
        const reviews = await Reviews.find({ course: course._id });

        const totalReviews = reviews.length;
        const averageRating =
          totalReviews > 0
            ? reviews.reduce((acc, review) => acc + review.rating, 0) / totalReviews
            : 0;

        // Add instructor full name if exists
        const instructor = course.instructor
          ? {
              ...course.instructor.toObject(),
              Name: `${course.instructor.firstName} ${course.instructor.lastName}`
            }
          : null;

        return {
          ...course.toObject(),
          instructor,
          totalReviews,
          rating: averageRating,
          reviews
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "All courses with instructor data fetched successfully",
      data: courses
    });
  } catch (error) {
    console.error("Error fetching all courses:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



// Controller: Get all users with their roles
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, "firstName lastName email role profile createdAt"); 

    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get courses statistics for admin dashboard
exports.coursesState = async (req, res) => {
  try {
    const [
      totalCourses,
      publishedCourses,
      pendingCourses,
      draftCourses,
      totalEnrollments,
      totalRevenue
    ] = await Promise.all([
      Course.countDocuments(),
      Course.countDocuments({ status: 'published' }),
      Course.countDocuments({ status: 'pending' }),
      Course.countDocuments({ status: 'draft' }),
      User.aggregate([
        { $unwind: '$purchasedCourses' },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0),
      Order.aggregate([
        { $match: { paymentStatus: 'completed', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0)
    ]);

    // Get course distribution by category
    const coursesByCategory = await Course.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get recent course activity
    const recentCourses = await Course.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('instructor', 'firstName lastName')
      .select('title status createdAt instructor bannerImage');

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalCourses,
          publishedCourses,
          pendingCourses,
          draftCourses,
          totalEnrollments,
          totalRevenue
        },
        coursesByCategory,
        recentCourses: recentCourses.map(course => ({
          ...course.toObject(),
          instructorName: course.instructor ? 
            `${course.instructor.firstName} ${course.instructor.lastName}` : 
            'Unknown'
        }))
      }
    });

  } catch (error) {
    console.error("Error fetching courses stats:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch courses statistics",
      error: error.message 
    });
  }
};
