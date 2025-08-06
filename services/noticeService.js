const Notice = require('../models/Notice.js');
const User = require('../models/User.js');
const Course = require('../models/Course.js');
const Order = require('../models/Order.js');

exports.generateSystemNotices = async () => {
  const lowInventoryCourses = await Course.find({ 
    seats: { $lt: 5 } 
  }).limit(5);
  
  return lowInventoryCourses.map(course => new Notice({
    title: `Low inventory: ${course.title} has only ${course.seats} seats left`,
    type: 'system',
    priority: 'high',
    relatedEntity: { 
      kind: 'Course', 
      item: course._id 
    }
  }));
};

exports.generateUserNotices = async () => {
  const newUsers = await User.find({
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });
  
  return newUsers.map(user => new Notice({
    title: `New user registered: ${user.firstName} ${" "} ${user.lastName}`,
    type: 'user',
    priority: 'medium',
    relatedEntity: { 
      kind: 'User', 
      item: user._id 
    }
  }));
};

exports.generateFinancialNotices = async () => {
  const recentOrders = await Order.find({
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    totalAmount: { $gt: 100 }
  }).populate('user');
  
  return recentOrders.map(order => new Notice({
    title: `High-value order: $${order.totalAmount} by ${order.user.name}`,
    type: 'financial',
    priority: 'high',
    relatedEntity: { 
      kind: 'Order', 
      item: order._id 
    }
  }));
};

exports.getLatestNotices = async (limit = 10) => {
  // Generate notices
  const systemNotices = await this.generateSystemNotices();
  const userNotices = await this.generateUserNotices();
  const financialNotices = await this.generateFinancialNotices();
  
  // Combine all notices
  const allNotices = [...systemNotices, ...userNotices, ...financialNotices];
  
  // Save to DB if there are new notices
  if (allNotices.length > 0) {
    try {
      await Notice.bulkSave(allNotices); // Using bulkSave instead of insertMany
    } catch (error) {
      console.error('Error saving notices:', error);
    }
  }
  
  // Return latest notices from DB
  return Notice.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('relatedEntity.item');
};