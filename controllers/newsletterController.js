const Newsletter = require("../models/Newsletter");
const validator = require("validator");

// Subscribe to newsletter
const subscribe = async (req, res) => {
  try {
    const { email, source = "website", preferences = {} } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    // Check if email already exists
    const existingSubscriber = await Newsletter.findOne({ email: email.toLowerCase() });
    
    if (existingSubscriber) {
      if (existingSubscriber.status === 'active') {
        return res.status(409).json({
          success: false,
          message: "Email is already subscribed to our newsletter"
        });
      } else if (existingSubscriber.status === 'unsubscribed') {
        // Reactivate the subscription
        existingSubscriber.status = 'active';
        existingSubscriber.subscribedAt = new Date();
        existingSubscriber.unsubscribedAt = undefined;
        existingSubscriber.source = source;
        existingSubscriber.preferences = { ...existingSubscriber.preferences, ...preferences };
        
        await existingSubscriber.save();
        
        return res.status(200).json({
          success: true,
          message: "Welcome back! Your subscription has been reactivated",
          subscriber: {
            email: existingSubscriber.email,
            status: existingSubscriber.status,
            subscribedAt: existingSubscriber.subscribedAt
          }
        });
      }
    }

    // Get client metadata
    const metadata = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      referrer: req.headers.referer || req.headers.referrer
    };

    // Create new subscriber
    const newSubscriber = new Newsletter({
      email: email.toLowerCase(),
      source,
      preferences: {
        frequency: preferences.frequency || "weekly",
        categories: preferences.categories || ["general"]
      },
      metadata
    });

    await newSubscriber.save();

    res.status(201).json({
      success: true,
      message: "Successfully subscribed to newsletter!",
      subscriber: {
        email: newSubscriber.email,
        status: newSubscriber.status,
        subscribedAt: newSubscriber.subscribedAt
      }
    });

  } catch (error) {
    console.error("Newsletter subscription error:", error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email is already subscribed"
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to subscribe to newsletter",
      error: error.message
    });
  }
};

// Unsubscribe from newsletter
const unsubscribe = async (req, res) => {
  try {
    const { email, token } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const subscriber = await Newsletter.findOne({ email: email.toLowerCase() });

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: "Email not found in our newsletter list"
      });
    }

    if (subscriber.status === 'unsubscribed') {
      return res.status(400).json({
        success: false,
        message: "Email is already unsubscribed"
      });
    }

    await subscriber.unsubscribe();

    res.status(200).json({
      success: true,
      message: "Successfully unsubscribed from newsletter"
    });

  } catch (error) {
    console.error("Newsletter unsubscription error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unsubscribe from newsletter",
      error: error.message
    });
  }
};

// Get all subscribers (Admin only)
const getAllSubscribers = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'active', search } = req.query;

    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search) {
      filter.email = { $regex: search, $options: 'i' };
    }

    const subscribers = await Newsletter.find(filter)
      .select('-metadata.ipAddress -metadata.userAgent') // Hide sensitive data
      .sort({ subscribedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Newsletter.countDocuments(filter);
    const activeCount = await Newsletter.getActiveCount();

    res.status(200).json({
      success: true,
      subscribers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalSubscribers: total,
        hasMore: page * limit < total
      },
      stats: {
        activeSubscribers: activeCount,
        totalSubscribers: await Newsletter.countDocuments()
      }
    });

  } catch (error) {
    console.error("Get subscribers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscribers",
      error: error.message
    });
  }
};

// Get newsletter statistics
const getStats = async (req, res) => {
  try {
    const totalSubscribers = await Newsletter.countDocuments();
    const activeSubscribers = await Newsletter.countDocuments({ status: 'active' });
    const unsubscribedCount = await Newsletter.countDocuments({ status: 'unsubscribed' });
    const bouncedCount = await Newsletter.countDocuments({ status: 'bounced' });

    // Get subscription trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSubscriptions = await Newsletter.countDocuments({
      subscribedAt: { $gte: thirtyDaysAgo },
      status: 'active'
    });

    // Get top sources
    const sourceStats = await Newsletter.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.status(200).json({
      success: true,
      stats: {
        total: totalSubscribers,
        active: activeSubscribers,
        unsubscribed: unsubscribedCount,
        bounced: bouncedCount,
        recentSubscriptions,
        sources: sourceStats
      }
    });

  } catch (error) {
    console.error("Get newsletter stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch newsletter statistics",
      error: error.message
    });
  }
};

module.exports = {
  subscribe,
  unsubscribe,
  getAllSubscribers,
  getStats
};