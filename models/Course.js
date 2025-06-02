const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  price: { type: Number, required: true, min: 0 },
  discountedPrice: { type: Number, min: 0 },
  category: { type: String, default: "All" },
  offerType: { type: String, enum: ["free", "premium"], default: "premium" },
  description: { type: String, maxlength: 5000 },
  requirements: { type: String, maxlength: 2000 },
  benefits: { type: String, maxlength: 2000 },
  tags: [{ type: String }],
  startDate: { type: Date },
  language: { type: String, default: "English" },
  bannerImage: String,
  pdfFiles: [{ url: String, title: String }],
  certificateFile: String,

  chapters: [
    {
      title: String,
      order: Number,
      video: {
        url: String,
        duration: Number,
        title: String
      },
      quiz: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' }], 
      isLockedUntilQuizPass: { type: Boolean, default: false }
    }
  ],
  assignments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Assignment" }],
  enrollmentCount: {
    type: Number,
    default: 0
  },
  status: { type: String, enum: ["pending", "published", "rejected"], default: "pending" },
  createdAt: { type: Date, default: Date.now }
});


// Add virtual field for total duration
courseSchema.virtual('totalDuration').get(function() {
  if (!this.chapters) return 0;
  return this.chapters.reduce((total, chapter) => {
    return total + (chapter.video?.duration || 0);
  }, 0);
});

// Add this to your Order model or controller
courseSchema.statics.updateEnrollment = async function(courseId) {
  const count = await Order.countDocuments({
    course: courseId,
    status: 'completed'
  });
  await this.findByIdAndUpdate(courseId, { enrollmentCount: count });
};

// Ensure virtuals are included in toJSON and toObject
courseSchema.set('toJSON', { virtuals: true });
courseSchema.set('toObject', { virtuals: true });


module.exports = mongoose.model("Course", courseSchema);
