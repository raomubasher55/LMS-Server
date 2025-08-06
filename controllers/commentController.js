 const Comment = require("../models/comment")

// Create a comment on a course

exports.createComment = async (req, res) => {
    const { courseId, name, email, number, website, message } = req.body;
    const userId = req.user.id;
    
    try {
      const comment = new Comment({
        courseId,
        userId,
        name,
        email,
        number,
        website,
        text: message,
        replies: [],
      });
  
      await comment.save();
      res.status(200).json({ message: 'Comment added successfully', comment });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Failed to add comment', error });
    }
  };
  

  // Add a reply to a comment
  exports.replyToComment = async (req, res) => {
    const { commentId, replyText } = req.body;
    const userId = req.user.id;
  
    if (!commentId || !replyText || !replyText.trim()) {
      return res.status(400).json({ message: 'Comment ID and reply text are required' });
    }
  
    try {
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }
  
      comment.replies.push({
        userId,
        text: replyText,
        createdAt: new Date(),
      });
  
      await comment.save();
      res.status(200).json({ message: 'Reply added successfully', comment });
    } catch (error) {
      res.status(500).json({ message: 'Failed to add reply', error: error.message });
    }
  };
  
  
  
// Fetch all comments for a specific course
exports.getCourseComments = async (req, res) => {
  const { courseId } = req.params;

  try {
    const comments = await Comment.find({ courseId })
      .populate({
        path: 'userId',
        select: 'firstName lastName email profile', // 👈 added 'profile'
      })
      .populate({
        path: 'replies.userId',
        select: 'firstName lastName email profile', // 👈 added 'profile'
      })
      .sort({ createdAt: -1 }); // Newest comments first

    res.status(200).json({ success: true, comments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch comments', error });
  }
};

  
  