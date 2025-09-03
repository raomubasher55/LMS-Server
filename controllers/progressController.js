const User = require('../models/User');
const Course = require('../models/Course');

// Mark video as completed
const markVideoCompleted = async (req, res) => {
  try {
    const { courseId, vimeoId } = req.body;
    const userId = req.user.id;

    if (!courseId || !vimeoId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID and Vimeo ID are required'
      });
    }

    const user = await User.findById(userId);
    const course = await Course.findById(courseId);

    if (!user || !course) {
      return res.status(404).json({
        success: false,
        message: 'User or course not found'
      });
    }

    // Find the chapter by video (vimeoId)
    const chapter = course.chapters.find(ch =>
      (ch.lessons || []).some(lesson => lesson.video?.vimeoId === vimeoId)
    );

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Chapter not found for this video'
      });
    }

    const chapterId = chapter._id.toString();

    // ensure course progress exists
    let courseProgress = user.courseProgress.find(cp => cp.courseId.toString() === courseId);
    if (!courseProgress) {
      courseProgress = {
        courseId,
        completedChapters: [],
        completedVideos: [],
        overallProgress: 0,
        lastAccessedAt: new Date()
      };
      user.courseProgress.push(courseProgress);
    }

    if (!Array.isArray(courseProgress.completedVideos)) {
      courseProgress.completedVideos = [];
    }

    // Mark video completed
    if (!courseProgress.completedVideos.includes(vimeoId)) {
      courseProgress.completedVideos.push(vimeoId);
    }

    // Check if all videos in this chapter are completed
    const chapterVideoIds = (chapter.lessons || [])
      .map(l => l.video?.vimeoId)
      .filter(Boolean);

    const allChapterVideosCompleted =
      chapterVideoIds.length > 0 &&
      chapterVideoIds.every(id => courseProgress.completedVideos.includes(id));

    if (
      allChapterVideosCompleted &&
      !courseProgress.completedChapters.includes(chapterId)
    ) {
      courseProgress.completedChapters.push(chapterId);
    }

    // Recalculate overall progress
    const allCourseVideos = course.chapters
      .flatMap(ch => ch.lessons || [])
      .map(l => l.video?.vimeoId)
      .filter(Boolean);

    const totalVideos = allCourseVideos.length;
    const completedVideoCount = courseProgress.completedVideos.filter(id =>
      allCourseVideos.includes(id)
    ).length;

    courseProgress.overallProgress =
      totalVideos > 0
        ? Math.round((completedVideoCount / totalVideos) * 100)
        : 0;

    courseProgress.lastAccessedAt = new Date();

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Video marked as completed',
      data: {
        vimeoId,
        chapterId,
        completedVideos: courseProgress.completedVideos,
        completedChapters: courseProgress.completedChapters,
        overallProgress: courseProgress.overallProgress
      }
    });
  } catch (err) {
    console.error('Error marking video as completed:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
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
      // Get quiz progress even when no course progress exists
      const quizProgress = user.quizProgress?.filter(qp => qp.courseId.toString() === courseId) || [];
      
      return res.status(200).json({
        success: true,
        data: {
          courseId,
          completedChapters: [],
          overallProgress: 0,
          totalChapters: course.chapters.length,
          totalVideos: totalVideos,
          quizProgress: quizProgress
        }
      });
    }

    // Get quiz progress for this course
    const quizProgress = user.quizProgress?.filter(qp => qp.courseId.toString() === courseId) || [];

    res.status(200).json({
      success: true,
      data: {
        courseId,
        completedChapters: courseProgress.completedChapters,
        overallProgress: courseProgress.overallProgress,
        totalChapters: course.chapters.length,
        totalVideos: totalVideos,
        lastAccessedAt: courseProgress.lastAccessedAt,
        quizProgress: quizProgress // Include quiz progress for frontend logic
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