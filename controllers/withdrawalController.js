const WithdrawalRequest = require("../models/WithdrawalRequest");
const Order = require("../models/Order");
const User = require("../models/User");
const createNotification = require('../utils/createNotification');

// Get instructor earnings and withdrawal history
exports.getInstructorEarnings = async (req, res) => {
  try {
    const instructorId = req.user.id;

    // Get instructor's earnings from orders
    const completedOrders = await Order.find({
      instructor: instructorId,
      paymentStatus: 'completed'
    });

    // Calculate total earnings
    let totalEarnings = 0;
    completedOrders.forEach(order => {
      const amount = order.discountedAmount || order.amount;
      const instructorShare = amount * (order.revenueSplit.instructor / 100);
      totalEarnings += instructorShare;
    });

    // Get total withdrawn amount
    const completedWithdrawals = await WithdrawalRequest.find({
      instructor: instructorId,
      status: 'completed'
    });

    const totalWithdrawn = completedWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);

    // Get pending withdrawals
    const pendingWithdrawals = await WithdrawalRequest.find({
      instructor: instructorId,
      status: { $in: ['pending', 'under_review', 'approved'] }
    });

    const pendingAmount = pendingWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);

    // Calculate available balance
    const availableBalance = totalEarnings - totalWithdrawn - pendingAmount;

    // Get withdrawal history
    const withdrawalHistory = await WithdrawalRequest.find({
      instructor: instructorId
    }).sort({ requestDate: -1 }).limit(10);

    res.status(200).json({
      success: true,
      data: {
        totalEarnings,
        totalWithdrawn,
        pendingAmount,
        availableBalance,
        withdrawalHistory,
        recentOrders: completedOrders.slice(-5)
      }
    });
  } catch (error) {
    console.error("Error fetching instructor earnings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch earnings data",
      error: error.message
    });
  }
};

