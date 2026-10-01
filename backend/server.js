const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Import Route Handlers
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const allocationRoutes = require('./routes/allocationRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

const app = express();

// Security and utility middleware
app.use(helmet({
  contentSecurityPolicy: false // Allows loading Chart.js and Lucide icons via CDN
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.originalUrl}`);
    next();
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Smart Room Allocation API',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime())
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

// Serve frontend static files
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Fallback for SPA routing
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`
    });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Centralized error handling
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    logger.info(`=======================================================`);
    logger.info(` Smart Room Allocation System Backend Running!`);
    logger.info(` Local API URL:      http://localhost:${PORT}/api/health`);
    logger.info(` Web Application:    http://localhost:${PORT}`);
    logger.info(` Environment:        ${process.env.NODE_ENV || 'development'}`);
    logger.info(`=======================================================`);
  });

  // Handle process termination gracefully
  process.on('SIGINT', () => {
    logger.info('Shutting down server gracefully...');
    server.close(() => {
      logger.info('Server closed. Goodbye.');
      process.exit(0);
    });
  });
}

module.exports = app;
