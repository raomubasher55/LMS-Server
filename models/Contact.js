const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/.+\@.+\..+/, 'Please enter a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[\d\s+\-()]+$/, 'Please enter a valid phone number'],
      required: false,
    },
    service: {
      type: String,
      trim: true,
      default: 'General Inquiry',
      required: false,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      minlength: [10, 'Message must be at least 10 characters long'],
    },
  },
  { timestamps: true } // Automatically adds createdAt & updatedAt
);

const Contact = mongoose.model('Contact', contactSchema);

module.exports = Contact;
