const Chat = require('../models/Chat');
const User = require('../models/User');
const createNotification = require('../utils/createNotification');

/**
 * Get all chats for a user
 */
exports.getUserChats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Validate user exists
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Find all chats where the user is a participant
    const chats = await Chat.find({ participants: userId })
      .populate('participants', 'firstName lastName profile role')
      .populate('course', 'title')
      .populate('messages.sender', '_id')
      .sort({ updatedAt: -1 });

    // Handle case where no chats exist (this is normal for new users)
    if (!chats || chats.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'No chats found. Start a conversation!'
      });
    }

    // Format the response
    const formattedChats = chats.map(chat => {
      // Filter out the current user from participants
      const otherParticipants = chat.participants.filter(
        p => p._id && p._id.toString() !== userId
      );

      // Calculate unread count for this chat
      const unreadCount = chat.messages.filter(message => 
        message.sender.toString() !== userId && 
        !message.readBy.includes(userId)
      ).length;

      return {
        _id: chat._id,
        participants: chat.participants,
        otherParticipants: otherParticipants,
        course: chat.course,
        lastMessage: chat.lastMessage,
        unreadCount: unreadCount,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt
      };
    });

    res.status(200).json({
      success: true,
      data: formattedChats
    });
  } catch (error) {
    console.error('Error fetching user chats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get messages for a specific chat
 */
exports.getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    
    // Validate chatId
    if (!chatId || chatId === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Chat ID is required and must be valid'
      });
    }
    
    // Validate ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID format'
      });
    }
    
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Default 50 messages per page
    const skip = (page - 1) * limit;

    // Find the chat and verify the user is a participant
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    }).populate('participants', 'firstName lastName profile role')
      .populate('course', 'title bannerImage');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found or you do not have access'
      });
    }

    // Get total message count
    const totalMessages = chat.messages.length;
    
    // Get paginated messages (most recent first, then reverse for chronological order)
    // We want the most recent messages, so we slice from the end
    const startIndex = Math.max(0, totalMessages - skip - limit);
    const endIndex = totalMessages - skip;
    
    const paginatedMessages = chat.messages
      .slice(startIndex, endIndex)
      .reverse(); // Reverse to get chronological order (oldest first)

    // Populate sender information for paginated messages
    await Chat.populate(paginatedMessages, {
      path: 'sender',
      select: 'firstName lastName profile role'
    });

    // Mark messages as read by this user (only the fetched messages)
    let hasUpdates = false;
    paginatedMessages.forEach(message => {
      if (message.sender._id.toString() !== userId && !message.readBy.includes(userId)) {
        message.readBy.push(userId);
        hasUpdates = true;
      }
    });
    
    if (hasUpdates) {
      await chat.save();
    }

    // Calculate pagination info
    const hasMore = startIndex > 0;
    const nextPage = hasMore ? page + 1 : null;

    res.status(200).json({
      success: true,
      data: {
        chatId: chat._id,
        participants: chat.participants,
        messages: paginatedMessages,
        course: chat.course,
        pagination: {
          currentPage: page,
          totalMessages,
          messagesPerPage: limit,
          hasMore,
          nextPage,
          totalPages: Math.ceil(totalMessages / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
};

/**
 * Create a new chat or get existing chat between users
 */
exports.createOrGetChat = async (req, res) => {
  try {
    const { participantId, courseId } = req.body;
    const userId = req.user.id;

    if (!participantId) {
      return res.status(400).json({
        success: false,
        message: 'Participant ID is required'
      });
    }

    // Check if the participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found'
      });
    }

    // Create a participants array with both user IDs
    const participants = [userId, participantId];

    // Check if chat already exists between these users
    let chat = await Chat.findOne({
      participants: { $all: participants },
      ...(courseId ? { course: courseId } : {})
    });

    // If chat doesn't exist, create a new one
    if (!chat) {
      chat = new Chat({
        participants,
        course: courseId,
        messages: []
      });
      await chat.save();
    }

    // Populate the chat data
    const populatedChat = await Chat.findById(chat._id)
      .populate('participants', 'firstName lastName profile role')
      .populate('course', 'title bannerImage');
    
    // Return the chat with proper structure
    res.status(200).json({
      success: true,
      data: populatedChat
    });
  } catch (error) {
    console.error('Error creating or getting chat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create or get chat'
    });
  }
};

