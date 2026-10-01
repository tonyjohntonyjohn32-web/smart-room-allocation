const logger = require('../utils/logger');

/**
 * Centralized Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, err.stack);

  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);

  const response = {
    success: false,
    message: err.message || 'An unexpected server error occurred.'
  };

  if (err.errors) {
    response.errors = err.errors;
  }

  // Only include stack trace if explicitly in local debug
  if (process.env.NODE_ENV === 'debug') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
