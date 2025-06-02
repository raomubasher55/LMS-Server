const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const Course = require('../models/Course');
const User = require('../models/User');
const { saveFiles } = require('../middleware/multer');
const createNotification = require('../utils/createNotification');

/**
 * Submit an assignment (student)
 */
exports.submitAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.id;
    const { comment } = req.body;

    // Verify the assignment exists
    const assignment = await Assignment.findById(assignmentId).populate('course');
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Verify the student is enrolled in this course
    const student = await User.findById(studentId);
    const isEnrolled = student.purchasedCourses.some(
      pc => pc.course.toString() === assignment.course._id.toString()
    );

    if (!isEnrolled) {
      return res.status(403).json({
        success: false,
        message: 'You are not enrolled in this course'
      });
    }

    // Check if there's an existing submission by this student
    const existingSubmission = await Submission.findOne({
      assignment: assignmentId,
      student: studentId
    });

    // If resubmission, check if it's allowed
    if (existingSubmission) {
      if (existingSubmission.status !== 'resubmit') {
        return res.status(400).json({
          success: false,
          message: 'You have already submitted this assignment'
        });
      }
    }

    // Check for files
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Save the files to disk and get their paths
    const filePaths = saveFiles(req.files, 'assignments/submissions');
    
    // Create file objects for database
    const files = req.files.map((file, index) => ({
      filename: filePaths[index].split('/').pop(),
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: filePaths[index]
    }));

    let submission;
    if (existingSubmission) {
      // Update existing submission
      existingSubmission.files = files;
      existingSubmission.comment = comment;
      existingSubmission.status = 'submitted';
      existingSubmission.submittedAt = new Date();
      submission = await existingSubmission.save();
    } else {
      // Create new submission
      submission = new Submission({
        assignment: assignmentId,
        student: studentId,
        course: assignment.course._id,
        files,
        comment,
        submittedAt: new Date()
      });
      
      submission = await submission.save();

      // Update assignment submission count
      await Assignment.findByIdAndUpdate(
        assignmentId,
        { $inc: { submissionCount: 1 }, $push: { submissions: submission._id } }
      );
    }

    // Create notification for instructor
    await createNotification({
      title: `New submission for assignment: ${assignment.title}`,
      type: 'assignment',
      recipients: [assignment.course.instructor],
      courseId: assignment.course._id,
      assignmentId: assignment._id
    });

    // Return URLs with consistent path structure
    res.status(201).json({
      success: true,
      message: existingSubmission ? 'Assignment resubmitted successfully' : 'Assignment submitted successfully',
      data: {
        ...submission.toObject(),
        files: submission.files.map(file => ({
          ...file,
          url: `${req.protocol}://${req.get('host')}${file.path}`
        }))
      }
    });

  } catch (error) {
    console.error('Error submitting assignment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit assignment'
    });
  }
};

/**
 * Get all submissions for an assignment (instructor only)
 */
exports.getAssignmentSubmissions = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const instructorId = req.user.id;

    // Verify the assignment exists
    const assignment = await Assignment.findById(assignmentId).populate('course');
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Verify the instructor is the owner of this course
    const course = await Course.findOne({
      _id: assignment.course._id,
      instructor: instructorId
    });

    if (!course) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    // Get all submissions for this assignment
    const submissions = await Submission.find({ assignment: assignmentId })
      .populate('student', 'firstName lastName profile username')
      .sort({ submittedAt: -1 });

    // Format the submissions with file URLs
    const formattedSubmissions = submissions.map(sub => ({
      ...sub.toObject(),
      files: sub.files.map(file => ({
        ...file,
        url: `${req.protocol}://${req.get('host')}${file.path}`
      }))
    }));

    res.status(200).json({
      success: true,
      data: formattedSubmissions
    });

  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions'
    });
  }
};

/**
 * Get a specific submission (student or instructor)
 */
exports.getSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Fetch the submission
    const submission = await Submission.findById(submissionId)
      .populate('assignment', 'title description maxPoints dueDate')
      .populate('student', 'firstName lastName profile username')
      .populate('course', 'title instructor');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Access control: only the student who submitted or the instructor can view
    if (
      userRole !== 'admin' &&
      submission.student._id.toString() !== userId &&
      submission.course.instructor.toString() !== userId
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    // Format the submission with file URLs
    const formattedSubmission = {
      ...submission.toObject(),
      files: submission.files.map(file => ({
        ...file,
        url: `${req.protocol}://${req.get('host')}${file.path}`
      }))
    };

    res.status(200).json({
      success: true,
      data: formattedSubmission
    });

  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submission'
    });
  }
};

/**
 * Grade a submission (instructor only)
 */
exports.gradeSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const instructorId = req.user.id;
    const { points, feedback, status } = req.body;

    // Validate input
    if (points === undefined || points === null) {
      return res.status(400).json({
        success: false,
        message: 'Points are required'
      });
    }

    // Fetch the submission
    const submission = await Submission.findById(submissionId)
      .populate({
        path: 'assignment',
        select: 'maxPoints',
        populate: {
          path: 'course',
          select: 'instructor'
        }
      })
      .populate('student', 'firstName lastName');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Verify the instructor is the owner of this course
    if (submission.assignment.course.instructor.toString() !== instructorId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    // Validate points against maxPoints
    if (points > submission.assignment.maxPoints) {
      return res.status(400).json({
        success: false,
        message: `Points cannot exceed maximum of ${submission.assignment.maxPoints}`
      });
    }

    // Update the submission
    submission.grade = {
      points,
      feedback: feedback || '',
      gradedBy: instructorId,
      gradedAt: new Date()
    };
    
    // Update status (default to 'graded' if not provided)
    submission.status = status || 'graded';
    
    await submission.save();

    // Create notification for student
    await createNotification({
      title: `Your assignment has been graded`,
      message: `You received ${points}/${submission.assignment.maxPoints} points for "${submission.assignment.title}"`,
      type: 'grade',
      recipients: [submission.student._id],
      assignmentId: submission.assignment._id,
      submissionId: submission._id
    });

    res.status(200).json({
      success: true,
      message: 'Submission graded successfully',
      data: submission
    });

  } catch (error) {
    console.error('Error grading submission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to grade submission'
    });
  }
};

