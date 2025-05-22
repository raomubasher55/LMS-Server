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
    const passed = score >= 60; // 60% passing grade

    // Initialize quiz progress if not exists
    if (!user.quizProgress) {
      user.quizProgress = [];
    }

    // Find or create quiz progress for this chapter
    let quizProgressIndex = user.quizProgress.findIndex(qp => 
      qp.courseId.toString() === courseId && qp.chapterId.toString() === chapterId
    );

    if (quizProgressIndex === -1) {
      // Create new quiz progress
      const newQuizProgress = {
        courseId: courseId,
        chapterId: chapterId,
        attempts: [{
          score: score,
          answers: answers,
          attemptedAt: new Date(),
          passed: passed
        }],
        bestScore: score,
        passed: passed,
        lastAttemptAt: new Date(),
        totalAttempts: 1,
        nextAttemptAllowedAt: null,
        mustReWatchVideo: false,
        videoReWatchedAt: null,
        instructorApprovalRequired: false,
        instructorApprovalGranted: false
      };
      user.quizProgress.push(newQuizProgress);
      quizProgressIndex = user.quizProgress.length - 1;
    } else {
      // Update existing progress
      const existingProgress = user.quizProgress[quizProgressIndex];
      existingProgress.bestScore = Math.max(existingProgress.bestScore || 0, score);
      existingProgress.passed = existingProgress.passed || passed;
      existingProgress.lastAttemptAt = new Date();
      
      // Add this attempt
      existingProgress.attempts.push({
        score: score,
        answers: answers,
        attemptedAt: new Date(),
        passed: passed
      });
      
      // Update totalAttempts to match actual attempts array length
      existingProgress.totalAttempts = existingProgress.attempts.length;
    }

    // Get reference to the quiz progress for restrictions logic
    const quizProgress = user.quizProgress[quizProgressIndex];

    // Apply restrictions if quiz failed
    if (!passed) {
      const totalAttempts = quizProgress.totalAttempts;
      const now = new Date();

      if (totalAttempts >= 4) {
        // 4+ attempts: 24-hour waiting period
        quizProgress.nextAttemptAllowedAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
      }
    } else {
      // If passed, reset all restrictions
      quizProgress.nextAttemptAllowedAt = null;
    }

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
      score: score, // Add score at top level for easier access
      passed: passed,
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
      completed: quizProgress.attempts && quizProgress.attempts.length > 0, // Only completed if there are actual attempts
      score: quizProgress.bestScore, // Add score at top level for easier access
      data: {
        attempts: quizProgress.attempts.length,
        bestScore: quizProgress.bestScore,
        passed: quizProgress.passed,
        score: quizProgress.bestScore,
        lastAttemptAt: quizProgress.lastAttemptAt,
        totalAttempts: quizProgress.totalAttempts || 0
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

// Check if quiz attempt is allowed (handles progressive restrictions)
const checkQuizAttemptAllowed = async (req, res) => {
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

    // Find quiz progress for this chapter
    const quizProgress = user.quizProgress.find(qp => 
      qp.courseId.toString() === courseId && qp.chapterId.toString() === chapterId
    );

    const now = new Date();
    const result = {
      allowed: true,
      reason: null,
      restrictions: {
        totalAttempts: 0,
        nextAttemptAllowedAt: null,
        mustReWatchVideo: false,
        instructorApprovalRequired: false,
        timeRemaining: 0
      }
    };

    if (quizProgress) {
      result.restrictions.totalAttempts = quizProgress.totalAttempts || 0;

      // Check time-based restrictions
      if (quizProgress.nextAttemptAllowedAt && now < quizProgress.nextAttemptAllowedAt) {
        result.allowed = false;
        result.reason = 'time_restriction';
        result.restrictions.nextAttemptAllowedAt = quizProgress.nextAttemptAllowedAt;
        result.restrictions.timeRemaining = Math.ceil((quizProgress.nextAttemptAllowedAt - now) / (1000 * 60 * 60)); // hours
      }
    }

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error checking quiz attempt:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


// ========== INSTRUCTOR DASHBOARD ENDPOINTS ==========


// Get comprehensive quiz analytics for instructor's courses
const getInstructorQuizAnalytics = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { courseId } = req.query;
    
    // Get all courses taught by this instructor
    const Course = require('../models/Course');
    let courseQuery = { instructor: instructorId };
    if (courseId) {
      courseQuery._id = courseId;
    }
    
    const instructorCourses = await Course.find(courseQuery).select('_id title chapters');
    const courseIds = instructorCourses.map(course => course._id);

    // Get all users with quiz progress in these courses
    const usersWithProgress = await User.find({
      'quizProgress.courseId': { $in: courseIds }
    }).select('quizProgress courseProgress');

    const analytics = {
      courseOverview: [],
      restrictionStats: {
        studentsInTimeRestriction: 0,
        totalStudentsWithRestrictions: 0
      },
      performanceMetrics: {
        averagePassRate: 0,
        averageScore: 0,
        totalQuizAttempts: 0,
        totalStudents: 0
      }
    };

    let totalPassedQuizzes = 0;
    let totalQuizzes = 0;
    let totalScores = 0;
    let totalAttempts = 0;
    let allStudentIds = new Set();

    // Process each course
    for (const course of instructorCourses) {
      const courseProgress = {
        courseId: course._id,
        courseName: course.title,
        totalChapters: course.chapters?.length || 0,
        studentsEnrolled: 0,
        completionStats: {
          quizzesPassed: 0,
          quizzesAttempted: 0,
          averageScore: 0,
          passRate: 0
        },
        chapterAnalytics: []
      };

      const courseQuizProgress = [];
      
      // Collect all quiz progress for this course
      for (const user of usersWithProgress) {
        const userCourseProgress = user.quizProgress.filter(qp => 
          qp.courseId.toString() === course._id.toString()
        );
        
        if (userCourseProgress.length > 0) {
          allStudentIds.add(user._id.toString());
          courseProgress.studentsEnrolled++;
          courseQuizProgress.push(...userCourseProgress);
        }
      }

      // Calculate course statistics
      const passedQuizzes = courseQuizProgress.filter(qp => qp.passed).length;
      const attemptedQuizzes = courseQuizProgress.length;
      const courseScores = courseQuizProgress.map(qp => qp.bestScore || 0);
      const courseAttempts = courseQuizProgress.reduce((sum, qp) => sum + (qp.attempts?.length || 0), 0);

      courseProgress.completionStats.quizzesPassed = passedQuizzes;
      courseProgress.completionStats.quizzesAttempted = attemptedQuizzes;
      courseProgress.completionStats.averageScore = courseScores.length > 0 
        ? Math.round(courseScores.reduce((sum, score) => sum + score, 0) / courseScores.length) 
        : 0;
      courseProgress.completionStats.passRate = attemptedQuizzes > 0 
        ? Math.round((passedQuizzes / attemptedQuizzes) * 100) 
        : 0;

      // Update global stats
      totalPassedQuizzes += passedQuizzes;
      totalQuizzes += attemptedQuizzes;
      totalScores += courseScores.reduce((sum, score) => sum + score, 0);
      totalAttempts += courseAttempts;

      analytics.courseOverview.push(courseProgress);
    }

    // Calculate restriction statistics
    for (const user of usersWithProgress) {
      const userQuizProgress = user.quizProgress.filter(qp => 
        courseIds.some(courseId => courseId.toString() === qp.courseId.toString())
      );

      for (const progress of userQuizProgress) {
        const now = new Date();
        
        if (progress.nextAttemptAllowedAt && progress.nextAttemptAllowedAt > now) {
          analytics.restrictionStats.studentsInTimeRestriction++;
        }
        
        
      }
    }

    analytics.restrictionStats.totalStudentsWithRestrictions = 
      analytics.restrictionStats.studentsInTimeRestriction;

    // Calculate performance metrics
    analytics.performanceMetrics.totalStudents = allStudentIds.size;
    analytics.performanceMetrics.averagePassRate = totalQuizzes > 0 
      ? Math.round((totalPassedQuizzes / totalQuizzes) * 100) 
      : 0;
    analytics.performanceMetrics.averageScore = totalQuizzes > 0 
      ? Math.round(totalScores / totalQuizzes) 
      : 0;
    analytics.performanceMetrics.totalQuizAttempts = totalAttempts;

    res.status(200).json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Error getting instructor quiz analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get detailed student progress for instructor's courses
const getInstructorStudentProgress = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { courseId, studentId } = req.query;
    
    // Get all courses taught by this instructor
    const Course = require('../models/Course');
    let courseQuery = { instructor: instructorId };
    if (courseId) {
      courseQuery._id = courseId;
    }
    
    const instructorCourses = await Course.find(courseQuery).select('_id title chapters');
    const courseIds = instructorCourses.map(course => course._id);

    // Build user query
    let userQuery = {
      'quizProgress.courseId': { $in: courseIds }
    };
    if (studentId) {
      userQuery._id = studentId;
    }

    // Get students with progress in these courses
    const studentsWithProgress = await User.find(userQuery)
      .select('firstName lastName name email quizProgress courseProgress')
      .populate('quizProgress.courseId', 'title');

    const studentProgressData = [];

    for (const student of studentsWithProgress) {
      const studentData = {
        studentId: student._id,
        studentName: student.name || `${student.firstName} ${student.lastName}`.trim(),
        studentEmail: student.email,
        courses: []
      };

      // Process each instructor course
      for (const course of instructorCourses) {
        const courseProgressData = {
          courseId: course._id,
          courseName: course.title,
          totalChapters: course.chapters?.length || 0,
          quizProgress: [],
          overallProgress: 0,
          restrictionStatus: {
            hasTimeRestriction: false,
            needsVideoRewatch: false,
            needsInstructorApproval: false,
            nextAttemptAllowed: null
          }
        };

        // Get quiz progress for this course
        // Handle both populated and non-populated courseId
        const courseQuizProgress = student.quizProgress.filter(qp => {
          const qpCourseId = qp.courseId._id ? qp.courseId._id.toString() : qp.courseId.toString();
          return qpCourseId === course._id.toString();
        });

        // Get overall course progress
        const courseProgress = student.courseProgress?.find(cp => {
          const cpCourseId = cp.courseId._id ? cp.courseId._id.toString() : cp.courseId.toString();
          return cpCourseId === course._id.toString();
        });
        
        if (courseProgress) {
          courseProgressData.overallProgress = courseProgress.overallProgress || 0;
        }

        // Process quiz progress for each chapter
        for (const quizProgress of courseQuizProgress) {
          const now = new Date();
          
          const chapterQuizData = {
            chapterId: quizProgress.chapterId,
            attempts: quizProgress.attempts || [], // Include full attempts array
            attemptsCount: quizProgress.attempts?.length || 0,
            bestScore: quizProgress.bestScore || 0,
            passed: quizProgress.passed || false,
            lastAttemptAt: quizProgress.lastAttemptAt,
            totalAttempts: quizProgress.totalAttempts || 0,
            restrictionStatus: {
              timeRestricted: false,
              videoReWatchRequired: false,
              instructorApprovalRequired: false,
              nextAttemptAllowedAt: null
            }
          };

          // Check restrictions
          if (quizProgress.nextAttemptAllowedAt && quizProgress.nextAttemptAllowedAt > now) {
            chapterQuizData.restrictionStatus.timeRestricted = true;
            chapterQuizData.restrictionStatus.nextAttemptAllowedAt = quizProgress.nextAttemptAllowedAt;
            courseProgressData.restrictionStatus.hasTimeRestriction = true;
            courseProgressData.restrictionStatus.nextAttemptAllowed = quizProgress.nextAttemptAllowedAt;
          }



          courseProgressData.quizProgress.push(chapterQuizData);
        }

        if (courseQuizProgress.length > 0) {
          studentData.courses.push(courseProgressData);
        }
      }

      if (studentData.courses.length > 0) {
        studentProgressData.push(studentData);
      }
    }

    res.status(200).json({
      success: true,
      data: studentProgressData,
      total: studentProgressData.length
    });

  } catch (error) {
    console.error('Error getting instructor student progress:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


// Bulk action: Reset student quiz progress
const resetStudentQuizProgress = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { studentId, courseId, chapterId } = req.body;

    if (!studentId || !courseId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID and Course ID are required'
      });
    }

    // Verify instructor owns this course
    const Course = require('../models/Course');
    const course = await Course.findOne({ _id: courseId, instructor: instructorId });
    if (!course) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to modify this course'
      });
    }

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Reset quiz progress
    if (chapterId) {
      // Reset specific chapter
      const progressIndex = student.quizProgress.findIndex(qp => 
        qp.courseId.toString() === courseId && qp.chapterId.toString() === chapterId
      );
      
      if (progressIndex > -1) {
        student.quizProgress.splice(progressIndex, 1);
      }
    } else {
      // Reset entire course
      student.quizProgress = student.quizProgress.filter(qp => 
        qp.courseId.toString() !== courseId
      );
    }

    await student.save();

    res.status(200).json({
      success: true,
      message: chapterId 
        ? 'Chapter quiz progress reset successfully' 
        : 'Course quiz progress reset successfully'
    });

  } catch (error) {
    console.error('Error resetting student quiz progress:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// One-time migration function to fix existing quiz progress data
const migrateQuizProgressData = async (req, res) => {
  try {
    console.log('Starting quiz progress data migration...');
    
    const users = await User.find({
      'quizProgress': { $exists: true, $not: { $size: 0 } }
    });

    let migratedCount = 0;
    
    for (const user of users) {
      let hasChanges = false;
      
      for (const qp of user.quizProgress) {
        // Fix totalAttempts to match actual attempts array length
        const actualAttempts = qp.attempts.length;
        if (qp.totalAttempts !== actualAttempts) {
          qp.totalAttempts = actualAttempts;
          hasChanges = true;
        }
        
      }
      
      if (hasChanges) {
        await user.save();
        migratedCount++;
      }
    }
    
    console.log(`Migration completed. Updated ${migratedCount} users.`);
    
    res.status(200).json({
      success: true,
      message: `Migration completed successfully. Updated ${migratedCount} users.`,
      migratedUsers: migratedCount
    });
    
  } catch (error) {
    console.error('Error during migration:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  }
};

module.exports = {
  submitQuiz,
  getQuizStatus,
  getUserQuizAttempts,
  getAllUserQuizAttempts,
  getQuizSummary,
  checkQuizAttemptAllowed,
  // Instructor Dashboard endpoints
  getInstructorQuizAnalytics,
  getInstructorStudentProgress,
  resetStudentQuizProgress,
  // Migration
  migrateQuizProgressData
};