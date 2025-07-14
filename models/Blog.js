const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  slug: { type: String,},
  content: { type: String, required: true },
  excerpt: { type: String, maxlength: 500 },
  category: { type: String, default: "General" },
  tags: [{ type: String }],
  featuredImage: String,
  status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  isCommentEnabled: { type: Boolean, default: true },
  publishedAt: { type: Date },
  metaTitle: { type: String, maxlength: 60 },
  metaDescription: { type: String, maxlength: 160 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
blogSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (this.status === 'published' && !this.publishedAt) {
    this.publishedAt = Date.now();
  }
  next();
});

// Create slug from title if not provided
blogSchema.pre('save', function(next) {
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

module.exports = mongoose.model("Blog", blogSchema);