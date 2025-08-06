const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const path = require("path");
const http = require('http'); // Required for Socket.io integration
const socketIo = require('socket.io');

dotenv.config();
const app = express();
app.use(express.json());
// Connect to DB
connectDB();

// Middleware
const allowedOrigins = [
  'http://localhost:3000',          
  'http://localhost:3001',          
  'https://lms-project-zahid.netlify.app',
  'https://lms.cosha.eu'
];

// app.use(cors({
//   origin: function (origin, callback) {
//     if (!origin) return callback(null, true);
    
//     if (allowedOrigins.indexOf(origin) !== -1) {
//       callback(null, true);
//     } else {
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   credentials: true
// }));
app.use(cors());

// Additional headers (if needed)
app.use((req, res, next) => {
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// Serve static files with proper headers
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads"), {
  setHeaders: (res, path) => {
    // Set CORS headers for file downloads
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    
    // Set content-disposition for downloads
    if (path.includes('/pdfs/') || path.includes('/certificates/')) {
      const filename = path.split('/').pop();
      res.header('Content-Disposition', `attachment; filename="${filename}"`);
    }
  }
}));

// Routes
const userAuth = require('./routes/authRoutes');
const emailVerification = require('./routes/emailVerifyRoute');
const userRoutes = require('./routes/usersRoute');
const courseRoutes = require('./routes/courseRoutes.js');
const commentRoutes = require('./routes/commentRoutes.js');
const cartRoutes = require("./routes/cartRoutes.js");
const wishListRoutes = require("./routes/wishListRoutes.js");
const quizesRoutes = require("./routes/quizRoutes.js");
const AssignmentsRoutes = require("./routes/assignmentRoutes.js");
const adminRoutes = require('./routes/adminRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const paymentMethodRoutes = require('./routes/paymentMethodRoutes');
const chatRoutes = require('./routes/chatRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const progressRoutes = require('./routes/progressRoutes');
const quizProgressRoutes = require('./routes/quizProgressRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const blogRoutes = require('./routes/blogRoutes');
const publicBlogRoutes = require('./routes/publicBlogRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const { getLatestNotices } = require('./services/noticeService.js');
const contactRoutes = require('./routes/contactRoutes.js')
const newsletterRoutes = require('./routes/newsletterRoutes');
const instracturApplication = require('./routes/instructorRoutes.js');


app.use('/api/auth', userAuth);
app.use("/api", emailVerification);
app.use("/api/users", userRoutes);
app.use("/api", courseRoutes);
app.use("/api", commentRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishListRoutes);
app.use("/api/quizes", quizesRoutes);
app.use("/api/courses", AssignmentsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/enrollment', enrollmentRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/payment-methods', paymentMethodRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/quiz-progress', quizProgressRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/admin/blogs', blogRoutes);
app.use('/api/blogs', publicBlogRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/instructor', instracturApplication);
app.use('/api/contact', contactRoutes);
app.use('/api/newsletter', newsletterRoutes);

// Sample Route
app.get('/', (req, res) => {
  res.send('Welcome to the LMS Backend');
});

// Create HTTP server
const server = http.createServer(app);

// Socket.io Server Setup
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store online users
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('New Socket.io connection:', socket.id);

  // Handle user authentication and joining
  socket.on('authenticate', (data) => {
    const { userId, token } = data;
    if (userId) {
      socket.userId = userId;
      onlineUsers.set(userId, socket.id);
      console.log(`User ${userId} authenticated and online`);
      
      // Broadcast user online status
      socket.broadcast.emit('user_online', { userId });
    }
  });

  // Handle joining chat rooms
  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
    console.log(`Socket ${socket.id} joined chat: ${chatId}`);
  });

  // Handle leaving chat rooms
  socket.on('leave_chat', (chatId) => {
    socket.leave(chatId);
    console.log(`Socket ${socket.id} left chat: ${chatId}`);
  });

  // Handle new messages
  socket.on('send_message', (data) => {
    const { chatId, content, senderId, attachments = [] } = data;
    // Broadcast message to all users in the chat room
    socket.to(chatId).emit('new_message', {
      chatId,
      content,
      senderId,
      attachments,
      timestamp: new Date()
    });
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    const { chatId, userId } = data;
    socket.to(chatId).emit('user_typing', { userId, typing: true });
  });

  socket.on('typing_stop', (data) => {
    const { chatId, userId } = data;
    socket.to(chatId).emit('user_typing', { userId, typing: false });
  });

  // Handle notices (keeping existing functionality)
  const sendNotices = async () => {
    try {
      const notices = await getLatestNotices();
      socket.emit('notices', notices);
    } catch (error) {
      console.error('Error sending notices:', error);
      socket.emit('error', { message: 'Failed to fetch notices' });
    }
  };

  // Send notices immediately on connection
  sendNotices();

  // Update every minute (60000ms)
  const noticeInterval = setInterval(sendNotices, 60000);

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Socket.io connection closed:', socket.id);
    
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      // Broadcast user offline status
      socket.broadcast.emit('user_offline', { userId: socket.userId });
      console.log(`User ${socket.userId} went offline`);
    }
    
    clearInterval(noticeInterval);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket.io error:', error);
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.io server running on http://localhost:${PORT}`);
});