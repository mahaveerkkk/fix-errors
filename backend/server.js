const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http'); // Required for Socket.io
require('dotenv').config();
const connectDB = require('./config/db');
const { initSocket } = require('./socket');
const { initScheduler } = require('./services/schedulerService');

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app); // Create HTTP server

// Initialize Socket.io
initSocket(server);

// Initialize Scheduled Jobs (30-min reminders, daily summaries)
initScheduler();

// Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Routes
const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const salonRoutes = require('./routes/salonRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/salons', salonRoutes);
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/test', require('./routes/testRoutes'));
app.use('/api/support', require('./routes/supportRoutes'));
app.use('/api/config', require('./routes/configRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/referral', require('./routes/referralRoutes'));
app.use('/api/crm', require('./routes/crmRoutes'));
app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => {
  res.send('SmartSalon Backend is running with MongoDB & Socket.io!');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
});
