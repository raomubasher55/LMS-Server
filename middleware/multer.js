// 1. First, update your multer middleware with memory storage approach:
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Utility function to save uploaded files
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

// File filter for assignment files - modify as needed for your use case
const fileFilter = (req, file, cb) => {
  // Allow all file types for assignments
  // You can add restrictions here if needed
  cb(null, true);
};

// Configure multer with memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    files: 5, // Maximum 5 files as in your original code
    fieldSize: 10 * 1024 * 1024, // 10 MB limit for text fields
    fileSize: 50 * 1024 * 1024 // 50MB per file as in your original code
  },
});

module.exports = {
  upload,
  saveFiles
};