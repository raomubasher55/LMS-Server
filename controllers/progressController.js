const User = require('../models/User');
const Course = require('../models/Course');

// Mark video as completed
const markVideoCompleted = async (req, res) => {
  try {
    const { courseId, chapterId } = req.body;
    const userId = req.user.id;

    if (!courseId || !chapterId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID and Chapter ID are required'
      });
    }

    // Find user and course
    const user = await User.findById(userId);
    const course = await Course.findById(courseId);

    if (!user || !course) {
      return res.status(404).json({
        success: false,
        message: 'User or course not found'
      });
    }

    // Check if user has access to the course
    const hasEnrolledAccess = user.enrolledCourses.some(enrolled => 
      enrolled && enrolled.toString() === courseId
    );
    const hasPurchasedAccess = user.purchasedCourses.some(purchased => 
      purchased && purchased.course && purchased.course.toString() === courseId
    );

    if (!hasEnrolledAccess && !hasPurchasedAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You need to enroll in this course first.'
      });
    }

    // Find the chapter in the course
    const chapter = course.chapters.find(ch => ch._id.toString() === chapterId);
    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Chapter not found'
      });
    }

    // Initialize progress tracking if not exists
    if (!user.courseProgress) {
      user.courseProgress = [];
    }

    // Find or create course progress
    let courseProgress = user.courseProgress.find(cp => cp.courseId.toString() === courseId);
    if (!courseProgress) {
      courseProgress = {
        courseId: courseId,
        completedChapters: [],
        overallProgress: 0,
        lastAccessedAt: new Date()
      };
      user.courseProgress.push(courseProgress);
    }

    // Mark chapter as completed if not already
    if (!courseProgress.completedChapters.includes(chapterId)) {
      courseProgress.completedChapters.push(chapterId);
    }

    // Calculate overall progress based on videos, quizzes, and assignments
    const totalChapters = course.chapters.length;
    const completedChapters = courseProgress.completedChapters.length;
    
    // Get quiz progress
    const quizProgressData = user.quizProgress?.filter(qp => qp.courseId.toString() === courseId) || [];
    const passedQuizzes = quizProgressData.filter(qp => qp.passed).length;
    
    // Get assignment submissions (assuming they exist in user model)
    // This is a simplified calculation - you might want to check actual assignment completion
    const totalAssignments = course.assignments?.length || 0;
    const submittedAssignments = user.submittedAssignments?.filter(sa => 
      course.assignments?.some(a => a.toString() === sa.assignment?.toString())
    ).length || 0;
    
    // Calculate weighted progress
    // 60% videos, 30% quizzes, 10% assignments
    let videoWeight = 0.6;
    let quizWeight = 0.3;
    let assignmentWeight = 0.1;
    
    // Adjust weights if no quizzes or assignments exist
    if (totalAssignments === 0 && quizProgressData.length === 0) {
      videoWeight = 1.0;
      quizWeight = 0;
      assignmentWeight = 0;
    } else if (totalAssignments === 0) {
      videoWeight = 0.7;
      quizWeight = 0.3;
      assignmentWeight = 0;
    } else if (quizProgressData.length === 0) {
      videoWeight = 0.9;
      quizWeight = 0;
      assignmentWeight = 0.1;
    }
    
    // Calculate progress components
    const videoProgress = totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0;
    const quizProgressPercent = quizProgressData.length > 0 ? (passedQuizzes / quizProgressData.length) * 100 : 0;
    const assignmentProgress = totalAssignments > 0 ? (submittedAssignments / totalAssignments) * 100 : 0;
    
    // Calculate weighted overall progress
    courseProgress.overallProgress = Math.round(
      (videoProgress * videoWeight) + 
      (quizProgressPercent * quizWeight) + 
      (assignmentProgress * assignmentWeight)
    );
    courseProgress.lastAccessedAt = new Date();

    // Update the specific course enrollment/purchase with progress
    if (hasPurchasedAccess) {
      const purchasedCourse = user.purchasedCourses.find(purchased => 
        purchased && purchased.course && purchased.course.toString() === courseId
      );
      if (purchasedCourse) {
        purchasedCourse.progress = courseProgress.overallProgress;
      }
    }

    await user.save();

    // Calculate total videos across all chapters
    const totalVideos = course.chapters.reduce((total, chapter) => {
      return total + (chapter.video ? 1 : 0);
    }, 0);

    res.status(200).json({
      success: true,
      message: 'Video marked as completed',
      data: {
        chapterId,
        overallProgress: courseProgress.overallProgress,
        completedChapters: courseProgress.completedChapters.length,
        totalChapters: totalChapters,
        totalVideos: totalVideos,
        videoProgress: Math.round(videoProgress),
        quizProgress: Math.round(quizProgressPercent),
        assignmentProgress: Math.round(assignmentProgress),
        passedQuizzes: passedQuizzes,
        totalQuizzes: quizProgressData.length,
        submittedAssignments: submittedAssignments,
        totalAssignments: totalAssignments
      }
    });

  } catch (error) {
    console.error('Error marking video as completed:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get user's progress for a course
const getCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    const course = await Course.findById(courseId);

    if (!user || !course) {
      return res.status(404).json({
        success: false,
        message: 'User or course not found'
      });
    }

    // Find course progress
    const courseProgress = user.courseProgress?.find(cp => cp.courseId.toString() === courseId);

    // Calculate total videos across all chapters
    const totalVideos = course.chapters.reduce((total, chapter) => {
      return total + (chapter.video ? 1 : 0);
    }, 0);

    if (!courseProgress) {
      return res.status(200).json({
        success: true,
        data: {
          courseId,
          completedChapters: [],
          overallProgress: 0,
          totalChapters: course.chapters.length,
          totalVideos: totalVideos
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        courseId,
        completedChapters: courseProgress.completedChapters,
        overallProgress: courseProgress.overallProgress,
        totalChapters: course.chapters.length,
        totalVideos: totalVideos,
        lastAccessedAt: courseProgress.lastAccessedAt
      }
    });

  } catch (error) {
    console.error('Error getting course progress:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update video watch time (for partial progress tracking)
const updateWatchTime = async (req, res) => {
  try {
    const { courseId, chapterId, watchTime, totalDuration } = req.body;
    const userId = req.user.id;

    if (!courseId || !chapterId || watchTime === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Course ID, Chapter ID, and watch time are required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Initialize progress tracking if not exists
    if (!user.courseProgress) {
      user.courseProgress = [];
    }

    // Find or create course progress
    let courseProgress = user.courseProgress.find(cp => cp.courseId.toString() === courseId);
    if (!courseProgress) {
      courseProgress = {
        courseId: courseId,
        completedChapters: [],
        chapterWatchTimes: [],
        overallProgress: 0,
        lastAccessedAt: new Date()
      };
      user.courseProgress.push(courseProgress);
    }

    // Initialize chapter watch times if not exists
    if (!courseProgress.chapterWatchTimes) {
      courseProgress.chapterWatchTimes = [];
    }

    // Update or create watch time for this chapter
    let chapterWatchTime = courseProgress.chapterWatchTimes.find(cwt => cwt.chapterId.toString() === chapterId);
    if (!chapterWatchTime) {
      chapterWatchTime = {
        chapterId: chapterId,
        watchTime: 0,
        totalDuration: totalDuration || 0
      };
      courseProgress.chapterWatchTimes.push(chapterWatchTime);
    }

    chapterWatchTime.watchTime = Math.max(chapterWatchTime.watchTime, watchTime);
    if (totalDuration) {
      chapterWatchTime.totalDuration = totalDuration;
    }

    // Auto-complete video if watched 90% or more
    const watchPercentage = totalDuration > 0 ? (watchTime / totalDuration) * 100 : 0;
    if (watchPercentage >= 90 && !courseProgress.completedChapters.includes(chapterId)) {
      courseProgress.completedChapters.push(chapterId);
    }

    courseProgress.lastAccessedAt = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Watch time updated',
      data: {
        chapterId,
        watchTime,
        watchPercentage: Math.round(watchPercentage),
        isCompleted: courseProgress.completedChapters.includes(chapterId)
      }
    });

  } catch (error) {
    console.error('Error updating watch time:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  markVideoCompleted,
  getCourseProgress,
  updateWatchTime
};