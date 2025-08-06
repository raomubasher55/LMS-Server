const bcrypt = require('bcryptjs');
const User = require('../models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken')
const createNotification = require('../utils/createNotification');

// Setup nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL, 
    pass: process.env.EMAIL_PASSWORD,
  },
});

exports.registerUser = async (req, res) => {
  try {
    const { firstName, lastName, username, email, password , role } = req.body;
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'Email or Username already exists' });
    }

    const profileImage = req.file ? req.file.filename : null;
    let profileImageUrl = null;
    if (profileImage) {
      profileImageUrl = `/uploads/profileImages/${profileImage}`;
    }
    // Generate a unique verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create the new user with verification status set to false
    const newUser = new User({
      firstName,
      lastName,
      username,
      email,
      role,
      password,
      profile: profileImageUrl,
      verificationToken, 
      isVerified: false, 
    });

    await newUser.save();
    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    let subject, textContent, htmlContent;

    if (role === 'student') {
      subject = 'Welcome to Tanga Academy!';
      textContent = `Hello ${firstName},\n\nWelcome to Tanga Academy! We are thrilled to have you join our community of passionate learners. To get started, please click the link below to verify your email and complete your registration:\n\n${verificationUrl}\n\nSee you in class!`;
      htmlContent = `<p>Hello <strong>${firstName}</strong>,</p><p>Welcome to <strong>Tanga Academy</strong>! We are thrilled to have you join our community of passionate learners. To get started, please click the link below to verify your email and complete your registration:</p><p><a href="${verificationUrl}">Verify Email</a></p><p>See you in class!</p>`;
    } else if (role === 'instructor') {
      subject = 'Welcome to Tanga Academy, Instructor!';
      textContent = `Hello ${firstName},\n\nWelcome aboard! We are excited to have you as an instructor at Tanga Academy. Please click the link below to verify your email and start preparing for your courses:\n\n${verificationUrl}\n\nWe look forward to your contributions in shaping the future of our students!`;
      htmlContent = `<p>Hello <strong>${firstName}</strong>,</p><p>Welcome aboard! We are excited to have you as an instructor at <strong>Tanga Academy</strong>. Please click the link below to verify your email and start preparing for your courses:</p><p><a href="${verificationUrl}">Verify Email</a></p><p>We look forward to your contributions in shaping the future of our students!</p>`;
    } else {
      subject = 'Welcome to Tanga Academy!';
      textContent = `Hello ${firstName},\n\nThank you for joining Tanga Academy! We are excited to have you with us. Please click the link below to verify your email and complete your registration:\n\n${verificationUrl}`;
      htmlContent = `<p>Hello <strong>${firstName}</strong>,</p><p>Thank you for joining <strong>Tanga Academy</strong>! We are excited to have you with us. Please click the link below to verify your email and complete your registration:</p><p><a href="${verificationUrl}">Verify Email</a></p>`;
    }

    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: subject,
      text: textContent,
      html: htmlContent,
    };

    // Send the email
    await transporter.sendMail(mailOptions);
    await createNotification({
      title: 'New Member registered',
      type: 'application',
      name: `${firstName + " " + lastName}`
    });

    
    // Respond to the user with a success message
    res.status(200).json({ message: 'A verification email has been sent to your email address. Please check your inbox.' });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
};



// login user 
exports.loginUser = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    // Validate input
    if (!emailOrUsername || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email/username and password'
      });
    }

    // Check if user exists by email or username
    const user = await User.findOne({
      $or: [
        { email: emailOrUsername },
        { username: emailOrUsername }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      // Send email notification for deactivated account
      const mailOptions = {
        from: process.env.EMAIL,
        to: user.email,
        subject: 'Account Deactivated',
        text: `Hello ${user.firstName},\n\nYour account is currently deactivated. Please contact support for further assistance.\n\nTanga Academy`,
        html: `<p>Hello <strong>${user.firstName}</strong>,</p><p>Your account is currently deactivated. Please contact support for further assistance.</p><p><strong>Tanga Academy</strong></p>`
      };

      await transporter.sendMail(mailOptions);

      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password.trim(), user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if email is verified
    if (!user.isVerified) {
      // Send verification email if the account is not verified
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${user.verificationToken}`;

      const mailOptions = {
        from: process.env.EMAIL,
        to: user.email,
        subject: 'Email Verification Required',
        text: `Hello ${user.firstName},\n\nPlease verify your email address by clicking the link below:\n\n${verificationUrl}\n\nThank you!\n\nTanga Academy`,
        html: `<p>Hello <strong>${user.firstName}</strong>,</p><p>Please verify your email address by clicking the link below:</p><p><a href="${verificationUrl}">Verify Email</a></p><p>Thank you!</p><p><strong>Tanga Academy</strong></p>`
      };

      await transporter.sendMail(mailOptions);

      return res.status(403).json({
        success: false,
        message: 'Please verify your email address first',
        isVerified: false
      });
    }

    let roleMessage;
switch(user.role) {
  case 'admin':
    roleMessage = 'Welcome back, Admin! You have full access to manage the platform.';
    break;
  case 'instructor':
    roleMessage = 'Welcome back, Instructor! You can now manage your courses.';
    break;
  case 'student':
    roleMessage = 'Welcome back, Student! Continue your learning journey.';
    break;
  default:
    roleMessage = 'Welcome back!';
}

    // Send a welcome email after successful login (active user, verified email)
    const subject = `Welcome back to Tanga Academy, ${user.firstName}!`;
    const textContent = `Hello ${user.firstName},\n\n${roleMessage}\n\nThank you for being a part of Tanga Academy!`;
    const htmlContent = `<p>Hello <strong>${user.firstName}</strong>,</p><p>${roleMessage}</p><p>Thank you for being a part of <strong>Tanga Academy</strong>!</p>`;
    
    const mailOptions = {
      from: process.env.EMAIL,
      to: user.email,
      subject: subject,
      text: textContent,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);

    
    // Create JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role,
        username: user.username,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        profile: user.profile
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    // Omit password from user data
    const userData = user.toObject();
    delete userData.password;

    res.status(200).json({
      success: true,
      token,
      user: userData,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};
