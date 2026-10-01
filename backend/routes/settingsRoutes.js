const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/', authenticateToken, settingsController.getSettings);
router.put('/', authenticateToken, requireRole('admin'), settingsController.updateSettings);

module.exports = router;
