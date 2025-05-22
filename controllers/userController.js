const bcrypt = require('bcryptjs');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const mongoose = require('mongoose')

exports.updateProfile = async (req, res) => {
  const userId = req.params.id;
  try {
    const updatedData = req.body;

    const updatedUser = await User.findByIdAndUpdate(userId, updatedData, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 👇 Customize message based on role
    let roleMessage = '';
    switch (updatedUser.role) {
      case 'student':
        roleMessage = 'Your student profile at Tanga Academy has been successfully updated.';
        break;
      case 'instructor':
        roleMessage = 'Your instructor profile at Tanga Academy has been updated. Keep inspiring students!';
        break;
      case 'admin':
        roleMessage = 'Your admin profile has been updated at Tanga Academy.';
        break;
    }

    // 👇 Send profile update email
    await sendEmail(
      updatedUser.email,
      'Profile Updated - Tanga Academy',
      `
        <h2>Hello ${updatedUser.firstName} ${updatedUser.lastName},</h2>
        <p>${roleMessage}</p>
        <p>If you didn’t request this update, please contact our support immediately.</p>
        <br />
        <p>— Tanga Academy Team</p>
      `
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
};


// ✅ Password Update Function

exports.updatePassword = async (req, res) => {
  const userId = req.user.id; 
  const { currentPassword, newPassword } = req.body;

  // Validate request body
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new passwords are required' });
  }

  try {
    const user = await User.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if current password matches
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Update the password in the database
    user.password = newPassword;
    await user.save();

    // Send confirmation email
    await sendEmail(
      user.email,
      'Password Updated - Tanga Academy',
      `
        <h2>Hello ${user.firstName} ${user.lastName},</h2>
        <p>Your password has been successfully updated for your ${user.role} account at <strong>Tanga Academy</strong>.</p>
        <p>If you didn’t make this change, please contact our support immediately.</p>
        <br />
        <p>— Tanga Academy Team</p>
      `
    );

    // Respond with success
    res.status(200).json({ message: "Password updated and confirmation email sent." });
  } catch (err) {
    console.error("Password update error:", err);
    res.status(500).json({ message: "Server error" });
  }
};





exports.updateSocialLinks = async (req, res) => {
  try {

    const userId = req.user.id; 
    console.log(userId)

    // Validate URL format (simple validation for now, you can use a more robust regex)
    const urlRegex = /^(https?:\/\/)?([a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+)(\/[^\s]*)?$/;

    const { facebook, twitter, linkedin, website, github } = req.body;

    // Validate each social link
    const socialLinks = {
      facebook,
      twitter,
      linkedin,
      website,
      github,
    };

    for (const platform in socialLinks) {
      if (socialLinks[platform] && !urlRegex.test(socialLinks[platform])) {
        return res.status(400).json({ message: `${platform} link is invalid` });
      }
    }

    // Find user and update the social links in instructorProfile
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "instructorProfile.socialLinks": {
            facebook,
            twitter,
            linkedin,
            website,
            github,
          },
        },
      },
      { new: true } // Return the updated document
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Social links updated successfully",
      user: user
    });
  } catch (error) {
    console.error("Error updating social links:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// get user profile 

exports.getProfile = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id)
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(id).select(
      'firstName lastName username profile bio skill role instructorProfile '
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

