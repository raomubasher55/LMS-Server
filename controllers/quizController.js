const Course = require('../models/Course');
const Quiz = require('../models/quiz');
const User = require('../models/User');
const mongoose = require('mongoose');

exports.createQuiz = async (req, res) => {
  const quizzes = req.body;
  const { lectureId, courseId } = req.params;

  // Validate input
  if (!Array.isArray(quizzes)) {
    return res.status(400).json({ message: 'Expected an array of quizzes.' });
  }

  try {
    // Validate each quiz
    for (const quiz of quizzes) {
      if (!quiz.question || !quiz.options || !quiz.correctAnswer || quiz.options.length < 2) {
        return res.status(400).json({
          message: 'Each quiz must include question, options, and correctAnswer with at least 2 options.'
        });
      }
      if (!quiz.options.includes(quiz.correctAnswer)) {
        return res.status(400).json({
          message: `Correct answer must be one of the provided options.`
        });
      }
    }

    // 1. Find the course and verify instructor ownership
    const course = await Course.findOne({
      _id: courseId,
      instructor: req.user.id
    });

    if (!course) {
      return res.status(404).json({
        message: 'Course not found or you are not the instructor.'
      });
    }

    // 2. Find the specific chapter (which acts as lecture in your structure)
    const lectureObjectId = new mongoose.Types.ObjectId(lectureId);
    const targetChapter = course.chapters.find(
      chapter => chapter._id.equals(lectureObjectId)
    );

    if (!targetChapter) {
      return res.status(404).json({
        message: 'Lecture (chapter) not found in this course.'
      });
    }

    // 3. Save quizzes and update course
    const savedQuizzes = await Quiz.insertMany(quizzes);

    // Initialize quiz array if needed
    if (!targetChapter.quiz) {
      targetChapter.quiz = [];
    }

    // Add new quiz IDs
    targetChapter.quiz.push(...savedQuizzes.map(q => q._id));

    await course.save();

    return res.status(201).json({
      success: true,
      message: `Successfully added ${quizzes.length} quiz questions.`,
      data: {
        courseId: course._id,
        lectureId: targetChapter._id,
        quizCount: targetChapter.quiz.length
      }
    });

  } catch (error) {
    console.error('Quiz creation error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error.message
    });
  }
};

exports.getAllAttempts = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find the user and populate course details
    const user = await User.findById(userId)
      .populate({
        path: 'quizProgress.courseId',
        select: 'title thumbnail'
      });

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    // Transform quiz progress data for frontend
    const quizAttempts = [];

    for (const progress of user.quizProgress) {
      // Get course details
      const course = await Course.findById(progress.courseId).select('title thumbnail chapters');
      
      if (!course) continue;

      // Find the chapter details
      const chapter = course.chapters.find(ch => ch._id.equals(progress.chapterId));
      
      if (!chapter) continue;

      // Add each attempt
      for (const attempt of progress.attempts) {
        quizAttempts.push({
          _id: attempt._id,
          courseId: progress.courseId,
          courseName: course.title,
          courseThumbnail: course.thumbnail,
          chapterId: progress.chapterId,
          chapterTitle: chapter.title,
          score: attempt.score,
          passed: attempt.passed,
          answers: attempt.answers,
          attemptedAt: attempt.attemptedAt,
          totalAttempts: progress.totalAttempts,
          bestScore: progress.bestScore
        });
      }
    }

    // Sort by attempt date (newest first)
    quizAttempts.sort((a, b) => new Date(b.attemptedAt) - new Date(a.attemptedAt));

    return res.status(200).json({
      success: true,
      data: quizAttempts,
      totalAttempts: quizAttempts.length
    });

  } catch (error) {
    console.error('Get quiz attempts error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error.message
    });
  }
};

exports.getQuizSummary = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find the user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    // Calculate quiz summary statistics
    let totalQuizzes = 0;
    let totalAttempts = 0;
    let passedQuizzes = 0;
    let totalScore = 0;
    let bestScores = [];

    for (const progress of user.quizProgress) {
      totalQuizzes++;
      totalAttempts += progress.attempts.length;
      
      if (progress.passed) {
        passedQuizzes++;
      }

      // Add best score to array for average calculation
      bestScores.push(progress.bestScore);
      totalScore += progress.bestScore;
    }

    const averageScore = totalQuizzes > 0 ? Math.round(totalScore / totalQuizzes) : 0;
    const passRate = totalQuizzes > 0 ? Math.round((passedQuizzes / totalQuizzes) * 100) : 0;

    const summary = {
      totalQuizzes,
      totalAttempts, 
      passedQuizzes,
      failedQuizzes: totalQuizzes - passedQuizzes,
      averageScore,
      passRate,
      highestScore: bestScores.length > 0 ? Math.max(...bestScores) : 0,
      lowestScore: bestScores.length > 0 ? Math.min(...bestScores) : 0
    };

    return res.status(200).json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Get quiz summary error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error.message
    });
  }
};