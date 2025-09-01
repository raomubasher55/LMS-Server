const Course = require("../models/Course");
const User = require("../models/User");
const path = require("path");
const fs = require("fs");
const Reviews = require("../models/Review");
const createNotification = require('../utils/createNotification');

// utility to save uploaded files
const saveFiles = (filesArray, folderName) => {
  if (!Array.isArray(filesArray)) {
    filesArray = [filesArray];
  }

  return filesArray.map((file) => {
    const filename = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
    const uploadPath = path.join("public", "uploads", folderName);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    const filepath = path.join(uploadPath, filename);
    fs.writeFileSync(filepath, file.buffer);
    return `/uploads/${folderName}/${filename}`;
  });
};


function parseFormData(body) {
  // Case 1: If chapters is already an array in body
  if (Array.isArray(body.chapters)) {
    return body.chapters;
  }

  // Case 2: If chapters come as flat form data
  const chapters = [];
  const chapterKeys = Object.keys(body).filter(key => key.startsWith('chapters['));

  // Find all chapter indices
  const chapterIndices = new Set();
  chapterKeys.forEach(key => {
    const match = key.match(/chapters\[(\d+)\]/);
    if (match) chapterIndices.add(parseInt(match[1]));
  });
  // If no indices found but chapters exist, try direct access
  if (chapterIndices.size === 0 && body['chapters[0][title]']) {
    chapterIndices.add(0);
  }

  // Process each chapter
  chapterIndices.forEach(index => {
    const chapter = {
      title: body[`chapters[${index}][title]`] || `Chapter ${index + 1}`,
      order: parseInt(body[`chapters[${index}][order]`]) || index + 1,
      isLockedUntilQuizPass: body[`chapters[${index}][isLockedUntilQuizPass]`] === 'true',
      lessons: []
    };

    // Process lessons
    const lessonKeys = Object.keys(body).filter(key => 
      key.startsWith(`chapters[${index}][lessons]`));
    
    const lessonIndices = new Set();
    lessonKeys.forEach(key => {
      const match = key.match(new RegExp(`chapters\\[${index}\\]\\[lessons\\]\\[(\\d+)\\]`));
      if (match) lessonIndices.add(parseInt(match[1]));
    });

    lessonIndices.forEach(lessonIndex => {
      const lesson = {
        title: body[`chapters[${index}][lessons][${lessonIndex}][title]`] || `Lesson ${lessonIndex + 1}`,
        order: parseInt(body[`chapters[${index}][lessons][${lessonIndex}][order]`]) || lessonIndex + 1
      };

      // Process video
      const videoUrl = body[`chapters[${index}][lessons][${lessonIndex}][video][url]`];
      if (videoUrl) {
        const vimeoId = extractVimeoId(videoUrl);
        lesson.video = {
          url: videoUrl,
          vimeoId,
          duration: parseInt(body[`chapters[${index}][lessons][${lessonIndex}][video][duration]`]) || 0,
          title: body[`chapters[${index}][lessons][${lessonIndex}][video][title]`] || "Lesson Video",
          embedCode: generateVimeoEmbed(vimeoId)
        };
      }

      chapter.lessons.push(lesson);
    });

    chapters[index] = chapter;
  });

  return chapters.filter(Boolean);
}

// create courses

