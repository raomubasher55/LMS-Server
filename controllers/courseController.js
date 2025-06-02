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

// create courses

exports.createCourse = async (req, res) => {
  try {
    const {
      title,
      slug,
      price,
      discountedPrice,
      category,
      offerType,
      description,
      requirements,
      benefits,
      tags,
      startDate,
      language,
    } = req.body;

    const instructorId = req.user.id;

    // File processing
    const bannerPath = req.files.find(f => f.fieldname === "bannerImage")
      ? saveFiles(req.files.find(f => f.fieldname === "bannerImage"), "banners")[0]
      : "";

          // Process PDF files
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
          await User.findByIdAndUpdate(instructorId, {
            "instructorProfile.certificateFile": certificatePath,
          });
        } else {
          const instructor = await User.findById(instructorId);
          certificatePath = instructor?.instructorProfile?.certificateFile || "";
        }

    // Process chapters

    const chaptersObj = req.body.chapters;

    // Sort the chapters by order and map them to the expected structure
    const chaptersArray = Object.keys(chaptersObj)
      .sort((a, b) => Number(a) - Number(b)) // Ensure correct order
      .map((key) => chaptersObj[key]);

    const chapters = chaptersArray.map((chapter) => {
      const chapterData = {
        title: chapter.title,
        order: Number(chapter.order),
        isLockedUntilQuizPass:
          chapter.isLockedUntilQuizPass === "true" || chapter.isLockedUntilQuizPass === true,
      };

     // If there's a video attached to this chapter
     if (chapter.video?.file) {
      chapterData.video = {
        url: saveFiles(chapter.video.file, "videos")[0], // Save the video file and get the URL
        duration: parseInt(chapter.video.duration, 10) || 0, // Save the duration
        title: chapter.video.title || chapter.video.file.originalname, // Save the title
      };
    }

    return chapterData;
  });

    
    

     // Process tags
     const processedTags = tags
     .split(",")
     .map((tag) => tag.trim())
     .filter((value, index, self) => self.indexOf(value) === index && value !== "");

     const newCourse = new Course({
      instructor: instructorId,
      title,
      slug,
      price,
      discountedPrice,
      category,
      offerType,
      description,
      requirements,
      benefits,
      tags: processedTags,
      startDate,
      language,
      bannerImage: bannerPath,
      pdfFiles: pdfFiles,
      certificateFile: certificatePath,
      chapters: chapters
    });
    await newCourse.save();

    res.status(201).json({
      success: true,
      message: "Course created successfully!",
      courseId: newCourse._id,
    });

    await createNotification({
      title: 'New Course Uploaded',
      type: 'course',
      courseId: newCourse._id,
    });

  } catch (error) {
    console.error("Create course error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

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

    // Find course by ID and populate instructor information
    const getCourse = await Course.findById(courseId).populate({
      path: "instructor",
      select: "firstName lastName profile",
    })
    .populate({
      path: "assignments",
      select: "title", 
    })
    .populate({
      path: "chapters.quiz",
      select: "question options correctAnswer"
    });

    if (!getCourse) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Fetch reviews for the course
    const reviews = await Reviews.find({ course: courseId });

    // Calculate the average rating for the course
    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? reviews.reduce((acc, review) => acc + review.rating, 0) / totalReviews
        : 0;

    // Add instructor full name
    if (getCourse.instructor) {
      getCourse.instructor.Name = `${getCourse.instructor.firstName} ${getCourse.instructor.lastName}`;
    }

    const assignmentTitles = getCourse.assignments.map(a => a.title);

    // Add reviews and rating information to the course response
    const course = {
      ...getCourse.toObject(),
      totalReviews,
      rating: averageRating,
      reviews,
      assignments: assignmentTitles,
    };

    res.status(200).json(course); // Send the updated course data with reviews and rating
  } catch (error) {
    console.error("Error fetching course:", error);
    res.status(500).json({ message: "Server error" });
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
