const Course = require('../models/Course');
const Quiz = require('../models/quiz');
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