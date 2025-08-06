// controllers/instructorController.js
const InstructorApplication = require('../models/InstructorApplication');
const sendEmail = require('../utils/sendEmail');

class InstructorController {
  // Create new instructor application
async createApplication(req, res) {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      bio,
      expertise,
      experience,
      courseTopics,
      teachingExperience,
      agreeToTerms
    } = req.body;
    console.log(req.body)

    // Check if application with this email already exists
    const existingApplication = await InstructorApplication.findOne({
      email: email.toLowerCase()
    });

    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: 'An application with this email already exists'
      });
    }

    // Create new application
    const application = new InstructorApplication({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      bio: bio.trim(),
      expertise: expertise.trim(),
      experience: experience.trim(),
      courseTopics: courseTopics.trim(),
      teachingExperience: teachingExperience.trim(),
      agreeToTerms
    });

    await application.save();

    // Send confirmation email to applicant
    try {
      const subject = 'Your Instructor Application was received';
      const html = `
        <p>Hi ${application.firstName},</p>
        <p>Thank you for applying to become an instructor at Tanga Academy.</p>
        <p>We have received your application and our team will review it shortly.</p>
        <p>We’ll contact you if we move forward with your application.</p>
        <br/>
        <p>Best regards,<br/>Tanga Academy Team</p>
      `;

      await sendEmail(application.email, subject, html);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: {
        applicationId: application._id,
        fullName: `${application.firstName} ${application.lastName}`
      }
    });

  } catch (error) {
    console.error('Error creating instructor application:', error);

    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
}


  // Get all applications (admin only)
  async getAllApplications(req, res) {
    try {
      const { page = 1, limit = 10, search } = req.query;

      const query = {};
      
      // Search functionality
      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { expertise: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const applications = await InstructorApplication
        .find(query)
        .select('-__v')
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const totalApplications = await InstructorApplication.countDocuments(query);
      const totalPages = Math.ceil(totalApplications / parseInt(limit));

      res.status(200).json({
        success: true,
        data: {
          applications,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalApplications,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        }
      });

    } catch (error) {
      console.error('Error fetching applications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch applications'
      });
    }
  }

  // Get single application by ID
  async getApplicationById(req, res) {
    try {
      const { id } = req.params;

      const application = await InstructorApplication
        .findById(id)
        .select('-__v');

      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Application not found'
        });
      }

      res.status(200).json({
        success: true,
        data: { application }
      });

    } catch (error) {
      console.error('Error fetching application:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch application'
      });
    }
  }

  // Admin contact instructor via email
  async contactInstructor(req, res) {
    try {
      const { id } = req.params;
      const { subject, message } = req.body;

      if (!subject || !message) {
        return res.status(400).json({
          success: false,
          message: 'Subject and message are required'
        });
      }

      const application = await InstructorApplication.findById(id);
      
      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Application not found'
        });
      }

      // Send email to instructor
 try {
      const html = `
        <p>Hi ${application.firstName} ${application.lastName},</p>
        <p>${message}</p>
        <br/>
        <p>Regards,<br/>Tanga Academy Admin Team</p>
      `;

      await sendEmail(application.email, subject.trim(), html);

      res.status(200).json({
        success: true,
        message: 'Email sent successfully to instructor'
      });

    } catch (emailError) {
      console.error('Failed to send email to instructor:', emailError);
      res.status(500).json({
        success: false,
        message: 'Failed to send email'
      });
      }

    } catch (error) {
      console.error('Error contacting instructor:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to contact instructor'
      });
    }
  }

  // Delete application (admin only)
  async deleteApplication(req, res) {
    try {
      const { id } = req.params;

      const application = await InstructorApplication.findByIdAndDelete(id);
      
      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Application not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Application deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting application:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete application'
      });
    }
  }
}

module.exports = new InstructorController();