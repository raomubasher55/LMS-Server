const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Remove deprecated options
    const conn = await mongoose.connect(process.env.MONGO_URI1);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.log('Trying to connect to:', process.env.MONGO_URI1 ? 'Cloud MongoDB' : 'No MONGO_URI found');
    process.exit(1); 
  }
};

module.exports = connectDB;
