const User = require('../models/User');
const Course = require('../models/Course');
const Quiz = require('../models/quiz');

// Submit quiz answers
const submitQuiz = async (req, res) => {
  try {
    const { courseId, chapterId, answers } = req.body;
    const userId = req.user.id;

    if (!courseId || !chapterId || !answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: 'Course ID, Chapter ID, and answers are required'
      });
    }

    // Find user and course
    const user = await User.findById(userId);
    const course = await Course.findById(courseId).populate('chapters.quiz');

    if (!user || !course) {
      return res.status(404).json({
        success: false,
        message: 'User or course not found'
      });
    }

    // Find the chapter
    const chapter = course.chapters.find(ch => ch._id.toString() === chapterId);
    if (!chapter || !chapter.quiz || chapter.quiz.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chapter or quiz not found'
      });
    }

    // Calculate score
    let correctAnswers = 0;
    const quizQuestions = chapter.quiz;
    
    for (let i = 0; i < Math.min(answers.length, quizQuestions.length); i++) {
      if (answers[i] === quizQuestions[i].correctAnswer) {
        correctAnswers++;
      }
    }

    const score = Math.round((correctAnswers / quizQuestions.length) * 100);
    const passed = score >= 70; // 70% passing grade

    // Initialize quiz progress if not exists
    if (!user.quizProgress) {
      user.quizProgress = [];
    }

    // Find or create quiz progress for this chapter
    let quizProgress = user.quizProgress.find(qp => 
      qp.courseId.toString() === courseId && qp.chapterId.toString() === chapterId
    );

    if (!quizProgress) {
      quizProgress = {
        courseId: courseId,
        chapterId: chapterId,
        attempts: [],
        bestScore: score,
        passed: passed,
        lastAttemptAt: new Date()
      };
      user.quizProgress.push(quizProgress);
    } else {
      // Update existing progress
      quizProgress.bestScore = Math.max(quizProgress.bestScore || 0, score);
      quizProgress.passed = quizProgress.passed || passed;
      quizProgress.lastAttemptAt = new Date();
    }

    // Add this attempt
    quizProgress.attempts.push({
      score: score,
      answers: answers,
      attemptedAt: new Date(),
      passed: passed
    });

    // If quiz passed, mark chapter as completed in course progress
    if (passed) {
      if (!user.courseProgress) {
        user.courseProgress = [];
      }

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

      // Recalculate overall progress
      const totalChapters = course.chapters.length;
      const completedChapters = courseProgress.completedChapters.length;
      courseProgress.overallProgress = Math.round((completedChapters / totalChapters) * 100);
      courseProgress.lastAccessedAt = new Date();
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: passed ? 'Quiz passed!' : 'Quiz completed, but not passed',
      data: {
        score: score,
        passed: passed,
        correctAnswers: correctAnswers,
        totalQuestions: quizQuestions.length,
        attempts: quizProgress.attempts.length
      }
    });

  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get quiz status for a chapter
