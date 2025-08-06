const Blog = require("../models/Blog");
const User = require("../models/User");
const path = require("path");
const fs = require("fs");

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

// Create blog post
exports.createBlog = async (req, res) => {
  try {
    const {
      title,
      content,
      excerpt,
      category,
      tags,
      status,
      metaTitle,
      metaDescription,
      isCommentEnabled
    } = req.body;

    const authorId = req.user.id;

    console.log("The authoer id is " , authorId);

    // Process featured image if uploaded
    const featuredImagePath = req.files && req.files.find(f => f.fieldname === "featuredImage")
      ? saveFiles(req.files.find(f => f.fieldname === "featuredImage"), "blog-images")[0]
      : "";

    const blog = new Blog({
      author: authorId,
      title,
      content,
      excerpt,
      category,
      tags: Array.isArray(tags) ? tags : tags ? tags.split(',').map(tag => tag.trim()) : [],
      featuredImage: featuredImagePath,
      status: status || 'draft',
      metaTitle,
      metaDescription,
      isCommentEnabled: isCommentEnabled !== undefined ? isCommentEnabled : true
    });

    await blog.save();
    await blog.populate('author', 'firstName lastName profile email ');

    res.status(201).json({
      success: true,
      message: "Blog created successfully",
      blog
    });
  } catch (error) {
    console.error("Error creating blog:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create blog",
      error: error.message
    });
  }
};

// Get all blogs (admin)
exports.getAllBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category, search } = req.query;

    
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    const blogs = await Blog.find(filter)
      .populate('author', 'firstName lastName profile email ')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);


    const total = await Blog.countDocuments(filter);



    res.status(200).json({
      success: true,
      blogs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blogs",
      error: error.message
    });
  }
};

// Get single blog
exports.getBlog = async (req, res) => {
  try {
    const { id } = req.params;
    
    const blog = await Blog.findById(id)
      .populate('author', 'name email profileImage');

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found"
      });
    }

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
};

// Update blog
exports.updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      excerpt,
      category,
      tags,
      status,
      metaTitle,
      metaDescription,
      isCommentEnabled
    } = req.body;

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found"
      });
    }

    // Process featured image if uploaded
    let featuredImagePath = blog.featuredImage;
    if (req.files && req.files.find(f => f.fieldname === "featuredImage")) {
      // Delete old image if exists
      if (blog.featuredImage) {
        const oldImagePath = path.join("public", blog.featuredImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      featuredImagePath = saveFiles(req.files.find(f => f.fieldname === "featuredImage"), "blog-images")[0];
    }

    const updatedBlog = await Blog.findByIdAndUpdate(
      id,
      {
        title,
        content,
        excerpt,
        category,
        tags: Array.isArray(tags) ? tags : tags ? tags.split(',').map(tag => tag.trim()) : [],
        featuredImage: featuredImagePath,
        status,
        metaTitle,
        metaDescription,
        isCommentEnabled: isCommentEnabled !== undefined ? isCommentEnabled : true,
        updatedAt: Date.now()
      },
      { new: true }
    ).populate('author', 'name email');

    res.status(200).json({
      success: true,
      message: "Blog updated successfully",
      blog: updatedBlog
    });
  } catch (error) {
    console.error("Error updating blog:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update blog",
      error: error.message
    });
  }
};

// Delete blog
exports.deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found"
      });
    }

    // Delete featured image if exists
    if (blog.featuredImage) {
      const imagePath = path.join("public", blog.featuredImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Blog.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Blog deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting blog:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete blog",
      error: error.message
    });
  }
};

// Get blog statistics (for admin dashboard)
exports.getBlogStats = async (req, res) => {
  try {
    const totalBlogs = await Blog.countDocuments();
    const publishedBlogs = await Blog.countDocuments({ status: 'published' });
    const draftBlogs = await Blog.countDocuments({ status: 'draft' });
    const archivedBlogs = await Blog.countDocuments({ status: 'archived' });
    
    const totalViews = await Blog.aggregate([
      { $group: { _id: null, totalViews: { $sum: '$views' } } }
    ]);

    const recentBlogs = await Blog.find()
      .populate('author', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      stats: {
        totalBlogs,
        publishedBlogs,
        draftBlogs,
        archivedBlogs,
        totalViews: totalViews[0]?.totalViews || 0,
        recentBlogs
      }
    });
  } catch (error) {
    console.error("Error fetching blog stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blog statistics",
      error: error.message
    });
  }
};

// Bulk operations
exports.bulkUpdateBlogStatus = async (req, res) => {
  try {
    const { blogIds, status } = req.body;

    if (!Array.isArray(blogIds) || blogIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Blog IDs array is required"
      });
    }

    if (!['draft', 'published', 'archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    await Blog.updateMany(
      { _id: { $in: blogIds } },
      { status, updatedAt: Date.now() }
    );

    res.status(200).json({
      success: true,
      message: `${blogIds.length} blogs updated successfully`
    });
  } catch (error) {
    console.error("Error bulk updating blogs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update blogs",
      error: error.message
    });
  }
};