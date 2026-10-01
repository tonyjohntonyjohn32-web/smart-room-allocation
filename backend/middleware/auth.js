const jwt = require('jsonwebtoken');
const { db } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_academic_project_2025_change_in_production';

/**
 * Authentication middleware to verify JWT tokens
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer <TOKEN>

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authorization token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch fresh user record from database
    const user = db.get('SELECT id, name, email, role, department_id, is_active FROM users WHERE id = ?', decoded.id);

    if (!user || user.is_active !== 1) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or inactive user account.'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session token expired. Please log in again.'
      });
    }
    return res.status(403).json({
      success: false,
      message: 'Invalid authorization token.'
    });
  }
}

/**
 * Role authorization middleware
 * @param  {...string} roles Allowed roles (e.g. 'admin', 'faculty')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. This operation requires one of the following roles: [${roles.join(', ')}].`
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET
};