/**
 * Send a message in a chat
 */
exports.sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    
    // Validate chatId
    if (!chatId || chatId === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Chat ID is required and must be valid'
      });
    }
    
    // Validate ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID format'
      });
    }
    
    // Process uploaded files
    let attachments = [];
    if (req.files && req.files.length > 0) {
      attachments = req.files.map(file => ({
        url: `/uploads/chat-attachments/${file.filename}`,
        filename: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size
      }));
    }

    if (!content && attachments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content or attachments are required'
      });
    }

    // Find the chat and verify the user is a participant
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    }).populate('participants', 'firstName lastName');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found or you do not have access'
      });
    }

    // Create the new message
    const newMessage = {
      sender: userId,
      content: content || '',
      timestamp: new Date(),
      readBy: [userId],
      attachments: attachments || []
    };

    // Add the message to the chat
    chat.messages.push(newMessage);
    await chat.save();
    
    console.log('Message saved to database:', {
      chatId: chat._id,
      messageId: newMessage._id,
      content: newMessage.content,
      sender: newMessage.sender
    });

    // Get the newly added message with populated sender
    const populatedChat = await Chat.findById(chatId)
      .populate('messages.sender', 'firstName lastName profile role');
    
    const sentMessage = populatedChat.messages[populatedChat.messages.length - 1];

    // Create notifications for other participants
    const otherParticipants = chat.participants
      .filter(p => p._id.toString() !== userId)
      .map(p => p._id);

    // Get sender info
    const sender = await User.findById(userId).select('firstName lastName role');
    
    // Create notification for each recipient
    for (const recipientId of otherParticipants) {
      // Get recipient info to determine the correct message page
      const recipient = await User.findById(recipientId).select('role');
      let messagePageLink;
      
      switch (recipient.role) {
        case 'instructor':
          messagePageLink = '/dashboards/instructor-message';
          break;
        case 'admin':
          messagePageLink = '/dashboards/admin-message';
          break;
        case 'student':
        default:
          messagePageLink = '/dashboards/student-message';
          break;
      }
      
      await createNotification({
        userId: recipientId,
        name: `${sender.firstName} ${sender.lastName}`,
        title: `New message from ${sender.firstName} ${sender.lastName}`,
        type: 'message',
        link: messagePageLink
      });
    }

    console.log('Sending response:', {
      success: true,
      message: 'Message sent successfully',
      data: sentMessage
    });
    
    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: sentMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
};

/**
 * Delete a chat (admin only)
 */
exports.deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only admins can delete chats
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete chats'
      });
    }

    // Find and delete the chat
    const deletedChat = await Chat.findByIdAndDelete(chatId);

    if (!deletedChat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete chat'
    });
  }
};

/**
 * Debug endpoint to check student enrollment data
 */
