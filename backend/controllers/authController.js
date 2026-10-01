const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Handle user login
 */
exports.login = (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const user = db.get('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', email.trim());

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User does not exist.'
      });
    }

    if (user.is_active !== 1) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.'
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Password incorrect.'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Fetch department details if assigned
    let department = null;
    if (user.department_id) {
      department = db.get('SELECT id, name, code FROM departments WHERE id = ?', user.department_id);
    }

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department_id: user.department_id,
        department
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get current authenticated user profile
 */
exports.getMe = (req, res, next) => {
  try {
    const user = db.get(`
      SELECT u.id, u.name, u.email, u.role, u.department_id, u.is_active, u.created_at,
             d.name as department_name, d.code as department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `, req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Change current user password
 */
exports.changePassword = (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both current and new passwords.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.'
      });
    }

    const user = db.get('SELECT * FROM users WHERE id = ?', req.user.id);
    const isMatch = bcrypt.compareSync(currentPassword, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password does not match our records.'
      });
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPassword, salt);

    db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', newHash, req.user.id);

    res.json({
      success: true,
      message: 'Password updated successfully.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get list of faculty members (for dropdowns)
 */
exports.getFacultyList = (req, res, next) => {
  try {
    const faculty = db.query(`
      SELECT u.id, u.name, u.email, u.department_id, d.name as department_name, d.code as department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.role = 'faculty' AND u.is_active = 1
      ORDER BY u.name ASC
    `);

    res.json({
      success: true,
      faculty
    });
  } catch (err) {
    next(err);
  }
};