exports.createCourse = async (req, res) => {
  try {
    const chapters = parseFormData(req.body);

    // Validate required fields
    const requiredFields = ['title', 'slug', 'price', 'description'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate chapters
    if (!chapters || chapters.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one chapter with lessons is required"
      });
    }

    // Process files
    const bannerPath = req.files.find(f => f.fieldname === "bannerImage")
      ? saveFiles(req.files.find(f => f.fieldname === "bannerImage"), "banners")[0]
      : "";

    const pdfFiles = req.files.filter(f => f.fieldname === "pdfFiles")
      .map((file) => ({
        url: saveFiles(file, "pdfs")[0],
        title: file.originalname,
      }));

    // Process certificate file
    let certificatePath = "";
    const certificateFile = req.files.find(f => f.fieldname === "certificateFile");
    if (certificateFile) {
      certificatePath = saveFiles(certificateFile, "certificates")[0];
      await User.findByIdAndUpdate(req.user.id, {
        "instructorProfile.certificateFile": certificatePath,
      });
    }

    // Use the parsed chapters instead of req.body.chapters
    const processedChapters = chapters.map((chapter, chapterIndex) => {
      return {
        title: chapter.title,
        order: Number(chapter.order) || chapterIndex + 1,
        isLockedUntilQuizPass: chapter.isLockedUntilQuizPass === 'true',
        lessons: chapter.lessons.map((lesson, lessonIndex) => {
          const lessonData = {
            title: lesson.title || `Lesson ${lessonIndex + 1}`,
            order: Number(lesson.order) || lessonIndex + 1
          };

          if (lesson.video?.url) {
            const vimeoId = extractVimeoId(lesson.video.url);
            if (!vimeoId) {
              throw new Error(`Invalid Vimeo URL in Chapter ${chapterIndex+1} Lesson ${lessonIndex+1}`);
            }

            lessonData.video = {
              url: lesson.video.url,
              vimeoId,
              duration: parseInt(lesson.video.duration) || 0,
              title: lesson.video.title || "Lesson Video",
              embedCode: generateVimeoEmbed(vimeoId)
            };
          }

          return lessonData;
        })
      };
    });


    // Create and save course
    const newCourse = await Course.create({
      instructor: req.user.id,
      ...req.body,
      bannerImage: bannerPath,
      pdfFiles,
      certificateFile: certificatePath,
      chapters: processedChapters,
      tags: req.body.tags 
        ? req.body.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        : []
    });

    // Send response
    res.status(201).json({
      success: true,
      message: "Course created successfully!",
      courseId: newCourse._id,
    });

    // Send notification
    await createNotification({
      title: 'New Course Uploaded',
      type: 'course',
      courseId: newCourse._id,
    });

  } catch (error) {
    console.error("Create course error:", error);
    const statusCode = error.name === 'ValidationError' ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

// Helper functions
function extractVimeoId(url) {
  if (!url) return null;
  const regExp = /(?:vimeo\.com\/|video\/)(\d+)/i;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

function generateVimeoEmbed(vimeoId) {
  return `<div style="padding:56.25% 0 0 0;position:relative;">
    <iframe src="https://player.vimeo.com/video/${vimeoId}" 
      frameborder="0" 
      allow="autoplay; fullscreen" 
      style="position:absolute;top:0;left:0;width:100%;height:100%;">
    </iframe>
  </div>`;
}

// get instructor courses

exports.getInstructorCourses = async (req, res) => {
  try {
    const instructorId = req.user.id;

    // Fetch courses by instructor
    const allCourses = await Course.find({ instructor: instructorId }).sort({
      createdAt: -1,
    });

    const courses = await Promise.all(
      allCourses.map(async (course) => {
        // Find reviews for the course
        const reviews = await Reviews.find({ course: course._id });

        // Calculate average rating for the course
        const totalReviews = reviews.length;
        const averageRating =
          totalReviews > 0
            ? reviews.reduce((acc, review) => acc + review.rating, 0) /
              totalReviews
            : 0;

        return {
          ...course.toObject(),
          totalReviews,
          rating: averageRating,
          reviews,
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Instructor courses fetched successfully",
      data: courses, // Send courses with reviews and rating
      instructor: {
        name: req.user.name,
        profile: req.user.profile,
        id: req.user.id,
      },
    });
  } catch (error) {
    console.error("Get instructor courses error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get single course by ID


exports.getCourseById = async (req, res) => {
  try {
    const courseId = req.params.id;

    // Validate courseId
    if (!courseId || courseId === 'undefined' || courseId === 'null') {
      return res.status(400).json({ 
        success: false,
        message: "Invalid course ID provided" 
      });
    }

    // Find course by ID with deep population
    const getCourse = await Course.findById(courseId)
      .populate({
        path: "instructor",
        select: "firstName lastName profile",
      })
      .populate({
        path: "assignments",
        select: "title", 
      })
      .populate({
        path: "chapters.lessons.quiz",
        select: "question options correctAnswer timeLimit"
      });

    if (!getCourse) {
      return res.status(404).json({ 
        success: false,
        message: "Course not found" 
      });
    }

    // Fetch reviews for the course
    const reviews = await Reviews.find({ course: courseId })
      .populate('user', 'firstName lastName profile');

    // Calculate the average rating for the course
    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
      ? reviews.reduce((acc, review) => acc + review.rating, 0) / totalReviews
      : 0;

    // Format the response according to schema
    const formattedCourse = {
      ...getCourse.toObject(),
      instructor: getCourse.instructor ? {
        ...getCourse.instructor.toObject(),
        fullName: `${getCourse.instructor.firstName} ${getCourse.instructor.lastName}`
      } : null,
      assignments: getCourse.assignments.map(a => ({
        id: a._id,
        title: a.title
      })),
      chapters: getCourse.chapters.map(chapter => ({
        ...chapter.toObject(),
        lessons: chapter.lessons.map(lesson => ({
          ...lesson.toObject(),
          quiz: lesson.quiz ? {
            id: lesson.quiz._id,
            question: lesson.quiz.question,
            options: lesson.quiz.options,
            correctAnswer: lesson.quiz.correctAnswer,
            timeLimit: lesson.quiz.timeLimit
          } : null
        }))
      })),
      reviews: {
        total: totalReviews,
        averageRating: parseFloat(averageRating.toFixed(1)),
        details: reviews.map(review => ({
          ...review.toObject(),
          user: review.user ? {
            id: review.user._id,
            name: `${review.user.firstName} ${review.user.lastName}`,
            profile: review.user.profile
          } : null
        }))
      },
      totalDuration: getCourse.totalDuration,
      enrollmentCount: getCourse.enrollmentCount
    };

    res.status(200).json({
      success: true,
      course: formattedCourse
    });

  } catch (error) {
    console.error("Error fetching course:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error",
      error: error.message 
    });
  }
};

// get instructor more courses

exports.getInstructorCoursesById = async (req, res) => {
  const { instructorId } = req.params;

  try {
    const courses = await Course.find({ instructor: instructorId }).populate(
      "instructor",
      "firstName lastName profile"
    );

    if (!courses || courses.length === 0) {
      return res
        .status(404)
        .json({ message: "No courses found for this instructor." });
    }

    // Adding total reviews count and average rating for each course
    const coursesWithReviews = await Promise.all(
      courses.map(async (course) => {
        const totalReviews = await Reviews.countDocuments({
          course: course._id,
        });
        const averageRating =
          totalReviews > 0
            ? await Reviews.aggregate([
                { $match: { course: course._id } },
                { $group: { _id: null, avgRating: { $avg: "$rating" } } },
              ])
            : 0;

        return {
          ...course.toObject(),
          totalReviews,
          rating: averageRating[0]?.avgRating || 0, // Add average rating
        };
      })
    );

    const instructorData = courses[0].instructor;

    return res.status(200).json({
      data: coursesWithReviews,
      instructor: {
        name: `${instructorData.firstName} ${instructorData.lastName}`,
        profile: instructorData.profile,
        id: instructorData._id,
      },
    });
  } catch (error) {
    console.error("Error fetching instructor courses:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// get all courses

exports.getAllCourses = async (req, res) => {
  try {
    const filter = {};

    const {
      category,
      offerType,
      language,
      status,
      minPrice,
      maxPrice,
      search,
      minRating,
    } = req.query;

    // Apply filters
    if (category) filter.category = category;
    if (offerType) filter.offerType = offerType;
    if (language) filter.language = language;
    if (status) filter.status = status;

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    // Non-admins only see published courses
    if (!req.user?.isAdmin) {
      filter.status = 'published';
    }

    // Get base courses
    const courses = await Course.find(filter)
      .populate("instructor", "firstName lastName email profile")
      .select("-sections -videoFiles -pdfFiles")
      .sort({ createdAt: -1 });

    // Add reviews data to each course
    const coursesWithReviews = await Promise.all(
      courses.map(async (course) => {
        // Get reviews for this course
        const reviews = await Reviews.find({ course: course._id })
          .select("-__v -course")
          .sort({ createdAt: -1 });

        // Calculate average rating
        const ratingAggregation = await Reviews.aggregate([
          { $match: { course: course._id } },
          { $group: { _id: null, avgRating: { $avg: "$rating" } } },
        ]);

        const averageRating = ratingAggregation[0]?.avgRating || 0;
        const totalReviews = reviews.length;

        // Filter by minRating if provided
        if (minRating && averageRating < Number(minRating)) {
          return null;
        }

        return {
          ...course.toObject(),
          reviews,
          rating: parseFloat(averageRating.toFixed(1)),
          totalReviews,
        };
      })
    );

    const filteredCourses = coursesWithReviews.filter(
      (course) => course !== null
    );

    res.status(200).json({
      success: true,
      count: filteredCourses.length,
      data: filteredCourses,
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching courses",
      error: error.message,
    });
  }
};


// update course status 

// Assuming you have a controller file for handling course updates
exports.updateCourseStatus = async (req, res) => {
  try {
    const { status } = req.body; 
    const { courseId } = req.params; 

    if (!status || !["pending", "published", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    // Find the course and update its status
    const updatedCourse = await Course.findByIdAndUpdate(
      courseId,
      { status },
      { new: true } 
    );

    if (!updatedCourse) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    res.status(200).json({ success: true, message: "Course status updated", data: updatedCourse });
  } catch (error) {
    console.error("Error updating course status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.getAllCourses2 = async (req, res) => {
  try {
    const filter = {};
    const {
      category,
      offerType,
      language,
      status,
      minPrice,
      maxPrice,
      search,
      minRating,
    } = req.query;

    // Apply filters
    if (category) filter.category = category;
    if (offerType) filter.offerType = offerType;
    if (language) filter.language = language;
    if (status) filter.status = status;

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    if (!req.user?.isAdmin) {
      filter.status = 'published';
    }

    // Optimized query with single aggregation
    const aggregationPipeline = [
      { $match: filter },
      {
        $lookup: {
          from: "reviews",
          localField: "_id",
          foreignField: "course",
          as: "reviews"
        }
      },
      {
        $addFields: {
          rating: { $avg: "$reviews.rating" },
          totalReviews: { $size: "$reviews" }
        }
      },
      { $unset: "reviews" },
      { $sort: { createdAt: -1 } }
    ];

    // Apply minRating filter if provided
    if (minRating) {
      aggregationPipeline.splice(2, 0, {
        $match: { rating: { $gte: Number(minRating) } }
      });
    }

    const courses = await Course.aggregate(aggregationPipeline)
      .lookup({
        from: "users",
        localField: "instructor",
        foreignField: "_id",
        as: "instructor"
      })
      .unwind("instructor")
      .project({
        sections: 0,
        videoFiles: 0,
        pdfFiles: 0,
        "instructor.password": 0
      });

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching courses",
      error: error.message,
    });
  }
};