exports.debugStudentEnrollment = async (req, res) => {
  try {
    const studentId = req.user.id;
    const student = await User.findById(studentId)
      .populate('purchasedCourses.course', 'title instructor')
      .populate('enrolledCourses', 'title instructor');
    
    res.json({
      studentId,
      purchasedCourses: student.purchasedCourses,
      enrolledCourses: student.enrolledCourses,
      purchasedCount: student.purchasedCourses?.length || 0,
      enrolledCount: student.enrolledCourses?.length || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get available instructors for student to chat with (from enrolled courses)
 */
exports.getStudentChatContacts = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Get student with both purchased and enrolled courses
    const student = await User.findById(studentId)
      .populate({
        path: 'purchasedCourses.course',
        select: 'title instructor bannerImage',
        populate: {
          path: 'instructor',
          select: 'firstName lastName profile email role'
        }
      })
      .populate({
        path: 'enrolledCourses',
        select: 'title instructor bannerImage',
        populate: {
          path: 'instructor',
          select: 'firstName lastName profile email role'
        }
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    console.log('Student found:', {
      id: student._id,
      purchasedCourses: student.purchasedCourses?.length || 0,
      enrolledCourses: student.enrolledCourses?.length || 0
    });

    // Extract unique instructors from both purchased and enrolled courses
    const instructorsMap = new Map();

    // Process purchased courses
    if (student.purchasedCourses && student.purchasedCourses.length > 0) {
      student.purchasedCourses.forEach(pc => {
        if (pc.course && pc.course.instructor) {
          const instructor = pc.course.instructor;
          const instructorId = instructor._id.toString();
          
          if (!instructorsMap.has(instructorId)) {
            instructorsMap.set(instructorId, {
              _id: instructor._id,
              name: `${instructor.firstName} ${instructor.lastName}`,
              firstName: instructor.firstName,
              lastName: instructor.lastName,
              profileImage: instructor.profile,
              email: instructor.email,
              courses: []
            });
          }
          
          instructorsMap.get(instructorId).courses.push({
            _id: pc.course._id,
            title: pc.course.title,
            bannerImage: pc.course.bannerImage
          });
        }
      });
    }

    // Process enrolled courses
    if (student.enrolledCourses && student.enrolledCourses.length > 0) {
      student.enrolledCourses.forEach(course => {
        if (course && course.instructor) {
          const instructor = course.instructor;
          const instructorId = instructor._id.toString();
          
          if (!instructorsMap.has(instructorId)) {
            instructorsMap.set(instructorId, {
              _id: instructor._id,
              name: `${instructor.firstName} ${instructor.lastName}`,
              firstName: instructor.firstName,
              lastName: instructor.lastName,
              profileImage: instructor.profile,
              email: instructor.email,
              courses: []
            });
          }
          
          // Check if course already exists for this instructor
          const existingCourse = instructorsMap.get(instructorId).courses.find(c => c._id.toString() === course._id.toString());
          if (!existingCourse) {
            instructorsMap.get(instructorId).courses.push({
              _id: course._id,
              title: course.title,
              bannerImage: course.bannerImage
            });
          }
        }
      });
    }

    const instructors = Array.from(instructorsMap.values());

    console.log('Instructors found:', instructors.length);

    res.status(200).json({
      success: true,
      instructors: instructors
    });

  } catch (error) {
    console.error('Error fetching student chat contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat contacts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get students for instructor to chat with (from their courses)
 */
exports.getInstructorChatContacts = async (req, res) => {
  try {
    const instructorId = req.user.id;

    // Get instructor's courses
    const Course = require('../models/Course');
    const courses = await Course.find({ instructor: instructorId })
      .select('title bannerImage')
      .lean();

    if (!courses || courses.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'No courses found'
      });
    }

    const courseIds = courses.map(course => course._id);

    // Get all students enrolled in instructor's courses
    const studentsWithCourses = await User.find({
      'purchasedCourses.course': { $in: courseIds }
    })
    .select('firstName lastName profile email purchasedCourses')
    .populate({
      path: 'purchasedCourses.course',
      match: { instructor: instructorId },
      select: 'title bannerImage'
    });

    // Format response grouped by course
    const result = courses.map(course => {
      const enrolledStudents = studentsWithCourses
        .filter(student => 
          student.purchasedCourses.some(pc => 
            pc.course && pc.course._id.toString() === course._id.toString()
          )
        )
        .map(student => ({
          _id: student._id,
          firstName: student.firstName,
          lastName: student.lastName,
          profile: student.profile,
          email: student.email
        }));

      return {
        course: {
          _id: course._id,
          title: course.title,
          bannerImage: course.bannerImage
        },
        students: enrolledStudents,
        studentCount: enrolledStudents.length
      };
    });

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error fetching instructor chat contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat contacts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create or get chat between student and instructor for specific course
 */
exports.createCourseChat = async (req, res) => {
  try {
    const { instructorId, courseId } = req.body;
    const studentId = req.user.id;

    // Validate required fields
    if (!instructorId || !courseId) {
      return res.status(400).json({
        success: false,
        message: 'Instructor ID and Course ID are required'
      });
    }

    // Validate ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(instructorId) || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid instructor or course ID format'
      });
    }

    // Check if student exists and get enrollment data
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if instructor exists and has correct role
    const instructor = await User.findById(instructorId);
    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }

    if (instructor.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        message: 'User is not an instructor'
      });
    }

    // Verify student is enrolled in the course (check both purchased and enrolled courses)
    const isPurchased = student.purchasedCourses && student.purchasedCourses.some(
      pc => pc.course && pc.course.toString() === courseId
    );
    const isEnrolled = student.enrolledCourses && student.enrolledCourses.some(
      courseRef => courseRef && courseRef.toString() === courseId
    );

    if (!isPurchased && !isEnrolled) {
      return res.status(403).json({
        success: false,
        message: 'You are not enrolled in this course. Please enroll or purchase the course first.',
        details: {
          courseId,
          enrollmentStatus: {
            purchased: isPurchased,
            enrolled: isEnrolled
          }
        }
      });
    }

    // Verify instructor teaches this course
    const Course = require('../models/Course');
    const course = await Course.findOne({ _id: courseId, instructor: instructorId });
    if (!course) {
      return res.status(403).json({
        success: false,
        message: 'This instructor does not teach the specified course',
        details: {
          courseId,
          instructorId,
          instructorName: `${instructor.firstName} ${instructor.lastName}`
        }
      });
    }

    // Check if course is active/published
    if (course.status !== 'approved' && course.status !== 'published') {
      return res.status(403).json({
        success: false,
        message: 'Cannot start chat for unpublished course',
        details: {
          courseStatus: course.status,
          courseName: course.title
        }
      });
    }

    // Check if chat already exists
    let chat = await Chat.findOne({
      participants: { $all: [studentId, instructorId] },
      course: courseId
    });

    // Create new chat if doesn't exist
    if (!chat) {
      chat = new Chat({
        participants: [studentId, instructorId],
        course: courseId,
        messages: []
      });
      await chat.save();
    }

    // Populate chat data
    const populatedChat = await Chat.findById(chat._id)
      .populate('participants', 'firstName lastName profile role')
      .populate('course', 'title bannerImage');

    res.status(200).json({
      success: true,
      data: populatedChat
    });

  } catch (error) {
    console.error('Error creating course chat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create chat',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all instructors for admin to chat with
 */
exports.getAdminChatContacts = async (req, res) => {
  try {
    // Get all users with instructor role
    const instructors = await User.find({ role: 'instructor' })
      .select('firstName lastName profile email')
      .sort({ firstName: 1, lastName: 1 });

    if (!instructors || instructors.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'No instructors found'
      });
    }

    // Format response
    const formattedInstructors = instructors.map(instructor => ({
      _id: instructor._id,
      firstName: instructor.firstName,
      lastName: instructor.lastName,
      fullName: `${instructor.firstName} ${instructor.lastName}`,
      profile: instructor.profile,
      email: instructor.email,
      role: 'instructor'
    }));

    res.status(200).json({
      success: true,
      data: formattedInstructors
    });

  } catch (error) {
    console.error('Error fetching admin chat contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch instructors',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get admin contacts for instructor to chat with
 */
exports.getInstructorAdminContacts = async (req, res) => {
  try {
    // Get all users with admin role
    const admins = await User.find({ role: 'admin' })
      .select('firstName lastName profile email')
      .sort({ firstName: 1, lastName: 1 });

    if (!admins || admins.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'No administrators found'
      });
    }

    // Format response
    const formattedAdmins = admins.map(admin => ({
      _id: admin._id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      fullName: `${admin.firstName} ${admin.lastName}`,
      profile: admin.profile,
      email: admin.email,
      role: 'admin'
    }));

    res.status(200).json({
      success: true,
      data: formattedAdmins
    });

  } catch (error) {
    console.error('Error fetching instructor admin contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch administrators',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};