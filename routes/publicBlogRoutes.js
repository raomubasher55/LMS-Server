const express = require("express");
const Blog = require("../models/Blog");

const router = express.Router();

// Get all published blogs (public)
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 9, category, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const filter = { status: 'published' };
    if (category && category !== 'all') filter.category = category;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const blogs = await Blog.find(filter)
      .populate('author', 'firstName lastName profile bio skill instructorProfile profile')
      .select('-content') // Exclude full content for listing
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);


    const total = await Blog.countDocuments(filter);

    res.status(200).json({
      success: true,
      blogs,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
      hasMore: page * limit < total
    });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blogs",
      error: error.message
    });
  }
});

// Get single blog by slug (public)
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    
    const blog = await Blog.findOne({ slug, status: 'published' })
      .populate('author', 'firstName lastName profile bio skill instructorProfile');

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found"
      });
    }

    // Increment view count
    await Blog.findByIdAndUpdate(blog._id, { $inc: { views: 1 } });
    res.status(200).json({
      success: true,
      blog
    });
  } catch (error) {
    console.error("Error fetching blog:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blog",
      error: error.message
    });
  }
});

// Get related blogs (public)
router.get("/:category/related", async (req, res) => {
  try {
    const { category } = req.params;
    
    const currentBlog = await Blog.findOne({ category, status: 'published' });
    if (!currentBlog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found"
      });
    }

    // Find related blogs by category or tags
    const relatedBlogs = await Blog.find({
      _id: { $ne: currentBlog._id },
      status: 'published',
      $or: [
        { category: currentBlog.category },
        { tags: { $in: currentBlog.tags } }
      ]
    })
    .populate('author', 'firstName lastName profile skill instructorProfile')
    .select('-content')
    .sort({ createdAt: -1 })
    .limit(4);

    res.status(200).json({
      success: true,
      blogs: relatedBlogs
    });
  } catch (error) {
    console.error("Error fetching related blogs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch related blogs",
      error: error.message
    });
  }
});

// Get blog categories (public) wirg count
router.get("/categories/list", async (req, res) => {
  try {
    const categoriesWithCounts = await Blog.aggregate([
      { $match: { status: 'published' } },
      { $group: { 
        _id: '$category',
        count: { $sum: 1 }
      }},
      { $project: {
        name: '$_id',
        count: 1,
        _id: 0
      }},
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      categories: categoriesWithCounts
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message
    });
  }
});

// category list only
router.get("/categories/lists", async (req, res) => {
  try {
    const categories = await Blog.distinct('category', { status: 'published' });
    
    res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message
    });
  }
});
// Get popular/featured blogs (public)
router.get("/featured/list", async (req, res) => {
  try {
    const featuredBlogs = await Blog.find({ status: 'published' })
      .populate('author', 'firstName lastName profile skill instructorProfile')
      .select('-content')
      .sort({ views: -1 })
      .limit(6);

    res.status(200).json({
      success: true,
      blogs: featuredBlogs
    });
  } catch (error) {
    console.error("Error fetching featured blogs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch featured blogs",
      error: error.message
    });
  }
});

// Get recent blogs (public)
router.get("/recent/list", async (req, res) => {
  try {
    const recentBlogs = await Blog.find({ status: 'published' })
      .populate('author', 'firstName lastName profile skill instructorProfile')
      .select('-content')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      blogs: recentBlogs
    });
  } catch (error) {
    console.error("Error fetching recent blogs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent blogs",
      error: error.message
    });
  }
});

module.exports = router;