const getQuizStatus = async (req, res) => {
  try {
    const { courseId, chapterId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find quiz progress
    const quizProgress = user.quizProgress?.find(qp => 
      qp.courseId.toString() === courseId && qp.chapterId.toString() === chapterId
    );

    if (!quizProgress) {
      return res.status(200).json({
        success: true,
        completed: false,
        data: {
          attempts: 0,
          bestScore: 0,
          passed: false
        }
      });
    }

    res.status(200).json({
      success: true,
      completed: true,
      data: {
        attempts: quizProgress.attempts.length,
        bestScore: quizProgress.bestScore,
        passed: quizProgress.passed,
        score: quizProgress.bestScore,
        lastAttemptAt: quizProgress.lastAttemptAt
      }
    });

  } catch (error) {
    console.error('Error getting quiz status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all quiz attempts for a user in a course
const getUserQuizAttempts = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find all quiz progress for this course
    const courseQuizProgress = user.quizProgress?.filter(qp => 
      qp.courseId.toString() === courseId
    ) || [];

    res.status(200).json({
      success: true,
      data: courseQuizProgress
    });

  } catch (error) {
    console.error('Error getting quiz attempts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all quiz attempts for a user across all enrolled courses
const getAllUserQuizAttempts = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get all enrolled courses
    const enrolledCourseIds = user.purchasedCourses.map(pc => pc.course);
    
    // Get course details for enrolled courses
    const courses = await Course.find({ _id: { $in: enrolledCourseIds } })
      .select('title instructor chapters')
      .populate('instructor', 'firstName lastName');

    // Get all quiz progress for enrolled courses
    const allQuizProgress = user.quizProgress?.filter(qp => 
      enrolledCourseIds.some(courseId => courseId.toString() === qp.courseId.toString())
    ) || [];

    // Format the data for dashboard display
    const formattedAttempts = [];
    
    for (const quizProgress of allQuizProgress) {
      const course = courses.find(c => c._id.toString() === quizProgress.courseId.toString());
      if (!course) continue;

      const chapter = course.chapters.find(ch => ch._id.toString() === quizProgress.chapterId.toString());
      if (!chapter) continue;

      // Add each attempt
      quizProgress.attempts.forEach((attempt, index) => {
        formattedAttempts.push({
          _id: `${quizProgress.courseId}_${quizProgress.chapterId}_${index}`,
          course: {
            _id: course._id,
            title: course.title,
            instructor: course.instructor
          },
          chapter: {
            _id: chapter._id,
            title: chapter.title
          },
          quiz: {
            title: `${chapter.title} Quiz`,
            totalQuestions: chapter.quiz?.length || 0
          },
          attempt: {
            score: attempt.score,
            passed: attempt.passed,
            attemptedAt: attempt.attemptedAt,
            correctAnswers: Math.round((attempt.score / 100) * (chapter.quiz?.length || 0)),
            totalQuestions: chapter.quiz?.length || 0,
            timeSpent: '15 mins', // Default time
            status: attempt.passed ? 'passed' : 'failed'
          },
          bestScore: quizProgress.bestScore,
          totalAttempts: quizProgress.attempts.length
        });
      });
    }

    // Sort by most recent attempts first
    formattedAttempts.sort((a, b) => new Date(b.attempt.attemptedAt) - new Date(a.attempt.attemptedAt));

    res.status(200).json({
      success: true,
      data: formattedAttempts
    });

  } catch (error) {
    console.error('Error getting all quiz attempts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get quiz summary statistics for a user
const getQuizSummary = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get all enrolled courses
    const enrolledCourseIds = user.purchasedCourses.map(pc => pc.course);
    
    // Get all quiz progress for enrolled courses
    const allQuizProgress = user.quizProgress?.filter(qp => 
      enrolledCourseIds.some(courseId => courseId.toString() === qp.courseId.toString())
    ) || [];

    // Calculate statistics
    const totalQuizzes = allQuizProgress.length;
    const passedQuizzes = allQuizProgress.filter(qp => qp.passed).length;
    const failedQuizzes = totalQuizzes - passedQuizzes;
    const totalAttempts = allQuizProgress.reduce((sum, qp) => sum + qp.attempts.length, 0);
    const averageScore = totalQuizzes > 0 
      ? Math.round(allQuizProgress.reduce((sum, qp) => sum + qp.bestScore, 0) / totalQuizzes)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        totalQuizzes,
        passedQuizzes,
        failedQuizzes,
        totalAttempts,
        averageScore,
        passRate: totalQuizzes > 0 ? Math.round((passedQuizzes / totalQuizzes) * 100) : 0
      }
    });

  } catch (error) {
    console.error('Error getting quiz summary:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  submitQuiz,
  getQuizStatus,
  getUserQuizAttempts,
  getAllUserQuizAttempts,
  getQuizSummary
};