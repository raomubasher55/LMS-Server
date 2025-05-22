const Course = require('../models/Course');
const User = require('../models/User');

// Initialize Stripe with error handling
let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  } else {
    console.warn('STRIPE_SECRET_KEY not found in environment variables');
  }
} catch (error) {
  console.error('Failed to initialize Stripe:', error.message);
}

// Create Stripe checkout session for course purchase
const createPaymentSession = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment processing is not available. Stripe not configured.'
      });
    }

    const { courseId } = req.body;
    const userId = req.user.id;

    // Get course details
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if course is premium
    if (course.offerType === 'free') {
      return res.status(400).json({
        success: false,
        message: 'This course is free and does not require payment'
      });
    }

    // Check if user already owns the course
    const user = await User.findById(userId);
    if (user.enrolledCourses && user.enrolledCourses.includes(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'You are already enrolled in this course'
      });
    }

    // Use discounted price if available, otherwise regular price
    const amount = Math.round((course.discountedPrice || course.price) * 100); // Convert to cents

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: course.title,
              description: course.description,
              images: course.bannerImage ? [`${process.env.FRONTEND_URL}${course.bannerImage}`] : []
            },
            unit_amount: amount,
          },
          quantity: 1,
        }
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/courses/${courseId}`,
      metadata: {
        courseId: courseId,
        userId: userId,
        courseName: course.title
      }
    });

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Payment session creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment session'
    });
  }
};

// Handle successful payment from Stripe
const handlePaymentSuccess = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment processing is not available. Stripe not configured.'
      });
    }

    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    // Retrieve checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      const { courseId, userId } = session.metadata;

      // Check if enrollment already exists
      const user = await User.findById(userId);
      const course = await Course.findById(courseId);
      
      if (!user.enrolledCourses.includes(courseId)) {
        const purchaseAmount = course.discountedPrice || course.price;
        
        // Add to both enrolledCourses and purchasedCourses for premium courses
        await User.findByIdAndUpdate(
          userId,
          { 
            $addToSet: { 
              enrolledCourses: courseId,
              purchasedCourses: {
                course: courseId,
                purchasedAt: new Date(),
                progress: 0,
                lastAccessed: new Date(),
                paymentAmount: purchaseAmount,
                paymentMethod: 'stripe',
                transactionId: session.id
              }
            }
          }
        );

        // Increment course enrollment count
        await Course.findByIdAndUpdate(
          courseId,
          { $inc: { enrollmentCount: 1 } }
        );
      }

      res.json({
        success: true,
        message: 'Payment successful! You are now enrolled in the course.',
        course: {
          id: courseId,
          title: course.title
        }
      });

    } else {
      res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }

  } catch (error) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment'
    });
  }
};

// Enroll user in free course
const enrollFreeCourse = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user.id;

    // Get course details
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if course is free
    if (course.offerType !== 'free') {
      return res.status(400).json({
        success: false,
        message: 'This course requires payment'
      });
    }

    // Check if user already owns the course
    const user = await User.findById(userId);
    if (user.enrolledCourses && user.enrolledCourses.includes(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'You are already enrolled in this course'
      });
    }

    // Enroll user in free course
    await User.findByIdAndUpdate(
      userId,
      { 
        $addToSet: { 
          enrolledCourses: courseId 
        }
      }
    );

    // Increment course enrollment count
    await Course.findByIdAndUpdate(
      courseId,
      { $inc: { enrollmentCount: 1 } }
    );

    res.json({
      success: true,
      message: 'Successfully enrolled in free course!',
      courseId: courseId
    });

  } catch (error) {
    console.error('Free course enrollment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enroll in course'
    });
  }
};

// Check if user has access to course
const checkCourseAccess = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if course is free or user is enrolled
    const hasAccess = course.offerType === 'free' || 
                     (user.enrolledCourses && user.enrolledCourses.includes(courseId));

    res.json({
      success: true,
      hasAccess: hasAccess,
      courseType: course.offerType,
      requiresPayment: course.offerType === 'premium' && !hasAccess
    });

  } catch (error) {
    console.error('Course access check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check course access'
    });
  }
};

// Get user's purchased courses
const getPurchasedCourses = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .populate('purchasedCourses.course', 'title bannerImage price discountedPrice offerType category instructor')
      .populate('purchasedCourses.course.instructor', 'firstName lastName');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      purchasedCourses: user.purchasedCourses,
      totalInvestment: user.purchasedCourses.reduce((total, purchase) => total + (purchase.paymentAmount || 0), 0)
    });

  } catch (error) {
    console.error('Get purchased courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get purchased courses'
    });
  }
};

// Fix user data - migrate premium courses to purchasedCourses
const fixUserEnrollmentData = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).populate('enrolledCourses');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let migratedCount = 0;

    // Check each enrolled course
    for (const course of user.enrolledCourses) {
      // If it's a premium course and not already in purchasedCourses
      if (course.offerType === 'premium') {
        const alreadyPurchased = user.purchasedCourses.some(
          p => p.course && p.course.toString() === course._id.toString()
        );

        if (!alreadyPurchased) {
          // Add to purchasedCourses
          const purchaseData = {
            course: course._id,
            purchasedAt: new Date(),
            progress: 0,
            lastAccessed: new Date(),
            paymentAmount: course.discountedPrice || course.price || 0,
            paymentMethod: 'unknown', // Since we don't have the original payment method
            transactionId: 'migrated_' + Date.now()
          };

          user.purchasedCourses.push(purchaseData);
          migratedCount++;
        }
      }
    }

    if (migratedCount > 0) {
      await user.save();
    }

    res.json({
      success: true,
      message: `Successfully migrated ${migratedCount} premium courses to purchased courses.`,
      migratedCount
    });

  } catch (error) {
    console.error('Fix user data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix user data'
    });
  }
};

module.exports = {
  createPaymentSession,
  handlePaymentSuccess,
  enrollFreeCourse,
  checkCourseAccess,
  getPurchasedCourses,
  fixUserEnrollmentData
};