/**
 * Get a student's submissions for a course
 */
exports.getStudentCourseSubmissions = async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user.id;

    // Verify the student is enrolled in this course
    const student = await User.findById(studentId);
    const isEnrolled = student.purchasedCourses.some(
      pc => pc.course.toString() === courseId
    );

    if (!isEnrolled) {
      return res.status(403).json({
        success: false,
        message: 'You are not enrolled in this course'
      });
    }

    // Get all assignments for this course
    const assignments = await Assignment.find({ course: courseId })
      .select('_id title dueDate maxPoints');

    // Get all submissions by this student for these assignments
    const submissions = await Submission.find({
      course: courseId,
      student: studentId
    }).select('assignment status grade submittedAt');

    // Match submissions with assignments
    const results = assignments.map(assignment => {
      const submission = submissions.find(
        sub => sub.assignment.toString() === assignment._id.toString()
      );

      return {
        assignment: {
          _id: assignment._id,
          title: assignment.title,
          dueDate: assignment.dueDate,
          maxPoints: assignment.maxPoints
        },
        submission: submission ? {
          _id: submission._id,
          status: submission.status,
          grade: submission.grade,
          submittedAt: submission.submittedAt
        } : null
      };
    });

    res.status(200).json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Error fetching student submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions'
    });
  }
};

/**
 * Get all assignments and submissions for a student across all enrolled courses
 */
exports.getAllStudentSubmissions = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Get student with enrolled courses
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get all enrolled course IDs
    const enrolledCourseIds = student.purchasedCourses.map(pc => pc.course);

    // Get all assignments for enrolled courses
    const assignments = await Assignment.find({ course: { $in: enrolledCourseIds } })
      .populate('course', 'title instructor')
      .populate('course.instructor', 'firstName lastName')
      .select('_id title description dueDate maxPoints course submissionCount')
      .sort({ createdAt: -1 });

    // Get all submissions by this student for these courses
    const submissions = await Submission.find({
      course: { $in: enrolledCourseIds },
      student: studentId
    })
      .populate('assignment', 'title maxPoints')
      .populate('course', 'title')
      .select('assignment course status grade submittedAt files')
      .sort({ submittedAt: -1 });

    // Format the data for dashboard display
    const formattedAssignments = assignments.map(assignment => {
      const submission = submissions.find(
        sub => sub.assignment._id.toString() === assignment._id.toString()
      );

      return {
        _id: assignment._id,
        assignment: {
          title: assignment.title,
          description: assignment.description,
          dueDate: assignment.dueDate,
          maxPoints: assignment.maxPoints,
          totalMarks: assignment.maxPoints
        },
        course: {
          _id: assignment.course._id,
          title: assignment.course.title,
          instructor: assignment.course.instructor
        },
        submission: submission ? {
          _id: submission._id,
          status: submission.status,
          grade: submission.grade,
          submittedAt: submission.submittedAt,
          hasFiles: submission.files && submission.files.length > 0,
          downloadAvailable: true
        } : null,
        status: submission?.status || 'not_submitted',
        submissionCount: 1, // Number of submissions allowed
        submittedFiles: submission?.files?.length || 0,
        downloadUrl: submission ? `/api/submissions/${submission._id}` : null
      };
    });

    res.status(200).json({
      success: true,
      data: formattedAssignments
    });

  } catch (error) {
    console.error('Error fetching all student submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions'
    });
  }
};

/**
 * Get assignment submission summary statistics for a student
 */
exports.getSubmissionSummary = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Get student with enrolled courses
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get all enrolled course IDs
    const enrolledCourseIds = student.purchasedCourses.map(pc => pc.course);

    // Get all assignments for enrolled courses
    const totalAssignments = await Assignment.countDocuments({ 
      course: { $in: enrolledCourseIds } 
    });

    // Get all submissions by this student
    const submissions = await Submission.find({
      course: { $in: enrolledCourseIds },
      student: studentId
    }).select('status grade');

    // Calculate statistics
    const submittedAssignments = submissions.length;
    const pendingAssignments = totalAssignments - submittedAssignments;
    const gradedAssignments = submissions.filter(sub => sub.grade && sub.grade.points !== undefined).length;
    const ungradedAssignments = submittedAssignments - gradedAssignments;

    // Calculate average grade
    const gradedSubmissions = submissions.filter(sub => sub.grade && sub.grade.points !== undefined);
    const averageGrade = gradedSubmissions.length > 0
      ? Math.round(gradedSubmissions.reduce((sum, sub) => sum + sub.grade.points, 0) / gradedSubmissions.length)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        totalAssignments,
        submittedAssignments,
        pendingAssignments,
        gradedAssignments,
        ungradedAssignments,
        averageGrade,
        submissionRate: totalAssignments > 0 ? Math.round((submittedAssignments / totalAssignments) * 100) : 0
      }
    });

  } catch (error) {
    console.error('Error fetching submission summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submission summary'
    });
  }
};