const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Course = require('../models/Course');
const sendEmail = require('../utils/sendEmail');
const mongoose = require('mongoose')

exports.updateProfile = async (req, res) => {
  const userId = req.params.id;
  try {
    const updatedData = req.body;

    const updatedUser = await User.findByIdAndUpdate(userId, updatedData, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 👇 Customize message based on role
    let roleMessage = '';
    switch (updatedUser.role) {
      case 'student':
        roleMessage = 'Your student profile at Tanga Academy has been successfully updated.';
        break;
      case 'instructor':
        roleMessage = 'Your instructor profile at Tanga Academy has been updated. Keep inspiring students!';
        break;
      case 'admin':
        roleMessage = 'Your admin profile has been updated at Tanga Academy.';
        break;
    }

    // 👇 Send profile update email
    await sendEmail(
      updatedUser.email,
      'Profile Updated - Tanga Academy',
      `
        <h2>Hello ${updatedUser.firstName} ${updatedUser.lastName},</h2>
        <p>${roleMessage}</p>
        <p>If you didn’t request this update, please contact our support immediately.</p>
        <br />
        <p>— Tanga Academy Team</p>
      `
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
};


// ✅ Password Update Function

exports.updatePassword = async (req, res) => {
  const userId = req.user.id; 
  const { currentPassword, newPassword } = req.body;

  // Validate request body
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new passwords are required' });
  }

  try {
    const user = await User.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if current password matches
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Update the password in the database
    user.password = newPassword;
    await user.save();

    // Send confirmation email
    await sendEmail(
      user.email,
      'Password Updated - Tanga Academy',
      `
        <h2>Hello ${user.firstName} ${user.lastName},</h2>
        <p>Your password has been successfully updated for your ${user.role} account at <strong>Tanga Academy</strong>.</p>
        <p>If you didn’t make this change, please contact our support immediately.</p>
        <br />
        <p>— Tanga Academy Team</p>
      `
    );

    // Respond with success
    res.status(200).json({ message: "Password updated and confirmation email sent." });
  } catch (err) {
    console.error("Password update error:", err);
    res.status(500).json({ message: "Server error" });
  }
};





exports.updateSocialLinks = async (req, res) => {
  try {

    const userId = req.user.id; 
    console.log(userId)

    // Validate URL format (simple validation for now, you can use a more robust regex)
    const urlRegex = /^(https?:\/\/)?([a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+)(\/[^\s]*)?$/;

    const { facebook, twitter, linkedin, website, github } = req.body;

    // Validate each social link
    const socialLinks = {
      facebook,
      twitter,
      linkedin,
      website,
      github,
    };

    for (const platform in socialLinks) {
      if (socialLinks[platform] && !urlRegex.test(socialLinks[platform])) {
        return res.status(400).json({ message: `${platform} link is invalid` });
      }
    }

    // Find user and update the social links in instructorProfile
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "instructorProfile.socialLinks": {
            facebook,
            twitter,
            linkedin,
            website,
            github,
          },
        },
      },
      { new: true } // Return the updated document
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Social links updated successfully",
      user: user
    });
  } catch (error) {
    console.error("Error updating social links:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// get user profile 

exports.getProfile = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id)
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(id).select(
      'firstName lastName username profile bio skill role instructorProfile '
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get student order history (purchased courses)
exports.getStudentOrderHistory = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Find the student and populate purchased courses
    const student = await User.findById(studentId)
      .populate({
        path: 'purchasedCourses.course',
        select: 'title thumbnail instructor price'
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Format the order history data
    const orderHistory = await Promise.all(
      student.purchasedCourses.map(async (purchase) => {
        let courseData = purchase.course;
        
        // If course is not populated (just ObjectId), fetch it manually
        if (!courseData.title) {
          courseData = await Course.findById(purchase.course)
            .select('title thumbnail instructor price')
            .populate('instructor', 'firstName lastName');
        }

        return {
          orderId: purchase._id,
          orderDate: purchase.purchasedAt,
          course: {
            _id: courseData._id,
            title: courseData.title,
            thumbnail: courseData.thumbnail,
            instructor: courseData.instructor,
            originalPrice: courseData.price
          },
          paymentAmount: purchase.paymentAmount,
          paymentMethod: purchase.paymentMethod,
          transactionId: purchase.transactionId,
          progress: purchase.progress || 0,
          lastAccessed: purchase.lastAccessed,
          status: 'completed'
        };
      })
    );

    // Sort by purchase date (newest first)
    orderHistory.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));

    res.status(200).json({
      success: true,
      data: orderHistory,
      totalOrders: orderHistory.length
    });

  } catch (error) {
    console.error('Error fetching order history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order history'
    });
  }
};

/**
 * Get unread message count for user
 */
exports.getUnreadMessageCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const Chat = require('../models/Chat');

    // Find all chats where user is a participant
    const chats = await Chat.find({
      participants: userId
    });

    let unreadCount = 0;

    // Count unread messages across all chats
    chats.forEach(chat => {
      chat.messages.forEach(message => {
        // Count message as unread if:
        // 1. It's not sent by the current user
        // 2. The current user is not in the readBy array
        if (message.sender.toString() !== userId && !message.readBy.includes(userId)) {
          unreadCount++;
        }
      });
    });

    res.status(200).json({
      success: true,
      data: {
        unreadCount
      }
    });
  } catch (error) {
    console.error('Error fetching unread message count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread message count',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all students (admin only)
exports.getAllStudents = async (req, res) => {
  try {
    const students = await User.find({ role: 'student' })
      .select('firstName lastName email profile role createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: students,
      count: students.length
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// get instractors
exports.getInstructors = async (req, res) => {
  try {
    const instructors = await User.find({ role: 'instructor' })
      .select('firstName lastName email profile role instructorProfile skill createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: instructors,
      count: instructors.length
    });
  } catch (error) {
    console.error('Error fetching instructors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch instructors',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// get instructor by id

exports.getInstructorById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid instructor ID" });
    }

    const instructor = await User.findById(id);

    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }

    res.status(200).json({
      success: true,
      data: instructor
    });
  } catch (error) {
    console.error("Error fetching instructor:", error);
    res.status(500).json({ message: "Server error" });
  }
}