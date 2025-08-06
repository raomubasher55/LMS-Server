const User = require('../models/User');
const Course = require('../models/Course');
const Order = require('../models/Order');

/**
 * Get all enrolled courses for the current student
 */
exports.getEnrolledCourses = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find the user and populate both enrolled and purchased courses
    const user = await User.findById(userId)
      .populate({
        path: 'enrolledCourses',
        select: 'title bannerImage category language price discountedPrice instructor chapters offerType',
        populate: {
          path: 'instructor',
          select: 'firstName lastName profile'
        }
      })
      .populate({
        path: 'purchasedCourses.course',
        select: 'title bannerImage category language price discountedPrice instructor chapters offerType',
        populate: {
          path: 'instructor',
          select: 'firstName lastName profile'
        }
      })
      .select('enrolledCourses purchasedCourses');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Helper function to format course data
    const formatCourse = (course, purchaseData = null) => {
      const totalDuration = course.chapters?.reduce((total, chapter) => {
        return total + (chapter.video?.duration || 0);
      }, 0) || 0;

      const totalChapters = course.chapters?.length || 0;

      return {
        _id: course._id,
        title: course.title,
        bannerImage: course.bannerImage,
        category: course.category,
        language: course.language,
        price: course.price,
        discountedPrice: course.discountedPrice,
        offerType: course.offerType,
        instructor: {
          _id: course.instructor?._id,
          name: `${course.instructor?.firstName || ''} ${course.instructor?.lastName || ''}`.trim(),
          profile: course.instructor?.profile
        },
        progress: purchaseData?.progress || 0,
        purchasedAt: purchaseData?.purchasedAt || null,
        lastAccessed: purchaseData?.lastAccessed || null,
        paymentAmount: purchaseData?.paymentAmount || null,
        isPurchased: !!purchaseData,
        totalDuration,
        totalChapters
      };
    };

    // Combine all enrolled courses (both free and purchased)
    const allEnrolledCourses = [];

    // Add purchased courses (premium)
    user.purchasedCourses.forEach(purchase => {
      if (purchase.course) {
        allEnrolledCourses.push(formatCourse(purchase.course, purchase));
      }
    });

    // Add free courses (only if not already in purchased courses)
    const purchasedCourseIds = user.purchasedCourses.map(p => p.course?._id?.toString()).filter(Boolean);
    
    user.enrolledCourses.forEach(course => {
      if (course && !purchasedCourseIds.includes(course._id.toString())) {
        allEnrolledCourses.push(formatCourse(course));
      }
    });

    // Separate courses into active and completed based on progress
    const completedCourses = allEnrolledCourses.filter(course => course.progress === 100);
    const activeCourses = allEnrolledCourses.filter(course => course.progress < 100 && course.progress > 0);
    const notStartedCourses = allEnrolledCourses.filter(course => course.progress === 0);

    res.status(200).json({
      success: true,
      data: {
        all: allEnrolledCourses,
        active: [...activeCourses, ...notStartedCourses], // Include not started in active
        completed: completedCourses,
        notStarted: notStartedCourses,
        stats: {
          total: allEnrolledCourses.length,
          completed: completedCourses.length,
          active: activeCourses.length,
          notStarted: notStartedCourses.length,
          totalInvestment: user.purchasedCourses.reduce((total, purchase) => total + (purchase.paymentAmount || 0), 0)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching enrolled courses:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Update course progress for a student
 */
exports.updateCourseProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId, progress } = req.body;

    // Validate progress value
    if (progress < 0 || progress > 100) {
      return res.status(400).json({ success: false, message: 'Progress must be between 0 and 100' });
    }

    // Find user and update their course progress
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find the course in the user's purchased courses
    const purchasedCourseIndex = user.purchasedCourses.findIndex(
      item => item.course.toString() === courseId
    );

    if (purchasedCourseIndex === -1) {
      return res.status(404).json({ success: false, message: 'Course not found in enrolled courses' });
    }

    // Update progress and last accessed
    user.purchasedCourses[purchasedCourseIndex].progress = progress;
    user.purchasedCourses[purchasedCourseIndex].lastAccessed = new Date();

    // If course is completed (progress = 100%), add to completed courses
    if (progress === 100) {
      // Check if course is already in completed courses
      const alreadyCompleted = user.studentProfile.completedCourses.some(
        course => course.courseId.toString() === courseId
      );

      if (!alreadyCompleted) {
        user.studentProfile.completedCourses.push({
          courseId,
          completedOn: new Date()
        });
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Course progress updated',
      data: {
        courseId,
        progress: user.purchasedCourses[purchasedCourseIndex].progress,
        lastAccessed: user.purchasedCourses[purchasedCourseIndex].lastAccessed
      }
    });

  } catch (error) {
    console.error('Error updating course progress:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Mark a course as completed
 */
exports.markCourseAsCompleted = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;

    // Find user and update their course progress to 100%
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find the course in the user's purchased courses
    const purchasedCourseIndex = user.purchasedCourses.findIndex(
      item => item.course.toString() === courseId
    );

    if (purchasedCourseIndex === -1) {
      return res.status(404).json({ success: false, message: 'Course not found in enrolled courses' });
    }

    // Update progress to 100%
    user.purchasedCourses[purchasedCourseIndex].progress = 100;
    user.purchasedCourses[purchasedCourseIndex].lastAccessed = new Date();

    // Add to completed courses if not already there
    const completedCourseIndex = user.studentProfile.completedCourses.findIndex(
      item => item.courseId.toString() === courseId
    );

    if (completedCourseIndex === -1) {
      user.studentProfile.completedCourses.push({
        courseId,
        completedOn: new Date()
      });
    } else {
      // Update completed date if already in completed courses
      user.studentProfile.completedCourses[completedCourseIndex].completedOn = new Date();
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Course marked as completed',
      data: {
        courseId,
        completedOn: new Date()
      }
    });

  } catch (error) {
    console.error('Error marking course as completed:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Get course investment statistics
 */
exports.getCourseInvestmentStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // First, try to get data from Orders
    const orders = await Order.find({ 
      user: userId, 
      status: 'completed' 
    }).populate('course', 'price discountedPrice title');

    // If orders exist, use that data
    if (orders && orders.length > 0) {
      const totalInvestment = orders.reduce((total, order) => {
        return total + (order.totalAmount || 0);
      }, 0);

      const recentPurchases = orders
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map(order => ({
          _id: order._id,
          courseId: order.course._id,
          title: order.course.title,
          amount: order.totalAmount,
          purchaseDate: order.createdAt
        }));

      return res.status(200).json({
        success: true,
        data: {
          totalInvestment,
          courseCount: orders.length,
          recentPurchases
        }
      });
    }

    // Fallback: Get data from User's purchasedCourses
    const user = await User.findById(userId)
      .populate({
        path: 'purchasedCourses.course',
        select: 'title price discountedPrice'
      });

    if (!user || !user.purchasedCourses || user.purchasedCourses.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalInvestment: 0,
          courseCount: 0,
          recentPurchases: []
        }
      });
    }

    // Calculate total investment from user's purchased courses
    const totalInvestment = user.purchasedCourses.reduce((total, purchase) => {
      return total + (purchase.paymentAmount || 0);
    }, 0);

    // Get recent purchases from user data
    const recentPurchases = user.purchasedCourses
      .sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt))
      .slice(0, 5)
      .map(purchase => ({
        _id: purchase._id,
        courseId: purchase.course._id,
        title: purchase.course.title,
        amount: purchase.paymentAmount,
        purchaseDate: purchase.purchasedAt
      }));

    res.status(200).json({
      success: true,
      data: {
        totalInvestment,
        courseCount: user.purchasedCourses.length,
        recentPurchases
      }
    });

  } catch (error) {
    console.error('Error fetching investment stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
