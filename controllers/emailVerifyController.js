const User = require('../models/User');

exports.verifyEmail = async (req, res) => {
  const { token } = req.params;

  try {
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Mark user as verified and clear the verification token
    user.isVerified = true;
    user.verificationToken = undefined; // Clear the token
    await user.save();

    res.status(200).json({ message: 'Email verified successfully. You can now log in!' });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
};
