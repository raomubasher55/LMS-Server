const Contact = require('../models/Contact');

// Submit contact form (public endpoint)
const submitContactForm = async (req, res) => {
  try {
    const { name, email, message, phone, service } = req.body;

    const newContact = await Contact.create({ name, email, message, phone,service  });

    res.status(201).json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.',
      data: newContact,
    });
  } catch (error) {
    console.error('Error submitting contact form:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to submit contact form',
      error: error.message,
    });
  }
};

// Get all contacts with pagination and filters (admin only)
const getContacts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const dateFilter = req.query.dateFilter || 'all';

    // Build search query
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Build date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate;

      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }

      if (startDate) {
        query.createdAt = { $gte: startDate };
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get contacts and total count
    const [contacts, totalContacts] = await Promise.all([
      Contact.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Contact.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalContacts / limit);

    res.json({
      success: true,
      contacts,
      pagination: {
        currentPage: page,
        totalPages,
        totalContacts,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contacts',
      error: error.message
    });
  }
};

// Get contact statistics (admin only)
const getContactStats = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [total, todayCount, weekCount] = await Promise.all([
      Contact.countDocuments(),
      Contact.countDocuments({ createdAt: { $gte: today } }),
      Contact.countDocuments({ createdAt: { $gte: weekAgo } })
    ]);

    res.json({
      success: true,
      stats: {
        total,
        today: todayCount,
        thisWeek: weekCount
      }
    });
  } catch (error) {
    console.error('Error fetching contact stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};

// Delete contact message (admin only)
const deleteContact = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedContact = await Contact.findByIdAndDelete(id);

    if (!deletedContact) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete contact message',
      error: error.message
    });
  }
};

module.exports = {
  submitContactForm,
  getContacts,
  getContactStats,
  deleteContact
};

