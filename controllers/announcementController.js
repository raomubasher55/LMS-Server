const Announcement = require('../models/Announcement');
const Course = require('../models/Course');
const User = require('../models/User');
const createNotification = require('../utils/createNotification');

// Get all announcements for an instructor
exports.getInstructorAnnouncements = async (req, res) => {
  try {
    const instructorId = req.user.id;

    const announcements = await Announcement.find({ instructorId })
      .populate('courseId', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error fetching instructor announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements'
    });
  }
};

// Get announcements for a specific course (for students)
exports.getCourseAnnouncements = async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user.id;

    // Verify student is enrolled in the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const announcements = await Announcement.find({ 
      courseId, 
      isActive: true 
    })
      .populate('instructorId', 'firstName lastName')
      .populate('courseId', 'title')
      .sort({ createdAt: -1 });

    // Mark announcements as read by this student
    const announcementIds = announcements.map(a => a._id);
    await Announcement.updateMany(
      { 
        _id: { $in: announcementIds },
        'readBy.studentId': { $ne: studentId }
      },
      { 
        $push: { 
          readBy: { 
            studentId, 
            readAt: new Date() 
          } 
        } 
      }
    );

    res.status(200).json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error fetching course announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course announcements'
    });
  }
};

// Get announcements for student dashboard (all enrolled courses)
exports.getStudentAnnouncements = async (req, res) => {
  try {
    const studentId = req.user.id;
    console.log('Fetching announcements for student:', studentId);

    // Get all courses the student is enrolled in
    const student = await User.findById(studentId).populate('enrolledCourses');
    if (!student) {
      console.log('Student not found:', studentId);
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    console.log('Student found:', student.firstName, student.lastName);
    console.log('Enrolled courses:', student.enrolledCourses?.length || 0);

    const enrolledCourseIds = student.enrolledCourses.map(course => course._id);
    console.log('Enrolled course IDs:', enrolledCourseIds);

    const announcements = await Announcement.find({
      courseId: { $in: enrolledCourseIds },
      isActive: true
    })
      .populate('instructorId', 'firstName lastName')
      .populate('courseId', 'title')
      .sort({ createdAt: -1 })
      .limit(20); // Limit to latest 20 announcements

    console.log('Found announcements:', announcements.length);

    // Add read status for each announcement
    const announcementsWithReadStatus = announcements.map(announcement => {
      const isRead = announcement.readBy.some(read => 
        read.studentId.toString() === studentId.toString()
      );
      return {
        ...announcement.toObject(),
        isRead
      };
    });

    console.log('Returning announcements with read status');

    res.status(200).json({
      success: true,
      data: announcementsWithReadStatus
    });
  } catch (error) {
    console.error('Error fetching student announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements'
    });
  }
};

// Create a new announcement
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, courseId, priority } = req.body;
    const instructorId = req.user.id;

    // Validate required fields
    if (!title || !content || !courseId) {
      return res.status(400).json({
        success: false,
        message: 'Title, content, and course are required'
      });
    }

    // Verify the instructor owns this course
    const course = await Course.findOne({ _id: courseId, instructor: instructorId });
    if (!course) {
      return res.status(403).json({
        success: false,
        message: 'You can only create announcements for your own courses'
      });
    }

    const announcement = new Announcement({
      title,
      content,
      instructorId,
      courseId,
      priority: priority || 'medium'
    });

    await announcement.save();

    // Populate the announcement with course and instructor details
    await announcement.populate([
      { path: 'courseId', select: 'title' },
      { path: 'instructorId', select: 'firstName lastName' }
    ]);

    // Create notifications for all enrolled students
    const enrolledStudents = await User.find({ 
      enrolledCourses: courseId,
      role: 'student' 
    });

    // Create notifications for enrolled students
    const notificationPromises = enrolledStudents.map(student => 
      createNotification({
        userId: student._id,
        title: `New announcement in ${course.title}`,
        type: 'course',
        courseId: courseId,
        name: title
      })
    );

    await Promise.all(notificationPromises);

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create announcement'
    });
  }
};

// Update an announcement
exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, priority, isActive } = req.body;
    const instructorId = req.user.id;

    const announcement = await Announcement.findOne({ _id: id, instructorId });
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found or unauthorized'
      });
    }

    // Update fields
    if (title) announcement.title = title;
    if (content) announcement.content = content;
    if (priority) announcement.priority = priority;
    if (isActive !== undefined) announcement.isActive = isActive;
    announcement.updatedAt = new Date();

    await announcement.save();

    await announcement.populate([
      { path: 'courseId', select: 'title' },
      { path: 'instructorId', select: 'firstName lastName' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Announcement updated successfully',
      data: announcement
    });
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update announcement'
    });
  }
};

// Delete an announcement
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const instructorId = req.user.id;

    const announcement = await Announcement.findOne({ _id: id, instructorId });
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found or unauthorized'
      });
    }

    await Announcement.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete announcement'
    });
  }
};

// Mark announcement as read by student
exports.markAnnouncementAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = req.user.id;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Check if already read
    const alreadyRead = announcement.readBy.some(read => 
      read.studentId.toString() === studentId.toString()
    );

    if (!alreadyRead) {
      announcement.readBy.push({
        studentId,
        readAt: new Date()
      });
      await announcement.save();
    }

    res.status(200).json({
      success: true,
      message: 'Announcement marked as read'
    });
  } catch (error) {
    console.error('Error marking announcement as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark announcement as read'
    });
  }
};