// Create withdrawal request (Instructor)
exports.createWithdrawalRequest = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const {
      amount,
      accountNumber,
      accountName,
      bankName,
      accountType,
      routingNumber,
      swiftCode,
      branchAddress,
      paymentMethod
    } = req.body;

    // Validate minimum withdrawal amount
    if (amount < 10) {
      return res.status(400).json({
        success: false,
        message: "Minimum withdrawal amount is $10"
      });
    }

    // Check available balance
    const completedOrders = await Order.find({
      instructor: instructorId,
      paymentStatus: 'completed'
    });

    let totalEarnings = 0;
    completedOrders.forEach(order => {
      const orderAmount = order.discountedAmount || order.amount;
      const instructorShare = orderAmount * (order.revenueSplit.instructor / 100);
      totalEarnings += instructorShare;
    });

    const completedWithdrawals = await WithdrawalRequest.find({
      instructor: instructorId,
      status: 'completed'
    });

    const totalWithdrawn = completedWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);

    const pendingWithdrawals = await WithdrawalRequest.find({
      instructor: instructorId,
      status: { $in: ['pending', 'under_review', 'approved'] }
    });

    const pendingAmount = pendingWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
    const availableBalance = totalEarnings - totalWithdrawn - pendingAmount;

    if (amount > availableBalance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: $${availableBalance.toFixed(2)}`
      });
    }

    // Create withdrawal request
    const withdrawalRequest = new WithdrawalRequest({
      instructor: instructorId,
      amount,
      bankDetails: {
        accountNumber,
        accountName,
        bankName,
        accountType,
        routingNumber,
        swiftCode,
        branchAddress
      },
      paymentMethod: paymentMethod || 'bank_transfer'
    });

    await withdrawalRequest.save();

    // Create notification for admin
    await createNotification({
      type: 'withdrawal_request',
      message: `New withdrawal request of $${amount} from instructor`,
      userId: null, // Admin notification
      relatedId: withdrawalRequest._id
    });

    res.status(201).json({
      success: true,
      message: "Withdrawal request submitted successfully",
      data: withdrawalRequest
    });
  } catch (error) {
    console.error("Error creating withdrawal request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create withdrawal request",
      error: error.message
    });
  }
};

// Get all withdrawal requests (Admin)
exports.getAllWithdrawalRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    
    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      if (users.length > 0) {
        filter.instructor = { $in: users.map(user => user._id) };
      }
    }

    const withdrawalRequests = await WithdrawalRequest.find(filter)
      .populate('instructor', 'name email profileImage')
      .populate('processedBy', 'name')
      .sort({ requestDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await WithdrawalRequest.countDocuments(filter);

    // Get statistics
    const stats = await WithdrawalRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        requests: withdrawalRequests,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total,
        stats
      }
    });
  } catch (error) {
    console.error("Error fetching withdrawal requests:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch withdrawal requests",
      error: error.message
    });
  }
};

// Update withdrawal request status (Admin)
exports.updateWithdrawalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason, adminNotes, transactionId, fees } = req.body;
    const adminId = req.user.id;

    const withdrawalRequest = await WithdrawalRequest.findById(id);
    if (!withdrawalRequest) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found"
      });
    }

    // Update withdrawal request
    withdrawalRequest.status = status;
    withdrawalRequest.processedBy = adminId;
    
    if (rejectionReason) withdrawalRequest.rejectionReason = rejectionReason;
    if (adminNotes) withdrawalRequest.adminNotes = adminNotes;
    if (transactionId) withdrawalRequest.transactionId = transactionId;
    if (fees !== undefined) withdrawalRequest.fees = fees;

    await withdrawalRequest.save();

    // Create notification for instructor
    let notificationMessage = '';
    switch (status) {
      case 'approved':
        notificationMessage = `Your withdrawal request of $${withdrawalRequest.amount} has been approved`;
        break;
      case 'completed':
        notificationMessage = `Your withdrawal of $${withdrawalRequest.amount} has been completed`;
        break;
      case 'rejected':
        notificationMessage = `Your withdrawal request of $${withdrawalRequest.amount} has been rejected`;
        break;
      default:
        notificationMessage = `Your withdrawal request status has been updated to ${status}`;
    }

    await createNotification({
      type: 'withdrawal_update',
      message: notificationMessage,
      userId: withdrawalRequest.instructor,
      relatedId: withdrawalRequest._id
    });

    const updatedRequest = await WithdrawalRequest.findById(id)
      .populate('instructor', 'name email')
      .populate('processedBy', 'name');

    res.status(200).json({
      success: true,
      message: "Withdrawal request updated successfully",
      data: updatedRequest
    });
  } catch (error) {
    console.error("Error updating withdrawal request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update withdrawal request",
      error: error.message
    });
  }
};

// Get single withdrawal request details
exports.getWithdrawalRequest = async (req, res) => {
  try {
    const { id } = req.params;
    
    const withdrawalRequest = await WithdrawalRequest.findById(id)
      .populate('instructor', 'name email profileImage')
      .populate('processedBy', 'name');

    if (!withdrawalRequest) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found"
      });
    }

    res.status(200).json({
      success: true,
      data: withdrawalRequest
    });
  } catch (error) {
    console.error("Error fetching withdrawal request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch withdrawal request",
      error: error.message
    });
  }
};

// Get withdrawal statistics (Admin Dashboard)
exports.getWithdrawalStats = async (req, res) => {
  try {
    const totalRequests = await WithdrawalRequest.countDocuments();
    const pendingRequests = await WithdrawalRequest.countDocuments({ status: 'pending' });
    const completedRequests = await WithdrawalRequest.countDocuments({ status: 'completed' });
    
    const totalWithdrawn = await WithdrawalRequest.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const monthlyStats = await WithdrawalRequest.aggregate([
      {
        $match: {
          requestDate: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 12))
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$requestDate' },
            month: { $month: '$requestDate' }
          },
          count: { $sum: 1 },
          amount: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalRequests,
        pendingRequests,
        completedRequests,
        totalWithdrawn: totalWithdrawn[0]?.total || 0,
        monthlyStats
      }
    });
  } catch (error) {
    console.error("Error fetching withdrawal stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch withdrawal statistics",
      error: error.message
    });
  }
};